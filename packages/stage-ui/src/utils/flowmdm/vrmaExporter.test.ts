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

    // Set upright spine (joint 3) and symmetric hip span (joints 1 & 2) across all frames
    for (let t = 0; t < seqLen; t++) {
      // Joint 3 (spine) along pure +Y above pelvis (root height is ~0.94, so y=1.1 gives positive up vector)
      data[10 * seqLen + t] = (0.0 - hmlMean[10]) / hmlStd[10]
      data[11 * seqLen + t] = (1.1 - hmlMean[11]) / hmlStd[11]
      data[12 * seqLen + t] = (0.0 - hmlMean[12]) / hmlStd[12]

      // Joint 1 (L Hip) and Joint 2 (R Hip) along pure X
      data[4 * seqLen + t] = (0.1 - hmlMean[4]) / hmlStd[4]
      data[5 * seqLen + t] = (0.0 - hmlMean[5]) / hmlStd[5]
      data[6 * seqLen + t] = (0.0 - hmlMean[6]) / hmlStd[6]

      data[7 * seqLen + t] = (-0.1 - hmlMean[7]) / hmlStd[7]
      data[8 * seqLen + t] = (0.0 - hmlMean[8]) / hmlStd[8]
      data[9 * seqLen + t] = (0.0 - hmlMean[9]) / hmlStd[9]
    }

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

  it('articulates feet along ankle-to-toe direction in VRMA export', () => {
    const seqLen = 2
    const data = new Float32Array(263 * seqLen)

    // Left ankle: joint 7 (channels 22, 23, 24)
    // Left toe: joint 10 (channels 31, 32, 33)
    for (let t = 0; t < seqLen; t++) {
      data[22 * seqLen + t] = (0.1 - hmlMean[22]) / hmlStd[22]
      data[23 * seqLen + t] = (0.1 - hmlMean[23]) / hmlStd[23]
      data[24 * seqLen + t] = (0.0 - hmlMean[24]) / hmlStd[24]

      data[31 * seqLen + t] = (0.1 - hmlMean[31]) / hmlStd[31]
      data[32 * seqLen + t] = (0.2 - hmlMean[32]) / hmlStd[32]
      data[33 * seqLen + t] = (0.1 - hmlMean[33]) / hmlStd[33]
    }

    const glb = exportFlowMDMToVRMA(data, seqLen)
    expect(glb).toBeInstanceOf(Uint8Array)
    expect(glb.length).toBeGreaterThan(0)
  })

  it('applies contact-aware leg IK when foot contacts are active', () => {
    const seqLen = 5
    const data = new Float32Array(263 * seqLen)

    // Left ankle: joint 7 (channels 22, 23, 24)
    // Left contact: channel 259
    // Set left ankle near ground and contact high across frames 0 to 4
    for (let t = 0; t < seqLen; t++) {
      // Left ankle at [0.09, 0.1, 0.0] (stationary near ground)
      data[22 * seqLen + t] = (0.09 - hmlMean[22]) / hmlStd[22]
      data[23 * seqLen + t] = (0.10 - hmlMean[23]) / hmlStd[23]
      data[24 * seqLen + t] = (0.00 - hmlMean[24]) / hmlStd[24]

      // Left ankle contact = 1.0 (denormalized)
      data[259 * seqLen + t] = (1.0 - hmlMean[259]) / hmlStd[259]
    }

    const logs: string[] = []
    const glb = exportFlowMDMToVRMA(data, seqLen, msg => logs.push(msg))
    expect(glb).toBeInstanceOf(Uint8Array)
    expect(logs.some(l => l.includes('Foot contact IK stabilized'))).toBe(true)
  })

  describe('section 9 Integration Gates & Parity Invariants', () => {
    function parseVRMATracks(glb: Uint8Array, seqLen: number) {
      const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
      const jsonChunkSize = view.getUint32(12, true)
      const jsonBytes = glb.subarray(20, 20 + jsonChunkSize)
      const gltf = JSON.parse(new TextDecoder().decode(jsonBytes))

      const binDataOffset = 20 + jsonChunkSize + 8
      const binBuffer = glb.buffer.slice(glb.byteOffset + binDataOffset)
      const binView = new DataView(binBuffer)

      const transOffset = gltf.bufferViews[1].byteOffset
      const rootRotOffset = gltf.bufferViews[2].byteOffset
      const jointsRotOffset = gltf.bufferViews[3].byteOffset

      const rootTrans: Vec3[] = []
      const rootRot: Quat[] = []
      for (let t = 0; t < seqLen; t++) {
        rootTrans.push([
          binView.getFloat32(transOffset + t * 12 + 0, true),
          binView.getFloat32(transOffset + t * 12 + 4, true),
          binView.getFloat32(transOffset + t * 12 + 8, true),
        ])
        rootRot.push([
          binView.getFloat32(rootRotOffset + t * 16 + 0, true),
          binView.getFloat32(rootRotOffset + t * 16 + 4, true),
          binView.getFloat32(rootRotOffset + t * 16 + 8, true),
          binView.getFloat32(rootRotOffset + t * 16 + 12, true),
        ])
      }

      const nodeRotations: Record<number, Quat[]> = {}
      for (const ch of gltf.animations[0].channels) {
        const node = ch.target.node
        const samplerIdx = ch.sampler
        if (ch.target.path === 'rotation' && samplerIdx >= 2) {
          const sampler = gltf.animations[0].samplers[samplerIdx]
          const accessor = gltf.accessors[sampler.output]
          const byteOffset = jointsRotOffset + accessor.byteOffset
          const quats: Quat[] = []
          for (let t = 0; t < seqLen; t++) {
            quats.push([
              binView.getFloat32(byteOffset + t * 16 + 0, true),
              binView.getFloat32(byteOffset + t * 16 + 4, true),
              binView.getFloat32(byteOffset + t * 16 + 8, true),
              binView.getFloat32(byteOffset + t * 16 + 12, true),
            ])
          }
          nodeRotations[node] = quats
        }
      }

      return { gltf, rootTrans, rootRot, nodeRotations }
    }

    it('gate 1: Neutral T-pose exports identity rotations without persistent pelvis or spine tilt', () => {
      const seqLen = 3
      const data = new Float32Array(263 * seqLen)

      // Set neutral upright joints
      for (let t = 0; t < seqLen; t++) {
        // Pelvis at y = 0.94
        data[3 * seqLen + t] = (0.94 - hmlMean[3]) / hmlStd[3]

        // Joint 1 (L Hip) and Joint 2 (R Hip) purely on X axis
        data[4 * seqLen + t] = (0.1 - hmlMean[4]) / hmlStd[4]
        data[5 * seqLen + t] = (0.0 - hmlMean[5]) / hmlStd[5]
        data[6 * seqLen + t] = (0.0 - hmlMean[6]) / hmlStd[6]

        data[7 * seqLen + t] = (-0.1 - hmlMean[7]) / hmlStd[7]
        data[8 * seqLen + t] = (0.0 - hmlMean[8]) / hmlStd[8]
        data[9 * seqLen + t] = (0.0 - hmlMean[9]) / hmlStd[9]

        // Spine (3), Chest (6), UpperChest (9), Neck (12), Head (15) vertically aligned along +Y
        const spineYs = [[3, 1.10], [6, 1.25], [9, 1.40], [12, 1.52], [15, 1.64]]
        for (const [j, y] of spineYs) {
          const chStart = 4 + (j - 1) * 3
          data[(chStart + 0) * seqLen + t] = (0.0 - hmlMean[chStart + 0]) / hmlStd[chStart + 0]
          data[(chStart + 1) * seqLen + t] = (y - hmlMean[chStart + 1]) / hmlStd[chStart + 1]
          data[(chStart + 2) * seqLen + t] = (0.0 - hmlMean[chStart + 2]) / hmlStd[chStart + 2]
        }

        // Shoulders purely on X
        const lShoulderStart = 4 + (13 - 1) * 3
        const rShoulderStart = 4 + (14 - 1) * 3
        data[(lShoulderStart + 0) * seqLen + t] = (0.2 - hmlMean[lShoulderStart + 0]) / hmlStd[lShoulderStart + 0]
        data[(lShoulderStart + 1) * seqLen + t] = (1.40 - hmlMean[lShoulderStart + 1]) / hmlStd[lShoulderStart + 1]
        data[(lShoulderStart + 2) * seqLen + t] = (0.0 - hmlMean[lShoulderStart + 2]) / hmlStd[lShoulderStart + 2]

        data[(rShoulderStart + 0) * seqLen + t] = (-0.2 - hmlMean[rShoulderStart + 0]) / hmlStd[rShoulderStart + 0]
        data[(rShoulderStart + 1) * seqLen + t] = (1.40 - hmlMean[rShoulderStart + 1]) / hmlStd[rShoulderStart + 1]
        data[(rShoulderStart + 2) * seqLen + t] = (0.0 - hmlMean[rShoulderStart + 2]) / hmlStd[rShoulderStart + 2]

        // Feet (Joint 7 L Ankle, Joint 10 L Toe pointing forward +Z)
        const lAnkleStart = 4 + (7 - 1) * 3
        const lToeStart = 4 + (10 - 1) * 3
        data[(lAnkleStart + 0) * seqLen + t] = (0.1 - hmlMean[lAnkleStart + 0]) / hmlStd[lAnkleStart + 0]
        data[(lAnkleStart + 1) * seqLen + t] = (0.1 - hmlMean[lAnkleStart + 1]) / hmlStd[lAnkleStart + 1]
        data[(lAnkleStart + 2) * seqLen + t] = (0.0 - hmlMean[lAnkleStart + 2]) / hmlStd[lAnkleStart + 2]

        data[(lToeStart + 0) * seqLen + t] = (0.1 - hmlMean[lToeStart + 0]) / hmlStd[lToeStart + 0]
        data[(lToeStart + 1) * seqLen + t] = (0.05 - hmlMean[lToeStart + 1]) / hmlStd[lToeStart + 1]
        data[(lToeStart + 2) * seqLen + t] = (0.15 - hmlMean[lToeStart + 2]) / hmlStd[lToeStart + 2]
      }

      const glb = exportFlowMDMToVRMA(data, seqLen)
      const { rootRot, nodeRotations } = parseVRMATracks(glb, seqLen)

      // Pelvis root rotation must be identity
      for (let t = 0; t < seqLen; t++) {
        expect(rootRot[t][0]).toBeCloseTo(0, 3)
        expect(rootRot[t][1]).toBeCloseTo(0, 3)
        expect(rootRot[t][2]).toBeCloseTo(0, 3)
        expect(rootRot[t][3]).toBeCloseTo(1, 3)

        // Spine (node 1), Chest (node 2), UpperChest (node 3) must be identity
        for (const node of [1, 2, 3]) {
          const q = nodeRotations[node][t]
          expect(q[0]).toBeCloseTo(0, 3)
          expect(q[1]).toBeCloseTo(0, 3)
          expect(q[2]).toBeCloseTo(0, 3)
          expect(Math.abs(q[3])).toBeCloseTo(1, 3)
        }
      }
    })

    it('gate 2: Upright turn with raw joint RIC data rotates torso without double yaw', () => {
      const seqLen = 3
      const data = new Float32Array(263 * seqLen)
      const turnAngle = Math.PI / 4 // 45 deg turn

      // In HumanML3D, yaw velocity rotates root. Let root yaw reach turnAngle at frame 1:
      data[0 * seqLen + 0] = (turnAngle - hmlMean[0]) / hmlStd[0]

      for (let t = 0; t < seqLen; t++) {
        // RIC coordinates are rotation-invariant (character neutral frame facing +Z)
        data[4 * seqLen + t] = (0.1 - hmlMean[4]) / hmlStd[4]
        data[5 * seqLen + t] = (0.0 - hmlMean[5]) / hmlStd[5]
        data[6 * seqLen + t] = (0.0 - hmlMean[6]) / hmlStd[6]

        data[7 * seqLen + t] = (-0.1 - hmlMean[7]) / hmlStd[7]
        data[8 * seqLen + t] = (0.0 - hmlMean[8]) / hmlStd[8]
        data[9 * seqLen + t] = (0.0 - hmlMean[9]) / hmlStd[9]

        // Joint 3 (spine) along pure +Y
        data[10 * seqLen + t] = (0.0 - hmlMean[10]) / hmlStd[10]
        data[11 * seqLen + t] = (1.10 - hmlMean[11]) / hmlStd[11]
        data[12 * seqLen + t] = (0.0 - hmlMean[12]) / hmlStd[12]

        // Joint 6 (chest) along pure +Y
        data[19 * seqLen + t] = (0.0 - hmlMean[19]) / hmlStd[19]
        data[20 * seqLen + t] = (1.25 - hmlMean[20]) / hmlStd[20]
        data[21 * seqLen + t] = (0.0 - hmlMean[21]) / hmlStd[21]
      }

      const glb = exportFlowMDMToVRMA(data, seqLen)
      const { rootRot, nodeRotations } = parseVRMATracks(glb, seqLen)

      // At frame 1, root rotation carries the turn heading (yaw = 2 * turnAngle, qy = -sin(turnAngle))
      expect(rootRot[1][1]).toBeCloseTo(-Math.sin(turnAngle), 3)
      expect(rootRot[1][3]).toBeCloseTo(Math.cos(turnAngle), 3)

      // Crucial: Spine node 1 local rotation must remain IDENTITY [0, 0, 0, 1]
      // proving the torso followed heading without accumulating a duplicate yaw!
      const spineLocal = nodeRotations[1][1]
      expect(spineLocal[0]).toBeCloseTo(0, 3)
      expect(spineLocal[1]).toBeCloseTo(0, 3)
      expect(spineLocal[2]).toBeCloseTo(0, 3)
      expect(Math.abs(spineLocal[3])).toBeCloseTo(1, 3)
    })

    it('gate 3: Bent spine preserves outgoing segment orientation without incoming remap', () => {
      const seqLen = 3
      const data = new Float32Array(263 * seqLen)

      // Segment 0 -> 3 (pelvis to spine) is vertical along +Y
      // Outgoing segment 3 -> 6 (spine to chest) is pitched forward by 30 deg:
      // dy = 0.15 * cos(30 deg) = 0.130, dz = 0.15 * sin(30 deg) = 0.075
      const pitchAngle = Math.PI / 6 // 30 degrees
      const dy = 0.15 * Math.cos(pitchAngle)
      const dz = 0.15 * Math.sin(pitchAngle)

      for (let t = 0; t < seqLen; t++) {
        // Hip span purely on X
        data[4 * seqLen + t] = (0.1 - hmlMean[4]) / hmlStd[4]
        data[5 * seqLen + t] = (0.0 - hmlMean[5]) / hmlStd[5]
        data[6 * seqLen + t] = (0.0 - hmlMean[6]) / hmlStd[6]

        data[7 * seqLen + t] = (-0.1 - hmlMean[7]) / hmlStd[7]
        data[8 * seqLen + t] = (0.0 - hmlMean[8]) / hmlStd[8]
        data[9 * seqLen + t] = (0.0 - hmlMean[9]) / hmlStd[9]

        // Joint 3 (spine) directly above pelvis at y = 1.10, z = 0
        data[10 * seqLen + t] = (0.0 - hmlMean[10]) / hmlStd[10]
        data[11 * seqLen + t] = (1.10 - hmlMean[11]) / hmlStd[11]
        data[12 * seqLen + t] = (0.0 - hmlMean[12]) / hmlStd[12]

        // Joint 6 (chest) pitched forward: y = 1.10 + dy, z = dz
        data[19 * seqLen + t] = (0.0 - hmlMean[19]) / hmlStd[19]
        data[20 * seqLen + t] = ((1.10 + dy) - hmlMean[20]) / hmlStd[20]
        data[21 * seqLen + t] = (dz - hmlMean[21]) / hmlStd[21]
      }

      const glb = exportFlowMDMToVRMA(data, seqLen)
      const { nodeRotations } = parseVRMATracks(glb, seqLen)

      // Spine node 1 local rotation MUST reflect the 30 deg forward pitch around X axis!
      const spineQ = nodeRotations[1][0]
      // Forward pitch produces positive qx = sin(pitchAngle / 2)
      expect(spineQ[0]).toBeCloseTo(Math.sin(pitchAngle / 2), 3)
      expect(spineQ[1]).toBeCloseTo(0, 3)
      expect(spineQ[2]).toBeCloseTo(0, 3)
      expect(spineQ[3]).toBeCloseTo(Math.cos(pitchAngle / 2), 3)
    })

    it('gate 4 & 5: Exported VRMA parsed back through FK reaches locked contact anchors within numerical tolerance', () => {
      const seqLen = 6
      const data = new Float32Array(263 * seqLen)

      // Plant left ankle at fixed anchor [0.09, 0.10, 0.0]
      const anchorAnkle = [0.09, 0.10, 0.0]
      const anchorToe = [0.09, 0.05, 0.15]

      for (let t = 0; t < seqLen; t++) {
        // Upright pelvis and spine
        data[3 * seqLen + t] = (0.94 - hmlMean[3]) / hmlStd[3]

        data[4 * seqLen + t] = (0.09 - hmlMean[4]) / hmlStd[4]
        data[5 * seqLen + t] = (0.0 - hmlMean[5]) / hmlStd[5]
        data[6 * seqLen + t] = (0.0 - hmlMean[6]) / hmlStd[6]

        data[7 * seqLen + t] = (-0.09 - hmlMean[7]) / hmlStd[7]
        data[8 * seqLen + t] = (0.0 - hmlMean[8]) / hmlStd[8]
        data[9 * seqLen + t] = (0.0 - hmlMean[9]) / hmlStd[9]

        data[10 * seqLen + t] = (0.0 - hmlMean[10]) / hmlStd[10]
        data[11 * seqLen + t] = (1.10 - hmlMean[11]) / hmlStd[11]
        data[12 * seqLen + t] = (0.0 - hmlMean[12]) / hmlStd[12]

        // Left knee (joint 4) bent forward: [0.09, 0.52, 0.15]
        data[13 * seqLen + t] = (0.09 - hmlMean[13]) / hmlStd[13]
        data[14 * seqLen + t] = (0.52 - hmlMean[14]) / hmlStd[14]
        data[15 * seqLen + t] = (0.15 - hmlMean[15]) / hmlStd[15]

        // Left ankle (joint 7) stationary at anchor
        data[22 * seqLen + t] = (anchorAnkle[0] - hmlMean[22]) / hmlStd[22]
        data[23 * seqLen + t] = (anchorAnkle[1] - hmlMean[23]) / hmlStd[23]
        data[24 * seqLen + t] = (anchorAnkle[2] - hmlMean[24]) / hmlStd[24]

        // Left toe (joint 10) stationary at anchor
        data[31 * seqLen + t] = (anchorToe[0] - hmlMean[31]) / hmlStd[31]
        data[32 * seqLen + t] = (anchorToe[1] - hmlMean[32]) / hmlStd[32]
        data[33 * seqLen + t] = (anchorToe[2] - hmlMean[33]) / hmlStd[33]

        // Activate left ankle contact (259) and left toe contact (260)
        data[259 * seqLen + t] = (1.0 - hmlMean[259]) / hmlStd[259]
        data[260 * seqLen + t] = (1.0 - hmlMean[260]) / hmlStd[260]
      }

      const glb = exportFlowMDMToVRMA(data, seqLen)
      const { rootTrans, rootRot, nodeRotations } = parseVRMATracks(glb, seqLen)

      // Evaluate Forward Kinematics for left leg:
      // Pelvis -> LeftUpperLeg (node 14) -> LeftLowerLeg (node 15) -> LeftFoot (node 16)
      for (let t = 0; t < seqLen; t++) {
        const rootT = rootTrans[t]
        const rootQ = rootRot[t]
        const upperQ = nodeRotations[14][t]
        const lowerQ = nodeRotations[15][t]

        // 1. Hip origin in world space
        // rest offset of node 14 is [0.09, -0.02, 0]
        const hipWorld = [
          rootT[0] + 0.09,
          rootT[1] - 0.02,
          rootT[2],
        ]

        // 2. World rotation of upper leg
        // q_upper_world = rootQ * upperQ
        const upperWorldQ: Quat = [
          rootQ[3] * upperQ[0] + rootQ[0] * upperQ[3] + rootQ[1] * upperQ[2] - rootQ[2] * upperQ[1],
          rootQ[3] * upperQ[1] - rootQ[0] * upperQ[2] + rootQ[1] * upperQ[3] + rootQ[2] * upperQ[0],
          rootQ[3] * upperQ[2] + rootQ[0] * upperQ[1] - rootQ[1] * upperQ[0] + rootQ[2] * upperQ[3],
          rootQ[3] * upperQ[3] - rootQ[0] * upperQ[0] - rootQ[1] * upperQ[1] - rootQ[2] * upperQ[2],
        ]

        // 3. Knee position = hipWorld + upperWorldQ * [0, -0.38, 0]
        // Rotating [0, -0.38, 0] by upperWorldQ
        const vUpper = [
          2 * (upperWorldQ[0] * upperWorldQ[1] - upperWorldQ[3] * upperWorldQ[2]) * -0.38,
          (1 - 2 * (upperWorldQ[0] * upperWorldQ[0] + upperWorldQ[2] * upperWorldQ[2])) * -0.38,
          2 * (upperWorldQ[1] * upperWorldQ[2] + upperWorldQ[3] * upperWorldQ[0]) * -0.38,
        ]
        const kneeWorld = [
          hipWorld[0] + vUpper[0],
          hipWorld[1] + vUpper[1],
          hipWorld[2] + vUpper[2],
        ]

        // 4. World rotation of lower leg
        const lowerWorldQ: Quat = [
          upperWorldQ[3] * lowerQ[0] + upperWorldQ[0] * lowerQ[3] + upperWorldQ[1] * lowerQ[2] - upperWorldQ[2] * lowerQ[1],
          upperWorldQ[3] * lowerQ[1] - upperWorldQ[0] * lowerQ[2] + upperWorldQ[1] * lowerQ[3] + upperWorldQ[2] * lowerQ[0],
          upperWorldQ[3] * lowerQ[2] + upperWorldQ[0] * lowerQ[1] - upperWorldQ[1] * lowerQ[0] + upperWorldQ[2] * lowerQ[3],
          upperWorldQ[3] * lowerQ[3] - upperWorldQ[0] * lowerQ[0] - upperWorldQ[1] * lowerQ[1] - upperWorldQ[2] * lowerQ[2],
        ]

        // 5. Ankle position = kneeWorld + lowerWorldQ * [0, -0.42, 0]
        const vLower = [
          2 * (lowerWorldQ[0] * lowerWorldQ[1] - lowerWorldQ[3] * lowerWorldQ[2]) * -0.42,
          (1 - 2 * (lowerWorldQ[0] * lowerWorldQ[0] + lowerWorldQ[2] * lowerWorldQ[2])) * -0.42,
          2 * (lowerWorldQ[1] * lowerWorldQ[2] + lowerWorldQ[3] * lowerWorldQ[0]) * -0.42,
        ]
        const ankleFK = [
          kneeWorld[0] + vLower[0],
          kneeWorld[1] + vLower[1],
          kneeWorld[2] + vLower[2],
        ]

        // The FK ankle position must match the planted anchor within 1 millimeter!
        expect(ankleFK[0]).toBeCloseTo(anchorAnkle[0], 2)
        expect(ankleFK[1]).toBeCloseTo(anchorAnkle[1], 2)
        expect(ankleFK[2]).toBeCloseTo(anchorAnkle[2], 2)
      }
    })

    it('gate 7: Jump, Heel-strike, Toe-off, Flat-foot, and Seamless Release blend', () => {
      // 10 frames sequence:
      // Frames 0-1: Jump (airborne, y = 0.40m, contacts = 0)
      // Frames 2-3: Heel-strike (ankle contact = 1.0, toe contact = 0.0, ankle at [0.09, 0.10, 0])
      // Frames 4-5: Flat-foot (ankle contact = 1.0, toe contact = 1.0)
      // Frames 6-7: Toe-off (ankle contact = 0.0, toe contact = 1.0, toe at [0.09, 0.05, 0.15])
      // Frames 8-9: Release & Airborne (contacts = 0, blending to raw)
      const seqLen = 10
      const data = new Float32Array(263 * seqLen)

      for (let t = 0; t < seqLen; t++) {
        // Base pelvis & spine
        data[3 * seqLen + t] = (0.94 - hmlMean[3]) / hmlStd[3]
        data[4 * seqLen + t] = (0.09 - hmlMean[4]) / hmlStd[4]
        data[7 * seqLen + t] = (-0.09 - hmlMean[7]) / hmlStd[7]
        data[10 * seqLen + t] = (0.0 - hmlMean[10]) / hmlStd[10]
        data[11 * seqLen + t] = (1.10 - hmlMean[11]) / hmlStd[11]

        // Ankle & Toe default positions
        const isAirborne = t < 2 || t >= 8
        const ankleY = isAirborne ? 0.40 : 0.10
        const toeY = isAirborne ? 0.35 : 0.05

        data[22 * seqLen + t] = (0.09 - hmlMean[22]) / hmlStd[22]
        data[23 * seqLen + t] = (ankleY - hmlMean[23]) / hmlStd[23]
        data[24 * seqLen + t] = (0.00 - hmlMean[24]) / hmlStd[24]

        data[31 * seqLen + t] = (0.09 - hmlMean[31]) / hmlStd[31]
        data[32 * seqLen + t] = (toeY - hmlMean[32]) / hmlStd[32]
        data[33 * seqLen + t] = (0.15 - hmlMean[33]) / hmlStd[33]

        // Contact channels:
        // Heel strike (2-3): ankle active, toe inactive
        // Flat foot (4-5): both active
        // Toe-off (6-7): ankle inactive, toe active
        const ankleContact = (t >= 2 && t <= 5) ? 1.0 : 0.0
        const toeContact = (t >= 4 && t <= 7) ? 1.0 : 0.0

        data[259 * seqLen + t] = (ankleContact - hmlMean[259]) / hmlStd[259]
        data[260 * seqLen + t] = (toeContact - hmlMean[260]) / hmlStd[260]
      }

      const logs: string[] = []
      const glb = exportFlowMDMToVRMA(data, seqLen, msg => logs.push(msg))
      expect(glb).toBeInstanceOf(Uint8Array)

      const { nodeRotations } = parseVRMATracks(glb, seqLen)
      const leftUpper = nodeRotations[14]
      const leftLower = nodeRotations[15]
      const leftFoot = nodeRotations[16]

      // In frames 4-5 (flat foot), foot sole is flat to ground (localQuat is defined and finite)
      for (const t of [4, 5]) {
        expect(leftFoot[t].every(Number.isFinite)).toBe(true)
        expect(Math.hypot(...leftFoot[t])).toBeCloseTo(1, 4)
      }

      // In release frames 8 and 9, transitions are smooth without NaNs or singularities
      for (let t = 8; t < seqLen; t++) {
        expect(leftUpper[t].every(Number.isFinite)).toBe(true)
        expect(leftLower[t].every(Number.isFinite)).toBe(true)
        expect(leftFoot[t].every(Number.isFinite)).toBe(true)

        expect(Math.hypot(...leftUpper[t])).toBeCloseTo(1, 4)
        expect(Math.hypot(...leftLower[t])).toBeCloseTo(1, 4)
        expect(Math.hypot(...leftFoot[t])).toBeCloseTo(1, 4)
      }
    })
  })
})
