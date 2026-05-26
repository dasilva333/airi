<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { useLiveSessionStore } from '@proj-airi/stage-ui/stores/modules/live-session'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { noticeWindowEventa } from '../../../../shared/eventa'
import { useControlsIslandStore } from '../../../stores/controls-island'
import ControlButton from './control-button.vue'
import ControlButtonTooltip from './control-button-tooltip.vue'

const emit = defineEmits<(e: 'close') => void>()

const { t } = useI18n()
const liveSessionStore = useLiveSessionStore()
const visionStore = useVisionStore()
const proactivityStore = useProactivityStore()
const settingsStore = useSettings()

const {
  estimatedCost,
  isActive: isLiveActive,
  isGroundingEnabled,
  outputMode,
  voiceName,
} = storeToRefs(liveSessionStore)
const { isWitnessEnabled, status: visionStatus } = storeToRefs(visionStore)

const { controlsIslandIconSize } = storeToRefs(settingsStore)
const { heartbeatIntervalMinutes, isRespectScheduleEnabled } = storeToRefs(proactivityStore)

const providersStore = useProvidersStore()
const controlsIslandStore = useControlsIslandStore()

const hasGeminiKey = computed(() => {
  const creds = providersStore.getProviderConfig('google-generative-ai')
  return !!(typeof creds?.apiKey === 'string' && creds.apiKey.trim())
})

// === Onboarding Trigger ===
const requestNotice = useElectronEventaInvoke(noticeWindowEventa.openWindow)
const NOTICE_WINDOW_ID = 'gemini-onboarding'

onMounted(async () => {
  // Only trigger if we have a key and haven't shown it yet
  if (hasGeminiKey.value && !controlsIslandStore.dontShowGeminiOnboarding) {
    try {
      await requestNotice({
        id: NOTICE_WINDOW_ID,
        route: '/notice/gemini',
        type: 'gemini-onboarding',
      })
    } catch (error) {
      console.error('Failed to open Gemini onboarding notice:', error)
    }
  }
})

// Grouped classes for icon / border / padding and combined style class
const adjustStyleClasses = computed(() => {
  let isLarge: boolean

  // Determine size based on setting
  switch (controlsIslandIconSize.value) {
    case 'large':
      isLarge = true
      break
    case 'small':
      isLarge = false
      break
    default:
      isLarge = true
      break
  }

  const icon = isLarge ? 'size-5' : 'size-3.5'
  const border = isLarge ? 'border-2' : 'border-0'
  const padding = isLarge ? 'p-2' : 'p-1'
  return { border, button: `${border} ${padding}`, icon, padding }
})

const formattedCost = computed(() => {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    minimumFractionDigits: 4,
    style: 'currency',
  }).format(estimatedCost?.value ?? 0)
})

// === Functional Handlers ===
function handleLiveToggle() {
  // Master Toggle: strictly manages the Live Session state.
  // Proactivity and Vision captures will now independently respect isActive.
  liveSessionStore.toggle()
  emit('close')
}

function handleVisionToggle() {
  visionStore.toggleWitness()
  // We keep it open if toggling vision so user can see the state change
}

function handleCaptureNow() {
  visionStore.heartbeat({ force: true })
  emit('close')
}

function handleToggleOutputMode() {
  liveSessionStore.toggleOutputMode()
  emit('close')
}

function handleToggleRespectSchedule() {
  proactivityStore.toggleRespectSchedule()
  emit('close')
}

function handleToggleGrounding() {
  isGroundingEnabled.value = !isGroundingEnabled.value
  emit('close')
}
</script>

