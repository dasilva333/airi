<script setup lang="ts">
import JSZip from 'jszip'

import { Texture } from '@pixi/core'
import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { artistryGenerateHeadless, REPLICATE_IMAGEEDIT_PRESETS } from '@proj-airi/stage-shared'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'

import { useArtistryStore, useLHackStore } from '../../../../../stores'
import { useSettings } from '../../../../../stores/settings'

const lhackStore = useLHackStore()

const live2dStore = useLive2d()
const artistryStore = useArtistryStore()
const settingsStore = useSettings()
const { model: activeModel } = storeToRefs(live2dStore)
const { stageModelSelectedUrl } = storeToRefs(settingsStore)

// Universal ZIP buffer synchronization (Supports local files and remote presets)
watch(stageModelSelectedUrl, async (url) => {
  if (url && (url.toLowerCase().includes('.zip') || url.startsWith('blob:'))) {
    try {
      console.info('[LHACK] Syncing original ZIP buffer from URL...')
      const response = await fetch(url)
      const buffer = await response.arrayBuffer()
      lhackStore.originalZipBuffer = buffer
      console.info('[LHACK] ZIP buffer synchronized successfully.')
    }
    catch (err) {
      console.error('[LHACK] Failed to sync ZIP buffer:', err)
    }
  }
}, { immediate: true })

const generateInvoke = useElectronEventaInvoke(artistryGenerateHeadless)

const activeTab = ref<'tree' | 'material' | 'texture'>('tree')
const scrollContainer = ref<HTMLElement | null>(null)

// Selected State
const selectedDrawable = ref<any>(null)
const lastSelectedTextureItem = ref<any>(null)

// AI Comparison State
const sourceTextureUrl = ref<string | null>(null)
const lastGeneratedUrl = ref<string | null>(null)

// AI State
const aiPrompt = ref('')
const aiReplicateModelId = ref('black-forest-labs/flux-schnell')
const aiReplicateParams = ref('{}')
const selectedReplicatePreset = ref('')
const aiComfyParams = ref('{}')

const isGenerating = ref(false)
const isExporting = ref(false)
const aiError = ref<string | null>(null)
const textureUploader = ref<HTMLInputElement | null>(null)
const eraserCanvas = ref<HTMLCanvasElement | null>(null)

// Surgical Eraser State
const isEraserOpen = ref(false)
const eraserImageUrl = ref('')
const eraserPickedColor = ref<[number, number, number] | null>(null)
const eraserTolerance = ref(15)
const isEraserPicking = ref(true)

