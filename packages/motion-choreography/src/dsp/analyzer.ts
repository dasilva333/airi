/**
 * Low-level DSP acoustic analysis engine.
 * Computes energy (RMS), tempo (BPM), beat onsets, spectral centroid,
 * timbre brightness, and rhythmic structure classification.
 */

import type {
  AcousticFeatures,
  EnergyTier,
  RhythmStructure,
  TimbreBrightness,
} from '../types.js'

import {
  applyHannWindow,
  computeMagnitudeSpectrum,
  computeSpectralCentroid,
} from './fft.js'

export interface AnalyzerOptions {
  /** Minimum tempo to scan in BPM (default: 60) */
  minBpm?: number
  /** Maximum tempo to scan in BPM (default: 200) */
  maxBpm?: number
  /** FFT frame size in samples (must be power of 2, default: 1024) */
  frameSize?: number
  /** Hop size between successive frames in samples (default: 512) */
  hopSize?: number
}

/**
 * Downmixes multi-channel audio to a single mono Float32Array.
 */
export function downmixToMono(channelData: Float32Array[]): Float32Array {
  const numChannels = channelData.length
  if (numChannels === 0) {
    return new Float32Array(0)
  }
  if (numChannels === 1) {
    return channelData[0]
  }

  const length = channelData[0].length
  const mono = new Float32Array(length)
  for (let ch = 0; ch < numChannels; ch++) {
    const channel = channelData[ch]
    for (let i = 0; i < length; i++) {
      mono[i] += channel[i]
    }
  }

  const scale = 1.0 / numChannels
  for (let i = 0; i < length; i++) {
    mono[i] *= scale
  }

  return mono
}

/**
 * Computes Root Mean Square (RMS) energy across a signal.
 */
export function computeRmsEnergy(signal: Float32Array): number {
  if (signal.length === 0) {
    return 0
  }
  let sumSq = 0
  for (let i = 0; i < signal.length; i++) {
    sumSq += signal[i] * signal[i]
  }
  return Math.sqrt(sumSq / signal.length)
}

/**
 * Classifies RMS energy into qualitative energy tiers.
 */
export function classifyEnergyTier(rms: number): EnergyTier {
  if (rms < 0.05) {
    return 'low'
  }
  if (rms < 0.18) {
    return 'moderate'
  }
  if (rms < 0.35) {
    return 'high'
  }
  return 'explosive'
}

/**
 * Classifies spectral centroid into qualitative timbre brightness tiers.
 */
export function classifyTimbreBrightness(centroidHz: number): TimbreBrightness {
  if (centroidHz < 850) {
    return 'dark'
  }
  if (centroidHz < 1500) {
    return 'warm'
  }
  if (centroidHz <= 3000) {
    return 'balanced'
  }
  return 'bright'
}

/**
 * Analyzes audio PCM buffers to extract rhythm, tempo, energy, and timbre features.
 */
