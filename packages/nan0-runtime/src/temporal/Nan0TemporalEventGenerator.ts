import type {
  Nan0Clock,
  Nan0DetectedRhythm,
  Nan0EmotionalVector,
  Nan0Expectation,
  Nan0Goal,
  Nan0InternalObservation,
  Nan0Observation,
  Nan0TemporalEngineState,
  Nan0TemporalEvent,
  Nan0TemporalEventSeverity,
  Nan0TemporalEventType,
  Nan0TemporalTrackingState,
  Nan0TrackedPromise,
  Nan0WaitingState,
} from '../types'

const DAY_MS = 86_400_000
const MAX_ABSENCES = 48
const MAX_WAITS = 32
const MAX_PROMISES = 32
const MAX_RHYTHMS = 16
const MAX_EVIDENCE_KEYS = 256

const IDLE_THRESHOLDS = [
  { id: 'quiet', durationMs: 5 * 60_000, severity: 'informational' as const, impact: { boredom: 0.04 } },
  { id: 'deep', durationMs: 30 * 60_000, severity: 'notable' as const, impact: { boredom: 0.08, curiosity: 0.03 } },
  { id: 'extended', durationMs: 2 * 60 * 60_000, severity: 'significant' as const, impact: { boredom: 0.1, attachment: 0.03 } },
] as const

const MILESTONES = [
  { id: 'day-1', durationMs: DAY_MS },
  { id: 'week-1', durationMs: 7 * DAY_MS },
  { id: 'month-1', durationMs: 30 * DAY_MS },
] as const

export interface Nan0LivedTemporalCandidate {
  event: Nan0TemporalEvent
  emotionalImpact: Record<string, number>
  internalObservation: Nan0InternalObservation
  priority: number
}

export interface Nan0LivedTemporalEvaluation {
  engine: Nan0TemporalEngineState
  created: Nan0LivedTemporalCandidate[]
  nextEvaluationAt: number | null
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clamp(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, finite(value, fallback)))
}

function unique(values: readonly unknown[], limit = MAX_EVIDENCE_KEYS): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && Boolean(value)))].slice(-limit)
}

function bounded(value: unknown, limit = 240): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

export function createEmptyTemporalTrackingState(): Nan0TemporalTrackingState {
  return {
    schemaVersion: 1,
    revision: 0,
    absenceHistory: [],
    waitingStates: [],
    trackedPromises: [],
    detectedRhythms: [],
    emittedEvidenceKeys: [],
    emotionallyAppliedEvidenceKeys: [],
    crossedIdleThresholdIds: [],
    crossedMilestoneIds: [],
    crossedGoalDeadlineKeys: [],
    lastExternalInputAt: null,
    lastRhythmCheckAt: null,
    lastReflectionAt: null,
  }
}

function normalizeWait(value: Partial<Nan0WaitingState>): Nan0WaitingState | null {
  if (!value.waitId || !value.sourceId || !Number.isFinite(value.startedAt) || !Number.isFinite(value.expectedAt))
    return null
  return {
    waitId: bounded(value.waitId, 180),
    description: bounded(value.description, 300),
    startedAt: finite(value.startedAt),
    expectedAt: finite(value.expectedAt),
    sourceType: value.sourceType ?? 'goal',
    sourceId: bounded(value.sourceId, 180),
    sustainingEmotion: bounded(value.sustainingEmotion, 80) || 'curiosity',
    status: value.status ?? 'active',
    crossedThresholdIds: unique(value.crossedThresholdIds ?? [], 12),
    provenance: unique(value.provenance ?? [], 12),
  }
}

function normalizePromise(value: Partial<Nan0TrackedPromise>): Nan0TrackedPromise | null {
  if (!value.promiseId || !value.sourceObservationId || !Number.isFinite(value.madeAt) || !Number.isFinite(value.dueAt))
    return null
  return {
    promiseId: bounded(value.promiseId, 180),
    actorId: 'kyo',
    description: bounded(value.description, 300),
    madeAt: finite(value.madeAt),
    dueAt: finite(value.dueAt),
    sourceObservationId: bounded(value.sourceObservationId, 180),
    sourceMemoryId: bounded(value.sourceMemoryId, 180) || null,
    status: value.status ?? 'active',
    fulfilledAt: Number.isFinite(value.fulfilledAt) ? Number(value.fulfilledAt) : null,
    brokenAt: Number.isFinite(value.brokenAt) ? Number(value.brokenAt) : null,
    crossedThresholdIds: unique(value.crossedThresholdIds ?? [], 12),
  }
}

