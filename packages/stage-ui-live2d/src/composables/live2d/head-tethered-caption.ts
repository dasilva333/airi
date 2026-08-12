/**
 * Live2D head-tethered caption adapter.
 *
 * Reads pose parameters from the Cubism `coreModel` (with ID aliases for
 * runtime compatibility), resolves a stage-space anchor point above the head,
 * builds a comic-style speech bubble plank, and applies a fake-perspective
 * transform every frame so the bubble appears to tilt with the head.
 *
 * The math is consumed from `@proj-airi/stage-shared/utils/caption-perspective`
 * so future Spine/VRM/MMD adapters share the same single-sourced function.
 */

import type { Application } from '@pixi/app'
import type { Container } from '@pixi/display'

import { BatchRenderer } from '@pixi/core'
import { Container as PixiContainer } from '@pixi/display'
import { Graphics } from '@pixi/graphics'
import { Text } from '@pixi/text'
import {
  poseToCaptionTransform,
} from '@proj-airi/stage-shared/utils/caption-perspective'

// NOTICE: PIXI v6's scoped packages do NOT self-register object renderers, and
// this app's stage only ever rendered the Live2D model — which draws through
// its own Cubism GL path, not PIXI's batch pipeline. `Graphics`/`Text` both
// carry `pluginName = 'batch'` and look up `renderer.plugins.batch` at render
// time. With nothing registering `BatchRenderer`, that lookup is undefined and
// the render pass dies with `Cannot read properties of undefined (reading
// 'MAX_TEXTURES')` — the model survives because it never touches the batcher.
//
// `extensions.add(BatchRenderer)` only affects renderers constructed AFTER
// registration (`initPlugins` runs in the Renderer constructor), so for the
// already-live stage renderer we inject the plugin directly. The constructor
// self-subscribes to `renderer.runners.contextChange` / `prerender`; the one
// manual `contextChange()` call recomputes MAX_TEXTURES against the live GL
// context instead of the constructor default of 1.
function ensureBatchRendererOnLiveRenderer(app: Application) {
  const renderer = app?.renderer as any
  if (!renderer)
    return
  renderer.plugins = renderer.plugins || {}
  if (renderer.plugins.batch)
    return
  try {
    const instance = new BatchRenderer(renderer)
    renderer.plugins.batch = instance
    try {
      instance.contextChange?.()
    }
    catch { /* GL context may re-emit later; constructor default is safe */ }
    console.info('[live2d-head-tethered-caption] BatchRenderer injected into live renderer')
  }
  catch (err) {
    console.warn('[live2d-head-tethered-caption] failed to inject BatchRenderer', err)
  }
}

// NOTICE: Live2D runtime parameter IDs differ across model authors and
// Cubism versions. List most-common aliases in priority order; first match
// wins at resolution time.
const PARAM_ID_ALIASES = {
  yaw: ['ParamAngleX', 'PARAM_ANGLE_X', 'ParamHeadAngleX', 'HeadAngleX', 'FaceAngleX', 'AngleX'],
  pitch: ['ParamAngleY', 'PARAM_ANGLE_Y', 'ParamHeadAngleY', 'HeadAngleY', 'FaceAngleY', 'AngleY'],
  roll: ['ParamAngleZ', 'PARAM_ANGLE_Z', 'ParamHeadAngleZ', 'HeadAngleZ', 'FaceAngleZ', 'AngleZ'],
} as const

// The natural range of Live2D angle parameters is roughly ±30. We clamp the
// normalised yaw/pitch/roll into [-1, 1] downstream.
const PARAM_RANGE = 30

