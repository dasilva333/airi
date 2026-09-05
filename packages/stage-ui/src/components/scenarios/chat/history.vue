<script setup lang="ts">
import type { ChatAssistantMessage, ChatHistoryItem, ContextMessage } from '../../../types/chat'
import type { DirectorNote } from '../../../types/director'

import { useAutoAnimate } from '@formkit/auto-animate/vue'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ChatAssistantItem from './assistant-item.vue'
import DirectorNoteBubble from './DirectorNoteBubble.vue'
import ChatErrorItem from './error-item.vue'
import ProducerChoiceBubble from './ProducerChoiceBubble.vue'
import ChatUserItem from './user-item.vue'

import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useAutonomousArtistryStore } from '../../../stores/modules/artistry-autonomous'
import { useSettingsChat } from '../../../stores/settings'
import { chatScrollContainerKey } from './constants'

const props = withDefaults(defineProps<{
  messages: any[]
  streamingMessage?: ChatAssistantMessage & { createdAt?: number }
  sending?: boolean
  assistantLabel?: string
  userLabel?: string
  errorLabel?: string
  variant?: 'desktop' | 'mobile'
}>(), {
  sending: false,
  variant: 'desktop',
})

const emit = defineEmits<{
  (e: 'choose', choice: { title: string, message: string }, isPlaybackOnly?: boolean): void
  (e: 'retry-producer'): void
  (e: 'delete-producer'): void
}>()

const chatSettings = useSettingsChat()
const artistryStore = useAutonomousArtistryStore()
const cardStore = useAiriCardStore()
const chatSessionStore = useChatSessionStore()
const { activeSessionId } = storeToRefs(chatSessionStore)

const { t } = useI18n()

const labels = computed(() => ({
  assistant: props.assistantLabel ?? cardStore.activeCard?.nickname ?? cardStore.activeCard?.name ?? t('stage.chat.message.character-name.airi'),
  user: props.userLabel ?? t('stage.chat.message.character-name.you'),
  error: props.errorLabel ?? t('stage.chat.message.character-name.core-system'),
}))

const streaming = computed<ChatAssistantMessage & { context?: ContextMessage } & { createdAt?: number }>(() => props.streamingMessage ?? { role: 'assistant', content: '', slices: [], tool_results: [], createdAt: Date.now() })
const showStreamingPlaceholder = computed(() => (streaming.value.slices?.length ?? 0) === 0 && !streaming.value.content)
const streamingTs = computed(() => streaming.value?.createdAt)
function shouldShowPlaceholder(message: ChatHistoryItem) {
  const ts = streamingTs.value
  if (ts == null)
    return false

  return message.context?.createdAt === ts || message.createdAt === ts
}

const renderMessages = computed<(ChatHistoryItem | DirectorNote)[]>(() => {
  const monitorEnabled = (cardStore.activeCard?.extensions?.airi?.artistry as any)?.autonomousMonitorEnabled ?? true
  const directorNotes = (monitorEnabled && chatSettings.showDirectorNotes) ? (artistryStore.directorNotes || []).filter(n => !n.isArchived) : []

  let baseMessages: (ChatHistoryItem | DirectorNote)[] = props.messages

  const streamTs = streamingTs.value
  if (props.sending && streamTs) {
    const hasStreamAlready = props.messages.some(msg => msg?.role === 'assistant' && msg?.createdAt === streamTs)
    if (!hasStreamAlready) {
      baseMessages = [...props.messages, streaming.value]
    }
  }

  // Merge and sort
  const merged = [...baseMessages, ...directorNotes]
  return merged.sort((a, b) => {
    const timeA = a.createdAt || 0
    const timeB = b.createdAt || 0
    if (timeA !== timeB)
      return timeA - timeB

    // Stability fallback: prioritize user over assistant if timestamps are identical
    const roleA = 'role' in a ? a.role : undefined
    const roleB = 'role' in b ? b.role : undefined
    if (roleA !== roleB) {
      if (roleA === 'user')
        return -1
      if (roleB === 'user')
        return 1
    }

    const idA = (a as any).id || ''
    const idB = (b as any).id || ''
    return idA.localeCompare(idB)
  })
})

