import type { ProgressPayload } from '../protocol'

import { defineInvoke, defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { errorMessageFrom } from '@moeru/std'
import { Mutex } from 'async-mutex'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { MODEL_NAMES, TIMEOUTS } from '../constants'
import { consumeLoadStream, layaDecideEvent, layaLoadEvent, layaUnloadEvent, signalWithTimeout } from '../contract'
import { MODEL_VRAM_ESTIMATES } from '../coordinator'
import { GPU_PRIORITY } from '../gpu-executor'
import { createGpuWorkerHost } from '../gpu-worker-host'
import { InferenceAbortError, InferenceTimeoutError, throwIfAborted } from '../protocol'

export type LayaPrecision = 'int8' | 'fp16'

export interface LayaDecideOptions {
  signal?: AbortSignal
  useWebGpu?: boolean
}

export interface LayaAdapter {
  load: (
    precision?: LayaPrecision,
    options?: { signal?: AbortSignal, useWebGpu?: boolean, onProgress?: (p: ProgressPayload) => void, force?: boolean },
  ) => Promise<void>
  decide: (
    state: string | Record<string, unknown>,
    questions: Record<string, any>,
    precision?: LayaPrecision,
    options?: LayaDecideOptions,
  ) => Promise<{ model: string, answers: Record<string, any>, usage: { input_tokens: number, output_tokens: number }, latency_ms: number }>
  unload: () => Promise<void>
  terminate: () => void
  readonly state: 'idle' | 'loading' | 'ready' | 'busy' | 'error' | 'terminated'
  readonly manifest: { precision: LayaPrecision, device: string } | null
  readonly deviceLossCount: number
}

function createLayaRpc(worker: Worker) {
  const { context } = createContext(worker)
  return {
    load: defineStreamInvoke(context, layaLoadEvent),
    decide: defineInvoke(context, layaDecideEvent),
    unload: defineInvoke(context, layaUnloadEvent),
  }
}

type LayaRpc = ReturnType<typeof createLayaRpc>

export function createLayaAdapter(workerUrl?: string | URL): LayaAdapter {
  let lastManifest: { precision: LayaPrecision, device: string } | null = null
  let lastLoadConfig: { precision: LayaPrecision, useWebGpu: boolean } | null = null

  const host = createGpuWorkerHost<LayaRpc>({
    modelId: () => lastManifest ? `laya-${lastManifest.precision}` : MODEL_NAMES.LAYA,
    createWorker: () => workerUrl != null
      ? new Worker(workerUrl, { type: 'module' })
      : new Worker(new URL('../../../workers/laya/worker.ts', import.meta.url), { type: 'module' }),
    createRpc: createLayaRpc,
    onTerminate: () => {
      removeInferenceStatus(MODEL_NAMES.LAYA)
    },
  })

  function estimateFor(precision: LayaPrecision): number {
    return MODEL_VRAM_ESTIMATES[`laya-${precision}`] ?? 500 * 1024 * 1024
  }

  async function load(
    precision: LayaPrecision = 'int8',
    options?: { signal?: AbortSignal, useWebGpu?: boolean, onProgress?: (p: ProgressPayload) => void, force?: boolean },
  ): Promise<void> {
    const useWebGpu = options?.useWebGpu ?? false
    if (options?.force)
      lastManifest = null
    if (lastManifest && lastManifest.precision === precision && !options?.force)
      return
    throwIfAborted(options?.signal)
    return host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      host.setPhase('loading')
      updateInferenceStatus(MODEL_NAMES.LAYA, { state: 'downloading', device: (useWebGpu ? 'webgpu' : 'wasm') as any })
      const rpc = options?.force ? host.reset() : host.ensure()
      return host.runOnGpu(MODEL_NAMES.LAYA, GPU_PRIORITY.LAYA_LOAD, options?.signal, async ({ crashSignal }) => {
        throwIfAborted(options?.signal)
        const stream = rpc.load(
          { device: useWebGpu ? 'webgpu' : 'wasm', dtype: precision, model: precision === 'fp16' ? 'tozp/laya-onnx-fp16' : 'tozp/laya-onnx' },
          { signal: AbortSignal.any([signalWithTimeout(options?.signal, TIMEOUTS.LAYA_LOAD), crashSignal]) },
        )
        try {
          const info = await consumeLoadStream(stream, (p) => {
            updateInferenceStatus(MODEL_NAMES.LAYA, { progress: p })
            options?.onProgress?.(p)
          }).catch((error) => {
            if (options?.signal?.aborted)
              throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
            throw error
          })
          host.allocate(MODEL_NAMES.LAYA, estimateFor(precision))
          lastManifest = { precision, device: info.device }
          lastLoadConfig = { precision, useWebGpu }
          host.setPhase('ready')
          updateInferenceStatus(MODEL_NAMES.LAYA, { state: 'ready', device: info.device as any })
          host.recordSuccess()
        }
        catch (error) {
          host.setPhase('error')
          updateInferenceStatus(MODEL_NAMES.LAYA, { state: 'error' })
          throw error
        }
      })
    }).catch((error) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      const msg = errorMessageFrom(error) ?? ''
      const isTimeout = msg.includes('timed out') || msg.includes('TimeoutError') || (error as Error)?.name === 'TimeoutError'
      if (isTimeout) {
        const timeoutError = new InferenceTimeoutError(
          `Laya model load timed out after ${TIMEOUTS.LAYA_LOAD}ms. Model compilation or download took too long.`,
        )
        host.handleWorkerError(timeoutError)
        throw timeoutError
      }
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function decide(
    state: string | Record<string, unknown>,
    questions: Record<string, any>,
    precision: LayaPrecision = 'int8',
    options?: LayaDecideOptions,
  ) {
    throwIfAborted(options?.signal)
    if (host.phase === 'idle' && lastLoadConfig) {
      await load(lastLoadConfig.precision, { signal: options?.signal, useWebGpu: lastLoadConfig.useWebGpu })
    }
    else if (host.phase === 'idle' && !lastLoadConfig) {
      await load(precision, { signal: options?.signal, useWebGpu: options?.useWebGpu })
    }
    else if (lastManifest && lastManifest.precision !== precision) {
      await load(precision, { signal: options?.signal, useWebGpu: options?.useWebGpu, force: true })
    }

    return host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      if (!host.rpc || host.phase !== 'ready')
        throw new Error('Laya model not loaded. Call load() first.')
      host.touch()
      host.setPhase('busy')
      try {
        const result = await host.runOnGpu(MODEL_NAMES.LAYA, GPU_PRIORITY.LAYA_DECIDE, options?.signal, async ({ crashSignal }) => {
          const signals = [signalWithTimeout(options?.signal, TIMEOUTS.LAYA_DECIDE), crashSignal]
          if (options?.signal)
            signals.push(options.signal)
          return await host.rpc!.decide(
            { state: state as any, questions, precision: lastManifest?.precision ?? precision, useWebGpu: lastLoadConfig?.useWebGpu ?? options?.useWebGpu },
            { signal: AbortSignal.any(signals) },
          )
        })
        host.setPhase('ready')
        host.recordSuccess()
        return result
      }
      catch (error) {
        if (options?.signal?.aborted) {
          host.setPhase('ready')
          throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
        }
        host.setPhase('error')
        throw error
      }
    }).catch((error) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      const msg = errorMessageFrom(error) ?? ''
      const isTimeout = msg.includes('timed out') || msg.includes('TimeoutError') || (error as Error)?.name === 'TimeoutError'
      if (isTimeout) {
        const timeoutError = new InferenceTimeoutError(
          `Laya inference timed out after ${TIMEOUTS.LAYA_DECIDE}ms. The model worker may be overloaded or unresponsive.`,
        )
        host.handleWorkerError(timeoutError)
        throw timeoutError
      }
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function unload(): Promise<void> {
    try {
      await host.rpc?.unload(undefined as any).catch(() => {})
    }
    finally {
      await host.unloadWorker().catch(() => {})
      lastManifest = null
    }
  }

  return {
    load,
    decide,
    unload,
    terminate: host.terminate,
    get state() { return host.phase === 'busy' ? 'busy' : host.phase },
    get manifest() { return lastManifest },
    get deviceLossCount() { return host.deviceLossCount },
  }
}

let globalAdapter: LayaAdapter | null = null
const singletonMutex = new Mutex()

export async function getLayaAdapter(): Promise<LayaAdapter> {
  return singletonMutex.runExclusive(async () => {
    if (!globalAdapter || globalAdapter.state === 'terminated' || globalAdapter.state === 'error') {
      globalAdapter?.terminate()
      globalAdapter = createLayaAdapter()
    }
    return globalAdapter
  })
}
