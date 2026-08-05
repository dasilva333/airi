import type { Ref } from 'vue'

import type { ProviderMetadata } from '../types'

/**
 * Pure configuration-policy helpers for provider state.
 *
 * These functions implement the store's "is configured?" and "should list?"
 * rules. They are pure: each receives the relevant reactive state pieces
 * explicitly and reads `.value`, allowing them to be composed inside
 * `computed()` getters in `availability.ts` and inside runtime validators
 * without creating circular module imports.
 *
 * Only `shouldListProvider` / `isProviderConfigured` remain internal; every
 * returned member participates in the store's public API.
 */
export interface ProvidersConfigSelectorsState {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  addedProviders: Ref<Record<string, boolean>>
  providerMetadata: Record<string, ProviderMetadata>
}

export function createProvidersConfigSelectors(state: ProvidersConfigSelectorsState) {
  function getDefaultProviderConfig(providerId: string) {
    const metadata = state.providerMetadata[providerId]
    const defaultOptions = metadata?.defaultOptions?.() || {}
    return {
      ...defaultOptions,
      ...(Object.prototype.hasOwnProperty.call(defaultOptions, 'baseUrl') ? {} : { baseUrl: '' }),
    }
  }

  function getProviderConfig(providerId: string) {
    const metadata = state.providerMetadata[providerId]
    const defaults = metadata?.defaultOptions?.() || {}
    const persisted = state.providerCredentials.value[providerId] || {}
    return {
      ...defaults,
      ...persisted,
    }
  }

  function isProviderConfigDirty(providerId: string) {
    const config = state.providerCredentials.value[providerId]
    if (!config)
      return false

    const defaultOptions = getDefaultProviderConfig(providerId)
    return JSON.stringify(config) !== JSON.stringify(defaultOptions)
  }

  function isProviderConfigured(providerId: string) {
    // Category visibility is catalog-driven (registry) — never gated by
    // background validation. The remaining question here is whether a given
    // provider has sufficient persisted configuration to be considered
    // "configured" for runtime purposes.
    const metadata = state.providerMetadata[providerId]
    if (!metadata)
      return false

    // Providers that require no credentials are always configured.
    if (metadata.requiresCredentials === false)
      return true

    const config = state.providerCredentials.value[providerId]
    if (!config)
      return false

    // Generic structured check: at least one persisted option differs from
    // the provider's defaults. This replaces the legacy hard-coded
    // apiKey/accessKeyId/baseUrl string matching with a uniform predicate —
    // provider metadata may override this in a later phase with a custom
    // `isConfigured(options)` hook.
    const defaultOptions = metadata.defaultOptions?.() || {}
    return JSON.stringify(config) !== JSON.stringify(defaultOptions)
  }

  function shouldListProvider(providerId: string) {
    return !!state.addedProviders.value[providerId] || isProviderConfigDirty(providerId)
  }

  return {
    getDefaultProviderConfig,
    getProviderConfig,
    isProviderConfigDirty,
    isProviderConfigured,
    shouldListProvider,
  }
}
