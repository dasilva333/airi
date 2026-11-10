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
import {
  calculateCosineDistance,
  calculateCosineSimilarity,
  centroidOf,
  normalizeVector,
} from '@proj-airi/stage-shared/attention'

export {
  calculateCosineDistance,
  calculateCosineSimilarity,
  centroidOf,
  normalizeVector,
}

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
