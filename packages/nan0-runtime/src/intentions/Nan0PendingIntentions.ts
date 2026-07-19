import type {
  Nan0ActorOwnership,
  Nan0DecisionRecord,
  Nan0Goal,
  Nan0IntentionSignal,
  Nan0IntentionTrigger,
  Nan0InternalObservationSource,
  Nan0PendingIntention,
  Nan0PendingIntentionOrigin,
  Nan0PendingIntentionState,
  Nan0PendingIntentionStatus,
  Nan0TemporalState,
  Nan0Thought,
  Nan0ThoughtPolicy,
} from '../types'

import { NAN0_DEFAULT_THOUGHT_POLICY } from '../thought/Nan0ThoughtPolicy'

const TERMINAL_STATUSES = new Set<Nan0PendingIntentionStatus>([
  'completed',
  'cancelled',
  'expired',
  'superseded',
  'failed',
])
const MAX_TEXT = 800
const MAX_REFERENCES = 16
const DEFAULT_RETRY_COOLDOWN_MS = 5 * 60_000
const DEFAULT_MAX_ATTEMPTS = 3

export interface Nan0IntentionEligibility {
  intention: Nan0PendingIntention
  dueAt: number
  evidenceKey: string
  wakeReason: string
  source: Nan0InternalObservationSource
}

export interface Nan0PendingIntentionFormationInput {
  thought: Readonly<Nan0Thought>
  decision: Readonly<Nan0DecisionRecord>
  ownership: Readonly<Nan0ActorOwnership>
  goal?: Readonly<Nan0Goal> | null
  existing: Readonly<Nan0PendingIntentionState>
  now: number
  createId: () => string
  thoughtPolicy?: Readonly<Nan0ThoughtPolicy>
}

function clamp(value: unknown, min = 0, max = 1): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : min
  return Math.min(max, Math.max(min, number))
}

function bounded(value: unknown, limit = MAX_TEXT): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : ''
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].slice(0, MAX_REFERENCES)
}

function statusRank(status: Nan0PendingIntentionStatus): number {
  if (TERMINAL_STATUSES.has(status))
    return 5
  if (status === 'blocked')
    return 4
  if (status === 'evaluating')
    return 3
  if (status === 'eligible')
    return 2
  if (status === 'deferred')
    return 1
  return 0
}

