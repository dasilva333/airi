/**
 * Pass 2 calibrated retargeting and leg IK kernels.
 * Hamilton quaternions use xyzw; distances use consistent world units.
 * Rest rotations are identity for the bundled normalized VRMA reference nodes.
 */
export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]

const EPS = 1e-10
const FRAME_EPS = 1e-5
const IDENTITY: Quat = [0, 0, 0, 1]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const mul = (v: Vec3, n: number): Vec3 => [v[0] * n, v[1] * n, v[2] * n]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(...sub(a, b))
const copy3 = (v: Vec3): Vec3 => [v[0], v[1], v[2]]
const rejectFrom = (v: Vec3, unitAxis: Vec3): Vec3 => sub(v, mul(unitAxis, dot(v, unitAxis)))

function requireFiniteVec(v: Vec3, name: string): void {
  if (!v.every(Number.isFinite))
    throw new Error(`${name} must contain finite coordinates`)
}

export function tryUnit(v: Vec3, epsilon = EPS): Vec3 | null {
  const n = Math.hypot(...v)
  return Number.isFinite(n) && n > epsilon ? mul(v, 1 / n) : null
}

export function normalizeQuaternion(q: Quat): Quat {
  const n = Math.hypot(...q)
  if (!Number.isFinite(n) || n <= EPS)
    throw new Error('Quaternion must be finite and nonzero')
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n]
}

export function multiplyQuaternion(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}

export function inverseUnit(q: Quat): Quat {
  const n = normalizeQuaternion(q)
  return [-n[0], -n[1], -n[2], n[3]]
}

export function rotateVector(q: Quat, v: Vec3): Vec3 {
  const unit = normalizeQuaternion(q)
  const r = multiplyQuaternion(multiplyQuaternion(unit, [v[0], v[1], v[2], 0]), inverseUnit(unit))
  return [r[0], r[1], r[2]]
}

export function hemisphere(q: Quat, previous?: Quat): Quat {
  const n = normalizeQuaternion(q)
  if (!previous)
    return n
  const p = normalizeQuaternion(previous)
  const sameSide = n.reduce((sum, value, i) => sum + value * p[i], 0) >= 0
  return sameSide ? n : [-n[0], -n[1], -n[2], -n[3]]
}

export function localFromWorld(parentWorld: Quat, world: Quat, previousLocal?: Quat): Quat {
  return hemisphere(multiplyQuaternion(inverseUnit(parentWorld), normalizeQuaternion(world)), previousLocal)
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  const qa = normalizeQuaternion(a)
  let qb = normalizeQuaternion(b)

  let cosHalfTheta = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]
  if (cosHalfTheta < 0) {
    qb = [-qb[0], -qb[1], -qb[2], -qb[3]]
    cosHalfTheta = -cosHalfTheta
  }

  if (Math.abs(cosHalfTheta) >= 1.0)
    return qa

  const halfTheta = Math.acos(Math.min(1.0, Math.max(-1.0, cosHalfTheta)))
  const sinHalfTheta = Math.sqrt(Math.max(0, 1.0 - cosHalfTheta * cosHalfTheta))

  if (sinHalfTheta < 0.001) {
    return normalizeQuaternion([
      qa[0] * (1 - t) + qb[0] * t,
      qa[1] * (1 - t) + qb[1] * t,
      qa[2] * (1 - t) + qb[2] * t,
      qa[3] * (1 - t) + qb[3] * t,
    ])
  }

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta

  return [
    qa[0] * ratioA + qb[0] * ratioB,
    qa[1] * ratioA + qb[1] * ratioB,
    qa[2] * ratioA + qb[2] * ratioB,
    qa[3] * ratioA + qb[3] * ratioB,
  ]
}

function quaternionFromBasis(x: Vec3, y: Vec3, z: Vec3): Quat {
  // Columns form a right-handed orthonormal basis.
  const m00 = x[0]; const m01 = y[0]; const m02 = z[0]
  const m10 = x[1]; const m11 = y[1]; const m12 = z[1]
  const m20 = x[2]; const m21 = y[2]; const m22 = z[2]
  const trace = m00 + m11 + m22
  let q: Quat
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1)
    q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]
  }
  else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]
  }
  else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]
  }
  else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
    q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]
  }
  return normalizeQuaternion(q)
}

