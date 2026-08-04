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
import type {
  UnAlibabaCloudOptions,
  UnDeepgramOptions,
  UnElevenLabsOptions,
  UnMicrosoftOptions,
  UnVolcengineOptions,
  VoiceProviderWithExtraOptions,
} from 'unspeech'

import type { AliyunRealtimeSpeechExtraOptions } from './providers/aliyun/stream-transcription'
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

import { isStageTamagotchi, isUrl } from '@proj-airi/stage-shared'
import { getCachedWebGPUCapabilities, isWebGPUSupported } from '@proj-airi/stage-shared/webgpu'
import { computedAsync, useLocalStorage } from '@vueuse/core'
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
import {
  createAzure,
  createPlayer2,
  createWorkersAI,
} from '@xsai-ext/providers/special/create'
import {
  createChatProvider,
  createModelProvider,
  createSpeechProvider,
  createTranscriptionProvider,
  merge,
} from '@xsai-ext/providers/utils'
import { listModels } from '@xsai/model'
import { AwsClient } from 'aws4fetch'
import { debounce, uniqBy } from 'es-toolkit'
import { defineStore } from 'pinia'
import {
  createUnAlibabaCloud,
  createUnDeepgram,
  createUnMicrosoft,
  createUnVolcengine,
  listVoices,
} from 'unspeech'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { createLocalVisionAdapter, DEFAULT_LOCAL_VISION_MODEL, LOCAL_VISION_MODELS } from '../libs/inference'
import { getKokoroAdapter } from '../libs/inference/adapters/kokoro'
import { DEFAULT_WEB_RWKV_MODEL, WEB_RWKV_MODELS } from '../libs/inference/constants'
import { appLocalAudioTranscription } from '../libs/providers/providers/transcription/app-local-audio-transcription'
import { getDefaultKokoroModel, KOKORO_MODELS, kokoroModelsToModelInfo } from '../workers/kokoro/constants'
import { createAliyunNLSProvider as createAliyunNlsStreamProvider } from './providers/aliyun/stream-transcription'
import { models as elevenLabsModels } from './providers/elevenlabs/list-models'
import { createNativeElevenLabsProvider } from './providers/elevenlabs/native'
import { isBrowserAndMemoryEnough, logWarn, toProviderRootBaseUrl, toV1SpeechBaseUrl, validateProviderBaseUrl } from './providers/helpers'
import { buildOpenAICompatibleProvider } from './providers/openai-compatible-builder'
import { createProviderRegistry } from './providers/registry'
import { createWebRwkvChatProvider } from './providers/web-rwkv'
import { createWebSpeechAPIProvider } from './providers/web-speech-api'

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

const ALIYUN_NLS_REGIONS = [
  'cn-shanghai',
  'cn-shanghai-internal',
  'cn-beijing',
  'cn-beijing-internal',
  'cn-shenzhen',
  'cn-shenzhen-internal',
] as const

type AliyunNlsRegion = typeof ALIYUN_NLS_REGIONS[number]

let mossAdapter: any = null
async function getMossAdapterInstance() {
  if (!mossAdapter) {
    const { createMossAdapter } = await import('../libs/inference/adapters/moss')
    mossAdapter = createMossAdapter()
  }
  return mossAdapter
}

interface MossReferencePreprocessOptions {
  silenceThresholdDb: number
  paddingMs: number
  fadeMs: number
  targetPeakDb: number
  minDurationMs: number
  maxDurationMs: number
}

const MOSS_REFERENCE_PREPROCESS_DEFAULTS: MossReferencePreprocessOptions = {
  silenceThresholdDb: -45,
  paddingMs: 150,
  fadeMs: 50,
  targetPeakDb: -3,
  minDurationMs: 1000,
  maxDurationMs: 15000,
}

