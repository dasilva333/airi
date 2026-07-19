import type {
  Nan0ConversationThread,
  Nan0Goal,
  Nan0PendingIntention,
  Nan0RelationshipRecord,
  Nan0TemporalEngineConfiguration,
  Nan0TemporalEvent,
  Nan0TemporalState,
} from '../types'

import { describe, expect, it } from 'vitest'

import { ControllableNan0Clock } from './Nan0Clock'
import { createEmptyTemporalState, observeTemporalClock } from './Nan0Temporal'
import {
  beginTemporalEventEvaluation,
  createEmptyTemporalEngineState,
  evaluateTemporalEvidence,
  localPhaseAt,
  mergeTemporalEngineStates,
  resetTemporalAbsenceInterval,
  settleTemporalEventEvaluation,
} from './Nan0TemporalEngine'

const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

function context(overrides: {
  goals?: Nan0Goal[]
  intentions?: Nan0PendingIntention[]
  continuityThreads?: Nan0ConversationThread[]
  relationships?: Nan0RelationshipRecord[]
} = {}) {
  return {
    goals: overrides.goals ?? [],
    intentions: overrides.intentions ?? [],
    continuityThreads: overrides.continuityThreads ?? [],
    relationships: overrides.relationships ?? [],
  }
}

function evaluator() {
  let id = 0
  return (temporal: Nan0TemporalState, clock: ControllableNan0Clock, input: {
    configuration?: Nan0TemporalEngineConfiguration
    context?: ReturnType<typeof context>
    reason?: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual'
  } = {}) => evaluateTemporalEvidence({
    temporal,
    clock,
    context: input.context ?? context(),
    reason: input.reason ?? 'interval',
    createId: () => `id-${++id}`,
    configuration: input.configuration,
  })
}

function intention(overrides: Partial<Nan0PendingIntention> = {}): Nan0PendingIntention {
  return {
    schemaVersion: 1,
    intentionId: 'intention-1',
    createdAt: 0,
    updatedAt: 0,
    ownerActorId: 'nan0',
    origin: 'self-generated',
    originActorId: 'nan0',
    status: 'pending',
    kind: 'reconsider',
    title: 'Reconsider later',
    description: 'A future cognitive commitment.',
    motivation: 'Evidence.',
    priority: 0.8,
    confidence: 1,
    goalId: null,
    thoughtId: null,
    decisionId: null,
    turnId: null,
    continuityThreadIds: [],
    relationshipIds: [],
    trigger: { schemaVersion: 1, triggerId: 'trigger-1', type: 'at-time', at: minute, metadata: {} },
    earliestAt: 0,
    dueAt: minute,
    expiresAt: null,
    lastEvaluatedAt: null,
    evaluationCount: 0,
    attemptCount: 0,
    cooldownUntil: null,
    blockedReason: null,
    resolution: null,
    lastEvaluationId: null,
    lastWakeObservationId: null,
    lastTriggerEvidenceKey: null,
    metadata: {},
    ...overrides,
  }
}

function goal(overrides: Partial<Nan0Goal> = {}): Nan0Goal {
  return {
    schemaVersion: 1,
    goalId: 'goal-1',
    createdAt: 0,
    updatedAt: 0,
    origin: 'self-generated',
    originActorId: 'nan0',
    status: 'active',
    title: 'Understand a thing',
    description: 'Description',
    motivation: 'Motivation',
    priority: 0.8,
    importance: 0.9,
    confidence: 1,
    urgency: 0.5,
    activation: 1,
    progress: 0.2,
    parentGoalId: null,
    conflictingGoalIds: [],
    supportingThoughtIds: [],
    supportingDecisionIds: [],
    supportingTurnIds: [],
    continuityThreadIds: [],
    relationshipIds: [],
    constitutionalReferences: [],
    completionCriteria: [],
    blockedReason: null,
    deferredUntil: null,
    metadata: {},
    ...overrides,
  }
}

