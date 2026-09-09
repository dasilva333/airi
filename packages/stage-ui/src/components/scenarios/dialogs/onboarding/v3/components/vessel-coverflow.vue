<script setup lang="ts">
import type { CSSProperties } from 'vue'

import { useElementSize } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

export interface UnifiedVesselItem {
  id: string
  name: string
  format: 'live2d' | 'vrm' | 'spine' | 'mmd'
  formatLabel?: string
  previewUrl: string
  isInstalled: boolean
  author?: string
  sourceSiteName?: string
  sourceSiteUrl?: string
  downloadUrl?: string
  description?: string
  prompt: string
}

const props = defineProps<{
  models: UnifiedVesselItem[]
  modelValue?: string
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', id: string): void
  (e: 'select', model: UnifiedVesselItem): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

const currentIndex = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragDeltaX = ref(0)
const lastWheelTime = ref(0)
const failedImages = ref<Record<string, boolean>>({})

// Container width fallback
const effectiveWidth = computed(() => {
  return containerWidth.value > 0 ? containerWidth.value : 750
})

// Dynamic capacity based on width
const maxHalfCount = computed(() => {
  const w = effectiveWidth.value
  if (w < 500)
    return 1
  if (w < 800)
    return 2
  return 3
})

const halfCount = computed(() => {
  const total = props.models.length
  if (total <= 1)
    return 0
  const availableHalf = Math.floor((total - 1) / 2)
  return Math.min(maxHalfCount.value, Math.max(1, availableHalf))
})

const stepX = computed(() => {
  const w = effectiveWidth.value
  const count = halfCount.value
  if (count <= 0)
    return 0
  const targetRatio = w < 500 ? 0.44 : w < 800 ? 0.38 : 0.32
  const ideal = (w * targetRatio) / count
  return Math.round(Math.max(110, Math.min(ideal, 200)))
})

const centerModel = computed<UnifiedVesselItem | null>(() => {
  if (props.models.length === 0)
    return null
  return props.models[currentIndex.value] ?? null
})

// Sync active modelValue with currentIndex
watch(
  () => props.models,
  (newModels) => {
    if (newModels.length === 0) {
      currentIndex.value = 0
      return
    }
    const foundIdx = newModels.findIndex(m => m.id === props.modelValue)
    if (foundIdx !== -1) {
      currentIndex.value = foundIdx
    }
    else {
      currentIndex.value = 0
      const first = newModels[0]
      if (first) {
        emits('update:modelValue', first.id)
        emits('select', first)
      }
    }
  },
  { immediate: true },
)

watch(
  currentIndex,
  (idx) => {
    const model = props.models[idx]
    if (model) {
      emits('update:modelValue', model.id)
      emits('select', model)
    }
  },
)

watch(
  () => props.modelValue,
  (id) => {
    if (!id || props.models.length === 0)
      return
    const idx = props.models.findIndex(m => m.id === id)
    if (idx !== -1 && idx !== currentIndex.value) {
      currentIndex.value = idx
    }
  },
)

function normalizeIndex(index: number, total: number): number {
  if (total <= 0)
    return 0
  return ((index % total) + total) % total
}

function prev() {
  if (props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value - 1, props.models.length)
}

function next() {
  if (props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value + 1, props.models.length)
}

function stepToOffset(offset: number) {
  if (offset === 0 || props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value + offset, props.models.length)
}

interface VisibleSlot {
  model: UnifiedVesselItem
  offset: number
  key: string
}

const visibleSlots = computed<VisibleSlot[]>(() => {
  const total = props.models.length
  if (total === 0)
    return []

  const count = halfCount.value
  const offsets: number[] = []
  for (let i = -count; i <= count; i++) {
    offsets.push(i)
  }

  return offsets.map((offset) => {
    const idx = normalizeIndex(currentIndex.value + offset, total)
    const model = props.models[idx]!
    return {
      model,
      offset,
      key: `${model.id}-${offset}`,
    }
  })
})

function getSlotStyle(offset: number): CSSProperties {
  const abs = Math.abs(offset)
  const x = offset * stepX.value + (isDragging.value ? dragDeltaX.value * 0.35 : 0)
  const scale = abs === 0 ? 1.08 : Math.max(0.55, 0.88 - (abs - 1) * 0.14)
  const opacity = abs === 0 ? 1 : Math.max(0.35, 0.78 - (abs - 1) * 0.20)
  const zIndex = 30 - abs * 5

  return {
    transform: `translateX(calc(-50% + ${x}px)) scale(${scale})`,
    left: '50%',
    opacity,
    zIndex,
  }
}

// Drag & Wheel Gestures
function onPointerDown(e: PointerEvent) {
  if (props.models.length <= 1)
    return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragDeltaX.value = 0
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value)
    return
  dragDeltaX.value = e.clientX - dragStartX.value
}

function onPointerUp() {
  if (!isDragging.value)
    return
  isDragging.value = false
  const threshold = 35
  if (dragDeltaX.value > threshold) {
    prev()
  }
  else if (dragDeltaX.value < -threshold) {
    next()
  }
  dragDeltaX.value = 0
}

function onWheel(e: WheelEvent) {
  if (props.models.length <= 1)
    return
  const now = Date.now()
  if (now - lastWheelTime.value < 220)
    return

  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (Math.abs(delta) > 18) {
    lastWheelTime.value = now
    if (delta > 0)
      next()
    else
      prev()
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  }
  else if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  }
}

