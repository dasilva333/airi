import type { AiriCard } from './modules/airi-card'

import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useEchoesStore } from './echo-chips'

const mockSavedChips = vi.hoisted(() => ({ list: [] as any[] }))

vi.mock('../database/repos/echo-chips.repo', () => ({
  echoChipsRepo: {
    getAll: vi.fn(async () => mockSavedChips.list),
    saveAll: vi.fn(async (_uid: string, chips: any[]) => {
      mockSavedChips.list = [...chips]
    }),
  },
}))

vi.mock('../database/repos/chat-sessions.repo', () => ({
  chatSessionsRepo: {
    getIndex: vi.fn(async () => ({
      characters: {
        'char-1': {
          activeSessionId: 'sess-1',
          sessions: {
            'sess-1': { sessionId: 'sess-1', universeId: 'global', updatedAt: 1000 },
          },
        },
      },
    })),
    getSession: vi.fn(async () => ({
      meta: { sessionId: 'sess-1', universeId: 'global', updatedAt: 1000 },
      messages: [
        { role: 'user', content: 'Do you remember our adventure at the old lighthouse?', createdAt: 1000 },
        { role: 'assistant', content: 'Yes! The storm that night was unforgettable.', createdAt: 2000 },
      ],
    })),
  },
}))

vi.mock('../libs/search/layered-memory', () => ({
  layeredMemory: {
    search: vi.fn(async () => [
      {
        id: 'hist-1',
        layer: 'long_term',
        date: '2026-07-15',
        observed_text: 'Alice and user explored the abandoned lighthouse during a thunderstorm.',
        timestamp: 500, // Historical: before window
      },
      {
        id: 'window-turn',
        layer: 'dialogue',
        date: '2026-08-01',
        observed_text: 'Do you remember our adventure at the old lighthouse?',
        timestamp: 1000, // Inside window: should be filtered out
      },
    ]),
  },
}))

const h = vi.hoisted(() => ({
  userId: { r: null as any },
  cards: { r: null as any },
  activeCardId: { r: null as any },
  activeProvider: { r: null as any },
  activeModel: { r: null as any },
  generateObjectResult: { r: null as any },
}))

vi.mock('./auth', async () => {
  const { reactive, ref } = await import('vue')
  h.userId.r = ref<string | null>('user-1')
  return { useAuthStore: () => reactive({ userId: h.userId.r }) }
})

vi.mock('./modules/airi-card', async () => {
  const { reactive, ref } = await import('vue')
  const cardMap = new Map<string, AiriCard>()
  cardMap.set('char-1', {
    name: 'Alice',
    extensions: {
      airi: {
        modules: {
          consciousness: {
            provider: 'provider-1',
            model: 'model-1',
          },
        },
      },
    },
  } as any)
  h.cards.r = ref(cardMap)
  h.activeCardId.r = ref('char-1')
  return {
    useAiriCardStore: () => reactive({
      cards: h.cards.r,
      activeCardId: h.activeCardId.r,
    }),
  }
})

vi.mock('./modules/consciousness', async () => {
  const { reactive, ref } = await import('vue')
  h.activeProvider.r = ref('provider-1')
  h.activeModel.r = ref('model-1')
  return {
    useConsciousnessStore: () => reactive({
      activeProvider: h.activeProvider.r,
      activeModel: h.activeModel.r,
    }),
  }
})

vi.mock('./providers', () => ({
  useProvidersStore: () => ({
    configuredProviders: { 'provider-1': {} },
    getProviderInstance: vi.fn(async () => ({})),
  }),
}))

vi.mock('./chat/session-store', () => ({
  useChatSessionStore: () => ({
    activeSessionId: 'sess-1',
    getCharacterIndex: () => ({ activeSessionId: 'sess-1' }),
    getSessionMeta: () => ({ universeId: 'global' }),
  }),
}))

vi.mock('./llm', () => ({
  useLLM: () => ({
    generateObject: vi.fn(async (_model: string, _provider: any, options: any) => {
      // Simulate normal LLM output
      const rawOutput = h.generateObjectResult.r || {
        pills: [
          {
            content: 'Lighthouse in the storm',
            type: 'mood',
            relevanceScore: 0.95,
            evidence_indices: [0, 1, 2],
          },
          {
            content: 'Lighthouse Keeper Mystery',
            type: 'journal_candidate',
            relevanceScore: 0.88,
            evidence_indices: [2],
          },
        ],
        claims: [
          {
            subject: 'Alice',
            predicate: 'remembers',
            object: 'lighthouse storm',
            action: 'reinforce',
          },
          {
            subject: 'User',
            predicate: 'likes',
            object: 'coastal adventures',
            action: 'new',
          },
        ],
        mood_shift: {
          valence: 0.7,
          arousal: -0.2,
          sentiment: 'wistful',
        },
      }
      return options.normalize ? options.normalize(rawOutput) : rawOutput
    }),
  }),
}))

describe('useEchoesStore (Consumer 4)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: false }))
    mockSavedChips.list = []
    h.generateObjectResult.r = null
  })

  it('synthesizes Echo Chips with double-duty claims and mood shift', async () => {
    const store = useEchoesStore()
    const newChips = await store.synthesizeForCharacter('char-1', {
      force: true,
      fromTimestamp: 0,
      toTimestamp: 3000,
    })

    expect(newChips).toHaveLength(2)

    // Check pill 1
    const pill1 = newChips[0]
    expect(pill1.content).toBe('Lighthouse in the storm')
    expect(pill1.type).toBe('mood')
    expect(pill1.relevanceScore).toBe(0.95)
    expect(pill1.evidenceIndices).toEqual([0, 1, 2])
    expect(pill1.citedText).toBeDefined()
    expect(pill1.citedText?.length).toBeGreaterThan(0)

    // Check double-duty claims attached
    expect(pill1.claims).toBeDefined()
    expect(pill1.claims).toHaveLength(2)
    expect(pill1.claims?.[0].predicate).toBe('remembers')
    expect(pill1.claims?.[0].action).toBe('reinforce')

    // Check emotional exhaust mood shift
    expect(pill1.moodShift).toBeDefined()
    expect(pill1.moodShift?.sentiment).toBe('wistful')
    expect(pill1.moodShift?.valence).toBe(0.7)

    // Check persistence
    expect(mockSavedChips.list).toHaveLength(2)
  })

  it('deletes an echo chip via deleteChip', async () => {
    const store = useEchoesStore()
    const newChips = await store.synthesizeForCharacter('char-1', {
      force: true,
      fromTimestamp: 0,
      toTimestamp: 3000,
    })

    expect(store.chips).toHaveLength(2)
    const chipToDelete = newChips[0].id

    await store.deleteChip(chipToDelete)

    expect(store.chips).toHaveLength(1)
    expect(store.chips[0].id).not.toBe(chipToDelete)
    expect(mockSavedChips.list).toHaveLength(1)
  })

  it('normalizes missing claims and mood shift gracefully when LLM emits minimal payload', async () => {
    h.generateObjectResult.r = {
      pills: [
        {
          content: 'Late night tea',
          type: 'flavor',
          relevanceScore: 0.6,
        },
      ],
      // No claims or mood_shift provided
    }

    const store = useEchoesStore()
    const newChips = await store.synthesizeForCharacter('char-1', {
      force: true,
      fromTimestamp: 0,
      toTimestamp: 3000,
    })

    expect(newChips).toHaveLength(1)
    expect(newChips[0].content).toBe('Late night tea')
    expect(newChips[0].claims).toEqual([])
    expect(newChips[0].moodShift).toBeUndefined()
  })
})