function frame(primary: Vec3, secondary: Vec3): { q: Quat, x: Vec3, y: Vec3, z: Vec3 } | null {
  const y = tryUnit(primary)
  const lateral = tryUnit(secondary)
  if (!y || !lateral)
    return null
  const x = tryUnit(rejectFrom(lateral, y), FRAME_EPS)
  if (!x)
    return null
  const z = tryUnit(cross(x, y))!
  const correctedX = tryUnit(cross(y, z))!
  return { q: quaternionFromBasis(correctedX, y, z), x: correctedX, y, z }
}

export interface FrameInput {
  primaryWorld: Vec3
  secondaryWorld: Vec3
  restPrimary: Vec3
  restSecondary: Vec3
  previousDelta?: Quat
}

export interface RotationResult {
  rotation: Quat
  fallback: 'none' | 'transported-secondary' | 'held-previous'
}

/**
 * Returns delta = observedFrame * inverse(restFrame), NOT a universal bind pose.
 * For normalized identity-rest VRMA joints this delta is the desired world q.
 * With a nonidentity rest-world q, compose delta * restWorld before localizing.
 */
export function solveFrameDelta(input: FrameInput): RotationResult {
  const rest = frame(input.restPrimary, input.restSecondary)
  if (!rest)
    throw new Error('Rest frame must have two independent finite axes')
  const previous = normalizeQuaternion(input.previousDelta ?? IDENTITY)
  const primary = tryUnit(input.primaryWorld)
  if (!primary)
    return { rotation: previous, fallback: 'held-previous' }

  let observed = frame(primary, input.secondaryWorld)
  let fallback: RotationResult['fallback'] = 'none'
  if (!observed) {
    // Transport the last valid secondary reference to the newly observed axis.
    observed = frame(primary, rotateVector(previous, rest.x))
    if (!observed) {
      const previousForward = rotateVector(previous, rest.z)
      observed = frame(primary, cross(primary, previousForward))
    }
    fallback = 'transported-secondary'
  }
  if (!observed)
    return { rotation: previous, fallback: 'held-previous' }

  return {
    rotation: hemisphere(multiplyQuaternion(observed.q, inverseUnit(rest.q)), previous),
    fallback,
  }
}

function deterministicPerpendicular(unitAxis: Vec3): Vec3 {
  // Last-resort first-frame policy only.
  const values = unitAxis.map(Math.abs)
  const index = values.indexOf(Math.min(...values))
  const axis: Vec3 = index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : [0, 0, 1]
  return tryUnit(rejectFrom(axis, unitAxis))!
}

/** Direction fit, with an explicit axis for the underdetermined exact half-turn. */
export function shortestArc(from: Vec3, to: Vec3, halfTurnAxisHint?: Vec3): Quat {
  const a = tryUnit(from)
  const b = tryUnit(to)
  if (!a || !b)
    throw new Error('Shortest arc requires two nonzero finite directions')
  const c = cross(a, b)
  const sine = Math.hypot(...c)
  const cosine = Math.max(-1, Math.min(1, dot(a, b)))
  if (sine > EPS) {
    const half = Math.atan2(sine, cosine) / 2
    const axis = mul(c, 1 / sine)
    return [axis[0] * Math.sin(half), axis[1] * Math.sin(half), axis[2] * Math.sin(half), Math.cos(half)]
  }
  if (cosine >= 0)
    return [0, 0, 0, 1]
  const axis = (halfTurnAxisHint && tryUnit(rejectFrom(halfTurnAxisHint, a))) || deterministicPerpendicular(a)
  return [axis[0], axis[1], axis[2], 0]
}

export function solveParentSwing(
  parentWorld: Quat,
  restDirectionLocal: Vec3,
  desiredDirectionWorld: Vec3,
  previousWorld?: Quat,
  halfTurnAxisWorld?: Vec3,
): Quat {
  const rest = tryUnit(restDirectionLocal)
  if (!rest)
    throw new Error('Rest direction must be finite and nonzero')
  const parent = normalizeQuaternion(parentWorld)
  const desired = tryUnit(desiredDirectionWorld)
  if (!desired)
    return hemisphere(previousWorld ?? parent, previousWorld)
  const restWorld = rotateVector(parent, rest)
  const swing = shortestArc(restWorld, desired, halfTurnAxisWorld)
  return hemisphere(multiplyQuaternion(swing, parent), previousWorld)
}

