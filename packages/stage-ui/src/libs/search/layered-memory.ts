import type { ChatGroundingMetadata } from '../../types/chat'
import type { ClaimRecord, EntityLedger, SourceRecord } from './entity-ledger'
import type { HybridSearchResult, MemoryLayer, SearchDocumentMeta } from './hybrid-scorer'
import type { TriageDecision } from './query-analyzer'

import indexedDbDriver from 'unstorage/drivers/indexedb'
import memoryDriver from 'unstorage/drivers/memory'

import { createStorage } from 'unstorage'

import { shouldDegradeBackgroundWork } from '../../utils/memory-sentinel'
import { searchWorker } from '../workers/search'
import {
  defaultScorerConfig,
  scoreHybridResults,
} from './hybrid-scorer'
import { CONVERSATIONAL_STOPWORDS, LEADING_GRAMMATICAL_WORDS } from './ledger-priming'
import { analyzeQuery, decomposeQuery, heuristicTriage } from './query-analyzer'

const indexStorage = createStorage({
  driver: typeof indexedDB !== 'undefined' ? indexedDbDriver({ base: 'airi-search-index' }) : memoryDriver(),
})

// Synchronous fast-path mirror of the index high-watermark so caller stores
// can delta-check without awaiting IndexedDB or the worker.
export const LAST_INDEXED_TURN_KEY = 'airi:search:last-indexed-turn'