<template>
  <div
    class="min-w-max w-auto flex flex-col gap-1 border-1 border-neutral-200 rounded-2xl bg-neutral-100/80 p-2 shadow-2xl backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/80"
  >
    <!-- 3x3 Modular Grid -->
    <div class="grid grid-cols-3 gap-2">
      <!-- Row 1: Live API (Unified) -->
      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="handleLiveToggle">
          <div
            :class="[
              'transition-colors duration-200',
              isLiveActive ? 'i-ph:broadcast-bold animate-pulse' : 'i-ph:broadcast-light',
              adjustStyleClasses.icon,
              isLiveActive ? 'text-emerald-500' : 'text-neutral-400',
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.live-api') }}: {{ isLiveActive ? 'ON' : 'OFF' }}
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="handleCaptureNow">
          <div
            :class="[
              visionStatus === 'capturing' ? 'i-solar:camera-bold-duotone animate-pulse' : 'i-solar:camera-outline',
              adjustStyleClasses.icon,
              visionStatus === 'capturing' ? 'text-purple-500' : 'text-neutral-400',
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.capture-now') }}
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="proactivityStore.cycleHeartbeatInterval()">
          <div i-ph:heartbeat :class="adjustStyleClasses.icon" text="red-400" />
          <div absolute bottom-1 right-1 text="[8px]" font-black leading-none opacity-80>
            {{ heartbeatIntervalMinutes }}m
          </div>
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.pulse-rate') }} ({{ heartbeatIntervalMinutes }}m)
        </template>
      </ControlButtonTooltip>

      <!-- Row 2: Voice Cluster (Functional items marked) -->
      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" class="cursor-not-allowed opacity-30">
          <div :class="adjustStyleClasses.icon" class="flex items-center justify-center text-sky-400/80 font-bold">
            3.1
          </div>
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.model-version') }}: 3.1 (Coming Soon)
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="handleToggleOutputMode">
          <div
            :class="[
              outputMode === 'gemini' ? 'i-solar:soundwave-bold text-sky-400' : 'i-solar:soundwave-outline text-violet-400',
              adjustStyleClasses.icon,
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.output-mode') }}: {{ outputMode === 'gemini' ? 'Gemini Native' : 'Custom TTS' }}
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="liveSessionStore.cycleVoice()">
          <div i-solar:user-speak-outline :class="adjustStyleClasses.icon" text="sky-400" />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.cycle-voice') }}: {{ voiceName }}
        </template>
      </ControlButtonTooltip>

      <!-- Row 3: System Cluster (Functional items marked amber) -->
      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="handleToggleRespectSchedule">
          <div
            :class="[
              isRespectScheduleEnabled ? 'i-solar:clock-circle-bold text-amber-400' : 'i-solar:clock-circle-outline text-emerald-400',
              adjustStyleClasses.icon,
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.respect-schedule') }}: {{ isRespectScheduleEnabled ? (t('tamagotchi.stage.controls-island.status-on') || 'ON') : (t('tamagotchi.stage.controls-island.status-off') || 'OFF') }}
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip>
        <ControlButton :button-style="adjustStyleClasses.button" @click="handleToggleGrounding">
          <div
            :class="[
              isGroundingEnabled ? 'i-solar:globus-bold text-emerald-400' : 'i-solar:globus-outline text-amber-400',
              adjustStyleClasses.icon,
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.grounding') }}: {{ isGroundingEnabled ? (t('tamagotchi.stage.controls-island.status-on') || 'ON') : (t('tamagotchi.stage.controls-island.status-off') || 'OFF') }}
        </template>
      </ControlButtonTooltip>

      <ControlButtonTooltip side="right">
        <ControlButton
          :button-style="[
            adjustStyleClasses.button,
            !isLiveActive ? 'opacity-30' : '',
          ].join(' ')"
          @click="handleVisionToggle"
        >
          <div
            :class="[
              isWitnessEnabled ? 'i-solar:eye-scan-bold-duotone text-amber-500 animate-pulse' : 'i-solar:eye-scan-outline text-neutral-400',
              adjustStyleClasses.icon,
            ]"
          />
        </ControlButton>
        <template #tooltip>
          {{ t('tamagotchi.stage.controls-island.vision-witness') }}: {{ isWitnessEnabled ? 'ON' : 'OFF' }}
          <template v-if="!isLiveActive">
            (Requires Live API: ON)
          </template>
        </template>
      </ControlButtonTooltip>
    </div>

    <!-- Usage Strip (ENABLED) -->
    <div
      class="mt-1 flex items-center justify-between border-t border-neutral-200 border-solid px-1 pt-2 dark:border-neutral-800"
    >
      <span class="text-[8px] text-neutral-500 font-bold tracking-wider uppercase opacity-60">
        {{ t('tamagotchi.stage.controls-island.est-cost') }}
      </span>
      <span class="text-[10px] text-neutral-600 font-mono dark:text-neutral-400">
        {{ formattedCost }}
      </span>
    </div>
  </div>
</template>
