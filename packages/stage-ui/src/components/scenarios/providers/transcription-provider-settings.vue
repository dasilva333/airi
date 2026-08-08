<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  ProviderAdvancedSettings,
  ProviderApiKeyInput,
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderInstancesSection,
  ProviderModelBrowser,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '.'
import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
  // Default model to use if not specified in provider settings
  defaultModel?: string
  // Additional provider-specific settings
  additionalSettings?: Record<string, any>
  placeholder?: string
}>()

const { t } = useI18n()
const router = useRouter()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)

const activeInstanceId = ref('*')

// Get target options dictionary for current active instance
function getActiveInstanceConfig() {
  return providersStore.getProviderInstanceConfig(props.providerId, activeInstanceId.value)
}

// Get provider metadata
const providerMetadata = computed(() => providersStore.getProviderMetadata(props.providerId))

// Common provider settings
const apiKey = computed({
  get: () => (getActiveInstanceConfig().options.apiKey as string) || '',
  set: (value) => {
    getActiveInstanceConfig().options.apiKey = value
  },
})

const baseUrl = computed({
  get: () => (getActiveInstanceConfig().options.baseUrl as string) || (providerMetadata.value?.defaultOptions?.().baseUrl as string) || '',
  set: (value) => {
    getActiveInstanceConfig().options.baseUrl = value
  },
})

const activeInstanceLabel = computed(() => {
  const cfg = getActiveInstanceConfig()
  return cfg.label || cfg.id
})

onMounted(() => {
  providersStore.initializeProvider(props.providerId)
})

const isLocalProvider = computed(() => providerMetadata.value?.deployment === 'local')

function handleResetTranscriptionSettings() {
  apiKey.value = ''
  baseUrl.value = providerMetadata.value?.defaultOptions?.().baseUrl as string | undefined || ''
}

function navigateBackToProviders() {
  const category = providerMetadata.value?.category || 'transcription'
  router.push(`/settings/providers#${category}`)
}
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName"
    :provider-description="providerMetadata?.localizedDescription"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment"
    :pricing="providerMetadata?.pricing"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :console-url="providerMetadata?.consoleUrl"
    :on-back="navigateBackToProviders"
  >
    <div flex="~ col md:row gap-6">
      <ProviderSettingsContainer class="w-full md:w-[40%]">
        <!-- Multi-instance management section -->
        <ProviderInstancesSection
          v-model:active-instance-id="activeInstanceId"
          :provider-id="props.providerId"
        />

        <!-- Basic settings section -->
        <ProviderBasicSettings
          :title="`Configuration (${activeInstanceLabel})`"
          :description="`Configure credentials and options for ${activeInstanceLabel}`"
          :on-reset="handleResetTranscriptionSettings"
        >
          <!-- Smart field prioritization: Base URL first for local engines -->
          <ProviderBaseUrlInput
            v-if="isLocalProvider"
            v-model="baseUrl"
            :placeholder="providerMetadata?.defaultOptions?.().baseUrl as string || ''" required
          />
          <ProviderApiKeyInput
            v-model="apiKey"
            :provider-name="providerMetadata?.localizedName"
            :console-url="providerMetadata?.consoleUrl"
            :placeholder="props.placeholder || 'API Key'"
            :required="!isLocalProvider"
          />
          <!-- Slot for provider-specific basic settings -->
          <slot name="basic-settings" />
        </ProviderBasicSettings>

        <!-- Advanced settings section -->
        <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
          <ProviderBaseUrlInput
            v-model="baseUrl"
            :placeholder="providerMetadata?.defaultOptions?.().baseUrl as string || ''" required
          />
          <!-- Slot for provider-specific advanced settings -->
          <slot name="advanced-settings" />
        </ProviderAdvancedSettings>

        <!-- Model Browser -->
        <ProviderModelBrowser
          :provider-id="props.providerId"
          :instance-id="activeInstanceId"
        />
      </ProviderSettingsContainer>

      <!-- Playground section -->
      <div flex="~ col gap-6" class="w-full md:w-[60%]">
        <div w-full rounded-xl>
          <!-- Custom playground slot -->
          <slot name="playground" />
        </div>
      </div>
    </div>
  </ProviderSettingsLayout>
</template>
