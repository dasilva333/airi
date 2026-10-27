import type { TranscriptionProviderWithExtraOptions } from '@xsai-ext/providers/utils'
import type { WithUnknown } from '@xsai/shared'
import type { StreamTranscriptionResult, StreamTranscriptionOptions as XSAIStreamTranscriptionOptions } from '@xsai/stream-transcription'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { generateTranscription } from '@xsai/generate-transcription'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useOnboardingStore } from '../onboarding'
import { useProvidersStore } from '../providers'
import { streamAliyunTranscription } from '../providers/aliyun/stream-transcription'

export interface StreamTranscriptionFileInputOptions extends Omit<XSAIStreamTranscriptionOptions, 'file' | 'fileName'> {
  file: Blob
  fileName?: string
}

export interface StreamTranscriptionStreamInputOptions extends Omit<XSAIStreamTranscriptionOptions, 'file' | 'fileName'> {
  inputAudioStream: ReadableStream<ArrayBuffer>
}

export type StreamTranscription = (options: WithUnknown<StreamTranscriptionFileInputOptions | StreamTranscriptionStreamInputOptions>) => StreamTranscriptionResult

type GenerateTranscriptionResponse = Awaited<ReturnType<typeof generateTranscription>>
type HearingTranscriptionGenerateResult = GenerateTranscriptionResponse & { mode: 'generate' }
type HearingTranscriptionStreamResult = StreamTranscriptionResult & { mode: 'stream' }
export type HearingTranscriptionResult = HearingTranscriptionGenerateResult | HearingTranscriptionStreamResult

type HearingTranscriptionInput = File | {
  file?: File
  inputAudioStream?: ReadableStream<ArrayBuffer>
}

interface HearingTranscriptionInvokeOptions {
  providerOptions?: Record<string, unknown>
}

const STREAM_TRANSCRIPTION_EXECUTORS: Record<string, StreamTranscription> = {
  'aliyun-nls-transcription': streamAliyunTranscription,
  // Web Speech API is handled specially in transcribeForMediaStream since it works directly with MediaStream
}

