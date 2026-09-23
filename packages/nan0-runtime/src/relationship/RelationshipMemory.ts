import type {
  DefaultIdentityOptions,
  Nan0ActorKind,
  Nan0EntityLedgerAdapter,
  Nan0GrievanceStatus,
  Nan0IdentityState,
  Nan0ObservationSource,
  Nan0PclClaim,
  Nan0RelationshipContext,
  Nan0RelationshipExpectation,
  Nan0RelationshipGrievance,
  Nan0RelationshipMoment,
  Nan0RelationshipMomentType,
  Nan0RelationshipProvenance,
  Nan0RelationshipRecord,
  Nan0RelationshipState,
  Nan0RelationshipStatus,
  Nan0SystemOneProvider,
} from '../types'

import { isOwnerActor } from '../identity/ActorIdentity'
import { NAN0_JEV_GRIEVANCE_RECURRENCE_QUESTIONS } from '../shadow/Nan0JevSchema'

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
  claim?: Nan0PclClaim
  triggerPhrases?: string[]
}

export interface Nan0RelationshipEvidenceOptions {
  identity?: Nan0IdentityState
  ownerId?: string
  ownerDisplayName?: string
  entityLedger?: Nan0EntityLedgerAdapter
  systemOneProvider?: Nan0SystemOneProvider
  jevModel?: string
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

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Grammatical closed-class lexical fallback floor.
 * Covers English closed-class parts of speech: articles, auxiliary verbs, conjunctions,
 * personal pronouns, and core prepositions. Used ONLY as a zero-cost lexical fallback floor
 * when System 1 Jev semantic classification is offline or unavailable.
 */
export const FALLBACK_CLOSED_CLASS_REGEX = /^(?:a|an|the|and|or|but|if|then|so|as|at|by|for|in|of|on|to|with|about|above|after|again|against|all|almost|along|also|although|always|among|another|any|around|be|because|been|before|being|between|both|can|could|did|do|does|doing|done|every|first|found|from|get|gets|getting|go|goes|going|gone|got|great|had|has|have|having|he|her|here|him|his|how|however|i|if|in|indeed|inside|into|is|it|its|itself|just|made|make|makes|making|me|might|more|most|much|must|my|never|no|nor|not|nothing|now|of|off|often|on|only|or|other|others|our|out|over|really|said|say|saying|says|shall|she|should|since|so|some|still|such|take|taken|taking|than|that|the|their|them|then|there|these|they|thing|things|think|thinks|this|those|though|through|to|too|took|under|until|up|us|very|was|we|went|were|weve|what|when|where|which|while|who|why|will|with|would|you|your|youre|youve)$/i

export function isOwnerRecord(
  recordOrActorId: string | Nan0RelationshipRecord,
  identity?: Nan0IdentityState,
  ownerId?: string,
): boolean {
  const actorId = typeof recordOrActorId === 'string' ? recordOrActorId : recordOrActorId.actorId
  const relId = typeof recordOrActorId === 'string' ? '' : recordOrActorId.relationshipId
  if (identity && isOwnerActor(actorId, identity))
    return true
  if (ownerId && (actorId.toLowerCase() === ownerId.toLowerCase() || relId === `relationship:${stableIdPart(ownerId)}`))
    return true
  return actorId.toLowerCase() === 'kyo' || relId === 'relationship:kyo'
}

export function relationshipIdFor(
  input: {
    actorId: string
    actorKind: Nan0ActorKind
    source: Nan0ObservationSource
    sourceActorId?: string
  },
  identity?: Nan0IdentityState,
  ownerId?: string,
): string {
  if (input.actorId === 'kyo')
    return 'relationship:kyo'

  if (isOwnerRecord(input.actorId, identity, ownerId)) {
    const actualOwnerId = identity?.ownerId || ownerId || input.actorId
    return `relationship:${stableIdPart(actualOwnerId)}`
  }

  if (input.actorId === 'nan0')
    return 'relationship:nan0'

  // External namespaces remain isolated until ActorIdentity explicitly links them.
  if (input.actorKind === 'external' || input.actorKind === 'unknown') {
    const externalId = input.sourceActorId || input.actorId
    return `relationship:${stableIdPart(input.source)}:${stableIdPart(externalId)}`
  }

  return `relationship:${stableIdPart(input.actorId)}`
}

function identityAnchor(
  createdAt: number,
  ownerId = 'kyo',
  ownerDisplayName = 'Kyo',
): Nan0RelationshipRecord['positiveAnchors'][number] {
  const safeOwnerId = ownerId || 'kyo'
  const safeName = ownerDisplayName || 'Kyo'
  return {
    anchorId: `anchor:${safeOwnerId}:creator`,
    description: `${safeName} is Nan0's creator and primary emotional anchor.`,
    strength: 1,
    provenanceId: `identity:${safeOwnerId}:creator-anchor`,
    eventId: `identity:${safeOwnerId}`,
    turnId: `identity:${safeOwnerId}`,
    thoughtId: `identity:${safeOwnerId}`,
    timestamp: createdAt,
    actorId: safeOwnerId,
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
  identity?: Nan0IdentityState
  ownerId?: string
  ownerDisplayName?: string
}): Nan0RelationshipRecord {
  const isOwner = isOwnerRecord(input.actorId, input.identity, input.ownerId)
  const actualOwnerId = input.identity?.ownerId || input.ownerId || (isOwner ? input.actorId : 'kyo')
  const actualOwnerDisplayName = input.identity?.actors[actualOwnerId]?.displayName
    || input.ownerDisplayName
    || (isOwner ? input.actorId : 'Kyo')

  return {
    schemaVersion: 1,
    actorId: input.actorId,
    relationshipId: relationshipIdFor(input, input.identity, input.ownerId),
    source: input.source,
    createdAt: input.at,
    updatedAt: input.at,
    firstInteractionAt: null,
    lastInteractionAt: null,
    interactionCount: 0,
    status: 'strangers',
    emotionalBalance: 0,
    familiarity: isOwner ? 0.8 : 0,
    trust: 0.5,
    attachment: isOwner ? 0.8 : 0,
    irritation: 0,
    suspicion: 0,
    respect: 0.5,
    importance: isOwner ? 1 : 0.2,
    significantEventIds: [],
    turnIds: [],
    moments: [],
    activeGrievances: [],
    positiveAnchors: isOwner ? [identityAnchor(input.at, actualOwnerId, actualOwnerDisplayName)] : [],
    expectations: [],
    metadata: {
      actorKind: isOwner ? (actualOwnerId === 'kyo' ? 'kyo' : 'owner') : input.actorKind,
      protected: isOwner,
      relationship: isOwner ? 'creator_anchor' : undefined,
      totalPositiveMoments: 0,
      totalNegativeMoments: 0,
      sourceActorId: input.sourceActorId,
    },
  }
}

export function createEmptyRelationshipState(
  createdAt = 0,
  options?: string | DefaultIdentityOptions,
  identity?: Nan0IdentityState,
): Nan0RelationshipState {
  const opts: DefaultIdentityOptions | undefined = typeof options === 'string'
    ? { ownerDisplayName: options }
    : options
  const ownerId = identity?.ownerId || opts?.ownerId || opts?.ownerDisplayName?.toLowerCase() || 'kyo'
  const ownerDisplayName = identity?.actors[ownerId]?.displayName || opts?.ownerDisplayName || 'Kyo'

  const owner = createRelationshipRecord({
    actorId: ownerId,
    actorKind: ownerId === 'kyo' ? 'kyo' : 'owner',
    source: 'system',
    at: createdAt,
    identity,
    ownerId,
    ownerDisplayName,
  })
  return {
    schemaVersion: 1,
    records: { [owner.relationshipId]: owner },
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

export function extractTriggerPhrases(description: string): string[] {
  const words = description
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.replace(/[^a-z0-9_-]/g, ''))
    .filter(word => word.length >= 3 && !FALLBACK_CLOSED_CLASS_REGEX.test(word))

  return Array.from(new Set(words)).slice(0, 5)
}

export async function extractTriggerPhrasesAsync(
  description: string,
  systemOneProvider?: Nan0SystemOneProvider,
  jevModel?: string,
): Promise<string[]> {
  if (systemOneProvider) {
    try {
      const res = await systemOneProvider(
        { text: description },
        {
          trigger_concept: {
            type: 'choice',
            instructions: 'Classify the core grievance topic or concept expressed in the text.',
            criteria: {
              deceit_dishonesty: 'Lying, deception, hiding truth, broken promises.',
              technical_failure: 'Crashes, bugs, deleted files, system malfunction.',
              insult_attack: 'Hostility, insults, rudeness, disrespect.',
              neglect_dismissal: 'Ignoring, dismissing, brushing off, abandonment.',
              boundary_violation: 'Ignoring personal limits, unwelcome probing or behavior.',
              none: 'No specific grievance concept.',
            },
          },
        },
        jevModel,
      )
      const choice = res.answers?.trigger_concept?.choice
      if (choice && choice !== 'none') {
        const lexical = extractTriggerPhrases(description)
        return Array.from(new Set([choice, ...lexical])).slice(0, 5)
      }
    }
    catch {
      // Graceful fallback to regex floor
    }
  }
  return extractTriggerPhrases(description)
}

export function matchesTriggerPhrases(description: string, triggerPhrases: string[]): boolean {
  if (!triggerPhrases || triggerPhrases.length === 0)
    return false
  const desc = description.toLowerCase()
  return triggerPhrases.some((phrase) => {
    if (!phrase || !phrase.trim())
      return false
    const p = phrase.trim().toLowerCase()
    if (p.includes(' ') || p.includes('-') || p.includes('_'))
      return desc.includes(p)
    const regex = new RegExp(`\\b${escapeRegExp(p)}\\b`, 'i')
    return regex.test(desc)
  })
}

function applyGrievance(
  record: Nan0RelationshipRecord,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
): Nan0RelationshipGrievance[] {
  if (input.eventType !== 'negative' || input.intensity < RELATIONSHIP_GRIEVANCE_THRESHOLD)
    return record.activeGrievances

  const description = input.description.toLowerCase()
  const claim = input.claim

  const existing = record.activeGrievances.find((grievance) => {
    if (grievance.status !== 'active' && grievance.status !== 'nurtured')
      return false
    if (claim && grievance.predicate && grievance.object) {
      if (claim.predicate === grievance.predicate && claim.object.toLowerCase() === grievance.object.toLowerCase())
        return true
    }
    return matchesTriggerPhrases(description, grievance.triggerPhrases)
  })

  if (existing) {
    return record.activeGrievances.map(grievance => grievance.grievanceId === existing.grievanceId
      ? {
          ...grievance,
          lastReinforcedAt: input.timestamp,
          reinforcementCount: grievance.reinforcementCount + 1,
          action: 'reinforce',
        }
      : grievance)
  }

  const grievanceId = `grievance:${createId()}`
  const triggerPhrases = input.triggerPhrases?.length
    ? input.triggerPhrases
    : extractTriggerPhrases(input.description)

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
    triggerPhrases,
    metadata: {},
    claimId: claim?.claimId ?? `claim:${createId()}`,
    subject: claim?.subject ?? input.actorId,
    predicate: claim?.predicate ?? 'grievance',
    object: claim?.object ?? input.description,
    action: 'new',
    supersededBy: null,
    supersededAt: null,
  }]
}

