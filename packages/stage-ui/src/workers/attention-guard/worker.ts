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

import { env, RawImage } from '@huggingface/transformers'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import {
  attentionGuardLoadEvent,
  attentionGuardProcessEvent,

  attentionGuardUnloadEvent,

} from '../../libs/inference/contract'
import {
  DEFAULT_ERROR_PATTERNS,
  disposeOcrEngine,
  extractRelevantSnippet,
  getWorker,
  matchInterestTags,
  matchPatterns,
  OCR_ERROR_PATTERN_MIN,
  OCR_INTEREST_KEYWORD_MIN,
  ocrImageData,
} from './engine/ocr'
import { boxResizeGray, computeAHash, computeDeltaBBox, hammingDistance, STAGE0_HAMMING_MIN, toGray } from './engine/pixels'
import { activeWindowLabel, buildSummary, disposeVlmForwarder, generateCaption, primeCaptioner, themeFromGray } from './engine/summarizer'
import { calculateCosineDistance, centroidOf, classifyZeroShot, disposeTextEncoder, disposeVisionEncoder, getVisionEmbedding, warmupVision } from './engine/vision'

const { context } = createContext()

interface GuardState {
  prevGray: GrayBuffer | null
  currentGray: GrayBuffer | null
  scratchGray32: Uint8Array
  scratchCurHash: Uint8Array
  prevHash: Uint8Array | null
  centroid: Float32Array | null
  accepted: Float32Array[]
  enableVlm: boolean
  device: InferenceDevice
}

const state: GuardState = {
  prevGray: null,
  currentGray: null,
  scratchGray32: new Uint8Array(32 * 32),
  scratchCurHash: new Uint8Array(1024),
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
  state.currentGray = null
  state.prevHash = null
  state.centroid = null
  state.accepted = []
}

/** Extract a delta-region crop as ImageData for tesseract. */
function cropToImageData(raw: Uint8Array, fullWidth: number, channels: number, bbox: DeltaBBox): ImageData | null {
  const left = Math.max(0, Math.floor(bbox.left))
  const top = Math.max(0, Math.floor(bbox.top))
  const width = Math.floor(bbox.width)
  const height = Math.floor(bbox.height)
  if (width <= 0 || height <= 0)
    return null

  try {
    const crop = new ImageData(new Uint8ClampedArray(width * height * 4), width, height)
    const out = crop.data
    for (let y = 0; y < height; y++) {
      const srcRow = (top + y) * fullWidth * channels
      const dstRow = y * width * 4
      for (let x = 0; x < width; x++) {
        const s = srcRow + (left + x) * channels
        const d = dstRow + x * 4
        if (channels >= 3) {
          out[d] = raw[s] ?? 0
          out[d + 1] = raw[s + 1] ?? 0
          out[d + 2] = raw[s + 2] ?? 0
          out[d + 3] = 255
        }
        else {
          out[d] = out[d + 1] = out[d + 2] = raw[s] ?? 0
          out[d + 3] = 255
        }
      }
    }
    return crop
  }
  catch (err) {
    console.warn('[attention-guard:worker] cropToImageData failed:', err)
    return null
  }
}

let scratchDecodeCanvas: OffscreenCanvas | null = null
let scratchDecodeCtx: OffscreenCanvasRenderingContext2D | null = null

/**
 * Decodes raw PNG/JPEG bytes into a RawImage using a single reused OffscreenCanvas
 * and explicit ImageBitmap.close() to eliminate Blink Tag 14 / GPU texture accumulation.
 * The Blob wraps the buffer without copying; callers should transfer (not clone)
 * the bytes here so only one native copy ever exists per tick.
 */
