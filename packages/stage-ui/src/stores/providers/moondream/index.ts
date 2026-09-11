import type { ChatProvider } from '@xsai-ext/providers/utils'

import { getMoondreamAdapter } from '../../../libs/inference/adapters/moondream'
import { openAIChatChunk, openAIChatCompletion, SSE_DONE } from '../web-rwkv/format'

export interface MoondreamProviderConfig {
  model?: string
}

interface OpenAIChatBody {
  messages?: Array<{ role: string, content: unknown }>
  model?: string
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
}

function extractImageAndPrompt(messages: Array<{ role: string, content: unknown }>): { imageUrl: string | null, prompt: string } {
  let imageUrl: string | null = null
  const promptParts: string[] = []

  for (const m of messages) {
    if (typeof m.content === 'string') {
      promptParts.push(m.content)
    }
    else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === 'image_url' && part.image_url?.url) {
          imageUrl = part.image_url.url
        }
        else if (part?.type === 'text' && typeof part.text === 'string') {
          promptParts.push(part.text)
        }
      }
    }
  }

  const prompt = promptParts.filter(Boolean).join('\n\n').trim()
  return { imageUrl, prompt }
}

/**
 * Local Moondream2 Vision-Language Model (VLM) Chat Provider.
 *
 * Implements the ChatProvider interface with an in-browser fetch mock
 * intercepting /chat/completions so that the chat store and useLLM
 * can dispatch multimodal vision requests directly to on-device Moondream2.
 */
export function createMoondreamChatProvider(config: MoondreamProviderConfig = {}): ChatProvider & {
  captionImage: (url: string, opts?: any) => Promise<string>
  loadModel: (opts?: any) => Promise<void>
  state: any
  deviceLossCount: any
  terminate: () => void
} {
  const defaultModelId = config.model || 'Xenova/moondream2'
  const adapter = getMoondreamAdapter()

  const chatProvider: ChatProvider = {
    chat: (model: string) => ({
      baseURL: 'http://moondream-local/v1/',
      model: model || defaultModelId,
      headers: {},
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = (init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {}) as OpenAIChatBody
        const modelId = body.model?.trim() || defaultModelId

        if (adapter.state !== 'ready') {
          await adapter.load(undefined, { signal: init?.signal ?? undefined })
        }

        const { imageUrl, prompt } = extractImageAndPrompt(body.messages ?? [])

        if (!imageUrl) {
          throw new Error('[Moondream2] No image was provided in the chat request. Moondream2 requires an image input.')
        }

        const id = `chatcmpl-${Date.now()}`
        const created = Math.floor(Date.now() / 1000)
        const encoder = new TextEncoder()

        if (body.stream) {
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { role: 'assistant' }, null)))
                const text = await adapter.generateText(imageUrl, prompt, { signal: init?.signal ?? undefined })
                if (text) {
                  controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { content: text }, null)))
                }
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

        const text = await adapter.generateText(imageUrl, prompt, { signal: init?.signal ?? undefined })
        return new Response(openAIChatCompletion(id, created, modelId, text, 0, 0), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    }),
  }

  return Object.assign(chatProvider, {
    captionImage: (url: string, opts?: any) => adapter.generateText(url, opts?.prompt, opts),
    loadModel: (opts?: any) => adapter.load(undefined, opts),
    state: adapter.state,
    deviceLossCount: adapter.deviceLossCount,
    terminate: () => adapter.terminate(),
  })
}
