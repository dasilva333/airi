<script setup lang="ts">
import BrainModelPicker from './BrainModelPicker.vue'

withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  variant?: 'default' | 'mobile' | 'button' | 'custom'
  buttonLabel?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}>(), {
  title: 'Model & Provider',
  variant: 'default',
  side: 'top',
})
</script>

<template>
  <BrainModelPicker
    :title="title"
    :variant="variant"
    :button-label="buttonLabel"
    :side="side"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
  </BrainModelPicker>
</template>