function normalizeParamId(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function readCoreModelParamValue(coreModel: any, aliases: readonly string[]): number {
  if (!coreModel)
    return 0

  // NOTICE: pixi-live2d-display's `CubismModel.getParameterCount()` sometimes
  // returns 0 even when `_parameterIds` is populated, because the underlying
  // `_model` reference is wired lazily. The wrapper's own `_parameterIds` /
  // `_parameterValues` parallel arrays are reliable and updated every frame by
  // the runtime, so we read those first.
  const directIds = coreModel._parameterIds as unknown
  const directValues = coreModel._parameterValues as unknown
  if (Array.isArray(directIds) && Array.isArray(directValues) && directIds.length > 0) {
    for (const alias of aliases) {
      const aliasNorm = normalizeParamId(alias)
      for (let i = 0; i < directIds.length; i += 1) {
        if (normalizeParamId(directIds[i]) === aliasNorm) {
          const value = Number(directValues[i])
          if (Number.isFinite(value))
            return value
        }
      }
    }
  }

  // Index-based enumeration via the public API.
  try {
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
  }
  catch {
    // Enumeration is best-effort across runtimes.
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

// Diagnostic: dump every param id the model actually exposes, once per attach.
// Helps when a model uses non-standard IDs and the alias list needs to grow.
function dumpModelParameterIds(coreModel: any, model: any): void {
  try {
    const ids: string[] = []
    const count = Number(coreModel?.getParameterCount?.())
    if (Number.isInteger(count) && count > 0) {
      for (let i = 0; i < count; i += 1) {
        const id = coreModel.getParameterId?.(i)
        if (typeof id === 'string' && id)
          ids.push(id)
      }
    }
    console.info('[live2d-head-tethered-caption] parameter census', {
      count: ids.length,
      ids,
      internalModelKeys: model?.internalModel ? Object.keys(model.internalModel).slice(0, 12) : [],
      internalModelProto: model?.internalModel ? Object.getPrototypeOf(model.internalModel)?.constructor?.name : null,
      coreModelProto: coreModel ? Object.getPrototypeOf(coreModel)?.constructor?.name : null,
      hasGetParameterCount: typeof coreModel?.getParameterCount === 'function',
      hasGetParameterValueById: typeof coreModel?.getParameterValueById === 'function',
      coreModelDirectKeys: coreModel ? Object.keys(coreModel).slice(0, 12) : [],
    })
  }
  catch (err) {
    console.warn('[live2d-head-tethered-caption] parameter census failed', err)
  }
}

function findHeadAnchorPoint(model: any, frameCount = 0): { x: number, y: number } | null {
  if (!model)
    return null

  let bounds: { x: number, y: number, width: number, height: number } | null = null
  try {
    bounds = model.getBounds?.() ?? null
  }
  catch {
    bounds = null
  }
  if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0)
    return null

  let globalHeadOrigin: { x: number, y: number } | null = null
  try {
    if (typeof model.toGlobal === 'function') {
      const g = model.toGlobal({ x: 0, y: 0 })
      if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) {
        globalHeadOrigin = { x: g.x, y: g.y }
      }
    }
  }
  catch { /* best-effort */ }

  const headCenterX = globalHeadOrigin ? globalHeadOrigin.x : (bounds.x + bounds.width * 0.5)

  const anchor = {
    x: headCenterX,
    y: bounds.y + Math.min(bounds.height * 0.02, 15),
  }

  const shouldLog = frameCount === 1 || (frameCount > 0 && frameCount % 300 === 0)
  if (shouldLog) {
    console.info('[live2d-head-tethered-caption] head anchor resolved', {
      frameCount,
      modelBounds: bounds,
      globalHeadOrigin,
      resolvedAnchor: anchor,
    })
  }

  return anchor
}

function measureModelHeightPx(model: any): number {
  try {
    const bounds = model?.getBounds?.()
    if (bounds && Number.isFinite(bounds.height) && bounds.height > 0)
      return bounds.height
  }
  catch { /* bounds are best-effort */ }
  return 200
}

export interface Live2DHeadTetheredCaptionAttachOptions {
  /** Pixi application that hosts the Live2D model. */
  app: Application
  /** The active Live2D PIXI displayObject (from `useLive2d().model`). */
  model: any
  /** Bubble text. */
  text: string
  /** 0..100 — strength of the perspective response. */
  followStrength: number
  /** Pixel offset from the resolved head anchor (post-anchor, pre-transform). */
  offset: { x: number, y: number }
  /** Bubble width as a fraction of the model's on-screen height. Defaults to 0.45. */
  widthToModelHeightRatio?: number
}

/**
 * Build a comic speech-bubble `Container` (rounded rect + tail + centred text).
 * Returned detached — caller adds it to the stage appropriately.
 *
 * The bubble is drawn *pointing down* so when positioned above the head the
 * tail lands near the head anchor point. Container's pivot is set so its
 * `(0, 0)` is the tail tip — i.e. `plank.position.set(ax, ay)` puts the
 * tail exactly at the anchor point.
 */
export function buildCaptionBubblePlank(opts: {
  text: string
  widthPx: number
}): Container {
  const widthPx = Math.max(120, Math.round(opts.widthPx))
  const padX = Math.max(10, Math.round(widthPx * 0.06))
  const padY = Math.max(8, Math.round(widthPx * 0.04))
  const fontSize = Math.max(12, Math.round(widthPx * 0.07))

  const textNode = new Text(opts.text, {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize,
    fontWeight: '500',
    fill: 0x0F172A, // slate-900 — high contrast on white bubble
    wordWrap: true,
    wordWrapWidth: widthPx - padX * 2,
    align: 'center',
    breakWords: true,
    lineHeight: Math.round(fontSize * 1.2),
  })
  textNode.anchor.set(0.5, 0.5)

  const bubbleWidth = widthPx
  const bubbleHeight = textNode.height + padY * 2
  const tailBaseHalf = Math.max(8, Math.round(widthPx * 0.05))
  const tailHeight = Math.max(10, Math.round(widthPx * 0.05))

  const bubble = new Graphics()
  // PIXI v6 positional signature: lineStyle(width, color, alpha, alignment, native).
  // Do not switch to v7 object form — this stage still runs on v6.
  const outlineColor = 0x0F172A
  const outlineAlpha = 0.92
  const outlineWidth = 2.5
  const fillColor = 0xFFFFFF
  const fillAlpha = 0.92

  // Body.
  bubble.lineStyle(outlineWidth, outlineColor, outlineAlpha, 0.5)
  bubble.beginFill(fillColor, fillAlpha)
  bubble.drawRoundedRect(-bubbleWidth / 2, -bubbleHeight, bubbleWidth, bubbleHeight, Math.min(14, padY + 3))
  bubble.endFill()

  // Tail triangle pointing down.
  bubble.lineStyle(outlineWidth, outlineColor, outlineAlpha, 0.5)
  bubble.beginFill(fillColor, fillAlpha)
  bubble.moveTo(-tailBaseHalf, -2)
  bubble.lineTo(0, tailHeight)
  bubble.lineTo(tailBaseHalf, -2)
  bubble.closePath()
  bubble.endFill()

  // Cover the seam where tail meets bubble (so the outline stays clean).
  bubble.lineStyle(0)
  bubble.beginFill(fillColor, fillAlpha)
  bubble.drawRect(-tailBaseHalf - 1, -3, tailBaseHalf * 2 + 2, 3)
  bubble.endFill()

  // Centre text in the bubble body.
  textNode.position.set(0, -bubbleHeight / 2)

  const container = new PixiContainer()
  container.addChild(bubble)
  container.addChild(textNode)

  // Pivot: (0, 0) == tip of the tail. Setting `plank.position.set(anchor.x, anchor.y)`
  // puts the tail exactly on the anchor.
  container.pivot.set(0, tailHeight)

  return container
}

/**
 * Attach a caption bubble to the stage and start the per-frame pose → transform
 * loop. Returns a `detach()` function that stops the ticker and destroys the plank.
 *
 * Frame latch: uses PIXI's ticker at LOW priority so the transform writes
 * happen after the model's own update pass but before the next render. That
 * keeps the plank in visual sync with the head without hooking `motionManager.update`.
 */
export function attachLive2DHeadTetheredCaption(opts: Live2DHeadTetheredCaptionAttachOptions): () => void {
  const { app, model, text, followStrength, offset } = opts

  if (!app?.stage || !model) {
    console.warn('[live2d-head-tethered-caption] attach skipped — missing app.stage or model', {
      hasApp: Boolean(app),
      hasStage: Boolean(app?.stage),
      hasModel: Boolean(model),
    })
    return () => { /* no-op */ }
  }

  ensureBatchRendererOnLiveRenderer(app)

  // Settings come from a Vue reactive store; unwrap the Proxy into plain
  // numbers once so the per-frame tick never touches reactivity.
  const offsetPlain = {
    x: Number(offset?.x) || 0,
    y: Number(offset?.y) || 0,
  }

  const modelHeightPx = measureModelHeightPx(model)
  const stageWidthPx = app.screen?.width || app.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 400)
  const maxViewportWidth = Math.min(stageWidthPx * 0.65, 300)
  const plankWidth = Math.max(140, Math.min(modelHeightPx * 0.35, maxViewportWidth))
  const plank = buildCaptionBubblePlank({ text, widthPx: plankWidth })

  app.stage.addChild(plank)
  console.info('[live2d-head-tethered-caption] attached', {
    plankWidth,
    modelHeightPx,
    stageWidthPx,
    followStrength,
    offsetPlain,
    text,
  })
  dumpModelParameterIds(model?.internalModel?.coreModel, model)

  let frameCount = 0
  const tick = () => {
    frameCount += 1
    const coreModel = model?.internalModel?.coreModel
    if (!coreModel) {
      if (frameCount < 5 || frameCount % 240 === 0) {
        console.warn('[live2d-head-tethered-caption] no coreModel on tick', { frameCount })
      }
      return
    }

    const yawRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.yaw)
    const pitchRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.pitch)
    const rollRaw = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.roll)

    const anchor = findHeadAnchorPoint(model, frameCount)
    if (!anchor) {
      if (frameCount < 5 || frameCount % 240 === 0) {
        console.warn('[live2d-head-tethered-caption] no anchor resolved on tick', { frameCount })
      }
      return
    }

    const transform = poseToCaptionTransform(
      {
        yaw: yawRaw / PARAM_RANGE,
        pitch: pitchRaw / PARAM_RANGE,
        roll: rollRaw / PARAM_RANGE,
      },
      anchor,
      {
        strength: followStrength,
        offsetX: offsetPlain.x,
        offsetY: offsetPlain.y,
      },
    )

    // Viewport Boundary Clamping: prevent bubble body from clipping off-screen.
    const stageWidth = app.screen?.width || app.renderer?.width || (typeof window !== 'undefined' ? window.innerWidth : 400)
    const bubbleHalfWidth = plankWidth / 2
    const minX = bubbleHalfWidth + 12
    const maxX = Math.max(minX, stageWidth - bubbleHalfWidth - 12)
    const clampedX = Math.max(minX, Math.min(transform.x, maxX))
    const clampedY = Math.max(12, transform.y)

    if (frameCount === 1 || frameCount % 180 === 0) {
      console.info('[live2d-head-tethered-caption] stage telemetry sample', {
        frameCount,
        windowSize: typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : null,
        stageScreen: { width: app.screen?.width, height: app.screen?.height },
        stageScale: { x: app.stage?.scale?.x, y: app.stage?.scale?.y },
        modelMetrics: {
          position: { x: model?.x, y: model?.y },
          scale: { x: model?.scale?.x, y: model?.scale?.y },
          pivot: { x: model?.pivot?.x, y: model?.pivot?.y },
          bounds: model?.getBounds?.(),
        },
        anchor,
        transformRaw: { x: transform.x, y: transform.y },
        transformClamped: { x: clampedX, y: clampedY },
        plankBBox: plank.getBounds?.(),
      })
    }

    plank.position.set(clampedX, clampedY)
    plank.scale.set(transform.scaleX, transform.scaleY)
    // `skew` exists on PIXI v6+ Container; guard for runtime variance.
    plank.skew?.set?.(transform.skewX, transform.skewY)
    plank.rotation = transform.rotation
    plank.alpha = transform.opacity
  }

  // UPDATE_PRIORITY.LOW runs after NORMAL (model update) and before render.
  // In PIXI v6 the enum lives on the ticker class itself.
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
      // PIXI v6 Container exposes `parent`/`removeChild`; `removeFromParent` is
      // a v7+ alias. Use the structural `parent` API for the broadest runtime
      // compatibility.
      plank.parent?.removeChild?.(plank)
      plank.destroy?.({ children: true })
    }
    catch { /* plank may already be gone */ }
  }
}
