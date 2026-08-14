import type { Ref } from 'vue'

import type { ProviderMetadata, ProviderRuntimeState } from '../types'

import { uniqBy } from 'es-toolkit'

export interface ProviderModelsDeps {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  providerRuntimeState: Ref<Record<string, ProviderRuntimeState>>
  providerMetadata: Record<string, ProviderMetadata>
  availableProviders: Ref<string[]>
  /**
   * Optionally override the options source to use a per-instance row rather
   * than the primary facade (spotlight fetched items for other endpoints).
   */
  providerInstanceOptions?: (providerId: string, instanceId?: string) => Record<string, unknown> | undefined
}

export function createProviderModels(deps: ProviderModelsDeps) {
  const { providerCredentials, providerRuntimeState, providerMetadata } = deps

  /**
   * Fetch the model catalog for a provider instance dynamically from the provider API.
   *
   * Instance-aware: if `options.instanceId` is supplied and the store exposes a
   * per-instance options getter, the model fetch targets that explicit instance
   * instead of the primary-backed canonical facade. This avoids writes to the
   * primary facade when a settings page is browsing other endpoints.
   */
  async function fetchModelsForProvider(providerKey: string, options: { instanceId?: string } = {}) {
    let providerId = providerKey
    let targetInstanceId = options.instanceId

    if (providerKey.includes(':')) {
      const parts = providerKey.split(':')
      providerId = parts[0]
      if (!targetInstanceId)
        targetInstanceId = parts[1]
    }

    const config = deps.providerInstanceOptions?.(providerId, targetInstanceId)
      ?? providerCredentials.value[providerId]

    if (!config)
      return []

    const metadata = providerMetadata[providerId]
    if (!metadata)
      return []

    if (!providerRuntimeState.value[providerId]) {
      providerRuntimeState.value[providerId] = {
        isConfigured: false,
        isInitialized: false,
        isLoadingModels: false,
        modelLoadError: null,
        isAvailable: false,
        isValidating: false,
        models: [],
      }
    }

    const runtimeState = providerRuntimeState.value[providerId]
    runtimeState.isLoadingModels = true
    runtimeState.modelLoadError = null

    try {
      const models = metadata.capabilities.listModels ? await metadata.capabilities.listModels(config) : []

      // Transform and store the models
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
    catch (error) {
      console.warn(`Error fetching live models for ${providerId}:`, error)
      runtimeState.modelLoadError = error instanceof Error ? error.message : 'Unknown error'
      runtimeState.models = []
      return []
    }
    finally {
      runtimeState.isLoadingModels = false
    }
  }

  // Load models for all configured providers
  async function loadModelsForConfiguredProviders() {
    for (const providerId of deps.availableProviders.value) {
      await fetchModelsForProvider(providerId)
    }
  }

  return {
    fetchModelsForProvider,
    loadModelsForConfiguredProviders,
  }
}
