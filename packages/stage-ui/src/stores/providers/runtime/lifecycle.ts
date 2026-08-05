import type { Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import type { ModelInfo, ProviderMetadata, ProviderRuntimeState } from '../types'

import { debounce } from 'es-toolkit'
import { ref, watch } from 'vue'

export interface ProviderLifecycleDeps {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  addedProviders: Ref<Record<string, boolean>>
  providerRuntimeState: Ref<Record<string, ProviderRuntimeState>>
  providerMetadata: Record<string, ProviderMetadata>
  t: ComposerTranslation
  getDefaultProviderConfig: (providerId: string) => Record<string, unknown>
  isProviderConfigured: (providerId: string) => boolean
  validateProvider: (providerId: string, options?: { force?: boolean }) => Promise<boolean>
  fetchModelsForProvider: (providerId: string) => Promise<ModelInfo[]>
  disposeProviderInstance: (providerId: string) => Promise<void>
}

/**
 * Provider lifecycle runtime.
 *
 * Owns the two Pinia `watch()` side-effects (which must be created inside
 * the store's setup scope) plus the bootstrap kick-offs (`initializeProvider`
 * loop + initial `updateConfigurationStatus()`), the debounced bulk
 * revalidation, and the credential-hash cache that powers the
 * dispose+refetch watcher. All state refs are injected singletons owned by
 * `providers.ts` — nothing here creates new reactive state.
 */
export function createProviderLifecycle(deps: ProviderLifecycleDeps) {
  const {
    providerCredentials,
    addedProviders,
    providerRuntimeState,
    providerMetadata,
    isProviderConfigured,
    validateProvider,
  } = deps

  // Update configuration status for all configured providers
  const updateConfigurationStatus = debounce(async () => {
    await Promise.all(Object.entries(providerMetadata)
      .filter(([providerId]) => isProviderConfigured(providerId))
      .map(async ([providerId]) => {
        try {
          if (providerRuntimeState.value[providerId]) {
            const isValid = await validateProvider(providerId)
            providerRuntimeState.value[providerId].isConfigured = isValid
          }
        }
        catch {
          if (providerRuntimeState.value[providerId]) {
            providerRuntimeState.value[providerId].isConfigured = false
          }
        }
      }))
  }, 250)

  // Initialize provider configurations
  function initializeProvider(providerId: string) {
    if (!providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = deps.getDefaultProviderConfig(providerId)
    }
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
  }

  function deleteProvider(providerId: string) {
    delete providerCredentials.value[providerId]
    delete providerRuntimeState.value[providerId]
    delete addedProviders.value[providerId]
  }

  function forceProviderConfigured(providerId: string) {
    if (providerRuntimeState.value[providerId]) {
      providerRuntimeState.value[providerId].isConfigured = true
      // Also cache the current config to prevent re-validation from overwriting
      const config = providerCredentials.value[providerId]
      if (config) {
        providerRuntimeState.value[providerId].validatedCredentialHash = JSON.stringify(config)
      }
    }
    addedProviders.value[providerId] = true
  }

  async function resetProviderSettings() {
    providerCredentials.value = {}
    addedProviders.value = {}
    providerRuntimeState.value = {}

    Object.keys(providerMetadata).forEach(initializeProvider)
    await updateConfigurationStatus()
  }

  const previousCredentialHashes = ref<Record<string, string>>({})

  /**
   * Watch for credential changes and dispose the affected provider instance
   * so the new credentials take effect, then refetch models.
   */
  function registerCredentialWatch() {
    return watch(providerCredentials, (newCreds) => {
      const changedProviders: string[] = []

      for (const providerId in newCreds) {
        const currentConfig = newCreds[providerId]
        const currentHash = JSON.stringify(currentConfig)
        const previousHash = previousCredentialHashes.value[providerId]

        if (currentHash !== previousHash) {
          changedProviders.push(providerId)
          previousCredentialHashes.value[providerId] = currentHash
        }
      }

      for (const providerId of changedProviders) {
        // Since credentials changed, dispose the cached instance so new creds take effect.
        void deps.disposeProviderInstance(providerId)

        // If the provider is configured and has the capability, refetch its models
        if (providerRuntimeState.value[providerId]?.isConfigured && providerMetadata[providerId]?.capabilities.listModels) {
          deps.fetchModelsForProvider(providerId)
        }
      }
    }, { deep: true, immediate: true })
  }

  return {
    updateConfigurationStatus,
    initializeProvider,
    deleteProvider,
    forceProviderConfigured,
    resetProviderSettings,
    previousCredentialHashes,
    registerCredentialWatch,
  }
}
