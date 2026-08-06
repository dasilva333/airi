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
    if (providerId === 'virtual-audio-studio' || providerId === 'speech-noop' || providerId === 'kokoro-local' || providerId === 'moss-nano-local')
      return true

    const config = state.providerCredentials.value[providerId]
    if (!config)
      return false

    const metadata = state.providerMetadata[providerId]
    if (!metadata)
      return false

    const configObj = config as Record<string, any>
    const hasKey = !!configObj.apiKey?.trim()
    const hasAwsKey = !!configObj.accessKeyId?.trim() && !!configObj.secretAccessKey?.trim()
    const defaultUrl = (metadata.defaultOptions?.() as any)?.baseUrl || ''
    const hasCustomUrl = !!configObj.baseUrl?.trim() && configObj.baseUrl !== defaultUrl

    return hasKey || hasAwsKey || hasCustomUrl || !!state.addedProviders.value[providerId]
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
