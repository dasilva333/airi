/**
 * Stage 2 — Localized OCR Text Evidence (tesseract.js WASM).
 *
 * Resolves KNOWN-LIMIT L1 (Phase 1): global/crop CLIP embeddings could not
 * separate the terminal error event (04) from routine terminal use (03),
 * because small-region semantics drown in global signals. The proposal's
 * own §3 answer is OCR text extraction feeding heuristic promotion rules.
 *
 * Pipeline: full-res grayscale abs-diff between consecutive ticks ->
 * delta bounding box (WHAT changed, WHERE) -> tesseract.js WASM OCR of the
 * cropped region -> error-pattern counter.
 *
 * 100% browser-native: tesseract.js is a WebAssembly port of Tesseract and
 * runs identically in the browser, the Electron renderer, and this Node
 * harness. No Python sidecars, no external servers.
 *
 * Empirically validated on the seeded frames (Phase-2 bench): the 03->04
 * delta crop reads "command not found", "invalid option", and "usage:"
 * verbatim at full resolution with zero preprocessing (~1.6-2.4s CPU).
 */

import type { Worker } from 'tesseract.js'

import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { createWorker } from 'tesseract.js'

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TESSDATA_CACHE = path.join(HARNESS_ROOT, '.cache', 'tessdata')
// NOTICE: tesseract.js v7's writeCache silently swallows errors when the
// cachePath directory does not exist, forcing a re-download every run.
// Create it up front so the first run persists eng.traineddata for offline
// subsequent runs (proposal §11 offline/heuristics philosophy).
fs.mkdirSync(TESSDATA_CACHE, { recursive: true })

const DELTA_PIXEL_THRESHOLD = 24 // abs-diff (0-255) above which a pixel "changed"
const DELTA_PROJECTION_RATIO = 0.004 // row/col fraction of marked pixels to count as a change line
const BBOX_PAD = 40

/**
 * Distinct error patterns (lowercased for matching). Multi-word patterns are
 *  matched as substrings; single words use word boundaries to avoid
 *  "terror"/"failedless" false positives.
 *
 *  NOTICE: the single-word patterns (`error`, `failed`) are high-recall /
 *  low-precision by design. On the seeded dataset they produce a single hit
 *  in the 05a/05b browser frames (a YouTube UI string containing "error"),
 *  which stays below the >=2 promotion floor and therefore never promotes —
 *  precision is enforced by the gate, not the pattern list (proposal §12).
 */
const ERROR_PATTERNS: RegExp[] = [
  /command not found/i,
  /invalid option/i,
  /usage:/i,
  /\berror(s)?\b/i,
  /\bfailed\b/i,
  /traceback/i,
  /permission denied/i,
]

export interface DeltaBBox {
  left: number
  top: number
  width: number
  height: number
}

export interface OcrEvidence {
  /** Bounding box of the changed region in full-res pixel coordinates. */
  bbox: DeltaBBox | null
  /** Raw OCR text of the changed region. */
  text: string
  /** Distinct matched error patterns (the matched strings, e.g. "invalid option"). */
  errorPatterns: string[]
  /** Number of distinct error patterns matched. */
  errorPatternHits: number
  /** OCR wall-clock ms. */
  ocrMs: number
}

let workerPromise: Promise<Worker> | null = null

export async function getWorker(onProgress?: (m: any) => void): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      cachePath: TESSDATA_CACHE,
      cacheMethod: 'write',
      logger: typeof onProgress === 'function' ? onProgress : () => {},
    })
  }
  return workerPromise
}

export async function loadOcrEngine(onProgress?: (m: any) => void): Promise<Worker> {
  return getWorker(onProgress)
}

/** Releases the tesseract.js worker (worker thread). */
export async function disposeOcrEngine(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}

/**
 * Computes the bounding box of pixels that changed between two image files,
 * at full resolution. Uses grayscale abs-diff projection; ignores tiny
 * one-off pixel noise via a row/col projection ratio threshold.
 */
export async function computeDeltaBBox(fileA: string, fileB: string): Promise<DeltaBBox | null> {
  const [grayA, grayB] = await Promise.all([
    sharp(fileA).grayscale().raw().toBuffer({ resolveWithObject: true }),
    sharp(fileB).grayscale().raw().toBuffer({ resolveWithObject: true }),
  ])

  const { data: a, info: infoA } = grayA
  const { data: b, info: infoB } = grayB

  if (infoA.width !== infoB.width || infoA.height !== infoB.height) {
    return null
  }

  const width = infoA.width
  const height = infoA.height
  const rows = new Array(height).fill(0)
  const cols = new Array(width).fill(0)

  for (let y = 0; y < height; y++) {
    const rowBase = y * width
    for (let x = 0; x < width; x++) {
      if (Math.abs(a[rowBase + x] - b[rowBase + x]) > DELTA_PIXEL_THRESHOLD) {
        rows[y]++
        cols[x]++
      }
    }
  }

  const rowMin = height * DELTA_PROJECTION_RATIO
  const colMin = width * DELTA_PROJECTION_RATIO

  let top = -1
  let bottom = -1
  let left = -1
  let right = -1
  for (let y = 0; y < height; y++) {
    if (rows[y] > colMin) {
      if (top < 0)
        top = y
      bottom = y
    }
  }
  for (let x = 0; x < width; x++) {
    if (cols[x] > rowMin) {
      if (left < 0)
        left = x
      right = x
    }
  }

  if (top < 0)
    return null

  return {
    left: Math.max(0, left - BBOX_PAD),
    top: Math.max(0, top - BBOX_PAD),
    width: Math.min(width - 1, right + BBOX_PAD) - Math.max(0, left - BBOX_PAD) + 1,
    height: Math.min(height - 1, bottom + BBOX_PAD) - Math.max(0, top - BBOX_PAD) + 1,
  }
}

/** Extracts OCR text from a pixel region of an image via tesseract.js. */
export async function extractTextFromRegion(imagePath: string, bbox: DeltaBBox): Promise<{ text: string, ocrMs: number }> {
  const started = performance.now()
  const worker = await getWorker()
  const buffer = await sharp(imagePath)
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .png()
    .toBuffer()
  const { data: { text } } = await worker.recognize(buffer)
  return { text, ocrMs: performance.now() - started }
}

/** Counts distinct error patterns in OCR text. */
export function countErrorPatterns(text: string): string[] {
  const matched: string[] = []
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(pattern.source)
    }
  }
  return matched
}

/**
 * Extracts a compact, presentation-clean error snippet for the [Visual Event]
 * summary block (proposal §3 "OCR Text Snippet"). Returns the first matched
 * line that is NOT the generic "command not found" case when richer evidence
 * exists (e.g. 04's `df: invalid option -- y` rather than an earlier typo
 * line), collapsing whitespace and normalizing unicode dashes to `--`.
 */
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

  return chosen
    .replace(/\s+/g, ' ')
    .replace(/[—–−]/g, '--')
    .trim()
}

/** Composed pipeline: changed-region bbox -> OCR -> error-pattern count. */
export async function analyzeDeltaRegion(prevPath: string, currPath: string): Promise<OcrEvidence> {
  const bbox = await computeDeltaBBox(prevPath, currPath)

  if (!bbox) {
    return { bbox: null, text: '', errorPatterns: [], errorPatternHits: 0, ocrMs: 0 }
  }

  const { text, ocrMs } = await extractTextFromRegion(currPath, bbox)
  const errorPatterns = countErrorPatterns(text)

  return {
    bbox,
    text,
    errorPatterns,
    errorPatternHits: errorPatterns.length,
    ocrMs,
  }
}
