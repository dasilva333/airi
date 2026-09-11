<script setup lang="ts">
import type { UnifiedVesselItem } from '../components/vessel-coverflow.vue'

import { SPOTLIGHT_MODELS } from '@proj-airi/stage-ui/constants'
import { Button } from '@proj-airi/ui'
import { useFileDialog } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import VesselCoverflow from '../components/vessel-coverflow.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draft = useOnboardingV3Draft()
const displayModelsStore = useDisplayModelsStore()

// Real local assets
const presetLive2dPreview = new URL('../../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href
const presetVrmAvatarAPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href
const presetVrmAvatarBPreview = new URL('../../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href

// Local pre-installed models
const localPresetModels: UnifiedVesselItem[] = [
  {
    id: 'preset-live2d-2',
    name: 'Hiyori (Student)',
    format: 'live2d',
    formatLabel: 'Live2D (2D)',
    previewUrl: presetLive2dPreview,
    isInstalled: true,
    author: 'Live2D Inc.',
    sourceSiteName: 'Official Live2D Sample',
    description: 'Official Live2D Cubism 4 starter avatar with natural breathing, eye gaze physics, and blink sync.',
    prompt: 'masterpiece, best quality, 1girl, hiyori, brown twin tails with blue hair ribbons, brown hair, gentle blue eyes, anime school uniform with blue ribbon tie, clean lineart, soft watercolor anime style,',
  },
  {
    id: 'preset-vrm-2',
    name: 'Seed Girl (VRM)',
    format: 'vrm',
    formatLabel: 'VRM (3D)',
    previewUrl: presetVrmAvatarBPreview,
    isInstalled: true,
    author: 'VRM Consortium',
    sourceSiteName: 'VRM Sample Model',
    description: 'Official VRM 1.0 3D Humanoid companion with full blendshape facial expressions, spring bone hair physics, and full-body IK.',
    prompt: 'masterpiece, best quality, 1girl, seed girl, long dual-tone silvery-blue hair with white highlights, glowing cyan iris, futuristic idol bodysuit with neon accents, cel-shaded 3D anime aesthetic,',
  },
  {
    id: 'preset-vrm-1',
    name: 'AvatarSample_A',
    format: 'vrm',
    formatLabel: 'VRM (3D)',
    previewUrl: presetVrmAvatarAPreview,
    isInstalled: true,
    author: 'VRM Consortium',
    sourceSiteName: 'VRM Starter Model',
    description: 'Starter lightweight humanoid VRM companion with standard spring bone physics and expressive facial presets.',
    prompt: 'masterpiece, best quality, 1girl, avatarsample a, shoulder length brown hair, brown eyes, casual school uniform, simple clean anime style,',
  },
]

// Community spotlight models (ripped directly from explore.vue / SPOTLIGHT_MODELS)
const communitySpotlightModels = computed<UnifiedVesselItem[]>(() => {
  return SPOTLIGHT_MODELS.map((m) => {
    return {
      id: m.id,
      name: m.name,
      format: m.format,
      formatLabel: m.formatLabel || m.format.toUpperCase(),
      previewUrl: m.previewUrl,
      isInstalled: false,
      author: m.author,
      sourceSiteName: m.sourceSiteName,
      sourceSiteUrl: m.sourceSiteUrl,
      downloadUrl: m.downloadUrl,
      description: m.description || `Community-curated ${m.format.toUpperCase()} avatar from ${m.sourceSiteName}.`,
      prompt: `masterpiece, best quality, 1girl, ${m.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ')}, anime aesthetic, highly detailed illustration,`,
    }
  })
})

// Dynamic custom models from user's store
const userCustomModels = computed<UnifiedVesselItem[]>(() => {
  return displayModelsStore.displayModels.map((m) => {
    let format: 'live2d' | 'vrm' | 'spine' | 'mmd' = 'live2d'
    let formatLabel = 'Live2D (2D)'

    if (m.format === DisplayModelFormat.VRM) {
      format = 'vrm'
      formatLabel = 'VRM (3D)'
    }
    else if (m.format === DisplayModelFormat.SpineZip) {
      format = 'spine'
      formatLabel = 'Spine (2D)'
    }
    else if (m.format === DisplayModelFormat.PMXZip || m.format === DisplayModelFormat.PMXDirectory || m.format === DisplayModelFormat.PMD) {
      format = 'mmd'
      formatLabel = 'MMD (3D)'
    }
    else if (m.format === DisplayModelFormat.Live2dZip || m.format === DisplayModelFormat.Live2dDirectory) {
      format = 'live2d'
      formatLabel = 'Live2D (2D)'
    }

    return {
      id: m.id,
      name: m.name || m.id,
      format,
      formatLabel,
      previewUrl: ('previewImage' in m && m.previewImage) ? m.previewImage : (('authorIcon' in m && m.authorIcon) ? m.authorIcon : ''),
      isInstalled: true,
      author: 'Custom Import',
      sourceSiteName: 'Local Vault',
      description: 'Custom imported companion avatar stored in your IndexedDB repository.',
      prompt: `masterpiece, best quality, 1girl, ${m.name || 'custom avatar'}, detailed anime aesthetic,`,
    }
  })
})

// Combined Unified Model Roster
const allModels = computed<UnifiedVesselItem[]>(() => {
  return [
    ...localPresetModels,
    ...userCustomModels.value,
    ...communitySpotlightModels.value,
  ]
})

// Filters
type SourceFilter = 'all' | 'installed' | 'free'
type FormatFilter = 'all' | 'vrm' | 'live2d' | 'spine' | 'mmd'

const activeSourceFilter = ref<SourceFilter>('all')
const activeFormatFilter = ref<FormatFilter>('all')

const filteredModels = computed(() => {
  return allModels.value.filter((m) => {
    if (activeSourceFilter.value === 'installed' && !m.isInstalled)
      return false
    if (activeSourceFilter.value === 'free' && m.isInstalled)
      return false
    if (activeFormatFilter.value !== 'all' && m.format !== activeFormatFilter.value)
      return false
    return true
  })
})

const installedCount = computed(() => allModels.value.filter(m => m.isInstalled).length)
const freeCount = computed(() => allModels.value.filter(m => !m.isInstalled).length)

// Selection State
const selectedModelId = ref(draft.state.vesselDisplayModelId || 'preset-live2d-2')

const activeModel = computed<UnifiedVesselItem>(() => {
  return (
    allModels.value.find(m => m.id === selectedModelId.value)
    || filteredModels.value[0]
    || allModels.value[0]!
  )
})

function applyVesselToDraft(modelId: string, visualPrompt?: string) {
  if (typeof (draft as any).setVessel === 'function') {
    draft.setVessel(modelId, visualPrompt)
  }
  else if (draft.state) {
    draft.state.vesselDisplayModelId = modelId
    if (visualPrompt !== undefined) {
      draft.state.artistryVisualPrompt = visualPrompt
    }
  }
}

function handleSelectModel(model: UnifiedVesselItem) {
  selectedModelId.value = model.id
  applyVesselToDraft(model.id, model.prompt)
}

watch(
  selectedModelId,
  (newId) => {
    const model = allModels.value.find(m => m.id === newId)
    if (model) {
      applyVesselToDraft(model.id, model.prompt)
    }
  },
  { immediate: true },
)

function handleActionButtonClick() {
  if (!activeModel.value.isInstalled && activeModel.value.downloadUrl) {
    window.open(activeModel.value.downloadUrl, '_blank', 'noopener,noreferrer')
    toast.info(`Opening download page for ${activeModel.value.name}...`)
  }
  else {
    applyVesselToDraft(activeModel.value.id, activeModel.value.prompt)
    toast.success(`Mounted ${activeModel.value.name} as companion vessel!`)
  }
}

// Custom model upload seam
const isUploading = ref(false)
const showCustomDropzone = ref(false)

async function processModelFile(file: File) {
  isUploading.value = true
  toast.info(`Importing ${file.name}...`)
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
    const newModel = displayModelsStore.displayModels[0]
    if (newModel?.id) {
      selectedModelId.value = newModel.id
      toast.success(`Loaded avatar "${newModel.name || file.name}"!`)
    }
  }
  catch (error: any) {
    console.error('[Step 5 Vessel] Failed to upload model file:', error)
    toast.error(`Failed to load avatar: ${error?.message || 'Invalid model file'}`)
  }
  finally {
    isUploading.value = false
  }
}

const { open: openFileDialog, onChange: onFileChange } = useFileDialog({
  accept: '.vrm,.zip,application/zip',
  multiple: false,
  reset: true,
})

onFileChange((files) => {
  const file = files?.[0]
  if (file) {
    processModelFile(file)
  }
})

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    processModelFile(file)
  }
}
</script>

