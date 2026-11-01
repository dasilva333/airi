/** A part of the character that a pointer can touch. */
export type Live2DTouchRegion = 'body' | 'head'

/** The kind of touch. A pat is a stroke across the head while the pointer is pressed. */
export type Live2DTouchGesture = 'pat' | 'tap'

/** One touch on the character. */
export interface Live2DTouch {
  region: Live2DTouchRegion
  gesture: Live2DTouchGesture
  /** Horizontal position from -1 (left of the model) to 1 (right of the model). */
  side: number
}

/** What the region resolution reads from a model at one point. */
export interface Live2DTouchHitInput {
  /** Hit areas of the model that contain the point, with their author names. */
  hitAreaNames: readonly string[]
  /** True when the head box of the model contains the point. */
  insideHead: boolean
  /** True when the mesh of a visible drawable contains the point. */
  insideDrawable: boolean
}

const headAreaPattern = /head|face/i

/**
 * Resolves the region of a touch.
 *
 * Author hit areas win when the model declares them. Many models declare
 * none, so the head box of the head tracker and the drawable meshes are the
 * fallback. The head box is a rectangle, so a point in it must also be on a
 * drawable. Otherwise the empty corners beside the face are the head.
 */
export function resolveLive2DTouchRegion(input: Live2DTouchHitInput): Live2DTouchRegion | undefined {
  if (input.hitAreaNames.some(name => headAreaPattern.test(name)))
    return 'head'
  // An author area that is not the head, for example `Body` or `Arm`, is the body.
  if (input.hitAreaNames.length > 0)
    return 'body'
  if (!input.insideDrawable)
    return undefined
  return input.insideHead ? 'head' : 'body'
}

/**
 * Tells whether a point is inside the mesh of one drawable.
 *
 * The bounds of a drawable are a box around all its vertices, so a box test
 * counts the empty space between a raised arm and the body as the body. The
 * mesh is the triangles that the drawable paints, and it follows the outline.
 *
 * `vertices` holds x, y pairs in the space of the point. `indices` holds three
 * vertex indices for each triangle.
 */
export function isPointInLive2DMesh(point: { x: number, y: number }, vertices: ArrayLike<number>, indices: ArrayLike<number>): boolean {
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const ax = vertices[indices[index] * 2]
    const ay = vertices[indices[index] * 2 + 1]
    const bx = vertices[indices[index + 1] * 2]
    const by = vertices[indices[index + 1] * 2 + 1]
    const cx = vertices[indices[index + 2] * 2]
    const cy = vertices[indices[index + 2] * 2 + 1]

    // A deformer can collapse a triangle to a line or a point. Its edge tests are all 0 for any point, so it must be skipped.
    if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) === 0)
      continue

    // The point is inside when it is on the same side of all three edges. The winding of the triangle does not matter.
    const ab = (bx - ax) * (point.y - ay) - (by - ay) * (point.x - ax)
    const bc = (cx - bx) * (point.y - by) - (cy - by) * (point.x - bx)
    const ca = (ax - cx) * (point.y - cy) - (ay - cy) * (point.x - cx)
    if ((ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0))
      return true
  }
  return false
}

/** Limits of the gesture recognition, in CSS pixels and milliseconds. */
export interface Live2DTouchGestureOptions {
  /** Largest pointer travel of a tap. @default 8 */
  tapMaxTravel: number
  /** Longest press of a tap. @default 450 */
  tapMaxDurationMs: number
  /** Pointer travel over the head for each pat. @default 70 */
  patTravel: number
  /**
   * Length of one direction sample of a stroke. @default 8
   *
   * A pointer reports many small steps, and a step of 1 or 2 pixels can point
   * anywhere because of jitter. The tracker measures the direction only over
   * this much travel, so jitter does not look like a turn.
   */
  directionSegment: number
  /**
   * Cosine of the smallest angle between the first direction and a later
   * direction that counts as a turn back. @default -0.5
   *
   * -0.5 is 120 degrees. A straight stroke stays near 0 degrees. A stroke that
   * goes back and forth, or around in a circle, reaches 180 degrees.
   */
  turnBackCosine: number
}

