import type { BeatSyncVibe } from './types'

import {
  BEAT_SYNC_ANALYSIS_INTERVAL_MS,
  BEAT_SYNC_TEMPO_BUFFER_HITS,
  BEAT_SYNC_TEMPO_MAX_BPM,
  BEAT_SYNC_TEMPO_MIN_BPM,
  BEAT_SYNC_TEMPO_PRIOR_BPM,
  BEAT_SYNC_TEMPO_WINDOW_SECONDS,
  clampBeatSyncVibeEnergyGain,
} from './settings'

/** Fallback level below this maps to zero energy before per-song calibration. */
const MIN_DB = -40
/** Fallback level above this maps to full energy before per-song calibration. */
const MAX_DB = -5
/** Perceptual curve: quiet material stays low, full-band material still reaches the top. */
const ENERGY_GAMMA = 1.5
/** Fast attack keeps drops responsive. */
const ENERGY_ATTACK = 0.45
/** Slow release avoids a flickering meter between beats. */
const ENERGY_RELEASE = 0.08
/** Rolling window used to learn this song's quiet and loud limits. */
const ENERGY_WINDOW_SECONDS = 30
const ENERGY_HISTORY_CAPACITY = Math.ceil(ENERGY_WINDOW_SECONDS * 1000 / BEAT_SYNC_ANALYSIS_INTERVAL_MS)
const ENERGY_MIN_HISTORY = 60
const ENERGY_MIN_DYNAMIC_RANGE_DB = 3
const ENERGY_NOISE_FLOOR_DB = -55
const ENERGY_PERCENTILE_REFRESH_FRAMES = 15
/** Frequency flux below this value is noise. */
const FLUX_FLOOR = 0.004
/** Frequency flux above this value is a full HIT. */
const FLUX_RANGE = 0.06

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function median(values: readonly number[]) {
  if (values.length === 0)
    return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

const tempoFrameMs = BEAT_SYNC_ANALYSIS_INTERVAL_MS
const tempoCapacity = Math.ceil(BEAT_SYNC_TEMPO_WINDOW_SECONDS * 1000 / tempoFrameMs)
const tempoMinFrames = Math.ceil(2 * 1000 / tempoFrameMs)
const tempoMinLag = Math.max(1, Math.round((60_000 / BEAT_SYNC_TEMPO_MAX_BPM) / tempoFrameMs))
const tempoMaxLag = Math.max(tempoMinLag, Math.round((60_000 / BEAT_SYNC_TEMPO_MIN_BPM) / tempoFrameMs))
const tempoPriorOctaves = 0.75
/** Keep the dance tempo out of the sub-90 / above-200 octave traps. */
const tempoFoldMinBpm = 90
const tempoFoldMaxBpm = 200

function tempoPrior(bpm: number) {
  return Math.exp(-0.5 * (Math.log2(bpm / BEAT_SYNC_TEMPO_PRIOR_BPM) / tempoPriorOctaves) ** 2)
}

function foldDanceTempo(bpm: number) {
  if (bpm > 0 && bpm < tempoFoldMinBpm && bpm * 2 <= tempoFoldMaxBpm)
    return bpm * 2
  if (bpm > tempoFoldMaxBpm && bpm / 2 >= tempoFoldMinBpm)
    return bpm / 2
  return bpm
}

/**
 * Estimates tempo from the onset envelope, not from accepted HITs.
 *
 * Autocorrelates several seconds of onset strength, scores harmonics, and
 * prefers a musical prior around 120 BPM. HIT timestamps are retained only for
 * the debug readout and never feed this BPM calculation.
 */
export class BeatSyncTempoEstimator {
  private onsets: number[] = []
  private bpmHistory: number[] = []
  private hitTimes: number[] = []
  private lastBpm = 0
  private lastConfidence = 0

  noteHit(now: number) {
    if (!Number.isFinite(now))
      return
    const last = this.hitTimes.at(-1)
    if (last !== undefined && now <= last)
      return
    this.hitTimes.push(now)
    if (this.hitTimes.length > BEAT_SYNC_TEMPO_BUFFER_HITS)
      this.hitTimes.shift()
  }

  reset() {
    this.onsets = []
    this.bpmHistory = []
    this.hitTimes = []
    this.lastBpm = 0
    this.lastConfidence = 0
  }

  update(onset: number): Pick<BeatSyncVibe, 'bpm' | 'bpmConfidence' | 'lastHitDeltaMs' | 'hitCount' | 'tempoBufferMs'> {
    this.onsets.push(clamp01(onset))
    if (this.onsets.length > tempoCapacity)
      this.onsets.shift()

    const estimate = this.estimateTempo()
    if (estimate.bpm > 0) {
      this.bpmHistory.push(foldDanceTempo(estimate.bpm))
      if (this.bpmHistory.length > 5)
        this.bpmHistory.shift()
      this.lastBpm = median(this.bpmHistory)
      this.lastConfidence = estimate.confidence
    }

    const hitCount = this.hitTimes.length
    const lastHit = this.hitTimes.at(-1)
    const previousHit = this.hitTimes.at(-2)
    return {
      bpm: this.lastBpm,
      bpmConfidence: this.lastBpm > 0 ? this.lastConfidence : 0,
      lastHitDeltaMs: lastHit !== undefined && previousHit !== undefined
        ? lastHit - previousHit
        : 0,
      hitCount,
      tempoBufferMs: this.onsets.length > 1
        ? (this.onsets.length - 1) * tempoFrameMs
        : 0,
    }
  }

  private estimateTempo(): { bpm: number, confidence: number } {
    if (this.onsets.length < tempoMinFrames)
      return { bpm: 0, confidence: 0 }

    const mean = this.onsets.reduce((sum, value) => sum + value, 0) / this.onsets.length
    const centered = this.onsets.map(value => value - mean)
    const zeroLag = centered.reduce((sum, value) => sum + value * value, 0)
    if (zeroLag <= 1e-9)
      return { bpm: 0, confidence: 0 }

    const autocorrelation = (lag: number) => {
      if (lag >= centered.length)
        return 0
      let sum = 0
      for (let index = lag; index < centered.length; index++)
        sum += centered[index] * centered[index - lag]
      return Math.max(0, sum / (centered.length - lag))
    }

    let bestLag = 0
    let bestScore = 0
    let secondScore = 0
    for (let lag = tempoMinLag; lag <= tempoMaxLag; lag++) {
      const bpm = 60_000 / (lag * tempoFrameMs)
      if (bpm < BEAT_SYNC_TEMPO_MIN_BPM || bpm > BEAT_SYNC_TEMPO_MAX_BPM)
        continue

      const harmonicScore = autocorrelation(lag)
        + 0.5 * autocorrelation(lag * 2)
        + 0.33 * autocorrelation(lag * 3)
      const weightedScore = harmonicScore * tempoPrior(bpm)
      if (weightedScore > bestScore) {
        secondScore = bestScore
        bestScore = weightedScore
        bestLag = lag
      }
      else if (weightedScore > secondScore) {
        secondScore = weightedScore
      }
    }

    if (bestLag === 0 || bestScore <= 0)
      return { bpm: 0, confidence: 0 }

    const bpm = 60_000 / (bestLag * tempoFrameMs)
    const normalizedPeak = Math.max(0, autocorrelation(bestLag)) / (zeroLag / centered.length)
    const prominence = bestScore > 0 ? (bestScore - secondScore) / bestScore : 0
    return {
      bpm,
      confidence: clamp01(normalizedPeak * 0.75 + prominence * 0.25),
    }
  }
}

/**
 * Turns time-domain level and frequency frames into display-friendly vibe.
 *
 * Energy is intentionally slow and normalized against a rolling 30s per-song
 * p10/p90 loudness range so quiet tracks can still reach high dance tiers.
 */
export class BeatSyncVibeTracker {
  private energy = 0
  private energyGain = 1
  private previousFrequency: Uint8Array<ArrayBuffer> | undefined
  private levelHistory: number[] = []
  private energyFloorDb = MIN_DB
  private energyCeilingDb = MAX_DB
  private energyRefreshFrames = 0

  setEnergyGain(gain: number) {
    this.energyGain = clampBeatSyncVibeEnergyGain(gain)
  }

  reset() {
    this.energy = 0
    this.previousFrequency = undefined
    this.levelHistory = []
    this.energyFloorDb = MIN_DB
    this.energyCeilingDb = MAX_DB
    this.energyRefreshFrames = 0
  }

  update(
    timeDomain: Uint8Array<ArrayBuffer>,
    frequency: Uint8Array<ArrayBuffer>,
  ): Pick<BeatSyncVibe, 'energy' | 'hit'> {
    const levelDb = this.levelFromTimeDomain(timeDomain)
    const targetEnergy = Math.min(1, this.energyFromLevel(levelDb) ** ENERGY_GAMMA * this.energyGain)
    if (targetEnergy > this.energy)
      this.energy += (targetEnergy - this.energy) * ENERGY_ATTACK
    else
      this.energy += (targetEnergy - this.energy) * ENERGY_RELEASE

    return {
      energy: this.energy,
      hit: this.spectralFlux(frequency),
    }
  }

  private levelFromTimeDomain(timeDomain: Uint8Array<ArrayBuffer>) {
    if (timeDomain.length === 0)
      return Number.NEGATIVE_INFINITY

    let sumSquares = 0
    for (const value of timeDomain) {
      const sample = (value - 128) / 128
      sumSquares += sample * sample
    }
    const rms = Math.sqrt(sumSquares / timeDomain.length)
    return 20 * Math.log10(rms + 1e-9)
  }

  private energyFromLevel(levelDb: number) {
    if (!Number.isFinite(levelDb) || levelDb <= ENERGY_NOISE_FLOOR_DB)
      return 0

    this.levelHistory.push(levelDb)
    if (this.levelHistory.length > ENERGY_HISTORY_CAPACITY)
      this.levelHistory.shift()

    this.energyRefreshFrames++
    if (this.energyRefreshFrames >= ENERGY_PERCENTILE_REFRESH_FRAMES) {
      this.energyRefreshFrames = 0
      this.refreshEnergyRange()
    }

    const range = this.energyCeilingDb - this.energyFloorDb
    if (range < ENERGY_MIN_DYNAMIC_RANGE_DB)
      return clamp01((levelDb - MIN_DB) / (MAX_DB - MIN_DB))
    return clamp01((levelDb - this.energyFloorDb) / range)
  }

  private refreshEnergyRange() {
    if (this.levelHistory.length < ENERGY_MIN_HISTORY)
      return

    const sorted = [...this.levelHistory].sort((a, b) => a - b)
    const p10 = sorted[Math.floor((sorted.length - 1) * 0.1)]
    const p90 = sorted[Math.floor((sorted.length - 1) * 0.9)]
    if (p90 - p10 < ENERGY_MIN_DYNAMIC_RANGE_DB)
      return

    this.energyFloorDb = p10
    this.energyCeilingDb = p90
  }

  private spectralFlux(frequency: Uint8Array<ArrayBuffer>) {
    if (frequency.length === 0)
      return 0

    let flux = 0
    if (this.previousFrequency && this.previousFrequency.length === frequency.length) {
      for (let index = 0; index < frequency.length; index++) {
        const delta = frequency[index] - this.previousFrequency[index]
        if (delta > 0)
          flux += delta
      }
    }

    if (!this.previousFrequency || this.previousFrequency.length !== frequency.length)
      this.previousFrequency = new Uint8Array(frequency.length)
    this.previousFrequency.set(frequency)

    const normalized = flux / frequency.length / 255
    return clamp01((normalized - FLUX_FLOOR) / FLUX_RANGE)
  }
}
