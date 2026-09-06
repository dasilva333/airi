<script setup lang="ts">
import type { DisplayModel, DisplayModelFormat } from '../../../../stores/display-models'

import { useElementSize } from '@vueuse/core'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  models: DisplayModel[]
  activeModelId?: string | null
  isDownloaded: (id: string) => boolean
  isAvailableOnCloud: (id: string) => boolean
  getPreviewSrc: (model: any) => string | undefined
  loadingPreviews: Record<string, boolean>
  downloadingModelId: string | null
  mapFormatRenderer: Record<DisplayModelFormat, string>
}

const props = withDefaults(defineProps<Props>(), {
  activeModelId: null,
})

const emits = defineEmits<{
  (e: 'pick', model: DisplayModel): void
  (e: 'preview', model: DisplayModel): void
  (e: 'downloadAndPick', model: DisplayModel): void
  (e: 'rename', model: DisplayModel): void
  (e: 'groups', model: DisplayModel): void
  (e: 'toggleNsfw', model: DisplayModel): void
  (e: 'refreshPreview', model: DisplayModel): void
  (e: 'removeLocal', model: DisplayModel): void
  (e: 'removeModel', model: DisplayModel): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)

const currentIndex = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragDeltaX = ref(0)
const lastWheelTime = ref(0)

// Synchronize current index when activeModelId changes from outside
watch(
  () => props.activeModelId,
  (newId) => {
    if (!newId || props.models.length === 0)
      return
    const idx = props.models.findIndex(m => m.id === newId)
    if (idx !== -1 && idx !== currentIndex.value) {
      currentIndex.value = idx
    }
  },
  { immediate: true },
)

// Ensure index remains within bounds if models list changes
watch(
  () => props.models.length,
  (len) => {
    if (len === 0) {
      currentIndex.value = 0
      return
    }
    if (currentIndex.value >= len) {
      currentIndex.value = len - 1
    }
    notifyActiveModel()
  },
)

const centerModel = computed(() => {
  if (props.models.length === 0)
    return null
  return props.models[currentIndex.value] ?? null
})

function getFormatBadgeClass(format: DisplayModelFormat): string {
  const renderer = props.mapFormatRenderer[format]
  switch (renderer) {
    case 'Live2D':
      return 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
    case 'VRM':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
    case 'Spine':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
    case 'MMD':
      return 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
    default:
      return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400'
  }
}

function notifyActiveModel() {
  if (centerModel.value) {
    emits('preview', centerModel.value)
  }
}

function normalizeIndex(index: number, total: number): number {
  if (total <= 0)
    return 0
  return ((index % total) + total) % total
}

function prev() {
  if (props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value - 1, props.models.length)
  notifyActiveModel()
}

function next() {
  if (props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value + 1, props.models.length)
  notifyActiveModel()
}

function stepToOffset(offset: number) {
  if (offset === 0)
    return
  if (props.models.length <= 1)
    return
  currentIndex.value = normalizeIndex(currentIndex.value + offset, props.models.length)
  notifyActiveModel()
}

function handleModelClick(model: DisplayModel, offset: number) {
  if (offset !== 0) {
    stepToOffset(offset)
    return
  }

  if (props.downloadingModelId === model.id)
    return

  if (props.isDownloaded(model.id)) {
    emits('pick', model)
  }
  else {
    emits('downloadAndPick', model)
  }
}

// Fallback to 750px before first DOM measurement
const effectiveWidth = computed(() => {
  return containerWidth.value > 0 ? containerWidth.value : 750
})

// Dynamic item capacity: fit 3 on phone, 5 on tablet/narrow, 7 on desktop, 9 on wide desktop
const maxHalfCount = computed(() => {
  const w = effectiveWidth.value
  if (w < 500)
    return 1
  if (w < 780)
    return 2
  if (w < 1100)
    return 3
  return 4
})

const halfCount = computed(() => {
  const total = props.models.length
  if (total <= 1)
    return 0
  const availableHalf = Math.floor((total - 1) / 2)
  return Math.min(maxHalfCount.value, Math.max(1, availableHalf))
})

// Dynamic stepX so the items fill available width across the stage without huge blank margins
const stepX = computed(() => {
  const w = effectiveWidth.value
  const count = halfCount.value
  if (count <= 0)
    return 0
  const targetRatio = w < 500 ? 0.44 : w < 780 ? 0.40 : 0.38
  const ideal = (w * targetRatio) / count
  return Math.round(Math.max(110, Math.min(ideal, 220)))
})

interface VisibleSlot {
  model: DisplayModel
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
    const model = props.models[idx]
    return {
      model,
      offset,
      key: `${model.id}-${offset}`,
    }
  })
})

