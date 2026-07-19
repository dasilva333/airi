import type {
  Nan0Clock,
  Nan0ClockAdjustment,
  Nan0TemporalCondition,
  Nan0TemporalPhase,
  Nan0TemporalState,
} from '../types'

import { createEmptyTemporalEngineState, mergeTemporalEngineStates, normalizeTemporalEngineState } from './Nan0TemporalEngine'

export const DEFAULT_CLOCK_DISCONTINUITY_THRESHOLD_MS = 5_000

type TemporalObservationKind = 'boot' | 'resume' | 'suspend' | 'observe' | 'shutdown'
type TemporalActivityKind = 'kyo-interaction' | 'nan0-thought' | 'nan0-expression' | 'nan0-action' | 'nan0-sleep' | 'nan0-wake'

function maxNullable(left: number | null | undefined, right: number | null | undefined): number | null {
  if (left == null)
    return right ?? null
  if (right == null)
    return left
  return Math.max(left, right)
}

function conditionStatusRank(status: Nan0TemporalCondition['status']): number {
  switch (status) {
    case 'satisfied':
    case 'cancelled':
      return 3
    case 'eligible':
      return 2
    case 'pending':
      return 1
  }
}

function nextEvaluationAt(conditions: readonly Nan0TemporalCondition[]): number | null {
  const pending = conditions.filter(condition => condition.status === 'pending')
  return pending.length ? Math.min(...pending.map(condition => condition.dueAt)) : null
}

export function createEmptyTemporalState(clock: Nan0Clock, at = clock.utcNow()): Nan0TemporalState {
  return {
    schemaVersion: 1,
    revision: 0,
    lastObservedWallTime: at,
    lastObservedMonotonicTime: clock.monotonicNow(),
    lastBootAt: null,
    lastShutdownAt: null,
    lastResumeAt: null,
    timezone: clock.timezone(),
    timezoneOffset: clock.timezoneOffsetMinutes(at),
    clockSource: clock.source,
    clockConfidence: clock.confidence,
    detectedClockAdjustments: [],
    lastKyoInteractionAt: null,
    lastNan0ThoughtAt: null,
    lastNan0ExpressionAt: null,
    lastNan0ActionAt: null,
    lastNan0SleepAt: null,
    lastNan0WakeAt: null,
    currentPhase: 'unknown',
    nextEvaluationAt: null,
    conditions: [],
    engine: createEmptyTemporalEngineState(),
    metadata: {},
  }
}

export function normalizeTemporalState(
  value: Partial<Nan0TemporalState> | null | undefined,
  clock: Nan0Clock,
  fallbackAt: number,
): Nan0TemporalState {
  const base = createEmptyTemporalState(clock, fallbackAt)
  const adjustmentById = new Map<string, Nan0ClockAdjustment>()
  for (const adjustment of value?.detectedClockAdjustments ?? []) {
    if (adjustment?.adjustmentId)
      adjustmentById.set(adjustment.adjustmentId, { ...adjustment, schemaVersion: 1 })
  }
  const conditionById = new Map<string, Nan0TemporalCondition>()
  for (const condition of value?.conditions ?? []) {
    if (condition?.conditionId)
      conditionById.set(condition.conditionId, { ...condition, schemaVersion: 1 })
  }
  const conditions = [...conditionById.values()]
    .sort((a, b) => a.dueAt - b.dueAt || a.conditionId.localeCompare(b.conditionId))
  const engine = normalizeTemporalEngineState(value?.engine)
  const conditionNextEvaluationAt = nextEvaluationAt(conditions)
  return {
    ...base,
    ...value,
    schemaVersion: 1,
    revision: Math.max(0, value?.revision ?? 0),
    lastObservedWallTime: value?.lastObservedWallTime ?? fallbackAt,
    lastObservedMonotonicTime: value?.lastObservedMonotonicTime ?? 0,
    detectedClockAdjustments: [...adjustmentById.values()]
      .sort((a, b) => a.detectedAt - b.detectedAt || a.adjustmentId.localeCompare(b.adjustmentId)),
    conditions,
    engine,
    nextEvaluationAt: [conditionNextEvaluationAt, engine.nextEvaluationAt]
      .filter((candidate): candidate is number => candidate != null)
      .reduce<number | null>((minimum, candidate) => minimum == null ? candidate : Math.min(minimum, candidate), null),
    metadata: { ...value?.metadata },
  }
}

