import type { Nan0DecisionRecord, Nan0KernelState, Nan0MemoryRecord } from '../types'

import { describe, expect, it } from 'vitest'

import { createEmptyAttentionState, createEmptyInternalObservationQueue } from '../attention/Nan0AttentionEngine'
import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { createEmptyEmotionalHistory } from '../emotional/Nan0EmotionalDynamics'
import { createEmptyHeartbeatRuntimeState } from '../heartbeat/Nan0HeartbeatEngine'
import { createDefaultIdentityState, nan0Ownership } from '../identity/ActorIdentity'
import { createEmptyPredictionState } from '../prediction/Nan0PredictionEngine'
import { createEmptyRelationshipState } from '../relationship/RelationshipMemory'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import { createEmptyTimelineState } from '../timeline/SessionTimeline'
import { LocalStorageStateStore } from './LocalStorageStateStore'

class TestStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function memory(
  id: string,
  actorId: 'kyo' | 'nan0',
  thoughtId: string,
): Nan0MemoryRecord {
  const ownership = actorId === 'kyo'
    ? {
        actorId: 'kyo',
        displayName: 'Kyo',
        kind: 'kyo',
        source: 'chat',
        rawActorId: 'kyo',
        actorRole: 'Kyo is the one who spoke or acted.',
        nan0Role: 'Nan0 is the observer/reactor, not the actor who did Kyo\'s action.',
        ownershipRule: 'Kyo\'s first-person statements belong to Kyo and must never become Nan0\'s actions or memories.',
      }
    : nan0Ownership()

  return {
    id,
    kind: 'event',
    actorId,
    content: `${actorId}-${id}`,
    tags: actorId === 'kyo' ? ['chat', 'user-input'] : ['assistant-output', 'nan0-expression'],
    createdAt: actorId === 'kyo' ? 10 : 20,
    metadata: {
      thoughtId,
      ownership,
    },
  }
}

function state(memories: Nan0MemoryRecord[], overrides: Partial<Nan0KernelState> = {}): Nan0KernelState {
  return {
    schemaVersion: 1,
    revision: 0,
    bootCount: 1,
    createdAt: 1,
    updatedAt: 1,
    emotionalState: {},
    runtimeMetadata: {},
    identity: createDefaultIdentityState(),
    memories,
    thoughts: overrides.thoughts ?? [],
    decisions: overrides.decisions ?? [],
    goals: overrides.goals ?? [],
    pendingIntentions: overrides.pendingIntentions ?? { schemaVersion: 1, revision: 0, intentions: [] },
    computations: overrides.computations ?? [],
    actionIntents: overrides.actionIntents ?? [],
    turns: [],
    timeline: createEmptyTimelineState(),
    temporal: overrides.temporal ?? createEmptyTemporalState(new ControllableNan0Clock({ wallTime: 1 }), 1),
    continuity: createEmptyContinuityState(),
    ...overrides,
    relationships: overrides.relationships ?? createEmptyRelationshipState(1),
  }
}

function decision(): Nan0DecisionRecord {
  return {
    schemaVersion: 1,
    decisionId: 'decision-1',
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    createdAt: 15,
    proposedDecision: 'SPEAK',
    finalDecision: 'SPEAK',
    allowed: true,
    confidence: 0.8,
    speakability: 0.9,
    attentionScore: 0.8,
    pressureScore: 0.7,
    reasonCodes: ['actor.kyo-attachment'],
    constraintResults: [],
    suppressionReason: null,
    actionIntent: null,
    waitUntil: null,
    metadata: { policy: 'nan0-decision-v1' },
  }
}

