import { createChatProvider, createEmbedProvider, createModelProvider, merge } from '@xsai-ext/providers/utils'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const googleGenerativeConfigSchema = z.object({
  apiKey: z
    .string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://generativelanguage.googleapis.com/v1beta/openai/'),
})

type GoogleGenerativeConfig = z.infer<typeof googleGenerativeConfigSchema>

/**
 * Gemini SSE Healer
 * Google's v1beta/openai endpoint returns tool_calls without an index,
 * which causes the @xsai parser to drop them. This fetch wrapper
 * injects the missing index and type properties.
 */
const googleFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const payload = JSON.parse(init.body)
      if (payload && typeof payload === 'object' && 'reasoning' in payload) {
        delete payload.reasoning
        init.body = JSON.stringify(payload)
      }
    }
    catch {
      // Ignore
    }
  }

  const response = await fetch(input, init)

  // Only intercept chat completion streams
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const isStream = init?.body && typeof init.body === 'string' && JSON.parse(init.body).stream === true

  if (url.includes('/chat/completions') && isStream && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    let buffer = ''

    const transformLine = (line: string) => {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6))
          const toolCalls = data.choices?.[0]?.delta?.tool_calls
          if (toolCalls) {
            for (let i = 0; i < toolCalls.length; i++) {
              if (toolCalls[i].index === undefined)
                toolCalls[i].index = i
              if (toolCalls[i].type === undefined)
                toolCalls[i].type = 'function'
            }
            return `data: ${JSON.stringify(data)}`
          }
        }
        catch {
          // Ignore invalid JSON
        }
      }
      return line
    }

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer) {
            controller.enqueue(encoder.encode(transformLine(buffer)))
          }
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()!

        for (const line of lines) {
          controller.enqueue(encoder.encode(`${transformLine(line)}\n`))
        }
      },
      cancel() {
        reader.cancel()
      },
    })

    return new Response(stream, response)
  }

  return response
}

export const providerGoogleGenerativeAI = defineProvider<GoogleGenerativeConfig>({
  id: 'google-generative-ai',
  order: 8,
  name: 'Google Gemini',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.google-generative-ai.title'),
  description: 'Gemini Integration - Native Google ecosystem intelligence',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.google-generative-ai.description'),
  tasks: ['chat', 'vision'],
  icon: 'i-lobe-icons:google',
  business: () => ({
    pricing: 'paid',
    deployment: 'cloud',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
  }),
  iconColor: 'i-lobe-icons:gemini-color',

  createProviderConfig: ({ t }) => googleGenerativeConfigSchema.extend({
    apiKey: googleGenerativeConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: googleGenerativeConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    const options = {
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      fetch: googleFetch,
    }

    return merge(
      createChatProvider(options),
      createModelProvider(options),
      createEmbedProvider(options),
    )
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
    }),
  },
})
