/**
 * Stage 2 — Salience Promotion Gate.
 *
 * Evaluates visual and text evidence across:
 * 1. System Error Cascades (>= 2 distinct error patterns)
 * 2. Semantic Project / Tool Interest Keywords (antigravity, airi, projects, etc.)
 * 3. Zero-shot CLIP classifications and luminance red alert ratios.
 */

import type { ProgressCallback } from './stage1-vision-embed.js'
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
  /** Minimum distinct OCR error patterns in the changed region to promote. Default: 2 */
  ocrErrorPatternsMin?: number
  /** Minimum distinct semantic interest keywords in the changed region to promote. Default: 1 */
  interestKeywordsMin?: number
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
    interestKeywordHits: number
    interestKeywords: string[]
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

export async function loadTextEncoder(onLog?: (msg: string) => void, onProgress?: ProgressCallback): Promise<[any, any]> {
  if (!tokenizerPromise) {
    onLog?.(`Loading CLIP tokenizer (${CLIP_MODEL_ID})...`)
    tokenizerPromise = AutoTokenizer.from_pretrained(CLIP_MODEL_ID, { progress_callback: onProgress })
  }
  if (!textModelPromise) {
    onLog?.(`Loading CLIP text model (${CLIP_MODEL_ID})...`)
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID, { progress_callback: onProgress })
  }
  return Promise.all([tokenizerPromise, textModelPromise])
}

/** Releases the text-tower ONNX session. */
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
  const [tokenizer, textModel] = await loadTextEncoder(onLog)
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
 * Deterministic promotion gate evaluating both error cascades and project interest keywords.
 */
export function evaluateSalience(
  frameId: string,
  novelty: number,
  ocr: OcrEvidence,
  zeroShot: ZeroShotResult,
  redAlertRatio: number,
  thresholds: SalienceThresholds = {},
): SalienceEvaluation {
  const errorMin = thresholds.ocrErrorPatternsMin ?? 2
  const interestMin = thresholds.interestKeywordsMin ?? 1

  const isErrorCascade = ocr.errorPatternHits >= errorMin
  const isInterestMatch = ocr.interestKeywordHits >= interestMin

  if (isErrorCascade || isInterestMatch) {
    const reason = isErrorCascade
      ? `OCR error evidence: ${ocr.errorPatternHits} distinct pattern(s) [${ocr.errorPatterns.join(', ')}] >= ${errorMin}`
      : `Semantic project interest match: [${ocr.interestKeywords.join(', ')}]`

    const caption: SalienceLabel = isErrorCascade ? 'terminal_error' : zeroShot.topLabel

    return {
      decision: 'PROMOTE',
      reason,
      packet: {
        type: 'PROMOTION_PACKET',
        frameId,
        timestamp: new Date().toISOString(),
        caption,
        novelty,
        signals: {
          ocrErrorPatternHits: ocr.errorPatternHits,
          ocrErrorPatterns: ocr.errorPatterns,
          interestKeywordHits: ocr.interestKeywordHits,
          interestKeywords: ocr.interestKeywords,
          ocrSnippet: ocr.text.replace(/\s+/g, ' ').trim().slice(0, 200),
          errorMargin: zeroShot.errorMargin,
          redAlertRatio,
          zeroShotScores: zeroShot.scores,
        },
        reason,
      },
    }
  }

  if (ocr.errorPatternHits === 1) {
    return {
      decision: 'NOTE',
      reason: `minor error evidence (1 pattern: ${ocr.errorPatterns[0]}) below promotion floor ${errorMin}; monitoring in diary`,
    }
  }

  return {
    decision: 'NOTE',
    reason: 'routine event (no error cascade or interest keywords); writing to diary buffer only',
  }
}
