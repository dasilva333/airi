import type {
  SalienceEvaluation,
  SalienceLabel,
  SalienceThresholds,
  ZeroShotResult,
} from './types.js'

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

/**
 * Returns distinct pattern representations that matched in the target text.
 */
export function matchPatterns(text: string, patterns: RegExp[] = DEFAULT_ERROR_PATTERNS): string[] {
  const matches: string[] = []
  if (!text) {
    return matches
  }

  for (const pat of patterns) {
    if (pat.test(text)) {
      matches.push(pat.source)
    }
  }

  return matches
}

/**
 * Matches interest tags against text using substring, normalized space, and word boundary checks.
 */
export function matchInterestTags(text: string, tags: string[] = []): string[] {
  const matched: string[] = []
  if (!text || !tags || tags.length === 0) {
    return matched
  }

  const lowerText = text.toLowerCase()
  const normalizedText = lowerText.replace(/[_-]/g, ' ')

  for (const tag of tags) {
    if (!tag)
      continue
    const trimmed = tag.trim()
    if (!trimmed)
      continue

    const lowerTag = trimmed.toLowerCase()
    const normalizedTag = lowerTag.replace(/[_-]/g, ' ')

    // 1. Direct substring
    if (lowerText.includes(lowerTag) || normalizedText.includes(normalizedTag)) {
      matched.push(trimmed)
      continue
    }

    // 2. Word boundary match
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/[_-]/g, '[ _-]')
    try {
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(text)) {
        matched.push(trimmed)
      }
    }
    catch {}
  }

  return matched
}

/**
 * Extracts a concise, presentation-clean snippet from OCR text focusing around matched error lines or interest keywords.
 */
export function extractRelevantSnippet(
  text: string,
  matchedPatterns: string[] = [],
  matchedTags: string[] = [],
  maxLen = 160,
): string {
  if (!text) {
    return ''
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (!lines.length) {
    return ''
  }

  const compiled: RegExp[] = []
  for (const p of matchedPatterns) {
    try { compiled.push(new RegExp(p, 'i')) }
    catch {}
  }
  for (const t of matchedTags) {
    try { compiled.push(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')) }
    catch {}
  }

  // Find the first line matching any error or tag pattern
  let focalLine = ''
  for (const line of lines) {
    if (compiled.some(re => re.test(line))) {
      focalLine = line
      break
    }
  }

  if (!focalLine) {
    focalLine = lines[0]
  }

  // Clean and truncate
  const cleaned = focalLine.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLen) {
    return cleaned
  }

  return `${cleaned.slice(0, maxLen - 3)}...`
}

export interface SalienceInput {
  frameId: string
  novelty: number
  ocrText: string
  errorPatterns?: string[]
  interestKeywords?: string[]
  zeroShot?: ZeroShotResult
  redAlertRatio?: number
  thresholds?: SalienceThresholds
}

/**
 * Deterministic salience promotion gate evaluating error cascades, interest keywords, and visual novelty.
 */
export function evaluateSalience(input: SalienceInput): SalienceEvaluation {
  const {
    frameId,
    novelty,
    ocrText,
    errorPatterns = matchPatterns(ocrText),
    interestKeywords = [],
    zeroShot = { scores: {}, topLabel: 'code_editor', errorMargin: 0 },
    redAlertRatio = 0,
    thresholds = {},
  } = input

  const errorMin = thresholds.ocrErrorPatternsMin ?? OCR_ERROR_PATTERN_MIN
  const interestMin = thresholds.interestKeywordsMin ?? OCR_INTEREST_KEYWORD_MIN

  const errorPatternHits = errorPatterns.length
  const interestKeywordHits = interestKeywords.length

  const isErrorCascade = errorPatternHits >= errorMin
  const isInterestMatch = interestKeywordHits >= interestMin

  if (isErrorCascade || isInterestMatch) {
    const reason = isErrorCascade
      ? `OCR error evidence: ${errorPatternHits} distinct pattern(s) [${errorPatterns.join(', ')}] >= ${errorMin}`
      : `Semantic project interest match: [${interestKeywords.join(', ')}]`

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
          ocrErrorPatternHits: errorPatternHits,
          ocrErrorPatterns: errorPatterns,
          interestKeywordHits,
          interestKeywords,
          ocrSnippet: extractRelevantSnippet(ocrText, errorPatterns, interestKeywords),
          errorMargin: zeroShot.errorMargin,
          redAlertRatio,
          zeroShotScores: zeroShot.scores,
        },
        reason,
      },
    }
  }

  if (errorPatternHits === 1) {
    return {
      decision: 'NOTE',
      reason: `minor error evidence (1 pattern: ${errorPatterns[0]}) below promotion floor ${errorMin}; monitoring in diary`,
    }
  }

  return {
    decision: 'NOTE',
    reason: 'routine event (no error cascade or interest keywords); writing to diary buffer only',
  }
}

/**
 * Rate limiter managing unsolicited promotions per rolling hour and hysteresis cooldown.
 */
export class AttentionPromotionLimiter {
  private promotionTimestamps: number[] = []
  private lastPromotionAt = 0

  constructor(
    public readonly maxPerHour = 3,
    public readonly hysteresisCooldownMs = 60_000,
  ) {}

  public isPromotionAllowed(now = Date.now()): boolean {
    if (now - this.lastPromotionAt < this.hysteresisCooldownMs) {
      return false
    }

    const windowStart = now - 60 * 60 * 1000
    this.promotionTimestamps = this.promotionTimestamps.filter(t => t >= windowStart)
    return this.promotionTimestamps.length < this.maxPerHour
  }

  public recordPromotion(now = Date.now()): void {
    this.lastPromotionAt = now
    this.promotionTimestamps.push(now)
  }

  public reset(): void {
    this.promotionTimestamps = []
    this.lastPromotionAt = 0
  }

  public get countInWindow(): number {
    const windowStart = Date.now() - 60 * 60 * 1000
    return this.promotionTimestamps.filter(t => t >= windowStart).length
  }
}
