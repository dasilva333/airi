<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CompanionBubble from '../components/companion-bubble.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { ModelSelectorDialog } from '../../../model-selector'
import { useOnboardingV2Draft } from '../draft-store'

// V2 onboarding — Step 5: Physical Vessel.
// Starter body previews reuse the real preset preview assets from
// stores/display-models.ts.

const draftStore = useOnboardingV2Draft()
const displayModelsStore = useDisplayModelsStore()
const isModelSelectorOpen = ref(false)

const customModelsCount = computed(() => displayModelsStore.displayModels.length)

function handleModelPick(model: any) {
  if (model?.id) {
    selectedBody.value = model.id
  }
}

const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

type ViewMode = 'starters' | 'explore'
const viewMode = ref<ViewMode>('starters')
const selectedBody = ref(draftStore.state.vessel.displayModelId || 'preset-live2d-2')

if (!draftStore.state.vessel.displayModelId) {
  draftStore.setVessel({ displayModelId: selectedBody.value })
}

watch(selectedBody, (val) => {
  draftStore.setVessel({ displayModelId: val })
})

const starterBodies = [
  { id: 'preset-live2d-2', name: 'Hiyori (Free)', format: 'Live2D', preview: presetLive2dPreview },
  { id: 'preset-live2d-1', name: 'Hiyori (Pro)', format: 'Live2D', preview: presetLive2dPreview },
  { id: 'preset-vrm-1', name: 'AvatarSample_A', format: '3D VRM', preview: presetVrmAvatarAPreview },
  { id: 'preset-vrm-2', name: 'AvatarSample_B', format: '3D VRM', preview: presetVrmAvatarBPreview },
]

const activeModel = computed(() => {
  const starter = starterBodies.find(b => b.id === selectedBody.value)
  if (starter) {
    return { name: starter.name, format: starter.format, isStarter: true }
  }
  const custom = displayModelsStore.displayModels.find(m => m.id === selectedBody.value)
  if (custom) {
    return { name: custom.name || custom.id, format: custom.format || 'Custom Avatar', isStarter: false }
  }
  return { name: selectedBody.value, format: 'Custom Avatar', isStarter: false }
})

const isUploading = ref(false)

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  isUploading.value = true
  try {
    const ext = file.name.split('.').pop()?.toLowerCase()
    let format: DisplayModelFormat = DisplayModelFormat.VRM
    if (ext === 'zip' || ext === 'moc3')
      format = DisplayModelFormat.Live2dZip
    else if (ext === 'skel')
      format = DisplayModelFormat.SpineZip
    else if (ext === 'pmx')
      format = DisplayModelFormat.PMXZip

    await displayModelsStore.addDisplayModel(format, file)
    const newModel = displayModelsStore.displayModels[displayModelsStore.displayModels.length - 1]
    if (newModel?.id) {
      selectedBody.value = newModel.id
    }
  }
  catch (error) {
    console.error('[Step 5 Vessel] Failed to upload model file:', error)
  }
  finally {
    isUploading.value = false
    target.value = ''
  }
}

