import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers'

const MODEL_ID = 'Xenova/clip-vit-base-patch32'
// Same Cache Storage bucket transformers.js writes to, so the model cache
// manager (and cross-session readiness checks) can see these weights.
const TRANSFORMERS_CACHE_NAME = 'transformers-cache'

let tokenizerPromise: Promise<any> | null = null
let textModelPromise: Promise<any> | null = null

export type ClipProgress = (percentage: number, status: string) => void

interface TransformersProgressEvent {
  status?: string
  file?: string
  progress?: number
}

function makeProgressReporter(onProgress?: ClipProgress) {
  return (event: TransformersProgressEvent) => {
    if (!onProgress || typeof event?.progress !== 'number')
      return
    if (event.status !== 'progress' && event.status !== 'progress_total')
      return

    const file = event.file ? event.file.split('/').pop() : 'weights'
    const percentage = Math.max(0, Math.min(100, Math.round(event.progress)))
    onProgress(percentage, `Downloading CLIP text encoder (${file})...`)
  }
}

/**
 * Loads (and caches) the CLIP tokenizer + text encoder without running inference.
 * Shared by the embedding path and the explicit motion-engine pre-warm.
 */
async function ensureClipTextStack(
  onLog?: (msg: string) => void,
  onProgress?: ClipProgress,
): Promise<{ tokenizer: any, textModel: any }> {
  const progressCallback = makeProgressReporter(onProgress)

  if (!tokenizerPromise) {
    onLog?.(`Loading CLIP tokenizer (${MODEL_ID})...`)
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback: progressCallback }).catch((err) => {
      // Allow a retry after a failed download instead of pinning the rejection.
      tokenizerPromise = null
      throw err
    })
  }
  if (!textModelPromise) {
    onLog?.(`Loading CLIP text model (${MODEL_ID})...`)
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { progress_callback: progressCallback }).catch((err) => {
      textModelPromise = null
      throw err
    })
  }

  const [tokenizer, textModel] = await Promise.all([tokenizerPromise, textModelPromise])
  return { tokenizer, textModel }
}

/**
 * Downloads/loads the CLIP text encoder so the first FlowMDM generation does not
 * pay for it. Throws on failure so callers can report a real error.
 */
export async function prewarmClipEncoder(onLog?: (msg: string) => void, onProgress?: ClipProgress): Promise<void> {
  const { tokenizer, textModel } = await ensureClipTextStack(onLog, onProgress)
  if (!tokenizer || !textModel)
    throw new Error('CLIP text encoder failed to initialize')
  onLog?.('CLIP text encoder ready.')
}

/** Whether the CLIP text encoder weights are present in Cache Storage. */
export async function isClipEncoderCached(): Promise<boolean> {
  if (typeof caches === 'undefined')
    return false

  try {
    const cache = await caches.open(TRANSFORMERS_CACHE_NAME)
    const keys = await cache.keys()
    return keys.some(request => request.url.includes(MODEL_ID) && request.url.includes('text_model'))
  }
  catch {
    return false
  }
}

export async function getClipEmbedding(prompt: string, onLog?: (msg: string) => void): Promise<Float32Array> {
  try {
    const { tokenizer, textModel } = await ensureClipTextStack(onLog)
    onLog?.('Encoding prompt text into CLIP embedding space...')

    const inputs = await tokenizer(prompt)
    const { text_embeds } = await textModel(inputs)

    onLog?.('CLIP embedding generated successfully.')
    return text_embeds.data as Float32Array
  }
  catch (err: any) {
    const message = err?.message || String(err)
    onLog?.(`[ERROR] CLIP load/encode failed: ${message}`)
    throw new Error(`CLIP text encoder failed to produce embedding: ${message}`)
  }
}
