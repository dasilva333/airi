<script setup lang="ts">
import { defaultModelParameters, useLive2d } from '@proj-airi/stage-ui-live2d'
import { OPFSCacheV2 } from '@proj-airi/stage-ui-live2d/utils/opfs-loader'
import { Button, Checkbox, FieldRange, SelectTab } from '@proj-airi/ui'
import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelCustomizer from './ModelCustomizer.vue'

import { useLHackStore } from '../../../../stores'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'
import { usePositioningStore } from '../../../../stores/settings/positioning'
import { Section } from '../../../layouts'
import { ColorPalette } from '../../../widgets'

const props = defineProps<{
  palette: string[]
  modelId?: string
}>()
defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()

const { t } = useI18n()

const lhackStore = useLHackStore()
const settings = useSettings()
const {
  live2dDisableFocus,
  live2dFollowSpeed,
  live2dAutoBlinkEnabled,
  live2dForceAutoBlinkEnabled,
  live2dShadowEnabled,
  live2dMaxFps,
} = storeToRefs(settings)

const mouseTrackingEnabled = computed({
  get: () => !live2dDisableFocus.value,
  set: (val) => {
    live2dDisableFocus.value = !val
  },
})

const live2d = useLive2d()
const {
  modelParameters,
} = storeToRefs(live2d)

const positioningStore = usePositioningStore()

const isReplayDisabledForModel = computed({
  get: () => {
    const modelId = props.modelId || 'global'
    return live2d.modelParamReplayDisabled[modelId] ?? true
  },
  set: (val) => {
    const modelId = props.modelId || 'global'
    live2d.modelParamReplayDisabled[modelId] = val
    live2d.modelParamReplayDisabled = { ...live2d.modelParamReplayDisabled }
  },
})

const scale = computed({
  get: () => positioningStore.getPosition(props.modelId || 'global').scale,
  set: (val) => {
    const pos = positioningStore.getPosition(props.modelId || 'global')
    positioningStore.setPosition(props.modelId || 'global', { ...pos, scale: val })
  },
})

const positionX = computed({
  get: () => positioningStore.getPosition(props.modelId || 'global').x,
  set: (val) => {
    const pos = positioningStore.getPosition(props.modelId || 'global')
    positioningStore.setPosition(props.modelId || 'global', { ...pos, x: val })
  },
})

const positionY = computed({
  get: () => positioningStore.getPosition(props.modelId || 'global').y,
  set: (val) => {
    const pos = positioningStore.getPosition(props.modelId || 'global')
    positioningStore.setPosition(props.modelId || 'global', { ...pos, y: val })
  },
})

const selectedRuntimeMotion = ref<string>('')
const selectedRuntimeMotionName = ref<string>('')
const runtimeMotions = ref<Array<{ name: string, fullPath: string, displayPath: string, group: string, index: number, sound?: string }>>([])
const showMotionSelector = ref(false)

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const motionMappings = ref<Record<string, string>>({})
const hiddenMotions = ref<string[]>([])

const saveLive2dState = useDebounceFn(async () => {
  if (!activeCard.value || !activeCardId.value)
    return

  const displayModelId = airiCardStore.getCardDisplayModelId(activeCardId.value)
  if (!displayModelId)
    return

  if (settings.stageModelSelected !== displayModelId)
    return

  const displayModelsStore = await import('../../../../stores/display-models').then(m => m.useDisplayModelsStore())
  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  if (model) {
    model.motionMappings = { ...motionMappings.value }
    model.hiddenMotions = [...hiddenMotions.value]
    const localforageModule = await import('localforage').then(m => m.default || m)
    await localforageModule.setItem(displayModelId, JSON.parse(JSON.stringify(model)))
    displayModelsStore.broadcastModelsSync(Date.now())
    await displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  }
}, 1000)

watch([motionMappings, hiddenMotions], () => {
  saveLive2dState()
}, { deep: true })

watch(activeCard, async (card) => {
  if (!card)
    return
  const displayModelId = airiCardStore.getCardDisplayModelId(activeCardId.value)
  if (!displayModelId)
    return

  const displayModelsStore = await import('../../../../stores/display-models').then(m => m.useDisplayModelsStore())
  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  if (model) {
    motionMappings.value = model.motionMappings || {}
    hiddenMotions.value = model.hiddenMotions || []
  }
}, { immediate: true })

