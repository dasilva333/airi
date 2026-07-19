import type {
  Nan0ActorOwnership,
  Nan0ConversationTurn,
  Nan0DecisionRecord,
  Nan0Goal,
  Nan0GoalOrigin,
  Nan0GoalSignal,
  Nan0GoalStatus,
  Nan0RelationshipContext,
  Nan0Thought,
  Nan0ThoughtPolicy,
  Nan0TrustedGoalObligation,
} from '../types'

import { NAN0_DEFAULT_THOUGHT_POLICY } from '../thought/Nan0ThoughtPolicy'

const MAX_GOAL_TEXT = 400
const MAX_REFERENCES = 24
const TERMINAL_STATUSES = new Set<Nan0GoalStatus>(['completed', 'abandoned', 'rejected', 'superseded'])

export interface Nan0GoalFormationInput {
  observationText: string
  ownership: Readonly<Nan0ActorOwnership>
  thought: Readonly<Nan0Thought>
  decision: Readonly<Nan0DecisionRecord>
  turn: Readonly<Nan0ConversationTurn>
  allThoughts: readonly Nan0Thought[]
  allDecisions: readonly Nan0DecisionRecord[]
  existingGoals: readonly Nan0Goal[]
  relationship: Readonly<Nan0RelationshipContext>
  continuityThreadId: string
  trustedObligations?: readonly Nan0TrustedGoalObligation[]
  thoughtPolicy?: Readonly<Nan0ThoughtPolicy>
  createGoalId: () => string
  now: number
}

export interface Nan0GoalTransition {
  status: Nan0GoalStatus
  at: number
  progress?: number
  blockedReason?: string | null
  deferredUntil?: number | null
  conflictingGoalIds?: readonly string[]
  supersededByGoalId?: string
  metadata?: Record<string, unknown>
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function bounded(value: unknown, limit = MAX_GOAL_TEXT): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

function unique(values: readonly (string | null | undefined)[], limit = MAX_REFERENCES): string[] {
  return [...new Set(values.map(value => bounded(value, 160)).filter(Boolean))].slice(0, limit)
}

function formationKey(origin: Nan0GoalOrigin, title: string, actorId: string): string {
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 12).join('-')
  return `${origin}:${actorId}:${normalized || 'untitled'}`
}

function directionTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
}

function sameDirection(left: string, right: string): boolean {
  const leftTokens = directionTokens(left)
  const rightTokens = directionTokens(right)
  if (!leftTokens.size || !rightTokens.size)
    return false
  const shared = [...leftTokens].filter(token => rightTokens.has(token)).length
  return shared >= 2 && shared / Math.min(leftTokens.size, rightTokens.size) >= 0.6
}

