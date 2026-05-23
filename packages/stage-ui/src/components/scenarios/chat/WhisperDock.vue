<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useChatOrchestratorStore } from '../../../stores/chat'
import { useAiriCardStore } from '../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../stores/modules/consciousness'

const props = defineProps<{
  /** Tool definitions to pass through to chat.ingest */
  tools?: any[]
  open?: boolean
}>()

const emit = defineEmits<{
  (e: 'spawn-standalone', id: string): void
  (e: 'update:open', val: boolean): void
}>()

const isOpen = ref(props.open ?? false)
const inputText = ref('')
const inputRef = ref<HTMLInputElement>()
const isSending = ref(false)

const cardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const chatStore = useChatOrchestratorStore()

const { activeCard } = storeToRefs(cardStore)
const { activeProvider, activeModel } = storeToRefs(consciousnessStore)

const characterName = computed(() => activeCard.value?.name ?? 'AIRI')

defineExpose({ isOpen })

watch(() => props.open, (val) => {
  if (val !== undefined && val !== isOpen.value) {
    isOpen.value = val
  }
})

// Auto-focus input when dock opens
watch(isOpen, async (open) => {
  emit('update:open', open)
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})

function toggleDock() {
  isOpen.value = !isOpen.value
  if (!isOpen.value) {
    inputText.value = ''
    isSending.value = false
  }
}

function dismiss() {
  isOpen.value = false
  inputText.value = ''
  isSending.value = false
}

async function send() {
  const text = inputText.value.trim()
  if (!text || isSending.value)
    return

  console.info('[WhisperDock] Triggered send() with text:', text)

  isSending.value = true

  try {
    if (!activeModel.value) {
      console.warn('[WhisperDock] No model configured')
      isSending.value = false
      return
    }

    // Clear input optimistically for snappy feel
    inputText.value = ''

    await chatStore.ingest(text, {
      model: activeModel.value,
      chatProvider: activeProvider.value,
      tools: props.tools,
    })

    // Auto-close after successful send
    dismiss()
  }
  catch (err) {
    console.error('[WhisperDock] Failed to send:', err)
    isSending.value = false
    // Restore text draft so it is not lost
    inputText.value = text
    toast.error('Message failed to send. Draft restored.')
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
  else if (e.key === 'Escape') {
    e.preventDefault()
    dismiss()
  }
}
</script>

<template>
  <!-- Trigger Button -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 translate-y-4 scale-90"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-4 scale-90"
  >
    <button
      v-if="!isOpen"
      :class="[
        'fixed bottom-2.5 left-1/2 z-90',
        '-translate-x-1/2',
        'border-2 border-solid border-neutral-200/60 dark:border-neutral-800/10',
        'bg-neutral-50/80 dark:bg-neutral-800/70',
        'w-fit flex items-center justify-center p-2 rounded-xl backdrop-blur-md',
        'cursor-pointer shadow-lg shadow-black/5 dark:shadow-black/20',
        'transition-all hover:transition-none duration-300 ease-out',
        'active:scale-95',
        'group',
      ]"
      @click="toggleDock"
    >
      <div
        :class="[
          'i-ph:keyboard-light',
          'size-5',
          'text-neutral-800 dark:text-neutral-300',
          'transition-colors duration-200',
          'group-hover:text-primary-500 dark:group-hover:text-primary-400',
        ]"
      />
    </button>
  </Transition>

  <!-- Input Dock -->
  <Transition
    enter-active-class="transition-all duration-400 cubic-bezier(0.32, 0.72, 0, 1)"
    enter-from-class="opacity-0 translate-y-6"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-250 cubic-bezier(0.32, 0.72, 0, 1)"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 translate-y-6"
  >
    <div
      v-if="isOpen"
      :class="[
        'fixed bottom-0 left-0 z-90',
        'w-full',
        'flex items-center gap-3',
        'rounded-t-2xl',
        'bg-white/70 dark:bg-neutral-900/75',
        'backdrop-blur-2xl',
        'border-t border-neutral-200/30 dark:border-neutral-800/20',
        'shadow-2xl shadow-black/10 dark:shadow-black/30',
        'px-6 py-4 pb-5',
        isSending ? 'whisper-dock-sending' : '',
      ]"
    >
      <!-- Sticker Toggle (Hidden for future customizable panel integration) -->
      <!-- <button
        :class="[
          'size-7 rounded-lg flex items-center justify-center',
          'transition-all duration-200',
          showStickers ? 'bg-primary-500/20 text-primary-500' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
        ]"
        @click="showStickers = !showStickers"
      >
        <div class="i-ph:stamp-bold size-4" />
      </button> -->

      <!-- Sticker Library Popover (Hidden for future customizable panel integration) -->
      <!-- <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-2 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-2 scale-95"
      >
        <div
          v-if="showStickers"
          :class="[
            'absolute bottom-[110%] left-0',
            'w-full max-w-[320px]',
            'bg-white/90 dark:bg-neutral-900/90 backdrop-blur-2xl',
            'border border-neutral-200/50 dark:border-neutral-700/50',
            'shadow-2xl rounded-2xl overflow-hidden',
            'z-100',
          ]"
        >
          <StickerManager @spawn-standalone="id => emit('spawn-standalone', id)" />
        </div>
      </Transition> -->

      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        :placeholder="`Message to ${characterName}...`"
        :disabled="isSending"
        :class="[
          'flex-1',
          'bg-transparent',
          'text-sm text-neutral-800 dark:text-neutral-200',
          'placeholder:text-neutral-400/70 dark:placeholder:text-neutral-500/70',
          'outline-none border-none',
          'transition-opacity duration-200',
          isSending ? 'opacity-40' : 'opacity-100',
        ]"
        @keydown="handleKeydown"
      >

      <!-- Subtle sending indicator -->
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-200"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isSending"
          :class="[
            'size-4 rounded-full',
            'border-2 border-primary-400/60 border-t-transparent',
            'animate-spin',
          ]"
        />
      </Transition>

      <!-- Exit/Close Button -->
      <button
        :class="[
          'size-7 rounded-lg flex items-center justify-center',
          'text-neutral-400 hover:bg-red-500/10 hover:text-red-500',
          'transition-all duration-200',
          'cursor-pointer',
        ]"
        title="Close input (Esc)"
        @click="dismiss"
      >
        <div class="i-ph:x-bold size-4" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/* Subtle glow pulse while sending */
.whisper-dock-sending {
  animation: whisper-glow 1.5s ease-in-out infinite;
}

@keyframes whisper-glow {
  0%, 100% {
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.1),
      0 0 0 0 rgba(139, 92, 246, 0);
  }
  50% {
    box-shadow:
      0 25px 50px -12px rgba(0, 0, 0, 0.1),
      0 0 20px 2px rgba(139, 92, 246, 0.15);
  }
}
</style>
