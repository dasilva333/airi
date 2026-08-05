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
  requiresCredentials?: boolean
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
    loadModel?: (config: Record<string, unknown>, hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void }) => Promise<void>
    chatPingCheckAvailable?: boolean
    supportsSSML?: boolean
    supportsPitch?: boolean
  }
  validators: {
    chatPingCheckAvailable?: boolean
    validateProviderConfig: (config: Record<string, unknown>) => Promise<ProviderValidationResult> | ProviderValidationResult
    runManualValidation?: (config: Record<string, unknown>) => Promise<ProviderValidationResult> | ProviderValidationResult
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

export type BracketAction = 'mute' | 'flatten' | 'ignore' | 'token'

export interface ProviderInstanceConfig {
  /** Globally unique storage key: `${providerId}:${id}`. */
  instanceId: string
  /**
   * Per-provider suffix (the part after `${providerId}:`). '*' denotes the
   *  implicit primary instance for backward compatibility.
   */
  id: string
  /** Parent provider template id (e.g. "ollama", "openai"). */
  providerId: string
  /** Display label for this instance. */
  label: string
  /** Persisted per-instance options (apiKey, baseUrl, etc.). */
  options: Record<string, unknown>
  /** Whether this instance is the primary active instance for its provider. */
  isPrimary?: boolean
}

export interface CustomReplacementRule {
  id: string
  type: 'text' | 'regex'
  pattern: string
  replacement: string
  caseSensitive: boolean
  wholeWord: boolean
}

export interface VoiceProfile {
  id: string
  name: string
  baseProvider: string
  baseModel: string
  baseVoice: string
  effects: {
    pitch: number // multiplier e.g. 0.5 to 2.0
    rate: number // multiplier e.g. 0.5 to 3.0
    volume: number
    equalizer?: {
      bass: number
      mid: number
      treble: number
    }
    asmr: number // 0 to 100
    radio: number // 0 to 100
    robot: number // 0 to 100
    reverb: number // 0 to 100
    spatial: number // -100 to 100
  }
  ust: {
    enabled: boolean

    // Bracket Actions
    asterisks: BracketAction
    squareBrackets: BracketAction
    parentheses: BracketAction
    angleBrackets: BracketAction

    // Custom Bracket settings
    customBracketEnabled: boolean
    customBracketStart: string
    customBracketEnd: string
    customBracketAction: BracketAction

    stripEmojis: boolean
    stripSymbols: boolean
    tildeReplacement: string
    customReplacements: CustomReplacementRule[]

    // Legacy fields kept for backward compatibility / auto-migration
    mode?: 'mute' | 'flatten' | 'custom'
    customStripChars?: string
  }
}
