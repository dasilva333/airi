import type { PhraseScheduleConfig } from '../src/conductor/phrase-scheduler.js'

import { describe, expect, it } from 'vitest'

import {
  computeBarDuration,
  computeBarsPerPhrase,
  createPhrasePlan,
  findNearestDownbeat,

} from '../src/conductor/phrase-scheduler.js'

describe('phrase Scheduler (Milestone 2: Dynamic Cycle Engine)', () => {
  it('computes bar duration accurately across meters', () => {
    // 4/4 at 120 BPM: 4 beats / 2 beats/sec = 2.0s
    expect(computeBarDuration(120, 'four_on_the_floor')).toBeCloseTo(2.0, 4)

    // 3/4 Waltz at 150 BPM: 3 beats / 2.5 beats/sec = 1.2s
    expect(computeBarDuration(150, 'waltz_triple')).toBeCloseTo(1.2, 4)

    // 4/4 Breakbeat at 174 BPM: 4 beats / 2.9 beats/sec = 1.3793s
    expect(computeBarDuration(174, 'fast_breakbeat')).toBeCloseTo(4 / (174 / 60), 4)
  })

  it('determines bars per phrase based on energy and meter', () => {
    // High / explosive energy uses 8-bar fast phrase
    expect(computeBarsPerPhrase('four_on_the_floor', 'explosive')).toBe(8)
    expect(computeBarsPerPhrase('four_on_the_floor', 'high')).toBe(8)

    // Classical waltz uses 24-bar classical phrase (~28.8s)
    expect(computeBarsPerPhrase('waltz_triple', 'moderate')).toBe(24)
    expect(computeBarsPerPhrase('waltz_triple', 'low')).toBe(24)

    // Standard moderate/low energy 4/4 uses 16-bar phrase (~32s)
    expect(computeBarsPerPhrase('four_on_the_floor', 'moderate')).toBe(16)
    expect(computeBarsPerPhrase('syncopated', 'low')).toBe(16)
  })

  it('generates a full phrase plan with pre-warm timestamps', () => {
    // The Blue Danube: 150 BPM, 3/4 waltz, moderate energy, 120s song
    const config: PhraseScheduleConfig = {
      bpm: 150,
      rhythmStructure: 'waltz_triple',
      energyTier: 'moderate',
      durationSeconds: 120,
      prewarmLeadTimeSec: 5.0,
      personas: ['idol', 'gothic_maid', 'cool_android', 'none'],
    }

    const plan = createPhrasePlan(config)

    expect(plan.barDurationSec).toBeCloseTo(1.2, 3)
    expect(plan.barsPerPhrase).toBe(24)
    expect(plan.phraseDurationSec).toBeCloseTo(28.8, 3)

    // 120s song should generate 5 segments (0-28.8, 28.8-57.6, 57.6-86.4, 86.4-115.2, 115.2-144)
    expect(plan.segments.length).toBeGreaterThanOrEqual(4)

    // Segment 0: idol (starts at 0, ends at 28.8, pre-warm for next segment at 23.8s)
    expect(plan.segments[0].persona).toBe('idol')
    expect(plan.segments[0].startTimeSec).toBeCloseTo(0, 3)
    expect(plan.segments[0].endTimeSec).toBeCloseTo(28.8, 3)
    expect(plan.segments[0].prewarmNextAtSec).toBeCloseTo(23.8, 3)

    // Segment 1: gothic_maid (starts at 28.8, ends at 57.6, pre-warm for next segment at 52.6s)
    expect(plan.segments[1].persona).toBe('gothic_maid')
    expect(plan.segments[1].startTimeSec).toBeCloseTo(28.8, 3)
    expect(plan.segments[1].endTimeSec).toBeCloseTo(57.6, 3)
    expect(plan.segments[1].prewarmNextAtSec).toBeCloseTo(52.6, 3)

    // Segment 2: cool_android
    expect(plan.segments[2].persona).toBe('cool_android')

    // Segment 3: none (Pure Beat)
    expect(plan.segments[3].persona).toBe('none')

    // Segment 4: wraps back to idol
    if (plan.segments[4]) {
      expect(plan.segments[4].persona).toBe('idol')
    }
  })

  it('snaps accurately to beat 1 downbeats of measures', () => {
    // 3/4 meter: beats at 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0 ...
    // Downbeats are indices 0 (0.0s), 3 (3.0s), 6 (6.0s), 9 (9.0s)...
    const beatTimestamps = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0]

    // Target time 2.8s should snap to downbeat at 3.0s (index 3)
    const snapped = findNearestDownbeat(2.8, beatTimestamps, 3)
    expect(snapped).toBeCloseTo(3.0, 3)

    // Target time 5.9s should snap to downbeat at 6.0s (index 6)
    const snapped2 = findNearestDownbeat(5.9, beatTimestamps, 3)
    expect(snapped2).toBeCloseTo(6.0, 3)
  })

  // ROOT CAUSE:
  //
  // When audio duration or beatTimestamps span a shorter window than phraseDurationSec
  // (e.g. an 8-second preset track with a 28.8s waltz phrase), findNearestDownbeat
  // clamped to the last downbeat in the array (e.g. 7.2s). In createPhrasePlan,
  // currentTime would get stuck at 7.2s and never advance past totalDuration,
  // creating an infinite while-loop that exhausted memory and crashed the page with GC errors.
  //
  // BEFORE: while (currentTime < totalDuration) { ... endTime = findNearestDownbeat(...) }
  //
  // FIXED BY: Ensuring endTime always advances strictly past currentTime by at least
  // barDurationSec, and only snapping to downbeats that lie in the future (> currentTime + barDurationSec)
  // or falling back to regular metric phrase boundaries when timestamps end.
  it('reproduces and prevents infinite loop when beatTimestamps are shorter than phrase duration', () => {
    // 8-second track with beats every 0.4s (0s to 7.6s)
    const shortBeatTimestamps = Array.from({ length: 20 }, (_, i) => i * 0.4)
    const config: PhraseScheduleConfig = {
      bpm: 150,
      rhythmStructure: 'waltz_triple',
      energyTier: 'moderate',
      durationSeconds: 8,
      beatTimestamps: shortBeatTimestamps,
    }

    const plan = createPhrasePlan(config)
    expect(plan.segments.length).toBeGreaterThan(0)
    for (let i = 0; i < plan.segments.length; i++) {
      expect(plan.segments[i].endTimeSec).toBeGreaterThan(plan.segments[i].startTimeSec)
    }
  })
})
