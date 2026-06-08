import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useOnboardingStore } from '../onboarding'
import { useProvidersStore } from '../providers'

export const useConsciousnessStore = defineStore('consciousness', () => {
  const providersStore = useProvidersStore()
  const onboardingStore = useOnboardingStore()

  // State
  const activeProvider = useLocalStorageManualReset<string>('settings/consciousness/active-provider', '')
  const activeModel = useLocalStorageManualReset<string>('settings/consciousness/active-model', '')
  const activeCustomModelName = useLocalStorageManualReset<string>('settings/consciousness/active-custom-model', '')
  const expandedDescriptions = refManualReset<Record<string, boolean>>(() => ({}))
  const modelSearchQuery = refManualReset<string>('')
  const lastSelectedModelPerProvider = useLocalStorageManualReset<Record<string, string>>('settings/consciousness/last-selected-model-per-provider', {})

  // Self-heal/cleanup incorrect mappings from previous race conditions
  if (lastSelectedModelPerProvider.value) {
    for (const [prov, mod] of Object.entries(lastSelectedModelPerProvider.value)) {
      if (prov !== 'local-llm' && mod.endsWith('.gguf')) {
        delete lastSelectedModelPerProvider.value[prov]
      }
    }
  }

  // Save selected model under the active provider when activeModel changes
  watch(activeModel, (model) => {
    const provider = activeProvider.value
    if (provider && model) {
      if (!lastSelectedModelPerProvider.value) {
        lastSelectedModelPerProvider.value = {}
      }
      lastSelectedModelPerProvider.value[provider] = model
    }
  })

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.getProviderMetadata(activeProvider.value)?.capabilities.listModels !== undefined
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeProvider.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeProvider.value] || null
  })

  const filteredModels = computed(() => {
    if (!modelSearchQuery.value.trim()) {
      return providerModels.value
    }

    const query = modelSearchQuery.value.toLowerCase().trim()
    return providerModels.value.filter(model =>
      model.name.toLowerCase().includes(query)
      || model.id.toLowerCase().includes(query)
      || (model.description && model.description.toLowerCase().includes(query)),
    )
  })

  function resetModelSelection() {
    activeModel.reset()
    activeCustomModelName.reset()
    expandedDescriptions.reset()
    modelSearchQuery.reset()
  }

  async function loadModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }

  async function getModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      return providersStore.getModelsForProvider(provider)
    }

    return []
  }

  const configured = computed(() => {
    return !!activeProvider.value && !!activeModel.value
  })

  watch(providerModels, (models) => {
    if (activeModel.value && models.length > 0 && !models.find(m => m.id === activeModel.value))
      resetModelSelection()
  })

  function resetState() {
    activeProvider.reset()
    resetModelSelection()
  }

  const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
  const shouldStopLocalServerOnModelSelect = ref(false)

  // Watch for provider changes and load models
  watch(activeProvider, async (newProvider, oldProvider) => {
    if (newProvider) {
      await loadModelsForProvider(newProvider)
    }

    // Mark that we should stop the local server once a model is selected on the new provider
    if (oldProvider === 'local-llm' && newProvider !== 'local-llm') {
      shouldStopLocalServerOnModelSelect.value = true
    }
    else if (newProvider === 'local-llm') {
      shouldStopLocalServerOnModelSelect.value = false
    }
  }, { immediate: true })

  // Automatically stop local LLM server only when a model is actually selected on the non-local provider
  watch(activeModel, async (newModel) => {
    if (newModel && shouldStopLocalServerOnModelSelect.value && activeProvider.value !== 'local-llm') {
      shouldStopLocalServerOnModelSelect.value = false
      const win = window as any
      if (typeof window !== 'undefined' && win.electron?.ipcRenderer) {
        try {
          const { context } = createContext(win.electron.ipcRenderer as any)
          const stopServer = defineInvoke(context, electronLocalLlmStopServer)
          console.log('[Consciousness Store] Model selected on new provider. Stopping local LLM server to free resources...')
          await stopServer()
        }
        catch (err) {
          console.error('[Consciousness Store] Failed to automatically stop local LLM server:', err)
        }
      }
    }
  })

  // Self-healing: Reset active provider if it no longer exists
  watch(activeProvider, () => {
    // Bypass self-healing during onboarding
    if (onboardingStore.needsOnboarding)
      return

    if (Object.keys(providersStore.providerMetadata).length > 0 && activeProvider.value && !providersStore.providerMetadata[activeProvider.value]) {
      activeProvider.value = ''
      activeModel.value = ''
    }
  }, { immediate: true })

  return {
    // State
    configured,
    activeProvider,
    activeModel,
    customModelName: activeCustomModelName,
    expandedDescriptions,
    modelSearchQuery,
    lastSelectedModelPerProvider,

    // Computed
    supportsModelListing,
    providerModels,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    filteredModels,

    // Actions
    resetModelSelection,
    loadModelsForProvider,
    getModelsForProvider,
    resetState,
  }
})