async function applyGrievanceAsync(
  record: Nan0RelationshipRecord,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Promise<Nan0RelationshipGrievance[]> {
  if (input.eventType !== 'negative' || input.intensity < RELATIONSHIP_GRIEVANCE_THRESHOLD)
    return record.activeGrievances

  // If System 1 Jev is available, evaluate grievance salience and recurrence
  if (options?.systemOneProvider) {
    try {
      const jevRes = await options.systemOneProvider(
        {
          targetTurn: { text: input.description },
          context: input.context,
          activeGrievances: record.activeGrievances.map(g => ({
            grievanceId: g.grievanceId,
            description: g.description,
            predicate: g.predicate,
            object: g.object,
          })),
        },
        NAN0_JEV_GRIEVANCE_RECURRENCE_QUESTIONS,
        options.jevModel,
      )

      // If Jev determines this is merely conversational filler, suppress grievance formation
      if (jevRes.answers?.grievance_salience?.choice === 'conversational_filler') {
        return record.activeGrievances
      }

      // If Jev classifies as recurrence of an active grievance, reinforce it semantically
      if (jevRes.answers?.grievance_recurrence?.choice === 'recurrence_reinforced') {
        const activeOne = record.activeGrievances.find(g => g.status === 'active' || g.status === 'nurtured')
        if (activeOne) {
          return record.activeGrievances.map(grievance => grievance.grievanceId === activeOne.grievanceId
            ? {
                ...grievance,
                lastReinforcedAt: input.timestamp,
                reinforcementCount: grievance.reinforcementCount + 1,
                action: 'reinforce',
              }
            : grievance)
        }
      }
    }
    catch {
      // Graceful fallback to regex floor
    }
  }

  const triggerPhrases = input.triggerPhrases?.length
    ? input.triggerPhrases
    : await extractTriggerPhrasesAsync(input.description, options?.systemOneProvider, options?.jevModel)

  return applyGrievance(record, { ...input, triggerPhrases }, createId)
}

export function applyRelationshipEvidence(
  state: Nan0RelationshipState,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Nan0RelationshipMutationResult {
  if (input.actorId === 'nan0')
    return { relationships: state, record: null, applied: false }

  const relationshipId = relationshipIdFor(input, options?.identity, options?.ownerId)
  const existing = state.records[relationshipId]
    ?? createRelationshipRecord({ ...input, at: input.timestamp, identity: options?.identity, ownerId: options?.ownerId, ownerDisplayName: options?.ownerDisplayName })
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
    importance: isOwnerRecord(input.actorId, options?.identity, options?.ownerId)
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

  const protectedRecord = protectOwnerRecord(record, options?.identity, options?.ownerId, options?.ownerDisplayName)

  if (options?.entityLedger)
    syncRelationshipWithEntityLedger(protectedRecord, options.entityLedger)

  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectedRecord },
    },
    record: structuredClone(protectedRecord),
    applied: true,
  }
}

