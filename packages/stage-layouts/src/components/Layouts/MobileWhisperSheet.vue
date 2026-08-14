<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, WhisperComposerBar } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, useTemplateRef } from 'vue'

const props = defineProps<{
  tools?: any[]
}>()

const emit = defineEmits<{
  (e: 'postureChange', posture: 'conversation' | 'voice' | 'history'): void
  (e: 'settingsOpen', open: boolean): void
}>()

// Mobile Postures: 'conversation' (compact dock), 'voice' (minimal voice notch), 'history' (expanded transcript sheet)
const currentPosture = ref<'conversation' | 'voice' | 'history'>('conversation')

const composerRef = useTemplateRef<InstanceType<typeof WhisperComposerBar>>('composerRef')
const screenSafeArea = useScreenSafeArea()

const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()

const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

function setPosture(posture: 'conversation' | 'voice' | 'history') {
  currentPosture.value = posture
  emit('postureChange', posture)
}

function toggleHistory() {
  if (currentPosture.value === 'history') {
    setPosture('conversation')
  }
  else {
    setPosture('history')
  }
}

function handleVoiceToggle(active: boolean) {
  if (active) {
    setPosture('voice')
  }
  else if (currentPosture.value === 'voice') {
    setPosture('conversation')
  }
}

// Touch gesture tracking for sheet expansion
let touchStartY = 0
function handleTouchStart(e: TouchEvent) {
  if (e.touches && e.touches[0]) {
    touchStartY = e.touches[0].clientY
  }
}

function handleTouchEnd(e: TouchEvent) {
  if (e.changedTouches && e.changedTouches[0]) {
    const deltaY = e.changedTouches[0].clientY - touchStartY
    // Swiped up -> Expand to History
    if (deltaY < -40 && currentPosture.value === 'conversation') {
      setPosture('history')
    }
    // Swiped down -> Collapse to Conversation
    else if (deltaY > 40 && currentPosture.value === 'history') {
      setPosture('conversation')
    }
  }
}

defineExpose({
  composerRef,
})
</script>

<template>
  <div
    :class="[
      'fixed inset-x-0 bottom-0 z-40 flex flex-col justify-end transition-all duration-300 ease-out select-none',
      currentPosture === 'history' ? 'top-14 bg-black/20 backdrop-blur-[2px]' : 'pointer-events-none',
    ]"
    @click.self="setPosture('conversation')"
  >
    <!-- POSTURE 2: Immersive Voice Mode Capsule -->
    <div
      v-if="currentPosture === 'voice'"
      class="pointer-events-auto mx-auto mb-6 flex items-center gap-3 border border-rose-500/30 rounded-full bg-white/95 px-5 py-2.5 shadow-2xl backdrop-blur-xl dark:border-rose-500/20 dark:bg-neutral-900/95"
      :style="{ marginBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 16)}px` }"
    >
      <div class="size-3 animate-ping rounded-full bg-rose-500 shadow-md shadow-rose-500/50" />
      <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Listening to your voice...</span>
      <button
        type="button"
        class="size-7 flex cursor-pointer items-center justify-center rounded-full bg-rose-500/10 text-rose-500 transition hover:bg-rose-500/20"
        @click="setPosture('conversation')"
      >
        <div class="i-solar:close-circle-bold size-4" />
      </button>
    </div>

    <!-- POSTURE 1 & 3: Sheet Container -->
    <div
      v-else
      :class="[
        'pointer-events-auto w-full flex flex-col transition-all duration-300 ease-out',
        'border-t border-neutral-200/80 dark:border-neutral-800/80',
        'bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl shadow-2xl shadow-black/10',
        currentPosture === 'history' ? 'rounded-t-3xl h-[85dvh]' : 'rounded-t-2xl max-h-[50dvh]',
      ]"
      :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 12)}px` }"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd"
    >
      <!-- Grab Handle Bar -->
      <div
        class="w-full flex cursor-pointer items-center justify-center py-2 transition-opacity hover:opacity-75"
        @click="toggleHistory"
      >
        <div
          :class="[
            'h-1 rounded-full transition-all duration-200',
            currentPosture === 'history' ? 'w-12 bg-primary-500' : 'w-9 bg-neutral-300 dark:bg-neutral-700',
          ]"
        />
      </div>

      <!-- Expanded History Archive Header (Posture 3) -->
      <div
        v-if="currentPosture === 'history'"
        class="flex items-center justify-between border-b border-neutral-200/60 px-4 pb-2 pt-0.5 dark:border-neutral-800/60"
      >
        <div class="flex items-center gap-2">
          <div class="i-solar:chat-round-line-linear size-4 text-primary-500" />
          <span class="text-[11px] text-neutral-500 font-bold tracking-wider font-sans uppercase dark:text-neutral-400">
            Conversation History
          </span>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 font-semibold transition dark:bg-neutral-800 hover:bg-neutral-200/80 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="setPosture('conversation')"
        >
          Done
        </button>
      </div>

      <!-- Chat History (Active in Posture 1 and Posture 3) -->
      <div
        v-if="currentPosture === 'history' || historyMessages.length > 0 || sending || streamingMessage?.content"
        :class="[
          'min-h-0 flex flex-1 flex-col overflow-hidden px-3 pb-1',
          currentPosture === 'history' ? 'pt-2' : 'max-h-[38dvh]',
        ]"
      >
        <ChatHistory
          variant="mobile"
          :messages="historyMessages"
          :sending="sending"
          :streaming-message="streamingMessage"
          class="min-h-0 flex-1 overflow-y-auto"
        />
      </div>

      <!-- Whisper Composer Bar (Active in Posture 1 & Posture 3) -->
      <div class="w-full px-3 pt-1">
        <WhisperComposerBar
          ref="composerRef"
          :tools="props.tools"
          @voice-toggle="handleVoiceToggle"
        />
      </div>
    </div>
  </div>
</template>
