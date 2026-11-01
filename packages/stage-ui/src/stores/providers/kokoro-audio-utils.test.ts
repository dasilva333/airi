import { describe, expect, it } from 'vitest'

import {
  estimateAudioPitchHz,
  KOKORO_STOCK_VOICES_TABLE,
} from './kokoro-audio-utils'

describe('kokoro audio utilities unit tests', () => {
  it('contains the complete canonical set of 28 Kokoro stock voice acoustic profiles', () => {
    expect(KOKORO_STOCK_VOICES_TABLE.length).toBe(28)
    for (const voice of KOKORO_STOCK_VOICES_TABLE) {
      expect(voice.id).toMatch(/^(af_|am_|bf_|bm_)/)
      expect(typeof voice.f0MeanSt).toBe('number')
      expect(typeof voice.grade).toBe('number')
      expect(voice.grade).toBeGreaterThan(0)
    }
  })

  describe('estimateAudioPitchHz', () => {
    it('estimates 220Hz pitch accurately from synthetic sine wave', () => {
      const sampleRate = 16000
      const durationS = 1.0
      const numSamples = Math.floor(sampleRate * durationS)
      const samples = new Float32Array(numSamples)
      const targetFreq = 220.0 // A3

      for (let i = 0; i < numSamples; i++) {
        samples[i] = 0.8 * Math.sin((2 * Math.PI * targetFreq * i) / sampleRate)
      }

      const estimated = estimateAudioPitchHz(samples, sampleRate)
      // Allow slight discrete bin discretization within +/- 5 Hz
      expect(Math.abs(estimated - targetFreq)).toBeLessThanOrEqual(5)
    })

    it('estimates 130Hz pitch accurately from synthetic sine wave', () => {
      const sampleRate = 16000
      const durationS = 1.0
      const numSamples = Math.floor(sampleRate * durationS)
      const samples = new Float32Array(numSamples)
      const targetFreq = 130.0 // Near C3

      for (let i = 0; i < numSamples; i++) {
        samples[i] = 0.8 * Math.sin((2 * Math.PI * targetFreq * i) / sampleRate)
      }

      const estimated = estimateAudioPitchHz(samples, sampleRate)
      expect(Math.abs(estimated - targetFreq)).toBeLessThanOrEqual(5)
    })

    it('gracefully returns default pitch (165Hz) when audio is silence', () => {
      const samples = new Float32Array(16000)
      const estimated = estimateAudioPitchHz(samples, 16000)
      expect(estimated).toBe(165.0)
    })
  })
})
