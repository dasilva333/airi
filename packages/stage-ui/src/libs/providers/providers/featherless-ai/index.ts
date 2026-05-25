import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const featherlessConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional().default('https://api.featherless.ai/v1/'),
})

type FeatherlessConfig = z.input<typeof featherlessConfigSchema>

export const providerFeatherlessAI = defineProvider<FeatherlessConfig>({
  business: () => ({
    deployment: 'cloud',
    pricing: 'paid',
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey, config.baseUrl)
  },

  createProviderConfig: ({ t }) =>
    featherlessConfigSchema.extend({
      apiKey: featherlessConfigSchema.shape.apiKey.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: featherlessConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
    }),
  description: 'Unlimited Tokens - Flat $10/mo fee for 6,700+ models',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.featherless.description'),
  icon: 'i-lobe-icons:featherless-color',
  id: 'featherless-ai',
  name: 'Featherless.ai',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.featherless.title'),
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
