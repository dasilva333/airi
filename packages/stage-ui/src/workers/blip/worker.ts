/**
 * Local Vision (BLIP & WD14 Tagger) Web Worker.
 *
 * Runs local vision models off the main thread.
 * Speaks the Eventa inference contract:
 * - load is a server-streaming invoke (emits download progress, then ready).
 * - process is a unary invoke that returns the generated caption or tags.
 */

import { AutoModel, AutoProcessor, env, pipeline, RawImage, Tensor } from '@huggingface/transformers'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import { DEFAULT_LOCAL_VISION_MODEL } from '../../libs/inference/constants'
import { blipLoadEvent, blipProcessEvent, blipUnloadEvent } from '../../libs/inference/contract'

const { context } = createContext()

let activeModelId: string = DEFAULT_LOCAL_VISION_MODEL
let resolvedDevice: 'webgpu' | 'wasm' | 'cpu' = 'webgpu'

// Pipelines & Models
let imageToTextPipeline: any = null
let taggerModel: any = null
let taggerProcessor: any = null
let taggerTags: TaggerTag[] = []

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

interface TaggerTag {
  name: string
  category: number // 0: general, 4: character, 9: rating
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    }
    else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    }
    else {
      current += char
    }
  }
  result.push(current)
  return result
}

/**
 * Parses SmilingWolf WD14 tagger selected_tags.csv mapping tag indices to metadata.
 */
async function loadTaggerTags(modelId: string): Promise<TaggerTag[]> {
  try {
    const url = `https://huggingface.co/${modelId}/resolve/main/selected_tags.csv`
    console.log(`[Vision Worker] Fetching tag vocabulary from ${url}...`)
    const response = await fetch(url)
    if (!response.ok)
      throw new Error(`Failed to fetch tags CSV: ${response.statusText}`)

    const csvText = await response.text()
    const lines = csvText.split('\n')
    const tags: TaggerTag[] = []

    // Header: tag_id,name,category,count
    const kaomojis = [
      '0_0',
      '(o)_(o)',
      '+_+',
      '+_-',
      '._.',
      '<o>_<o>',
      '<|>_<|>',
      '=_=',
      '>_<',
      '3_3',
      '6_9',
      '>_o',
      '@_@',
      '^_^',
      'o_o',
      'u_u',
      'x_x',
      '|_|',
      '||_||',
    ]

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line)
        continue
      const parts = parseCsvLine(line)
      if (parts.length >= 3) {
        let rawName = parts[1]
        if (rawName.startsWith('"') && rawName.endsWith('"')) {
          rawName = rawName.slice(1, -1)
        }
        const name = kaomojis.includes(rawName) ? rawName : rawName.replace(/_/g, ' ')
        const category = Number.parseInt(parts[2], 10)
        tags.push({ name, category })
      }
    }
    return tags
  }
  catch (e) {
    console.error('[Vision Worker] Failed to load tag vocabulary:', e)
    return []
  }
}

defineStreamInvokeHandler(context, blipLoadEvent, toStreamHandler<any, any>(async ({ payload, emit }) => {
  const modelId = payload.model || DEFAULT_LOCAL_VISION_MODEL
  activeModelId = modelId

  // Determine device
  let device = payload.device ?? 'webgpu'
  if (device === 'webgpu') {
    const hasWebGPU = await detectWebGPUInWorker()
    if (!hasWebGPU) {
      console.warn('[Vision Worker] WebGPU not available, falling back to WASM')
      device = 'wasm'
    }
  }
  resolvedDevice = device as any

  env.backends.onnx.wasm!.proxy = false
  const hfToken = payload.hfToken
  if (hfToken) {
    (env as any).customHeaders = {
      Authorization: `Bearer ${hfToken}`,
    }
  }

  // Unload previous models to save memory
  imageToTextPipeline = null
  taggerModel = null
  taggerProcessor = null

  const progressCallback = (progress: any) => {
    emit({
      kind: 'progress',
      payload: {
        phase: 'download',
        percent: progress?.progress ?? -1,
        message: progress?.status || 'Downloading model files...',
      },
    })
  }

  const isTagger = modelId.toLowerCase().includes('wd-v1-4') || modelId.toLowerCase().includes('wd14') || modelId.toLowerCase().includes('wd-') || modelId.toLowerCase().includes('tagger')

  if (isTagger) {
    console.log(`[Vision Worker] Loading WD14 Tagger: ${modelId} on ${resolvedDevice}`)
    taggerModel = await AutoModel.from_pretrained(modelId, {
      device: resolvedDevice,
      model_file_name: '../model',
      progress_callback: progressCallback,
    })
    taggerProcessor = await AutoProcessor.from_pretrained('Xenova/vit-gpt2-image-captioning')
    taggerTags = await loadTaggerTags(modelId)
  }
  else {
    console.log(`[Vision Worker] Loading BLIP image-to-text pipeline: ${modelId} on ${resolvedDevice}`)
    imageToTextPipeline = await pipeline('image-to-text', modelId, {
      device: resolvedDevice,
      progress_callback: progressCallback,
    })
  }

  emit({ kind: 'ready', info: { device: resolvedDevice } })
}))

