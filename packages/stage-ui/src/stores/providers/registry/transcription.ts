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

import type { AliyunRealtimeSpeechExtraOptions } from '../aliyun/stream-transcription'
import type { ModelInfo, ProviderMetadata } from '../types'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { createOpenAI } from '@xsai-ext/providers/create'
import {
  createModelProvider,
  createTranscriptionProvider,
  merge,
} from '@xsai-ext/providers/utils'
import { listModels } from '@xsai/model'

import { DEFAULT_WHISPER_MODEL, WHISPER_MODELS } from '../../../libs/inference/constants'
import { createAliyunNLSProvider as createAliyunNlsStreamProvider } from '../aliyun/stream-transcription'
import { isBrowserAndMemoryEnough, logWarn, validateProviderBaseUrl } from '../helpers'
import { buildOpenAICompatibleProvider } from '../openai-compatible-builder'
import { createWebSpeechAPIProvider } from '../web-speech-api'
import { createWhisperLocalTranscriptionProvider } from '../whisper-local'

const ALIYUN_NLS_REGIONS = [
  'cn-shanghai',
  'cn-shanghai-internal',
  'cn-beijing',
  'cn-beijing-internal',
  'cn-shenzhen',
  'cn-shenzhen-internal',
] as const

type AliyunNlsRegion = typeof ALIYUN_NLS_REGIONS[number]

type AnyProvider
  = | ChatProvider
    | ChatProviderWithExtraOptions
    | EmbedProvider
    | EmbedProviderWithExtraOptions
    | SpeechProvider
    | SpeechProviderWithExtraOptions
    | TranscriptionProvider
    | TranscriptionProviderWithExtraOptions

/**
 * Transcription (STT) provider metadata registry.
 *
 * Extracted from `providers.ts` during the Phase 1 provider-store registry
 * restructure. Entries preserve their historical `baseUrlValidator` closure
 * semantics by capturing `validateProviderBaseUrl` directly (the store's
 * validator ref was a stable `{ value: validateProviderBaseUrl }` wrapper).
 */
