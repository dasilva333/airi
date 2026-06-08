<script setup lang="ts">
import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { getElectronEventaContext } from '@proj-airi/electron-vueuse'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { Alert, ErrorContainer, RadioCardManySelect, RadioCardSimple } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const providersStore = useProvidersStore()
const consciousnessStore = useConsciousnessStore()
const { persistedChatProvidersMetadata, configuredProviders } = storeToRefs(providersStore)
const {
  activeProvider,
  activeModel,
  customModelName,
  modelSearchQuery,
  supportsModelListing,
  providerModels,
  isLoadingActiveProviderModels,
  activeProviderModelError,
  lastSelectedModelPerProvider,
} = storeToRefs(consciousnessStore)

const { t } = useI18n()
const { trackProviderClick } = useAnalytics()
const isOpenAICompatibleProvider = computed(() => activeProvider.value === 'openai-compatible')

const electronLocalLlmGetStatus = defineInvokeEventa<any>('eventa:invoke:electron:local-llm:get-status')
const electronLocalLlmStopServer = defineInvokeEventa<void>('eventa:invoke:electron:local-llm:stop-server')
const electronLocalLlmStartServer = defineInvokeEventa<void, { modelId: string }>('eventa:invoke:electron:local-llm:start-server')
const localLlmStatus = ref<any>(null)
const isStartingServer = ref(false)
let localLlmPollInterval: any = null

async function handleStartServer() {
  if (typeof window === 'undefined' || isStartingServer.value)
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    isStartingServer.value = true

    // Immediately set local status state to 'starting' so pill updates instantly
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'starting'
    }

    const startServer = defineInvoke(context, electronLocalLlmStartServer)
    await startServer({ modelId: activeModel.value })
    providersStore.forceProviderConfigured('local-llm')
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('Failed to start local LLM server:', err)
  }
  finally {
    isStartingServer.value = false
  }
}

async function handleStopServer() {
  if (typeof window === 'undefined')
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    const stopServer = defineInvoke(context, electronLocalLlmStopServer)

    // Immediately clear local models and mark unconfigured in store
    const runtimeState = providersStore.providerRuntimeState['local-llm']
    if (runtimeState) {
      runtimeState.models = []
      runtimeState.isConfigured = false
    }

    // Immediately set local status state to 'stopped' so pill updates instantly
    if (localLlmStatus.value) {
      localLlmStatus.value.state = 'stopped'
    }

    await stopServer()
    await updateLocalLlmStatus()
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
  catch (err) {
    console.error('Failed to stop local LLM server:', err)
  }
}

async function updateLocalLlmStatus() {
  if (!isStageTamagotchi())
    return
  if (typeof window === 'undefined')
    return
  const context = getElectronEventaContext()
  if (!context)
    return
  try {
    const getStatus = defineInvoke(context, electronLocalLlmGetStatus)
    localLlmStatus.value = await getStatus()
  }
  catch (err) {
    console.error('Failed to get local LLM status:', err)
  }
}

watch(activeProvider, async (provider, oldProvider) => {
  if (!provider)
    return

  // Reset or restore model when switching providers (but not on initial load)
  if (oldProvider !== undefined && oldProvider !== provider) {
    const savedModel = lastSelectedModelPerProvider.value?.[provider]
    activeModel.value = savedModel || ''
  }

  await consciousnessStore.loadModelsForProvider(provider)
}, { immediate: true })

watch(activeProvider, (provider) => {
  if (provider === 'local-llm') {
    updateLocalLlmStatus()
    if (!localLlmPollInterval) {
      localLlmPollInterval = setInterval(updateLocalLlmStatus, 3000)
    }
  }
  else {
    if (localLlmPollInterval) {
      clearInterval(localLlmPollInterval)
      localLlmPollInterval = null
    }
  }
}, { immediate: true })

watch(() => localLlmStatus.value?.state, async (newState, oldState) => {
  if (newState === 'running' && (oldState !== 'running' || providerModels.value.length === 0)) {
    await providersStore.fetchModelsForProvider('local-llm')
    await providersStore.validateProvider('local-llm', { force: true })
  }
})

onUnmounted(() => {
  if (localLlmPollInterval) {
    clearInterval(localLlmPollInterval)
  }
})

function updateCustomModelName(value: string) {
  customModelName.value = value
}

function handleDeleteProvider(providerId: string) {
  if (activeProvider.value === providerId) {
    activeProvider.value = ''
    activeModel.value = ''
  }
  providersStore.deleteProvider(providerId)
}
</script>

