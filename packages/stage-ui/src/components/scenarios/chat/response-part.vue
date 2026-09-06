<script setup lang="ts">
import type { ChatAssistantMessage } from '../../../types/chat'
import type { PacingMetrics, PacingState, PacingStateLogEntry } from '../../../types/pacing'

import { useBroadcastChannel, useElementSize, useIntervalFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useAiriCardStore } from '../../../stores/modules/airi-card'

const props = defineProps<{
  message: ChatAssistantMessage & { id?: string, createdAt?: number }
  variant?: 'desktop' | 'mobile'
}>()

const { t } = useI18n()
const chatOrchestrator = useChatOrchestratorStore()
const airiCardStore = useAiriCardStore()

const isExpanded = ref(false)
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const pacingLedgerContainerRef = ref<HTMLDivElement | null>(null)
const liveElapsedSec = ref<number>(0)

const localPacingMetrics = ref<PacingMetrics | null>(null)
watch(() => (props.message.categorization as any)?.pacingMetrics, (metrics) => {
  if (metrics) {
    localPacingMetrics.value = metrics
  }
}, { immediate: true })

const { data: latestPacingTelemetry } = useBroadcastChannel<PacingMetrics, PacingMetrics>({
  name: 'airi:pacing-telemetry',
})

const isStreamingThisMessage = computed(() => {
  return !!props.message.id && chatOrchestrator.streamingMessage?.id === props.message.id
})

watch(latestPacingTelemetry, (telemetry) => {
  if (!telemetry)
    return
  if (telemetry.turnId === props.message.id || (isStreamingThisMessage.value && (!telemetry.turnId || telemetry.turnId === props.message.id))) {
    localPacingMetrics.value = telemetry
    if (props.message.categorization) {
      ;(props.message.categorization as any).pacingMetrics = telemetry
    }
  }
})

const isPacingConfigured = computed(() => {
  return !!airiCardStore.activeCard?.extensions?.airi?.acting?.pacing?.enabled
})

const isPacingActive = computed(() => {
  if (localPacingMetrics.value != null) {
    return true
  }
  return isPacingConfigured.value
})

const pacingStateLog = computed<PacingStateLogEntry[]>(() => {
  return localPacingMetrics.value?.stateLog || []
})

const fillersCountText = computed(() => {
  const spoken = localPacingMetrics.value?.fillersSpokenCount ?? localPacingMetrics.value?.spokenCount ?? thinkAloudCount.value ?? 0
  const max = localPacingMetrics.value?.maxFillers ?? airiCardStore.activeCard?.extensions?.airi?.acting?.pacing?.maxFillersPerTurn ?? 3
  return `${spoken}/${max} fillers`
})

const pacingStatusText = computed(() => {
  if (!localPacingMetrics.value)
    return ''
  const state = localPacingMetrics.value.liveState
  if (state === 'FILLER_ACTIVE') {
    return ' · 🎙️ speaking'
  }
  if (state === 'FILLER_ARMED') {
    return ' · ⏳ preparing'
  }
  if (state === 'HANDOFF') {
    return ' · handoff'
  }
  if (state === 'STAGING') {
    const cd = localPacingMetrics.value.nextOpportunityCountdownSec
    if (typeof cd === 'number' && cd > 0) {
      return ` · next in ${cd}s`
    }
  }
  return ''
})

