import { createOllama } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { createOpenAICompatibleValidators } from '../../validators'
import { defineProvider } from '../registry'

type OllamaThinkValue = boolean | 'high' | 'low' | 'medium'
type OllamaThinkingMode = 'auto' | 'disable' | 'enable' | 'high' | 'low' | 'medium'

const ollamaConfigSchema = z.object({
  baseUrl: z.string().default('http://localhost:11434/v1/'),
  headers: z.record(z.string(), z.string()).optional(),
  thinkingMode: z.enum(['auto', 'disable', 'enable', 'low', 'medium', 'high']).default('auto'),
})

type OllamaConfig = z.input<typeof ollamaConfigSchema>

function isGptOssModel(model: string): boolean {
  return model.toLowerCase().includes('gpt-oss')
}

function normalizeOllamaThinkingMode(value: unknown): OllamaThinkingMode {
  switch (value) {
    case 'auto':
    case 'disable':
    case 'enable':
    case 'high':
    case 'low':
    case 'medium':
      return value
    default:
      return 'auto'
  }
}

export function resolveOllamaThink(model: string, modeRaw: unknown): OllamaThinkValue | undefined {
  const mode = normalizeOllamaThinkingMode(modeRaw)
  const isGptOss = isGptOssModel(model)

  switch (mode) {
    case 'auto':
      return undefined
    case 'disable':
      // NOTICE: GPT-OSS ignores boolean `think`, so "disable" degrades to `low`.
      return isGptOss ? 'low' : false
    case 'enable':
      // NOTICE: GPT-OSS requires levels; map generic "enable" to medium effort.
      return isGptOss ? 'medium' : true
    case 'low':
    case 'medium':
    case 'high':
      return mode
    default:
      return undefined
  }
}

export const providerOllama = defineProvider<OllamaConfig>({
  business: ({ t }) => ({
    deployment: 'local',
    pricing: 'free',
    troubleshooting: {
      validators: {
        openaiCompatibleCheckConnectivity: {
          content: t(
            'settings.pages.providers.catalog.edit.providers.provider.ollama.troubleshooting.validators.openai-compatible-check-connectivity.content',
          ),
          label: t(
            'settings.pages.providers.catalog.edit.providers.provider.ollama.troubleshooting.validators.openai-compatible-check-connectivity.label',
          ),
        },
      },
    },
  }),
  createProvider(config) {
    const baseProvider = createOllama('', config.baseUrl)

    return {
      ...baseProvider,
      chat(model: string) {
        const chatOptions = baseProvider.chat(model)
        const think = resolveOllamaThink(model, config.thinkingMode)

        if (think === undefined) return chatOptions

        return { ...chatOptions, think }
      },
    }
  },

  createProviderConfig: ({ t }) =>
    ollamaConfigSchema.extend({
      baseUrl: ollamaConfigSchema.shape.baseUrl.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.base-url.label'),
        placeholderLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.base-url.placeholder',
        ),
      }),
      headers: ollamaConfigSchema.shape.headers.meta({
        descriptionLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.headers.description'),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.headers.label'),
        section: 'advanced',
        type: 'key-values',
      }),
      thinkingMode: ollamaConfigSchema.shape.thinkingMode.meta({
        descriptionLocalized: t(
          'settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.description',
        ),
        labelLocalized: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.label'),
        options: [
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.auto'),
            value: 'auto',
          },
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.disable'),
            value: 'disable',
          },
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.enable'),
            value: 'enable',
          },
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.low'),
            value: 'low',
          },
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.medium'),
            value: 'medium',
          },
          {
            label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.high'),
            value: 'high',
          },
        ],
        section: 'advanced',
        type: 'select',
      }),
    }),
  description: 'Private & Local - Run Llama, Mistral, and more on your machine',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.ollama.description'),
  icon: 'i-lobe-icons:ollama',
  id: 'ollama',
  name: 'Ollama',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.ollama.title'),
  order: 2,
  tasks: ['chat'],
  validationRequiredWhen: () => true,
  validators: {
    validateConfig: [
      ({ t }) => ({
        id: 'ollama:check-config',
        name: t('settings.pages.providers.catalog.edit.validators.openai-compatible.check-config.title'),
        validator: async (config) => {
          const errors: Array<{ error: unknown }> = []
          const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl) errors.push({ error: new Error('Base URL is required.') })

          if (baseUrl) {
            try {
              const parsed = new URL(baseUrl)
              if (!parsed.host) errors.push({ error: new Error('Base URL is not absolute. Check your input.') })
            } catch {
              errors.push({ error: new Error('Base URL is invalid. It must be an absolute URL.') })
            }
          }

          return {
            errors,
            reason: errors.length > 0 ? errors.map((item) => (item.error as Error).message).join(', ') : '',
            reasonKey: '',
            valid: errors.length === 0,
          }
        },
      }),
    ],
    validateProvider: createOpenAICompatibleValidators({
      checks: ['connectivity', 'model_list'],
      connectivityFailureReason: ({ errorMessage }) =>
        `Failed to reach Ollama server, error: ${errorMessage} occurred.\n\nIf you are using Ollama locally, you need to set two environment variables before starting Ollama:\n\n1. OLLAMA_ORIGINS=* (or OLLAMA_ORIGINS=https://airi.moeru.ai,http://localhost) — required for CORS\n2. OLLAMA_HOST=0.0.0.0 — ensures Ollama binds to all interfaces\n\nExample:\n  export OLLAMA_ORIGINS="*"\n  export OLLAMA_HOST="0.0.0.0"\n  ollama serve\n\nFor systemd:\n  sudo systemctl edit ollama\n  # Add:\n  # [Service]\n  # Environment="OLLAMA_ORIGINS=*"\n  # Environment="OLLAMA_HOST=0.0.0.0"\n  sudo systemctl restart ollama`,
      schedule: {
        intervalMs: 15_000,
        mode: 'interval',
      },
    })!.validateProvider,
  },
})