export function mergeTemporalStates(
  persisted: Nan0TemporalState | null | undefined,
  candidate: Nan0TemporalState | null | undefined,
  clock: Nan0Clock,
  fallbackAt: number,
): Nan0TemporalState {
  const left = normalizeTemporalState(persisted, clock, fallbackAt)
  const right = normalizeTemporalState(candidate, clock, fallbackAt)
  if (!persisted)
    return right
  if (!candidate)
    return left
  const primary = right.revision > left.revision ? right : left
  const secondary = primary === right ? left : right

  const adjustmentById = new Map<string, Nan0ClockAdjustment>()
  for (const adjustment of [...secondary.detectedClockAdjustments, ...primary.detectedClockAdjustments])
    adjustmentById.set(adjustment.adjustmentId, structuredClone(adjustment))

  const conditionById = new Map<string, Nan0TemporalCondition>()
  for (const condition of [...secondary.conditions, ...primary.conditions]) {
    const current = conditionById.get(condition.conditionId)
    if (!current
      || conditionStatusRank(condition.status) > conditionStatusRank(current.status)
      || condition.status === current.status) {
      conditionById.set(condition.conditionId, structuredClone(condition))
    }
  }
  const conditions = [...conditionById.values()]
    .sort((a, b) => a.dueAt - b.dueAt || a.conditionId.localeCompare(b.conditionId))
  const engine = mergeTemporalEngineStates(left.engine, right.engine)
  const conditionNextEvaluationAt = nextEvaluationAt(conditions)

  return {
    ...primary,
    revision: Math.max(left.revision, right.revision),
    lastBootAt: maxNullable(left.lastBootAt, right.lastBootAt),
    lastShutdownAt: maxNullable(left.lastShutdownAt, right.lastShutdownAt),
    lastResumeAt: maxNullable(left.lastResumeAt, right.lastResumeAt),
    lastKyoInteractionAt: maxNullable(left.lastKyoInteractionAt, right.lastKyoInteractionAt),
    lastNan0ThoughtAt: maxNullable(left.lastNan0ThoughtAt, right.lastNan0ThoughtAt),
    lastNan0ExpressionAt: maxNullable(left.lastNan0ExpressionAt, right.lastNan0ExpressionAt),
    lastNan0ActionAt: maxNullable(left.lastNan0ActionAt, right.lastNan0ActionAt),
    lastNan0SleepAt: maxNullable(left.lastNan0SleepAt, right.lastNan0SleepAt),
    lastNan0WakeAt: maxNullable(left.lastNan0WakeAt, right.lastNan0WakeAt),
    detectedClockAdjustments: [...adjustmentById.values()]
      .sort((a, b) => a.detectedAt - b.detectedAt || a.adjustmentId.localeCompare(b.adjustmentId)),
    conditions,
    engine,
    nextEvaluationAt: [conditionNextEvaluationAt, engine.nextEvaluationAt]
      .filter((candidate): candidate is number => candidate != null)
      .reduce<number | null>((minimum, candidate) => minimum == null ? candidate : Math.min(minimum, candidate), null),
    metadata: { ...secondary.metadata, ...primary.metadata },
  }
}

export function observeTemporalClock(
  state: Nan0TemporalState,
  input: {
    clock: Nan0Clock
    kind: TemporalObservationKind
    processId: string
    createAdjustmentId: () => string
    thresholdMs?: number
  },
): Nan0TemporalState {
  const now = input.clock.utcNow()
  const monotonic = input.clock.monotonicNow()
  const timezone = input.clock.timezone()
  const timezoneOffset = input.clock.timezoneOffsetMinutes(now)
  const threshold = input.thresholdMs ?? DEFAULT_CLOCK_DISCONTINUITY_THRESHOLD_MS
  const previousProcessId = typeof state.metadata.monotonicProcessId === 'string'
    ? state.metadata.monotonicProcessId
    : null
  const sameProcess = previousProcessId === input.processId
  const expectedWallTime = sameProcess
    ? state.lastObservedWallTime + Math.max(0, monotonic - state.lastObservedMonotonicTime)
    : null
  const adjustments = [...state.detectedClockAdjustments]

  const record = (
    kind: Nan0ClockAdjustment['kind'],
    deltaMs: number,
    confidence: number,
    metadata: Record<string, unknown> = {},
  ) => adjustments.push({
    schemaVersion: 1,
    adjustmentId: input.createAdjustmentId(),
    kind,
    detectedAt: now,
    previousWallTime: state.lastObservedWallTime,
    observedWallTime: now,
    expectedWallTime,
    deltaMs,
    previousTimezone: state.timezone,
    observedTimezone: timezone,
    clockSource: input.clock.source,
    confidence,
    metadata,
  })

  if (expectedWallTime != null) {
    const drift = now - expectedWallTime
    if (drift < -threshold)
      record('wall-clock-backward', drift, input.clock.confidence, { observationKind: input.kind })
    else if (drift > threshold)
      record('wall-clock-forward', drift, input.clock.confidence, { observationKind: input.kind })
  }
  else if (now < state.lastObservedWallTime - threshold) {
    record('wall-clock-backward', now - state.lastObservedWallTime, input.clock.confidence, { observationKind: input.kind, acrossProcess: true })
  }
  else if (input.kind === 'boot' && state.currentPhase === 'running' && state.lastShutdownAt == null
    && now > state.lastObservedWallTime + threshold) {
    record('unclean-process-gap', now - state.lastObservedWallTime, Math.min(input.clock.confidence, 0.5), { acrossProcess: true })
  }

  if (state.timezone !== timezone)
    record('timezone-change', 0, input.clock.confidence, { previousTimezone: state.timezone, timezone })
  if (state.timezoneOffset !== timezoneOffset)
    record('timezone-offset-change', timezoneOffset - state.timezoneOffset, input.clock.confidence, { previousOffset: state.timezoneOffset, timezoneOffset })

  let phase: Nan0TemporalPhase = state.currentPhase
  let lastBootAt = state.lastBootAt
  let lastShutdownAt = state.lastShutdownAt
  let lastResumeAt = state.lastResumeAt
  if (input.kind === 'boot') {
    phase = 'running'
    lastBootAt = now
    lastResumeAt = now
  }
  else if (input.kind === 'resume') {
    phase = 'running'
    lastResumeAt = now
  }
  else if (input.kind === 'suspend') {
    phase = 'suspended'
  }
  else if (input.kind === 'shutdown') {
    phase = 'stopped'
    lastShutdownAt = now
  }

  return {
    ...state,
    revision: state.revision + 1,
    lastObservedWallTime: now,
    lastObservedMonotonicTime: monotonic,
    lastBootAt,
    lastShutdownAt,
    lastResumeAt,
    timezone,
    timezoneOffset,
    clockSource: input.clock.source,
    clockConfidence: input.clock.confidence,
    detectedClockAdjustments: adjustments,
    currentPhase: phase,
    metadata: {
      ...state.metadata,
      monotonicProcessId: input.processId,
      lastObservationKind: input.kind,
    },
  }
}

