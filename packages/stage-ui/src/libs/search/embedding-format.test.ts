import { describe, expect, it } from 'vitest'

import {
  buildSnapshotHeader,
  EMBEDDING_DIM,
  EMBEDDING_DTYPE,
  EMBEDDING_MODEL_ID,
  formatDocumentForEmbedding,
  formatQueryForEmbedding,
  isSnapshotCompatible,
  l2Normalize,
  LEGACY_BGE_DIM,
  LEGACY_BGE_MODEL_ID,
  MAX_EMBEDDING_TITLE_CHARS,
  QUERY_TASK_PREFIX,
  sanitizeEmbeddingTitle,
  SEARCH_INDEX_SCHEMA_VERSION,
  TASK_PREFIX_VERSION,
  TITLE_FALLBACK_SLICE_CHARS,
} from './embedding-format'

describe('embedding-format constants', () => {
  it('exposes expected constants', () => {
    expect(EMBEDDING_MODEL_ID).toBe('onnx-community/embeddinggemma-2-ONNX')
    expect(EMBEDDING_DIM).toBe(256)
    expect(EMBEDDING_DTYPE).toBe('q4')
    expect(SEARCH_INDEX_SCHEMA_VERSION).toBe(2)
    expect(TASK_PREFIX_VERSION).toBe(1)
    expect(LEGACY_BGE_MODEL_ID).toBe('Xenova/bge-small-en-v1.5')
    expect(LEGACY_BGE_DIM).toBe(384)
    expect(QUERY_TASK_PREFIX).toBe('task: search result | query: ')
    expect(MAX_EMBEDDING_TITLE_CHARS).toBe(120)
    expect(TITLE_FALLBACK_SLICE_CHARS).toBe(40)
  })
})

describe('buildSnapshotHeader', () => {
  it('builds header with current constants and timestamp', () => {
    const before = Date.now()
    const header = buildSnapshotHeader()
    const after = Date.now()
    expect(header.schemaVersion).toBe(SEARCH_INDEX_SCHEMA_VERSION)
    expect(header.embeddingModel).toBe(EMBEDDING_MODEL_ID)
    expect(header.embeddingDim).toBe(EMBEDDING_DIM)
    expect(header.dtype).toBe(EMBEDDING_DTYPE)
    expect(header.taskPrefixVersion).toBe(TASK_PREFIX_VERSION)
    expect(header.indexedAt).toBeGreaterThanOrEqual(before)
    expect(header.indexedAt).toBeLessThanOrEqual(after)
  })

  it('persists document and vector counts for the telemetry surface', () => {
    const header = buildSnapshotHeader(1234, { documents: 2122, vectors: 1775 })
    expect(header.lastIndexedTurnAt).toBe(1234)
    expect(header.documentCount).toBe(2122)
    expect(header.vectorCount).toBe(1775)
  })

  it('defaults counts to zero when the caller has none', () => {
    const header = buildSnapshotHeader()
    expect(header.documentCount).toBe(0)
    expect(header.vectorCount).toBe(0)
  })
})

describe('isSnapshotCompatible', () => {
  it('returns false for falsy/non-object', () => {
    expect(isSnapshotCompatible(null)).toBe(false)
    expect(isSnapshotCompatible(undefined)).toBe(false)
    expect(isSnapshotCompatible(42)).toBe(false)
    expect(isSnapshotCompatible('str')).toBe(false)
    expect(isSnapshotCompatible(true)).toBe(false)
  })
  it('returns true for compatible header', () => {
    const header = buildSnapshotHeader()
    expect(isSnapshotCompatible(header)).toBe(true)
  })
  it('returns false on model mismatch', () => {
    expect(isSnapshotCompatible({ embeddingModel: 'other', embeddingDim: EMBEDDING_DIM, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION, taskPrefixVersion: TASK_PREFIX_VERSION })).toBe(false)
  })
  it('returns false on dim mismatch', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: 384, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION, taskPrefixVersion: TASK_PREFIX_VERSION })).toBe(false)
  })
  it('returns false when schemaVersion not number', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: EMBEDDING_DIM, schemaVersion: '2', taskPrefixVersion: TASK_PREFIX_VERSION })).toBe(false)
  })
  it('returns false when schemaVersion too low', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: EMBEDDING_DIM, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION - 1, taskPrefixVersion: TASK_PREFIX_VERSION })).toBe(false)
  })
  it('returns false when taskPrefixVersion not number', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: EMBEDDING_DIM, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION, taskPrefixVersion: '1' })).toBe(false)
  })
  it('returns false when taskPrefixVersion too low', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: EMBEDDING_DIM, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION, taskPrefixVersion: TASK_PREFIX_VERSION - 1 })).toBe(false)
  })
  it('accepts higher schema/prefix versions', () => {
    expect(isSnapshotCompatible({ embeddingModel: EMBEDDING_MODEL_ID, embeddingDim: EMBEDDING_DIM, schemaVersion: SEARCH_INDEX_SCHEMA_VERSION + 1, taskPrefixVersion: TASK_PREFIX_VERSION + 1 })).toBe(true)
  })
})

