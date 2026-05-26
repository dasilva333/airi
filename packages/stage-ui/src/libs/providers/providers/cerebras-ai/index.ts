import { createCerebras } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const cerebrasConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://api.cerebras.ai/v1/'),
})

type CerebrasConfig = z.input<typeof cerebrasConfigSchema>

export const providerCerebrasAI = defineProvider<CerebrasConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createCerebras(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    cerebrasConfigSchema.extend({
      apiKey: cerebrasConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: cerebrasConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: '1M Free Tokens/Day - Insanely fast LPU inference',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.cerebras.description'),
  icon: 'i-lobe-icons:cerebras',
  iconColor: 'i-lobe-icons:cerebras-color',
  id: 'cerebras-ai',
  name: 'Cerebras',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.cerebras.title'),
  tasks: ['chat'],

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
    }),
  },
})
