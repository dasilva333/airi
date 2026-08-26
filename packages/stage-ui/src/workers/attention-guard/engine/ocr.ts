/**
 * Attention Ecology Guard — Stage 2 localized OCR text evidence
 * (tesseract.js WASM). Ported from the cleanroom harness engine
 * (`stage2-ocr.ts`). In-app, the delta-region crop is handed over as an
 * `ImageData` built by the worker from the decoded capture buffer.
 */

import type { Worker } from 'tesseract.js'

import { createWorker } from 'tesseract.js'

/** Distinct error patterns (multi-word substring; single words word-boundary). */
const ERROR_PATTERNS: RegExp[] = [
  /antigravity/i,
  /open ide/i,
  /airi/i,
  /projects/i,
  /command not found/i,
  /invalid option/i,
  /usage:/i,
  /\berror(s)?\b/i,
  /\bfailed\b/i,
  /traceback/i,
  /permission denied/i,
]

export const OCR_ERROR_PATTERN_MIN = 2

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

/** Distinct matched error patterns in OCR text. */
export function countErrorPatterns(text: string): string[] {
  const matched: string[] = []
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(text))
      matched.push(pattern.source)
  }
  return matched
}

/** Compact presentation-clean error snippet for the [Visual Event] block. */
export function extractErrorSnippet(text: string, matchedPatterns: string[]): string {
  if (matchedPatterns.length === 0)
    return ''
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const patterns = matchedPatterns.map(src => new RegExp(src, 'i'))
  const matchedLines = lines.filter(line => patterns.some(p => p.test(line)))
  if (matchedLines.length === 0)
    return ''
  const preferred = matchedLines.filter(l => !/command not found/i.test(l))
  const chosen = preferred.length > 0 ? preferred[0] : matchedLines[0]
  return chosen.replace(/\s+/g, ' ').replace(/[—–−]/g, '--').trim()
}
