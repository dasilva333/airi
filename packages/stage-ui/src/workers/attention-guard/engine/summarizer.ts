/**
 * Attention Ecology Guard — Stage 3 WebGPU vision semantic forwarder
 * (Moondream2) + [Visual Event] summary synthesis. Browser-safe; the caption
 * recipe is the one end-to-end VALIDATED in the cleanroom harness
 * (engine/stage3-vlm-forwarder.ts): direct-class load (bypassing the
 * AutoModelForVision2Seq auto-map gap), runtime probe of the vision encoder
 * session for the patch count, `<image>` placeholder repeated once per patch,
 * and moondream's Question/Answer prompt wrapper.
 */

import type { InferenceDevice } from '../../../libs/inference/contract'
import type { SalienceLabel } from './vision'

import { AutoProcessor, AutoTokenizer, Moondream1ForConditionalGeneration, RawImage } from '@huggingface/transformers'

import { disposeTensors } from './vision'

export const VLM_MODEL_ID = 'Xenova/moondream2'

const WINDOW_LABELS: Record<SalienceLabel, string> = {
  terminal_error: 'Terminal',
  terminal_normal: 'Terminal',
  code_editor: 'Code Editor',
  video_player: 'Browser (video player)',
}

let captionModelPromise: Promise<{ model: any, processor: any, tokenizer: any }> | null = null
let numImageTokens: number | null = null

async function loadCaptioner(device: InferenceDevice, progressCallback?: (progress: any) => void): Promise<{ model: any, processor: any, tokenizer: any }> {
  const model = await Moondream1ForConditionalGeneration.from_pretrained(VLM_MODEL_ID, {
    device,
    dtype: { embed_tokens: 'fp32', vision_encoder: 'q8', decoder_model_merged: 'q4' },
    progress_callback: progressCallback,
  })
  const processor = await AutoProcessor.from_pretrained(VLM_MODEL_ID, { progress_callback: progressCallback })
  const tokenizer = await AutoTokenizer.from_pretrained(VLM_MODEL_ID, { progress_callback: progressCallback })
  return { model, processor, tokenizer }
}

/**
 * Best-effort semantic caption. Returns null on any failure (model degrades
 *  to the deterministic summary — proposal §11).
 */
export async function generateCaption(
  imageInput: RawImage | string,
  device: InferenceDevice,
): Promise<{ caption: string, ms: number } | null> {
  let image: RawImage | null = null
  let visionInputs: any = null
  let textInputs: any = null
  let feat: any = null
  let output: any = null

  try {
    if (!captionModelPromise)
      captionModelPromise = loadCaptioner(device)
    const { model, processor, tokenizer } = await captionModelPromise

    image = typeof imageInput === 'string'
      ? await RawImage.fromURL(imageInput)
      : imageInput

    visionInputs = await processor(image)

    const imageTokens: number = numImageTokens ?? await (async () => {
      feat = await model.sessions.vision_encoder.run({ pixel_values: visionInputs.pixel_values })
      const count = feat.image_features.dims[1] as number
      numImageTokens = count
      return count
    })()

    const prompt = `${'<image>'.repeat(imageTokens)}\n\nQuestion: What application or website is open, and what specific window title, active tabs, buttons, code, or text are visible? Do not say "a computer screen displays". Be specific and cite concrete names and text.\n\nAnswer:`
    textInputs = await tokenizer(prompt)

    const started = performance.now()
    output = await model.generate({ ...visionInputs, ...textInputs, max_new_tokens: 96, do_sample: false })
    const decoded = tokenizer.batch_decode(output, { skip_special_tokens: false }) as string[]
    const raw = decoded[0] ?? ''
    const answerIdx = raw.lastIndexOf('Answer:')
    let caption = (answerIdx >= 0 ? raw.slice(answerIdx + 'Answer:'.length) : raw)
      .replace(/<\|endoftext\|>/g, '')
      .trim()

    // Strip generic filler preambles commonly emitted by VLMs
    caption = caption
      .replace(/^(A|The)\s+(computer\s+)?(screen|screenshot|desktop|display|image)\s+(displays?|shows?|depicts?|features?)\s+(a|an)?\s*/i, '')
      .trim()

    if (caption) {
      caption = caption.charAt(0).toUpperCase() + caption.slice(1)
    }

    if (!caption)
      return null
    return { caption, ms: performance.now() - started }
  }
  catch (err: any) {
    console.warn(`[attention-guard] VLM caption failed (${err.message || String(err)}) — deterministic summary used`)
    return null
  }
  finally {
    disposeTensors(visionInputs, textInputs, feat, output)
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

/** Prime the Moondream2 captioner (opt-in Stage-3 warm-up at load time). */
export async function primeCaptioner(device: InferenceDevice, progressCallback?: (progress: any) => void): Promise<void> {
  if (!captionModelPromise)
    captionModelPromise = loadCaptioner(device, progressCallback)
  await captionModelPromise
}

export function activeWindowLabel(topLabel: SalienceLabel): string {
  return WINDOW_LABELS[topLabel] ?? 'Unknown'
}

/** Theme from mean grayscale luminance: dark < 128 <= light. */
export function themeFromGray(gray: Uint8Array): 'dark' | 'light' {
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  return sum / gray.length >= 128 ? 'light' : 'dark'
}

export interface SummaryInput {
  window: string
  theme: 'dark' | 'light'
  caption: string | null
  snippet: string
  matchedInterestTags?: string[]
}

export function buildSummary({ window, theme, caption, snippet, matchedInterestTags }: SummaryInput): string {
  const lines = [
    '[Visual Event]',
    `Active Window: ${window} (${theme} mode)`,
  ]
  if (matchedInterestTags && matchedInterestTags.length > 0)
    lines.push(`Matched Interests: ${matchedInterestTags.join(', ')}`)
  if (caption)
    lines.push(`Screen Content Tags: ${caption}`)
  if (snippet)
    lines.push(`OCR Text Snippet: "${snippet}"`)
  return lines.join('\n')
}
