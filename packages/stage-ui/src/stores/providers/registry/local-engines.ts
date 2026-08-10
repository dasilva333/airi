import type { ProviderMetadata } from '../types'

import { isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'
import { computed } from 'vue'

import { createLocalVisionAdapter, DEFAULT_LOCAL_VISION_MODEL, LOCAL_VISION_MODELS } from '../../../libs/inference'
import { DEFAULT_WEB_LLM_MODEL, DEFAULT_WEB_RWKV_MODEL, WEB_LLM_MODELS, WEB_RWKV_MODELS } from '../../../libs/inference/constants'
import { createWebLlmChatProvider } from '../web-llm'
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
  'web-llm': {
    id: 'web-llm',
    category: 'chat',
    tasks: ['text-generation'],
    nameKey: 'settings.pages.providers.provider.web-llm.title',
    name: 'WebLLM (Local, WebGPU)',
    descriptionKey: 'settings.pages.providers.provider.web-llm.description',
    description: 'Built-in offline WebGPU transformer LLM (Ministral 3, Qwen 3.5, Phi 4) running in your browser.',
    icon: 'i-solar:cpu-bolt-bold-duotone',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
    // Local in-browser model — no API key.
    requiresCredentials: false,
    // WebGPU-only: @mlc-ai/web-llm has no WASM/CPU chat backend, so hide it where
    // WebGPU is unavailable. Works in Electron (Chromium) and WebGPU browsers.
    isAvailableBy: () => isWebGPUSupported(),
    defaultOptions: () => ({
      model: DEFAULT_WEB_LLM_MODEL,
      modelUrl: '',
      modelLib: '',
      temperature: 0.7,
      topP: 0.9,
    }),
    createProvider: async config => createWebLlmChatProvider({
      model: (config.model as string) || undefined,
      modelUrl: (config.modelUrl as string) || undefined,
      modelLib: (config.modelLib as string) || undefined,
      vramMB: (config.vramMB as number) || undefined,
    }),
    capabilities: {
      // Offer the curated catalog plus the currently-configured custom repo (if
      // any). The model id is the MLC `model_id`; a custom repo is surfaced as a
      // separate entry so it can be selected from the consciousness dropdown.
      listModels: async (config) => {
        const models = WEB_LLM_MODELS.map(m => ({
          id: m.id,
          name: m.name,
          provider: 'web-llm',
          description: m.description,
          contextLength: 4096,
          deprecated: false,
        }))
        const customId = (config.model as string) || ''
        const customUrl = (config.modelUrl as string) || ''
        const isCurated = WEB_LLM_MODELS.some(m => m.id === customId)
        if (customId && customUrl && !isCurated) {
          models.push({
            id: customId,
            name: `${customId} (custom)`,
            provider: 'web-llm',
            description: 'Custom Hugging Face MLC model.',
            contextLength: 4096,
            deprecated: false,
          })
        }
        return models
      },
    },
    validators: {
      chatPingCheckAvailable: false,
      // No credentials; valid as long as a model id is present. A custom repo
      // additionally requires both a weights URL and a `model_lib` WASM URL (the
      // two-asset requirement) — an unverified repo without a WASM lib 404s.
      validateProviderConfig: (config) => {
        const modelId = (config.model as string) || DEFAULT_WEB_LLM_MODEL
        const customUrl = (config.modelUrl as string) || ''
        const customLib = (config.modelLib as string) || ''
        const isCurated = WEB_LLM_MODELS.some(m => m.id === modelId)
        if (!modelId) {
          return { errors: [new Error('No model selected')], reason: 'A model is required.', valid: false }
        }
        if (!isCurated && customUrl && !customLib) {
          return {
            errors: [new Error('Custom model requires a model_lib WASM URL')],
            reason: 'A custom Hugging Face model needs both a weights URL and a matching WASM library URL.',
            valid: false,
          }
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
