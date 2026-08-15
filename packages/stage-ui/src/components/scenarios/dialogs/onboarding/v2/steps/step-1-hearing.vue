<script setup lang="ts">
import type { ProgressPayload } from '../../../../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { useAudioAnalyzer, useAudioRecorder } from '@proj-airi/stage-ui/composables'
import { Button, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import StepProviderConfiguration from '../../step-provider-configuration.vue'
import CompanionBubble from '../components/companion-bubble.vue'
import LockKeyPicker from '../components/lock-key-picker.vue'
import SttProviderPicker from '../components/provider-picker-grid.vue'
import SttTestBox from '../components/stt-test-box.vue'

import { WHISPER_MODELS } from '../../../../../../libs/inference/constants'
import { useAudioContext } from '../../../../../../stores/audio'
import { useHearingSpeechInputPipeline, useHearingStore } from '../../../../../../stores/modules/hearing'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useSettingsAudioDevice } from '../../../../../../stores/settings'
import { useOnboardingV2Draft } from '../draft-store'
import { onboardingV2GateKey } from '../gate'
import { ensureWhisperLoaded } from '../whisper-loader'

// V2 onboarding — Step 1: Hearing / STT Playground.
// Real implementation: provider matrix, in-context Whisper download, lock-key
// hotkey, and an empirical verification gate. Wire-up of heavy WebWorker RPC is
// exercised here (Whisper load), but navigation gating stays a UI concern.

type Verification = 'idle' | 'listening' | 'transcribed' | 'verified'

// --- Stores ---
const hearingStore = useHearingStore()
const providersStore = useProvidersStore()
const audioDevice = useSettingsAudioDevice()
const hearingPipeline = useHearingSpeechInputPipeline()
const draft = useOnboardingV2Draft()

// Principle 6 (Option A): snapshot the persisted STT selection on mount so the
// live test can temporarily drive the pipeline, then restore on unmount. The
// authoritative choice lands in `draft.hearing`; the global store is committed
// only at Step 7.
const snapshotProvider = hearingStore.activeTranscriptionProvider
const snapshotModel = hearingStore.activeTranscriptionModel

const { activeTranscriptionProvider, activeTranscriptionModel } = storeToRefs(hearingStore)
const { allAudioTranscriptionProvidersMetadata, configuredTranscriptionProvidersMetadata } = storeToRefs(providersStore)
const { audioInputs, selectedAudioInput, stream } = storeToRefs(audioDevice)
const { startStream, stopStream } = audioDevice
const { transcribeForMediaStream, transcribeForRecording, stopStreamingTranscription } = hearingPipeline
const { supportsStreamInput } = storeToRefs(hearingPipeline)
const { audioContext } = storeToRefs(useAudioContext())

const { startRecord, stopRecord, onStopRecord } = useAudioRecorder(stream)
const { startAnalyzer, stopAnalyzer, volumeLevel } = useAudioAnalyzer()

// --- Verification state machine ---
const verification = ref<Verification>('idle')
const isVerified = computed(() => verification.value === 'verified' || transcribedText.value.trim().length > 0 || testStreamingText.value.trim().length > 0)

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('hearing', {
    canProceed: computed(() => isVerified.value),
    skipLabel: 'Skip Step',
    hint: 'Speak into your microphone — Next unlocks once we hear you.',
  })
})
onBeforeUnmount(() => gate?.clearGate('hearing'))

// --- Mic device + level ---
const micOptions = computed(() => audioInputs.value.map(d => ({ label: d.label || d.deviceId, value: d.deviceId })))

// --- Whisper in-context download ---
type WhisperDL = 'idle' | 'downloading' | 'ready' | 'error'
const whisperDownloadState = ref<WhisperDL>('idle')
const whisperProgress = ref(0)
const whisperAbort = ref<AbortController>()
const selectedWhisperModel = ref<string>(WHISPER_MODELS[0].id)

