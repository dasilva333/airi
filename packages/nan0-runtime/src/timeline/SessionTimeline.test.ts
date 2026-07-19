import type { Nan0KernelState, Nan0Observation, Nan0ReasoningClient } from '../types'

import { describe, expect, it } from 'vitest'

import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { createDefaultIdentityState } from '../identity/ActorIdentity'
import { Nan0Kernel } from '../kernel/Nan0Kernel'
import { InMemoryStateStore } from '../persistence/InMemoryStateStore'
import { createEmptyRelationshipState } from '../relationship/RelationshipMemory'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import { createEmptyTimelineState } from './SessionTimeline'

const reasoningClient: Nan0ReasoningClient = {
  async generate() {
    return { text: 'The event reaches me in sequence, and I notice it before deciding to answer.\n---EXTRACT---\n{"interpretation":"An event occurred.","privateText":"I noticed it.","decision":"SPEAK","speakability":0.8,"confidence":0.8,"mood":"attentive","reasonCodes":[]}' }
  },
}

function createClock(initial = 100) {
  return new ControllableNan0Clock({ wallTime: initial, monotonicTime: initial })
}

function createKernel(
  stateStore = new InMemoryStateStore(),
  clock = createClock(),
  prefix = 'id',
  client = reasoningClient,
) {
  let nextId = 0
  return {
    clock,
    kernel: new Nan0Kernel({
      stateStore,
      reasoningClient: client,
      clock,
      createId: () => `${prefix}-${++nextId}`,
    }),
  }
}

function observation(overrides: Partial<Nan0Observation> = {}): Nan0Observation {
  return {
    id: 'observation-1',
    source: 'chat',
    sessionId: 'session-1',
    actorId: 'kyo',
    displayName: 'Kyo',
    content: 'The rain started.',
    metadata: {},
    timestamp: 100,
    ...overrides,
  }
}

function legacyState(memories: Nan0KernelState['memories']): Nan0KernelState {
  return {
    schemaVersion: 1,
    revision: 0,
    bootCount: 0,
    createdAt: 1,
    updatedAt: 1,
    emotionalState: {},
    runtimeMetadata: {},
    identity: createDefaultIdentityState(),
    memories,
    thoughts: [],
    decisions: [],
    goals: [],
    pendingIntentions: { schemaVersion: 1, revision: 0, intentions: [] },
    computations: [],
    actionIntents: [],
    turns: [],
    timeline: createEmptyTimelineState(),
    temporal: createEmptyTemporalState(new ControllableNan0Clock({ wallTime: 1 }), 1),
    continuity: createEmptyContinuityState(),
    relationships: createEmptyRelationshipState(1),
  }
}

