import type { ProviderMetadata, ProviderRuntimeState } from '../types'
import type { ProvidersConfigSelectorsState } from './config'

import { computedAsync } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ProvidersAvailabilitySelectorsState extends ProvidersConfigSelectorsState {
  providerRuntimeState: { value: Record<string, ProviderRuntimeState> }
}

/**
 * Pure availability selectors for provider listing & status.
 *
 * These are pure computeds (some async) that consume state refs passed in
 * from the store. They never touch module scope, so `t` is captured from
 * `useI18n()` inside this factory (which is called inside the store setup
 * — that setup is itself inside a reactive component effect, so `t` is
 * scoped to the setup's reactive lifetime).
 */
export function createProvidersAvailabilitySelectors(state: ProvidersAvailabilitySelectorsState) {
  const { t } = useI18n()

  const configuredProviders = computed(() => {
    const result: Record<string, boolean> = {}
    for (const [key, s] of Object.entries(state.providerRuntimeState.value)) {
      result[key] = s.isConfigured
    }
    return result
  })

  const availableProviders = computed(() =>
    Object.keys(state.providerMetadata).filter(providerId => state.providerRuntimeState.value[providerId]?.isConfigured),
  )

  const allProvidersMetadata = computed(() => {
    return Object.values(state.providerMetadata).map(metadata => ({
      ...metadata,
      localizedName: t(metadata.nameKey, metadata.name),
      localizedDescription: t(metadata.descriptionKey, metadata.description),
    }))
  })

  const availableProvidersMetadata = computedAsync(async () => {
    const providers: ProviderMetadata[] = []

    for (const provider of allProvidersMetadata.value) {
      const p = state.providerMetadata[provider.id]
      const isAvailableBy = p?.isAvailableBy || (() => true)

      const isAvailable = await isAvailableBy()
      if (isAvailable) {
        providers.push(provider)
      }
    }

    return providers
  }, [] as ProviderMetadata[])

  const userProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter((metadata) => {
      const shouldList = state.addedProviders.value[metadata.id] || !!state.providerCredentials.value[metadata.id]
      return !shouldList
    })
  })

  const providersByCategoryMetadata = computed(() => {
    const map: Record<string, ProviderMetadata[]> = {}
    for (const metadata of availableProvidersMetadata.value) {
      const cat = metadata.category
      if (!map[cat])
        map[cat] = []
      map[cat].push(metadata)
    }
    return map
  })

  return {
    configuredProviders,
    availableProviders,
    allProvidersMetadata,
    availableProvidersMetadata,
    userProvidersMetadata,
    providersByCategoryMetadata,
  }
}