const fpsOptions = computed(() => [
  { value: 0, label: t('settings.live2d.fps.options.unlimited') },
  { value: 60, label: '60' },
  { value: 30, label: '30' },
])

const customizationTabs = computed(() => [
  { value: 'customizer', label: 'Customizer', icon: 'i-solar:settings-bold-duotone' },
  { value: 'headFace', label: 'Face', icon: 'i-solar:user-bold-duotone' },
])
const activeCustomizationTab = ref('customizer')

const sceneTabs = computed(() => [
  { value: 'placement', label: 'Placement', icon: 'i-solar:minimalistic-magnifer-zoom-in-bold-duotone' },
])
const activeSceneTab = ref('placement')

// Get available runtime motions from the model
onMounted(() => {
  // Listen for available motions updates
  watch(() => live2d.availableMotions, (motions) => {
    // Show all motions with their full paths
    const uniqueMotions = new Map()
    motions.forEach((m) => {
      // Stable key combining group, file, and sound to collapse localized dupes
      const stableKey = `${m.motionName}::${m.fileName}::${m.sound || ''}`
      if (!uniqueMotions.has(stableKey)) {
        uniqueMotions.set(stableKey, {
          name: m.fileName.split('/').pop() || m.fileName,
          fullPath: m.fileName, // Full path like "hiyori_free_zh/runtime/motions/idle.motion3.json"
          displayPath: m.fileName, // Show full path for clarity
          group: m.motionName,
          index: m.motionIndex,
          sound: m.sound,
        })
      }
    })

    runtimeMotions.value = Array.from(uniqueMotions.values())

    console.info('Available motions:', runtimeMotions.value)
  }, { immediate: true })

  function loadSavedMotion(modelId: string) {
    const savedPath = localStorage.getItem(`live2d-${modelId}-selected-motion`)
    const savedName = localStorage.getItem(`live2d-${modelId}-selected-motion-name`)
    if (savedPath) {
      selectedRuntimeMotion.value = savedPath
    }
    else {
      selectedRuntimeMotion.value = ''
    }
    if (savedName) {
      selectedRuntimeMotionName.value = savedName
    }
    else {
      selectedRuntimeMotionName.value = 'None'
    }
  }

  // Restore selected motion
  loadSavedMotion(props.modelId || 'global')

  // Watch for model changes
  watch(() => props.modelId, (newId) => {
    loadSavedMotion(newId || 'global')
  })

  // Add click outside handler
  document.addEventListener('click', handleClickOutside)
})

// Function to reset all parameters to default values
function resetToDefaultParameters() {
  modelParameters.value = { ...defaultModelParameters }
}

const clearingCache = ref(false)

async function clearModelCache() {
  clearingCache.value = true
  try {
    await OPFSCacheV2.clearAll()
  }
  finally {
    clearingCache.value = false
  }
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-motion-selector]')) {
    showMotionSelector.value = false
  }
}

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// async function patchMotionMap(source: File, motionMap: Record<string, string>): Promise<File> {
//   if (!Object.keys(motionMap).length)
//     return source

//   const jsZip = new JSZip()
//   const zip = await jsZip.loadAsync(source)
//   const fileName = Object.keys(zip.files).find(key => key.endsWith('model3.json'))
//   if (!fileName) {
//     throw new Error('model3.json not found')
//   }

//   const model3Json = await zip.file(fileName)!.async('string')
//   const model3JsonObject = JSON.parse(model3Json)

//   const motions: Record<string, { File: string }[]> = {}
//   Object.entries(motionMap).forEach(([key, value]) => {
//     if (motions[value]) {
//       motions[value].push({ File: key })
//       return
//     }
//     motions[value] = [{ File: key }]
//   })

//   model3JsonObject.FileReferences.Motions = motions

//   zip.file(fileName, JSON.stringify(model3JsonObject, null, 2))
//   const zipBlob = await zip.generateAsync({ type: 'blob' })

//   return new File([zipBlob], source.name, {
//     type: source.type,
//     lastModified: source.lastModified,
//   })
// }

// async function saveMotionMap() {
//   const fileFromIndexedDB = await localforage.getItem<File>('live2dModel')
//   if (!fileFromIndexedDB) {
//     return
//   }

//   const patchedFile = await patchMotionMap(fileFromIndexedDB, motionMap.value)
//   modelFile.value = patchedFile
// }
</script>

