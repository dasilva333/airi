import type {
  Nan0Belief,
  Nan0DetectedPattern,
  Nan0EmotionalVector,
  Nan0Expectation,
  Nan0InternalObservation,
  Nan0Observation,
  Nan0PredictionState,
  Nan0SerializablePattern,
} from '../types'

const MAX_PATTERNS = 96
const MAX_EXPECTATIONS = 96
const MAX_BELIEFS = 96
const MAX_ATTENDED = 80
const MAX_SURPRISES = 32
const MIN_PATTERN_EVIDENCE = 3
const PATTERN_MAX_AGE_MS = 30 * 86_400_000
const EXPECTATION_WINDOW_MS = 5 * 60_000

function clamp(value: unknown, fallback = 0): number {
  return Math.min(1, Math.max(0, typeof value === 'number' && Number.isFinite(value) ? value : fallback))
}

function bounded(value: unknown, limit = 240): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, limit) : ''
}

function unique(values: readonly unknown[], limit = 24): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string').map(value => bounded(value, 180)).filter(Boolean))].slice(0, limit)
}

function normalizeMatcher(value: Partial<Nan0SerializablePattern> | null | undefined): Nan0SerializablePattern | null {
  const source = bounded(value?.source, 240)
  if (!source)
    return null
  const flags = [...new Set((bounded(value?.flags, 10) || 'i').split('').filter(flag => 'imsu'.includes(flag)))].join('') || 'i'
  try {
    void new RegExp(source, flags)
    return { source, flags }
  }
  catch {
    return null
  }
}

function literalMatcher(value: string): Nan0SerializablePattern | null {
  const literal = bounded(value, 120)
  return literal ? { source: literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags: 'i' } : null
}

function matches(pattern: Nan0SerializablePattern | null, text: string): boolean {
  if (!pattern)
    return false
  try {
    return new RegExp(pattern.source, pattern.flags).test(text)
  }
  catch {
    return false
  }
}

