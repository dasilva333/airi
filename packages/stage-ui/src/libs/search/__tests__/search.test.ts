import type { SearchCandidate, SearchDocumentMeta } from '../hybrid-scorer'

import { describe, expect, it } from 'vitest'

import {
  defaultScorerConfig,
  detectQueryProfile,
  scoreHybridResults,

} from '../hybrid-scorer'

describe('semantic Search & Memory Refinements', () => {
  describe('query Profile Detection', () => {
    it('detects quote queries', () => {
      expect(detectQueryProfile('what did they say about "hello"?')).toBe('quote')
      expect(detectQueryProfile('verbatim transcript of yesterday')).toBe('quote')
      expect(detectQueryProfile('exact quote: I love coffee')).toBe('quote')
    })

    it('detects question queries', () => {
      expect(detectQueryProfile('who is the actor?')).toBe('question')
      expect(detectQueryProfile('how to run a test')).toBe('question')
      expect(detectQueryProfile('where did we go yesterday?')).toBe('question')
    })

    it('detects longform queries', () => {
      expect(
        detectQueryProfile(
          'this is a very long query that has more than fourteen words to trigger the longform profile detection logic',
        ),
      ).toBe('longform')
    })

    it('detects default queries', () => {
      expect(detectQueryProfile('simple search')).toBe('default')
    })
  })

  describe('rRF & MMR Scoring', () => {
    const mockDocs: SearchDocumentMeta[] = [
      {
        id: 'doc1',
        content: 'I love drinking green tea in the morning.',
        kind: 'raw',
        timestamp: new Date().toISOString(),
        source: 'user',
        embedding: [0.1, 0.2, 0.3],
      },
      {
        id: 'doc2',
        content: 'Green tea is full of healthy antioxidants.',
        kind: 'stmm',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        source: 'assistant',
        embedding: [0.1, 0.2, 0.31], // very similar to doc1
      },
      {
        id: 'doc3',
        content: 'Antigravity is a powerful AI coding assistant.',
        kind: 'ltmm',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        source: 'system',
        embedding: [0.9, 0.8, 0.7],
      },
    ]

    const vectorCandidates: SearchCandidate[] = [
      { id: 'doc1', score: 0.85 },
      { id: 'doc2', score: 0.84 },
      { id: 'doc3', score: 0.40 },
    ]

    const keywordCandidates: SearchCandidate[] = [
      { id: 'doc2', score: 1.0 },
      { id: 'doc1', score: 0.5 },
    ]

    it('applies reciprocal rank fusion (RRF) and ranks doc2 first due to higher keyword rank', () => {
      const results = scoreHybridResults(
        'green tea',
        mockDocs,
        vectorCandidates,
        keywordCandidates,
        {
          ...defaultScorerConfig,
          mmrLambda: 1.0, // disable MMR to verify pure RRF first
        },
      )

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('doc2')
      expect(results[1].id).toBe('doc1')
    })

    it('diversifies results using MMR', () => {
      const results = scoreHybridResults(
        'green tea AI',
        mockDocs,
        vectorCandidates,
        keywordCandidates,
        {
          ...defaultScorerConfig,
          mmrLambda: 0.2, // Strong diversity penalty
        },
      )

      const ids = results.map(r => r.id)
      expect(ids.indexOf('doc2')).toBe(0) // Highest initial relevance is chosen first
      expect(ids.indexOf('doc3')).toBeLessThan(ids.indexOf('doc1')) // doc3 is selected before the duplicate doc1
    })
  })
})
