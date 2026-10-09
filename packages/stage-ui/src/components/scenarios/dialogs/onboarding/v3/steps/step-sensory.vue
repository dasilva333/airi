<script setup lang="ts">
import { useOnboardingDisplayText } from '../composables/use-onboarding-display-text'
import { useI18n } from 'vue-i18n'

import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { formatSensorPayload } from '@proj-airi/stage-ui/stores/proactivity-telemetry'
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

// --- State Bindings: Screen Watching (Visual Push) ---
const screenWatcherEnabled = ref<boolean>(draft.state.screenWatcherEnabled !== false)
const screenWatcherMode = ref<'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'>(
  draft.state.screenWatcherMode || 'voice-and-bubble',
)
const screenWatcherTier = ref<'lightweight' | 'moondream'>(
  draft.state.screenWatcherTier || 'lightweight',
)
const screenWatcherInterval = ref<number>(
  draft.state.screenWatcherInterval || 2000,
)

// --- State Bindings: Proactive Heartbeats (Ambient Pull) ---
const heartbeatsEnabled = ref<boolean>(draft.state.heartbeatsEnabled !== false)
const heartbeatsInterval = ref<number>(draft.state.heartbeatsInterval || 5)

// --- State Bindings: Circadian Rhythm & Sleep Gate ---
const operatingScheduleEnabled = ref<boolean>(draft.state.operatingScheduleEnabled !== false)
const wakeUpTime = ref<string>(draft.state.wakeUpTime || '09:00')
const bedTime = ref<string>(draft.state.bedTime || '22:00')
const pauseOnAfk = ref<boolean>(draft.state.pauseOnAfk !== false)
const afkMinutes = ref<number>(draft.state.afkMinutes || 5)

// --- State Bindings: Situational Grounding & Probes (Context Injections) ---
const sensorGroundingEnabled = ref<boolean>(draft.state.sensorGroundingEnabled !== false)
const salienceGatingEnabled = ref<boolean>(draft.state.salienceGatingEnabled !== false)
const heartbeatsContextWindowHistory = ref<boolean>(draft.state.heartbeatsContextWindowHistory !== false)
const heartbeatsContextSystemLoad = ref<boolean>(draft.state.heartbeatsContextSystemLoad !== false)
const heartbeatsContextUsageMetrics = ref<boolean>(draft.state.heartbeatsContextUsageMetrics !== false)
const smartSilenceDirectiveEnabled = ref<boolean>(draft.state.smartSilenceDirectiveEnabled !== false)

// --- State Bindings: Event Ledger Stream ---
const eventLedgerEnabled = ref<boolean>(draft.state.eventLedgerEnabled !== false)
const eventLedgerSampleDepth = ref<number>(draft.state.eventLedgerSampleDepth || 6)
const eventLedgerDomains = ref<string[]>(
  draft.state.eventLedgerDomains ? [...draft.state.eventLedgerDomains] : ['vision', 'tools', 'chat', 'memory', 'discord'],
)

function toggleLedgerDomain(domain: string) {
  if (eventLedgerDomains.value.includes(domain)) {
    eventLedgerDomains.value = eventLedgerDomains.value.filter(d => d !== domain)
  }
  else {
    eventLedgerDomains.value = [...eventLedgerDomains.value, domain]
  }
  syncDraft()
}

// --- Reaction Delivery Modes Catalog ---
const reactionModes = [
  {
    id: 'voice-and-bubble' as const,
    title: 'Voice & Bubble',
    badge: 'Full Immersion',
    badgeColor: 'bg-primary-500/10 text-primary-500 border-primary-500/20',
    desc: 'Companion speaks out loud with floating speech bubbles on screen.',
    icon: 'i-solar:chat-round-line-bold',
  },
  {
    id: 'bubble-only' as const,
    title: 'Bubble Only',
    badge: 'Silent Subtitles',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    desc: 'Floating subtitles without audio interruptions. Ideal for gaming or streaming.',
    icon: 'i-solar:chat-square-bold-duotone',
  },
  {
    id: 'voice-only' as const,
    title: 'Voice Only',
    badge: 'Audio Commentary',
    badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    desc: 'Audio commentary without any floating visual bubbles overlay.',
    icon: 'i-solar:soundwave-bold-duotone',
  },
  {
    id: 'muted' as const,
    title: 'Silent Telemetry',
    badge: 'Log & Ledger',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    desc: 'Telemetry observations recorded silently to context and event ledger.',
    icon: 'i-solar:eye-bold-duotone',
  },
]