export const useHearingStore = defineStore('hearing-store', () => {
  const providersStore = useProvidersStore()
  const onboardingStore = useOnboardingStore()
  const { allAudioTranscriptionProvidersMetadata } = storeToRefs(providersStore)

  // State
  const activeTranscriptionProvider = useLocalStorageManualReset('settings/hearing/active-provider', '')
  const activeTranscriptionModel = useLocalStorageManualReset('settings/hearing/active-model', '')
  const activeCustomModelName = useLocalStorageManualReset('settings/hearing/active-custom-model', '')
  const transcriptionModelSearchQuery = refManualReset<string>('')
  const autoSendEnabled = useLocalStorageManualReset<boolean>('settings/hearing/auto-send-enabled', true)
  const autoSendDelay = useLocalStorageManualReset<number>('settings/hearing/auto-send-delay', 2000) // Default 2 seconds
  const hearingDetectionMode = useLocalStorageManualReset<'vad' | 'manual'>('settings/hearing/detection-mode', 'vad')
  // Tap-to-talk (single tap captures one utterance and stops itself at
  // speech end) vs open line (tap opens, tap closes, utterances segment
  // automatically). Independent of the mic-hot `enabled` flag — taps never
  // touch ambient listening.
  const tapToTalk = useLocalStorageManualReset<boolean>('settings/hearing/tap-to-talk', true)
  // Mic capture ownership — the single authority pact shared by the control
  // strip, lock-key hotkeys, and every chat composer (desktop, web, pocket).
  // 'composer' = an explicit composer tap owns the live capture (ambient
  // page loops stand down); 'ambient' = strip/lock-key toggle owns it;
  // null = released. Last actor wins; releasing always also drops `enabled`.
  // Persisted (not a plain ref) so main-window and chat-window stores agree.
  const micOwner = useLocalStorageManualReset<'composer' | 'ambient' | null>('settings/audio/input/owner', null)
  // A persisted 'composer' can only be stale (a reload kills any live
  // capture), so clear it at store setup — within-session taps set it after.
  if (micOwner.value === 'composer')
    micOwner.value = null
  const voiceInputMode = useLocalStorageManualReset<'dictation' | 'voice-message'>('settings/hearing/voice-input-mode', 'dictation')
  const vadThreshold = useLocalStorageManualReset<number>('settings/hearing/vad-threshold', 0.6)
  const isTranscribing = ref(false)
  // Ephemeral cross-surface voice draft: page-level ambient loops (web/pocket
  // stage) park transcripts here when auto-send is off; the active composer
  // claims them into its input. Plain ref (not persisted): a reload kills any
  // live capture, so a carried draft would be stale.
  const pendingVoiceDraft = ref('')
  function appendVoiceDraft(text: string) {
    const addition = text.trim()
    if (!addition)
      return
    pendingVoiceDraft.value = pendingVoiceDraft.value ? `${pendingVoiceDraft.value} ${addition}` : addition
  }
  // Atomic claim: returns the draft and clears it so a second mounted composer
  // can't append the same utterance twice.
  function takeVoiceDraft() {
    const text = pendingVoiceDraft.value
    pendingVoiceDraft.value = ''
    return text
  }
  const speechProviderSettings = useLocalStorageManualReset<Record<string, { deviceId: string, sampleRate: number }>>('settings/hearing/speech-provider-settings', {
    'app-local-audio-speech': { deviceId: 'default', sampleRate: 16000 },
  })
  const transcriptionProviderSettings = useLocalStorageManualReset<Record<string, { deviceId: string, sampleRate: number }>>('settings/hearing/transcription-provider-settings', {
    'whisper-local': { deviceId: 'default', sampleRate: 16000 },
  })

  // Computed properties
  const availableProvidersMetadata = computed(() => allAudioTranscriptionProvidersMetadata.value)

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.getProviderMetadata(activeTranscriptionProvider.value)?.capabilities.listModels !== undefined
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeTranscriptionProvider.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeTranscriptionProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeTranscriptionProvider.value] || null
  })

  async function loadModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }

  async function getModelsForProvider(provider: string) {
    if (provider && providersStore.getProviderMetadata(provider)?.capabilities.listModels !== undefined) {
      return providersStore.getModelsForProvider(provider)
    }

    return []
  }

  const configured = computed(() => {
    if (!activeTranscriptionProvider.value)
      return false

    // Web Speech API doesn't strictly need a model selected (it has a default)
    // but we still check to maintain consistency
    if (activeTranscriptionProvider.value === 'browser-web-speech-api') {
      return true // Web Speech API is ready if provider is selected and available
    }

    // For OpenAI Compatible providers, check provider config as fallback
    let hasProviderModel = false
    if (activeTranscriptionProvider.value === 'openai-compatible-audio-transcription') {
      const providerConfig = providersStore.getProviderConfig(activeTranscriptionProvider.value)
      hasProviderModel = !!providerConfig?.model
    }

    return !!activeTranscriptionModel.value || hasProviderModel
  })

  function resetState() {
    activeTranscriptionProvider.reset()
    activeTranscriptionModel.reset()
    activeCustomModelName.reset()
    transcriptionModelSearchQuery.reset()
    autoSendEnabled.reset()
    autoSendDelay.reset()
    hearingDetectionMode.reset()
    tapToTalk.reset()
    micOwner.reset()
    voiceInputMode.reset()
    vadThreshold.reset()
    pendingVoiceDraft.value = ''
  }

  async function transcription(
    providerId: string,
    provider: TranscriptionProviderWithExtraOptions<string, any>,
    model: string,
    input: HearingTranscriptionInput,
    format?: 'json' | 'verbose_json',
    options?: HearingTranscriptionInvokeOptions,
  ): Promise<HearingTranscriptionResult> {
    const normalizedInput = (input instanceof File ? { file: input } : input ?? {}) as {
      file?: File
      inputAudioStream?: ReadableStream<ArrayBuffer>
    }
    console.info('[Hearing Store] transcription call received', {
      providerId,
      model,
      hasFile: !!normalizedInput.file,
      fileSize: normalizedInput.file?.size,
      hasStream: !!normalizedInput.inputAudioStream,
    })
    const features = providersStore.getTranscriptionFeatures(providerId)
    const streamExecutor = STREAM_TRANSCRIPTION_EXECUTORS[providerId]

    if (features.supportsStreamOutput && streamExecutor) {
      // TODO: integrate VAD-driven silence detection to stop and restart realtime sessions based on silence thresholds.
      const request = provider.transcription(model, options?.providerOptions)

      if (features.supportsStreamInput && normalizedInput.inputAudioStream) {
        const streamResult = streamExecutor({
          ...request,
          inputAudioStream: normalizedInput.inputAudioStream,
        } as Parameters<typeof streamExecutor>[0])
        return {
          mode: 'stream',
          ...streamResult,
        }
      }

      if (!features.supportsStreamInput && normalizedInput.file) {
        const streamResult = streamExecutor({
          ...request,
          file: normalizedInput.file,
        } as Parameters<typeof streamExecutor>[0])
        return {
          mode: 'stream',
          ...streamResult,
        }
      }

      if (features.supportsStreamInput && !normalizedInput.inputAudioStream && normalizedInput.file) {
        const streamResult = streamExecutor({
          ...request,
          file: normalizedInput.file,
        } as Parameters<typeof streamExecutor>[0])
        return {
          mode: 'stream',
          ...streamResult,
        }
      }

      if (!features.supportsGenerate || !normalizedInput.file) {
        throw new Error('No compatible input provided for streaming transcription.')
      }
    }

    if (!normalizedInput.file) {
      throw new Error('File input is required for transcription.')
    }

    if (providerId === 'deepgram-transcription') {
      const providerConfig = providersStore.getProviderConfig(providerId)
      let baseUrl = (providerConfig.baseUrl as string) || 'https://api.deepgram.com/v1/'

      if (baseUrl.includes('/openai')) {
        baseUrl = baseUrl.replace(/\/openai\/?$/, '')
        if (!baseUrl.endsWith('/'))
          baseUrl += '/'
      }

      const res = await fetch(`${baseUrl}listen?model=${model}&smart_format=true`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${providerConfig.apiKey}`,
          'Content-Type': normalizedInput.file.type || 'audio/webm',
        },
        body: await normalizedInput.file.arrayBuffer(),
        signal: options?.providerOptions?.abortSignal as AbortSignal | undefined,
      })

      if (!res.ok) {
        throw new Error(`Deepgram API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json()
      const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''

      console.info('[Hearing Store] Deepgram native response received', {
        text: text.substring(0, 50),
      })

      return {
        mode: 'generate',
        text,
        raw: data,
      } as any
    }

    const response = await generateTranscription({
      ...provider.transcription(model, options?.providerOptions),
      file: normalizedInput.file,
      responseFormat: format,
    })

    console.info('[Hearing Store] generateTranscription response received', {
      text: response.text?.substring(0, 50),
    })

    return {
      mode: 'generate',
      ...response,
    }
  }

  // Watch for provider changes and load models
  watch(activeTranscriptionProvider, async (newProvider) => {
    if (newProvider) {
      await loadModelsForProvider(newProvider)
    }
  }, { immediate: true })
  // Self-healing: Reset active provider if it no longer exists
  watch(activeTranscriptionProvider, () => {
    // Bypass self-healing during onboarding
    if (onboardingStore.needsOnboarding)
      return

    if (Object.keys(providersStore.providerMetadata).length > 0 && activeTranscriptionProvider.value) {
      const baseId = activeTranscriptionProvider.value.includes(':') ? activeTranscriptionProvider.value.split(':')[0] : activeTranscriptionProvider.value
      if (!providersStore.providerMetadata[baseId]) {
        console.warn(`[Hearing] Provider ${activeTranscriptionProvider.value} no longer exists. Resetting.`)
        activeTranscriptionProvider.value = ''
        activeTranscriptionModel.value = ''
        activeCustomModelName.value = ''
      }
    }
  }, { immediate: true })

  return {
    activeTranscriptionProvider,
    activeTranscriptionModel,
    availableProvidersMetadata,
    activeCustomModelName,
    transcriptionModelSearchQuery,
    autoSendEnabled,
    autoSendDelay,
    hearingDetectionMode,
    tapToTalk,
    micOwner,
    voiceInputMode,
    vadThreshold,
    isTranscribing,
    pendingVoiceDraft,
    appendVoiceDraft,
    takeVoiceDraft,

    supportsModelListing,
    providerModels,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    configured,

    transcription,
    loadModelsForProvider,
    getModelsForProvider,
    resetState,

    speechProviderSettings,
    transcriptionProviderSettings,
  }
})
