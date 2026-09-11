<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'

import {
  Alert,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import { DEFAULT_LOCAL_VISION_MODEL, LOCAL_VISION_MODELS } from '@proj-airi/stage-ui/libs/inference/constants'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const providerId = 'blip-local'
const { t } = useI18n()
const router = useRouter()

const providersStore = useProvidersStore()
const { providers, providerRuntimeState } = storeToRefs(providersStore) as {
  providers: RemovableRef<Record<string, any>>
  providerRuntimeState: RemovableRef<Record<string, any>>
}

// Initialize provider if needed
providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const selectedModel = computed({
  get: () => providers.value[providerId]?.model ?? DEFAULT_LOCAL_VISION_MODEL,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
    // Reset status on model change
    isModelLoaded.value = false
    modelLoadProgress.value = 0
  },
})

// UI Playground State
const fileInput = ref<HTMLInputElement | null>(null)
const isModelLoaded = ref(false)
const loadingModel = ref(false)
const processingImage = ref(false)
const modelLoadProgress = ref(0)
const errorMessage = ref('')

const testImageFile = ref<File | null>(null)
const testImageUrl = ref<string | null>(null)
const captionResult = ref('')
const latencyMs = ref<number | null>(null)

const runDevice = computed(() => {
  return providerRuntimeState.value[providerId]?.device ?? 'WebGPU'
})

// Models mapped to selector options
const modelOptions = LOCAL_VISION_MODELS.map(m => ({
  value: m.id,
  label: `${m.name} (${m.description})`,
}))

function handleResetSettings() {
  providers.value[providerId] = { model: DEFAULT_LOCAL_VISION_MODEL }
  isModelLoaded.value = false
  modelLoadProgress.value = 0
  errorMessage.value = ''
}

const isEnabled = computed(() => {
  return providersStore.providerRuntimeState[providerId]?.isConfigured && !!providersStore.addedProviders[providerId]
})

async function toggleProvider() {
  if (isEnabled.value) {
    providersStore.unmarkProviderAdded(providerId)
    if (providersStore.providerRuntimeState[providerId]) {
      providersStore.providerRuntimeState[providerId].isConfigured = false
    }
    isModelLoaded.value = false
  }
  else {
    await providersStore.validateProvider(providerId, { force: true })
  }
}

// Drag & Drop / File Upload
function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    setImageFile(target.files[0])
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    setImageFile(event.dataTransfer.files[0])
  }
}

function setImageFile(file: File) {
  testImageFile.value = file
  testImageUrl.value = URL.createObjectURL(file)
  captionResult.value = ''
  latencyMs.value = null
}

