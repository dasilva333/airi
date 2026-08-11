<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ProviderSettingsLayout from './provider-settings-layout.vue'

import {
  ProviderAdvancedSettings,
  ProviderApiKeyInput,
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderInstancesSection,
  ProviderModelBrowser,
  ProviderSettingsContainer,
} from '.'
import { useSpeechStore } from '../../../stores/modules/speech'
import { useProvidersStore } from '../../../stores/providers'

const props = defineProps<{
  providerId: string
  // Default model to use if not specified in provider settings
  defaultModel?: string
  // Additional provider-specific settings
  additionalSettings?: Record<string, any>
  placeholder?: string
}>()

// Expose slots and emit events to allow customization
defineSlots<{
  'basic-settings': (props: any) => any
  'voice-settings': (props: any) => any
  'advanced-settings': (props: any) => any
  'playground': (props: any) => any
}>()
const { t } = useI18n()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
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

// Voice settings as reactive objects to allow for different provider settings
const voiceSettings = ref<Record<string, any>>({})

// Initialize voice settings with defaults or from provider
function initializeVoiceSettings() {
  if (providers.value[props.providerId]?.voiceSettings) {
    voiceSettings.value = { ...(providers.value[props.providerId].voiceSettings as Record<string, any> | undefined) }
  }
  else {
    // Default values that most providers use
    voiceSettings.value = {
      pitch: 0,
      speed: 1.0,
      volume: 0,
      // Provider-specific defaults can be set in the onMounted lifecycle
      ...props.additionalSettings,
    }
  }
}

onMounted(() => {
  providersStore.initializeProvider(props.providerId)

  // Initialize voice settings
  initializeVoiceSettings()

  // Load voices if provider is configured
  if (providersStore.configuredProviders[props.providerId]) {
    speechStore.loadVoicesForProvider(props.providerId)
  }
})

const debouncedUpdate = useDebounceFn(() => {
  providers.value[props.providerId] = {
    ...providers.value[props.providerId],
    apiKey: apiKey.value,
    baseUrl: baseUrl.value || providerMetadata.value?.defaultOptions?.().baseUrl || '',
    voiceSettings: { ...voiceSettings.value },
  }
}, 1000)

// Watch all settings and update the provider configuration
watch([apiKey, baseUrl], debouncedUpdate)

// Watch voice settings for changes
watch(voiceSettings, debouncedUpdate, { deep: true })

const isLocalProvider = computed(() => providerMetadata.value?.deployment === 'local')

function handleResetVoiceSettings() {
  voiceSettings.value = { ...(providerMetadata.value?.defaultOptions?.().voiceSettings as Record<string, unknown>) }
  debouncedUpdate()
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
  >
    <div flex="~ col md:row gap-6">
      <ProviderSettingsContainer class="w-full md:w-[40%]">
        <!-- Multi-instance management section (only for cloud or remote providers requiring credentials) -->
        <ProviderInstancesSection
          v-if="providerMetadata?.requiresCredentials !== false && !isLocalProvider"
          v-model:active-instance-id="activeInstanceId"
          :provider-id="props.providerId"
        />

        <!-- Basic settings section -->
        <ProviderBasicSettings
          :title="isLocalProvider ? t('settings.pages.providers.common.section.basic.title') : `Configuration (${activeInstanceLabel})`"
          :description="isLocalProvider ? t('settings.pages.providers.common.section.basic.description') : `Configure credentials and options for ${activeInstanceLabel}`"
          :on-reset="handleResetVoiceSettings"
        >
          <!-- Smart field prioritization: Base URL first for local engines -->
          <ProviderBaseUrlInput
            v-if="isLocalProvider"
            v-model="baseUrl"
            :placeholder="providerMetadata?.defaultOptions?.().base_url as string || ''" required
          />
          <ProviderApiKeyInput
            v-if="providerMetadata?.requiresCredentials !== false"
            v-model="apiKey"
            :provider-name="providerMetadata?.localizedName"
            :console-url="providerMetadata?.consoleUrl"
            :placeholder="props.placeholder || 'API Key'"
            :required="!isLocalProvider"
          />
          <!-- Slot for provider-specific basic settings -->
          <slot name="basic-settings" />
        </ProviderBasicSettings>

        <!-- Voice settings section -->
        <div flex="~ col gap-6">
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
            {{ t('settings.pages.providers.common.section.voice.title') }}
          </h2>
          <div flex="~ col gap-4">
            <!-- Common voice settings with ranges -->
            <slot name="voice-settings" />
          </div>
        </div>

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