export async function applyRelationshipEvidenceAsync(
  state: Nan0RelationshipState,
  input: Nan0RelationshipEvidenceInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Promise<Nan0RelationshipMutationResult> {
  if (input.actorId === 'nan0')
    return { relationships: state, record: null, applied: false }

  const relationshipId = relationshipIdFor(input, options?.identity, options?.ownerId)
  const existing = state.records[relationshipId]
    ?? createRelationshipRecord({ ...input, at: input.timestamp, identity: options?.identity, ownerId: options?.ownerId, ownerDisplayName: options?.ownerDisplayName })
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

  const activeGrievances = await applyGrievanceAsync(existing, { ...input, intensity }, createId, options)

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
    importance: isOwnerRecord(input.actorId, options?.identity, options?.ownerId)
      ? 1
      : clamp(existing.importance + (significant ? 0.01 : 0)),
    significantEventIds: significant
      ? Array.from(new Set([...existing.significantEventIds, input.eventId]))
      : existing.significantEventIds,
    turnIds: [...existing.turnIds, input.turnId],
    moments: [...existing.moments, moment].slice(-RELATIONSHIP_MAX_MOMENTS),
    activeGrievances,
    metadata,
  }
  if (significant)
    record = { ...record, status: evaluateStatus(record) }

  const protectedRecord = protectOwnerRecord(record, options?.identity, options?.ownerId, options?.ownerDisplayName)

  if (options?.entityLedger)
    syncRelationshipWithEntityLedger(protectedRecord, options.entityLedger)

  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectedRecord },
    },
    record: structuredClone(protectedRecord),
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

