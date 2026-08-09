/**
 * Kyutai Pocket TTS inference adapter.
 * Handles the Web Worker lifecycle and Eventa stream/unary RPC invoke routing.
 */

import type { PocketTtsVoiceEmbedding } from '../contract'
import type { ProgressPayload } from '../protocol'

import { defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { Mutex } from 'async-mutex'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { consumeLoadStream, pocketTtsGenerateEvent, pocketTtsLoadEvent, pocketTtsUnloadEvent } from '../contract'

export interface PocketTtsAdapter {
  /**
   * Load the Pocket TTS model weights (from OPFS cache or Hugging Face download).
   */
  loadModel: (options?: {
    language?: string
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }) => Promise<void>

  /**
   * Synthesize speech audio from text using a specified voice preset or reference buffer.
   */
  generate: (
    text: string,
    voiceId: string,
    options: {
      language?: string
      cpuThreads?: number
      promptAudioWaveform?: Float32Array
      promptAudioChannels?: number
      promptVoiceEmbedding?: PocketTtsVoiceEmbedding
      predefinedVoiceName?: string
      signal?: AbortSignal
    },
  ) => Promise<ArrayBuffer>

  /** Terminate the worker */
  terminate: () => void

  /** Current state */
  readonly state: 'idle' | 'loading' | 'ready' | 'running' | 'error' | 'terminated'

  /** Codec packing info reported by the worker after load. */
  readonly codecConfig: { sample_rate: number, channels: number } | null
}

function encodeWav(samples: Float32Array, sampleRate: number, numChannels = 1): ArrayBuffer {
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const dataLength = samples.length * bytesPerSample
  const headerLength = 44
  const buffer = new ArrayBuffer(headerLength + dataLength)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')

  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true)
  view.setUint16(34, bitsPerSample, true)

  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  const output = new Int16Array(buffer, headerLength)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }

  return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

