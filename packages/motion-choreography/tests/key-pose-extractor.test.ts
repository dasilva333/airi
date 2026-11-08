import { describe, expect, it } from 'vitest'

import {
  extractKeyPosesFromHumanML3D,
  extractKeyPosesFromTrajectories,
  quatMultiply,
  quatNormalize,
  quatSlerp,
} from '../src/index.js'
import { generateSyntheticSwayMotion } from './synthetic-motion.js'

describe('motion Choreography - Key-Pose Extractor', () => {
  describe('quaternion Math & Slerp', () => {
    it('normalizes quaternions accurately', () => {
      const q = quatNormalize([0, 2, 0, 0])
      expect(q[0]).toBe(0)
      expect(q[1]).toBe(1)
      expect(q[2]).toBe(0)
      expect(q[3]).toBe(0)
    })

    it('interpolates smoothly via slerp', () => {
      const qA: [number, number, number, number] = [0, 0, 0, 1] // identity
      const qB: [number, number, number, number] = [0, Math.SQRT1_2, 0, Math.SQRT1_2] // 90 deg around Y

      const half = quatSlerp(qA, qB, 0.5)
      // At t=0.5, rotation should be 45 deg around Y: sin(22.5 deg) ~ 0.38268, cos(22.5 deg) ~ 0.92388
      expect(half[1]).toBeCloseTo(0.38268, 3)
      expect(half[3]).toBeCloseTo(0.92388, 3)
    })

    it('multiplies rotations correctly', () => {
      const q = quatMultiply([0, 0, 0, 1], [0, 1, 0, 0])
      expect(q).toEqual([0, 1, 0, 0])
    })
  })

  describe('extractKeyPosesFromTrajectories', () => {
    it('extracts target keyframes and always anchors start and end frames', () => {
      const seqLen = 60
      const rootTranslations: [number, number, number][] = []
      const rootRotations: [number, number, number, number][] = []
      const jointPositions: [number, number, number][][] = []

      for (let t = 0; t < seqLen; t++) {
        rootTranslations.push([0, 0.9 + 0.1 * Math.sin(t / 5), 0])
        rootRotations.push([0, 0, 0, 1])
        jointPositions.push([
          [Math.sin(t / 4), 0, 0],
          [0, Math.cos(t / 4), 0],
        ])
      }

      const sheet = extractKeyPosesFromTrajectories(
        {
          seqLen,
          fps: 20,
          rootTranslations,
          rootRotations,
          jointPositions,
        },
        { targetKeyPoseCount: 6, minFrameInterval: 6 },
      )

      expect(sheet.totalFrames).toBe(seqLen)
      expect(sheet.fps).toBe(20)
      expect(sheet.durationSeconds).toBe(3.0)
      expect(sheet.keyframes.length).toBeGreaterThanOrEqual(4)
      expect(sheet.keyframes.length).toBeLessThanOrEqual(6)

      // Always anchors boundary frames
      expect(sheet.keyframes[0].frameIndex).toBe(0)
      expect(sheet.keyframes[0].poseType).toBe('boundary')
      expect(sheet.keyframes[sheet.keyframes.length - 1].frameIndex).toBe(seqLen - 1)
      expect(sheet.keyframes[sheet.keyframes.length - 1].poseType).toBe('boundary')

      // Keyframes must be chronologically ordered
      for (let i = 1; i < sheet.keyframes.length; i++) {
        expect(sheet.keyframes[i].frameIndex).toBeGreaterThan(sheet.keyframes[i - 1].frameIndex)
        expect(sheet.keyframes[i].timeSeconds).toBeGreaterThan(sheet.keyframes[i - 1].timeSeconds)
      }
    })
  })

  describe('extractKeyPosesFromHumanML3D', () => {
    it('samples anchor keyframes from synthetic HumanML3D motion at inflection points', () => {
      const motion = generateSyntheticSwayMotion(60, 20)
      const sheet = extractKeyPosesFromHumanML3D(motion.features, motion.seqLen, {
        targetKeyPoseCount: 6,
        minFrameInterval: 5,
      })

      expect(sheet.keyframes.length).toBeGreaterThanOrEqual(4)
      expect(sheet.keyframes[0].frameIndex).toBe(0)
      expect(sheet.keyframes[sheet.keyframes.length - 1].frameIndex).toBe(59)

      // Interior keyframes should detect kinetic turning points (velocity minima or extension maxima)
      const interior = sheet.keyframes.slice(1, -1)
      expect(interior.length).toBeGreaterThan(0)
      for (const kf of interior) {
        expect(['velocity_minimum', 'extension_maximum', 'foot_strike']).toContain(kf.poseType)
        expect(kf.salienceScore).toBeGreaterThan(0)
        expect(kf.rootTranslation[1]).toBeGreaterThan(0.8) // Root height
      }
    })

    it('rejects tensors with insufficient length', () => {
      const short = new Float32Array(50)
      expect(() => extractKeyPosesFromHumanML3D(short, 10)).toThrow('Invalid HumanML3D feature tensor length')
    })
  })
})
