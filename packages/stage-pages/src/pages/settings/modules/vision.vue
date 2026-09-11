<script setup lang="ts">
import { Alert, ErrorContainer, RadioCardManySelect, RadioCardSimple } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useVisionStore } from '@proj-airi/stage-ui/stores/modules/vision'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

const providersStore = useProvidersStore()
const visionStore = useVisionStore()
const consciousnessStore = useConsciousnessStore()
const cardStore = useAiriCardStore()
const llmStore = useLLM()

const { persistedVisionProvidersMetadata, configuredProviders } = storeToRefs(providersStore)
const { activeCard } = storeToRefs(cardStore)
const {
  activeProvider,
  activeModel,
  supportsModelListing,
  providerModels,
  isLoadingActiveProviderModels,
  activeProviderModelError,
  strategy,
} = storeToRefs(visionStore)

const characterName = computed(() => activeCard.value?.name || 'Airi')
const characterAvatar = computed(() => {
  const metaAvatar = (activeCard.value?.extensions as any)?.airi?.avatar
  return metaAvatar || ''
})

const activePromptShim = computed({
  get() {
    return strategy.value === 'forward'
      ? visionStore.promptShimForward
      : visionStore.promptShimDirect
  },
  set(value: string) {
    if (strategy.value === 'forward') {
      visionStore.promptShimForward = value
    }
    else {
      visionStore.promptShimDirect = value
    }
  },
})

function resetActivePromptShim() {
  if (strategy.value === 'forward') {
    visionStore.promptShimForward = 'You are an objective image analysis model. Analyze the provided image in the context of the conversation and the user\'s latest message. Describe the key visual details, subjects, actions, colors, text, or any specific elements mentioned or asked about by the user, so that the primary chat LLM can respond appropriately. Keep your analysis descriptive and objective, and avoid any conversational filler.'
  }
  else {
    visionStore.promptShimDirect = 'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about "analyzing" or "describing" the image for the user. Just react to what you see as the character would.'
  }
}

const customModelName = ref('')
const modelSearchQuery = ref('')

const filteredModels = computed(() => {
  const models = providerModels.value.filter((model: any) => model.capabilities?.includes('vision'))
  if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
    console.log(`[Vision UI] Provider Models: ${providerModels.value.length}, Filtered Models: ${models.length}`)
  }
  return models
})

watch(providerModels, (models) => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('airi:debug') === '1') {
    console.log('[Vision UI] providerModels updated:', models)
  }
}, { deep: true })

const { t } = useI18n()
const { trackProviderClick } = useAnalytics()

async function syncOrAdoptModel(provider: string) {
  if (!provider)
    return

  await visionStore.loadModelsForProvider(provider)

  // Auto-adopt the provider's configured model if activeModel is empty or invalid
  const availableModels = filteredModels.value
  const isCurrentModelValid = activeModel.value && availableModels.some((m: any) => m.id === activeModel.value)

  if (!isCurrentModelValid) {
    const providerConfig = providersStore.getProviderConfig(provider)
    const providerMetadata = providersStore.getProviderMetadata(provider)
    const configuredModel = providerConfig?.model as string | undefined
    const defaultModel = providerMetadata?.defaultOptions?.()?.model as string | undefined

    if (configuredModel && availableModels.some((m: any) => m.id === configuredModel)) {
      activeModel.value = configuredModel
    }
    else if (defaultModel && availableModels.some((m: any) => m.id === defaultModel)) {
      activeModel.value = defaultModel
    }
    else if (configuredModel) {
      activeModel.value = configuredModel
    }
    else if (availableModels.length > 0) {
      activeModel.value = availableModels[0].id
    }
    else if (defaultModel) {
      activeModel.value = defaultModel
    }
  }
}

watch(activeProvider, async (provider) => {
  if (!provider) {
    activeModel.value = ''
    return
  }
  await syncOrAdoptModel(provider)
}, { immediate: true })

