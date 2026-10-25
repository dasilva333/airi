<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { ARTISTRY_PRESET_GROUPS, artistryGenerateHeadless, REPLICATE_IMAGEEDIT_PRESETS } from '@proj-airi/stage-shared'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

// @ts-ignore
import * as THREE from 'three'

import { useAiriCardStore } from '../../../../../stores/modules/airi-card'
import { useArtistryStore } from '../../../../../stores/modules/artistry'
import { useSettings } from '../../../../../stores/settings'
import { useVHackStore } from '../../../../../stores/vhack'

const settingsStore = useSettings()

const vhackStore = useVHackStore()
const modelStore = useModelStore()
const artistryStore = useArtistryStore()
const airiCardStore = useAiriCardStore()
const { activeVrm, activeVrmParser } = storeToRefs(modelStore)

const generateInvoke = useElectronEventaInvoke(artistryGenerateHeadless)

const activeTab = ref<'tree' | 'material' | 'texture'>('texture')
type LabMode = 'local' | 'prompt'
const LAB_MODE_STORAGE_KEY = 'vhack_lab_mode'
function initialLabMode(): LabMode {
  try {
    return sessionStorage.getItem(LAB_MODE_STORAGE_KEY) === 'prompt' ? 'prompt' : 'local'
  }
  catch {
    return 'local'
  }
}
const labMode = ref<LabMode>(initialLabMode())
watch(labMode, (mode) => {
  try {
    sessionStorage.setItem(LAB_MODE_STORAGE_KEY, mode)
  }
  catch {}
})
const ACCENT_ACTION_CLASS = '!border-primary-500/30 !bg-primary-500 !text-white shadow-primary-500/20 shadow-sm hover:!bg-primary-600 active:!bg-primary-700 dark:!bg-primary-600 dark:hover:!bg-primary-500'
const UV_GUIDANCE = 'Preserve the UV layout, seams, and transparent areas.'
interface UploadNotice {
  dimension?: string
  transparency?: string
  format?: string
}
const uploadNotice = ref<UploadNotice | null>(null)
const uploadError = ref<string | null>(null)
const isDragOver = ref(false)
const generationTargetName = ref<string | null>(null)
const TOOL_TABS = [
  { id: 'texture', label: 'Textures' },
  { id: 'material', label: 'Lab' },
  { id: 'tree', label: 'Parts' },
] as const
const textureTypeFilters: Array<'All' | 'Main' | 'Shade'> = ['All', 'Main', 'Shade']
const scrollContainer = ref<HTMLElement | null>(null)

// Selected State
const selectedMesh = ref<any>(null)
const selectedMaterial = ref<any>(null)
const lastSelectedTextureItem = ref<any>(null)

// Texture replacements are tracked per glTF image index so switching textures
// preserves each replacement and its preview state. They live on the store so
// collapsing/remounting the docked panel does not lose them.
// Defensive getters: a dev-server HMR cycle that updates the store module
// before a hard refresh leaves the old store instance without these fields.
const replacementByIndex = computed(() => vhackStore.replacementByIndex ?? new Map<number | string, { url: string }>())
const previewingKeys = computed(() => vhackStore.previewingKeys ?? new Set<number | string>())

// AI State
// AI State
const aiPrompt = ref('')
const aiReplicateModelId = ref('black-forest-labs/flux-schnell')
const aiReplicateParams = ref('{}')
const selectedReplicatePreset = ref('')
const aiComfyParams = ref('{}')

const isGenerating = ref(false)
const isExporting = ref(false)
const aiError = ref<string | null>(null)
const selectedCategory = ref<string | null>('fabrics')
const showAllPresets = ref(false)
const nodeFilter = ref('')
const textureFilter = ref('')
const textureTypeFilter = ref<'All' | 'Main' | 'Shade'>('All')
const textureUploader = ref<HTMLInputElement | null>(null)
const eraserCanvas = ref<HTMLCanvasElement | null>(null)

// Surgical Eraser State
const isEraserOpen = ref(false)
const eraserImageUrl = ref('')
const eraserPickedColor = ref<[number, number, number] | null>(null)
const eraserTolerance = ref(15)
const isEraserPicking = ref(true)

const activePresets = computed(() => {
  if (!selectedCategory.value)
    return []
  return ARTISTRY_PRESET_GROUPS.find(g => g.id === selectedCategory.value)?.presets || []
})

const PREFERRED_PRESET_IDS = ['gold', 'gothic', 'denim', 'satin']
const visiblePresets = computed(() => {
  if (showAllPresets.value)
    return activePresets.value
  const preferred = activePresets.value.filter(preset => PREFERRED_PRESET_IDS.includes(preset.id))
  return preferred.length === 4 ? preferred : activePresets.value.slice(0, 4)
})

watch(selectedCategory, () => {
  showAllPresets.value = false
})

const availableProviders = [
  { id: 'nanobanana', name: 'Nano Banana', icon: 'i-solar:gallery-round-bold-duotone' },
  { id: 'replicate', name: 'Replicate', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'comfyui', name: 'ComfyUI', icon: 'i-solar:settings-bold-duotone' },
]

// Preset Palette moved to shared artistry.ts

function injectPreset(text: string) {
  aiPrompt.value = text
}

function getGltfImageIndex(texture: any) {
  if (!activeVrmParser.value || !texture)
    return null
  const assoc = activeVrmParser.value.associations.get(texture)
  if (assoc && assoc.textures !== undefined) {
    const texIndex = assoc.textures
    const gltfTex = activeVrmParser.value.json.textures[texIndex]
    return gltfTex?.source ?? null
  }
  return null
}

function getGltfNodeIndex(node: any, gltf?: any) {
  if (!activeVrmParser.value || !node)
    return null
  const assoc = activeVrmParser.value.associations.get(node)
  if (assoc && assoc.nodes !== undefined) {
    return assoc.nodes
  }

  // Fallback: Dual-Layer Fuzzy Matching (Fixes "Ghost Models" like Gura)
  if (gltf && node.name) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const stripSuffix = (s: string) => s.replace(/(_\d+)$/, '') // Remove Three.js suffixes like _1, _2

    const sceneName = stripSuffix(node.name)
    const normSceneName = normalize(sceneName)

    // Stage 1: Match against GLTF Node Names
    const nodeIdx = gltf.nodes.findIndex((n: any) => n.name && normalize(stripSuffix(n.name)) === normSceneName)
    if (nodeIdx !== -1)
      return nodeIdx

    // Stage 2: Match against GLTF Mesh Names (Accounts for Gura-style renaming)
    const meshIdx = gltf.nodes.findIndex((n: any) => {
      if (n.mesh === undefined)
        return false
      const mesh = gltf.meshes[n.mesh]
      return mesh && mesh.name && normalize(stripSuffix(mesh.name)) === normSceneName
    })
    if (meshIdx !== -1) {
      console.info(`[VHACK] Mesh-Layer Match: Scene "${node.name}" -> Mesh "${gltf.meshes[gltf.nodes[meshIdx].mesh].name}" (Node ${meshIdx})`)
      return meshIdx
    }
  }

  return null
}

function getTextureUrl(tex: any) {
  if (!tex || !tex.image)
    return null
  try {
    if (tex.image instanceof HTMLCanvasElement)
      return tex.image.toDataURL()
    if (tex.image instanceof HTMLImageElement)
      return tex.image.src
    if (tex.image instanceof ImageBitmap) {
      const canvas = document.createElement('canvas')
      canvas.width = tex.image.width
      canvas.height = tex.image.height
      canvas.getContext('2d')?.drawImage(tex.image, 0, 0)
      return canvas.toDataURL()
    }
  }
  catch (e) {}
  return null
}

// Global Snapshot Logic
function takeGlobalSnapshot() {
  if (!activeVrm.value)
    return
  activeVrm.value.scene.traverse((node: any) => {
    if (!vhackStore.snapshotMap.has(node.uuid)) {
      const snap: any = { visible: node.visible }
      if (node.material) {
        const mat = Array.isArray(node.material) ? node.material[0] : node.material
        snap.props = {
          rimWidth: mat.rimWidthFactor ?? mat.rimWidth ?? mat.uniforms?.rimWidth?.value ?? 0,
          shadeShift: mat.shadingShiftFactor ?? mat.shadeShift ?? mat.uniforms?.shadingShift?.value ?? 0,
          shadeToony: mat.shadingToonyFactor ?? mat.shadeToony ?? mat.uniforms?.shadingToony?.value ?? 0,
          map: mat.map,
        }
      }
      vhackStore.snapshotMap.set(node.uuid, snap)
    }
  })
}

// Watchers
watch(() => artistryStore.comfyuiActiveWorkflow, (newWorkflowId) => {
  if (artistryStore.activeProvider === 'comfyui' && newWorkflowId) {
    const workflow = artistryStore.comfyuiSavedWorkflows.find(w => w.id === newWorkflowId)
    if (workflow) {
      const example: Record<string, any> = {}
      for (const [nodeTitle, fields] of Object.entries(workflow.exposedFields)) {
        example[nodeTitle] = {}
        for (const field of fields) {
          const nodeId = Object.keys(workflow.workflow).find(id => (workflow.workflow[id]._meta?.title || workflow.workflow[id].class_type) === nodeTitle)
          const val = nodeId ? workflow.workflow[nodeId].inputs[field] : '...'
          example[nodeTitle][field] = val
        }
      }
      aiComfyParams.value = JSON.stringify(example, null, 2)
    }
  }
})

watch(selectedReplicatePreset, (newPresetId) => {
  if (artistryStore.activeProvider === 'replicate' && newPresetId) {
    const preset = REPLICATE_IMAGEEDIT_PRESETS.find(p => p.id === newPresetId)
    if (preset) {
      aiReplicateModelId.value = preset.id
      aiReplicateParams.value = JSON.stringify(preset.preset, null, 2)
      if (preset.prompt)
        aiPrompt.value = preset.prompt
    }
  }
})

// Tree View Logic
const nodes = computed(() => {
  if (!activeVrm.value)
    return []
  const result: any[] = []
  activeVrm.value.scene.traverse((node: any) => {
    if (node.type === 'Mesh' || node.type === 'SkinnedMesh') {
      const mat = Array.isArray(node.material) ? node.material[0] : node.material
      const matName = mat ? mat.name : 'No Material'

      const searchTerm = nodeFilter.value.toLowerCase()
      const isMatch = node.name?.toLowerCase().includes(searchTerm) || matName.toLowerCase().includes(searchTerm)

      if (isMatch) {
        result.push({
          name: node.name || 'Unnamed Mesh',
          matName,
          type: node.type,
          visible: node.visible,
          uuid: node.uuid,
          node,
        })
      }
    }
  })
  return result
})

function syncMeshVisibility(item: any, visible: boolean) {
  item.node.visible = visible
  // The canonical stage path (broadcast + name matching). This keeps the
  // settings preview and any other stage window in sync with the panel.
  modelStore.setMeshVisibility(item.name, visible)
}

function syncAllVisibility() {
  nodes.value.forEach(item => modelStore.setMeshVisibility(item.name, item.node.visible))
}

