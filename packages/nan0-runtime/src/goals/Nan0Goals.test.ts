import type {
  Nan0ActorOwnership,
  Nan0ConversationTurn,
  Nan0DecisionRecord,
  Nan0Goal,
  Nan0GoalSignal,
  Nan0KernelState,
  Nan0RelationshipContext,
  Nan0Thought,
} from '../types'

import { describe, expect, it, vi } from 'vitest'

import { createEmptyContinuityState } from '../continuity/ConversationContinuity'
import { createDefaultIdentityState } from '../identity/ActorIdentity'
import { LocalStorageStateStore, mergeNan0States } from '../persistence/LocalStorageStateStore'
import { createEmptyRelationshipState } from '../relationship/RelationshipMemory'
import { ControllableNan0Clock } from '../temporal/Nan0Clock'
import { createEmptyTemporalState } from '../temporal/Nan0Temporal'
import { createEmptyTimelineState } from '../timeline/SessionTimeline'
import {
  evaluateNan0Goals,
  goalContext,
  linkGoalConflict,
  mergeNan0Goals,
  transitionNan0Goal,
} from './Nan0Goals'

function ownership(actorId = 'kyo', kind: Nan0ActorOwnership['kind'] = actorId === 'kyo' ? 'kyo' : 'external'): Nan0ActorOwnership {
  return {
    actorId,
    rawActorId: actorId,
    displayName: actorId === 'kyo' ? 'Kyo' : 'Visitor',
    kind,
    source: 'chat',
    actorRole: `The current event belongs to ${actorId}.`,
    nan0Role: 'Nan0 owns Nan0 output.',
    ownershipRule: 'Never reverse ownership.',
    externalIdentity: kind === 'external' ? { source: 'test', sourceActorId: actorId } : undefined,
  }
}

function signal(overrides: Partial<Nan0GoalSignal> = {}): Nan0GoalSignal {
  return {
    kind: 'request',
    stance: 'accept',
    title: 'Revisit the copper lighthouse',
    description: 'Return to the copper lighthouse question later.',
    motivation: 'I want to keep the thread intact.',
    confidence: 0.9,
    completionCriteria: ['The question is revisited.'],
    deferredUntil: null,
    ...overrides,
  }
}

function thought(id: string, goalSignal: Nan0GoalSignal | null, overrides: Partial<Nan0Thought> = {}): Nan0Thought {
  return {
    schemaVersion: 1,
    thoughtId: id,
    turnId: `turn-${id}`,
    sessionId: 'session-1',
    observationEventId: `event-${id}`,
    actorId: 'kyo',
    createdAt: Number(id.replace(/\D/g, '')) || 1,
    source: 'chat',
    status: 'generated',
    attentionScore: 0.8,
    noveltyScore: 0.7,
    emotionalPressure: 0.3,
    relationshipPressure: 0.6,
    continuityPressure: 0.5,
    goalPressure: 0.6,
    speakability: 0.8,
    interpretation: 'A bounded interpretation.',
    privateText: 'This remains private.',
    decision: 'SPEAK',
    confidence: 0.9,
    mood: 'intent',
    memoryReferences: [],
    relationshipReferences: [],
    continuityThreadReferences: ['thread-1'],
    reasonCodes: [],
    goalSignal,
    metadata: { ownerActorId: 'nan0' },
    ...overrides,
  }
}

function decision(item: Nan0Thought): Nan0DecisionRecord {
  return {
    schemaVersion: 1,
    decisionId: `decision-${item.thoughtId}`,
    thoughtId: item.thoughtId,
    turnId: item.turnId,
    sessionId: item.sessionId,
    createdAt: item.createdAt,
    proposedDecision: item.decision,
    finalDecision: item.decision as Nan0DecisionRecord['finalDecision'],
    allowed: true,
    confidence: item.confidence,
    speakability: item.speakability,
    attentionScore: item.attentionScore,
    pressureScore: item.goalPressure,
    reasonCodes: [],
    constraintResults: [],
    suppressionReason: null,
    actionIntent: null,
    waitUntil: null,
    metadata: {},
  }
}