function formatRelTime(ms: number): string {
  const totalSec = Math.max(0, ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = (totalSec % 60).toFixed(1)
  return `[${String(mins).padStart(2, '0')}:${secs.padStart(4, '0')}]`
}

function getPacingStateBadgeClass(state: PacingState): string {
  switch (state) {
    case 'FILLER_ACTIVE':
      return 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300'
    case 'FILLER_ARMED':
      return 'bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300'
    case 'STAGING':
      return 'bg-blue-500/15 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300'
    case 'ANSWER_READY':
    case 'HANDOFF':
    case 'SETTLED':
      return 'bg-neutral-500/15 text-neutral-600 dark:bg-neutral-400/20 dark:text-neutral-300'
    default:
      return 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400'
  }
}

const hasContentText = computed(() => {
  const content = props.message.content
  if (typeof content === 'string') {
    return !!content.trim()
  }
  else if (Array.isArray(content)) {
    return content.some(part => part && typeof part === 'object' && 'type' in part && part.type === 'text' && !!(part as any).text?.trim())
  }
  return false
})

const hasReasoning = computed(() => {
  return !!props.message.categorization?.reasoning?.trim()
})

// Timer tracking for reasoning duration
const startTime = computed(() => props.message.createdAt || Date.now())

const { pause: stopTimer, resume: startTimer } = useIntervalFn(() => {
  if (isStreamingThisMessage.value && !hasContentText.value) {
    liveElapsedSec.value = Number(((Date.now() - startTime.value) / 1000).toFixed(1))
  }
}, 100, { immediate: false })

watch([isStreamingThisMessage, hasContentText], ([streaming, hasText]) => {
  if (streaming && !hasText) {
    startTimer()
  }
  else {
    stopTimer()
    if (props.message.categorization && liveElapsedSec.value > 0) {
      if (!(props.message.categorization as any).reasoningDurationSec) {
        ;(props.message.categorization as any).reasoningDurationSec = liveElapsedSec.value
      }
    }
  }
}, { immediate: true })

const durationSec = computed<number | null>(() => {
  const stored = (props.message.categorization as any)?.reasoningDurationSec
  if (typeof stored === 'number' && stored > 0) {
    return stored
  }
  if (isStreamingThisMessage.value && !hasContentText.value) {
    return liveElapsedSec.value
  }
  if (liveElapsedSec.value > 0) {
    return liveElapsedSec.value
  }
  return null
})

const durationDisplay = computed(() => {
  if (durationSec.value != null && durationSec.value > 0) {
    return `${durationSec.value.toFixed(1)}s`
  }
  return ''
})

const snippetContainerRef = ref<HTMLElement | null>(null)
const snippetTrackRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(snippetContainerRef)
const { width: trackWidth } = useElementSize(snippetTrackRef)
// Measurement only controls the fade; CSS owns the width and keeps the tail visible.
const snippetOverflows = computed(() => containerWidth.value > 0 && trackWidth.value > containerWidth.value + 1)

const cleanFullReasoning = computed(() => {
  const raw = props.message.categorization?.reasoning?.trim() || ''
  if (!raw) {
    return ''
  }
  return raw.replace(/<\/?think_aloud(?:\s[^>]*)?>/gi, '').replace(/\s+/g, ' ').trim()
})

const reasoningSnippet = computed(() => cleanFullReasoning.value || t('stage.chat.reasoning'))

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function scrollToBottom() {
  if (scrollContainerRef.value) {
    scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
  }
}

watch(() => props.message.categorization?.reasoning, () => {
  if (isExpanded.value) {
    nextTick(scrollToBottom)
  }
})

watch(() => pacingStateLog.value.length, () => {
  if (isExpanded.value) {
    nextTick(() => {
      if (pacingLedgerContainerRef.value) {
        pacingLedgerContainerRef.value.scrollTop = pacingLedgerContainerRef.value.scrollHeight
      }
    })
  }
})

watch(isExpanded, (expanded) => {
  if (expanded) {
    nextTick(() => {
      scrollToBottom()
      if (pacingLedgerContainerRef.value) {
        pacingLedgerContainerRef.value.scrollTop = pacingLedgerContainerRef.value.scrollHeight
      }
    })
  }
})

interface ReasoningSegment {
  type: 'text' | 'think_aloud'
  content: string
}

const reasoningSegments = computed<ReasoningSegment[]>(() => {
  const raw = props.message.categorization?.reasoning || ''
  if (!raw) {
    return []
  }

  const segments: ReasoningSegment[] = []
  const tagRegex = /<think_aloud(?:\s[^>]*)?>([\s\S]*?)(?:<\/think_aloud>|$)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: raw.slice(lastIndex, match.index),
      })
    }
    if (match[1]) {
      segments.push({
        type: 'think_aloud',
        content: match[1],
      })
    }
    lastIndex = tagRegex.lastIndex
    if (match.index === tagRegex.lastIndex) {
      tagRegex.lastIndex++
    }
  }

  if (lastIndex < raw.length) {
    segments.push({
      type: 'text',
      content: raw.slice(lastIndex),
    })
  }

  return segments
})

const thinkAloudCount = computed(() => reasoningSegments.value.filter(s => s.type === 'think_aloud').length)
</script>