/**
 * Decode raw audio bytes, resample to the codec target via a real
 * OfflineAudioContext render (Web Audio is main-thread only), then condition the
 * signal (silence trim / duration clamp / peak normalize) and return a
 * channel-planar Float32Array suitable for the codec encoder.
 *
 * NOTICE: this consolidates the divergent decode path — see browser_onnx_runtime.js
 * `decodeAudioToWaveform` for the parallel in-runtime implementation. The two must
 * stay in lockstep on sample-rate, channel packing, and frame sizing. Any change
 * here must be mirrored there (or vice versa) until both paths converge on one.
 */
async function preprocessMossReferenceAudio(
  arrayBuffer: ArrayBuffer,
  targetSampleRate: number,
  targetChannels: number,
  options?: Partial<MossReferencePreprocessOptions>,
): Promise<Float32Array> {
  const opts = { ...MOSS_REFERENCE_PREPROCESS_DEFAULTS, ...options }
  const AudioContextClass = typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : null
  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this environment.')
  }

  // 1. Decode + resample using a real OfflineAudioContext render (browsers do NOT
  //    reliably honor the {sampleRate} constructor hint on AudioContext).
  const decodeCtx = new AudioContextClass()
  let renderedAudio: AudioBuffer
  try {
    const decodedAudio = await decodeCtx.decodeAudioData(arrayBuffer.slice(0))
    if (decodedAudio.sampleRate === targetSampleRate && decodedAudio.numberOfChannels === targetChannels) {
      renderedAudio = decodedAudio
    }
    else {
      const frameCount = Math.max(1, Math.ceil(decodedAudio.duration * targetSampleRate))
      const OfflineContextClass = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
      if (!OfflineContextClass) {
        throw new Error('OfflineAudioContext is not supported in this environment.')
      }
      const offlineCtx = new OfflineContextClass(targetChannels, frameCount, targetSampleRate)
      const source = offlineCtx.createBufferSource()
      source.buffer = decodedAudio
      source.connect(offlineCtx.destination)
      source.start(0)
      renderedAudio = await offlineCtx.startRendering()
    }
  }
  finally {
    await decodeCtx.close().catch(() => {})
  }

  // 2. Pack channels into channel-planar layout expected by the codec encoder.
  const waveformLength = renderedAudio.length
  const planarWaveform = new Float32Array(targetChannels * waveformLength)
  for (let c = 0; c < targetChannels; c++) {
    const src = renderedAudio.getChannelData(Math.min(c, renderedAudio.numberOfChannels - 1))
    planarWaveform.set(src, c * waveformLength)
  }

  // 3. Signal conditioning (frame-domain, sample-rate & channel aware).
  return conditionMossPlanarWaveform(planarWaveform, waveformLength, targetChannels, targetSampleRate, opts)
}

/**
 * Trim silence, clamp duration, apply edge fades, and peak-normalize a
 * channel-planar reference waveform. All frame logic is computed on real samples
 * so the conditioning is correct regardless of target sample-rate.
 */
