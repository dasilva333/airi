<script setup lang="ts">
import type { RemovableRef } from '@vueuse/core'

import {
  Alert,
  ProviderAdvancedSettings,
  ProviderBasicSettings,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import { DEFAULT_WEB_RWKV_MODEL } from '@proj-airi/stage-ui/libs/inference/constants'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const providerId = 'web-rwkv'
const { t } = useI18n()
const router = useRouter()

const providersStore = useProvidersStore()
const { providers } = storeToRefs(providersStore) as { providers: RemovableRef<Record<string, any>> }

providersStore.initializeProvider(providerId)

const providerMetadata = computed(() => providersStore.getProviderMetadata(providerId))

const model = computed({
  get: () => providers.value[providerId]?.model ?? '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].model = value
  },
})

const vocab = computed({
  get: () => providers.value[providerId]?.vocab ?? '',
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].vocab = value
  },
})

const enableG1Prefill = computed({
  get: () => providers.value[providerId]?.enableG1Prefill !== false,
  set: (value) => {
    if (!providers.value[providerId])
      providers.value[providerId] = {}
    providers.value[providerId].enableG1Prefill = value
  },
})

function handleResetSettings() {
  providers.value[providerId] = { model: DEFAULT_WEB_RWKV_MODEL, vocab: '', enableG1Prefill: true }
}

const copySuccess = ref(false)
function copyPenaltiesJson() {
  const jsonText = JSON.stringify({
    presence_penalty: 0.4,
    count_penalty: 0.4,
    penalty_decay: 0.996,
  }, null, 2)
  navigator.clipboard.writeText(jsonText).then(() => {
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  })
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
    :provider-name="providerMetadata?.localizedName || 'RWKV (Local, WebGPU)'"
    :provider-description="providerMetadata?.localizedDescription"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment"
    :pricing="providerMetadata?.pricing"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :on-back="() => router.push('/settings/providers#chat')"
  >
    <ProviderSettingsContainer class="w-full md:w-[60%] space-y-6">
      <Alert type="info">
        <template #title>
          {{ t('settings.pages.providers.provider.web-rwkv.alert.title') }}
        </template>
        <template #content>
          {{ t('settings.pages.providers.provider.web-rwkv.alert.content') }}
        </template>
      </Alert>

      <ProviderBasicSettings
        :title="t('settings.pages.providers.common.section.basic.title')"
        :description="t('settings.pages.providers.common.section.basic.description')"
        :on-reset="handleResetSettings"
      >
        <div class="space-y-4">
          <FieldInput
            v-model="model"
            :label="t('settings.pages.providers.provider.web-rwkv.fields.model.label')"
            :description="t('settings.pages.providers.provider.web-rwkv.fields.model.description')"
            :placeholder="DEFAULT_WEB_RWKV_MODEL"
          />
          <FieldInput
            v-model="vocab"
            :label="t('settings.pages.providers.provider.web-rwkv.fields.vocab.label')"
            :description="t('settings.pages.providers.provider.web-rwkv.fields.vocab.description')"
            :placeholder="t('settings.pages.providers.provider.web-rwkv.fields.vocab.placeholder')"
          />
        </div>
      </ProviderBasicSettings>

      <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
        <div class="space-y-6">
          <FieldCheckbox
            v-model="enableG1Prefill"
            :label="t('settings.pages.providers.provider.web-rwkv.fields.enableG1Prefill.label')"
            :description="t('settings.pages.providers.provider.web-rwkv.fields.enableG1Prefill.description')"
          />

          <!-- Default Parameters Section -->
          <div class="border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
              {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.title') }}
            </h4>
            <p class="mb-4 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.description') }}
            </p>

            <div class="grid grid-cols-2 gap-4 border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.temperature') }}
              </div>
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.top_p') }}
              </div>
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.max_tokens') }}
              </div>
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.presence_penalty') }}
              </div>
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.count_penalty') }}
              </div>
              <div class="text-xs text-neutral-600 dark:text-neutral-400">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.field.penalty_decay') }}
              </div>
            </div>

            <div class="mt-4 border border-blue-100 rounded-lg bg-blue-50/50 p-4 text-xs text-blue-800 leading-relaxed dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
              <p class="mb-2 font-medium">
                {{ t('settings.pages.providers.provider.web-rwkv.defaultsSection.annotation') }}
              </p>
              <div class="relative mt-2">
                <pre class="cursor-pointer overflow-x-auto border border-blue-200/60 rounded bg-blue-100/30 p-2.5 text-[11px] text-blue-900 font-mono transition dark:border-blue-800/40 dark:bg-blue-900/10 hover:bg-blue-100/50 dark:text-blue-300" @click="copyPenaltiesJson"><code>{
  "presence_penalty": 0.4,
  "count_penalty": 0.4,
  "penalty_decay": 0.996
}</code></pre>
                <button
                  class="absolute right-2 top-2 rounded bg-blue-600 px-2 py-1 text-[10px] text-white font-medium transition active:scale-95 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600"
                  @click="copyPenaltiesJson"
                >
                  {{ copySuccess ? 'Copied!' : 'Copy JSON' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ProviderAdvancedSettings>

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
