/**
 * Kokoro TTS Constants
 * Centralized constants for Kokoro TTS to avoid duplication
 */

import type { WebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'

/**
 * Platform types for Kokoro models
 */
export type KokoroPlatform = 'webgpu' | 'wasm'

/**
 * Kokoro model definition
 */
export interface KokoroModel {
  /** Model identifier/quantization string */
  id: string
  /** Human-readable name */
  name: string
  /** Platform required to run this model */
  platform: KokoroPlatform
  /** Quantization value to pass to loadModel */
  quantization: string
  /** i18n key for model description */
  descriptionKey: string
}

/**
 * Available Kokoro models with their platform requirements.
 *
 * Ordering is the dropdown order: WebGPU group first (the faster device, holds
 * the default), then the WASM group; within each group, lightest/fastest
 * quantization first (q4) up to full precision (fp32).
 */
export const KOKORO_MODELS = [
  // WebGPU group. kokoro-js recommends dtype="fp32" for webgpu, but the lighter
  // int8 / int4 weights synthesize faster (which helps stay under the generate
  // inactivity timeout) and run on baseline WebGPU compute — no `shader-f16`
  // feature required (unlike fp16-webgpu).
  {
    id: 'q4-webgpu',
    name: 'Q4 (WebGPU)',
    platform: 'webgpu',
    quantization: 'q4',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.q4-webgpu.description',
  },
  {
    id: 'q8-webgpu',
    name: 'Q8 (WebGPU)',
    platform: 'webgpu',
    quantization: 'q8',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.q8-webgpu.description',
  },
  {
    id: 'fp16-webgpu',
    name: 'FP16 (WebGPU)',
    platform: 'webgpu',
    quantization: 'fp16',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.fp16-webgpu.description',
  },
  {
    id: 'fp32-webgpu',
    name: 'FP32 (WebGPU)',
    platform: 'webgpu',
    quantization: 'fp32',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.fp32-webgpu.description',
  },
  // WASM group, same lightest → full-precision ordering. q4f16 (4-bit weights,
  // fp16 compute) sits just above pure q4.
  {
    id: 'q4',
    name: 'Q4 (WASM)',
    platform: 'wasm',
    quantization: 'q4',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.q4.description',
  },
  {
    id: 'q4f16',
    name: 'Q4F16 (WASM)',
    platform: 'wasm',
    quantization: 'q4f16',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.q4f16.description',
  },
  {
    id: 'q8',
    name: 'Q8 (WASM)',
    platform: 'wasm',
    quantization: 'q8',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.q8.description',
  },
  {
    id: 'fp16',
    name: 'FP16 (WASM)',
    platform: 'wasm',
    quantization: 'fp16',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.fp16.description',
  },
  {
    id: 'fp32',
    name: 'FP32 (WASM)',
    platform: 'wasm',
    quantization: 'fp32',
    descriptionKey: 'settings.pages.providers.provider.kokoro-local.models.fp32.description',
  },
] as const

/**
 * Type for Kokoro quantization options
 */
export type KokoroQuantization = typeof KOKORO_MODELS[number]['id']

/**
 * Resolve `hasWebGPU` from cached capabilities, falling back to a `navigator.gpu`
 * presence probe when detection has not been awaited yet (cold cache). The probe
 * cannot tell apart fp16/quantization sub-features, so those default to false
 * until the real detection result is cached.
 */
function hasWebGPUFrom(caps: WebGPUCapabilities | null): boolean {
  return caps?.supported ?? (typeof navigator !== 'undefined' && !!navigator.gpu)
}

/**
 * Convert Kokoro models to ModelInfo array, filtered by what the current WebGPU
 * device can actually run.
 *
 * Use when:
 * - Populating the Kokoro model dropdown / provider `listModels` result.
 *
 * Expects:
 * - `caps` is the result of `getCachedWebGPUCapabilities()` (or `null` if
 *   detection has not run — treated as a cold-cache `navigator.gpu` probe).
 *
 * Returns:
 * - ModelInfo objects for every model whose device + quantization the adapter
 *   supports: `webgpu` models require WebGPU; `fp16-webgpu` additionally needs
 *   `fp16Supported` (the `shader-f16` feature). The int8 / int4 webgpu variants
 *   need only baseline WebGPU compute, so the `webgpu` device gate covers them.
 */
export function kokoroModelsToModelInfo(caps: WebGPUCapabilities | null, t?: (key: string) => string) {
  const hasWebGPU = hasWebGPUFrom(caps)
  return KOKORO_MODELS
    .filter((model) => {
      if (model.platform === 'webgpu' && !hasWebGPU)
        return false
      // fp16 (and the fp16-compute q4f16) need the `shader-f16` feature; the
      // int8 / int4 webgpu variants run on baseline WebGPU compute (no extra gate).
      if (model.id === 'fp16-webgpu' && !caps?.fp16Supported)
        return false
      return true
    })
    .map(model => ({
      id: model.id,
      name: model.name,
      provider: 'kokoro-local',
      description: t ? t(model.descriptionKey) : model.descriptionKey,
    }))
}

/**
 * Get the default model based on WebGPU availability.
 *
 * @param caps - Cached WebGPU capabilities (or `null` before detection has run).
 * @returns The default model id to use.
 */
export function getDefaultKokoroModel(caps: WebGPUCapabilities | null): KokoroQuantization {
  // On WebGPU prefer fp16 when the `shader-f16` feature is present, else fp32 —
  // the precise/robust path kokoro-js recommends for webgpu. The lighter q4/q8
  // webgpu variants are offered as opt-in options, not the default.
  if (hasWebGPUFrom(caps))
    return caps?.fp16Supported ? 'fp16-webgpu' : 'fp32-webgpu'
  return 'q4f16'
}

/**
 * Static metadata for all voices built into kokoro-js.
 * Kokoro's voice styles are constant trait vectors bundled with the engine;
 * they are independent of the model's ONNX weights or quantization precision.
 */
export const KOKORO_VOICES = Object.freeze({
  af_heart: { name: 'Heart', language: 'en-us', gender: 'Female', traits: '❤️', targetQuality: 'A', overallGrade: 'A' },
  af_alloy: { name: 'Alloy', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C' },
  af_aoede: { name: 'Aoede', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C+' },
  af_bella: { name: 'Bella', language: 'en-us', gender: 'Female', traits: '🔥', targetQuality: 'A', overallGrade: 'A-' },
  af_jessica: { name: 'Jessica', language: 'en-us', gender: 'Female', targetQuality: 'C', overallGrade: 'D' },
  af_kore: { name: 'Kore', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C+' },
  af_nicole: { name: 'Nicole', language: 'en-us', gender: 'Female', traits: '🎧', targetQuality: 'B', overallGrade: 'B-' },
  af_nova: { name: 'Nova', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C' },
  af_river: { name: 'River', language: 'en-us', gender: 'Female', targetQuality: 'C', overallGrade: 'D' },
  af_sarah: { name: 'Sarah', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C+' },
  af_sky: { name: 'Sky', language: 'en-us', gender: 'Female', targetQuality: 'B', overallGrade: 'C-' },
  am_adam: { name: 'Adam', language: 'en-us', gender: 'Male', targetQuality: 'D', overallGrade: 'F+' },
  am_echo: { name: 'Echo', language: 'en-us', gender: 'Male', targetQuality: 'C', overallGrade: 'D' },
  am_eric: { name: 'Eric', language: 'en-us', gender: 'Male', targetQuality: 'C', overallGrade: 'D' },
  am_fenrir: { name: 'Fenrir', language: 'en-us', gender: 'Male', targetQuality: 'B', overallGrade: 'C+' },
  am_liam: { name: 'Liam', language: 'en-us', gender: 'Male', targetQuality: 'C', overallGrade: 'D' },
  am_michael: { name: 'Michael', language: 'en-us', gender: 'Male', targetQuality: 'B', overallGrade: 'C+' },
  am_onyx: { name: 'Onyx', language: 'en-us', gender: 'Male', targetQuality: 'C', overallGrade: 'D' },
  am_puck: { name: 'Puck', language: 'en-us', gender: 'Male', targetQuality: 'B', overallGrade: 'C+' },
  am_santa: { name: 'Santa', language: 'en-us', gender: 'Male', targetQuality: 'C', overallGrade: 'D-' },
  bf_emma: { name: 'Emma', language: 'en-gb', gender: 'Female', traits: '🚺', targetQuality: 'B', overallGrade: 'B-' },
  bf_isabella: { name: 'Isabella', language: 'en-gb', gender: 'Female', targetQuality: 'B', overallGrade: 'C' },
  bm_george: { name: 'George', language: 'en-gb', gender: 'Male', targetQuality: 'B', overallGrade: 'C' },
  bm_lewis: { name: 'Lewis', language: 'en-gb', gender: 'Male', targetQuality: 'C', overallGrade: 'D+' },
  bf_alice: { name: 'Alice', language: 'en-gb', gender: 'Female', traits: '🚺', targetQuality: 'C', overallGrade: 'D' },
  bf_lily: { name: 'Lily', language: 'en-gb', gender: 'Female', traits: '🚺', targetQuality: 'C', overallGrade: 'D' },
  bm_daniel: { name: 'Daniel', language: 'en-gb', gender: 'Male', traits: '🚹', targetQuality: 'C', overallGrade: 'D' },
  bm_fable: { name: 'Fable', language: 'en-gb', gender: 'Male', traits: '🚹', targetQuality: 'B', overallGrade: 'C' },
} as const)

const KOKORO_LANGUAGE_MAP: Record<string, { code: string, title: string }> = {
  'en-us': { code: 'en-US', title: 'English (US)' },
  'en-gb': { code: 'en-GB', title: 'English (UK)' },
  'ja': { code: 'ja', title: 'Japanese' },
  'zh-cn': { code: 'zh-CN', title: 'Chinese (Mandarin)' },
  'es': { code: 'es', title: 'Spanish' },
  'fr': { code: 'fr', title: 'French' },
  'hi': { code: 'hi', title: 'Hindi' },
  'it': { code: 'it', title: 'Italian' },
  'pt-br': { code: 'pt-BR', title: 'Portuguese (Brazil)' },
}

export interface KokoroVoiceInfo {
  id: string
  name: string
  provider: 'kokoro-local'
  languages: { code: string, title: string }[]
  gender: string
}

/**
 * Return formatted Kokoro voice info list immediately without awaiting model weights download.
 */
export function getKokoroVoiceList(): KokoroVoiceInfo[] {
  return Object.entries(KOKORO_VOICES).map(([id, voice]) => {
    const languageCode = voice.language.toLowerCase()
    const languageInfo = KOKORO_LANGUAGE_MAP[languageCode] || { code: languageCode, title: voice.language }

    return {
      id,
      name: `${voice.name} (${voice.gender}, ${languageInfo.title.split('(')[0].trim()})`,
      provider: 'kokoro-local',
      languages: [languageInfo],
      gender: voice.gender.toLowerCase(),
    }
  })
}
