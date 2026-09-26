<script setup lang="ts">
import { isWithinSchedule } from '@proj-airi/stage-shared'
import { useVisionSources } from '@proj-airi/stage-ui/composables'
import { downloadLayaModel, formatBytes, getLayaCacheSize, isLayaDownloaded, isModelCached } from '@proj-airi/stage-ui/libs/inference'
import { useProactivityStore, useScreenWatcherStore } from '@proj-airi/stage-ui/stores'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useVisionOrchestratorStore } from '@proj-airi/stage-ui/stores/modules/vision/orchestrator'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  sensorPayload?: string
  staticSamplePayload: string
}>()

const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
}>()

const proactivityStore = useProactivityStore()
const screenWatcherStore = useScreenWatcherStore()
const visionStore = useVisionStore()
const visionOrchestrator = useVisionOrchestratorStore()
const { isProvisioning, provisioningPercent, provisioningMessage, isLightweightReady, isVlmReady } = storeToRefs(visionOrchestrator)
const { hourlyPromotionsCount, nextHourlyResetAt } = storeToRefs(screenWatcherStore)
const isRefreshingSensors = ref(false)

async function handleProvision() {
  try {
    await visionOrchestrator.provisionModels({ enableVlm: screenWatchingVlmTier.value === 'moondream' })
  }
  catch (err) {
    console.error('[CardCreationTabProactivity] Provisioning failed:', err)
  }
}

// Primary display size so the capture-resolution readout reflects the real
// display (downscale is relative to native resolution, not a 720p baseline).
const primaryDisplaySize = ref<{ width: number, height: number } | null>(null)

async function refreshTelemetry() {
  isRefreshingSensors.value = true
  try {
    await proactivityStore.updateSensors()
    const disp = await visionStore.getPrimaryDisplaySize({ force: true })
    if (disp)
      primaryDisplaySize.value = { width: disp.width, height: disp.height }
  }
  catch (err) {
    console.error('[CardCreationTabProactivity] Telemetry refresh failed:', err)
  }
  finally {
    isRefreshingSensors.value = false
  }
}

async function checkModelCaches() {
  try {
    const lightweightCached = await isModelCached('Xenova/clip-vit-base-patch32')
    const vlmCached = await isModelCached('Xenova/moondream2')
    if (lightweightCached)
      isLightweightReady.value = true
    if (vlmCached)
      isVlmReady.value = true
  }
  catch {
    // Ignore cache probe failure
  }
}

// Sub-Tab Navigation State
type SubTabId = 'schedule' | 'heartbeats' | 'screen' | 'dream' | 'ledger' | 'short_term'
const activeSubTab = ref<SubTabId>('schedule')

watch(activeSubTab, (subTab) => {
  if (subTab === 'screen') {
    void checkModelCaches()
    void checkLayaCache()
  }
  else if (subTab === 'ledger') {
    void refreshTelemetry()
  }
})

onMounted(() => {
  if (activeSubTab.value === 'screen') {
    void checkModelCaches()
    void checkLayaCache()
  }
  else if (activeSubTab.value === 'ledger') {
    void refreshTelemetry()
  }
})

