import type {
  Nan0Clock,
  Nan0ConversationThread,
  Nan0Goal,
  Nan0LocalPhase,
  Nan0PendingIntention,
  Nan0RelationshipRecord,
  Nan0TemporalAbsenceThreshold,
  Nan0TemporalEngineConfiguration,
  Nan0TemporalEngineState,
  Nan0TemporalEvent,
  Nan0TemporalEventSeverity,
  Nan0TemporalEventStatus,
  Nan0TemporalPhaseDefinition,
  Nan0TemporalState,
} from '../types'

import {
  createEmptyTemporalTrackingState,
  mergeTemporalTrackingStates,
  normalizeTemporalTrackingState,
} from './Nan0TemporalEventGenerator'

const DAY_MS = 86_400_000

export const DEFAULT_TEMPORAL_PHASES: readonly Nan0TemporalPhaseDefinition[] = [
  { phase: 'late-night', startHour: 0 },
  { phase: 'morning', startHour: 5 },
  { phase: 'daytime', startHour: 12 },
  { phase: 'evening', startHour: 17 },
  { phase: 'night', startHour: 21 },
]

export const DEFAULT_ABSENCE_THRESHOLDS: readonly Nan0TemporalAbsenceThreshold[] = [
  { thresholdId: 'brief', durationMs: 30 * 60_000, severity: 'informational', minimumSignificance: 0.35 },
  { thresholdId: 'notable', durationMs: 4 * 60 * 60_000, severity: 'notable', minimumSignificance: 0.6 },
  { thresholdId: 'extended', durationMs: 24 * 60 * 60_000, severity: 'significant', minimumSignificance: 0.75 },
]

export interface ResolvedTemporalEngineConfiguration {
  phases: readonly Nan0TemporalPhaseDefinition[]
  absenceThresholds: readonly Nan0TemporalAbsenceThreshold[]
  meaningfulShutdownGapMs: number
  continuityLingeringMs: number
  goalStalledMs: number
  intentionOverdueMs: number
  minimumObservationSignificance: number
  minimumTrustedClockConfidence: number
  maxConditionsPerEvaluation: number
  maxObservationsPerEvaluation: number
}

export interface Nan0TemporalEvidenceContext {
  goals: readonly Nan0Goal[]
  intentions: readonly Nan0PendingIntention[]
  continuityThreads: readonly Nan0ConversationThread[]
  relationships: readonly Nan0RelationshipRecord[]
}

