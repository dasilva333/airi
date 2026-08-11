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
    // `browser-web-speech-api` is special-cased for upstream parity (its
    // metadata already flags `requiresCredentials: false`, so this branch is
    // intentionally redundant — kept for backward compatibility with the
    // legacy single-slot store call sites that inject `isProviderConfigured`
    // into raw credential checks elsewhere).
    if (metadata.requiresCredentials === false || metadata.deployment === 'local' || providerId === 'browser-web-speech-api')
      return true

    const config = state.providerCredentials.value[providerId]
    if (!config)
      return false

    // Credential-shape gauntlet (upstream parity): providers that require
    // credentials must have a non-empty `apiKey` (or AWS keypair / explicit
    // endpoint credentials) persisted. We do NOT count a mere custom
    // `baseUrl` nor `addedProviders` as sufficient for credentialed
    // providers — those were the two regression paths that let
    // unauthenticated HTTP requests fire upstream (401).
    const configObj = config as Record<string, any>
    const hasKey = typeof configObj.apiKey === 'string' && configObj.apiKey.trim().length > 0
    const hasAwsKey = typeof configObj.accessKeyId === 'string' && configObj.accessKeyId.trim().length > 0
      && typeof configObj.secretAccessKey === 'string' && configObj.secretAccessKey.trim().length > 0
    if (hasKey || hasAwsKey)
      return true

    // The legacy JSON-vs-defaults heuristic (`isProviderConfigDirty`) is NOT
    // consulted for `configured` state — it stays as a listing hint
    // (`shouldListProvider`) for the settings UI, but never qualifies a
    // credentialed provider as configured on its own.
    return false
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
