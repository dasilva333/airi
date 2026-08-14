import type { Eventa } from '@moeru/eventa'

import type { SpeechPipelineEventName } from './eventa'
import type {
  IntentHandle,
  IntentOptions,
  LoggerLike,
  PlaybackItem,
  SpeechPipelineEvents,
  TextSegment,
  TextToken,
  TtsRequest,
  TtsResult,
} from './types'

import { createContext } from '@moeru/eventa'

import { speechPipelineEventMap } from './eventa'
import { createPriorityResolver } from './priority'
import { createTtsSegmentStream } from './processors/tts-chunker'
import { createPushStream } from './stream'

export interface SpeechPipelineOptions<TAudio> {
  tts: (request: TtsRequest, signal: AbortSignal) => Promise<TAudio | null>
  /**
   * Optional streaming alternative to `tts`.
   *
   * Emits audio for one segment in pieces, calling `onAudio` as each becomes
   * available so playback can start before the whole segment is synthesized. When
   * supplied this replaces `tts` for text segments; `tts` still handles specials.
   */
  ttsStream?: (
    request: TtsRequest,
    signal: AbortSignal,
    onAudio: (audio: TAudio) => void,
  ) => Promise<void>
  /**
   * Joins streamed pieces that arrived while the previous one was playing.
   */
  concatAudio?: (pieces: TAudio[]) => TAudio
  playback: {
    schedule: (item: PlaybackItem<TAudio>) => void
    stopAll: (reason: string) => void
    stopByIntent: (intentId: string, reason: string) => void
    stopByOwner: (ownerId: string, reason: string) => void
    onStart: (listener: (event: { item: PlaybackItem<TAudio>, startedAt: number }) => void) => void
    onEnd: (listener: (event: { item: PlaybackItem<TAudio>, endedAt: number }) => void) => void
    onInterrupt: (listener: (event: { item: PlaybackItem<TAudio>, reason: string, interruptedAt: number }) => void) => void
    onReject: (listener: (event: { item: PlaybackItem<TAudio>, reason: string }) => void) => void
  }
  logger?: LoggerLike
  priority?: ReturnType<typeof createPriorityResolver>
  segmenter?: (tokens: ReadableStream<TextToken>, meta: { streamId: string, intentId: string }) => ReadableStream<TextSegment>
}

