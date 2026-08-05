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

import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createProviderRegistry } from './providers/registry'
import { createProviderInstances } from './providers/runtime/instances'
import { createProviderLifecycle } from './providers/runtime/lifecycle'
import { createProviderModels } from './providers/runtime/models'
import { createProviderValidation } from './providers/runtime/validation'
import { createProvidersAvailabilitySelectors } from './providers/selectors/availability'
import { createProvidersConfigSelectors } from './providers/selectors/config'

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

  // Centralized provider metadata with provider factory functions
  // Phase 2: all hand-written definitions moved out of this orchestrator into
  // `registry/*` (speech, transcription, local-engines, chat-local) and into
  // `libs/providers` for the standard cloud chat catalog.
  const providerDefinitions: Record<string, ProviderMetadata> = {}

  const providerMetadata = createProviderRegistry(t, providerDefinitions)

  // const validatedCredentials = ref<Record<string, string>>({})
  const providerRuntimeState = useLocalStorage<Record<string, ProviderRuntimeState>>('settings/providers/runtime', {})
  const providerValidationInFlight = new Map<string, Promise<boolean>>()

  const {
    getDefaultProviderConfig,
    getProviderConfig,
    isProviderConfigured,
    shouldListProvider,
  } = createProvidersConfigSelectors({
    providerCredentials,
    addedProviders,
    providerMetadata,
  })

  const {
    configuredProviders,
    availableProviders,
    allProvidersMetadata,
    availableProvidersMetadata,
  } = createProvidersAvailabilitySelectors({
    providerCredentials,
    addedProviders,
    providerRuntimeState,
    providerMetadata,
  })

  const { getProviderInstance, disposeProviderInstance } = createProviderInstances({
    providerInstanceCache,
    providerMetadata,
    getProviderCredentials: () => providerCredentials.value,
    setProviderCredentials: (providerId, config) => { providerCredentials.value[providerId] = config },
    getDefaultProviderConfig,
  })

  const { fetchModelsForProvider, loadModelsForConfiguredProviders } = createProviderModels({
    providerCredentials,
    providerRuntimeState,
    providerMetadata,
    availableProviders,
  })

  function markProviderAdded(providerId: string) {
    addedProviders.value[providerId] = true
  }

  function unmarkProviderAdded(providerId: string) {
    delete addedProviders.value[providerId]
  }

  const { validateProvider } = createProviderValidation({
    providerCredentials,
    providerRuntimeState,
    providerValidationInFlight,
    providerMetadata,
    t,
    getDefaultProviderConfig,
    isProviderConfigured,
    markProviderAdded,
  })

  const {
    updateConfigurationStatus,
    initializeProvider,
    deleteProvider,
    forceProviderConfigured,
    resetProviderSettings,
    registerCredentialWatch,
  } = createProviderLifecycle({
    providerCredentials,
    addedProviders,
    providerRuntimeState,
    providerMetadata,
    t,
    getDefaultProviderConfig,
    isProviderConfigured,
    validateProvider,
    fetchModelsForProvider,
    disposeProviderInstance,
  })

  // Call initially and watch for changes
  watch(providerCredentials, updateConfigurationStatus, { deep: true, immediate: false })

  // Watch for credential changes and refetch models accordingly
  registerCredentialWatch()

  // Initialize all providers
  Object.keys(providerMetadata).forEach(initializeProvider)

  // Initial validation run
  void updateConfigurationStatus()

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

  const availableModels = computed(() => {
    const result: Record<string, ModelInfo[]> = {}
    for (const [key, state] of Object.entries(providerRuntimeState.value)) {
      result[key] = state.models
    }
    return result
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
