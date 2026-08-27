<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'

import WhisperComposerBar from './WhisperComposerBar.vue'

const props = defineProps<{
  /** Tool definitions to pass through to chat.ingest */
  tools?: any[]
  open?: boolean
  /** Cursor is within 5–7px above the bottom notch (State 3 of the 4-state lifecycle) */
  proximity?: boolean
}>()

const emit = defineEmits<{
  (e: 'spawn-standalone', id: string): void
  (e: 'update:open', val: boolean): void
  (e: 'get-suggestions', input: string): void
  (e: 'clear-suggestions'): void
}>()

const isOpen = ref(props.open ?? false)
const composerRef = useTemplateRef<InstanceType<typeof WhisperComposerBar>>('composerRef')

watch(() => props.open, (val) => {
  if (val !== undefined && val !== isOpen.value) {
    isOpen.value = val
  }
})

watch(isOpen, (open) => {
  emit('update:open', open)
})

function toggleDock() {
  isOpen.value = !isOpen.value
}

function dismiss() {
  isOpen.value = false
  emit('clear-suggestions')
}

function onSendSuccess() {
  dismiss()
}

function handleGetSuggestions(input: string) {
  emit('get-suggestions', input)
}

function handleClearSuggestions() {
  emit('clear-suggestions')
}

defineExpose({
  isOpen,
  dismiss,
  send: () => composerRef.value?.send(),
  inputText: computed({
    get: () => composerRef.value?.messageInput ?? '',
    set: (val: string) => {
      if (composerRef.value)
        composerRef.value.messageInput = val
    },
  }),
})
</script>

<template>
  <!-- Trigger Notch Handle -->
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
        'fixed left-1/2 z-90 -translate-x-1/2',
        'w-12 rounded-t-full',
        'border border-t border-neutral-200/30 dark:border-neutral-800/20',
        'backdrop-blur-md',
        'cursor-pointer',
        'transition-all duration-200 ease-out',
        props.proximity
          ? 'bottom-0 h-5 bg-neutral-50/80 dark:bg-neutral-800/80 shadow-md shadow-black/10'
          : '-bottom-1.5 h-3 bg-neutral-50/30 dark:bg-neutral-800/30',
      ]"
      @click="toggleDock"
    />
  </Transition>

  <!-- Expanded WhisperDock Container wrapping WhisperComposerBar -->
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
        'fixed bottom-0 inset-x-0 z-90 w-full',
      ]"
    >
      <WhisperComposerBar
        ref="composerRef"
        variant="dock"
        :tools="props.tools"
        @send="onSendSuccess"
        @get-suggestions="handleGetSuggestions"
        @clear-suggestions="handleClearSuggestions"
      />
    </div>
  </Transition>
</template>
