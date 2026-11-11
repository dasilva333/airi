export type Quat = [number, number, number, number]
export type Vec3 = [number, number, number]

/**
 * Quaternion multiply (xyzw storage, Hamilton product): returns a * b,
 * i.e. the rotation b followed by the rotation a.
 */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const ax = a[0]
  const ay = a[1]
  const az = a[2]
  const aw = a[3]
  const bx = b[0]
  const by = b[1]
  const bz = b[2]
  const bw = b[3]
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

export function quatNormalize(q: Quat): Quat {
  const len = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
  return len > 1e-9 ? [q[0] / len, q[1] / len, q[2] / len, q[3] / len] : [0, 0, 0, 1]
}

export function normalizeVec3(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return len > 1e-9 ? [v[0] / len, v[1] / len, v[2] / len] : [0, -1, 0]
}

/**
 * Shortest-arc quaternion rotating unit vector `from` onto unit vector `to`.
 */
export function shortestArcQuaternion(from: Vec3, to: Vec3): Quat {
  const dot = from[0] * to[0] + from[1] * to[1] + from[2] * to[2]
  if (dot > 0.999999)
    return [0, 0, 0, 1]
  if (dot < -0.999999) {
    const ax: Vec3 = Math.abs(from[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const cx = from[1] * ax[2] - from[2] * ax[1]
    const cy = from[2] * ax[0] - from[0] * ax[2]
    const cz = from[0] * ax[1] - from[1] * ax[0]
    const len = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1
    return [cx / len, cy / len, cz / len, 0]
  }
  const cx = from[1] * to[2] - from[2] * to[1]
  const cy = from[2] * to[0] - from[0] * to[2]
  const cz = from[0] * to[1] - from[1] * to[0]
  return quatNormalize([cx, cy, cz, 1 + dot])
}

/**
 * Spherical linear interpolation (slerp) between two quaternions.
 */
export function quatSlerp(qa: Quat, qb: Quat, t: number): Quat {
  let cosHalfTheta = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]

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
