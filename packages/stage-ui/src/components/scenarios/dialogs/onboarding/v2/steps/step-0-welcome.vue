<script setup lang="ts">
import type { OnboardingStepNextHandler } from '../../types'

import { Button } from '@proj-airi/ui'

import CompanionBubble from '../components/companion-bubble.vue'

// V2 onboarding scaffold — Step 0: Welcome Landing. Visual mockup only.
defineProps<{
  onNext: OnboardingStepNextHandler
}>()

const featureChips = [
  { icon: 'i-solar:cpu-bolt-bold-duotone', label: 'Local WebGPU Models', color: 'text-primary-500' },
  { icon: 'i-solar:shield-check-bold-duotone', label: 'No API Keys Needed', color: 'text-emerald-500' },
  { icon: 'i-solar:magic-stick-3-bold-duotone', label: 'Mix & Match Souls + Bodies', color: 'text-purple-500' },
]
</script>

<template>
  <div class="h-full flex flex-col items-center justify-center gap-6 px-4 text-center">
    <div
      v-motion
      :initial="{ opacity: 0, scale: 0.8 }"
      :enter="{ opacity: 1, scale: 1 }"
      :duration="500"
      class="relative"
    >
      <div class="absolute inset-0 animate-ping rounded-full bg-primary-500/20" style="animation-duration: 3s" />
      <div class="relative h-20 w-20 flex items-center justify-center border border-primary-500/30 rounded-3xl from-primary-500/20 to-indigo-500/20 bg-gradient-to-br shadow-lg shadow-primary-500/10">
        <div class="i-solar:stars-line-bold-duotone h-10 w-10 text-primary-500" />
      </div>
    </div>

    <div v-motion :initial="{ opacity: 0, y: 10 }" :enter="{ opacity: 1, y: 0 }" :duration="400" :delay="100">
      <h1 class="text-3xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
        Welcome to AIRI
      </h1>
      <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        Your companion's stage — set up in minutes, 100% on your machine.
      </p>
    </div>

    <CompanionBubble
      v-motion
      class="max-w-md text-left"
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="200"
      message="Don't worry, it's easier than it looks! We've pre-configured everything to run locally on your machine. No sign-ups, no API keys — just pick, download, and play."
    />

    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="300"
      class="flex flex-wrap items-center justify-center gap-2"
    >
      <div
        v-for="chip in featureChips"
        :key="chip.label"
        :class="['flex items-center gap-1.5', 'border border-neutral-200/60 rounded-full px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-700/60 dark:text-neutral-300', 'bg-white/40 dark:bg-neutral-900/40 backdrop-blur-md']"
      >
        <div :class="[chip.icon, chip.color]" class="h-4 w-4" />
        {{ chip.label }}
      </div>
    </div>

    <Button
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="400"
      label="Let's Get Started →"
      class="mt-2"
      @click="onNext"
    />
  </div>
</template>
