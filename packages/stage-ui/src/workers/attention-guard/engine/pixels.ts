/**
 * Attention Ecology Guard — pure pixel operations (Stage 0 + Stage 2 signal
 * extraction). Browser-safe: operates on raw pixel buffers decoded from
 * capture data URLs; no Node or native deps. Ported from the cleanroom
 * harness engine (`scripts/tests/attention-ecology-harness/engine/stage0-phash.ts`
 * and `stage2-ocr.ts`), which remains the benchmark oracle.
 */

export interface GrayBuffer {
  width: number
  height: number
  data: Uint8Array
}

export interface DeltaBBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Stage-0 rejection floor: normalized aHash Hamming distance (calibrated in
 *  the harness: 01->02 = 0.0010 reject vs 03->04 = 0.0029 pass).
 */
export const STAGE0_HAMMING_MIN = 0.0015

const HASH_GRID = 32
const HASH_BITS = HASH_GRID * HASH_GRID
const DELTA_PIXEL_THRESHOLD = 24
const DELTA_PROJECTION_RATIO = 0.004
const BBOX_PAD = 40

/** Grayscale luminance from an RGB/RGBA/grayscale raw buffer. */
export function toGray(raw: Uint8Array, width: number, height: number, channels: number): GrayBuffer {
  const data = new Uint8Array(width * height)
  for (let i = 0; i < data.length; i++) {
    const base = i * channels
    if (channels >= 3) {
      const r = raw[base]
      const g = raw[base + 1]
      const b = raw[base + 2]
      // Rec. 601 luma
      data[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0
    }
    else {
      data[i] = raw[base]
    }
  }
  return { width, height, data }
}

/** Box-average downscale of a grayscale buffer (aHash front-end). */
export function boxResizeGray(src: GrayBuffer, targetWidth: number, targetHeight: number): Uint8Array {
  const out = new Uint8Array(targetWidth * targetHeight)
  const xScale = src.width / targetWidth
  const yScale = src.height / targetHeight
  for (let ty = 0; ty < targetHeight; ty++) {
    const y0 = Math.floor(ty * yScale)
    const y1 = Math.min(src.height, Math.ceil((ty + 1) * yScale))
    for (let tx = 0; tx < targetWidth; tx++) {
      const x0 = Math.floor(tx * xScale)
      const x1 = Math.min(src.width, Math.ceil((tx + 1) * xScale))
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += src.data[y * src.width + x]
          count++
        }
      }
      out[ty * targetWidth + tx] = count > 0 ? (sum / count) | 0 : 0
    }
  }
  return out
}

/** 1024-bit average-hash (aHash) over a 32x32 luma grid. */
export function computeAHash(gray32: Uint8Array): { bits: Uint8Array, hex: string } {
  let mean = 0
  for (let i = 0; i < gray32.length; i++) mean += gray32[i]
  mean /= gray32.length

  const bits = new Uint8Array(HASH_BITS)
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
  return { bits, hex: hexBytes.map(b => b.toString(16).padStart(2, '0')).join('') }
}

export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length)
    throw new Error(`Hash length mismatch: ${a.length} vs ${b.length}`)
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      dist++
  }
  return dist
}

/** Bounding box of pixels that changed between two same-dims frames. */
export function computeDeltaBBox(prev: GrayBuffer, curr: GrayBuffer): DeltaBBox | null {
  if (prev.width !== curr.width || prev.height !== curr.height)
    return null
  const width = prev.width
  const height = prev.height
  const rows = new Array(height).fill(0)
  const cols = new Array(width).fill(0)

  for (let y = 0; y < height; y++) {
    const rowBase = y * width
    for (let x = 0; x < width; x++) {
      if (Math.abs(prev.data[rowBase + x] - curr.data[rowBase + x]) > DELTA_PIXEL_THRESHOLD) {
        rows[y]++
        cols[x]++
      }
    }
  }

  const rowMin = height * DELTA_PROJECTION_RATIO
  const colMin = width * DELTA_PROJECTION_RATIO
  let top = -1
  let bottom = -1
  let left = -1
  let right = -1
  for (let y = 0; y < height; y++) {
    if (rows[y] > colMin) {
      if (top < 0)
        top = y; bottom = y
    }
  }
  for (let x = 0; x < width; x++) {
    if (cols[x] > rowMin) {
      if (left < 0)
        left = x; right = x
    }
  }
  if (top < 0)
    return null

  return {
    left: Math.max(0, left - BBOX_PAD),
    top: Math.max(0, top - BBOX_PAD),
    width: Math.min(width - 1, right + BBOX_PAD) - Math.max(0, left - BBOX_PAD) + 1,
    height: Math.min(height - 1, bottom + BBOX_PAD) - Math.max(0, top - BBOX_PAD) + 1,
  }
}

/** Fraction of saturated-red pixels (error-text red on dark backgrounds). */
export function computeRedAlertRatio(raw: Uint8Array, width: number, height: number, channels: number): number {
  const total = width * height
  let red = 0
  for (let i = 0; i < total; i++) {
    const base = i * channels
    if (channels >= 3 && raw[base] >= 150 && raw[base + 1] <= 90 && raw[base + 2] <= 90)
      red++
  }
  return red / total
}