export function recordTemporalActivity(
  state: Nan0TemporalState,
  input: {
    clock: Nan0Clock
    activity: TemporalActivityKind
    processId: string
    createAdjustmentId: () => string
    at?: number
  },
): Nan0TemporalState {
  const observed = observeTemporalClock(state, { ...input, kind: 'observe' })
  const at = input.at ?? observed.lastObservedWallTime
  switch (input.activity) {
    case 'kyo-interaction':
      return { ...observed, lastKyoInteractionAt: at }
    case 'nan0-thought':
      return { ...observed, lastNan0ThoughtAt: at }
    case 'nan0-expression':
      return { ...observed, lastNan0ExpressionAt: at }
    case 'nan0-action':
      return { ...observed, lastNan0ActionAt: at }
    case 'nan0-sleep':
      return { ...observed, lastNan0SleepAt: at }
    case 'nan0-wake':
      return { ...observed, lastNan0WakeAt: at }
  }
}

export function registerTemporalCondition(
  state: Nan0TemporalState,
  condition: Nan0TemporalCondition,
): Nan0TemporalState {
  const existing = state.conditions.find(item => item.conditionId === condition.conditionId)
  const replacement = existing && conditionStatusRank(existing.status) > conditionStatusRank(condition.status)
    ? existing
    : condition
  const conditions = existing
    ? state.conditions.map(item => item.conditionId === condition.conditionId ? structuredClone(replacement) : item)
    : [...state.conditions, structuredClone(replacement)]
  conditions.sort((a, b) => a.dueAt - b.dueAt || a.conditionId.localeCompare(b.conditionId))
  return {
    ...state,
    revision: state.revision + 1,
    conditions,
    nextEvaluationAt: [nextEvaluationAt(conditions), state.engine.nextEvaluationAt]
      .filter((candidate): candidate is number => candidate != null)
      .reduce<number | null>((minimum, candidate) => minimum == null ? candidate : Math.min(minimum, candidate), null),
  }
}

export function evaluateTemporalConditions(
  state: Nan0TemporalState,
  input: {
    clock: Nan0Clock
    processId: string
    createAdjustmentId: () => string
    limit?: number
    allowEligibility?: boolean
  },
): { temporal: Nan0TemporalState, eligible: Nan0TemporalCondition[] } {
  const observed = observeTemporalClock(state, { ...input, kind: 'observe' })
  const now = observed.lastObservedWallTime
  const limit = Math.max(1, Math.min(20, input.limit ?? 5))
  const dueIds = new Set(observed.conditions
    .filter(condition => input.allowEligibility !== false && condition.status === 'pending' && condition.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.conditionId.localeCompare(b.conditionId))
    .slice(0, limit)
    .map(condition => condition.conditionId))
  const conditions = observed.conditions.map((condition) => {
    if (dueIds.has(condition.conditionId)) {
      return {
        ...condition,
        status: 'eligible' as const,
        eligibleAt: now,
        lastEvaluatedAt: now,
      }
    }
    if (condition.status === 'pending')
      return { ...condition, lastEvaluatedAt: now }
    return condition
  })
  const temporal = {
    ...observed,
    revision: observed.revision + 1,
    conditions,
    nextEvaluationAt: [nextEvaluationAt(conditions), observed.engine.nextEvaluationAt]
      .filter((candidate): candidate is number => candidate != null)
      .reduce<number | null>((minimum, candidate) => minimum == null ? candidate : Math.min(minimum, candidate), null),
  }
  return {
    temporal,
    eligible: conditions.filter(condition => dueIds.has(condition.conditionId)).map(condition => structuredClone(condition)),
  }
}

export function persistedElapsedMs(clock: Nan0Clock, startedAt: number, endedAt = clock.utcNow()): number {
  return Math.max(0, clock.elapsedWall(startedAt, endedAt))
}