function getSlotStyle(offset: number) {
  const abs = Math.abs(offset)
  const x = offset * stepX.value + (isDragging.value ? dragDeltaX.value * 0.35 : 0)
  const scale = abs === 0 ? 1.15 : Math.max(0.52, 0.90 - (abs - 1) * 0.12)
  const opacity = abs === 0 ? 1 : Math.max(0.3, 0.85 - (abs - 1) * 0.18)
  const zIndex = 30 - abs * 5

  return {
    transform: `translateX(calc(-50% + ${x}px)) scale(${scale})`,
    left: '50%',
    opacity,
    zIndex,
  }
}

// Drag and gesture handlers
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
    if (delta > 0) {
      next()
    }
    else {
      prev()
    }
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
  else if (e.key === 'Enter' || e.key === ' ') {
    if (centerModel.value) {
      e.preventDefault()
      handleModelClick(centerModel.value, 0)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  notifyActiveModel()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full min-h-[440px] w-full flex flex-col select-none justify-between overflow-hidden outline-none"
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
      class="h-full flex flex-col items-center justify-center gap-3 p-6 text-neutral-400"
    >
      <div class="i-solar:ghost-bold-duotone text-5xl opacity-40" />
      <div class="text-base font-semibold">
        No models found
      </div>
      <div class="text-xs opacity-70">
        Try adjusting your search query or active filters.
      </div>
    </div>

    <!-- Active Stage View -->
    <div v-else class="relative min-h-[440px] w-full flex flex-1 flex-col items-center justify-between pb-2 pt-1">
      <!-- Avatars Stage Canvas -->
      <div class="relative min-h-[370px] w-full flex flex-1 items-center justify-center overflow-visible">
        <!-- Navigation Buttons: Left Chevron -->
        <button
          v-if="models.length > 1"
          type="button"
          class="absolute left-3 top-1/2 z-35 flex items-center justify-center rounded-full bg-white/80 p-2.5 shadow-md backdrop-blur-md transition-all -translate-y-1/2 active:scale-95 hover:scale-110 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700"
          aria-label="Previous Model"
          @click.stop="prev"
        >
          <div class="i-solar:alt-arrow-left-bold text-lg text-neutral-700 dark:text-neutral-200" />
        </button>

        <!-- Navigation Buttons: Right Chevron -->
        <button
          v-if="models.length > 1"
          type="button"
          class="absolute right-3 top-1/2 z-35 flex items-center justify-center rounded-full bg-white/80 p-2.5 shadow-md backdrop-blur-md transition-all -translate-y-1/2 active:scale-95 hover:scale-110 dark:bg-neutral-800/80 hover:bg-white dark:hover:bg-neutral-700"
          aria-label="Next Model"
          @click.stop="next"
        >
          <div class="i-solar:alt-arrow-right-bold text-lg text-neutral-700 dark:text-neutral-200" />
        </button>

        <!-- Dynamic Avatar Cards Layer -->
        <div class="relative h-full min-h-[370px] w-full flex items-center justify-center">
          <div
            v-for="slot in visibleSlots"
            :key="slot.key"
            class="absolute bottom-12 flex flex-col cursor-pointer items-center ease-out"
            :class="[
              isDragging ? 'transition-none' : 'transition-all duration-300',
            ]"
            :style="getSlotStyle(slot.offset)"
            @click.stop="handleModelClick(slot.model, slot.offset)"
          >
            <!-- Avatar Silhouette Box -->
            <div
              class="relative h-[45vh] max-h-[480px] min-h-[300px] w-52 flex flex-col items-center justify-end md:w-68 sm:w-60"
              :class="[
                slot.offset === 0 ? 'hover:scale-102 transition-transform duration-200 cursor-pointer' : '',
              ]"
            >
              <!-- Soft Contact Shadow Oval Anchored Under Feet -->
              <div
                class="pointer-events-none absolute h-3.5 w-3/4 rounded-full blur-[3px] -bottom-1"
                :style="{
                  background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0) 70%)',
                }"
              />

              <!-- Model Image / Placeholder -->
              <img
                v-if="getPreviewSrc(slot.model)"
                :src="getPreviewSrc(slot.model)"
                class="pointer-events-none max-h-full max-w-full select-none object-contain drop-shadow-md filter transition-transform duration-300"
                loading="lazy"
              >
              <div
                v-else
                class="h-56 w-44 flex flex-col items-center justify-center gap-2 rounded-2xl bg-neutral-100/70 p-4 backdrop-blur-sm dark:bg-neutral-800/70"
              >
                <div v-if="loadingPreviews[slot.model.id]" class="i-solar:refresh-bold animate-spin text-4xl opacity-50" />
                <div v-else class="i-solar:user-bold-duotone text-5xl opacity-30" />
                <div class="line-clamp-2 text-center text-xs font-semibold opacity-60">
                  {{ slot.model.name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Floating Hero Caption Pill Anchored at Center Model's Feet (Click to pick) -->
      <div v-if="centerModel" class="absolute bottom-2 left-1/2 z-40 flex flex-col items-center -translate-x-1/2">
        <div
          class="flex cursor-pointer items-center gap-2.5 border border-neutral-200/80 rounded-full bg-white/95 px-4 py-1.5 shadow-lg backdrop-blur-md transition-all active:scale-98 dark:border-neutral-700/80 hover:border-primary-500/60 dark:bg-neutral-800/95"
          title="Click to select this model"
          @click.stop="handleModelClick(centerModel, 0)"
        >
          <!-- Downloading Spinner -->
          <div v-if="downloadingModelId === centerModel.id" class="i-solar:refresh-bold animate-spin text-xs text-primary-500" />

          <!-- Local vs Cloud Badge -->
          <span
            v-if="isDownloaded(centerModel.id)"
            class="rounded bg-green-500/10 px-1.5 py-0.5 text-[9px] text-green-500 font-bold tracking-wider uppercase"
          >Local</span>
          <span
            v-else
            class="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-500 font-bold tracking-wider uppercase"
          >Cloud</span>

          <!-- Format Badge -->
          <span
            :class="[
              'rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase',
              getFormatBadgeClass(centerModel.format),
            ]"
          >
            {{ mapFormatRenderer[centerModel.format as DisplayModelFormat] }}
          </span>

          <!-- NSFW Badge -->
          <span
            v-if="centerModel.nsfw"
            class="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-500 font-bold tracking-wider uppercase"
          >NSFW</span>

          <span class="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />

          <!-- Name -->
          <span
            class="max-w-[170px] truncate text-sm text-neutral-900 font-bold sm:max-w-[280px] dark:text-neutral-100"
            :title="centerModel.name"
          >
            {{ centerModel.name }}
          </span>

          <!-- Options Menu Dropdown (...) -->
          <div v-if="isDownloaded(centerModel.id)" class="ml-1 flex items-center">
            <DropdownMenuRoot>
              <DropdownMenuTrigger
                class="flex items-center justify-center rounded-full p-1 text-neutral-500 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Options for Display Models"
                @click.stop
              >
                <div class="i-solar:menu-dots-bold text-sm" />
              </DropdownMenuTrigger>
              <DropdownMenuPortal>
                <DropdownMenuContent
                  class="will-change-[opacity,transform] z-[10010] max-w-45 border border-white/10 rounded-xl bg-neutral-900/90 p-1 text-white shadow-2xl outline-none backdrop-blur-xl data-[side=bottom]:animate-slideUpAndFade data-[side=left]:animate-slideRightAndFade data-[side=right]:animate-slideLeftAndFade data-[side=top]:animate-slideDownAndFade dark:border-black/10 dark:bg-neutral-100/90 dark:text-black"
                  align="start"
                  side="top"
                  :side-offset="6"
                >
                  <DropdownMenuItem
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm leading-none outline-none data-[highlighted]:bg-white/10 dark:data-[highlighted]:bg-black/10"
                    @click="emits('rename', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="i-solar:pen-bold" />
                      <div>Rename</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm leading-none outline-none data-[highlighted]:bg-white/10 dark:data-[highlighted]:bg-black/10"
                    @click="emits('groups', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="i-solar:folder-bold" />
                      <div>Groups</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm leading-none outline-none data-[highlighted]:bg-white/10 dark:data-[highlighted]:bg-black/10"
                    @click="emits('toggleNsfw', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div :class="centerModel.nsfw ? 'i-solar:eye-closed-bold' : 'i-solar:eye-bold'" />
                      <div>{{ centerModel.nsfw ? 'Mark as SFW' : 'Mark as NSFW' }}</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm leading-none outline-none data-[highlighted]:bg-white/10 dark:data-[highlighted]:bg-black/10"
                    @click="emits('refreshPreview', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="i-solar:refresh-bold" />
                      <div>Refresh Thumbnail</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="isAvailableOnCloud(centerModel.id)"
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm leading-none outline-none data-[highlighted]:bg-white/10 dark:data-[highlighted]:bg-black/10"
                    @click="emits('removeLocal', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="i-solar:cloud-download-bold" />
                      <div>Remove Local Copy</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    class="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm text-red-400 font-semibold leading-none outline-none data-[highlighted]:bg-red-500/20"
                    @click="emits('removeModel', centerModel!)"
                  >
                    <div class="flex items-center gap-2">
                      <div class="i-solar:trash-bin-minimalistic-bold-duotone" />
                      <div>{{ isAvailableOnCloud(centerModel.id) ? 'Delete Everywhere' : 'Remove' }}</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