<template>
  <div
    v-if="hasReasoning"
    class="dark:border-neutral-750/80 dark:bg-neutral-850/40 max-w-full w-full overflow-hidden border border-neutral-200/80 rounded-xl bg-neutral-100/40 backdrop-blur-sm transition-all duration-200"
    :class="[props.variant === 'mobile' ? 'text-xs' : 'text-sm']"
  >
    <div
      role="button"
      tabindex="0"
      :aria-expanded="isExpanded"
      class="max-w-full min-w-0 w-full flex cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-neutral-600 outline-none transition-colors hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/40"
      @click="toggleExpanded"
      @keydown.enter.prevent="toggleExpanded"
      @keydown.space.prevent="toggleExpanded"
    >
      <div class="min-w-0 flex flex-1 items-center gap-1.5 overflow-hidden">
        <div
          class="i-solar:lightbulb-bolt-bold-duotone size-3.5 shrink-0 text-amber-500 dark:text-amber-400"
          :class="{ 'animate-pulse': isStreamingThisMessage && !hasContentText }"
        />
        <!-- Collapsed: 1-line dynamic tail-chasing text preview -->
        <span
          v-show="!isExpanded"
          ref="snippetContainerRef"
          :class="[
            'relative h-4 min-w-0 flex-1 overflow-hidden',
            'text-[11px] text-neutral-600 leading-4 font-mono italic dark:text-neutral-350',
          ]"
          :style="snippetOverflows ? { maskImage: 'linear-gradient(to right, transparent, black 1rem)' } : undefined"
          :title="cleanFullReasoning || reasoningSnippet"
        >
          <!-- Out of flow so the full stream cannot determine the bubble's intrinsic width. -->
          <span ref="snippetTrackRef" class="absolute right-0 top-0 min-w-full w-max whitespace-nowrap text-left">{{ reasoningSnippet }}</span>
        </span>
        <!-- Expanded: hide repetitive preview, show label and optional metrics -->
        <span
          v-show="isExpanded"
          class="dark:text-neutral-350 text-[11px] text-neutral-600 font-medium font-sans"
        >
          {{ t('stage.chat.reasoning') }}
        </span>

        <!-- Pacing indicator (visible in both collapsed and expanded when pacing is enabled) -->
        <template v-if="isPacingActive">
          <span class="shrink-0 text-neutral-300 dark:text-neutral-600">|</span>
          <span class="shrink-0 text-[11px] text-amber-600 font-medium font-mono tabular-nums dark:text-amber-400">
            {{ fillersCountText }}<span v-if="pacingStatusText" class="text-neutral-500 font-normal dark:text-neutral-400">{{ pacingStatusText }}</span>
          </span>
        </template>

        <span v-if="durationDisplay" class="shrink-0 text-neutral-300 dark:text-neutral-600">|</span>
        <span v-if="durationDisplay" class="shrink-0 text-[11px] text-neutral-500 font-medium font-mono tabular-nums dark:text-neutral-400">
          {{ durationDisplay }}
        </span>

        <!-- Utterance count tag when expanded and pacing is NOT enabled -->
        <span
          v-if="isExpanded && thinkAloudCount > 0 && !isPacingActive"
          class="ml-1 min-w-0 inline-flex items-center gap-0.5 truncate rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] text-amber-600 font-medium font-mono dark:bg-amber-400/15 dark:text-amber-300"
        >
          {{ thinkAloudCount }} {{ thinkAloudCount === 1 ? 'utterance' : 'utterances' }}
        </span>
      </div>
      <div
        class="i-solar:alt-arrow-down-linear size-3 shrink-0 text-neutral-400 transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
      />
    </div>

    <!-- Bipartite Drawer: Upper 3-row Preview Marquee -->
    <div
      v-show="isExpanded"
      ref="scrollContainerRef"
      class="dark:border-neutral-750/60 dark:text-neutral-350 [overflow-wrap:anywhere] h-[4.5rem] max-h-[4.5rem] select-text overflow-x-hidden overflow-y-auto border-t border-neutral-200/60 px-2.5 py-2 text-xs text-neutral-600 leading-relaxed font-mono"
    >
      <template v-for="(seg, idx) in reasoningSegments" :key="idx">
        <span v-if="seg.type === 'text'" class="whitespace-pre-wrap">{{ seg.content }}</span>
        <span
          v-else-if="seg.type === 'think_aloud'"
          class="my-0.5 max-w-full min-w-0 inline-flex items-center gap-1 border border-amber-400/40 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-800 font-medium font-sans shadow-sm dark:border-amber-600/40 dark:bg-amber-400/20 dark:text-amber-200"
        >
          <span class="i-solar:chat-round-dots-bold size-3 shrink-0 text-amber-500 dark:text-amber-400" />
          <span class="min-w-0 whitespace-pre-wrap font-mono">{{ seg.content }}</span>
        </span>
      </template>
    </div>

    <!-- Bipartite Drawer: Lower 3-line Pacing State Machine Ledger -->
    <div
      v-show="isExpanded && isPacingActive && pacingStateLog.length > 0"
      ref="pacingLedgerContainerRef"
      class="dark:border-neutral-750/60 h-[4.5rem] max-h-[4.5rem] select-text overflow-y-auto border-t border-neutral-200/60 bg-neutral-200/30 px-2.5 py-1.5 text-[10px] font-mono space-y-1 dark:bg-neutral-900/30"
    >
      <div
        v-for="(entry, idx) in pacingStateLog"
        :key="idx"
        class="flex items-center gap-1.5 text-neutral-600 leading-tight dark:text-neutral-400"
      >
        <span class="shrink-0 text-neutral-400 font-semibold tabular-nums dark:text-neutral-500">
          {{ formatRelTime(entry.relTimeMs) }}
        </span>
        <span
          class="shrink-0 rounded px-1 py-0.2 text-[9px] font-medium"
          :class="getPacingStateBadgeClass(entry.state)"
        >
          {{ entry.state }}
        </span>
        <span class="flex-1 truncate" :title="entry.details ? `${entry.event} (${entry.details})` : entry.event">
          {{ entry.event }}
          <span v-if="entry.details" class="text-neutral-400 font-normal dark:text-neutral-500">· {{ entry.details }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
