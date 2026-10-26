import type { ContactState, Quat, Vec3 } from './retargeting'

import assert from 'node:assert/strict'

import { describe, it } from 'vitest'

import {
  add,
  advanceContact,
  cross,
  distance,
  dot,
  emptyContact,
  hemisphere,
  localFromWorld,
  multiplyQuaternion,
  normalizeQuaternion,
  rotateVector,
  slerp,
  solveFrameDelta,
  solveLegLocalRotations,
  solveParentSwing,
  solveTwoBoneIK,
  tryUnit,
} from './retargeting'

const I: Quat = [0, 0, 0, 1]
const UP: Vec3 = [0, 1, 0]
const RIGHT: Vec3 = [1, 0, 0]
const FORWARD: Vec3 = [0, 0, 1]
function axisAngle(axis: Vec3, angle: number): Quat {
  const a = tryUnit(axis)!
  return [a[0] * Math.sin(angle / 2), a[1] * Math.sin(angle / 2), a[2] * Math.sin(angle / 2), Math.cos(angle / 2)]
}
function near(a: number, b: number, eps = 1e-8): void {
  assert(Math.abs(a - b) <= eps, `${a} differs from ${b} by ${Math.abs(a - b)}`)
}
function nearVector(a: Vec3, b: Vec3, eps = 1e-8): void {
  assert(distance(a, b) <= eps, `${JSON.stringify(a)} differs from ${JSON.stringify(b)}`)
}
function sameRotation(a: Quat, b: Quat): void {
  for (const v of [RIGHT, UP, FORWARD])
    nearVector(rotateVector(a, v), rotateVector(b, v))
}
function properRotation(q: Quat): void {
  assert(q.every(Number.isFinite))
  near(Math.hypot(...q), 1)
  const x = rotateVector(q, RIGHT); const y = rotateVector(q, UP); const z = rotateVector(q, FORWARD)
  near(dot(x, y), 0)
  near(dot(x, z), 0)
  near(dot(y, z), 0)
  near(dot(cross(x, y), z), 1)
}
function torso(primaryWorld: Vec3, secondaryWorld: Vec3, previousDelta?: Quat) {
  return solveFrameDelta({
    primaryWorld,
    secondaryWorld,
    restPrimary: UP,
    restSecondary: RIGHT,
    previousDelta,
  })
}

describe('calibrated frame invariants', () => {
  it('neutral pose exports identity rather than a built-in rest tilt', () => {
    sameRotation(torso(UP, RIGHT).rotation, I)
  })

  it('a 90 degree decoded heading rotates the complete torso frame', () => {
    const q = axisAngle(UP, -Math.PI / 2)
    const result = torso(rotateVector(q, UP), rotateVector(q, RIGHT))
    nearVector(rotateVector(result.rotation, FORWARD), [-1, 0, 0])
    sameRotation(result.rotation, q)
  })

  it('retains pelvis pitch and roll together with yaw', () => {
    const q = normalizeQuaternion(multiplyQuaternion(axisAngle(UP, 0.7), multiplyQuaternion(axisAngle(RIGHT, 0.4), axisAngle(FORWARD, -0.3))))
    const result = torso(rotateVector(q, UP), rotateVector(q, RIGHT))
    sameRotation(result.rotation, q)
    properRotation(result.rotation)
  })

  it('calibrates a non-axis-aligned rest frame with the correct multiplication order', () => {
    const rest = axisAngle(FORWARD, 0.35)
    const wanted = multiplyQuaternion(axisAngle(UP, 0.7), axisAngle(RIGHT, -0.2))
    const p = rotateVector(rest, UP); const s = rotateVector(rest, RIGHT)
    const result = solveFrameDelta({ restPrimary: p, restSecondary: s, primaryWorld: rotateVector(wanted, p), secondaryWorld: rotateVector(wanted, s) })
    sameRotation(result.rotation, wanted)
  })

  it('holds the previous frame when its primary landmarks collapse', () => {
    const previous = axisAngle(UP, -0.9)
    const result = torso([0, 0, 0], RIGHT, previous)
    assert.equal(result.fallback, 'held-previous')
    sameRotation(result.rotation, previous)
  })

  it('preserves previous heading when lateral landmarks become collinear', () => {
    const previous = axisAngle(UP, 1.1)
    const result = torso(UP, [0, 3, 0], previous)
    assert.equal(result.fallback, 'transported-secondary')
    sameRotation(result.rotation, previous)
  })

  it('tracks a newly tilted primary axis while transporting a missing lateral reference', () => {
    const primary: Vec3 = [0, Math.SQRT1_2, Math.SQRT1_2]
    const result = torso(primary, [0, 0, 0], I)
    nearVector(rotateVector(result.rotation, UP), primary)
    properRotation(result.rotation)
  })

  it('orthogonalizes skewed landmarks into a proper right-handed rotation', () => {
    const result = torso([0, 2, 0], [3, 4, 0])
    sameRotation(result.rotation, I)
    properRotation(result.rotation)
  })

  it('rejects invalid rest calibration rather than silently inventing a downward axis', () => {
    assert.throws(() => solveFrameDelta({ restPrimary: UP, restSecondary: UP, primaryWorld: UP, secondaryWorld: RIGHT }), /Rest frame/)
    assert.equal(tryUnit([0, 0, 0]), null)
  })

  it('local/world conversion works for noncommuting parent and child rotations', () => {
    const parent = normalizeQuaternion(multiplyQuaternion(axisAngle(UP, 0.6), axisAngle(RIGHT, -0.4)))
    const childLocal = normalizeQuaternion(multiplyQuaternion(axisAngle(FORWARD, 0.5), axisAngle(UP, -0.3)))
    const childWorld = multiplyQuaternion(parent, childLocal)
    sameRotation(localFromWorld(parent, childWorld), childLocal)
  })
})

