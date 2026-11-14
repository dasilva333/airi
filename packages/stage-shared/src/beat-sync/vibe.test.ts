import { describe, expect, it } from 'vitest'

import { BEAT_SYNC_ANALYSIS_INTERVAL_MS } from './settings'
import { BeatSyncTempoEstimator, BeatSyncVibeTracker } from './vibe'

function makeSineTimeDomain(amplitude01: number, size = 2048): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    const sample = Math.sin((i / size) * Math.PI * 8) * amplitude01
    buf[i] = Math.max(0, Math.min(255, Math.round(128 + sample * 127)))
  }
  return buf
}

describe('beatSyncVibeTracker', () => {
  it('treats silence below -55 dBFS as zero energy', () => {
    const tracker = new BeatSyncVibeTracker()
    const silence = new Uint8Array(2048).fill(128)
    const freq = new Uint8Array(1024).fill(0)

    const result = tracker.update(silence, freq)
    expect(result.energy).toBe(0)
    expect(result.hit).toBe(0)
  })

  it('normalizes energy against a quiet track dynamic range after calibration', () => {
    const tracker = new BeatSyncVibeTracker()
    const quiet = makeSineTimeDomain(0.02) // ~ -37 dBFS
    const loudForQuietTrack = makeSineTimeDomain(0.08) // ~ -25 dBFS
    const freq = new Uint8Array(1024).fill(0)

    for (let i = 0; i < 40; i++)
      tracker.update(quiet, freq)
    for (let i = 0; i < 40; i++)
      tracker.update(loudForQuietTrack, freq)

    const result = tracker.update(loudForQuietTrack, freq)
    expect(result.energy).toBeGreaterThan(0.75)
  })

  it('detects positive spectral flux hits while ignoring drops', () => {
    const tracker = new BeatSyncVibeTracker()
    const audio = makeSineTimeDomain(0.3)
    const lowFreq = new Uint8Array(1024).fill(10)
    const highFreq = new Uint8Array(1024).fill(60)

    tracker.update(audio, lowFreq)
    const rise = tracker.update(audio, highFreq)
    const fall = tracker.update(audio, lowFreq)

    expect(rise.hit).toBeGreaterThan(0.8)
    expect(fall.hit).toBe(0)
  })
})

describe('beatSyncTempoEstimator', () => {
  it('estimates ~120 BPM from periodic onset pulses', () => {
    const estimator = new BeatSyncTempoEstimator()
    const periodFrames = Math.round(500 / BEAT_SYNC_ANALYSIS_INTERVAL_MS) // 120 BPM = 500ms

    let latest = estimator.update(0)
    for (let frame = 0; frame < 180; frame++) {
      const onset = frame % periodFrames === 0 ? 1 : 0
      latest = estimator.update(onset)
    }

    expect(latest.bpm).toBeGreaterThan(110)
    expect(latest.bpm).toBeLessThan(130)
    expect(latest.bpmConfidence).toBeGreaterThan(0.3)
  })

  it('folds sub-90 BPM tempo up into the 90-200 dance range', () => {
    const estimator = new BeatSyncTempoEstimator()
    const periodFrames = Math.round(800 / BEAT_SYNC_ANALYSIS_INTERVAL_MS) // 75 BPM -> folds to 150 BPM

    let latest = estimator.update(0)
    for (let frame = 0; frame < 180; frame++) {
      const onset = frame % periodFrames === 0 ? 1 : 0
      latest = estimator.update(onset)
    }

    expect(latest.bpm).toBeGreaterThan(140)
    expect(latest.bpm).toBeLessThan(165)
  })
})
