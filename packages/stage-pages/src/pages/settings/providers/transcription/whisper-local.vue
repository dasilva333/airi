<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'
import type { TranscriptionProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import {
  Alert,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  TranscriptionPlayground,
} from '@proj-airi/stage-ui/components'
import { getWhisperAdapter } from '@proj-airi/stage-ui/libs/inference/adapters/whisper'
import { DEFAULT_WHISPER_MODEL, WHISPER_MODELS } from '@proj-airi/stage-ui/libs/inference/constants'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldSelect, Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const providerId = 'whisper-local'
const { t } = useI18n()
const router = useRouter()

const hearingStore = useHearingStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const DEFAULT_LANGUAGE = 'en'
const defaultModel = DEFAULT_WHISPER_MODEL

// Model selection (synced with provider settings & hearing store)
const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
    hearingStore.activeTranscriptionModel = value
  },
})

const selectedModelInfo = computed(() => {
  return WHISPER_MODELS.find(m => m.id === model.value) || WHISPER_MODELS[0]
})

function formatMB(bytes?: number) {
  if (!bytes)
    return ''
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

const isDownloading = ref(false)
const downloadingModel = ref('')
const loadingProgress = ref(0)
const isModelResident = ref(false)

async function checkModelStatus() {
  try {
    const adapter = await getWhisperAdapter()
    if (adapter.state === 'ready' && adapter.manifest?.model === model.value) {
      isModelResident.value = true
    }
    else {
      isModelResident.value = false
    }
  }
  catch {
    isModelResident.value = false
  }
}

async function downloadModel(modelId: string, force = false) {
  if (isDownloading.value)
    return

  isDownloading.value = true
  downloadingModel.value = modelId
  loadingProgress.value = 0

  const shardMap = new Map<string, { loaded: number, total: number }>()
  const expectedTotalBytes = (WHISPER_MODELS.find(m => m.id === modelId)?.downloadBytes) || selectedModelInfo.value?.downloadBytes || (800 * 1024 * 1024)

  try {
    const adapter = await getWhisperAdapter()
    await adapter.load((p) => {
      if (p.phase === 'warmup' || (p.message && p.message.includes('warm'))) {
        loadingProgress.value = 100
      }
      else if (p.file) {
        shardMap.set(p.file, {
          loaded: p.loaded || 0,
          total: p.total || 0,
        })
        let sumLoaded = 0
        for (const s of shardMap.values()) {
          sumLoaded += s.loaded
        }
        if (expectedTotalBytes > 0) {
          const calculated = Math.min(99, Math.round((sumLoaded / expectedTotalBytes) * 100))
          loadingProgress.value = Math.max(loadingProgress.value, calculated)
        }
        else if (typeof p.percent === 'number' && p.percent >= 0) {
          loadingProgress.value = Math.min(99, Math.max(loadingProgress.value, Math.round(p.percent)))
        }
      }
      else if (typeof p.percent === 'number' && p.percent >= 0) {
        loadingProgress.value = Math.min(99, Math.max(loadingProgress.value, Math.round(p.percent)))
      }
    }, { model: modelId, force })

    isDownloading.value = false
    isModelResident.value = true
    loadingProgress.value = 100
    toast.success(`Model ${modelId} loaded successfully`)
  }
  catch (err) {
    isDownloading.value = false
    toast.error(`Failed to load model: ${err instanceof Error ? err.message : String(err)}`)
    console.error('[Whisper Local Settings] Model download error:', err)
  }
}

const language = computed({
  get: () => providers.value[providerId]?.language || DEFAULT_LANGUAGE,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].language = value
  },
})

// Whisper is multilingual and accepts ISO 639-1 language codes; a common subset
// is offered here.
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

function handleResetSettings() {
  providers.value[providerId] = { model: defaultModel, language: DEFAULT_LANGUAGE }
  hearingStore.activeTranscriptionModel = defaultModel
  void checkModelStatus()
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
  }
  else {
    await providersStore.validateProvider(providerId, { force: true })
  }
}

// Generate transcription handler for the playground
async function handleGenerateTranscription(file: File) {
  const provider = await providersStore.getProviderInstance<TranscriptionProviderWithExtraOptions<string, any>>(providerId)
  if (!provider)
    throw new Error('Failed to initialize local Whisper provider')

  if (!isModelResident.value) {
    toast.info(`Downloading ${model.value} model...`)
    await downloadModel(model.value)
    if (!isModelResident.value)
      throw new Error('Model failed to load into memory')
  }

  return await hearingStore.transcription(
    providerId,
    provider,
    model.value,
    file,
    'json',
  )
}

