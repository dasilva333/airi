<script setup lang="ts">
import { Checkbox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAudioAnalyzer } from '../../../composables/audio/audio-analyzer'
import { useAudioContext } from '../../../stores/audio'
import { useHearingStore } from '../../../stores/modules/hearing'
import { useSettingsAudioDevice } from '../../../stores/settings'

// NOTICE: card owns a two-view panel swap (main ⇄ devices) instead of a nested
// submenu. Device selection, toggles, and mode all bind live stores — the only
// remaining mock is the voice-message waveform (representative squiggle).
const view = ref<'main' | 'devices'>('main')

const hearingStore = useHearingStore()
const { autoSendEnabled, voiceInputMode } = storeToRefs(hearingStore)

const audioDeviceStore = useSettingsAudioDevice()
const {
  audioInputs,
  selectedAudioInput,
  selectedAudioInputLabel,
  enabled,
  stream,
} = storeToRefs(audioDeviceStore)

const hasMultipleMics = computed(() => audioInputs.value.length > 1)

// "Tap to talk" is the inverted mic-hot flag. ON (default) = tap the mic for
// each utterance; OFF = open mic, never tap (persistent VAD session).
const tapToTalk = computed({
  get: () => !enabled.value,
  set: (val: boolean) => {
    enabled.value = !val
  },
})

function selectMode(mode: 'voice-message' | 'dictation') {
  voiceInputMode.value = mode
  if (view.value !== 'main')
    view.value = 'main'
}

async function handleDeviceRow() {
  if (hasMultipleMics.value) {
    view.value = 'devices'
    return
  }
  await audioDeviceStore.askPermission()
}

function chooseDevice(deviceId: string) {
  selectedAudioInput.value = deviceId
  view.value = 'main'
}

let router: ReturnType<typeof useRouter> | undefined
try {
  router = useRouter()
}
catch {
  // router might not be installed in all contexts
}

function openHearingSettings() {
  router?.push('/settings/modules/hearing').catch(() => {})
}

// Live input meter, same wiring as Hearing settings monitoring: source the
// shared AudioContext from the active MediaStream into the analyzer loop.
const audioContextStore = useAudioContext()
const { volumeLevel, startAnalyzer } = useAudioAnalyzer()
let sourceNode: MediaStreamAudioSourceNode | undefined

function attachMeter() {
  try {
    if (!stream.value)
      return
    const analyzer = startAnalyzer(audioContextStore.audioContext)
    if (!analyzer)
      return
    sourceNode?.disconnect()
    sourceNode = audioContextStore.audioContext.createMediaStreamSource(stream.value)
    sourceNode.connect(analyzer)
  }
  catch {
    // Meter is best-effort; hover card stays usable without it.
  }
}

onMounted(() => {
  if (stream.value)
    attachMeter()
})

watch(stream, (next) => {
  if (next)
    attachMeter()
})

onUnmounted(() => {
  try {
    sourceNode?.disconnect()
  }
  catch {}
  sourceNode = undefined
})

const meterWidth = computed(() => `${Math.min(100, Math.max(0, volumeLevel.value))}%`)

function deviceDisplayLabel(device: MediaDeviceInfo, index: number) {
  return device.label || `Microphone ${index + 1}`
}
</script>

