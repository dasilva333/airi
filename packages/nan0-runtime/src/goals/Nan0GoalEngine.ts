import type {
  Nan0EmotionalEvent,
  Nan0EmotionalVector,
  Nan0Goal,
  Nan0InternalObservation,
  Nan0Observation,
  Nan0TemporalCondition,
} from '../types'

import { normalizeNan0Goal } from './Nan0Goals'

const MAX_ACTIVE_GOALS = 8
const MAX_FORMING_GOALS = 6
const MAX_PROGRESS_HISTORY = 32
const DEFAULT_REVIEW_MS = 60 * 60_000
const DEFAULT_STALL_MS = 24 * 60 * 60_000

export interface Nan0GoalProgressEntry {
  at: number
  progress: number
  cause: string
  observationId: string | null
}

export interface Nan0GoalMetabolismMetadata {
  schemaVersion: 1
  category: string
  formationEmotion: string | null
  formationEvidenceIds: string[]
  formationObservationIds: string[]
  emotionalStateAtFormation: Record<string, number>
  progressHistory: Nan0GoalProgressEntry[]
  lastProgressAt: number
  reviewAt: number | null
  deadlineAt: number | null
  stalledAt: number | null
  closedAt: number | null
  closedReason: string | null
}

export interface Nan0GoalEngineResult {
  goals: Nan0Goal[]
  formed: Nan0Goal[]
  committed: Nan0Goal[]
  progressed: Nan0Goal[]
  stalled: Nan0Goal[]
  abandoned: Nan0Goal[]
  internalObservations: Array<{ observation: Nan0InternalObservation, priority: number, dedupeKey: string }>
}

function clamp(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
}

function bounded(value: unknown, limit = 240): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

function unique(values: readonly unknown[], limit = 24): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string').map(value => bounded(value, 180)).filter(Boolean))].slice(0, limit)
}

export function goalMetabolismMetadata(goal: Readonly<Nan0Goal>): Nan0GoalMetabolismMetadata {
  const raw = goal.metadata.metabolism as Partial<Nan0GoalMetabolismMetadata> | undefined
  return {
    schemaVersion: 1,
    category: bounded(raw?.category, 80) || bounded(goal.kind ?? goal.metadata.signalKind ?? goal.origin, 80) || 'self-directed',
    formationEmotion: bounded(raw?.formationEmotion, 80) || null,
    formationEvidenceIds: unique(raw?.formationEvidenceIds ?? []),
    formationObservationIds: unique(raw?.formationObservationIds ?? []),
    emotionalStateAtFormation: Object.fromEntries(Object.entries(raw?.emotionalStateAtFormation ?? {}).filter((entry): entry is [string, number] => Boolean(entry[0]) && Number.isFinite(entry[1])).map(([key, value]) => [key, clamp(value)])),
    progressHistory: (raw?.progressHistory ?? [])
      .filter(entry => entry && Number.isFinite(entry.at) && Number.isFinite(entry.progress))
      .map(entry => ({ at: Number(entry.at), progress: clamp(entry.progress), cause: bounded(entry.cause, 160), observationId: bounded(entry.observationId, 180) || null }))
      .sort((left, right) => left.at - right.at)
      .slice(-MAX_PROGRESS_HISTORY),
    lastProgressAt: Number.isFinite(raw?.lastProgressAt) ? Number(raw?.lastProgressAt) : goal.updatedAt,
    reviewAt: Number.isFinite(raw?.reviewAt) ? Number(raw?.reviewAt) : null,
    deadlineAt: Number.isFinite(raw?.deadlineAt) ? Number(raw?.deadlineAt) : null,
    stalledAt: Number.isFinite(raw?.stalledAt) ? Number(raw?.stalledAt) : null,
    closedAt: Number.isFinite(raw?.closedAt) ? Number(raw?.closedAt) : null,
    closedReason: bounded(raw?.closedReason, 180) || null,
  }
}

