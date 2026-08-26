<script setup lang="ts">
import { useVisionSources } from '@proj-airi/stage-ui/composables'
import { useProactivityStore } from '@proj-airi/stage-ui/stores'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import {
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  sensorPayload?: string
  staticSamplePayload: string
}>()

const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
}>()

const proactivityStore = useProactivityStore()
const visionStore = useVisionStore()
const isRefreshingSensors = ref(false)

// Primary display size so the capture-resolution readout reflects the real
// display (downscale is relative to native resolution, not a 720p baseline).
const primaryDisplaySize = ref<{ width: number, height: number } | null>(null)

async function refreshTelemetry() {
  isRefreshingSensors.value = true
  try {
    await proactivityStore.updateSensors()
  }
  finally {
    isRefreshingSensors.value = false
  }
}

onMounted(async () => {
  void proactivityStore.updateSensors()
  primaryDisplaySize.value = await visionStore.getPrimaryDisplaySize()
})

// Sub-Tab Navigation State
type SubTabId = 'heartbeats' | 'screen' | 'dream' | 'ledger' | 'short_term'
const activeSubTab = ref<SubTabId>('heartbeats')

const subTabs = [
  { id: 'heartbeats' as const, label: 'Heartbeats', icon: 'i-solar:alarm-bold-duotone', desc: 'Ambient pull loop' },
  { id: 'screen' as const, label: 'Screen Watching', icon: 'i-solar:eye-bold-duotone', desc: 'Event-driven triggers' },
  { id: 'dream' as const, label: 'Dream State', icon: 'i-solar:moon-stars-bold-duotone', desc: 'Sleep consolidation' },
  { id: 'ledger' as const, label: 'Sensors & Ledger', icon: 'i-solar:radar-bold-duotone', desc: 'Situational context' },
  { id: 'short_term' as const, label: '24h Memory', icon: 'i-solar:calendar-date-bold-duotone', desc: 'Daily summaries' },
]

// 1. Ambient Heartbeats Models
const heartbeatsEnabled = defineModel<boolean>('heartbeatsEnabled', { default: false })
const heartbeatsIntervalMinutes = defineModel<number>('heartbeatsIntervalMinutes', { default: 5 })
const heartbeatsPrompt = defineModel<string>('heartbeatsPrompt', { default: '' })
const heartbeatsInjectIntoPrompt = defineModel<boolean>('heartbeatsInjectIntoPrompt', { default: true })
const heartbeatsUseAsLocalGate = defineModel<boolean>('heartbeatsUseAsLocalGate', { default: false })
const heartbeatsScheduleStart = defineModel<string>('heartbeatsScheduleStart', { default: '09:00' })
const heartbeatsScheduleEnd = defineModel<string>('heartbeatsScheduleEnd', { default: '23:00' })
const heartbeatsContextWindowHistory = defineModel<boolean>('heartbeatsContextWindowHistory', { default: true })
const heartbeatsContextSystemLoad = defineModel<boolean>('heartbeatsContextSystemLoad', { default: true })
const heartbeatsContextUsageMetrics = defineModel<boolean>('heartbeatsContextUsageMetrics', { default: true })
const heartbeatsRespectSchedule = defineModel<boolean>('heartbeatsRespectSchedule', { default: true })
const groundingEnabled = defineModel<boolean>('groundingEnabled', { default: false })

// 2. Screen Watching (Push / Attention Ecology) Models
const screenWatchingEnabled = defineModel<boolean>('screenWatchingEnabled', { default: false })
const screenWatchingDeliveryMode = defineModel<'both' | 'bubble_only' | 'tts_only' | 'off'>('screenWatchingDeliveryMode', { default: 'both' })
const screenWatchingSourceType = defineModel<'displays' | 'applications' | 'auto_focused'>('screenWatchingSourceType', { default: 'displays' })
const screenWatchingSourceId = defineModel<string>('screenWatchingSourceId', { default: '' })
const screenWatchingCaptureIntervalMs = defineModel<number>('screenWatchingCaptureIntervalMs', { default: 2000 })
const screenWatchingDownscalePercent = defineModel<number>('screenWatchingDownscalePercent', { default: 100 })
const screenWatchingWorkload = defineModel<'attention-guard' | 'screen:interpret' | 'screen:ocr'>('screenWatchingWorkload', { default: 'attention-guard' })
const screenWatchingPublishToContext = defineModel<boolean>('screenWatchingPublishToContext', { default: false })
const screenWatchingInterestTags = defineModel<string[]>('screenWatchingInterestTags', {
  default: () => ['antigravity', 'terminal_error', 'youtube', 'discord'],
})
const screenWatchingDeferWhileSpeaking = defineModel<boolean>('screenWatchingDeferWhileSpeaking', { default: true })
const screenWatchingMaxPerHour = defineModel<number>('screenWatchingMaxPerHour', { default: 4 })
const screenWatchingHysteresisMinutes = defineModel<number>('screenWatchingHysteresisMinutes', { default: 3 })

// Capture-resolution readout for the downscale slider. Percentages are applied
// relative to the display's native size; 100% means a full native-resolution
// capture (required for accurate OCR).
const downscaleResolutionLabel = computed(() => {
  const pct = screenWatchingDownscalePercent.value || 100
  const base = primaryDisplaySize.value
  if (pct >= 100)
    return base ? `Native ${base.width}×${base.height}` : 'Native'
  const refW = base?.width || 1280
  const refH = base?.height || 720
  return `${Math.round(refW * pct / 100)}×${Math.round(refH * pct / 100)}`
})