defineInvokeHandler(context, blipProcessEvent, async ({ imageUrl, generalThreshold: customGeneralThreshold, characterThreshold: customCharacterThreshold }) => {
  const isTagger = activeModelId.toLowerCase().includes('wd-v1-4') || activeModelId.toLowerCase().includes('wd14') || activeModelId.toLowerCase().includes('wd-') || activeModelId.toLowerCase().includes('tagger')

  if (isTagger) {
    if (!taggerModel || !taggerProcessor)
      throw new Error('Tagger model not loaded. Call load() first.')

    const img = await RawImage.fromURL(imageUrl)
    console.log(`[Vision Worker Debug] img: width=${img.width}, height=${img.height}, channels=${img.channels}, dataLength=${img.data ? img.data.length : 0}, sampleData=[${img.data ? Array.from(img.data.slice(0, 12)).join(', ') : ''}]`)

    // Composite alpha on white
    const canvas = new RawImage(new Uint8ClampedArray(img.width * img.height * 4), img.width, img.height, 4)
    const canvasData = canvas.data
    const imgData = img.data
    const imgChannels = img.channels

    for (let i = 0; i < img.width * img.height; i++) {
      let r = 255; let g = 255; let b = 255; const a = 255
      if (imgChannels === 4) {
        const alpha = imgData[4 * i + 3] / 255.0
        r = Math.round(imgData[4 * i] * alpha + 255 * (1 - alpha))
        g = Math.round(imgData[4 * i + 1] * alpha + 255 * (1 - alpha))
        b = Math.round(imgData[4 * i + 2] * alpha + 255 * (1 - alpha))
      }
      else if (imgChannels === 3) {
        r = imgData[3 * i]
        g = imgData[3 * i + 1]
        b = imgData[3 * i + 2]
      }
      else if (imgChannels === 1) {
        r = g = b = imgData[i]
      }
      canvasData[4 * i] = r
      canvasData[4 * i + 1] = g
      canvasData[4 * i + 2] = b
      canvasData[4 * i + 3] = a
    }

    // Pad to square
    const maxDim = Math.max(canvas.width, canvas.height)
    const padLeft = Math.floor((maxDim - canvas.width) / 2)
    const padTop = Math.floor((maxDim - canvas.height) / 2)

    const paddedData = new Uint8ClampedArray(maxDim * maxDim * 4)
    paddedData.fill(255) // Default white background

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const srcIdx = (y * canvas.width + x) * 4
        const dstIdx = ((y + padTop) * maxDim + (x + padLeft)) * 4
        paddedData[dstIdx] = canvasData[srcIdx]
        paddedData[dstIdx + 1] = canvasData[srcIdx + 1]
        paddedData[dstIdx + 2] = canvasData[srcIdx + 2]
        paddedData[dstIdx + 3] = canvasData[srcIdx + 3]
      }
    }

    const paddedImage = new RawImage(paddedData, maxDim, maxDim, 4)
    const resized = await paddedImage.resize(448, 448, { resample: 3 })
    const resizedData = resized.data
    console.log(`[Vision Worker Debug] resizedData: width=${resized.width}, height=${resized.height}, channels=${resized.channels}, min=${(resizedData as any).reduce((a: number, b: number) => Math.min(a, b), 255)}, max=${(resizedData as any).reduce((a: number, b: number) => Math.max(a, b), 0)}, sampleData=[${Array.from(resizedData.slice(0, 12)).join(', ')}]`)

    const data = new Float32Array(448 * 448 * 3)

    // PIL BGR layout: PIL image is RGB, converted to BGR, in raw [0, 255] range
    for (let i = 0; i < 448 * 448; i++) {
      data[3 * i] = resizedData[4 * i + 2] // Blue channel
      data[3 * i + 1] = resizedData[4 * i + 1] // Green channel
      data[3 * i + 2] = resizedData[4 * i] // Red channel
    }

    const inputs = {
      input: new Tensor('float32', data, [1, 448, 448, 3]),
    }
    const output = await taggerModel(inputs)

    // Find output logits tensor (contains pre-activated probabilities in v3)
    const logits = output.logits || Object.values(output)[0]
    if (!logits || !logits.data)
      throw new Error('Could not retrieve logits from model output.')

    const probs = Array.from(logits.data) as number[]

    // Thresholds
    const generalThreshold = customGeneralThreshold ?? 0.20
    const characterThreshold = customCharacterThreshold ?? 0.85

    const generalTags: { tag: string, prob: number }[] = []
    const characterTags: { tag: string, prob: number }[] = []

    for (let i = 0; i < probs.length; i++) {
      const prob = probs[i]
      const tagMetadata = taggerTags[i]
      if (!tagMetadata)
        continue

      if (tagMetadata.category === 0 && prob > generalThreshold) {
        generalTags.push({ tag: tagMetadata.name, prob })
      }
      else if (tagMetadata.category === 4 && prob > characterThreshold) {
        characterTags.push({ tag: tagMetadata.name, prob })
      }
    }

    // Sort outputs
    generalTags.sort((a, b) => b.prob - a.prob)
    characterTags.sort((a, b) => b.prob - a.prob)

    // Slice general tags to top 25
    const slicedGeneral = generalTags.slice(0, 25)

    const allTags = [...characterTags.map(c => c.tag), ...slicedGeneral.map(g => g.tag)]

    console.log('[Vision Worker] Top 25 Predictions:', [...characterTags, ...slicedGeneral]
      .sort((a, b) => b.prob - a.prob)
      .map(t => `${t.tag}: ${(t.prob * 100).toFixed(1)}%`))

    const text = allTags.join(', ')
    return { text }
  }
  else {
    if (!imageToTextPipeline)
      throw new Error('BLIP pipeline not loaded. Call load() first.')

    const result = await imageToTextPipeline(imageUrl)
    const text = result[0]?.generated_text || ''
    return { text }
  }
})

defineInvokeHandler(context, blipUnloadEvent, () => {
  imageToTextPipeline = null
  taggerModel = null
  taggerProcessor = null
  taggerTags = []
  console.log('[Vision Worker] Unloaded local vision models.')
})