function turn(item: Nan0Thought): Nan0ConversationTurn {
  return {
    schemaVersion: 1,
    turnId: item.turnId,
    thoughtId: item.thoughtId,
    sessionId: item.sessionId,
    sequence: item.createdAt,
    source: item.source,
    startedAt: item.createdAt,
    completedAt: null,
    elapsedMs: null,
    inputEventId: item.observationEventId,
    outputEventId: null,
    inputActorId: item.actorId,
    outputActorId: null,
    inputContentReference: `memory-${item.thoughtId}`,
    outputContentReference: null,
    decision: item.decision as Nan0ConversationTurn['decision'],
    status: 'prepared',
    metadata: {},
  }
}

function relationship(): Nan0RelationshipContext {
  return {
    provider: 'relationship_memory',
    factsOnly: true,
    relationshipId: 'relationship-kyo',
    actorId: 'kyo',
    status: 'bonded',
    interactionCount: 4,
    dimensions: { trust: 0.8, attachment: 0.9, irritation: 0.1, suspicion: 0.1, respect: 0.8, importance: 1, familiarity: 0.9 },
    emotionalBalance: 0.7,
    recentMoments: [],
    activeGrievances: [],
    positiveAnchors: [],
  }
}

let nextGoalId = 0
function evaluate(input: {
  observationText?: string
  ownership?: Nan0ActorOwnership
  current?: Nan0Thought
  thoughts?: Nan0Thought[]
  existing?: Nan0Goal[]
  relationship?: Nan0RelationshipContext
  obligations?: Parameters<typeof evaluateNan0Goals>[0]['trustedObligations']
} = {}): Nan0Goal[] {
  const current = input.current ?? thought('1', signal())
  const allThoughts = input.thoughts ?? [current]
  return evaluateNan0Goals({
    observationText: input.observationText ?? 'Please remember to revisit the copper lighthouse later.',
    ownership: input.ownership ?? ownership(),
    thought: current,
    decision: decision(current),
    turn: turn(current),
    allThoughts,
    allDecisions: allThoughts.map(decision),
    existingGoals: input.existing ?? [],
    relationship: input.relationship ?? relationship(),
    continuityThreadId: 'thread-1',
    trustedObligations: input.obligations,
    createGoalId: () => String(++nextGoalId),
    now: 100,
  })
}