export const defaultLive2DTouchGestureOptions: Live2DTouchGestureOptions = Object.freeze({
  tapMaxTravel: 8,
  tapMaxDurationMs: 450,
  patTravel: 70,
  directionSegment: 8,
  turnBackCosine: -0.5,
})

/** A pointer sample for the gesture tracker. */
export interface Live2DTouchPointerSample {
  x: number
  y: number
  atMs: number
  /** The touch at this point, or undefined outside the character. */
  hit: Omit<Live2DTouch, 'gesture'> | undefined
}

/** A unit vector of a stroke direction. */
interface Direction {
  x: number
  y: number
}

interface ActivePress {
  start: Live2DTouchPointerSample
  last: Live2DTouchPointerSample
  /** Travel distance accumulated over all regions. */
  travel: number
  /** Travel distance accumulated over the head. */
  patTravel: number
  /** Position where the current direction sample began. */
  segmentStart: { x: number, y: number }
  /** Direction of the first sample segment. */
  initialDirection?: Direction
  /** True when the stroke has reversed or turned across the head. */
  turnedBack: boolean
  /** True when at least one pat was already triggered during this press. */
  patted: boolean
}

function sampleDirection(press: ActivePress, sample: Live2DTouchPointerSample) {
  const dx = sample.x - press.segmentStart.x
  const dy = sample.y - press.segmentStart.y
  const distance = Math.hypot(dx, dy)
  if (distance < defaultLive2DTouchGestureOptions.directionSegment)
    return

  const current: Direction = { x: dx / distance, y: dy / distance }
  press.segmentStart = { x: sample.x, y: sample.y }

  if (!press.initialDirection) {
    press.initialDirection = current
    return
  }

  const dot = press.initialDirection.x * current.x + press.initialDirection.y * current.y
  if (dot <= defaultLive2DTouchGestureOptions.turnBackCosine)
    press.turnedBack = true
}

/**
 * Tracks pointer events and emits taps and pats.
 */
export function createLive2DTouchGestureTracker(
  options: Live2DTouchGestureOptions = defaultLive2DTouchGestureOptions,
) {
  let press: ActivePress | undefined

  function down(sample: Live2DTouchPointerSample) {
    if (!sample.hit) {
      press = undefined
      return
    }
    press = {
      start: sample,
      last: sample,
      travel: 0,
      patTravel: 0,
      segmentStart: { x: sample.x, y: sample.y },
      turnedBack: false,
      patted: false,
    }
  }

  function move(sample: Live2DTouchPointerSample): Live2DTouch | undefined {
    if (!press)
      return undefined

    const step = Math.hypot(sample.x - press.last.x, sample.y - press.last.y)
    press.travel += step
    press.last = sample

    if (sample.hit?.region !== 'head') {
      // Pats are measured only over the head. Leaving the head restarts the current sample.
      press.segmentStart = { x: sample.x, y: sample.y }
      return undefined
    }

    press.patTravel += step
    sampleDirection(press, sample)
    if (!press.turnedBack || press.patTravel < options.patTravel)
      return undefined

    press.patTravel = 0
    press.patted = true
    return { ...sample.hit, gesture: 'pat' }
  }

  function up(sample: Live2DTouchPointerSample): Live2DTouch | undefined {
    const current = press
    press = undefined
    if (!current || current.patted || !current.start.hit)
      return undefined

    const travel = current.travel + Math.hypot(sample.x - current.last.x, sample.y - current.last.y)
    if (travel > options.tapMaxTravel || sample.atMs - current.start.atMs > options.tapMaxDurationMs)
      return undefined

    return { ...current.start.hit, gesture: 'tap' }
  }

  function cancel() {
    press = undefined
  }

  return { down, move, up, cancel }
}

/** Parameter offsets that a touch reaction adds on top of the other motion. */
export interface Live2DTouchReactionOffsets {
  /** Head angles, in degrees. */
  angleX: number
  angleY: number
  angleZ: number
  /** Body angles, in degrees. */
  bodyAngleX: number
  bodyAngleY: number
  /** Share of eye opening to close, from 0 to 1. */
  eyeSquint: number
}