function isLocalWhisperProvider(providerId?: string) {
  return providerId === 'app-local-audio-transcription' || providerId === 'browser-local-audio-transcription'
}

const isWhisperSelected = computed(() => isLocalWhisperProvider(activeTranscriptionProvider.value))
const isWebSpeechSelected = computed(() => activeTranscriptionProvider.value === 'browser-web-speech-api')

const heroProviderIds = ['browser-web-speech-api', 'app-local-audio-transcription', 'browser-local-audio-transcription']

const cloudProviders = computed(() => {
  return allAudioTranscriptionProvidersMetadata.value.filter(p => !heroProviderIds.includes(p.id))
})

function selectWebSpeech() {
  const meta = allAudioTranscriptionProvidersMetadata.value.find(p => p.id === 'browser-web-speech-api')
  if (meta) {
    onSelectProvider(meta)
  }
  else {
    onSelectProvider({
      id: 'browser-web-speech-api',
      name: 'Web Speech API',
      category: 'transcription',
      tasks: ['speech-to-text'],
    } as any)
  }
}

function selectLocalWhisper() {
  const meta = allAudioTranscriptionProvidersMetadata.value.find(p => isLocalWhisperProvider(p.id))
  if (meta) {
    onSelectProvider(meta)
  }
  else {
    onSelectProvider({
      id: 'app-local-audio-transcription',
      name: 'App (Local)',
      category: 'transcription',
      tasks: ['speech-to-text'],
    } as any)
  }
}

function cancelWhisperDownload() {
  whisperAbort.value?.abort()
  whisperDownloadState.value = 'idle'
  whisperProgress.value = 0
}

const WHISPER_PROGRESS_TOTAL = 800 * 1024 * 1024

