<script setup lang="ts">
import type { DiscoveredMeshNode } from '@proj-airi/stage-ui-three'

import type { AiriOutfit } from '../../../../stores/modules/airi-card'

import { useLive2d } from '@proj-airi/stage-ui-live2d/stores'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { Input } from '@proj-airi/ui'
import { nanoid } from 'nanoid'
import { storeToRefs } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'
import { toast } from 'vue-sonner'

import WardrobeMeshTreeNode from './components/WardrobeMeshTreeNode.vue'

import { DisplayModelFormat, useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettingsControlStrip } from '../../../../stores/settings/control-strip'
import { Container } from '../../../data-pane'

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
const { stageEnabled, stageMateEnabled } = storeToRefs(controlStripStore)
const isStageOpen = computed(() => Boolean(props.localStage || stageEnabled.value || stageMateEnabled.value))

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
const modelOutfits = ref<AiriOutfit[]>([])

function applyModelMappings(model?: any) {
  if (!model)
    return
  emotionMappings.value = { ...model.emotionMappings }
  favoriteExpressions.value = [...(model.favoriteExpressions || [])]
  hiddenExpressions.value = [...(model.hiddenExpressions || [])]
  motionMappings.value = { ...model.motionMappings }
  hiddenMotions.value = [...(model.hiddenMotions || [])]
  modelOutfits.value = [...(model.outfits || [])]

  // Sync to store for stage window cross-process triggers
  live2dStore.motionMap = { ...motionMappings.value }
  live2dStore.emotionMappings = { ...emotionMappings.value }
}

// React when currentModel in store updates (e.g. from IndexedDB or background sync)
watch(currentModel, (model) => {
  if (model && !editingKey.value) {
    applyModelMappings(model)
  }
})

