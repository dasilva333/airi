import type { Quat, Vec3 } from '../src/index.js'

import { describe, expect, it } from 'vitest'

import { applyHermiteSeamSmoothing } from '../src/index.js'

describe('motion Choreography - Hermite Seam Smoother', () => {
  it('smooths root translation and rotations to identically match Frame 0 at loop boundary', () => {
    const seqLen = 60
    const rootTranslations: Vec3[] = []
    const rootRotations: Quat[] = []
    const localRotations: Record<string, Quat[]> = {
      spine: [],
      head: [],
    }

    // Generate arbitrary linear motion trajectory (different start and end)
    for (let t = 0; t < seqLen; t++) {
      rootTranslations.push([t * 0.05, 0.95 + t * 0.002, t * 0.03])
      // Rotate around Y as t increases
      const angle = (t / seqLen) * Math.PI // 0 to 180 degrees
      rootRotations.push([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)])

      localRotations.spine.push([Math.sin(t * 0.1), 0, 0, Math.cos(t * 0.1)])
      localRotations.head.push([0, 0, Math.sin(t * 0.05), Math.cos(t * 0.05)])
    }

    // Verify before smoothing: Frame 59 is far from Frame 0
    expect(rootTranslations[59][0]).not.toBeCloseTo(rootTranslations[0][0], 2)
    expect(rootRotations[59][1]).not.toBeCloseTo(rootRotations[0][1], 2)

    // Apply Hermite seam smoothing over the last 10 frames
    const smoothed = applyHermiteSeamSmoothing({
      rootTranslations,
      rootRotations,
      localRotations,
    }, { seamFrames: 10 })

    // Invariants:
    // 1. Frame 0 is preserved
    expect(smoothed.rootTranslations[0][0]).toBeCloseTo(0, 5)
    expect(smoothed.rootRotations[0]).toEqual([0, 0, 0, 1])

    // 2. Frames before seam window (e.g. Frame 40) are untouched
    expect(smoothed.rootTranslations[40][0]).toBeCloseTo(40 * 0.05, 5)

    // 3. Final frame (59) matches Frame 0 identically
    expect(smoothed.rootTranslations[59][0]).toBeCloseTo(smoothed.rootTranslations[0][0], 4)
    expect(smoothed.rootTranslations[59][1]).toBeCloseTo(smoothed.rootTranslations[0][1], 4)
    expect(smoothed.rootTranslations[59][2]).toBeCloseTo(smoothed.rootTranslations[0][2], 4)

    // Rotations match Frame 0
    expect(smoothed.rootRotations[59][1]).toBeCloseTo(smoothed.rootRotations[0][1], 4)
    expect(smoothed.rootRotations[59][3]).toBeCloseTo(smoothed.rootRotations[0][3], 4)

    // Local joint rotations match Frame 0
    expect(smoothed.localRotations!.spine[59][0]).toBeCloseTo(smoothed.localRotations!.spine[0][0], 4)
    expect(smoothed.localRotations!.head[59][2]).toBeCloseTo(smoothed.localRotations!.head[0][2], 4)
  })

  it('clamps seam frames gracefully for short sequences', () => {
    const seqLen = 9
    const rootTranslations: Vec3[] = []
    const rootRotations: Quat[] = []

    for (let t = 0; t < seqLen; t++) {
      rootTranslations.push([t, t, t])
      rootRotations.push([0, 0, 0, 1])
    }

    // Requesting 10 frames on a 9-frame sequence clamps to seqLen/3 = 3 frames
    const smoothed = applyHermiteSeamSmoothing({
      rootTranslations,
      rootRotations,
    }, { seamFrames: 10 })

    expect(smoothed.rootTranslations[8][0]).toBeCloseTo(smoothed.rootTranslations[0][0], 4)
  })

  it('safely handles sequences with fewer than 6 frames', () => {
    const rootTranslations: Vec3[] = [[0, 0, 0], [1, 1, 1]]
    const rootRotations: Quat[] = [[0, 0, 0, 1], [0, 1, 0, 0]]

    const smoothed = applyHermiteSeamSmoothing({
      rootTranslations,
      rootRotations,
    })

    // Unmodified since sequence is too short to seam
    expect(smoothed.rootTranslations[1]).toEqual([1, 1, 1])
  })
})
