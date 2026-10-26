<script setup lang="ts">
/**
 * Stage layout presets — size, monitor and screen alignment for the actor stage.
 *
 * Moved verbatim from the shell. Monitor discovery still runs here (desktop
 * only); consolidating it with the chat preset into one geometry composable is
 * the next step, deliberately not done in this commit.
 */
import { computed, onMounted, ref, watch } from 'vue'

import StripPopover from '../StripPopover.vue'

import { WINDOW_SIZE_PRESETS as PRESETS } from '../../../../constants/control-strip-labels'
import { useDatingSimStore } from '../../../../stores/dating-sim'

const emit = defineEmits<{ close: [] }>()

const datingSimStore = useDatingSimStore()

const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)

const activeMonitor = ref(1)
const selectedAlignment = ref('center')
// Only pass alignment to apply-size-preset after the user explicitly chose one —
// otherwise every size-preset click silently re-centers the window (selectedAlignment
// defaults to 'center'), which made oversized windows snap to the screen middle.
const alignmentChosen = ref(false)
watch(selectedAlignment, () => alignmentChosen.value = true)
const presetAlignment = computed(() => alignmentChosen.value ? selectedAlignment.value : undefined)
const monitorCount = ref(1)

onMounted(async () => {
  if (isElectron.value && (window as any).electron?.ipcRenderer) {
    try {
      monitorCount.value = await (window as any).electron.ipcRenderer.invoke('eventa:invoke:electron:windows:get-monitor-count')
    }
    catch (err) {
      console.warn('Failed to get monitor count:', err)
    }
  }
})

function applySizePreset(
  target: 'actor' | 'chat',
  preset?: string,
  alignment?: string,
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('control-strip:apply-size-preset', {
      detail: {
        target,
        preset,
        monitorIndex: monitorCount.value > 1 ? activeMonitor.value : undefined,
        alignment,
      },
    }))
  }
  if (preset) {
    emit('close')
  }
}

function toggleDatingSimMode() {
  datingSimStore.toggleDatingSim()
}

function selectMonitor(target: 'actor' | 'chat', m: number) {
  activeMonitor.value = m
  applySizePreset(target, undefined, selectedAlignment.value)
}
</script>

<template>
  <StripPopover title="Stage Layout & Presets" header-padding="1.5" @close="emit('close')">
    <!-- Dating Sim Mode Toggle Row -->
    <div class="flex items-center justify-between border border-rose-500/10 rounded-xl bg-rose-500/5 p-2 dark:border-rose-500/20 dark:bg-rose-950/10">
      <div class="flex items-center gap-2">
        <span class="i-solar:heart-bold text-base text-rose-500" :class="{ 'animate-pulse': datingSimStore.enabled }" />
        <span class="text-[11px] text-neutral-700 font-bold dark:text-neutral-300">Dating Sim Mode</span>
      </div>
      <button
        :class="[
          'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all active:scale-95 border cursor-pointer',
          datingSimStore.enabled
            ? 'bg-gradient-to-r from-rose-500 to-fuchsia-600 border-rose-400 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]'
            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200/60 dark:border-neutral-750 text-neutral-500 hover:border-rose-400/40 hover:text-rose-400',
        ]"
        @click="toggleDatingSimMode"
      >
        {{ datingSimStore.enabled ? 'On' : 'Off' }}
      </button>
    </div>

    <!-- Monitor Selection -->
    <div v-if="monitorCount > 1" class="flex items-center justify-between gap-2 rounded-xl bg-neutral-200/30 p-1.5 dark:bg-neutral-800/30">
      <span class="px-1 text-[10px] text-neutral-500 font-bold tracking-wide uppercase">Monitor</span>
      <div class="flex gap-1">
        <button
          v-for="m in monitorCount"
          :key="m"
          :class="[
            'w-6 h-6 flex items-center justify-center text-xs font-semibold rounded-lg transition-all active:scale-95',
            activeMonitor === m
              ? 'bg-sky-500 text-white shadow-sm'
              : 'bg-neutral-50 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="selectMonitor('actor', m)"
        >
          {{ m }}
        </button>
      </div>
    </div>

    <!-- Size Presets horizontal compact list -->
    <div class="grid grid-cols-4 gap-1.5 py-1">
      <button
        v-for="p in PRESETS"
        :key="p.name"
        class="flex flex-col cursor-pointer items-center justify-center gap-1.5 border border-neutral-200/50 rounded-xl bg-neutral-50/50 px-1 py-2.5 text-[11px] text-neutral-700 font-semibold transition-all duration-200 active:scale-95 dark:border-neutral-800/20 hover:border-sky-400/50 dark:bg-neutral-800/40 hover:bg-sky-500/10 dark:text-neutral-300 hover:text-sky-600 dark:hover:bg-sky-500/20 dark:hover:text-sky-300"
        @click="applySizePreset('actor', p.name, presetAlignment)"
      >
        <span :class="[p.icon, 'text-lg']" />
        <span class="text-[10px]">{{ p.label }}</span>
      </button>
    </div>

    <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
    <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
      <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
        <!-- Top-Left -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'top-left'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'top-left'); selectedAlignment = 'top-left'"
        >
          <span class="i-solar:arrow-left-up-linear text-base" />
        </button>

        <!-- Top -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'top'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'top'); selectedAlignment = 'top'"
        >
          <span class="i-solar:arrow-up-linear text-base" />
        </button>

        <!-- Top-Right -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'top-right'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'top-right'); selectedAlignment = 'top-right'"
        >
          <span class="i-solar:arrow-right-up-linear text-base" />
        </button>

        <!-- Left -->
        <button
          :class="[
            'w-8 h-8 flex items-xl items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'left'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'left'); selectedAlignment = 'left'"
        >
          <span class="i-solar:arrow-left-linear text-base" />
        </button>

        <!-- Center -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'center'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'center'); selectedAlignment = 'center'"
        >
          <span class="i-solar:record-linear text-base" />
        </button>

        <!-- Right -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'right'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'right'); selectedAlignment = 'right'"
        >
          <span class="i-solar:arrow-right-linear text-base" />
        </button>

        <!-- Bottom-Left -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'bottom-left'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'bottom-left'); selectedAlignment = 'bottom-left'"
        >
          <span class="i-solar:arrow-left-down-linear text-base" />
        </button>

        <!-- Bottom -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'bottom'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'bottom'); selectedAlignment = 'bottom'"
        >
          <span class="i-solar:arrow-down-linear text-base" />
        </button>

        <!-- Bottom-Right -->
        <button
          :class="[
            'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95',
            selectedAlignment === 'bottom-right'
              ? 'bg-sky-500 text-white border-sky-500'
              : 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400',
          ]"
          @click="applySizePreset('actor', undefined, 'bottom-right'); selectedAlignment = 'bottom-right'"
        >
          <span class="i-solar:arrow-right-down-linear text-base" />
        </button>
      </div>
    </div>
  </StripPopover>
</template>
