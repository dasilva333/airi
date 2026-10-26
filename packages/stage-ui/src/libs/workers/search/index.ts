import type { SearchBackend } from './search-channel'

import searchWorkerUrl from './search.worker?worker&url'

import { updateInferenceStatus } from '../../../composables/use-inference-status'
import { GPU_PRIORITY } from '../../inference/gpu-executor'
import { createGpuWorkerHost } from '../../inference/gpu-worker-host'
import { resolveSearchBackend } from './search-channel'

const MODEL_ID = 'embeddinggemma-2'

/**
 * Raw multiplexed client bound to ONE worker instance. The host creates a
 * fresh one per spawn, so in-flight calls always address a live worker —
 * on crash-respawn the leader fails the orphaned map (see `failAll`) instead
 * of hanging callers on a dead port.
 */
interface WorkerClient extends SearchBackend {
  loadModel: () => Promise<any>
  unload: () => Promise<any>
  failAll: (error: Error) => void
}

function createWorkerClient(worker: Worker): WorkerClient {
  let nextId = 1
  const pending = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>()

  worker.addEventListener('message', (e) => {
    const { id, type, results, snapshot, count, error } = (e as MessageEvent).data
    const promise = pending.get(id)
    if (!promise)
      return

    if (type === 'error') {
      promise.reject(new Error(error))
    }
    else {
      switch (type) {
        case 'results':
          promise.resolve(results)
          break
        case 'snapshot':
          promise.resolve(snapshot)
          break
        case 'indexed':
          promise.resolve(count)
          break
        default:
          promise.resolve((e as MessageEvent).data)
      }
    }
    pending.delete(id)
  })

  // NOTICE: abortable worker RPC. ONNX embedding runs cannot be cancelled
  // mid-flight inside the worker, but the caller must stop waiting on timeout/
  // turn-cancel so orphan GPU work cannot pile up behind stale chat turns.
  function call(type: string, payload?: any, signal?: AbortSignal): Promise<any> {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')
    const id = nextId++
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        pending.delete(id)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      if (signal) {
        if (signal.aborted)
          return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }
      pending.set(id, {
        resolve: (val: any) => {
          signal?.removeEventListener('abort', onAbort)
          resolve(val)
        },
        reject: (err: any) => {
          signal?.removeEventListener('abort', onAbort)
          reject(err)
        },
      })
      worker.postMessage({ id, type, payload })
    })
  }

  return {
    init: (snapshot?: any) => call('init', { snapshot }),
    index: (documents: any[]) => call('index', { documents }),
    search: (query: string, limit?: number, characterId?: string, temporalHooks?: any[], signal?: AbortSignal, vector?: number[]) =>
      call('search', { query, limit, characterId, temporalHooks, vector }, signal),
    remove: (id: string) => call('remove', { id }),
    persist: (watermark?: number) => call('persist', { watermark }),
    loadModel: () => call('load-model'),
    unload: async () => {
      const res = await call('unload')
      // NOTICE: the worker dropped its embedder sessions — the next op must
      // reload weights even though this host stays alive.
      isModelLoaded = false
      return res
    },
    failAll: (error: Error) => {
      for (const promise of pending.values())
        promise.reject(error)
      pending.clear()
    },
  }
}

const host = createGpuWorkerHost<WorkerClient>({
  modelId: MODEL_ID,
  createWorker: () => new Worker(searchWorkerUrl, { type: 'module' }),
  createRpc: (worker: Worker) => createWorkerClient(worker),
})

let isModelLoaded = false
let isModelLoading = false
let modelLoadPromise: Promise<void> | null = null

// NOTICE: crash-respawn rehydration. The host silently swaps in a fresh,
// empty worker on restart — without replaying the last init snapshot every
// subsequent search would score against an empty index. The snapshot is the
// same one `layeredMemory.init()` already fetched from the shared IndexedDB,
// stashed here as it passes through; post-boot docs not yet persisted are
// re-indexed by the next background pass (their repos remain source of truth).
let lastInitSnapshot: any
let hydratedRpc: WorkerClient | null = null

