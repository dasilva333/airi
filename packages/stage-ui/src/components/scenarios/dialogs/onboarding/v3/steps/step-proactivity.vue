<script setup lang="ts">
import { useOnboardingDisplayText } from '../composables/use-onboarding-display-text'
import { useI18n } from 'vue-i18n'

import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { Button } from '@proj-airi/ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const { t } = useI18n()

const { displayText } = useOnboardingDisplayText()


const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const proactivityStore = useProactivityStore()

// --- 1. Operating Schedule & Circadian Sleep Gate ---
const operatingScheduleEnabled = ref<boolean>(draft.state.operatingScheduleEnabled !== false)
const wakeUpTime = ref<string>(draft.state.wakeUpTime || '09:00')
const bedTime = ref<string>(draft.state.bedTime || '23:00')
const pauseOnAfk = ref<boolean>(draft.state.pauseOnAfk !== false)
const afkMinutes = ref<number>(draft.state.afkMinutes || 5)

// --- 2. Proactivity Engine Mode & State ---
type ProactivityEngineMode = 'on-demand' | 'heartbeats' | 'screen' | 'dual'

const heartbeatsEnabled = ref<boolean>(draft.state.heartbeatsEnabled !== false)
const screenWatcherEnabled = ref<boolean>(draft.state.screenWatcherEnabled !== false)

const initialMode: ProactivityEngineMode = (heartbeatsEnabled.value && screenWatcherEnabled.value)
  ? 'dual'
  : (screenWatcherEnabled.value
      ? 'screen'
      : (heartbeatsEnabled.value ? 'heartbeats' : 'on-demand'))

const proactivityEngineMode = ref<ProactivityEngineMode>(initialMode)

function selectEngineMode(mode: ProactivityEngineMode) {
  proactivityEngineMode.value = mode
  if (mode === 'on-demand') {
    heartbeatsEnabled.value = false
    screenWatcherEnabled.value = false
  }
  else if (mode === 'heartbeats') {
    heartbeatsEnabled.value = true
    screenWatcherEnabled.value = false
  }
  else if (mode === 'screen') {
    heartbeatsEnabled.value = false
    screenWatcherEnabled.value = true
  }
  else if (mode === 'dual') {
    heartbeatsEnabled.value = true
    screenWatcherEnabled.value = true
  }
  syncDraft()
}

// Engine Mode Options Catalog
const engineModes = [
  {
    id: 'on-demand' as const,
    title: 'On-Demand',
    badge: 'Reactive',
    badgeColor: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
    desc: 'Only speaks when spoken to in chat or voice. Zero background captures or timers.',
    icon: 'i-solar:moon-stars-bold-duotone',
  },
  {
    id: 'heartbeats' as const,
    title: 'Ambient Heartbeats',
    badge: 'Timer Pull',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    desc: 'Periodic check-in questions and downtime reminders during active waking hours.',
    icon: 'i-solar:heart-pulse-2-bold-duotone',
  },
  {
    id: 'screen' as const,
    title: 'Screen Watching',
    badge: 'Visual Push',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    desc: 'Perceives desktop visual changes, terminal errors, and media to offer observations.',
    icon: 'i-solar:videocamera-record-bold-duotone',
  },
  {
    id: 'dual' as const,
    title: 'Dual Awareness',
    badge: 'Coordinated',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Visual screen reactions coordinated with quiet periodic ambient check-ins.',
    icon: 'i-solar:radar-bold-duotone',
  },
]

// --- 3. Screen Watching Sub-Settings ---
const screenWatcherMode = ref<'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'>(
  draft.state.screenWatcherMode || 'voice-and-bubble',
)
const screenWatcherTier = ref<'lightweight' | 'moondream'>(
  draft.state.screenWatcherTier || 'lightweight',
)
const screenWatcherInterval = ref<number>(
  draft.state.screenWatcherInterval || 2000,
)

const reactionModes = [
  {
    id: 'voice-and-bubble' as const,
    title: 'Voice & Bubble',
    badge: 'Full Immersion',
    desc: 'Speaks out loud with floating speech bubbles on screen.',
    icon: 'i-solar:chat-round-line-bold',
  },
  {
    id: 'bubble-only' as const,
    title: 'Bubble Only',
    badge: 'Silent Subtitles',
    desc: 'Floating subtitles without audio interruptions. Great for gaming or streaming.',
    icon: 'i-solar:chat-square-bold-duotone',
  },
  {
    id: 'voice-only' as const,
    title: 'Voice Only',
    badge: 'Audio Only',
    desc: 'Audio commentary without any floating visual bubble overlays.',
    icon: 'i-solar:soundwave-bold-duotone',
  },
  {
    id: 'muted' as const,
    title: 'Silent Telemetry',
    badge: 'Log Only',
    desc: 'Observations recorded silently to context and event ledger.',
    icon: 'i-solar:eye-bold-duotone',
  },
]