describe('parent-aware swing invariants', () => {
  it('an upright bone inherits its parent heading instead of cancelling it', () => {
    const parent = axisAngle(UP, 0.8)
    const world = solveParentSwing(parent, UP, rotateVector(parent, UP))
    sameRotation(world, parent)
  })

  it('fits a calibrated nonunit ankle-to-toe rest direction', () => {
    const restFoot: Vec3 = [0, 0, 0.2]
    const wantedWorldDirection: Vec3 = [0, 0, 1]
    const world = solveParentSwing(I, restFoot, wantedWorldDirection)
    nearVector(rotateVector(world, tryUnit(restFoot)!), wantedWorldDirection)
  })

  it('handles an exact opposite direction with an anatomical half-turn axis hint', () => {
    const world = solveParentSwing(I, UP, [0, -1, 0], undefined, FORWARD)
    nearVector(rotateVector(world, UP), [0, -1, 0])
    sameRotation(world, axisAngle(FORWARD, Math.PI))
  })

  it('near-opposite direction changes stay physically close after hemisphere alignment', () => {
    const a = solveParentSwing(I, FORWARD, [0, 0.001, -1], undefined, UP)
    const b = solveParentSwing(I, FORWARD, [0, -0.001, -1], a, UP)
    for (const v of [RIGHT, UP, FORWARD])
      near(distance(rotateVector(a, v), rotateVector(b, v)), 0, 0.01)
  })

  it('a collapsed limb direction preserves an explicit previous orientation', () => {
    const previous = axisAngle(RIGHT, 0.5)
    const world = solveParentSwing(I, UP, [0, 0, 0], previous)
    sameRotation(world, previous)
  })

  it('hemisphere alignment changes quaternion sign without changing the rotation', () => {
    const flipped: Quat = [-0, -0, -0, -1]
    const aligned = hemisphere(flipped, I)
    assert.deepEqual(aligned, [0, 0, 0, 1])
    sameRotation(flipped, aligned)
  })

  it('interpolates rotations smoothly with slerp', () => {
    const q0: Quat = [0, 0, 0, 1]
    const q1: Quat = axisAngle(UP, Math.PI / 2)
    const mid = slerp(q0, q1, 0.5)
    sameRotation(mid, axisAngle(UP, Math.PI / 4))
  })
})