export interface TwoBoneInput {
  root: Vec3
  target: Vec3
  pole: Vec3
  upperLength: number
  lowerLength: number
  previousKnee?: Vec3
  // Needed when target == root and no target direction can be observed.
  directionHint?: Vec3
}

export interface TwoBoneResult {
  knee: Vec3
  ankle: Vec3
  targetError: number
  clamped: boolean
  poleFallback: 'none' | 'previous-knee' | 'deterministic-first-frame'
}

/**
 * Analytic positional IK.
 * An unreachable requested anchor stays unchanged; targetError reports failure
 * to reach it rather than silently moving the anchor to chase the animated foot.
 */
export function solveTwoBoneIK(input: TwoBoneInput): TwoBoneResult {
  requireFiniteVec(input.root, 'root')
  requireFiniteVec(input.target, 'target')
  requireFiniteVec(input.pole, 'pole')
  if (input.previousKnee)
    requireFiniteVec(input.previousKnee, 'previousKnee')
  const upper = input.upperLength
  const lower = input.lowerLength
  if (!Number.isFinite(upper) || !Number.isFinite(lower) || upper <= EPS || lower <= EPS)
    throw new Error('Bone lengths must be finite and positive')

  const toTarget = sub(input.target, input.root)
  const requestedDistance = Math.hypot(...toTarget)
  const direction = tryUnit(toTarget) ?? (input.directionHint && tryUnit(input.directionHint))
  if (!direction)
    throw new Error('Coincident target requires a valid directionHint')
  const solvedDistance = Math.min(upper + lower, Math.max(Math.abs(upper - lower), requestedDistance))

  let bend = tryUnit(rejectFrom(sub(input.pole, input.root), direction), FRAME_EPS)
  let poleFallback: TwoBoneResult['poleFallback'] = 'none'
  if (!bend && input.previousKnee) {
    bend = tryUnit(rejectFrom(sub(input.previousKnee, input.root), direction), FRAME_EPS)
    if (bend)
      poleFallback = 'previous-knee'
  }
  if (!bend) {
    bend = deterministicPerpendicular(direction)
    poleFallback = 'deterministic-first-frame'
  }

  // Equal-length fully folded chain has no unique along-target direction.
  const along = solvedDistance <= EPS ? 0 : (upper * upper - lower * lower + solvedDistance * solvedDistance) / (2 * solvedDistance)
  const height = Math.sqrt(Math.max(0, upper * upper - along * along))
  const knee = add(input.root, add(mul(direction, along), mul(bend, height)))
  const ankle = add(input.root, mul(direction, solvedDistance))
  const targetError = distance(ankle, input.target)
  return { knee, ankle, targetError, clamped: targetError > 1e-8, poleFallback }
}

export function solveLegLocalRotations(input: {
  parentWorld: Quat
  upperRestDirection: Vec3
  lowerRestDirection: Vec3
  root: Vec3
  knee: Vec3
  ankle: Vec3
  halfTurnAxisWorld?: Vec3
}): { upperLocal: Quat, lowerLocal: Quat } {
  const upperWorld = solveParentSwing(input.parentWorld, input.upperRestDirection, sub(input.knee, input.root), undefined, input.halfTurnAxisWorld)
  const lowerWorld = solveParentSwing(upperWorld, input.lowerRestDirection, sub(input.ankle, input.knee), undefined, input.halfTurnAxisWorld)
  return {
    upperLocal: localFromWorld(input.parentWorld, upperWorld),
    lowerLocal: localFromWorld(upperWorld, lowerWorld),
  }
}

export interface ContactPolicy {
  // Regressed physical feature thresholds.
  enterThreshold: number
  exitThreshold: number
  enterFrames: number
  exitFrames: number
}

export interface ContactState {
  active: boolean
  onFrames: number
  offFrames: number
  anchor: Vec3 | null
  candidateAnchor: Vec3 | null
}

export function emptyContact(): ContactState {
  return { active: false, onFrames: 0, offFrames: 0, anchor: null, candidateAnchor: null }
}

/**
 * One landmark's hysteresis/anchor kernel. Use separate states for ankle/toe.
 */