describe('conversationTurn and session timeline', () => {
  it('forms one completed turn with Kyo input, Nan0 output, and shared thought provenance', async () => {
    const { kernel, clock } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation())
    clock.set(160)
    await kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      content: 'I noticed.',
      timestamp: 160,
    })

    const state = kernel.getStateSnapshot()
    expect(state.memories).toHaveLength(2)
    expect(state.memories.map(memory => memory.actorId)).toEqual(['kyo', 'nan0'])
    expect(state.memories.map(memory => memory.metadata.thoughtId)).toEqual([prepared.thoughtId, prepared.thoughtId])
    expect(state.turns).toHaveLength(1)
    expect(state.turns[0]).toMatchObject({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      sessionId: 'session-1',
      inputActorId: 'kyo',
      outputActorId: 'nan0',
      status: 'completed',
      decision: 'SPEAK',
      elapsedMs: 60,
    })
    expect(state.turns[0].inputContentReference).toBe(state.memories[0].id)
    expect(state.turns[0].outputContentReference).toBe(state.memories[1].id)
  })

  it('does not duplicate the output, timeline event, or turn when completion repeats', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation())
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'First.' })
    await kernel.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Second.' })

    expect(kernel.getStateSnapshot().memories).toHaveLength(2)
    expect(kernel.getConversationTurns()).toHaveLength(1)
    expect(kernel.getTimelineEvents()).toHaveLength(2)
  })

  it('marks provider failure without creating Nan0 speech', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation())
    await kernel.failTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      error: 'provider unavailable',
      timestamp: 140,
    })

    expect(kernel.getStateSnapshot().memories).toHaveLength(1)
    expect(kernel.getConversationTurns()[0]).toMatchObject({
      status: 'failed',
      decision: 'UNKNOWN',
      outputActorId: null,
      outputContentReference: null,
    })
    expect(kernel.getTimelineEvents()[1]).toMatchObject({
      eventType: 'turn-failed',
      actorId: 'unknown',
      memoryReference: null,
    })
  })

  it('records deliberate silence without fabricating Nan0 speech content', async () => {
    const silenceClient: Nan0ReasoningClient = {
      async generate() {
        return { text: 'I feel the option to speak and decide I would rather keep this one inside.\n---EXTRACT---\n{"interpretation":"Quiet is deliberate.","privateText":"I would rather remain quiet.","decision":"SILENCE","speakability":0.1,"confidence":0.8,"mood":"quiet","reasonCodes":["decision.quiet"]}' }
      },
    }
    const { kernel } = createKernel(new InMemoryStateStore(), createClock(), 'id', silenceClient)
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation())
    await kernel.recordSilenceDecision({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      reason: 'NO_REPLY',
      timestamp: 130,
    })

    expect(kernel.getStateSnapshot().memories).toHaveLength(1)
    expect(kernel.getConversationTurns()[0]).toMatchObject({
      status: 'silent',
      decision: 'SILENCE',
      outputActorId: 'nan0',
      outputContentReference: null,
    })
    expect(kernel.getTimelineEvents()[1]).toMatchObject({ eventType: 'silence', actorId: 'nan0' })
  })

  it('records an empty provider expression as silence without rewriting its SPEAK decision', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation())
    await kernel.recordSilenceDecision({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      decisionId: prepared.decision.decisionId,
      reason: 'NO_REPLY',
      metadata: { expressionOutcome: 'provider-silence' },
    })

    expect(kernel.getDecisions()).toMatchObject([{
      decisionId: prepared.decision.decisionId,
      finalDecision: 'SPEAK',
    }])
    expect(kernel.getConversationTurns()).toMatchObject([{
      status: 'silent',
      decision: 'SILENCE',
      outputContentReference: null,
    }])
    expect(kernel.getStateSnapshot().memories.filter(memory => memory.actorId === 'nan0')).toHaveLength(0)
  })

  it('uses sequence order deterministically when timestamps collide', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation({ timestamp: 100 }))
    await kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      content: 'Same instant.',
      timestamp: 100,
    })

    expect(kernel.getTimelineEvents().map(event => [event.eventType, event.sequence])).toEqual([
      ['input', 1],
      ['output', 2],
    ])
  })

  it('continues event sequence and reloads a completed turn exactly once', async () => {
    const store = new InMemoryStateStore()
    const first = createKernel(store, createClock(), 'first').kernel
    await first.boot()
    const prepared = await first.prepareTurn(observation())
    await first.recordAssistantTurn({ turnId: prepared.turnId, thoughtId: prepared.thoughtId, content: 'Persisted.' })
    await first.shutdown()

    const second = createKernel(store, createClock(200), 'second').kernel
    await second.boot()
    expect(second.getConversationTurns()).toHaveLength(1)
    expect(second.getTimelineEvents()).toHaveLength(2)

    await second.prepareTurn(observation({ id: 'observation-2', content: 'Again.', timestamp: 200 }))
    expect(second.getTimelineEvents().map(event => event.sequence)).toEqual([1, 2, 3])
  })

  it('resumes a stable session and creates a distinct new session', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    await kernel.prepareTurn(observation({ id: 'one', sessionId: 'session-a' }))
    await kernel.prepareTurn(observation({ id: 'two', sessionId: 'session-a', timestamp: 110 }))
    await kernel.prepareTurn(observation({ id: 'three', sessionId: 'session-b', timestamp: 120 }))

    const state = kernel.getStateSnapshot()
    expect(Object.keys(state.timeline.sessions).sort()).toEqual(['session-a', 'session-b'])
    expect(kernel.getConversationTurns('session-a')).toHaveLength(2)
    expect(kernel.getConversationTurns('session-b')).toHaveLength(1)
  })

  it('preserves canonical owners in retrieval and calculates subjective elapsed time', async () => {
    const { kernel } = createKernel()
    await kernel.boot()
    const prepared = await kernel.prepareTurn(observation({ timestamp: 100 }))
    await kernel.recordAssistantTurn({
      turnId: prepared.turnId,
      thoughtId: prepared.thoughtId,
      content: 'Sixty milliseconds later.',
      timestamp: 160,
    })

    expect(kernel.getTimelineEvents().map(event => event.actorId)).toEqual(['kyo', 'nan0'])
    expect(kernel.elapsedBetweenTimelineEvents(prepared.inputEventId, kernel.getConversationTurns()[0].outputEventId!)).toBe(60)
    expect(kernel.getSubjectiveTime(200, 'session-1')).toEqual({
      at: 200,
      sessionId: 'session-1',
      sinceSessionStartMs: 100,
      sinceLastKyoInteractionMs: 100,
      sinceLastNan0ExpressionMs: 40,
    })
  })

  it('migrates a durable legacy pair into one turn without attribution reversal', async () => {
    const store = new InMemoryStateStore()
    await store.save(legacyState([
      {
        id: 'legacy-input',
        kind: 'event',
        actorId: 'kyo',
        content: 'Legacy input',
        tags: ['chat', 'user-input'],
        createdAt: 10,
        metadata: { thoughtId: 'legacy-thought' },
      },
      {
        id: 'legacy-output',
        kind: 'event',
        actorId: 'kyo',
        content: 'Legacy Nan0 output',
        tags: ['assistant-output', 'nan0-expression'],
        createdAt: 20,
        metadata: { thoughtId: 'legacy-thought' },
      },
    ]))

    const kernel = createKernel(store).kernel
    await kernel.boot()
    expect(kernel.getStateSnapshot().memories.map(memory => memory.actorId)).toEqual(['kyo', 'nan0'])
    expect(kernel.getConversationTurns()).toHaveLength(1)
    expect(kernel.getConversationTurns()[0]).toMatchObject({
      thoughtId: 'legacy-thought',
      inputActorId: 'kyo',
      outputActorId: 'nan0',
      status: 'completed',
    })
  })

  it('preserves an unmatched external legacy event without fabricating a turn or owner', async () => {
    const store = new InMemoryStateStore()
    await store.save(legacyState([{
      id: 'external-event',
      kind: 'event',
      actorId: 'visitor-42',
      content: 'External event',
      tags: ['discord'],
      createdAt: 10,
      metadata: {},
    }]))

    const kernel = createKernel(store).kernel
    await kernel.boot()
    expect(kernel.getConversationTurns()).toHaveLength(0)
    expect(kernel.getTimelineEvents()).toHaveLength(1)
    expect(kernel.getTimelineEvents()[0]).toMatchObject({
      actorId: 'visitor-42',
      eventType: 'legacy-memory',
      memoryReference: 'external-event',
    })
  })
})