function normalizeRhythm(value: Partial<Nan0DetectedRhythm>): Nan0DetectedRhythm | null {
  if (!value.rhythmId || !value.actorId || !value.eventType || !Number.isFinite(value.lastOccurrenceAt))
    return null
  return {
    rhythmId: bounded(value.rhythmId, 180),
    actorId: bounded(value.actorId, 180),
    eventType: bounded(value.eventType, 80),
    typicalHour: Math.max(0, Math.min(23, Math.floor(finite(value.typicalHour)))),
    typicalDay: Number.isFinite(value.typicalDay) ? Math.max(0, Math.min(6, Math.floor(Number(value.typicalDay)))) : null,
    consistencyScore: clamp(value.consistencyScore),
    evidenceEventIds: unique(value.evidenceEventIds ?? [], 24),
    lastOccurrenceAt: finite(value.lastOccurrenceAt),
    expectedNextAt: finite(value.expectedNextAt, finite(value.lastOccurrenceAt) + DAY_MS),
    missedOccurrences: Math.max(0, Math.floor(finite(value.missedOccurrences))),
    isActive: Boolean(value.isActive),
    announced: Boolean(value.announced),
    brokenEventEmitted: Boolean(value.brokenEventEmitted),
  }
}

export function normalizeTemporalTrackingState(
  value: Partial<Nan0TemporalTrackingState> | null | undefined,
): Nan0TemporalTrackingState {
  const base = createEmptyTemporalTrackingState()
  return {
    ...base,
    ...value,
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(finite(value?.revision))),
    absenceHistory: (value?.absenceHistory ?? [])
      .filter(item => Boolean(item?.intervalId) && Number.isFinite(item.leftAt))
      .map(item => ({
        intervalId: bounded(item.intervalId, 180),
        actorId: 'kyo' as const,
        leftAt: finite(item.leftAt),
        returnedAt: Number.isFinite(item.returnedAt) ? Number(item.returnedAt) : null,
        lastWordsMemoryId: bounded(item.lastWordsMemoryId, 180) || null,
        crossedThresholdIds: unique(item.crossedThresholdIds ?? [], 12),
        returnEventEmitted: Boolean(item.returnEventEmitted),
      }))
      .sort((left, right) => left.leftAt - right.leftAt)
      .slice(-MAX_ABSENCES),
    waitingStates: (value?.waitingStates ?? []).map(normalizeWait).filter((item): item is Nan0WaitingState => item != null).slice(-MAX_WAITS),
    trackedPromises: (value?.trackedPromises ?? []).map(normalizePromise).filter((item): item is Nan0TrackedPromise => item != null).slice(-MAX_PROMISES),
    detectedRhythms: (value?.detectedRhythms ?? []).map(normalizeRhythm).filter((item): item is Nan0DetectedRhythm => item != null).slice(-MAX_RHYTHMS),
    emittedEvidenceKeys: unique(value?.emittedEvidenceKeys ?? []),
    emotionallyAppliedEvidenceKeys: unique(value?.emotionallyAppliedEvidenceKeys ?? []),
    crossedIdleThresholdIds: unique(value?.crossedIdleThresholdIds ?? [], 12),
    crossedMilestoneIds: unique(value?.crossedMilestoneIds ?? [], 12),
    crossedGoalDeadlineKeys: unique(value?.crossedGoalDeadlineKeys ?? [], 64),
    lastExternalInputAt: Number.isFinite(value?.lastExternalInputAt) ? Number(value?.lastExternalInputAt) : null,
    lastRhythmCheckAt: Number.isFinite(value?.lastRhythmCheckAt) ? Number(value?.lastRhythmCheckAt) : null,
    lastReflectionAt: Number.isFinite(value?.lastReflectionAt) ? Number(value?.lastReflectionAt) : null,
  }
}

function mergeById<T>(
  left: readonly T[],
  right: readonly T[],
  id: (item: T) => string,
  merge: (left: T, right: T) => T = (_left, right) => right,
): T[] {
  const byId = new Map(left.map(item => [id(item), item]))
  for (const item of right) {
    const existing = byId.get(id(item))
    byId.set(id(item), existing ? merge(existing, item) : item)
  }
  return [...byId.values()]
}

