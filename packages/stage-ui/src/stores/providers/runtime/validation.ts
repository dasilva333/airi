import type { Ref } from 'vue'
import type { ComposerTranslation } from 'vue-i18n'

import type { ProviderMetadata, ProviderRuntimeState } from '../types'

import { toast } from 'vue-sonner'

export interface ProviderValidationDeps {
  providerCredentials: Ref<Record<string, Record<string, unknown>>>
  providerRuntimeState: Ref<Record<string, ProviderRuntimeState>>
  providerValidationInFlight: Map<string, Promise<boolean>>
  providerMetadata: Record<string, ProviderMetadata>
  t: ComposerTranslation
  getDefaultProviderConfig: (providerId: string) => Record<string, unknown>
  isProviderConfigured: (providerId: string) => boolean
  markProviderAdded: (providerId: string) => void
}

/**
 * Provider configuration validation runtime.
 *
 * Encapsulates the three caching layers (credential-hash short-circuit,
 * in-flight promise de-duplication, and runtime-state persistence), the
 * Electron IPC emission (`provider-validation-result`), and the toast
 * notification side effect — all injected through `deps` so the module
 * remains properly testable and free of circular `providers.ts` imports.
 */
export function createProviderValidation(deps: ProviderValidationDeps) {
  const {
    providerCredentials,
    providerRuntimeState,
    providerValidationInFlight,
    providerMetadata,
    t,
    getDefaultProviderConfig,
    isProviderConfigured,
  } = deps

  // Configuration validation functions
  async function validateProvider(providerId: string, options: { force?: boolean } = {}): Promise<boolean> {
    if (providerId === 'virtual-audio-studio' || providerId === 'speech-noop') {
      if (providerRuntimeState.value[providerId]) {
        providerRuntimeState.value[providerId].isConfigured = true
      }
      return true
    }

    const metadata = providerMetadata[providerId]
    if (!metadata)
      return false

    if (providerId === 'browser-web-speech-api' && !providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = getDefaultProviderConfig(providerId)
    }

    const config = providerCredentials.value[providerId]
    if (!config && providerId !== 'browser-web-speech-api')
      return false

    const configString = JSON.stringify(config || {})
    const runtimeState = providerRuntimeState.value[providerId]
    const cacheKey = `${providerId}:${configString}`
    const forceValidation = options.force === true

    if (!forceValidation && runtimeState?.validatedCredentialHash === configString && typeof runtimeState.isConfigured === 'boolean')
      return runtimeState.isConfigured

    if (!forceValidation) {
      const pending = providerValidationInFlight.get(cacheKey)
      if (pending) {
        return pending
      }
    }

    const runValidation = async () => {
      // Logic for determining if a provider is configured
      const isConfigured = isProviderConfigured(providerId)

      // If not configured and not forced, bail out early with a "valid but unconfigured" state
      // This prevents loud network errors on fresh startups.
      if (!isConfigured && !options.force) {
        if (providerRuntimeState.value[providerId]) {
          providerRuntimeState.value[providerId].isConfigured = false
          providerRuntimeState.value[providerId].validatedCredentialHash = configString
        }
        return false
      }

      const validationResult = await metadata.validators.validateProviderConfig(config || {})

      // Suppress logging and toasts for unconfigured providers unless forced
      const isUnconfigured = !validationResult.valid && !isConfigured

      if ((window as any).electron?.ipcRenderer) {
        // Only send results to the main process if it's NOT unconfigured.
        // Even if forced (periodic check), we don't want terminal spam for things that aren't set up.
        if (!isUnconfigured) {
          try {
            // Use safe cloning to prevent "object could not be cloned" errors with Vue/Pinia Proxies
            const safeConfig = config ? JSON.parse(JSON.stringify({ ...config, apiKey: config.apiKey ? '***' : undefined })) : undefined

            ;(window as any).electron?.ipcRenderer?.send('provider-validation-result', {
              providerId,
              valid: validationResult.valid,
              reason: validationResult.reason,
              config: safeConfig,
            })
          }
          catch (e) {
            console.error('[Provider Validation] IPC send failed:', e)
          }
        }
      }

      if (!validationResult.valid && options.force && !isUnconfigured) {
        const localizedName = t(metadata.nameKey, metadata.name)
        toast.error(`Provider "${localizedName}" validation failed`, {
          description: validationResult.reason || 'Check your configuration in Settings > Providers.',
        })
      }

      if (providerRuntimeState.value[providerId]) {
        providerRuntimeState.value[providerId].isConfigured = validationResult.valid
        providerRuntimeState.value[providerId].validatedCredentialHash = configString
      }

      return validationResult.valid
    }

    if (forceValidation) {
      return runValidation()
    }

    const task = runValidation()
    providerValidationInFlight.set(cacheKey, task)
    return task.finally(() => {
      providerValidationInFlight.delete(cacheKey)
    })
  }

  return { validateProvider }
}