export function advanceContact(previous: ContactState, sample: {
  value: number
  point: Vec3
  mayEnter: boolean
  mayStay: boolean
}, policy: ContactPolicy): ContactState {
  requireFiniteVec(sample.point, 'contact point')
  if (!Number.isFinite(sample.value))
    throw new Error('Contact feature must be finite')
  if (!Number.isFinite(policy.enterThreshold) || !Number.isFinite(policy.exitThreshold) || policy.enterThreshold <= policy.exitThreshold)
    throw new Error('Contact enter threshold must exceed exit threshold')
  if (![policy.enterFrames, policy.exitFrames].every(n => Number.isInteger(n) && n >= 1))
    throw new Error('Contact frame counts must be positive integers')

  if (previous.active) {
    if (!previous.anchor)
      throw new Error('An active contact must have an anchor')
    const offFrames = sample.value < policy.exitThreshold || !sample.mayStay ? previous.offFrames + 1 : 0
    if (offFrames >= policy.exitFrames)
      return emptyContact()
    return { active: true, onFrames: 0, offFrames, anchor: copy3(previous.anchor), candidateAnchor: null }
  }
  if (!sample.mayEnter || sample.value < policy.enterThreshold)
    return emptyContact()
  const onFrames = previous.onFrames + 1
  const candidate = previous.candidateAnchor ?? sample.point
  if (onFrames >= policy.enterFrames)
    return { active: true, onFrames: 0, offFrames: 0, anchor: copy3(candidate), candidateAnchor: null }
  return { active: false, onFrames, offFrames: 0, anchor: null, candidateAnchor: copy3(candidate) }
}

export interface LegIKChain {
  upperNode: number
  lowerNode: number
  footNode: number
  hipOffset: Vec3
  upperLength: number
  lowerLength: number
  footLength: number
  kneeJoint: number
  ankleJoint: number
  toeJoint: number
  ankleContactChannel: number
  toeContactChannel: number
}

// HumanML3D-263 foot channels:
// feet_l = [joint 7 (ankle), joint 10 (toe)] -> channels 259, 260
// feet_r = [joint 8 (ankle), joint 11 (toe)] -> channels 261, 262
export const LEFT_LEG_CHAIN: LegIKChain = {
  upperNode: 14,
  lowerNode: 15,
  footNode: 16,
  hipOffset: [0.09, -0.02, 0],
  upperLength: 0.38,
  lowerLength: 0.42,
  footLength: 0.15,
  kneeJoint: 4,
  ankleJoint: 7,
  toeJoint: 10,
  ankleContactChannel: 259,
  toeContactChannel: 260,
}

export const RIGHT_LEG_CHAIN: LegIKChain = {
  upperNode: 17,
  lowerNode: 18,
  footNode: 19,
  hipOffset: [-0.09, -0.02, 0],
  upperLength: 0.38,
  lowerLength: 0.42,
  footLength: 0.15,
  kneeJoint: 5,
  ankleJoint: 8,
  toeJoint: 11,
  ankleContactChannel: 261,
  toeContactChannel: 262,
}

export interface LandmarkContactTrack {
  active: boolean
  anchor: Vec3 | null
}

/**
 * Detects contact intervals with offline two-pass hysteresis and backfills
 * confirmed contact intervals to their candidate start frame so initial entry
 * frames do not skate.
 */
export function detectLandmarkContacts(params: {
  seqLen: number
  values: Float32Array | number[]
  channelOffset: number
  points: Vec3[]
  mayEnter: (t: number) => boolean
  mayStay: (t: number) => boolean
  policy?: ContactPolicy
}): LandmarkContactTrack[] {
  const { seqLen, values, channelOffset, points, mayEnter, mayStay } = params
  const policy = params.policy ?? {
    enterThreshold: 0.6,
    exitThreshold: 0.3,
    enterFrames: 2,
    exitFrames: 2,
  }

  let state = emptyContact()
  let candidateStart = 0
  const intervals: Array<{ start: number, end: number, anchor: Vec3 }> = []

  for (let t = 0; t < seqLen; t++) {
    const val = values[t * 263 + channelOffset]
    const pt = points[t]
    const enter = mayEnter(t)
    const stay = mayStay(t)

    const prevState = state
    state = advanceContact(state, { value: val, point: pt, mayEnter: enter, mayStay: stay }, policy)

    if (!prevState.active && state.onFrames === 1) {
      candidateStart = t
    }

    if (!prevState.active && state.active && state.anchor) {
      intervals.push({
        start: candidateStart,
        end: t,
        anchor: copy3(state.anchor),
      })
    }
    else if (prevState.active && state.active) {
      if (intervals.length > 0) {
        intervals[intervals.length - 1].end = t
      }
    }
  }

  const result: LandmarkContactTrack[] = Array.from({ length: seqLen }, () => ({
    active: false,
    anchor: null,
  }))

  for (const interval of intervals) {
    for (let t = interval.start; t <= interval.end; t++) {
      result[t] = { active: true, anchor: copy3(interval.anchor) }
    }
  }

  return result
}

