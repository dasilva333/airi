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

export interface AttachLive2DHeadTetheredCaptionResult {
  detach: () => void
  updateText: (newText: string, color?: string) => void
}

export interface Live2DHeadTetheredCaptionAttachOptions {
  app: Application
  model: any
  text: string
  followStrength: number
  offset: { x: number, y: number }
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
  const directIds = coreModel._parameterIds as any
  const directValues = coreModel._parameterValues as any
  const hasDirectIds = Array.isArray(directIds) && directIds.length > 0
  const hasDirectValues = directValues && typeof directValues.length === 'number'
  if (hasDirectIds && hasDirectValues) {
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
    const directIds = (Array.isArray(coreModel?._parameterIds) ? coreModel._parameterIds : []) as string[]

    const yawVal = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.yaw)
    const pitchVal = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.pitch)
    const rollVal = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.roll)

    console.info('[live2d-head-tethered-caption] parameter census', {
      count: directIds.length,
      sampleIds: directIds.slice(0, 40),
      resolvedPoseSample: { yawVal, pitchVal, rollVal },
      internalModelProto: model?.internalModel ? Object.getPrototypeOf(model.internalModel)?.constructor?.name : null,
      coreModelProto: coreModel ? Object.getPrototypeOf(coreModel)?.constructor?.name : null,
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
function parseHexColor(colorStr?: string): number {
  if (!colorStr)
    return 0x0F172A
  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1)
    if (hex.length === 3) {
      const expanded = hex.split('').map(c => c + c).join('')
      return Number.parseInt(expanded, 16) || 0x0F172A
    }
    return Number.parseInt(hex, 16) || 0x0F172A
  }
  return 0x0F172A
}

function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0
  let g = 0
  let b = 0
  if (h >= 0 && h < 60) { r = c; g = x; b = 0 }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0 }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c }
  else if (h >= 300 && h < 360) { r = c; g = 0; b = x }

  const rInt = Math.round((r + m) * 255)
  const gInt = Math.round((g + m) * 255)
  const bInt = Math.round((b + m) * 255)

  return (rInt << 16) | (gInt << 8) | bInt
}

/**
 * Style 1: Breathing Palette Cycle.
 * Smoothly cycles through pink, magenta, soft violet, and lavender (hue range 240° to 340°).
 */
function getBreathingPinkPurpleColorHex(timeMs: number): number {
  const cycle = Math.sin(timeMs / 1400) // smooth sine cycle (~2.8s loop)
  const hue = 290 + 50 * cycle // Hue range: 240° (indigo/lavender) to 340° (hot pink)
  return hslToHex(hue, 0.85, 0.68)
}

// ── 9.0 Vector Bubble Types & Geometry Contracts ──────────────────────────────

export type BubbleBodyStyle
  = | 'standard-rounded'
    | 'jagged-starburst'
    | 'scalloped-cloud'

export type BubbleTailStyle
  = | 'pointer'
    | 'wagging'
    | 'heart-curl'
    | 'jagged-pointer'
    | 'droop'
    | 'thought-dots'
    | 'none'

export interface VectorBubbleOptions {
  width: number
  height: number
  bodyStyle: BubbleBodyStyle
  tailStyle: BubbleTailStyle
  wagPhase?: number
  color: number
  outlineWidth?: number
  outlineAlpha?: number
  fillColor?: number
  fillAlpha?: number
}

export interface VectorBubbleGeometry {
  drawVisibleBubble: (graphics: Graphics, opts: VectorBubbleOptions) => void
  drawInteriorMask: (graphics: Graphics, opts: VectorBubbleOptions) => void
  drawAuxiliaryShapes: (graphics: Graphics, opts: VectorBubbleOptions) => void
}

