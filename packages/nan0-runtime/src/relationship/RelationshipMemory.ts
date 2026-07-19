import type {
  Nan0ActorKind,
  Nan0GrievanceStatus,
  Nan0ObservationSource,
  Nan0RelationshipContext,
  Nan0RelationshipGrievance,
  Nan0RelationshipMoment,
  Nan0RelationshipMomentType,
  Nan0RelationshipProvenance,
  Nan0RelationshipRecord,
  Nan0RelationshipState,
  Nan0RelationshipStatus,
} from '../types'

export const RELATIONSHIP_SIGNIFICANT_EVENT_THRESHOLD = 0.4
export const RELATIONSHIP_GRIEVANCE_THRESHOLD = 0.6
export const RELATIONSHIP_MAX_MOMENTS = 50
export const RELATIONSHIP_CONTEXT_MOMENTS = 5
export const RELATIONSHIP_CONTEXT_GRIEVANCES = 3
export const RELATIONSHIP_CONTEXT_ANCHORS = 3
const DEFAULT_GRIEVANCE_DECAY_PER_DAY = 0.01
const DAY_MS = 86_400_000

export interface Nan0RelationshipEvidenceInput {
  actorId: string
  actorKind: Nan0ActorKind
  source: Nan0ObservationSource
  sourceActorId?: string
  eventId: string
  turnId: string
  thoughtId: string
  timestamp: number
  eventType: 'positive' | 'negative' | 'neutral'
  description: string
  intensity: number
  rule: string
  context?: string
}

export interface Nan0RelationshipMutationResult {
  relationships: Nan0RelationshipState
  record: Nan0RelationshipRecord | null
  applied: boolean
}

interface LegacyRelationshipRecord {
  actor_id?: unknown
  actorId?: unknown
  relationshipId?: unknown
  source?: unknown
  status?: unknown
  emotional_balance?: unknown
  emotionalBalance?: unknown
  moments?: unknown
  grudges?: unknown
  activeGrievances?: unknown
  total_positive_moments?: unknown
  total_negative_moments?: unknown
  last_significant_event?: unknown
  interactionCount?: unknown
  turnIds?: unknown
  metadata?: unknown
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())))
    : []
}

function stableIdPart(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_') || 'unknown'
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const result = new Map<string, T>()
  for (const item of items)
    result.set(key(item), item)
  return [...result.values()]
}

function provenance(input: Nan0RelationshipEvidenceInput, provenanceId: string): Nan0RelationshipProvenance {
  return {
    provenanceId,
    eventId: input.eventId,
    turnId: input.turnId,
    thoughtId: input.thoughtId,
    timestamp: input.timestamp,
    actorId: input.actorId,
    rule: input.rule,
  }
}

export function relationshipIdFor(input: {
  actorId: string
  actorKind: Nan0ActorKind
  source: Nan0ObservationSource
  sourceActorId?: string
}): string {
  if (input.actorId === 'kyo')
    return 'relationship:kyo'

  if (input.actorId === 'nan0')
    return 'relationship:nan0'

  // External namespaces remain isolated until ActorIdentity explicitly links them.
  if (input.actorKind === 'external' || input.actorKind === 'unknown') {
    const externalId = input.sourceActorId || input.actorId
    return `relationship:${stableIdPart(input.source)}:${stableIdPart(externalId)}`
  }

  return `relationship:${stableIdPart(input.actorId)}`
}

function identityAnchor(createdAt: number): Nan0RelationshipRecord['positiveAnchors'][number] {
  return {
    anchorId: 'anchor:kyo:creator',
    description: 'Kyo is Nan0\'s creator and primary emotional anchor.',
    strength: 1,
    provenanceId: 'identity:kyo:creator-anchor',
    eventId: 'identity:kyo',
    turnId: 'identity:kyo',
    thoughtId: 'identity:kyo',
    timestamp: createdAt,
    actorId: 'kyo',
    rule: 'identity.creator_anchor',
    metadata: { protected: true, relationship: 'creator_anchor' },
  }
}