// Run Vision Inference Pipeline
async function runPlaygroundInference() {
  if (!testImageUrl.value) {
    errorMessage.value = 'Please upload or drop an image first.'
    return
  }

  errorMessage.value = ''
  processingImage.value = true
  const startTime = performance.now()

  try {
    // 1. Get or create provider instance
    const providerInstance = await providersStore.getProviderInstance<any>(providerId)

    // 2. Ensure model is loaded
    if (!isModelLoaded.value) {
      loadingModel.value = true
      // Load model and listen to progress
      await providerInstance.loadModel({
        onProgress: (progress: any) => {
          if (progress?.percent) {
            modelLoadProgress.value = Math.round(progress.percent * 100)
          }
        },
      })
      isModelLoaded.value = true
      loadingModel.value = false
    }

    // 3. Run image captioning
    const result = await providerInstance.captionImage(testImageUrl.value)
    captionResult.value = result
    latencyMs.value = Math.round(performance.now() - startTime)
  }
  catch (err: any) {
    console.error('[Vision Playground] Inference failed:', err)
    errorMessage.value = err.message || 'Failed to process image.'
  }
  finally {
    processingImage.value = false
    loadingModel.value = false
  }
}
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Waifu Diffusion Tagger (WD)'"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :on-back="() => router.back()"
  >
    <ProviderSettingsContainer class="w-full md:w-[70%] space-y-6">
      <Alert type="info">
        <template #title>
          Local On-Device Vision Provider
        </template>
        <template #content>
          This provider runs local on-device image tagging models directly in your browser. <b>Waifu Diffusion (WD Tagger)</b> classifies and describes artwork with rich Danbooru tags, especially tailored for anime and stylized illustrations.
        </template>
      </Alert>

      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
            <div>
              <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                Enable Provider
              </h4>
              <p class="text-xs text-neutral-500">
                Toggle the on-device vision pipeline.
              </p>
            </div>
            <button
              type="button"
              class="relative h-6 w-11 inline-flex flex-shrink-0 cursor-pointer border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none"
              :class="isEnabled ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              @click="toggleProvider"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="isEnabled ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <FieldSelect
            v-model="selectedModel"
            label="Vision Model"
            description="Choose the active local vision model weights to use."
            :options="modelOptions"
            :disabled="!isEnabled"
          />
        </div>
      </ProviderBasicSettings>

      <!-- Playground Section -->
      <div
        v-if="isEnabled"
        class="border border-neutral-200 rounded-lg p-5 space-y-5 dark:border-neutral-700"
      >
        <div>
          <h3 class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
            Vision Playground Sandbox
          </h3>
          <p class="text-xs text-neutral-500">
            Upload an image to verify the model outputs and benchmark execution speed on your device.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <!-- Upload/Drop Area -->
          <div
            class="min-h-[220px] flex flex-col cursor-pointer items-center justify-center border-2 border-neutral-200 rounded-xl border-dashed p-5 transition-colors dark:border-neutral-800 hover:border-primary-500"
            @dragover.prevent
            @drop="handleDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileChange"
            >

            <div v-if="testImageUrl" class="relative h-full max-h-[180px] w-full flex items-center justify-center overflow-hidden">
              <img :src="testImageUrl" class="max-h-full max-w-full rounded-lg object-contain shadow-sm">
            </div>
            <div v-else class="text-center space-y-2">
              <div class="i-solar:upload-track-bold-duotone mx-auto text-3xl text-neutral-400" />
              <p class="text-sm text-neutral-600 font-semibold dark:text-neutral-400">
                Drag & Drop image here
              </p>
              <p class="text-xs text-neutral-400">
                or click to browse local files
              </p>
            </div>
          </div>

          <!-- Inference Console -->
          <div class="flex flex-col justify-between border border-neutral-100 rounded-xl bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div class="space-y-3">
              <div class="flex items-center justify-between border-b border-neutral-200 pb-2 text-xs text-neutral-500 dark:border-neutral-800">
                <span>Hardware Backend: <b>{{ runDevice.toUpperCase() }}</b></span>
                <span v-if="latencyMs">Latency: <b>{{ latencyMs }}ms</b></span>
              </div>

              <!-- Output Box -->
              <div v-if="captionResult" class="space-y-2">
                <span class="text-xs text-neutral-400 font-semibold tracking-wider uppercase">Model Output Tags/Text</span>
                <div class="max-h-[120px] select-text overflow-y-auto border border-neutral-200 rounded-lg bg-white p-3 text-sm text-neutral-800 font-mono dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                  {{ captionResult }}
                </div>
              </div>
              <div v-else-if="loadingModel" class="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div class="i-svg-spinners:ring-resize text-xl text-primary-500" />
                <div class="text-xs text-neutral-500">
                  Downloading model files from Hugging Face...
                  <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div class="h-1.5 rounded-full bg-primary-500 transition-all duration-300" :style="`width: ${modelLoadProgress}%`" />
                  </div>
                  <span class="mt-1 block text-[10px] text-neutral-400">{{ modelLoadProgress }}% complete</span>
                </div>
              </div>
              <div v-else-if="processingImage" class="flex flex-col items-center justify-center py-8 text-center space-y-2">
                <div class="i-svg-spinners:ring-resize text-xl text-primary-500" />
                <span class="text-xs text-neutral-500">Running model WebGPU inference...</span>
              </div>
              <div v-else-if="errorMessage" class="border border-red-200 rounded bg-red-50 p-2 text-xs text-red-500 dark:border-red-900/40 dark:bg-red-950/20">
                {{ errorMessage }}
              </div>
              <div v-else class="h-[100px] flex items-center justify-center text-xs text-neutral-400">
                No active output. Click Run Inference to begin.
              </div>
            </div>

            <Button
              variant="primary"
              label="Run Inference"
              icon="i-solar:play-circle-bold-duotone"
              class="mt-4 w-full"
              :disabled="!testImageUrl || processingImage || loadingModel"
              @click="runPlaygroundInference"
            />
          </div>
        </div>
      </div>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