const visionTiers = [
  {
    id: 'lightweight' as const,
    title: 'Lightweight OCR & Frame Diff',
    vram: '0 MB VRAM',
    desc: 'Fast local WASM OCR + perceptual pHash gating. Ultra-fast with zero cloud API costs.',
    icon: 'i-solar:shield-check-bold-duotone',
  },
  {
    id: 'moondream' as const,
    title: 'Moondream2 VLM',
    vram: '~700 MB WebGPU',
    desc: 'Local vision language model. Synthesizes 1-sentence contextual scene descriptions.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
  },
]

const screenIntervalPresets = [
  { label: '1s (High)', value: 1000 },
  { label: '2s (Balanced)', value: 2000 },
  { label: '5s (Gentle)', value: 5000 },
  { label: '10s (Eco)', value: 10000 },
]

// --- 4. Ambient Heartbeats Sub-Settings ---
const heartbeatsInterval = ref<number>(draft.state.heartbeatsInterval || 5)
const heartbeatIntervalPresets = [
  { label: '2 min (Snappy)', value: 2 },
  { label: '5 min (Recommended)', value: 5 },
  { label: '10 min (Gentle)', value: 10 },
  { label: '20 min (Relaxed)', value: 20 },
]

const heartbeatsContextWindowHistory = ref<boolean>(draft.state.heartbeatsContextWindowHistory !== false)
const heartbeatsContextSystemLoad = ref<boolean>(draft.state.heartbeatsContextSystemLoad !== false)
const heartbeatsContextUsageMetrics = ref<boolean>(draft.state.heartbeatsContextUsageMetrics !== false)

// --- 5. Smart Silence (NO_REPLY Directive) & Ledger ---
const smartSilenceDirectiveEnabled = ref<boolean>(draft.state.smartSilenceDirectiveEnabled !== false)
const sensorGroundingEnabled = ref<boolean>(draft.state.sensorGroundingEnabled !== false)
const salienceGatingEnabled = ref<boolean>(draft.state.salienceGatingEnabled !== false)
const eventLedgerEnabled = ref<boolean>(draft.state.eventLedgerEnabled !== false)
const eventLedgerSampleDepth = ref<number>(draft.state.eventLedgerSampleDepth || 6)
const eventLedgerDomains = ref<string[]>(
  draft.state.eventLedgerDomains ? [...draft.state.eventLedgerDomains] : ['vision', 'tools', 'chat', 'memory', 'discord'],
)

// --- Calculated Circadian Status ---
const isQuietHoursActive = computed(() => {
  if (!operatingScheduleEnabled.value)
    return false
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [wakeH, wakeM] = wakeUpTime.value.split(':').map(Number)
  const [bedH, bedM] = bedTime.value.split(':').map(Number)
  const wakeTotal = (wakeH || 0) * 60 + (wakeM || 0)
  const bedTotal = (bedH || 0) * 60 + (bedM || 0)

  if (bedTotal > wakeTotal) {
    return currentMinutes >= bedTotal || currentMinutes < wakeTotal
  }
  return currentMinutes >= bedTotal && currentMinutes < wakeTotal
})

onMounted(async () => {
  try {
    await proactivityStore.updateSensors?.()
  }
  catch {
    // Ignore preview error in sandbox/mock environments
  }
})

