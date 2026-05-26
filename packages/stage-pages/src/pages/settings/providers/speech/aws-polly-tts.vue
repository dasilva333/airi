<script setup lang="ts">
import { SpeechPlayground, SpeechProviderSettings } from '@proj-airi/stage-ui/components'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldInput, FieldRange, FieldSelect } from '@proj-airi/ui'
import type { SpeechProvider } from '@xsai-ext/providers/utils'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore)
const { t } = useI18n()

const defaultVoiceSettings = {
  speed: 1.0,
}

const providerId = 'aws-polly-tts'
const defaultModel = 'neural'

const speed = ref<number>((providers.value[providerId] as any)?.speed || defaultVoiceSettings.speed)

const model = computed({
  get: () => (providers.value[providerId]?.model as string | undefined) || defaultModel,
  set: (value) => {
    if (!providers.value[providerId]) providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

const secretAccessKey = computed({
  get: () => (providers.value[providerId]?.secretAccessKey as string | undefined) || '',
  set: (value) => {
    if (!providers.value[providerId]) providers.value[providerId] = {}
    providers.value[providerId].secretAccessKey = value
  },
})

const region = computed({
  get: () => (providers.value[providerId]?.region as string | undefined) || 'us-east-1',
  set: (value) => {
    if (!providers.value[providerId]) providers.value[providerId] = {}
    providers.value[providerId].region = value
  },
})

const apiKeyConfigured = computed(() => !!providers.value[providerId]?.apiKey && !!secretAccessKey.value)

const availableVoices = computed(() => {
  return speechStore.availableVoices[providerId] || []
})

const isLoadingModels = computed(() => {
  return providersStore.isLoadingModels[providerId] || false
})

onMounted(async () => {
  if (!providers.value[providerId]) {
    providers.value[providerId] = {}
  }
  if (!providers.value[providerId].model) {
    providers.value[providerId].model = defaultModel
  }
  if (!providers.value[providerId].region) {
    providers.value[providerId].region = 'us-east-1'
  }

  // Only fetch voices if we have credentials
  if (apiKeyConfigured.value) {
    await speechStore.loadVoicesForProvider(providerId)
  }
})

async function handleGenerateSpeech(input: string, voiceId: string, _useSSML: boolean) {
  const provider = await providersStore.getProviderInstance<SpeechProvider<string>>(providerId)
  if (!provider) {
    throw new Error('Failed to initialize speech provider')
  }

  const providerConfig = providersStore.getProviderConfig(providerId)
  const modelToUse = model.value || defaultModel

  return await speechStore.speech(provider, modelToUse, input, voiceId, {
    ...providerConfig,
    ...defaultVoiceSettings,
    speed: speed.value,
  })
}

watch(speed, async () => {
  if (!providers.value[providerId]) providers.value[providerId] = {}
  providers.value[providerId].speed = speed.value
})

watch(region, async () => {
  await speechStore.loadVoicesForProvider(providerId)
})

watch(model, async () => {
  if (!providers.value[providerId]) providers.value[providerId] = {}
  providers.value[providerId].model = model.value
  await speechStore.loadVoicesForProvider(providerId)
})

watch(apiKeyConfigured, async (configured) => {
  if (configured) {
    await speechStore.loadVoicesForProvider(providerId)
  }
})

const awsEngines = [
  { label: 'Neural (Lifelike & General)', value: 'neural' },
  { label: 'Generative (Ultra-High Quality)', value: 'generative' },
  { label: 'Long-form (Narrations)', value: 'long-form' },
  { label: 'Standard (Legacy AWS)', value: 'standard' },
]

const awsRegions = [
  { label: 'US East (N. Virginia)', value: 'us-east-1' },
  { label: 'US East (Ohio)', value: 'us-east-2' },
  { label: 'US West (N. California)', value: 'us-west-1' },
  { label: 'US West (Oregon)', value: 'us-west-2' },
  { label: 'Africa (Cape Town)', value: 'af-south-1' },
  { label: 'Asia Pacific (Hong Kong)', value: 'ap-east-1' },
  { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
  { label: 'Asia Pacific (Osaka)', value: 'ap-northeast-3' },
  { label: 'Asia Pacific (Seoul)', value: 'ap-northeast-2' },
  { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
  { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
  { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
  { label: 'Canada (Central)', value: 'ca-central-1' },
  { label: 'Europe (Frankfurt)', value: 'eu-central-1' },
  { label: 'Europe (Ireland)', value: 'eu-west-1' },
  { label: 'Europe (London)', value: 'eu-west-2' },
  { label: 'Europe (Milan)', value: 'eu-south-1' },
  { label: 'Europe (Paris)', value: 'eu-west-3' },
  { label: 'Europe (Stockholm)', value: 'eu-north-1' },
  { label: 'Middle East (Bahrain)', value: 'me-south-1' },
  { label: 'South America (São Paulo)', value: 'sa-east-1' },
]
</script>

<template>
  <SpeechProviderSettings
    :provider-id="providerId"
    :default-model="defaultModel"
    :additional-settings="defaultVoiceSettings"
    placeholder="AKIA..."
  >
    <template #basic-settings>
      <FieldInput
        v-model="secretAccessKey"
        label="AWS Secret Access Key"
        description="The secret key associated with your IAM user."
        placeholder="Secret Key"
        type="password"
      />
    </template>

    <template #voice-settings>
      <FieldSelect
        v-model="model"
        label="AWS Polly Engine"
        description="Select the synthesis engine type."
        :options="awsEngines"
        :disabled="isLoadingModels"
      />

      <FieldRange
        v-model="speed"
        :label="t('settings.pages.providers.provider.common.fields.field.speed.label')"
        :description="t('settings.pages.providers.provider.common.fields.field.speed.description')"
        :min="0.5"
        :max="2.0" :step="0.01"
      />
    </template>

    <template #advanced-settings>
      <FieldSelect
        v-model="region"
        label="AWS Region"
        description="Select the region where Polly is deployed."
        :options="awsRegions"
      />
    </template>

    <template #playground>
      <SpeechPlayground
        :available-voices="availableVoices"
        :generate-speech="handleGenerateSpeech"
        :api-key-configured="apiKeyConfigured"
        default-text="Hello! This is a test of Amazon Web Services Polly."
      />
    </template>
  </SpeechProviderSettings>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>
