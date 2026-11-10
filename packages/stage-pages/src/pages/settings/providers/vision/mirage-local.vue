<script setup lang="ts">
import type { MirageAnalysisResult, MirageBoundingBox } from '@proj-airi/stage-ui/libs/inference'
import type { RemovableRef } from '@vueuse/core'

import {
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import {
  clearMirageCache,
  formatBytes,
  getMirageCacheSize,
  getMirageClient,
  isMirageModelCached,

} from '@proj-airi/stage-ui/libs/inference'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

const providerId = 'mirage-local'
const { t } = useI18n()

const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const defaultModel = 'mirage-base'

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

const isEnabled = computed(() => !!providers.value[providerId]?.enabled)

function toggleProvider() {
  if (!providers.value[providerId])
    providers.value[providerId] = {}
  providers.value[providerId].enabled = !isEnabled.value
  if (providers.value[providerId].enabled) {
    providers.value[providerId].model = model.value
  }
}

// ---------------------------------------------------------------------------
// Cache Management State
// ---------------------------------------------------------------------------
const isDownloading = ref(false)
const loadingProgress = ref(0)
const isModelCachedState = ref(false)
const cacheSizeBytes = ref(0)
const isModelResident = ref(false)

async function checkModelStatus() {
  try {
    const client = getMirageClient()
    isModelResident.value = client.isReady()
    isModelCachedState.value = await isMirageModelCached()
    cacheSizeBytes.value = await getMirageCacheSize()
  }
  catch {
    isModelResident.value = false
    isModelCachedState.value = false
  }
}

async function downloadModel() {
  if (isDownloading.value)
    return

  isDownloading.value = true
  loadingProgress.value = 0

  try {
    const client = getMirageClient()
    await client.prepare((ratio) => {
      loadingProgress.value = Math.min(100, Math.round(ratio * 100))
    })

    isDownloading.value = false
    isModelResident.value = true
    isModelCachedState.value = true
    loadingProgress.value = 100
    cacheSizeBytes.value = await getMirageCacheSize()
    toast.success('Mirage vision weights downloaded and verified')
  }
  catch (err: any) {
    isDownloading.value = false
    toast.error(`Failed to download Mirage weights: ${err?.message || String(err)}`)
  }
}

async function handleClearCache() {
  try {
    const client = getMirageClient()
    client.terminate()
    await clearMirageCache()
    isModelResident.value = false
    isModelCachedState.value = false
    cacheSizeBytes.value = 0
    loadingProgress.value = 0
    toast.success('Mirage cache purged')
  }
  catch (err: any) {
    toast.error(`Failed to clear cache: ${err?.message || String(err)}`)
  }
}

// ---------------------------------------------------------------------------
// Vision Playground State
// ---------------------------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)
const selectedImageSrc = ref<string | null>(null)
const previewCanvas = ref<HTMLCanvasElement | null>(null)

const detectErrorsOpt = ref(true)
const detectFaceOpt = ref(true)
const locateFocalOpt = ref(true)
const customPrompt = ref('')

const isAnalyzing = ref(false)
const analysisResult = ref<MirageAnalysisResult | null>(null)

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return
  loadImageFile(file)
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files?.[0]
  if (file && file.type.startsWith('image/')) {
    loadImageFile(file)
  }
}

function loadImageFile(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    selectedImageSrc.value = e.target?.result as string
    analysisResult.value = null
    renderPreview()
  }
  reader.readAsDataURL(file)
}

function renderPreview() {
  if (!selectedImageSrc.value)
    return

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = previewCanvas.value
    if (!canvas)
      return
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    canvas.width = img.naturalWidth || 640
    canvas.height = img.naturalHeight || 480
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    // If analysis result exists, draw bounding boxes
    if (analysisResult.value?.boxes && analysisResult.value.boxes.length > 0) {
      drawBoundingBoxes(ctx, canvas.width, canvas.height, analysisResult.value.boxes)
    }
  }
  img.src = selectedImageSrc.value
}

function drawBoundingBoxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  boxes: MirageBoundingBox[],
) {
  boxes.forEach((box, index) => {
    const x = box.left * width
    const y = box.top * height
    const w = (box.right - box.left) * width
    const h = (box.bottom - box.top) * height

    const isFace = box.label === 'face_and_bust'
    const isError = box.label === 'error_modal' || analysisResult.value?.hasError

    // Box stroke
    ctx.lineWidth = 3
    ctx.strokeStyle = isError ? '#ef4444' : (isFace ? '#3b82f6' : '#10b981')
    ctx.strokeRect(x, y, w, h)

    // Semi-transparent overlay fill
    ctx.fillStyle = isError ? 'rgba(239, 68, 68, 0.15)' : (isFace ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)')
    ctx.fillRect(x, y, w, h)

    // Tag badge
    const labelText = `${box.label || `Box #${index + 1}`} (${Math.round((box.confidence || 0.9) * 100)}%)`
    ctx.font = 'bold 12px sans-serif'
    const textWidth = ctx.measureText(labelText).width
    ctx.fillStyle = isError ? '#ef4444' : (isFace ? '#3b82f6' : '#10b981')
    ctx.fillRect(x, Math.max(0, y - 22), textWidth + 12, 22)

    ctx.fillStyle = '#ffffff'
    ctx.fillText(labelText, x + 6, Math.max(16, y - 6))
  })
}