function getTextureUrl(tex: any) {
  if (!tex)
    return null

  // Pixi textures often have the source tucked away in baseTexture.resource or baseTexture.source
  const base = tex.baseTexture || tex
  if (!base)
    return null

  const resource = base.resource as any
  if (resource) {
    if (resource.src)
      return resource.src
    if (resource.source && resource.source.src)
      return resource.source.src
  }

  if (base.source && base.source.src)
    return base.source.src

  return null
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

interface DrawableNode {
  id: string
  index: number
  opacity: number
  visible: boolean
  name: string
}

// Tree View Logic
const drawables = computed<DrawableNode[]>(() => {
  // SCALED BACK: Returning empty to ensure UI manifest
  return []
  /*
  if (!activeModel.value)
    return []

  const internal = activeModel.value.internalModel
  const searchTerm = nodeFilter.value.toLowerCase()

  return internal.drawables.map((drawable: any, index: number) => {
    return {
      id: internal.drawableIds[index],
      index,
      opacity: drawable.opacity,
      visible: drawable.opacity > 0,
      name: internal.drawableIds[index],
    }
  }).filter((d: any) => d.name.toLowerCase().includes(searchTerm))
  */
})

function toggleVisibility(item: any, event?: MouseEvent) {
  if (event?.ctrlKey) {
    // Focus logic: hide everything except this one
    lhackStore.hideAll(drawables.value, activeModel.value)
    lhackStore.toggleDrawableVisibility(item.id, activeModel.value)
  }
  else {
    lhackStore.toggleDrawableVisibility(item.id, activeModel.value)
  }
}

function selectNode(item: any) {
  lhackStore.selectedDrawableId = item.id
  selectedDrawable.value = item

  // For Live2D, finding the texture for a drawable is complex (UV mapping)
  // Initially we just show all textures in the "Deck" tab
}

// Texture Deck Logic
const textureList = computed(() => {
  if (!activeModel.value)
    return []

  return activeModel.value.textures.map((tex, i) => {
    return {
      id: i,
      name: `Atlas ${i}`,
      type: 'Atlas',
      url: getTextureUrl(tex) || '',
      texture: tex,
    }
  })
})

function downloadTexture(item: any) {
  if (!item.url)
    return
  const link = document.createElement('a')
  link.href = item.url
  link.download = `${item.name}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function selectTexture(item: any) {
  lastSelectedTextureItem.value = item
  sourceTextureUrl.value = item.url
  lastGeneratedUrl.value = null

  if (!aiPrompt.value)
    aiPrompt.value = `Stylize the ${item.name} atlas...`

  nextTick(() => {
    if (scrollContainer.value)
      scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  })

  activeTab.value = 'material' // Move to "Lab" for editing
}

// Unified Artistry Generation
async function generateAndSwap() {
  if (!lastSelectedTextureItem.value || !aiPrompt.value)
    return

  lhackStore.isGeneratingTexture = true
  lhackStore.generationProgress = 10
  lhackStore.generationActionLabel = 'Preparing Atlas'
  lhackStore.lastGenerationError = null
  isGenerating.value = true
  aiError.value = null

  try {
    const tex = lastSelectedTextureItem.value.texture
    if (!tex)
      throw new Error('No texture found')

    // 1. Prepare base64 from current texture
    const resource = tex.baseTexture.resource as any
    if (!resource || !resource.src)
      throw new Error('Texture source not found')

    const response = await fetch(resource.src)
    const blob = await response.blob()
    const reader = new FileReader()
    const base64Promise = new Promise<string>((resolve) => {
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.readAsDataURL(blob)
    })
    const base64Data = await base64Promise

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
      lhackStore.lastGenerationError = result.error
      return
    }

    if (result?.base64) {
      lhackStore.generationProgress = 90
      lhackStore.generationActionLabel = 'Applying Result'

      const newUrl = result.base64.startsWith('data:') ? result.base64 : `data:image/png;base64,${result.base64}`
      lastGeneratedUrl.value = newUrl

      // Ensure data is resolved before swapping
      await lhackStore.applyTextureMutation(lastSelectedTextureItem.value.id, newUrl)
      await swapTextureByRef(newUrl, lastSelectedTextureItem.value.id)

      lhackStore.generationProgress = 100
      lhackStore.generationActionLabel = 'Success'
    }
  }
  catch (e: any) {
    aiError.value = e.message || 'Generation failed'
    lhackStore.lastGenerationError = aiError.value
  }
  finally {
    isGenerating.value = false
    lhackStore.isGeneratingTexture = false
    setTimeout(() => {
      lhackStore.generationProgress = 0
      lhackStore.generationActionLabel = null
    }, 2000)
  }
}

function triggerManualUpload() {
  textureUploader.value?.click()
}

async function handleManualUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !lastSelectedTextureItem.value)
    return

  const targetIdx = lastSelectedTextureItem.value.id
  const reader = new FileReader()
  reader.onload = async (e) => {
    const url = e.target?.result as string

    await lhackStore.applyTextureMutation(targetIdx, url)
    await swapTextureByRef(url, targetIdx)
    lastGeneratedUrl.value = url
  }
  reader.readAsDataURL(file)
}

async function swapTextureByRef(url: string, index: number) {
  if (!activeModel.value)
    return

  const targetTex = activeModel.value.textures[index]
  if (!targetTex)
    return

  console.info(`[LHACK] Swapping Texture Atlas ${index}...`)
  const newTex = Texture.from(url)

  const applyNuclearSwap = () => {
    // NUCLEAR SWAP: This is the only method confirmed to work visually
    // We replace the baseTexture object entirely.
    const oldBaseTex = targetTex.baseTexture
    targetTex.baseTexture = newTex.baseTexture

    // Force update the main texture
    targetTex.update()

    // SURGICAL SYNC: Iterate over all drawables to ensure they point to the new base texture
    // Sometimes the Live2D proxy doesn't propagate the baseTexture swap to all internal meshes
    // @ts-expect-error - internalModel type might be incomplete in some SDK versions
    if (activeModel.value?.internalModel?.drawables) {
      // @ts-expect-error - internalModel type might be incomplete in some SDK versions
      activeModel.value.internalModel.drawables.forEach((drawable: any) => {
        if (drawable.texture && drawable.texture.baseTexture === oldBaseTex) {
          drawable.texture.baseTexture = newTex.baseTexture
          drawable.texture.update()
        }
      })
    }

    console.info(`[LHACK] Nuclear swap and drawable sync complete for Atlas ${index}`)
  }

  if (newTex.baseTexture.valid) {
    applyNuclearSwap()
  }
  else {
    newTex.baseTexture.once('loaded', applyNuclearSwap)
  }
}

async function exportZip() {
  console.info('>>> [LHACK] Starting Export Sequence...')
  if (!activeModel.value || !lhackStore.originalZipBuffer) {
    console.error('[LHACK] Export Aborted: Missing model or original zip buffer', { model: !!activeModel.value, buffer: !!lhackStore.originalZipBuffer })
    aiError.value = 'No source bundle found (Load via ZIP?)'
    return
  }

  isExporting.value = true
  aiError.value = null

  try {
    console.info('[LHACK] Loading original ZIP...')
    const zip = await JSZip.loadAsync(lhackStore.originalZipBuffer)

    // Find the model3.json to get texture paths
    const model3Path = Object.keys(zip.files).find(f => f.endsWith('.model3.json'))
    if (!model3Path)
      throw new Error('model3.json not found in bundle')

    console.info(`[LHACK] Found model descriptor: ${model3Path}`)
    const model3Json = JSON.parse(await zip.file(model3Path)!.async('string'))
    const texturePaths = model3Json.FileReferences.Textures

    // Replace mutated textures
    console.info(`[LHACK] Processing ${lhackStore.mutatedTextures.size} mutations...`)
    const zipFiles = Object.keys(zip.files)

    for (const [index, mutation] of lhackStore.mutatedTextures.entries()) {
      const relPath = texturePaths[index]
      if (relPath) {
        const basePath = model3Path.substring(0, model3Path.lastIndexOf('/') + 1)
        const fullPath = basePath + relPath
        const normalizedPath = fullPath.replace(/\\/g, '/').replace(/^\.\//, '')

        // Case-insensitive search for the file in the zip
        const zipKey = zipFiles.find(f => f === normalizedPath || f.toLowerCase() === normalizedPath.toLowerCase())

        if (zipKey) {
          console.info(`[LHACK] Overwriting: ${zipKey} (Data Length: ${mutation.data.length})`)
          zip.file(zipKey, mutation.data, { base64: true })
        }
        else {
          console.warn(`[LHACK] Texture path not found in ZIP: ${normalizedPath}`)
          // Fallback: create the file at the normalized path if it doesn't exist
          zip.file(normalizedPath, mutation.data, { base64: true })
        }
      }
    }

    console.info('[LHACK] Generating final ZIP blob...')
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = `LHACK_${(activeModel.value as any).name || 'model'}.zip`
    a.click()
    URL.revokeObjectURL(url)
    console.info('[LHACK] Export Complete. Download triggered.')
  }
  catch (e: any) {
    console.error('[LHACK] Export Failed:', e)
    aiError.value = e.message || 'Export failed'
  }
  finally {
    isExporting.value = false
  }
}

function revert() {
  lhackStore.resetState()
  window.location.reload()
}

/**
 * PICK & PURGE LOGIC (Surgical Eraser)
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
  }
  img.src = eraserImageUrl.value
}

async function finalizeEraserBake() {
  if (!eraserCanvas.value || !lastSelectedTextureItem.value)
    return
  const cleanedUrl = eraserCanvas.value.toDataURL('image/png')
  const targetIdx = lastSelectedTextureItem.value.id

  await lhackStore.applyTextureMutation(targetIdx, cleanedUrl)
  await swapTextureByRef(cleanedUrl, targetIdx)

  isEraserOpen.value = false
  lastGeneratedUrl.value = cleanedUrl // Update result preview
}
</script>

<template>
  <!-- DEBUG: isHackerModeActive: {{ lhackStore.isHackerModeActive }} -->
  <div v-if="lhackStore.isHackerModeActive" class="fixed bottom-4 right-4 top-24 z-50 w-80 flex flex-col overflow-hidden border-2 border-purple-500 rounded-2xl bg-black/95 shadow-2xl backdrop-blur-3xl">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-white/10 from-purple-500/20 to-transparent bg-gradient-to-r p-4 text-[14px]">
      <div class="flex items-center gap-2 text-white font-black tracking-tighter uppercase">
        <div i-solar:mask-h-bold-duotone class="text-xl text-purple-400" />L-HACK Inspector
      </div>
      <button class="text-neutral-400 transition hover:text-white" @click="lhackStore.closeHackerMode">
        <div i-solar:close-circle-bold-duotone />
      </button>
    </div>

    <!-- Tabs -->
    <div class="mx-4 mt-4 flex gap-1 rounded-lg bg-white/5 p-1 text-[10px] font-bold tracking-widest uppercase">
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'tree' ? 'bg-purple-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'tree'">
        Drawables
      </button>
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'material' ? 'bg-purple-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'material'">
        Forge
      </button>
      <button :class="['flex-1 py-2 rounded-md transition', activeTab === 'texture' ? 'bg-purple-500 text-black' : 'text-neutral-400 hover:bg-white/5']" @click="activeTab = 'texture'">
        Atlases
      </button>
    </div>

    <!-- Content -->
    <div ref="scrollContainer" class="custom-scrollbar flex-1 overflow-y-auto p-4">
      <!-- Tree View -->
      <div v-if="activeTab === 'tree'" class="space-y-1">
        <div v-for="node in drawables" :key="node.id" class="group flex cursor-pointer items-center justify-between border border-transparent rounded-lg p-2 text-xs transition hover:border-white/5 hover:bg-white/5" :class="{ 'bg-purple-500/10 border-purple-500/30': lhackStore.selectedDrawableId === node.id }" @click="selectNode(node)">
          <div class="flex items-center gap-2 truncate">
            <div i-solar:layers-bold-duotone class="text-purple-400" />
            <div class="flex flex-col truncate">
              <span :class="[lhackStore.selectedDrawableId === node.id ? 'text-purple-400 font-bold' : 'text-neutral-300']">{{ node.name }}</span>
            </div>
          </div>
          <button class="rounded p-1 transition hover:bg-white/10" @click.stop="e => toggleVisibility(node, e)">
            <div :class="[node.visible ? 'i-solar:eye-bold-duotone text-purple-400' : 'i-solar:eye-closed-bold-duotone text-red-500']" />
          </button>
        </div>
      </div>

      <!-- Atlas Forge -->
      <div v-else-if="activeTab === 'material'" class="pb-20 space-y-6">
        <div v-if="lastSelectedTextureItem" class="space-y-4">
          <div class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <div i-solar:magic-stick-bold-duotone class="text-sm text-purple-400" />
                <div class="text-[10px] text-white font-black tracking-widest uppercase">
                  ◈ Atlas Forge [Live2D v1.0]
                </div>
              </div>
            </div>

            <!-- Before/After View -->
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <div class="px-1 text-[8px] text-neutral-500 font-bold uppercase">
                  Source Atlas
                </div>
                <div class="group relative aspect-square overflow-hidden border border-white/5 rounded-lg bg-white/5">
                  <img v-if="sourceTextureUrl" :src="sourceTextureUrl" class="h-full w-full object-cover opacity-60 transition group-hover:opacity-100">
                  <div class="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      class="h-5 w-5 flex items-center justify-center rounded bg-black/60 text-white/70 transition hover:bg-purple-500 hover:text-white"
                      title="Download Source Atlas"
                      @click.stop="downloadTexture(lastSelectedTextureItem)"
                    >
                      <div class="i-solar:download-minimalistic-bold-duotone h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="space-y-1">
                <div class="px-1 text-[8px] text-purple-500 font-bold uppercase">
                  {{ lastGeneratedUrl ? 'Result' : 'Idle' }}
                </div>
                <div class="group/result relative aspect-square flex items-center justify-center overflow-hidden border border-purple-500/20 rounded-lg border-dashed bg-purple-500/5">
                  <img v-if="lastGeneratedUrl" :src="lastGeneratedUrl" class="h-full w-full object-cover">
                  <div v-if="lastGeneratedUrl" class="absolute right-1 top-1 z-10 flex flex-col gap-1 opacity-0 transition group-hover/result:opacity-100">
                    <button
                      class="border border-white/10 rounded bg-black/60 p-1 text-white transition hover:bg-purple-500"
                      title="Download Generated Atlas"
                      @click.stop="downloadTexture({ url: lastGeneratedUrl, name: 'lhack_result' })"
                    >
                      <div i-solar:download-square-bold-duotone class="text-xs" />
                    </button>
                    <button
                      class="border border-white/10 rounded bg-black/60 p-1 text-purple-400 transition hover:bg-purple-500 hover:text-white"
                      title="Pick & Purge (Surgical Eraser)"
                      @click.stop="openEraser(lastGeneratedUrl)"
                    >
                      <div i-solar:broom-bold-duotone class="text-xs" />
                    </button>
                  </div>
                  <div v-if="isGenerating" class="flex flex-col items-center gap-2 px-4 text-center">
                    <div i-solar:spinner-bold class="animate-spin text-xl text-purple-500" />
                    <span class="animate-pulse text-[7px] text-purple-500 font-bold uppercase">{{ lhackStore.generationActionLabel || 'Inscribing...' }}</span>
                  </div>
                  <div v-else-if="!lastGeneratedUrl" i-solar:ghost-bold-duotone class="text-2xl text-white/5" />
                </div>
              </div>
            </div>

            <textarea v-model="aiPrompt" placeholder="Describe the style change for this atlas..." class="h-20 w-full resize-none border border-white/10 rounded-xl bg-white/5 p-3 text-xs text-white font-mono outline-none transition focus:border-purple-500/50" />
            <div class="grid grid-cols-2 gap-2">
              <Button variant="primary" class="bg-purple-600 font-bold uppercase shadow-lg shadow-purple-500/10" :disabled="!aiPrompt || isGenerating" @click="generateAndSwap">
                Inscribe Style (AI)
              </Button>
              <Button variant="secondary" class="border-purple-500/20 bg-purple-500/5 font-bold uppercase hover:bg-purple-500/10" :disabled="isGenerating" @click="triggerManualUpload">
                Upload PNG
              </Button>
              <input ref="textureUploader" type="file" accept="image/png" class="hidden" @change="handleManualUpload">
            </div>
          </div>
        </div>
        <div v-else class="h-40 flex flex-col items-center justify-center gap-2 text-xs text-neutral-600 italic">
          <div i-solar:shield-warning-bold-duotone text-2xl />Select atlas in "Atlases" first
        </div>
      </div>

      <!-- Texture Deck -->
      <div v-else-if="activeTab === 'texture'" class="grid grid-cols-2 gap-3 pb-8">
        <div v-for="item in textureList" :key="item.id" class="group flex flex-col cursor-pointer gap-1 text-[8px] font-bold uppercase" @click="selectTexture(item)">
          <div class="relative aspect-square overflow-hidden border border-white/10 rounded-xl bg-white/5 transition" :class="[lastSelectedTextureItem?.id === item.id ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : 'group-hover:border-white/30']">
            <img v-if="item.url" :src="item.url" class="absolute inset-0 h-full w-full object-cover opacity-60 transition group-hover:opacity-100">
            <div class="absolute right-1 top-1 flex flex-col items-end gap-1">
              <div class="rounded bg-black/80 px-1 py-0.5 text-[7px] text-purple-400">
                {{ item.type }}
              </div>
              <button
                class="h-5 w-5 flex items-center justify-center rounded bg-black/60 text-white/70 opacity-0 transition hover:bg-purple-500 hover:text-white group-hover:opacity-100"
                title="Download Atlas"
                @click.stop="downloadTexture(item)"
              >
                <div class="i-solar:download-minimalistic-bold-duotone h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex flex-col gap-2 border-t border-white/10 bg-black/80 p-4">
      <Button variant="primary" size="sm" class="w-full bg-purple-500 text-xs text-black font-black tracking-widest uppercase shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:bg-purple-400" :disabled="!activeModel || isExporting" @click="exportZip">
        <div v-if="isExporting" i-solar:spinner-bold class="mr-2 animate-spin" />
        {{ isExporting ? 'Packaging...' : 'Download Modified ZIP' }}
      </Button>
      <Button variant="secondary" size="sm" class="w-full border-white/5 bg-white/5 text-[10px] font-bold tracking-widest" :disabled="!activeModel" @click="revert">
        REVERT ALL CHANGES
      </Button>
    </div>

    <!-- Surgical Eraser Modal -->
    <div v-if="isEraserOpen" class="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-10 transition-all">
      <div class="relative max-h-full max-w-2xl w-full border border-white/10 rounded-3xl bg-neutral-900/50 p-6 shadow-2xl backdrop-blur-3xl space-y-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div i-solar:broom-bold-duotone class="text-2xl text-purple-400" />
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
            <span class="text-purple-400 font-mono">{{ eraserTolerance }}</span>
          </div>
          <input v-model="eraserTolerance" type="range" min="1" max="100" step="1" class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/5 accent-purple-500" @input="applyEraserPurge">
        </div>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <Button variant="secondary" class="border-white/5 bg-white/5 font-black tracking-widest uppercase" @click="isEraserOpen = false">
            Abort
          </Button>
          <Button variant="primary" class="bg-purple-500 text-black font-black tracking-widest uppercase shadow-lg shadow-purple-500/20 hover:bg-purple-400" @click="finalizeEraserBake">
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
</style>