describe('localStorageStateStore multi-renderer safety', () => {
  it('prevents a stale writer from removing a newer assistant record', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const input = memory('input-1', 'kyo', 'thought-1')
    const output = memory('output-1', 'nan0', 'thought-1')

    const staleSnapshot = await currentWriter.save(state([input]))
    await currentWriter.save({ ...staleSnapshot, memories: [input, output] })
    await staleWriter.save(staleSnapshot)

    const persisted = await currentWriter.load()
    expect(persisted?.memories.map(item => item.id)).toEqual(['input-1', 'output-1'])
  })

  it('merge preserves Kyo input, Nan0 output, ownership, and shared thought provenance', async () => {
    const storage = new TestStorage()
    const store = new LocalStorageStateStore('nan0-test', { storage })
    const input = memory('input-1', 'kyo', 'thought-1')
    const output = memory('output-1', 'nan0', 'thought-1')

    await store.save(state([input]))
    const persisted = await store.save(state([output], { lastThoughtId: 'thought-1' }))

    expect(persisted.memories).toHaveLength(2)
    expect(persisted.memories.map(item => item.actorId)).toEqual(['kyo', 'nan0'])
    expect(persisted.memories.map(item => item.metadata.thoughtId)).toEqual(['thought-1', 'thought-1'])
    expect(persisted.memories[0].metadata.ownership).toMatchObject({ actorId: 'kyo' })
    expect(persisted.memories[1].metadata.ownership).toMatchObject({ actorId: 'nan0' })
  })

  it('reloads both records exactly once with a monotonic persisted revision', async () => {
    const storage = new TestStorage()
    const first = new LocalStorageStateStore('nan0-test', { storage })
    const input = memory('input-1', 'kyo', 'thought-1')
    const output = memory('output-1', 'nan0', 'thought-1')

    const firstSave = await first.save(state([input, output]))
    const second = new LocalStorageStateStore('nan0-test', { storage })
    const reloaded = await second.load()

    expect(reloaded?.revision).toBe(firstSave.revision)
    expect(reloaded?.memories.map(item => item.id)).toEqual(['input-1', 'output-1'])
    expect(new Set(reloaded?.memories.map(item => item.id)).size).toBe(2)
  })

  it('reloads a decision exactly once and prevents a stale writer from removing it', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleSnapshot = await currentWriter.save(state([]))

    await currentWriter.save(state([], { decisions: [decision()] }))
    await staleWriter.save(staleSnapshot)

    const reloaded = await currentWriter.load()
    expect(reloaded?.decisions).toHaveLength(1)
    expect(reloaded?.decisions[0]).toMatchObject({
      ...decision(),
      schemaVersion: 3,
      originalProposal: 'SPEAK',
      interpretationStatus: 'known',
      dynamicThreshold: 0.35,
      thresholdInputs: { baseline: 0.35 },
    })
  })

  it('prevents a stale renderer from removing a completed turn or its timeline output', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const input = memory('input-1', 'kyo', 'thought-1')
    const output = memory('output-1', 'nan0', 'thought-1')
    const timeline = createEmptyTimelineState()
    const inputEvent = {
      schemaVersion: 1 as const,
      eventId: 'event-input',
      eventType: 'input',
      actorId: 'kyo',
      source: 'chat' as const,
      sessionId: 'session-1',
      turnId: 'turn-1',
      thoughtId: 'thought-1',
      observedAt: 10,
      recordedAt: 10,
      sequence: 1,
      memoryReference: 'input-1',
      metadata: {},
    }
    const preparedTurn = {
      schemaVersion: 1 as const,
      turnId: 'turn-1',
      thoughtId: 'thought-1',
      sessionId: 'session-1',
      sequence: 1,
      source: 'chat' as const,
      startedAt: 10,
      completedAt: null,
      elapsedMs: null,
      inputEventId: 'event-input',
      outputEventId: null,
      inputActorId: 'kyo',
      outputActorId: null,
      inputContentReference: 'input-1',
      outputContentReference: null,
      decision: 'UNKNOWN' as const,
      status: 'prepared' as const,
      metadata: {},
    }
    const staleSnapshot = await currentWriter.save(state([input], {
      turns: [preparedTurn],
      timeline: { ...timeline, nextSequence: 2, nextTurnSequence: 2, events: [inputEvent] },
    }))
    await currentWriter.save(state([input, output], {
      turns: [{
        ...preparedTurn,
        completedAt: 20,
        elapsedMs: 10,
        outputEventId: 'event-output',
        outputActorId: 'nan0',
        outputContentReference: 'output-1',
        decision: 'SPEAK',
        status: 'completed',
      }],
      timeline: {
        ...timeline,
        nextSequence: 3,
        nextTurnSequence: 2,
        events: [inputEvent, {
          ...inputEvent,
          eventId: 'event-output',
          eventType: 'output',
          actorId: 'nan0',
          observedAt: 20,
          recordedAt: 20,
          sequence: 2,
          memoryReference: 'output-1',
        }],
      },
    }))
    await staleWriter.save(staleSnapshot)

    const persisted = await currentWriter.load()
    expect(persisted?.memories.map(item => item.id)).toEqual(['input-1', 'output-1'])
    expect(persisted?.turns).toHaveLength(1)
    expect(persisted?.turns[0]).toMatchObject({ status: 'completed', outputActorId: 'nan0' })
    expect(persisted?.timeline.events.map(event => event.eventId)).toEqual(['event-input', 'event-output'])
    expect(persisted?.turns[0].thoughtId).toBe('thought-1')
  })

  it('prevents a stale snapshot from removing newer continuity membership or unresolved state', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const baseThread = {
      schemaVersion: 1 as const,
      threadId: 'thread-1',
      status: 'active' as const,
      createdAt: 10,
      updatedAt: 10,
      lastActiveAt: 10,
      participantActorIds: ['kyo', 'nan0'],
      topicLabels: ['garden'],
      turnIds: ['turn-1'],
      timelineEventIds: ['event-1'],
      summary: 'Garden question.',
      unresolvedItems: [],
      importance: 0.5,
      activation: 1,
      metadata: {},
    }
    const staleSnapshot = await currentWriter.save(state([], {
      continuity: {
        schemaVersion: 1,
        activeThreadByActorId: { kyo: 'thread-1' },
        threads: [baseThread],
      },
    }))
    await currentWriter.save({
      ...staleSnapshot,
      continuity: {
        schemaVersion: 1,
        activeThreadByActorId: { kyo: 'thread-1' },
        threads: [{
          ...baseThread,
          updatedAt: 20,
          lastActiveAt: 20,
          turnIds: ['turn-1', 'turn-2'],
          timelineEventIds: ['event-1', 'event-2'],
          unresolvedItems: [{
            itemId: 'unresolved:turn-2',
            kind: 'question',
            text: 'Will it survive?',
            actorId: 'kyo',
            createdAt: 20,
            sourceTurnId: 'turn-2',
            resolvedAt: null,
            metadata: {},
          }],
        }],
      },
    })
    await staleWriter.save(staleSnapshot)

    const persisted = await currentWriter.load()
    expect(persisted?.continuity.threads).toHaveLength(1)
    expect(persisted?.continuity.threads[0].turnIds).toEqual(['turn-1', 'turn-2'])
    expect(persisted?.continuity.threads[0].timelineEventIds).toEqual(['event-1', 'event-2'])
    expect(persisted?.continuity.threads[0].unresolvedItems).toHaveLength(1)
  })

  it('migrates legacy state with empty lifecycle and temporal collections', async () => {
    const storage = new TestStorage()
    const legacy = state([]) as Partial<Nan0KernelState>
    delete legacy.computations
    delete legacy.actionIntents
    delete legacy.temporal
    delete legacy.pendingIntentions
    storage.setItem('nan0-test', JSON.stringify(legacy))

    const store = new LocalStorageStateStore('nan0-test', { storage })
    const reloaded = await store.load()
    expect(reloaded?.computations).toEqual([])
    expect(reloaded?.actionIntents).toEqual([])
    expect(reloaded?.schemaVersion).toBe(2)
    expect(reloaded?.cognitionPolicy).toMatchObject({
      policyId: 'nan0.cognition.constitutional-default',
      policyVersion: 5,
      authority: 'kernel-default',
    })
    expect(reloaded?.pendingIntentions).toEqual({ schemaVersion: 3, revision: 0, intentions: [] })
    expect(reloaded?.temporal).toMatchObject({ schemaVersion: 1, conditions: [], detectedClockAdjustments: [] })
    const resaved = await store.save(reloaded!)
    expect(resaved.schemaVersion).toBe(2)
    expect(JSON.parse(storage.getItem('nan0-test')!).schemaVersion).toBe(2)
  })

  it('prevents a stale emotional snapshot from deleting a newer dimension', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const stale = await currentWriter.save(state([], {
      emotionalState: { curiosity: 0.4 },
      emotionalStateRevision: 0,
    }))

    await currentWriter.save({
      ...stale,
      emotionalState: { ...stale.emotionalState, wonder: 0.85 },
      emotionalStateRevision: 1,
    })
    await staleWriter.save(stale)

    expect((await currentWriter.load())?.emotionalState).toEqual({ curiosity: 0.4, wonder: 0.85 })
    expect((await currentWriter.load())?.emotionalStateRevision).toBe(1)
  })

  it('persists policy identity and rejects stale policy identity rollback', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const stale = await currentWriter.save(state([]))
    const currentPolicy = {
      ...stale.cognitionPolicy!,
      policyVersion: 6,
      revision: 2,
      activatedAt: 20,
      metadata: { migrationTest: true },
    }

    await currentWriter.save({ ...stale, cognitionPolicy: currentPolicy })
    await staleWriter.save(stale)

    expect((await currentWriter.load())?.cognitionPolicy).toEqual(currentPolicy)
  })

  it('prevents a stale writer from deleting a newer durable action intent', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const stale = await currentWriter.save(state([]))
    const actionIntent = {
      schemaVersion: 1 as const,
      actionIntentId: 'action-1',
      decisionId: 'decision-1',
      thoughtId: 'thought-1',
      turnId: 'turn-1',
      capabilityId: 'art.generate',
      executionMode: 'durable-job' as const,
      requestedAt: 20,
      parameters: { promptReference: 'memory-1' },
      timeoutPolicy: { schemaVersion: 1 as const, policyId: 'art.job', kind: 'action-specific-timeout' as const, durationMs: 1_800_000, deadline: null, condition: null, metadata: {} },
      deadline: null,
      resumePolicy: 'if-supported' as const,
      interruptPolicy: 'pause-if-supported' as const,
      status: 'active' as const,
      metadata: { jobReference: 'job-1' },
    }
    await currentWriter.save(state([], { actionIntents: [actionIntent] }))
    await staleWriter.save(stale)

    expect((await currentWriter.load())?.actionIntents).toEqual([actionIntent])
  })

  it('prevents a stale writer from rolling temporal markers or eligibility backward', async () => {
    const storage = new TestStorage()
    const clock = new ControllableNan0Clock({ wallTime: 10_000, monotonicTime: 100 })
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage, clock })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage, clock })
    const stale = await currentWriter.save(state([], {
      temporal: {
        ...createEmptyTemporalState(clock),
        revision: 1,
        lastKyoInteractionAt: 1_000,
        conditions: [
          { schemaVersion: 1, conditionId: 'wake-1', ownerType: 'sleep', ownerId: 'sleep-1', dueAt: 5_000, status: 'pending', eligibleAt: null, lastEvaluatedAt: null, metadata: {} },
        ],
        nextEvaluationAt: 5_000,
      },
    }))
    await currentWriter.save(state([], {
      temporal: {
        ...stale.temporal,
        revision: 3,
        lastKyoInteractionAt: 9_000,
        conditions: stale.temporal.conditions.map(item => ({ ...item, status: 'eligible' as const, eligibleAt: 10_000, lastEvaluatedAt: 10_000 })),
        nextEvaluationAt: null,
      },
    }))
    await staleWriter.save(stale)

    expect((await currentWriter.load())?.temporal).toMatchObject({
      lastKyoInteractionAt: 9_000,
      nextEvaluationAt: null,
      conditions: [expect.objectContaining({ conditionId: 'wake-1', status: 'eligible', eligibleAt: 10_000 })],
    })
  })

  it('persists handled temporal events monotonically across stale writers and restart', async () => {
    const storage = new TestStorage()
    const clock = new ControllableNan0Clock({ wallTime: 10_000 })
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage, clock })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage, clock })
    const stale = await currentWriter.save(state([]))
    const temporalEvent = {
      schemaVersion: 1 as const,
      temporalEventId: 'temporal-1',
      createdAt: 10_000,
      eventType: 'absence-threshold' as const,
      source: 'temporal-engine' as const,
      severity: 'notable' as const,
      subjectActorId: 'kyo',
      relatedEventIds: [],
      relatedTurnIds: ['turn-1'],
      relatedThoughtIds: ['thought-1'],
      relatedGoalIds: [],
      relatedIntentionIds: [],
      relatedRelationshipIds: ['relationship-kyo'],
      conditionId: null,
      observedDurationMs: 10_000,
      thresholdMs: 5_000,
      phase: 'morning' as const,
      confidence: 1,
      significance: 0.8,
      status: 'handled' as const,
      reasonCodes: ['temporal.absence-threshold'],
      evidenceKey: 'absence:interval-1:notable',
      evaluationCount: 1,
      handledAt: 10_100,
      observationId: 'observation-1',
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
      metadata: { resolution: 'SILENCE' },
    }
    await currentWriter.save(state([], {
      temporal: {
        ...stale.temporal,
        revision: stale.temporal.revision + 1,
        engine: {
          ...stale.temporal.engine,
          revision: stale.temporal.engine.revision + 1,
          events: [temporalEvent],
        },
      },
    }))
    await staleWriter.save(stale)

    const restarted = await new LocalStorageStateStore('nan0-test', { storage, clock }).load()
    expect(restarted?.temporal.engine.events).toEqual([temporalEvent])
    expect(restarted?.temporal.engine.events[0]).toMatchObject({
      status: 'handled',
      evaluationCount: 1,
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
    })
  })

  it('reloads JSON-safe metabolism state and prevents stale writers from reopening handled observations', async () => {
    const storage = new TestStorage()
    const currentWriter = new LocalStorageStateStore('nan0-test', { storage })
    const staleWriter = new LocalStorageStateStore('nan0-test', { storage })
    const stale = await currentWriter.save(state([]))
    const attention = createEmptyAttentionState(1)
    attention.revision = 2
    attention.history.push({ observationId: 'internal-1', streamId: 'attention:internal:temporal', focusedAt: 2, completedAt: 3, durationMs: 1, priority: 0.8, outcome: 'SILENCE' })
    const queue = createEmptyInternalObservationQueue()
    queue.revision = 2
    queue.records.push({
      schemaVersion: 1,
      observation: { id: 'internal-1', source: 'internal:temporal', actorId: 'nan0', content: 'threshold crossed', metadata: {}, timestamp: 2 },
      priority: 0.8,
      dedupeKey: 'temporal:once',
      streamType: 'internal:temporal',
      status: 'handled',
      enqueuedAt: 2,
      focusedAt: 2,
      handledAt: 3,
      thoughtId: 'thought-1',
      decisionId: 'decision-1',
      outcome: 'SILENCE',
      metadata: {},
    })
    const emotionalHistory = createEmptyEmotionalHistory(1)
    emotionalHistory.revision = 1
    const prediction = createEmptyPredictionState()
    prediction.revision = 1
    const heartbeat = createEmptyHeartbeatRuntimeState()
    heartbeat.revision = 1
    heartbeat.tickCount = 2

    await currentWriter.save(state([], { attention, internalObservations: queue, emotionalHistory, prediction, heartbeat }))
    await staleWriter.save(stale)

    const restarted = await new LocalStorageStateStore('nan0-test', { storage }).load()
    expect(restarted?.internalObservations?.records[0]).toMatchObject({ status: 'handled', thoughtId: 'thought-1', decisionId: 'decision-1' })
    expect(restarted?.attention?.history).toHaveLength(1)
    expect(restarted?.heartbeat?.tickCount).toBe(2)
    expect(() => JSON.parse(JSON.stringify(restarted))).not.toThrow()
  })
})
