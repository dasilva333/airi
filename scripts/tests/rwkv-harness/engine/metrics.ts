/**
 * Phase 3 scoring metrics: compare RWKV-synthesized Echo Chips against
 * cloud-generated ground-truth chips.
 *
 * ## Embedding choice (read me)
 *
 * Semantic similarity uses a **character 3-gram TF hash-embedder** into 256
 * dims, L2-normalised. This is NOT a learned embedding model — it is a
 * deterministic, zero-download, Vue-free stand-in chosen because:
 *   - the harness runs in Node (stage-ui's worker embeddings pull Vue/Pinia);
 *   - a 0.1B RWKV mean-pooled `emb.weight` embedder isn't a real semantic model
 *     and would flatter RWKV output (same embedder scores same generator).
 *
 * Because the embedder is weak, we ALWAYS pair the cosine similarity with a
 * token-overlap F1 sanity metric and flag sessions where they diverge. Calibrate
 * the pass gate empirically (see eval runner), don't trust an absolute number.
 */

/** Per-pill shape mirroring prod ChipSchema. Fields tolerate malformed 0.1B output. */
export interface EvalPill {
  content?: unknown
  type?: unknown
  relevanceScore?: unknown
  evidence_indices?: unknown
}

/**
 * Coerce a possibly-malformed pill's content to a searchable string.
 * Mirrors production normalize aliases (echo-chips.ts): `content || pill || text || title`.
 * Reads the alias keys off the pill object itself, and also handles the nested
 * case where `content` is an object carrying the text.
 */
export function pillText(p: EvalPill | null | undefined): string {
  if (!p)
    return ''
  const o = p as Record<string, unknown>
  // 1) content is a direct string/number/bool
  const c = o.content
  if (typeof c === 'string')
    return c
  if (typeof c === 'number' || typeof c === 'boolean')
    return String(c)
  // 2) content is an object carrying the text
  if (c && typeof c === 'object') {
    const inner = c as Record<string, unknown>
    for (const k of ['content', 'pill', 'text', 'title']) {
      if (typeof inner[k] === 'string')
        return inner[k] as string
    }
  }
  // 3) aliases on the pill object itself (production: p.pill || p.text; title common)
  for (const k of ['pill', 'text', 'title', 'label']) {
    if (typeof o[k] === 'string')
      return o[k] as string
  }
  return ''
}