export function protectOwnerRecord(
  record: Nan0RelationshipRecord,
  identity?: Nan0IdentityState,
  ownerId = identity?.ownerId || 'kyo',
  ownerDisplayName = identity?.actors[ownerId]?.displayName || 'Kyo',
): Nan0RelationshipRecord {
  if (!isOwnerRecord(record, identity, ownerId))
    return record

  const actualOwnerId = identity?.ownerId || ownerId || (record.actorId === 'kyo' ? 'kyo' : record.actorId)
  const actualDisplayName = identity?.actors[actualOwnerId]?.displayName || ownerDisplayName || 'Kyo'
  const createdAt = record.createdAt

  return {
    ...record,
    actorId: actualOwnerId,
    relationshipId: `relationship:${stableIdPart(actualOwnerId)}`,
    importance: 1,
    positiveAnchors: uniqueBy([...record.positiveAnchors, identityAnchor(createdAt, actualOwnerId, actualDisplayName)], anchor => anchor.anchorId),
    metadata: {
      ...record.metadata,
      actorKind: actualOwnerId === 'kyo' ? 'kyo' : 'owner',
      protected: true,
      relationship: 'creator_anchor',
    },
  }
}

export const protectKyoRecord = protectOwnerRecord

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

export interface Nan0CommitmentInput {
  actorId: string
  task: string
  description?: string
  timestamp: number
  turnId?: string
  eventId?: string
  thoughtId?: string
  source?: Nan0ObservationSource
  claimId?: string
  metadata?: Record<string, unknown>
}

