<script setup lang="ts">
import type { ErrorMessage } from '../../../types/chat'

import { computed } from 'vue'
import { toast } from 'vue-sonner'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { MarkdownRenderer } from '../../markdown'

const props = withDefaults(defineProps<{
  message: ErrorMessage & { id?: string }
  label: string
  showPlaceholder?: boolean
  variant?: 'desktop' | 'mobile'
}>(), {
  showPlaceholder: false,
  variant: 'desktop',
})

const emit = defineEmits<{
  (e: 'retry'): void
}>()

const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()

const boxClasses = computed(() => [
  props.variant === 'mobile' ? 'px-2 py-2 text-sm' : 'px-3 py-3',
])

const canRetry = computed(() => {
  if (!props.message.id || props.showPlaceholder)
    return false
  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return false
  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index <= 0)
    return false
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === 'user')
      return true
  }
  return false
})

async function handleRetry() {
  emit('retry')
  if (!props.message.id)
    return

  const activeSessionId = chatSession.activeSessionId
  if (!activeSessionId)
    return

  const messages = chatSession.getSessionMessages(activeSessionId)
  const index = messages.findIndex(m => m.id === props.message.id)
  if (index === -1)
    return

  // Find the nearest user message before this error
  let userIndex = -1
  for (let i = index - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userIndex = i
      break
    }
  }

  if (userIndex !== -1) {
    // Keep up to the user message, removing the error (and anything in-between)
    const nextMessages = messages.slice(0, userIndex + 1)
    await chatSession.setSessionMessages(activeSessionId, nextMessages)

    try {
      await chatOrchestrator.ingest('', { triggerOnly: true })
      toast.success('Retrying message...')
    }
    catch (err) {
      console.error('[Retry] Failed:', err)
      toast.error('Failed to retry message.')
    }
  }
  else {
    toast.error('Cannot retry: No user message found before this error.')
  }
}

function deleteSelf() {
  if (props.message.id)
    chatSession.deleteMessage(props.message.id)
}
</script>

<template>
  <div
    :class="[
      'w-fit max-w-[min(28rem,calc(100vw-2rem))] flex items-end gap-1.5',
      variant === 'mobile' ? 'mr-0' : 'mr-12',
      'group',
    ]"
  >
    <div
      :class="[
        'flex flex-col shadow-sm shadow-violet-200/50 dark:shadow-none',
        'h-unset <sm:fit',
        'relative min-w-20 rounded-xl',
        'bg-violet-100/80 dark:bg-violet-950/80',
        ...boxClasses,
      ]"
    >
      <div :class="['flex flex-row items-center gap-2']">
        <div :class="['flex-1 inline <sm:hidden']">
          <span :class="['text-sm text-black/60 dark:text-white/65 font-normal']">{{ label }}</span>
        </div>
        <div :class="['i-solar:danger-triangle-bold-duotone text-violet-500']" />
      </div>
      <div v-if="showPlaceholder" :class="['i-eos-icons:three-dots-loading']" />
      <MarkdownRenderer
        v-else
        :content="message.content"
        class="break-words text-violet-500 dark:text-violet-300"
      />

      <button
        v-if="message.id"
        :class="[
          'absolute z-10 p-1 text-black/30 opacity-0 transition-opacity -right-1 -top-1 dark:text-white/30 group-hover:opacity-100 hover:text-red-500!',
        ]"
        title="Delete error message"
        @click="deleteSelf"
      >
        <div :class="['i-ph:trash-duotone']" />
      </button>
    </div>

    <!-- PR #3504: Inline retry button placed beside the error item -->
    <div
      v-if="canRetry"
      :class="['shrink-0 mb-0.5']"
    >
      <button
        type="button"
        :class="[
          'flex items-center justify-center',
          'h-7 w-7 rounded-lg',
          'text-neutral-500 dark:text-neutral-400',
          'bg-neutral-100/80 dark:bg-neutral-800/80',
          'hover:bg-neutral-200 dark:hover:bg-neutral-700',
          'hover:text-primary-600 dark:hover:text-primary-400',
          'border border-neutral-200/50 dark:border-neutral-700/50',
          'transition-colors duration-150',
        ]"
        title="Retry message"
        @click="handleRetry"
      >
        <div :class="['i-solar:refresh-bold text-sm']" />
      </button>
    </div>
  </div>
</template>
