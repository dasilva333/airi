/**
 * Stage 0 — Perceptual Hash & Pixel Delta Calculator (us-ms cost).
 * Rejects static/near-static ticks before running any neural models.
 *
 * NOTICE: The seeded stub compared raw PNG *file bytes*. That is not a
 * perceptual hash — PNG is a compressed stream, so a tiny visual change
 * (cursor popover) shifts downstream bytes and file length, and the stub
 * reported CHANGED for `01 -> 02`, defeating the 0-cost filter.
 * This implementation decodes pixels and computes a real 32x32 average-hash
 * (aHash) with Hamming distance, which is robust to PNG encoder noise.
 */

import fs from 'node:fs'

import sharp from 'sharp'

const HASH_GRID = 32 // 32x32 luma grid -> 1024-bit hash
const HASH_BITS = HASH_GRID * HASH_GRID

export interface PerceptualHash {
  bits: Uint8Array
  hex: string
}

export interface PixelDeltaResult {
  hasChanged: boolean
  /** Absolute Hamming distance between the two 1024-bit hashes. */
  hammingDistance: number
  /** Hamming distance normalized to [0, 1] by hash length. */
  normalizedDistance: number
  hashA: string
  hashB: string
}

/**
 * Computes a 1024-bit average-hash (aHash): decode -> 32x32 luma -> bit set
 * where pixel luminance exceeds the grid mean.
 */
export async function computePerceptualHash(imagePath: string): Promise<PerceptualHash> {
  const { data } = await sharp(imagePath)
    .grayscale()
    .resize(HASH_GRID, HASH_GRID, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let mean = 0
  for (let i = 0; i < data.length; i++) mean += data[i]
  mean /= data.length

  const bits = new Uint8Array(HASH_BITS)
  const hexBytes: number[] = []
  let byteAcc = 0
  for (let i = 0; i < HASH_BITS; i++) {
    const bit = data[i] >= mean ? 1 : 0
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

export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) {
    throw new Error(`Hash length mismatch: ${a.length} vs ${b.length}`)
  }
  let dist = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i])
      dist++
  }
  return dist
}

/**
 * Computes perceptual delta between two image files. Byte-identical files
 * short-circuit at true 0-cost; otherwise both frames are hashed and the
 * normalized Hamming distance is compared against `threshold`.
 */
export async function computeImageDelta(fileA: string, fileB: string, threshold = 0.02): Promise<PixelDeltaResult> {
  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
    return { hasChanged: true, hammingDistance: HASH_BITS, normalizedDistance: 1, hashA: 'missing', hashB: 'missing' }
  }

  const bufA = fs.readFileSync(fileA)
  const bufB = fs.readFileSync(fileB)
  const hashA = await computePerceptualHash(fileA)

  if (bufA.equals(bufB)) {
    return { hasChanged: false, hammingDistance: 0, normalizedDistance: 0, hashA: hashA.hex, hashB: hashA.hex }
  }

  const hashB = await computePerceptualHash(fileB)
  const dist = hammingDistance(hashA.bits, hashB.bits)
  const normalized = dist / HASH_BITS

  return {
    hasChanged: normalized >= threshold,
    hammingDistance: dist,
    normalizedDistance: normalized,
    hashA: hashA.hex,
    hashB: hashB.hex,
  }
}
