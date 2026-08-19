<script setup lang="ts">
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { ARTISTRY_PRESET_GROUPS, artistryGenerateHeadless, REPLICATE_IMAGEEDIT_PRESETS } from '@proj-airi/stage-shared'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

// @ts-ignore
import * as THREE from 'three'

import { useArtistryStore } from '../../../../../stores/modules/artistry'
import { useSettings } from '../../../../../stores/settings'
import { useVHackStore } from '../../../../../stores/vhack'

const settingsStore = useSettings()

const vhackStore = useVHackStore()
const modelStore = useModelStore()
const artistryStore = useArtistryStore()
const { activeVrm, activeVrmParser } = storeToRefs(modelStore)

const generateInvoke = useElectronEventaInvoke(artistryGenerateHeadless)

const activeTab = ref<'tree' | 'material' | 'texture'>('tree')
const scrollContainer = ref<HTMLElement | null>(null)

// Selected State
const selectedMesh = ref<any>(null)
const selectedMaterial = ref<any>(null)
const lastSelectedTextureItem = ref<any>(null)

// AI Comparison State
const sourceTextureUrl = ref<string | null>(null)
const lastGeneratedUrl = ref<string | null>(null)

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
const showPresets = ref(false)
const selectedCategory = ref<string | null>(null)
const nodeFilter = ref('')
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

const availableProviders = [
  { id: 'nanobanana', name: 'Nano Banana', icon: 'i-solar:gallery-round-bold-duotone' },
  { id: 'replicate', name: 'Replicate', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'comfyui', name: 'ComfyUI', icon: 'i-solar:settings-bold-duotone' },
]

// Preset Palette moved to shared artistry.ts

function injectPreset(text: string) {
  aiPrompt.value = text
  showPresets.value = false
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

function toggleVisibility(item: any, event?: MouseEvent) {
  if (event?.ctrlKey) {
    vhackStore.focusNode(item.uuid, nodes.value)
  }
  else {
    vhackStore.toggleNodeVisibility(item.uuid, item.node)
  }
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
    sourceTextureUrl.value = getTextureUrl(mat.map)
    lastGeneratedUrl.value = null
  }
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

// Texture Trace Context (Precomputed State for Global Sync)
const currentTextureNodes = computed(() => {
  const tex = selectedMaterial.value?.map
  if (!tex || !activeVrm.value)
    return []

  // The ultimate source of truth for GLB/VRM: The GLTF Source Image Index
  const targetIdx = getGltfImageIndex(tex)
  const targetFingerprint = tex.image?.uuid || tex.image?.src || tex.uuid

  const result: any[] = []
  activeVrm.value.scene.traverse((node: any) => {
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material]
      mats.forEach((m: any) => {
        // Check ALL texture slots for a shared GLTF source or image identity
        const slots = [m.map, m.shadeMultiplyTexture, m.rimMultiplyTexture, m.sphereAddTexture]
        const hasMatch = slots.some((s) => {
          if (!s)
            return false
          const sIdx = getGltfImageIndex(s)
          if (targetIdx !== null && sIdx !== null)
            return sIdx === targetIdx
          return s.image?.uuid === targetFingerprint || s.image?.src === targetFingerprint || s.uuid === targetFingerprint
        })

        if (hasMatch) {
          result.push({
            name: node.name || 'Unnamed Mesh',
            uuid: node.uuid,
          })
        }
      })
    }
  })
  // Deduplicate node results by UUID
  return Array.from(new Map(result.map(r => [r.uuid, r])).values())
})

// Texture Deck Logic
const textureList = ref<{ id: number, name: string, type: string, url: string, texture: any }[]>([])

function extractTextures() {
  if (!activeVrm.value)
    return
  const found = new Map<number | string, { tex: any, type: string, nodeName: string }>()

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
          if (!found.has(key)) {
            found.set(key, { tex: slot.tex, type: slot.type, nodeName: node.name })
          }
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
    }
  })
}

function findAssociatedNodes(texture: any) {
  if (!activeVrm.value)
    return []
  const result: any[] = []
  activeVrm.value.scene.traverse((node: any) => {
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material]
      const usesTexture = mats.some((m: any) => m.map === texture || m.shadeMultiplyTexture === texture || m.rimMultiplyTexture === texture || m.sphereAddTexture === texture)
      if (usesTexture)
        result.push({ name: node.name || 'Unnamed Mesh', node, uuid: node.uuid })
    }
  })
  return result
}

