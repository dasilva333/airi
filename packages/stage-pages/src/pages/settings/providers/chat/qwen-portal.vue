<script setup lang="ts">
import {
  ProviderBaseUrlInput,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
  ProviderValidationAlerts,
} from '@proj-airi/stage-ui/components'
import { useProviderValidation } from '@proj-airi/stage-ui/composables/use-provider-validation'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'

const providerId = 'qwen-portal'
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: any }

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
} = useProviderValidation(providerId)

// Define computed properties for credentials
const baseUrl = computed({
  get: () => providers.value[providerId]?.baseUrl || 'https://portal.qwen.ai/v1/',
  set: (value) => {
    if (!providers.value[providerId]) providers.value[providerId] = {}
    providers.value[providerId].baseUrl = value
  },
})

onMounted(() => {
  providersStore.initializeProvider(providerId)
  if (!baseUrl.value) {
    baseUrl.value = providerMetadata.value?.defaultOptions?.().baseUrl || 'https://portal.qwen.ai/v1/'
  }
})

async function refetch() {
  // Trigger generic validation if needed
}

watch(baseUrl, refetch, { deep: true, immediate: true })
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'Qwen Portal'"
    :provider-icon-color="providerMetadata?.iconColor || '#6058F8'"
    :on-back="() => router.back()"
  >
    <ProviderSettingsContainer>
      <!-- Base URL -->
      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <ProviderBaseUrlInput
          v-model="baseUrl"
          placeholder="https://portal.qwen.ai/v1/"
        />
      </ProviderBasicSettings>

      <!-- OAuth Section (WIP) -->
      <!-- <ProviderQwenOAuthSection /> -->

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
        :on-go-to-model-selection="() => router.push('/settings/modules/consciousness')"
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
