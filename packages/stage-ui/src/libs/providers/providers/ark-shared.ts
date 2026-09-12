import type { ModelInfo, ProviderDefinition, ProviderInstance } from '../types'

import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../validators/openai-compatible'
import { defineProvider } from './registry'

const arkProviderConfigSchema = z.object({
  apiKey: z
    .string('API Key'),
  baseUrl: z
    .string('Base URL'),
})

export type ArkProviderConfig = z.input<typeof arkProviderConfigSchema>

export interface ArkModelSpec {
  id: string
  contextLength?: number
  deprecated?: boolean
  descriptionKey?: string
}

export interface ArkProviderDefinitionOptions {
  id: string
  order?: number
  name: string
  nameKey: string
  description: string
  descriptionKey: string
  modelPrefix: string
  defaultBaseUrl: string
  icon: string
  iconColor?: string
  models: ArkModelSpec[]
}

export function stripModelPrefix(modelId: string, modelPrefix: string) {
  return modelId.startsWith(modelPrefix)
    ? modelId.slice(modelPrefix.length)
    : modelId
}

export function createArkChatProviderDefinition(options: ArkProviderDefinitionOptions): ProviderDefinition<ArkProviderConfig> {
  const {
    id,
    order,
    name,
    nameKey,
    description,
    descriptionKey,
    modelPrefix,
    defaultBaseUrl,
    icon,
    iconColor,
    models,
  } = options

  return defineProvider<ArkProviderConfig>({
    id,
    order,
    name,
    nameLocalize: ({ t }) => t(nameKey) || name,
    description,
    descriptionLocalize: ({ t }) => t(descriptionKey) || description,
    tasks: ['chat'],
    icon,
    iconColor,
    business: () => ({
      pricing: 'paid',
      deployment: 'cloud',
    }),

    createProviderConfig: ({ t }) => arkProviderConfigSchema.extend({
      apiKey: arkProviderConfigSchema.shape.apiKey.meta({
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.label'),
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.description'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.api-key.placeholder'),
        type: 'password',
      }),
      baseUrl: arkProviderConfigSchema.shape.baseUrl.default(defaultBaseUrl).meta({
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description'),
        placeholderLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder'),
      }),
    }),
    createProvider(config) {
      const provider = createOpenAI(config.apiKey ?? '', config.baseUrl ?? defaultBaseUrl)
      const originalChat = provider.chat.bind(provider)

      return {
        ...provider,
        chat(model: string) {
          return originalChat(stripModelPrefix(model, modelPrefix))
        },
      }
    },

    extraMethods: {
      listModels: async (_config: ArkProviderConfig, _provider: ProviderInstance) => models.map((model) => {
        const modelInfo: ModelInfo = {
          id: `${modelPrefix}${model.id}`,
          name: model.id,
          provider: id,
        }
        if (model.contextLength !== undefined) {
          modelInfo.contextLength = model.contextLength
        }
        if (model.deprecated !== undefined) {
          modelInfo.deprecated = model.deprecated
        }
        return modelInfo
      }),
    },
    validationRequiredWhen(config) {
      return !!config.apiKey?.trim()
    },
    validators: {
      ...createOpenAICompatibleValidators({
        checks: ['connectivity', 'model_list'],
        normalizeModelId: modelId => stripModelPrefix(modelId, modelPrefix),
      }),
    },
  })
}
