/**
 * Local Moondream2 Vision-Language Model (VLM) Web Worker.
 *
 * Runs Xenova/moondream2 on-device via WebGPU / WASM with ONNX Runtime Web.
 * Speaks the Eventa inference contract:
 * - load is a server-streaming invoke (emits download progress, then ready).
 * - process is a unary invoke that returns the generated natural language response.
 * - unload frees model sessions and tensors.
 */

import type { InferenceDevice } from '../../libs/inference/contract'

import { AutoProcessor, AutoTokenizer, env, Moondream1ForConditionalGeneration, RawImage } from '@huggingface/transformers'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import { moondreamLoadEvent, moondreamProcessEvent, moondreamUnloadEvent } from '../../libs/inference/contract'

const { context } = createContext()

export const VLM_MODEL_ID = 'Xenova/moondream2'

let resolvedDevice: InferenceDevice = 'webgpu'
let model: any = null
let processor: any = null
let tokenizer: any = null
let numImageTokens: number | null = null

/**
 * Detect whether WebGPU is available in the worker context.
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

function disposeTensors(...objs: any[]) {
  for (const obj of objs) {
    if (!obj)
      continue
    if (typeof obj.dispose === 'function') {
      try { obj.dispose() }
      catch {}
    }
    else if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        if (obj[key] && typeof obj[key].dispose === 'function') {
          try { obj[key].dispose() }
          catch {}
        }
      }
    }
  }
}

defineStreamInvokeHandler(context, moondreamLoadEvent, toStreamHandler<any, any>(async ({ payload, emit }) => {
  // Determine device
  let device = payload?.device ?? 'webgpu'
  if (device === 'webgpu') {
    const hasWebGPU = await detectWebGPUInWorker()
    if (!hasWebGPU) {
      console.warn('[Moondream Worker] WebGPU not available, falling back to WASM')
      device = 'wasm'
    }
  }
  resolvedDevice = device as InferenceDevice

  env.backends.onnx.logLevel = 'error'
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.proxy = false
  }

  const hfToken = payload?.hfToken
  if (hfToken) {
    (env as any).customHeaders = {
      Authorization: `Bearer ${hfToken}`,
    }
  }

  const progressCallback = (progress: any) => {
    emit({
      kind: 'progress',
      payload: {
        phase: 'download',
        percent: progress?.progress ?? -1,
        message: progress?.status || 'Downloading Moondream2 model weights...',
      },
    })
  }

  console.log(`[Moondream Worker] Loading Moondream2 on ${resolvedDevice}...`)

  model = await Moondream1ForConditionalGeneration.from_pretrained(VLM_MODEL_ID, {
    device: resolvedDevice,
    dtype: { embed_tokens: 'fp32', vision_encoder: 'q8', decoder_model_merged: 'q4' },
    progress_callback: progressCallback,
  })

  processor = await AutoProcessor.from_pretrained(VLM_MODEL_ID, {
    progress_callback: progressCallback,
  })

  tokenizer = await AutoTokenizer.from_pretrained(VLM_MODEL_ID, {
    progress_callback: progressCallback,
  })

  numImageTokens = null
  console.log(`[Moondream Worker] Successfully initialized Moondream2 on ${resolvedDevice}`)
  emit({ kind: 'ready', info: { device: resolvedDevice } })
}))

defineInvokeHandler(context, moondreamProcessEvent, async ({ imageUrl, prompt }) => {
  if (!model || !processor || !tokenizer) {
    throw new Error('Moondream2 VLM model not loaded. Call load() first.')
  }

  let image: RawImage | null = null
  let visionInputs: any = null
  let textInputs: any = null
  let feat: any = null
  let output: any = null

  try {
    image = await RawImage.fromURL(imageUrl)
    visionInputs = await processor(image)

    const imageTokens: number = numImageTokens ?? await (async () => {
      feat = await model.sessions.vision_encoder.run({ pixel_values: visionInputs.pixel_values })
      const count = feat.image_features.dims[1] as number
      numImageTokens = count
      return count
    })()

    const userPrompt = prompt && prompt.trim()
      ? prompt.trim()
      : 'Describe what is happening in this image in detail.'

    const formattedPrompt = `${'<image>'.repeat(imageTokens)}\n\nQuestion: ${userPrompt}\n\nAnswer:`
    textInputs = await tokenizer(formattedPrompt)

    output = await model.generate({
      ...visionInputs,
      ...textInputs,
      max_new_tokens: 96,
      do_sample: false,
    })

    const decoded = tokenizer.batch_decode(output, { skip_special_tokens: false }) as string[]
    const raw = decoded[0] ?? ''
    const answerIdx = raw.lastIndexOf('Answer:')
    const text = (answerIdx >= 0 ? raw.slice(answerIdx + 'Answer:'.length) : raw)
      .replace(/<\|endoftext\|>/g, '')
      .trim()

    return { text }
  }
  finally {
    disposeTensors(visionInputs, textInputs, feat, output)
  }
})

defineInvokeHandler(context, moondreamUnloadEvent, async () => {
  if (model) {
    try {
      await model.dispose?.()
    }
    catch {}
    model = null
  }
  processor = null
  tokenizer = null
  numImageTokens = null
  console.log('[Moondream Worker] Unloaded Moondream2 model.')
})