function looksLikeRequest(text: string): boolean {
  return /\b(?:please|can you|could you|would you|will you|remember to|don'?t forget to|i (?:want|need|ask) you to|revisit|come back to|later)\b/i.test(text)
}

function copiedFromObservation(signal: Nan0GoalSignal, observationText: string): boolean {
  const words = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
  const directionWords = words(`${signal.title} ${signal.description}`)
  if (directionWords.size < 3)
    return false
  const observationWords = words(observationText)
  const overlap = [...directionWords].filter(word => observationWords.has(word)).length
  return overlap / directionWords.size >= 0.8
}

function supportedSignal(thought: Readonly<Nan0Thought>): Nan0GoalSignal | null {
  const signal = thought.goalSignal
  if (!signal || thought.status !== 'generated' || thought.metadata.ownerActorId !== 'nan0')
    return null
  const title = bounded(signal.title, 160)
  const motivation = bounded(signal.motivation)
  if (!title || !motivation || !Number.isFinite(signal.confidence))
    return null
  return {
    kind: signal.kind,
    stance: signal.stance,
    title,
    description: bounded(signal.description),
    motivation,
    confidence: clamp(signal.confidence),
    completionCriteria: unique(signal.completionCriteria ?? [], 8),
    deferredUntil: Number.isFinite(signal.deferredUntil) ? Number(signal.deferredUntil) : null,
  }
}

function originFor(
  signal: Nan0GoalSignal,
  ownership: Readonly<Nan0ActorOwnership>,
  observationText: string,
): Nan0GoalOrigin | null {
  const request = looksLikeRequest(observationText)
  if (request) {
    if (ownership.actorId === 'kyo')
      return 'kyo-requested'
    if (ownership.kind === 'external' || ownership.kind === 'unknown')
      return 'external-request'
  }
  if (signal.kind === 'request')
    return null
  if (signal.kind === 'relationship-concern')
    return 'relationship-derived'
  if (signal.kind === 'continuity')
    return 'continuity-derived'
  if (signal.kind === 'curiosity')
    return 'curiosity'
  if (signal.kind === 'commitment')
    return 'self-generated'
  return 'self-generated'
}

function originActorId(origin: Nan0GoalOrigin, ownership: Readonly<Nan0ActorOwnership>): string {
  if (origin === 'self-generated' || origin === 'curiosity' || origin === 'maintenance' || origin === 'constitutional')
    return 'nan0'
  return ownership.actorId
}

function statusFor(
  origin: Nan0GoalOrigin,
  signal: Nan0GoalSignal,
  supportCount: number,
  averageConfidence: number,
  stronglyGrounded: boolean,
  policy: Readonly<Nan0ThoughtPolicy>,
): Nan0GoalStatus | null {
  if (origin === 'kyo-requested' || origin === 'external-request') {
    if (signal.stance === 'reject')
      return 'rejected'
    if (signal.stance === 'defer')
      return 'deferred'
    return signal.stance === 'accept' && signal.confidence >= 0.75 ? 'active' : 'candidate'
  }
  if (signal.stance === 'reject')
    return 'rejected'
  if (signal.stance === 'defer')
    return 'deferred'
  if (origin === 'curiosity') {
    if (supportCount < 2 && !stronglyGrounded)
      return null
    return supportCount >= policy.goalProposalPolicy.activationSupportCount && averageConfidence >= 0.75 ? 'active' : 'candidate'
  }
  if (origin === 'self-generated') {
    return stronglyGrounded || signal.confidence >= 0.85 || supportCount >= 2 && averageConfidence >= 0.75
      ? (supportCount >= 2 ? 'active' : 'candidate')
      : null
  }
  if (origin === 'relationship-derived' || origin === 'continuity-derived') {
    if (signal.confidence < 0.85 && supportCount < 2)
      return null
    return supportCount >= 2 ? 'active' : 'candidate'
  }
  return null
}

function goalFromEvidence(input: Nan0GoalFormationInput, signal: Nan0GoalSignal, origin: Nan0GoalOrigin): Nan0Goal | null {
  const policy = input.thoughtPolicy ?? NAN0_DEFAULT_THOUGHT_POLICY
  const actorId = originActorId(origin, input.ownership)
  if ((origin === 'self-generated' || origin === 'curiosity') && copiedFromObservation(signal, input.observationText))
    return null

  const key = formationKey(origin, signal.title, actorId)
  const relatedThoughts = input.allThoughts
    .map(thought => ({ thought, signal: supportedSignal(thought) }))
    .filter(item => item.signal?.kind === signal.kind
      && item.signal.confidence >= (origin === 'curiosity' ? policy.goalProposalPolicy.repeatedSupportConfidence : 0.6)
      && (formationKey(origin, item.signal.title, actorId) === key || sameDirection(item.signal.title, signal.title)))
  const distinctThoughts = new Map(relatedThoughts.map(item => [item.thought.thoughtId, item]))
  const supports = [...distinctThoughts.values()]
  const confidence = supports.length
    ? supports.reduce((sum, item) => sum + item.signal!.confidence, 0) / supports.length
    : signal.confidence
  const stronglyGrounded = signal.confidence >= policy.goalProposalPolicy.strongCandidateConfidence
    && input.thought.goalPressure >= policy.goalProposalPolicy.strongCandidateGoalPressure
    && Boolean(signal.description)
  const status = statusFor(origin, signal, supports.length, confidence, stronglyGrounded, policy)
  if (!status)
    return null

  const existing = input.existingGoals.find(goal => goal.metadata.formationKey === key
    || goal.origin === origin
    && goal.originActorId === actorId
    && goal.metadata.signalKind === signal.kind
    && sameDirection(goal.title, signal.title))
  const supportingThoughtIds = unique([...supports.map(item => item.thought.thoughtId), input.thought.thoughtId])
  const supportingDecisionIds = unique(input.allDecisions
    .filter(decision => supportingThoughtIds.includes(decision.thoughtId))
    .map(decision => decision.decisionId))
  const supportingTurnIds = unique(input.allThoughts
    .filter(thought => supportingThoughtIds.includes(thought.thoughtId))
    .map(thought => thought.turnId))
  const relationshipIds = origin === 'relationship-derived' && input.relationship.relationshipId
    ? [input.relationship.relationshipId]
    : []
  const continuityThreadIds = origin === 'continuity-derived' ? [input.continuityThreadId] : []

  return normalizeNan0Goal({
    schemaVersion: 1,
    goalId: existing?.goalId ?? `goal_${input.createGoalId()}`,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
    origin,
    originActorId: actorId,
    status,
    title: signal.title,
    description: signal.description,
    motivation: signal.motivation,
    priority: existing?.priority ?? clamp(0.35 + input.thought.goalPressure * 0.35 + signal.confidence * 0.3),
    importance: existing?.importance ?? clamp(0.3 + signal.confidence * 0.45 + input.thought.relationshipPressure * 0.15),
    confidence,
    urgency: existing?.urgency ?? clamp(input.thought.attentionScore * 0.5 + input.thought.emotionalPressure * 0.25),
    activation: status === 'active' ? 1 : status === 'deferred' ? 0.2 : 0.5,
    progress: existing?.progress ?? 0,
    parentGoalId: existing?.parentGoalId ?? null,
    conflictingGoalIds: existing?.conflictingGoalIds ?? [],
    supportingThoughtIds,
    supportingDecisionIds,
    supportingTurnIds,
    continuityThreadIds,
    relationshipIds,
    constitutionalReferences: [],
    completionCriteria: signal.completionCriteria,
    blockedReason: null,
    deferredUntil: status === 'deferred' ? signal.deferredUntil : null,
    metadata: {
      ...existing?.metadata,
      ownerActorId: 'nan0',
      signalKind: signal.kind,
      signalKindInterpretation: ['request', 'relationship-concern', 'continuity', 'curiosity', 'commitment'].includes(signal.kind)
        ? 'known'
        : 'unrecognized',
      formationKey: key,
      evidenceCount: supportingThoughtIds.length,
      formationRule: origin === 'curiosity'
        ? stronglyGrounded && supports.length < 2 ? 'curiosity-strong-grounded-v1' : 'curiosity-repeated-support-v1'
        : origin === 'self-generated'
          ? 'nan0-commitment-v1'
          : `${origin}-v1`,
    },
  })
}

function obligationGoal(input: Nan0GoalFormationInput, obligation: Nan0TrustedGoalObligation): Nan0Goal | null {
  const title = bounded(obligation.title, 160)
  if (!title)
    return null
  const key = formationKey(obligation.origin, title, 'nan0')
  const existing = input.existingGoals.find(goal => goal.metadata.formationKey === key)
  return normalizeNan0Goal({
    schemaVersion: 1,
    goalId: existing?.goalId ?? `goal_${input.createGoalId()}`,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
    origin: obligation.origin,
    originActorId: 'nan0',
    status: existing?.status ?? 'active',
    title,
    description: bounded(obligation.description),
    motivation: bounded(obligation.motivation),
    priority: clamp(obligation.priority ?? 0.8),
    importance: clamp(obligation.importance ?? 0.9),
    confidence: 1,
    urgency: 0.5,
    activation: 1,
    progress: existing?.progress ?? 0,
    parentGoalId: null,
    conflictingGoalIds: existing?.conflictingGoalIds ?? [],
    supportingThoughtIds: [],
    supportingDecisionIds: [],
    supportingTurnIds: [],
    continuityThreadIds: [],
    relationshipIds: [],
    constitutionalReferences: unique(obligation.constitutionalReferences ?? []),
    completionCriteria: unique(obligation.completionCriteria ?? [], 8),
    blockedReason: null,
    deferredUntil: null,
    metadata: { ...existing?.metadata, ownerActorId: 'nan0', formationKey: key, formationRule: 'trusted-obligation-v1' },
  })
}

export function evaluateNan0Goals(input: Nan0GoalFormationInput): Nan0Goal[] {
  const additions: Nan0Goal[] = []
  const signal = supportedSignal(input.thought)
  if (signal) {
    const origin = originFor(signal, input.ownership, input.observationText)
    if (origin) {
      const goal = goalFromEvidence(input, signal, origin)
      if (goal)
        additions.push(goal)
    }
  }
  for (const obligation of input.trustedObligations ?? []) {
    const goal = obligationGoal(input, obligation)
    if (goal)
      additions.push(goal)
  }
  return mergeNan0Goals(input.existingGoals, additions)
}

export function normalizeNan0Goal(goal: Nan0Goal): Nan0Goal {
  return {
    ...goal,
    schemaVersion: 3,
    kind: bounded(goal.kind ?? goal.metadata?.signalKind ?? goal.origin, 120),
    title: bounded(goal.title, 160),
    description: bounded(goal.description),
    motivation: bounded(goal.motivation),
    priority: clamp(goal.priority),
    importance: clamp(goal.importance),
    confidence: clamp(goal.confidence),
    urgency: clamp(goal.urgency),
    activation: clamp(goal.activation),
    progress: clamp(goal.progress),
    conflictingGoalIds: unique(goal.conflictingGoalIds ?? []),
    supportingThoughtIds: unique(goal.supportingThoughtIds ?? []),
    supportingDecisionIds: unique(goal.supportingDecisionIds ?? []),
    supportingTurnIds: unique(goal.supportingTurnIds ?? []),
    continuityThreadIds: unique(goal.continuityThreadIds ?? []),
    relationshipIds: unique(goal.relationshipIds ?? []),
    constitutionalReferences: unique(goal.constitutionalReferences ?? []),
    completionCriteria: unique(goal.completionCriteria ?? [], 8),
    blockedReason: goal.status === 'blocked' ? bounded(goal.blockedReason) || 'Blocked without a supplied reason.' : null,
    deferredUntil: goal.status === 'deferred' && Number.isFinite(goal.deferredUntil) ? Number(goal.deferredUntil) : null,
    metadata: structuredClone(goal.metadata ?? {}),
  }
}

function mergeGoal(left: Nan0Goal, right: Nan0Goal): Nan0Goal {
  const leftTerminal = TERMINAL_STATUSES.has(left.status)
  const rightTerminal = TERMINAL_STATUSES.has(right.status)
  const base = leftTerminal ? left : rightTerminal ? right : right.updatedAt >= left.updatedAt ? right : left
  const other = base === left ? right : left
  return normalizeNan0Goal({
    ...base,
    createdAt: Math.min(left.createdAt, right.createdAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    progress: Math.max(left.progress, right.progress),
    conflictingGoalIds: [...base.conflictingGoalIds, ...other.conflictingGoalIds],
    supportingThoughtIds: [...base.supportingThoughtIds, ...other.supportingThoughtIds],
    supportingDecisionIds: [...base.supportingDecisionIds, ...other.supportingDecisionIds],
    supportingTurnIds: [...base.supportingTurnIds, ...other.supportingTurnIds],
    continuityThreadIds: [...base.continuityThreadIds, ...other.continuityThreadIds],
    relationshipIds: [...base.relationshipIds, ...other.relationshipIds],
    constitutionalReferences: [...base.constitutionalReferences, ...other.constitutionalReferences],
    completionCriteria: [...base.completionCriteria, ...other.completionCriteria],
    metadata: { ...other.metadata, ...base.metadata },
  })
}

export function mergeNan0Goals(
  persisted: readonly Nan0Goal[] | null | undefined,
  candidate: readonly Nan0Goal[] | null | undefined,
): Nan0Goal[] {
  const goals = new Map<string, Nan0Goal>()
  const formationKeys = new Map<string, string>()
  for (const raw of [...(persisted ?? []), ...(candidate ?? [])]) {
    if ((raw?.schemaVersion !== 1 && raw?.schemaVersion !== 2 && raw?.schemaVersion !== 3) || !raw.goalId)
      continue
    const goal = normalizeNan0Goal(raw)
    const key = bounded(goal.metadata.formationKey, 240)
    const existingId = key ? formationKeys.get(key) : undefined
    const id = existingId ?? goal.goalId
    const existing = goals.get(id)
    goals.set(id, existing ? mergeGoal(existing, { ...goal, goalId: id }) : { ...goal, goalId: id })
    if (key)
      formationKeys.set(key, id)
  }
  return [...goals.values()].sort((a, b) => a.createdAt - b.createdAt || a.goalId.localeCompare(b.goalId))
}

export function transitionNan0Goal(goal: Readonly<Nan0Goal>, transition: Nan0GoalTransition): Nan0Goal {
  if (TERMINAL_STATUSES.has(goal.status) && transition.status !== goal.status)
    throw new Error(`Terminal goal ${goal.goalId} cannot transition from ${goal.status} to ${transition.status}.`)
  if (transition.status === 'blocked' && !bounded(transition.blockedReason))
    throw new Error('Blocking a goal requires a reason.')
  if (transition.status === 'deferred' && !Number.isFinite(transition.deferredUntil))
    throw new Error('Deferring a goal requires deferredUntil.')
  return normalizeNan0Goal({
    ...goal,
    status: transition.status,
    updatedAt: transition.at,
    progress: Math.max(goal.progress, clamp(transition.progress ?? goal.progress)),
    blockedReason: transition.status === 'blocked' ? transition.blockedReason ?? null : null,
    deferredUntil: transition.status === 'deferred' ? transition.deferredUntil ?? null : null,
    conflictingGoalIds: [...goal.conflictingGoalIds, ...(transition.conflictingGoalIds ?? [])],
    metadata: {
      ...goal.metadata,
      ...transition.metadata,
      ...(transition.supersededByGoalId ? { supersededByGoalId: transition.supersededByGoalId } : {}),
    },
  })
}

export function linkGoalConflict(left: Readonly<Nan0Goal>, right: Readonly<Nan0Goal>, at: number): [Nan0Goal, Nan0Goal] {
  if (left.goalId === right.goalId)
    throw new Error('A goal cannot conflict with itself.')
  return [
    normalizeNan0Goal({ ...left, updatedAt: at, conflictingGoalIds: [...left.conflictingGoalIds, right.goalId] }),
    normalizeNan0Goal({ ...right, updatedAt: at, conflictingGoalIds: [...right.conflictingGoalIds, left.goalId] }),
  ]
}

export function goalContext(goals: readonly Nan0Goal[], input: {
  continuityThreadId?: string
  relationshipId?: string | null
  limit?: number
} = {}): string {
  const relevant = goals
    .filter(goal => goal.status === 'active' || goal.status === 'deferred' || goal.status === 'blocked')
    .map(goal => ({
      goal,
      relevance: (input.continuityThreadId && goal.continuityThreadIds.includes(input.continuityThreadId) ? 1 : 0)
        + (input.relationshipId && goal.relationshipIds.includes(input.relationshipId) ? 1 : 0)
        + goal.activation + goal.importance + goal.urgency,
    }))
    .sort((a, b) => b.relevance - a.relevance || b.goal.updatedAt - a.goal.updatedAt)
    .slice(0, Math.max(0, Math.min(input.limit ?? 3, 3)))
    .map(({ goal }) => ({
      goalId: goal.goalId,
      title: goal.title,
      origin: goal.origin,
      motivation: goal.motivation,
      status: goal.status,
      urgency: goal.urgency,
      blockedReason: goal.blockedReason,
      deferredUntil: goal.deferredUntil,
      conflictingGoalIds: goal.conflictingGoalIds,
      supportingThoughtIds: goal.supportingThoughtIds,
      supportingDecisionIds: goal.supportingDecisionIds,
      supportingTurnIds: goal.supportingTurnIds,
    }))
  return JSON.stringify({ provider: 'nan0_goals', factsOnly: true, goals: relevant })
}
