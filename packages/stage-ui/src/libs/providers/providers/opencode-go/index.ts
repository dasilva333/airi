import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const openCodeGoConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://opencode.ai/zen/go/v1/'),
})

type OpenCodeGoConfig = z.input<typeof openCodeGoConfigSchema>

export const providerOpenCodeGo = defineProvider<OpenCodeGoConfig>({
  id: 'opencode-go',
  name: 'OpenCode Go',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.opencode-go.title'),
  description: 'Developer API Platform - Plans start at $10 a month',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.opencode-go.description'),
  tasks: ['chat'],
  icon: 'i-lobe-icons:openai-compatible',
  business: () => ({
    pricing: 'paid',
    deployment: 'cloud',
    consoleUrl: 'https://opencode.ai/go',
  }),

  createProviderConfig: ({ t }) => openCodeGoConfigSchema.extend({
    apiKey: openCodeGoConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: openCodeGoConfigSchema.shape.baseUrl.meta({
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
