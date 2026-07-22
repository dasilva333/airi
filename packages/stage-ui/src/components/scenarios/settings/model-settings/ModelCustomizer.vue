<script setup lang="ts">
import localforage from 'localforage'

import { useLive2d } from '@proj-airi/stage-ui-live2d/stores'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettingsControlStrip } from '../../../../stores/settings/control-strip'

interface Props {
  modelId: string
  showInsertActions?: boolean
  palette?: string[]
  /**
   * When true, the component is embedded inside a self-contained settings page
   * that already has its own stage preview. Clicks will effectuate that stage
   * directly without requiring the actor window to be open.
   */
  localStage?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showInsertActions: false,
  palette: () => [],
  localStage: false,
})

const emit = defineEmits<{
  (e: 'insert-token', token: string): void
  (e: 'update:visible-capabilities', payload: { emotions: string[], motions: string[] }): void
}>()

// Setup Stores
const airiCardStore = useAiriCardStore()
const controlStripStore = useSettingsControlStrip()
const displayModelsStore = useDisplayModelsStore()

const live2dStore = useLive2d()
const mmdStore = useMmd()
const spineStore = useSpine()
const modelStore = useModelStore() // VRM
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { stageEnabled } = storeToRefs(controlStripStore)

// Resolve Model Format
const currentModel = computed(() => {
  return displayModelsStore.displayModels.find(m => m.id === props.modelId)
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  if (!currentModel.value)
    return 'unknown'
  const fmt = currentModel.value.format
  if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
    return 'live2d'
  if (fmt === DisplayModelFormat.VRM)
    return 'vrm'
  if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
    return 'mmd'
  if (fmt === DisplayModelFormat.SpineZip)
    return 'spine'
  return 'unknown'
})

// Unified interface mappings
interface UnifiedExpression {
  key: string
  displayName: string
  isActive: boolean
  actMapping?: string
  isFavorite: boolean
  isVisible: boolean
  category?: string
}

interface UnifiedMotion {
  key: string
  displayName: string
  isActive: boolean
  group: string
  duration: number
  hasSound: boolean
  isInIdleCycle: boolean
  isVisible: boolean
}

// Local mappings state
const emotionMappings = ref<Record<string, string>>({})
const favoriteExpressions = ref<string[]>([])
const hiddenExpressions = ref<string[]>([])
const motionMappings = ref<Record<string, string>>({})
const hiddenMotions = ref<string[]>([])

// Raw capability lists sourced from getOrLoadModelCapabilities
// These are model-file-level, not renderer-runtime — works even when model is off-stage
const cachedExpressions = ref<string[]>([])
const cachedMotions = ref<string[]>([])
const capabilitiesLoading = ref(false)

// Sync local state + capabilities when modelId changes
watch(() => props.modelId, async (newId) => {
  if (!newId)
    return

  const model = displayModelsStore.displayModels.find(m => m.id === newId)
  console.log(`[ModelCustomizer] modelId changed → ${newId}`, {
    found: !!model,
    format: model?.format,
    cachedExpressions: model?.expressions?.length ?? 'none',
    cachedMotions: model?.motions?.length ?? 'none',
    emotionMappings: model?.emotionMappings,
    motionMappings: model?.motionMappings,
  })

  if (model) {
    emotionMappings.value = model.emotionMappings || {}
    favoriteExpressions.value = model.favoriteExpressions || []
    hiddenExpressions.value = model.hiddenExpressions || []
    motionMappings.value = model.motionMappings || {}
    hiddenMotions.value = model.hiddenMotions || []

    // Sync to store for stage window cross-process triggers
    live2dStore.motionMap = { ...motionMappings.value }
    live2dStore.emotionMappings = { ...emotionMappings.value }
  }

  // Resolve expression + motion lists via the store resolver.
  // Returns cache hit immediately, otherwise parses raw file and writes back to IndexedDB.
  capabilitiesLoading.value = true
  try {
    const caps = await displayModelsStore.getOrLoadModelCapabilities(newId)
    cachedExpressions.value = caps.expressions
    cachedMotions.value = caps.motions
    console.log(`[ModelCustomizer] capabilities resolved for ${newId}:`, {
      expressions: caps.expressions,
      motions: caps.motions,
    })
  }
  catch (e) {
    console.error(`[ModelCustomizer] Failed to load capabilities for ${newId}:`, e)
    cachedExpressions.value = []
    cachedMotions.value = []
  }
  finally {
    capabilitiesLoading.value = false
  }
}, { immediate: true })

