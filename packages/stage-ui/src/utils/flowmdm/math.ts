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
