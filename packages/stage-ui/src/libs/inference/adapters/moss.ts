/**
 * MOSS TTS inference adapter.
 * Handles the Web Worker lifecycle and Eventa stream/unary RPC invoke routing.
 */

import type { ProgressPayload } from '../protocol'

import { defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { Mutex } from 'async-mutex'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { consumeLoadStream, mossGenerateEvent, mossLoadEvent, mossUnloadEvent } from '../contract'

export interface MossAdapter {
  /**
   * Load the MOSS TTS model weights (from OPFS cache or Hugging Face download).
   */
  loadModel: (options?: {
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
      cpuThreads: number
      attentionBackend: string
      samplingMode: string
      voiceCloneMaxTokens: number
      promptAudioWaveform?: Float32Array
      promptAudioChannels?: number
      promptAudioCodes?: number[][]
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

export function createMossAdapter(): MossAdapter {
  let worker: Worker | null = null
  let state: MossAdapter['state'] = 'idle'
  let codecConfig: { sample_rate: number, channels: number } | null = null
  const mutex = new Mutex()

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(
        new URL('../../../workers/moss/worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.addEventListener('error', () => {
        state = 'error'
      })
    }
    return worker
  }

  function getRpc(w: Worker) {
    const { context } = createContext(w)
    return {
      load: defineStreamInvoke(context, mossLoadEvent),
      generate: defineStreamInvoke(context, mossGenerateEvent),
      unload: defineStreamInvoke(context, mossUnloadEvent),
    }
  }

  async function loadModel(options?: {
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }): Promise<void> {
    return mutex.runExclusive(async () => {
      state = 'loading'
      const modelStatusId = 'moss-tts-nano'
      updateInferenceStatus(modelStatusId, { state: 'downloading', device: 'wasm' })

      try {
        const w = ensureWorker()
        const rpc = getRpc(w)
        const hfToken = typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || undefined : undefined
        const stream = rpc.load(
          { device: 'wasm', dtype: 'fp32', hfToken },
          { signal: options?.signal },
        )

        const readyInfo = await consumeLoadStream(stream, (progress) => {
          updateInferenceStatus(modelStatusId, { progress })
          options?.onProgress?.(progress)
        })

        const codec = (readyInfo?.metadata as any)?.codecConfig
        if (codec && typeof codec.sample_rate === 'number' && typeof codec.channels === 'number') {
          codecConfig = { sample_rate: codec.sample_rate, channels: codec.channels }
        }

        state = 'ready'
        updateInferenceStatus(modelStatusId, { state: 'ready' })
      }
      catch (error) {
        state = 'error'
        updateInferenceStatus(modelStatusId, { state: 'error' })
        throw error
      }
    })
  }

  async function generate(
    text: string,
    voiceId: string,
    options: {
      cpuThreads: number
      attentionBackend: string
      samplingMode: string
      voiceCloneMaxTokens: number
      promptAudioWaveform?: Float32Array
      promptAudioChannels?: number
      promptAudioCodes?: number[][]
      signal?: AbortSignal
    },
  ): Promise<ArrayBuffer> {
    return mutex.runExclusive(async () => {
      if (state !== 'ready') {
        throw new Error('MossAdapter: Model is not loaded. Call loadModel() first.')
      }
      state = 'running'

      try {
        const w = ensureWorker()
        const rpc = getRpc(w)
        const stream = rpc.generate(
          {
            text,
            voiceId,
            cpuThreads: options.cpuThreads,
            attentionBackend: options.attentionBackend,
            samplingMode: options.samplingMode,
            voiceCloneMaxTokens: options.voiceCloneMaxTokens,
            promptAudioWaveform: options.promptAudioWaveform,
            promptAudioChannels: options.promptAudioChannels,
            promptAudioCodes: options.promptAudioCodes,
          },
          { signal: options.signal },
        )

        const chunks: Float32Array[] = []
        let samplingRate = 16000
        let freshlyEncodedCodes: number[][] | undefined

        for await (const chunk of stream) {
          if (chunk.kind === 'prompt-audio-codes' && chunk.promptAudioCodes) {
            freshlyEncodedCodes = chunk.promptAudioCodes
            continue
          }
          if (chunk.samples) {
            chunks.push(chunk.samples)
            if (chunk.samplingRate)
              samplingRate = chunk.samplingRate
          }
        }

        // Persist freshly-encoded reference codes for subsequent cache hits (Phase B).
        if (freshlyEncodedCodes && freshlyEncodedCodes.length > 0) {
          try {
            const { default: localforage } = await import('localforage')
            const metaStore = localforage.createInstance({ name: 'moss-voice-profiles-metadata' })
            const existing = await metaStore.getItem<any>(voiceId)
            if (existing) {
              await metaStore.setItem(voiceId, { ...existing, promptAudioCodes: freshlyEncodedCodes })
            }
          }
          catch (err) {
            // Non-fatal: caching is an optimization only
            console.warn('[MossAdapter] Failed to cache prompt_audio_codes:', err)
          }
        }

        if (chunks.length === 0) {
          throw new Error('MossAdapter: Generated audio stream was empty.')
        }

        const samples = concatFloat32(chunks)
        const wav = encodeWav(samples, samplingRate)

        state = 'ready'
        return wav
      }
      catch (error) {
        state = 'ready' // Return back to ready on error
        throw error
      }
    })
  }

  function terminate(): void {
    if (worker) {
      worker.terminate()
      worker = null
    }
    state = 'terminated'
    removeInferenceStatus('moss-tts-nano')
  }

  return {
    get state() { return state },
    get codecConfig() { return codecConfig },
    loadModel,
    generate,
    terminate,
  }
}
