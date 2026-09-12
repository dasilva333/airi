import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const openPathsConfigSchema = z.object({
  apiKey: z
    .string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://openpaths.io/v1'),
})

type OpenPathsConfig = z.input<typeof openPathsConfigSchema>

export const providerOpenPaths = defineProvider<OpenPathsConfig>({
  id: 'openpaths',
  name: 'OpenPaths',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.openpaths.title') || 'OpenPaths',
  description: 'openpaths.io',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.openpaths.description') || 'openpaths.io',
  tasks: ['chat'],
  icon: 'i-lobe-icons:openai',
  business: () => ({
    pricing: 'paid',
    deployment: 'cloud',
    consoleUrl: 'https://openpaths.io',
  }),

  createProviderConfig: ({ t }) => openPathsConfigSchema.extend({
    apiKey: openPathsConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: openPathsConfigSchema.shape.baseUrl.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
    }),
  }),
  createProvider(config) {
    return createOpenAI(config.apiKey, config.baseUrl)
  },

  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
  validators: {
    ...createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
    }),
  },
})
