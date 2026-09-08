<script setup lang="ts">
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
} from 'reka-ui'

import CardEditorForm from './CardEditorForm.vue'

interface Props {
  modelValue: boolean
  cardId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'studio', cardId: string): void
}>()

const modelValue = defineModel<boolean>()
</script>

<template>
  <DialogRoot v-model:open="modelValue">
    <DialogPortal>
      <DialogOverlay class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
      <DialogContent class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-lg bg-neutral-50 p-6 shadow-lg md:max-w-4xl dark:bg-neutral-900 focus:outline-none">
        <CardEditorForm
          :card-id="props.cardId"
          mode="dialog"
          @cancel="modelValue = false"
          @save="modelValue = false"
          @studio="id => emit('studio', id)"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
