import { createOpenAI } from '@xsai-ext/providers/create'
import { z } from 'zod'

import { defineProvider } from '../registry'

const localLlmConfigSchema = z.object({
  modelId: z
    .string()
    .optional()
    .default(''),
})

type LocalLlmConfig = z.input<typeof localLlmConfigSchema>

export const providerLocalLlm = defineProvider<LocalLlmConfig>({
  id: 'local-llm',
  order: 1,
  name: 'App (Local LLM)',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.local-llm.title'),
  description: '100% Private & offline local LLM. No external installation required.',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.local-llm.description'),
  tasks: ['chat'],
  icon: 'i-lucide:cpu',
  business: () => ({
    pricing: 'free',
    deployment: 'local',
  }),

  createProviderConfig: ({ t }) => localLlmConfigSchema.extend({
    modelId: localLlmConfigSchema.shape.modelId.meta({
      labelLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.label'),
      descriptionLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.description'),
      placeholderLocalized: t('settings.pages.providers.catalog.edit.config.local-llm.model-id.placeholder'),
      type: 'select',
      options: [],
    }),
  }),
  createProvider() {
    // The embedded llama-server runs on port 39000
    return createOpenAI('not-needed', 'http://localhost:39000/v1')
  },

  validationRequiredWhen: () => false,
  validators: {
    validateProvider: [
      () => ({
        id: 'local-llm:check-connectivity',
        name: 'Local Server Connectivity',
        validator: async () => {
          try {
            const res = await fetch('http://localhost:39000/v1/models')
            if (res.ok) {
              return { errors: [], reason: '', reasonKey: '', valid: true }
            }
            throw new Error(`Server returned status: ${res.status}`)
          }
          catch (err: any) {
            return {
              errors: [{ error: err }],
              reason: 'Failed to connect to the local LLM server on port 39000. Please start the server in settings.',
              reasonKey: '',
              valid: false,
            }
          }
        },
      }),
    ],
  },
})