watch(filteredModels, (models) => {
  if (!activeProvider.value || models.length === 0)
    return

  const isCurrentModelValid = activeModel.value && models.some((m: any) => m.id === activeModel.value)
  if (!isCurrentModelValid) {
    const providerConfig = providersStore.getProviderConfig(activeProvider.value)
    const configuredModel = providerConfig?.model as string | undefined
    if (configuredModel && models.some((m: any) => m.id === configuredModel)) {
      activeModel.value = configuredModel
    }
    else {
      activeModel.value = models[0].id
    }
  }
})

// Feedback when model is set
watch(activeModel, (newModel, oldModel) => {
  if (newModel && oldModel !== undefined && newModel !== oldModel) {
    toast.success(`Vision model updated to: ${newModel}`)
  }
  if (newModel && activeProvider.value && providersStore.providers[activeProvider.value]) {
    providersStore.providers[activeProvider.value].model = newModel
  }
})

function updateCustomModelName(value: string) {
  customModelName.value = value
}

// ----------------------------------------------------------------------------------
// Faux-Chat Simulator State & Actions
// ----------------------------------------------------------------------------------

const fileInput = ref<HTMLInputElement | null>(null)
const testImageFile = ref<File | null>(null)
const testImageUrl = ref<string | null>(null)
const isSimulating = ref(false)
const hop1Processing = ref(false)
const hop2Processing = ref(false)
const hop1Result = ref('')
const hop1Latency = ref<number | null>(null)
const hop2Result = ref('')
const hop2Latency = ref<number | null>(null)
const simulationError = ref('')

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    setImageFile(target.files[0])
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    setImageFile(event.dataTransfer.files[0])
  }
}