// Dynamic Display and Window sources from unified vision composable
const {
  displaySources,
  applicationSources,
  isRefetching: isRefetchingSources,
  refetchSources,
} = useVisionSources({ autoFetch: true })

// Tag Input Helper State & Categorized Suggestions
const newTagInput = ref('')
interface SuggestedTagCategory {
  label: string
  icon: string
  tags: string[]
}

const SUGGESTED_TAG_GROUPS: SuggestedTagCategory[] = [
  {
    label: 'AIRI Hub',
    icon: 'i-solar:stars-minimalistic-bold-duotone',
    tags: ['airi', 'chat_window', 'studio', 'director', 'stage'],
  },
  {
    label: 'Daily & Media',
    icon: 'i-solar:globus-bold-duotone',
    tags: ['chrome', 'youtube', 'spotify', 'discord', 'reddit', 'twitter', 'twitch'],
  },
  {
    label: 'Gaming',
    icon: 'i-solar:gamepad-bold-duotone',
    tags: ['steam', 'minecraft', 'destiny', 'factorio'],
  },
  {
    label: 'Dev & Work',
    icon: 'i-solar:code-bold-duotone',
    tags: ['vs_code', 'terminal_error', 'github', 'antigravity', 'error_log'],
  },
]

function addInterestTag(customTag?: string) {
  const raw = (customTag ?? newTagInput.value).trim()
  if (!raw)
    return

  const rawParts = raw.split(/[,，\s]+/)
  const currentTags = screenWatchingInterestTags.value ? [...screenWatchingInterestTags.value] : []

  for (const part of rawParts) {
    const clean = part.replace(/^#+/, '').trim().toLowerCase()
    if (clean && !currentTags.includes(clean)) {
      currentTags.push(clean)
    }
  }

  screenWatchingInterestTags.value = currentTags
  newTagInput.value = ''
}

function removeInterestTag(indexOrTag: number | string) {
  if (typeof indexOrTag === 'number') {
    screenWatchingInterestTags.value = (screenWatchingInterestTags.value || []).filter((_, i) => i !== indexOrTag)
  }
  else {
    const target = indexOrTag.toLowerCase()
    screenWatchingInterestTags.value = (screenWatchingInterestTags.value || []).filter(t => t.toLowerCase() !== target)
  }
}

// 3. Dream State Models
const dreamStateEnabled = defineModel<boolean>('dreamStateEnabled', { default: false })
const dreamStateStrictAfkGating = defineModel<boolean>('dreamStateStrictAfkGating', { default: true })
const dreamStateRichness = defineModel<'minimal' | 'balanced' | 'lush'>('dreamStateRichness', { default: 'balanced' })
const dreamStateAfkThresholdMinutes = defineModel<number>('dreamStateAfkThresholdMinutes', { default: 5 })
const dreamStateSessionTimeoutMinutes = defineModel<number>('dreamStateSessionTimeoutMinutes', { default: 60 })
const dreamStateMaxSessionsPerDay = defineModel<number>('dreamStateMaxSessionsPerDay', { default: 4 })
const dreamStateInjectDreamContext = defineModel<boolean>('dreamStateInjectDreamContext', { default: true })

// 4. Sensors & Event Ledger Models
const eventLedgerEnabled = defineModel<boolean>('eventLedgerEnabled', { default: true })
const eventLedgerSampleDepth = defineModel<number>('eventLedgerSampleDepth', { default: 6 })
const eventLedgerDomains = defineModel<string[]>('eventLedgerDomains', {
  default: () => ['vision', 'tools', 'chat', 'memory', 'discord'],
})

function toggleLedgerDomain(domain: string) {
  if (eventLedgerDomains.value.includes(domain)) {
    eventLedgerDomains.value = eventLedgerDomains.value.filter(d => d !== domain)
  }
  else {
    eventLedgerDomains.value = [...eventLedgerDomains.value, domain]
  }
}

// 5. Short-Term Memory (24h Daily Summaries) Models
const shortTermMemoryEnabled = defineModel<boolean>('shortTermMemoryEnabled', { default: true })
const shortTermMemoryWindowSize = defineModel<number>('shortTermMemoryWindowSize', { default: 3 })
const shortTermMemoryTokenBudget = defineModel<number>('shortTermMemoryTokenBudget', { default: 1000 })

// Interval Presets Helper
const intervalPresets = [2, 5, 10, 20]
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95% flex flex-col gap-5">
    <!-- Header Subtitle -->
    <div class="flex flex-col gap-1">
      <h3 class="text-base text-neutral-800 font-semibold dark:text-neutral-100">
        Cognition, Proactivity & Memory Architecture
      </h3>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        Configure how this character observes your workspace, dreams during sleep cycles, and initiates autonomous dialogue.
      </p>
    </div>

    <!-- Sub-Navigation Segmented Pill Bar -->
    <div class="flex flex-wrap items-center gap-1.5 border border-neutral-200 rounded-xl bg-neutral-100/70 p-1.5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <button
        v-for="tab in subTabs"
        :key="tab.id"
        type="button"
        :class="[
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
          activeSubTab === tab.id
            ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm border border-neutral-200/80 dark:border-neutral-700'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeSubTab = tab.id"
      >
        <span :class="[tab.icon, 'text-base']" />
        <span class="font-medium">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Sub-Tab Panels Container -->
    <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <!-- ================================================================= -->
      <!-- 1. AMBIENT HEARTBEATS SUB-TAB                                     -->
      <!-- ================================================================= -->
      <div v-if="activeSubTab === 'heartbeats'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <input
                id="heartbeats-master-toggle"
                v-model="heartbeatsEnabled"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
              >
              <label for="heartbeats-master-toggle" class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Enable Proactive Heartbeats (Ambient Pull)
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Periodically prompts the LLM on a background interval to review recent context and comment proactively.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              heartbeatsEnabled
                ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
            ]"
          >
            {{ heartbeatsEnabled ? 'Active' : 'Disabled' }}
          </span>
        </div>

        <div v-if="heartbeatsEnabled" class="flex flex-col gap-5">
          <!-- Interval Selection -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Evaluation Interval
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="preset in intervalPresets"
                :key="preset"
                type="button"
                :class="[
                  'px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors',
                  heartbeatsIntervalMinutes === preset
                    ? 'bg-primary-50 border-primary-400 text-primary-600 dark:bg-primary-950/50 dark:border-primary-600 dark:text-primary-300'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300',
                ]"
                @click="heartbeatsIntervalMinutes = preset"
              >
                {{ preset }}m
              </button>
              <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <span class="text-neutral-500">Custom:</span>
                <input
                  v-model.number="heartbeatsIntervalMinutes"
                  type="number"
                  min="1"
                  max="1440"
                  class="w-14 bg-transparent text-right font-medium font-mono outline-none"
                >
                <span class="text-neutral-500">min</span>
              </div>
            </div>
          </div>

          <!-- Schedule Window -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Operating Schedule Hours
              </label>
              <div class="flex items-center gap-2">
                <input
                  v-model="heartbeatsScheduleStart"
                  type="time"
                  class="flex-1 border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                <span class="text-xs text-neutral-400 font-medium">to</span>
                <input
                  v-model="heartbeatsScheduleEnd"
                  type="time"
                  class="flex-1 border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
              </div>
              <div class="flex items-center gap-2 pt-1">
                <input
                  id="respect-schedule"
                  v-model="heartbeatsRespectSchedule"
                  type="checkbox"
                  class="h-3.5 w-3.5 border-gray-300 rounded text-primary-600"
                >
                <label for="respect-schedule" class="text-xs text-neutral-500 dark:text-neutral-400">
                  Strictly stay quiet outside these hours.
                </label>
              </div>
            </div>

            <!-- Inactivity Gating -->
            <div class="flex flex-col justify-start gap-2 border-t border-neutral-100 pt-2 sm:border-l sm:border-t-0 dark:border-neutral-800 sm:pl-4 sm:pt-0">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Inactivity & Idle Gating
              </label>
              <div class="flex items-start gap-2">
                <input
                  id="local-gate-check"
                  v-model="heartbeatsUseAsLocalGate"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600"
                >
                <div class="flex flex-col">
                  <label for="local-gate-check" class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                    Require Keyboard/Mouse Inactivity
                  </label>
                  <span class="text-xs text-neutral-500 dark:text-neutral-400">
                    Only evaluates once user is idle for the specified interval, then pauses until activity resumes.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Stealth Prompt Textarea -->
          <div class="flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Stealth Heartbeat Prompt
              </label>
              <span class="text-[11px] text-neutral-400">Hidden instruction appended at prompt tail</span>
            </div>
            <div class="relative w-full">
              <textarea
                v-model="heartbeatsPrompt"
                rows="4"
                placeholder="Review situational context. Comment on user progress if natural, or output NO_REPLY to remain silent."
                class="w-full border border-neutral-200 rounded-lg bg-neutral-50/80 p-3 pr-10 text-xs shadow-inner outline-none transition-colors dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-950"
              />
              <button
                type="button"
                class="absolute right-2.5 top-2.5 h-7 w-7 flex items-center justify-center border border-neutral-200 rounded-md bg-white text-neutral-500 shadow-sm transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:text-primary-500"
                title="Optimize with AI Sparkle"
                @click.prevent="emit('sparkle-click', 'heartbeatsPrompt')"
              >
                <span class="i-solar:sparkles-bold-duotone text-sm" />
              </button>
            </div>
            <div class="flex items-center gap-2 rounded-lg bg-neutral-100/70 p-2 text-xs text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-400">
              <span class="i-lucide:info shrink-0 text-sm text-primary-500" />
              <span>The <code>NO_REPLY</code> sentinel instructs the LLM to remain completely silent if no commentary is needed, avoiding unprovoked chatter.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2. SCREEN WATCHING (PUSH & ATTENTION ECOLOGY) SUB-TAB             -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'screen'" class="flex flex-col gap-6">
        <!-- Demonstration & Preview Disclaimer Banner -->
        <div class="relative overflow-hidden border border-amber-500/30 rounded-2xl bg-amber-500/10 p-5 transition-all dark:border-amber-500/25 dark:bg-amber-500/5">
          <div class="flex items-start gap-4">
            <div class="h-11 w-11 flex flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <div class="i-solar:danger-triangle-bold-duotone text-2xl" />
            </div>
            <div class="flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-md bg-amber-500/25 px-2.5 py-0.5 text-[10px] text-amber-800 font-black tracking-wider uppercase dark:text-amber-200">
                  DEMONSTRATION PURPOSES ONLY
                </span>
                <span class="rounded-md bg-neutral-500/15 px-2 py-0.5 text-[10px] text-neutral-600 font-bold uppercase dark:text-neutral-300">
                  EARLY ACCESS PREVIEW
                </span>
              </div>
              <h4 class="text-sm text-neutral-900 font-bold dark:text-neutral-100">
                Attention Ecology & Screen Watching — Interface Preview
              </h4>
              <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-300">
                Screen watching and autonomous visual perception controls are currently an interactive interface preview presented for demonstration and feedback purposes only. The background screen capture ticker, local WebGPU salience gates, and automated OCR pipelines are not yet active or wired into live character execution. These controls and mock source pickers are presented early so you can evaluate the proposed configuration model and share feedback on the desired workflow.
              </p>
            </div>
          </div>
        </div>

        <!-- Master Ticker Switch -->
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <input
                id="screen-watching-toggle"
                v-model="screenWatchingEnabled"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
              >
              <label for="screen-watching-toggle" class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Enable Screen Watching (Autonomous Perception Ticker)
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Starts the background capture loop for this character, evaluating frames for visual changes and OCR errors.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              screenWatchingEnabled
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
            ]"
          >
            {{ screenWatchingEnabled ? 'Active' : 'Disabled' }}
          </span>
        </div>

        <div v-if="screenWatchingEnabled" class="flex flex-col gap-6">
          <!-- Reaction Delivery Mode -->
          <div class="flex flex-col gap-2.5 border border-neutral-200/80 rounded-2xl bg-neutral-50/60 p-4 dark:border-neutral-800/80 dark:bg-neutral-900/50">
            <div class="flex items-center justify-between">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-neutral-800 font-bold tracking-wide uppercase dark:text-neutral-200">
                  Reaction Delivery Mode
                </span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Controls how proactive screen commentary is communicated to avoid voice spam during gaming or calls.
                </span>
              </div>
              <span class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                {{ screenWatchingDeliveryMode === 'both' ? 'Voice + Bubble' : screenWatchingDeliveryMode === 'bubble_only' ? 'Silent (Bubble Only)' : screenWatchingDeliveryMode === 'tts_only' ? 'Voice Only' : 'Muted' }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                :class="[
                  'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all text-center',
                  screenWatchingDeliveryMode === 'both'
                    ? 'border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/60 dark:text-primary-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                ]"
                @click="screenWatchingDeliveryMode = 'both'"
              >
                <div class="i-solar:chat-round-video-bold-duotone text-xl text-primary-500" />
                <span class="font-bold">Voice & Bubble</span>
                <span class="text-[10px] text-neutral-400 font-normal">Full Immersion</span>
              </button>

              <button
                type="button"
                :class="[
                  'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all text-center',
                  screenWatchingDeliveryMode === 'bubble_only'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                ]"
                @click="screenWatchingDeliveryMode = 'bubble_only'"
              >
                <div class="i-solar:chat-round-line-bold-duotone text-xl text-emerald-500" />
                <span class="font-bold">Bubble Only</span>
                <span class="text-[10px] text-neutral-400 font-normal">Silent (Gaming)</span>
              </button>

              <button
                type="button"
                :class="[
                  'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all text-center',
                  screenWatchingDeliveryMode === 'tts_only'
                    ? 'border-violet-500 bg-violet-50 text-violet-900 ring-1 ring-violet-500 dark:border-violet-500 dark:bg-violet-950/60 dark:text-violet-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                ]"
                @click="screenWatchingDeliveryMode = 'tts_only'"
              >
                <div class="i-solar:volume-loud-bold-duotone text-xl text-violet-500" />
                <span class="font-bold">Voice Only</span>
                <span class="text-[10px] text-neutral-400 font-normal">Audio Chime-in</span>
              </button>

              <button
                type="button"
                :class="[
                  'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all text-center',
                  screenWatchingDeliveryMode === 'off'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-500 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                ]"
                @click="screenWatchingDeliveryMode = 'off'"
              >
                <div class="i-solar:bell-off-bold-duotone text-xl text-amber-500" />
                <span class="font-bold">Muted</span>
                <span class="text-[10px] text-neutral-400 font-normal">Telemetry Only</span>
              </button>
            </div>
          </div>

          <!-- 1. Capture Target & Source Scope -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
                1. Capture Target & Source Scope
              </span>
              <button
                type="button"
                class="flex items-center gap-1 text-xs text-primary-600 transition-colors dark:text-primary-400 hover:text-primary-700"
                @click="refetchSources"
              >
                <span :class="[isRefetchingSources ? 'i-svg-spinners:ring-resize' : 'i-solar:refresh-line-duotone', 'text-sm']" />
                <span>{{ isRefetchingSources ? 'Refetching...' : 'Refetch Sources' }}</span>
              </button>
            </div>

            <!-- Source Mode Selection -->
            <div class="flex items-center gap-4">
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                <input v-model="screenWatchingSourceType" type="radio" value="displays" class="text-primary-600">
                <span>Displays (Full Monitor)</span>
              </label>
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                <input v-model="screenWatchingSourceType" type="radio" value="applications" class="text-primary-600">
                <span>Specific Application Window</span>
              </label>
            </div>

            <!-- Source Picker Grid -->
            <div class="grid grid-cols-1 max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
              <template v-if="screenWatchingSourceType === 'displays'">
                <button
                  v-for="source in displaySources"
                  :key="source.id"
                  type="button"
                  :class="[
                    'flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors',
                    screenWatchingSourceId === source.id || (!screenWatchingSourceId && source.id === 'screen:primary')
                      ? 'border-primary-500 bg-primary-50/70 text-primary-900 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-200 ring-1 ring-primary-400'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300 hover:bg-neutral-100',
                  ]"
                  @click="screenWatchingSourceId = source.id"
                >
                  <div class="flex items-center gap-2.5 truncate">
                    <img
                      v-if="source.appIconURL"
                      :src="source.appIconURL"
                      class="h-5 w-5 shrink-0 rounded object-contain"
                      alt=""
                    >
                    <span v-else :class="[source.icon, 'text-lg text-primary-500 shrink-0']" />
                    <span class="truncate font-medium">{{ source.name }}</span>
                  </div>
                  <span v-if="source.resolution" class="shrink-0 text-[10px] text-neutral-400 font-mono">{{ source.resolution }}</span>
                </button>
                <div v-if="displaySources.length === 0" class="col-span-full py-4 text-center text-xs text-neutral-400">
                  No displays detected. Click "Refetch Sources" to retry.
                </div>
              </template>
              <template v-else>
                <button
                  v-for="source in applicationSources"
                  :key="source.id"
                  type="button"
                  :class="[
                    'flex items-center justify-between p-2.5 rounded-lg border text-left text-xs transition-colors',
                    screenWatchingSourceId === source.id
                      ? 'border-primary-500 bg-primary-50/70 text-primary-900 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-200 ring-1 ring-primary-400'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300 hover:bg-neutral-100',
                  ]"
                  @click="screenWatchingSourceId = source.id"
                >
                  <div class="flex items-center gap-2.5 truncate">
                    <img
                      v-if="source.appIconURL"
                      :src="source.appIconURL"
                      class="h-5 w-5 shrink-0 rounded object-contain"
                      alt=""
                    >
                    <span v-else :class="[source.icon, 'text-lg text-primary-500 shrink-0']" />
                    <span class="truncate font-medium">{{ source.name }}</span>
                  </div>
                  <span class="rounded bg-neutral-200/80 px-1.5 py-0.2 text-[10px] text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">App</span>
                </button>
                <div v-if="applicationSources.length === 0" class="col-span-full py-4 text-center text-xs text-neutral-400">
                  No application windows detected. Click "Refetch Sources" or ensure permissions are granted.
                </div>
              </template>
            </div>

            <!-- Capture Intervals & Downscaling -->
            <div class="grid grid-cols-1 mt-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                    Capture Interval
                  </label>
                  <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">{{ screenWatchingCaptureIntervalMs }}ms</span>
                </div>
                <input
                  v-model.number="screenWatchingCaptureIntervalMs"
                  type="range"
                  min="500"
                  max="15000"
                  step="500"
                  class="h-1.5 w-full cursor-pointer accent-primary-500"
                >
                <div class="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>500ms (High FPS)</span>
                  <span>2000ms (Standard)</span>
                  <span>15s (Power Saver)</span>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                    Input Downscale
                  </label>
                  <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                    {{ screenWatchingDownscalePercent }}% ({{ downscaleResolutionLabel }})
                  </span>
                </div>
                <input
                  v-model.number="screenWatchingDownscalePercent"
                  type="range"
                  min="25"
                  max="100"
                  step="5"
                  class="h-1.5 w-full cursor-pointer accent-primary-500"
                >
                <div class="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>25% (Low VRAM)</span>
                  <span>100% (Native Resolution)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. Zero-Cost Salience & Interest Tags -->
          <div class="flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              2. Zero-Cost Salience Gating & Interest Tags
            </span>

            <!-- Workload Selector -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Vision Engine Workload
              </label>
              <select
                v-model="screenWatchingWorkload"
                class="border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
              >
                <option value="attention-guard">
                  Attention Ecology Guard (0-Cost Local WebGPU / OCR)
                </option>
                <option value="screen:interpret">
                  screen:interpret (Full Visual Scene Comprehension)
                </option>
                <option value="screen:ocr">
                  screen:ocr (WASM Text Stream Extraction)
                </option>
              </select>
            </div>

            <!-- Interest Tags -->
            <div class="flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  High-Salience Interest Keywords & Filter Tags
                </label>
                <span class="text-[10px] text-neutral-400 font-mono">
                  {{ screenWatchingInterestTags?.length || 0 }} active tag{{ (screenWatchingInterestTags?.length || 0) === 1 ? '' : 's' }}
                </span>
              </div>

              <!-- Active Tags Box -->
              <div class="min-h-[48px] flex flex-wrap items-center gap-2 border border-neutral-200 rounded-xl bg-neutral-50/80 p-3 dark:border-neutral-700 dark:bg-neutral-950">
                <button
                  v-for="(tag, idx) in screenWatchingInterestTags"
                  :key="tag"
                  type="button"
                  title="Click to remove tag"
                  class="group flex cursor-pointer items-center gap-1.5 border border-primary-200 rounded-lg bg-primary-50 px-2.5 py-1 text-xs text-primary-700 font-medium transition-all dark:border-primary-800/80 hover:border-red-400 dark:bg-primary-950/60 hover:bg-red-50 dark:text-primary-300 hover:text-red-600 dark:hover:border-red-800 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                  @click="removeInterestTag(idx)"
                >
                  <span>#{{ tag }}</span>
                  <span class="i-lucide:x text-[11px] text-primary-400 transition-colors group-hover:text-red-500" />
                </button>

                <div class="flex items-center gap-1.5">
                  <input
                    v-model="newTagInput"
                    type="text"
                    placeholder="+ Add tag..."
                    class="w-28 bg-transparent px-2 py-1 text-xs text-neutral-800 outline-none dark:text-neutral-200 placeholder-neutral-400"
                    @keydown.enter.prevent="addInterestTag()"
                  >
                  <button
                    type="button"
                    class="rounded-lg bg-neutral-200/80 px-2.5 py-1 text-xs text-neutral-700 font-semibold transition-colors dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-300 hover:text-white dark:hover:bg-primary-600 dark:hover:text-white"
                    @click="addInterestTag()"
                  >
                    Add
                  </button>
                </div>
              </div>

              <!-- Categorized Suggested Tags -->
              <div class="mt-1 flex flex-col gap-2.5 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
                <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                  <div class="i-solar:lightbulb-bolt-bold-duotone text-sm text-amber-500" />
                  <span>Suggested keywords (click to add):</span>
                </div>

                <div class="flex flex-col gap-2 pl-0.5">
                  <div
                    v-for="group in SUGGESTED_TAG_GROUPS"
                    :key="group.label"
                    class="flex flex-wrap items-center gap-2"
                  >
                    <div class="min-w-[95px] flex shrink-0 items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
                      <div :class="[group.icon, 'text-xs text-neutral-400']" />
                      <span>{{ group.label }}:</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <button
                        v-for="tag in group.tags.filter(t => !screenWatchingInterestTags?.includes(t))"
                        :key="tag"
                        type="button"
                        class="flex cursor-pointer items-center gap-1 border border-neutral-300 rounded-md border-dashed bg-white px-2 py-0.5 text-[11px] text-neutral-600 font-medium transition-all dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-800/80 hover:bg-primary-50 dark:text-neutral-300 hover:text-primary-600 dark:hover:border-primary-600 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                        @click="addInterestTag(tag)"
                      >
                        <span class="text-neutral-400">+</span>
                        <span>#{{ tag }}</span>
                      </button>
                      <span
                        v-if="group.tags.every(t => screenWatchingInterestTags?.includes(t))"
                        class="text-[10px] text-neutral-400 italic"
                      >
                        (All added)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <span class="text-[11px] text-neutral-400">Frames matching these tags are automatically promoted and written to the Unified Event Ledger.</span>
            </div>
          </div>

          <!-- 3. Real-Time Reactions & Delivery -->
          <div class="flex flex-col gap-3.5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              3. Real-Time Reactions & Delivery
            </span>

            <!-- React Immediately (Real-Time Push) Toggle -->
            <div class="flex items-start gap-2.5 border border-primary-200/70 rounded-lg bg-primary-50/40 p-3.5 dark:border-primary-900/60 dark:bg-primary-950/20">
              <input
                id="publish-to-context"
                v-model="screenWatchingPublishToContext"
                type="checkbox"
                class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600"
              >
              <div class="flex flex-col gap-0.5">
                <label for="publish-to-context" class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                  React Immediately to Screen Highlights (Real-Time Push)
                </label>
                <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  <span class="text-neutral-700 font-medium dark:text-neutral-300">When enabled:</span> AIRI speaks or comments right away the moment she spots a notable event on your screen (like a game launch or a terminal error).<br>
                  <span class="text-neutral-700 font-medium dark:text-neutral-300">When disabled:</span> AIRI watches quietly in the background and only brings up what she noticed during her scheduled check-ins or normal chat.
                </p>
              </div>
            </div>

            <!-- Busy Pipe Safeguard -->
            <div class="flex items-start gap-2.5 border border-neutral-200 rounded-lg bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50">
              <input
                id="defer-while-speaking"
                v-model="screenWatchingDeferWhileSpeaking"
                type="checkbox"
                class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600"
              >
              <div class="flex flex-col gap-0.5">
                <label for="defer-while-speaking" class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                  Busy Pipe Safeguard (Defer & Batch While Speaking)
                </label>
                <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Never interrupts active TTS voice generation or streaming chat. Queues triggers into a pending batch and consolidates them once conversation clears.
                </p>
              </div>
            </div>

            <!-- Rate Limits & Cooldown -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Max Interventions per Hour
                </label>
                <input
                  v-model.number="screenWatchingMaxPerHour"
                  type="number"
                  min="1"
                  max="30"
                  class="w-full border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                <span class="text-[11px] text-neutral-400">Prevents repetitive chat triggers during intense work sessions.</span>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Hysteresis Cooldown (Minutes)
                </label>
                <input
                  v-model.number="screenWatchingHysteresisMinutes"
                  type="number"
                  min="1"
                  max="60"
                  class="w-full border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                <span class="text-[11px] text-neutral-400">Minimum quiet duration enforced after any promoted speech turn.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 3. DREAM STATE (SLEEP CONSOLIDATION) SUB-TAB                     -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'dream'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <input
                id="dream-state-toggle"
                v-model="dreamStateEnabled"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
              >
              <label for="dream-state-toggle" class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Enable Dream State (Autonomous Memory Consolidation)
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Runs idle-time subconscious passes to synthesize emotional echo chips and reflect on relationship progression.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              dreamStateEnabled
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
            ]"
          >
            {{ dreamStateEnabled ? 'Active' : 'Disabled' }}
          </span>
        </div>

        <div v-if="dreamStateEnabled" class="flex flex-col gap-5">
          <!-- Dream Richness / Journaling Threshold -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Dream Richness & Echo Chip Synthesis Level
            </label>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label
                :class="[
                  'flex flex-col p-3 rounded-lg border cursor-pointer transition-colors',
                  dreamStateRichness === 'minimal'
                    ? 'bg-purple-50/70 border-purple-400 dark:bg-purple-950/40 dark:border-purple-600'
                    : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800/60 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                ]"
              >
                <div class="flex items-center gap-2">
                  <input v-model="dreamStateRichness" type="radio" value="minimal" class="text-purple-600">
                  <span class="text-xs font-semibold">Minimal</span>
                </div>
                <span class="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Key turning points & major topic shifts only.</span>
              </label>

              <label
                :class="[
                  'flex flex-col p-3 rounded-lg border cursor-pointer transition-colors',
                  dreamStateRichness === 'balanced'
                    ? 'bg-purple-50/70 border-purple-400 dark:bg-purple-950/40 dark:border-purple-600'
                    : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800/60 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                ]"
              >
                <div class="flex items-center gap-2">
                  <input v-model="dreamStateRichness" type="radio" value="balanced" class="text-purple-600">
                  <span class="text-xs font-semibold">Balanced (Default)</span>
                </div>
                <span class="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Standard emotional anchors and narrative nuances.</span>
              </label>

              <label
                :class="[
                  'flex flex-col p-3 rounded-lg border cursor-pointer transition-colors',
                  dreamStateRichness === 'lush'
                    ? 'bg-purple-50/70 border-purple-400 dark:bg-purple-950/40 dark:border-purple-600'
                    : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800/60 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800',
                ]"
              >
                <div class="flex items-center gap-2">
                  <input v-model="dreamStateRichness" type="radio" value="lush" class="text-purple-600">
                  <span class="text-xs font-semibold">Lush</span>
                </div>
                <span class="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">Deep subconscious soliloquy and detailed emotional texture.</span>
              </label>
            </div>
          </div>

          <!-- Sleep Cycle & AFK Thresholds -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Required Inactivity (AFK)
              </label>
              <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input v-model.number="dreamStateAfkThresholdMinutes" type="number" min="1" max="120" class="w-full bg-transparent outline-none">
                <span class="text-neutral-400">min</span>
              </div>
              <span class="text-[11px] text-neutral-400">User must be idle for this duration.</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Session Quiet Window
              </label>
              <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input v-model.number="dreamStateSessionTimeoutMinutes" type="number" min="5" max="360" class="w-full bg-transparent outline-none">
                <span class="text-neutral-400">min</span>
              </div>
              <span class="text-[11px] text-neutral-400">Quiet time since last chat turn.</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Max Daily Passes
              </label>
              <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input v-model.number="dreamStateMaxSessionsPerDay" type="number" min="1" max="24" class="w-full bg-transparent outline-none">
                <span class="text-neutral-400">passes</span>
              </div>
              <span class="text-[11px] text-neutral-400">Daily consolidation limit.</span>
            </div>
          </div>

          <!-- Gating Checkboxes -->
          <div class="flex flex-col gap-2.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <input
                id="strict-afk-gate"
                v-model="dreamStateStrictAfkGating"
                type="checkbox"
                class="h-3.5 w-3.5 border-gray-300 rounded text-purple-600"
              >
              <label for="strict-afk-gate" class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Strict AFK Gating (Only dream once the user is confirmed away from the machine)
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                id="inject-dream-context"
                v-model="dreamStateInjectDreamContext"
                type="checkbox"
                class="h-3.5 w-3.5 border-gray-300 rounded text-purple-600"
              >
              <label for="inject-dream-context" class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Inject Pending Dream Insights into Next Session Greeting / Morning Interaction
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 4. SENSORS & EVENT LEDGER SUB-TAB                                 -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'ledger'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <input
                id="situational-awareness-toggle"
                v-model="heartbeatsInjectIntoPrompt"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
              >
              <label for="situational-awareness-toggle" class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Enable Situational Awareness (Sensors & Ledger)
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Compiles real-time OS telemetry and unified system events into environmental context for heartbeats and manual chats.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              heartbeatsInjectIntoPrompt
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
            ]"
          >
            {{ heartbeatsInjectIntoPrompt ? 'Active' : 'Disabled' }}
          </span>
        </div>

        <div v-if="heartbeatsInjectIntoPrompt" class="flex flex-col gap-5">
          <!-- Manual Chat Grounding Toggle -->
          <div class="flex items-center gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
            <input
              id="manual-grounding-toggle"
              v-model="groundingEnabled"
              type="checkbox"
              class="h-4 w-4 border-gray-300 rounded text-primary-600"
            >
            <div class="flex flex-col">
              <label for="manual-grounding-toggle" class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Attach Sensor Telemetry to Manual Chat Messages (Chatbox Grounding)
              </label>
              <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                Grounds normal user prompts with your active window title and local time.
              </span>
            </div>
          </div>

          <!-- Included Sensor Modules -->
          <div class="flex flex-col gap-2">
            <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Active OS Sensor Probes
            </label>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <label class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-neutral-50/70 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800/60">
                <input v-model="heartbeatsContextWindowHistory" type="checkbox" class="h-3.5 w-3.5 text-primary-600">
                <span>Window History</span>
              </label>
              <label class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-neutral-50/70 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800/60">
                <input v-model="heartbeatsContextSystemLoad" type="checkbox" class="h-3.5 w-3.5 text-primary-600">
                <span>CPU & System Load</span>
              </label>
              <label class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-neutral-50/70 p-2.5 text-xs dark:border-neutral-700 dark:bg-neutral-800/60">
                <input v-model="heartbeatsContextUsageMetrics" type="checkbox" class="h-3.5 w-3.5 text-primary-600">
                <span>Usage Metrics</span>
              </label>
            </div>
          </div>

          <!-- Unified Event Ledger Integration -->
          <div class="flex flex-col gap-3 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <input
                  id="ledger-stream-toggle"
                  v-model="eventLedgerEnabled"
                  type="checkbox"
                  class="h-3.5 w-3.5 border-gray-300 rounded text-primary-600"
                >
                <label for="ledger-stream-toggle" class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Attach Unified Event Ledger Stream
                </label>
              </div>
              <div class="flex items-center gap-1 text-xs text-neutral-500">
                <span>Sample Last:</span>
                <input
                  v-model.number="eventLedgerSampleDepth"
                  type="number"
                  min="1"
                  max="20"
                  class="w-10 border border-neutral-200 rounded bg-neutral-50 px-1 py-0.5 text-center text-xs dark:border-neutral-700 dark:bg-neutral-800"
                >
                <span>Events</span>
              </div>
            </div>

            <!-- Ledger Domain Badges -->
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="domain in ['vision', 'tools', 'chat', 'memory', 'discord']"
                :key="domain"
                type="button"
                :class="[
                  'px-2 py-1 rounded-md text-[11px] font-medium border transition-colors',
                  eventLedgerDomains.includes(domain)
                    ? 'bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-950/60 dark:border-primary-700 dark:text-primary-300'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:border-neutral-700',
                ]"
                @click="toggleLedgerDomain(domain)"
              >
                [{{ domain.toUpperCase() }}]
              </button>
            </div>
          </div>

          <!-- Live Payload Inspector Box -->
          <div class="flex flex-col gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Live Sensor & Ledger Ingestion Preview
                </span>
                <TooltipProvider :delay-duration="0">
                  <TooltipRoot>
                    <TooltipTrigger as-child>
                      <span class="i-lucide:info cursor-help text-xs text-neutral-400" />
                    </TooltipTrigger>
                    <TooltipContent class="z-110 max-w-sm rounded-lg bg-neutral-900 p-2.5 text-xs text-white shadow-xl">
                      <span>This block is appended at the tail of the LLM prompt to preserve KV prefix cache alignment.</span>
                      <TooltipArrow class="fill-neutral-900" />
                    </TooltipContent>
                  </TooltipRoot>
                </TooltipProvider>
              </div>

              <button
                type="button"
                class="flex items-center gap-1 text-[11px] text-primary-600 font-medium transition dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                :disabled="isRefreshingSensors"
                @click="refreshTelemetry"
              >
                <span :class="isRefreshingSensors ? 'i-lucide:loader-2 animate-spin' : 'i-lucide:refresh-cw'" class="text-xs" />
                <span>{{ isRefreshingSensors ? 'Polling OS Probes...' : 'Refresh Telemetry' }}</span>
              </button>
            </div>
            <pre class="max-h-36 overflow-y-auto border border-neutral-200 rounded-lg bg-neutral-950 p-3 text-[11px] text-green-400 font-mono dark:border-neutral-700">{{ sensorPayload || staticSamplePayload }}</pre>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 5. 24H SHORT-TERM MEMORY SUB-TAB                                  -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'short_term'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <input
                id="short-term-memory-toggle"
                v-model="shortTermMemoryEnabled"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
              >
              <label for="short-term-memory-toggle" class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Enable 24-Hour Short-Term Memory Consolidation
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Proactively summarizes each 24-hour conversational block into daily memory chunks injected directly into the system prompt.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
              shortTermMemoryEnabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
            ]"
          >
            {{ shortTermMemoryEnabled ? 'Active' : 'Disabled' }}
          </span>
        </div>

        <div v-if="shortTermMemoryEnabled" class="flex flex-col gap-5">
          <!-- Memory Rolling Window & Token Budget -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Memory Rolling Window (Days)
              </label>
              <div class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input
                  v-model.number="shortTermMemoryWindowSize"
                  type="number"
                  min="1"
                  max="30"
                  class="w-full bg-transparent font-medium outline-none"
                >
                <span class="text-neutral-400">days</span>
              </div>
              <span class="text-[11px] text-neutral-400">Number of recent daily summary blocks retained in active prompt.</span>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                Token Budget per Daily Summary
              </label>
              <div class="flex items-center gap-2 border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input
                  v-model.number="shortTermMemoryTokenBudget"
                  type="number"
                  min="200"
                  max="4000"
                  step="100"
                  class="w-full bg-transparent font-medium outline-none"
                >
                <span class="text-neutral-400">tokens</span>
              </div>
              <span class="text-[11px] text-neutral-400">Target token ceiling for each 24-hour summary compression.</span>
            </div>
          </div>

          <!-- Universe Alignment Info Card -->
          <div class="flex items-start gap-2.5 border border-emerald-200/80 rounded-lg bg-emerald-50/50 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <span class="i-solar:shield-check-bold-duotone shrink-0 text-lg text-emerald-600 dark:text-emerald-400" />
            <div class="flex flex-col gap-0.5 text-xs text-emerald-900 dark:text-emerald-200">
              <span class="font-semibold">Flat Universe Isolation</span>
              <p class="text-[11px] text-emerald-700 leading-relaxed dark:text-emerald-300">
                Short-term memory blocks are automatically tagged and isolated by Universe (e.g. <code>global</code> vs custom storyline universes), preventing memory cross-talk between divergent roleplay timelines.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
