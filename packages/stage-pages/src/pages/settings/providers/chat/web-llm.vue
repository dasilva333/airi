<script setup lang="ts">
import {
  Alert,
  ProviderAdvancedSettings,
  ProviderBasicSettings,
  ProviderInstancesSection,
  ProviderSettingsContainer,
  ProviderSettingsLayout,
} from '@proj-airi/stage-ui/components'
import { useProviderValidation } from '@proj-airi/stage-ui/composables/use-provider-validation'
import { clearWebLlmCache, formatBytes, getWebLlmCacheSize, isWebLlmModelCached, WEB_LLM_MODELS } from '@proj-airi/stage-ui/libs/inference'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { FieldInput, FieldRange, FieldSelect } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'

const providerId = 'web-llm'
const providersStore = useProvidersStore()

const activeInstanceId = ref('*')

function getActiveInstanceConfig() {
  return providersStore.getProviderInstanceConfig(providerId, activeInstanceId.value)
}

const {
  t,
  providerMetadata,
  handleResetSettings,
  navigateBackToProviders,
} = useProviderValidation(providerId)

// --- Model selection (curated id or custom repo) ---
const model = computed({
  get: () => (getActiveInstanceConfig().options.model as string) || WEB_LLM_MODELS[0].id,
  set: (value) => {
    getActiveInstanceConfig().options.model = value
  },
})

const modelUrl = computed({
  get: () => (getActiveInstanceConfig().options.modelUrl as string) || '',
  set: (value) => {
    getActiveInstanceConfig().options.modelUrl = value
  },
})

const modelLib = computed({
  get: () => (getActiveInstanceConfig().options.modelLib as string) || '',
  set: (value) => {
    getActiveInstanceConfig().options.modelLib = value
  },
})

const temperature = computed({
  get: () => (getActiveInstanceConfig().options.temperature as number) ?? 0.7,
  set: (value) => {
    getActiveInstanceConfig().options.temperature = value
  },
})

const topP = computed({
  get: () => (getActiveInstanceConfig().options.topP as number) ?? 0.9,
  set: (value) => {
    getActiveInstanceConfig().options.topP = value
  },
})

const activeInstanceLabel = computed(() => {
  const cfg = getActiveInstanceConfig()
  return cfg.label || cfg.id
})

// A custom repo overrides the curated selection and needs both assets.
const isCustomModel = computed(() => !!modelUrl.value.trim())

const modelOptions = WEB_LLM_MODELS.map(m => ({
  label: `${m.name} — ${m.vramMB} MB VRAM`,
  value: m.id,
}))

// Keep the VRAM bookkeeping estimate in sync with the selected curated model so
// the provider's pre-allocation check reflects the resident model.
watch(model, (id) => {
  const known = WEB_LLM_MODELS.find(m => m.id === id)
  if (known)
    getActiveInstanceConfig().options.vramMB = known.vramMB
}, { immediate: true })

// --- Cache management (Cache Storage API, webllm/* scopes) ---
const cacheSize = ref(0)
const isCached = ref(false)
const cacheLoading = ref(true)
const clearing = ref(false)

async function refreshCache() {
  cacheLoading.value = true
  try {
    cacheSize.value = await getWebLlmCacheSize()
    isCached.value = await isWebLlmModelCached()
  }
  finally {
    cacheLoading.value = false
  }
}

async function handleClearCache() {
  clearing.value = true
  try {
    await clearWebLlmCache()
    await refreshCache()
  }
  finally {
    clearing.value = false
  }
}

const isEnabled = computed(() => {
  return providersStore.providerRuntimeState[providerId]?.isConfigured && !!providersStore.addedProviders[providerId]
})

async function toggleProvider() {
  if (isEnabled.value) {
    providersStore.unmarkProviderAdded(providerId)
    if (providersStore.providerRuntimeState[providerId])
      providersStore.providerRuntimeState[providerId].isConfigured = false
  }
  else {
    await providersStore.validateProvider(providerId, { force: true })
  }
}