async function decodeBytesToRawImage(pngBytes: ArrayBuffer): Promise<RawImage> {
  const blob = new Blob([pngBytes], { type: 'image/png' })
  const bitmap = await createImageBitmap(blob)
  try {
    const { width, height } = bitmap
    if (!scratchDecodeCanvas) {
      scratchDecodeCanvas = new OffscreenCanvas(width, height)
      scratchDecodeCtx = scratchDecodeCanvas.getContext('2d', { willReadFrequently: true })
    }
    else if (scratchDecodeCanvas.width !== width || scratchDecodeCanvas.height !== height) {
      scratchDecodeCanvas.width = width
      scratchDecodeCanvas.height = height
      scratchDecodeCtx = scratchDecodeCanvas.getContext('2d', { willReadFrequently: true })
    }

    if (!scratchDecodeCtx) {
      throw new Error('Failed to acquire 2D context on scratch OffscreenCanvas')
    }

    scratchDecodeCtx.drawImage(bitmap, 0, 0)
    const imgData = scratchDecodeCtx.getImageData(0, 0, width, height)
    return new RawImage(imgData.data, width, height, 4)
  }
  finally {
    bitmap.close()
  }
}

/**
 * Legacy data-URL decode path (fetch hop). Kept for callers without transferred
 * bytes; strictly worse (Response + Blob allocations per tick) — prefer pngBytes.
 */
async function decodeDataUrlToRawImage(dataUrl: string): Promise<RawImage> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  return decodeBytesToRawImage(await blob.arrayBuffer())
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

  env.backends.onnx.logLevel = 'error'
  env.backends.onnx.wasm!.proxy = false
  // NOTICE: transformers 4.x's stock wasmPaths default is the broken object
  // form (backend init dies with "Failed to construct 'URL': Invalid URL" —
  // verified live on VAD/whisper). Overwrite unconditionally with the string
  // form, matching the search/blip workers.
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'
  }
  if (payload.hfToken) {
    (env as any).customHeaders = { Authorization: `Bearer ${payload.hfToken}` }
  }

  const shardMap = new Map<string, { loaded: number, total: number }>()

  const progressCallback = (progress: any) => {
    if (progress?.file && typeof progress.loaded === 'number' && typeof progress.total === 'number' && progress.total > 0) {
      shardMap.set(progress.file, { loaded: progress.loaded, total: progress.total })
      let totalLoaded = 0
      let totalBytes = 0
      for (const item of shardMap.values()) {
        totalLoaded += item.loaded
        totalBytes += item.total
      }
      const aggregatedPercent = totalBytes > 0
        ? Math.min(99, Math.round((totalLoaded / totalBytes) * 100))
        : (progress.progress ?? -1)

      emit({
        kind: 'progress',
        payload: {
          phase: 'download',
          percent: aggregatedPercent,
          file: progress.file,
          loaded: totalLoaded,
          total: totalBytes,
          message: `Downloading ${progress.file} (${Math.round(progress.progress ?? aggregatedPercent)}%)...`,
        },
      })
    }
    else {
      emit({
        kind: 'progress',
        payload: {
          phase: 'download',
          percent: typeof progress?.progress === 'number' ? Math.min(99, Math.round(progress.progress)) : -1,
          file: progress?.file,
          message: progress?.status || progress?.file || 'Downloading model files...',
        },
      })
    }
  }

  try {
    // Warm the CLIP towers (Stage 1 + Stage 2 zero-shot).
    await warmupVision(device, progressCallback)

    // Warm the localized OCR worker (Stage 2 tesseract WASM + dictionary).
    await getWorker()

    if (state.enableVlm) {
      await primeCaptioner(device, progressCallback)
    }

    resetTickState()
    emit({ kind: 'ready', info: { device, metadata: { enableVlm: state.enableVlm } } })
  }
  catch (err: any) {
    throw new Error(`[attention-guard] load failed: ${err.message || String(err)}`)
  }
}))