describe('two-bone IK and exported FK invariants', () => {
  it('matches an analytically known reachable knee and ankle', () => {
    const result = solveTwoBoneIK({ root: [0, 1, 0], target: [0, 1, 0.7], pole: [0, 2, 0.35], upperLength: 0.5, lowerLength: 0.5 })
    near(result.targetError, 0)
    assert.equal(result.clamped, false)
    near(distance(result.knee, [0, 1, 0]), 0.5)
    near(distance(result.ankle, result.knee), 0.5)
    nearVector(result.ankle, [0, 1, 0.7])
  })

  it('reports an unreachable anchor without stretching bones or changing that anchor', () => {
    const target: Vec3 = [0, 1, 2.5]
    const result = solveTwoBoneIK({ root: [0, 1, 0], target, pole: [0, 2, 0.5], upperLength: 0.5, lowerLength: 0.5 })
    assert.equal(result.clamped, true)
    near(result.targetError, 1.5)
    nearVector(result.ankle, [0, 1, 1.0])
    near(distance(result.knee, [0, 1, 0]), 0.5)
    near(distance(result.ankle, result.knee), 0.5)
  })

  it('respects the inner reach limit for unequal segments', () => {
    const result = solveTwoBoneIK({ root: [0, 0, 0], target: [0, 0.1, 0], pole: [1, 0, 0], upperLength: 0.6, lowerLength: 0.4 })
    assert.equal(result.clamped, true)
    nearVector(result.ankle, [0, 0.2, 0])
    near(result.targetError, 0.1)
  })

  it('remains finite at full extension', () => {
    const result = solveTwoBoneIK({ root: [0, 0, 0], target: [0, 1, 0], pole: [1, 0, 0], upperLength: 0.5, lowerLength: 0.5 })
    assert(result.knee.every(Number.isFinite))
    assert(result.ankle.every(Number.isFinite))
    near(result.targetError, 0)
  })

  it('handles a fully folded equal-length chain with an explicit direction hint', () => {
    const result = solveTwoBoneIK({ root: [0, 1, 0], target: [0, 1, 0], pole: [1, 1, 0], upperLength: 0.5, lowerLength: 0.5, directionHint: [0, -1, 0] })
    nearVector(result.ankle, [0, 1, 0])
    near(distance(result.knee, [0, 1, 0]), 0.5)
  })

  it('requires an explicit direction hint for a coincident target', () => {
    assert.throws(() => solveTwoBoneIK({ root: [0, 1, 0], target: [0, 1, 0], pole: [1, 1, 0], upperLength: 0.5, lowerLength: 0.5 }), /directionHint/)
  })

  it('uses the preceding knee plane if the pole becomes collinear', () => {
    const result = solveTwoBoneIK({
      root: [0, 0, 0],
      target: [0, 1, 0],
      pole: [0, 0.5, 0],
      previousKnee: [1, 0.5, 0],
      upperLength: 0.6,
      lowerLength: 0.6,
    })
    assert.equal(result.poleFallback, 'previous-knee')
    assert(result.knee[0] > 0)
  })

  it('round-trips solved positions through actual local quaternion FK under a turned pelvis', () => {
    const pelvis = axisAngle(UP, 0.9)
    const root: Vec3 = rotateVector(pelvis, [0.1, 0.9, 0])
    const target: Vec3 = add(root, rotateVector(pelvis, [0, -0.7, 0.2]))
    const pole: Vec3 = add(root, rotateVector(pelvis, [0, -0.35, 0.4]))
    const ik = solveTwoBoneIK({ root, target, pole, upperLength: 0.4, lowerLength: 0.4 })
    near(ik.targetError, 0)

    const locals = solveLegLocalRotations({
      parentWorld: pelvis,
      upperRestDirection: [0, -1, 0],
      lowerRestDirection: [0, -1, 0],
      root,
      knee: ik.knee,
      ankle: ik.ankle,
    })

    const fkUpperWorld = multiplyQuaternion(pelvis, locals.upperLocal)
    const fkKnee = add(root, rotateVector(fkUpperWorld, [0, -0.4, 0]))
    const fkLowerWorld = multiplyQuaternion(fkUpperWorld, locals.lowerLocal)
    const fkAnkle = add(fkKnee, rotateVector(fkLowerWorld, [0, -0.4, 0]))
    nearVector(fkKnee, ik.knee, 1e-6)
    nearVector(fkAnkle, ik.ankle, 1e-6)
  })

  it('preserves lengths across a deterministic grid of reachable and clamped targets', () => {
    for (const radius of [0.3, 0.7, 1.2]) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
        const target: Vec3 = [radius * Math.cos(angle), -Math.abs(radius * Math.sin(angle)), 0.1]
        const result = solveTwoBoneIK({ root: [0, 0, 0], target, pole: [0, -0.5, 1], upperLength: 0.45, lowerLength: 0.45 })
        near(distance(result.knee, [0, 0, 0]), 0.45, 1e-6)
        near(distance(result.ankle, result.knee), 0.45, 1e-6)
      }
    }
  })

  it('is equivariant to a common rigid rotation and translation', () => {
    const root: Vec3 = [0.1, 0.9, 0.05]; const target: Vec3 = [0.15, 0.2, 0.3]; const pole: Vec3 = [0.12, 0.5, 0.6]
    const base = solveTwoBoneIK({ root, target, pole, upperLength: 0.42, lowerLength: 0.42 })
    const q = axisAngle(UP, 0.7); const t: Vec3 = [2, -1, 3]
    const trans = (v: Vec3) => add(rotateVector(q, v), t)
    const transformed = solveTwoBoneIK({ root: trans(root), target: trans(target), pole: trans(pole), upperLength: 0.42, lowerLength: 0.42 })
    nearVector(transformed.knee, trans(base.knee), 1e-6)
    nearVector(transformed.ankle, trans(base.ankle), 1e-6)
  })

  it('rejects invalid lengths and nonfinite positions', () => {
    assert.throws(() => solveTwoBoneIK({ root: [0, 0, 0], target: [0, 1, 0], pole: [1, 0, 0], upperLength: -1, lowerLength: 1 }), /Bone lengths/)
    assert.throws(() => solveTwoBoneIK({ root: [0, Number.NaN, 0], target: [0, 1, 0], pole: [1, 0, 0], upperLength: 1, lowerLength: 1 }), /root/)
  })
})