export const transcriptionMetadata = {
  'whisper-local': {
    id: 'whisper-local',
    name: 'Whisper (Local)',
    nameKey: 'settings.pages.providers.provider.whisper-local.title',
    descriptionKey: 'settings.pages.providers.provider.whisper-local.description',
    icon: 'i-lobe-icons:huggingface',
    description: 'Private & Secure - In-browser transcription via WebGPU',
    category: 'transcription',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    requiresCredentials: false,
    isAvailableBy: isBrowserAndMemoryEnough,
    defaultOptions: () => ({
      model: DEFAULT_WHISPER_MODEL,
      language: 'en',
    }),
    createProvider: async (config?: any) => createWhisperLocalTranscriptionProvider(config),
    capabilities: {
      listModels: async () => WHISPER_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        provider: 'whisper-local',
        tasks: ['speech-to-text'],
        deployment: 'local' as const,
        description: m.description,
      })),
      listVoices: async () => [],
    },
    validators: {
      validateProviderConfig: () => ({
        errors: [],
        reason: '',
        valid: true,
      }),
    },
  },
  'openai-audio-transcription': buildOpenAICompatibleProvider({
    id: 'openai-audio-transcription',
    name: 'OpenAI',
    nameKey: 'settings.pages.providers.provider.openai.title',
    descriptionKey: 'settings.pages.providers.provider.openai-audio-transcription.description',
    icon: 'i-lobe-icons:openai',
    description: 'Industry Standard - Reliable and widely compatible Whisper API',
    category: 'transcription',
    consoleUrl: 'https://platform.openai.com/api-keys',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    defaultBaseUrl: 'https://api.openai.com/v1/',
    creator: createOpenAI,
    validation: ['health'],
    capabilities: {
      listModels: async () => {
        return [
          {
            id: 'gpt-4o-transcribe',
            name: 'GPT-4o Transcribe',
            provider: 'openai-audio-transcription',
            description: 'High-quality transcription model',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'gpt-4o-mini-transcribe',
            name: 'GPT-4o Mini Transcribe',
            provider: 'openai-audio-transcription',
            description: 'Faster, cost-effective transcription model',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'gpt-4o-mini-transcribe-2025-12-15',
            name: 'GPT-4o Mini Transcribe (2025-12-15)',
            provider: 'openai-audio-transcription',
            description: 'GPT-4o Mini Transcribe snapshot from 2025-12-15',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'whisper-1',
            name: 'Whisper-1',
            provider: 'openai-audio-transcription',
            description: 'Powered by our open source Whisper V2 model',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'gpt-4o-transcribe-diarize',
            name: 'GPT-4o Transcribe Diarize',
            provider: 'openai-audio-transcription',
            description: 'Transcription with speaker diarization',
            contextLength: 0,
            deprecated: false,
          },
        ] satisfies ModelInfo[]
      },
    },
    validators: {
      validateProviderConfig: (config) => {
        const errors = [
          !config.apiKey && new Error('API Key is required'),
          !config.baseUrl && new Error('Base URL is required. Default to https://api.openai.com/v1/ for official OpenAI API.'),
        ].filter(Boolean)

        const res = validateProviderBaseUrl(config.baseUrl)
        if (res) {
          return res
        }

        return {
          errors,
          reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
          valid: !!config.apiKey && !!config.baseUrl,
        }
      },
    },
  }),
  'openai-compatible-audio-transcription': buildOpenAICompatibleProvider({
    id: 'openai-compatible-audio-transcription',
    name: 'OpenAI Compatible',
    nameKey: 'settings.pages.providers.provider.openai-compatible.title',
    descriptionKey: 'settings.pages.providers.provider.openai-compatible-audio-transcription.description',
    icon: 'i-lobe-icons:openai',
    description: 'Bring Your Own Endpoint - Custom OpenAI-compatible STT endpoint',
    category: 'transcription',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    creator: createOpenAI,
    capabilities: {
      listModels: async (config: Record<string, unknown>) => {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
        let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

        if (!baseUrl.endsWith('/'))
          baseUrl += '/'

        if (!apiKey || !baseUrl) {
          return []
        }

        try {
          const models = await listModels({
            apiKey,
            baseURL: baseUrl,
          })

          // Filter for transcription models (whisper, stt, asr, transcription)
          return models
            .filter((model: any) => {
              const modelId = model.id.toLowerCase()
              return modelId.includes('whisper') || modelId.includes('stt') || modelId.includes('asr') || modelId.includes('transcription')
            })
            .map((model: any) => {
              return {
                id: model.id,
                name: model.name || model.display_name || model.id,
                provider: 'openai-compatible-audio-transcription',
                description: model.description || '',
                contextLength: 0,
                deprecated: false,
              } satisfies ModelInfo
            })
        }
        catch (e) {
          logWarn('Failed to list transcription models:', e)
          return []
        }
      },
    },
  }),
  'aliyun-nls-transcription': {
    id: 'aliyun-nls-transcription',
    category: 'transcription',
    pricing: 'paid',
    deployment: 'cloud',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt', 'streaming-transcription'],
    nameKey: 'settings.pages.providers.provider.aliyun-nls.title',
    name: 'Aliyun NLS',
    descriptionKey: 'settings.pages.providers.provider.aliyun-nls-transcription.description',
    description: 'Multilingual Powerhouse - Robust real-time STT with deep Chinese dialect support',
    icon: 'i-lobe-icons:alibabacloud',
    defaultOptions: () => ({
      accessKeyId: '',
      accessKeySecret: '',
      appKey: '',
      region: 'cn-shanghai',
    }),
    transcriptionFeatures: {
      supportsGenerate: false,
      supportsStreamOutput: true,
      supportsStreamInput: true,
    },
    createProvider: async (config) => {
      const toString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

      const accessKeyId = toString(config.accessKeyId)
      const accessKeySecret = toString(config.accessKeySecret)
      const appKey = toString(config.appKey)
      const region = toString(config.region)
      const resolvedRegion = ALIYUN_NLS_REGIONS.includes(region as AliyunNlsRegion) ? region as AliyunNlsRegion : 'cn-shanghai'

      if (!accessKeyId || !accessKeySecret || !appKey)
        throw new Error('Aliyun NLS credentials are incomplete.')

      const provider = createAliyunNlsStreamProvider(accessKeyId, accessKeySecret, appKey, { region: resolvedRegion })

      return {
        transcription: (model: string, extraOptions?: AliyunRealtimeSpeechExtraOptions) => provider.speech(model, {
          ...extraOptions,
          sessionOptions: {
            format: 'pcm',
            sample_rate: 16000,
            enable_punctuation_prediction: true,
            enable_intermediate_result: true,
            enable_words: true,
            ...extraOptions?.sessionOptions,
          },
        }),
      } as TranscriptionProviderWithExtraOptions<string, AliyunRealtimeSpeechExtraOptions>
    },
    capabilities: {
      listModels: async () => {
        return [
          {
            id: 'aliyun-nls-v1',
            name: 'Aliyun NLS Realtime',
            provider: 'aliyun-nls-transcription',
            description: 'Realtime streaming transcription using Aliyun NLS.',
            contextLength: 0,
            deprecated: false,
          },
        ]
      },
      listVoices: async () => [],
    },
    validators: {
      validateProviderConfig: (config) => {
        const errors: Error[] = []
        const toString = (value: unknown) => typeof value === 'string' ? value.trim() : ''

        const accessKeyId = toString(config.accessKeyId)
        const accessKeySecret = toString(config.accessKeySecret)
        const appKey = toString(config.appKey)
        const region = toString(config.region)

        if (!accessKeyId)
          errors.push(new Error('Access Key ID is required.'))
        if (!accessKeySecret)
          errors.push(new Error('Access Key Secret is required.'))
        if (!appKey)
          errors.push(new Error('App Key is required.'))
        if (region && !ALIYUN_NLS_REGIONS.includes(region as AliyunNlsRegion))
          errors.push(new Error('Region is invalid.'))

        return {
          errors,
          reason: errors.length > 0 ? errors.map(error => error.message).join(', ') : '',
          valid: errors.length === 0,
        }
      },
    },
  },
  'browser-web-speech-api': {
    id: 'browser-web-speech-api',
    category: 'transcription',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt', 'streaming-transcription'],
    nameKey: 'settings.pages.providers.provider.browser-web-speech-api.title',
    name: 'Web Speech API (Browser)',
    descriptionKey: 'settings.pages.providers.provider.browser-web-speech-api.description',
    description: 'Browser-native dictation (OS-dependent)',
    icon: 'i-solar:microphone-bold-duotone',
    requiresCredentials: false,
    defaultOptions: () => ({
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
    }),
    transcriptionFeatures: {
      supportsGenerate: false,
      supportsStreamOutput: true,
      supportsStreamInput: true,
    },
    isAvailableBy: async () => {
      // Web Speech API is only available in browser contexts, NOT in Electron
      // Even though Electron uses Chromium, Web Speech API requires Google's embedded API keys
      // which are not available in Electron, causing it to fail at runtime
      if (typeof window === 'undefined')
        return false

      // Explicitly exclude Electron - Web Speech API doesn't work there
      if (isStageTamagotchi())
        return false

      // Check if API is available in browser
      return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    },
    createProvider: async (_config) => {
      // Web Speech API doesn't need config, but we accept it for consistency
      return createWebSpeechAPIProvider()
    },
    capabilities: {
      listModels: async () => {
        return [
          {
            id: 'web-speech-api',
            name: 'Web Speech API',
            provider: 'browser-web-speech-api',
            description: 'Browser-native speech recognition (no API keys required)',
            contextLength: 0,
            deprecated: false,
          },
        ]
      },
    },
    validators: {
      validateProviderConfig: () => {
        // Web Speech API requires no configuration, just browser support
        // Always return valid if browser supports it, so it auto-configures
        const isAvailable = typeof window !== 'undefined'
          && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

        if (!isAvailable) {
          return {
            errors: [new Error('Web Speech API is not available. It requires a browser context with SpeechRecognition support (Chrome, Edge, Safari).')],
            reason: 'Web Speech API is not available in this environment.',
            valid: false,
          }
        }

        // Auto-configure if available (no credentials needed)
        return {
          errors: [],
          reason: '',
          valid: true,
        }
      },
    },
  },
  'deepgram-transcription': buildOpenAICompatibleProvider({
    id: 'deepgram-transcription',
    name: 'Deepgram STT (Nova)',
    pricing: 'free',
    deployment: 'cloud',
    beginnerRecommended: true,
    consoleUrl: 'https://console.deepgram.com/',
    nameKey: 'settings.pages.providers.provider.deepgram-transcription.title',
    descriptionKey: 'settings.pages.providers.provider.deepgram-transcription.description',
    icon: 'i-simple-icons:deepgram',
    description: '50 Hours Free for New Signups - Ultra-fast, high-accuracy real-time transcription',
    category: 'transcription',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    defaultBaseUrl: 'https://api.deepgram.com/v1/openai/',
    creator: createOpenAI,
    validation: [],
    capabilities: {
      listModels: async () => {
        return [
          {
            id: 'nova-3',
            name: 'Nova 3',
            provider: 'deepgram-transcription',
            description: 'Latest high-accuracy STT model',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'nova-2',
            name: 'Nova 2',
            provider: 'deepgram-transcription',
            description: 'Previous generation Nova model',
            contextLength: 0,
            deprecated: false,
          },
          {
            id: 'nova-2-general',
            name: 'Nova 2 (General)',
            provider: 'deepgram-transcription',
            description: 'General purpose Nova 2 STT model',
            contextLength: 0,
            deprecated: false,
          },
        ] satisfies ModelInfo[]
      },
    },
  }),
  'xai-audio-transcription': buildOpenAICompatibleProvider({
    id: 'xai-audio-transcription',
    name: 'xAI',
    nameKey: 'settings.pages.providers.provider.xai-audio-transcription.title',
    descriptionKey: 'settings.pages.providers.provider.xai-audio-transcription.description',
    icon: 'i-lobe-icons:xai',
    description: 'Grok Native - Real-time access to X/Twitter data',
    category: 'transcription',
    consoleUrl: 'https://console.x.ai/',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    defaultBaseUrl: 'https://api.x.ai/v1/',
    creator: (apiKey, baseURL = 'https://api.x.ai/v1/') => merge(
      createModelProvider({ apiKey, baseURL }),
      createTranscriptionProvider({ apiKey, baseURL }),
    ),
    validation: ['health'],
    transcriptionFeatures: {
      supportsGenerate: true,
      supportsStreamOutput: false,
      supportsStreamInput: false,
    },
    capabilities: {
      listModels: async () => {
        // xAI uses a single transcription endpoint
        return [
          {
            id: 'grok-2-transcribe',
            name: 'Grok 2 Transcribe',
            provider: 'xai-audio-transcription',
            description: 'xAI Grok speech-to-text model',
            contextLength: 0,
            deprecated: false,
          },
        ]
      },
    },
    validators: {
      validateProviderConfig: (config) => {
        const errors = [
          !config.apiKey && new Error('API Key is required'),
          !config.baseUrl && new Error('Base URL is required. Default to https://api.x.ai/v1/ for xAI API.'),
        ].filter(Boolean)

        return {
          errors,
          reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
          valid: !!config.apiKey && !!config.baseUrl,
        }
      },
    },
  }),
  'comet-api-transcription': buildOpenAICompatibleProvider({
    id: 'comet-api-transcription',
    name: 'CometAPI Transcription',
    nameKey: 'settings.pages.providers.provider.comet-api.title',
    descriptionKey: 'settings.pages.providers.provider.comet-api-transcription.description',
    icon: 'i-lobe-icons:cometapi',
    description: 'Enterprise-grade cloud transcription',
    category: 'transcription',
    consoleUrl: 'https://cometapi.com',
    tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    defaultBaseUrl: 'https://api.cometapi.com/v1/',
    creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') => merge(
      createModelProvider({ apiKey, baseURL }),
      createTranscriptionProvider({ apiKey, baseURL }),
    ),
    validation: ['model_list'],
  }),
} satisfies Record<string, ProviderMetadata & { createProvider?: (config: Record<string, unknown>) => AnyProvider | Promise<AnyProvider> }>