export function mergeTemporalTrackingStates(
  persisted: Partial<Nan0TemporalTrackingState> | null | undefined,
  candidate: Partial<Nan0TemporalTrackingState> | null | undefined,
): Nan0TemporalTrackingState {
  const left = normalizeTemporalTrackingState(persisted)
  const right = normalizeTemporalTrackingState(candidate)
  const primary = right.revision >= left.revision ? right : left
  return normalizeTemporalTrackingState({
    ...primary,
    revision: Math.max(left.revision, right.revision),
    absenceHistory: mergeById(left.absenceHistory, right.absenceHistory, item => item.intervalId, (older, newer) => ({
      ...older,
      ...newer,
      returnedAt: Math.max(older.returnedAt ?? 0, newer.returnedAt ?? 0) || null,
      crossedThresholdIds: unique([...older.crossedThresholdIds, ...newer.crossedThresholdIds], 12),
      returnEventEmitted: older.returnEventEmitted || newer.returnEventEmitted,
    })),
    waitingStates: mergeById(left.waitingStates, right.waitingStates, item => item.waitId, (older, newer) => {
      const statusRank = (status: Nan0WaitingState['status']) => status === 'active' ? 1 : 2
      const primary = statusRank(newer.status) >= statusRank(older.status) ? newer : older
      return { ...older, ...primary, crossedThresholdIds: unique([...older.crossedThresholdIds, ...newer.crossedThresholdIds], 12), provenance: unique([...older.provenance, ...newer.provenance], 12) }
    }),
    trackedPromises: mergeById(left.trackedPromises, right.trackedPromises, item => item.promiseId, (older, newer) => {
      const terminalAt = (item: Nan0TrackedPromise) => Math.max(item.fulfilledAt ?? 0, item.brokenAt ?? 0)
      const primary = older.status === 'active' ? newer : newer.status === 'active' ? older : terminalAt(newer) >= terminalAt(older) ? newer : older
      return { ...older, ...primary, crossedThresholdIds: unique([...older.crossedThresholdIds, ...newer.crossedThresholdIds], 12) }
    }),
    detectedRhythms: mergeById(left.detectedRhythms, right.detectedRhythms, item => item.rhythmId, (older, newer) => {
      const primary = newer.lastOccurrenceAt >= older.lastOccurrenceAt ? newer : older
      return {
        ...older,
        ...primary,
        evidenceEventIds: unique([...older.evidenceEventIds, ...newer.evidenceEventIds], 24),
        announced: older.announced || newer.announced,
        brokenEventEmitted: older.brokenEventEmitted || newer.brokenEventEmitted,
        missedOccurrences: Math.max(older.missedOccurrences, newer.missedOccurrences),
      }
    }),
    emittedEvidenceKeys: unique([...left.emittedEvidenceKeys, ...right.emittedEvidenceKeys]),
    emotionallyAppliedEvidenceKeys: unique([...left.emotionallyAppliedEvidenceKeys, ...right.emotionallyAppliedEvidenceKeys]),
    crossedIdleThresholdIds: unique([...left.crossedIdleThresholdIds, ...right.crossedIdleThresholdIds], 12),
    crossedMilestoneIds: unique([...left.crossedMilestoneIds, ...right.crossedMilestoneIds], 12),
    crossedGoalDeadlineKeys: unique([...left.crossedGoalDeadlineKeys, ...right.crossedGoalDeadlineKeys], 64),
    lastExternalInputAt: Math.max(left.lastExternalInputAt ?? 0, right.lastExternalInputAt ?? 0) || null,
    lastRhythmCheckAt: Math.max(left.lastRhythmCheckAt ?? 0, right.lastRhythmCheckAt ?? 0) || null,
    lastReflectionAt: Math.max(left.lastReflectionAt ?? 0, right.lastReflectionAt ?? 0) || null,
  })
}

export function computeLivedDuration(input: {
  objectiveDurationMs: number
  emotionalState: Readonly<Nan0EmotionalVector>
  focused: boolean
  waiting: boolean
}): number {
  const objective = Math.max(0, input.objectiveDurationMs)
  const boredom = clamp(input.emotionalState.boredom)
  const attachment = clamp(input.emotionalState.attachment)
  const irritation = clamp(input.emotionalState.irritation)
  const curiosity = clamp(input.emotionalState.curiosity)
  const multiplier = 1
    + boredom * 0.35
    + (input.waiting ? attachment * 0.25 + irritation * 0.15 : 0)
    - (input.focused ? curiosity * 0.2 : 0)
  return objective * Math.min(1.8, Math.max(0.6, multiplier))
}