function formatMB(bytes?: number) {
  if (!bytes)
    return ''
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

function getWhisperModelSpec(id: string) {
  if (id.includes('tiny'))
    return '~40 MB DL · ~250 MB VRAM'
  if (id.includes('base'))
    return '~80 MB DL · ~500 MB VRAM'
  if (id.includes('small'))
    return '~250 MB DL · ~1 GB VRAM'
  return '~800 MB DL · ~3 GB VRAM'
}

const whisperErrorMessage = ref('')

async function startWhisperDownload() {
  whisperAbort.value?.abort()
  const controller = new AbortController()
  whisperAbort.value = controller
  whisperDownloadState.value = 'downloading'
  whisperProgress.value = 0
  whisperErrorMessage.value = ''

  const shardMap = new Map<string, { loaded: number, total: number }>()

  try {
    await ensureWhisperLoaded({
      model: selectedWhisperModel.value,
      signal: controller.signal,
      onProgress: (p: ProgressPayload) => {
        if (p.file) {
          shardMap.set(p.file, {
            loaded: p.loaded || 0,
            total: p.total || 0,
          })
          let sumLoaded = 0
          let sumTotal = 0
          for (const s of shardMap.values()) {
            sumLoaded += s.loaded
            sumTotal += s.total
          }
          if (sumTotal > 0) {
            const calculated = Math.round((sumLoaded / sumTotal) * 100)
            whisperProgress.value = Math.min(100, Math.max(whisperProgress.value, calculated))
          }
          else if (typeof p.percent === 'number' && p.percent >= 0) {
            whisperProgress.value = Math.min(100, Math.max(whisperProgress.value, Math.round(p.percent)))
          }
        }
        else if (typeof p.percent === 'number' && p.percent >= 0) {
          whisperProgress.value = Math.min(100, Math.max(whisperProgress.value, Math.round(p.percent)))
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
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      whisperErrorMessage.value = msg
      console.error('[V2 Hearing] Whisper download failed:', msg, err)
    }
  }
}

function onSelectProvider(provider: ProviderMetadata) {
  activeTranscriptionProvider.value = provider.id
  draft.setHearing({ provider: provider.id, model: draft.state.hearing.model })
  verification.value = 'idle'
  // Local whisper providers skip credential form and start Whisper download if idle
  if (isLocalWhisperProvider(provider.id) && whisperDownloadState.value === 'idle')
    void startWhisperDownload()
  else if (!isLocalWhisperProvider(provider.id))
    whisperDownloadState.value = 'idle'
  void hearingStore.loadModelsForProvider(provider.id)
}

// --- Inline cloud config ---
const inlineConfigProvider = computed(() => {
  if (!activeTranscriptionProvider.value)
    return null
  const meta = allAudioTranscriptionProvidersMetadata.value.find(p => p.id === activeTranscriptionProvider.value)
  if (!meta || meta.requiresCredentials === false)
    return null
  return meta
})
const showInlineConfig = computed(() => !!inlineConfigProvider.value && !configuredTranscriptionProvidersMetadata.value.some(p => p.id === inlineConfigProvider.value!.id))

function handleConfigured() {
  void hearingStore.loadModelsForProvider(activeTranscriptionProvider.value)
}

function handleCancelConfig() {
  activeTranscriptionProvider.value = ''
}

// --- Model sub-picker for cloud STT ---
const providerModels = computed(() => providersStore.getModelsForProvider(activeTranscriptionProvider.value))

// Keep the authoritative STT selection in the transient draft.
watch([activeTranscriptionProvider, activeTranscriptionModel], ([p, m]) => {
  if (p)
    draft.setHearing({ provider: p, model: m || selectedWhisperModel.value })
})
watch(selectedWhisperModel, (m) => {
  if (isWhisperSelected.value) {
    draft.setHearing({ provider: activeTranscriptionProvider.value, model: m })
    whisperDownloadState.value = 'idle'
    whisperProgress.value = 0
    whisperErrorMessage.value = ''
  }
})

// --- Live test ---
const isTesting = ref(false)
const testStatusMessage = ref('')
const testStreamingText = ref('')
const transcribedText = ref('')
const testError = ref('')
const testStreamWasStarted = ref(false)

const canStartTest = computed(() => {
  if (!activeTranscriptionProvider.value)
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
    const result = await transcribeForRecording(recording)
    if (result)
      transcribedText.value = result
    else
      testError.value = 'No transcription returned from provider.'
  }
  catch (err) {
    testError.value = err instanceof Error ? err.message : String(err)
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
    await stopStreamingTranscription(true, activeTranscriptionProvider.value)
  else
    await stopRecord()
  if (testStreamWasStarted.value && !isTesting.value) {
    stopStream()
    testStreamWasStarted.value = false
  }
}

onBeforeUnmount(async () => {
  whisperAbort.value?.abort()
  if (isTesting.value)
    await stopTest()
  await stopMonitoring()
  // Principle 6 (Option A): restore the pre-onboarding persisted STT selection.
  // The user's chosen STT engine lives in draft.hearing and is committed at Step 7.
  hearingStore.activeTranscriptionProvider = snapshotProvider
  hearingStore.activeTranscriptionModel = snapshotModel
})

onMounted(() => {
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
  <div class="h-full flex flex-col gap-4 overflow-y-auto px-1 pb-2">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Hearing & Mic Playground
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Zero dependencies on character or persona — verify your ear works before anything else.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Pick a speech engine below, then talk to me! The big button unlocks as soon as I actually hear you — no mock progress bars here."
    />

    <!-- Step 1: Mic device (only shown when multiple hardware devices are detected) -->
    <div v-if="micOptions.length > 1" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="selectedAudioInput"
        label="Microphone"
        description="Choose the input device to verify."
        :options="micOptions"
        placeholder="Select an audio input device"
        layout="vertical"
      />
    </div>

    <!-- Step 2: Featured On-Device & Built-In STT Options (Hero Cards) -->
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

    <!-- Whisper model picker + in-context download & manual action trigger -->
    <div v-if="isWhisperSelected" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3.5']">
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
            :options="WHISPER_MODELS.map(m => ({ label: `${m.name} (${getWhisperModelSpec(m.id)})`, value: m.id }))"
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
            @click="startWhisperDownload"
          >
            <div class="i-solar:refresh-circle-bold-duotone text-base" />
            <span>Re-download</span>
          </Button>

          <Button
            v-else-if="whisperDownloadState === 'error'"
            variant="primary"
            class="h-[38px] flex items-center gap-1.5 px-4 font-medium"
            @click="startWhisperDownload"
          >
            <div class="i-solar:restart-bold-duotone text-base" />
            <span>Retry Download</span>
          </Button>
        </div>
      </div>

      <!-- Download progress display -->
      <div v-if="whisperDownloadState === 'downloading'" class="flex flex-col gap-2 border border-primary-500/20 rounded-xl bg-primary-500/5 p-3">
        <div class="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
          <div class="flex items-center gap-1.5">
            <div class="i-solar:cloud-download-bold-duotone animate-pulse text-primary-500" />
            <span>Downloading model shards into local cache…</span>
          </div>
          <span class="font-medium font-mono">{{ Math.floor(whisperProgress) }}%<template v-if="whisperProgress > 0"> ({{ formatMB((whisperProgress / 100) * WHISPER_PROGRESS_TOTAL) }} / {{ formatMB(WHISPER_PROGRESS_TOTAL) }})</template></span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${whisperProgress}%` }" />
        </div>
      </div>

      <!-- Ready status -->
      <div v-else-if="whisperDownloadState === 'ready'" class="flex items-center gap-2 border border-emerald-500/20 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-700 font-medium dark:text-emerald-300">
        <div class="i-solar:check-circle-bold-duotone h-4 w-4 flex-shrink-0 text-emerald-500" />
        <span>Whisper model shard is cached & resident in memory — ready to transcribe.</span>
      </div>

      <!-- Error status -->
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

    <!-- Cloud & Custom providers grid (filtered, excluding hero options) -->
    <div v-if="cloudProviders.length > 0" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <div class="flex items-center justify-between">
        <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
          Cloud & Remote Engines (API Key Required)
        </span>
        <span class="text-[11px] text-neutral-400">Optional</span>
      </div>
      <SttProviderPicker
        v-model="activeTranscriptionProvider"
        :providers="cloudProviders"
        @select="onSelectProvider"
      />
    </div>

    <!-- Inline cloud credential configuration -->
    <div v-if="showInlineConfig && inlineConfigProvider" :class="['border border-dashed border-amber-300/60 rounded-xl', 'bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/60', 'backdrop-blur-md']">
      <StepProviderConfiguration
        :selected-provider-id="inlineConfigProvider.id"
        :selected-provider="inlineConfigProvider"
        :on-next="handleConfigured"
        :on-previous="handleCancelConfig"
      />
    </div>

    <!-- Cloud model sub-picker -->
    <div v-if="!isWhisperSelected && !isWebSpeechSelected && providerModels.length > 0" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="activeTranscriptionModel"
        label="Model"
        :options="providerModels.map((m: any) => ({ label: m.name || m.id, value: m.id }))"
        placeholder="Select a transcription model"
        layout="vertical"
      />
    </div>

    <!-- Lock-key hotkey (Electron only) -->
    <LockKeyPicker />

    <!-- Step 3: live verification test -->
    <SttTestBox
      :volume-level="volumeLevel"
      :status-message="testStatusMessage"
      :streaming-text="testStreamingText"
      :transcribed-text="transcribedText"
      :is-testing="isTesting"
      :is-verified="isVerified"
      :supports-stream-input="supportsStreamInput"
      :can-start="canStartTest"
      :error-message="testError"
      @start="startTest"
      @stop="stopTest"
    />
  </div>
</template>