export function analyzeAudioBuffer(
  channelData: Float32Array[],
  sampleRate: number,
  options: AnalyzerOptions = {},
): AcousticFeatures {
  const minBpm = options.minBpm ?? 60
  const maxBpm = options.maxBpm ?? 200
  const frameSize = options.frameSize ?? 1024
  const hopSize = options.hopSize ?? 512

  const mono = downmixToMono(channelData)
  const durationSeconds = mono.length / sampleRate

  if (mono.length < frameSize) {
    return {
      bpm: 0,
      confidence: 0,
      energyRms: 0,
      energyTier: 'low',
      spectralCentroid: 0,
      timbreBrightness: 'dark',
      rhythmStructure: 'ambient_free',
      durationSeconds,
      beatTimestamps: [],
    }
  }

  const energyRms = computeRmsEnergy(mono)
  const energyTier = classifyEnergyTier(energyRms)

  // Step 1: STFT Spectral Flux & Spectral Centroid across frames
  const numFrames = Math.floor((mono.length - frameSize) / hopSize) + 1
  const spectralFlux = new Float32Array(numFrames)
  let centroidSum = 0
  let centroidFrames = 0

  const halfN = (frameSize >> 1) + 1
  let prevMagnitudes: Float32Array = new Float32Array(halfN)
  const frameBuffer = new Float32Array(frameSize)

  for (let f = 0; f < numFrames; f++) {
    const startSample = f * hopSize
    for (let i = 0; i < frameSize; i++) {
      frameBuffer[i] = mono[startSample + i]
    }

    applyHannWindow(frameBuffer)
    const magnitudes = computeMagnitudeSpectrum(frameBuffer)

    // Spectral centroid
    const centroid = computeSpectralCentroid(magnitudes, sampleRate, frameSize)
    if (centroid > 0) {
      centroidSum += centroid
      centroidFrames++
    }

    // Spectral flux (positive difference, half-wave rectified)
    let flux = 0
    for (let k = 0; k < halfN; k++) {
      const diff = magnitudes[k] - prevMagnitudes[k]
      if (diff > 0) {
        flux += diff
      }
    }
    spectralFlux[f] = flux
    prevMagnitudes = magnitudes
  }

  const avgSpectralCentroid = centroidFrames > 0 ? centroidSum / centroidFrames : 0
  const timbreBrightness = classifyTimbreBrightness(avgSpectralCentroid)

  // Step 2: Peak-picking for onset detection
  const beatTimestamps: number[] = []
  const windowRadius = 8
  const frameRate = sampleRate / hopSize

  for (let f = windowRadius; f < numFrames - windowRadius; f++) {
    let localSum = 0
    for (let w = -windowRadius; w <= windowRadius; w++) {
      localSum += spectralFlux[f + w]
    }
    const localMean = localSum / (2 * windowRadius + 1)
    const threshold = localMean * 1.35 + 0.001

    if (
      spectralFlux[f] > threshold
      && spectralFlux[f] > spectralFlux[f - 1]
      && spectralFlux[f] >= spectralFlux[f + 1]
    ) {
      const timestamp = (f * hopSize) / sampleRate
      // Enforce minimum refractory interval (120ms, allowing up to ~250 BPM 16th variations)
      const lastTs = beatTimestamps.length > 0 ? beatTimestamps[beatTimestamps.length - 1] : -1
      if (lastTs < 0 || timestamp - lastTs >= 0.12) {
        beatTimestamps.push(timestamp)
      }
    }
  }

  // Step 3: Autocorrelation of Spectral Flux to identify primary tempo
  const minLag = Math.floor((60 * frameRate) / maxBpm)
  const maxLag = Math.ceil((60 * frameRate) / minBpm)

  const corrTable = new Float32Array(maxLag + 1)
  let bestLag = 0
  let maxCorr = -1
  let meanCorr = 0
  let countCorr = 0

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    let count = 0
    for (let f = 0; f < numFrames - lag; f++) {
      sum += spectralFlux[f] * spectralFlux[f + lag]
      count++
    }
    const corr = count > 0 ? sum / count : 0
    corrTable[lag] = corr

    // Human perceptual resonance curve (soft prior favoring natural dance tempos 105-135 BPM)
    const bpmAtLag = (60 * frameRate) / lag
    const resonance = Math.exp(-0.5 * ((bpmAtLag - 120) / 40) ** 2)
    const weightedCorr = corr * (1.0 + 0.45 * resonance)

    meanCorr += corr
    countCorr++

    if (weightedCorr > maxCorr) {
      maxCorr = weightedCorr
      bestLag = lag
    }
  }

  // Subharmonic & Octave Disambiguation:
  // Check if halfLag (double tempo) represents the tactus pulse
  if (bestLag > 0) {
    const halfLag = Math.round(bestLag / 2)
    if (halfLag >= minLag) {
      const halfCorr = corrTable[halfLag]
      const halfBpm = (60 * frameRate) / halfLag
      // If halfLag corresponds to typical dance tempo (85-160 BPM) and has a substantial peak
      if (halfBpm >= 85 && halfBpm <= 160 && halfCorr >= corrTable[bestLag] * 0.35) {
        bestLag = halfLag
      }
    }
  }

  // IOI (Inter-Onset Interval) Consensus:
  // If consecutive onset intervals indicate a consistent tactus, cross-validate with autocorrelation
  if (beatTimestamps.length >= 4) {
    const intervals: number[] = []
    for (let i = 1; i < beatTimestamps.length; i++) {
      const dt = beatTimestamps[i] - beatTimestamps[i - 1]
      if (dt >= 0.25 && dt <= 1.4) {
        intervals.push(dt)
      }
    }

    if (intervals.length >= 3) {
      intervals.sort((a, b) => a - b)
      const medianDt = intervals[Math.floor(intervals.length / 2)]
      const ioiBpm = 60 / medianDt

      const currentBpm = bestLag > 0 ? (60 * frameRate) / bestLag : 0
      // If autocorrelation picked half-tempo (e.g. 60 BPM while IOI is 120 BPM)
      if (currentBpm < 85 && Math.abs(ioiBpm - 2 * currentBpm) < 15) {
        const candidateLag = Math.round((60 * frameRate) / ioiBpm)
        if (candidateLag >= minLag && candidateLag <= maxLag) {
          bestLag = candidateLag
        }
      }
    }
  }

  const avgCorr = countCorr > 0 ? meanCorr / countCorr : 1
  const rawBpm = bestLag > 0 ? Math.round((60 * frameRate) / bestLag) : 0
  const confidence = Math.min(1.0, Math.max(0.0, maxCorr > 0 ? (maxCorr - avgCorr) / (maxCorr + 1e-6) : 0))

  // Ambient / Low-confidence fallback
  if (energyRms < 0.015 || beatTimestamps.length < 3 || confidence < 0.15) {
    return {
      bpm: rawBpm > 0 ? rawBpm : 80,
      confidence: Math.max(0.05, confidence),
      energyRms,
      energyTier: 'low',
      spectralCentroid: avgSpectralCentroid,
      timbreBrightness,
      rhythmStructure: 'ambient_free',
      durationSeconds,
      beatTimestamps,
    }
  }

  // Step 4: Meter and Rhythm Structure Classification
  let rhythmStructure: RhythmStructure = 'four_on_the_floor'

  // Metric accent correlation across detected beat onsets:
  // In 3/4 waltz [accent, upbeat, upbeat], 3-beat recurrence has strong positive covariance,
  // whereas 2-beat covariance is negative or significantly lower.
  // In 4/4 time [accent, upbeat, accent, upbeat], 2-beat covariance dominates.
  let isWaltz = false
  if (beatTimestamps.length >= 6) {
    const onsetStrengths: number[] = []
    for (const ts of beatTimestamps) {
      const f = Math.min(numFrames - 1, Math.max(0, Math.round(ts * frameRate)))
      onsetStrengths.push(spectralFlux[f])
    }

    let meanStrength = 0
    for (const s of onsetStrengths) {
      meanStrength += s
    }
    meanStrength /= onsetStrengths.length

    const zeroMean = onsetStrengths.map(s => s - meanStrength)

    let cov2 = 0
    let count2 = 0
    for (let i = 0; i < zeroMean.length - 2; i++) {
      cov2 += zeroMean[i] * zeroMean[i + 2]
      count2++
    }
    cov2 = count2 > 0 ? cov2 / count2 : 0

    let cov3 = 0
    let count3 = 0
    for (let i = 0; i < zeroMean.length - 3; i++) {
      cov3 += zeroMean[i] * zeroMean[i + 3]
      count3++
    }
    cov3 = count3 > 0 ? cov3 / count3 : 0

    if (rawBpm <= 125 && cov3 > 0 && cov3 > cov2) {
      isWaltz = true
    }
  }

  if (rawBpm >= 155) {
    rhythmStructure = 'fast_breakbeat'
  }
  else if (isWaltz) {
    rhythmStructure = 'waltz_triple'
  }
  else {
    // Inter-Onset Interval (IOI) regularity test
    const beatIntervalSec = 60 / rawBpm
    let syncopatedCount = 0
    let totalTransitions = 0

    for (let i = 1; i < beatTimestamps.length; i++) {
      const delta = beatTimestamps[i] - beatTimestamps[i - 1]
      const beatRatio = delta / beatIntervalSec
      const distFromIntegerBeat = Math.abs(beatRatio - Math.round(beatRatio))

      // Off-beat syncopation typically lands near half-beat (0.5) or triplet (0.33/0.66)
      if (distFromIntegerBeat > 0.22 && distFromIntegerBeat < 0.78) {
        syncopatedCount++
      }
      totalTransitions++
    }

    const syncopationRatio = totalTransitions > 0 ? syncopatedCount / totalTransitions : 0
    if (syncopationRatio > 0.38) {
      rhythmStructure = 'syncopated'
    }
    else {
      rhythmStructure = 'four_on_the_floor'
    }
  }

  return {
    bpm: rawBpm,
    confidence: Number(confidence.toFixed(2)),
    energyRms: Number(energyRms.toFixed(4)),
    energyTier,
    spectralCentroid: Math.round(avgSpectralCentroid),
    timbreBrightness,
    rhythmStructure,
    durationSeconds: Number(durationSeconds.toFixed(2)),
    beatTimestamps,
  }
}
