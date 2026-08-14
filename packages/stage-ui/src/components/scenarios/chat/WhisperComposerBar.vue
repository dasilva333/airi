<script setup lang="ts">
import { BasicTextarea } from '@proj-airi/ui'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ProducerChoiceBubble from './ProducerChoiceBubble.vue'
import ProducerGuidanceModal from './ProducerGuidanceModal.vue'

import { useChatComposer } from '../../../composables/use-chat-composer'
import { useProducer } from '../../../composables/use-producer'
import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'
import { useOnboardingStore } from '../../../stores/onboarding'

const props = withDefaults(defineProps<{
  tools?: any[]
  placeholder?: string
  disabled?: boolean
  showAttachments?: boolean
  showMagicWand?: boolean
  showVoice?: boolean
  variant?: 'compact' | 'expanded' | 'sheet'
}>(), {
  showAttachments: true,
  showMagicWand: true,
  showVoice: true,
  variant: 'compact',
})

const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'voiceToggle', active: boolean): void
}>()

let router: ReturnType<typeof useRouter> | undefined
try {
  router = useRouter()
}
catch {
  // router might not be installed in all contexts
}

const cardStore = useAiriCardStore()
const chatSession = useChatSessionStore()
const chatOrchestrator = useChatOrchestratorStore()
const consciousnessStore = useConsciousnessStore()
const { sending } = storeToRefs(chatOrchestrator)
const onboardingStore = useOnboardingStore()
const { generateSuggestions } = useProducer()

const { activeCard } = storeToRefs(cardStore)
const { activeProvider, activeModel } = storeToRefs(consciousnessStore)

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const isConfigModalOpen = ref(false)
const isHFTokenModalOpen = ref(false)
const isProducerModalOpen = ref(false)

// Producer state — matches InteractiveArea pattern
const producerSuggestion = ref<{ choices: Array<{ title: string, message: string }>, loading?: boolean } | null>(null)
const lastProducerConfig = ref<{ guidance: string, contextDepth: number, count: number, shortReplies: boolean } | null>(null)
const quickSuggestContextDepth = useLocalStorage('airi:producer:context-depth', 6)
const quickSuggestCount = useLocalStorage('airi:producer:suggestion-count', 2)
const quickSuggestShortReplies = useLocalStorage('airi:producer:short-replies', true)

function showConfigPrompt(reason: string) {
  console.error(`[WhisperComposerBar] ${reason}: No active AI provider or model configured.`)
  isConfigModalOpen.value = true
}

function handleOpenWizard() {
  isConfigModalOpen.value = false
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
}

function handleOpenUserProfile() {
  isProducerModalOpen.value = false
  if (router) {
    router.push('/settings/system/user-profile').catch(() => {
      router?.push('/settings')
    })
  }
}

function openHFTokenPage() {
  isHFTokenModalOpen.value = false
  window.open('https://huggingface.co/settings/tokens', '_blank')
}

const {
  messageInput,
  attachments,
  isComposing,
  isListening,
  handleFileSelect,
  removeAttachment,
  handleSend,
  startListening,
  stopListening,
} = useChatComposer({
  tools: props.tools,
  onSendStart: () => {
    emit('send', messageInput.value)
  },
  onSendError: (err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WhisperComposerBar] Send error occurred:', err)
    if (message.includes('No active AI provider') || message.includes('未选择模型') || !activeModel.value) {
      showConfigPrompt('Error sending message')
    }
    else {
      toast.error(message)
    }
  },
})

function triggerFileInput() {
  fileInputRef.value?.click()
}

// --- Producer / Wand Logic (matches InteractiveArea chatbox pattern) ---

function handleWandClick() {
  // If suggestions are currently showing, dismiss them
  if (producerSuggestion.value) {
    producerSuggestion.value = null
    return
  }

  // Guard: need a configured provider
  if (!activeProvider.value || !activeModel.value) {
    showConfigPrompt('No AI provider configured')
    return
  }

  const input = messageInput.value.trim()
  if (input) {
    // Non-empty input → quick-suggest with input as guidance
    messageInput.value = ''
    handleProducerSubmit({
      guidance: input,
      contextDepth: quickSuggestContextDepth.value,
      count: quickSuggestCount.value,
      shortReplies: quickSuggestShortReplies.value,
    })
  }
  else {
    // Empty input → open the full ProducerGuidanceModal
    isProducerModalOpen.value = true
  }
}

