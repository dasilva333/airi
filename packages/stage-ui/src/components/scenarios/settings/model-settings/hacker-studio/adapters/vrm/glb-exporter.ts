/**
 * Pure VRM/GLB surgical exporter.
 *
 * Extracted from `HackerPanel.vue` without changing the binary layout. The
 * component resolves Three.js hidden nodes/primitives and supplies the mutation
 * registry; this module owns GLB parsing, image bufferView replacement, hidden
 * surgery, and chunk assembly.
 */

export interface VrmExportMutation {
  imageIndex: number
  /** Base64 payload (no data: prefix). */
  data: string
  mimeType?: string
}

export interface VrmHiddenPrimitive {
  meshIndex: number
  primitiveIndex: number
}

export interface VrmExportOptions {
  source: ArrayBuffer
  mutations?: VrmExportMutation[]
  hiddenPrimitives?: VrmHiddenPrimitive[]
  hiddenNodeIndices?: number[]
}

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK_TYPE = 0x4E4F534A
const BIN_CHUNK_TYPE = 0x004E4942

export function exportVrmBinary(options: VrmExportOptions): ArrayBuffer {
  const { source } = options
  const dataView = new DataView(source)

  if (dataView.getUint32(0, true) !== GLB_MAGIC)
    throw new Error('Invalid GLB magic')

  const jsonLen = dataView.getUint32(12, true)
  const jsonContent = new TextDecoder().decode(new Uint8Array(source, 20, jsonLen))
  const gltf: any = JSON.parse(jsonContent)

  if (!gltf.materials)
    gltf.materials = []

  const hiddenMaterialIndex = gltf.materials.length
  gltf.materials.push({
    name: 'VHACK_HIDDEN',
    pbrMetallicRoughness: {
      baseColorFactor: [0, 0, 0, 0],
      metallicFactor: 0,
      roughnessFactor: 1,
    },
    alphaMode: 'BLEND',
  })

  for (const hidden of options.hiddenPrimitives || []) {
    const mesh = gltf.meshes?.[hidden.meshIndex]
    const primitive = mesh?.primitives?.[hidden.primitiveIndex]
    if (primitive)
      primitive.material = hiddenMaterialIndex
  }

  for (const nodeIndex of options.hiddenNodeIndices || []) {
    if (gltf.nodes?.[nodeIndex])
      gltf.nodes[nodeIndex].scale = [0, 0, 0]
  }

  const binOffset = 20 + jsonLen + 8
  const binLen = dataView.getUint32(20 + jsonLen, true)
  const originalBin = new Uint8Array(source, binOffset, binLen)

  const mutations: { offset: number, oldLen: number, newData: Uint8Array }[] = []
  for (const mutation of options.mutations || []) {
    const image = gltf.images?.[mutation.imageIndex]
    if (!image || image.bufferView === undefined)
      continue
    const bufferView = gltf.bufferViews?.[image.bufferView]
    if (!bufferView)
      continue
    const binaryString = atob(mutation.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++)
      bytes[i] = binaryString.charCodeAt(i)
    mutations.push({ offset: bufferView.byteOffset, oldLen: bufferView.byteLength, newData: bytes })
    bufferView.byteLength = bytes.length
    image.mimeType = mutation.mimeType || image.mimeType || 'image/png'
  }

  mutations.sort((a, b) => a.offset - b.offset)

  let currentShift = 0
  let lastOriginalOffset = 0
  const newBinParts: Uint8Array[] = []
  const sortedBufferViews = gltf.bufferViews
    .map((bufferView: any, idx: number) => ({ ...bufferView, idx }))
    .sort((a: any, b: any) => a.byteOffset - b.byteOffset)

  for (const bufferViewProxy of sortedBufferViews) {
    const originalBufferView = gltf.bufferViews[bufferViewProxy.idx]
    const mutation = mutations.find(m => m.offset === originalBufferView.byteOffset)

    if (originalBufferView.byteOffset > lastOriginalOffset)
      newBinParts.push(originalBin.slice(lastOriginalOffset, originalBufferView.byteOffset))

    originalBufferView.byteOffset += currentShift

    if (mutation) {
      newBinParts.push(mutation.newData)
      currentShift += mutation.newData.length - mutation.oldLen
      lastOriginalOffset = mutation.offset + mutation.oldLen
    }
    else {
      newBinParts.push(originalBin.slice(
        originalBufferView.byteOffset - currentShift,
        originalBufferView.byteOffset - currentShift + originalBufferView.byteLength,
      ))
      lastOriginalOffset = originalBufferView.byteOffset - currentShift + originalBufferView.byteLength
    }

    const currentTotalLen = newBinParts.reduce((total, part) => total + part.length, 0)
    const padding = (4 - (currentTotalLen % 4)) % 4
    if (padding > 0) {
      newBinParts.push(new Uint8Array(padding).fill(0x20))
      currentShift += padding
    }
  }

  if (lastOriginalOffset < originalBin.length)
    newBinParts.push(originalBin.slice(lastOriginalOffset))

  const finalBinLen = newBinParts.reduce((total, part) => total + part.length, 0)
  // The buffer byteLength must be updated before serializing the JSON; otherwise
  // strict loaders see the original, shorter buffer length.
  if (gltf.buffers?.[0])
    gltf.buffers[0].byteLength = finalBinLen

  const jsonEncoder = new TextEncoder()
  let jsonBytes = jsonEncoder.encode(JSON.stringify(gltf))
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4
  if (jsonPadding > 0) {
    const paddedBytes = new Uint8Array(jsonBytes.length + jsonPadding)
    paddedBytes.set(jsonBytes)
    paddedBytes.fill(0x20, jsonBytes.length)
    jsonBytes = paddedBytes
  }

  const finalTotalLen = 12 + 8 + jsonBytes.length + 8 + finalBinLen
  const outputBuffer = new ArrayBuffer(finalTotalLen)
  const outView = new DataView(outputBuffer)
  const outBytes = new Uint8Array(outputBuffer)

  outView.setUint32(0, GLB_MAGIC, true)
  outView.setUint32(4, 2, true)
  outView.setUint32(8, finalTotalLen, true)

  outView.setUint32(12, jsonBytes.length, true)
  outView.setUint32(16, JSON_CHUNK_TYPE, true)
  outBytes.set(jsonBytes, 20)

  const binChunkHeaderOffset = 20 + jsonBytes.length
  outView.setUint32(binChunkHeaderOffset, finalBinLen, true)
  outView.setUint32(binChunkHeaderOffset + 4, BIN_CHUNK_TYPE, true)

  let currentOutOffset = binChunkHeaderOffset + 8
  for (const part of newBinParts) {
    outBytes.set(part, currentOutOffset)
    currentOutOffset += part.length
  }

  return outputBuffer
}
