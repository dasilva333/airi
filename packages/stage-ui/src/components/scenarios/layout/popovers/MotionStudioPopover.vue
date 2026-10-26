<script setup lang="ts">
/**
 * Motion Studio popover — FlowMDM text-to-motion playground plus the saved motion
 * library.
 *
 * Self-serving: owns the text-to-motion store, the VRM animation store, the
 * quick-motion preset cache and its blob URLs.
 */
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import blowKissGlyph from '../../../../assets/motions/blow_kiss.avif'
import celebrateGlyph from '../../../../assets/motions/celebrate.avif'
import gracefulBowGlyph from '../../../../assets/motions/graceful_bow.avif'
import helloGlyph from '../../../../assets/motions/hello.avif'
import StripPopover from '../StripPopover.vue'

import { useControlStripSettingsRoute } from '../../../../composables/use-control-strip-settings-route'
import { DisplayModelFormat, useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useTextToMotionStore } from '../../../../stores/modules/text-to-motion'
import { useSettings } from '../../../../stores/settings'

const emit = defineEmits<{ close: [] }>()

const settingsStore = useSettings()
const cardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()
const { activeCardId } = storeToRefs(cardStore)
const { openSettingsRoute } = useControlStripSettingsRoute()
const modelStore = useModelStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const currentModelFormatLabel = computed(() => {
  if (settingsStore.stageModelRenderer === 'vrm')
    return 'VRM'
  if (settingsStore.stageModelRenderer === 'live2d')
    return 'Live2D'
  if (settingsStore.stageModelRenderer === 'spine')
    return 'Spine'
  if (settingsStore.stageModelRenderer === 'mmd')
    return 'MMD'
  if (settingsStore.stageModelRenderer === 'disabled')
    return 'Disabled'

  if (settingsStore.stageModelSelectedDisplayModel?.format) {
    const fmt = settingsStore.stageModelSelectedDisplayModel.format
    if (fmt === DisplayModelFormat.VRM)
      return 'VRM'
    if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
      return 'Live2D'
    if (fmt === DisplayModelFormat.SpineZip)
      return 'Spine'
    if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
      return 'MMD'
  }

  if (activeCardId.value) {
    const modelId = cardStore.getCardDisplayModelId(activeCardId.value)
    if (modelId) {
      const model = displayModelsStore.displayModels.find(m => m.id === modelId)
      if (model?.format === DisplayModelFormat.VRM)
        return 'VRM'
      if (model?.format === DisplayModelFormat.Live2dZip || model?.format === DisplayModelFormat.Live2dDirectory)
        return 'Live2D'
      if (model?.format === DisplayModelFormat.SpineZip)
        return 'Spine'
      if (model?.format === DisplayModelFormat.PMXZip || model?.format === DisplayModelFormat.PMXDirectory || model?.format === DisplayModelFormat.PMD)
        return 'MMD'
    }
  }

  return null
})

const isVrmModel = computed(() => {
  if (settingsStore.stageModelRenderer)
    return settingsStore.stageModelRenderer === 'vrm'

  if (settingsStore.stageModelSelectedDisplayModel?.format)
    return settingsStore.stageModelSelectedDisplayModel.format === DisplayModelFormat.VRM

  if (activeCardId.value) {
    const modelId = cardStore.getCardDisplayModelId(activeCardId.value)
    if (modelId) {
      const model = displayModelsStore.displayModels.find(m => m.id === modelId)
      if (model)
        return model.format === DisplayModelFormat.VRM
    }
  }

  return false
})

// ── Motion Studio (FlowMDM Text-to-Motion Create & Library) ───────────────
const textToMotionStore = useTextToMotionStore()

const motionActiveTab = ref<'create' | 'library'>('create')
const libraryFilter = ref<'all' | 'builtin' | 'saved' | 'uploaded'>('all')
const motionSearchQuery = ref('')

const motionPlaygroundPrompt = ref('')
const motionPlaygroundDuration = ref<'4s' | '6s' | '8s'>('6s')
const isGeneratingMotionPlayground = ref(false)
const motionPlaygroundStatusMessage = ref('')
const currentlyPlayingMotionKey = ref<string | null>(null)

interface LastMotionResultInfo {
  title: string
  prompt: string
  duration: string
  buffer?: Uint8Array
  fileName?: string
  blobUrl: string
  key?: string
  isSaved: boolean
}
const lastMotionResult = ref<LastMotionResultInfo | null>(null)
const quickPresetsCache = new Map<string, { buffer: Uint8Array, blobUrl: string }>()

