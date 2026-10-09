<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  message: string
  stepKey?: string
  tone?: 'primary' | 'sky' | 'purple' | 'amber'
  startDelay?: number
  speed?: number
}>(), {
  message: '',
  stepKey: '',
  tone: 'primary',
  startDelay: 120,
  speed: 45,
})

// Module-level cache to remember steps visited in this onboarding session.
// Visited steps skip animation and render words immediately.
const visitedStepKeys = (globalThis as any).__airi_onboarding_visited_steps__ || ((globalThis as any).__airi_onboarding_visited_steps__ = new Set<string>())

const words = computed(() => {
  if (!props.message)
    return []
  return props.message.trim().split(/\s+/)
})

const currentWordIndex = ref<number>(-1)
const isTyping = ref<boolean>(false)

let startTimeoutId: ReturnType<typeof setTimeout> | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

function revealAll() {
  if (startTimeoutId) {
    clearTimeout(startTimeoutId)
    startTimeoutId = null
  }
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  currentWordIndex.value = words.value.length - 1
  isTyping.value = false
}

function startAnimation() {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReducedMotion || (props.stepKey && visitedStepKeys.has(props.stepKey))) {
    revealAll()
    return
  }

  if (props.stepKey) {
    visitedStepKeys.add(props.stepKey)
  }

  if (words.value.length === 0) {
    revealAll()
    return
  }

  isTyping.value = true
  startTimeoutId = setTimeout(() => {
    intervalId = setInterval(() => {
      if (currentWordIndex.value < words.value.length - 1) {
        currentWordIndex.value++
      }
      else {
        revealAll()
      }
    }, props.speed)
  }, props.startDelay)
}

onMounted(() => {
  startAnimation()
})

onBeforeUnmount(() => {
  if (startTimeoutId)
    clearTimeout(startTimeoutId)
  if (intervalId)
    clearInterval(intervalId)
})

const toneClasses = computed(() => {
  switch (props.tone) {
    case 'sky':
      return {
        avatarRing: 'border-sky-500/30',
        avatarBg: 'from-sky-500/20 to-cyan-500/20',
        avatarIcon: 'text-sky-400',
        bubbleBorder: 'border-sky-500/20',
        bubbleBg: 'bg-sky-500/5 dark:bg-sky-950/20',
        bubbleText: 'text-neutral-700 dark:text-neutral-300',
        indicator: 'bg-sky-400',
      }
    case 'purple':
      return {
        avatarRing: 'border-purple-500/30',
        avatarBg: 'from-purple-500/20 to-pink-500/20',
        avatarIcon: 'text-purple-400',
        bubbleBorder: 'border-purple-500/20',
        bubbleBg: 'bg-purple-500/5 dark:bg-purple-950/20',
        bubbleText: 'text-neutral-700 dark:text-neutral-300',
        indicator: 'bg-purple-400',
      }
    case 'amber':
      return {
        avatarRing: 'border-amber-500/30',
        avatarBg: 'from-amber-500/20 to-orange-500/20',
        avatarIcon: 'text-amber-400',
        bubbleBorder: 'border-amber-500/20',
        bubbleBg: 'bg-amber-500/5 dark:bg-amber-950/20',
        bubbleText: 'text-neutral-700 dark:text-neutral-300',
        indicator: 'bg-amber-400',
      }
    default:
      return {
        avatarRing: 'border-primary-500/30',
        avatarBg: 'from-primary-500/20 to-indigo-500/20',
        avatarIcon: 'text-primary-400',
        bubbleBorder: 'border-primary-500/20',
        bubbleBg: 'bg-primary-500/5 dark:bg-primary-950/20',
        bubbleText: 'text-neutral-700 dark:text-neutral-300',
        indicator: 'bg-primary-400',
      }
  }
})
</script>

<template>
  <div
    v-motion
    :initial="{ opacity: 0, scale: 0.98 }"
    :enter="{ opacity: 1, scale: 1 }"
    :duration="350"
    :delay="100"
    :class="['max-w-xl w-full flex items-start gap-3 text-left cursor-pointer select-none']"
    @click="revealAll"
  >
    <!-- Avatar Container with Typing Indicator Badge -->
    <div :class="['relative flex-shrink-0 mt-0.5']">
      <div
        :class="[
          'h-8 w-8 flex items-center justify-center border rounded-full bg-gradient-to-br shadow-xs',
          toneClasses.avatarRing,
          toneClasses.avatarBg,
        ]"
      >
        <div :class="['i-solar:emoji-funny-circle-bold-duotone h-5 w-5', toneClasses.avatarIcon]" />
      </div>

      <!-- Subtle Typing Dot Beside Avatar -->
      <span
        v-if="isTyping"
        :class="[
          'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-neutral-950 animate-pulse',
          toneClasses.indicator,
        ]"
      />
    </div>

    <!-- Speech Bubble with Zero Layout Shift Word Reveal -->
    <div
      :class="[
        'relative flex-1 border rounded-xl rounded-tl-xs px-4 py-2 text-xs leading-relaxed backdrop-blur-md shadow-sm',
        toneClasses.bubbleBorder,
        toneClasses.bubbleBg,
        toneClasses.bubbleText,
      ]"
    >
      <!-- Screen Reader Accessible Full Text -->
      <span class="sr-only">{{ message }}</span>

      <!-- Visual Word Reveal with Pre-Allocated Layout Space -->
      <span aria-hidden="true">
        <span
          v-for="(word, idx) in words"
          :key="idx"
          :class="[
            'transition-opacity duration-150 inline',
            idx <= currentWordIndex ? 'opacity-100' : 'opacity-0 select-none',
          ]"
        >
          {{ word }}{{ idx < words.length - 1 ? ' ' : '' }}
        </span>
      </span>
    </div>
  </div>
</template>
