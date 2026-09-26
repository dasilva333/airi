/**
 * In-Memory Entity and Event Ledger for Cognitive Memory & Universe RAG++.
 * Provides normalized Maps with secondary indexes, event role modeling,
 * contextual coreference resolution, and serialization for IndexedDB persistence.
 *
 * Follows the peer-reviewed specification in docs/blueprint-semantic-search-integration.md.
 */

export interface SourceRecord {
  turnId: string
  text: string
  speaker: string
  session?: number | string
  sessionDate?: string
  timestamp: number
}

export interface MentionRecord {
  mentionId: string
  span: string
  turnId: string
  entityId: string
}

export type EntityType = 'person' | 'animal' | 'place' | 'organization' | 'activity' | 'concept' | 'unknown'

export interface EntityRecord {
  entityId: string
  label: string
  type: EntityType
  attributes: Record<string, any>
  mentions: Set<string>
}

export interface DateInfo {
  formatted_label?: string
  iso_date?: string
  temporal_expression?: string
  relative_offset_days?: number
}

export interface ClaimRecord {
  claimId: string
  subject: string
  predicate: string
  object: string
  qualifiers?: Record<string, any>
  evidence: string[]
  dateInfo?: DateInfo | null
}

export interface EventRecord {
  eventId: string
  type: string
  roles: Record<string, any>
  turnId?: string | null
  claimIds: Set<string>
}

export interface EntityLedgerJSON {
  sources: SourceRecord[]
  entities: Array<Omit<EntityRecord, 'mentions'> & { mentions: string[] }>
  mentions: MentionRecord[]
  events: Array<Omit<EventRecord, 'claimIds'> & { claimIds: string[] }>
  claims: ClaimRecord[]
  ingestion: [string, any][]
}

export interface CanonicalEntityResolution {
  canonical: string
  normalizedKey: string
  raw: string
  aliasVariants: string[]
}

/**
 * Normalizes an entity label to its canonical root form:
 * 1. Collapses leading stutter repetitions: e.g. "N-Nords" -> "Nords", "T-Teio" -> "Teio", "N-N-Nords" -> "Nords"
 *    (Ensures prefix letter matches the word start so "X-Men" and "Spider-Man" are preserved).
 * 2. Strips Japanese honorific suffixes with arbitrary vowel repetitions (e.g. -chan, -chaaaan, -sama, -saaaama, -kuuuun, -senseeei).
 *    Supports hyphenated/underscored and camelCase styles while maintaining minimum entity length (>= 2 chars).
 */
export function normalizeCanonicalEntityLabel(rawLabel: string): CanonicalEntityResolution {
  const trimmed = rawLabel.trim()
  if (!trimmed) {
    return { canonical: '', normalizedKey: '', raw: rawLabel, aliasVariants: [] }
  }

  let cleaned = trimmed

  // 1. Collapse leading stutter repeats: e.g. "N-Nords" -> "Nords", "T-Teio" -> "Teio", "N-N-Nords" -> "Nords"
  const stutterMatch = cleaned.match(/^([A-Z])-(?:\1-)*(\1[A-Z].*)$/i)
  if (stutterMatch && stutterMatch[2]) {
    cleaned = stutterMatch[2]
  }

  // 2. Strip Japanese honorific suffixes with arbitrary vowel repetitions (e.g. -chan, -chaaaan, -sama, -saaaan, -kuuuun, -senseeei)
  // Hyphenated/underscored suffix: e.g. "Nords-sama", "Evil-chaaaan", "Neuro-chaaaan", "Hiyori-sama", "Neko-sama"
  const hyphenHonorificRegex = /^(.*?)(?:[-_]+)(?:c+h+a+n+|s+a+m+a+|s+a+n+|k+u+n+|s+e+n+[ps]+a+i+|s+e+n+s+e+i+|d+o+n+o+|t+a+n+)$/i
  const hyphenMatch = cleaned.match(hyphenHonorificRegex)
  if (hyphenMatch && hyphenMatch[1] && hyphenMatch[1].trim().length >= 2) {
    cleaned = hyphenMatch[1].trim()
  }
  else {
    // CamelCase suffix: e.g. "AiriChan", "NordsSama"
    const camelHonorificRegex = /^(.*?[a-z]{2})(?:C+h+a+n+|S+a+m+a+|S+a+n+|K+u+n+|S+e+n+[ps]+a+i+|S+e+n+s+e+i+|D+o+n+o+|T+a+a*n+)$/
    const camelMatch = cleaned.match(camelHonorificRegex)
    if (camelMatch && camelMatch[1] && camelMatch[1].trim().length >= 2) {
      cleaned = camelMatch[1].trim()
    }
  }

  const canonical = cleaned.trim() || trimmed
  const normalizedKey = canonical.toLowerCase()
  const rawKey = trimmed.toLowerCase()

  const aliasVariants = [rawKey]
  if (rawKey !== normalizedKey) {
    aliasVariants.push(normalizedKey)
  }

  return {
    canonical,
    normalizedKey,
    raw: trimmed,
    aliasVariants,
  }
}

