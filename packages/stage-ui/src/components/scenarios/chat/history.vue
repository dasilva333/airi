<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useAutonomousArtistryStore } from '../../../stores/modules/artistry-autonomous'
import { useSettingsChat } from '../../../stores/settings'
import type { ChatAssistantMessage, ChatHistoryItem, ContextMessage } from '../../../types/chat'
import type { DirectorNote } from '../../../types/director'
import ChatAssistantItem from './assistant-item.vue'
import { chatScrollContainerKey } from './constants'
import DirectorNoteBubble from './DirectorNoteBubble.vue'
import ChatErrorItem from './error-item.vue'
import ChatUserItem from './user-item.vue'

const props = withDefaults(
  defineProps<{
    messages: ChatHistoryItem[]
    streamingMessage?: ChatAssistantMessage & { createdAt?: number }
    sending?: boolean
    assistantLabel?: string
    userLabel?: string
    errorLabel?: string
    variant?: 'desktop' | 'mobile'
  }>(),
  {
    sending: false,
    variant: 'desktop',
  },
)

const chatHistoryRef = ref<HTMLDivElement>()
const isAtBottom = ref(true)

provide(chatScrollContainerKey, chatHistoryRef)

const { t } = useI18n()

function checkScrollPosition() {
  if (!chatHistoryRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.value
  // Allowing a small threshold (10px) to consider 'at bottom'
  isAtBottom.value = scrollTop + clientHeight >= scrollHeight - 10
}

function scrollToBottom(force = false) {
  if (!chatHistoryRef.value) return
  if (force || isAtBottom.value) {
    chatHistoryRef.value.scrollTo({
      behavior: force ? 'auto' : 'smooth',
      top: chatHistoryRef.value.scrollHeight,
    })
  }
}

// Watch for manual scroll events to track bottom state
function handleScroll() {
  checkScrollPosition()
}

// Use a ResizeObserver to catch changes even during v-auto-animate transitions
onMounted(() => {
  if (!chatHistoryRef.value) return

  const observer = new ResizeObserver(() => {
    if (isAtBottom.value) {
      scrollToBottom(true)
    }
  })

  // We observe the container itself; as it animates/resizes, we keep pinned
  observer.observe(chatHistoryRef.value)
  // Also observe children if they are the ones causing scrollHeight changes
  // But usually observing the div with overflow-y-auto is sufficient for ResizeObserver
  // because its scrollHeight changes trigger the callback if we track content.

  scrollToBottom(true)

  onUnmounted(() => observer.disconnect())
})

watch([() => props.messages, () => props.streamingMessage], () => scrollToBottom(), { deep: true, flush: 'post' })
watch(
  () => props.sending,
  (val) => {
    if (!val) {
      // When sending finishes, ensure we are at the bottom
      scrollToBottom(true)
    }
  },
  { flush: 'post' },
)

const chatSettings = useSettingsChat()
const artistryStore = useAutonomousArtistryStore()
const cardStore = useAiriCardStore()

const labels = computed(() => ({
  assistant:
    props.assistantLabel ??
    cardStore.activeCard?.nickname ??
    cardStore.activeCard?.name ??
    t('stage.chat.message.character-name.airi'),
  error: props.errorLabel ?? t('stage.chat.message.character-name.core-system'),
  user: props.userLabel ?? t('stage.chat.message.character-name.you'),
}))

const streaming = computed<ChatAssistantMessage & { context?: ContextMessage } & { createdAt?: number }>(
  () =>
    props.streamingMessage ?? { content: '', createdAt: Date.now(), role: 'assistant', slices: [], tool_results: [] },
)
const showStreamingPlaceholder = computed(() => (streaming.value.slices?.length ?? 0) === 0 && !streaming.value.content)
const streamingTs = computed(() => streaming.value?.createdAt)
function shouldShowPlaceholder(message: ChatHistoryItem) {
  const ts = streamingTs.value
  if (ts == null) return false

  return message.context?.createdAt === ts || message.createdAt === ts
}
const renderMessages = computed<(ChatHistoryItem | DirectorNote)[]>(() => {
  const monitorEnabled = (cardStore.activeCard?.extensions?.airi?.artistry as any)?.autonomousMonitorEnabled ?? true
  const directorNotes =
    monitorEnabled && chatSettings.showDirectorNotes
      ? (artistryStore.directorNotes || []).filter((n) => !n.isArchived)
      : []

  let baseMessages: (ChatHistoryItem | DirectorNote)[] = props.messages

  const streamTs = streamingTs.value
  if (props.sending && streamTs) {
    const hasStreamAlready = props.messages.some((msg) => msg?.role === 'assistant' && msg?.createdAt === streamTs)
    if (!hasStreamAlready) {
      baseMessages = [...props.messages, streaming.value]
    }
  }

  // Merge and sort
  const merged = [...baseMessages, ...directorNotes]
  return merged.sort((a, b) => {
    const timeA = a.createdAt || 0
    const timeB = b.createdAt || 0
    if (timeA !== timeB) return timeA - timeB

    // Stability fallback: prioritize user over assistant if timestamps are identical
    const roleA = 'role' in a ? a.role : undefined
    const roleB = 'role' in b ? b.role : undefined
    if (roleA !== roleB) {
      if (roleA === 'user') return -1
      if (roleB === 'user') return 1
    }

    const idA = (a as any).id || ''
    const idB = (b as any).id || ''
    return idA.localeCompare(idB)
  })
})
</script>

<template>
  <div
    ref="chatHistoryRef"
    v-auto-animate
    flex="~ col"
    relative h-full w-full
    class="gap-2 overflow-x-hidden overflow-y-auto rounded-xl px-2 py-2"
    :class="[variant === 'mobile' ? 'gap-1' : 'gap-2']"
    @scroll="handleScroll"
  >
    <template v-for="(message, index) in renderMessages" :key="'id' in message && message.id ? message.id : ('createdAt' in message && message.createdAt ? `ts-${message.createdAt}` : `idx-${index}`)">
      <div v-if="'type' in message && message.type === 'director-note'">
        <DirectorNoteBubble :note="message" />
      </div>

      <div v-else-if="'role' in message && message.role === 'error'">
        <ChatErrorItem
          :message="message"
          :label="labels.error"
          :show-placeholder="sending && index === renderMessages.length - 1"
          :variant="variant"
        />
      </div>

      <div v-else-if="'role' in message && message.role === 'assistant'">
        <ChatAssistantItem
          :message="message as any"
          :label="labels.assistant"
          :show-placeholder="shouldShowPlaceholder(message as any) && showStreamingPlaceholder"
          :variant="variant"
        />
      </div>

      <div v-else-if="'role' in message && message.role === 'user'">
        <ChatUserItem
          :message="message as any"
          :label="labels.user"
          :variant="variant"
        />
      </div>
    </template>
  </div>
</template>
