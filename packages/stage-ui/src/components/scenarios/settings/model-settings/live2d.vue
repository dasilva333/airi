<script setup lang="ts">
import { defaultModelParameters, useLive2d } from '@proj-airi/stage-ui-live2d'
import { OPFSCacheV2 } from '@proj-airi/stage-ui-live2d/utils/opfs-loader'
import { Button, Checkbox, FieldRange, SelectTab } from '@proj-airi/ui'
import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Live2DCustomization from './live2d-customization.vue'

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
  live2dIdleAnimationEnabled,
  live2dAutoBlinkEnabled,
  live2dForceAutoBlinkEnabled,
  live2dShadowEnabled,
  live2dMaxFps,
} = storeToRefs(settings)

const live2d = useLive2d()
const {
  modelParameters,
  currentMotion,
} = storeToRefs(live2d)

const positioningStore = usePositioningStore()

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
const runtimeMotions = ref<Array<{ name: string, fullPath: string, displayPath: string, group: string, index: number }>>([])
const showMotionSelector = ref(false)

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const motionMappings = ref<Record<string, string>>({})
const hiddenMotions = ref<string[]>([])
const showHiddenMotions = ref(false)
const filterRenamedOnly = ref(false)
const editingMotionKey = ref<string | null>(null)
const editingMotionValue = ref('')

const saveLive2dState = useDebounceFn(() => {
  if (!activeCard.value || !activeCardId.value)
    return

  // Only auto-save customization state if this model is actually applied to the active character card.
  // This prevents auto-save triggers from corrupting/polluting the active card before "Apply" is clicked,
  // and avoids cross-process local storage sync race conditions that revert the selected preview model.
  if (settings.stageModelSelected !== airiCardStore.getCardDisplayModelId(activeCardId.value))
    return

  const extensions = JSON.parse(JSON.stringify(activeCard.value.extensions))
  if (!extensions.airi)
    extensions.airi = { modules: {} }
  if (!extensions.airi.modules)
    extensions.airi.modules = {}

  extensions.airi.modules.live2d = {
    ...extensions.airi.modules.live2d,
    motionMappings: { ...motionMappings.value },
    hiddenMotions: [...hiddenMotions.value],
  }

  airiCardStore.updateCard(activeCardId.value, { extensions })
}, 1000)

watch([motionMappings, hiddenMotions], () => {
  saveLive2dState()
}, { deep: true })

watch(activeCard, (card) => {
  if (card?.extensions?.airi?.modules?.live2d) {
    const live2dData = card.extensions.airi.modules.live2d as any
    motionMappings.value = live2dData.motionMappings || {}
    hiddenMotions.value = live2dData.hiddenMotions || []
  }
}, { immediate: true })
const filteredMotions = computed(() => {
  return runtimeMotions.value.filter((motion) => {
    // Filter hidden
    if (!showHiddenMotions.value && hiddenMotions.value.includes(motion.fullPath)) {
      return false
    }
    // Filter renamed
    if (filterRenamedOnly.value && !motionMappings.value[motion.fullPath]) {
      return false
    }
    return true
  })
})

function getDisplayName(motion: any) {
  return motionMappings.value[motion.fullPath] || motion.name
}

function isHidden(fullPath: string) {
  return hiddenMotions.value.includes(fullPath)
}

function toggleVisibility(fullPath: string) {
  if (hiddenMotions.value.includes(fullPath)) {
    hiddenMotions.value = hiddenMotions.value.filter(p => p !== fullPath)
  }
  else {
    hiddenMotions.value = [...hiddenMotions.value, fullPath]
  }
}

function startEditing(motion: any) {
  editingMotionKey.value = motion.fullPath
  editingMotionValue.value = motionMappings.value[motion.fullPath] || ''
}

function saveMotionName(fullPath: string) {
  if (editingMotionValue.value.trim() === '') {
    const updated = { ...motionMappings.value }
    delete updated[fullPath]
    motionMappings.value = updated
  }
  else {
    motionMappings.value = { ...motionMappings.value, [fullPath]: editingMotionValue.value.trim() }
  }
  editingMotionKey.value = null
  editingMotionValue.value = ''
}

function cancelEditing() {
  editingMotionKey.value = null
  editingMotionValue.value = ''
}

const fpsOptions = computed(() => [
  { value: 0, label: t('settings.live2d.fps.options.unlimited') },
  { value: 60, label: '60' },
  { value: 30, label: '30' },
])

