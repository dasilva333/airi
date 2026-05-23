import type { ChatProvider } from '@xsai-ext/providers/utils'
import type { CommonContentPart, CompletionToolCall, Message, Tool } from '@xsai/shared-chat'

import { useLocalStorage } from '@vueuse/core'
import { generateText } from '@xsai/generate-text'
import { listModels } from '@xsai/model'
import { streamText } from '@xsai/stream-text'
import { defineStore } from 'pinia'
import { toRaw } from 'vue'

import { useSettingsChat } from './settings/chat'

export type StreamEvent
  = | { type: 'text-delta', text: string }
    | { type: 'reasoning-delta', text: string }
    | ({ type: 'finish' } & any)
    | ({ type: 'tool-call' } & CompletionToolCall)
    | { type: 'tool-result', toolCallId: string, result?: string | CommonContentPart[] }
    | { type: 'usage', usage: any }
    | { type: 'error', error: any }

export interface StreamOptions {
  headers?: Record<string, string>
  onStreamEvent?: (event: StreamEvent) => void | Promise<void>
  toolsCompatibility?: Record<string, boolean>
  supportsTools?: boolean
  waitForTools?: boolean // when true,won't resolve on finishReason=='tool_calls';
  tools?: Tool[] | (() => Promise<Tool[] | undefined>)
  abortSignal?: AbortSignal
  temperature?: number
  top_p?: number
  max_tokens?: number
  contextWidth?: number
  vision?: boolean
  requestOverrides?: Record<string, unknown>
}

function sanitizeRequestOverrides(overrides?: Record<string, unknown>) {
  if (!overrides)
    return {}

  const reservedKeys = new Set([
    'messages',
    'headers',
    'tools',
    'onEvent',
    'abortSignal',
    'maxSteps',
  ])

  return Object.fromEntries(
    Object.entries(overrides).filter(([key]) => !reservedKeys.has(key)),
  )
}

// TODO: proper format for other error messages.
export function sanitizeMessages(messages: unknown[], options?: { vision?: boolean }): Message[] {
  // Use JSON snapshotting to completely remove Vue reactivity and ensure cloninability.
  // This is necessary because @xsai libraries use structuredClone internally.
  const rawMessages = JSON.parse(JSON.stringify(toRaw(messages))) as any[]

  return rawMessages.map((m: any) => {
    // NOTICE: We must strictly sanitize the message objects to only include fields
    // accepted by common LLM APIs (OpenAI, Anthropic, etc.). Extra fields like
    // "id", "createdAt", or our custom "_discordSource" metadata can cause
    // 400/502 errors on strict providers like OpenRouter/Phala.
    const sanitized: any = {
      role: m.role,
      content: m.content ?? '',
    }

    if (m.name)
      sanitized.name = m.name
    if (m.tool_calls)
      (sanitized as any).tool_calls = m.tool_calls
    if (m.tool_call_id)
      (sanitized as any).tool_call_id = m.tool_call_id

    if ((sanitized as any).role === 'error') {
      sanitized.role = 'user'
      sanitized.content = `User encountered error: ${String(m.content ?? '')}`
    }

    if (Array.isArray(sanitized.content)) {
      const contentParts = sanitized.content as { type?: string, text?: string }[]

      // If vision is explicitly disabled, strip all image_url parts
      if (options?.vision === false && contentParts.some(p => p?.type === 'image_url')) {
        sanitized.content = contentParts
          .map(p => p?.type === 'image_url' ? '[Image]' : (p?.text ?? ''))
          .filter(Boolean)
          .join(' ')
      }
      // NOTICE: Flatten array content if no images are present for compatibility
      else if (!contentParts.some(p => p?.type === 'image_url')) {
        sanitized.content = contentParts.map(p => p?.text ?? '').join('')
      }
    }

    return sanitized
  })
}

function combineSystemMessagesIfNeeded(messages: Message[], chatConfig: any, settingsChat: any): Message[] {
  const shouldCombine = settingsChat.combineSystemMessages || chatConfig.baseURL?.includes('googleapis.com')

  if (!shouldCombine) {
    return messages
  }

  const systemMessages = messages.filter(m => m.role === 'system')
  if (systemMessages.length <= 1) {
    return messages
  }

  const personaMessages: Message[] = []
  const contextMessages: Message[] = []

  for (const m of systemMessages) {
    const content = typeof m.content === 'string' ? m.content : ''
    const isContext = content.startsWith('These are the contextual information retrieved')
      || content.startsWith('[ENVIRONMENTAL AWARENESS]')
      || content.includes('[CONTEXT_AWARENESS]')

    if (isContext) {
      contextMessages.push(m)
    }
    else {
      personaMessages.push(m)
    }
  }

  const uniquePersonaContents = [...new Set(personaMessages.map(m => typeof m.content === 'string' ? m.content : ''))]
  const dedupedPersonaContent = uniquePersonaContents.join('\n\n')

  const lastContextMessage = contextMessages[contextMessages.length - 1]
  const lastContextContent = lastContextMessage ? (typeof lastContextMessage.content === 'string' ? lastContextMessage.content : '') : ''

  const combinedContent = [dedupedPersonaContent, lastContextContent].filter(Boolean).join('\n\n')

  const nonSystemMessages = messages.filter(m => m.role !== 'system')
  return [
    { role: 'system', content: combinedContent } as Message,
    ...nonSystemMessages,
  ]
}

