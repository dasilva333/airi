<script setup lang="ts">
import type { HackerAdapter, HackerMaterialControl, HackerPart, HackerTexture } from './adapters/types'
import type { useHackerStudio } from './composables/use-hacker-studio'
import type { SupportedUploadMime } from './domain/upload-validation'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { ARTISTRY_PRESET_GROUPS, artistryGenerateHeadless, REPLICATE_IMAGEEDIT_PRESETS } from '@proj-airi/stage-shared'
import { Button } from '@proj-airi/ui'
import { computed, nextTick, ref, watch } from 'vue'

import { useArtistryStore } from '../../../../../stores/modules/artistry'
import { withUvGuidance } from './domain/generation-guidance'
import { buildUploadNotices, inferImageMime } from './domain/upload-validation'

const props = defineProps<{
  adapter: HackerAdapter
  studio: ReturnType<typeof useHackerStudio>
}>()
const adapter = props.adapter
const studio = props.studio
const {
  mode: labMode,
  prompt: aiPrompt,
  selectedTexture,
  currentReplacement,
  currentPreviewing,
  uploadNotice,
  uploadError,
  isGenerating,
  generationProgress,
  generationActionLabel,
  generationError,
  generationTargetName,
  selectTexture: selectStudioTexture,
  applyUpload,
  togglePreview,
  applyEditedTexture,
  revertTexture,
  beginGeneration,
  getGenerationBase,
  applyGenerationResult,
  setGenerationProgress,
  setGenerationError,
  finishGeneration,
  exportAsset,
  reset: resetStudio,
  setUploadError,
} = studio

const artistryStore = useArtistryStore()
const generateInvoke = useElectronEventaInvoke(artistryGenerateHeadless)

const activeTab = ref<'texture' | 'material' | 'tree'>('texture')
const textureFilter = ref('')
const textureTypeFilter = ref('All')
const nodeFilter = ref('')
const selectedPartId = ref<string | null>(null)
const isDragOver = ref(false)
const isExporting = ref(false)
const actionError = ref<string | null>(null)
const textureUploader = ref<HTMLInputElement | null>(null)

const aiReplicateModelId = ref('black-forest-labs/flux-schnell')
const aiReplicateParams = ref('{}')
const selectedReplicatePreset = ref('')
const aiComfyParams = ref('{}')
const selectedCategory = ref<string | null>('fabrics')
const showAllPresets = ref(false)
const showAiSettings = ref(false)

const eraserCanvas = ref<HTMLCanvasElement | null>(null)
const isEraserOpen = ref(false)
const eraserImageUrl = ref('')
const eraserPickedColor = ref<[number, number, number] | null>(null)
const eraserTolerance = ref(15)
const isEraserPicking = ref(true)

const availableProviders = [
  { id: 'nanobanana', name: 'Nano Banana', icon: 'i-solar:gallery-wide-bold-duotone' },
  { id: 'replicate', name: 'Replicate', icon: 'i-solar:cloud-bold-duotone' },
  { id: 'comfyui', name: 'ComfyUI', icon: 'i-solar:settings-bold-duotone' },
]

const EMPTY_PRESETS: readonly any[] = Object.freeze([])
const activePresets = computed(() => {
  const group = ARTISTRY_PRESET_GROUPS.find(item => item.id === selectedCategory.value)
  return group?.presets ?? EMPTY_PRESETS
})
const PREFERRED_PRESET_IDS = ['gold', 'gothic', 'denim', 'satin']
const visiblePresets = computed(() => {
  if (showAllPresets.value)
    return activePresets.value
  const preferred = activePresets.value.filter(preset => PREFERRED_PRESET_IDS.includes(preset.id))
  return preferred.length === 4 ? preferred : activePresets.value.slice(0, 4)
})

const textureKinds = computed(() => [...new Set(adapter.textures.value.map(texture => texture.kind))])
watch(textureKinds, (kinds) => {
  if (textureTypeFilter.value !== 'All' && !kinds.includes(textureTypeFilter.value))
    textureTypeFilter.value = 'All'
})

const filteredTextures = computed(() => {
  const query = textureFilter.value.trim().toLowerCase()
  return adapter.textures.value.filter((texture) => {
    if (textureTypeFilter.value !== 'All' && texture.kind !== textureTypeFilter.value)
      return false
    return !query
      || texture.name.toLowerCase().includes(query)
      || texture.owners.some(owner => owner.toLowerCase().includes(query))
  })
})

const filteredParts = computed(() => {
  const query = nodeFilter.value.trim().toLowerCase()
  if (!query)
    return adapter.parts.value
  return adapter.parts.value.filter(part => part.name.toLowerCase().includes(query))
})

const ownerNoun = computed(() => adapter.ownerNoun || 'material')
function ownerNounFor(count: number) {
  return count === 1 ? ownerNoun.value : `${ownerNoun.value}s`
}
const acceptedUploadMimes = computed(() => adapter.acceptedUploadMimes ?? ['image/png', 'image/jpeg', 'image/webp'])
const acceptedUploadTypes = computed(() => acceptedUploadMimes.value.join(','))
const uploadFormatHint = computed(() => acceptedUploadMimes.value.length === 1 && acceptedUploadMimes.value[0] === 'image/png'
  ? 'PNG only'
  : 'PNG recommended · JPEG/WebP accepted')
