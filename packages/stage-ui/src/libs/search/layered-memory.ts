import type { ClaimRecord, EntityLedger } from './entity-ledger'
import type { HybridSearchResult, MemoryLayer, SearchDocumentMeta } from './hybrid-scorer'
import type { TriageDecision } from './query-analyzer'

import indexedDbDriver from 'unstorage/drivers/indexedb'
import memoryDriver from 'unstorage/drivers/memory'

import { createStorage } from 'unstorage'

import { searchWorker } from '../workers/search'
import {
  defaultScorerConfig,
  scoreHybridResults,
} from './hybrid-scorer'
import { analyzeQuery, decomposeQuery, heuristicTriage } from './query-analyzer'

const indexStorage = createStorage({
  driver: typeof indexedDB !== 'undefined' ? indexedDbDriver({ base: 'airi-search-index' }) : memoryDriver(),
})

export interface LayeredSearchResult extends HybridSearchResult {
  subject?: string
  predicate?: string
  object?: string
  dateInfo?: any
  claimId?: string
  entityId?: string
  evidence?: string[]
  isKgClaim?: boolean
  triage?: TriageDecision
  subGoal?: string
}

export interface LayeredSearchOptions {
  previousTurn?: string
  anaphoraEnabled?: boolean
  temporalBoost?: boolean
  ledger?: EntityLedger
  triage?: TriageDecision
  universeId?: string
  systemOneStore?: {
    configured: boolean
    runTriage: (q: string) => Promise<any>
    runRerank: (q: string, candidates: Array<{ id: string, text: string, score?: number }>) => Promise<any>
  }
}

let isPersisting = false
let isIndexing = false

const KIND_MAP: Record<string, MemoryLayer> = {
  user_turn: 'raw',
  assistant_turn: 'raw',
  memory_block: 'stmm',
  journal_entry: 'ltmm',
  echo_chip: 'stmm',
  lifetime_entry: 'ltmm',
  kg_claim: 'ltmm',
}

function resolveMemoryLayer(kind: string): MemoryLayer {
  if (kind in KIND_MAP)
    return KIND_MAP[kind]

  if (kind.endsWith('_turn'))
    return 'raw'
  if (kind.endsWith('_block'))
    return 'stmm'
  if (kind.endsWith('_entry'))
    return 'ltmm'

  return 'raw'
}

