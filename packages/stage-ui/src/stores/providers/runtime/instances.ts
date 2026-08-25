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
  providerInstanceOptions?: (providerId: string, instanceId?: string) => Record<string, unknown> | undefined
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

  // Function to get provider object by provider id (or composite providerKey like "providerId:instanceId")
  async function getProviderInstance<R extends
  | ChatProvider
  | ChatProviderWithExtraOptions
  | EmbedProvider
  | EmbedProviderWithExtraOptions
  | SpeechProvider
  | SpeechProviderWithExtraOptions
  | TranscriptionProvider
  | TranscriptionProviderWithExtraOptions,
  >(providerKey: string): Promise<R> {
    if (!providerKey) {
      console.warn('getProviderInstance called with empty providerKey')
      return null as any
    }

    const cached = providerInstanceCache.value[providerKey] as R | undefined
    if (cached)
      return cached

    let providerId = providerKey
    let targetInstanceId: string | undefined

    if (providerKey.includes(':')) {
      const parts = providerKey.split(':')
      providerId = parts[0]
      targetInstanceId = parts[1]
    }

    const metadata = providerMetadata[providerId]
    if (!metadata) {
      console.warn(`Provider metadata for ${providerKey} (base: ${providerId}) not found`)
      return null as any
    }

    // Providers that explicitly require no credentials (local engines,
    // browser-native APIs) may safely construct with an empty config.
    // Everything else must present a non-empty credential BEFORE the SDK is
    // instantiated so client code receives an immediate, localized error
    // instead of a network round-trip that ends in a 401.
    const noCredentials = metadata.requiresCredentials === false || metadata.deployment === 'local' || providerId === 'browser-web-speech-api'

    let config = deps.providerInstanceOptions?.(providerId, targetInstanceId)
      ?? deps.getProviderCredentials()[providerId]
    if (!config && noCredentials) {
      config = deps.getDefaultProviderConfig(providerId)
      deps.setProviderCredentials(providerId, config)
    }

    if (!config && !noCredentials)
      throw new Error(`Provider credentials for ${providerKey} are missing or incomplete.`)

    if (config && !noCredentials) {
      // Defensive check: an empty-but-truthy `{}` (or whitespace-only
      // apiKey) would pass `!config` but produces an unauthenticated
      // SDK that fails with a raw 401 at network time. Trap it here.
      const anyCfg = config as Record<string, any>
      const hasKey = typeof anyCfg.apiKey === 'string' && anyCfg.apiKey.trim().length > 0
      const hasAwsKey = typeof anyCfg.accessKeyId === 'string' && anyCfg.accessKeyId.trim().length > 0
        && typeof anyCfg.secretAccessKey === 'string' && anyCfg.secretAccessKey.trim().length > 0
      if (!hasKey && !hasAwsKey)
        throw new Error(`Provider credentials for ${providerKey} are missing or incomplete.`)
    }

    try {
      const instance = await metadata.createProvider(config || {}) as R
      providerInstanceCache.value[providerKey] = instance
      return instance
    }
    catch (error) {
      console.error(`Error creating provider instance for ${providerKey}:`, error)
      throw error
    }
  }

  async function disposeProviderInstance(providerKey: string) {
    const instance = providerInstanceCache.value[providerKey] as { dispose?: () => Promise<void> | void } | undefined
    if (instance?.dispose)
      await instance.dispose()

    delete providerInstanceCache.value[providerKey]
  }

  return { getProviderInstance, disposeProviderInstance }
}
