<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  onReset?: () => void
}>()
</script>

<template>
  <div flex="~ col gap-6">
    <div>
      <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
        {{ title || 'Basic' }}
      </h2>
      <div text="neutral-400 dark:neutral-500">
        <span>{{ description || 'Essential settings' }}</span>
      </div>
    </div>
    <slot />
  </div>
</template>
