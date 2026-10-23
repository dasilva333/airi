<script setup lang="ts">
import type { ChatHistoryItem } from '@proj-airi/stage-ui/types/chat'

import { ChatHistory, WhisperComposerBar } from '@proj-airi/stage-ui/components'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { useChatSessionStore } from '@proj-airi/stage-ui/stores/chat/session-store'
import { useChatStreamStore } from '@proj-airi/stage-ui/stores/chat/stream-store'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { useLocalStorage, useScreenSafeArea } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRouter } from 'vue-router'

export type MobilePosture = 'voice' | 'composer' | 'preview' | 'history'
export type PresentationMode = 'translucent' | 'frosted'

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

// Dual Presentation Modes:
// - 'translucent': Floating HUD overlay with soft top gradient dissolve (Anime VN style)
// - 'frosted': High-contrast frosted glass bottom sheet (Classic mobile card style)
const presentationMode = useLocalStorage<PresentationMode>('airi:mobile-chat-presentation-mode', 'translucent')

function togglePresentationMode() {
  presentationMode.value = presentationMode.value === 'translucent' ? 'frosted' : 'translucent'
}

const composerRef = useTemplateRef<InstanceType<typeof WhisperComposerBar>>('composerRef')
const screenSafeArea = useScreenSafeArea()

const chatOrchestrator = useChatOrchestratorStore()
const chatSession = useChatSessionStore()
const chatStream = useChatStreamStore()
const consciousnessStore = useConsciousnessStore()
const onboardingStore = useOnboardingStore()

let router: ReturnType<typeof useRouter> | undefined
try {
  router = useRouter()
}
catch {
  router = undefined
}

onMounted(async () => {
  await chatSession.ensureActiveSessionForCharacter()
})

const { messages } = storeToRefs(chatSession)
const { streamingMessage } = storeToRefs(chatStream)
const { sending } = storeToRefs(chatOrchestrator)

const airiCardStore = useAiriCardStore()
const { activeCard } = storeToRefs(airiCardStore)

const isGroundingActive = computed(() => {
  const ext = activeCard.value?.extensions?.airi
  return Boolean(ext?.groundingEnabled || ext?.groundingMemoryEnabled || (ext?.groundingTopicsEnabled && ext?.recentTopics?.length) || ext?.groundingDirectorScratchpadEnabled)
})

const groundingActiveLabel = computed(() => {
  const ext = activeCard.value?.extensions?.airi
  const parts: string[] = []
  if (ext?.groundingMemoryEnabled)
    parts.push('Universe RAG')
  if (ext?.groundingEnabled)
    parts.push('Sensors')
  if (ext?.groundingTopicsEnabled && ext?.recentTopics?.length)
    parts.push('Topics')
  if (ext?.groundingDirectorScratchpadEnabled)
    parts.push('Visual Scene')
  return parts.join(' • ') || 'Active'
})

const historyMessages = computed(() => messages.value as unknown as ChatHistoryItem[])

const { configured: isChatConfigured } = storeToRefs(consciousnessStore)
const isProviderMissing = computed(() => !isChatConfigured.value)

function openProviderSettings() {
  router?.push('/settings/providers/chat').catch(() => {})
}

function openFreeAi() {
  router?.push({ path: '/settings', query: { freeAi: 'open' } }).catch(() => {})
}

