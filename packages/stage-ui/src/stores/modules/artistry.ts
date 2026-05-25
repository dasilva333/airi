import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed, isRef } from 'vue'

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
  const providerOptions = useLocalStorageManualReset<Record<string, any> | undefined>(
    'artistry-provider-options',
    undefined,
  )

  // --- ComfyUI provider settings ---
  const comfyuiServerUrl = useLocalStorageManualReset<string>('artistry-comfyui-server-url', 'http://localhost:8188')
  const comfyuiSavedWorkflows = useLocalStorageManualReset<ComfyUIWorkflowTemplate[]>(
    'artistry-comfyui-saved-workflows',
    [],
  )
  const comfyuiActiveWorkflow = useLocalStorageManualReset<string>('artistry-comfyui-active-workflow', '')

  // --- Replicate provider settings ---
  const replicateApiKey = useLocalStorageManualReset<string>('artistry-replicate-api-key', '')
  const replicateDefaultModel = useLocalStorageManualReset<string>(
    'artistry-replicate-default-model',
    'black-forest-labs/flux-schnell',
  )
  const replicateAspectRatio = useLocalStorageManualReset<string>('artistry-replicate-aspect-ratio', '16:9')
  const replicateInferenceSteps = useLocalStorageManualReset<number>('artistry-replicate-inference-steps', 4)

  // --- Nano Banana (Google AI Studio) provider settings ---
  const nanobananaApiKey = useLocalStorageManualReset<string>('artistry-nanobanana-api-key', '')
  const nanobananaModel = useLocalStorageManualReset<string>(
    'artistry-nanobanana-model',
    'gemini-3.1-flash-image-preview',
  )
  const nanobananaResolution = useLocalStorageManualReset<string>('artistry-nanobanana-resolution', '1K')

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
  }

  const configured = computed(() => {
    if (!activeProvider.value) return false

    if (activeProvider.value === 'replicate') {
      return !!replicateApiKey.value
    }

    if (activeProvider.value === 'comfyui') {
      return !!comfyuiServerUrl.value
    }

    if (activeProvider.value === 'nanobanana') {
      return !!nanobananaApiKey.value
    }

    return true
  })

  const artistryGlobals = computed(() => ({
    comfyuiActiveWorkflow: comfyuiActiveWorkflow.value,
    comfyuiSavedWorkflows: comfyuiSavedWorkflows.value,
    comfyuiServerUrl: comfyuiServerUrl.value,
    nanobananaApiKey: nanobananaApiKey.value,
    nanobananaModel: nanobananaModel.value,
    nanobananaResolution: nanobananaResolution.value,
    replicateApiKey: replicateApiKey.value,
    replicateAspectRatio: replicateAspectRatio.value,
    replicateDefaultModel: replicateDefaultModel.value,
    replicateInferenceSteps: replicateInferenceSteps.value,
  }))

  return {
    activeModel,
    // Active settings (resolved per card)
    activeProvider,
    artistryGlobals,
    comfyuiActiveWorkflow,
    comfyuiSavedWorkflows,

    // ComfyUI provider config
    comfyuiServerUrl,
    configured,
    defaultPromptPrefix,

    // Nano Banana provider config
    nanobananaApiKey,
    nanobananaModel,
    nanobananaResolution,
    providerOptions,

    // Replicate provider config
    replicateApiKey,
    replicateAspectRatio,
    replicateDefaultModel,
    replicateInferenceSteps,

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
    Globals: unwrap(store.artistryGlobals),
    model: unwrap(store.activeModel),
    options: unwrap(store.providerOptions),
    promptPrefix: unwrap(store.defaultPromptPrefix),
    provider: unwrap(store.activeProvider),
  }
}
