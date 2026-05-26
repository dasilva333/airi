import { createDeepSeek } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const deepSeekConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://api.deepseek.com/'),
})

type DeepSeekConfig = z.input<typeof deepSeekConfigSchema>

export const providerDeepSeek = defineProvider<DeepSeekConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createDeepSeek(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    deepSeekConfigSchema.extend({
      apiKey: deepSeekConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: deepSeekConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'Value Leader - Strong reasoning and coding at aggressive pricing',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.deepseek.description'),
  icon: 'i-lobe-icons:deepseek',
  iconColor: 'i-lobe-icons:deepseek-color',
  id: 'deepseek',
  name: 'DeepSeek',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.deepseek.title'),
  order: 4,
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