const associatedNodesForTexture = computed(() => {
  if (!lastSelectedTextureItem.value)
    return []
  return findAssociatedNodes(lastSelectedTextureItem.value.texture)
})

function selectTexture(item: any) {
  lastSelectedTextureItem.value = item
  if (!aiPrompt.value)
    aiPrompt.value = `Stylize the ${item.name} texture...`
  nextTick(() => {
    if (scrollContainer.value)
      scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  })
  const associated = findAssociatedNodes(item.texture)
  if (associated.length === 1)
    jumpToNode(associated[0])
}

function jumpToNode(nodeItem: any) { selectNode(nodeItem); activeTab.value = 'material' }

// Unified Artistry Generation
async function generateAndSwap() {
  if (!selectedMaterial.value || !aiPrompt.value)
    return

  vhackStore.isGeneratingTexture = true
  vhackStore.generationProgress = 10
  vhackStore.generationActionLabel = 'Preparing Canvas'
  vhackStore.lastGenerationError = null
  isGenerating.value = true
  aiError.value = null

  try {
    const map = selectedMaterial.value.map
    if (!map)
      throw new Error('No texture found on material')

    // 1. Prepare base64 from current texture
    const canvas = document.createElement('canvas')
    const img = map.image
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx)
      throw new Error('Failed to create canvas context')
    ctx.drawImage(img, 0, 0)
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
      prompt: aiPrompt.value,
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
      vhackStore.generationProgress = 90
      vhackStore.generationActionLabel = 'Applying Result'

      const newUrl = result.base64.startsWith('data:') ? result.base64 : `data:image/png;base64,${result.base64}`

      // Capture reference to target before swap
      const targetTex = selectedMaterial.value?.map

      lastGeneratedUrl.value = newUrl
      swapTextureByRef(newUrl, targetTex)

      // Register mutation for surgical persistence
      const imgIndex = getGltfImageIndex(targetTex)
      if (imgIndex !== null) {
        vhackStore.registerMutation(imgIndex, result.base64, 'image/png')
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
    setTimeout(() => {
      vhackStore.generationProgress = 0
      vhackStore.generationActionLabel = null
    }, 2000)
  }
}

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selectedMaterial.value)
    return
  const targetTex = selectedMaterial.value?.map
  const reader = new FileReader()
  reader.onload = (e) => {
    const url = e.target?.result as string
    swapTextureByRef(url, targetTex)
    lastGeneratedUrl.value = url
  }
  reader.readAsDataURL(file)
}

function triggerManualUpload() {
  textureUploader.value?.click()
}

async function handleManualUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !selectedMaterial.value)
    return

  const targetTex = selectedMaterial.value?.map
  const reader = new FileReader()
  reader.onload = (e) => {
    const url = e.target?.result as string
    const base64 = url.split(',')[1]

    // 1. Swap in viewport (Global search)
    swapTextureByRef(url, targetTex)
    lastGeneratedUrl.value = url

    // 2. Register mutation for surgical persistence (Export parity)
    const imgIndex = getGltfImageIndex(targetTex)
    if (imgIndex !== null) {
      vhackStore.registerMutation(imgIndex, base64, 'image/png')
    }
  }
  reader.readAsDataURL(file)
}

