import type { EnergyTier, PersonaArchetype, RhythmStructure } from '../types.js'

export interface PhraseScheduleConfig {
  bpm: number
  rhythmStructure: RhythmStructure
  energyTier: EnergyTier
  durationSeconds?: number
  prewarmLeadTimeSec?: number
  personas?: PersonaArchetype[]
  beatTimestamps?: number[]
}

export interface PhraseSegment {
  index: number
  persona: PersonaArchetype
  startTimeSec: number
  endTimeSec: number
  durationSec: number
  prewarmNextAtSec: number
  barsCount: number
}

export interface PhrasePlan {
  barDurationSec: number
  barsPerPhrase: number
  phraseDurationSec: number
  beatsPerMeasure: number
  segments: PhraseSegment[]
}

export const DEFAULT_CYCLE_PERSONAS: PersonaArchetype[] = [
  'idol',
  'gothic_maid',
  'cool_android',
  'none',
]

/**
 * Computes the duration in seconds of a single musical bar/measure.
 */
export function computeBarDuration(bpm: number, rhythmStructure: RhythmStructure): number {
  const beatsPerMeasure = rhythmStructure === 'waltz_triple' ? 3 : 4
  const safeBpm = Math.max(30, bpm || 120)
  return beatsPerMeasure / (safeBpm / 60)
}

/**
 * Determines how many musical bars comprise a movement phrase based on energy and meter.
 */
export function computeBarsPerPhrase(
  rhythmStructure: RhythmStructure,
  energyTier: EnergyTier,
): number {
  // Explosive / high energy tracks have rapid section shifts (drops/builds every 8 bars)
  if (energyTier === 'explosive' || energyTier === 'high') {
    return 8
  }

  // Classical waltzes (3/4) naturally structure themes in 16 to 24 measure phrases.
  // 24 measures at 150 BPM lands at ~28.8s, perfectly framing a 25s pre-warm window.
  if (rhythmStructure === 'waltz_triple') {
    return 24
  }

  // Standard low/moderate energy 4/4 pieces develop across 16-bar phrases (~30-32s).
  return 16
}

/**
 * Snaps a target time to the nearest downbeat (Beat 1 of a measure).
 * If no downbeat lies within the tolerance window (e.g. target is beyond the audio duration),
 * returns targetTimeSec unaltered to prevent snapping to stale/past beats.
 */
export function findNearestDownbeat(
  targetTimeSec: number,
  beatTimestamps: number[],
  beatsPerMeasure: number = 4,
  toleranceSec?: number,
): number {
  if (!beatTimestamps || beatTimestamps.length === 0) {
    return targetTimeSec
  }

  const maxTolerance = toleranceSec ?? 3.0
  let closestDownbeat = -1
  let minDiff = Infinity

  for (let i = 0; i < beatTimestamps.length; i += beatsPerMeasure) {
    const t = beatTimestamps[i]
    const diff = Math.abs(t - targetTimeSec)
    if (diff < minDiff && diff <= maxTolerance) {
      minDiff = diff
      closestDownbeat = t
    }
  }

  if (closestDownbeat === -1) {
    return targetTimeSec
  }

  return closestDownbeat
}

/**
 * Generates an end-to-end musical phrase plan for dynamic choreography cycling.
 */
export function createPhrasePlan(config: PhraseScheduleConfig): PhrasePlan {
  const beatsPerMeasure = config.rhythmStructure === 'waltz_triple' ? 3 : 4
  const barDurationSec = computeBarDuration(config.bpm, config.rhythmStructure)
  const barsPerPhrase = computeBarsPerPhrase(config.rhythmStructure, config.energyTier)
  const phraseDurationSec = barsPerPhrase * barDurationSec

  const totalDuration = Math.max(config.durationSeconds ?? phraseDurationSec * 4, phraseDurationSec)
  const leadTime = config.prewarmLeadTimeSec ?? Math.min(5.0, phraseDurationSec * 0.25)
  const personas = config.personas && config.personas.length > 0
    ? config.personas
    : DEFAULT_CYCLE_PERSONAS

  const segments: PhraseSegment[] = []
  let currentTime = 0
  let index = 0
  const MAX_SEGMENTS = 500

  while (currentTime < totalDuration && segments.length < MAX_SEGMENTS) {
    const nextBoundary = currentTime + phraseDurationSec

    // If downbeat timestamps are supplied, snap the phrase boundary to the nearest downbeat within tolerance
    let endTime = nextBoundary
    if (config.beatTimestamps && config.beatTimestamps.length > 0) {
      endTime = findNearestDownbeat(nextBoundary, config.beatTimestamps, beatsPerMeasure, barDurationSec * 1.5)
    }

    // Invariant: endTime MUST strictly advance past currentTime by at least half a bar
    if (endTime <= currentTime + barDurationSec * 0.5) {
      endTime = currentTime + phraseDurationSec
    }

    const durationSec = endTime - currentTime
    const persona = personas[index % personas.length]
    const prewarmNextAtSec = Math.max(currentTime, endTime - leadTime)

    segments.push({
      index,
      persona,
      startTimeSec: currentTime,
      endTimeSec: endTime,
      durationSec,
      prewarmNextAtSec,
      barsCount: barsPerPhrase,
    })

    currentTime = endTime
    index++
  }

  return {
    barDurationSec,
    barsPerPhrase,
    phraseDurationSec,
    beatsPerMeasure,
    segments,
  }
}
