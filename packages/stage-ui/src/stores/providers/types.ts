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
import type { ProgressInfo } from '@xsai-transformers/shared/types'

export interface ProviderValidationResult {
  errors: unknown[]
  reason: string
  valid: boolean
}

export interface ProviderMetadata {
  id: string
  order?: number
  category: 'chat' | 'embed' | 'speech' | 'transcription' | 'vision'
  tasks: string[]
  nameKey: string
  name: string
  localizedName?: string
  descriptionKey: string
  description: string
  localizedDescription?: string
  configured?: boolean
  isAvailableBy?: () => Promise<boolean> | boolean
  icon?: string
  iconColor?: string
  iconImage?: string
  pricing?: 'free' | 'paid'
  deployment?: 'local' | 'cloud'
  beginnerRecommended?: boolean
  defaultOptions?: () => Record<string, unknown>
  createProvider: (
    config: Record<string, unknown>,
  ) =>
    | ChatProvider
    | ChatProviderWithExtraOptions
    | EmbedProvider
    | EmbedProviderWithExtraOptions
    | SpeechProvider
    | SpeechProviderWithExtraOptions
    | TranscriptionProvider
    | TranscriptionProviderWithExtraOptions
    | Promise<ChatProvider>
    | Promise<ChatProviderWithExtraOptions>
    | Promise<EmbedProvider>
    | Promise<EmbedProviderWithExtraOptions>
    | Promise<SpeechProvider>
    | Promise<SpeechProviderWithExtraOptions>
    | Promise<TranscriptionProvider>
    | Promise<TranscriptionProviderWithExtraOptions>
  capabilities: {
    listModels?: (config: Record<string, unknown>) => Promise<ModelInfo[]>
    listVoices?: (config: Record<string, unknown>) => Promise<VoiceInfo[]>
    getSpeechCapabilities?: (config: Record<string, unknown>) => Promise<SpeechCapabilitiesInfo | null>
    loadModel?: (
      config: Record<string, unknown>,
      hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void },
    ) => Promise<void>
    chatPingCheckAvailable?: boolean
    supportsSSML?: boolean
    supportsPitch?: boolean
  }
  validators: {
    chatPingCheckAvailable?: boolean
    validateProviderConfig: (
      config: Record<string, unknown>,
    ) => Promise<ProviderValidationResult> | ProviderValidationResult
    runManualValidation?: (
      config: Record<string, unknown>,
    ) => Promise<ProviderValidationResult> | ProviderValidationResult
  }
  transcriptionFeatures?: {
    supportsGenerate: boolean
    supportsStreamOutput: boolean
    supportsStreamInput: boolean
  }
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  description?: string
  capabilities?: string[]
  contextLength?: number
  deprecated?: boolean
  [key: string]: any
}

export interface VoiceInfo {
  id: string
  name: string
  provider: string
  compatibleModels?: string[]
  description?: string
  gender?: string
  deprecated?: boolean
  previewURL?: string
  languages: {
    code: string
    title: string
  }[]
}

export interface SpeechExpressionTagInfo {
  category: string
  tag: string
  description?: string
}

export interface SpeechMannerismInfo {
  id: string
  label: string
  description?: string
}

export interface SpeechCapabilitiesInfo {
  supportsPresets?: boolean
  supportsExpressionTags?: boolean
  supportsMannerisms?: boolean
  expressionTags?: SpeechExpressionTagInfo[]
  mannerisms?: SpeechMannerismInfo[]
  supportsSSML?: boolean
  supportsPitch?: boolean
}

export interface ProviderRuntimeState {
  isConfigured: boolean
  isInitialized: boolean
  isLoadingModels: boolean
  modelLoadError: string | null
  isAvailable: boolean
  isValidating: boolean
  lastValidated?: number
  validatedCredentialHash?: string
  models: ModelInfo[]
}
