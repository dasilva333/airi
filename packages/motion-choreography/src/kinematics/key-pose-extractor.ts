/**
 * DanceSheet Key-Pose Extractor.
 * Analyzes kinematic trajectories (joint velocity minima, extension maxima,
 * and foot-contact impacts) to sample 4–8 expressive anchor key-poses
 * from continuous HumanML3D motion tensors or generic trajectory data.
 */

import type {
  DanceSheet,
  DanceSheetKeyframe,
  KeyPoseExtractionOptions,
  PoseType,
} from '../types.js'
import type { Quat, Vec3 } from './math.js'

import { quatNormalize } from './math.js'

export interface MotionTrajectoryData {
  seqLen: number
  fps?: number
  rootTranslations: Vec3[]
  rootRotations: Quat[]
  /** Joint positions per frame: [frame][joint] = [x, y, z] */
  jointPositions?: Vec3[][]
  /** Joint velocities per frame: [frame][joint] = [vx, vy, vz] */
  jointVelocities?: Vec3[][]
  /** Foot contact flags per frame: [frame] = boolean[] */
  footContacts?: boolean[][]
}

/**
 * Extracts anchor keyframes from generic motion trajectory data.
 */
export function extractKeyPosesFromTrajectories(
  data: MotionTrajectoryData,
  options: KeyPoseExtractionOptions = {},
): DanceSheet {
  const seqLen = data.seqLen
  const fps = options.fps ?? data.fps ?? 20
  const targetCount = options.targetKeyPoseCount ?? 6
  const minInterval = options.minFrameInterval
    ?? Math.max(3, Math.floor(seqLen / (targetCount * 1.6)))

  if (seqLen <= 2) {
    const keyframes: DanceSheetKeyframe[] = []
    for (let t = 0; t < seqLen; t++) {
      keyframes.push({
        frameIndex: t,
        timeSeconds: t / fps,
        salienceScore: 1.0,
        poseType: 'boundary',
        rootTranslation: data.rootTranslations[t] ?? [0, 0, 0],
        rootRotation: data.rootRotations[t] ?? [0, 0, 0, 1],
      })
    }
    return {
      totalFrames: seqLen,
      fps,
      durationSeconds: seqLen / fps,
      targetKeyPoseCount: targetCount,
      keyframes,
    }
  }

  // Step 1: Compute kinetic velocity and extension signals per frame
  const velocities = new Float32Array(seqLen)
  const extensions = new Float32Array(seqLen)
  const contactTransitions = new Uint8Array(seqLen)

  let minVel = Infinity
  let maxVel = -Infinity
  let minExt = Infinity
  let maxExt = -Infinity

  for (let t = 0; t < seqLen; t++) {
    // Velocity calculation
    let frameVel = 0
    if (data.jointVelocities && data.jointVelocities[t]) {
      const jv = data.jointVelocities[t]
      for (let j = 0; j < jv.length; j++) {
        const v = jv[j]
        frameVel += v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
      }
      frameVel = Math.sqrt(frameVel)
    }
    else if (t > 0 && data.jointPositions && data.jointPositions[t] && data.jointPositions[t - 1]) {
      const cur = data.jointPositions[t]
      const prev = data.jointPositions[t - 1]
      for (let j = 0; j < Math.min(cur.length, prev.length); j++) {
        const dx = cur[j][0] - prev[j][0]
        const dy = cur[j][1] - prev[j][1]
        const dz = cur[j][2] - prev[j][2]
        frameVel += dx * dx + dy * dy + dz * dz
      }
      frameVel = Math.sqrt(frameVel) * fps
    }
    velocities[t] = frameVel
    if (frameVel < minVel)
      minVel = frameVel
    if (frameVel > maxVel)
      maxVel = frameVel

    // Body extension calculation
    let frameExt = 0
    if (data.jointPositions && data.jointPositions[t]) {
      const jp = data.jointPositions[t]
      for (let j = 0; j < jp.length; j++) {
        const p = jp[j]
        frameExt += Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2])
      }
    }
    else {
      // Fallback: root height displacement
      frameExt = Math.abs(data.rootTranslations[t][1])
    }
    extensions[t] = frameExt
    if (frameExt < minExt)
      minExt = frameExt
    if (frameExt > maxExt)
      maxExt = frameExt

    // Contact transition calculation
    if (t > 0 && data.footContacts && data.footContacts[t] && data.footContacts[t - 1]) {
      const curC = data.footContacts[t]
      const prevC = data.footContacts[t - 1]
      let transitions = 0
      for (let c = 0; c < Math.min(curC.length, prevC.length); c++) {
        if (curC[c] !== prevC[c])
          transitions++
      }
      contactTransitions[t] = transitions
    }
  }

  const velRange = maxVel - minVel > 1e-6 ? maxVel - minVel : 1
  const extRange = maxExt - minExt > 1e-6 ? maxExt - minExt : 1

  // Step 2: Score candidate inflection frames
  interface Candidate {
    frame: number
    score: number
    poseType: PoseType
  }

  const candidates: Candidate[] = []

  for (let t = 1; t < seqLen - 1; t++) {
    const isVelMin = velocities[t] <= velocities[t - 1] && velocities[t] < velocities[t + 1]
    const isExtMax = extensions[t] >= extensions[t - 1] && extensions[t] > extensions[t + 1]
    const hasContact = contactTransitions[t] > 0

    const normVelScore = 1.0 - (velocities[t] - minVel) / velRange
    const normExtScore = (extensions[t] - minExt) / extRange

    let poseType: PoseType = 'velocity_minimum'
    let score = 0.5 * normVelScore + 0.35 * normExtScore

    if (isExtMax && normExtScore > 0.6) {
      poseType = 'extension_maximum'
      score += 0.2
    }
    else if (isVelMin) {
      poseType = 'velocity_minimum'
      score += 0.2
    }
    else if (hasContact) {
      poseType = 'foot_strike'
      score += 0.15
    }

    candidates.push({
      frame: t,
      score: Math.min(1.0, Number(score.toFixed(3))),
      poseType,
    })
  }

  // Sort candidates by salience score descending
  candidates.sort((a, b) => b.score - a.score)

  // Step 3: Greedy NMS Selection ensuring temporal distribution
  const selectedIndices = new Set<number>()
  // Always include boundaries for seamless transition/loop anchors
  selectedIndices.add(0)
  selectedIndices.add(seqLen - 1)

  const passes = [minInterval, Math.max(2, Math.floor(minInterval / 2)), 1]

  for (const interval of passes) {
    if (selectedIndices.size >= targetCount)
      break

    for (const cand of candidates) {
      if (selectedIndices.has(cand.frame))
        continue

      let isTooClose = false
      for (const sel of selectedIndices) {
        if (Math.abs(sel - cand.frame) < interval) {
          isTooClose = true
          break
        }
      }

      if (!isTooClose) {
        selectedIndices.add(cand.frame)
        if (selectedIndices.size >= targetCount)
          break
      }
    }
  }

  // Step 4: Construct chronologically sorted DanceSheetKeyframe list
  const sortedFrames = Array.from(selectedIndices).sort((a, b) => a - b)
  const candidateMap = new Map<number, Candidate>()
  for (const c of candidates) candidateMap.set(c.frame, c)

  const keyframes: DanceSheetKeyframe[] = sortedFrames.map((frame) => {
    let poseType: PoseType = 'boundary'
    let salienceScore = 1.0

    if (frame !== 0 && frame !== seqLen - 1) {
      const match = candidateMap.get(frame)
      if (match) {
        poseType = match.poseType
        salienceScore = match.score
      }
    }

    return {
      frameIndex: frame,
      timeSeconds: Number((frame / fps).toFixed(3)),
      salienceScore,
      poseType,
      rootTranslation: data.rootTranslations[frame],
      rootRotation: quatNormalize(data.rootRotations[frame]),
    }
  })

  return {
    totalFrames: seqLen,
    fps,
    durationSeconds: Number((seqLen / fps).toFixed(2)),
    targetKeyPoseCount: targetCount,
    keyframes,
  }
}