describe('one-landmark contact anchor invariants', () => {
  const policy = { enterThreshold: 0.7, exitThreshold: 0.3, enterFrames: 2, exitFrames: 2 }

  it('keeps a fixed entry anchor while the raw prediction drifts steadily', () => {
    let state: ContactState = emptyContact()
    const points: Vec3[] = [[0, 0.05, 0], [0.01, 0.05, 0.02], [0.03, 0.05, 0.05], [0.05, 0.05, 0.08]]
    for (let i = 0; i < points.length; i++)
      state = advanceContact(state, { value: 0.85, point: points[i], mayEnter: true, mayStay: true }, policy)

    assert.equal(state.active, true)
    nearVector(state.anchor!, points[0])
    assert(distance(state.anchor!, points[points.length - 1]) > 0.05)
  })

  it('uses different entry and exit thresholds and debounces a brief dropout', () => {
    let state: ContactState = emptyContact()
    state = advanceContact(state, { value: 0.8, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    state = advanceContact(state, { value: 0.8, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, true)
    state = advanceContact(state, { value: 0.25, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, true)
    assert.equal(state.offFrames, 1)
    state = advanceContact(state, { value: 0.6, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, true)
    assert.equal(state.offFrames, 0)
    state = advanceContact(state, { value: 0.2, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    state = advanceContact(state, { value: 0.2, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, false)
  })

  it('requires consecutive entry evidence instead of accumulating isolated spikes', () => {
    let state: ContactState = emptyContact()
    state = advanceContact(state, { value: 0.9, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, false)
    state = advanceContact(state, { value: 0.1, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.onFrames, 0)
    state = advanceContact(state, { value: 0.9, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, false)
    assert.equal(state.onFrames, 1)
  })

  it('respects calibrated support gates even when a contact feature is high', () => {
    let state: ContactState = emptyContact()
    state = advanceContact(state, { value: 0.95, point: [0, 1.2, 0], mayEnter: false, mayStay: false }, policy)
    assert.equal(state.active, false)
    assert.equal(state.anchor, null)
  })

  it('releases a planted anchor when the external support condition is lost', () => {
    let state: ContactState = emptyContact()
    state = advanceContact(state, { value: 0.8, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    state = advanceContact(state, { value: 0.8, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, true)
    state = advanceContact(state, { value: 0.8, point: [0, 0.4, 0], mayEnter: true, mayStay: false }, policy)
    state = advanceContact(state, { value: 0.8, point: [0, 0.5, 0], mayEnter: true, mayStay: false }, policy)
    assert.equal(state.active, false)
    assert.equal(state.anchor, null)
  })

  it('keeps ankle and toe contacts independent', () => {
    let ankle = emptyContact(); let toe = emptyContact()
    ankle = advanceContact(ankle, { value: 0.9, point: [0.1, 0.08, 0], mayEnter: true, mayStay: true }, policy)
    ankle = advanceContact(ankle, { value: 0.9, point: [0.1, 0.08, 0], mayEnter: true, mayStay: true }, policy)
    toe = advanceContact(toe, { value: 0.2, point: [0.1, 0.02, 0.14], mayEnter: false, mayStay: false }, policy)
    assert.equal(ankle.active, true)
    assert.equal(toe.active, false)
    nearVector(ankle.anchor!, [0.1, 0.08, 0])
    assert.equal(toe.anchor, null)
  })

  it('copies entry coordinates so later input mutations cannot move an anchor', () => {
    let state = emptyContact()
    const mutable: Vec3 = [0, 0, 0]
    state = advanceContact(state, { value: 0.9, point: mutable, mayEnter: true, mayStay: true }, policy)
    mutable[0] = 5
    state = advanceContact(state, { value: 0.9, point: mutable, mayEnter: true, mayStay: true }, policy)
    mutable[0] = 10
    nearVector(state.anchor!, [0, 0, 0])
  })

  it('treats denormalized values outside 0..1 as regression values rather than invalid logits', () => {
    let state = emptyContact()
    state = advanceContact(state, { value: 1.4, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    state = advanceContact(state, { value: 1.2, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, true)
    state = advanceContact(state, { value: -0.2, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    state = advanceContact(state, { value: -0.1, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy)
    assert.equal(state.active, false)
  })

  it('validates hysteresis policies and rejects nonfinite features', () => {
    assert.throws(() => advanceContact(emptyContact(), { value: 0.5, point: [0, 0, 0], mayEnter: true, mayStay: true }, { ...policy, enterThreshold: 0.2, exitThreshold: 0.5 }), /threshold/)
    assert.throws(() => advanceContact(emptyContact(), { value: Number.NaN, point: [0, 0, 0], mayEnter: true, mayStay: true }, policy), /finite/)
  })
})
