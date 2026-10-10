<script setup lang="ts">
import { useVisionSources } from '@proj-airi/stage-ui/composables'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { Button } from '@proj-airi/ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import proactivityBubblesUrl from '../../../../../../assets/proactivity-speech-bubbles.avif'
import AssistantBubble from '../components/assistant-bubble.vue'

import { getMoondreamAdapter } from '../../../../../../libs/inference/adapters/moondream'
import { isModelCached } from '../../../../../../libs/inference/cache-utils'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()
const draft = useOnboardingV3Draft()
const proactivityStore = useProactivityStore()
const visionStore = useVisionStore()

// --- 1. Mode Definitions & State ---
type InteractionChoiceId = 'on-demand' | 'heartbeats' | 'screen' | 'both'

const heartbeatsEnabled = ref<boolean>(draft.state.heartbeatsEnabled !== false)
const screenWatcherEnabled = ref<boolean>(draft.state.screenWatcherEnabled !== false)

const initialChoice: InteractionChoiceId = (heartbeatsEnabled.value && screenWatcherEnabled.value)
  ? 'both'
  : (screenWatcherEnabled.value
      ? 'screen'
      : (heartbeatsEnabled.value ? 'heartbeats' : 'on-demand'))

const proactivityEngineMode = ref<InteractionChoiceId>(initialChoice)

function selectInteractionChoice(choice: InteractionChoiceId) {
  proactivityEngineMode.value = choice
  if (choice === 'on-demand') {
    heartbeatsEnabled.value = false
    screenWatcherEnabled.value = false
  }
  else if (choice === 'heartbeats') {
    heartbeatsEnabled.value = true
    screenWatcherEnabled.value = false
  }
  else if (choice === 'screen') {
    heartbeatsEnabled.value = false
    screenWatcherEnabled.value = true
  }
  else if (choice === 'both') {
    heartbeatsEnabled.value = true
    screenWatcherEnabled.value = true
  }
  syncDraft()
}

const interactionChoices = [
  {
    id: 'on-demand' as const,
    title: 'On demand',
    desc: 'Responds when you start a conversation.',
    icon: 'i-solar:chat-round-outline',
  },
  {
    id: 'heartbeats' as const,
    title: 'Gentle check-ins',
    desc: 'Checks in with you periodically.',
    icon: 'i-solar:heart-angle-outline',
  },
  {
    id: 'screen' as const,
    title: 'Screen awareness',
    desc: 'Notices relevant changes on your screen.',
    icon: 'i-solar:monitor-outline',
  },
  {
    id: 'both' as const,
    title: 'Both',
    desc: 'Screen awareness and periodic check-ins.',
    icon: 'i-solar:chat-dots-outline',
  },
]

// --- 2. Screen Behavior & Delivery Mode ---
type ScreenBehavior = 'quiet' | 'comment'
type CommentDelivery = 'voice-and-bubble' | 'bubble-only' | 'voice-only'

const initialScreenBehavior: ScreenBehavior = draft.state.screenWatcherMode === 'muted' ? 'quiet' : 'comment'
const screenBehavior = ref<ScreenBehavior>(initialScreenBehavior)

const savedCommentDelivery = ref<CommentDelivery>(
  draft.state.screenWatcherMode && draft.state.screenWatcherMode !== 'muted'
    ? draft.state.screenWatcherMode
    : 'voice-and-bubble',
)

function selectScreenBehavior(behavior: ScreenBehavior) {
  screenBehavior.value = behavior
  syncDraft()
}

function selectCommentDelivery(delivery: CommentDelivery) {
  savedCommentDelivery.value = delivery
  syncDraft()
}

const deliveryOptions: { id: CommentDelivery, label: string, icon: string }[] = [
  { id: 'voice-and-bubble', label: 'Voice & bubble', icon: 'i-solar:chat-round-line-outline' },
  { id: 'bubble-only', label: 'Bubble only', icon: 'i-solar:chat-square-outline' },
  { id: 'voice-only', label: 'Voice only', icon: 'i-solar:volume-loud-outline' },
]

