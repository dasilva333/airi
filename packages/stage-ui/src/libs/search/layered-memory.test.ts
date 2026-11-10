import type { LayeredSearchResult } from './layered-memory'
import type { TriageDecision } from './query-analyzer'

import { describe, expect, it, vi } from 'vitest'

import { EntityLedger } from './entity-ledger'
import { formatEvidenceContextBlock, layeredMemory } from './layered-memory'
import { analyzeQuery, decomposeQuery } from './query-analyzer'

vi.mock('../workers/search', () => ({
  searchWorker: {
    init: vi.fn(async () => ({ stale: false })),
    persist: vi.fn(async () => ({ ok: true })),
    search: vi.fn(async () => ({
      documents: [{ id: 'd1', content: 'doc', kind: 'raw', timestamp: '2026-10-18T00:00:00.000Z', source: 's' }],
      vectorHits: [{ id: 'd1', score: 0.5 }],
      keywordHits: [{ id: 'd1', score: 0.5 }],
      queryVector: [0.1],
    })),
    index: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}))

vi.mock('../../utils/memory-sentinel', () => ({
  shouldDegradeBackgroundWork: vi.fn(() => false),
}))

vi.mock('./query-analyzer', () => ({
  analyzeQuery: vi.fn(() => ({ expandedQuery: 'q', temporalHooks: [], extractedKeywords: ['hello'] })),
  decomposeQuery: vi.fn(() => ['q']),
  heuristicTriage: vi.fn(() => ({ choice: 'c0', category: 0, confidence: 0.5 })),
}))

vi.mock('./hybrid-scorer', () => ({
  defaultScorerConfig: { weightVector: 0.5, weightKeyword: 0.5, temporalWeight: 0.1 },
  scoreHybridResults: vi.fn(() => [{ id: 'd1', content: 'doc', kind: 'raw', score: 0.5, triage: null }]),
}))

function res(overrides: Partial<LayeredSearchResult>): LayeredSearchResult {
  return {
    id: '1',
    content: 'hello',
    kind: 'raw',
    score: 0.5,
    ...overrides,
  } as LayeredSearchResult
}

describe('formatEvidenceContextBlock', () => {
  it('returns empty string when no eligible results', () => {
    expect(formatEvidenceContextBlock([])).toBe('')
    expect(formatEvidenceContextBlock([res({ score: 0.1 })])).toBe('')
  })

  it('formats eligible results with defaults', () => {
    const out = formatEvidenceContextBlock([
      res({ timestamp: '2026-10-18T00:00:00.000Z' }),
    ])
    expect(out).toContain('[Retrieved Memory Context]')
    expect(out).toContain('[RAW]')
    expect(out).toContain('hello')
  })

  it('includes score when requested', () => {
    const out = formatEvidenceContextBlock([res({})], { includeScore: true })
    expect(out).toContain('score: 0.50')
  })

  it('respects minScore', () => {
    const out = formatEvidenceContextBlock([res({ score: 0.9 })], { minScore: 0.95 })
    expect(out).toBe('')
  })
})

describe('layeredMemory', () => {
  it('init sets lastIndexState', async () => {
    const state = await layeredMemory.init()
    expect(state).toBeDefined()
    expect(layeredMemory.lastIndexState).toBe(state)
  })

  it('persist runs', async () => {
    await layeredMemory.persist()
    expect(true).toBe(true)
  })

  it('indexDocuments and removeDocument run', async () => {
    await layeredMemory.indexDocuments([{ id: 'd1' }])
    await layeredMemory.removeDocument('d1')
    expect(true).toBe(true)
  })

  it('search baseline returns array', async () => {
    const out = await layeredMemory.search('hello')
    expect(Array.isArray(out)).toBe(true)
  })

  it('search with triage option', async () => {
    const triage: TriageDecision = { choice: 'c1_multihop', category: 1, confidence: 0.9 } as TriageDecision
    const out = await layeredMemory.search('hello', 5, 'c1', { triage })
    expect(Array.isArray(out)).toBe(true)
  })

  it('search multi subqueries', async () => {
    vi.mocked(decomposeQuery).mockReturnValue(['q1', 'q2'])
    const out = await layeredMemory.search('hello')
    expect(Array.isArray(out)).toBe(true)
    vi.mocked(decomposeQuery).mockReturnValue(['q'])
  })

  it('search with ledger', async () => {
    const ledger = {
      entities: new Map(),
      byAlias: new Map(),
      claims: new Map(),
      bySubjectPredicate: new Map(),
      byObjectPredicate: new Map(),
      queryClaims: () => [],
    } as unknown as Parameters<typeof layeredMemory.search>[3] extends { ledger?: infer L } ? L : never
    const out = await layeredMemory.search('hello', 10, undefined, { ledger })
    expect(Array.isArray(out)).toBe(true)
  })

  it('search with systemOneStore', async () => {
    const store = {
      configured: true,
      runTriage: vi.fn(async () => ({ choice: 'c0', category: 0 })),
      runRerank: vi.fn(async () => ({ rankedCandidates: [{ id: 'd1', finalScore: 0.9 }] })),
    }
    const out = await layeredMemory.search('hello', 10, undefined, { systemOneStore: store as unknown as NonNullable<Parameters<typeof layeredMemory.search>[3]>['systemOneStore'] })
    expect(Array.isArray(out)).toBe(true)
  })

  it('bridges previous grounding entities into triage, ledger matching, and reranker', async () => {
    vi.mocked(analyzeQuery).mockReturnValueOnce({
      originalQuery: 'and where did you get that item from?',
      cleanQuery: 'and where did you get that item from?',
      expandedQuery: 'and where did you get that item from? (crystal lens Taro)',
      hasTemporalIntent: false,
      temporalHooks: [],
      anaphoraResolved: true,
      pronounsDetected: ['that'],
      extractedKeywords: ['get', 'item', 'crystal', 'lens', 'taro'],
    })

    const store = {
      configured: true,
      runTriage: vi.fn(async (_triageQ: string) => ({
        choice: 'c4_literal',
        category: 4,
        confidence: 0.9,
        conjunctionStructure: 'bridge_relational',
        conjunctionConfidence: 0.7,
      })),
      runRerank: vi.fn(async (_rerankQ: string, pool: any[]) => ({
        rankedCandidates: pool.map(p => ({ id: p.id, finalScore: 0.95 })),
      })),
    }

    const testEntity = { entityId: 'ent-lens-1', label: 'crystal lens', type: 'item', mentions: new Set() }
    const ledger = {
      entities: new Map([['ent-lens-1', testEntity]]),
      byAlias: new Map(),
      claims: new Map(),
      sources: new Map(),
      mentions: new Map(),
      bySubjectPredicate: new Map(),
      byObjectPredicate: new Map(),
      queryClaims: () => [],
    } as unknown as NonNullable<Parameters<typeof layeredMemory.search>[3]>['ledger']

    const prevGrounding = {
      entities: ['crystal lens', 'Taro'],
      hits: [],
    }

    const out = await layeredMemory.search(
      'and where did you get that item from?',
      10,
      undefined,
      {
        previousGrounding: prevGrounding,
        ledger,
        systemOneStore: store as unknown as NonNullable<Parameters<typeof layeredMemory.search>[3]>['systemOneStore'],
      },
    )

    expect(Array.isArray(out)).toBe(true)
    // 1. Assert runTriage received the resolved query with previous context
    expect(store.runTriage).toHaveBeenCalledWith(
      expect.stringContaining('crystal lens'),
      expect.anything(),
    )
    // 2. Assert triage choice was reconciled from c4_literal to c1_multihop due to bridge_relational
    expect(layeredMemory.lastTriage?.choice).toBe('c1_multihop')
    expect(layeredMemory.lastTriage?.category).toBe(1)
    // 3. Assert runRerank received scoringQuery with antecedent context
    expect(store.runRerank).toHaveBeenCalledWith(
      expect.stringContaining('[Context:'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('searches claims using zero-GPU vector embeddings when needleClient or queryEmbedding is provided', async () => {
    const vecA = new Float32Array([1, 0, 0])
    const ledger = new EntityLedger()
    const c1 = ledger.addClaim({
      subject: 'James',
      predicate: 'adopted',
      object: 'Max the puppy',
      embedding: vecA,
    })

    const mockNeedle = {
      isReady: () => true,
      embed: vi.fn().mockResolvedValue(vecA),
    }

    const out = await layeredMemory.search('did James get a pet?', 10, undefined, {
      ledger,
      needleClient: mockNeedle as any,
    })

    expect(Array.isArray(out)).toBe(true)
    const claimHit = out.find(h => h.id === `claim:${c1.claimId}`)
    expect(claimHit).toBeTruthy()
    expect(claimHit?.isKgClaim).toBe(true)
  })
})
