/**
 * Ming 3.0 TTS inference adapter.
 * Handles the Web Worker lifecycle and direct postMessage RPC routing.
 *
 * Single-threaded-first: AIRI ships no COOP/COEP isolation headers, so
 * `crossOriginIsolated` is false and the loader always lands on a
 * `web-single*` build. Threaded builds additionally need the compute-pool
 * spawn protocol, which is not wired — thread counts above 1 are stored and
 * applied once isolation lands. See docs/analysis-ming3-tts-viability.md.
 */

import type { ProgressPayload } from '../protocol'

import { Mutex } from 'async-mutex'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { encodeMing3Wav, sanitizeMing3InputText } from '../../../stores/providers/ming3-audio-utils'
import {
  getMingDesignVoice,
  isMingDesignVoiceId,
  MING3_BUNDLE_BASE,
  MING3_MODEL_ID,
} from '../../../stores/providers/ming3-catalog'
import { evictOtherMing3Models, formatBytes } from '../cache-utils'
import { MODEL_NAMES } from '../constants'

export interface Ming3Adapter {
  loadModel: (options?: {
    model?: string
    threads?: number | 'auto'
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }) => Promise<void>
  generate: (
    text: string,
    voiceId: string,
    options: {
      preset?: string
      threads?: number | 'auto'
      signal?: AbortSignal
      /** Called with each streamed PCM chunk (44.1 kHz mono) as it arrives. */
      onAudioChunk?: (samples: Float32Array<ArrayBuffer>) => void
      /**
       * Unsaved draft design prompt. Used by the "try this draft" flow so a
       * description can be auditioned without persisting a voice record.
       */
      designPrompt?: string
    },
  ) => Promise<ArrayBuffer>
  stop: () => void
  terminate: () => void
  readonly state: 'idle' | 'loading' | 'ready' | 'running' | 'error' | 'terminated'
  readonly build: string | null
  readonly activeThreads: number | null
  readonly lastRunStats: Ming3RunStats | null
}

export interface Ming3RunStats {
  audioSeconds: number
  generationMs: number
  firstAudioMs: number | null
  rtf: number
  frames: number
  stopped: boolean
  networkRequests: number
  build: string | null
  threads: number | null
}

interface PendingLoad {
  resolve: (info: { voices: unknown, threads: number, build: string, partHashes: string[], ms: number }) => void
  reject: (err: Error) => void
  onProgress?: (p: ProgressPayload) => void
}

interface PendingGenerate {
  resolve: (result: { wav: ArrayBuffer, stats: Ming3RunStats }) => void
  reject: (err: Error) => void
  chunks: Float32Array<ArrayBuffer>[]
  firstAudioAt: number | null
  frames: number
  t0: number
  onAudioChunk?: (samples: Float32Array<ArrayBuffer>) => void
}

export function resolveMing3Threads(threads?: number | 'auto'): number {
  if (typeof threads === 'number' && threads > 0)
    return Math.min(32, Math.floor(threads))
  const hw = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4
  return Math.min(8, Math.max(1, hw - 2))
}

