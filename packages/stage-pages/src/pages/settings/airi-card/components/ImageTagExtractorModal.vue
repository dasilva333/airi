<script setup lang="ts">
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  modelId?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'apply', tags: string): void
}>()

const displayModelsStore = useDisplayModelsStore()
const providersStore = useProvidersStore()

const modelInfo = ref<any>(null)
const previewImage = ref<string | null>(null)
const loadingModel = ref(false)
const processingImage = ref(false)
const modelLoadProgress = ref(0)
const extractedTags = ref('')
const errorMessage = ref('')
const isModelLoaded = ref(false)

// Resolve the display model and its preview image
watch(() => [props.modelValue, props.modelId], async () => {
  if (props.modelValue && props.modelId) {
    errorMessage.value = ''
    extractedTags.value = ''
    modelInfo.value = null
    previewImage.value = null
    isModelLoaded.value = false
    modelLoadProgress.value = 0

    try {
      const model = await displayModelsStore.getDisplayModel(props.modelId)
      if (model) {
        modelInfo.value = model
        previewImage.value = model.previewImage || null
      }
    }
    catch (err) {
      console.error('[TagExtractorModal] Failed to resolve display model:', err)
      errorMessage.value = 'Failed to load display model info.'
    }
  }
}, { immediate: true })

async function runTagExtraction() {
  if (!previewImage.value) {
    errorMessage.value = 'No preview image available for this model to analyze.'
    return
  }

  errorMessage.value = ''
  processingImage.value = true
  loadingModel.value = false
  extractedTags.value = ''

  const providerId = 'blip-local'

  try {
    // 1. Initialize and configure local vision provider if not already setup
    providersStore.initializeProvider(providerId)
    if (!providersStore.addedProviders[providerId]) {
      providersStore.markProviderAdded(providerId)
    }
    if (providersStore.providerRuntimeState[providerId]) {
      providersStore.providerRuntimeState[providerId].isConfigured = true
    }

    // 2. Fetch the local vision provider instance
    const providerInstance = await providersStore.getProviderInstance<any>(providerId)
    if (!providerInstance) {
      throw new Error('Failed to initialize local vision provider.')
    }

    // 3. Ensure the model is loaded (and report progress)
    loadingModel.value = true
    await providerInstance.loadModel({
      onProgress: (progress: any) => {
        if (progress?.percent) {
          modelLoadProgress.value = Math.round(progress.percent * 100)
        }
      },
    })
    isModelLoaded.value = true
    loadingModel.value = false

    // 4. Run image captioning / tagging
    const result = await providerInstance.captionImage(previewImage.value)
    extractedTags.value = result
  }
  catch (err: any) {
    console.error('[TagExtractorModal] Extraction failed:', err)
    errorMessage.value = err.message || 'Failed to extract tags.'
  }
  finally {
    processingImage.value = false
    loadingModel.value = false
  }
}

function handleApply() {
  emit('apply', extractedTags.value)
  emit('update:modelValue', false)
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[10001] m-0 max-h-[90vh] max-w-2xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900">
        <!-- Header -->
        <div class="border-b border-neutral-100 p-6 pb-4 dark:border-neutral-800">
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-primary-500/10 p-2 text-primary-500 shadow-primary-500/10 shadow-sm">
              <div class="i-solar:tag-bold-duotone text-2xl" />
            </div>
            <div>
              <DialogTitle class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
                Local Image Tag Extractor
              </DialogTitle>
              <code v-if="modelInfo?.name" class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-black/40">
                Model: {{ modelInfo.name }}
              </code>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="flex flex-1 gap-6 overflow-hidden p-6">
          <!-- Left: Preview Image -->
          <div class="min-h-[260px] w-1/2 flex flex-col items-center justify-center overflow-hidden border border-neutral-200 rounded-xl bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <img
              v-if="previewImage"
              :src="previewImage"
              class="max-h-full max-w-full rounded-lg object-contain shadow-sm"
              alt="Model Preview"
            >
            <div v-else class="text-center text-neutral-400 space-y-2">
              <div class="i-solar:image-broken-bold-duotone mx-auto text-4xl" />
              <p class="text-xs">
                No preview image found for this model.
              </p>
            </div>
          </div>

          <!-- Right: Information & Console -->
          <div class="w-1/2 flex flex-col justify-between">
            <div class="flex-1 space-y-4">
              <p class="text-xs text-neutral-500 leading-relaxed">
                This will process the preview image of your character model through the local <b>WD14 Tagger / BLIP</b> pipeline (WebGPU/WASM) to extract visual traits (e.g. hair style, colors, clothing, aesthetics).
              </p>

              <!-- Loading Indicator -->
              <div v-if="loadingModel" class="flex flex-col items-center justify-center py-4 text-center space-y-3">
                <div class="i-svg-spinners:ring-resize text-xl text-primary-500" />
                <div class="w-full text-xs text-neutral-500">
                  Downloading local tagger models...
                  <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div class="h-1.5 rounded-full bg-primary-500 transition-all duration-300" :style="`width: ${modelLoadProgress}%`" />
                  </div>
                  <span class="mt-1 block text-[10px] text-neutral-400">{{ modelLoadProgress }}% complete</span>
                </div>
              </div>

              <!-- Processing Indicator -->
              <div v-else-if="processingImage" class="flex flex-col items-center justify-center py-6 text-center space-y-2">
                <div class="i-svg-spinners:ring-resize text-xl text-primary-500" />
                <span class="text-xs text-neutral-500">Running WebGPU vision inference...</span>
              </div>

              <!-- Errors -->
              <div v-else-if="errorMessage" class="border border-red-200 rounded-lg bg-red-50 p-3 text-xs text-red-500 dark:border-red-900/40 dark:bg-red-950/20">
                {{ errorMessage }}
              </div>

              <!-- Extracted Result -->
              <div v-else-if="extractedTags" class="h-[180px] flex flex-col space-y-2">
                <span class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">Extracted Tags</span>
                <textarea
                  v-model="extractedTags"
                  readonly
                  class="flex-1 select-text resize-none border border-neutral-200 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-800 font-mono outline-none dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                />
              </div>

              <!-- Placeholder -->
              <div v-else class="h-[140px] flex items-center justify-center border border-neutral-100 rounded-xl bg-neutral-50/50 text-center text-xs text-neutral-400 dark:border-neutral-800/40 dark:bg-black/10">
                Ready. Click Run Tag Extraction below.
              </div>
            </div>

            <!-- Modal Action Buttons (Right Bottom) -->
            <div class="flex gap-2 pt-4">
              <Button
                v-if="!extractedTags"
                variant="primary"
                label="Run Tag Extraction"
                icon="i-solar:play-circle-bold-duotone"
                class="w-full text-xs"
                :disabled="!previewImage || processingImage || loadingModel"
                @click="runTagExtraction"
              />
              <template v-else>
                <Button
                  variant="primary"
                  label="Apply & Close"
                  icon="i-solar:check-read-bold-duotone"
                  class="flex-1 text-xs"
                  @click="handleApply"
                />
                <Button
                  variant="secondary"
                  label="Re-Run"
                  icon="i-solar:restart-bold-duotone"
                  class="text-xs"
                  :disabled="processingImage || loadingModel"
                  @click="runTagExtraction"
                />
              </template>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-950">
          <Button
            variant="secondary"
            label="Cancel"
            class="text-xs"
            @click="emit('update:modelValue', false)"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
