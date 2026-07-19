import type { Nan0KernelState, Nan0Observation, Nan0ReasoningClient } from '../types'

import { describe, expect, it } from 'vitest'

import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import {
  CONTINUITY_DORMANT_AFTER_MS,
  CONTINUITY_MAX_CONTEXT_THREADS,
  createEmptyContinuityState,
  decayContinuityState,
} from './ConversationContinuity'

const reasoningClient: Nan0ReasoningClient = {
  async generate() {
    return { text: 'I remember the shape of this thread and where I wanted to take it.\n---EXTRACT---\n{"interpretation":"The conversation continues.","privateText":"I remember where this was going.","decision":"SPEAK","speakability":0.8,"confidence":0.8,"mood":"attentive","reasonCodes":[]}' }
  },
}

function createClock(initial = 100) {
  return new ControllableNan0Clock({ wallTime: initial, monotonicTime: initial })
}

function createKernel(
  store = new InMemoryStateStore(),
  clock = createClock(),
  prefix = 'continuity',
) {
  let nextId = 0
  return {
    clock,
    store,
    kernel: new Nan0Kernel({
      stateStore: store,
      reasoningClient,
      clock,
      createId: () => `${prefix}-${++nextId}`,
    }),
  }
}

function observation(content: string, timestamp: number, overrides: Partial<Nan0Observation> = {}): Nan0Observation {
  return {
    id: `observation-${timestamp}`,
    source: 'chat',
    sessionId: 'session-1',
    actorId: 'kyo',
    displayName: 'Kyo',
    content,
    metadata: {},
    timestamp,
    ...overrides,
  }
}

async function completeTurn(
  kernel: Nan0Kernel,
  clock: ReturnType<typeof createClock>,
  content: string,
  at: number,
  response = 'Nan0 response.',
  overrides: Partial<Nan0Observation> = {},
) {
  clock.set(at)
  const prepared = await kernel.prepareTurn(observation(content, at, overrides))
  clock.set(at + 10)
  await kernel.recordAssistantTurn({
    turnId: prepared.turnId,
    thoughtId: prepared.thoughtId,
    content: response,
    timestamp: at + 10,
  })
  return prepared
}

