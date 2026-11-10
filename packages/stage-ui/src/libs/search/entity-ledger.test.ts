import { describe, expect, it } from 'vitest'

import { cosineSimilarity, EntityLedger, normalizeCanonicalEntityLabel } from './entity-ledger'

describe('normalizeCanonicalEntityLabel', () => {
  it('handles empty', () => {
    const r = normalizeCanonicalEntityLabel('')
    expect(r).toBeTruthy()
  })
  it('stutter', () => {
    const r = normalizeCanonicalEntityLabel('N-Nords')
    expect(r.canonical).toContain('Nords')
  })
  it('strips honorific camel', () => {
    const r = normalizeCanonicalEntityLabel('AliceChan')
    expect(r.canonical).toContain('Alice')
  })
  it('handles hyphen honorific', () => {
    const r = normalizeCanonicalEntityLabel('alice-chan')
    expect(r).toBeTruthy()
  })
  it('plain label', () => {
    const r = normalizeCanonicalEntityLabel('  Bob  ')
    expect(r.normalizedKey).toBe('bob')
  })
})

describe('entityLedger', () => {
  it('addSource', () => {
    const L = new EntityLedger()
    L.addSource({ turnId: 't1', text: 'x', speaker: 'airi', timestamp: 1 })
    expect(L.sources.size).toBe(1)
    expect(L.bySource.has('t1')).toBe(true)
  })

  it('getOrCreateEntity new and existing', () => {
    const L = new EntityLedger()
    const e1 = L.getOrCreateEntity('Alice', 'person')
    const e2 = L.getOrCreateEntity('alice')
    expect(e2.entityId).toBe(e1.entityId)
    expect(e1.type).toBe('person')
    // canonical
    const e3 = L.getOrCreateEntity('  Bob Chan  ', 'person')
    expect(e3.attributes.aliases).toContain('Bob Chan')
  })

  it('addMention', () => {
    const L = new EntityLedger()
    const e = L.getOrCreateEntity('X')
    const m = L.addMention({ span: 'x', turnId: 't1', entityId: e.entityId })
    expect(e.mentions.has(m.mentionId)).toBe(true)
    // unknown entity
    const m2 = L.addMention({ span: 'y', turnId: 't1', entityId: 'nope' })
    expect(m2.mentionId).toBeTruthy()
  })

  it('addClaim and indexes', () => {
    const L = new EntityLedger()
    const c = L.addClaim({ subject: 'A', predicate: 'likes', object: 'B', evidence: ['t1'] })
    expect(L.claims.size).toBe(1)
    expect(L.bySource.get('t1')?.has(c.claimId)).toBe(true)
    expect(L.bySubjectPredicate.get('A')?.get('likes')?.has(c.claimId)).toBe(true)
  })

  it('addEvent', () => {
    const L = new EntityLedger()
    const ev = L.addEvent({ type: 'meet', roles: { a: 1 }, claimIds: ['c1'] })
    expect(L.events.size).toBe(1)
    expect(L.byEvent.get(ev.eventId)?.has('c1')).toBe(true)
  })

  it('queryEntities', () => {
    const L = new EntityLedger()
    L.getOrCreateEntity('Alice', 'person', { foo: 'bar' })
    L.getOrCreateEntity('Bob', 'place')
    expect(L.queryEntities('person').length).toBe(1)
    expect(L.queryEntities('all', 'ali').length).toBe(1)
    expect(L.queryEntities(undefined, 'bar').length).toBe(1)
  })

  it('queryClaims', () => {
    const L = new EntityLedger()
    L.addClaim({ subject: 'Alice', predicate: 'likes', object: 'Bob' })
    L.addClaim({ subject: 'Alice', predicate: 'knows', object: 'Carol', qualifiers: { isCurrent: false } })
    expect(L.queryClaims('alice', 'likes').length).toBe(1)
    expect(L.queryClaims('alice').length).toBe(2)
    expect(L.queryClaims(undefined, undefined, true).length).toBe(1)
  })

  it('applyPCLClaim reinforce/update/invalidate/new', () => {
    const L = new EntityLedger()
    const c0 = L.addClaim({ subject: 'A', predicate: 'p', object: 'B' })
    // reinforce
    const r1 = L.applyPCLClaim({ subject: 'A', predicate: 'P', object: 'B', action: 'reinforce' })
    expect(r1.actionTaken).toBe('reinforced')
    // update
    const r2 = L.applyPCLClaim({ subject: 'A', predicate: 'p', object: 'C', action: 'update', date: '2020', evidenceTurnId: 't1' })
    expect(r2.actionTaken).toBe('updated')
    // invalidate
    const r3 = L.applyPCLClaim({ subject: 'A', predicate: 'p', object: 'C', action: 'invalidate' })
    expect(r3.actionTaken).toBe('invalidated')
    // new
    const r4 = L.applyPCLClaim({ subject: 'X', predicate: 'q', object: 'Y', action: 'new' })
    expect(r4.actionTaken).toBe('created')
    // reinforce not found falls to? action reinforce with no match -> falls through to new
    const r5 = L.applyPCLClaim({ subject: 'Z', predicate: 'q', object: 'W', action: 'reinforce' })
    expect(r5.actionTaken).toBe('created')
    expect(c0.claimId).toBeTruthy()
  })

  it('getSummaryStats', () => {
    const L = new EntityLedger()
    L.addSource({ turnId: 't1', text: 'x', speaker: 'airi', timestamp: 1 })
    const s = L.getSummaryStats()
    expect(s.sourcesCount).toBe(1)
  })

  it('toJSON/fromJSON roundtrip', () => {
    const L = new EntityLedger()
    L.addSource({ turnId: 't1', text: 'x', speaker: 'airi', timestamp: 1 })
    L.getOrCreateEntity('Alice', 'person')
    L.addClaim({ subject: 'A', predicate: 'p', object: 'B', evidence: ['t1'] })
    L.addEvent({ type: 'e', claimIds: ['claim_1'] })
    const json = L.toJSON()
    const L2 = EntityLedger.fromJSON(json)
    expect(L2.sources.size).toBe(1)
    expect(L2.entities.size).toBe(1)
    expect(L2.claims.size).toBe(1)
    expect(L2.events.size).toBe(1)
    expect(L2.ingestion.size).toBe(0)
  })

  it('fromJSON null/empty', () => {
    const L = EntityLedger.fromJSON(null)
    expect(L.sources.size).toBe(0)
    const L2 = EntityLedger.fromJSON({ ingestion: [['k', 'v']] })
    expect(L2.ingestion.get('k')).toBe('v')
  })
})

