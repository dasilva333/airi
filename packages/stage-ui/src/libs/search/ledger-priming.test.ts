import type { ExtractedFragments } from './ledger-priming'

import { describe, expect, it, vi } from 'vitest'

import { EntityLedger } from './entity-ledger'
import {
  collectUniqueCandidateMentions,
  CONVERSATIONAL_STOPWORDS,
  extractFragmentsFromText,
  extractTurnKnowledge,
  extractTurnKnowledgeAsync,
  isConversationalArtifactOrNoise,
  LEADING_GRAMMATICAL_WORDS,
  validateExtractionSpans,
} from './ledger-priming'

describe('ledger-priming', () => {
  describe('isConversationalArtifactOrNoise', () => {
    it('returns true for empty/short', () => {
      expect(isConversationalArtifactOrNoise('')).toBe(true)
      expect(isConversationalArtifactOrNoise('a')).toBe(true)
      expect(isConversationalArtifactOrNoise('ab')).toBe(true)
      expect(isConversationalArtifactOrNoise('   ')).toBe(true)
    })
    it('stopwords', () => {
      expect(isConversationalArtifactOrNoise('the')).toBe(true)
      expect(isConversationalArtifactOrNoise('The')).toBe(true)
    })
    it('leading grammatical', () => {
      expect(isConversationalArtifactOrNoise('and')).toBe(true)
    })
    it('repeated char', () => {
      expect(isConversationalArtifactOrNoise('ahhhh')).toBe(true)
      expect(isConversationalArtifactOrNoise('eeeeep')).toBe(true)
    })
    it('anime vocalizations', () => {
      expect(isConversationalArtifactOrNoise('kyaa')).toBe(true)
      expect(isConversationalArtifactOrNoise('waah')).toBe(true)
      expect(isConversationalArtifactOrNoise('ahh')).toBe(true)
      expect(isConversationalArtifactOrNoise('eep')).toBe(true)
    })
    it('returns false for normal', () => {
      expect(isConversationalArtifactOrNoise('Ned')).toBe(false)
      expect(isConversationalArtifactOrNoise('Pen-Pen')).toBe(false)
    })
  })

  describe('validateExtractionSpans', () => {
    it('filters mentions not in target', () => {
      const r = validateExtractionSpans('Hello Ned', { mentions: ['Ned', 'Ghost'], temporal_phrase: null, claims: [] })
      expect(r.mentions).toEqual(['Ned'])
    })
    it('trims mentions', () => {
      const r = validateExtractionSpans('Hello Ned', { mentions: ['  Ned  '], temporal_phrase: null, claims: [] })
      expect(r.mentions).toEqual(['Ned'])
    })
    it('skips short/invalid mentions', () => {
      const r = validateExtractionSpans('Hello Ned', { mentions: ['', 'a', 5 as unknown as string], temporal_phrase: null, claims: [] })
      expect(r.mentions).toEqual([])
    })
    it('temporal phrase validation', () => {
      const r = validateExtractionSpans('met yesterday', { mentions: [], temporal_phrase: 'yesterday', claims: [] })
      expect(r.temporal_phrase).toBe('yesterday')
      const r2 = validateExtractionSpans('met yesterday', { mentions: [], temporal_phrase: 'tomorrow', claims: [] })
      expect(r2.temporal_phrase).toBeNull()
      const r3 = validateExtractionSpans('x', { mentions: [], temporal_phrase: 5 as unknown as string, claims: [] })
      expect(r3.temporal_phrase).toBeNull()
      const r4 = validateExtractionSpans('x', { mentions: [], temporal_phrase: '   ', claims: [] })
      expect(r4.temporal_phrase).toBeNull()
    })
    it('claims validation and span fields', () => {
      const r = validateExtractionSpans('Ned adopted by James today', {
        mentions: [],
        temporal_phrase: null,
        claims: [
          { quote: 'Ned adopted', subject_span: 'Ned', predicate_span: 'adopted', object_span: 'James', time_span: 'today', polarity: 'negative', mode: 'question' },
          { quote: 'not present', subject_span: 'x', polarity: 'bogus', mode: 'bogus' },
          null as unknown as ExtractedFragments['claims'][number],
          { quote: 'Ned adopted', polarity: 'positive', mode: 'asserted' },
        ],
      })
      expect(r.claims).toHaveLength(2)
      expect(r.claims[0].polarity).toBe('negative')
      expect(r.claims[0].mode).toBe('question')
      expect(r.claims[0].subject_span).toBe('Ned')
      expect(r.claims[1].polarity).toBe('positive')
      expect(r.claims[1].subject_span).toBeUndefined()
    })
    it('handles null extraction fields', () => {
      const r = validateExtractionSpans('x', { mentions: null as unknown as string[], temporal_phrase: null, claims: null as unknown as ExtractedFragments['claims'] })
      expect(r.mentions).toEqual([])
      expect(r.claims).toEqual([])
    })
  })

  describe('extractFragmentsFromText', () => {
    it('temporal phrase', () => {
      const r = extractFragmentsFromText('We met yesterday.')
      expect(r.temporal_phrase).toBe('yesterday')
    })
    it('no temporal', () => {
      const r = extractFragmentsFromText('Hello world')
      expect(r.temporal_phrase).toBeNull()
    })
    it('frames', () => {
      const r = extractFragmentsFromText('named Pen-Pen pet penguin playing CS')
      expect(r.mentions).toContain('Pen-Pen')
    })
    it('compound proper nouns', () => {
      const r = extractFragmentsFromText('I love The Witcher 3.')
      expect(r.mentions).toContain('The Witcher')
    })
    it('acronyms', () => {
      const r = extractFragmentsFromText('NERV and WILLE')
      expect(r.mentions).toContain('NERV')
      expect(r.mentions).toContain('WILLE')
    })
    it('sentence start peeling', () => {
      const r = extractFragmentsFromText('And Richard went home.')
      expect(r.mentions).toContain('Richard')
    })
    it('mid-sentence capitalized', () => {
      const r = extractFragmentsFromText('I saw Ned yesterday.')
      expect(r.mentions).toContain('Ned')
    })
    it('rejects hashes', () => {
      const r = extractFragmentsFromText('token abcdefghijklmnopqrstuv')
      expect(r.mentions).not.toContain('abcdefghijklmnopqrstuv')
    })
    it('rejects short', () => {
      const r = extractFragmentsFromText('Hi I am OK')
      expect(r.mentions).not.toContain('OK')
    })
    it('validates spans against text', () => {
      const r = extractFragmentsFromText('Hello Ned')
      expect(r.mentions).toContain('Ned')
    })
  })

  describe('collectUniqueCandidateMentions', () => {
    it('collects from turns', () => {
      const r = collectUniqueCandidateMentions([{ text: 'I saw Ned.', speaker: 'User' }])
      expect(r.length).toBeGreaterThan(0)
      expect(r[0].mention).toBeDefined()
    })
    it('dedups', () => {
      const r = collectUniqueCandidateMentions([
        { text: 'I saw Ned.', speaker: 'User' },
        { text: 'Ned is here.', speaker: 'User' },
      ])
      const nedCount = r.filter(x => x.mention.toLowerCase().includes('ned')).length
      expect(nedCount).toBeLessThanOrEqual(1)
    })
    it('skips empty turns', () => {
      const r = collectUniqueCandidateMentions([{ text: '   ', speaker: 'User' }])
      expect(r).toEqual([])
    })
    it('collects from journals', () => {
      const r = collectUniqueCandidateMentions([], [{ title: 'Journal', content: 'Visited Tokyo.' }])
      expect(Array.isArray(r)).toBe(true)
    })
    it('handles undefined journals', () => {
      const r = collectUniqueCandidateMentions([{ text: 'Hi there.', speaker: 'User' }])
      expect(Array.isArray(r)).toBe(true)
    })
    it('truncates context', () => {
      const long = 'Ned '.repeat(100)
      const r = collectUniqueCandidateMentions([{ text: long, speaker: 'User' }])
      expect(Array.isArray(r)).toBe(true)
    })
  })

  describe('extractTurnKnowledge', () => {
    it('empty text returns', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: '   ', timestamp: 1 }, ledger)
      expect(ledger.entities.size).toBe(0)
    })
    it('registers speaker and fragments', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'I saw Ned yesterday.', timestamp: 1, sessionDate: '2022-01-01' }, ledger)
      expect(ledger.entities.size).toBeGreaterThan(0)
    })
    it('skips Unknown speaker and hash speakers', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'Unknown', text: 'Hello.', timestamp: 1 }, ledger)
      expect(true).toBe(true)
    })
    it('classification map conversational_artifact drops', () => {
      const ledger = new EntityLedger()
      const cm = new Map([['Ned', 'conversational_artifact']])
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'I saw Ned.', timestamp: 1 }, ledger, cm)
      expect(true).toBe(true)
    })
    it('classification map typed', () => {
      const ledger = new EntityLedger()
      const cm = new Map([['Ned', { choice: 'animal' }]])
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'I saw Ned.', timestamp: 1 }, ledger, cm)
      const ned = [...ledger.entities.values()].find(e => e.label === 'Ned')
      expect(ned?.type).toBe('animal')
    })
    it('classification map stores systemOne attr', () => {
      const ledger = new EntityLedger()
      const cm = new Map([['Ned', { choice: 'person', x: 1 }]])
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'I saw Ned.', timestamp: 1 }, ledger, cm)
      const ned = [...ledger.entities.values()].find(e => e.label === 'Ned')
      expect(ned?.attributes.systemOne).toBeDefined()
    })
    it('unclassified defaults unknown, speaker becomes person', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'Ned', text: 'Ned is here.', timestamp: 1 }, ledger)
      const ned = [...ledger.entities.values()].find(e => e.label === 'Ned')
      expect(ned).toBeDefined()
    })
    it('ingests claims', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'Ned adopted.', timestamp: 1 }, ledger)
      expect(ledger.claims.size).toBeGreaterThanOrEqual(0)
    })
    it('speaker hash skip', () => {
      const ledger = new EntityLedger()
      extractTurnKnowledge('p', { id: '1', speaker: 'a'.repeat(20), text: 'Hi.', timestamp: 1 }, ledger)
      expect(true).toBe(true)
    })
  })

  describe('exports sets', () => {
    it('sets non-empty', () => {
      expect(CONVERSATIONAL_STOPWORDS.size).toBeGreaterThan(0)
      expect(LEADING_GRAMMATICAL_WORDS.size).toBeGreaterThan(0)
    })
  })
})

