/**
 * Local Laya (System 1 Decision Engine) facade.
 *
 * Inference now runs in `workers/laya/worker.ts` behind
 * `adapters/laya.ts` (`createGpuWorkerHost`: TTL, LRU eviction, OOM
 * circuit-breaker; `worker.terminate()` reclaims the WASM SharedArrayBuffer).
 * This module keeps the historical exports (CacheStorage downloads, session
 * shims, `runLayaSystemOne`) so providers and settings UI keep working while
 * the main thread never imports `onnxruntime-web`.
 */

import type { LayaModelSpec, LayaPrecision } from './laya-models'

import { LAYA_CACHE_NAME } from './cache-utils'
import { evictStaleLayaEntries, LAYA_MODEL_SPECS, layaFileUrl, layaModelFiles, layaWeightsFile } from './laya-models'

export interface LayaDownloadProgress {
  file: string
  loaded: number
  total: number
  percentage: number
}

export interface LayaSessionOptions {
  useWebGpu?: boolean
}

async function cachedSize(response: Response): Promise<number> {
  const contentLength = Number(response.headers.get('content-length')) || 0
  if (contentLength > 0)
    return contentLength
  return (await response.clone().blob()).size
}

async function isFileComplete(cache: Cache, spec: LayaModelSpec, file: string): Promise<boolean> {
  const match = await cache.match(layaFileUrl(spec, file))
  if (!match)
    return false
  if (file !== layaWeightsFile(spec))
    return true
  return await cachedSize(match) >= spec.minWeightsBytes
}

export async function isLayaDownloaded(precision: LayaPrecision = 'int8'): Promise<boolean> {
  if (typeof caches === 'undefined')
    return false

  try {
    if (!await caches.has(LAYA_CACHE_NAME))
      return false
    const cache = await caches.open(LAYA_CACHE_NAME)
    const spec = LAYA_MODEL_SPECS[precision]
    for (const file of layaModelFiles(spec)) {
      if (!await isFileComplete(cache, spec, file))
        return false
    }
    return true
  }
  catch {
    return false
  }
}

export async function downloadLayaModel(options?: {
  precision?: LayaPrecision
  onProgress?: (progress: LayaDownloadProgress) => void
}): Promise<void> {
  if (typeof caches === 'undefined') {
    throw new TypeError('Cache Storage API is not supported in this environment.')
  }

  const spec = LAYA_MODEL_SPECS[options?.precision ?? 'int8']
  const cache = await caches.open(LAYA_CACHE_NAME)
  await evictStaleLayaEntries(cache)

  for (const fileName of layaModelFiles(spec)) {
    const fileUrl = layaFileUrl(spec, fileName)
    const cacheMatch = await cache.match(fileUrl)

    if (cacheMatch) {
      if (await isFileComplete(cache, spec, fileName)) {
        const size = await cachedSize(cacheMatch)
        options?.onProgress?.({ file: fileName, loaded: size, total: size, percentage: 100 })
        continue
      }
      console.warn(`[LayaEngine] Existing cache entry for ${fileName} is truncated. Evicting...`)
      await cache.delete(fileUrl)
    }

    const response = await fetch(fileUrl, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download ${fileName}: HTTP ${response.status} ${response.statusText}`)
    }

    const contentLength = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let receivedBytes = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      chunks.push(value)
      receivedBytes += value.length
      const percentage = contentLength > 0
        ? Math.min(100, Math.round((receivedBytes / contentLength) * 100))
        : 0

      options?.onProgress?.({ file: fileName, loaded: receivedBytes, total: contentLength, percentage })
    }

    if (contentLength > 0 && receivedBytes < contentLength) {
      throw new Error(`Download of ${fileName} was interrupted: received ${receivedBytes} of ${contentLength} bytes.`)
    }

    const fullBlob = new Blob(chunks as BlobPart[], { type: 'application/octet-stream' })
    const cachedResponse = new Response(fullBlob, {
      headers: {
        'content-length': String(receivedBytes),
        'content-type': 'application/octet-stream',
      },
    })
    await cache.put(fileUrl, cachedResponse)
  }
}

export async function deleteLayaModel(): Promise<void> {
  if (typeof caches !== 'undefined') {
    await caches.delete(LAYA_CACHE_NAME)
  }
}

// NOTICE: Historical main-thread ORT configurator. ORT is now configured
// inside the worker; kept as a no-op for import compatibility.
export function ensureOrtConfigured(): void {}

export async function withLayaSessionLock<T>(task: () => Promise<T>): Promise<T> {
  return task()
}

// Compatibility shim: ensures the worker model is loaded. No session object
// crosses threads; the worker owns it.
export async function loadLayaSession(
  precision: 'int8' | 'fp16' = 'int8',
  options?: LayaSessionOptions,
): Promise<void> {
  const { getLayaAdapter } = await import('./adapters/laya')
  const adapter = await getLayaAdapter()
  await adapter.load(precision, { useWebGpu: options?.useWebGpu })
}

export async function loadLayaTokenizer(): Promise<null> {
  return null
}

// Drops the worker session (frees WASM tensors); the host TTL + eviction
// then terminates the worker to reclaim the SharedArrayBuffer.
export async function resetLayaSession(): Promise<void> {
  const { getLayaAdapter } = await import('./adapters/laya')
  const adapter = await getLayaAdapter()
  await adapter.unload().catch(() => {})
}

export async function terminateLayaWorker(): Promise<void> {
  const { getLayaAdapter } = await import('./adapters/laya')
  const adapter = await getLayaAdapter()
  adapter.terminate()
}

export async function runLayaSystemOne(
  state: any,
  questions: Record<string, any>,
  precision: 'int8' | 'fp16' = 'int8',
  options?: LayaSessionOptions,
): Promise<{
  model: string
  answers: Record<string, any>
  usage: { input_tokens: number, output_tokens: number }
  latency_ms: number
}> {
  const qids = Object.keys(questions)
  if (qids.length === 0)
    throw new Error('runLayaSystemOne: at least one question is required')
  const { getLayaAdapter } = await import('./adapters/laya')
  const adapter = await getLayaAdapter()
  return adapter.decide(state, questions, precision, { useWebGpu: options?.useWebGpu })
}
