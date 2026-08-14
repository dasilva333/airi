/**
 * Stage 3 — WebGPU Vision Semantic Forwarder & Summary Generator.
 *
 * Synthesizes the compact structured [Visual Event] summary block (proposal
 * §3) for PROMOTED frames, exactly:
 *
 *   [Visual Event]
 *   Active Window: Terminal (light mode)
 *   OCR Text Snippet: "df: invalid option -- y"
 *
 * Field provenance (deterministic, no VLM required):
 *   - Active Window: mapped from Stage-2 zero-shot top label (terminal /
 *     editor / video) + theme derived from mean frame luminance.
 *   - OCR Text Snippet: cleaned error line from Stage-2 tesseract evidence.
 *   - Screen Content Tags: added ONLY when the VLM caption succeeds
 *     (best-effort enrichment, proposal §3 format).
 *
 * VLM: `Xenova/moondream2` via @huggingface/transformers ONNX. `device:
 * 'webgpu'` is the in-app production target; the Node harness runs CPU
 * (onnxruntime-node), exactly like the Stage-1/2 CLIP towers.
 *
 * NOTICE A (library bug): transformers.js v3.8.1 AutoModelForVision2Seq
 * rejects moondream2 ("Unsupported model type: moondream1") even though the
 * Moondream1ForConditionalGeneration class exists in the bundle — the node
 * build's vision2seq auto-map omits this model_type. We bypass the auto-map
 * by instantiating the class directly.
 *
 * NOTICE B (validation, 2026-08-09): caption path is now END-TO-END
 * VALIDATED on CPU (6s, `Xenova/moondream2` int8). Two transformers.js
 * v3.8.1 quirks had to be worked around:
 *   1. AutoModelForVision2Seq rejects moondream2 -> direct class load.
 *   2. AutoProcessor is image-only AND the merge machinery demands the
 *      `<image>` placeholder appear exactly once per vision patch (729 for a
 *      378x378 SigLIP input). The patch count is probed at runtime via the
 *      vision-encoder session (`model.sessions.vision_encoder.run`), and the
 *      prompt repeats `<image>` that many times.
 * The Moondream2 branch still degrades to deterministic fields on any
 * failure (proposal §11 heuristics fallback), keeping the benchmark green.
 */

import type { ProgressCallback } from './stage1-vision-embed.js'
import type { OcrEvidence } from './stage2-ocr.js'
import type { SalienceLabel, ZeroShotResult } from './stage2-salience-eval.js'

import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

import { AutoProcessor, AutoTokenizer, env, Moondream1ForConditionalGeneration, RawImage } from '@huggingface/transformers'

import { extractErrorSnippet } from './stage2-ocr.js'

const HARNESS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
env.cacheDir = path.join(HARNESS_ROOT, '.cache')

export const VLM_MODEL_ID = 'Xenova/moondream2'

// q8/int8 weight files required before load is safe. NOTICE: from_pretrained
// fails as an UNHANDLED stream 'error' event (not a promise rejection) when a
// download hits ENOSPC, so we never start a download when the disk lacks
// headroom — proposal §11 "Model download declined -> heuristics-only".
// Partial caches are fine: transformers.js downloads only missing files, so a
// cache-resume (e.g. missing vision_encoder after a prior disk-full) works as
// long as free space clears the headroom floor.
const VLM_ONNX_REQUIRED = ['decoder_model_merged_quantized.onnx', 'vision_encoder_quantized.onnx']
const VLM_DOWNLOAD_HEADROOM = 1536 * 1024 * 1024 // 1.5GiB free space needed to attempt a download

function vlmWeightsCached(): boolean {
  const onnxDir = path.join(HARNESS_ROOT, '.cache', 'Xenova', 'moondream2', 'onnx')
  return VLM_ONNX_REQUIRED.every(f => fs.existsSync(path.join(onnxDir, f)))
}

function vlmLoadSafe(): boolean {
  if (vlmWeightsCached())
    return true
  try {
    const stat = fs.statfsSync(HARNESS_ROOT)
    return stat.bavail * stat.bsize >= VLM_DOWNLOAD_HEADROOM
  }
  catch {
    return false
  }
}

const WINDOW_LABELS: Record<SalienceLabel, string> = {
  terminal_error: 'Terminal',
  terminal_normal: 'Terminal',
  code_editor: 'Code Editor',
  video_player: 'Browser (video player)',
}

export interface VlmForwarderResult {
  summary: string
  caption: string | null
  /** 'ok' | 'degraded' | 'error' — VLM availability status. */
  vlmStatus: 'ok' | 'degraded' | 'error'
  vlmMs: number
  note?: string
}

let captionModelPromise: Promise<{ model: any, processor: any, tokenizer: any }> | null = null
let vlmAttempted = false
let numImageTokens: number | null = null

export async function loadCaptioner(onProgress?: ProgressCallback): Promise<{ model: any, processor: any, tokenizer: any }> {
  // NOTICE: direct class load bypasses the AutoModelForVision2Seq auto-map
  // bug (see header NOTICE A).
  const model = await Moondream1ForConditionalGeneration.from_pretrained(VLM_MODEL_ID, {
    device: 'cpu',
    dtype: 'q8',
    progress_callback: onProgress,
  })
  const processor = await AutoProcessor.from_pretrained(VLM_MODEL_ID, { progress_callback: onProgress })
  const tokenizer = await AutoTokenizer.from_pretrained(VLM_MODEL_ID, { progress_callback: onProgress })
  return { model, processor, tokenizer }
}