<template>
  <div
    role="dialog"
    aria-label="Voice input options"
    :class="[
      'w-72 select-none',
      'overflow-hidden rounded-2xl border border-white/10',
      'bg-neutral-900/95 text-neutral-100',
      'shadow-2xl shadow-black/40 backdrop-blur-xl',
    ]"
  >
    <!-- Devices view: full-panel swap with a back affordance -->
    <template v-if="view === 'devices'">
      <button
        type="button"
        title="Back to voice input"
        :class="[
          'w-full flex items-center gap-1.5',
          'px-4 pb-1 pt-3 text-left',
          'text-xs text-neutral-400',
          'transition-colors hover:text-neutral-200',
        ]"
        @click="view = 'main'"
      >
        <div class="i-solar:alt-arrow-left-linear size-3.5 shrink-0" />
        <span>Microphone</span>
      </button>

      <div class="max-h-56 overflow-y-auto py-1">
        <div
          v-if="audioInputs.length === 0"
          class="px-4 py-2 text-[13px] text-neutral-400"
        >
          No microphones found yet.
        </div>
        <button
          v-for="(device, index) in audioInputs"
          :key="device.deviceId || index"
          type="button"
          :title="deviceDisplayLabel(device, index)"
          :class="[
            'w-full flex items-center gap-2',
            'px-4 py-2 text-left text-[15px]',
            'transition-colors hover:bg-white/5',
            device.deviceId && device.deviceId === selectedAudioInput ? 'text-sky-300' : 'text-neutral-100',
          ]"
          @click="chooseDevice(device.deviceId)"
        >
          <span class="min-w-0 flex-1 truncate">
            {{ deviceDisplayLabel(device, index) }}
          </span>
          <div
            v-if="device.deviceId && device.deviceId === selectedAudioInput"
            class="i-solar:check-circle-bold size-4 shrink-0"
          />
        </button>
      </div>

      <div class="h-px bg-white/10" />

      <button
        type="button"
        title="Request microphone access"
        :class="[
          'w-full flex items-center gap-2',
          'px-4 pb-3 pt-2 text-left text-[15px]',
          'transition-colors hover:bg-white/5',
        ]"
        @click="audioDeviceStore.askPermission()"
      >
        <span class="min-w-0 flex-1 truncate">Request microphone access</span>
        <div class="i-solar:alt-arrow-right-linear size-4 shrink-0 text-neutral-400" />
      </button>
    </template>

    <!-- Main view -->
    <template v-else>
      <div
        :class="[
          'px-4 pb-1 pt-3',
          'text-xs text-neutral-400',
        ]"
      >
        Voice input
      </div>

      <button
        type="button"
        title="Record a voice message"
        :class="[
          'w-full flex items-center gap-2.5',
          'px-4 py-2 text-left text-[15px]',
          voiceInputMode === 'voice-message' ? 'text-sky-300' : 'text-neutral-100',
        ]"
        @click="selectMode('voice-message')"
      >
        <div class="i-solar:microphone-linear size-5 shrink-0" />
        <span>Voice message</span>
      </button>

      <button
        type="button"
        title="Dictate into the composer"
        :class="[
          'w-full flex items-center gap-2.5',
          'px-4 py-2 text-left text-[15px]',
          voiceInputMode === 'dictation' ? 'text-sky-300' : 'text-neutral-100',
        ]"
        @click="selectMode('dictation')"
      >
        <div class="i-solar:keyboard-linear size-5 shrink-0" />
        <span>Dictation</span>
      </button>

      <div class="h-px bg-white/10" />

      <div
        :class="[
          'px-4 pb-1 pt-2',
          'text-xs text-neutral-400',
        ]"
      >
        Microphone
      </div>

      <button
        type="button"
        :title="hasMultipleMics ? 'Select microphone' : 'Refresh microphone list'"
        :class="[
          'w-full flex items-center gap-2',
          'px-4 py-1.5 text-left',
        ]"
        @click="handleDeviceRow"
      >
        <span class="min-w-0 flex-1 truncate text-[15px] text-neutral-100">
          {{ selectedAudioInputLabel }}
        </span>
        <div
          v-if="hasMultipleMics"
          class="i-solar:alt-arrow-right-linear size-4 shrink-0 text-neutral-400"
        />
      </button>

      <div class="px-4 pb-2 pt-1">
        <div class="h-1 overflow-hidden rounded-full bg-white/15">
          <div class="h-full rounded-full bg-sky-400" :style="{ width: meterWidth }" />
        </div>
      </div>

      <div class="h-px bg-white/10" />

      <div
        :class="[
          'w-full flex items-center justify-between gap-2',
          'px-4 py-2 text-left text-[15px]',
        ]"
        title="Send automatically when the utterance ends"
      >
        <span>Send when recording stops</span>
        <Checkbox v-model="autoSendEnabled" />
      </div>

      <div
        :class="[
          'w-full flex items-center justify-between gap-2',
          'px-4 py-2 text-left text-[15px]',
        ]"
        title="Tap the mic for each utterance. Off = mic stays hot and hears every utterance on its own."
      >
        <span>Tap to talk</span>
        <Checkbox v-model="tapToTalk" />
      </div>

      <div class="h-px bg-white/10" />

      <button
        type="button"
        title="More Hearing settings"
        :class="[
          'w-full flex items-center gap-2',
          'px-4 pb-3 pt-2 text-left text-[15px]',
          'transition-colors hover:bg-white/5',
        ]"
        @click="openHearingSettings"
      >
        <span class="min-w-0 flex-1 truncate">More Hearing settings...</span>
        <div class="i-solar:alt-arrow-right-linear size-4 shrink-0 text-neutral-400" />
      </button>
    </template>
  </div>
</template>
