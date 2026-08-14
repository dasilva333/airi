<script setup lang="ts">
import { isStageCapacitor } from '@proj-airi/stage-shared'
import { useTheme } from '@proj-airi/ui'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

import { PartAnimatedWave, PatternCross, PatternHearts } from '.'

const { isDark } = useTheme()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = computed(() => {
  if (isStageCapacitor())
    return true
  if (typeof window !== 'undefined' && !(window as any).electron)
    return true
  return breakpoints.smaller('md').value
})
</script>

<template>
  <PatternHearts v-if="isMobile">
    <slot />
  </PatternHearts>
  <PatternCross v-else>
    <PartAnimatedWave
      :fill-color="isDark
        ? 'oklch(35% calc(var(--chromatic-chroma) * 0.6) var(--chromatic-hue))'
        : 'color-mix(in srgb, oklch(95% calc(var(--chromatic-chroma-50) * 0.5) var(--chromatic-hue)) 80%, oklch(100% 0 360))'"
      class="h-full w-full"
    >
      <slot />
    </PartAnimatedWave>
  </PatternCross>
</template>