export class EntityLedger {
  sources = new Map<string, SourceRecord>()
  mentions = new Map<string, MentionRecord>()
  entities = new Map<string, EntityRecord>()
  events = new Map<string, EventRecord>()
  claims = new Map<string, ClaimRecord>()

  // Secondary Indexes
  bySubjectPredicate = new Map<string, Map<string, Set<string>>>()
  byObjectPredicate = new Map<string, Map<string, Set<string>>>()
  byEvent = new Map<string, Set<string>>()
  bySource = new Map<string, Set<string>>()
  byAlias = new Map<string, Set<string>>()
  ingestion = new Map<string, any>()

  addSource(src: SourceRecord): void {
    this.sources.set(src.turnId, src)
    if (!this.bySource.has(src.turnId)) {
      this.bySource.set(src.turnId, new Set())
    }
  }

  getOrCreateEntity(label: string, type: EntityType = 'unknown', attributes: Record<string, any> = {}): EntityRecord {
    const resolution = normalizeCanonicalEntityLabel(label)
    const norm = label.trim().toLowerCase()
    const canonicalNorm = resolution.normalizedKey

    // 1. Look up by exact alias first, then by canonical key
    let existingId: string | undefined
    const exactIds = this.byAlias.get(norm)
    if (exactIds && exactIds.size > 0) {
      existingId = Array.from(exactIds)[0]
    }
    else if (canonicalNorm) {
      const canonicalIds = this.byAlias.get(canonicalNorm)
      if (canonicalIds && canonicalIds.size > 0) {
        existingId = Array.from(canonicalIds)[0]
      }
    }

    if (existingId) {
      const ent = this.entities.get(existingId)
      if (ent) {
        if (type !== 'unknown' && ent.type === 'unknown')
          ent.type = type
        Object.assign(ent.attributes, attributes)

        // Register alias in attributes if newly observed
        if (!ent.attributes.aliases)
          ent.attributes.aliases = []
        if (!ent.attributes.aliases.includes(label.trim()))
          ent.attributes.aliases.push(label.trim())

        // Index in byAlias map
        if (!this.byAlias.has(norm)) {
          this.byAlias.set(norm, new Set())
        }
        this.byAlias.get(norm)!.add(ent.entityId)

        return ent
      }
    }

    // 2. Create new EntityRecord with canonical label
    const canonicalLabel = resolution.canonical || label.trim()
    const entityId = `ent_${canonicalLabel.replace(/\s+/g, '_')}_${this.entities.size + 1}`
    const entity: EntityRecord = {
      entityId,
      label: canonicalLabel,
      type,
      attributes: {
        ...attributes,
        aliases: [label.trim()],
      },
      mentions: new Set(),
    }
    this.entities.set(entityId, entity)

    for (const key of [norm, canonicalNorm]) {
      if (!key)
        continue
      if (!this.byAlias.has(key)) {
        this.byAlias.set(key, new Set())
      }
      this.byAlias.get(key)!.add(entityId)
    }

    return entity
  }

  addMention(mention: { mentionId?: string | null, span: string, turnId: string, entityId: string }): MentionRecord {
    const id = mention.mentionId || `m_${this.mentions.size + 1}`
    const record: MentionRecord = { mentionId: id, span: mention.span, turnId: mention.turnId, entityId: mention.entityId }
    this.mentions.set(id, record)
    if (mention.entityId && this.entities.has(mention.entityId)) {
      this.entities.get(mention.entityId)!.mentions.add(id)
    }
    return record
  }