<template>
  <div bg="neutral-50 dark:[rgba(0,0,0,0.3)]" rounded-xl p-4 flex="~ col gap-4">
    <div>
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
            {{ t('settings.pages.providers.title') }}
          </h2>
          <div text="neutral-400 dark:neutral-400">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.description') }}</span>
          </div>
        </div>
        <div max-w-full>
          <!--
          fieldset has min-width set to --webkit-min-container, in order to use over flow scroll,
          we need to set the min-width to 0.
          See also: https://stackoverflow.com/a/33737340
        -->
          <fieldset
            v-if="persistedChatProvidersMetadata.length > 0"
            flex="~ col gap-2"
            class="max-h-[300px] overflow-y-auto pr-2" min-w-0
            role="radiogroup"
          >
            <RadioCardSimple
              v-for="metadata in persistedChatProvidersMetadata"
              :id="metadata.id"
              :key="metadata.id"
              v-model="activeProvider"
              name="provider"
              :value="metadata.id"
              :title="metadata.localizedName || 'Unknown'"
              :description="metadata.localizedDescription"
              @click="trackProviderClick(metadata.id, 'consciousness')"
            >
              <template #topRight>
                <button
                  type="button"
                  class="rounded bg-neutral-100 p-1 text-neutral-600 transition-colors dark:bg-neutral-800/60 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700/60"
                  @click.stop.prevent="handleDeleteProvider(metadata.id)"
                >
                  <div i-solar:trash-bin-trash-bold-duotone class="text-base" />
                </button>
              </template>

              <template v-if="configuredProviders[metadata.id] === false" #bottomRight>
                <div class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-300">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.health_check_failed') }}
                </div>
              </template>
            </RadioCardSimple>
            <RouterLink
              to="/settings/providers"
              border="2px dashed"
              class="border-neutral-200 bg-transparent text-neutral-400 dark:border-neutral-800 hover:border-primary-500/50 hover:bg-neutral-50 hover:text-primary-500 dark:hover:border-primary-400/50 dark:hover:bg-neutral-900/50 dark:hover:text-primary-400"
              flex="~ row items-center justify-center gap-2"
              transition="all duration-200 ease-in-out"
              relative w-full shrink-0 rounded-xl p-3
            >
              <div i-solar:add-circle-line-duotone class="text-xl" />
              <span class="text-sm font-medium">Add Provider</span>
            </RouterLink>
          </fieldset>
          <div v-else>
            <RouterLink
              class="flex items-center gap-3 rounded-lg p-4"
              border="2 dashed neutral-200 dark:neutral-800"
              bg="neutral-50 dark:neutral-800"
              transition="colors duration-200 ease-in-out"
              to="/settings/providers"
            >
              <div i-solar:warning-circle-line-duotone class="text-2xl text-amber-500 dark:text-amber-400" />
              <div class="flex flex-col">
                <span class="font-medium">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_title') }}</span>
                <span class="text-sm text-neutral-400 dark:text-neutral-500">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_providers_configured_description') }}</span>
              </div>
              <div i-solar:arrow-right-line-duotone class="ml-auto text-xl text-neutral-400 dark:text-neutral-500" />
            </RouterLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Model selection section -->
    <div v-if="activeProvider && supportsModelListing">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg md:text-2xl">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
          </h2>
          <div class="flex flex-col items-start gap-1 text-neutral-400 md:flex-row md:items-center md:justify-between dark:text-neutral-400">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.subtitle') }}</span>
            <div v-if="activeModel" :class="['flex items-center gap-2 text-sm text-neutral-400 font-medium dark:text-neutral-400']">
              <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.current_model_label') }} {{ activeModel }}</span>
              <span
                v-if="activeProvider === 'local-llm' && localLlmStatus"
                :class="[
                  'px-2 py-0.5 rounded text-[10px] font-bold border',
                  localLlmStatus.state === 'running'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : localLlmStatus.state === 'starting'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                      : 'bg-red-500/10 text-red-500 border-red-500/20',
                ]"
              >
                {{ localLlmStatus.state === 'running' ? 'Running' : localLlmStatus.state === 'starting' ? 'Starting' : 'Offline' }}
              </span>
              <button
                v-if="activeProvider === 'local-llm' && localLlmStatus && (localLlmStatus.state === 'running' || localLlmStatus.state === 'starting')"
                type="button"
                :class="['px-2 py-0.5 text-[10px] font-bold rounded border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer flex items-center gap-1 shrink-0']"
                @click="handleStopServer"
              >
                <div i-solar:stop-circle-line-duotone />
                <span>Stop Server</span>
              </button>
              <button
                v-if="activeProvider === 'local-llm' && localLlmStatus && localLlmStatus.state !== 'running' && localLlmStatus.state !== 'starting'"
                type="button"
                :disabled="isStartingServer"
                :class="['px-2 py-0.5 text-[10px] font-bold rounded border border-green-500/20 bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors cursor-pointer flex items-center gap-1 shrink-0', isStartingServer && 'opacity-50 cursor-not-allowed']"
                @click="handleStartServer"
              >
                <div i-solar:play-circle-line-duotone />
                <span>Start Server</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="isLoadingActiveProviderModels || (activeProvider === 'local-llm' && localLlmStatus && localLlmStatus.state === 'starting')" class="flex items-center justify-center py-4">
          <div class="mr-2 animate-spin">
            <div i-solar:spinner-line-duotone text-xl />
          </div>
          <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.loading') }}</span>
        </div>

        <!-- Error state -->
        <template v-else-if="activeProviderModelError">
          <ErrorContainer
            :title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.error')"
            :error="activeProviderModelError"
          />

          <div v-if="isOpenAICompatibleProvider" class="mt-2">
            <label class="mb-1 block text-sm font-medium">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
            </label>
            <input
              v-model="activeModel"
              type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
            >
          </div>
        </template>

        <!-- Manual model input fallback when model list fails to load -->
        <div v-if="activeProviderModelError" class="mt-2">
          <label class="mb-1 block text-sm font-medium">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
          </label>
          <input
            v-model="activeModel" type="text"
            class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
          >
        </div>

        <!-- No models available -->
        <template v-else-if="providerModels.length === 0 && !isLoadingActiveProviderModels && !(activeProvider === 'local-llm' && localLlmStatus && localLlmStatus.state === 'starting')">
          <div v-if="activeProvider === 'local-llm'" :class="['flex flex-col gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-900/10 text-neutral-900 dark:text-neutral-100']">
            <div :class="['flex items-start gap-3']">
              <div :class="['i-solar:warning-circle-bold-duotone text-2xl text-amber-500 shrink-0']" />
              <div :class="['flex flex-col gap-1']">
                <span :class="['font-bold text-sm']">Local Server is Offline</span>
                <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                  Press "Start Server" to run your latest loaded model, or go to Local LLM settings to select a new one.
                </span>
              </div>
            </div>
            <div :class="['flex gap-2 justify-end mt-1']">
              <RouterLink
                to="/settings/providers/chat/local-llm"
                :class="['px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold transition']"
              >
                Go to Local LLM Settings
              </RouterLink>
            </div>
          </div>
          <Alert v-else type="warning">
            <template #title>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models') }}
            </template>
            <template #content>
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_description') }}
            </template>
          </Alert>

          <div v-if="isOpenAICompatibleProvider" class="mt-2">
            <label class="mb-1 block text-sm font-medium">
              {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
            </label>
            <input
              v-model="activeModel"
              type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
            >
          </div>
        </template>

        <!-- Using the new RadioCardManySelect component -->
        <template v-else-if="providerModels.length > 0">
          <RadioCardManySelect
            v-model="activeModel"
            v-model:search-query="modelSearchQuery"
            :items="providerModels"
            :searchable="true"
            :allow-custom="true"
            :search-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_placeholder')"
            :search-no-results-title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results')"
            :search-no-results-description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results_description', { query: modelSearchQuery })"
            :search-results-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_results', { count: '{count}', total: '{total}' })"
            :custom-input-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.custom_model_placeholder')"
            :expand-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.expand')"
            :collapse-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.collapse')"
            @update:custom-value="updateCustomModelName"
          />
        </template>
      </div>
    </div>

    <!-- Provider doesn't support model listing -->
    <div v-else-if="activeProvider && !supportsModelListing">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
          </h2>
          <div text="neutral-400 dark:neutral-500">
            <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.subtitle') }}</span>
          </div>
        </div>

        <div
          class="flex items-center gap-3 border border-primary-200 rounded-lg bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20"
        >
          <div i-solar:info-circle-line-duotone class="text-2xl text-primary-500 dark:text-primary-400" />
          <div class="flex flex-col">
            <span class="font-medium">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported')
            }}</span>
            <span class="text-sm text-primary-600 dark:text-primary-400">{{
              t('settings.pages.modules.consciousness.sections.section.provider-model-selection.not_supported_description') }}</span>
          </div>
        </div>

        <!-- Manual model input for providers without model listing -->
        <div class="mt-2">
          <label class="mb-1 block text-sm font-medium">
            {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_name') }}
          </label>
          <input
            v-model="activeModel" type="text"
            class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
          >
        </div>
      </div>
    </div>
  </div>

  <div
    v-motion
    text="neutral-200/50 dark:neutral-600/20" pointer-events-none
    fixed top="[calc(100dvh-15rem)]" bottom-0 right--5 z--1
    :initial="{ scale: 0.9, opacity: 0, x: 20 }"
    :enter="{ scale: 1, opacity: 1, x: 0 }"
    :duration="500"
    size-60
    flex items-center justify-center
  >
    <div text="60" i-solar:ghost-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.consciousness.title
  subtitleKey: settings.title
  settingsEntry: true
  order: 7
  stageTransition:
    name: slide
</route>
