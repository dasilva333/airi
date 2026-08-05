import type {
  ChatProvider,
  ChatProviderWithExtraOptions,
  EmbedProvider,
  EmbedProviderWithExtraOptions,
  SpeechProvider,
  SpeechProviderWithExtraOptions,
  TranscriptionProvider,
  TranscriptionProviderWithExtraOptions,
} from '@xsai-ext/providers/utils'
import type { Ref } from 'vue'

import type { ProviderMetadata } from '../types'

export interface ProviderInstancesDeps {
  providerInstanceCache: Ref<Record<string, unknown>>
  providerMetadata: Record<string, ProviderMetadata>
  getProviderCredentials: () => Record<string, Record<string, unknown>>
  setProviderCredentials: (providerId: string, config: Record<string, unknown>) => void
  getDefaultProviderConfig: (providerId: string) => Record<string, unknown>
}

/**
 * Provider instance cache lifecycle.
 *
 * The singleton `providerInstanceCache` ref is owned and created by
 * `providers.ts` setup and injected here, so all consumers observe the same
 * underlying state. `getProviderCredentials`/`setProviderCredentials` are
 * injected closures instead of the raw ref so the Web Speech API special
 * case below can write back into `providerCredentials.value` without this
 * module owning that `useLocalStorage` singleton.
 */
export function createProviderInstances(deps: ProviderInstancesDeps) {
  const { providerInstanceCache, providerMetadata } = deps

  // Function to get provider object by provider id
  async function getProviderInstance<R extends
  | ChatProvider
  | ChatProviderWithExtraOptions
  | EmbedProvider
  | EmbedProviderWithExtraOptions
  | SpeechProvider
  | SpeechProviderWithExtraOptions
  | TranscriptionProvider
  | TranscriptionProviderWithExtraOptions,
  >(providerId: string): Promise<R> {
    const cached = providerInstanceCache.value[providerId] as R | undefined
    if (cached)
      return cached

    const metadata = providerMetadata[providerId]
    if (!metadata) {
      console.warn(`Provider metadata for ${providerId} not found`)
      return null as any
    }

    // Web Speech API doesn't require credentials - use empty config
    let config = deps.getProviderCredentials()[providerId]
    if (!config && providerId === 'browser-web-speech-api') {
      config = deps.getDefaultProviderConfig(providerId)
      deps.setProviderCredentials(providerId, config)
    }

    if (!config && providerId !== 'browser-web-speech-api')
      throw new Error(`Provider credentials for ${providerId} not found`)

    try {
      const instance = await metadata.createProvider(config || {}) as R
      providerInstanceCache.value[providerId] = instance
      return instance
    }
    catch (error) {
      console.error(`Error creating provider instance for ${providerId}:`, error)
      throw error
    }
  }

  async function disposeProviderInstance(providerId: string) {
    const instance = providerInstanceCache.value[providerId] as { dispose?: () => Promise<void> | void } | undefined
    if (instance?.dispose)
      await instance.dispose()

    delete providerInstanceCache.value[providerId]
  }

  return { getProviderInstance, disposeProviderInstance }
}