function syncDraft() {
  draft.setProactivity({
    heartbeatsEnabled: heartbeatsEnabled.value,
    heartbeatsInterval: heartbeatsInterval.value,
    operatingScheduleEnabled: operatingScheduleEnabled.value,
    wakeUpTime: wakeUpTime.value,
    bedTime: bedTime.value,
    pauseOnAfk: pauseOnAfk.value,
    afkMinutes: afkMinutes.value,
    sensorGroundingEnabled: sensorGroundingEnabled.value,
    salienceGatingEnabled: salienceGatingEnabled.value,
    heartbeatsContextWindowHistory: heartbeatsContextWindowHistory.value,
    heartbeatsContextSystemLoad: heartbeatsContextSystemLoad.value,
    heartbeatsContextUsageMetrics: heartbeatsContextUsageMetrics.value,
    eventLedgerEnabled: eventLedgerEnabled.value,
    eventLedgerSampleDepth: eventLedgerSampleDepth.value,
    eventLedgerDomains: eventLedgerDomains.value,
    smartSilenceDirectiveEnabled: smartSilenceDirectiveEnabled.value,
  })

  draft.setScreen({
    screenWatcherEnabled: screenWatcherEnabled.value,
    screenWatcherMode: screenWatcherMode.value,
    screenWatcherTier: screenWatcherTier.value,
    screenWatcherInterval: screenWatcherInterval.value,
  })
}