onMounted(refreshCache)
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="providerMetadata?.localizedName || 'WebLLM (Local, WebGPU)'"
    :provider-description="providerMetadata?.localizedDescription"
    :provider-icon="providerMetadata?.icon"
    :provider-icon-color="providerMetadata?.iconColor"
    :provider-icon-image="providerMetadata?.iconImage"
    :deployment="providerMetadata?.deployment"
    :pricing="providerMetadata?.pricing"
    :beginner-recommended="providerMetadata?.beginnerRecommended"
    :on-back="navigateBackToProviders"
  >
    <ProviderSettingsContainer class="w-full space-y-6">
      <Alert type="info">
        <template #title>
          {{ t('settings.pages.providers.provider.web-llm.alert.title') }}
        </template>
        <template #content>
          {{ t('settings.pages.providers.provider.web-llm.alert.content') }}
        </template>
      </Alert>

      <!-- Multi-instance management -->
      <ProviderInstancesSection
        v-model:active-instance-id="activeInstanceId"
        :provider-id="providerId"
      />

      <ProviderBasicSettings
        :title="`${t('settings.pages.providers.provider.web-llm.sections.model.title')} (${activeInstanceLabel})`"
        :description="t('settings.pages.providers.provider.web-llm.sections.model.description')"
        :on-reset="handleResetSettings"
      >
        <div class="space-y-4">
          <FieldSelect
            v-model="model"
            :label="t('settings.pages.providers.provider.web-llm.fields.model.label')"
            :description="t('settings.pages.providers.provider.web-llm.fields.model.description')"
            :options="modelOptions"
          />
          <FieldInput
            v-model="modelUrl"
            :label="t('settings.pages.providers.provider.web-llm.fields.customRepo.label')"
            :description="t('settings.pages.providers.provider.web-llm.fields.customRepo.description')"
            :placeholder="t('settings.pages.providers.provider.web-llm.fields.customRepo.placeholder')"
          />
          <FieldInput
            v-if="isCustomModel"
            v-model="modelLib"
            :label="t('settings.pages.providers.provider.web-llm.fields.customWasm.label')"
            :description="t('settings.pages.providers.provider.web-llm.fields.customWasm.description')"
            :placeholder="t('settings.pages.providers.provider.web-llm.fields.customWasm.placeholder')"
          />
        </div>
      </ProviderBasicSettings>

      <ProviderAdvancedSettings :title="t('settings.pages.providers.common.section.advanced.title')">
        <div class="space-y-6">
          <FieldRange
            v-model="temperature"
            :label="t('settings.pages.providers.provider.web-llm.fields.temperature.label')"
            :description="t('settings.pages.providers.provider.web-llm.fields.temperature.description')"
            :min="0"
            :max="2"
            :step="0.05"
          />
          <FieldRange
            v-model="topP"
            :label="t('settings.pages.providers.provider.web-llm.fields.topP.label')"
            :description="t('settings.pages.providers.provider.web-llm.fields.topP.description')"
            :min="0"
            :max="1"
            :step="0.01"
          />
        </div>
      </ProviderAdvancedSettings>

      <!-- Weight cache management -->
      <div class="border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="flex items-center justify-between">
          <div class="space-y-1">
            <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
              {{ t('settings.pages.providers.provider.web-llm.sections.cache.title') }}
            </h4>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('settings.pages.providers.provider.web-llm.sections.cache.description') }}
            </p>
          </div>
          <div
            v-if="!cacheLoading"
            class="rounded-full px-2 py-1 text-xs font-medium"
            :class="isCached
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'"
          >
            {{ isCached ? formatBytes(cacheSize) : t('settings.pages.providers.provider.web-llm.sections.cache.notCached') }}
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <button
            class="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs text-neutral-700 font-medium transition dark:bg-neutral-700 hover:bg-neutral-300 dark:text-neutral-200 dark:hover:bg-neutral-600"
            :disabled="cacheLoading"
            @click="refreshCache"
          >
            {{ t('settings.pages.providers.provider.web-llm.sections.cache.refresh') }}
          </button>
          <button
            v-if="cacheSize > 0"
            class="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-600 font-medium transition dark:bg-red-500/20 hover:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30"
            :disabled="clearing"
            @click="handleClearCache"
          >
            {{ clearing ? t('settings.pages.providers.provider.web-llm.sections.cache.clearing') : t('settings.pages.providers.provider.web-llm.sections.cache.clear') }}
          </button>
        </div>
      </div>

      <!-- Activation -->
      <div class="mt-6 flex items-center justify-between border border-neutral-200 rounded-lg bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="space-y-1">
          <h4 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
            {{ isEnabled ? t('settings.pages.providers.provider.web-llm.activation.active.title') : t('settings.pages.providers.provider.web-llm.activation.inactive.title') }}
          </h4>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ isEnabled ? t('settings.pages.providers.provider.web-llm.activation.active.description') : t('settings.pages.providers.provider.web-llm.activation.inactive.description') }}
          </p>
        </div>
        <button
          class="rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200"
          :class="isEnabled ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:hover:bg-red-500/30' : 'bg-primary-500 text-white hover:bg-primary-600'"
          @click="toggleProvider"
        >
          {{ isEnabled ? t('settings.pages.providers.provider.web-llm.activation.deactivate') : t('settings.pages.providers.provider.web-llm.activation.activate') }}
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
