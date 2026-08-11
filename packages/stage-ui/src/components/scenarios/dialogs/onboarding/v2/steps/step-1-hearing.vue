<script setup lang="ts">
import type { ProgressPayload } from '../../../../../../libs/inference/protocol'
import type { ProviderMetadata } from '../../../../../../stores/providers'

import { useAudioAnalyzer, useAudioRecorder } from '@proj-airi/stage-ui/composables'
import { FieldSelect } from '@proj-airi/ui'
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
const isVerified = computed(() => verification.value === 'verified')

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('hearing', {
    canProceed: computed(() => isVerified.value),
    skipLabel: 'Skip Step',
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

const isWhisperSelected = computed(() => activeTranscriptionProvider.value === 'browser-local-audio-transcription')
const isWebSpeechSelected = computed(() => activeTranscriptionProvider.value === 'browser-web-speech-api')

const WHISPER_PROGRESS_TOTAL = 800 * 1024 * 1024

function formatMB(bytes?: number) {
  if (!bytes)
    return ''
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

async function startWhisperDownload() {
  whisperAbort.value?.abort()
  const controller = new AbortController()
  whisperAbort.value = controller
  whisperDownloadState.value = 'downloading'
  whisperProgress.value = 0
  try {
    await ensureWhisperLoaded({
      model: selectedWhisperModel.value,
      signal: controller.signal,
      onProgress: (p: ProgressPayload) => {
        if (typeof p.percent === 'number' && p.percent >= 0)
          whisperProgress.value = Math.min(100, p.percent)
        else if (p.loaded && p.total)
          whisperProgress.value = Math.min(100, (p.loaded / p.total) * 100)
      },
    })
    if (!controller.signal.aborted)
      whisperDownloadState.value = 'ready'
  }
  catch (err) {
    if (!controller.signal.aborted) {
      whisperDownloadState.value = 'error'
      console.error('[V2 Hearing] Whisper download failed:', err)
    }
  }
}

function onSelectProvider(provider: ProviderMetadata) {
  activeTranscriptionProvider.value = provider.id
  draft.setHearing({ provider: provider.id, model: draft.state.hearing.model })
  verification.value = 'idle'
  // Cloud providers surface their credential form; local ones skip straight to testing.
  if (provider.id === 'browser-local-audio-transcription' && whisperDownloadState.value === 'idle')
    void startWhisperDownload()
  else if (provider.id !== 'browser-local-audio-transcription')
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

// --- Model sub-picker for cloud STT ---
const providerModels = computed(() => providersStore.getModelsForProvider(activeTranscriptionProvider.value))

// Keep the authoritative STT selection in the transient draft.
watch([activeTranscriptionProvider, activeTranscriptionModel], ([p, m]) => {
  if (p)
    draft.setHearing({ provider: p, model: m || selectedWhisperModel.value })
})
watch(selectedWhisperModel, (m) => {
  if (isWhisperSelected.value)
    draft.setHearing({ provider: activeTranscriptionProvider.value, model: m })
})

// --- Live test ---
const isTesting = ref(false)
const testStatusMessage = ref('')
const testStreamingText = ref('')
const transcribedText = ref('')
const testError = ref('')
const testStreamWasStarted = ref(false)

const canStartTest = computed(() => {
  if (!activeTranscriptionProvider.value || !selectedAudioInput.value)
    return false
  if (isWhisperSelected.value && whisperDownloadState.value !== 'ready')
    return false
  return true
})

watch(transcribedText, (text) => {
  if (text.trim())
    verification.value = 'verified'
  else if (verification.value === 'verified')
    verification.value = 'transcribed'
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
            testStreamingText.value += `${delta} `
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
  isTesting.value = true
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
  if (audioInputs.value.length === 0)
    void startStream().then(() => stopStream())
  void setupMonitoring()
})

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

    <!-- Step 1: Mic device -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="selectedAudioInput"
        label="Microphone"
        description="Choose the input device to verify."
        :options="micOptions"
        placeholder="Select an audio input device"
        layout="vertical"
      />
    </div>

    <!-- Step 2: provider matrix (reused grid primitive) -->
    <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <span class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Choose a Speech Engine</span>
      <SttProviderPicker
        v-model="activeTranscriptionProvider"
        :providers="allAudioTranscriptionProvidersMetadata"
        @select="onSelectProvider"
      />
    </div>

    <!-- Whisper model picker + in-context download -->
    <div v-if="isWhisperSelected" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-3']">
      <FieldSelect
        v-model="selectedWhisperModel"
        label="Whisper Model"
        description="Larger is more accurate; smaller downloads faster."
        :options="WHISPER_MODELS.map(m => ({ label: `${m.name} (${m.id.includes('small') ? '~480 MB' : '~800 MB'})`, value: m.id }))"
        layout="vertical"
        :disabled="whisperDownloadState === 'downloading'"
      />
      <div v-if="whisperDownloadState === 'downloading'" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>Downloading weight shards…</span>
          <span>{{ Math.floor(whisperProgress) }}%<template v-if="whisperProgress > 0"> ({{ formatMB((whisperProgress / 100) * WHISPER_PROGRESS_TOTAL) }} / {{ formatMB(WHISPER_PROGRESS_TOTAL) }})</template></span>
        </div>
        <div class="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <div class="h-full rounded-full from-primary-500 to-indigo-500 bg-gradient-to-r transition-all duration-150" :style="{ width: `${whisperProgress}%` }" />
        </div>
      </div>
      <div v-else-if="whisperDownloadState === 'ready'" class="flex items-center gap-2 text-xs text-emerald-600 font-bold dark:text-emerald-400">
        <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
        Engine cached & verified — ready to transcribe.
      </div>
      <div v-else-if="whisperDownloadState === 'error'" class="flex items-center gap-2 text-xs text-red-600 font-bold dark:text-red-400">
        <div class="i-solar:danger-circle-bold-duotone h-4 w-4" />
        Download failed.
        <button class="underline" @click="startWhisperDownload">
          Retry
        </button>
      </div>
    </div>

    <!-- Inline cloud credential configuration -->
    <div v-if="showInlineConfig && inlineConfigProvider" :class="['border border-dashed border-amber-300/60 rounded-xl', 'bg-amber-50/60 dark:bg-amber-900/10 dark:border-amber-700/60', 'backdrop-blur-md']">
      <StepProviderConfiguration
        :selected-provider-id="inlineConfigProvider.id"
        :selected-provider="inlineConfigProvider"
        :on-next="handleConfigured"
        :on-previous="() => {}"
      />
    </div>

    <!-- Cloud model sub-picker -->
    <div v-if="!isWhisperSelected && !isWebSpeechSelected && providerModels.length > 0" :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md']">
      <FieldSelect
        v-model="activeTranscriptionModel"
        label="Model"
        :options="providerModels.map(m => ({ label: m.name || m.id, value: m.id }))"
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
