import { CLOUDFLARE_IMAGE_DEFAULTS, OPENAI_IMAGE_DEFAULTS } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed, isRef } from 'vue'

import { useCloudflareStore } from './cloudflare'

export interface ComfyUIWorkflowTemplate {
  id: string
  name: string
  workflow: Record<string, any>
  exposedFields: Record<string, string[]>
}

export const useArtistryStore = defineStore('artistry', () => {
  // --- Active provider & model ---
  const activeProvider = useLocalStorageManualReset<string>('artistry-provider', 'comfyui')
  const activeModel = useLocalStorageManualReset<string>('artistry-model', '')

  // --- Per-character defaults (resolved from card or global fallback) ---
  const defaultPromptPrefix = useLocalStorageManualReset<string>('artistry-prompt-prefix', '')
  const providerOptions = useLocalStorageManualReset<Record<string, any> | undefined>('artistry-provider-options', undefined)

  // --- ComfyUI provider settings ---
  const comfyuiServerUrl = useLocalStorageManualReset<string>(
    'artistry-comfyui-server-url',
    'http://localhost:8188',
  )
  const comfyuiSavedWorkflows = useLocalStorageManualReset<ComfyUIWorkflowTemplate[]>(
    'artistry-comfyui-saved-workflows',
    [],
  )
  const comfyuiActiveWorkflow = useLocalStorageManualReset<string>(
    'artistry-comfyui-active-workflow',
    '',
  )

  // --- Replicate provider settings ---
  const replicateApiKey = useLocalStorageManualReset<string>('artistry-replicate-api-key', '')
  const replicateDefaultModel = useLocalStorageManualReset<string>(
    'artistry-replicate-default-model',
    'black-forest-labs/flux-schnell',
  )
  const replicateAspectRatio = useLocalStorageManualReset<string>(
    'artistry-replicate-aspect-ratio',
    '16:9',
  )
  const replicateInferenceSteps = useLocalStorageManualReset<number>(
    'artistry-replicate-inference-steps',
    4,
  )

  // --- Nano Banana (Google AI Studio) provider settings ---
  const nanobananaApiKey = useLocalStorageManualReset<string>('artistry-nanobanana-api-key', '')
  const nanobananaModel = useLocalStorageManualReset<string>(
    'artistry-nanobanana-model',
    'gemini-3.1-flash-image-preview',
  )
  const nanobananaResolution = useLocalStorageManualReset<string>(
    'artistry-nanobanana-resolution',
    '1K',
  )

  // --- OpenAI GPT Image provider settings ---
  const openaiImageApiKey = useLocalStorageManualReset<string>('artistry-openai-image-api-key', '')
  const openaiImageBaseUrl = useLocalStorageManualReset<string>(
    'artistry-openai-image-base-url',
    OPENAI_IMAGE_DEFAULTS.baseUrl,
  )
  const openaiImageModel = useLocalStorageManualReset<string>(
    'artistry-openai-image-model',
    OPENAI_IMAGE_DEFAULTS.model,
  )
  const openaiImageWidth = useLocalStorageManualReset<string>('artistry-openai-image-width', '')
  const openaiImageHeight = useLocalStorageManualReset<string>('artistry-openai-image-height', '')

  // --- Cloudflare Workers AI image provider settings ---
  const cloudflareAccountId = useLocalStorageManualReset<string>('artistry-cloudflare-account-id', '')
  const cloudflareApiToken = useLocalStorageManualReset<string>('artistry-cloudflare-api-token', '')
  const cloudflareImageModel = useLocalStorageManualReset<string>(
    'artistry-cloudflare-image-model',
    CLOUDFLARE_IMAGE_DEFAULTS.model,
  )
  const cloudflareImageSteps = useLocalStorageManualReset<number>(
    'artistry-cloudflare-image-steps',
    CLOUDFLARE_IMAGE_DEFAULTS.steps,
  )
  const cloudflareImageWidth = useLocalStorageManualReset<string>('artistry-cloudflare-image-width', '')
  const cloudflareImageHeight = useLocalStorageManualReset<string>('artistry-cloudflare-image-height', '')

  function getEffectiveCloudflareCredentials() {
    let accountId = cloudflareAccountId.value.trim()
    let apiToken = cloudflareApiToken.value.trim()

    if (!accountId || !apiToken) {
      try {
        const cfStore = useCloudflareStore()
        if (!accountId && cfStore.activeAccountId) {
          accountId = cfStore.activeAccountId
        }
        if (!apiToken && cfStore.activeAccessToken) {
          apiToken = cfStore.activeAccessToken
        }
      }
      catch {
        // useCloudflareStore might not be available in non-Vue/worker contexts
      }
    }

    return { accountId, apiToken }
  }

  // --- Pollinations AI provider settings ---
  const pollinationsApiKey = useLocalStorageManualReset<string>('artistry-pollinations-api-key', '')
  const pollinationsModel = useLocalStorageManualReset<string>('artistry-pollinations-model', '')
  const pollinationsWidth = useLocalStorageManualReset<number>('artistry-pollinations-width', 1024)
  const pollinationsHeight = useLocalStorageManualReset<number>('artistry-pollinations-height', 1024)
  const pollinationsCachedModels = useLocalStorageManualReset<Array<{ id: string, name: string, description?: string, price?: string }>>(
    'artistry-pollinations-cached-models',
    [],
  )

  async function fetchPollinationsModels(force = false): Promise<Array<{ id: string, name: string, description?: string, price?: string }>> {
    if (!force && pollinationsCachedModels.value.length > 0)
      return pollinationsCachedModels.value

    try {
      const res = await fetch('https://gen.pollinations.ai/models', { signal: AbortSignal.timeout(8000) })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const imageModels = data.filter((m: any) => m.category === 'image' || m.output_modalities?.includes('image'))
      const parsed = [
        { id: '', name: 'Free Router (Pollinations Auto)', description: 'Fastest available free cluster node' },
        ...imageModels.map((m: any) => ({
          id: m.name,
          name: m.title || m.name,
          description: m.description,
          price: m.pricing?.completionImageTokens ? `${m.pricing.completionImageTokens} pollen` : undefined,
        })),
      ]
      pollinationsCachedModels.value = parsed
      return parsed
    }
    catch {
      if (pollinationsCachedModels.value.length === 0) {
        pollinationsCachedModels.value = [
          { id: '', name: 'Free Router (Pollinations Auto)', description: 'Fastest available free cluster node' },
          { id: 'flux', name: 'FLUX.1 Schnell', description: 'Fast, high-quality images at a tiny cost', price: '0.002 pollen' },
          { id: 'gptimage-large', name: 'GPT Image 1.5', description: 'High-fidelity image generation with fine detail', price: '0.000024 pollen' },
          { id: 'nanobanana-pro', name: 'Nano Banana Pro', description: 'Studio-quality images up to 4K with reasoning', price: '0.00012 pollen' },
          { id: 'seedream-pro', name: 'Seedream 4.5', description: 'Premium photorealism for lifelike scenes and portraits', price: '0.04 pollen' },
          { id: 'kontext', name: 'FLUX.1 Kontext Pro', description: 'Edits an existing image from plain instructions', price: '0.03 pollen' },
          { id: 'MarcosFRG/sdxl-lightning', name: 'SDXL Lightning', description: 'Ultra-fast distilled text-to-image in 1-8 steps', price: '0.0014 pollen' },
          { id: 'MarcosFRG/flux-2-klein-4b', name: 'FLUX.2 Klein 4B', description: 'Sub-second text-to-image transformer', price: '0.0025 pollen' },
        ]
      }
      return pollinationsCachedModels.value
    }
  }

  function resetState() {
    activeProvider.reset()
    activeModel.reset()
    defaultPromptPrefix.reset()
    providerOptions.reset()
    comfyuiServerUrl.reset()
    comfyuiSavedWorkflows.reset()
    comfyuiActiveWorkflow.reset()
    replicateApiKey.reset()
    replicateDefaultModel.reset()
    replicateAspectRatio.reset()
    replicateInferenceSteps.reset()
    nanobananaApiKey.reset()
    nanobananaModel.reset()
    nanobananaResolution.reset()
    openaiImageApiKey.reset()
    openaiImageBaseUrl.reset()
    openaiImageModel.reset()
    openaiImageWidth.reset()
    openaiImageHeight.reset()
    cloudflareAccountId.reset()
    cloudflareApiToken.reset()
    cloudflareImageModel.reset()
    cloudflareImageSteps.reset()
    cloudflareImageWidth.reset()
    cloudflareImageHeight.reset()
    pollinationsApiKey.reset()
    pollinationsModel.reset()
    pollinationsWidth.reset()
    pollinationsHeight.reset()
    pollinationsCachedModels.reset()
  }

  const configured = computed(() => {
    if (!activeProvider.value)
      return false

    if (activeProvider.value === 'replicate') {
      return !!replicateApiKey.value
    }

    if (activeProvider.value === 'comfyui') {
      return !!comfyuiServerUrl.value
    }

    if (activeProvider.value === 'nanobanana') {
      return !!nanobananaApiKey.value
    }

    if (activeProvider.value === 'openai-image') {
      return !!openaiImageApiKey.value.trim() && !!openaiImageBaseUrl.value.trim() && !!openaiImageModel.value.trim()
    }

    if (activeProvider.value === 'cloudflare') {
      const { accountId, apiToken } = getEffectiveCloudflareCredentials()
      return Boolean(accountId && apiToken)
    }

    if (activeProvider.value === 'pollinations') {
      return true
    }

    return true
  })

  const artistryGlobals = computed(() => ({
    comfyuiServerUrl: comfyuiServerUrl.value,
    comfyuiSavedWorkflows: comfyuiSavedWorkflows.value,
    comfyuiActiveWorkflow: comfyuiActiveWorkflow.value,
    replicateApiKey: replicateApiKey.value,
    replicateDefaultModel: replicateDefaultModel.value,
    replicateAspectRatio: replicateAspectRatio.value,
    replicateInferenceSteps: replicateInferenceSteps.value,
    nanobananaApiKey: nanobananaApiKey.value,
    nanobananaModel: nanobananaModel.value,
    nanobananaResolution: nanobananaResolution.value,
    openaiImageApiKey: openaiImageApiKey.value,
    openaiImageBaseUrl: openaiImageBaseUrl.value,
    openaiImageModel: openaiImageModel.value,
    openaiImageWidth: openaiImageWidth.value,
    openaiImageHeight: openaiImageHeight.value,
    cloudflareAccountId: cloudflareAccountId.value,
    cloudflareApiToken: cloudflareApiToken.value,
    cloudflareEffectiveAccountId: getEffectiveCloudflareCredentials().accountId,
    cloudflareEffectiveApiToken: getEffectiveCloudflareCredentials().apiToken,
    cloudflareImageModel: cloudflareImageModel.value,
    cloudflareImageSteps: cloudflareImageSteps.value,
    cloudflareImageWidth: cloudflareImageWidth.value,
    cloudflareImageHeight: cloudflareImageHeight.value,
    pollinationsApiKey: pollinationsApiKey.value,
    pollinationsModel: pollinationsModel.value,
    pollinationsWidth: pollinationsWidth.value,
    pollinationsHeight: pollinationsHeight.value,
  }))

  return {
    configured,
    artistryGlobals,
    // Active settings (resolved per card)
    activeProvider,
    activeModel,
    defaultPromptPrefix,
    providerOptions,

    // ComfyUI provider config
    comfyuiServerUrl,
    comfyuiSavedWorkflows,
    comfyuiActiveWorkflow,

    // Replicate provider config
    replicateApiKey,
    replicateDefaultModel,
    replicateAspectRatio,
    replicateInferenceSteps,

    // Nano Banana provider config
    nanobananaApiKey,
    nanobananaModel,
    nanobananaResolution,

    // OpenAI GPT Image provider config
    openaiImageApiKey,
    openaiImageBaseUrl,
    openaiImageModel,
    openaiImageWidth,
    openaiImageHeight,

    // Cloudflare Workers AI provider config
    cloudflareAccountId,
    cloudflareApiToken,
    cloudflareImageModel,
    cloudflareImageSteps,
    cloudflareImageWidth,
    cloudflareImageHeight,
    getEffectiveCloudflareCredentials,

    // Pollinations AI provider config
    pollinationsApiKey,
    pollinationsModel,
    pollinationsWidth,
    pollinationsHeight,
    pollinationsCachedModels,
    fetchPollinationsModels,

    resetState,
  }
})

export type ArtistryStoreSnapshot = ReturnType<typeof useArtistryStore>

export interface ResolvedArtistryConfig {
  provider?: string
  model?: string
  promptPrefix?: string
  options?: Record<string, any>
  Globals?: any
}

/**
 * Resolves the artistry configuration from a store snapshot.
 * Handles both ref-wrapped and unwrapped properties to safely work across component and non-component contexts.
 */
export function resolveArtistryConfigFromStore(store: ArtistryStoreSnapshot): ResolvedArtistryConfig {
  const unwrap = <T>(val: T | import('vue').Ref<T>): T => (isRef(val) ? val.value : val)

  return {
    provider: unwrap(store.activeProvider),
    model: unwrap(store.activeModel),
    promptPrefix: unwrap(store.defaultPromptPrefix),
    options: unwrap(store.providerOptions),
    Globals: unwrap(store.artistryGlobals),
  }
}