export const layeredMemory = {
  lastTriage: null as TriageDecision | null,
  lastSearchMode: 'baseline' as 'pass11' | 'baseline',

  async init() {
    const snapshot = await indexStorage.getItem('snapshot')
    await searchWorker.init(snapshot)
  },

  async persist() {
    if (isPersisting)
      return
    isPersisting = true
    try {
      const snapshot = await searchWorker.persist()
      await indexStorage.setItem('snapshot', snapshot)
    }
    finally {
      isPersisting = false
    }
  },

  async search(
    query: string,
    limit = 10,
    characterId?: string,
    options?: LayeredSearchOptions,
  ): Promise<LayeredSearchResult[]> {
    // 1. Triage Decision (System 1 Zero-Shot vs Fallback Heuristic)
    let triage: TriageDecision
    let mode: 'pass11' | 'baseline' = 'baseline'

    if (options?.triage) {
      triage = options.triage
      if (triage.method && (triage.method.includes('jev') || triage.method.includes('laya') || triage.method.includes('system1'))) {
        mode = 'pass11'
      }
    }
    else if (options?.systemOneStore?.configured) {
      try {
        triage = await options.systemOneStore.runTriage(query)
        mode = 'pass11'
      }
      catch (err) {
        console.warn('[LayeredMemory] System 1 triage failed, falling back to heuristic:', err)
        triage = heuristicTriage(query)
        mode = 'baseline'
      }
    }
    else {
      triage = heuristicTriage(query)
      mode = 'baseline'
    }

    this.lastTriage = triage
    this.lastSearchMode = mode

    // 2. Query Analysis & Turn-1 Anaphora Resolution
    const analysis = analyzeQuery(query, {
      previousTurn: options?.previousTurn,
      anaphoraEnabled: options?.anaphoraEnabled ?? true,
    })

    // 3. Category Strategy Adaptation (Pass 11)
    const isLiteral = triage.choice === 'c4_literal' || triage.category === 4
    const isMultiHop = triage.choice === 'c1_multihop'
      || triage.category === 1
      || triage.searchScope === 'multi_session'
      || triage.conjunctionStructure === 'bridge_relational'
      || triage.conjunctionStructure === 'multi_entity_plural'
      || (triage.requiresDecomposition !== undefined && triage.requiresDecomposition >= 0.5)

    const isTemporal = triage.choice === 'c2_temporal'
      || triage.category === 2
      || triage.conjunctionStructure === 'temporal_comparison'

    const isDetective = triage.choice === 'c3_detective' || triage.category === 3

    const workerLimit = isMultiHop ? Math.max(limit, 25) : (isDetective ? Math.max(limit, 20) : limit)
    const returnLimit = (isMultiHop || isTemporal) ? Math.max(limit, 6) : limit

    const categoryScorerConfig = {
      ...defaultScorerConfig,
      weightVector: isLiteral ? 0.50 : (isMultiHop ? 0.65 : defaultScorerConfig.weightVector),
      weightKeyword: isLiteral ? 0.50 : (isMultiHop ? 0.35 : defaultScorerConfig.weightKeyword),
      temporalWeight: isTemporal ? 0.35 : defaultScorerConfig.temporalWeight,
    }

    // 4. In-Memory Knowledge Graph Traversal (100% Offline, Always Queried)
    const kgHits: LayeredSearchResult[] = []
    if (options?.ledger) {
      const ledger = options.ledger
      const qLower = query.toLowerCase()
      const searchTokens = analysis.extractedKeywords.map(k => k.toLowerCase())

      // Find matching claims
      const matchedClaims = new Map<string, ClaimRecord>()

      // A. Direct entity & alias matches
      const matchedEntityIds = new Set<string>()

      for (const ent of ledger.entities.values()) {
        const entLabelLower = ent.label.toLowerCase()
        if (qLower.includes(entLabelLower) || searchTokens.some(t => t.length > 2 && entLabelLower.includes(t))) {
          matchedEntityIds.add(ent.entityId)
        }
      }

      for (const [alias, entIds] of ledger.byAlias.entries()) {
        if (qLower.includes(alias) || searchTokens.some(t => t.length > 2 && alias.includes(t))) {
          for (const id of entIds) {
            matchedEntityIds.add(id)
          }
        }
      }

      for (const entId of matchedEntityIds) {
        const ent = ledger.entities.get(entId)
        if (!ent)
          continue

        // Add claims where entity is subject
        const subClaims = ledger.queryClaims(ent.label)
        for (const c of subClaims) {
          matchedClaims.set(c.claimId, c)
        }

        // Add claims where entity is object
        const objPredMap = ledger.byObjectPredicate.get(ent.label.toLowerCase())
        if (objPredMap) {
          for (const cSet of objPredMap.values()) {
            for (const cId of cSet) {
              const c = ledger.claims.get(cId)
              if (c)
                matchedClaims.set(c.claimId, c)
            }
          }
        }
      }

      // B. Substring claim matching on subject, predicate, or object
      for (const c of ledger.claims.values()) {
        const sub = c.subject.toLowerCase()
        const pred = c.predicate.toLowerCase()
        const obj = c.object.toLowerCase()

        if (qLower.includes(sub) || qLower.includes(obj) || (searchTokens.some(t => t.length > 2 && (sub.includes(t) || obj.includes(t) || pred.includes(t))))) {
          matchedClaims.set(c.claimId, c)
        }
      }

      // C. Format into LayeredSearchResults
      for (const c of matchedClaims.values()) {
        const dateStr = c.dateInfo?.formatted_label ? ` (${c.dateInfo.formatted_label})` : ''
        const content = `[Knowledge Graph] ${c.subject} ${c.predicate} ${c.object}${dateStr}`
        kgHits.push({
          id: `claim:${c.claimId}`,
          content,
          kind: 'ltmm',
          timestamp: c.dateInfo?.iso_date || new Date().toISOString(),
          source: `kg:${c.claimId}`,
          score: 0.95,
          vectorScore: 0.90,
          keywordScore: 0.95,
          temporalScore: c.dateInfo ? 0.90 : 0.50,
          layerBoost: 0.15,
          profile: 'default',
          subject: c.subject,
          predicate: c.predicate,
          object: c.object,
          dateInfo: c.dateInfo,
          claimId: c.claimId,
          evidence: c.evidence,
          isKgClaim: true,
          triage,
        })
      }
    }

    // 5. Candidate Retrieval from Search Web Worker (Vector + BM25)
    const subQueries = decomposeQuery(query, triage)
    let scoredWorkerHits: LayeredSearchResult[] = []

    if (subQueries.length > 1) {
      // Multi-Pass Sub-Query Retrieval (Pass 11 Proof Bundles)
      const subResults = await Promise.all(
        subQueries.map(async (sq, idx) => {
          const isPrimary = idx === 0
          const subAnalysis = isPrimary ? analysis : analyzeQuery(sq, { anaphoraEnabled: false })
          const res = await searchWorker.search(
            subAnalysis.expandedQuery,
            workerLimit,
            characterId,
            subAnalysis.temporalHooks.length > 0 ? subAnalysis.temporalHooks : analysis.temporalHooks,
          )
          return { sq, subAnalysis, res, isPrimary }
        }),
      )

      // Merge unique documents across all sub-queries
      const docMap = new Map<string, SearchDocumentMeta>()
      for (const sub of subResults) {
        for (const doc of sub.res.documents) {
          if (!docMap.has(doc.id)) {
            docMap.set(doc.id, {
              ...doc,
              kind: resolveMemoryLayer(doc.kind),
            })
          }
        }
      }
      const allDocs = Array.from(docMap.values())

      // Score candidates per sub-query plan
      const perSubScored = subResults.map((sub) => {
        const hits = scoreHybridResults(
          sub.sq,
          allDocs,
          sub.res.vectorHits,
          sub.res.keywordHits,
          categoryScorerConfig,
          sub.subAnalysis.temporalHooks.length > 0 ? sub.subAnalysis.temporalHooks : analysis.temporalHooks,
        )
        return { ...sub, hits }
      })

      // Cross-Plan Reciprocal Rank Fusion & Fair-Share Quota Reservation
      const rrfScores = new Map<string, number>()
      const bestHitMap = new Map<string, LayeredSearchResult>()
      const reservedHits: LayeredSearchResult[] = []
      const reservedIds = new Set<string>()

      // 1. Quota reservation: reserve top 1-2 hits from each sub-query to guarantee both clue halves
      const quotaPerSub = isMultiHop || isTemporal ? 2 : 1
      for (const sub of perSubScored) {
        let reservedCount = 0
        for (const h of sub.hits) {
          if (reservedCount >= quotaPerSub)
            break
          if (!reservedIds.has(h.id)) {
            reservedIds.add(h.id)
            const taggedHit: LayeredSearchResult = {
              ...h,
              subGoal: sub.sq !== query ? sub.sq : undefined,
              triage,
            }
            reservedHits.push(taggedHit)
            reservedCount++
          }
        }
      }

      // 2. Compute RRF across all plans
      const RRF_K = 60
      for (const sub of perSubScored) {
        const planWeight = sub.isPrimary ? 1.0 : 0.85
        sub.hits.forEach((h, rank) => {
          const currentRrf = rrfScores.get(h.id) ?? 0
          rrfScores.set(h.id, currentRrf + planWeight / (RRF_K + rank + 1))
          if (!bestHitMap.has(h.id) || (bestHitMap.get(h.id)!.score < h.score)) {
            bestHitMap.set(h.id, {
              ...h,
              subGoal: sub.sq !== query ? sub.sq : undefined,
              triage,
            })
          }
        })
      }

      // 3. Assemble final candidate pool:
      // Start with reserved quota hits to ensure complete proof bundle,
      // then fill remaining slots with remaining documents ordered by RRF score.
      const fusedRemaining: LayeredSearchResult[] = []
      const sortedByRrf = Array.from(rrfScores.entries())
        .sort((a, b) => b[1] - a[1])

      for (const [id] of sortedByRrf) {
        if (!reservedIds.has(id)) {
          const hit = bestHitMap.get(id)
          if (hit) {
            fusedRemaining.push(hit)
          }
        }
      }

      scoredWorkerHits = [...reservedHits, ...fusedRemaining]
    }
    else {
      // Standard Single-Pass Retrieval
      const rawResults = await searchWorker.search(
        analysis.expandedQuery,
        workerLimit,
        characterId,
        analysis.temporalHooks,
      )
      const documents = rawResults.documents.map((document: SearchDocumentMeta & { kind: string }) => ({
        ...document,
        kind: resolveMemoryLayer(document.kind),
      }))

      scoredWorkerHits = scoreHybridResults(
        query,
        documents,
        rawResults.vectorHits,
        rawResults.keywordHits,
        categoryScorerConfig,
        analysis.temporalHooks,
      ).map(h => ({ ...h, triage }))
    }

    // 7. Merge Knowledge Graph hits + Scored Worker hits (with Date-Hook Quota)
    const mergedHits: LayeredSearchResult[] = []
    const seen = new Set<string>()

    // Priority 1: High-confidence Knowledge Graph claims
    for (const kg of kgHits) {
      if (!seen.has(kg.id)) {
        seen.add(kg.id)
        mergedHits.push(kg)
      }
    }

    // Priority 2: Temporal Date-matched worker hits if query has temporal intent (C2 quota)
    if (isTemporal) {
      const dateHits = scoredWorkerHits.filter(h => h.dateMatchBoost && h.dateMatchBoost > 0)
      for (const dh of dateHits.slice(0, 3)) {
        if (!seen.has(dh.id)) {
          seen.add(dh.id)
          mergedHits.push({ ...dh, triage })
        }
      }
    }

    // Priority 3: Remaining hybrid worker hits
    for (const h of scoredWorkerHits) {
      if (!seen.has(h.id)) {
        seen.add(h.id)
        mergedHits.push({ ...h, triage })
      }
    }

    // 8. Level-1 Cross-Encoder Reranker Booster (if System 1 is configured)
    let finalHits = mergedHits
    if (options?.systemOneStore?.configured && mergedHits.length > 0) {
      try {
        const poolToRerank = mergedHits.slice(0, 10).map(h => ({
          id: h.id,
          text: h.content,
          score: h.score,
        }))
        const rerankRes = await options.systemOneStore.runRerank(query, poolToRerank)
        if (rerankRes.rankedCandidates && rerankRes.rankedCandidates.length > 0) {
          const scoreMap = new Map<string, number>(rerankRes.rankedCandidates.map((r: any) => [r.id, Number(r.finalScore ?? r.score ?? 0)]))
          finalHits = mergedHits.map(h => ({
            ...h,
            score: scoreMap.has(h.id) ? (scoreMap.get(h.id) ?? h.score) : h.score,
          })).sort((a, b) => b.score - a.score)
        }
      }
      catch (err) {
        console.warn('[LayeredMemory] System 1 cross-encoder rerank failed, retaining RRF score:', err)
      }
    }

    return finalHits.slice(0, returnLimit)
  },

  async indexDocuments(documents: any[]) {
    if (isIndexing)
      return
    isIndexing = true
    try {
      await searchWorker.index(documents)
      await this.persist()
    }
    finally {
      isIndexing = false
    }
  },

  async removeDocument(id: string) {
    await searchWorker.remove(id)
    await this.persist()
  },
}

/**
 * Formats retrieved memory search results into a clean markdown evidence block suitable for LLM context injection.
 */
export function formatEvidenceContextBlock(
  results: LayeredSearchResult[],
  options?: {
    minScore?: number
    includeScore?: boolean
    maxTokens?: number
  },
): string {
  const minScore = options?.minScore ?? 0.35
  const eligible = results.filter(r => r.score >= minScore)

  if (!eligible.length)
    return ''

  const lines = eligible.map((r, i) => {
    const kindTag = r.kind.toUpperCase()
    const dateStr = r.timestamp ? ` [${new Date(r.timestamp).toISOString().split('T')[0]}]` : ''
    const scoreStr = options?.includeScore ? ` (score: ${r.score.toFixed(2)})` : ''
    return `${i + 1}. [${kindTag}]${dateStr}${scoreStr}: ${r.content}`
  })

  return `[Retrieved Memory Context]\n${lines.join('\n')}`
}