/**
 * Extracts anchor keyframes directly from a 263-dimensional HumanML3D motion tensor.
 * Can accept either feature-major [263, seqLen] or frame-major [seqLen, 263] Float32Array.
 */
export function extractKeyPosesFromHumanML3D(
  motionFeatures: Float32Array,
  seqLen: number,
  options: KeyPoseExtractionOptions = {},
): DanceSheet {
  if (motionFeatures.length < seqLen * 263) {
    throw new Error(
      `Invalid HumanML3D feature tensor length: expected at least ${seqLen * 263}, received ${motionFeatures.length}`,
    )
  }

  // Determine if tensor is feature-major [263, seqLen] or frame-major [seqLen, 263]
  // In ONNX output from FlowMDM, tensor is feature-major: index = channel * seqLen + frame
  const isFeatureMajor = options.decodeJointRotations !== false
    && motionFeatures.length === seqLen * 263
    // Heuristic: channel 3 (root height) should have consistent positive values
    && motionFeatures[3 * seqLen] > 0.05

  // Transpose to frame-major [seqLen, 263] if feature-major
  const frameMajor = new Float32Array(seqLen * 263)
  if (isFeatureMajor) {
    for (let t = 0; t < seqLen; t++) {
      for (let c = 0; c < 263; c++) {
        frameMajor[t * 263 + c] = motionFeatures[c * seqLen + t]
      }
    }
  }
  else {
    frameMajor.set(motionFeatures.subarray(0, seqLen * 263))
  }

  // Decode root trajectories and joint data
  let ang = 0.0
  let currentPosX = 0.0
  let currentPosZ = 0.0

  const rootRotations: Quat[] = []
  const rootTranslations: Vec3[] = []
  const jointPositions: Vec3[][] = []
  const jointVelocities: Vec3[][] = []
  const footContacts: boolean[][] = []

  for (let t = 0; t < seqLen; t++) {
    const frameStart = t * 263
    const prevFrameStart = (t - 1) * 263

    if (t > 0) {
      ang += frameMajor[prevFrameStart + 0]
      const yaw = 2.0 * ang
      const vx = frameMajor[prevFrameStart + 1]
      const vz = frameMajor[prevFrameStart + 2]
      currentPosX += vx * Math.cos(yaw) - vz * Math.sin(yaw)
      currentPosZ += vx * Math.sin(yaw) + vz * Math.cos(yaw)
    }

    const height = frameMajor[frameStart + 3]
    rootTranslations.push([currentPosX, height, currentPosZ])
    rootRotations.push([0.0, -Math.sin(ang), 0.0, Math.cos(ang)])

    // 21 joint positions relative to root (channels 4-66)
    const jPos: Vec3[] = []
    for (let j = 0; j < 21; j++) {
      const idx = frameStart + 4 + j * 3
      jPos.push([frameMajor[idx], frameMajor[idx + 1], frameMajor[idx + 2]])
    }
    jointPositions.push(jPos)

    // 22 joint linear velocities (channels 193-258)
    const jVel: Vec3[] = []
    for (let j = 0; j < 22; j++) {
      const idx = frameStart + 193 + j * 3
      jVel.push([frameMajor[idx], frameMajor[idx + 1], frameMajor[idx + 2]])
    }
    jointVelocities.push(jVel)

    // 4 foot contacts (channels 259-262)
    const contacts: boolean[] = [
      frameMajor[frameStart + 259] > 0.5,
      frameMajor[frameStart + 260] > 0.5,
      frameMajor[frameStart + 261] > 0.5,
      frameMajor[frameStart + 262] > 0.5,
    ]
    footContacts.push(contacts)
  }

  const trajectoryData: MotionTrajectoryData = {
    seqLen,
    fps: options.fps ?? 20,
    rootTranslations,
    rootRotations,
    jointPositions,
    jointVelocities,
    footContacts,
  }

  return extractKeyPosesFromTrajectories(trajectoryData, options)
}
