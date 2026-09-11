<script setup lang="ts">
import type { MicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'

import type { ProviderMetadata } from '../../../../../../stores/providers'
import type { ProgressPayload } from '../../v2/whisper-loader'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { electronGetMicToggleHotkey, electronSetMicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'
import { useAudioAnalyzer, useAudioRecorder } from '@proj-airi/stage-ui/composables'
import { Button, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import LevelMeter from '../../../../../gadgets/level-meter.vue'
import RadioCardDetail from '../../../../../menu/radio-card-detail.vue'
import RadioCardSimple from '../../../../../menu/radio-card-simple.vue'
import StepProviderConfiguration from '../../step-provider-configuration.vue'

import { getWhisperAdapter } from '../../../../../../libs/inference/adapters/whisper'
import { WHISPER_MODELS } from '../../../../../../libs/inference/constants'
import { useAudioContext } from '../../../../../../stores/audio'
import { useHearingSpeechInputPipeline } from '../../../../../../stores/modules/hearing'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useSettingsAudioDevice } from '../../../../../../stores/settings'
import { ensureWhisperLoaded } from '../../v2/whisper-loader'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

// --- Stores & Draft ---
const draft = useOnboardingV3Draft()
const providersStore = useProvidersStore()
const audioDevice = useSettingsAudioDevice()
const hearingPipeline = useHearingSpeechInputPipeline()

const { allAudioTranscriptionProvidersMetadata, configuredTranscriptionProvidersMetadata } = storeToRefs(providersStore)
const { audioInputs, selectedAudioInput, stream } = storeToRefs(audioDevice)
const { startStream, stopStream } = audioDevice
const { transcribeForMediaStream, transcribeForRecording, stopStreamingTranscription } = hearingPipeline
const { audioContext } = storeToRefs(useAudioContext())

const { startRecord, stopRecord, onStopRecord } = useAudioRecorder(stream)
const { startAnalyzer, stopAnalyzer, volumeLevel } = useAudioAnalyzer()

// --- Verification State ---
type Verification = 'idle' | 'listening' | 'transcribed' | 'verified'
const verification = ref<Verification>('idle')
const transcribedText = ref('')
const testStreamingText = ref('')
const isVerified = computed(() => verification.value === 'verified' || transcribedText.value.trim().length > 0 || testStreamingText.value.trim().length > 0)

// --- Mic Device Options ---
const micOptions = computed(() => audioInputs.value.map(d => ({ label: d.label || d.deviceId, value: d.deviceId })))

// --- Whisper WebGPU Management ---
type WhisperDL = 'idle' | 'downloading' | 'ready' | 'error'
const whisperDownloadState = ref<WhisperDL>('idle')
const whisperProgress = ref(0)
const whisperAbort = ref<AbortController>()
const whisperErrorMessage = ref('')
const whisperPhaseMessage = ref('Downloading model shards into local cache…')

const isTamagotchi = isStageTamagotchi()
const availableWhisperModels = computed(() => {
  if (isTamagotchi)
    return WHISPER_MODELS
  // On mobile/browser WASM platforms, hide Large models prone to OOM / heap aborts
  return WHISPER_MODELS.filter(m => !m.id.includes('large'))
})

const DEFAULT_ONBOARDING_WHISPER_MODEL = 'onnx-community/whisper-tiny'
const initialWhisperModel = draft.state.sttModel && (isTamagotchi || !draft.state.sttModel.includes('large'))
  ? draft.state.sttModel
  : DEFAULT_ONBOARDING_WHISPER_MODEL
const selectedWhisperModel = ref<string>(initialWhisperModel)

function isLocalWhisperProvider(providerId?: string) {
  return providerId === 'whisper-local'
}

const isWhisperSelected = computed(() => isLocalWhisperProvider(draft.state.sttProvider))
const isWebSpeechSelected = computed(() => draft.state.sttProvider === 'browser-web-speech-api')

const heroProviderIds = ['browser-web-speech-api', 'whisper-local']
const cloudProviders = computed(() => {
  return allAudioTranscriptionProvidersMetadata.value.filter(p => !heroProviderIds.includes(p.id))
})

const selectedModelInfo = computed(() => {
  return availableWhisperModels.value.find(m => m.id === selectedWhisperModel.value)
    || availableWhisperModels.value[0]
    || WHISPER_MODELS[0]
})

function formatMB(bytes?: number) {
  if (!bytes)
    return ''
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

function getWhisperModelSpec(id: string) {
  const m = WHISPER_MODELS.find(item => item.id === id)
  if (m)
    return `${formatMB(m.downloadBytes)} DL · ${formatMB(m.vramBytes)} VRAM`
  return '~800 MB DL · ~3 GB VRAM'
}

function selectWebSpeech() {
  draft.setHearing({ provider: 'browser-web-speech-api', model: 'web-speech-api' })
  verification.value = 'idle'
  whisperDownloadState.value = 'idle'
}

function selectLocalWhisper() {
  draft.setHearing({ provider: 'whisper-local', model: selectedWhisperModel.value })
  verification.value = 'idle'
  if (whisperDownloadState.value === 'idle') {
    void startWhisperDownload()
  }
}

function onSelectCloudProvider(provider: ProviderMetadata) {
  draft.setHearing({ provider: provider.id, model: '' })
  verification.value = 'idle'
  whisperDownloadState.value = 'idle'
}

function cancelWhisperDownload() {
  whisperAbort.value?.abort()
  whisperDownloadState.value = 'idle'
  whisperProgress.value = 0
}

async function startWhisperDownload(force = false) {
  whisperAbort.value?.abort()
  const controller = new AbortController()
  whisperAbort.value = controller
  whisperDownloadState.value = 'downloading'
  whisperProgress.value = 0
  whisperErrorMessage.value = ''
  whisperPhaseMessage.value = 'Downloading model shards into local cache…'

  const shardMap = new Map<string, { loaded: number, total: number }>()
  const expectedTotalBytes = selectedModelInfo.value?.downloadBytes || (800 * 1024 * 1024)

  try {
    await ensureWhisperLoaded({
      model: selectedWhisperModel.value,
      signal: controller.signal,
      force,
      onProgress: (p: ProgressPayload) => {
        if (p.phase === 'warmup' || (p.message && p.message.includes('warm'))) {
          whisperPhaseMessage.value = p.message || 'Compiling WebGPU shaders and warming up model…'
          whisperProgress.value = 100
        }
        else if (p.file) {
          shardMap.set(p.file, {
            loaded: p.loaded || 0,
            total: p.total || 0,
          })
          let sumLoaded = 0
          for (const s of shardMap.values()) {
            sumLoaded += s.loaded
          }
          if (expectedTotalBytes > 0) {
            const calculated = Math.min(99, Math.round((sumLoaded / expectedTotalBytes) * 100))
            whisperProgress.value = Math.max(whisperProgress.value, calculated)
          }
          else if (typeof p.percent === 'number' && p.percent >= 0) {
            whisperProgress.value = Math.min(99, Math.max(whisperProgress.value, Math.round(p.percent)))
          }
        }
        else if (typeof p.percent === 'number' && p.percent >= 0) {
          whisperProgress.value = Math.min(99, Math.max(whisperProgress.value, Math.round(p.percent)))
        }
      },
    })
    if (!controller.signal.aborted) {
      whisperProgress.value = 100
      whisperDownloadState.value = 'ready'
    }
  }
  catch (err) {
    if (!controller.signal.aborted) {
      whisperDownloadState.value = 'error'
      const rawMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      const msg = rawMsg.includes('Aborted()') || rawMsg.includes('assertions')
        ? 'Model allocation failed (Out of Memory). Please choose a lighter shard like Whisper Tiny.'
        : rawMsg
      whisperErrorMessage.value = msg
      console.error('[V3 Hearing] Whisper download failed:', msg, err)
    }
  }
}

watch(selectedWhisperModel, async (newModel) => {
  if (isWhisperSelected.value) {
    draft.setHearing({ provider: 'whisper-local', model: newModel })
    try {
      const adapter = await getWhisperAdapter()
      if (adapter.state === 'ready' && adapter.manifest?.model === newModel) {
        whisperDownloadState.value = 'ready'
        whisperProgress.value = 100
      }
      else {
        whisperDownloadState.value = 'idle'
        whisperProgress.value = 0
      }
    }
    catch {
      whisperDownloadState.value = 'idle'
    }
  }
})

// --- Cloud STT Filters & Selection ---
const deploymentFilter = ref<'all' | 'local' | 'cloud'>('all')
const pricingFilter = ref<'all' | 'free' | 'paid'>('all')

const filteredCloudProviders = computed(() => {
  return cloudProviders.value
    .filter((p) => {
      const matchDeployment = deploymentFilter.value === 'all' || p.deployment === deploymentFilter.value
      const matchPricing = pricingFilter.value === 'all' || p.pricing === pricingFilter.value
      return matchDeployment && matchPricing
    })
    .slice()
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
})

const selectedCloudProviderId = computed({
  get: () => (!isWhisperSelected.value && !isWebSpeechSelected.value ? draft.state.sttProvider || '' : ''),
  set: (id: string) => {
    const p = cloudProviders.value.find(item => item.id === id)
    if (p)
      onSelectCloudProvider(p)
  },
})

// --- Inline Cloud Configuration ---
const inlineConfigProvider = computed(() => {
  if (!selectedCloudProviderId.value)
    return null
  const meta = allAudioTranscriptionProvidersMetadata.value.find(p => p.id === selectedCloudProviderId.value)
  if (!meta || meta.requiresCredentials === false)
    return null
  return meta
})

const showInlineConfig = computed(() => {
  return !!inlineConfigProvider.value && !configuredTranscriptionProvidersMetadata.value.some(p => p.id === inlineConfigProvider.value!.id)
})

function handleConfigured(config?: Record<string, unknown>) {
  if (selectedCloudProviderId.value && config) {
    providersStore.providers[selectedCloudProviderId.value] = {
      ...providersStore.providers[selectedCloudProviderId.value],
      ...config,
    }
    providersStore.markProviderAdded(selectedCloudProviderId.value)
    toast.success(`${inlineConfigProvider.value?.name || 'Provider'} connected!`)
  }
}

function handleCancelConfig() {
  selectWebSpeech()
}

// --- Cloud Model Picker ---
const providerModels = computed(() => {
  if (!selectedCloudProviderId.value)
    return []
  return providersStore.getModelsForProvider(selectedCloudProviderId.value)
})

const activeCloudModel = computed({
  get: () => draft.state.sttModel || '',
  set: (val: string) => {
    draft.setHearing({ model: val })
  },
})

// --- Push-to-Talk (Desktop Electron Only) ---
const isElectron = typeof window !== 'undefined' && !!(window as any).electron
const getHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronGetMicToggleHotkey) : null
const setHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronSetMicToggleHotkey) : null

const selectedHotkey = computed<MicToggleHotkey>({
  get: () => (draft.state.sttTriggerKey as MicToggleHotkey) || 'Caps',
  set: (key: MicToggleHotkey) => {
    draft.setHearing({ triggerKey: key })
    if (isElectron) {
      void setHotkeyInvoke?.(key)
    }
  },
})

const lastPressAt = ref(0)
let pressFlashTimer: ReturnType<typeof setTimeout> | undefined

const hotkeyOptions: { id: MicToggleHotkey, label: string }[] = [
  { id: 'Scroll', label: 'Scroll Lock' },
  { id: 'Caps', label: 'Caps Lock' },
  { id: 'Num', label: 'Num Lock' },
]

// --- Live Audio Test & Level Meter ---
const isTesting = ref(false)
const testStatusMessage = ref('')
const testError = ref('')
const testStreamWasStarted = ref(false)

const supportsStreamInput = computed(() => {
  const providerId = draft.state.sttProvider
  if (!providerId)
    return false
  if (providerId === 'browser-web-speech-api') {
    return typeof window !== 'undefined'
      && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  }
  return providersStore.getTranscriptionFeatures(providerId).supportsStreamInput
})

const canStartTest = computed(() => {
  if (!draft.state.sttProvider)
    return false
  if (isWhisperSelected.value && whisperDownloadState.value !== 'ready')
    return false
  return true
})

watch([transcribedText, testStreamingText], ([text, streaming]) => {
  if (text.trim() || streaming.trim())
    verification.value = 'verified'
})

async function setupMonitoring() {
  await stopMonitoring()
  await startStream()
  if (!stream.value || !audioContext.value)
    return
  const source = audioContext.value.createMediaStreamSource(stream.value)
  const analyzer = startAnalyzer(audioContext.value)
  if (analyzer)
    source.connect(analyzer)
}

async function stopMonitoring() {
  stopAnalyzer()
  if (stream.value)
    stopStream()
}

async function startTest() {
  testError.value = ''
  testStreamingText.value = ''
  transcribedText.value = ''
  verification.value = 'idle'
  isTesting.value = true

  try {
    if (!stream.value) {
      testStreamWasStarted.value = true
      testStatusMessage.value = 'Starting audio stream...'
      await startStream()
      testStatusMessage.value = ''
    }

    if (!stream.value)
      throw new Error('Microphone stream unavailable. Check permissions.')

    verification.value = 'listening'

    if (supportsStreamInput.value && stream.value) {
      testStatusMessage.value = 'Listening for speech...'
      await transcribeForMediaStream(stream.value, {
        providerId: draft.state.sttProvider,
        model: draft.state.sttModel,
        onSentenceEnd: (delta) => {
          if (delta?.trim()) {
            testStreamingText.value = delta.trim()
            if (verification.value === 'listening')
              verification.value = 'transcribed'
          }
        },
        onSpeechEnd: (text) => {
          if (text) {
            transcribedText.value = text
            testStreamingText.value = ''
            testStatusMessage.value = 'Transcription received.'
          }
        },
        onError: (errMsg) => {
          testError.value = errMsg
          verification.value = 'idle'
          testStatusMessage.value = ''
          isTesting.value = false
        },
      })
    }
    else {
      testStatusMessage.value = 'Recording 3 seconds...'
      await startRecord()
      setTimeout(async () => {
        await stopRecord()
        testStatusMessage.value = 'Transcribing...'
      }, 3000)
    }
  }
  catch (err) {
    testError.value = err instanceof Error ? err.message : String(err)
    verification.value = 'idle'
    testStatusMessage.value = ''
    isTesting.value = false
  }
}

onStopRecord(async (recording) => {
  if (!recording || recording.size === 0)
    return
  try {
    const result = await transcribeForRecording(recording, {
      providerId: draft.state.sttProvider,
      model: draft.state.sttModel,
    })
    if (result)
      transcribedText.value = result
    else
      testError.value = 'No transcription returned from provider. Please check microphone input volume and model status.'
  }
  catch (err) {
    testError.value = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('[V3 Hearing] Recording transcription error:', err)
  }
  finally {
    testStatusMessage.value = ''
    isTesting.value = false
  }
})

async function stopTest() {
  isTesting.value = false
  testStatusMessage.value = ''
  if (supportsStreamInput.value)
    await stopStreamingTranscription(true, draft.state.sttProvider)
  else
    await stopRecord()
  if (testStreamWasStarted.value && !isTesting.value) {
    stopStream()
    testStreamWasStarted.value = false
  }
}

onBeforeUnmount(async () => {
  clearTimeout(pressFlashTimer)
  whisperAbort.value?.abort()
  if (isTesting.value)
    await stopTest()
  await stopMonitoring()
})

onMounted(() => {
  void (async () => {
    try {
      const adapter = await getWhisperAdapter()
      if (adapter.state === 'ready') {
        if (adapter.manifest?.model) {
          selectedWhisperModel.value = adapter.manifest.model
          if (isWhisperSelected.value) {
            draft.setHearing({ model: adapter.manifest.model })
          }
        }
        whisperDownloadState.value = 'ready'
        whisperProgress.value = 100
      }
    }
    catch (err) {
      console.debug('[V3 Hearing] Whisper probe on mount:', err)
    }
  })()

  if (isElectron) {
    void (async () => {
      const hotkey = await getHotkeyInvoke?.()
      if (hotkey)
        draft.setHearing({ triggerKey: hotkey })
      ;(window as any).electron?.ipcRenderer?.on('toggle-mic-from-shortcut', () => {
        lastPressAt.value = Date.now()
        clearTimeout(pressFlashTimer)
        pressFlashTimer = setTimeout(() => (lastPressAt.value = 0), 1600)
      })
    })()
  }

  if (audioInputs.value.length === 0) {
    void startStream().then(() => {
      stopStream()
      if (!selectedAudioInput.value && audioInputs.value.length > 0) {
        selectedAudioInput.value = audioInputs.value[0].deviceId
      }
    })
  }
  else if (!selectedAudioInput.value && audioInputs.value.length > 0) {
    selectedAudioInput.value = audioInputs.value[0].deviceId
  }
  void setupMonitoring()
})

watch(audioInputs, (inputs) => {
  if (!selectedAudioInput.value && inputs.length > 0) {
    selectedAudioInput.value = inputs[0].deviceId
  }
}, { immediate: true })

watch(selectedAudioInput, async () => {
  if (isTesting.value)
    return
  await setupMonitoring()
})
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Step Subtitle & Header -->
      <div :class="['flex items-center justify-between text-xs text-neutral-400 font-medium']">
        <span>Hearing</span>
        <span>Step 8 of 16 • Voice Transcription (STT)</span>
      </div>

      <div class="flex-shrink-0">
        <h2 class="text-xl text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
          Hearing & Mic Playground
        </h2>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Zero dependencies on character or persona — verify your ear works before anything else.
        </p>
      </div>

      <!-- Blue Companion Alert Bubble -->
      <div :class="['flex items-center gap-3 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 text-xs backdrop-blur-md']">
        <div :class="['h-8 w-8 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-sky-500/30']">
          <div :class="['i-solar:chat-round-dots-bold text-base']" />
        </div>
        <p :class="['leading-relaxed font-medium']">
          Pick a speech engine below, then talk to me! The big button unlocks as soon as I actually hear you — no mock progress bars here.
        </p>
      </div>

      <!-- Microphone Device Picker (Auto-hides if <= 1 device) -->
      <div
        v-if="audioInputs.length > 1"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']"
      >
        <FieldSelect
          v-model="selectedAudioInput"
          label="Microphone"
          description="Choose the input device to verify."
          :options="micOptions"
          placeholder="Select an audio input device"
          layout="vertical"
        />
      </div>

      <!-- Choose Speech Engine: Hero Cards -->
      <div class="flex flex-col gap-2.5">
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
          Choose a Speech Engine
        </span>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- Hero Card 1: Web Speech API -->
          <div
            :class="[
              'relative flex flex-col justify-between p-4 rounded-2xl cursor-pointer border transition-all duration-200',
              'backdrop-blur-md',
              isWebSpeechSelected
                ? 'border-primary-500 bg-primary-500/10 shadow-sm shadow-primary-500/10 ring-2 ring-primary-500/30'
                : 'border-neutral-200/60 dark:border-neutral-800/80 bg-white/50 dark:bg-neutral-900/50 hover:border-primary-400/50 hover:bg-white/80 dark:hover:bg-neutral-900/80',
            ]"
            @click="selectWebSpeech"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'h-10 w-10 flex items-center justify-center rounded-xl transition-colors',
                    isWebSpeechSelected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                  ]"
                >
                  <div class="i-solar:microphone-3-bold-duotone h-5 w-5" />
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">Web Speech API</span>
                    <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                      Built-in
                    </span>
                  </div>
                  <span class="text-xs text-neutral-500 dark:text-neutral-400">Zero Setup · Realtime Streaming</span>
                </div>
              </div>
              <div
                v-if="isWebSpeechSelected"
                class="i-solar:check-circle-bold-duotone h-5 w-5 flex-shrink-0 text-primary-500"
              />
            </div>
            <p class="mt-3 text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
              Uses your browser & OS speech recognition engine. Instant streaming transcription with zero downloads and zero API keys.
            </p>
          </div>

          <!-- Hero Card 2: App (Local) Whisper -->
          <div
            :class="[
              'relative flex flex-col justify-between p-4 rounded-2xl cursor-pointer border transition-all duration-200',
              'backdrop-blur-md',
              isWhisperSelected
                ? 'border-primary-500 bg-primary-500/10 shadow-sm shadow-primary-500/10 ring-2 ring-primary-500/30'
                : 'border-neutral-200/60 dark:border-neutral-800/80 bg-white/50 dark:bg-neutral-900/50 hover:border-primary-400/50 hover:bg-white/80 dark:hover:bg-neutral-900/80',
            ]"
            @click="selectLocalWhisper"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  :class="[
                    'h-10 w-10 flex items-center justify-center rounded-xl transition-colors',
                    isWhisperSelected ? 'bg-primary-500 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                  ]"
                >
                  <div class="i-solar:cpu-bolt-bold-duotone h-5 w-5" />
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">App (Local) Whisper</span>
                    <span class="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-600 font-medium dark:text-purple-400">
                      WebGPU Offline
                    </span>
                  </div>
                  <span class="text-xs text-neutral-500 dark:text-neutral-400">100% Private · On-Device</span>
                </div>
              </div>
              <div
                v-if="isWhisperSelected"
                class="i-solar:check-circle-bold-duotone h-5 w-5 flex-shrink-0 text-primary-500"
              />
            </div>
            <p class="mt-3 text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
              Runs OpenAI Whisper locally in your browser/app. Complete offline privacy with zero telemetry.
            </p>
          </div>
        </div>
      </div>

      <!-- Whisper WebGPU Model Shard & In-Context Download Panel -->
      <div
        v-if="isWhisperSelected"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3.5']"
      >
        <div class="flex flex-col gap-1">
          <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">Whisper WebGPU Model</span>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Larger models offer higher accuracy; smaller models download faster with less VRAM.
          </p>
        </div>

        <div class="flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <div class="flex-1">
            <FieldSelect
              v-model="selectedWhisperModel"
              label="Model Shard"
              :options="availableWhisperModels.map(m => ({ label: `${m.name} (${getWhisperModelSpec(m.id)})`, value: m.id }))"
              layout="vertical"
              :disabled="whisperDownloadState === 'downloading'"
            />
          </div>
          <div class="flex flex-shrink-0 items-center gap-2">
            <Button
              v-if="whisperDownloadState === 'idle'"
              variant="primary"
              class="h-[38px] flex items-center gap-1.5 px-4 font-medium"
              @click="startWhisperDownload"
            >
              <div class="i-solar:cloud-download-bold-duotone text-base" />
              <span>Download Model</span>
            </Button>

            <Button
              v-else-if="whisperDownloadState === 'downloading'"
              variant="secondary"
              class="h-[38px] flex items-center gap-1.5 px-4 text-xs font-medium"
              @click="cancelWhisperDownload"
            >
              <div class="i-solar:close-circle-bold-duotone text-base" />
              <span>Cancel</span>
            </Button>

            <Button
              v-else-if="whisperDownloadState === 'ready'"
              variant="secondary"
              class="h-[38px] flex items-center gap-1.5 px-3.5 text-xs font-medium"
              @click="startWhisperDownload(true)"
            >
              <div class="i-solar:refresh-circle-bold-duotone text-base" />
              <span>Re-download</span>
            </Button>

            <Button
              v-else-if="whisperDownloadState === 'error'"
              variant="primary"
              class="h-[38px] flex items-center gap-1.5 px-4 font-medium"
              @click="startWhisperDownload(true)"
            >
              <div class="i-solar:restart-bold-duotone text-base" />
              <span>Retry Download</span>
            </Button>
          </div>
        </div>

        <!-- Download Progress Display -->
        <div v-if="whisperDownloadState === 'downloading'" class="flex flex-col gap-2 border border-primary-500/20 rounded-xl bg-primary-500/5 p-3">
          <div class="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
            <div class="flex items-center gap-1.5">
              <div class="i-solar:cloud-download-bold-duotone animate-pulse text-primary-500" />
              <span>{{ whisperPhaseMessage }}</span>
            </div>
            <span class="font-medium font-mono">
              {{ Math.floor(whisperProgress) }}%
              <template v-if="whisperProgress > 0"> ({{ formatMB((whisperProgress / 100) * selectedModelInfo.downloadBytes) }} / {{ formatMB(selectedModelInfo.downloadBytes) }})</template>
            </span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${whisperProgress}%` }" />
          </div>
        </div>

        <!-- Ready Status -->
        <div v-else-if="whisperDownloadState === 'ready'" class="flex items-center gap-2 border border-emerald-500/20 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 font-medium dark:text-emerald-300">
          <div class="i-solar:check-circle-bold-duotone h-4 w-4 flex-shrink-0 text-emerald-500" />
          <span>Whisper model shard is cached & resident in memory — ready to transcribe.</span>
        </div>

        <!-- Error Status -->
        <div v-else-if="whisperDownloadState === 'error'" class="flex flex-col gap-1 border border-red-500/20 rounded-xl bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          <div class="flex items-center gap-2 font-bold">
            <div class="i-solar:danger-circle-bold-duotone h-4 w-4 text-red-500" />
            <span>Download failed or connection interrupted.</span>
          </div>
          <span v-if="whisperErrorMessage" class="break-all text-[11px] text-red-600/80 dark:text-red-400/80">
            {{ whisperErrorMessage }}
          </span>
        </div>
      </div>

      <!-- Cloud & Remote Engines (API Key Required) -->
      <div
        v-if="cloudProviders.length > 0"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
            Cloud & Remote Engines (API Key Required)
          </span>
          <span class="text-[11px] text-neutral-400">Optional</span>
        </div>

        <!-- Deployment / Pricing Filter Pills -->
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">Deployment</span>
            <div class="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              <button
                v-for="opt in [
                  { label: 'All', value: 'all' },
                  { label: 'Cloud', value: 'cloud' },
                  { label: 'Local', value: 'local' },
                ]"
                :key="opt.value"
                type="button"
                class="cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-all"
                :class="[
                  deploymentFilter === opt.value
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="deploymentFilter = opt.value as any"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs text-neutral-500 font-medium tracking-wider uppercase dark:text-neutral-400">Pricing</span>
            <div class="flex items-center gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              <button
                v-for="opt in [
                  { label: 'All', value: 'all' },
                  { label: 'Free', value: 'free' },
                  { label: 'Paid', value: 'paid' },
                ]"
                :key="opt.value"
                type="button"
                class="cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-all"
                :class="[
                  pricingFilter === opt.value
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="pricingFilter = opt.value as any"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Cloud Providers Grid -->
        <div v-if="filteredCloudProviders.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RadioCardDetail
            v-for="provider in filteredCloudProviders"
            :id="provider.id"
            :key="provider.id"
            v-model="selectedCloudProviderId"
            name="onboarding-v3-stt-provider"
            :value="provider.id"
            :title="provider.localizedName || provider.name || provider.id"
            :description="provider.localizedDescription || provider.description || ''"
            :pricing="provider.pricing"
            :deployment="provider.deployment"
            :beginner-recommended="provider.beginnerRecommended"
          />
        </div>
      </div>

      <!-- Inline Cloud Credential Configuration -->
      <div
        v-if="showInlineConfig && inlineConfigProvider"
        :class="['border border-dashed border-amber-300/60 rounded-xl', 'bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/60', 'backdrop-blur-md']"
      >
        <StepProviderConfiguration
          :selected-provider-id="inlineConfigProvider.id"
          :selected-provider="inlineConfigProvider"
          :on-next="handleConfigured"
          :on-previous="handleCancelConfig"
        />
      </div>

      <!-- Cloud Model Sub-Picker Dropdown -->
      <div
        v-if="!isWhisperSelected && !isWebSpeechSelected && providerModels.length > 0"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']"
      >
        <FieldSelect
          v-model="activeCloudModel"
          label="Model"
          :options="providerModels.map((m: any) => ({ label: m.name || m.id, value: m.id }))"
          placeholder="Select a transcription model"
          layout="vertical"
        />
      </div>

      <!-- Push-to-Talk Trigger Key (Desktop Electron Only) -->
      <div
        v-if="isElectron"
        :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']"
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
              Push-to-Talk Trigger Key
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Pick a lock key to toggle the microphone hands-free.
            </p>
          </div>
          <span
            v-if="lastPressAt"
            class="flex animate-pulse items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
          >
            <div class="i-solar:check-circle-bold-duotone h-3.5 w-3.5" />
            Key detected
          </span>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <RadioCardSimple
            v-for="opt in hotkeyOptions"
            :id="`onboarding-v3-hotkey-${opt.id}`"
            :key="opt.id"
            v-model="selectedHotkey"
            name="onboarding-v3-hotkey"
            :value="opt.id"
            :title="opt.label"
          />
        </div>
      </div>

      <!-- Live Transcription Test -->
      <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-4']">
        <div class="flex items-center justify-between">
          <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">Live Transcription Test</span>
          <span
            v-if="isVerified"
            class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-600 font-bold dark:text-emerald-400"
          >
            <div class="i-solar:verified-check-bold-duotone h-4 w-4" />
            Verified Working
          </span>
        </div>

        <LevelMeter :level="volumeLevel" label="Input Level" />

        <div v-if="testStatusMessage" class="flex items-center gap-2 border border-primary-200 rounded-lg bg-primary-50 p-3 text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">
          <div v-if="isTesting" class="i-solar:spinner-line-duotone animate-spin text-sm" />
          <div v-else class="i-solar:info-circle-line-duotone text-sm" />
          <span class="text-sm font-medium">{{ testStatusMessage }}</span>
        </div>

        <button
          type="button"
          class="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm text-white font-semibold shadow-lg shadow-primary-500/25 transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
          :disabled="!canStartTest && !isTesting"
          @click="isTesting ? stopTest() : startTest()"
        >
          <div :class="isTesting ? 'i-solar:stop-circle-bold-duotone' : 'i-solar:microphone-3-bold-duotone'" class="h-4 w-4" />
          {{ isTesting ? 'Stop Test' : 'Start Speaking Test' }}
        </button>

        <div v-if="testError" class="border border-red-200 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {{ testError }}
        </div>

        <!-- Real-time Transcription Stream Result -->
        <div
          class="min-h-[96px] border rounded-lg p-3 text-sm"
          :class="transcribedText || testStreamingText ? 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900' : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-500'"
        >
          <template v-if="testStreamingText && supportsStreamInput">
            <div class="mb-1 text-xs text-neutral-400 font-medium">
              Hearing you…
            </div>
            <div class="whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
              {{ testStreamingText }}
            </div>
          </template>
          <template v-if="transcribedText">
            <div class="mb-1 text-xs text-emerald-600 font-bold dark:text-emerald-400" :class="{ 'mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-700': testStreamingText && supportsStreamInput }">
              Final transcription:
            </div>
            <div class="whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">
              {{ transcribedText }}
            </div>
          </template>
          <span v-if="!transcribedText && !testStreamingText">No transcription yet. Start the test and speak into your microphone.</span>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2 mt-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Persona</span>
      </button>

      <!-- Center Status Hint -->
      <div :class="['text-[11px] text-neutral-400 font-medium italic hidden sm:block text-center truncate max-w-sm']">
        <span v-if="isVerified" class="text-emerald-500 font-semibold not-italic dark:text-emerald-400">
          Ear verified! Ready to proceed.
        </span>
        <span v-else>
          Speak into your microphone — Next unlocks once we hear you.
        </span>
      </div>

      <!-- Action Group: Skip Step + Next -->
      <div :class="['flex items-center gap-3']">
        <button
          type="button"
          :class="[
            'px-3.5 py-2 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
            'hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer',
          ]"
          @click="props.onNext"
        >
          Skip Step
        </button>

        <Button
          variant="primary"
          size="md"
          :disabled="!isVerified"
          :class="[
            'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
            'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
            !isVerified ? 'opacity-40 cursor-not-allowed hover:bg-primary-600' : '',
          ]"
          @click="props.onNext"
        >
          <span>Next: Speech (TTS)</span>
          <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
