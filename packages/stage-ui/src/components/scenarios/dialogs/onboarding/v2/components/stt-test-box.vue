<script setup lang="ts">
import { LevelMeter } from '../../../../../gadgets'

// V2 onboarding — presentational test box. Owns no logic; the parent step
// drives the mic stream, transcription, and verification state machine.
defineProps<{
  volumeLevel: number
  statusMessage: string
  streamingText: string
  transcribedText: string
  isTesting: boolean
  isVerified: boolean
  supportsStreamInput: boolean
  canStart: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop'): void
}>()
</script>

<template>
  <div :class="['p-4 rounded-xl', 'bg-white/40 dark:bg-neutral-900/40', 'border border-neutral-200/60 dark:border-neutral-800/80', 'backdrop-blur-md', 'flex flex-col gap-4']">
    <div class="flex items-center justify-between">
      <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">Live Transcription Test</span>
      <span
        v-if="isVerified"
        class="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600 font-bold dark:text-emerald-400"
      >
        <div class="i-solar:verified-check-bold-duotone h-3.5 w-3.5" />
        Verified Working
      </span>
    </div>

    <LevelMeter :level="volumeLevel" label="Input Level" />

    <div v-if="statusMessage" class="flex items-center gap-2 border border-primary-200 rounded-lg bg-primary-50 p-3 text-primary-700 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300">
      <div v-if="isTesting" class="i-solar:spinner-line-duotone animate-spin text-sm" />
      <div v-else class="i-solar:info-circle-line-duotone text-sm" />
      <span class="text-sm font-medium">{{ statusMessage }}</span>
    </div>

    <button
      class="flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm text-white font-semibold shadow-lg shadow-primary-500/25 transition-all active:scale-95 disabled:cursor-not-allowed hover:bg-primary-600 disabled:opacity-50"
      :disabled="!canStart && !isTesting"
      @click="isTesting ? emit('stop') : emit('start')"
    >
      <div :class="isTesting ? 'i-solar:stop-circle-line-duotone' : 'i-solar:microphone-line-duotone'" class="h-4 w-4" />
      {{ isTesting ? 'Stop Test' : 'Start Speaking Test' }}
    </button>

    <div v-if="errorMessage" class="border border-red-200 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
      {{ errorMessage }}
    </div>

    <!-- Empirical verification label: gate reads transcribedText !== '' -->
    <div class="min-h-[96px] border rounded-lg p-3 text-sm" :class="transcribedText || streamingText ? 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900' : 'border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-500'">
      <template v-if="streamingText && supportsStreamInput">
        <div class="mb-1 text-xs text-neutral-400 font-medium">
          Hearing you…
        </div>
        <div class="whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
          {{ streamingText }}
        </div>
      </template>
      <template v-if="transcribedText">
        <div class="mb-1 text-xs text-emerald-600 font-bold dark:text-emerald-400" :class="{ 'mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-700': streamingText && supportsStreamInput }">
          Final transcription:
        </div>
        <div class="whitespace-pre-wrap text-neutral-700 dark:text-neutral-200">
          {{ transcribedText }}
        </div>
      </template>
      <span v-if="!transcribedText && !streamingText">No transcription yet. Start the test and speak into your microphone.</span>
    </div>
  </div>
</template>
