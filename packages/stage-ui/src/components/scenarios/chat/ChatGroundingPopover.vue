<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useRouter } from 'vue-router'

import { useAiriCardStore } from '../../../stores/modules/airi-card'

const props = withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  /** Variant of the trigger button */
  variant?: 'default' | 'mobile'
}>(), {
  title: 'Grounding Options',
  variant: 'default',
})

const router = useRouter()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

function navigateToProactivity() {
  if (!activeCardId.value)
    return
  router.push(`/settings/airi-card?cardId=${activeCardId.value}&tab=proactivity`)
}

function handleToggleGrounding() {
  if (activeCardId.value) {
    airiCardStore.toggleGrounding(activeCardId.value)
  }
}

function handleToggleGroundingMemory() {
  if (activeCardId.value) {
    airiCardStore.toggleGroundingMemory(activeCardId.value)
  }
}

function handleToggleGroundingTopics() {
  if (activeCardId.value) {
    airiCardStore.toggleGroundingTopics(activeCardId.value)
  }
}

function handleToggleGroundingDirectorScratchpad() {
  if (activeCardId.value) {
    airiCardStore.toggleGroundingDirectorScratchpad(activeCardId.value)
  }
}

function handleToggleSalienceGate() {
  if (activeCardId.value) {
    airiCardStore.toggleSalienceGate(activeCardId.value)
  }
}
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        v-if="variant === 'mobile'"
        class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
        :title="title"
      >
        <div class="i-solar:cpu-bolt-bold-duotone size-5 text-neutral-500 dark:text-neutral-400" />
      </button>
      <button
        v-else
        class="max-h-[10lh] min-h-[1lh] flex items-center justify-center rounded-md p-2 outline-none transition-colors transition-transform active:scale-95"
        :class="[
          activeCard?.extensions?.airi?.groundingEnabled || activeCard?.extensions?.airi?.groundingMemoryEnabled || activeCard?.extensions?.airi?.groundingTopicsEnabled || activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled
            ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-neutral-100 text-neutral-500 hover:text-primary-500 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-primary-400',
        ]"
        text="lg"
        :title="title"
      >
        <div
          :class="[
            activeCard?.extensions?.airi?.groundingEnabled || activeCard?.extensions?.airi?.groundingMemoryEnabled || activeCard?.extensions?.airi?.groundingTopicsEnabled || activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled
              ? 'i-solar:cpu-bolt-bold-duotone'
              : 'i-solar:cpu-bold-duotone',
          ]"
        />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="end"
        class="animate-in fade-in zoom-in z-100 w-76 border border-neutral-200/50 rounded-2xl bg-white/90 p-3 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Grounding Options</span>
          <div class="i-solar:cpu-bolt-bold-duotone text-xs text-primary-500" />
        </div>

        <!-- Options Toggles List -->
        <div class="mb-3 space-y-1.5">
          <!-- Toggle 1: System Sensors -->
          <div
            class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            @click="handleToggleGrounding"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="text-lg" :class="[
                  activeCard?.extensions?.airi?.groundingEnabled
                    ? 'text-amber-500 i-solar:cpu-bolt-bold-duotone'
                    : 'text-neutral-400 dark:text-neutral-500 i-solar:cpu-bold-duotone',
                ]"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">System Sensors</span>
                <span class="text-[9px] text-neutral-400">Inject real-time OS telemetry</span>
              </div>
            </div>
            <!-- Switch UI -->
            <div
              :class="activeCard?.extensions?.airi?.groundingEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
            >
              <span
                :class="activeCard?.extensions?.airi?.groundingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              />
            </div>
          </div>

          <!-- Toggle 2: In-Context History (Disabled Placeholder) -->
          <div
            class="w-full flex cursor-not-allowed items-center justify-between rounded-xl p-2 opacity-50"
          >
            <div class="flex items-center gap-2.5">
              <div class="i-solar:history-bold-duotone text-lg text-neutral-400 dark:text-neutral-500" />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">In-Context History</span>
                <span class="text-[9px] text-neutral-400">Attach recent sliding chat turns</span>
              </div>
            </div>
            <!-- Switch UI (Disabled/Off) -->
            <div
              class="relative h-4 w-7 inline-flex shrink-0 items-center border border-transparent rounded-full bg-neutral-200 dark:bg-neutral-700"
            >
              <span
                class="pointer-events-none inline-block h-3.5 w-3.5 translate-x-0.5 transform rounded-full bg-white shadow"
              />
            </div>
          </div>

          <!-- Toggle 3: Universe Memory (RAG) -->
          <div
            class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            @click="handleToggleGroundingMemory"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="text-lg" :class="[
                  activeCard?.extensions?.airi?.groundingMemoryEnabled
                    ? 'text-amber-500 i-solar:database-bold-duotone'
                    : 'text-neutral-400 dark:text-neutral-500 i-solar:database-linear',
                ]"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Universe Memory (RAG)</span>
                <span class="text-[9px] text-neutral-400">Semantic long-term memory lookup</span>
              </div>
            </div>
            <!-- Switch UI -->
            <div
              :class="activeCard?.extensions?.airi?.groundingMemoryEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
            >
              <span
                :class="activeCard?.extensions?.airi?.groundingMemoryEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              />
            </div>
          </div>

          <!-- Toggle 4: Recent Topics -->
          <div
            class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            @click="handleToggleGroundingTopics"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="text-lg" :class="[
                  activeCard?.extensions?.airi?.groundingTopicsEnabled
                    ? 'text-amber-500 i-solar:hashtag-bold-duotone'
                    : 'text-neutral-400 dark:text-neutral-500 i-solar:hashtag-linear',
                ]"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Recent Topics</span>
                <span class="text-[9px] text-neutral-400">Inject active trending context</span>
              </div>
            </div>
            <!-- Switch UI -->
            <div
              :class="activeCard?.extensions?.airi?.groundingTopicsEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
            >
              <span
                :class="activeCard?.extensions?.airi?.groundingTopicsEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              />
            </div>
          </div>

          <!-- Toggle 5: Visual Scene State (Director's Scratchpad) -->
          <div
            class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            @click="handleToggleGroundingDirectorScratchpad"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="text-lg" :class="[
                  activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled
                    ? 'text-amber-500 i-solar:gallery-bold-duotone'
                    : 'text-neutral-400 dark:text-neutral-500 i-solar:gallery-linear',
                ]"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Visual Scene State</span>
                <span class="text-[9px] text-neutral-400">Attach Director's latest scratchpad</span>
              </div>
            </div>
            <!-- Switch UI -->
            <div
              :class="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
            >
              <span
                :class="activeCard?.extensions?.airi?.groundingDirectorScratchpadEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              />
            </div>
          </div>

          <!-- Toggle 6: Salience Gating (RWKV 0.1B) — Phase-6 late-layer Δh intensity flag -->
          <div
            class="w-full flex cursor-pointer items-center justify-between rounded-xl p-2 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
            @click="handleToggleSalienceGate"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="text-lg" :class="[
                  activeCard?.extensions?.airi?.salienceGateEnabled
                    ? 'text-amber-500 i-solar:pulse-bold-duotone'
                    : 'text-neutral-400 dark:text-neutral-500 i-solar:pulse-linear',
                ]"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">Salience Gating (RWKV)</span>
                <span class="text-[9px] text-neutral-400">Flag high-intensity turns for grounding</span>
              </div>
            </div>
            <!-- Switch UI -->
            <div
              :class="activeCard?.extensions?.airi?.salienceGateEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              class="relative h-4 w-7 inline-flex shrink-0 cursor-pointer items-center border border-transparent rounded-full transition-colors duration-200 ease-in-out"
            >
              <span
                :class="activeCard?.extensions?.airi?.salienceGateEnabled ? 'translate-x-3.5' : 'translate-x-0.5'"
                class="pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              />
            </div>
          </div>
        </div>

        <!-- Footer Settings Link -->
        <div class="border-t border-neutral-100 pt-2 dark:border-neutral-800">
          <button
            class="w-full flex items-center justify-between rounded-xl p-2 text-left transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="navigateToProactivity"
          >
            <div class="flex items-center gap-2">
              <div class="i-solar:settings-minimalistic-linear text-neutral-400" />
              <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">Proactivity Settings</span>
            </div>
            <div class="i-solar:alt-arrow-right-linear text-xs text-neutral-400" />
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
