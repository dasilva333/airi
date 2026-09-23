import { describe, expect, it } from 'vitest'

import { EntityLedger } from './entity-ledger'

describe('entityLedger', () => {
  it('creates and aliases entities correctly', () => {
    const ledger = new EntityLedger()
    const ent1 = ledger.getOrCreateEntity('Ned', 'animal', { species: 'dog' })
    expect(ent1.entityId).toBeDefined()
    expect(ent1.label).toBe('Ned')
    expect(ent1.type).toBe('animal')

    // Case-insensitive lookup matches the alias
    const ent2 = ledger.getOrCreateEntity('ned')
    expect(ent2.entityId).toBe(ent1.entityId)
    expect(ent2.attributes.species).toBe('dog')
  })

  it('indexes claims by subject and object', () => {
    const ledger = new EntityLedger()
    ledger.addClaim({
      subject: 'James',
      predicate: 'adopted',
      object: 'Ned',
      evidence: ['turn-1'],
    })

    const claims = ledger.queryClaims('James')
    expect(claims).toHaveLength(1)
    expect(claims[0].predicate).toBe('adopted')
    expect(claims[0].object).toBe('Ned')

    expect(ledger.bySubjectPredicate.get('James')?.get('adopted')?.size).toBe(1)
    expect(ledger.byObjectPredicate.get('Ned')?.get('adopted')?.size).toBe(1)
  })

  it('serializes and deserializes cleanly without losing data', () => {
    const ledger = new EntityLedger()
    ledger.addSource({
      turnId: 't-1',
      text: 'James adopted Ned in Stamford',
      speaker: 'User',
      timestamp: 1720000000000,
    })
    const ent = ledger.getOrCreateEntity('Ned', 'animal')
    ledger.addMention({ span: 'Ned', turnId: 't-1', entityId: ent.entityId })
    ledger.addClaim({
      subject: 'James',
      predicate: 'adopted',
      object: 'Ned',
      evidence: ['t-1'],
      dateInfo: { formatted_label: 'July 3, 2024' },
    })

    const json = ledger.toJSON()
    const restored = EntityLedger.fromJSON(json)

    expect(restored.sources.size).toBe(1)
    expect(restored.entities.size).toBe(1)
    expect(restored.claims.size).toBe(1)
    expect(restored.queryClaims('James')[0].dateInfo?.formatted_label).toBe('July 3, 2024')
    expect(restored.getOrCreateEntity('Ned').entityId).toBe(ent.entityId)
  })

  it('extracts proper nouns cleanly without classifying verbs or snacks as animals', async () => {
    const { extractTurnKnowledge } = await import('./ledger-priming')
    const ledger = new EntityLedger()

    const classificationMap = new Map<string, any>([
      ['Shinji', 'person'],
      ['Misato', 'person'],
      ['Asuka', 'person'],
      ['NERV', 'organization'],
    ])

    // Test turn with contractions, snacks, proper nouns, and an ID
    extractTurnKnowledge(
      'User: I didn\'t want to step over Shinji, but I got snacks for Misato and Asuka at NERV.',
      {
        id: 'turn-1',
        speaker: 'User',
        text: 'I didn\'t want to step over Shinji, but I got snacks for Misato and Asuka at NERV.',
        timestamp: 1720000000000,
      },
      ledger,
      classificationMap,
    )

    const entities = Array.from(ledger.entities.values())
    const labels = entities.map(e => e.label)

    // Should contain true proper nouns
    expect(labels).toContain('Shinji')
    expect(labels).toContain('Misato')
    expect(labels).toContain('Asuka')
    expect(labels).toContain('NERV')
    expect(labels).toContain('User')

    // Person entities should be typed person
    const asuka = ledger.getOrCreateEntity('Asuka')
    expect(asuka.type).toBe('person')

    // NERV should be typed organization
    const nerv = ledger.getOrCreateEntity('NERV')
    expect(nerv.type).toBe('organization')

    // Must NOT contain contraction fragments or common words as animals
    expect(labels).not.toContain('t')
    expect(labels).not.toContain('ve')
    expect(labels).not.toContain('didn')
    expect(labels).not.toContain('snacks')
    expect(labels).not.toContain('got')

    // No animal should exist in this turn
    const animals = entities.filter(e => e.type === 'animal')
    expect(animals).toHaveLength(0)
  })

  it('correctly classifies animals like Pen-Pen and penguin via System 1 and discards conversational artifacts', async () => {
    const { extractTurnKnowledge } = await import('./ledger-priming')
    const ledger = new EntityLedger()

    const classificationMap = new Map<string, any>([
      ['Misato', 'person'],
      ['penguin', 'animal'],
      ['Pen-Pen', 'animal'],
      ['Obviously', 'conversational_artifact'],
      ['Goodnight', 'conversational_artifact'],
      ['Trigonometry', 'activity'],
    ])

    extractTurnKnowledge(
      'Misato: Obviously, I brought home a pet penguin named Pen-Pen to study Trigonometry. Goodnight!',
      {
        id: 'turn-2',
        speaker: 'Misato',
        text: 'Obviously, I brought home a pet penguin named Pen-Pen to study Trigonometry. Goodnight!',
        timestamp: 1720000001000,
      },
      ledger,
      classificationMap,
    )

    const entities = Array.from(ledger.entities.values())
    const labels = entities.map(e => e.label)

    // Should include pet penguin and Pen-Pen
    expect(labels).toContain('Pen-Pen')
    expect(labels).toContain('penguin')
    expect(ledger.getOrCreateEntity('Pen-Pen').type).toBe('animal')
    expect(ledger.getOrCreateEntity('penguin').type).toBe('animal')

    // Should include Trigonometry as activity
    expect(labels).toContain('Trigonometry')
    expect(ledger.getOrCreateEntity('Trigonometry').type).toBe('activity')

    // Should completely discard conversational artifacts
    expect(labels).not.toContain('Obviously')
    expect(labels).not.toContain('Goodnight')
  })

  describe('pCL Contradiction Resolution & Invalidation', () => {
    it('creates new claims with isCurrent: true', () => {
      const ledger = new EntityLedger()
      const res = ledger.applyPCLClaim({
        subject: 'Sam',
        predicate: 'likes',
        object: 'pickles',
        action: 'new',
      })

      expect(res.actionTaken).toBe('created')
      const claims = ledger.queryClaims('Sam', 'likes', true)
      expect(claims).toHaveLength(1)
      expect(claims[0].object).toBe('pickles')
      expect(claims[0].qualifiers?.isCurrent).toBe(true)
    })

    it('reinforces existing claims by incrementing reinforcement count', () => {
      const ledger = new EntityLedger()
      ledger.applyPCLClaim({
        subject: 'Sam',
        predicate: 'likes',
        object: 'pickles',
        action: 'new',
      })

      const res = ledger.applyPCLClaim({
        subject: 'Sam',
        predicate: 'likes',
        object: 'pickles',
        action: 'reinforce',
        evidenceTurnId: 'turn-99',
      })

      expect(res.actionTaken).toBe('reinforced')
      const claims = ledger.queryClaims('Sam', 'likes', true)
      expect(claims).toHaveLength(1)
      expect(claims[0].qualifiers?.reinforcementCount).toBe(2)
      expect(claims[0].evidence).toContain('turn-99')
    })

    it('updates beliefs by superseding prior claims (Predict-Calibrate-Learn)', () => {
      const ledger = new EntityLedger()
      // Initial belief: Sam likes pickles
      const initial = ledger.applyPCLClaim({
        subject: 'Sam',
        predicate: 'likes',
        object: 'pickles',
        action: 'new',
      })

      // Evolving truth / Contradiction: Sam now hates pickles (or prefers olives)
      const updateRes = ledger.applyPCLClaim({
        subject: 'Sam',
        predicate: 'likes',
        object: 'olives',
        action: 'update',
      })

      expect(updateRes.actionTaken).toBe('updated')

      // Query only current beliefs
      const currentClaims = ledger.queryClaims('Sam', 'likes', true)
      expect(currentClaims).toHaveLength(1)
      expect(currentClaims[0].object).toBe('olives')
      expect(currentClaims[0].qualifiers?.isCurrent).toBe(true)

      // Query all claims (historical audit trail)
      const allClaims = ledger.queryClaims('Sam', 'likes', false)
      expect(allClaims).toHaveLength(2)

      const oldClaim = allClaims.find(c => c.claimId === initial.claimId)
      expect(oldClaim?.qualifiers?.isCurrent).toBe(false)
      expect(oldClaim?.qualifiers?.supersededBy).toBe(updateRes.claimId)
    })

    it('invalidates claims without erasing historical provenance', () => {
      const ledger = new EntityLedger()
      ledger.applyPCLClaim({
        subject: 'Alice',
        predicate: 'lives_in',
        object: 'Paris',
        action: 'new',
      })

      const invRes = ledger.applyPCLClaim({
        subject: 'Alice',
        predicate: 'lives_in',
        object: 'Paris',
        action: 'invalidate',
      })

      expect(invRes.actionTaken).toBe('invalidated')

      // Active beliefs: empty
      expect(ledger.queryClaims('Alice', 'lives_in', true)).toHaveLength(0)

      // Historical beliefs: preserved with isCurrent: false
      const history = ledger.queryClaims('Alice', 'lives_in', false)
      expect(history).toHaveLength(1)
      expect(history[0].qualifiers?.isCurrent).toBe(false)
      expect(history[0].qualifiers?.invalidatedAt).toBeDefined()
    })
  })
})