// Persist metadata updates back to IndexedDB
async function saveMetadata() {
  const model = displayModelsStore.displayModels.find(m => m.id === props.modelId)
  if (model) {
    model.emotionMappings = { ...emotionMappings.value }
    model.favoriteExpressions = [...favoriteExpressions.value]
    model.hiddenExpressions = [...hiddenExpressions.value]
    model.motionMappings = { ...motionMappings.value }
    model.hiddenMotions = [...hiddenMotions.value]
    await localforage.setItem(props.modelId, JSON.parse(JSON.stringify(model)))

    // Sync to store for stage window cross-process triggers
    live2dStore.motionMap = { ...motionMappings.value }
    live2dStore.emotionMappings = { ...emotionMappings.value }

    displayModelsStore.broadcastModelsSync(Date.now())
    await displayModelsStore.loadDisplayModelsFromIndexedDB(true)
  }
}

function normalizeVrmKey(key: string): string {
  // Strip prefixes
  const prefixes = [
    /^Face\.M_F00_000_00_Fcl_ALL_/i,
    /^Face\.M_F00_000_00_Fcl_/i,
    /^Face\.M_F00_000_00_/i,
    /^Fcl_ALL_/i,
    /^Fcl_BRW_/i,
    /^Fcl_/i,
    /^vrc\.v_/i,
    /^vrc_/i,
    /^vrc\./i,
    /^INA-/i,
    /^ARKit_BS\./i,
    /^ARKit_/i,
  ]
  let clean = key
  for (const p of prefixes) {
    clean = clean.replace(p, '')
  }

  // Split camelCase
  clean = clean.replace(/(?<=[a-z])(?=[A-Z])/g, ' ')
  clean = clean.replace(/(?<=[A-Z])(?=[A-Z][a-z])/g, ' ')

  // Replace delimiters with spaces
  clean = clean.replace(/[_\-.]/g, ' ')

  // Title Case
  clean = clean.split(/\s+/).map((word) => {
    if (!word)
      return ''
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ').trim()

  return clean || key
}

// Expression/motion lists driven by getOrLoadModelCapabilities (not live renderer stores).
// isActive still reads from the renderer for on-stage feedback, but the list itself is
// sourced from the model file — works whether or not the model is currently on stage.
const rawExpressions = computed<UnifiedExpression[]>(() => {
  const mType = modelType.value
  if (mType === 'unknown' || capabilitiesLoading.value)
    return []

  const mappings = emotionMappings.value
  const favorites = favoriteExpressions.value
  const hidden = hiddenExpressions.value
  const keys = cachedExpressions.value

  if (mType === 'live2d') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || key,
      isActive: !!live2dStore.activeExpressions[key],
      actMapping: mappings[key],
      isFavorite: favorites.includes(key),
      isVisible: !hidden.includes(key),
    }))
  }
  if (mType === 'vrm') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || normalizeVrmKey(key),
      isActive: false,
      actMapping: mappings[key],
      isFavorite: favorites.includes(key),
      isVisible: !hidden.includes(key),
      category: key === key.toUpperCase() ? 'preset' : 'custom',
    }))
  }
  if (mType === 'mmd') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || key,
      isActive: mmdStore.previewExpression === key,
      actMapping: mappings[key],
      isFavorite: favorites.includes(key),
      isVisible: !hidden.includes(key),
    }))
  }
  if (mType === 'spine') {
    const activeVar = spineStore.currentVariant
    const activeSkin = spineStore.currentSkin

    return keys.map((key) => {
      const match = key.match(/^(.+?)\s*\[(.+?)\]$/)
      let active = false
      if (match) {
        const variant = match[1].trim()
        const skin = match[2].trim()
        active = activeVar === variant && activeSkin === skin
      }
      else {
        active = activeVar === key
      }
      return {
        key,
        displayName: mappings[key] || key,
        isActive: active,
        actMapping: mappings[key],
        isFavorite: favorites.includes(key),
        isVisible: !hidden.includes(key),
      }
    })
  }
  return []
})

