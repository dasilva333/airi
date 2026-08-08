import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators/openai-compatible'
import { defineProvider } from '../registry'

const alibabaCloudConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z
    .string('Base URL')
    .optional()
    .default('https://ws-xdvshc2who4vf72n.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1'),
})

type AlibabaCloudConfig = z.input<typeof alibabaCloudConfigSchema>

export const providerAlibabaCloud = defineProvider<AlibabaCloudConfig>({
  id: 'alibaba-cloud',
  name: 'Alibaba Cloud',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.alibaba-cloud.title'),
  description: 'Model Studio - Large-scale model service platform by Alibaba Cloud',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.alibaba-cloud.description'),
  tasks: ['chat'],
  icon: 'i-lobe-icons:alibabacloud',
  business: () => ({
    pricing: 'paid',
    deployment: 'cloud',
    consoleUrl: 'https://bailian.console.aliyun.com/',
  }),

  createProviderConfig: ({ t }) => alibabaCloudConfigSchema.extend({
    apiKey: alibabaCloudConfigSchema.shape.apiKey.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
      type: 'password',
    }),
    baseUrl: alibabaCloudConfigSchema.shape.baseUrl.meta({
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
