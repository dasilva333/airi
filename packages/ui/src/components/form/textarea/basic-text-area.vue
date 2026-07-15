<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  defaultHeight?: string
  sendMode?: 'enter' | 'ctrl-enter' | 'double-enter'
  suggestMode?: 'enter' | 'ctrl-enter' | 'double-enter' | 'disabled'
}>()

const events = defineEmits<{
  (event: 'submit', message: string): void
  (event: 'suggest'): void
  (event: 'attach', files: File[]): void
}>()

const input = defineModel<string>({
  default: '',
})

const textareaRef = ref<HTMLTextAreaElement>()
const textareaHeight = ref('auto')
const lastEnterAt = ref(0)

function emitSubmit() {
  events('submit', input.value.replace(/[\r\n]+$/, ''))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.isComposing || e.key !== 'Enter')
    return

  const sendMode = props.sendMode || 'enter'
  const suggestMode = props.suggestMode || 'disabled'
  const hasPrimaryModifier = e.ctrlKey || e.metaKey

  // --- Suggest mode handling ---
  if (suggestMode !== 'disabled' && !e.shiftKey) {
    const matchesSuggest
      = (suggestMode === 'enter' && !hasPrimaryModifier)
        || (suggestMode === 'ctrl-enter' && hasPrimaryModifier)
        || (suggestMode === 'double-enter' && !hasPrimaryModifier)

    if (matchesSuggest) {
      if (suggestMode === 'double-enter') {
        const now = Date.now()
        if (now - lastEnterAt.value <= 350) {
          // Second Enter within window → fire suggest
          e.preventDefault()
          lastEnterAt.value = 0
          events('suggest')
          return
        }
        // First Enter → record the timestamp NOW before any send-mode branch can return early
        lastEnterAt.value = now
      }
      else {
        // Non-double-enter suggest modes fire immediately
        e.preventDefault()
        events('suggest')
        return
      }
    }
  }

  // --- Send mode handling ---
  if (sendMode === 'enter') {
    if (!e.shiftKey && !hasPrimaryModifier) {
      e.preventDefault()
      emitSubmit()
    }
    return
  }

  if (sendMode === 'ctrl-enter') {
    if (hasPrimaryModifier) {
      e.preventDefault()
      emitSubmit()
    }
    return
  }

  if (!e.shiftKey && !hasPrimaryModifier) {
    const now = Date.now()
    if (now - lastEnterAt.value <= 350) {
      e.preventDefault()
      lastEnterAt.value = 0
      emitSubmit()
      return
    }

    lastEnterAt.value = now
  }
}

function onPaste(e: ClipboardEvent) {
  if (!e.clipboardData)
    return

  const { files } = e.clipboardData
  if (files.length > 0) {
    e.preventDefault()
    events('attach', Array.from(files))
  }
}

const isDragging = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false

  if (!e.dataTransfer)
    return

  const { files } = e.dataTransfer
  if (files.length > 0) {
    events('attach', Array.from(files))
  }
}

// javascript - Creating a textarea with auto-resize - Stack Overflow
// https://stackoverflow.com/questions/454202/creating-a-textarea-with-auto-resize
watch(input, () => {
  textareaHeight.value = 'auto'
  requestAnimationFrame(() => {
    if (!textareaRef.value)
      return
    if (input.value === '') {
      textareaHeight.value = props.defaultHeight || 'fit-content'
      return
    }

    textareaHeight.value = `${textareaRef.value.scrollHeight}px`
  })
}, { immediate: true })
</script>

<template>
  <textarea
    ref="textareaRef"
    v-model="input"
    :style="{ height: textareaHeight }"
    :class="{ 'border-primary-500 ring-2 ring-primary-500/20': isDragging }"
    @keydown="onKeyDown"
    @paste="onPaste"
    @dragenter.prevent="onDragOver"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  />
</template>
