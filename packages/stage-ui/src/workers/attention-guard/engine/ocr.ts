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

export async function getWorker(): Promise<Worker> {
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

/** Upscale factor applied to small localized crops before OCR. */
const OCR_UPSCALE_FACTOR = 2
/** Crops whose largest edge is below this get upscaled (downscaled captures left glyphs at ~3-5px, below tesseract's floor). */
const OCR_UPSCALE_MIN_EDGE = 1200
/** Largest edge handed to tesseract. Full-frame/native crops are downscaled to this so OCR stays legible AND tractable. */
const OCR_MAX_INPUT_EDGE = 2560

/**
 * Grayscale + 1%/99% percentile contrast stretch so glyph edges are crisp.
 * Tesseract's own Otsu binarization works best on a full-range grayscale input;
 * hard-binarizing here would damage thin anti-aliased strokes instead.
 */
function stretchContrast(image: ImageData): ImageData {
  const data = image.data
  const total = image.width * image.height
  const histogram = new Uint32Array(256)

  for (let i = 0; i < total; i++) {
    const o = i * 4
    const luma = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) | 0
    data[o] = data[o + 1] = data[o + 2] = luma
    histogram[luma]++
  }

  let lo = 0
  let cumulative = 0
  for (let v = 0; v < 256; v++) {
    cumulative += histogram[v]
    if (cumulative >= total * 0.01) {
      lo = v
      break
    }
  }

  let hi = 255
  cumulative = 0
  for (let v = 255; v >= 0; v--) {
    cumulative += histogram[v]
    if (cumulative >= total * 0.01) {
      hi = v
      break
    }
  }

  const range = Math.max(1, hi - lo)
  const lut = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++)
    lut[v] = Math.round(Math.min(255, Math.max(0, (v - lo) * 255 / range)))

  for (let i = 0; i < total; i++) {
    const o = i * 4
    const mapped = lut[data[o]]
    data[o] = data[o + 1] = data[o + 2] = mapped
  }

  return image
}

/**
 * Pre-OCR conditioning for a delta-region crop.
 *
 * NOTICE: captures downscaled below native resolution shrink UI text to ~3-5px
 * glyphs, below tesseract's recognition floor, while a full-frame crop (a
 * window/app switch redraws the whole screen) can be multi-megapixel and slow.
 * Normalize the crop into tesseract's sweet spot:
 *   - oversized crop  -> downscale to `OCR_MAX_INPUT_EDGE`
 *   - small crop      -> 2x upscale (capped) so glyphs clear the floor
 *   - in-sweet-spot   -> keep 1x
 * then stretch contrast with smooth interpolation before `worker.recognize()`.
 */
async function prepareOcrInput(imageData: ImageData): Promise<ImageData | Blob> {
  if (typeof OffscreenCanvas === 'undefined')
    return imageData

  const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
  const srcCtx = srcCanvas.getContext('2d')
  if (!srcCtx)
    return imageData
  srcCtx.putImageData(imageData, 0, 0)

  const maxEdge = Math.max(imageData.width, imageData.height)
  let scale: number
  if (maxEdge > OCR_MAX_INPUT_EDGE) {
    // Full-frame / oversized crop: shrink to the tesseract sweet spot.
    scale = OCR_MAX_INPUT_EDGE / maxEdge
  }
  else if (maxEdge < OCR_UPSCALE_MIN_EDGE) {
    // Small localized crop: upscale so glyphs clear the recognition floor.
    scale = Math.min(OCR_UPSCALE_FACTOR, OCR_MAX_INPUT_EDGE / maxEdge)
  }
  else {
    scale = 1
  }

  const outWidth = Math.max(1, Math.round(imageData.width * scale))
  const outHeight = Math.max(1, Math.round(imageData.height * scale))
  const outCanvas = new OffscreenCanvas(outWidth, outHeight)
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx)
    return imageData

  outCtx.imageSmoothingEnabled = true
  try {
    ;(outCtx as any).imageSmoothingQuality = 'high'
  }
  catch {}
  outCtx.drawImage(srcCanvas, 0, 0, outWidth, outHeight)

  try {
    const conditioned = stretchContrast(outCtx.getImageData(0, 0, outWidth, outHeight))
    outCtx.putImageData(conditioned, 0, 0)
  }
  catch {}

  // Blob is a valid tesseract `ImageLike`; avoids an extra ArrayBuffer hop.
  return outCanvas.convertToBlob({ type: 'image/png' })
}