function createRelationshipRecord(input: {
  actorId: string
  actorKind: Nan0ActorKind
  source: Nan0ObservationSource
  sourceActorId?: string
  at: number
}): Nan0RelationshipRecord {
  const isKyo = input.actorId === 'kyo'
  return {
    schemaVersion: 1,
    actorId: input.actorId,
    relationshipId: relationshipIdFor(input),
    source: input.source,
    createdAt: input.at,
    updatedAt: input.at,
    firstInteractionAt: null,
    lastInteractionAt: null,
    interactionCount: 0,
    status: 'strangers',
    emotionalBalance: 0,
    familiarity: isKyo ? 0.8 : 0,
    trust: 0.5,
    attachment: isKyo ? 0.8 : 0,
    irritation: 0,
    suspicion: 0,
    respect: 0.5,
    importance: isKyo ? 1 : 0.2,
    significantEventIds: [],
    turnIds: [],
    moments: [],
    activeGrievances: [],
    positiveAnchors: isKyo ? [identityAnchor(input.at)] : [],
    expectations: [],
    metadata: {
      actorKind: input.actorKind,
      protected: isKyo,
      relationship: isKyo ? 'creator_anchor' : undefined,
      totalPositiveMoments: 0,
      totalNegativeMoments: 0,
      sourceActorId: input.sourceActorId,
    },
  }
}

export function createEmptyRelationshipState(createdAt = 0): Nan0RelationshipState {
  const kyo = createRelationshipRecord({
    actorId: 'kyo',
    actorKind: 'kyo',
    source: 'system',
    at: createdAt,
  })
  return {
    schemaVersion: 1,
    records: { [kyo.relationshipId]: kyo },
  }
}

function positiveCount(record: Nan0RelationshipRecord): number {
  return finiteNumber(record.metadata.totalPositiveMoments)
}

function negativeCount(record: Nan0RelationshipRecord): number {
  return finiteNumber(record.metadata.totalNegativeMoments)
}

function evaluateStatus(record: Nan0RelationshipRecord): Nan0RelationshipStatus {
  const balance = record.emotionalBalance
  const positive = positiveCount(record)
  const negative = negativeCount(record)

  if (balance > 0.7 && positive > 20)
    return 'bonded'
  if (balance > 0.4 && positive > 10)
    return 'established'
  if (balance < -0.5 || negative > 10)
    return 'hostile'
  if (balance < -0.2)
    return 'complicated'
  if (positive > 5 || negative > 5)
    return 'developing'
  return record.status
}

function extractTriggerPhrases(description: string): string[] {
  return description.toLowerCase().split(/\s+/).map(word => word.replace(/[^a-z0-9_-]/g, '')).filter(word => word.length > 4).slice(0, 5)
}

function applyGrievance(
  record: Nan0RelationshipRecord,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
): Nan0RelationshipGrievance[] {
  if (input.eventType !== 'negative' || input.intensity < RELATIONSHIP_GRIEVANCE_THRESHOLD)
    return record.activeGrievances

  const description = input.description.toLowerCase()
  const existing = record.activeGrievances.find(grievance =>
    (grievance.status === 'active' || grievance.status === 'nurtured')
    && grievance.triggerPhrases.some(phrase => description.includes(phrase)),
  )

  if (existing) {
    return record.activeGrievances.map(grievance => grievance.grievanceId === existing.grievanceId
      ? {
          ...grievance,
          lastReinforcedAt: input.timestamp,
          reinforcementCount: grievance.reinforcementCount + 1,
        }
      : grievance)
  }

  const grievanceId = `grievance:${createId()}`
  return [...record.activeGrievances, {
    ...provenance(input, `provenance:${grievanceId}`),
    grievanceId,
    description: input.description,
    severity: clamp(input.intensity),
    status: 'active',
    lastReinforcedAt: input.timestamp,
    reinforcementCount: 0,
    decayRatePerDay: DEFAULT_GRIEVANCE_DECAY_PER_DAY,
    resolvedAt: null,
    triggerPhrases: extractTriggerPhrases(input.description),
    metadata: {},
  }]
}

