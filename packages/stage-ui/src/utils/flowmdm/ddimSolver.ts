import * as ort from 'onnxruntime-web'

import { alphasCumprod } from './constants'

// NOTICE: a direct onnxruntime-web import in the main thread gets no dev-server
// asset resolution for the runtime wasm. Vite answers the missing
// `ort-wasm-*.wasm` with index.html, so ORT dies with
// "Incorrect response MIME type. Expected 'application/wasm'" /
// "expected magic word ... found 3c 21 64 6f" (3c 21 64 6f = "<!do"). Pin the
// string form to the same CDN the search/whisper/attention-guard workers use.
if (ort.env?.wasm)
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'

let sessionPromise: Promise<ort.InferenceSession | null> | null = null

const MODEL_URL = 'https://huggingface.co/dasilva333/flowmdm-onnx/resolve/main/flow_mdm.onnx'
// Same Cache Storage bucket transformers.js writes to, so the model cache
// manager (and cross-session readiness checks) can see these weights.
const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

export type DenoiserProgress = (percentage: number, status: string) => void

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function openModelCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined')
    return null

  try {
    return await caches.open(TRANSFORMERS_CACHE_NAME)
  }
  catch {
    return null
  }
}

async function downloadModelBytes(onLog?: (msg: string) => void, onProgress?: DenoiserProgress): Promise<Uint8Array> {
  const response = await fetch(MODEL_URL)
  if (!response.ok)
    throw new Error(`HTTP ${response.status} while downloading the FlowMDM denoiser`)

  const total = Number(response.headers.get('content-length') || 0)

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    onProgress?.(100, `Downloaded FlowMDM denoiser (${formatMegabytes(bytes.byteLength)})`)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done)
      break

    chunks.push(value)
    received += value.byteLength

    const percentage = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0
    const sizeLabel = total > 0
      ? `${formatMegabytes(received)} / ${formatMegabytes(total)}`
      : formatMegabytes(received)
    onProgress?.(percentage, `Downloading FlowMDM denoiser (${sizeLabel})...`)
  }

  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  onLog?.(`FlowMDM denoiser downloaded (${formatMegabytes(received)}).`)
  return bytes
}

/**
 * Resolves the denoiser weights from Cache Storage, downloading and persisting
 * them on first use so "Pre-warmed & Cached" reflects real cached bytes.
 */
async function loadModelBytes(onLog?: (msg: string) => void, onProgress?: DenoiserProgress): Promise<Uint8Array> {
  const cache = await openModelCache()

  if (cache) {
    try {
      const hit = await cache.match(MODEL_URL)
      if (hit) {
        onLog?.('FlowMDM denoiser loaded from local cache.')
        onProgress?.(100, 'FlowMDM denoiser ready (cached)')
        return new Uint8Array(await hit.arrayBuffer())
      }
    }
    catch (err) {
      onLog?.(`[WARN] Denoiser cache lookup failed: ${errorMessage(err)}`)
    }
  }

  const bytes = await downloadModelBytes(onLog, onProgress)

  if (cache) {
    try {
      // `bytes` owns its full ArrayBuffer (offset 0), so the cast is safe and
      // avoids the Uint8Array<ArrayBufferLike> BodyInit typing mismatch.
      await cache.put(MODEL_URL, new Response(bytes.buffer as ArrayBuffer))
    }
    catch (err) {
      onLog?.(`[WARN] Could not persist the FlowMDM denoiser to cache: ${errorMessage(err)}`)
    }
  }

  return bytes
}

function createInferenceSession(
  model: string | Uint8Array,
  options: ort.InferenceSession.SessionOptions,
): Promise<ort.InferenceSession> {
  // Split by input type so each call resolves to a single overload.
  return typeof model === 'string'
    ? ort.InferenceSession.create(model, options)
    : ort.InferenceSession.create(model, options)
}

async function createSession(
  model: string | Uint8Array,
  onLog?: (msg: string) => void,
  onProgress?: DenoiserProgress,
): Promise<ort.InferenceSession> {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
    onLog?.('WebGPU detected. Attempting ONNX WebGPU execution provider...')
    onProgress?.(100, 'Compiling FlowMDM denoiser for WebGPU...')
    try {
      const session = await createInferenceSession(model, {
        executionProviders: ['webgpu'],
      })
      onLog?.('ONNX Inference Session initialized with WebGPU.')
      return session
    }
    catch (gpuErr) {
      onLog?.(`[WARN] WebGPU EP failed (${errorMessage(gpuErr)}). Retrying with WASM...`)
    }
  }

  onLog?.('Initializing ONNX Inference Session with WASM execution provider...')
  onProgress?.(100, 'Compiling FlowMDM denoiser for WASM...')
  const session = await createInferenceSession(model, {
    executionProviders: ['wasm'],
  })
  onLog?.('ONNX Inference Session initialized with WASM.')
  return session
}

