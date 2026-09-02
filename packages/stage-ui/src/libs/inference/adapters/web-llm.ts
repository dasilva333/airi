/**
 * WebLLM (`@mlc-ai/web-llm`) WebGPU transformer inference adapter.
 *
 * Talks to the web-llm worker over the Eventa inference contract
 * (`libs/inference/contract.ts`): load and generate are both server-streaming
 * invokes. Worker lifecycle, the shared GPU slot, and device-loss resilience
 * are delegated to {@link createGpuWorkerHost} — so WebLLM generation is
 * scheduled against TTS/ASR/web-rwkv on the one GPU (it outranks STT, yields to
 * TTS; see {@link GPU_PRIORITY}).
 *
 * WebLLM is WebGPU-only (no WASM/CPU chat backend), so — unlike kokoro/whisper —
 * this adapter never promotes to `wasm` on device loss; the host simply restarts
 * the worker and retries on WebGPU.
 *
 * VRAM bookkeeping uses the model's real `vram_required_MB` from the MLC
 * prebuilt catalog (passed in per load) rather than a flat estimate, so the
 * GPU resource coordinator's memory-pressure accounting reflects the actual
 * resident model.
 */

import type { WebLlmGenerateRequest } from '../../../workers/web-llm/contract'
import type { ProgressPayload } from '../protocol'

import { defineStreamInvoke } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers'
import { defaultPerfTracer } from '@proj-airi/stage-shared'
import { Mutex } from 'async-mutex'

import { removeInferenceStatus, updateInferenceStatus } from '../../../composables/use-inference-status'
import { MODEL_NAMES, TIMEOUTS } from '../constants'
import { consumeLoadStream, createIdleTimeout, signalWithTimeout, webLlmGenerateEvent, webLlmLoadEvent } from '../contract'
import { MODEL_VRAM_ESTIMATES } from '../coordinator'
import { GPU_PRIORITY } from '../gpu-executor'
import { createGpuWorkerHost } from '../gpu-worker-host'
import { InferenceAbortError, InferenceTimeoutError, throwIfAborted } from '../protocol'

/** Which model to load; mirrors the worker's `WebLlmLoadRequest` minus device. */
export interface WebLlmLoadTarget {
  /** MLC `model_id` (curated) or custom id when `modelUrl` is set. */
  modelId: string
  /** Custom HF weights URL. Omit for curated `modelId`s. */
  modelUrl?: string
  /** Custom `model_lib` WASM URL. Required when `modelUrl` is set. */
  modelLib?: string
  /** Estimated VRAM (MB) for pre-allocation bookkeeping; defaults to the floor. */
  vramMB?: number
}

/** Options for {@link WebLlmAdapter.generate}. */
export interface WebLlmGenerateOptions {
  /** Called with each decoded text delta as it streams. */
  onToken?: (text: string) => void
  /** Cancel generation; the promise rejects with `InferenceAbortError`. */
  signal?: AbortSignal
}

export interface WebLlmAdapter {
  /**
   * Load a WebLLM model (curated `model_id`, or a custom HF repo + WASM lib).
   * Streams download/compile progress to `options.onProgress`.
   */
  loadModel: (
    target: WebLlmLoadTarget,
    options?: { onProgress?: (p: ProgressPayload) => void, signal?: AbortSignal },
  ) => Promise<void>

  /**
   * Generate a chat completion for the loaded model, streaming text deltas to
   * `options.onToken` and resolving with the full concatenated text. Reloads the
   * worker-side model first if the request targets a different model than the
   * one currently resident.
   */
  generate: (request: WebLlmGenerateRequest, options?: WebLlmGenerateOptions) => Promise<string>

  /** Terminate the worker (frees the GPUDevice). */
  terminate: () => void

  /** Current state. */
  readonly state: 'idle' | 'loading' | 'ready' | 'running' | 'error' | 'terminated'

  /** The model id currently loaded in the worker, or null. */
  readonly manifest: { modelId: string } | null