describe('entity-ledger extra coverage', () => {
  it('reinforce with evidence turn', () => {
    const L = new EntityLedger()
    L.addClaim({ subject: 'A', predicate: 'p', object: 'B', evidence: [] })
    const r = L.applyPCLClaim({ subject: 'A', predicate: 'p', object: 'B', action: 'reinforce', evidenceTurnId: 't9' })
    expect(r.actionTaken).toBe('reinforced')
  })
  it('fromJSON mentions', () => {
    const L = EntityLedger.fromJSON({ mentions: [{ mentionId: 'm1', span: 'x', turnId: 't1', entityId: 'e' }] })
    expect(L.mentions.size).toBe(1)
  })
  it('getOrCreateEntity missing aliases branch', () => {
    const L = new EntityLedger()
    const e = L.getOrCreateEntity('Alice', 'person')
    delete (e.attributes as Record<string, unknown>).aliases
    const e2 = L.getOrCreateEntity('alice')
    expect(e2.entityId).toBe(e.entityId)
  })
  it('multi separator honorific', () => {
    const r = normalizeCanonicalEntityLabel('alice---chan')
    expect(r.canonical).toContain('alice')
  })
  it('canonical lookup path', () => {
    const L = new EntityLedger()
    L.getOrCreateEntity('AliceChan')
    const e2 = L.getOrCreateEntity('Alice-Chan', 'person')
    expect(e2.type).toBe('person')
  })
  it('type upgrade on existing unknown', () => {
    const L = new EntityLedger()
    const e = L.getOrCreateEntity('Zed')
    expect(e.type).toBe('unknown')
    const e2 = L.getOrCreateEntity('zed', 'person')
    expect(e2.type).toBe('person')
  })
  it('update no date evidence', () => {
    const L = new EntityLedger()
    L.addClaim({ subject: 'A', predicate: 'p', object: 'B' })
    const r = L.applyPCLClaim({ subject: 'A', predicate: 'p', object: 'C', action: 'update' })
    expect(r.actionTaken).toBe('updated')
  })
  it('update with date and evidence', () => {
    const L = new EntityLedger()
    L.addClaim({ subject: 'A', predicate: 'p', object: 'B' })
    const r = L.applyPCLClaim({ subject: 'A', predicate: 'p', object: 'C', action: 'update', date: '2020', evidenceTurnId: 't1' })
    expect(r.actionTaken).toBe('updated')
  })
  it('new with evidence and date', () => {
    const L = new EntityLedger()
    const r = L.applyPCLClaim({ subject: 'X', predicate: 'q', object: 'Y', action: 'new', date: '2021', evidenceTurnId: 't2' })
    expect(r.actionTaken).toBe('created')
  })
  it('fromJSON alias exists branch', () => {
    EntityLedger.fromJSON({ entities: [{ entityId: 'e1', label: 'Alice', type: 'person', attributes: {}, mentions: [] }, { entityId: 'e2', label: 'Alice', type: 'person', attributes: {}, mentions: [] }] })
  })
  it('addClaim with non-string object skips object index', () => {
    const l = new EntityLedger()
    const c = l.addClaim({ subject: 's', predicate: 'p', object: 42 } as unknown as Parameters<typeof l.addClaim>[0])
    expect(c.object).toBe(42)
  })
  it('getOrCreateEntity plain', () => {
    const l = new EntityLedger()
    const e = l.getOrCreateEntity('Airi', 'person')
    expect(e.label).toBe('Airi')
  })
})