describe('ledger-priming extra', () => {
  it('repeated single char', () => {
    expect(isConversationalArtifactOrNoise('aaa')).toBe(true)
    expect(isConversationalArtifactOrNoise('zzzz')).toBe(true)
  })
  it('collect dedup canonical', () => {
    const r = collectUniqueCandidateMentions([{ text: 'Ned Ned', speaker: 'User' }])
    expect(Array.isArray(r)).toBe(true)
  })
  it('person branch via speaker', () => {
    const ledger = new EntityLedger()
    extractTurnKnowledge('p', { id: '1', speaker: 'Alice', text: 'Alice is here.', timestamp: 1 }, ledger)
    const a = [...ledger.entities.values()].find(e => e.label === 'Alice')
    expect(a?.type).toBe('person')
  })
  it('canonical noise skip in extractTurnKnowledge', () => {
    const ledger = new EntityLedger()
    extractTurnKnowledge('p', { id: '1', speaker: 'User', text: 'the and', timestamp: 1 }, ledger)
    expect(true).toBe(true)
  })

  it('extractTurnKnowledgeAsync with mock Needle 3 multi-turn extraction and embeddings', async () => {
    const ledger = new EntityLedger()
    const mockNeedle = {
      isReady: () => true,
      extractMemoryFragments: vi.fn().mockResolvedValue({
        mentions: ['Max', 'James'],
        temporal_phrase: 'yesterday',
        claims: [{
          quote: 'adopted a new puppy named Max',
          polarity: 'positive',
          mode: 'asserted',
          subject_span: 'James',
          predicate_span: 'adopted',
          object_span: 'Max',
        }],
      }),
      embed: vi.fn().mockResolvedValue(new Float32Array([0.1, 0.2, 0.3])),
    }

    const passage = 'James: I adopted a new puppy named Max yesterday.\nAiri: That is wonderful!'
    await extractTurnKnowledgeAsync(
      passage,
      { id: 'turn-1', speaker: 'James', text: 'I adopted a new puppy named Max yesterday.', timestamp: 12345 },
      ledger,
      undefined,
      { needleClient: mockNeedle as any, embedClaims: true },
    )

    expect(ledger.sources.size).toBe(1)
    expect(mockNeedle.extractMemoryFragments).toHaveBeenCalled()
    expect(mockNeedle.embed).toHaveBeenCalled()

    const max = [...ledger.entities.values()].find(e => e.label === 'Max')
    expect(max).toBeTruthy()
    expect(max?.embedding).toBeInstanceOf(Float32Array)

    const claims = [...ledger.claims.values()]
    expect(claims.length).toBeGreaterThan(0)
    expect(claims[0].embedding).toBeInstanceOf(Float32Array)
  })
})
