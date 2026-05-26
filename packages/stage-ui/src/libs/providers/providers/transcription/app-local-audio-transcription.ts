import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { z } from 'zod'
import { getWhisperWorker, WHISPER_MODELS, whisperModelsToModelInfo } from '../../../workers/whisper'
import type { ProviderDefinition } from '../../types'

const localTranscriptionConfigSchema = z.object({})

type LocalTranscriptionConfig = z.input<typeof localTranscriptionConfigSchema>

const loadedModels = new Set<string>()
const loadingPromises = new Map<string, Promise<void>>()

const definition: ProviderDefinition<LocalTranscriptionConfig> = {
  beginnerRecommended: true,
  capabilities: {
    // Legacy
    listModels: async () => whisperModelsToModelInfo(WHISPER_MODELS as any),

    // Common for both standards
    loadModel: async (_config: any, _provider: any, hooks?: { onProgress?: (progress: any) => void }) => {
      const modelId = WHISPER_MODELS[0].id // Fallback to first model if not specific
      const effectiveModelId = typeof _config === 'string' ? _config : modelId

      if (loadedModels.has(effectiveModelId)) {
        console.info(`[App Local Transcription] Model ${effectiveModelId} already loaded.`)
        return
      }

      if (loadingPromises.has(effectiveModelId)) {
        console.info(`[App Local Transcription] Model ${effectiveModelId} is already loading...`)
        return loadingPromises.get(effectiveModelId)
      }

      console.info(`[App Local Transcription] Starting load for ${effectiveModelId}`)

      const loadPromise = (async () => {
        const worker = await getWhisperWorker()
        const id = Math.random().toString(36).substring(7)

        return new Promise<void>((resolve, reject) => {
          const handleMessage = (e: MessageEvent) => {
            if (e.data.id === id) {
              if (e.data.type === 'LOADED') {
                worker.removeEventListener('message', handleMessage)
                loadedModels.add(effectiveModelId)
                loadingPromises.delete(effectiveModelId)
                console.info(`[App Local Transcription] Model ${effectiveModelId} loaded successfully.`)
                resolve()
              } else if (e.data.type === 'PROGRESS') {
                if (hooks?.onProgress) {
                  hooks.onProgress({ progress: e.data.progress })
                }
              } else if (e.data.type === 'ERROR') {
                worker.removeEventListener('message', handleMessage)
                loadingPromises.delete(effectiveModelId)
                const error = new Error(e.data.error)
                ;(error as any).stack = e.data.stack
                console.error(`[App Local Transcription] Load failed:`, error)
                reject(error)
              }
            }
          }

          worker.addEventListener('message', handleMessage)
          worker.postMessage({ id, modelId: effectiveModelId, type: 'LOAD' })
        })
      })()

      loadingPromises.set(effectiveModelId, loadPromise)
      return loadPromise
    },

    // New (ProviderDefinition uses transcription under capabilities)
    transcription: {
      generateOutput: true,
      protocol: 'http',
      streamInput: false,
      streamOutput: false,
    },
  } as any,
  category: 'transcription',
  createProvider: async (_config: LocalTranscriptionConfig) => {
    const worker = await getWhisperWorker()

    const transcribe = async (audioInput: any, model: string) => {
      console.group(`[App Local Transcription] Transcribing with model ${model}`)

      // Transcription libraries like @xsai might pass an object with { file: Blob }
      const audio =
        audioInput && typeof audioInput === 'object' && 'file' in audioInput ? (audioInput as any).file : audioInput

      console.info('[App Local Transcription] Normalized audio input:', {
        size: audio instanceof Blob ? audio.size : 'N/A',
        type: audio?.constructor?.name || typeof audio,
      })

      // Safety: ensure model is loaded if not already
      if (!loadedModels.has(model)) {
        console.warn(`[App Local Transcription] Model ${model} not loaded. Triggering auto-load...`)
        try {
          const capabilities = definition.capabilities as any
          if (capabilities?.loadModel) {
            await capabilities.loadModel(model, { transcription: () => ({}) } as any, {
              onProgress: (info: any) => console.info(`[App Local Transcription] Auto-load progress:`, info),
            })
          } else {
            throw new Error('loadModel capability is missing')
          }
        } catch (err) {
          console.error(`[App Local Transcription] Auto-load failed:`, err)
          console.groupEnd()
          throw err
        }
      }

      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7)

        const handleMessage = (e: MessageEvent) => {
          if (e.data.id === id) {
            if (e.data.type === 'RESULT') {
              console.info(`[App Local Transcription] Success for ${id}`)
              worker.removeEventListener('message', handleMessage)
              resolve({ text: e.data.text })
            } else if (e.data.type === 'ERROR') {
              const error = new Error(e.data.error || 'Unknown worker error')
              ;(error as any).stack = e.data.stack
              console.error(`[App Local Transcription] Error for ${id}:`, error)
              worker.removeEventListener('message', handleMessage)
              reject(error)
            }
          }
        }

        worker.addEventListener('message', handleMessage)

        console.info(`[App Local Transcription] Sending TRANSCRIBE message ${id}`)

        if (audio instanceof Blob) {
          audio
            .arrayBuffer()
            .then((buffer) => {
              worker.postMessage(
                {
                  audio: buffer,
                  id,
                  model,
                  type: 'TRANSCRIBE',
                },
                [buffer],
              )
            })
            .catch((err) => {
              console.error('[App Local Transcription] Failed to read audio blob:', err)
              worker.removeEventListener('message', handleMessage)
              reject(err)
            })
        } else if (audio instanceof ArrayBuffer) {
          const buffer = audio.slice(0)
          worker.postMessage(
            {
              audio: buffer,
              format: 'pcm16',
              id,
              model,
              type: 'TRANSCRIBE',
            },
            [buffer],
          )
        } else {
          console.error('[App Local Transcription] Unsupported audio format received:', audio)
          worker.removeEventListener('message', handleMessage)
          reject(new Error(`Unsupported audio format: ${audio?.constructor?.name || typeof audio}`))
        }
      }).finally(() => {
        console.groupEnd()
      })
    }

    return {
      transcription: (model: string) => ({
        // NOTICE: baseURL is required by @xsai/shared requestURL to avoid .toString() on undefined
        baseURL: 'http://app-local-transcription.invalid',
        // NOTICE: fetch shim to intercept REST-style calls and route to local worker
        fetch: async (input: any, init?: any) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input && typeof input === 'object' && 'url' in input
                  ? input.url
                  : String(input)

          if (url.includes('audio/transcriptions')) {
            console.info('[App Local Transcription] Intercepting transcription request', { url })
            const body = init?.body as any
            const file = body?.get?.('file')
            const result = await transcribe(file, model)
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return globalThis.fetch(input, init)
        },
        model,
        provider: 'app-local-audio-transcription',
        // Also keep legacy transcribe for direct calls
        transcribe: (audioInput: any) => transcribe(audioInput, model),
      }),
    } as any // Cast to any because the nested structure used by xsai is complex and we're bridging interfaces
  },
  // New
  createProviderConfig: () => localTranscriptionConfigSchema as any,
  // Legacy
  defaultOptions: () => ({}),
  deployment: 'local',
  description: 'Native AI - High-performance local Whisper transcription',
  descriptionKey: 'settings.pages.providers.provider.app-local-audio-transcription.description',
  descriptionLocalize: ({ t }: { t: any }) =>
    t('settings.pages.providers.provider.app-local-audio-transcription.description'),
  icon: 'i-lobe-icons:huggingface',
  id: 'app-local-audio-transcription',
  isAvailableBy: isStageTamagotchi,
  name: 'App (Local)',
  // Legacy fields for ProviderMetadata
  nameKey: 'settings.pages.providers.provider.app-local-audio-transcription.title',
  // New fields for ProviderDefinition
  nameLocalize: ({ t }: { t: any }) => t('settings.pages.providers.provider.app-local-audio-transcription.title'),
  pricing: 'free',
  settingsComponent: () =>
    import('@proj-airi/stage-pages/pages/settings/providers/transcription/app-local-audio-transcription.vue'),
  tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
  validators: {
    // New
    validateConfig: [],
    validateProvider: [],
    // Legacy
    validateProviderConfig: () => ({
      errors: [],
      reason: '',
      valid: true,
    }),
  } as any,
} as any

export const appLocalAudioTranscription = definition