function handleModelClick(model: UnifiedVesselItem, offset: number) {
  if (offset !== 0) {
    stepToOffset(offset)
  }
  else {
    emits('select', model)
  }
}

function onImageError(modelId: string) {
  failedImages.value[modelId] = true
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-[280px] w-full flex flex-col select-none justify-between overflow-hidden outline-none sm:h-[310px]"
    tabindex="0"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel.passive="onWheel"
  >
    <!-- Empty State -->
    <div
      v-if="models.length === 0"
      class="h-full flex flex-col items-center justify-center gap-2 p-6 text-neutral-400"
    >
      <div class="i-solar:ghost-bold-duotone text-4xl opacity-40" />
      <div class="text-xs font-semibold">
        No avatars match your active filter
      </div>
    </div>

    <!-- Active Coverflow Stage -->
    <div v-else class="relative h-full w-full flex flex-1 items-center justify-center overflow-visible">
      <!-- Left Chevron Button -->
      <button
        v-if="models.length > 1"
        type="button"
        class="absolute left-2 top-1/2 z-35 flex cursor-pointer items-center justify-center border border-neutral-200/80 rounded-full bg-white/90 p-2 shadow-md backdrop-blur-md transition-all -translate-y-1/2 active:scale-95 hover:scale-110 dark:border-neutral-700/80 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-700"
        aria-label="Previous Model"
        @click.stop="prev"
      >
        <div class="i-solar:alt-arrow-left-bold text-sm text-neutral-700 dark:text-neutral-200" />
      </button>

      <!-- Right Chevron Button -->
      <button
        v-if="models.length > 1"
        type="button"
        class="absolute right-2 top-1/2 z-35 flex cursor-pointer items-center justify-center border border-neutral-200/80 rounded-full bg-white/90 p-2 shadow-md backdrop-blur-md transition-all -translate-y-1/2 active:scale-95 hover:scale-110 dark:border-neutral-700/80 dark:bg-neutral-800/90 hover:bg-white dark:hover:bg-neutral-700"
        aria-label="Next Model"
        @click.stop="next"
      >
        <div class="i-solar:alt-arrow-right-bold text-sm text-neutral-700 dark:text-neutral-200" />
      </button>

      <!-- Model Cutout Figures Layer (No surrounding cards, pure avatars!) -->
      <div class="relative h-full w-full flex items-center justify-center">
        <div
          v-for="slot in visibleSlots"
          :key="slot.key"
          class="absolute bottom-8 flex flex-col cursor-pointer items-center ease-out"
          :class="[
            isDragging ? 'transition-none' : 'transition-all duration-300',
          ]"
          :style="getSlotStyle(slot.offset)"
          @click.stop="handleModelClick(slot.model, slot.offset)"
        >
          <!-- Avatar Silhouette Container -->
          <div
            class="relative h-[230px] w-40 flex flex-col items-center justify-end sm:h-[260px] sm:w-48"
            :class="[
              slot.offset === 0 ? 'hover:scale-102 transition-transform duration-200 cursor-pointer' : '',
            ]"
          >
            <!-- Soft Contact Shadow Under Feet -->
            <div
              class="pointer-events-none absolute h-3.5 w-3/4 rounded-full blur-[4px] -bottom-1"
              :style="{
                background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.40) 0%, rgba(0, 0, 0, 0) 70%)',
              }"
            />

            <!-- Pure Avatar Image (No card background!) -->
            <img
              v-if="slot.model.previewUrl && !failedImages[slot.model.id]"
              :src="slot.model.previewUrl"
              :alt="slot.model.name"
              class="pointer-events-none max-h-full max-w-full select-none object-contain drop-shadow-md filter transition-transform duration-300"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="onImageError(slot.model.id)"
            >

            <!-- Fallback Icon if Image Missing -->
            <div
              v-else
              class="h-44 w-36 flex flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-100/80 p-3 shadow-sm backdrop-blur-sm dark:bg-neutral-800/80"
            >
              <div class="i-solar:user-bold-duotone text-4xl text-neutral-400 opacity-40" />
              <div class="line-clamp-2 text-center text-xs text-neutral-700 font-bold dark:text-neutral-200">
                {{ slot.model.name }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Hero Caption Pill Anchored at Center Model's Feet -->
      <div
        v-if="centerModel"
        class="absolute bottom-1 left-1/2 z-40 flex items-center gap-2 border border-neutral-200/80 rounded-full bg-white/95 px-3.5 py-1 shadow-lg backdrop-blur-md transition-all -translate-x-1/2 dark:border-neutral-800 dark:bg-neutral-900/95"
      >
        <span
          :class="[
            'rounded px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase',
            centerModel.isInstalled
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
          ]"
        >
          {{ centerModel.isInstalled ? 'Local' : 'Community' }}
        </span>

        <span
          :class="[
            'rounded px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase',
            centerModel.format === 'live2d'
              ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
              : centerModel.format === 'vrm'
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                : 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
          ]"
        >
          {{ centerModel.formatLabel || centerModel.format.toUpperCase() }}
        </span>

        <span class="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />

        <span class="max-w-[200px] truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
          {{ centerModel.name }}
        </span>
      </div>
    </div>
  </div>
</template>
