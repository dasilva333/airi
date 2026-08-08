<script setup lang="ts">
defineProps<{
  title?: string
  initialVisible?: boolean
}>()
</script>

<template>
  <div flex="~ col gap-4" class="w-full">
    <div v-if="title" class="text-base text-neutral-800 font-semibold dark:text-neutral-200">
      {{ title }}
    </div>
    <div class="space-y-4">
      <slot />
    </div>
  </div>
</template>