function showAllNodes() {
  vhackStore.showAll(nodes.value)
  syncAllVisibility()
}

function hideAllNodes() {
  vhackStore.hideAll(nodes.value)
  syncAllVisibility()
}

function toggleVisibility(item: any, event?: MouseEvent) {
  if (event?.ctrlKey) {
    vhackStore.focusNode(item.uuid, nodes.value)
    syncAllVisibility()
    return
  }

  syncMeshVisibility(item, !item.node.visible)
  if (item.node.visible)
    vhackStore.hiddenNodeUuids.delete(item.uuid)
  else
    vhackStore.hiddenNodeUuids.add(item.uuid)
  vhackStore.hiddenNodeUuids = new Set(vhackStore.hiddenNodeUuids)
}

// Material Lab Logic
function updateProp(prop: string, value: number) {
  if (!selectedMaterial.value)
    return
  const mat = selectedMaterial.value as any
  if (prop === 'rimWidth') {
    if ('rimWidthFactor' in mat)
      mat.rimWidthFactor = value
    else if (mat.uniforms?.rimWidth)
      mat.uniforms.rimWidth.value = value
    else mat.rimWidth = value
  }
  else if (prop === 'shadeShift') {
    if ('shadingShiftFactor' in mat)
      mat.shadingShiftFactor = value
    else if (mat.uniforms?.shadingShift)
      mat.uniforms.shadingShift.value = value
    else mat.shadeShift = value
  }
  else if (prop === 'shadeToony') {
    if ('shadingToonyFactor' in mat)
      mat.shadingToonyFactor = value
    else if (mat.uniforms?.shadingToony)
      mat.uniforms.shadingToony.value = value
    else mat.shadeToony = value
  }
  mat.needsUpdate = true
}

function toggleAdditiveBlending() {
  if (!selectedMaterial.value)
    return
  selectedMaterial.value.blending = selectedMaterial.value.blending === 2 ? 1 : 2
  selectedMaterial.value.transparent = true
  selectedMaterial.value.needsUpdate = true
}

// Texture Deck Logic
interface TextureItem {
  id: number
  name: string
  type: string
  url: string
  texture: any
  hint?: string
  materials: string[]
}

function prettyMaterialName(name: string) {
  return name
    .replace(/\s*\(Instance\)\s*$/i, '')
    .replace(/\s*\(Outline\)\s*$/i, ' outline')
    .replace(/^N00_[0-9_]+_/, '')
}
const textureList = ref<TextureItem[]>([])

function extractTextures() {
  if (!activeVrm.value)
    return
  const found = new Map<number | string, { tex: any, type: string, nodeName: string, materials: Set<string> }>()

  activeVrm.value.scene.traverse((node: any) => {
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material]
      mats.forEach((m: any) => {
        const slots = [
          { tex: m.map, type: 'Main' },
          { tex: m.shadeMultiplyTexture, type: 'Shade' },
          { tex: m.rimMultiplyTexture, type: 'Rim' },
          { tex: m.sphereAddTexture, type: 'MatCap' },
        ]
        slots.forEach((slot) => {
          if (!slot.tex)
            return
          const idx = getGltfImageIndex(slot.tex)
          const key = idx !== null ? idx : (slot.tex.image?.uuid || slot.tex.image?.src || slot.tex.uuid)
          const materialName = prettyMaterialName(m.name || node.name || 'Unnamed material')
          if (!found.has(key)) {
            found.set(key, { tex: slot.tex, type: slot.type, nodeName: node.name, materials: new Set() })
          }
          found.get(key)!.materials.add(materialName)
        })
      })
    }
  })

  textureList.value = Array.from(found.values()).map((item, i) => {
    return {
      id: i,
      name: item.tex.name || `Tex ${i}`,
      type: item.type,
      url: getTextureUrl(item.tex) || '',
      texture: item.tex,
      hint: item.nodeName,
      materials: [...item.materials],
    }
  })
}

function textureKeyFor(texture: any): number | string | null {
  if (!texture)
    return null
  const idx = getGltfImageIndex(texture)
  if (idx !== null)
    return idx
  return texture.image?.uuid || texture.image?.src || texture.uuid || null
}

function textureMatchesSlot(slot: any, target: any, targetIdx: number | null): boolean {
  if (!slot || !target)
    return false
  const sIdx = getGltfImageIndex(slot)
  if (targetIdx !== null && sIdx !== null)
    return sIdx === targetIdx
  const fingerprint = target.image?.uuid || target.image?.src || target.uuid
  return slot.image?.uuid === fingerprint || slot.image?.src === fingerprint || slot.uuid === fingerprint
}

function selectNode(item: any) {
  vhackStore.selectedNodeName = item.name
  selectedMesh.value = item.node
  let mat: any = null
  if (Array.isArray(item.node.material))
    mat = item.node.material[0]
  else mat = item.node.material
  if (mat) {
    selectedMaterial.value = mat
    vhackStore.selectedMaterialName = mat.name
    const matchingTexture = textureList.value.find(entry =>
      textureMatchesSlot(entry.texture, mat.map, getGltfImageIndex(mat.map)))
    lastSelectedTextureItem.value = matchingTexture ?? null
  }
}

function sharedMaterialNamesFor(texture: any): string[] {
  if (!activeVrm.value || !texture)
    return []
  const targetIdx = getGltfImageIndex(texture)
  const names = new Set<string>()
  activeVrm.value.scene.traverse((node: any) => {
    if (!node.material)
      return
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    mats.forEach((mat: any) => {
      const slots = [mat.map, mat.shadeMultiplyTexture, mat.rimMultiplyTexture, mat.sphereAddTexture]
      if (slots.some(slot => textureMatchesSlot(slot, texture, targetIdx)))
        names.add(mat.name || node.name || 'Material')
    })
  })
  return [...names]
}

function textureSizeLabel(item: TextureItem): string {
  const image = item.texture?.image
  return image?.width && image?.height ? `${image.width} × ${image.height}` : 'Unknown size'
}

function textureFormatLabel(item: TextureItem): string {
  const idx = getGltfImageIndex(item.texture)
  const mime = idx !== null ? activeVrmParser.value?.json?.images?.[idx]?.mimeType : undefined
  if (typeof mime === 'string' && mime.includes('/'))
    return mime.split('/')[1].toUpperCase()
  if (item.url.startsWith('data:image/jpeg'))
    return 'JPEG'
  if (item.url.startsWith('data:image/webp'))
    return 'WEBP'
  return 'PNG'
}

const selectedTextureSharedMaterials = computed(() => {
  if (!lastSelectedTextureItem.value)
    return []
  return sharedMaterialNamesFor(lastSelectedTextureItem.value.texture)
})

const selectedTextureMaterials = computed<string[]>(() => lastSelectedTextureItem.value?.materials ?? [])
const selectedTextureMaterialCount = computed(() => selectedTextureMaterials.value.length || selectedTextureSharedMaterials.value.length)

const filteredTextureList = computed(() => {
  const query = textureFilter.value.trim().toLowerCase()
  return textureList.value.filter((item) => {
    if (textureTypeFilter.value !== 'All' && item.type !== textureTypeFilter.value)
      return false
    return !query
      || item.name.toLowerCase().includes(query)
      || item.materials.some(material => material.toLowerCase().includes(query))
  })
})

const selectedTexture = computed(() => lastSelectedTextureItem.value?.texture ?? selectedMaterial.value?.map ?? null)
const currentTextureKey = computed(() => textureKeyFor(selectedTexture.value))
const currentReplacement = computed(() => {
  const key = currentTextureKey.value
  return key !== null ? replacementByIndex.value.get(key) : undefined
})
const currentReplacementUrl = computed(() => currentReplacement.value?.url ?? null)
const currentPreviewing = computed(() => {
  const key = currentTextureKey.value
  return key !== null && previewingKeys.value.has(key)
})

watch(currentTextureKey, clearUploadFeedback)

function setReplacement(key: number | string, url: string, meta: { source?: 'upload' | 'generated', fileName?: string } = {}) {
  vhackStore.setTextureReplacement?.(key, url, meta)
}

// A texture revision invalidates in-flight generation when a newer upload,
// eraser bake, or revert lands on the same texture.
const replacementRevisions = new Map<number | string, number>()
function bumpReplacementRevision(key: number | string | null): number {
  if (key === null)
    return 0
  const next = (replacementRevisions.get(key) ?? 0) + 1
  replacementRevisions.set(key, next)
  return next
}
function replacementRevisionOf(key: number | string | null): number {
  return key === null ? 0 : (replacementRevisions.get(key) ?? 0)
}

function markPreviewing(key: number | string, value: boolean) {
  vhackStore.markTexturePreviewing?.(key, value)
}

function restoreTextureImages(key: number | string) {
  if (!activeVrm.value)
    return
  const targetIdx = typeof key === 'number' ? key : null
  activeVrm.value.scene.traverse((node: any) => {
    if (!node.material)
      return
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    mats.forEach((mat: any) => {
      const slots = [mat.map, mat.shadeMultiplyTexture, mat.rimMultiplyTexture, mat.sphereAddTexture]
      slots.forEach((slot: any) => {
        if (!slot)
          return
        const sIdx = getGltfImageIndex(slot)
        const matches = targetIdx !== null
          ? sIdx === targetIdx
          : (slot.image?.uuid === key || slot.image?.src === key || slot.uuid === key)
        if (!matches)
          return
        const original = vhackStore.getOriginalTextureImage?.(slot.uuid)
        if (original) {
          slot.image = original
          slot.needsUpdate = true
        }
      })
      mat.needsUpdate = true
    })
  })
}

function applyReplacementPreview() {
  const key = currentTextureKey.value
  const url = currentReplacementUrl.value
  if (key === null || !url || !lastSelectedTextureItem.value)
    return
  swapTextureByRef(url, selectedTexture.value ?? undefined)
  markPreviewing(key, true)
}

function toggleReplacementPreview() {
  const key = currentTextureKey.value
  if (key === null || !currentReplacementUrl.value)
    return
  if (currentPreviewing.value) {
    restoreTextureImages(key)
    if (typeof key === 'number')
      vhackStore.mutatedTextures.delete(key)
    markPreviewing(key, false)
  }
  else {
    applyReplacementPreview()
  }
}

function revertCurrentTexture() {
  const key = currentTextureKey.value
  if (key === null)
    return
  bumpReplacementRevision(key)
  clearUploadFeedback()
  restoreTextureImages(key)
  if (typeof key === 'number')
    vhackStore.mutatedTextures.delete(key)
  vhackStore.removeTextureReplacement?.(key)
  markPreviewing(key, false)
}

function restoreAllReplacementImages() {
  const keys = new Set<number | string>([...replacementByIndex.value.keys(), ...previewingKeys.value])
  keys.forEach(key => restoreTextureImages(key))
}