function finiteTime(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeTrigger(trigger: Nan0IntentionTrigger, fallbackAt: number): Nan0IntentionTrigger {
  const type = bounded(trigger?.type, 120) || 'manual'
  const base = {
    schemaVersion: 1 as const,
    triggerId: bounded(trigger?.triggerId, 160) || `trigger_${fallbackAt}`,
    metadata: trigger?.metadata && typeof trigger.metadata === 'object'
      ? structuredClone(trigger.metadata)
      : {},
  }
  switch (type) {
    case 'at-time':
      return { ...base, type, at: finiteTime(trigger.at) ?? fallbackAt, interpretationStatus: 'known' }
    case 'after-duration':
      return {
        ...base,
        type,
        anchorAt: finiteTime(trigger.anchorAt) ?? fallbackAt,
        durationMs: Math.max(0, finiteTime(trigger.durationMs) ?? 0),
        interpretationStatus: 'known',
      }
    case 'after-silence':
      return {
        ...base,
        type,
        anchor: trigger.anchor === 'nan0-expression' || trigger.anchor === 'any-interaction'
          ? trigger.anchor
          : 'kyo-interaction',
        durationMs: Math.max(0, finiteTime(trigger.durationMs) ?? 0),
        interpretationStatus: 'known',
      }
    case 'on-session-resume':
      return {
        ...base,
        type,
        afterBootCount: Math.max(0, Math.floor(finiteTime(trigger.afterBootCount) ?? 0)),
        interpretationStatus: 'known',
      }
    case 'on-relationship-condition':
    case 'on-goal-condition':
    case 'on-continuity-condition':
    case 'on-state-change':
    case 'manual':
    case 'until-condition':
      return {
        ...base,
        type,
        referenceId: bounded(trigger.referenceId, 160) || null,
        condition: bounded(trigger.condition, 400),
        interpretationStatus: 'known',
      }
    default:
      return {
        ...base,
        type,
        at: finiteTime(trigger?.at) ?? undefined,
        anchorAt: finiteTime(trigger?.anchorAt) ?? undefined,
        durationMs: finiteTime(trigger?.durationMs) == null ? undefined : Math.max(0, finiteTime(trigger.durationMs)!),
        afterBootCount: finiteTime(trigger?.afterBootCount) == null ? undefined : Math.max(0, Math.floor(finiteTime(trigger.afterBootCount)!)),
        referenceId: bounded(trigger?.referenceId, 160) || null,
        condition: bounded(trigger?.condition, 400),
        interpretationStatus: 'unsupported',
        metadata: { ...base.metadata, unsupportedTriggerType: type },
      }
  }
}

export function createEmptyPendingIntentionState(): Nan0PendingIntentionState {
  return { schemaVersion: 3, revision: 0, intentions: [] }
}

export function normalizePendingIntention(
  intention: Nan0PendingIntention,
  fallbackAt = 0,
): Nan0PendingIntention {
  const createdAt = finiteTime(intention?.createdAt) ?? fallbackAt
  const status = intention?.status ?? 'pending'
  return {
    schemaVersion: 3,
    intentionId: bounded(intention?.intentionId, 180),
    createdAt,
    updatedAt: Math.max(createdAt, finiteTime(intention?.updatedAt) ?? createdAt),
    ownerActorId: 'nan0',
    origin: intention?.origin ?? 'self-generated',
    originActorId: bounded(intention?.originActorId, 180) || 'nan0',
    status,
    kind: intention?.kind ?? 'reconsider',
    title: bounded(intention?.title, 240),
    description: bounded(intention?.description),
    motivation: bounded(intention?.motivation),
    priority: clamp(intention?.priority),
    confidence: clamp(intention?.confidence),
    goalId: bounded(intention?.goalId, 180) || null,
    thoughtId: bounded(intention?.thoughtId, 180) || null,
    decisionId: bounded(intention?.decisionId, 180) || null,
    turnId: bounded(intention?.turnId, 180) || null,
    continuityThreadIds: unique(intention?.continuityThreadIds ?? []),
    relationshipIds: unique(intention?.relationshipIds ?? []),
    trigger: normalizeTrigger(intention?.trigger, createdAt),
    earliestAt: finiteTime(intention?.earliestAt),
    dueAt: finiteTime(intention?.dueAt),
    expiresAt: finiteTime(intention?.expiresAt),
    lastEvaluatedAt: finiteTime(intention?.lastEvaluatedAt),
    evaluationCount: Math.max(0, Math.floor(finiteTime(intention?.evaluationCount) ?? 0)),
    attemptCount: Math.max(0, Math.floor(finiteTime(intention?.attemptCount) ?? 0)),
    cooldownUntil: finiteTime(intention?.cooldownUntil),
    blockedReason: bounded(intention?.blockedReason, 400) || null,
    resolution: bounded(intention?.resolution, 600) || null,
    lastEvaluationId: bounded(intention?.lastEvaluationId, 180) || null,
    lastWakeObservationId: bounded(intention?.lastWakeObservationId, 180) || null,
    lastTriggerEvidenceKey: bounded(intention?.lastTriggerEvidenceKey, 240) || null,
    metadata: intention?.metadata && typeof intention.metadata === 'object'
      ? structuredClone(intention.metadata)
      : {},
  }
}

export function normalizePendingIntentionState(
  state: Nan0PendingIntentionState | null | undefined,
  fallbackAt = 0,
): Nan0PendingIntentionState {
  const byId = new Map<string, Nan0PendingIntention>()
  for (const raw of state?.intentions ?? []) {
    const intention = normalizePendingIntention(raw, fallbackAt)
    if (intention.intentionId)
      byId.set(intention.intentionId, intention)
  }
  return {
    schemaVersion: 3,
    revision: Math.max(0, Math.floor(state?.revision ?? 0)),
    intentions: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.intentionId.localeCompare(b.intentionId)),
  }
}

