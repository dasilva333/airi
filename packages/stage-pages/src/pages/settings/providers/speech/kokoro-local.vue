<script setup lang="ts">
import type { WebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'
import type { SpeechProvider } from '@xsai-ext/providers/utils'

import { detectWebGPU, getCachedWebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'
import {
  SpeechPlayground,
  SpeechProviderSettings,
} from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { getDefaultKokoroModel } from '@proj-airi/stage-ui/workers/kokoro/constants'
import { Callout, Progress, Select } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const providerId = 'kokoro-local'
const defaultModel = 'kokoro-82m'
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { t } = useI18n()

// Get available voices for Kokoro
const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

// Get provider config
const providerConfig = computed(() => {
  return providersStore.getProviderConfig(providerId)
})

// Cached WebGPU capabilities, used to pick the default model and gate which
// WebGPU quantizations are offered. Populated by the providers store during
// initialization; read synchronously here (re-read on mount).
const webgpuCapabilities = ref<WebGPUCapabilities | null>(getCachedWebGPUCapabilities())

// Track voices loading state
const voicesLoading = ref(false)

// Track model download progress state
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadMessage = ref('')

// Get provider models from store
const providerModels = computed(() => {
  return providersStore.getModelsForProvider(providerId)
})

// Model loading state
const modelsLoading = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

// Model computed property
const model = computed({
  get(): string {
    const currentValue = providerConfig.value?.model as string
    if (currentValue)
      return currentValue

    return getDefaultKokoroModel(webgpuCapabilities.value)
  },
  set(val: string) {
    const config = providersStore.getProviderConfig(providerId)
    config.model = val
  },
})

// Model options for the dropdown
const modelOptions = computed(() => {
  return providerModels.value.map(m => ({
    label: m.name,
    value: m.id,
  }))
})

// Generate speech with Kokoro-specific parameters
async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  try {
    const provider = await providersStore.getProviderInstance(providerId) as SpeechProvider
    if (!provider) {
      console.error('[Kokoro Playground] Failed to get provider instance')
      throw new Error('Failed to initialize speech provider')
    }

    const config = providersStore.getProviderConfig(providerId)
    const selectedModel = config.model as string | undefined || defaultModel

    const result = await speechStore.speech(
      provider,
      selectedModel,
      input,
      voiceId,
      {
        ...config,
      },
    )

    return result
  }
  catch (error) {
    console.error('[Kokoro Playground] Error generating speech:', error)
    throw error
  }
}

onMounted(async () => {
  // Check WebGPU support asynchronously to populate capabilities (fp16Supported, etc.)
  webgpuCapabilities.value = await detectWebGPU()

  try {
    voicesLoading.value = true

    // Fetch available models first
    await providersStore.fetchModelsForProvider(providerId)

    // Load voices immediately — Kokoro's voices are static and decoupled from weights
    await speechStore.loadVoicesForProvider(providerId)

    const config = providersStore.getProviderConfig(providerId)
    // Persist the default model if none is saved yet so validation passes on first visit
    if (!config.model) {
      config.model = getDefaultKokoroModel(webgpuCapabilities.value)
    }
    const metadata = providersStore.getProviderMetadata(providerId)
    const validationResult = await metadata.validators.validateProviderConfig(config)
    if (validationResult.valid) {
      // Load the initial model with progress feedback
      if (metadata.capabilities.loadModel) {
        isDownloading.value = true
        downloadProgress.value = 0
        downloadMessage.value = 'Preparing Kokoro TTS model...'
        try {
          await metadata.capabilities.loadModel(config, {
            onProgress: (p: any) => {
              if (typeof p.progress === 'number' && p.progress >= 0) {
                downloadProgress.value = Math.min(100, Math.round(p.progress))
              }
              if (p.file || p.name) {
                downloadMessage.value = `Downloading ${p.file || p.name}...`
              }
            },
          })
        }
        catch (error) {
          console.error('Failed to load initial Kokoro model:', error)
        }
        finally {
          isDownloading.value = false
        }
      }
    }
    else {
      console.error('Failed to validate Kokoro provider config', config, validationResult)
    }
  }
  finally {
    voicesLoading.value = false
  }
})

// Watch for model changes and reload model + voices
watch(model, async (newValue) => {
  if (newValue) {
    try {
      voicesLoading.value = true

      const config = providersStore.getProviderConfig(providerId)
      const metadata = providersStore.getProviderMetadata(providerId)
      const validationResult = await metadata.validators.validateProviderConfig(config)

      if (validationResult.valid && metadata.capabilities.loadModel) {
        isDownloading.value = true
        downloadProgress.value = 0
        downloadMessage.value = `Downloading ${newValue}...`
        try {
          await metadata.capabilities.loadModel(config, {
            onProgress: (p: any) => {
              if (typeof p.progress === 'number' && p.progress >= 0) {
                downloadProgress.value = Math.min(100, Math.round(p.progress))
              }
              if (p.file || p.name) {
                downloadMessage.value = `Downloading ${p.file || p.name}...`
              }
            },
          })
        }
        finally {
          isDownloading.value = false
        }

        // Then reload voices
        await speechStore.loadVoicesForProvider(providerId)
      }
    }
    catch (error) {
      console.error('[Kokoro Settings] Error in model watcher:', error)
    }
    finally {
      voicesLoading.value = false
    }
  }
})
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <template #voice-settings>
      <!-- Model Selection -->
      <div class="space-y-3">
        <Callout :label="t('settings.pages.providers.provider.kokoro-local.fields.field.model.label')">
          <div>
            <p>{{ t('settings.pages.providers.provider.kokoro-local.fields.field.model.description') }}</p>
          </div>
        </Callout>
        <div>
          <Select
            v-model="model"
            :options="modelOptions"
            :disabled="modelsLoading || isDownloading"
            placeholder="Choose a model..."
          />
        </div>

        <!-- Download Progress Card -->
        <div v-if="isDownloading" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-4 space-y-2">
          <div class="flex justify-between text-xs opacity-70">
            <span class="font-medium">{{ downloadMessage || `Downloading ${model}...` }}</span>
            <span class="font-mono">{{ downloadProgress }}%</span>
          </div>
          <Progress :progress="downloadProgress" class="h-2" />
        </div>
      </div>
    </template>

    <!-- Replace the default playground with our standalone component -->
    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="true"
        :voices-loading="voicesLoading"
        :default-text="t('settings.pages.providers.provider.kokoro-local.playground.default-text')"
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
  meta:
    layout: settings
    stageTransition:
      name: slide
</route>
