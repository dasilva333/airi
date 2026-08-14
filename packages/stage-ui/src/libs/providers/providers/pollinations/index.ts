import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const pollinationsConfigSchema = z.object({
  apiKey: z
    .string('API Key')
    .optional()
    .default('none'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://text.pollinations.ai/openai/'),
})

type PollinationsConfig = z.input<typeof pollinationsConfigSchema>

export const providerPollinations = defineProvider<PollinationsConfig>({
  id: 'pollinations',
  name: 'Pollinations AI',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.pollinations.title'),
  description: 'Zero Friction Free - Open-source, no key required chat completions',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.pollinations.description'),
  tasks: ['chat'],
  icon: 'i-solar:cloud-bold',
  requiresCredentials: false,
  business: () => ({
    pricing: 'free',
    deployment: 'cloud',
    consoleUrl: 'https://pollinations.ai',
  }),

  createProviderConfig: ({ t }) => pollinationsConfigSchema.extend({
    apiKey: pollinationsConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: pollinationsConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey || 'none', config.baseUrl)
  },

  extraMethods: {
    listModels: async () => {
      return [
        {
          id: 'openai',
          name: 'openai',
          provider: 'pollinations',
          description: 'Pollinations Default OpenAI Model',
        },
        {
          id: 'openai-fast',
          name: 'openai-fast',
          provider: 'pollinations',
          description: 'Pollinations Fast OpenAI Model',
        },
      ]
    },
  },

  validationRequiredWhen() {
    return true
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity'],
      skipApiKeyCheck: true,
    }),
  },
})
