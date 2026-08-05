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

import type {
  BracketAction,
  ModelInfo,
  ProviderMetadata,
  ProviderRuntimeState,
  ProviderValidationResult,
  SpeechCapabilitiesInfo,
  VoiceInfo,
  VoiceProfile,
} from './providers/types'

import { computedAsync, useLocalStorage } from '@vueuse/core'
import {
  createOllama,
} from '@xsai-ext/providers/create'
import {
  createPlayer2,
} from '@xsai-ext/providers/special/create'
import { debounce, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { validateProviderBaseUrl } from './providers/helpers'
import { createProviderRegistry } from './providers/registry'

export type {
  BracketAction,
  ModelInfo,
  ProviderMetadata,
  ProviderRuntimeState,
  ProviderValidationResult,
  SpeechCapabilitiesInfo,
  VoiceInfo,
  VoiceProfile,
}

export const useProvidersStore = defineStore('providers', () => {
  const providerCredentials = useLocalStorage<Record<string, Record<string, unknown>>>('settings/credentials/providers', {})
  const addedProviders = useLocalStorage<Record<string, boolean>>('settings/providers/added', {})
  const providerInstanceCache = ref<Record<string, unknown>>({})
  const { t } = useI18n()
  const baseUrlValidator = { value: validateProviderBaseUrl }

  // Centralized provider metadata with provider factory functions
  const providerDefinitions: Record<string, ProviderMetadata> = {

    vllm: {
      id: 'vllm',
      category: 'chat',
      tasks: ['text-generation'],
      nameKey: 'settings.pages.providers.provider.vllm.title',
      name: 'vLLM',
      descriptionKey: 'settings.pages.providers.provider.vllm.description',
      description: 'High-Efficiency Serving - Industry standard for high-throughput local model serving and self-hosting',
      iconColor: 'i-lobe-icons:vllm',
      createProvider: async config => createOllama((config.baseUrl as string).trim()),
      capabilities: {
        listModels: async () => {
          return [
            {
              id: 'llama-2-7b',
              name: 'Llama 2 (7B)',
              provider: 'vllm',
              description: 'Meta\'s Llama 2 7B parameter model',
              contextLength: 4096,
            },
            {
              id: 'llama-2-13b',
              name: 'Llama 2 (13B)',
              provider: 'vllm',
              description: 'Meta\'s Llama 2 13B parameter model',
              contextLength: 4096,
            },
            {
              id: 'llama-2-70b',
              name: 'Llama 2 (70B)',
              provider: 'vllm',
              description: 'Meta\'s Llama 2 70B parameter model',
              contextLength: 4096,
            },
            {
              id: 'mistral-7b',
              name: 'Mistral (7B)',
              provider: 'vllm',
              description: 'Mistral AI\'s 7B parameter model',
              contextLength: 8192,
            },
            {
              id: 'mixtral-8x7b',
              name: 'Mixtral (8x7B)',
              provider: 'vllm',
              description: 'Mistral AI\'s Mixtral 8x7B MoE model',
              contextLength: 32768,
            },
            {
              id: 'custom',
              name: 'Custom Model',
              provider: 'vllm',
              description: 'Specify a custom model name',
              contextLength: 0,
            },
          ]
        },
      },
      validators: {
        validateProviderConfig: async (config) => {
          if (!config.baseUrl) {
            return {
              errors: [new Error('Base URL is required.')],
              reason: 'Base URL is required. Default to http://localhost:8000/v1/ for vLLM.',
              valid: false,
            }
          }

          const res = baseUrlValidator.value(config.baseUrl as string)
          if (res) {
            return res
          }

          // Check if the vLLM is reachable
          try {
            const response = await fetch(`${(config.baseUrl as string).trim()}models`, { headers: (config.headers as HeadersInit) || undefined })
            const errors = [
              !response.ok && new Error(`vLLM returned non-ok status code: ${response.statusText}`),
            ].filter((e): e is Error => e instanceof Error)

            return {
              errors,
              reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
              valid: response.ok,
            }
          }
          catch (err) {
            return {
              errors: [err as Error],
              reason: `Failed to reach vLLM, error: ${String(err)} occurred.`,
              valid: false,
            }
          }
        },
      },
    },
    player2: {
      id: 'player2',
      category: 'chat',
      tasks: ['text-generation'],
      nameKey: 'settings.pages.providers.provider.player2.title',
      name: 'Player2',
      descriptionKey: 'settings.pages.providers.provider.player2.description',
      description: 'player2.game',
      icon: 'i-lobe-icons:player2',
      defaultOptions: () => ({
        baseUrl: 'http://localhost:4315/v1/',
      }),
      createProvider: (config) => {
        return createPlayer2((config.baseUrl as string).trim())
      },
      capabilities: {
        listModels: async () => [
          {
            id: 'player2-model',
            name: 'Player2 Model',
            provider: 'player2',
          },
        ],
      },
      validators: {
        validateProviderConfig: async (config) => {
          if (!config.baseUrl) {
            return {
              errors: [new Error('Base URL is required.')],
              reason: 'Base URL is required. Default to http://localhost:4315/v1/',
              valid: false,
            }
          }

          const res = baseUrlValidator.value(config.baseUrl as string)
          if (res) {
            return res
          }

          // Check if the local running Player 2 is reachable
          try {
            const response = await fetch(`${config.baseUrl}health`, {
              method: 'GET',
              headers: {
                'player2-game-key': 'airi',
              },
            })
            const errors = [
              !response.ok && new Error(`Player 2 returned non-ok status code: ${response.statusText}`),
            ].filter((e): e is Error => e instanceof Error)

            return {
              errors,
              reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
              valid: response.ok,
            }
          }
          catch (err) {
            return {
              errors: [err as Error],
              reason: `Failed to reach Player 2, error: ${String(err)} occurred. If you do not have Player 2 running, please start it and try again.`,
              valid: false,
            }
          }
        },
      },
    },

  }

  const providerMetadata = createProviderRegistry(t, providerDefinitions)

  // const validatedCredentials = ref<Record<string, string>>({})
  const providerRuntimeState = useLocalStorage<Record<string, ProviderRuntimeState>>('settings/providers/runtime', {})
  const providerValidationInFlight = new Map<string, Promise<boolean>>()

  const configuredProviders = computed(() => {
    const result: Record<string, boolean> = {}
    for (const [key, state] of Object.entries(providerRuntimeState.value)) {
      result[key] = state.isConfigured
    }

    return result
  })

  function markProviderAdded(providerId: string) {
    addedProviders.value[providerId] = true
  }

  function unmarkProviderAdded(providerId: string) {
    delete addedProviders.value[providerId]
  }

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
        // Auto-mark credential-free local providers as added once valid, so they
        // surface in the "persisted" provider lists (e.g. the consciousness page,
        // which only lists added chat providers) without a manual add step. These
        // have no API key to enter, so there is nothing for the user to configure.
        if (validationResult.valid && ['browser-web-speech-api', 'player2', 'web-rwkv', 'blip-local', 'app-local-audio-transcription'].includes(providerId)) {
          markProviderAdded(providerId)
        }
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

  // Create computed properties for each provider's configuration status

  function getDefaultProviderConfig(providerId: string) {
    const metadata = providerMetadata[providerId]
    const defaultOptions = metadata?.defaultOptions?.() || {}
    return {
      ...defaultOptions,
      ...(Object.prototype.hasOwnProperty.call(defaultOptions, 'baseUrl') ? {} : { baseUrl: '' }),
    }
  }

  // Initialize provider configurations
  function initializeProvider(providerId: string) {
    if (!providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = getDefaultProviderConfig(providerId)
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

  // Object.keys(providerMetadata).forEach(initializeProvider)

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

  // Call initially and watch for changes
  watch(providerCredentials, updateConfigurationStatus, { deep: true, immediate: false })

  // Initialize all providers
  Object.keys(providerMetadata).forEach(initializeProvider)

  // Initial validation run
  void updateConfigurationStatus()

  // Available providers (only those that are properly configured)
  const availableProviders = computed(() => Object.keys(providerMetadata).filter(providerId => providerRuntimeState.value[providerId]?.isConfigured))

  // Store available models for each provider
  const availableModels = computed(() => {
    const result: Record<string, ModelInfo[]> = {}
    for (const [key, state] of Object.entries(providerRuntimeState.value)) {
      result[key] = state.models
    }
    return result
  })

  const isLoadingModels = computed(() => {
    const result: Record<string, boolean> = {}
    for (const [key, state] of Object.entries(providerRuntimeState.value)) {
      result[key] = state.isLoadingModels
    }
    return result
  })

  const modelLoadError = computed(() => {
    const result: Record<string, string | null> = {}
    for (const [key, state] of Object.entries(providerRuntimeState.value)) {
      result[key] = state.modelLoadError
    }
    return result
  })

  function deleteProvider(providerId: string) {
    delete providerCredentials.value[providerId]
    delete providerRuntimeState.value[providerId]
    unmarkProviderAdded(providerId)
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
    markProviderAdded(providerId)
  }

  async function resetProviderSettings() {
    providerCredentials.value = {}
    addedProviders.value = {}
    providerRuntimeState.value = {}

    Object.keys(providerMetadata).forEach(initializeProvider)
    await updateConfigurationStatus()
  }

  // Function to fetch models for a specific provider
  async function fetchModelsForProvider(providerId: string) {
    const config = providerCredentials.value[providerId]
    if (!config)
      return []

    const metadata = providerMetadata[providerId]
    if (!metadata)
      return []

    const runtimeState = providerRuntimeState.value[providerId]
    if (runtimeState) {
      runtimeState.isLoadingModels = true
      runtimeState.modelLoadError = null
    }

    try {
      const models = metadata.capabilities.listModels ? await metadata.capabilities.listModels(config) : []

      // Transform and store the models
      if (runtimeState) {
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
      return []
    }
    catch (error) {
      console.error(`Error fetching models for ${providerId}:`, error)
      if (runtimeState) {
        runtimeState.modelLoadError = error instanceof Error ? error.message : 'Unknown error'
      }
      return []
    }
    finally {
      if (runtimeState) {
        runtimeState.isLoadingModels = false
      }
    }
  }

  // Get models for a specific provider
  function getModelsForProvider(providerId: string) {
    return providerRuntimeState.value[providerId]?.models || []
  }

  // Get all available models across all configured providers
  const allAvailableModels = computed(() => {
    const models: ModelInfo[] = []
    for (const providerId of availableProviders.value) {
      models.push(...(providerRuntimeState.value[providerId]?.models || []))
    }
    return models
  })

  // Load models for all configured providers
  async function loadModelsForConfiguredProviders() {
    for (const providerId of availableProviders.value) {
      if (providerMetadata[providerId].capabilities.listModels) {
        await fetchModelsForProvider(providerId)
      }
    }
  }
  const previousCredentialHashes = ref<Record<string, string>>({})

  // Watch for credential changes and refetch models accordingly
  watch(providerCredentials, (newCreds) => {
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
      void disposeProviderInstance(providerId)

      // If the provider is configured and has the capability, refetch its models
      if (providerRuntimeState.value[providerId]?.isConfigured && providerMetadata[providerId]?.capabilities.listModels) {
        fetchModelsForProvider(providerId)
      }
    }
  }, { deep: true, immediate: true })

  // Function to get localized provider metadata
  function getProviderMetadata(providerId: string) {
    const metadata = providerMetadata[providerId]

    if (!metadata) {
      console.warn(`Provider metadata for ${providerId} not found`)
      return null as any
    }

    return {
      ...metadata,
      localizedName: t(metadata.nameKey, metadata.name),
      localizedDescription: t(metadata.descriptionKey, metadata.description),
    }
  }

  // Get all providers metadata (for settings page)
  const allProvidersMetadata = computed(() => {
    return Object.values(providerMetadata).map(metadata => ({
      ...metadata,
      localizedName: t(metadata.nameKey, metadata.name),
      localizedDescription: t(metadata.descriptionKey, metadata.description),
      configured: providerRuntimeState.value[metadata.id]?.isConfigured || false,
    }))
  })

  function getTranscriptionFeatures(providerId: string) {
    const metadata = providerMetadata[providerId]
    const features = metadata?.transcriptionFeatures

    return {
      supportsGenerate: features?.supportsGenerate ?? true,
      supportsStreamOutput: features?.supportsStreamOutput ?? false,
      supportsStreamInput: features?.supportsStreamInput ?? false,
    }
  }

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
    let config = providerCredentials.value[providerId]
    if (!config && providerId === 'browser-web-speech-api') {
      config = getDefaultProviderConfig(providerId)
      providerCredentials.value[providerId] = config
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

  const availableProvidersMetadata = computedAsync<ProviderMetadata[]>(async () => {
    const providers: ProviderMetadata[] = []

    for (const provider of allProvidersMetadata.value) {
      const p = getProviderMetadata(provider.id)
      const isAvailableBy = p.isAvailableBy || (() => true)

      const isAvailable = await isAvailableBy()
      if (isAvailable) {
        providers.push(provider)
      }
    }

    return providers
  }, [])

  const allChatProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(metadata =>
      metadata.category === 'chat'
      || metadata.tasks.some(task => ['chat', 'text-generation'].includes(task.toLowerCase())),
    )
  })

  const allAudioSpeechProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(metadata =>
      metadata.category === 'speech'
      || metadata.tasks.some(task => ['text-to-speech', 'speech', 'tts'].includes(task.toLowerCase())),
    )
  })

  const allAudioTranscriptionProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(metadata =>
      metadata.category === 'transcription'
      || metadata.tasks.some(task => ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'].includes(task.toLowerCase())),
    )
  })

  const allVisionProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(metadata =>
      metadata.category === 'vision'
      || metadata.tasks.some(task => ['vision', 'image-to-text'].includes(task.toLowerCase())),
    )
  })

  const configuredChatProvidersMetadata = computed(() => {
    return allChatProvidersMetadata.value.filter(metadata => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id))
  })

  const configuredSpeechProvidersMetadata = computed(() => {
    return allAudioSpeechProvidersMetadata.value.filter(metadata => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id))
  })

  const configuredTranscriptionProvidersMetadata = computed(() => {
    return allAudioTranscriptionProvidersMetadata.value.filter(metadata => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id))
  })

  const configuredVisionProvidersMetadata = computed(() => {
    return allVisionProvidersMetadata.value.filter(metadata => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id))
  })

  function isProviderConfigDirty(providerId: string) {
    const config = providerCredentials.value[providerId]
    if (!config)
      return false

    const defaultOptions = getDefaultProviderConfig(providerId)
    return JSON.stringify(config) !== JSON.stringify(defaultOptions)
  }

  function isProviderConfigured(providerId: string) {
    if (providerId === 'virtual-audio-studio' || providerId === 'speech-noop' || providerId === 'kokoro-local' || providerId === 'moss-nano-local')
      return true

    const config = providerCredentials.value[providerId]
    if (!config)
      return false

    const metadata = providerMetadata[providerId]
    if (!metadata)
      return false

    const configObj = config as Record<string, any>
    const hasKey = !!configObj.apiKey?.trim()
    const hasAwsKey = !!configObj.accessKeyId?.trim() && !!configObj.secretAccessKey?.trim()
    const defaultUrl = (metadata.defaultOptions?.() as any)?.baseUrl || ''
    const hasCustomUrl = !!configObj.baseUrl?.trim() && configObj.baseUrl !== defaultUrl

    return hasKey || hasAwsKey || hasCustomUrl || !!addedProviders.value[providerId]
  }

  function shouldListProvider(providerId: string) {
    return !!addedProviders.value[providerId] || isProviderConfigDirty(providerId)
  }

  const persistedProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(metadata => shouldListProvider(metadata.id))
  })

  const persistedChatProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(metadata =>
      metadata.category === 'chat'
      || metadata.tasks.some(task => ['chat', 'text-generation'].includes(task.toLowerCase())),
    )
  })

  const persistedSpeechProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(metadata =>
      metadata.category === 'speech'
      || metadata.tasks.some(task => ['text-to-speech', 'speech', 'tts'].includes(task.toLowerCase())),
    )
  })

  const persistedTranscriptionProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(metadata =>
      metadata.category === 'transcription'
      || metadata.tasks.some(task => ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'].includes(task.toLowerCase())),
    )
  })

  const persistedVisionProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(metadata =>
      metadata.category === 'vision'
      || metadata.tasks.some(task => ['vision', 'image-to-text'].includes(task.toLowerCase())),
    )
  })

  function getProviderConfig(providerId: string) {
    const metadata = providerMetadata[providerId]
    const defaults = metadata?.defaultOptions?.() || {}
    const persisted = providerCredentials.value[providerId] || {}
    return {
      ...defaults,
      ...persisted,
    }
  }

  return {
    providers: providerCredentials,
    getProviderConfig,
    getDefaultProviderConfig,
    addedProviders,
    markProviderAdded,
    unmarkProviderAdded,
    deleteProvider,
    availableProviders,
    configuredProviders,
    providerRuntimeState,
    providerMetadata,
    getProviderMetadata,
    getTranscriptionFeatures,
    allProvidersMetadata,
    initializeProvider,
    validateProvider,
    availableModels,
    isLoadingModels,
    modelLoadError,
    fetchModelsForProvider,
    getModelsForProvider,
    allAvailableModels,
    loadModelsForConfiguredProviders,
    getProviderInstance,
    disposeProviderInstance,
    resetProviderSettings,
    forceProviderConfigured,
    availableProvidersMetadata,
    allChatProvidersMetadata,
    allAudioSpeechProvidersMetadata,
    allAudioTranscriptionProvidersMetadata,
    allVisionProvidersMetadata,
    configuredChatProvidersMetadata,
    configuredSpeechProvidersMetadata,
    configuredTranscriptionProvidersMetadata,
    configuredVisionProvidersMetadata,
    persistedProvidersMetadata,
    persistedChatProvidersMetadata,
    persistedSpeechProvidersMetadata,
    persistedTranscriptionProvidersMetadata,
    persistedVisionProvidersMetadata,
  }
})
