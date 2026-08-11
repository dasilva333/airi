<script setup lang="ts">
import {
  ProviderAdvancedSettings,
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
import { FieldKeyValues, FieldSelect } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

const providerId = 'ollama'
const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { activeProvider } = storeToRefs(consciousnessStore)

const activeInstanceId = ref('*')

function getActiveInstanceConfig() {
  return providersStore.getProviderInstanceConfig(providerId, activeInstanceId.value)
}

const baseUrl = computed({
  get: () => (getActiveInstanceConfig().options.baseUrl as string) || 'http://localhost:11434/v1/',
  set: (value) => {
    getActiveInstanceConfig().options.baseUrl = value
  },
})

const thinkingMode = computed({
  get: () => (getActiveInstanceConfig().options.thinkingMode as string) || 'auto',
  set: (value: string) => {
    getActiveInstanceConfig().options.thinkingMode = value
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
} = useProviderValidation(providerId)

const headers = ref<{ key: string, value: string }[]>(
  Object.entries((getActiveInstanceConfig().options.headers as Record<string, string>) || {}).map(([key, value]) => ({ key, value })) || [{ key: '', value: '' }],
)

watch(activeInstanceId, () => {
  const cfgHeaders = (getActiveInstanceConfig().options.headers as Record<string, string>) || {}
  headers.value = Object.entries(cfgHeaders).map(([key, value]) => ({ key, value }))
  if (headers.value.length === 0) {
    headers.value = [{ key: '', value: '' }]
  }
})

function addKeyValue(target: { key: string, value: string }[], key: string, value: string) {
  if (!target)
    return
  target.push({ key, value })
}

function removeKeyValue(index: number, target: { key: string, value: string }[]) {
  if (!target)
    return
  if (target.length === 1) {
    target[0].key = ''
    target[0].value = ''
  }
  else {
    target.splice(index, 1)
  }
}

watch(headers, (newHeaders) => {
  if (newHeaders.length > 0 && (newHeaders[newHeaders.length - 1].key !== '' || newHeaders[newHeaders.length - 1].value !== '')) {
    newHeaders.push({ key: '', value: '' })
  }
  const config = getActiveInstanceConfig()
  config.options.headers = newHeaders
    .filter(header => header.key !== '')
    .reduce((acc, header) => {
      acc[header.key] = header.value
      return acc
    }, {} as Record<string, string>)
}, { deep: true, immediate: true })

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
      <!-- Multi-instance management section -->
      <ProviderInstancesSection
        v-model:active-instance-id="activeInstanceId"
        :provider-id="providerId"
      />

      <ProviderBasicSettings
        :title="`Configuration (${activeInstanceLabel})`"
        :description="`Configure endpoint and options for ${activeInstanceLabel}`"
        :on-reset="handleResetSettings"
      >
        <ProviderBaseUrlInput
          v-model="baseUrl"
          placeholder="http://localhost:11434/v1/"
        />
      </ProviderBasicSettings>

      <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
        <FieldSelect
          v-model="thinkingMode"
          :label="t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.label')"
          :description="t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.description')"
          :options="[
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.auto'), value: 'auto' },
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.disable'), value: 'disable' },
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.enable'), value: 'enable' },
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.low'), value: 'low' },
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.medium'), value: 'medium' },
            { label: t('settings.pages.providers.catalog.edit.config.common.fields.field.thinking-mode.options.high'), value: 'high' },
          ]"
        />

        <FieldKeyValues
          v-model="headers"
          :label="t('settings.pages.providers.common.section.advanced.fields.field.headers.label')"
          :description="t('settings.pages.providers.common.section.advanced.fields.field.headers.description')"
          :key-placeholder="t('settings.pages.providers.common.section.advanced.fields.field.headers.key.placeholder')"
          :value-placeholder="t('settings.pages.providers.common.section.advanced.fields.field.headers.value.placeholder')"
          @add="(key: string, value: string) => addKeyValue(headers, key, value)"
          @remove="(index: number) => removeKeyValue(index, headers)"
        />
      </ProviderAdvancedSettings>

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