const subTabs = [
  { id: 'schedule' as const, label: 'Operating Schedule', icon: 'i-solar:clock-circle-bold-duotone', desc: 'Active hours & bedtime' },
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
const heartbeatsScheduleStart = defineModel<string>('heartbeatsScheduleStart', { default: '09:00' })
const heartbeatsScheduleEnd = defineModel<string>('heartbeatsScheduleEnd', { default: '23:00' })
const heartbeatsContextWindowHistory = defineModel<boolean>('heartbeatsContextWindowHistory', { default: true })
const heartbeatsContextSystemLoad = defineModel<boolean>('heartbeatsContextSystemLoad', { default: true })
const heartbeatsContextUsageMetrics = defineModel<boolean>('heartbeatsContextUsageMetrics', { default: true })
const heartbeatsRespectSchedule = defineModel<boolean>('heartbeatsRespectSchedule', { default: true })
const groundingEnabled = defineModel<boolean>('groundingEnabled', { default: false })

// Computed Schedule Status
const isAwakeCurrently = computed(() => isWithinSchedule(heartbeatsScheduleStart.value, heartbeatsScheduleEnd.value))
const scheduleDurationLabel = computed(() => {
  const [startH, startM] = (heartbeatsScheduleStart.value || '09:00').split(':').map(Number)
  const [endH, endM] = (heartbeatsScheduleEnd.value || '23:00').split(':').map(Number)
  const startTotal = (startH || 0) * 60 + (startM || 0)
  const endTotal = (endH || 0) * 60 + (endM || 0)
  const activeMinutes = endTotal >= startTotal ? endTotal - startTotal : (1440 - startTotal) + endTotal
  const sleepMinutes = 1440 - activeMinutes
  const activeHours = (activeMinutes / 60).toFixed(1).replace(/\.0$/, '')
  const sleepHours = (sleepMinutes / 60).toFixed(1).replace(/\.0$/, '')
  return `${activeHours}h active • ${sleepHours}h sleep`
})

// 2. Screen Watching (Push / Attention Ecology) Models
const screenWatchingEnabled = defineModel<boolean>('screenWatchingEnabled', { default: false })
const screenWatchingDeliveryMode = defineModel<'both' | 'bubble_only' | 'tts_only' | 'off'>('screenWatchingDeliveryMode', { default: 'both' })
const screenWatchingSourceType = defineModel<'displays' | 'applications' | 'auto_focused'>('screenWatchingSourceType', { default: 'displays' })
const screenWatchingSourceId = defineModel<string>('screenWatchingSourceId', { default: '' })
const screenWatchingCaptureIntervalMs = defineModel<number>('screenWatchingCaptureIntervalMs', { default: 2000 })
const screenWatchingDownscalePercent = defineModel<number>('screenWatchingDownscalePercent', { default: 100 })
const screenWatchingWorkload = defineModel<'attention-guard' | 'screen:interpret'>('screenWatchingWorkload', { default: 'attention-guard' })
const screenWatchingPublishToContext = defineModel<boolean>('screenWatchingPublishToContext', { default: true })
const screenWatchingInterestTags = defineModel<string[]>('screenWatchingInterestTags', {
  default: () => ['antigravity', 'terminal_error', 'youtube', 'discord'],
})
const screenWatchingMaxPerHour = defineModel<number>('screenWatchingMaxPerHour', { default: 4 })
const screenWatchingHysteresisMinutes = defineModel<number>('screenWatchingHysteresisMinutes', { default: 3 })
const screenWatchingEnableVlm = defineModel<boolean>('screenWatchingEnableVlm', { default: false })
const screenWatchingVlmTier = defineModel<'lightweight' | 'moondream' | 'external'>('screenWatchingVlmTier', {
  default: 'lightweight',
})
const screenWatchingRespectSchedule = defineModel<boolean>('screenWatchingRespectSchedule', { default: true })

export interface SentinelQuestionConfig {
  id: string
  text: string
  enabled: boolean
  threshold?: number
}

const screenWatchingGatingMode = defineModel<'trigger_tags' | 'system1_sentinel'>('screenWatchingGatingMode', { default: 'trigger_tags' })
const screenWatchingSentinelProvider = defineModel<'laya-local' | 'typesafe-ai' | 'openrouter-ai'>('screenWatchingSentinelProvider', { default: 'laya-local' })
const screenWatchingSentinelQuestions = defineModel<SentinelQuestionConfig[]>('screenWatchingSentinelQuestions', {
  default: () => [
    {
      id: 'general_novelty',
      text: 'Did a notable, unexpected, or socially meaningful event occur on screen that warrants companion proactive dialogue?',
      enabled: true,
      threshold: 0.75,
    },
    {
      id: 'build_error',
      text: 'Did the user encounter a compiler error, broken build, failing test run, or terminal exception?',
      enabled: true,
      threshold: 0.80,
    },
    {
      id: 'social_chat',
      text: 'Is the user messaging, chatting, or collaborating with a friend or colleague?',
      enabled: true,
      threshold: 0.75,
    },
    {
      id: 'media_consumption',
      text: 'Did the user start watching a notable video, live stream, or music release?',
      enabled: false,
      threshold: 0.70,
    },
  ],
})
const screenWatchingSentinelPolicy = defineModel<'any' | 'all'>('screenWatchingSentinelPolicy', { default: 'any' })
const screenWatchingSentinelThreshold = defineModel<number>('screenWatchingSentinelThreshold', { default: 0.75 })
const screenWatchingSentinelEvidenceEnabled = defineModel<boolean>('screenWatchingSentinelEvidenceEnabled', { default: true })

const providersStore = useProvidersStore()
const isLayaCached = ref(false)
const layaCacheSize = ref(0)
const isDownloadingLaya = ref(false)
const layaProgress = ref(0)
const layaDownloadError = ref('')

const isTypeSafeConfigured = computed(() => Boolean(providersStore.configuredProviders['typesafe-ai']))
const isOpenRouterConfigured = computed(() => Boolean(providersStore.configuredProviders['openrouter-ai']))

async function checkLayaCache() {
  try {
    isLayaCached.value = await isLayaDownloaded('int8')
    layaCacheSize.value = await getLayaCacheSize()
  }
  catch (e) {
    console.warn('[CardCreationTabProactivity] Laya cache check error:', e)
  }
}

async function handleDownloadLaya() {
  if (isDownloadingLaya.value)
    return

  isDownloadingLaya.value = true
  layaProgress.value = 0
  layaDownloadError.value = ''

  try {
    await downloadLayaModel({
      precision: 'int8',
      onProgress: (p) => {
        layaProgress.value = p.percentage
      },
    })
    await checkLayaCache()
    providersStore.forceProviderConfigured('laya-local')
  }
  catch (err: any) {
    console.error('[CardCreationTabProactivity] Failed to download Laya:', err)
    layaDownloadError.value = err?.message || 'Download failed'
  }
  finally {
    isDownloadingLaya.value = false
  }
}

const DEFAULT_PRESET_QUESTIONS = [
  {
    id: 'general_novelty',
    label: 'Novelty & Social Events',
    icon: 'i-solar:sparkles-bold-duotone',
    text: 'Did a notable, unexpected, or socially meaningful event occur on screen that warrants companion proactive dialogue?',
    threshold: 0.75,
  },
  {
    id: 'build_error',
    label: 'Compiler / Build Error',
    icon: 'i-solar:danger-triangle-bold-duotone',
    text: 'Did the user encounter a compiler error, broken build, failing test run, or terminal exception?',
    threshold: 0.80,
  },
  {
    id: 'social_chat',
    label: 'Direct Messaging / Chat',
    icon: 'i-solar:chat-round-line-bold-duotone',
    text: 'Is the user messaging, chatting, or collaborating with a friend or colleague?',
    threshold: 0.75,
  },
  {
    id: 'media_consumption',
    label: 'Video / Stream Watching',
    icon: 'i-solar:play-circle-bold-duotone',
    text: 'Did the user start watching a notable video, live stream, or music release?',
    threshold: 0.70,
  },
]

const newQuestionInput = ref('')

function addCustomSentinelQuestion() {
  const text = newQuestionInput.value.trim()
  if (!text)
    return
  const id = `custom_${Date.now()}`
  const questions = screenWatchingSentinelQuestions.value ? [...screenWatchingSentinelQuestions.value] : []
  questions.push({
    id,
    text,
    enabled: true,
    threshold: screenWatchingSentinelThreshold.value || 0.75,
  })
  screenWatchingSentinelQuestions.value = questions
  newQuestionInput.value = ''
}

function addPresetQuestion(preset: typeof DEFAULT_PRESET_QUESTIONS[number]) {
  const questions = screenWatchingSentinelQuestions.value ? [...screenWatchingSentinelQuestions.value] : []
  const existing = questions.find(q => q.id === preset.id)
  if (existing) {
    existing.enabled = true
  }
  else {
    questions.push({
      id: preset.id,
      text: preset.text,
      enabled: true,
      threshold: preset.threshold,
    })
  }
  screenWatchingSentinelQuestions.value = questions
}

function removeSentinelQuestion(index: number) {
  const questions = screenWatchingSentinelQuestions.value ? [...screenWatchingSentinelQuestions.value] : []
  questions.splice(index, 1)
  screenWatchingSentinelQuestions.value = questions
}

// If user switches to direct commentary (screen:interpret), promote lightweight to external or moondream
// since direct commentary requires full visual comprehension.
watch(screenWatchingWorkload, (workload) => {
  if (workload === 'screen:interpret' && screenWatchingVlmTier.value === 'lightweight') {
    screenWatchingVlmTier.value = 'external'
  }
})

// Sync screenWatchingVlmTier with screenWatchingEnableVlm for backward-compatibility
if (screenWatchingVlmTier.value === 'lightweight' && screenWatchingEnableVlm.value) {
  screenWatchingVlmTier.value = 'moondream'
}

watch(screenWatchingVlmTier, (tier) => {
  screenWatchingEnableVlm.value = tier === 'moondream'
})
watch(screenWatchingEnableVlm, (enabled) => {
  if (enabled && screenWatchingVlmTier.value === 'lightweight') {
    screenWatchingVlmTier.value = 'moondream'
  }
  else if (!enabled && screenWatchingVlmTier.value === 'moondream') {
    screenWatchingVlmTier.value = 'lightweight'
  }
})
const globalVisionProviderLabel = computed(() => {
  const provider = visionStore.activeProvider
  const model = visionStore.activeModel
  if (!provider)
    return 'Not configured'
  return model ? `${provider} (${model})` : provider
})

const isHourlyBudgetExhausted = computed(() => {
  const limit = screenWatchingMaxPerHour.value || 4
  return (hourlyPromotionsCount.value || 0) >= limit
})

const nextHourlyResetLabel = computed(() => {
  if (!nextHourlyResetAt.value)
    return 'the next hour'
  const date = new Date(nextHourlyResetAt.value)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
})

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
    tags: ['steam', 'destiny', 'factorio'],
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

// 1. Operating Schedule & Presence Models
const presencePauseWhenAfk = defineModel<boolean>('presencePauseWhenAfk', { default: true })
const presenceAfkThresholdMinutes = defineModel<number>('presenceAfkThresholdMinutes', { default: 5 })

// 3. Dream State Models
const dreamStateEnabled = defineModel<boolean>('dreamStateEnabled', { default: false })
const dreamStateStrictAfkGating = defineModel<boolean>('dreamStateStrictAfkGating', { default: true })
const dreamStateRichness = defineModel<'minimal' | 'balanced' | 'lush'>('dreamStateRichness', { default: 'balanced' })
const dreamStateAfkThresholdMinutes = defineModel<number>('dreamStateAfkThresholdMinutes', { default: 5 })
const dreamStateSessionTimeoutMinutes = defineModel<number>('dreamStateSessionTimeoutMinutes', { default: 60 })
const dreamStateMaxSessionsPerDay = defineModel<number>('dreamStateMaxSessionsPerDay', { default: 4 })
const dreamStateMinConversationTurns = defineModel<number>('dreamStateMinConversationTurns', { default: 4 })
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
      <!-- 0. OPERATING SCHEDULE & BEDTIME SUB-TAB                           -->
      <!-- ================================================================= -->
      <div v-if="activeSubTab === 'schedule'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <div class="i-solar:clock-circle-bold-duotone text-lg text-primary-500" />
              <h4 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Character Operating Schedule & Bedtime
              </h4>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Establish a shared circadian rhythm for this character. Active hours coordinate Heartbeats, Screen Watching, and Dream State.
            </p>
          </div>
          <span
            :class="[
              'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5',
              isAwakeCurrently
                ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
            ]"
          >
            <span :class="isAwakeCurrently ? 'i-solar:sun-2-bold-duotone text-amber-500' : 'i-solar:moon-stars-bold-duotone text-indigo-400'" />
            {{ isAwakeCurrently ? 'Currently Awake' : 'Currently Asleep' }}
          </span>
        </div>

        <div class="flex flex-col gap-5">
          <!-- Active Operating Hours Card -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-4.5 dark:border-neutral-700/80 dark:bg-neutral-950/40">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="i-solar:calendar-date-bold-duotone text-base text-primary-500" />
                  <label class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                    Daily Active Hours (Wake Up & Bedtime)
                  </label>
                </div>
                <span class="rounded-md bg-neutral-200/70 px-2 py-0.5 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
                  {{ scheduleDurationLabel }}
                </span>
              </div>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                    🌅 Wake Up Time (Start of Day)
                  </span>
                  <input
                    v-model="heartbeatsScheduleStart"
                    type="time"
                    class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                  >
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                    🌙 Bedtime (Quiet Hours Begin)
                  </span>
                  <input
                    v-model="heartbeatsScheduleEnd"
                    type="time"
                    class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs font-mono dark:border-neutral-700 dark:bg-neutral-800"
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Subsystem Schedule Coordination -->
          <div class="flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              Subsystem Sleep & Quiet Gates
            </span>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <!-- Heartbeats Toggle -->
              <div class="flex items-start gap-3 border border-neutral-200 rounded-xl bg-white p-3.5 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-800/60">
                <input
                  id="sched-heartbeats-respect"
                  v-model="heartbeatsRespectSchedule"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                >
                <div class="flex flex-col gap-1">
                  <label for="sched-heartbeats-respect" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                    Heartbeats: Respect Operating Schedule
                  </label>
                  <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                    Strictly suppresses periodic pull check-ins and autonomous comments outside the active window.
                  </p>
                </div>
              </div>

              <!-- Screen Watching Toggle -->
              <div class="flex items-start gap-3 border border-neutral-200 rounded-xl bg-white p-3.5 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-800/60">
                <input
                  id="sched-screen-respect"
                  v-model="screenWatchingRespectSchedule"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                >
                <div class="flex flex-col gap-1">
                  <label for="sched-screen-respect" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                    Screen Watching: Respect Operating Schedule
                  </label>
                  <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                    Pauses continuous screen capture ticks and speech bubble reactions during bedtime quiet hours.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- User Presence & Away (AFK) Gating -->
          <div class="flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              User Presence & Away (AFK) Gating
            </span>

            <div class="flex flex-col gap-3 border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-800/60">
              <div class="flex items-start gap-3">
                <input
                  id="sched-presence-afk-check"
                  v-model="presencePauseWhenAfk"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                >
                <div class="flex flex-col gap-1">
                  <label for="sched-presence-afk-check" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                    Pause When Away from Computer (Require User Presence)
                  </label>
                  <p class="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                    Automatically pauses both proactive check-ins and screen captures when keyboard/mouse have been idle for more than the specified duration, ensuring AIRI only reacts while you are active at your desk.
                  </p>
                </div>
              </div>

              <div v-if="presencePauseWhenAfk" class="flex items-center gap-2 border-t border-neutral-100 pl-7 pt-1 dark:border-neutral-700/60">
                <span class="text-xs text-neutral-600 font-medium dark:text-neutral-400">
                  Consider user AFK / Away after:
                </span>
                <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                  <input
                    v-model.number="presenceAfkThresholdMinutes"
                    type="number"
                    min="1"
                    max="120"
                    class="w-12 bg-transparent text-right font-mono outline-none"
                  >
                  <span class="text-neutral-400">min</span>
                </div>
                <span class="text-[11px] text-neutral-400">of continuous inactivity</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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

          <!-- 2. Perception Mode & Visual Engine -->
          <div class="flex flex-col gap-3 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              2. Perception Mode & Visual Engine
            </span>

            <!-- Vision Engine Mode / Behavior -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Perception & Delivery Mode
                </label>
                <span class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                  {{ screenWatchingWorkload === 'attention-guard' ? 'Ambient Memory & Grounding' : 'Direct Live Commentary' }}
                </span>
              </div>

              <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <!-- Mode 1: Ambient Awareness (Attention Ecology) -->
                <button
                  type="button"
                  :class="[
                    'flex flex-col gap-1.5 p-3.5 rounded-xl border text-xs transition-all text-left relative overflow-hidden',
                    screenWatchingWorkload === 'attention-guard'
                      ? 'border-primary-500 bg-primary-50/70 text-primary-950 ring-1 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-100'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                  ]"
                  @click="screenWatchingWorkload = 'attention-guard'"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-[13px] font-bold">
                      <div class="i-solar:radar-bold-duotone text-lg text-primary-600 dark:text-primary-400" />
                      <span>Ambient Awareness</span>
                    </div>
                    <span class="rounded-full bg-primary-100 px-2 py-0.5 text-[9px] text-primary-800 font-semibold dark:bg-primary-900/60 dark:text-primary-300">
                      Recommended
                    </span>
                  </div>
                  <span class="text-[11px] text-neutral-600 leading-relaxed dark:text-neutral-400">
                    Silently perceives your screen in the background. Uses 4-stage salience filters (pHash, CLIP, OCR) to ignore idle screens and quietly injects notable visual context into memory without interrupting you.
                  </span>
                  <div class="flex items-center gap-2 pt-1 text-[10px] text-neutral-500 font-medium dark:text-neutral-400">
                    <span class="flex items-center gap-1">
                      <div class="i-solar:check-circle-bold text-emerald-500" />
                      Zero chat spam
                    </span>
                    <span class="flex items-center gap-1">
                      <div class="i-solar:check-circle-bold text-emerald-500" />
                      Subconscious memory
                    </span>
                  </div>
                </button>

                <!-- Mode 2: Direct Chat Commentary (Screen Interpret) -->
                <button
                  type="button"
                  :class="[
                    'flex flex-col gap-1.5 p-3.5 rounded-xl border text-xs transition-all text-left relative overflow-hidden',
                    screenWatchingWorkload === 'screen:interpret'
                      ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 ring-1 ring-indigo-500 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-100'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                  ]"
                  @click="screenWatchingWorkload = 'screen:interpret'"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-[13px] font-bold">
                      <div class="i-solar:chat-round-line-bold-duotone text-lg text-indigo-600 dark:text-indigo-400" />
                      <span>Direct Commentary</span>
                    </div>
                    <span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] text-indigo-800 font-semibold dark:bg-indigo-900/60 dark:text-indigo-300">
                      Chat Ingestion
                    </span>
                  </div>
                  <span class="text-[11px] text-neutral-600 leading-relaxed dark:text-neutral-400">
                    Actively speaks and posts chat bubbles reacting in character to what you are doing on screen. Creates conversational message turns directly in your active chat transcript.
                  </span>
                  <div class="flex items-center gap-2 pt-1 text-[10px] text-neutral-500 font-medium dark:text-neutral-400">
                    <span class="flex items-center gap-1">
                      <div class="i-solar:chat-dots-bold text-indigo-500" />
                      Live speech & bubbles
                    </span>
                    <span class="flex items-center gap-1">
                      <div class="i-solar:fire-bold text-amber-500" />
                      High proactivity
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <!-- Vision Analysis Engine / Mode -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                  Analysis Tier & Engine
                </label>
                <span class="rounded-full bg-neutral-200/60 px-2 py-0.5 text-[10px] text-neutral-600 font-semibold font-mono dark:bg-neutral-800 dark:text-neutral-300">
                  {{ screenWatchingVlmTier === 'external' ? `External (${globalVisionProviderLabel})` : screenWatchingVlmTier === 'moondream' ? 'Premium (Moondream2 VLM)' : 'Lightweight (Local OCR)' }}
                </span>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  :disabled="screenWatchingWorkload === 'screen:interpret'"
                  :class="[
                    'flex flex-col gap-1 p-3 rounded-xl border text-xs transition-all text-left',
                    screenWatchingWorkload === 'screen:interpret'
                      ? 'opacity-40 cursor-not-allowed border-neutral-200 bg-neutral-100/60 dark:border-neutral-800 dark:bg-neutral-800/40 text-neutral-400'
                      : screenWatchingVlmTier === 'lightweight'
                        ? 'border-primary-500 bg-primary-50 text-primary-900 ring-1 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/60 dark:text-primary-200'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                  ]"
                  @click="screenWatchingVlmTier = 'lightweight'"
                >
                  <div class="flex items-center gap-2 font-bold">
                    <div class="i-solar:bolt-bold-duotone text-base text-amber-500" />
                    <span>Lightweight Mode</span>
                  </div>
                  <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ screenWatchingWorkload === 'screen:interpret' ? 'Unavailable for Direct Commentary. Commentary requires semantic visual comprehension (Moondream2 or External).' : 'Fast & zero extra VRAM. Uses local WASM OCR + CLIP zero-shot interest matching. Instant boot, 0MB download.' }}
                  </span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex flex-col gap-1 p-3 rounded-xl border text-xs transition-all text-left',
                    screenWatchingVlmTier === 'moondream'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-500 dark:border-indigo-500 dark:bg-indigo-950/60 dark:text-indigo-200'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                  ]"
                  @click="screenWatchingVlmTier = 'moondream'"
                >
                  <div class="flex items-center gap-2 font-bold">
                    <div class="i-solar:eye-bold-duotone text-base text-indigo-500" />
                    <span>Premium Mode</span>
                  </div>
                  <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Local WebGPU VLM (Moondream2). Generates semantic scene descriptions for promoted events (~700MB download).
                  </span>
                </button>

                <button
                  type="button"
                  :class="[
                    'flex flex-col gap-1 p-3 rounded-xl border text-xs transition-all text-left',
                    screenWatchingVlmTier === 'external'
                      ? 'border-sky-500 bg-sky-50 text-sky-900 ring-1 ring-sky-500 dark:border-sky-500 dark:bg-sky-950/60 dark:text-sky-200'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700/80 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:bg-neutral-700/60',
                  ]"
                  @click="screenWatchingVlmTier = 'external'"
                >
                  <div class="flex items-center gap-2 font-bold">
                    <div class="i-solar:cloud-upload-bold-duotone text-base text-sky-500" />
                    <span>External VLM</span>
                  </div>
                  <div class="truncate text-[10px] text-sky-700 font-medium dark:text-sky-300">
                    Active: {{ globalVisionProviderLabel }}
                  </div>
                  <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Routes promoted events through your configured Global Vision Provider without local WebGPU/VRAM overhead.
                  </span>
                </button>
              </div>

              <!-- External VLM Status Banner -->
              <div
                v-if="screenWatchingVlmTier === 'external'"
                class="flex items-center justify-between border border-sky-200/80 rounded-xl bg-sky-50/50 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/20"
              >
                <div class="flex items-center gap-2.5">
                  <div class="i-solar:cloud-check-bold-duotone text-lg text-sky-500" />
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                      Global Vision Provider Active
                    </span>
                    <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Promoted frames will be evaluated using {{ globalVisionProviderLabel }}. No local model downloads required.
                    </span>
                  </div>
                </div>
                <router-link
                  to="/settings/vision"
                  class="flex items-center gap-1 rounded-lg bg-sky-100/80 px-2.5 py-1 text-xs text-sky-700 font-medium transition-colors dark:bg-sky-900/50 hover:bg-sky-200 dark:text-sky-300 dark:hover:bg-sky-800/60"
                >
                  <span>Configure</span>
                  <div class="i-solar:arrow-right-linear text-xs" />
                </router-link>
              </div>

              <!-- Engine Provisioning & Readiness (Local WebGPU / WASM only) -->
              <div
                v-else
                class="flex flex-col gap-2.5 border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div
                      :class="[
                        'text-base',
                        (screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady)
                          ? 'i-solar:check-circle-bold-duotone text-emerald-500'
                          : isProvisioning
                            ? 'i-solar:refresh-circle-bold-duotone text-primary-500 animate-spin'
                            : 'i-solar:download-square-bold-duotone text-amber-500',
                      ]"
                    />
                    <div class="flex flex-col">
                      <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                        {{ screenWatchingVlmTier === 'moondream' ? 'Moondream2 VLM Package (~1.1GB)' : 'Lightweight OCR Package (~307MB)' }}
                      </span>
                      <span class="text-[10px] text-neutral-500 dark:text-neutral-400">
                        {{ screenWatchingVlmTier === 'moondream' ? 'CLIP Vision/Text + Tesseract WASM + Moondream2 Scene VLM' : 'CLIP Vision/Text Towers + Local Tesseract WASM' }}
                      </span>
                    </div>
                  </div>

                  <span
                    :class="[
                      'px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono',
                      (screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady)
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : isProvisioning
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                    ]"
                  >
                    {{ (screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady) ? 'Ready (Cached)' : isProvisioning ? 'Downloading...' : 'Not Cached' }}
                  </span>
                </div>

                <!-- Progress bar when provisioning -->
                <div v-if="isProvisioning" class="flex flex-col gap-1.5 pt-1">
                  <div class="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300">
                    <span class="max-w-[280px] truncate">{{ provisioningMessage || 'Downloading model weights...' }}</span>
                    <span class="text-primary-600 font-bold font-mono dark:text-primary-400">{{ provisioningPercent }}%</span>
                  </div>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      class="h-full bg-primary-500 transition-all duration-200"
                      :style="{ width: `${provisioningPercent}%` }"
                    />
                  </div>
                </div>

                <!-- Action button -->
                <div v-else class="flex items-center justify-between pt-1">
                  <span class="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ (screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady) ? 'Model weights are verified & cached locally in WebGPU engine.' : 'Download & compile models on demand before saving.' }}
                  </span>

                  <button
                    type="button"
                    class="flex items-center gap-1.5 rounded-lg bg-neutral-200/80 px-3 py-1.5 text-xs text-neutral-700 font-semibold transition-colors dark:bg-neutral-800 hover:bg-neutral-300 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    @click="handleProvision"
                  >
                    <div :class="(screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady) ? 'i-solar:refresh-linear' : 'i-solar:download-minimalistic-bold'" />
                    <span>{{ (screenWatchingVlmTier === 'moondream' ? isVlmReady : isLightweightReady) ? 'Re-verify Engine' : 'Provision Models' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Salience Gating & Screen Sentinel -->
          <div class="flex flex-col gap-4 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
                3. Salience Gating & Screen Sentinel
              </span>
              <span class="text-[10px] text-neutral-400 font-mono">
                {{ screenWatchingGatingMode === 'system1_sentinel' ? '⚡ System-1 Cognitive Sentinel' : 'Keyword & Tag Matching' }}
              </span>
            </div>

            <!-- Segmented Mode Switcher -->
            <div class="grid grid-cols-2 gap-1.5 border border-neutral-200/80 rounded-xl bg-neutral-100/70 p-1 dark:border-neutral-800 dark:bg-neutral-900/60">
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                  screenWatchingGatingMode === 'trigger_tags'
                    ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="screenWatchingGatingMode = 'trigger_tags'"
              >
                <div class="i-solar:hashtag-bold text-sm" />
                <span>Trigger-Based (Tags & Keywords)</span>
              </button>

              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                  screenWatchingGatingMode === 'system1_sentinel'
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                @click="screenWatchingGatingMode = 'system1_sentinel'"
              >
                <div class="i-solar:bolt-bold text-sm" />
                <span>⚡ System-1 Cognitive Sentinel</span>
              </button>
            </div>

            <!-- MODE 1: Trigger-Based (Tags & Keywords) -->
            <div v-if="screenWatchingGatingMode === 'trigger_tags'" class="flex flex-col gap-2.5">
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
                <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">Quick-Add Presets</span>
                <div class="flex flex-col gap-2">
                  <div
                    v-for="group in SUGGESTED_TAG_GROUPS"
                    :key="group.label"
                    class="flex flex-col gap-1 rounded-lg bg-white/60 p-2 text-xs dark:bg-neutral-900/40"
                  >
                    <div class="flex items-center gap-1.5 text-[11px] text-neutral-600 font-medium dark:text-neutral-400">
                      <div :class="[group.icon, 'text-sm']" />
                      <span>{{ group.label }}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="tag in group.tags"
                        :key="tag"
                        type="button"
                        class="flex cursor-pointer items-center gap-1 border border-neutral-300 rounded-md border-dashed bg-white px-2 py-0.5 text-[11px] text-neutral-600 font-medium transition-all dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-800/80 hover:bg-primary-50 dark:text-neutral-300 hover:text-primary-600 dark:hover:border-primary-600 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                        @click="addInterestTag(tag)"
                      >
                        <span class="text-neutral-400">+</span>
                        <span>#{{ tag }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <span class="text-[11px] text-neutral-400">Frames matching these tags are automatically promoted and written to the Unified Event Ledger.</span>
            </div>

            <!-- MODE 2: System-1 Cognitive Sentinel -->
            <div v-else class="flex flex-col gap-4">
              <!-- Cognitive Engine Setup Panel -->
              <div class="flex flex-col gap-2.5 border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/40">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="i-solar:cpu-bolt-bold-duotone text-sm text-primary-500" />
                    <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                      Cognitive Engine Backend
                    </span>
                  </div>
                  <span class="text-[10px] text-neutral-400 font-mono">
                    Non-Autoregressive Classifier (~100ms)
                  </span>
                </div>

                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <!-- Provider 1: Local Laya (ONNX) -->
                  <button
                    type="button"
                    :class="[
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150',
                      screenWatchingSentinelProvider === 'laya-local'
                        ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                    ]"
                    @click="screenWatchingSentinelProvider = 'laya-local'"
                  >
                    <div class="w-full flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs font-semibold">
                        <span class="i-solar:laptop-bold-duotone text-primary-500" />
                        <span>Local Laya</span>
                      </div>
                      <span class="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-600 font-medium dark:text-emerald-400">
                        Zero Cost
                      </span>
                    </div>
                    <p class="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                      Local ModernBERT ONNX. 100% private, on-device screening.
                    </p>
                    <div class="mt-auto w-full pt-1">
                      <span
                        v-if="isLayaCached"
                        class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-medium dark:text-emerald-400"
                      >
                        <span class="i-solar:check-circle-bold text-emerald-500" />
                        Ready Offline ({{ formatBytes(layaCacheSize) }})
                      </span>
                      <div v-else class="flex flex-col gap-1.5">
                        <div class="flex items-center justify-between gap-1">
                          <span class="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium dark:text-amber-400">
                            <span class="i-solar:danger-triangle-bold text-amber-500" />
                            Not Cached
                          </span>
                          <button
                            type="button"
                            class="inline-flex items-center gap-1 rounded bg-primary-600 px-2 py-0.5 text-[10px] text-white font-medium hover:bg-primary-500 disabled:opacity-50"
                            :disabled="isDownloadingLaya"
                            @click.stop="handleDownloadLaya"
                          >
                            <span v-if="isDownloadingLaya" class="i-solar:restart-bold animate-spin text-[10px]" />
                            <span v-else class="i-solar:download-square-bold text-[10px]" />
                            <span>{{ isDownloadingLaya ? `${layaProgress}%` : 'Download' }}</span>
                          </button>
                        </div>
                        <Progress v-if="isDownloadingLaya" :progress="layaProgress" class="h-1.5" />
                        <span v-if="layaDownloadError" class="text-[9px] text-red-500">
                          {{ layaDownloadError }}
                        </span>
                      </div>
                    </div>
                  </button>

                  <!-- Provider 2: TypeSafe Jev (Cloud) -->
                  <button
                    type="button"
                    :class="[
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150',
                      screenWatchingSentinelProvider === 'typesafe-ai'
                        ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                    ]"
                    @click="screenWatchingSentinelProvider = 'typesafe-ai'"
                  >
                    <div class="w-full flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs font-semibold">
                        <span class="i-solar:cloud-bold-duotone text-violet-500" />
                        <span>TypeSafe Jev</span>
                      </div>
                      <span class="rounded bg-violet-500/10 px-1.5 py-0.5 text-[9px] text-violet-600 font-medium dark:text-violet-400">
                        Cloud Fast
                      </span>
                    </div>
                    <p class="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                      Ultra-fast discrete logits triage. Sub-120ms latency.
                    </p>
                    <div class="mt-auto w-full pt-1">
                      <span
                        v-if="isTypeSafeConfigured"
                        class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-medium dark:text-emerald-400"
                      >
                        <span class="i-solar:check-circle-bold text-emerald-500" />
                        Configured
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium dark:text-amber-400"
                      >
                        <span class="i-solar:danger-triangle-bold text-amber-500" />
                        API Key Required in Providers
                      </span>
                    </div>
                  </button>

                  <!-- Provider 3: OpenRouter Decisions -->
                  <button
                    type="button"
                    :class="[
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-150',
                      screenWatchingSentinelProvider === 'openrouter-ai'
                        ? 'border-primary-500 bg-primary-50/40 text-primary-900 shadow-sm dark:bg-primary-950/30 dark:text-primary-200'
                        : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
                    ]"
                    @click="screenWatchingSentinelProvider = 'openrouter-ai'"
                  >
                    <div class="w-full flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs font-semibold">
                        <span class="i-solar:server-square-bold-duotone text-sky-500" />
                        <span>OpenRouter</span>
                      </div>
                      <span class="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-600 font-medium dark:text-sky-400">
                        Alpha Decisions
                      </span>
                    </div>
                    <p class="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                      OpenRouter alpha decisions endpoint using Jev models.
                    </p>
                    <div class="mt-auto w-full pt-1">
                      <span
                        v-if="isOpenRouterConfigured"
                        class="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 font-medium dark:text-emerald-400"
                      >
                        <span class="i-solar:check-circle-bold text-emerald-500" />
                        Configured
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium dark:text-amber-400"
                      >
                        <span class="i-solar:danger-triangle-bold text-amber-500" />
                        API Key Required in Providers
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Sentinel Question Tripwire Manager -->
              <div class="flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                      Active Sentinel Questions (Natural Language Tripwires)
                    </label>
                  </div>
                  <span class="text-[10px] text-neutral-400 font-mono">
                    {{ (screenWatchingSentinelQuestions || []).filter(q => q.enabled).length }} active tripwire{{ (screenWatchingSentinelQuestions || []).filter(q => q.enabled).length === 1 ? '' : 's' }}
                  </span>
                </div>

                <!-- Questions List -->
                <div class="flex flex-col gap-2">
                  <div
                    v-for="(q, idx) in screenWatchingSentinelQuestions"
                    :key="q.id"
                    :class="[
                      'flex flex-col gap-2 rounded-xl border p-3 transition-all',
                      q.enabled
                        ? 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900'
                        : 'border-neutral-200/60 bg-neutral-100/60 opacity-60 dark:border-neutral-800 dark:bg-neutral-950/40',
                    ]"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex flex-1 items-start gap-2.5">
                        <input
                          v-model="q.enabled"
                          type="checkbox"
                          class="mt-1 h-4 w-4 border-neutral-300 rounded text-primary-600 dark:border-neutral-700 focus:ring-primary-500"
                        >
                        <div class="flex flex-1 flex-col gap-1">
                          <input
                            v-model="q.text"
                            type="text"
                            class="w-full border border-transparent rounded-lg bg-transparent px-2 py-1 text-xs text-neutral-800 font-medium transition-colors focus:border-primary-400 hover:border-neutral-200 focus:bg-white dark:text-neutral-200 focus:outline-none dark:focus:bg-neutral-800"
                            placeholder="Sentinel prompt / question..."
                          >
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <!-- Per-question sensitivity threshold -->
                        <div class="flex items-center gap-1.5 rounded-lg bg-neutral-100 px-2 py-1 dark:bg-neutral-800">
                          <span class="text-[10px] text-neutral-500 font-medium dark:text-neutral-400">
                            Sensitivity:
                          </span>
                          <span class="text-[10px] text-primary-600 font-semibold font-mono dark:text-primary-400">
                            {{ Math.round((q.threshold ?? screenWatchingSentinelThreshold ?? 0.75) * 100) }}%
                          </span>
                        </div>

                        <!-- Delete button -->
                        <button
                          type="button"
                          title="Remove Sentinel Question"
                          class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                          @click="removeSentinelQuestion(idx)"
                        >
                          <span class="i-lucide:trash text-xs" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Add Custom Question Input -->
                <div class="flex items-center gap-2 border border-neutral-200 rounded-xl bg-neutral-50/80 p-2 dark:border-neutral-700 dark:bg-neutral-950">
                  <input
                    v-model="newQuestionInput"
                    type="text"
                    placeholder="+ Add custom sentinel tripwire question (e.g. 'Is the user looking at flight tickets?')..."
                    class="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-neutral-800 outline-none dark:text-neutral-200 placeholder-neutral-400"
                    @keydown.enter.prevent="addCustomSentinelQuestion()"
                  >
                  <button
                    type="button"
                    class="rounded-lg bg-neutral-200/80 px-3 py-1.5 text-xs text-neutral-700 font-semibold transition-colors dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-300 hover:text-white dark:hover:bg-primary-600 dark:hover:text-white"
                    @click="addCustomSentinelQuestion()"
                  >
                    Add Tripwire
                  </button>
                </div>

                <!-- Quick-Add Presets -->
                <div class="mt-1 flex flex-col gap-2 border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
                  <span class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">Quick-Add Presets</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="preset in DEFAULT_PRESET_QUESTIONS"
                      :key="preset.id"
                      type="button"
                      class="flex cursor-pointer items-center gap-1.5 border border-neutral-300 rounded-lg border-dashed bg-white px-2.5 py-1 text-[11px] text-neutral-600 font-medium transition-all dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-800/80 hover:bg-primary-50 dark:text-neutral-300 hover:text-primary-600 dark:hover:border-primary-600 dark:hover:bg-primary-950/50 dark:hover:text-primary-300"
                      @click="addPresetQuestion(preset)"
                    >
                      <div :class="[preset.icon, 'text-xs text-primary-500']" />
                      <span>+ {{ preset.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Trigger Policy, Sensitivity & Semantic Evidence Settings -->
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <!-- Trigger Policy -->
                <div class="flex flex-col gap-1.5 border border-neutral-200 rounded-xl bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                  <div class="flex items-center justify-between">
                    <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                      Trigger Policy
                    </label>
                    <span class="text-[10px] text-neutral-400 font-mono">
                      {{ screenWatchingSentinelPolicy === 'any' ? 'OR' : 'AND' }}
                    </span>
                  </div>
                  <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      :class="[
                        'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-center',
                        screenWatchingSentinelPolicy === 'any'
                          ? 'bg-primary-500 text-white font-semibold'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                      ]"
                      @click="screenWatchingSentinelPolicy = 'any'"
                    >
                      Any Question (OR)
                    </button>
                    <button
                      type="button"
                      :class="[
                        'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors text-center',
                        screenWatchingSentinelPolicy === 'all'
                          ? 'bg-primary-500 text-white font-semibold'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                      ]"
                      @click="screenWatchingSentinelPolicy = 'all'"
                    >
                      All Questions (AND)
                    </button>
                  </div>
                  <span class="text-[10px] text-neutral-400 leading-tight">
                    {{ screenWatchingSentinelPolicy === 'any' ? 'Promote if at least one active tripwire exceeds threshold.' : 'Promote only if all active tripwires agree.' }}
                  </span>
                </div>

                <!-- Global Sensitivity Slider -->
                <div class="flex flex-col gap-1.5 border border-neutral-200 rounded-xl bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                  <div class="flex items-center justify-between">
                    <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                      Default Trigger Sensitivity
                    </label>
                    <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                      {{ Math.round((screenWatchingSentinelThreshold || 0.75) * 100) }}%
                    </span>
                  </div>
                  <input
                    v-model.number="screenWatchingSentinelThreshold"
                    type="range"
                    min="0.50"
                    max="0.95"
                    step="0.05"
                    class="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-600 dark:bg-neutral-700"
                  >
                  <div class="flex justify-between text-[10px] text-neutral-400 font-mono">
                    <span>50% (Chatty)</span>
                    <span>75% (Balanced)</span>
                    <span>95% (Strict)</span>
                  </div>
                </div>
              </div>

              <!-- Semantic Evidence Attachment Toggle -->
              <div class="flex items-start gap-2.5 border border-primary-200/70 rounded-xl bg-primary-50/40 p-3.5 dark:border-primary-900/60 dark:bg-primary-950/20">
                <input
                  id="sentinel-evidence-enabled"
                  v-model="screenWatchingSentinelEvidenceEnabled"
                  type="checkbox"
                  class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                >
                <div class="flex flex-col gap-0.5">
                  <label for="sentinel-evidence-enabled" class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                    Semantic Evidence Attachment (Entity Ledger Grounding)
                  </label>
                  <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
                    Cross-references recognized on-screen names (e.g. "Kyo", "GitHub PR") against character memory and Unified Event Ledger so System-1 understands personal and social significance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Real-Time Reactions & Delivery -->
          <div class="flex flex-col gap-3.5 border-t border-neutral-100 pt-4 dark:border-neutral-800">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              4. Real-Time Reactions & Delivery
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

            <!-- Rate Limits & Cooldown -->
            <div class="flex flex-col gap-3">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
                      Max Interventions per Hour
                    </label>
                    <span
                      :class="[
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono',
                        isHourlyBudgetExhausted
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
                      ]"
                    >
                      Used: {{ hourlyPromotionsCount || 0 }} / {{ screenWatchingMaxPerHour || 4 }}
                    </span>
                  </div>
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

              <!-- Hourly Budget Exhaustion Warning Banner -->
              <div
                v-if="isHourlyBudgetExhausted"
                class="flex items-start gap-2.5 border border-amber-300/80 rounded-xl bg-amber-50/80 p-3 text-xs text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <div class="i-solar:danger-triangle-bold-duotone mt-0.5 shrink-0 text-base text-amber-600 dark:text-amber-400" />
                <div class="flex flex-col gap-0.5">
                  <span class="text-[11px] font-semibold tracking-wide uppercase">Hourly Rate Limit Reached</span>
                  <span class="text-[11px] leading-relaxed">
                    The system has already invoked the maximum number of events ({{ hourlyPromotionsCount }}/{{ screenWatchingMaxPerHour || 4 }}) for this hour. Increase the limit above or wait until <strong class="font-semibold font-mono">{{ nextHourlyResetLabel }}</strong> to continue triggering visual reactions.
                  </span>
                </div>
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
          <!-- Sleep Cycle & AFK Thresholds -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
                Min Conversation Turns
              </label>
              <div class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-800">
                <input v-model.number="dreamStateMinConversationTurns" type="number" min="1" max="50" class="w-full bg-transparent outline-none">
                <span class="text-neutral-400">turns</span>
              </div>
              <span class="text-[11px] text-neutral-400">Chat turns required before dream.</span>
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

          <!-- Dream State Lifecycle Explainer Card -->
          <div class="flex flex-col gap-2.5 border border-purple-200/70 rounded-xl bg-purple-50/40 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
            <div class="flex items-center gap-2 text-xs text-purple-900 font-semibold dark:text-purple-200">
              <span class="i-solar:moon-stars-bold-duotone text-base text-purple-600 dark:text-purple-400" />
              <span>How the Dream State Consolidation Cycle Works</span>
            </div>
            <div class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-4">
              <div class="flex flex-col gap-1 border border-purple-200/50 rounded-lg bg-white/80 p-2.5 dark:border-purple-800/40 dark:bg-neutral-900/60">
                <span class="text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">1. Interaction</span>
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Have ≥ {{ dreamStateMinConversationTurns || 4 }} chat turns</span>
                <span class="text-[11px] text-neutral-400">Accumulates recent context with your companion.</span>
              </div>
              <div class="flex flex-col gap-1 border border-purple-200/50 rounded-lg bg-white/80 p-2.5 dark:border-purple-800/40 dark:bg-neutral-900/60">
                <span class="text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">2. Quiet Window</span>
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Wait {{ dreamStateSessionTimeoutMinutes || 60 }}m quiet time</span>
                <span class="text-[11px] text-neutral-400">Ensures conversation has naturally ended.</span>
              </div>
              <div class="flex flex-col gap-1 border border-purple-200/50 rounded-lg bg-white/80 p-2.5 dark:border-purple-800/40 dark:bg-neutral-900/60">
                <span class="text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">3. Sleep / AFK</span>
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Go idle for {{ dreamStateAfkThresholdMinutes || 5 }}m</span>
                <span class="text-[11px] text-neutral-400">Triggers during bedtime or while stepping away.</span>
              </div>
              <div class="flex flex-col gap-1 border border-purple-200/50 rounded-lg bg-white/80 p-2.5 dark:border-purple-800/40 dark:bg-neutral-900/60">
                <span class="text-[10px] text-purple-600 font-bold tracking-wider uppercase dark:text-purple-400">4. Memory Echo</span>
                <span class="text-xs text-neutral-700 font-medium dark:text-neutral-200">Synthesizes echo chips</span>
                <span class="text-[11px] text-neutral-400">Condenses reflections to greet you upon return.</span>
              </div>
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
