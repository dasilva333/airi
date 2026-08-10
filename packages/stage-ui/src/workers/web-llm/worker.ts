/**
 * WebLLM (`@mlc-ai/web-llm`) Web Worker entry point.
 *
 * Wraps `CreateMLCEngine` behind the Eventa inference contract (see
 * `libs/inference/contract.ts`): load is a server-streaming invoke (download /
 * shader-compile progress then a terminal `ready`), generate is a
 * server-streaming invoke emitting decoded text deltas, unload is unary.
 *
 * WebLLM is **WebGPU-only** for chat — the MLC runtime calls `navigator.gpu` and
 * there is no WASM/CPU chat fallback. The engine owns its own `GPUDevice`
 * (created via `requestAdapter()` inside this worker); the GPU-slot
 * serialization and VRAM bookkeeping live on the main-thread side (the adapter),
 * which is the same split web-rwkv uses.
 *
 * Model sourcing: curated models come from `prebuiltAppConfig.model_list` (the
 * npm-pinned source of truth for which `model_lib` WASM binaries are compatible
 * with this WebLLM version). A custom Hugging Face repo is appended as an extra
 * `ModelRecord` — every WebGPU model needs two synchronized assets (weights +
 * matching `model_lib` WASM), so a custom entry requires both a weights URL and
 * a WASM lib URL; an unverified repo without a published WASM lib 404s at load.
 */

import type { ModelRecord } from '@mlc-ai/web-llm'

import type { LoadStreamItem } from '../../libs/inference/contract'
import type {
  WebLlmGenerateChunk,
  WebLlmGenerateRequest,
  WebLlmLoadRequest,
} from './contract'

import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm'
import { defineInvokeHandler, defineStreamInvokeHandler, toStreamHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/webworkers/worker'

import {
  webLlmGenerateEvent,
  webLlmLoadEvent,
  webLlmUnloadEvent,
} from '../../libs/inference/contract'

const { context } = createContext()

// MLCEngine is a heavy, mutable class; typed loosely here because the runtime is
// only exercised inside the worker and its public surface (chat.completions,
// reload, unload, setInitProgressCallback) is used dynamically.
type Engine = Awaited<ReturnType<typeof CreateMLCEngine>>

let engine: Engine | null = null
/** The model id the engine currently has loaded, or null when bare. */
let loadedModelId: string | null = null

/**
 * Map an MLC `InitProgressReport` onto the shared `LoadStreamItem` wire shape.
 * `report.progress` is a 0..1 fraction; the shared contract normalizes to
 * 0..100 percent. `report.text` is a human-readable phase string
 * ("Fetching param cache", "Loading model", etc.) that doubles as the message.
 */
function toProgress(report: { progress: number, text: string }): LoadStreamItem {
  const percent = Number.isFinite(report.progress) ? Math.round(report.progress * 100) : -1
  return {
    kind: 'progress',
    payload: { phase: 'download', percent, message: report.text },
  }
}

/**
 * Build the `AppConfig` for a load request: the full prebuilt catalog plus a
 * custom record when the request carries a weights URL.
 */
function buildAppConfig(request: WebLlmLoadRequest) {
  const modelList: ModelRecord[] = [...prebuiltAppConfig.model_list]

  if (request.modelUrl) {
    if (!request.modelLib) {
      throw new Error(
        'web-llm: a custom Hugging Face model requires both a weights URL and a matching `model_lib` WASM URL. '
        + 'Unverified repos without a published WASM binary return 404 at runtime.',
      )
    }
    modelList.push({
      model: request.modelUrl,
      model_id: request.modelId,
      model_lib: request.modelLib,
      ...(request.vramMB != null ? { vram_required_MB: request.vramMB } : {}),
    })
  }

  return { model_list: modelList, cacheBackend: prebuiltAppConfig.cacheBackend }
}

defineStreamInvokeHandler(context, webLlmLoadEvent, toStreamHandler<WebLlmLoadRequest, LoadStreamItem>(async ({ payload, emit, options }) => {
  const signal = options?.abortController?.signal

  // Already loaded with the requested model — nothing to do. A custom repo with
  // the same modelId but a different weights URL still reloads (engine state
  // alone can't distinguish that), but the common case is a repeated load of the
  // same curated model, which this short-circuits.
  if (engine && loadedModelId === payload.modelId) {
    emit({ kind: 'ready', info: { device: 'webgpu', metadata: { model: payload.modelId } } })
    return
  }

  const appConfig = buildAppConfig(payload)

  emit({ kind: 'progress', payload: { phase: 'download', percent: -1, message: 'Initializing WebLLM engine...' } })
  console.info('[web-llm:worker] creating engine', { modelId: payload.modelId, custom: !!payload.modelUrl })

  // A previous engine may hold VRAM for a different model. Dispose it before
  // allocating the new one so the swap frees the old weights first (the
  // pre-allocation check on the main thread assumes the prior model is gone).
  if (engine) {
    try {
      await engine.unload()
    }
    catch (error) {
      console.warn('[web-llm:worker] unload() before reload threw (continuing):', error)
    }
    engine = null
    loadedModelId = null
  }

  try {
    const created = await CreateMLCEngine(payload.modelId, {
      appConfig,
      initProgressCallback: (report) => {
        emit(toProgress(report))
      },
    })
    if (signal?.aborted) {
      await created.unload().catch(() => {})
      return
    }
    engine = created
    loadedModelId = payload.modelId
  }
  catch (error) {
    // Surface MLC's device-lost / OOM message verbatim — it already tells the
    // user to reload with a smaller model; the adapter classifies it via
    // classifyError() into DEVICE_LOST / OOM for telemetry and restart.
    console.error('[web-llm:worker] engine creation failed:', error)
    throw error
  }

  console.info('[web-llm:worker] model ready', { modelId: payload.modelId })
  emit({ kind: 'ready', info: { device: 'webgpu', metadata: { model: payload.modelId } } })
}))

defineStreamInvokeHandler(context, webLlmGenerateEvent, toStreamHandler<WebLlmGenerateRequest, WebLlmGenerateChunk>(async ({ payload, emit, options }) => {
  if (!engine || loadedModelId !== payload.modelId)
    throw new Error(`web-llm: model not loaded (loaded=${loadedModelId ?? 'none'}, requested=${payload.modelId}). Call load first.`)

  const signal = options?.abortController?.signal

  const stream = await engine.chat.completions.create({
    model: payload.modelId,
    messages: payload.messages.map(m => ({ role: m.role as never, content: m.content })),
    stream: true,
    ...(payload.temperature != null ? { temperature: payload.temperature } : {}),
    ...(payload.topP != null ? { top_p: payload.topP } : {}),
    ...(payload.maxTokens != null ? { max_tokens: payload.maxTokens } : {}),
  })

  for await (const chunk of stream) {
    if (signal?.aborted)
      return
    const delta = chunk.choices?.[0]?.delta
    const text = delta && 'content' in delta ? (delta.content ?? '') : ''
    if (text)
      emit({ text })
  }
}))

defineInvokeHandler(context, webLlmUnloadEvent, async () => {
  if (engine) {
    try {
      await engine.unload()
    }
    catch (error) {
      console.warn('[web-llm:worker] unload() threw:', error)
    }
    engine = null
    loadedModelId = null
  }
})
