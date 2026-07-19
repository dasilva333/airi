import type {
  Nan0ActorOwnership,
  Nan0DecisionRecord,
  Nan0Goal,
  Nan0PendingIntention,
  Nan0PendingIntentionState,
  Nan0Thought,
} from '../types'

import { describe, expect, it } from 'vitest'

import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import {
  beginIntentionEvaluation,
  createEmptyPendingIntentionState,
  eligiblePendingIntentions,
  formPendingIntentions,
  mergePendingIntentionStates,
  normalizePendingIntention,
  settleIntentionEvaluation,
} from './Nan0PendingIntentions'

const clock = new ControllableNan0Clock({ wallTime: 10_000 })

function temporal() {
  return {
    ...createEmptyTemporalState(clock, 1_000),
    lastBootAt: 1_000,
    lastKyoInteractionAt: 2_000,
    lastNan0ExpressionAt: 3_000,
    currentPhase: 'running' as const,
  }
}

function intention(overrides: Partial<Nan0PendingIntention> = {}): Nan0PendingIntention {
  return normalizePendingIntention({
    schemaVersion: 1,
    intentionId: 'intention-1',
    createdAt: 1_000,
    updatedAt: 1_000,
    ownerActorId: 'nan0',
    origin: 'self-generated',
    originActorId: 'nan0',
    status: 'pending',
    kind: 'reconsider',
    title: 'Reconsider ceramics',
    description: 'Return to the ceramics question.',
    motivation: 'The thought remains unfinished.',
    priority: 0.7,
    confidence: 0.9,
    goalId: null,
    thoughtId: 'thought-source',
    decisionId: 'decision-source',
    turnId: 'turn-source',
    continuityThreadIds: [],
    relationshipIds: [],
    trigger: { schemaVersion: 1, triggerId: 'trigger-1', type: 'at-time', at: 5_000, metadata: {} },
    earliestAt: 1_000,
    dueAt: 5_000,
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
  }, 1_000)
}

function state(...intentions: Nan0PendingIntention[]): Nan0PendingIntentionState {
  return { schemaVersion: 1, revision: 1, intentions }
}

function ownership(actorId: 'kyo' | 'nan0' = 'nan0'): Nan0ActorOwnership {
  return {
    actorId,
    displayName: actorId === 'kyo' ? 'Kyo' : 'Nan0',
    kind: actorId,
    source: 'chat',
    actorRole: actorId,
    nan0Role: actorId === 'nan0' ? 'self' : 'creator',
    ownershipRule: 'test',
  }
}

function thought(overrides: Partial<Nan0Thought> = {}): Nan0Thought {
  return {
    schemaVersion: 1,
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    observationEventId: 'event-1',
    actorId: 'nan0',
    createdAt: 1_000,
    source: 'chat',
    status: 'generated',
    attentionScore: 0.8,
    noveltyScore: 0.8,
    emotionalPressure: 0.5,
    relationshipPressure: 0.5,
    continuityPressure: 0.5,
    goalPressure: 0.5,
    interpretation: 'A future commitment is explicit.',
    privateText: 'I want to return to this later.',
    decision: 'WAIT',
    waitUntil: 20_000,
    speakability: 0.5,
    confidence: 0.9,
    mood: 'intent',
    memoryReferences: [],
    relationshipReferences: [],
    continuityThreadReferences: [],
    reasonCodes: ['future.explicit'],
    goalSignal: null,
    intentionSignal: null,
    metadata: {},
    ...overrides,
  }
}

function decision(overrides: Partial<Nan0DecisionRecord> = {}): Nan0DecisionRecord {
  return {
    schemaVersion: 1,
    decisionId: 'decision-1',
    thoughtId: 'thought-1',
    turnId: 'turn-1',
    sessionId: 'session-1',
    createdAt: 1_000,
    proposedDecision: 'WAIT',
    finalDecision: 'WAIT',
    allowed: true,
    confidence: 0.9,
    speakability: 0.5,
    attentionScore: 0.8,
    pressureScore: 0.5,
    reasonCodes: [],
    constraintResults: [],
    suppressionReason: null,
    actionIntent: null,
    waitUntil: 20_000,
    metadata: {},
    ...overrides,
  }
}