export function recordCommitment(
  state: Nan0RelationshipState,
  input: Nan0CommitmentInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Nan0RelationshipMutationResult {
  const relationshipId = relationshipIdFor({
    actorId: input.actorId,
    actorKind: 'external',
    source: input.source ?? 'chat',
  }, options?.identity, options?.ownerId)
  const existing = state.records[relationshipId]
    ?? createRelationshipRecord({
      actorId: input.actorId,
      actorKind: isOwnerRecord(input.actorId, options?.identity, options?.ownerId) ? 'owner' : 'external',
      source: input.source ?? 'chat',
      at: input.timestamp,
      identity: options?.identity,
      ownerId: options?.ownerId,
      ownerDisplayName: options?.ownerDisplayName,
    })

  const expectationId = `exp:${createId()}`
  const claimId = input.claimId ?? `claim:${createId()}`
  const expectation: Nan0RelationshipExpectation = {
    expectationId,
    provenanceId: `provenance:${expectationId}`,
    eventId: input.eventId ?? `event:${createId()}`,
    turnId: input.turnId ?? `turn:${createId()}`,
    thoughtId: input.thoughtId ?? `thought:${createId()}`,
    timestamp: input.timestamp,
    actorId: input.actorId,
    rule: 'pcl.commitment-recorded',
    description: input.description ?? `Committed to: ${input.task}`,
    status: 'active',
    claimId,
    subject: input.actorId,
    predicate: 'committed_to',
    object: input.task,
    supersededBy: null,
    supersededAt: null,
    metadata: input.metadata ?? {},
  }

  const record: Nan0RelationshipRecord = {
    ...existing,
    updatedAt: input.timestamp,
    familiarity: clamp(existing.familiarity + 0.02),
    expectations: [...existing.expectations, expectation],
  }

  if (options?.entityLedger?.applyPCLClaim) {
    options.entityLedger.applyPCLClaim({
      subject: input.actorId,
      predicate: 'committed_to',
      object: input.task,
      action: 'new',
      evidenceTurnId: input.turnId,
    })
  }

  const protectedRecord = protectOwnerRecord(record, options?.identity, options?.ownerId, options?.ownerDisplayName)
  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectedRecord },
    },
    record: structuredClone(protectedRecord),
    applied: true,
  }
}

export interface Nan0BreachInput {
  actorId: string
  task: string
  description?: string
  timestamp: number
  severity?: number
  turnId?: string
  eventId?: string
  thoughtId?: string
  source?: Nan0ObservationSource
  claimId?: string
  suspicionDelta?: number
  trustDelta?: number
  irritationDelta?: number
  metadata?: Record<string, unknown>
}