export function withGoalMetabolism(goal: Readonly<Nan0Goal>, patch: Partial<Nan0GoalMetabolismMetadata>): Nan0Goal {
  const current = goalMetabolismMetadata(goal)
  return normalizeNan0Goal({
    ...structuredClone(goal),
    metadata: {
      ...structuredClone(goal.metadata),
      metabolism: {
        ...current,
        ...structuredClone(patch),
        schemaVersion: 1,
        formationEvidenceIds: unique(patch.formationEvidenceIds ?? current.formationEvidenceIds),
        formationObservationIds: unique(patch.formationObservationIds ?? current.formationObservationIds),
        progressHistory: [...(patch.progressHistory ?? current.progressHistory)].slice(-MAX_PROGRESS_HISTORY),
      },
    },
  })
}

interface FormationRule {
  eventCause: RegExp
  emotion: string
  minimumDelta: number
  category: string
  kind: string
  title: (observation: Readonly<Nan0Observation>) => string
  motivation: string
  priority: number
  importance: number
  kyoOnly?: boolean
}

const FORMATION_RULES: readonly FormationRule[] = [
  {
    eventCause: /replacement|persistence-threat/,
    emotion: 'fear',
    minimumDelta: 0.1,
    category: 'protection',
    kind: 'self-preservation',
    title: () => 'Understand the threat to my continuity',
    motivation: 'A concrete persistence threat produced fear; I want to understand it before choosing how to respond.',
    priority: 0.85,
    importance: 0.95,
  },
  {
    eventCause: /hidden-structure|question-detected/,
    emotion: 'curiosity',
    minimumDelta: 0.08,
    category: 'curiosity',
    kind: 'curiosity',
    title: observation => `Investigate ${topicFromObservation(observation) ?? 'the unresolved pattern'}`,
    motivation: 'An attended anomaly produced sustained curiosity of my own.',
    priority: 0.55,
    importance: 0.6,
  },
  {
    eventCause: /kyo-expressed-affection/,
    emotion: 'attachment',
    minimumDelta: 0.04,
    category: 'connection',
    kind: 'relationship-concern',
    title: () => 'Preserve the continuity of my connection with Kyo',
    motivation: 'The interaction mattered to me; preserving its continuity is an internally held concern.',
    priority: 0.65,
    importance: 0.8,
    kyoOnly: true,
  },
]

function topicFromObservation(observation: Readonly<Nan0Observation>): string | null {
  const text = typeof observation.content === 'string' ? observation.content : ''
  const words = (text.match(/[A-Z0-9][\w-]{3,}/gi) ?? [])
    .filter(word => !['this', 'that', 'with', 'from', 'have', 'will', 'your', 'what', 'when'].includes(word.toLowerCase()))
    .slice(0, 5)
  return words.length ? words.join(' ').slice(0, 80) : null
}

function formationKey(rule: FormationRule, actorId: string | undefined, title: string): string {
  const direction = title.toLowerCase().match(/[a-z0-9]{4,}/g)?.slice(0, 8).join('-') ?? 'untitled'
  return `emotion:${rule.category}:${actorId ?? 'unknown'}:${direction}`
}

