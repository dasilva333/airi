<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, ChatWorkspaceTerminalPanel, ChatWorkspaceWidgetsPanel } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useDeferredMount } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import ChatArea from '../Widgets/ChatArea.vue'
import ChatContainer from '../Widgets/ChatContainer.vue'

export type InteractiveSurfaceTab = 'chat' | 'terminal' | 'widgets'

const props = defineProps<{
  tools?: any[]
}>()

const activeTab = ref<InteractiveSurfaceTab>('chat')
const { isReady } = useDeferredMount()
const { sending } = storeToRefs(useChatOrchestratorStore())
const { messages } = storeToRefs(useChatSessionStore())
const { streamingMessage } = storeToRefs(useChatStreamStore())

const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)

const hasVirtualTerminal = computed(() => {
  const allowed = activeCard.value?.extensions?.airi?.generation?.known?.allowedTools
  if (allowed && (allowed.includes('bash') || allowed.includes('mcp_bash')))
    return true
  return activeCard.value?.extensions?.airi?.sandbox?.enabled ?? false
})

watch(hasVirtualTerminal, (enabled) => {
  if (!enabled && activeTab.value !== 'chat') {
    activeTab.value = 'chat'
  }
})

const isLoading = ref(true)
const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])
</script>

<template>
  <div flex="col" items-center pt-4>
    <div h-full max-h="[85vh]" w-full py="4">
      <ChatContainer>
        <div
          v-if="isLoading"
          absolute left-0 top-0 h-1 w-full overflow-hidden rounded-t-xl
          class="bg-primary-500/20"
        >
          <div h-full w="1/3" origin-left bg-primary-500 class="animate-scan" />
        </div>

        <!-- Top Surface Switcher Tabs -->
        <div
          v-if="hasVirtualTerminal"
          :class="[
            'relative z-10 flex shrink-0 items-center justify-between',
            'border-b border-primary-500/10 dark:border-white/5',
            'px-3 py-2',
          ]"
        >
          <div
            :class="[
              'flex items-center gap-1 p-0.5 rounded-xl',
              'bg-black/5 dark:bg-white/5 backdrop-blur-md',
            ]"
          >
            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all select-none',
                activeTab === 'chat'
                  ? 'bg-white/90 dark:bg-neutral-800/90 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="activeTab = 'chat'"
            >
              <div class="i-solar:chat-round-dots-bold-duotone size-3.5" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all select-none',
                activeTab === 'terminal'
                  ? 'bg-white/90 dark:bg-neutral-800/90 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="activeTab = 'terminal'"
            >
              <div class="i-solar:code-square-bold-duotone size-3.5" />
              <span>Terminal</span>
            </button>
            <button
              type="button"
              :class="[
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all select-none',
                activeTab === 'widgets'
                  ? 'bg-white/90 dark:bg-neutral-800/90 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="activeTab = 'widgets'"
            >
              <div class="i-solar:widget-2-bold-duotone size-3.5" />
              <span>Widgets</span>
            </button>
          </div>
        </div>

        <!-- Surface 1: Chat Transcript & Composer -->
        <template v-if="activeTab === 'chat' || !hasVirtualTerminal">
          <div w="full" max-h="<md:[60%]" py="<sm:2" flex="~ col" rounded="lg" px="2 <md:0" relative h-full min-h-0 flex-1 overflow-hidden py-4>
            <ChatHistory
              v-if="isReady"
              :messages="historyMessages"
              :sending="sending"
              :streaming-message="streamingMessage"
              h-full
              variant="desktop"
              @vue:mounted="isLoading = false"
            />
          </div>
          <ChatArea :tools="props.tools" />
        </template>

        <!-- Surface 2: Terminal View -->
        <div
          v-else-if="activeTab === 'terminal'"
          :class="[
            'min-h-0 flex-1 flex flex-col overflow-hidden',
            'w-full h-full',
          ]"
        >
          <ChatWorkspaceTerminalPanel fill-container class="h-full w-full" />
        </div>

        <!-- Surface 3: Widgets View -->
        <div
          v-else-if="activeTab === 'widgets'"
          :class="[
            'min-h-0 flex-1 flex flex-col overflow-hidden',
            'w-full h-full',
          ]"
        >
          <ChatWorkspaceWidgetsPanel fill-container class="h-full w-full" />
        </div>
      </ChatContainer>
    </div>
  </div>
</template>

<style scoped>
@keyframes scan {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}

.animate-scan {
  animation: scan 2s infinite linear;
}
</style>