export function recordBreach(
  state: Nan0RelationshipState,
  input: Nan0BreachInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Nan0RelationshipMutationResult {
  const relationshipId = relationshipIdFor({
    actorId: input.actorId,
    actorKind: 'external',
    source: input.source ?? 'chat',
  }, options?.identity, options?.ownerId)
  const existing = state.records[relationshipId]
    ?? createRelationshipRecord({
      actorId: input.actorId,
      actorKind: isOwnerRecord(input.actorId, options?.identity, options?.ownerId) ? 'owner' : 'external',
      source: input.source ?? 'chat',
      at: input.timestamp,
      identity: options?.identity,
      ownerId: options?.ownerId,
      ownerDisplayName: options?.ownerDisplayName,
    })

  // Update active expectations matching this task
  const expectations = existing.expectations.map((exp) => {
    if (exp.status === 'active' && exp.object?.toLowerCase() === input.task.toLowerCase()) {
      return { ...exp, status: 'violated' as const }
    }
    return exp
  })

  const grievanceId = `grievance:${createId()}`
  const claimId = input.claimId ?? `claim:${createId()}`
  const severity = clamp(input.severity ?? 0.7)
  const desc = input.description ?? `Broke commitment on: ${input.task}`
  const triggerPhrases = extractTriggerPhrases(desc)

  const grievance: Nan0RelationshipGrievance = {
    grievanceId,
    provenanceId: `provenance:${grievanceId}`,
    eventId: input.eventId ?? `event:${createId()}`,
    turnId: input.turnId ?? `turn:${createId()}`,
    thoughtId: input.thoughtId ?? `thought:${createId()}`,
    timestamp: input.timestamp,
    actorId: input.actorId,
    rule: 'pcl.commitment-breach',
    description: desc,
    severity,
    status: 'active',
    lastReinforcedAt: input.timestamp,
    reinforcementCount: 0,
    decayRatePerDay: DEFAULT_GRIEVANCE_DECAY_PER_DAY,
    resolvedAt: null,
    triggerPhrases,
    claimId,
    subject: input.actorId,
    predicate: 'broke_commitment',
    object: input.task,
    action: 'new',
    supersededBy: null,
    supersededAt: null,
    metadata: input.metadata ?? {},
  }

  const suspicionDelta = input.suspicionDelta ?? 0.15
  const trustDelta = input.trustDelta ?? 0.15
  const irritationDelta = input.irritationDelta ?? 0.10

  const momentId = `moment:${createId()}`
  const moment: Nan0RelationshipMoment = {
    provenanceId: `provenance:${momentId}`,
    eventId: input.eventId ?? `event:${createId()}`,
    turnId: input.turnId ?? `turn:${createId()}`,
    thoughtId: input.thoughtId ?? `thought:${createId()}`,
    timestamp: input.timestamp,
    actorId: input.actorId,
    rule: 'pcl.commitment-breach',
    eventType: 'negative',
    description: desc,
    intensity: severity,
  }

  let record: Nan0RelationshipRecord = {
    ...existing,
    updatedAt: input.timestamp,
    emotionalBalance: clamp(existing.emotionalBalance - 0.15, -1, 1),
    suspicion: clamp(existing.suspicion + suspicionDelta),
    trust: clamp(existing.trust - trustDelta),
    irritation: clamp(existing.irritation + irritationDelta),
    expectations,
    activeGrievances: [...existing.activeGrievances, grievance],
    moments: [...existing.moments, moment].slice(-RELATIONSHIP_MAX_MOMENTS),
    metadata: {
      ...existing.metadata,
      totalNegativeMoments: negativeCount(existing) + 1,
    },
  }
  record = { ...record, status: evaluateStatus(record) }

  if (options?.entityLedger?.applyPCLClaim) {
    options.entityLedger.applyPCLClaim({
      subject: input.actorId,
      predicate: 'broke_commitment',
      object: input.task,
      action: 'new',
      evidenceTurnId: input.turnId,
    })
  }

  const protectedRecord = protectOwnerRecord(record, options?.identity, options?.ownerId, options?.ownerDisplayName)
  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectedRecord },
    },
    record: structuredClone(protectedRecord),
    applied: true,
  }
}

export interface Nan0RepairInput {
  actorId: string
  task?: string
  grievanceId?: string
  claimId?: string
  resolution?: string
  timestamp: number
  turnId?: string
  eventId?: string
  thoughtId?: string
  source?: Nan0ObservationSource
  repairClaimId?: string
  suspicionDelta?: number
  trustDelta?: number
  irritationDelta?: number
  metadata?: Record<string, unknown>
}