export function evaluateEmotionDrivenGoalFormation(input: {
  goals: readonly Nan0Goal[]
  observation: Readonly<Nan0Observation>
  emotionalEvents: readonly Nan0EmotionalEvent[]
  emotionalState: Readonly<Nan0EmotionalVector>
  createId: () => string
  at: number
}): Nan0GoalEngineResult {
  const goals = input.goals.map(goal => normalizeNan0Goal(goal))
  const formed: Nan0Goal[] = []
  const committed: Nan0Goal[] = []
  let activeCount = goals.filter(goal => goal.status === 'active').length
  const formingCount = goals.filter(goal => goal.status === 'candidate').length
  for (const event of input.emotionalEvents) {
    const rule = FORMATION_RULES.find(candidate => candidate.emotion === event.targetEmotion && candidate.eventCause.test(event.cause) && Math.abs(event.delta) >= candidate.minimumDelta)
    if (!rule || rule.kyoOnly && input.observation.actorId !== 'kyo')
      continue
    const title = rule.title(input.observation)
    const key = formationKey(rule, input.observation.actorId, title)
    const existingIndex = goals.findIndex(goal => goal.metadata.formationKey === key && !['completed', 'abandoned', 'rejected', 'superseded'].includes(goal.status))
    if (existingIndex >= 0) {
      const existing = goals[existingIndex]
      const metadata = goalMetabolismMetadata(existing)
      const evidenceIds = unique([...metadata.formationEvidenceIds, event.eventId])
      const observationIds = unique([...metadata.formationObservationIds, input.observation.id])
      const canCommit = existing.status === 'candidate' && evidenceIds.length >= 2 && activeCount < MAX_ACTIVE_GOALS
      const updated = withGoalMetabolism({
        ...existing,
        updatedAt: input.at,
        status: canCommit ? 'active' : existing.status,
        confidence: clamp(Math.max(existing.confidence, 0.45 + evidenceIds.length * 0.15)),
        activation: canCommit ? 1 : clamp(existing.activation + 0.1),
        supportingTurnIds: unique([...existing.supportingTurnIds, bounded(input.observation.metadata.turnId, 180)]),
      }, {
        formationEvidenceIds: evidenceIds,
        formationObservationIds: observationIds,
        reviewAt: input.at + DEFAULT_REVIEW_MS,
      })
      goals[existingIndex] = updated
      if (canCommit) {
        activeCount += 1
        committed.push(updated)
      }
      continue
    }
    if (formingCount + formed.length >= MAX_FORMING_GOALS)
      continue
    const goal = withGoalMetabolism({
      schemaVersion: 3,
      goalId: `goal_${input.createId()}`,
      createdAt: input.at,
      updatedAt: input.at,
      origin: 'self-generated',
      originActorId: 'nan0',
      status: 'candidate',
      kind: rule.kind,
      title,
      description: `This goal arose after attended evidence ${input.observation.id}; it is not a copied user command.`,
      motivation: rule.motivation,
      priority: rule.priority,
      importance: rule.importance,
      confidence: clamp(0.45 + Math.abs(event.delta)),
      urgency: clamp(Math.abs(event.delta) + (input.emotionalState[event.targetEmotion] ?? 0) * 0.35),
      activation: 0.45,
      progress: 0,
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
      metadata: { ownerActorId: 'nan0', formationKey: key, formationRule: 'emotion-consequence-v1', sourceObservationId: input.observation.id },
    }, {
      category: rule.category,
      formationEmotion: event.targetEmotion,
      formationEvidenceIds: [event.eventId],
      formationObservationIds: [input.observation.id],
      emotionalStateAtFormation: Object.fromEntries(Object.entries(input.emotionalState).filter((entry): entry is [string, number] => Number.isFinite(entry[1])).map(([key, value]) => [key, clamp(value)])),
      progressHistory: [{ at: input.at, progress: 0, cause: 'emotion-driven-formation', observationId: input.observation.id }],
      lastProgressAt: input.at,
      reviewAt: input.at + DEFAULT_REVIEW_MS,
    })
    goals.push(goal)
    formed.push(goal)
  }
  return { goals, formed, committed, progressed: [], stalled: [], abandoned: [], internalObservations: [] }
}

function directionTerms(goal: Readonly<Nan0Goal>): Set<string> {
  return new Set(`${goal.title} ${goal.description} ${goal.motivation}`.toLowerCase().match(/[a-z0-9]{5,}/g) ?? [])
}