async function ensureLeaderReady(): Promise<WorkerClient> {
  const rpc = host.ensure()
  if (rpc !== hydratedRpc) {
    const previous = hydratedRpc
    hydratedRpc = rpc
    previous?.failAll(new Error('[search] worker recycled; retrying on fresh worker'))
    // A respawned worker lost both model and index.
    isModelLoaded = false
    await rpc.init(lastInitSnapshot)
  }
  return rpc
}

/**
 * Explicitly load the embedding model enqueued via the LoadQueue.
 * Establishes WebGPU device context sequentially.
 */
async function loadEmbeddingModel(): Promise<void> {
  if (isModelLoaded)
    return

  if (isModelLoading && modelLoadPromise) {
    return modelLoadPromise
  }

  isModelLoading = true
  updateInferenceStatus(MODEL_ID, { state: 'downloading', device: 'webgpu' })

  modelLoadPromise = host.runExclusive(async () => {
    host.setPhase('loading')
    try {
      await host.runOnGpu(MODEL_ID, GPU_PRIORITY.BG_REMOVAL_LOAD + 1, undefined, async () => {
        const rpc = await ensureLeaderReady()
        await rpc.loadModel()

        // Track VRAM allocation (~185 MB footprint: 270M text backbone in q4)
        host.allocate(MODEL_ID, 185 * 1024 * 1024)
        host.setLoadManifest({ modelId: MODEL_ID })

        isModelLoaded = true
        host.setPhase('ready')
        updateInferenceStatus(MODEL_ID, { state: 'ready', device: 'webgpu' })
        host.recordSuccess()
      })
    }
    catch (error) {
      host.setPhase('error')
      updateInferenceStatus(MODEL_ID, { state: 'error' })
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
    finally {
      isModelLoading = false
      modelLoadPromise = null
    }
  })

  return modelLoadPromise
}

/**
 * Run a worker op serialized against other ops on this worker. Serialization
 * plus the host's activity touch is what arms the 15-minute idle TTL — every
 * index/search keeps the model warm, silence lets it unload.
 */
async function leaderCall<T>(fn: (rpc: WorkerClient) => Promise<T>): Promise<T> {
  return host.runExclusive(async () => {
    const rpc = await ensureLeaderReady()
    host.touch()
    return fn(rpc)
  })
}

const leaderBackend: SearchBackend = {
  init: async (snapshot?: any) => {
    lastInitSnapshot = snapshot
    return leaderCall(rpc => rpc.init(snapshot))
  },
  index: async (documents: any[]) => {
    await loadEmbeddingModel()
    return leaderCall(rpc => rpc.index(documents))
  },
  search: async (query: string, limit?: number, characterId?: string, temporalHooks?: any[], signal?: AbortSignal, vector?: number[]) => {
    await loadEmbeddingModel()
    return leaderCall(rpc => rpc.search(query, limit, characterId, temporalHooks, signal, vector))
  },
  remove: (id: string) => leaderCall(rpc => rpc.remove(id)),
  persist: (watermark?: number) => leaderCall(rpc => rpc.persist(watermark)),
}

let backendPromise: Promise<SearchBackend> | null = null

function backend(): Promise<SearchBackend> {
  if (!backendPromise) {
    // NOTICE: single election per window. Leader hosts the physical worker
    // (with TTL unload + crash recovery); secondaries proxy over
    // 'airi:inference:search' and never spawn a worker.
    backendPromise = resolveSearchBackend({ createLeaderBackend: () => leaderBackend })
  }
  return backendPromise
}

export const searchWorker: SearchBackend = {
  init: (snapshot?: any) => backend().then(b => b.init(snapshot)),
  index: (documents: any[]) => backend().then(b => b.index(documents)),
  search: (query: string, limit?: number, characterId?: string, temporalHooks?: any[], signal?: AbortSignal, vector?: number[]) =>
    backend().then(b => b.search(query, limit, characterId, temporalHooks, signal, vector)),
  remove: (id: string) => backend().then(b => b.remove(id)),
  persist: (watermark?: number) => backend().then(b => b.persist(watermark)),
}
