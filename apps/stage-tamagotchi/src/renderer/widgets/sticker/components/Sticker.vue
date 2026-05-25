<script setup lang="ts">
import { useStickersStore } from '@proj-airi/stage-ui/stores/stickers'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  stickerId: string
  rotation?: number
}>()

const stickersStore = useStickersStore()
const imgUrl = ref<string>('')
const rotationAngle = ref(props.rotation ?? Math.random() * 30 - 15) // Random tilt between -15 and 15 deg
const isFading = ref(false)

let fadeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(async () => {
  const url = await stickersStore.getStickerUrl(props.stickerId)
  if (url) {
    imgUrl.value = url
  }

  // Start fade out at 55s (for 60s total TTL)
  fadeTimer = setTimeout(() => {
    isFading.value = true
  }, 55000)
})

onUnmounted(() => {
  if (fadeTimer) clearTimeout(fadeTimer)
})

function handleClose() {
  window.close()
}

const rotationStyle = computed(() => ({
  transform: `rotate(${rotationAngle.value}deg)`,
}))
</script>

<template>
  <div class="h-full w-full flex items-center justify-center overflow-hidden">
    <div
      :class="[
        'relative group transition-all duration-1000 ease-in-out',
        isFading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100',
      ]"
      :style="rotationStyle"
    >
      <!-- Sticker Image -->
      <div class="relative h-full w-full flex items-center justify-center">
        <img
          v-if="imgUrl"
          :src="imgUrl"
          draggable="false"
          class="sticker-shadow max-h-[110px] max-w-[110px] object-contain drop-shadow-md"
        >
        <div v-else class="size-20 flex animate-pulse items-center justify-center rounded-lg bg-white/10 text-xs text-white/40">
          Loading...
        </div>

        <!-- Close Button (Always visible but subtle, pops on hover) -->
        <button
          class="pointer-events-auto absolute z-50 size-6 flex items-center justify-center border border-white/20 rounded-full bg-red-500/80 text-white opacity-40 shadow-lg transition-all duration-200 -right-3 -top-3 hover:bg-red-600 group-hover:opacity-80 hover:opacity-100"
          title="Close sticker"
          @click.stop="handleClose"
        >
          <div class="i-ph:x-bold size-3" />
        </button>
      </div>

      <!-- Optional: Subtle "White Border" or "Die-cut" look if we want it?
           The user mentioned a 100x100 window and 80px image.
           I'll keep it clean as requested. -->
    </div>
  </div>
</template>

<style scoped>
.sticker-shadow {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

/* Ensure the window content area is transparent */
:deep(body) {
  background: transparent !important;
}
</style>

<route lang="yaml">
meta:
  layout: plain
</route>
