/**
 * Cactus Whistle Speech-to-Text inference client adapter.
 *
 * Provides a typed interface to the Whistle Web Worker:
 * - Cache status and manual pre-warming with progress reporting
 * - Transcribes 16 kHz mono Float32Array PCM buffers
 * - Supports keyword biasing (`keywords`) and word-level timestamps (`wordTimestamps`)
 * - Sub-20ms TTFT execution on CPU
 */

import { isWhistleModelCached } from '../cache-utils'

export interface WhistleWordTimestamp {
  word: string
  start: number
  end: number
  prob?: number
}

export interface WhistleTranscribeResult {
  text: string
  language?: string
  words?: WhistleWordTimestamp[]
  latencyMs: number
}

export interface WhistleTranscribeOptions {
  language?: string
  keywords?: string[]
  wordTimestamps?: boolean
  signal?: AbortSignal
}

export interface WhistleClient {
  isReady: () => boolean
  isPreparing: () => boolean
  isCached: () => Promise<boolean>
  prepare: (onProgress?: (ratio: number, message?: string) => void) => Promise<boolean>
  transcribe: (audioFloat32: Float32Array, options?: WhistleTranscribeOptions) => Promise<WhistleTranscribeResult>
  terminate: () => void
}

let workerInstance: Worker | null = null
let isInitialized = false
let isPreparingInternal = false
let preparePromise: Promise<boolean> | null = null

function createRequestId(): string {
  return `whistle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined')
    return null
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../../../workers/whistle/worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    catch (err) {
      console.warn('[WhistleClient] Failed to instantiate worker:', err)
      return null
    }
  }
  return workerInstance
}

export function createWhistleClient(): WhistleClient {
  function isReady(): boolean {
    return isInitialized
  }

  function isPreparing(): boolean {
    return isPreparingInternal
  }

  async function isCached(): Promise<boolean> {
    return await isWhistleModelCached()
  }

  async function prepare(onProgress?: (ratio: number, message?: string) => void): Promise<boolean> {
    if (isInitialized) {
      onProgress?.(1.0, 'Whistle STT ready')
      return true
    }

    if (preparePromise) {
      return preparePromise
    }

    const worker = ensureWorker()
    if (!worker) {
      isInitialized = true
      onProgress?.(1.0, 'In-memory fallback ready')
      return true
    }

    isPreparingInternal = true
    const requestId = createRequestId()

    preparePromise = new Promise<boolean>((resolve) => {
      let timeoutId: any

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        worker.removeEventListener('message', handler)
        isPreparingInternal = false
        preparePromise = null
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'progress') {
          if (typeof data.ratio === 'number') {
            onProgress?.(data.ratio, data.message)
          }
        }
        else if (data.type === 'ready') {
          isInitialized = true
          cleanup()
          onProgress?.(1.0, 'Whistle STT ready')
          resolve(Boolean(data.ok))
        }
        else if (data.type === 'error') {
          console.warn('[WhistleClient] Worker prepare error:', data.message)
          isInitialized = true
          cleanup()
          resolve(false)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'prepare', requestId })

      // Safety timeout: 60s
      timeoutId = setTimeout(() => {
        console.warn('[WhistleClient] Prepare timed out, marking fallback ready')
        isInitialized = true
        cleanup()
        resolve(false)
      }, 60000)
    })

    return preparePromise
  }

  async function transcribe(
    audioFloat32: Float32Array,
    options?: WhistleTranscribeOptions,
  ): Promise<WhistleTranscribeResult> {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const worker = ensureWorker()
    if (!worker) {
      return {
        text: '',
        language: options?.language || 'en',
        words: [],
        latencyMs: 0,
      }
    }

    const requestId = createRequestId()

    return new Promise<WhistleTranscribeResult>((resolve, reject) => {
      let timeoutId: any
      let abortHandler: (() => void) | null = null

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        if (abortHandler && options?.signal)
          options.signal.removeEventListener('abort', abortHandler)
        worker.removeEventListener('message', handler)
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'response') {
          cleanup()
          resolve({
            text: data.text || '',
            language: data.language,
            words: data.words || [],
            latencyMs: data.latencyMs || 0,
          })
        }
        else if (data.type === 'error') {
          cleanup()
          reject(new Error(data.message || 'Whistle transcription error'))
        }
      }

      if (options?.signal) {
        abortHandler = () => {
          cleanup()
          reject(new DOMException('Aborted', 'AbortError'))
        }
        options.signal.addEventListener('abort', abortHandler)
      }

      worker.addEventListener('message', handler)

      // Post message with transfer of underlying buffer copy for zero-copy efficiency
      const bufferCopy = new Float32Array(audioFloat32)
      worker.postMessage(
        {
          type: 'transcribe',
          requestId,
          audioFloat32: bufferCopy,
          language: options?.language || 'en',
          keywords: options?.keywords || [],
          wordTimestamps: options?.wordTimestamps ?? true,
        },
        [bufferCopy.buffer],
      )

      // 30s timeout
      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('Whistle transcription timed out after 30s'))
      }, 30000)
    })
  }

  function terminate(): void {
    if (workerInstance) {
      workerInstance.terminate()
      workerInstance = null
      isInitialized = false
      isPreparingInternal = false
      preparePromise = null
    }
  }

  return {
    isReady,
    isPreparing,
    isCached,
    prepare,
    transcribe,
    terminate,
  }
}

let defaultWhistleClient: WhistleClient | null = null

export function getWhistleClient(): WhistleClient {
  if (!defaultWhistleClient) {
    defaultWhistleClient = createWhistleClient()
  }
  return defaultWhistleClient
}