const rawMotions = computed<UnifiedMotion[]>(() => {
  const card = activeCard.value
  const mType = modelType.value
  if (mType === 'unknown' || capabilitiesLoading.value)
    return []

  const mappings = motionMappings.value
  const hidden = hiddenMotions.value
  const idleCycles = card?.extensions?.airi?.acting?.idleAnimations || []
  const keys = cachedMotions.value

  if (mType === 'live2d') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || key,
      isActive: live2dStore.currentMotion?.group === key,
      group: 'Motions',
      duration: 3.0,
      hasSound: false,
      isInIdleCycle: idleCycles.includes(`live2d:${key}`),
      isVisible: !hidden.includes(key),
    }))
  }
  if (mType === 'mmd') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || key.split(/[\\/]/).pop() || key,
      isActive: mmdStore.currentMotion === key,
      group: 'Animations',
      duration: 5.0,
      hasSound: false,
      isInIdleCycle: idleCycles.includes(`mmd:${key}`),
      isVisible: !hidden.includes(key),
    }))
  }
  if (mType === 'spine') {
    return keys.map(key => ({
      key,
      displayName: mappings[key] || key,
      isActive: false,
      group: 'Animations',
      duration: 1.0,
      hasSound: false,
      isInIdleCycle: idleCycles.includes(`spine:${key}`),
      isVisible: !hidden.includes(key),
    }))
  }
  if (mType === 'vrm') {
    return customVrmAnimationsStore.animationOptions.map(option => ({
      key: option.value,
      displayName: option.label,
      isActive: modelStore.vrmIdleAnimation === option.value,
      group: option.value.startsWith('custom-vrma:') ? 'Custom Animations' : 'Built-in Animations',
      duration: 3.0,
      hasSound: false,
      isInIdleCycle: idleCycles.includes(option.value),
      isVisible: !hidden.includes(option.value),
    }))
  }
  return []
})

// Filter states
const activeTab = ref<'expressions' | 'motions'>('expressions')
const showHidden = ref(false)
const filterRenamedOnly = ref(false)
const editingKey = ref<string | null>(null)
const editingValue = ref('')

const expressionsToRender = computed(() => {
  let list = showHidden.value ? rawExpressions.value : rawExpressions.value.filter(e => e.isVisible)
  if (filterRenamedOnly.value) {
    list = list.filter(e => e.displayName !== e.key)
  }
  return list
})

const motionsToRender = computed(() => {
  const groups: Record<string, UnifiedMotion[]> = {}
  for (const m of rawMotions.value) {
    if (!showHidden.value && !m.isVisible)
      continue
    if (filterRenamedOnly.value && m.displayName === m.key)
      continue
    if (!groups[m.group])
      groups[m.group] = []
    groups[m.group].push(m)
  }
  return groups
})

watch([expressionsToRender, motionsToRender], () => {
  emit('update:visible-capabilities', {
    emotions: expressionsToRender.value.map(e => e.displayName),
    motions: Object.values(motionsToRender.value).flat().map(m => m.displayName),
  })
}, { deep: true, immediate: true })

// Warnings detection
const hasTechnicalKeys = computed(() => {
  const technicalRegex = /(\.json|\.vmd|expression_|morph_|\d)/i
  return rawExpressions.value.some(e => e.isVisible && technicalRegex.test(e.key) && e.displayName === e.key)
})

// Trigger Click-to-Effectuate on Stage
function triggerExpressionEffect(key: string) {
  if (!props.localStage && !stageEnabled.value) {
    toast.error('Stage window must be open to preview expressions.')
    return
  }
  if (modelType.value === 'live2d') {
    live2dStore.triggerEmotion(key, 1.0)
  }
  else if (modelType.value === 'vrm') {
    modelStore.triggerEmotion(key, 1.0)
  }
  else if (modelType.value === 'mmd') {
    mmdStore.previewExpression = key
    setTimeout(() => {
      if (mmdStore.previewExpression === key)
        mmdStore.previewExpression = null
    }, 2000)
  }
  else if (modelType.value === 'spine') {
    const match = key.match(/^(.+?)\s*\[(.+?)\]$/)
    if (match) {
      const variant = match[1].trim()
      const skin = match[2].trim()
      spineStore.selectVariantAndSkin(variant, skin)
    }
    else {
      spineStore.selectVariantAndSkin(key, 'default')
    }
  }
  toast.info(`Triggered expression: ${key}`)
}

