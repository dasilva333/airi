export type MemoryLayer = 'raw' | 'stmm' | 'ltmm'

export interface SearchCandidate {
  id: string
  score: number
}

export interface SearchDocumentMeta {
  id: string
  content: string
  kind: MemoryLayer
  timestamp: string
  source: string
  embedding?: number[]
}

export interface HybridSearchResult extends SearchDocumentMeta {
  score: number
  vectorScore: number
  keywordScore: number
  temporalScore: number
  layerBoost: number
  profile: QueryProfile
}

export interface ScorerConfig {
  weightVector: number
  weightKeyword: number
  temporalWeight: number
  minVectorSimilarity: number
  minScoreSpread: number
  halfLifeDays: number
  layerBoosts: Record<MemoryLayer, number>
  quoteLayerBoosts: Record<MemoryLayer, number>
  rrfK?: number
  mmrLambda?: number
}

export type QueryProfile = 'quote' | 'question' | 'longform' | 'default'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export const defaultScorerConfig: ScorerConfig = {
  weightVector: 0.68,
  weightKeyword: 0.32,
  temporalWeight: 0.12,
  minVectorSimilarity: 0.38,
  minScoreSpread: 0.04,
  halfLifeDays: 30,
  layerBoosts: {
    raw: 0,
    stmm: 0.14,
    ltmm: 0.1,
  },
  quoteLayerBoosts: {
    raw: 0.18,
    stmm: -0.04,
    ltmm: 0.02,
  },
  rrfK: 60,
  mmrLambda: 0.5,
}

function normalizeWeights(weightVector: number, weightKeyword: number) {
  const total = weightVector + weightKeyword
  if (total <= 0)
    return { weightVector: 0.5, weightKeyword: 0.5 }

  return {
    weightVector: weightVector / total,
    weightKeyword: weightKeyword / total,
  }
}

function getTemporalScore(timestamp: string, halfLifeDays: number) {
  const ts = new Date(timestamp).getTime()
  if (!Number.isFinite(ts))
    return 0.75

  const ageDays = Math.max(0, (Date.now() - ts) / MS_PER_DAY)
  if (ageDays <= 0)
    return 1

  return 0.5 ** (ageDays / Math.max(1, halfLifeDays))
}

export function detectQueryProfile(query: string): QueryProfile {
  const normalized = query.trim().toLowerCase()
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length

  if (
    normalized.includes('"')
    || normalized.includes('verbatim')
    || normalized.includes('exact quote')
    || normalized.startsWith('what did ')
    || normalized.startsWith('what was ')
    || normalized.includes(' exact ')
  ) {
    return 'quote'
  }

  if (
    normalized.endsWith('?')
    || /^(who|what|when|where|why|how)\b/.test(normalized)
  ) {
    return 'question'
  }

  if (tokenCount >= 14)
    return 'longform'

  return 'default'
}

function adjustConfigForProfile(config: ScorerConfig, profile: QueryProfile) {
  const weights = normalizeWeights(config.weightVector, config.weightKeyword)

  switch (profile) {
    case 'quote':
      return {
        ...config,
        ...normalizeWeights(0.55, 0.45),
        layerBoosts: config.quoteLayerBoosts,
        mmrLambda: 1.0, // Bypass MMR diversification for exact quotes
      }
    case 'question':
      return {
        ...config,
        ...weights,
      }
    case 'longform':
      return {
        ...config,
        ...normalizeWeights(0.76, 0.24),
        layerBoosts: {
          raw: 0,
          stmm: 0.08,
          ltmm: 0.08,
        },
      }
    default:
      return {
        ...config,
        ...weights,
      }
  }
}

function filterVectorNoise(vectorScores: number[], config: ScorerConfig) {
  if (!vectorScores.length)
    return false

  const best = Math.max(...vectorScores)
  if (best < config.minVectorSimilarity)
    return true

  // If best is extremely good, it's definitely not noise.
  if (best >= 0.7)
    return false

  const mean = vectorScores.reduce((sum, s) => sum + s, 0) / vectorScores.length
  return (best - mean) < config.minScoreSpread
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length)
    return 0

  let dot = 0
  let magA = 0
  let magB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }

  if (!magA || !magB)
    return 0

  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