function findFirstMaterialForTexture(texture: any): { node: any, material: any } | null {
  if (!activeVrm.value || !texture)
    return null
  const targetIdx = getGltfImageIndex(texture)
  let found: { node: any, material: any } | null = null
  activeVrm.value.scene.traverse((node: any) => {
    if (found || !node.material)
      return
    const mats = Array.isArray(node.material) ? node.material : [node.material]
    const material = mats.find((mat: any) => [mat.map, mat.shadeMultiplyTexture, mat.rimMultiplyTexture, mat.sphereAddTexture]
      .some(slot => textureMatchesSlot(slot, texture, targetIdx)))
    if (material)
      found = { node, material }
  })
  return found
}

function selectTexture(item: TextureItem) {
  lastSelectedTextureItem.value = item
  if (!aiPrompt.value)
    aiPrompt.value = `Stylize the ${item.name} texture...`
  const target = findFirstMaterialForTexture(item.texture)
  if (target) {
    vhackStore.selectedNodeName = target.node.name
    selectedMesh.value = target.node
    selectedMaterial.value = target.material
    vhackStore.selectedMaterialName = target.material.name
  }
  else {
    selectedMaterial.value = null
  }
  activeTab.value = 'material'
  nextTick(() => {
    if (scrollContainer.value)
      scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

// Unified Artistry Generation
function effectiveGenerationPrompt() {
  const prompt = aiPrompt.value.trim()
  if (!prompt)
    return prompt
  // Guidance is added to the request only; never rewrite the saved prompt or
  // append the same clause repeatedly.
  if (/(uv\s*layout|seams|transparent\s*areas)/i.test(prompt))
    return prompt
  return `${prompt}\n\n${UV_GUIDANCE}`
}

async function generateAndSwap() {
  const targetTex = selectedTexture.value
  if (!targetTex || !aiPrompt.value)
    return

  const replacementKey = textureKeyFor(targetTex)
  const targetIdx = getGltfImageIndex(targetTex)
  const generationRevision = bumpReplacementRevision(replacementKey)
  const generationVrm = activeVrm.value
  // The visible texture may be gamma-compensated for preview; generation must
  // start from the raw applied image so the provider does not receive a
  // double-darkened result.
  const generationReplacementUrl = currentPreviewing.value ? currentReplacementUrl.value : null
  clearUploadFeedback()
  generationTargetName.value = lastSelectedTextureItem.value?.name || targetTex.name || 'selected texture'

  vhackStore.isGeneratingTexture = true
  vhackStore.generationProgress = 10
  vhackStore.generationActionLabel = 'Preparing Canvas'
  vhackStore.lastGenerationError = null
  isGenerating.value = true
  aiError.value = null

  try {
    const map = targetTex
    if (!map)
      throw new Error('No texture selected')

    // 1. Prepare base64 from the raw current texture
    const sourceImage = generationReplacementUrl ? await loadHtmlImage(generationReplacementUrl) : map.image
    const sourceWidth = sourceImage.width || sourceImage.naturalWidth
    const sourceHeight = sourceImage.height || sourceImage.naturalHeight
    const canvas = document.createElement('canvas')
    canvas.width = sourceWidth
    canvas.height = sourceHeight
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new Error('Failed to create canvas context')
    ctx.drawImage(sourceImage, 0, 0, sourceWidth, sourceHeight)
    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]

    // 2. Call Headless Artistry Bridge
    let options: Record<string, any> = {}
    const globals: Record<string, any> = {
      ...JSON.parse(JSON.stringify(artistryStore.$state)),
      image: base64Data,
    }
    let model: string | undefined

    if (artistryStore.activeProvider === 'nanobanana') {
      options = {
        resolution: artistryStore.nanobananaResolution,
        model: artistryStore.nanobananaModel,
      }
    }
    else if (artistryStore.activeProvider === 'replicate') {
      options = JSON.parse(aiReplicateParams.value || '{}')
      model = aiReplicateModelId.value
    }
    else if (artistryStore.activeProvider === 'comfyui') {
      try {
        options = JSON.parse(aiComfyParams.value || '{}')
      }
      catch (e) {
        options = {}
      }
      model = artistryStore.comfyuiActiveWorkflow
    }

    const result = await generateInvoke({
      prompt: effectiveGenerationPrompt(),
      provider: artistryStore.activeProvider,
      options,
      globals,
      model,
    })

    if (result?.error) {
      aiError.value = result.error
      vhackStore.lastGenerationError = result.error
      return
    }

    if (result?.base64) {
      // A newer upload/eraser/revert on the originating texture, or a model
      // change, invalidates this result.
      if (activeVrm.value !== generationVrm || replacementRevisionOf(replacementKey) !== generationRevision) {
        const message = 'Generation finished after the texture changed; result discarded.'
        aiError.value = message
        vhackStore.lastGenerationError = message
        return
      }

      vhackStore.generationProgress = 90
      vhackStore.generationActionLabel = 'Applying Result'

      const newUrl = result.base64.startsWith('data:') ? result.base64 : `data:image/png;base64,${result.base64}`

      swapTextureByRef(newUrl, targetTex)
      if (replacementKey !== null) {
        setReplacement(replacementKey, newUrl, { source: 'generated' })
        markPreviewing(replacementKey, true)
      }

      // Register mutation for surgical persistence
      if (targetIdx !== null) {
        vhackStore.registerMutation(targetIdx, newUrl.split(',')[1], 'image/png')
      }

      vhackStore.generationProgress = 100
      vhackStore.generationActionLabel = 'Success'
    }
    else {
      aiError.value = 'No image data returned from provider'
      vhackStore.lastGenerationError = aiError.value
    }
  }
  catch (e: any) {
    aiError.value = e.message || 'Generation failed'
    vhackStore.lastGenerationError = aiError.value
  }
  finally {
    isGenerating.value = false
    vhackStore.isGeneratingTexture = false
    generationTargetName.value = null
    setTimeout(() => {
      vhackStore.generationProgress = 0
      vhackStore.generationActionLabel = null
    }, 2000)
  }
}

function triggerManualUpload() {
  textureUploader.value?.click()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode that image.'))
    image.src = src
  })
}

function imageHasTransparency(image: any): boolean {
  const width = image?.width || image?.naturalWidth
  const height = image?.height || image?.naturalHeight
  if (!width || !height)
    return false
  const scale = Math.min(1, 256 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return false
  try {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255)
        return true
    }
  }
  catch {
    return false
  }
  return false
}

function inferImageMime(file: File): string | null {
  const type = file.type.toLowerCase()
  if (['image/png', 'image/jpeg', 'image/webp'].includes(type))
    return type
  if (/\.png$/i.test(file.name))
    return 'image/png'
  if (/\.jpe?g$/i.test(file.name))
    return 'image/jpeg'
  if (/\.webp$/i.test(file.name))
    return 'image/webp'
  return null
}

interface DecodedUpload {
  dataUrl: string
  width: number
  height: number
  hasAlpha: boolean
  mime: string
}

async function decodeUploadFile(file: File): Promise<DecodedUpload> {
  const mime = inferImageMime(file)
  if (!mime)
    throw new Error('Use a PNG, JPEG, or WebP image.')
  const rawDataUrl = await readFileAsDataUrl(file)
  const base64 = rawDataUrl.split(',')[1]
  const dataUrl = `data:${mime};base64,${base64}`
  const image = await loadHtmlImage(dataUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height)
    throw new Error('That image has no readable dimensions.')
  return { dataUrl, width, height, hasAlpha: imageHasTransparency(image), mime }
}

function clearUploadFeedback() {
  uploadNotice.value = null
  uploadError.value = null
}

async function applyUploadFile(file: File) {
  clearUploadFeedback()
  const targetTex = selectedTexture.value
  if (!targetTex)
    return
  const replacementKey = textureKeyFor(targetTex)

  try {
    // Decode and validate before touching the live texture.
    const decoded = await decodeUploadFile(file)
    const original = vhackStore.getOriginalTextureImage?.(targetTex.uuid) || targetTex.image
    const originalWidth = original?.width || original?.naturalWidth
    const originalHeight = original?.height || original?.naturalHeight
    const notices: UploadNotice = {}

    if (originalWidth && originalHeight && (originalWidth !== decoded.width || originalHeight !== decoded.height)) {
      notices.dimension = `Dimensions ${decoded.width}×${decoded.height} differ from the original ${originalWidth}×${originalHeight}; UVs will stretch.`
    }
    if (original && imageHasTransparency(original) && !decoded.hasAlpha) {
      notices.transparency = 'This upload has no transparency, but the original texture does; cut-out areas may fill in.'
    }
    if (decoded.mime !== 'image/png') {
      notices.format = 'PNG is recommended; JPEG and WebP can lose alpha or quality.'
    }
    uploadNotice.value = currentTextureKey.value === replacementKey && Object.keys(notices).length ? notices : null

    // Successful decode: this now invalidates any in-flight generation for
    // this texture and applies immediately.
    aiError.value = null
    vhackStore.lastGenerationError = null
    bumpReplacementRevision(replacementKey)
    swapTextureByRef(decoded.dataUrl, targetTex)
    if (replacementKey !== null) {
      setReplacement(replacementKey, decoded.dataUrl, { source: 'upload', fileName: file.name })
      markPreviewing(replacementKey, true)
    }
    const imgIndex = getGltfImageIndex(targetTex)
    if (imgIndex !== null) {
      vhackStore.registerMutation(imgIndex, decoded.dataUrl.split(',')[1], decoded.mime)
    }
  }
  catch (e: any) {
    if (currentTextureKey.value === replacementKey)
      uploadError.value = e?.message || 'Could not load that image.'
  }
}

async function handleManualUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file)
    await applyUploadFile(file)
}

function handleUploadDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file)
    void applyUploadFile(file)
}

// The washed-out preview treats sRGB texels as linear before the renderer
// encodes them again. Pre-linearizing the displayed image compensates for that
// double encode (sRGB EOTF -> sample as linear -> sRGB OETF ≈ original), giving
// a close approximation of the exported VRM without touching the colorSpace
// path or the export bytes.
function targetIsColorMap(target: any, targetIdx: number | null): boolean {
  if (!activeVrm.value || !target)
    return false
  let found = false
  activeVrm.value.scene.traverse((node: any) => {
    if (found || !node.material)
      return
    const materials = Array.isArray(node.material) ? node.material : [node.material]
    materials.forEach((mat: any) => {
      if (!found && mat.map && textureMatchesSlot(mat.map, target, targetIdx))
        found = true
    })
  })
  return found
}

