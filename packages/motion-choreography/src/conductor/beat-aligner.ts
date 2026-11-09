/**
 * Beat-to-Keypoint Aligner ("The Conductor").
 * Aligns DanceSheet anchor key-poses with musical beat onsets and downbeat accents.
 */

import type {
  AlignedKeyframeMapping,
  BeatAlignmentOptions,
  ConductorAlignmentResult,
  DanceSheet,
} from '../types.js'

/**
 * Filters beat timestamps into target candidate beats based on metric structure and cadence.
 */
export function selectCandidateBeats(
  beatTimestamps: number[],
  options: BeatAlignmentOptions = {},
): number[] {
  if (beatTimestamps.length === 0) {
    return [0]
  }

  // Ensure beat 0 exists
  const beats = [...beatTimestamps]
  if (beats[0] > 0.05) {
    beats.unshift(0)
  }

  const { rhythmStructure, cadence = 'adaptive' } = options

  if (cadence === 'downbeats_only') {
    // Every 3 beats for waltz, every 4 beats for 4/4
    const stride = rhythmStructure === 'waltz_triple' ? 3 : 4
    return beats.filter((_, idx) => idx % stride === 0)
  }

  if (cadence === 'adaptive') {
    if (rhythmStructure === 'waltz_triple') {
      // 3/4 triple meter: downbeat on every 3rd beat
      return beats.filter((_, idx) => idx % 3 === 0)
    }
    if (rhythmStructure === 'fast_breakbeat') {
      // High cadence: use all beats
      return beats
    }
    if (rhythmStructure === 'syncopated') {
      // Syncopated: every 2nd beat (half-measure accents)
      return beats.filter((_, idx) => idx % 2 === 0)
    }
    // Four on the floor: default to every 2nd beat (downbeat + backbeat)
    return beats.filter((_, idx) => idx % 2 === 0)
  }

  // 'all_beats': use every detected beat
  return beats
}

/**
 * Aligns extracted DanceSheet keyframes to target musical beat timestamps.
 * Enforces monotonic chronological ordering and elastic warp limits.
 */
export function alignDanceSheetToBeats(
  danceSheet: DanceSheet,
  beatTimestamps: number[],
  options: BeatAlignmentOptions = {},
): ConductorAlignmentResult {
  const {
    maxWarpRatio = 2.5,
    minWarpRatio = 0.4,
  } = options

  const keyframes = danceSheet.keyframes
  if (keyframes.length === 0) {
    return {
      mappings: [],
      totalDurationSeconds: 0,
      averageWarpRatio: 1.0,
      warpRange: [1.0, 1.0],
    }
  }

  const candidateBeats = selectCandidateBeats(beatTimestamps, options)

  // Global scale estimate: ratio of available beat duration to motion duration
  const totalMotionDuration = danceSheet.durationSeconds > 0
    ? danceSheet.durationSeconds
    : (keyframes[keyframes.length - 1]?.timeSeconds ?? 2.0)

  const mappings: AlignedKeyframeMapping[] = []

  // Anchor 0: First keyframe always locks to first candidate beat (0.0)
  const firstKf = keyframes[0]
  mappings.push({
    keyframeIndex: 0,
    frameIndex: firstKf.frameIndex,
    originalTimeSeconds: firstKf.timeSeconds,
    targetBeatSeconds: candidateBeats[0] ?? 0.0,
    poseType: firstKf.poseType,
    salienceScore: firstKf.salienceScore,
    warpRatio: 1.0,
  })

  // Align intermediate and closing keyframes
  let lastBeatIdx = 0

  for (let k = 1; k < keyframes.length; k++) {
    const kf = keyframes[k]
    const prevMapping = mappings[k - 1]
    const sourceDelta = Math.max(0.001, kf.timeSeconds - prevMapping.originalTimeSeconds)

    // Projected ideal time on beat scale
    const progressRatio = kf.timeSeconds / totalMotionDuration
    const projectedTargetSec = candidateBeats[candidateBeats.length - 1] * progressRatio

    // Find best candidate beat strictly ahead of lastBeatIdx
    let bestBeatIdx = lastBeatIdx + 1
    let bestScoreDiff = Infinity

    for (let b = lastBeatIdx + 1; b < candidateBeats.length; b++) {
      const beatSec = candidateBeats[b]
      const targetDelta = beatSec - prevMapping.targetBeatSeconds
      const localRatio = targetDelta / sourceDelta

      // Verify warp elasticity constraints
      if (localRatio < minWarpRatio || localRatio > maxWarpRatio) {
        continue
      }

      const diff = Math.abs(beatSec - projectedTargetSec)
      if (diff < bestScoreDiff) {
        bestScoreDiff = diff
        bestBeatIdx = b
      }
    }

    // Fallback if no candidate satisfies elasticity: choose immediate next beat or extrapolate
    let targetBeatSec: number
    if (bestBeatIdx < candidateBeats.length && bestScoreDiff < Infinity) {
      targetBeatSec = candidateBeats[bestBeatIdx]
      lastBeatIdx = bestBeatIdx
    }
    else {
      // Elastic clamp: maintain min/max warp ratio
      const naturalDelta = sourceDelta
      const clampedDelta = Math.max(
        naturalDelta * minWarpRatio,
        Math.min(naturalDelta * maxWarpRatio, candidateBeats[lastBeatIdx + 1] ? candidateBeats[lastBeatIdx + 1] - prevMapping.targetBeatSeconds : naturalDelta),
      )
      targetBeatSec = prevMapping.targetBeatSeconds + clampedDelta
      lastBeatIdx++
    }

    const finalRatio = (targetBeatSec - prevMapping.targetBeatSeconds) / sourceDelta

    mappings.push({
      keyframeIndex: k,
      frameIndex: kf.frameIndex,
      originalTimeSeconds: kf.timeSeconds,
      targetBeatSeconds: targetBeatSec,
      poseType: kf.poseType,
      salienceScore: kf.salienceScore,
      warpRatio: Number(finalRatio.toFixed(3)),
    })
  }

  // Calculate aggregate metrics
  const warpRatios = mappings.slice(1).map(m => m.warpRatio)
  const averageWarpRatio = warpRatios.length > 0
    ? warpRatios.reduce((acc, r) => acc + r, 0) / warpRatios.length
    : 1.0

  const minRatio = warpRatios.length > 0 ? Math.min(...warpRatios) : 1.0
  const maxRatio = warpRatios.length > 0 ? Math.max(...warpRatios) : 1.0
  const totalDurationSeconds = mappings[mappings.length - 1].targetBeatSeconds

  return {
    mappings,
    totalDurationSeconds: Number(totalDurationSeconds.toFixed(3)),
    averageWarpRatio: Number(averageWarpRatio.toFixed(3)),
    warpRange: [Number(minRatio.toFixed(3)), Number(maxRatio.toFixed(3))],
  }
}