  addClaim(claim: {
    claimId?: string | null
    subject: string
    predicate: string
    object: string
    qualifiers?: Record<string, any>
    evidence?: string[]
    dateInfo?: DateInfo | null
  }): ClaimRecord {
    const id = claim.claimId || `claim_${this.claims.size + 1}`
    const record: ClaimRecord = {
      claimId: id,
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      qualifiers: claim.qualifiers || {},
      evidence: claim.evidence || [],
      dateInfo: claim.dateInfo || null,
    }
    this.claims.set(id, record)

    // Index by Subject + Predicate
    if (!this.bySubjectPredicate.has(claim.subject)) {
      this.bySubjectPredicate.set(claim.subject, new Map())
    }
    const predMap = this.bySubjectPredicate.get(claim.subject)!
    if (!predMap.has(claim.predicate)) {
      predMap.set(claim.predicate, new Set())
    }
    predMap.get(claim.predicate)!.add(id)

    // Index by Object + Predicate
    if (typeof claim.object === 'string') {
      if (!this.byObjectPredicate.has(claim.object)) {
        this.byObjectPredicate.set(claim.object, new Map())
      }
      const objPredMap = this.byObjectPredicate.get(claim.object)!
      if (!objPredMap.has(claim.predicate)) {
        objPredMap.set(claim.predicate, new Set())
      }
      objPredMap.get(claim.predicate)!.add(id)
    }

    // Index by Source Turn IDs
    for (const turnId of record.evidence) {
      if (!this.bySource.has(turnId)) {
        this.bySource.set(turnId, new Set())
      }
      this.bySource.get(turnId)!.add(id)
    }

    return record
  }

  addEvent(event: {
    eventId?: string | null
    type: string
    roles?: Record<string, any>
    turnId?: string | null
    claimIds?: string[]
  }): EventRecord {
    const id = event.eventId || `event_${event.type}_${this.events.size + 1}`
    const record: EventRecord = {
      eventId: id,
      type: event.type,
      roles: { ...event.roles },
      turnId: event.turnId || null,
      claimIds: new Set(event.claimIds || []),
    }
    this.events.set(id, record)

    if (!this.byEvent.has(id)) {
      this.byEvent.set(id, new Set(event.claimIds || []))
    }

    return record
  }

  queryEntities(type?: EntityType | 'all', search?: string): EntityRecord[] {
    let list = Array.from(this.entities.values())
    if (type && type !== 'all') {
      list = list.filter(e => e.type === type)
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(e => e.label.toLowerCase().includes(q) || Object.values(e.attributes).some(v => String(v).toLowerCase().includes(q)))
    }
    return list
  }

  queryClaims(subject?: string, predicate?: string, currentOnly = false): ClaimRecord[] {
    let list = Array.from(this.claims.values())
    if (currentOnly) {
      list = list.filter(c => c.qualifiers?.isCurrent !== false)
    }
    if (subject && subject.trim()) {
      const s = subject.trim().toLowerCase()
      const canonicalS = normalizeCanonicalEntityLabel(subject).normalizedKey
      list = list.filter((c) => {
        const cSub = c.subject.toLowerCase()
        return cSub === s || (canonicalS && normalizeCanonicalEntityLabel(c.subject).normalizedKey === canonicalS)
      })
    }
    if (predicate && predicate.trim()) {
      const p = predicate.trim().toLowerCase()
      list = list.filter(c => c.predicate.toLowerCase() === p)
    }
    return list
  }