async function runAnalysis() {
  if (!selectedImageSrc.value) {
    toast.error('Please select or drop an image first')
    return
  }

  isAnalyzing.value = true
  try {
    const client = getMirageClient()
    if (!client.isReady()) {
      await client.prepare((ratio) => {
        loadingProgress.value = Math.min(100, Math.round(ratio * 100))
      })
      isModelResident.value = true
      isModelCachedState.value = true
    }

    const result = await client.analyzeFrame(selectedImageSrc.value, {
      detectErrors: detectErrorsOpt.value,
      detectFace: detectFaceOpt.value,
      locateFocalArea: locateFocalOpt.value,
      prompt: customPrompt.value.trim() || undefined,
    })

    analysisResult.value = result
    renderPreview()
    toast.success(`Mirage evaluated frame in ${result.latencyMs}ms`)
  }
  catch (err: any) {
    toast.error(`Mirage evaluation failed: ${err?.message || String(err)}`)
  }
  finally {
    isAnalyzing.value = false
  }
}

watch(selectedImageSrc, () => {
  renderPreview()
})

onMounted(() => {
  checkModelStatus()
})
</script>

<route lang="yaml">
meta:
  layout: settings
</route>

<template>
  <ProviderSettingsLayout
    :provider-id="providerId"
    :title="t('settings.pages.providers.provider.mirage-local.title', 'Cactus Mirage (Local Vision)')"
    :description="t('settings.pages.providers.provider.mirage-local.description', 'Ultra-fast on-device multi-task vision coprocessor (22 MB WASM/CPU). Instant OCR, bounding boxes, and scene understanding.')"
    icon="i-solar:eye-scan-bold-duotone"
  >
    <ProviderSettingsContainer>
      <!-- Basic Provider Toggle -->
      <ProviderBasicSettings
        :enabled="isEnabled"
        :name="providerMetadata?.name || 'Cactus Mirage (Local Vision)'"
        :description="providerMetadata?.description || 'Ultra-fast on-device multi-task vision coprocessor'"
        icon="i-solar:eye-scan-bold-duotone"
        @toggle="toggleProvider"
      />

      <!-- Weight Cache Management Panel -->
      <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="h-10 w-10 flex items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
              <div class="i-solar:disk-bold-duotone h-5 w-5" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                  On-Device Weight Cache
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="isModelCachedState
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'"
                >
                  {{ isModelCachedState ? 'Cached & Ready' : 'Not Cached' }}
                </span>
                <span
                  v-if="cacheSizeBytes > 0"
                  class="rounded bg-neutral-200/60 px-1.5 py-0.5 text-xs text-neutral-600 font-mono dark:bg-neutral-800 dark:text-neutral-400"
                >
                  {{ formatBytes(cacheSizeBytes) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Mirage weights (~22 MB) cached in browser CacheStorage (<code class="text-xs">mirage-cache</code>). Runs on CPU with zero WebGPU or VRAM overhead.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="!isModelCachedState"
              size="sm"
              :disabled="isDownloading"
              @click="downloadModel"
            >
              <div v-if="isDownloading" class="i-solar:restart-bold mr-1 h-3.5 w-3.5 animate-spin" />
              <div v-else class="i-solar:download-bold mr-1 h-3.5 w-3.5" />
              {{ isDownloading ? `Downloading (${loadingProgress}%)` : 'Download & Cache' }}
            </Button>
            <Button
              v-else
              variant="ghost"
              size="sm"
              class="text-red-500 hover:bg-red-500/10 dark:text-red-400 hover:text-red-600"
              @click="handleClearCache"
            >
              <div class="i-solar:trash-bin-trash-bold mr-1 h-3.5 w-3.5" />
              Clear Cache
            </Button>
          </div>
        </div>

        <div v-if="isDownloading" class="mt-4 space-y-1.5">
          <div class="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Fetching Mirage weights from Hugging Face...</span>
            <span class="font-mono">{{ loadingProgress }}%</span>
          </div>
          <Progress :progress="loadingProgress" class="h-1.5" />
        </div>
      </div>

      <!-- Vision Playground -->
      <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="i-solar:gallery-wide-bold-duotone h-5 w-5 text-primary-500" />
            <h3 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
              Mirage Vision Playground
            </h3>
          </div>
          <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 font-mono dark:text-primary-400">
            ~25ms Multi-Task Perception
          </span>
        </div>

        <!-- Hidden File Input -->
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileChange"
        >

        <!-- Dropzone or Canvas Preview -->
        <div
          v-if="!selectedImageSrc"
          class="flex flex-col cursor-pointer items-center justify-center border-2 border-neutral-300 rounded-xl border-dashed p-8 text-center transition-colors dark:border-neutral-700 hover:border-primary-500/50 dark:hover:border-primary-500/50"
          @click="triggerFileInput"
          @dragover.prevent
          @drop="handleDrop"
        >
          <div class="mb-3 h-12 w-12 flex items-center justify-center rounded-full bg-neutral-200/50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            <div class="i-solar:camera-add-bold-duotone h-6 w-6" />
          </div>
          <p class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            Click to upload or drag and drop an image
          </p>
          <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Drop screenshots, terminal logs, UI mockups, or character portraits (PNG, JPG, WebP)
          </p>
        </div>

        <div v-else class="space-y-4">
          <div class="relative flex items-center justify-center overflow-hidden border border-neutral-200 rounded-xl bg-black/5 dark:border-neutral-800 dark:bg-black/30">
            <canvas ref="previewCanvas" class="max-h-96 max-w-full object-contain" />
            <button
              class="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur transition-opacity hover:bg-black/80"
              title="Replace image"
              @click="triggerFileInput"
            >
              <div class="i-solar:refresh-bold h-4 w-4" />
            </button>
          </div>

          <!-- Controls Grid -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label class="flex cursor-pointer items-center gap-2 border border-neutral-200/80 rounded-lg bg-white/60 p-2.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300">
              <input v-model="detectErrorsOpt" type="checkbox" class="rounded text-primary-500">
              <span>Detect Error Modals</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2 border border-neutral-200/80 rounded-lg bg-white/60 p-2.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300">
              <input v-model="detectFaceOpt" type="checkbox" class="rounded text-primary-500">
              <span>Detect Face & Bust</span>
            </label>
            <label class="flex cursor-pointer items-center gap-2 border border-neutral-200/80 rounded-lg bg-white/60 p-2.5 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-300">
              <input v-model="locateFocalOpt" type="checkbox" class="rounded text-primary-500">
              <span>Locate Focal Area</span>
            </label>
          </div>

          <div class="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="primary"
              :disabled="isAnalyzing"
              @click="runAnalysis"
            >
              <div v-if="isAnalyzing" class="i-solar:restart-bold mr-1.5 h-4 w-4 animate-spin" />
              <div v-else class="i-solar:eye-scan-bold-duotone mr-1.5 h-4 w-4" />
              {{ isAnalyzing ? 'Evaluating Frame...' : 'Run Mirage Analysis' }}
            </Button>
            <span v-if="analysisResult" class="text-xs text-neutral-500 font-mono">
              Latency: <span class="text-emerald-500 font-semibold">{{ analysisResult.latencyMs }}ms</span>
            </span>
          </div>

          <!-- Analysis Results Block -->
          <div
            v-if="analysisResult"
            class="border border-neutral-200/80 rounded-lg bg-white/80 p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900/60"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">
                Evaluation Output
              </span>
              <span
                class="rounded px-2 py-0.5 text-xs font-medium"
                :class="analysisResult.hasError
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-emerald-500/10 text-emerald-500'"
              >
                {{ analysisResult.hasError ? 'Error Detected' : 'Normal / Clean' }}
              </span>
            </div>

            <!-- Scene Description -->
            <div v-if="analysisResult.sceneDescription" class="text-xs text-neutral-600 dark:text-neutral-300">
              <span class="text-neutral-900 font-medium dark:text-neutral-100">Summary: </span>
              {{ analysisResult.sceneDescription }}
            </div>

            <!-- OCR Snippet -->
            <div v-if="analysisResult.ocrSnippet" class="space-y-1">
              <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">OCR Extracted Text:</span>
              <pre class="overflow-x-auto rounded bg-neutral-100 p-2 text-xs text-neutral-800 font-mono dark:bg-neutral-800 dark:text-neutral-200">{{ analysisResult.ocrSnippet }}</pre>
            </div>

            <!-- Bounding Boxes Pills -->
            <div v-if="analysisResult.boxes && analysisResult.boxes.length > 0" class="space-y-1.5">
              <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                Detected Regions ({{ analysisResult.boxes.length }}):
              </span>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(box, i) in analysisResult.boxes"
                  :key="i"
                  class="border border-neutral-300 rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 font-mono dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  <span class="text-primary-500 font-bold">{{ box.label || `Box ${i + 1}` }}</span>:
                  [{{ Math.round(box.left * 100) }}%, {{ Math.round(box.top * 100) }}%] → [{{ Math.round(box.right * 100) }}%, {{ Math.round(box.bottom * 100) }}%]
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>
