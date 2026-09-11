/**
 * Voice Activity Detection (VAD) Web Worker.
 *
 * Runs the Xenova/Silero-VAD model inference off the main thread.
 * Uses the unified inference protocol from protocol.ts.
 */

import type { PreTrainedModel } from '@huggingface/transformers'

import type {
  ErrorResponse,
  InferenceResultResponse,
  LoadModelRequest,
  ModelReadyResponse,
  ProgressResponse,
  RunInferenceRequest,
  WorkerInboundMessage,
} from '../../libs/inference/protocol'

import { AutoModel, env, Tensor } from '@huggingface/transformers'

import { classifyError, isRecoverable } from '../../libs/inference/protocol'

// ---------------------------------------------------------------------------
// Inference-specific input/output types
// ---------------------------------------------------------------------------

export interface VADInput {
  buffer: Float32Array
  sampleRate: number
}

export interface VADOutput {
  speechProb: number
}

// ---------------------------------------------------------------------------
// Model and State singletons
// ---------------------------------------------------------------------------

let model: PreTrainedModel | null = null
let state: Tensor | null = null
let sampleRateTensor: Tensor | null = null
let currentSampleRate: number = 16000

const MODEL_ID = 'onnx-community/silero-vad'

function sendProgress(requestId: string, percent: number, message?: string): void {
  const msg: ProgressResponse = {
    type: 'progress',
    requestId,
    payload: {
      phase: 'download',
      percent,
      message,
    },
  }
  globalThis.postMessage(msg)
}

function sendError(requestId: string, error: unknown, phase?: 'load' | 'inference'): void {
  const message = error instanceof Error ? error.message : String(error)
  const code = classifyError(error, phase)
  const msg: ErrorResponse = {
    type: 'error',
    requestId,
    payload: {
      code,
      message,
      recoverable: isRecoverable(code),
    },
  }
  globalThis.postMessage(msg)
}

// Cancellation tracking
const cancelledRequestIds = new Set<string>()

function markCancelled(targetRequestId: string): void {
  cancelledRequestIds.add(targetRequestId)
  const msg: ErrorResponse = {
    type: 'error',
    requestId: targetRequestId,
    payload: {
      code: 'CANCELLED',
      message: 'Operation cancelled by caller',
      recoverable: false,
    },
  }
  globalThis.postMessage(msg)
}

function isCancelled(requestId: string): boolean {
  return cancelledRequestIds.has(requestId)
}

function clearCancelled(requestId: string): void {
  cancelledRequestIds.delete(requestId)
}

/**
 * Detect whether WebGPU is available inside the worker.
 */
async function detectWebGPUInWorker(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.gpu)
      return false
    const adapter = await navigator.gpu.requestAdapter()
    return adapter != null
  }
  catch {
    return false
  }
}

let resolvedDevice: 'webgpu' | 'wasm' | 'cpu' = 'wasm' // Silero VAD usually runs beautifully on WASM/CPU due to low compute requirement

async function loadModel(request: LoadModelRequest): Promise<void> {
  const { requestId } = request

  try {
    if (model) {
      if (isCancelled(requestId)) {
        clearCancelled(requestId)
        return
      }
      const ready: ModelReadyResponse = {
        type: 'model-ready',
        requestId,
        modelId: MODEL_ID,
        device: resolvedDevice,
      }
      globalThis.postMessage(ready)
      return
    }

    let device = request.device ?? 'wasm'
    if (device === 'webgpu') {
      const hasWebGPU = await detectWebGPUInWorker()
      if (!hasWebGPU) {
        console.warn('[VAD Worker] WebGPU not available, falling back to WASM')
        device = 'wasm'
      }
    }
    resolvedDevice = device as 'webgpu' | 'wasm' | 'cpu'

    env.backends.onnx.logLevel = 'error'
    env.backends.onnx.wasm!.proxy = false

    // Initialize state tensors
    state = new Tensor('float32', new Float32Array(2 * 1 * 128), [2, 1, 128])
    sampleRateTensor = new Tensor('int64', [currentSampleRate], [])

    model = await AutoModel.from_pretrained(MODEL_ID, {
      device,
      config: { model_type: 'custom' } as any,
      dtype: 'fp32', // Use full precision for Silero VAD stability
      progress_callback: (progress: any) => {
        sendProgress(requestId, progress?.progress ?? -1, progress?.status)
      },
    })

    if (isCancelled(requestId)) {
      clearCancelled(requestId)
      return
    }

    const ready: ModelReadyResponse = {
      type: 'model-ready',
      requestId,
      modelId: MODEL_ID,
      device: resolvedDevice,
    }
    globalThis.postMessage(ready)
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'load')
  }
}

// ---------------------------------------------------------------------------
// Processing
// ---------------------------------------------------------------------------

async function runInference(request: RunInferenceRequest<VADInput>): Promise<void> {
  const { requestId, input } = request
  const { buffer, sampleRate } = input

  try {
    if (!model || !state || !sampleRateTensor) {
      throw new Error('Model not loaded. Send load-model first.')
    }

    // Dynamic sample rate update
    if (sampleRate !== currentSampleRate) {
      currentSampleRate = sampleRate
      sampleRateTensor = new Tensor('int64', [currentSampleRate], [])
    }

    const inputTensor = new Tensor('float32', buffer, [1, buffer.length])

    const { stateN, output } = await model({
      input: inputTensor,
      sr: sampleRateTensor,
      state,
    })

    // Update LSTM state
    state = stateN
    const speechProb = output.data[0]

    if (isCancelled(requestId)) {
      clearCancelled(requestId)
      return
    }

    const result: InferenceResultResponse<VADOutput> = {
      type: 'inference-result',
      requestId,
      output: { speechProb },
    }
    globalThis.postMessage(result)
  }
  catch (error) {
    if (isCancelled(requestId))
      clearCancelled(requestId)
    else
      sendError(requestId, error, 'inference')
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

globalThis.addEventListener('message', async (event: MessageEvent<WorkerInboundMessage<VADInput>>) => {
  const message = event.data

  switch (message.type) {
    case 'load-model':
      await loadModel(message)
      break
    case 'run-inference':
      await runInference(message as RunInferenceRequest<VADInput>)
      break
    case 'unload-model':
      model = null
      state = null
      sampleRateTensor = null
      globalThis.postMessage({ type: 'model-unloaded', requestId: message.requestId })
      break
    case 'cancel':
      markCancelled(message.targetRequestId)
      break
  }
})
