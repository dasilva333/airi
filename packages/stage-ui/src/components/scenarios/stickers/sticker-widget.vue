<script setup lang="ts">
import { useDraggable } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useStickersStore } from '../../../stores/stickers'

const props = defineProps<{
  instanceId: string
  stickerId: string
  initialX: number
  initialY: number
  rotation: number
  expiresAt?: number
}>()

const stickersStore = useStickersStore()
const imgUrl = ref<string>('')
const el = ref<HTMLElement | null>(null)

// Calculate if near expiration (last 5 seconds)
const now = ref(Date.now())
let interval: any
onMounted(() => {
  if (props.expiresAt) {
    interval = setInterval(() => {
      now.value = Date.now()
    }, 500)
  }
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})

const isExpiring = computed(() => {
  if (!props.expiresAt) return false
  return props.expiresAt - now.value < 5000
})

// Current rotation state, handles the "wiggle" on hover
const currentRotation = ref(props.rotation)
const isHovered = ref(false)

const { style } = useDraggable(el, {
  initialValue: { x: props.initialX, y: props.initialY },
  onMove: (pos) => {
    stickersStore.updatePlacement(props.instanceId, { x: pos.x, y: pos.y })
  },
})

onMounted(async () => {
  const url = await stickersStore.getStickerUrl(props.stickerId)
  if (url) {
    imgUrl.value = url
  }
})

const rotationStyle = computed(() => {
  const angle = isHovered.value ? currentRotation.value + (Math.random() > 0.5 ? 4 : -4) : currentRotation.value
  return {
    transform: `rotate(${angle}deg)`,
  }
})

function handleDelete() {
  stickersStore.removePlacement(props.instanceId)
}

function handleMouseEnter() {
  isHovered.value = true
}

function handleMouseLeave() {
  isHovered.value = false
}
</script>

<template>
  <Transition
    appear
    enter-active-class="transition duration-500 ease-out"
    enter-from-class="opacity-0 scale-50 rotate-[-20deg]"
    leave-active-class="transition duration-500 ease-in"
    leave-to-class="opacity-0 scale-50 rotate-[20deg]"
  >
    <div
      ref="el"
      :style="[style, rotationStyle]"
      :class="[
        'fixed z-50 pointer-events-auto cursor-grab active:cursor-grabbing',
        'group transition-all duration-500 ease-out',
        isExpiring ? 'opacity-40 scale-95 blur-[1px]' : 'opacity-100',
      ]"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    >
      <!-- The "Post-it" Stack Frame -->
      <div
        :class="[
          'relative p-3 min-w-32 min-h-32 flex items-center justify-center',
          // Kawaii Yellow Post-it aesthetic with stack layers
          // NOTICE: Temporarily disabled frame via false flag as requested.
          false ? 'bg-[#fff799] dark:bg-[#e6db5e] shadow-[2px_2px_5px_rgba(0,0,0,0.1),4px_4px_0px_-1px_#fffde7,4px_4px_5px_rgba(0,0,0,0.1),8px_8px_0px_-2px_#ffff8d,8px_8px_10px_rgba(0,0,0,0.1)]' : '',
          false ? 'rounded-sm' : '',
        ]"
      >
        <img
          v-if="imgUrl"
          :src="imgUrl"
          draggable="false"
          class="max-h-24 max-w-24 object-contain"
        >

        <!-- Delete Button (Only on hover) -->
        <button
          class="absolute size-5 flex items-center justify-center border border-white/20 rounded-full bg-red-400 text-white opacity-0 shadow-sm transition-opacity duration-200 -right-2 -top-2 hover:bg-red-500 group-hover:opacity-100"
          @click.stop="handleDelete"
        >
          <div class="i-ph:x-bold size-3" />
        </button>

        <!-- Kawaii tape or pin decoration?
           Maybe a subtle highlight on the top left. -->
        <div class="pointer-events-none absolute left-0 top-0 h-1 w-full bg-white/20" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Ensure stickers don't block everything but are interactive */
</style>