/**
 * Best-effort VLM caption. Returns null on any failure (disk, download,
 * runtime). Validated recipe (see header NOTICE B): probe the vision encoder
 * session for the patch count, repeat the `<image>` placeholder that many
 * times, wrap in moondream's Question/Answer prompt, then generate + decode.
 */
async function generateCaption(imagePath: string): Promise<{ caption: string, ms: number } | null> {
  try {
    if (!vlmLoadSafe()) {
      vlmAttempted = true
      console.error('  [stage3] VLM load skipped: weights not cached AND free disk < 1.5GiB (guards against ENOSPC crash); using deterministic summary')
      return null
    }
    if (!captionModelPromise) {
      captionModelPromise = loadCaptioner()
    }
    const { model, processor, tokenizer } = await captionModelPromise

    const { data, info } = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const image = new RawImage(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height, info.channels)

    const visionInputs = await processor(image)

    const imageTokens: number = numImageTokens ?? await (async () => {
      const feat = await model.sessions.vision_encoder.run({ pixel_values: visionInputs.pixel_values })
      const count = feat.image_features.dims[1] as number
      numImageTokens = count
      return count
    })()

    const imageTokenId = Number(model.config.image_token_index)
    const prompt = `${'<image>'.repeat(imageTokens)}\n\nQuestion: Describe what is happening in this screenshot in one short sentence.\n\nAnswer:`
    const textInputs = await tokenizer(prompt)
    const imageTokenCount = Array.from(textInputs.input_ids.data as any).filter((x: any) => Number(x) === imageTokenId).length
    if (imageTokenCount !== imageTokens) {
      throw new Error(`image token expansion mismatch: prompt has ${imageTokenCount}, vision produced ${imageTokens}`)
    }

    const started = performance.now()
    const output = await model.generate(
      { ...visionInputs, ...textInputs, max_new_tokens: 48, do_sample: false },
    )
    const decoded = tokenizer.batch_decode(output, { skip_special_tokens: false }) as string[]
    const raw = decoded[0] ?? ''
    const answerIdx = raw.lastIndexOf('Answer:')
    const caption = (answerIdx >= 0 ? raw.slice(answerIdx + 'Answer:'.length) : raw)
      .replace(/<\|endoftext\|>/g, '')
      .trim()
    if (!caption)
      return null
    return { caption, ms: performance.now() - started }
  }
  catch (err: any) {
    vlmAttempted = true
    console.error(`  [stage3] VLM caption failed (${err.code || err.message || String(err)}) — degrading to deterministic summary`)
    return null
  }
}

/** Mapped window category from Stage-2 zero-shot top label. */
export function activeWindowLabel(zeroShot: ZeroShotResult): string {
  return WINDOW_LABELS[zeroShot.topLabel] ?? 'Unknown'
}

/** Theme from mean grayscale luminance: dark < 128 <= light. */
export async function computeTheme(imagePath: string): Promise<'dark' | 'light'> {
  const { data } = await sharp(imagePath).grayscale().resize(64, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true })
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum / data.length >= 128 ? 'light' : 'dark'
}

/** Builds the [Visual Event] summary block from deterministic signals + VLM. */
export async function runForwarder(
  framePath: string,
  zeroShot: ZeroShotResult,
  ocr: OcrEvidence,
  onLog?: (msg: string) => void,
): Promise<VlmForwarderResult> {
  const window = activeWindowLabel(zeroShot)
  const theme = await computeTheme(framePath)
  const snippet = extractErrorSnippet(ocr.text, ocr.errorPatterns)

  const lines = [
    '[Visual Event]',
    `Active Window: ${window} (${theme} mode)`,
  ]

  const captionResult = await generateCaption(framePath)
  const vlmStatus: VlmForwarderResult['vlmStatus'] = captionResult ? 'ok' : vlmAttempted ? 'error' : 'degraded'

  if (captionResult) {
    lines.push(`Screen Content Tags: ${captionResult.caption}`)
  }

  if (snippet) {
    lines.push(`OCR Text Snippet: "${snippet}"`)
  }

  onLog?.(`Active Window: ${window} (${theme} mode)`)
  if (captionResult) {
    onLog?.(`Screen Content Tags: ${captionResult.caption} (VLM ${captionResult.ms.toFixed(0)}ms)`)
  }
  else {
    onLog?.(`Screen Content Tags: <VLM unavailable — ${vlmStatus}>`)
  }
  onLog?.(`OCR Text Snippet: "${snippet}"`)

  return {
    summary: lines.join('\n'),
    caption: captionResult?.caption ?? null,
    vlmStatus,
    vlmMs: captionResult?.ms ?? 0,
    note: captionResult
      ? undefined
      : (vlmStatus === 'error'
          ? 'VLM load/generation failed; deterministic summary used (proposal §11 fallback).'
          : 'VLM model download not attempted/completed (disk full 2026-08-09); deterministic summary used.'),
  }
}

export async function disposeVlmForwarder(): Promise<void> {
  if (captionModelPromise) {
    try {
      const { model } = await captionModelPromise
      await model.dispose?.()
    }
    catch { /* model may never have loaded */ }
    captionModelPromise = null
  }
}
