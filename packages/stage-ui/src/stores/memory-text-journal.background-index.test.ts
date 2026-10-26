import type { TextJournalEntry } from '../types/text-journal'
import type { AiriCard } from './modules/airi-card'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTextJournalStore } from './memory-text-journal'

// Background pass contract under test:
//   1. cold snapshot → active-session "hot set" first, then oldest → newest
//   2. the persisted watermark is a coverage frontier, never a max-of-batch leap
//   3. checkpoints let a later pass resume instead of re-embedding everything
//   4. batches stay small enough that a preflight search can interleave

const h = vi.hoisted(() => ({
  indexDocuments: vi.fn(async () => undefined),
  persist: vi.fn(async () => undefined),
  lastIndexState: { stale: false, lastIndexedTurnAt: 0 } as { stale: boolean, lastIndexedTurnAt: number },
}))

vi.mock('../libs/search/layered-memory', () => ({
  LAST_INDEXED_TURN_KEY: 'airi:search:last-indexed-turn',
  layeredMemory: {
    init: vi.fn(async () => h.lastIndexState),
    indexDocuments: h.indexDocuments,
    persist: h.persist,
    get lastIndexState() {
      return h.lastIndexState
    },
    search: vi.fn(async () => []),
  },
}))

vi.mock('../utils/memory-sentinel', () => ({
  shouldDegradeBackgroundWork: () => false,
}))

vi.mock('../database/repos/text-journal.repo', () => ({
  textJournalRepo: {
    getAll: vi.fn(async () => []),
    saveAll: vi.fn(async () => undefined),
  },
}))

vi.mock('../database/repos/short-term-memory.repo', () => ({
  shortTermMemoryRepo: { getAll: vi.fn(async () => []) },
}))

vi.mock('../database/repos/echo-chips.repo', () => ({
  echoChipsRepo: { getAll: vi.fn(async () => []) },
}))

vi.mock('../database/repos/lifetime-memory.repo', () => ({
  lifetimeMemoryRepo: { getByCharacter: vi.fn(async () => null) },
}))

vi.mock('../database/repos/chat-sessions.repo', () => ({
  chatSessionsRepo: {
    getIndex: vi.fn(async () => ({
      characters: {
        'card-1': {
          sessions: {
            s1: { sessionId: 's1', universeId: 'global', updatedAt: 10 },
          },
        },
      },
    })),
    getSession: vi.fn(async () => ({
      messages: [
        { id: 'msg-1', role: 'user', content: 'hello from the active session', createdAt: 500 },
      ],
    })),
  },
}))

const auth = vi.hoisted(() => ({ userId: null as null | { value: string | null } }))

vi.mock('./auth', async () => {
  const { reactive, ref } = await import('vue')
  auth.userId = ref<string | null>('local')
  return { useAuthStore: () => reactive({ userId: auth.userId }) }
})

vi.mock('./modules/airi-card', async () => {
  const { reactive, ref } = await import('vue')
  const activeCardId = ref<string>('card-1')
  const activeCard = ref<AiriCard | null>({ name: 'TestChar', version: '1' } as unknown as AiriCard)
  return {
    useAiriCardStore: () => reactive({
      activeCard,
      activeCardId,
      cards: ref(new Map()),
    }),
  }
})

vi.mock('./chat/session-store', () => ({
  useChatSessionStore: () => ({
    activeSessionId: 's1',
    getCharacterIndex: () => ({ activeSessionId: 's1' }),
    getSessionMeta: () => ({ universeId: 'global' }),
  }),
}))

const { textJournalRepo } = await import('../database/repos/text-journal.repo')

function makeEntries(count: number): TextJournalEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `ltmm-${i}`,
    userId: 'local',
    characterId: 'card-1',
    characterName: 'TestChar',
    title: `Entry ${i}`,
    content: `Journal content ${i}`,
    source: 'tool',
    type: 'message',
    createdAt: (i + 1) * 1000,
    updatedAt: (i + 1) * 1000,
    universeId: 'global',
  })) as TextJournalEntry[]
}

function indexedIds(call: number): string[] {
  return (h.indexDocuments.mock.calls[call]?.[0] as Array<{ id: string }>).map(d => d.id)
}

function persistedWatermarks(): number[] {
  return h.persist.mock.calls.map(call => (call[1] as { watermark?: number } | undefined)?.watermark ?? -1)
}

describe('text journal background index pass', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.lastIndexState = { stale: false, lastIndexedTurnAt: 0 }
    setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }))
  })

  it('indexes the active session first, then walks oldest to newest', async () => {
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(makeEntries(3))

    const store = useTextJournalStore()
    await store.load()
    await store.backgroundIndexAll()

    // Hot set first: the active session turn, despite being the oldest document.
    expect(indexedIds(0)).toEqual(['msg-1'])

    // Then the remaining docs ascending by index time.
    const backfillIds = h.indexDocuments.mock.calls.slice(1).flatMap((_, i) => indexedIds(i + 1))
    expect(backfillIds).toEqual(['ltmm-0', 'ltmm-1', 'ltmm-2'])

    expect(store.backgroundIndexProgress?.phase).toBe('completed')
    expect(store.backgroundIndexProgress?.cursor).toBe(3000)
  })

  it('checkpoints a monotonic coverage frontier, and only publishes the true max at the end', async () => {
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(makeEntries(300))

    const store = useTextJournalStore()
    await store.load()
    await store.backgroundIndexAll()

    const watermarks = persistedWatermarks()
    // Hot-set checkpoint (nothing covered yet) → mid-pass checkpoint at the
    // 250-doc boundary → final frontier at the true max.
    expect(watermarks[0]).toBe(0)
    expect(watermarks.at(-1)).toBe(300_000)
    expect(watermarks).toEqual([...watermarks].sort((a, b) => a - b))
    expect(watermarks.length).toBeGreaterThanOrEqual(3)
  })

  it('resumes from the persisted frontier instead of re-embedding the corpus', async () => {
    h.lastIndexState = { stale: false, lastIndexedTurnAt: 200_000 }
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(makeEntries(300))

    const store = useTextJournalStore()
    await store.load()
    await store.backgroundIndexAll()

    const allIndexed = h.indexDocuments.mock.calls.flatMap((call, i) => indexedIds(i))
    expect(allIndexed).toHaveLength(100)
    expect(allIndexed[0]).toBe('ltmm-200')
    expect(store.backgroundIndexProgress?.cursor).toBe(300_000)
  })

  it('keeps batches at or below the interleave budget', async () => {
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(makeEntries(120))

    const store = useTextJournalStore()
    await store.load()
    await store.backgroundIndexAll()

    for (const call of h.indexDocuments.mock.calls) {
      expect((call[0] as unknown[]).length).toBeLessThanOrEqual(25)
    }
  })

  it('surfaces an error phase and still checkpoints what was indexed', async () => {
    ;(textJournalRepo.getAll as ReturnType<typeof vi.fn>).mockResolvedValue(makeEntries(3))
    h.indexDocuments.mockRejectedValueOnce(new Error('onnx exploded'))

    const store = useTextJournalStore()
    await store.load()
    await store.backgroundIndexAll()

    expect(store.backgroundIndexProgress?.phase).toBe('error')
    expect(store.backgroundIndexProgress?.message).toContain('onnx exploded')
    expect(h.persist).toHaveBeenCalled()
  })
})
