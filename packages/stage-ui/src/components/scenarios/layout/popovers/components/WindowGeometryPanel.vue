<script setup lang="ts">
/**
 * Monitor picker + 9-way alignment grid shared by the stage and chat preset
 * popovers.
 *
 * The size-preset section sits between them, so it comes through the default
 * slot rather than being duplicated here — the two popovers present sizes
 * differently (icon cards vs a compact text strip) and that difference is
 * deliberate.
 */
defineProps<{
  monitorCount: number
  activeMonitor: number
  selectedAlignment: string
}>()

const emit = defineEmits<{
  selectMonitor: [monitor: number]
  applyAlignment: [alignment: string]
}>()

/** Clockwise from top-left, matching the on-screen grid order. */
const ALIGNMENTS = [
  { key: 'top-left', icon: 'i-solar:arrow-left-up-linear' },
  { key: 'top', icon: 'i-solar:arrow-up-linear' },
  { key: 'top-right', icon: 'i-solar:arrow-right-up-linear' },
  { key: 'left', icon: 'i-solar:arrow-left-linear' },
  { key: 'center', icon: 'i-solar:record-linear' },
  { key: 'right', icon: 'i-solar:arrow-right-linear' },
  { key: 'bottom-left', icon: 'i-solar:arrow-left-down-linear' },
  { key: 'bottom', icon: 'i-solar:arrow-down-linear' },
  { key: 'bottom-right', icon: 'i-solar:arrow-right-down-linear' },
] as const

const ALIGNMENT_BASE = 'w-8 h-8 flex items-center justify-center rounded-xl border text-base transition-all active:scale-95'
const ALIGNMENT_SELECTED = 'bg-sky-500 text-white border-sky-500'
const ALIGNMENT_IDLE = 'border-neutral-200/50 dark:border-neutral-700/50 hover:bg-sky-500/10 hover:text-sky-500 dark:hover:bg-sky-500/20 dark:hover:text-sky-300 text-neutral-600 dark:text-neutral-400'
</script>

<template>
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
        @click="emit('selectMonitor', m)"
      >
        {{ m }}
      </button>
    </div>
  </div>

  <slot />

  <!-- Symmetrical Alignment Grid mockup (9-button layout) -->
  <div class="flex flex-col items-center gap-1.5 border-t border-neutral-200 pt-2 dark:border-neutral-800">
    <div class="grid grid-cols-3 mx-auto h-26 w-26 gap-1.5">
      <button
        v-for="alignment in ALIGNMENTS"
        :key="alignment.key"
        :class="[
          ALIGNMENT_BASE,
          selectedAlignment === alignment.key ? ALIGNMENT_SELECTED : ALIGNMENT_IDLE,
        ]"
        @click="emit('applyAlignment', alignment.key)"
      >
        <span :class="[alignment.icon, 'text-base']" />
      </button>
    </div>
  </div>
</template>