defineInvokeHandler(context, attentionGuardProcessEvent, async ({ dataUrl, pngBytes, interestTags, degraded }) => {
  const stageMs = { stage0Ms: 0, stage1Ms: 0, stage2Ms: 0, stage3Ms: 0 }
  let rawImage: RawImage | null = null

  try {
    // -- decode + Stage 0 perceptual hash -------------------------------------
    try {
      // NOTICE: transferred bytes are preferred — the sender's buffer is neutered
      // on transfer, so no second native copy exists during slow CLIP/OCR ticks.
      rawImage = pngBytes && pngBytes.byteLength > 0
        ? await decodeBytesToRawImage(pngBytes)
        : await decodeDataUrlToRawImage(dataUrl || '')
    }
    catch (decodeErr: any) {
      console.warn('[attention-guard:worker] Invalid capture frame skipped (could not decode):', decodeErr?.message || decodeErr)
      return {
        decision: 'IGNORE',
        stage0Delta: 0,
        novelty: 0,
        ocrErrorPatternHits: 0,
        ocrErrorPatterns: [],
        interestKeywordHits: 0,
        interestKeywords: [],
        stageMs,
      } satisfies AttentionGuardProcessResult
    }

    const raw = rawImage.data as Uint8Array
    const channels = rawImage.channels

    // Ping-pong buffer reuse: write into currentGray, reusing allocated Uint8Array
    state.currentGray = toGray(raw, rawImage.width, rawImage.height, channels, state.currentGray)
    const gray = state.currentGray

    // Reuse preallocated 32x32 luma buffer
    const gray32 = boxResizeGray(gray, 32, 32, state.scratchGray32)

    // Reuse preallocated 1024-bit hash buffer
    const { bits: curHash } = computeAHash(gray32, state.scratchCurHash)

    if (state.prevHash === null) {
      // First tick: seed the baseline work centroid v0.
      const t1 = performance.now()
      const embedding = await getVisionEmbedding(rawImage, state.device)
      stageMs.stage1Ms = performance.now() - t1
      state.centroid = embedding
      state.accepted = [embedding]

      // Clone current into prev for the initial baseline
      state.prevGray = { width: gray.width, height: gray.height, data: new Uint8Array(gray.data) }
      state.prevHash = new Uint8Array(curHash)

      return {
        decision: 'BASELINE',
        stage0Delta: 0,
        novelty: 0,
        ocrErrorPatternHits: 0,
        ocrErrorPatterns: [],
        interestKeywordHits: 0,
        interestKeywords: [],
        stageMs,
      } satisfies AttentionGuardProcessResult
    }

    const stage0Start = performance.now()
    const hamming = hammingDistance(state.prevHash, curHash)
    const normDistance = hamming / 1024
    stageMs.stage0Ms = performance.now() - stage0Start

    if (normDistance < STAGE0_HAMMING_MIN) {
      // Static tick: 0-cost drop before any neural model.
      // Swap current into prev without allocating new memory
      const temp = state.prevGray
      state.prevGray = state.currentGray
      state.currentGray = temp
      state.prevHash.set(curHash)

      return {
        decision: 'IGNORE',
        stage0Delta: normDistance,
        novelty: 0,
        ocrErrorPatternHits: 0,
        ocrErrorPatterns: [],
        interestKeywordHits: 0,
        interestKeywords: [],
        stageMs,
      } satisfies AttentionGuardProcessResult
    }

    // -- Stage 1: CLIP embedding + novelty vs rolling centroid ----------------
    const t1 = performance.now()
    const embedding = await getVisionEmbedding(rawImage, state.device)
    const novelty = calculateCosineDistance(embedding, state.centroid!)
    stageMs.stage1Ms = performance.now() - t1

    // -- Stage 2: delta-region OCR error evidence + interest match -------------
    const t2 = performance.now()
    let ocrErrorPatterns: string[] = []
    let ocrInterestTags: string[] = []
    let ocrText = ''
    const bbox = state.prevGray ? computeDeltaBBox(state.prevGray, gray) : null
    if (bbox) {
      let crop: ImageData | null = cropToImageData(raw, rawImage.width, channels, bbox)
      if (crop) {
        try {
          const { text } = await ocrImageData(crop, degraded ? { degraded: true } : undefined)
          ocrText = text
          ocrErrorPatterns = matchPatterns(text, DEFAULT_ERROR_PATTERNS)
          ocrInterestTags = matchInterestTags(text, interestTags)

          const preview = ocrText.trim().replace(/\s+/g, ' ').slice(0, 100)
          const frameArea = rawImage.width * rawImage.height
          const fullFrameTag = bbox.width * bbox.height >= frameArea * 0.5 ? '[FULL-FRAME] ' : ''
          console.log(`[attention-guard:worker] ${fullFrameTag}OCR bbox=(${bbox.left},${bbox.top},${bbox.width}×${bbox.height}) | chars=${ocrText.length} | preview="${preview}" | interestTargets=[${interestTags?.join(', ') || ''}] | interestHits=${ocrInterestTags.length} ([${ocrInterestTags.join(', ')}])`)
        }
        finally {
          crop = null
        }
      }
    }
    stageMs.stage2Ms = performance.now() - t2

    // Gate evaluation aligned with CLI stage2-salience-eval.ts
    const isErrorCascade = ocrErrorPatterns.length >= OCR_ERROR_PATTERN_MIN
    const isInterestMatch = ocrInterestTags.length >= OCR_INTEREST_KEYWORD_MIN
    const promote = isErrorCascade || isInterestMatch

    // Update rolling state via zero-allocation buffer swap.
    const temp = state.prevGray
    state.prevGray = state.currentGray
    state.currentGray = temp
    state.prevHash.set(curHash)

    // -- Stage 3: semantic forwarder & summary synthesis --------------------
    let summary: string | undefined
    let caption: string | null = null
    let vlmStatus: 'ok' | 'degraded' | 'error' | undefined
    const snippet = extractRelevantSnippet(ocrText, ocrErrorPatterns, ocrInterestTags)

    if (promote) {
      if (state.enableVlm) {
        try {
          const captionResult = await generateCaption(rawImage, state.device)
          if (captionResult) {
            caption = captionResult.caption
            vlmStatus = 'ok'
          }
          else {
            vlmStatus = 'error'
          }
        }
        catch (vlmErr: any) {
          console.warn('[attention-guard:worker] generateCaption error caught:', vlmErr?.message || vlmErr)
          vlmStatus = 'error'
        }
      }
      else {
        vlmStatus = 'degraded'
      }

      const t3 = performance.now()
      const zeroShot = await classifyZeroShot(embedding, state.device)
      const window = activeWindowLabel(zeroShot.topLabel)
      const theme = themeFromGray(gray32)

      summary = buildSummary({
        window,
        theme,
        caption,
        snippet,
        matchedInterestTags: ocrInterestTags,
      })
      stageMs.stage3Ms = performance.now() - t3
    }
    else {
      vlmStatus = state.enableVlm ? 'ok' : 'degraded'
      state.accepted.push(embedding)
      if (state.accepted.length > 50) {
        state.accepted.shift()
      }
      state.centroid = centroidOf(state.accepted)
    }

    const result: AttentionGuardProcessResult = {
      decision: promote ? 'PROMOTE' : 'NOTE',
      stage0Delta: normDistance,
      novelty,
      ocrErrorPatternHits: ocrErrorPatterns.length,
      ocrErrorPatterns,
      interestKeywordHits: ocrInterestTags.length,
      interestKeywords: ocrInterestTags,
      summary,
      caption,
      ocrSnippet: snippet || undefined,
      vlmStatus,
      stageMs,
    }

    return result
  }
  catch (err: any) {
    console.error('[attention-guard:worker] Process tick error:', err)
    return {
      decision: 'NOTE',
      stage0Delta: 0,
      novelty: 0,
      ocrErrorPatternHits: 0,
      ocrErrorPatterns: [],
      interestKeywordHits: 0,
      interestKeywords: [],
      stageMs,
    } satisfies AttentionGuardProcessResult
  }
  finally {
    // Explicitly release 20MB RawImage Uint8Array reference so it can be GC'd immediately
    rawImage = null
  }
})

defineInvokeHandler(context, attentionGuardUnloadEvent, () => {
  void disposeVisionEncoder()
  void disposeTextEncoder()
  void disposeOcrEngine()
  void disposeVlmForwarder()
  if (scratchDecodeCanvas) {
    scratchDecodeCanvas.width = 0
    scratchDecodeCanvas.height = 0
    scratchDecodeCanvas = null
    scratchDecodeCtx = null
  }
  resetTickState()
})
