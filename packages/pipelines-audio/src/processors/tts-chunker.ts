import type { ReaderLike } from 'clustr'

import type { TextSegment, TextToken } from '../types'

import { readGraphemeClusters } from 'clustr'

import { createPushStream } from '../stream'

export const TTS_FLUSH_INSTRUCTION = '\u200B'
export const TTS_SPECIAL_TOKEN = '\u2063'

/**
 * A chunk without a letter, a digit, or an emoji, as a lone closing quote `”`, has no sound and is not a TTS request.
 * Emoji stay, because some providers read them.
 */
const regexpSound = /[\p{L}\p{N}\p{Extended_Pictographic}]/u
const hardPunctuations = new Set('.。?？!！…⋯～~\n\t\r')
const softPunctuations = new Set(',，、–—:：;；《》「」')

export interface TtsInputChunk {
  text: string
  words: number
  reason: 'boost' | 'limit' | 'hard' | 'flush' | 'special'
  /**
   * [start, end) JS-string offsets of the trimmed span in the literal-only
   * input stream. Sentinels (flush/special markers) contribute nothing, so
   * these index the same text the chat layer persists. Special chunks report
   * a point (start === end) at the boundary where the marker was consumed.
   */
  start: number
  end: number
}

export interface TtsInputChunkOptions {
  /**
   * Number of initial chunks eligible for fast-path yielding on soft punctuation.
   * Defaults to 1 (Slice 1 fast-path). Subsequent chunks yield only on hard punctuation or emergency limit.
   */
  boost?: number
  /**
   * Minimum number of words required before a soft punctuation can trigger a fast-path yield.
   * Prevents micro-chunks on single-word openings (e.g. "Oh," or "Well,"). Defaults to 4.
   */
  minimumWords?: number
  /**
   * Maximum number of words in a chunk before an emergency limit cut is triggered. Defaults to 40.
   */
  maximumWords?: number
  stripNarrative?: boolean
  keepNarrativeText?: boolean
}

export interface TtsChunkItem {
  chunk: string
  special: string | null
  reason: 'boost' | 'limit' | 'hard' | 'flush' | 'special'
  /** Source offsets, mirroring {@link TtsInputChunk.start/end}. */
  start: number
  end: number
}

