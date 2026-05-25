import { createNovita } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const novitaConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://api.novita.ai/openai/'),
})

type NovitaConfig = z.input<typeof novitaConfigSchema>

export const providerNovitaAI = defineProvider<NovitaConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createNovita(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    novitaConfigSchema.extend({
      apiKey: novitaConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: novitaConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'Scalable Cloud - 10,000+ models with ultra-fast, low-latency inference',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.novita.description'),
  icon: 'i-lobe-icons:novita',
  iconColor: 'i-lobe-icons:novita-color',
  id: 'novita-ai',
  name: 'Novita',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.novita.title'),
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