function streamOptionsToolsCompatibilityOk(model: string, chatProvider: ChatProvider, _: Message[], options?: StreamOptions): boolean {
  if (options?.supportsTools)
    return true
  const key = `${chatProvider.chat(model).baseURL}-${model}`
  return options?.toolsCompatibility?.[key] !== false
}

// Runtime auto-degrade: patterns that indicate the model/provider does not support tool calling.
const TOOLS_RELATED_ERROR_PATTERNS: RegExp[] = [
  /does not support tools/i, // Ollama
  /no endpoints found that support tool use/i, // OpenRouter
  /invalid schema for function/i, // OpenAI-compatible / Groq
  /invalid.?function.?parameters/i, // OpenAI-compatible
  /functions are not supported/i, // Azure AI Foundry
  /unrecognized request argument.+tools/i, // Azure AI Foundry
  /tool use with function calling is unsupported/i, // Google Generative AI
  /tool_use_failed/i, // Groq
  /does not support function.?calling/i, // Anthropic
  /tools?\s+(is|are)\s+not\s+supported/i, // Cloudflare Workers AI
]

export function isToolRelatedError(err: unknown): boolean {
  const msg = String(err)
  return TOOLS_RELATED_ERROR_PATTERNS.some(p => p.test(msg))
}

function sanitizeTools(tools?: Tool[]): Tool[] | undefined {
  if (!tools)
    return undefined

  // Deep clone to avoid mutating the original tool objects
  const cloned = JSON.parse(JSON.stringify(tools)) as Tool[]

  const cleanSchema = (obj: any) => {
    if (!obj || typeof obj !== 'object')
      return

    delete obj.$schema
    delete obj.additionalProperties

    if (obj.properties) {
      const requiredSet = new Set(Array.isArray(obj.required) ? obj.required : [])

      for (const [key, prop] of Object.entries(obj.properties)) {
        if (!prop || typeof prop !== 'object')
          continue

        const p = prop as any
        let isNullable = false

        // Handle anyOf (commonly generated by Zod for nullable/optional fields)
        if (p.anyOf && Array.isArray(p.anyOf)) {
          const nonNullSchemas = p.anyOf.filter((s: any) => s && s.type !== 'null')
          if (nonNullSchemas.length < p.anyOf.length) {
            isNullable = true
          }
          if (nonNullSchemas.length >= 1) {
            const desc = p.description
            Object.assign(p, nonNullSchemas[0])
            if (desc)
              p.description = desc
            delete p.anyOf
          }
        }

        // Handle oneOf
        if (p.oneOf && Array.isArray(p.oneOf)) {
          const nonNullSchemas = p.oneOf.filter((s: any) => s && s.type !== 'null')
          if (nonNullSchemas.length < p.oneOf.length) {
            isNullable = true
          }
          if (nonNullSchemas.length >= 1) {
            const desc = p.description
            Object.assign(p, nonNullSchemas[0])
            if (desc)
              p.description = desc
            delete p.oneOf
          }
        }

        // Handle type as array (e.g. ["string", "null"])
        if (Array.isArray(p.type)) {
          const nonNullTypes = p.type.filter((t: any) => t !== 'null')
          if (nonNullTypes.length < p.type.length) {
            isNullable = true
          }
          p.type = nonNullTypes[0] || 'string'
        }

        // Handle explicit null type
        if (p.type === 'null') {
          isNullable = true
          p.type = 'string'
        }

        if (isNullable) {
          requiredSet.delete(key)
        }

        // Recurse into nested properties/items
        cleanSchema(p)
      }

      if (requiredSet.size > 0) {
        obj.required = Array.from(requiredSet)
      }
      else {
        delete obj.required
      }
    }

    if (obj.items) {
      cleanSchema(obj.items)
    }
  }

  cloned.forEach((t) => {
    if (t.function?.parameters) {
      cleanSchema(t.function.parameters)
      if (t.function.parameters.type !== 'object') {
        t.function.parameters.type = 'object'
      }
      if (!t.function.parameters.properties) {
        t.function.parameters.properties = {}
      }
    }
  })

  // Restore the execute function which was stripped by JSON stringify/parse
  cloned.forEach((clonedTool, idx) => {
    clonedTool.execute = tools[idx].execute
  })

  return cloned
}