// Mirrors the full marketplaces catalog from model-selector.vue.
const exploreLinks = [
  { name: 'Steam Workshop', vrm: false, live2d: true, spine: true, mmd: false, origin: 'Steam', url: 'https://steamcommunity.com/workshop/browse/?appid=616720' },
  { name: 'VChaVCha (Hololive MMD)', vrm: false, live2d: false, spine: false, mmd: true, origin: 'VChaVCha', url: 'https://vchavcha.com/en/free-resources/hololive-mmd-download/' },
  { name: 'NicoNico 3D (MMD)', vrm: false, live2d: false, spine: false, mmd: true, origin: 'Japan', url: 'https://3d.nicovideo.jp/search?category=all&download_filter=all&limit=28&max_pages=100&order=1&page=1&perfect_match=1&sort=view&usable_animation=&word=MMD&word_type=tag&work_type=mmd' },
  { name: 'Reverse: 1999 (v1.7+)', vrm: false, live2d: true, spine: false, mmd: false, origin: 'Storm Preservation', url: 'https://dasilva333.github.io/r1999-web-gallery/' },
  { name: 'Eikanya Live2D Archive (4.9k+)', vrm: false, live2d: true, spine: false, mmd: false, origin: 'Eikanya', url: 'https://dasilva333.github.io/live2d-eikanya-index/' },
  { name: 'SillyTavern Live2D Portal (270)', vrm: false, live2d: true, spine: false, mmd: false, origin: 'test157t', url: 'https://dasilva333.github.io/live2d-test157t-index/' },
  { name: 'bear0830 (MMD Animations)', vrm: false, live2d: false, spine: false, mmd: true, origin: 'GitHub', url: 'https://github.com/bear0830/mmd' },
  { name: 'Booth', vrm: true, live2d: true, spine: false, mmd: false, origin: 'Japan', url: 'https://booth.pm/en/browse/VTuber' },
  { name: 'Booth VRMA', vrm: true, live2d: false, spine: false, mmd: false, origin: 'Japan', url: 'https://booth.pm/en/browse/3D%20Motion%20&%20Animation?sort=price_asc&tags%5B%5D=VRMA' },
  { name: 'VGen', vrm: true, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://vgen.co' },
  { name: 'itch.io', vrm: true, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://itch.io/game-assets' },
  { name: 'Gumroad', vrm: true, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://gumroad.com' },
  { name: 'Ko-fi', vrm: true, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://ko-fi.com/shop' },
  { name: 'VRoid Hub', vrm: true, live2d: false, spine: false, mmd: false, origin: 'Japan', url: 'https://hub.vroid.com' },
  { name: 'Sketchfab', vrm: true, live2d: false, spine: false, mmd: false, origin: 'USA', url: 'https://sketchfab.com' },
  { name: 'CGTrader', vrm: true, live2d: false, spine: false, mmd: false, origin: 'USA', url: 'https://cgtrader.com' },
  { name: 'Nizima', vrm: false, live2d: true, spine: false, mmd: false, origin: 'Japan', url: 'https://nizima.com' },
  { name: 'Avatar Atelier', vrm: false, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://avataratelier.com' },
  { name: 'VTuberAvatars', vrm: false, live2d: true, spine: false, mmd: false, origin: 'USA', url: 'https://vtuberavatars.com' },
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
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex flex-shrink-0 cursor-pointer items-center gap-1.5 border border-purple-500/30 rounded-lg bg-purple-500/10 px-3 py-1.5 text-xs text-purple-600 font-semibold transition-colors hover:bg-purple-500/20 dark:text-purple-400"
          @click="isModelSelectorOpen = true"
        >
          <div class="i-solar:user-bold-duotone h-4 w-4 text-purple-500" />
          Choose Installed Avatar{{ customModelsCount ? ` (${customModelsCount})` : '' }}
        </button>
        <button
          type="button"
          class="flex flex-shrink-0 items-center gap-1.5 border border-indigo-500/30 rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-600 font-semibold transition-colors hover:bg-indigo-500/20 dark:text-indigo-400"
          @click="viewMode = viewMode === 'starters' ? 'explore' : 'starters'"
        >
          <div :class="viewMode === 'starters' ? 'i-solar:global-bold-duotone' : 'i-solar:alt-arrow-left-line-duotone'" class="h-4 w-4" />
          {{ viewMode === 'starters' ? '🌐 Find Free Bodies' : 'Back to Starter Bodies' }}
        </button>
      </div>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      tone="amber"
      message="This is what she'll look like on stage! Try a starter body now — you can swap forms any time without losing her personality."
    />

    <!-- Active Selection Indicator Banner -->
    <div
      class="flex flex-shrink-0 items-center justify-between border border-primary-500/40 rounded-xl bg-primary-500/10 px-4 py-2.5 shadow-sm dark:border-primary-400/30 dark:bg-primary-500/15"
    >
      <div class="flex items-center gap-2.5">
        <div class="i-solar:check-circle-bold-duotone h-5 w-5 flex-shrink-0 text-primary-500" />
        <div class="flex flex-col">
          <span class="text-[10px] text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
            Selected Vessel Avatar
          </span>
          <span class="text-sm text-neutral-900 font-bold dark:text-neutral-50">
            {{ activeModel.name }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span class="border border-primary-500/30 rounded-full bg-primary-500/20 px-2.5 py-0.5 text-xs text-primary-700 font-bold dark:text-primary-300">
          {{ activeModel.format }}
        </span>
        <span v-if="!activeModel.isStarter" class="border border-emerald-500/30 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs text-emerald-700 font-bold dark:text-emerald-300">
          Custom Avatar
        </span>
      </div>
    </div>

    <!-- Ever-present custom dropzone -->
    <label
      :class="[
        'flex flex-shrink-0 items-center justify-center gap-3 border-2 border-dashed rounded-xl px-4 py-3 text-center cursor-pointer transition-colors',
        'border-neutral-300/80 bg-white/30 dark:border-neutral-700/80 dark:bg-neutral-900/30 hover:border-primary-500/60',
      ]"
    >
      <div
        :class="isUploading ? 'i-svg-spinners:ring-resize text-primary-500' : 'i-solar:cloud-upload-bold-duotone text-neutral-400'"
        class="h-6 w-6 flex-shrink-0"
      />
      <div class="flex flex-col text-left">
        <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-200">
          {{ isUploading ? 'Processing and adding avatar model...' : 'Drop or browse a model file (.vrm or .zip archive)' }}
        </span>
        <span class="text-[11px] text-neutral-400 dark:text-neutral-500">
          Supports <span class="font-mono">.vrm</span> 3D avatars, or <span class="font-mono">.zip</span> archives with Live2D (<span class="font-mono">.moc3</span> Cubism 3–5), Spine (<span class="font-mono">.skel</span> 3.8–4.2), &amp; MMD (<span class="font-mono">.pmx</span>)
        </span>
      </div>
      <input
        type="file"
        accept=".vrm,.zip,.moc3,.skel,.pmx"
        class="hidden"
        :disabled="isUploading"
        @change="handleFileUpload"
      >
    </label>

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

      <!-- View B: explore link wall (4-column grid with color-coded format badges) -->
      <div v-else class="grid grid-cols-1 gap-3 pb-2 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2">
        <a
          v-for="link in exploreLinks"
          :key="link.name"
          :href="link.url"
          target="_blank"
          rel="noopener noreferrer"
          :class="[
            'group flex flex-col justify-between gap-3 border border-neutral-200/60 rounded-xl p-3.5',
            'bg-white/40 dark:bg-neutral-900/40 dark:border-neutral-800/80',
            'backdrop-blur-md transition-all duration-200 hover:border-primary-500/60 hover:bg-white/60 dark:hover:bg-neutral-900/60 active:scale-[0.99]',
          ]"
        >
          <div class="flex flex-col gap-2">
            <div class="flex items-start justify-between gap-2">
              <span class="line-clamp-1 text-xs text-neutral-800 font-bold transition-colors dark:text-neutral-100 group-hover:text-primary-500">
                {{ link.name }}
              </span>
              <div class="i-solar:export-bold-duotone h-3.5 w-3.5 flex-shrink-0 text-neutral-400 transition-colors group-hover:text-primary-500" />
            </div>

            <!-- Color-coded format badges -->
            <div class="flex flex-wrap items-center gap-1">
              <span
                v-if="link.live2d"
                class="border border-emerald-500/25 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-600 font-bold dark:text-emerald-400"
              >
                LIVE2D
              </span>
              <span
                v-if="link.vrm"
                class="border border-blue-500/25 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] text-blue-600 font-bold dark:text-blue-400"
              >
                VRM
              </span>
              <span
                v-if="link.mmd"
                class="border border-fuchsia-500/25 rounded-full bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] text-fuchsia-600 font-bold dark:text-fuchsia-400"
              >
                MMD
              </span>
              <span
                v-if="link.spine"
                class="border border-purple-500/25 rounded-full bg-purple-500/15 px-1.5 py-0.5 text-[9px] text-purple-600 font-bold dark:text-purple-400"
              >
                SPINE
              </span>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-neutral-200/50 pt-2 text-[10px] text-neutral-400 dark:border-neutral-800/50 dark:text-neutral-500">
            <span class="truncate">⚙ {{ link.origin }}</span>
            <span class="font-medium">External ↗</span>
          </div>
        </a>
      </div>
    </div>

    <ModelSelectorDialog
      v-model:show="isModelSelectorOpen"
      @pick="handleModelPick"
    />
  </div>
</template>
