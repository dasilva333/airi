<script setup lang="ts">
import { GaussianSplatViewer } from '@proj-airi/stage-ui-three'
import { useSplatFigurineStore } from '@proj-airi/stage-ui/stores/modules/splat-figurine'
import { useStickersStore } from '@proj-airi/stage-ui/stores/stickers'
import { onBeforeUnmount, ref } from 'vue'

const figurineStore = useSplatFigurineStore()
const stickersStore = useStickersStore()

// State: Upload & Cutout
const fileInputRef = ref<HTMLInputElement | null>(null)
const rawImageFile = ref<File | null>(null)
const rawImageUrl = ref<string | null>(null)
const cutoutBlob = ref<Blob | null>(null)
const cutoutUrl = ref<string | null>(null)
const isSegmenting = ref(false)
const segmentingStatus = ref('')
const cachedMaskData = ref<Uint8Array | null>(null)
const cachedSourceImageData = ref<ImageData | null>(null)

// State: 3D Synthesis
const isGenerating = ref(false)
const generationElapsed = ref(0)
const generationPhase = ref('')
const activeSplatBlob = ref<Blob | null>(null)
const activeSplatUrl = ref<string | null>(null)
const activeSplatName = ref('')
const activeSplatCount = ref(0)
let timerInterval: any = null

// Viewport & Settings
const selectedQuality = ref<number>(figurineStore.defaultQualityTier)
const selectedMode = ref<'synthetic' | 'real'>(figurineStore.defaultGenerationMode)
const activeTab = ref<'generate' | 'library'>('generate')

const qualityOptions = [
  { value: 32768, label: '32k Splats', badge: 'Fast · ~30s', desc: 'Ideal for quick testing' },
  { value: 65536, label: '65k Splats', badge: 'Balanced · ~60s', desc: 'Default · Crisp contours' },
  { value: 262144, label: '262k Splats', badge: 'Ultra · ~120s', desc: 'Highest detail geometry' },
]

// Handle File Selection
async function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  await processInputFile(file)
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    await processInputFile(file)
  }
}

async function processInputFile(file: File) {
  rawImageFile.value = file
  activeSplatName.value = file.name.replace(/\.[^/.]+$/, '')

  if (rawImageUrl.value)
    URL.revokeObjectURL(rawImageUrl.value)
  rawImageUrl.value = URL.createObjectURL(file)

  if (figurineStore.useIsNetPreClean) {
    await runIsNetCutout(file)
  }
  else {
    cutoutBlob.value = file
    if (cutoutUrl.value)
      URL.revokeObjectURL(cutoutUrl.value)
    cutoutUrl.value = rawImageUrl.value
  }
}

// Run IS-Net Anime Segmentation
async function runIsNetCutout(blobOrFile: Blob) {
  isSegmenting.value = true
  segmentingStatus.value = 'Loading IS-Net Anime WebGPU model...'

  try {
    const result = await stickersStore.removeImageBackground(blobOrFile, {
      sensitivity: figurineStore.isNetSensitivity,
      onProgress: (status) => {
        segmentingStatus.value = `IS-Net: ${status}...`
      },
    })

    cachedMaskData.value = result.maskData ?? null
    cachedSourceImageData.value = result.sourceImageData ?? null
    cutoutBlob.value = result

    if (cutoutUrl.value && cutoutUrl.value !== rawImageUrl.value)
      URL.revokeObjectURL(cutoutUrl.value)
    cutoutUrl.value = URL.createObjectURL(result)
  }
  catch (err) {
    console.error('[IDOL 3DGS] IS-Net segmentation error:', err)
    // Fallback to raw image if WebGPU not available
    cutoutBlob.value = blobOrFile
    cutoutUrl.value = rawImageUrl.value
  }
  finally {
    isSegmenting.value = false
  }
}