function triggerMotionEffect(key: string) {
  if (!props.localStage && !stageEnabled.value) {
    toast.error('Stage window must be open to preview motions.')
    return
  }
  if (modelType.value === 'live2d') {
    live2dStore.triggerMotion(key)
  }
  else if (modelType.value === 'vrm') {
    modelStore.triggerMotion(key)
  }
  else if (modelType.value === 'mmd') {
    mmdStore.playOneShotAction(key)
  }
  else if (modelType.value === 'spine') {
    spineStore.playOneShotAnimation(key)
  }
  toast.info(`Triggered motion: ${key}`)
}

// Rename Label persisting
function startEditing(key: string, currentDisplayName: string) {
  editingKey.value = key
  editingValue.value = currentDisplayName
}

async function saveEdits(key: string) {
  const newValue = editingValue.value.trim()
  if (activeTab.value === 'expressions') {
    if (!newValue) {
      delete emotionMappings.value[key]
    }
    else {
      emotionMappings.value[key] = newValue
    }
  }
  else {
    if (!newValue) {
      delete motionMappings.value[key]
    }
    else {
      motionMappings.value[key] = newValue
    }
  }

  await saveMetadata()
  editingKey.value = null
  editingValue.value = ''
  toast.success('Label updated.')
}

async function toggleVisibility(key: string) {
  const list = activeTab.value === 'expressions' ? hiddenExpressions : hiddenMotions
  if (list.value.includes(key)) {
    list.value = list.value.filter(k => k !== key)
  }
  else {
    list.value.push(key)
  }
  await saveMetadata()
}

async function toggleFavorite(key: string) {
  if (favoriteExpressions.value.includes(key)) {
    favoriteExpressions.value = favoriteExpressions.value.filter(k => k !== key)
  }
  else {
    favoriteExpressions.value.push(key)
  }
  await saveMetadata()
}

// ACT Mapping Dialog
const ACT_MAPPING_TARGET = ref<string | null>(null)
function openActMapping(key: string) {
  ACT_MAPPING_TARGET.value = key
}

async function assignActMapping(emotion: string) {
  if (!ACT_MAPPING_TARGET.value)
    return
  emotionMappings.value[ACT_MAPPING_TARGET.value] = emotion
  await saveMetadata()
  ACT_MAPPING_TARGET.value = null
  toast.success(`Mapped expression to ACT:${emotion}`)
}

// Loop / Cycle Toggle for Cards
function isMotionInCycle(key: string) {
  const prefix = modelType.value === 'vrm' ? key : `${modelType.value}:${key}`
  return activeCard.value?.extensions?.airi?.acting?.idleAnimations?.includes(prefix) ?? false
}