function setImageFile(file: File) {
  testImageFile.value = file
  testImageUrl.value = URL.createObjectURL(file)
  hop1Result.value = ''
  hop1Latency.value = null
  hop2Result.value = ''
  hop2Latency.value = null
  simulationError.value = ''
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function runSimulation() {
  if (!testImageUrl.value || !testImageFile.value) {
    simulationError.value = 'Please attach or drop an image first.'
    return
  }

  if (!activeProvider.value || !activeModel.value) {
    simulationError.value = 'Please select a Vision Provider and Model first.'
    return
  }

  simulationError.value = ''
  isSimulating.value = true
  hop1Processing.value = true
  hop2Processing.value = false
  hop1Result.value = ''
  hop1Latency.value = null
  hop2Result.value = ''
  hop2Latency.value = null

  const hop1Start = performance.now()

  try {
    const vlmProvider = await providersStore.getProviderInstance<any>(activeProvider.value)
    if (!vlmProvider) {
      throw new Error(`Unable to initialize vision provider "${activeProvider.value}".`)
    }

    const simulatedUserQuestion = 'Hey, what do you think of this picture?'
    const directPrompt = activePromptShim.value
      ? `${activePromptShim.value}\n\nUser: ${simulatedUserQuestion}`
      : simulatedUserQuestion
    const forwardPrompt = activePromptShim.value || 'Describe what is happening in this image in detail.'
    const promptToSend = strategy.value === 'direct' ? directPrompt : forwardPrompt

    // Check if local specialized vision engine (Moondream2 / WD Tagger)
    if (typeof vlmProvider.captionImage === 'function') {
      if (typeof vlmProvider.loadModel === 'function' && !vlmProvider.isModelLoaded?.value) {
        await vlmProvider.loadModel()
      }
      const caption = await vlmProvider.captionImage(testImageUrl.value, {
        prompt: promptToSend,
      })
      hop1Result.value = caption
    }
    else {
      // General multi-modal LLM / VLM (OpenRouter, OpenAI, Claude, LM Studio, etc.)
      const dataUrl = await fileToDataUrl(testImageFile.value)

      const vlmMessages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text', text: promptToSend },
            { type: 'image_url' as const, image_url: { url: dataUrl } },
          ],
        },
      ]

      const vlmResponse = await llmStore.generate(
        activeModel.value,
        vlmProvider,
        vlmMessages as any,
        { vision: true },
      )
      hop1Result.value = vlmResponse.text || '[No visual description generated]'
    }

    hop1Latency.value = Math.round(performance.now() - hop1Start)
    hop1Processing.value = false

    // Hop 2: If Forward to LLM strategy, forward perception to consciousness model
    if (strategy.value === 'forward') {
      if (consciousnessStore.activeProvider && consciousnessStore.activeModel) {
        hop2Processing.value = true
        const hop2Start = performance.now()

        try {
          const consciousnessProvider = await providersStore.getProviderInstance(consciousnessStore.activeProvider) as any
          const charName = characterName.value
          const charDescription = activeCard.value?.description || ''
          const brevityGuidance = 'Keep your response short, punchy, and conversational (strictly at most 1 short paragraph, like a quick chat message or instant reply). Do not write multi-paragraph stories, extensive stage narration, or internal monologues.'
          const systemPrompt = charDescription
            ? `You are ${charName}. ${charDescription}\nReact naturally, playfully, and completely in-character to what the user said, incorporating the visual sensory observation.\n\n${brevityGuidance}`
            : `You are ${charName}. React naturally, playfully, and in-character to what the user said, incorporating the visual sensory observation.\n\n${brevityGuidance}`

          const consciousnessMessages = [
            { role: 'system' as const, content: systemPrompt },
            {
              role: 'user' as const,
              content: `${simulatedUserQuestion}\n\n[VISUAL SENSORY PERCEPTION: ${hop1Result.value}]`,
            },
          ]

          const response = await llmStore.generate(
            consciousnessStore.activeModel,
            consciousnessProvider,
            consciousnessMessages as any,
          )
          hop2Result.value = response.text || ''
          hop2Latency.value = Math.round(performance.now() - hop2Start)
        }
        catch (err: any) {
          console.error('[Vision Simulator] Hop 2 consciousness generation failed:', err)
          simulationError.value = `Consciousness LLM Error: ${err.message || 'Failed to generate character response.'}`
        }
        finally {
          hop2Processing.value = false
        }
      }
      else {
        hop2Result.value = ''
      }
    }
  }
  catch (err: any) {
    console.error('[Vision Simulator] Simulation failed:', err)
    simulationError.value = err.message || 'Vision simulation failed.'
  }
  finally {
    hop1Processing.value = false
    hop2Processing.value = false
    isSimulating.value = false
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-6 lg:flex-row">
    <!-- Left Column: Vision Provider & Model Selection (~42% on landscape) -->
    <div class="w-full shrink-0 lg:w-[42%] xl:w-[38%] space-y-6">
      <!-- 1. Vision Provider Selection Card -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div>
          <div class="flex items-center justify-between gap-2">
            <h2 class="text-base text-neutral-900 font-semibold md:text-lg dark:text-neutral-100">
              Vision Provider
            </h2>
            <div
              v-if="visionStore.configured"
              class="flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs text-green-700 font-bold dark:bg-green-900/30 dark:text-green-400"
            >
              <div class="i-solar:check-circle-bold text-sm" />
              <span>Configured</span>
            </div>
            <div
              v-else
              class="flex items-center gap-1.5 rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400"
            >
              <div class="i-solar:info-circle-bold text-sm" />
              <span>Not Configured</span>
            </div>
          </div>
          <p class="text-xs text-neutral-500 leading-relaxed">
            Select the AI provider and model you want to use for visual analysis and image processing.
          </p>
        </div>

        <div class="max-w-full">
          <fieldset
            v-if="persistedVisionProvidersMetadata.length > 0"
            class="max-h-[260px] min-w-0 flex flex-col gap-2 overflow-y-auto pr-1"
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
              <template v-if="configuredProviders[metadata.id] === false" #bottomRight>
                <div class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 font-medium dark:bg-amber-900/30 dark:text-amber-300">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.health_check_failed') }}
                </div>
              </template>
            </RadioCardSimple>
            <RouterLink
              to="/settings/providers"
              class="relative w-full flex shrink-0 items-center justify-center gap-2 border-2 border-neutral-200 rounded-xl border-dashed bg-transparent p-3 text-neutral-400 transition-all duration-200 ease-in-out dark:border-neutral-800 hover:border-primary-500/50 hover:bg-neutral-50 hover:text-primary-500 dark:hover:border-primary-400/50 dark:hover:bg-neutral-900/50 dark:hover:text-primary-400"
            >
              <div class="i-solar:add-circle-line-duotone text-xl" />
              <span class="text-sm font-medium">Add Provider</span>
            </RouterLink>
          </fieldset>
          <div v-else>
            <RouterLink
              class="flex items-center gap-3 border-2 border-neutral-200 rounded-lg border-dashed bg-neutral-50 p-4 transition-colors duration-200 ease-in-out dark:border-neutral-800 dark:bg-neutral-800"
              to="/settings/providers"
            >
              <div class="i-solar:warning-circle-line-duotone text-2xl text-amber-500 dark:text-amber-400" />
              <div class="flex flex-col">
                <span class="font-medium">No Vision Providers Configured</span>
                <span class="text-sm text-neutral-400 dark:text-neutral-500">Go to Settings > Providers to set up a provider for vision tasks.</span>
              </div>
              <div class="i-solar:arrow-right-line-duotone ml-auto text-xl text-neutral-400 dark:text-neutral-500" />
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- 2. Vision Model Selection Card -->
      <div v-if="activeProvider" class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <div>
          <div class="flex flex-col items-start gap-1 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-base text-neutral-900 font-semibold md:text-lg dark:text-neutral-100">
              Vision Model
            </h2>
            <div class="flex items-center gap-1.5 text-xs font-medium">
              <span class="text-neutral-400">Current:</span>
              <span v-if="activeModel" class="text-primary-500 font-mono dark:text-primary-400">{{ activeModel }}</span>
              <span v-else class="text-neutral-400/50 italic">Not Set</span>
            </div>
          </div>
          <p class="text-xs text-neutral-500">
            Select the model weights or vision architecture to handle image understanding.
          </p>
        </div>

        <!-- Model Listing Supported -->
        <div v-if="supportsModelListing" class="space-y-3">
          <div v-if="isLoadingActiveProviderModels" class="flex items-center justify-center py-4">
            <div class="i-solar:spinner-line-duotone mr-2 animate-spin text-xl text-primary-500" />
            <span class="text-xs text-neutral-500">Loading models...</span>
          </div>

          <template v-else-if="activeProviderModelError">
            <ErrorContainer
              title="Failed to fetch models"
              :error="activeProviderModelError"
            />
            <div class="mt-2">
              <label class="mb-1 block text-xs text-neutral-700 font-medium dark:text-neutral-300">Model ID (Manual)</label>
              <input
                v-model="activeModel"
                type="text"
                class="w-full border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
                placeholder="e.g. gpt-4o-mini"
              >
            </div>
          </template>

          <template v-else-if="providerModels.length === 0 && !isLoadingActiveProviderModels">
            <Alert type="warning">
              <template #title>
                No models found
              </template>
              <template #content>
                We couldn't retrieve any available models from the provider. You can specify the model ID manually.
              </template>
            </Alert>
            <div class="mt-2">
              <label class="mb-1 block text-xs text-neutral-700 font-medium dark:text-neutral-300">Model ID (Manual)</label>
              <input
                v-model="activeModel"
                type="text"
                class="w-full border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
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

        <!-- Model Listing Not Supported -->
        <div v-else class="space-y-3">
          <div class="flex items-center gap-3 border border-primary-200 rounded-lg bg-primary-50 p-3 dark:border-primary-800/40 dark:bg-primary-900/20">
            <div class="i-solar:info-circle-line-duotone shrink-0 text-xl text-primary-500" />
            <span class="text-xs text-primary-700 dark:text-primary-300">This provider does not support retrieving a list of models. Please enter the model ID manually.</span>
          </div>
          <div>
            <label class="mb-1 block text-xs text-neutral-700 font-medium dark:text-neutral-300">Model ID (Manual)</label>
            <input
              v-model="activeModel"
              type="text"
              class="w-full border border-neutral-300 rounded-lg bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              placeholder="e.g. gpt-4o-mini"
            >
          </div>
        </div>
      </div>
    </div>

    <!-- Right Column: Strategy, Directives & Faux-Chat Simulator (~58% on landscape) -->
    <div class="min-w-0 flex-1 space-y-6">
      <!-- 1. Strategy & Directives Card -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-5 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <!-- Strategy Selection -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-base text-neutral-900 font-semibold md:text-lg dark:text-neutral-100">
              Image Description Strategy
            </h3>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase"
              :class="strategy === 'direct' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'"
            >
              {{ strategy === 'direct' ? '1-Hop Stand-in' : '2-Hop Perception Proxy' }}
            </span>
          </div>
          <p class="text-xs text-neutral-500">
            Choose whether the vision model replies directly as the character or acts as an objective visual sensor forwarded to your primary consciousness LLM.
          </p>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RadioCardSimple
              id="strategy-direct"
              v-model="strategy"
              name="strategy"
              value="direct"
              title="Direct Response"
              description="1-Hop: Vision model roleplays and replies directly to the image."
            />
            <RadioCardSimple
              id="strategy-forward"
              v-model="strategy"
              name="strategy"
              value="forward"
              title="Forward to LLM"
              description="2-Hop: Vision model extracts scene perception, then Consciousness LLM speaks."
            />
          </div>
        </div>

        <!-- Vision Directives Editor -->
        <div class="border-t border-neutral-100 pt-4 space-y-3 dark:border-neutral-800">
          <div class="flex items-center justify-between">
            <div>
              <h4 class="text-sm text-neutral-800 font-semibold dark:text-neutral-200">
                Vision Directives ({{ strategy === 'direct' ? 'Character Stand-in Prompt' : 'Objective Analysis Directive' }})
              </h4>
              <p class="text-xs text-neutral-400">
                {{ strategy === 'direct'
                  ? 'Hidden instructions guiding the vision model to stay in-character when replying directly.'
                  : 'Hidden instructions sent to the vision model to guide its objective scene description before passing to your chat LLM.' }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 text-xs text-neutral-400 transition-colors hover:text-primary-500"
              @click="resetActivePromptShim"
            >
              Reset to default
            </button>
          </div>

          <textarea
            v-model="activePromptShim"
            rows="3"
            class="w-full border border-neutral-300 rounded-lg bg-white p-3 text-xs leading-relaxed dark:border-neutral-700 dark:bg-neutral-800/80"
            :placeholder="strategy === 'direct' ? 'Enter stand-in roleplay instructions...' : 'Enter objective vision analysis directive...'"
          />
        </div>
      </div>

      <!-- 2. Stylized Faux-Chat Simulator Playground -->
      <div class="border border-neutral-200/80 rounded-2xl bg-white/70 p-5 space-y-5 dark:border-neutral-800/80 dark:bg-neutral-900/60">
        <!-- Simulator Header -->
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <div class="i-solar:play-stream-bold-duotone text-xl text-primary-500" />
              <h3 class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
                Vision Interaction Simulator
              </h3>
            </div>
            <p class="text-xs text-neutral-500">
              {{ strategy === 'direct'
                ? 'Watch the 1-Hop pipeline: the vision model receives your picture and roleplays as the character directly.'
                : 'Watch the 2-Hop pipeline: the vision model first perceives the image (Hop 1), then your primary Consciousness LLM reacts in-character (Hop 2).' }}
            </p>
          </div>

          <!-- Active Architecture Pill -->
          <div class="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
            <span class="h-2 w-2 rounded-full" :class="strategy === 'direct' ? 'bg-amber-500' : 'bg-primary-500'" />
            <span>{{ strategy === 'direct' ? 'Mode: 1-Hop Stand-in' : 'Mode: 2-Hop Proxy' }}</span>
          </div>
        </div>

        <!-- The Faux Chat Thread Canvas -->
        <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/70 p-4 space-y-4 dark:border-neutral-800/80 dark:bg-neutral-950/50">
          <!-- Row 1: Fixed User Bubble -->
          <div class="flex items-start justify-end gap-3">
            <div class="max-w-[85%] space-y-2">
              <div class="rounded-2xl rounded-tr-none bg-primary-600 px-4 py-2.5 text-sm text-white shadow-sm dark:bg-primary-500">
                Hey, what do you think of this picture?
              </div>

              <!-- Row 2: Embedded Image Attachment Dropzone -->
              <div
                class="overflow-hidden border-2 border-primary-400/40 rounded-xl border-dashed bg-white/80 p-3 transition-colors dark:border-primary-500/30 hover:border-primary-500 dark:bg-neutral-900/80"
                @dragover.prevent
                @drop="handleDrop"
              >
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileChange"
                >

                <div v-if="testImageUrl" class="group relative">
                  <img
                    :src="testImageUrl"
                    class="max-h-48 w-full rounded-lg bg-black/5 object-contain dark:bg-black/40"
                    alt="Simulator test image"
                  >
                  <div class="mt-2 flex items-center justify-between">
                    <span class="max-w-[200px] truncate text-[11px] text-neutral-400">{{ testImageFile?.name }}</span>
                    <button
                      type="button"
                      class="text-xs text-primary-500 font-medium hover:underline"
                      @click="fileInput?.click()"
                    >
                      Change image
                    </button>
                  </div>
                </div>

                <div
                  v-else
                  class="flex flex-col cursor-pointer items-center justify-center py-6 text-center"
                  @click="fileInput?.click()"
                >
                  <div class="i-solar:gallery-send-bold-duotone mb-1.5 text-3xl text-neutral-400" />
                  <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Drop an image here to simulate</span>
                  <span class="text-[11px] text-neutral-400">or click to browse local files</span>
                </div>
              </div>
            </div>

            <!-- User Avatar -->
            <div class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
              <div class="i-solar:user-bold text-base text-neutral-500 dark:text-neutral-300" />
            </div>
          </div>

          <!-- Run Simulation Controls -->
          <div class="flex items-center justify-between border-t border-neutral-200/50 pt-3 dark:border-neutral-800/50">
            <div class="text-xs text-neutral-400">
              <span v-if="!activeProvider || !activeModel" class="text-amber-500">Select a Vision Provider & Model first</span>
              <span v-else-if="!testImageUrl">Attach an image above to run</span>
              <span v-else>Ready to simulate with <b>{{ activeModel }}</b></span>
            </div>

            <Button
              variant="primary"
              :disabled="!testImageUrl || !activeProvider || !activeModel || isSimulating"
              @click="runSimulation"
            >
              <div v-if="isSimulating" class="i-solar:spinner-line-duotone mr-1.5 animate-spin" />
              <div v-else class="i-solar:play-bold-duotone mr-1.5" />
              <span>{{ isSimulating ? 'Simulating...' : 'Simulate Reaction' }}</span>
            </Button>
          </div>

          <!-- Error Alert if simulation failed -->
          <Alert v-if="simulationError" type="error">
            <template #content>
              {{ simulationError }}
            </template>
          </Alert>

          <!-- Dynamic Results Flow -->
          <div v-if="isSimulating || hop1Result" class="pt-2 space-y-4">
            <!-- CASE A: DIRECT RESPONSE (1-Hop) -->
            <div v-if="strategy === 'direct'" class="space-y-2">
              <div class="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold tracking-wider uppercase dark:text-amber-400">
                <div class="i-solar:bolt-bold text-sm" />
                <span>1-Hop Vision Stand-in Response</span>
                <span v-if="hop1Latency" class="ml-auto text-[10px] text-neutral-400 font-normal font-mono">{{ hop1Latency }}ms</span>
              </div>

              <div class="flex items-start gap-3">
                <!-- Vision Model Avatar -->
                <div class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <div class="i-solar:eye-scan-bold-duotone text-base" />
                </div>

                <div class="max-w-[85%] border border-amber-500/20 rounded-2xl rounded-tl-none bg-amber-50/60 p-3.5 text-sm text-neutral-800 shadow-sm dark:bg-amber-950/20 dark:text-neutral-200">
                  <div class="mb-1 text-[10px] text-amber-700 font-medium font-mono dark:text-amber-300">
                    {{ activeProvider }} / {{ activeModel }} (Direct Stand-in)
                  </div>
                  <div v-if="hop1Processing" class="flex items-center gap-2 py-1 text-xs text-neutral-500">
                    <div class="i-solar:spinner-line-duotone animate-spin text-base text-amber-500" />
                    <span>Vision model roleplaying direct response...</span>
                  </div>
                  <div v-else class="select-text whitespace-pre-wrap text-xs leading-relaxed sm:text-sm">
                    {{ hop1Result }}
                  </div>
                </div>
              </div>
            </div>

            <!-- CASE B: FORWARD TO LLM (2-Hop) -->
            <div v-else class="space-y-4">
              <!-- Hop 1: Visual Perception Card -->
              <div class="space-y-1.5">
                <div class="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold tracking-wider uppercase dark:text-blue-400">
                  <div class="i-solar:eye-scan-bold-duotone text-sm" />
                  <span>Hop 1: Visual Perception (Proxy Analysis)</span>
                  <span v-if="hop1Latency" class="ml-auto text-[10px] text-neutral-400 font-normal font-mono">{{ hop1Latency }}ms</span>
                </div>

                <div class="border border-blue-200/80 rounded-xl bg-blue-50/50 p-3 text-xs text-neutral-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-neutral-200">
                  <div class="mb-1.5 flex items-center justify-between">
                    <span class="text-[10px] text-blue-600 font-medium font-mono dark:text-blue-400">{{ activeProvider }} ({{ activeModel }})</span>
                    <span class="text-[10px] text-neutral-400 tracking-wider uppercase">Perception Output</span>
                  </div>

                  <div v-if="hop1Processing" class="flex items-center gap-2 py-1 text-neutral-500">
                    <div class="i-solar:spinner-line-duotone animate-spin text-base text-blue-500" />
                    <span>Extracting visual details and scene description...</span>
                  </div>
                  <div v-else class="select-text whitespace-pre-wrap text-[11px] leading-relaxed font-mono">
                    {{ hop1Result }}
                  </div>
                </div>
              </div>

              <!-- Visual Flow Transition Connector -->
              <div class="flex items-center justify-center gap-2 py-0.5 text-xs text-neutral-400">
                <div class="h-[1px] flex-1 bg-neutral-200 dark:bg-neutral-800" />
                <div class="flex items-center gap-1.5 text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
                  <div class="i-solar:arrow-down-bold text-primary-500" />
                  <span>Forwarding perception into {{ characterName }}'s Consciousness...</span>
                </div>
                <div class="h-[1px] flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>

              <!-- Hop 2: Character Dialogue Bubble -->
              <div class="space-y-1.5">
                <div class="flex items-center gap-1.5 text-[11px] text-primary-600 font-semibold tracking-wider uppercase dark:text-primary-400">
                  <div class="i-solar:chat-round-line-bold text-sm" />
                  <span>Hop 2: Character Dialogue ({{ characterName }})</span>
                  <span v-if="hop2Latency" class="ml-auto text-[10px] text-neutral-400 font-normal font-mono">{{ hop2Latency }}ms</span>
                </div>

                <div class="flex items-start gap-3">
                  <!-- Character Avatar -->
                  <div class="h-8 w-8 flex shrink-0 items-center justify-center overflow-hidden border border-primary-500/30 rounded-full bg-primary-500/15">
                    <img v-if="characterAvatar" :src="characterAvatar" class="h-full w-full object-cover" alt="Character Avatar">
                    <div v-else class="i-solar:user-heart-bold text-base text-primary-500" />
                  </div>

                  <div class="max-w-[85%] border border-neutral-200/80 rounded-2xl rounded-tl-none bg-white p-3.5 text-sm text-neutral-800 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
                    <div class="mb-1 flex items-center justify-between text-[10px]">
                      <span class="text-neutral-900 font-bold dark:text-neutral-100">{{ characterName }}</span>
                      <span class="text-neutral-400 font-mono">{{ consciousnessStore.activeModel || 'Default LLM' }}</span>
                    </div>

                    <div v-if="hop2Processing" class="flex items-center gap-2 py-1 text-xs text-neutral-500">
                      <div class="i-solar:spinner-line-duotone animate-spin text-base text-primary-500" />
                      <span>{{ characterName }} is reacting to the visual perception...</span>
                    </div>
                    <div v-else-if="hop2Result" class="select-text whitespace-pre-wrap text-xs leading-relaxed sm:text-sm">
                      {{ hop2Result }}
                    </div>
                    <div v-else-if="!consciousnessStore.activeProvider || !consciousnessStore.activeModel" class="py-1 text-xs text-amber-500 italic">
                      Consciousness model not configured in Settings > Modules > Consciousness. Configure an LLM to see {{ characterName }}'s in-character reply.
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
