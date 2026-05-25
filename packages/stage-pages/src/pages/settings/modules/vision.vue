<script setup lang="ts">
import { Alert, ErrorContainer, RadioCardManySelect, RadioCardSimple } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

const providersStore = useProvidersStore()
const visionStore = useVisionStore()
const { persistedVisionProvidersMetadata, configuredProviders } = storeToRefs(providersStore)
const {
  activeProvider,
  activeModel,
  supportsModelListing,
  providerModels,
  isLoadingActiveProviderModels,
  activeProviderModelError,
} = storeToRefs(visionStore)

const currentStrategy = ref('direct')
const customModelName = ref('')
const modelSearchQuery = ref('')

const filteredModels = computed(() => {
  // Bypass strict modality filtering for local/BYOM providers as they often lack metadata
  if (['lm-studio', 'ollama', 'openai-compatible'].includes(activeProvider.value)) {
    return providerModels.value
  }
  const models = providerModels.value.filter((model: any) => model.capabilities?.includes('vision'))
  if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
    console.log(`[Vision UI] Provider Models: ${providerModels.value.length}, Filtered Models: ${models.length}`)
  }
  return models
})

watch(
  providerModels,
  (models) => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
      console.log('[Vision UI] providerModels updated:', models)
    }
  },
  { deep: true },
)

const { t } = useI18n()
const { trackProviderClick } = useAnalytics()
const isOpenAICompatibleProvider = computed(() => activeProvider.value === 'openai-compatible')

watch(
  activeProvider,
  async (provider, oldProvider) => {
    if (!provider) return

    // Reset model when switching providers (but not on initial load)
    if (oldProvider !== undefined && oldProvider !== provider) {
      activeModel.value = ''
    }

    await visionStore.loadModelsForProvider(provider)
  },
  { immediate: true },
)

