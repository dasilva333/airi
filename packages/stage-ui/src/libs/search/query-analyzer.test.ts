import { describe, expect, it } from 'vitest'

import { analyzeQuery, expandCasualQuery, extractTemporalHooks, resolveTurnAnaphora } from './query-analyzer'

describe('query-analyzer', () => {
  describe('extractTemporalHooks', () => {
    it('extracts ISO dates correctly', () => {
      const hooks = extractTemporalHooks('What did we discuss on 2026-09-15?')
      expect(hooks.length).toBe(1)
      expect(hooks[0].year).toBe(2026)
      expect(hooks[0].monthIndex).toBe(8) // September is 8 (0-indexed)
      expect(hooks[0].day).toBe(15)
      expect(hooks[0].isoDateHint).toBe('2026-09-15')
    })

    it('extracts natural language month, day, and year', () => {
      const hooks = extractTemporalHooks('Where did we go on September 15, 2026 for dinner?')
      expect(hooks.length).toBe(1)
      expect(hooks[0].month).toBe('september')
      expect(hooks[0].day).toBe(15)
      expect(hooks[0].year).toBe(2026)
      expect(hooks[0].isoDateHint).toBe('2026-09-15')
    })

    it('extracts day-first format with ordinal', () => {
      const hooks = extractTemporalHooks('Was our flight on 27th March, 2022 or later?')
      expect(hooks.length).toBe(1)
      expect(hooks[0].month).toBe('march')
      expect(hooks[0].day).toBe(27)
      expect(hooks[0].year).toBe(2022)
    })

    it('extracts month and year without day', () => {
      const hooks = extractTemporalHooks('Events that took place in April 2022')
      expect(hooks.length).toBe(1)
      expect(hooks[0].month).toBe('april')
      expect(hooks[0].year).toBe(2022)
      expect(hooks[0].day).toBeUndefined()
    })

    it('extracts relative temporal keywords', () => {
      const hooks = extractTemporalHooks('What did you eat yesterday?')
      expect(hooks.length).toBe(1)
      expect(hooks[0].text.toLowerCase()).toBe('yesterday')
      expect(hooks[0].isRelative).toBe(true)
    })

    it('returns empty array when no temporal references exist', () => {
      const hooks = extractTemporalHooks('What is your favorite color?')
      expect(hooks).toEqual([])
    })
  })

  describe('resolveTurnAnaphora', () => {
    it('binds pronoun "that" to content words in previous turn', () => {
      const prevTurn = 'I spent all afternoon setting up the acoustic guitar audio interface.'
      const query = 'Do you remember when I bought that?'

      const res = resolveTurnAnaphora(query, prevTurn)
      expect(res.anaphoraResolved).toBe(true)
      expect(res.pronounsDetected).toContain('that')
      expect(res.expandedQuery).toContain('acoustic')
      expect(res.expandedQuery).toContain('guitar')
    })

    it('ignores query without pronouns', () => {
      const prevTurn = 'Richard went to the store to buy apples.'
      const query = 'Where is the supermarket?'

      const res = resolveTurnAnaphora(query, prevTurn)
      expect(res.anaphoraResolved).toBe(false)
      expect(res.expandedQuery).toBe(query)
    })

    it('handles missing previous turn gracefully', () => {
      const query = 'How do I fix that?'
      const res = resolveTurnAnaphora(query, undefined)
      expect(res.anaphoraResolved).toBe(false)
      expect(res.expandedQuery).toBe(query)
    })
  })

  describe('expandCasualQuery', () => {
    it('expands known conversational synonyms without overriding query', () => {
      const query = 'Tell me about the trip to canada'
      const expanded = expandCasualQuery(query)
      expect(expanded).toContain('trip to canada')
      expect(expanded).toContain('Toronto')
      expect(expanded).toContain('flight')
    })
  })

  describe('analyzeQuery (unified)', () => {
    it('integrates anaphora, temporal detection, and keywords', () => {
      const prevTurn = 'I really enjoyed that concert last week.'
      const currentQuery = 'Who went with us to that on 2026-09-15?'

      const result = analyzeQuery(currentQuery, { previousTurn: prevTurn })
      expect(result.anaphoraResolved).toBe(true)
      expect(result.hasTemporalIntent).toBe(true)
      expect(result.temporalHooks.length).toBe(1)
      expect(result.temporalHooks[0].isoDateHint).toBe('2026-09-15')
      expect(result.expandedQuery).toContain('concert')
    })
  })

  describe('heuristicTriage', () => {
    it('classifies temporal queries as C2', async () => {
      const { heuristicTriage } = await import('./query-analyzer')
      const q1 = heuristicTriage('When did we visit Tokyo?')
      expect(q1.category).toBe(2)
      expect(q1.choice).toBe('c2_temporal')
      expect(q1.temporalSubtype).toBe('calendar_date')

      const q2 = heuristicTriage('How many days ago did the package arrive?')
      expect(q2.category).toBe(2)
      expect(q2.choice).toBe('c2_temporal')
      expect(q2.temporalSubtype).toBe('duration')
    })

    it('classifies multi-hop and list queries as C1', async () => {
      const { heuristicTriage } = await import('./query-analyzer')
      const q1 = heuristicTriage('What is the connection between Alice and Bob?')
      expect(q1.category).toBe(1)
      expect(q1.choice).toBe('c1_multihop')
      expect(q1.searchScope).toBe('multi_session')

      const q2 = heuristicTriage('List all the different places we visited')
      expect(q2.category).toBe(1)
      expect(q2.choice).toBe('c1_multihop')
    })

    it('classifies open-domain and detective queries as C3', async () => {
      const { heuristicTriage } = await import('./query-analyzer')
      const q1 = heuristicTriage('Why did she react with frustration?')
      expect(q1.category).toBe(3)
      expect(q1.choice).toBe('c3_detective')

      const q2 = heuristicTriage('What was his attitude towards the proposal?')
      expect(q2.category).toBe(3)
      expect(q2.choice).toBe('c3_detective')
    })

    it('defaults standard factual queries to C4 literal', async () => {
      const { heuristicTriage } = await import('./query-analyzer')
      const q1 = heuristicTriage('What is his favorite ice cream flavor?')
      expect(q1.category).toBe(4)
      expect(q1.choice).toBe('c4_literal')
    })
  })

  describe('decomposeQuery', () => {
    it('decomposes bridge query with "X for the room where I found Y"', async () => {
      const { decomposeQuery } = await import('./query-analyzer')
      const sub = decomposeQuery('What was the door code for the room where I found the expired sardines?')
      expect(sub.length).toBeGreaterThanOrEqual(2)
      expect(sub.some(s => s.toLowerCase().includes('expired sardines'))).toBe(true)
      expect(sub.some(s => s.toLowerCase().includes('door code'))).toBe(true)
    })

    it('decomposes multi-entity query with "two different X, and which Y"', async () => {
      const { decomposeQuery } = await import('./query-analyzer')
      const sub = decomposeQuery('What were the two different access pin codes I used at NERV, and which door did each one unlock?')
      expect(sub.length).toBeGreaterThanOrEqual(2)
      expect(sub.some(s => s.toLowerCase().includes('pin code') || s.toLowerCase().includes('access'))).toBe(true)
      expect(sub.some(s => s.toLowerCase().includes('door') || s.toLowerCase().includes('unlock'))).toBe(true)
    })

    it('decomposes temporal sequence query with "before or after"', async () => {
      const { decomposeQuery } = await import('./query-analyzer')
      const sub = decomposeQuery('Did we sneak into the cafeteria storage before or after the ramen contest where I hid the pork belly?')
      expect(sub.length).toBeGreaterThanOrEqual(2)
      expect(sub.some(s => s.toLowerCase().includes('cafeteria storage'))).toBe(true)
      expect(sub.some(s => s.toLowerCase().includes('ramen contest') || s.toLowerCase().includes('pork belly'))).toBe(true)
    })

    it('decomposes identity question with "Who or what is X and when"', async () => {
      const { decomposeQuery } = await import('./query-analyzer')
      const sub = decomposeQuery('Who or what is \'Asukee\', and when did I first introduce her to you?')
      expect(sub.some(s => s.toLowerCase().includes('asukee'))).toBe(true)
    })
  })
})