function asWatermark(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function mirrorLastIndexedTurnAt(value: unknown): void {
  const watermark = asWatermark(value)
  if (watermark === undefined)
    return
  if (typeof localStorage === 'undefined')
    return
  try {
    localStorage.setItem(LAST_INDEXED_TURN_KEY, String(watermark))
  }
  catch {}
}

export interface LayeredSearchResult extends HybridSearchResult {
  title?: string
  subject?: string
  predicate?: string
  object?: string
  dateInfo?: any
  claimId?: string
  entityId?: string
  characterId?: string
  evidence?: string[]
  isKgClaim?: boolean
  triage?: TriageDecision
  subGoal?: string
}

export interface LayeredSearchOptions {
  previousTurn?: string
  previousGrounding?: ChatGroundingMetadata
  anaphoraEnabled?: boolean
  temporalBoost?: boolean
  ledger?: EntityLedger
  triage?: TriageDecision
  universeId?: string
  signal?: AbortSignal
  systemOneStore?: {
    configured: boolean
    runTriage: (q: string, options?: { signal?: AbortSignal }) => Promise<any>
    runRerank: (q: string, candidates: Array<{ id: string, text: string, score?: number }>, options?: { signal?: AbortSignal }) => Promise<any>
    identifyFocusEntity?: (query: string, candidates: Array<{ id: string, label: string, type?: string, detail?: string }>, options?: { signal?: AbortSignal }) => Promise<string | null>
  }
}

function matchesWordBoundary(text: string, term: string): boolean {
  if (!text || !term)
    return false
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i').test(text)
}

let isPersisting = false
let isIndexing = false
let lastPersistAt = 0
let indexLock: Promise<void> = Promise.resolve()
let persistLock: Promise<void> = Promise.resolve()
const MIN_PERSIST_INTERVAL_MS = 30_000
const TRIAGE_TIMEOUT_MS = 10_000
const RERANK_TIMEOUT_MS = 10_000
const MAX_SUB_QUERIES = 3

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out (${ms}ms)`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer)
      clearTimeout(timer)
  }) as Promise<T>
}

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

export interface SearchIndexState {
  stale: boolean
  reason?: string
  lastIndexedTurnAt?: number
}

export const layeredMemory = {
  lastTriage: null as TriageDecision | null,
  lastSearchMode: 'baseline' as 'pass11' | 'baseline',
  lastIndexState: null as SearchIndexState | null,

  get isIndexing(): boolean {
    return isIndexing
  },

  get isPersisting(): boolean {
    return isPersisting
  },

  async init(): Promise<SearchIndexState> {
    const snapshot = await indexStorage.getItem('snapshot')
    const res = await searchWorker.init(snapshot)
    // NOTICE: the worker strips embeddings from incompatible snapshots
    // (legacy/headerless BGE generations) and reports stale here. Vector
    // scores then drop to 0 and BM25 serves queries while the background
    // backfill (memory-text-journal backgroundIndexAll) re-embeds through
    // indexDocuments — chat turns never block on migration.
    this.lastIndexState = {
      stale: res?.stale === true,
      reason: res?.reason,
      lastIndexedTurnAt: asWatermark(res?.lastIndexedTurnAt),
    }
    mirrorLastIndexedTurnAt(this.lastIndexState.lastIndexedTurnAt)
    return this.lastIndexState
  },

  /**
   * Persist the worker's in-memory index to IndexedDB.
   *
   * `watermark` overrides the snapshot header's coverage frontier. The
   * background backfill walks oldest→newest and supplies an explicit frontier
   * per checkpoint: the worker's own `trackIndexedTurnTime` is a max-of-batch
   * value, so indexing a hot set first would leap the watermark over the
   * older gap that has not been embedded yet.
   */
  async persist(force = false, options?: { watermark?: number }) {
    if (!force && (isPersisting || Date.now() - lastPersistAt < MIN_PERSIST_INTERVAL_MS))
      return

    const previousLock = persistLock
    persistLock = (async () => {
      try {
        await previousLock
      }
      catch {}

      // Double-check interval within lock unless forced
      if (!force && Date.now() - lastPersistAt < MIN_PERSIST_INTERVAL_MS)
        return

      isPersisting = true
      try {
        const snapshot = await searchWorker.persist(options?.watermark)
        await indexStorage.setItem('snapshot', snapshot)
        lastPersistAt = Date.now()
        // Keep the exposed watermark current with what was just written so
        // delta checks observe persisted (not merely indexed) progress.
        const watermark = asWatermark((snapshot as { header?: { lastIndexedTurnAt?: unknown } } | null)?.header?.lastIndexedTurnAt)
        if (this.lastIndexState)
          this.lastIndexState.lastIndexedTurnAt = watermark
        mirrorLastIndexedTurnAt(watermark)
      }
      finally {
        isPersisting = false
      }
    })()

    return await persistLock
  },

  async search(
    query: string,
    limit = 10,
    characterId?: string,
    options?: LayeredSearchOptions,
  ): Promise<LayeredSearchResult[]> {
    console.log('[Telemetry:LayeredMemory:search:Start]', {
      query,
      limit,
      characterId,
      hasLedger: !!options?.ledger,
      ledgerEntitiesCount: options?.ledger?.entities?.size ?? 0,
      ledgerClaimsCount: options?.ledger?.claims?.size ?? 0,
      ledgerSourcesCount: options?.ledger?.sources?.size ?? 0,
      hasSystemOneStore: !!options?.systemOneStore?.configured,
    })

    // 1. Query Analysis & Turn-1 Anaphora Resolution
    const analysis = analyzeQuery(query, {
      previousTurn: options?.previousTurn,
      previousGrounding: options?.previousGrounding,
      anaphoraEnabled: options?.anaphoraEnabled ?? true,
    })

    // If anaphora was resolved or expandedQuery is richer than raw query,
    // use expandedQuery as the triage anchor so System-1 has the referent context.
    const triageQuery = analysis.anaphoraResolved ? analysis.expandedQuery : query
    const scoringContext = analysis.anaphoraResolved
      ? analysis.expandedQuery.replace(query, '').trim().replace(/^\(|\)$/g, '')
      : ''
    const scoringQuery = scoringContext
      ? `${query} [Context: ${scoringContext}]`
      : query

    // 2. Triage Decision (System 1 Zero-Shot vs Fallback Heuristic)
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
        // NOTICE: under memory pressure skip the Jev triage call entirely —
        // heuristic triage is the safe degraded path and saves a classifier run.
        if (shouldDegradeBackgroundWork()) {
          triage = heuristicTriage(triageQuery)
          mode = 'baseline'
        }
        else {
          options?.signal?.throwIfAborted?.()
          triage = await withTimeout(
            options.systemOneStore.runTriage(triageQuery, { signal: options?.signal }),
            TRIAGE_TIMEOUT_MS,
            'System-1 triage',
          )
          mode = 'pass11'
        }
      }
      catch (err) {
        if ((err as Error)?.name === 'AbortError')
          throw err
        console.warn('[LayeredMemory] System 1 triage failed, falling back to heuristic:', err)
        triage = heuristicTriage(triageQuery)
        mode = 'baseline'
      }
    }
    else {
      triage = heuristicTriage(triageQuery)
      mode = 'baseline'
    }

    // 3. Category Strategy Adaptation (Pass 11)
    const isMultiHopRaw = triage.choice === 'c1_multihop'
      || triage.category === 1
      || triage.searchScope === 'multi_session'
      || triage.conjunctionStructure === 'bridge_relational'
      || triage.conjunctionStructure === 'multi_entity_plural'
      || (triage.requiresDecomposition !== undefined && triage.requiresDecomposition >= 0.5)

    // Reconcile triage categorization when a bridge or multi-entity structure is detected
    if (isMultiHopRaw && triage.choice === 'c4_literal') {
      triage.choice = 'c1_multihop'
      triage.category = 1
    }

    this.lastTriage = triage
    this.lastSearchMode = mode

    const isLiteral = triage.choice === 'c4_literal' || triage.category === 4
    const isMultiHop = triage.choice === 'c1_multihop' || triage.category === 1 || isMultiHopRaw

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
      const matchQuery = analysis.anaphoraResolved ? analysis.expandedQuery : query
      const qLower = matchQuery.toLowerCase()
      const searchTokens = analysis.extractedKeywords.map(k => k.toLowerCase())

      // Find matching claims
      const matchedClaims = new Map<string, ClaimRecord>()

      // A. Direct entity & alias matches
      const matchedEntityIds = new Set<string>()

      function isEntityMatch(targetLabel: string): boolean {
        const norm = targetLabel.trim().toLowerCase()
        if (CONVERSATIONAL_STOPWORDS.has(norm) || LEADING_GRAMMATICAL_WORDS.has(norm) || norm.length < 3)
          return false

        // Exact whole-word match in query or resolved query
        if (matchesWordBoundary(query, targetLabel) || (analysis.anaphoraResolved && matchesWordBoundary(analysis.expandedQuery, targetLabel)))
          return true

        // Cross-match with previous grounding entities if anaphora is resolved or multi-hop
        if ((analysis.anaphoraResolved || isMultiHop) && options?.previousGrounding?.entities) {
          for (const prevEnt of options.previousGrounding.entities) {
            const prevNorm = prevEnt.trim().toLowerCase()
            if (prevNorm.length >= 3 && (matchesWordBoundary(prevNorm, norm) || matchesWordBoundary(norm, prevNorm)))
              return true
          }
        }

        // Significant constituent words from multi-word entity
        // Filter out stopwords, leading conjunctions/prepositions, and short tokens
        // Use high-salience focus keywords from Jev triage if available; otherwise fallback to searchTokens
        const anchorTokens = (triage?.focusKeywords && triage.focusKeywords.length > 0)
          ? triage.focusKeywords.map(k => k.toLowerCase())
          : searchTokens

        const words = norm.split(/\s+/).filter(w => w.length >= 3 && !CONVERSATIONAL_STOPWORDS.has(w) && !LEADING_GRAMMATICAL_WORDS.has(w))
        if (words.some(w => anchorTokens.some(at => matchesWordBoundary(at, w) || matchesWordBoundary(w, at))))
          return true

        // Exact match with anchorTokens
        return anchorTokens.some(t => t.length > 2 && (matchesWordBoundary(targetLabel, t) || matchesWordBoundary(t, targetLabel)))
      }

      for (const ent of ledger.entities.values()) {
        if (isEntityMatch(ent.label)) {
          matchedEntityIds.add(ent.entityId)
        }
      }

      for (const [alias, entIds] of ledger.byAlias.entries()) {
        if (isEntityMatch(alias)) {
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
      // NOTICE: cap scan depth so large graph histories do not block the event loop with O(claims) scans.
      const MAX_UNINDEXED_CLAIMS_TO_SCAN = 100
      let scannedCount = 0
      const allClaims = Array.from(ledger.claims.values())
      const claimMatchTokens = (triage?.focusKeywords && triage.focusKeywords.length > 0)
        ? triage.focusKeywords.map(k => k.toLowerCase())
        : searchTokens.filter(t => t.length > 2 && !CONVERSATIONAL_STOPWORDS.has(t))

      const matchedClaimsWithScores = new Map<string, { claim: ClaimRecord, score: number }>()

      // Scan newest claims first
      for (let i = allClaims.length - 1; i >= 0; i--) {
        if (scannedCount >= MAX_UNINDEXED_CLAIMS_TO_SCAN)
          break
        const c = allClaims[i]
        scannedCount++
        const sub = c.subject.toLowerCase()
        const pred = c.predicate.toLowerCase()
        const obj = c.object.toLowerCase()

        let matchCount = 0
        let hasFocalKeywordMatch = false
        if (qLower.includes(sub))
          matchCount += 2
        if (qLower.includes(obj))
          matchCount += 2

        for (const t of claimMatchTokens) {
          if (sub.includes(t) || obj.includes(t) || pred.includes(t)) {
            matchCount++
            const sc = triage?.wordScores?.[t]
              ?? (triage?.wordScores ? Object.entries(triage.wordScores).find(([k]) => k.toLowerCase() === t)?.[1] : undefined)
            if (typeof sc === 'number' && sc >= 0.65 && t !== 'ren' && t !== 'season') {
              hasFocalKeywordMatch = true
            }
          }
        }

        if (matchCount > 0) {
          // If a claim matches both subject/object or high-salience focal keywords, it gets 0.85 - 0.95.
          // Generic background matches (e.g. 'season' or common character names) score <= 0.55 to prevent crowding out direct answers.
          const claimScore = hasFocalKeywordMatch && matchCount >= 3
            ? 0.95
            : hasFocalKeywordMatch
              ? 0.80
              : matchCount >= 2
                ? 0.55
                : 0.40
          matchedClaimsWithScores.set(c.claimId, { claim: c, score: claimScore })
        }
      }

      // C. Format into LayeredSearchResults
      for (const { claim: c, score: claimScore } of matchedClaimsWithScores.values()) {
        const dateStr = c.dateInfo?.formatted_label ? ` (${c.dateInfo.formatted_label})` : ''
        const content = `[Knowledge Graph] ${c.subject} ${c.predicate} ${c.object}${dateStr}`
        kgHits.push({
          id: `claim:${c.claimId}`,
          content,
          kind: 'ltmm',
          timestamp: c.dateInfo?.iso_date || new Date().toISOString(),
          source: `kg:${c.claimId}`,
          score: claimScore,
          vectorScore: claimScore - 0.05,
          keywordScore: claimScore,
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

      // D. Direct entity mentions in dialogue sources (Mention fallback)
      // When entities match, surface their dialogue sources from the Knowledge Graph
      // so characters/entities without explicit S-P-O claims still return grounded dialogue context.
      // Mod 1: Score below claims (~0.70 vs 0.95 so verified S-P-O claims stay Priority 1).
      // Mod 2: System-1 Focal Entity Disambiguation: when multiple candidate entities match the query,
      //        ask System 1 (Jev choice) to select the primary inquiry subject (~100ms).
      // Mod 3: Weighted Fair-Share Allocation: Focal entity gets up to 50% quota; remaining distinct entities
      //        divide the rest equally. On System 1 failure or 429, quota is divided equally.
      // Mod 4: Stable IDs: `kg-mention:${src.turnId}` for seen dedup.
      // Mod 5: Carry sessionId in source (`chat:${sessionId}`) for isSameSession/jumpToMessage.
      const MAX_FALLBACK_MENTION_HITS = 8

      // 1. Identify focal entity via System 1 when multiple entities are present
      let focalEntityId: string | null = null
      if (options?.systemOneStore?.configured && options?.systemOneStore?.identifyFocusEntity && matchedEntityIds.size > 1) {
        try {
          const candidateList = Array.from(matchedEntityIds)
            .map((id) => {
              const ent = ledger.entities.get(id)
              return ent ? { id: ent.entityId, label: ent.label, type: ent.type } : null
            })
            .filter((c): c is { id: string, label: string, type: any } => !!c)

          if (candidateList.length > 1) {
            // Sort candidateList by relevance to focusKeywords (if available) so top matches enter the 20-candidate pool
            if (triage?.focusKeywords && triage.focusKeywords.length > 0) {
              const anchors = triage.focusKeywords.map(k => k.toLowerCase())
              candidateList.sort((a, b) => {
                const aHits = anchors.filter(k => matchesWordBoundary(a.label.toLowerCase(), k) || matchesWordBoundary(k, a.label.toLowerCase())).length
                const bHits = anchors.filter(k => matchesWordBoundary(b.label.toLowerCase(), k) || matchesWordBoundary(k, b.label.toLowerCase())).length
                return bHits - aHits
              })
            }

            options?.signal?.throwIfAborted?.()
            focalEntityId = await withTimeout(
              options.systemOneStore.identifyFocusEntity(scoringQuery, candidateList, { signal: options?.signal }),
              TRIAGE_TIMEOUT_MS,
              'System-1 focus entity classification',
            )
          }
        }
        catch (err) {
          if ((err as Error)?.name === 'AbortError')
            throw err
          console.warn('[LayeredMemory] System 1 focus entity classification failed, falling back to equal fair-share:', err)
        }
      }

      // 2. Discover all candidate sources mentioning any of the matched entities
      const candidateSourceMap = new Map<string, { src: SourceRecord, entities: Set<string> }>()

      for (const entId of matchedEntityIds) {
        const ent = ledger.entities.get(entId)
        if (!ent)
          continue

        // Skip single-mention concept or unknown junk to prevent graph clutter
        if ((ent.type === 'concept' || ent.type === 'unknown') && (ent.mentions?.size ?? 0) < 2)
          continue

        for (const mId of (ent.mentions || [])) {
          let src = ledger.sources.get(mId)
          if (!src) {
            const mention = ledger.mentions.get(mId)
            if (mention?.turnId)
              src = ledger.sources.get(mention.turnId)
          }
          if (src) {
            let entry = candidateSourceMap.get(src.turnId)
            if (!entry) {
              entry = { src, entities: new Set() }
              candidateSourceMap.set(src.turnId, entry)
            }
            entry.entities.add(ent.label)
          }
        }
      }

      // 3. Score candidate sources by multi-entity co-occurrence & proximity
      const focusTerms = (triage?.focusKeywords && triage.focusKeywords.length > 0)
        ? triage.focusKeywords
        : searchTokens

      const salientWordsFromTriage: string[] = []
      if (triage?.wordScores) {
        for (const [w, sc] of Object.entries(triage.wordScores)) {
          if (typeof sc === 'number' && sc >= 0.20 && w.length >= 3 && !CONVERSATIONAL_STOPWORDS.has(w.toLowerCase())) {
            salientWordsFromTriage.push(w)
          }
        }
      }

      const allTargetTerms = Array.from(new Set([
        ...Array.from(matchedEntityIds).map(id => ledger.entities.get(id)?.label).filter((l): l is string => !!l),
        ...focusTerms,
        ...salientWordsFromTriage,
      ])).filter(t => t.length >= 3 && !CONVERSATIONAL_STOPWORDS.has(t.toLowerCase()))

      const termWeights = new Map<string, number>()
      for (const term of allTargetTerms) {
        const tLower = term.toLowerCase()
        let weight = 0.5
        if (triage?.wordScores) {
          if (typeof triage.wordScores[term] === 'number') {
            weight = triage.wordScores[term]
          }
          else {
            for (const [w, sc] of Object.entries(triage.wordScores)) {
              if (w.toLowerCase() === tLower && typeof sc === 'number') {
                weight = sc
                break
              }
            }
          }
        }
        else if (focusTerms.some(ft => ft.toLowerCase() === tLower)) {
          weight = 0.8
        }
        termWeights.set(tLower, weight)
      }

      interface ScoredSourceCandidate {
        src: SourceRecord
        entities: string[]
        distinctMatchCount: number
        maxSalienceInWindow: number
        snippet: string
        score: number
      }

      const scoredSources: ScoredSourceCandidate[] = []

      for (const { src, entities } of candidateSourceMap.values()) {
        const text = src.text
        const textLower = text.toLowerCase()

        // Find match positions for all target terms with word boundaries
        const matches: Array<{ term: string, index: number }> = []
        for (const term of allTargetTerms) {
          const tLower = term.toLowerCase()
          let pos = 0
          while ((pos = textLower.indexOf(tLower, pos)) !== -1) {
            const before = pos === 0 ? ' ' : textLower[pos - 1]
            const after = pos + tLower.length >= textLower.length ? ' ' : textLower[pos + tLower.length]
            if (!/\w/.test(before) && !/\w/.test(after)) {
              matches.push({ term: tLower, index: pos })
            }
            pos += tLower.length
          }
        }

        if (matches.length === 0)
          continue

        const distinctMatchedTerms = new Set(matches.map(m => m.term))
        const distinctMatchCount = distinctMatchedTerms.size

        // Find best cluster window of ~1200 chars containing the highest cumulative salience of distinct terms
        let bestSnippet = text
        let maxSalienceInWindow = 0
        if (text.length > 1500) {
          let bestStart = 0
          let bestEnd = Math.min(text.length, 1200)

          for (const m of matches) {
            const wStart = Math.max(0, m.index - 250)
            const wEnd = Math.min(text.length, wStart + 1200)
            const windowText = textLower.slice(wStart, wEnd)
            let salienceInWindow = 0
            for (const t of distinctMatchedTerms) {
              if (windowText.includes(t))
                salienceInWindow += (termWeights.get(t) ?? 0.5)
            }
            if (salienceInWindow > maxSalienceInWindow) {
              maxSalienceInWindow = salienceInWindow
              bestStart = wStart
              bestEnd = wEnd
            }
          }

          const prefix = bestStart > 0 ? '... ' : ''
          const suffix = bestEnd < text.length ? ' ...' : ''
          bestSnippet = `${prefix}${text.slice(bestStart, bestEnd).trim()}${suffix}`
        }
        else {
          for (const t of distinctMatchedTerms) {
            maxSalienceInWindow += (termWeights.get(t) ?? 0.5)
          }
        }

        // Multi-entity co-occurrence scoring
        // Base score for 1 match: 0.70.
        // Each additional distinct entity/keyword adds +0.06 up to max 0.96.
        // Bonus if focalEntityId is among the matched entities: +0.03.
        let coScore = 0.70 + Math.min(0.24, Math.max(0, distinctMatchCount - 1) * 0.06)
        if (focalEntityId && entities.has(ledger.entities.get(focalEntityId)?.label ?? '')) {
          coScore = Math.min(0.97, coScore + 0.03)
        }
        if (maxSalienceInWindow >= 2.5) {
          coScore = Math.max(coScore, 0.95)
        }

        scoredSources.push({
          src,
          entities: Array.from(entities),
          distinctMatchCount,
          maxSalienceInWindow,
          snippet: bestSnippet,
          score: coScore,
        })
      }

      // Sort candidate sources: highest window salience and match count first, then newest
      scoredSources.sort((a, b) => {
        if (Math.abs(b.maxSalienceInWindow - a.maxSalienceInWindow) > 0.1)
          return b.maxSalienceInWindow - a.maxSalienceInWindow
        if (b.distinctMatchCount !== a.distinctMatchCount)
          return b.distinctMatchCount - a.distinctMatchCount
        if (b.score !== a.score)
          return b.score - a.score
        return (b.src.timestamp || 0) - (a.src.timestamp || 0)
      })

      // Take top hits up to MAX_FALLBACK_MENTION_HITS
      for (const cand of scoredSources.slice(0, MAX_FALLBACK_MENTION_HITS)) {
        const src = cand.src
        const isoDate = src.timestamp ? new Date(src.timestamp).toISOString() : new Date().toISOString()
        const speakerPrefix = src.speaker && src.speaker !== 'Unknown' ? `${src.speaker}: ` : ''
        const content = `${speakerPrefix}${cand.snippet}`

        let sessionSource = `kg:source:${src.turnId}`
        if (src.session) {
          sessionSource = `chat:${src.session}`
        }
        else if (src.turnId.startsWith('turn-')) {
          const parts = src.turnId.split('-')
          if (parts.length >= 3) {
            sessionSource = `chat:${parts.slice(1, -1).join('-')}`
          }
        }

        const labelSummary = cand.entities.slice(0, 3).join(' & ') || 'Entity'

        kgHits.push({
          id: `kg-mention:${src.turnId}`,
          title: `[Knowledge Graph] ${labelSummary} (Mention)`,
          content,
          kind: 'raw',
          characterId: characterId || undefined,
          timestamp: isoDate,
          source: sessionSource,
          score: cand.score,
          vectorScore: cand.score,
          keywordScore: cand.score,
          temporalScore: 0.50,
          layerBoost: 0.05,
          profile: 'default',
          subject: labelSummary,
          predicate: 'mentioned in',
          object: `${src.speaker || 'dialogue'}'s turn`,
          evidence: [src.turnId],
          isKgClaim: true,
          triage,
        })
      }

      console.log('[Telemetry:LayeredMemory:KGTraversal:Result]', {
        query,
        hasLedger: true,
        matchedEntityIdsCount: matchedEntityIds.size,
        matchedEntities: [...matchedEntityIds].map(id => ledger.entities.get(id)?.label),
        matchedClaimsCount: matchedClaimsWithScores.size,
        matchedSourcesCount: candidateSourceMap.size,
        kgHitsCount: kgHits.length,
        kgHits: kgHits.map(h => ({
          id: h.id,
          title: h.title,
          subject: h.subject,
          predicate: h.predicate,
          object: h.object,
          source: h.source,
        })),
      })
    }
    else {
      console.log('[Telemetry:LayeredMemory:KGTraversal:Result]', {
        query,
        hasLedger: false,
        kgHitsCount: 0,
      })
    }

    // 5. Candidate Retrieval from Search Web Worker (Vector + BM25)
    // NOTICE: cap sub-query fan-out — each sub-query is a full EmbeddingGemma ONNX
    // embedding + hybrid score; unbounded decomposition multiplies WebGPU
    // work per chat turn and was a direct swap-pressure multiplier.
    const subQueries = decomposeQuery(query, triage).slice(0, MAX_SUB_QUERIES)
    let scoredWorkerHits: LayeredSearchResult[] = []

    try {
      if (subQueries.length > 1) {
      // Multi-Pass Sub-Query Retrieval (Pass 11 Proof Bundles)
      // NOTICE: embed primary query once and reuse queryVector across sub-queries
      // so we do not run multiple sequential WebGPU ONNX embeddings per turn.
        options?.signal?.throwIfAborted?.()

        // 1. Run primary query first to compute the base vector
        const primaryRes = await searchWorker.search(
          analysis.expandedQuery,
          workerLimit,
          characterId,
          analysis.temporalHooks,
          options?.signal,
        )
        const primaryVector = primaryRes.queryVector

        // 2. Run remaining sub-queries reusing primaryVector (with specialized keyword/BM25 per sub-plan)
        const secondaryResults = await Promise.all(
          subQueries.slice(1).map(async (sq) => {
            const subAnalysis = analyzeQuery(sq, { anaphoraEnabled: false })
            const res = await searchWorker.search(
              subAnalysis.expandedQuery,
              workerLimit,
              characterId,
              subAnalysis.temporalHooks.length > 0 ? subAnalysis.temporalHooks : analysis.temporalHooks,
              options?.signal,
              primaryVector,
            )
            return { sq, subAnalysis, res, isPrimary: false }
          }),
        )

        const subResults = [
          { sq: subQueries[0], subAnalysis: analysis, res: primaryRes, isPrimary: true },
          ...secondaryResults,
        ]

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
        options?.signal?.throwIfAborted?.()
        const rawResults = await searchWorker.search(
          analysis.expandedQuery,
          workerLimit,
          characterId,
          analysis.temporalHooks,
          options?.signal,
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
    }
    catch (workerErr) {
      if ((workerErr as Error)?.name === 'AbortError')
        throw workerErr
      console.warn('[LayeredMemory] Search worker candidate retrieval failed, proceeding with in-memory KG hits:', workerErr)
    }

    console.log('[Telemetry:LayeredMemory:WorkerRetrieval:Result]', {
      query,
      subQueriesCount: subQueries.length,
      workerLimit,
      scoredWorkerHitsCount: scoredWorkerHits.length,
      topWorkerHits: scoredWorkerHits.slice(0, 5).map(h => ({
        id: h.id,
        title: (h as any).title,
        kind: h.kind,
        score: h.score,
        vectorScore: h.vectorScore,
        keywordScore: h.keywordScore,
        source: h.source,
      })),
    })

    // 7. Merge Knowledge Graph hits + Scored Worker hits (Dual-Track Fair-Share Quota)
    const mergedHits: LayeredSearchResult[] = []
    const seen = new Set<string>()

    // Order Knowledge Graph hits by relevance score descending so high-relevance co-occurrence mentions compete fairly with S-P-O claims
    const orderedKgHits = [...kgHits].sort((a, b) => b.score - a.score)

    // 1. Guaranteed slots for Knowledge Graph hits (up to half the quota, min 1 if hits exist)
    const kgQuota = Math.min(Math.max(1, Math.floor(returnLimit / 2)), orderedKgHits.length)
    const selectedKg = orderedKgHits.slice(0, kgQuota)
    for (const kg of selectedKg) {
      if (!seen.has(kg.id)) {
        seen.add(kg.id)
        mergedHits.push(kg)
      }
    }

    // 2. Temporal Date-matched worker hits if query has temporal intent (C2 quota)
    if (isTemporal) {
      const dateHits = scoredWorkerHits.filter(h => h.dateMatchBoost && h.dateMatchBoost > 0)
      for (const dh of dateHits.slice(0, 3)) {
        if (!seen.has(dh.id)) {
          seen.add(dh.id)
          mergedHits.push({ ...dh, triage })
        }
      }
    }

    // 3. Guaranteed slots for episodic worker hits (raw dialogue, journals, daily recaps)
    const workerQuota = Math.min(Math.max(3, returnLimit - mergedHits.length), scoredWorkerHits.length)
    for (const h of scoredWorkerHits.slice(0, workerQuota)) {
      if (!seen.has(h.id)) {
        seen.add(h.id)
        mergedHits.push({ ...h, triage })
      }
    }

    // 4. Fill remaining slots from remaining worker hits, then remaining KG items
    for (const h of scoredWorkerHits.slice(workerQuota)) {
      if (mergedHits.length >= returnLimit)
        break
      if (!seen.has(h.id)) {
        seen.add(h.id)
        mergedHits.push({ ...h, triage })
      }
    }

    for (const kg of orderedKgHits.slice(kgQuota)) {
      if (mergedHits.length >= returnLimit)
        break
      if (!seen.has(kg.id)) {
        seen.add(kg.id)
        mergedHits.push(kg)
      }
    }

    // 8. Level-1 Cross-Encoder Reranker Booster (if System 1 is configured)
    // NOTICE: skipped under memory pressure — RRF ordering stands on its own.
    let finalHits = mergedHits
    if (options?.systemOneStore?.configured && mergedHits.length > 0 && !shouldDegradeBackgroundWork()) {
      try {
        options?.signal?.throwIfAborted?.()
        const poolToRerank = mergedHits.slice(0, 10).map(h => ({
          id: h.id,
          text: h.content,
          score: h.score,
        }))
        const rerankRes = await withTimeout(
          options.systemOneStore.runRerank(scoringQuery, poolToRerank, { signal: options?.signal }),
          RERANK_TIMEOUT_MS,
          'System-1 rerank',
        )
        if (rerankRes.rankedCandidates && rerankRes.rankedCandidates.length > 0) {
          const scoreMap = new Map<string, number>(rerankRes.rankedCandidates.map((r: any) => [r.id, Number(r.finalScore ?? r.score ?? 0)]))
          const irrelevantIds = new Set<string>(
            rerankRes.rankedCandidates
              .filter((r: any) => r.isIrrelevant || (r.finalScore !== undefined && r.finalScore <= 0))
              .map((r: any) => r.id),
          )
          finalHits = mergedHits
            .filter(h => !irrelevantIds.has(h.id))
            .map((h) => {
              if (scoreMap.has(h.id)) {
                return {
                  ...h,
                  score: scoreMap.get(h.id)!,
                }
              }
              // If an item was outside the rerank pool, cap its score so unverified background items
              // cannot jump ahead of verified answers
              return {
                ...h,
                score: Math.min(h.score, 0.45),
              }
            })
            .sort((a, b) => b.score - a.score)
        }
      }
      catch (err) {
        if ((err as Error)?.name === 'AbortError' || String((err as Error)?.message || '').includes('timed out'))
          throw err
        console.warn('[LayeredMemory] System 1 cross-encoder rerank failed, retaining RRF score:', err)
      }
    }

    const sliced = finalHits.slice(0, returnLimit)
    console.log('[Telemetry:LayeredMemory:search:Return]', {
      query,
      returnLimit,
      totalMerged: mergedHits.length,
      finalHitsCount: finalHits.length,
      slicedCount: sliced.length,
      topHits: sliced.map(h => ({
        id: h.id,
        title: (h as any).title,
        kind: h.kind,
        score: h.score,
        source: h.source,
        snippet: h.content ? h.content.slice(0, 100) : '',
      })),
    })

    return sliced
  },

  /**
   * Embed + index a slice of documents.
   *
   * `persist: false` lets the caller own the snapshot cadence. The background
   * backfill uses it to checkpoint every N docs instead of serializing a
   * multi-MB snapshot after every index batch.
   */
  async indexDocuments(documents: any[], options?: { persist?: boolean }) {
    if (!documents || documents.length === 0)
      return

    const run = async () => {
      isIndexing = true
      try {
        await searchWorker.index(documents)
        if (options?.persist !== false)
          await this.persist()
      }
      finally {
        isIndexing = false
      }
    }

    const previousLock = indexLock
    indexLock = (async () => {
      try {
        await previousLock
      }
      catch {}
      await run()
    })()

    return await indexLock
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
