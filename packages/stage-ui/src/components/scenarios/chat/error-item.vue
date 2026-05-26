<script setup lang="ts">
import { computed } from 'vue'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import type { ErrorMessage } from '../../../types/chat'
import { MarkdownRenderer } from '../../markdown'

const props = withDefaults(
  defineProps<{
    message: ErrorMessage & { id?: string }
    label: string
    showPlaceholder?: boolean
    variant?: 'desktop' | 'mobile'
  }>(),
  {
    showPlaceholder: false,
    variant: 'desktop',
  },
)

const chatSession = useChatSessionStore()

const boxClasses = computed(() => [props.variant === 'mobile' ? 'px-2 py-2 text-sm' : 'px-3 py-3'])

function deleteSelf() {
  if (props.message.id) chatSession.deleteMessage(props.message.id)
}
</script>

<template>
  <div flex :class="variant === 'mobile' ? 'mr-0' : 'mr-12'" class="group">
    <div
      flex="~ col" shadow="sm violet-200/50 dark:none"
      h="unset <sm:fit"
      relative min-w-20 rounded-xl
      class="bg-violet-100/80 dark:bg-violet-950/80"
      :class="boxClasses"
    >
      <div flex="~ row" gap-2>
        <div flex-1 class="inline <sm:hidden">
          <span text-sm text="black/60 dark:white/65" font-normal>{{ label }}</span>
        </div>
        <div i-solar:danger-triangle-bold-duotone text-violet-500 />
      </div>
      <div v-if="showPlaceholder" i-eos-icons:three-dots-loading />
      <MarkdownRenderer
        v-else
        :content="message.content"
        class="break-words text-violet-500 dark:text-violet-300"
      />

      <button
        v-if="message.id"
        class="absolute z-10 p-1 text-black/30 opacity-0 transition-opacity -right-1 -top-1 dark:text-white/30 group-hover:opacity-100 hover:text-red-500!"
        @click="deleteSelf"
      >
        <div i-ph:trash-duotone />
      </button>
    </div>
  </div>
</template>