function conditionMossPlanarWaveform(
  planar: Float32Array,
  waveformLength: number,
  channels: number,
  sampleRate: number,
  opts: MossReferencePreprocessOptions,
): Float32Array {
  if (waveformLength === 0)
    return planar

  const frameMs = 25
  const frameSize = Math.max(1, Math.round(sampleRate * frameMs / 1000))
  const fadeSamples = Math.max(1, Math.round(sampleRate * opts.fadeMs / 1000))
  const paddingFrames = Math.max(0, Math.round(opts.paddingMs / frameMs))
  const minFrames = Math.max(1, Math.round(sampleRate * opts.minDurationMs / 1000 / frameSize))
  const maxFrames = Math.max(minFrames, Math.round(sampleRate * opts.maxDurationMs / 1000 / frameSize))

  const numFrames = Math.max(1, Math.floor(waveformLength / frameSize))
  const frameRmsDb = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const frameStart = f * frameSize
    const frameEnd = Math.min(frameStart + frameSize, waveformLength)
    let sumSquares = 0
    let count = 0
    for (let c = 0; c < channels; c++) {
      const chBase = c * waveformLength
      for (let i = frameStart; i < frameEnd; i++) {
        const s = planar[chBase + i]
        sumSquares += s * s
        count++
      }
    }
    const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0
    frameRmsDb[f] = rms > 0 ? 20 * Math.log10(rms) : -Infinity
  }

  let firstActive = 0
  while (firstActive < numFrames && frameRmsDb[firstActive] < opts.silenceThresholdDb)
    firstActive++
  let lastActive = numFrames - 1
  while (lastActive >= 0 && frameRmsDb[lastActive] < opts.silenceThresholdDb)
    lastActive--

  if (firstActive >= numFrames || lastActive < firstActive) {
    return peakNormalizeMossPlanar(planar, channels, opts.targetPeakDb)
  }

  let startFrame = Math.max(0, firstActive - paddingFrames)
  let endFrame = Math.min(numFrames - 1, lastActive + paddingFrames)

  const activeFrames = endFrame - startFrame + 1
  if (activeFrames > maxFrames) {
    endFrame = Math.min(numFrames - 1, startFrame + maxFrames - 1)
  }
  else if (activeFrames < minFrames) {
    const deficit = minFrames - activeFrames
    startFrame = Math.max(0, startFrame - Math.floor(deficit / 2))
    endFrame = Math.min(numFrames - 1, startFrame + minFrames - 1)
  }

  const startSample = startFrame * frameSize
  const endSample = Math.min(waveformLength, (endFrame + 1) * frameSize)
  const trimmedLength = endSample - startSample

  const out = new Float32Array(channels * trimmedLength)
  for (let c = 0; c < channels; c++) {
    const srcBase = c * waveformLength
    out.set(planar.subarray(srcBase + startSample, srcBase + endSample), c * trimmedLength)
  }

  applyMossEdgeFadePlanar(out, trimmedLength, channels, fadeSamples)
  return peakNormalizeMossPlanar(out, channels, opts.targetPeakDb)
}

function peakNormalizeMossPlanar(planar: Float32Array, channels: number, targetPeakDb: number): Float32Array {
  let peak = 0
  for (let i = 0; i < planar.length; i++) {
    const a = Math.abs(planar[i])
    if (a > peak)
      peak = a
  }
  if (peak <= 0)
    return planar

  const targetPeak = 10 ** (targetPeakDb / 20)
  const gain = targetPeak / peak
  if (gain >= 0.98 && gain <= 1.02)
    return planar

  const out = new Float32Array(planar.length)
  for (let i = 0; i < planar.length; i++)
    out[i] = Math.max(-1, Math.min(1, planar[i] * gain))
  return out
}

function applyMossEdgeFadePlanar(planar: Float32Array, waveformLength: number, channels: number, fadeSamples: number): void {
  const fadeCount = Math.min(fadeSamples, Math.floor(waveformLength / 2))
  for (let c = 0; c < channels; c++) {
    const base = c * waveformLength
    for (let i = 0; i < fadeCount; i++) {
      const t = i / fadeCount
      planar[base + i] *= t
      planar[base + (waveformLength - 1 - i)] *= (1 - t)
    }
  }
}

