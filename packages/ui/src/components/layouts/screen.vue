<script setup lang="ts">
import { useResizeObserver, useWindowSize } from '@vueuse/core'
import { nextTick, onMounted, ref, watch } from 'vue'

const containerRef = ref<HTMLDivElement>()

const { width: windowWidth, height: windowHeight } = useWindowSize()

// Initialize with safe fallback dimensions so children never receive 0
const canvasWidth = ref(typeof window !== 'undefined' ? Math.max(300, window.innerWidth - 16) : 800)
const canvasHeight = ref(typeof window !== 'undefined' ? Math.max(300, window.innerHeight - 100) : 600)

function measureAndSet() {
  if (!containerRef.value)
    return

  const rect = containerRef.value.getBoundingClientRect()
  const parentRect = containerRef.value.parentElement?.getBoundingClientRect()

  const w = rect.width || parentRect?.width || 0
  const h = rect.height || parentRect?.height || 0

  if (w > 0)
    canvasWidth.value = Math.round(w)
  if (h > 0)
    canvasHeight.value = Math.round(h)
}

// Actively track DOM container size changes via native ResizeObserver
// Guarantees updates across CSS transitions, layout reflows, and route switches
useResizeObserver(containerRef, (entries) => {
  const entry = entries[0]
  if (!entry)
    return

  const w = entry.contentRect.width || containerRef.value?.clientWidth || 0
  const h = entry.contentRect.height || containerRef.value?.clientHeight || 0

  if (w > 0)
    canvasWidth.value = Math.round(w)
  if (h > 0)
    canvasHeight.value = Math.round(h)
})

// Also listen to window resize as secondary sync
watch([windowWidth, windowHeight], () => {
  measureAndSet()
})

onMounted(() => {
  measureAndSet()
  nextTick(() => {
    measureAndSet()
    requestAnimationFrame(() => {
      measureAndSet()
    })
  })
})
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full">
    <slot :width="canvasWidth" :height="canvasHeight" />
  </div>
</template>