async function streamFrom(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
  const headers = options?.headers
  const chatConfig = chatProvider.chat(model)

  const settingsChat = useSettingsChat()
  const processedMessages = combineSystemMessagesIfNeeded(messages, chatConfig, settingsChat)
  const sanitized = sanitizeMessages(processedMessages as unknown[], { vision: options?.vision })
  const requestOverrides = sanitizeRequestOverrides(options?.requestOverrides)
  const resolveTools = async () => {
    const tools = typeof options?.tools === 'function'
      ? await options.tools()
      : options?.tools
    return tools ?? []
  }

  const supportedTools = streamOptionsToolsCompatibilityOk(model, chatProvider, messages, options)
  const rawResolvedTools = supportedTools ? await resolveTools() : undefined
  const tools = sanitizeTools(rawResolvedTools)

  if (tools && tools.length > 0) {
    console.log('Calling LLM with tools', tools.map((t: any) => t.function?.name || t.name))
  }
  else {
    console.log('Calling LLM with NO tools available')
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false
    const resolveOnce = () => {
      if (settled)
        return
      settled = true
      resolve()
    }
    const rejectOnce = (err: unknown) => {
      if (settled)
        return
      settled = true
      reject(err)
    }

    const onEvent = async (event: unknown) => {
      try {
        await options?.onStreamEvent?.(event as StreamEvent)
        if (event && (event as StreamEvent).type === 'finish') {
          // If we are not waiting for tools, resolve immediately on the first finish event.
          // Otherwise, we rely on `result.messages.then()` resolving at the very end of all steps,
          // because buggy endpoints (like Gemini's OpenAI proxy) might erroneously return `stop`
          // instead of `tool_calls` during the first step of a multi-turn tool interaction.
          if (!options?.waitForTools)
            resolveOnce()
        }
        else if (event && (event as StreamEvent).type === 'error') {
          const error = (event as any).error ?? new Error('Stream error')
          rejectOnce(error)
        }
      }
      catch (err) {
        rejectOnce(err)
      }
    }

    try {
      const result = streamText({
        ...chatConfig,
        ...requestOverrides,
        maxSteps: 10,
        messages: sanitized,
        headers,
        temperature: options?.temperature,
        top_p: options?.top_p,
        max_tokens: options?.max_tokens,
        ...(options?.contextWidth ? { num_ctx: options.contextWidth } : {}),
        // TODO: we need Automatic tools discovery
        tools,
        onEvent,
        model,
        abortSignal: options?.abortSignal,
      })

      // We MUST catch all promises returned by streamText to ensure the main promise settles
      // and to prevent "Uncaught (in promise)" errors if the initial handshake fails (e.g. 429).
      // We prioritize result.messages for primary settlement, but ensure any step error
      // that occurs before the first message also triggers a rejection.
      void result.messages.then(() => resolveOnce()).catch((err) => {
        rejectOnce(err)
        console.error('Stream messages error:', err)
      })

      void result.steps.catch((err) => {
        // If the stream steps fail before messages settle, propagate it.
        rejectOnce(err)
        console.error('Stream steps error:', err)
      })

      void result.usage.catch(err => console.error('Stream usage error:', err))

      void result.totalUsage.then((usage) => {
        if (usage) {
          onEvent({ type: 'usage', usage })
        }
      }).catch(err => console.error('Stream totalUsage error:', err))
    }
    catch (err) {
      rejectOnce(err)
    }
  })
}

async function generateFrom(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
  const headers = options?.headers
  const chatConfig = chatProvider.chat(model)
  const settingsChat = useSettingsChat()
  const processedMessages = combineSystemMessagesIfNeeded(messages, chatConfig, settingsChat)
  const sanitized = sanitizeMessages(processedMessages as unknown[], { vision: options?.vision })
  const requestOverrides = sanitizeRequestOverrides(options?.requestOverrides)

  const resolveTools = async () => {
    const tools = typeof options?.tools === 'function'
      ? await options.tools()
      : options?.tools
    return tools ?? []
  }

  const supportedTools = streamOptionsToolsCompatibilityOk(model, chatProvider, messages, options)
  const rawResolvedTools = supportedTools ? await resolveTools() : undefined
  const tools = sanitizeTools(rawResolvedTools)

  if (tools && tools.length > 0) {
    console.log('Calling LLM with tools', tools.map((t: any) => t.function?.name || t.name))
  }
  else {
    console.log('Calling LLM with NO tools available')
  }

  return await generateText({
    ...chatConfig,
    ...requestOverrides,
    maxSteps: 10,
    messages: sanitized,
    headers,
    temperature: options?.temperature,
    top_p: options?.top_p,
    max_tokens: options?.max_tokens,
    ...(options?.contextWidth ? { num_ctx: options.contextWidth } : {}),
    model,
    tools,
  })
}

