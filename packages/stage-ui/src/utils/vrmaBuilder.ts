import * as THREE from 'three'

// VRMA ファイル内に埋め込むレストポーズ骨格 (VRM1 規約: +Z 正面 / +X が左手側 / T ポーズ)
// [親ボーン名, ローカル平行移動]
export const SKELETON: Record<string, [string | null, [number, number, number]]> = {
  hips:          [null,           [0,     0.9,  0]],
  spine:         ['hips',         [0,     0.08, 0]],
  chest:         ['spine',        [0,     0.12, 0]],
  upperChest:    ['chest',        [0,     0.12, 0]],
  neck:          ['upperChest',   [0,     0.13, 0]],
  head:          ['neck',         [0,     0.08, 0]],
  leftShoulder:  ['upperChest',   [0.03,  0.10, 0]],
  leftUpperArm:  ['leftShoulder', [0.06,  0,    0]],
  leftLowerArm:  ['leftUpperArm', [0.24,  0,    0]],
  leftHand:      ['leftLowerArm', [0.22,  0,    0]],
  rightShoulder: ['upperChest',   [-0.03, 0.10, 0]],
  rightUpperArm: ['rightShoulder',[-0.06, 0,    0]],
  rightLowerArm: ['rightUpperArm',[-0.24, 0,    0]],
  rightHand:     ['rightLowerArm',[-0.22, 0,    0]],
  leftUpperLeg:  ['hips',         [0.09,  -0.02, 0]],
  leftLowerLeg:  ['leftUpperLeg', [0,     -0.38, 0]],
  leftFoot:      ['leftLowerLeg', [0,     -0.42, 0]],
  rightUpperLeg: ['hips',         [-0.09, -0.02, 0]],
  rightLowerLeg: ['rightUpperLeg',[0,     -0.38, 0]],
  rightFoot:     ['rightLowerLeg',[0,     -0.42, 0]],
}

// 指ボーン (人差し指〜小指 × 3関節)。LLM には公開せず、自然な手のポーズを自動で焼き込む用
const FINGER_SEGMENTS = { Proximal: [0.09, 0.035], Intermediate: [0.035, 0.028], Distal: [0.025, 0.02] }
for (const side of ['left', 'right']) {
  const sx = side === 'left' ? 1 : -1
  const fingers = { Index: 0.025, Middle: 0.008, Ring: -0.008, Little: -0.024 }
  for (const [finger, z] of Object.entries(fingers)) {
    let parent = `${side}Hand`
    for (const [seg, [len]] of Object.entries(FINGER_SEGMENTS)) {
      const name = `${side}${finger}${seg}`
      SKELETON[name] = [parent, [sx * len, 0, seg === 'Proximal' ? z : 0]]
      parent = name
    }
  }
}

export const HIPS_HEIGHT = 0.9
// LLM に公開する主要ボーン (指は含めない)
export const BONE_NAMES = Object.keys(SKELETON).filter((n) => !/Proximal|Intermediate|Distal/.test(n))
const ALL_BONES = Object.keys(SKELETON)

// 自然な手: 指を軽く曲げるデフォルトポーズ (度)
const FINGER_CURL = { Proximal: 14, Intermediate: 17, Distal: 10 }

// VRM 1.0 プリセット表情
export const EXPRESSION_PRESETS = [
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
  'aa', 'ih', 'ou', 'ee', 'oh',
  'blink', 'blinkLeft', 'blinkRight',
  'lookUp', 'lookDown', 'lookLeft', 'lookRight',
]

const eulerQuat = (() => {
  const e = new THREE.Euler()
  const q = new THREE.Quaternion()
  return (deg: number[]) => {
    e.set(
      THREE.MathUtils.degToRad(deg[0]),
      THREE.MathUtils.degToRad(deg[1]),
      THREE.MathUtils.degToRad(deg[2]),
      'XYZ'
    )
    q.setFromEuler(e)
    return [q.x, q.y, q.z, q.w]
  }
})()

