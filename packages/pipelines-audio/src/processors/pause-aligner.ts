import type { SpokenSentenceBoundary } from '../types'

export interface PauseAlignerOptions {
  windowMs?: number
  hopMs?: number
  relativeThresholdDb?: number
  absoluteFloorDb?: number
  minSilenceMs?: number
}

export interface CandidatePause {
  startSec: number
  endSec: number
  centerSec: number
  durationSec: number
  minDb: number
}

export interface EnvelopeResult {
  envelopeDb: Float32Array
  hopMs: number
  peakDb: number
  durationSec: number
}

/**
 * Computes root-mean-square (RMS) energy in sliding windows across a Float32Array PCM stream.
 * Converts linear RMS to decibels (dBFS).
 */
export function computeRmsEnvelope(
  pcm: Float32Array,
  sampleRate: number,
  windowMs = 10,
  hopMs = 5,
): EnvelopeResult {
  const durationSec = pcm.length / sampleRate
  if (pcm.length === 0 || sampleRate <= 0) {
    return { envelopeDb: new Float32Array(0), hopMs, peakDb: -100, durationSec: 0 }
  }

  const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate))
  const hopSamples = Math.max(1, Math.round((hopMs / 1000) * sampleRate))
  const numFrames = Math.max(0, Math.floor((pcm.length - windowSamples) / hopSamples) + 1)

  if (numFrames === 0) {
    // Audio is shorter than one full window; compute single frame
    let sumSq = 0
    for (let i = 0; i < pcm.length; i++) {
      sumSq += pcm[i] * pcm[i]
    }
    const rms = Math.sqrt(sumSq / pcm.length)
    const db = 20 * Math.log10(rms + 1e-7)
    return {
      envelopeDb: new Float32Array([db]),
      hopMs,
      peakDb: db,
      durationSec,
    }
  }

  const envelopeDb = new Float32Array(numFrames)
  let peakDb = -100

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSamples
    let sumSq = 0
    for (let i = 0; i < windowSamples; i++) {
      const sample = pcm[offset + i]
      sumSq += sample * sample
    }
    const rms = Math.sqrt(sumSq / windowSamples)
    const db = 20 * Math.log10(rms + 1e-7)
    envelopeDb[frame] = db
    if (db > peakDb) {
      peakDb = db
    }
  }

  return {
    envelopeDb,
    hopMs,
    peakDb,
    durationSec,
  }
}

/**
 * Identifies contiguous silence regions below the adaptive threshold.
 */
export function detectSilencePauses(
  envelope: Float32Array,
  hopMs: number,
  thresholdDb: number,
  minSilenceMs = 75,
): { candidatePauses: CandidatePause[], speechStartSec: number, speechEndSec: number } {
  const minFrames = Math.max(1, Math.round(minSilenceMs / hopMs))
  const hopSec = hopMs / 1000

  let speechStartFrame = -1
  let speechEndFrame = -1

  for (let i = 0; i < envelope.length; i++) {
    if (envelope[i] >= thresholdDb) {
      if (speechStartFrame === -1)
        speechStartFrame = i
      speechEndFrame = i
    }
  }

  // If no speech detected above threshold, return empty
  if (speechStartFrame === -1 || speechEndFrame === -1) {
    return { candidatePauses: [], speechStartSec: 0, speechEndSec: envelope.length * hopSec }
  }

  const speechStartSec = speechStartFrame * hopSec
  const speechEndSec = (speechEndFrame + 1) * hopSec

  const candidatePauses: CandidatePause[] = []
  let inSilence = false
  let silenceStart = 0
  let minDb = 0

  // Only consider silence intervals that occur strictly within the speech range (excluding outer margins)
  for (let i = speechStartFrame; i <= speechEndFrame; i++) {
    const isSilent = envelope[i] < thresholdDb

    if (isSilent && !inSilence) {
      inSilence = true
      silenceStart = i
      minDb = envelope[i]
    }
    else if (isSilent && inSilence) {
      if (envelope[i] < minDb)
        minDb = envelope[i]
    }
    else if (!isSilent && inSilence) {
      inSilence = false
      const silenceEnd = i
      const runFrames = silenceEnd - silenceStart
      if (runFrames >= minFrames) {
        const startSec = silenceStart * hopSec
        const endSec = silenceEnd * hopSec
        candidatePauses.push({
          startSec,
          endSec,
          centerSec: (startSec + endSec) / 2,
          durationSec: endSec - startSec,
          minDb,
        })
      }
    }
  }

  return {
    candidatePauses,
    speechStartSec,
    speechEndSec,
  }
}