function swapTextureByRef(url: string, targetRef?: any) {
  console.info('>>> [VHACK] Starting swap sequence (NUCLEAR)...', { url: `${url.substring(0, 40)}...`, targetRef })
  const target = targetRef || selectedMaterial.value?.map
  if (!target || !activeVrm.value)
    return

  const targetIdx = getGltfImageIndex(target)
  const targetFingerprint = target.image?.uuid || target.image?.src || target.uuid

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

              currentSlotTex.image = tex.image
              currentSlotTex.colorSpace = tex.colorSpace
              currentSlotTex.needsUpdate = true
              updated = true

              // PERSISTENCE BAKE: Register this mutation in the store so it survives export
              if (sIdx !== null) {
                // Determine mime type from URL or default to png
                const mimeType = url.startsWith('data:image/webp') ? 'image/webp' : 'image/png'
                // Convert current canvas/image back to base64 if it was modified by the alpha patch
                const finalDataUrl = (tex.image instanceof HTMLCanvasElement) ? tex.image.toDataURL(mimeType) : url
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
  swapTextureByRef(cleanedUrl)
  isEraserOpen.value = false
  lastGeneratedUrl.value = cleanedUrl // Update result preview
}

// Binary Export Logic
// Binary Export Logic (Surgical)
async function exportVrm() {
  if (!activeVrm.value)
    return

  if (!vhackStore.sourceArrayBuffer) {
    if (settingsStore.stageModelSelectedFile) {
      vhackStore.setSourceArrayBuffer(await settingsStore.stageModelSelectedFile.arrayBuffer())
    }
    else if (settingsStore.stageModelSelectedUrl) {
      try {
        const res = await fetch(settingsStore.stageModelSelectedUrl)
        vhackStore.setSourceArrayBuffer(await res.arrayBuffer())
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
        // Update JSON with new length
        bv.byteLength = bytes.length
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
    link.download = `V-HACK_${activeVrm.value?.meta?.name || 'Surgical'}.vrm`
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

function downloadTexture(url: string | null, name: string) {
  if (!url)
    return
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}.png`
  link.click()
}

function revert() {
  if (!activeVrm.value)
    return
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
  extractTextures()
  lastGeneratedUrl.value = null
  if (selectedMaterial.value)
    sourceTextureUrl.value = getTextureUrl(selectedMaterial.value.map)
}

watch(activeVrm, () => { if (activeVrm.value) { extractTextures(); takeGlobalSnapshot() } }, { immediate: true })
onMounted(() => {
  if (activeVrm.value)
    takeGlobalSnapshot()
})
</script>

<template>
  <div v-if="vhackStore.isHackerModeActive" class="animate-in fade-in slide-in-from-right-4 fixed bottom-4 right-4 top-24 z-50 w-80 flex flex-col overflow-hidden border border-white/10 rounded-2xl bg-black/95 shadow-2xl backdrop-blur-3xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/10 from-emerald-500/20 to-transparent bg-gradient-to-r p-4 text-[14px]">
      <div class="flex items-center gap-2 text-white font-black tracking-tighter uppercase">
        <div i-solar:mask-h-bold-duotone class="text-xl text-emerald-400" />V-HACK Inspector
      </div>
      <button class="text-neutral-400 transition hover:text-white" @click="vhackStore.closeHackerMode">
        <div i-solar:close-circle-bold-duotone />
      </button>
    </div>

    <!-- Tabs -->
    <div class="mx-4 mt-4 flex gap-1 rounded-lg bg-white/5 p-1 text-[10px] font-bold tracking-widest uppercase">
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'tree' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'tree'">
        Nodes
      </button>
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'material' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'material'">
        Lab
      </button>
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'texture' ? 'bg-emerald-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'texture'">
        Deck
      </button>
    </div>

    <!-- Content -->
    <div ref="scrollContainer" class="custom-scrollbar flex-1 overflow-y-auto p-4">
      <!-- Tree View (no changes) -->
      <div v-if="activeTab === 'tree'" class="space-y-1">
        <div v-for="node in nodes" :key="node.uuid" class="group flex cursor-pointer items-center justify-between border border-transparent rounded-lg p-2 text-xs transition hover:border-white/5 hover:bg-white/5" :class="{ 'bg-emerald-500/10 border-emerald-500/30': vhackStore.selectedNodeName === node.name }" @click="selectNode(node)">
          <div class="flex items-center gap-2 truncate">
            <div :class="[node.type === 'Mesh' ? 'i-solar:box-bold-duotone text-blue-400' : 'i-solar:user-bold-duotone text-purple-400']" />
            <div class="flex flex-col truncate">
              <span :class="[vhackStore.selectedNodeName === node.name ? 'text-emerald-400 font-bold' : 'text-neutral-300']">{{ node.name }}</span>
              <span class="text-xs text-neutral-500 font-medium italic opacity-60">({{ node.matName }})</span>
            </div>
          </div>
          <button class="rounded p-1 transition hover:bg-white/10" @click.stop="e => toggleVisibility(node, e)">
            <div :class="[!vhackStore.hiddenNodeUuids.has(node.uuid) ? 'i-solar:eye-bold-duotone text-emerald-400' : 'i-solar:eye-closed-bold-duotone text-red-500']" />
          </button>
        </div>
      </div>

      <!-- Material Lab -->
      <div v-else-if="activeTab === 'material'" class="pb-20 space-y-6">
        <div v-if="selectedMaterial" class="space-y-4">
          <!-- TEXTURE FORGE (Top Priority) -->
          <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <div i-solar:magic-stick-bold-duotone class="text-sm text-emerald-400" />
                <div class="text-[10px] text-white font-black tracking-widest uppercase">
                  ◈ Texture Forge [Hardened v35.6]
                </div>
              </div>
              <button class="text-neutral-500 transition hover:text-emerald-400" @click="vhackStore.showAiSettings = !vhackStore.showAiSettings">
                <div i-solar:settings-bold-duotone />
              </button>
            </div>

            <!-- Texture Context Header (Global Proof) -->
            <div v-if="selectedMaterial?.map" class="mx-1 flex items-center justify-between border border-white/5 rounded-xl bg-white/5 p-3">
              <div class="flex flex-col">
                <div class="text-[7px] text-neutral-500 font-bold uppercase">
                  Active Texture
                </div>
                <div class="text-[10px] text-emerald-400 font-bold leading-tight font-mono uppercase">
                  {{ selectedMaterial.map.name?.replace(/\.[^/.]+$/, "") || 'Unnamed' }}
                </div>
              </div>
              <div class="flex flex-col items-end">
                <div class="text-[7px] text-neutral-500 font-bold uppercase">
                  Shared By
                </div>
                <div class="flex flex-wrap justify-end gap-1">
                  <span v-for="node in currentTextureNodes" :key="node.uuid" class="border border-emerald-500/10 rounded-full bg-emerald-500/5 px-1.5 py-0.5 text-[6px] text-emerald-300 font-bold font-mono uppercase">
                    {{ node.name }}
                  </span>
                </div>
              </div>
            </div>

            <!-- AI Settings -->
            <div v-if="vhackStore.showAiSettings" class="animate-in fade-in slide-in-from-top-2 border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-3 space-y-4">
              <!-- Provider Selector -->
              <div class="space-y-2">
                <div class="px-1 text-[8px] text-emerald-400 font-black tracking-widest uppercase">
                  Network Provider
                </div>
                <div class="grid grid-cols-3 gap-1">
                  <button v-for="p in availableProviders" :key="p.id" :class="[artistryStore.activeProvider === p.id ? 'bg-emerald-500 text-black border-emerald-400' : 'bg-white/5 text-neutral-400 border-white/5 hover:bg-white/10']" class="flex flex-col items-center gap-1 border rounded-lg p-2 text-[8px] font-bold uppercase transition" @click="artistryStore.activeProvider = p.id">
                    <div :class="p.icon" class="text-sm" />{{ p.name }}
                  </button>
                </div>
              </div>

              <!-- Provider Specific Fields -->
              <div v-if="artistryStore.activeProvider === 'nanobanana'" class="animate-in fade-in slide-in-from-top-1 space-y-3">
                <div class="space-y-1">
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    Model Name
                  </div>
                  <select v-model="artistryStore.nanobananaModel" class="w-full border border-white/10 rounded-md bg-black/40 p-1 text-[8px] text-white outline-none">
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
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    Default Resolution
                  </div>
                  <select v-model="artistryStore.nanobananaResolution" class="w-full border border-white/10 rounded-md bg-black/40 p-1 text-[8px] text-white outline-none">
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
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    Model Template
                  </div>
                  <select v-model="selectedReplicatePreset" class="w-full border border-white/10 rounded-md bg-black/40 p-1 text-[8px] text-white outline-none">
                    <option value="">
                      Manual Config
                    </option>
                    <option v-for="p in REPLICATE_IMAGEEDIT_PRESETS" :key="p.id" :value="p.id">
                      {{ p.label }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1">
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    Model ID
                  </div>
                  <input v-model="aiReplicateModelId" placeholder="owner/model-name..." class="w-full border border-white/10 rounded-md bg-black/40 p-2 text-[10px] text-white outline-none focus:border-emerald-500/50">
                </div>
                <div class="space-y-1">
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    JSON Parameters
                  </div>
                  <textarea v-model="aiReplicateParams" class="h-16 w-full resize-none border border-white/10 rounded-md bg-black/40 p-2 text-[8px] text-white font-mono outline-none" />
                  <div v-pre class="mt-0.5 text-[7px] text-emerald-400/60 font-bold uppercase italic">
                    Hint: Use {{ IMAGE }} and {{ PROMPT }} placeholders
                  </div>
                </div>
              </div>

              <div v-else-if="artistryStore.activeProvider === 'comfyui'" class="animate-in fade-in slide-in-from-top-1 space-y-3">
                <div class="space-y-1">
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    Active Workflow
                  </div>
                  <select v-model="artistryStore.comfyuiActiveWorkflow" class="w-full border border-white/10 rounded-md bg-black/40 p-1 text-[8px] text-white outline-none">
                    <option value="">
                      Default Bridge
                    </option>
                    <option v-for="w in artistryStore.comfyuiSavedWorkflows" :key="w.id" :value="w.id">
                      {{ w.name }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1">
                  <div class="text-[8px] text-neutral-400 font-bold uppercase">
                    JSON Parameters
                  </div>
                  <textarea v-model="aiComfyParams" class="h-16 w-full resize-none border border-white/10 rounded-md bg-black/40 p-2 text-[8px] text-white font-mono outline-none" />
                  <div v-pre class="mt-0.5 text-[7px] text-emerald-400/60 font-bold uppercase italic">
                    Hint: Use {{ IMAGE }} and {{ PROMPT }} placeholders
                  </div>
                </div>
              </div>
            </div>

            <!-- Before/After View -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <div class="px-1 text-[8px] text-neutral-500 font-bold uppercase">
                  Source
                </div>
                <div class="group relative aspect-square overflow-hidden border border-white/5 rounded-lg bg-white/5">
                  <img v-if="sourceTextureUrl" :src="sourceTextureUrl" class="h-full w-full object-cover opacity-60 transition group-hover:opacity-100">
                  <button
                    v-if="sourceTextureUrl"
                    class="absolute right-1 top-1 z-10 border border-white/10 rounded bg-black/60 p-1 text-white opacity-0 transition hover:bg-emerald-500 group-hover:opacity-100"
                    title="Download Source Texture"
                    @click.stop="downloadTexture(sourceTextureUrl, `${selectedMaterial.name}_source`)"
                  >
                    <div i-solar:download-square-bold-duotone class="text-xs" />
                  </button>
                  <div class="absolute inset-0 from-black/60 to-transparent bg-gradient-to-t" />
                  <div class="absolute bottom-1 left-1 truncate text-[7px] text-neutral-400 font-bold uppercase">
                    {{ selectedMaterial.name }}
                  </div>
                </div>
              </div>
              <div class="space-y-1">
                <div class="px-1 text-[8px] text-emerald-500 font-bold uppercase">
                  {{ lastGeneratedUrl ? 'Result' : 'Idle' }}
                </div>
                <div class="group/result relative aspect-square flex items-center justify-center overflow-hidden border border-emerald-500/20 rounded-lg border-dashed bg-emerald-500/5">
                  <img v-if="lastGeneratedUrl" :src="lastGeneratedUrl" class="animate-in fade-in zoom-in-95 h-full w-full object-cover">
                  <div v-if="lastGeneratedUrl" class="absolute right-1 top-1 z-10 flex flex-col gap-1 opacity-0 transition group-hover/result:opacity-100">
                    <button
                      class="border border-white/10 rounded bg-black/60 p-1 text-white transition hover:bg-emerald-500"
                      title="Download Generated Texture"
                      @click.stop="downloadTexture(lastGeneratedUrl, `${selectedMaterial.name}_result`)"
                    >
                      <div i-solar:download-square-bold-duotone class="text-xs" />
                    </button>
                    <button
                      class="border border-white/10 rounded bg-black/60 p-1 text-emerald-400 transition hover:bg-emerald-500 hover:text-white"
                      title="Pick & Purge (Surgical Eraser)"
                      @click.stop="openEraser(lastGeneratedUrl)"
                    >
                      <div i-solar:broom-bold-duotone class="text-xs" />
                    </button>
                  </div>
                  <div v-else-if="isGenerating" class="flex flex-col items-center gap-2 px-4 text-center">
                    <div i-solar:spinner-bold class="animate-spin text-xl text-emerald-500" />
                    <span class="animate-pulse text-[7px] text-emerald-500 font-bold uppercase">{{ vhackStore.generationActionLabel || 'Generating...' }}</span>
                    <!-- Progress Bar -->
                    <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <div class="h-full bg-emerald-500 transition-all duration-500" :style="{ width: `${vhackStore.generationProgress}%` }" />
                    </div>
                  </div>
                  <div v-else i-solar:ghost-bold-duotone class="text-2xl text-white/5" />
                </div>
              </div>
            </div>

            <div v-if="aiError" class="border border-red-500/30 rounded-lg bg-red-500/10 p-2 text-[8px] text-red-400 font-mono">
              {{ aiError }}
            </div>

            <!-- PRESET PALETTE -->
            <div class="space-y-2">
              <button class="group w-full flex items-center justify-between border border-white/10 rounded-lg bg-white/5 p-2 transition hover:border-emerald-500/30" @click="showPresets = !showPresets">
                <div class="flex items-center gap-2">
                  <div i-solar:palette-bold-duotone class="text-xs text-emerald-400" />
                  <span class="text-[10px] text-neutral-300 font-bold tracking-wider uppercase">
                    {{ selectedCategory ? ARTISTRY_PRESET_GROUPS.find(g => g.id === selectedCategory)?.label : 'Preset Palette' }}
                  </span>
                </div>
                <div :class="[showPresets ? 'i-solar:alt-arrow-down-bold-duotone' : 'i-solar:alt-arrow-right-bold-duotone']" class="text-neutral-500 transition group-hover:text-emerald-400" />
              </button>

              <div v-if="showPresets" class="animate-in fade-in slide-in-from-top-2 border border-white/5 rounded-lg bg-black/40 p-2 space-y-2">
                <!-- Category Selection -->
                <div v-if="!selectedCategory" class="grid grid-cols-2 gap-2">
                  <button v-for="group in ARTISTRY_PRESET_GROUPS" :key="group.id" class="group/cat relative h-12 flex flex-col items-center justify-center gap-1 overflow-hidden border border-white/5 rounded-lg bg-white/5 transition hover:border-emerald-500/30 hover:bg-emerald-500/10" @click="selectedCategory = group.id">
                    <div :class="group.icon" class="text-lg text-neutral-500 transition group-hover/cat:text-emerald-400" />
                    <span class="text-[7px] text-neutral-400 font-bold tracking-tighter uppercase group-hover/cat:text-white">{{ group.label }}</span>
                  </button>
                </div>

                <!-- Preset Selection -->
                <div v-else class="space-y-2">
                  <button class="w-full flex items-center gap-2 border-b border-white/5 pb-2 text-[8px] text-neutral-500 font-bold uppercase transition hover:text-white" @click="selectedCategory = null">
                    <div i-solar:alt-arrow-left-bold-duotone class="text-xs" />
                    Back to Categories
                  </button>
                  <div class="grid grid-cols-2 gap-2">
                    <button v-for="preset in activePresets" :key="preset.id" class="group/preset flex items-center gap-2 border border-transparent rounded-md bg-white/5 p-2 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/20" @click="injectPreset(preset.text)">
                      <div :class="preset.icon" class="shrink-0 text-xs text-neutral-500 transition group-hover/preset:text-emerald-400" />
                      <div class="truncate text-[9px] text-neutral-300 font-bold leading-tight group-hover/preset:text-white">
                        {{ preset.label }}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <textarea v-model="aiPrompt" placeholder="Describe the style change..." class="h-20 w-full resize-none border border-white/10 rounded-xl bg-white/5 p-3 text-xs text-white font-mono outline-none transition focus:border-emerald-500/50" />
            <div class="grid grid-cols-2 gap-2">
              <Button variant="primary" class="font-bold uppercase shadow-emerald-500/10 shadow-lg" :disabled="!aiPrompt || isGenerating || !artistryStore.activeProvider" @click="generateAndSwap">
                {{ isGenerating ? (vhackStore.generationActionLabel || 'Inscribing...') : 'Paint New Texture' }}
              </Button>
              <Button variant="secondary" class="border-emerald-500/20 bg-emerald-500/5 font-bold uppercase hover:bg-emerald-500/10" :disabled="isGenerating" @click="triggerManualUpload">
                Upload PNG
              </Button>
              <input ref="textureUploader" type="file" accept="image/png" class="hidden" @change="handleManualUpload">
            </div>
          </div>

          <!-- PHYSICAL SHADERS -->
          <div class="border-t border-white/5 pt-6 space-y-5">
            <div class="flex items-center gap-2 px-1">
              <div i-solar:atom-bold-duotone class="text-sm text-blue-400" /><div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">
                Physical Shaders
              </div>
            </div>
            <div class="space-y-4">
              <div class="space-y-2">
                <div class="flex justify-between px-1 text-[10px] text-neutral-400 font-bold uppercase">
                  <span>Rim Width</span><span class="text-emerald-400 font-mono">{{ (selectedMaterial.rimWidthFactor ?? selectedMaterial.uniforms?.rimWidth?.value ?? 0).toFixed(2) }}</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" :value="selectedMaterial.rimWidthFactor ?? selectedMaterial.uniforms?.rimWidth?.value ?? 0" class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" @input="e => updateProp('rimWidth', parseFloat((e.target as HTMLInputElement).value))">
              </div>
              <div class="space-y-2">
                <div class="flex justify-between px-1 text-[10px] text-neutral-400 font-bold uppercase">
                  <span>Shade Shift</span><span class="text-emerald-400 font-mono">{{ (selectedMaterial.shadingShiftFactor ?? selectedMaterial.uniforms?.shadingShift?.value ?? 0).toFixed(2) }}</span>
                </div>
                <input type="range" min="-1" max="1" step="0.01" :value="selectedMaterial.shadingShiftFactor ?? selectedMaterial.uniforms?.shadingShift?.value ?? 0" class="h-1 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]" @input="e => updateProp('shadeShift', parseFloat((e.target as HTMLInputElement).value))">
              </div>

              <!-- ADDITIVE BLENDING TOGGLE -->
              <div class="border-t border-white/5 pt-4 space-y-4">
                <div class="flex items-center justify-between px-1">
                  <div class="flex items-center gap-2">
                    <div i-solar:ghost-bold-duotone class="text-[10px] text-emerald-400" />
                    <div class="text-[10px] text-neutral-400 font-bold uppercase">
                      Additive Blending
                    </div>
                  </div>
                  <button
                    class="h-5 w-10 flex items-center border border-white/10 rounded-full bg-white/5 px-1 transition"
                    :class="{ 'bg-emerald-500/20 border-emerald-500/50': selectedMaterial.blending === 2 }"
                    @click="selectedMaterial.blending = selectedMaterial.blending === 2 ? 1 : 2; selectedMaterial.transparent = true; selectedMaterial.needsUpdate = true"
                  >
                    <div class="h-3 w-3 rounded-full bg-white transition-all" :class="{ 'translate-x-5 !bg-emerald-400': selectedMaterial.blending === 2 }" />
                  </button>
                </div>
                <div v-if="selectedMaterial.blending === 2" class="px-1 text-[8px] text-emerald-400 font-bold uppercase italic opacity-70">
                  Patch: Ignoring black data to restore eye transparency
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="h-40 flex flex-col items-center justify-center gap-2 text-xs text-neutral-600 italic">
          <div i-solar:shield-warning-bold-duotone text-2xl />Select mesh in "Nodes" first
        </div>
      </div>

      <!-- Texture Deck -->
      <div v-else-if="activeTab === 'texture'" class="space-y-4">
        <div v-if="lastSelectedTextureItem" class="border border-emerald-500/30 rounded-xl bg-white/5 p-3">
          <div class="mb-3 flex items-start justify-between">
            <div class="text-[10px] text-neutral-500 font-bold uppercase">
              Associated Nodes
            </div><button class="text-neutral-500 transition" @click="lastSelectedTextureItem = null">
              <div i-solar:close-circle-bold-duotone />
            </button>
          </div><div class="custom-scrollbar max-h-32 overflow-y-auto space-y-1">
            <div v-for="nodeItem in associatedNodesForTexture" :key="nodeItem.uuid" class="group flex cursor-pointer items-center justify-between rounded-lg bg-black/40 p-2 transition hover:bg-emerald-500/20" @click="jumpToNode(nodeItem)">
              <span class="truncate text-[10px] text-neutral-300 font-mono uppercase">{{ nodeItem.name }}</span><div i-solar:alt-arrow-right-bold-duotone class="text-emerald-500" />
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 pb-8">
          <div v-for="item in textureList" :key="item.id" class="group flex flex-col cursor-pointer gap-1 text-[8px] font-bold uppercase" @click="selectTexture(item)">
            <div class="relative aspect-square overflow-hidden border border-white/10 rounded-xl bg-white/5 transition" :class="[lastSelectedTextureItem?.id === item.id ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'group-hover:border-white/30']">
              <img v-if="item.url" :src="item.url" class="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:opacity-100"><div v-else i-solar:gallery-bold-duotone class="h-full flex items-center justify-center text-3xl text-neutral-800" /><div class="absolute right-1 top-1 rounded bg-black/80 px-1 py-0.5 text-[7px] text-emerald-400">
                {{ item.type }}
              </div>
            </div>
          </div>
          <label class="group mb-10 aspect-square flex flex-col cursor-pointer items-center justify-center border border-white/10 rounded-xl border-dashed bg-white/5 transition hover:border-emerald-500"><input type="file" class="hidden" accept="image/*" @change="handleFileUpload"><div i-solar:add-circle-bold-duotone class="text-3xl transition group-hover:text-emerald-500" /></label>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex flex-col gap-2 border-t border-white/10 bg-black/80 p-4">
      <div class="flex items-center justify-between px-1 text-[10px] text-neutral-500 font-bold uppercase">
        <span>Status</span><span :class="activeVrm ? 'text-emerald-500' : 'text-red-500'">{{ activeVrm ? 'CONNECTED' : 'OFFLINE' }}</span>
      </div>

      <!-- Search Filter (Moved to Footer) -->
      <div v-if="activeTab === 'tree'" class="relative mb-1">
        <div i-solar:magnifer-linear class="absolute left-3 top-1/2 shrink-0 translate-y-[-50%] text-neutral-500" />
        <input
          v-model="nodeFilter"
          placeholder="Filter nodes..."
          class="w-full border border-white/10 rounded-xl bg-white/5 py-2 pl-9 pr-3 text-[10px] text-white outline-none focus:border-emerald-500/50"
        >
      </div>

      <div v-if="activeTab === 'tree'" class="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" class="h-7 border-emerald-500/20 bg-emerald-500/5 text-[9px] font-black uppercase shadow-emerald-500/5 hover:bg-emerald-500/10" :disabled="!activeVrm" @click="vhackStore.showAll(nodes)">
          Show All
        </Button>
        <Button variant="secondary" size="sm" class="h-7 border-red-500/20 bg-red-500/5 text-[9px] font-black uppercase shadow-red-500/5 hover:bg-red-500/10" :disabled="!activeVrm" @click="vhackStore.hideAll(nodes)">
          Hide All
        </Button>
      </div>

      <Button variant="primary" size="sm" class="w-full bg-emerald-500 text-xs text-black font-black tracking-widest uppercase shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-emerald-400" :disabled="!activeVrm || isExporting" @click="exportVrm">
        <div v-if="isExporting" i-solar:spinner-bold class="mr-2 animate-spin" />
        {{ isExporting ? 'Packaging...' : 'Download Modified VRM' }}
      </Button>
      <Button variant="secondary" size="sm" class="w-full border-white/5 bg-white/5 text-[10px] font-bold tracking-widest" :disabled="!activeVrm" @click="revert">
        REVERT ALL CHANGES
      </Button>
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
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 12px; width: 12px; border-radius: 50%; background: #10b981; cursor: pointer; }
</style>