export interface VRMAMotionSpec {
  name: string
  duration: number
  loop: boolean
  tracks: Record<string, Array<{ t: number, r: number[] }>>
  hips?: Array<{ t: number, p: number[] }>
  expressions?: Record<string, Array<{ t: number, w: number }>>
}

/**
 * VRMAMotionSpec から VRMA (GLB) バイナリを生成する。
 */
export function buildVRMA(spec: VRMAMotionSpec): ArrayBuffer {
  const nodes: any[] = []
  const nodeIndex: Record<string, number> = {}
  for (const name of ALL_BONES) {
    nodeIndex[name] = nodes.length
    nodes.push({ name: `J_${name}`, translation: [...SKELETON[name][1]] })
  }
  for (const name of ALL_BONES) {
    const parent = SKELETON[name][0]
    if (parent !== null) {
      const parentNode = nodes[nodeIndex[parent]]
      ;(parentNode.children ??= []).push(nodeIndex[name])
    }
  }

  const tracks = { ...(spec.tracks ?? {}) }
  const dur = spec.duration ?? 1

  // 肩の自動追従
  for (const side of ['left', 'right']) {
    const shoulderBone = `${side}Shoulder`
    const ua = tracks[`${side}UpperArm`]
    if (!ua?.length || tracks[shoulderBone]) continue
    const raiseSign = side === 'left' ? 1 : -1
    const keys = ua.map((k) => {
      const raise = Math.max(0, raiseSign * k.r[2] - 55)
      const lift = Math.min(14, raise * 0.4)
      return { t: k.t, r: [0, 0, raiseSign * lift] }
    })
    if (keys.some((k) => k.r[2] !== 0)) tracks[shoulderBone] = keys
  }

  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1
    for (const finger of ['Index', 'Middle', 'Ring', 'Little']) {
      for (const [seg, deg] of Object.entries(FINGER_CURL)) {
        const bone = `${side}${finger}${seg}`
        if (!(bone in tracks)) {
          const r = [0, 0, sign * deg]
          tracks[bone] = [{ t: 0, r }, { t: dur, r }]
        }
      }
    }
  }

  const binParts: Float32Array[] = []
  const bufferViews: any[] = []
  const accessors: any[] = []
  let binOffset = 0

  function addAccessor(floatArray: Float32Array, type: string, isInput: boolean) {
    const byteLength = floatArray.byteLength
    bufferViews.push({ buffer: 0, byteOffset: binOffset, byteLength })
    binParts.push(floatArray)
    binOffset += byteLength
    const acc: any = {
      bufferView: bufferViews.length - 1,
      componentType: 5126, // FLOAT
      count: type === 'SCALAR' ? floatArray.length : floatArray.length / (type === 'VEC3' ? 3 : 4),
      type,
    }
    if (isInput) {
      acc.min = [Math.min(...floatArray)]
      acc.max = [Math.max(...floatArray)]
    }
    accessors.push(acc)
    return accessors.length - 1
  }

  const samplers: any[] = []
  const channels: any[] = []

  const trackEntries = Object.entries(tracks).filter(
    ([bone]) => bone in SKELETON
  )
  for (const [bone, keys] of trackEntries) {
    if (!keys?.length) continue
    const sorted = [...keys].sort((a, b) => a.t - b.t)
    const times = new Float32Array(sorted.map((k) => k.t))
    const values = new Float32Array(sorted.length * 4)
    sorted.forEach((k, i) => values.set(eulerQuat(k.r), i * 4))
    const input = addAccessor(times, 'SCALAR', true)
    const output = addAccessor(values, 'VEC4', false)
    samplers.push({ input, output, interpolation: 'LINEAR' })
    channels.push({
      sampler: samplers.length - 1,
      target: { node: nodeIndex[bone], path: 'rotation' },
    })
  }

  if (spec.hips?.length) {
    const sorted = [...spec.hips].sort((a, b) => a.t - b.t)
    const times = new Float32Array(sorted.map((k) => k.t))
    const values = new Float32Array(sorted.length * 3)
    sorted.forEach((k, i) =>
      values.set([k.p[0], HIPS_HEIGHT + k.p[1], k.p[2]], i * 3)
    )
    const input = addAccessor(times, 'SCALAR', true)
    const output = addAccessor(values, 'VEC3', false)
    samplers.push({ input, output, interpolation: 'LINEAR' })
    channels.push({
      sampler: samplers.length - 1,
      target: { node: nodeIndex.hips, path: 'translation' },
    })
  }

  const expressionsUsed: Record<string, { node: number }> = {}
  for (const [name, keys] of Object.entries(spec.expressions ?? {})) {
    if (!EXPRESSION_PRESETS.includes(name) || !keys?.length) continue
    const nodeIdx = nodes.length
    nodes.push({ name: `E_${name}`, translation: [0, 0, 0] })
    expressionsUsed[name] = { node: nodeIdx }
    const sorted = [...keys].sort((a, b) => a.t - b.t)
    const times = new Float32Array(sorted.map((k) => k.t))
    const values = new Float32Array(sorted.length * 3)
    sorted.forEach((k, i) =>
      values.set([Math.max(0, Math.min(1, Number(k.w) || 0)), 0, 0], i * 3)
    )
    const input = addAccessor(times, 'SCALAR', true)
    const output = addAccessor(values, 'VEC3', false)
    samplers.push({ input, output, interpolation: 'LINEAR' })
    channels.push({
      sampler: samplers.length - 1,
      target: { node: nodeIdx, path: 'translation' },
    })
  }

  if (channels.length === 0) {
    throw new Error('モーションにトラックがありません')
  }

  const humanBones: Record<string, { node: number }> = {}
  for (const name of ALL_BONES) {
    humanBones[name] = { node: nodeIndex[name] }
  }

  const json = {
    asset: { version: '2.0', generator: 'text-to-motion' },
    extensionsUsed: ['VRMC_vrm_animation'],
    extensions: {
      VRMC_vrm_animation: {
        specVersion: '1.0',
        humanoid: { humanBones },
        ...(Object.keys(expressionsUsed).length
          ? { expressions: { preset: expressionsUsed } }
          : {}),
      },
    },
    scene: 0,
    scenes: [{ nodes: [nodeIndex.hips] }],
    nodes,
    animations: [{ name: spec.name ?? 'motion', channels, samplers }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: binOffset }],
  }

  return packGLB(json, binParts, binOffset)
}