/**
 * Estimates rough phonetic weight for a sentence string to approximate its relative speech duration.
 * CJK characters count as ~1.8 syllables; Latin words count as ~1.3 syllables.
 */
export function estimateSentencePhoneticWeight(text: string): number {
  const trimmed = text.trim()
  if (!trimmed)
    return 1

  // Count CJK ideographs / kana
  const cjkMatches = trimmed.match(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g)
  const cjkCount = cjkMatches ? cjkMatches.length : 0

  // Count Latin words
  const latinText = trimmed.replace(/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/g, ' ')
  const words = latinText.trim().split(/\s+/).filter(Boolean)
  const latinWeight = words.length * 1.3

  const total = (cjkCount * 1.8) + latinWeight
  return Math.max(1, total)
}

/**
 * Aligns an array of contiguous sentences with decoded PCM audio.
 * Matches detected silence dips against expected boundary proportions using dynamic programming.
 */
export function alignSpokenSentences(
  pcm: Float32Array,
  sampleRate: number,
  sentences: string[],
  options: PauseAlignerOptions = {},
): SpokenSentenceBoundary[] {
  const validSentences = sentences.filter(s => s.trim().length > 0)
  if (validSentences.length === 0)
    return []

  const totalDuration = pcm.length / sampleRate
  if (validSentences.length === 1 || totalDuration <= 0) {
    return [{ text: validSentences[0], startSec: 0, endSec: Math.max(0, totalDuration) }]
  }

  const windowMs = options.windowMs ?? 10
  const hopMs = options.hopMs ?? 5
  const relativeThresholdDb = options.relativeThresholdDb ?? 32
  const absoluteFloorDb = options.absoluteFloorDb ?? -48
  const minSilenceMs = options.minSilenceMs ?? 75

  // 1. Calculate RMS energy envelope
  const { envelopeDb, peakDb } = computeRmsEnvelope(pcm, sampleRate, windowMs, hopMs)
  const thresholdDb = Math.max(peakDb - relativeThresholdDb, absoluteFloorDb)

  // 2. Detect candidate silence intervals
  const { candidatePauses, speechStartSec, speechEndSec } = detectSilencePauses(
    envelopeDb,
    hopMs,
    thresholdDb,
    minSilenceMs,
  )

  const activeDuration = Math.max(0.1, speechEndSec - speechStartSec)
  const K = validSentences.length
  const weights = validSentences.map(s => estimateSentencePhoneticWeight(s))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  // Expected boundary timestamps (K - 1 boundaries)
  const expectedBoundaries: number[] = []
  let cumulativeWeight = 0
  for (let k = 0; k < K - 1; k++) {
    cumulativeWeight += weights[k]
    const proportion = cumulativeWeight / totalWeight
    expectedBoundaries.push(speechStartSec + proportion * activeDuration)
  }

  // 3. Match candidate pauses to expected boundaries
  const selectedSplitPoints: number[] = []

  if (candidatePauses.length === 0) {
    // Fallback: No candidate silence detected (e.g. continuous breathless speech)
    // Use proportional estimates directly
    for (let k = 0; k < K - 1; k++) {
      selectedSplitPoints.push(expectedBoundaries[k])
    }
  }
  else if (candidatePauses.length >= K - 1) {
    // DP monotonic alignment: pick K - 1 candidate pauses out of M to minimize deviation
    const M = candidatePauses.length
    const numSplits = K - 1

    // dp[k][m] = min cost choosing candidate m for split k
    // parent[k][m] = candidate index chosen for split k - 1
    const dp: number[][] = Array.from({ length: numSplits }, () => Array.from({ length: M }, () => Infinity))
    const parent: number[][] = Array.from({ length: numSplits }, () => Array.from({ length: M }, () => -1))

    for (let m = 0; m < M; m++) {
      const diff = Math.abs(candidatePauses[m].centerSec - expectedBoundaries[0])
      // Longer pauses are preferred for sentence boundaries
      const durationBonus = Math.max(0.7, 1.2 - candidatePauses[m].durationSec)
      dp[0][m] = diff * durationBonus
    }

    for (let k = 1; k < numSplits; k++) {
      for (let m = k; m < M; m++) {
        const diff = Math.abs(candidatePauses[m].centerSec - expectedBoundaries[k])
        const durationBonus = Math.max(0.7, 1.2 - candidatePauses[m].durationSec)
        const currentCost = diff * durationBonus

        let bestPrev = Infinity
        let bestPrevIdx = -1
        for (let prevM = k - 1; prevM < m; prevM++) {
          if (dp[k - 1][prevM] < bestPrev) {
            bestPrev = dp[k - 1][prevM]
            bestPrevIdx = prevM
          }
        }

        if (bestPrevIdx !== -1) {
          dp[k][m] = bestPrev + currentCost
          parent[k][m] = bestPrevIdx
        }
      }
    }

    // Find best end candidate for last split
    let minCost = Infinity
    let bestLastM = -1
    for (let m = numSplits - 1; m < M; m++) {
      if (dp[numSplits - 1][m] < minCost) {
        minCost = dp[numSplits - 1][m]
        bestLastM = m
      }
    }

    // Backtrack path
    const chosenIndices: number[] = new Array(numSplits)
    let curr = bestLastM
    for (let k = numSplits - 1; k >= 0; k--) {
      chosenIndices[k] = curr
      curr = parent[k][curr]
    }

    for (let k = 0; k < numSplits; k++) {
      selectedSplitPoints.push(candidatePauses[chosenIndices[k]].centerSec)
    }
  }
  else {
    // Fewer candidates than required boundaries: match greedily to nearest expected, interpolate rest
    const usedCandidates = new Set<number>()

    for (let k = 0; k < K - 1; k++) {
      const exp = expectedBoundaries[k]
      let bestDist = Infinity
      let bestM = -1

      for (let m = 0; m < candidatePauses.length; m++) {
        if (usedCandidates.has(m))
          continue
        const dist = Math.abs(candidatePauses[m].centerSec - exp)
        // Only pair if reasonably close (within 1.5s or 35% of duration)
        if (dist < bestDist && dist < Math.max(1.5, activeDuration * 0.35)) {
          bestDist = dist
          bestM = m
        }
      }

      if (bestM !== -1) {
        usedCandidates.add(bestM)
        selectedSplitPoints.push(candidatePauses[bestM].centerSec)
      }
      else {
        selectedSplitPoints.push(exp)
      }
    }

    // Ensure strictly monotonic order
    selectedSplitPoints.sort((a, b) => a - b)
  }

  // 4. Construct sentence boundary intervals
  const boundaries: SpokenSentenceBoundary[] = []
  let prevEndSec = 0

  for (let i = 0; i < K; i++) {
    const splitSec = i < K - 1 ? selectedSplitPoints[i] : totalDuration
    // Clamp to valid range
    const clampedEnd = Math.min(totalDuration, Math.max(prevEndSec + 0.05, splitSec))

    boundaries.push({
      text: validSentences[i],
      startSec: prevEndSec,
      endSec: clampedEnd,
    })

    prevEndSec = clampedEnd
  }

  // Ensure last boundary reaches the total duration
  if (boundaries.length > 0) {
    boundaries[boundaries.length - 1].endSec = totalDuration
  }

  return boundaries
}
