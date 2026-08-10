/**
 * Attention Ecology Guard — 0-cost local cascading salience Web Worker.
 *
 * Implements the proposal §4/§10 cascade on top of the browser-ported engine
 * (`./engine/*`), speaking the Eventa inference contract (same shape as the
 * blip worker):
 *   - load (server-streaming): warm CLIP vision+text towers, optionally warm
 *     the Moondream2 captioner; emit download progress then `ready`.
 *   - process (unary): one capture tick through Stage 0 (aHash) -> Stage 1
 *     (CLIP novelty vs rolling centroid) -> Stage 2 (delta-region OCR error
 *     gate) -> Stage 3 (summary; VLM caption opt-in).
 *   - unload: dispose models, reset rolling state.
 *
 * Rolling state (prev hash, prev gray buffer, centroid) lives here so the
 * renderer's `process()` is stateless.
 */

import type { AttentionGuardProcessResult, InferenceDevice } from '../../libs/inference/contract'
import type { DeltaBBox, GrayBuffer } from './engine/pixels'

import { AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, env, RawImage } from '@huggingface/transformers'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import {
  attentionGuardLoadEvent,
  attentionGuardProcessEvent,

  attentionGuardUnloadEvent,

} from '../../libs/inference/contract'
import { countErrorPatterns, disposeOcrEngine, extractErrorSnippet, OCR_ERROR_PATTERN_MIN, ocrImageData } from './engine/ocr'
import { boxResizeGray, computeAHash, computeDeltaBBox, hammingDistance, STAGE0_HAMMING_MIN, toGray } from './engine/pixels'
import { activeWindowLabel, buildSummary, disposeVlmForwarder, generateCaption, primeCaptioner, themeFromGray } from './engine/summarizer'
import { calculateCosineDistance, centroidOf, classifyZeroShot, disposeTextEncoder, disposeVisionEncoder, getVisionEmbedding } from './engine/vision'

const { context } = createContext()

interface GuardState {
  prevGray: GrayBuffer | null
  prevHash: Uint8Array | null
  centroid: Float32Array | null
  accepted: Float32Array[]
  enableVlm: boolean
  device: InferenceDevice
}

const state: GuardState = {
  prevGray: null,
  prevHash: null,
  centroid: null,
  accepted: [],
  enableVlm: false,
  device: 'webgpu',
}

/** Detect WebGPU availability inside the worker (mirrors the blip worker). */
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

function resetTickState(): void {
  state.prevGray = null
  state.prevHash = null
  state.centroid = null
  state.accepted = []
}

/** Extract a delta-region crop as ImageData for tesseract. */
function cropToImageData(raw: Uint8Array, fullWidth: number, channels: number, bbox: DeltaBBox): ImageData {
  const { left, top, width, height } = bbox
  const crop = new ImageData(width, height)
  const out = crop.data
  for (let y = 0; y < height; y++) {
    const srcRow = (top + y) * fullWidth * channels
    const dstRow = y * width * 4
    for (let x = 0; x < width; x++) {
      const s = srcRow + (left + x) * channels
      const d = dstRow + x * 4
      if (channels >= 3) {
        out[d] = raw[s]
        out[d + 1] = raw[s + 1]
        out[d + 2] = raw[s + 2]
        out[d + 3] = 255
      }
      else {
        out[d] = out[d + 1] = out[d + 2] = raw[s]
        out[d + 3] = 255
      }
    }
  }
  return crop
}

defineStreamInvokeHandler(context, attentionGuardLoadEvent, toStreamHandler<any, any>(async ({ payload, emit }) => {
  let device = payload.device ?? 'webgpu'
  if (device === 'webgpu') {
    const hasWebGPU = await detectWebGPUInWorker()
    if (!hasWebGPU) {
      console.warn('[Attention Guard Worker] WebGPU unavailable, falling back to WASM')
      device = 'wasm'
    }
  }
  state.device = device
  state.enableVlm = !!payload.enableVlm

  env.backends.onnx.wasm!.proxy = false
  if (payload.hfToken) {
    (env as any).customHeaders = { Authorization: `Bearer ${payload.hfToken}` }
  }

  const progressCallback = (progress: any) => {
    emit({ kind: 'progress', payload: { phase: 'download', percent: progress?.progress ?? -1, message: progress?.status || 'Downloading model files...' } })
  }

  try {
    // Warm the CLIP towers (Stage 1 + Stage 2 zero-shot).
    await Promise.all([
      AutoProcessor.from_pretrained('Xenova/clip-vit-base-patch32'),
      CLIPVisionModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', { device, progress_callback: progressCallback }),
      AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch32'),
      CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', { device, progress_callback: progressCallback }),
    ])

    if (state.enableVlm) {
      await primeCaptioner(device)
    }

    resetTickState()
    emit({ kind: 'ready', info: { device, metadata: { enableVlm: state.enableVlm } } })
  }
  catch (err: any) {
    throw new Error(`[attention-guard] load failed: ${err.message || String(err)}`)
  }
}))

