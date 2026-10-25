import { describe, expect, it } from 'vitest'

import { exportVrmBinary } from './glb-exporter'

interface SyntheticGlb {
  json: any
  bin: Uint8Array
}

function buildGlb({ json, bin }: SyntheticGlb): ArrayBuffer {
  const encoder = new TextEncoder()
  let jsonBytes = encoder.encode(JSON.stringify(json))
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4
  if (jsonPadding > 0) {
    const padded = new Uint8Array(jsonBytes.length + jsonPadding)
    padded.set(jsonBytes)
    padded.fill(0x20, jsonBytes.length)
    jsonBytes = padded
  }
  const binary = new Uint8Array(Math.ceil(bin.length / 4) * 4)
  binary.set(bin)

  const total = 12 + 8 + jsonBytes.length + 8 + binary.length
  const output = new Uint8Array(total)
  const view = new DataView(output.buffer)
  view.setUint32(0, 0x46546C67, true)
  view.setUint32(4, 2, true)
  view.setUint32(8, total, true)
  view.setUint32(12, jsonBytes.length, true)
  view.setUint32(16, 0x4E4F534A, true)
  output.set(jsonBytes, 20)
  const binHeader = 20 + jsonBytes.length
  view.setUint32(binHeader, binary.length, true)
  view.setUint32(binHeader + 4, 0x004E4942, true)
  output.set(binary, binHeader + 8)
  return output.buffer
}

function parseGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer)
  const jsonLen = view.getUint32(12, true)
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLen)))
  const binHeader = 20 + jsonLen
  const binLen = view.getUint32(binHeader, true)
  const bin = new Uint8Array(buffer, binHeader + 8, binLen)
  return { json, bin }
}

function fixture() {
  const bin = new Uint8Array([
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
  ])
  const json = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 4 },
      { buffer: 0, byteOffset: 4, byteLength: 4 },
      { buffer: 0, byteOffset: 8, byteLength: 4 },
    ],
    images: [
      { bufferView: 0, mimeType: 'image/jpeg' },
      { bufferView: 1, mimeType: 'image/png' },
    ],
    materials: [{ name: 'Original' }],
    meshes: [{ primitives: [{ material: 0 }, { material: 0 }] }],
    nodes: [{ name: 'body' }, { name: 'hidden', scale: [1, 1, 1] }],
  }
  return { source: buildGlb({ json, bin }), bin }
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function imageBytes(json: any, bin: Uint8Array, index: number): number[] {
  const view = json.bufferViews[json.images[index].bufferView]
  return Array.from(bin.slice(view.byteOffset, view.byteOffset + view.byteLength))
}

describe('hacker-studio: VRM GLB exporter characterization', () => {
  it('rebuilds a valid GLB with no mutations', () => {
    const { source } = fixture()
    const output = exportVrmBinary({ source })
    const { json, bin } = parseGlb(output)

    expect(json.asset.version).toBe('2.0')
    expect(json.buffers[0].byteLength).toBe(bin.length)
    expect(imageBytes(json, bin, 0)).toEqual([1, 2, 3, 4])
    expect(imageBytes(json, bin, 1)).toEqual([5, 6, 7, 8])
    // The exporter always injects VHACK_HIDDEN, so the output is not byte-length identical.
    expect(output.byteLength).toBeGreaterThan(0)
  })

  it('replaces image bytes and mime type while preserving other bufferViews', () => {
    const { source } = fixture()
    const replacement = new Uint8Array([9, 8, 7, 6, 5])
    const output = exportVrmBinary({
      source,
      mutations: [{
        imageIndex: 0,
        data: toBase64(replacement),
        mimeType: 'image/png',
      }],
    })
    const { json, bin } = parseGlb(output)

    expect(imageBytes(json, bin, 0)).toEqual([9, 8, 7, 6, 5])
    expect(json.images[0].mimeType).toBe('image/png')
    expect(imageBytes(json, bin, 1)).toEqual([5, 6, 7, 8])
    expect(json.bufferViews[2].byteLength).toBe(4)
    expect(Array.from(bin.slice(json.bufferViews[2].byteOffset, json.bufferViews[2].byteOffset + 4))).toEqual([9, 10, 11, 12])
    expect(json.buffers[0].byteLength).toBe(bin.length)
  })

  it('applies multiple mutations in offset order', () => {
    const { source } = fixture()
    const output = exportVrmBinary({
      source,
      mutations: [
        { imageIndex: 1, data: toBase64(new Uint8Array([20, 21])), mimeType: 'image/png' },
        { imageIndex: 0, data: toBase64(new Uint8Array([30, 31, 32])), mimeType: 'image/png' },
      ],
    })
    const { json, bin } = parseGlb(output)
    expect(imageBytes(json, bin, 0)).toEqual([30, 31, 32])
    expect(imageBytes(json, bin, 1)).toEqual([20, 21])
    expect(json.buffers[0].byteLength).toBe(bin.length)
  })

  it('performs hidden-primitive surgery through the hidden material', () => {
    const { source } = fixture()
    const output = exportVrmBinary({
      source,
      hiddenPrimitives: [{ meshIndex: 0, primitiveIndex: 1 }],
    })
    const { json } = parseGlb(output)
    const hiddenIndex = json.materials.findIndex((material: any) => material.name === 'VHACK_HIDDEN')
    expect(hiddenIndex).toBeGreaterThanOrEqual(0)
    expect(json.meshes[0].primitives[0].material).toBe(0)
    expect(json.meshes[0].primitives[1].material).toBe(hiddenIndex)
  })

  it('ghost-scales hidden nodes', () => {
    const { source } = fixture()
    const output = exportVrmBinary({ source, hiddenNodeIndices: [1] })
    const { json } = parseGlb(output)
    expect(json.nodes[0].scale).toBeUndefined()
    expect(json.nodes[1].scale).toEqual([0, 0, 0])
  })

  it('ignores mutations for missing images or bufferViews', () => {
    const { source } = fixture()
    const output = exportVrmBinary({
      source,
      mutations: [
        { imageIndex: 99, data: 'AAAA' },
        { imageIndex: 0, data: 'AAAA' },
      ],
    })
    const { json, bin } = parseGlb(output)
    expect(imageBytes(json, bin, 0)).toEqual([0, 0, 0])
    expect(json.buffers[0].byteLength).toBe(bin.length)
  })

  it('rejects an invalid GLB magic', () => {
    const invalid = new Uint8Array(32).buffer
    expect(() => exportVrmBinary({ source: invalid })).toThrow('Invalid GLB magic')
  })
})
