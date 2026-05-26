import { isStageTamagotchi, isUrl } from '@proj-airi/stage-shared'
import { computedAsync, useLocalStorage } from '@vueuse/core'
import { listModels } from '@xsai/model'
import {
  createCerebras,
  createFireworks,
  createMistral,
  createMoonshotai,
  createNovitaAi,
  createOllama,
  createOpenAI,
  createPerplexity,
  createTogetherAI,
  createXai,
} from '@xsai-ext/providers/create'
import { createAzure, createPlayer2, createWorkersAI } from '@xsai-ext/providers/special/create'
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
import {
  createChatProvider,
  createModelProvider,
  createSpeechProvider,
  createTranscriptionProvider,
  merge,
} from '@xsai-ext/providers/utils'
import type { ProgressInfo } from '@xsai-transformers/shared/types'
import { AwsClient } from 'aws4fetch'
import { debounce, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import type {
  UnAlibabaCloudOptions,
  UnDeepgramOptions,
  UnElevenLabsOptions,
  UnMicrosoftOptions,
  UnVolcengineOptions,
  VoiceProviderWithExtraOptions,
} from 'unspeech'
import { createUnAlibabaCloud, createUnDeepgram, createUnMicrosoft, createUnVolcengine, listVoices } from 'unspeech'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { appLocalAudioTranscription } from '../libs/providers/providers/transcription/app-local-audio-transcription'
import { getKokoroWorker } from '../workers/kokoro'
import { getDefaultKokoroModel, KOKORO_MODELS, kokoroModelsToModelInfo } from '../workers/kokoro/constants'
import type { AliyunRealtimeSpeechExtraOptions } from './providers/aliyun/stream-transcription'
import { createAliyunNLSProvider as createAliyunNlsStreamProvider } from './providers/aliyun/stream-transcription'
import { models as elevenLabsModels } from './providers/elevenlabs/list-models'
import { createNativeElevenLabsProvider } from './providers/elevenlabs/native'
import {
  isBrowserAndMemoryEnough,
  logWarn,
  toProviderRootBaseUrl,
  toV1SpeechBaseUrl,
  validateProviderBaseUrl,
} from './providers/helpers'
import { buildOpenAICompatibleProvider } from './providers/openai-compatible-builder'
import { createProviderRegistry } from './providers/registry'
import type {
  ModelInfo,
  ProviderMetadata,
  ProviderRuntimeState,
  ProviderValidationResult,
  SpeechCapabilitiesInfo,
  VoiceInfo,
} from './providers/types'
import { createWebSpeechAPIProvider } from './providers/web-speech-api'

export type {
  ModelInfo,
  ProviderMetadata,
  ProviderRuntimeState,
  ProviderValidationResult,
  SpeechCapabilitiesInfo,
  VoiceInfo,
}

const ALIYUN_NLS_REGIONS = [
  'cn-shanghai',
  'cn-shanghai-internal',
  'cn-beijing',
  'cn-beijing-internal',
  'cn-shenzhen',
  'cn-shenzhen-internal',
] as const

type AliyunNlsRegion = (typeof ALIYUN_NLS_REGIONS)[number]

export const useProvidersStore = defineStore('providers', () => {
  const providerCredentials = useLocalStorage<Record<string, Record<string, unknown>>>(
    'settings/credentials/providers',
    {},
  )
  const addedProviders = useLocalStorage<Record<string, boolean>>('settings/providers/added', {})
  const providerInstanceCache = ref<Record<string, unknown>>({})
  const { t } = useI18n()
  const baseUrlValidator = { value: validateProviderBaseUrl }

  // Centralized provider metadata with provider factory functions
  const providerDefinitions: Record<string, ProviderMetadata> = {
    'alibaba-cloud-model-studio': {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: '',
              id: 'cosyvoice-v1',
              name: 'CosyVoice',
              provider: 'alibaba-cloud-model-studio',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: '',
              id: 'cosyvoice-v2',
              name: 'CosyVoice (New)',
              provider: 'alibaba-cloud-model-studio',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
          const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
          const provider = createUnAlibabaCloud(apiKey, baseUrl) as VoiceProviderWithExtraOptions<UnAlibabaCloudOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              compatibleModels: voice.compatible_models,
              gender: voice.labels?.gender,
              id: voice.id,
              languages: voice.languages,
              name: voice.name,
              previewURL: voice.preview_audio_url,
              provider: 'alibaba-cloud-model-studio',
            }
          })
        },
      },
      category: 'speech',
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnAlibabaCloud(apiKey, baseUrl)
      },
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      deployment: 'cloud',
      description: 'Enterprise Voice Studio - High-performance Qwen3-TTS and CosyVoice models',
      descriptionKey: 'settings.pages.providers.provider.alibaba-cloud-model-studio.description',
      iconColor: 'i-lobe-icons:alibabacloud',
      id: 'alibaba-cloud-model-studio',
      name: 'Alibaba Cloud Model Studio',
      nameKey: 'settings.pages.providers.provider.alibaba-cloud-model-studio.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validators: {
        chatPingCheckAvailable: false,
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.baseUrl && new Error('Base URL is required.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'aliyun-nls-transcription': {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Realtime streaming transcription using Aliyun NLS.',
              id: 'aliyun-nls-v1',
              name: 'Aliyun NLS Realtime',
              provider: 'aliyun-nls-transcription',
            },
          ]
        },
        listVoices: async () => [],
      },
      category: 'transcription',
      createProvider: async (config) => {
        const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

        const accessKeyId = toString(config.accessKeyId)
        const accessKeySecret = toString(config.accessKeySecret)
        const appKey = toString(config.appKey)
        const region = toString(config.region)
        const resolvedRegion = ALIYUN_NLS_REGIONS.includes(region as AliyunNlsRegion)
          ? (region as AliyunNlsRegion)
          : 'cn-shanghai'

        if (!accessKeyId || !accessKeySecret || !appKey) throw new Error('Aliyun NLS credentials are incomplete.')

        const provider = createAliyunNlsStreamProvider(accessKeyId, accessKeySecret, appKey, { region: resolvedRegion })

        return {
          transcription: (model: string, extraOptions?: AliyunRealtimeSpeechExtraOptions) =>
            provider.speech(model, {
              ...extraOptions,
              sessionOptions: {
                enable_intermediate_result: true,
                enable_punctuation_prediction: true,
                enable_words: true,
                format: 'pcm',
                sample_rate: 16000,
                ...extraOptions?.sessionOptions,
              },
            }),
        } as TranscriptionProviderWithExtraOptions<string, AliyunRealtimeSpeechExtraOptions>
      },
      defaultOptions: () => ({
        accessKeyId: '',
        accessKeySecret: '',
        appKey: '',
        region: 'cn-shanghai',
      }),
      deployment: 'cloud',
      description: 'Multilingual Powerhouse - Robust real-time STT with deep Chinese dialect support',
      descriptionKey: 'settings.pages.providers.provider.aliyun-nls-transcription.description',
      icon: 'i-lobe-icons:alibabacloud',
      id: 'aliyun-nls-transcription',
      name: 'Aliyun NLS',
      nameKey: 'settings.pages.providers.provider.aliyun-nls.title',
      pricing: 'paid',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt', 'streaming-transcription'],
      transcriptionFeatures: {
        supportsGenerate: false,
        supportsStreamInput: true,
        supportsStreamOutput: true,
      },
      validators: {
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

          const accessKeyId = toString(config.accessKeyId)
          const accessKeySecret = toString(config.accessKeySecret)
          const appKey = toString(config.appKey)
          const region = toString(config.region)

          if (!accessKeyId) errors.push(new Error('Access Key ID is required.'))
          if (!accessKeySecret) errors.push(new Error('Access Key Secret is required.'))
          if (!appKey) errors.push(new Error('App Key is required.'))
          if (region && !ALIYUN_NLS_REGIONS.includes(region as AliyunNlsRegion))
            errors.push(new Error('Region is invalid.'))

          return {
            errors,
            reason: errors.length > 0 ? errors.map((error) => error.message).join(', ') : '',
            valid: errors.length === 0,
          }
        },
      },
    },
    'app-local-audio-speech': buildOpenAICompatibleProvider({
      beginnerRecommended: true,
      category: 'speech',
      creator: createOpenAI,
      deployment: 'local',
      description: 'Private Voice Engine - High-performance local speech synthesis (xsai-transformers)',
      descriptionKey: 'settings.pages.providers.provider.app-local-audio-speech.description',
      icon: 'i-lobe-icons:huggingface',
      id: 'app-local-audio-speech',
      isAvailableBy: isStageTamagotchi,
      name: 'App (Local)',
      nameKey: 'settings.pages.providers.provider.app-local-audio-speech.title',
      pricing: 'free',
      tasks: ['text-to-speech', 'tts'],
      validation: [],
      validators: {
        validateProviderConfig: (config) => {
          if (!config.baseUrl) {
            return {
              errors: [new Error('Base URL is required.')],
              reason:
                'Base URL is required. This is likely a bug, report to developers on https://github.com/moeru-ai/airi/issues.',
              valid: false,
            }
          }

          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    }),
    'app-local-audio-transcription': appLocalAudioTranscription as any,
    'aws-polly-tts': {
      capabilities: {
        listModels: async () => {
          return [
            {
              deployment: 'cloud',
              id: 'neural',
              name: 'Neural',
              provider: 'aws-polly-tts',
              tasks: ['text-to-speech', 'tts'],
            },
            {
              deployment: 'cloud',
              id: 'standard',
              name: 'Standard',
              provider: 'aws-polly-tts',
              tasks: ['text-to-speech', 'tts'],
            },
          ] satisfies ModelInfo[]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const accessKeyId = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const secretAccessKey = typeof config.secretAccessKey === 'string' ? config.secretAccessKey.trim() : ''
          const region = typeof config.region === 'string' ? config.region.trim() : 'us-east-1'
          const engine = typeof config.model === 'string' ? config.model : 'neural'

          const fallbackVoices: VoiceInfo[] = [
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'female',
              id: 'Ivy',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Ivy',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'female',
              id: 'Joanna',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Joanna',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'female',
              id: 'Kendra',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Kendra',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'female',
              id: 'Kimberly',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Kimberly',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'male',
              id: 'Matthew',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Matthew',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'male',
              id: 'Joey',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Joey',
              provider: 'aws-polly-tts',
            },
            {
              compatibleModels: ['neural', 'standard'],
              gender: 'male',
              id: 'Justin',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              name: 'Justin',
              provider: 'aws-polly-tts',
            },
          ].filter((v) => v.compatibleModels!.includes(engine))

          if (!accessKeyId || !secretAccessKey) return fallbackVoices

          try {
            const client = new AwsClient({
              accessKeyId,
              region,
              secretAccessKey,
              service: 'polly',
            })

            const url = `https://polly.${region}.amazonaws.com/v1/voices?Engine=${engine}`
            const signed = await client.sign(url, { method: 'GET' })
            const response = await fetch(signed)

            if (!response.ok) {
              const error = await response.json()
              logWarn('AWS Polly ListVoices failed:', error)
              return fallbackVoices
            }

            const data = await response.json()
            const voices = data.Voices || []

            if (voices.length === 0) return fallbackVoices

            return voices.map((v: any) => ({
              compatibleModels: v.SupportedEngines || [],
              gender: v.Gender?.toLowerCase(),
              id: v.Id,
              languages: (Array.isArray(v.LanguageCode) ? v.LanguageCode : [v.LanguageCode]).map((code: string) => ({
                code,
                title: v.LanguageName || code,
              })),
              name: v.Name,
              provider: 'aws-polly-tts',
            })) satisfies VoiceInfo[]
          } catch (error) {
            logWarn('Error fetching AWS Polly voices:', error)
            return fallbackVoices
          }
        },
        supportsPitch: false,
        supportsSSML: true,
      },
      category: 'speech',
      createProvider: async (config) => {
        const accessKeyId = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
        const secretAccessKey = typeof config.secretAccessKey === 'string' ? config.secretAccessKey.trim() : ''
        const region = typeof config.region === 'string' ? config.region.trim() : 'us-east-1'

        if (!accessKeyId || !secretAccessKey) {
          throw new Error('AWS credentials (Access Key ID and Secret Access Key) are required.')
        }

        const client = new AwsClient({
          accessKeyId,
          region,
          secretAccessKey,
          service: 'polly',
        })

        return {
          speech: (model: string, _extraOptions?: any) => {
            return {
              // We'll ignore the automatic URL construction of generateSpeech
              baseURL: `https://polly.${region}.amazonaws.com/v1/`,
              async fetch(_url: string | URL | Request, options?: RequestInit) {
                // Transform to Native Polly Format
                const pollyUrl = `https://polly.${region}.amazonaws.com/v1/speech`

                let pollyBody = ''
                try {
                  const body = JSON.parse(options?.body as string)
                  pollyBody = JSON.stringify({
                    Engine: body.model || 'neural',
                    OutputFormat: 'mp3',
                    Text: body.input,
                    VoiceId: body.voice || 'Ivy',
                  })
                } catch (e) {
                  logWarn('Failed to parse speech body for transformation:', e)
                  pollyBody = options?.body as string
                }

                const signed = await client.sign(pollyUrl, {
                  ...options,
                  body: pollyBody,
                  method: 'POST',
                })
                return fetch(signed)
              },
              headers: {},
              model,
            }
          },
        } as SpeechProviderWithExtraOptions<string, any>
      },
      defaultOptions: () => ({
        model: 'neural',
        region: 'us-east-1',
        voice: 'Ivy',
      }),
      deployment: 'cloud',
      description: 'AWS Ecosystem - Native High-Quality Neural Voices from Amazon Polly',
      descriptionKey: 'settings.pages.providers.provider.aws-polly-tts.description',
      icon: 'i-logos:aws',
      id: 'aws-polly-tts',
      name: 'Amazon AWS Polly',
      nameKey: 'settings.pages.providers.provider.aws-polly-tts.title',
      pricing: 'paid',
      tasks: ['text-to-speech', 'tts'],
      validators: {
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          if (!config.apiKey) errors.push(new Error('AWS Access Key ID is required.'))
          if (!config.secretAccessKey) errors.push(new Error('AWS Secret Access Key is required.'))

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'azure-ai-foundry': {
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          return [{ id: config.modelId }].map((model) => {
            return {
              contextLength: 0,
              deprecated: false,
              description: '',
              id: model.id as string,
              name: model.id as string,
              provider: 'azure-ai-foundry',
            } satisfies ModelInfo
          })
        },
        listVoices: async () => [],
      },
      category: 'chat',
      createProvider: async (config) => {
        return await createAzure({
          apiKey: async () => (config.apiKey as string).trim(),
          apiVersion: config.apiVersion as string,
          resourceName: config.resourceName as string,
        })
      },
      defaultOptions: () => ({}),
      description: 'Enterprise Standard - Secure, robust Azure-hosted intelligence',
      descriptionKey: 'settings.pages.providers.provider.azure-ai-foundry.description',
      icon: 'i-lobe-icons:microsoft',
      id: 'azure-ai-foundry',
      name: 'Azure AI Foundry',
      nameKey: 'settings.pages.providers.provider.azure-ai-foundry.title',
      tasks: ['text-generation'],
      validators: {
        validateProviderConfig: (config) => {
          // return !!config.apiKey && !!config.resourceName && !!config.modelId

          const errors = [
            !config.apiKey && new Error('API key is required'),
            !config.resourceName && new Error('Resource name is required'),
            !config.modelId && new Error('Model ID is required'),
          ]

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'browser-local-audio-speech': buildOpenAICompatibleProvider({
      category: 'speech',
      creator: createOpenAI,
      description: 'Private Voice Engine - In-browser speech synthesis via Web Speech API or local engine',
      descriptionKey: 'settings.pages.providers.provider.browser-local-audio-speech.description',
      icon: 'i-lobe-icons:huggingface',
      id: 'browser-local-audio-speech',
      isAvailableBy: isBrowserAndMemoryEnough,
      name: 'Browser (Local)',
      nameKey: 'settings.pages.providers.provider.browser-local-audio-speech.title',
      tasks: ['text-to-speech', 'tts'],
      validation: [],
      validators: {
        validateProviderConfig: (config) => {
          if (!config.baseUrl) {
            return {
              errors: [new Error('Base URL is required.')],
              reason:
                'Base URL is required. This is likely a bug, report to developers on https://github.com/moeru-ai/airi/issues.',
              valid: false,
            }
          }

          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    }),
    'browser-local-audio-transcription': {
      capabilities: {
        listModels: async () => [],
        listVoices: async () => [],
      },
      category: 'transcription',
      createProvider: async () => ({
        transcription: () => ({
          baseURL: 'http://browser-local-audio-transcription.invalid/v1/',
          model: 'noop',
        }),
      }),
      defaultOptions: () => ({}),
      description: 'Private & Secure - In-browser transcription via WebGPU',
      descriptionKey: 'settings.pages.providers.provider.browser-local-audio-transcription.description',
      icon: 'i-lobe-icons:huggingface',
      id: 'browser-local-audio-transcription',
      isAvailableBy: isBrowserAndMemoryEnough,
      name: 'Browser (Local)',
      nameKey: 'settings.pages.providers.provider.browser-local-audio-transcription.title',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      validators: {
        validateProviderConfig: () => ({
          errors: [],
          reason: '',
          valid: true,
        }),
      },
    },
    'browser-web-speech-api': {
      beginnerRecommended: true,
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Browser-native speech recognition (no API keys required)',
              id: 'web-speech-api',
              name: 'Web Speech API',
              provider: 'browser-web-speech-api',
            },
          ]
        },
      },
      category: 'transcription',
      createProvider: async (_config) => {
        // Web Speech API doesn't need config, but we accept it for consistency
        return createWebSpeechAPIProvider()
      },
      defaultOptions: () => ({
        continuous: true,
        interimResults: true,
        language: 'en-US',
        maxAlternatives: 1,
      }),
      deployment: 'local',
      description: 'Browser-native dictation (OS-dependent)',
      descriptionKey: 'settings.pages.providers.provider.browser-web-speech-api.description',
      icon: 'i-solar:microphone-bold-duotone',
      id: 'browser-web-speech-api',
      isAvailableBy: async () => {
        // Web Speech API is only available in browser contexts, NOT in Electron
        // Even though Electron uses Chromium, Web Speech API requires Google's embedded API keys
        // which are not available in Electron, causing it to fail at runtime
        if (typeof window === 'undefined') return false

        // Explicitly exclude Electron - Web Speech API doesn't work there
        if (isStageTamagotchi()) return false

        // Check if API is available in browser
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
      },
      name: 'Web Speech API (Browser)',
      nameKey: 'settings.pages.providers.provider.browser-web-speech-api.title',
      pricing: 'free',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt', 'streaming-transcription'],
      transcriptionFeatures: {
        supportsGenerate: false,
        supportsStreamInput: true,
        supportsStreamOutput: true,
      },
      validators: {
        validateProviderConfig: () => {
          // Web Speech API requires no configuration, just browser support
          // Always return valid if browser supports it, so it auto-configures
          const isAvailable =
            typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

          if (!isAvailable) {
            return {
              errors: [
                new Error(
                  'Web Speech API is not available. It requires a browser context with SpeechRecognition support (Chrome, Edge, Safari).',
                ),
              ],
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

    'cerebras-ai': buildOpenAICompatibleProvider({
      creator: createCerebras,
      defaultBaseUrl: 'https://api.cerebras.ai/v1/',
      description: '1M Free Tokens/Day - Insanely fast LPU inference',
      descriptionKey: 'settings.pages.providers.provider.cerebras.description',
      icon: 'i-lobe-icons:cerebras',
      iconColor: 'i-lobe-icons:cerebras-color',
      id: 'cerebras-ai',
      name: 'Cerebras',
      nameKey: 'settings.pages.providers.provider.cerebras.title',
      validation: ['health', 'model_list'],
    }),
    chatterbox: buildOpenAICompatibleProvider({
      beginnerRecommended: true,
      capabilities: {
        getSpeechCapabilities: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const rootBaseUrl = toProviderRootBaseUrl(config.baseUrl)
          if (!rootBaseUrl) return null

          try {
            const response = await fetch(`${rootBaseUrl}chatterbox/capabilities`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok) return null

            const data = await response.json()
            const speech = data?.speech
            if (!speech) return null

            return {
              expressionTags: Array.isArray(speech.expressionTags) ? speech.expressionTags : [],
              mannerisms: Array.isArray(speech.mannerisms) ? speech.mannerisms : [],
              supportsExpressionTags: speech.supportsExpressionTags ?? false,
              supportsMannerisms: speech.supportsMannerisms ?? false,
              supportsPresets: speech.supportsPresets ?? true,
            } satisfies SpeechCapabilitiesInfo
          } catch (error) {
            logWarn('Failed to fetch Chatterbox speech capabilities:', error)
            return null
          }
        },
        listModels: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const apiBaseUrl = toV1SpeechBaseUrl(config.baseUrl)
          if (!apiBaseUrl) {
            return [
              {
                contextLength: 0,
                deprecated: false,
                description: 'Chatterbox speech generation',
                id: 'chatterbox',
                name: 'Chatterbox',
                provider: 'chatterbox',
              },
            ]
          }

          try {
            const response = await fetch(`${apiBaseUrl}models`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)

            const data = await response.json()
            const models = Array.isArray(data?.data) ? data.data : []
            if (models.length > 0) {
              return models.map(
                (model: any) =>
                  ({
                    contextLength: model.context_length || 0,
                    deprecated: false,
                    description: model.description || 'Chatterbox speech generation',
                    id: model.id,
                    name: model.name || model.display_name || model.id,
                    provider: 'chatterbox',
                  }) satisfies ModelInfo,
              )
            }
          } catch (error) {
            logWarn('Failed to fetch Chatterbox models:', error)
          }

          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Chatterbox speech generation',
              id: 'chatterbox',
              name: 'Chatterbox',
              provider: 'chatterbox',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const apiBaseUrl = toV1SpeechBaseUrl(config.baseUrl)
          if (!apiBaseUrl) return []

          try {
            const response = await fetch(`${apiBaseUrl}voices`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok) return []

            const data = await response.json()
            const voices = Array.isArray(data?.voices) ? data.voices : []
            return voices.map(
              (voice: any) =>
                ({
                  description: voice.type === 'virtual' ? 'Preset voice' : 'Native voice',
                  gender: voice.gender || voice.labels?.gender,
                  id: voice.voice_id || voice.id || voice.name,
                  languages: [{ code: 'en', title: 'English' }],
                  name: voice.name || voice.voice_id || voice.id,
                  previewURL: voice.preview_url || voice.preview_audio_url,
                  provider: 'chatterbox',
                }) satisfies VoiceInfo,
            )
          } catch (error) {
            logWarn('Failed to fetch Chatterbox voices:', error)
            return []
          }
        },
      },
      category: 'speech',
      creator: createOpenAI,
      defaultBaseUrl: 'http://127.0.0.1:8090/v1/',
      deployment: 'local',
      description: 'Advanced Voice Engine - Supports tags, profiles, presets, and high-performance playback',
      descriptionKey: 'settings.pages.providers.provider.chatterbox.description',
      icon: 'i-solar:microphone-3-bold-duotone',
      id: 'chatterbox',
      name: 'Chatterbox',
      nameKey: 'settings.pages.providers.provider.chatterbox.title',
      pricing: 'free',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: async (config: Record<string, unknown>) => {
          const errors: Error[] = []
          const baseUrl = toV1SpeechBaseUrl(config.baseUrl)
          const rootBaseUrl = toProviderRootBaseUrl(config.baseUrl)
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''

          if (!baseUrl) {
            errors.push(new Error('Base URL is required'))
          } else if (!isUrl(baseUrl)) {
            errors.push(new Error('Base URL is invalid. It must be an absolute URL.'))
          }

          if (errors.length > 0) {
            return {
              errors,
              reason: errors.map((error) => error.message).join(', '),
              valid: false,
            }
          }

          try {
            const response = await fetch(`${rootBaseUrl}chatterbox/capabilities`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }
          } catch (error) {
            const connectivityError = new Error(`Capabilities check failed: ${(error as Error).message}`)
            return {
              errors: [connectivityError],
              reason: connectivityError.message,
              valid: false,
            }
          }

          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    }),
    'cloudflare-workers-ai': {
      capabilities: {
        listModels: async () => {
          return []
        },
      },
      category: 'chat',
      createProvider: async (config) => createWorkersAI((config.apiKey as string).trim(), config.accountId as string),
      description: 'AI on the Edge - 10k free Neurons/day across many models',
      descriptionKey: 'settings.pages.providers.provider.cloudflare-workers-ai.description',
      iconColor: 'i-lobe-icons:cloudflare',
      id: 'cloudflare-workers-ai',
      name: 'Cloudflare Workers AI',
      nameKey: 'settings.pages.providers.provider.cloudflare-workers-ai.title',
      tasks: ['text-generation'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.accountId && new Error('Account ID is required.'),
          ].filter(Boolean)

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.accountId,
          }
        },
      },
    },
    'comet-api': buildOpenAICompatibleProvider({
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') =>
        merge(createChatProvider({ apiKey, baseURL }), createModelProvider({ apiKey, baseURL })),
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      description: 'GenAI Observability - Free tier for model evaluation',
      descriptionKey: 'settings.pages.providers.provider.comet-api.description',
      icon: 'i-lobe-icons:cometapi',
      id: 'comet-api',
      name: 'CometAPI',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      validation: ['model_list'],
    }),
    'comet-api-speech': buildOpenAICompatibleProvider({
      category: 'speech',
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') =>
        merge(createModelProvider({ apiKey, baseURL }), createSpeechProvider({ apiKey, baseURL })),
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      deployment: 'cloud',
      description: 'Unified Speech Gateway - Hosted speech models through Comet API',
      descriptionKey: 'settings.pages.providers.provider.comet-api-speech.description',
      icon: 'i-lobe-icons:cometapi',
      id: 'comet-api-speech',
      name: 'CometAPI Speech',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validation: ['model_list'],
    }),
    'comet-api-transcription': buildOpenAICompatibleProvider({
      category: 'transcription',
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') =>
        merge(createModelProvider({ apiKey, baseURL }), createTranscriptionProvider({ apiKey, baseURL })),
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      description: 'Enterprise-grade cloud transcription',
      descriptionKey: 'settings.pages.providers.provider.comet-api-transcription.description',
      icon: 'i-lobe-icons:cometapi',
      id: 'comet-api-transcription',
      name: 'CometAPI Transcription',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      validation: ['model_list'],
    }),
    'deepgram-transcription': buildOpenAICompatibleProvider({
      beginnerRecommended: true,
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Latest high-accuracy STT model',
              id: 'nova-3',
              name: 'Nova 3',
              provider: 'deepgram-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'Previous generation Nova model',
              id: 'nova-2',
              name: 'Nova 2',
              provider: 'deepgram-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'General purpose Nova 2 STT model',
              id: 'nova-2-general',
              name: 'Nova 2 (General)',
              provider: 'deepgram-transcription',
            },
          ] satisfies ModelInfo[]
        },
      },
      category: 'transcription',
      creator: createOpenAI,
      defaultBaseUrl: 'https://api.deepgram.com/v1/openai/',
      deployment: 'cloud',
      description: '50 Hours Free for New Signups - Ultra-fast, high-accuracy real-time transcription',
      descriptionKey: 'settings.pages.providers.provider.deepgram-transcription.description',
      icon: 'i-simple-icons:deepgram',
      id: 'deepgram-transcription',
      name: 'Deepgram STT (Nova)',
      nameKey: 'settings.pages.providers.provider.deepgram-transcription.title',
      pricing: 'free',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      validation: [],
    }),
    'deepgram-tts': {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Latest generation Aura model',
              id: 'aura-2',
              name: 'Aura 2',
              provider: 'deepgram-tts',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'First generation Aura model',
              id: 'aura-1',
              name: 'Aura 1',
              provider: 'deepgram-tts',
            },
            {
              contextLength: 0,
              deprecated: true,
              description: 'Original Aura model',
              id: 'aura',
              name: 'Aura (Legacy)',
              provider: 'deepgram-tts',
            },
          ]
        },
        listVoices: async (config) => {
          const provider = createUnDeepgram(
            (config.apiKey as string).trim(),
            (config.baseUrl as string).trim(),
          ) as VoiceProviderWithExtraOptions<UnDeepgramOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              description: voice.description,
              gender: voice.labels?.gender,
              id: voice.id,
              languages: voice.languages,
              name: voice.name,
              provider: 'deepgram-tts',
            }
          })
        },
        supportsPitch: false,
        supportsSSML: false,
      },
      category: 'speech',
      createProvider: async (config) => {
        const provider = createUnDeepgram(
          (config.apiKey as string).trim(),
          (config.baseUrl as string).trim(),
        ) as SpeechProviderWithExtraOptions<string, UnDeepgramOptions>
        return provider
      },
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      description: 'deepgram.com',
      descriptionKey: 'settings.pages.providers.provider.deepgram-tts.description',
      icon: 'i-simple-icons:deepgram',
      id: 'deepgram-tts',
      name: 'Deepgram',
      nameKey: 'settings.pages.providers.provider.deepgram-tts.title',
      tasks: ['text-to-speech'],
      validators: {
        chatPingCheckAvailable: false,
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          if (!config.apiKey) {
            errors.push(new Error('API key is required.'))
          }

          const baseUrlValidationResult = baseUrlValidator.value(config.baseUrl as string)
          if (baseUrlValidationResult) {
            errors.push(...(baseUrlValidationResult.errors as Error[]))
          }

          return {
            errors,
            reason: errors.map((e) => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    elevenlabs: {
      capabilities: {
        listModels: async () => {
          return elevenLabsModels.map((model) => {
            return {
              contextLength: 0,
              deprecated: false,
              description: model.description,
              id: model.model_id,
              name: model.name,
              provider: 'elevenlabs',
            } satisfies ModelInfo
          })
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string).trim()
          const baseUrl = (config.baseUrl as string).trim().replace(/\/$/, '')

          // Fetch ElevenLabs native GET /v1/voices directly.
          // The unspeech SDK's listVoices() constructs {baseURL}/api/voices?provider=elevenlabs
          // which does not exist on api.elevenlabs.io. We bypass it and call the real endpoint.
          const res = await fetch(`${baseUrl}/voices`, { headers: { 'xi-api-key': apiKey } })
          if (!res.ok) throw new Error(`ElevenLabs voices: ${res.status} ${res.statusText}`)

          const { voices: raw } = (await res.json()) as {
            voices: {
              voice_id: string
              name: string
              preview_url?: string
              labels?: Record<string, string>
              fine_tuning?: { language?: string }
            }[]
          }
          const voices = (raw ?? []).map((v) => ({
            gender: v.labels?.gender,
            id: v.voice_id,
            languages: v.fine_tuning?.language ? [{ code: v.fine_tuning.language, title: v.fine_tuning.language }] : [],
            name: v.name,
            previewURL: v.preview_url,
            provider: 'elevenlabs' as const,
          }))

          if (!voices || !Array.isArray(voices)) {
            return []
          }

          // Rearrange — move Aria & Bill range to the end
          const lo = Math.min(
            ...['Aria', 'Bill'].map((n) => {
              const i = voices.findIndex((v) => v.name.includes(n))
              return i !== -1 ? i : voices.length - 1
            }),
          )
          const hi = Math.max(
            ...['Aria', 'Bill'].map((n) => {
              const i = voices.findIndex((v) => v.name.includes(n))
              return i !== -1 ? i : 0
            }),
          )
          return [...voices.slice(0, lo), ...voices.slice(hi + 1), ...voices.slice(lo, hi + 1)]
        },
        supportsPitch: true,
        supportsSSML: true,
      },
      category: 'speech',
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string).trim()
        const baseUrl = (config.baseUrl as string).trim().replace(/\/$/, '')
        const voiceSettings = (config as any).voiceSettings ?? { similarityBoost: 0.75, stability: 0.5 }

        // We bypass the unspeech proxy and call ElevenLabs' native API directly across
        // all platforms. Previously this was Desktop-only due to CORS issues, but
        // ElevenLabs now returns 'Access-Control-Allow-Origin: *'. This avoids the
        // HTTP 401 errors caused by many users sharing the public unspeech proxy IP.
        return createNativeElevenLabsProvider(apiKey, baseUrl, voiceSettings) as SpeechProviderWithExtraOptions<
          string,
          UnElevenLabsOptions
        >
      },
      defaultOptions: () => ({
        baseUrl: 'https://api.elevenlabs.io/v1/',
        voiceSettings: {
          similarityBoost: 0.75,
          stability: 0.5,
        },
      }),
      deployment: 'cloud',
      description: 'Industry-Leading Realism - Unparalleled expressive neural voices (Premium Pricing)',
      descriptionKey: 'settings.pages.providers.provider.elevenlabs.description',
      icon: 'i-simple-icons:elevenlabs',
      id: 'elevenlabs',
      name: 'ElevenLabs',
      nameKey: 'settings.pages.providers.provider.elevenlabs.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.baseUrl && new Error('Base URL is required.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'featherless-ai': buildOpenAICompatibleProvider({
      creator: createOpenAI,
      defaultBaseUrl: 'https://api.featherless.ai/v1/',
      description: 'Unlimited Tokens - Flat $10/mo fee for 6,700+ models',
      descriptionKey: 'settings.pages.providers.provider.featherless.description',
      icon: 'i-lobe-icons:featherless-ai',
      id: 'featherless-ai',
      name: 'Featherless.ai',
      nameKey: 'settings.pages.providers.provider.featherless.title',
      validation: ['health', 'model_list'],
    }),
    'fireworks-ai': buildOpenAICompatibleProvider({
      creator: createFireworks,
      defaultBaseUrl: 'https://api.fireworks.ai/inference/v1/',
      description: 'Speed-Optimized - $1 free credit for premium model hosting',
      descriptionKey: 'settings.pages.providers.provider.fireworks.description',
      icon: 'i-lobe-icons:fireworks',
      id: 'fireworks-ai',
      name: 'Fireworks.ai',
      nameKey: 'settings.pages.providers.provider.fireworks.title',
      validation: ['health', 'model_list'],
    }),
    'index-tts-vllm': {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Default model for Index-TTS vLLM deployment',
              id: 'IndexTTS-1.5',
              name: 'IndexTTS-1.5',
              provider: 'index-tts-vllm',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const voicesUrl = config.baseUrl as string
          const response = await fetch(`${voicesUrl}audio/voices`)
          if (!response.ok) {
            throw new Error(`Failed to fetch voices: ${response.statusText}`)
          }
          const voices = await response.json()
          return Object.keys(voices).map((voice: any) => {
            return {
              id: voice,
              // previewURL: voice.preview_audio_url,
              languages: [
                { code: 'cn', title: 'Chinese' },
                { code: 'en', title: 'English' },
              ],
              name: voice,
              provider: 'index-tts-vllm',
            }
          })
        },
      },
      category: 'speech',
      createProvider: async (config) => {
        const provider: SpeechProvider = {
          speech: () => {
            const req = {
              baseURL: config.baseUrl as string,
              model: (config.model as string) || 'IndexTTS-1.5',
            }
            return req
          },
        }
        return provider
      },
      defaultOptions: () => ({
        baseUrl: 'http://localhost:11996/tts/',
        model: 'IndexTTS-1.5',
      }),
      deployment: 'local',
      description: 'Zero-Shot Specialist - Industrial-level controllable TTS with exceptional naturalness',
      descriptionKey: 'settings.pages.providers.provider.index-tts-vllm.description',
      iconColor: 'i-lobe-icons:bilibiliindex',
      id: 'index-tts-vllm',
      name: 'Index-TTS by Bilibili',
      nameKey: 'settings.pages.providers.provider.index-tts-vllm.title',
      pricing: 'free',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: async (config) => {
          const errors = [
            !config.baseUrl && new Error('Base URL is required. Default to http://localhost:11996/tts/ for Index-TTS.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const response = await fetch(`${config.baseUrl as string}audio/voices`, { signal: controller.signal })
            clearTimeout(timeout)

            if (!response.ok) {
              const reason = `IndexTTS unreachable: HTTP ${response.status} ${response.statusText}`
              return { errors: [new Error(reason)], reason, valid: false }
            }
          } catch (err) {
            const reason = `IndexTTS connection failed: ${String(err)}`
            return { errors: [err as Error], reason, valid: false }
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'kokoro-local': {
      capabilities: {
        listModels: async (_config: Record<string, unknown>) => {
          const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
          return kokoroModelsToModelInfo(hasWebGPU, t)
        },

        listVoices: async (config: Record<string, unknown>) => {
          try {
            // Reload the model before fetching voices
            const modelId = config.model as string
            if (modelId) {
              const modelDef = KOKORO_MODELS.find((m) => m.id === modelId)
              if (modelDef) {
                // Validate platform requirements
                if (modelDef.platform === 'webgpu') {
                  const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
                  if (!hasWebGPU) {
                    throw new Error('WebGPU is required for this model but is not available in your browser')
                  }
                }

                // Load the model
                const workerManager = await getKokoroWorker()
                await workerManager.loadModel(modelDef.quantization, modelDef.platform)
              }
            }

            // Get worker manager and fetch voices from the model
            const workerManager = await getKokoroWorker()
            const modelVoices = workerManager.getVoices()

            // Language code mapping
            const languageMap: Record<string, { code: string; title: string }> = {
              'en-gb': { code: 'en-GB', title: 'English (UK)' },
              'en-us': { code: 'en-US', title: 'English (US)' },
              es: { code: 'es', title: 'Spanish' },
              fr: { code: 'fr', title: 'French' },
              hi: { code: 'hi', title: 'Hindi' },
              it: { code: 'it', title: 'Italian' },
              ja: { code: 'ja', title: 'Japanese' },
              'pt-br': { code: 'pt-BR', title: 'Portuguese (Brazil)' },
              'zh-cn': { code: 'zh-CN', title: 'Chinese (Mandarin)' },
            }

            // Transform the voices object to the expected array format
            return Object.entries(modelVoices).map(
              ([id, voice]: [string, { language: string; name: string; gender: string }]) => {
                const languageCode = voice.language.toLowerCase()
                const languageInfo = languageMap[languageCode] || { code: languageCode, title: voice.language }

                return {
                  gender: voice.gender.toLowerCase(),
                  id,
                  languages: [languageInfo],
                  name: `${voice.name} (${voice.gender}, ${languageInfo.title.split('(')[0].trim()})`,
                  provider: 'kokoro-local',
                }
              },
            )
          } catch (error) {
            console.error('Failed to fetch Kokoro voices:', error)
            // Return empty array if model not loaded yet
            return []
          }
        },

        loadModel: async (
          config: Record<string, unknown>,
          _hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void },
        ) => {
          const modelId = config.model as string

          if (!modelId) {
            throw new Error('No model specified')
          }

          const modelDef = KOKORO_MODELS.find((m) => m.id === modelId)
          if (!modelDef) {
            throw new Error(`Invalid model: ${modelId}. Must be one of: ${KOKORO_MODELS.map((m) => m.id).join(', ')}`)
          }

          // Validate platform requirements
          if (modelDef.platform === 'webgpu') {
            const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
            if (!hasWebGPU) {
              throw new Error('WebGPU is required for this model but is not available in your browser')
            }
          }

          try {
            const workerManager = await getKokoroWorker()
            await workerManager.loadModel(modelDef.quantization, modelDef.platform, { onProgress: _hooks?.onProgress })
          } catch (error) {
            console.error('Failed to load Kokoro model:', error)
            throw error
          }
        },
      },
      category: 'speech',

      createProvider: async (_config) => {
        // Import the worker manager
        const workerManagerPromise = getKokoroWorker()

        const provider: SpeechProvider = {
          speech: () => {
            return {
              baseURL: 'http://kokoro-local/v1/',
              fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
                try {
                  // Parse OpenAI-compatible request body
                  if (!init?.body || typeof init.body !== 'string') {
                    throw new Error('Invalid request body')
                  }
                  const body = JSON.parse(init.body)
                  const text = body.input
                  const voice = body.voice

                  if (!voice) {
                    throw new Error('Voice parameter is required')
                  }

                  // Generate audio in the worker thread
                  const buffer = await (await workerManagerPromise).generate(text, voice)

                  return new Response(buffer, {
                    headers: {
                      'Content-Type': 'audio/wav',
                    },
                    status: 200,
                  })
                } catch (error) {
                  console.error('Kokoro TTS generation failed:', error)
                  throw error
                }
              },
              model: 'kokoro-82m',
            }
          },
        }

        return provider
      },

      defaultOptions: () => {
        const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
        const model = getDefaultKokoroModel(hasWebGPU)
        return {
          model,
          voiceId: '',
        }
      },
      description: 'Native AI - Local text-to-speech using Kokoro-82M',
      descriptionKey: 'settings.pages.providers.provider.kokoro-local.description',
      icon: 'i-lobe-icons:speaker',
      id: 'kokoro-local',
      name: 'Kokoro TTS',
      nameKey: 'settings.pages.providers.provider.kokoro-local.title',
      tasks: ['text-to-speech'],

      validators: {
        validateProviderConfig: async (config: any) => {
          const model = config.model as string

          if (!model) {
            return {
              errors: [new Error('No model selected')],
              reason: 'Please select a model from the dropdown menu',
              valid: false,
            }
          }

          if (!KOKORO_MODELS.some((m) => m.id === model)) {
            return {
              errors: [new Error(`Invalid model: ${model}`)],
              reason: `Invalid model. Must be one of: ${KOKORO_MODELS.map((m) => m.id).join(', ')}`,
              valid: false,
            }
          }

          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    },
    'microsoft-speech': {
      beginnerRecommended: true,
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: '',
              id: 'v1',
              name: 'v1',
              provider: 'microsoft-speech',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
          const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
          const provider = createUnMicrosoft(apiKey, baseUrl) as VoiceProviderWithExtraOptions<UnMicrosoftOptions>

          const voices = await listVoices({
            ...provider.voice({ region: config.region as string }),
          })

          return voices.map((voice) => {
            return {
              gender: voice.labels?.gender,
              id: voice.id,
              languages: voice.languages,
              name: voice.name,
              previewURL: voice.preview_audio_url,
              provider: 'microsoft-speech',
            }
          })
        },
        supportsPitch: true,
        supportsSSML: true,
      },
      category: 'speech',
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnMicrosoft(apiKey, baseUrl) as SpeechProviderWithExtraOptions<string, UnMicrosoftOptions>
      },
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      deployment: 'cloud',
      description: 'Enterprise Standard - Massive library of high-quality neural voices',
      descriptionKey: 'settings.pages.providers.provider.microsoft-speech.description',
      iconColor: 'i-lobe-icons:microsoft',
      id: 'microsoft-speech',
      name: 'Microsoft / Azure Speech',
      nameKey: 'settings.pages.providers.provider.microsoft-speech.title',
      pricing: 'free',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.baseUrl && new Error('Base URL is required.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'mistral-ai': buildOpenAICompatibleProvider({
      creator: createMistral,
      defaultBaseUrl: 'https://api.mistral.ai/v1/',
      description: 'European Open-Weights - High-efficiency, low-latency models',
      descriptionKey: 'settings.pages.providers.provider.mistral.description',
      icon: 'i-lobe-icons:mistral',
      iconColor: 'i-lobe-icons:mistral',
      id: 'mistral-ai',
      name: 'Mistral',
      nameKey: 'settings.pages.providers.provider.mistral.title',
      validation: ['health', 'model_list'],
    }),
    modelscope: buildOpenAICompatibleProvider({
      creator: createOpenAI,
      defaultBaseUrl: 'https://api-inference.modelscope.cn/v1/',
      description: 'modelscope',
      descriptionKey: 'settings.pages.providers.provider.modelscope.description',
      icon: 'i-lobe-icons:modelscope',
      iconColor: 'i-lobe-icons:modelscope',
      id: 'modelscope',
      name: 'ModelScope',
      nameKey: 'settings.pages.providers.provider.modelscope.title',
      validation: ['health', 'model_list'],
    }),
    'moonshot-ai': buildOpenAICompatibleProvider({
      creator: createMoonshotai,
      defaultBaseUrl: 'https://api.moonshot.ai/v1/',
      description: 'Long-Context Specialist - Kimi Chat with 256k context window',
      descriptionKey: 'settings.pages.providers.provider.moonshot.description',
      icon: 'i-lobe-icons:moonshot',
      id: 'moonshot-ai',
      name: 'Moonshot AI',
      nameKey: 'settings.pages.providers.provider.moonshot.title',
      validation: ['health', 'model_list'],
    }),
    'novita-ai': buildOpenAICompatibleProvider({
      creator: createNovitaAi,
      defaultBaseUrl: 'https://api.novita.ai/openai/',
      description: 'Scalable Cloud - 10,000+ models with ultra-fast, low-latency inference',
      descriptionKey: 'settings.pages.providers.provider.novita.description',
      icon: 'i-lobe-icons:novita',
      iconColor: 'i-lobe-icons:novita',
      id: 'novita-ai',
      name: 'Novita',
      nameKey: 'settings.pages.providers.provider.novita.title',
      validation: ['health', 'model_list'],
    }),
    'openai-audio-speech': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async () => {
          // TESTING NOTES: All 4 models tested and confirmed working with fable voice:
          // - tts-1: {model: "tts-1", input: "test", voice: "fable"} ✓
          // - tts-1-hd: {model: "tts-1-hd", input: "test", voice: "fable"} ✓
          // - gpt-4o-mini-tts: {model: "gpt-4o-mini-tts", input: "test", voice: "fable"} ✓
          // - gpt-4o-mini-tts-2025-12-15: {model: "gpt-4o-mini-tts-2025-12-15", input: "test", voice: "fable"} ✓
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Optimized for real-time text-to-speech tasks',
              id: 'tts-1',
              name: 'TTS-1',
              provider: 'openai-audio-speech',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'Higher fidelity audio output',
              id: 'tts-1-hd',
              name: 'TTS-1-HD',
              provider: 'openai-audio-speech',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'GPT-4o Mini optimized for text-to-speech',
              id: 'gpt-4o-mini-tts',
              name: 'GPT-4o Mini TTS',
              provider: 'openai-audio-speech',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'GPT-4o Mini TTS snapshot from 2025-12-15',
              id: 'gpt-4o-mini-tts-2025-12-15',
              name: 'GPT-4o Mini TTS (2025-12-15)',
              provider: 'openai-audio-speech',
            },
          ]
        },
        // NOTE: OpenAI does not provide an API endpoint to retrieve available voices.
        // Voices are hardcoded here - this is a provider limitation, not an application limitation.
        // Voice compatibility per https://platform.openai.com/docs/api-reference/audio/createSpeech:
        // - tts-1 and tts-1-hd support: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer (9 voices)
        // - gpt-4o-mini-tts supports all 13 voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
        listVoices: async (_config: Record<string, unknown>) => {
          return [
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'alloy',
              languages: [],
              name: 'Alloy',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'ash',
              languages: [],
              name: 'Ash',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'ballad',
              languages: [],
              name: 'Ballad',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'coral',
              languages: [],
              name: 'Coral',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'echo',
              languages: [],
              name: 'Echo',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'fable',
              languages: [],
              name: 'Fable',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'onyx',
              languages: [],
              name: 'Onyx',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'nova',
              languages: [],
              name: 'Nova',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'sage',
              languages: [],
              name: 'Sage',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'shimmer',
              languages: [],
              name: 'Shimmer',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'verse',
              languages: [],
              name: 'Verse',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'marin',
              languages: [],
              name: 'Marin',
              provider: 'openai-audio-speech',
            },
            {
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
              id: 'cedar',
              languages: [],
              name: 'Cedar',
              provider: 'openai-audio-speech',
            },
          ] satisfies VoiceInfo[]
        },
        supportsPitch: false,
        supportsSSML: false,
      },
      category: 'speech',
      creator: createOpenAI,
      defaultBaseUrl: 'https://api.openai.com/v1/',
      deployment: 'cloud',
      description: 'Industry Standard - Reliable flagship TTS voices from OpenAI',
      descriptionKey: 'settings.pages.providers.provider.openai-audio-speech.description',
      icon: 'i-lobe-icons:openai',
      id: 'openai-audio-speech',
      name: 'OpenAI',
      nameKey: 'settings.pages.providers.provider.openai.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validation: ['health'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API Key is required'),
            !config.baseUrl &&
              new Error('Base URL is required. Default to https://api.openai.com/v1/ for official OpenAI API.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    }),
    'openai-audio-transcription': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'High-quality transcription model',
              id: 'gpt-4o-transcribe',
              name: 'GPT-4o Transcribe',
              provider: 'openai-audio-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'Faster, cost-effective transcription model',
              id: 'gpt-4o-mini-transcribe',
              name: 'GPT-4o Mini Transcribe',
              provider: 'openai-audio-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'GPT-4o Mini Transcribe snapshot from 2025-12-15',
              id: 'gpt-4o-mini-transcribe-2025-12-15',
              name: 'GPT-4o Mini Transcribe (2025-12-15)',
              provider: 'openai-audio-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'Powered by our open source Whisper V2 model',
              id: 'whisper-1',
              name: 'Whisper-1',
              provider: 'openai-audio-transcription',
            },
            {
              contextLength: 0,
              deprecated: false,
              description: 'Transcription with speaker diarization',
              id: 'gpt-4o-transcribe-diarize',
              name: 'GPT-4o Transcribe Diarize',
              provider: 'openai-audio-transcription',
            },
          ] satisfies ModelInfo[]
        },
      },
      category: 'transcription',
      creator: createOpenAI,
      defaultBaseUrl: 'https://api.openai.com/v1/',
      description: 'Industry Standard - Reliable and widely compatible Whisper API',
      descriptionKey: 'settings.pages.providers.provider.openai-audio-transcription.description',
      icon: 'i-lobe-icons:openai',
      id: 'openai-audio-transcription',
      name: 'OpenAI',
      nameKey: 'settings.pages.providers.provider.openai.title',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      validation: ['health'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API Key is required'),
            !config.baseUrl &&
              new Error('Base URL is required. Default to https://api.openai.com/v1/ for official OpenAI API.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    }),
    'openai-compatible-audio-speech': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          // Filter models to only include TTS models
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl.endsWith('/')) baseUrl += '/'

          if (!apiKey || !baseUrl) {
            return []
          }

          const provider = await createOpenAI(apiKey, baseUrl)
          if (!provider || typeof provider.model !== 'function') {
            return []
          }

          const models = await listModels({
            apiKey,
            baseURL: baseUrl,
          })

          // Filter for TTS/Speech/Audio models
          return models
            .filter((model: any) => {
              const modelId = model.id.toLowerCase()
              // Include models that contain "tts", "speech", "audio", or "kokoro" in their ID
              return (
                modelId.includes('tts') ||
                modelId.includes('speech') ||
                modelId.includes('audio') ||
                modelId.includes('kokoro')
              )
            })
            .map((model: any) => {
              return {
                contextLength: model.context_length || 0,
                deprecated: false,
                description: model.description || '',
                id: model.id,
                name: model.name || model.display_name || model.id,
                provider: 'openai-compatible-audio-speech',
              } satisfies ModelInfo
            })
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl.endsWith('/')) baseUrl += '/'

          if (!baseUrl) {
            return []
          }

          // Attempt to fetch voices from /v1/voices or /voices
          // Try /v1/voices first
          const tryFetchVoices = async (url: string) => {
            try {
              const response = await fetch(url, {
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              })
              if (response.ok) {
                const data = await response.json()
                // Standard un-speech / openai-like voices response
                const voices = data.voices || data.data || (Array.isArray(data) ? data : null)
                if (Array.isArray(voices)) {
                  return voices.map((v: any) => ({
                    gender: v.gender || v.labels?.gender,
                    id: v.id || v.voice_id || v.name,
                    languages: v.languages || [],
                    name: v.name || v.id,
                    previewURL: v.preview_url || v.preview_audio_url,
                    provider: 'openai-compatible-audio-speech',
                  }))
                }
              }
            } catch (e) {
              logWarn(`Failed to fetch voices from ${url}:`, e)
            }
            return null
          }

          const voices =
            (await tryFetchVoices(`${baseUrl}voices`)) ||
            (await tryFetchVoices(`${baseUrl.replace(/\/v1\/$/, '/')}/voices`))

          return voices || []
        },
        supportsPitch: false,
        supportsSSML: false,
      },
      category: 'speech',
      creator: createOpenAI,
      deployment: 'cloud',
      description: 'Bring Your Own Endpoint - Connect any OpenAI-style TTS API or self-hosted gateway',
      descriptionKey: 'settings.pages.providers.provider.openai-compatible-audio-speech.description',
      icon: 'i-lobe-icons:openai',
      id: 'openai-compatible-audio-speech',
      name: 'OpenAI Compatible',
      nameKey: 'settings.pages.providers.provider.openai-compatible.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
    }),
    'openai-compatible-audio-transcription': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl.endsWith('/')) baseUrl += '/'

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
                return (
                  modelId.includes('whisper') ||
                  modelId.includes('stt') ||
                  modelId.includes('asr') ||
                  modelId.includes('transcription')
                )
              })
              .map((model: any) => {
                return {
                  contextLength: 0,
                  deprecated: false,
                  description: model.description || '',
                  id: model.id,
                  name: model.name || model.display_name || model.id,
                  provider: 'openai-compatible-audio-transcription',
                } satisfies ModelInfo
              })
          } catch (e) {
            logWarn('Failed to list transcription models:', e)
            return []
          }
        },
      },
      category: 'transcription',
      creator: createOpenAI,
      description: 'Bring Your Own Endpoint - Custom OpenAI-compatible STT endpoint',
      descriptionKey: 'settings.pages.providers.provider.openai-compatible-audio-transcription.description',
      icon: 'i-lobe-icons:openai',
      id: 'openai-compatible-audio-transcription',
      name: 'OpenAI Compatible',
      nameKey: 'settings.pages.providers.provider.openai-compatible.title',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
    }),
    'openrouter-audio-speech': {
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          let baseUrl = (typeof config.baseUrl === 'string' && config.baseUrl.trim()) || 'https://openrouter.ai/api/v1/'
          if (!baseUrl.endsWith('/')) baseUrl += '/'

          try {
            const res = await fetch(`${baseUrl}models?output_modality=audio`)
            if (!res.ok) return []

            const json = await res.json()
            const models = json.data || []
            return models.map(
              (m: any) =>
                ({
                  contextLength: m.context_length || 0,
                  deprecated: false,
                  description: m.description || '',
                  id: m.id,
                  name: m.name || m.id,
                  provider: 'openrouter-audio-speech',
                }) satisfies ModelInfo,
            )
          } catch {
            return []
          }
        },
        listVoices: async () => {
          // OpenRouter audio models support standard OpenAI voices
          return ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'].map(
            (id) =>
              ({
                id,
                languages: [],
                name: id.charAt(0).toUpperCase() + id.slice(1),
                provider: 'openrouter-audio-speech',
              }) satisfies VoiceInfo,
          )
        },
      },
      category: 'speech',
      createProvider: async (config) => {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
        let baseUrl = (typeof config.baseUrl === 'string' && config.baseUrl.trim()) || 'https://openrouter.ai/api/v1/'
        if (!baseUrl.endsWith('/')) baseUrl += '/'

        const provider: SpeechProvider = {
          speech: (model?: string) => ({
            baseURL: baseUrl,
            fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
              if (!init?.body || typeof init.body !== 'string') throw new Error('Invalid request body')

              const body = JSON.parse(init.body)
              const text = body.input
              const voice = body.voice

              const sseResponse = await globalThis.fetch(new URL('chat/completions', baseUrl), {
                body: JSON.stringify({
                  audio: { format: 'pcm16', voice },
                  messages: [
                    {
                      content: `Read this text aloud exactly as written, without any commentary or extra words:\n\n${text}`,
                      role: 'user',
                    },
                  ],
                  modalities: ['text', 'audio'],
                  model: model || 'openai/gpt-audio-mini',
                  stream: true,
                }),
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                method: 'POST',
              })

              if (!sseResponse.ok) {
                const errorText = await sseResponse.text()
                throw new Error(`OpenRouter audio request failed: ${sseResponse.status} ${errorText}`)
              }

              const reader = sseResponse.body!.getReader()
              const decoder = new TextDecoder()
              const audioDataChunks: string[] = []
              let buffer = ''

              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()!

                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue
                  const data = line.slice('data: '.length).trim()
                  if (data === '[DONE]') break

                  try {
                    const chunk = JSON.parse(data)
                    const audio = chunk.choices?.[0]?.delta?.audio
                    if (audio?.data) audioDataChunks.push(audio.data)
                  } catch (e) {
                    // skip malformed chunks, but log them for debugging
                    console.warn('Skipping malformed SSE chunk from OpenRouter audio stream:', data, e)
                  }
                }
              }

              // Decode base64 PCM16 data
              const fullBase64 = audioDataChunks.join('')
              const binaryString = atob(fullBase64)
              const pcmBytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++) pcmBytes[i] = binaryString.charCodeAt(i)

              // Wrap raw PCM16 in a WAV header so the browser can play it
              const sampleRate = 24000
              const numChannels = 1
              const bitsPerSample = 16
              const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
              const blockAlign = numChannels * (bitsPerSample / 8)
              const wavHeader = new ArrayBuffer(44)
              const view = new DataView(wavHeader)
              const writeStr = (offset: number, str: string) => {
                for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
              }

              // RIFF chunk descriptor
              writeStr(0, 'RIFF') // ChunkID
              view.setUint32(4, 36 + pcmBytes.length, true) // ChunkSize
              writeStr(8, 'WAVE') // Format

              // "fmt " sub-chunk
              writeStr(12, 'fmt ') // Subchunk1ID
              view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
              view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
              view.setUint16(22, numChannels, true) // NumChannels
              view.setUint32(24, sampleRate, true) // SampleRate
              view.setUint32(28, byteRate, true) // ByteRate
              view.setUint16(32, blockAlign, true) // BlockAlign
              view.setUint16(34, bitsPerSample, true) // BitsPerSample

              // "data" sub-chunk
              writeStr(36, 'data') // Subchunk2ID
              view.setUint32(40, pcmBytes.length, true) // Subchunk2Size

              const wavBytes = new Uint8Array(44 + pcmBytes.length)
              wavBytes.set(new Uint8Array(wavHeader), 0)
              wavBytes.set(pcmBytes, 44)

              return new Response(wavBytes.buffer, {
                headers: { 'Content-Type': 'audio/wav' },
                status: 200,
              })
            },
            model: model || 'openai/gpt-audio-mini',
          }),
        }
        return provider
      },
      defaultOptions: () => ({
        baseUrl: 'https://openrouter.ai/api/v1/',
      }),
      deployment: 'cloud',
      description: 'Unified Speech Gateway - Access partner TTS models through OpenRouter',
      descriptionKey: 'settings.pages.providers.provider.openrouter-audio-speech.description',
      icon: 'i-lobe-icons:openrouter',
      id: 'openrouter-audio-speech',
      name: 'OpenRouter',
      nameKey: 'settings.pages.providers.provider.openrouter-audio-speech.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          if (!config.apiKey) errors.push(new Error('API Key is required.'))

          if (config.baseUrl) {
            const res = baseUrlValidator.value(config.baseUrl)
            if (res) errors.push(...(res.errors as Error[]))
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'perplexity-ai': buildOpenAICompatibleProvider({
      creator: createPerplexity,
      defaultBaseUrl: 'https://api.perplexity.ai/',
      description: 'Search-Augmented - Real-time web-connected intelligence',
      descriptionKey: 'settings.pages.providers.provider.perplexity.description',
      icon: 'i-lobe-icons:perplexity',
      id: 'perplexity-ai',
      name: 'Perplexity',
      nameKey: 'settings.pages.providers.provider.perplexity.title',
      validation: ['health', 'model_list'],
    }),
    player2: {
      capabilities: {
        listModels: async () => [
          {
            id: 'player2-model',
            name: 'Player2 Model',
            provider: 'player2',
          },
        ],
      },
      category: 'chat',
      createProvider: (config) => {
        return createPlayer2((config.baseUrl as string).trim())
      },
      defaultOptions: () => ({
        baseUrl: 'http://localhost:4315/v1/',
      }),
      description: 'player2.game',
      descriptionKey: 'settings.pages.providers.provider.player2.description',
      icon: 'i-lobe-icons:player2',
      id: 'player2',
      name: 'Player2',
      nameKey: 'settings.pages.providers.provider.player2.title',
      tasks: ['text-generation'],
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
              headers: {
                'player2-game-key': 'airi',
              },
              method: 'GET',
            })
            const errors = [
              !response.ok && new Error(`Player 2 returned non-ok status code: ${response.statusText}`),
            ].filter((e): e is Error => e instanceof Error)

            return {
              errors,
              reason: errors
                .filter((e): e is Error => e instanceof Error)
                .map((e) => e.message)
                .join(', '),
              valid: response.ok,
            }
          } catch (err) {
            return {
              errors: [err as Error],
              reason: `Failed to reach Player 2, error: ${String(err)} occurred. If you do not have Player 2 running, please start it and try again.`,
              valid: false,
            }
          }
        },
      },
    },

    'player2-speech': {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'Default model for Player2 speech endpoint',
              id: 'player2-tts',
              name: 'Player2 Speech',
              provider: 'player2-speech',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const baseUrl = (config.baseUrl as string).endsWith('/')
            ? (config.baseUrl as string).slice(0, -1)
            : (config.baseUrl as string)
          return await fetch(`${baseUrl}/tts/voices`)
            .then((res) => res.json())
            .then(({ voices }) =>
              (
                voices as {
                  id: string
                  language:
                    | 'american_english'
                    | 'british_english'
                    | 'japanese'
                    | 'mandarin_chinese'
                    | 'spanish'
                    | 'french'
                    | 'hindi'
                    | 'italian'
                    | 'brazilian_portuguese'
                  name: string
                  gender: string
                }[]
              ).map(({ id, language, name, gender }) => ({
                gender,

                id,
                languages: [
                  {
                    american_english: {
                      code: 'en',
                      title: 'English',
                    },
                    brazilian_portuguese: {
                      code: 'pt',
                      title: 'Portuguese',
                    },
                    british_english: {
                      code: 'en',
                      title: 'English',
                    },
                    french: {
                      code: 'fr',
                      title: 'French',
                    },
                    hindi: {
                      code: 'hi',
                      title: 'Hindi',
                    },

                    italian: {
                      code: 'it',
                      title: 'Italian',
                    },
                    japanese: {
                      code: 'ja',
                      title: 'Japanese',
                    },
                    mandarin_chinese: {
                      code: 'zh',
                      title: 'Chinese',
                    },
                    spanish: {
                      code: 'es',
                      title: 'Spanish',
                    },
                  }[language],
                ],
                name,
                provider: 'player2-speech',
              })),
            )
        },
      },
      category: 'speech',
      createProvider: async (config) => createPlayer2((config.baseUrl as string).trim(), 'airi'),
      defaultOptions: () => ({
        baseUrl: 'http://localhost:4315/v1/',
      }),
      deployment: 'cloud',
      description: 'Game-Ready AI - High-fidelity character voices with zero developer costs and revenue sharing',
      descriptionKey: 'settings.pages.providers.provider.player2-speech.description',
      icon: 'i-lobe-icons:player2',
      id: 'player2-speech',
      name: 'Player2 Speech',
      nameKey: 'settings.pages.providers.provider.player2.title',
      pricing: 'free',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: async (config) => {
          const errors = [
            !config.baseUrl && new Error('Base URL is required. Default to http://localhost:4315/v1/'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) return res

          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const response = await fetch(`${config.baseUrl as string}health`, {
              headers: {
                'player2-game-key': 'airi',
              },
              method: 'GET',
              signal: controller.signal,
            })
            clearTimeout(timeout)

            if (!response.ok) {
              const reason = `Player2 speech unreachable: HTTP ${response.status} ${response.statusText}`
              return { errors: [new Error(reason)], reason, valid: false }
            }
          } catch (err) {
            const reason = `Player2 speech connection failed: ${String(err)}`
            return { errors: [err as Error], reason, valid: false }
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'speech-noop': {
      capabilities: {
        listModels: async () => [],
        listVoices: async () => [],
      },
      category: 'speech',
      createProvider: async () => ({
        speech: () => ({
          baseURL: 'http://speech-noop.invalid/v1/',
          model: 'noop',
        }),
      }),
      defaultOptions: () => ({}),
      description: 'No speech output.',
      descriptionKey: 'settings.pages.providers.provider.speech-noop.description',
      icon: 'i-solar:volume-cross-bold-duotone',
      id: 'speech-noop',
      name: 'None',
      nameKey: 'settings.pages.providers.provider.speech-noop.title',
      tasks: ['text-to-speech', 'tts'],
      validators: {
        validateProviderConfig: () => ({
          errors: [],
          reason: '',
          valid: true,
        }),
      },
    },
    'together-ai': buildOpenAICompatibleProvider({
      creator: createTogetherAI,
      defaultBaseUrl: 'https://api.together.xyz/v1/',
      description: 'Open Model Fast Lane - Cost-effective access to fast open-source inference',
      descriptionKey: 'settings.pages.providers.provider.together.description',
      icon: 'i-lobe-icons:together',
      iconColor: 'i-lobe-icons:together',
      id: 'together-ai',
      name: 'Together.ai',
      nameKey: 'settings.pages.providers.provider.together.title',
      validation: ['health', 'model_list'],
    }),
    vllm: {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 4096,
              description: "Meta's Llama 2 7B parameter model",
              id: 'llama-2-7b',
              name: 'Llama 2 (7B)',
              provider: 'vllm',
            },
            {
              contextLength: 4096,
              description: "Meta's Llama 2 13B parameter model",
              id: 'llama-2-13b',
              name: 'Llama 2 (13B)',
              provider: 'vllm',
            },
            {
              contextLength: 4096,
              description: "Meta's Llama 2 70B parameter model",
              id: 'llama-2-70b',
              name: 'Llama 2 (70B)',
              provider: 'vllm',
            },
            {
              contextLength: 8192,
              description: "Mistral AI's 7B parameter model",
              id: 'mistral-7b',
              name: 'Mistral (7B)',
              provider: 'vllm',
            },
            {
              contextLength: 32768,
              description: "Mistral AI's Mixtral 8x7B MoE model",
              id: 'mixtral-8x7b',
              name: 'Mixtral (8x7B)',
              provider: 'vllm',
            },
            {
              contextLength: 0,
              description: 'Specify a custom model name',
              id: 'custom',
              name: 'Custom Model',
              provider: 'vllm',
            },
          ]
        },
      },
      category: 'chat',
      createProvider: async (config) => createOllama((config.baseUrl as string).trim()),
      description:
        'High-Efficiency Serving - Industry standard for high-throughput local model serving and self-hosting',
      descriptionKey: 'settings.pages.providers.provider.vllm.description',
      iconColor: 'i-lobe-icons:vllm',
      id: 'vllm',
      name: 'vLLM',
      nameKey: 'settings.pages.providers.provider.vllm.title',
      tasks: ['text-generation'],
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
            const response = await fetch(`${(config.baseUrl as string).trim()}models`, {
              headers: (config.headers as HeadersInit) || undefined,
            })
            const errors = [
              !response.ok && new Error(`vLLM returned non-ok status code: ${response.statusText}`),
            ].filter((e): e is Error => e instanceof Error)

            return {
              errors,
              reason: errors
                .filter((e): e is Error => e instanceof Error)
                .map((e) => e.message)
                .join(', '),
              valid: response.ok,
            }
          } catch (err) {
            return {
              errors: [err as Error],
              reason: `Failed to reach vLLM, error: ${String(err)} occurred.`,
              valid: false,
            }
          }
        },
      },
    },
    volcengine: {
      capabilities: {
        listModels: async () => {
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: '',
              id: 'v1',
              name: 'v1',
              provider: 'volcano-engine',
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
          const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
          const provider = createUnVolcengine(apiKey, baseUrl) as VoiceProviderWithExtraOptions<UnVolcengineOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              gender: voice.labels?.gender,
              id: voice.id,
              languages: voice.languages,
              name: voice.name,
              previewURL: voice.preview_audio_url,
              provider: 'volcano-engine',
            }
          })
        },
      },
      category: 'speech',
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnVolcengine(apiKey, baseUrl)
      },
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      deployment: 'cloud',
      description: 'Emotional Expression - Cutting-edge ByteDance speech tech for natural interactions',
      descriptionKey: 'settings.pages.providers.provider.volcengine.description',
      iconColor: 'i-lobe-icons:volcengine',
      id: 'volcengine',
      name: 'settings.pages.providers.provider.volcengine.title',
      nameKey: 'settings.pages.providers.provider.volcengine.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.baseUrl && new Error('Base URL is required.'),
            !(config.app as any)?.appId && new Error('App ID is required.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    xai: buildOpenAICompatibleProvider({
      creator: createXai,
      defaultBaseUrl: 'https://api.x.ai/v1/',
      description: 'Real-time Intelligence - High-accuracy speech recognition natively in the xAI ecosystem',
      descriptionKey: 'settings.pages.providers.provider.xai.description',
      icon: 'i-lobe-icons:xai',
      id: 'xai',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai.title',
      validation: ['health', 'model_list'],
    }),
    'xai-audio-speech': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async () => {
          // xAI uses a single TTS endpoint without specific model selection
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'xAI Grok text-to-speech model',
              id: 'grok-2-tts',
              name: 'Grok 2 TTS',
              provider: 'xai-audio-speech',
            },
          ]
        },
        // xAI provides 6 voices for TTS
        // Per https://docs.x.ai/docs/guides/voice documentation
        listVoices: async (_config: Record<string, unknown>) => {
          return [
            {
              description: 'Female voice (default)',
              gender: 'female',
              id: 'Ara',
              languages: [],
              name: 'Ara',
              provider: 'xai-audio-speech',
            },
            {
              description: 'Male voice',
              gender: 'male',
              id: 'Rex',
              languages: [],
              name: 'Rex',
              provider: 'xai-audio-speech',
            },
            {
              description: 'Voice',
              id: 'Sal',
              languages: [],
              name: 'Sal',
              provider: 'xai-audio-speech',
            },
            {
              description: 'Female voice',
              gender: 'female',
              id: 'Eve',
              languages: [],
              name: 'Eve',
              provider: 'xai-audio-speech',
            },
            {
              description: 'Female voice',
              gender: 'female',
              id: 'Una',
              languages: [],
              name: 'Una',
              provider: 'xai-audio-speech',
            },
            {
              description: 'Male voice',
              gender: 'male',
              id: 'Leo',
              languages: [],
              name: 'Leo',
              provider: 'xai-audio-speech',
            },
          ] satisfies VoiceInfo[]
        },
      },
      category: 'speech',
      creator: (apiKey, baseURL = 'https://api.x.ai/v1/') =>
        merge(createModelProvider({ apiKey, baseURL }), createSpeechProvider({ apiKey, baseURL })),
      defaultBaseUrl: 'https://api.x.ai/v1/',
      deployment: 'cloud',
      description: 'Real-time Intelligence - Native xAI speech synthesis',
      descriptionKey: 'settings.pages.providers.provider.xai-audio-speech.description',
      icon: 'i-lobe-icons:xai',
      id: 'xai-audio-speech',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai-audio-speech.title',
      pricing: 'paid',
      tasks: ['text-to-speech'],
      validation: ['health'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API Key is required'),
            !config.baseUrl && new Error('Base URL is required. Default to https://api.x.ai/v1/ for xAI API.'),
          ].filter(Boolean)

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    }),
    'xai-audio-transcription': buildOpenAICompatibleProvider({
      capabilities: {
        listModels: async () => {
          // xAI uses a single transcription endpoint
          return [
            {
              contextLength: 0,
              deprecated: false,
              description: 'xAI Grok speech-to-text model',
              id: 'grok-2-transcribe',
              name: 'Grok 2 Transcribe',
              provider: 'xai-audio-transcription',
            },
          ]
        },
      },
      category: 'transcription',
      creator: (apiKey, baseURL = 'https://api.x.ai/v1/') =>
        merge(createModelProvider({ apiKey, baseURL }), createTranscriptionProvider({ apiKey, baseURL })),
      defaultBaseUrl: 'https://api.x.ai/v1/',
      description: 'Grok Native - Real-time access to X/Twitter data',
      descriptionKey: 'settings.pages.providers.provider.xai-audio-transcription.description',
      icon: 'i-lobe-icons:xai',
      id: 'xai-audio-transcription',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai-audio-transcription.title',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      transcriptionFeatures: {
        supportsGenerate: true,
        supportsStreamInput: false,
        supportsStreamOutput: false,
      },
      validation: ['health'],
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API Key is required'),
            !config.baseUrl && new Error('Base URL is required. Default to https://api.x.ai/v1/ for xAI API.'),
          ].filter(Boolean)

          return {
            errors,
            reason: errors
              .filter((e): e is Error => e instanceof Error)
              .map((e) => e.message)
              .join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    }),
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
    const metadata = providerMetadata[providerId]
    if (!metadata) return false

    if (providerId === 'browser-web-speech-api' && !providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = getDefaultProviderConfig(providerId)
    }

    const config = providerCredentials.value[providerId]
    if (!config && providerId !== 'browser-web-speech-api') return false

    const configString = JSON.stringify(config || {})
    const runtimeState = providerRuntimeState.value[providerId]
    const cacheKey = `${providerId}:${configString}`
    const forceValidation = options.force === true

    if (
      !forceValidation &&
      runtimeState?.validatedCredentialHash === configString &&
      typeof runtimeState.isConfigured === 'boolean'
    )
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
            const safeConfig = config
              ? JSON.parse(JSON.stringify({ ...config, apiKey: config.apiKey ? '***' : undefined }))
              : undefined

            ;(window as any).electron?.ipcRenderer?.send('provider-validation-result', {
              config: safeConfig,
              providerId,
              reason: validationResult.reason,
              valid: validationResult.valid,
            })
          } catch (e) {
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
        // Auto-mark Web Speech API as added if valid and available
        if (validationResult.valid && ['browser-web-speech-api', 'player2'].includes(providerId)) {
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
      ...(Object.hasOwn(defaultOptions, 'baseUrl') ? {} : { baseUrl: '' }),
    }
  }

  // Initialize provider configurations
  function initializeProvider(providerId: string) {
    if (!providerCredentials.value[providerId]) {
      providerCredentials.value[providerId] = getDefaultProviderConfig(providerId)
    }
    if (!providerRuntimeState.value[providerId]) {
      providerRuntimeState.value[providerId] = {
        isAvailable: false,
        isConfigured: false,
        isInitialized: false,
        isLoadingModels: false,
        isValidating: false,
        modelLoadError: null,
        models: [],
      }
    }
  }

  // Object.keys(providerMetadata).forEach(initializeProvider)

  // Update configuration status for all configured providers
  const updateConfigurationStatus = debounce(async () => {
    await Promise.all(
      Object.entries(providerMetadata)
        .filter(([providerId]) => isProviderConfigured(providerId))
        .map(async ([providerId]) => {
          try {
            if (providerRuntimeState.value[providerId]) {
              const isValid = await validateProvider(providerId)
              providerRuntimeState.value[providerId].isConfigured = isValid
            }
          } catch {
            if (providerRuntimeState.value[providerId]) {
              providerRuntimeState.value[providerId].isConfigured = false
            }
          }
        }),
    )
  }, 250)

  // Call initially and watch for changes
  watch(providerCredentials, updateConfigurationStatus, { deep: true, immediate: false })

  // Initialize all providers
  Object.keys(providerMetadata).forEach(initializeProvider)

  // Initial validation run
  void updateConfigurationStatus()

  // Available providers (only those that are properly configured)
  const availableProviders = computed(() =>
    Object.keys(providerMetadata).filter((providerId) => providerRuntimeState.value[providerId]?.isConfigured),
  )

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
    if (!config) return []

    const metadata = providerMetadata[providerId]
    if (!metadata) return []

    const runtimeState = providerRuntimeState.value[providerId]
    if (runtimeState) {
      runtimeState.isLoadingModels = true
      runtimeState.modelLoadError = null
    }

    try {
      const models = metadata.capabilities.listModels ? await metadata.capabilities.listModels(config) : []

      // Transform and store the models
      if (runtimeState) {
        runtimeState.models = uniqBy(
          models.filter((model) => !!model.id),
          (m) => m.id,
        ).map((model) => ({
          ...model, // Preserve all additional fields (modalities, architecture, etc.)
          contextLength: model.contextLength || model.context_length,
          deprecated: model.deprecated,
          description: model.description,
          id: model.id,
          name: model.name || model.id,
          provider: providerId,
        }))
        return runtimeState.models
      }
      return []
    } catch (error) {
      console.error(`Error fetching models for ${providerId}:`, error)
      if (runtimeState) {
        runtimeState.modelLoadError = error instanceof Error ? error.message : 'Unknown error'
      }
      return []
    } finally {
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
  watch(
    providerCredentials,
    (newCreds) => {
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
        if (
          providerRuntimeState.value[providerId]?.isConfigured &&
          providerMetadata[providerId]?.capabilities.listModels
        ) {
          fetchModelsForProvider(providerId)
        }
      }
    },
    { deep: true, immediate: true },
  )

  // Function to get localized provider metadata
  function getProviderMetadata(providerId: string) {
    const metadata = providerMetadata[providerId]

    if (!metadata) {
      console.warn(`Provider metadata for ${providerId} not found`)
      return null as any
    }

    return {
      ...metadata,
      localizedDescription: t(metadata.descriptionKey, metadata.description),
      localizedName: t(metadata.nameKey, metadata.name),
    }
  }

  // Get all providers metadata (for settings page)
  const allProvidersMetadata = computed(() => {
    return Object.values(providerMetadata).map((metadata) => ({
      ...metadata,
      configured: providerRuntimeState.value[metadata.id]?.isConfigured || false,
      localizedDescription: t(metadata.descriptionKey, metadata.description),
      localizedName: t(metadata.nameKey, metadata.name),
    }))
  })

  function getTranscriptionFeatures(providerId: string) {
    const metadata = providerMetadata[providerId]
    const features = metadata?.transcriptionFeatures

    return {
      supportsGenerate: features?.supportsGenerate ?? true,
      supportsStreamInput: features?.supportsStreamInput ?? false,
      supportsStreamOutput: features?.supportsStreamOutput ?? false,
    }
  }

  // Function to get provider object by provider id
  async function getProviderInstance<
    R extends
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
    if (cached) return cached

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
      const instance = (await metadata.createProvider(config || {})) as R
      providerInstanceCache.value[providerId] = instance
      return instance
    } catch (error) {
      console.error(`Error creating provider instance for ${providerId}:`, error)
      throw error
    }
  }

  async function disposeProviderInstance(providerId: string) {
    const instance = providerInstanceCache.value[providerId] as { dispose?: () => Promise<void> | void } | undefined
    if (instance?.dispose) await instance.dispose()

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
    return availableProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'chat' ||
        metadata.tasks.some((task) => ['chat', 'text-generation'].includes(task.toLowerCase())),
    )
  })

  const allAudioSpeechProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'speech' ||
        metadata.tasks.some((task) => ['text-to-speech', 'speech', 'tts'].includes(task.toLowerCase())),
    )
  })

  const allAudioTranscriptionProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'transcription' ||
        metadata.tasks.some((task) =>
          ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'].includes(task.toLowerCase()),
        ),
    )
  })

  const allVisionProvidersMetadata = computed(() => {
    return availableProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'vision' ||
        metadata.tasks.some((task) => ['vision', 'image-to-text'].includes(task.toLowerCase())),
    )
  })

  const configuredChatProvidersMetadata = computed(() => {
    return allChatProvidersMetadata.value.filter(
      (metadata) => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id),
    )
  })

  const configuredSpeechProvidersMetadata = computed(() => {
    return allAudioSpeechProvidersMetadata.value.filter(
      (metadata) => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id),
    )
  })

  const configuredTranscriptionProvidersMetadata = computed(() => {
    return allAudioTranscriptionProvidersMetadata.value.filter(
      (metadata) => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id),
    )
  })

  const configuredVisionProvidersMetadata = computed(() => {
    return allVisionProvidersMetadata.value.filter(
      (metadata) => configuredProviders.value[metadata.id] || shouldListProvider(metadata.id),
    )
  })

  function isProviderConfigDirty(providerId: string) {
    const config = providerCredentials.value[providerId]
    if (!config) return false

    const defaultOptions = getDefaultProviderConfig(providerId)
    return JSON.stringify(config) !== JSON.stringify(defaultOptions)
  }

  function isProviderConfigured(providerId: string) {
    const config = providerCredentials.value[providerId]
    if (!config) return false

    const metadata = providerMetadata[providerId]
    if (!metadata) return false

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
    return availableProvidersMetadata.value.filter((metadata) => shouldListProvider(metadata.id))
  })

  const persistedChatProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'chat' ||
        metadata.tasks.some((task) => ['chat', 'text-generation'].includes(task.toLowerCase())),
    )
  })

  const persistedSpeechProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'speech' ||
        metadata.tasks.some((task) => ['text-to-speech', 'speech', 'tts'].includes(task.toLowerCase())),
    )
  })

  const persistedTranscriptionProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'transcription' ||
        metadata.tasks.some((task) =>
          ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'].includes(task.toLowerCase()),
        ),
    )
  })

  const persistedVisionProvidersMetadata = computed(() => {
    return persistedProvidersMetadata.value.filter(
      (metadata) =>
        metadata.category === 'vision' ||
        metadata.tasks.some((task) => ['vision', 'image-to-text'].includes(task.toLowerCase())),
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
    addedProviders,
    allAudioSpeechProvidersMetadata,
    allAudioTranscriptionProvidersMetadata,
    allAvailableModels,
    allChatProvidersMetadata,
    allProvidersMetadata,
    allVisionProvidersMetadata,
    availableModels,
    availableProviders,
    availableProvidersMetadata,
    configuredChatProvidersMetadata,
    configuredProviders,
    configuredSpeechProvidersMetadata,
    configuredTranscriptionProvidersMetadata,
    configuredVisionProvidersMetadata,
    deleteProvider,
    disposeProviderInstance,
    fetchModelsForProvider,
    forceProviderConfigured,
    getDefaultProviderConfig,
    getModelsForProvider,
    getProviderConfig,
    getProviderInstance,
    getProviderMetadata,
    getTranscriptionFeatures,
    initializeProvider,
    isLoadingModels,
    loadModelsForConfiguredProviders,
    markProviderAdded,
    modelLoadError,
    persistedChatProvidersMetadata,
    persistedProvidersMetadata,
    persistedSpeechProvidersMetadata,
    persistedTranscriptionProvidersMetadata,
    persistedVisionProvidersMetadata,
    providerMetadata,
    providerRuntimeState,
    providers: providerCredentials,
    resetProviderSettings,
    unmarkProviderAdded,
    validateProvider,
  }
})