function getJaccardSimilarity(textA: string, textB: string) {
  const regex = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]|[a-z0-9]+/gi
  const wordsA = new Set(textA.toLowerCase().match(regex) || [])
  const wordsB = new Set(textB.toLowerCase().match(regex) || [])
  if (wordsA.size === 0 && wordsB.size === 0)
    return 1
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)))
  const union = new Set([...wordsA, ...wordsB])
  return intersection.size / union.size
}

function getSimilarity(a: HybridSearchResult, b: HybridSearchResult) {
  if (a.embedding && b.embedding) {
    return cosineSimilarity(a.embedding, b.embedding)
  }
  return getJaccardSimilarity(a.content, b.content)
}

export function scoreHybridResults(
  query: string,
  documents: SearchDocumentMeta[],
  vectorCandidates: SearchCandidate[],
  keywordCandidates: SearchCandidate[],
  config: ScorerConfig = defaultScorerConfig,
): HybridSearchResult[] {
  const profile = detectQueryProfile(query)
  const effectiveConfig = adjustConfigForProfile(config, profile)
  const vectorMap = new Map(vectorCandidates.map(candidate => [candidate.id, candidate.score]))
  const keywordMap = new Map(keywordCandidates.map(candidate => [candidate.id, candidate.score]))
  const vectorScores = [...vectorMap.values()]
  const dropVectorSignal = filterVectorNoise(vectorScores, effectiveConfig)

  const results = documents
    .map((document) => {
      const vectorRank = vectorCandidates.findIndex(c => c.id === document.id) + 1
      const keywordRank = keywordCandidates.findIndex(c => c.id === document.id) + 1

      const rrfK = effectiveConfig.rrfK ?? 60
      const scaleFactor = rrfK + 1

      const rrfVectorScore = vectorRank > 0 ? (scaleFactor / (rrfK + vectorRank)) : 0
      const rrfKeywordScore = keywordRank > 0 ? (scaleFactor / (rrfK + keywordRank)) : 0

      const vectorScore = dropVectorSignal ? 0 : (vectorMap.get(document.id) ?? 0)
      const keywordScore = keywordMap.get(document.id) ?? 0

      const signalScore = (effectiveConfig.weightVector * (dropVectorSignal ? 0 : rrfVectorScore))
        + (effectiveConfig.weightKeyword * rrfKeywordScore)

      const temporalScore = getTemporalScore(document.timestamp, effectiveConfig.halfLifeDays)
      const layerBoost = effectiveConfig.layerBoosts[document.kind] ?? 0
      const score = signalScore + (temporalScore * effectiveConfig.temporalWeight) + layerBoost

      return {
        ...document,
        score,
        vectorScore,
        keywordScore,
        temporalScore,
        layerBoost,
        profile,
      }
    })
    .filter(result => result.vectorScore > 0 || result.keywordScore > 0)

  results.sort((a, b) => {
    if (b.score !== a.score)
      return b.score - a.score

    if (b.vectorScore !== a.vectorScore)
      return b.vectorScore - a.vectorScore

    if (b.keywordScore !== a.keywordScore)
      return b.keywordScore - a.keywordScore

    const kindOrder: Record<MemoryLayer, number> = {
      stmm: 0,
      ltmm: 1,
      raw: 2,
    }

    if (kindOrder[a.kind] !== kindOrder[b.kind])
      return kindOrder[a.kind] - kindOrder[b.kind]

    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  })

  // Apply Maximal Marginal Relevance (MMR) for diversification
  const poolSize = 30
  const candidates = results.slice(0, poolSize)
  const remaining = results.slice(poolSize)
  const selected: HybridSearchResult[] = []
  const lambda = effectiveConfig.mmrLambda ?? 0.5

  while (candidates.length > 0) {
    let bestIndex = -1
    let bestMmrScore = -Infinity

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]
      let mmrScore = 0

      if (selected.length === 0) {
        mmrScore = candidate.score
      }
      else {
        let maxSim = -Infinity
        for (const s of selected) {
          const sim = getSimilarity(candidate, s)
          if (sim > maxSim)
            maxSim = sim
        }
        mmrScore = lambda * candidate.score - (1 - lambda) * maxSim
      }

      if (mmrScore > bestMmrScore) {
        bestMmrScore = mmrScore
        bestIndex = i
      }
    }

    if (bestIndex !== -1) {
      selected.push(candidates[bestIndex])
      candidates.splice(bestIndex, 1)
    }
    else {
      break
    }
  }

  return [...selected, ...remaining]
}