export async function* chunkTtsInput(
  input: string | ReaderLike,
  options?: TtsInputChunkOptions,
): AsyncGenerator<TtsInputChunk, void, unknown> {
  const {
    boost = 1,
    minimumWords = 4,
    maximumWords = 40,
  } = options ?? {}

  const iterator = readGraphemeClusters(
    typeof input === 'string'
      ? new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(input))
            controller.close()
          },
        }).getReader()
      : input,
  )

  const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' }) // I love Intl.Segmenter

  let yieldCount = 0
  let buffer = ''
  let chunk = ''
  let chunkWordsCount = 0

  // Source-offset tracking (literal-only stream coordinates, UTF-16 units).
  // Every consumed non-sentinel grapheme advances consumedAdj by its raw
  // length (CRLF counts 2); sentinels contribute nothing so offsets index
  // the same text the chat layer persists. rawChunk/rawBuffer mirror the
  // pending normalized text grapheme-for-grapheme in raw form.
  let consumedAdj = 0
  let rawChunk = ''
  let rawBuffer = ''
  let spanStartAdj = 0

  const beginSpanIfEmpty = (appendedRawLen: number) => {
    if (rawChunk === '' && rawBuffer === '')
      spanStartAdj = consumedAdj - appendedRawLen
  }

  const spanOf = (rawSpan: string) => {
    const leading = (/^\s*/.exec(rawSpan)?.[0] ?? '').length
    const trailing = (/\s*$/.exec(rawSpan)?.[0] ?? '').length
    return { start: spanStartAdj + leading, end: spanStartAdj + rawSpan.length - trailing }
  }

  let previousValue: string | undefined
  let current = await iterator.next()

  while (!current.done) {
    let value = current.value

    // Raw contribution of this grapheme to the literal stream. The '…'
    // rewrite below consumes two extra dots; accounted for in that branch.
    const rawValue = current.value
    let iterRawText = (rawValue === TTS_FLUSH_INSTRUCTION || rawValue === TTS_SPECIAL_TOKEN) ? '' : rawValue
    consumedAdj += iterRawText.length

    // CRLF is one grapheme cluster. Use LF so Windows line endings match
    // the hard punctuation set and end the chunk.
    if (value === '\r\n')
      value = '\n'

    const flush = value === TTS_FLUSH_INSTRUCTION
    const special = value === TTS_SPECIAL_TOKEN
    const hard = hardPunctuations.has(value)
    const soft = softPunctuations.has(value)
    let next: IteratorResult<string, any> | undefined
    let afterNext: IteratorResult<string, any> | undefined

    if (flush || special || hard || soft) {
      if (special) {
        const precedingText = (chunk + buffer).trim()
        if (precedingText.length > 0) {
          const words = [...segmenter.segment(precedingText)].filter(w => w.isWordLike)
          const { start, end } = spanOf(rawChunk + rawBuffer)
          yield {
            text: precedingText,
            words: words.length,
            reason: 'limit',
            start,
            end,
          }
          yieldCount++
        }
        chunk = ''
        chunkWordsCount = 0
        buffer = ''
        rawChunk = ''
        rawBuffer = ''

        yield {
          text: '',
          words: 0,
          reason: 'special',
          start: consumedAdj,
          end: consumedAdj,
        }
        yieldCount++

        previousValue = value
        current = await iterator.next()
        continue
      }

      switch (value) {
        case '.':
        case ',': {
          if (previousValue !== undefined && /\d/.test(previousValue)) {
            next = await iterator.next()
            if (!next.done && next.value && /\d/.test(next.value)) {
              beginSpanIfEmpty(iterRawText.length)
              buffer += value
              rawBuffer += iterRawText
              current = next
              next = undefined
              continue
            }
          }
          else if (value === '.') {
            next = await iterator.next()
            if (!next.done && next.value && next.value === '.') {
              afterNext = await iterator.next()
              if (!afterNext.done && afterNext.value && afterNext.value === '.') {
                value = '…'
                // The rewrite consumes two extra dots beyond the current grapheme.
                iterRawText = '...'
                consumedAdj += 2
                next = undefined
                afterNext = undefined
              }
            }
          }
        }
      }

      if (buffer.length === 0) {
        previousValue = value
        current = await iterator.next()
        continue
      }

      const words = [...segmenter.segment(buffer)].filter(w => w.isWordLike)

      if (chunkWordsCount > minimumWords && chunkWordsCount + words.length > maximumWords) {
        // The punctuation ends the buffer, not the chunk before it, so it stays with the buffer. Adding a `？` here too
        // read it twice, as 方向、？ and then 移动？.
        const text = chunk.trim()
        if (regexpSound.test(text)) {
          const { start, end } = spanOf(rawChunk)
          yield {
            text,
            words: chunkWordsCount,
            reason: 'limit',
            start,
            end,
          }
          yieldCount++
        }
        // The buffer survives this yield, so its span continues right after it.
        spanStartAdj += rawChunk.length
        chunk = ''
        rawChunk = ''
        chunkWordsCount = 0
      }

      beginSpanIfEmpty(iterRawText.length)
      chunk += buffer + value
      rawChunk += rawBuffer + iterRawText
      chunkWordsCount += words.length
      buffer = ''
      rawBuffer = ''

      const shouldBoost = soft && yieldCount < boost && chunkWordsCount >= minimumWords
      if (flush || hard || chunkWordsCount > maximumWords || shouldBoost) {
        const text = chunk.trim()
        if (regexpSound.test(text)) {
          const { start, end } = spanOf(rawChunk)
          yield {
            text,
            words: chunkWordsCount,
            reason: flush ? 'flush' : hard ? 'hard' : chunkWordsCount > maximumWords ? 'limit' : 'boost',
            start,
            end,
          }
          yieldCount++
        }
        chunk = ''
        rawChunk = ''
        chunkWordsCount = 0
      }

      previousValue = value
      if (next !== undefined) {
        if (afterNext !== undefined) {
          current = afterNext
          next = undefined
          afterNext = undefined
        }
        else {
          current = next
          next = undefined
        }
      }
      else {
        current = await iterator.next()
      }
      continue
    }

    beginSpanIfEmpty(iterRawText.length)
    buffer += value
    rawBuffer += iterRawText
    previousValue = value
    next = await iterator.next()
    current = next
  }

  if (regexpSound.test(chunk + buffer)) {
    const text = (chunk + buffer).trim()
    const { start, end } = spanOf(rawChunk + rawBuffer)
    yield {
      text,
      words: chunkWordsCount + [...segmenter.segment(buffer)].filter(w => w.isWordLike).length,
      reason: 'flush',
      start,
      end,
    }
  }
}

