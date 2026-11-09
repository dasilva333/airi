/**
 * Elastic Time-Warper ("The Conductor").
 * Evaluates beat-synchronized 3D humanoid poses at any playback timestamp
 * using non-linear phase shaping, quaternion SLERP, and vector LERP.
 */

import type {
  AlignedKeyframeMapping,
  DanceSheet,
  WarpedPoseFrame,
} from '../types.js'

import { quatSlerp, vec3Lerp } from '../kinematics/math.js'

export type EasingFunction = 'linear' | 'smooth_step' | 'cubic_elastic'

/**
 * Computes non-linear phase progress between 0.0 and 1.0.
 */
export function shapePhase(progress: number, easing: EasingFunction = 'smooth_step'): number {
  const p = Math.max(0, Math.min(1, progress))

  switch (easing) {
    case 'linear':
      return p
    case 'smooth_step':
      // Smooth Hermite interpolation (zero 1st derivative at endpoints)
      return p * p * (3 - 2 * p)
    case 'cubic_elastic':
      // Accelerates through the traveling phase, snapping crisply into beat apex
      return p < 0.5
        ? 4 * p * p * p
        : 1 - (-2 * p + 2) ** 3 / 2
  }
}

export interface WarperOptions {
  easing?: EasingFunction
  loop?: boolean
  crossfadeWindowSec?: number
}

/**
 * Evaluates the warped 3D pose at a specific playback second.
 */
export function evaluateWarpedPoseAt(
  playbackSeconds: number,
  danceSheet: DanceSheet,
  mappings: AlignedKeyframeMapping[],
  options: WarperOptions = {},
): WarpedPoseFrame {
  const {
    easing = 'smooth_step',
    loop = false,
    crossfadeWindowSec = 0.2,
  } = options

  const keyframes = danceSheet.keyframes

  if (mappings.length === 0 || keyframes.length === 0) {
    return {
      timeSeconds: playbackSeconds,
      rootTranslation: [0, 0.9, 0],
      rootRotation: [0, 0, 0, 1],
      jointRotations: {},
      activeKeyframeIndex: 0,
      precedingKeyframeIndex: 0,
      succeedingKeyframeIndex: 0,
      phaseProgress: 0,
    }
  }

  const totalDuration = mappings[mappings.length - 1].targetBeatSeconds

  // Handle looping
  let t = playbackSeconds
  if (loop && totalDuration > 0) {
    t = playbackSeconds % totalDuration
  }

  // Clamping at ends
  if (t <= mappings[0].targetBeatSeconds) {
    const kf0 = keyframes[mappings[0].keyframeIndex]
    return {
      timeSeconds: t,
      rootTranslation: [...kf0.rootTranslation],
      rootRotation: [...kf0.rootRotation],
      jointRotations: { ...kf0.jointRotations },
      activeKeyframeIndex: 0,
      precedingKeyframeIndex: 0,
      succeedingKeyframeIndex: 0,
      phaseProgress: 0,
    }
  }

  if (t >= totalDuration) {
    const lastM = mappings[mappings.length - 1]
    const lastKf = keyframes[lastM.keyframeIndex]
    return {
      timeSeconds: t,
      rootTranslation: [...lastKf.rootTranslation],
      rootRotation: [...lastKf.rootRotation],
      jointRotations: { ...lastKf.jointRotations },
      activeKeyframeIndex: lastM.keyframeIndex,
      precedingKeyframeIndex: lastM.keyframeIndex,
      succeedingKeyframeIndex: lastM.keyframeIndex,
      phaseProgress: 1.0,
    }
  }

  // Find active segment [i, i + 1]
  let segIdx = 0
  for (let i = 0; i < mappings.length - 1; i++) {
    if (t >= mappings[i].targetBeatSeconds && t <= mappings[i + 1].targetBeatSeconds) {
      segIdx = i
      break
    }
  }

  const mapA = mappings[segIdx]
  const mapB = mappings[segIdx + 1]
  const kfA = keyframes[mapA.keyframeIndex]
  const kfB = keyframes[mapB.keyframeIndex]

  const segDuration = Math.max(0.0001, mapB.targetBeatSeconds - mapA.targetBeatSeconds)
  const rawProgress = (t - mapA.targetBeatSeconds) / segDuration
  const shaped = shapePhase(rawProgress, easing)

  // Interpolate root translation and rotation
  const rootTranslation = vec3Lerp(kfA.rootTranslation, kfB.rootTranslation, shaped)
  const rootRotation = quatSlerp(kfA.rootRotation, kfB.rootRotation, shaped)

  // Interpolate joint rotations
  const jointRotations: Record<string, [number, number, number, number]> = {}
  const jointsA = kfA.jointRotations || {}
  const jointsB = kfB.jointRotations || {}
  const allJointKeys = new Set([...Object.keys(jointsA), ...Object.keys(jointsB)])

  for (const jKey of allJointKeys) {
    const qA = jointsA[jKey] || [0, 0, 0, 1]
    const qB = jointsB[jKey] || [0, 0, 0, 1]
    jointRotations[jKey] = quatSlerp(qA, qB, shaped)
  }

  // Seamless loop crossfade at boundary
  if (loop && crossfadeWindowSec > 0 && t > totalDuration - crossfadeWindowSec) {
    const fadeProgress = (t - (totalDuration - crossfadeWindowSec)) / crossfadeWindowSec
    const fadeShaped = shapePhase(fadeProgress, 'smooth_step')
    const kfStart = keyframes[mappings[0].keyframeIndex]

    const blendedRootTrans = vec3Lerp(rootTranslation, kfStart.rootTranslation, fadeShaped)
    const blendedRootRot = quatSlerp(rootRotation, kfStart.rootRotation, fadeShaped)

    const startJoints = kfStart.jointRotations || {}
    for (const jKey of Object.keys(startJoints)) {
      if (jointRotations[jKey]) {
        jointRotations[jKey] = quatSlerp(jointRotations[jKey], startJoints[jKey], fadeShaped)
      }
    }

    return {
      timeSeconds: t,
      rootTranslation: blendedRootTrans,
      rootRotation: blendedRootRot,
      jointRotations,
      activeKeyframeIndex: rawProgress >= 0.5 ? mapB.keyframeIndex : mapA.keyframeIndex,
      precedingKeyframeIndex: mapA.keyframeIndex,
      succeedingKeyframeIndex: mapB.keyframeIndex,
      phaseProgress: rawProgress,
    }
  }

  return {
    timeSeconds: t,
    rootTranslation,
    rootRotation,
    jointRotations,
    activeKeyframeIndex: rawProgress >= 0.5 ? mapB.keyframeIndex : mapA.keyframeIndex,
    precedingKeyframeIndex: mapA.keyframeIndex,
    succeedingKeyframeIndex: mapB.keyframeIndex,
    phaseProgress: rawProgress,
  }
}
