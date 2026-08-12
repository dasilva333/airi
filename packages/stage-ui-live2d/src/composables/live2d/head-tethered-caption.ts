/**
 * Live2D head-tethered caption adapter.
 *
 * Reads pose parameters from the Cubism `coreModel` (with ID aliases for
 * runtime compatibility), resolves a stage-space anchor point above the head,
 * and applies the resulting transform to a consumer-supplied PIXI container.
 *
 * The adapter is pose-source only. It does not own the plank's rendering or
 * the BroadcastChannel consumer — those live in
 * `@proj-airi/stage-ui/components/scenes/HeadTetheredCaption.vue`.
 */

import type { Application, Container } from '@pixi/app'

// NOTICE: Live2D runtime parameter IDs differ across model authors and
// Cubism versions. List most-common aliases in priority order; first match
// wins at resolution time.
const PARAM_ID_ALIASES = {
  yaw: ['ParamAngleX', 'PARAM_ANGLE_X', 'ParamHeadAngleX', 'HeadAngleX', 'FaceAngleX', 'AngleX'],
  pitch: ['ParamAngleY', 'PARAM_ANGLE_Y', 'ParamHeadAngleY', 'HeadAngleY', 'FaceAngleY', 'AngleY'],
  roll: ['ParamAngleZ', 'PARAM_ANGLE_Z', 'ParamHeadAngleZ', 'HeadAngleZ', 'FaceAngleZ', 'AngleZ'],
} as const

// Fallback fraction of the model's bounding box where the head's centre is
// expected when no tagged head drawable can be located. Same convention as
// the Live2D accessory ecosystem.
const FALLBACK_HEAD_ANCHOR = { x: 0.5, y: 0.18 } as const

// The natural range of Live2D angle parameters is roughly ±30 (radians-like
// units). We clamp the normalised yaw/pitch/roll into [-1, 1] downstream.
const PARAM_RANGE = 30

export interface Live2DHeadTetheredCaptionAnchorResult {
  /** Stage-space pixel coordinate of the head anchor. */
  x: number
  y: number
  /** True if a tagged head drawable was found; false if using fallback. */
  isResolvedFromDrawables: boolean
}

function normalizeParamId(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readCoreModelParamValue(coreModel: any, aliases: readonly string[]): number {
  if (!coreModel)
    return 0

  // Index-based lookup first (cheapest, id-stable across the model's life).
  const count = Number(coreModel.getParameterCount?.())
  if (Number.isInteger(count) && count > 0) {
    for (let i = 0; i < count; i += 1) {
      const id = normalizeParamId(coreModel.getParameterId?.(i))
      for (const alias of aliases) {
        if (normalizeParamId(alias) === id) {
          const value = Number(coreModel.getParameterValueByIndex?.(i))
          if (Number.isFinite(value))
            return value
        }
      }
    }
  }

  // Fallback: direct by-ID reader.
  for (const alias of aliases) {
    try {
      const value = Number(coreModel.getParameterValueById?.(alias))
      if (Number.isFinite(value))
        return value
    }
    catch {
      // Try the next alias.
    }
  }
  return 0
}

function findHeadAnchorPoint(model: any): Live2DHeadTetheredCaptionAnchorResult | null {
  if (!model)
    return null

  // Fallback: percent of model bounds.
  let bounds: { x: number, y: number, width: number, height: number } | null = null
  try {
    bounds = model.getBounds?.() ?? null
  }
  catch {
    bounds = null
  }
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0)
    return null

  return {
    x: bounds.x + bounds.width * FALLBACK_HEAD_ANCHOR.x,
    y: bounds.y + bounds.height * FALLBACK_HEAD_ANCHOR.y,
    isResolvedFromDrawables: false,
  }
}

export interface Live2DHeadTetheredCaptionAttachOptions {
  /** Pixi application that hosts the Live2D model. */
  app: Application
  /** The active Live2D PIXI displayObject (from `useLive2d().model`). */
  model: any
  /** The plank container the adapter should transform every frame. */
  plank: Container
  /** 0..100 — strength of the perspective response. */
  followStrength: number
  /** Pixel offset from the resolved head anchor. */
  offset: { x: number, y: number }
}

/**
 * Attach the plank to the stage and start the per-frame pose → transform loop.
 * Returns a `detach()` function that stops the ticker and removes the plank.
 *
 * Frame latch: uses PIXI's ticker at LOW priority so the transform writes
 * happen after both `model.update()` and the renderer's render step from the
 * previous frame, but before the next render. That keeps the plank in visual
 * sync with the head without needing to hook `motionManager.update`.
 */
export function attachLive2DHeadTetheredCaption(opts: Live2DHeadTetheredCaptionAttachOptions): () => void {
  const { app, model, plank, followStrength, offset } = opts

  if (!app?.stage || !model) {
    return () => { /* no-op */ }
  }

  // Mount the plank on the same stage so it inherits resolution scaling.
  app.stage.addChild(plank)

  const strength01 = Math.min(1, Math.max(0, followStrength / 100))

  const tick = () => {
    const coreModel = model?.internalModel?.coreModel
    if (!coreModel)
      return

    const yawRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.yaw)
    const pitchRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.pitch)
    const rollRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.roll)

    // Normalise to -1..1.
    const yaw = Math.min(1, Math.max(-1, yawRaw / PARAM_RANGE))
    const pitch = Math.min(1, Math.max(-1, pitchRaw / PARAM_RANGE))
    const roll = Math.min(1, Math.max(-1, rollRaw / PARAM_RANGE))

    const anchor = findHeadAnchorPoint(model)
    if (!anchor)
      return

    // Strength 0 → plank hovers over the head with no perspective.
    if (strength01 <= 0) {
      plank.position.set(anchor.x + offset.x, anchor.y + offset.y)
      plank.scale.set(1, 1)
      plank.skew?.set?.(0, 0)
      plank.rotation = 0
      plank.alpha = 1
      return
    }

    // Fake-perspective pair: squash + shear. Same shape as `poseToCaptionTransform`.
    const flatten = Math.abs(yaw) * 0.18 * strength01
    const scaleX = 1 - flatten
    const scaleY = 1 + Math.abs(pitch) * 0.035 * strength01
    const skewX = yaw * 0.12 * strength01
    const skewY = -pitch * 0.045 * strength01
    const rotation = roll * 0.5 * strength01

    plank.position.set(anchor.x + offset.x, anchor.y + offset.y)
    plank.scale.set(scaleX, scaleY)
    plank.skew?.set?.(skewX, skewY)
    plank.rotation = rotation
    plank.alpha = 1
  }

  // UPDATE_PRIORITY.LOW runs after NORMAL (model update) and before render.
  const priority = (app.ticker as any)?.constructor?.UPDATE_PRIORITY?.LOW ?? -25
  app.ticker?.add(tick, undefined, priority)

  // Kick one immediate frame so the plank does not flash at origin on attach.
  tick()

  return () => {
    try {
      app.ticker?.remove(tick)
    }
    catch { /* ticker may already be torn down */ }
    try {
      plank.removeFromParent?.()
    }
    catch { /* parent may already be gone */ }
  }
}
