<script setup lang="ts">
import type { ChatAssistantMessage } from '../../../types/chat'

import { useElementSize, useIntervalFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useChatOrchestratorStore } from '../../../stores/chat'

const props = defineProps<{
  message: ChatAssistantMessage & { id?: string, createdAt?: number }
  variant?: 'desktop' | 'mobile'
}>()

const { t } = useI18n()
const chatOrchestrator = useChatOrchestratorStore()

const isExpanded = ref(false)
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const liveElapsedSec = ref<number>(0)

const isStreamingThisMessage = computed(() => {
  return !!props.message.id && chatOrchestrator.streamingMessage?.id === props.message.id
})

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
  const reasoning = props.message.categorization?.reasoning?.trim()
  const content = props.message.content
  let contentText = ''
  if (typeof content === 'string') {
    contentText = content.trim()
  }
  else if (Array.isArray(content)) {
    const textPart = content.find(part => part && typeof part === 'object' && 'type' in part && part.type === 'text') as { text?: string } | undefined
    contentText = textPart?.text?.trim() || ''
  }
  return !!reasoning && reasoning !== contentText
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

// Auto-collapse on answer text onset if user had expanded it during thinking
watch(hasContentText, (hasText, hadText) => {
  if (hasText && !hadText && isExpanded.value) {
    isExpanded.value = false
  }
})

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

const rulerRef = ref<HTMLElement | null>(null)
const snippetContainerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(snippetContainerRef)
const { width: rulerWidth } = useElementSize(rulerRef)

const charWidth = computed(() => {
  if (rulerWidth.value > 0) {
    return rulerWidth.value / 20
  }
  return 6.6
})

const charBudget = computed(() => {
  const w = containerWidth.value
  const cw = charWidth.value
  if (!w || w <= 0) {
    return 40
  }
  return Math.max(8, Math.floor(w / cw))
})

const cleanFullReasoning = computed(() => {
  const raw = props.message.categorization?.reasoning?.trim() || ''
  if (!raw) {
    return ''
  }
  return raw.replace(/<\/?think_aloud(?:\s[^>]*)?>/gi, '').replace(/\s+/g, ' ').trim()
})

const reasoningSnippet = computed(() => {
  const clean = cleanFullReasoning.value
  if (!clean) {
    return t('stage.chat.reasoning')
  }

  const budget = charBudget.value
  if (clean.length <= budget) {
    return clean
  }

  const tailChars = Math.max(1, budget - 3)
  return `...${clean.slice(-tailChars)}`
})

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

watch(isExpanded, (expanded) => {
  if (expanded) {
    nextTick(scrollToBottom)
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
    <span
      ref="rulerRef"
      aria-hidden="true"
      class="pointer-events-none invisible absolute text-[11px] font-mono"
      style="width: 20ch;"
    />
    <div
      role="button"
      tabindex="0"
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
          class="dark:text-neutral-350 min-w-0 flex-1 truncate text-[11px] text-neutral-600 font-mono italic"
          :title="cleanFullReasoning || reasoningSnippet"
        >
          {{ reasoningSnippet }}
        </span>
        <!-- Expanded: hide repetitive preview, show label and optional metrics -->
        <span
          v-show="isExpanded"
          class="dark:text-neutral-350 text-[11px] text-neutral-600 font-medium font-sans"
        >
          {{ t('stage.chat.reasoning') }}
        </span>

        <span v-if="durationDisplay" class="shrink-0 text-neutral-300 dark:text-neutral-600">|</span>
        <span v-if="durationDisplay" class="shrink-0 text-[11px] text-neutral-500 font-medium font-mono tabular-nums dark:text-neutral-400">
          {{ durationDisplay }}
        </span>

        <!-- Utterance count tag when expanded -->
        <span
          v-if="isExpanded && thinkAloudCount > 0"
          class="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.2 text-[10px] text-amber-600 font-medium font-mono dark:bg-amber-400/15 dark:text-amber-300"
        >
          {{ thinkAloudCount }} {{ thinkAloudCount === 1 ? 'utterance' : 'utterances' }}
        </span>
      </div>
      <div
        class="i-solar:alt-arrow-down-linear size-3 shrink-0 text-neutral-400 transition-transform duration-200"
        :class="{ 'rotate-180': isExpanded }"
      />
    </div>

    <div
      v-show="isExpanded"
      ref="scrollContainerRef"
      class="dark:border-neutral-750/60 dark:text-neutral-350 h-[4.5rem] max-h-[4.5rem] select-text overflow-y-auto border-t border-neutral-200/60 px-2.5 py-2 text-xs text-neutral-600 leading-relaxed font-mono"
    >
      <template v-for="(seg, idx) in reasoningSegments" :key="idx">
        <span v-if="seg.type === 'text'" class="whitespace-pre-wrap">{{ seg.content }}</span>
        <span
          v-else-if="seg.type === 'think_aloud'"
          class="my-0.5 inline-flex items-center gap-1 border border-amber-400/40 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-800 font-medium font-sans shadow-sm dark:border-amber-600/40 dark:bg-amber-400/20 dark:text-amber-200"
        >
          <span class="i-solar:chat-round-dots-bold size-3 shrink-0 text-amber-500 dark:text-amber-400" />
          <span class="whitespace-pre-wrap font-mono">{{ seg.content }}</span>
        </span>
      </template>
    </div>
  </div>
</template>
