import type { Quat, Vec3 } from './math.js'

import { quatSlerp, vec3Lerp } from './math.js'

export interface SeamSmoothingOptions {
  /**
   * Number of frames over which to blend back to Frame 0.
   * Default: 10 frames (~0.5s at 20fps).
   * Clamped to [3, Math.floor(seqLen / 3)].
   */
  seamFrames?: number
}

export interface SkeletalAnimationTracks {
  rootTranslations: Vec3[]
  rootRotations: Quat[]
  localRotations?: Record<string | number, Quat[]>
}

/**
 * Applies Hermite S-curve blending (3u^2 - 2u^3) over the tail frames of a motion sequence,
 * smoothly transitioning bone rotations (quatSlerp) and root translation (vec3Lerp) back to
 * Frame 0's pose.
 *
 * This closes the boundary loop condition, turning linear diffusion clips into seamless
 * periodic animations without instantaneous velocity spikes or pose jumps on wrap-around.
 */
export function applyHermiteSeamSmoothing<T extends SkeletalAnimationTracks>(
  tracks: T,
  options?: SeamSmoothingOptions,
): T {
  const seqLen = tracks.rootRotations.length
  if (seqLen < 6)
    return tracks

  const maxSeam = Math.floor(seqLen / 3)
  const seamFrames = Math.max(3, Math.min(options?.seamFrames ?? 10, maxSeam))
  const startFrame = seqLen - seamFrames

  const initialTrans = tracks.rootTranslations[0]
  const initialRot = tracks.rootRotations[0]

  for (let i = 0; i < seamFrames; i++) {
    const t = startFrame + i
    // Progress u in (0, 1]
    const u = (i + 1) / seamFrames
    // Hermite smoothstep S-curve: 3u^2 - 2u^3
    const alpha = 3 * u * u - 2 * u * u * u

    if (tracks.rootTranslations && tracks.rootTranslations[t] && initialTrans) {
      tracks.rootTranslations[t] = vec3Lerp(tracks.rootTranslations[t], initialTrans, alpha)
    }

    if (tracks.rootRotations && tracks.rootRotations[t] && initialRot) {
      tracks.rootRotations[t] = quatSlerp(tracks.rootRotations[t], initialRot, alpha)
    }

    if (tracks.localRotations) {
      for (const key of Object.keys(tracks.localRotations)) {
        const jointTrack = tracks.localRotations[key]
        if (jointTrack && jointTrack.length === seqLen && jointTrack[0] && jointTrack[t]) {
          jointTrack[t] = quatSlerp(jointTrack[t], jointTrack[0], alpha)
        }
      }
    }
  }

  return tracks
}