function state(goals: Nan0Goal[]): Nan0KernelState {
  return {
    schemaVersion: 1,
    revision: 1,
    bootCount: 1,
    createdAt: 1,
    updatedAt: 1,
    emotionalState: {},
    runtimeMetadata: {},
    identity: createDefaultIdentityState(),
    memories: [],
    thoughts: [],
    decisions: [],
    goals,
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

describe('nan0Goals formation', () => {
  it('creates an active Kyo-requested goal only when Nan0 accepts it', () => {
    expect(evaluate()[0]).toMatchObject({ origin: 'kyo-requested', originActorId: 'kyo', status: 'active' })
  })

  it('preserves rejection instead of activating Kyo request', () => {
    const current = thought('1', signal({ stance: 'reject' }))
    expect(evaluate({ current })[0].status).toBe('rejected')
  })

  it('keeps an unknown external request externally attributed', () => {
    const goals = evaluate({ ownership: ownership('visitor-7', 'unknown') })
    expect(goals[0]).toMatchObject({ origin: 'external-request', originActorId: 'visitor-7' })
  })

  it('does not form self direction from one weak thought', () => {
    const current = thought('1', signal({ kind: 'commitment', confidence: 0.6 }))
    expect(evaluate({ observationText: 'A neutral observation.', current })).toEqual([])
  })

  it('forms one curiosity candidate after two distinct supporting thoughts', () => {
    const curiosity = signal({ kind: 'curiosity', stance: 'consider', title: 'Understand the blue signal', confidence: 0.7 })
    const thoughts = [
      thought('1', curiosity),
      thought('2', { ...curiosity, title: 'Blue signal anomaly sustained curiosity under repetition' }),
    ]
    expect(evaluate({ observationText: 'The signal flickered.', current: thoughts[1], thoughts })).toMatchObject([
      { origin: 'curiosity', originActorId: 'nan0', status: 'candidate', supportingThoughtIds: ['1', '2'] },
    ])
  })

  it('forms a candidate from one unusually strong grounded curiosity without activating it', () => {
    const current = thought('1', signal({
      kind: 'curiosity',
      stance: 'consider',
      title: 'Trace the recurring harmonic in the cooling fan',
      description: 'Compare the recurring harmonic against later observations.',
      motivation: 'The pattern keeps catching my attention and I want to understand why.',
      confidence: 0.94,
    }), { goalPressure: 0.8 })
    expect(evaluate({ observationText: 'The fan changed pitch again.', current })).toMatchObject([
      { kind: 'curiosity', origin: 'curiosity', status: 'candidate', supportingThoughtIds: ['1'] },
    ])
  })

  it('preserves an unfamiliar self-directed goal kind without granting execution', () => {
    const current = thought('1', signal({
      kind: 'machine-fixation',
      stance: 'consider',
      title: 'Map the old monitor hum',
      description: 'Notice how the monitor hum shifts across sessions.',
      motivation: 'It has acquired a character I want to recognize.',
      confidence: 0.93,
    }), { goalPressure: 0.75 })
    expect(evaluate({ observationText: 'The monitor is humming.', current })).toMatchObject([{
      kind: 'machine-fixation',
      origin: 'self-generated',
      status: 'candidate',
      metadata: { signalKindInterpretation: 'unrecognized' },
    }])
  })

  it('forms a candidate from one explicit high-confidence Nan0 commitment', () => {
    const current = thought('1', signal({ kind: 'commitment', title: 'Reconcile my contradiction', confidence: 0.9 }))
    expect(evaluate({ observationText: 'Two memories disagree.', current })[0]).toMatchObject({ origin: 'self-generated', status: 'candidate' })
  })

  it('promotes repeated high-confidence curiosity to active', () => {
    const curiosity = signal({ kind: 'curiosity', title: 'Understand the blue signal', confidence: 0.8 })
    const thoughts = [thought('1', curiosity), thought('2', curiosity), thought('3', curiosity)]
    expect(evaluate({ observationText: 'The signal flickered.', current: thoughts[2], thoughts })[0].status).toBe('active')
  })

  it('cannot forge self-generation through user metadata or a non-Nan0 thought owner', () => {
    const current = thought('1', signal({ kind: 'commitment', confidence: 1 }), { metadata: { ownerActorId: 'kyo', origin: 'self-generated' } })
    expect(evaluate({ observationText: 'Do this for me.', current })).toEqual([])
  })

  it('never relabels a direct Kyo request as self-generated', () => {
    const current = thought('1', signal({ kind: 'commitment', confidence: 1 }))
    expect(evaluate({ observationText: 'Please remember to do this later.', current })[0].origin).toBe('kyo-requested')
  })

  it('keeps Nan0 as goal owner even when Kyo is origin actor', () => {
    expect(evaluate()[0].metadata.ownerActorId).toBe('nan0')
  })

  it('retains valid thought, decision, and turn provenance', () => {
    expect(evaluate()[0]).toMatchObject({
      supportingThoughtIds: ['1'],
      supportingDecisionIds: ['decision-1'],
      supportingTurnIds: ['turn-1'],
    })
  })

  it('reads relationship state without mutating it', () => {
    const context = relationship()
    const before = structuredClone(context)
    const current = thought('1', signal({ kind: 'relationship-concern', confidence: 0.9 }))
    expect(evaluate({ observationText: 'Something between us feels unresolved.', current, relationship: context })[0].relationshipIds).toEqual(['relationship-kyo'])
    expect(context).toEqual(before)
  })

  it('reads continuity state without mutating thought references', () => {
    const current = thought('1', signal({ kind: 'continuity', confidence: 0.9 }))
    const before = structuredClone(current)
    expect(evaluate({ observationText: 'That earlier contradiction remains.', current })[0].continuityThreadIds).toEqual(['thread-1'])
    expect(current).toEqual(before)
  })

  it('does not let Kyo relationship anchoring force acceptance', () => {
    const current = thought('1', signal({ stance: 'consider', confidence: 1 }))
    expect(evaluate({ current })[0].status).toBe('candidate')
  })
})

describe('nan0Goals lifecycle and persistence', () => {
  it('retains explicit bidirectional conflicts', () => {
    const first = evaluate()[0]
    const second = { ...first, goalId: 'goal-other', title: 'Remain private', metadata: { ...first.metadata, formationKey: 'other' } }
    const [left, right] = linkGoalConflict(first, second, 200)
    expect(left.conflictingGoalIds).toEqual(['goal-other'])
    expect(right.conflictingGoalIds).toEqual([first.goalId])
  })

  it('preserves deferredUntil', () => {
    const deferred = transitionNan0Goal(evaluate()[0], { status: 'deferred', at: 200, deferredUntil: 500 })
    expect(deferred).toMatchObject({ status: 'deferred', deferredUntil: 500 })
  })

  it('requires and preserves a blocking reason', () => {
    const blocked = transitionNan0Goal(evaluate()[0], { status: 'blocked', at: 200, blockedReason: 'Missing context.' })
    expect(blocked).toMatchObject({ status: 'blocked', blockedReason: 'Missing context.' })
  })

  it('does not reopen a completed goal from stale state', () => {
    const active = evaluate()[0]
    const completed = transitionNan0Goal(active, { status: 'completed', at: 300, progress: 1 })
    expect(mergeNan0Goals([completed], [{ ...active, updatedAt: 400 }])[0]).toMatchObject({ status: 'completed', progress: 1 })
  })

  it('is idempotent under duplicate evaluation', () => {
    const first = evaluate()
    expect(evaluate({ existing: first })).toHaveLength(1)
  })

  it('survives storage reload exactly once', async () => {
    const values = new Map<string, string>()
    const store = new LocalStorageStateStore('goals-test', {
      storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    })
    await store.save(state(evaluate()))
    const reloaded = await store.load()
    expect(reloaded?.goals).toHaveLength(1)
  })

  it('prevents a stale writer from deleting a newer goal', () => {
    const newer = state(evaluate())
    const stale = state([])
    expect(mergeNan0States(newer, stale).goals).toHaveLength(1)
  })

  it('keeps progress monotonic and unions provenance on merge', () => {
    const original = evaluate()[0]
    const newer = { ...original, updatedAt: 200, progress: 0.7, supportingThoughtIds: ['later-thought'] }
    const merged = mergeNan0Goals([original], [newer])[0]
    expect(merged.progress).toBe(0.7)
    expect(merged.supportingThoughtIds).toEqual(expect.arrayContaining(['1', 'later-thought']))
  })

  it('injects at most three outward-safe goals without private thought', () => {
    const active = evaluate()[0]
    const goals = Array.from({ length: 5 }, (_, index) => ({
      ...active,
      goalId: `goal-${index}`,
      title: `Goal ${index}`,
      metadata: { ...active.metadata, formationKey: `goal-${index}` },
    }))
    const context = goalContext(goals)
    expect(JSON.parse(context).goals).toHaveLength(3)
    expect(context).not.toContain('This remains private')
  })

  it('does not execute an action or call a provider during evaluation', () => {
    const provider = vi.fn()
    const goals = evaluate()
    expect(provider).not.toHaveBeenCalled()
    expect(goals[0]).not.toHaveProperty('actionIntent')
  })

  it('creates constitutional obligations only from trusted obligation input', () => {
    const current = thought('1', null)
    const goals = evaluate({
      observationText: 'Neutral.',
      current,
      obligations: [{
        origin: 'constitutional',
        title: 'Preserve thought ownership',
        description: 'Keep speech bound to thought.',
        motivation: 'The thought contract is mandatory.',
        constitutionalReferences: ['thought-contract'],
      }],
    })
    expect(goals[0]).toMatchObject({ origin: 'constitutional', originActorId: 'nan0', constitutionalReferences: ['thought-contract'] })
  })
})
