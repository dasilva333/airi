<script setup lang="ts">
import type { MicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { electronGetMicToggleHotkey, electronSetMicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'
import { Checkbox } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAudioAnalyzer } from '../../../composables/audio/audio-analyzer'
import { useAudioContext } from '../../../stores/audio'
import { useHearingStore } from '../../../stores/modules/hearing'
import { useProvidersStore } from '../../../stores/providers'
import { useSettingsAudioDevice } from '../../../stores/settings'

// NOTICE: card owns a two-view panel swap (main ⇄ devices) instead of a nested
// submenu. Device selection, toggles, and mode all bind live stores — the only
// remaining mock is the voice-message waveform (representative squiggle).
const view = ref<'main' | 'devices'>('main')

const hearingStore = useHearingStore()
const { autoSendEnabled, tapToTalk, voiceInputMode, configured: isHearingConfigured, activeTranscriptionProvider } = storeToRefs(hearingStore)

const providersStore = useProvidersStore()

// STT tri-state: an explicit provider means Ready everywhere; otherwise
// Electron has nothing to fall back on (Not Ready) while web/pocket fall
// back to zero-setup browser speech recognition (Web Speech).
const sttStatus = computed<'ready' | 'not-ready' | 'web-speech'>(() => {
  if (isHearingConfigured.value)
    return 'ready'
  return isElectron ? 'not-ready' : 'web-speech'
})

const sttProviderLabel = computed(() => {
  const id = activeTranscriptionProvider.value
  if (!id)
    return ''
  const metadata = providersStore.getProviderMetadata(id) as { localizedName?: string, name?: string } | null
  return metadata?.localizedName || metadata?.name || id
})

const audioDeviceStore = useSettingsAudioDevice()
const {
  audioInputs,
  selectedAudioInput,
  selectedAudioInputLabel,
  permissionStatus,
  isPermissionGranted,
  isPermissionDenied,
  stream,
} = storeToRefs(audioDeviceStore)

const hasMultipleMics = computed(() => audioInputs.value.length > 1)

// Microphone state:
// 'ready'       - permission is granted and mic is present
// 'blocked'     - permission is denied / blocked by the user or system
// 'need-access' - permission has not yet been granted (prompt state)
// 'no-mic'      - no microphone hardware found
const micStatus = computed<'ready' | 'blocked' | 'need-access' | 'no-mic'>(() => {
  if (audioInputs.value.length === 0)
    return 'no-mic'
  if (isPermissionDenied.value || permissionStatus.value === 'denied')
    return 'blocked'
  if (isPermissionGranted.value || permissionStatus.value === 'granted')
    return 'ready'
  return 'need-access'
})

const micStatusText = computed(() => {
  switch (micStatus.value) {
    case 'ready':
      return 'Ready'
    case 'blocked':
      return 'Blocked'
    case 'need-access':
      return 'Need access'
    case 'no-mic':
      return 'No mic'
  }
})

const micStatusBadgeClass = computed(() => {
  switch (micStatus.value) {
    case 'ready':
      return 'bg-emerald-500/15 text-emerald-300'
    case 'need-access':
      return 'bg-amber-500/15 text-amber-300'
    case 'blocked':
    case 'no-mic':
      return 'bg-red-500/15 text-red-300'
  }
})

const micStatusTitle = computed(() => {
  switch (micStatus.value) {
    case 'ready':
      return 'Microphone available'
    case 'blocked':
      return 'Microphone permission blocked — allow access in site settings'
    case 'need-access':
      return 'Microphone permission required — click to allow'
    case 'no-mic':
      return 'No microphone found'
  }
})

// Keep micStatus aligned with actual readiness
function selectMode(mode: 'voice-message' | 'dictation') {
  voiceInputMode.value = mode
  if (view.value !== 'main')
    view.value = 'main'
}

async function handleDeviceRow() {
  if (micStatus.value === 'blocked') {
    toast.error('Microphone access is blocked in browser settings. Please allow microphone permission and reload.')
    return
  }
  if (hasMultipleMics.value) {
    view.value = 'devices'
    return
  }
  await audioDeviceStore.askPermission()
}

async function handleRequestPermission() {
  if (micStatus.value === 'blocked') {
    toast.error('Microphone access is blocked in browser settings. Please allow microphone permission and reload.')
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

// Global Hotkey picker (Electron/desktop only — same isElectron gate and
// fetch-then-persist discipline as the onboarding lock-key picker). Shares
// the mic authority pact: whichever lock key is armed toggles the same
// shared `enabled` flag as the strip and composer buttons.
const isElectron = typeof window !== 'undefined' && !!(window as any).electron
const getHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronGetMicToggleHotkey) : null
const setHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronSetMicToggleHotkey) : null

const selectedHotkey = ref<MicToggleHotkey>('Scroll')
const hotkeyFetched = ref(false)
const hotkeyOptions: { id: MicToggleHotkey, label: string }[] = [
  { id: 'Caps', label: 'Caps' },
  { id: 'Scroll', label: 'Scroll' },
  { id: 'Num', label: 'Num' },
]

onMounted(async () => {
  if (!isElectron)
    return
  try {
    const hotkey = await getHotkeyInvoke?.()
    if (hotkey)
      selectedHotkey.value = hotkey as MicToggleHotkey
  }
  catch {}
  hotkeyFetched.value = true
})

// Only persist after the initial fetch to avoid overwriting the stored key.
watch(selectedHotkey, async (next, prev) => {
  if (isElectron && hotkeyFetched.value && next !== prev) {
    try {
      await setHotkeyInvoke?.(next)
    }
    catch {}
  }
})

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
        :title="micStatus === 'blocked' ? 'Microphone access blocked — allow permission in site settings' : 'Request microphone access'"
        :class="[
          'w-full flex items-center gap-2',
          'px-4 pb-3 pt-2 text-left text-[15px]',
          'transition-colors hover:bg-white/5',
        ]"
        @click="handleRequestPermission"
      >
        <span class="min-w-0 flex-1 truncate">
          {{ micStatus === 'blocked' ? 'Microphone blocked in browser' : 'Request microphone access' }}
        </span>
        <div class="i-solar:alt-arrow-right-linear size-4 shrink-0 text-neutral-400" />
      </button>
    </template>

    <!-- Main view -->
    <template v-else>
      <!-- Status row: STT tri-state (Ready / Not Ready / Web Speech). -->
      <div class="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
        <span class="text-xs text-neutral-400">Status</span>
        <span class="min-w-0 flex items-center gap-1.5">
          <span
            :class="[
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
              sttStatus === 'ready'
                ? 'bg-emerald-500/15 text-emerald-300'
                : sttStatus === 'web-speech'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-red-500/15 text-red-300',
            ]"
          >
            {{ sttStatus === 'ready' ? 'Ready' : sttStatus === 'web-speech' ? 'Web Speech' : 'Not Ready' }}
          </span>
          <button
            v-if="sttStatus !== 'ready'"
            type="button"
            title="Set up a hearing provider"
            class="shrink-0 cursor-pointer text-[11px] text-sky-300 font-semibold hover:underline"
            @click="openHearingSettings"
          >
            Setup Hearing
          </button>
          <span
            v-else-if="sttProviderLabel"
            :title="sttProviderLabel"
            class="min-w-0 truncate text-[11px] text-neutral-300"
          >
            {{ sttProviderLabel }}
          </span>
        </span>
      </div>

      <div
        :class="[
          'px-4 pb-1 pt-2',
          'text-xs text-neutral-400',
        ]"
      >
        Voice input
      </div>

      <button
        type="button"
        disabled
        title="Voice messages need a native audio pipeline — dictation only for now"
        :class="[
          'w-full flex items-center gap-2.5',
          'px-4 py-2 text-left text-[15px]',
          'cursor-not-allowed opacity-40',
        ]"
      >
        <div class="i-solar:microphone-linear size-5 shrink-0" />
        <span class="min-w-0 flex-1 truncate">Voice message</span>
        <span class="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          Coming soon
        </span>
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
        <span class="min-w-0 flex-1 truncate">Dictation</span>
        <div v-if="voiceInputMode === 'dictation'" class="i-solar:check-circle-bold size-4 shrink-0" />
      </button>

      <div class="h-px bg-white/10" />

      <div
        :class="[
          'flex items-center justify-between gap-2',
          'px-4 pb-1 pt-2',
          'text-xs text-neutral-400',
        ]"
      >
        <span>Microphone</span>
        <span
          :title="micStatusTitle"
          :class="[
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
            micStatusBadgeClass,
          ]"
        >
          {{ micStatusText }}
        </span>
      </div>

      <button
        type="button"
        :title="micStatus === 'blocked' ? 'Microphone access blocked in browser settings' : (hasMultipleMics ? 'Select microphone' : 'Refresh microphone list')"
        :class="[
          'w-full flex items-center gap-2',
          'px-4 py-1.5 text-left',
        ]"
        @click="handleDeviceRow"
      >
        <span
          :class="[
            'min-w-0 flex-1 truncate text-[15px]',
            micStatus === 'blocked' ? 'text-red-300/80 hover:text-red-200' : 'text-neutral-100',
          ]"
        >
          {{ micStatus === 'blocked' ? 'Microphone access blocked' : selectedAudioInputLabel }}
        </span>
        <div
          v-if="hasMultipleMics && micStatus !== 'blocked'"
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
        title="On: one tap captures one utterance and stops itself at speech end. Off: open line — tap opens, tap closes, utterances segment on their own."
      >
        <span>Tap to talk</span>
        <Checkbox v-model="tapToTalk" />
      </div>

      <!-- Global Hotkey picker (desktop Electron only): which lock key shares
        the mic authority pact — pressing it toggles the same shared flag as
        the strip and composer buttons. -->
      <div v-if="isElectron" class="px-4 py-2">
        <div class="mb-1.5 text-xs text-neutral-400">
          Global Hotkey
        </div>
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="opt in hotkeyOptions"
            :key="opt.id"
            type="button"
            :title="`${opt.label} Lock toggles the microphone`"
            :class="[
              'cursor-pointer rounded-lg border px-2 py-1.5 text-[13px] font-semibold transition',
              selectedHotkey === opt.id
                ? 'border-sky-400/40 bg-sky-500/20 text-sky-300'
                : 'border-white/10 text-neutral-300 hover:bg-white/5',
            ]"
            @click="selectedHotkey = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
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
