/**
 * WebLLM (`@mlc-ai/web-llm`) WebGPU transformer worker contract.
 *
 * Payload/response shapes for the WebLLM worker. Kept DOM-free so both the
 * main-thread adapter and the worker import them without pulling in the MLC
 * runtime. The Eventa event *definitions* live in `libs/inference/contract.ts`
 * alongside every other inference worker (AGENTS.md: define Eventa events once
 * in a shared module); this module holds only the WebLLM-specific types.
 *
 * Transport & streaming mirror web-rwkv: load is a server-streaming invoke
 * (`progress` items then one terminal `ready`), generate is a server-streaming
 * invoke emitting decoded text deltas, unload is a unary invoke.
 */

import type { LoadStreamItem } from '../../libs/inference/contract'

/**
 * A single WebLLM model entry the user can select. Curated entries carry the
 * MLC `model_id`; a custom entry carries a user-supplied Hugging Face repo plus
 * the `model_lib` WASM URL it pairs with (see the two-asset requirement in the
 * proposal — every WebGPU model needs both weights and a matching WASM lib).
 */
export interface WebLlmModelEntry {
  /** MLC `model_id` (curated) or the custom model id (custom repo). */
  id: string
  /** Display name for the settings combobox. */
  name: string
  /** Short description / strategic fit note. */
  description?: string
  /** Estimated VRAM in MB from the prebuilt catalog, when known. */
  vramMB?: number
  /**
   * Hugging Face repo URL the weights resolve from. Present only for custom
   * entries; curated entries use the MLC CDN record keyed by `id`.
   */
  modelUrl?: string
  /**
   * `model_lib` WASM binary URL for custom entries. Required when `modelUrl`
   * is set; unverified repos without a published WASM lib 404 at runtime.
   */
  modelLib?: string
}

/** Request to load a model into the WebLLM worker. WebGPU-only. */
export interface WebLlmLoadRequest {
  /** Always `'webgpu'` — WebLLM has no WASM/CPU chat fallback. */
  device: 'webgpu'
  /** MLC `model_id` for curated models, or a custom id when `modelUrl` is set. */
  modelId: string
  /** Custom model weights URL (HF repo). Omit for curated `modelId`s. */
  modelUrl?: string
  /** Custom `model_lib` WASM URL. Required when `modelUrl` is set. */
  modelLib?: string
  /**
   * Estimated VRAM in MB for the pre-allocation bookkeeping check. The worker
   * verifies the request against the detected budget before allocating, so a
   * too-large model fails fast with a clear message instead of an OOM crash.
   */
  vramMB?: number
  /** Optional Hugging Face token for authenticated downloads. */
  hfToken?: string
}

/** One OpenAI-style chat message forwarded to the engine. */
export interface WebLlmChatMessage {
  role: 'system' | 'user' | 'assistant' | string
  content: string
}

/** Sampling + history for one WebLLM chat completion. */
export interface WebLlmGenerateRequest {
  /** Model to run; must match the currently loaded model or the worker reloads. */
  modelId: string
  /** Full chat history (OpenAI semantics — the engine resets per request). */
  messages: WebLlmChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
}

/** One streamed decoded-text delta from WebLLM generation. */
export interface WebLlmGenerateChunk {
  text: string
}

export type { LoadStreamItem }