function toggleMotionCycle(key: string) {
  if (!activeCardId.value || !activeCard.value)
    return

  const prefix = modelType.value === 'vrm' ? key : `${modelType.value}:${key}`
  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(prefix)
    ? current.filter(k => k !== prefix)
    : [...current, prefix]

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
</script>

<template>
  <div class="h-full min-h-0 w-full flex flex-col overflow-hidden bg-transparent">
    <!-- Empty State Fallback -->
    <div v-if="modelType === 'unknown'" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div class="i-solar:box-minimalistic-bold-duotone mb-2 text-4xl text-neutral-300 dark:text-neutral-700" />
      <h4 class="text-sm text-neutral-700 font-semibold dark:text-neutral-300">
        No Creative Controls Available
      </h4>
      <p class="mt-1 max-w-xs text-xs text-neutral-500">
        This character model does not contain any expressions or motions. Select a model that supports metadata.
      </p>
    </div>

    <template v-else>
      <!-- Labeling Warning Helper -->
      <div v-if="hasTechnicalKeys" class="mb-3 border border-primary-200/40 rounded-xl bg-primary-500/5 p-3 text-xs text-primary-700 dark:border-primary-900/40 dark:text-primary-400">
        <div class="flex items-center gap-1 font-semibold">
          <div class="i-solar:info-square-bold-duotone text-base" />
          Technical Keys Detected
        </div>
        <p class="mt-1 text-[11px] leading-relaxed">
          Some expressions use system names. Click **Rename (✎)** on each item below to rename them to simple words (e.g., `happy`, `sad`) so the AI can use them.
        </p>
      </div>

      <!-- Segment Toggle: Emotions / Motions -->
      <div v-if="rawMotions.length > 0" class="shrink-0 pb-1">
        <div class="flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800">
          <button
            class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            :class="activeTab === 'expressions'
              ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="activeTab = 'expressions'"
          >
            Emotions ({{ rawExpressions.length }})
          </button>
          <button
            class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            :class="activeTab === 'motions'
              ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="activeTab = 'motions'"
          >
            Motions ({{ rawMotions.length }})
          </button>
        </div>
      </div>

      <!-- Loading indicator while capabilities resolve -->
      <div v-if="capabilitiesLoading" class="py-4 text-center text-[10px] text-neutral-400">
        <div class="i-solar:spinner-bold inline-block animate-spin text-base" />
        <span class="ml-1">Loading model capabilities…</span>
      </div>

      <!-- Filter Controls -->
      <div v-if="!capabilitiesLoading" class="flex shrink-0 items-center justify-between py-2">
        <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
          Filters
        </span>
        <div class="flex gap-1">
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition-colors"
            :class="showHidden
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
            @click="showHidden = !showHidden"
          >
            {{ showHidden ? 'Show All' : 'Show Hidden' }}
          </button>
          <button
            class="cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition-colors"
            :class="filterRenamedOnly
              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
            @click="filterRenamedOnly = !filterRenamedOnly"
          >
            {{ filterRenamedOnly ? 'Renamed Only' : 'All' }}
          </button>
        </div>
      </div>

      <!-- Scrollable List Area -->
      <div v-if="!capabilitiesLoading" class="min-h-0 flex-1 overflow-y-auto pb-4">
        <!-- ====== EXPRESSIONS LIST ====== -->
        <template v-if="activeTab === 'expressions'">
          <div v-if="expressionsToRender.length === 0" class="py-8 text-center text-xs text-neutral-400">
            No expressions match filters
          </div>
          <div v-else class="min-w-0 w-full overflow-hidden border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
            <div
              v-for="exp in expressionsToRender"
              :key="exp.key"
              :class="[
                'flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors min-w-0 w-full overflow-hidden',
                exp.isActive ? 'bg-primary-50/30 dark:bg-primary-900/15' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
            >
              <!-- Left: Active dot + name + key -->
              <div class="min-w-0 flex flex-1 cursor-pointer items-center gap-2" @click="triggerExpressionEffect(exp.key)">
                <div
                  :class="['h-2 w-2 rounded-full shrink-0 transition-colors', exp.isActive ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600']"
                />
                <div class="min-w-0 flex-1">
                  <template v-if="editingKey === exp.key">
                    <input
                      v-model="editingValue"
                      type="text"
                      class="w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                      @click.stop
                      @keydown.enter="saveEdits(exp.key)"
                      @keydown.esc="editingKey = null"
                    >
                  </template>
                  <template v-else>
                    <div class="min-w-0 flex flex-1 items-center gap-1 text-sm text-neutral-900 font-medium dark:text-neutral-100">
                      <span v-if="exp.isFavorite" class="shrink-0" title="Favorite">⭐</span>
                      <span class="min-w-0 flex-1 truncate">{{ exp.displayName }}</span>
                      <span
                        v-if="exp.actMapping"
                        class="ml-1 shrink-0 rounded bg-primary-100 px-1 text-[10px] opacity-60 dark:bg-primary-900"
                        :title="`ACT: ${exp.actMapping}`"
                      >{{ exp.actMapping }}</span>
                    </div>
                  </template>
                  <span class="block truncate text-[10px] text-neutral-400">{{ exp.key }}</span>
                </div>
              </div>

              <!-- Right: Actions -->
              <div class="ml-2 flex shrink-0 items-center gap-0.5">
                <!-- Append to Sandbox -->
                <button
                  v-if="props.showInsertActions"
                  class="cursor-pointer rounded p-1 text-neutral-400 hover:bg-primary-500/10 dark:text-neutral-500 hover:text-primary-500"
                  title="Insert into Sandbox"
                  @click.stop="emit('insert-token', `<|ACT:emotion=\x22${exp.displayName}\x22|>`)"
                >
                  <div class="i-solar:document-add-bold-duotone text-sm" />
                </button>
                <!-- ACT Mapping -->
                <button
                  v-if="props.showInsertActions"
                  class="cursor-pointer rounded p-1 transition-colors"
                  :class="exp.actMapping
                    ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                    : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700'"
                  title="Map to ACT emotion"
                  @click.stop="openActMapping(exp.key)"
                >
                  <div class="i-solar:magic-stick-3-bold-duotone text-sm" />
                </button>
                <!-- Favorite -->
                <button
                  class="cursor-pointer rounded p-1 transition-colors"
                  :class="exp.isFavorite
                    ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
                    : 'text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700'"
                  title="Favorite Toggle"
                  @click.stop="toggleFavorite(exp.key)"
                >
                  <div :class="exp.isFavorite ? 'i-solar:star-bold-duotone' : 'i-solar:star-linear'" class="text-sm" />
                </button>
                <!-- Rename -->
                <button
                  class="cursor-pointer rounded p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-700"
                  title="Rename"
                  @click.stop="startEditing(exp.key, exp.displayName)"
                >
                  <div class="i-solar:pen-bold-duotone text-sm" />
                </button>
                <!-- Visibility -->
                <button
                  class="cursor-pointer rounded p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-700"
                  title="Visibility Toggle"
                  @click.stop="toggleVisibility(exp.key)"
                >
                  <div :class="!exp.isVisible ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ====== MOTIONS LIST ====== -->
        <template v-else>
          <div v-if="Object.keys(motionsToRender).length === 0" class="py-8 text-center text-xs text-neutral-400">
            No motions available for this model.
          </div>

          <!-- None Option for VRM -->
          <div
            v-if="modelType === 'vrm' && Object.keys(motionsToRender).length > 0"
            class="mb-3 overflow-hidden border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900"
          >
            <div
              :class="[
                'flex items-center justify-between px-3 py-2 transition-colors cursor-pointer',
                !modelStore.vrmIdleAnimation ? 'bg-primary-50/30 dark:bg-primary-900/15' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
              @click="modelStore.vrmIdleAnimation = ''"
            >
              <div class="flex items-center gap-2">
                <div
                  :class="['h-2 w-2 rounded-full shrink-0 transition-colors', !modelStore.vrmIdleAnimation ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600']"
                />
                <div class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                  None (Stop Base Idle)
                </div>
              </div>
            </div>
          </div>

          <template v-for="(groupMotions, groupName) in motionsToRender" :key="groupName">
            <div v-if="groupName !== 'Motions' && groupName !== 'Animations'" class="mb-1 min-w-0 w-full overflow-hidden px-1">
              <span class="inline-flex items-center rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] text-primary-700 font-semibold ring-1 ring-primary-700/10 ring-inset dark:bg-primary-900/30 dark:text-primary-400 dark:ring-primary-400/20">
                {{ groupName }}
              </span>
            </div>
            <div class="mb-3 min-w-0 w-full overflow-hidden border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
              <div
                v-for="mot in groupMotions"
                :key="mot.key"
                :class="[
                  'flex items-center justify-between px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors min-w-0 w-full overflow-hidden',
                  mot.isActive ? 'bg-primary-50/30 dark:bg-primary-900/15' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                ]"
              >
                <!-- Left: Active dot + name -->
                <div class="min-w-0 w-0 flex flex-1 cursor-pointer items-center gap-2 overflow-hidden" @click="triggerMotionEffect(mot.key)">
                  <div
                    :class="['h-2 w-2 rounded-full shrink-0 transition-colors', mot.isActive ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600']"
                  />
                  <div class="min-w-0 w-0 flex flex-1 flex-col overflow-hidden">
                    <template v-if="editingKey === mot.key">
                      <input
                        v-model="editingValue"
                        type="text"
                        class="w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                        @click.stop
                        @keydown.enter="saveEdits(mot.key)"
                        @keydown.esc="editingKey = null"
                      >
                    </template>
                    <template v-else>
                      <span class="block w-full truncate text-sm text-neutral-900 font-medium dark:text-neutral-100">
                        {{ mot.displayName }}
                      </span>
                    </template>
                    <span class="block w-full truncate text-[10px] text-neutral-400">{{ mot.key }}</span>
                  </div>
                </div>

                <!-- Right: Actions -->
                <div class="ml-2 flex shrink-0 items-center gap-0.5">
                  <!-- Append to Sandbox -->
                  <button
                    v-if="props.showInsertActions"
                    class="cursor-pointer rounded p-1 text-neutral-400 hover:bg-primary-500/10 dark:text-neutral-500 hover:text-primary-500"
                    title="Insert into Sandbox"
                    @click.stop="emit('insert-token', `<|ACT:motion=\x22${mot.displayName}\x22|>`)"
                  >
                    <div class="i-solar:document-add-bold-duotone text-sm" />
                  </button>
                  <!-- Loop / Cycle Toggle -->
                  <button
                    v-if="activeCard"
                    :class="[
                      'rounded p-1 cursor-pointer transition-colors',
                      isMotionInCycle(mot.key)
                        ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                        : 'text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800',
                    ]"
                    :title="isMotionInCycle(mot.key) ? 'Remove from Idle Cycle' : 'Add to Idle Cycle'"
                    @click.stop="toggleMotionCycle(mot.key)"
                  >
                    <div class="i-solar:infinity-bold-duotone text-sm" />
                  </button>
                  <!-- Rename -->
                  <button
                    class="cursor-pointer rounded p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-700"
                    title="Rename"
                    @click.stop="startEditing(mot.key, mot.displayName)"
                  >
                    <div class="i-solar:pen-bold-duotone text-sm" />
                  </button>
                  <!-- Visibility -->
                  <button
                    class="cursor-pointer rounded p-1 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:bg-neutral-700"
                    title="Visibility Toggle"
                    @click.stop="toggleVisibility(mot.key)"
                  >
                    <div :class="!mot.isVisible ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- Rehearsal UI Controls Legend -->
        <div v-if="props.showInsertActions" class="mt-4 border border-neutral-100 rounded-xl bg-neutral-50/40 p-3 text-[10px] text-neutral-500 leading-relaxed dark:border-neutral-800/80 dark:bg-neutral-950/10">
          <div class="mb-1.5 text-[11px] text-neutral-700 font-bold dark:text-neutral-300">
            Rehearsal Controls Legend
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <div class="flex items-start gap-1.5">
              <div class="i-solar:document-add-bold-duotone shrink-0 text-sm text-primary-500" />
              <div>
                <span class="text-neutral-600 font-bold dark:text-neutral-400">Append Token:</span> Appends <code class="rounded bg-neutral-100 px-0.5 dark:bg-neutral-800">&lt;|ACT:...|&gt;</code> to the sandbox dialog template.
              </div>
            </div>
            <div class="flex items-start gap-1.5">
              <div class="i-solar:infinity-bold-duotone shrink-0 text-sm text-neutral-400" />
              <div>
                <span class="text-neutral-600 font-bold dark:text-neutral-400">Idle Cycle:</span> Sets this motion to repeat in the character's automatic background idle cycle.
              </div>
            </div>
            <div class="flex items-start gap-1.5">
              <div class="i-solar:pen-bold-duotone shrink-0 text-sm text-neutral-400" />
              <div>
                <span class="text-neutral-600 font-bold dark:text-neutral-400">Rename Key:</span> Changes technical asset filenames to clean words (e.g. <code class="rounded bg-neutral-100 px-0.5 dark:bg-neutral-800">happy</code>) so the AI understands them.
              </div>
            </div>
            <div class="flex items-start gap-1.5">
              <div class="i-solar:eye-bold-duotone shrink-0 text-sm text-neutral-400" />
              <div>
                <span class="text-neutral-600 font-bold dark:text-neutral-400">Hide Key:</span> Removes dead or unused asset keys from the main view to keep lists clean.
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ACT Mapping Dialog -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="ACT_MAPPING_TARGET"
          class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="ACT_MAPPING_TARGET = null"
        >
          <div class="w-72 border border-neutral-200 rounded-xl border-solid bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
            <div class="mb-3 text-center">
              <div class="text-sm text-neutral-700 font-medium dark:text-neutral-200">
                Map to ACT Emotion
              </div>
              <div class="mt-1 block truncate rounded-md bg-neutral-100 px-3 py-1 text-xs text-primary-500 font-mono dark:bg-neutral-800">
                {{ ACT_MAPPING_TARGET }}
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="emotion in ['happy', 'sad', 'angry', 'surprised', 'neutral', 'think', 'cool']"
                :key="emotion"
                class="cursor-pointer border rounded-lg border-solid px-3 py-2 text-sm transition-all"
                :class="rawExpressions.find(e => e.key === ACT_MAPPING_TARGET)?.actMapping === emotion
                  ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'"
                @click="assignActMapping(emotion)"
              >
                {{ emotion }}
              </button>
            </div>
            <div class="mt-3 flex gap-2">
              <button
                class="flex-1 cursor-pointer border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                @click="ACT_MAPPING_TARGET = null"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