function linearizeForPreview(image: any): HTMLCanvasElement | null {
  if (!image?.width || !image?.height)
    return null
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const c = i / 255
    const linear = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    lut[i] = Math.round(linear * 255)
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]]
    data[i + 1] = lut[data[i + 1]]
    data[i + 2] = lut[data[i + 2]]
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function swapTextureByRef(url: string, targetRef?: any) {
  console.info('>>> [VHACK] Starting swap sequence (NUCLEAR)...', { url: `${url.substring(0, 40)}...`, targetRef })
  const target = targetRef || selectedMaterial.value?.map
  if (!target || !activeVrm.value)
    return

  const targetIdx = getGltfImageIndex(target)
  const targetFingerprint = target.image?.uuid || target.image?.src || target.uuid
  const previewShouldLinearize = targetIsColorMap(target, targetIdx)

  const loader = new THREE.TextureLoader()
  loader.load(url, (tex: any) => {
    const img = tex.image
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      // ALPHA PATCH: Key out dark/black pixels to restore transparency for overlays
      let blackCount = 0
      const tolerance = 8 // Key out anything darker than 8/255 (approx 3% gray)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]; const g = data[i + 1]; const b = data[i + 2]
        if (r <= tolerance && g <= tolerance && b <= tolerance) {
          data[i + 3] = 0
          blackCount++
        }
      }
      if (blackCount > 0) {
        console.log(`[VHACK] Alpha Patch: Keyed out ${blackCount} black pixels.`)
        ctx.putImageData(imageData, 0, 0)
        tex.image = canvas
      }
    }

    // Export data must stay raw (or alpha-patched); only the in-memory preview
    // image gets the gamma compensation.
    const exportImage = tex.image
    let previewImage = exportImage
    if (previewShouldLinearize) {
      const compensated = linearizeForPreview(exportImage)
      if (compensated) {
        previewImage = compensated
        console.info('[VHACK] Preview gamma compensation applied.')
      }
    }

    activeVrm.value!.scene.traverse((node: any) => {
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        materials.forEach((mat: any) => {
          let updated = false
          const slots = ['map', 'shadeMultiplyTexture', 'rimMultiplyTexture', 'sphereAddTexture']

          slots.forEach((slot) => {
            const currentSlotTex = mat[slot]
            if (!currentSlotTex)
              return

            const sIdx = getGltfImageIndex(currentSlotTex)
            const matches = (targetIdx !== null && sIdx !== null)
              ? sIdx === targetIdx
              : (currentSlotTex.image?.uuid === targetFingerprint || currentSlotTex.image?.src === targetFingerprint || currentSlotTex.uuid === targetFingerprint)

            if (matches) {
              console.log(`[VHACK] Nuclear Match: ${node.name} [${slot}]. Injecting pixels.`)

              // Keep the pre-swap image so preview-off / per-texture revert can
              // restore it without reloading the original VRM.
              vhackStore.setOriginalTextureImage?.(currentSlotTex.uuid, currentSlotTex.image)

              currentSlotTex.image = previewImage
              currentSlotTex.colorSpace = tex.colorSpace
              currentSlotTex.needsUpdate = true
              updated = true

              // PERSISTENCE BAKE: Register this mutation in the store so it survives export
              if (sIdx !== null) {
                // Determine mime type from the data URL (JPEG/WebP uploads must
                // keep their format when preview is toggled back on).
                const mimeType = url.startsWith('data:image/webp')
                  ? 'image/webp'
                  : url.startsWith('data:image/jpeg')
                    ? 'image/jpeg'
                    : 'image/png'
                // Convert current canvas/image back to base64 if it was modified by the alpha patch
                const finalDataUrl = (exportImage instanceof HTMLCanvasElement) ? exportImage.toDataURL(mimeType) : url
                const base64Data = finalDataUrl.split(',')[1]
                vhackStore.registerMutation(sIdx, base64Data, mimeType)
              }
            }
          })
          if (updated)
            mat.needsUpdate = true
        })
      }
    })
    console.log('[VHACK] Swap complete.')
  })
}

/**
 * PICK & PURGE LOGIC
 */
function openEraser(url: string) {
  eraserImageUrl.value = url
  isEraserOpen.value = true
  isEraserPicking.value = true
  eraserPickedColor.value = null

  // Wait for canvas to mount then draw
  nextTick(() => {
    if (eraserCanvas.value) {
      const img = new Image()
      img.onload = () => {
        eraserCanvas.value!.width = img.width
        eraserCanvas.value!.height = img.height
        const ctx = eraserCanvas.value!.getContext('2d')
        ctx?.drawImage(img, 0, 0)
      }
      img.src = url
    }
  })
}

function handleEraserClick(e: MouseEvent) {
  if (!eraserCanvas.value || !isEraserPicking.value)
    return
  const rect = eraserCanvas.value.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) * (eraserCanvas.value.width / rect.width))
  const y = Math.floor((e.clientY - rect.top) * (eraserCanvas.value.height / rect.height))

  const ctx = eraserCanvas.value.getContext('2d')
  if (!ctx)
    return

  const pixel = ctx.getImageData(x, y, 1, 1).data
  eraserPickedColor.value = [pixel[0], pixel[1], pixel[2]]
  console.log('[VHACK] Color Picked:', eraserPickedColor.value)

  // Auto-preview purge
  applyEraserPurge()
}

function applyEraserPurge() {
  if (!eraserCanvas.value || !eraserPickedColor.value)
    return
  const img = new Image()
  img.onload = () => {
    const canvas = eraserCanvas.value!
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const [tr, tg, tb] = eraserPickedColor.value!
    const tol = eraserTolerance.value

    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2]
      const diff = Math.sqrt(
        (r - tr) ** 2
        + (g - tg) ** 2
        + (b - tb) ** 2,
      )

      if (diff <= tol) {
        data[i + 3] = 0
        count++
      }
    }
    ctx.putImageData(imageData, 0, 0)
    console.log(`[VHACK] Eraser: Purged ${count} pixels.`)
  }
  img.src = eraserImageUrl.value
}

function finalizeEraserBake() {
  if (!eraserCanvas.value)
    return
  const cleanedUrl = eraserCanvas.value.toDataURL('image/png')
  // Re-run the swap with the cleaned URL
  // This will also hit the vhackStore.registerMutation we added above
  swapTextureByRef(cleanedUrl, selectedTexture.value ?? undefined)
  const key = currentTextureKey.value
  if (key !== null) {
    const previous = currentReplacement.value
    bumpReplacementRevision(key)
    setReplacement(key, cleanedUrl, { source: previous?.source, fileName: previous?.fileName })
    markPreviewing(key, true)
  }
  isEraserOpen.value = false
}

// Binary Export Logic
// Binary Export Logic (Surgical)

