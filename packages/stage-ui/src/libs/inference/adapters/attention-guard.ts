/**
 * Attention Ecology Guard inference adapter.
 *
 * Main-thread bridge to the 0-cost cascading salience worker, following the
 * BLIP local-vision adapter pattern (createGpuWorkerHost + Eventa RPC, GPU
 * slot scheduling, device-loss -> WASM promotion, download-progress status).
 */

import type { AttentionGuardLoadRequest, AttentionGuardProcessResult } from '../contract'
import type { ProgressPayload } from '../protocol'

import { defineInvoke, defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { defaultPerfTracer } from '@proj-airi/stage-shared'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { MODEL_NAMES, TIMEOUTS } from '../constants'
import {
  attentionGuardLoadEvent,

  attentionGuardProcessEvent,

  attentionGuardUnloadEvent,
  consumeLoadStream,
  signalWithTimeout,
} from '../contract'
import { MODEL_VRAM_ESTIMATES } from '../coordinator'
import { GPU_PRIORITY } from '../gpu-executor'
import { createGpuWorkerHost } from '../gpu-worker-host'
import { InferenceAbortError, throwIfAborted } from '../protocol'

const LOAD_TIMEOUT = TIMEOUTS.ATTENTION_GUARD_LOAD
const PROCESS_TIMEOUT = TIMEOUTS.ATTENTION_GUARD_PROCESS

export interface AttentionGuardAdapter {
  /** Load the CLIP towers (and optionally prime Moondream2). */
  load: (
    options?: {
      enableVlm?: boolean
      modelId?: string
      onProgress?: (p: ProgressPayload) => void
      signal?: AbortSignal
    },
  ) => Promise<void>
  /** Run one capture tick through the cascaded gate. */
  process: (
    dataUrl: string,
    width: number,
    height: number,
    options?: { signal?: AbortSignal },
  ) => Promise<AttentionGuardProcessResult>
  /** Terminate the worker. */
  terminate: () => void
  readonly state: 'idle' | 'loading' | 'ready' | 'processing' | 'error' | 'terminated'
  readonly deviceLossCount: number
}

function createAttentionGuardRpc(worker: Worker) {
  const { context } = createContext(worker)
  return {
    load: defineStreamInvoke(context, attentionGuardLoadEvent),
    process: defineInvoke(context, attentionGuardProcessEvent),
    unload: defineInvoke(context, attentionGuardUnloadEvent),
  }
}

type AttentionGuardRpc = ReturnType<typeof createAttentionGuardRpc>

export function createAttentionGuardAdapter(): AttentionGuardAdapter {
  const host = createGpuWorkerHost<AttentionGuardRpc>({
    modelId: MODEL_NAMES.ATTENTION_GUARD,
    createWorker: () => new Worker(
      new URL('../../../workers/attention-guard/worker.ts', import.meta.url),
      { type: 'module' },
    ),
    createRpc: createAttentionGuardRpc,
    onTerminate: () => removeInferenceStatus(MODEL_NAMES.ATTENTION_GUARD),
  })

  async function load(options?: { enableVlm?: boolean, modelId?: string, onProgress?: (p: ProgressPayload) => void, signal?: AbortSignal }): Promise<void> {
    const requestedDevice = host.promoteDevice('webgpu')
    throwIfAborted(options?.signal)

    return host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      host.setPhase('loading')
      updateInferenceStatus(MODEL_NAMES.ATTENTION_GUARD, { state: 'downloading', device: requestedDevice as any })

      return host.runOnGpu(MODEL_NAMES.ATTENTION_GUARD, GPU_PRIORITY.ATTENTION_GUARD_LOAD, options?.signal, async ({ crashSignal }) => {
        throwIfAborted(options?.signal)
        const rpc = host.ensure()

        const hfToken = typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || undefined : undefined

        const request: AttentionGuardLoadRequest = {
          device: requestedDevice,
          model: options?.modelId,
          hfToken,
          enableVlm: options?.enableVlm ?? false,
        }

        const stream = rpc.load(request, { signal: AbortSignal.any([signalWithTimeout(options?.signal, LOAD_TIMEOUT), crashSignal]) })

        let info
        try {
          info = await consumeLoadStream(stream, (progress) => {
            updateInferenceStatus(MODEL_NAMES.ATTENTION_GUARD, { progress })
            options?.onProgress?.(progress)
          }).catch((error) => {
            if (options?.signal?.aborted)
              throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
            throw error
          })
        }
        catch (error) {
          host.setPhase('error')
          updateInferenceStatus(MODEL_NAMES.ATTENTION_GUARD, { state: 'error' })
          throw error
        }

        // CLIP towers always resident; Moondream2 (opt-in) is the heavy add.
        host.allocate(MODEL_NAMES.ATTENTION_GUARD, MODEL_VRAM_ESTIMATES['attention-guard-clip'] ?? 250 * 1024 * 1024)
        if (options?.enableVlm)
          host.allocate(MODEL_NAMES.ATTENTION_GUARD, MODEL_VRAM_ESTIMATES['attention-guard-vlm'] ?? 700 * 1024 * 1024)

        host.setPhase('ready')
        updateInferenceStatus(MODEL_NAMES.ATTENTION_GUARD, { state: 'ready', device: info.device as any })
        host.recordSuccess()
      })
    }).catch((error) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function process(
    dataUrl: string,
    width: number,
    height: number,
    options?: { signal?: AbortSignal },
  ): Promise<AttentionGuardProcessResult> {
    throwIfAborted(options?.signal)
    const notReadyError = new Error('Attention Ecology Guard not loaded. Call load() first.')

    return defaultPerfTracer.withMeasure('inference', 'attention-guard-process', () => host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      if (!host.rpc || host.phase !== 'ready')
        throw notReadyError

      host.touch()
      host.setPhase('busy')

      let result
      try {
        result = await host.runOnGpu(
          MODEL_NAMES.ATTENTION_GUARD,
          GPU_PRIORITY.ATTENTION_GUARD_PROCESS,
          options?.signal,
          ({ crashSignal }) => host.rpc!.process(
            { dataUrl, width, height },
            { signal: AbortSignal.any([signalWithTimeout(options?.signal, PROCESS_TIMEOUT), crashSignal]) },
          ),
        )
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
      return result
    })).catch((error) => {
      if (error === notReadyError || (error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  return {
    load,
    process,
    terminate: host.terminate,
    get state() { return host.phase === 'busy' ? 'processing' : host.phase },
    get deviceLossCount() { return host.deviceLossCount },
  }
}