  applyPCLClaim(claim: {
    subject: string
    predicate: string
    object: string
    action: 'new' | 'reinforce' | 'update' | 'invalidate'
    date?: string
    evidenceTurnId?: string
  }): { claimId: string, actionTaken: 'created' | 'reinforced' | 'updated' | 'invalidated' } {
    const sNorm = claim.subject.trim().toLowerCase()
    const pNorm = claim.predicate.trim().toLowerCase()
    const oNorm = claim.object.trim().toLowerCase()

    if (claim.action === 'reinforce') {
      const existing = Array.from(this.claims.values()).find(c =>
        c.subject.toLowerCase() === sNorm
        && c.predicate.toLowerCase() === pNorm
        && c.object.toLowerCase() === oNorm
        && c.qualifiers?.isCurrent !== false,
      )
      if (existing) {
        existing.qualifiers = {
          ...existing.qualifiers,
          isCurrent: true,
          reinforcementCount: ((existing.qualifiers?.reinforcementCount as number) || 1) + 1,
          lastReinforcedAt: Date.now(),
        }
        if (claim.evidenceTurnId && !existing.evidence.includes(claim.evidenceTurnId)) {
          existing.evidence.push(claim.evidenceTurnId)
        }
        return { claimId: existing.claimId, actionTaken: 'reinforced' }
      }
    }

    if (claim.action === 'update') {
      const prior = Array.from(this.claims.values()).filter(c =>
        c.subject.toLowerCase() === sNorm
        && c.predicate.toLowerCase() === pNorm
        && c.object.toLowerCase() !== oNorm
        && c.qualifiers?.isCurrent !== false,
      )
      const newClaimId = `claim_${this.claims.size + 1}`
      for (const oldClaim of prior) {
        oldClaim.qualifiers = {
          ...oldClaim.qualifiers,
          isCurrent: false,
          supersededBy: newClaimId,
          supersededAt: Date.now(),
        }
      }
      this.getOrCreateEntity(claim.subject)
      this.getOrCreateEntity(claim.object)
      this.addClaim({
        claimId: newClaimId,
        subject: claim.subject,
        predicate: claim.predicate,
        object: claim.object,
        qualifiers: {
          isCurrent: true,
          action: 'update',
          supersededPrevious: prior.map(p => p.claimId),
        },
        evidence: claim.evidenceTurnId ? [claim.evidenceTurnId] : [],
        dateInfo: claim.date ? { iso_date: claim.date } : null,
      })
      return { claimId: newClaimId, actionTaken: 'updated' }
    }

    if (claim.action === 'invalidate') {
      const matching = Array.from(this.claims.values()).filter(c =>
        c.subject.toLowerCase() === sNorm
        && c.predicate.toLowerCase() === pNorm
        && (oNorm ? c.object.toLowerCase() === oNorm : true)
        && c.qualifiers?.isCurrent !== false,
      )
      for (const c of matching) {
        c.qualifiers = {
          ...c.qualifiers,
          isCurrent: false,
          invalidatedAt: Date.now(),
        }
      }
      return { claimId: matching[0]?.claimId || '', actionTaken: 'invalidated' }
    }

    // Default: 'new' (or fallback for reinforce when not found)
    this.getOrCreateEntity(claim.subject)
    this.getOrCreateEntity(claim.object)
    const record = this.addClaim({
      subject: claim.subject,
      predicate: claim.predicate,
      object: claim.object,
      qualifiers: {
        isCurrent: true,
        action: 'new',
        reinforcementCount: 1,
      },
      evidence: claim.evidenceTurnId ? [claim.evidenceTurnId] : [],
      dateInfo: claim.date ? { iso_date: claim.date } : null,
    })
    return { claimId: record.claimId, actionTaken: 'created' }
  }

  getSummaryStats() {
    return {
      sourcesCount: this.sources.size,
      entitiesCount: this.entities.size,
      mentionsCount: this.mentions.size,
      claimsCount: this.claims.size,
      eventsCount: this.events.size,
    }
  }

  /**
   * Serialize ledger to a JSON-compatible object for IndexedDB/unstorage caching.
   */
  toJSON(): EntityLedgerJSON {
    return {
      sources: Array.from(this.sources.values()),
      entities: Array.from(this.entities.values()).map(e => ({
        ...e,
        mentions: Array.from(e.mentions),
      })),
      mentions: Array.from(this.mentions.values()),
      events: Array.from(this.events.values()).map(e => ({
        ...e,
        claimIds: Array.from(e.claimIds || []),
      })),
      claims: Array.from(this.claims.values()),
      ingestion: Array.from(this.ingestion.entries()),
    }
  }

  /**
   * Hydrate ledger from a serialized JSON object.
   */
  static fromJSON(data: any): EntityLedger {
    const ledger = new EntityLedger()
    if (!data)
      return ledger

    if (Array.isArray(data.sources)) {
      for (const s of data.sources) ledger.addSource(s)
    }
    if (Array.isArray(data.entities)) {
      for (const e of data.entities) {
        ledger.entities.set(e.entityId, { ...e, mentions: new Set(e.mentions || []) })
        const norm = e.label.trim().toLowerCase()
        if (!ledger.byAlias.has(norm))
          ledger.byAlias.set(norm, new Set())
        ledger.byAlias.get(norm)!.add(e.entityId)
      }
    }
    if (Array.isArray(data.mentions)) {
      for (const m of data.mentions) {
        ledger.mentions.set(m.mentionId, m)
      }
    }
    if (Array.isArray(data.events)) {
      for (const ev of data.events) {
        ledger.events.set(ev.eventId, { ...ev, claimIds: new Set(ev.claimIds || []) })
        ledger.byEvent.set(ev.eventId, new Set(ev.claimIds || []))
      }
    }
    if (Array.isArray(data.claims)) {
      for (const c of data.claims) {
        ledger.addClaim(c)
      }
    }
    if (Array.isArray(data.ingestion)) {
      for (const [k, v] of data.ingestion) ledger.ingestion.set(k, v)
    }

    return ledger
  }
}