interface Impulse {
  startedAt: number
  attack: number
  decay: number
  peak: Live2DTouchReactionOffsets
}

const zeroOffsets: Live2DTouchReactionOffsets = Object.freeze({
  angleX: 0,
  angleY: 0,
  angleZ: 0,
  bodyAngleX: 0,
  bodyAngleY: 0,
  eyeSquint: 0,
})

function impulseFor(touch: Live2DTouch, startedAt: number): Impulse {
  const side = Math.min(1, Math.max(-1, touch.side))
  if (touch.region === 'head' && touch.gesture === 'pat') {
    return {
      startedAt,
      attack: 0.15,
      decay: 0.7,
      peak: { ...zeroOffsets, angleY: -5, angleZ: side * 9, eyeSquint: 0.65 },
    }
  }
  if (touch.region === 'head') {
    return {
      startedAt,
      attack: 0.05,
      decay: 0.35,
      peak: { ...zeroOffsets, angleX: -side * 4, angleY: -7, angleZ: side * 6, eyeSquint: 0.45 },
    }
  }
  return {
    startedAt,
    attack: 0.05,
    decay: 0.3,
    peak: { ...zeroOffsets, angleY: 6, bodyAngleX: -side * 4, bodyAngleY: -3 },
  }
}

function envelope(impulse: Impulse, now: number): number {
  const elapsed = now - impulse.startedAt
  if (elapsed < 0)
    return 0
  if (elapsed < impulse.attack)
    return Math.sin(elapsed / impulse.attack * Math.PI / 2)
  return Math.exp(-(elapsed - impulse.attack) / impulse.decay)
}

/**
 * Creates the procedural reaction of one model to touches.
 *
 * Each touch adds an impulse with a short rise and an exponential decay.
 * Repeated pats overlap, so a long stroke keeps the head tilted and the eyes
 * narrowed. The sum is bounded, so many fast taps cannot twist the head.
 */
export function createLive2DTouchReaction() {
  let impulses: Impulse[] = []

  function trigger(touch: Live2DTouch, nowSeconds: number) {
    impulses.push(impulseFor(touch, nowSeconds))
    if (impulses.length > 8)
      impulses = impulses.slice(-8)
  }

  function sample(nowSeconds: number): Live2DTouchReactionOffsets {
    impulses = impulses.filter(impulse => nowSeconds - impulse.startedAt < impulse.attack + impulse.decay * 6)
    if (impulses.length === 0)
      return zeroOffsets

    const sum = { ...zeroOffsets }
    for (const impulse of impulses) {
      const weight = envelope(impulse, nowSeconds)
      for (const key of Object.keys(sum) as (keyof Live2DTouchReactionOffsets)[])
        sum[key] += impulse.peak[key] * weight
    }

    return {
      angleX: Math.min(10, Math.max(-10, sum.angleX)),
      angleY: Math.min(10, Math.max(-10, sum.angleY)),
      angleZ: Math.min(14, Math.max(-14, sum.angleZ)),
      bodyAngleX: Math.min(6, Math.max(-6, sum.bodyAngleX)),
      bodyAngleY: Math.min(6, Math.max(-6, sum.bodyAngleY)),
      eyeSquint: Math.min(0.8, Math.max(0, sum.eyeSquint)),
    }
  }

  function reset() {
    impulses = []
  }

  return { trigger, sample, reset }
}

/**
 * Finds the motion group that answers a touch, when the model has one.
 *
 * Cubism sample models name these groups `TapBody` or `tap_body`. The match
 * ignores case and separators.
 */
export function findLive2DTouchMotionGroup(groupNames: readonly string[], region: Live2DTouchRegion): string | undefined {
  const wanted = region === 'head' ? ['taphead', 'pathead', 'flickhead'] : ['tapbody', 'tap']
  const normalized = groupNames.map(name => ({ name, key: name.toLowerCase().replace(/[^a-z]/g, '') }))
  for (const key of wanted) {
    const match = normalized.find(group => group.key === key)
    if (match)
      return match.name
  }
  return undefined
}
