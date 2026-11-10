<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'
import type { TranscriptionProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import {
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  TranscriptionPlayground,
} from '@proj-airi/stage-ui/components'
import { getWhistleClient } from '@proj-airi/stage-ui/libs/inference/adapters/whistle-client'
import { clearWhistleCache, formatBytes, getWhistleCacheSize, isWhistleModelCached } from '@proj-airi/stage-ui/libs/inference/cache-utils'
import { useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button, FieldSelect, Progress } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

const providerId = 'whistle-local'
const { t } = useI18n()
const router = useRouter()

const hearingStore = useHearingStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const DEFAULT_LANGUAGE = 'en'
const defaultModel = 'whistle-base'

const model = computed({
  get: () => providers.value[providerId]?.model as string | undefined || defaultModel,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
    hearingStore.activeTranscriptionModel = value
  },
})

const isEnabled = computed(() => !!providers.value[providerId]?.enabled)

function toggleProvider() {
  if (!providers.value[providerId])
    providers.value[providerId] = {}
  providers.value[providerId].enabled = !isEnabled.value
  if (providers.value[providerId].enabled) {
    hearingStore.activeTranscriptionProvider = providerId
    hearingStore.activeTranscriptionModel = model.value
  }
}

const isDownloading = ref(false)
const loadingProgress = ref(0)
const isModelCachedState = ref(false)
const cacheSizeBytes = ref(0)
const isModelResident = ref(false)

async function checkModelStatus() {
  try {
    const client = getWhistleClient()
    isModelResident.value = client.isReady()
    isModelCachedState.value = await isWhistleModelCached()
    cacheSizeBytes.value = await getWhistleCacheSize()
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
    const client = getWhistleClient()
    await client.prepare((ratio) => {
      loadingProgress.value = Math.min(100, Math.round(ratio * 100))
    })

    isDownloading.value = false
    isModelResident.value = true
    isModelCachedState.value = true
    loadingProgress.value = 100
    cacheSizeBytes.value = await getWhistleCacheSize()
    toast.success('Whistle STT engine loaded and cached successfully')
  }
  catch (err: any) {
    isDownloading.value = false
    toast.error(`Failed to load Whistle: ${err?.message || String(err)}`)
    console.error('[Whistle Local Settings] Model download error:', err)
  }
}

async function handleClearCache() {
  try {
    await clearWhistleCache()
    await checkModelStatus()
    toast.success('Whistle cache cleared')
  }
  catch (err: any) {
    toast.error(`Failed to clear cache: ${err?.message || String(err)}`)
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

const languageOptions = [
  { label: 'Auto Detect', value: 'auto' },
  { label: 'English', value: 'en' },
  { label: 'German (Deutsch)', value: 'de' },
  { label: 'Spanish (Español)', value: 'es' },
  { label: 'French (Français)', value: 'fr' },
  { label: 'Italian (Italiano)', value: 'it' },
  { label: 'Portuguese (Português)', value: 'pt' },
  { label: 'Dutch (Nederlands)', value: 'nl' },
]

async function handleGenerateTranscription(file: File) {
  const provider = await providersStore.getProviderInstance<TranscriptionProviderWithExtraOptions>(providerId)
  if (!provider) {
    throw new Error('Provider instance not found')
  }

  return hearingStore.transcription(providerId, provider, model.value, file)
}

watch([model, language], () => {
  checkModelStatus()
})

onMounted(() => {
  checkModelStatus()
  if (!hearingStore.activeTranscriptionModel) {
    hearingStore.activeTranscriptionModel = model.value
  }
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Whistle (Local)'"
    :provider-description="providerMetadata?.localizedDescription || 'Private & Ultra-Fast - In-browser transcription via Cactus (16.9 MB)'"
    :provider-icon="providerMetadata?.icon || 'i-solar:microphone-2-bold-duotone'"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment || 'local'"
    :pricing="providerMetadata?.pricing || 'free'"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :on-back="() => router.push('/settings/providers#transcription')"
  >
    <ProviderSettingsContainer class="w-full md:w-[60%] space-y-6">
      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
      >
        <div class="space-y-4">
          <!-- Weight Cache & Pre-Warming Panel -->
          <div class="border border-neutral-200/60 rounded-xl bg-neutral-50/50 p-4 space-y-4 dark:border-neutral-800/60 dark:bg-neutral-900/40">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                    Cactus Whistle 16.9 MB (On-Device ASR)
                  </span>
                  <span
                    v-if="isModelCachedState"
                    class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 font-medium dark:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    Cached ({{ formatBytes(cacheSizeBytes || 17 * 1024 * 1024) }})
                  </span>
                  <span
                    v-else
                    class="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 font-medium dark:bg-amber-500/20 dark:text-amber-400"
                  >
                    Not Cached (~17 MB)
                  </span>
                </div>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">
                  Ultra-low latency speech recognition (11ms TTFT). Runs locally on CPU/WASM with zero cloud API keys or subscriptions.
                </p>
              </div>

              <div class="flex items-center gap-2">
                <Button
                  v-if="isModelCachedState"
                  variant="secondary"
                  size="sm"
                  class="text-xs text-red-600 dark:text-red-400 hover:text-red-700"
                  @click="handleClearCache"
                >
                  Clear Cache
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="isDownloading"
                  @click="downloadModel"
                >
                  <span v-if="isDownloading">Downloading...</span>
                  <span v-else-if="isModelResident">Pre-Warmed</span>
                  <span v-else-if="isModelCachedState">Pre-Warm</span>
                  <span v-else>Download & Cache (17 MB)</span>
                </Button>
              </div>
            </div>

            <!-- Progress bar -->
            <div v-if="isDownloading" class="space-y-1.5">
              <div class="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <span>Downloading Whistle weights...</span>
                <span>{{ loadingProgress }}%</span>
              </div>
              <Progress :progress="loadingProgress" class="h-1.5" />
            </div>
          </div>

          <!-- Language Selection -->
          <FieldSelect
            v-model="language"
            label="Recognition Language"
            description="Language hint passed to Whistle for transcription."
            :options="languageOptions"
            layout="vertical"
          />
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

      <!-- Interactive Transcription Playground -->
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