export const useProvidersStore = defineStore('providers', () => {
  const providerCredentials = useLocalStorage<Record<string, Record<string, unknown>>>('settings/credentials/providers', {})
  const addedProviders = useLocalStorage<Record<string, boolean>>('settings/providers/added', {})
  const providerInstanceCache = ref<Record<string, unknown>>({})
  const { t } = useI18n()
  const baseUrlValidator = { value: validateProviderBaseUrl }

  // Centralized provider metadata with provider factory functions
  const providerDefinitions: Record<string, ProviderMetadata> = {
    'speech-noop': {
      id: 'speech-noop',
      category: 'speech',
      tasks: ['text-to-speech', 'tts'],
      nameKey: 'settings.pages.providers.provider.speech-noop.title',
      name: 'None',
      descriptionKey: 'settings.pages.providers.provider.speech-noop.description',
      description: 'No speech output.',
      icon: 'i-solar:volume-cross-bold-duotone',
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
            const { useSpeechStore } = await import('./modules/speech')
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
    'app-local-audio-transcription': appLocalAudioTranscription as any,
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
    'browser-local-audio-transcription': {
      id: 'browser-local-audio-transcription',
      name: 'Browser (Local)',
      nameKey: 'settings.pages.providers.provider.browser-local-audio-transcription.title',
      descriptionKey: 'settings.pages.providers.provider.browser-local-audio-transcription.description',
      icon: 'i-lobe-icons:huggingface',
      description: 'Private & Secure - In-browser transcription via WebGPU',
      category: 'transcription',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      isAvailableBy: isBrowserAndMemoryEnough,
      defaultOptions: () => ({}),
      createProvider: async () => ({
        transcription: () => ({
          baseURL: 'http://browser-local-audio-transcription.invalid/v1/',
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
    'openai-audio-transcription': buildOpenAICompatibleProvider({
      id: 'openai-audio-transcription',
      name: 'OpenAI',
      nameKey: 'settings.pages.providers.provider.openai.title',
      descriptionKey: 'settings.pages.providers.provider.openai-audio-transcription.description',
      icon: 'i-lobe-icons:openai',
      description: 'Industry Standard - Reliable and widely compatible Whisper API',
      category: 'transcription',
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
    'deepgram-transcription': buildOpenAICompatibleProvider({
      id: 'deepgram-transcription',
      name: 'Deepgram STT (Nova)',
      pricing: 'free',
      deployment: 'cloud',
      beginnerRecommended: true,
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
    'comet-api-transcription': buildOpenAICompatibleProvider({
      id: 'comet-api-transcription',
      name: 'CometAPI Transcription',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      descriptionKey: 'settings.pages.providers.provider.comet-api-transcription.description',
      icon: 'i-lobe-icons:cometapi',
      description: 'Enterprise-grade cloud transcription',
      category: 'transcription',
      tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') => merge(
        createModelProvider({ apiKey, baseURL }),
        createTranscriptionProvider({ apiKey, baseURL }),
      ),
      validation: ['model_list'],
    }),

    'cerebras-ai': buildOpenAICompatibleProvider({
      id: 'cerebras-ai',
      name: 'Cerebras',
      nameKey: 'settings.pages.providers.provider.cerebras.title',
      descriptionKey: 'settings.pages.providers.provider.cerebras.description',
      icon: 'i-lobe-icons:cerebras',
      description: '1M Free Tokens/Day - Insanely fast LPU inference',
      defaultBaseUrl: 'https://api.cerebras.ai/v1/',
      creator: createCerebras,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:cerebras-color',
    }),
    'together-ai': buildOpenAICompatibleProvider({
      id: 'together-ai',
      name: 'Together.ai',
      nameKey: 'settings.pages.providers.provider.together.title',
      descriptionKey: 'settings.pages.providers.provider.together.description',
      icon: 'i-lobe-icons:together',
      description: 'Open Model Fast Lane - Cost-effective access to fast open-source inference',
      defaultBaseUrl: 'https://api.together.xyz/v1/',
      creator: createTogetherAI,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:together',
    }),
    'azure-ai-foundry': {
      id: 'azure-ai-foundry',
      category: 'chat',
      tasks: ['text-generation'],
      nameKey: 'settings.pages.providers.provider.azure-ai-foundry.title',
      name: 'Azure AI Foundry',
      descriptionKey: 'settings.pages.providers.provider.azure-ai-foundry.description',
      description: 'Enterprise Standard - Secure, robust Azure-hosted intelligence',
      icon: 'i-lobe-icons:microsoft',
      defaultOptions: () => ({}),
      createProvider: async (config) => {
        return await createAzure({
          apiKey: async () => (config.apiKey as string).trim(),
          resourceName: config.resourceName as string,
          apiVersion: config.apiVersion as string,
        })
      },
      capabilities: {
        listModels: async (config: Record<string, unknown>) => {
          return [{ id: config.modelId }].map((model) => {
            return {
              id: model.id as string,
              name: model.id as string,
              provider: 'azure-ai-foundry',
              description: '',
              contextLength: 0,
              deprecated: false,
            } satisfies ModelInfo
          })
        },
        listVoices: async () => [],
      },
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
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: errors.length === 0,
          }
        },
      },
    },
    'xai': buildOpenAICompatibleProvider({
      id: 'xai',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai.title',
      descriptionKey: 'settings.pages.providers.provider.xai.description',
      icon: 'i-lobe-icons:xai',
      description: 'Real-time Intelligence - High-accuracy speech recognition natively in the xAI ecosystem',
      defaultBaseUrl: 'https://api.x.ai/v1/',
      creator: createXai,
      validation: ['health', 'model_list'],
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
    'xai-audio-transcription': buildOpenAICompatibleProvider({
      id: 'xai-audio-transcription',
      name: 'xAI',
      nameKey: 'settings.pages.providers.provider.xai-audio-transcription.title',
      descriptionKey: 'settings.pages.providers.provider.xai-audio-transcription.description',
      icon: 'i-lobe-icons:xai',
      description: 'Grok Native - Real-time access to X/Twitter data',
      category: 'transcription',
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
    'vllm': {
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
    'novita-ai': buildOpenAICompatibleProvider({
      id: 'novita-ai',
      name: 'Novita',
      nameKey: 'settings.pages.providers.provider.novita.title',
      descriptionKey: 'settings.pages.providers.provider.novita.description',
      icon: 'i-lobe-icons:novita',
      description: 'Scalable Cloud - 10,000+ models with ultra-fast, low-latency inference',
      defaultBaseUrl: 'https://api.novita.ai/openai/',
      creator: createNovitaAi,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:novita',
    }),
    'fireworks-ai': buildOpenAICompatibleProvider({
      id: 'fireworks-ai',
      name: 'Fireworks.ai',
      nameKey: 'settings.pages.providers.provider.fireworks.title',
      descriptionKey: 'settings.pages.providers.provider.fireworks.description',
      icon: 'i-lobe-icons:fireworks',
      description: 'Speed-Optimized - $1 free credit for premium model hosting',
      defaultBaseUrl: 'https://api.fireworks.ai/inference/v1/',
      creator: createFireworks,
      validation: ['health', 'model_list'],
    }),
    'featherless-ai': buildOpenAICompatibleProvider({
      id: 'featherless-ai',
      name: 'Featherless.ai',
      nameKey: 'settings.pages.providers.provider.featherless.title',
      descriptionKey: 'settings.pages.providers.provider.featherless.description',
      icon: 'i-lobe-icons:featherless-ai',
      description: 'Unlimited Tokens - Flat $10/mo fee for 6,700+ models',
      defaultBaseUrl: 'https://api.featherless.ai/v1/',
      creator: createOpenAI,
      validation: ['health', 'model_list'],
    }),
    'cloudflare-workers-ai': {
      id: 'cloudflare-workers-ai',
      category: 'chat',
      tasks: ['text-generation'],
      nameKey: 'settings.pages.providers.provider.cloudflare-workers-ai.title',
      name: 'Cloudflare Workers AI',
      descriptionKey: 'settings.pages.providers.provider.cloudflare-workers-ai.description',
      description: 'AI on the Edge - 10k free Neurons/day across many models',
      iconColor: 'i-lobe-icons:cloudflare',
      createProvider: async config => createWorkersAI((config.apiKey as string).trim(), config.accountId as string),
      capabilities: {
        listModels: async () => {
          return []
        },
      },
      validators: {
        validateProviderConfig: (config) => {
          const errors = [
            !config.apiKey && new Error('API key is required.'),
            !config.accountId && new Error('Account ID is required.'),
          ].filter(Boolean)

          return {
            errors,
            reason: errors.filter((e): e is Error => e instanceof Error).map(e => e.message).join(', '),
            valid: !!config.apiKey && !!config.accountId,
          }
        },
      },
    },
    'comet-api': buildOpenAICompatibleProvider({
      id: 'comet-api',
      name: 'CometAPI',
      nameKey: 'settings.pages.providers.provider.comet-api.title',
      descriptionKey: 'settings.pages.providers.provider.comet-api.description',
      icon: 'i-lobe-icons:cometapi',
      description: 'GenAI Observability - Free tier for model evaluation',
      defaultBaseUrl: 'https://api.cometapi.com/v1/',
      creator: (apiKey, baseURL = 'https://api.cometapi.com/v1/') => merge(
        createChatProvider({ apiKey, baseURL }),
        createModelProvider({ apiKey, baseURL }),
      ),
      validation: ['model_list'],
    }),
    'perplexity-ai': buildOpenAICompatibleProvider({
      id: 'perplexity-ai',
      name: 'Perplexity',
      nameKey: 'settings.pages.providers.provider.perplexity.title',
      descriptionKey: 'settings.pages.providers.provider.perplexity.description',
      icon: 'i-lobe-icons:perplexity',
      description: 'Search-Augmented - Real-time web-connected intelligence',
      defaultBaseUrl: 'https://api.perplexity.ai/',
      creator: createPerplexity,
      validation: ['health', 'model_list'],
    }),
    'mistral-ai': buildOpenAICompatibleProvider({
      id: 'mistral-ai',
      name: 'Mistral',
      nameKey: 'settings.pages.providers.provider.mistral.title',
      descriptionKey: 'settings.pages.providers.provider.mistral.description',
      icon: 'i-lobe-icons:mistral',
      description: 'European Open-Weights - High-efficiency, low-latency models',
      defaultBaseUrl: 'https://api.mistral.ai/v1/',
      creator: createMistral,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:mistral',
    }),
    'moonshot-ai': buildOpenAICompatibleProvider({
      id: 'moonshot-ai',
      name: 'Moonshot AI',
      nameKey: 'settings.pages.providers.provider.moonshot.title',
      descriptionKey: 'settings.pages.providers.provider.moonshot.description',
      icon: 'i-lobe-icons:moonshot',
      description: 'Long-Context Specialist - Kimi Chat with 256k context window',
      defaultBaseUrl: 'https://api.moonshot.ai/v1/',
      creator: createMoonshotai,
      validation: ['health', 'model_list'],
    }),
    'modelscope': buildOpenAICompatibleProvider({
      id: 'modelscope',
      name: 'ModelScope',
      nameKey: 'settings.pages.providers.provider.modelscope.title',
      descriptionKey: 'settings.pages.providers.provider.modelscope.description',
      icon: 'i-lobe-icons:modelscope',
      description: 'modelscope',
      defaultBaseUrl: 'https://api-inference.modelscope.cn/v1/',
      creator: createOpenAI,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:modelscope',
    }),
    'opencode-go': buildOpenAICompatibleProvider({
      id: 'opencode-go',
      name: 'OpenCode Go',
      nameKey: 'settings.pages.providers.provider.opencode-go.title',
      descriptionKey: 'settings.pages.providers.provider.opencode-go.description',
      icon: 'i-lobe-icons:openai-compatible',
      description: 'Developer API Platform - Plans start at $10 a month',
      defaultBaseUrl: 'https://opencode.ai/zen/go/v1/',
      creator: createOpenAI,
      validation: ['health', 'model_list'],
    }),
    'alibaba-cloud': buildOpenAICompatibleProvider({
      id: 'alibaba-cloud',
      name: 'Alibaba Cloud',
      nameKey: 'settings.pages.providers.provider.alibaba-cloud.title',
      descriptionKey: 'settings.pages.providers.provider.alibaba-cloud.description',
      icon: 'i-lobe-icons:alibabacloud',
      description: 'Model Studio - Large-scale model service platform by Alibaba Cloud',
      defaultBaseUrl: 'https://ws-xdvshc2who4vf72n.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
      creator: createOpenAI,
      validation: ['health', 'model_list'],
      iconColor: 'i-lobe-icons:alibabacloud',
    }),
    'player2': {
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

    'web-rwkv': {
      id: 'web-rwkv',
      category: 'chat',
      tasks: ['text-generation'],
      nameKey: 'settings.pages.providers.provider.web-rwkv.title',
      name: 'RWKV (Local, WebGPU)',
      descriptionKey: 'settings.pages.providers.provider.web-rwkv.description',
      description: 'Local RWKV-7 language model running in your browser via WebGPU.',
      icon: 'i-solar:cpu-bolt-bold-duotone',
      // Local in-browser model — no API key.
      requiresCredentials: false,
      // WebGPU-only: web-rwkv has no WASM/CPU backend, so hide it where WebGPU
      // is unavailable. Works in Electron (Chromium) as well as WebGPU browsers.
      isAvailableBy: () => isWebGPUSupported(),
      defaultOptions: () => ({
        model: DEFAULT_WEB_RWKV_MODEL,
        vocab: '',
        enableG1Prefill: true,
      }),
      createProvider: async config => createWebRwkvChatProvider({
        model: (config.model as string) || undefined,
        vocab: (config.vocab as string) || undefined,
        enableG1Prefill: config.enableG1Prefill !== false,
      }),
      capabilities: {
        // The model id is its safetensors URL; the configured override (or the
        // default) is the single selectable model.
        listModels: async (config) => {
          const url = (config.model as string) || DEFAULT_WEB_RWKV_MODEL
          const known = WEB_RWKV_MODELS.find(m => m.id === url)
          return [{
            id: url,
            name: known?.name ?? 'RWKV (custom URL)',
            provider: 'web-rwkv',
            description: known?.description ?? 'Custom web-rwkv model URL.',
            contextLength: 0,
            deprecated: false,
          }]
        },
      },
      validators: {
        chatPingCheckAvailable: false,
        // No credentials; valid as long as a model URL is present.
        validateProviderConfig: (config) => {
          const url = (config.model as string) || DEFAULT_WEB_RWKV_MODEL
          if (!url) {
            return { errors: [new Error('No model URL configured')], reason: 'A model URL is required.', valid: false }
          }
          return { errors: [], reason: '', valid: true }
        },
      },
    },
    'blip-local': {
      id: 'blip-local',
      category: 'vision',
      tasks: ['vision', 'image-to-text'],
      nameKey: 'settings.pages.providers.provider.blip-local.title',
      name: 'BLIP (Local, WebGPU)',
      descriptionKey: 'settings.pages.providers.provider.blip-local.description',
      description: 'On-device vision tagging (WD14 Tagger / BLIP) running in browser via WebGPU.',
      icon: 'i-solar:eye-scan-bold-duotone',
      requiresCredentials: false,
      isAvailableBy: () => isWebGPUSupported(),
      defaultOptions: () => ({
        model: DEFAULT_LOCAL_VISION_MODEL,
      }),
      createProvider: async (config) => {
        const adapter = createLocalVisionAdapter()
        return {
          captionImage: (url: string, opts?: any) => adapter.captionImage(url, opts),
          loadModel: (opts?: any) => adapter.load(config.model as string, undefined, opts),
          state: computed(() => adapter.state),
          deviceLossCount: computed(() => adapter.deviceLossCount),
          terminate: () => adapter.terminate(),
        } as any
      },
      capabilities: {
        listModels: async () => {
          return LOCAL_VISION_MODELS.map(m => ({
            id: m.id,
            name: m.name,
            provider: 'blip-local',
            description: m.description,
            contextLength: 0,
            deprecated: false,
          }))
        },
      },
      validators: {
        chatPingCheckAvailable: false,
        validateProviderConfig: (config) => {
          const url = (config.model as string) || DEFAULT_LOCAL_VISION_MODEL
          if (!url) {
            return { errors: [new Error('No model configured')], reason: 'A model is required.', valid: false }
          }
          return { errors: [], reason: '', valid: true }
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
