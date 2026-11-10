/**
 * Cosine similarity and vector math for visual embedding novelty detection.
 */

export function calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) {
    return 0
  }

  return Math.max(-1, Math.min(1, dotProduct / denominator))
}

export function calculateCosineDistance(a: Float32Array, b: Float32Array): number {
  return Math.max(0, 1 - calculateCosineSimilarity(a, b))
}

export function normalizeVector(v: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i]
  }
  norm = Math.sqrt(norm)

  if (norm === 0) {
    return new Float32Array(v.length)
  }

  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] / norm
  }
  return out
}

export function centroidOf(vectors: Float32Array[]): Float32Array | null {
  if (!vectors.length) {
    return null
  }

  const dim = vectors[0].length
  const sum = new Float32Array(dim)

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      sum[i] += v[i]
    }
  }

  return normalizeVector(sum)
}

export function updateCentroid(
  currentCentroid: Float32Array | null,
  newVector: Float32Array,
  weight = 0.1,
): Float32Array {
  if (!currentCentroid) {
    return normalizeVector(newVector)
  }

  const dim = currentCentroid.length
  const blend = new Float32Array(dim)
  for (let i = 0; i < dim; i++) {
    blend[i] = currentCentroid[i] * (1 - weight) + newVector[i] * weight
  }

  return normalizeVector(blend)
}