describe('sanitizeEmbeddingTitle', () => {
  it('returns empty for falsy', () => {
    expect(sanitizeEmbeddingTitle()).toBe('')
    expect(sanitizeEmbeddingTitle(null)).toBe('')
    expect(sanitizeEmbeddingTitle('')).toBe('')
  })
  it('replaces separators and collapses whitespace', () => {
    expect(sanitizeEmbeddingTitle('a\nb\tc|d')).toBe('a b c d')
    expect(sanitizeEmbeddingTitle('  hello   world  ')).toBe('hello world')
  })
  it('slices to max chars', () => {
    const long = 'a'.repeat(MAX_EMBEDDING_TITLE_CHARS + 10)
    expect(sanitizeEmbeddingTitle(long)).toBe('a'.repeat(MAX_EMBEDDING_TITLE_CHARS))
  })
})

describe('formatQueryForEmbedding', () => {
  it('prefixes trimmed query', () => {
    expect(formatQueryForEmbedding('  hello  ')).toBe(`${QUERY_TASK_PREFIX}hello`)
  })
  it('handles nullish via ??', () => {
    // query typed string; pass empty
    expect(formatQueryForEmbedding('')).toBe(QUERY_TASK_PREFIX)
  })
})

describe('formatQueryForEmbedding nullish', () => {
  it('handles nullish query', () => {
    expect(formatQueryForEmbedding(undefined as unknown as string)).toBe(QUERY_TASK_PREFIX)
    expect(formatQueryForEmbedding(null as unknown as string)).toBe(QUERY_TASK_PREFIX)
  })
})

describe('formatDocumentForEmbedding', () => {
  it('uses sanitized title', () => {
    expect(formatDocumentForEmbedding('kind', 'My Title', 'body text')).toBe('title: My Title | text: body text')
  })
  it('falls back to text slice when title empty', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz'.repeat(2)
    const expected = text.slice(0, TITLE_FALLBACK_SLICE_CHARS)
    expect(formatDocumentForEmbedding('kind', '', text)).toBe(`title: ${expected} | text: ${text}`)
  })
  it('falls back to untitled when no title and no text', () => {
    expect(formatDocumentForEmbedding('kind', null, '   ')).toBe('title: untitled | text: ')
  })
  it('sanitizes title separators', () => {
    expect(formatDocumentForEmbedding('kind', 'a\nb', 't')).toBe('title: a b | text: t')
  })
  it('trims text', () => {
    expect(formatDocumentForEmbedding('kind', 't', '  body  ')).toBe('title: t | text: body')
  })
  it('ignores kind (reserved)', () => {
    expect(formatDocumentForEmbedding('anykind', 't', 'b')).toBe('title: t | text: b')
  })
  it('handles nullish text', () => {
    expect(formatDocumentForEmbedding('kind', 't', null as unknown as string)).toBe('title: t | text: ')
    expect(formatDocumentForEmbedding('kind', 't', undefined as unknown as string)).toBe('title: t | text: ')
  })
})

describe('l2Normalize', () => {
  it('normalizes vector', () => {
    const out = l2Normalize([3, 4])
    expect(out[0]).toBeCloseTo(0.6)
    expect(out[1]).toBeCloseTo(0.8)
  })
  it('handles zero vector via || 1', () => {
    const out = l2Normalize([0, 0])
    expect(out).toEqual([0, 0])
  })
  it('handles empty array', () => {
    expect(l2Normalize([])).toEqual([])
  })
  it('accepts ArrayLike', () => {
    const arr = new Float32Array([1, 0])
    expect(l2Normalize(arr)).toEqual([1, 0])
  })
})
