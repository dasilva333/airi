<script setup lang="ts">
import {
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

const providerId = 'lm-studio'
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { activeProvider } = storeToRefs(consciousnessStore)

const activeInstanceId = ref('*')

function getActiveInstanceConfig() {
  return providersStore.getProviderInstanceConfig(providerId, activeInstanceId.value)
}

const baseUrl = computed({
  get: () => (getActiveInstanceConfig().options.baseUrl as string) || 'http://localhost:1234/v1/',
  set: (value) => {
    getActiveInstanceConfig().options.baseUrl = value
  },
})

const activeInstanceLabel = computed(() => {
  const cfg = getActiveInstanceConfig()
  return cfg.label || cfg.id
})

const {
  t,
  router,
  providerMetadata,
  isValidating,
  isValid,
  validationMessage,
  handleResetSettings,
  forceValid,
  hasManualValidators,
  isManualTesting,
  manualTestPassed,
  manualTestMessage,
  runManualTest,
  navigateBackToProviders,
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
    :on-back="navigateBackToProviders"
  >
    <ProviderSettingsContainer>
      <!-- Multi-instance management section -->
      <ProviderInstancesSection
        v-model:active-instance-id="activeInstanceId"
        :provider-id="providerId"
      />

      <ProviderBasicSettings
        :title="`Configuration (${activeInstanceLabel})`"
        :description="`Configure local endpoint for ${activeInstanceLabel}`"
        :on-reset="handleResetSettings"
      >
        <ProviderBaseUrlInput
          v-model="baseUrl"
          placeholder="http://localhost:1234/v1/"
        />
      </ProviderBasicSettings>

      <!-- In-Page Model Combobox for active instance -->
      <ProviderModelBrowser
        :provider-id="providerId"
        :instance-id="activeInstanceId"
      />

      <!-- Validation Status -->
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
  stageTransition:
    name: slide
</route>
