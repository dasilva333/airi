<script setup lang="ts">
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { computed, ref, watch } from 'vue'

import {
  colorCache,
  extractComplementaryColors,
  extractModelIcon,
  getLatestSelfie,
  iconCache,
} from '../../libs/character-media-resolver'

const props = withDefaults(defineProps<{
  cardId: string
  name: string
  displayModelId?: string
  shape?: 'square' | 'rounded' | 'circle'
  sizeClass?: string
  avatarClass?: string
  showBadge?: boolean
  isActive?: boolean
  useDynamicBackground?: boolean
}>(), {
  shape: 'circle',
  sizeClass: 'h-8 w-8',
  avatarClass: 'h-full w-full object-cover',
  showBadge: false,
  isActive: false,
  useDynamicBackground: true,
})

const displayModelsStore = useDisplayModelsStore()
const dynamicBackground = ref<{ light: string, dark: string } | null>(null)
const lazyExtractedIcon = ref<string | null>(null)

// 1. User's intent (Custom stage selfie)
const latestSelfie = computed(() => getLatestSelfie(props.cardId))

// 2. In-memory model metadata (0ms synchronous lookup)
const displayModel = computed(() => {
  if (!props.displayModelId)
    return null
  return displayModelsStore.displayModels.find(m => m.id === props.displayModelId) || null
})

// 3. Priority Chain:
// Tier 1: User Selfie
// Tier 2: Author Icon (authorIcon from zip or cached icon)
// Tier 3: Engine 3D Canvas Snapshot (previewImage)
// Tier 4: Initial Letter
const portraitInfo = computed(() => {
  if (latestSelfie.value)
    return { url: latestSelfie.value, source: 'selfie' }

  const model = displayModel.value
  if (!model)
    return { url: null, source: null }

  // Check model authorIcon from metadata or in-memory cache
  const authorIcon = model.authorIcon || iconCache.get(model.id) || lazyExtractedIcon.value
  if (authorIcon)
    return { url: authorIcon, source: 'author-icon' }

  // Check dynamic canvas preview image
  if (model.previewImage)
    return { url: model.previewImage, source: 'preview' }

  return { url: null, source: null }
})

const portrait = computed(() => portraitInfo.value.url)
const portraitSource = computed(() => portraitInfo.value.source)

// Non-blocking background watcher:
// - Extracts complementary colors from cache/canvas asynchronously
// - For zip models without authorIcon, lazily triggers a single background extract
watch(
  () => props.displayModelId,
  (id) => {
    if (!id) {
      dynamicBackground.value = null
      lazyExtractedIcon.value = null
      return
    }

    const model = displayModelsStore.displayModels.find(m => m.id === id)
    if (!model)
      return

    const previewUrl = model.previewImage
    if (previewUrl) {
      if (colorCache.has(previewUrl)) {
        dynamicBackground.value = colorCache.get(previewUrl) || null
      }
      else {
        void extractComplementaryColors(previewUrl).then((colors) => {
          dynamicBackground.value = colors
        })
      }
    }
    else {
      dynamicBackground.value = null
    }

    // Lazy migration for legacy models without authorIcon: defer to idle time to avoid blocking initial render
    if (!model.authorIcon && (model.format === DisplayModelFormat.Live2dZip || model.format === DisplayModelFormat.SpineZip || model.format === DisplayModelFormat.PMXZip)) {
      const scheduleExtraction = () => {
        void extractModelIcon(id).then((url) => {
          if (url) {
            lazyExtractedIcon.value = url
          }
        })
      }
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(scheduleExtraction, { timeout: 4000 })
      }
      else {
        setTimeout(scheduleExtraction, 1500)
      }
    }
  },
  { immediate: true },
)

// Dynamically compute the inline background style or colors
const backgroundStyle = computed(() => {
  if (!props.useDynamicBackground || !dynamicBackground.value || portraitSource.value !== 'preview') {
    return {}
  }
  return {
    '--avatar-bg-light': dynamicBackground.value.light,
    '--avatar-bg-dark': dynamicBackground.value.dark,
    'background-color': 'var(--avatar-bg-light)',
  }
})

// Unique initial letter color for fallback avatar
function cardInitialColor(name: string) {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    'bg-red-500/20 text-red-500 border border-red-500/25',
    'bg-orange-500/20 text-orange-500 border border-orange-500/25',
    'bg-amber-500/20 text-amber-500 border border-amber-500/25',
    'bg-yellow-500/20 text-yellow-500 border border-yellow-500/25',
    'bg-lime-500/20 text-lime-500 border border-lime-500/25',
    'bg-green-500/20 text-green-500 border border-green-500/25',
    'bg-emerald-500/20 text-emerald-500 border border-emerald-500/25',
    'bg-teal-500/20 text-teal-500 border border-teal-500/25',
    'bg-cyan-500/20 text-cyan-500 border border-cyan-500/25',
    'bg-sky-500/20 text-sky-500 border border-sky-500/25',
    'bg-blue-500/20 text-blue-500 border border-blue-500/25',
    'bg-indigo-500/20 text-indigo-500 border border-indigo-500/25',
    'bg-violet-500/20 text-violet-500 border border-violet-500/25',
    'bg-purple-500/20 text-purple-500 border border-purple-500/25',
    'bg-fuchsia-500/20 text-fuchsia-500 border border-fuchsia-500/25',
    'bg-pink-500/20 text-pink-500 border border-pink-500/25',
    'bg-rose-500/20 text-rose-500 border border-rose-500/25',
  ]
  return colors[hash % colors.length]
}
</script>

<template>
  <div
    :class="[
      'relative flex items-center justify-center select-none overflow-hidden shrink-0 transition-all duration-300',
      shape === 'circle' ? 'rounded-full' : shape === 'rounded' ? 'rounded-xl' : 'rounded-none',
      sizeClass,
      // Apply dark/light background via styling variables
      portraitSource === 'preview' && dynamicBackground
        ? 'bg-[var(--avatar-bg-light)] dark:bg-[var(--avatar-bg-dark)]'
        : 'bg-neutral-100 dark:bg-neutral-800/80',
    ]"
    :style="backgroundStyle"
  >
    <img
      v-if="portrait"
      :src="portrait"
      :class="[avatarClass, portraitSource === 'preview' ? 'object-contain p-0.5' : 'object-cover']"
      alt="Avatar"
    >
    <div
      v-else
      :class="['h-full w-full flex items-center justify-center font-bold uppercase', cardInitialColor(name)]"
    >
      {{ name.charAt(0) }}
    </div>

    <!-- Active Badge -->
    <div
      v-if="showBadge && isActive"
      class="absolute bottom-0.5 right-0.5 rounded-full bg-primary-500 p-0.5 text-white shadow-sm ring-1 ring-white/10"
    >
      <div i-solar:check-circle-bold-duotone class="text-[8px]" />
    </div>
  </div>
</template>
