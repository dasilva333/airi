import { createTogetherAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const togetherConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://api.together.xyz/v1/'),
})

type TogetherConfig = z.input<typeof togetherConfigSchema>

export const providerTogetherAI = defineProvider<TogetherConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createTogetherAI(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    togetherConfigSchema.extend({
      apiKey: togetherConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: togetherConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'Open Model Fast Lane - Cost-effective access to fast open-source inference',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.together.description'),
  icon: 'i-lobe-icons:together',
  iconColor: 'i-lobe-icons:together-color',
  id: 'together-ai',
  name: 'Together.ai',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.together.title'),
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
