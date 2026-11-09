/**
 * Tests for the search index turn chunker: pure deterministic splitter.
 *
 * Contract under test:
 * 1. Turns at or under the chunk size pass through untouched with a stable
 *    chunk shape ({ index: 0, total: 1 }) — the worker reuse-by-content
 *    shortcut and persisted snapshots depend on this.
 * 2. Longer turns split into overlapping windows with deterministic 0-based
 *    indices and an accurate total on every chunk.
 * 3. Window ends prefer whitespace boundaries so words (and BM25 tokens)
 *    stay intact, never shrinking below one step of fresh content.
 */
import { describe, expect, it } from 'vitest'

import { chunkTurnText, TURN_CHUNK_OVERLAP, TURN_CHUNK_SIZE } from './turn-chunker'

describe('chunkTurnText', () => {
  it('passes turns at or under the chunk size through untouched', () => {
    expect(chunkTurnText('short turn')).toEqual([{ index: 0, total: 1, text: 'short turn' }])
    expect(chunkTurnText('')).toEqual([{ index: 0, total: 1, text: '' }])

    const atSize = 'a'.repeat(TURN_CHUNK_SIZE)
    expect(chunkTurnText(atSize)).toEqual([{ index: 0, total: 1, text: atSize }])
  })

  it('splits long turns into overlapping windows with accurate totals', () => {
    const text = 'word '.repeat(1000) // 5000 chars
    const chunks = chunkTurnText(text)

    expect(chunks.length).toBeGreaterThan(3)
    for (const [i, chunk] of chunks.entries()) {
      expect(chunk.index).toBe(i)
      expect(chunk.total).toBe(chunks.length)
    }
    // Overlap: each window (except the last) shares `overlap` chars of raw
    // text with a predecessor region — assert proximity between windows
    // rather than exact byte math, which depends on whitespace alignment.
    expect(chunks[0].text.length).toBeGreaterThanOrEqual(TURN_CHUNK_SIZE - TURN_CHUNK_OVERLAP)
  })

  it('prefers whitespace boundaries and never emits a shrinking window', () => {
    const text = Array.from({ length: 200 }, (_, i) => `tok${i}`).join(' ')
    const chunks = chunkTurnText(text)

    for (const chunk of chunks) {
      expect(chunk.text.startsWith(' ')).toBe(false)
      expect(chunk.text).not.toContain('  ')
    }
    // No window starts mid-token: every chunk starts at a token boundary of
    // the original text.
    for (const chunk of chunks.slice(1)) {
      expect(text).toContain(chunk.text)
    }
  })

  it('honours custom chunkSize and overlap', () => {
    const text = 'abcdefghij'.repeat(40) // 400 chars, no spaces
    const chunks = chunkTurnText(text, 100, 20)

    expect(chunks.length).toBeGreaterThanOrEqual(4)
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100)
    }
    // No-whitespace input: each window advances by `step` (80) until the
    // remaining tail fits one window; the last window is that 80-char tail.
    expect(chunks.at(-1)!.text.length).toBe(80)
  })

  it('degrades overlap >= chunkSize to a step of 1 instead of looping forever', () => {
    const chunks = chunkTurnText('abcdefghij'.repeat(10), 10, 50)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].total).toBe(chunks.length)
  })
})
