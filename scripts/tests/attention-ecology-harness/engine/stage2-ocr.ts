/**
 * Stage 2 — Localized OCR Text Evidence (tesseract.js WASM).
 *
 * Extracts text from the changed screen region and matches against:
 * 1. System Error Patterns (e.g. "command not found", "invalid option", "traceback")
 * 2. Semantic Project / Interest Keywords (e.g. "antigravity", "airi", "open ide", "projects", "discord", "youtube")
 *
 * 100% browser-native: tesseract.js runs in WebAssembly with local caching.
 */

import type { Worker } from 'tesseract.js'

import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { createWorker } from 'tesseract.js'

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TESSDATA_CACHE = path.join(HARNESS_ROOT, '.cache', 'tessdata')
fs.mkdirSync(TESSDATA_CACHE, { recursive: true })

const DELTA_PIXEL_THRESHOLD = 24 // abs-diff (0-255) above which a pixel "changed"
const DELTA_PROJECTION_RATIO = 0.004 // row/col fraction of marked pixels to count as a change line
const BBOX_PAD = 40

/** System high-priority error patterns. */
export const DEFAULT_ERROR_PATTERNS: RegExp[] = [
  /command not found/i,
  /invalid option/i,
  /usage:/i,
  /\berror(s)?\b/i,
  /\bfailed\b/i,
  /traceback/i,
  /permission denied/i,
]

/** User & Character project/tool interest keywords. */
export const DEFAULT_INTEREST_KEYWORDS: RegExp[] = [
  /antigravity/i,
  /open ide/i,
  /airi/i,
  /projects/i,
  /github/i,
  /discord/i,
  /youtube/i,
  /blender/i,
  /unity/i,
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
  /** Matched system error patterns. */
  errorPatterns: string[]
  errorPatternHits: number
  /** Matched project/interest keywords. */
  interestKeywords: string[]
  interestKeywordHits: number
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

/** Releases the tesseract.js worker. */
export async function disposeOcrEngine(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise
    await worker.terminate()
    workerPromise = null
  }
}

/**
 * Computes the bounding box of pixels that changed between two image files,
 * at full resolution. Uses grayscale abs-diff projection.
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

/** Matches regex patterns against text and returns matched pattern sources. */
export function matchPatterns(text: string, patterns: RegExp[]): string[] {
  const matched: string[] = []
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      matched.push(pattern.source)
    }
  }
  return matched
}

/**
 * Extracts a compact snippet for the [Visual Event] summary block.
 */
export function extractRelevantSnippet(text: string, matchedPatterns: string[]): string {
  if (matchedPatterns.length === 0)
    return ''

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const patterns = matchedPatterns.map(src => new RegExp(src, 'i'))
  const matchedLines = lines.filter(line => patterns.some(p => p.test(line)))

  if (matchedLines.length === 0)
    return lines[0]?.slice(0, 120) || ''

  const preferred = matchedLines.filter(l => !/command not found/i.test(l))
  const chosen = preferred.length > 0 ? preferred[0] : matchedLines[0]

  return chosen
    .replace(/\s+/g, ' ')
    .replace(/[—–−]/g, '--')
    .trim()
}

/** Alias for backward-compatibility. */
export const extractErrorSnippet = extractRelevantSnippet

/** Composed pipeline: changed-region bbox -> OCR -> pattern matching. */
export async function analyzeDeltaRegion(
  prevPath: string,
  currPath: string,
  options?: {
    errorPatterns?: RegExp[]
    interestKeywords?: RegExp[]
  },
): Promise<OcrEvidence> {
  const bbox = await computeDeltaBBox(prevPath, currPath)

  if (!bbox) {
    return {
      bbox: null,
      text: '',
      errorPatterns: [],
      errorPatternHits: 0,
      interestKeywords: [],
      interestKeywordHits: 0,
      ocrMs: 0,
    }
  }

  const { text, ocrMs } = await extractTextFromRegion(currPath, bbox)
  const errPatterns = options?.errorPatterns ?? DEFAULT_ERROR_PATTERNS
  const kwPatterns = options?.interestKeywords ?? DEFAULT_INTEREST_KEYWORDS

  const errorPatterns = matchPatterns(text, errPatterns)
  const interestKeywords = matchPatterns(text, kwPatterns)

  return {
    bbox,
    text,
    errorPatterns,
    errorPatternHits: errorPatterns.length,
    interestKeywords,
    interestKeywordHits: interestKeywords.length,
    ocrMs,
  }
}