export function createMing3Adapter(): Ming3Adapter {
  let worker: Worker | null = null
  let state: Ming3Adapter['state'] = 'idle'
  let build: string | null = null
  let activeThreads: number | null = null
  let lastRunStats: Ming3RunStats | null = null
  let lastLoadParams: { model: string, threads: number } | null = null
  let pendingLoad: PendingLoad | null = null
  let pendingGenerate: PendingGenerate | null = null
  const mutex = new Mutex()

  const modelStatusId = MODEL_NAMES.MING3

  /**
   * Compute-thread pool for threaded WASM builds. Direct port of the demo's
   * page-side spawner: the runtime glue asks the host for workers via a
   * `fusor-ai-spawn-compute` message (it cannot spawn them itself from inside
   * the bundled engine worker), the host creates them from the supplied URL,
   * and the pool is torn down with the engine.
   */
  const computePool: { workers: Worker[] } = { workers: [] }

  function terminateComputePool() {
    for (const w of computePool.workers) {
      try {
        w.terminate()
      }
      catch {
        // Already gone; nothing to do.
      }
    }
    computePool.workers = []
  }

  function spawnComputeWorker(index: number, req: {
    url: string
    module: unknown
    memory: unknown
    receiver: unknown
    mainJS: string
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      let ready = false
      let w: Worker
      try {
        w = new Worker(req.url, { type: 'module', name: `ming3-compute-${index}` })
      }
      catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
        return
      }
      computePool.workers.push(w)
      w.onmessage = ({ data }: MessageEvent) => {
        if (data?.type === 'fusor-ai-rayon-ready') {
          ready = true
          resolve()
        }
        else if (data?.type === 'fusor-ai-rayon-error') {
          reject(new Error(data.message || 'Compute thread failed to initialize.'))
        }
      }
      w.onerror = (event) => {
        const message = event instanceof ErrorEvent && event.message ? event.message : 'A compute thread failed.'
        if (ready)
          console.warn('[Ming3 Adapter] Compute thread error after ready:', message)
        else
          reject(new Error(message))
      }
      // SharedArrayBuffer-backed memory and the compiled module are shared by
      // structured clone (not transferred) so every thread sees the same heap.
      w.postMessage({
        type: 'fusor-ai-rayon-init',
        module: req.module,
        memory: req.memory,
        receiver: req.receiver,
        mainJS: req.mainJS,
      })
    })
  }

  async function handleSpawnCompute(data: {
    url: string
    count: number
    module: unknown
    memory: unknown
    receiver: unknown
    mainJS: string
    port: MessagePort
  }): Promise<void> {
    try {
      terminateComputePool()
      const starters = Array.from({ length: data.count }, (_, i) => spawnComputeWorker(i, data))
      await Promise.all(starters)
      data.port.postMessage({ ready: true })
    }
    catch (error) {
      terminateComputePool()
      try {
        data.port.postMessage({ ready: false, error: error instanceof Error ? error.message : String(error) })
      }
      catch {
        // Port already closed; the loader's fallback path takes over.
      }
    }
  }

  function ensureWorker(): Worker {
    if (!worker) {
      worker = new Worker(
        new URL('../../../workers/ming3/worker.ts', import.meta.url),
        { type: 'module' },
      )
      worker.addEventListener('message', onWorkerMessage)
      worker.addEventListener('error', () => {
        const load = pendingLoad
        pendingLoad = null
        load?.reject(new Error('Ming engine worker failed to start.'))
        const gen = pendingGenerate
        pendingGenerate = null
        gen?.reject(new Error('Ming engine worker failed during synthesis.'))
        if (state !== 'terminated') {
          state = 'error'
          updateInferenceStatus(modelStatusId, { state: 'error' })
        }
      })
    }
    return worker
  }

  function onWorkerMessage({ data }: MessageEvent) {
    if (!data || typeof data.type !== 'string')
      return
    switch (data.type) {
      case 'progress': {
        const percent = data.total ? Math.round((data.done / data.total) * 100) : 0
        const fromCache = data.cache > 0 && !data.network
        const message = data.network && data.cache
          ? `${formatBytes(data.network)} downloaded, ${formatBytes(data.cache)} cached`
          : fromCache
            ? 'from this device'
            : 'downloading'
        pendingLoad?.onProgress?.({
          phase: 'download',
          percent,
          message,
          loaded: data.done,
          total: data.total,
        })
        updateInferenceStatus(modelStatusId, {
          progress: { phase: 'download', percent, message },
        })
        break
      }
      case 'build': {
        build = data.build
        break
      }
      case 'warning': {
        console.warn('[Ming3 Adapter]', data.message ?? data)
        break
      }
      case 'fusor-ai-spawn-compute': {
        // The runtime glue (inside the engine worker) cannot spawn its own
        // compute threads from the bundled context — the host does it here.
        void handleSpawnCompute(data)
        break
      }
      case 'ready': {
        const load = pendingLoad
        pendingLoad = null
        if (load) {
          activeThreads = data.threads
          load.resolve({
            voices: data.voices,
            threads: data.threads,
            build: build ?? 'unknown',
            partHashes: Array.isArray(data.partHashes) ? data.partHashes : [],
            ms: data.ms,
          })
        }
        break
      }
      case 'audio': {
        if (pendingGenerate) {
          if (pendingGenerate.firstAudioAt === null)
            pendingGenerate.firstAudioAt = performance.now()
          const samples = new Float32Array(data.samples)
          pendingGenerate.chunks.push(samples)
          try {
            pendingGenerate.onAudioChunk?.(samples)
          }
          catch (error) {
            console.warn('[Ming3 Adapter] onAudioChunk handler failed:', error)
          }
        }
        break
      }
      case 'frame': {
        if (pendingGenerate)
          pendingGenerate.frames++
        break
      }
      case 'plan':
        break
      case 'done': {
        const gen = pendingGenerate
        pendingGenerate = null
        if (gen) {
          const totalSamples = gen.chunks.reduce((n, c) => n + c.length, 0)
          const out = new Float32Array(totalSamples)
          let offset = 0
          for (const chunk of gen.chunks) {
            out.set(chunk, offset)
            offset += chunk.length
          }
          const audioSeconds = out.length / 44100
          const stats: Ming3RunStats = {
            audioSeconds,
            generationMs: data.ms,
            firstAudioMs: gen.firstAudioAt !== null ? gen.firstAudioAt - gen.t0 : null,
            rtf: audioSeconds > 0 ? (data.ms / 1000) / audioSeconds : 0,
            frames: gen.frames,
            stopped: !!data.stopped,
            networkRequests: data.networkRequests ?? 0,
            build,
            threads: activeThreads,
          }
          lastRunStats = stats
          gen.resolve({ wav: encodeMing3Wav(out), stats })
        }
        state = 'ready'
        updateInferenceStatus(modelStatusId, { state: 'ready' })
        break
      }
      case 'error': {
        const load = pendingLoad
        pendingLoad = null
        load?.reject(new Error(data.message || 'Ming engine error.'))
        const gen = pendingGenerate
        pendingGenerate = null
        gen?.reject(new Error(data.message || 'Ming synthesis error.'))
        state = 'error'
        updateInferenceStatus(modelStatusId, { state: 'error' })
        break
      }
    }
  }

  async function doLoadModel(options?: {
    model?: string
    threads?: number | 'auto'
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }): Promise<void> {
    const model = options?.model || MING3_MODEL_ID
    const threads = resolveMing3Threads(options?.threads ?? 'auto')

    if (state === 'ready' && lastLoadParams && lastLoadParams.model === model && lastLoadParams.threads === threads)
      return

    if (worker) {
      worker.terminate()
      worker = null
    }
    // A fresh engine needs a fresh pool: stale compute threads hold the old
    // shared memory and would never be reaped otherwise.
    terminateComputePool()

    state = 'loading'
    updateInferenceStatus(modelStatusId, {
      state: 'downloading',
      device: 'wasm',
      progress: { phase: 'download', percent: 0 },
    })

    const w = ensureWorker()

    await new Promise<void>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      const onAbort = () => {
        const load = pendingLoad
        pendingLoad = null
        load?.reject(new DOMException('Aborted', 'AbortError'))
      }
      options?.signal?.addEventListener('abort', onAbort, { once: true })
      pendingLoad = {
        resolve: (info) => {
          options?.signal?.removeEventListener('abort', onAbort)
          state = 'ready'
          // Compare requested-vs-requested on the next call: storing the
          // actual (possibly fallen-back) thread count here would never match
          // a fresh requested value and would force a full runtime re-init on
          // every synthesis. Actual threads remain available via activeThreads.
          lastLoadParams = { model, threads }
          updateInferenceStatus(modelStatusId, { state: 'ready', device: 'wasm' })
          // Single active bundle in OPFS: evict parts that do not belong to
          // the just-loaded manifest (mix vs future profiles).
          void evictOtherMing3Models(info.partHashes)
          resolve()
        },
        reject: (err) => {
          options?.signal?.removeEventListener('abort', onAbort)
          state = 'error'
          updateInferenceStatus(modelStatusId, { state: 'error' })
          reject(err)
        },
        onProgress: options?.onProgress,
      }
      w.postMessage({ type: 'load', modelUrl: MING3_BUNDLE_BASE, threads })
    })
  }

  async function loadModel(options?: {
    model?: string
    threads?: number | 'auto'
    onProgress?: (p: ProgressPayload) => void
    signal?: AbortSignal
  }): Promise<void> {
    const release = await mutex.acquire()
    try {
      await doLoadModel(options)
    }
    catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        state = 'error'
        updateInferenceStatus(modelStatusId, { state: 'error' })
      }
      throw err
    }
    finally {
      release()
    }
  }

  async function generate(
    text: string,
    voiceId: string,
    options: {
      preset?: string
      threads?: number | 'auto'
      signal?: AbortSignal
      onAudioChunk?: (samples: Float32Array<ArrayBuffer>) => void
      designPrompt?: string
    },
  ): Promise<ArrayBuffer> {
    const release = await mutex.acquire()
    try {
      const input = sanitizeMing3InputText(text)
      if (!input)
        return new ArrayBuffer(0)
      if (!voiceId && !options.designPrompt?.trim())
        throw new Error('Voice parameter is required')

      if (state !== 'ready')
        await doLoadModel({ threads: options.threads })

      // Resolve design voices to their stored prompt; built-ins pass through.
      // An explicit draft prompt (unsaved "try this draft" flow) wins over lookup.
      let voice: { builtin: string } | { design: string }
      if (options.designPrompt && options.designPrompt.trim()) {
        voice = { design: options.designPrompt.trim() }
      }
      else if (isMingDesignVoiceId(voiceId)) {
        const design = await getMingDesignVoice(voiceId)
        if (!design)
          throw new Error(`Voice design not found: ${voiceId}`)
        voice = { design: design.designPrompt }
      }
      else {
        voice = { builtin: voiceId }
      }

      state = 'running'
      updateInferenceStatus(modelStatusId, { state: 'running' })

      const w = ensureWorker()
      const result = await new Promise<{ wav: ArrayBuffer, stats: Ming3RunStats }>((resolve, reject) => {
        const onAbort = () => {
          w.postMessage({ type: 'stop' })
          const gen = pendingGenerate
          pendingGenerate = null
          gen?.reject(new DOMException('Aborted', 'AbortError'))
        }
        if (options?.signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }
        options?.signal?.addEventListener('abort', onAbort, { once: true })
        pendingGenerate = {
          resolve: (r) => {
            options?.signal?.removeEventListener('abort', onAbort)
            resolve(r)
          },
          reject: (err) => {
            options?.signal?.removeEventListener('abort', onAbort)
            reject(err)
          },
          chunks: [],
          firstAudioAt: null,
          frames: 0,
          t0: performance.now(),
          onAudioChunk: options.onAudioChunk,
        }
        w.postMessage({
          type: 'generate',
          request: { text: input, voice, preset: options.preset || 'quality' },
        })
      })

      return result.wav
    }
    finally {
      if (state === 'running') {
        state = 'ready'
        updateInferenceStatus(modelStatusId, { state: 'ready' })
      }
      release()
    }
  }

  function stop() {
    worker?.postMessage({ type: 'stop' })
  }

  function terminate() {
    removeInferenceStatus(modelStatusId)
    terminateComputePool()
    if (worker) {
      worker.terminate()
      worker = null
    }
    pendingLoad = null
    pendingGenerate = null
    lastLoadParams = null
    state = 'idle'
  }

  return {
    loadModel,
    generate,
    stop,
    terminate,
    get state() { return state },
    get build() { return build },
    get activeThreads() { return activeThreads },
    get lastRunStats() { return lastRunStats },
  }
}
