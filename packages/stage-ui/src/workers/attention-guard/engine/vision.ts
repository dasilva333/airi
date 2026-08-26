/**
 * Attention Ecology Guard — Stage 1 vision embedding + novelty, and the
 * Stage-2 zero-shot salience classifier (both CLIP towers share one 512-dim
 * space). Browser-safe; ported from the cleanroom harness engine
 * (`stage1-vision-embed.ts`, `stage2-salience-eval.ts`).
 */

import type { InferenceDevice } from '../../../libs/inference/contract'

import { AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage } from '@huggingface/transformers'

export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32'
export const CLIP_EMBEDDING_DIMS = 512

const SALIENCE_LABELS = {
  terminal_error: 'a screenshot of a terminal window showing a red error message',
  terminal_normal: 'a screenshot of a terminal window running a shell command',
  code_editor: 'a screenshot of a code editor displaying source code',
  video_player: 'a screenshot of a video playing in a web browser',
} as const

export type SalienceLabel = keyof typeof SALIENCE_LABELS

let visionProcessorPromise: Promise<any> | null = null
let visionModelPromise: Promise<any> | null = null
let tokenizerPromise: Promise<any> | null = null
let textModelPromise: Promise<any> | null = null
const textEmbeddingCache = new Map<SalienceLabel, Float32Array>()

/** Writes the model-weight cache into the app's configured transformers cache. */
export function configureVisionEnv(): void {
  // no-op: cache handled by the inference runtime env; kept for parity with harness.
}

/** Prime the CLIP vision + text towers (load handler warm-up). */
export async function warmupVision(device: InferenceDevice, progressCallback?: (progress: any) => void): Promise<void> {
  if (!visionProcessorPromise)
    visionProcessorPromise = AutoProcessor.from_pretrained(CLIP_MODEL_ID)
  if (!visionModelPromise)
    visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { device, progress_callback: progressCallback })
  if (!tokenizerPromise)
    tokenizerPromise = AutoTokenizer.from_pretrained(CLIP_MODEL_ID)
  if (!textModelPromise)
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, { device, progress_callback: progressCallback })

  await Promise.all([
    visionProcessorPromise,
    visionModelPromise,
    tokenizerPromise,
    textModelPromise,
  ])

  for (const label of Object.keys(SALIENCE_LABELS) as SalienceLabel[]) {
    if (!textEmbeddingCache.has(label))
      textEmbeddingCache.set(label, await getTextEmbedding(SALIENCE_LABELS[label], device))
  }
}

export function normalizeVector(vec: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) + 1e-9
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
  return out
}

async function getVisionEncoder(device: InferenceDevice): Promise<[any, any]> {
  if (!visionProcessorPromise)
    visionProcessorPromise = AutoProcessor.from_pretrained(CLIP_MODEL_ID)
  if (!visionModelPromise)
    visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { device })
  return Promise.all([visionProcessorPromise, visionModelPromise])
}

/** Encodes a capture data URL into a unit-norm 512-dim CLIP vision embedding. */
export async function getVisionEmbedding(dataUrl: string, device: InferenceDevice): Promise<Float32Array> {
  const [processor, model] = await getVisionEncoder(device)
  const image = await RawImage.fromURL(dataUrl)
  const { pixel_values } = await processor(image)
  const { image_embeds } = await model({ pixel_values })
  return normalizeVector(image_embeds.data as Float32Array)
}

export function calculateCosineSimilarity(vecA: Float32Array, vecB: Float32Array): number {
  if (vecA.length !== vecB.length)
    throw new Error(`Dimension mismatch: ${vecA.length} vs ${vecB.length}`)
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

export function calculateCosineDistance(vecA: Float32Array, vecB: Float32Array): number {
  return 1 - calculateCosineSimilarity(vecA, vecB)
}

/** Unit-norm mean of a set of embeddings (rolling context centroid). */
export function centroidOf(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0)
    throw new Error('centroidOf() requires at least one embedding')
  const dims = embeddings[0].length
  const acc = new Float32Array(dims)
  for (const emb of embeddings) {
    if (emb.length !== dims)
      throw new Error(`Dimension mismatch in centroid: ${emb.length} vs ${dims}`)
    for (let i = 0; i < dims; i++) acc[i] += emb[i]
  }
  for (let i = 0; i < dims; i++) acc[i] /= embeddings.length
  return normalizeVector(acc)
}

export interface ZeroShotResult {
  scores: Record<SalienceLabel, number>
  topLabel: SalienceLabel
  errorMargin: number
}

async function getTextEmbedding(prompt: string, device: InferenceDevice): Promise<Float32Array> {
  if (!tokenizerPromise)
    tokenizerPromise = AutoTokenizer.from_pretrained(CLIP_MODEL_ID)
  if (!textModelPromise)
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, { device })
  const [tokenizer, textModel] = await Promise.all([tokenizerPromise, textModelPromise])
  const inputs = await tokenizer(prompt)
  const { text_embeds } = await textModel(inputs)
  return normalizeVector(text_embeds.data as Float32Array)
}

/** Zero-shot classification of a frame embedding against the salience labels. */
export async function classifyZeroShot(imageEmbedding: Float32Array, device: InferenceDevice): Promise<ZeroShotResult> {
  const labels = Object.keys(SALIENCE_LABELS) as SalienceLabel[]
  const scores = {} as Record<SalienceLabel, number>
  for (const label of labels) {
    if (!textEmbeddingCache.has(label))
      textEmbeddingCache.set(label, await getTextEmbedding(SALIENCE_LABELS[label], device))
    scores[label] = calculateCosineSimilarity(imageEmbedding, textEmbeddingCache.get(label)!)
  }
  let topLabel = labels[0]
  for (const label of labels) {
    if (scores[label] > scores[topLabel])
      topLabel = label
  }
  const routineBest = Math.max(...labels.filter(l => l !== 'terminal_error').map(l => scores[l]))
  return { scores, topLabel, errorMargin: scores.terminal_error - routineBest }
}

export async function disposeVisionEncoder(): Promise<void> {
  if (visionModelPromise) {
    const model = await visionModelPromise
    await model.dispose?.()
    visionModelPromise = null
  }
  visionProcessorPromise = null
}

export async function disposeTextEncoder(): Promise<void> {
  if (textModelPromise) {
    const model = await textModelPromise
    await model.dispose?.()
    textModelPromise = null
  }
  tokenizerPromise = null
  textEmbeddingCache.clear()
}
