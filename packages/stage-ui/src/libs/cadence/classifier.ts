import type { System1Answer, System1Response } from '../providers/types'

export type CadenceRhythmCategory = 'rapid_burst' | 'conversational_beat' | 'thoughtful_pause'

export interface CadenceBubbleRange {
  start: number
  end: number
}

export interface CadenceBoundaryEvaluation {
  index: number
  before: string
  after: string
  score: number
  isSplit: boolean
  rhythmCategory?: CadenceRhythmCategory
  rhythmProbabilities?: Record<CadenceRhythmCategory, number>
  expectedBeatMs?: number
  /** Conversational pause only. Voiced delivery waits for audio, then this. */
  beatMs?: number
  calculatedDelayMs?: number
  /** Beat + full next-bubble typing estimate. Text-only delivery uses this. */
  textDelayMs?: number
}

export interface CadenceSplitResult {
  bubbles: string[]
  /** [start, end) offsets into the original input text, parallel to `bubbles`. */
  bubbleRanges: CadenceBubbleRange[]
  evaluations: CadenceBoundaryEvaluation[]
  /** Legacy alias: text-only delays (beat + full-bubble typing), kept for existing readers. */
  pausesMs: number[]
  /** Conversational beats per split transition, parallel to `pausesMs`. Voiced path uses these. */
  beatsMs: number[]
  /** Text-only delays per split transition (beat + full next-bubble typing). */
  textDelaysMs: number[]
  latencyMs?: number
}

export interface CadenceEvaluateOptions {
  splitThreshold?: number
  maxBubbles?: number
  dynamicPacing?: boolean
  rapidBurstMs?: number
  conversationalBeatMs?: number
  thoughtfulPauseMs?: number
  typingCadenceMsPerChar?: number
  minDelayMs?: number
  maxDelayCeilingMs?: number
  systemOneExecute: (
    state: string,
    questions: Record<string, any>,
  ) => Promise<System1Response | { answers?: Record<string, System1Answer> }>
}

interface LineRecord {
  /** Trimmed display text for Jev questions. */
  display: string
  /** Start offset of line content in the original text (excludes newline). */
  start: number
  /** End offset of line content in the original text (excludes newline). */
  end: number
}

function parseNonEmptyLines(rawText: string): { clean: string, records: LineRecord[] } {
  const clean = rawText.trim()
  const records: LineRecord[] = []
  let pos = 0
  const newline = /\r\n|\n|\r/g
  let match: RegExpExecArray | null

  const pushLine = (lineStart: number, lineEnd: number) => {
    const text = rawText.slice(lineStart, lineEnd)
    if (text.trim().length === 0)
      return
    records.push({ display: text.trim(), start: lineStart, end: lineEnd })
  }

  while ((match = newline.exec(rawText)) !== null) {
    pushLine(pos, match.index)
    pos = match.index + match[0].length
  }
  pushLine(pos, rawText.length)

  return { clean, records }
}

/**
 * Extracts candidate lines and evaluates newline boundaries with Jev System-1
 * to produce intelligently split chat bubbles with semantic cadence delay pacing.
 *
 * Source-range rule: bubbles slice the original input text via recorded
 * [start, end) offsets so repeated lines map by occurrence position, internal
 * whitespace/CRLF is preserved verbatim, and speech segments can attach by
 * source range instead of re-matching edited text.
 */
