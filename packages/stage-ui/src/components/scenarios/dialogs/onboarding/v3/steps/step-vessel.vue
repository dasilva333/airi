<script setup lang="ts">
import type { UnifiedVesselItem } from '../components/vessel-coverflow.vue'

import { SPOTLIGHT_MODELS } from '@proj-airi/stage-ui/constants'
import { Button } from '@proj-airi/ui'
import { useFileDialog } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import AssistantBubble from '../components/assistant-bubble.vue'
import VesselCoverflow from '../components/vessel-coverflow.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../../../stores/display-models'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()
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

    const cleanName = (m.name || m.id || 'custom avatar')
      .replace(/\.(zip|vrm|pmx|pmd|skel|moc3)$/i, '')
      .replace(/[_-]+/g, ' ')
      .trim()

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
      prompt: `masterpiece, best quality, 1girl, ${cleanName || 'custom avatar'}, detailed anime aesthetic,`,
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

const isActiveCommitted = computed(() => {
  return draft.state?.vesselDisplayModelId === activeModel.value.id
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

function handleDownloadClick() {
  if (!activeModel.value.isInstalled && activeModel.value.downloadUrl) {
    window.open(activeModel.value.downloadUrl, '_blank', 'noopener,noreferrer')
    toast.info(`Opening download page for ${activeModel.value.name}...`)
  }
}

function handleReselectActive() {
  applyVesselToDraft(activeModel.value.id, activeModel.value.prompt)
  toast.success(`Mounted ${activeModel.value.name} as companion vessel!`)
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
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-2 flex flex-col gap-4']">
      <!-- Two-column composition -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[350px_minmax(0,1fr)] gap-5 lg:gap-6 items-start']">
        <!-- Left column: heading, guidance, inspector -->
        <div :class="['flex flex-col gap-4 min-w-0']">
          <div
            v-motion
            :initial="{ opacity: 0, y: -6 }"
            :enter="{ opacity: 1, y: 0 }"
            :duration="350"
            :class="['text-left']"
          >
            <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white text-left text-balance']">
              {{ t('onboarding.steps.vessel.title') }}
            </h1>
          </div>

          <AssistantBubble
            message="Let’s find a look that feels right. Browse the collection or import your own avatar, then preview it on the stage."
            step-key="vessel"
            tone="primary"
          />

          <!-- Selected-avatar inspector card -->
          <div
            v-motion
            :initial="{ opacity: 0, y: 8 }"
            :enter="{ opacity: 1, y: 0 }"
            :duration="300"
            :delay="150"
            :class="[
              'p-5 rounded-[20px] border transition-all',
              'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md flex flex-col gap-3 min-w-0',
            ]"
          >
            <span :class="['text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400']">
              Selected avatar
            </span>

            <div :class="['flex items-start gap-3 min-w-0']">
              <div :class="['h-14 w-14 rounded-xl overflow-hidden border border-neutral-200/80 dark:border-white/15 shadow-xs flex-shrink-0 bg-neutral-100 dark:bg-neutral-800']">
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
                <div :title="activeModel.name" :class="['text-sm font-bold text-neutral-900 dark:text-white leading-tight break-words line-clamp-2']">
                  {{ activeModel.name }}
                </div>
                <div v-if="activeModel.sourceSiteName" :title="activeModel.sourceSiteName" :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate']">
                  {{ activeModel.sourceSiteName }}
                </div>
                <div :class="['flex flex-wrap items-center gap-1.5 mt-1.5']">
                  <span
                    :class="[
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                      activeModel.isInstalled
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
                    ]"
                  >
                    <span v-if="activeModel.isInstalled" :class="['i-solar:check-circle-bold h-3 w-3']" />
                    <span>{{ activeModel.isInstalled ? 'Installed' : 'Download' }}</span>
                  </span>
                  <span
                    :class="[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                      activeModel.format === 'live2d'
                        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                        : activeModel.format === 'vrm'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
                    ]"
                  >
                    {{ activeModel.formatLabel || activeModel.format.toUpperCase() }}
                  </span>
                </div>
              </div>
            </div>

            <p :class="['text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed break-words']">
              <span v-if="activeModel.author" :class="['text-neutral-700 dark:text-neutral-300 font-medium']">{{ activeModel.author }} • </span>
              <span>{{ activeModel.description }}</span>
            </p>

            <div :class="['flex items-center gap-2']">
              <span v-if="isActiveCommitted" :class="['inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400']">
                <span :class="['i-solar:check-circle-bold h-4 w-4']" />
                <span>Selected</span>
              </span>
              <span v-else-if="activeModel.isInstalled" :class="['inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400']">
                <span>Browsing…</span>
                <button
                  type="button"
                  :class="['text-primary-600 dark:text-primary-400 font-semibold hover:underline cursor-pointer']"
                  @click="handleReselectActive"
                >
                  Select
                </button>
              </span>
              <Button
                v-else-if="activeModel.downloadUrl"
                variant="secondary"
                size="sm"
                :class="['inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer']"
                @click="handleDownloadClick"
              >
                <span :class="['i-solar:download-minimalistic-bold-duotone h-4 w-4']" />
                <span>Download model</span>
              </Button>
            </div>

            <div :class="['border-t border-neutral-200/70 dark:border-white/10 pt-3 flex flex-col gap-1.5']">
              <span :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">
                Visual style descriptor
              </span>
              <div :class="['p-2 px-2.5 rounded-lg bg-neutral-100/70 dark:bg-black/30 border border-neutral-200/50 dark:border-white/5 font-mono text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400 break-words whitespace-pre-wrap max-h-24 overflow-y-auto']">
                {{ activeModel.prompt }}
              </div>
              <span :class="['text-[11px] text-neutral-400 dark:text-neutral-500']">
                Used when generating images of your companion.
              </span>
            </div>
          </div>
        </div>

        <!-- Right column: browsing panel -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="100"
          :class="[
            'rounded-[20px] border p-4 sm:p-5 min-w-0 flex flex-col gap-3',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- First toolbar row: source filters + import -->
          <div :class="['flex flex-wrap items-center justify-between gap-2']">
            <div :class="['flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-white/5 text-xs font-medium min-w-0']">
              <button
                type="button"
                :class="[
                  'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium whitespace-nowrap',
                  activeSourceFilter === 'all'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
                ]"
                @click="activeSourceFilter = 'all'"
              >
                All sources ({{ allModels.length }})
              </button>
              <button
                type="button"
                :class="[
                  'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium whitespace-nowrap',
                  activeSourceFilter === 'installed'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
                ]"
                @click="activeSourceFilter = 'installed'"
              >
                Installed ({{ installedCount }})
              </button>
              <button
                type="button"
                :class="[
                  'px-3 py-1 rounded-lg transition-all cursor-pointer font-medium whitespace-nowrap',
                  activeSourceFilter === 'free'
                    ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
                ]"
                @click="activeSourceFilter = 'free'"
              >
                Free downloads ({{ freeCount }})
              </button>
            </div>

            <button
              type="button"
              :class="[
                'px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors border whitespace-nowrap',
                showCustomDropzone
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-neutral-200 dark:border-white/10 bg-white/60 dark:bg-white/5 text-neutral-700 dark:text-neutral-200 hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400',
              ]"
              @click="showCustomDropzone = !showCustomDropzone"
            >
              <span>+ Import custom</span>
            </button>
          </div>

          <!-- Second toolbar row: format filters -->
          <div :class="['flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-white/5 text-xs font-medium w-fit max-w-full']">
            <button
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeFormatFilter === 'all'
                  ? 'bg-white text-neutral-900 shadow-xs dark:bg-neutral-800 dark:text-white font-semibold'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
              ]"
              @click="activeFormatFilter = 'all'"
            >
              {{ t('onboarding.steps.vessel.filters.all') }}
            </button>
            <button
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeFormatFilter === 'vrm'
                  ? 'bg-blue-500 text-white shadow-xs font-semibold'
                  : 'text-neutral-500 hover:text-blue-600 dark:text-neutral-400 dark:hover:text-blue-300',
              ]"
              @click="activeFormatFilter = 'vrm'"
            >
              {{ t('onboarding.steps.vessel.filters.vrm') }}
            </button>
            <button
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeFormatFilter === 'live2d'
                  ? 'bg-teal-500 text-white shadow-xs font-semibold'
                  : 'text-neutral-500 hover:text-teal-600 dark:text-neutral-400 dark:hover:text-teal-300',
              ]"
              @click="activeFormatFilter = 'live2d'"
            >
              {{ t('onboarding.steps.vessel.filters.live2d') }}
            </button>
            <button
              type="button"
              :class="[
                'px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap',
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
                'px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap',
                activeFormatFilter === 'mmd'
                  ? 'bg-pink-500 text-white shadow-xs font-semibold'
                  : 'text-neutral-500 hover:text-pink-600 dark:text-neutral-400 dark:hover:text-pink-300',
              ]"
              @click="activeFormatFilter = 'mmd'"
            >
              MMD
            </button>
          </div>

          <!-- Custom model upload dropzone (collapsible) -->
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
            <div :class="['flex items-center gap-3 min-w-0']">
              <div :class="['h-10 w-10 rounded-xl bg-primary-500/20 text-primary-500 flex items-center justify-center flex-shrink-0']">
                <div :class="['i-solar:cloud-upload-bold-duotone h-6 w-6']" />
              </div>
              <div :class="['min-w-0']">
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

          <!-- Existing carousel in narrower container -->
          <div :class="['min-w-0 w-full']">
            <VesselCoverflow
              :models="filteredModels"
              :model-value="selectedModelId"
              @select="handleSelectModel"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Shared navigation footer -->
    <div
      :class="[
        'flex-shrink-0 pt-4 px-4 sm:px-6 flex items-center justify-between border-t border-neutral-200/80 dark:border-neutral-800/80',
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
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium truncate px-2']">
        Selected: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ activeModel.name }}</span>
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
        <span>{{ t('onboarding.shell.next') }}</span>
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