const quickMotions = [
  {
    id: 'wave-hello',
    title: 'Wave hello',
    prompt: 'A person waving hello with their right hand while facing forward',
    duration: '4 sec',
    durationSeconds: 4,
    glyph: helloGlyph,
  },
  {
    id: 'blow-kiss',
    title: 'Blow a kiss',
    prompt: 'A person blowing a kiss with their right hand and leaning forward',
    duration: '6 sec',
    durationSeconds: 6,
    glyph: blowKissGlyph,
  },
  {
    id: 'graceful-bow',
    title: 'Graceful bow',
    prompt: 'A person bowing gracefully at the waist in greeting',
    duration: '6 sec',
    durationSeconds: 6,
    glyph: gracefulBowGlyph,
  },
  {
    id: 'celebrate',
    title: 'Celebrate',
    prompt: 'A person raising both arms in celebration and cheering',
    duration: '8 sec',
    durationSeconds: 8,
    glyph: celebrateGlyph,
  },
]

async function handleTriggerQuickMotion(qm: typeof quickMotions[number]) {
  if (!isVrmModel.value || isGeneratingMotionPlayground.value)
    return

  motionPlaygroundPrompt.value = qm.prompt

  if (quickPresetsCache.has(qm.id)) {
    const cached = quickPresetsCache.get(qm.id)!
    modelStore.triggerMotion(cached.blobUrl)
    currentlyPlayingMotionKey.value = qm.id
    lastMotionResult.value = {
      title: qm.title,
      prompt: qm.prompt,
      duration: qm.duration,
      buffer: cached.buffer,
      fileName: `${qm.id}.vrma`,
      blobUrl: cached.blobUrl,
      isSaved: false,
    }
    toast.info(`Playing ${qm.title}`)
    return
  }

  isGeneratingMotionPlayground.value = true
  motionPlaygroundStatusMessage.value = 'Diffusing...'

  try {
    const outputLength = Math.min(qm.durationSeconds * 20, 196)
    const result = await textToMotionStore.generateMotion(qm.prompt, {
      format: 'vrma',
      engine: 'flowmdm',
      outputLength,
      onLog: (msg) => { motionPlaygroundStatusMessage.value = msg },
    })

    if (result && result.buffer) {
      const blob = new Blob([result.buffer.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
      const blobUrl = URL.createObjectURL(blob)
      quickPresetsCache.set(qm.id, { buffer: result.buffer, blobUrl })

      modelStore.triggerMotion(blobUrl)
      currentlyPlayingMotionKey.value = qm.id
      lastMotionResult.value = {
        title: qm.title,
        prompt: qm.prompt,
        duration: qm.duration,
        buffer: result.buffer,
        fileName: result.fileName,
        blobUrl,
        isSaved: false,
      }
      toast.success(`${qm.title} playing on stage!`)
    }
  }
  catch (err: any) {
    console.error('[MotionStudio] Quick motion failed:', err)
    toast.error(`Motion failed: ${err.message || String(err)}`)
  }
  finally {
    isGeneratingMotionPlayground.value = false
    motionPlaygroundStatusMessage.value = ''
  }
}

async function handleGenerateAndPlay() {
  if (!isVrmModel.value)
    return

  const prompt = motionPlaygroundPrompt.value.trim()
  if (!prompt) {
    toast.error('Please describe a motion.')
    return
  }

  isGeneratingMotionPlayground.value = true
  motionPlaygroundStatusMessage.value = 'Preparing motion...'

  try {
    const durationSeconds = Number.parseInt(motionPlaygroundDuration.value, 10) || 6
    const outputLength = Math.min(durationSeconds * 20, 196)

    const result = await textToMotionStore.generateMotion(prompt, {
      format: 'vrma',
      engine: 'flowmdm',
      outputLength,
      onLog: (msg) => { motionPlaygroundStatusMessage.value = msg },
    })

    if (result && result.buffer) {
      const blob = new Blob([result.buffer.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
      const blobUrl = URL.createObjectURL(blob)

      modelStore.triggerMotion(blobUrl)
      currentlyPlayingMotionKey.value = 'last-result'

      const words = prompt.split(/\s+/).slice(0, 4).join(' ')
      const title = words.charAt(0).toUpperCase() + words.slice(1)

      lastMotionResult.value = {
        title,
        prompt,
        duration: `${durationSeconds} sec`,
        buffer: result.buffer,
        fileName: result.fileName,
        blobUrl,
        isSaved: false,
      }
      toast.success('Motion compiled and playing on stage!')
    }
  }
  catch (err: any) {
    console.error('[MotionStudio] Generation failed:', err)
    toast.error(`Motion generation failed: ${err.message || String(err)}`)
  }
  finally {
    isGeneratingMotionPlayground.value = false
    motionPlaygroundStatusMessage.value = ''
  }
}

async function handleSaveToLibrary() {
  if (!lastMotionResult.value || !lastMotionResult.value.buffer)
    return

  try {
    const file = new File(
      [lastMotionResult.value.buffer.buffer as ArrayBuffer],
      lastMotionResult.value.fileName || `flowmdm_${Date.now()}.vrma`,
      { type: 'model/gltf-binary' },
    )
    const key = await customVrmAnimationsStore.addCustomAnimation(file, { source: 'saved' })
    lastMotionResult.value.isSaved = true
    lastMotionResult.value.key = key
    toast.success('Saved to motion library!')
  }
  catch (err: any) {
    console.error('[MotionStudio] Save failed:', err)
    toast.error(`Save failed: ${err.message || String(err)}`)
  }
}

function handleReplayLastMotion() {
  if (lastMotionResult.value?.blobUrl) {
    modelStore.triggerMotion(lastMotionResult.value.blobUrl)
    currentlyPlayingMotionKey.value = 'last-result'
    toast.info(`Replaying "${lastMotionResult.value.title}"`)
  }
}

function handleEditPrompt() {
  if (lastMotionResult.value?.prompt) {
    motionPlaygroundPrompt.value = lastMotionResult.value.prompt
    motionActiveTab.value = 'create'
  }
}

function handleStopMotion() {
  modelStore.triggerMotion('__STOP__')
  currentlyPlayingMotionKey.value = null
  toast.info('Motion stopped')
}

interface LibraryMotionItem {
  key: string
  label: string
  source: 'builtin' | 'saved' | 'uploaded'
  duration: string
}

const libraryMotions = computed<LibraryMotionItem[]>(() => {
  const list: LibraryMotionItem[] = []

  if (isVrmModel.value) {
    const stockKeys = [
      'agent007',
      'aiCatDance',
      'armsSwing',
      'armsUpDownDance',
      'blingBang',
      'confidentPose',
      'cool',
      'crabDance',
      'energetic',
      'flamboyant',
      'grandstand',
      'hitoMania',
      'humansAreJustCylinders',
      'idleLoop',
      'innocent',
      'kawaiiKaiwai',
      'ladylake',
      'magicEyeWink',
      'peaceSign',
      'powerful',
      'showcase',
      'shy',
      'sittingToWave',
      'tetris',
    ]
    for (const key of stockKeys) {
      const formatted = key.replace(/([A-Z0-9])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
      list.push({
        key,
        label: formatted,
        source: 'builtin',
        duration: '4 sec',
      })
    }

    for (const anim of Object.values(customVrmAnimationsStore.customAnimations)) {
      const isSaved = anim.source === 'saved' || anim.originalFileName.startsWith('flowmdm_')
      list.push({
        key: anim.key,
        label: anim.name,
        source: isSaved ? 'saved' : 'uploaded',
        duration: isSaved ? '6 sec' : '5 sec',
      })
    }
  }

  let filtered = list
  if (libraryFilter.value !== 'all') {
    filtered = filtered.filter(item => item.source === libraryFilter.value)
  }

  if (motionSearchQuery.value.trim()) {
    const query = motionSearchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(item => item.label.toLowerCase().includes(query))
  }

  return filtered
})

function handlePlayLibraryMotion(item: LibraryMotionItem) {
  if (currentlyPlayingMotionKey.value === item.key) {
    handleStopMotion()
    return
  }

  modelStore.triggerMotion(item.key)
  currentlyPlayingMotionKey.value = item.key
}

function getLibraryMotionGlyph(item: LibraryMotionItem): string | undefined {
  const match = quickMotions.find(qm => qm.title.toLowerCase() === item.label.toLowerCase())
  return match?.glyph
}
</script>

<template>
  <StripPopover title="Motion" gap="3" @close="emit('close')">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="i-solar:walking-round-linear text-xl text-neutral-800 dark:text-neutral-100" />
          <h3 class="text-base text-neutral-900 font-bold dark:text-neutral-100">
            Motion
          </h3>
        </div>
        <button
          class="flex cursor-pointer items-center justify-center rounded-full p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          @click="emit('close')"
        >
          <span class="i-solar:close-circle-outline text-xl" />
        </button>
      </div>
    </template>

    <!-- Amber Notice: Non-VRM Model -->
    <div
      v-if="!isVrmModel"
      :class="[
        'flex flex-col items-center justify-center gap-3 p-5 my-1 text-center rounded-2xl',
        'border border-amber-500/30 bg-amber-500/10 dark:border-amber-500/25 dark:bg-amber-500/10',
      ]"
    >
      <div
        :class="[
          'flex items-center justify-center size-12 rounded-2xl',
          'bg-amber-500/20 text-amber-600 dark:text-amber-400',
        ]"
      >
        <span class="i-solar:danger-triangle-bold-duotone text-2xl" />
      </div>

      <div class="flex flex-col gap-1">
        <h4 class="text-sm text-amber-900 font-bold dark:text-amber-200">
          Only Compatible with VRM
        </h4>
        <p class="max-w-[240px] text-xs text-amber-700/90 leading-relaxed dark:text-amber-300/80">
          Motion Studio and 3D kinetic generation are only supported for 3D VRM humanoid avatars.
        </p>
      </div>

      <div
        v-if="currentModelFormatLabel"
        :class="[
          'mt-0.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
          'bg-amber-500/15 text-amber-800 border border-amber-500/20 dark:text-amber-300',
        ]"
      >
        <span>Active model:</span>
        <span class="font-bold uppercase">{{ currentModelFormatLabel }}</span>
      </div>

      <button
        type="button"
        :class="[
          'mt-1 w-full py-2 px-3 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-98',
          'bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 border border-amber-500/30 dark:text-amber-200',
        ]"
        @click="openSettingsRoute('/settings/stage')"
      >
        Switch Avatar in Stage Settings
      </button>
    </div>

    <!-- VRM Motion Studio Content -->
    <template v-else>
      <!-- Top Segmented Tabs: Create | Library -->
      <div class="grid grid-cols-2 border border-neutral-200/80 rounded-xl bg-neutral-100/90 p-1 dark:border-neutral-800 dark:bg-neutral-950/70">
        <button
          type="button"
          :class="[
            'py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer',
            motionActiveTab === 'create'
              ? 'bg-primary-500 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          ]"
          @click="motionActiveTab = 'create'"
        >
          Create
        </button>
        <button
          type="button"
          :class="[
            'py-1.5 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer',
            motionActiveTab === 'library'
              ? 'bg-primary-500 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100',
          ]"
          @click="motionActiveTab = 'library'"
        >
          Library
        </button>
      </div>

      <!-- TAB 1: CREATE -->
      <div v-if="motionActiveTab === 'create'" class="flex flex-col gap-3">
        <!-- Quick motions section -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[11px] text-neutral-600 font-bold dark:text-neutral-400">
            Quick motions
          </span>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="qm in quickMotions"
              :key="qm.id"
              type="button"
              :disabled="isGeneratingMotionPlayground"
              :class="[
                'group flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer active:scale-98',
                'bg-neutral-50/70 hover:bg-neutral-100/90 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/80',
                'border-neutral-200/70 hover:border-primary-500/60 dark:border-neutral-800 dark:hover:border-primary-500/50',
                isGeneratingMotionPlayground ? 'opacity-50 cursor-not-allowed' : '',
              ]"
              @click="handleTriggerQuickMotion(qm)"
            >
              <div class="h-9 w-9 flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
                <img :src="qm.glyph" :alt="qm.title" class="pointer-events-none max-h-full max-w-full select-none object-contain">
              </div>
              <span class="text-xs text-neutral-800 font-semibold leading-snug dark:text-neutral-200">
                {{ qm.title }}
              </span>
            </button>
          </div>
        </div>

        <!-- Describe a motion section -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[11px] text-neutral-600 font-bold dark:text-neutral-400">
            Describe a motion
          </span>
          <div class="relative">
            <textarea
              v-model="motionPlaygroundPrompt"
              :disabled="isGeneratingMotionPlayground"
              rows="2"
              maxlength="200"
              placeholder="Take two small steps sideways, then wave with your right hand."
              :class="[
                'w-full resize-none rounded-xl p-2.5 pb-6 text-xs transition-colors',
                'bg-neutral-100/80 dark:bg-neutral-950/60 border border-neutral-300 dark:border-neutral-800',
                'text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
                'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
              ]"
              @keydown.enter.prevent="handleGenerateAndPlay"
            />
            <span class="absolute bottom-2 right-2 text-[10px] text-neutral-400 font-mono">
              {{ motionPlaygroundPrompt.length }}/200
            </span>
          </div>
        </div>

        <!-- Duration Selector -->
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-600 font-medium dark:text-neutral-400">Duration</span>
          <div class="flex items-center gap-1 border border-neutral-200 rounded-lg bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-950">
            <button
              v-for="dur in (['4s', '6s', '8s'] as const)"
              :key="dur"
              type="button"
              :class="[
                'px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer',
                motionPlaygroundDuration === dur
                  ? 'bg-primary-500 text-white shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="motionPlaygroundDuration = dur"
            >
              {{ dur }}
            </button>
          </div>
        </div>

        <!-- Primary CTA Button -->
        <div class="flex flex-col gap-1">
          <button
            type="button"
            :disabled="isGeneratingMotionPlayground || !motionPlaygroundPrompt.trim()"
            :class="[
              'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all shadow-md cursor-pointer',
              isGeneratingMotionPlayground || !motionPlaygroundPrompt.trim()
                ? 'bg-primary-500/50 text-white/70 cursor-not-allowed shadow-none'
                : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/25 active:scale-[0.99]',
            ]"
            @click="handleGenerateAndPlay"
          >
            <span
              v-if="isGeneratingMotionPlayground"
              class="i-solar:restart-linear animate-spin text-base"
            />
            <span
              v-else
              class="i-solar:walking-round-linear text-base"
            />
            <span>
              {{ isGeneratingMotionPlayground ? (motionPlaygroundStatusMessage || 'Generating...') : 'Generate & play' }}
            </span>
          </button>
          <p class="text-center text-[10px] text-neutral-400 dark:text-neutral-500">
            Try freely. Save only what you like.
          </p>
        </div>
      </div>

      <!-- TAB 2: LIBRARY -->
      <div v-if="motionActiveTab === 'library'" class="flex flex-col gap-2.5">
        <!-- Search bar -->
        <div class="relative flex items-center">
          <span class="i-solar:magnifer-linear absolute left-2.5 text-sm text-neutral-400" />
          <input
            v-model="motionSearchQuery"
            type="text"
            placeholder="Search motions..."
            :class="[
              'w-full pl-8 pr-3 py-1.5 text-xs rounded-xl transition-colors',
              'bg-neutral-100/80 dark:bg-neutral-950/60 border border-neutral-300 dark:border-neutral-800',
              'text-neutral-800 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600',
              'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            ]"
          >
        </div>

        <!-- Filter pills: All | Built-in | Saved | Uploaded -->
        <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            v-for="flt in ([{ id: 'all', label: 'All' }, { id: 'builtin', label: 'Built-in' }, { id: 'saved', label: 'Saved' }, { id: 'uploaded', label: 'Uploaded' }] as const)"
            :key="flt.id"
            type="button"
            :class="[
              'px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all shrink-0 cursor-pointer',
              libraryFilter === flt.id
                ? 'bg-primary-500 text-white shadow-xs'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
            ]"
            @click="libraryFilter = flt.id"
          >
            {{ flt.label }}
          </button>
        </div>

        <!-- Motion Item List -->
        <div class="max-h-52 flex flex-col gap-1.5 overflow-y-auto py-0.5 scrollbar-thin">
          <div
            v-for="item in libraryMotions"
            :key="item.key"
            :class="[
              'flex items-center justify-between p-2 rounded-xl border text-xs transition-all',
              currentlyPlayingMotionKey === item.key
                ? 'border-primary-500/80 bg-primary-500/10 text-primary-900 dark:text-primary-100 ring-1 ring-primary-500/50'
                : 'border-neutral-200/70 bg-neutral-50/50 hover:bg-neutral-100/70 dark:border-neutral-800/80 dark:bg-neutral-950/40 dark:hover:bg-neutral-800/50 text-neutral-800 dark:text-neutral-200',
            ]"
          >
            <div class="min-w-0 flex flex-1 items-center gap-2.5">
              <img
                v-if="getLibraryMotionGlyph(item)"
                :src="getLibraryMotionGlyph(item)"
                class="pointer-events-none size-5 shrink-0 select-none object-contain opacity-80"
              >
              <span
                v-else
                class="i-solar:walking-round-linear shrink-0 text-base text-neutral-400 dark:text-neutral-500"
              />
              <div class="min-w-0 flex-1">
                <h5 class="truncate text-xs text-neutral-900 font-semibold dark:text-neutral-100">
                  {{ item.label }}
                </h5>
                <p class="text-[10px] text-neutral-400 capitalize">
                  {{ item.source === 'builtin' ? 'Built-in' : item.source === 'saved' ? 'Saved' : 'Uploaded' }} • {{ item.duration }}
                </p>
              </div>
            </div>

            <button
              type="button"
              :class="[
                'flex shrink-0 items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer',
                currentlyPlayingMotionKey === item.key
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'text-neutral-400 hover:bg-neutral-200/80 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
              ]"
              @click="handlePlayLibraryMotion(item)"
            >
              <span
                :class="currentlyPlayingMotionKey === item.key ? 'i-solar:stop-bold size-3.5' : 'i-solar:play-bold size-3.5'"
              />
            </button>
          </div>

          <!-- Empty state -->
          <div
            v-if="libraryMotions.length === 0"
            class="flex flex-col items-center justify-center py-6 text-center opacity-40"
          >
            <span class="i-solar:magic-stick-3-bold-duotone text-2xl" />
            <span class="mt-1 text-[10px]">No motions found</span>
          </div>
        </div>

        <!-- Manage motions link -->
        <button
          type="button"
          class="inline-flex cursor-pointer items-center justify-center gap-1 text-[11px] text-neutral-500 font-medium transition-colors hover:text-primary-500"
          @click="openSettingsRoute('/settings/airi-card')"
        >
          <span>Manage motions</span>
          <span class="i-solar:arrow-right-up-linear text-xs" />
        </button>
      </div>

      <!-- LAST RESULT CARD (Rendered on both tabs if available) -->
      <div
        v-if="lastMotionResult"
        class="flex flex-col gap-2 border border-neutral-200/80 rounded-xl bg-neutral-50/80 p-2.5 dark:border-neutral-800 dark:bg-neutral-950/60"
      >
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Last Result
          </span>
          <span
            :class="[
              'px-2 py-0.2 rounded-full text-[9px] font-bold border',
              lastMotionResult.isSaved
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-neutral-300 dark:border-neutral-700 text-neutral-500',
            ]"
          >
            {{ lastMotionResult.isSaved ? 'Saved' : 'Unsaved' }}
          </span>
        </div>

        <div class="min-w-0">
          <h4 class="truncate text-xs text-neutral-900 font-bold dark:text-neutral-100">
            {{ lastMotionResult.title }}
          </h4>
          <p class="text-[10px] text-neutral-400">
            {{ lastMotionResult.duration }}
          </p>
        </div>

        <!-- Action buttons: Replay, Edit prompt, Save to library -->
        <div class="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
            @click="handleReplayLastMotion"
          >
            <span class="i-solar:play-bold text-xs" />
            <span>Replay</span>
          </button>

          <button
            type="button"
            class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
            @click="handleEditPrompt"
          >
            <span class="i-solar:pen-linear text-xs" />
            <span>Edit prompt</span>
          </button>

          <button
            v-if="!lastMotionResult.isSaved"
            type="button"
            class="shadow-2xs flex flex-1 cursor-pointer items-center justify-center gap-1 border border-neutral-300 rounded-lg bg-white py-1.5 text-xs text-neutral-700 font-semibold transition active:scale-98 dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
            @click="handleSaveToLibrary"
          >
            <span class="i-solar:bookmark-linear text-xs" />
            <span>Save to library</span>
          </button>
        </div>
      </div>

      <!-- ALWAYS ACCESSIBLE BOTTOM FOOTER: STOP MOTION -->
      <div class="border-t border-neutral-200/60 pt-1 dark:border-neutral-800/80">
        <button
          type="button"
          class="w-full flex cursor-pointer items-center justify-center gap-2 py-1.5 text-xs text-neutral-600 font-semibold transition-colors dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
          @click="handleStopMotion"
        >
          <span class="i-solar:stop-bold size-3.5" />
          <span>Stop motion</span>
        </button>
      </div>
    </template>
  </StripPopover>
</template>
