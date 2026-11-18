import { describe, expect, it } from 'vitest'

import { normalizePocketBundle } from '../../libs/inference/adapters/pocket-tts'
import {
  getPocketTtsAdapterInstance,
  isValidPocketVoiceEmbedding,
  POCKET_EMBEDDING_CONDITIONING_VERSION,
} from './pocket-audio-utils'

describe('pocket TTS audio utilities unit tests', () => {
  it('instantiates Pocket TTS adapter singleton lazily', async () => {
    const adapter1 = await getPocketTtsAdapterInstance()
    const adapter2 = await getPocketTtsAdapterInstance()

    expect(adapter1).toBeDefined()
    expect(adapter2).toBeDefined()
    expect(adapter1).toBe(adapter2)
  })

  describe('normalizePocketBundle', () => {
    it('maps bare language codes and legacy ids to canonical bundles', () => {
      expect(normalizePocketBundle()).toBe('english_2026-04')
      expect(normalizePocketBundle('english')).toBe('english_2026-04')
      expect(normalizePocketBundle('english_2026_04')).toBe('english_2026-04')
      expect(normalizePocketBundle('french')).toBe('french_24l')
      expect(normalizePocketBundle('french_24l')).toBe('french_24l')
      expect(normalizePocketBundle('spanish')).toBe('spanish_24l')
      expect(normalizePocketBundle('german')).toBe('german_24l')
      expect(normalizePocketBundle('portuguese')).toBe('portuguese_24l')
      expect(normalizePocketBundle('italian')).toBe('italian_24l')
    })
  })

  describe('isValidPocketVoiceEmbedding', () => {
    it('accepts valid [1, frames, 1024] Float32Array embeddings', () => {
      const valid = {
        data: new Float32Array(12 * 1024),
        dims: [1, 12, 1024],
      }
      expect(POCKET_EMBEDDING_CONDITIONING_VERSION).toBeGreaterThanOrEqual(2)
      expect(isValidPocketVoiceEmbedding(valid)).toBe(true)
    })

    it('rejects malformed, empty, or wrong-dimension embeddings', () => {
      expect(isValidPocketVoiceEmbedding(undefined)).toBe(false)
      expect(isValidPocketVoiceEmbedding(null)).toBe(false)
      expect(isValidPocketVoiceEmbedding({ data: new Float32Array(0), dims: [1, 0, 1024] })).toBe(false)
      expect(isValidPocketVoiceEmbedding({ data: new Float32Array(1024), dims: [1, 1, 512] })).toBe(false)
      expect(isValidPocketVoiceEmbedding({ data: new Float32Array(1024), dims: [2, 1, 1024] })).toBe(false)
      expect(isValidPocketVoiceEmbedding({ data: new Float32Array(500), dims: [1, 1, 1024] })).toBe(false)
      expect(isValidPocketVoiceEmbedding({ data: [1, 2, 3], dims: [1, 1, 3] })).toBe(false)
    })
  })
})
