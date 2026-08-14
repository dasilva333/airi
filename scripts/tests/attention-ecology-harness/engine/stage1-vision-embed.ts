/**
 * Stage 1 — Vision Vector Embedding & Cosine Novelty Evaluator (ms cost).
 * Encodes screenshots into 512-dim CLIP feature embeddings and measures
 * cosine distance against a rolling context centroid.
 *
 * Reuses the canonical FlowMDM CLIP integration pattern (see
 * packages/stage-ui/src/utils/flowmdm/clipEncoder.ts): same model id
 * (`Xenova/clip-vit-base-patch32`), same module-level cached loader promises.
 * Here we load the *vision* tower (CLIPVisionModelWithProjection) instead of
 * the text tower, so frame embeddings live in the same 512-dim shared space
 * as the text embeddings used by the Stage 2 zero-shot salience classifier.
 *
 * NOTICE: Unlike clipEncoder.ts, encode failures THROW instead of returning
 * a synthetic fallback embedding. A harness assertion must never pass on
 * fabricated vectors.
 */

import path from 'node:path'

import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { AutoProcessor, CLIPVisionModelWithProjection, env, RawImage } from '@huggingface/transformers'

// Model weights cache lives next to the harness (gitignored), not in the OS home dir.
const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
env.cacheDir = path.join(HARNESS_ROOT, '.cache')

export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32'
export const CLIP_EMBEDDING_DIMS = 512

let processorPromise: Promise<any> | null = null
let visionModelPromise: Promise<any> | null = null

export interface VisionEmbeddingResult {
  embedding: Float32Array
  dims: number
  encodeMs: number
}

export type ProgressCallback = (info: {
  status?: string
  name?: string
  file?: string
  progress?: number
  loaded?: number
  total?: number
}) => void

export async function loadVisionEncoder(onLog?: (msg: string) => void, onProgress?: ProgressCallback): Promise<[any, any]> {
  if (!processorPromise) {
    onLog?.(`Loading CLIP image processor (${CLIP_MODEL_ID})...`)
    processorPromise = AutoProcessor.from_pretrained(CLIP_MODEL_ID, {
      progress_callback: onProgress,
    })
  }
  if (!visionModelPromise) {
    onLog?.(`Loading CLIP vision model (${CLIP_MODEL_ID})...`)
    visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, {
      progress_callback: onProgress,
    })
  }
  return Promise.all([processorPromise, visionModelPromise])
}

/**
 * Releases the ONNX session. NOTICE: onnxruntime-node aborts at process
 * teardown (`mutex lock failed`, exit 134) if `process.exit()` is called
 * while an inference session is still alive — always dispose first and let
 * the process exit naturally.
 */
export async function disposeVisionEncoder(): Promise<void> {
  if (visionModelPromise) {
    const model = await visionModelPromise
    await model.dispose?.()
    visionModelPromise = null
  }
  processorPromise = null
}

export function normalizeVector(vec: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) + 1e-9
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
  return out
}

/**
 * Encodes an image file into a unit-norm 512-dim CLIP vision embedding.
 * Decoding goes through sharp -> RawImage so no image-backend magic inside
 * transformers.js is involved.
 */
export async function getVisionEmbedding(imagePath: string, onLog?: (msg: string) => void): Promise<VisionEmbeddingResult> {
  const [processor, visionModel] = await loadVisionEncoder(onLog)

  const started = performance.now()
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const image = new RawImage(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, info.channels)
  const { pixel_values } = await processor(image)
  const { image_embeds } = await visionModel({ pixel_values })

  const embedding = normalizeVector(image_embeds.data as Float32Array)
  return { embedding, dims: embedding.length, encodeMs: performance.now() - started }
}

/** Cosine similarity in [-1, 1]. */
export function calculateCosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
  if (vecA.length !== vecB.length) {
    throw new Error(`Dimension mismatch: ${vecA.length} vs ${vecB.length}`)
  }

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-9)
}

/** Cosine distance (1.0 - cosine similarity) in [0, 2]. */
export function calculateCosineDistance(vecA: Float32Array, vecB: Float32Array): number {
  return 1.0 - calculateCosineSimilarity(vecA, vecB)
}

/** Unit-norm mean of a set of embeddings (rolling context centroid). */
export function centroidOf(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('centroidOf() requires at least one embedding')
  }
  const dims = embeddings[0].length
  const acc = new Float32Array(dims)
  for (const emb of embeddings) {
    if (emb.length !== dims) {
      throw new Error(`Dimension mismatch in centroid: ${emb.length} vs ${dims}`)
    }
    for (let i = 0; i < dims; i++) acc[i] += emb[i]
  }
  for (let i = 0; i < dims; i++) acc[i] /= embeddings.length
  return normalizeVector(acc)
}
