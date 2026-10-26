import type { Quat, Vec3 } from './retargeting'

import { hmlMean, hmlStd, jointToNodeMap, NODE_BONES, refNodes } from './constants'
import { applyBipedContactIK, LEFT_LEG_CHAIN, localFromWorld, RIGHT_LEG_CHAIN, solveFrameDelta, solveParentSwing, sub } from './retargeting'

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
    rootRotations.push([0.0, -Math.sin(ang), 0.0, Math.cos(ang)])

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

  // 4. Per-node bone rotations derived from POSITIONS with calibrated frame recovery
  const localQuats: Record<number, Quat[]> = {}
  for (const bone of NODE_BONES) localQuats[bone.node] = []

  let prevPelvisDelta: Quat | undefined
  let prevSpineDelta: Quat | undefined
  let prevChestDelta: Quat | undefined
  let prevUpperChestDelta: Quat | undefined

  const prevWorldQ: Record<number, Quat> = {}
  const prevLocalQ: Record<number, Quat> = {}

  for (let t = 0; t < seqLen; t++) {
    // 4.1 Calibrated Pelvis Frame (Node 0)
    // Primary: longitudinal axis (joint 3 spine - joint 0 pelvis)
    // Secondary: lateral axis (joint 1 left hip - joint 2 right hip)
    const pelvisResult = solveFrameDelta({
      primaryWorld: sub(worldPos[3][t], worldPos[0][t]),
      secondaryWorld: sub(worldPos[1][t], worldPos[2][t]),
      restPrimary: [0, 1, 0],
      restSecondary: [1, 0, 0],
      previousDelta: prevPelvisDelta,
    })
    prevPelvisDelta = pelvisResult.rotation
    rootRotations[t] = pelvisResult.rotation
    const worldQ: Record<number, Quat> = { 0: pelvisResult.rotation }

    // 4.2 Calibrated Torso Frames
    // Node 1: Spine (outgoing segment [3, 6], lateral hip span reference)
    const spineResult = solveFrameDelta({
      primaryWorld: sub(worldPos[6][t], worldPos[3][t]),
      secondaryWorld: sub(worldPos[1][t], worldPos[2][t]),
      restPrimary: [0, 1, 0],
      restSecondary: [1, 0, 0],
      previousDelta: prevSpineDelta,
    })
    prevSpineDelta = spineResult.rotation
    worldQ[1] = spineResult.rotation

    // Node 2: Chest (outgoing segment [6, 9], shoulder span reference [13, 14])
    const shoulderSpan = sub(worldPos[13][t], worldPos[14][t])
    const chestResult = solveFrameDelta({
      primaryWorld: sub(worldPos[9][t], worldPos[6][t]),
      secondaryWorld: shoulderSpan,
      restPrimary: [0, 1, 0],
      restSecondary: [1, 0, 0],
      previousDelta: prevChestDelta,
    })
    prevChestDelta = chestResult.rotation
    worldQ[2] = chestResult.rotation

    // Node 3: UpperChest (outgoing segment [9, 12], shoulder span reference)
    const upperChestResult = solveFrameDelta({
      primaryWorld: sub(worldPos[12][t], worldPos[9][t]),
      secondaryWorld: shoulderSpan,
      restPrimary: [0, 1, 0],
      restSecondary: [1, 0, 0],
      previousDelta: prevUpperChestDelta,
    })
    prevUpperChestDelta = upperChestResult.rotation
    worldQ[3] = upperChestResult.rotation

    // 4.3 Neck & Head
    // Node 4: Neck (outgoing segment [12, 15] neck -> head)
    worldQ[4] = solveParentSwing(
      worldQ[3],
      [0, 1, 0],
      sub(worldPos[15][t], worldPos[12][t]),
      prevWorldQ[4],
    )

    // Node 5: Head (inherits neck orientation)
    worldQ[5] = worldQ[4]

    // 4.4 Limbs & Articulated Feet (Nodes 6 to 19)
    for (const bone of NODE_BONES) {
      if (bone.node <= 5)
        continue // Handled above in torso/head chain

      let world: Quat
      if (bone.hml && bone.restDir) {
        const a = worldPos[bone.hml[0]][t]
        const b = worldPos[bone.hml[1]][t]
        world = solveParentSwing(
          worldQ[bone.parent],
          bone.restDir,
          sub(b, a),
          prevWorldQ[bone.node],
        )
      }
      else {
        world = worldQ[bone.parent]
      }
      worldQ[bone.node] = world
    }

    // 4.5 Local rotations with hemisphere continuity
    for (const bone of NODE_BONES) {
      const parentWorld = worldQ[bone.parent]
      const currentWorld = worldQ[bone.node]
      const local = localFromWorld(parentWorld, currentWorld, prevLocalQ[bone.node])
      prevLocalQ[bone.node] = local
      prevWorldQ[bone.node] = currentWorld
      localQuats[bone.node].push(local)
    }
  }

  // 4.6 Contact-aware Leg IK & Foot Planting (Pass 2)
  onLog?.('Applying contact-aware leg IK and foot planting...')
  const bipedIK = applyBipedContactIK({
    seqLen,
    fps,
    motionData,
    worldPos,
    rootRotations,
    rootTranslations,
    localQuats,
    leftChain: LEFT_LEG_CHAIN,
    rightChain: RIGHT_LEG_CHAIN,
  })
  if (bipedIK.leftContactsActive > 0 || bipedIK.rightContactsActive > 0) {
    onLog?.(`Foot contact IK stabilized: ${bipedIK.leftContactsActive} left / ${bipedIK.rightContactsActive} right frames.`)
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
  let prevRootQ: Quat | null = null
  for (let i = 0; i < seqLen; i++) {
    let q = rootRotations[i]
    if (prevRootQ && (q[0] * prevRootQ[0] + q[1] * prevRootQ[1] + q[2] * prevRootQ[2] + q[3] * prevRootQ[3]) < 0) {
      q = [-q[0], -q[1], -q[2], -q[3]]
    }
    prevRootQ = q
    binView.setFloat32(offset + 0, q[0], true)
    binView.setFloat32(offset + 4, q[1], true)
    binView.setFloat32(offset + 8, q[2], true)
    binView.setFloat32(offset + 12, q[3], true)
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