export interface AnalyzedSentenceEffects {
  bodyStyle: BubbleBodyStyle
  tailStyle: BubbleTailStyle
  ambient: 'hearts' | 'rain' | 'scanline' | 'fireflies' | 'blush' | 'vignette' | 'sunbeam' | 'confetti' | null
  accent: 'sweat-drop' | 'flash-burst' | 'lightbulb' | 'anger-mark' | 'checkmark' | 'question-mark' | 'star-sparkles' | null
  motion: 'wobble' | 'bounce' | 'shake' | 'breath' | 'stretch' | null
  rim: 'flower-bloom' | 'frost-rim' | 'heartbeat-pulse' | null
}

// ── 9.1 Sentence & Clause Trigger Analyzer (No <|ACT|>) ───────────────────────

export function analyzeCaptionSentence(text: string): AnalyzedSentenceEffects {
  const res: AnalyzedSentenceEffects = {
    bodyStyle: 'standard-rounded',
    tailStyle: 'pointer',
    ambient: null,
    accent: null,
    motion: null,
    rim: null,
  }

  if (!text || !text.trim())
    return res

  // Strip code blocks, URLs, and quoted text before sentiment scanning
  let cleanText = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/"[^"]*"/g, '')
    .trim()

  if (!cleanText)
    return res

  // Negation Filtering: Suppress emotion matches in negated spans
  const negatedSpans: string[] = []
  cleanText = cleanText.replace(/\b(?:not|no|don't|never)\s+\w+/gi, (match) => {
    negatedSpans.push(match.toLowerCase())
    return ' ' // replace with blank space
  })

  // 1. Bracket Tokens (e.g. [flustered], [angry], [sad], [thinking])
  const bracketMatch = text.match(/\[([\w-]+)\]/)
  if (bracketMatch) {
    const token = bracketMatch[1].toLowerCase()
    if (['flustered', 'blush', 'shy'].includes(token)) {
      res.ambient = 'blush'
      res.accent = 'sweat-drop'
      res.motion = 'wobble'
      res.tailStyle = 'heart-curl'
    }
    else if (['angry', 'tsundere', 'hmph', 'grr'].includes(token)) {
      res.bodyStyle = 'jagged-starburst'
      res.tailStyle = 'jagged-pointer'
      res.accent = 'anger-mark'
      res.motion = 'shake'
    }
    else if (['thinking', 'wonder', 'hmm'].includes(token)) {
      res.bodyStyle = 'scalloped-cloud'
      res.tailStyle = 'thought-dots'
      res.accent = 'question-mark'
    }
    else if (['gasp', 'surprised', 'shock'].includes(token)) {
      res.accent = 'flash-burst'
      res.motion = 'bounce'
    }
    else if (['sad', 'cry', 'pout', 'sigh'].includes(token)) {
      res.ambient = 'rain'
      res.tailStyle = 'droop'
    }
    else if (['yandere', 'obsessive'].includes(token)) {
      res.ambient = 'vignette'
      res.rim = 'heartbeat-pulse'
    }
    else if (['sleepy', 'tired', 'yawn'].includes(token)) {
      res.ambient = 'fireflies'
      res.motion = 'breath'
    }
  }

  // 2. Structural Triggers
  // Stutters (e.g. u-um, w-wait, I-I, b-dummy)
  if (/\b[a-z]-[a-z]{1,4}\b/i.test(cleanText)) {
    if (!res.ambient)
      res.ambient = 'blush'
    if (!res.accent)
      res.accent = 'sweat-drop'
    if (!res.motion)
      res.motion = 'wobble'
  }

  // Ellipses (...)
  if (/\.{3}|…/.test(cleanText)) {
    if (!res.ambient)
      res.ambient = 'fireflies'
    if (!res.motion)
      res.motion = 'breath'
  }

  // Punctuation Spikes (!! or !?)
  if (/!{2,}|\?{2,}|!\?|\?!/.test(cleanText)) {
    if (!res.accent)
      res.accent = 'flash-burst'
    if (!res.motion)
      res.motion = 'bounce'
  }

  // Parenthetical Asides (inner monologue)
  if (/\([^)]+\)/.test(cleanText)) {
    res.bodyStyle = 'scalloped-cloud'
    res.tailStyle = 'thought-dots'
  }

  // ALL CAPS
  if (/^[A-Z0-9\s!?,.'"-]{5,}$/.test(cleanText) && cleanText !== cleanText.toLowerCase()) {
    res.bodyStyle = 'jagged-starburst'
    res.tailStyle = 'jagged-pointer'
    if (!res.motion)
      res.motion = 'shake'
  }

  // Elongated Words (soooo, cuteeee)
  if (/([a-z])\1{3,}/i.test(cleanText)) {
    if (!res.motion)
      res.motion = 'stretch'
  }

  // 3. Keyword / Phrase Matches
  const lower = cleanText.toLowerCase()

  if (/\b(love|cute|darling|sweetheart|like you)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'hearts'
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'heart-curl'
  }
  else if (/\b(thanks|thank you|pretty|beautiful|amazing)\b/i.test(lower)) {
    if (!res.rim)
      res.rim = 'flower-bloom'
  }
  else if (/\b(sorry|miss you|cry|lonely|sniff)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'rain'
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'droop'
  }
  else if (/\b(angry|hmph|grr|annoyed|shut up)\b/i.test(lower)) {
    res.bodyStyle = 'jagged-starburst'
    res.tailStyle = 'jagged-pointer'
    if (!res.accent)
      res.accent = 'anger-mark'
    if (!res.motion)
      res.motion = 'shake'
  }
  else if (/\b(mine|jealous|don't leave|forever)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'vignette'
    if (!res.rim)
      res.rim = 'heartbeat-pulse'
  }
  else if (/\b(scared|eek|creepy|cold)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'fireflies'
    if (!res.motion)
      res.motion = 'wobble'
    if (!res.rim)
      res.rim = 'frost-rim'
  }
  else if (/\b(meow|nya|purr)\b/i.test(lower)) {
    if (res.tailStyle === 'pointer')
      res.tailStyle = 'wagging'
  }
  else if (/\b(code|system|analyze|data)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'scanline'
  }
  else if (/\b(cozy|warm|relax)\b/i.test(lower)) {
    if (!res.ambient)
      res.ambient = 'sunbeam'
    if (!res.motion)
      res.motion = 'breath'
  }

  return res
}

// ── 9.2 Vector Bubble Path Builder ────────────────────────────────────────────

export const vectorBubblePathBuilder: VectorBubbleGeometry = {
  drawVisibleBubble(g: Graphics, opts: VectorBubbleOptions) {
    const { width, height, bodyStyle, tailStyle, wagPhase = 0, color, outlineWidth = 2.5, outlineAlpha = 0.92, fillColor = 0xFFFFFF, fillAlpha = 0.92 } = opts

    g.lineStyle(outlineWidth, color, outlineAlpha, 0.5)
    g.beginFill(fillColor, fillAlpha)

    const halfW = width / 2
    const tailBaseHalf = Math.max(8, Math.round(width * 0.05))
    const tailHeight = Math.max(10, Math.round(width * 0.05))

    if (bodyStyle === 'jagged-starburst') {
      // Jagged starburst outer polygon pass
      const spikes = 16
      const topY = -height
      const botY = 0

      g.moveTo(-halfW, -height / 2)
      for (let i = 0; i <= spikes; i++) {
        const step = i / spikes
        const x = -halfW + step * width
        const spikeY = (i % 2 === 0) ? topY - 4 : topY + 4
        g.lineTo(x, spikeY)
      }
      g.lineTo(halfW + 4, -height / 2)

      // Right jagged edge
      g.lineTo(halfW, botY)

      // Bottom edge with jagged tail
      if (tailStyle !== 'none') {
        g.lineTo(tailBaseHalf, 0)
        g.lineTo(0, tailHeight + 4)
        g.lineTo(-tailBaseHalf, 0)
      }
      g.lineTo(-halfW, botY)
      g.closePath()
      g.endFill()
      return
    }

    if (bodyStyle === 'scalloped-cloud') {
      // Scalloped cloud outer perimeter
      const radius = Math.min(14, Math.round(height * 0.25))
      g.moveTo(-halfW + radius, -height)

      // Top cloud arcs
      g.lineTo(halfW - radius, -height)
      g.arcTo(halfW, -height, halfW, -height + radius, radius)
      g.lineTo(halfW, -radius)
      g.arcTo(halfW, 0, halfW - radius, 0, radius)

      if (tailStyle !== 'none') {
        g.lineTo(tailBaseHalf, 0)
        g.lineTo(0, tailHeight)
        g.lineTo(-tailBaseHalf, 0)
      }

      g.lineTo(-halfW + radius, 0)
      g.arcTo(-halfW, 0, -halfW, -radius, radius)
      g.lineTo(-halfW, -height + radius)
      g.arcTo(-halfW, -height, -halfW + radius, -height, radius)
      g.closePath()
      g.endFill()
      return
    }

    // Standard Rounded Body
    const radius = Math.min(14, Math.round(height * 0.25))
    g.moveTo(-halfW + radius, -height)

    // Top edge -> Top-right corner
    g.lineTo(halfW - radius, -height)
    g.arcTo(halfW, -height, halfW, -height + radius, radius)

    // Right edge -> Bottom-right corner
    g.lineTo(halfW, -radius)
    g.arcTo(halfW, 0, halfW - radius, 0, radius)

    // Bottom edge + Tail pose
    if (tailStyle === 'wagging') {
      const wagX = Math.sin(wagPhase) * (tailHeight * 0.7)
      g.lineTo(tailBaseHalf, 0)
      g.lineTo(wagX, tailHeight)
      g.lineTo(-tailBaseHalf, 0)
    }
    else if (tailStyle === 'heart-curl') {
      g.lineTo(tailBaseHalf, 0)
      g.bezierCurveTo(tailBaseHalf + 6, tailHeight * 0.6, 6, tailHeight + 6, 0, tailHeight)
      g.bezierCurveTo(-6, tailHeight + 6, -tailBaseHalf - 6, tailHeight * 0.6, -tailBaseHalf, 0)
    }
    else if (tailStyle === 'droop') {
      g.lineTo(tailBaseHalf, 0)
      g.bezierCurveTo(tailBaseHalf, tailHeight * 0.8, -8, tailHeight + 4, -12, tailHeight)
      g.lineTo(-tailBaseHalf, 0)
    }
    else if (tailStyle === 'jagged-pointer') {
      g.lineTo(tailBaseHalf, 0)
      g.lineTo(tailBaseHalf / 2, tailHeight / 2)
      g.lineTo(0, tailHeight + 3)
      g.lineTo(-tailBaseHalf, 0)
    }
    else if (tailStyle === 'pointer') {
      g.lineTo(tailBaseHalf, 0)
      g.lineTo(0, tailHeight)
      g.lineTo(-tailBaseHalf, 0)
    }

    // Bottom-left corner -> Left edge -> Top-left corner
    g.lineTo(-halfW + radius, 0)
    g.arcTo(-halfW, 0, -halfW, -radius, radius)
    g.lineTo(-halfW, -height + radius)
    g.arcTo(-halfW, -height, -halfW + radius, -height, radius)

    g.closePath()
    g.endFill()
  },

  drawInteriorMask(g: Graphics, opts: VectorBubbleOptions) {
    const { width, height } = opts
    g.clear()
    g.beginFill(0xFFFFFF, 1.0)
    const halfW = width / 2
    const radius = Math.min(14, Math.round(height * 0.25))

    // Body-only mask without tail so interior effects stay strictly inside bubble body
    g.moveTo(-halfW + radius, -height)
    g.lineTo(halfW - radius, -height)
    g.arcTo(halfW, -height, halfW, -height + radius, radius)
    g.lineTo(halfW, -radius)
    g.arcTo(halfW, 0, halfW - radius, 0, radius)
    g.lineTo(-halfW + radius, 0)
    g.arcTo(-halfW, 0, -halfW, -radius, radius)
    g.lineTo(-halfW, -height + radius)
    g.arcTo(-halfW, -height, -halfW + radius, -height, radius)
    g.closePath()
    g.endFill()
  },

  drawAuxiliaryShapes(g: Graphics, opts: VectorBubbleOptions) {
    const { tailStyle, color } = opts
    g.clear()

    if (tailStyle === 'thought-dots') {
      // Draw 3 trailing standalone circles below bubble leading to head
      g.beginFill(0xFFFFFF, 0.92)
      g.lineStyle(2, color, 0.92)

      g.drawCircle(0, 8, 4)
      g.drawCircle(-3, 16, 2.5)
      g.drawCircle(-5, 22, 1.5)

      g.endFill()
    }
  },
}

// ── 9.3 Main Plank Builder with 4-Channel Engine ──────────────────────────────

export function buildCaptionBubblePlank(opts: {
  text: string
  widthPx: number
  color?: string
}): Container & { updateText: (newText: string, colorStr?: string) => void, updateTick: (timeMs: number) => void } {
  const widthPx = Math.max(120, Math.round(opts.widthPx))
  const padX = Math.max(10, Math.round(widthPx * 0.06))
  const padY = Math.max(8, Math.round(widthPx * 0.04))
  const fontSize = Math.max(12, Math.round(widthPx * 0.07))

  let hasExplicitColor = Boolean(opts.color)
  let currentOutlineColor = opts.color ? parseHexColor(opts.color) : getBreathingPinkPurpleColorHex(Date.now())

  // Text Node (Always top layer for crisp legibility)
  const textNode = new Text(opts.text, {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontSize,
    fontWeight: '500',
    fill: 0x0F172A,
    wordWrap: true,
    wordWrapWidth: widthPx - padX * 2,
    align: 'center',
    breakWords: true,
    lineHeight: Math.round(fontSize * 1.2),
  })
  textNode.anchor.set(0.5, 0.5)

  // Initial trigger analysis
  let activeEffects = analyzeCaptionSentence(opts.text)

  // PIXI Containers for 4-Channel Layering
  const motionContainer = new PixiContainer()
  const bubbleGraphics = new Graphics()
  const bodyMaskGraphics = new Graphics()
  const interiorEffectsContainer = new PixiContainer()
  const ambientContainer = new PixiContainer()
  const interiorAccentContainer = new PixiContainer()
  const rimContainer = new PixiContainer()
  const exteriorAccentContainer = new PixiContainer()
  const auxiliaryGraphics = new Graphics()

  // Assemble Scene Graph Hierarchy
  interiorEffectsContainer.mask = bodyMaskGraphics
  interiorEffectsContainer.addChild(ambientContainer)
  interiorEffectsContainer.addChild(interiorAccentContainer)

  motionContainer.addChild(bubbleGraphics)
  motionContainer.addChild(bodyMaskGraphics)
  motionContainer.addChild(interiorEffectsContainer)
  motionContainer.addChild(rimContainer)
  motionContainer.addChild(exteriorAccentContainer)
  motionContainer.addChild(auxiliaryGraphics)
  motionContainer.addChild(textNode)

  const tailHeight = Math.max(10, Math.round(widthPx * 0.05))

  // Particle state memory
  let ambientParticles: Array<{ x: number, y: number, vx: number, vy: number, alpha: number, scale: number, sprite: Graphics }> = []

  function renderPlank(timeMs: number) {
    const bubbleHeight = textNode.height + padY * 2
    const bubbleOpts: VectorBubbleOptions = {
      width: widthPx,
      height: bubbleHeight,
      bodyStyle: activeEffects.bodyStyle,
      tailStyle: activeEffects.tailStyle,
      wagPhase: timeMs / 180,
      color: currentOutlineColor,
      outlineWidth: 2.5,
      outlineAlpha: 0.92,
      fillColor: 0xFFFFFF,
      fillAlpha: 0.92,
    }

    // 1. Draw Visible Bubble & Body Mask
    bubbleGraphics.clear()
    vectorBubblePathBuilder.drawVisibleBubble(bubbleGraphics, bubbleOpts)
    vectorBubblePathBuilder.drawInteriorMask(bodyMaskGraphics, bubbleOpts)
    vectorBubblePathBuilder.drawAuxiliaryShapes(auxiliaryGraphics, bubbleOpts)

    textNode.position.set(0, -bubbleHeight / 2)

    // 2. Render Channel 1: AMBIENT
    ambientContainer.removeChildren()
    if (activeEffects.ambient === 'blush') {
      const blush = new Graphics()
      blush.beginFill(0xF472B6, 0.22)
      blush.drawRect(-widthPx / 2, -bubbleHeight / 2, widthPx, bubbleHeight / 2)
      blush.endFill()
      ambientContainer.addChild(blush)
    }
    else if (activeEffects.ambient === 'hearts') {
      if (ambientParticles.length === 0) {
        for (let i = 0; i < 6; i++) {
          const heart = new Graphics()
          heart.beginFill(0xEC4899, 0.7)
          heart.drawCircle(0, 0, 3)
          heart.endFill()
          ambientParticles.push({
            x: (Math.random() - 0.5) * (widthPx * 0.7),
            y: -Math.random() * bubbleHeight,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.4 - Math.random() * 0.4,
            alpha: 0.8,
            scale: 0.8 + Math.random() * 0.4,
            sprite: heart,
          })
        }
      }

      for (const p of ambientParticles) {
        p.y += p.vy
        p.x += p.vx
        if (p.y < -bubbleHeight)
          p.y = 0
        p.sprite.position.set(p.x, p.y)
        ambientContainer.addChild(p.sprite)
      }
    }

    // 3. Render Channel 2: ACCENT
    interiorAccentContainer.removeChildren()
    exteriorAccentContainer.removeChildren()
    if (activeEffects.accent === 'sweat-drop') {
      const drop = new Graphics()
      drop.beginFill(0x38BDF8, 0.85)
      drop.drawCircle(widthPx / 2 - 12, -bubbleHeight + 10, 4)
      drop.endFill()
      interiorAccentContainer.addChild(drop)
    }
    else if (activeEffects.accent === 'anger-mark') {
      const anger = new Graphics()
      anger.lineStyle(2, 0xEF4444, 0.9)
      anger.moveTo(widthPx / 2 - 16, -bubbleHeight + 8)
      anger.lineTo(widthPx / 2 - 8, -bubbleHeight + 16)
      anger.moveTo(widthPx / 2 - 8, -bubbleHeight + 8)
      anger.lineTo(widthPx / 2 - 16, -bubbleHeight + 16)
      exteriorAccentContainer.addChild(anger)
    }

    // 4. Render Channel 3: MOTION
    if (activeEffects.motion === 'wobble') {
      motionContainer.rotation = Math.sin(timeMs / 120) * 0.04
      motionContainer.scale.set(1.0, 1.0)
    }
    else if (activeEffects.motion === 'bounce') {
      motionContainer.rotation = 0
      motionContainer.scale.set(1.0, 1.0 + Math.sin(timeMs / 100) * 0.05)
    }
    else if (activeEffects.motion === 'shake') {
      motionContainer.position.x = (Math.random() - 0.5) * 4
      motionContainer.rotation = 0
    }
    else {
      motionContainer.rotation = 0
      motionContainer.position.set(0, 0)
      motionContainer.scale.set(1.0, 1.0)
    }
  }

  renderPlank(Date.now())

  const container = new PixiContainer() as Container & {
    updateText: (newText: string, colorStr?: string) => void
    updateTick: (timeMs: number) => void
  }
  container.addChild(motionContainer)
  container.pivot.set(0, tailHeight)

  container.updateText = (newText: string, colorStr?: string) => {
    textNode.text = newText
    activeEffects = analyzeCaptionSentence(newText)
    ambientParticles = [] // reset particles on new text

    if (colorStr) {
      hasExplicitColor = true
      currentOutlineColor = parseHexColor(colorStr)
    }
    else {
      hasExplicitColor = false
      currentOutlineColor = getBreathingPinkPurpleColorHex(Date.now())
    }
    renderPlank(Date.now())
    container.pivot.set(0, tailHeight)
  }

  container.updateTick = (timeMs: number) => {
    if (!hasExplicitColor) {
      currentOutlineColor = getBreathingPinkPurpleColorHex(timeMs)
    }
    renderPlank(timeMs)
  }

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
export function attachLive2DHeadTetheredCaption(opts: Live2DHeadTetheredCaptionAttachOptions): AttachLive2DHeadTetheredCaptionResult {
  const { app, model, text, followStrength, offset } = opts

  if (!app?.stage || !model) {
    console.warn('[live2d-head-tethered-caption] attach skipped — missing app.stage or model', {
      hasApp: Boolean(app),
      hasStage: Boolean(app?.stage),
      hasModel: Boolean(model),
    })
    return {
      detach: () => { /* no-op */ },
      updateText: () => { /* no-op */ },
    }
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

    const yawParam = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.yaw)
    const pitchParam = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.pitch)
    const rollParam = readCoreModelParamValue(coreModel, PARAM_ID_ALIASES.roll)

    const focusX = Number(model?.internalModel?.focusController?.x) || 0
    const focusY = Number(model?.internalModel?.focusController?.y) || 0

    const yawRaw = yawParam !== null && yawParam !== 0 ? yawParam : (focusX * 30)
    const pitchRaw = pitchParam !== null && pitchParam !== 0 ? pitchParam : (-focusY * 30)
    const rollRaw = rollParam || 0

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

    const isDebug = typeof window !== 'undefined' && Boolean((window as any).__AIRI_DEBUG_CAPTIONS__)
    if (isDebug && (frameCount === 1 || frameCount % 180 === 0)) {
      const idxX = coreModel._parameterIds?.indexOf?.('ParamAngleX') ?? -1
      const idxY = coreModel._parameterIds?.indexOf?.('ParamAngleY') ?? -1
      const idxZ = coreModel._parameterIds?.indexOf?.('ParamAngleZ') ?? -1

      console.info('[live2d-head-tethered-caption] stage telemetry sample', {
        frameCount,
        poseRaw: { yawRaw, pitchRaw, rollRaw },
        poseDiagnostics: {
          focusController: { x: focusX, y: focusY },
          modelGetParam: {
            angleX: model?.getParameterValueById?.('ParamAngleX'),
            angleY: model?.getParameterValueById?.('ParamAngleY'),
            angleZ: model?.getParameterValueById?.('ParamAngleZ'),
          },
          coreGetParam: {
            angleX: coreModel?.getParameterValueById?.('ParamAngleX'),
            angleY: coreModel?.getParameterValueById?.('ParamAngleY'),
            angleZ: coreModel?.getParameterValueById?.('ParamAngleZ'),
          },
          directArrayParam: {
            idxX,
            valX: idxX >= 0 ? coreModel._parameterValues?.[idxX] : null,
            valY: idxY >= 0 ? coreModel._parameterValues?.[idxY] : null,
            valZ: idxZ >= 0 ? coreModel._parameterValues?.[idxZ] : null,
          },
        },
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
        transformRaw: { x: transform.x, y: transform.y, skewX: transform.skewX, scaleX: transform.scaleX, rotation: transform.rotation },
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
    plank.updateTick(Date.now())
  }

  // UPDATE_PRIORITY.LOW runs after NORMAL (model update) and before render.
  // In PIXI v6 the enum lives on the ticker class itself.
  const priority = (app.ticker as any)?.constructor?.UPDATE_PRIORITY?.LOW ?? -25
  app.ticker?.add(tick, undefined, priority)

  // Kick one immediate frame so the plank does not flash at origin on attach.
  tick()

  return {
    detach: () => {
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
    },
    updateText: (newText: string, color?: string) => {
      plank.updateText(newText, color)
    },
  }
}