const uploadMimeError = computed(() => acceptedUploadMimes.value.length === 1 && acceptedUploadMimes.value[0] === 'image/png'
  ? 'Use a PNG image.'
  : 'Use a PNG, JPEG, or WebP image.')
const exportDisabledReason = computed(() => adapter.exportUnavailableReason?.value ?? null)
const canExport = computed(() => adapter.capabilities.export === 'full-bundle' && !exportDisabledReason.value)
const hasMaterialControls = computed(() => adapter.capabilities.materials && (adapter.materialControls?.value.length ?? 0) > 0)

try {
  const savedMode = sessionStorage.getItem('hacker-studio-mode')
  if (savedMode === 'prompt' || savedMode === 'local')
    labMode.value = savedMode
}
catch {}
watch(labMode, (mode) => {
  try {
    sessionStorage.setItem('hacker-studio-mode', mode)
  }
  catch {}
})

watch(selectedReplicatePreset, (presetId) => {
  if (!presetId)
    return
  const preset = REPLICATE_IMAGEEDIT_PRESETS.find(item => item.id === presetId)
  if (preset) {
    aiReplicateModelId.value = preset.id
    aiReplicateParams.value = JSON.stringify(preset.preset, null, 2)
    if (preset.prompt)
      aiPrompt.value = preset.prompt
  }
})

watch(() => artistryStore.comfyuiActiveWorkflow, (workflowId) => {
  if (!workflowId)
    return
  const workflow = artistryStore.comfyuiSavedWorkflows.find(item => item.id === workflowId)
  if (!workflow)
    return
  const example: Record<string, any> = {}
  for (const [nodeTitle, fields] of Object.entries(workflow.exposedFields)) {
    example[nodeTitle] = {}
    for (const field of fields) {
      const nodeId = Object.keys(workflow.workflow).find(id => (workflow.workflow[id]._meta?.title || workflow.workflow[id].class_type) === nodeTitle)
      example[nodeTitle][field] = nodeId ? workflow.workflow[nodeId].inputs[field] : '...'
    }
  }
  aiComfyParams.value = JSON.stringify(example, null, 2)
})

function injectPreset(text: string) {
  aiPrompt.value = text
}

function selectTexture(texture: HackerTexture) {
  adapter.selectTexture?.(texture.id)
  selectStudioTexture(texture.id)
  activeTab.value = 'material'
}

function selectPart(part: HackerPart, event?: MouseEvent) {
  selectedPartId.value = part.id
  if (event?.ctrlKey) {
    adapter.parts.value.forEach(item => adapter.setPartVisibility?.(item.id, item.id === part.id))
  }
}

function togglePart(part: HackerPart) {
  adapter.setPartVisibility?.(part.id, !part.visible)
}

function showAllParts() {
  adapter.parts.value.forEach(part => adapter.setPartVisibility?.(part.id, true))
}

function hideAllParts() {
  adapter.parts.value.forEach(part => adapter.setPartVisibility?.(part.id, false))
}

function updateMaterialControl(control: HackerMaterialControl, value: number | boolean) {
  adapter.setMaterialControl?.(control.id, value)
}

function textureSize(texture: HackerTexture) {
  return texture.width && texture.height ? `${texture.width} × ${texture.height}` : 'Unknown size'
}

function downloadUrl(url: string | null, filename: string) {
  if (!url)
    return
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}

function downloadOriginal() {
  const texture = selectedTexture.value
  if (!texture?.previewUrl)
    return
  const base = (texture.name || 'texture').replace(/[^\w-]+/g, '_')
  downloadUrl(texture.previewUrl, `${base}_original.png`)
}

function downloadReplacement() {
  const texture = selectedTexture.value
  const replacement = currentReplacement.value
  if (!texture || !replacement)
    return
  const base = (texture.name || 'texture').replace(/[^\w-]+/g, '_')
  downloadUrl(replacement.url, `${base}_replacement.png`)
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
  catch {}
  return false
}

interface DecodedUpload {
  dataUrl: string
  width: number
  height: number
  hasAlpha: boolean
  mime: SupportedUploadMime
}

async function decodeUpload(file: File): Promise<DecodedUpload> {
  const mime = inferImageMime(file)
  if (!mime || !acceptedUploadMimes.value.includes(mime))
    throw new Error(uploadMimeError.value)
  const raw = await readFileAsDataUrl(file)
  const dataUrl = `data:${mime};base64,${raw.split(',')[1]}`
  const image = await loadHtmlImage(dataUrl)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height)
    throw new Error('That image has no readable dimensions.')
  return { dataUrl, width, height, hasAlpha: imageHasTransparency(image), mime }
}