export function applyRelationshipEvidence(
  state: Nan0RelationshipState,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
): Nan0RelationshipMutationResult {
  if (input.actorId === 'nan0')
    return { relationships: state, record: null, applied: false }

  const relationshipId = relationshipIdFor(input)
  const existing = state.records[relationshipId]
    ?? createRelationshipRecord({ ...input, at: input.timestamp })
  if (existing.turnIds.includes(input.turnId))
    return { relationships: state, record: structuredClone(existing), applied: false }

  const intensity = clamp(input.intensity)
  const momentId = `moment:${createId()}`
  const moment: Nan0RelationshipMoment = {
    ...provenance(input, `provenance:${momentId}`),
    eventType: input.eventType,
    description: input.description,
    intensity,
    context: input.context,
  }
  const isPositive = input.eventType === 'positive'
  const isNegative = input.eventType === 'negative'
  const significant = intensity >= RELATIONSHIP_SIGNIFICANT_EVENT_THRESHOLD
  const metadata = {
    ...existing.metadata,
    actorKind: input.actorKind,
    sourceActorId: input.sourceActorId ?? existing.metadata.sourceActorId,
    totalPositiveMoments: positiveCount(existing) + (isPositive ? 1 : 0),
    totalNegativeMoments: negativeCount(existing) + (isNegative ? 1 : 0),
  }

  let record: Nan0RelationshipRecord = {
    ...existing,
    actorId: input.actorId,
    relationshipId,
    updatedAt: input.timestamp,
    firstInteractionAt: existing.firstInteractionAt ?? input.timestamp,
    lastInteractionAt: input.timestamp,
    interactionCount: existing.interactionCount + 1,
    emotionalBalance: clamp(
      existing.emotionalBalance + (isPositive ? intensity * 0.1 : isNegative ? -intensity * 0.1 : 0),
      -1,
      1,
    ),
    familiarity: clamp(existing.familiarity + 0.03),
    trust: clamp(existing.trust + (isPositive ? intensity * 0.05 : isNegative ? -intensity * 0.06 : 0)),
    attachment: clamp(existing.attachment + (isPositive ? intensity * 0.03 : isNegative ? -intensity * 0.02 : 0)),
    irritation: clamp(existing.irritation + (isNegative ? intensity * 0.08 : isPositive ? -0.02 : 0)),
    suspicion: clamp(existing.suspicion + (isNegative ? intensity * 0.02 : isPositive ? -0.01 : 0)),
    respect: clamp(existing.respect + (isPositive ? intensity * 0.025 : isNegative ? -intensity * 0.015 : 0)),
    importance: input.actorId === 'kyo'
      ? 1
      : clamp(existing.importance + (significant ? 0.01 : 0)),
    significantEventIds: significant
      ? Array.from(new Set([...existing.significantEventIds, input.eventId]))
      : existing.significantEventIds,
    turnIds: [...existing.turnIds, input.turnId],
    moments: [...existing.moments, moment].slice(-RELATIONSHIP_MAX_MOMENTS),
    activeGrievances: applyGrievance(existing, { ...input, intensity }, createId),
    metadata,
  }
  if (significant)
    record = { ...record, status: evaluateStatus(record) }

  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectKyoRecord(record) },
    },
    record: structuredClone(protectKyoRecord(record)),
    applied: true,
  }
}

