import { describe, expect, it, vi } from 'vitest'

import { hmlMean, hmlStd } from './constants'
import { exportFlowMDMToVRMA } from './vrmaExporter'

describe('exportFlowMDMToVRMA', () => {
  it('returns a GLB Uint8Array for zero-filled motion data', () => {
    const data = new Float32Array(263 * 60)
    const out = exportFlowMDMToVRMA(data)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBeGreaterThan(0)
    // GLB magic
    const view = new DataView(out.buffer)
    expect(view.getUint32(0, true)).toBe(0x46546C67)
    expect(view.getUint32(4, true)).toBe(2)
  })

  it('invokes onLog callback', () => {
    const data = new Float32Array(263 * 60)
    const onLog = vi.fn()
    exportFlowMDMToVRMA(data, 60, onLog)
    expect(onLog).toHaveBeenCalled()
  })

  it('supports custom seqLen', () => {
    const seqLen = 5
    const data = new Float32Array(263 * seqLen)
    const out = exportFlowMDMToVRMA(data, seqLen)
    expect(out).toBeInstanceOf(Uint8Array)
    expect(out.length).toBeGreaterThan(0)
  })

  it('handles non-zero input data', () => {
    const data = new Float32Array(263 * 10)
    for (let i = 0; i < data.length; i++) data[i] = (i % 7) * 0.1 - 0.3
    const out = exportFlowMDMToVRMA(data, 10)
    expect(out).toBeInstanceOf(Uint8Array)
  })
  it('exercises hemisphere continuity with randomized data', () => {
    for (let r = 0; r < 50; r++) {
      const data = new Float32Array(263 * 12)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() - 0.5) * 2
      const out = exportFlowMDMToVRMA(data, 12)
      expect(out).toBeInstanceOf(Uint8Array)
    }
  })

  it('negates root yaw sine so rotation quaternion aligns with planar translation coordinates', () => {
    const seqLen = 3
    const data = new Float32Array(263 * seqLen)

    // At frame 0, set angular velocity so ang reaches PI / 4 at frame 1 (yaw = PI / 2, 90 deg clockwise)
    // motionData[0] = data[0 * seqLen + 0] * hmlStd[0] + hmlMean[0]
    const targetAngVel = Math.PI / 4
    data[0 * seqLen + 0] = (targetAngVel - hmlMean[0]) / hmlStd[0]

    // Set forward velocity vz = 1.0 (channel 2 in HumanML3D: 0=yaw_vel, 1=vx, 2=vz, 3=vy)
    const targetVz = 1.0
    data[2 * seqLen + 0] = (targetVz - hmlMean[2]) / hmlStd[2]

    // Set vx = 0 (channel 1)
    data[1 * seqLen + 0] = (0.0 - hmlMean[1]) / hmlStd[1]

    const glb = exportFlowMDMToVRMA(data, seqLen)
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
    const jsonChunkSize = view.getUint32(12, true)
    const binDataOffset = 20 + jsonChunkSize + 8

    const transOffset = binDataOffset + seqLen * 4
    const rotOffset = binDataOffset + seqLen * 16

    // Frame 1 translation
    const dx = view.getFloat32(transOffset + 1 * 12 + 0, true)
    const dy = view.getFloat32(transOffset + 1 * 12 + 4, true)
    const dz = view.getFloat32(transOffset + 1 * 12 + 8, true)

    // Yaw = PI / 2. dx = vx*cos(yaw) - vz*sin(yaw) = -1.0, dz = vx*sin(yaw) + vz*cos(yaw) = 0.0
    expect(dx).toBeCloseTo(-1.0, 4)
    expect(dz).toBeCloseTo(0.0, 4)

    // Frame 1 root rotation quaternion [qx, qy, qz, qw]
    const qx = view.getFloat32(rotOffset + 1 * 16 + 0, true)
    const qy = view.getFloat32(rotOffset + 1 * 16 + 4, true)
    const qz = view.getFloat32(rotOffset + 1 * 16 + 8, true)
    const qw = view.getFloat32(rotOffset + 1 * 16 + 12, true)

    expect(qx).toBeCloseTo(0.0, 4)
    // In Hamilton quaternion notation, rotating by -yaw around Y produces qy = -sin(ang)
    expect(qy).toBeCloseTo(-Math.sin(targetAngVel), 4)
    expect(qz).toBeCloseTo(0.0, 4)
    expect(qw).toBeCloseTo(Math.cos(targetAngVel), 4)

    // Rotate local forward vector [0, 0, 1] by q:
    // v' = v + 2 * qw * (q_xyz x v) + 2 * q_xyz x (q_xyz x v)
    // For q = [0, qy, 0, qw] and v = [0, 0, 1]:
    // q_xyz x v = [qy, 0, 0]
    // 2 * qw * [qy, 0, 0] = [2 * qw * qy, 0, 0] = [2 * cos(ang) * -sin(ang), 0, 0] = [-sin(2*ang), 0, 0] = [-1, 0, 0]
    // q_xyz x [qy, 0, 0] = [0, 0, -qy^2]
    // 2 * [0, 0, -qy^2] = [0, 0, -2 * sin^2(ang)] = [0, 0, -(1 - cos(2*ang))] = [0, 0, -1]
    // v' = [0, 0, 1] + [-1, 0, 0] + [0, 0, -1] = [-1, 0, 0]
    const crossX = qy * 1.0
    const term1X = 2.0 * qw * crossX
    const term2Z = 2.0 * (-qy * crossX)
    const rotatedForwardX = 0.0 + term1X
    const rotatedForwardZ = 1.0 + term2Z

    // The heading of the rotated character mesh must point in the exact direction of translation!
    expect(rotatedForwardX).toBeCloseTo(dx, 4)
    expect(rotatedForwardZ).toBeCloseTo(dz, 4)
  })

  it('enforces quaternion hemisphere continuity on root rotation tracks', () => {
    const seqLen = 20
    const data = new Float32Array(263 * seqLen)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() - 0.5) * 5.0
    }

    const glb = exportFlowMDMToVRMA(data, seqLen)
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
    const jsonChunkSize = view.getUint32(12, true)
    const binDataOffset = 20 + jsonChunkSize + 8
    const rotOffset = binDataOffset + seqLen * 16

    for (let t = 1; t < seqLen; t++) {
      const qprev = [
        view.getFloat32(rotOffset + (t - 1) * 16 + 0, true),
        view.getFloat32(rotOffset + (t - 1) * 16 + 4, true),
        view.getFloat32(rotOffset + (t - 1) * 16 + 8, true),
        view.getFloat32(rotOffset + (t - 1) * 16 + 12, true),
      ]
      const qcurr = [
        view.getFloat32(rotOffset + t * 16 + 0, true),
        view.getFloat32(rotOffset + t * 16 + 4, true),
        view.getFloat32(rotOffset + t * 16 + 8, true),
        view.getFloat32(rotOffset + t * 16 + 12, true),
      ]
      const dot = qprev[0] * qcurr[0] + qprev[1] * qcurr[1] + qprev[2] * qcurr[2] + qprev[3] * qcurr[3]
      // Consecutive quaternions must lie on the same hemisphere (dot >= 0)
      expect(dot).toBeGreaterThanOrEqual(-1e-6)
    }
  })
})