interface IntentState {
  intentId: string
  streamId: string
  priority: number
  ownerId?: string
  behavior: 'queue' | 'interrupt' | 'replace'
  createdAt: number
  controller: AbortController
  stream: ReadableStream<TextToken>
  closeStream: () => void
  canceled: boolean
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSpeechPipeline<TAudio>(options: SpeechPipelineOptions<TAudio>) {
  const logger = options.logger ?? console
  const priorityResolver = options.priority ?? createPriorityResolver()
  const segmenter = options.segmenter ?? createTtsSegmentStream
  const context = createContext()

  const intents = new Map<string, IntentState>()
  const pending: IntentState[] = []
  let activeIntent: IntentState | null = null

  // Resolvers for callers awaiting a specific playback item to finish. Registered
  // once because playback listeners cannot be unsubscribed; keyed by item id so a
  // single listener can serve every waiter.
  const playbackWaiters = new Map<string, () => void>()

  function settlePlaybackWaiter(id: string) {
    const resolve = playbackWaiters.get(id)
    if (resolve) {
      playbackWaiters.delete(id)
      resolve()
    }
  }

  function waitForPlayback(id: string): Promise<void> {
    return new Promise<void>(resolve => playbackWaiters.set(id, resolve))
  }

  options.playback.onStart(event => context.emit(speechPipelineEventMap.onPlaybackStart, event))
  options.playback.onEnd((event) => {
    settlePlaybackWaiter(event.item.id)
    context.emit(speechPipelineEventMap.onPlaybackEnd, event)
  })
  options.playback.onInterrupt((event) => {
    settlePlaybackWaiter(event.item.id)
    context.emit(speechPipelineEventMap.onPlaybackInterrupt, event)
  })
  options.playback.onReject((event) => {
    settlePlaybackWaiter(event.item.id)
    context.emit(speechPipelineEventMap.onPlaybackReject, event)
  })

  function enqueueIntent(intent: IntentState) {
    pending.push(intent)
  }

  function pickNextIntent() {
    if (pending.length === 0)
      return null
    pending.sort((a, b) => (b.priority - a.priority) || (a.createdAt - b.createdAt))
    return pending.shift() ?? null
  }

  async function runIntent(intent: IntentState) {
    activeIntent = intent
    context.emit(speechPipelineEventMap.onIntentStart, intent.intentId)

    const tokenStream = intent.stream
    const segmentStream = segmenter(tokenStream, { streamId: intent.streamId, intentId: intent.intentId })

    let lastPlayPromise = Promise.resolve()

    // Enforce a maximum concurrency of 5 for active TTS requests
    let activeTtsCount = 0
    const ttsQueue: (() => void)[] = []

    async function acquireTtsSlot() {
      if (activeTtsCount < 5) {
        activeTtsCount++
        return
      }
      return new Promise<void>((resolve) => {
        ttsQueue.push(resolve)
      })
    }

    function releaseTtsSlot() {
      activeTtsCount--
      if (ttsQueue.length > 0) {
        activeTtsCount++
        const next = ttsQueue.shift()
        next?.()
      }
    }

    try {
      const reader = segmentStream.getReader()

      while (true) {
        const { value, done } = await reader.read()
        if (done)
          break
        if (!value)
          continue
        if (intent.canceled || intent.controller.signal.aborted) {
          await reader.cancel()
          break
        }

        context.emit(speechPipelineEventMap.onSegment, value)

        // Defensive split: if a segment has BOTH text and special, split them into two virtual segments
        const segmentsToProcess: { text: string, special: string | null }[] = []
        if (value.text && value.special) {
          console.warn('[Speech Pipeline] Received mixed text+special segment, splitting defensively.', value)
          segmentsToProcess.push({ text: value.text, special: null })
          segmentsToProcess.push({ text: '', special: value.special })
        }
        else {
          segmentsToProcess.push({ text: value.text, special: value.special })
        }

        for (const seg of segmentsToProcess) {
          if (intent.canceled || intent.controller.signal.aborted) {
            break
          }

          if (seg.text === '' && seg.special) {
            const currentSpecial = seg.special
            const currentActorId = value.actorId
            const currentStreamId = value.streamId
            const currentIntentId = value.intentId
            const currentSegmentId = value.segmentId

            const prevPlayPromise = lastPlayPromise
            const playPromise = (async () => {
              try {
                await prevPlayPromise
              }
              catch {}

              if (intent.canceled || intent.controller.signal.aborted) {
                return
              }

              // NOTICE: Call tts() for special segments so it can handle side effects
              // (e.g., ACTOR voice swaps) before the next text segment is generated.
              // The tts() function returns null for specials, so no audio is produced.
              try {
                await options.tts(
                  { streamId: currentStreamId, intentId: currentIntentId, segmentId: currentSegmentId, text: '', special: currentSpecial, actorId: currentActorId, priority: intent.priority, createdAt: Date.now() },
                  intent.controller.signal,
                )
              }
              catch {}

              // Schedule a no-audio playback item so the special token
              // fires in sequence with audio playback (via the onEnd handler).
              options.playback.schedule({
                id: createId('playback'),
                streamId: currentStreamId,
                intentId: currentIntentId,
                segmentId: currentSegmentId,
                ownerId: intent.ownerId,
                priority: intent.priority,
                text: '',
                special: currentSpecial,
                actorId: currentActorId,
                audio: null as unknown as TAudio,
                createdAt: Date.now(),
              })
            })()

            lastPlayPromise = playPromise
            continue
          }

          const request: TtsRequest = {
            streamId: value.streamId,
            intentId: value.intentId,
            segmentId: value.segmentId,
            text: seg.text,
            special: seg.special,
            actorId: value.actorId,
            priority: intent.priority,
            createdAt: Date.now(),
          }

          context.emit(speechPipelineEventMap.onTtsRequest, request)

          // Streaming path: schedule each piece of audio as it arrives rather than
          // waiting for the whole segment. Segments are generated strictly in order
          // here, since their pieces interleave in the playback queue otherwise.
          if (options.ttsStream && !request.special) {
            const prevPlayPromiseStreaming = lastPlayPromise
            const streamingPromise = (async () => {
              try {
                await prevPlayPromiseStreaming
              }
              catch {}

              if (intent.controller.signal.aborted || intent.canceled)
                return

              await acquireTtsSlot()
              try {
                // Pieces are produced far faster than they play back, and the playback
                // manager allows only one voice per owner: scheduling them all up front
                // makes each new piece stop the one before it. So buffer them here and
                // schedule the next only once the current has finished.
                const readyPieces: TAudio[] = []
                let notifyPiece: (() => void) | null = null
                let producerDone = false
                let producerError: unknown = null

                const producer = (async () => {
                  try {
                    await options.ttsStream!(request, intent.controller.signal, (audio) => {
                      readyPieces.push(audio)
                      notifyPiece?.()
                    })
                  }
                  catch (err) {
                    producerError = err
                  }
                  finally {
                    producerDone = true
                    notifyPiece?.()
                  }
                })()

                let pieceIndex = 0
                while (true) {
                  if (readyPieces.length === 0) {
                    if (producerDone)
                      break
                    await new Promise<void>((resolve) => {
                      notifyPiece = () => {
                        notifyPiece = null
                        resolve()
                      }
                    })
                    continue
                  }

                  if (intent.controller.signal.aborted || intent.canceled)
                    break

                  // Take everything buffered so far, not just the next piece: the
                  // producer runs far ahead of playback, so this is usually several
                  // pieces and merging them removes the gaps between them.
                  const batch = readyPieces.splice(0, readyPieces.length)
                  const audio = batch.length > 1 && options.concatAudio
                    ? options.concatAudio(batch)
                    : batch[0] as TAudio
                  if (batch.length > 1 && !options.concatAudio)
                    readyPieces.unshift(...batch.slice(1))

                  const ttsResult: TtsResult<TAudio> = {
                    streamId: request.streamId,
                    intentId: request.intentId,
                    segmentId: pieceIndex === 0 ? request.segmentId : `${request.segmentId}:${pieceIndex}`,
                    text: pieceIndex === 0 ? request.text : '',
                    special: request.special,
                    actorId: request.actorId,
                    audio,
                    createdAt: Date.now(),
                  }
                  pieceIndex++

                  context.emit(speechPipelineEventMap.onTtsResult, ttsResult)

                  const playbackId = createId('playback')
                  const finished = waitForPlayback(playbackId)
                  options.playback.schedule({
                    id: playbackId,
                    streamId: ttsResult.streamId,
                    intentId: ttsResult.intentId,
                    segmentId: ttsResult.segmentId,
                    ownerId: intent.ownerId,
                    priority: intent.priority,
                    text: ttsResult.text,
                    special: ttsResult.special,
                    actorId: ttsResult.actorId,
                    audio: ttsResult.audio,
                    createdAt: Date.now(),
                  })
                  await finished
                }

                await producer
                if (producerError)
                  throw producerError
              }
              catch (err) {
                logger.warn('Streaming TTS generation failed:', err)
              }
              finally {
                releaseTtsSlot()
              }
            })()

            lastPlayPromise = streamingPromise
            continue
          }

          // Call TTS with concurrency limiting (max 5)
          const ttsPromise = (async () => {
            await acquireTtsSlot()
            try {
              return await options.tts(request, intent.controller.signal)
            }
            finally {
              releaseTtsSlot()
            }
          })()

          const prevPlayPromise = lastPlayPromise
          const playPromise = (async () => {
            let audio: TAudio | null = null
            try {
              audio = await ttsPromise
            }
            catch (err) {
              logger.warn('TTS generation failed:', err)
            }

            try {
              await prevPlayPromise
            }
            catch {}

            if (intent.controller.signal.aborted || intent.canceled) {
              return
            }

            if (!audio)
              return

            const ttsResult: TtsResult<TAudio> = {
              streamId: request.streamId,
              intentId: request.intentId,
              segmentId: request.segmentId,
              text: request.text,
              special: request.special,
              actorId: request.actorId,
              audio,
              createdAt: Date.now(),
            }

            context.emit(speechPipelineEventMap.onTtsResult, ttsResult)

            options.playback.schedule({
              id: createId('playback'),
              streamId: ttsResult.streamId,
              intentId: ttsResult.intentId,
              segmentId: ttsResult.segmentId,
              ownerId: intent.ownerId,
              priority: intent.priority,
              text: ttsResult.text,
              special: ttsResult.special,
              actorId: ttsResult.actorId,
              audio: ttsResult.audio,
              createdAt: Date.now(),
            })
          })()

          lastPlayPromise = playPromise
        }
      }

      reader.releaseLock()
      await lastPlayPromise
    }
    catch (err) {
      logger.warn('Speech pipeline intent failed:', err)
    }
    finally {
      if (intent.canceled) {
        context.emit(speechPipelineEventMap.onIntentCancel, { intentId: intent.intentId, reason: intent.controller.signal.reason as string | undefined })
      }
      else {
        context.emit(speechPipelineEventMap.onIntentEnd, intent.intentId)
      }

      intents.delete(intent.intentId)
      activeIntent = null

      const next = pickNextIntent()
      if (next)
        void runIntent(next)
    }
  }

  function openIntent(optionsInput?: IntentOptions): IntentHandle {
    const intentId = optionsInput?.intentId ?? createId('intent')
    const streamId = optionsInput?.streamId ?? createId('stream')
    const priority = priorityResolver.resolve(optionsInput?.priority)
    const behavior = optionsInput?.behavior ?? 'queue'
    const ownerId = optionsInput?.ownerId

    const controller = new AbortController()
    const { stream, write, close } = createPushStream<TextToken>()
    let sequence = 0

    const intent: IntentState = {
      intentId,
      streamId,
      priority,
      ownerId,
      behavior,
      createdAt: Date.now(),
      controller,
      stream,
      closeStream: close,
      canceled: false,
    }

    intents.set(intentId, intent)

    const handle: IntentHandle = {
      intentId,
      streamId,
      priority,
      ownerId,
      stream,
      writeLiteral(text: string) {
        if (intent.canceled)
          return
        write({
          type: 'literal',
          value: text,
          streamId,
          intentId,
          sequence: sequence++,
          createdAt: Date.now(),
        })
      },
      writeSpecial(special: string) {
        if (intent.canceled)
          return
        write({
          type: 'special',
          value: special,
          streamId,
          intentId,
          sequence: sequence++,
          createdAt: Date.now(),
        })
      },
      writeFlush() {
        if (intent.canceled)
          return
        write({
          type: 'flush',
          streamId,
          intentId,
          sequence: sequence++,
          createdAt: Date.now(),
        })
      },
      end() {
        close()
      },
      cancel(reason?: string) {
        cancelIntent(intentId, reason)
      },
    }

    if (!activeIntent) {
      void runIntent(intent)
      return handle
    }

    if (behavior === 'replace') {
      cancelIntent(activeIntent.intentId, 'replace')
      void runIntent(intent)
      return handle
    }

    if (behavior === 'interrupt' && intent.priority >= activeIntent.priority) {
      cancelIntent(activeIntent.intentId, 'interrupt')
      void runIntent(intent)
      return handle
    }

    enqueueIntent(intent)
    return handle
  }

  function cancelIntent(intentId: string, reason?: string) {
    const intent = intents.get(intentId)
    if (!intent)
      return
    intent.canceled = true
    intent.controller.abort(reason ?? 'canceled')
    intent.closeStream()

    if (activeIntent?.intentId === intentId) {
      options.playback.stopByIntent(intentId, reason ?? 'canceled')
      return
    }

    const index = pending.findIndex(item => item.intentId === intentId)
    if (index >= 0)
      pending.splice(index, 1)
  }

  function interrupt(reason: string) {
    if (activeIntent)
      cancelIntent(activeIntent.intentId, reason)
  }

  function stopAll(reason: string) {
    for (const intent of intents.values()) {
      intent.canceled = true
      intent.controller.abort(reason)
      intent.closeStream()
    }
    pending.length = 0
    intents.clear()
    activeIntent = null
    options.playback.stopAll(reason)
  }

  return {
    openIntent,
    cancelIntent,
    interrupt,
    stopAll,
    on<K extends SpeechPipelineEventName>(event: K, listener: SpeechPipelineEvents<TAudio>[K]) {
      return context.on(speechPipelineEventMap[event] as Eventa<any>, (payload) => {
        listener(payload?.body ?? payload)
      })
    },
  }
}