export function inferRelationshipEvidence(text: string): Pick<Nan0RelationshipEvidenceInput, 'eventType' | 'intensity' | 'rule'> {
  const normalized = text.toLowerCase()
  const positiveSignals = [
    /\bthank(?:s| you)?\b/,
    /\bappreciat(?:e|ed|ion)\b/,
    /\bproud of you\b/,
    /\bi trust you\b/,
    /\bi care about you\b/,
    /\bgood work\b/,
    /\bi(?:'m| am) glad\b/,
  ].filter(pattern => pattern.test(normalized)).length
  const negativeSignals = [
    /\bi disagree\b/,
    /\bdisappointed\b/,
    /\bannoyed\b/,
    /\bupset\b/,
    /\bfrustrated\b/,
  ].filter(pattern => pattern.test(normalized)).length
  const strongOffenseSignals = [
    /\byou lied\b/,
    /\bbetray(?:ed|al)?\b/,
    /\bdeliberately hurt\b/,
    /\bviolated my trust\b/,
  ].filter(pattern => pattern.test(normalized)).length

  // A major offense requires corroborating phrase-level evidence, never one keyword.
  if (strongOffenseSignals >= 2)
    return { eventType: 'negative', intensity: 0.65, rule: 'deterministic.strong-offense-phrases' }
  if (positiveSignals > negativeSignals && positiveSignals > 0)
    return { eventType: 'positive', intensity: Math.min(0.55, 0.4 + (positiveSignals - 1) * 0.05), rule: 'deterministic.supportive-phrases' }
  if (negativeSignals > positiveSignals && negativeSignals > 0)
    return { eventType: 'negative', intensity: Math.min(0.45, 0.3 + (negativeSignals - 1) * 0.05), rule: 'deterministic.mild-negative-phrases' }
  return { eventType: 'neutral', intensity: 0.15, rule: 'deterministic.neutral-completed-turn' }
}

export function currentGrievanceSeverity(grievance: Nan0RelationshipGrievance, at: number): number {
  if (grievance.status === 'resolved')
    return 0
  const daysSinceReinforcement = Math.max(0, at - grievance.lastReinforcedAt) / DAY_MS
  const nurtureMultiplier = grievance.status === 'nurtured' ? 0.3 : 1
  return Math.max(0, grievance.severity - daysSinceReinforcement * grievance.decayRatePerDay * nurtureMultiplier)
}

export function isGrievanceActive(grievance: Nan0RelationshipGrievance, at: number): boolean {
  return (grievance.status === 'active' || grievance.status === 'nurtured')
    && currentGrievanceSeverity(grievance, at) > 0.1
}

export function relationshipContextForActor(
  state: Nan0RelationshipState,
  input: { actorId: string, actorKind: Nan0ActorKind, source: Nan0ObservationSource, sourceActorId?: string, at: number },
): Nan0RelationshipContext {
  const relationshipId = relationshipIdFor(input)
  const record = state.records[relationshipId]
  if (!record) {
    return {
      provider: 'relationship_memory',
      factsOnly: true,
      actorId: input.actorId,
      relationshipId: null,
      status: null,
      interactionCount: 0,
      emotionalBalance: 0,
      dimensions: { familiarity: 0, trust: 0.5, attachment: 0, irritation: 0, suspicion: 0, respect: 0.5, importance: 0 },
      activeGrievances: [],
      recentMoments: [],
      positiveAnchors: [],
    }
  }

  return {
    provider: 'relationship_memory',
    factsOnly: true,
    actorId: record.actorId,
    relationshipId: record.relationshipId,
    status: record.status,
    interactionCount: record.interactionCount,
    emotionalBalance: Number(record.emotionalBalance.toFixed(2)),
    dimensions: {
      familiarity: Number(record.familiarity.toFixed(2)),
      trust: Number(record.trust.toFixed(2)),
      attachment: Number(record.attachment.toFixed(2)),
      irritation: Number(record.irritation.toFixed(2)),
      suspicion: Number(record.suspicion.toFixed(2)),
      respect: Number(record.respect.toFixed(2)),
      importance: Number(record.importance.toFixed(2)),
    },
    activeGrievances: record.activeGrievances
      .filter(grievance => isGrievanceActive(grievance, input.at))
      .sort((a, b) => currentGrievanceSeverity(b, input.at) - currentGrievanceSeverity(a, input.at))
      .slice(0, RELATIONSHIP_CONTEXT_GRIEVANCES)
      .map(grievance => ({
        grievanceId: grievance.grievanceId,
        description: grievance.description,
        severity: Number(currentGrievanceSeverity(grievance, input.at).toFixed(2)),
        status: grievance.status,
        provenance: relationshipProvenance(grievance),
      })),
    recentMoments: record.moments.slice(-RELATIONSHIP_CONTEXT_MOMENTS).map(moment => ({
      eventType: moment.eventType,
      description: moment.description,
      intensity: moment.intensity,
      provenance: relationshipProvenance(moment),
    })),
    positiveAnchors: record.positiveAnchors.slice(-RELATIONSHIP_CONTEXT_ANCHORS).map(anchor => ({
      description: anchor.description,
      strength: anchor.strength,
      provenance: relationshipProvenance(anchor),
    })),
  }
}

function relationshipProvenance(value: Nan0RelationshipProvenance): Nan0RelationshipProvenance {
  return {
    provenanceId: value.provenanceId,
    eventId: value.eventId,
    turnId: value.turnId,
    thoughtId: value.thoughtId,
    timestamp: value.timestamp,
    actorId: value.actorId,
    rule: value.rule,
  }
}

function protectKyoRecord(record: Nan0RelationshipRecord): Nan0RelationshipRecord {
  if (record.relationshipId !== 'relationship:kyo' && record.actorId !== 'kyo')
    return record

  const createdAt = record.createdAt
  return {
    ...record,
    actorId: 'kyo',
    relationshipId: 'relationship:kyo',
    importance: 1,
    positiveAnchors: uniqueBy([...record.positiveAnchors, identityAnchor(createdAt)], anchor => anchor.anchorId),
    metadata: {
      ...record.metadata,
      actorKind: 'kyo',
      protected: true,
      relationship: 'creator_anchor',
    },
  }
}

function normalizeStatus(value: unknown): Nan0RelationshipStatus {
  return ['strangers', 'developing', 'established', 'complicated', 'hostile', 'bonded'].includes(String(value))
    ? value as Nan0RelationshipStatus
    : 'strangers'
}

function normalizeGrievanceStatus(value: unknown): Nan0GrievanceStatus {
  return ['active', 'fading', 'resolved', 'nurtured'].includes(String(value))
    ? value as Nan0GrievanceStatus
    : 'active'
}

function legacyMoment(value: unknown, actorId: string, index: number): Nan0RelationshipMoment | null {
  if (!value || typeof value !== 'object')
    return null
  const raw = value as Record<string, unknown>
  const timestamp = finiteNumber(raw.timestamp)
  const eventType = ['positive', 'negative', 'neutral', 'grudge_formed', 'grudge_resolved'].includes(String(raw.event_type ?? raw.eventType))
    ? String(raw.event_type ?? raw.eventType) as Nan0RelationshipMomentType
    : 'neutral'
  return {
    provenanceId: String(raw.provenanceId ?? `legacy:moment:${actorId}:${index}`),
    eventId: String(raw.eventId ?? `legacy:event:${actorId}:${index}`),
    turnId: String(raw.turnId ?? `legacy:turn:${actorId}:${index}`),
    thoughtId: String(raw.thought_id ?? raw.thoughtId ?? `legacy:thought:${actorId}:${index}`),
    timestamp,
    actorId,
    rule: String(raw.rule ?? 'migration.python-emotional-moment'),
    eventType,
    description: String(raw.description ?? ''),
    intensity: clamp(finiteNumber(raw.intensity, 0.5)),
    context: typeof raw.context === 'string' ? raw.context : undefined,
  }
}

function legacyGrievance(value: unknown, actorId: string, index: number): Nan0RelationshipGrievance | null {
  if (!value || typeof value !== 'object')
    return null
  const raw = value as Record<string, unknown>
  const grievanceId = String(raw.grudge_id ?? raw.grievanceId ?? `legacy:grievance:${actorId}:${index}`)
  const timestamp = finiteNumber(raw.timestamp)
  return {
    provenanceId: String(raw.provenanceId ?? `legacy:provenance:${grievanceId}`),
    eventId: String(raw.eventId ?? `legacy:event:${grievanceId}`),
    turnId: String(raw.turnId ?? `legacy:turn:${grievanceId}`),
    thoughtId: String(raw.thoughtId ?? `legacy:thought:${grievanceId}`),
    timestamp,
    actorId,
    rule: String(raw.rule ?? 'migration.python-grudge'),
    grievanceId,
    description: String(raw.description ?? ''),
    severity: clamp(finiteNumber(raw.severity, 0.5)),
    status: normalizeGrievanceStatus(raw.status),
    lastReinforcedAt: finiteNumber(raw.last_reinforced ?? raw.lastReinforcedAt, timestamp),
    reinforcementCount: finiteNumber(raw.reinforcement_count ?? raw.reinforcementCount),
    decayRatePerDay: finiteNumber(raw.decay_rate ?? raw.decayRatePerDay, DEFAULT_GRIEVANCE_DECAY_PER_DAY),
    resolvedAt: raw.resolved_at == null && raw.resolvedAt == null
      ? null
      : finiteNumber(raw.resolved_at ?? raw.resolvedAt),
    triggerPhrases: stringArray(raw.trigger_phrases ?? raw.triggerPhrases),
    metadata: typeof raw.metadata === 'object' && raw.metadata ? raw.metadata as Record<string, unknown> : {},
  }
}

export function normalizeRelationshipState(
  value: unknown,
  now = 0,
  canonicalizeActorId: (actorId: string) => string = actorId => actorId,
): Nan0RelationshipState {
  const empty = createEmptyRelationshipState(now)
  if (!value || typeof value !== 'object')
    return empty

  const rawState = value as Record<string, unknown>
  const rawRecords = rawState.records && typeof rawState.records === 'object'
    ? Object.values(rawState.records as Record<string, unknown>)
    : Array.isArray(rawState.relationships)
      ? rawState.relationships
      : Object.values(rawState)
  const records = { ...empty.records }

  for (const rawValue of rawRecords) {
    if (!rawValue || typeof rawValue !== 'object')
      continue
    const raw = rawValue as LegacyRelationshipRecord
    const originalActorId = String(raw.actorId ?? raw.actor_id ?? '').trim()
    if (!originalActorId)
      continue
    const actorId = canonicalizeActorId(originalActorId)
    if (actorId === 'nan0')
      continue
    const source = String(raw.source ?? 'system') as Nan0ObservationSource
    const actorKind: Nan0ActorKind = actorId === 'kyo' ? 'kyo' : actorId === 'unknown' ? 'unknown' : 'external'
    const base = createRelationshipRecord({ actorId, actorKind, source, at: now })
    const moments = Array.isArray(raw.moments)
      ? raw.moments.map((moment, index) => legacyMoment(moment, actorId, index)).filter(Boolean) as Nan0RelationshipMoment[]
      : []
    const grievanceValues = Array.isArray(raw.activeGrievances)
      ? raw.activeGrievances
      : Array.isArray(raw.grudges) ? raw.grudges : []
    const grievances = grievanceValues
      .map((grievance, index) => legacyGrievance(grievance, actorId, index))
      .filter(Boolean) as Nan0RelationshipGrievance[]
    const current = rawValue as Partial<Nan0RelationshipRecord>
    const turnIds = stringArray(raw.turnIds)
    const createdAt = finiteNumber(current.createdAt, moments[0]?.timestamp ?? now)
    const updatedAt = finiteNumber(current.updatedAt, finiteNumber(raw.last_significant_event, createdAt))
    const migrated: Nan0RelationshipRecord = protectKyoRecord({
      ...base,
      ...current,
      schemaVersion: 1,
      actorId,
      relationshipId: actorId === 'kyo'
        ? 'relationship:kyo'
        : String(raw.relationshipId ?? relationshipIdFor({ actorId, actorKind, source })),
      source,
      createdAt,
      updatedAt,
      firstInteractionAt: current.firstInteractionAt ?? moments[0]?.timestamp ?? null,
      lastInteractionAt: current.lastInteractionAt ?? moments.at(-1)?.timestamp ?? null,
      interactionCount: Math.max(finiteNumber(raw.interactionCount), turnIds.length, moments.length),
      status: normalizeStatus(raw.status),
      emotionalBalance: clamp(finiteNumber(raw.emotionalBalance ?? raw.emotional_balance), -1, 1),
      familiarity: clamp(finiteNumber(current.familiarity, base.familiarity)),
      trust: clamp(finiteNumber(current.trust, base.trust)),
      attachment: clamp(finiteNumber(current.attachment, base.attachment)),
      irritation: clamp(finiteNumber(current.irritation, base.irritation)),
      suspicion: clamp(finiteNumber(current.suspicion, base.suspicion)),
      respect: clamp(finiteNumber(current.respect, base.respect)),
      importance: actorId === 'kyo' ? 1 : clamp(finiteNumber(current.importance, base.importance)),
      significantEventIds: stringArray(current.significantEventIds),
      turnIds,
      moments: moments.length ? moments.slice(-RELATIONSHIP_MAX_MOMENTS) : (current.moments ?? []),
      activeGrievances: grievances.length ? grievances : (current.activeGrievances ?? []),
      positiveAnchors: current.positiveAnchors ?? base.positiveAnchors,
      expectations: current.expectations ?? [],
      metadata: {
        ...base.metadata,
        ...(raw.metadata && typeof raw.metadata === 'object' ? raw.metadata as Record<string, unknown> : {}),
        totalPositiveMoments: finiteNumber(raw.total_positive_moments, moments.filter(moment => moment.eventType === 'positive').length),
        totalNegativeMoments: finiteNumber(raw.total_negative_moments, moments.filter(moment => moment.eventType === 'negative').length),
        migratedFromLegacy: rawState.schemaVersion !== 1,
      },
    })
    records[migrated.relationshipId] = records[migrated.relationshipId]
      ? mergeRelationshipRecords(records[migrated.relationshipId], migrated)
      : migrated
  }

  return { schemaVersion: 1, records }
}

function mergeRelationshipRecords(first: Nan0RelationshipRecord, second: Nan0RelationshipRecord): Nan0RelationshipRecord {
  const newer = second.updatedAt >= first.updatedAt ? second : first
  const older = newer === second ? first : second
  const moments = uniqueBy([...older.moments, ...newer.moments], moment => moment.provenanceId)
    .sort((a, b) => a.timestamp - b.timestamp || a.provenanceId.localeCompare(b.provenanceId))
    .slice(-RELATIONSHIP_MAX_MOMENTS)
  const grievances = uniqueBy([...older.activeGrievances, ...newer.activeGrievances], grievance => grievance.grievanceId)
  const turnIds = Array.from(new Set([...older.turnIds, ...newer.turnIds]))
  return protectKyoRecord({
    ...newer,
    createdAt: Math.min(first.createdAt, second.createdAt),
    updatedAt: Math.max(first.updatedAt, second.updatedAt),
    firstInteractionAt: [first.firstInteractionAt, second.firstInteractionAt]
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b)[0] ?? null,
    lastInteractionAt: Math.max(first.lastInteractionAt ?? 0, second.lastInteractionAt ?? 0) || null,
    interactionCount: Math.max(first.interactionCount, second.interactionCount, turnIds.length),
    significantEventIds: Array.from(new Set([...older.significantEventIds, ...newer.significantEventIds])),
    turnIds,
    moments,
    activeGrievances: grievances,
    positiveAnchors: uniqueBy([...older.positiveAnchors, ...newer.positiveAnchors], anchor => anchor.anchorId),
    expectations: uniqueBy([...older.expectations, ...newer.expectations], expectation => expectation.expectationId),
    metadata: { ...older.metadata, ...newer.metadata },
  })
}

