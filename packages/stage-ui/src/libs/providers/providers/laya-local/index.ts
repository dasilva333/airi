import type { System1Response } from '../../types'

import { z } from 'zod'

import { downloadLayaModel, runLayaSystemOne } from '../../../inference/laya-engine'
import { defineProvider } from '../registry'

const layaLocalConfigSchema = z.object({
  model: z
    .string('Model')
    .optional()
    .default('tozp/laya-onnx'),
  enableWebGpu: z
    .boolean()
    .optional()
    .default(false),
})

type LayaLocalConfig = z.input<typeof layaLocalConfigSchema>

export const providerLayaLocal = defineProvider<LayaLocalConfig>({
  id: 'laya-local',
  order: 2,
  name: 'Local Laya (On-Device)',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.laya-local.title'),
  description: 'Client-side ModernBERT System 1 classification running locally via WebGPU/WASM',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.laya-local.description'),
  tasks: ['system1'],
  icon: 'i-solar:laptop-minimalistic-bold-duotone',

  createProviderConfig: () => layaLocalConfigSchema,

  createProvider(config) {
    return {
      systemOne: async (state: string | object, questions: Record<string, any>, model?: string): Promise<System1Response> => {
        const targetModel = model || config?.model || 'tozp/laya-onnx'
        const precision = targetModel.includes('fp16') ? 'fp16' : 'int8'
        // NOTICE: WebGPU is strictly supported on FP16 weights. INT8 is CPU WASM only.
        const useWebGpu = precision === 'fp16' && Boolean(config?.enableWebGpu)
        const res = await runLayaSystemOne(state, questions, precision, {
          useWebGpu,
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
      const precision = config?.model?.includes('fp16') ? 'fp16' : 'int8'
      await downloadLayaModel({
        precision,
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
          id: 'tozp/laya-onnx',
          name: 'Laya INT8 (424 MB, CPU Recommended)',
          provider: 'laya-local',
          description: 'On-device ModernBERT quantized INT8 sequence classifier',
        },
        {
          id: 'tozp/laya-onnx-fp16',
          name: 'Laya FP16 (843 MB, CPU)',
          provider: 'laya-local',
          description: 'On-device ModernBERT FP16 precision sequence classifier',
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