<template>
  <div :class="['h-full w-full max-w-5xl mx-auto flex flex-col justify-between gap-3 select-none animate-fadeIn']">
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -6 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :class="['flex-shrink-0']"
    >
      <div :class="['flex items-center justify-between text-xs text-neutral-400 mb-0.5']">
        <span :class="['text-primary-500 font-semibold']">Step 6 of 16</span>
        <span :class="['font-medium tracking-wide uppercase']">Avatar Selection & Staging</span>
      </div>
      <div :class="['flex items-center justify-between']">
        <div>
          <h2 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            Physical Vessel
          </h2>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Mount your companion's soul onto a physical body — or drop your own custom model.
          </p>
        </div>
        <div :class="['flex items-center gap-2']">
          <span :class="['px-3 py-1 rounded-full text-xs font-medium border border-neutral-200/80 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 text-neutral-600 dark:text-neutral-300 backdrop-blur-md']">
            👤 {{ installedCount }} Installed Avatars
          </span>
          <button
            type="button"
            :class="[
              'px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors',
              showCustomDropzone
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200',
            ]"
            @click="showCustomDropzone = !showCustomDropzone"
          >
            <span>+ Import Custom</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filter Control Strip -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 6 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="100"
      :class="['flex flex-wrap items-center justify-between gap-2 px-1 flex-shrink-0']"
    >
      <!-- Source Filter Pills (All / Installed / Free Downloads) -->
      <div :class="['flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/5 text-xs font-medium']">
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium',
            activeSourceFilter === 'all'
              ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="activeSourceFilter = 'all'"
        >
          All Sources ({{ allModels.length }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium',
            activeSourceFilter === 'installed'
              ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="activeSourceFilter = 'installed'"
        >
          ✓ Installed ({{ installedCount }})
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium',
            activeSourceFilter === 'free'
              ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="activeSourceFilter = 'free'"
        >
          🌐 Free Downloads ({{ freeCount }})
        </button>
      </div>

      <!-- Format Filter Pills (All / Live2D / VRM / MMD) -->
      <div :class="['flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/5 text-xs font-medium']">
        <button
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
            activeFormatFilter === 'all'
              ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
              : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          ]"
          @click="activeFormatFilter = 'all'"
        >
          All Formats
        </button>
        <button
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
            activeFormatFilter === 'vrm'
              ? 'bg-blue-500 text-white shadow-xs font-semibold'
              : 'text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-300',
          ]"
          @click="activeFormatFilter = 'vrm'"
        >
          VRM (3D)
        </button>
        <button
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
            activeFormatFilter === 'live2d'
              ? 'bg-teal-500 text-white shadow-xs font-semibold'
              : 'text-neutral-500 hover:text-teal-600 dark:text-neutral-400 dark:hover:text-teal-300',
          ]"
          @click="activeFormatFilter = 'live2d'"
        >
          Live2D (2D)
        </button>
        <button
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
            activeFormatFilter === 'spine'
              ? 'bg-emerald-500 text-white shadow-xs font-semibold'
              : 'text-neutral-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-300',
          ]"
          @click="activeFormatFilter = 'spine'"
        >
          Spine (2D)
        </button>
        <button
          type="button"
          :class="[
            'px-2.5 py-1 rounded-lg transition-all cursor-pointer',
            activeFormatFilter === 'mmd'
              ? 'bg-pink-500 text-white shadow-xs font-semibold'
              : 'text-neutral-500 hover:text-pink-600 dark:text-neutral-400 dark:hover:text-pink-300',
          ]"
          @click="activeFormatFilter = 'mmd'"
        >
          MMD
        </button>
      </div>
    </div>

    <!-- Custom Model Upload Dropzone (Collapsible) -->
    <div
      v-if="showCustomDropzone"
      v-motion
      :initial="{ opacity: 0, height: 0 }"
      :enter="{ opacity: 1, height: 'auto' }"
      :duration="250"
      :class="[
        'p-3.5 rounded-2xl border-2 border-dashed border-primary-500/50 bg-primary-500/5 backdrop-blur-md',
        'flex items-center justify-between gap-4 cursor-pointer hover:bg-primary-500/10 transition-colors flex-shrink-0',
      ]"
      @dragover.prevent
      @drop="handleDrop"
      @click="openFileDialog()"
    >
      <div :class="['flex items-center gap-3']">
        <div :class="['h-10 w-10 rounded-xl bg-primary-500/20 text-primary-500 flex items-center justify-center flex-shrink-0']">
          <div :class="['i-solar:cloud-upload-bold-duotone h-6 w-6']" />
        </div>
        <div>
          <div :class="['text-xs font-bold text-neutral-800 dark:text-white flex items-center gap-2']">
            <span>Drop your custom model here (.vrm or .zip)</span>
            <span v-if="isUploading" :class="['text-[10px] text-primary-500 font-mono animate-pulse']">Loading...</span>
          </div>
          <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Supports VRM 0.0/1.0 3D humanoids and Live2D Cubism model zip packages.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        size="sm"
        :class="['flex-shrink-0']"
        @click.stop="openFileDialog()"
      >
        Choose File
      </Button>
    </div>

    <!-- 3D Pure Avatar Coverflow Stage (No cards, pure skins!) -->
    <div :class="['my-auto flex-shrink-0']">
      <VesselCoverflow
        :models="filteredModels"
        :model-value="selectedModelId"
        @select="handleSelectModel"
      />
    </div>

    <!-- Active Model Details Card & Metadata Strip (Inspired by explore.vue bottom card) -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 8 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="150"
      :class="[
        'p-3 sm:p-3.5 rounded-2xl border transition-all flex-shrink-0',
        'border-neutral-200/80 bg-white/70 shadow-xs dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md flex flex-col gap-2.5',
      ]"
    >
      <div :class="['flex items-center justify-between gap-3']">
        <!-- Avatar Preview Thumbnail + Metadata -->
        <div :class="['flex items-center gap-3 min-w-0 flex-1']">
          <div :class="['h-11 w-11 rounded-xl overflow-hidden border border-neutral-200/80 dark:border-white/15 shadow-xs flex-shrink-0 bg-neutral-100 dark:bg-neutral-800']">
            <img
              v-if="activeModel.previewUrl"
              :src="activeModel.previewUrl"
              :alt="activeModel.name"
              class="h-full w-full object-cover object-top"
            >
            <div v-else :class="['h-full w-full flex items-center justify-center text-neutral-400']">
              <div :class="['i-solar:user-bold-duotone h-6 w-6 opacity-40']" />
            </div>
          </div>

          <div :class="['min-w-0 flex-1']">
            <div :class="['flex items-center gap-2 flex-wrap']">
              <span :class="['text-sm font-bold text-neutral-900 dark:text-white truncate']">
                {{ activeModel.name }}
              </span>
              <span
                :class="[
                  'rounded px-1.5 py-0.2 text-[9px] font-bold tracking-wider uppercase',
                  activeModel.format === 'live2d'
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                    : activeModel.format === 'vrm'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                      : 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
                ]"
              >
                {{ activeModel.formatLabel || activeModel.format.toUpperCase() }}
              </span>
              <span
                v-if="activeModel.sourceSiteName"
                :class="['text-[10px] text-neutral-400 dark:text-neutral-500']"
              >
                via {{ activeModel.sourceSiteName }}
              </span>
            </div>

            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate']">
              <span v-if="activeModel.author" :class="['text-neutral-700 dark:text-neutral-300 font-medium']">{{ activeModel.author }} • </span>
              <span>{{ activeModel.description }}</span>
            </p>
          </div>
        </div>

        <!-- Action / Mount Button -->
        <Button
          :variant="activeModel.isInstalled ? 'primary' : 'secondary'"
          size="sm"
          :class="[
            'flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer',
          ]"
          @click="handleActionButtonClick"
        >
          <span v-if="draft.state?.vesselDisplayModelId === activeModel.id" class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span class="i-solar:check-circle-bold h-4 w-4" />
            <span>Selected Vessel</span>
          </span>
          <span v-else-if="activeModel.isInstalled">✓ Select Avatar</span>
          <span v-else class="flex items-center gap-1">
            <span class="i-solar:download-minimalistic-bold-duotone h-4 w-4" />
            <span>Download Model</span>
          </span>
        </Button>
      </div>

      <!-- Visual Style Descriptor Sub-Strip (Artistry auto-injection) -->
      <div :class="['pt-2 border-t border-neutral-200/50 dark:border-white/5 flex flex-col gap-1']">
        <div :class="['flex items-center justify-between text-[10px]']">
          <span :class="['text-neutral-500 dark:text-neutral-400 font-medium']">Visual Style Descriptor:</span>
          <span :class="['text-primary-600 dark:text-primary-400 font-semibold flex items-center gap-1']">
            <span :class="['i-solar:sparkles-bold-duotone h-3 w-3']" />
            <span>Auto-Injected to Artistry</span>
          </span>
        </div>
        <div :class="['p-1.5 px-2.5 rounded-lg bg-neutral-100/70 dark:bg-black/30 border border-neutral-200/50 dark:border-white/5 font-mono text-[10px] text-neutral-600 dark:text-neutral-400 line-clamp-1']">
          {{ activeModel.prompt }}
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div
      :class="[
        'h-14 border-t border-neutral-200/80 dark:border-neutral-800/80',
        'flex items-center justify-between flex-shrink-0 pt-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back to Profile</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Selected Vessel: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ activeModel.name }}</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>Next: Soul & Persona</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
