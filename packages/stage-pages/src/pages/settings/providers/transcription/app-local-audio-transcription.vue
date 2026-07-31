<script setup lang="ts">
import {
  TranscriptionPlayground,
  TranscriptionProviderSettings,
} from '@proj-airi/stage-ui/components'
import { WHISPER_MODELS } from '@proj-airi/stage-ui/libs/workers/whisper'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldSelect, Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

const hearingStore = useHearingStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: any }

// Provider metadata
const providerId = 'app-local-audio-transcription'
const defaultModel = WHISPER_MODELS[0].id

// Local state for model management
const loadingProgress = ref(0)
const isDownloading = ref(false)
const downloadingModel = ref('')
const cachedModels = ref<Set<string>>(new Set())

// Model selection (synced with provider settings)
const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
    hearingStore.activeTranscriptionModel = value
  },
})

// Check cached models on mount
async function checkCache() {
  const cached = localStorage.getItem('airi/whisper/cached-models')
  if (cached) {
    cachedModels.value = new Set(JSON.parse(cached))
  }
}

async function downloadModel(modelId: string) {
  if (isDownloading.value)
    return

  isDownloading.value = true
  downloadingModel.value = modelId
  loadingProgress.value = 0

  const fileProgresses = new Map<string, { loaded: number, total: number }>()

  try {
    const metadata = providersStore.getProviderMetadata(providerId)
    if (!metadata?.capabilities?.loadModel) {
      throw new Error('loadModel capability is missing')
    }

    await metadata.capabilities.loadModel(modelId, null, {
      onProgress: (progress: any) => {
        if (progress.file && progress.loaded !== undefined && progress.total !== undefined) {
          fileProgresses.set(progress.file, { loaded: progress.loaded, total: progress.total })

          let totalBytes = 0
          let loadedBytes = 0
          for (const file of fileProgresses.values()) {
            totalBytes += file.total
            loadedBytes += file.loaded
          }

          if (totalBytes > 0) {
            loadingProgress.value = (loadedBytes / totalBytes) * 100
          }
        }
        else {
          const percent = (progress?.progress ?? 0) * 100
          loadingProgress.value = percent < 0 ? 0 : percent
        }
      },
    })

    isDownloading.value = false
    cachedModels.value.add(modelId)
    localStorage.setItem('airi/whisper/cached-models', JSON.stringify([...cachedModels.value]))
    toast.success(`Model ${modelId} loaded successfully`)
  }
  catch (err) {
    isDownloading.value = false
    toast.error(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`)
    console.error(err)
  }
}

// Generate transcription handler for the playground
async function handleGenerateTranscription(file: File) {
  console.info('[App Local Transcription Settings] handleGenerateTranscription called', {
    fileName: file?.name,
    fileSize: file?.size,
    fileType: file?.type,
    isInstanceOfFile: file instanceof File,
  })

  const provider = await providersStore.getProviderInstance(providerId) as any
  console.info('[App Local Transcription Settings] Provider instance:', provider ? 'initialized' : 'missing')

  if (!provider) {
    throw new Error('Failed to initialize transcription provider')
  }

  // Ensure model is cached before starting transcription
  if (!cachedModels.value.has(model.value)) {
    console.info(`[App Local Transcription Settings] Model ${model.value} not cached. Downloading...`)
    toast.info(`Downloading ${model.value} model...`)
    await downloadModel(model.value)

    // Wait for download to finish with a timeout (2 minutes max)
    const startTime = Date.now()
    const timeout = 120 * 1000

    while (isDownloading.value && (Date.now() - startTime < timeout)) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    if (isDownloading.value) {
      console.error('[App Local Transcription Settings] Model download timed out')
      throw new Error('Model download timed out')
    }

    if (!cachedModels.value.has(model.value)) {
      console.error('[App Local Transcription Settings] Model download failed to cache')
      throw new Error('Model download failed')
    }

    console.info(`[App Local Transcription Settings] Model ${model.value} is now ready.`)
  }

  console.info(`[App Local Transcription Settings] Delegating transcription to hearing store for ${file.name}`)

  return await hearingStore.transcription(
    providerId,
    provider,
    model.value,
    file,
    'json',
  )
}

onMounted(async () => {
  await checkCache()
  // Ensure the provider is selected in the store
  if (!hearingStore.activeTranscriptionProvider) {
    hearingStore.activeTranscriptionProvider = providerId
  }
  if (!hearingStore.activeTranscriptionModel) {
    hearingStore.activeTranscriptionModel = model.value
  }
})

watch(model, async () => {
  const providerConfig = providersStore.getProviderConfig(providerId)
  providerConfig.model = model.value
})

const DEFAULT_LANGUAGE = 'en'

const language = computed({
  get: () => providers.value[providerId]?.language || DEFAULT_LANGUAGE,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].language = value
  },
})

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Italian', value: 'it' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Dutch', value: 'nl' },
  { label: 'Russian', value: 'ru' },
  { label: 'Japanese', value: 'ja' },
  { label: 'Korean', value: 'ko' },
  { label: 'Chinese', value: 'zh' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Hindi', value: 'hi' },
  { label: 'Turkish', value: 'tr' },
]

const isEnabled = computed(() => {
  return providersStore.providerRuntimeState[providerId]?.isConfigured && !!providersStore.addedProviders[providerId]
})

async function toggleProvider() {
  if (isEnabled.value) {
    providersStore.unmarkProviderAdded(providerId)
    if (providersStore.providerRuntimeState[providerId]) {
      providersStore.providerRuntimeState[providerId].isConfigured = false
    }
  }
  else {
    await providersStore.validateProvider(providerId, { force: true })
  }
}
</script>

<template>
  <TranscriptionProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
  >
    <template #basic-settings>
      <!-- Model selection -->
      <FieldSelect
        v-model="model"
        label="Model"
        description="Select the local Whisper model to use (Tiny/Base/Small)"
        :options="WHISPER_MODELS.map(m => ({
          value: m.id,
          label: `${m.name} (${m.size})`,
          disabled: isDownloading && downloadingModel !== m.id,
        }))"
        placeholder="Select a model..."
      />

      <!-- Language selection -->
      <div class="mt-4">
        <FieldSelect
          v-model="language"
          label="Recognition Language"
          description="Language hint passed to Whisper for transcription."
          :options="languageOptions"
          placeholder="Select a language..."
        />
      </div>

      <!-- Model Download Status -->
      <div v-if="model" class="mt-4">
        <div v-if="isDownloading && downloadingModel === model" :class="['p-4 rounded-xl bg-white/5 border border-white/10']">
          <div :class="['flex justify-between text-xs mb-2 opacity-60']">
            <span class="font-medium">Downloading {{ model }}...</span>
            <span>{{ Math.round(loadingProgress) }}%</span>
          </div>
          <Progress :progress="loadingProgress" :class="['h-2']" />
        </div>
        <div v-else-if="!cachedModels.has(model)" :class="['p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between']">
          <div class="flex items-center gap-2 text-sm">
            <div class="i-lucide:info text-primary" />
            <span>Model not cached locally</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            :disabled="isDownloading"
            @click="downloadModel(model)"
          >
            <div class="i-lucide:download mr-1" />
            Download
          </Button>
        </div>
        <div v-else :class="['p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2 text-sm text-emerald-500']">
          <div class="i-lucide:check-circle" />
          <span>Model is ready and cached</span>
        </div>

        <!-- Provider Status / Activation Toggle -->
        <div class="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
          <span class="text-sm font-medium">Provider Status</span>
          <Button
            size="sm"
            :variant="isEnabled ? 'secondary' : 'primary'"
            @click="toggleProvider"
          >
            {{ isEnabled ? 'Deactivate' : 'Activate' }}
          </Button>
        </div>
      </div>
    </template>

    <template #playground>
      <TranscriptionPlayground
        :generate-transcription="handleGenerateTranscription"
        :api-key-configured="isEnabled"
      />
    </template>
  </TranscriptionProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>

<style scoped>
.animate-ping {
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
  }
}
</style>
