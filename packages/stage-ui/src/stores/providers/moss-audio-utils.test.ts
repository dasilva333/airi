import { describe, expect, it } from 'vitest'

import { interleavePlanarChannels, normalizeMossSamplingMode } from '../../libs/inference/adapters/moss'
import { conditionMossPlanarWaveform, getMossAdapterInstance, isValidMossPromptAudioCodes, MOSS_REFERENCE_PREPROCESS_DEFAULTS, sanitizeMossInputText } from './moss-audio-utils'

describe('mOSS audio utilities unit tests', () => {
  it('instantiates MOSS adapter singleton lazily', async () => {
    const adapter1 = await getMossAdapterInstance()
    const adapter2 = await getMossAdapterInstance()

    expect(adapter1).toBeDefined()
    expect(adapter2).toBeDefined()
    expect(adapter1).toBe(adapter2) // Must be identical singleton instance
  })

  describe('sanitizeMossInputText', () => {
    it('handles empty or blank string gracefully', () => {
      expect(sanitizeMossInputText('')).toBe('')
      expect(sanitizeMossInputText('   ')).toBe('')
    })

    it('strips square brackets to protect MOSS tokenizer', () => {
      expect(sanitizeMossInputText('[whisper] Hello there [giggle]')).toBe('whisper Hello there giggle')
      expect(sanitizeMossInputText('[screaming] Help me!')).toBe('screaming Help me!')
      expect(sanitizeMossInputText('Hello [world]')).toBe('Hello world')
    })

    it('strips special token delimiters like <|...|>', () => {
      expect(sanitizeMossInputText('Hello <|ACT:happy|> world')).toBe('Hello world')
      expect(sanitizeMossInputText('<|ACTOR:narrator|> Once upon a time')).toBe('Once upon a time')
    })

    it('normalizes multi-spaces resulting from bracket removal', () => {
      expect(sanitizeMossInputText('This   is   [test]   speech')).toBe('This is test speech')
    })
  })

  describe('conditionMossPlanarWaveform', () => {
    it('tapers both leading and trailing edges to zero at the endpoints', () => {
      const sampleRate = 1000
      const length = 1000 // 1s
      const planar = new Float32Array(length).fill(0.5)
      const conditioned = conditionMossPlanarWaveform(planar, length, 1, sampleRate, {
        ...MOSS_REFERENCE_PREPROCESS_DEFAULTS,
        fadeMs: 50,
      })

      expect(conditioned[0]).toBe(0)
      expect(conditioned[conditioned.length - 1]).toBe(0)
      // Midpoint remains normalized near -3 dB (~0.708)
      expect(conditioned[Math.floor(conditioned.length / 2)]).toBeGreaterThan(0.65)
    })

    it('rejects all-quiet or zero reference buffers instead of boosting noise', () => {
      const sampleRate = 1000
      const length = 2000
      const silent = new Float32Array(length)
      expect(() => conditionMossPlanarWaveform(silent, length, 1, sampleRate)).toThrow(/no audible speech/i)

      const quiet = new Float32Array(length).fill(0.001) // -60 dB < -45 dB threshold
      expect(() => conditionMossPlanarWaveform(quiet, length, 1, sampleRate)).toThrow(/no audible speech/i)
    })
  })

  describe('stereo interleaving and sampling mode normalization', () => {
    it('interleaves channel-planar stereo arrays as [L0, R0, L1, R1, ...]', () => {
      const left = new Float32Array([1, 2, 3])
      const right = new Float32Array([10, 20, 30])
      expect(Array.from(interleavePlanarChannels([left, right]))).toEqual([1, 10, 2, 20, 3, 30])
    })

    it('normalizes legacy dynamic samplingMode to fixed and preserves full/greedy', () => {
      expect(normalizeMossSamplingMode('dynamic')).toBe('fixed')
      expect(normalizeMossSamplingMode('fixed')).toBe('fixed')
      expect(normalizeMossSamplingMode('full')).toBe('full')
      expect(normalizeMossSamplingMode('greedy')).toBe('greedy')
      expect(normalizeMossSamplingMode(undefined)).toBe('fixed')
    })

    it('validates promptAudioCodes matrix shape', () => {
      expect(isValidMossPromptAudioCodes(undefined)).toBe(false)
      expect(isValidMossPromptAudioCodes([])).toBe(false)
      expect(isValidMossPromptAudioCodes([[1, 2]])).toBe(false)
      expect(isValidMossPromptAudioCodes([Array.from({ length: 16 }, (_, i) => i)])).toBe(true)
    })
  })
})