/** OCR of a delta-region crop (ImageData). Returns raw text + wall-clock ms. */
export async function ocrImageData(imageData: ImageData): Promise<{ text: string, ocrMs: number }> {
  const started = performance.now()
  if (!imageData || imageData.width <= 0 || imageData.height <= 0) {
    return { text: '', ocrMs: 0 }
  }

  try {
    const worker = await getWorker()
    const targetInput = await prepareOcrInput(imageData)
    // NOTICE: tesseract's `ImageLike` type omits `ImageData`, and the raw
    // ImageData fallback is only hit when OffscreenCanvas is unavailable.
    const { data: { text } } = await worker.recognize(targetInput as any)
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

/**
 * Edit-distance tolerance for fuzzy OCR matching, based on the tag's letter
 * count. Short tags get no tolerance (1 edit on a 4-letter word matches far
 * too many unrelated words); long tags survive more glyph misreads.
 */
function fuzzyDistanceFor(letterCount: number): number {
  if (letterCount >= 8)
    return 2
  if (letterCount >= 5)
    return 1
  return 0
}

/** Bounded Levenshtein distance; returns `maxDist + 1` as soon as it is exceeded. */
function boundedLevenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist)
    return maxDist + 1
  if (a === b)
    return 0

  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++)
    prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      )
      if (curr[j] < rowMin)
        rowMin = curr[j]
    }
    if (rowMin > maxDist) {
      return maxDist + 1
    }[prev, curr] = [curr, prev]
  }

  return prev[b.length]
}

/**
 * Fuzzy word-level match of a (possibly multi-word, space-normalized) tag
 * against OCR tokens, tolerating 1-2 character substitutions/deletions from
 * low-resolution glyph misreads (e.g. "Discleimers" -> "disclaimer",
 * "antigravty" -> "antigravity").
 */
function fuzzyPhraseMatch(tokens: string[], phrase: string): boolean {
  const clean = phrase.replace(/\s+/g, ' ').trim()
  const words = clean.split(' ').filter(Boolean)
  if (words.length === 0 || tokens.length === 0)
    return false

  const letters = clean.replace(/ /g, '')
  const maxDist = fuzzyDistanceFor(letters.length)
  if (maxDist === 0)
    return false

  // Also try a one-token-wider window so an OCR split/merge of the phrase
  // ("open ide" read as "o pen ide") still lands within edit distance.
  const maxSpan = Math.min(words.length + 1, tokens.length)
  for (let span = words.length; span <= maxSpan; span++) {
    for (let i = 0; i + span <= tokens.length; i++) {
      const candidate = tokens.slice(i, i + span).join(' ')
      if (Math.abs(candidate.length - clean.length) > maxDist)
        continue
      if (boundedLevenshtein(candidate, clean, maxDist) <= maxDist)
        return true
    }
  }
  return false
}

/** Matches user interest tags against text. */
export function matchInterestTags(text: string, tags: string[] = []): string[] {
  const matched: string[] = []
  if (!text || !tags || tags.length === 0)
    return matched

  const lowerText = text.toLowerCase()
  const normalizedText = lowerText.replace(/[_-]/g, ' ')
  const tokens = normalizedText.split(/[^a-z0-9]+/).filter(Boolean)

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
    if (normalizedText.includes(normalizedTag)) {
      matched.push(trimmed)
      continue
    }

    // 3. Regex word boundary match
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/[_-]/g, '[ _-]')
    let boundaryMatched = false
    try {
      boundaryMatched = new RegExp(`\\b${pattern}\\b`, 'i').test(text)
    }
    catch {}
    if (boundaryMatched) {
      matched.push(trimmed)
      continue
    }

    // 4. Fuzzy edit-distance match for OCR glyph misreads on small text
    if (fuzzyPhraseMatch(tokens, normalizedTag)) {
      matched.push(trimmed)
    }
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