// Recompute sensitivity on slider change
async function handleSensitivityChange(newSensitivity: number) {
  figurineStore.isNetSensitivity = newSensitivity
  if (!cachedSourceImageData.value || !cachedMaskData.value)
    return

  try {
    const updated = await stickersStore.recomputeCutoutBlob(
      cachedSourceImageData.value,
      cachedMaskData.value,
      newSensitivity,
    )
    cutoutBlob.value = updated
    if (cutoutUrl.value && cutoutUrl.value !== rawImageUrl.value)
      URL.revokeObjectURL(cutoutUrl.value)
    cutoutUrl.value = URL.createObjectURL(updated)
  }
  catch (err) {
    console.warn('[IDOL 3DGS] Sensitivity recompute error:', err)
  }
}

// Trigger IDOL Generation on Windows host
async function generateSplat() {
  const sourceToUpload = cutoutBlob.value || rawImageFile.value
  if (!sourceToUpload)
    return

  isGenerating.value = true
  generationElapsed.value = 0
  generationPhase.value = 'Preparing preprocessed silhouette...'

  const startTime = Date.now()
  timerInterval = setInterval(() => {
    generationElapsed.value = Math.floor((Date.now() - startTime) / 1000)
  }, 500)

  try {
    const formData = new FormData()
    formData.append('image', sourceToUpload, 'cutout.png')
    formData.append('mode', selectedMode.value)
    formData.append('num_gaussians', selectedQuality.value.toString())
    formData.append('steps', '50')
    formData.append('cfg_strength', '3.0')
    formData.append('rescale_t', '3.0')

    generationPhase.value = 'Sampling diffusion on NVIDIA RTX 4070 (~30-60s)...'

    const endpoint = figurineStore.serviceEndpoint.replace(/\/+$/, '')
    const res = await fetch(`${endpoint}/generate`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Generation failed: ${errText || res.statusText}`)
    }

    generationPhase.value = 'Fetching generated 3D Gaussian Splat (.ply)...'
    const result = await res.json()

    // Download the resulting .ply file into memory
    const plyRes = await fetch(`${endpoint}${result.ply_url}`)
    const plyBlob = await plyRes.blob()

    activeSplatBlob.value = plyBlob
    if (activeSplatUrl.value)
      URL.revokeObjectURL(activeSplatUrl.value)
    activeSplatUrl.value = URL.createObjectURL(plyBlob)

    // Save to library automatically
    await figurineStore.saveFigurine({
      name: activeSplatName.value || `Figurine ${result.asset_id}`,
      plyBlob,
      numGaussians: result.num_gaussians || selectedQuality.value,
      previewUrl: cutoutUrl.value || undefined,
    })
  }
  catch (err: any) {
    console.error('[IDOL 3DGS] Generation failed:', err)
    alert(`Failed to synthesize 3D Splat: ${err.message}`)
  }
  finally {
    isGenerating.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }
}

// Load saved figurine from shelf
async function selectLibraryFigurine(id: string, name: string) {
  const blob = await figurineStore.loadFigurineBlob(id)
  if (!blob)
    return

  activeSplatName.value = name
  activeSplatBlob.value = blob
  if (activeSplatUrl.value)
    URL.revokeObjectURL(activeSplatUrl.value)
  activeSplatUrl.value = URL.createObjectURL(blob)
  activeTab.value = 'generate'
}

function downloadActivePly() {
  if (!activeSplatBlob.value)
    return

  const a = document.createElement('a')
  a.href = URL.createObjectURL(activeSplatBlob.value)
  a.download = `${activeSplatName.value || 'figurine'}_splats.ply`
  a.click()
  URL.revokeObjectURL(a.href)
}

onBeforeUnmount(() => {
  if (timerInterval)
    clearInterval(timerInterval)
  if (rawImageUrl.value)
    URL.revokeObjectURL(rawImageUrl.value)
  if (cutoutUrl.value && cutoutUrl.value !== rawImageUrl.value)
    URL.revokeObjectURL(cutoutUrl.value)
  if (activeSplatUrl.value)
    URL.revokeObjectURL(activeSplatUrl.value)
})
</script>

<template>
  <div class="flex flex-col gap-6 pb-12 font-normal">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="flex items-center gap-2 text-lg text-neutral-800 font-bold md:text-2xl dark:text-neutral-100">
          <div class="i-solar:box-minimalistic-bold-duotone text-primary-500" />
          3D Gaussian Splats (IDOL)
        </h2>
        <p class="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Synthesize high-fidelity 3D Gaussian Splat desk figurines from 2D images with local WebGPU IS-Net background segmentation.
        </p>
      </div>

      <!-- Service Health Pill -->
      <div class="shadow-xs flex items-center gap-2 border border-neutral-200 rounded-full bg-white px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
        <span
          class="size-2 rounded-full"
          :class="figurineStore.serviceStatus === 'online' ? 'bg-emerald-500 animate-pulse' : figurineStore.serviceStatus === 'checking' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'"
        />
        <span class="text-xs font-medium">
          {{ figurineStore.serviceStatus === 'online' ? figurineStore.gpuDeviceName : figurineStore.serviceStatus === 'checking' ? 'Connecting...' : 'Companion Offline' }}
        </span>
        <button
          class="text-xs text-primary-500 hover:underline"
          :disabled="figurineStore.serviceStatus === 'checking'"
          @click="figurineStore.checkServiceHealth()"
        >
          Check
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex gap-4 border-b border-neutral-200 dark:border-neutral-800">
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'generate' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
        @click="activeTab = 'generate'"
      >
        <span class="flex items-center gap-1.5">
          <div class="i-solar:magic-stick-3-bold-duotone" />
          Synthesis Studio
        </span>
      </button>
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="activeTab === 'library' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
        @click="activeTab = 'library'"
      >
        <span class="flex items-center gap-1.5">
          <div class="i-solar:shelf-minimalistic-bold-duotone" />
          Figurine Shelf ({{ figurineStore.savedFigurines.length }})
        </span>
      </button>
    </div>

    <!-- TAB 1: Synthesis Studio -->
    <div v-if="activeTab === 'generate'" class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <!-- Left Column: Controls & Upload (5 cols) -->
      <div class="flex flex-col gap-6 lg:col-span-5">
        <!-- Service Endpoint Settings Card -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-600 font-semibold tracking-wider uppercase dark:text-neutral-400">
              Host Companion Endpoint
            </span>
            <span v-if="figurineStore.vramAllocatedMb" class="text-[10px] text-neutral-400 font-mono">
              VRAM: {{ figurineStore.vramAllocatedMb }} MB
            </span>
          </div>
          <div class="flex gap-2">
            <input
              v-model="figurineStore.serviceEndpoint"
              type="text"
              placeholder="http://10.0.0.91:8189"
              class="w-full border border-neutral-200 rounded-xl bg-neutral-50 px-3 py-1.5 text-xs font-mono dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
            >
            <button
              type="button"
              class="border border-neutral-200 rounded-xl bg-white px-3 py-1.5 text-xs text-neutral-700 font-medium transition-colors dark:border-neutral-800 dark:bg-neutral-800 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
              @click="figurineStore.checkServiceHealth()"
            >
              Ping
            </button>
          </div>
        </div>

        <!-- Step 1: Image Dropzone & IS-Net Segmentation -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
              1. Source Image & Cutout
            </span>
            <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500">
              <input
                v-model="figurineStore.useIsNetPreClean"
                type="checkbox"
                class="accent-primary-500"
              >
              IS-Net Anime
            </label>
          </div>

          <!-- Drop Area -->
          <div
            class="relative flex flex-col cursor-pointer items-center justify-center border-2 border-neutral-300 rounded-xl border-dashed p-4 transition-colors dark:border-neutral-700 hover:border-primary-500 hover:bg-primary-500/5"
            @dragover.prevent
            @drop="handleDrop"
            @click="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
            >

            <div v-if="!rawImageUrl" class="py-6 text-center">
              <div class="i-solar:gallery-add-bold-duotone mx-auto text-3xl text-neutral-400" />
              <p class="mt-2 text-xs text-neutral-600 font-medium dark:text-neutral-300">
                Click or drag character image
              </p>
              <p class="mt-1 text-[11px] text-neutral-400">
                PNG, JPG, or WebP with character subject
              </p>
            </div>

            <!-- Preview Mode -->
            <div v-else class="w-full flex items-center justify-around gap-2">
              <div class="flex flex-col items-center">
                <span class="mb-1 text-[10px] text-neutral-400">Original</span>
                <img :src="rawImageUrl" class="max-h-28 max-w-28 rounded-lg object-contain">
              </div>

              <div class="i-solar:arrow-right-bold text-neutral-400" />

              <div class="flex flex-col items-center">
                <span class="mb-1 text-[10px] text-neutral-400">Clean Cutout</span>
                <div class="[background-size:8px_8px] relative max-h-28 max-w-28 flex items-center justify-center rounded-lg bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)]">
                  <img v-if="cutoutUrl" :src="cutoutUrl" class="max-h-28 max-w-28 object-contain">
                  <div v-if="isSegmenting" class="backdrop-blur-xs absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <div class="size-5 animate-spin border-2 border-white border-t-transparent rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- IS-Net Sensitivity Slider -->
          <div v-if="figurineStore.useIsNetPreClean && cutoutBlob" class="pt-1 space-y-1.5">
            <div class="flex justify-between text-[11px] text-neutral-500">
              <span>Mask Sensitivity: {{ figurineStore.isNetSensitivity }}%</span>
              <span>Clean (0%) · Default (65%) · Keep (100%)</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              :value="figurineStore.isNetSensitivity"
              class="w-full accent-primary-500"
              @input="handleSensitivityChange(Number(($event.target as HTMLInputElement).value))"
            >
          </div>
        </div>

        <!-- Step 2: Quality & Mode Selection -->
        <div class="border border-neutral-200 rounded-2xl bg-white p-5 space-y-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
            2. Synthesis Parameters
          </span>

          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="opt in qualityOptions"
              :key="opt.value"
              :class="[
                'cursor-pointer rounded-xl border p-2.5 text-center transition-all',
                selectedQuality === opt.value
                  ? 'border-primary-500 bg-primary-500/10 font-bold text-primary-600 dark:text-primary-400'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 hover:border-neutral-300',
              ]"
              @click="selectedQuality = opt.value"
            >
              <div class="text-xs">
                {{ opt.label }}
              </div>
              <div class="mt-0.5 text-[10px] text-neutral-400">
                {{ opt.badge }}
              </div>
            </div>
          </div>

          <button
            type="button"
            class="shadow-xs w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-xs text-white font-semibold transition-colors disabled:cursor-not-allowed hover:bg-primary-500 disabled:opacity-50"
            :disabled="!rawImageFile || isGenerating || isSegmenting || figurineStore.serviceStatus !== 'online'"
            @click="generateSplat"
          >
            <span v-if="isGenerating" class="flex items-center gap-2">
              <div class="size-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
              {{ generationPhase }} ({{ generationElapsed }}s)
            </span>
            <span v-else class="flex items-center gap-1.5">
              <div class="i-solar:magic-stick-3-bold" />
              Synthesize 3D Gaussian Figurine
            </span>
          </button>
        </div>
      </div>

      <!-- Right Column: Interactive 3D Viewport (7 cols) -->
      <div class="flex flex-col lg:col-span-7">
        <div class="relative h-[560px] w-full flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-neutral-950 dark:border-neutral-800">
          <!-- 3D Splat Canvas -->
          <div v-if="activeSplatUrl" class="h-full w-full">
            <GaussianSplatViewer
              :src="activeSplatUrl"
              @loaded="activeSplatCount = $event"
            />
          </div>

          <!-- Empty State -->
          <div v-else class="h-full flex flex-col items-center justify-center p-6 text-center text-neutral-500">
            <div class="i-solar:box-minimalistic-bold-duotone text-6xl text-neutral-700" />
            <p class="mt-4 text-sm font-medium">
              3D Gaussian Splatting Viewport
            </p>
            <p class="mt-1 max-w-xs text-xs text-neutral-600">
              Upload an image or pick a figurine from your shelf to inspect the 3D model in interactive 60 FPS WebGL.
            </p>
          </div>

          <!-- Top Viewport Overlay HUD -->
          <div v-if="activeSplatUrl" class="absolute left-3 top-3 z-10 flex items-center gap-2 border border-white/10 rounded-xl bg-neutral-900/80 px-3 py-1.5 text-xs text-white backdrop-blur-md">
            <div class="i-solar:sparkles-bold text-amber-400" />
            <span>{{ activeSplatName || 'Figurine' }}</span>
            <span class="rounded-full bg-primary-500/20 px-1.5 py-0.5 text-[10px] text-primary-400 font-mono">
              {{ activeSplatCount || selectedQuality }} Splats
            </span>
          </div>

          <!-- Controls Guide Overlay -->
          <div class="absolute bottom-3 left-3 z-10 border border-white/10 rounded-xl bg-neutral-900/70 px-3 py-1.5 text-[11px] text-neutral-400 backdrop-blur-md hidden md:block">
            🖱️ Orbit: Left-drag · Pan: Right-drag · Zoom: Scroll
          </div>

          <!-- Download Action Overlay -->
          <div v-if="activeSplatUrl" class="absolute bottom-3 right-3 z-10 flex gap-2">
            <button
              class="flex items-center gap-1.5 border border-white/10 rounded-xl bg-neutral-900/80 px-3 py-1.5 text-xs text-white backdrop-blur-md hover:bg-neutral-800"
              @click="downloadActivePly"
            >
              <div class="i-solar:download-minimalistic-bold" />
              Download .ply
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Persistent Figurine Shelf -->
    <div v-else-if="activeTab === 'library'" class="space-y-4">
      <div v-if="figurineStore.savedFigurines.length === 0" class="border border-neutral-200 rounded-2xl bg-white p-12 text-center text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="i-solar:shelf-minimalistic-bold-duotone mx-auto text-5xl text-neutral-300 dark:text-neutral-700" />
        <p class="mt-3 text-sm font-medium">
          Your Figurine Shelf is Empty
        </p>
        <p class="mt-1 text-xs">
          Synthesize 3D figurines from your character images to store them in your local collection.
        </p>
      </div>

      <div v-else class="grid grid-cols-2 gap-4 lg:grid-cols-5 md:grid-cols-4">
        <div
          v-for="item in figurineStore.savedFigurines"
          :key="item.id"
          class="group relative flex flex-col cursor-pointer overflow-hidden border border-neutral-200 rounded-2xl bg-white transition-all dark:border-neutral-800 hover:border-primary-500 dark:bg-neutral-900/40"
          @click="selectLibraryFigurine(item.id, item.name)"
        >
          <div class="h-36 w-full flex items-center justify-center bg-neutral-950 p-2">
            <img
              v-if="item.previewUrl"
              :src="item.previewUrl"
              class="h-full w-full object-contain"
            >
            <div v-else class="i-solar:box-minimalistic-bold-duotone text-4xl text-neutral-700" />
          </div>

          <div class="p-3">
            <div class="truncate text-xs font-bold">
              {{ item.name }}
            </div>
            <div class="mt-1 flex items-center justify-between text-[10px] text-neutral-400">
              <span>{{ (item.numGaussians / 1000).toFixed(0) }}k Splats</span>
              <span>{{ new Date(item.createdAt).toLocaleDateString() }}</span>
            </div>
          </div>

          <!-- Delete Action -->
          <button
            class="absolute right-2 top-2 size-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
            @click.stop="figurineStore.deleteFigurine(item.id)"
          >
            <div class="i-solar:trash-bin-trash-bold text-xs" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
