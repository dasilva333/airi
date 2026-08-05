import type { ProviderMetadata } from '../types'

import { isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'
import { computed } from 'vue'

import { createLocalVisionAdapter, DEFAULT_LOCAL_VISION_MODEL, LOCAL_VISION_MODELS } from '../../../libs/inference'
import { DEFAULT_WEB_RWKV_MODEL, WEB_RWKV_MODELS } from '../../../libs/inference/constants'
import { createWebRwkvChatProvider } from '../web-rwkv'

/**
 * Local in-browser ML engine provider metadata registry.
 *
 * Extracted from `providers.ts` during the Phase 1 provider-store registry
 * restructure. These are the custom local browser model adapters; the
 * `createProviderRegistry` keep-list preserves them from the non-speech /
 * non-transcription purge.
 */
export const localEngineMetadata: Record<string, ProviderMetadata> = {
  'web-rwkv': {
    id: 'web-rwkv',
    category: 'chat',
    tasks: ['text-generation'],
    nameKey: 'settings.pages.providers.provider.web-rwkv.title',
    name: 'RWKV (Local, WebGPU)',
    descriptionKey: 'settings.pages.providers.provider.web-rwkv.description',
    description: 'Local RWKV-7 language model running in your browser via WebGPU.',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
    // Local in-browser model — no API key.
    requiresCredentials: false,
    // WebGPU-only: web-rwkv has no WASM/CPU backend, so hide it where WebGPU
    // is unavailable. Works in Electron (Chromium) as well as WebGPU browsers.
    isAvailableBy: () => isWebGPUSupported(),
    defaultOptions: () => ({
      model: DEFAULT_WEB_RWKV_MODEL,
      vocab: '',
      enableG1Prefill: true,
    }),
    createProvider: async config => createWebRwkvChatProvider({
      model: (config.model as string) || undefined,
      vocab: (config.vocab as string) || undefined,
      enableG1Prefill: config.enableG1Prefill !== false,
    }),
    capabilities: {
      // The model id is its safetensors URL; the configured override (or the
      // default) is the single selectable model.
      listModels: async (config) => {
        const url = (config.model as string) || DEFAULT_WEB_RWKV_MODEL
        const known = WEB_RWKV_MODELS.find(m => m.id === url)
        return [{
          id: url,
          name: known?.name ?? 'RWKV (custom URL)',
          provider: 'web-rwkv',
          description: known?.description ?? 'Custom web-rwkv model URL.',
          contextLength: 0,
          deprecated: false,
        }]
      },
    },
    validators: {
      chatPingCheckAvailable: false,
      // No credentials; valid as long as a model URL is present.
      validateProviderConfig: (config) => {
        const url = (config.model as string) || DEFAULT_WEB_RWKV_MODEL
        if (!url) {
          return { errors: [new Error('No model URL configured')], reason: 'A model URL is required.', valid: false }
        }
        return { errors: [], reason: '', valid: true }
      },
    },
  },
  'blip-local': {
    id: 'blip-local',
    category: 'vision',
    tasks: ['vision', 'image-to-text'],
    nameKey: 'settings.pages.providers.provider.blip-local.title',
    name: 'BLIP (Local, WebGPU)',
    descriptionKey: 'settings.pages.providers.provider.blip-local.description',
    description: 'On-device vision tagging (WD14 Tagger / BLIP) running in browser via WebGPU.',
    icon: 'i-solar:eye-scan-bold-duotone',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
    requiresCredentials: false,
    isAvailableBy: () => isWebGPUSupported(),
    defaultOptions: () => ({
      model: DEFAULT_LOCAL_VISION_MODEL,
    }),
    createProvider: async (config) => {
      const adapter = createLocalVisionAdapter()
      return {
        captionImage: (url: string, opts?: any) => adapter.captionImage(url, opts),
        loadModel: (opts?: any) => adapter.load(config.model as string, undefined, opts),
        state: computed(() => adapter.state),
        deviceLossCount: computed(() => adapter.deviceLossCount),
        terminate: () => adapter.terminate(),
      } as any
    },
    capabilities: {
      listModels: async () => {
        return LOCAL_VISION_MODELS.map(m => ({
          id: m.id,
          name: m.name,
          provider: 'blip-local',
          description: m.description,
          contextLength: 0,
          deprecated: false,
        }))
      },
    },
    validators: {
      chatPingCheckAvailable: false,
      validateProviderConfig: (config) => {
        const url = (config.model as string) || DEFAULT_LOCAL_VISION_MODEL
        if (!url) {
          return { errors: [new Error('No model configured')], reason: 'A model is required.', valid: false }
        }
        return { errors: [], reason: '', valid: true }
      },
    },
  },
}
