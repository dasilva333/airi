<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, WhisperComposerBar } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

export type MobilePosture = 'voice' | 'composer' | 'preview' | 'history'

const props = defineProps<{
  tools?: any[]
}>()

const emit = defineEmits<{
  (e: 'postureChange', posture: MobilePosture): void
  (e: 'settingsOpen', open: boolean): void
}>()

// 4 Mobile Postures:
// 1. 'voice' - minimal voice recording capsule
// 2. 'composer' - simplistic composer only (no history shown)
// 3. 'preview' - preview last message history view (floating bubble stream above composer)
// 4. 'history' - full history list view (expanded 85dvh transcript sheet)
const currentPosture = ref<MobilePosture>('preview')
const previousPosture = ref<MobilePosture>('preview')

const composerRef = useTemplateRef<InstanceType<typeof WhisperComposerBar>>('composerRef')
const screenSafeArea = useScreenSafeArea()

const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()

onMounted(async () => {
  await chatSession.ensureActiveSessionForCharacter()
})

const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

function setPosture(posture: MobilePosture) {
  if (currentPosture.value !== posture) {
    if (currentPosture.value !== 'voice') {
      previousPosture.value = currentPosture.value
    }
    currentPosture.value = posture
    emit('postureChange', posture)
  }
}

function stepPosture(direction: 'up' | 'down') {
  if (direction === 'up') {
    if (currentPosture.value === 'composer')
      setPosture('preview')
    else if (currentPosture.value === 'preview')
      setPosture('history')
  }
  else {
    if (currentPosture.value === 'history')
      setPosture('preview')
    else if (currentPosture.value === 'preview')
      setPosture('composer')
  }
}

function handleGrabHandleClick() {
  if (currentPosture.value === 'composer') {
    setPosture('preview')
  }
  else if (currentPosture.value === 'preview') {
    setPosture('history')
  }
  else if (currentPosture.value === 'history') {
    setPosture('preview')
  }
}

function handleVoiceToggle(active: boolean) {
  if (active) {
    setPosture('voice')
  }
  else if (currentPosture.value === 'voice') {
    setPosture(previousPosture.value || 'preview')
  }
}

// Automatically promote to preview posture when sending or streaming starts
watch(() => sending.value, (isSending) => {
  if (isSending && currentPosture.value === 'composer') {
    setPosture('preview')
  }
})

// Pointer & Touch gesture tracking for sheet expansion and collapsing (supports mouse drag + touch swipe)
let pointerStartY = 0
let isDragging = false

function handlePointerDown(e: PointerEvent) {
  pointerStartY = e.clientY
  isDragging = true
}

function handlePointerUp(e: PointerEvent) {
  if (!isDragging)
    return
  isDragging = false
  const deltaY = e.clientY - pointerStartY
  // Dragged up -> Step up posture
  if (deltaY < -25) {
    stepPosture('up')
  }
  // Dragged down -> Step down posture
  else if (deltaY > 25) {
    stepPosture('down')
  }
}

function handlePointerCancel() {
  isDragging = false
}

defineExpose({
  composerRef,
  setPosture,
})
</script>

<template>
  <div
    :class="[
      'fixed inset-x-0 bottom-0 z-40 flex flex-col justify-end transition-all duration-300 ease-out select-none',
      currentPosture === 'history' ? 'top-14 bg-black/20 backdrop-blur-[2px]' : 'pointer-events-none',
    ]"
    @click.self="setPosture('preview')"
  >
    <!-- POSTURE 1: Immersive Voice Mode Capsule -->
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
        @click="setPosture(previousPosture || 'preview')"
      >
        <div class="i-solar:close-circle-bold size-4" />
      </button>
    </div>

    <!-- POSTURE 2, 3 & 4: Sheet Container -->
    <div
      v-else
      :class="[
        'pointer-events-auto w-full flex flex-col transition-all duration-300 ease-out',
        'border-t border-neutral-200/80 dark:border-neutral-800/80',
        'bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl shadow-2xl shadow-black/10',
        currentPosture === 'history' ? 'rounded-t-3xl h-[85dvh]' : currentPosture === 'preview' ? 'rounded-t-2xl max-h-[50dvh]' : 'rounded-t-2xl',
      ]"
      :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 12)}px` }"
      @pointerdown="handlePointerDown"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
    >
      <!-- Grab Handle Bar with Quick Controls -->
      <div
        class="w-full flex items-center justify-between px-3 py-1.5"
      >
        <!-- Left Action: Collapse (when in preview or history) -->
        <button
          v-if="currentPosture === 'preview' || currentPosture === 'history'"
          type="button"
          class="size-6 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          title="Collapse to Composer"
          @click.stop="setPosture('composer')"
        >
          <div class="i-solar:alt-arrow-down-linear size-3.5" />
        </button>
        <div v-else class="size-6" />

        <!-- Center Grab Handle Pill -->
        <div
          class="flex cursor-pointer items-center justify-center px-4 py-1 transition-opacity hover:opacity-75"
          @click.stop="handleGrabHandleClick"
        >
          <div
            :class="[
              'h-1 rounded-full transition-all duration-200',
              currentPosture === 'history' ? 'w-12 bg-primary-500' : currentPosture === 'preview' ? 'w-10 bg-primary-400' : 'w-8 bg-neutral-300 dark:bg-neutral-700',
            ]"
          />
        </div>

        <!-- Right Action: Expand (when in composer or preview) -->
        <button
          v-if="currentPosture === 'composer' || currentPosture === 'preview'"
          type="button"
          class="size-6 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          :title="currentPosture === 'composer' ? 'Show Chat Preview' : 'Open Full History'"
          @click.stop="stepPosture('up')"
        >
          <div class="i-solar:alt-arrow-up-linear size-3.5" />
        </button>
        <div v-else class="size-6" />
      </div>

      <!-- POSTURE 4: Expanded History Archive Header -->
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
          @click="setPosture('preview')"
        >
          Done
        </button>
      </div>

      <!-- POSTURE 3 & 4: Chat History (Active in Preview and History postures) -->
      <div
        v-if="currentPosture === 'history' || currentPosture === 'preview'"
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

      <!-- Whisper Composer Bar (Active in Postures 2, 3 & 4) -->
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
