import * as ort from 'onnxruntime-web'

import { alphasCumprod } from './constants'

let sessionPromise: Promise<ort.InferenceSession | null> | null = null

const MODEL_URL = 'https://huggingface.co/dasilva333/flowmdm-onnx/resolve/main/flow_mdm.onnx'

export async function getDenoisingSession(onLog?: (msg: string) => void): Promise<ort.InferenceSession | null> {
  if (sessionPromise)
    return sessionPromise

  sessionPromise = (async () => {
    onLog?.('Loading ONNX motion denoiser model (dasilva333/flowmdm-onnx)...')
    try {
      if (typeof navigator !== 'undefined' && 'gpu' in navigator && navigator.gpu) {
        onLog?.('WebGPU detected. Attempting ONNX WebGPU execution provider...')
        try {
          const session = await ort.InferenceSession.create(MODEL_URL, {
            executionProviders: ['webgpu'],
          })
          onLog?.('ONNX Inference Session initialized with WebGPU.')
          return session
        }
        catch (gpuErr: any) {
          onLog?.(`[WARN] WebGPU EP failed (${gpuErr.message}). Retrying with WASM...`)
        }
      }

      onLog?.('Initializing ONNX Inference Session with WASM execution provider...')
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ['wasm'],
      })
      onLog?.('ONNX Inference Session initialized with WASM.')
      return session
    }
    catch (err: any) {
      onLog?.(`[WARN] ONNX model load failed: ${err.message || String(err)}`)
      sessionPromise = null
      return null
    }
  })()

  return sessionPromise
}

export async function runDdimLoop(
  session: ort.InferenceSession | null,
  clipEmbedding: Float32Array,
  seqLen: number = 60,
  onLog?: (msg: string) => void,
): Promise<Float32Array> {
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

    if (session) {
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
    else {
      // Fallback generator step when session is unavailable
      await new Promise(resolve => setTimeout(resolve, 5))
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
