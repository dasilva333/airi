import { cacheKeyForModel } from '../../workers/web-rwkv/cache'

// The cache name used by transformers.js / ONNX runtime
const TRANSFORMERS_CACHE_NAME = 'transformers-cache'
const OPFS_DIR_NAME = 'web-rwkv'
const MOSS_OPFS_DIR_NAME = 'nano-reader-browser-model-store'
// WebLLM (`@mlc-ai/web-llm`) stores weights / WASM libs / model config in the
// browser Cache Storage API under these scoped cache names (its default
// `cacheBackend` is `"cache"`; see `createScopedArtifactCache` in the library).
const WEBLLM_CACHE_NAMES = ['webllm/model', 'webllm/wasm', 'webllm/config'] as const

async function getDirectorySizeRecursive(dirHandle: FileSystemDirectoryHandle): Promise<number> {
  let size = 0
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await (entry as FileSystemFileHandle).getFile()
      size += file.size
    }
    else if (entry.kind === 'directory') {
      size += await getDirectorySizeRecursive(entry as FileSystemDirectoryHandle)
    }
  }
  return size
}

async function getMossOpfsCacheSize(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return 0
  try {
    const root = await navigator.storage.getDirectory()
    let dir: FileSystemDirectoryHandle
    try {
      dir = await root.getDirectoryHandle(MOSS_OPFS_DIR_NAME, { create: false })
    }
    catch {
      return 0
    }
    return await getDirectorySizeRecursive(dir)
  }
  catch (error) {
    console.warn('[cache-utils] failed to get MOSS cache size', error)
    return 0
  }
}

async function clearMossOpfsCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return
  try {
    const root = await navigator.storage.getDirectory()
    try {
      await root.removeEntry(MOSS_OPFS_DIR_NAME, { recursive: true })
    }
    catch {
      // Ignored if directory doesn't exist
    }
  }
  catch (error) {
    console.warn('[cache-utils] failed to clear MOSS cache', error)
  }
}

async function isMossModelCached(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return false
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(MOSS_OPFS_DIR_NAME, { create: false })
    for await (const _entry of dir.values()) {
      return true // directory is not empty
    }
    return false
  }
  catch {
    return false
  }
}

async function getOpfsCacheSize(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return 0
  try {
    const root = await navigator.storage.getDirectory()
    let dir: FileSystemDirectoryHandle
    try {
      dir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: false })
    }
    catch {
      return 0
    }
    let totalSize = 0
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const file = await (entry as FileSystemFileHandle).getFile()
        totalSize += file.size
      }
    }
    return totalSize
  }
  catch (error) {
    console.warn('[cache-utils] failed to get OPFS cache size', error)
    return 0
  }
}

async function clearOpfsCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return
  try {
    const root = await navigator.storage.getDirectory()
    try {
      await root.removeEntry(OPFS_DIR_NAME, { recursive: true })
    }
    catch {
      // Ignored if directory doesn't exist
    }
  }
  catch (error) {
    console.warn('[cache-utils] failed to clear OPFS cache', error)
  }
}

async function clearSingleOpfsModelCache(modelUrl: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: false })
    const key = await cacheKeyForModel(modelUrl)
    const fileName = `${key}.f16cache`
    await dir.removeEntry(fileName)
  }
  catch (error) {
    console.warn('[cache-utils] failed to delete OPFS model entry', modelUrl, error)
  }
}

async function isOpfsModelCached(modelUrl: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory)
    return false
  try {
    const root = await navigator.storage.getDirectory()
    let dir: FileSystemDirectoryHandle
    try {
      dir = await root.getDirectoryHandle(OPFS_DIR_NAME, { create: false })
    }
    catch {
      return false
    }
    const key = await cacheKeyForModel(modelUrl)
    const fileName = `${key}.f16cache`
    try {
      await dir.getFileHandle(fileName, { create: false })
      return true
    }
    catch {
      return false
    }
  }
  catch {
    return false
  }
}

/**
 * Get the total size of cached model files in bytes.
 * Returns 0 if the Cache API is unavailable or the cache is empty.
 */
export async function getModelCacheSize(): Promise<number> {
  const transformersSize = await getTransformersCacheSize()
  const opfsSize = await getOpfsCacheSize()
  const mossSize = await getMossOpfsCacheSize()
  const webLlmSize = await getWebLlmCacheSize()
  return transformersSize + opfsSize + mossSize + webLlmSize
}

async function getTransformersCacheSize(): Promise<number> {
  if (typeof caches === 'undefined')
    return 0

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()

    let totalSize = 0
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        // Content-Length header if available
        const cl = response.headers.get('content-length')
        if (cl) {
          totalSize += Number.parseInt(cl, 10)
        }
        else {
          // Fallback: read the body to measure size
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
    }

    return totalSize
  }
  catch {
    return 0
  }
}

/**
 * Clear all cached model files.
 */
export async function clearModelCache(): Promise<void> {
  await clearTransformersCache()
  await clearOpfsCache()
  await clearMossOpfsCache()
  await clearWebLlmCache()
}

/**
 * Clear a specific model from cache by ID.
 */
export async function clearSingleModelCache(modelId: string): Promise<void> {
  if (modelId === 'moss-tts-nano') {
    await clearMossOpfsCache()
    return
  }
  if (modelId === 'web-llm') {
    await clearWebLlmCache()
    return
  }
  if (modelId.startsWith('http')) {
    await clearSingleOpfsModelCache(modelId)
    return
  }
  await clearSingleTransformersModelCache(modelId)
}

