<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

const props = withDefaults(defineProps<{
  /** Tooltip for the main button */
  title?: string
  variant?: 'default' | 'mobile'
}>(), {
  variant: 'default',
})

const emit = defineEmits<{
  (e: 'attach'): void
  (e: 'screenshot'): void
}>()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <!-- Mobile trigger -->
      <button
        v-if="variant === 'mobile'"
        class="w-fit flex items-center justify-center border-2 border-neutral-100/60 rounded-xl border-solid bg-neutral-50/70 p-2 backdrop-blur-md transition-all active:scale-95 dark:border-neutral-800/30 dark:bg-neutral-800/70"
        :title="title || 'Attach Image'"
      >
        <div class="i-solar:gallery-add-bold-duotone size-5 text-neutral-500 dark:text-neutral-400" />
      </button>

      <!-- Default (composer inline) trigger -->
      <button
        v-else
        class="h-8 w-8 flex items-center justify-center rounded-xl bg-neutral-200/20 text-neutral-500 transition-all duration-200 active:scale-95 dark:bg-neutral-800/20 hover:bg-neutral-200/40 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-800/40 dark:hover:text-neutral-200"
        :title="title || 'Attach Image'"
      >
        <div class="i-solar:gallery-add-bold text-base" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="start"
        class="animate-in fade-in zoom-in z-100 w-64 border border-neutral-200/50 rounded-2xl bg-white/90 p-3 shadow-2xl backdrop-blur-xl duration-200 dark:border-neutral-700/50 dark:bg-neutral-900/90"
      >
        <!-- Header -->
        <div class="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2 dark:border-neutral-800">
          <span class="text-xs text-neutral-400 font-bold tracking-wider uppercase">Attach Image</span>
          <div class="i-solar:gallery-add-bold-duotone text-xs text-primary-500" />
        </div>

        <!-- Take Screenshot -->
        <button
          class="mb-2 w-full flex items-center gap-3 rounded-xl bg-primary-50/50 p-2.5 text-left transition-all dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-800/30"
          @click="emit('screenshot')"
        >
          <div class="i-solar:monitor-camera-bold-duotone text-lg text-primary-600 dark:text-primary-400" />
          <div class="flex flex-col">
            <span class="text-[13px] text-primary-900 font-semibold leading-none dark:text-primary-100">Take Screenshot</span>
            <span class="mt-1 text-[10px] text-primary-600/70 dark:text-primary-400/70">Capture and attach screen</span>
          </div>
        </button>

        <!-- Attach Image -->
        <button
          class="w-full flex items-center gap-3 rounded-xl bg-neutral-50/50 p-2.5 text-left transition-all dark:bg-neutral-800/20 hover:bg-neutral-100 dark:hover:bg-neutral-800/30"
          @click="emit('attach')"
        >
          <div class="i-solar:camera-add-bold-duotone text-lg text-neutral-600 dark:text-neutral-400" />
          <div class="flex flex-col">
            <span class="text-[13px] text-neutral-900 font-semibold leading-none dark:text-neutral-100">Attach Image</span>
            <span class="mt-1 text-[10px] text-neutral-600/70 dark:text-neutral-400/70">Upload from your computer</span>
          </div>
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