/** Coerce a pill's relevance score to a number, or undefined if absent/invalid. */
export function pillScore(p: EvalPill | null | undefined): number | undefined {
  const r = p?.relevanceScore
  if (typeof r === 'number' && Number.isFinite(r))
    return r
  if (typeof r === 'string') {
    const n = Number(r)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Coerce a pill's type to a lowercase string for type-agreement comparison. */
export function pillType(p: EvalPill | null | undefined): string {
  const t = p?.type
  return typeof t === 'string' ? t.toLowerCase().trim() : ''
}

const DIM = 256

/** Tokenize to lowercase word tokens for overlap metrics. */
function wordTokens(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').split(/\s+/).filter(Boolean)
}

/** Extract character 3-grams (with word-boundary padding) for fuzzy similarity. */
function charTrigrams(text: string): string[] {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ').trim()} `
  const grams: string[] = []
  for (let i = 0; i < t.length - 2; i++)
    grams.push(t.slice(i, i + 3))
  return grams
}

/** FNV-1a hash → bucket index. Deterministic across runs. */
function hashBucket(s: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % DIM
}

/** Embed text into a 256-dim L2-normalised count vector over char-3-grams. */
export function embed(text: string): Float32Array {
  const v = new Float32Array(DIM)
  for (const g of charTrigrams(text)) v[hashBucket(g)] += 1
  let norm = 0
  for (let i = 0; i < DIM; i++) norm += v[i] * v[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < DIM; i++) v[i] /= norm
  return v
}

/** Cosine similarity of two L2-normalised vectors (== dot product). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i]
  return Math.max(-1, Math.min(1, dot))
}

/** Console badge reflecting how well a synthesized pill matches ground truth. */
export function scoreBadge(similarity: number): string {
  if (similarity >= 0.75)
    return '[gte.75]'
  if (similarity >= 0.55)
    return '[gte.55]'
  if (similarity >= 0.40)
    return '[gte.40]'
  return '[low]'
}

/** Bag-of-words token-overlap F1 (sanity metric; catches inflated cosine). */
export function tokenF1(aText: string, bText: string): number {
  const a = new Set(wordTokens(aText))
  const b = new Set(wordTokens(bText))
  if (a.size === 0 || b.size === 0)
    return 0
  let inter = 0
  a.forEach((t) => {
    if (b.has(t))
      inter++
  })
  const precision = inter / b.size
  const recall = inter / a.size
  return (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall)
}

export interface PillMatch {
  gtContent: string
  predContent: string | null
  similarity: number
  tokenF1: number
  typeAgreement: boolean | null
  relevanceError: number | null
}

/** Aggregate view over many session scores for one decoding config. */
export interface ConfigReport {
  configName: string
  sessionsRun: number
  schemaOkSessions: number
  schemaDirectOkSessions: number
  meanSimilarity: number
  meanPrecision: number
  meanTokenF1: number
  meanTypeAgreement: number
  meanRelevanceCalibration: number
  totalGt: number
  totalGtMatched: number
  totalPred: number
  divergentSessions: number
  avgPromptTokens: number
  avgCompletionTokens: number
  avgElapsedMs: number
}

export interface SessionScore {
  sessionId: string
  /** mean over GT pills of max cosine similarity to any predicted pill */
  evidenceSpannedSimilarity: number
  /** fraction of predicted pills with sim >= threshold vs. any GT pill (hallucination check) */
  precision: number
  /** mean token-F1 across matched pairs (sanity) */
  meanTokenF1: number
  /** exact type agreement on matched pill pairs */
  typeAgreement: number
  /** mean |relevanceScore_pred - relevanceScore_gt| on matched pairs */
  relevanceCalibration: number
  /** how many GT pills found any match above the match threshold */
  gtMatched: number
  gtTotal: number
  predTotal: number
  matches: PillMatch[]
  /** embedding/F1 divergence flags (|cos - f1| > 0.3) */
  divergenceFlag: boolean
}

export interface ScoreOptions {
  /** similarity >= this counts a GT pill as "covered" (recall-ish). */
  matchThreshold?: number
  /** similarity >= this counts a predicted pill as non-hallucinated (precision). */
  precisionThreshold?: number
}

/**
 * Score one session: for each ground-truth pill, find its best-matching
 * predicted pill by cosine similarity; compute precision over predictions;
 * report type agreement + relevance calibration on matched pairs.
 */
export function scoreSession(
  sessionId: string,
  predicted: EvalPill[],
  groundTruth: EvalPill[],
  opts: ScoreOptions = {},
): SessionScore {
  const matchThreshold = opts.matchThreshold ?? 0.55
  const precisionThreshold = opts.precisionThreshold ?? 0.40
  const predEmb = predicted.map(p => embed(pillText(p)))

  const matches: PillMatch[] = []
  let simSum = 0
  let f1Sum = 0
  let typeHits = 0
  let relErrSum = 0
  let matchedCount = 0

  for (const gt of groundTruth) {
    const gtText = pillText(gt)
    const gtType = pillType(gt)
    const gtScore = pillScore(gt)
    const ge = embed(gtText)
    let bestIdx = -1
    let bestSim = -1
    for (let i = 0; i < predicted.length; i++) {
      const s = cosineSimilarity(ge, predEmb[i])
      if (s > bestSim) {
        bestSim = s
        bestIdx = i
      }
    }
    const pred = bestIdx >= 0 ? predicted[bestIdx] : null
    const predText = pillText(pred)
    const f1 = pred ? tokenF1(gtText, predText) : 0
    simSum += Math.max(0, bestSim)
    f1Sum += f1
    const isMatch = bestIdx >= 0 && bestSim >= matchThreshold
    if (isMatch && pred) {
      matchedCount++
      const predType = pillType(pred)
      const predScore = pillScore(pred)
      const typeOk = predType !== '' && predType === gtType
      if (typeOk)
        typeHits++
      const relErr = (predScore !== undefined && gtScore !== undefined)
        ? Math.abs(predScore - gtScore)
        : null
      if (relErr !== null)
        relErrSum += relErr
      matches.push({
        gtContent: gtText,
        predContent: predText,
        similarity: bestSim,
        tokenF1: f1,
        typeAgreement: typeOk,
        relevanceError: relErr,
      })
    }
    else {
      matches.push({
        gtContent: gtText,
        predContent: pred ? predText : null,
        similarity: bestSim,
        tokenF1: f1,
        typeAgreement: null,
        relevanceError: null,
      })
    }
  }

  const gtTotal = groundTruth.length
  const predTotal = predicted.length
  const evidenceSpannedSimilarity = gtTotal ? simSum / gtTotal : 0
  const meanTokenF1 = gtTotal ? f1Sum / gtTotal : 0
  const typeAgreement = matchedCount ? typeHits / matchedCount : 0
  const relevanceCalibration = matchedCount ? relErrSum / matchedCount : 0
  const divergenceFlag = Math.abs(evidenceSpannedSimilarity - meanTokenF1) > 0.3

  // Precision: predicted pills that match any GT pill above precisionThreshold.
  const gtEmb = groundTruth.map(g => embed(pillText(g)))
  let nonHallucinated = 0
  for (let i = 0; i < predicted.length; i++) {
    const pe = predEmb[i]
    let best = -1
    for (const ge of gtEmb)
      best = Math.max(best, cosineSimilarity(pe, ge))
    if (best >= precisionThreshold)
      nonHallucinated++
  }
  const precision = predTotal ? nonHallucinated / predTotal : 0

  return {
    sessionId,
    evidenceSpannedSimilarity,
    precision,
    meanTokenF1,
    typeAgreement,
    relevanceCalibration,
    gtMatched: matchedCount,
    gtTotal,
    predTotal,
    matches,
    divergenceFlag,
  }
}