describe('entity-ledger uncovered branches', () => {
  it('empty label skips empty keys', () => {
    const L = new EntityLedger()
    const e = L.getOrCreateEntity('   ')
    expect(e.entityId).toBeTruthy()
  })
  it('byObjectPredicate existing object+predicate', () => {
    const L = new EntityLedger()
    L.addClaim({ subject: 'A', predicate: 'p', object: 'B' })
    L.addClaim({ subject: 'C', predicate: 'p', object: 'B' })
    expect(L.byObjectPredicate.get('B')?.get('p')?.size).toBe(2)
  })
  it('addEvent with duplicate eventId skips', () => {
    const L = new EntityLedger()
    L.addEvent({ eventId: 'ev1', type: 'meet', claimIds: ['c1'] })
    L.addEvent({ eventId: 'ev1', type: 'meet', claimIds: ['c2'] })
    expect(L.byEvent.get('ev1')?.has('c1')).toBe(true)
  })
})

describe('entity-ledger uncovered branches2', () => {
  it('alias already present', () => {
    const L = new EntityLedger()
    L.getOrCreateEntity('Alice')
    L.getOrCreateEntity('Alice')
    expect(L.entities.size).toBe(1)
  })
  it('type not upgraded', () => {
    const L = new EntityLedger()
    L.getOrCreateEntity('Bob', 'person')
    L.getOrCreateEntity('bob', 'unknown')
    expect(L.entities.size).toBe(1)
  })
})

describe('entity-ledger uncovered branches3', () => {
  it('hyphen non-honorific suffix keeps label', () => {
    const r = normalizeCanonicalEntityLabel('foo-bar')
    expect(r.canonical).toBe('foo-bar')
  })
  it('hyphen short prefix keeps label', () => {
    const r = normalizeCanonicalEntityLabel('a-sama')
    // prefix length < 2, branch false
    expect(r.canonical).toBe('a-sama')
  })
  it('addSource duplicate turnId', () => {
    const l = new EntityLedger()
    l.addSource({ turnId: 't1', text: 'x', speaker: 's', timestamp: 1 })
    l.addSource({ turnId: 't1', text: 'y', speaker: 's', timestamp: 2 })
    expect(l.sources.get('t1')?.text).toBe('y')
  })

  it('getOrCreateEntity missing entity branch', () => {
    const l = new EntityLedger()
    const e = l.getOrCreateEntity('Foo')
    l.entities.delete(e.entityId)
    const e2 = l.getOrCreateEntity('Foo')
    expect(e2.entityId).toBe(e.entityId)
  })

  it('calculates cosineSimilarity and handles edge cases', () => {
    expect(cosineSimilarity(null, null)).toBe(0)
    expect(cosineSimilarity([], [])).toBe(0)
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0)

    const vecA = new Float32Array([1, 0, 0])
    const vecB = new Float32Array([1, 0, 0])
    expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0)

    const vecC = new Float32Array([0, 1, 0])
    expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0)
  })

  it('performs zero-GPU vector search over claims and entities', () => {
    const L = new EntityLedger()
    const vecA = new Float32Array([1, 0, 0])
    const vecB = new Float32Array([0.9, 0.1, 0])
    const vecC = new Float32Array([0, 1, 0])

    const e1 = L.getOrCreateEntity('Dog', 'animal', {}, vecA)
    const e2 = L.getOrCreateEntity('Cat', 'animal', {}, vecC)

    const c1 = L.addClaim({ subject: 'James', predicate: 'owns', object: 'Dog', embedding: vecA })
    const c2 = L.addClaim({ subject: 'James', predicate: 'likes', object: 'Pizza', embedding: vecC })

    // Query with vector matching Dog
    const claimMatches = L.searchClaimsByVector(vecB, 5, 0.5)
    expect(claimMatches.length).toBe(1)
    expect(claimMatches[0].claim.claimId).toBe(c1.claimId)
    expect(claimMatches[0].score).toBeGreaterThan(0.9)

    const entityMatches = L.searchEntitiesByVector(vecB, 5, 0.5)
    expect(entityMatches.length).toBe(1)
    expect(entityMatches[0].entity.entityId).toBe(e1.entityId)

    // Serialization preserves embeddings as Float32Array
    const json = L.toJSON()
    const roundtrip = EntityLedger.fromJSON(json)
    const rtClaim = roundtrip.claims.get(c1.claimId)
    expect(rtClaim?.embedding).toBeInstanceOf(Float32Array)
    expect(rtClaim?.embedding?.[0]).toBeCloseTo(1)

    // Empty query returns empty array
    expect(L.searchClaimsByVector(null)).toEqual([])
    expect(L.searchEntitiesByVector(null)).toEqual([])
  })
})