  /** Number of WebGPU device-loss events observed by this adapter. */
  readonly deviceLossCount: number
}

const LOAD_TIMEOUT = TIMEOUTS.WEB_LLM_LOAD
const GENERATE_FIRST_CHUNK_TIMEOUT = TIMEOUTS.WEB_LLM_GENERATE_FIRST_CHUNK
const GENERATE_IDLE_TIMEOUT = TIMEOUTS.WEB_LLM_GENERATE_IDLE

/** Bind the Eventa invoke clients to a freshly created worker (both streaming). */
function createWebLlmRpc(worker: Worker) {
  const { context } = createContext(worker)
  return {
    load: defineStreamInvoke(context, webLlmLoadEvent),
    generate: defineStreamInvoke(context, webLlmGenerateEvent),
  }
}

type WebLlmRpc = ReturnType<typeof createWebLlmRpc>

export function createWebLlmAdapter(): WebLlmAdapter {
  let lastManifest: { modelId: string } | null = null
  // The last successful load target, replayed by generate()'s load-on-demand
  // guard after a crash/restart left the worker bare.
  let lastLoadTarget: WebLlmLoadTarget | null = null

  const host = createGpuWorkerHost<WebLlmRpc>({
    modelId: MODEL_NAMES.WEB_LLM,
    createWorker: () => new Worker(
      new URL('../../../workers/web-llm/worker.ts', import.meta.url),
      { type: 'module' },
    ),
    createRpc: createWebLlmRpc,
    onTerminate: () => {
      removeInferenceStatus(MODEL_NAMES.WEB_LLM)
    },
  })

  async function loadModel(
    target: WebLlmLoadTarget,
    options?: { onProgress?: (p: ProgressPayload) => void, signal?: AbortSignal },
  ): Promise<void> {
    throwIfAborted(options?.signal)

    return defaultPerfTracer.withMeasure('inference', 'web-llm-load-model', () => host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      host.setPhase('loading')
      console.info('[web-llm] loading model', { modelId: target.modelId, custom: !!target.modelUrl })
      updateInferenceStatus(MODEL_NAMES.WEB_LLM, { state: 'downloading', device: 'webgpu' })

      const rpc = host.ensure()

      return host.runOnGpu(MODEL_NAMES.WEB_LLM, GPU_PRIORITY.LLM_LOAD, options?.signal, async ({ crashSignal }) => {
        throwIfAborted(options?.signal)

        const hfToken = typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || undefined : undefined
        const stream = rpc.load(
          {
            device: 'webgpu',
            modelId: target.modelId,
            modelUrl: target.modelUrl,
            modelLib: target.modelLib,
            vramMB: target.vramMB,
            hfToken,
          },
          { signal: AbortSignal.any([signalWithTimeout(options?.signal, LOAD_TIMEOUT), crashSignal]) },
        )

        await consumeLoadStream(stream, (progress) => {
          updateInferenceStatus(MODEL_NAMES.WEB_LLM, { progress })
          options?.onProgress?.(progress)
        }).catch((error) => {
          if (options?.signal?.aborted)
            throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
          throw error
        })

        // Record the real resident VRAM for the loaded model so the coordinator's
        // pressure accounting is accurate (the catalog value, not the floor).
        const bytes = Math.round((target.vramMB ?? (MODEL_VRAM_ESTIMATES[MODEL_NAMES.WEB_LLM] / 1024 / 1024)) * 1024 * 1024)
        host.allocate(MODEL_NAMES.WEB_LLM, bytes)
        lastManifest = { modelId: target.modelId }
        lastLoadTarget = target

        host.setPhase('ready')
        console.info('[web-llm] model loaded', { modelId: target.modelId })
        updateInferenceStatus(MODEL_NAMES.WEB_LLM, { state: 'ready', device: 'webgpu' })
        host.recordSuccess()
      })
    })).catch((error) => {
      if ((error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  async function generate(request: WebLlmGenerateRequest, options?: WebLlmGenerateOptions): Promise<string> {
    throwIfAborted(options?.signal)

    // Load-on-demand recovery: a crash/restart respawns a bare worker ('idle').
    // Replay the last load before generating. Done before runExclusive — loadModel
    // takes the same host mutex, so calling it inside would deadlock. Also reload
    // when the request targets a different model than the one currently resident
    // (the worker owns one engine = one model at a time).
    if (lastLoadTarget && (host.phase === 'idle' || lastManifest?.modelId !== request.modelId))
      await loadModel(lastLoadTarget, { signal: options?.signal })

    const notReadyError = new Error('web-llm: model not loaded. Call loadModel() first.')

    return defaultPerfTracer.withMeasure('inference', 'web-llm-generate', () => host.runExclusive(async () => {
      throwIfAborted(options?.signal)
      if (!host.rpc || host.phase !== 'ready')
        throw notReadyError

      host.touch()
      host.setPhase('busy')
      console.info('[web-llm] inference starting', { modelId: request.modelId, messages: request.messages })

      let text = ''
      // Two-tier inactivity timeout: a generous first-token budget (prefill of the
      // full chat history) then a tighter inter-token gap once decoding is flowing.
      const idle = createIdleTimeout(GENERATE_FIRST_CHUNK_TIMEOUT, GENERATE_IDLE_TIMEOUT)
      try {
        await host.runOnGpu(MODEL_NAMES.WEB_LLM, GPU_PRIORITY.LLM_GENERATE, options?.signal, async ({ slot, crashSignal }) => {
          const signals = [idle.signal, crashSignal]
          if (options?.signal)
            signals.push(options.signal)
          const stream = host.rpc!.generate(
            request,
            { signal: AbortSignal.any(signals) },
          )
          for await (const chunk of stream) {
            idle.reset()
            text += chunk.text
            options?.onToken?.(chunk.text)
            // Cooperative preemption point between tokens — lets a higher-priority
            // unit (e.g. a TTS generate) take the GPU mid-stream.
            await slot.yield()
          }
        })
      }
      catch (error) {
        // Caller cancellation is request-level: restore 'ready' and surface
        // AbortError (the outer catch exempts it from restart logic).
        if (options?.signal?.aborted) {
          host.setPhase('ready')
          throw new InferenceAbortError(typeof options.signal.reason === 'string' ? options.signal.reason : undefined)
        }
        // Inactivity timeout: worker wedged → TimeoutError routes through restart.
        if (idle.signal.aborted)
          throw idle.signal.reason instanceof Error ? idle.signal.reason : new InferenceTimeoutError()
        throw error
      }
      finally {
        idle.clear()
      }

      host.setPhase('ready')
      console.info('[web-llm] inference done', { chars: text.length })
      host.recordSuccess()
      return text
    }), { promptMessages: request.messages.length }).catch((error) => {
      // notReadyError and caller cancellation are request-level — don't tear the
      // worker down or trigger restart logic.
      if (error === notReadyError || (error as Error)?.name === 'AbortError')
        throw error
      host.handleWorkerError(error instanceof Error ? error : new Error(String(error)))
      throw error
    })
  }

  return {
    loadModel,
    generate,
    terminate: () => host.terminate(),
    get state() { return host.phase === 'busy' ? 'running' : host.phase },
    get manifest() { return lastManifest },
    get deviceLossCount() { return host.deviceLossCount },
  }
}

let globalAdapter: WebLlmAdapter | null = null
const singletonMutex = new Mutex()

/**
 * Get the global WebLLM adapter instance. Creates the worker on first use and
 * re-creates the adapter if it has entered a terminal state, mirroring
 * {@link getWebRwkvAdapter} / {@link getKokoroAdapter}.
 */
export async function getWebLlmAdapter(): Promise<WebLlmAdapter> {
  return singletonMutex.runExclusive(async () => {
    if (
      !globalAdapter
      || globalAdapter.state === 'terminated'
      || globalAdapter.state === 'error'
    ) {
      globalAdapter?.terminate()
      globalAdapter = createWebLlmAdapter()
    }
    return globalAdapter
  })
}