function concatFloat32(parts: Float32Array[]): Float32Array {
  if (parts.length === 1)
    return parts[0]
  let total = 0
  for (const part of parts)
    total += part.length
  const out = new Float32Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function createPocketTtsAdapter(): PocketTtsAdapter {
  let worker: Worker | null = null
  let state: PocketTtsAdapter['state'] = 'idle'
  let codecConfig: { sample_rate: number, channels: number } | null = null
  const mutex = new Mutex()

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(
        new URL('../../../workers/pocket-tts/worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.addEventListener('error', () => {
        state = 'error'
      })
    }
    return worker
  }

  const modelStatusId = 'pocket-tts-local'

  async function doLoadModel(options?: {
    language?: string
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }): Promise<void> {
    console.info('[PocketTTS Adapter] doLoadModel() started. Current state:', state, 'Options:', options)
    if (state === 'ready') {
      console.info('[PocketTTS Adapter] Model is already in ready state. Skipping load.')
      return
    }

    state = 'loading'
    updateInferenceStatus(modelStatusId, {
      state: 'downloading',
      device: 'wasm',
      progress: { phase: 'download', percent: 0 },
    })

    console.info(`[PocketTTS Adapter] Invoking worker stream for language/model: "${options?.language || 'english_2026-04'}"...`)
    const w = ensureWorker()
    const { context } = createContext(w)
    const invokeLoad = defineStreamInvoke(context, pocketTtsLoadEvent)

    const stream = invokeLoad(
      { device: 'wasm', language: options?.language || 'english_2026-04' },
      { signal: options?.signal },
    )

    const readyInfo = await consumeLoadStream(stream, (progress) => {
      console.info('[PocketTTS Adapter] Load progress update:', progress)
      updateInferenceStatus(modelStatusId, { progress })
      options?.onProgress?.(progress)
    })

    const codec = (readyInfo?.metadata as any)?.codecConfig
    if (codec && typeof codec.sample_rate === 'number' && typeof codec.channels === 'number') {
      codecConfig = { sample_rate: codec.sample_rate, channels: codec.channels }
    }

    state = 'ready'
    console.info('[PocketTTS Adapter] Model successfully loaded & ready.')
    updateInferenceStatus(modelStatusId, { state: 'ready' })
  }

  async function loadModel(options?: {
    language?: string
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }): Promise<void> {
    console.info('[PocketTTS Adapter] loadModel() invoked. Acquiring mutex lock...')
    const release = await mutex.acquire()
    try {
      console.info('[PocketTTS Adapter] Mutex lock acquired for loadModel(). Proceeding to doLoadModel()...')
      await doLoadModel(options)
    }
    catch (err) {
      console.error('[PocketTTS Adapter] Model load failed:', err)
      state = 'error'
      updateInferenceStatus(modelStatusId, { state: 'error' })
      throw err
    }
    finally {
      console.info('[PocketTTS Adapter] Releasing mutex lock for loadModel().')
      release()
    }
  }

  async function generate(
    text: string,
    voiceId: string,
    options: {
      language?: string
      cpuThreads?: number
      promptAudioWaveform?: Float32Array
      promptAudioChannels?: number
      promptVoiceEmbedding?: PocketTtsVoiceEmbedding
      predefinedVoiceName?: string
      signal?: AbortSignal
    },
  ): Promise<ArrayBuffer> {
    console.info('[PocketTTS Adapter] generate() invoked.', { textLength: text.length, voiceId, state, options })
    console.info('[PocketTTS Adapter] Acquiring mutex lock for generate()...')
    const release = await mutex.acquire()
    try {
      console.info('[PocketTTS Adapter] Mutex lock acquired for generate(). Checking state...')
      if (state !== 'ready') {
        console.info('[PocketTTS Adapter] State is not ready. Calling doLoadModel()...')
        await doLoadModel({ language: options.language, signal: options.signal })
      }

      state = 'running'
      updateInferenceStatus(modelStatusId, { state: 'running' })

      const w = ensureWorker()
      const { context } = createContext(w)
      const invokeGenerate = defineStreamInvoke(context, pocketTtsGenerateEvent)

      console.info('[PocketTTS Adapter] Invoking worker stream for audio generation...')
      const stream = invokeGenerate(
        {
          text,
          voiceId,
          language: options.language,
          cpuThreads: options.cpuThreads,
          promptAudioWaveform: options.promptAudioWaveform,
          promptAudioChannels: options.promptAudioChannels,
          promptVoiceEmbedding: options.promptVoiceEmbedding,
          predefinedVoiceName: options.predefinedVoiceName,
        },
        { signal: options.signal },
      )

      const chunks: Float32Array[] = []
      let samplingRate = 24000
      let freshlyEncodedEmbedding: PocketTtsVoiceEmbedding | undefined

      for await (const chunk of stream) {
        if (chunk.kind === 'voice-embedding' && chunk.voiceEmbedding) {
          console.info('[PocketTTS Adapter] Received freshly-encoded voice embedding from worker.')
          freshlyEncodedEmbedding = chunk.voiceEmbedding
          continue
        }
        if (chunk.samples) {
          chunks.push(chunk.samples)
          if (chunk.samplingRate)
            samplingRate = chunk.samplingRate
        }
      }

      console.info(`[PocketTTS Adapter] Stream complete. Total chunks received: ${chunks.length}`)

      // Persist freshly-encoded voice embedding for subsequent cache hits
      if (freshlyEncodedEmbedding) {
        try {
          const { default: localforage } = await import('localforage')
          const metaStore = localforage.createInstance({ name: 'pocket-voice-profiles-metadata' })
          const existing = await metaStore.getItem<any>(voiceId)
          if (existing) {
            await metaStore.setItem(voiceId, { ...existing, promptVoiceEmbedding: freshlyEncodedEmbedding })
            console.info('[PocketTTS Adapter] Persisted promptVoiceEmbedding to localforage for voiceId:', voiceId)
          }
        }
        catch (err) {
          console.warn('[PocketTTS Adapter] Failed to persist promptVoiceEmbedding to localforage:', err)
        }
      }

      state = 'ready'
      updateInferenceStatus(modelStatusId, { state: 'ready' })

      if (chunks.length === 0) {
        throw new Error('Pocket TTS worker yielded no audio samples.')
      }

      const merged = concatFloat32(chunks)
      const wavBuffer = encodeWav(merged, samplingRate, 1)
      console.info(`[PocketTTS Adapter] Audio generation completed successfully! WAV size: ${wavBuffer.byteLength} bytes.`)
      return wavBuffer
    }
    catch (err) {
      console.error('[PocketTTS Adapter] Speech generation failed:', err)
      state = 'error'
      updateInferenceStatus(modelStatusId, { state: 'error' })
      throw err
    }
    finally {
      console.info('[PocketTTS Adapter] Releasing mutex lock for generate().')
      release()
    }
  }

  function terminate(): void {
    if (worker) {
      try {
        const { context } = createContext(worker)
        const invokeUnload = defineStreamInvoke(context, pocketTtsUnloadEvent)
        invokeUnload(undefined)
      }
      catch {}
      worker.terminate()
      worker = null
    }
    state = 'terminated'
    codecConfig = null
    removeInferenceStatus(modelStatusId)
  }

  return {
    get state() { return state },
    get codecConfig() { return codecConfig },
    loadModel,
    generate,
    terminate,
  }
}