export async function chunkEmitter(
  reader: ReaderLike,
  pendingSpecials: string[],
  options: TtsInputChunkOptions | undefined,
  handler: (ttsSegment: TtsChunkItem) => Promise<void> | void,
) {
  // Reuse a single Segmenter instance for the lifetime of this emitter call.
  const sanitizeSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' })

  const sanitizeChunk = (text: string) => {
    let cleanedText = text
      .replaceAll(TTS_SPECIAL_TOKEN, '')
      .replaceAll(TTS_FLUSH_INSTRUCTION, '')

    cleanedText = processNarrative(cleanedText, options)
    cleanedText = cleanedText.trim()

    // Drop chunks that carry no speakable words — e.g. a lone closing `"`,
    // a stray `...`, or a bare `:` left over after sentence-ending punctuation
    // flushes the buffer.  The chunker's hard-punc logic correctly splits text,
    // but punctuation-only remnants must be silently discarded here rather than
    // dispatched to the TTS API where they produce audible artifacts.
    if (cleanedText.length > 0) {
      const words = [...sanitizeSegmenter.segment(cleanedText)].filter(w => w.isWordLike)
      if (words.length === 0)
        return ''
    }

    return cleanedText
  }

  try {
    for await (const chunk of chunkTtsInput(reader, options)) {
      // TODO: remove later
      const cleanedText = sanitizeChunk(chunk.text)
      if (!cleanedText && chunk.reason !== 'special') {
        continue
      }

      if (chunk.reason === 'special') {
        const specialToken = pendingSpecials.shift()
        // console.debug("special yield:", specialToken)
        await handler({ chunk: cleanedText, special: specialToken ?? null, reason: chunk.reason, start: chunk.start, end: chunk.end })
      }
      else {
        await handler({ chunk: cleanedText, special: null, reason: chunk.reason, start: chunk.start, end: chunk.end })
      }
    }
  }
  catch (e) {
    console.error('Error chunking stream to TTS queue:', e)
  }
}

export function processNarrative(text: string, options?: TtsInputChunkOptions) {
  if (!options?.stripNarrative)
    return text

  const regex = /\*(.*?)\*|\[(.*?)\]|\((.*?)\)|（(.*?)）|【(.*?)】|<(.*?)>/g

  return text.replace(regex, (match, g1, g2, g3, g4, g5, g6) => {
    if (options?.keepNarrativeText) {
      const innerWord = g1 || g2 || g3 || g4 || g5 || g6 || ''
      return innerWord
    }
    return ''
  })
}

export function createTtsSegmentStream(
  tokens: ReadableStream<TextToken>,
  meta: { streamId: string, intentId: string },
  options?: TtsInputChunkOptions,
) {
  const { stream, write, close, error } = createPushStream<TextSegment>()
  const pendingSpecials: string[] = []
  const encoder = new TextEncoder()

  const { stream: byteStream, write: writeBytes, close: closeBytes, error: errorBytes } = createPushStream<Uint8Array>()

  void (async () => {
    const reader = tokens.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done)
          break
        if (!value)
          continue

        if (value.type === 'literal') {
          if (value.value)
            writeBytes(encoder.encode(value.value))
        }
        else if (value.type === 'special') {
          pendingSpecials.push(value.value ?? '')
          writeBytes(encoder.encode(TTS_SPECIAL_TOKEN))
        }
        else if (value.type === 'flush') {
          writeBytes(encoder.encode(TTS_FLUSH_INSTRUCTION))
        }
      }
      closeBytes()
    }
    catch (err) {
      errorBytes(err)
    }
    finally {
      reader.releaseLock()
    }
  })()

  void (async () => {
    try {
      const reader = byteStream.getReader()
      let currentActorId: string | undefined

      const parseActorId = (special: string | null) => {
        if (!special)
          return null
        const match = /<\|ACTOR:\s*([\w-]+)\s*(?:\|>|>)/i.exec(special)
        return match ? match[1].trim() : null
      }

      await chunkEmitter(reader, pendingSpecials, options, async (chunk) => {
        const actorId = parseActorId(chunk.special)
        if (actorId) {
          currentActorId = actorId
        }

        write({
          streamId: meta.streamId,
          intentId: meta.intentId,
          segmentId: `${meta.streamId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          text: chunk.chunk,
          special: chunk.special,
          reason: chunk.reason,
          actorId: currentActorId,
          sourceStart: chunk.start,
          sourceEnd: chunk.end,
          createdAt: Date.now(),
        })
      })
      close()
    }
    catch (err) {
      error(err)
    }
  })()

  return stream
}