async function applyUploadFile(file: File) {
  const texture = selectedTexture.value
  if (!texture)
    return
  setUploadError(null)
  actionError.value = null
  try {
    const decoded = await decodeUpload(file)
    const notice = buildUploadNotices(
      decoded,
      { width: texture.width, height: texture.height, hasAlpha: texture.hasAlpha ?? false },
    )
    await applyUpload(texture.id, decoded.dataUrl, file.name, notice)
  }
  catch (e: any) {
    setUploadError(e?.message || 'Could not load that image.')
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

async function toBase64(url: string): Promise<string> {
  if (url.startsWith('data:'))
    return url.split(',')[1]
  const response = await fetch(url)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function generateReplacement() {
  const texture = selectedTexture.value
  if (!texture || !aiPrompt.value || isGenerating.value)
    return
  actionError.value = null
  const context = await beginGeneration(texture.id)
  setGenerationProgress(10, 'Preparing Canvas')
  try {
    const base64Data = await toBase64(await getGenerationBase(texture.id))
    let options: Record<string, any> = {}
    let model: string | undefined
    const globals = {
      ...JSON.parse(JSON.stringify(artistryStore.$state)),
      image: base64Data,
    }
    if (artistryStore.activeProvider === 'nanobanana') {
      options = { resolution: artistryStore.nanobananaResolution, model: artistryStore.nanobananaModel }
    }
    else if (artistryStore.activeProvider === 'replicate') {
      options = JSON.parse(aiReplicateParams.value || '{}')
      model = aiReplicateModelId.value
    }
    else if (artistryStore.activeProvider === 'comfyui') {
      try {
        options = JSON.parse(aiComfyParams.value || '{}')
      }
      catch {
        options = {}
      }
      model = artistryStore.comfyuiActiveWorkflow
    }

    setGenerationProgress(30, 'Generating')
    const result = await generateInvoke({
      prompt: withUvGuidance(aiPrompt.value),
      provider: artistryStore.activeProvider,
      options,
      globals,
      model,
    })
    if (result?.error) {
      setGenerationError(result.error)
      return
    }
    if (!result?.base64) {
      setGenerationError('No image data returned from provider')
      return
    }
    const newUrl = result.base64.startsWith('data:') ? result.base64 : `data:image/png;base64,${result.base64}`
    setGenerationProgress(90, 'Applying Result')
    const applied = await applyGenerationResult(context, newUrl)
    if (applied)
      setGenerationProgress(100, 'Success')
  }
  catch (e: any) {
    setGenerationError(e?.message || 'Generation failed')
  }
  finally {
    finishGeneration()
    setTimeout(() => {
      // A newer generation may have started while this reset timer was pending.
      if (!isGenerating.value)
        setGenerationProgress(0, null)
    }, 2000)
  }
}

async function downloadExport() {
  if (!canExport.value)
    return
  isExporting.value = true
  actionError.value = null
  try {
    const { blob, filename } = await exportAsset()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
  catch (e: any) {
    actionError.value = e?.message || 'Export failed'
  }
  finally {
    isExporting.value = false
  }
}

function resetAll() {
  resetStudio()
  actionError.value = null
  isEraserOpen.value = false
}

function openEraser(url: string) {
  eraserImageUrl.value = url
  isEraserOpen.value = true
  isEraserPicking.value = true
  eraserPickedColor.value = null
  nextTick(() => {
    if (!eraserCanvas.value)
      return
    const image = new Image()
    image.onload = () => {
      eraserCanvas.value!.width = image.width
      eraserCanvas.value!.height = image.height
      eraserCanvas.value!.getContext('2d')?.drawImage(image, 0, 0)
    }
    image.src = url
  })
}

function handleEraserClick(event: MouseEvent) {
  if (!eraserCanvas.value || !isEraserPicking.value)
    return
  const rect = eraserCanvas.value.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) * (eraserCanvas.value.width / rect.width))
  const y = Math.floor((event.clientY - rect.top) * (eraserCanvas.value.height / rect.height))
  const ctx = eraserCanvas.value.getContext('2d')
  if (!ctx)
    return
  const pixel = ctx.getImageData(x, y, 1, 1).data
  eraserPickedColor.value = [pixel[0], pixel[1], pixel[2]]
  applyEraserPurge()
}

function applyEraserPurge() {
  if (!eraserCanvas.value || !eraserPickedColor.value)
    return
  const canvas = eraserCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return
  const source = eraserImageUrl.value
  const image = new Image()
  image.onload = () => {
    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    const [r, g, b] = eraserPickedColor.value!
    const tolerance = eraserTolerance.value
    for (let i = 0; i < data.length; i += 4) {
      const diff = Math.sqrt((data[i] - r) ** 2 + (data[i + 1] - g) ** 2 + (data[i + 2] - b) ** 2)
      if (diff <= tolerance)
        data[i + 3] = 0
    }
    ctx.putImageData(imageData, 0, 0)
  }
  image.src = source
}

async function finalizeEraser() {
  const texture = selectedTexture.value
  if (!texture || !eraserCanvas.value)
    return
  const cleaned = eraserCanvas.value.toDataURL('image/png')
  await applyEditedTexture(texture.id, cleaned)
  isEraserOpen.value = false
}

function selectMode(mode: 'local' | 'prompt') {
  labMode.value = mode
}

const EMPTY_MATERIAL_CONTROLS: readonly HackerMaterialControl[] = Object.freeze([])
const selectedMaterialControls = computed(() => adapter.materialControls?.value ?? EMPTY_MATERIAL_CONTROLS)
</script>

<template>
  <div class="min-w-0 w-full flex flex-col gap-3">
    <div class="flex gap-1 rounded-xl bg-neutral-100 p-1 text-[10px] font-bold tracking-widest uppercase dark:bg-neutral-800">
      <button
        type="button"
        :class="['flex-1 rounded-lg py-2 transition-colors', activeTab === 'texture' ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400']"
        @click="activeTab = 'texture'"
      >
        Textures
      </button>
      <button
        type="button"
        :class="['flex-1 rounded-lg py-2 transition-colors', activeTab === 'material' ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400']"
        @click="activeTab = 'material'"
      >
        Lab
      </button>
      <button
        v-if="adapter.capabilities.parts"
        type="button"
        :class="['flex-1 rounded-lg py-2 transition-colors', activeTab === 'tree' ? 'bg-white text-primary-600 shadow-sm dark:bg-neutral-900 dark:text-primary-300' : 'text-neutral-500 dark:text-neutral-400']"
        @click="activeTab = 'tree'"
      >
        Parts
      </button>
    </div>

    <div class="custom-scrollbar max-h-[560px] min-h-0 overflow-y-auto">
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
            v-for="filter in ['All', ...textureKinds]"
            :key="filter"
            type="button"
            :class="['rounded-full px-2 py-0.5 text-[10px] font-semibold', textureTypeFilter === filter ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400']"
            @click="textureTypeFilter = filter"
          >
            {{ filter }}
          </button>
          <span class="ml-auto text-[10px] text-neutral-400">{{ filteredTextures.length }} texture{{ filteredTextures.length === 1 ? '' : 's' }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="texture in filteredTextures"
            :key="texture.id"
            type="button"
            :class="['group flex flex-col overflow-hidden rounded-xl border text-left transition-colors', selectedTexture?.id === texture.id ? 'border-primary-500/60 bg-primary-500/5' : 'border-neutral-200/80 bg-white/70 dark:border-neutral-800 dark:bg-neutral-900/40']"
            :title="texture.owners.join(', ')"
            @click="selectTexture(texture)"
          >
            <div class="texture-checker relative aspect-square w-full overflow-hidden">
              <img v-if="texture.previewUrl" :src="texture.previewUrl" class="absolute inset-0 h-full w-full object-contain">
              <div v-else class="h-full w-full flex items-center justify-center text-neutral-400">
                <div class="i-solar:gallery-bold-duotone text-2xl" />
              </div>
              <span class="absolute right-1.5 top-1.5 rounded-md bg-neutral-900/80 px-1.5 py-0.5 text-[8px] text-white font-semibold">{{ texture.kind }}</span>
            </div>
            <div class="w-full flex flex-col gap-0.5 border-t border-neutral-200/70 p-2 dark:border-neutral-800">
              <span class="w-full truncate text-[11px] text-neutral-800 font-semibold dark:text-neutral-100">{{ texture.name }}</span>
              <span class="text-[9px] text-neutral-400">{{ textureSize(texture) }}</span>
              <span class="w-full truncate text-[8px] text-primary-600/80 dark:text-primary-300/80">
                {{ texture.owners[0] }}{{ texture.owners.length > 1 ? ` +${texture.owners.length - 1}` : '' }}
              </span>
            </div>
          </button>
        </div>
        <p class="px-1 text-[10px] text-neutral-400">
          Select a texture to open it in the Lab.
        </p>
      </div>

      <div v-else-if="activeTab === 'material'" class="p-1 space-y-3">
        <template v-if="selectedTexture">
          <div class="flex items-center gap-2 border border-neutral-200/80 rounded-xl bg-white/70 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/40">
            <img v-if="selectedTexture.previewUrl" :src="selectedTexture.previewUrl" class="h-10 w-10 shrink-0 rounded-lg object-cover">
            <div class="min-w-0 flex-1">
              <div class="truncate text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                {{ selectedTexture.name }}
                <span class="text-[10px] text-neutral-400 font-normal">· {{ selectedTexture.kind }} texture</span>
              </div>
              <details class="material-owner-details">
                <summary class="flex cursor-pointer select-none items-center gap-1 text-[10px] text-neutral-400">
                  <span>{{ textureSize(selectedTexture) }} · Used by {{ selectedTexture.owners.length }} {{ ownerNounFor(selectedTexture.owners.length) }}</span>
                  <div class="materials-chevron i-solar:alt-arrow-down-bold text-[9px] transition-transform" />
                </summary>
                <div class="custom-scrollbar mt-1 max-h-24 overflow-y-auto pr-1">
                  <div v-for="owner in selectedTexture.owners" :key="owner" class="truncate text-[9px] text-neutral-500 dark:text-neutral-400" :title="owner">
                    {{ owner }}
                  </div>
                </div>
              </details>
            </div>
            <button type="button" class="shrink-0 text-[10px] text-primary-600 font-medium dark:text-primary-300" @click="activeTab = 'texture'">
              Change texture
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between px-0.5">
                <span class="text-[10px] text-neutral-500 font-semibold dark:text-neutral-400">Current texture</span>
              </div>
              <div class="texture-checker relative aspect-square overflow-hidden border border-neutral-200/80 rounded-xl dark:border-neutral-800">
                <img v-if="selectedTexture.previewUrl" :src="selectedTexture.previewUrl" class="absolute inset-0 h-full w-full object-contain">
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between px-0.5">
                <span class="text-[10px] text-neutral-500 font-semibold dark:text-neutral-400">Replacement texture</span>
                <span class="flex items-center gap-1">
                  <button
                    type="button"
                    :disabled="!currentReplacement"
                    :class="['flex items-center gap-1 text-[9px] font-medium disabled:op-40', currentPreviewing ? 'text-primary-600 dark:text-primary-300' : 'text-neutral-400']"
                    @click="togglePreview(selectedTexture.id)"
                  >
                    <div :class="currentPreviewing ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold'" />
                    Preview
                  </button>
                  <span class="text-[8px] text-neutral-400">on avatar</span>
                </span>
              </div>
              <div class="texture-checker relative aspect-square overflow-hidden border border-neutral-200/80 rounded-xl dark:border-neutral-800">
                <img v-if="currentReplacement" :src="currentReplacement.url" class="absolute inset-0 h-full w-full object-contain">
                <div v-else class="h-full w-full flex items-center justify-center text-[9px] text-neutral-400">
                  No replacement yet
                </div>
                <div v-if="currentReplacement" class="absolute right-1 top-1 flex gap-1">
                  <button type="button" class="rounded-md bg-neutral-900/70 p-1 text-white" title="Download replacement" @click.stop="downloadReplacement">
                    <div class="i-solar:download-minimalistic-bold" />
                  </button>
                  <button type="button" class="rounded-md bg-neutral-900/70 p-1 text-white" title="Color eraser" @click.stop="openEraser(currentReplacement.url)">
                    <div class="i-solar:broom-bold-duotone" />
                  </button>
                </div>
              </div>
              <button v-if="currentReplacement" type="button" class="w-full text-right text-[9px] text-primary-600 font-medium dark:text-primary-300" @click="revertTexture(selectedTexture.id)">
                Revert texture
              </button>
            </div>
          </div>

          <div v-if="currentReplacement" class="flex items-start gap-2 border border-neutral-200/80 rounded-xl bg-white/70 p-2 dark:border-neutral-800 dark:bg-neutral-900/40">
            <div :class="[currentReplacement.source === 'generated' ? 'i-solar:magic-stick-3-bold-duotone' : 'i-solar:document-add-bold-duotone', 'mt-0.5 shrink-0 text-sm text-primary-500']" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-[10px] text-neutral-700 font-medium dark:text-neutral-200">
                {{ currentReplacement.source === 'generated' ? 'Generated replacement' : (currentReplacement.fileName || 'Uploaded replacement') }}
              </div>
              <div :class="['flex items-center gap-1 text-[9px]', currentPreviewing ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400']">
                <div :class="currentPreviewing ? 'i-solar:check-circle-bold' : 'i-solar:eye-closed-bold'" />
                {{ currentPreviewing ? 'Loaded in preview' : 'Saved · preview off' }}
              </div>
            </div>
          </div>

          <div v-if="uploadNotice" class="space-y-1">
            <div v-if="uploadNotice.dimension" class="flex items-start gap-1.5 text-[9px] text-amber-600 dark:text-amber-300">
              <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0" /><span>{{ uploadNotice.dimension }}</span>
            </div>
            <div v-if="uploadNotice.transparency" class="flex items-start gap-1.5 text-[9px] text-amber-600 dark:text-amber-300">
              <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0" /><span>{{ uploadNotice.transparency }}</span>
            </div>
            <div v-if="uploadNotice.format" class="flex items-start gap-1.5 text-[9px] text-neutral-400">
              <div class="i-solar:info-circle-bold mt-0.5 shrink-0" /><span>{{ uploadNotice.format }}</span>
            </div>
          </div>

          <details v-if="hasMaterialControls" class="group border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
            <summary class="flex cursor-pointer select-none items-center justify-between text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">
              <span class="flex items-center gap-1.5"><div class="i-solar:tuning-2-bold-duotone text-sm text-primary-500" /> Material adjustments</span>
              <div class="i-solar:alt-arrow-down-bold transition-transform group-open:rotate-180" />
            </summary>
            <div class="pt-3 space-y-3">
              <div v-for="control in selectedMaterialControls" :key="control.id" class="space-y-1.5">
                <div v-if="control.kind === 'range'" class="flex justify-between px-1 text-[10px] text-neutral-500 font-bold uppercase dark:text-neutral-400">
                  <span>{{ control.label }}</span>
                  <span class="text-primary-600 font-mono dark:text-primary-300">{{ Number(control.value).toFixed(2) }}</span>
                </div>
                <input
                  v-if="control.kind === 'range'"
                  type="range"
                  :min="control.min"
                  :max="control.max"
                  :step="control.step"
                  :value="control.value"
                  class="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-primary-600 dark:bg-neutral-700"
                  @input="updateMaterialControl(control, Number(($event.target as HTMLInputElement).value))"
                >
                <div v-else class="flex items-center justify-between border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
                  <span class="text-[10px] text-neutral-500 font-bold uppercase dark:text-neutral-400">{{ control.label }}</span>
                  <button type="button" :class="['relative inline-flex h-5 w-9 items-center rounded-full', control.value ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700']" @click="updateMaterialControl(control, !control.value)">
                    <span :class="['inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', control.value ? 'translate-x-4' : 'translate-x-0.5']" />
                  </button>
                </div>
              </div>
            </div>
          </details>

          <div v-if="selectedTexture.owners.length > 1" class="flex items-start gap-1.5 text-[10px] text-amber-600 dark:text-amber-300">
            <div class="i-solar:info-circle-bold mt-0.5 shrink-0" />
            <span>Shared texture · Changes affect all {{ selectedTexture.owners.length }} {{ ownerNounFor(selectedTexture.owners.length) }}.</span>
          </div>

          <div v-if="isGenerating" class="flex items-start gap-2 border border-primary-500/20 rounded-xl bg-primary-500/5 p-2">
            <div class="i-solar:spinner-bold mt-0.5 shrink-0 animate-spin text-primary-500" />
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex justify-between gap-2 text-[9px] text-neutral-500 dark:text-neutral-400">
                <span class="truncate">Generating {{ generationTargetName || 'texture' }}…</span>
                <span class="shrink-0 font-mono">{{ generationProgress }}%</span>
              </div>
              <div class="text-[8px] text-neutral-400">
                {{ generationActionLabel || 'Working…' }}
              </div>
              <div class="h-1 w-full overflow-hidden rounded-full bg-primary-500/20">
                <div class="h-full rounded-full bg-primary-500" :style="{ width: `${generationProgress}%` }" />
              </div>
            </div>
          </div>
          <div v-if="generationError" class="text-[10px] text-rose-600 dark:text-rose-300">
            {{ generationError }}
          </div>
          <div v-if="actionError" class="text-[10px] text-rose-600 dark:text-rose-300">
            {{ actionError }}
          </div>
          <div v-if="selectedTexture.kind !== 'Main'" class="rounded-lg bg-amber-500/10 p-2 text-[9px] text-amber-700 dark:text-amber-300">
            This is a {{ selectedTexture.kind }} map. Upload a matching {{ selectedTexture.kind.toLowerCase() }} texture here.
          </div>

          <div class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 text-[10px] font-semibold dark:bg-neutral-800">
            <button type="button" :class="['flex items-center justify-center gap-1.5 border border-transparent rounded-lg py-2', labMode === 'local' ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200' : 'text-neutral-500']" @click="selectMode('local')">
              <div class="i-solar:upload-minimalistic-bold" /> Local editing
            </button>
            <button type="button" :class="['flex items-center justify-center gap-1.5 border border-transparent rounded-lg py-2', labMode === 'prompt' ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200' : 'text-neutral-500']" @click="selectMode('prompt')">
              <div class="i-solar:magic-stick-3-bold-duotone" /> Promptcraft
            </button>
          </div>

          <div v-if="labMode === 'local'" class="space-y-3">
            <div class="space-y-1">
              <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-100">
                Edit in your own image editor
              </div>
              <p class="text-[10px] text-neutral-500 dark:text-neutral-400">
                Download the texture, make your changes, then upload the edited file.
              </p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <Button variant="secondary" class="w-full" :disabled="!selectedTexture.previewUrl" @click="downloadOriginal">
                <template #icon>
                  <div class="i-solar:download-minimalistic-bold" />
                </template>
                Download texture
              </Button>
              <Button variant="primary" class="w-full" @click="triggerManualUpload">
                <template #icon>
                  <div class="i-solar:upload-minimalistic-bold" />
                </template>
                Upload PNG
              </Button>
            </div>
            <button
              type="button"
              class="w-full border rounded-xl border-dashed p-3 text-left"
              :class="isDragOver ? 'border-primary-500 bg-primary-500/5' : 'border-neutral-300 dark:border-neutral-700'"
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
                    {{ uploadFormatHint }}
                  </div>
                  <div class="text-[8px] text-neutral-400">
                    Keep the original dimensions and transparent areas.
                  </div>
                </div>
              </div>
            </button>
            <p v-if="uploadError" class="text-[9px] text-rose-600 dark:text-rose-300">
              {{ uploadError }}
            </p>
            <input ref="textureUploader" type="file" :accept="acceptedUploadTypes" class="hidden" @change="handleManualUpload">
          </div>

          <div v-else class="space-y-3">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Style presets</span>
                <select v-model="selectedCategory" class="max-w-[170px] border border-neutral-200 rounded-lg bg-white px-2 py-1 text-[10px] dark:border-neutral-700 dark:bg-neutral-900">
                  <option :value="null">
                    Preset Palette
                  </option>
                  <option v-for="group in ARTISTRY_PRESET_GROUPS" :key="group.id" :value="group.id">
                    {{ group.label }}
                  </option>
                </select>
              </div>
              <div v-if="activePresets.length" class="grid grid-cols-2 gap-1.5">
                <button v-for="preset in visiblePresets" :key="preset.id" type="button" class="flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-white/70 px-2 py-1.5 text-left text-[10px] dark:border-neutral-700 dark:bg-neutral-900/40" @click="injectPreset(preset.text)">
                  <div :class="[preset.icon, 'shrink-0 text-sm text-primary-500']" />
                  <span class="truncate">{{ preset.label }}</span>
                </button>
              </div>
              <button v-if="activePresets.length > 4" type="button" class="w-full text-right text-[10px] text-primary-600 dark:text-primary-300" @click="showAllPresets = !showAllPresets">
                {{ showAllPresets ? 'Fewer presets...' : 'More presets...' }}
              </button>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Describe the replacement</label>
              <textarea v-model="aiPrompt" maxlength="500" rows="4" placeholder="Midnight navy fabric with delicate gold celestial embroidery. Keep the existing UV layout, seams, and transparent areas." class="w-full resize-none border border-neutral-200 rounded-xl bg-white px-3 py-2 text-[11px] dark:border-neutral-700 dark:bg-neutral-900" />
              <div class="flex justify-between text-[9px] text-neutral-400">
                <span>Presets fill the prompt—you can edit it.</span><span>{{ aiPrompt.length }}/500</span>
              </div>
              <p class="text-[8px] text-neutral-400">
                UV layout, seams, and transparency guidance is added at generation time.
              </p>
            </div>
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span class="flex items-center gap-1"><div class="i-solar:settings-bold-duotone" /> Uses your configured image provider</span>
              <button type="button" class="rounded p-0.5" title="Configure image provider" @click="showAiSettings = !showAiSettings">
                <div class="i-solar:settings-bold-duotone text-sm" />
              </button>
            </div>
            <div v-if="showAiSettings" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-3 space-y-3">
              <div class="grid grid-cols-3 gap-1">
                <button v-for="provider in availableProviders" :key="provider.id" type="button" :class="['flex flex-col items-center gap-1 border rounded-lg p-2 text-[8px] font-bold uppercase', artistryStore.activeProvider === provider.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 dark:bg-white/5']" @click="artistryStore.activeProvider = provider.id as any">
                  <div :class="[provider.icon, 'text-sm']" />{{ provider.name }}
                </button>
              </div>
              <div v-if="artistryStore.activeProvider === 'nanobanana'" class="space-y-1">
                <select v-model="artistryStore.nanobananaModel" class="w-full border rounded-md bg-white p-1 text-[8px] dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="gemini-3.1-flash-image-preview">
                    Nano Banana 2
                  </option>
                  <option value="gemini-3-pro-image-preview">
                    Nano Banana Pro
                  </option>
                  <option value="gemini-2.5-flash-image">
                    Nano Banana
                  </option>
                </select>
                <select v-model="artistryStore.nanobananaResolution" class="w-full border rounded-md bg-white p-1 text-[8px] dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="1K">
                    1,024
                  </option><option value="2K">
                    2,048
                  </option><option value="4K">
                    4,096
                  </option>
                </select>
              </div>
              <div v-else-if="artistryStore.activeProvider === 'replicate'" class="space-y-1">
                <select v-model="selectedReplicatePreset" class="w-full border rounded-md bg-white p-1 text-[8px] dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="">
                    Manual Config
                  </option>
                  <option v-for="preset in REPLICATE_IMAGEEDIT_PRESETS" :key="preset.id" :value="preset.id">
                    {{ preset.label }}
                  </option>
                </select>
                <input v-model="aiReplicateModelId" placeholder="owner/model-name..." class="w-full border rounded-md bg-white p-2 text-[10px] dark:border-neutral-700 dark:bg-neutral-900">
                <textarea v-model="aiReplicateParams" class="h-16 w-full resize-none border rounded-md p-2 text-[8px] font-mono dark:border-neutral-700 dark:bg-neutral-900" />
              </div>
              <div v-else-if="artistryStore.activeProvider === 'comfyui'" class="space-y-1">
                <select v-model="artistryStore.comfyuiActiveWorkflow" class="w-full border rounded-md bg-white p-1 text-[8px] dark:border-neutral-700 dark:bg-neutral-900">
                  <option value="">
                    Default Bridge
                  </option>
                  <option v-for="workflow in artistryStore.comfyuiSavedWorkflows" :key="workflow.id" :value="workflow.id">
                    {{ workflow.name }}
                  </option>
                </select>
                <textarea v-model="aiComfyParams" class="h-16 w-full resize-none border rounded-md p-2 text-[8px] font-mono dark:border-neutral-700 dark:bg-neutral-900" />
              </div>
            </div>
            <Button variant="primary" class="w-full" :disabled="!aiPrompt || isGenerating" @click="generateReplacement">
              <template #icon>
                <div :class="[isGenerating ? 'i-solar:spinner-bold animate-spin' : 'i-solar:magic-stick-3-bold-duotone']" />
              </template>
              {{ isGenerating ? (generationActionLabel || 'Generating...') : 'Generate replacement' }}
            </Button>
          </div>
        </template>
        <div v-else class="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <div class="i-solar:gallery-bold-duotone text-2xl text-neutral-400" />
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Select a texture in the Textures tab to open it in the Lab.
          </p>
          <button type="button" class="text-[10px] text-primary-600 dark:text-primary-300" @click="activeTab = 'texture'">
            Go to Textures
          </button>
        </div>
      </div>

      <div v-else-if="activeTab === 'tree' && adapter.capabilities.parts" class="flex flex-col gap-2 p-1">
        <div class="flex items-center gap-2">
          <input v-model="nodeFilter" placeholder="Find a part..." class="min-w-0 flex-1 border border-neutral-200 rounded-xl bg-white px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <button type="button" class="text-xs text-primary-600 dark:text-primary-300" @click="showAllParts">
            Show all
          </button>
          <button type="button" class="text-xs text-primary-600 dark:text-primary-300" @click="hideAllParts">
            Hide all
          </button>
        </div>
        <div class="space-y-1">
          <div
            v-for="part in filteredParts"
            :key="part.id"
            class="flex cursor-pointer items-center justify-between border border-transparent rounded-lg p-2 text-xs hover:bg-neutral-100 dark:hover:bg-white/5"
            :class="selectedPartId === part.id ? 'border-primary-400/40 bg-primary-500/5' : ''"
            @click="selectPart(part, $event)"
          >
            <div class="min-w-0 flex items-center gap-2">
              <div :class="part.kind === 'Mesh' ? 'i-solar:box-bold-duotone text-sky-500' : 'i-solar:user-bold-duotone text-purple-500'" />
              <span class="truncate">{{ part.name }}</span>
            </div>
            <button type="button" class="rounded p-1 hover:bg-neutral-200 dark:hover:bg-white/10" @click.stop="togglePart(part)">
              <div :class="part.visible ? 'i-solar:eye-bold-duotone text-primary-500' : 'i-solar:eye-closed-bold-duotone text-neutral-400'" />
            </button>
          </div>
          <div v-if="filteredParts.length === 0" class="px-2 py-6 text-center text-xs text-neutral-400">
            No parts found.
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-neutral-200/70 pt-3 dark:border-neutral-800">
      <div class="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" class="w-full" @click="resetAll">
          Reset changes
        </Button>
        <Button variant="primary" size="sm" class="w-full" :disabled="!canExport || isExporting" @click="downloadExport">
          <template #icon>
            <div :class="[isExporting ? 'i-solar:spinner-bold animate-spin' : 'i-solar:download-minimalistic-bold']" />
          </template>
          {{ isExporting ? 'Packaging...' : (adapter.kind === 'vrm' ? 'Export modified VRM' : 'Download modified ZIP') }}
        </Button>
      </div>
      <p v-if="exportDisabledReason" class="px-1 text-[9px] text-amber-600 dark:text-amber-300">
        {{ exportDisabledReason }}
      </p>
    </div>

    <div v-if="isEraserOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-10">
      <div class="max-h-full max-w-2xl w-full border border-white/10 rounded-3xl bg-neutral-900/50 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <div class="text-sm text-white font-black tracking-widest uppercase">
            Surgical Eraser
          </div>
          <button type="button" class="text-neutral-400" @click="isEraserOpen = false">
            <div class="i-solar:close-circle-bold-duotone text-2xl" />
          </button>
        </div>
        <div class="texture-checker relative aspect-square overflow-hidden rounded-2xl">
          <canvas ref="eraserCanvas" class="h-full w-full cursor-crosshair object-contain" @click="handleEraserClick" />
        </div>
        <div class="space-y-2">
          <div class="flex justify-between text-[10px] text-neutral-300 font-bold uppercase">
            <span>Tolerance</span><span>{{ eraserTolerance }}</span>
          </div>
          <input v-model="eraserTolerance" type="range" min="1" max="100" step="1" class="h-1.5 w-full" @input="applyEraserPurge">
        </div>
        <div class="grid grid-cols-2 gap-3">
          <Button variant="secondary" @click="isEraserOpen = false">
            Abort
          </Button>
          <Button variant="primary" @click="finalizeEraser">
            Apply & Bake
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
.texture-checker {
  background-color: #f5f5f5;
  background-image:
    linear-gradient(45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(-45deg, #e5e5e5 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e5e5e5 75%),
    linear-gradient(-45deg, transparent 75%, #e5e5e5 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}
:global(.dark) .texture-checker {
  background-color: #1a1a1a;
  background-image:
    linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
}
</style>
