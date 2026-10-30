import type { System1Response } from '../../types'

import z from 'zod'

import { downloadLayaModel, runLayaSystemOne } from '../../../inference/laya-engine'
import { defineProvider } from '../registry'

const openjevLocalConfigSchema = z.object({
  model: z
    .string('Model')
    .optional()
    .default('heman10x/rlcd-modernbert-151m'),
  enableWebGpu: z
    .boolean()
    .optional()
    .default(false),
})

type OpenJevLocalConfig = z.input<typeof openjevLocalConfigSchema>

export const providerOpenJevLocal = defineProvider<OpenJevLocalConfig>({
  id: 'openjev-local',
  order: 2,
  name: 'OpenJev (On-Device)',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.openjev-local.title'),
  description: 'Client-side lightweight ModernBERT-base (151M) System 1 decision engine via WebGPU/WASM',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.openjev-local.description'),
  tasks: ['system1'],
  icon: 'i-solar:bolt-bold-duotone',

  createProviderConfig: () => openjevLocalConfigSchema,

  createProvider(config) {
    return {
      systemOne: async (state: string | object, questions: Record<string, any>, model?: string): Promise<System1Response> => {
        const targetModel = model || config?.model || 'heman10x/rlcd-modernbert-151m'
        const precision = targetModel.includes('fp16') ? 'fp16' : 'int8'
        const res = await runLayaSystemOne(state, questions, precision, {
          useWebGpu: Boolean(config?.enableWebGpu),
          model: targetModel,
        })
        return {
          answers: res.answers,
          usage: res.usage,
        }
      },
    }
  },

  validationRequiredWhen() {
    return false
  },

  extraMethods: {
    async loadModel(config, _provider, hooks) {
      const targetModel = config?.model || 'heman10x/rlcd-modernbert-151m'
      const precision = targetModel.includes('fp16') ? 'fp16' : 'int8'
      await downloadLayaModel({
        precision,
        modelId: targetModel,
        onProgress: (p) => {
          hooks?.onProgress?.({
            status: 'progress',
            name: p.file,
            file: p.file,
            loaded: p.loaded,
            total: p.total,
            progress: p.percentage,
          })
        },
      })
    },

    async listModels() {
      return [
        {
          id: 'heman10x/rlcd-modernbert-151m',
          name: 'OpenJev Base INT8 (155 MB, Fast & Lightweight)',
          provider: 'openjev-local',
          description: 'On-device ModernBERT-base 151M calibrated decision model with explicit abstention',
        },
        {
          id: 'heman10x/rlcd-modernbert-151m-fp16',
          name: 'OpenJev Base FP16 (300 MB, WebGPU)',
          provider: 'openjev-local',
          description: 'On-device ModernBERT-base 151M FP16 calibrated decision model',
        },
      ]
    },
  },

  business: () => ({
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
  }),
})