// --- 3. Screen or Window Capture Sources ---
const {
  sources,
  displaySources,
  applicationSources,
  isRefetching,
  refetchSources,
} = useVisionSources({ autoFetch: true })

const screenWatcherSourceType = ref<'displays' | 'applications'>(draft.state.screenWatcherSourceType || 'displays')
const screenWatcherSourceId = ref<string>(draft.state.screenWatcherSourceId || 'screen:primary')
const showSourcePicker = ref(false)
const permissionStatus = ref<string>('granted')

const selectedSourceLabel = computed(() => {
  if (!screenWatcherSourceId.value || screenWatcherSourceId.value === 'screen:primary' || screenWatcherSourceId.value === 'primary') {
    const primary = displaySources.value.find(s => s.id.includes('primary'))
    return primary ? primary.name : 'Primary Display'
  }
  const match = sources.value.find(s => s.id === screenWatcherSourceId.value)
  return match ? match.name : 'Choose a screen or window'
})

function selectSource(sourceId: string, type: 'displays' | 'applications') {
  screenWatcherSourceId.value = sourceId
  screenWatcherSourceType.value = type
  showSourcePicker.value = false
  syncDraft()
}

// --- 4. Check-in Frequency Presets ---
const heartbeatsInterval = ref<number>(draft.state.heartbeatsInterval || 5)
const checkInPresets = [
  { label: '2 min', value: 2 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
]

// --- 5. Screen Analysis (Vision Tier) ---
type VisionTier = 'lightweight' | 'moondream' | 'external'
const screenWatcherTier = ref<VisionTier>(draft.state.screenWatcherTier || 'lightweight')

const isMoondreamCached = ref(false)
const isMoondreamDownloading = ref(false)
const moondreamDownloadPercent = ref(0)

function selectVisionTier(tier: VisionTier) {
  screenWatcherTier.value = tier
  syncDraft()
}

async function downloadMoondream() {
  if (isMoondreamDownloading.value || isMoondreamCached.value)
    return
  isMoondreamDownloading.value = true
  moondreamDownloadPercent.value = 0
  try {
    const adapter = getMoondreamAdapter()
    await adapter.load((p) => {
      if (p.percent >= 0) {
        moondreamDownloadPercent.value = Math.round(p.percent)
      }
    })
    isMoondreamCached.value = true
    toast.success('Local scene understanding model downloaded and ready!')
  }
  catch (err: any) {
    toast.error(`Failed to download vision model: ${err?.message || err}`)
  }
  finally {
    isMoondreamDownloading.value = false
  }
}

// --- Dynamic Expectations (Right Panel) ---
const dynamicExpectationTitle = computed(() => {
  if (proactivityEngineMode.value === 'both')
    return 'Aware and conversational'
  if (proactivityEngineMode.value === 'screen')
    return screenBehavior.value === 'comment' ? 'Attentive observer' : 'Quiet observer'
  if (proactivityEngineMode.value === 'heartbeats')
    return 'Periodic companion'
  return 'On-demand companion'
})

const dynamicDeliveryText = computed(() => {
  if (savedCommentDelivery.value === 'voice-and-bubble')
    return 'Screen comments use voice and a bubble.'
  if (savedCommentDelivery.value === 'bubble-only')
    return 'Screen comments use a bubble only.'
  return 'Screen comments use voice only.'
})

function handleFineTuneHint() {
  toast.info('Advanced settings like quiet hours, tripwires, and sensitivity can be customized in Character Settings.')
}

onMounted(async () => {
  try {
    permissionStatus.value = await visionStore.checkPermissions?.() || 'granted'
  }
  catch {
    permissionStatus.value = 'granted'
  }

  try {
    isMoondreamCached.value = await isModelCached('Xenova/moondream2')
  }
  catch {
    isMoondreamCached.value = false
  }

  try {
    await proactivityStore.updateSensors?.()
  }
  catch {
    // Ignore preview error in sandbox/mock environments
  }
})

function syncDraft() {
  const activeWatcherMode = screenBehavior.value === 'quiet' ? 'muted' : savedCommentDelivery.value

  draft.setProactivity({
    heartbeatsEnabled: heartbeatsEnabled.value,
    heartbeatsInterval: heartbeatsInterval.value,
    operatingScheduleEnabled: draft.state.operatingScheduleEnabled !== false,
    wakeUpTime: draft.state.wakeUpTime || '09:00',
    bedTime: draft.state.bedTime || '22:00',
    pauseOnAfk: draft.state.pauseOnAfk !== false,
    afkMinutes: draft.state.afkMinutes || 5,
    sensorGroundingEnabled: draft.state.sensorGroundingEnabled !== false,
    salienceGatingEnabled: draft.state.salienceGatingEnabled !== false,
    heartbeatsContextWindowHistory: draft.state.heartbeatsContextWindowHistory !== false,
    heartbeatsContextSystemLoad: draft.state.heartbeatsContextSystemLoad !== false,
    heartbeatsContextUsageMetrics: draft.state.heartbeatsContextUsageMetrics !== false,
    eventLedgerEnabled: draft.state.eventLedgerEnabled !== false,
    eventLedgerSampleDepth: draft.state.eventLedgerSampleDepth || 6,
    eventLedgerDomains: draft.state.eventLedgerDomains ? [...draft.state.eventLedgerDomains] : ['vision', 'tools', 'chat', 'memory', 'discord'],
    smartSilenceDirectiveEnabled: draft.state.smartSilenceDirectiveEnabled !== false,
  })

  draft.setScreen({
    screenWatcherEnabled: screenWatcherEnabled.value,
    screenWatcherMode: activeWatcherMode,
    screenWatcherTier: screenWatcherTier.value,
    screenWatcherInterval: draft.state.screenWatcherInterval || 2000,
    screenWatcherSourceType: screenWatcherSourceType.value,
    screenWatcherSourceId: screenWatcherSourceId.value,
  })
}

onBeforeUnmount(() => {
  syncDraft()
})
</script>

<template>
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 pt-2 pb-5 flex flex-col gap-4']">
      <!-- Shared Centered Header -->
      <div :class="['flex flex-col items-center text-center gap-3 flex-shrink-0']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Proactivity
          </h1>
        </div>

        <AssistantBubble
          message="Choose when I chime in, and how I stay aware of your day."
          step-key="proactivity"
          sticker-id="airi-thanks"
          tone="primary"
        />
      </div>

      <!-- Top 4 Interaction Choices Row -->
      <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0']">
        <button
          v-for="choice in interactionChoices"
          :key="choice.id"
          type="button"
          :class="[
            'flex items-start justify-between p-3.5 rounded-2xl border text-left transition-all cursor-pointer select-none',
            proactivityEngineMode === choice.id
              ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30 shadow-xs'
              : 'border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="selectInteractionChoice(choice.id)"
        >
          <div :class="['flex items-start gap-3 pr-2 min-w-0']">
            <div
              :class="[
                'w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 transition-colors',
                proactivityEngineMode === choice.id
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500',
              ]"
            >
              <div :class="choice.icon" />
            </div>
            <div :class="['min-w-0']">
              <h4 :class="['text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate']">
                {{ choice.title }}
              </h4>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug mt-0.5 line-clamp-2']">
                {{ choice.desc }}
              </p>
            </div>
          </div>

          <!-- Radio Indicator -->
          <div :class="['shrink-0 mt-0.5']">
            <div
              v-if="proactivityEngineMode === choice.id"
              :class="['w-4 h-4 rounded-full border-2 border-primary-500 flex items-center justify-center']"
            >
              <div :class="['w-2 h-2 rounded-full bg-primary-500']" />
            </div>
            <div
              v-else
              :class="['w-4 h-4 rounded-full border border-neutral-300 dark:border-neutral-600']"
            />
          </div>
        </button>
      </div>

      <!-- Main Two-Column Content Area (~58% Left / ~42% Right) -->
      <div :class="['grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 flex-1 min-h-0']">
        <!-- Left Panel: Companion Behavior (58% -> lg:col-span-7) -->
        <div :class="['lg:col-span-7 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md p-5 flex flex-col justify-between gap-4']">
          <div :class="['flex flex-col gap-4']">
            <h3 :class="['text-sm sm:text-base font-bold text-neutral-900 dark:text-white']">
              Companion behavior
            </h3>

            <!-- State A: On Demand Explanation -->
            <div
              v-if="proactivityEngineMode === 'on-demand'"
              :class="['flex flex-col items-center justify-center py-10 px-4 text-center text-neutral-500 dark:text-neutral-400 gap-2.5 my-auto animate-fadeIn']"
            >
              <div :class="['w-10 h-10 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400']">
                <div :class="['i-solar:chat-round-outline w-5 h-5']" />
              </div>
              <div :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                On demand mode active
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 max-w-sm leading-relaxed']">
                Your companion only responds when you start a conversation. Background timers and screen observation are paused.
              </p>
            </div>

            <!-- State B: Active Behavior Sections -->
            <template v-else>
              <!-- 1. Screen Behavior (if screenWatcherEnabled) -->
              <div v-if="screenWatcherEnabled" :class="['flex flex-col gap-2.5 animate-fadeIn']">
                <div :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  1. Screen behavior
                </div>
                <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
                  <!-- Quiet awareness -->
                  <button
                    type="button"
                    :class="[
                      'flex items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer',
                      screenBehavior === 'quiet'
                        ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                        : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                    ]"
                    @click="selectScreenBehavior('quiet')"
                  >
                    <div :class="['flex items-start gap-2.5 pr-2']">
                      <div :class="['i-solar:eye-outline w-4 h-4 text-primary-500 shrink-0 mt-0.5']" />
                      <div>
                        <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                          Quiet awareness
                        </div>
                        <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                          Builds context for later conversations.
                        </p>
                      </div>
                    </div>
                    <div :class="['shrink-0 mt-0.5']">
                      <div
                        v-if="screenBehavior === 'quiet'"
                        :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                      >
                        <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                      </div>
                      <div
                        v-else
                        :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                      />
                    </div>
                  </button>

                  <!-- Comment on notable changes -->
                  <button
                    type="button"
                    :class="[
                      'flex items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer',
                      screenBehavior === 'comment'
                        ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                        : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                    ]"
                    @click="selectScreenBehavior('comment')"
                  >
                    <div :class="['flex items-start gap-2.5 pr-2']">
                      <div :class="['i-solar:chat-round-line-outline w-4 h-4 text-primary-500 shrink-0 mt-0.5']" />
                      <div>
                        <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                          Comment on notable changes
                        </div>
                        <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                          Can chime in when something relevant happens.
                        </p>
                      </div>
                    </div>
                    <div :class="['shrink-0 mt-0.5']">
                      <div
                        v-if="screenBehavior === 'comment'"
                        :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                      >
                        <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                      </div>
                      <div
                        v-else
                        :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                      />
                    </div>
                  </button>
                </div>

                <!-- Screen or window trigger row -->
                <div :class="['flex flex-col gap-1.5 mt-1']">
                  <div :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
                    Screen or window
                  </div>
                  <button
                    type="button"
                    :class="[
                      'w-full flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer text-left',
                      showSourcePicker
                        ? 'border-primary-500 bg-primary-500/5 ring-1 ring-primary-500/20'
                        : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
                    ]"
                    @click="showSourcePicker = !showSourcePicker"
                  >
                    <div :class="['flex items-center gap-2.5 truncate pr-2']">
                      <div :class="[screenWatcherSourceType === 'applications' ? 'i-solar:window-frame-outline' : 'i-solar:monitor-outline', 'w-4 h-4 text-neutral-500 dark:text-neutral-400 shrink-0']" />
                      <span :class="['text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate']">
                        {{ selectedSourceLabel }}
                      </span>
                    </div>
                    <div :class="[showSourcePicker ? 'i-solar:alt-arrow-down-linear' : 'i-solar:alt-arrow-right-linear', 'w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform']" />
                  </button>

                  <!-- Expanded Source Picker Panel -->
                  <div
                    v-if="showSourcePicker"
                    :class="['p-3 rounded-xl border border-neutral-200/70 dark:border-white/10 bg-neutral-50/80 dark:bg-black/30 flex flex-col gap-2.5 animate-fadeIn']"
                  >
                    <!-- Tabs + Refresh -->
                    <div :class="['flex items-center justify-between gap-2 border-b border-neutral-200/50 dark:border-white/5 pb-2']">
                      <div :class="['flex items-center gap-1 p-0.5 bg-neutral-200/60 dark:bg-neutral-800/80 rounded-lg text-xs']">
                        <button
                          type="button"
                          :class="[
                            'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                            screenWatcherSourceType === 'displays'
                              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white',
                          ]"
                          @click="screenWatcherSourceType = 'displays'"
                        >
                          Displays
                        </button>
                        <button
                          type="button"
                          :class="[
                            'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer',
                            screenWatcherSourceType === 'applications'
                              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                              : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white',
                          ]"
                          @click="screenWatcherSourceType = 'applications'"
                        >
                          Applications
                        </button>
                      </div>

                      <button
                        type="button"
                        :disabled="isRefetching"
                        :class="['p-1 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50']"
                        title="Refresh sources"
                        @click="refetchSources"
                      >
                        <div :class="['i-solar:refresh-linear w-3.5 h-3.5', isRefetching ? 'animate-spin' : '']" />
                      </button>
                    </div>

                    <!-- Permission Banner (macOS) -->
                    <div
                      v-if="permissionStatus === 'denied' || permissionStatus === 'not-determined'"
                      :class="['flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs']"
                    >
                      <div :class="['flex items-center gap-1.5']">
                        <div :class="['i-solar:shield-warning-bold w-3.5 h-3.5 shrink-0']" />
                        <span :class="['text-[11px]']">Screen recording permission needed</span>
                      </div>
                      <button
                        type="button"
                        :class="['px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 transition-colors cursor-pointer']"
                        @click="visionStore.openPermissionSettings"
                      >
                        Settings
                      </button>
                    </div>

                    <!-- Source Items List -->
                    <div :class="['max-h-36 overflow-y-auto flex flex-col gap-1 pr-1']">
                      <template v-if="screenWatcherSourceType === 'displays'">
                        <button
                          v-for="source in (displaySources.length ? displaySources : [{ id: 'screen:primary', name: 'Primary Display', resolution: 'Virtual Screen', icon: 'i-solar:monitor-outline', category: 'displays' }])"
                          :key="source.id"
                          type="button"
                          :class="[
                            'flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                            screenWatcherSourceId === source.id || (!screenWatcherSourceId && source.id.includes('primary'))
                              ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/20'
                              : 'border-neutral-200/50 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300',
                          ]"
                          @click="selectSource(source.id, 'displays')"
                        >
                          <div :class="['flex items-center gap-2 truncate']">
                            <div :class="['i-solar:monitor-outline w-3.5 h-3.5 text-primary-500 shrink-0']" />
                            <span :class="['truncate font-medium text-[11px]']">{{ source.name }}</span>
                          </div>
                          <span v-if="source.resolution" :class="['shrink-0 text-[10px] font-mono text-neutral-400']">{{ source.resolution }}</span>
                        </button>
                      </template>
                      <template v-else>
                        <button
                          v-for="source in applicationSources"
                          :key="source.id"
                          type="button"
                          :class="[
                            'flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-colors cursor-pointer',
                            screenWatcherSourceId === source.id
                              ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/20'
                              : 'border-neutral-200/50 dark:border-white/5 bg-white/40 dark:bg-white/[0.01] hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300',
                          ]"
                          @click="selectSource(source.id, 'applications')"
                        >
                          <div :class="['flex items-center gap-2 truncate']">
                            <img v-if="source.appIconURL" :src="source.appIconURL" class="h-4 w-4 shrink-0 rounded object-contain" alt="">
                            <div v-else :class="['i-solar:window-frame-outline w-3.5 h-3.5 text-primary-500 shrink-0']" />
                            <span :class="['truncate font-medium text-[11px]']">{{ source.name }}</span>
                          </div>
                          <span v-if="source.resolution" :class="['shrink-0 text-[10px] font-mono text-neutral-400']">{{ source.resolution }}</span>
                        </button>
                        <div v-if="applicationSources.length === 0" :class="['py-3 text-center text-xs text-neutral-400']">
                          No windows detected.
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. Comment Delivery (shown ONLY when Comment on notable changes is selected) -->
              <div v-if="screenWatcherEnabled && screenBehavior === 'comment'" :class="['flex flex-col gap-1.5 animate-fadeIn']">
                <div :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  2. Comment delivery
                </div>
                <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-2']">
                  <button
                    v-for="opt in deliveryOptions"
                    :key="opt.id"
                    type="button"
                    :class="[
                      'flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer',
                      savedCommentDelivery === opt.id
                        ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                        : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                    ]"
                    @click="selectCommentDelivery(opt.id)"
                  >
                    <div :class="['flex items-center gap-2 truncate pr-1']">
                      <div :class="[opt.icon, 'w-3.5 h-3.5 text-primary-500 shrink-0']" />
                      <span :class="['text-xs font-semibold truncate']">{{ opt.label }}</span>
                    </div>
                    <div :class="['shrink-0']">
                      <div
                        v-if="savedCommentDelivery === opt.id"
                        :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                      >
                        <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                      </div>
                      <div
                        v-else
                        :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                      />
                    </div>
                  </button>
                </div>
                <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5']">
                  Applies to comments prompted by screen activity.
                </p>
              </div>

              <!-- 3. Check-in Frequency (if heartbeatsEnabled) -->
              <div v-if="heartbeatsEnabled" :class="['flex flex-col gap-1.5 animate-fadeIn']">
                <div :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  {{ screenWatcherEnabled ? (screenBehavior === 'comment' ? '3. Check-in frequency' : '2. Check-in frequency') : '1. Check-in frequency' }}
                </div>
                <div :class="['grid grid-cols-4 gap-2']">
                  <button
                    v-for="freq in checkInPresets"
                    :key="freq.value"
                    type="button"
                    :class="[
                      'py-2 px-1 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer',
                      heartbeatsInterval === freq.value
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold ring-1 ring-primary-500/30'
                        : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                    ]"
                    @click="heartbeatsInterval = freq.value; syncDraft()"
                  >
                    {{ freq.label }}
                  </button>
                </div>
                <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5']">
                  Timing also follows your character's operating schedule.
                </p>
              </div>
            </template>
          </div>

          <!-- Bottom Note / Fine-Tune Link -->
          <div :class="['pt-2']">
            <button
              type="button"
              :class="['flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium cursor-pointer']"
              @click="handleFineTuneHint"
            >
              <div :class="['i-solar:settings-minimalistic-outline w-3.5 h-3.5']" />
              <span>Fine-tune later in Character Settings</span>
            </button>
          </div>
        </div>

        <!-- Right Panel: What to Expect (42% -> lg:col-span-5) -->
        <div :class="['lg:col-span-5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-sm backdrop-blur-md p-5 flex flex-col justify-between gap-4']">
          <div :class="['flex flex-col gap-3.5']">
            <h3 :class="['text-sm sm:text-base font-bold text-neutral-900 dark:text-white']">
              What to expect
            </h3>

            <!-- Twin-bubble illustration & dynamic summary -->
            <div :class="['flex items-start gap-4 p-3 rounded-xl bg-neutral-50/50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/5']">
              <img
                :src="proactivityBubblesUrl"
                class="h-18 w-18 shrink-0 object-contain sm:h-20 sm:w-20"
                alt=""
              >
              <div :class="['flex flex-col gap-2 min-w-0 flex-1']">
                <h4 :class="['text-xs sm:text-sm font-bold text-neutral-900 dark:text-white truncate']">
                  {{ dynamicExpectationTitle }}
                </h4>

                <div :class="['flex flex-col gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-300']">
                  <!-- Dynamic Screen bullet -->
                  <div v-if="screenWatcherEnabled" :class="['flex items-start gap-2']">
                    <div :class="['i-solar:eye-outline w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5']" />
                    <span v-if="screenBehavior === 'comment'">Relevant screen changes can prompt a comment.</span>
                    <span v-else>Notices screen changes quietly without interrupting.</span>
                  </div>

                  <!-- Dynamic Check-in bullet -->
                  <div v-if="heartbeatsEnabled" :class="['flex items-start gap-2']">
                    <div :class="['i-solar:clock-circle-outline w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5']" />
                    <span>Periodic check-ins are enabled.</span>
                  </div>

                  <!-- Dynamic Delivery bullet -->
                  <div v-if="screenWatcherEnabled && screenBehavior === 'comment'" :class="['flex items-start gap-2']">
                    <div :class="['i-solar:volume-loud-outline w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5']" />
                    <span>{{ dynamicDeliveryText }}</span>
                  </div>

                  <!-- On Demand bullets -->
                  <template v-if="proactivityEngineMode === 'on-demand'">
                    <div :class="['flex items-start gap-2']">
                      <div :class="['i-solar:chat-round-outline w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5']" />
                      <span>Responds only when you start a conversation.</span>
                    </div>
                    <div :class="['flex items-start gap-2']">
                      <div :class="['i-solar:shield-check-outline w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5']" />
                      <span>No background timers or screen captures.</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- Divider -->
            <div :class="['border-t border-neutral-200/60 dark:border-white/10']" />

            <!-- Screen Analysis section -->
            <div :class="['flex flex-col gap-2.5']">
              <div>
                <h4 :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  Screen analysis
                </h4>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
                  Choose how screen activity is understood.
                </p>
              </div>

              <!-- 3 Screen Analysis Cards -->
              <div :class="['flex flex-col gap-2']">
                <!-- 1. Lightweight -->
                <button
                  type="button"
                  :class="[
                    'flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer',
                    screenWatcherTier === 'lightweight'
                      ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                      : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                  ]"
                  @click="selectVisionTier('lightweight')"
                >
                  <div :class="['flex items-center gap-2.5 pr-2 truncate']">
                    <div :class="['i-solar:document-text-outline w-4 h-4 text-primary-500 shrink-0']" />
                    <div :class="['truncate']">
                      <div :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                        Lightweight
                      </div>
                      <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 truncate']">
                        Text recognition and visual change detection.
                      </p>
                    </div>
                  </div>
                  <div :class="['shrink-0']">
                    <div
                      v-if="screenWatcherTier === 'lightweight'"
                      :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                    >
                      <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                    </div>
                    <div
                      v-else
                      :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                    />
                  </div>
                </button>

                <!-- 2. Local scene understanding -->
                <div
                  :class="[
                    'flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer',
                    screenWatcherTier === 'moondream'
                      ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                      : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                  ]"
                  @click="selectVisionTier('moondream')"
                >
                  <div :class="['flex items-center justify-between w-full']">
                    <div :class="['flex items-center gap-2.5 pr-2 truncate']">
                      <div :class="['i-solar:cpu-bolt-outline w-4 h-4 text-primary-500 shrink-0']" />
                      <div :class="['truncate']">
                        <div :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                          Local scene understanding
                        </div>
                        <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 truncate']">
                          Uses a downloaded vision model on this device.
                        </p>
                      </div>
                    </div>
                    <div :class="['shrink-0']">
                      <div
                        v-if="screenWatcherTier === 'moondream'"
                        :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                      >
                        <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                      </div>
                      <div
                        v-else
                        :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                      />
                    </div>
                  </div>

                  <!-- Model provisioning & download state -->
                  <div
                    v-if="screenWatcherTier === 'moondream'"
                    :class="['mt-2 pt-2 border-t border-neutral-200/50 dark:border-white/5 flex items-center justify-between text-[11px]']"
                  >
                    <div v-if="isMoondreamCached" :class="['flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium']">
                      <div :class="['i-solar:check-circle-bold w-3.5 h-3.5']" />
                      <span>Downloaded & ready</span>
                    </div>
                    <div v-else-if="isMoondreamDownloading" :class="['flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium']">
                      <div :class="['i-solar:refresh-linear w-3.5 h-3.5 animate-spin']" />
                      <span>Downloading model ({{ moondreamDownloadPercent }}%)...</span>
                    </div>
                    <div v-else :class="['flex items-center justify-between w-full']">
                      <span :class="['text-neutral-500 dark:text-neutral-400 text-[10px]']">Model not yet downloaded</span>
                      <button
                        type="button"
                        :class="['px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-semibold text-[10px] shadow-xs cursor-pointer']"
                        @click.stop="downloadMoondream"
                      >
                        Download model (~1.1 GB)
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 3. Configured vision provider -->
                <button
                  type="button"
                  :class="[
                    'flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer',
                    screenWatcherTier === 'external'
                      ? 'border-primary-500 bg-primary-500/10 dark:bg-primary-950/30 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                      : 'border-neutral-200/70 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-white/20',
                  ]"
                  @click="selectVisionTier('external')"
                >
                  <div :class="['flex items-center justify-between w-full']">
                    <div :class="['flex items-center gap-2.5 pr-2 truncate']">
                      <div :class="['i-solar:cloud-outline w-4 h-4 text-primary-500 shrink-0']" />
                      <div :class="['truncate']">
                        <div :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                          Configured vision provider
                        </div>
                        <p :class="['text-[10px] text-neutral-500 dark:text-neutral-400 truncate']">
                          Uses the provider chosen in Vision.
                        </p>
                      </div>
                    </div>
                    <div :class="['shrink-0']">
                      <div
                        v-if="screenWatcherTier === 'external'"
                        :class="['w-3.5 h-3.5 rounded-full border-2 border-primary-500 flex items-center justify-center']"
                      >
                        <div :class="['w-1.5 h-1.5 rounded-full bg-primary-500']" />
                      </div>
                      <div
                        v-else
                        :class="['w-3.5 h-3.5 rounded-full border border-neutral-300 dark:border-neutral-600']"
                      />
                    </div>
                  </div>

                  <!-- Vision Provider note -->
                  <div
                    v-if="screenWatcherTier === 'external'"
                    :class="['mt-2 pt-2 border-t border-neutral-200/50 dark:border-white/5 text-[10px]']"
                  >
                    <span v-if="draft.state.visionModel || draft.state.visionProvider" :class="['text-primary-600 dark:text-primary-400 font-mono']">
                      Active: {{ draft.state.visionModel || draft.state.visionProvider }}
                    </span>
                    <span v-else :class="['text-amber-500 dark:text-amber-400']">
                      Notice: No provider configured in Vision step.
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Footnote -->
          <p :class="['text-[10px] text-neutral-400 dark:text-neutral-500 leading-tight pt-1']">
            Processing location depends on your vision, classifier, and brain settings.
          </p>
        </div>
      </div>
    </div>

    <!-- Pinned Bottom Navigation Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="150"
      :class="['flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <!-- Center Helper Note -->
      <div :class="['text-xs text-neutral-400 dark:text-neutral-500 text-center hidden sm:block truncate max-w-xs md:max-w-md']">
        You can adjust this later in Character Settings.
      </div>

      <div :class="['flex items-center gap-2']">
        <button
          type="button"
          :class="['px-3 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors cursor-pointer']"
          @click="() => { syncDraft(); props.onNext() }"
        >
          Set up later
        </button>
        <Button
          variant="primary"
          size="md"
          :class="[
            'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
            'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
          ]"
          @click="() => { syncDraft(); props.onNext() }"
        >
          <span>{{ t('onboarding.shell.next') }}</span>
          <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