watch(model, () => {
  void checkModelStatus()
})

onMounted(async () => {
  await checkModelStatus()
  if (!hearingStore.activeTranscriptionProvider) {
    hearingStore.activeTranscriptionProvider = providerId
  }
  if (!hearingStore.activeTranscriptionModel) {
    hearingStore.activeTranscriptionModel = model.value
  }
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Whisper (Local)'"
    :provider-description="providerMetadata?.localizedDescription || 'Private & Secure - In-browser transcription via WebGPU'"
    :provider-icon="providerMetadata?.icon || 'i-lobe-icons:huggingface'"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment || 'local'"
    :pricing="providerMetadata?.pricing || 'free'"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :on-back="() => router.push('/settings/providers#transcription')"
  >
    <ProviderSettingsContainer class="w-full md:w-[60%] space-y-6">
      <Alert type="info">
        <template #title>
          Free, in-browser transcription
        </template>
        <template #content>
          Whisper runs entirely in your browser — no API key, and no audio leaves your device. Model weights
          download once on first use and are cached in browser storage. It utilizes WebGPU where available and
          gracefully falls back to WASM (CPU) on unsupported devices.
        </template>
      </Alert>

      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <div class="space-y-4">
          <!-- Model Selection -->
          <FieldSelect
            v-model="model"
            label="Whisper Model"
            description="Select the local Whisper model shard."
            :options="WHISPER_MODELS.map(m => ({
              value: m.id,
              label: `${m.name} (${formatMB(m.downloadBytes)} DL · ${formatMB(m.vramBytes)} VRAM)`,
              disabled: isDownloading && downloadingModel !== m.id,
            }))"
            layout="vertical"
          />

          <!-- Recognition Language -->
          <FieldSelect
            v-model="language"
            label="Recognition Language"
            description="Language hint passed to Whisper for transcription."
            :options="languageOptions"
            layout="vertical"
          />

          <!-- Model Download Status Card -->
          <div class="mt-4">
            <div v-if="isDownloading && downloadingModel === model" class="border border-primary-500/20 rounded-xl bg-primary-500/5 p-4">
              <div class="mb-2 flex justify-between text-xs opacity-70">
                <span class="font-medium">Downloading {{ model }}…</span>
                <span class="font-mono">{{ Math.round(loadingProgress) }}%</span>
              </div>
              <Progress :progress="loadingProgress" class="h-2" />
            </div>

            <div v-else-if="!isModelResident" class="flex items-center justify-between border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <div class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                <div class="i-solar:info-circle-bold-duotone text-base text-primary-500" />
                <span>Model not resident in memory ({{ formatMB(selectedModelInfo.downloadBytes) }} download)</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                :disabled="isDownloading"
                class="flex items-center gap-1 text-xs"
                @click="downloadModel(model)"
              >
                <div class="i-solar:cloud-download-bold-duotone text-sm" />
                <span>Download & Cache</span>
              </Button>
            </div>

            <div v-else class="flex items-center justify-between border border-emerald-500/20 rounded-xl bg-emerald-500/10 p-4 text-xs text-emerald-700 dark:text-emerald-300">
              <div class="flex items-center gap-2 font-medium">
                <div class="i-solar:check-circle-bold-duotone text-base text-emerald-500" />
                <span>Model is loaded & ready in memory</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                :disabled="isDownloading"
                class="flex items-center gap-1 text-xs"
                @click="downloadModel(model, true)"
              >
                <div class="i-solar:refresh-circle-bold-duotone text-sm" />
                <span>Reload</span>
              </Button>
            </div>
          </div>
        </div>
      </ProviderBasicSettings>

      <!-- Activation Status -->
      <div class="flex items-center justify-between border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="space-y-1">
          <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
            {{ isEnabled ? 'Provider Active' : 'Activate Provider' }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ isEnabled ? 'This provider is active and available in Modules.' : 'Enable this provider to select it for character cards and hearing module.' }}
          </p>
        </div>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200"
          :class="isEnabled ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30' : 'bg-primary-500 text-white hover:bg-primary-600'"
          @click="toggleProvider"
        >
          {{ isEnabled ? 'Deactivate' : 'Activate' }}
        </button>
      </div>

      <!-- Live Playground -->
      <div class="pt-2 space-y-3">
        <h3 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
          Transcription Playground
        </h3>
        <TranscriptionPlayground
          :generate-transcription="handleGenerateTranscription"
          :api-key-configured="isEnabled"
        />
      </div>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  subtitleKey: settings.pages.providers.title
  stageTransition:
    name: slide
</route>