const INITIAL_BATCH_SIZE = 30
const BATCH_SIZE = 30
const visibleCount = ref(INITIAL_BATCH_SIZE)
const isLoadingMore = ref(false)
const topSentinelRef = ref<HTMLDivElement | null>(null)
let isInitialScrollSettled = false

const hasMore = computed(() => renderMessages.value.length > visibleCount.value)

const displayedMessages = computed<(ChatHistoryItem | DirectorNote)[]>(() => {
  if (!hasMore.value) {
    return renderMessages.value
  }
  return renderMessages.value.slice(-visibleCount.value)
})

const [chatHistoryRef, setAutoAnimateEnabled] = useAutoAnimate<HTMLDivElement>()
const isAtBottom = ref(true)

provide(chatScrollContainerKey, chatHistoryRef)

function checkScrollPosition() {
  if (!chatHistoryRef.value)
    return
  const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.value
  // Allowing a small threshold (10px) to consider 'at bottom'
  isAtBottom.value = scrollTop + clientHeight >= scrollHeight - 10
}

function scrollToBottom(force = false) {
  if (!chatHistoryRef.value)
    return
  if (force || isAtBottom.value) {
    chatHistoryRef.value.scrollTo({
      top: chatHistoryRef.value.scrollHeight,
      behavior: force ? 'auto' : 'smooth',
    })
  }
}

async function loadMore() {
  if (isLoadingMore.value || !hasMore.value)
    return

  const container = chatHistoryRef.value
  if (!container)
    return

  isLoadingMore.value = true
  setAutoAnimateEnabled(false)

  const oldScrollHeight = container.scrollHeight
  const oldScrollTop = container.scrollTop

  visibleCount.value = Math.min(renderMessages.value.length, visibleCount.value + BATCH_SIZE)

  await nextTick()

  const newScrollHeight = container.scrollHeight
  const delta = newScrollHeight - oldScrollHeight

  if (delta > 0) {
    // Compensate scroll position synchronously so user viewport doesn't shift by even 1px
    container.scrollTop = oldScrollTop + delta
  }

  requestAnimationFrame(() => {
    setAutoAnimateEnabled(true)
    setTimeout(() => {
      isLoadingMore.value = false
    }, 100)
  })
}

// Watch for manual scroll events to track bottom state and top edge ceiling expansion
function handleScroll() {
  checkScrollPosition()

  if (!chatHistoryRef.value)
    return

  if (isInitialScrollSettled && chatHistoryRef.value.scrollTop <= 100 && hasMore.value && !isLoadingMore.value) {
    void loadMore()
  }
}

let observer: ResizeObserver | null = null
let topObserver: IntersectionObserver | null = null

onUnmounted(() => {
  observer?.disconnect()
  topObserver?.disconnect()
})

// Use a ResizeObserver to catch changes even during v-auto-animate transitions
onMounted(async () => {
  if (!chatHistoryRef.value)
    return

  observer = new ResizeObserver(() => {
    if (isAtBottom.value) {
      scrollToBottom(true)
    }
  })

  // We observe the container itself; as it animates/resizes, we keep pinned
  observer.observe(chatHistoryRef.value)

  // Force scroll to bottom after initial mount DOM generation
  await nextTick()
  scrollToBottom(true)

  // Ensure scroll is correct even if dynamic styling or images cause height shifts
  setTimeout(() => scrollToBottom(true), 50)
  setTimeout(() => {
    scrollToBottom(true)
    isInitialScrollSettled = true
  }, 150)
})

watch([topSentinelRef, () => hasMore.value], ([sentinel, more]) => {
  topObserver?.disconnect()
  if (sentinel && more) {
    topObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && isInitialScrollSettled && !isLoadingMore.value && hasMore.value) {
          void loadMore()
        }
      }
    }, {
      root: chatHistoryRef.value,
      rootMargin: '120px 0px 0px 0px',
      threshold: 0.1,
    })
    topObserver.observe(sentinel)
  }
})

watch(activeSessionId, () => {
  visibleCount.value = INITIAL_BATCH_SIZE
  isInitialScrollSettled = false
  nextTick(() => {
    scrollToBottom(true)
    setTimeout(() => {
      scrollToBottom(true)
      isInitialScrollSettled = true
    }, 150)
  })
})

