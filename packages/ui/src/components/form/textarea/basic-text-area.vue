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
const lastSendEnterAt = ref(0)
const lastSuggestEnterAt = ref(0)

function emitSubmit() {
  events('submit', input.value.replace(/[\r\n]+$/, ''))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.isComposing || e.key !== 'Enter')
    return

  const sendMode = props.sendMode || 'enter'
  const suggestMode = props.suggestMode || 'disabled'
  const hasPrimaryModifier = e.ctrlKey || e.metaKey
  const isPlainEnter = !e.shiftKey && !hasPrimaryModifier
  const isCtrlEnter = hasPrimaryModifier && !e.shiftKey

  const now = Date.now()

  // --- Suggest mode handling ---
  if (suggestMode !== 'disabled') {
    if (suggestMode === 'enter' && isPlainEnter) {
      e.preventDefault()
      events('suggest')
      return
    }

    if (suggestMode === 'ctrl-enter' && isCtrlEnter) {
      e.preventDefault()
      events('suggest')
      return
    }

    if (suggestMode === 'double-enter' && isPlainEnter) {
      if (now - lastSuggestEnterAt.value <= 350) {
        e.preventDefault()
        lastSuggestEnterAt.value = 0
        input.value = input.value.replace(/[\r\n]+$/, '')
        events('suggest')
        return
      }
      lastSuggestEnterAt.value = now
    }
  }

  // --- Send mode handling ---
  if (sendMode === 'enter' && isPlainEnter) {
    e.preventDefault()
    emitSubmit()
    return
  }

  if (sendMode === 'ctrl-enter' && isCtrlEnter) {
    e.preventDefault()
    emitSubmit()
    return
  }

  if (sendMode === 'double-enter' && isPlainEnter) {
    if (now - lastSendEnterAt.value <= 350) {
      e.preventDefault()
      lastSendEnterAt.value = 0
      emitSubmit()
      return
    }
    lastSendEnterAt.value = now
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
