import type { Ref } from 'vue'

import type { ProviderMetadata, ProviderRuntimeState } from '../types'

import { ref, watch } from 'vue'

export interface ProviderLifecycleDeps {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  addedProviders: Ref<Record<string, boolean>>
  providerRuntimeState: Ref<Record<string, ProviderRuntimeState>>
  providerMetadata: Record<string, ProviderMetadata>
  disposeProviderInstance: (providerId: string) => Promise<void>
}

/**
 * Provider lifecycle runtime.
 *
 * Phase 3 removes the background polling loop (`updateConfigurationStatus`)
 * and the silent startup network validation it drove. Provider availability
 * is now **static and catalog-driven** (see `registry/` and
 * `selectors/config.ts#isProviderConfigured`) and runtime validation only
 * runs from explicit user actions (`validateProvider(..., { force: true })`).
 *
 * This module retains only:
 * - the reactive seed-row initializer (`initializeProvider`)
 * - explicit reset / delete / force-configured helpers
 * - the credential-change watcher that disposes cached provider instances so
 *   stale instances never pick up the wrong API key
 *
 * All state refs are injected singletons owned by `providers.ts`.
 */
export function createProviderLifecycle(deps: ProviderLifecycleDeps) {
  const {
    providerCredentials,
    addedProviders,
    providerRuntimeState,
  } = deps

  // ----------------------------------------------------------------------------------
  // Public state management
  // ----------------------------------------------------------------------------------

  // Initialize provider configurations (only used for bookkeeping)
  function initializeProvider(providerId: string) {
    if (!providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = {}
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
  }

  // ----------------------------------------------------------------------------------
  // Credential cache → instance disposal watcher
  // ----------------------------------------------------------------------------------

  const previousCredentialHashes = ref<Record<string, string>>({})

  /**
   * Watch for credential changes and dispose the affected provider instance
   * so the new credentials take effect on the next `getProviderInstance()`.
   *
   * NOTICE: this watcher deliberately does **not** auto-refetch models. Model
   * listing is lazy — `fetchModelsForProvider` runs only when a settings page
   * or inference call explicitly requests it (see
   * `runtime/models.ts#fetchModelsForProvider`).
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
      }
    }, { deep: true, immediate: true })
  }

  return {
    initializeProvider,
    deleteProvider,
    forceProviderConfigured,
    resetProviderSettings,
    previousCredentialHashes,
    registerCredentialWatch,
  }
}
