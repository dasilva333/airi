/**
 * Stage 2 — Salience Promotion Gate.
 *
 * Phase-1 harness scope: heuristic salience judgment (proposal M1/M2 tier).
 * The RWKV-7 subconscious constrained-decoding judgment (proposal §4 Stage 2,
 * M3) is out of scope for this harness; this module stands in with an
 * explainable, deterministic gate so thresholds can be benchmarked now.
 *
 * Two independent evidence signals are combined (AND-gated, because proposal
 * §12 states false interruptions are worse than misses):
 *
 *   1. Zero-shot CLIP classification: the frame embedding is compared against
 *      text-prompt embeddings in the SAME shared 512-dim CLIP space (text
 *      tower pattern reused from flowmdm/clipEncoder.ts). The salience signal
 *      is the *margin* of the error label over the best routine label —
 *      absolute image-text cosine sims are poorly calibrated across domains.
 *   2. Red-alert pixel ratio: fraction of saturated-red pixels. Terminal
 *      error output ("caught in the act") is rendered in red on a dark
 *      background; this is a cheap, deterministic corroborating signal.
 *
 * NOTICE (Phase-1 measured finding): On the seeded dataset, NEITHER signal
 * detects the terminal error event (04): zero-shot error margin stays
 * negative (~-0.04, a few red text lines drown in the global embedding), and
 * the red-alert ratio cannot separate 04 from 03 because frame 03 already
 * contains a red error marker. CLIP-only salience is therefore documented as
 * INSUFFICIENT for small-region error events (KNOWN-LIMIT L1 in the eval
 * runner); the production fix is proposal §3's OCR/VLM textual feature
 * mapping, deliberately deferred past Phase 1 (user decision 2026-08-09).
 */

import sharp from 'sharp'

import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers'

import { calculateCosineSimilarity, CLIP_MODEL_ID, normalizeVector } from './stage1-vision-embed.js'

export const SALIENCE_LABELS = {
  terminal_error: 'a screenshot of a terminal window showing a red error message',
  terminal_normal: 'a screenshot of a terminal window running a shell command',
  code_editor: 'a screenshot of a code editor displaying source code',
  video_player: 'a screenshot of a video playing in a web browser',
} as const

export type SalienceLabel = keyof typeof SALIENCE_LABELS

export interface ZeroShotResult {
  /** Cosine similarity per label (unit-norm vectors). */
  scores: Record<SalienceLabel, number>
  topLabel: SalienceLabel
  /** sim(terminal_error) - max(sim of all routine labels). */
  errorMargin: number
}

export interface SalienceThresholds {
  /** Minimum zero-shot error margin required to consider an error event. */
  errorMarginMin: number
  /** Minimum saturated-red pixel ratio required to corroborate. */
  redAlertRatioMin: number
}

export interface PromotionPacket {
  type: 'PROMOTION_PACKET'
  frameId: string
  timestamp: string
  caption: SalienceLabel
  novelty: number
  signals: {
    errorMargin: number
    redAlertRatio: number
    zeroShotScores: Record<SalienceLabel, number>
  }
  reason: string
}

export type SalienceDecision = 'PROMOTE' | 'NOTE' | 'IGNORE'

export interface SalienceEvaluation {
  decision: SalienceDecision
  reason: string
  packet?: PromotionPacket
}

let tokenizerPromise: Promise<any> | null = null
let textModelPromise: Promise<any> | null = null
const textEmbeddingCache = new Map<SalienceLabel, Float32Array>()

/** Releases the text-tower ONNX session; see disposeVisionEncoder for why. */
export async function disposeTextEncoder(): Promise<void> {
  if (textModelPromise) {
    const model = await textModelPromise
    await model.dispose?.()
    textModelPromise = null
  }
  tokenizerPromise = null
  textEmbeddingCache.clear()
}

async function getTextEmbedding(prompt: string, onLog?: (msg: string) => void): Promise<Float32Array> {
  if (!tokenizerPromise) {
    onLog?.(`Loading CLIP tokenizer (${CLIP_MODEL_ID})...`)
    tokenizerPromise = AutoTokenizer.from_pretrained(CLIP_MODEL_ID)
  }
  if (!textModelPromise) {
    onLog?.(`Loading CLIP text model (${CLIP_MODEL_ID})...`)
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID)
  }

  const [tokenizer, textModel] = await Promise.all([tokenizerPromise, textModelPromise])
  const inputs = await tokenizer(prompt)
  const { text_embeds } = await textModel(inputs)
  return normalizeVector(text_embeds.data as Float32Array)
}

/**
 * Zero-shot classification of a frame embedding against the salience labels.
 * Label text embeddings are computed once and cached.
 */
export async function classifyZeroShot(imageEmbedding: Float32Array, onLog?: (msg: string) => void): Promise<ZeroShotResult> {
  const labels = Object.keys(SALIENCE_LABELS) as SalienceLabel[]
  const scores = {} as Record<SalienceLabel, number>

  for (const label of labels) {
    if (!textEmbeddingCache.has(label)) {
      textEmbeddingCache.set(label, await getTextEmbedding(SALIENCE_LABELS[label], onLog))
    }
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

/**
 * Fraction of saturated-red pixels (error-text red on dark backgrounds),
 * measured on a 512px-wide downscale for speed.
 */
export async function computeRedAlertRatio(imagePath: string): Promise<{ ratio: number, redPixels: number, totalPixels: number }> {
  const { data, info } = await sharp(imagePath)
    .removeAlpha()
    .resize(512, null, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true })

  let redPixels = 0
  const totalPixels = info.width * info.height
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (r >= 150 && g <= 90 && b <= 90) {
      redPixels++
    }
  }

  return { ratio: redPixels / totalPixels, redPixels, totalPixels }
}

/**
 * Deterministic promotion gate. Both evidence signals must clear their
 * floors (AND) for a PROMOTE; anything else is a quiet diary NOTE.
 */
export function evaluateSalience(
  frameId: string,
  novelty: number,
  zeroShot: ZeroShotResult,
  redAlertRatio: number,
  thresholds: SalienceThresholds,
): SalienceEvaluation {
  const errorEvidence = zeroShot.errorMargin >= thresholds.errorMarginMin
  const redEvidence = redAlertRatio >= thresholds.redAlertRatioMin

  if (errorEvidence && redEvidence) {
    return {
      decision: 'PROMOTE',
      reason: `error margin ${zeroShot.errorMargin.toFixed(4)} >= ${thresholds.errorMarginMin} AND red-alert ${(redAlertRatio * 100).toFixed(3)}% >= ${(thresholds.redAlertRatioMin * 100).toFixed(3)}%`,
      packet: {
        type: 'PROMOTION_PACKET',
        frameId,
        timestamp: new Date().toISOString(),
        caption: 'terminal_error',
        novelty,
        signals: {
          errorMargin: zeroShot.errorMargin,
          redAlertRatio,
          zeroShotScores: zeroShot.scores,
        },
        reason: 'terminal error salience corroborated by zero-shot margin and red-alert pixels',
      },
    }
  }

  return {
    decision: 'NOTE',
    reason: `routine event (error evidence: margin=${errorEvidence}, red=${redEvidence}); writing to diary buffer only`,
  }
}