watch([() => props.messages, () => props.streamingMessage], () => scrollToBottom(), { deep: true, flush: 'post' })
watch(() => props.messages.length, (newLen, oldLen) => {
  if (oldLen === 0 && newLen > 0) {
    visibleCount.value = INITIAL_BATCH_SIZE
    nextTick(() => {
      scrollToBottom(true)
      setTimeout(() => scrollToBottom(true), 50)
      setTimeout(() => {
        scrollToBottom(true)
        isInitialScrollSettled = true
      }, 150)
    })
  }
  else if (oldLen != null && newLen > oldLen) {
    // A new message arrived at the bottom; grow visibleCount so loaded history isn't truncated
    visibleCount.value += (newLen - oldLen)
  }
  else if (oldLen != null && newLen < oldLen) {
    visibleCount.value = Math.max(INITIAL_BATCH_SIZE, Math.min(visibleCount.value, newLen))
  }
})
watch(() => props.sending, (val) => {
  if (!val) {
    // When sending finishes, ensure we are at the bottom
    scrollToBottom(true)
  }
}, { flush: 'post' })
</script>

<template>
  <div
    ref="chatHistoryRef"
    flex="~ col"
    relative h-full w-full
    class="gap-2 overflow-x-hidden overflow-y-auto rounded-xl px-2 py-2"
    :class="[variant === 'mobile' ? 'gap-1' : 'gap-2']"
    @scroll="handleScroll"
  >
    <!-- Top Sentinel / Ceiling Indicator -->
    <div
      v-if="hasMore"
      ref="topSentinelRef"
      class="w-full flex shrink-0 select-none items-center justify-center py-2 text-xs text-neutral-400 dark:text-neutral-500"
    >
      <span v-if="isLoadingMore" class="i-svg-spinners:ring-resize mr-1.5 shrink-0 text-xs text-primary-500" />
      <span>{{ isLoadingMore ? 'Loading earlier messages...' : 'Scroll up for earlier messages' }}</span>
    </div>
    <div
      v-else-if="renderMessages.length > INITIAL_BATCH_SIZE"
      class="w-full flex shrink-0 select-none items-center justify-center py-3 text-xs text-neutral-400 dark:text-neutral-500"
    >
      <span class="rounded-full bg-neutral-200/50 px-3 py-1 text-neutral-500 dark:bg-neutral-800/50 dark:text-neutral-400">
        Beginning of conversation
      </span>
    </div>

    <template v-for="(message, index) in displayedMessages" :key="'id' in message && message.id ? message.id : ('createdAt' in message && message.createdAt ? `ts-${message.createdAt}` : `idx-${index}`)">
      <div v-if="'type' in message && message.type === 'director-note'">
        <DirectorNoteBubble :note="message" />
      </div>

      <div v-else-if="'type' in message && (message as any).type === 'producer-suggestion'">
        <ProducerChoiceBubble
          :message="message as any"
          @choose="(choice, isPlaybackOnly) => emit('choose', choice, isPlaybackOnly)"
          @retry="emit('retry-producer')"
          @delete="emit('delete-producer')"
        />
      </div>

      <div v-else-if="'role' in message && message.role === 'error'" :id="message.id ? `msg-${message.id}` : undefined">
        <ChatErrorItem
          :message="message"
          :label="labels.error"
          :show-placeholder="sending && index === displayedMessages.length - 1"
          :variant="variant"
        />
      </div>

      <div v-else-if="'role' in message && message.role === 'assistant'" :id="message.id ? `msg-${message.id}` : undefined">
        <ChatAssistantItem
          :message="message as any"
          :label="labels.assistant"
          :show-placeholder="shouldShowPlaceholder(message as any) && showStreamingPlaceholder"
          :variant="variant"
        />
      </div>

      <div v-else-if="'role' in message && message.role === 'user'" :id="message.id ? `msg-${message.id}` : undefined">
        <ChatUserItem
          :message="message as any"
          :label="labels.user"
          :variant="variant"
        />
      </div>
    </template>
  </div>
</template>
