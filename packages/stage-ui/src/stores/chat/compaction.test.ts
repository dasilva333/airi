import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {
  buildWinnowCompactionWindows,
  capWinnowSurvivorsToBudget,
  estimateMessageListTokens,
  extractCompactionMessageText,
  useCompactionStore,
} from './compaction'

const shared = vi.hoisted(() => ({
  activeCard: null as any,
  activeCardId: 'char-1',
  sessionMessages: new Map<string, any[]>(),
  sessionMetas: new Map<string, any>(),
  createdArchives: [] as any[],
  systemOneConfigured: false,
  runWinnowTurnCompaction: vi.fn(),
  summarizeBucket: vi.fn(),
  persistStmm: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

vi.mock('../modules/airi-card', () => ({
  useAiriCardStore: () => ({
    activeCard: ref(shared.activeCard),
    activeCardId: ref(shared.activeCardId),
  }),
}))

vi.mock('../modules/consciousness', () => ({
  useConsciousnessStore: () => ({
    activeProvider: 'test-provider',
    activeModel: 'test-model',
  }),
}))

vi.mock('../providers', () => ({
  useProvidersStore: () => ({
    getProviderInstance: vi.fn(async () => ({})),
  }),
}))

vi.mock('../memory-short-term', () => ({
  useShortTermMemoryStore: () => ({
    blocks: [],
    summarizeBucket: shared.summarizeBucket,
    persist: shared.persistStmm,
  }),
}))

vi.mock('../modules/system-one', () => ({
  useSystemOneStore: () => ({
    get configured() { return shared.systemOneConfigured },
    runWinnowTurnCompaction: shared.runWinnowTurnCompaction,
  }),
}))

vi.mock('./session-store', () => ({
  useChatSessionStore: () => ({
    getSessionMessages: (id: string) => shared.sessionMessages.get(id) ?? [],
    getSessionMeta: (id: string) => shared.sessionMetas.get(id) ?? null,
    createSession: vi.fn(async (characterId: string, opts: any) => {
      shared.createdArchives.push({ characterId, ...opts })
      return 'archive-session-id'
    }),
    setSessionMessages: vi.fn(async (id: string, msgs: any[]) => {
      shared.sessionMessages.set(id, msgs)
    }),
  }),
}))

describe('compaction pure helpers', () => {
  it('extracts text from both string and multimodal array messages', () => {
    expect(extractCompactionMessageText({ content: 'hello world' })).toBe('hello world')
    expect(extractCompactionMessageText({
      content: [
        { type: 'text', text: 'part one' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,xxx' } },
        { type: 'text', text: 'part two' },
      ],
    })).toBe('part one\npart two')
  })

  it('pairs messages into 2-turn exchange windows', () => {
    const msgs = [
      { id: '1', role: 'user', content: 'Hi there' },
      { id: '2', role: 'assistant', content: 'Hello!' },
      { id: '3', role: 'user', content: 'I moved to Shibuya today' },
      { id: '4', role: 'assistant', content: 'Congrats on the move!' },
    ]
    const windows = buildWinnowCompactionWindows(msgs, 'Airi', 2)
    expect(windows).toHaveLength(2)
    expect(windows[0].id).toBe('w0')
    expect(windows[0].messages.map(m => m.id)).toEqual(['1', '2'])
    expect(windows[1].id).toBe('w1')
    expect(windows[1].text).toContain('User: I moved to Shibuya today')
  })

  it('caps Winnow survivors to 75% of threshold (keeping newest first)', () => {
    const candidates = [
      { id: 'old-1', role: 'user', content: 'a'.repeat(400) },
      { id: 'new-2', role: 'user', content: 'b'.repeat(400) },
    ]
    const singleTokens = estimateMessageListTokens([candidates[0]])
    // Give enough budget for only 1 of the 2 candidates under the 0.75 ceiling
    const threshold = Math.ceil((100 + singleTokens + 10) / 0.75)
    const kept = capWinnowSurvivorsToBudget(candidates, 100, threshold, 0.75)
    expect(kept.map(m => m.id)).toEqual(['new-2'])
  })
})

describe('useCompactionStore: prune, winnow & distill strategies', () => {
  function seedSession(strategy: string, contextWidth = 200) {
    shared.activeCard = {
      name: 'Airi',
      extensions: {
        airi: {
          generation: {
            known: { contextWidth },
            compaction: { strategy, minKeepTurns: 2 },
          },
        },
      },
    }
    const messages = [
      { id: 'sys-0', role: 'system', content: 'You are Airi.' },
      { id: 'c1', role: 'user', content: `Hello! ${'filler '.repeat(40)}` },
      { id: 'c2', role: 'assistant', content: `Hi! ${'filler '.repeat(40)}` },
      { id: 'c3', role: 'user', content: 'My birthday is October 14 and I love ramen.' },
      { id: 'c4', role: 'assistant', content: 'I will always remember October 14!', rawContent: '<|ACT:smile|> I will always remember October 14!' },
      { id: 'p1', role: 'user', content: 'Recent turn 1' },
      { id: 'p2', role: 'assistant', content: 'Recent turn 2' },
    ]
    shared.sessionMessages.set('s1', messages)
    shared.sessionMetas.set('s1', { sessionId: 's1', universeId: 'cyberpunk-au' })
  }

  beforeEach(() => {
    shared.sessionMessages.clear()
    shared.sessionMetas.clear()
    shared.createdArchives = []
    shared.systemOneConfigured = false
    shared.runWinnowTurnCompaction.mockReset()
  })

  it('archives with the session universeId and keeps only high-salience turns verbatim in winnow mode', async () => {
    seedSession('winnow', 120)
    shared.systemOneConfigured = true
    // Window w0 = (c1, c2) filler, Window w1 = (c3, c4) durable fact
    shared.runWinnowTurnCompaction.mockResolvedValue(new Set(['w1']))

    setActivePinia(createPinia())
    const store = useCompactionStore()

    expect(store.shouldCompact('s1')).toBe(true)
    await store.executeCompaction('s1')

    // 1. Full archive created in the exact same universe ('cyberpunk-au')
    expect(shared.createdArchives).toHaveLength(1)
    expect(shared.createdArchives[0].universeId).toBe('cyberpunk-au')
    expect(shared.createdArchives[0].messages).toHaveLength(7)

    // 2. Active session pruned w0 (c1, c2) but kept w1 (c3, c4) verbatim with rawContent intact!
    const remaining = shared.sessionMessages.get('s1')!
    expect(remaining.map(m => m.id)).toEqual(['sys-0', 'c3', 'c4', 'p1', 'p2'])
    expect(remaining.find(m => m.id === 'c4')?.rawContent).toBe('<|ACT:smile|> I will always remember October 14!')
    expect(store.shouldCompact('s1')).toBe(false)
  })

  it('falls back cleanly to prune when System 1 is not configured or throws', async () => {
    seedSession('winnow', 120)
    shared.systemOneConfigured = true
    shared.runWinnowTurnCompaction.mockRejectedValue(new Error('Jev offline'))

    setActivePinia(createPinia())
    const store = useCompactionStore()
    await store.executeCompaction('s1')

    const remaining = shared.sessionMessages.get('s1')!
    expect(remaining.map(m => m.id)).toEqual(['sys-0', 'p1', 'p2'])
  })

  it('bypasses Winnow and falls back to prune without calling System 1 when unconfigured', async () => {
    seedSession('winnow', 120)
    shared.systemOneConfigured = false // Unconfigured

    setActivePinia(createPinia())
    const store = useCompactionStore()

    expect(store.shouldCompact('s1')).toBe(true)
    await store.executeCompaction('s1')

    // Assert System 1 was never touched
    expect(shared.runWinnowTurnCompaction).not.toHaveBeenCalled()

    // Fell back cleanly to prune (keeping only minKeepTurns = 2 + system message)
    const remaining = shared.sessionMessages.get('s1')!
    expect(remaining.map(m => m.id)).toEqual(['sys-0', 'p1', 'p2'])
  })

  it('distills toCompact into one short-term-memory block per day bucket, then prunes to system + preserved tail', async () => {
    seedSession('distill', 120)
    // Distill reads windows from card extensions; default windowSize (3) would
    // cover both seeded days, so no override is needed — but make it explicit.
    shared.activeCard.extensions.airi.shortTermMemory = { windowSize: 3, tokenBudgetPerDay: 1000 }
    // Overwrite seeded messages with createdAt spread over two past days so
    // the distill bucketer sees two distinct day buckets.
    const day1 = new Date('2026-09-01T10:00:00Z').getTime()
    const day2 = new Date('2026-09-02T10:00:00Z').getTime()
    const messages = [
      { id: 'sys-0', role: 'system', content: 'You are Airi.' },
      { id: 'c1', role: 'user', content: 'Day one question about ships?', createdAt: day1 },
      { id: 'c2', role: 'assistant', content: 'Day one answer about ships.', createdAt: day1 + 60_000 },
      { id: 'c3', role: 'user', content: 'Day two question about ramen?', createdAt: day2 },
      { id: 'c4', role: 'assistant', content: 'Day two answer about ramen.', createdAt: day2 + 60_000 },
      { id: 'p1', role: 'user', content: 'Recent turn 1', createdAt: Date.now() },
      { id: 'p2', role: 'assistant', content: 'Recent turn 2', createdAt: Date.now() },
    ]
    shared.sessionMessages.set('s1', messages)
    shared.summarizeBucket.mockReset()
    shared.summarizeBucket.mockImplementation(async (_characterId: string, _card: any, _provider: any, modelId: string, bucket: any) => ({
      characterId: 'char-1',
      date: bucket.date,
      summary: `Distilled ${bucket.date} from ${bucket.messageCount} messages via ${modelId}`,
      importance: 5,
      embedding: Array.from({ length: 384 }, () => 0.1),
    }))
    shared.persistStmm.mockReset()

    setActivePinia(createPinia())
    const store = useCompactionStore()
    await store.executeCompaction('s1')

    // 1. Archive session created in the session's universe, with every message.
    expect(shared.createdArchives).toHaveLength(1)
    expect(shared.createdArchives[0].universeId).toBe('cyberpunk-au')
    expect(shared.createdArchives[0].messages).toHaveLength(7)

    // 2. One LLM distillation per day bucket (two buckets), never touching System 1.
    expect(shared.summarizeBucket).toHaveBeenCalledTimes(2)
    expect(shared.runWinnowTurnCompaction).not.toHaveBeenCalled()

    // 3. Distilled blocks persisted to the short-term-memory store.
    expect(shared.persistStmm).toHaveBeenCalledTimes(1)
    const persisted = shared.persistStmm.mock.calls[0][0]
    expect(persisted.map((b: any) => b.date).sort()).toEqual(['2026-09-01', '2026-09-02'])
    expect(persisted.every((b: any) => b.summary.startsWith('Distilled'))).toBe(true)

    // 4. Active session reduced to system message + preserved tail; compacted
    // turns survive only inside the STMM blocks, not verbatim.
    const remaining = shared.sessionMessages.get('s1')!
    expect(remaining.map(m => m.id)).toEqual(['sys-0', 'p1', 'p2'])
  })
})
