import { describe, expect, it } from 'vitest'

import {
  alignSpokenSentences,
  computeRmsEnvelope,
  detectSilencePauses,
  estimateSentencePhoneticWeight,
} from './pause-aligner'

function generateTone(durationSec: number, sampleRate = 24000, freq = 440, amp = 0.5): Float32Array {
  const numSamples = Math.round(durationSec * sampleRate)
  const buffer = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate)
  }
  return buffer
}

function generateSilence(durationSec: number, sampleRate = 24000, noiseFloor = 1e-5): Float32Array {
  const numSamples = Math.round(durationSec * sampleRate)
  const buffer = new Float32Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = (Math.random() - 0.5) * noiseFloor
  }
  return buffer
}

function concatPcm(...buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const result = new Float32Array(totalLength)
  let offset = 0
  for (const b of buffers) {
    result.set(b, offset)
    offset += b.length
  }
  return result
}

describe('pause-aligner', () => {
  const sampleRate = 24000

  describe('computeRmsEnvelope', () => {
    it('computes realistic dBFS values for speech tone vs silence', () => {
      const tone = generateTone(0.5, sampleRate, 440, 0.5)
      const silence = generateSilence(0.5, sampleRate)

      const toneEnv = computeRmsEnvelope(tone, sampleRate)
      const silenceEnv = computeRmsEnvelope(silence, sampleRate)

      expect(toneEnv.peakDb).toBeGreaterThan(-15)
      expect(silenceEnv.peakDb).toBeLessThan(-60)
    })

    it('handles empty or sub-window audio safely', () => {
      const empty = new Float32Array(0)
      const resEmpty = computeRmsEnvelope(empty, sampleRate)
      expect(resEmpty.durationSec).toBe(0)
      expect(resEmpty.envelopeDb.length).toBe(0)

      const tiny = new Float32Array(50) // less than 10ms (240 samples)
      tiny[10] = 0.5
      const resTiny = computeRmsEnvelope(tiny, sampleRate)
      expect(resTiny.envelopeDb.length).toBe(1)
    })
  })

  describe('detectSilencePauses', () => {
    it('accurately identifies silence intervals between speech bursts', () => {
      // 1.0s speech + 0.3s silence + 1.0s speech
      const audio = concatPcm(
        generateTone(1.0, sampleRate),
        generateSilence(0.3, sampleRate),
        generateTone(1.0, sampleRate),
      )

      const { envelopeDb, peakDb } = computeRmsEnvelope(audio, sampleRate)
      const { candidatePauses, speechStartSec, speechEndSec } = detectSilencePauses(
        envelopeDb,
        5,
        peakDb - 30,
        75,
      )

      expect(speechStartSec).toBeCloseTo(0, 1)
      expect(speechEndSec).toBeCloseTo(2.3, 1)
      expect(candidatePauses.length).toBe(1)
      expect(candidatePauses[0].centerSec).toBeGreaterThan(0.95)
      expect(candidatePauses[0].centerSec).toBeLessThan(1.35)
      expect(candidatePauses[0].durationSec).toBeGreaterThan(0.2)
    })

    it('ignores micro-silence gaps shorter than minSilenceMs', () => {
      // 1.0s speech + 0.03s (30ms) tiny dip + 1.0s speech
      const audio = concatPcm(
        generateTone(1.0, sampleRate),
        generateSilence(0.03, sampleRate),
        generateTone(1.0, sampleRate),
      )

      const { envelopeDb, peakDb } = computeRmsEnvelope(audio, sampleRate)
      const { candidatePauses } = detectSilencePauses(
        envelopeDb,
        5,
        peakDb - 30,
        75,
      )

      expect(candidatePauses.length).toBe(0)
    })
  })

  describe('estimateSentencePhoneticWeight', () => {
    it('weights Latin words and CJK characters reasonably', () => {
      const english = 'This is a short sentence.'
      const weightEn = estimateSentencePhoneticWeight(english)
      expect(weightEn).toBeGreaterThan(4) // 5 words * 1.3 = 6.5

      const cjk = 'これはテストです。'
      const weightCjk = estimateSentencePhoneticWeight(cjk)
      expect(weightCjk).toBeGreaterThan(10) // 8 CJK chars * 1.8 = 14.4
    })
  })

  describe('alignSpokenSentences', () => {
    it('returns single boundary covering full duration for 1 sentence', () => {
      const audio = generateTone(2.0, sampleRate)
      const boundaries = alignSpokenSentences(audio, sampleRate, ['Hello world!'])

      expect(boundaries).toHaveLength(1)
      expect(boundaries[0].text).toBe('Hello world!')
      expect(boundaries[0].startSec).toBe(0)
      expect(boundaries[0].endSec).toBeCloseTo(2.0, 2)
    })

    it('accurately aligns 2 sentences separated by a pause', () => {
      // Sentence 1 (1.2s) + Pause (0.3s) + Sentence 2 (1.5s) = 3.0s total
      const audio = concatPcm(
        generateTone(1.2, sampleRate),
        generateSilence(0.3, sampleRate),
        generateTone(1.5, sampleRate),
      )

      const sentences = [
        'Butter dropped the broom with starry eyes.',
        'Did somebody say a competition is starting today?',
      ]

      const boundaries = alignSpokenSentences(audio, sampleRate, sentences)

      expect(boundaries).toHaveLength(2)
      expect(boundaries[0].text).toBe(sentences[0])
      expect(boundaries[0].startSec).toBe(0)
      // Split point should land in the silence interval [1.2, 1.5]
      expect(boundaries[0].endSec).toBeGreaterThan(1.15)
      expect(boundaries[0].endSec).toBeLessThan(1.55)

      expect(boundaries[1].text).toBe(sentences[1])
      expect(boundaries[1].startSec).toBe(boundaries[0].endSec)
      expect(boundaries[1].endSec).toBeCloseTo(3.0, 1)
    })

    it('accurately aligns 3 sentences with distinct pause intervals', () => {
      // S1 (1.0s) + pause (0.25s) + S2 (1.0s) + pause (0.25s) + S3 (1.0s) = 3.5s total
      const audio = concatPcm(
        generateTone(1.0, sampleRate),
        generateSilence(0.25, sampleRate),
        generateTone(1.0, sampleRate),
        generateSilence(0.25, sampleRate),
        generateTone(1.0, sampleRate),
      )

      const sentences = [
        'First sentence right here.',
        'Second sentence follows next.',
        'Third sentence concludes it.',
      ]

      const boundaries = alignSpokenSentences(audio, sampleRate, sentences)

      expect(boundaries).toHaveLength(3)
      expect(boundaries[0].startSec).toBe(0)
      expect(boundaries[0].endSec).toBeGreaterThan(0.95)
      expect(boundaries[0].endSec).toBeLessThan(1.3)

      expect(boundaries[1].startSec).toBe(boundaries[0].endSec)
      expect(boundaries[1].endSec).toBeGreaterThan(2.2)
      expect(boundaries[1].endSec).toBeLessThan(2.55)

      expect(boundaries[2].startSec).toBe(boundaries[1].endSec)
      expect(boundaries[2].endSec).toBeCloseTo(3.5, 1)
    })

    it('gracefully degrades to proportional boundaries if no silence is detected', () => {
      // Continuous audio with zero pauses
      const audio = generateTone(3.0, sampleRate)
      const sentences = [
        'Sentence one.',
        'Sentence two is longer and has more words.',
      ]

      const boundaries = alignSpokenSentences(audio, sampleRate, sentences)

      expect(boundaries).toHaveLength(2)
      expect(boundaries[0].startSec).toBe(0)
      expect(boundaries[0].endSec).toBeGreaterThan(0.5)
      expect(boundaries[0].endSec).toBeLessThan(2.0)
      expect(boundaries[1].startSec).toBe(boundaries[0].endSec)
      expect(boundaries[1].endSec).toBeCloseTo(3.0, 1)
    })

    it('handles empty sentences or empty audio safely', () => {
      expect(alignSpokenSentences(new Float32Array(0), sampleRate, [])).toEqual([])
      expect(alignSpokenSentences(new Float32Array(0), sampleRate, ['   '])).toEqual([])
    })
  })
})