// Feedback when model is set
watch(activeModel, (newModel, oldModel) => {
  if (newModel && oldModel !== undefined && newModel !== oldModel) {
    toast.success(`Vision model updated to: ${newModel}`)
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
          <div flex="~ row items-center justify-between gap-2">
            <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
              Vision Provider
            </h2>
            <div
              v-if="visionStore.configured"
              class="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400"
            >
              <div i-solar:check-circle-bold class="text-sm" />
              <span>Configured</span>
            </div>
            <div
              v-else
              class="flex items-center gap-1.5 rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-500"
            >
              <div i-solar:info-circle-bold class="text-sm" />
              <span>Not Configured</span>
            </div>
          </div>
          <div text="neutral-400 dark:neutral-400">
            <span>Select the AI provider and model you want to use for visual analysis and image processing.</span>
          </div>
        </div>
        <div max-w-full>
          <fieldset
            v-if="persistedVisionProvidersMetadata.length > 0"
            flex="~ col gap-2"
            class="max-h-[300px] overflow-y-auto pr-2" min-w-0
            role="radiogroup"
          >
            <RadioCardSimple
              v-for="metadata in persistedVisionProvidersMetadata"
              :id="metadata.id"
              :key="metadata.id"
              v-model="activeProvider"
              name="provider"
              :value="metadata.id"
              :title="metadata.name || 'Unknown'"
              :description="metadata.description"
              @click="trackProviderClick(metadata.id, 'vision')"
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
                <span class="font-medium">No Vision Providers Configured</span>
                <span class="text-sm text-neutral-400 dark:text-neutral-500">Go to Settings > Providers to set up a provider for vision tasks. Setup OpenAI or OpenRouter.</span>
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
            Vision Model
          </h2>
          <div class="flex flex-col items-start gap-1 text-neutral-400 md:flex-row md:items-center md:justify-between dark:text-neutral-400">
            <span>Select the model architecture.</span>
            <div class="flex items-center gap-2 text-sm font-medium">
              <span class="text-neutral-400 dark:text-neutral-400">Current Model:</span>
              <span v-if="activeModel" class="text-primary-500 dark:text-primary-400">{{ activeModel }}</span>
              <span v-else class="text-neutral-400/50 italic">Not Set</span>
            </div>
          </div>
        </div>

        <div v-if="isLoadingActiveProviderModels" class="flex items-center justify-center py-4">
          <div class="mr-2 animate-spin">
            <div i-solar:spinner-line-duotone text-xl />
          </div>
          <span>Loading models...</span>
        </div>

        <template v-else-if="activeProviderModelError">
          <ErrorContainer
            title="Failed to fetch models"
            :error="activeProviderModelError"
          />

          <div v-if="isOpenAICompatibleProvider" class="mt-2">
            <label class="mb-1 block text-sm font-medium">
              Model ID (Manual)
            </label>
            <input
              v-model="activeModel"
              type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="e.g. gpt-4o-mini"
            >
          </div>
        </template>

        <div v-if="activeProviderModelError" class="mt-2">
          <label class="mb-1 block text-sm font-medium">
            Model ID (Manual)
          </label>
          <input
            v-model="activeModel" type="text"
            class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="e.g. gpt-4o-mini"
          >
        </div>

        <template v-else-if="providerModels.length === 0 && !isLoadingActiveProviderModels">
          <Alert type="warning">
            <template #title>
              No models found
            </template>
            <template #content>
              We couldn't retrieve any available models from the provider. You might need to specify the model name manually if you're using a custom endpoint.
            </template>
          </Alert>

          <div v-if="isOpenAICompatibleProvider" class="mt-2">
            <label class="mb-1 block text-sm font-medium">
              Model ID (Manual)
            </label>
            <input
              v-model="activeModel"
              type="text"
              class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="e.g. gpt-4o-mini"
            >
          </div>
        </template>

        <template v-else-if="providerModels.length > 0">
          <RadioCardManySelect
            v-model="activeModel"
            v-model:search-query="modelSearchQuery"
            :items="filteredModels"
            :searchable="true"
            :allow-custom="true"
            search-placeholder="Search models..."
            search-no-results-title="No results found"
            search-no-results-description="Could not find any matching models"
            search-results-text="Found {count} out of {total} models"
            custom-input-placeholder="Type custom model ID..."
            expand-button-text="Show more"
            collapse-button-text="Show less"
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
            Vision Model
          </h2>
          <div text="neutral-400 dark:neutral-500">
            <span>Select the model architecture.</span>
          </div>
        </div>

        <div
          class="flex items-center gap-3 border border-primary-200 rounded-lg bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20"
        >
          <div i-solar:info-circle-line-duotone class="text-2xl text-primary-500 dark:text-primary-400" />
          <div class="flex flex-col">
            <span class="font-medium">Model listing not supported</span>
            <span class="text-sm text-primary-600 dark:text-primary-400">This provider does not support retrieving a list of available models. Please enter the exact model ID manually.</span>
          </div>
        </div>

        <div class="mt-2">
          <label class="mb-1 block text-sm font-medium">
            Model ID (Manual)
          </label>
          <input
            v-model="activeModel" type="text"
            class="w-full border border-neutral-300 rounded bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="e.g. gpt-4o-mini"
          >
        </div>
      </div>
    </div>

    <!-- Mock Strategy Section -->
    <div v-if="activeProvider && activeModel">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
            Image Description
          </h2>
          <div text="neutral-400 dark:neutral-400">
            <span>What should the model do with the description of the image provided?</span>
          </div>
        </div>

        <div flex="~ col gap-2" class="max-h-[300px] overflow-y-auto pr-2" max-w-full pb-2>
          <RadioCardSimple
            id="strategy-direct"
            v-model="currentStrategy"
            name="strategy"
            value="direct"
            title="Direct Response"
            description="Allow this vision model to reply to the image"
            class="min-w-60"
          />
          <RadioCardSimple
            id="strategy-forward"
            v-model="currentStrategy"
            name="strategy"
            value="forward"
            title="Forward to LLM"
            description="Forward the description of the image to your consciousness model"
            class="min-w-65"
            :disabled="true"
          >
            <template #title>
              <div flex="~ row items-center gap-2">
                <span>Forward to LLM</span>
                <span class="rounded bg-neutral-200 px-1.5 py-0.5 text-[10px] text-neutral-500 font-bold tracking-wider uppercase dark:bg-neutral-800 dark:text-neutral-400">
                  Planned
                </span>
              </div>
            </template>
          </RadioCardSimple>
        </div>
      </div>
    </div>

    <!-- Prompt Shim Section -->
    <div v-if="activeProvider && activeModel">
      <div flex="~ col gap-4">
        <div>
          <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
            Vision Directives
          </h2>
          <div text="neutral-400 dark:neutral-400">
            <span>Hidden instructions sent alongside images to guide the vision model's behavior and personality.</span>
          </div>
        </div>

        <div class="space-y-2">
          <textarea
            v-model="visionStore.promptShim"
            class="min-h-24 w-full border border-neutral-300 rounded-lg bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
            placeholder="Enter hidden vision directives..."
          />
          <div class="flex justify-end">
            <button
              class="text-xs text-neutral-400 transition-colors hover:text-primary-500"
              @click="visionStore.promptShim = 'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about \'analyzing\' or \'describing\' the image for the user. Just react to what you see as the character would.'"
            >
              Reset to default
            </button>
          </div>
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
    <div text="60" i-solar:eye-scan-bold-duotone />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.vision.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>
