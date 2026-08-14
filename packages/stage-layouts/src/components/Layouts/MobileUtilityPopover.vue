<script setup lang="ts">
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const captionPosition = useLocalStorage<'head' | 'dock' | 'off'>('airi:mobile:caption-position', 'head')

const isGroundingEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.groundingEnabled ?? false
})

const isAutonomousArtistryEnabled = computed(() => {
  return activeCard.value?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

function handleToggleGrounding() {
  if (activeCardId.value) {
    airiCardStore.toggleGrounding(activeCardId.value)
  }
}

async function handleToggleArtistry() {
  if (activeCardId.value) {
    await airiCardStore.setAutonomousArtistry(activeCardId.value, !isAutonomousArtistryEnabled.value)
  }
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        class="size-8.5 flex items-center justify-center border border-neutral-200/30 rounded-full bg-white/10 text-neutral-700 shadow-sm backdrop-blur-md transition-all active:scale-95 dark:border-neutral-700/40 dark:bg-neutral-800/60 dark:text-neutral-200"
        title="Stage Utility & Controls"
      >
        <div class="i-solar:bolt-bold-duotone size-4.5 text-amber-500/90 dark:text-amber-400" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="8"
        class="animate-in fade-in slide-in-from-top-1 z-[1000] w-64 flex flex-col border border-neutral-200/60 rounded-2xl bg-white/95 p-3 shadow-2xl backdrop-blur-2xl duration-150 dark:border-neutral-800/80 dark:bg-neutral-950/95"
      >
        <!-- Header -->
        <div class="mb-2.5 flex items-center justify-between border-b border-neutral-200/40 pb-2 dark:border-neutral-800/40">
          <div class="flex items-center gap-1.5 text-xs text-neutral-800 font-bold tracking-wider uppercase dark:text-neutral-200">
            <div class="i-solar:tuning-square-2-bold-duotone text-primary-500" />
            <span>Stage Utility</span>
          </div>
          <span class="rounded-md bg-primary-500/10 px-1.5 py-0.5 text-[9px] text-primary-600 font-semibold dark:text-primary-400">
            Runtime
          </span>
        </div>

        <!-- Section 1: Caption Mode -->
        <div class="mb-3 flex flex-col gap-1.5">
          <label class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
            Captions
          </label>
          <div class="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100/80 p-1 dark:bg-neutral-900/80">
            <button
              :class="[
                'flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all',
                captionPosition === 'head'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="captionPosition = 'head'"
            >
              <div class="i-solar:chat-round-dots-bold-duotone mb-0.5 size-3.5 text-teal-500" />
              <span>Head</span>
            </button>
            <button
              :class="[
                'flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all',
                captionPosition === 'dock'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="captionPosition = 'dock'"
            >
              <div class="i-solar:dialog-bold-duotone mb-0.5 size-3.5 text-blue-500" />
              <span>Dock</span>
            </button>
            <button
              :class="[
                'flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all',
                captionPosition === 'off'
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-100 font-bold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="captionPosition = 'off'"
            >
              <div class="i-solar:volume-cross-bold-duotone mb-0.5 size-3.5 text-neutral-400" />
              <span>Audio</span>
            </button>
          </div>
        </div>

        <!-- Section 2: Runtime Toggles -->
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase">
            Intelligence Feeds
          </label>

          <!-- Sensory Grounding Toggle -->
          <button
            class="flex items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleGrounding"
          >
            <div class="flex items-center gap-2">
              <div class="size-6 flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <div class="i-solar:radar-2-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Sensory Grounding</span>
                <span class="text-[9px] text-neutral-400">Context & window telemetry</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative',
                isGroundingEnabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isGroundingEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </button>

          <!-- Autonomous Director Toggle -->
          <button
            class="flex items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-100/80 dark:hover:bg-neutral-900/80"
            @click="handleToggleArtistry"
          >
            <div class="flex items-center gap-2">
              <div class="size-6 flex items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <div class="i-solar:clapperboard-play-bold-duotone size-3.5" />
              </div>
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Autonomous Director</span>
                <span class="text-[9px] text-neutral-400">Acting & scene cues</span>
              </div>
            </div>
            <div
              :class="[
                'h-4 w-7 rounded-full transition-colors relative',
                isAutonomousArtistryEnabled ? 'bg-purple-500' : 'bg-neutral-300 dark:bg-neutral-700',
              ]"
            >
              <div
                :class="[
                  'size-3 rounded-full bg-white transition-transform absolute top-0.5 left-0.5',
                  isAutonomousArtistryEnabled ? 'translate-x-3' : '',
                ]"
              />
            </div>
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