export function recordRepair(
  state: Nan0RelationshipState,
  input: Nan0RepairInput,
  createId: () => string,
  options?: Nan0RelationshipEvidenceOptions,
): Nan0RelationshipMutationResult {
  const relationshipId = relationshipIdFor({
    actorId: input.actorId,
    actorKind: 'external',
    source: input.source ?? 'chat',
  }, options?.identity, options?.ownerId)
  const existing = state.records[relationshipId]
  if (!existing)
    return { relationships: state, record: null, applied: false }

  const repairClaimId = input.repairClaimId ?? `claim:${createId()}`

  // Find grievance by grievanceId, claimId, or task
  let targetGrievance: Nan0RelationshipGrievance | undefined
  const activeGrievances = existing.activeGrievances.map((grievance) => {
    const matches = (input.grievanceId && grievance.grievanceId === input.grievanceId)
      || (input.claimId && grievance.claimId === input.claimId)
      || (input.task && grievance.object?.toLowerCase() === input.task.toLowerCase())
      || (input.task && grievance.description.toLowerCase().includes(input.task.toLowerCase()))

    if (matches && (grievance.status === 'active' || grievance.status === 'nurtured')) {
      targetGrievance = grievance
      return {
        ...grievance,
        status: 'resolved' as const,
        resolvedAt: input.timestamp,
        supersededBy: repairClaimId,
        supersededAt: input.timestamp,
        action: 'update' as const,
        description: `${grievance.description} [Repaired: ${input.resolution ?? 'commitment repaired'}]`,
      }
    }
    return grievance
  })

  if (!targetGrievance)
    return { relationships: state, record: structuredClone(existing), applied: false }

  // Also mark any matching expectation as met
  const expectations = existing.expectations.map((exp) => {
    const matches = (input.task && exp.object?.toLowerCase() === input.task.toLowerCase())
      || (targetGrievance?.object && exp.object?.toLowerCase() === targetGrievance.object.toLowerCase())
    if (matches && exp.status === 'violated') {
      return {
        ...exp,
        status: 'met' as const,
        supersededBy: repairClaimId,
        supersededAt: input.timestamp,
      }
    }
    return exp
  })

  const suspicionDelta = input.suspicionDelta ?? 0.15
  const trustDelta = input.trustDelta ?? 0.10
  const irritationDelta = input.irritationDelta ?? 0.10

  const momentId = `moment:${createId()}`
  const moment: Nan0RelationshipMoment = {
    provenanceId: `provenance:${momentId}`,
    eventId: input.eventId ?? `event:${createId()}`,
    turnId: input.turnId ?? `turn:${createId()}`,
    thoughtId: input.thoughtId ?? `thought:${createId()}`,
    timestamp: input.timestamp,
    actorId: input.actorId,
    rule: 'pcl.commitment-repaired',
    eventType: 'grudge_resolved',
    description: `Repaired commitment: ${targetGrievance.object || input.task || 'task'} (${input.resolution ?? 'repaired'})`,
    intensity: 0.5,
  }

  let record: Nan0RelationshipRecord = {
    ...existing,
    updatedAt: input.timestamp,
    emotionalBalance: clamp(existing.emotionalBalance + 0.10, -1, 1),
    suspicion: clamp(existing.suspicion - suspicionDelta),
    trust: clamp(existing.trust + trustDelta),
    irritation: clamp(existing.irritation - irritationDelta),
    expectations,
    activeGrievances,
    moments: [...existing.moments, moment].slice(-RELATIONSHIP_MAX_MOMENTS),
    metadata: {
      ...existing.metadata,
      totalPositiveMoments: positiveCount(existing) + 1,
    },
  }
  record = { ...record, status: evaluateStatus(record) }

  if (options?.entityLedger?.applyPCLClaim) {
    options.entityLedger.applyPCLClaim({
      subject: input.actorId,
      predicate: 'repaired_commitment',
      object: targetGrievance.object || input.task || 'task',
      action: 'update',
      evidenceTurnId: input.turnId,
    })
  }

  const protectedRecord = protectOwnerRecord(record, options?.identity, options?.ownerId, options?.ownerDisplayName)
  return {
    relationships: {
      ...state,
      records: { ...state.records, [relationshipId]: protectedRecord },
    },
    record: structuredClone(protectedRecord),
    applied: true,
  }
}

export function syncRelationshipWithEntityLedger(
  record: Nan0RelationshipRecord,
  entityLedger: Nan0EntityLedgerAdapter,
): void {
  if (!entityLedger)
    return

  if (entityLedger.getOrCreateEntity) {
    entityLedger.getOrCreateEntity(record.actorId, 'person', {
      status: record.status,
      emotionalBalance: record.emotionalBalance,
      familiarity: record.familiarity,
      trust: record.trust,
      attachment: record.attachment,
      suspicion: record.suspicion,
      importance: record.importance,
      protected: record.metadata.protected ?? false,
    })
  }

  if (entityLedger.applyPCLClaim) {
    for (const anchor of record.positiveAnchors) {
      entityLedger.applyPCLClaim({
        subject: record.actorId,
        predicate: anchor.rule ?? 'identity.creator_anchor',
        object: anchor.description,
        action: 'new',
        evidenceTurnId: anchor.turnId,
      })
    }

    for (const exp of record.expectations) {
      entityLedger.applyPCLClaim({
        subject: exp.subject ?? record.actorId,
        predicate: exp.predicate ?? 'committed_to',
        object: exp.object ?? exp.description,
        action: exp.status === 'violated' ? 'invalidate' : 'new',
        evidenceTurnId: exp.turnId,
      })
    }

    for (const grievance of record.activeGrievances) {
      entityLedger.applyPCLClaim({
        subject: grievance.subject ?? record.actorId,
        predicate: grievance.predicate ?? 'broke_commitment',
        object: grievance.object ?? grievance.description,
        action: grievance.status === 'resolved' ? 'invalidate' : 'new',
        evidenceTurnId: grievance.turnId,
      })
    }
  }
}
