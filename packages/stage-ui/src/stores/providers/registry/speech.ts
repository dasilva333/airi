// Speech (TTS) provider metadata registry. Extracted from providers.ts during the Phase 1 provider-store registry restructure.
import type { SpeechProvider, SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'
import type { ProgressInfo } from '@xsai-transformers/shared/types'
import type {
  UnAlibabaCloudOptions,
  UnDeepgramOptions,
  UnElevenLabsOptions,
  UnMicrosoftOptions,
  UnVolcengineOptions,
  VoiceProviderWithExtraOptions,
} from 'unspeech'
import type { ComposerTranslation } from 'vue-i18n'

import type { PocketTtsVoiceEmbedding } from '../../../libs/inference/contract'
import type { ModelInfo, ProviderMetadata, SpeechCapabilitiesInfo, VoiceInfo } from '../types'

import { isUrl } from '@proj-airi/stage-shared'
import { getCachedWebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'
import { createOpenAI } from '@xsai-ext/providers/create'
import { createPlayer2 } from '@xsai-ext/providers/special/create'
import { createModelProvider, createSpeechProvider, merge } from '@xsai-ext/providers/utils'
import { listModels } from '@xsai/model'
import { AwsClient } from 'aws4fetch'
import {
  createUnAlibabaCloud,
  createUnDeepgram,
  createUnMicrosoft,
  createUnVolcengine,
  listVoices,
} from 'unspeech'

import { getKokoroAdapter } from '../../../libs/inference/adapters/kokoro'
import { getDefaultKokoroModel, KOKORO_MODELS, kokoroModelsToModelInfo } from '../../../workers/kokoro/constants'
import { models as elevenLabsModels } from '../elevenlabs/list-models'
import { createNativeElevenLabsProvider } from '../elevenlabs/native'
import { isBrowserAndMemoryEnough, logWarn, toProviderRootBaseUrl, toV1SpeechBaseUrl, validateProviderBaseUrl } from '../helpers'
import { getMossAdapterInstance, preprocessMossReferenceAudio } from '../moss-audio-utils'
import { buildOpenAICompatibleProvider } from '../openai-compatible-builder'
import { getPocketTtsAdapterInstance, preprocessPocketReferenceAudio } from '../pocket-audio-utils'

const baseUrlValidator = { value: validateProviderBaseUrl }

// NOTICE: `kokoro-local`'s listModels closure captures the vue-i18n `t` passed in here.
// Because providers.ts can only construct the registry inside the Pinia store setup
// (where useI18n() is available), `t` is bound once at store-setup time rather than
// per-call. A later phase may need to revisit this if locale switching must
// re-translate kokoro model names.
// Canonical English-bundle preset names for Pocket TTS predefined voices (translated bundles
// carry translated names — the UI surfaces those via `predefinedVoiceName` pass-through).
export const POCKET_TTS_BUILTIN_PRESET_IDS = [
  'alba',
  'azelma',
  'cosette',
  'eponine',
  'fantine',
  'javert',
  'jean',
  'marius',
] as const

export function createSpeechMetadata(t: ComposerTranslation): Record<string, ProviderMetadata> {
  return {
    'speech-noop': {
      id: 'speech-noop',
      category: 'speech',
      tasks: ['text-to-speech', 'tts'],
      nameKey: 'settings.pages.providers.provider.speech-noop.title',
      name: 'None',
      descriptionKey: 'settings.pages.providers.provider.speech-noop.description',
      description: 'No speech output.',
      icon: 'i-solar:volume-cross-bold-duotone',
      requiresCredentials: false,
      defaultOptions: () => ({}),
      createProvider: async () => ({
        speech: () => ({
          baseURL: 'http://speech-noop.invalid/v1/',
          model: 'noop',
        }),
      }),
      capabilities: {
        listModels: async () => [],
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
    'virtual-audio-studio': {
      id: 'virtual-audio-studio',
      category: 'speech',
      tasks: ['text-to-speech', 'tts'],
      nameKey: 'settings.pages.providers.provider.virtual-audio-studio.title',
      name: 'Audio Studio (Virtual)',
      descriptionKey: 'settings.pages.providers.provider.virtual-audio-studio.description',
      description: 'Custom Virtual Voice Provider wrapping real Speech Engines with premium audio effects.',
      icon: 'i-solar:music-library-bold-duotone',
      requiresCredentials: false,
      defaultOptions: () => ({}),
      createProvider: async () => ({
        speech: () => ({
          baseURL: 'http://virtual-audio-studio.invalid/v1/',
          model: 'virtual',
        }),
      }),
      capabilities: {
        listModels: async () => [
          { id: 'virtual', name: 'Virtual Engine', provider: 'virtual-audio-studio', tasks: ['text-to-speech'], deployment: 'local' },
        ],
        listVoices: async () => {
          try {
            const { useSpeechStore } = await import('../../modules/speech')
            const speechStore = useSpeechStore()
            return (speechStore.savedVoiceProfiles || [])
              .filter(p => p.id !== 'voice_profile_auto_preview')
              .map(profile => ({
                id: profile.id,
                name: profile.name,
                provider: 'virtual-audio-studio',
                languages: [{ code: 'en', title: 'English' }],
                compatibleModels: ['virtual'],
                description: `Virtual voice mapping to ${profile.baseProvider}`,
              }))
          }
          catch (e) {
            console.error('Failed to load virtual voices:', e)
            return []
          }
        },
      },
      validators: {
        validateProviderConfig: () => ({
          errors: [],
          reason: '',
          valid: true,
        }),
      },
    },
    'kokoro-local': {
      id: 'kokoro-local',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.kokoro-local.title',
      name: 'Kokoro TTS',
      descriptionKey: 'settings.pages.providers.provider.kokoro-local.description',
      description: 'Native AI - Local text-to-speech using Kokoro-82M',
      icon: 'i-lobe-icons:speaker',
      requiresCredentials: false,

      defaultOptions: () => {
        const model = getDefaultKokoroModel(getCachedWebGPUCapabilities())
        return {
          model,
          voiceId: '',
        }
      },

      createProvider: async (_config) => {
      // Import the adapter
        const adapterPromise = getKokoroAdapter()

        const provider: SpeechProvider = {
          speech: () => {
            return {
              baseURL: 'http://kokoro-local/v1/',
              model: 'kokoro-82m',
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

                  const adapter = await adapterPromise

                  // Ensure the model is loaded before generating speech
                  const modelId = _config.model as string
                  if (modelId) {
                    const modelDef = KOKORO_MODELS.find(m => m.id === modelId)
                    if (modelDef) {
                      await adapter.loadModel(modelDef.quantization, modelDef.platform)
                    }
                  }

                  // Generate audio in the worker thread
                  const buffer = await adapter.generate(text, voice)

                  return new Response(buffer, {
                    status: 200,
                    headers: {
                      'Content-Type': 'audio/wav',
                    },
                  })
                }
                catch (error) {
                  console.error('Kokoro TTS generation failed:', error)
                  throw error
                }
              },
            }
          },
        }

        return provider
      },

      capabilities: {
        listModels: async (_config: Record<string, unknown>) => {
          return kokoroModelsToModelInfo(getCachedWebGPUCapabilities(), t)
        },

        loadModel: async (config: Record<string, unknown>, _hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void }) => {
          const modelId = config.model as string

          if (!modelId) {
            throw new Error('No model specified')
          }

          const modelDef = KOKORO_MODELS.find(m => m.id === modelId)
          if (!modelDef) {
            throw new Error(`Invalid model: ${modelId}. Must be one of: ${KOKORO_MODELS.map(m => m.id).join(', ')}`)
          }

          // Validate platform requirements
          if (modelDef.platform === 'webgpu') {
            const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
            if (!hasWebGPU) {
              throw new Error('WebGPU is required for this model but is not available in your browser')
            }
          }

          try {
            const adapter = await getKokoroAdapter()
            const onProgress = _hooks?.onProgress
              ? (p: any) => {
                  _hooks.onProgress!({
                    status: 'progress',
                    file: p.file || '',
                    name: p.file || '',
                    progress: p.percent,
                    loaded: p.loaded ?? 0,
                    total: p.total ?? 0,
                  })
                }
              : undefined
            await adapter.loadModel(modelDef.quantization, modelDef.platform, { onProgress })
          }
          catch (error) {
            console.error('Failed to load Kokoro model:', error)
            throw error
          }
        },

        listVoices: async (config: Record<string, unknown>) => {
          try {
          // Reload the model before fetching voices
            const modelId = config.model as string
            if (modelId) {
              const modelDef = KOKORO_MODELS.find(m => m.id === modelId)
              if (modelDef) {
              // Validate platform requirements
                if (modelDef.platform === 'webgpu') {
                  const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
                  if (!hasWebGPU) {
                    throw new Error('WebGPU is required for this model but is not available in your browser')
                  }
                }

                // Load the model
                const adapter = await getKokoroAdapter()
                await adapter.loadModel(modelDef.quantization, modelDef.platform)
              }
            }

            // Get adapter and fetch voices from the model
            const adapter = await getKokoroAdapter()
            const modelVoices = adapter.getVoices()

            // Language code mapping
            const languageMap: Record<string, { code: string, title: string }> = {
              'en-us': { code: 'en-US', title: 'English (US)' },
              'en-gb': { code: 'en-GB', title: 'English (UK)' },
              'ja': { code: 'ja', title: 'Japanese' },
              'zh-cn': { code: 'zh-CN', title: 'Chinese (Mandarin)' },
              'es': { code: 'es', title: 'Spanish' },
              'fr': { code: 'fr', title: 'French' },
              'hi': { code: 'hi', title: 'Hindi' },
              'it': { code: 'it', title: 'Italian' },
              'pt-br': { code: 'pt-BR', title: 'Portuguese (Brazil)' },
            }

            // Transform the voices object to the expected array format
            return Object.entries(modelVoices).map(([id, voice]: [string, { language: string, name: string, gender: string }]) => {
              const languageCode = voice.language.toLowerCase()
              const languageInfo = languageMap[languageCode] || { code: languageCode, title: voice.language }

              return {
                id,
                name: `${voice.name} (${voice.gender}, ${languageInfo.title.split('(')[0].trim()})`,
                provider: 'kokoro-local',
                languages: [languageInfo],
                gender: voice.gender.toLowerCase(),
              }
            })
          }
          catch (error) {
            console.error('Failed to fetch Kokoro voices:', error)
            // Return empty array if model not loaded yet
            return []
          }
        },
      },

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

          if (!KOKORO_MODELS.some(m => m.id === model)) {
            return {
              errors: [new Error(`Invalid model: ${model}`)],
              reason: `Invalid model. Must be one of: ${KOKORO_MODELS.map(m => m.id).join(', ')}`,
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
    'moss-nano-local': {
      id: 'moss-nano-local',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.moss-nano-local.title',
      name: 'Moss TTS (Nano)',
      descriptionKey: 'settings.pages.providers.provider.moss-nano-local.description',
      description: 'Native AI - Local text-to-speech with voice cloning (0.1B Nano)',
      icon: 'i-solar:speaker-bold-duotone',
      requiresCredentials: false,
      defaultOptions: () => ({
        model: 'moss-tts-nano-100m',
        voiceId: '',
        cpuThreads: 4,
        attentionBackend: 'sdpa',
        samplingMode: 'fixed',
        voiceCloneMaxTokens: 75,
      }),
      createProvider: async (_config) => {
        const adapter = await getMossAdapterInstance()

        const provider: SpeechProvider = {
          speech: () => {
            return {
              baseURL: 'http://moss-nano-local/v1/',
              model: 'moss-tts-nano-100m',
              fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
                try {
                  if (!init?.body || typeof init.body !== 'string') {
                    throw new Error('Invalid request body')
                  }
                  const body = JSON.parse(init.body)
                  const text = body.input
                  const voiceId = body.voice

                  if (!voiceId) {
                    throw new Error('Voice parameter is required')
                  }

                  // Load model on demand if not ready
                  if (adapter.state !== 'ready') {
                    await adapter.loadModel()
                  }

                  // Fetch custom voice from IndexedDB if needed
                  // Phase B: prefer cached prompt_audio_codes; else decode/condition
                  // on the main thread (AudioContext is main-thread only) then send a
                  // channel-planar waveform the worker feeds directly to the codec.
                  let promptAudioWaveform: Float32Array | undefined
                  let promptAudioChannels: number | undefined
                  let promptAudioCodes: number[][] | undefined
                  const builtinIds = ['Trump', 'LJS']
                  if (!builtinIds.includes(voiceId)) {
                    const localforage = (await import('localforage')).default
                    const mossVoiceProfileBlobsStore = localforage.createInstance({
                      name: 'voice-profile-blobs',
                    })
                    const mossVoiceProfilesStore = localforage.createInstance({
                      name: 'moss-voice-profiles-metadata',
                    })
                    const metadata = await mossVoiceProfilesStore.getItem<any>(voiceId)
                    promptAudioCodes = metadata?.promptAudioCodes
                    console.log('[MOSS Provider] voiceId:', voiceId, 'cached codes:', !!promptAudioCodes)
                    if (!promptAudioCodes) {
                      const audioBlob = await mossVoiceProfileBlobsStore.getItem<Blob>(voiceId)
                      console.log('[MOSS Provider] voiceId:', voiceId, 'found blob:', !!audioBlob)
                      if (audioBlob) {
                        const buffer = await audioBlob.arrayBuffer()
                        const codec = adapter.codecConfig ?? { sample_rate: 16000, channels: 1 }
                        promptAudioChannels = codec.channels
                        promptAudioWaveform = await preprocessMossReferenceAudio(
                          buffer,
                          codec.sample_rate,
                          codec.channels,
                        )
                        console.log('[MOSS Provider] conditioned planar length:', promptAudioWaveform.length, 'channels:', promptAudioChannels)
                      }
                    }
                  }

                  const options = {
                    cpuThreads: Number(_config.cpuThreads ?? 4),
                    attentionBackend: String(_config.attentionBackend ?? 'sdpa'),
                    samplingMode: String(_config.samplingMode ?? 'fixed'),
                    voiceCloneMaxTokens: Number(_config.voiceCloneMaxTokens ?? 75),
                    promptAudioWaveform,
                    promptAudioChannels,
                    promptAudioCodes,
                  }

                  const wavBuffer = await adapter.generate(text, voiceId, options)

                  return new Response(wavBuffer, {
                    status: 200,
                    headers: {
                      'Content-Type': 'audio/wav',
                    },
                  })
                }
                catch (error) {
                  console.error('MOSS TTS generation failed:', error)
                  throw error
                }
              },
            }
          },
        }
        return provider
      },
      capabilities: {
        listModels: async (_config: Record<string, unknown>) => {
          return [
            {
              id: 'moss-tts-nano-100m',
              name: 'MOSS TTS Nano (100M)',
              provider: 'moss-nano-local',
              contextLength: 4096,
            },
          ]
        },
        loadModel: async (_config: Record<string, unknown>, _hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void }) => {
          const adapter = await getMossAdapterInstance()
          await adapter.loadModel({
            onProgress: (p: any) => {
              if (_hooks?.onProgress) {
                _hooks.onProgress({
                  status: 'progress',
                  file: p.file || 'moss_tts_prefill.onnx',
                  name: p.name || 'moss_tts_prefill.onnx',
                  progress: p.percent ?? 0,
                  loaded: p.loaded ?? 0,
                  total: p.total ?? 0,
                })
              }
            },
          })
        },
        listVoices: async (_config: Record<string, unknown>) => {
          const builtin = [
            {
              id: 'Trump',
              name: 'EN Trump',
              provider: 'moss-nano-local',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              gender: 'male',
            },
            {
              id: 'LJS',
              name: 'EN LJS',
              provider: 'moss-nano-local',
              languages: [{ code: 'en-US', title: 'English (US)' }],
              gender: 'female',
            },
          ]
          try {
            const localforage = (await import('localforage')).default
            const mossVoiceProfilesStore = localforage.createInstance({
              name: 'moss-voice-profiles-metadata',
            })
            const customProfiles: any[] = []
            await mossVoiceProfilesStore.iterate((val: any) => {
              customProfiles.push({
                id: val.id,
                name: val.name,
                provider: 'moss-nano-local',
                languages: [{ code: 'en-US', title: 'English (US)' }],
                gender: 'unknown',
              })
            })
            return [...builtin, ...customProfiles]
          }
          catch (e) {
            console.error('Failed to load custom voice profiles from IndexedDB:', e)
            return builtin
          }
        },
      },
      validators: {
        validateProviderConfig: async (_config: any) => {
          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    },
    'pocket-tts-local': {
      id: 'pocket-tts-local',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.pocket-tts-local.title',
      name: 'Pocket TTS (Kyutai Local)',
      descriptionKey: 'settings.pages.providers.provider.pocket-tts-local.description',
      description: 'Native AI - Low-latency CPU text-to-speech & voice cloning (0.1B Multilingual)',
      icon: 'i-solar:speaker-minimalistic-bold-duotone',
      requiresCredentials: false,
      defaultOptions: () => ({
        model: 'english_2026-04',
        language: 'english',
        voiceId: '',
        cpuThreads: 4,
      }),
      createProvider: async (_config) => {
        const adapter = await getPocketTtsAdapterInstance()

        const provider: SpeechProvider = {
          speech: () => {
            return {
              baseURL: 'http://pocket-tts-local/v1/',
              model: 'english_2026-04',
              fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
                try {
                  if (!init?.body || typeof init.body !== 'string') {
                    throw new Error('Invalid request body')
                  }
                  const body = JSON.parse(init.body)
                  const text = body.input || ''
                  const voiceId = body.voice || ''
                  console.info('[PocketTTS Provider] Received HTTP speech request:', { textLength: text.length, voiceId, bodyLanguage: body.language })
                  let promptAudioWaveform: Float32Array | undefined
                  const promptAudioChannels = 1
                  let promptVoiceEmbedding: PocketTtsVoiceEmbedding | undefined
                  let predefinedVoiceName: string | undefined

                  if (voiceId) {
                    // Built-in preset → predefined safetensors path (no localforage lookup)
                    if ((POCKET_TTS_BUILTIN_PRESET_IDS as readonly string[]).includes(voiceId)) {
                      predefinedVoiceName = voiceId
                    }
                    else {
                      try {
                        const { default: localforage } = await import('localforage')
                        const metaStore = localforage.createInstance({ name: 'pocket-voice-profiles-metadata' })
                        const blobStore = localforage.createInstance({ name: 'pocket-voice-profiles-blobs' })

                        const profileMeta = await metaStore.getItem<any>(voiceId)
                        if (profileMeta?.promptVoiceEmbedding) {
                          console.info('[PocketTTS Provider] Found cached promptVoiceEmbedding for voiceId:', voiceId)
                          promptVoiceEmbedding = profileMeta.promptVoiceEmbedding
                        }
                        else {
                          const blob = await blobStore.getItem<Blob>(voiceId)
                          if (blob) {
                            console.info('[PocketTTS Provider] Preprocessing reference audio WAV blob for voiceId:', voiceId)
                            const arrayBuf = await blob.arrayBuffer()
                            promptAudioWaveform = await preprocessPocketReferenceAudio(arrayBuf, 24000, 1)
                          }
                        }
                      }
                      catch (err) {
                        console.warn('[PocketTTS Provider] Error retrieving voice profile:', err)
                      }
                    }
                  }

                  console.info('[PocketTTS Provider] Calling adapter.generate()...')
                  const wavBuffer = await adapter.generate(
                    text,
                    voiceId || 'default',
                    {
                      language: body.language || 'english_2026-04',
                      cpuThreads: 4,
                      promptAudioWaveform,
                      promptAudioChannels,
                      promptVoiceEmbedding,
                      predefinedVoiceName,
                    },
                  )

                  console.info('[PocketTTS Provider] Returning HTTP 200 Response with WAV buffer size:', wavBuffer.byteLength)
                  return new Response(wavBuffer, {
                    status: 200,
                    headers: {
                      'Content-Type': 'audio/wav',
                    },
                  })
                }
                catch (error) {
                  console.error('[PocketTTS Provider] Pocket TTS generation failed:', error)
                  throw error
                }
              },
            }
          },
        }
        return provider
      },
      capabilities: {
        listModels: async (_config: Record<string, unknown>) => {
          return [
            {
              id: 'english_2026-04',
              name: 'Pocket TTS English (100M)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
            {
              id: 'french_24l',
              name: 'Pocket TTS French (24L)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
            {
              id: 'spanish_24l',
              name: 'Pocket TTS Spanish (24L)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
            {
              id: 'german_24l',
              name: 'Pocket TTS German (24L)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
            {
              id: 'portuguese_24l',
              name: 'Pocket TTS Portuguese (24L)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
            {
              id: 'italian_24l',
              name: 'Pocket TTS Italian (24L)',
              provider: 'pocket-tts-local',
              contextLength: 4096,
            },
          ]
        },
        loadModel: async (_config: Record<string, unknown>, hooks?: { onProgress?: (progress: ProgressInfo) => Promise<void> | void }) => {
          const adapter = await getPocketTtsAdapterInstance()
          await adapter.loadModel({
            language: (_config.language as string) || 'english',
            onProgress: (p: any) => {
              if (hooks?.onProgress) {
                hooks.onProgress({
                  status: 'progress',
                  file: p.file || 'pocket_tts.onnx',
                  name: p.file || 'pocket_tts.onnx',
                  progress: p.percent ?? 0,
                  loaded: p.loaded ?? 0,
                  total: p.total ?? 0,
                })
              }
            },
          })
        },
        listVoices: async (_config: Record<string, unknown>) => {
          const builtin = [
            { id: 'alba', name: 'Alba (EN Casual)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'azelma', name: 'Azelma (EN Female)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'cosette', name: 'Cosette (EN Female)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'eponine', name: 'Eponine (EN Female)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'fantine', name: 'Fantine (EN Female)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'javert', name: 'Javert (EN Male)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'jean', name: 'Jean (EN Male)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
            { id: 'marius', name: 'Marius (EN Male)', provider: 'pocket-tts-local', languages: [{ code: 'en-US', title: 'English' }] },
          ]
          try {
            const { default: localforage } = await import('localforage')
            const metaStore = localforage.createInstance({ name: 'pocket-voice-profiles-metadata' })
            const customVoices: VoiceInfo[] = []
            await metaStore.iterate((val: any) => {
              if (val && val.id && val.name) {
                customVoices.push({
                  id: val.id,
                  name: val.name,
                  provider: 'pocket-tts-local',
                  languages: [{ code: 'en-US', title: 'English' }],
                })
              }
            })
            return [...builtin, ...customVoices]
          }
          catch {
            return builtin
          }
        },
      },
      validators: {
        validateProviderConfig: async (_config: any) => {
          return {
            errors: [],
            reason: '',
            valid: true,
          }
        },
      },
    },
    'browser-local-audio-speech': buildOpenAICompatibleProvider({
      id: 'browser-local-audio-speech',
      name: 'Browser (Local)',
      nameKey: 'settings.pages.providers.provider.browser-local-audio-speech.title',
      descriptionKey: 'settings.pages.providers.provider.browser-local-audio-speech.description',
      icon: 'i-lobe-icons:huggingface',
      description: 'Private Voice Engine - In-browser speech synthesis via Web Speech API or local engine',
      category: 'speech',
      tasks: ['text-to-speech', 'tts'],
      isAvailableBy: isBrowserAndMemoryEnough,
      creator: createOpenAI,
      validation: [],
      validators: {
        validateProviderConfig: (config) => {
          if (!config.baseUrl) {
            return {
              errors: [new Error('Base URL is required.')],
              reason: 'Base URL is required. This is likely a bug, report to developers on https://github.com/moeru-ai/airi/issues.',
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
    'openai-audio-speech': buildOpenAICompatibleProvider({
      id: 'openai-audio-speech',
      name: 'OpenAI',
      nameKey: 'settings.pages.providers.provider.openai.title',
      descriptionKey: 'settings.pages.providers.provider.openai-audio-speech.description',
      icon: 'i-lobe-icons:openai',
      description: 'Industry Standard - Reliable flagship TTS voices from OpenAI',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      consoleUrl: 'https://platform.openai.com/api-keys',
      tasks: ['text-to-speech'],
      defaultBaseUrl: 'https://api.openai.com/v1/',
      creator: createOpenAI,
      validation: ['health'],
      capabilities: {
        supportsSSML: false,
        supportsPitch: false,
        // NOTE: OpenAI does not provide an API endpoint to retrieve available voices.
        // Voices are hardcoded here - this is a provider limitation, not an application limitation.
        // Voice compatibility per https://platform.openai.com/docs/api-reference/audio/createSpeech:
        // - tts-1 and tts-1-hd support: alloy, ash, coral, echo, fable, onyx, nova, sage, shimmer (9 voices)
        // - gpt-4o-mini-tts supports all 13 voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
        listVoices: async (_config: Record<string, unknown>) => {
          return [
            {
              id: 'alloy',
              name: 'Alloy',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'ash',
              name: 'Ash',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'ballad',
              name: 'Ballad',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'coral',
              name: 'Coral',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'echo',
              name: 'Echo',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'fable',
              name: 'Fable',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'onyx',
              name: 'Onyx',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'nova',
              name: 'Nova',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'sage',
              name: 'Sage',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'shimmer',
              name: 'Shimmer',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'verse',
              name: 'Verse',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'marin',
              name: 'Marin',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
            {
              id: 'cedar',
              name: 'Cedar',
              provider: 'openai-audio-speech',
              languages: [],
              compatibleModels: ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15'],
            },
          ] satisfies VoiceInfo[]
        },
        listModels: async () => {
        // TESTING NOTES: All 4 models tested and confirmed working with fable voice:
        // - tts-1: {model: "tts-1", input: "test", voice: "fable"} ✓
        // - tts-1-hd: {model: "tts-1-hd", input: "test", voice: "fable"} ✓
        // - gpt-4o-mini-tts: {model: "gpt-4o-mini-tts", input: "test", voice: "fable"} ✓
        // - gpt-4o-mini-tts-2025-12-15: {model: "gpt-4o-mini-tts-2025-12-15", input: "test", voice: "fable"} ✓
          return [
            {
              id: 'tts-1',
              name: 'TTS-1',
              provider: 'openai-audio-speech',
              description: 'Optimized for real-time text-to-speech tasks',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'tts-1-hd',
              name: 'TTS-1-HD',
              provider: 'openai-audio-speech',
              description: 'Higher fidelity audio output',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'gpt-4o-mini-tts',
              name: 'GPT-4o Mini TTS',
              provider: 'openai-audio-speech',
              description: 'GPT-4o Mini optimized for text-to-speech',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'gpt-4o-mini-tts-2025-12-15',
              name: 'GPT-4o Mini TTS (2025-12-15)',
              provider: 'openai-audio-speech',
              description: 'GPT-4o Mini TTS snapshot from 2025-12-15',
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
            !config.baseUrl && new Error('Base URL is required. Default to https://api.openai.com/v1/ for official OpenAI API.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
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
    'openai-compatible-audio-speech': buildOpenAICompatibleProvider({
      id: 'openai-compatible-audio-speech',
      name: 'OpenAI Compatible',
      nameKey: 'settings.pages.providers.provider.openai-compatible.title',
      descriptionKey: 'settings.pages.providers.provider.openai-compatible-audio-speech.description',
      icon: 'i-lobe-icons:openai',
      description: 'Bring Your Own Endpoint - Connect any OpenAI-style TTS API or self-hosted gateway',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      // Override builder defaultOptions to include voicesPath for user-configurable path override
      defaultOptions: () => ({
        baseUrl: '',
        voicesPath: '',
      }),
      capabilities: {
        supportsSSML: false,
        supportsPitch: false,
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''
          // User-pinned voices endpoint path — skips waterfall probing when set
          const voicesPath = typeof config.voicesPath === 'string' ? config.voicesPath.trim() : ''

          if (!baseUrl)
            return []

          if (!baseUrl.endsWith('/'))
            baseUrl += '/'

          /**
           * Normalize a raw voices payload into VoiceInfo[]-compatible objects.
           *
           * NOTICE: There is no canonical spec for a /voices endpoint in the OpenAI TTS
           * API (OpenAI itself uses a static list). Third-party self-hosted servers invented
           * this endpoint independently and use incompatible shapes:
           *   - Object array: [{ id, name, voice_id, ... }]  (unspeech, ElevenLabs-compat)
           *   - String array: ["Abigail.wav", "Adrian.wav"]  (devnen/Chatterbox-TTS-Server)
           * We handle both shapes here with a clean conscience since no spec exists.
           */
          const normalizeVoices = (voices: unknown[]) =>
            voices.map((v: any) =>
              typeof v === 'string'
                ? {
                  // Strip common audio file extensions for a cleaner display name
                    id: v,
                    name: v.replace(/\.(wav|mp3|ogg|flac|m4a)$/i, ''),
                    provider: 'openai-compatible-audio-speech',
                    previewURL: undefined,
                    languages: [],
                    gender: undefined,
                  }
                : {
                    id: v.id || v.voice_id || v.name,
                    name: v.name || v.id,
                    provider: 'openai-compatible-audio-speech',
                    previewURL: v.preview_url || v.preview_audio_url,
                    languages: v.languages || [],
                    gender: v.gender || v.labels?.gender,
                  },
            )

          const tryFetchVoices = async (url: string) => {
            try {
              const response = await fetch(url, {
                headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
              })
              if (response.ok) {
                const data = await response.json()
                // Standard openai-like / unspeech voices response shapes
                const voices = data.voices || data.data || (Array.isArray(data) ? data : null)
                if (Array.isArray(voices) && voices.length > 0)
                  return normalizeVoices(voices)
              }
            }
            catch (e) {
              logWarn(`Failed to fetch voices from ${url}:`, e)
            }
            return null
          }

          // If the user has pinned a specific path, use it directly — no probing
          if (voicesPath) {
            const pinnedPath = voicesPath.startsWith('/') ? voicesPath.slice(1) : voicesPath
            return await tryFetchVoices(`${baseUrl}${pinnedPath}`) || []
          }

          // NOTICE: No canonical spec exists for a /voices endpoint in OpenAI-compatible TTS
          // servers. We probe multiple common paths in order and use the first successful one.
          // Probe order rationale:
          //   1. audio/voices — mirrors the /audio/speech sibling naming used by some servers
          //      (e.g. devnen/Chatterbox-TTS-Server at GET /v1/audio/voices)
          //   2. voices       — most common convention in unspeech and similar wrappers
          //   3. root /voices — fallback for servers that don't use a /v1/ prefix
          const rootUrl = baseUrl.replace(/v1\/$/, '')
          const voices
            = await tryFetchVoices(`${baseUrl}audio/voices`)
              || await tryFetchVoices(`${baseUrl}voices`)
              || await tryFetchVoices(`${rootUrl}voices`)

          return voices || []
        },
        listModels: async (config: Record<string, unknown>) => {
        // Filter models to only include TTS models
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          let baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : ''

          if (!baseUrl.endsWith('/'))
            baseUrl += '/'

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
              return modelId.includes('tts') || modelId.includes('speech') || modelId.includes('audio') || modelId.includes('kokoro')
            })
            .map((model: any) => {
              return {
                id: model.id,
                name: model.name || model.display_name || model.id,
                provider: 'openai-compatible-audio-speech',
                description: model.description || '',
                contextLength: model.context_length || 0,
                deprecated: false,
              } satisfies ModelInfo
            })
        },
      },
      creator: createOpenAI,
    }),
    'chatterbox': buildOpenAICompatibleProvider({
      id: 'chatterbox',
      name: 'Chatterbox',
      nameKey: 'settings.pages.providers.provider.chatterbox.title',
      descriptionKey: 'settings.pages.providers.provider.chatterbox.description',
      icon: 'i-solar:microphone-3-bold-duotone',
      description: 'Advanced Voice Engine - Supports tags, profiles, presets, and high-performance playback',
      category: 'speech',
      pricing: 'free',
      deployment: 'local',
      beginnerRecommended: true,
      tasks: ['text-to-speech'],
      defaultBaseUrl: 'http://127.0.0.1:8090/v1/',
      capabilities: {
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const apiBaseUrl = toV1SpeechBaseUrl(config.baseUrl)
          if (!apiBaseUrl)
            return []

          try {
            const response = await fetch(`${apiBaseUrl}voices`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok)
              return []

            const data = await response.json()
            const voices = Array.isArray(data?.voices) ? data.voices : []
            return voices.map((voice: any) => ({
              id: voice.voice_id || voice.id || voice.name,
              name: voice.name || voice.voice_id || voice.id,
              provider: 'chatterbox',
              description: voice.type === 'virtual' ? 'Preset voice' : 'Native voice',
              previewURL: voice.preview_url || voice.preview_audio_url,
              languages: [{ code: 'en', title: 'English' }],
              gender: voice.gender || voice.labels?.gender,
            }) satisfies VoiceInfo)
          }
          catch (error) {
            logWarn('Failed to fetch Chatterbox voices:', error)
            return []
          }
        },
        listModels: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const apiBaseUrl = toV1SpeechBaseUrl(config.baseUrl)
          if (!apiBaseUrl) {
            return [{
              id: 'chatterbox',
              name: 'Chatterbox',
              provider: 'chatterbox',
              description: 'Chatterbox speech generation',
              contextLength: 0,
              deprecated: false,
            }]
          }

          try {
            const response = await fetch(`${apiBaseUrl}models`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok)
              throw new Error(`HTTP ${response.status}`)

            const data = await response.json()
            const models = Array.isArray(data?.data) ? data.data : []
            if (models.length > 0) {
              return models.map((model: any) => ({
                id: model.id,
                name: model.name || model.display_name || model.id,
                provider: 'chatterbox',
                description: model.description || 'Chatterbox speech generation',
                contextLength: model.context_length || 0,
                deprecated: false,
              }) satisfies ModelInfo)
            }
          }
          catch (error) {
            logWarn('Failed to fetch Chatterbox models:', error)
          }

          return [{
            id: 'chatterbox',
            name: 'Chatterbox',
            provider: 'chatterbox',
            description: 'Chatterbox speech generation',
            contextLength: 0,
            deprecated: false,
          }]
        },
        getSpeechCapabilities: async (config: Record<string, unknown>) => {
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const rootBaseUrl = toProviderRootBaseUrl(config.baseUrl)
          if (!rootBaseUrl)
            return null

          try {
            const response = await fetch(`${rootBaseUrl}chatterbox/capabilities`, {
              headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
            })
            if (!response.ok)
              return null

            const data = await response.json()
            const speech = data?.speech
            if (!speech)
              return null

            return {
              supportsPresets: speech.supportsPresets ?? true,
              supportsExpressionTags: speech.supportsExpressionTags ?? false,
              supportsMannerisms: speech.supportsMannerisms ?? false,
              expressionTags: Array.isArray(speech.expressionTags) ? speech.expressionTags : [],
              mannerisms: Array.isArray(speech.mannerisms) ? speech.mannerisms : [],
            } satisfies SpeechCapabilitiesInfo
          }
          catch (error) {
            logWarn('Failed to fetch Chatterbox speech capabilities:', error)
            return null
          }
        },
      },
      validators: {
        validateProviderConfig: async (config: Record<string, unknown>) => {
          const errors: Error[] = []
          const baseUrl = toV1SpeechBaseUrl(config.baseUrl)
          const rootBaseUrl = toProviderRootBaseUrl(config.baseUrl)
          const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''

          if (!baseUrl) {
            errors.push(new Error('Base URL is required'))
          }
          else if (!isUrl(baseUrl)) {
            errors.push(new Error('Base URL is invalid. It must be an absolute URL.'))
          }

          if (errors.length > 0) {
            return {
              errors,
              reason: errors.map(error => error.message).join(', '),
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
          }
          catch (error) {
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
      creator: createOpenAI,
    }),
    'aws-polly-tts': {
      id: 'aws-polly-tts',
      name: 'Amazon AWS Polly',
      nameKey: 'settings.pages.providers.provider.aws-polly-tts.title',
      descriptionKey: 'settings.pages.providers.provider.aws-polly-tts.description',
      icon: 'i-logos:aws',
      description: 'AWS Ecosystem - Native High-Quality Neural Voices from Amazon Polly',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech', 'tts'],
      defaultOptions: () => ({
        model: 'neural',
        region: 'us-east-1',
        voice: 'Ivy',
      }),
      createProvider: async (config) => {
        const accessKeyId = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
        const secretAccessKey = typeof config.secretAccessKey === 'string' ? config.secretAccessKey.trim() : ''
        const region = typeof config.region === 'string' ? config.region.trim() : 'us-east-1'

        if (!accessKeyId || !secretAccessKey) {
          throw new Error('AWS credentials (Access Key ID and Secret Access Key) are required.')
        }

        const client = new AwsClient({
          accessKeyId,
          secretAccessKey,
          region,
          service: 'polly',
        })

        return {
          speech: (model: string, _extraOptions?: any) => {
            return {
            // We'll ignore the automatic URL construction of generateSpeech
              baseURL: `https://polly.${region}.amazonaws.com/v1/`,
              model,
              headers: {},
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
                }
                catch (e) {
                  logWarn('Failed to parse speech body for transformation:', e)
                  pollyBody = options?.body as string
                }

                const signed = await client.sign(pollyUrl, {
                  ...options,
                  method: 'POST',
                  body: pollyBody,
                })
                return fetch(signed)
              },
            }
          },
        } as SpeechProviderWithExtraOptions<string, any>
      },
      capabilities: {
        supportsSSML: true,
        supportsPitch: false,
        listModels: async () => {
          return [
            { id: 'neural', name: 'Neural', provider: 'aws-polly-tts', tasks: ['text-to-speech', 'tts'], deployment: 'cloud' },
            { id: 'generative', name: 'Generative', provider: 'aws-polly-tts', tasks: ['text-to-speech', 'tts'], deployment: 'cloud' },
            { id: 'long-form', name: 'Long-form', provider: 'aws-polly-tts', tasks: ['text-to-speech', 'tts'], deployment: 'cloud' },
            { id: 'standard', name: 'Standard', provider: 'aws-polly-tts', tasks: ['text-to-speech', 'tts'], deployment: 'cloud' },
          ] satisfies ModelInfo[]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const accessKeyId = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
          const secretAccessKey = typeof config.secretAccessKey === 'string' ? config.secretAccessKey.trim() : ''
          const region = typeof config.region === 'string' ? config.region.trim() : 'us-east-1'
          const engine = typeof config.model === 'string' ? config.model : 'neural'

          const fallbackVoices: VoiceInfo[] = [
            { id: 'Ivy', name: 'Ivy', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'female', compatibleModels: ['neural', 'standard'] },
            { id: 'Joanna', name: 'Joanna', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'female', compatibleModels: ['neural', 'standard'] },
            { id: 'Kendra', name: 'Kendra', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'female', compatibleModels: ['neural', 'standard'] },
            { id: 'Kimberly', name: 'Kimberly', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'female', compatibleModels: ['neural', 'standard'] },
            { id: 'Matthew', name: 'Matthew', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'male', compatibleModels: ['neural', 'standard'] },
            { id: 'Joey', name: 'Joey', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'male', compatibleModels: ['neural', 'standard'] },
            { id: 'Justin', name: 'Justin', provider: 'aws-polly-tts', languages: [{ code: 'en-US', title: 'English (US)' }], gender: 'male', compatibleModels: ['neural', 'standard'] },
          ].filter(v => v.compatibleModels!.includes(engine))

          if (!accessKeyId || !secretAccessKey)
            return fallbackVoices

          try {
            const client = new AwsClient({
              accessKeyId,
              secretAccessKey,
              region,
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

            if (voices.length === 0)
              return fallbackVoices

            return voices.map((v: any) => ({
              id: v.Id,
              name: v.Name,
              provider: 'aws-polly-tts',
              languages: (Array.isArray(v.LanguageCode) ? v.LanguageCode : [v.LanguageCode]).map((code: string) => ({
                code,
                title: v.LanguageName || code,
              })),
              gender: v.Gender?.toLowerCase(),
              compatibleModels: v.SupportedEngines || [],
            })) satisfies VoiceInfo[]
          }
          catch (error) {
            logWarn('Error fetching AWS Polly voices:', error)
            return fallbackVoices
          }
        },
      },
      validators: {
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          if (!config.apiKey)
            errors.push(new Error('AWS Access Key ID is required.'))
          if (!config.secretAccessKey)
            errors.push(new Error('AWS Secret Access Key is required.'))

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'elevenlabs': {
      id: 'elevenlabs',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.elevenlabs.title',
      name: 'ElevenLabs',
      descriptionKey: 'settings.pages.providers.provider.elevenlabs.description',
      description: 'Industry-Leading Realism - Unparalleled expressive neural voices (Premium Pricing)',
      icon: 'i-simple-icons:elevenlabs',
      defaultOptions: () => ({
        baseUrl: 'https://api.elevenlabs.io/v1/',
        voiceSettings: {
          similarityBoost: 0.75,
          stability: 0.5,
        },
      }),
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string).trim()
        const baseUrl = (config.baseUrl as string).trim().replace(/\/$/, '')
        const voiceSettings = (config as any).voiceSettings ?? { similarityBoost: 0.75, stability: 0.5 }

        // We bypass the unspeech proxy and call ElevenLabs' native API directly across
        // all platforms. Previously this was Desktop-only due to CORS issues, but
        // ElevenLabs now returns 'Access-Control-Allow-Origin: *'. This avoids the
        // HTTP 401 errors caused by many users sharing the public unspeech proxy IP.
        return createNativeElevenLabsProvider(apiKey, baseUrl, voiceSettings) as SpeechProviderWithExtraOptions<string, UnElevenLabsOptions>
      },
      capabilities: {
        supportsSSML: true,
        supportsPitch: true,
        listModels: async () => {
          return elevenLabsModels.map((model) => {
            return {
              id: model.model_id,
              name: model.name,
              provider: 'elevenlabs',
              description: model.description,
              contextLength: 0,
              deprecated: false,
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
          if (!res.ok)
            throw new Error(`ElevenLabs voices: ${res.status} ${res.statusText}`)

          const { voices: raw } = await res.json() as { voices: { voice_id: string, name: string, preview_url?: string, labels?: Record<string, string>, fine_tuning?: { language?: string } }[] }
          const voices = (raw ?? []).map(v => ({
            id: v.voice_id,
            name: v.name,
            provider: 'elevenlabs' as const,
            previewURL: v.preview_url,
            languages: v.fine_tuning?.language ? [{ code: v.fine_tuning.language, title: v.fine_tuning.language }] : [],
            gender: v.labels?.gender,
          }))

          if (!voices || !Array.isArray(voices)) {
            return []
          }

          // Rearrange — move Aria & Bill range to the end
          const lo = Math.min(...['Aria', 'Bill'].map((n) => {
            const i = voices.findIndex(v => v.name.includes(n))
            return i !== -1 ? i : voices.length - 1
          }))
          const hi = Math.max(...['Aria', 'Bill'].map((n) => {
            const i = voices.findIndex(v => v.name.includes(n))
            return i !== -1 ? i : 0
          }))
          return [...voices.slice(0, lo), ...voices.slice(hi + 1), ...voices.slice(lo, hi + 1)]
        },
      },
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
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'deepgram-tts': {
      id: 'deepgram-tts',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.deepgram-tts.title',
      name: 'Deepgram',
      descriptionKey: 'settings.pages.providers.provider.deepgram-tts.description',
      description: 'deepgram.com',
      icon: 'i-simple-icons:deepgram',
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      createProvider: async (config) => {
        const provider = createUnDeepgram((config.apiKey as string).trim(), (config.baseUrl as string).trim()) as SpeechProviderWithExtraOptions<string, UnDeepgramOptions>
        return provider
      },
      capabilities: {
        supportsSSML: false,
        supportsPitch: false,
        listModels: async () => {
          return [
            {
              id: 'aura-2',
              name: 'Aura 2',
              provider: 'deepgram-tts',
              description: 'Latest generation Aura model',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'aura-1',
              name: 'Aura 1',
              provider: 'deepgram-tts',
              description: 'First generation Aura model',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'aura',
              name: 'Aura (Legacy)',
              provider: 'deepgram-tts',
              description: 'Original Aura model',
              contextLength: 0,
              deprecated: true,
            },
          ]
        },
        listVoices: async (config) => {
          const provider = createUnDeepgram((config.apiKey as string).trim(), (config.baseUrl as string).trim()) as VoiceProviderWithExtraOptions<UnDeepgramOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              id: voice.id,
              name: voice.name,
              provider: 'deepgram-tts',
              description: voice.description,
              languages: voice.languages,
              gender: voice.labels?.gender,
            }
          })
        },
      },
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
            reason: errors.map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'microsoft-speech': {
      id: 'microsoft-speech',
      category: 'speech',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: true,
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.microsoft-speech.title',
      name: 'Microsoft / Azure Speech',
      descriptionKey: 'settings.pages.providers.provider.microsoft-speech.description',
      description: 'Enterprise Standard - Massive library of high-quality neural voices',
      iconColor: 'i-lobe-icons:microsoft',
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnMicrosoft(apiKey, baseUrl) as SpeechProviderWithExtraOptions<string, UnMicrosoftOptions>
      },
      capabilities: {
        supportsSSML: true,
        supportsPitch: true,
        listModels: async () => {
          return [
            {
              id: 'v1',
              name: 'v1',
              provider: 'microsoft-speech',
              description: '',
              contextLength: 0,
              deprecated: false,
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
              id: voice.id,
              name: voice.name,
              provider: 'microsoft-speech',
              previewURL: voice.preview_audio_url,
              languages: voice.languages,
              gender: voice.labels?.gender,
            }
          })
        },
      },
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
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'index-tts-vllm': {
      id: 'index-tts-vllm',
      category: 'speech',
      pricing: 'free',
      deployment: 'local',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.index-tts-vllm.title',
      name: 'Index-TTS by Bilibili',
      descriptionKey: 'settings.pages.providers.provider.index-tts-vllm.description',
      description: 'Zero-Shot Specialist - Industrial-level controllable TTS with exceptional naturalness',
      iconColor: 'i-lobe-icons:bilibiliindex',
      defaultOptions: () => ({
        baseUrl: 'http://localhost:11996/tts/',
        model: 'IndexTTS-1.5',
      }),
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
      capabilities: {
        listModels: async () => {
          return [
            {
              id: 'IndexTTS-1.5',
              name: 'IndexTTS-1.5',
              provider: 'index-tts-vllm',
              description: 'Default model for Index-TTS vLLM deployment',
              contextLength: 0,
              deprecated: false,
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
              name: voice,
              provider: 'index-tts-vllm',
              // previewURL: voice.preview_audio_url,
              languages: [{ code: 'cn', title: 'Chinese' }, { code: 'en', title: 'English' }],
            }
          })
        },
      },
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
          }
          catch (err) {
            const reason = `IndexTTS connection failed: ${String(err)}`
            return { errors: [err as Error], reason, valid: false }
          }

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'alibaba-cloud-model-studio': {
      id: 'alibaba-cloud-model-studio',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.alibaba-cloud-model-studio.title',
      name: 'Alibaba Cloud Model Studio',
      descriptionKey: 'settings.pages.providers.provider.alibaba-cloud-model-studio.description',
      description: 'Enterprise Voice Studio - High-performance Qwen3-TTS and CosyVoice models',
      iconColor: 'i-lobe-icons:alibabacloud',
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnAlibabaCloud(apiKey, baseUrl)
      },
      capabilities: {
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
          const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
          const provider = createUnAlibabaCloud(apiKey, baseUrl) as VoiceProviderWithExtraOptions<UnAlibabaCloudOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              id: voice.id,
              name: voice.name,
              provider: 'alibaba-cloud-model-studio',
              compatibleModels: voice.compatible_models,
              previewURL: voice.preview_audio_url,
              languages: voice.languages,
              gender: voice.labels?.gender,
            }
          })
        },
        listModels: async () => {
          return [
            {
              id: 'cosyvoice-v1',
              name: 'CosyVoice',
              provider: 'alibaba-cloud-model-studio',
              description: '',
              contextLength: 0,
              deprecated: false,
            },
            {
              id: 'cosyvoice-v2',
              name: 'CosyVoice (New)',
              provider: 'alibaba-cloud-model-studio',
              description: '',
              contextLength: 0,
              deprecated: false,
            },
          ]
        },
      },
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
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: !!config.apiKey && !!config.baseUrl,
          }
        },
      },
    },
    'volcengine': {
      id: 'volcengine',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.volcengine.title',
      name: 'settings.pages.providers.provider.volcengine.title',
      descriptionKey: 'settings.pages.providers.provider.volcengine.description',
      description: 'Emotional Expression - Cutting-edge ByteDance speech tech for natural interactions',
      iconColor: 'i-lobe-icons:volcengine',
      defaultOptions: () => ({
        baseUrl: 'https://unspeech.hyp3r.link/v1/',
      }),
      createProvider: async (config) => {
        const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
        const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
        return createUnVolcengine(apiKey, baseUrl)
      },
      capabilities: {
        listVoices: async (config: Record<string, unknown>) => {
          const apiKey = (config.apiKey as string | undefined)?.trim() ?? ''
          const baseUrl = (config.baseUrl as string | undefined)?.trim() ?? ''
          const provider = createUnVolcengine(apiKey, baseUrl) as VoiceProviderWithExtraOptions<UnVolcengineOptions>

          const voices = await listVoices({
            ...provider.voice(),
          })

          return voices.map((voice) => {
            return {
              id: voice.id,
              name: voice.name,
              provider: 'volcano-engine',
              previewURL: voice.preview_audio_url,
              languages: voice.languages,
              gender: voice.labels?.gender,
            }
          })
        },
        listModels: async () => {
          return [
            {
              id: 'v1',
              name: 'v1',
              provider: 'volcano-engine',
              description: '',
              contextLength: 0,
              deprecated: false,
            },
          ]
        },
      },
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.baseUrl && new Error('Base URL is required.'),
            !((config.app as any)?.appId) && new Error('App ID is required.'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res) {
            return res
          }

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'openrouter-audio-speech': {
      id: 'openrouter-audio-speech',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.openrouter-audio-speech.title',
      name: 'OpenRouter',
      descriptionKey: 'settings.pages.providers.provider.openrouter-audio-speech.description',
      description: 'Unified Speech Gateway - Access partner TTS models through OpenRouter',
      icon: 'i-lobe-icons:openrouter',
      defaultOptions: () => ({
        baseUrl: 'https://openrouter.ai/api/v1/',
      }),
      createProvider: async (config) => {
        const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
        let baseUrl = (typeof config.baseUrl === 'string' && config.baseUrl.trim()) || 'https://openrouter.ai/api/v1/'
        if (!baseUrl.endsWith('/'))
          baseUrl += '/'

        const provider: SpeechProvider = {
          speech: (model?: string) => ({
            baseURL: baseUrl,
            model: model || 'openai/gpt-audio-mini',
            fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
              if (!init?.body || typeof init.body !== 'string')
                throw new Error('Invalid request body')

              const body = JSON.parse(init.body)
              const text = body.input
              const voice = body.voice

              const sseResponse = await globalThis.fetch(new URL('chat/completions', baseUrl), {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: model || 'openai/gpt-audio-mini',
                  messages: [
                    { role: 'user', content: `Read this text aloud exactly as written, without any commentary or extra words:\n\n${text}` },
                  ],
                  modalities: ['text', 'audio'],
                  audio: { voice, format: 'pcm16' },
                  stream: true,
                }),
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
                if (done)
                  break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop()!

                for (const line of lines) {
                  if (!line.startsWith('data: '))
                    continue
                  const data = line.slice('data: '.length).trim()
                  if (data === '[DONE]')
                    break

                  try {
                    const chunk = JSON.parse(data)
                    const audio = chunk.choices?.[0]?.delta?.audio
                    if (audio?.data)
                      audioDataChunks.push(audio.data)
                  }
                  catch (e) {
                  // skip malformed chunks, but log them for debugging
                    console.warn('Skipping malformed SSE chunk from OpenRouter audio stream:', data, e)
                  }
                }
              }

              // Decode base64 PCM16 data
              const fullBase64 = audioDataChunks.join('')
              const binaryString = atob(fullBase64)
              const pcmBytes = new Uint8Array(binaryString.length)
              for (let i = 0; i < binaryString.length; i++)
                pcmBytes[i] = binaryString.charCodeAt(i)

              // Wrap raw PCM16 in a WAV header so the browser can play it
              const sampleRate = 24000
              const numChannels = 1
              const bitsPerSample = 16
              const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
              const blockAlign = numChannels * (bitsPerSample / 8)
              const wavHeader = new ArrayBuffer(44)
              const view = new DataView(wavHeader)
              const writeStr = (offset: number, str: string) => {
                for (let i = 0; i < str.length; i++)
                  view.setUint8(offset + i, str.charCodeAt(i))
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
                status: 200,
                headers: { 'Content-Type': 'audio/wav' },
              })
            },
          }),
        }
        return provider
      },
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          let baseUrl = (typeof config.baseUrl === 'string' && config.baseUrl.trim()) || 'https://openrouter.ai/api/v1/'
          if (!baseUrl.endsWith('/'))
            baseUrl += '/'

          try {
            const res = await fetch(`${baseUrl}models?output_modality=audio`)
            if (!res.ok)
              return []

            const json = await res.json()
            const models = json.data || []
            return models.map((m: any) => ({
              id: m.id,
              name: m.name || m.id,
              provider: 'openrouter-audio-speech',
              description: m.description || '',
              contextLength: m.context_length || 0,
              deprecated: false,
            } satisfies ModelInfo))
          }
          catch {
            return []
          }
        },
        listVoices: async () => {
        // OpenRouter audio models support standard OpenAI voices
          return [
            'alloy',
            'ash',
            'ballad',
            'coral',
            'echo',
            'fable',
            'onyx',
            'nova',
            'sage',
            'shimmer',
            'verse',
          ].map(id => ({
            id,
            name: id.charAt(0).toUpperCase() + id.slice(1),
            provider: 'openrouter-audio-speech',
            languages: [],
          } satisfies VoiceInfo))
        },
      },
      validators: {
        validateProviderConfig: (config) => {
          const errors: Error[] = []
          if (!config.apiKey)
            errors.push(new Error('API Key is required.'))

          if (config.baseUrl) {
            const res = baseUrlValidator.value(config.baseUrl)
            if (res)
              errors.push(...(res.errors as Error[]))
          }

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'comet-api-speech': buildOpenAICompatibleProvider({
      id: 'comet-api-speech',
      name: 'CometAPI Speech',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      descriptionKey: 'settings.pages.providers.provider.comet-api-speech.description',
      icon: 'i-lobe-icons:cometapi',
      description: 'Unified Speech Gateway - Hosted speech models through Comet API',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') => merge(
        createModelProvider({ apiKey, baseURL }),
        createSpeechProvider({ apiKey, baseURL }),
      ),
      validation: ['model_list'],
    }),
    'xai-audio-speech': buildOpenAICompatibleProvider({
      id: 'xai-audio-speech',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai-audio-speech.title',
      descriptionKey: 'settings.pages.providers.provider.xai-audio-speech.description',
      icon: 'i-lobe-icons:xai',
      description: 'Real-time Intelligence - Native xAI speech synthesis',
      category: 'speech',
      pricing: 'paid',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      defaultBaseUrl: 'https://api.x.ai/v1/',
      creator: (apiKey, baseURL = 'https://api.x.ai/v1/') => merge(
        createModelProvider({ apiKey, baseURL }),
        createSpeechProvider({ apiKey, baseURL }),
      ),
      validation: ['health'],
      capabilities: {
      // xAI provides 6 voices for TTS
      // Per https://docs.x.ai/docs/guides/voice documentation
        listVoices: async (_config: Record<string, unknown>) => {
          return [
            {
              id: 'Ara',
              name: 'Ara',
              provider: 'xai-audio-speech',
              description: 'Female voice (default)',
              gender: 'female',
              languages: [],
            },
            {
              id: 'Rex',
              name: 'Rex',
              provider: 'xai-audio-speech',
              description: 'Male voice',
              gender: 'male',
              languages: [],
            },
            {
              id: 'Sal',
              name: 'Sal',
              provider: 'xai-audio-speech',
              description: 'Voice',
              languages: [],
            },
            {
              id: 'Eve',
              name: 'Eve',
              provider: 'xai-audio-speech',
              description: 'Female voice',
              gender: 'female',
              languages: [],
            },
            {
              id: 'Una',
              name: 'Una',
              provider: 'xai-audio-speech',
              description: 'Female voice',
              gender: 'female',
              languages: [],
            },
            {
              id: 'Leo',
              name: 'Leo',
              provider: 'xai-audio-speech',
              description: 'Male voice',
              gender: 'male',
              languages: [],
            },
          ] satisfies VoiceInfo[]
        },
        listModels: async () => {
        // xAI uses a single TTS endpoint without specific model selection
          return [
            {
              id: 'grok-2-tts',
              name: 'Grok 2 TTS',
              provider: 'xai-audio-speech',
              description: 'xAI Grok text-to-speech model',
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
    'player2-speech': {
      id: 'player2-speech',
      category: 'speech',
      pricing: 'free',
      deployment: 'cloud',
      tasks: ['text-to-speech'],
      nameKey: 'settings.pages.providers.provider.player2.title',
      name: 'Player2 Speech',
      descriptionKey: 'settings.pages.providers.provider.player2-speech.description',
      description: 'Game-Ready AI - High-fidelity character voices with zero developer costs and revenue sharing',
      icon: 'i-lobe-icons:player2',
      defaultOptions: () => ({
        baseUrl: 'http://localhost:4315/v1/',
      }),
      createProvider: async config => createPlayer2((config.baseUrl as string).trim(), 'airi'),
      capabilities: {
        listModels: async () => {
          return [
            {
              id: 'player2-tts',
              name: 'Player2 Speech',
              provider: 'player2-speech',
              description: 'Default model for Player2 speech endpoint',
              contextLength: 0,
              deprecated: false,
            },
          ]
        },
        listVoices: async (config: Record<string, unknown>) => {
          const baseUrl = (config.baseUrl as string).endsWith('/') ? (config.baseUrl as string).slice(0, -1) : config.baseUrl as string
          return await fetch(`${baseUrl}/tts/voices`).then(res => res.json()).then(({ voices }) => (voices as { id: string, language: 'american_english' | 'british_english' | 'japanese' | 'mandarin_chinese' | 'spanish' | 'french' | 'hindi' | 'italian' | 'brazilian_portuguese', name: string, gender: string }[]).map(({ id, language, name, gender }) => (
            {

              id,
              name,
              provider: 'player2-speech',
              gender,
              languages: [{
                american_english: {
                  code: 'en',
                  title: 'English',
                },
                british_english: {
                  code: 'en',
                  title: 'English',
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
                brazilian_portuguese:
              {
                code: 'pt',
                title: 'Portuguese',
              },

              }[language]],
            }
          )))
        },
      },
      validators: {
        validateProviderConfig: async (config) => {
          const errors = [
            !config.baseUrl && new Error('Base URL is required. Default to http://localhost:4315/v1/'),
          ].filter(Boolean)

          const res = baseUrlValidator.value(config.baseUrl)
          if (res)
            return res

          try {
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 5000)
            const response = await fetch(`${config.baseUrl as string}health`, {
              method: 'GET',
              headers: {
                'player2-game-key': 'airi',
              },
              signal: controller.signal,
            })
            clearTimeout(timeout)

            if (!response.ok) {
              const reason = `Player2 speech unreachable: HTTP ${response.status} ${response.statusText}`
              return { errors: [new Error(reason)], reason, valid: false }
            }
          }
          catch (err) {
            const reason = `Player2 speech connection failed: ${String(err)}`
            return { errors: [err as Error], reason, valid: false }
          }

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
  }
}
