/**
 * Embedding input formatting + snapshot provenance for the local search worker.
 *
 * EmbeddingGemma 2 requires asymmetric task prefixes (DeepMind pre-training):
 * queries as `task: search result | query: ...`, documents as
 * `title: ... | text: ...`. Legacy BGE-small vectors (384d, no prefixes) are
 * schema version 0 and must never mix with prefixed 256d vectors —
 * both `cosineSimilarity` copies silently return 0 on dimension mismatch.
 *
 * Ownership: pure helpers + provenance constants live here so the worker
 * bundle (`libs/workers/search/search.worker.ts`), the loader
 * (`libs/workers/search/index.ts`), and `layered-memory.ts` share one
 * definition. Retrieval semantics (ranking, layers, fusion) belong to
 * `hybrid-scorer.ts` / `layered-memory.ts`, not here.
 */

export const EMBEDDING_MODEL_ID = 'onnx-community/embeddinggemma-2-ONNX'
export const EMBEDDING_DIM = 256
export const EMBEDDING_DTYPE = 'q4' as const
export const SEARCH_INDEX_SCHEMA_VERSION = 2
export const TASK_PREFIX_VERSION = 1

export const LEGACY_BGE_MODEL_ID = 'Xenova/bge-small-en-v1.5'
export const LEGACY_BGE_DIM = 384

export const QUERY_TASK_PREFIX = 'task: search result | query: '

export const MAX_EMBEDDING_TITLE_CHARS = 120
export const TITLE_FALLBACK_SLICE_CHARS = 40

export interface SearchIndexSnapshotHeader {
  schemaVersion: number
  embeddingModel: string
  embeddingDim: number
  dtype: 'q4' | 'q8' | 'fp32'
  taskPrefixVersion: number
  indexedAt: number
  /**
   * High-watermark of indexed turn time (max `createdAt`/`timestamp` seen at
   * persist). Optional so pre-watermark snapshots stay compatible — absent
   * means "unknown", and callers must treat it as 0 (re-index everything).
   */
  lastIndexedTurnAt?: number
  /**
   * Persisted document/vector counts for the index telemetry surface. Optional
   * so snapshots written before the counts existed stay readable; absent means
   * "unknown", not zero documents.
   */
  documentCount?: number
  vectorCount?: number
}

export function buildSnapshotHeader(
  lastIndexedTurnAt?: number,
  counts?: { documents?: number, vectors?: number },
): SearchIndexSnapshotHeader {
  return {
    schemaVersion: SEARCH_INDEX_SCHEMA_VERSION,
    embeddingModel: EMBEDDING_MODEL_ID,
    embeddingDim: EMBEDDING_DIM,
    dtype: EMBEDDING_DTYPE,
    taskPrefixVersion: TASK_PREFIX_VERSION,
    indexedAt: Date.now(),
    lastIndexedTurnAt: lastIndexedTurnAt ?? 0,
    documentCount: counts?.documents ?? 0,
    vectorCount: counts?.vectors ?? 0,
  }
}

export function isSnapshotCompatible(header: unknown): header is SearchIndexSnapshotHeader {
  if (!header || typeof header !== 'object')
    return false
  const candidate = header as Partial<SearchIndexSnapshotHeader>
  return candidate.embeddingModel === EMBEDDING_MODEL_ID
    && candidate.embeddingDim === EMBEDDING_DIM
    && typeof candidate.schemaVersion === 'number'
    && candidate.schemaVersion >= SEARCH_INDEX_SCHEMA_VERSION
    && typeof candidate.taskPrefixVersion === 'number'
    && candidate.taskPrefixVersion >= TASK_PREFIX_VERSION
}

export function sanitizeEmbeddingTitle(title?: string | null): string {
  if (!title)
    return ''
  return title
    .replace(/[\n\r\t|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_EMBEDDING_TITLE_CHARS)
}

export function formatQueryForEmbedding(query: string): string {
  return `${QUERY_TASK_PREFIX}${(query ?? '').trim()}`
}

export function formatDocumentForEmbedding(kind: string, title: string | undefined | null, text: string): string {
  // NOTICE: kind is reserved for future per-kind title policy; the format is
  // uniform today. The explicit void keeps the (kind, title, text) contract.
  void kind
  const cleanText = (text ?? '').trim()
  const cleanTitle = sanitizeEmbeddingTitle(title)
    || cleanText.slice(0, TITLE_FALLBACK_SLICE_CHARS)
    || 'untitled'
  return `title: ${cleanTitle} | text: ${cleanText}`
}

export function l2Normalize(vector: ArrayLike<number>): number[] {
  const values = Array.from(vector)
  const norm = Math.hypot(...values) || 1
  return values.map(v => v / norm)
}
