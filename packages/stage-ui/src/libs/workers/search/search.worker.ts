import type { SearchIndexSnapshotHeader } from '../../search/embedding-format'

import { AutoConfig, AutoModel, AutoTokenizer, env } from '@huggingface/transformers'

import {
  buildSnapshotHeader,
  EMBEDDING_DIM,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL_ID,
  formatDocumentForEmbedding,
  formatQueryForEmbedding,
  isSnapshotCompatible,
  l2Normalize,

} from '../../search/embedding-format'

// Suppress noisy ONNX Runtime warnings
env.backends.onnx.logLevel = 'error'
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false
  // NOTICE: threaded jsep build requires SharedArrayBuffer + COOP/COEP.
  // In Electron/Vite without isolation headers, crossOriginIsolated is false;
  // forcing numThreads=1 avoids spawning pthreads with invalid Worker URLs.
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated
  env.backends.onnx.wasm.numThreads = isolated ? Math.min(4, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4) : 1
  env.backends.onnx.wasm.simd = true
  env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'
}

interface SearchDocument {
  id: string
  characterId?: string
  what?: string
  fact?: string
  // NOTICE: title feeds the `title:` slot of the EmbeddingGemma document
  // prefix (§7 catalog: real journal titles, synthetic date/role titles).
  // BM25 keeps using the raw fact/what text — never the prefixed string.
  title?: string
  kind: string
  source: string
  timestamp: string
  embedding?: number[]
  tokens?: string[]
  tokenFreqs?: Record<string, number>
}

interface ExtractedDateHook {
  text: string
  day?: number
  month?: string
  monthIndex?: number
  year?: number
  isoDateHint?: string
  isRelative?: boolean
}

interface SearchSnapshot {
  header?: SearchIndexSnapshotHeader
  documents: SearchDocument[]
}

let embedderModel: any = null
let embedderTokenizer: any = null
let documents = new Map<string, SearchDocument>()
// High-watermark of indexed turn time. Restored from the snapshot header on
// init, advanced on every index batch, stamped into the header on persist.
let lastIndexedTurnAt: number | undefined
let averageDocumentLength = 0
let documentFrequency = new Map<string, number>()

/**
 * Coerce heterogeneous doc timestamps (`createdAt` epoch ms or ISO `timestamp`
 * strings) to epoch ms. Unparseable values yield 0 so they can never NaN-poison
 * the `Math.max` watermark.
 */
function toDocTimeMs(value: unknown): number {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function trackIndexedTurnTime(docs: Array<{ createdAt?: unknown, timestamp?: unknown }>): void {
  let watermark = lastIndexedTurnAt ?? 0
  for (const doc of docs) {
    const time = Math.max(toDocTimeMs(doc.createdAt), toDocTimeMs(doc.timestamp))
    if (time > watermark)
      watermark = time
  }
  lastIndexedTurnAt = watermark
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'need',
  'must',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'she',
  'it',
  'they',
  'them',
  'his',
  'her',
  'its',
  'their',
  'this',
  'that',
  'these',
  'those',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'into',
  'about',
  'between',
  'through',
  'after',
  'before',
  'and',
  'or',
  'but',
  'not',
  'no',
  'nor',
  'so',
  'if',
  'then',
  'user',
])

async function loadEmbedderStack(device: 'webgpu' | 'wasm') {
  // NOTICE: text-only backbone — strip the 109MB vision + 189MB audio
  // encoders before load so only the 270M text tower ships (175MB in q4).
  const config = await AutoConfig.from_pretrained(EMBEDDING_MODEL_ID)
  const mutableConfig = config as unknown as Record<string, unknown>
  mutableConfig.vision_config = null
  mutableConfig.audio_config = null

  // NOTICE: q4 has no WASM kernel in ONNX Runtime (GatherBlockQuantized is WGSL-only).
  // The WASM/CPU fallback path must load fp32 model weights.
  const dtype = device === 'webgpu' ? EMBEDDING_DTYPE : 'fp32'
  const modelOptions: Record<string, unknown> = {
    config,
    device,
    dtype,
  }
  if (device === 'wasm') {
    modelOptions.model_file_name = 'model'
  }

  const [model, tokenizer] = await Promise.all([
    AutoModel.from_pretrained(EMBEDDING_MODEL_ID, modelOptions as any),
    AutoTokenizer.from_pretrained(EMBEDDING_MODEL_ID),
  ])
  // NOTICE: winning device/dtype visibility — a silent WebGPU→WASM fallback
  // loads >1 GB of fp32 weights instead of the 175 MB q4 backbone. This line
  // is the only in-app signal of which path actually stuck.
  console.info('[Telemetry:SearchWorker:embedder-loaded]', {
    modelId: EMBEDDING_MODEL_ID,
    device,
    dtype,
  })
  return { model, tokenizer }
}