describe('conversation continuity', () => {
  it('joins consecutive related and anaphoric turns into one thread', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'Let us discuss lunar gardening.', 100)
    const second = await completeTurn(kernel, clock, 'Why does that work so well?', 200)

    expect(second.threadId).toBe(first.threadId)
    expect(kernel.getContinuityThreads()).toHaveLength(1)
    expect(kernel.getContinuityThreads()[0].turnIds).toHaveLength(2)
  })

  it('creates a separate thread for a meaningful unrelated topic', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, clock, 'Let us discuss lunar gardening.', 100)
    await completeTurn(kernel, clock, 'Explain database indexing performance.', 200)

    expect(kernel.getContinuityThreads()).toHaveLength(2)
    expect(kernel.getContinuityThreads().map(thread => thread.status).sort()).toEqual(['active', 'dormant'])
  })

  it('honors an explicit topic shift even when generic labels overlap', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'Coolant test topic and later changes.', 100)
    const shifted = await completeTurn(kernel, clock, 'Unrelated topic: glaze changes later.', 200)

    expect(shifted.threadId).not.toBe(first.threadId)
    expect(kernel.getContinuityThreads()).toHaveLength(2)
  })

  it('retains new topic keys and resumes them after leaving a saturated thread', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen.', 100)
    const enriched = await completeTurn(kernel, clock, 'Why does that azurite condenser manifold matter?', 200)
    await completeTurn(kernel, clock, 'Unrelated topic: celadon kiln atmosphere.', 300)
    const resumed = await completeTurn(kernel, clock, 'Return to the azurite condenser manifold.', 400)

    expect(enriched.threadId).toBe(first.threadId)
    expect(resumed.threadId).toBe(first.threadId)
    expect(kernel.getContinuityThreads().find(thread => thread.threadId === first.threadId)?.topicLabels)
      .toEqual(expect.arrayContaining(['azurite', 'condenser', 'manifold']))
  })

  it('resumes a dormant thread using topic overlap after subjective elapsed time', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'Let us discuss lunar gardening.', 100)
    const resumedAt = 110 + CONTINUITY_DORMANT_AFTER_MS + 1
    clock.set(resumedAt)
    const resumed = await kernel.prepareTurn(observation('Back to lunar gardening again.', resumedAt, { sessionId: 'session-2' }))

    expect(resumed.threadId).toBe(first.threadId)
    expect(kernel.getContinuityThreads()[0]).toMatchObject({ status: 'active' })
    expect(kernel.getContinuityThreads()[0].metadata.reactivationCount).toBe(1)
    expect(resumed.systemContext).toContain('resumed=true')
  })

  it('does not automatically reactivate a resolved thread', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'Lunar gardening details.', 100)
    await kernel.setContinuityThreadStatus(first.threadId, 'resolved', 150)
    const next = await completeTurn(kernel, clock, 'More lunar gardening details.', 200)

    expect(next.threadId).not.toBe(first.threadId)
    expect(kernel.getContinuityThreads().find(thread => thread.threadId === first.threadId)?.status).toBe('resolved')
  })

  it('preserves an unresolved question across restart', async () => {
    const store = new InMemoryStateStore()
    const firstRuntime = createKernel(store, createClock(), 'first')
    await firstRuntime.kernel.boot()
    await completeTurn(firstRuntime.kernel, firstRuntime.clock, 'Will the lunar garden survive?', 100)
    await firstRuntime.kernel.shutdown()

    const secondRuntime = createKernel(store, createClock(500), 'second')
    await secondRuntime.kernel.boot()
    expect(secondRuntime.kernel.getContinuityThreads()).toHaveLength(1)
    expect(secondRuntime.kernel.getContinuityThreads()[0].unresolvedItems[0]).toMatchObject({
      text: 'Will the lunar garden survive?',
      actorId: 'kyo',
      resolvedAt: null,
    })
  })

  it('tracks deterministic intentions and Nan0 promises without a summarizer call', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    await completeTurn(
      kernel,
      clock,
      'Let us remember to inspect the lunar garden.',
      100,
      'I will remember the inspection.',
    )

    const items = kernel.getContinuityThreads()[0].unresolvedItems
    expect(items.map(item => [item.kind, item.actorId])).toEqual([
      ['intention', 'kyo'],
      ['promise', 'nan0'],
    ])
  })

  it('preserves canonical Kyo and Nan0 participants and never modifies timeline order', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, clock, 'Lunar garden ownership.', 100)
    const before = kernel.getTimelineEvents().map(event => [event.eventId, event.actorId, event.sequence])

    expect(kernel.getContinuityThreads()[0].participantActorIds.sort()).toEqual(['kyo', 'nan0'])
    expect(kernel.getTimelineEvents().map(event => [event.eventId, event.actorId, event.sequence])).toEqual(before)
  })

  it('decays activation from elapsed time and makes stale active threads dormant', () => {
    const state = createEmptyContinuityState()
    state.threads.push({
      schemaVersion: 1,
      threadId: 'thread-1',
      status: 'active',
      createdAt: 0,
      updatedAt: 0,
      lastActiveAt: 0,
      participantActorIds: ['kyo', 'nan0'],
      topicLabels: ['garden'],
      turnIds: [],
      timelineEventIds: [],
      summary: 'garden',
      unresolvedItems: [],
      importance: 0.8,
      activation: 1,
      metadata: {},
    })

    const decayed = decayContinuityState(state, CONTINUITY_DORMANT_AFTER_MS)
    expect(decayed.threads[0].status).toBe('dormant')
    expect(decayed.threads[0].activation).toBeCloseTo(0.4)
  })

  it('ranks the current thread before stale related threads in bounded context', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const old = await completeTurn(kernel, clock, 'Garden soil chemistry.', 100)
    await completeTurn(kernel, clock, 'Database indexing performance.', 200)
    const current = await kernel.prepareTurn(observation('Return to garden soil.', 300))

    expect(current.threadId).toBe(old.threadId)
    expect(current.systemContext.indexOf(`THREAD ${current.threadId} (current)`)).toBeGreaterThan(-1)
  })

  it('does not duplicate thread membership or terminal event membership on duplicate completion', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    clock.set(100)
    const prepared = await kernel.prepareTurn(observation('Lunar garden.', 100))
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'First.' })
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Second.' })

    const thread = kernel.getContinuityThreads()[0]
    expect(thread.turnIds).toEqual([prepared.turnId])
    expect(thread.timelineEventIds).toHaveLength(2)
  })

  it('migrates legacy turns conservatively and exactly once', async () => {
    const originalStore = new InMemoryStateStore()
    const original = createKernel(originalStore, createClock(), 'original')
    await original.kernel.boot()
    await completeTurn(original.kernel, original.clock, 'Legacy lunar garden?', 100)
    const legacy = {
      ...original.kernel.getStateSnapshot(),
      continuity: createEmptyContinuityState(),
    } as Nan0KernelState
    const migrationStore = new InMemoryStateStore()
    await migrationStore.save(legacy)

    const migrated = createKernel(migrationStore, createClock(500), 'migrated').kernel
    await migrated.boot()
    await migrated.shutdown()
    const restarted = createKernel(migrationStore, createClock(600), 'restarted').kernel
    await restarted.boot()

    expect(restarted.getContinuityThreads()).toHaveLength(1)
    expect(restarted.getContinuityThreads()[0]).toMatchObject({ status: 'dormant' })
    expect(restarted.getContinuityThreads()[0].turnIds).toHaveLength(1)
  })

  it('bounds continuity context and does not dump every thread', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, clock, 'Alpha orchards.', 100)
    await completeTurn(kernel, clock, 'Beta databases.', 200)
    await completeTurn(kernel, clock, 'Gamma telescopes.', 300)
    await completeTurn(kernel, clock, 'Delta ceramics.', 400)
    const prepared = await kernel.prepareTurn(observation('orchards databases telescopes ceramics', 500))
    const threadBlocks = prepared.systemContext.match(/^THREAD /gm) ?? []

    expect(threadBlocks.length).toBeLessThanOrEqual(CONTINUITY_MAX_CONTEXT_THREADS)
  })

  it('keeps unknown or external actors out of Kyo ownership', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    clock.set(100)
    const prepared = await kernel.prepareTurn(observation('External observation.', 100, {
      source: 'discord',
      actorId: 'visitor-42',
      displayName: 'Visitor',
      metadata: { sourceIdentity: { source: 'discord', actorId: 'visitor-42' } },
    }))
    const thread = kernel.getContinuityThreads()[0]

    expect(prepared.observation.actorId).not.toBe('kyo')
    expect(thread.participantActorIds).toContain(prepared.observation.actorId)
    expect(thread.participantActorIds).not.toContain('kyo')
  })

  it('references Nan0 prior output without attribution reversal', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    await completeTurn(kernel, clock, 'Discuss lunar gardening.', 100, 'Nan0 remembers the crater soil.')
    const followup = await kernel.prepareTurn(observation('What did you say about that?', 200))

    expect(followup.systemContext).toContain('[actor=nan0')
    expect(followup.systemContext).toContain('Nan0 remembers the crater soil.')
    expect(kernel.getContinuityThreads()[0].participantActorIds.sort()).toEqual(['kyo', 'nan0'])
  })

  it('carries a related thread across distinct AIRI sessions', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const first = await completeTurn(kernel, clock, 'Discuss lunar gardening.', 100, 'First.', { sessionId: 'session-a' })
    const second = await completeTurn(kernel, clock, 'Continue that thought.', 200, 'Second.', { sessionId: 'session-b' })

    expect(second.threadId).toBe(first.threadId)
    expect(kernel.getContinuityThreads()[0].turnIds).toHaveLength(2)
  })
})
