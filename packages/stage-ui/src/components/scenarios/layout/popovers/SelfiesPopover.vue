<script setup lang="ts">
/**
 * Selfies popover — countdown trigger plus the character's captured selfies.
 *
 * Presentational on purpose: the capture BroadcastChannel and its viewfinder
 * contract stay in the shell (see `useControlStripSelfie`), which is the single
 * owner of those two channels for the whole app. This component only asks for a
 * capture and reports a background selection.
 */
import { storeToRefs } from 'pinia'

import StripPopover from '../StripPopover.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettingsControlStrip } from '../../../../stores/settings/control-strip'

interface SelfieEntry {
  id: string
  url?: string | null
  title?: string
}

defineProps<{
  selfies: SelfieEntry[]
  countdown: number | null
}>()

const emit = defineEmits<{
  close: []
  takeSelfie: []
  selectBackground: [id: string]
}>()

const controlStripStore = useSettingsControlStrip()
const { selfieIncludeBg } = storeToRefs(controlStripStore)

const cardStore = useAiriCardStore()
const { activeCard } = storeToRefs(cardStore)
</script>

<template>
  <StripPopover title="Selfies" header-padding="1.5" @close="emit('close')">
    <!-- Take Selfie Button & Countdown Overlay -->
    <div class="relative flex flex-col gap-1.5">
      <button
        class="w-full flex cursor-pointer items-center justify-center gap-1.5 border border-primary-500/25 rounded-xl bg-primary-500/20 py-2 text-center text-xs text-primary-600 font-semibold transition-all disabled:cursor-not-allowed hover:bg-primary-500/30 dark:text-primary-300 disabled:opacity-50"
        :disabled="countdown !== null"
        @click="emit('takeSelfie')"
      >
        <span class="i-solar:camera-bold text-sm" />
        <span>{{ countdown !== null ? `Capturing in ${countdown}...` : 'Take Selfie' }}</span>
      </button>
      <label class="flex cursor-pointer select-none items-center justify-between rounded-lg bg-neutral-100/50 p-1.5 text-[10px] text-neutral-500 dark:bg-neutral-800/50 hover:bg-neutral-200/40 dark:text-neutral-400 dark:hover:bg-neutral-800/80">
        <span class="font-medium">Include Stage Background</span>
        <input
          v-model="selfieIncludeBg"
          type="checkbox"
          class="border-neutral-300/80 rounded text-primary-600 dark:border-neutral-700/80 dark:bg-neutral-800 focus:ring-primary-500"
        >
      </label>
    </div>

    <!-- Selfies Gallery (3-column grid) -->
    <div class="max-h-48 overflow-y-auto py-1 scrollbar-thin">
      <div v-if="selfies.length > 0" class="grid grid-cols-3 gap-1">
        <div
          v-for="selfie in selfies"
          :key="selfie.id"
          :class="[
            'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10 transition-all duration-200',
            activeCard?.extensions?.airi?.modules?.activeBackgroundId === selfie.id
              ? 'border-sky-500 ring-2 ring-sky-500/40'
              : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50',
          ]"
          @click="emit('selectBackground', selfie.id)"
        >
          <img
            v-if="selfie.url"
            :src="selfie.url"
            class="h-full w-full object-cover"
          >
          <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
            <span class="i-solar:camera-broken text-lg" />
          </div>

          <!-- Hover Date/Time banner -->
          <div class="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">
            {{ selfie.title }}
          </div>

          <!-- Set Background Top-Right Overlay Button -->
          <button
            class="absolute right-1 top-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/45 text-white transition-all duration-150 hover:scale-105 hover:bg-black/70"
            title="Set as stage background"
            @click.stop="emit('selectBackground', selfie.id)"
          >
            <span class="i-solar:gallery-bold text-xs" />
          </button>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center py-8 text-center opacity-40">
        <span class="i-solar:camera-bold-duotone text-2xl" />
        <span class="mt-2 text-[10px]">No selfies captured yet.</span>
      </div>
    </div>
  </StripPopover>
</template>