export interface Nan0TemporalEvidenceEvaluation {
  temporal: Nan0TemporalState
  created: Nan0TemporalEvent[]
  eligible: Nan0TemporalEvent[]
  clockTrusted: boolean
  blockingAdjustmentId: string | null
  nextEvaluationAt: number | null
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function finiteNonNegative(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function eventStatusRank(status: Nan0TemporalEventStatus): number {
  switch (status) {
    case 'handled':
    case 'suppressed':
      return 4
    case 'evaluating':
      return 3
    case 'eligible':
      return 2
    case 'recorded':
      return 1
  }
}

function severityWeight(severity: Nan0TemporalEventSeverity): number {
  switch (severity) {
    case 'critical': return 0.85
    case 'significant': return 0.68
    case 'notable': return 0.5
    case 'informational': return 0.25
  }
}

export function resolveTemporalEngineConfiguration(
  input: Nan0TemporalEngineConfiguration | undefined,
): ResolvedTemporalEngineConfiguration {
  const phases = [...(input?.phases?.length ? input.phases : DEFAULT_TEMPORAL_PHASES)]
    .map(item => ({ phase: item.phase, startHour: Math.max(0, Math.min(23, Math.floor(item.startHour))) }))
    .sort((a, b) => a.startHour - b.startHour || a.phase.localeCompare(b.phase))
  const absenceThresholds = [...(input?.absenceThresholds?.length ? input.absenceThresholds : DEFAULT_ABSENCE_THRESHOLDS)]
    .map(item => ({
      ...item,
      durationMs: finiteNonNegative(item.durationMs, 0),
      minimumSignificance: clamp(item.minimumSignificance),
    }))
    .sort((a, b) => a.durationMs - b.durationMs || a.thresholdId.localeCompare(b.thresholdId))
  return {
    phases,
    absenceThresholds,
    meaningfulShutdownGapMs: finiteNonNegative(input?.meaningfulShutdownGapMs, 60_000),
    continuityLingeringMs: finiteNonNegative(input?.continuityLingeringMs, 3 * DAY_MS),
    goalStalledMs: finiteNonNegative(input?.goalStalledMs, 7 * DAY_MS),
    intentionOverdueMs: finiteNonNegative(input?.intentionOverdueMs, 15 * 60_000),
    minimumObservationSignificance: clamp(input?.minimumObservationSignificance ?? 0.65),
    minimumTrustedClockConfidence: clamp(input?.minimumTrustedClockConfidence ?? 0.7),
    maxConditionsPerEvaluation: Math.max(1, Math.min(20, Math.floor(input?.maxConditionsPerEvaluation ?? 5))),
    maxObservationsPerEvaluation: Math.max(1, Math.min(2, Math.floor(input?.maxObservationsPerEvaluation ?? 2))),
  }
}

export function createEmptyTemporalEngineState(): Nan0TemporalEngineState {
  return {
    schemaVersion: 1,
    revision: 0,
    initializedAt: null,
    localPhase: null,
    lastPhaseEvidenceKey: null,
    lastEvaluationAt: null,
    nextEvaluationAt: null,
    absence: { intervalId: null, startedAt: null, crossedThresholdIds: [] },
    sleep: {
      status: 'awake',
      sleepId: null,
      startedAt: null,
      expectedWakeAt: null,
      maximumWakeAt: null,
      wakeConditionId: null,
      metadata: {},
    },
    lived: createEmptyTemporalTrackingState(),
    events: [],
    metadata: {},
  }
}

function normalizeEvent(event: Partial<Nan0TemporalEvent>): Nan0TemporalEvent | null {
  if (!event.temporalEventId || !event.eventType || !event.evidenceKey)
    return null
  return {
    schemaVersion: 1,
    temporalEventId: event.temporalEventId,
    createdAt: finiteNonNegative(event.createdAt, 0),
    eventType: event.eventType,
    source: event.source ?? 'temporal-engine',
    severity: event.severity ?? 'informational',
    subjectActorId: event.subjectActorId ?? null,
    relatedEventIds: unique(event.relatedEventIds ?? []),
    relatedTurnIds: unique(event.relatedTurnIds ?? []),
    relatedThoughtIds: unique(event.relatedThoughtIds ?? []),
    relatedGoalIds: unique(event.relatedGoalIds ?? []),
    relatedIntentionIds: unique(event.relatedIntentionIds ?? []),
    relatedRelationshipIds: unique(event.relatedRelationshipIds ?? []),
    conditionId: event.conditionId ?? null,
    observedDurationMs: event.observedDurationMs == null ? null : finiteNonNegative(event.observedDurationMs, 0),
    thresholdMs: event.thresholdMs == null ? null : finiteNonNegative(event.thresholdMs, 0),
    phase: event.phase ?? null,
    confidence: clamp(event.confidence ?? 0),
    significance: clamp(event.significance ?? 0),
    status: event.status ?? 'recorded',
    reasonCodes: unique(event.reasonCodes ?? []),
    evidenceKey: event.evidenceKey,
    evaluationCount: Math.max(0, Math.floor(event.evaluationCount ?? 0)),
    handledAt: event.handledAt ?? null,
    observationId: event.observationId ?? null,
    thoughtId: event.thoughtId ?? null,
    decisionId: event.decisionId ?? null,
    metadata: { ...event.metadata },
  }
}

export function normalizeTemporalEngineState(
  value: Partial<Nan0TemporalEngineState> | null | undefined,
): Nan0TemporalEngineState {
  const base = createEmptyTemporalEngineState()
  const byEvidence = new Map<string, Nan0TemporalEvent>()
  for (const candidate of value?.events ?? []) {
    const event = normalizeEvent(candidate)
    if (event)
      byEvidence.set(event.evidenceKey, event)
  }
  return {
    ...base,
    ...value,
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(value?.revision ?? 0)),
    absence: {
      ...base.absence,
      ...value?.absence,
      crossedThresholdIds: unique(value?.absence?.crossedThresholdIds ?? []),
    },
    sleep: {
      ...base.sleep,
      ...value?.sleep,
      metadata: { ...value?.sleep?.metadata },
    },
    lived: normalizeTemporalTrackingState(value?.lived),
    events: [...byEvidence.values()].sort((a, b) => a.createdAt - b.createdAt || a.temporalEventId.localeCompare(b.temporalEventId)).slice(-320),
    metadata: { ...value?.metadata },
  }
}

function mergeEvent(left: Nan0TemporalEvent, right: Nan0TemporalEvent): Nan0TemporalEvent {
  const primary = eventStatusRank(right.status) >= eventStatusRank(left.status) ? right : left
  const secondary = primary === right ? left : right
  return {
    ...secondary,
    ...primary,
    relatedEventIds: unique([...left.relatedEventIds, ...right.relatedEventIds]),
    relatedTurnIds: unique([...left.relatedTurnIds, ...right.relatedTurnIds]),
    relatedThoughtIds: unique([...left.relatedThoughtIds, ...right.relatedThoughtIds]),
    relatedGoalIds: unique([...left.relatedGoalIds, ...right.relatedGoalIds]),
    relatedIntentionIds: unique([...left.relatedIntentionIds, ...right.relatedIntentionIds]),
    relatedRelationshipIds: unique([...left.relatedRelationshipIds, ...right.relatedRelationshipIds]),
    reasonCodes: unique([...left.reasonCodes, ...right.reasonCodes]),
    significance: Math.max(left.significance, right.significance),
    confidence: Math.max(left.confidence, right.confidence),
    evaluationCount: Math.max(left.evaluationCount, right.evaluationCount),
    handledAt: Math.max(left.handledAt ?? 0, right.handledAt ?? 0) || null,
    metadata: { ...secondary.metadata, ...primary.metadata },
  }
}

export function mergeTemporalEngineStates(
  persisted: Partial<Nan0TemporalEngineState> | null | undefined,
  candidate: Partial<Nan0TemporalEngineState> | null | undefined,
): Nan0TemporalEngineState {
  const left = normalizeTemporalEngineState(persisted)
  const right = normalizeTemporalEngineState(candidate)
  const primary = right.revision > left.revision ? right : left
  const secondary = primary === right ? left : right
  const byEvidence = new Map(left.events.map(event => [event.evidenceKey, event]))
  for (const event of right.events) {
    const existing = byEvidence.get(event.evidenceKey)
    byEvidence.set(event.evidenceKey, existing ? mergeEvent(existing, event) : event)
  }
  const absence = primary.absence.intervalId === secondary.absence.intervalId
    ? { ...primary.absence, crossedThresholdIds: unique([...secondary.absence.crossedThresholdIds, ...primary.absence.crossedThresholdIds]) }
    : (primary.absence.startedAt ?? 0) >= (secondary.absence.startedAt ?? 0) ? primary.absence : secondary.absence
  return {
    ...secondary,
    ...primary,
    revision: Math.max(left.revision, right.revision),
    initializedAt: Math.max(left.initializedAt ?? 0, right.initializedAt ?? 0) || null,
    lastEvaluationAt: Math.max(left.lastEvaluationAt ?? 0, right.lastEvaluationAt ?? 0) || null,
    absence: structuredClone(absence),
    lived: mergeTemporalTrackingStates(left.lived, right.lived),
    events: [...byEvidence.values()].sort((a, b) => a.createdAt - b.createdAt || a.temporalEventId.localeCompare(b.temporalEventId)).slice(-320),
    metadata: { ...secondary.metadata, ...primary.metadata },
  }
}

export function localPhaseAt(clock: Nan0Clock, at: number, phases: readonly Nan0TemporalPhaseDefinition[]): Nan0LocalPhase {
  const hour = Number(clock.toLocal(at).localIso.slice(11, 13))
  let selected = phases[0]?.phase ?? 'late-night'
  for (const phase of phases) {
    if (hour >= phase.startHour)
      selected = phase.phase
  }
  return selected
}

function nextPhaseAt(clock: Nan0Clock, at: number, phases: readonly Nan0TemporalPhaseDefinition[]): number {
  const local = clock.toLocal(at)
  const hour = Number(local.localIso.slice(11, 13))
  const minute = Number(local.localIso.slice(14, 16))
  const second = Number(local.localIso.slice(17, 19))
  const elapsedToday = ((hour * 60 + minute) * 60 + second) * 1_000 + (at % 1_000)
  const next = phases.find(phase => phase.startHour * 3_600_000 > elapsedToday)
  return next
    ? at + (next.startHour * 3_600_000 - elapsedToday)
    : at + (DAY_MS - elapsedToday) + (phases[0]?.startHour ?? 0) * 3_600_000
}

export function resetTemporalAbsenceInterval(
  engine: Nan0TemporalEngineState,
  input: { at: number, intervalId: string },
): Nan0TemporalEngineState {
  const normalized = normalizeTemporalEngineState(engine)
  if (normalized.absence.startedAt === input.at)
    return normalized
  return {
    ...normalized,
    revision: normalized.revision + 1,
    absence: { intervalId: input.intervalId, startedAt: input.at, crossedThresholdIds: [] },
  }
}

function eventSignificance(input: {
  severity: Nan0TemporalEventSeverity
  durationMs: number | null
  thresholdMs: number | null
  goalImportance?: number
  intentionPriority?: number
  relationshipImportance?: number
  continuityImportance?: number
  newEvidence: boolean
  recentlyEvaluated: boolean
}): number {
  const ratio = input.durationMs != null && input.thresholdMs != null && input.thresholdMs > 0
    ? Math.min(2, input.durationMs / input.thresholdMs)
    : 1
  return clamp(
    severityWeight(input.severity) * 0.4
    + ratio * 0.12
    + clamp(input.goalImportance ?? 0) * 0.12
    + clamp(input.intentionPriority ?? 0) * 0.12
    + clamp(input.relationshipImportance ?? 0) * 0.1
    + clamp(input.continuityImportance ?? 0) * 0.08
    + (input.newEvidence ? 0.12 : 0)
    - (input.recentlyEvaluated ? 0.25 : 0),
  )
}

function relationshipImportance(context: Nan0TemporalEvidenceContext, relationshipIds: readonly string[]): number {
  return context.relationships
    .filter(item => relationshipIds.includes(item.relationshipId))
    .reduce((maximum, item) => Math.max(maximum, item.importance), 0)
}

function appendEvidenceEvent(
  existing: readonly Nan0TemporalEvent[],
  event: Nan0TemporalEvent,
): { events: Nan0TemporalEvent[], created: boolean } {
  if (existing.some(item => item.evidenceKey === event.evidenceKey))
    return { events: [...existing], created: false }
  return { events: [...existing, event], created: true }
}

function buildEvent(input: Omit<Nan0TemporalEvent, 'schemaVersion' | 'evaluationCount' | 'handledAt' | 'observationId' | 'thoughtId' | 'decisionId'>): Nan0TemporalEvent {
  return {
    ...input,
    schemaVersion: 1,
    evaluationCount: 0,
    handledAt: null,
    observationId: null,
    thoughtId: null,
    decisionId: null,
  }
}

function pendingIntentionDueAt(intention: Nan0PendingIntention): number | null {
  if (intention.dueAt != null)
    return intention.dueAt
  if (intention.trigger.type === 'at-time')
    return intention.trigger.at ?? null
  if (intention.trigger.type === 'after-duration')
    return (intention.trigger.anchorAt ?? 0) + (intention.trigger.durationMs ?? 0)
  return null
}

export function temporalClockEligibility(
  temporal: Nan0TemporalState,
  configuration: Nan0TemporalEngineConfiguration | undefined,
): { trusted: boolean, adjustmentId: string | null } {
  const config = resolveTemporalEngineConfiguration(configuration)
  const latest = [...temporal.detectedClockAdjustments]
    .reverse()
    .find(item => item.kind === 'wall-clock-backward' || item.kind === 'wall-clock-forward')
  if (!latest)
    return { trusted: true, adjustmentId: null }
  return latest.confidence >= config.minimumTrustedClockConfidence
    ? { trusted: true, adjustmentId: null }
    : { trusted: false, adjustmentId: latest.adjustmentId }
}

export function evaluateTemporalEvidence(input: {
  temporal: Nan0TemporalState
  clock: Nan0Clock
  context: Nan0TemporalEvidenceContext
  reason: 'interval' | 'session-resume' | 'turn-complete' | 'state-change' | 'manual'
  createId: () => string
  configuration?: Nan0TemporalEngineConfiguration
}): Nan0TemporalEvidenceEvaluation {
  const config = resolveTemporalEngineConfiguration(input.configuration)
  const now = input.clock.utcNow()
  let engine = normalizeTemporalEngineState(input.temporal.engine)
  const phase = localPhaseAt(input.clock, now, config.phases)
  const firstEvaluation = engine.initializedAt == null
  const created: Nan0TemporalEvent[] = []
  if (firstEvaluation) {
    const absenceStartedAt = input.temporal.lastKyoInteractionAt
    const elapsed = absenceStartedAt == null ? 0 : Math.max(0, now - absenceStartedAt)
    engine = {
      ...engine,
      initializedAt: now,
      localPhase: phase,
      lastPhaseEvidenceKey: `phase-baseline:${phase}:${now}`,
      absence: {
        intervalId: absenceStartedAt == null ? null : `absence-baseline:${absenceStartedAt}`,
        startedAt: absenceStartedAt,
        crossedThresholdIds: config.absenceThresholds.filter(item => item.durationMs <= elapsed).map(item => item.thresholdId),
      },
    }
  }
  else if (engine.localPhase !== phase) {
    const evidenceKey = `phase:${engine.localPhase ?? 'unknown'}:${phase}:${now}`
    const significance = eventSignificance({ severity: 'informational', durationMs: null, thresholdMs: null, newEvidence: true, recentlyEvaluated: false })
    const event = buildEvent({
      temporalEventId: `temporal_${input.createId()}`,
      createdAt: now,
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
      phase,
      confidence: input.clock.confidence,
      significance,
      status: significance >= config.minimumObservationSignificance ? 'eligible' : 'recorded',
      reasonCodes: ['temporal.phase-changed'],
      evidenceKey,
      metadata: { previousPhase: engine.localPhase, localIso: input.clock.toLocal(now).localIso },
    })
    const appended = appendEvidenceEvent(engine.events, event)
    engine = { ...engine, events: appended.events, localPhase: phase, lastPhaseEvidenceKey: evidenceKey }
    if (appended.created)
      created.push(event)
  }

  if (input.temporal.lastKyoInteractionAt != null
    && (engine.absence.startedAt == null || input.temporal.lastKyoInteractionAt > engine.absence.startedAt)) {
    engine = resetTemporalAbsenceInterval(engine, {
      at: input.temporal.lastKyoInteractionAt,
      intervalId: `absence_${input.createId()}`,
    })
  }

  const trust = temporalClockEligibility({ ...input.temporal, engine }, config)
  const append = (event: Nan0TemporalEvent) => {
    const appended = appendEvidenceEvent(engine.events, event)
    engine = { ...engine, events: appended.events }
    if (appended.created)
      created.push(event)
  }

  for (const adjustment of input.temporal.detectedClockAdjustments) {
    const evidenceKey = `clock-adjustment:${adjustment.adjustmentId}`
    append(buildEvent({
      temporalEventId: `temporal_${input.createId()}`,
      createdAt: adjustment.detectedAt,
      eventType: 'clock-adjusted',
      source: 'clock',
      severity: adjustment.kind.startsWith('wall-clock') ? 'significant' : 'notable',
      subjectActorId: null,
      relatedEventIds: [],
      relatedTurnIds: [],
      relatedThoughtIds: [],
      relatedGoalIds: [],
      relatedIntentionIds: [],
      relatedRelationshipIds: [],
      conditionId: null,
      observedDurationMs: Math.abs(adjustment.deltaMs),
      thresholdMs: null,
      phase,
      confidence: adjustment.confidence,
      significance: eventSignificance({ severity: 'notable', durationMs: Math.abs(adjustment.deltaMs), thresholdMs: null, newEvidence: true, recentlyEvaluated: false }),
      status: 'recorded',
      reasonCodes: [`temporal.clock.${adjustment.kind}`],
      evidenceKey,
      metadata: { adjustmentId: adjustment.adjustmentId, trustedForEligibility: trust.trusted },
    }))
  }

  if (input.reason === 'session-resume' && input.temporal.lastResumeAt != null) {
    const evidenceKey = `session-resumed:${input.temporal.lastResumeAt}`
    append(buildEvent({
      temporalEventId: `temporal_${input.createId()}`,
      createdAt: now,
      eventType: 'session-resumed',
      source: 'session',
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
      phase,
      confidence: input.clock.confidence,
      significance: 0.25,
      status: 'recorded',
      reasonCodes: ['temporal.session-resumed'],
      evidenceKey,
      metadata: {},
    }))
    const shutdownAt = input.temporal.lastShutdownAt
    if (shutdownAt != null) {
      const duration = Math.max(0, input.temporal.lastResumeAt - shutdownAt)
      if (duration >= config.meaningfulShutdownGapMs) {
        const shutdownEvidence = `shutdown-gap:${shutdownAt}:${input.temporal.lastResumeAt}`
        const significance = eventSignificance({ severity: 'notable', durationMs: duration, thresholdMs: config.meaningfulShutdownGapMs, newEvidence: true, recentlyEvaluated: false })
        append(buildEvent({
          temporalEventId: `temporal_${input.createId()}`,
          createdAt: now,
          eventType: 'shutdown-gap',
          source: 'session',
          severity: 'notable',
          subjectActorId: 'nan0',
          relatedEventIds: [],
          relatedTurnIds: [],
          relatedThoughtIds: [],
          relatedGoalIds: [],
          relatedIntentionIds: [],
          relatedRelationshipIds: [],
          conditionId: null,
          observedDurationMs: duration,
          thresholdMs: config.meaningfulShutdownGapMs,
          phase,
          confidence: input.clock.confidence,
          significance,
          status: trust.trusted && significance >= config.minimumObservationSignificance ? 'eligible' : 'recorded',
          reasonCodes: ['temporal.shutdown-gap'],
          evidenceKey: shutdownEvidence,
          metadata: { shutdownAt, resumedAt: input.temporal.lastResumeAt },
        }))
      }
    }
  }

  if (trust.trusted && engine.absence.startedAt != null) {
    const duration = Math.max(0, now - engine.absence.startedAt)
    for (const threshold of config.absenceThresholds) {
      if (duration < threshold.durationMs || engine.absence.crossedThresholdIds.includes(threshold.thresholdId))
        continue
      const evidenceKey = `absence:${engine.absence.intervalId}:${threshold.thresholdId}`
      const kyoRelationship = input.context.relationships.find(item => item.actorId === 'kyo')
      const significance = eventSignificance({
        severity: threshold.severity,
        durationMs: duration,
        thresholdMs: threshold.durationMs,
        relationshipImportance: kyoRelationship?.importance,
        newEvidence: true,
        recentlyEvaluated: false,
      })
      append(buildEvent({
        temporalEventId: `temporal_${input.createId()}`,
        createdAt: now,
        eventType: 'absence-threshold',
        source: 'temporal-engine',
        severity: threshold.severity,
        subjectActorId: 'kyo',
        relatedEventIds: [],
        relatedTurnIds: [],
        relatedThoughtIds: [],
        relatedGoalIds: [],
        relatedIntentionIds: [],
        relatedRelationshipIds: kyoRelationship ? [kyoRelationship.relationshipId] : [],
        conditionId: null,
        observedDurationMs: duration,
        thresholdMs: threshold.durationMs,
        phase,
        confidence: input.clock.confidence,
        significance,
        status: significance >= Math.max(config.minimumObservationSignificance, threshold.minimumSignificance) ? 'eligible' : 'recorded',
        reasonCodes: ['temporal.absence-threshold', `temporal.absence.${threshold.thresholdId}`],
        evidenceKey,
        metadata: { absenceIntervalId: engine.absence.intervalId, thresholdId: threshold.thresholdId, startedAt: engine.absence.startedAt },
      }))
      engine = {
        ...engine,
        absence: { ...engine.absence, crossedThresholdIds: unique([...engine.absence.crossedThresholdIds, threshold.thresholdId]) },
      }
    }
  }

  if (trust.trusted) {
    for (const intention of input.context.intentions) {
      if (!['pending', 'deferred', 'eligible'].includes(intention.status))
        continue
      const dueAt = pendingIntentionDueAt(intention)
      if (dueAt == null || now < dueAt + config.intentionOverdueMs)
        continue
      const duration = now - dueAt
      const evidenceKey = `intention-overdue:${intention.intentionId}:${dueAt}`
      append(buildEvent({
        temporalEventId: `temporal_${input.createId()}`,
        createdAt: now,
        eventType: 'intention-overdue',
        source: 'condition',
        severity: 'notable',
        subjectActorId: 'nan0',
        relatedEventIds: [],
        relatedTurnIds: intention.turnId ? [intention.turnId] : [],
        relatedThoughtIds: intention.thoughtId ? [intention.thoughtId] : [],
        relatedGoalIds: intention.goalId ? [intention.goalId] : [],
        relatedIntentionIds: [intention.intentionId],
        relatedRelationshipIds: intention.relationshipIds,
        conditionId: `intention:${intention.intentionId}`,
        observedDurationMs: duration,
        thresholdMs: config.intentionOverdueMs,
        phase,
        confidence: input.clock.confidence,
        significance: eventSignificance({ severity: 'notable', durationMs: duration, thresholdMs: config.intentionOverdueMs, intentionPriority: intention.priority, relationshipImportance: relationshipImportance(input.context, intention.relationshipIds), newEvidence: true, recentlyEvaluated: false }),
        status: 'recorded',
        reasonCodes: ['temporal.intention-overdue'],
        evidenceKey,
        metadata: { dueAt, lifecycleOwner: 'pending-intention' },
      }))
    }

    for (const goal of input.context.goals) {
      if (goal.status !== 'active' || goal.progress >= 1 || now < goal.updatedAt + config.goalStalledMs)
        continue
      const duration = now - goal.updatedAt
      const evidenceKey = `goal-stalled:${goal.goalId}:${goal.updatedAt}`
      const significance = eventSignificance({ severity: 'notable', durationMs: duration, thresholdMs: config.goalStalledMs, goalImportance: goal.importance, relationshipImportance: relationshipImportance(input.context, goal.relationshipIds), newEvidence: true, recentlyEvaluated: false })
      append(buildEvent({
        temporalEventId: `temporal_${input.createId()}`,
        createdAt: now,
        eventType: 'goal-stalled',
        source: 'temporal-engine',
        severity: 'notable',
        subjectActorId: 'nan0',
        relatedEventIds: [],
        relatedTurnIds: goal.supportingTurnIds,
        relatedThoughtIds: goal.supportingThoughtIds,
        relatedGoalIds: [goal.goalId],
        relatedIntentionIds: [],
        relatedRelationshipIds: goal.relationshipIds,
        conditionId: null,
        observedDurationMs: duration,
        thresholdMs: config.goalStalledMs,
        phase,
        confidence: input.clock.confidence,
        significance,
        status: significance >= config.minimumObservationSignificance ? 'eligible' : 'recorded',
        reasonCodes: ['temporal.goal-stalled'],
        evidenceKey,
        metadata: { goalStatus: goal.status, progress: goal.progress, lastProgressAt: goal.updatedAt },
      }))
    }

    for (const thread of input.context.continuityThreads) {
      const unresolved = thread.unresolvedItems.filter(item => item.resolvedAt == null)
      if (!unresolved.length || !['active', 'dormant'].includes(thread.status) || now < thread.lastActiveAt + config.continuityLingeringMs)
        continue
      const duration = now - thread.lastActiveAt
      const evidenceKey = `continuity-lingering:${thread.threadId}:${thread.lastActiveAt}`
      const significance = eventSignificance({ severity: 'notable', durationMs: duration, thresholdMs: config.continuityLingeringMs, continuityImportance: thread.importance, newEvidence: true, recentlyEvaluated: false })
      append(buildEvent({
        temporalEventId: `temporal_${input.createId()}`,
        createdAt: now,
        eventType: 'continuity-lingering',
        source: 'temporal-engine',
        severity: 'notable',
        subjectActorId: 'nan0',
        relatedEventIds: thread.timelineEventIds,
        relatedTurnIds: thread.turnIds,
        relatedThoughtIds: [],
        relatedGoalIds: [],
        relatedIntentionIds: [],
        relatedRelationshipIds: [],
        conditionId: null,
        observedDurationMs: duration,
        thresholdMs: config.continuityLingeringMs,
        phase,
        confidence: input.clock.confidence,
        significance,
        status: significance >= config.minimumObservationSignificance ? 'eligible' : 'recorded',
        reasonCodes: ['temporal.continuity-lingering'],
        evidenceKey,
        metadata: { threadId: thread.threadId, threadStatus: thread.status, unresolvedItemIds: unresolved.map(item => item.itemId) },
      }))
    }
  }

  if (engine.sleep.status === 'sleeping' && engine.sleep.expectedWakeAt != null && now >= engine.sleep.expectedWakeAt) {
    const evidenceKey = `sleep-window-ended:${engine.sleep.sleepId}:${engine.sleep.expectedWakeAt}`
    append(buildEvent({
      temporalEventId: `temporal_${input.createId()}`,
      createdAt: now,
      eventType: 'sleep-window-ended',
      source: 'condition',
      severity: 'notable',
      subjectActorId: 'nan0',
      relatedEventIds: [],
      relatedTurnIds: [],
      relatedThoughtIds: [],
      relatedGoalIds: [],
      relatedIntentionIds: [],
      relatedRelationshipIds: [],
      conditionId: engine.sleep.wakeConditionId,
      observedDurationMs: engine.sleep.startedAt == null ? null : Math.max(0, now - engine.sleep.startedAt),
      thresholdMs: engine.sleep.startedAt == null ? null : Math.max(0, engine.sleep.expectedWakeAt - engine.sleep.startedAt),
      phase,
      confidence: input.clock.confidence,
      significance: 0.5,
      status: 'recorded',
      reasonCodes: ['temporal.sleep.expected-wake-reached'],
      evidenceKey,
      metadata: { compatibilityOnly: true, sleepId: engine.sleep.sleepId },
    }))
  }

  const candidates = engine.events
    .filter(event => event.status === 'eligible' && event.metadata.lifecycleOwner !== 'pending-intention')
    .sort((a, b) => b.significance - a.significance || a.createdAt - b.createdAt || a.temporalEventId.localeCompare(b.temporalEventId))
    .slice(0, config.maxObservationsPerEvaluation)
  const dueTimes = [
    nextPhaseAt(input.clock, now, config.phases),
    ...config.absenceThresholds
      .filter(item => engine.absence.startedAt != null && !engine.absence.crossedThresholdIds.includes(item.thresholdId))
      .map(item => engine.absence.startedAt! + item.durationMs),
    ...input.context.intentions.map(item => pendingIntentionDueAt(item)).filter((value): value is number => value != null).map(value => value + config.intentionOverdueMs),
    ...input.context.goals.filter(item => item.status === 'active').map(item => item.updatedAt + config.goalStalledMs),
    ...input.context.continuityThreads.filter(item => ['active', 'dormant'].includes(item.status)).map(item => item.lastActiveAt + config.continuityLingeringMs),
    ...(engine.sleep.status === 'sleeping' && engine.sleep.expectedWakeAt != null ? [engine.sleep.expectedWakeAt] : []),
  ].filter(value => value > now)
  const nextEvaluationAt = dueTimes.length ? Math.min(...dueTimes) : null
  engine = {
    ...engine,
    revision: engine.revision + 1,
    lastEvaluationAt: now,
    nextEvaluationAt,
    metadata: {
      ...engine.metadata,
      clockEligibilityBlockedAdjustmentId: trust.adjustmentId,
      lastEvaluationReason: input.reason,
    },
  }
  return {
    temporal: {
      ...input.temporal,
      engine,
      nextEvaluationAt: [input.temporal.nextEvaluationAt, nextEvaluationAt]
        .filter((value): value is number => value != null)
        .reduce<number | null>((minimum, value) => minimum == null ? value : Math.min(minimum, value), null),
    },
    created: structuredClone(created),
    eligible: structuredClone(candidates),
    clockTrusted: trust.trusted,
    blockingAdjustmentId: trust.adjustmentId,
    nextEvaluationAt,
  }
}

export function beginTemporalEventEvaluation(
  engine: Nan0TemporalEngineState,
  input: { temporalEventId: string, observationId: string, at: number },
): Nan0TemporalEngineState {
  const normalized = normalizeTemporalEngineState(engine)
  return {
    ...normalized,
    revision: normalized.revision + 1,
    events: normalized.events.map(event => event.temporalEventId === input.temporalEventId && event.status === 'eligible'
      ? { ...event, status: 'evaluating', evaluationCount: event.evaluationCount + 1, observationId: input.observationId, metadata: { ...event.metadata, evaluationStartedAt: input.at } }
      : event),
  }
}

export function settleTemporalEventEvaluation(
  engine: Nan0TemporalEngineState,
  input: {
    temporalEventId: string
    at: number
    thoughtId: string | null
    decisionId: string | null
    resolution: string
  },
): Nan0TemporalEngineState {
  const normalized = normalizeTemporalEngineState(engine)
  return {
    ...normalized,
    revision: normalized.revision + 1,
    events: normalized.events.map(event => event.temporalEventId === input.temporalEventId
      ? {
          ...event,
          status: 'handled',
          handledAt: Math.max(event.handledAt ?? 0, input.at),
          thoughtId: input.thoughtId ?? event.thoughtId,
          decisionId: input.decisionId ?? event.decisionId,
          metadata: { ...event.metadata, resolution: input.resolution },
        }
      : event),
  }
}
