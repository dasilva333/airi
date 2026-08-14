<script setup lang="ts">
import { BasicTextarea } from '@proj-airi/ui'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot } from 'reka-ui'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useChatComposer } from '../../../composables/use-chat-composer'
import { useProducer } from '../../../composables/use-producer'
import { useChatOrchestratorStore } from '../../../stores/chat'
import { useChatSessionStore } from '../../../stores/chat/session-store'
import { useChatStreamStore } from '../../../stores/chat/stream-store'
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
  (e: 'getSuggestions', text: string): void
  (e: 'clearSuggestions'): void
  (e: 'voiceToggle', active: boolean): void
}>()

const { t } = useI18n()
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
const chatStream = useChatStreamStore()
const consciousnessStore = useConsciousnessStore()
const onboardingStore = useOnboardingStore()
const { generateSuggestions } = useProducer()

const { activeCard } = storeToRefs(cardStore)
const { activeProvider, activeModel } = storeToRefs(consciousnessStore)
const { sending } = storeToRefs(chatOrchestrator)
const { streamingMessage } = storeToRefs(chatStream)

const isStreaming = computed(() => !!streamingMessage.value && sending.value)

const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const isWandMenuOpen = ref(false)
const isConfigModalOpen = ref(false)
const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 4)

const producerSuggestions = ref<Array<{ title: string, message: string }>>([])
const isGeneratingSuggestions = ref(false)

function showConfigPrompt(reason: string) {
  console.error(`[WhisperComposerBar] ${reason}: No active AI provider or model configured.`)
  isConfigModalOpen.value = true
}

