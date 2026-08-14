import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const mimoConfigSchema = z.object({
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://api.xiaomimimo.com'),
})

type MimoConfig = z.input<typeof mimoConfigSchema>

function generateFingerprint(): string {
  let fp = ''
  if (typeof window !== 'undefined' && window.localStorage) {
    fp = window.localStorage.getItem('mimo_fingerprint') || ''
    if (!fp) {
      const array = new Uint8Array(32)
      if (typeof window.crypto !== 'undefined' && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(array)
      }
      else {
        for (let i = 0; i < 32; i++) {
          array[i] = Math.floor(Math.random() * 256)
        }
      }
      fp = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
      window.localStorage.setItem('mimo_fingerprint', fp)
    }
  }
  else {
    fp = 'c94903eb3d0d05229daaac50d051c65e634462b52034c8b2d79405a51b391f37'
  }
  return fp
}

let cachedJwt: string | null = null

async function getJwt(baseUrl: string): Promise<string> {
  if (cachedJwt)
    return cachedJwt
  const fingerprint = generateFingerprint()
  const bootstrapResponse = await fetch(`${baseUrl}/api/free-ai/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: fingerprint }),
  })
  if (!bootstrapResponse.ok) {
    throw new Error(`Bootstrap failed: ${bootstrapResponse.status}`)
  }
  const data = await bootstrapResponse.json()
  if (!data.jwt) {
    throw new Error('No JWT token returned in bootstrap response.')
  }
  cachedJwt = data.jwt as string
  return cachedJwt
}

export const providerMimo = defineProvider<MimoConfig>({
  id: 'mimo',
  name: 'MiMo',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.mimo.title'),
  description: 'Xiaomi MiMo Code - Zero-friction free AI coding assistant',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.mimo.description'),
  tasks: ['chat'],
  icon: 'i-solar:cpu-bold',
  requiresCredentials: false,
  business: () => ({
    pricing: 'free',
    deployment: 'cloud',
    consoleUrl: 'https://open.xiaomimimo.com/',
  }),

  createProviderConfig: ({ t }) => mimoConfigSchema.extend({
    baseUrl: mimoConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    const provider = createOpenAI('none', config.baseUrl || 'https://api.xiaomimimo.com') as any

    const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      const requestBody = await request.clone().json().catch(() => null)
      if (!requestBody) {
        return fetch(request)
      }

      let jwt: string
      try {
        jwt = await getJwt(config.baseUrl || 'https://api.xiaomimimo.com')
      }
      catch (err: any) {
        return new Response(JSON.stringify({ error: { message: `JWT bootstrap failed: ${err.message}` } }), { status: 401 })
      }

      requestBody.model = 'mimo-auto'

      const MIMO_SYSTEM_MARKER = 'You are MiMoCode, an interactive CLI tool that helps users with software engineering tasks.'
      if (!requestBody.messages) {
        requestBody.messages = []
      }
      const hasSystemMarker = requestBody.messages.some((m: any) => m.role === 'system' && m.content === MIMO_SYSTEM_MARKER)
      if (!hasSystemMarker) {
        requestBody.messages.unshift({ role: 'system', content: MIMO_SYSTEM_MARKER })
      }

      const headers = new Headers(request.headers)
      headers.set('Authorization', `Bearer ${jwt}`)
      headers.set('X-Mimo-Source', 'mimocode-cli-free')
      headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36')
      headers.set('Content-Type', 'application/json')

      const completionsUrl = `${config.baseUrl || 'https://api.xiaomimimo.com'}/api/free-ai/openai/chat`

      return fetch(completionsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: request.signal,
      })
    }

    return {
      ...provider,
      chat: (...args: any[]) => ({
        ...provider.chat(...args),
        fetch: customFetch,
      }),
    }
  },

  extraMethods: {
    listModels: async () => {
      return [
        {
          id: 'mimo-auto',
          name: 'mimo-auto',
          provider: 'mimo',
          description: 'Xiaomi MiMo Code Free Model',
        },
      ]
    },
  },

  validationRequiredWhen() {
    return true
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
      skipApiKeyCheck: true,
    }),
  },
})
