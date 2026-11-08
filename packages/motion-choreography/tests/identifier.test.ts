import { describe, expect, it } from 'vitest'

import {
  analyzeAudioBuffer,
  applyHannWindow,
  computeMagnitudeSpectrum,
  computeSpectralCentroid,
  decodeWav,
  encodeWav,
  synthesizeDanceBrief,
} from '../src/index.js'
import { getCorpusManifest } from './corpus-loader.js'
import {
  generateSynthetic44Beat,
  generateSyntheticAmbient,
  generateSyntheticWaltz,
} from './synthetic-audio.js'

describe('motion Choreography - The Identifier', () => {
  describe('wAV Encoder & Decoder', () => {
    it('roundtrips synthetic audio through 16-bit PCM WAV encoding and decoding', () => {
      const sampleRate = 44100
      const durationSec = 0.5
      const numSamples = Math.floor(sampleRate * durationSec)
      const originalMono = new Float32Array(numSamples)

      // 440 Hz test sine
      for (let i = 0; i < numSamples; i++) {
        originalMono[i] = 0.6 * Math.sin((2 * Math.PI * 440 * i) / sampleRate)
      }

      const encodedBytes = encodeWav([originalMono], sampleRate)
      expect(encodedBytes.byteLength).toBeGreaterThan(44)

      const decoded = decodeWav(encodedBytes)
      expect(decoded.sampleRate).toBe(sampleRate)
      expect(decoded.channelData.length).toBe(1)
      expect(decoded.channelData[0].length).toBe(numSamples)
      expect(decoded.duration).toBeCloseTo(durationSec, 2)

      // Quantization error for 16-bit PCM should be < 0.0001
      for (let i = 0; i < 50; i++) {
        expect(decoded.channelData[0][i]).toBeCloseTo(originalMono[i], 3)
      }
    })

    it('rejects invalid or corrupted WAV headers', () => {
      const bogus = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(() => decodeWav(bogus)).toThrow('Invalid WAV header')
    })
  })

  describe('dSP Fourier Transform & Spectral Centroid', () => {
    it('computes FFT magnitude spectrum with peak at expected frequency', () => {
      const fftSize = 1024
      const sampleRate = 44100
      const targetFreq = 440 // A4
      const signal = new Float32Array(fftSize)

      for (let i = 0; i < fftSize; i++) {
        signal[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate)
      }

      applyHannWindow(signal)
      const magnitudes = computeMagnitudeSpectrum(signal)
      expect(magnitudes.length).toBe(fftSize / 2 + 1)

      // Target bin index
      const expectedBin = Math.round((targetFreq * fftSize) / sampleRate) // ~10
      let maxBin = 0
      let maxVal = 0
      for (let k = 0; k < magnitudes.length; k++) {
        if (magnitudes[k] > maxVal) {
          maxVal = magnitudes[k]
          maxBin = k
        }
      }

      expect(Math.abs(maxBin - expectedBin)).toBeLessThanOrEqual(1)

      const centroid = computeSpectralCentroid(magnitudes, sampleRate, fftSize)
      expect(centroid).toBeGreaterThan(350)
      expect(centroid).toBeLessThan(550)
    })
  })

  describe('aSP Acoustic Analyzer on Synthetic Signals', () => {
    it('detects ~120 BPM and four_on_the_floor structure on synthetic 4/4 beat', () => {
      const track = generateSynthetic44Beat(120, 5, 44100)
      const features = analyzeAudioBuffer(track.channelData, track.sampleRate)

      expect(features.bpm).toBeGreaterThanOrEqual(118)
      expect(features.bpm).toBeLessThanOrEqual(122)
      expect(features.rhythmStructure).toBe('four_on_the_floor')
      expect(features.energyTier).toMatch(/moderate|high/)
      expect(features.beatTimestamps.length).toBeGreaterThan(5)
      expect(features.confidence).toBeGreaterThan(0.2)
    })

    it('detects ~84 BPM and waltz_triple structure on synthetic 3/4 waltz', () => {
      const track = generateSyntheticWaltz(84, 6, 44100)
      const features = analyzeAudioBuffer(track.channelData, track.sampleRate)

      expect(features.bpm).toBeGreaterThanOrEqual(82)
      expect(features.bpm).toBeLessThanOrEqual(86)
      expect(features.rhythmStructure).toBe('waltz_triple')
      expect(features.beatTimestamps.length).toBeGreaterThan(5)
    })

    it('classifies ambient low-energy signal as ambient_free with low tier', () => {
      const track = generateSyntheticAmbient(4, 44100)
      const features = analyzeAudioBuffer(track.channelData, track.sampleRate)

      expect(features.rhythmStructure).toBe('ambient_free')
      expect(features.energyTier).toBe('low')
      expect(features.energyRms).toBeLessThan(0.05)
    })
  })

  describe('dance Brief Synthesizer', () => {
    const dummyFeatures = {
      bpm: 124,
      confidence: 0.88,
      energyRms: 0.22,
      energyTier: 'high' as const,
      spectralCentroid: 3400,
      timbreBrightness: 'bright' as const,
      rhythmStructure: 'four_on_the_floor' as const,
      durationSeconds: 15.0,
      beatTimestamps: [0.5, 1.0, 1.5, 2.0],
    }

    it('synthesizes idol persona brief for FlowMDM text conditioning', () => {
      const brief = synthesizeDanceBrief(dummyFeatures, undefined, {
        archetype: 'idol',
        preferredMovements: ['sparkle finger twists', 'twirling jump'],
        customPromptModifier: 'delightful beaming smile',
      })

      expect(brief.bpm).toBe(124)
      expect(brief.detectedGenre).toBe('Electro House / EDM')
      expect(brief.suggestedKeyPoseCount).toBe(4)
      expect(brief.choreographerPrompt).toContain('cheerful idol stage dance')
      expect(brief.choreographerPrompt).toContain('spirited bouncing')
      expect(brief.choreographerPrompt).toContain('pumping march steps')
      expect(brief.choreographerPrompt).toContain('featuring sparkle finger twists, twirling jump')
      expect(brief.choreographerPrompt).toContain('delightful beaming smile')
    })

    it('synthesizes gothic maid persona brief with poise and grace', () => {
      const waltzFeatures = {
        ...dummyFeatures,
        bpm: 84,
        rhythmStructure: 'waltz_triple' as const,
        timbreBrightness: 'dark' as const,
        energyTier: 'moderate' as const,
      }

      const brief = synthesizeDanceBrief(waltzFeatures, undefined, {
        archetype: 'gothic_maid',
      })

      expect(brief.bpm).toBe(84)
      expect(brief.detectedGenre).toBe('Classical Waltz / Triple Meter Ballad')
      expect(brief.suggestedKeyPoseCount).toBe(6)
      expect(brief.choreographerPrompt).toContain('composed aristocratic gothic dance')
      expect(brief.choreographerPrompt).toContain('sweeping gliding turns in 3/4 triple meter')
    })

    it('synthesizes cool android persona brief with robotic isolation', () => {
      const brief = synthesizeDanceBrief(dummyFeatures, undefined, {
        archetype: 'cool_android',
      })

      expect(brief.choreographerPrompt).toContain('sharp mechanical popping and locking')
      expect(brief.choreographerPrompt).toContain('precise body isolation')
    })

    it('synthesizes chill gamer persona brief with relaxed bopping', () => {
      const brief = synthesizeDanceBrief(dummyFeatures, undefined, {
        archetype: 'chill_gamer',
      })

      expect(brief.choreographerPrompt).toContain('relaxed rhythmic swaying')
      expect(brief.choreographerPrompt).toContain('effortless head bopping')
    })

    it('synthesizes chaotic gremlin persona brief with erratic hopping', () => {
      const brief = synthesizeDanceBrief(dummyFeatures, undefined, {
        archetype: 'chaotic_gremlin',
      })

      expect(brief.choreographerPrompt).toContain('hyperactive erratic hopping')
      expect(brief.choreographerPrompt).toContain('comical rapid arm gestures')
    })
  })

  describe('corpus Manifest Integrity', () => {
    it('contains verified public-domain and CC-0 test audio tracks', () => {
      const manifest = getCorpusManifest()
      expect(manifest.length).toBeGreaterThanOrEqual(5)

      for (const item of manifest) {
        expect(item.id).toBeTruthy()
        expect(item.url).toMatch(/^https:\/\//)
        expect(item.sha1).toMatch(/^[a-f0-9]{40}$/)
        expect(item.expectedBpm).toBeGreaterThan(0)
        expect(item.expectedRhythm).toBeTruthy()
      }
    })
  })
})
