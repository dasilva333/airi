<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, ChatSessionModal, ChatWorkspaceTerminalPanel, ChatWorkspaceWidgetsPanel } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useDeferredMount } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import ChatArea from '../Widgets/ChatArea.vue'
import ChatContainer from '../Widgets/ChatContainer.vue'
import ChatWorkspacePopover from './ChatWorkspacePopover.vue'

export type InteractiveSurfaceTab = 'chat' | 'terminal' | 'widgets'

const props = defineProps<{
  tools?: any[]
}>()

const activeTab = ref<InteractiveSurfaceTab>('chat')
const { isReady } = useDeferredMount()
const { sending } = storeToRefs(useChatOrchestratorStore())
const chatSessionStore = useChatSessionStore()
const { messages, activeSessionId, sessionMetas } = storeToRefs(chatSessionStore)
const { streamingMessage } = storeToRefs(useChatStreamStore())

// --- Unified chat workspace popover (timeline + card + avatar, shared with desktop) ---
const isSessionPopoverOpen = ref(false)
const showManageModal = ref(false)

let router: ReturnType<typeof useRouter> | undefined
try {
  router = useRouter()
}
catch {
  // router might not be installed in all contexts
}

const cardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(cardStore)

const activeTimelineLabel = computed(() => {
  const meta = activeSessionId.value ? sessionMetas.value[activeSessionId.value] : undefined
  if (meta?.title && meta.title !== 'Untitled Timeline')
    return meta.title
  if (activeSessionId.value)
    return chatSessionStore.getSessionDisplayTitle(activeSessionId.value, activeCardId.value)
  return 'Timeline 1'
})

function closePopoverThen(fn: () => void) {
  isSessionPopoverOpen.value = false
  fn()
}

function handleOpenManageSessions() {
  closePopoverThen(() => {
    showManageModal.value = true
  })
}

function handleOpenCardSettings() {
  const targetId = activeCardId.value || cardStore.resolveCardId()
  closePopoverThen(() => {
    router?.push(`/settings/airi-card/edit?id=${targetId}`).catch(() => {})
  })
}

function handleBrowseCards() {
  closePopoverThen(() => {
    router?.push('/settings/airi-card').catch(() => {})
  })
}

function handleCreateCard() {
  closePopoverThen(() => {
    router?.push('/settings/airi-card').catch(() => {})
  })
}

function handleManageAvatars() {
  closePopoverThen(() => {
    router?.push('/settings/models').catch(() => {})
  })
}

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

        <!-- Top header: timeline picker + surface switcher -->
        <div
          :class="[
            'relative z-10 flex shrink-0 items-center justify-between gap-2',
            'border-b border-primary-500/10 dark:border-white/5',
            'px-3 py-2',
          ]"
        >
          <ChatWorkspacePopover
            v-model:open="isSessionPopoverOpen"
            :character-id="activeCardId"
            @open-card-settings="handleOpenCardSettings"
            @open-manage-sessions="handleOpenManageSessions"
            @browse-cards="handleBrowseCards"
            @create-card="handleCreateCard"
            @manage-avatars="handleManageAvatars"
          >
            <template #trigger>
              <button
                type="button"
                :class="[
                  'flex min-w-0 cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-1 text-xs font-bold transition-all duration-200 ease-in-out',
                  'border-neutral-200/50 bg-neutral-100/30 dark:border-neutral-800 dark:bg-neutral-900/40',
                  'hover:bg-neutral-200/50 hover:dark:bg-neutral-800/40',
                ]"
              >
                <div class="i-solar:notebook-bookmark-bold-duotone size-3.5 shrink-0 text-primary-500" />
                <span class="max-w-36 truncate text-neutral-700 dark:text-neutral-300">{{ activeTimelineLabel }}</span>
                <div class="i-solar:alt-arrow-down-bold shrink-0 text-[10px] text-neutral-400 opacity-60 dark:text-neutral-500" />
              </button>
            </template>
          </ChatWorkspacePopover>

          <div
            v-if="hasVirtualTerminal"
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

        <ChatSessionModal v-model="showManageModal" />
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
