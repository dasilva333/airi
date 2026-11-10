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

import type { PerceptualHash, PixelDeltaResult } from '@proj-airi/stage-shared/attention'

import fs from 'node:fs'

import sharp from 'sharp'

import { computeAHash, hammingDistance, HASH_BITS, HASH_GRID } from '@proj-airi/stage-shared/attention'

export { hammingDistance, HASH_BITS, HASH_GRID }
export type { PerceptualHash, PixelDeltaResult }

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

  return computeAHash(new Uint8Array(data))
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