async function handleProducerSubmit(payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }) {
  lastProducerConfig.value = payload
  producerSuggestion.value = {
    choices: [],
    loading: true,
  }

  try {
    const characterNameVal = activeCard.value?.name || 'Companion'
    const messagesVal = chatSession.messages || []

    const choices = await generateSuggestions({
      characterName: characterNameVal,
      messages: messagesVal as any,
      guidance: payload.guidance || undefined,
      contextDepth: payload.contextDepth,
      count: payload.count,
      shortReplies: payload.shortReplies,
    })

    producerSuggestion.value = {
      choices,
      loading: false,
    }
  }
  catch (err) {
    console.error('[WhisperComposerBar] Failed to generate suggestions:', err)
    producerSuggestion.value = null
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('No active AI provider') || msg.includes('未选择模型') || !activeModel.value) {
      showConfigPrompt('Error generating suggestions')
    }
    else {
      toast.error('Failed to generate suggestions. Please check your provider settings.')
    }
  }
}

async function handleRetryProducer() {
  if (!lastProducerConfig.value) {
    isProducerModalOpen.value = true
    return
  }
  await handleProducerSubmit(lastProducerConfig.value)
}

function handleDeleteProducer() {
  producerSuggestion.value = null
}

function handleChooseOption(choice: { title: string, message: string }, isPlaybackOnly = false) {
  messageInput.value = choice.message

  // Auto-send if configured (ONLY if NOT playback only)
  if (!isPlaybackOnly) {
    const autoSend = localStorage.getItem('airi:producer:auto-send') === 'true'
    if (autoSend) {
      producerSuggestion.value = null
      handleSend()
    }
  }
}

async function handleVoiceClick() {
  if (isListening.value) {
    await stopListening()
    emit('voiceToggle', false)
  }
  else {
    await startListening()
    emit('voiceToggle', true)
  }
}

async function onSubmit() {
  if (props.disabled || sending.value)
    return

  const text = messageInput.value.trim()
  if (!text && attachments.value.length === 0)
    return

  if (!activeProvider.value || !activeModel.value) {
    showConfigPrompt('Error sending message')
    return
  }

  producerSuggestion.value = null
  await handleSend()
}

defineExpose({
  messageInput,
  attachments,
  isListening,
  producerSuggestion,
  send: onSubmit,
})
</script>