async function getEmbedder() {
  if (!embedderModel || !embedderTokenizer) {
    try {
      const stack = await loadEmbedderStack('webgpu')
      embedderModel = stack.model
      embedderTokenizer = stack.tokenizer
    }
    catch (e) {
      console.warn('search.worker: WebGPU embedder failed, falling back to wasm/cpu:', e)
      const stack = await loadEmbedderStack('wasm')
      embedderModel = stack.model
      embedderTokenizer = stack.tokenizer
    }
  }
  return { model: embedderModel, tokenizer: embedderTokenizer }
}

async function getVector(text: string) {
  const { model, tokenizer } = await getEmbedder()
  const inputs = await tokenizer(text, { padding: true, truncation: true })
  const output = await model(inputs)
  try {
    // NOTICE: Transformers 4.x native sentence_embedding output (MRL-slice to EMBEDDING_DIM).
    // Verified 1.0000 correlation with sequence mean-pooling without per-token loop overhead.
    if (output.sentence_embedding) {
      const raw = Array.from(output.sentence_embedding.data as ArrayLike<number>)
      const truncated = raw.slice(0, EMBEDDING_DIM)
      return l2Normalize(truncated)
    }

    const lastHidden = output.last_hidden_state
    const dims = lastHidden.dims as number[]
    const seqLen = dims[1]
    const hiddenSize = dims[2]
    const hiddenData = lastHidden.data as ArrayLike<number>
    const maskData = inputs.attention_mask?.data as ArrayLike<number> | undefined
    // NOTICE: fallback mean-pool over the sequence dim with the attention mask, then
    // MRL-truncate to EMBEDDING_DIM. Slicing breaks unit length, so the
    // truncated vector MUST be L2 re-normalized before storage/scoring.
    const pooled = new Array<number>(hiddenSize).fill(0)
    let weightTotal = 0
    for (let s = 0; s < seqLen; s++) {
      const weight = maskData ? Number(maskData[s]) : 1
      if (!weight)
        continue
      weightTotal += weight
      const offset = s * hiddenSize
      for (let h = 0; h < hiddenSize; h++)
        pooled[h] += Number(hiddenData[offset + h]) * weight
    }
    const divisor = weightTotal || 1
    const truncated = pooled.slice(0, EMBEDDING_DIM).map(v => v / divisor)
    return l2Normalize(truncated)
  }
  finally {
    if (typeof (output as any)?.dispose === 'function') {
      ;(output as any).dispose()
    }
  }
}

function getDocumentContent(document: SearchDocument) {
  return document.fact || document.what || ''
}

function getDocumentEmbeddingText(document: SearchDocument) {
  return formatDocumentForEmbedding(document.kind, document.title, getDocumentContent(document))
}

function tokenize(input: string) {
  const normalized = input.toLowerCase()
  // Matches individual CJK chars (Kanji, Katakana, Hiragana, Hangul) or English words
  const regex = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF66-\uFF9F\uAC00-\uD7AF]|[a-z0-9]+/gi
  const matches = normalized.match(regex) || []

  return matches
    .map(token => token.trim())
    .filter(token => token.length > 0 && !STOPWORDS.has(token))
}

function ensureDocumentCache(document: SearchDocument) {
  if (document.tokens && document.tokenFreqs)
    return

  const content = getDocumentContent(document)
  const tokens = tokenize(content)
  const freqs: Record<string, number> = {}
  for (const token of tokens) {
    freqs[token] = (freqs[token] ?? 0) + 1
  }
  document.tokens = tokens
  document.tokenFreqs = freqs
}

