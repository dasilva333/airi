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
    const norm = label.trim().toLowerCase()
    // Look up by exact alias first
    const existingIds = this.byAlias.get(norm)
    if (existingIds && existingIds.size > 0) {
      const id = Array.from(existingIds)[0]
      const ent = this.entities.get(id)
      if (ent) {
        if (type !== 'unknown' && ent.type === 'unknown')
          ent.type = type
        Object.assign(ent.attributes, attributes)
        return ent
      }
    }

    const entityId = `ent_${label.replace(/\s+/g, '_')}_${this.entities.size + 1}`
    const entity: EntityRecord = {
      entityId,
      label,
      type,
      attributes: { ...attributes },
      mentions: new Set(),
    }
    this.entities.set(entityId, entity)

    if (!this.byAlias.has(norm)) {
      this.byAlias.set(norm, new Set())
    }
    this.byAlias.get(norm)!.add(entityId)

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
      list = list.filter(c => c.subject.toLowerCase() === s)
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