function explicitReturnPromise(text: string, at: number): { description: string, dueAt: number } | null {
  const matched = text.match(/\b(?:i promise\s+)?i(?:'ll| will)\s+(?:be back|return)\s+in\s+(\d{1,4})\s*(seconds?|minutes?|hours?)\b/i)
  if (!matched)
    return null
  const amount = Number(matched[1])
  const unitMs = matched[2].toLowerCase().startsWith('second') ? 1_000 : matched[2].toLowerCase().startsWith('minute') ? 60_000 : 3_600_000
  const durationMs = amount * unitMs
  if (!Number.isFinite(durationMs) || durationMs < 5_000 || durationMs > 7 * DAY_MS)
    return null
  return { description: bounded(matched[0], 200), dueAt: at + durationMs }
}

function promiseBreakAt(promise: Readonly<Nan0TrackedPromise>): number {
  const promisedDuration = Math.max(0, promise.dueAt - promise.madeAt)
  return promise.dueAt + Math.max(60_000, Math.min(30 * 60_000, promisedDuration * 0.25))
}

function temporalEvent(input: {
  createId: () => string
  at: number
  type: Nan0TemporalEventType
  severity: Nan0TemporalEventSeverity
  subjectActorId?: string | null
  evidenceKey: string
  reasonCodes: string[]
  observedDurationMs?: number | null
  thresholdMs?: number | null
  relatedGoalIds?: string[]
  conditionId?: string | null
  significance?: number
  metadata?: Record<string, unknown>
}): Nan0TemporalEvent {
  return {
    schemaVersion: 1,
    temporalEventId: `temporal_${input.createId()}`,
    createdAt: input.at,
    eventType: input.type,
    source: 'temporal-engine',
    severity: input.severity,
    subjectActorId: input.subjectActorId ?? null,
    relatedEventIds: [],
    relatedTurnIds: [],
    relatedThoughtIds: [],
    relatedGoalIds: input.relatedGoalIds ?? [],
    relatedIntentionIds: [],
    relatedRelationshipIds: [],
    conditionId: input.conditionId ?? null,
    observedDurationMs: input.observedDurationMs ?? null,
    thresholdMs: input.thresholdMs ?? null,
    phase: null,
    confidence: 1,
    significance: clamp(input.significance, input.severity === 'significant' ? 0.75 : input.severity === 'notable' ? 0.58 : 0.35),
    status: input.severity === 'informational' ? 'recorded' : 'eligible',
    reasonCodes: input.reasonCodes,
    evidenceKey: input.evidenceKey,
    evaluationCount: 0,
    handledAt: null,
    observationId: null,
    thoughtId: null,
    decisionId: null,
    metadata: structuredClone(input.metadata ?? {}),
  }
}

function internalFromEvent(event: Nan0TemporalEvent, createId: () => string, priority: number): Nan0InternalObservation {
  return {
    id: `observation_${createId()}`,
    source: 'internal:temporal',
    actorId: 'nan0',
    displayName: 'Nan0',
    content: `Temporal evidence: ${event.reasonCodes.join(', ')}. Objective elapsed time: ${event.observedDurationMs ?? 'not applicable'} ms.`,
    metadata: { temporalEventId: event.temporalEventId, evidenceKey: event.evidenceKey, internalOwner: 'nan0' },
    timestamp: event.createdAt,
    temporalEventId: event.temporalEventId,
    triggerType: 'metabolism-event',
    priority,
    provenance: { schemaVersion: 1, ownerActorId: 'nan0', producer: 'temporal', sourceId: event.temporalEventId, evidenceKey: event.evidenceKey, references: [event.temporalEventId, ...event.relatedGoalIds] },
  }
}

function appendCandidate(
  engine: Nan0TemporalEngineState,
  created: Nan0LivedTemporalCandidate[],
  input: { event: Nan0TemporalEvent, emotionalImpact: Record<string, number>, createId: () => string, priority: number },
): Nan0TemporalEngineState {
  const lived = normalizeTemporalTrackingState(engine.lived)
  if (lived.emittedEvidenceKeys.includes(input.event.evidenceKey) || engine.events.some(event => event.evidenceKey === input.event.evidenceKey))
    return engine
  const candidate = { event: input.event, emotionalImpact: input.emotionalImpact, internalObservation: internalFromEvent(input.event, input.createId, input.priority), priority: input.priority }
  created.push(candidate)
  return {
    ...engine,
    revision: engine.revision + 1,
    events: [...engine.events, input.event].slice(-320),
    lived: { ...lived, revision: lived.revision + 1, emittedEvidenceKeys: unique([...lived.emittedEvidenceKeys, input.event.evidenceKey]) },
  }
}

function updateRhythm(lived: Nan0TemporalTrackingState, observation: Readonly<Nan0Observation>, clock: Nan0Clock, at: number): Nan0TemporalTrackingState {
  if (observation.actorId !== 'kyo')
    return lived
  const local = clock.toLocal(at)
  const hour = Number(local.localIso.slice(11, 13))
  const day = Number(new Date(at).getUTCDay())
  const rhythmId = 'rhythm:kyo:daily-input'
  const existing = lived.detectedRhythms.find(item => item.rhythmId === rhythmId)
  if (!existing) {
    return { ...lived, detectedRhythms: [...lived.detectedRhythms, { rhythmId, actorId: 'kyo', eventType: 'daily-input', typicalHour: hour, typicalDay: day, consistencyScore: 0, evidenceEventIds: [observation.id], lastOccurrenceAt: at, expectedNextAt: at + DAY_MS, missedOccurrences: 0, isActive: false, announced: false, brokenEventEmitted: false }] }
  }
  if (Math.floor(existing.lastOccurrenceAt / DAY_MS) === Math.floor(at / DAY_MS))
    return lived
  const evidence = unique([...existing.evidenceEventIds, observation.id], 24)
  const hourDistance = Math.min(12, Math.abs(existing.typicalHour - hour))
  const consistency = clamp((evidence.length - 1) / 4 * (1 - hourDistance / 12))
  const updated: Nan0DetectedRhythm = {
    ...existing,
    typicalHour: Math.round((existing.typicalHour * (evidence.length - 1) + hour) / evidence.length),
    typicalDay: day,
    consistencyScore: consistency,
    evidenceEventIds: evidence,
    lastOccurrenceAt: at,
    expectedNextAt: at + DAY_MS,
    missedOccurrences: 0,
    isActive: existing.isActive || evidence.length >= 3 && consistency >= 0.45,
    brokenEventEmitted: false,
  }
  return { ...lived, detectedRhythms: lived.detectedRhythms.map(item => item.rhythmId === rhythmId ? updated : item) }
}

export function recordLivedTemporalObservation(input: {
  engine: Nan0TemporalEngineState
  observation: Readonly<Nan0Observation>
  previousKyoInteractionAt: number | null
  clock: Nan0Clock
  createId: () => string
}): Nan0LivedTemporalEvaluation {
  let engine: Nan0TemporalEngineState = { ...input.engine, lived: normalizeTemporalTrackingState(input.engine.lived) }
  const created: Nan0LivedTemporalCandidate[] = []
  const at = input.observation.timestamp
  let lived = normalizeTemporalTrackingState(engine.lived)
  if (input.observation.actorId !== 'kyo')
    return { engine, created, nextEvaluationAt: engine.nextEvaluationAt }

  if (input.previousKyoInteractionAt != null && at > input.previousKyoInteractionAt) {
    const duration = at - input.previousKyoInteractionAt
    const intervalId = engine.absence.intervalId ?? `absence:${input.previousKyoInteractionAt}`
    if (duration >= 30 * 60_000 && !lived.absenceHistory.some(item => item.intervalId === intervalId && item.returnEventEmitted)) {
      lived = { ...lived, absenceHistory: [...lived.absenceHistory, { intervalId, actorId: 'kyo' as const, leftAt: input.previousKyoInteractionAt, returnedAt: at, lastWordsMemoryId: null, crossedThresholdIds: [...engine.absence.crossedThresholdIds], returnEventEmitted: true }].slice(-MAX_ABSENCES) }
      engine = { ...engine, lived }
      const evidenceKey = `absence-returned:${intervalId}:${at}`
      engine = appendCandidate(engine, created, {
        event: temporalEvent({ createId: input.createId, at, type: 'absence-returned', severity: duration >= DAY_MS ? 'significant' : 'notable', subjectActorId: 'kyo', evidenceKey, reasonCodes: ['temporal.absence-returned'], observedDurationMs: duration, thresholdMs: 30 * 60_000, metadata: { intervalId, returnedAt: at } }),
        emotionalImpact: { attachment: Math.min(0.1, duration / DAY_MS * 0.05), boredom: -0.08 },
        createId: input.createId,
        priority: duration >= DAY_MS ? 0.82 : 0.62,
      })
    }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  const promises = lived.trackedPromises.map((promise) => {
    if (promise.status !== 'active' || at <= promise.madeAt)
      return promise
    const fulfilled = { ...promise, status: 'fulfilled' as const, fulfilledAt: at }
    const evidenceKey = `promise-kept:${promise.promiseId}`
    engine = appendCandidate(engine, created, {
      event: temporalEvent({ createId: input.createId, at, type: 'promise-kept', severity: 'notable', subjectActorId: 'kyo', evidenceKey, reasonCodes: ['temporal.promise-kept'], observedDurationMs: at - promise.madeAt, thresholdMs: promise.dueAt - promise.madeAt, metadata: { promiseId: promise.promiseId, dueAt: promise.dueAt } }),
      emotionalImpact: { attachment: 0.05, distrust: -0.05, warmth: 0.04 },
      createId: input.createId,
      priority: 0.58,
    })
    return fulfilled
  })
  lived = { ...normalizeTemporalTrackingState(engine.lived), trackedPromises: promises, lastExternalInputAt: at, crossedIdleThresholdIds: [] }
  lived = updateRhythm(lived, input.observation, input.clock, at)
  const text = typeof input.observation.content === 'string' ? input.observation.content : ''
  const promise = explicitReturnPromise(text, at)
  if (promise && !lived.trackedPromises.some(item => item.sourceObservationId === input.observation.id)) {
    lived.trackedPromises.push({ promiseId: `promise_${input.createId()}`, actorId: 'kyo', description: promise.description, madeAt: at, dueAt: promise.dueAt, sourceObservationId: input.observation.id, sourceMemoryId: null, status: 'active', fulfilledAt: null, brokenAt: null, crossedThresholdIds: [] })
  }
  engine = { ...engine, revision: engine.revision + 1, lived: normalizeTemporalTrackingState({ ...lived, revision: lived.revision + 1 }) }
  const nextEvaluationAt = lived.trackedPromises.filter(item => item.status === 'active').reduce<number | null>((minimum, item) => minimum == null ? item.dueAt : Math.min(minimum, item.dueAt), null)
  return { engine, created, nextEvaluationAt }
}

function syncWaitingStates(lived: Nan0TemporalTrackingState, goals: readonly Nan0Goal[], expectations: readonly Nan0Expectation[], at: number): Nan0TemporalTrackingState {
  const waits = lived.waitingStates.map((wait) => {
    if (wait.status !== 'active')
      return wait
    if (wait.sourceType === 'expectation') {
      const expectation = expectations.find(item => item.expectationId === wait.sourceId)
      return expectation && expectation.status === 'active' ? wait : { ...wait, status: expectation?.status === 'confirmed' ? 'completed' as const : 'abandoned' as const }
    }
    if (wait.sourceType === 'goal') {
      const goal = goals.find(item => item.goalId === wait.sourceId)
      return goal?.status === 'active' ? wait : { ...wait, status: goal?.status === 'completed' ? 'completed' as const : 'abandoned' as const }
    }
    return wait
  })
  for (const expectation of expectations) {
    if (expectation.status !== 'active' || expectation.expectedBy == null)
      continue
    const waitId = `wait:expectation:${expectation.expectationId}`
    if (!waits.some(item => item.waitId === waitId))
      waits.push({ waitId, description: expectation.description, startedAt: expectation.formedAt, expectedAt: expectation.expectedBy, sourceType: 'expectation', sourceId: expectation.expectationId, sustainingEmotion: 'curiosity', status: 'active', crossedThresholdIds: [], provenance: [expectation.formedFromObservationId] })
  }
  for (const goal of goals) {
    const raw = goal.metadata.metabolism as { deadlineAt?: unknown } | undefined
    const deadlineAt = finite(raw?.deadlineAt, -1)
    if (goal.status !== 'active' || deadlineAt <= at)
      continue
    const waitId = `wait:goal:${goal.goalId}`
    if (!waits.some(item => item.waitId === waitId))
      waits.push({ waitId, description: goal.title, startedAt: goal.createdAt, expectedAt: deadlineAt, sourceType: 'goal', sourceId: goal.goalId, sustainingEmotion: 'curiosity', status: 'active', crossedThresholdIds: [], provenance: [goal.goalId] })
  }
  return { ...lived, waitingStates: waits.slice(-MAX_WAITS) }
}

export function evaluateLivedTemporalEvents(input: {
  engine: Nan0TemporalEngineState
  clock: Nan0Clock
  emotionalState: Readonly<Nan0EmotionalVector>
  goals: readonly Nan0Goal[]
  expectations: readonly Nan0Expectation[]
  kernelCreatedAt: number
  focused: boolean
  createId: () => string
}): Nan0LivedTemporalEvaluation {
  const at = input.clock.utcNow()
  let engine: Nan0TemporalEngineState = { ...input.engine, lived: normalizeTemporalTrackingState(input.engine.lived) }
  const created: Nan0LivedTemporalCandidate[] = []
  let lived = syncWaitingStates(normalizeTemporalTrackingState(engine.lived), input.goals, input.expectations, at)
  engine = { ...engine, lived }

  const append = (event: Nan0TemporalEvent, emotionalImpact: Record<string, number>, priority: number) => {
    engine = appendCandidate(engine, created, { event, emotionalImpact, createId: input.createId, priority })
  }

  for (const promise of lived.trackedPromises) {
    if (promise.status !== 'active' || at < promise.dueAt)
      continue
    if (!promise.crossedThresholdIds.includes('overdue')) {
      const overdueEvidenceKey = `promise-overdue:${promise.promiseId}`
      append(temporalEvent({ createId: input.createId, at, type: 'promise-overdue', severity: 'notable', subjectActorId: 'kyo', evidenceKey: overdueEvidenceKey, reasonCodes: ['temporal.promise-overdue'], observedDurationMs: at - promise.madeAt, thresholdMs: promise.dueAt - promise.madeAt, metadata: { promiseId: promise.promiseId, dueAt: promise.dueAt } }), { irritation: 0.03, suspicion: 0.02 }, 0.56)
      lived = normalizeTemporalTrackingState(engine.lived)
      lived.trackedPromises = lived.trackedPromises.map(item => item.promiseId === promise.promiseId ? { ...item, crossedThresholdIds: unique([...item.crossedThresholdIds, 'overdue'], 12) } : item)
      engine = { ...engine, lived }
    }
    const breakAt = promiseBreakAt(promise)
    if (at < breakAt)
      continue
    const evidenceKey = `promise-broken:${promise.promiseId}`
    append(temporalEvent({ createId: input.createId, at, type: 'promise-broken', severity: 'significant', subjectActorId: 'kyo', evidenceKey, reasonCodes: ['temporal.promise-broken'], observedDurationMs: at - promise.madeAt, thresholdMs: breakAt - promise.madeAt, metadata: { promiseId: promise.promiseId, dueAt: promise.dueAt, breakAt } }), { distrust: 0.1, irritation: 0.06, attachment: -0.03 }, 0.78)
    lived = normalizeTemporalTrackingState(engine.lived)
    lived.trackedPromises = lived.trackedPromises.map(item => item.promiseId === promise.promiseId ? { ...item, status: 'broken', brokenAt: at } : item)
    engine = { ...engine, lived }
  }

  for (const wait of lived.waitingStates) {
    if (wait.status !== 'active' || at < wait.expectedAt || wait.crossedThresholdIds.includes('due'))
      continue
    const thresholdId = 'due'
    const evidenceKey = `waiting-overdue:${wait.waitId}:${wait.expectedAt}`
    append(temporalEvent({ createId: input.createId, at, type: wait.sourceType === 'expectation' ? 'expectation-overdue' : 'waiting-overdue', severity: 'notable', evidenceKey, reasonCodes: ['temporal.waiting-overdue'], observedDurationMs: at - wait.startedAt, thresholdMs: wait.expectedAt - wait.startedAt, relatedGoalIds: wait.sourceType === 'goal' ? [wait.sourceId] : [], conditionId: wait.waitId, metadata: { waitId: wait.waitId, sourceType: wait.sourceType, sourceId: wait.sourceId } }), { irritation: 0.04, boredom: 0.04 }, 0.58)
    lived = normalizeTemporalTrackingState(engine.lived)
    lived.waitingStates = lived.waitingStates.map(item => item.waitId === wait.waitId ? { ...item, crossedThresholdIds: unique([...item.crossedThresholdIds, thresholdId], 12) } : item)
    engine = { ...engine, lived }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  for (const goal of input.goals) {
    if (goal.status !== 'active')
      continue
    const raw = goal.metadata.metabolism as { deadlineAt?: unknown } | undefined
    const deadlineAt = finite(raw?.deadlineAt, -1)
    if (deadlineAt <= 0)
      continue
    const thresholdId = at >= deadlineAt ? 'passed' : 'approach'
    if (thresholdId === 'approach' && deadlineAt - at > 60 * 60_000)
      continue
    const marker = `${goal.goalId}:${deadlineAt}:${thresholdId}`
    if (lived.crossedGoalDeadlineKeys.includes(marker))
      continue
    append(temporalEvent({
      createId: input.createId,
      at,
      type: thresholdId === 'passed' ? 'goal-deadline-passed' : 'goal-deadline-approach',
      severity: thresholdId === 'passed' ? 'significant' : 'notable',
      evidenceKey: `goal-deadline:${marker}`,
      reasonCodes: [`temporal.goal-deadline-${thresholdId}`],
      observedDurationMs: Math.max(0, at - goal.createdAt),
      thresholdMs: Math.max(0, deadlineAt - goal.createdAt),
      relatedGoalIds: [goal.goalId],
      conditionId: `goal-deadline:${goal.goalId}:${deadlineAt}`,
      metadata: { goalId: goal.goalId, deadlineAt, thresholdId },
    }), thresholdId === 'passed' ? { irritation: 0.06, fear: 0.04 } : { curiosity: 0.03 }, thresholdId === 'passed' ? 0.76 : 0.58)
    lived = normalizeTemporalTrackingState(engine.lived)
    lived.crossedGoalDeadlineKeys = unique([...lived.crossedGoalDeadlineKeys, marker], 64)
    engine = { ...engine, lived }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  const lastInput = lived.lastExternalInputAt
  if (lastInput != null) {
    const objective = Math.max(0, at - lastInput)
    const waiting = lived.waitingStates.some(item => item.status === 'active') || lived.trackedPromises.some(item => item.status === 'active')
    const livedDuration = computeLivedDuration({ objectiveDurationMs: objective, emotionalState: input.emotionalState, focused: input.focused, waiting })
    for (const threshold of IDLE_THRESHOLDS) {
      if (objective < threshold.durationMs || lived.crossedIdleThresholdIds.includes(threshold.id))
        continue
      const evidenceKey = `idle:${lastInput}:${threshold.id}`
      append(temporalEvent({ createId: input.createId, at, type: 'idle-deepening', severity: threshold.severity, evidenceKey, reasonCodes: ['temporal.idle-deepening', `temporal.idle.${threshold.id}`], observedDurationMs: objective, thresholdMs: threshold.durationMs, metadata: { lastExternalInputAt: lastInput, livedDurationMs: livedDuration } }), threshold.impact, threshold.severity === 'significant' ? 0.66 : 0.42)
      lived = normalizeTemporalTrackingState(engine.lived)
      lived.crossedIdleThresholdIds = unique([...lived.crossedIdleThresholdIds, threshold.id], 12)
      engine = { ...engine, lived }
    }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  for (const milestone of MILESTONES) {
    if (at - input.kernelCreatedAt < milestone.durationMs || lived.crossedMilestoneIds.includes(milestone.id))
      continue
    const evidenceKey = `milestone:${input.kernelCreatedAt}:${milestone.id}`
    append(temporalEvent({ createId: input.createId, at, type: 'milestone-passed', severity: milestone.durationMs >= 7 * DAY_MS ? 'notable' : 'informational', evidenceKey, reasonCodes: ['temporal.milestone-passed'], observedDurationMs: at - input.kernelCreatedAt, thresholdMs: milestone.durationMs, metadata: { milestoneId: milestone.id, kernelCreatedAt: input.kernelCreatedAt } }), { pride: 0.03, curiosity: 0.02 }, 0.4)
    lived = normalizeTemporalTrackingState(engine.lived)
    lived.crossedMilestoneIds = unique([...lived.crossedMilestoneIds, milestone.id], 12)
    engine = { ...engine, lived }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  for (const rhythm of lived.detectedRhythms) {
    if (rhythm.isActive && !rhythm.announced) {
      const evidenceKey = `rhythm-detected:${rhythm.rhythmId}:${rhythm.evidenceEventIds.length}`
      append(temporalEvent({ createId: input.createId, at, type: 'rhythm-detected', severity: 'notable', subjectActorId: rhythm.actorId, evidenceKey, reasonCodes: ['temporal.rhythm-detected'], metadata: { rhythmId: rhythm.rhythmId, typicalHour: rhythm.typicalHour, evidenceCount: rhythm.evidenceEventIds.length } }), { curiosity: 0.05, attachment: 0.03 }, 0.52)
      lived = normalizeTemporalTrackingState(engine.lived)
      lived.detectedRhythms = lived.detectedRhythms.map(item => item.rhythmId === rhythm.rhythmId ? { ...item, announced: true } : item)
      engine = { ...engine, lived }
    }
    const updatedRhythm = normalizeTemporalTrackingState(engine.lived).detectedRhythms.find(item => item.rhythmId === rhythm.rhythmId)
    if (!updatedRhythm?.isActive || at < updatedRhythm.expectedNextAt + 6 * 60 * 60_000)
      continue
    const missed = Math.max(updatedRhythm.missedOccurrences + 1, Math.floor((at - updatedRhythm.expectedNextAt) / DAY_MS) + 1)
    lived = normalizeTemporalTrackingState(engine.lived)
    lived.detectedRhythms = lived.detectedRhythms.map(item => item.rhythmId === rhythm.rhythmId ? { ...item, missedOccurrences: missed, expectedNextAt: item.expectedNextAt + Math.max(1, missed - item.missedOccurrences) * DAY_MS } : item)
    engine = { ...engine, lived }
    if (missed >= 2 && !updatedRhythm.brokenEventEmitted) {
      const evidenceKey = `rhythm-broken:${rhythm.rhythmId}:${updatedRhythm.lastOccurrenceAt}`
      append(temporalEvent({ createId: input.createId, at, type: 'rhythm-broken', severity: 'notable', subjectActorId: rhythm.actorId, evidenceKey, reasonCodes: ['temporal.rhythm-broken'], observedDurationMs: at - updatedRhythm.lastOccurrenceAt, thresholdMs: 2 * DAY_MS, metadata: { rhythmId: rhythm.rhythmId, missedOccurrences: missed } }), { suspicion: 0.04, attachment: 0.03 }, 0.57)
      lived = normalizeTemporalTrackingState(engine.lived)
      lived.detectedRhythms = lived.detectedRhythms.map(item => item.rhythmId === rhythm.rhythmId ? { ...item, isActive: false, brokenEventEmitted: true } : item)
      engine = { ...engine, lived }
    }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  if (lived.lastReflectionAt == null || at - lived.lastReflectionAt >= 6 * 60 * 60_000) {
    const anchor = lived.lastReflectionAt ?? input.kernelCreatedAt
    const evidenceKey = `reflection:${anchor}`
    append(temporalEvent({ createId: input.createId, at, type: 'self-reflection-time', severity: 'informational', evidenceKey, reasonCodes: ['temporal.self-reflection-time'], observedDurationMs: at - anchor, thresholdMs: 6 * 60 * 60_000 }), { curiosity: 0.02 }, 0.3)
    lived = normalizeTemporalTrackingState(engine.lived)
    engine = { ...engine, lived: { ...lived, lastReflectionAt: at } }
  }

  lived = normalizeTemporalTrackingState(engine.lived)
  engine = { ...engine, revision: engine.revision + 1, lastEvaluationAt: at, lived: { ...lived, revision: lived.revision + 1, lastRhythmCheckAt: at } }
  const future = [
    ...(lived.lastExternalInputAt == null ? [] : IDLE_THRESHOLDS.filter(item => !lived.crossedIdleThresholdIds.includes(item.id)).map(item => lived.lastExternalInputAt! + item.durationMs)),
    ...lived.trackedPromises.filter(item => item.status === 'active').map(item => item.crossedThresholdIds.includes('overdue') ? promiseBreakAt(item) : item.dueAt),
    ...lived.waitingStates.filter(item => item.status === 'active').map(item => item.expectedAt),
    ...lived.detectedRhythms.filter(item => item.isActive).map(item => item.expectedNextAt + 6 * 60 * 60_000),
    ...MILESTONES.filter(item => !lived.crossedMilestoneIds.includes(item.id)).map(item => input.kernelCreatedAt + item.durationMs),
    (lived.lastReflectionAt ?? at) + 6 * 60 * 60_000,
  ].filter(value => value > at)
  return { engine, created, nextEvaluationAt: future.length ? Math.min(...future) : null }
}

export function markTemporalEmotionApplied(engine: Nan0TemporalEngineState, evidenceKey: string): Nan0TemporalEngineState {
  const lived = normalizeTemporalTrackingState(engine.lived)
  if (lived.emotionallyAppliedEvidenceKeys.includes(evidenceKey))
    return engine
  return { ...engine, revision: engine.revision + 1, lived: { ...lived, revision: lived.revision + 1, emotionallyAppliedEvidenceKeys: unique([...lived.emotionallyAppliedEvidenceKeys, evidenceKey]) } }
}

export function composeLivedTemporalContext(engine: Readonly<Nan0TemporalEngineState>, at: number): string {
  const lived = normalizeTemporalTrackingState(engine.lived)
  return JSON.stringify({
    provider: 'nan0_lived_temporal',
    factsOnly: true,
    activeWaits: lived.waitingStates.filter(item => item.status === 'active').slice(-5),
    activePromises: lived.trackedPromises.filter(item => item.status === 'active').slice(-5),
    rhythms: lived.detectedRhythms.filter(item => item.isActive).slice(-3),
    recentAbsences: lived.absenceHistory.slice(-3),
    sinceExternalInputMs: lived.lastExternalInputAt == null ? null : Math.max(0, at - lived.lastExternalInputAt),
    recentEvents: engine.events.slice(-6).map(event => ({ type: event.eventType, evidenceKey: event.evidenceKey, at: event.createdAt, significance: event.significance })),
  })
}
