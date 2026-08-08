<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'

import {
  Alert,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const providerId = 'whisper-local'
const { t } = useI18n()
const router = useRouter()

const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const DEFAULT_LANGUAGE = 'en'

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
  // The active transcription model is chosen in the hearing settings dropdown
  // (and defaulted by the provider); this page only manages the language hint.
  providers.value[providerId] = { language: DEFAULT_LANGUAGE }
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
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Whisper (Local)'"
    :provider-description="providerMetadata?.localizedDescription"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment"
    :pricing="providerMetadata?.pricing"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :on-back="() => router.push('/settings/providers#transcription')"
  >
    <ProviderSettingsContainer class="w-full md:w-[60%] space-y-6">
      <Alert type="info">
        <template #title>
          Free, in-browser transcription
        </template>
        <template #content>
          Whisper runs entirely in your browser — no API key, and no audio leaves your device. The model
          (~800&nbsp;MB, Whisper Large V3 Turbo) downloads once on first use and is cached afterward. It uses
          WebGPU where available and falls back to WASM (CPU) otherwise.
        </template>
      </Alert>

      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <div class="space-y-4">
          <FieldSelect
            v-model="language"
            label="Recognition Language"
            description="Language hint passed to Whisper for transcription."
            :options="languageOptions"
            layout="vertical"
          />
        </div>
      </ProviderBasicSettings>

      <!-- Activation Status -->
      <div class="mt-6 flex items-center justify-between border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="space-y-1">
          <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
            {{ isEnabled ? 'Provider Active' : 'Activate Provider' }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ isEnabled ? 'This provider is active and available in Modules.' : 'Enable this provider to select it for character cards.' }}
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
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
