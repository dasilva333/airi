/**
 * Kinematic math and quaternion utilities for key-pose extraction and interpolation.
 */

export type Quat = [number, number, number, number] // [x, y, z, w]
export type Vec3 = [number, number, number]

export function quatNormalize(q: Quat): Quat {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
  return len > 1e-9 ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : [0, 0, 0, 1]
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const ax = a[0]; const ay = a[1]; const az = a[2]; const aw = a[3]
  const bx = b[0]; const by = b[1]; const bz = b[2]; const bw = b[3]
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function quatInvert(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]]
}

/**
 * Spherical linear interpolation (slerp) between two quaternions.
 */
export function quatSlerp(qa: Quat, qb: Quat, t: number): Quat {
  let cosHalfTheta = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]

  // If qa and qb are opposing, reverse qb to take the shortest path
  let bx = qb[0]
  let by = qb[1]
  let bz = qb[2]
  let bw = qb[3]

  if (cosHalfTheta < 0) {
    cosHalfTheta = -cosHalfTheta
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }

  // If very close, fallback to normalized linear interpolation
  if (Math.abs(cosHalfTheta) >= 1.0 - 1e-5) {
    return quatNormalize([
      qa[0] + t * (bx - qa[0]),
      qa[1] + t * (by - qa[1]),
      qa[2] + t * (bz - qa[2]),
      qa[3] + t * (bw - qa[3]),
    ])
  }

  const halfTheta = Math.acos(cosHalfTheta)
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta)

  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta

  return quatNormalize([
    qa[0] * ratioA + bx * ratioB,
    qa[1] * ratioA + by * ratioB,
    qa[2] * ratioA + bz * ratioB,
    qa[3] * ratioA + bw * ratioB,
  ])
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1]),
    a[2] + t * (b[2] - a[2]),
  ]
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dz = a[2] - b[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}