// --- Vision Analysis Tiers ---
const visionTiers = [
  {
    id: 'lightweight' as const,
    title: 'Lightweight OCR & Frame Diff',
    vram: '0 MB VRAM',
    desc: 'Instant local WASM OCR + perceptual pHash gating. Ultra-fast with zero cloud API costs.',
    icon: 'i-solar:shield-check-bold-duotone',
  },
  {
    id: 'moondream' as const,
    title: 'Moondream2 VLM',
    vram: '~700 MB WebGPU',
    desc: 'Local vision language model. Synthesizes 1-sentence contextual scene descriptions for promoted events.',
    icon: 'i-solar:magic-stick-3-bold-duotone',
  },
]

// --- Interval Presets ---
const screenIntervalPresets = [
  { label: '1s (High)', value: 1000 },
  { label: '2s (Balanced)', value: 2000 },
  { label: '5s (Gentle)', value: 5000 },
  { label: '10s (Eco)', value: 10000 },
]

const heartbeatIntervalPresets = [
  { label: '2 min', value: 2 },
  { label: '5 min (Recommended)', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
]

// --- Circadian Status Calculation ---
const isQuietHoursActive = computed(() => {
  if (!operatingScheduleEnabled.value)
    return false
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [wakeH, wakeM] = wakeUpTime.value.split(':').map(Number)
  const [bedH, bedM] = bedTime.value.split(':').map(Number)
  const wakeMinutes = (wakeH || 9) * 60 + (wakeM || 0)
  const bedMinutes = (bedH || 22) * 60 + (bedM || 0)

  if (bedMinutes > wakeMinutes) {
    return currentMinutes >= bedMinutes || currentMinutes < wakeMinutes
  }
  else {
    return currentMinutes >= bedMinutes && currentMinutes < wakeMinutes
  }
})

// --- Live Telemetry Probing & Full Dump Payload ---
const isRefreshingSensors = ref(false)

const staticSamplePayload = `[Sensor Data]
User Idle: 0s
Active Program: Electron
Active Window Title: AIRI - Control Strip

[ Previous History ]
[ Xcode | Archives ] [ 9s ] [ 00:36 - 00:36 ]
[ Electron | AIRI - Control Strip ] [ 30s ] [ 00:35 - 00:35 ]`

const displayPayload = computed(() => {
  const payload = formatSensorPayload({
    idleTimeSec: proactivityStore.idleTimeSec,
    winHistory: proactivityStore.winHistory,
    sysLoad: proactivityStore.sysLoad,
    volLevel: proactivityStore.volLevel,
    locTime: proactivityStore.locTime,
    resolvedDefaultBackgroundName: 'none',
    contextOptions: {
      windowHistory: heartbeatsContextWindowHistory.value,
      systemLoad: heartbeatsContextSystemLoad.value,
      usageMetrics: heartbeatsContextUsageMetrics.value,
    },
    metrics: {
      recentTtsCount: 0,
      recentSttCount: 0,
      recentChatCount: 0,
      recentJournalEntryCount: 0,
      turnCount: 0,
      nextMilestone: 100,
    },
  })

  // If real sensor data is available with winHistory or system load, return full formatted payload
  if (payload && (proactivityStore.winHistory?.length > 0 || proactivityStore.sysLoad)) {
    return payload.trim()
  }

  // If activeWinStr is present but winHistory hasn't filled yet, compose a full live preview
  if (proactivityStore.activeWinStr) {
    let str = `[Sensor Data]\n`
    str += `User Idle: ${proactivityStore.idleTimeSec ?? 0}s\n`
    str += `Active Program: Electron\n`
    str += `Active Window Title: ${proactivityStore.activeWinStr}\n`

    if (heartbeatsContextWindowHistory.value) {
      str += `\n[ Previous History ]\n`
      str += `[ Electron | ${proactivityStore.activeWinStr} ] [ 30s ] [ ${proactivityStore.locTime || '00:35'} - ${proactivityStore.locTime || '00:35'} ]\n`
    }

    if (heartbeatsContextSystemLoad.value && proactivityStore.sysLoad) {
      str += `CPU Load (1/5/15): ${proactivityStore.sysLoad.cpu[0].toFixed(2)} | ${proactivityStore.sysLoad.cpu[1].toFixed(2)} | ${proactivityStore.sysLoad.cpu[2].toFixed(2)}\n`
      str += `GPU Load (Avg): ${proactivityStore.sysLoad.gpuAvg.toFixed(2)}\n`
    }
    else if (!heartbeatsContextSystemLoad.value) {
      str += `System Load: [DISABLED]\n`
    }

    str += `Volume Level: ${proactivityStore.volLevel ?? 85}%\n`
    str += `Current Local Time: ${proactivityStore.locTime || '00:36'}\n`
    str += `Active Character Default Background: none\n`

    if (heartbeatsContextUsageMetrics.value) {
      str += `\n[Usage Metrics (Last Hr)]\n`
      str += `TTS (Last Hr): 0\n`
      str += `STT (Last Hr): 0\n`
      str += `Chat (Last Hr): 0\n`
      str += `Journal Entries (Last Hr): 0\n`
      str += `Turn Count: 0 (Next Target: 100)\n`
    }
    else {
      str += `\n[Metrics]: [DISABLED]\n`
    }

    return str.trim()
  }

  return staticSamplePayload
})

async function refreshTelemetry() {
  isRefreshingSensors.value = true
  try {
    await proactivityStore.updateSensors()
  }
  catch (err) {
    console.warn('[StepSensory] Failed to probe telemetry:', err)
  }
  finally {
    isRefreshingSensors.value = false
  }
}

onMounted(() => {
  void refreshTelemetry()
})

// --- Draft Synchronization ---
function syncDraft() {
  draft.setSensory({
    screenWatcherEnabled: screenWatcherEnabled.value,
    screenWatcherMode: screenWatcherMode.value,
    screenWatcherTier: screenWatcherTier.value,
    screenWatcherInterval: screenWatcherInterval.value,
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
}

onBeforeUnmount(() => {
  syncDraft()
})

function handleNext() {
  syncDraft()
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-6 py-2 my-auto animate-fadeIn']">
    <!-- Step Header -->
    <div :class="['sticky top-0 z-20 bg-neutral-50/95 dark:bg-[#0c0c0e]/95 backdrop-blur-md flex items-start justify-between gap-4 border-b border-neutral-200/60 dark:border-white/5 pb-3 pt-2 -mx-2 px-2']">
      <div :class="['flex items-center gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-xl flex-shrink-0']">
          <div :class="['i-solar:radar-2-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              {{ t('onboarding.ui.sensory-perception-proactivity') }}
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400']">
              {{ t('onboarding.ui.step-13') }}
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            {{ t('onboarding.ui.equip-your-companion-with-real-time-environmental-awareness-balance') }} <span class="text-neutral-800 font-semibold dark:text-neutral-200">{{ t('onboarding.ui.visual-push') }}</span> {{ t('onboarding.ui.screen-watching-and') }} <span class="text-neutral-800 font-semibold dark:text-neutral-200">{{ t('onboarding.ui.ambient-pull') }}</span> {{ t('onboarding.ui.proactive-heartbeats-governed-by-an') }} <span class="text-neutral-800 font-semibold dark:text-neutral-200">{{ t('onboarding.ui.operating-sleep-schedule') }}</span> {{ t('onboarding.ui.and') }} <span class="text-neutral-800 font-semibold dark:text-neutral-200">{{ t('onboarding.ui.smart-silence-no-reply') }}</span>.
          </p>
        </div>
      </div>

      <!-- Active Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            screenWatcherEnabled || heartbeatsEnabled
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700',
          ]"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', screenWatcherEnabled || heartbeatsEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400']" />
          <span>{{ displayText(screenWatcherEnabled || heartbeatsEnabled ? 'PERCEPTION ACTIVE' : 'PASSIVE / DORMANT') }}</span>
        </span>
      </div>
    </div>

    <!-- Section 1: Screen Watching (Visual Push) -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-sm']">
      <!-- Section 1 Header with Master Switch -->
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:eye-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.ui.screen-perception-visual-push') }}
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20']">
                {{ t('onboarding.ui.event-driven-push') }}
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              {{ t('onboarding.ui.autonomous-perception-ticker-analyzing-your-desktop-display-reacts-in-real-tim') }}
            </p>
          </div>
        </div>

        <!-- Master Switch -->
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            screenWatcherEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="screenWatcherEnabled = !screenWatcherEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              screenWatcherEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <!-- Enabled Options Container -->
      <div v-if="screenWatcherEnabled" :class="['flex flex-col gap-4 pt-3 border-t border-neutral-200/60 dark:border-white/5']">
        <!-- Reaction Delivery Modes -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5']">
            <span>{{ t('onboarding.ui.reaction-delivery-mode') }}</span>
            <span :class="['text-[10px] text-neutral-400 font-normal font-sans']">{{ t('onboarding.ui.choose-how-your-companion-chimes-in') }}</span>
          </label>

          <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5']">
            <div
              v-for="mode in reactionModes"
              :key="mode.id"
              :class="[
                'p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
                screenWatcherMode === mode.id
                  ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500'
                  : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="screenWatcherMode = mode.id; syncDraft()"
            >
              <div>
                <div :class="['flex items-center justify-between mb-2']">
                  <div :class="['w-7 h-7 rounded-lg bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center text-sm text-neutral-600 dark:text-neutral-300 group-hover:text-primary-500 transition-colors']">
                    <div :class="[mode.icon, 'w-4 h-4']" />
                  </div>
                  <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono', mode.badgeColor]">
                    {{ displayText(mode.badge) }}
                  </span>
                </div>
                <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                  {{ displayText(mode.title) }}
                </h4>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                  {{ displayText(mode.desc) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Vision Analysis Engine & Polling Cadence -->
        <div :class="['grid grid-cols-1 md:grid-cols-2 gap-3 pt-1']">
          <!-- Analysis Engine Tier -->
          <div :class="['flex flex-col gap-2']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
              {{ t('onboarding.ui.perception-engine-tier') }}
            </label>
            <div :class="['grid grid-cols-1 gap-2']">
              <div
                v-for="tier in visionTiers"
                :key="tier.id"
                :class="[
                  'p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left',
                  screenWatcherTier === tier.id
                    ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500'
                    : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
                ]"
                @click="screenWatcherTier = tier.id; syncDraft()"
              >
                <div :class="['flex items-start gap-2.5']">
                  <div :class="['w-6 h-6 rounded-lg bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center text-xs text-neutral-600 dark:text-neutral-300 flex-shrink-0 mt-0.5']">
                    <div :class="[tier.icon, 'w-3.5 h-3.5']" />
                  </div>
                  <div>
                    <h5 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                      {{ displayText(tier.title) }}
                    </h5>
                    <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                      {{ displayText(tier.desc) }}
                    </p>
                  </div>
                </div>
                <span :class="['text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-200/60 dark:bg-white/10 text-neutral-700 dark:text-neutral-300 flex-shrink-0 whitespace-nowrap']">
                  {{ displayText(tier.vram) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Capture Cadence Presets -->
          <div :class="['flex flex-col gap-2']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
              {{ t('onboarding.ui.capture-sampling-frequency') }}
            </label>
            <div :class="['grid grid-cols-2 gap-2']">
              <button
                v-for="preset in screenIntervalPresets"
                :key="preset.value"
                type="button"
                :class="[
                  'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5',
                  screenWatcherInterval === preset.value
                    ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                    : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                ]"
                @click="screenWatcherInterval = preset.value; syncDraft()"
              >
                <span>{{ displayText(preset.label) }}</span>
                <span :class="['text-[9px] opacity-70 font-mono']">{{ displayText(preset.value) }}{{ t('onboarding.ui.ms-ticker') }}</span>
              </button>
            </div>
            <p :class="['text-[10px] text-neutral-400 mt-1 leading-snug']">
              {{ t('onboarding.ui.frames-are-continuously-hashed-with-phash-only-frames-with-meaningful-visual-d') }}
            </p>
          </div>
        </div>

        <!-- Visual Push NO_REPLY Sentinel Callout -->
        <div :class="['p-3 rounded-xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5']">
          <div :class="['w-5 h-5 rounded-md bg-sky-500/10 text-sky-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:shield-check-bold w-3.5 h-3.5']" />
          </div>
          <div>
            <h5 :class="['text-xs font-bold text-sky-900 dark:text-sky-300']">
              {{ t('onboarding.ui.the-visual-push-sentinel-silent-by-default') }}
            </h5>
            <p :class="['text-[11px] text-sky-800/80 dark:text-sky-300/70 mt-0.5 leading-relaxed']">
              {{ t('onboarding.ui.whenever-screen-shifts-occur-your-companion-evaluates-whether-the-change-is-ge') }} <code class="rounded bg-sky-500/15 px-1 py-0.2 text-[10px] font-mono">NO_REPLY</code> {{ t('onboarding.ui.without-interrupting-your-flow') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 2: Proactive Heartbeats & Circadian Rhythm (Ambient Pull & Universal Sleep Gate) -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-sm']">
      <!-- Section 2 Header with Master Switch -->
      <div :class="['flex items-start justify-between gap-4']">
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:heart-pulse-2-bold-duotone w-4 h-4']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.ui.proactive-heartbeats-sleep-schedule') }}
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20']">
                {{ t('onboarding.ui.ambient-pull-96855e5d') }}
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              {{ t('onboarding.ui.periodic-background-timer-check-ins-evaluating-whether-to-speak-bound-to-your') }}
            </p>
          </div>
        </div>

        <!-- Master Switch -->
        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            heartbeatsEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="heartbeatsEnabled = !heartbeatsEnabled; syncDraft()"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              heartbeatsEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <!-- Enabled Options Container -->
      <div v-if="heartbeatsEnabled" :class="['flex flex-col gap-4 pt-3 border-t border-neutral-200/60 dark:border-white/5']">
        <!-- Cadence Presets -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
            {{ t('onboarding.ui.ambient-check-in-interval') }}
          </label>
          <div :class="['grid grid-cols-2 sm:grid-cols-4 gap-2']">
            <button
              v-for="preset in heartbeatIntervalPresets"
              :key="preset.value"
              type="button"
              :class="[
                'py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5',
                heartbeatsInterval === preset.value
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold'
                  : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="heartbeatsInterval = preset.value; syncDraft()"
            >
              <span>{{ displayText(preset.label) }}</span>
              <span :class="['text-[9px] opacity-70 font-mono']">{{ t('onboarding.ui.timer-pulse') }}</span>
            </button>
          </div>
        </div>

        <!-- Universal Circadian & Bedtime Schedule -->
        <div :class="['p-4 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-3']">
          <div :class="['flex items-start justify-between gap-4']">
            <div>
              <div :class="['flex items-center gap-2']">
                <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-1.5']">
                  <div :class="['i-solar:moon-sleep-bold-duotone w-4 h-4 text-indigo-500']" />
                  <span>{{ t('onboarding.ui.operating-schedule-quiet-hours') }}</span>
                </h4>
                <span
                  :class="[
                    'text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border',
                    isQuietHoursActive
                      ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  ]"
                >
                  {{ displayText(isQuietHoursActive ? '🌙 QUIET HOURS ACTIVE' : '☀️ COMPANION AWAKE') }}
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                {{ t('onboarding.ui.define-quiet-hours-when-your-companion-sleeps-during-quiet-hours-companion-wil') }}
              </p>
            </div>

            <!-- Schedule Switch -->
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                operatingScheduleEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="operatingScheduleEnabled = !operatingScheduleEnabled; syncDraft()"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  operatingScheduleEnabled ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>

          <!-- Bedtime & Wake Time Inputs -->
          <div v-if="operatingScheduleEnabled" :class="['grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200/40 dark:border-white/5']">
            <div :class="['flex items-center justify-between p-2.5 rounded-lg bg-neutral-100/60 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10']">
              <div :class="['flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300']">
                <div :class="['i-solar:sun-2-bold-duotone text-amber-500 w-4 h-4']" />
                <span>{{ t('onboarding.ui.wake-up-time-7d8d56ef') }}</span>
              </div>
              <input
                v-model="wakeUpTime"
                type="time"
                :class="['bg-white dark:bg-black/40 border border-neutral-300 dark:border-white/15 rounded-md px-2 py-1 text-xs font-mono text-neutral-800 dark:text-white outline-none focus:border-primary-500']"
                @change="syncDraft()"
              >
            </div>

            <div :class="['flex items-center justify-between p-2.5 rounded-lg bg-neutral-100/60 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10']">
              <div :class="['flex items-center gap-2 text-xs font-medium text-neutral-700 dark:text-neutral-300']">
                <div :class="['i-solar:moon-bold-duotone text-indigo-400 w-4 h-4']" />
                <span>{{ t('onboarding.ui.bedtime-quiet-hours') }}</span>
              </div>
              <input
                v-model="bedTime"
                type="time"
                :class="['bg-white dark:bg-black/40 border border-neutral-300 dark:border-white/15 rounded-md px-2 py-1 text-xs font-mono text-neutral-800 dark:text-white outline-none focus:border-primary-500']"
                @change="syncDraft()"
              >
            </div>
          </div>

          <!-- Sleep Schedule Callout (Applies to BOTH Screen Watching & Heartbeats) -->
          <div :class="['p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2.5']">
            <div :class="['w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs flex-shrink-0 mt-0.5']">
              <div :class="['i-solar:lock-bold w-3.5 h-3.5']" />
            </div>
            <div>
              <h5 :class="['text-xs font-bold text-indigo-900 dark:text-indigo-300']">
                {{ t('onboarding.ui.sleep-schedule-applies-to-both-screen-watching-heartbeats') }}
              </h5>
              <p :class="['text-[11px] text-indigo-800/80 dark:text-indigo-300/70 mt-0.5 leading-relaxed']">
                {{ t('onboarding.ui.during-bedtime-quiet-hours') }} <span class="text-neutral-900 font-semibold dark:text-white">{{ t('onboarding.ui.both') }}</span> {{ t('onboarding.ui.systems-go-completely-dormant-screen-frame-capture-is-frozen-for') }} <span class="text-neutral-900 font-semibold dark:text-white">{{ t('onboarding.ui.100-display-privacy') }}</span> {{ t('onboarding.ui.no-watching-during-off-hours-and-background-heartbeat-timers-cease-all-evaluat') }}
              </p>
            </div>
          </div>

          <!-- AFK Presence Gating -->
          <div :class="['flex items-center justify-between gap-4 pt-1']">
            <div :class="['flex items-center gap-2.5']">
              <div :class="['w-6 h-6 rounded-lg bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center text-neutral-600 dark:text-neutral-300']">
                <div :class="['i-solar:user-cross-bold-duotone w-3.5 h-3.5']" />
              </div>
              <div>
                <h5 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                  {{ t('onboarding.ui.pause-when-away-from-computer-afk-gate') }}
                </h5>
                <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400']">
                  {{ t('onboarding.ui.automatically-pauses-screen-watching-and-heartbeats-after-5-min-of-mouse-keybo') }}
                </p>
              </div>
            </div>

            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                pauseOnAfk ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="pauseOnAfk = !pauseOnAfk; syncDraft()"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  pauseOnAfk ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
        </div>

        <!-- Context-Aware Smart Silence Directive (No-Yapping Guarantee) -->
        <div :class="['p-4 rounded-xl border transition-all flex flex-col gap-2.5', smartSilenceDirectiveEnabled ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/20' : 'bg-neutral-50/50 dark:bg-white/[0.02] border-neutral-200/60 dark:border-white/5']">
          <div :class="['flex items-start justify-between gap-4']">
            <div :class="['flex items-start gap-2.5']">
              <div :class="['w-6 h-6 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs flex-shrink-0 mt-0.5']">
                <div :class="['i-solar:shield-check-bold w-4 h-4']" />
              </div>
              <div>
                <div :class="['flex items-center gap-2']">
                  <h5 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    {{ t('onboarding.ui.context-aware-smart-silence-directive') }}
                  </h5>
                  <span :class="['text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase']">
                    {{ t('onboarding.ui.no-yap-guarantee') }}
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
                  {{ t('onboarding.ui.automatically-bakes-a-hardened-anti-yapping-instruction-directly-into-your-com') }} <code class="rounded bg-neutral-200 px-1 py-0.2 text-[10px] font-mono dark:bg-white/10">NO_REPLY</code> {{ t('onboarding.ui.instead-of-speaking-unsolicited-spam') }}
                </p>
              </div>
            </div>

            <!-- Switch Toggle -->
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5',
                smartSilenceDirectiveEnabled ? 'bg-rose-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="smartSilenceDirectiveEnabled = !smartSilenceDirectiveEnabled; syncDraft()"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  smartSilenceDirectiveEnabled ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Section 3: Situational Grounding & Telemetry Ingestion (Sensor & Ledger) -->
    <div :class="['flex flex-col gap-4 p-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] shadow-sm']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
          <div :class="['i-solar:radar-bold-duotone w-4 h-4']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
              {{ t('onboarding.ui.situational-grounding-event-ledger') }}
            </h3>
            <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20']">
              {{ t('onboarding.ui.context-injections') }}
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            {{ t('onboarding.ui.feed-real-world-desktop-state-active-application-history-and-system-ledger-eve') }}
          </p>
        </div>
      </div>

      <div :class="['flex flex-col gap-4 pt-1']">
        <!-- Manual Chat Grounding Toggle -->
        <div :class="['flex items-center gap-3 rounded-xl bg-neutral-100/60 dark:bg-white/5 p-3 border border-neutral-200/60 dark:border-white/10']">
          <input
            id="manual-grounding-toggle"
            v-model="sensorGroundingEnabled"
            type="checkbox"
            :class="['h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer']"
            @change="syncDraft()"
          >
          <div :class="['flex flex-col']">
            <label for="manual-grounding-toggle" :class="['text-xs text-neutral-800 font-semibold dark:text-neutral-200 cursor-pointer']">
              {{ t('onboarding.ui.attach-sensor-telemetry-to-manual-chat-messages-chatbox-grounding') }}
            </label>
            <span :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
              {{ t('onboarding.ui.grounds-normal-user-prompts-with-your-active-window-title-application-name-and') }}
            </span>
          </div>
        </div>

        <!-- Active OS Sensor Probes -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300']">
            {{ t('onboarding.ui.active-os-sensor-probes') }}
          </label>
          <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextWindowHistory"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">{{ t('onboarding.ui.window-history') }}</span>
            </label>

            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextSystemLoad"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">{{ t('onboarding.ui.cpu-system-load') }}</span>
            </label>

            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextUsageMetrics"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">{{ t('onboarding.ui.usage-metrics') }}</span>
            </label>
          </div>
        </div>

        <!-- Unified Event Ledger Integration -->
        <div :class="['flex flex-col gap-3 border-t border-neutral-200/60 dark:border-white/5 pt-3']">
          <div :class="['flex items-center justify-between gap-4']">
            <div :class="['flex items-center gap-2']">
              <input
                id="ledger-stream-toggle"
                v-model="eventLedgerEnabled"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <label for="ledger-stream-toggle" :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300 cursor-pointer']">
                {{ t('onboarding.ui.attach-unified-event-ledger-stream') }}
              </label>
            </div>
            <div :class="['flex items-center gap-1.5 text-xs text-neutral-500']">
              <span>{{ t('onboarding.ui.sample-last') }}</span>
              <input
                v-model.number="eventLedgerSampleDepth"
                type="number"
                min="1"
                max="20"
                :class="['w-12 border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-100 dark:bg-white/5 px-2 py-0.5 text-center text-xs font-mono text-neutral-800 dark:text-white outline-none focus:border-primary-500']"
                @change="syncDraft()"
              >
              <span>{{ t('onboarding.ui.events') }}</span>
            </div>
          </div>

          <!-- Ledger Domain Badges -->
          <div :class="['flex flex-wrap items-center gap-1.5']">
            <button
              v-for="domain in ['vision', 'tools', 'chat', 'memory', 'discord']"
              :key="domain"
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-colors cursor-pointer',
                eventLedgerDomains.includes(domain)
                  ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400'
                  : 'bg-neutral-100 dark:bg-white/5 border-neutral-200/60 dark:border-white/10 text-neutral-400 dark:text-neutral-500',
              ]"
              @click="toggleLedgerDomain(domain)"
            >
              [{{ displayText(domain.toUpperCase()) }}]
            </button>
          </div>
        </div>

        <!-- Live Payload Inspector Box (Full Dump) -->
        <div :class="['flex flex-col gap-2 border-t border-neutral-200/60 dark:border-white/5 pt-3']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <span :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300']">
                {{ t('onboarding.ui.live-sensor-ledger-ingestion-preview') }}
              </span>
              <span
                :class="['i-solar:info-circle-bold cursor-help text-xs text-neutral-400']"
                :title="t('onboarding.ui.this-block-is-appended-at-the-tail-of-the-llm-prompt-to-preserve-kv-prefix-cac')"
              />
            </div>

            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 text-[11px] text-primary-600 font-medium transition dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer disabled:opacity-50',
              ]"
              :disabled="isRefreshingSensors"
              @click="refreshTelemetry"
            >
              <div :class="['i-solar:restart-bold text-xs', isRefreshingSensors ? 'animate-spin' : '']" />
              <span>{{ displayText(isRefreshingSensors ? 'Polling OS Probes...' : 'Refresh Telemetry') }}</span>
            </button>
          </div>

          <!-- Monospace Full Dump Box -->
          <pre :class="['max-h-56 overflow-y-auto border border-neutral-200 dark:border-white/10 rounded-xl bg-neutral-950 p-3.5 text-[11px] text-green-400 font-mono leading-relaxed select-text']">{{ displayText(displayPayload) }}</pre>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Buttons -->
    <div :class="['flex items-center justify-between pt-2 border-t border-neutral-200 dark:border-white/5']">
      <button
        type="button"
        :class="['px-4 py-2 rounded-xl bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 text-xs font-medium border border-neutral-200 dark:border-white/10 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        {{ t('onboarding.ui.previous') }}
      </button>

      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
        @click="handleNext"
      >
        {{ t('onboarding.ui.confirm-continue') }}
      </button>
    </div>
  </div>
</template>