function thread(overrides: Partial<Nan0ConversationThread> = {}): Nan0ConversationThread {
  return {
    schemaVersion: 1,
    threadId: 'thread-1',
    status: 'dormant',
    createdAt: 0,
    updatedAt: 0,
    lastActiveAt: 0,
    participantActorIds: ['kyo', 'nan0'],
    topicLabels: ['unfinished'],
    turnIds: ['turn-1'],
    timelineEventIds: ['event-1'],
    summary: 'An unfinished factual thread.',
    unresolvedItems: [{
      itemId: 'item-1',
      kind: 'question',
      text: 'Unfinished?',
      actorId: 'kyo',
      createdAt: 0,
      sourceTurnId: 'turn-1',
      resolvedAt: null,
      metadata: {},
    }],
    importance: 0.9,
    activation: 0.5,
    metadata: {},
    ...overrides,
  }
}

function relationship(overrides: Partial<Nan0RelationshipRecord> = {}): Nan0RelationshipRecord {
  return {
    schemaVersion: 1,
    actorId: 'kyo',
    relationshipId: 'relationship-kyo',
    source: 'chat',
    createdAt: 0,
    updatedAt: 0,
    firstInteractionAt: 0,
    lastInteractionAt: 0,
    interactionCount: 1,
    status: 'established',
    emotionalBalance: 0,
    familiarity: 0.8,
    trust: 0.8,
    attachment: 0.8,
    irritation: 0,
    suspicion: 0,
    respect: 0.8,
    importance: 0.9,
    significantEventIds: [],
    turnIds: [],
    moments: [],
    activeGrievances: [],
    positiveAnchors: [],
    expectations: [],
    metadata: {},
    ...overrides,
  }
}

function event(overrides: Partial<Nan0TemporalEvent> = {}): Nan0TemporalEvent {
  return {
    schemaVersion: 1,
    temporalEventId: 'temporal-1',
    createdAt: 1,
    eventType: 'phase-changed',
    source: 'temporal-engine',
    severity: 'informational',
    subjectActorId: 'nan0',
    relatedEventIds: [],
    relatedTurnIds: [],
    relatedThoughtIds: [],
    relatedGoalIds: [],
    relatedIntentionIds: [],
    relatedRelationshipIds: [],
    conditionId: null,
    observedDurationMs: null,
    thresholdMs: null,
    phase: 'morning',
    confidence: 1,
    significance: 0.4,
    status: 'recorded',
    reasonCodes: ['phase'],
    evidenceKey: 'phase:one',
    evaluationCount: 0,
    handledAt: null,
    observationId: null,
    thoughtId: null,
    decisionId: null,
    metadata: {},
    ...overrides,
  }
}

