<script setup lang="ts">
import {
  ProviderAdvancedSettings,
  ProviderApiKeyInput,
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderInstancesSection,
  ProviderModelBrowser,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  ProviderValidationAlerts,
} from '@proj-airi/stage-ui/components'
import { useProviderValidation } from '@proj-airi/stage-ui/composables/use-provider-validation'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const providerId = route.params.providerId as string
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { activeProvider } = storeToRefs(consciousnessStore)

const activeInstanceId = ref('*')

// Get target options dictionary for current active instance
function getActiveInstanceConfig() {
  return providersStore.getProviderInstanceConfig(providerId, activeInstanceId.value)
}

const apiKey = computed({
  get: () => (getActiveInstanceConfig().options.apiKey as string) || '',
  set: (value) => {
    const config = getActiveInstanceConfig()
    config.options.apiKey = value
  },
})

const baseUrl = computed({
  get: () => (getActiveInstanceConfig().options.baseUrl as string) || '',
  set: (value) => {
    const config = getActiveInstanceConfig()
    config.options.baseUrl = value
  },
})

const activeInstanceLabel = computed(() => {
  const cfg = getActiveInstanceConfig()
  return cfg.label || cfg.id
})

const {
  router,
  providerMetadata,
  isValidating,
  isValid,
  validationMessage,
  forceValid,
  hasManualValidators,
  isManualTesting,
  manualTestPassed,
  manualTestMessage,
  runManualTest,
} = useProviderValidation(providerId)

function goToModelSelection() {
  activeProvider.value = providerId
  router.push('/settings/modules/consciousness')
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
    <ProviderSettingsContainer>
      <!-- Multi-instance management section (Select active instance to edit) -->
      <ProviderInstancesSection
        v-model:active-instance-id="activeInstanceId"
        :provider-id="providerId"
      />

      <!-- Configuration form bound to active instance -->
      <ProviderBasicSettings
        :title="`Configuration (${activeInstanceLabel})`"
        :description="`Configure credentials and endpoints for ${activeInstanceLabel}`"
      >
        <ProviderApiKeyInput
          v-model="apiKey"
          :provider-name="providerMetadata?.localizedName"
          :console-url="providerMetadata?.consoleUrl"
          placeholder="sk-..."
        />
      </ProviderBasicSettings>

      <ProviderAdvancedSettings>
        <ProviderBaseUrlInput
          v-model="baseUrl"
          :placeholder="providerMetadata?.defaultOptions?.().baseUrl as string || 'Base URL of your provider'"
        />
      </ProviderAdvancedSettings>

      <!-- In-Page Model Combobox for active instance -->
      <ProviderModelBrowser
        :provider-id="providerId"
        :instance-id="activeInstanceId"
      />

      <ProviderValidationAlerts
        :is-valid="isValid"
        :is-validating="isValidating"
        :validation-message="validationMessage"
        :has-manual-validators="hasManualValidators"
        :is-manual-testing="isManualTesting"
        :manual-test-passed="manualTestPassed"
        :manual-test-message="manualTestMessage"
        :on-run-test="runManualTest"
        :on-force-valid="forceValid"
        :on-go-to-model-selection="goToModelSelection"
      />
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
