import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { WebLlmGenerateRequest } from '../../../workers/web-llm/contract'

import { getWebLlmAdapter } from '../../../libs/inference/adapters/web-llm'
import { DEFAULT_WEB_LLM_MODEL } from '../../../libs/inference/constants'
import { openAIChatChunk, openAIChatCompletion, SSE_DONE } from '../web-rwkv/format'

export interface WebLlmProviderConfig {
  /** Curated MLC `model_id`, or a custom id when `modelUrl` is set. Defaults to {@link DEFAULT_WEB_LLM_MODEL}. */
  model?: string
  /** Custom Hugging Face weights URL (omit for curated `model_id`s). */
  modelUrl?: string
  /** Custom `model_lib` WASM URL. Required when `modelUrl` is set. */
  modelLib?: string
  /** Estimated VRAM (MB) for the pre-allocation bookkeeping check. */
  vramMB?: number
}

interface OpenAIChatBody {
  messages?: Array<{ role: string, content: unknown }>
  model?: string
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
}

/** Flatten OpenAI message content (string or text parts) to a plain string. */
function messageText(content: unknown): string {
  if (typeof content === 'string')
    return content
  if (Array.isArray(content))
    return content.map(part => (typeof part?.text === 'string' ? part.text : '')).join('')
  return ''
}

/**
 * Local WebLLM (WebGPU transformer) chat provider.
 *
 * Use when:
 * - Registering an in-browser MLC WebGPU LLM as an OpenAI-compatible `chat`
 *   provider so the existing chat/consciousness flows (`streamText`/
 *   `generateText`) drive it unchanged.
 *
 * Expects:
 * - A WebGPU-capable renderer (WebLLM has no WASM/CPU chat fallback).
 *
 * Returns:
 * - A {@link ChatProvider} whose `chat()` yields an OpenAI-compatible endpoint;
 *   its `fetch` intercepts `/chat/completions`, forwards the OpenAI messages to
 *   the in-browser engine, and streams the model's output as SSE (or a single
 *   JSON body when `stream` is false) — see {@link getWebLlmAdapter}.
 *
 * Unlike web-rwkv (which templates messages into an RWKV "World" prompt),
 * WebLLM consumes OpenAI chat messages natively — the MLC engine applies the
 * model's own chat template — so no prompt templating happens here.
 */
export function createWebLlmChatProvider(config: WebLlmProviderConfig = {}): ChatProvider {
  const defaultModelId = config.model || DEFAULT_WEB_LLM_MODEL

  return {
    chat: (model: string) => ({
      baseURL: 'http://web-llm/v1/',
      model: model || defaultModelId,
      headers: {},
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = (init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {}) as OpenAIChatBody
        // xsai passes the configured model through; an empty/absent value falls
        // back to the provider's default curated model.
        const modelId = body.model?.trim() || defaultModelId

        const adapter = await getWebLlmAdapter()
        // Load-on-demand and reload when the requested model differs from what's
        // resident (the adapter's worker owns one engine = one model at a time).
        if (adapter.state !== 'ready' || adapter.manifest?.modelId !== modelId) {
          await adapter.loadModel(
            { modelId, modelUrl: config.modelUrl, modelLib: config.modelLib, vramMB: config.vramMB },
            { signal: init?.signal ?? undefined },
          )
        }

        const request: WebLlmGenerateRequest = {
          modelId,
          messages: (body.messages ?? []).map(m => ({ role: m.role, content: messageText(m.content) })),
          ...(body.temperature != null ? { temperature: body.temperature } : {}),
          ...(body.top_p != null ? { topP: body.top_p } : {}),
          ...(body.max_tokens != null ? { maxTokens: body.max_tokens } : {}),
        }

        const id = `chatcmpl-${Date.now()}`
        const created = Math.floor(Date.now() / 1000)
        const encoder = new TextEncoder()

        if (body.stream) {
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { role: 'assistant' }, null)))
                await adapter.generate(request, {
                  signal: init?.signal ?? undefined,
                  onToken: (text) => {
                    if (text)
                      controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { content: text }, null)))
                  },
                })
                controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, {}, 'stop')))
                controller.enqueue(encoder.encode(SSE_DONE))
                controller.close()
              }
              catch (error) {
                controller.error(error)
              }
            },
          })

          return new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
          })
        }

        const text = await adapter.generate(request, { signal: init?.signal ?? undefined })
        // Token usage isn't tracked on the JS side (the worker owns the engine), so
        // usage counts are reported as 0 — same convention as the web-rwkv provider.
        return new Response(openAIChatCompletion(id, created, modelId, text, 0, 0), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  }
}