onBeforeUnmount(() => {
  syncDraft()
})
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-4 py-1 select-none']">
    <!-- Header Section -->
    <div :class="['flex items-start justify-between gap-4 pb-2 border-b border-neutral-200/80 dark:border-white/10']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl flex-shrink-0 mt-0.5 border border-rose-500/20 shadow-xs']">
          <div :class="['i-solar:radar-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              {{ t('onboarding.ui.proactive-presence-awareness') }}
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400']">
              {{ t('onboarding.ui.schedule-sensory-engines') }}
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            {{ t('onboarding.ui.define-when-your-companion-is-active-and-how-they-proactively-interact-with-yo') }}
          </p>
        </div>
      </div>

      <!-- Active Mode Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            proactivityEngineMode === 'dual'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : proactivityEngineMode === 'screen'
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                : proactivityEngineMode === 'heartbeats'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700',
          ]"
        >
          <span
            :class="[
              'w-1.5 h-1.5 rounded-full',
              proactivityEngineMode !== 'on-demand' ? 'bg-current animate-pulse' : 'bg-neutral-400',
            ]"
          />
          <span>{{ displayText(proactivityEngineMode.toUpperCase()) }} {{ t('onboarding.ui.active') }}</span>
        </span>
      </div>
    </div>

    <!-- Section 1: Operating Schedule & Quiet Hours (Universal Safety Boundary) -->
    <div :class="['flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:clock-circle-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.ui.operating-schedule-quiet-hours') }}
              </h3>
              <span
                :class="[
                  'text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded border',
                  isQuietHoursActive
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                ]"
              >
                {{ displayText(isQuietHoursActive ? 'QUIET HOURS (ASLEEP)' : 'ACTIVE WAKING HOURS') }}
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              {{ t('onboarding.ui.boundaries-governing-when-your-companion-can-reach-out-guarantees-100-display') }}
            </p>
          </div>
        </div>

        <!-- Master Schedule Switch -->
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            operatingScheduleEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="operatingScheduleEnabled = !operatingScheduleEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              operatingScheduleEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <!-- Schedule Inputs -->
      <div v-if="operatingScheduleEnabled" :class="['flex flex-col gap-3 pt-2.5 border-t border-neutral-200/60 dark:border-white/5 animate-fadeIn']">
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3']">
          <!-- Wake Up Time -->
          <div :class="['flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
              <div :class="['i-solar:sun-2-bold-duotone text-amber-500']" />
              <span>{{ t('onboarding.ui.wake-up-time') }}</span>
            </label>
            <input
              v-model="wakeUpTime"
              type="time"
              :class="['px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500']"
              @change="syncDraft()"
            >
          </div>

          <!-- Bed Time -->
          <div :class="['flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
              <div :class="['i-solar:moon-bold-duotone text-indigo-500']" />
              <span>{{ t('onboarding.ui.bedtime-quiet-hours-start') }}</span>
            </label>
            <input
              v-model="bedTime"
              type="time"
              :class="['px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500']"
              @change="syncDraft()"
            >
          </div>
        </div>

        <!-- AFK Presence Gate -->
        <div :class="['flex items-center justify-between p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
          <div :class="['flex items-center gap-2.5']">
            <input
              id="afk-pause-toggle"
              v-model="pauseOnAfk"
              type="checkbox"
              :class="['h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <label for="afk-pause-toggle" :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 cursor-pointer']">
              {{ t('onboarding.ui.pause-proactive-messages-when-away-afk') }}
            </label>
          </div>
          <div v-if="pauseOnAfk" :class="['flex items-center gap-1.5 text-xs text-neutral-500']">
            <span>{{ t('onboarding.ui.after') }}</span>
            <input
              v-model.number="afkMinutes"
              type="number"
              min="1"
              max="60"
              :class="['w-12 px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs text-center font-mono']"
              @change="syncDraft()"
            >
            <span>{{ t('onboarding.ui.min') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Proactivity Engine Selection (4 Mode Cards) -->
    <div :class="['flex flex-col gap-3.5 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md']">
      <div>
        <div :class="['flex items-center gap-2']">
          <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
            {{ t('onboarding.ui.proactivity-engine') }}
          </h3>
          <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20']">
            {{ t('onboarding.ui.interaction-style') }}
          </span>
        </div>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
          {{ t('onboarding.ui.select-how-your-companion-perceives-and-initiates-interactions-throughout-the') }}
        </p>
      </div>

      <!-- 4 Engine Cards Grid -->
      <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1']">
        <button
          v-for="mode in engineModes"
          :key="mode.id"
          type="button"
          :class="[
            'flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer select-none',
            proactivityEngineMode === mode.id
              ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30 shadow-xs'
              : 'border-neutral-200/80 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="selectEngineMode(mode.id)"
        >
          <div>
            <div :class="['flex items-center justify-between mb-2']">
              <div
                :class="[
                  'w-8 h-8 rounded-lg flex items-center justify-center text-base transition-colors',
                  proactivityEngineMode === mode.id
                    ? 'bg-primary-500 text-white shadow-xs'
                    : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500',
                ]"
              >
                <div :class="mode.icon" />
              </div>
              <span :class="['text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border', mode.badgeColor]">
                {{ displayText(mode.badge) }}
              </span>
            </div>
            <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white mb-1']">
              {{ displayText(mode.title) }}
            </h4>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug']">
              {{ displayText(mode.desc) }}
            </p>
          </div>

          <div :class="['mt-3 pt-2 border-t border-neutral-200/50 dark:border-white/5 flex items-center justify-between text-[10px] font-medium']">
            <span :class="proactivityEngineMode === mode.id ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-neutral-400'">
              {{ displayText(proactivityEngineMode === mode.id ? 'Active' : 'Select') }}
            </span>
            <div :class="[proactivityEngineMode === mode.id ? 'i-solar:check-circle-bold text-primary-500' : 'i-solar:circle-linear text-neutral-400', 'w-3.5 h-3.5']" />
          </div>
        </button>
      </div>
    </div>

    <!-- Section 3: Contextual Tuning (Only displayed when active) -->
    <div
      v-if="proactivityEngineMode !== 'on-demand'"
      :class="['flex flex-col gap-4 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md animate-fadeIn']"
    >
      <div>
        <div :class="['flex items-center gap-2']">
          <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
            {{ t('onboarding.ui.engine-fine-tuning') }}
          </h3>
          <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20']">
            {{ t('onboarding.ui.cadence-sensors') }}
          </span>
        </div>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
          {{ t('onboarding.ui.fine-tune-reaction-behavior-capture-resolution-and-smart-silence-guarantees') }}
        </p>
      </div>

      <!-- Subsection A: Screen Watching Settings (If Screen or Dual) -->
      <div v-if="screenWatcherEnabled" :class="['flex flex-col gap-3 pt-2 border-t border-neutral-200/60 dark:border-white/5']">
        <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
          <div :class="['i-solar:videocamera-record-bold-duotone text-sky-500']" />
          <span>{{ t('onboarding.ui.screen-reaction-delivery-mode') }}</span>
        </label>
        <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2']">
          <button
            v-for="mode in reactionModes"
            :key="mode.id"
            type="button"
            :class="[
              'p-2.5 rounded-xl border text-left transition-all cursor-pointer select-none',
              screenWatcherMode === mode.id
                ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white font-medium ring-1 ring-primary-500/30'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="screenWatcherMode = mode.id; syncDraft()"
          >
            <div :class="['flex items-center gap-1.5 mb-1']">
              <div :class="[mode.icon, 'w-3.5 h-3.5 text-primary-500']" />
              <span :class="['text-xs font-bold']">{{ displayText(mode.title) }}</span>
            </div>
            <p :class="['text-[10px] text-neutral-400 leading-snug line-clamp-2']">
              {{ displayText(mode.desc) }}
            </p>
          </button>
        </div>

        <!-- Vision Perception Tier & Interval -->
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1']">
          <!-- Perception Engine Tier -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
              {{ t('onboarding.ui.perception-engine-tier') }}
            </label>
            <div :class="['grid grid-cols-2 gap-1.5']">
              <button
                v-for="tier in visionTiers"
                :key="tier.id"
                type="button"
                :class="[
                  'p-2 rounded-xl border text-left transition-all cursor-pointer',
                  screenWatcherTier === tier.id
                    ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                    : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400',
                ]"
                @click="screenWatcherTier = tier.id; syncDraft()"
              >
                <div :class="['text-xs font-bold truncate']">
                  {{ displayText(tier.title) }}
                </div>
                <div :class="['text-[9px] font-mono text-primary-500 font-semibold']">
                  {{ displayText(tier.vram) }}
                </div>
              </button>
            </div>
          </div>

          <!-- Screen Sampling Cadence -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
              {{ t('onboarding.ui.screen-sampling-cadence') }}
            </label>
            <div :class="['grid grid-cols-4 gap-1.5']">
              <button
                v-for="preset in screenIntervalPresets"
                :key="preset.value"
                type="button"
                :class="[
                  'py-2 px-1 rounded-xl border text-[11px] font-medium transition-all text-center cursor-pointer',
                  screenWatcherInterval === preset.value
                    ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400',
                ]"
                @click="screenWatcherInterval = preset.value; syncDraft()"
              >
                {{ displayText(preset.label) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Subsection B: Ambient Heartbeats Cadence (If Heartbeats or Dual) -->
      <div v-if="heartbeatsEnabled" :class="['flex flex-col gap-3 pt-2 border-t border-neutral-200/60 dark:border-white/5']">
        <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
          <div :class="['i-solar:heart-pulse-2-bold-duotone text-rose-500']" />
          <span>{{ t('onboarding.ui.ambient-check-in-cadence') }}</span>
        </label>
        <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2']">
          <button
            v-for="preset in heartbeatIntervalPresets"
            :key="preset.value"
            type="button"
            :class="[
              'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer',
              heartbeatsInterval === preset.value
                ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="heartbeatsInterval = preset.value; syncDraft()"
          >
            {{ displayText(preset.label) }}
          </button>
        </div>

        <!-- Telemetry Grounding Checkboxes -->
        <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1']">
          <label :class="['flex items-center gap-2 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-2.5 text-xs cursor-pointer']">
            <input
              v-model="heartbeatsContextWindowHistory"
              type="checkbox"
              :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <span :class="['text-neutral-700 dark:text-neutral-300 font-medium']">{{ t('onboarding.ui.active-window-app-history') }}</span>
          </label>

          <label :class="['flex items-center gap-2 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-2.5 text-xs cursor-pointer']">
            <input
              v-model="heartbeatsContextSystemLoad"
              type="checkbox"
              :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
              @change="syncDraft()"
            >
            <span :class="['text-neutral-700 dark:text-neutral-300 font-medium']">{{ t('onboarding.ui.cpu-system-load-telemetry') }}</span>
          </label>
        </div>
      </div>

      <!-- Subsection C: Smart Silence (NO_REPLY Directive) -->
      <div :class="['flex items-center justify-between p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] mt-1']">
        <div :class="['flex flex-col pr-3']">
          <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            {{ t('onboarding.ui.smart-silence-no-reply-directive') }}
          </span>
          <span :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
            {{ t('onboarding.ui.instructs-the-companion-to-stay-completely-silent-via-no-reply-unless-there-is') }}
          </span>
        </div>
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            smartSilenceDirectiveEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="smartSilenceDirectiveEnabled = !smartSilenceDirectiveEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              smartSilenceDirectiveEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']">
      <Button
        variant="ghost"
        :class="['text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-linear mr-1']" />
        {{ t('onboarding.shell.previous') }}
      </Button>

      <div :class="['text-xs font-mono text-neutral-400']">
        {{ t('onboarding.ui.status') }} <span :class="['font-semibold text-neutral-700 dark:text-neutral-300 capitalize']">{{ displayText(proactivityEngineMode) }}</span>
      </div>

      <Button
        variant="primary"
        :class="['px-6 py-2 rounded-xl text-xs font-semibold shadow-md shadow-primary-500/20 cursor-pointer']"
        @click="() => { syncDraft(); props.onNext() }"
      >
        {{ t('onboarding.shell.next') }}
        <div :class="['i-solar:alt-arrow-right-linear ml-1']" />
      </Button>
    </div>
  </div>
</template>