const customizationTabs = computed(() => [
  { value: 'expressions', label: 'Expressions', icon: 'i-solar:face-scan-circle-bold-duotone' },
  { value: 'animations', label: 'Motions', icon: 'i-solar:play-bold-duotone' },
  { value: 'headFace', label: 'Face', icon: 'i-solar:user-bold-duotone' },
])
const activeCustomizationTab = ref('expressions')

const sceneTabs = computed(() => [
  { value: 'placement', label: 'Placement', icon: 'i-solar:minimalistic-magnifer-zoom-in-bold-duotone' },
])
const activeSceneTab = ref('placement')

// Get available runtime motions from the model
onMounted(() => {
  // Listen for available motions updates
  watch(() => live2d.availableMotions, (motions) => {
    // Show all motions with their full paths
    runtimeMotions.value = motions.map(m => ({
      name: m.fileName.split('/').pop() || m.fileName,
      fullPath: m.fileName, // Full path like "hiyori_free_zh/runtime/motions/idle.motion3.json"
      displayPath: m.fileName, // Show full path for clarity
      group: m.motionName,
      index: m.motionIndex,
    }))

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

// Runtime motion selection handlers
function isMotionInCycle(motion: any) {
  const cardIdleAnimations = activeCard.value?.extensions?.airi?.acting?.idleAnimations || []
  const expectedKey = `live2d:${motion.group}:${motion.index}:${motion.fullPath}`
  return cardIdleAnimations.includes(expectedKey)
}

function toggleMotionInCycle(motion: any) {
  if (!activeCardId.value || !activeCard.value)
    return

  const expectedKey = `live2d:${motion.group}:${motion.index}:${motion.fullPath}`
  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(expectedKey)
    ? current.filter(k => k !== expectedKey)
    : [...current, expectedKey]

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions.airi,
        acting: {
          ...activeCard.value.extensions.airi.acting,
          idleAnimations: next,
        },
      },
    },
  })
}

