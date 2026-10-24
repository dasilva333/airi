import type { TranscriptionProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { HearingTranscriptionResult } from './hearing-store'

import { tryCatch } from '@moeru/std'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import vadWorkletUrl from '../../workers/vad/process.worklet?worker&url'

import { useProvidersStore } from '../providers'
import { streamWebSpeechAPITranscription } from '../providers/web-speech-api'
import { useHearingStore } from './hearing-store'
import { useLiveSessionStore } from './live-session'

function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  // Browsers hide the real reason (CORS, timeout, DNS, …) behind this generic string.
  if (msg === 'Failed to fetch' || msg === 'Load failed') {
    return `${msg} — check the browser console (Network tab) for the exact reason (e.g. CORS, network timeout, DNS failure).`
  }
  return msg
}

export const useHearingSpeechInputPipeline = defineStore('modules:hearing:speech:audio-input-pipeline', () => {
  const error = ref<string>()

  const hearingStore = useHearingStore()
  const { activeTranscriptionProvider, activeTranscriptionModel } = storeToRefs(hearingStore)
  const providersStore = useProvidersStore()
  const streamingSession = shallowRef<{
    audioContext: AudioContext | Record<string, never>
    workletNode: AudioWorkletNode | Record<string, never>
    mediaStreamSource: MediaStreamAudioSourceNode | Record<string, never>
    audioStreamController?: ReadableStreamDefaultController<ArrayBuffer>
    abortController: AbortController
    result?: HearingTranscriptionResult & { recognition?: any }
    idleTimer?: ReturnType<typeof setTimeout>
    providerId?: string
    callbacks?: {
      onSentenceEnd?: (delta: string) => void
      onSpeechEnd?: (text: string) => void
    }
  }>()

  const supportsStreamInput = computed(() => {
    const liveSessionStore = useLiveSessionStore()
    if (liveSessionStore.isActive && liveSessionStore.outputMode === 'gemini') {
      return true
    }

    const providerId = activeTranscriptionProvider.value
    if (!providerId)
      return false

    // Web Speech API always supports stream input when available
    if (providerId === 'browser-web-speech-api') {
      return typeof window !== 'undefined'
        && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    }

    return providersStore.getTranscriptionFeatures(providerId).supportsStreamInput
  })

  const DEFAULT_SAMPLE_RATE = 16000
  const DEFAULT_STREAM_IDLE_TIMEOUT = 15000

  function float32ToInt16(buffer: Float32Array) {
    const output = new Int16Array(buffer.length)
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]))
      output[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF)
    }

    return output
  }

  async function createAudioStreamFromMediaStream(stream: MediaStream, sampleRate = DEFAULT_SAMPLE_RATE, onActivity?: () => void) {
    const audioContext = new AudioContext({ sampleRate, latencyHint: 'interactive' })
    console.info(`[Hearing Pipeline] Created AudioContext. SampleRate: ${audioContext.sampleRate}Hz (Requested: ${sampleRate}Hz)`)
    await audioContext.audioWorklet.addModule(vadWorkletUrl)
    const workletNode = new AudioWorkletNode(audioContext, 'vad-audio-worklet-processor')

    let audioStreamController: ReadableStreamDefaultController<ArrayBuffer> | undefined
    const audioStream = new ReadableStream<ArrayBuffer>({
      start(controller) {
        audioStreamController = controller
      },
      cancel: () => {
        audioStreamController = undefined
      },
    })

    workletNode.port.onmessage = ({ data }: MessageEvent<{ buffer?: Float32Array }>) => {
      const buffer = data?.buffer
      if (!buffer || !audioStreamController)
        return

      const pcm16 = float32ToInt16(buffer)
      // Clone buffer to avoid retaining underlying ArrayBuffer references
      audioStreamController.enqueue(pcm16.buffer.slice(0))
      onActivity?.()
    }

    const mediaStreamSource = audioContext.createMediaStreamSource(stream)
    mediaStreamSource.connect(workletNode)

    // Sink to avoid feedback/echo - connect to a MediaStreamDestination instead of hardware destination
    // This keeps the worklet active without any risk of audio leakage to speakers
    const dest = audioContext.createMediaStreamDestination()
    workletNode.connect(dest)

    return {
      audioContext,
      workletNode,
      mediaStreamSource,
      audioStream,
      get controller() {
        return audioStreamController
      },
    }
  }

  async function stopStreamingTranscription(abort?: boolean, disposeProviderId?: string) {
    const session = streamingSession.value
    if (!session)
      return

    // Special handling for Web Speech API
    if (session.providerId === 'browser-web-speech-api') {
      try {
        const reason = new DOMException(abort ? 'Aborted' : 'Stopped', 'AbortError')
        if (!session.abortController.signal.aborted) {
          session.abortController.abort(reason)
        }

        // Stop Web Speech API recognition if it exists
        const result = session.result as any
        if (result?.recognition) {
          try {
            result.recognition.stop()
          }
          catch (err) {
            console.warn('Error stopping Web Speech API recognition:', err)
          }
        }
      }
      catch (err) {
        console.error('Error stopping Web Speech API session:', err)
      }

      if (session.idleTimer)
        clearTimeout(session.idleTimer)

      streamingSession.value = undefined

      if (session.result?.mode === 'stream') {
        try {
          const text = await session.result.text
          return text
        }
        catch (err) {
          error.value = errorMessage(err)
          console.error('Error getting transcription result:', error.value)
        }
      }

      return
    }

    try {
      const reason = new DOMException(abort ? 'Aborted' : 'Stopped', 'AbortError')
      // Ensure provider transports (e.g., Aliyun NLS) are signaled to stop over websocket.
      if (!session.abortController.signal.aborted) {
        session.abortController.abort(reason)
      }

      if (abort)
        session.audioStreamController?.error(reason)
      else
        session.audioStreamController?.close()
    }
    catch {}

    await tryCatch(() => {
      session.mediaStreamSource.disconnect()
      session.workletNode.port.onmessage = null
      session.workletNode.disconnect()
    })
    await tryCatch(() => session.audioContext.close())

    if (session.idleTimer)
      clearTimeout(session.idleTimer)

    streamingSession.value = undefined
    // NOTICE: Always reset the transcribing flag here. Previously it was only
    // reset in the text stream reader's finally block (line ~759), which was
    // unreliable when the stream errored or was aborted. This caused all
    // subsequent calls to transcribeForMediaStream to bail at the guard.
    hearingStore.isTranscribing = false

    if (session.result?.mode === 'stream') {
      try {
        const text = await session.result.text

        if (disposeProviderId) {
          await providersStore.disposeProviderInstance(disposeProviderId)
        }

        return text
      }
      catch (err) {
        error.value = errorMessage(err)
        console.error('Error generating transcription:', error.value)
      }
    }

    const text = session.result?.text
    if (disposeProviderId)
      await providersStore.disposeProviderInstance(disposeProviderId)

    return text
  }

  async function transcribeForMediaStream(stream: MediaStream, options?: {
    sampleRate?: number
    providerOptions?: Record<string, unknown>
    idleTimeoutMs?: number
    providerId?: string
    model?: string
    onSentenceEnd?: (delta: string) => void
    onSpeechEnd?: (text: string) => void
    onError?: (error: string) => void
  }) {
    const providerId = options?.providerId ?? activeTranscriptionProvider.value
    const isStreamSupported = providerId === 'browser-web-speech-api'
      ? (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window))
      : (providerId ? providersStore.getTranscriptionFeatures(providerId).supportsStreamInput : supportsStreamInput.value)

    console.info('[Hearing Pipeline] transcribeForMediaStream called', {
      supportsStreamInput: isStreamSupported,
      hasStream: !!stream,
      providerId,
      hasCallbacks: !!(options?.onSentenceEnd || options?.onSpeechEnd),
    })

    if (!isStreamSupported) {
      console.warn('[Hearing Pipeline] Stream input not supported')
      return
    }

    // NOTICE: We check isTranscribing here but allow re-entry when there's an
    // existing session to restart (the restart logic below handles teardown).
    // Previously this guard permanently blocked re-entry because
    // stopStreamingTranscription did not reset isTranscribing.
    if (hearingStore.isTranscribing && !streamingSession.value) {
      console.warn('[Hearing Pipeline] Transcription already in progress (no session to restart), skipping')
      return
    }

    error.value = undefined
    hearingStore.isTranscribing = true

    try {
      const liveSessionStore = useLiveSessionStore()
      if (liveSessionStore.isActive && liveSessionStore.activeInputSource !== 'discord' && liveSessionStore.outputMode === 'gemini') {
        console.info('[Hearing Pipeline] Intercepting mic for Gemini Live Bidi API')

        const abortController = new AbortController()

        // Empty bumpIdle because Gemini Bidi is a continuous socket. We do not want idle timeouts to prematurely sever it.
        const bumpIdle = () => {}

        const session = await createAudioStreamFromMediaStream(
          stream,
          16000,
          () => bumpIdle(),
        )

        streamingSession.value = {
          audioContext: session.audioContext,
          workletNode: session.workletNode,
          mediaStreamSource: session.mediaStreamSource,
          audioStreamController: session.controller,
          abortController,
          result: { mode: 'stream' } as any,
          idleTimer: undefined,
          providerId: 'gemini-live',
          callbacks: {
            onSentenceEnd: options?.onSentenceEnd,
            onSpeechEnd: options?.onSpeechEnd,
          },
        } as any

        // Connect the Live Session subtitles to the caption overlay
        const unwatch = watch(() => liveSessionStore.lastTranscript, (val) => {
          options?.onSentenceEnd?.(val)
        })
        abortController.signal.addEventListener('abort', () => {
          unwatch()
          if (liveSessionStore.isActive) {
            liveSessionStore.sendAudioStreamEnd()
          }
        })

        const reader = session.audioStream.getReader()
        void (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done)
                break
              if (value) {
                // Convert PCM Int16 buffer to Base64 (maxes out ~500 bytes per tick, safe for fromCharCode)
                let binary = ''
                const bytes = new Uint8Array(value)
                const len = bytes.byteLength
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(bytes[i])
                }
                const base64 = btoa(binary)
                liveSessionStore.sendRealtimeAudio(base64)
              }
            }
          }
          catch (e) {
            console.error('[Hearing Pipeline] Gemini Audio worklet read error:', e)
          }
          finally {
            hearingStore.isTranscribing = false
          }
        })()

        return
      }

      if (!providerId) {
        error.value = 'No transcription provider selected'
        console.error('[Hearing Pipeline] No transcription provider selected')
        hearingStore.isTranscribing = false
        return
      }

      console.info('[Hearing Pipeline] Using provider:', providerId)

      // Special handling for Web Speech API - it works directly with MediaStream
      if (providerId === 'browser-web-speech-api') {
        // Check if Web Speech API is available
        const isAvailable = typeof window !== 'undefined'
          && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

        if (!isAvailable) {
          error.value = 'Web Speech API is not available in this browser'
          console.error('Web Speech API is not available')
          hearingStore.isTranscribing = false
          return
        }

        // Check if session already exists and reuse it
        const existingSession = streamingSession.value
        if (existingSession && existingSession.providerId === 'browser-web-speech-api') {
          // For Web Speech API, if callbacks are provided and different, we need to restart
          // because recognition instance callbacks are set once and can't be changed
          // However, if no new callbacks are provided, we can just reuse the session
          const hasNewCallbacks = !!(options?.onSentenceEnd || options?.onSpeechEnd)

          if (hasNewCallbacks) {
            // We need to restart to use new callbacks, but only if they're actually different
            // Since we can't compare functions, we'll just always restart if new callbacks are provided
            // This ensures callbacks are always up-to-date
            console.info('Web Speech API: New callbacks provided, restarting session to use them')
            await stopStreamingTranscription(false, existingSession.providerId)
            // Continue to create new session below
            // Note: stopStreamingTranscription already clears streamingSession.value and waits for async cleanup
          }
          else {
            // No new callbacks - just bump idle timer and reuse existing session
            const idleTimeout = options?.idleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT
            if (existingSession.idleTimer) {
              clearTimeout(existingSession.idleTimer)
              existingSession.idleTimer = setTimeout(async () => {
                await stopStreamingTranscription(false, existingSession.providerId)
              }, idleTimeout)
            }

            console.info('Web Speech API session already active, reusing existing session (no callback changes)')
            return
          }
        }

        // Auto-select default model if not selected
        let targetModel = options?.model ?? activeTranscriptionModel.value
        if (!targetModel) {
          // Try to get models for the provider and select the first one
          const models = await providersStore.getModelsForProvider(providerId)
          if (models.length > 0) {
            targetModel = models[0].id
            if (!options?.model) {
              activeTranscriptionModel.value = models[0].id
            }
            console.info('Auto-selected Web Speech API model:', models[0].id)
          }
          else {
            // Fallback to default model ID
            targetModel = 'web-speech-api'
            if (!options?.model) {
              activeTranscriptionModel.value = 'web-speech-api'
            }
            console.info('Auto-selected Web Speech API default model')
          }
        }

        const abortController = new AbortController()

        // Get provider config for language settings
        const providerConfig = providersStore.getProviderConfig(providerId) || {}
        const language = (options?.providerOptions?.language as string)
          || (providerConfig.language as string)
          || 'en-US'

        // Web Speech API in continuous mode should run indefinitely - no idle timeout
        // Only stop when explicitly requested (e.g., microphone disabled)
        const idleTimeout = options?.idleTimeoutMs ?? 0 // 0 = disabled
        let idleTimer: ReturnType<typeof setTimeout> | undefined
        const bumpIdle = () => {
          if (idleTimeout > 0) {
            if (idleTimer)
              clearTimeout(idleTimer)
            idleTimer = setTimeout(async () => {
              await stopStreamingTranscription(false, providerId)
            }, idleTimeout)
          }
        }

        const result = streamWebSpeechAPITranscription(stream, {
          language,
          continuous: (options?.providerOptions?.continuous as boolean) ?? (providerConfig.continuous as boolean) ?? true,
          interimResults: (options?.providerOptions?.interimResults as boolean) ?? (providerConfig.interimResults as boolean) ?? true,
          maxAlternatives: (options?.providerOptions?.maxAlternatives as number) ?? (providerConfig.maxAlternatives as number) ?? 1,
          abortSignal: abortController.signal,
          onSentenceEnd: (delta) => {
            if (abortController.signal.aborted)
              return
            bumpIdle() // Bump idle timer on activity (only if enabled)
            // Call the options callback
            options?.onSentenceEnd?.(delta)

            // Transcription feedback toast
            console.debug('[Hearing Pipeline] Web Speech API delta:', delta)
            toast.dismiss('transcription-feedback')
            toast.info(`🎤 You said: ${delta}`, {
              id: 'transcription-feedback',
            })
          },
          onSpeechEnd: (text) => {
            if (abortController.signal.aborted)
              return
            hearingStore.isTranscribing = false
            // Call the options callback
            options?.onSpeechEnd?.(text)
          },
          onError: (errMsg) => {
            hearingStore.isTranscribing = false
            error.value = errMsg
            options?.onError?.(errMsg)
          },
        })

        // Store session info for cleanup
        const recognitionInstance = (result as any).recognition
        streamingSession.value = {
          audioContext: {} as AudioContext, // Not used for Web Speech API
          workletNode: {} as AudioWorkletNode, // Not used for Web Speech API
          mediaStreamSource: {} as MediaStreamAudioSourceNode, // Not used for Web Speech API
          mediaStream: stream,
          audioStreamController: undefined,
          abortController,
          result: { ...result, mode: 'stream' as const, recognition: recognitionInstance },
          idleTimer,
          providerId,
          callbacks: {
            onSentenceEnd: options?.onSentenceEnd,
            onSpeechEnd: options?.onSpeechEnd,
          },
        } as any // Type assertion needed because recognition is extra

        // Initial idle timer (only if enabled)
        bumpIdle()

        // Stream out text deltas
        if (result.textStream) {
          void (async () => {
            try {
              const reader = result.textStream.getReader()

              while (true) {
                const { done } = await reader.read()
                if (done)
                  break
                // onSentenceEnd is already called from the recognition.onresult handler
                // Note: onSpeechEnd is called from web-speech-api/index.ts recognition.onend handler
                // (line 332 for non-continuous mode, line 271 for errors)
                // We don't call it here to avoid duplicate calls
              }
            }
            catch (err) {
              console.error('Error reading text stream:', err)
            }
          })()
        }

        return
      }

      const provider = await providersStore.getProviderInstance<TranscriptionProviderWithExtraOptions<string, any>>(providerId)
      if (!provider) {
        hearingStore.isTranscribing = false
        throw new Error('Failed to initialize speech provider')
      }

      const idleTimeout = options?.idleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT

      // If a session exists, reuse it unless new callbacks are provided.
      // The stream reader captures callbacks at creation time, so updated callbacks
      // require restarting the session to create a new reader.
      const existingSession = streamingSession.value
      if (existingSession) {
        const hasNewCallbacks
          = options?.onSentenceEnd !== undefined
            || options?.onSpeechEnd !== undefined

        if (hasNewCallbacks) {
          console.info('[Hearing Pipeline] New callbacks provided, restarting session')
          await stopStreamingTranscription(false, existingSession.providerId)
          // Fall through to create a new session with updated callbacks
        }
        else {
          // No callback changes: refresh idle timer and reuse session
          if (existingSession.idleTimer) {
            clearTimeout(existingSession.idleTimer)
            existingSession.idleTimer = setTimeout(async () => {
              await stopStreamingTranscription(false, existingSession.providerId)
            }, idleTimeout)
          }
          return
        }
      }

      const abortController = new AbortController()
      let idleTimer: ReturnType<typeof setTimeout> | undefined
      const bumpIdle = () => {
        if (idleTimer)
          clearTimeout(idleTimer)
        idleTimer = setTimeout(async () => {
          await stopStreamingTranscription(false, providerId)
        }, idleTimeout)
      }

      const session = await createAudioStreamFromMediaStream(
        stream,
        options?.sampleRate ?? DEFAULT_SAMPLE_RATE,
        () => bumpIdle(),
      )

      if (session.audioContext.state === 'suspended')
        await session.audioContext.resume()

      bumpIdle()

      const model = options?.model ?? activeTranscriptionModel.value
      const result = await hearingStore.transcription(
        providerId,
        provider,
        model,
        { inputAudioStream: session.audioStream },
        undefined,
        {
          providerOptions: {
            abortSignal: abortController.signal,
            ...options?.providerOptions,
          },
        },
      )

      streamingSession.value = {
        audioContext: session.audioContext,
        workletNode: session.workletNode,
        mediaStreamSource: session.mediaStreamSource,
        audioStreamController: session.controller,
        abortController,
        result,
        idleTimer,
        providerId,
        callbacks: {
          onSentenceEnd: options?.onSentenceEnd,
          onSpeechEnd: options?.onSpeechEnd,
        },
      }

      // Stream out text deltas to caller without tearing down the session.
      if (result.mode === 'stream' && result.textStream) {
        void (async () => {
          // Capture callbacks from the session at the time the reader is created
          // This prevents cross-session leakage if the session is restarted before
          // this reader finishes (e.g., when navigating between pages or callbacks change)
          const sessionCallbacks = {
            onSentenceEnd: streamingSession.value?.callbacks?.onSentenceEnd,
            onSpeechEnd: streamingSession.value?.callbacks?.onSpeechEnd,
          }

          let fullText = ''
          try {
            const reader = result.textStream.getReader()

            while (true) {
              const { done, value } = await reader.read()
              if (done)
                break
              if (abortController.signal.aborted)
                break
              if (value) {
                fullText += value
                // Use captured callbacks to avoid cross-session leakage
                sessionCallbacks.onSentenceEnd?.(value)

                // Transcription feedback toast
                // NOTICE: Silenced by user request to reduce verbosity
                /*
                console.debug('[Hearing Pipeline] Stream delta:', value)
                toast.dismiss('transcription-feedback')
                toast.info(`🎤 You said: ${value}`, {
                  id: 'transcription-feedback',
                })
                */
              }
            }
          }
          catch (err) {
            console.error('Error reading text stream:', err)
          }
          finally {
            if (!abortController.signal.aborted) {
              // Use captured callbacks to avoid cross-session leakage
              sessionCallbacks.onSpeechEnd?.(fullText)
            }
            hearingStore.isTranscribing = false
          }
        })()
      }
    }
    catch (err) {
      error.value = errorMessage(err)
      console.error('Error generating transcription:', error.value)
    }
  }

  async function transcribeForRecording(recording: Blob | null | undefined, options?: {
    providerId?: string
    model?: string
  }) {
    if (hearingStore.isTranscribing) {
      console.warn('[Hearing Pipeline] Transcription already in progress, skipping recording transcription')
      return
    }

    error.value = undefined

    if (!recording)
      return

    try {
      hearingStore.isTranscribing = true
      if (recording && recording.size > 0) {
        const providerId = options?.providerId ?? activeTranscriptionProvider.value
        const provider = await providersStore.getProviderInstance<TranscriptionProviderWithExtraOptions<string, any>>(providerId)
        if (!provider) {
          throw new Error('Failed to initialize speech provider')
        }

        const model = options?.model ?? activeTranscriptionModel.value
        console.info('[Hearing Pipeline] Triggering hearingStore.transcription', {
          providerId,
          model,
          fileName: 'recording.wav',
        })
        // NOTICE: File does not inherit the Blob's MIME type — pass it
        // explicitly, otherwise downstream senders (e.g. Deepgram, which
        // falls back to 'audio/webm') declare the wrong container and the
        // provider decodes silence.
        const result = await hearingStore.transcription(
          providerId,
          provider,
          model,
          new File([recording], 'recording.wav', { type: recording.type || 'audio/wav' }),
        )
        const text = result.mode === 'stream' ? await result.text : result.text
        if (!text || !text.trim()) {
          error.value = 'No transcription result returned from provider'
          return
        }

        return text
      }
    }
    catch (err) {
      error.value = errorMessage(err)
      console.error('Error generating transcription:', error.value)
    }
    finally {
      hearingStore.isTranscribing = false
    }
  }

  return {
    error,

    transcribeForRecording,
    transcribeForMediaStream,
    stopStreamingTranscription,
    supportsStreamInput,
  }
})