<template>
  <div class="relative w-full flex flex-col select-none gap-2">
    <!-- Attachment Previews -->
    <div
      v-if="showAttachments && attachments.length > 0"
      class="flex flex-wrap gap-2 px-1 pb-1"
    >
      <div
        v-for="(attachment, index) in attachments"
        :key="index"
        class="group relative h-14 w-14 overflow-hidden border border-neutral-200/80 rounded-xl bg-neutral-100 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-800"
      >
        <img :src="attachment.url" class="h-full w-full object-cover">
        <button
          type="button"
          class="absolute right-1 top-1 h-5 w-5 flex cursor-pointer items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100"
          @click="removeAttachment(index)"
        >
          <div class="i-solar:close-circle-bold size-3.5" />
        </button>
      </div>
    </div>

    <!-- Producer Suggestions (ProducerChoiceBubble — DRY with desktop chatbox) -->
    <ProducerChoiceBubble
      v-if="producerSuggestion"
      :message="producerSuggestion"
      @choose="handleChooseOption"
      @retry="handleRetryProducer"
      @delete="handleDeleteProducer"
    />

    <!-- Main Composer Input Pill -->
    <div
      :class="[
        'relative flex items-center gap-1.5 p-1.5 rounded-full transition-all duration-200',
        'bg-white/95 dark:bg-neutral-900/90 backdrop-blur-xl',
        'border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg shadow-black/5',
        isListening ? 'ring-2 ring-rose-500/50 border-rose-500/60' : '',
      ]"
    >
      <!-- Hidden File Picker Input -->
      <input
        ref="fileInputRef"
        type="file"
        class="hidden"
        accept="image/*"
        @change="handleFileSelect"
      >

      <!-- [+] Attachment Button -->
      <button
        v-if="showAttachments"
        type="button"
        :class="[
          'relative flex items-center justify-center size-9 rounded-full transition-all cursor-pointer shrink-0',
          'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300',
          attachments.length > 0 ? 'text-primary-500 bg-primary-50 dark:bg-primary-950/40' : '',
        ]"
        title="Attach Image"
        @click="triggerFileInput"
      >
        <div class="i-solar:gallery-add-bold size-4.5" />
        <span
          v-if="attachments.length > 0"
          class="absolute h-3.5 w-3.5 flex items-center justify-center rounded-full bg-primary-500 text-[9px] text-white font-bold -right-0.5 -top-0.5"
        >
          {{ attachments.length }}
        </span>
      </button>

      <!-- [✨] Producer Magic Wand Button -->
      <button
        v-if="showMagicWand"
        type="button"
        :class="[
          'flex items-center justify-center size-9 rounded-full transition-all cursor-pointer shrink-0',
          'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300',
          producerSuggestion?.loading ? 'animate-pulse text-amber-500' : '',
        ]"
        title="Producer Suggestions (empty input opens config, with text generates quick suggestions)"
        @click.stop="handleWandClick"
      >
        <div class="i-solar:magic-stick-3-bold-duotone size-4.5 text-amber-500" />
      </button>

      <!-- [Textarea] Auto-Expanding Input -->
      <div class="min-w-0 flex-1 px-1">
        <BasicTextarea
          v-model="messageInput"
          :placeholder="placeholder || (activeCard?.name ? `Message ${activeCard.name}...` : 'Say something...')"
          class="max-h-[8lh] min-h-[calc(1lh+4px)] w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1 text-sm text-neutral-800 outline-none scrollbar-none dark:text-neutral-100 placeholder:text-neutral-400 placeholder:dark:text-neutral-500"
          default-height="1lh"
          @submit="onSubmit"
          @compositionstart="isComposing = true"
          @compositionend="isComposing = false"
        />
      </div>

      <!-- [🎤] Voice / STT Mic Button -->
      <button
        v-if="showVoice"
        type="button"
        :class="[
          'flex items-center justify-center size-9 rounded-full transition-all cursor-pointer shrink-0',
          isListening
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
            : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300',
        ]"
        :title="isListening ? 'Stop Listening' : 'Voice Input'"
        @click="handleVoiceClick"
      >
        <div :class="[isListening ? 'i-solar:microphone-3-bold size-4.5' : 'i-solar:microphone-linear size-4.5']" />
      </button>

      <!-- [✈] Send Button -->
      <button
        type="button"
        :disabled="disabled || (!messageInput.trim() && attachments.length === 0 && !sending)"
        :class="[
          'flex items-center justify-center size-9 rounded-full transition-all cursor-pointer shrink-0',
          sending
            ? 'bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600'
            : messageInput.trim() || attachments.length > 0
              ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30 hover:bg-primary-600'
              : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed',
        ]"
        :title="sending ? 'Stop Generating' : 'Send'"
        @click="onSubmit"
      >
        <div :class="[sending ? 'i-solar:stop-bold size-4' : 'i-solar:plain-bold size-4.5']" />
      </button>
    </div>

    <!-- Explicit Companion Configuration Prompt Modal -->
    <Teleport to="body">
      <div
        v-if="isConfigModalOpen"
        class="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        style="z-index: 999999;"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isConfigModalOpen = false"
      >
        <div
          class="max-w-md w-full border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <div class="mb-4 flex items-center gap-3">
            <div class="size-12 flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/25">
              <div class="i-solar:magic-stick-3-bold-duotone size-6.5" />
            </div>
            <div>
              <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                Configure Your Companion
              </h3>
              <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                Set up an AI provider to start chatting
              </p>
            </div>
          </div>

          <p class="mb-5 text-sm text-neutral-600 leading-relaxed dark:text-neutral-300">
            To send messages and get AI-powered suggestions, you need to configure an AI provider (like OpenAI, Google, or a local model).
          </p>

          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="w-full cursor-pointer rounded-2xl bg-primary-500 py-2.5 text-xs text-white font-semibold shadow-md shadow-primary-500/25 transition active:scale-95 hover:bg-primary-600"
              @pointerdown.stop
              @click.stop="handleOpenWizard"
            >
              Open Setup Wizard
            </button>
            <button
              type="button"
              class="w-full cursor-pointer rounded-2xl bg-neutral-100 py-2.5 text-xs text-neutral-600 font-semibold transition active:scale-98 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @pointerdown.stop
              @click.stop="isConfigModalOpen = false"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- HuggingFace Token Required Modal -->
    <Teleport to="body">
      <div
        v-if="isHFTokenModalOpen"
        class="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        style="z-index: 999999;"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isHFTokenModalOpen = false"
      >
        <div
          class="max-w-sm w-full border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <div class="mb-4 flex items-center gap-3">
            <div class="size-12 flex shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/25">
              <div class="i-solar:key-bold-duotone size-6.5" />
            </div>
            <div>
              <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                HuggingFace Token Required
              </h3>
              <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                This voice is behind a gated model
              </p>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="button"
              class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-amber-500 py-2.5 text-xs text-white font-semibold shadow-amber-500/25 shadow-md transition active:scale-95 hover:bg-amber-600"
              @pointerdown.stop
              @click.stop="openHFTokenPage"
            >
              <div class="i-solar:key-bold-duotone size-3.5" />
              Get HF Token
            </button>
            <button
              type="button"
              class="flex-1 cursor-pointer rounded-2xl bg-neutral-100 py-2.5 text-xs text-neutral-600 font-semibold transition active:scale-98 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @pointerdown.stop
              @click.stop="isHFTokenModalOpen = false"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Producer Guidance Modal (DRY — same component as desktop chatbox) -->
    <ProducerGuidanceModal
      v-model="isProducerModalOpen"
      :character-name="activeCard?.name || 'Companion'"
      @submit="handleProducerSubmit"
      @open-user-profile="handleOpenUserProfile"
    />
  </div>
</template>

<style scoped>
.scrollbar-thin {
  scrollbar-width: thin;
}
</style>
