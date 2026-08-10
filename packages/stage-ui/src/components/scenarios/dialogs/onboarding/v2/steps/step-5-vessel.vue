<script setup lang="ts">
import { ref } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

// V2 onboarding scaffold — Step 5: Physical Vessel. Visual mockup only.
// Starter body previews reuse the real preset preview assets from
// stores/display-models.ts; no model files are loaded.

const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

type ViewMode = 'starters' | 'explore'
const viewMode = ref<ViewMode>('starters')
const selectedBody = ref('hiyori-free')

const starterBodies = [
  { id: 'hiyori-free', name: 'Hiyori (Free)', format: 'Live2D', preview: presetLive2dPreview },
  { id: 'hiyori-pro', name: 'Hiyori (Pro)', format: 'Live2D', preview: presetLive2dPreview },
  { id: 'avatar-a', name: 'AvatarSample_A', format: '3D VRM', preview: presetVrmAvatarAPreview },
  { id: 'avatar-b', name: 'AvatarSample_B', format: '3D VRM', preview: presetVrmAvatarBPreview },
]

// Subset mirrors the Explore wall in model-selector.vue (mockup copy).
const exploreLinks = [
  { name: 'Steam Workshop', url: 'https://steamcommunity.com/workshop/browse/?appid=616720', note: 'Live2D / Spine' },
  { name: 'Booth', url: 'https://booth.pm/en/browse/VTuber', note: 'VRM / Live2D' },
  { name: 'VRoid Hub', url: 'https://hub.vroid.com', note: 'VRM' },
  { name: 'Eikanya Archive', url: 'https://dasilva333.github.io/live2d-eikanya-index/', note: '4.9k+ Live2D' },
  { name: 'SillyTavern Portal', url: 'https://dasilva333.github.io/live2d-test157t-index/', note: '270+ Live2D' },
  { name: 'itch.io', url: 'https://itch.io/game-assets', note: 'Assorted' },
  { name: 'Sketchfab', url: 'https://sketchfab.com', note: '3D' },
  { name: 'VGen', url: 'https://vgen.co', note: 'Commissions' },
]
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex flex-shrink-0 items-start justify-between gap-3">
      <div>
        <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
          Physical Vessel
        </h2>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Mount your Step 4 soul onto a body — or drop your own.
        </p>
      </div>
      <button
        class="flex flex-shrink-0 items-center gap-1.5 border border-indigo-500/30 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-600 font-semibold transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
        @click="viewMode = viewMode === 'starters' ? 'explore' : 'starters'"
      >
        <div :class="viewMode === 'starters' ? 'i-solar:global-bold-duotone' : 'i-solar:alt-arrow-left-line-duotone'" class="h-4 w-4" />
        {{ viewMode === 'starters' ? '🌐 Find Free Bodies' : 'Back to Starter Bodies' }}
      </button>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      tone="amber"
      message="This is what she'll look like on stage! Try a starter body now — you can swap forms any time without losing her personality."
    />

    <!-- Ever-present custom dropzone -->
    <div
      :class="[
        'flex flex-shrink-0 items-center justify-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 text-center transition-colors',
        'border-neutral-300/80 bg-white/30 dark:border-neutral-700/80 dark:bg-neutral-900/30 hover:border-primary-500/60',
      ]"
    >
      <div class="i-solar:cloud-upload-bold-duotone h-6 w-6 text-neutral-400" />
      <span class="text-xs text-neutral-500 dark:text-neutral-400">
        Drag & drop <span class="font-bold font-mono">.vrm</span>, <span class="font-bold font-mono">.model3.json</span>, or <span class="font-bold font-mono">.zip</span> any time
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
      <!-- View A: starter bodies -->
      <div v-if="viewMode === 'starters'" class="grid grid-cols-2 gap-3 pb-2 sm:grid-cols-4">
        <button
          v-for="body in starterBodies"
          :key="body.id"
          :class="[
            'group relative flex flex-col overflow-hidden border-2 rounded-xl text-left transition-all duration-300',
            selectedBody === body.id
              ? 'border-primary-500 shadow-lg shadow-primary-500/10 dark:border-primary-400'
              : 'border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/50',
          ]"
          @click="selectedBody = body.id"
        >
          <div class="aspect-square w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <img :src="body.preview" :alt="body.name" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105">
          </div>
          <div class="flex flex-col gap-1 p-2.5">
            <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ body.name }}</span>
            <span class="self-start rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400">{{ body.format }}</span>
          </div>
          <div
            v-if="selectedBody === body.id"
            class="absolute right-2 top-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary-500 text-white shadow"
          >
            <div class="i-solar:check-read-linear h-3.5 w-3.5" />
          </div>
        </button>
      </div>

      <!-- View B: explore link wall -->
      <div v-else class="grid grid-cols-1 gap-2 pb-2 sm:grid-cols-2">
        <a
          v-for="link in exploreLinks"
          :key="link.name"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          :class="['flex items-center gap-3', 'border border-neutral-200/60 rounded-xl px-4 py-3', 'bg-white/40 dark:bg-neutral-900/40', 'backdrop-blur-md', 'transition-colors hover:border-indigo-500/50']"
        >
          <div class="i-solar:link-round-bold-duotone h-5 w-5 flex-shrink-0 text-indigo-500" />
          <div class="min-w-0 flex-1">
            <div class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">{{ link.name }}</div>
            <div class="text-[10px] text-neutral-400">{{ link.note }}</div>
          </div>
          <div class="i-solar:square-top-down-linear h-4 w-4 flex-shrink-0 text-neutral-400" />
        </a>
      </div>
    </div>
  </div>
</template>