describe('nan0TemporalEngine pure evidence and eligibility', () => {
  it('classifies configurable local phases without changing the clock', () => {
    const clock = new ControllableNan0Clock({ wallTime: 6 * hour, timezone: 'UTC' })
    expect(localPhaseAt(clock, clock.utcNow(), [
      { phase: 'late-night', startHour: 0 },
      { phase: 'morning', startHour: 5 },
      { phase: 'night', startHour: 21 },
    ])).toBe('morning')
    expect(clock.utcNow()).toBe(6 * hour)
  })

  it('establishes a migration phase baseline without a phase event', () => {
    const clock = new ControllableNan0Clock({ wallTime: 6 * hour })
    const result = evaluator()(createEmptyTemporalState(clock), clock)
    expect(result.temporal.engine.localPhase).toBe('morning')
    expect(result.created).toEqual([])
  })

  it('creates one factual phase event after a real transition', () => {
    const clock = new ControllableNan0Clock({ wallTime: 4 * hour + 59 * minute })
    const evaluate = evaluator()
    const baseline = evaluate(createEmptyTemporalState(clock), clock).temporal
    clock.advance({ wallMs: 2 * minute })
    const changed = evaluate(baseline, clock)
    expect(changed.created.map(item => item.eventType)).toEqual(['phase-changed'])
    expect(changed.created[0]).toMatchObject({ phase: 'morning', status: 'recorded' })
  })

  it('does not duplicate an unchanged phase or transition evidence', () => {
    const clock = new ControllableNan0Clock({ wallTime: 4 * hour + 59 * minute })
    const evaluate = evaluator()
    let temporal = evaluate(createEmptyTemporalState(clock), clock).temporal
    clock.advance({ wallMs: 2 * minute })
    temporal = evaluate(temporal, clock).temporal
    expect(evaluate(temporal, clock).created).toEqual([])
  })

  it('crosses an absence threshold once per interval', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0 })
    const evaluate = evaluator()
    let temporal = createEmptyTemporalState(clock)
    temporal.lastKyoInteractionAt = 0
    temporal = evaluate(temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'significant', minimumSignificance: 0 }] } }).temporal
    clock.advance({ wallMs: minute })
    const crossed = evaluate(temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'significant', minimumSignificance: 0 }] }, context: context({ relationships: [relationship()] }) })
    expect(crossed.created).toHaveLength(1)
    expect(crossed.created[0]).toMatchObject({ eventType: 'absence-threshold', subjectActorId: 'kyo' })
    expect(evaluate(crossed.temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'significant', minimumSignificance: 0 }] } }).created).toEqual([])
  })

  it('resets absence evidence after a new Kyo interaction', () => {
    const engine = resetTemporalAbsenceInterval({ ...createEmptyTemporalEngineState(), absence: { intervalId: 'old', startedAt: 0, crossedThresholdIds: ['short'] } }, { at: minute, intervalId: 'new' })
    expect(engine.absence).toEqual({ intervalId: 'new', startedAt: minute, crossedThresholdIds: [] })
  })

  it('allows a second absence interval to cross the same threshold', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * minute })
    const evaluate = evaluator()
    const temporal = createEmptyTemporalState(clock)
    temporal.engine = { ...createEmptyTemporalEngineState(), initializedAt: 0, localPhase: 'late-night', absence: { intervalId: 'second', startedAt: minute, crossedThresholdIds: [] } }
    temporal.lastKyoInteractionAt = minute
    const result = evaluate(temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'significant', minimumSignificance: 0 }] } })
    expect(result.created[0].evidenceKey).toBe('absence:second:short')
  })

  it('reconstructs one meaningful shutdown gap with stable evidence', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10 * minute })
    const evaluate = evaluator()
    const temporal = createEmptyTemporalState(clock)
    temporal.lastShutdownAt = minute
    temporal.lastResumeAt = 10 * minute
    const once = evaluate(temporal, clock, { reason: 'session-resume', configuration: { meaningfulShutdownGapMs: minute } })
    expect(once.created.some(item => item.eventType === 'shutdown-gap')).toBe(true)
    expect(evaluate(once.temporal, clock, { reason: 'session-resume', configuration: { meaningfulShutdownGapMs: minute } }).created).toEqual([])
  })

  it('links an overdue intention without mutating its lifecycle', () => {
    const clock = new ControllableNan0Clock({ wallTime: 3 * minute })
    const source = intention()
    const snapshot = structuredClone(source)
    const result = evaluator()(createEmptyTemporalState(clock), clock, { configuration: { intentionOverdueMs: minute }, context: context({ intentions: [source] }) })
    const overdue = result.created.find(item => item.eventType === 'intention-overdue')
    expect(overdue).toMatchObject({ relatedIntentionIds: ['intention-1'], status: 'recorded' })
    expect(source).toEqual(snapshot)
  })

  it('detects a stalled goal without changing its status or progress', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * day })
    const source = goal()
    const result = evaluator()(createEmptyTemporalState(clock), clock, { configuration: { goalStalledMs: day, minimumObservationSignificance: 0 }, context: context({ goals: [source] }) })
    expect(result.created.find(item => item.eventType === 'goal-stalled')?.relatedGoalIds).toEqual(['goal-1'])
    expect(source).toMatchObject({ status: 'active', progress: 0.2 })
  })

  it('detects lingering continuity without changing thread membership', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * day })
    const source = thread()
    const result = evaluator()(createEmptyTemporalState(clock), clock, { configuration: { continuityLingeringMs: day, minimumObservationSignificance: 0 }, context: context({ continuityThreads: [source] }) })
    expect(result.created.find(item => item.eventType === 'continuity-lingering')).toMatchObject({ relatedTurnIds: ['turn-1'] })
    expect(source.turnIds).toEqual(['turn-1'])
  })

  it('uses relationship importance only as factual significance input', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * minute })
    const source = relationship({ importance: 1 })
    const temporal = createEmptyTemporalState(clock)
    temporal.engine = { ...createEmptyTemporalEngineState(), initializedAt: 0, localPhase: 'late-night', absence: { intervalId: 'absence', startedAt: 0, crossedThresholdIds: [] } }
    temporal.lastKyoInteractionAt = 0
    const result = evaluator()(temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'notable', minimumSignificance: 0 }] }, context: context({ relationships: [source] }) })
    expect(result.created[0].significance).toBeGreaterThan(0)
    expect(source.importance).toBe(1)
  })

  it('records a low-confidence backward jump and blocks time eligibility', () => {
    const clock = new ControllableNan0Clock({ wallTime: 10 * minute, monotonicTime: 100, confidence: 0.4 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'p', createAdjustmentId: () => 'boot' })
    clock.advance({ wallMs: -2 * minute, monotonicMs: minute })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'p', createAdjustmentId: () => 'backward' })
    const result = evaluator()(temporal, clock)
    expect(result.clockTrusted).toBe(false)
    expect(result.created.find(item => item.eventType === 'clock-adjusted')?.metadata.adjustmentId).toBe('backward')
  })

  it('records a low-confidence forward jump and blocks overdue intention evidence', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0, monotonicTime: 0, confidence: 0.4 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'p', createAdjustmentId: () => 'boot' })
    clock.advance({ wallMs: 10 * minute, monotonicMs: minute })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'p', createAdjustmentId: () => 'forward' })
    const result = evaluator()(temporal, clock, { configuration: { intentionOverdueMs: 0 }, context: context({ intentions: [intention()] }) })
    expect(result.clockTrusted).toBe(false)
    expect(result.created.some(item => item.eventType === 'intention-overdue')).toBe(false)
  })

  it('keeps a low-confidence clock anomaly blocked across later evaluations', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0, monotonicTime: 0, confidence: 0.4 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'p', createAdjustmentId: () => 'boot' })
    clock.advance({ wallMs: 10 * minute, monotonicMs: minute })
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'p', createAdjustmentId: () => 'forward' })
    const first = evaluator()(temporal, clock, { configuration: { intentionOverdueMs: 0 }, context: context({ intentions: [intention()] }) })
    clock.advance({ wallMs: minute, monotonicMs: minute })
    const second = evaluator()(first.temporal, clock, { configuration: { intentionOverdueMs: 0 }, context: context({ intentions: [intention()] }) })

    expect(first.clockTrusted).toBe(false)
    expect(second.clockTrusted).toBe(false)
    expect(second.blockingAdjustmentId).toBe('forward')
    expect(second.created.some(item => item.eventType === 'intention-overdue')).toBe(false)
  })

  it('records timezone and daylight-offset changes without duration reinterpretation', () => {
    const clock = new ControllableNan0Clock({ wallTime: hour, timezone: 'Zone/A', timezoneOffsetMinutes: -360 })
    let temporal = observeTemporalClock(createEmptyTemporalState(clock), { clock, kind: 'boot', processId: 'p', createAdjustmentId: () => 'boot' })
    clock.setTimezone('Zone/B', -300)
    let adjustmentId = 0
    temporal = observeTemporalClock(temporal, { clock, kind: 'observe', processId: 'p', createAdjustmentId: () => `adjust-${++adjustmentId}` })
    const result = evaluator()(temporal, clock)
    expect(result.created.filter(item => item.eventType === 'clock-adjusted')).toHaveLength(2)
    expect(clock.elapsedWall(0)).toBe(hour)
  })

  it('bounds multiple eligible temporal events to two observations', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * day })
    const result = evaluator()(createEmptyTemporalState(clock), clock, {
      configuration: { goalStalledMs: day, continuityLingeringMs: day, minimumObservationSignificance: 0, maxObservationsPerEvaluation: 2 },
      context: context({ goals: [goal(), goal({ goalId: 'goal-2' })], continuityThreads: [thread()] }),
    })
    expect(result.created.length).toBeGreaterThan(2)
    expect(result.eligible).toHaveLength(2)
  })

  it('persists factual duration and threshold without emotional interpretation', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * minute })
    const temporal = createEmptyTemporalState(clock)
    temporal.engine = { ...createEmptyTemporalEngineState(), initializedAt: 0, localPhase: 'late-night', absence: { intervalId: 'absence', startedAt: 0, crossedThresholdIds: [] } }
    temporal.lastKyoInteractionAt = 0
    const result = evaluator()(temporal, clock, { configuration: { absenceThresholds: [{ thresholdId: 'short', durationMs: minute, severity: 'significant', minimumSignificance: 0 }] } })
    expect(result.created[0]).toMatchObject({ observedDurationMs: 2 * minute, thresholdMs: minute })
    expect(JSON.stringify(result.created[0])).not.toMatch(/abandon|lonely|unbearable/i)
  })

  it('begins and settles one event without reopening it', () => {
    const base = { ...createEmptyTemporalEngineState(), events: [event({ status: 'eligible' })] }
    const begun = beginTemporalEventEvaluation(base, { temporalEventId: 'temporal-1', observationId: 'observation-1', at: 2 })
    const handled = settleTemporalEventEvaluation(begun, { temporalEventId: 'temporal-1', at: 3, thoughtId: 'thought-1', decisionId: 'decision-1', resolution: 'SILENCE' })
    expect(handled.events[0]).toMatchObject({ status: 'handled', evaluationCount: 1, observationId: 'observation-1', thoughtId: 'thought-1' })
    expect(beginTemporalEventEvaluation(handled, { temporalEventId: 'temporal-1', observationId: 'observation-2', at: 4 }).events[0].evaluationCount).toBe(1)
  })

  it('prevents a stale writer from deleting or reopening handled events', () => {
    const handled = { ...createEmptyTemporalEngineState(), revision: 5, events: [event({ status: 'handled', evaluationCount: 1, handledAt: 5 })] }
    const stale = { ...createEmptyTemporalEngineState(), revision: 4, events: [event({ status: 'eligible' })] }
    expect(mergeTemporalEngineStates(handled, stale).events[0]).toMatchObject({ status: 'handled', evaluationCount: 1 })
    expect(mergeTemporalEngineStates(handled, createEmptyTemporalEngineState()).events).toHaveLength(1)
  })

  it('union-preserves event references during merge', () => {
    const left = { ...createEmptyTemporalEngineState(), revision: 1, events: [event({ relatedGoalIds: ['goal-1'] })] }
    const right = { ...createEmptyTemporalEngineState(), revision: 2, events: [event({ relatedGoalIds: ['goal-2'] })] }
    expect(mergeTemporalEngineStates(left, right).events[0].relatedGoalIds).toEqual(['goal-1', 'goal-2'])
  })

  it('retains sleeping compatibility state while evaluating evidence', () => {
    const clock = new ControllableNan0Clock({ wallTime: 2 * minute })
    const temporal = createEmptyTemporalState(clock)
    temporal.engine = {
      ...createEmptyTemporalEngineState(),
      initializedAt: 0,
      localPhase: 'late-night',
      sleep: { status: 'sleeping', sleepId: 'sleep-1', startedAt: 0, expectedWakeAt: minute, maximumWakeAt: hour, wakeConditionId: 'wake-1', metadata: {} },
    }
    const result = evaluator()(temporal, clock)
    expect(result.temporal.engine.sleep).toMatchObject({ status: 'sleeping', sleepId: 'sleep-1' })
    expect(result.created.find(item => item.eventType === 'sleep-window-ended')).toMatchObject({ status: 'recorded', conditionId: 'wake-1' })
  })

  it('calculates a future next evaluation without performing cognition', () => {
    const clock = new ControllableNan0Clock({ wallTime: 0 })
    const result = evaluator()(createEmptyTemporalState(clock), clock)
    expect(result.nextEvaluationAt).toBeGreaterThan(clock.utcNow())
    expect(result.eligible).toEqual([])
  })
})
