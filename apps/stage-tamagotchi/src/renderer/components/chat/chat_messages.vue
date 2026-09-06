<script setup lang="ts">
import { ref } from 'vue'

import InteractiveArea from '../InteractiveArea.vue'

const emit = defineEmits<{
  (e: 'ready'): void
}>()

const interactiveAreaRef = ref<InstanceType<typeof InteractiveArea> | null>(null)

// Expose internal references to parent shell (so that right panel actions can trigger them)
defineExpose({
  interactiveAreaRef,
})
</script>

<template>
  <InteractiveArea
    ref="interactiveAreaRef"
    class="interaction-area block h-full w-full p-4 transition-opacity duration-250"
    @ready="emit('ready')"
  />
</template>