function handleMotionSelect(motion: any) {
  const modelId = props.modelId || 'global'

  // Click currently active motion to toggle it off (Set to "None" state)
  if (currentMotion.value?.group === motion.group && currentMotion.value?.index === motion.index) {
    selectedRuntimeMotion.value = ''
    selectedRuntimeMotionName.value = 'None'
    localStorage.removeItem(`live2d-${modelId}-selected-motion`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-name`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-group`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-index`)

    currentMotion.value = { group: '', index: -1 }
    showMotionSelector.value = false
    return
  }

  if (motion.displayPath === '') {
    selectedRuntimeMotion.value = ''
    selectedRuntimeMotionName.value = 'None'
    localStorage.removeItem(`live2d-${modelId}-selected-motion`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-name`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-group`)
    localStorage.removeItem(`live2d-${modelId}-selected-motion-index`)

    live2dIdleAnimationEnabled.value = false
    currentMotion.value = { group: 'Idle', index: 0 }
    showMotionSelector.value = false
    return
  }

  selectedRuntimeMotion.value = motion.displayPath // Store full path
  selectedRuntimeMotionName.value = motion.name // Store just the filename for display
  localStorage.setItem(`live2d-${modelId}-selected-motion`, motion.displayPath)
  localStorage.setItem(`live2d-${modelId}-selected-motion-name`, motion.name)
  localStorage.setItem(`live2d-${modelId}-selected-motion-group`, motion.group)
  localStorage.setItem(`live2d-${modelId}-selected-motion-index`, motion.index.toString())

  // Enable idle animation
  live2dIdleAnimationEnabled.value = true

  // Set the current motion to the selected runtime motion
  currentMotion.value = { group: motion.group, index: motion.index }

  showMotionSelector.value = false
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

    <!-- Expressions Tab -->
    <div v-if="activeCustomizationTab === 'expressions'">
      <Live2DCustomization />
    </div>

    <!-- Animations Tab -->
    <div v-else-if="activeCustomizationTab === 'animations'">
      <div :class="['w-full']">
        <div data-motion-selector :class="['relative', 'flex', 'flex-col', 'gap-2']">
          <!-- Controls Bar -->
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex gap-1">
              <Button
                size="sm"
                :variant="showHiddenMotions ? 'primary' : 'secondary'"
                @click="showHiddenMotions = !showHiddenMotions"
              >
                <template #icon>
                  <div :class="showHiddenMotions ? 'i-solar:eye-bold-duotone' : 'i-solar:eye-closed-bold-duotone'" />
                </template>
                {{ showHiddenMotions ? 'Showing Hidden' : 'Hide Hidden' }}
              </Button>
              <Button
                size="sm"
                :variant="filterRenamedOnly ? 'primary' : 'secondary'"
                @click="filterRenamedOnly = !filterRenamedOnly"
              >
                <template #icon>
                  <div class="i-solar:pen-bold-duotone" />
                </template>
                {{ filterRenamedOnly ? 'Renamed Only' : 'All' }}
              </Button>
            </div>
            <div class="text-xs text-neutral-500">
              {{ filteredMotions.length }} motions
            </div>
          </div>

          <!-- Fixed Height Scrollable List -->
          <div class="max-h-[300px] overflow-y-auto border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div v-if="filteredMotions.length === 0" class="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
              No motions match filters
            </div>
            <div
              v-for="motion in filteredMotions"
              :key="`${motion.group}-${motion.index}-${motion.fullPath}`"
              :class="[
                'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors',
                currentMotion?.group === motion.group && currentMotion?.index === motion.index ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
            >
              <!-- Left Side: Name and Path -->
              <div class="min-w-0 flex-1 cursor-pointer" @click="handleMotionSelect(motion)">
                <div class="flex items-center gap-2">
                  <!-- Active Indicator -->
                  <div v-if="currentMotion?.group === motion.group && currentMotion?.index === motion.index" class="h-2 w-2 rounded-full bg-primary-500" />

                  <!-- Name (Editable) -->
                  <div v-if="editingMotionKey === motion.fullPath" class="flex flex-1 items-center gap-1.5" @click.stop>
                    <span class="inline-flex items-center rounded-md bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700 font-semibold ring-1 ring-primary-700/10 ring-inset dark:bg-primary-900/30 dark:text-primary-400 dark:ring-primary-400/20">
                      {{ motion.group }}
                    </span>
                    <input
                      v-model="editingMotionValue"
                      type="text"
                      :placeholder="motion.name"
                      class="max-w-[230px] w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                      @keydown.enter="saveMotionName(motion.fullPath)"
                      @keydown.esc="cancelEditing"
                    >
                    <button class="text-xs text-green-500 hover:text-green-600" @click="saveMotionName(motion.fullPath)">
                      <div class="i-solar:check-circle-bold-duotone text-lg" />
                    </button>
                    <button class="text-xs text-red-500 hover:text-red-600" @click="cancelEditing">
                      <div class="i-solar:close-circle-bold-duotone text-lg" />
                    </button>
                  </div>
                  <div v-else class="max-w-[230px] flex items-center gap-1.5 truncate text-sm text-neutral-900 font-medium dark:text-neutral-100">
                    <span class="inline-flex items-center rounded-md bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700 font-semibold ring-1 ring-primary-700/10 ring-inset dark:bg-primary-900/30 dark:text-primary-400 dark:ring-primary-400/20">
                      {{ motion.group }}
                    </span>
                    <span class="truncate">{{ getDisplayName(motion) }}</span>
                  </div>
                </div>
                <div class="ml-4 max-w-[230px] truncate text-xs text-neutral-500 dark:text-neutral-400">
                  {{ motion.displayPath }}
                </div>
              </div>

              <!-- Right Side: Actions -->
              <div class="flex items-center gap-1" @click.stop>
                <!-- Loop / Cycle Toggle -->
                <button
                  class="rounded p-1 transition-colors"
                  :class="[
                    isMotionInCycle(motion)
                      ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                      : 'text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800',
                  ]"
                  :title="isMotionInCycle(motion) ? 'Remove from Idle Cycle' : 'Add to Idle Cycle'"
                  @click="toggleMotionInCycle(motion)"
                >
                  <div class="i-solar:infinity-bold-duotone text-sm" />
                </button>

                <!-- Edit Button -->
                <button
                  class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  title="Rename"
                  @click="startEditing(motion)"
                >
                  <div class="i-solar:pen-bold-duotone text-sm" />
                </button>

                <!-- Visibility Toggle -->
                <button
                  class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                  :title="isHidden(motion.fullPath) ? 'Show' : 'Hide'"
                  @click="toggleVisibility(motion.fullPath)"
                >
                  <div :class="isHidden(motion.fullPath) ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
        <Checkbox v-model="live2dDisableFocus" />
      </div>

      <!-- FPS -->
      <div :class="['flex', 'items-center', 'justify-between']">
        <div :class="['flex', 'flex-col', 'gap-1']">
          <span :class="['text-sm', 'text-neutral-600', 'dark:text-neutral-400']">{{ t('settings.live2d.fps.title') }}</span>
          <span :class="['text-xs', 'text-neutral-500', 'dark:text-neutral-400']">{{ t('settings.live2d.fps.description') }}</span>
        </div>
        <SelectTab v-model="live2dMaxFps" :options="fpsOptions" size="sm" :class="['w-48', 'shrink-0']" />
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