export async function evaluateCadenceSplits(
  rawText: string,
  options: CadenceEvaluateOptions,
): Promise<CadenceSplitResult> {
  const threshold = options.splitThreshold ?? 0.45
  const maxBubbles = Math.max(1, Math.min(10, options.maxBubbles ?? 4))
  const dynamicPacing = options.dynamicPacing !== false

  const rapidBurstMs = options.rapidBurstMs ?? 350
  const conversationalBeatMs = options.conversationalBeatMs ?? 900
  const thoughtfulPauseMs = options.thoughtfulPauseMs ?? 1800
  const typingCadenceMsPerChar = options.typingCadenceMsPerChar ?? 35
  const minDelayMs = options.minDelayMs ?? 350
  const maxDelayCeilingMs = options.maxDelayCeilingMs ?? 3500

  const emptyResult = (): CadenceSplitResult => ({
    bubbles: [],
    bubbleRanges: [],
    evaluations: [],
    pausesMs: [],
    beatsMs: [],
    textDelaysMs: [],
  })

  if (!rawText.trim()) {
    return emptyResult()
  }

  const { clean, records } = parseNonEmptyLines(rawText)

  // Single-bubble fast path: the bubble spans every non-empty line so the
  // slice invariant (bubbles[i] === rawText.slice(range)) holds here too.
  if (records.length <= 1 || maxBubbles <= 1) {
    const start = records[0].start
    const end = records[records.length - 1].end
    return {
      bubbles: [rawText.slice(start, end)],
      bubbleRanges: [{ start, end }],
      evaluations: [],
      pausesMs: [],
      beatsMs: [],
      textDelaysMs: [],
    }
  }

  // Evaluate all line boundaries across the full text
  const boundaryCount = records.length - 1
  const questions: Record<string, any> = {}

  for (let i = 0; i < boundaryCount; i++) {
    const before = records[i].display
    const after = records[i + 1].display

    // Noul split probability question (Approach 3 bidirectional anchor)
    questions[`b_${i}`] = {
      type: 'noul',
      instructions: `Would a casual texter hit send after "${before}" and start a new bubble at "${after}"?`,
    }

    // Optional choice rhythm tempo question (Option 2 contrastive buckets)
    if (dynamicPacing) {
      questions[`c_${i}`] = {
        type: 'choice',
        instructions: `What is the natural conversational pause after sending "${before}" before typing "${after}"?`,
        criteria: {
          rapid_burst: 'Immediate follow-up sent in quick succession (quick 300-500ms beat).',
          conversational_beat: 'Standard natural typing pause between distinct thoughts (800-1200ms beat).',
          thoughtful_pause: 'Longer pause to think, check something, or wrap up (1500-2500ms beat).',
        },
      }
    }
  }

  const startTime = Date.now()
  let response: System1Response | { answers?: Record<string, System1Answer> } = { answers: {} }

  try {
    response = await options.systemOneExecute(
      `You are splitting one outgoing text into casual chat bubbles.\nRules: Keep an unfinished lead-in line and any tightly coupled group of lines together in one bubble. Start a new bubble only on a clear shift to a separate conversational beat (like a new paragraph, topic shift, or sign-off).\n\nComplete text:\n"""\n${clean}\n"""`,
      questions,
    )
  }
  catch (err) {
    console.error('[Cadence] System 1 boundary evaluation failed:', err)
    const start = records[0].start
    const end = records[records.length - 1].end
    return {
      bubbles: [rawText.slice(start, end)],
      bubbleRanges: [{ start, end }],
      evaluations: [],
      pausesMs: [],
      beatsMs: [],
      textDelaysMs: [],
      latencyMs: Date.now() - startTime,
    }
  }

  const latencyMs = Date.now() - startTime

  // Pass 1: resolve split decisions and per-boundary beats (no typing yet —
  // typing needs the full assembled next bubble, known only after all splits).
  const isSplitAt: boolean[] = []
  const beatAt: (number | undefined)[] = []
  const evaluations: CadenceBoundaryEvaluation[] = []
  let splitCount = 0

  for (let i = 0; i < boundaryCount; i++) {
    const before = records[i].display
    const after = records[i + 1].display
    const score = response.answers?.[`b_${i}`]?.noul ?? 0.0
    const isSplit = score >= threshold && splitCount + 1 < maxBubbles
    if (isSplit)
      splitCount++
    isSplitAt.push(isSplit)

    let rhythmCategory: CadenceRhythmCategory | undefined
    let rhythmProbabilities: Record<CadenceRhythmCategory, number> | undefined
    let beatMs: number | undefined

    if (!dynamicPacing) {
      // Fixed-pacing fallback: no Jev rhythm signal, so every boundary uses
      // the configured conversational beat. This keeps beatsMs/textDelaysMs
      // populated with one value per split transition for delivery code.
      beatMs = conversationalBeatMs
    }
    else {
      const choiceAnswer = response.answers?.[`c_${i}`]
      rhythmCategory = (choiceAnswer?.choice as CadenceRhythmCategory) || 'conversational_beat'
      const probs = choiceAnswer?.probabilities as Record<CadenceRhythmCategory, number> | undefined

      if (probs) {
        rhythmProbabilities = probs
        beatMs = Math.round(
          rapidBurstMs * (probs.rapid_burst ?? 0)
          + conversationalBeatMs * (probs.conversational_beat ?? 0)
          + thoughtfulPauseMs * (probs.thoughtful_pause ?? 0),
        )
      }
      else {
        beatMs = rhythmCategory === 'rapid_burst'
          ? rapidBurstMs
          : rhythmCategory === 'thoughtful_pause'
            ? thoughtfulPauseMs
            : conversationalBeatMs
      }
    }

    beatAt.push(beatMs)
    evaluations.push({
      index: i,
      before,
      after,
      score,
      isSplit,
      rhythmCategory,
      rhythmProbabilities,
      expectedBeatMs: beatMs,
      beatMs,
    })
  }

  // Pass 2: assemble bubbles by slicing the original text (preserves
  // whitespace/CRLF verbatim; repeated lines map by occurrence position).
  const bubbles: string[] = []
  const bubbleRanges: CadenceBubbleRange[] = []
  let bubbleStartRecord = 0

  const flushBubble = (endRecord: number) => {
    const start = records[bubbleStartRecord].start
    const end = records[endRecord].end
    bubbles.push(rawText.slice(start, end))
    bubbleRanges.push({ start, end })
  }

  for (let i = 0; i < boundaryCount; i++) {
    if (isSplitAt[i]) {
      flushBubble(i)
      bubbleStartRecord = i + 1
    }
  }
  flushBubble(records.length - 1)

  // Pass 3: text-only delays use the complete next bubble length.
  const beatsMs: number[] = []
  const textDelaysMs: number[] = []
  const pausesMs: number[] = []
  let bubbleIdx = 0

  for (let i = 0; i < boundaryCount; i++) {
    const beatMs = beatAt[i]
    if (!isSplitAt[i] || beatMs === undefined)
      continue
    const nextBubble = bubbles[bubbleIdx + 1]
    const typingMs = Math.round(nextBubble.length * typingCadenceMsPerChar)
    const textDelayMs = Math.max(minDelayMs, Math.min(maxDelayCeilingMs, beatMs + typingMs))
    evaluations[i].calculatedDelayMs = textDelayMs
    evaluations[i].textDelayMs = textDelayMs
    beatsMs.push(beatMs)
    textDelaysMs.push(textDelayMs)
    pausesMs.push(textDelayMs)
    bubbleIdx++
  }

  return {
    bubbles,
    bubbleRanges,
    evaluations,
    pausesMs,
    beatsMs,
    textDelaysMs,
    latencyMs,
  }
}
