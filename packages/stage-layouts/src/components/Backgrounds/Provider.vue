<script setup lang="ts">
import type { BackgroundItem } from '../../stores/background'

import { isStageCapacitor } from '@proj-airi/stage-shared'
import { BackgroundGradientOverlay } from '@proj-airi/stage-ui/components'
import { useBackgroundStore as useStageUiBackgroundStore } from '@proj-airi/stage-ui/stores'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { BackgroundKind } from '../../stores/background'
import { DefaultBackground, PatternHearts } from '../Backgrounds/default'

const props = defineProps<{
  background?: BackgroundItem
  topColor?: string
}>()

const containerRef = ref<HTMLElement | null>(null)

// Connect to Stage-UI background store (where cardStore.activeCard.extensions.airi.modules.activeBackgroundId lives)
const uiBackgroundStore = useStageUiBackgroundStore()
const { activeBackgroundUrl } = storeToRefs(uiBackgroundStore)

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = computed(() => {
  if (isStageCapacitor())
    return true
  if (typeof window !== 'undefined' && !(window as any).electron)
    return true
  return breakpoints.smaller('md').value
})

const effectiveBackgroundSrc = computed(() => {
  if (activeBackgroundUrl.value)
    return activeBackgroundUrl.value
  if (props.background?.kind === BackgroundKind.Image && props.background?.src)
    return props.background.src
  return null
})

const isBlurred = computed(() => {
  return Boolean(props.background?.blur)
})

defineExpose({
  surfaceEl: containerRef,
})
</script>

<template>
  <div ref="containerRef" class="customized-background relative min-h-100dvh w-full overflow-hidden">
    <!-- Background layers -->
    <div
      class="absolute inset-0 z-0 transition-all duration-300"
      :class="[(isBlurred && effectiveBackgroundSrc) ? 'blur-md scale-110' : '']"
    >
      <!-- Custom Background Image (from active card in Settings > Stage Backgrounds) -->
      <template v-if="effectiveBackgroundSrc">
        <img
          :src="effectiveBackgroundSrc"
          class="h-full w-full object-cover transition-opacity duration-500"
          loading="lazy"
          decoding="async"
        >
        <!-- Subtle dark scrim for avatar and UI contrast -->
        <div class="pointer-events-none absolute inset-0 bg-black/10 dark:bg-black/30" />
      </template>

      <!-- Default Background (Wave on desktop, or gradient on mobile) when no custom image -->
      <template v-else>
        <DefaultBackground class="h-full w-full" />
      </template>
    </div>

    <!-- Floating Hearts Layer: Always active on mobile regardless of background picked -->
    <PatternHearts
      v-if="isMobile && effectiveBackgroundSrc"
      :transparent-bg="true"
      class="pointer-events-none absolute inset-0 z-1"
    />

    <!-- Overlay (for custom images only) -->
    <BackgroundGradientOverlay v-if="effectiveBackgroundSrc" :color="topColor" />

    <!-- Content layer (kept mounted during background switches) -->
    <div class="relative z-10 h-full w-full">
      <slot />
    </div>
  </div>
</template>

<style scoped>
</style>
