<script setup lang="ts">
import type { OnboardingV3StepDef } from '../types'

import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    steps: OnboardingV3StepDef[]
    currentIndex: number
    windowSize?: number
  }>(),
  {
    windowSize: 5,
  },
)

const emit = defineEmits<{
  (e: 'select', index: number): void
}>()

const windowRange = computed(() => {
  const total = props.steps.length
  const size = Math.min(props.windowSize, total)
  const half = Math.floor(size / 2)

  let start = props.currentIndex - half
  if (start < 0) {
    start = 0
  }
  if (start + size > total) {
    start = Math.max(0, total - size)
  }
  const end = Math.min(total, start + size)

  return {
    start,
    end,
    hasLeftOverflow: start > 0,
    hasRightOverflow: end < total,
    visibleSteps: props.steps.slice(start, end),
  }
})
</script>

<template>
  <nav aria-label="Onboarding Progress" :class="['flex items-center space-x-1.5 bg-black/5 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-white/5 rounded-full px-2.5 py-1 text-xs select-none']">
    <!-- Left Overflow Indicator -->
    <span
      v-if="windowRange.hasLeftOverflow"
      :class="['text-neutral-400 dark:text-neutral-500 font-mono text-[10px] px-0.5 tracking-tighter cursor-default']"
    >
      ···
    </span>

    <!-- 5-Item Sliding Window Items -->
    <div :class="['flex items-center space-x-1']">
      <button
        v-for="step in windowRange.visibleSteps"
        :key="step.id"
        type="button"
        :class="[
          'px-2.5 py-0.5 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer',
          step.index === props.currentIndex
            ? 'bg-primary-600 text-white font-semibold shadow-md shadow-primary-600/25'
            : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-medium hover:bg-black/5 dark:hover:bg-white/5',
        ]"
        @click="emit('select', step.index)"
      >
        {{ step.label }}
      </button>
    </div>

    <!-- Right Overflow Indicator -->
    <span
      v-if="windowRange.hasRightOverflow"
      :class="['text-neutral-500 font-mono text-[10px] px-0.5 tracking-tighter cursor-default']"
    >
      ···
    </span>
  </nav>
</template>
