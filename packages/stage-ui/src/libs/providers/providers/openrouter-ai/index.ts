import { createOpenRouter } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const openRouterConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://openrouter.ai/api/v1/'),
})

type OpenRouterConfig = z.input<typeof openRouterConfigSchema>

export const providerOpenRouterAI = defineProvider<OpenRouterConfig>({
  business: () => ({
    beginnerRecommended: true,
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createOpenRouter(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    openRouterConfigSchema.extend({
      apiKey: openRouterConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: openRouterConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'The Unified Interface - Access dozens of free & paid models',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.openrouter.description'),
  icon: 'i-lobe-icons:openrouter',
  id: 'openrouter-ai',
  name: 'OpenRouter',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.openrouter.title'),
  order: 0,
  tasks: ['chat', 'vision'],

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
    }),
  },
})
