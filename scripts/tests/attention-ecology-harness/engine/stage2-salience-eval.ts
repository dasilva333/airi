/**
 * Stage 2 — Salience Promotion Gate.
 *
 * Phase-1 harness scope: heuristic salience judgment (proposal M1/M2 tier).
 * The RWKV-7 subconscious constrained-decoding judgment (proposal §4 Stage 2,
 * M3) is out of scope for this harness; this module stands in with an
 * explainable, deterministic gate so thresholds can be benchmarked now.
 *
 * Promotion is gated by LOCALIZED OCR TEXT EVIDENCE (see stage2-ocr.ts):
 * a frame promotes iff its changed region shows >= 2 distinct error
 * patterns. Rationale (measured in Phase 1, resolved in Phase 2):
 *
 *   - Zero-shot CLIP classification (text tower in the same 512-dim space as
 *     the frame embedding) could NOT detect the terminal error: the error
 *     margin stayed negative (~-0.04) because a few text lines drown in the
 *     global embedding. Retained here as a REPORTED diagnostic only.
 *   - Red-alert pixel ratio could NOT separate frame 04 from frame 03 (03
 *     already contains a red error marker). Retained as a reported diagnostic.
 *   - tesseract.js WASM OCR of the delta region reads the error text
 *     verbatim: frame 03 has 1 pattern ("command not found" — a lone typo,
 *     routine), frame 04 has 3 ("command not found", "invalid option",
 *     "usage:") — an error cascade, "caught in the act". The >=2 floor is
 *     deliberately conservative (proposal §12: false interruptions are worse
 *     than misses): a single error line never promotes.
 */

import type { OcrEvidence } from './stage2-ocr.js'

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
  /** Minimum distinct OCR error patterns in the changed region to promote. */
  ocrErrorPatternsMin: number
}

export interface PromotionPacket {
  type: 'PROMOTION_PACKET'
  frameId: string
  timestamp: string
  caption: SalienceLabel
  novelty: number
  signals: {
    ocrErrorPatternHits: number
    ocrErrorPatterns: string[]
    /** Untrusted screen text, truncated — see proposal §6 sanitization. */
    ocrSnippet: string
    errorMargin: number
    redAlertRatio: number
    zeroShotScores: Record<SalienceLabel, number>
  }
  /** Stage-3 [Visual Event] summary block (attached by the forwarder). */
  summary?: string
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
 * Deterministic promotion gate, precision-first (proposal §12). A frame
 * promotes iff OCR error evidence in its changed region clears the floor
 * (>= 2 distinct patterns); the first pattern alone is treated as a routine
 * typo and only bumped to the diary as monitoring evidence.
 */
export function evaluateSalience(
  frameId: string,
  novelty: number,
  ocr: OcrEvidence,
  zeroShot: ZeroShotResult,
  redAlertRatio: number,
  thresholds: SalienceThresholds,
): SalienceEvaluation {
  const hits = ocr.errorPatternHits
  const promote = hits >= thresholds.ocrErrorPatternsMin

  if (promote) {
    return {
      decision: 'PROMOTE',
      reason: `OCR error evidence: ${hits} distinct pattern(s) [${ocr.errorPatterns.join(', ')}] >= ${thresholds.ocrErrorPatternsMin}`,
      packet: {
        type: 'PROMOTION_PACKET',
        frameId,
        timestamp: new Date().toISOString(),
        caption: 'terminal_error',
        novelty,
        signals: {
          ocrErrorPatternHits: hits,
          ocrErrorPatterns: ocr.errorPatterns,
          ocrSnippet: ocr.text.replace(/\s+/g, ' ').trim().slice(0, 200),
          errorMargin: zeroShot.errorMargin,
          redAlertRatio,
          zeroShotScores: zeroShot.scores,
        },
        reason: 'terminal error cascade confirmed by localized OCR text evidence',
      },
    }
  }

  if (hits === 1) {
    return {
      decision: 'NOTE',
      reason: `minor error evidence (1 pattern: ${ocr.errorPatterns[0]}) below promotion floor ${thresholds.ocrErrorPatternsMin}; monitoring in diary`,
    }
  }

  return {
    decision: 'NOTE',
    reason: 'routine event (no OCR error evidence in changed region); writing to diary buffer only',
  }
}