defineInvokeHandler(context, attentionGuardProcessEvent, async ({ dataUrl }) => {
  const stageMs = { stage0Ms: 0, stage1Ms: 0, stage2Ms: 0, stage3Ms: 0 }

  // -- decode + Stage 0 perceptual hash -------------------------------------
  const rawImage = await RawImage.fromURL(dataUrl)
  const raw = rawImage.data as Uint8Array
  const channels = rawImage.channels
  const gray = toGray(raw, rawImage.width, rawImage.height, channels)
  const gray32 = boxResizeGray(gray, 32, 32)
  const { bits: curHash } = computeAHash(gray32)

  if (state.prevHash === null) {
    // First tick: seed the baseline work centroid v0.
    const t1 = performance.now()
    const embedding = await getVisionEmbedding(dataUrl, state.device)
    stageMs.stage1Ms = performance.now() - t1
    state.centroid = embedding
    state.accepted = [embedding]
    state.prevGray = gray
    state.prevHash = curHash
    return {
      decision: 'BASELINE',
      stage0Delta: 0,
      novelty: 0,
      ocrErrorPatternHits: 0,
      ocrErrorPatterns: [],
      stageMs,
    } satisfies AttentionGuardProcessResult
  }

  const stage0Start = performance.now()
  const hamming = hammingDistance(state.prevHash, curHash)
  const normDistance = hamming / 1024
  stageMs.stage0Ms = performance.now() - stage0Start

  if (normDistance < STAGE0_HAMMING_MIN) {
    // Static tick: 0-cost drop before any neural model.
    state.prevGray = gray
    state.prevHash = curHash
    return {
      decision: 'IGNORE',
      stage0Delta: normDistance,
      novelty: 0,
      ocrErrorPatternHits: 0,
      ocrErrorPatterns: [],
      stageMs,
    } satisfies AttentionGuardProcessResult
  }

  // -- Stage 1: CLIP embedding + novelty vs rolling centroid ----------------
  const t1 = performance.now()
  const embedding = await getVisionEmbedding(dataUrl, state.device)
  const novelty = calculateCosineDistance(embedding, state.centroid!)
  stageMs.stage1Ms = performance.now() - t1

  // -- Stage 2: delta-region OCR error evidence + salience gate -------------
  const t2 = performance.now()
  let ocrErrorPatterns: string[] = []
  let ocrText = ''
  const bbox = state.prevGray ? computeDeltaBBox(state.prevGray, gray) : null
  if (bbox) {
    const crop = cropToImageData(raw, rawImage.width, channels, bbox)
    const { text } = await ocrImageData(crop)
    ocrText = text
    ocrErrorPatterns = countErrorPatterns(text)
  }
  stageMs.stage2Ms = performance.now() - t2

  const promote = ocrErrorPatterns.length >= OCR_ERROR_PATTERN_MIN

  // Update rolling state. NOTE-level frames join the centroid (routine drift
  // becomes the new "normal"); event frames never shift it.
  state.prevGray = gray
  state.prevHash = curHash

  // -- Stage 3: summary for promoted frames ---------------------------------
  let summary: string | undefined
  let caption: string | null = null
  let vlmStatus: 'ok' | 'degraded' | 'error' | undefined
  if (promote) {
    const t3 = performance.now()
    const zeroShot = await classifyZeroShot(embedding, state.device)
    const snippet = extractErrorSnippet(ocrText, ocrErrorPatterns)
    const window = activeWindowLabel(zeroShot.topLabel)
    const theme = themeFromGray(gray32)

    if (state.enableVlm) {
      const captionResult = await generateCaption(dataUrl, state.device)
      if (captionResult) {
        caption = captionResult.caption
        vlmStatus = 'ok'
      }
      else {
        vlmStatus = 'error'
      }
    }
    else {
      vlmStatus = 'degraded'
    }

    summary = buildSummary({ window, theme, caption, snippet })
    stageMs.stage3Ms = performance.now() - t3
  }
  else {
    state.accepted.push(embedding)
    state.centroid = centroidOf(state.accepted)
  }

  return {
    decision: promote ? 'PROMOTE' : 'NOTE',
    stage0Delta: normDistance,
    novelty,
    ocrErrorPatternHits: ocrErrorPatterns.length,
    ocrErrorPatterns,
    summary,
    caption,
    vlmStatus,
    stageMs,
  } satisfies AttentionGuardProcessResult
})

defineInvokeHandler(context, attentionGuardUnloadEvent, () => {
  void disposeVisionEncoder()
  void disposeTextEncoder()
  void disposeOcrEngine()
  void disposeVlmForwarder()
  resetTickState()
})
