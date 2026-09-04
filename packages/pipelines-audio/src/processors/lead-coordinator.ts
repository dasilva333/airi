import type { TextSegment } from '../types'

export interface LeadCoordinatorOptions {
  /**
   * Function returning the remaining audio buffer lead in seconds:
   * (scheduledEndTime - audioContext.currentTime).
   * If undefined, lead-based flushing is disabled and batching flushes on maxBatchSentences or stream completion.
   */
  getBufferLead?: () => number
  /**
   * Buffer lead threshold in seconds below which pending sentences will flush early to prevent starvation.
   * Default: 1.5s
   */
  leadThresholdSec?: number
  /**
   * Maximum number of sentences to accumulate in a single batch.
   * Default: 3
   */
  maxBatchSentences?: number
  /**
   * Maximum number of words across pending sentences before forcing a flush.
   * Default: 45
   */
  maxBatchWords?: number
  /**
   * Interval in milliseconds to re-check buffer lead while waiting for upstream tokens.
   * Default: 150ms
   */
  checkIntervalMs?: number
}

/**
 * CJK-aware sentence concatenation. Inserts space between Latin sentences,
 * but omits space after CJK punctuation or characters.
 */
export function joinSentences(sentences: string[]): string {
  return sentences.reduce((acc, curr) => {
    const trimmedCurr = curr.trim()
    if (!acc)
      return trimmedCurr
    if (!trimmedCurr)
      return acc
    const lastChar = acc[acc.length - 1]
    if (/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\u3000-\u303F]/.test(lastChar)) {
      return acc + trimmedCurr
    }
    return `${acc} ${trimmedCurr}`
  }, '')
}

/**
 * Counts total words across an array of TextSegments.
 */
function countSegmentWords(segments: TextSegment[]): number {
  let count = 0
  for (const seg of segments) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean)
    count += words.length
  }
  return count
}

/**
 * Creates a ReadableStream transform that coordinates segment emission using Option C Lead Coordination:
 * - Slice 1 is emitted immediately for minimum TTFA.
 * - Slices 2+ are accumulated in pendingSentences.
 * - Batches are flushed when buffer lead is low (< 1.5s), batch size cap is reached (3 sentences / 45 words),
 *   an actor/special token arrives, or the stream ends.
 */
export function createLeadCoordinatorStream(
  source: ReadableStream<TextSegment>,
  options: LeadCoordinatorOptions = {},
): ReadableStream<TextSegment> {
  const getBufferLead = options.getBufferLead
  const leadThresholdSec = options.leadThresholdSec ?? 1.5
  const maxBatchSentences = options.maxBatchSentences ?? 3
  const maxBatchWords = options.maxBatchWords ?? 45
  const checkIntervalMs = options.checkIntervalMs ?? 150

  let yieldCount = 0
  let pendingSentences: TextSegment[] = []
  let reader: ReadableStreamDefaultReader<TextSegment> | null = null

  function isLeadLow(): boolean {
    if (!getBufferLead)
      return false
    const lead = getBufferLead()
    // Lead is low only if lead is valid, non-negative, and below the threshold
    return lead >= 0 && lead < leadThresholdSec
  }

  return new ReadableStream<TextSegment>({
    start() {
      reader = source.getReader()
    },
    async pull(controller) {
      if (!reader)
        return

      function flushPending() {
        if (pendingSentences.length === 0)
          return

        if (pendingSentences.length === 1) {
          const seg = pendingSentences[0]
          controller.enqueue({
            ...seg,
            subSentences: seg.subSentences ?? [seg.text],
          })
        }
        else {
          const subSentences = pendingSentences.map(s => s.text)
          const mergedText = joinSentences(subSentences)
          const first = pendingSentences[0]
          controller.enqueue({
            streamId: first.streamId,
            intentId: first.intentId,
            segmentId: first.segmentId,
            text: mergedText,
            special: null,
            reason: 'hard',
            actorId: first.actorId,
            subSentences,
            createdAt: Date.now(),
          })
        }

        pendingSentences = []
        yieldCount++
      }

      while (true) {
        // If we have accumulated sentences and buffer lead is running dry, flush immediately
        if (pendingSentences.length > 0 && isLeadLow()) {
          flushPending()
          return
        }

        let readResult: ReadableStreamReadResult<TextSegment>

        if (pendingSentences.length > 0 && getBufferLead) {
          let timer: any
          const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
            timer = setTimeout(() => resolve({ timeout: true }), checkIntervalMs)
          })

          const raceResult = await Promise.race([
            reader.read().then(r => ({ timeout: false as const, result: r })),
            timeoutPromise,
          ])

          clearTimeout(timer)

          if (!('result' in raceResult)) {
            if (isLeadLow()) {
              flushPending()
              return
            }
            continue
          }

          readResult = raceResult.result
        }
        else {
          readResult = await reader.read()
        }

        if (readResult.done) {
          if (pendingSentences.length > 0) {
            flushPending()
          }
          controller.close()
          return
        }

        const segment = readResult.value
        if (!segment)
          continue

        // Special token or Actor change: must flush pending batch first
        if (segment.special || (pendingSentences.length > 0 && segment.actorId !== pendingSentences[0].actorId)) {
          if (pendingSentences.length > 0) {
            flushPending()
          }
          controller.enqueue(segment)
          yieldCount++
          return
        }

        // Fast-path for Slice 1: yield immediately
        if (yieldCount === 0 && pendingSentences.length === 0) {
          controller.enqueue({
            ...segment,
            subSentences: [segment.text],
          })
          yieldCount++
          return
        }

        // Slices 2+: buffer in pendingSentences
        pendingSentences.push(segment)

        const totalWords = countSegmentWords(pendingSentences)

        if (
          pendingSentences.length >= maxBatchSentences
          || totalWords >= maxBatchWords
          || isLeadLow()
        ) {
          flushPending()
          return
        }
      }
    },
    async cancel(reason) {
      if (reader) {
        await reader.cancel(reason)
      }
    },
  })
}
