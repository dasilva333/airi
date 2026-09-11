/**
 * Local Moondream2 VLM inference adapter.
 *
 * Coordinates loading and execution of local Moondream2 model using GpuWorkerHost.
 */

import type { ProgressPayload } from '../protocol'

import { defineInvoke, defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { defaultPerfTracer } from '@proj-airi/stage-shared'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { MODEL_NAMES, TIMEOUTS } from '../constants'
import { consumeLoadStream, moondreamLoadEvent, moondreamProcessEvent, moondreamUnloadEvent, signalWithTimeout } from '../contract'
import { MODEL_VRAM_ESTIMATES } from '../coordinator'
import { GPU_PRIORITY } from '../gpu-executor'
import { createGpuWorkerHost } from '../gpu-worker-host'
import { InferenceAbortError, throwIfAborted } from '../protocol'

export interface LocalMoondreamAdapter {
  /** Load local Moondream model */
  load: (
    onProgress?: (p: ProgressPayload) => void,
    options?: { signal?: AbortSignal },
  ) => Promise<void>

  /** Process an image with prompt */
  generateText: (
    imageUrl: string,
    prompt?: string,
    options?: {
      signal?: AbortSignal
    },
  ) => Promise<string>

  /** Terminate the worker */
  terminate: () => void

  /** State string */
  readonly state: 'idle' | 'loading' | 'ready' | 'processing' | 'error' | 'terminated'

  /** Observed WebGPU device losses */
  readonly deviceLossCount: number
}

const LOAD_TIMEOUT = TIMEOUTS.LOCAL_VLM_LOAD
const PROCESS_TIMEOUT = TIMEOUTS.LOCAL_VLM_PROCESS

function createMoondreamRpc(worker: Worker) {
  const { context } = createContext(worker)
  return {
    load: defineStreamInvoke(context, moondreamLoadEvent),
    process: defineInvoke(context, moondreamProcessEvent),
    unload: defineInvoke(context, moondreamUnloadEvent),
  }
}

type MoondreamRpc = ReturnType<typeof createMoondreamRpc>

export function createLocalMoondreamAdapter(): LocalMoondreamAdapter {
  const host = createGpuWorkerHost<MoondreamRpc>({
    modelId: MODEL_NAMES.MOONDREAM,
    createWorker: () => new Worker(
      new URL('../../../workers/moondream/worker.ts', import.meta.url),
      { type: 'module' },
    ),
    createRpc: createMoondreamRpc,
    onTerminate: () => removeInferenceStatus(MODEL_NAMES.MOONDREAM),
  })

  async function load(
    onProgress?: (p: ProgressPayload) => void,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const requestedDevice = host.promoteDevice('webgpu')
    throwIfAborted(options?.signal)

    return host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      host.setPhase('loading')
      updateInferenceStatus(MODEL_NAMES.MOONDREAM, { state: 'downloading', device: requestedDevice as any })

      return host.runOnGpu(MODEL_NAMES.MOONDREAM, GPU_PRIORITY.MOONDREAM_LOAD, options?.signal, async ({ crashSignal }) => {
        throwIfAborted(options?.signal)
        const rpc = host.ensure()

        const hfToken = typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || undefined : undefined

        const stream = rpc.load(
          { device: requestedDevice, hfToken },
          { signal: AbortSignal.any([signalWithTimeout(options?.signal, LOAD_TIMEOUT), crashSignal]) },
        )

        let info
        try {
          info = await consumeLoadStream(stream, (progress) => {
            updateInferenceStatus(MODEL_NAMES.MOONDREAM, { progress })
            onProgress?.(progress)
          }).catch((error) => {
            if (options?.signal?.aborted)
              throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
            throw error
          })
        }
        catch (error) {
          host.setPhase('error')
          updateInferenceStatus(MODEL_NAMES.MOONDREAM, { state: 'error' })
          throw error
        }

        const estimate = MODEL_VRAM_ESTIMATES[MODEL_NAMES.MOONDREAM] ?? 700 * 1024 * 1024
        host.allocate(MODEL_NAMES.MOONDREAM, estimate)
        host.setPhase('ready')
        updateInferenceStatus(MODEL_NAMES.MOONDREAM, { state: 'ready', device: info.device as any })
        host.recordSuccess()
      })
    }).catch((error) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function generateText(
    imageUrl: string,
    prompt?: string,
    options?: {
      signal?: AbortSignal
    },
  ): Promise<string> {
    throwIfAborted(options?.signal)
    const notReadyError = new Error('Local Moondream2 model not loaded. Call load() first.')

    return defaultPerfTracer.withMeasure('inference', 'moondream-process', () => host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      if (!host.rpc || host.phase !== 'ready')
        throw notReadyError

      host.touch()
      host.setPhase('busy')

      let result
      try {
        result = await host.runOnGpu(MODEL_NAMES.MOONDREAM, GPU_PRIORITY.MOONDREAM_PROCESS, options?.signal, ({ crashSignal }) => host.rpc!.process(
          {
            imageUrl,
            prompt,
          },
          { signal: AbortSignal.any([signalWithTimeout(options?.signal, PROCESS_TIMEOUT), crashSignal]) },
        ))
      }
      catch (error) {
        if (options?.signal?.aborted) {
          host.setPhase('ready')
          throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
        }
        throw error
      }

      host.setPhase('ready')
      host.recordSuccess()
      return result.text
    })).catch((error) => {
      if (error === notReadyError || (error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  return {
    load,
    generateText,
    terminate: host.terminate,
    get state() { return host.phase === 'busy' ? 'processing' : host.phase },
    get deviceLossCount() { return host.deviceLossCount },
  }
}

let sharedMoondreamAdapter: LocalMoondreamAdapter | null = null

export function getMoondreamAdapter(): LocalMoondreamAdapter {
  if (!sharedMoondreamAdapter)
    sharedMoondreamAdapter = createLocalMoondreamAdapter()
  return sharedMoondreamAdapter
}