// Sync local state + capabilities when modelId changes
watch(() => props.modelId, async (newId) => {
  if (!newId)
    return

  // Ensure displayModels catalog is populated from IndexedDB if not yet loaded
  if (displayModelsStore.displayModels.length === 0) {
    await displayModelsStore.loadDisplayModelsFromIndexedDB()
  }

  let model = displayModelsStore.displayModels.find(m => m.id === newId)
  if (!model) {
    const rawModel = await displayModelsStore.getDisplayModel(newId)
    if (rawModel)
      model = rawModel as any
  }

  console.log(`[ModelCustomizer] modelId changed → ${newId}`, {
    found: !!model,
    format: model?.format,
    cachedExpressions: model?.expressions?.length ?? 'none',
    cachedMotions: model?.motions?.length ?? 'none',
    emotionMappings: model?.emotionMappings,
    motionMappings: model?.motionMappings,
  })

  if (model) {
    applyModelMappings(model)
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

async function saveMetadata() {
  await displayModelsStore.updateDisplayModelMappings(props.modelId, {
    emotionMappings: { ...emotionMappings.value },
    favoriteExpressions: [...favoriteExpressions.value],
    hiddenExpressions: [...hiddenExpressions.value],
    motionMappings: { ...motionMappings.value },
    hiddenMotions: [...hiddenMotions.value],
    outfits: [...modelOutfits.value],
  })

  // Sync to store for stage window cross-process triggers
  live2dStore.motionMap = { ...motionMappings.value }
  live2dStore.emotionMappings = { ...emotionMappings.value }
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
    const builtinItems = (mmdStore.availableMotions || []).map(key => ({
      key,
      displayName: mappings[key] || key.replace(/\.vmd$/i, '').replace(/_/g, ' '),
      isActive: mmdStore.currentMotion === key,
      group: 'Built-in Animations',
      duration: 5.0,
      hasSound: false,
      isInIdleCycle: idleCycles.includes(`mmd:${key}`),
      isVisible: !hidden.includes(key),
    }))

    const customItems = (mmdStore.customMotions || []).map((item) => {
      const key = item.id || item.name
      const name = item.name || key
      return {
        key,
        displayName: mappings[key] || name,
        isActive: mmdStore.currentMotion === key || mmdStore.currentMotion === name,
        group: 'Custom Animations',
        duration: 5.0,
        hasSound: false,
        isInIdleCycle: idleCycles.includes(`mmd:${key}`) || idleCycles.includes(`mmd:${name}`),
        isVisible: !hidden.includes(key),
      }
    })

    return [...builtinItems, ...customItems]
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
const activeTab = ref<'expressions' | 'motions' | 'outfits'>('expressions')
const showHidden = ref(false)
const filterRenamedOnly = ref(false)
const editingKey = ref<string | null>(null)
const editingValue = ref('')

// === Inline Wardrobe Builder State ===
const isElectron = computed(() => typeof window !== 'undefined' && !!(window as any).electron)
const isBuildingOutfit = ref(false)
const isSavingOutfit = ref(false)
const isSyncingStageMate = ref(false)
const selectedMeshes = ref(new Set<string>())
const slotName = ref('')
const slotTag = ref('')
const slotIcon = ref('i-solar:t-shirt-bold-duotone')
const searchMeshQuery = ref('')

async function syncStageMateSidecar(reload = false) {
  if (!isElectron.value || !props.modelId)
    return false

  try {
    const { useElectronEventaInvoke } = await import('@proj-airi/electron-vueuse')
    const { electronStageMateSyncOutfits } = await import('@proj-airi/stage-shared')
    const syncOutfitsInvoke = useElectronEventaInvoke(electronStageMateSyncOutfits)

    const rawOutfits = toRaw(modelOutfits.value) || []
    const plainOutfits = rawOutfits.map((o) => {
      const plainObj = toRaw(o)
      const rawMeshes = plainObj.meshes ? toRaw(plainObj.meshes) : []
      return {
        name: String(plainObj.name || ''),
        tag: String(plainObj.tag || ''),
        meshes: Array.from(rawMeshes).map(m => String(m)),
      }
    })

    const payload = JSON.parse(JSON.stringify({
      modelId: String(props.modelId),
      outfits: plainOutfits,
      reload: Boolean(reload),
    }))

    const res = await syncOutfitsInvoke(payload)
    return !!res?.success
  }
  catch (err) {
    console.error('[ModelCustomizer] Failed to sync outfits with Stage-Mate:', err)
    return false
  }
}

async function handleManualStageMateSync() {
  if (isSyncingStageMate.value)
    return

  isSyncingStageMate.value = true
  const toastId = toast.loading('Syncing outfits with Stage-Mate…')

  try {
    const success = await syncStageMateSidecar(true)
    if (success) {
      toast.success('Stage-Mate synchronized successfully!', { id: toastId })
    }
    else {
      toast.error('Failed to sync Stage-Mate outfits sidecar.', { id: toastId })
    }
  }
  catch (err: any) {
    toast.error(`Failed to sync Stage-Mate: ${err?.message || 'Unknown error'}`, { id: toastId })
  }
  finally {
    isSyncingStageMate.value = false
  }
}

const availableIcons = [
  'i-solar:t-shirt-bold-duotone',
  'i-solar:hanger-bold-duotone',
  'i-solar:magic-stick-3-bold-duotone',
  'i-solar:glasses-bold-duotone',
  'i-solar:crown-bold-duotone',
  'i-solar:cat-bold-duotone',
  'i-solar:heart-bold-duotone',
  'i-solar:star-bold-duotone',
  'i-solar:tag-bold-duotone',
  'i-solar:palette-bold-duotone',
  'i-solar:medal-ribbons-star-bold-duotone',
  'i-solar:mask-happly-bold-duotone',
]

const suggestedTags = [
  { label: 'Independent', value: '' },
  { label: 'Outfit / Dress', value: 'outfit' },
  { label: 'Hairstyle', value: 'hair' },
  { label: 'Headwear', value: 'headwear' },
  { label: 'Shoes / Footwear', value: 'shoes' },
  { label: 'Accessories', value: 'accessories' },
]

const { discoveredMeshes } = storeToRefs(modelStore)

function getAllLeafNamesFromNode(node: DiscoveredMeshNode): string[] {
  if (!node.children || node.children.length === 0)
    return [node.name]
  const list: string[] = []
  for (const c of node.children) {
    list.push(...getAllLeafNamesFromNode(c))
  }
  return list
}

function getAllLeafNamesFromTree(tree: DiscoveredMeshNode[]): string[] {
  const list: string[] = []
  for (const node of tree) {
    list.push(...getAllLeafNamesFromNode(node))
  }
  return list
}

const allDiscoveredLeafMeshes = computed(() => getAllLeafNamesFromTree(discoveredMeshes.value))

function startBuildingOutfit() {
  isBuildingOutfit.value = true
  selectedMeshes.value.clear()
  slotName.value = ''
  slotTag.value = ''
  slotIcon.value = 'i-solar:t-shirt-bold-duotone'
  searchMeshQuery.value = ''
}

function cancelBuildingOutfit() {
  for (const name of selectedMeshes.value) {
    modelStore.setMeshVisibility(name, true)
  }
  selectedMeshes.value.clear()
  slotName.value = ''
  slotTag.value = ''
  slotIcon.value = 'i-solar:t-shirt-bold-duotone'
  searchMeshQuery.value = ''
  isBuildingOutfit.value = false
}

function toggleMesh(meshName: string) {
  if (selectedMeshes.value.has(meshName)) {
    selectedMeshes.value.delete(meshName)
    modelStore.setMeshVisibility(meshName, true)
  }
  else {
    selectedMeshes.value.add(meshName)
    modelStore.setMeshVisibility(meshName, false)
  }
}

function toggleSubtree(node: DiscoveredMeshNode, shouldHide: boolean) {
  const leaves = getAllLeafNamesFromNode(node)
  for (const leaf of leaves) {
    if (shouldHide) {
      selectedMeshes.value.add(leaf)
      modelStore.setMeshVisibility(leaf, false)
    }
    else {
      selectedMeshes.value.delete(leaf)
      modelStore.setMeshVisibility(leaf, true)
    }
  }
}

function selectAllMeshes() {
  const leaves = allDiscoveredLeafMeshes.value
  for (const name of leaves) {
    selectedMeshes.value.add(name)
    modelStore.setMeshVisibility(name, false)
  }
}

function clearAllMeshes() {
  const leaves = allDiscoveredLeafMeshes.value
  for (const name of leaves) {
    selectedMeshes.value.delete(name)
    modelStore.setMeshVisibility(name, true)
  }
}

async function saveOutfitSlot() {
  if (!slotName.value.trim() || selectedMeshes.value.size === 0 || isSavingOutfit.value)
    return

  if (modelOutfits.value.length >= 8) {
    toast.error('Maximum 8 outfit slots reached.')
    return
  }

  isSavingOutfit.value = true
  const toastId = toast.loading('Saving outfit to database…')

  try {
    modelOutfits.value.push({
      id: nanoid(),
      name: slotName.value.trim(),
      tag: slotTag.value.trim(),
      icon: slotIcon.value,
      meshes: Array.from(selectedMeshes.value),
      defaultEnabled: true,
    })

    await saveMetadata()

    // Auto-export sidecar to Stage-Mate disk cache
    void syncStageMateSidecar(false)

    cancelBuildingOutfit()
    toast.success('Wardrobe slot saved.', { id: toastId })
  }
  catch (err: any) {
    console.error('[ModelCustomizer] Failed to save outfit slot:', err)
    toast.error(`Failed to save outfit: ${err?.message || 'Unknown error'}`, { id: toastId })
  }
  finally {
    isSavingOutfit.value = false
  }
}

async function deleteSlot(id: string) {
  modelOutfits.value = modelOutfits.value.filter(o => o.id !== id)
  await saveMetadata()
  void syncStageMateSidecar(false)
  toast.success('Wardrobe slot removed.')
}

function isSlotVisible(slot: AiriOutfit) {
  const meshes = slot.meshes || []
  if (meshes.length === 0)
    return true
  return meshes.every(name => !modelStore.hiddenMeshes.includes(name))
}

function toggleSlotVisibility(slot: AiriOutfit) {
  const currentlyVisible = isSlotVisible(slot)
  const meshes = slot.meshes || []
  modelStore.setMeshesVisibility(meshes, !currentlyVisible)
}

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
  if (!isStageOpen.value) {
    toast.error('Stage or Stage-Mate window must be open to preview expressions.')
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
  if (!isStageOpen.value) {
    toast.error('Stage or Stage-Mate window must be open to preview motions.')
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

      <!-- Segment Toggle: Emotions / Motions / Outfits -->
      <div v-if="rawMotions.length > 0 || modelType === 'vrm'" class="shrink-0 pb-1">
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
            v-if="rawMotions.length > 0"
            class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            :class="activeTab === 'motions'
              ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="activeTab = 'motions'"
          >
            Motions ({{ rawMotions.length }})
          </button>
          <button
            v-if="modelType === 'vrm'"
            class="flex-1 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-all"
            :class="activeTab === 'outfits'
              ? 'bg-white text-neutral-800 shadow-sm dark:bg-neutral-700 dark:text-neutral-100'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'"
            @click="activeTab = 'outfits'"
          >
            Outfits ({{ modelOutfits.length }})
          </button>
        </div>
      </div>

      <!-- Loading indicator while capabilities resolve -->
      <div v-if="capabilitiesLoading" class="py-4 text-center text-[10px] text-neutral-400">
        <div class="i-solar:spinner-bold inline-block animate-spin text-base" />
        <span class="ml-1">Loading model capabilities…</span>
      </div>

      <!-- Filter Controls (Emotions & Motions only) -->
      <div v-if="!capabilitiesLoading && activeTab !== 'outfits'" class="flex shrink-0 items-center justify-between py-2">
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
        <template v-else-if="activeTab === 'motions'">
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

        <!-- ====== OUTFITS TAB ====== -->
        <template v-else-if="activeTab === 'outfits'">
          <!-- Wardrobe Builder Mode -->
          <div v-if="isBuildingOutfit" class="flex flex-col gap-3 pt-2">
            <div class="flex items-center justify-between px-1">
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ allDiscoveredLeafMeshes.length }} meshes discovered · select parts to bundle
              </span>
              <div class="flex gap-1">
                <button
                  class="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  :class="[
                    isSavingOutfit || selectedMeshes.size === 0 || !slotName.trim()
                      ? 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 cursor-not-allowed'
                      : 'bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400 cursor-pointer',
                  ]"
                  :disabled="isSavingOutfit || selectedMeshes.size === 0 || !slotName.trim()"
                  @click="saveOutfitSlot"
                >
                  <div v-if="isSavingOutfit" class="i-solar:spinner-bold size-3.5 animate-spin" />
                  <span>{{ isSavingOutfit ? 'Saving…' : `Done (${selectedMeshes.size})` }}</span>
                </button>
                <button
                  class="rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  :disabled="isSavingOutfit"
                  @click="cancelBuildingOutfit"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- Slot Configuration Form -->
            <Container title="New Wardrobe Slot" :expand="true" inner-class="flex flex-col gap-3 p-3">
              <!-- Slot Name -->
              <div class="flex flex-col gap-1">
                <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Slot Name *
                </label>
                <Input
                  v-model="slotName"
                  placeholder="e.g. FLOATIE, BUNNY EARS, SUMMER DRESS, GLASSES"
                />
              </div>

              <!-- Group Tag (Exclusivity Group) -->
              <div class="flex flex-col gap-1">
                <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Exclusivity Group Tag (Optional)
                </label>
                <Input
                  v-model="slotTag"
                  placeholder="e.g. outfit, hair, headwear (or leave blank for independent)"
                />
                <!-- Quick Suggestion Chips -->
                <div class="flex flex-wrap gap-1 pt-1">
                  <button
                    v-for="sug in suggestedTags"
                    :key="sug.value"
                    type="button"
                    class="rounded px-2 py-0.5 text-[10px] transition-colors"
                    :class="[
                      slotTag === sug.value
                        ? 'bg-primary-500 text-white font-medium'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700',
                    ]"
                    @click="slotTag = sug.value"
                  >
                    {{ sug.label }}
                  </button>
                </div>
                <span class="text-[10px] text-neutral-400">
                  Slots with the same tag deactivate each other when activated. Blank tag is independent.
                </span>
              </div>

              <!-- Icon Selector -->
              <div class="flex flex-col gap-1">
                <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                  Icon
                </label>
                <div class="grid grid-cols-6 gap-1.5 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-800/60">
                  <button
                    v-for="icon in availableIcons"
                    :key="icon"
                    type="button"
                    class="size-8 flex items-center justify-center rounded-lg transition-colors"
                    :class="[
                      slotIcon === icon
                        ? 'bg-primary-500 text-white shadow-sm'
                        : 'text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700',
                    ]"
                    @click="slotIcon = icon"
                  >
                    <div :class="icon" class="size-5" />
                  </button>
                </div>
              </div>
            </Container>

            <!-- Discovered 3D Meshes Selection Hierarchy Tree -->
            <Container
              :title="`Discovered 3D Meshes (${allDiscoveredLeafMeshes.length})`"
              :expand="true"
              inner-class="flex flex-col gap-2 p-3"
            >
              <div class="flex items-center justify-between gap-2">
                <Input
                  v-model="searchMeshQuery"
                  placeholder="Search meshes or parts..."
                  size="sm"
                  class="flex-1"
                />
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="text-[10px] text-primary-500 hover:underline"
                    @click="selectAllMeshes"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    class="text-[10px] text-neutral-400 hover:underline"
                    @click="clearAllMeshes"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div
                v-if="discoveredMeshes.length === 0"
                class="p-4 text-center text-xs text-neutral-400"
              >
                No 3D meshes detected on loaded model.
              </div>

              <div v-else class="max-h-72 flex flex-col gap-1 overflow-y-auto pt-1">
                <WardrobeMeshTreeNode
                  v-for="rootNode in discoveredMeshes"
                  :key="rootNode.id || rootNode.name"
                  :node="rootNode"
                  :selected-meshes="selectedMeshes"
                  :search-query="searchMeshQuery"
                  :depth="0"
                  @toggle-mesh="toggleMesh"
                  @toggle-subtree="toggleSubtree"
                />
              </div>
            </Container>
          </div>

          <!-- Wardrobe Slot List Overview -->
          <div v-else class="flex flex-col gap-3 pt-2">
            <!-- Header with Build & Sync Buttons -->
            <div class="flex items-center justify-between px-1">
              <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                Wardrobe Slots ({{ modelOutfits.length }} / 8)
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  v-if="isElectron"
                  class="flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 disabled:opacity-50 dark:hover:bg-neutral-700"
                  :disabled="isSyncingStageMate"
                  title="Export outfits sidecar JSON and reload model in Stage-Mate"
                  @click="handleManualStageMateSync"
                >
                  <div :class="isSyncingStageMate ? 'i-solar:spinner-bold animate-spin' : 'i-solar:bolt-bold-duotone text-amber-500'" class="size-3.5" />
                  <span>{{ isSyncingStageMate ? 'Syncing…' : 'Sync Stage-Mate' }}</span>
                </button>
                <button
                  class="rounded-md bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-medium transition-colors hover:bg-primary-500/20 dark:text-primary-400 disabled:opacity-50"
                  :disabled="modelOutfits.length >= 8"
                  @click="startBuildingOutfit"
                >
                  + Build Outfit
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div
              v-if="modelOutfits.length === 0"
              class="flex flex-col items-center justify-center border border-neutral-200 rounded-xl border-dashed p-8 text-center dark:border-neutral-800"
            >
              <div class="i-solar:hanger-bold-duotone mb-2 text-3xl text-neutral-300 dark:text-neutral-700" />
              <span class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                No Wardrobe Slots Configured
              </span>
              <p class="mt-1 max-w-xs text-[11px] text-neutral-400">
                Click <strong>+ Build Outfit</strong> above to discover 3D meshes and group them into toggleable clothing and accessories.
              </p>
            </div>

            <!-- Single-Column Clean Card Stack -->
            <div v-else class="flex flex-col gap-2">
              <div
                v-for="slot in modelOutfits"
                :key="slot.id"
                class="group relative flex flex-col justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 transition-colors dark:border-neutral-800 hover:border-neutral-300 dark:bg-neutral-900/50 dark:hover:border-neutral-700"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-2.5">
                    <div class="size-8 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
                      <div :class="slot.icon || 'i-solar:t-shirt-bold-duotone'" class="text-lg" />
                    </div>
                    <div class="min-w-0 flex flex-col">
                      <span class="truncate text-xs text-neutral-800 font-bold dark:text-neutral-100">
                        {{ slot.name }}
                      </span>
                      <span
                        v-if="slot.tag"
                        class="w-fit rounded bg-amber-500/10 px-1.5 py-0.2 text-[9px] text-amber-600 font-medium tracking-tight uppercase dark:text-amber-400"
                      >
                        Group: {{ slot.tag }}
                      </span>
                      <span
                        v-else
                        class="w-fit rounded bg-neutral-200/60 px-1.5 py-0.2 text-[9px] text-neutral-500 font-medium tracking-tight uppercase dark:bg-neutral-800 dark:text-neutral-400"
                      >
                        Independent
                      </span>
                    </div>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <!-- Test Slot Toggle Button -->
                    <button
                      class="rounded-lg p-1.5 transition-colors"
                      :class="[
                        isSlotVisible(slot)
                          ? 'text-primary-500 hover:bg-primary-500/10'
                          : 'text-amber-500 hover:bg-amber-500/10',
                      ]"
                      :title="isSlotVisible(slot) ? 'Test: Hide Mesh Parts' : 'Test: Show Mesh Parts'"
                      @click="toggleSlotVisibility(slot)"
                    >
                      <div :class="isSlotVisible(slot) ? 'i-solar:eye-bold-duotone' : 'i-solar:eye-closed-bold-duotone'" class="size-4" />
                    </button>

                    <!-- Delete Slot Button -->
                    <button
                      class="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                      title="Delete Slot"
                      @click="deleteSlot(slot.id)"
                    >
                      <div class="i-solar:trash-bin-trash-bold-duotone size-4" />
                    </button>
                  </div>
                </div>

                <div class="mt-2.5 flex flex-wrap gap-1">
                  <span
                    v-for="mesh in (slot.meshes || []).slice(0, 4)"
                    :key="mesh"
                    class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-300"
                  >
                    {{ mesh }}
                  </span>
                  <span
                    v-if="(slot.meshes || []).length > 4"
                    class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-400 dark:bg-neutral-800"
                  >
                    +{{ (slot.meshes || []).length - 4 }} more
                  </span>
                </div>
              </div>
            </div>
          </div>
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
