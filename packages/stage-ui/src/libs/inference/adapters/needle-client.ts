/**
 * Needle 3 inference client adapter.
 *
 * Provides a typed interface to the Needle 3 Web Worker:
 * - Cache status and manual pre-warming / preparation with progress reporting
 * - Task 2: Fast-path probe on user prompt at t = 0 racing against TTFT
 * - Task 3: Background extraction on streaming CoT reasoning buffer ahead of interval cadence
 */

import { isNeedleModelCached } from '../cache-utils'

export interface ExtractedMemoryFragments {
  mentions: string[]
  temporal_phrase: string | null
  claims: Array<{
    quote: string
    polarity: 'positive' | 'negative' | 'unknown'
    mode: 'asserted' | 'question' | 'plan' | 'hypothetical' | 'quoted' | 'fragment' | 'unknown'
    subject_span?: string
    predicate_span?: string
    object_span?: string
    time_span?: string
  }>
}

export interface NeedleClient {
  isReady: () => boolean
  isPreparing: () => boolean
  isCached: () => Promise<boolean>
  prepare: (onProgress?: (ratio: number) => void) => Promise<boolean>
  probeInitialReaction: (userPrompt: string, budgetMs?: number) => Promise<string | null>
  probeCotPivot: (reasoningSnippet: string, budgetMs?: number) => Promise<string | null>
  embed: (text: string, budgetMs?: number) => Promise<Float32Array | null>
  extractMemoryFragments: (passage: string, budgetMs?: number) => Promise<ExtractedMemoryFragments | null>
  terminate: () => void
}

let workerInstance: Worker | null = null
let isInitialized = false
let isPreparingInternal = false
let preparePromise: Promise<boolean> | null = null

function createRequestId(): string {
  return `needle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureWorker(): Worker | null {
  if (typeof Worker === 'undefined')
    return null
  if (!workerInstance) {
    try {
      workerInstance = new Worker(
        new URL('../../../workers/needle/worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    catch (err) {
      console.warn('[NeedleClient] Failed to instantiate worker:', err)
      return null
    }
  }
  return workerInstance
}

export function createNeedleClient(): NeedleClient {
  function isReady(): boolean {
    return isInitialized
  }

  function isPreparing(): boolean {
    return isPreparingInternal
  }

  async function isCached(): Promise<boolean> {
    return await isNeedleModelCached()
  }

  async function prepare(onProgress?: (ratio: number) => void): Promise<boolean> {
    if (isInitialized) {
      onProgress?.(1.0)
      return true
    }

    if (preparePromise) {
      return preparePromise
    }

    const worker = ensureWorker()
    if (!worker) {
      isInitialized = true
      onProgress?.(1.0)
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
            onProgress?.(data.ratio)
          }
        }
        else if (data.type === 'ready') {
          isInitialized = true
          cleanup()
          onProgress?.(1.0)
          resolve(Boolean(data.ok))
        }
        else if (data.type === 'error') {
          console.warn('[NeedleClient] Worker prepare error:', data.message)
          // Fallback to ready state so pacing doesn't stall
          isInitialized = true
          cleanup()
          resolve(false)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'prepare', requestId })

      // Safety timeout (e.g. 60s for download)
      timeoutId = setTimeout(() => {
        console.warn('[NeedleClient] Prepare timed out, marking fallback ready')
        isInitialized = true
        cleanup()
        resolve(false)
      }, 60000)
    })

    return preparePromise
  }

  async function probeInitialReaction(userPrompt: string, budgetMs: number = 1200): Promise<string | null> {
    if (!userPrompt || !userPrompt.trim())
      return null

    const worker = ensureWorker()
    if (!worker) {
      // In non-worker environments (e.g. tests), return immediate fallback candidate
      return 'Let me see...'
    }

    // Active inference bailout: If Needle is not prepared yet, do not kick off heavy 35MB download and WASM
    // compilation during an active streaming turn. Return null and let Tier 3 (heuristics/regex) handle it.
    if (!isInitialized) {
      return null
    }

    const requestId = createRequestId()

    return new Promise<string | null>((resolve) => {
      let timeoutId: any

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        worker.removeEventListener('message', handler)
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'response') {
          cleanup()
          resolve(data.text || null)
        }
        else if (data.type === 'error') {
          cleanup()
          resolve(null)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'probe_initial_reaction', requestId, prompt: userPrompt })

      timeoutId = setTimeout(() => {
        cleanup()
        resolve(null)
      }, budgetMs)
    })
  }

  async function probeCotPivot(reasoningSnippet: string, budgetMs: number = 2000): Promise<string | null> {
    if (!reasoningSnippet || reasoningSnippet.length < 15)
      return null

    const worker = ensureWorker()
    if (!worker) {
      return null
    }

    const requestId = createRequestId()

    return new Promise<string | null>((resolve) => {
      let timeoutId: any

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        worker.removeEventListener('message', handler)
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'response') {
          cleanup()
          resolve(data.text || null)
        }
        else if (data.type === 'error') {
          cleanup()
          resolve(null)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'probe_cot_pivot', requestId, snippet: reasoningSnippet })

      timeoutId = setTimeout(() => {
        cleanup()
        resolve(null)
      }, budgetMs)
    })
  }

  async function embed(text: string, budgetMs: number = 2000): Promise<Float32Array | null> {
    if (!text || !text.trim())
      return null

    const worker = ensureWorker()
    if (!worker) {
      return null
    }

    if (!isInitialized) {
      return null
    }

    const requestId = createRequestId()

    return new Promise<Float32Array | null>((resolve) => {
      let timeoutId: any

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        worker.removeEventListener('message', handler)
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'response') {
          cleanup()
          resolve(data.vector || null)
        }
        else if (data.type === 'error') {
          cleanup()
          resolve(null)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'embed', requestId, text })

      timeoutId = setTimeout(() => {
        cleanup()
        resolve(null)
      }, budgetMs)
    })
  }

  async function extractMemoryFragments(passage: string, budgetMs: number = 3000): Promise<ExtractedMemoryFragments | null> {
    if (!passage || !passage.trim())
      return null

    const worker = ensureWorker()
    if (!worker) {
      return null
    }

    if (!isInitialized) {
      return null
    }

    const requestId = createRequestId()

    return new Promise<ExtractedMemoryFragments | null>((resolve) => {
      let timeoutId: any

      const cleanup = () => {
        if (timeoutId)
          clearTimeout(timeoutId)
        worker.removeEventListener('message', handler)
      }

      const handler = (event: MessageEvent) => {
        const data = event.data || {}
        if (data.requestId !== requestId)
          return

        if (data.type === 'response') {
          cleanup()
          resolve(data.fragments || null)
        }
        else if (data.type === 'error') {
          cleanup()
          resolve(null)
        }
      }

      worker.addEventListener('message', handler)
      worker.postMessage({ type: 'extract_fragments', requestId, passage })

      timeoutId = setTimeout(() => {
        cleanup()
        resolve(null)
      }, budgetMs)
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
    probeInitialReaction,
    probeCotPivot,
    embed,
    extractMemoryFragments,
    terminate,
  }
}

export const needleClient = createNeedleClient()