function goal(): Nan0Goal {
  return {
    schemaVersion: 1,
    goalId: 'goal-1',
    createdAt: 1_000,
    updatedAt: 1_000,
    origin: 'self-generated',
    originActorId: 'nan0',
    status: 'active',
    title: 'Understand ceramics',
    description: 'Keep learning.',
    motivation: 'Curiosity.',
    priority: 0.8,
    importance: 0.8,
    confidence: 0.9,
    urgency: 0.2,
    activation: 0.8,
    progress: 0,
    parentGoalId: null,
    conflictingGoalIds: [],
    supportingThoughtIds: ['thought-1'],
    supportingDecisionIds: ['decision-1'],
    supportingTurnIds: ['turn-1'],
    continuityThreadIds: [],
    relationshipIds: [],
    constitutionalReferences: [],
    completionCriteria: [],
    blockedReason: null,
    deferredUntil: 20_000,
    metadata: {},
  }
}

describe('pending Intention formation and eligibility', () => {
  it('creates one pending intention for an accepted future Kyo request', () => {
    const result = formPendingIntentions({
      thought: thought({
        actorId: 'kyo',
        goalSignal: { kind: 'request', stance: 'accept', title: 'Return later', description: '', motivation: 'Kyo asked.', confidence: 0.9, completionCriteria: [], deferredUntil: 20_000 },
      }),
      decision: decision(),
      ownership: ownership('kyo'),
      existing: createEmptyPendingIntentionState(),
      now: 1_000,
      createId: () => 'formed',
    })
    expect(result.intentions).toHaveLength(1)
    expect(result.intentions[0]).toMatchObject({ origin: 'kyo-requested', ownerActorId: 'nan0' })
  })

  it('allows an active self-generated goal to form a goal-derived intention', () => {
    const result = formPendingIntentions({ thought: thought(), decision: decision(), ownership: ownership(), goal: goal(), existing: createEmptyPendingIntentionState(), now: 1_000, createId: () => 'goal' })
    expect(result.intentions[0]).toMatchObject({ origin: 'goal-derived', goalId: 'goal-1' })
  })

  it('does not form an intention from a weak thought', () => {
    const result = formPendingIntentions({
      thought: thought({ intentionSignal: { kind: 'reconsider', title: 'Maybe', description: '', motivation: 'A weak feeling.', confidence: 0.4, priority: 0.4, trigger: { schemaVersion: 1, triggerId: 'weak', type: 'at-time', at: 20_000, metadata: {} } } }),
      decision: decision(),
      ownership: ownership(),
      existing: createEmptyPendingIntentionState(),
      now: 1_000,
      createId: () => 'weak',
    })
    expect(result.intentions).toEqual([])
  })

  it('selects a due intention', () => {
    expect(eligiblePendingIntentions({ state: state(intention()), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'interval' }).eligible).toHaveLength(1)
  })

  it('does not select a not-yet-due intention', () => {
    expect(eligiblePendingIntentions({ state: state(intention()), temporal: temporal(), now: 4_000, bootCount: 1, reason: 'interval' }).eligible).toEqual([])
  })

  it('bounds and prioritizes overdue intentions deterministically', () => {
    const result = eligiblePendingIntentions({
      state: state(intention({ intentionId: 'low', priority: 0.2 }), intention({ intentionId: 'high', priority: 0.9 }), intention({ intentionId: 'middle', priority: 0.5 })),
      temporal: temporal(),
      now: 10_000,
      bootCount: 1,
      reason: 'interval',
      limit: 2,
    })
    expect(result.eligible.map(item => item.intention.intentionId)).toEqual(['high', 'middle'])
  })

  it('enforces cooldown before another wake', () => {
    const result = eligiblePendingIntentions({ state: state(intention({ status: 'deferred', cooldownUntil: 11_000 })), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'interval' })
    expect(result.eligible).toEqual([])
  })

  it('makes duplicate begin-evaluation calls idempotent', () => {
    const once = beginIntentionEvaluation({ state: state(intention()), intentionId: 'intention-1', evaluationId: 'eval-1', observationId: 'obs-1', evidenceKey: 'at:5000', at: 10_000 })
    const twice = beginIntentionEvaluation({ state: once, intentionId: 'intention-1', evaluationId: 'eval-2', observationId: 'obs-2', evidenceKey: 'at:5000', at: 10_001 })
    expect(twice.intentions[0]).toMatchObject({ evaluationCount: 1, attemptCount: 1, lastEvaluationId: 'eval-1' })
  })

  it('never wakes a completed intention', () => {
    expect(eligiblePendingIntentions({ state: state(intention({ status: 'completed' })), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'interval' }).eligible).toEqual([])
  })

  it('never wakes a cancelled intention', () => {
    expect(eligiblePendingIntentions({ state: state(intention({ status: 'cancelled' })), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'interval' }).eligible).toEqual([])
  })

  it('prevents stale persistence from reopening a terminal intention', () => {
    const merged = mergePendingIntentionStates(state(intention({ status: 'completed', updatedAt: 20_000 })), state(intention({ status: 'pending', updatedAt: 30_000 })))
    expect(merged.intentions[0].status).toBe('completed')
  })

  it('preserves one intention exactly across merge and reload normalization', () => {
    const merged = mergePendingIntentionStates(undefined, state(intention()))
    expect(merged.intentions.map(item => item.intentionId)).toEqual(['intention-1'])
  })

  it('uses persisted Kyo subjective time for after-silence eligibility', () => {
    const subject = intention({ trigger: { schemaVersion: 1, triggerId: 'silence', type: 'after-silence', anchor: 'kyo-interaction', durationMs: 5_000, metadata: {} }, dueAt: null })
    expect(eligiblePendingIntentions({ state: state(subject), temporal: temporal(), now: 6_999, bootCount: 1, reason: 'interval' }).eligible).toEqual([])
    expect(eligiblePendingIntentions({ state: state(subject), temporal: temporal(), now: 7_000, bootCount: 1, reason: 'interval' }).eligible).toHaveLength(1)
  })

  it('fires a session-resume trigger once for one boot', () => {
    const subject = intention({ trigger: { schemaVersion: 1, triggerId: 'resume', type: 'on-session-resume', afterBootCount: 1, metadata: {} }, dueAt: null })
    const eligible = eligiblePendingIntentions({ state: state(subject), temporal: temporal(), now: 10_000, bootCount: 2, reason: 'session-resume' }).eligible[0]
    const begun = beginIntentionEvaluation({ state: state(subject), intentionId: subject.intentionId, evaluationId: 'eval', observationId: 'obs', evidenceKey: eligible.evidenceKey, at: 10_000 })
    const deferred = settleIntentionEvaluation({ state: begun, intentionId: subject.intentionId, at: 10_000, outcome: 'WAIT', waitUntil: 20_000 })
    expect(eligiblePendingIntentions({ state: deferred, temporal: temporal(), now: 20_000, bootCount: 2, reason: 'session-resume' }).eligible).toEqual([])
  })

  it('keeps maximum attempt count and latest cooldown during merge', () => {
    const merged = mergePendingIntentionStates(state(intention({ attemptCount: 3, cooldownUntil: 30_000 })), state(intention({ attemptCount: 1, cooldownUntil: 20_000 })))
    expect(merged.intentions[0]).toMatchObject({ attemptCount: 3, cooldownUntil: 30_000 })
  })

  it('keeps unsupported condition triggers dormant in this phase', () => {
    const subject = intention({ trigger: { schemaVersion: 1, triggerId: 'relationship', type: 'on-relationship-condition', referenceId: 'rel-1', condition: 'trust changed', metadata: {} }, dueAt: null })
    expect(eligiblePendingIntentions({ state: state(subject), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'state-change' }).eligible).toEqual([])
  })

  it('expires an overdue intention without waking it', () => {
    const result = eligiblePendingIntentions({ state: state(intention({ expiresAt: 9_000 })), temporal: temporal(), now: 10_000, bootCount: 1, reason: 'interval' })
    expect(result.eligible).toEqual([])
    expect(result.state.intentions[0].status).toBe('expired')
  })

  it('deduplicates repeated deterministic formation', () => {
    const source = { thought: thought(), decision: decision(), ownership: ownership(), goal: goal(), now: 1_000, createId: () => 'same' }
    const once = formPendingIntentions({ ...source, existing: createEmptyPendingIntentionState() })
    const twice = formPendingIntentions({ ...source, existing: once })
    expect(twice.intentions).toHaveLength(1)
  })
})
