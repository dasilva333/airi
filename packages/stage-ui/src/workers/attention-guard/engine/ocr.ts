/**
 * Attention Ecology Guard — Stage 2 localized OCR text evidence
 * (tesseract.js WASM). Ported from the cleanroom harness engine
 * (`stage2-ocr.ts`). In-app, the delta-region crop is handed over as an
 * `ImageData` built by the worker from the decoded capture buffer.
 */

import type { Worker } from 'tesseract.js'

import { createWorker } from 'tesseract.js'

/** Distinct system error patterns (failures, exceptions, tracebacks). */
export const DEFAULT_ERROR_PATTERNS: RegExp[] = [
  /command not found/i,
  /invalid option/i,
  /usage:/i,
  /\berror(s)?\b/i,
  /\bfailed\b/i,
  /traceback/i,
  /permission denied/i,
  /syntaxerror/i,
  /typeerror/i,
  /fatal:/i,
  /exception/i,
  /unhandled/i,
  /panic:/i,
]

export const OCR_ERROR_PATTERN_MIN = 2
export const OCR_INTEREST_KEYWORD_MIN = 1

let workerPromise: Promise<Worker> | null = null

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1)
  }
  return workerPromise
}

export async function disposeOcrEngine(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}

/** OCR of a delta-region crop (ImageData). Returns raw text + wall-clock ms. */
export async function ocrImageData(imageData: ImageData): Promise<{ text: string, ocrMs: number }> {
  const started = performance.now()
  if (!imageData || imageData.width <= 0 || imageData.height <= 0) {
    return { text: '', ocrMs: 0 }
  }

  try {
    const worker = await getWorker()

    let targetInput: any = imageData
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(imageData.width, imageData.height)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.putImageData(imageData, 0, 0)
        const blob = await canvas.convertToBlob({ type: 'image/png' })
        targetInput = await blob.arrayBuffer()
      }
    }

    const { data: { text } } = await worker.recognize(targetInput)
    return { text: text || '', ocrMs: performance.now() - started }
  }
  catch (err) {
    console.warn('[Attention Guard OCR] OCR failed on delta crop:', err)
    return { text: '', ocrMs: performance.now() - started }
  }
}

/** Matches distinct regex patterns against text. */
export function matchPatterns(text: string, patterns: RegExp[]): string[] {
  const matched: string[] = []
  for (const pattern of patterns) {
    if (pattern.test(text))
      matched.push(pattern.source)
  }
  return matched
}

/** Matches user interest tags against text. */
export function matchInterestTags(text: string, tags: string[] = []): string[] {
  const matched: string[] = []
  if (!text || !tags || tags.length === 0)
    return matched

  const lowerText = text.toLowerCase()
  for (const tag of tags) {
    if (!tag)
      continue
    const trimmed = tag.trim()
    if (!trimmed)
      continue

    // 1. Direct case-insensitive substring match
    if (lowerText.includes(trimmed.toLowerCase())) {
      matched.push(trimmed)
      continue
    }

    // 2. Normalized underscore/hyphen/space match (e.g. "chat_window" matches "chat window")
    const normalizedTag = trimmed.toLowerCase().replace(/[_-]/g, ' ')
    const normalizedText = lowerText.replace(/[_-]/g, ' ')
    if (normalizedText.includes(normalizedTag)) {
      matched.push(trimmed)
      continue
    }

    // 3. Regex word boundary match
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/[_-]/g, '[ _-]')
    try {
      const regex = new RegExp(`\\b${pattern}\\b`, 'i')
      if (regex.test(text)) {
        matched.push(trimmed)
      }
    }
    catch {}
  }
  return matched
}

/** Distinct matched error patterns in OCR text (legacy helper). */
export function countErrorPatterns(text: string): string[] {
  return matchPatterns(text, DEFAULT_ERROR_PATTERNS)
}

/** Compact presentation-clean snippet for the [Visual Event] block. */
export function extractRelevantSnippet(text: string, matchedPatterns: string[] = [], matchedTags: string[] = []): string {
  const allPatterns = [
    ...matchedPatterns.map(src => new RegExp(src, 'i')),
    ...matchedTags.map(tag => new RegExp(`\\b${tag.replace(/[_-]/g, '[ _-]')}\\b`, 'i')),
  ]

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0)
    return ''

  if (allPatterns.length === 0)
    return lines[0]?.slice(0, 120) || ''

  const matchedLines = lines.filter(line => allPatterns.some(p => p.test(line)))
  if (matchedLines.length === 0)
    return lines[0]?.slice(0, 120) || ''

  const preferred = matchedLines.filter(l => !/command not found/i.test(l))
  const chosen = preferred.length > 0 ? preferred[0] : matchedLines[0]
  return chosen.replace(/\s+/g, ' ').replace(/[—–−]/g, '--').trim()
}

/** Backward-compatibility alias. */
export const extractErrorSnippet = extractRelevantSnippet
