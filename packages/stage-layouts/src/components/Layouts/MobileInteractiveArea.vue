<script setup lang="ts">
import MobileWhisperSheet from './MobileWhisperSheet.vue'

const props = defineProps<{
  tools?: any[]
}>()

const emit = defineEmits<{
  (e: 'settings-open', open: boolean): void
}>()
</script>

<template>
  <MobileWhisperSheet :tools="props.tools" @settings-open="emit('settings-open', $event)" />
</template>