export interface SupportGateOptions {
  ankleMaxHeightEnter?: number
  ankleMaxHeightStay?: number
  toeMaxHeightEnter?: number
  toeMaxHeightStay?: number
  maxSpeed?: number
}

/**
 * Applies biped contact-aware leg IK, foot articulation, and shared root height adjustment.
 */
export function applyBipedContactIK(params: {
  seqLen: number
  fps?: number
  motionData: Float32Array
  worldPos: Vec3[][]
  rootRotations: Quat[]
  rootTranslations: Vec3[]
  localQuats: Record<number, Quat[]>
  leftChain?: LegIKChain | null
  rightChain?: LegIKChain | null
  policy?: ContactPolicy
  gates?: SupportGateOptions
}): {
  leftContactsActive: number
  rightContactsActive: number
  residuals: number[]
  rootHeightAdjustments: number[]
} {
  const {
    seqLen,
    fps = 20,
    motionData,
    worldPos,
    rootRotations,
    rootTranslations,
    localQuats,
  } = params

  const leftChain = params.leftChain === null ? null : (params.leftChain ?? LEFT_LEG_CHAIN)
  const rightChain = params.rightChain === null ? null : (params.rightChain ?? RIGHT_LEG_CHAIN)
  const policy = params.policy ?? {
    enterThreshold: 0.6,
    exitThreshold: 0.3,
    enterFrames: 2,
    exitFrames: 2,
  }
  const gates = params.gates ?? {}
  const ankleEnterH = gates.ankleMaxHeightEnter ?? 0.22
  const ankleStayH = gates.ankleMaxHeightStay ?? 0.28
  const toeEnterH = gates.toeMaxHeightEnter ?? 0.15
  const toeStayH = gates.toeMaxHeightStay ?? 0.20
  const maxSpd = gates.maxSpeed ?? 1.6

  // 1. Detect 4 independent contact tracks with offline backfilling
  const emptyTrack = (): LandmarkContactTrack[] =>
    Array.from({ length: seqLen }, () => ({ active: false, anchor: null }))

  let leftAnkleContacts = emptyTrack()
  let leftToeContacts = emptyTrack()
  if (leftChain) {
    const leftAnkleSpeed = (t: number) => t > 0 ? distance(worldPos[leftChain.ankleJoint][t], worldPos[leftChain.ankleJoint][t - 1]) * fps : 0
    const leftToeSpeed = (t: number) => t > 0 ? distance(worldPos[leftChain.toeJoint][t], worldPos[leftChain.toeJoint][t - 1]) * fps : 0

    leftAnkleContacts = detectLandmarkContacts({
      seqLen,
      values: motionData,
      channelOffset: leftChain.ankleContactChannel,
      points: worldPos[leftChain.ankleJoint],
      mayEnter: t => worldPos[leftChain.ankleJoint][t][1] < ankleEnterH && leftAnkleSpeed(t) < maxSpd,
      mayStay: t => worldPos[leftChain.ankleJoint][t][1] < ankleStayH,
      policy,
    })

    leftToeContacts = detectLandmarkContacts({
      seqLen,
      values: motionData,
      channelOffset: leftChain.toeContactChannel,
      points: worldPos[leftChain.toeJoint],
      mayEnter: t => worldPos[leftChain.toeJoint][t][1] < toeEnterH && leftToeSpeed(t) < maxSpd,
      mayStay: t => worldPos[leftChain.toeJoint][t][1] < toeStayH,
      policy,
    })
  }

  let rightAnkleContacts = emptyTrack()
  let rightToeContacts = emptyTrack()
  if (rightChain) {
    const rightAnkleSpeed = (t: number) => t > 0 ? distance(worldPos[rightChain.ankleJoint][t], worldPos[rightChain.ankleJoint][t - 1]) * fps : 0
    const rightToeSpeed = (t: number) => t > 0 ? distance(worldPos[rightChain.toeJoint][t], worldPos[rightChain.toeJoint][t - 1]) * fps : 0

    rightAnkleContacts = detectLandmarkContacts({
      seqLen,
      values: motionData,
      channelOffset: rightChain.ankleContactChannel,
      points: worldPos[rightChain.ankleJoint],
      mayEnter: t => worldPos[rightChain.ankleJoint][t][1] < ankleEnterH && rightAnkleSpeed(t) < maxSpd,
      mayStay: t => worldPos[rightChain.ankleJoint][t][1] < ankleStayH,
      policy,
    })

    rightToeContacts = detectLandmarkContacts({
      seqLen,
      values: motionData,
      channelOffset: rightChain.toeContactChannel,
      points: worldPos[rightChain.toeJoint],
      mayEnter: t => worldPos[rightChain.toeJoint][t][1] < toeEnterH && rightToeSpeed(t) < maxSpd,
      mayStay: t => worldPos[rightChain.toeJoint][t][1] < toeStayH,
      policy,
    })
  }

  let leftContactsActive = 0
  let rightContactsActive = 0
  const residuals: number[] = []
  const rootHeightAdjustments: number[] = []

  let prevLeftKnee: Vec3 | undefined
  let prevRightKnee: Vec3 | undefined

  let leftReleaseBlend = 0
  let rightReleaseBlend = 0
  let lastSolvedLeftUpper: Quat | null = null
  let lastSolvedLeftLower: Quat | null = null
  let lastSolvedLeftFoot: Quat | null = null
  let lastSolvedRightUpper: Quat | null = null
  let lastSolvedRightLower: Quat | null = null
  let lastSolvedRightFoot: Quat | null = null

  const BLEND_FRAMES = 3

  for (let t = 0; t < seqLen; t++) {
    const lAnkle = leftAnkleContacts[t]
    const lToe = leftToeContacts[t]
    const rAnkle = rightAnkleContacts[t]
    const rToe = rightToeContacts[t]

    const leftActive = lAnkle.active || lToe.active
    const rightActive = rAnkle.active || rToe.active

    if (leftActive)
      leftContactsActive++
    if (rightActive)
      rightContactsActive++

    // Determine target ankle position for each leg
    let targetLeftAnkle: Vec3 | null = null
    if (leftChain) {
      if (lAnkle.active && lAnkle.anchor) {
        targetLeftAnkle = lAnkle.anchor
      }
      else if (lToe.active && lToe.anchor) {
        const ankleRaw = worldPos[leftChain.ankleJoint][t]
        const toeRaw = worldPos[leftChain.toeJoint][t]
        const dir = tryUnit(sub(ankleRaw, toeRaw)) ?? [0, 0, -1]
        targetLeftAnkle = add(lToe.anchor, mul(dir, leftChain.footLength))
      }
    }

    let targetRightAnkle: Vec3 | null = null
    if (rightChain) {
      if (rAnkle.active && rAnkle.anchor) {
        targetRightAnkle = rAnkle.anchor
      }
      else if (rToe.active && rToe.anchor) {
        const ankleRaw = worldPos[rightChain.ankleJoint][t]
        const toeRaw = worldPos[rightChain.toeJoint][t]
        const dir = tryUnit(sub(ankleRaw, toeRaw)) ?? [0, 0, -1]
        targetRightAnkle = add(rToe.anchor, mul(dir, rightChain.footLength))
      }
    }

    // 2. Dual-Leg Shared Pelvis / Root Height Adjustment
    let deltaY = 0
    const hipsWorld = rootRotations[t]
    if (leftChain && rightChain && targetLeftAnkle && targetRightAnkle) {
      const leftHip = add(rootTranslations[t], rotateVector(hipsWorld, leftChain.hipOffset))
      const rightHip = add(rootTranslations[t], rotateVector(hipsWorld, rightChain.hipOffset))
      const leftMaxReach = leftChain.upperLength + leftChain.lowerLength
      const rightMaxReach = rightChain.upperLength + rightChain.lowerLength
      const distL = distance(leftHip, targetLeftAnkle)
      const distR = distance(rightHip, targetRightAnkle)
      const excessL = Math.max(0, distL - leftMaxReach)
      const excessR = Math.max(0, distR - rightMaxReach)
      if (excessL > 0 || excessR > 0) {
        deltaY = Math.min(0.12, Math.max(excessL, excessR))
        rootTranslations[t][1] -= deltaY
      }
    }
    rootHeightAdjustments.push(deltaY)

    // 3. Solve Left Leg
    if (leftChain) {
      const leftHipOrigin = add(rootTranslations[t], rotateVector(hipsWorld, leftChain.hipOffset))
      if (targetLeftAnkle) {
        const kneePos = worldPos[leftChain.kneeJoint][t]
        const pole = add(kneePos, rotateVector(hipsWorld, [0, 0, 0.4]))
        const ik = solveTwoBoneIK({
          root: leftHipOrigin,
          target: targetLeftAnkle,
          pole,
          upperLength: leftChain.upperLength,
          lowerLength: leftChain.lowerLength,
          previousKnee: prevLeftKnee,
        })
        prevLeftKnee = ik.knee
        residuals.push(ik.targetError)

        const solved = solveLegLocalRotations({
          parentWorld: hipsWorld,
          upperRestDirection: [0, -1, 0],
          lowerRestDirection: [0, -1, 0],
          root: leftHipOrigin,
          knee: ik.knee,
          ankle: ik.ankle,
        })
        localQuats[leftChain.upperNode][t] = solved.upperLocal
        localQuats[leftChain.lowerNode][t] = solved.lowerLocal
        lastSolvedLeftUpper = solved.upperLocal
        lastSolvedLeftLower = solved.lowerLocal

        // Foot orientation solve
        const upperWorld = solveParentSwing(hipsWorld, [0, -1, 0], sub(ik.knee, leftHipOrigin))
        const lowerWorld = solveParentSwing(upperWorld, [0, -1, 0], sub(ik.ankle, ik.knee))

        let footWorld: Quat
        if (lAnkle.active && lToe.active && lToe.anchor) {
          // Flat sole contact: sole normal straight up [0, 1, 0]
          const groundDelta = [lToe.anchor[0] - ik.ankle[0], 0, lToe.anchor[2] - ik.ankle[2]] as Vec3
          const zAxis = tryUnit(groundDelta) ?? [0, 0, 1]
          const yAxis: Vec3 = [0, 1, 0]
          const xAxis = tryUnit(cross(yAxis, zAxis)) ?? [1, 0, 0]
          const correctedZ = tryUnit(cross(xAxis, yAxis))!
          footWorld = quaternionFromBasis(xAxis, yAxis, correctedZ)
        }
        else if (lToe.active && lToe.anchor) {
          footWorld = solveParentSwing(lowerWorld, [0, 0, 1], sub(lToe.anchor, ik.ankle))
        }
        else {
          // Heel strike: foot swings along raw ankle-to-toe
          const rawAnkleToToe = sub(worldPos[leftChain.toeJoint][t], worldPos[leftChain.ankleJoint][t])
          footWorld = solveParentSwing(lowerWorld, [0, 0, 1], rawAnkleToToe)
        }

        const footLocal = localFromWorld(lowerWorld, footWorld)
        localQuats[leftChain.footNode][t] = footLocal
        lastSolvedLeftFoot = footLocal
        leftReleaseBlend = BLEND_FRAMES
      }
      else {
        if (leftReleaseBlend > 0 && lastSolvedLeftUpper && lastSolvedLeftLower && lastSolvedLeftFoot) {
          const blendAlpha = (BLEND_FRAMES + 1 - leftReleaseBlend) / BLEND_FRAMES
          localQuats[leftChain.upperNode][t] = slerp(lastSolvedLeftUpper, localQuats[leftChain.upperNode][t], blendAlpha)
          localQuats[leftChain.lowerNode][t] = slerp(lastSolvedLeftLower, localQuats[leftChain.lowerNode][t], blendAlpha)
          localQuats[leftChain.footNode][t] = slerp(lastSolvedLeftFoot, localQuats[leftChain.footNode][t], blendAlpha)
          leftReleaseBlend--
        }
      }
    }

    // 4. Solve Right Leg
    if (rightChain) {
      const rightHipOrigin = add(rootTranslations[t], rotateVector(hipsWorld, rightChain.hipOffset))
      if (targetRightAnkle) {
        const kneePos = worldPos[rightChain.kneeJoint][t]
        const pole = add(kneePos, rotateVector(hipsWorld, [0, 0, 0.4]))
        const ik = solveTwoBoneIK({
          root: rightHipOrigin,
          target: targetRightAnkle,
          pole,
          upperLength: rightChain.upperLength,
          lowerLength: rightChain.lowerLength,
          previousKnee: prevRightKnee,
        })
        prevRightKnee = ik.knee
        residuals.push(ik.targetError)

        const solved = solveLegLocalRotations({
          parentWorld: hipsWorld,
          upperRestDirection: [0, -1, 0],
          lowerRestDirection: [0, -1, 0],
          root: rightHipOrigin,
          knee: ik.knee,
          ankle: ik.ankle,
        })
        localQuats[rightChain.upperNode][t] = solved.upperLocal
        localQuats[rightChain.lowerNode][t] = solved.lowerLocal
        lastSolvedRightUpper = solved.upperLocal
        lastSolvedRightLower = solved.lowerLocal

        // Foot orientation solve
        const upperWorld = solveParentSwing(hipsWorld, [0, -1, 0], sub(ik.knee, rightHipOrigin))
        const lowerWorld = solveParentSwing(upperWorld, [0, -1, 0], sub(ik.ankle, ik.knee))

        let footWorld: Quat
        if (rAnkle.active && rToe.active && rToe.anchor) {
          const groundDelta = [rToe.anchor[0] - ik.ankle[0], 0, rToe.anchor[2] - ik.ankle[2]] as Vec3
          const zAxis = tryUnit(groundDelta) ?? [0, 0, 1]
          const yAxis: Vec3 = [0, 1, 0]
          const xAxis = tryUnit(cross(yAxis, zAxis)) ?? [1, 0, 0]
          const correctedZ = tryUnit(cross(xAxis, yAxis))!
          footWorld = quaternionFromBasis(xAxis, yAxis, correctedZ)
        }
        else if (rToe.active && rToe.anchor) {
          footWorld = solveParentSwing(lowerWorld, [0, 0, 1], sub(rToe.anchor, ik.ankle))
        }
        else {
          const rawAnkleToToe = sub(worldPos[rightChain.toeJoint][t], worldPos[rightChain.ankleJoint][t])
          footWorld = solveParentSwing(lowerWorld, [0, 0, 1], rawAnkleToToe)
        }

        const footLocal = localFromWorld(lowerWorld, footWorld)
        localQuats[rightChain.footNode][t] = footLocal
        lastSolvedRightFoot = footLocal
        rightReleaseBlend = BLEND_FRAMES
      }
      else {
        if (rightReleaseBlend > 0 && lastSolvedRightUpper && lastSolvedRightLower && lastSolvedRightFoot) {
          const blendAlpha = (BLEND_FRAMES + 1 - rightReleaseBlend) / BLEND_FRAMES
          localQuats[rightChain.upperNode][t] = slerp(lastSolvedRightUpper, localQuats[rightChain.upperNode][t], blendAlpha)
          localQuats[rightChain.lowerNode][t] = slerp(lastSolvedRightLower, localQuats[rightChain.lowerNode][t], blendAlpha)
          localQuats[rightChain.footNode][t] = slerp(lastSolvedRightFoot, localQuats[rightChain.footNode][t], blendAlpha)
          rightReleaseBlend--
        }
      }
    }
  }

  return { leftContactsActive, rightContactsActive, residuals, rootHeightAdjustments }
}

/**
 * Single-leg wrapper for backward compatibility with isolated tests.
 */
export function applyLegContactIK(params: {
  seqLen: number
  fps?: number
  motionData: Float32Array
  worldPos: Vec3[][]
  rootRotations: Quat[]
  rootTranslations: Vec3[]
  localQuats: Record<number, Quat[]>
  chain: LegIKChain
  policy?: ContactPolicy
}): { contactsActive: number, residuals: number[] } {
  const isLeft = params.chain.upperNode === 14
  const res = applyBipedContactIK({
    seqLen: params.seqLen,
    fps: params.fps,
    motionData: params.motionData,
    worldPos: params.worldPos,
    rootRotations: params.rootRotations,
    rootTranslations: params.rootTranslations,
    localQuats: params.localQuats,
    leftChain: isLeft ? params.chain : null,
    rightChain: isLeft ? null : params.chain,
    policy: params.policy,
  })
  return {
    contactsActive: isLeft ? res.leftContactsActive : res.rightContactsActive,
    residuals: res.residuals,
  }
}