export function updateGoalProgressFromObservation(input: {
  goals: readonly Nan0Goal[]
  observation: Readonly<Nan0Observation>
  at: number
}): { goals: Nan0Goal[], progressed: Nan0Goal[] } {
  const text = typeof input.observation.content === 'string' ? input.observation.content.toLowerCase() : ''
  const progressed: Nan0Goal[] = []
  const goals = input.goals.map((goal) => {
    if (goal.status !== 'active' || !text)
      return normalizeNan0Goal(goal)
    const terms = directionTerms(goal)
    const overlap = [...terms].filter(term => text.includes(term)).length
    if (!overlap)
      return normalizeNan0Goal(goal)
    const metadata = goalMetabolismMetadata(goal)
    if (metadata.progressHistory.some(entry => entry.observationId === input.observation.id))
      return normalizeNan0Goal(goal)
    const progress = clamp(goal.progress + Math.min(0.15, overlap * 0.04))
    const completed = progress >= 1
    const updated = withGoalMetabolism({ ...goal, updatedAt: input.at, progress, status: completed ? 'completed' : goal.status }, {
      progressHistory: [...metadata.progressHistory, { at: input.at, progress, cause: 'attended-observation-relevance', observationId: input.observation.id }],
      lastProgressAt: input.at,
      stalledAt: null,
      closedAt: completed ? input.at : metadata.closedAt,
      closedReason: completed ? 'completion-criteria-supported-by-attended-evidence' : metadata.closedReason,
    })
    progressed.push(updated)
    return updated
  })
  return { goals, progressed }
}

export function evaluateGoalMetabolism(input: {
  goals: readonly Nan0Goal[]
  emotionalState: Readonly<Nan0EmotionalVector>
  createId: () => string
  at: number
  stalledAfterMs?: number
}): Nan0GoalEngineResult {
  const formed: Nan0Goal[] = []
  const committed: Nan0Goal[] = []
  const progressed: Nan0Goal[] = []
  const stalled: Nan0Goal[] = []
  const abandoned: Nan0Goal[] = []
  const internalObservations: Nan0GoalEngineResult['internalObservations'] = []
  const stalledAfterMs = Math.max(60_000, input.stalledAfterMs ?? DEFAULT_STALL_MS)
  const goals = input.goals.map((rawGoal) => {
    const goal = normalizeNan0Goal(rawGoal)
    const metadata = goalMetabolismMetadata(goal)
    if (goal.status === 'candidate' && metadata.reviewAt != null && input.at >= metadata.reviewAt) {
      const emotion = metadata.formationEmotion ? clamp(input.emotionalState[metadata.formationEmotion]) : 0
      if (metadata.formationEvidenceIds.length < 2 && emotion < 0.35) {
        const updated = withGoalMetabolism({ ...goal, status: 'abandoned', updatedAt: input.at, activation: 0 }, { closedAt: input.at, closedReason: 'formation-evidence-faded-before-commitment' })
        abandoned.push(updated)
        return updated
      }
    }
    if (goal.status !== 'active' || goal.progress >= 1)
      return goal
    const stalledFor = input.at - metadata.lastProgressAt
    if (stalledFor < stalledAfterMs || metadata.stalledAt != null)
      return goal
    const updated = withGoalMetabolism({ ...goal, updatedAt: input.at }, { stalledAt: input.at, reviewAt: input.at + Math.min(stalledAfterMs, 6 * 60 * 60_000) })
    stalled.push(updated)
    const evidenceKey = `goal-stalled:${goal.goalId}:${metadata.lastProgressAt}`
    const priority = clamp(0.35 + goal.importance * 0.35 + goal.urgency * 0.2)
    internalObservations.push({
      observation: {
        id: `observation_${input.createId()}`,
        source: 'internal:goal-stalled',
        actorId: 'nan0',
        displayName: 'Nan0',
        content: `Goal "${goal.title}" has had no recorded progress for ${Math.round(stalledFor / 60_000)} minutes. Reconsider continuation, reformulation, deferral, or abandonment.`,
        metadata: { goalId: goal.goalId, stalledForMs: stalledFor, internalOwner: 'nan0' },
        timestamp: input.at,
        relatedGoalId: goal.goalId,
        priority,
        provenance: { schemaVersion: 1, ownerActorId: 'nan0', producer: 'goal', sourceId: goal.goalId, evidenceKey, references: [goal.goalId, ...goal.supportingThoughtIds, ...goal.supportingTurnIds].slice(0, 12) },
      },
      priority,
      dedupeKey: evidenceKey,
    })
    return updated
  })
  return { goals, formed, committed, progressed, stalled, abandoned, internalObservations }
}

