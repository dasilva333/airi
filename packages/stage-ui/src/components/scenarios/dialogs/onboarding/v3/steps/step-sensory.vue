<script setup lang="ts">
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { formatSensorPayload } from '@proj-airi/stage-ui/stores/proactivity-telemetry'
import { computed, onMounted, ref } from 'vue'

import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

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
              Sensory Perception & Proactivity
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400']">
              Step 13
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Equip your companion with real-time environmental awareness. Balance <span class="text-neutral-800 font-semibold dark:text-neutral-200">Visual Push</span> (Screen Watching) and <span class="text-neutral-800 font-semibold dark:text-neutral-200">Ambient Pull</span> (Proactive Heartbeats), governed by an <span class="text-neutral-800 font-semibold dark:text-neutral-200">Operating & Sleep Schedule</span> and <span class="text-neutral-800 font-semibold dark:text-neutral-200">Smart Silence (NO_REPLY)</span>.
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
          <span>{{ screenWatcherEnabled || heartbeatsEnabled ? 'PERCEPTION ACTIVE' : 'PASSIVE / DORMANT' }}</span>
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
                Screen Perception (Visual Push)
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20']">
                EVENT-DRIVEN PUSH
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Autonomous perception ticker analyzing your desktop display. Reacts in real-time when gameplay moments, videos, or active windows change.
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
            <span>Reaction Delivery Mode</span>
            <span :class="['text-[10px] text-neutral-400 font-normal font-sans']">(Choose how your companion chimes in)</span>
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
                    {{ mode.badge }}
                  </span>
                </div>
                <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                  {{ mode.title }}
                </h4>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                  {{ mode.desc }}
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
              Perception Engine Tier
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
                      {{ tier.title }}
                    </h5>
                    <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                      {{ tier.desc }}
                    </p>
                  </div>
                </div>
                <span :class="['text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-neutral-200/60 dark:bg-white/10 text-neutral-700 dark:text-neutral-300 flex-shrink-0 whitespace-nowrap']">
                  {{ tier.vram }}
                </span>
              </div>
            </div>
          </div>

          <!-- Capture Cadence Presets -->
          <div :class="['flex flex-col gap-2']">
            <label :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
              Capture Sampling Frequency
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
                <span>{{ preset.label }}</span>
                <span :class="['text-[9px] opacity-70 font-mono']">{{ preset.value }}ms ticker</span>
              </button>
            </div>
            <p :class="['text-[10px] text-neutral-400 mt-1 leading-snug']">
              Frames are continuously hashed with pHash. Only frames with meaningful visual deltas trigger OCR or model evaluation.
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
              The Visual Push Sentinel: Silent by Default
            </h5>
            <p :class="['text-[11px] text-sky-800/80 dark:text-sky-300/70 mt-0.5 leading-relaxed']">
              Whenever screen shifts occur, your companion evaluates whether the change is genuinely noteworthy. If you are typing mundane text, browsing static pages, or watching ordinary video frames, the model silently emits <code class="rounded bg-sky-500/15 px-1 py-0.2 text-[10px] font-mono">NO_REPLY</code> without interrupting your flow.
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
                Proactive Heartbeats & Sleep Schedule
              </h3>
              <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20']">
                AMBIENT PULL
              </span>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Periodic background timer check-ins evaluating whether to speak. Bound to your operating schedule and quiet hours.
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
            Ambient Check-In Interval
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
              <span>{{ preset.label }}</span>
              <span :class="['text-[9px] opacity-70 font-mono']">Timer Pulse</span>
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
                  <span>Operating Schedule & Quiet Hours</span>
                </h4>
                <span
                  :class="[
                    'text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase border',
                    isQuietHoursActive
                      ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                      : 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  ]"
                >
                  {{ isQuietHoursActive ? '🌙 QUIET HOURS ACTIVE' : '☀️ COMPANION AWAKE' }}
                </span>
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-normal']">
                Define quiet hours when your companion sleeps. During quiet hours, companion will not make unprompted comments.
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
                <span>Wake Up Time</span>
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
                <span>Bedtime (Quiet Hours)</span>
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
                Sleep Schedule: Applies to Both Screen Watching & Heartbeats
              </h5>
              <p :class="['text-[11px] text-indigo-800/80 dark:text-indigo-300/70 mt-0.5 leading-relaxed']">
                During bedtime quiet hours, <span class="text-neutral-900 font-semibold dark:text-white">both</span> systems go completely dormant. Screen frame capture is frozen for <span class="text-neutral-900 font-semibold dark:text-white">100% display privacy</span> (no watching during off-hours), and background heartbeat timers cease all evaluation until wake-up time.
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
                  Pause When Away from Computer (AFK Gate)
                </h5>
                <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400']">
                  Automatically pauses screen watching and heartbeats after 5 min of mouse/keyboard inactivity.
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
                    Context-Aware Smart Silence Directive
                  </h5>
                  <span :class="['text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase']">
                    NO YAP GUARANTEE
                  </span>
                </div>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
                  Automatically bakes a hardened anti-yapping instruction directly into your companion's system prompt. When heartbeat ticks or screen shifts detect routine activities, the model silently emits <code class="rounded bg-neutral-200 px-1 py-0.2 text-[10px] font-mono dark:bg-white/10">NO_REPLY</code> instead of speaking unsolicited spam.
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
              Situational Grounding & Event Ledger
            </h3>
            <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20']">
              CONTEXT INJECTIONS
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Feed real-world desktop state, active application history, and system ledger events directly into the LLM prompt per conversational turn.
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
              Attach Sensor Telemetry to Manual Chat Messages (Chatbox Grounding)
            </label>
            <span :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
              Grounds normal user prompts with your active window title, application name, and local time.
            </span>
          </div>
        </div>

        <!-- Active OS Sensor Probes -->
        <div :class="['flex flex-col gap-2']">
          <label :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300']">
            Active OS Sensor Probes
          </label>
          <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2.5']">
            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextWindowHistory"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">Window History</span>
            </label>

            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextSystemLoad"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">CPU & System Load</span>
            </label>

            <label :class="['flex items-center gap-2.5 border border-neutral-200/80 dark:border-white/10 rounded-xl bg-neutral-50/70 dark:bg-white/[0.02] p-3 text-xs cursor-pointer hover:border-neutral-300 dark:hover:border-white/20 transition-all']">
              <input
                v-model="heartbeatsContextUsageMetrics"
                type="checkbox"
                :class="['h-3.5 w-3.5 rounded text-primary-600 focus:ring-primary-500 cursor-pointer']"
                @change="syncDraft()"
              >
              <span :class="['font-medium text-neutral-800 dark:text-neutral-200']">Usage Metrics</span>
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
                Attach Unified Event Ledger Stream
              </label>
            </div>
            <div :class="['flex items-center gap-1.5 text-xs text-neutral-500']">
              <span>Sample Last:</span>
              <input
                v-model.number="eventLedgerSampleDepth"
                type="number"
                min="1"
                max="20"
                :class="['w-12 border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-100 dark:bg-white/5 px-2 py-0.5 text-center text-xs font-mono text-neutral-800 dark:text-white outline-none focus:border-primary-500']"
                @change="syncDraft()"
              >
              <span>Events</span>
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
              [{{ domain.toUpperCase() }}]
            </button>
          </div>
        </div>

        <!-- Live Payload Inspector Box (Full Dump) -->
        <div :class="['flex flex-col gap-2 border-t border-neutral-200/60 dark:border-white/5 pt-3']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <span :class="['text-xs text-neutral-700 font-medium dark:text-neutral-300']">
                Live Sensor & Ledger Ingestion Preview
              </span>
              <span
                :class="['i-solar:info-circle-bold cursor-help text-xs text-neutral-400']"
                title="This block is appended at the tail of the LLM prompt to preserve KV prefix cache alignment."
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
              <span>{{ isRefreshingSensors ? 'Polling OS Probes...' : 'Refresh Telemetry' }}</span>
            </button>
          </div>

          <!-- Monospace Full Dump Box -->
          <pre :class="['max-h-56 overflow-y-auto border border-neutral-200 dark:border-white/10 rounded-xl bg-neutral-950 p-3.5 text-[11px] text-green-400 font-mono leading-relaxed select-text']">{{ displayPayload }}</pre>
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
        ← Previous
      </button>

      <button
        type="button"
        :class="['px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-colors cursor-pointer']"
        @click="handleNext"
      >
        Confirm & Continue →
      </button>
    </div>
  </div>
</template>