function signatureForObservation(observation: Readonly<Nan0Observation>): string {
  const text = typeof observation.content === 'string' ? observation.content : JSON.stringify(observation.content)
  const stopWords = new Set(['about', 'after', 'again', 'because', 'could', 'from', 'have', 'just', 'that', 'their', 'there', 'these', 'this', 'what', 'when', 'where', 'which', 'with', 'would', 'your'])
  return (text.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    .filter(token => !stopWords.has(token))
    .slice(0, 6)
    .join(' ')
    .slice(0, 120)
}

export function createEmptyPredictionState(): Nan0PredictionState {
  return {
    schemaVersion: 1,
    revision: 0,
    expectations: [],
    beliefs: [],
    patterns: [],
    recentAttended: [],
    recentSurprises: [],
    totalPredictions: 0,
    correctPredictions: 0,
    lastPatternScanAt: 0,
  }
}

function normalizeExpectation(value: Partial<Nan0Expectation>): Nan0Expectation | null {
  if (!value.expectationId || !value.formedFromObservationId || !Number.isFinite(value.formedAt))
    return null
  const status = ['active', 'confirmed', 'violated', 'expired', 'abandoned'].includes(String(value.status))
    ? value.status as Nan0Expectation['status']
    : 'active'
  const type = ['actor-behavior', 'emotional-response', 'system-state', 'temporal-sequence', 'goal-outcome', 'conversation-flow', 'pattern-continuation'].includes(String(value.type))
    ? value.type as Nan0Expectation['type']
    : 'pattern-continuation'
  return {
    schemaVersion: 1,
    expectationId: bounded(value.expectationId, 180),
    type,
    description: bounded(value.description),
    status,
    actorId: bounded(value.actorId, 180) || null,
    expectedOutcome: bounded(value.expectedOutcome, 160),
    confirmationPattern: normalizeMatcher(value.confirmationPattern),
    violationPattern: normalizeMatcher(value.violationPattern),
    formedFromObservationId: bounded(value.formedFromObservationId, 180),
    formedFromPatternId: bounded(value.formedFromPatternId, 180) || null,
    formedAt: Number(value.formedAt),
    expectedBy: Number.isFinite(value.expectedBy) ? Number(value.expectedBy) : null,
    expiresAt: Number.isFinite(value.expiresAt) ? Number(value.expiresAt) : null,
    confidence: clamp(value.confidence, 0.3),
    priorConfirmations: Math.max(0, Math.floor(value.priorConfirmations ?? 0)),
    priorViolations: Math.max(0, Math.floor(value.priorViolations ?? 0)),
    relatedGoalIds: unique(value.relatedGoalIds ?? []),
    evidenceObservationIds: unique(value.evidenceObservationIds ?? []),
    metadata: structuredClone(value.metadata ?? {}),
  }
}

function normalizePattern(value: Partial<Nan0DetectedPattern>): Nan0DetectedPattern | null {
  if (!value.patternId || !value.antecedent || !value.consequent || !Number.isFinite(value.detectedAt))
    return null
  return {
    schemaVersion: 1,
    patternId: bounded(value.patternId, 180),
    patternType: value.patternType === 'causal' || value.patternType === 'absence' ? value.patternType : 'sequence',
    actorId: bounded(value.actorId, 180) || null,
    antecedent: bounded(value.antecedent, 120),
    consequent: bounded(value.consequent, 120),
    occurrences: Math.max(0, Math.floor(value.occurrences ?? 0)),
    confidence: clamp(value.confidence),
    detectedAt: Number(value.detectedAt),
    lastOccurrenceAt: Number.isFinite(value.lastOccurrenceAt) ? Number(value.lastOccurrenceAt) : Number(value.detectedAt),
    evidenceObservationIds: unique(value.evidenceObservationIds ?? [], 32),
    isActive: value.isActive !== false,
  }
}

function normalizeBelief(value: Partial<Nan0Belief>): Nan0Belief | null {
  if (!value.beliefId || !Number.isFinite(value.formedAt))
    return null
  return {
    schemaVersion: 1,
    beliefId: bounded(value.beliefId, 180),
    description: bounded(value.description),
    subject: bounded(value.subject, 160),
    predicate: bounded(value.predicate, 160),
    actorId: bounded(value.actorId, 180) || null,
    confidence: clamp(value.confidence, 0.3),
    uncertainty: clamp(value.uncertainty, 0.7),
    confirmingEvidence: Math.max(0, Math.floor(value.confirmingEvidence ?? 0)),
    violatingEvidence: Math.max(0, Math.floor(value.violatingEvidence ?? 0)),
    formedAt: Number(value.formedAt),
    lastUpdatedAt: Number.isFinite(value.lastUpdatedAt) ? Number(value.lastUpdatedAt) : Number(value.formedAt),
    formedFromPatternId: bounded(value.formedFromPatternId, 180) || null,
    evidenceObservationIds: unique(value.evidenceObservationIds ?? [], 32),
    status: value.status === 'abandoned' ? 'abandoned' : 'active',
  }
}

function expectationStatusRank(status: Nan0Expectation['status']): number {
  return status === 'active' ? 1 : 2
}

export function normalizePredictionState(value: Partial<Nan0PredictionState> | null | undefined): Nan0PredictionState {
  const expectationById = new Map<string, Nan0Expectation>()
  for (const candidate of value?.expectations ?? []) {
    const expectation = normalizeExpectation(candidate)
    if (expectation)
      expectationById.set(expectation.expectationId, expectation)
  }
  const beliefById = new Map<string, Nan0Belief>()
  for (const candidate of value?.beliefs ?? []) {
    const belief = normalizeBelief(candidate)
    if (belief)
      beliefById.set(belief.beliefId, belief)
  }
  const patternById = new Map<string, Nan0DetectedPattern>()
  for (const candidate of value?.patterns ?? []) {
    const pattern = normalizePattern(candidate)
    if (pattern)
      patternById.set(pattern.patternId, pattern)
  }
  const attendedById = new Map<string, Nan0PredictionState['recentAttended'][number]>()
  for (const item of value?.recentAttended ?? []) {
    if (!item?.observationId || !Number.isFinite(item.attendedAt))
      continue
    attendedById.set(item.observationId, {
      observationId: bounded(item.observationId, 180),
      actorId: bounded(item.actorId, 180) || null,
      source: item.source,
      signature: bounded(item.signature, 120),
      content: bounded(item.content, 300),
      attendedAt: Number(item.attendedAt),
    })
  }
  return {
    schemaVersion: 1,
    revision: Math.max(0, Math.floor(value?.revision ?? 0)),
    expectations: [...expectationById.values()].sort((left, right) => left.formedAt - right.formedAt || left.expectationId.localeCompare(right.expectationId)).slice(-MAX_EXPECTATIONS),
    beliefs: [...beliefById.values()].sort((left, right) => left.formedAt - right.formedAt || left.beliefId.localeCompare(right.beliefId)).slice(-MAX_BELIEFS),
    patterns: [...patternById.values()].sort((left, right) => left.detectedAt - right.detectedAt || left.patternId.localeCompare(right.patternId)).slice(-MAX_PATTERNS),
    recentAttended: [...attendedById.values()].sort((left, right) => left.attendedAt - right.attendedAt || left.observationId.localeCompare(right.observationId)).slice(-MAX_ATTENDED),
    recentSurprises: (value?.recentSurprises ?? [])
      .filter(item => item?.surpriseId && item.expectationId && Number.isFinite(item.at) && Number.isFinite(item.magnitude))
      .map(item => ({
        surpriseId: bounded(item.surpriseId, 180),
        at: Number(item.at),
        expectationId: bounded(item.expectationId, 180),
        magnitude: clamp(item.magnitude),
        emotion: bounded(item.emotion, 80) || 'curiosity',
        observationId: bounded(item.observationId, 180) || null,
      }))
      .sort((left, right) => left.at - right.at || left.surpriseId.localeCompare(right.surpriseId))
      .slice(-MAX_SURPRISES),
    totalPredictions: Math.max(0, Math.floor(value?.totalPredictions ?? 0)),
    correctPredictions: Math.max(0, Math.floor(value?.correctPredictions ?? 0)),
    lastPatternScanAt: Number.isFinite(value?.lastPatternScanAt) ? Number(value?.lastPatternScanAt) : 0,
  }
}

export function mergePredictionStates(
  persisted: Partial<Nan0PredictionState> | null | undefined,
  candidate: Partial<Nan0PredictionState> | null | undefined,
): Nan0PredictionState {
  const left = normalizePredictionState(persisted)
  const right = normalizePredictionState(candidate)
  const primary = right.revision >= left.revision ? right : left
  const expectationById = new Map(left.expectations.map(item => [item.expectationId, item]))
  for (const item of right.expectations) {
    const existing = expectationById.get(item.expectationId)
    if (!existing || expectationStatusRank(item.status) >= expectationStatusRank(existing.status))
      expectationById.set(item.expectationId, item)
  }
  const patternById = new Map(left.patterns.map(item => [item.patternId, item]))
  for (const item of right.patterns) {
    const existing = patternById.get(item.patternId)
    patternById.set(item.patternId, existing
      ? { ...existing, ...item, occurrences: Math.max(existing.occurrences, item.occurrences), confidence: item.lastOccurrenceAt >= existing.lastOccurrenceAt ? item.confidence : existing.confidence, evidenceObservationIds: unique([...existing.evidenceObservationIds, ...item.evidenceObservationIds], 32) }
      : item)
  }
  const beliefById = new Map(left.beliefs.map(item => [item.beliefId, item]))
  for (const item of right.beliefs) {
    const existing = beliefById.get(item.beliefId)
    if (!existing || item.lastUpdatedAt >= existing.lastUpdatedAt)
      beliefById.set(item.beliefId, item)
  }
  const attendedById = new Map(left.recentAttended.map(item => [item.observationId, item]))
  for (const item of right.recentAttended)
    attendedById.set(item.observationId, item)
  const surpriseById = new Map(left.recentSurprises.map(item => [item.surpriseId, item]))
  for (const item of right.recentSurprises)
    surpriseById.set(item.surpriseId, item)
  return normalizePredictionState({
    ...primary,
    revision: Math.max(left.revision, right.revision),
    expectations: [...expectationById.values()],
    patterns: [...patternById.values()],
    beliefs: [...beliefById.values()],
    recentAttended: [...attendedById.values()],
    recentSurprises: [...surpriseById.values()],
    totalPredictions: Math.max(left.totalPredictions, right.totalPredictions),
    correctPredictions: Math.max(left.correctPredictions, right.correctPredictions),
    lastPatternScanAt: Math.max(left.lastPatternScanAt, right.lastPatternScanAt),
  })
}

export interface PredictionObservationResult {
  state: Nan0PredictionState
  confirmed: Nan0Expectation[]
  violated: Nan0Expectation[]
  formed: Nan0Expectation[]
  detectedPatterns: Nan0DetectedPattern[]
  emotionalImpact: Record<string, number>
  internalObservations: Array<{ observation: Nan0InternalObservation, priority: number, dedupeKey: string }>
}

export function processAttendedObservation(input: {
  state: Readonly<Nan0PredictionState>
  observation: Readonly<Nan0Observation>
  emotionalState: Readonly<Nan0EmotionalVector>
  createId: () => string
  at: number
}): PredictionObservationResult {
  let state = normalizePredictionState(input.state)
  const content = typeof input.observation.content === 'string' ? input.observation.content : JSON.stringify(input.observation.content)
  const signature = signatureForObservation(input.observation)
  const confirmed: Nan0Expectation[] = []
  const violated: Nan0Expectation[] = []
  const formed: Nan0Expectation[] = []
  const detectedPatterns: Nan0DetectedPattern[] = []
  const emotionalImpact: Record<string, number> = {}
  const internalObservations: PredictionObservationResult['internalObservations'] = []

  const expectations = state.expectations.map((expectation) => {
    if (expectation.status !== 'active' || expectation.formedFromObservationId === input.observation.id)
      return expectation
    if (expectation.actorId && input.observation.actorId !== expectation.actorId)
      return expectation
    if (matches(expectation.confirmationPattern, content)) {
      const updated = { ...expectation, status: 'confirmed' as const, confidence: clamp(expectation.confidence + 0.08), priorConfirmations: expectation.priorConfirmations + 1, evidenceObservationIds: unique([...expectation.evidenceObservationIds, input.observation.id]) }
      confirmed.push(updated)
      emotionalImpact.smugness = (emotionalImpact.smugness ?? 0) + 0.04 * updated.confidence
      return updated
    }
    if (expectation.expectedBy != null && input.at >= expectation.expectedBy) {
      const explicitViolation = matches(expectation.violationPattern, content)
      const timedOut = expectation.expiresAt != null && input.at >= expectation.expiresAt
      if (explicitViolation || timedOut) {
        const updated = { ...expectation, status: 'violated' as const, confidence: clamp(expectation.confidence - 0.12), priorViolations: expectation.priorViolations + 1, evidenceObservationIds: unique([...expectation.evidenceObservationIds, input.observation.id]) }
        violated.push(updated)
        const magnitude = clamp(expectation.confidence * (explicitViolation ? 0.7 : 0.5))
        emotionalImpact.curiosity = (emotionalImpact.curiosity ?? 0) + magnitude * 0.12
        emotionalImpact.suspicion = (emotionalImpact.suspicion ?? 0) + magnitude * 0.08
        const surpriseId = `surprise_${input.createId()}`
        internalObservations.push({
          observation: {
            id: `observation_${input.createId()}`,
            source: 'internal:prediction-violation',
            actorId: 'nan0',
            displayName: 'Nan0',
            content: `An attended observation violated expectation "${expectation.description}". The expected outcome was "${expectation.expectedOutcome}".`,
            metadata: { expectationId: expectation.expectationId, surpriseMagnitude: magnitude, internalOwner: 'nan0' },
            timestamp: input.at,
            priority: magnitude,
            provenance: { schemaVersion: 1, ownerActorId: 'nan0', producer: 'prediction', sourceId: expectation.expectationId, evidenceKey: `expectation-violated:${expectation.expectationId}:${input.observation.id}`, references: [expectation.expectationId, input.observation.id] },
          },
          priority: magnitude,
          dedupeKey: `expectation-violated:${expectation.expectationId}:${input.observation.id}`,
        })
        state = { ...state, recentSurprises: [...state.recentSurprises, { surpriseId, at: input.at, expectationId: expectation.expectationId, magnitude, emotion: 'curiosity', observationId: input.observation.id }] }
        return updated
      }
    }
    return expectation
  })

  const summary = {
    observationId: input.observation.id,
    actorId: input.observation.actorId ?? null,
    source: input.observation.source,
    signature,
    content: bounded(content, 300),
    attendedAt: input.at,
  }
  const attended = [...state.recentAttended.filter(item => item.observationId !== summary.observationId), summary].slice(-MAX_ATTENDED)
  const pairEvidence = new Map<string, { actorId: string | null, antecedent: string, consequent: string, observationIds: string[], at: number }>()
  for (let index = 1; index < attended.length; index++) {
    const previous = attended[index - 1]
    const current = attended[index]
    if (!previous.signature || !current.signature || previous.actorId !== current.actorId || current.attendedAt - previous.attendedAt > 30 * 60_000)
      continue
    const key = `${previous.actorId ?? 'unknown'}:${previous.signature}=>${current.signature}`
    const evidence = pairEvidence.get(key) ?? { actorId: current.actorId, antecedent: previous.signature, consequent: current.signature, observationIds: [], at: current.attendedAt }
    evidence.observationIds.push(previous.observationId, current.observationId)
    evidence.at = Math.max(evidence.at, current.attendedAt)
    pairEvidence.set(key, evidence)
  }
  const patterns = [...state.patterns]
  for (const evidence of pairEvidence.values()) {
    const distinctEvidence = unique(evidence.observationIds, 32)
    const occurrences = Math.floor(distinctEvidence.length / 2)
    if (occurrences < MIN_PATTERN_EVIDENCE)
      continue
    const existingIndex = patterns.findIndex(pattern => pattern.patternType === 'sequence' && pattern.actorId === evidence.actorId && pattern.antecedent === evidence.antecedent && pattern.consequent === evidence.consequent)
    const confidence = clamp(0.2 + occurrences * 0.12)
    if (existingIndex >= 0) {
      patterns[existingIndex] = { ...patterns[existingIndex], occurrences: Math.max(patterns[existingIndex].occurrences, occurrences), confidence, lastOccurrenceAt: evidence.at, evidenceObservationIds: distinctEvidence, isActive: true }
    }
    else {
      const pattern: Nan0DetectedPattern = {
        schemaVersion: 1,
        patternId: `pattern_${input.createId()}`,
        patternType: 'sequence',
        actorId: evidence.actorId,
        antecedent: evidence.antecedent,
        consequent: evidence.consequent,
        occurrences,
        confidence,
        detectedAt: input.at,
        lastOccurrenceAt: evidence.at,
        evidenceObservationIds: distinctEvidence,
        isActive: true,
      }
      patterns.push(pattern)
      detectedPatterns.push(pattern)
    }
  }

  for (const pattern of patterns) {
    if (!pattern.isActive || pattern.occurrences < MIN_PATTERN_EVIDENCE || pattern.confidence < 0.45 || pattern.actorId !== (input.observation.actorId ?? null) || signature !== pattern.antecedent)
      continue
    const exists = expectations.some(expectation => expectation.status === 'active' && expectation.formedFromPatternId === pattern.patternId)
    if (exists)
      continue
    const expectation: Nan0Expectation = {
      schemaVersion: 1,
      expectationId: `expectation_${input.createId()}`,
      type: 'actor-behavior',
      description: `After "${pattern.antecedent}", ${pattern.actorId ?? 'this actor'} tends toward "${pattern.consequent}".`,
      status: 'active',
      actorId: pattern.actorId,
      expectedOutcome: pattern.consequent,
      confirmationPattern: literalMatcher(pattern.consequent.split(' ')[0] ?? pattern.consequent),
      violationPattern: null,
      formedFromObservationId: input.observation.id,
      formedFromPatternId: pattern.patternId,
      formedAt: input.at,
      expectedBy: input.at + Math.floor(EXPECTATION_WINDOW_MS * 0.5),
      expiresAt: input.at + EXPECTATION_WINDOW_MS,
      confidence: clamp(pattern.confidence * 0.8),
      priorConfirmations: 0,
      priorViolations: 0,
      relatedGoalIds: [],
      evidenceObservationIds: unique([...pattern.evidenceObservationIds, input.observation.id]),
      metadata: { minimumEvidence: MIN_PATTERN_EVIDENCE },
    }
    expectations.push(expectation)
    formed.push(expectation)
  }

  const beliefs = reviseBeliefs(state.beliefs, patterns, confirmed, violated, input.createId, input.at)
  state = normalizePredictionState({
    ...state,
    revision: state.revision + 1,
    expectations,
    patterns: patterns.map(pattern => input.at - pattern.lastOccurrenceAt > PATTERN_MAX_AGE_MS ? { ...pattern, isActive: false, confidence: clamp(pattern.confidence - 0.1) } : pattern),
    beliefs,
    recentAttended: attended,
    recentSurprises: state.recentSurprises,
    totalPredictions: state.totalPredictions + confirmed.length + violated.length,
    correctPredictions: state.correctPredictions + confirmed.length,
    lastPatternScanAt: input.at,
  })
  return { state, confirmed, violated, formed, detectedPatterns, emotionalImpact, internalObservations }
}

function reviseBeliefs(
  beliefsValue: readonly Nan0Belief[],
  patterns: readonly Nan0DetectedPattern[],
  confirmed: readonly Nan0Expectation[],
  violated: readonly Nan0Expectation[],
  createId: () => string,
  at: number,
): Nan0Belief[] {
  const beliefs = [...beliefsValue]
  for (const expectation of confirmed) {
    const pattern = patterns.find(item => item.patternId === expectation.formedFromPatternId)
    if (!pattern)
      continue
    const index = beliefs.findIndex(item => item.formedFromPatternId === pattern.patternId && item.status === 'active')
    if (index >= 0) {
      const belief = beliefs[index]
      beliefs[index] = { ...belief, confidence: clamp(belief.confidence + 0.05), uncertainty: clamp(belief.uncertainty - 0.05), confirmingEvidence: belief.confirmingEvidence + 1, lastUpdatedAt: at, evidenceObservationIds: unique([...belief.evidenceObservationIds, ...expectation.evidenceObservationIds], 32) }
    }
    else if (pattern.occurrences >= MIN_PATTERN_EVIDENCE) {
      beliefs.push({
        schemaVersion: 1,
        beliefId: `belief_${createId()}`,
        description: `Observed sequence: ${pattern.antecedent} tends to precede ${pattern.consequent}.`,
        subject: pattern.antecedent,
        predicate: pattern.consequent,
        actorId: pattern.actorId,
        confidence: clamp(pattern.confidence * 0.6),
        uncertainty: clamp(1 - pattern.confidence * 0.6),
        confirmingEvidence: 1,
        violatingEvidence: 0,
        formedAt: at,
        lastUpdatedAt: at,
        formedFromPatternId: pattern.patternId,
        evidenceObservationIds: unique(expectation.evidenceObservationIds, 32),
        status: 'active',
      })
    }
  }
  for (const expectation of violated) {
    const index = beliefs.findIndex(item => item.formedFromPatternId === expectation.formedFromPatternId && item.status === 'active')
    if (index < 0)
      continue
    const belief = beliefs[index]
    const confidence = clamp(belief.confidence - 0.1)
    const violations = belief.violatingEvidence + 1
    beliefs[index] = { ...belief, confidence, uncertainty: clamp(belief.uncertainty + 0.1), violatingEvidence: violations, lastUpdatedAt: at, evidenceObservationIds: unique([...belief.evidenceObservationIds, ...expectation.evidenceObservationIds], 32), status: confidence < 0.2 && violations >= 3 ? 'abandoned' : 'active' }
  }
  return beliefs
}

export function expirePredictions(stateValue: Readonly<Nan0PredictionState>, at: number): { state: Nan0PredictionState, expired: Nan0Expectation[] } {
  const state = normalizePredictionState(stateValue)
  const expired: Nan0Expectation[] = []
  const expectations = state.expectations.map((expectation) => {
    if (expectation.status === 'active' && expectation.expiresAt != null && at >= expectation.expiresAt) {
      const next = { ...expectation, status: 'expired' as const }
      expired.push(next)
      return next
    }
    return expectation
  })
  return {
    state: normalizePredictionState({ ...state, revision: state.revision + (expired.length ? 1 : 0), expectations }),
    expired,
  }
}

export function composePredictionContext(stateValue: Readonly<Nan0PredictionState>, at: number): string {
  const state = normalizePredictionState(stateValue)
  const active = state.expectations.filter(item => item.status === 'active')
    .sort((left, right) => right.confidence - left.confidence || left.formedAt - right.formedAt)
    .slice(0, 3)
    .map(item => ({ expectationId: item.expectationId, description: item.description, confidence: item.confidence, expectedBy: item.expectedBy, expiresAt: item.expiresAt }))
  const surprises = state.recentSurprises.filter(item => at - item.at <= 24 * 60 * 60_000).slice(-3)
  const beliefs = state.beliefs.filter(item => item.status === 'active' && item.confidence >= 0.5)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3)
    .map(item => ({ beliefId: item.beliefId, description: item.description, confidence: item.confidence, uncertainty: item.uncertainty, evidence: [item.confirmingEvidence, item.violatingEvidence] }))
  const patterns = state.patterns.filter(item => item.isActive && item.occurrences >= MIN_PATTERN_EVIDENCE)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 3)
    .map(item => ({ patternId: item.patternId, antecedent: item.antecedent, consequent: item.consequent, occurrences: item.occurrences, confidence: item.confidence }))
  return JSON.stringify({
    provider: 'nan0_prediction',
    factsOnly: true,
    activeExpectations: active,
    recentSurprises: surprises,
    strongBeliefs: beliefs,
    activePatterns: patterns,
    accuracy: state.totalPredictions ? state.correctPredictions / state.totalPredictions : null,
  })
}