function packGLB(json: any, binParts: Float32Array[], binLength: number): ArrayBuffer {
  const encoder = new TextEncoder()
  const jsonBytes = encoder.encode(JSON.stringify(json))
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4
  const binPad = (4 - (binLength % 4)) % 4

  const jsonChunkLen = jsonBytes.length + jsonPad
  const binChunkLen = binLength + binPad
  const total = 12 + 8 + jsonChunkLen + 8 + binChunkLen

  const buffer = new ArrayBuffer(total)
  const dv = new DataView(buffer)
  const u8 = new Uint8Array(buffer)

  let o = 0
  dv.setUint32(o, 0x46546c67, true); o += 4 // 'glTF'
  dv.setUint32(o, 2, true); o += 4
  dv.setUint32(o, total, true); o += 4

  dv.setUint32(o, jsonChunkLen, true); o += 4
  dv.setUint32(o, 0x4e4f534a, true); o += 4 // 'JSON'
  u8.set(jsonBytes, o); o += jsonBytes.length
  for (let i = 0; i < jsonPad; i++) u8[o++] = 0x20

  dv.setUint32(o, binChunkLen, true); o += 4
  dv.setUint32(o, 0x004e4942, true); o += 4 // 'BIN'
  for (const part of binParts) {
    u8.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), o)
    o += part.byteLength
  }
  return buffer
}
