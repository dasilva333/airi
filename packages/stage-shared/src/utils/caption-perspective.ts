/**
 * Pure pose → 2D caption-transform math for the head-tethered caption plank.
 *
 * This is a clean-room re-derivation of the fake-perspective skew used to give
 * a 2D element a "vetted-to-the-head" illusion. Each model renderer (Live2D,
 * Spine, VRM, MMD) fills a `PoseSnapshot` from its own runtime and calls the
 * same `poseToCaptionTransform` so the math is single-sourced.
 *
 * Positions/units:
 * - All angle-like inputs are clamped to [-1, 1] by PoseSnapshot producers.
 * - All outputs are raw PIXI numbers (no trailing units); the consumer
 *   decides whether to feed them into `transform: translate(...) skew(...)`,
 *   `sprite.skew.set()`, or a 3D `CSS3DObject`.
 */

export interface PoseSnapshot {
  /** Head yaw (left/right), clamped to [-1, 1] by the adapter. */
  yaw: number
  /** Head pitch (up/down), clamped to [-1, 1] by the adapter. */
  pitch: number
  /** Head roll (tilt), clamped to [-1, 1] by the adapter. */
  roll: number
}

export interface AnchorPoint {
  /** Stage-space anchor X (px). */
  x: number
  /** Stage-space anchor Y (px). */
  y: number
}

export interface CaptionTransform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  /** Radians, suitable for `rotate(...)` or `sprite.rotation = ...`. */
  rotation: number
  /** 0..1, suitable for `sprite.alpha = ...` or CSS `opacity:`. */
  opacity: number
}

export interface PoseToCaptionOptions {
  /** 0..100. `0` disables perspective (plank is glued flat to the head). */
  strength: number
  /** Pixel offset applied *after* the anchor. */
  offsetX: number
  offsetY: number
  /** Multiplier that scales the entire squash/skew response. Defaults to 1. */
  perspectiveScale?: number
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value))
    return 0
  return Math.min(1, Math.max(-1, value))
}

/**
 * Compute the per-frame plank transform from the pose snapshot and anchor.
 *
 * Shape of the perspective illusion:
 * - When the head turns (|yaw| grows), the plank is squashed on X (`scaleX < 1`)
 *   and sheared on X (positive `skewX`). The shear-and-squash pair is what our
 *   eye reads as "this 2D thing rotated away from us in 3D."
 * - When the head tips up/down (|pitch| grows), the plank grows slightly on Y
 *   and counter-shears on Y — a subtler vertical cue.
 * - Roll maps directly to rotation, clamped to a calm ±0.5 rad ≈ ±28.6°.
 */
export function poseToCaptionTransform(
  pose: PoseSnapshot,
  anchor: AnchorPoint,
  opts: PoseToCaptionOptions,
): CaptionTransform {
  const strength01 = Math.min(1, Math.max(0, (opts.strength ?? 100) / 100))
  const perspective = strength01 * (opts.perspectiveScale ?? 1)

  const x = clampUnit(pose.yaw)
  const y = clampUnit(pose.pitch)
  const roll = clampUnit(pose.roll)

  // When strength is 0, the transform collapses to "anchor + offset, no skew".
  if (perspective <= 0) {
    return {
      x: anchor.x + opts.offsetX,
      y: anchor.y + opts.offsetY,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      rotation: 0,
      opacity: 1,
    }
  }

  const flatten = Math.abs(x) * 0.18 * perspective
  const scaleX = 1 - flatten
  const scaleY = 1 + Math.abs(y) * 0.04 * perspective
  const skewX = x * 0.10 * perspective
  const skewY = -y * 0.04 * perspective
  const rotation = roll * 0.35 * perspective

  return {
    x: anchor.x + opts.offsetX,
    y: anchor.y + opts.offsetY,
    scaleX,
    scaleY,
    skewX,
    skewY,
    rotation,
    opacity: 1,
  }
}
