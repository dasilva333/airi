<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'

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
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const providerId = route.params.providerId as string
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }
const { activeProvider } = storeToRefs(consciousnessStore)

const apiKey = computed({
  get: () => providers.value[providerId]?.apiKey || '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].apiKey = value
  },
})

const baseUrl = computed({
  get: () => providers.value[providerId]?.baseUrl || '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].baseUrl = value
  },
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
      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <ProviderApiKeyInput
          v-model="apiKey"
          :provider-name="providerMetadata?.localizedName"
          placeholder="sk-..."
        />
      </ProviderBasicSettings>

      <!-- Multi-instance management section -->
      <ProviderInstancesSection
        :provider-id="providerId"
        @add="providersStore.getProviderInstanceConfig(providerId)"
      />

      <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
        <ProviderBaseUrlInput
          v-model="baseUrl"
          :placeholder="providerMetadata?.defaultOptions?.().baseUrl as string || 'Base URL of your provider'"
        />
      </ProviderAdvancedSettings>

      <!-- In-Page Model Combobox -->
      <ProviderModelBrowser :provider-id="providerId" />

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
