import type { Ref } from 'vue'

import type { ProviderMetadata, ProviderRuntimeState } from '../types'

import { uniqBy } from 'es-toolkit'

export interface ProviderModelsDeps {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  providerRuntimeState: Ref<Record<string, ProviderRuntimeState>>
  providerMetadata: Record<string, ProviderMetadata>
  availableProviders: Ref<string[]>
}

/**
 * Model fetching and normalization runtime.
 *
 * All three state refs are store-owned singletons injected from
 * `providers.ts`. `availableProviders` is the configured-provider selector
 * (also produced by the store) passed in so `loadModelsForConfiguredProviders`
 * iterates exactly the same list the UI consumes.
 */
export function createProviderModels(deps: ProviderModelsDeps) {
  const { providerCredentials, providerRuntimeState, providerMetadata } = deps

  // Function to fetch models for a specific provider
  async function fetchModelsForProvider(providerId: string) {
    const config = providerCredentials.value[providerId]
    if (!config)
      return []

    const metadata = providerMetadata[providerId]
    if (!metadata)
      return []

    const runtimeState = providerRuntimeState.value[providerId]
    if (runtimeState) {
      runtimeState.isLoadingModels = true
      runtimeState.modelLoadError = null
    }

    try {
      const models = metadata.capabilities.listModels ? await metadata.capabilities.listModels(config) : []

      // Transform and store the models
      if (runtimeState) {
        runtimeState.models = uniqBy(models.filter(model => !!model.id), m => m.id)
          .map(model => ({
            ...model, // Preserve all additional fields (modalities, architecture, etc.)
            id: model.id,
            name: model.name || model.id,
            description: model.description,
            contextLength: model.contextLength || model.context_length,
            deprecated: model.deprecated,
            provider: providerId,
          }))
        return runtimeState.models
      }
      return []
    }
    catch (error) {
      console.error(`Error fetching models for ${providerId}:`, error)
      if (runtimeState) {
        runtimeState.modelLoadError = error instanceof Error ? error.message : 'Unknown error'
      }
      return []
    }
    finally {
      if (runtimeState) {
        runtimeState.isLoadingModels = false
      }
    }
  }

  // Load models for all configured providers
  async function loadModelsForConfiguredProviders() {
    for (const providerId of deps.availableProviders.value) {
      if (providerMetadata[providerId].capabilities.listModels) {
        await fetchModelsForProvider(providerId)
      }
    }
  }

  return { fetchModelsForProvider, loadModelsForConfiguredProviders }
}
