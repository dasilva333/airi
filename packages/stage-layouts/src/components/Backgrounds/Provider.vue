<script setup lang="ts">
import type { BackgroundItem } from '../../stores/background'

import { BackgroundGradientOverlay } from '@proj-airi/stage-ui/components'
import { useBackgroundStore as useStageUiBackgroundStore } from '@proj-airi/stage-ui/stores'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { BackgroundKind } from '../../stores/background'
import { DefaultBackground } from '../Backgrounds/default'
import { resolveAtmosphereComponent } from './patterns'

const props = defineProps<{
  background?: BackgroundItem
  topColor?: string
}>()

const containerRef = ref<HTMLElement | null>(null)

// Connect to Stage-UI background store (where cardStore.activeCard.extensions.airi.modules.activeBackgroundId lives)
const uiBackgroundStore = useStageUiBackgroundStore()
const { activeBackgroundUrl, activeAtmosphereId } = storeToRefs(uiBackgroundStore)

const effectiveBackgroundSrc = computed(() => {
  if (activeBackgroundUrl.value)
    return activeBackgroundUrl.value
  if (props.background?.kind === BackgroundKind.Image && props.background?.src)
    return props.background.src
  return null
})

const activeAtmosphereComponent = computed(() => {
  return resolveAtmosphereComponent(activeAtmosphereId.value)
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
    <!-- Layer 1: Background Wallpaper -->
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

      <!-- Default Background (Wave on desktop, or ambient radial gradient on mobile) when no custom image -->
      <template v-else>
        <DefaultBackground class="h-full w-full" />
      </template>
    </div>

    <!-- Layer 2: Animated Ambient Atmosphere / Stencil Layer (Independent!) -->
    <component
      :is="activeAtmosphereComponent"
      v-if="activeAtmosphereComponent"
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