export async function attemptForToolsCompatibilityDiscovery(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>): Promise<boolean> {
  async function attempt(enable: boolean) {
    let toolsError = false
    try {
      await streamFrom(model, chatProvider, [{ role: 'user', content: 'Hello, world!' }], {
        ...options,
        supportsTools: enable,
        vision: false,
        onStreamEvent: (event) => {
          if (event.type === 'error') {
            const errStr = String(event.error)
            if (errStr.includes('does not support tools') || errStr.includes('No endpoints found that support tool use.')) {
              toolsError = true
            }
          }
        },
      })
      return !toolsError
    }
    catch (err) {
      if (toolsError)
        return false
      throw err
    }
  }

  function promiseAllWithInterval<T>(promises: (() => Promise<T>)[], interval: number): Promise<{ result?: T, error?: any }[]> {
    return new Promise((resolve) => {
      const results: { result?: T, error?: any }[] = []
      let completed = 0

      promises.forEach((promiseFn, index) => {
        setTimeout(() => {
          promiseFn()
            .then((result) => {
              results[index] = { result }
            })
            .catch((err) => {
              results[index] = { error: err }
            })
            .finally(() => {
              completed++
              if (completed === promises.length) {
                resolve(results)
              }
            })
        }, index * interval)
      })
    })
  }

  const attempts = [
    () => attempt(true),
    () => attempt(false),
  ]

  const attemptsResults = await promiseAllWithInterval<boolean | undefined>(attempts, 1000)
  if (attemptsResults.some(res => res.error)) {
    const err = new Error(`Error during tools compatibility discovery for model: ${model}. Errors: ${attemptsResults.map(res => res.error).filter(Boolean).join(', ')}`)
    err.cause = attemptsResults.map(res => res.error).filter(Boolean)
    throw err
  }

  return attemptsResults[0].result === true && attemptsResults[1].result === true
}

export const useLLM = defineStore('llm', () => {
  const toolsCompatibility = useLocalStorage<Record<string, boolean>>('settings/llm/tools-compatibility-v3', {})

  async function stream(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
    const key = `${chatProvider.chat(model).baseURL}-${model}`
    try {
      await streamFrom(model, chatProvider, messages, { ...options, toolsCompatibility: toolsCompatibility.value })
    }
    catch (err) {
      if (isToolRelatedError(err)) {
        console.warn(`[llm] Auto-disabling tools for "${key}" due to tool-related error`)
        toolsCompatibility.value[key] = false
      }
      throw err
    }
  }

  function generate(model: string, chatProvider: ChatProvider, messages: Message[], options?: StreamOptions) {
    return generateFrom(model, chatProvider, messages, { ...options, toolsCompatibility: toolsCompatibility.value })
  }

  async function generateObject<T>(
    model: string,
    chatProvider: ChatProvider,
    options: Omit<import('@proj-airi/stage-shared').StructuredOutputOptions<T>, 'model' | 'apiKey' | 'baseURL'>,
  ) {
    const { generateObject: sharedGenerateObject } = await import('@proj-airi/stage-shared')
    const chatConfig = chatProvider.chat(model)

    return await sharedGenerateObject({
      ...options,
      model,
      apiKey: chatConfig.apiKey,
      baseURL: String(chatConfig.baseURL),
    })
  }

  async function discoverToolsCompatibility(model: string, chatProvider: ChatProvider, _: Message[], options?: Omit<StreamOptions, 'supportsTools'>) {
    // Cached, no need to discover again
    const key = `${chatProvider.chat(model).baseURL}-${model}`
    if (key in toolsCompatibility.value) {
      return
    }

    const res = await attemptForToolsCompatibilityDiscovery(model, chatProvider, _, { ...options, toolsCompatibility: toolsCompatibility.value })
    toolsCompatibility.value[key] = res
  }

  async function models(apiUrl: string, apiKey: string) {
    if (apiUrl === '') {
      return []
    }

    try {
      return await listModels({
        baseURL: (apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`) as `${string}/`,
        apiKey,
      })
    }
    catch (err) {
      if (String(err).includes(`Failed to construct 'URL': Invalid URL`)) {
        return []
      }

      throw err
    }
  }

  return {
    models,
    stream,
    generate,
    generateObject,
    discoverToolsCompatibility,
  }
})
