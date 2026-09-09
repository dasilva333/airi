<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  message?: string
  tone?: 'primary' | 'purple' | 'amber'
}>(), {
  message: '',
  tone: 'primary',
})

const toneClasses = computed(() => {
  switch (props.tone) {
    case 'purple':
      return {
        avatar: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
        icon: 'text-purple-500 dark:text-purple-400',
        bubble: 'border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20',
      }
    case 'amber':
      return {
        avatar: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
        icon: 'text-amber-500 dark:text-amber-400',
        bubble: 'border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20',
      }
    default:
      return {
        avatar: 'from-primary-500/20 to-indigo-500/20 border-primary-500/30',
        icon: 'text-primary-500 dark:text-primary-400',
        bubble: 'border-primary-500/20 bg-primary-500/5 dark:bg-primary-950/20',
      }
  }
})
</script>

<template>
  <div
    v-motion
    :initial="{ opacity: 0, y: 8 }"
    :enter="{ opacity: 1, y: 0 }"
    :duration="400"
    :class="['flex items-start gap-3 w-full']"
  >
    <!-- Companion avatar -->
    <div
      :class="[
        'h-10 w-10 flex flex-shrink-0 items-center justify-center border rounded-full bg-gradient-to-br shadow-sm mt-0.5',
        toneClasses.avatar,
      ]"
    >
      <div :class="['i-solar:emoji-funny-circle-bold-duotone h-6 w-6', toneClasses.icon]" />
    </div>

    <!-- Bubble -->
    <div
      :class="[
        'relative flex-1 border rounded-2xl rounded-tl-sm px-4 py-3 text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed backdrop-blur-md shadow-sm',
        toneClasses.bubble,
      ]"
    >
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>