export async function getDenoisingSession(
  onLog?: (msg: string) => void,
  onProgress?: DenoiserProgress,
): Promise<ort.InferenceSession | null> {
  if (sessionPromise)
    return sessionPromise

  sessionPromise = (async () => {
    onLog?.('Loading ONNX motion denoiser model (dasilva333/flowmdm-onnx)...')
    try {
      let model: string | Uint8Array = MODEL_URL
      try {
        model = await loadModelBytes(onLog, onProgress)
      }
      catch (err) {
        // Fall back to letting onnxruntime fetch the URL itself; this preserves
        // the previous behavior on environments without Cache Storage/fetch.
        onLog?.(`[WARN] Denoiser download failed (${errorMessage(err)}). Falling back to direct ONNX fetch...`)
      }

      const session = await createSession(model, onLog, onProgress)
      onProgress?.(100, 'FlowMDM denoiser ready')
      return session
    }
    catch (err) {
      onLog?.(`[WARN] ONNX model load failed: ${errorMessage(err)}`)
      sessionPromise = null
      return null
    }
  })()

  return sessionPromise
}

/** Whether the FlowMDM denoiser weights are present in Cache Storage. */
export async function isDenoisingModelCached(): Promise<boolean> {
  const cache = await openModelCache()
  if (!cache)
    return false

  try {
    return !!(await cache.match(MODEL_URL))
  }
  catch {
    return false
  }
}

export async function runDdimLoop(
  session: ort.InferenceSession | null,
  clipEmbedding: Float32Array,
  seqLen: number = 60,
  onLog?: (msg: string) => void,
): Promise<Float32Array> {
  if (!session)
    throw new Error('FlowMDM denoiser session is unavailable; motion was not generated.')

  const inputDim = 263

  // Initialize x from standard normal distribution N(0, 1)
  const x = new Float32Array(seqLen * 1 * inputDim)
  for (let i = 0; i < x.length; i++) {
    x[i] = Math.sqrt(-2.0 * Math.log(1.0 - Math.random())) * Math.cos(2.0 * Math.PI * Math.random())
  }

  const numSteps = 50
  onLog?.(`Starting ${numSteps}-step DDIM denoising loop...`)

  // Build 50 timesteps linearly spaced from 999 down to 0
  const timesteps: number[] = []
  for (let i = 0; i < numSteps; i++) {
    timesteps.push(Math.round(999 - i * (999 / (numSteps - 1))))
  }

  for (let step = 0; step < numSteps; step++) {
    const tVal = timesteps[step]
    const sVal = (step === numSteps - 1) ? 0 : timesteps[step + 1]

    const motionTensor = new ort.Tensor('float32', x, [1, inputDim, 1, seqLen])
    const timestepTensor = new ort.Tensor('int64', new BigInt64Array([BigInt(tVal)]), [1])
    const clipTensor = new ort.Tensor('float32', clipEmbedding, [1, 512])
    const scaleTensor = new ort.Tensor('float32', new Float32Array([2.5]), [1])

    const feeds: Record<string, ort.Tensor> = {
      noisy_motion: motionTensor,
      timestep: timestepTensor,
      clip_embedding: clipTensor,
      guidance_scale: scaleTensor,
    }

    const results = await session.run(feeds)
    const predXStart = results.denoised_motion.data as Float32Array

    // On the final step (step === numSteps - 1), tVal = 0 and sVal = 0.
    // Standard DDIM update equation collapses algebraically to x_s === x_t,
    // which incorrectly keeps the noise rather than committing the clean sample.
    // Directly commit predXStart as the terminal reconstruction.
    if (step === numSteps - 1) {
      x.set(predXStart)
    }
    else {
      // DDIM Update step equation:
      // eps_t = (x_t - sqrt(alpha_t) * x_0) / sqrt(1 - alpha_t)
      // x_s = sqrt(alpha_s) * x_0 + sqrt(1 - alpha_s) * eps_t
      const alphaT = alphasCumprod[tVal]
      const alphaS = alphasCumprod[sVal]

      const sqrtAlphaT = Math.sqrt(alphaT)
      const sqrtAlphaS = Math.sqrt(alphaS)
      const sqrtOneMinusAlphaT = Math.sqrt(1.0 - alphaT)
      const sqrtOneMinusAlphaS = Math.sqrt(1.0 - alphaS)

      for (let i = 0; i < x.length; i++) {
        const xt = x[i]
        const x0 = predXStart[i]
        const eps = (xt - sqrtAlphaT * x0) / sqrtOneMinusAlphaT
        x[i] = sqrtAlphaS * x0 + sqrtOneMinusAlphaS * eps
      }
    }

    if ((step + 1) % 10 === 0 || step === numSteps - 1) {
      onLog?.(`DDIM step ${step + 1}/${numSteps} (timestep: ${tVal} → ${sVal})`)
    }

    // Yield execution turn to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0))
  }

  onLog?.('Denoising loop finished successfully.')
  return x
}
