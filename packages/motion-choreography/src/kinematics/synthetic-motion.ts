/**
 * Deterministic synthetic HumanML3D motion generator for offline unit testing
 * and real-time kinematic previews in the Motion Choreography Studio.
 * Synthesizes 263-dimensional motion tensors with known inflection points (pauses and apexes).
 */

export interface SyntheticMotionSpec {
  seqLen: number
  /** Expected frame indices where kinetic pauses / velocity minima occur */
  expectedPauseFrames: number[]
  features: Float32Array
}

/**
 * Generates a synthetic dancing sway motion of seqLen frames.
 * The body sways left-to-right periodically with velocity dropping to 0 at the turning apexes.
 */
export function generateSyntheticSwayMotion(
  seqLen = 60,
  periodFrames = 20,
): SyntheticMotionSpec {
  const features = new Float32Array(seqLen * 263)
  const expectedPauseFrames: number[] = []

  for (let t = 0; t < seqLen; t++) {
    const frameStart = t * 263
    const phase = (2 * Math.PI * t) / periodFrames

    // Root height (channel 3)
    features[frameStart + 3] = 0.95 + 0.05 * Math.sin(phase * 2)

    // Sway displacement for joints (channels 4-66)
    const swayX = 0.25 * Math.sin(phase)
    const velX = (0.25 * ((2 * Math.PI) / periodFrames)) * Math.cos(phase)

    // Mark turning points where velocity crosses zero
    const isApex = t > 0 && t < seqLen - 1
      && Math.abs(Math.cos(phase)) < 0.15
      && Math.abs(Math.sin(phase)) > 0.85
    if (isApex) {
      expectedPauseFrames.push(t)
    }

    // Set 21 joint positions relative to root (channels 4-66)
    for (let j = 0; j < 21; j++) {
      const idx = frameStart + 4 + j * 3
      features[idx + 0] = swayX * (1.0 + j * 0.05) // x
      features[idx + 1] = 0.1 * j // y
      features[idx + 2] = 0.0 // z
    }

    // Set 22 joint linear velocities (channels 193-258)
    for (let j = 0; j < 22; j++) {
      const idx = frameStart + 193 + j * 3
      features[idx + 0] = velX * (1.0 + j * 0.05)
      features[idx + 1] = 0.0
      features[idx + 2] = 0.0
    }

    // Set foot contacts (channels 259-262)
    features[frameStart + 259] = swayX > 0 ? 1.0 : 0.0
    features[frameStart + 260] = swayX < 0 ? 1.0 : 0.0
  }

  return {
    seqLen,
    expectedPauseFrames,
    features,
  }
}