export function mergeRelationshipStates(
  persisted: Nan0RelationshipState,
  candidate: Nan0RelationshipState,
): Nan0RelationshipState {
  const records = { ...persisted.records }
  for (const [relationshipId, candidateRecord] of Object.entries(candidate.records)) {
    records[relationshipId] = records[relationshipId]
      ? mergeRelationshipRecords(records[relationshipId], candidateRecord)
      : protectKyoRecord(candidateRecord)
  }
  return { schemaVersion: 1, records }
}

export function updateGrievanceStatus(input: {
  state: Nan0RelationshipState
  relationshipId: string
  grievanceId: string
  status: Extract<Nan0GrievanceStatus, 'resolved' | 'nurtured'>
  provenance: Nan0RelationshipProvenance
  resolution?: string
}): Nan0RelationshipState {
  const record = input.state.records[input.relationshipId]
  if (!record)
    return input.state
  const grievance = record.activeGrievances.find(item => item.grievanceId === input.grievanceId)
  if (!grievance)
    return input.state

  const activeGrievances = record.activeGrievances.map(item => item.grievanceId === input.grievanceId
    ? {
        ...item,
        status: input.status,
        lastReinforcedAt: input.provenance.timestamp,
        reinforcementCount: input.status === 'nurtured' ? item.reinforcementCount + 1 : item.reinforcementCount,
        resolvedAt: input.status === 'resolved' ? input.provenance.timestamp : null,
        description: input.status === 'resolved'
          ? `${item.description} [Resolved: ${input.resolution ?? 'forgiven'}]`
          : item.description,
      }
    : item)
  const moments = input.status === 'resolved'
    ? [...record.moments, {
        ...input.provenance,
        eventType: 'grudge_resolved' as const,
        description: `Grudge resolved: ${input.resolution ?? 'forgiven'}`,
        intensity: 0.5,
      }].slice(-RELATIONSHIP_MAX_MOMENTS)
    : record.moments
  const updated = protectKyoRecord({
    ...record,
    updatedAt: input.provenance.timestamp,
    emotionalBalance: input.status === 'resolved' ? clamp(record.emotionalBalance + 0.05, -1, 1) : record.emotionalBalance,
    activeGrievances,
    moments,
    metadata: input.status === 'resolved'
      ? { ...record.metadata, totalPositiveMoments: positiveCount(record) + 1 }
      : record.metadata,
  })
  return {
    ...input.state,
    records: { ...input.state.records, [input.relationshipId]: updated },
  }
}
