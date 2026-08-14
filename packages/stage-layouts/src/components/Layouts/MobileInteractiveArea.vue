<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory } from '@proj-airi/stage-ui/components'
import { useChatComposer } from '@proj-airi/stage-ui/composables'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatMaintenanceStore } from '@proj-airi/stage-ui/stores/chat/maintenance'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { BasicTextarea } from '@proj-airi/ui'
import { useResizeObserver, useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { BackgroundDialogPicker } from '../Backgrounds'

const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const { cleanupMessages } = useChatMaintenanceStore()
const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)
const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

const { stageViewControlsEnabled, themeColorsHueDynamic } = storeToRefs(useSettings())

const backgroundDialogOpen = ref(false)

const screenSafeArea = useScreenSafeArea()
const { t } = useI18n()

// Initialize shared useChatComposer composable
const {
  messageInput,
  attachments,
  isComposing,
  trashConfirmOpen,
  handleFileSelect,
  removeAttachment,
  handleSaveAndClear,
  handleClearAnyway,
  handleSend,
} = useChatComposer({
  onSendError: (err) => {
    toast.error(err instanceof Error ? err.message : String(err))
  },
})

useResizeObserver(document.documentElement, () => screenSafeArea.update())

async function handleSubmit() {
  await handleSend()
}

onMounted(() => {
  screenSafeArea.update()
})
</script>

<template>
  <div class="fixed bottom-0 w-full flex flex-col">
    <BackgroundDialogPicker v-model="backgroundDialogOpen" />
    <KeepAlive>
      <Transition name="fade">
        <ChatHistory
          v-if="!stageViewControlsEnabled"
          variant="mobile"
          :messages="historyMessages"
          :sending="sending"
          :streaming-message="streamingMessage"
          class="chat-history relative z-20 max-w-[calc(100%-3.5rem)] w-full self-start pb-3 pl-3"
        />
      </Transition>
    </KeepAlive>
    <div class="relative w-full self-end">
      <div class="max-h-100dvh max-w-100dvw w-full flex flex-col gap-1 border-t border-neutral-200/30 bg-white/80 px-3 pt-2 backdrop-blur-xl dark:border-neutral-800/30 dark:bg-neutral-900/80" :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 12)}px` }">
        <!-- Attachments Preview for Portrait -->
        <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 border-b border-neutral-100/40 p-2 dark:border-neutral-700/40">
          <div v-for="(attachment, index) in attachments" :key="index" class="relative">
            <img :src="attachment.url" class="h-16 w-16 rounded-md object-cover">
            <button class="absolute h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] text-white -right-1 -top-1" @click="removeAttachment(index)">
              &times;
            </button>
          </div>
        </div>

        <div class="w-full flex gap-1">
          <input ref="fileInput" type="file" class="hidden" accept="image/*" @change="handleFileSelect">
          <BasicTextarea
            v-model="messageInput"
            :placeholder="t('stage.message')"
            class="max-h-[10lh] min-h-[calc(1lh+4px+4px)] w-full resize-none overflow-y-scroll border-2 border-neutral-200/60 rounded-[1lh] border-solid bg-neutral-100/80 px-4 py-0.5 text-neutral-500 outline-none backdrop-blur-md transition-all duration-250 ease-in-out scrollbar-none dark:border-neutral-700/60 dark:bg-neutral-950/80 dark:text-neutral-100 hover:text-neutral-600 placeholder:text-neutral-900/60 placeholder:transition-all placeholder:duration-250 placeholder:ease-in-out dark:hover:text-neutral-200 placeholder:dark:text-white/60 placeholder:hover:text-neutral-500 placeholder:dark:hover:text-neutral-400"
            :class="[themeColorsHueDynamic ? 'transition-none placeholder:transition-none' : '']"
            default-height="1lh"
            @submit="handleSubmit"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
          />
          <button
            v-if="messageInput.trim() || isComposing || attachments.length > 0 || sending"
            :disabled="sending"
            class="aspect-square h-[calc(1lh+4px+4px)] w-[calc(1lh+4px+4px)] flex items-center self-end justify-center rounded-full bg-primary-50/80 text-neutral-500 outline-none backdrop-blur-md transition-all duration-250 ease-in-out dark:bg-neutral-100/80 hover:bg-neutral-50 dark:text-neutral-900 hover:text-neutral-600 disabled:opacity-60 dark:hover:bg-neutral-800"
            @click="handleSend"
          >
            <div v-if="sending" class="i-solar:restart-square-bold size-4 animate-spin text-primary-500" />
            <div v-else class="i-solar:arrow-up-outline" />
          </button>
        </div>
      </div>
    </div>

    <!-- Clear Messages Safety Validation Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="trashConfirmOpen"
          class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          @click.self="trashConfirmOpen = false"
        >
          <div class="max-w-md w-full border border-neutral-200/60 rounded-2xl bg-white/90 p-6 font-sans shadow-2xl backdrop-blur-xl dark:border-neutral-800/60 dark:bg-neutral-900/90">
            <h3 class="text-xl text-neutral-900 font-bold dark:text-white">
              Clear conversation?
            </h3>
            <p class="mt-2 text-neutral-600 dark:text-neutral-400">
              You haven't summarized today's chat into memory yet. Clearing now will lose this context for future sessions.
            </p>
            <div class="mt-6 flex flex-col gap-2">
              <button
                class="w-full rounded-xl bg-primary-500 py-3 text-sm text-white font-bold transition active:scale-95 hover:bg-primary-600"
                @click="handleSaveAndClear(cleanupMessages)"
              >
                Save to Memory & Clear
              </button>
              <button
                class="w-full rounded-xl bg-neutral-100 py-3 text-sm text-neutral-700 font-bold transition active:scale-95 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                @click="handleClearAnyway(cleanupMessages)"
              >
                Clear Anyway
              </button>
              <button
                class="mt-2 w-full text-sm text-neutral-400 font-medium hover:text-neutral-600 dark:hover:text-neutral-200"
                @click="trashConfirmOpen = false"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-history {
  --gradient: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 20%);
  -webkit-mask-image: var(--gradient);
  mask-image: var(--gradient);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: bottom;
  mask-position: bottom;
  max-height: 35dvh;
}
</style>
