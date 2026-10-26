<script setup lang="ts">
/**
 * Floaties & Treats popover — Stage-Mate macaron prop materials.
 *
 * The recipe tables live in `constants/control-strip-labels.ts`; the popover is
 * the only thing that needs them, so they travel with it out of the shell.
 */
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import StripPopover from '../StripPopover.vue'

import {
  FEATURED_MACARONS,
  MACARON_HEART_OPTIONS,
  MACARON_SHELL_OPTIONS,
  MACARON_WHIP_OPTIONS,
} from '../../../../constants/control-strip-labels'

const emit = defineEmits<{ close: [] }>()

const macaronTab = ref<'featured' | 'custom'>('featured')
const selectedMacaronPreset = ref('strawberry_cream')
const customShell = ref('pink')
const customWhip = ref('berry')
const customHeart = ref('pink')

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

async function applyMacaron(shell: string, whip: string, heart: string, presetId?: string) {
  if (presetId) {
    selectedMacaronPreset.value = presetId
  }
  else {
    selectedMacaronPreset.value = ''
  }
  if (isElectron.value) {
    try {
      const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
      const { electronStageMateSetPropMacaron } = await import('@proj-airi/stage-shared')
      const setMacaron = useElectronEventaInvoke(electronStageMateSetPropMacaron)
      await setMacaron({ shell, whip, heart })
      toast.success(`Applied floatie style: ${shell} / ${whip}`)
    }
    catch (err) {
      console.warn('Failed to dispatch macaron materials:', err)
    }
  }
}
</script>

<template>
  <StripPopover title="Floaties & Treats" header-padding="1.5" @close="emit('close')">
    <!-- Segmented Toggle: Featured vs Custom Recipe -->
    <div class="flex rounded-xl bg-neutral-200/40 p-0.5 dark:bg-neutral-950/40">
      <button
        :class="[
          'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
          macaronTab === 'featured'
            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
        ]"
        @click="macaronTab = 'featured'"
      >
        Featured Flavors
      </button>
      <button
        :class="[
          'flex-1 text-[10px] font-bold py-1 rounded-lg transition-all cursor-pointer text-center',
          macaronTab === 'custom'
            ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-800 dark:text-neutral-100'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300',
        ]"
        @click="macaronTab = 'custom'"
      >
        Custom Recipe
      </button>
    </div>

    <!-- TAB 1: 3x3 FEATURED PRESETS GRID -->
    <div v-if="macaronTab === 'featured'" class="grid grid-cols-3 gap-1">
      <div
        v-for="item in FEATURED_MACARONS"
        :key="item.id"
        :class="[
          'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-1 text-center transition-all bg-neutral-200/10 dark:bg-neutral-800/10',
          selectedMacaronPreset === item.id
            ? 'border-sky-500 ring-2 ring-sky-500/40 bg-sky-500/10 dark:bg-sky-500/15'
            : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-sky-500/50 hover:bg-neutral-200/20 dark:hover:bg-neutral-800/20',
        ]"
        @click="applyMacaron(item.shell, item.whip, item.heart, item.id)"
      >
        <span class="select-none text-xl leading-none">{{ item.emoji }}</span>
        <span class="mt-1 w-full truncate text-[8px] text-neutral-700 font-semibold dark:text-neutral-300">
          {{ item.name }}
        </span>
      </div>
    </div>

    <!-- TAB 2: CUSTOM RECIPE DROPDOWNS -->
    <div v-else class="flex flex-col gap-2">
      <!-- Cookie Shell Dropdown -->
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] text-neutral-400 font-semibold">Cookie Shell:</span>
        <select
          v-model="customShell"
          class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        >
          <option v-for="opt in MACARON_SHELL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Whip Filling Dropdown -->
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] text-neutral-400 font-semibold">Cream Whip:</span>
        <select
          v-model="customWhip"
          class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        >
          <option v-for="opt in MACARON_WHIP_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Heart Candy Dropdown -->
      <div class="flex flex-col gap-0.5">
        <span class="text-[9px] text-neutral-400 font-semibold">Heart Candy:</span>
        <select
          v-model="customHeart"
          class="w-full cursor-pointer border border-neutral-200/10 rounded-xl bg-neutral-200/40 px-2 py-1 text-[10px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
        >
          <option v-for="opt in MACARON_HEART_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <!-- Apply Button -->
      <button
        class="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl bg-sky-500/90 py-1.5 text-[10px] text-white font-bold shadow transition-all active:scale-[0.98] hover:bg-sky-500"
        @click="applyMacaron(customShell, customWhip, customHeart)"
      >
        <span class="i-solar:magic-stick-3-bold text-xs" />
        Apply Custom Float
      </button>
    </div>
  </StripPopover>
</template>