async function clearTransformersCache(): Promise<void> {
  if (typeof caches === 'undefined')
    return

  try {
    await caches.delete(TRANSFORMERS_CACHE_NAME)
  }
  catch {
    // Silently ignore if cache doesn't exist
  }
}

async function clearSingleTransformersModelCache(modelId: string): Promise<void> {
  if (typeof caches === 'undefined')
    return

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    for (const request of keys) {
      if (request.url.includes(modelId)) {
        await cache.delete(request)
      }
    }
  }
  catch (error) {
    console.warn('[cache-utils] failed to delete transformers cache entry', modelId, error)
  }
}

/**
 * Evict all cached Whisper model shards except the specified model repository ID.
 * Ensures that only a single active Whisper model shard is retained in browser storage.
 */
export async function evictOtherWhisperModels(keepModelId: string): Promise<void> {
  if (typeof caches === 'undefined')
    return

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    for (const request of keys) {
      if (request.url.includes('whisper') && !request.url.includes(keepModelId)) {
        await cache.delete(request)
      }
    }
  }
  catch (error) {
    console.warn('[cache-utils] failed to evict other whisper model shards', error)
  }
}

// ---------------------------------------------------------------------------
// WebLLM (Cache Storage API, `webllm/*` scopes)
// ---------------------------------------------------------------------------

/** Sum the byte size of every response across all `webllm/*` cache scopes. */
export async function getWebLlmCacheSize(): Promise<number> {
  if (typeof caches === 'undefined')
    return 0

  let totalSize = 0
  for (const name of WEBLLM_CACHE_NAMES) {
    try {
      const has = await caches.has(name)
      if (!has)
        continue
      const cache = await caches.open(name)
      const keys = await cache.keys()
      for (const request of keys) {
        const response = await cache.match(request)
        if (!response)
          continue
        // Content-Length header if available, else read the body to measure.
        const cl = response.headers.get('content-length')
        if (cl) {
          totalSize += Number.parseInt(cl, 10)
        }
        else {
          const blob = await response.blob()
          totalSize += blob.size
        }
      }
    }
    catch (error) {
      console.warn('[cache-utils] failed to measure WebLLM cache scope', name, error)
    }
  }
  return totalSize
}

/** Delete all `webllm/*` cache scopes (weights, WASM libs, and model config). */
export async function clearWebLlmCache(): Promise<void> {
  for (const name of WEBLLM_CACHE_NAMES) {
    if (typeof caches !== 'undefined') {
      try {
        await caches.delete(name)
      }
      catch (error) {
        console.warn('[cache-utils] failed to clear WebLLM Cache scope', name, error)
      }
    }
    if (typeof indexedDB !== 'undefined') {
      try {
        indexedDB.deleteDatabase(name)
      }
      catch (error) {
        console.warn('[cache-utils] failed to delete WebLLM IndexedDB database', name, error)
      }
    }
  }
}

/**
 * Check whether any WebLLM model is cached (any entry in any `webllm/*` scope).
 * When `modelId` is provided, matches entries whose request URL contains it;
 * otherwise returns true if any scope holds anything at all.
 */
export async function isWebLlmModelCached(modelId?: string): Promise<boolean> {
  for (const name of WEBLLM_CACHE_NAMES) {
    if (typeof caches !== 'undefined') {
      try {
        const has = await caches.has(name)
        if (has) {
          const cache = await caches.open(name)
          const keys = await cache.keys()
          if (!modelId && keys.length > 0)
            return true
          if (modelId && keys.some(request => request.url.includes(modelId)))
            return true
        }
      }
      catch {
        // Ignore Cache API failure
      }
    }

    if (typeof indexedDB !== 'undefined') {
      try {
        let exists = true
        if (typeof indexedDB.databases === 'function') {
          const dbs = await indexedDB.databases()
          exists = dbs.some(d => d.name === name)
        }
        if (exists) {
          const req = indexedDB.open(name)
          const db = await new Promise<IDBDatabase | null>((resolve) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => resolve(null)
          })
          if (db) {
            if (db.objectStoreNames.contains('urls')) {
              const count = await new Promise<number>((resolve) => {
                const tx = db.transaction('urls', 'readonly')
                const store = tx.objectStore('urls')
                const cntReq = store.count()
                cntReq.onsuccess = () => resolve(cntReq.result)
                cntReq.onerror = () => resolve(0)
              })
              db.close()
              if (count > 0)
                return true
            }
            else {
              // Stub database created without object stores; clean it up
              db.close()
              indexedDB.deleteDatabase(name)
            }
          }
        }
      }
      catch {
        // Ignore IndexedDB failure
      }
    }
  }
  return false
}

/**
 * Check whether a specific model has cached files.
 * Matches by looking for cache entries whose URL contains the model ID.
 */
export async function isModelCached(modelId: string): Promise<boolean> {
  if (modelId === 'moss-tts-nano') {
    return isMossModelCached()
  }
  if (modelId === 'web-llm') {
    return isWebLlmModelCached()
  }
  if (modelId.startsWith('http')) {
    return isOpfsModelCached(modelId)
  }
  return isTransformersModelCached(modelId)
}

async function isTransformersModelCached(modelId: string): Promise<boolean> {
  if (typeof caches === 'undefined')
    return false

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    return keys.some(request => request.url.includes(modelId))
  }
  catch {
    return false
  }
}

/**
 * Format bytes into a human-readable string (e.g. "512 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / k ** i

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}