function openSetupWizard() {
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
}

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
      'fixed inset-x-0 bottom-0 z-30 flex flex-col justify-end transition-all duration-300 ease-out select-none',
      currentPosture === 'history' && presentationMode === 'frosted' ? 'top-14 bg-black/20 backdrop-blur-[2px]' : 'pointer-events-none',
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

    <!-- POSTURE 2, 3 & 4: Dual-Mode Sheet Container -->
    <div
      v-else
      :class="[
        'w-full flex flex-col transition-all duration-300 ease-out',
        presentationMode === 'frosted'
          ? 'pointer-events-auto border-t border-neutral-200/80 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-900/90 backdrop-blur-2xl shadow-2xl shadow-black/10'
          : 'bg-transparent border-transparent shadow-none backdrop-blur-none pointer-events-none',
        currentPosture === 'history'
          ? (presentationMode === 'frosted' ? 'rounded-t-3xl h-[85dvh]' : 'h-[85dvh]')
          : currentPosture === 'preview'
            ? (presentationMode === 'frosted' ? 'rounded-t-2xl max-h-[50dvh]' : 'max-h-[50dvh]')
            : 'rounded-t-2xl',
      ]"
      :style="{ paddingBottom: `${Math.max(Number.parseFloat(screenSafeArea.bottom.value.replace('px', '')), 12)}px` }"
      @pointerdown="handlePointerDown"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerCancel"
    >
      <!-- Grab Handle Bar with Quick Controls -->
      <div
        :class="[
          'w-full flex items-center justify-between px-3 py-1.5',
          presentationMode === 'translucent' ? 'pointer-events-auto' : '',
        ]"
      >
        <!-- Left Action: Collapse (when in preview or history) -->
        <div class="flex items-center gap-1">
          <button
            v-if="currentPosture === 'preview' || currentPosture === 'history'"
            type="button"
            class="size-7 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100/80 hover:text-neutral-700 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-200"
            title="Collapse to Composer"
            @click.stop="setPosture('composer')"
          >
            <div class="i-solar:alt-arrow-down-linear size-3.5" />
          </button>
          <div v-else class="size-7" />
        </div>

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

        <!-- Right Actions: Presentation Mode Toggle + Expand -->
        <div class="flex items-center gap-1">
          <!-- Presentation Mode Toggle (Translucent HUD vs. Frosted Sheet) -->
          <button
            type="button"
            :class="[
              'size-7 flex cursor-pointer items-center justify-center rounded-full transition',
              presentationMode === 'translucent'
                ? 'text-primary-500 bg-primary-500/10 hover:bg-primary-500/20'
                : 'text-neutral-400 hover:bg-neutral-100/80 hover:text-neutral-700 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-200',
            ]"
            :title="presentationMode === 'translucent' ? 'Switch to Frosted Sheet' : 'Switch to Floating HUD'"
            @click.stop="togglePresentationMode"
          >
            <div
              :class="[
                presentationMode === 'translucent' ? 'i-solar:ghost-linear' : 'i-solar:card-2-linear',
                'size-3.5',
              ]"
            />
          </button>

          <!-- Expand Posture Button -->
          <button
            v-if="currentPosture === 'composer' || currentPosture === 'preview'"
            type="button"
            class="size-7 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100/80 hover:text-neutral-700 dark:hover:bg-neutral-800/80 dark:hover:text-neutral-200"
            :title="currentPosture === 'composer' ? 'Show Chat Preview' : 'Open Full History'"
            @click.stop="stepPosture('up')"
          >
            <div class="i-solar:alt-arrow-up-linear size-3.5" />
          </button>
          <div v-else class="size-7" />
        </div>
      </div>

      <!-- POSTURE 4: Expanded History Archive Header (Frosted Mode Only) -->
      <div
        v-if="currentPosture === 'history' && presentationMode === 'frosted'"
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
          class="cursor-pointer rounded-full bg-neutral-100/90 px-3 py-1 text-xs text-neutral-700 font-semibold shadow-sm backdrop-blur-md transition dark:bg-neutral-800/90 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="setPosture('preview')"
        >
          Done
        </button>
      </div>

      <!-- POSTURE 3 & 4: Chat History (Active in Preview and History postures) -->
      <div
        v-if="currentPosture === 'history' || currentPosture === 'preview'"
        :class="[
          'min-h-0 flex flex-1 flex-col overflow-hidden px-3 pb-1 pointer-events-auto',
          currentPosture === 'history' ? 'pt-2' : 'max-h-[38dvh]',
          presentationMode === 'translucent' ? 'chat-history-masked' : '',
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

      <!-- Ephemeral Grounding Indicator Bar (Active when Grounding / Universe RAG is toggled ON) -->
      <div
        v-if="isGroundingActive"
        class="shadow-xs pointer-events-auto mx-3 mb-1 flex items-center justify-between border border-amber-300 rounded-lg bg-amber-50/80 px-2.5 py-1 text-[10px] text-amber-900 font-mono backdrop-blur-md dark:border-amber-500/25 dark:bg-black/40 dark:text-amber-300"
      >
        <div class="flex items-center gap-1.5 truncate">
          <span class="i-solar:cpu-bolt-bold-duotone shrink-0 animate-pulse text-amber-500" />
          <span class="text-[9px] font-bold tracking-wider uppercase">Grounding Active:</span>
          <span class="truncate opacity-90">{{ groundingActiveLabel }}</span>
        </div>
      </div>

      <!-- Provider Not Configured Nudge (floating over portrait composer) -->
      <div
        v-if="isProviderMissing"
        class="pointer-events-auto mx-3 mb-2 overflow-hidden border border-amber-200/30 rounded-2xl from-amber-950/90 via-[#2a1a0e]/90 to-neutral-950/90 bg-gradient-to-br shadow-black/20 shadow-xl backdrop-blur-xl dark:border-amber-500/25"
      >
        <div class="flex items-start gap-2.5 p-3">
          <div class="size-7 flex shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
            <div class="i-solar:cpu-bolt-bold-duotone size-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] text-amber-100 font-bold leading-tight">
              Not ready yet
            </div>
            <div class="mt-0.5 text-[11px] text-amber-100/70 leading-snug">
              Choose and validate a chat provider before sending a message.
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                class="cursor-pointer rounded-full bg-cyan-500 px-3 py-1.5 text-[11px] text-white font-bold shadow-md transition active:scale-95 hover:bg-cyan-400"
                @click="openProviderSettings"
              >
                Open provider settings
              </button>
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 border border-amber-200/30 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-amber-100 font-bold transition active:scale-95 hover:bg-white/20"
                @click="openFreeAi"
              >
                <div class="i-solar:magic-stick-3-bold-duotone size-3.5" />
                <span>Try Free AI</span>
              </button>
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 border border-amber-200/30 rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-amber-100 font-bold transition active:scale-95 hover:bg-white/20"
                @click="openSetupWizard"
              >
                <div class="i-solar:stars-line-bold-duotone size-3.5" />
                <span>Setup Wizard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Whisper Composer Bar (Active in Postures 2, 3 & 4) -->
      <div class="pointer-events-auto w-full px-3 pt-1">
        <WhisperComposerBar
          ref="composerRef"
          :tools="props.tools"
          @voice-toggle="handleVoiceToggle"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-history-masked {
  --gradient: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 18%);
  -webkit-mask-image: var(--gradient);
  mask-image: var(--gradient);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: bottom;
  mask-position: bottom;
}
</style>
