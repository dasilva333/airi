<script setup lang="ts">
import type { OnboardingV3StepDef } from '../types'

import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

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

const isMenuOpen = ref(false)

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

function handleStepClick(index: number) {
  emit('select', index)
  isMenuOpen.value = false
}

function handlePrevBatch() {
  const target = Math.max(0, props.currentIndex - 1)
  emit('select', target)
}

function handleNextBatch() {
  const target = Math.min(props.steps.length - 1, props.currentIndex + 1)
  emit('select', target)
}
</script>

<template>
  <nav
    aria-label="Onboarding Progress"
    style="-webkit-app-region: no-drag;"
    :class="['flex items-center space-x-1.5 bg-black/5 dark:bg-neutral-900/60 border border-neutral-200/80 dark:border-white/5 rounded-full px-2 py-1 text-xs select-none']"
  >
    <!-- Left Overflow Chevron / Clickable Skip Back -->
    <button
      v-if="windowRange.hasLeftOverflow"
      type="button"
      :class="['p-0.5 rounded-full text-neutral-400 hover:text-primary-500 dark:text-neutral-500 dark:hover:text-primary-400 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors flex items-center justify-center']"
      title="Previous step"
      @click="handlePrevBatch"
    >
      <div :class="['i-solar:alt-arrow-left-linear w-3.5 h-3.5']" />
    </button>

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
        @click="handleStepClick(step.index)"
      >
        {{ step.label }}
      </button>
    </div>

    <!-- Right Overflow Chevron / Clickable Skip Forward -->
    <button
      v-if="windowRange.hasRightOverflow"
      type="button"
      :class="['p-0.5 rounded-full text-neutral-400 hover:text-primary-500 dark:text-neutral-500 dark:hover:text-primary-400 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors flex items-center justify-center']"
      title="Next step"
      @click="handleNextBatch"
    >
      <div :class="['i-solar:alt-arrow-right-linear w-3.5 h-3.5']" />
    </button>

    <!-- All-Steps Quick Jump Popover Menu -->
    <PopoverRoot v-model:open="isMenuOpen">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="[
            'ml-0.5 p-1 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center',
          ]"
          title="Jump to any step"
        >
          <div :class="['i-solar:list-linear w-3.5 h-3.5']" />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          align="center"
          :side-offset="8"
          :class="[
            'z-50 w-64 max-h-80 overflow-y-auto p-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-md text-xs',
          ]"
        >
          <div :class="['px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1']">
            All Onboarding Steps ({{ steps.length }})
          </div>
          <div :class="['space-y-0.5']">
            <button
              v-for="step in steps"
              :key="step.id"
              type="button"
              :class="[
                'w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer',
                step.index === currentIndex
                  ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold'
                  : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5',
              ]"
              @click="handleStepClick(step.index)"
            >
              <div :class="['flex items-center gap-2 min-w-0']">
                <span :class="['text-[10px] font-mono text-neutral-400 w-4 text-right flex-shrink-0']">
                  {{ step.index + 1 }}.
                </span>
                <div :class="['min-w-0']">
                  <div :class="['truncate']">
                    {{ step.label }}
                  </div>
                  <div :class="['text-[9px] text-neutral-400 truncate']">
                    {{ step.subtitle }}
                  </div>
                </div>
              </div>
              <div
                v-if="step.index === currentIndex"
                :class="['i-solar:check-circle-bold text-primary-500 flex-shrink-0 text-sm']"
              />
            </button>
          </div>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </nav>
</template>
