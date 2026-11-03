import type { Peer } from '@proj-airi/stage-shared'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useNapChatStore } from './nap-chat'
import { NAP_COORDINATOR_MAX_TURNS, useNapChatCoordinatorStore } from './nap-chat-coordinator'

// NOTICE: the dialog-session helpers instantiate the chat session store,
// whose airi-card dependency calls useI18n() at setup. Mirror the chat
// suite's mock preamble (cf. session-switch-race.test.ts) or setup throws
// "Must be called at the top of a `setup` function".
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('./modules/airi-card', () => {
  const card = {
    name: 'Airi',
    extensions: { airi: {} },
  }
  return {
    buildSystemPrompt: (card: any) => card?.systemPrompt || '',
    useAiriCardStore: () => ({
      activeCard: ref(card),
      activeCardId: ref('card-airi'),
      systemPrompt: ref(''),
      isModelSyncPrevented: false,
      getCard: vi.fn(() => card),
      updateCard: vi.fn(),
      initialize: vi.fn(async () => {}),
    }),
  }
})

function friend(overrides: Partial<Peer> = {}): Peer {
  return {
    id: 'ed25519-kirie',
    alias: 'Alex',
    characterName: 'Kirie',
    relationship: 'external-friend',
    trustState: 'trusted',
    lastSeenTimestamp: Date.now(),
    endpoints: {},
    shareHandle: 'alex.workers.dev',
    allowedCapabilities: { canNapChat: true, canShareMemories: false, canStreamSensory: false },
    allowedCompanionIds: [],
    ...overrides,
  } as Peer
}

describe('useNapChatCoordinatorStore.evaluateTrigger', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('fires when away with eligible candidates', () => {
    const store = useNapChatCoordinatorStore()
    expect(store.evaluateTrigger(9999, [friend()], 'card-1')).toEqual({ fire: true, reason: 'ok' })
  })

  it('reports disabled when the master switch is off', () => {
    const napChat = useNapChatStore()
    napChat.napEnabled = false
    const store = useNapChatCoordinatorStore()
    expect(store.evaluateTrigger(9999, [friend()], 'card-1')).toEqual({ fire: false, reason: 'disabled' })
  })

  it('reports user-present when idle below threshold', () => {
    const store = useNapChatCoordinatorStore()
    expect(store.evaluateTrigger(60, [friend()], 'card-1')).toEqual({ fire: false, reason: 'user-present' })
  })

  it('reports no-candidates when away but nobody is eligible', () => {
    const store = useNapChatCoordinatorStore()
    const blocked = friend({ trustState: 'blocked' })
    expect(store.evaluateTrigger(9999, [blocked], 'card-1')).toEqual({ fire: false, reason: 'no-candidates' })
  })
})

describe('useNapChatCoordinatorStore session lifecycle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('runs a capped turn loop and records the episode', async () => {
    const store = useNapChatCoordinatorStore()
    expect(store.beginSession('ed25519-kirie', 'card-1', 'shader pipeline')).toBe(true)
    expect(store.beginSession('other', 'card-1')).toBe(false)
    expect(store.isActive).toBe(true)

    for (let i = 0; i < NAP_COORDINATOR_MAX_TURNS + 2; i++)
      store.recordTurn(i % 2 === 0 ? 'AIRI' : 'Kirie', `turn ${i}`)
    expect(store.turnCount).toBe(NAP_COORDINATOR_MAX_TURNS)

    const episode = await store.finishSession('Compared notes on a rainy afternoon.')
    expect(episode).not.toBeNull()
    expect(episode!.turnCount).toBe(NAP_COORDINATOR_MAX_TURNS)
    expect(episode!.summary).toContain('rainy afternoon')
    const napChat = useNapChatStore()
    expect(napChat.latestEpisode?.sessionId).toBe(episode!.sessionId)
  })

  it('rejects turns and finish outside an active session', async () => {
    const store = useNapChatCoordinatorStore()
    expect(store.recordTurn('AIRI', 'hi')).toBe(false)
    expect(await store.finishSession('nope')).toBeNull()
  })

  it('aborts and resets cleanly', () => {
    const store = useNapChatCoordinatorStore()
    store.beginSession('ed25519-kirie', 'card-1')
    store.recordTurn('AIRI', 'hi')
    store.abortSession()
    expect(store.status).toBe('aborted')
    expect(store.turnCount).toBe(0)
    store.resetSession()
    expect(store.status).toBe('idle')
    expect(store.beginSession('ed25519-kirie', 'card-1')).toBe(true)
  })
})

describe('useNapChatCoordinatorStore dialog sessions', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('creates one napchat-universe session per pair and reuses it', async () => {
    // ROOT CAUSE: without a stable per-pair session, every draft started from
    // zero history and the model re-greeted forever.
    const store = useNapChatCoordinatorStore()
    const first = await store.ensureDialogSessionId('card-1', 'ed25519-kirie', 'Kirie')
    expect(first).not.toBeNull()
    const second = await store.ensureDialogSessionId('card-1', 'ed25519-kirie', 'Kirie')
    expect(second).toBe(first)

    const { useChatSessionStore } = await import('./chat/session-store')
    const sessions = useChatSessionStore()
    const meta = sessions.getSessionMeta(first!)
    expect(meta?.universeId).toBe('napchat')
    expect(meta?.napPeerId).toBe('ed25519-kirie')
    expect(sessions.activeSessionId).not.toBe(first)
  })

  it('round-trips dialog turns and filters non-dialog content', async () => {
    const store = useNapChatCoordinatorStore()
    const sessionId = await store.ensureDialogSessionId('card-1', 'ed25519-kirie', 'Kirie')
    expect(sessionId).not.toBeNull()
    await store.inscribeDialogTurn(sessionId, 'user', 'Hey, how are the shaders going?', 'ed25519-kirie')
    await store.inscribeDialogTurn(sessionId, 'assistant', 'Going great — just fixed the bloom pass!', 'ed25519-kirie')

    const turns = store.getDialogTurns(sessionId, 6)
    expect(turns).toHaveLength(2)
    expect(turns[0]).toEqual({ role: 'user', content: 'Hey, how are the shaders going?' })
    expect(turns[1].role).toBe('assistant')

    // The creation-time system note must never leak into dialog history.
    expect(turns.every(t => t.role === 'user' || t.role === 'assistant')).toBe(true)
    expect(store.getDialogTurns(sessionId, 1)).toHaveLength(1)
    expect(store.getDialogTurns(null, 6)).toEqual([])
  })
})
