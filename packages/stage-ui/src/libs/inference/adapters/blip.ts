/**
 * Local Vision (BLIP / WD14) inference adapter.
 *
 * Coordinates loading and execution of local vision models using GpuWorkerHost.
 */

import type { ProgressPayload } from '../protocol'

import { defineInvoke, defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { defaultPerfTracer } from '@proj-airi/stage-shared'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { MODEL_NAMES, TIMEOUTS } from '../constants'
import { blipLoadEvent, blipProcessEvent, blipUnloadEvent, consumeLoadStream, signalWithTimeout } from '../contract'
import { MODEL_VRAM_ESTIMATES } from '../coordinator'
import { GPU_PRIORITY } from '../gpu-executor'
import { createGpuWorkerHost } from '../gpu-worker-host'
import { InferenceAbortError, throwIfAborted } from '../protocol'

export interface LocalVisionAdapter {
  /** Load local vision model */
  load: (
    modelId?: string,
    onProgress?: (p: ProgressPayload) => void,
    options?: { signal?: AbortSignal },
  ) => Promise<void>

  /** Caption an image (url, canvas data URL, or base64) */
  captionImage: (
    imageUrl: string,
    options?: {
      generalThreshold?: number
      characterThreshold?: number
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

const LOAD_TIMEOUT = TIMEOUTS.LOCAL_VISION_LOAD
const PROCESS_TIMEOUT = TIMEOUTS.LOCAL_VISION_PROCESS

function createBlipRpc(worker: Worker) {
  const { context } = createContext(worker)
  return {
    load: defineStreamInvoke(context, blipLoadEvent),
    process: defineInvoke(context, blipProcessEvent),
    unload: defineInvoke(context, blipUnloadEvent),
  }
}

type BlipRpc = ReturnType<typeof createBlipRpc>

export function createLocalVisionAdapter(): LocalVisionAdapter {
  const host = createGpuWorkerHost<BlipRpc>({
    modelId: MODEL_NAMES.BLIP,
    createWorker: () => new Worker(
      new URL('../../../workers/blip/worker.ts', import.meta.url),
      { type: 'module' },
    ),
    createRpc: createBlipRpc,
    onTerminate: () => removeInferenceStatus(MODEL_NAMES.BLIP),
  })

  async function load(
    modelId?: string,
    onProgress?: (p: ProgressPayload) => void,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    const requestedDevice = host.promoteDevice('webgpu')
    throwIfAborted(options?.signal)

    return host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      host.setPhase('loading')
      updateInferenceStatus(MODEL_NAMES.BLIP, { state: 'downloading', device: requestedDevice as any })

      return host.runOnGpu(MODEL_NAMES.BLIP, GPU_PRIORITY.BLIP_LOAD, options?.signal, async ({ crashSignal }) => {
        throwIfAborted(options?.signal)
        const rpc = host.ensure()

        const hfToken = typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || undefined : undefined

        const stream = rpc.load(
          { device: requestedDevice, model: modelId, hfToken },
          { signal: AbortSignal.any([signalWithTimeout(options?.signal, LOAD_TIMEOUT), crashSignal]) },
        )

        let info
        try {
          info = await consumeLoadStream(stream, (progress) => {
            updateInferenceStatus(MODEL_NAMES.BLIP, { progress })
            onProgress?.(progress)
          }).catch((error: unknown) => {
            if (options?.signal?.aborted)
              throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
            throw error
          })
        }
        catch (error) {
          host.setPhase('error')
          updateInferenceStatus(MODEL_NAMES.BLIP, { state: 'error' })
          throw error
        }

        // Allocate memory estimate
        const estimate = modelId?.toLowerCase().includes('blip2')
          ? 2000 * 1024 * 1024 // ~2 GB for BLIP-2
          : MODEL_VRAM_ESTIMATES[MODEL_NAMES.BLIP] ?? 400 * 1024 * 1024

        host.allocate(MODEL_NAMES.BLIP, estimate)
        host.setPhase('ready')
        updateInferenceStatus(MODEL_NAMES.BLIP, { state: 'ready', device: info.device as any })
        host.recordSuccess()
      })
    }).catch((error: unknown) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function captionImage(
    imageUrl: string,
    options?: {
      generalThreshold?: number
      characterThreshold?: number
      signal?: AbortSignal
    },
  ): Promise<string> {
    throwIfAborted(options?.signal)
    const notReadyError = new Error('Local vision model not loaded. Call load() first.')

    return defaultPerfTracer.withMeasure('inference', 'blip-process', () => host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      if (!host.rpc || host.phase !== 'ready')
        throw notReadyError

      host.touch()
      host.setPhase('busy')

      let result
      try {
        result = await host.runOnGpu(MODEL_NAMES.BLIP, GPU_PRIORITY.BLIP_PROCESS, options?.signal, ({ crashSignal }) => host.rpc!.process(
          {
            imageUrl,
            generalThreshold: options?.generalThreshold,
            characterThreshold: options?.characterThreshold,
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
    })).catch((error: unknown) => {
      if (error === notReadyError || (error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  return {
    load,
    captionImage,
    terminate: host.terminate,
    get state() { return host.phase === 'busy' ? 'processing' : host.phase },
    get deviceLossCount() { return host.deviceLossCount },
  }
}
