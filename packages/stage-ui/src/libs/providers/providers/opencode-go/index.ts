import type { System1Response } from '../../types'

import z from 'zod'

import { createOpenAI } from '@xsai-ext/providers/create'
import { nanoid } from 'nanoid'
import { getActivePinia } from 'pinia'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const openCodeGoConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://opencode.ai/zen/go/v1/'),
})

type OpenCodeGoConfig = z.input<typeof openCodeGoConfigSchema>

function getFallbackSessionId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    let id = window.localStorage.getItem('opencode_session_id')
    if (!id) {
      id = `airi-${nanoid()}`
      window.localStorage.setItem('opencode_session_id', id)
    }
    return id
  }
  return 'airi-default-session'
}

export function resolveOpenCodeSessionId(): string {
  if (typeof window === 'undefined')
    return 'airi-default-session'

  try {
    const pinia = getActivePinia()
    if (pinia) {
      const sessionStore = (pinia as any)._s?.get('chat-session') as any
      if (sessionStore?.activeSessionId) {
        return sessionStore.activeSessionId
      }
    }
  }
  catch {}
  return getFallbackSessionId()
}

export const providerOpenCodeGo = defineProvider<OpenCodeGoConfig>({
  id: 'opencode-go',
  name: 'OpenCode Go',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.opencode-go.title'),
  description: 'Developer API Platform - Plans start at $10 a month',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.opencode-go.description'),
  tasks: ['chat', 'vision', 'system1'],
  icon: 'i-lobe-icons:openai-compatible',
  business: () => ({
    pricing: 'paid',
    deployment: 'cloud',
    consoleUrl: 'https://opencode.ai/go',
  }),

  createProviderConfig: ({ t }) => openCodeGoConfigSchema.extend({
    apiKey: openCodeGoConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: openCodeGoConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    const provider = createOpenAI(config.apiKey, config.baseUrl) as any

    const customFetch: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers)
      if (input instanceof Request) {
        input.headers.forEach((value, key) => {
          if (!headers.has(key)) {
            headers.set(key, value)
          }
        })
      }

      if (!headers.has('x-opencode-session')) {
        headers.set('x-opencode-session', resolveOpenCodeSessionId())
      }

      if (input instanceof Request) {
        return fetch(new Request(input, { headers }))
      }

      return fetch(input, { ...init, headers })
    }

    return {
      ...provider,
      chat: (...args: any[]) => {
        const chatObj = provider.chat(...args)
        return {
          ...chatObj,
          headers: {
            ...chatObj.headers,
            'x-opencode-session': resolveOpenCodeSessionId(),
          },
          fetch: customFetch,
        }
      },
      model: (...args: any[]) => ({
        ...provider.model(...args),
        fetch: customFetch,
      }),
      systemOne: async (state: string | object, questions: Record<string, any>, model = 'jev-1.13-free'): Promise<System1Response> => {
        let statePayload: string
        if (typeof state === 'string') {
          statePayload = state
        }
        else if (state && typeof state === 'object' && 'target_turn' in state && (state as any).target_turn?.text) {
          statePayload = (state as any).target_turn.text
        }
        else {
          statePayload = JSON.stringify(state)
        }

        // Normalize model name (strip foreign typesafe/ prefix if passed)
        const normalizedModel = (model || 'jev-1.13-free').replace(/^typesafe\//, '')

        let endpoint = 'https://opencode.ai/zen/v1/systemone'
        if (config.baseUrl && !config.baseUrl.includes('opencode.ai/zen/go/v1')) {
          endpoint = config.baseUrl.endsWith('/')
            ? `${config.baseUrl}systemone`
            : `${config.baseUrl}/systemone`
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            'x-opencode-session': resolveOpenCodeSessionId(),
          },
          body: JSON.stringify({
            model: normalizedModel,
            state: statePayload,
            questions,
          }),
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`[OpenCode Go System-1] API error ${res.status}: ${errText}`)
        }

        return await res.json() as System1Response
      },
    }
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
      additionalHeaders: {
        'x-opencode-session': resolveOpenCodeSessionId(),
      },
    }),
  },
})