function handleOpenWizard() {
  isConfigModalOpen.value = false
  onboardingStore.resetSetupState()
  onboardingStore.forceShowSetup()
  if (router) {
    router.push('/settings/airi-card/guided').catch(() => {
      router?.push('/settings')
    })
  }
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

async function handleWandClick() {
  if (isGeneratingSuggestions.value)
    return

  if (producerSuggestions.value.length > 0) {
    producerSuggestions.value = []
    emit('clearSuggestions')
    return
  }

  if (!activeProvider.value || !activeModel.value) {
    showConfigPrompt('Error generating suggestions')
    return
  }

  isGeneratingSuggestions.value = true
  try {
    const characterNameVal = activeCard.value?.name || 'Companion'
    const messagesVal = chatSession.messages || []

    const choices = await generateSuggestions({
      characterName: characterNameVal,
      messages: messagesVal as any,
      guidance: messageInput.value.trim() || undefined,
      count: suggestionCount.value,
      shortReplies: false,
    })

    producerSuggestions.value = choices
    emit('getSuggestions', messageInput.value)
  }
  catch (err) {
    console.error('[WhisperComposerBar] Failed to generate suggestions:', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('No active AI provider') || msg.includes('未选择模型') || !activeModel.value) {
      showConfigPrompt('Error generating suggestions')
    }
    else {
      toast.error('Failed to generate suggestions')
    }
  }
  finally {
    isGeneratingSuggestions.value = false
  }
}

function handleWandContextMenu() {
  isWandMenuOpen.value = true
}

function setSuggestionCount(count: number) {
  suggestionCount.value = count
  isWandMenuOpen.value = false
}

function selectSuggestion(message: string) {
  messageInput.value = message
  producerSuggestions.value = []
  emit('clearSuggestions')
}

async function sendSuggestion(message: string) {
  if (!activeProvider.value || !activeModel.value) {
    showConfigPrompt('Error sending suggestion')
    return
  }

  messageInput.value = message
  producerSuggestions.value = []
  emit('clearSuggestions')
  await handleSend()
}

function clearSuggestions() {
  producerSuggestions.value = []
  emit('clearSuggestions')
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

  producerSuggestions.value = []
  emit('clearSuggestions')
  await handleSend()
}

defineExpose({
  messageInput,
  attachments,
  isListening,
  producerSuggestions,
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

    <!-- Producer Suggestions Pill Strip -->
    <Transition name="config-modal-fade">
      <div
        v-if="producerSuggestions.length > 0 || isGeneratingSuggestions"
        class="border border-neutral-200/80 rounded-2xl bg-white/95 p-2 shadow-xl backdrop-blur-2xl dark:border-neutral-800/80 dark:bg-neutral-900/95"
      >
        <div class="mb-1.5 flex items-center justify-between px-1">
          <div class="flex items-center gap-1.5 text-xs text-amber-500 font-bold">
            <div v-if="isGeneratingSuggestions" class="i-solar:magic-stick-3-bold-duotone size-4 animate-spin" />
            <div v-else class="i-solar:magic-stick-3-bold-duotone size-4" />
            <span>{{ isGeneratingSuggestions ? 'Writing Suggestions...' : 'Suggestions' }}</span>
          </div>
          <button
            type="button"
            class="size-5 flex cursor-pointer items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            @click="clearSuggestions"
          >
            <div class="i-solar:close-circle-bold size-3.5" />
          </button>
        </div>

        <div v-if="producerSuggestions.length > 0" class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <button
            v-for="(choice, idx) in producerSuggestions"
            :key="idx"
            type="button"
            class="flex cursor-pointer items-center justify-between gap-2 border border-neutral-200/70 rounded-xl bg-neutral-50/80 px-2.5 py-1.5 text-left transition dark:border-neutral-800/70 hover:border-amber-400/50 dark:bg-neutral-800/50 hover:bg-amber-500/5 dark:hover:bg-amber-500/10"
            @click="selectSuggestion(choice.message)"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate text-[11px] text-amber-600 font-bold dark:text-amber-400">
                {{ choice.title }}
              </div>
              <div class="line-clamp-1 text-xs text-neutral-700 dark:text-neutral-300">
                {{ choice.message }}
              </div>
            </div>
            <button
              type="button"
              class="size-6 flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition hover:bg-amber-500 dark:text-amber-400 hover:text-white"
              title="Send instantly"
              @click.stop="sendSuggestion(choice.message)"
            >
              <div class="i-solar:plain-bold size-3.5" />
            </button>
          </button>
        </div>
      </div>
    </Transition>

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

      <!-- [✨] Producer Magic Wand Popover -->
      <PopoverRoot v-if="showMagicWand" v-model:open="isWandMenuOpen">
        <PopoverAnchor as-child>
          <button
            type="button"
            :class="[
              'flex items-center justify-center size-9 rounded-full transition-all cursor-pointer shrink-0',
              'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300',
              isGeneratingSuggestions ? 'animate-pulse text-amber-500' : '',
            ]"
            title="Producer Suggestions (Right click / long press for options)"
            @click="handleWandClick"
            @contextmenu.prevent="handleWandContextMenu"
          >
            <div class="i-solar:magic-stick-3-bold-duotone size-4.5 text-amber-500" />
          </button>
        </PopoverAnchor>
        <PopoverPortal>
          <PopoverContent
            side="top"
            align="start"
            :side-offset="8"
            class="z-50 min-w-36 border border-neutral-200/80 rounded-2xl bg-white/95 p-2 font-sans shadow-xl backdrop-blur-xl dark:border-neutral-800/80 dark:bg-neutral-900/95"
          >
            <div class="px-2 py-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Suggestions Count
            </div>
            <div class="flex flex-col gap-0.5">
              <button
                v-for="count in [2, 3, 4, 5]"
                :key="count"
                :class="[
                  'flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer',
                  suggestionCount === count
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
                ]"
                @click="setSuggestionCount(count)"
              >
                <span>{{ count }} options</span>
                <div v-if="suggestionCount === count" class="i-solar:check-circle-bold size-3.5 text-amber-500" />
              </button>
            </div>
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

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
          (messageInput.trim() || attachments.length > 0)
            ? 'bg-primary-500 text-white shadow-md shadow-primary-500/30 hover:bg-primary-600 active:scale-95'
            : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-600 opacity-60 cursor-not-allowed',
        ]"
        title="Send Message"
        @click="onSubmit"
      >
        <div v-if="sending" class="i-solar:restart-square-bold size-4.5 animate-spin text-primary-500 dark:text-white" />
        <div v-else class="i-solar:plain-bold size-4.5" />
      </button>
    </div>

    <!-- Explicit Companion Configuration Prompt Modal -->
    <Teleport to="body">
      <div
        v-if="isConfigModalOpen"
        class="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        style="z-index: 999999;"
        @click.self="isConfigModalOpen = false"
      >
        <div class="max-w-md w-full border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl backdrop-blur-2xl dark:border-neutral-800/80 dark:bg-neutral-900">
          <div class="mb-4 flex items-center gap-3">
            <div class="size-12 flex items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/25">
              <div class="i-solar:magic-stick-3-bold-duotone size-6.5" />
            </div>
            <div>
              <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                Configure Your Companion
              </h3>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                Setup required for AI reasoning & suggestions
              </p>
            </div>
          </div>

          <p class="text-sm text-neutral-700 leading-relaxed dark:text-neutral-300">
            Please configure your stuff using the companion wizard to get started with the fun!
          </p>

          <div class="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              class="w-full flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3 text-sm text-white font-bold shadow-lg shadow-primary-500/25 transition active:scale-98 hover:bg-primary-600"
              @click="handleOpenWizard"
            >
              <div class="i-solar:magic-stick-3-bold-duotone size-4.5" />
              <span>Open Companion Wizard</span>
            </button>

            <button
              type="button"
              class="w-full cursor-pointer rounded-2xl bg-neutral-100 py-2.5 text-xs text-neutral-600 font-semibold transition active:scale-98 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @click="isConfigModalOpen = false"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
