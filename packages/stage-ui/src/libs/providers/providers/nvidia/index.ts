import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const nvidiaConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://integrate.api.nvidia.com/v1/'),
})

type NvidiaConfig = z.input<typeof nvidiaConfigSchema>

export const providerNvidia = defineProvider<NvidiaConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    nvidiaConfigSchema.extend({
      apiKey: nvidiaConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: nvidiaConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'NIM Optimized - High-performance inference on NVIDIA GPU infrastructure',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.nvidia.description'),
  icon: 'i-simple-icons:nvidia',
  id: 'nvidia',
  isAvailableBy: isStageTamagotchi,
  name: 'NVIDIA NIM',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.nvidia.title'),
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
