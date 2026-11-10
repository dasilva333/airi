import type { DeltaBBox, PerceptualHash } from './types.js'

export const HASH_GRID = 32
export const HASH_BITS = HASH_GRID * HASH_GRID

/**
 * Calibrated Stage-0 rejection floor: normalized aHash Hamming distance
 * (01->02 static cursor = 0.0010 reject vs 03->04 content change = 0.0029 pass).
 */
export const STAGE0_HAMMING_MIN = 0.0015

const DELTA_PIXEL_THRESHOLD = 24
const DELTA_PROJECTION_RATIO = 0.004
const BBOX_PAD = 40

/**
 * Converts raw RGB/RGBA/Grayscale buffer into a grayscale luminance buffer (Rec. 601).
 * Reuses target array if provided and length matches to minimize allocations.
 */
export function toGray(
  raw: Uint8Array,
  width: number,
  height: number,
  channels: number,
  target?: Uint8Array | null,
): Uint8Array {
  const total = width * height
  const out = (target && target.length === total) ? target : new Uint8Array(total)

  for (let i = 0; i < total; i++) {
    const base = i * channels
    if (channels >= 3) {
      const r = raw[base]
      const g = raw[base + 1]
      const b = raw[base + 2]
      out[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0
    }
    else {
      out[i] = raw[base]
    }
  }

  return out
}

/**
 * Box-average downscales a grayscale buffer to target dimensions.
 * Reuses target array if provided.
 */
export function boxResizeGray(
  srcData: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetWidth: number,
  targetHeight: number,
  targetOut?: Uint8Array | null,
): Uint8Array {
  const total = targetWidth * targetHeight
  const out = (targetOut && targetOut.length === total) ? targetOut : new Uint8Array(total)
  const xScale = srcWidth / targetWidth
  const yScale = srcHeight / targetHeight

  for (let ty = 0; ty < targetHeight; ty++) {
    const y0 = Math.floor(ty * yScale)
    const y1 = Math.min(srcHeight, Math.ceil((ty + 1) * yScale))
    for (let tx = 0; tx < targetWidth; tx++) {
      const x0 = Math.floor(tx * xScale)
      const x1 = Math.min(srcWidth, Math.ceil((tx + 1) * xScale))
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += srcData[y * srcWidth + x]
          count++
        }
      }
      out[ty * targetWidth + tx] = count > 0 ? (sum / count) | 0 : 0
    }
  }

  return out
}

/**
 * Computes a 1024-bit average hash (aHash) over a 32x32 luminance grid.
 */
export function computeAHash(
  gray32: Uint8Array,
  targetBits?: Uint8Array | null,
): PerceptualHash {
  let mean = 0
  for (let i = 0; i < gray32.length; i++) {
    mean += gray32[i]
  }
  mean /= gray32.length

  const bits = (targetBits && targetBits.length === HASH_BITS) ? targetBits : new Uint8Array(HASH_BITS)
  const hexBytes: number[] = []
  let byteAcc = 0

  for (let i = 0; i < HASH_BITS; i++) {
    const bit = gray32[i] >= mean ? 1 : 0
    bits[i] = bit
    byteAcc = (byteAcc << 1) | bit
    if (i % 8 === 7) {
      hexBytes.push(byteAcc)
      byteAcc = 0
    }
  }

  return {
    bits,
    hex: hexBytes.map(b => b.toString(16).padStart(2, '0')).join(''),
  }
}

/**
 * Calculates absolute Hamming distance between two hash bit arrays.
 */
export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error(`Hash length mismatch: ${a.length} vs ${b.length}`)
  }
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      dist++
    }
  }
  return dist
}

/**
 * Calculates normalized Hamming distance [0.0 - 1.0].
 */
export function normalizedHammingDistance(a: Uint8Array, b: Uint8Array): number {
  return hammingDistance(a, b) / a.length
}

/**
 * Computes a bounding box around pixel changes between two grayscale buffers of the same dimensions.
 * Returns null if changes are below threshold.
 */
export function computeDeltaBBox(
  prevGray: Uint8Array,
  currGray: Uint8Array,
  width: number,
  height: number,
  pixelThreshold = DELTA_PIXEL_THRESHOLD,
): DeltaBBox | null {
  const total = width * height
  if (prevGray.length !== total || currGray.length !== total) {
    return null
  }

  const colCounts = new Int32Array(width)
  const rowCounts = new Int32Array(height)
  let changedTotal = 0

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width
    for (let x = 0; x < width; x++) {
      const diff = Math.abs(currGray[rowOffset + x] - prevGray[rowOffset + x])
      if (diff >= pixelThreshold) {
        colCounts[x]++
        rowCounts[y]++
        changedTotal++
      }
    }
  }

  if (changedTotal === 0) {
    return null
  }

  const rowMinThreshold = Math.max(1, (width * DELTA_PROJECTION_RATIO) | 0)
  const colMinThreshold = Math.max(1, (height * DELTA_PROJECTION_RATIO) | 0)

  let minX = -1
  let maxX = -1
  for (let x = 0; x < width; x++) {
    if (colCounts[x] >= colMinThreshold) {
      if (minX === -1)
        minX = x
      maxX = x
    }
  }

  let minY = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    if (rowCounts[y] >= rowMinThreshold) {
      if (minY === -1)
        minY = y
      maxY = y
    }
  }

  if (minX === -1 || minY === -1) {
    return null
  }

  const left = Math.max(0, minX - BBOX_PAD)
  const top = Math.max(0, minY - BBOX_PAD)
  const right = Math.min(width, maxX + BBOX_PAD + 1)
  const bottom = Math.min(height, maxY + BBOX_PAD + 1)

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}
