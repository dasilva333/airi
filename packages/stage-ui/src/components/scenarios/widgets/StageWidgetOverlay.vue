<script setup lang="ts">
import type { StageWidgetInstance } from '../../../stores/stage-widgets'

import { useDraggable } from '@vueuse/core'
import { ref } from 'vue'

import { useBackgroundStore } from '../../../stores/background'
import { useStageWidgetsStore } from '../../../stores/stage-widgets'

const props = defineProps<{
  widget: StageWidgetInstance
}>()

const stageWidgetsStore = useStageWidgetsStore()
const backgroundStore = useBackgroundStore()

const el = ref<HTMLElement | null>(null)

const { style } = useDraggable(el, {
  initialValue: { x: props.widget.x, y: props.widget.y },
  onMove: (pos) => {
    stageWidgetsStore.updateWidgetPosition(props.widget.id, { x: pos.x, y: pos.y })
  },
})

function handleDismiss() {
  stageWidgetsStore.removeWidget(props.widget.id)
}

function handleApplyAsBackground() {
  if (props.widget.entryId) {
    backgroundStore.setActiveBackground(props.widget.entryId)
  }
  else if (props.widget.imageUrl) {
    backgroundStore.setActiveBackground(props.widget.imageUrl)
  }
}
</script>

<template>
  <div
    ref="el"
    :style="style"
    class="pointer-events-auto fixed z-50 w-64 flex flex-col select-none border border-white/25 rounded-2xl bg-white/90 p-2 shadow-2xl backdrop-blur-xl transition-shadow dark:border-neutral-800/80 dark:bg-neutral-900/90"
  >
    <!-- Header Bar / Drag Handle -->
    <div class="mb-1.5 flex cursor-grab items-center justify-between px-1 active:cursor-grabbing">
      <div class="min-w-0 flex items-center gap-1.5">
        <span class="i-solar:gallery-bold-duotone shrink-0 text-xs text-amber-500" />
        <span class="truncate text-[11px] text-neutral-700 font-bold dark:text-neutral-200">
          {{ widget.title || 'Scene Artwork' }}
        </span>
      </div>
      <button
        class="flex cursor-pointer items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        title="Close widget"
        @click.stop="handleDismiss"
      >
        <span class="i-solar:close-circle-linear text-sm" />
      </button>
    </div>

    <!-- Thumbnail Image -->
    <div class="group relative aspect-video w-full overflow-hidden border border-neutral-200/50 rounded-xl bg-neutral-100 dark:border-neutral-800/50 dark:bg-neutral-800">
      <img
        :src="widget.imageUrl"
        :alt="widget.title"
        class="h-full w-full object-cover"
        draggable="false"
      >
      <!-- Quick Prompt Tooltip / Overlay on Hover -->
      <div
        v-if="widget.prompt"
        class="absolute inset-x-0 bottom-0 max-h-12 overflow-y-auto from-black/80 via-black/50 to-transparent bg-gradient-to-t p-1.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        {{ widget.prompt }}
      </div>
    </div>

    <!-- Action Bar -->
    <div class="mt-1.5 flex items-center justify-between gap-1 pt-1">
      <button
        class="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600 font-semibold transition hover:bg-amber-500/20 dark:text-amber-400"
        title="Set as Stage Wallpaper"
        @click.stop="handleApplyAsBackground"
      >
        <span class="i-solar:wallpaper-bold-duotone text-xs" />
        <span>Set as Stage</span>
      </button>

      <button
        class="flex cursor-pointer items-center justify-center rounded-lg px-2 py-1 text-[10px] text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        title="Dismiss"
        @click.stop="handleDismiss"
      >
        <span>Dismiss</span>
      </button>
    </div>
  </div>
</template>