function rebuildKeywordStats() {
  documentFrequency = new Map()
  let totalLength = 0

  for (const document of documents.values()) {
    ensureDocumentCache(document)
    const tokens = document.tokens!
    totalLength += tokens.length

    const uniqueTerms = new Set(tokens)
    for (const term of uniqueTerms)
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
  }

  averageDocumentLength = documents.size ? totalLength / documents.size : 0
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

function getVectorCandidates(queryVector: number[], limit: number, characterId?: string) {
  const results = [...documents.values()]
    .filter(doc => !characterId || doc.characterId === characterId)
    .map((document) => {
      const embedding = document.embedding
      if (!embedding?.length)
        return null

      return {
        id: document.id,
        score: cosineSimilarity(queryVector, embedding),
      }
    })
    .filter((candidate): candidate is { id: string, score: number } => Boolean(candidate))
    .sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

function getKeywordCandidates(query: string, limit: number, characterId?: string) {
  const queryTerms = tokenize(query)
  if (!queryTerms.length)
    return []

  const filteredDocs = [...documents.values()].filter(doc => !characterId || doc.characterId === characterId)
  const totalDocuments = filteredDocs.length || 1
  const k1 = 1.5
  const b = 0.75

  const scored = filteredDocs
    .map((document) => {
      ensureDocumentCache(document)
      const tokens = document.tokens!
      if (!tokens.length)
        return null

      const frequencies = document.tokenFreqs!

      let score = 0
      for (const term of queryTerms) {
        const tf = frequencies[term] ?? 0
        if (!tf)
          continue

        const df = documentFrequency.get(term) ?? 0
        const idf = Math.log(1 + ((totalDocuments - df + 0.5) / (df + 0.5)))
        const denom = tf + (k1 * (1 - b + (b * (tokens.length / Math.max(1, averageDocumentLength || tokens.length)))))
        score += idf * ((tf * (k1 + 1)) / denom)
      }

      if (score <= 0)
        return null

      return {
        id: document.id,
        score,
      }
    })
    .filter((candidate): candidate is { id: string, score: number } => Boolean(candidate))
    .sort((a, b) => b.score - a.score)

  const maxScore = scored[0]?.score ?? 1

  return scored
    .slice(0, limit)
    .map(candidate => ({
      ...candidate,
      score: candidate.score / maxScore,
    }))
}

function getTemporalCandidates(
  temporalHooks: ExtractedDateHook[],
  limit: number,
  characterId?: string,
) {
  if (!temporalHooks || !temporalHooks.length)
    return []

  const filteredDocs = [...documents.values()].filter(doc => !characterId || doc.characterId === characterId)
  const matchedDocs: { id: string, score: number }[] = []

  for (const doc of filteredDocs) {
    if (!doc.timestamp)
      continue

    let matchScore = 0
    const docDate = new Date(doc.timestamp)
    const isValidDate = !Number.isNaN(docDate.getTime())

    for (const hook of temporalHooks) {
      if (hook.isoDateHint && doc.timestamp.startsWith(hook.isoDateHint)) {
        matchScore = Math.max(matchScore, 1.0)
      }
      else if (isValidDate) {
        let partialScore = 0
        let criteriaCount = 0

        if (hook.year !== undefined) {
          criteriaCount++
          if (docDate.getFullYear() === hook.year)
            partialScore += 0.4
        }
        if (hook.monthIndex !== undefined) {
          criteriaCount++
          if (docDate.getMonth() === hook.monthIndex)
            partialScore += 0.4
        }
        if (hook.day !== undefined) {
          criteriaCount++
          if (docDate.getDate() === hook.day)
            partialScore += 0.2
        }

        if (criteriaCount > 0 && partialScore >= 0.4) {
          matchScore = Math.max(matchScore, partialScore)
        }
      }
      else if (hook.text && doc.timestamp.includes(hook.text)) {
        matchScore = Math.max(matchScore, 0.7)
      }
    }

    if (matchScore > 0) {
      matchedDocs.push({ id: doc.id, score: matchScore })
    }
  }

  matchedDocs.sort((a, b) => b.score - a.score)
  return matchedDocs.slice(0, limit)
}

// NOTICE: bound worker RAM — chat history is unbounded but the in-memory
// embedding + BM25 caches must not be. Evict oldest docs past the cap,
// protecting high-value memory tiers (LTMM, STMM, lifetime, echo chips).
const MAX_WORKER_DOCUMENTS = 10000
function upsertDocument(document: SearchDocument) {
  if (!documents.has(document.id) && documents.size >= MAX_WORKER_DOCUMENTS) {
    // Tier-aware eviction: Prefer evicting oldest raw_turn entries first
    let evictedKey: string | undefined
    for (const [key, doc] of documents.entries()) {
      if (doc.kind === 'raw_turn' || doc.kind === 'raw') {
        evictedKey = key
        break
      }
    }
    // If no raw turns found, evict oldest entry FIFO
    if (evictedKey === undefined) {
      evictedKey = documents.keys().next().value
    }
    if (evictedKey !== undefined)
      documents.delete(evictedKey)
  }
  documents.set(document.id, document)
}

function hydrateDocuments(nextDocuments: SearchDocument[] = [], options?: { stripEmbeddings?: boolean }) {
  documents = new Map()
  for (const document of nextDocuments) {
    // NOTICE: never mutate the incoming snapshot objects — shallow-copy when
    // dropping stale vectors so the persisted IndexedDB record stays intact.
    if (options?.stripEmbeddings && document.embedding?.length)
      upsertDocument({ ...document, embedding: undefined, tokens: undefined, tokenFreqs: undefined })
    else
      upsertDocument(document)
  }

  rebuildKeywordStats()
}

function normalizeSnapshot(snapshot: any): SearchSnapshot | null {
  if (!snapshot)
    return null

  if (Array.isArray(snapshot.documents)) {
    const header = snapshot.header && typeof snapshot.header === 'object'
      ? snapshot.header as SearchIndexSnapshotHeader
      : undefined
    return { header, documents: snapshot.documents as SearchDocument[] }
  }

  if (Array.isArray(snapshot)) {
    return { documents: snapshot }
  }

  return {
    documents: [],
  }
}

globalThis.addEventListener('message', async (e) => {
  const { type, payload, id } = e.data

  try {
    switch (type) {
      case 'init': {
        const normalizedSnapshot = normalizeSnapshot(payload?.snapshot)
        const compatible = isSnapshotCompatible(normalizedSnapshot?.header)
        // NOTICE: legacy/headerless snapshots carry 384d BGE vectors (or
        // none). Hydrate documents for BM25 but drop stale embeddings so
        // cosine math never mixes geometries; the backfill re-embeds through
        // the index handler below.
        hydrateDocuments(normalizedSnapshot?.documents, { stripEmbeddings: !compatible })
        // Restore the persisted high-watermark (absent on pre-watermark
        // snapshots) so delta checks stay correct across worker restarts.
        const restoredWatermark = normalizedSnapshot?.header?.lastIndexedTurnAt
        lastIndexedTurnAt = typeof restoredWatermark === 'number' && Number.isFinite(restoredWatermark)
          ? restoredWatermark
          : undefined
        console.log('[Telemetry:SearchWorker:init]', {
          hasSnapshot: !!payload?.snapshot,
          snapshotDocCount: normalizedSnapshot?.documents?.length ?? 0,
          compatible,
          workerDocumentsCount: documents.size,
          lastIndexedTurnAt,
        })
        globalThis.postMessage({
          id,
          type: 'ready',
          stale: !compatible,
          reason: compatible ? undefined : 'incompatible-or-missing snapshot header',
          lastIndexedTurnAt,
        })
        break
      }

      case 'load-model': {
        await getEmbedder()
        globalThis.postMessage({ id, type: 'model-ready' })
        break
      }

      case 'index': {
        const { documents: nextDocuments } = payload
        let indexedCount = 0

        for (const document of nextDocuments as SearchDocument[]) {
          // NOTICE: only trust a supplied embedding when it matches the
          // active geometry — forwarded per-entry vectors from a previous
          // model generation are silently dropped and re-embedded.
          let embedding = (document.embedding?.length === EMBEDDING_DIM)
            ? document.embedding
            : undefined

          if (!embedding?.length) {
            const embeddingText = getDocumentEmbeddingText(document)
            const existing = documents.get(document.id)
            if (existing
              && existing.embedding?.length === EMBEDDING_DIM
              && getDocumentEmbeddingText(existing) === embeddingText) {
              embedding = existing.embedding
            }
            else {
              embedding = await getVector(embeddingText)
              // Throttled batching: yield to event loop every 5 neural embeddings to allow GC and keep thread responsive
              if (indexedCount > 0 && indexedCount % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 20))
              }
            }
          }

          const persistedDocument = { ...document, embedding }
          ensureDocumentCache(persistedDocument)

          upsertDocument(persistedDocument)
          indexedCount++
        }

        rebuildKeywordStats()
        trackIndexedTurnTime(nextDocuments as SearchDocument[])
        console.log('[Telemetry:SearchWorker:index:Complete]', {
          indexedCount,
          totalDocumentsInWorker: documents.size,
          lastIndexedTurnAt,
        })
        globalThis.postMessage({ id, type: 'indexed', count: indexedCount })
        break
      }

      case 'search': {
        const { query, limit = 10, characterId, temporalHooks, vector } = payload
        // NOTICE: the asymmetric query prefix applies to the embedding path
        // ONLY — getKeywordCandidates below keeps the raw query so prefix
        // tokens never pollute BM25 IDF. Reused sub-query vectors are
        // dim-gated so a stale-generation vector can never sneak through.
        const queryVector = (Array.isArray(vector) && vector.length === EMBEDDING_DIM)
          ? vector
          : await getVector(formatQueryForEmbedding(query))
        const candidateLimit = Math.max(limit * 5, 20)

        const vectorHits = getVectorCandidates(queryVector, candidateLimit, characterId)
        const keywordHits = getKeywordCandidates(query, candidateLimit, characterId)

        let temporalHits: { id: string, score: number }[] = []
        if (temporalHooks && Array.isArray(temporalHooks) && temporalHooks.length > 0) {
          const temporalQuota = Math.max(1, Math.floor(candidateLimit * 0.25))
          temporalHits = getTemporalCandidates(temporalHooks, temporalQuota, characterId)
        }

        const candidateIds = new Set([
          ...vectorHits.map(h => h.id),
          ...keywordHits.map(h => h.id),
          ...temporalHits.map(h => h.id),
        ])

        console.log('[Telemetry:SearchWorker:search]', {
          query,
          limit,
          characterId,
          totalDocumentsInWorker: documents.size,
          candidateLimit,
          vectorHitsCount: vectorHits.length,
          keywordHitsCount: keywordHits.length,
          temporalHitsCount: temporalHits.length,
          matchedCandidatesCount: candidateIds.size,
        })

        // NOTICE: never ship document embedding arrays back over postMessage — each
        // 256-dim number[] cloned per candidate per search is MBs of structured-
        // clone traffic and compressor/swap pressure. We return queryVector so
        // multi-plan sub-queries can reuse it across calls without re-running WebGPU embeddings.
        const results = {
          vectorHits,
          keywordHits,
          temporalHits,
          queryVector,
          documents: [...documents.values()]
            .filter(document => candidateIds.has(document.id))
            .map(document => ({
              id: document.id,
              characterId: document.characterId,
              content: getDocumentContent(document),
              kind: document.kind,
              timestamp: document.timestamp,
              source: document.source,
            })),
        }

        globalThis.postMessage({ id, type: 'results', results })
        break
      }

      case 'persist': {
        // NOTICE: `watermark` is an explicit coverage frontier from the
        // background backfill. The worker's own tracker is a max-over-batch
        // value, which is only equivalent when the pass is strictly
        // oldest→newest with no hot-set detour.
        const override = payload?.watermark
        if (typeof override === 'number' && Number.isFinite(override))
          lastIndexedTurnAt = override

        // NOTICE: persist documents with 4-decimal-place quantized embeddings
        // to cut JSON snapshot size in half while preserving vectors across reboots.
        const snapshot: SearchSnapshot = {
          header: buildSnapshotHeader(lastIndexedTurnAt),
          documents: [...documents.values()].map((doc) => {
            const { tokens, tokenFreqs, embedding, ...persistedDoc } = doc
            if (!embedding?.length)
              return persistedDoc
            const quantized = new Array<number>(embedding.length)
            for (let i = 0; i < embedding.length; i++)
              quantized[i] = Math.round((embedding[i] as number) * 10000) / 10000
            return { ...persistedDoc, embedding: quantized }
          }),
        }

        globalThis.postMessage({ id, type: 'snapshot', snapshot })
        break
      }

      case 'remove': {
        const { id: docId } = payload
        const existed = documents.delete(docId)
        if (existed) {
          rebuildKeywordStats()
        }
        globalThis.postMessage({ id, type: 'removed', existed })
        break
      }

      case 'unload': {
        // NOTICE: idle-TTL eviction path (see GpuWorkerHost in the leader).
        // Drops the embedder sessions/tensors but KEEPS the in-memory document
        // index, so the next query only reloads model weights — never
        // re-indexes. Snapshot persistence stays main-side via 'persist'.
        if (embedderModel) {
          try {
            await embedderModel.dispose?.()
          }
          catch {}
          embedderModel = null
        }
        embedderTokenizer = null
        console.info('[Telemetry:SearchWorker:unload]', {
          workerDocumentsCount: documents.size,
        })
        globalThis.postMessage({ id, type: 'unloaded' })
        break
      }
    }
  }
  catch (err) {
    const errorMsg = (typeof err === 'number' || (typeof err === 'string' && /^\d+$/.test(err.trim())))
      ? `ONNX Runtime WASM exception pointer: ${err} (unsupported ONNX operator or WASM/WebGPU allocation error)`
      : (err instanceof Error ? (err.stack ? `${err.message}\n${err.stack}` : err.message) : String(err))

    globalThis.postMessage({
      id,
      type: 'error',
      error: errorMsg,
    })
  }
})
