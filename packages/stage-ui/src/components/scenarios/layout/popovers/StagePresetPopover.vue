<script setup lang="ts">
import StripPopover from '../StripPopover.vue'
import WindowGeometryPanel from './components/WindowGeometryPanel.vue'

/**
 * Stage layout presets — size, monitor and screen alignment for the actor stage.
 *
 * Geometry state and dispatch live in useControlStripWindowGeometry, shared with
 * the chat preset. What stays here is what makes the stage variant different:
 * the Dating Sim toggle and the icon-card size picker.
 */
import { useControlStripWindowGeometry } from '../../../../composables/use-control-strip-window-geometry'
import { WINDOW_SIZE_PRESETS as PRESETS } from '../../../../constants/control-strip-labels'
import { useDatingSimStore } from '../../../../stores/dating-sim'

const emit = defineEmits<{ close: [] }>()

const datingSimStore = useDatingSimStore()

const {
  monitorCount,
  activeMonitor,
  selectedAlignment,
  presetAlignment,
  applySizePreset,
  selectMonitor,
  applyAlignment,
} = useControlStripWindowGeometry({ onPresetApplied: () => emit('close') })

function toggleDatingSimMode() {
  datingSimStore.toggleDatingSim()
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

    <WindowGeometryPanel
      :monitor-count="monitorCount"
      :active-monitor="activeMonitor"
      :selected-alignment="selectedAlignment"
      @select-monitor="m => selectMonitor('actor', m)"
      @apply-alignment="a => applyAlignment('actor', a)"
    >
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
    </WindowGeometryPanel>
  </StripPopover>
</template>