function mergeIntention(left: Nan0PendingIntention, right: Nan0PendingIntention): Nan0PendingIntention {
  const leftTerminal = TERMINAL_STATUSES.has(left.status)
  const rightTerminal = TERMINAL_STATUSES.has(right.status)
  const primary = leftTerminal && !rightTerminal
    ? left
    : rightTerminal && !leftTerminal
      ? right
      : statusRank(left.status) > statusRank(right.status)
        ? left
        : statusRank(right.status) > statusRank(left.status)
          ? right
          : left.updatedAt >= right.updatedAt ? left : right
  const secondary = primary === left ? right : left
  return {
    ...structuredClone(secondary),
    ...structuredClone(primary),
    createdAt: Math.min(left.createdAt, right.createdAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    ownerActorId: 'nan0',
    continuityThreadIds: unique([...left.continuityThreadIds, ...right.continuityThreadIds]),
    relationshipIds: unique([...left.relationshipIds, ...right.relationshipIds]),
    evaluationCount: Math.max(left.evaluationCount, right.evaluationCount),
    attemptCount: Math.max(left.attemptCount, right.attemptCount),
    cooldownUntil: Math.max(left.cooldownUntil ?? 0, right.cooldownUntil ?? 0) || null,
    lastEvaluatedAt: Math.max(left.lastEvaluatedAt ?? 0, right.lastEvaluatedAt ?? 0) || null,
    metadata: {
      ...structuredClone(secondary.metadata),
      ...structuredClone(primary.metadata),
      triggerEvidence: unique([
        ...((left.metadata.triggerEvidence as string[] | undefined) ?? []),
        ...((right.metadata.triggerEvidence as string[] | undefined) ?? []),
      ]),
    },
  }
}

export function mergePendingIntentionStates(
  persisted: Nan0PendingIntentionState | null | undefined,
  candidate: Nan0PendingIntentionState | null | undefined,
  fallbackAt = 0,
): Nan0PendingIntentionState {
  const left = normalizePendingIntentionState(persisted, fallbackAt)
  const right = normalizePendingIntentionState(candidate, fallbackAt)
  const byId = new Map(left.intentions.map(item => [item.intentionId, item]))
  for (const intention of right.intentions) {
    const existing = byId.get(intention.intentionId)
    byId.set(intention.intentionId, existing ? mergeIntention(existing, intention) : intention)
  }
  return {
    schemaVersion: 3,
    revision: Math.max(left.revision, right.revision) + 1,
    intentions: [...byId.values()].sort((a, b) => a.createdAt - b.createdAt || a.intentionId.localeCompare(b.intentionId)),
  }
}

function silenceAnchor(temporal: Readonly<Nan0TemporalState>, trigger: Readonly<Nan0IntentionTrigger>): number {
  if (trigger.anchor === 'kyo-interaction')
    return temporal.lastKyoInteractionAt ?? temporal.lastBootAt ?? temporal.lastObservedWallTime
  if (trigger.anchor === 'nan0-expression')
    return temporal.lastNan0ExpressionAt ?? temporal.lastBootAt ?? temporal.lastObservedWallTime
  return Math.max(
    temporal.lastKyoInteractionAt ?? 0,
    temporal.lastNan0ExpressionAt ?? 0,
    temporal.lastBootAt ?? 0,
    temporal.lastObservedWallTime,
  )
}

export function effectiveIntentionDueAt(
  intention: Readonly<Nan0PendingIntention>,
  temporal: Readonly<Nan0TemporalState>,
): number | null {
  let triggerAt: number | null = null
  if (intention.trigger.type === 'at-time')
    triggerAt = finiteTime(intention.trigger.at)
  else if (intention.trigger.type === 'after-duration')
    triggerAt = (finiteTime(intention.trigger.anchorAt) ?? 0) + (finiteTime(intention.trigger.durationMs) ?? 0)
  else if (intention.trigger.type === 'after-silence')
    triggerAt = silenceAnchor(temporal, intention.trigger) + (finiteTime(intention.trigger.durationMs) ?? 0)
  const lowerBound = Math.max(intention.earliestAt ?? 0, intention.cooldownUntil ?? 0)
  return triggerAt == null ? null : Math.max(triggerAt, intention.dueAt ?? 0, lowerBound)
}

function eligibleStatus(status: Nan0PendingIntentionStatus): boolean {
  return status === 'pending' || status === 'deferred' || status === 'eligible'
}

export function eligiblePendingIntentions(input: {
  state: Readonly<Nan0PendingIntentionState>
  temporal: Readonly<Nan0TemporalState>
  now: number
  bootCount: number
  reason: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual'
  limit?: number
}): { state: Nan0PendingIntentionState, eligible: Nan0IntentionEligibility[] } {
  const state = normalizePendingIntentionState(input.state, input.now)
  const updated = state.intentions.map((intention) => {
    if (!TERMINAL_STATUSES.has(intention.status) && intention.expiresAt != null && input.now >= intention.expiresAt) {
      return { ...intention, status: 'expired' as const, updatedAt: input.now, resolution: 'intention.expired' }
    }
    return intention
  })
  const candidates: Nan0IntentionEligibility[] = []
  for (const intention of updated) {
    if (!eligibleStatus(intention.status) || intention.blockedReason)
      continue
    if (intention.earliestAt != null && input.now < intention.earliestAt)
      continue
    if (intention.cooldownUntil != null && input.now < intention.cooldownUntil)
      continue

    const clockEligibilityBlocked = typeof input.temporal.engine.metadata.clockEligibilityBlockedAdjustmentId === 'string'
    if (clockEligibilityBlocked && intention.trigger.type !== 'on-session-resume')
      continue

    if (intention.trigger.type === 'on-session-resume') {
      if (input.reason !== 'session-resume' || input.bootCount <= (finiteTime(intention.trigger.afterBootCount) ?? 0))
        continue
      const evidenceKey = `resume:${input.bootCount}`
      if (intention.lastTriggerEvidenceKey === evidenceKey)
        continue
      candidates.push({
        intention,
        dueAt: input.now,
        evidenceKey,
        wakeReason: `AIRI resumed after boot ${finiteTime(intention.trigger.afterBootCount) ?? 0}.`,
        source: 'internal:session-resume',
      })
      continue
    }

    const dueAt = effectiveIntentionDueAt(intention, input.temporal)
    if (dueAt == null || input.now < dueAt)
      continue
    const evidenceKey = `${intention.trigger.type}:${dueAt}`
    if (intention.lastTriggerEvidenceKey === evidenceKey && intention.status !== 'deferred')
      continue
    candidates.push({
      intention,
      dueAt,
      evidenceKey,
      wakeReason: `Pending intention became eligible because ${intention.trigger.type} matured at ${dueAt}.`,
      source: intention.trigger.type === 'after-silence' ? 'internal:temporal' : 'internal:intention',
    })
  }
  candidates.sort((a, b) =>
    b.intention.priority - a.intention.priority
    || a.dueAt - b.dueAt
    || a.intention.intentionId.localeCompare(b.intention.intentionId),
  )
  return {
    state: {
      schemaVersion: 1,
      revision: state.revision + (updated.some((item, index) => item !== state.intentions[index]) ? 1 : 0),
      intentions: updated,
    },
    eligible: candidates.slice(0, Math.max(0, Math.min(input.limit ?? 2, 10))),
  }
}

export function beginIntentionEvaluation(input: {
  state: Readonly<Nan0PendingIntentionState>
  intentionId: string
  evaluationId: string
  observationId: string
  evidenceKey: string
  at: number
}): Nan0PendingIntentionState {
  const state = normalizePendingIntentionState(input.state, input.at)
  return {
    ...state,
    revision: state.revision + 1,
    intentions: state.intentions.map((intention) => {
      if (intention.intentionId !== input.intentionId || !eligibleStatus(intention.status))
        return intention
      return {
        ...intention,
        status: 'evaluating',
        updatedAt: input.at,
        lastEvaluatedAt: input.at,
        evaluationCount: intention.evaluationCount + 1,
        attemptCount: intention.attemptCount + 1,
        lastEvaluationId: input.evaluationId,
        lastWakeObservationId: input.observationId,
        lastTriggerEvidenceKey: input.evidenceKey,
        metadata: {
          ...intention.metadata,
          triggerEvidence: unique([
            ...((intention.metadata.triggerEvidence as string[] | undefined) ?? []),
            input.evidenceKey,
          ]),
        },
      }
    }),
  }
}

export function settleIntentionEvaluation(input: {
  state: Readonly<Nan0PendingIntentionState>
  intentionId: string
  at: number
  outcome: 'SPEAK' | 'SILENCE' | 'WAIT' | 'ACT' | 'BODY_EXPRESSION' | 'provider-failure' | 'delivery-deferred'
  thoughtId?: string | null
  decisionId?: string | null
  turnId?: string | null
  waitUntil?: number | null
  resolution?: string
}): Nan0PendingIntentionState {
  const state = normalizePendingIntentionState(input.state, input.at)
  return {
    ...state,
    revision: state.revision + 1,
    intentions: state.intentions.map((intention) => {
      if (intention.intentionId !== input.intentionId || TERMINAL_STATUSES.has(intention.status))
        return intention
      const maxAttempts = Math.max(1, Number(intention.metadata.maxAttempts ?? DEFAULT_MAX_ATTEMPTS))
      let status: Nan0PendingIntentionStatus = intention.status
      let cooldownUntil = intention.cooldownUntil
      if (input.outcome === 'SPEAK' || input.outcome === 'ACT' || input.outcome === 'BODY_EXPRESSION') {
        status = 'completed'
      }
      else if (input.outcome === 'SILENCE') {
        status = intention.metadata.preserveAfterSilence === true ? 'deferred' : 'completed'
      }
      else if (input.outcome === 'WAIT' || input.outcome === 'delivery-deferred') {
        status = 'deferred'
        cooldownUntil = Math.max(input.waitUntil ?? 0, input.at + DEFAULT_RETRY_COOLDOWN_MS)
      }
      else if (input.outcome === 'provider-failure') {
        status = intention.attemptCount >= maxAttempts ? 'failed' : 'deferred'
        cooldownUntil = status === 'deferred' ? input.at + DEFAULT_RETRY_COOLDOWN_MS : intention.cooldownUntil
      }
      return {
        ...intention,
        status,
        updatedAt: input.at,
        thoughtId: input.thoughtId ?? intention.thoughtId,
        decisionId: input.decisionId ?? intention.decisionId,
        turnId: input.turnId ?? intention.turnId,
        cooldownUntil,
        resolution: bounded(input.resolution, 600) || `decision.${input.outcome.toLowerCase()}`,
      }
    }),
  }
}

export function recoverInterruptedIntentionEvaluations(
  stateInput: Readonly<Nan0PendingIntentionState>,
  at: number,
): Nan0PendingIntentionState {
  const state = normalizePendingIntentionState(stateInput, at)
  let changed = false
  const intentions = state.intentions.map((intention) => {
    if (intention.status !== 'evaluating')
      return intention
    changed = true
    return {
      ...intention,
      status: 'deferred' as const,
      updatedAt: at,
      cooldownUntil: Math.max(intention.cooldownUntil ?? 0, at + DEFAULT_RETRY_COOLDOWN_MS),
      resolution: 'intention.interrupted-evaluation-recovered',
    }
  })
  return changed ? { ...state, revision: state.revision + 1, intentions } : state
}

function formationKey(origin: Nan0PendingIntentionOrigin, title: string, trigger: Nan0IntentionTrigger, goalId: string | null): string {
  return [origin, goalId ?? '', title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(), trigger.type].join('|')
}

function signalFromInput(input: Nan0PendingIntentionFormationInput): Nan0IntentionSignal | null {
  const minimumConfidence = (input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY).intentionProposalPolicy.minimumConfidence
  if (input.thought.intentionSignal && input.thought.intentionSignal.confidence >= minimumConfidence)
    return input.thought.intentionSignal
  const goalSignal = input.thought.goalSignal
  if (goalSignal?.deferredUntil != null
    && goalSignal.confidence >= minimumConfidence
    && goalSignal.stance !== 'reject') {
    return {
      kind: goalSignal.kind === 'request' ? 'follow-up' : 'reconsider',
      title: goalSignal.title,
      description: goalSignal.description,
      motivation: goalSignal.motivation,
      confidence: goalSignal.confidence,
      priority: input.goal?.priority ?? 0.6,
      trigger: {
        schemaVersion: 1,
        triggerId: `trigger_${input.createId()}`,
        type: 'at-time',
        at: goalSignal.deferredUntil,
        metadata: { derivedFrom: 'goal-signal.deferredUntil' },
      },
    }
  }
  if (input.goal?.deferredUntil != null && input.goal.confidence >= minimumConfidence) {
    return {
      kind: 'reconsider',
      title: input.goal.title,
      description: input.goal.description,
      motivation: input.goal.motivation,
      confidence: input.goal.confidence,
      priority: input.goal.priority,
      trigger: {
        schemaVersion: 1,
        triggerId: `trigger_${input.createId()}`,
        type: 'at-time',
        at: input.goal.deferredUntil,
        metadata: { derivedFrom: 'goal.deferredUntil' },
      },
      origin: 'goal-derived',
    }
  }
  return null
}

export function formPendingIntentions(input: Nan0PendingIntentionFormationInput): Nan0PendingIntentionState {
  const minimumConfidence = (input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY).intentionProposalPolicy.minimumConfidence
  const state = normalizePendingIntentionState(input.existing, input.now)
  if (input.thought.status !== 'generated' || input.decision.finalDecision === 'ACT')
    return state
  const signal = signalFromInput(input)
  if (!signal || signal.confidence < minimumConfidence || !bounded(signal.title))
    return state
  const trigger = normalizeTrigger(signal.trigger, input.now)
  const supported = trigger.type === 'at-time'
    || trigger.type === 'after-duration'
    || trigger.type === 'after-silence'
    || trigger.type === 'on-session-resume'
  const origin: Nan0PendingIntentionOrigin = input.goal
    ? 'goal-derived'
    : input.ownership.actorId === 'kyo' && input.thought.goalSignal?.kind === 'request'
      ? 'kyo-requested'
      : signal.origin === 'relationship-derived' && input.thought.relationshipReferences.length
        ? 'relationship-derived'
        : signal.origin === 'continuity-derived' && input.thought.continuityThreadReferences.length
          ? 'continuity-derived'
          : 'self-generated'
  const originActorId = input.goal?.originActorId
    ?? (origin === 'kyo-requested' ? 'kyo' : 'nan0')
  const key = formationKey(origin, signal.title, trigger, input.goal?.goalId ?? null)
  if (state.intentions.some(item => item.metadata.formationKey === key))
    return state
  const dueAt = trigger.type === 'at-time'
    ? finiteTime(trigger.at)
    : trigger.type === 'after-duration'
      ? (finiteTime(trigger.anchorAt) ?? input.now) + (finiteTime(trigger.durationMs) ?? 0)
      : null
  const intention: Nan0PendingIntention = normalizePendingIntention({
    schemaVersion: 1,
    intentionId: `intention_${input.createId()}`,
    createdAt: input.now,
    updatedAt: input.now,
    ownerActorId: 'nan0',
    origin,
    originActorId,
    status: supported ? 'pending' : 'blocked',
    kind: signal.kind,
    title: signal.title,
    description: signal.description,
    motivation: signal.motivation,
    priority: signal.priority,
    confidence: signal.confidence,
    goalId: input.goal?.goalId ?? null,
    thoughtId: input.thought.thoughtId,
    decisionId: input.decision.decisionId,
    turnId: input.thought.turnId,
    continuityThreadIds: input.thought.continuityThreadReferences,
    relationshipIds: input.thought.relationshipReferences,
    trigger,
    earliestAt: input.now,
    dueAt,
    expiresAt: null,
    lastEvaluatedAt: null,
    evaluationCount: 0,
    attemptCount: 0,
    cooldownUntil: null,
    blockedReason: supported ? null : `intention.unsupported-trigger:${trigger.type}`,
    resolution: null,
    lastEvaluationId: null,
    lastWakeObservationId: null,
    lastTriggerEvidenceKey: null,
    metadata: {
      formationKey: key,
      formationThoughtId: input.thought.thoughtId,
      formationDecisionId: input.decision.decisionId,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      triggerInterpretationStatus: supported ? 'known' : 'unsupported',
    },
  }, input.now)
  return {
    schemaVersion: 3,
    revision: state.revision + 1,
    intentions: [...state.intentions, intention],
  }
}

export function nextPendingIntentionEvaluationAt(
  state: Readonly<Nan0PendingIntentionState>,
  temporal: Readonly<Nan0TemporalState>,
): number | null {
  if (typeof temporal.engine.metadata.clockEligibilityBlockedAdjustmentId === 'string')
    return temporal.engine.nextEvaluationAt
  const due = state.intentions
    .filter(item => eligibleStatus(item.status) && !item.blockedReason && item.trigger.type !== 'on-session-resume')
    .map(item => effectiveIntentionDueAt(item, temporal))
    .filter((value): value is number => value != null)
  return due.length ? Math.min(...due) : null
}

export function syncPendingIntentionsToTemporal(
  state: Readonly<Nan0PendingIntentionState>,
  temporal: Readonly<Nan0TemporalState>,
): Nan0TemporalState {
  const conditions = state.intentions.flatMap((intention) => {
    if (TERMINAL_STATUSES.has(intention.status) || intention.status === 'blocked')
      return []
    const dueAt = effectiveIntentionDueAt(intention, temporal)
    if (dueAt == null)
      return []
    return [{
      schemaVersion: 1 as const,
      conditionId: `intention:${intention.intentionId}`,
      ownerType: 'intention' as const,
      ownerId: intention.intentionId,
      dueAt,
      status: intention.status === 'eligible' || intention.status === 'evaluating' ? 'eligible' as const : 'pending' as const,
      eligibleAt: intention.status === 'eligible' || intention.status === 'evaluating'
        ? intention.lastEvaluatedAt ?? dueAt
        : null,
      lastEvaluatedAt: intention.lastEvaluatedAt,
      metadata: {
        triggerId: intention.trigger.triggerId,
        triggerType: intention.trigger.type,
        pendingIntentionIndex: true,
      },
    }]
  })
  const retained = temporal.conditions.filter(condition => condition.metadata.pendingIntentionIndex !== true)
  const nextConditions = [...retained, ...conditions]
    .sort((left, right) => left.dueAt - right.dueAt || left.conditionId.localeCompare(right.conditionId))
  const conditionNextEvaluationAt = nextConditions
    .filter(condition => condition.status === 'pending')
    .reduce<number | null>((next, condition) => next == null ? condition.dueAt : Math.min(next, condition.dueAt), null)
  const nextEvaluationAt = [conditionNextEvaluationAt, temporal.engine.nextEvaluationAt]
    .filter((candidate): candidate is number => candidate != null)
    .reduce<number | null>((next, candidate) => next == null ? candidate : Math.min(next, candidate), null)
  return {
    ...structuredClone(temporal),
    revision: temporal.revision + 1,
    conditions: nextConditions,
    nextEvaluationAt,
  }
}
