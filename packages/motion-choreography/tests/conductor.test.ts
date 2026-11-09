import type { DanceSheet } from '../src/types.js'

import { describe, expect, it } from 'vitest'

import {
  alignDanceSheetToBeats,
  evaluateWarpedPoseAt,
  selectCandidateBeats,
  shapePhase,
} from '../src/conductor/index.js'

describe('the Conductor - Beat Alignment & Elastic Time-Warping', () => {
  const dummyDanceSheet: DanceSheet = {
    totalFrames: 60,
    fps: 20,
    durationSeconds: 3.0,
    targetKeyPoseCount: 4,
    keyframes: [
      {
        frameIndex: 0,
        timeSeconds: 0.0,
        salienceScore: 1.0,
        poseType: 'boundary',
        rootTranslation: [0, 0.9, 0],
        rootRotation: [0, 0, 0, 1],
        jointRotations: {
          RightArm: [0, 0, 0, 1],
          LeftArm: [0, 0, 0, 1],
        },
      },
      {
        frameIndex: 20,
        timeSeconds: 1.0,
        salienceScore: 0.85,
        poseType: 'extension_maximum',
        rootTranslation: [0.1, 0.95, 0],
        rootRotation: [0, 0.1, 0, 0.995],
        jointRotations: {
          RightArm: [0.38, 0, 0, 0.92],
          LeftArm: [-0.38, 0, 0, 0.92],
        },
      },
      {
        frameIndex: 40,
        timeSeconds: 2.0,
        salienceScore: 0.78,
        poseType: 'foot_strike',
        rootTranslation: [-0.1, 0.88, 0],
        rootRotation: [0, -0.1, 0, 0.995],
        jointRotations: {
          RightArm: [0.1, 0, 0, 0.99],
          LeftArm: [-0.1, 0, 0, 0.99],
        },
      },
      {
        frameIndex: 59,
        timeSeconds: 2.95,
        salienceScore: 1.0,
        poseType: 'boundary',
        rootTranslation: [0, 0.9, 0],
        rootRotation: [0, 0, 0, 1],
        jointRotations: {
          RightArm: [0, 0, 0, 1],
          LeftArm: [0, 0, 0, 1],
        },
      },
    ],
  }

  describe('candidate Beat Selection', () => {
    // 120 BPM 4/4 beats: 0.5s interval
    const beats44 = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
    // 84 BPM 3/4 waltz beats: ~0.714s interval
    const beatsWaltz = [0.0, 0.714, 1.428, 2.142, 2.856, 3.570]

    it('filters downbeats for 3/4 waltz (every 3rd beat)', () => {
      const downbeats = selectCandidateBeats(beatsWaltz, {
        rhythmStructure: 'waltz_triple',
        cadence: 'adaptive',
      })

      expect(downbeats).toHaveLength(2) // 0.0, 2.142
      expect(downbeats[0]).toBe(0.0)
      expect(downbeats[1]).toBeCloseTo(2.142, 2)
    })

    it('filters downbeats for 4/4 cadence', () => {
      const candidateBeats = selectCandidateBeats(beats44, {
        rhythmStructure: 'four_on_the_floor',
        cadence: 'adaptive',
      })

      // Stride 2 for four_on_the_floor adaptive: 0.0, 1.0, 2.0, 3.0, 4.0
      expect(candidateBeats).toHaveLength(5)
      expect(candidateBeats[1]).toBe(1.0)
      expect(candidateBeats[2]).toBe(2.0)
    })
  })

  describe('beat-to-Keypoint Alignment', () => {
    const beats = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0]

    it('aligns dance keyframes monotonically to beat onsets', () => {
      const alignment = alignDanceSheetToBeats(dummyDanceSheet, beats, {
        cadence: 'all_beats',
      })

      expect(alignment.mappings).toHaveLength(dummyDanceSheet.keyframes.length)
      expect(alignment.mappings[0].targetBeatSeconds).toBe(0.0)

      // Strictly increasing timestamps
      for (let i = 1; i < alignment.mappings.length; i++) {
        expect(alignment.mappings[i].targetBeatSeconds).toBeGreaterThan(
          alignment.mappings[i - 1].targetBeatSeconds,
        )
      }

      // Check warp metrics
      expect(alignment.averageWarpRatio).toBeGreaterThan(0.5)
      expect(alignment.averageWarpRatio).toBeLessThan(2.0)
      expect(alignment.totalDurationSeconds).toBeGreaterThan(2.0)
    })

    it('enforces min and max elastic warp constraints', () => {
      // Extremely compressed beats (0.1s interval)
      const compressedBeats = [0.0, 0.1, 0.2, 0.3, 0.4]
      const alignment = alignDanceSheetToBeats(dummyDanceSheet, compressedBeats, {
        minWarpRatio: 0.5,
        maxWarpRatio: 2.0,
      })

      for (let i = 1; i < alignment.mappings.length; i++) {
        expect(alignment.mappings[i].warpRatio).toBeGreaterThanOrEqual(0.49)
      }
    })
  })

  describe('non-linear Phase Shaping', () => {
    it('anchors endpoints at 0.0 and 1.0 across all easings', () => {
      const easings = ['linear', 'smooth_step', 'cubic_elastic'] as const
      for (const e of easings) {
        expect(shapePhase(0.0, e)).toBe(0.0)
        expect(shapePhase(1.0, e)).toBe(1.0)
      }
    })

    it('applies S-curve deceleration and acceleration in smooth_step', () => {
      // At midpoint progress 0.5, smooth_step is symmetric 0.5
      expect(shapePhase(0.5, 'smooth_step')).toBeCloseTo(0.5, 3)
      // At quarter progress 0.25, S-curve is decelerated (< 0.25)
      expect(shapePhase(0.25, 'smooth_step')).toBeLessThan(0.25)
      // At three-quarter progress 0.75, S-curve is accelerated (> 0.75)
      expect(shapePhase(0.75, 'smooth_step')).toBeGreaterThan(0.75)
    })
  })

  describe('warped Pose Evaluator', () => {
    it('evaluates exact keyframe poses at target anchor timestamps', () => {
      const beats = [0.0, 1.0, 2.0, 3.0]
      const alignment = alignDanceSheetToBeats(dummyDanceSheet, beats, {
        cadence: 'all_beats',
      })

      // Evaluate at t = 0.0 (Keyframe 0)
      const pose0 = evaluateWarpedPoseAt(0.0, dummyDanceSheet, alignment.mappings)
      expect(pose0.rootTranslation[0]).toBeCloseTo(0, 3)
      expect(pose0.rootTranslation[1]).toBeCloseTo(0.9, 3)
      expect(pose0.activeKeyframeIndex).toBe(0)

      // Evaluate at target time of Keyframe 1
      const kf1Target = alignment.mappings[1].targetBeatSeconds
      const pose1 = evaluateWarpedPoseAt(kf1Target, dummyDanceSheet, alignment.mappings)
      expect(pose1.rootTranslation[0]).toBeCloseTo(0.1, 2)
      expect(pose1.rootTranslation[1]).toBeCloseTo(0.95, 2)
    })

    it('interpolates smoothly between keyframes with slerp and lerp', () => {
      const beats = [0.0, 1.0, 2.0, 3.0]
      const alignment = alignDanceSheetToBeats(dummyDanceSheet, beats, {
        cadence: 'all_beats',
      })

      // Evaluate halfway between Keyframe 0 and Keyframe 1
      const midTime = (alignment.mappings[0].targetBeatSeconds + alignment.mappings[1].targetBeatSeconds) / 2
      const midPose = evaluateWarpedPoseAt(midTime, dummyDanceSheet, alignment.mappings, {
        easing: 'linear',
      })

      // Root translation X should be halfway between 0.0 and 0.1
      expect(midPose.rootTranslation[0]).toBeCloseTo(0.05, 2)
      // Joint rotations should be present and valid quaternions
      expect(midPose.jointRotations.RightArm).toBeDefined()
      const [x, y, z, w] = midPose.jointRotations.RightArm
      const quatLen = Math.sqrt(x * x + y * y + z * z + w * w)
      expect(quatLen).toBeCloseTo(1.0, 3)
    })

    it('crossfades seamlessly at loop boundaries when looping is enabled', () => {
      const beats = [0.0, 1.0, 2.0, 3.0]
      const alignment = alignDanceSheetToBeats(dummyDanceSheet, beats)
      const totalDur = alignment.totalDurationSeconds

      // Query just before loop wrap (within crossfade window)
      const nearWrapPose = evaluateWarpedPoseAt(totalDur - 0.05, dummyDanceSheet, alignment.mappings, {
        loop: true,
        crossfadeWindowSec: 0.1,
      })

      expect(nearWrapPose).toBeDefined()
      expect(nearWrapPose.rootTranslation).toBeDefined()
      // Should blend back toward start pose root translation [0, 0.9, 0]
      expect(nearWrapPose.rootTranslation[1]).toBeCloseTo(0.9, 1)
    })
  })
})