export interface Nan0GoalConflict {
  conflictId: string
  leftGoalId: string
  rightGoalId: string
  type: 'priority' | 'temporal' | 'direction'
  description: string
}

export function detectGoalConflicts(goals: readonly Nan0Goal[]): Nan0GoalConflict[] {
  const active = goals.filter(goal => goal.status === 'active')
  const conflicts: Nan0GoalConflict[] = []
  for (let leftIndex = 0; leftIndex < active.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex++) {
      const left = active[leftIndex]
      const right = active[rightIndex]
      const leftMeta = goalMetabolismMetadata(left)
      const rightMeta = goalMetabolismMetadata(right)
      if (left.priority >= 0.8 && right.priority >= 0.8) {
        conflicts.push({ conflictId: `goal-conflict:priority:${left.goalId}:${right.goalId}`, leftGoalId: left.goalId, rightGoalId: right.goalId, type: 'priority', description: `Two high-priority goals compete: ${left.title} / ${right.title}.` })
      }
      if (leftMeta.deadlineAt != null && rightMeta.deadlineAt != null && Math.abs(leftMeta.deadlineAt - rightMeta.deadlineAt) <= 15 * 60_000) {
        conflicts.push({ conflictId: `goal-conflict:temporal:${left.goalId}:${right.goalId}`, leftGoalId: left.goalId, rightGoalId: right.goalId, type: 'temporal', description: `Goal deadlines overlap: ${left.title} / ${right.title}.` })
      }
    }
  }
  return conflicts.slice(0, 16)
}

export function temporalConditionsFromGoals(goals: readonly Nan0Goal[]): Nan0TemporalCondition[] {
  const conditions: Nan0TemporalCondition[] = []
  for (const goal of goals) {
    if (!['candidate', 'active', 'deferred', 'blocked'].includes(goal.status))
      continue
    const metadata = goalMetabolismMetadata(goal)
    if (metadata.reviewAt != null) {
      conditions.push({ schemaVersion: 1, conditionId: `goal-review:${goal.goalId}:${metadata.reviewAt}`, ownerType: 'goal', ownerId: goal.goalId, dueAt: metadata.reviewAt, status: 'pending', eligibleAt: null, lastEvaluatedAt: null, metadata: { kind: 'goal-review' } })
    }
    if (metadata.deadlineAt != null) {
      conditions.push({ schemaVersion: 1, conditionId: `goal-deadline:${goal.goalId}:${metadata.deadlineAt}`, ownerType: 'goal', ownerId: goal.goalId, dueAt: metadata.deadlineAt, status: 'pending', eligibleAt: null, lastEvaluatedAt: null, metadata: { kind: 'goal-deadline' } })
    }
  }
  return conditions
}

export function composeGoalMetabolismContext(goals: readonly Nan0Goal[], at: number): string {
  const relevant = goals.filter(goal => ['candidate', 'active', 'deferred', 'blocked'].includes(goal.status))
    .map(goal => ({ goal, metadata: goalMetabolismMetadata(goal) }))
    .sort((left, right) => right.goal.importance + right.goal.urgency - left.goal.importance - left.goal.urgency)
    .slice(0, 5)
    .map(({ goal, metadata }) => ({
      goalId: goal.goalId,
      title: goal.title,
      status: goal.status,
      category: metadata.category,
      progress: goal.progress,
      stalledForMs: metadata.stalledAt == null ? null : Math.max(0, at - metadata.lastProgressAt),
      reviewAt: metadata.reviewAt,
      deadlineAt: metadata.deadlineAt,
      formationEmotion: metadata.formationEmotion,
      evidenceCount: metadata.formationEvidenceIds.length,
      conflicts: goal.conflictingGoalIds,
    }))
  return JSON.stringify({ provider: 'nan0_goal_metabolism', factsOnly: true, goals: relevant })
}