// --- Export filename ---------------------------------------------------------
// The native save panel uses this name, so prefer the real source name over a
// generic "Surgical" fallback: VRM meta -> display-model name/file -> URL
// basename -> active card -> stable id.
function sanitizeModelBaseName(value?: string | null): string {
  if (!value)
    return ''
  let name = value.trim()
  try {
    name = decodeURIComponent(name)
  }
  catch {}
  name = name.split(/[?#]/)[0]
  name = name.split(/[\\/]/).pop() || name
  name = name.replace(/\.(vrm|glb|gltf|zip|pmx|pmd)$/i, '')
  name = name.replace(/^(display-model-|preset-)/i, '')
  name = name.replace(/[<>:"|?*\u0000-\u001F]/g, '_')
  name = name.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^[._]+|[._]+$/g, '')
  return name.slice(0, 64)
}

function modelNameFromUrl(url?: string | null): string {
  if (!url || url.startsWith('blob:') || url.startsWith('data:'))
    return ''
  try {
    return new URL(url).pathname.split('/').pop() || ''
  }
  catch {
    return url.split('/').pop() || ''
  }
}

function resolveModelBaseName(): string {
  const displayModel: any = settingsStore.stageModelSelectedDisplayModel
  const candidates = [
    activeVrm.value?.meta?.name,
    activeVrm.value?.meta?.title,
    displayModel?.name,
    displayModel?.file?.name,
    settingsStore.stageModelSelectedFile?.name,
    modelNameFromUrl(settingsStore.stageModelSelectedUrl),
    displayModel?.url ? modelNameFromUrl(displayModel.url) : '',
    airiCardStore.activeCard?.name,
    settingsStore.stageModelSelected,
  ]
  for (const candidate of candidates) {
    const name = sanitizeModelBaseName(candidate)
    if (name)
      return name
  }
  return 'Avatar'
}

function buildExportFileName(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `${resolveModelBaseName()}_VHACK_${stamp}.vrm`
}

async function exportVrm() {
  if (!activeVrm.value)
    return

  if (!vhackStore.sourceArrayBuffer) {
    if (settingsStore.stageModelSelectedFile) {
      vhackStore.setSourceArrayBuffer(await settingsStore.stageModelSelectedFile.arrayBuffer(), { resetMutations: false })
    }
    else if (settingsStore.stageModelSelectedUrl) {
      try {
        const res = await fetch(settingsStore.stageModelSelectedUrl)
        vhackStore.setSourceArrayBuffer(await res.arrayBuffer(), { resetMutations: false })
      }
      catch (e) {
        console.warn('[VHack] Failed to fetch source ArrayBuffer on demand:', e)
      }
    }
  }

  if (!vhackStore.sourceArrayBuffer) {
    aiError.value = 'No source binary found (Reload model?)'
    return
  }
  isExporting.value = true
  try {
    const originalBuffer = vhackStore.sourceArrayBuffer
    const dataView = new DataView(originalBuffer)

    // GLB Header
    const magic = dataView.getUint32(0, true)
    if (magic !== 0x46546C67)
      throw new Error('Invalid GLB magic')

    // JSON Chunk
    const jsonLen = dataView.getUint32(12, true)
    const jsonContent = new TextDecoder().decode(new Uint8Array(originalBuffer, 20, jsonLen))
    const gltf = JSON.parse(jsonContent)

    // EXPORT VISIBILITY SURGERY: Permanently disable nodes that are hidden in the UI
    console.group('>>> [VHACK] Surgical Export (Primitive-Aware Active)')
    let unlinkedCount = 0
    let hiddenCandidates = 0

    // Create a "Hidden Material" to neuter merged mesh primitives safely
    if (!gltf.materials)
      gltf.materials = []
    const hiddenMatIdx = gltf.materials.length
    gltf.materials.push({
      name: 'VHACK_HIDDEN',
      pbrMetallicRoughness: {
        baseColorFactor: [0, 0, 0, 0], // Fully transparent
        metallicFactor: 0,
        roughnessFactor: 1,
      },
      alphaMode: 'BLEND',
    })

    activeVrm.value.scene.traverse((node: any) => {
      const isRenderable = node.type === 'Mesh' || node.type === 'SkinnedMesh'
      const isRuntimeProxy = node.name?.startsWith('VRMExpression')

      if (node.visible === false && isRenderable && !isRuntimeProxy) {
        hiddenCandidates++
        const assoc = activeVrmParser.value.associations.get(node)
        const nodeIdx = getGltfNodeIndex(node, gltf)

        // CASE A: Merged Mesh Primitive (Gura Mode)
        // If Three.js split the mesh, associations will point to a specific primitive
        if (assoc && assoc.meshes !== undefined && assoc.primitives !== undefined) {
          const meshIdx = assoc.meshes
          const primIdx = assoc.primitives
          if (gltf.meshes[meshIdx] && gltf.meshes[meshIdx].primitives[primIdx]) {
            console.log(`[VHACK] Primitive Surgery: Neutering Mesh [${meshIdx}] Prim [${primIdx}] ("${node.name}")`)
            gltf.meshes[meshIdx].primitives[primIdx].material = hiddenMatIdx
            unlinkedCount++
          }
        }
        // CASE B: Isolated Node (Maika Mode)
        // If it's a dedicated node for this part, use the scale trick
        else if (nodeIdx !== null && gltf.nodes[nodeIdx]) {
          console.log(`[VHACK] Node Surgery (Ghost Scale): Hiding Node [${nodeIdx}] ("${node.name}")`)
          gltf.nodes[nodeIdx].scale = [0, 0, 0]
          unlinkedCount++
        }
      }
    })

    if (hiddenCandidates > 0 && unlinkedCount === 0) {
      console.error('[VHACK] CRITICAL FAILURE: Found hidden meshes but could not resolve any GLTF indices.')
    }
    console.log(`[VHACK] Surgery Complete. Candidates: ${hiddenCandidates}, Unlinked: ${unlinkedCount}`)
    console.groupEnd()

    // BIN Chunk Info
    const binOffset = 20 + jsonLen + 8
    const binLen = dataView.getUint32(20 + jsonLen, true)
    const originalBin = new Uint8Array(originalBuffer, binOffset, binLen)

    // Mutation map: offset -> new data
    // We only mutate if the texture exists in both our registry and the original file
    const mutations: { offset: number, oldLen: number, newData: Uint8Array }[] = []

    vhackStore.mutatedTextures.forEach((val, imgIndex) => {
      const img = gltf.images[imgIndex]
      if (img && img.bufferView !== undefined) {
        const bv = gltf.bufferViews[img.bufferView]
        const binaryString = atob(val.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
        mutations.push({ offset: bv.byteOffset, oldLen: bv.byteLength, newData: bytes })
        // Update JSON with new length and format so the rebuilt GLB stays valid
        bv.byteLength = bytes.length
        img.mimeType = val.mimeType || img.mimeType || 'image/png'
      }
    })

    // Sort mutations by offset so we can splice sequentially
    mutations.sort((a, b) => a.offset - b.offset)

    // Reconstruction logic: Building a NEW BIN chunk and updating all bufferView offsets
    let currentShift = 0
    let lastOriginalOffset = 0
    const newBinParts: Uint8Array[] = []

    // We need to update ALL bufferViews, not just mutated ones, because their offsets shift
    const sortedBufferViews = gltf.bufferViews.map((bv: any, idx: number) => ({ ...bv, idx })).sort((a: any, b: any) => a.byteOffset - b.byteOffset)

    sortedBufferViews.forEach((bvProxy: any) => {
      const originalBv = gltf.bufferViews[bvProxy.idx]
      const mutation = mutations.find(m => m.offset === originalBv.byteOffset)

      // 1. Copy original data from last offset to current offset
      if (originalBv.byteOffset > lastOriginalOffset) {
        newBinParts.push(originalBin.slice(lastOriginalOffset, originalBv.byteOffset))
      }

      // Update this bufferView's offset in the final JSON
      originalBv.byteOffset += currentShift

      if (mutation) {
        // 2. Inject mutated data
        newBinParts.push(mutation.newData)
        currentShift += (mutation.newData.length - mutation.oldLen)
        lastOriginalOffset = mutation.offset + mutation.oldLen
      }
      else {
        // 3. Copy original bufferView data
        newBinParts.push(originalBin.slice(originalBv.byteOffset - currentShift, originalBv.byteOffset - currentShift + originalBv.byteLength))
        lastOriginalOffset = originalBv.byteOffset - currentShift + originalBv.byteLength
      }

      // 4. Handle alignment (GLB requires 4-byte padding for bufferViews)
      const currentTotalLen = newBinParts.reduce((acc, curr) => acc + curr.length, 0)
      const padding = (4 - (currentTotalLen % 4)) % 4
      if (padding > 0) {
        newBinParts.push(new Uint8Array(padding).fill(0x20)) // Padding with spaces or zeros
        currentShift += padding
        // Note: we don't increment lastOriginalOffset here because padding is "fresh"
      }
    })

    // Copy remaining original BIN data if any
    if (lastOriginalOffset < originalBin.length) {
      newBinParts.push(originalBin.slice(lastOriginalOffset))
    }

    // Final JSON Stringification and Padding (Surgical UTF-8 Fix)
    const jsonEncoder = new TextEncoder()
    const jsonStr = JSON.stringify(gltf)
    let jsonBytes = jsonEncoder.encode(jsonStr)

    const jsonPadding = (4 - (jsonBytes.length % 4)) % 4
    if (jsonPadding > 0) {
      const paddedBytes = new Uint8Array(jsonBytes.length + jsonPadding)
      paddedBytes.set(jsonBytes)
      for (let i = 0; i < jsonPadding; i++) paddedBytes[jsonBytes.length + i] = 0x20 // Pad with spaces
      jsonBytes = paddedBytes
    }

    const finalBinLen = newBinParts.reduce((acc, curr) => acc + curr.length, 0)
    // The buffer's declared length must follow the rebuilt BIN chunk, otherwise
    // strict glTF/VRM loaders may ignore the patched texture bytes.
    if (gltf.buffers?.[0])
      gltf.buffers[0].byteLength = finalBinLen
    const finalTotalLen = 12 + 8 + jsonBytes.length + 8 + finalBinLen

    // Assembly
    const outputBuffer = new ArrayBuffer(finalTotalLen)
    const outView = new DataView(outputBuffer)
    const outBytes = new Uint8Array(outputBuffer)

    // Header
    outView.setUint32(0, 0x46546C67, true)
    outView.setUint32(4, 2, true)
    outView.setUint32(8, finalTotalLen, true)

    // JSON Chunk Header
    outView.setUint32(12, jsonBytes.length, true)
    outView.setUint32(16, 0x4E4F534A, true) // "JSON"

    // JSON Content
    outBytes.set(jsonBytes, 20)

    // BIN Chunk Header
    const binChunkHeaderOffset = 20 + jsonBytes.length
    outView.setUint32(binChunkHeaderOffset, finalBinLen, true)
    outView.setUint32(binChunkHeaderOffset + 4, 0x004E4942, true) // "BIN"

    // BIN Content
    let currentOutOffset = binChunkHeaderOffset + 8
    newBinParts.forEach((part) => {
      outBytes.set(part, currentOutOffset)
      currentOutOffset += part.length
    })

    // Download
    const blob = new Blob([outputBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildExportFileName()
    link.click()
    URL.revokeObjectURL(url)
  }
  catch (e: any) {
    console.error('Surgical export failed:', e)
    aiError.value = `Export failed: ${e.message}`
  }
  finally {
    isExporting.value = false
  }
}

function downloadTexture(url: string | null, name: string, extension = 'png') {
  if (!url)
    return
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.${extension}`
  link.click()
}

function downloadOriginalTexture() {
  const item = lastSelectedTextureItem.value
  if (!item?.url)
    return
  const base = (item.name || 'texture')
    .replace(/[^\w-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'texture'
  downloadTexture(item.url, `${base}_original`, textureFormatLabel(item).toLowerCase())
}

function revert() {
  if (!activeVrm.value)
    return
  // Put back every image mutated by a preview before restoring snapshots.
  restoreAllReplacementImages()
  vhackStore.clearTextureReplacements?.()
  replacementRevisions.clear()
  clearUploadFeedback()
  aiError.value = null
  activeVrm.value.scene.traverse((node: any) => {
    const snap = vhackStore.snapshotMap.get(node.uuid)
    if (snap) {
      node.visible = snap.visible
      if (!snap.visible)
        vhackStore.hiddenNodeUuids.add(node.uuid)
      else vhackStore.hiddenNodeUuids.delete(node.uuid)
      if (node.material && snap.props) {
        const mat = Array.isArray(node.material) ? node.material[0] : node.material
        if ('rimWidthFactor' in mat)
          mat.rimWidthFactor = snap.props.rimWidth
        else if (mat.uniforms?.rimWidth)
          mat.uniforms.rimWidth.value = snap.props.rimWidth
        if ('shadingShiftFactor' in mat)
          mat.shadingShiftFactor = snap.props.shadeShift
        else if (mat.uniforms?.shadingShift)
          mat.uniforms.shadingShift.value = snap.props.shadeShift
        if ('shadingToonyFactor' in mat)
          mat.shadingToonyFactor = snap.props.shadeToony
        else if (mat.uniforms?.shadingToony)
          mat.uniforms.shadingToony.value = snap.props.shadeToony
        mat.map = snap.props.map
        mat.needsUpdate = true
      }
    }
  })
  // Restoring material maps is not enough: the export path reads the mutation
  // registry, so a reset must drop those entries too.
  vhackStore.mutatedTextures.clear()
  extractTextures()
}

watch(activeVrm, () => {
  if (activeVrm.value) {
    extractTextures()
    takeGlobalSnapshot()
  }
}, { immediate: true })

// A new model binary clears the replacement workspace in the store; drop the
// panel's selection pointers when that happens (not on section remount).
watch(() => vhackStore.sourceArrayBuffer, () => {
  lastSelectedTextureItem.value = null
  selectedMaterial.value = null
  selectedMesh.value = null
  vhackStore.selectedNodeName = null
  replacementRevisions.clear()
  clearUploadFeedback()
})
onMounted(() => {
  if (activeVrm.value)
    takeGlobalSnapshot()
})
</script>

<template>
  <div class="min-w-0 w-full flex flex-col gap-3">
    <!-- Tabs -->
    <div class="flex gap-1 rounded-xl bg-neutral-100 p-1 text-[10px] font-bold tracking-widest uppercase dark:bg-neutral-800">
      <button
        v-for="tab in TOOL_TABS"
        :key="tab.id"
        type="button"
        :class="[
          'flex-1 py-2 rounded-lg transition-colors',
          activeTab === tab.id
            ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-300'
            : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
        ]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Content -->
    <div class="custom-scrollbar max-h-[560px] min-h-0 overflow-y-auto">
      <!-- Textures -->
      <div v-if="activeTab === 'texture'" class="flex flex-col gap-3 p-1">
        <div class="relative min-w-0">
          <div class="i-solar:magnifer-linear absolute left-3 top-1/2 shrink-0 translate-y-[-50%] text-neutral-400" />
          <input
            v-model="textureFilter"
            placeholder="Find a texture or material..."
            class="w-full border border-neutral-200 rounded-xl bg-white py-2 pl-9 pr-3 text-xs text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-900 dark:text-neutral-100"
          >
        </div>

        <div class="flex items-center gap-1.5">
          <button
            v-for="filter in textureTypeFilters"
            :key="filter"
            type="button"
            :class="[
              'rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors',
              textureTypeFilter === filter
                ? 'bg-primary-600 text-white'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700',
            ]"
            @click="textureTypeFilter = filter"
          >
            {{ filter }}
          </button>
          <span class="ml-auto text-[10px] text-neutral-400">
            {{ filteredTextureList.length }} textures
          </span>
        </div>

        <button
          v-if="lastSelectedTextureItem"
          type="button"
          class="w-full flex items-center gap-2 border border-primary-500/30 rounded-xl bg-primary-500/5 p-2 text-left transition-colors hover:border-primary-500/50"
          @click="activeTab = 'material'"
        >
          <img v-if="lastSelectedTextureItem.url" :src="lastSelectedTextureItem.url" class="h-8 w-8 shrink-0 rounded-md object-cover">
          <div class="min-w-0 flex-1">
            <div class="truncate text-[11px] text-neutral-800 font-semibold dark:text-neutral-100">
              {{ lastSelectedTextureItem.name }}
            </div>
            <div class="text-[9px] text-neutral-400">
              Shared by {{ selectedTextureSharedMaterials.length }} material{{ selectedTextureSharedMaterials.length === 1 ? '' : 's' }}
            </div>
            <div class="truncate text-[8px] text-neutral-400" :title="selectedTextureMaterials.join(', ')">
              {{ lastSelectedTextureItem.materials.slice(0, 3).join(' · ') }}{{ lastSelectedTextureItem.materials.length > 3 ? ` +${lastSelectedTextureItem.materials.length - 3}` : '' }}
            </div>
          </div>
          <span class="shrink-0 border border-primary-500/30 rounded-lg bg-white px-2 py-1 text-[10px] text-primary-600 font-semibold dark:bg-neutral-900 dark:text-primary-300">
            Open in Lab
          </span>
        </button>

        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="item in filteredTextureList"
            :key="item.id"
            type="button"
            :class="[
              'group flex flex-col overflow-hidden rounded-xl border text-left transition-colors',
              lastSelectedTextureItem?.id === item.id
                ? 'border-primary-500/60 bg-primary-500/5'
                : 'border-neutral-200/80 bg-white/70 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-neutral-700',
            ]"
            :title="item.materials.join(', ')"
            @click="selectTexture(item)"
          >
            <div class="texture-checker relative aspect-square w-full overflow-hidden">
              <img v-if="item.url" :src="item.url" class="absolute inset-0 h-full w-full object-contain">
              <div v-else class="h-full w-full flex items-center justify-center text-neutral-400">
                <div class="i-solar:gallery-bold-duotone text-2xl" />
              </div>
              <span class="absolute right-1.5 top-1.5 rounded-md bg-neutral-900/80 px-1.5 py-0.5 text-[8px] text-white font-semibold">
                {{ item.type }}
              </span>
            </div>
            <div class="w-full flex flex-col gap-0.5 border-t border-neutral-200/70 p-2 dark:border-neutral-800">
              <span class="w-full truncate text-[11px] text-neutral-800 font-semibold dark:text-neutral-100">{{ item.name }}</span>
              <span class="text-[9px] text-neutral-400">{{ textureSizeLabel(item) }} · {{ textureFormatLabel(item) }}</span>
              <span class="w-full truncate text-[8px] text-primary-600/80 dark:text-primary-300/80">
                {{ item.materials[0] }}{{ item.materials.length > 1 ? ` +${item.materials.length - 1}` : '' }}
              </span>
            </div>
          </button>

          <div v-if="filteredTextureList.length === 0" class="col-span-2 py-8 text-center text-xs text-neutral-400">
            No textures found.
          </div>
        </div>

        <p class="px-1 text-[10px] text-neutral-400">
          Select a texture to open it in the Lab.
        </p>
      </div>

      <!-- Lab -->
      <div v-else-if="activeTab === 'material'" class="p-1 space-y-3">
        <template v-if="selectedMaterial">
          <template v-if="lastSelectedTextureItem">
            <!-- Selected texture header -->
            <div class="flex items-center gap-2 border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
              <img v-if="lastSelectedTextureItem.url" :src="lastSelectedTextureItem.url" class="h-10 w-10 shrink-0 rounded-lg object-cover">
              <div class="min-w-0 flex-1">
                <div class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                  {{ lastSelectedTextureItem.name }}
                  <span class="text-[10px] text-neutral-400 font-normal">· {{ lastSelectedTextureItem.type }} texture</span>
                </div>
                <details class="material-owner-details">
                  <summary class="flex cursor-pointer select-none items-center gap-1 text-[10px] text-neutral-400">
                    <span>{{ textureSizeLabel(lastSelectedTextureItem) }} · Used by {{ selectedTextureMaterialCount }} material{{ selectedTextureMaterialCount === 1 ? '' : 's' }}</span>
                    <div class="materials-chevron i-solar:alt-arrow-down-bold text-[9px] transition-transform" />
                  </summary>
                  <div class="custom-scrollbar mt-1 max-h-24 overflow-y-auto pr-1">
                    <div
                      v-for="(material, index) in selectedTextureMaterials"
                      :key="`${material}-${index}`"
                      class="truncate text-[9px] text-neutral-500 dark:text-neutral-400"
                      :title="material"
                    >
                      {{ material }}
                    </div>
                  </div>
                </details>
              </div>
              <button type="button" class="shrink-0 text-[10px] text-primary-600 font-medium dark:text-primary-300" @click="activeTab = 'texture'">
                Change texture
              </button>
            </div>

            <!-- Current / Replacement -->
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between px-0.5">
                  <span class="text-[10px] text-neutral-500 font-semibold dark:text-neutral-400">Current texture</span>
                </div>
                <div class="texture-checker relative aspect-square overflow-hidden border border-neutral-200/80 rounded-xl dark:border-neutral-800">
                  <img v-if="lastSelectedTextureItem.url" :src="lastSelectedTextureItem.url" class="absolute inset-0 h-full w-full object-contain">
                  <div v-else class="h-full w-full flex items-center justify-center text-[9px] text-neutral-400">
                    No texture
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between px-0.5">
                  <span class="text-[10px] text-neutral-500 font-semibold dark:text-neutral-400">Replacement texture</span>
                  <span class="flex items-center gap-1">
                    <button
                      type="button"
                      :disabled="!currentReplacementUrl"
                      :class="[
                        'flex items-center gap-1 text-[9px] font-medium transition-colors disabled:op-40',
                        currentPreviewing ? 'text-primary-600 dark:text-primary-300' : 'text-neutral-400',
                      ]"
                      :title="currentPreviewing ? 'Hide replacement preview' : 'Preview replacement on the avatar'"
                      @click="toggleReplacementPreview"
                    >
                      <div :class="[currentPreviewing ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold']" />
                      Preview
                    </button>
                    <span class="text-[8px] text-neutral-400">on avatar</span>
                  </span>
                </div>
                <div class="texture-checker relative aspect-square overflow-hidden border border-neutral-200/80 rounded-xl dark:border-neutral-800">
                  <img v-if="currentReplacementUrl" :src="currentReplacementUrl" class="absolute inset-0 h-full w-full object-contain">
                  <div v-else class="h-full w-full flex items-center justify-center text-[9px] text-neutral-400">
                    No replacement yet
                  </div>
                  <div v-if="currentReplacementUrl" class="absolute right-1 top-1 flex gap-1">
                    <button
                      type="button"
                      class="rounded-md bg-neutral-900/70 p-1 text-white transition-colors hover:bg-neutral-900"
                      title="Download replacement"
                      @click.stop="downloadTexture(currentReplacementUrl, `${lastSelectedTextureItem.name}_replacement`)"
                    >
                      <div class="i-solar:download-minimalistic-bold" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md bg-neutral-900/70 p-1 text-white transition-colors hover:bg-neutral-900"
                      title="Color eraser"
                      @click.stop="openEraser(currentReplacementUrl)"
                    >
                      <div class="i-solar:broom-bold-duotone" />
                    </button>
                  </div>
                </div>
                <button
                  v-if="currentReplacementUrl"
                  type="button"
                  class="w-full text-right text-[9px] text-primary-600 font-medium dark:text-primary-300"
                  @click="revertCurrentTexture"
                >
                  Revert texture
                </button>
              </div>
            </div>

            <!-- Replacement status (history is per texture; survives selection changes) -->
            <div v-if="currentReplacement" class="flex items-start gap-2 border border-neutral-200/80 rounded-xl bg-white/70 p-2 dark:border-neutral-800 dark:bg-neutral-900/40">
              <div :class="[currentReplacement.source === 'generated' ? 'i-solar:magic-stick-3-bold-duotone' : 'i-solar:document-add-bold-duotone', 'mt-0.5 shrink-0 text-sm text-primary-500']" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-[10px] text-neutral-700 font-medium dark:text-neutral-200" :title="currentReplacement.source === 'generated' ? 'Generated replacement' : (currentReplacement.fileName || 'Uploaded replacement')">
                  {{ currentReplacement.source === 'generated' ? 'Generated replacement' : (currentReplacement.fileName || 'Uploaded replacement') }}
                </div>
                <div
                  :class="[
                    'flex items-center gap-1 text-[9px]',
                    currentPreviewing ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400',
                  ]"
                >
                  <div :class="[currentPreviewing ? 'i-solar:check-circle-bold' : 'i-solar:eye-closed-bold']" />
                  {{ currentPreviewing ? 'Loaded in preview' : 'Saved · preview off' }}
                </div>
              </div>
            </div>

            <!-- Upload warnings -->
            <div v-if="uploadNotice" class="space-y-1">
              <div v-if="uploadNotice.dimension" class="flex items-start gap-1.5 text-[9px] text-amber-600 leading-relaxed dark:text-amber-300">
                <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0" />
                <span>{{ uploadNotice.dimension }}</span>
              </div>
              <div v-if="uploadNotice.transparency" class="flex items-start gap-1.5 text-[9px] text-amber-600 leading-relaxed dark:text-amber-300">
                <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0" />
                <span>{{ uploadNotice.transparency }}</span>
              </div>
              <div v-if="uploadNotice.format" class="flex items-start gap-1.5 text-[9px] text-neutral-400 leading-relaxed">
                <div class="i-solar:info-circle-bold mt-0.5 shrink-0" />
                <span>{{ uploadNotice.format }}</span>
              </div>
            </div>
          </template>

          <div v-else class="flex items-start gap-1.5 border border-neutral-200/80 rounded-xl bg-white/70 p-3 text-[10px] text-neutral-500 leading-relaxed dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
            <div class="i-solar:info-circle-bold mt-0.5 shrink-0" />
            <span>This material has no texture to replace, but you can still adjust its shaders below.</span>
          </div>

          <!-- Material adjustments -->
          <details class="group border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
            <summary class="flex cursor-pointer select-none items-center justify-between text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
              <span class="flex items-center gap-1.5">
                <div class="i-solar:tuning-2-bold-duotone text-sm text-primary-500" />
                Material adjustments
              </span>
              <div class="i-solar:alt-arrow-down-bold transition-transform group-open:rotate-180" />
            </summary>
            <div class="pt-3 space-y-3">
              <div class="space-y-1.5">
                <div class="flex justify-between px-1 text-[10px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                  <span>Rim Width</span>
                  <span class="text-primary-600 font-mono dark:text-primary-300">{{ (selectedMaterial.rimWidthFactor ?? selectedMaterial.uniforms?.rimWidth?.value ?? 0).toFixed(2) }}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  :value="selectedMaterial.rimWidthFactor ?? selectedMaterial.uniforms?.rimWidth?.value ?? 0"
                  class="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-primary-600 dark:bg-neutral-700"
                  @input="e => updateProp('rimWidth', parseFloat((e.target as HTMLInputElement).value))"
                >
              </div>
              <div class="space-y-1.5">
                <div class="flex justify-between px-1 text-[10px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                  <span>Shade Shift</span>
                  <span class="text-primary-600 font-mono dark:text-primary-300">{{ (selectedMaterial.shadingShiftFactor ?? selectedMaterial.uniforms?.shadingShift?.value ?? 0).toFixed(2) }}</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  :value="selectedMaterial.shadingShiftFactor ?? selectedMaterial.uniforms?.shadingShift?.value ?? 0"
                  class="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-primary-600 dark:bg-neutral-700"
                  @input="e => updateProp('shadeShift', parseFloat((e.target as HTMLInputElement).value))"
                >
              </div>

              <div class="flex items-center justify-between border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
                <div class="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                  <div class="i-solar:ghost-bold-duotone text-primary-500" />
                  Additive Blending
                </div>
                <button
                  type="button"
                  :class="[
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    selectedMaterial.blending === 2 ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
                  ]"
                  @click="toggleAdditiveBlending"
                >
                  <span
                    aria-hidden="true"
                    :class="[
                      'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                      selectedMaterial.blending === 2 ? 'translate-x-4' : 'translate-x-0.5',
                    ]"
                  />
                </button>
              </div>
              <p v-if="selectedMaterial.blending === 2" class="px-1 text-[9px] text-primary-600 font-bold uppercase italic opacity-70 dark:text-primary-300">
                Patch: Ignoring black data to restore eye transparency
              </p>
            </div>
          </details>

          <template v-if="lastSelectedTextureItem">
            <!-- Shared texture warning -->
            <div v-if="selectedTextureMaterialCount > 1" class="flex items-start gap-1.5 text-[10px] text-amber-600 leading-relaxed dark:text-amber-300">
              <div class="i-solar:info-circle-bold mt-0.5 shrink-0" />
              <span>Shared texture · Changes affect all {{ selectedTextureMaterialCount }} materials.</span>
            </div>

            <!-- Shared generation status (stays visible in Local editing) -->
            <div v-if="isGenerating" class="flex items-start gap-2 border border-primary-500/20 rounded-xl bg-primary-500/5 p-2">
              <div class="i-solar:spinner-bold mt-0.5 shrink-0 animate-spin text-primary-500" />
              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center justify-between gap-2 text-[9px] text-neutral-500 dark:text-neutral-400">
                  <span class="truncate">Generating {{ generationTargetName || 'texture' }}…</span>
                  <span class="shrink-0 font-mono">{{ vhackStore.generationProgress }}%</span>
                </div>
                <div class="text-[8px] text-neutral-400">
                  {{ vhackStore.generationActionLabel || 'Working…' }}
                </div>
                <div class="h-1 w-full overflow-hidden rounded-full bg-primary-500/20">
                  <div class="h-full rounded-full bg-primary-500 transition-all" :style="{ width: `${vhackStore.generationProgress}%` }" />
                </div>
              </div>
            </div>
            <div v-if="aiError" class="text-[10px] text-rose-600 leading-relaxed dark:text-rose-300">
              {{ aiError }}
            </div>

            <!-- Non-Main upload guidance -->
            <div
              v-if="lastSelectedTextureItem.type !== 'Main'"
              class="rounded-lg bg-amber-500/10 p-2 text-[9px] text-amber-700 leading-relaxed dark:text-amber-300"
            >
              This is a {{ lastSelectedTextureItem.type }} map. Upload a matching {{ lastSelectedTextureItem.type.toLowerCase() }} texture here; a color atlas belongs on a Main texture.
            </div>

            <!-- Mode switch, directly above the form it controls -->
            <div class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 text-[10px] font-semibold dark:bg-neutral-800">
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-1.5 border border-transparent rounded-lg py-2 transition-colors',
                  labMode === 'local'
                    ? 'border border-primary-500/30 bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                :aria-pressed="labMode === 'local'"
                @click="labMode = 'local'"
              >
                <div class="i-solar:upload-minimalistic-bold" />
                Local editing
              </button>
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-1.5 border border-transparent rounded-lg py-2 transition-colors',
                  labMode === 'prompt'
                    ? 'border border-primary-500/30 bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200'
                    : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200',
                ]"
                :aria-pressed="labMode === 'prompt'"
                @click="labMode = 'prompt'"
              >
                <div class="i-solar:magic-stick-3-bold-duotone" />
                Promptcraft
              </button>
            </div>

            <!-- Local editing -->
            <div v-if="labMode === 'local'" class="space-y-3">
              <div class="space-y-1">
                <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                  Edit in your own image editor
                </div>
                <p class="text-[10px] text-neutral-500 leading-relaxed dark:text-neutral-400">
                  Download the texture, make your changes, then upload the edited file.
                </p>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <Button variant="secondary" class="w-full" :disabled="!lastSelectedTextureItem?.url" @click="downloadOriginalTexture">
                  <template #icon>
                    <div class="i-solar:download-minimalistic-bold" />
                  </template>
                  Download texture
                </Button>
                <Button variant="primary" class="w-full" :class="ACCENT_ACTION_CLASS" @click="triggerManualUpload">
                  <template #icon>
                    <div class="i-solar:upload-minimalistic-bold" />
                  </template>
                  Upload PNG
                </Button>
              </div>

              <button
                type="button"
                class="w-full border rounded-xl border-dashed p-3 text-left transition-colors"
                :class="isDragOver ? 'border-primary-500 bg-primary-500/5' : 'border-neutral-300 hover:border-primary-400 dark:border-neutral-700'"
                title="Drop a PNG, JPEG, or WebP here, or click to choose a file"
                @click="triggerManualUpload"
                @dragover.prevent="isDragOver = true"
                @dragleave.prevent="isDragOver = false"
                @drop.prevent="handleUploadDrop"
              >
                <div class="flex items-center justify-center gap-2">
                  <div class="i-solar:document-add-bold-duotone text-2xl text-primary-500" />
                  <div class="space-y-0.5">
                    <div class="text-[10px] text-neutral-700 font-medium dark:text-neutral-200">
                      Drop your edited texture here
                    </div>
                    <div class="text-[8px] text-neutral-400">
                      PNG recommended · JPEG/WebP accepted
                    </div>
                    <div class="text-[8px] text-neutral-400">
                      Keep the original dimensions and transparent areas.
                    </div>
                  </div>
                </div>
              </button>

              <p v-if="uploadError" class="text-[9px] text-rose-600 leading-relaxed dark:text-rose-300">
                {{ uploadError }}
              </p>
              <input ref="textureUploader" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="handleManualUpload">
            </div>

            <!-- Promptcraft -->
            <div v-else class="space-y-3">
              <!-- Style presets -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Style presets</span>
                  <select
                    v-model="selectedCategory"
                    class="max-w-[170px] border border-neutral-200 rounded-lg bg-white px-2 py-1 text-[10px] text-neutral-700 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
                  >
                    <option :value="null">
                      Preset Palette
                    </option>
                    <option v-for="group in ARTISTRY_PRESET_GROUPS" :key="group.id" :value="group.id">
                      {{ group.label }}
                    </option>
                  </select>
                </div>
                <div v-if="activePresets.length" class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="preset in visiblePresets"
                    :key="preset.id"
                    type="button"
                    class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-white/70 px-2 py-1.5 text-left text-[10px] text-neutral-600 font-medium transition-colors dark:border-neutral-700 hover:border-primary-400 dark:bg-neutral-900/40 hover:bg-primary-500/5 dark:text-neutral-300"
                    @click="injectPreset(preset.text)"
                  >
                    <div :class="[preset.icon, 'shrink-0 text-sm text-primary-500']" />
                    <span class="truncate">{{ preset.label }}</span>
                  </button>
                </div>
                <button
                  v-if="activePresets.length > 4"
                  type="button"
                  class="w-full text-right text-[10px] text-primary-600 font-medium dark:text-primary-300"
                  @click="showAllPresets = !showAllPresets"
                >
                  {{ showAllPresets ? 'Fewer presets...' : 'More presets...' }}
                </button>
              </div>

              <!-- Prompt -->
              <div class="space-y-1">
                <label class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Describe the replacement</label>
                <textarea
                  v-model="aiPrompt"
                  maxlength="500"
                  rows="4"
                  placeholder="Midnight navy fabric with delicate gold celestial embroidery. Keep the existing UV layout, seams, and transparent areas."
                  class="w-full resize-none border border-neutral-200 rounded-xl bg-white px-3 py-2 text-[11px] text-neutral-800 leading-relaxed outline-none dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-900 dark:text-neutral-100"
                />
                <div class="flex items-center justify-between text-[9px] text-neutral-400">
                  <span>Presets fill the prompt—you can edit it.</span>
                  <span>{{ aiPrompt.length }}/500</span>
                </div>
                <p class="text-[8px] text-neutral-400">
                  UV layout, seams, and transparency guidance is added at generation time.
                </p>
              </div>

              <!-- Provider -->
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span class="flex items-center gap-1">
                  <div class="i-solar:settings-bold-duotone" />
                  Uses your configured image provider
                </span>
                <button
                  type="button"
                  class="rounded p-0.5 text-neutral-400 transition-colors hover:text-primary-600 dark:hover:text-primary-300"
                  title="Configure image provider"
                  @click="vhackStore.showAiSettings = !vhackStore.showAiSettings"
                >
                  <div class="i-solar:settings-bold-duotone text-sm" />
                </button>
              </div>

              <!-- AI Settings -->
              <div v-if="vhackStore.showAiSettings" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-3 space-y-4">
                <div class="space-y-2">
                  <div class="px-1 text-[8px] text-primary-600 font-black tracking-widest uppercase dark:text-primary-300">
                    Network Provider
                  </div>
                  <div class="grid grid-cols-3 gap-1">
                    <button
                      v-for="provider in availableProviders"
                      :key="provider.id"
                      type="button"
                      :class="[
                        artistryStore.activeProvider === provider.id
                          ? 'bg-primary-600 text-white border-primary-500'
                          : 'bg-neutral-100 text-neutral-500 border-neutral-200 hover:bg-neutral-200 dark:bg-white/5 dark:text-neutral-400 dark:border-white/5 dark:hover:bg-white/10',
                        'flex flex-col items-center gap-1 border rounded-lg p-2 text-[8px] font-bold uppercase transition-colors',
                      ]"
                      @click="artistryStore.activeProvider = provider.id as any"
                    >
                      <div :class="[provider.icon, 'text-sm']" />{{ provider.name }}
                    </button>
                  </div>
                </div>

                <div v-if="artistryStore.activeProvider === 'nanobanana'" class="animate-in fade-in slide-in-from-top-1 space-y-3">
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      Model Name
                    </div>
                    <select v-model="artistryStore.nanobananaModel" class="w-full border border-neutral-200 rounded-md bg-white p-1 text-[8px] text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                      <option value="gemini-3.1-flash-image-preview">
                        Nano Banana 2 (Gemini 3.1 Flash Image)
                      </option>
                      <option value="gemini-3-pro-image-preview">
                        Nano Banana Pro (Gemini 3 Pro Image)
                      </option>
                      <option value="gemini-2.5-flash-image">
                        Nano Banana (Gemini 2.5 Flash Image)
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      Default Resolution
                    </div>
                    <select v-model="artistryStore.nanobananaResolution" class="w-full border border-neutral-200 rounded-md bg-white p-1 text-[8px] text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                      <option value="1K">
                        1,024 x 1,024
                      </option>
                      <option value="2K">
                        2,048 x 2,048
                      </option>
                      <option value="4K">
                        4,096 x 4,096
                      </option>
                    </select>
                  </div>
                </div>

                <div v-else-if="artistryStore.activeProvider === 'replicate'" class="animate-in fade-in slide-in-from-top-1 space-y-3">
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      Model Template
                    </div>
                    <select v-model="selectedReplicatePreset" class="w-full border border-neutral-200 rounded-md bg-white p-1 text-[8px] text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                      <option value="">
                        Manual Config
                      </option>
                      <option v-for="preset in REPLICATE_IMAGEEDIT_PRESETS" :key="preset.id" :value="preset.id">
                        {{ preset.label }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      Model ID
                    </div>
                    <input v-model="aiReplicateModelId" placeholder="owner/model-name..." class="w-full border border-neutral-200 rounded-md bg-white p-2 text-[10px] text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-900 dark:text-neutral-100">
                  </div>
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      JSON Parameters
                    </div>
                    <textarea v-model="aiReplicateParams" class="h-16 w-full resize-none border border-neutral-200 rounded-md bg-white p-2 text-[8px] text-neutral-800 font-mono outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
                    <div v-pre class="mt-0.5 text-[7px] text-primary-600/60 font-bold uppercase italic">
                      Hint: Use {{ IMAGE }} and {{ PROMPT }} placeholders
                    </div>
                  </div>
                </div>

                <div v-else-if="artistryStore.activeProvider === 'comfyui'" class="animate-in fade-in slide-in-from-top-1 space-y-3">
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      Active Workflow
                    </div>
                    <select v-model="artistryStore.comfyuiActiveWorkflow" class="w-full border border-neutral-200 rounded-md bg-white p-1 text-[8px] text-neutral-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                      <option value="">
                        Default Bridge
                      </option>
                      <option v-for="workflow in artistryStore.comfyuiSavedWorkflows" :key="workflow.id" :value="workflow.id">
                        {{ workflow.name }}
                      </option>
                    </select>
                  </div>
                  <div class="space-y-1">
                    <div class="text-[8px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                      JSON Parameters
                    </div>
                    <textarea v-model="aiComfyParams" class="h-16 w-full resize-none border border-neutral-200 rounded-md bg-white p-2 text-[8px] text-neutral-800 font-mono outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
                    <div v-pre class="mt-0.5 text-[7px] text-primary-600/60 font-bold uppercase italic">
                      Hint: Use {{ IMAGE }} and {{ PROMPT }} placeholders
                    </div>
                  </div>
                </div>
              </div>

              <Button variant="primary" class="w-full" :class="ACCENT_ACTION_CLASS" :disabled="!aiPrompt || isGenerating" @click="generateAndSwap">
                <template #icon>
                  <div :class="[isGenerating ? 'i-solar:spinner-bold animate-spin' : 'i-solar:magic-stick-3-bold-duotone']" />
                </template>
                {{ isGenerating ? (vhackStore.generationActionLabel || 'Generating...') : 'Generate replacement' }}
              </Button>
              <div v-if="isGenerating" class="flex items-center justify-between text-[9px] text-neutral-400">
                <span class="truncate">{{ vhackStore.generationActionLabel || 'Working…' }}</span>
                <span class="shrink-0 font-mono">{{ vhackStore.generationProgress }}%</span>
              </div>
            </div>
          </template>
        </template>

        <div v-else class="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <div class="i-solar:gallery-bold-duotone text-2xl text-neutral-400" />
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Select a texture in the Textures tab to open it in the Lab.
          </p>
          <button type="button" class="text-[10px] text-primary-600 font-medium dark:text-primary-300" @click="activeTab = 'texture'">
            Go to Textures
          </button>
        </div>
      </div>

      <!-- Parts -->
      <div v-else-if="activeTab === 'tree'" class="flex flex-col gap-2 p-1">
        <div class="flex items-center gap-2">
          <div class="relative min-w-0 flex-1">
            <div class="i-solar:magnifer-linear absolute left-3 top-1/2 shrink-0 translate-y-[-50%] text-neutral-400" />
            <input
              v-model="nodeFilter"
              placeholder="Find a part..."
              class="w-full border border-neutral-200 rounded-xl bg-white py-2 pl-9 pr-3 text-xs text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-900 dark:text-neutral-100"
            >
          </div>
          <button
            type="button"
            class="shrink-0 px-1 text-xs text-primary-600 font-medium transition-colors dark:text-primary-300 hover:text-primary-700 disabled:op-50"
            :disabled="!activeVrm"
            @click="showAllNodes()"
          >
            Show all
          </button>
          <button
            type="button"
            class="shrink-0 px-1 text-xs text-primary-600 font-medium transition-colors dark:text-primary-300 hover:text-primary-700 disabled:op-50"
            :disabled="!activeVrm"
            @click="hideAllNodes()"
          >
            Hide all
          </button>
        </div>

        <div class="space-y-1">
          <div
            v-for="node in nodes"
            :key="node.uuid"
            class="group flex cursor-pointer items-center justify-between border border-transparent rounded-lg p-2 text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-white/5"
            :class="{ 'border-primary-400/40 bg-primary-500/5': vhackStore.selectedNodeName === node.name }"
            @click="selectNode(node)"
          >
            <div class="flex items-center gap-2 truncate">
              <div :class="[node.type === 'Mesh' ? 'i-solar:box-bold-duotone text-sky-500' : 'i-solar:user-bold-duotone text-purple-500']" />
              <div class="flex flex-col truncate">
                <span :class="[vhackStore.selectedNodeName === node.name ? 'text-primary-600 font-semibold dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-300']">{{ node.name }}</span>
                <span class="text-[11px] text-neutral-400 font-medium italic dark:text-neutral-500">({{ node.matName }})</span>
              </div>
            </div>
            <button type="button" class="rounded p-1 transition-colors hover:bg-neutral-200 dark:hover:bg-white/10" @click.stop="e => toggleVisibility(node, e)">
              <div :class="[!vhackStore.hiddenNodeUuids.has(node.uuid) ? 'i-solar:eye-bold-duotone text-primary-500' : 'i-solar:eye-closed-bold-duotone text-neutral-400']" />
            </button>
          </div>

          <div v-if="nodes.length === 0" class="px-2 py-6 text-center text-xs text-neutral-400">
            No visible parts found.
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex flex-col gap-2 border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
      <div class="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" class="w-full" :disabled="!activeVrm" @click="revert">
          <template #icon>
            <div class="i-solar:refresh-bold" />
          </template>
          Reset changes
        </Button>
        <Button variant="primary" size="sm" class="w-full" :class="ACCENT_ACTION_CLASS" :disabled="!activeVrm || isExporting" @click="exportVrm">
          <template #icon>
            <div :class="[isExporting ? 'i-solar:spinner-bold animate-spin' : 'i-solar:download-minimalistic-bold']" />
          </template>
          {{ isExporting ? 'Packaging...' : 'Export modified VRM' }}
        </Button>
      </div>
      <p v-if="activeTab !== 'material'" class="px-0.5 text-[9px] text-neutral-400">
        Edits stay in this copy until exported.
      </p>
    </div>

    <!-- FOOTER / MODALS -->
    <div v-if="isEraserOpen" class="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-10 transition-all">
      <div class="relative max-h-full max-w-2xl w-full border border-white/10 rounded-3xl bg-neutral-900/50 p-6 shadow-2xl backdrop-blur-3xl space-y-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div i-solar:broom-bold-duotone class="text-2xl text-emerald-400" />
            <div>
              <div class="text-sm text-white font-black tracking-widest uppercase">
                Surgical Eraser
              </div>
              <div class="text-[10px] text-neutral-500 font-bold uppercase">
                Click a color on the texture to purge it
              </div>
            </div>
          </div>
          <button class="text-neutral-500 transition hover:text-white" @click="isEraserOpen = false">
            <div i-solar:close-circle-bold-duotone class="text-2xl" />
          </button>
        </div>

        <div class="relative aspect-square overflow-hidden border border-white/10 rounded-2xl bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACpJREFUGFdjZEACDAwM/wwMDA0MDAz/GDAESDAwMPxjAIkAAwMDAwMDAwMBEgQE+8l9hAAAAABJRU5ErkJggg==')] bg-repeat shadow-inner">
          <canvas ref="eraserCanvas" class="h-full w-full cursor-crosshair object-contain" @click="handleEraserClick" />

          <div v-if="eraserPickedColor" class="animate-in slide-in-from-bottom-2 absolute bottom-4 left-4 flex items-center gap-3 border border-white/10 rounded-full bg-black/80 p-1.5 pr-4 shadow-xl">
            <div class="h-6 w-6 border border-white/20 rounded-full shadow-inner" :style="{ backgroundColor: `rgb(${eraserPickedColor[0]}, ${eraserPickedColor[1]}, ${eraserPickedColor[2]})` }" />
            <div class="flex flex-col">
              <span class="text-[9px] text-white font-black uppercase">Picked Color</span>
              <span class="text-[8px] text-neutral-500 font-bold font-mono uppercase">#{{ eraserPickedColor.map(c => c.toString(16).padStart(2, '0')).join('') }}</span>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between px-1 text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
            <span>Selection Tolerance</span>
            <span class="text-emerald-400 font-mono">{{ eraserTolerance }}</span>
          </div>
          <input v-model="eraserTolerance" type="range" min="1" max="100" step="1" class="range-emerald h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/5 accent-emerald-500" @input="applyEraserPurge">
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <Button variant="secondary" class="border-white/5 bg-white/5 font-black tracking-widest uppercase" @click="isEraserOpen = false">
            Abort
          </Button>
          <Button variant="primary" class="bg-emerald-500 text-black font-black tracking-widest uppercase shadow-emerald-500/20 shadow-lg hover:bg-emerald-400" @click="finalizeEraserBake">
            Apply & Bake to Store
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-owner-details > summary { list-style: none; }
.material-owner-details > summary::-webkit-details-marker { display: none; }
.material-owner-details[open] .materials-chevron { transform: rotate(180deg); }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.16); border-radius: 10px; }
:global(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #0891b2; cursor: pointer; }

/* Alpha checkerboard for texture thumbnails, theme-aware. */
.texture-checker {
  background-color: #f5f5f5;
  background-image:
    linear-gradient(45deg, #e2e2e2 25%, transparent 25%),
    linear-gradient(-45deg, #e2e2e2 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e2e2 75%),
    linear-gradient(-45deg, transparent 75%, #e2e2e2 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}
:global(.dark) .texture-checker {
  background-color: #171717;
  background-image:
    linear-gradient(45deg, #262626 25%, transparent 25%),
    linear-gradient(-45deg, #262626 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #262626 75%),
    linear-gradient(-45deg, transparent 75%, #262626 75%);
}
</style>
