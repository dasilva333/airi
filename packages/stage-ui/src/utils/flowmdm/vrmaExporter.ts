import type { Quat, Vec3 } from './math'

import { hmlMean, hmlStd, jointToNodeMap, NODE_BONES, refNodes } from './constants'
import { normalizeVec3, quatInvert, quatMultiply, quatNormalize, shortestArcQuaternion } from './math'

export function exportFlowMDMToVRMA(motionDataNormalized: Float32Array, seqLen: number = 60, onLog?: (msg: string) => void): Uint8Array {
  onLog?.('De-normalizing HumanML3D motion features...')

  // 1. De-normalize ONNX feature-major output [1, 263, 1, seqLen] into frame-major [seqLen, 263]
  const motionData = new Float32Array(seqLen * 263)
  for (let t = 0; t < seqLen; t++) {
    for (let c = 0; c < 263; c++) {
      motionData[t * 263 + c] = motionDataNormalized[c * seqLen + t] * hmlStd[c] + hmlMean[c]
    }
  }

  onLog?.('Decoding HumanML3D features to root trajectory and joint rotations...')

  // 2. Decode root yaw and root translation
  const timeArray = new Float32Array(seqLen)
  const fps = 20
  for (let i = 0; i < seqLen; i++) timeArray[i] = i / fps

  let ang = 0.0
  let currentPosX = 0.0
  let currentPosZ = 0.0

  const rootRotations: Quat[] = []
  const rootTranslations: Vec3[] = []
  const rootYaws: number[] = []

  for (let t = 0; t < seqLen; t++) {
    const frameStart = t * 263
    const prevFrameStart = (t - 1) * 263

    if (t > 0) {
      ang += motionData[prevFrameStart + 0]
    }
    const yaw = 2.0 * ang
    rootYaws.push(yaw)
    rootRotations.push([0.0, Math.sin(ang), 0.0, Math.cos(ang)])

    if (t > 0) {
      const vx = motionData[prevFrameStart + 1]
      const vz = motionData[prevFrameStart + 2]

      const dx = vx * Math.cos(yaw) - vz * Math.sin(yaw)
      const dz = vx * Math.sin(yaw) + vz * Math.cos(yaw)

      currentPosX += dx
      currentPosZ += dz
    }

    const height = motionData[frameStart + 3]
    rootTranslations.push([currentPosX, height, currentPosZ])
  }

  // 3. Joint world positions from channels 4-67
  const worldPos: Vec3[][] = [rootTranslations.map(p => [p[0], p[1], p[2]])]
  for (let j = 1; j <= 21; j++) {
    const base = 4 + (j - 1) * 3
    const track: Vec3[] = []
    for (let t = 0; t < seqLen; t++) {
      const frameStart = t * 263
      const px = motionData[frameStart + base + 0]
      const py = motionData[frameStart + base + 1]
      const pz = motionData[frameStart + base + 2]
      const c = Math.cos(rootYaws[t])
      const s = Math.sin(rootYaws[t])
      track.push([
        px * c - pz * s + rootTranslations[t][0],
        py,
        px * s + pz * c + rootTranslations[t][2],
      ])
    }
    worldPos.push(track)
  }

  // 4. Per-node bone rotations derived from POSITIONS
  const localQuats: Record<number, Quat[]> = {}
  for (const bone of NODE_BONES) localQuats[bone.node] = []

  for (let t = 0; t < seqLen; t++) {
    const worldQ: Record<number, Quat> = { 0: rootRotations[t] }
    for (const bone of NODE_BONES) {
      let world: Quat
      if (bone.hml && bone.restDir) {
        const a = worldPos[bone.hml[0]][t]
        const b = worldPos[bone.hml[1]][t]
        world = shortestArcQuaternion(
          bone.restDir,
          normalizeVec3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]),
        )
      }
      else {
        world = worldQ[bone.parent]
      }
      worldQ[bone.node] = world
      localQuats[bone.node].push(
        quatNormalize(quatMultiply(quatInvert(worldQ[bone.parent]), world)),
      )
    }
  }

  const animatedJointIndices = Object.keys(jointToNodeMap).map(Number)

  // 5. Binary glTF Buffers
  const timeBytes = timeArray.byteLength
  const transBytes = seqLen * 3 * 4
  const rootRotBytes = seqLen * 4 * 4
  const jointsRotBytes = seqLen * animatedJointIndices.length * 16

  const totalBinSize = timeBytes + transBytes + rootRotBytes + jointsRotBytes
  const binBuffer = new ArrayBuffer(totalBinSize)
  const binView = new DataView(binBuffer)

  let offset = 0
  for (let i = 0; i < seqLen; i++) {
    binView.setFloat32(offset, timeArray[i], true)
    offset += 4
  }

  const transOffset = offset
  for (let i = 0; i < seqLen; i++) {
    binView.setFloat32(offset + 0, rootTranslations[i][0], true)
    binView.setFloat32(offset + 4, rootTranslations[i][1], true)
    binView.setFloat32(offset + 8, rootTranslations[i][2], true)
    offset += 12
  }

  const rootRotOffset = offset
  for (let i = 0; i < seqLen; i++) {
    binView.setFloat32(offset + 0, rootRotations[i][0], true)
    binView.setFloat32(offset + 4, rootRotations[i][1], true)
    binView.setFloat32(offset + 8, rootRotations[i][2], true)
    binView.setFloat32(offset + 12, rootRotations[i][3], true)
    offset += 16
  }

  const jointsRotOffset = offset
  for (const j of animatedJointIndices) {
    const node = jointToNodeMap[j]
    const track = localQuats[node]
    let prevQ: Quat | null = null

    for (let i = 0; i < seqLen; i++) {
      let q = track[i]
      // Hemisphere continuity check
      if (prevQ && (q[0] * prevQ[0] + q[1] * prevQ[1] + q[2] * prevQ[2] + q[3] * prevQ[3]) < 0) {
        q = [-q[0], -q[1], -q[2], -q[3]]
      }
      prevQ = q
      binView.setFloat32(offset + 0, q[0], true)
      binView.setFloat32(offset + 4, q[1], true)
      binView.setFloat32(offset + 8, q[2], true)
      binView.setFloat32(offset + 12, q[3], true)
      offset += 16
    }
  }

  // 6. Build glTF JSON metadata
  const gltf = {
    asset: { version: '2.0', generator: 'AIRI-FlowMDM-ONNX-Exporter' },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: refNodes,
    buffers: [{ byteLength: totalBinSize }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: timeBytes },
      { buffer: 0, byteOffset: transOffset, byteLength: transBytes },
      { buffer: 0, byteOffset: rootRotOffset, byteLength: rootRotBytes },
      { buffer: 0, byteOffset: jointsRotOffset, byteLength: jointsRotBytes },
    ],
    accessors: [
      { bufferView: 0, byteOffset: 0, componentType: 5126, count: seqLen, type: 'SCALAR', min: [0], max: [timeArray[seqLen - 1]] },
      { bufferView: 1, byteOffset: 0, componentType: 5126, count: seqLen, type: 'VEC3' },
      { bufferView: 2, byteOffset: 0, componentType: 5126, count: seqLen, type: 'VEC4' },
      ...animatedJointIndices.map((_, idx) => ({
        bufferView: 3,
        byteOffset: idx * seqLen * 16,
        componentType: 5126,
        count: seqLen,
        type: 'VEC4',
      })),
    ],
    animations: [{
      name: 'flowmdm_motion',
      samplers: [
        { input: 0, interpolation: 'LINEAR', output: 1 },
        { input: 0, interpolation: 'LINEAR', output: 2 },
        ...animatedJointIndices.map((_, idx) => ({
          input: 0,
          interpolation: 'LINEAR',
          output: 3 + idx,
        })),
      ],
      channels: [
        { sampler: 0, target: { node: 0, path: 'translation' } },
        { sampler: 1, target: { node: 0, path: 'rotation' } },
        ...animatedJointIndices.map((j, idx) => ({
          sampler: 2 + idx,
          target: { node: jointToNodeMap[j], path: 'rotation' },
        })),
      ],
    }],
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: {
          humanBones: {
            hips: { node: 0 },
            spine: { node: 1 },
            chest: { node: 2 },
            upperChest: { node: 3 },
            neck: { node: 4 },
            head: { node: 5 },
            leftShoulder: { node: 6 },
            leftUpperArm: { node: 7 },
            leftLowerArm: { node: 8 },
            leftHand: { node: 9 },
            rightShoulder: { node: 10 },
            rightUpperArm: { node: 11 },
            rightLowerArm: { node: 12 },
            rightHand: { node: 13 },
            leftUpperLeg: { node: 14 },
            leftLowerLeg: { node: 15 },
            leftFoot: { node: 16 },
            rightUpperLeg: { node: 17 },
            rightLowerLeg: { node: 18 },
            rightFoot: { node: 19 },
          },
        },
      },
    },
  }

  // 7. Serialize GLB container
  const jsonStr = JSON.stringify(gltf)
  const jsonBytes = new TextEncoder().encode(jsonStr)

  const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4
  const jsonChunkSize = jsonBytes.byteLength + jsonPadding

  const binPadding = (4 - (binBuffer.byteLength % 4)) % 4
  const binChunkSize = binBuffer.byteLength + binPadding

  const totalGlbSize = 12 + 8 + jsonChunkSize + 8 + binChunkSize
  const glbBuffer = new ArrayBuffer(totalGlbSize)
  const glbView = new DataView(glbBuffer)

  glbView.setUint32(0, 0x46546C67, true)
  glbView.setUint32(4, 2, true)
  glbView.setUint32(8, totalGlbSize, true)

  glbView.setUint32(12, jsonChunkSize, true)
  glbView.setUint32(16, 0x4E4F534A, true)

  const glbBytes = new Uint8Array(glbBuffer)
  glbBytes.set(jsonBytes, 20)
  for (let i = 0; i < jsonPadding; i++) {
    glbBytes[20 + jsonBytes.byteLength + i] = 0x20
  }

  const binChunkOffset = 20 + jsonChunkSize
  glbView.setUint32(binChunkOffset, binChunkSize, true)
  glbView.setUint32(binChunkOffset + 4, 0x004E4942, true)

  const binDataBytes = new Uint8Array(binBuffer)
  glbBytes.set(binDataBytes, binChunkOffset + 8)
  for (let i = 0; i < binPadding; i++) {
    glbBytes[binChunkOffset + 8 + binBuffer.byteLength + i] = 0x00
  }

  onLog?.('VRMA file container assembled successfully!')
  return glbBytes
}
