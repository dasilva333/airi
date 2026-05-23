import { env, pipeline } from '@huggingface/transformers'

// Suppress noisy ONNX Runtime warnings
env.backends.onnx.logLevel = 'error'

interface SearchDocument {
  id: string
  what?: string
  fact?: string
  kind: string
  source: string
  timestamp: string
  embedding?: number[]
  tokens?: string[]
  tokenFreqs?: Record<string, number>
}

interface SearchSnapshot {
  documents: SearchDocument[]
}

let embedder: any = null
let documents = new Map<string, SearchDocument>()
let averageDocumentLength = 0
let documentFrequency = new Map<string, number>()

const MODEL_ID = 'Xenova/bge-small-en-v1.5'
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

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', MODEL_ID, {
      device: 'webgpu',
    })
  }
  return embedder
}

async function getVector(text: string) {
  const extractor = await getEmbedder()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data as number[])
}

function getDocumentContent(document: SearchDocument) {
  return document.fact || document.what || ''
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

function getVectorCandidates(queryVector: number[], limit: number) {
  const results = [...documents.values()]
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

function getKeywordCandidates(query: string, limit: number) {
  const queryTerms = tokenize(query)
  if (!queryTerms.length)
    return []

  const totalDocuments = documents.size || 1
  const k1 = 1.5
  const b = 0.75

  const scored = [...documents.values()]
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

function upsertDocument(document: SearchDocument) {
  documents.set(document.id, document)
}

function hydrateDocuments(nextDocuments: SearchDocument[] = []) {
  documents = new Map()
  for (const document of nextDocuments)
    upsertDocument(document)

  rebuildKeywordStats()
}

function normalizeSnapshot(snapshot: any): SearchSnapshot | null {
  if (!snapshot)
    return null

  if (Array.isArray(snapshot.documents))
    return snapshot as SearchSnapshot

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
        hydrateDocuments(normalizedSnapshot?.documents)
        globalThis.postMessage({ id, type: 'ready' })
        break
      }

      case 'index': {
        const { documents: nextDocuments } = payload
        let indexedCount = 0

        for (const document of nextDocuments as SearchDocument[]) {
          const embedding = document.embedding?.length
            ? document.embedding
            : await getVector(getDocumentContent(document))

          const persistedDocument = { ...document, embedding }
          ensureDocumentCache(persistedDocument)

          upsertDocument(persistedDocument)
          indexedCount++
        }

        rebuildKeywordStats()
        globalThis.postMessage({ id, type: 'indexed', count: indexedCount })
        break
      }

      case 'search': {
        const { query, limit = 10 } = payload
        const queryVector = await getVector(query)
        const candidateLimit = Math.max(limit * 5, 20)

        const vectorHits = getVectorCandidates(queryVector, candidateLimit)
        const keywordHits = getKeywordCandidates(query, candidateLimit)
        const candidateIds = new Set([
          ...vectorHits.map(h => h.id),
          ...keywordHits.map(h => h.id),
        ])

        const results = {
          vectorHits,
          keywordHits,
          documents: [...documents.values()]
            .filter(document => candidateIds.has(document.id))
            .map(document => ({
              id: document.id,
              content: getDocumentContent(document),
              kind: document.kind,
              timestamp: document.timestamp,
              source: document.source,
              embedding: document.embedding,
            })),
        }

        globalThis.postMessage({ id, type: 'results', results })
        break
      }

      case 'persist': {
        const snapshot: SearchSnapshot = {
          documents: [...documents.values()].map((doc) => {
            const { tokens, tokenFreqs, ...persistedDoc } = doc
            return persistedDoc
          }),
        }

        globalThis.postMessage({ id, type: 'snapshot', snapshot })
        break
      }
    }
  }
  catch (err) {
    globalThis.postMessage({
      id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
