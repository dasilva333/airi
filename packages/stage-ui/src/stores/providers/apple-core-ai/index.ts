import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { TokenStreamEvent } from '../../../libs/native-ai'

import { toast } from 'vue-sonner'

import { NativeAI } from '../../../libs/native-ai'
import { openAIChatChunk, openAIChatCompletion, SSE_DONE } from '../web-rwkv/format'

export const DEFAULT_APPLE_CORE_AI_MODEL = 'okayuji/Gemma-4-E2B-it-coreml-speculative'

export interface AppleCoreAIProviderConfig {
  /** Model ID (e.g. 'okayuji/Gemma-4-E2B-it-coreml-speculative'). */
  model?: string
  /** Compute units to target ('all' | 'cpuAndGPU' | 'cpuOnly'). */
  computeUnits?: 'all' | 'cpuAndGPU' | 'cpuOnly'
}

interface OpenAIChatBody {
  messages?: Array<{ role: string, content: unknown }>
  model?: string
  stream?: boolean
  temperature?: number
  top_p?: number
  max_tokens?: number
}

/** Flatten OpenAI message content to a clean string. */
function messageText(content: unknown): string {
  if (typeof content === 'string')
    return content
  if (Array.isArray(content))
    return content.map(part => (typeof part?.text === 'string' ? part.text : '')).join('')
  return ''
}

/**
 * Formats standard chat messages into a clean prompt string for Gemma / Core AI models.
 */
function buildGemmaPrompt(messages: Array<{ role: string, content: unknown }>): string {
  let prompt = ''
  for (const msg of messages) {
    const text = messageText(msg.content).trim()
    if (!text)
      continue

    if (msg.role === 'system') {
      prompt += `<start_of_turn>system\n${text}<end_of_turn>\n`
    }
    else if (msg.role === 'user') {
      prompt += `<start_of_turn>user\n${text}<end_of_turn>\n`
    }
    else if (msg.role === 'assistant') {
      prompt += `<start_of_turn>assistant\n${text}<end_of_turn>\n`
    }
    else {
      prompt += `${msg.role}: ${text}\n`
    }
  }

  prompt += '<start_of_turn>assistant\n'
  return prompt
}

/**
 * Native Apple Silicon Core AI / CoreML Chat Provider.
 *
 * Runs locally on iOS/iPadOS/macOS via the native Swift Capacitor plugin (`NativeAIPlugin`),
 * offloading inference to Apple Neural Engine (ANE) and Metal GPU with zero WebKit memory footprint.
 */
export function createAppleCoreAIChatProvider(config: AppleCoreAIProviderConfig = {}): ChatProvider {
  const defaultModelId = config.model || DEFAULT_APPLE_CORE_AI_MODEL

  return {
    chat: (model: string) => ({
      baseURL: 'http://apple-core-ai/v1/',
      model: model || defaultModelId,
      headers: {},
      fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = (init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {}) as OpenAIChatBody
        const modelId = body.model?.trim() || defaultModelId
        const id = `chatcmpl-coreai-${Date.now()}`
        const created = Math.floor(Date.now() / 1000)
        const encoder = new TextEncoder()

        // 1. Ensure model is downloaded, compiled, and loaded into RAM
        const isCached = await NativeAI.isModelCached(modelId)
        if (!isCached) {
          toast.info('Downloading on-device Gemma 4 CoreML model (first-run setup)...', {
            duration: 8000,
          })
        }

        await NativeAI.ensureModelReady(
          {
            modelId,
            computeUnits: config.computeUnits || 'all',
          },
          (progress) => {
            if (progress.percentage >= 99 && !progress.isCompleted) {
              toast.info('Compiling neural graphs on Apple Neural Engine (ANE)...', {
                duration: 6000,
              })
            }
          },
        )

        // 2. Format chat messages into prompt
        const formattedPrompt = buildGemmaPrompt(body.messages || [])
        const maxTokens = body.max_tokens || 512
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

        if (body.stream) {
          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              let streamHandle: { stop: () => Promise<void> } | null = null

              // Send initial role delta
              controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { role: 'assistant' }, null)))

              // Handle abort signal
              const onAbort = async () => {
                if (streamHandle) {
                  await streamHandle.stop().catch(() => {})
                }
              }

              if (init?.signal) {
                init.signal.addEventListener('abort', onAbort, { once: true })
              }

              try {
                streamHandle = await NativeAI.generateStream(
                  {
                    requestId,
                    modelId,
                    prompt: formattedPrompt,
                    maxTokens,
                  },
                  (event: TokenStreamEvent) => {
                    if (event.token) {
                      controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, { content: event.token }, null)))
                    }

                    if (event.isFinished) {
                      controller.enqueue(encoder.encode(openAIChatChunk(id, created, modelId, {}, event.finishReason || 'stop')))
                      controller.enqueue(encoder.encode(SSE_DONE))
                      controller.close()
                    }
                  },
                )
              }
              catch (err) {
                console.error('[AppleCoreAIProvider] Generation error:', err)
                controller.error(err)
              }
              finally {
                if (init?.signal) {
                  init.signal.removeEventListener('abort', onAbort)
                }
              }
            },
          })

          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': 'text/event-stream; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          })
        }
        else {
          // Non-streaming fallback
          return new Promise<Response>((resolve, reject) => {
            let fullText = ''
            let tokenCount = 0

            NativeAI.generateStream(
              {
                requestId,
                modelId,
                prompt: formattedPrompt,
                maxTokens,
              },
              (event: TokenStreamEvent) => {
                if (event.token) {
                  fullText += event.token
                  tokenCount += 1
                }
                if (event.isFinished) {
                  const responseBody = openAIChatCompletion(id, created, modelId, fullText, 10, tokenCount)
                  resolve(new Response(responseBody, {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                  }))
                }
              },
            ).catch(reject)
          })
        }
      },
    }),
  }
}
