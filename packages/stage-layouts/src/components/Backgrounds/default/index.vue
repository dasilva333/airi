<script setup lang="ts">
import { isStageCapacitor } from '@proj-airi/stage-shared'
import { useTheme } from '@proj-airi/ui'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed } from 'vue'

import { PartAnimatedWave, PatternCross } from '.'

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
  <div
    v-if="isMobile"
    class="relative h-full w-full overflow-hidden bg-[#f8fafc] transition-colors duration-300 dark:bg-[#0a0d14]"
  >
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(241,245,249,0.9),rgba(248,250,252,1))] transition-opacity duration-300 dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_40%,rgba(14,24,42,0.8),rgba(10,13,20,1))]"
    />
    <slot />
  </div>
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
