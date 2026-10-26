<script setup lang="ts">
import StripPopover from '../StripPopover.vue'
import WindowGeometryPanel from './components/WindowGeometryPanel.vue'

/**
 * Chat layout presets — size, monitor and screen alignment for the chat window.
 *
 * Geometry state and dispatch live in useControlStripWindowGeometry, shared with
 * the stage preset. What stays here is what makes the chat variant different:
 * the compact text size strip (no Dating Sim row).
 */
import { useControlStripWindowGeometry } from '../../../../composables/use-control-strip-window-geometry'
import { WINDOW_SIZE_PRESETS as PRESETS } from '../../../../constants/control-strip-labels'

const emit = defineEmits<{ close: [] }>()

const {
  monitorCount,
  activeMonitor,
  selectedAlignment,
  presetAlignment,
  applySizePreset,
  selectMonitor,
  applyAlignment,
} = useControlStripWindowGeometry({ onPresetApplied: () => emit('close') })
</script>

<template>
  <StripPopover title="Chat Layout" header-padding="1.5" @close="emit('close')">
    <WindowGeometryPanel
      :monitor-count="monitorCount"
      :active-monitor="activeMonitor"
      :selected-alignment="selectedAlignment"
      @select-monitor="m => selectMonitor('chat', m)"
      @apply-alignment="a => applyAlignment('chat', a)"
    >
      <!-- Size Presets Stateless Action Strip -->
      <div class="mx-0.5 my-1 flex border border-neutral-200/20 rounded-xl bg-neutral-200/40 p-0.5 divide-x divide-neutral-200/50 dark:border-neutral-800/30 dark:bg-neutral-900/60 dark:divide-neutral-800/80">
        <button
          v-for="p in PRESETS"
          :key="p.name"
          class="flex-1 cursor-pointer rounded-lg py-1.5 text-center text-[10px] text-neutral-600 font-bold transition-all active:scale-95 hover:bg-white/40 dark:text-neutral-400 hover:text-sky-500 dark:hover:bg-neutral-800/40 dark:hover:text-sky-400"
          @click="applySizePreset('chat', p.name, presetAlignment)"
        >
          {{ p.label === 'Medium' ? 'Med.' : p.label }}
        </button>
      </div>
    </WindowGeometryPanel>
  </StripPopover>
</template>
