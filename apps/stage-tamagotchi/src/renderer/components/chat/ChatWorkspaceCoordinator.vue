<script setup lang="ts">
import { CharacterAvatar } from '@proj-airi/stage-ui/components'

withDefaults(
  defineProps<{
    characterName?: string
    cardId?: string
    surfaceLabel: string
    surfaceIcon: string
    progress: number
    statusText: string
  }>(),
  {
    characterName: 'AIRI',
    cardId: '',
    progress: 10,
    statusText: 'Connecting to workspace...',
  },
)
</script>

<template>
  <div class="h-full w-full flex flex-col select-none items-center justify-center bg-transparent p-6">
    <div
      :class="[
        'relative flex flex-col items-center justify-center gap-5 p-8 max-w-sm w-full rounded-2xl text-center transition-all duration-500',
        'border border-neutral-200/80 bg-white/75 shadow-xl backdrop-blur-md',
        'dark:border-neutral-800/80 dark:bg-neutral-900/75',
      ]"
    >
      <!-- Character Avatar with ambient pulse halo -->
      <div class="relative">
        <div class="absolute animate-pulse rounded-full bg-primary-500/20 blur-sm -inset-2" />
        <div class="relative h-16 w-16 flex items-center justify-center overflow-hidden border-2 border-primary-500/30 rounded-full bg-primary-500/10 shadow-sm">
          <CharacterAvatar
            v-if="cardId"
            :card-id="cardId"
            :name="characterName || 'AIRI'"
            shape="circle"
            size-class="h-16 w-16"
          />
          <div
            v-else
            class="i-solar:user-bold-duotone text-3xl text-primary-500"
          />
        </div>
      </div>

      <!-- Character Name & Target Workspace Pill -->
      <div class="flex flex-col items-center gap-1.5">
        <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
          {{ characterName || 'AIRI' }}
        </h3>
        <div
          class="flex items-center gap-1.5 rounded-full bg-primary-500/10 px-3 py-1 text-xs text-primary-600 font-semibold dark:bg-primary-500/15 dark:text-primary-400"
        >
          <div :class="[surfaceIcon, 'text-sm']" />
          <span>{{ surfaceLabel }}</span>
        </div>
      </div>

      <!-- Progress Bar & Status Text -->
      <div class="mt-1 w-full flex flex-col items-center gap-2">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800">
          <div
            class="h-full rounded-full from-primary-500 to-primary-400 bg-gradient-to-r transition-all duration-300 ease-out"
            :style="{ width: `${Math.min(100, Math.max(8, progress))}%` }"
          />
        </div>
        <div class="max-w-full min-h-[20px] flex items-center justify-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <span class="i-svg-spinners:ring-resize shrink-0 text-xs text-primary-500" />
          <span class="truncate">{{ statusText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