<template>
  <!-- 1. Character Customizations -->
  <Section
    title="Character Customizations"
    icon="i-solar:user-bold-duotone"
    :class="['rounded-xl', 'bg-white/80 dark:bg-black/75', 'backdrop-blur-lg']"
    size="sm"
    :expand="true"
  >
    <SelectTab v-model="activeCustomizationTab" :options="customizationTabs" size="sm" compact class="mb-4" />

    <!-- Customizer Tab (Unified Expressions/Motions) -->
    <div v-if="activeCustomizationTab === 'customizer'">
      <ModelCustomizer :model-id="props.modelId || settings.stageModelSelected" :local-stage="true" />
    </div>

    <!-- Head & Face Tab -->
    <div v-else-if="activeCustomizationTab === 'headFace'" :class="['space-y-4']">
      <div :class="['flex', 'items-center', 'justify-between']">
        <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Auto Blink</span>
        <Checkbox v-model="live2dAutoBlinkEnabled" />
      </div>

      <div :class="['flex', 'items-center', 'justify-between']">
        <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Force Auto Blink (fallback)</span>
        <Checkbox v-model="live2dForceAutoBlinkEnabled" />
      </div>

      <div :class="['flex', 'items-center', 'justify-between']">
        <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Shadow</span>
        <Checkbox v-model="live2dShadowEnabled" />
      </div>

      <div :class="['mb-2', 'mt-4', 'text-xs', 'text-neutral-500', 'font-semibold', 'dark:text-neutral-400', 'uppercase', 'tracking-wider', 'opacity-50']">
        Head Rotation
      </div>
      <FieldRange v-model="modelParameters.angleX" as="div" :min="-30" :max="30" :step="0.1" label="Angle X">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Angle X</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.angleX = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="modelParameters.angleY" as="div" :min="-30" :max="30" :step="0.1" label="Angle Y">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Angle Y</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.angleY = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="modelParameters.angleZ" as="div" :min="-30" :max="30" :step="0.1" label="Angle Z">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Angle Z</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.angleZ = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>

      <div :class="['mb-2', 'mt-4', 'text-xs', 'text-neutral-500', 'font-semibold', 'dark:text-neutral-400', 'uppercase', 'tracking-wider', 'opacity-50']">
        Facial Features
      </div>
      <FieldRange v-model="modelParameters.leftEyeOpen" as="div" :min="0" :max="1" :step="0.01" label="Left Eye Open/Close">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Left Eye Open/Close</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.leftEyeOpen = 1">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="modelParameters.rightEyeOpen" as="div" :min="0" :max="1" :step="0.01" label="Right Eye Open/Close">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Right Eye Open/Close</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.rightEyeOpen = 1">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="modelParameters.mouthOpen" as="div" :min="0" :max="1" :step="0.01" label="Mouth Open/Close">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Mouth Open/Close</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.mouthOpen = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="modelParameters.cheek" as="div" :min="0" :max="1" :step="0.01" label="Cheek">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>Cheek</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => modelParameters.cheek = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
    </div>
  </Section>

  <!-- 2. Scene -->
  <Section
    title="Scene"
    icon="i-solar:clapperboard-edit-bold-duotone"
    :class="['rounded-xl', 'bg-white/80 dark:bg-black/75', 'backdrop-blur-lg']"
    size="sm"
    :expand="true"
  >
    <SelectTab v-model="activeSceneTab" :options="sceneTabs" size="sm" class="mb-4" />

    <div v-if="activeSceneTab === 'placement'" :class="['space-y-4']">
      <FieldRange v-model="scale" as="div" :min="0.1" :max="3" :step="0.01" :label="t('settings.live2d.scale-and-position.scale')">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>{{ t('settings.live2d.scale-and-position.scale') }}</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => scale = 1">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="positionX" as="div" :min="-100" :max="100" :step="1" :label="t('settings.live2d.scale-and-position.x')">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>{{ t('settings.live2d.scale-and-position.x') }}</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => positionX = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
      <FieldRange v-model="positionY" as="div" :min="-100" :max="100" :step="1" :label="t('settings.live2d.scale-and-position.y')">
        <template #label>
          <div :class="['flex', 'items-center']">
            <div>{{ t('settings.live2d.scale-and-position.y') }}</div>
            <button :class="['px-2', 'text-xs', 'outline-none']" title="Reset value to default" @click="() => positionY = 0">
              <div :class="['i-solar:forward-linear', 'transform-scale-x--100', 'text-neutral-500', 'dark:text-neutral-400']" />
            </button>
          </div>
        </template>
      </FieldRange>
    </div>
  </Section>

  <!-- 3. Advanced -->
  <Section
    title="Advanced"
    icon="i-solar:settings-bold-duotone"
    :class="['rounded-xl', 'bg-white/80 dark:bg-black/75', 'backdrop-blur-lg']"
    size="sm"
    :expand="false"
  >
    <div :class="['space-y-6']">
      <!-- Mouse Tracking -->
      <div :class="['flex', 'items-center', 'justify-between']">
        <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Mouse Tracking</span>
        <Checkbox v-model="mouseTrackingEnabled" />
      </div>

      <!-- Follow Speed -->
      <div v-if="mouseTrackingEnabled" :class="['space-y-2']">
        <FieldRange
          v-model="live2dFollowSpeed"
          :min="0.01"
          :max="1"
          :step="0.01"
          label="Follow Speed"
        >
          <template #label>
            <div :class="['flex', 'items-center', 'justify-between', 'w-full']">
              <div>Follow Speed</div>
              <div class="text-xs font-bold font-mono">
                {{ live2dFollowSpeed.toFixed(2) }}
              </div>
            </div>
          </template>
        </FieldRange>
      </div>

      <!-- FPS -->
      <div :class="['flex', 'items-center', 'justify-between']">
        <div :class="['flex', 'flex-col', 'gap-1']">
          <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">{{ t('settings.live2d.fps.title') }}</span>
          <span :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">{{ t('settings.live2d.fps.description') }}</span>
        </div>
        <SelectTab v-model="live2dMaxFps" :options="fpsOptions" size="sm" :class="['w-48', 'shrink-0']" />
      </div>

      <!-- Disable Custom Parameter Replay -->
      <div :class="['flex', 'items-center', 'justify-between']">
        <div :class="['flex', 'flex-col', 'gap-1']">
          <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Disable Custom Parameter Replay</span>
          <span :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">Bypasses raw parameter overrides to prevent conflicts during motion animations (recommended for Juewa).</span>
        </div>
        <Checkbox v-model="isReplayDisabledForModel" />
      </div>

      <!-- Extract Colors -->
      <div :class="['flex', 'flex-col', 'gap-2']">
        <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">Theme Extraction</span>
        <ColorPalette :colors="palette.map(hex => ({ hex, name: hex }))" :class="['mx-auto', 'mb-2']" />
        <Button variant="secondary" @click="$emit('extractColorsFromModel')">
          {{ t('settings.live2d.theme-color-from-model.button-extract.title') }}
        </Button>
      </div>

      <!-- L-HACK Editor -->
      <div flex="~ col gap-2">
        <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
          L-HACK Editor
        </div>
        <Button
          :variant="lhackStore.isHackerModeActive ? 'primary' : 'secondary'"
          @click="lhackStore.toggleHackerMode"
        >
          <template #icon>
            <div i-solar:mask-h-bold-duotone />
          </template>
          L-HACK Dashboard
        </Button>
        <p class="mb-2 px-1 text-[10px] text-neutral-400">
          Open the Live2D Hacker Inspector for surgical drawable and atlas modding.
        </p>
      </div>

      <!-- Technical Utils -->
      <div :class="['flex', 'flex-col', 'gap-2']">
        <button
          :class="['w-full', 'border', 'rounded', 'bg-neutral-100', 'px-4', 'py-2', 'text-sm', 'text-neutral-700', 'font-medium', 'transition-colors', 'dark:border-neutral-700', 'dark:bg-neutral-800', 'hover:bg-neutral-200', 'dark:text-neutral-300', 'dark:hover:bg-neutral-700']"
          @click="resetToDefaultParameters"
        >
          Reset To Default Parameters
        </button>

        <button
          :class="['w-full', 'border', 'rounded', 'bg-neutral-100', 'px-4', 'py-2', 'text-sm', 'text-neutral-700', 'font-medium', 'transition-colors', 'dark:border-neutral-700', 'dark:bg-neutral-800', 'hover:bg-neutral-200', 'dark:text-neutral-300', 'dark:hover:bg-neutral-700']"
          :disabled="clearingCache"
          @click="clearModelCache"
        >
          {{ clearingCache ? 'Clearing...' : 'Clear Model Cache' }}
        </button>
      </div>
    </div>
  </Section>
</template>
