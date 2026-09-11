<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'

import { useLLM } from '../../../../../../stores/llm'
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useConsciousnessStore } from '../../../../../../stores/modules/consciousness'
import { useVisionStore } from '../../../../../../stores/modules/vision'
import { useProvidersStore } from '../../../../../../stores/providers'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()
const providersStore = useProvidersStore()
const visionStore = useVisionStore()
const consciousnessStore = useConsciousnessStore()
const cardStore = useAiriCardStore()
const llmStore = useLLM()

const { persistedVisionProvidersMetadata, configuredVisionProvidersMetadata } = storeToRefs(providersStore)
const { activeCard } = storeToRefs(cardStore)
const {
  providerModels,
  isLoadingActiveProviderModels,
} = storeToRefs(visionStore)

// Local reactive state bound to draftStore
const activeProvider = ref<string>(draftStore.state.visionProvider || visionStore.activeProvider || '')
const activeModel = ref<string>(draftStore.state.visionModel || visionStore.activeModel || '')
const strategy = ref<'direct' | 'forward'>(draftStore.state.visionStrategy || visionStore.strategy || 'direct')
const promptShimDirect = ref<string>(
  draftStore.state.visionPromptShimDirect || visionStore.promptShimDirect || 'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about "analyzing" or "describing" the image for the user. Just react to what you see as the character would.',
)
const promptShimForward = ref<string>(
  draftStore.state.visionPromptShimForward || visionStore.promptShimForward || 'You are an objective image analysis model. Analyze the provided image in the context of the conversation and the user\'s latest message. Describe the key visual details, subjects, actions, colors, text, or any specific elements mentioned or asked about by the user, so that the primary chat LLM can respond appropriately. Keep your analysis descriptive and objective, and avoid any conversational filler.',
)

const characterName = computed(() => activeCard.value?.name || draftStore.state.companionName || 'Airi')

const activePromptShim = computed({
  get() {
    return strategy.value === 'forward' ? promptShimForward.value : promptShimDirect.value
  },
  set(value: string) {
    if (strategy.value === 'forward') {
      promptShimForward.value = value
    }
    else {
      promptShimDirect.value = value
    }
    syncDraft()
  },
})

function resetActivePromptShim() {
  if (strategy.value === 'forward') {
    promptShimForward.value = 'You are an objective image analysis model. Analyze the provided image in the context of the conversation and the user\'s latest message. Describe the key visual details, subjects, actions, colors, text, or any specific elements mentioned or asked about by the user, so that the primary chat LLM can respond appropriately. Keep your analysis descriptive and objective, and avoid any conversational filler.'
  }
  else {
    promptShimDirect.value = 'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about "analyzing" or "describing" the image for the user. Just react to what you see as the character would.'
  }
  syncDraft()
}

function syncDraft() {
  draftStore.setVision({
    provider: activeProvider.value,
    model: activeModel.value,
    strategy: strategy.value,
    promptShimDirect: promptShimDirect.value,
    promptShimForward: promptShimForward.value,
  })
}

const filteredModels = computed(() => {
  return providerModels.value.filter((model: any) => model.capabilities?.includes('vision'))
})

async function syncOrAdoptModel(provider: string) {
  if (!provider)
    return

  await visionStore.loadModelsForProvider(provider)

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
  syncDraft()
}

watch(activeProvider, async (provider) => {
  if (!provider) {
    activeModel.value = ''
    syncDraft()
    return
  }
  await syncOrAdoptModel(provider)
}, { immediate: true })

watch(activeModel, () => {
  syncDraft()
})

watch(strategy, () => {
  syncDraft()
})

onMounted(() => {
  // If provider empty, attempt to adopt consciousness provider if vision-capable or first configured provider
  if (!activeProvider.value) {
    const consciousnessProvider = draftStore.state.llmProvider
    if (consciousnessProvider && persistedVisionProvidersMetadata.value.some(p => p.id === consciousnessProvider)) {
      activeProvider.value = consciousnessProvider
    }
    else if (configuredVisionProvidersMetadata.value.length > 0) {
      activeProvider.value = configuredVisionProvidersMetadata.value[0].id
    }
    else if (persistedVisionProvidersMetadata.value.length > 0) {
      activeProvider.value = persistedVisionProvidersMetadata.value[0].id
    }
  }
})

// ----------------------------------------------------------------------------------
// Faux-Chat Simulator State & Actions
// ----------------------------------------------------------------------------------

const fileInput = ref<HTMLInputElement | null>(null)
const testImageFile = ref<File | null>(null)
const testImageUrl = ref<string | null>(null)
const simulatedUserQuestion = ref('Hey, what do you think of this picture?')
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

    const question = simulatedUserQuestion.value || 'Hey, what do you think of this picture?'
    const directPrompt = activePromptShim.value
      ? `${activePromptShim.value}\n\nUser: ${question}`
      : question
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
      // General multi-modal LLM / VLM
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
      const consciousProviderId = draftStore.state.llmProvider || consciousnessStore.activeProvider
      const consciousModelId = draftStore.state.llmModel || consciousnessStore.activeModel

      if (consciousProviderId && consciousModelId) {
        hop2Processing.value = true
        const hop2Start = performance.now()

        try {
          const consciousnessProvider = await providersStore.getProviderInstance(consciousProviderId) as any
          const charName = characterName.value
          const brevityGuidance = 'Keep your response short, punchy, and conversational (strictly at most 1 short paragraph, like a quick chat message or instant reply). Do not write multi-paragraph stories, extensive stage narration, or internal monologues.'
          const systemPrompt = `You are ${charName}. React naturally, playfully, and in-character to what the user said, incorporating the visual sensory observation.\n\n${brevityGuidance}`

          const consciousnessMessages = [
            { role: 'system' as const, content: systemPrompt },
            {
              role: 'user' as const,
              content: `${question}\n\n[VISUAL SENSORY PERCEPTION: ${hop1Result.value}]`,
            },
          ]

          const consciousnessResponse = await llmStore.generate(
            consciousModelId,
            consciousnessProvider,
            consciousnessMessages as any,
          )

          hop2Result.value = consciousnessResponse.text || '[No character response generated]'
        }
        catch (err: any) {
          hop2Result.value = `[Hop 2 Consciousness Error: ${err.message || String(err)}]`
        }
        finally {
          hop2Latency.value = Math.round(performance.now() - hop2Start)
          hop2Processing.value = false
        }
      }
      else {
        hop2Result.value = '[Consciousness provider/model not configured yet. Complete Step 8 Consciousness to preview character reactions.]'
      }
    }
  }
  catch (err: any) {
    simulationError.value = err.message || 'Vision simulation failed.'
  }
  finally {
    isSimulating.value = false
    hop1Processing.value = false
    hop2Processing.value = false
  }
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col gap-4 py-1 select-none']">
    <!-- Header Section -->
    <div :class="['flex items-start justify-between gap-4 pb-2 border-b border-neutral-200/80 dark:border-white/10']">
      <div :class="['flex items-start gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-xl flex-shrink-0 mt-0.5 border border-primary-500/20 shadow-xs']">
          <div :class="['i-solar:camera-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              Photo & Visual Understanding
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400']">
              Step 13 · Vision
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Enable your companion to view and interpret pictures sent in chat. Configure visual models, routing strategy, and test live perception.
          </p>
        </div>
      </div>

      <!-- Active Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            activeProvider && activeModel
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700',
          ]"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', activeProvider && activeModel ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400']" />
          <span>{{ activeProvider && activeModel ? 'VISION CONFIGURED' : 'PENDING SETUP' }}</span>
        </span>
      </div>
    </div>

    <!-- Main Content: 2-Column Responsive Grid -->
    <div :class="['grid grid-cols-1 lg:grid-cols-12 gap-5 items-start']">
      <!-- Left Column (7 cols): Vision Provider, Model, and Strategy Configuration -->
      <div :class="['lg:col-span-7 flex flex-col gap-4']">
        <!-- Provider Selection Card -->
        <div :class="['flex flex-col gap-3 p-4.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-xs backdrop-blur-md']">
          <div :class="['flex items-center justify-between']">
            <label :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
              <div :class="['i-solar:widget-add-bold-duotone text-primary-500 text-sm']" />
              <span>Vision Provider</span>
            </label>
            <span :class="['text-[11px] text-neutral-400 font-medium']">
              {{ persistedVisionProvidersMetadata.length }} Available
            </span>
          </div>

          <!-- Provider Radio Selection -->
          <div :class="['grid grid-cols-2 sm:grid-cols-3 gap-2']">
            <button
              v-for="provider in persistedVisionProvidersMetadata"
              :key="provider.id"
              type="button"
              :class="[
                'p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer',
                activeProvider === provider.id
                  ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-300 ring-1 ring-primary-500/30 font-semibold'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="activeProvider = provider.id"
            >
              <div :class="['h-6 w-6 rounded-lg flex items-center justify-center bg-neutral-200/60 dark:bg-neutral-800 shrink-0 text-sm']">
                <div v-if="provider.icon" :class="provider.icon" />
                <div v-else :class="['i-solar:shield-star-bold']" />
              </div>
              <span :class="['text-xs truncate font-medium']">{{ provider.name }}</span>
            </button>
          </div>
        </div>

        <!-- Model Selection Card -->
        <div v-if="activeProvider" :class="['flex flex-col gap-3 p-4.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-xs backdrop-blur-md animate-fadeIn']">
          <div :class="['flex items-center justify-between']">
            <label :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
              <div :class="['i-solar:layers-minimalistic-bold text-primary-500 text-sm']" />
              <span>Vision Model</span>
            </label>
            <span v-if="isLoadingActiveProviderModels" :class="['text-[11px] text-neutral-400 flex items-center gap-1']">
              <div :class="['i-solar:refresh-line-duotone animate-spin text-xs']" />
              Loading models...
            </span>
          </div>

          <!-- Model Picker -->
          <div v-if="filteredModels.length > 0" :class="['flex flex-col gap-2']">
            <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1']">
              <button
                v-for="model in filteredModels"
                :key="model.id"
                type="button"
                :class="[
                  'p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between',
                  activeModel === model.id
                    ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-300 ring-1 ring-primary-500/30'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700',
                ]"
                @click="activeModel = model.id"
              >
                <span :class="['text-xs font-bold truncate']">{{ model.name || model.id }}</span>
                <span v-if="model.description" :class="['text-[10px] text-neutral-400 truncate mt-0.5']">{{ model.description }}</span>
              </button>
            </div>
          </div>
          <div v-else :class="['text-xs text-neutral-400 py-2']">
            <input
              v-model="activeModel"
              type="text"
              placeholder="e.g. gpt-4o, claude-3-5-sonnet, moondream2"
              :class="['w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40']"
            >
          </div>
        </div>

        <!-- Strategy Selection Card -->
        <div :class="['flex flex-col gap-3 p-4.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-xs backdrop-blur-md']">
          <label :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
            <div :class="['i-solar:route-line-duotone text-primary-500 text-sm']" />
            <span>Routing & Strategy</span>
          </label>

          <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
            <!-- Option 1: Direct Stand-in -->
            <button
              type="button"
              :class="[
                'p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer',
                strategy === 'direct'
                  ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="strategy = 'direct'"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold']">Direct VLM Stand-in</span>
                <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-500']">1-Hop</span>
              </div>
              <p :class="['text-[11px] text-neutral-400 leading-snug']">
                The vision model directly synthesizes dialogue answers in-character.
              </p>
            </button>

            <!-- Option 2: Forward to LLM (2-Hop) -->
            <button
              type="button"
              :class="[
                'p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer',
                strategy === 'forward'
                  ? 'border-primary-500 bg-primary-500/10 text-neutral-900 dark:text-white ring-1 ring-primary-500/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700',
              ]"
              @click="strategy = 'forward'"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold']">Forward to Brain</span>
                <span :class="['text-[9px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500']">2-Hop (Recommended)</span>
              </div>
              <p :class="['text-[11px] text-neutral-400 leading-snug']">
                VLM generates objective perception tags, injected into character consciousness.
              </p>
            </button>
          </div>

          <!-- Prompt Shim Textarea -->
          <div :class="['flex flex-col gap-1.5 mt-1 pt-2 border-t border-neutral-100 dark:border-neutral-800/80']">
            <div :class="['flex items-center justify-between']">
              <span :class="['text-[11px] font-semibold text-neutral-700 dark:text-neutral-300']">
                {{ strategy === 'forward' ? 'Perception Analysis Directive' : 'Stand-in Character Persona Directive' }}
              </span>
              <button
                type="button"
                :class="['text-[10px] text-neutral-400 hover:text-primary-500 cursor-pointer transition-colors']"
                @click="resetActivePromptShim"
              >
                Reset Default
              </button>
            </div>
            <textarea
              v-model="activePromptShim"
              rows="2"
              :class="['w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none']"
            />
          </div>
        </div>
      </div>

      <!-- Right Column (5 cols): Interactive Faux-Chat Simulator -->
      <div :class="['lg:col-span-5 flex flex-col gap-4']">
        <div :class="['p-4.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] shadow-xs backdrop-blur-md flex flex-col gap-3.5']">
          <div :class="['flex items-center justify-between']">
            <label :class="['text-xs font-bold text-neutral-900 dark:text-white flex items-center gap-2']">
              <div :class="['i-solar:chat-round-dots-bold text-primary-500 text-sm']" />
              <span>Vision Chat Simulator</span>
            </label>
            <span :class="['text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500']">
              {{ strategy === 'direct' ? '1-Hop Stand-in' : '2-Hop Forward' }}
            </span>
          </div>

          <!-- Image Dropzone / File Picker -->
          <div
            :class="[
              'relative rounded-xl border-2 border-dashed p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer',
              testImageUrl
                ? 'border-primary-500/40 bg-primary-500/5'
                : 'border-neutral-300 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-900/40 hover:border-primary-400',
            ]"
            @dragover.prevent
            @drop="handleDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileChange"
            >

            <template v-if="testImageUrl">
              <img
                :src="testImageUrl"
                alt="Test Preview"
                :class="['max-h-36 max-w-full rounded-lg object-contain shadow-xs border border-neutral-200 dark:border-neutral-800']"
              >
              <span :class="['text-[10px] text-neutral-400 mt-2 hover:text-primary-500']">Click or drop to replace image</span>
            </template>
            <template v-else>
              <div :class="['h-10 w-10 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-lg mb-2']">
                <div :class="['i-solar:gallery-add-bold-duotone text-xl']" />
              </div>
              <p :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">
                Drop test image or click to browse
              </p>
              <p :class="['text-[10px] text-neutral-400 mt-0.5']">
                PNG, JPG, or WebP to simulate chat attachment
              </p>
            </template>
          </div>

          <!-- Simulated User Input -->
          <div :class="['flex flex-col gap-1']">
            <span :class="['text-[10px] font-semibold text-neutral-500 dark:text-neutral-400']">Simulated Message</span>
            <input
              v-model="simulatedUserQuestion"
              type="text"
              placeholder="What do you think of this picture?"
              :class="['w-full px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500']"
            >
          </div>

          <!-- Run Simulation Button -->
          <Button
            variant="primary"
            size="sm"
            :disabled="!testImageUrl || isSimulating || !activeProvider || !activeModel"
            :class="['w-full flex items-center justify-center gap-2 rounded-xl py-2 cursor-pointer font-bold text-xs']"
            @click="runSimulation"
          >
            <div v-if="isSimulating" :class="['i-solar:refresh-line-duotone animate-spin text-sm']" />
            <div v-else :class="['i-solar:play-bold text-sm']" />
            <span>{{ isSimulating ? 'Analyzing Scene...' : 'Test Vision Understanding' }}</span>
          </Button>

          <!-- Error Alert -->
          <div v-if="simulationError" :class="['p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs']">
            {{ simulationError }}
          </div>

          <!-- Results Presentation -->
          <div v-if="hop1Result || hop2Result || isSimulating" :class="['flex flex-col gap-2.5 pt-1']">
            <!-- Hop 1 Output -->
            <div :class="['p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 flex flex-col gap-1']">
              <div :class="['flex items-center justify-between text-[10px] font-mono']">
                <span :class="['text-neutral-500 font-bold uppercase']">
                  {{ strategy === 'direct' ? 'Hop 1 · Character Reply' : 'Hop 1 · Vision Scene Analysis' }}
                </span>
                <span v-if="hop1Latency" :class="['text-emerald-500 font-bold']">{{ hop1Latency }}ms</span>
                <span v-else-if="hop1Processing" :class="['text-primary-500 animate-pulse']">Processing...</span>
              </div>
              <p :class="['text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap']">
                {{ hop1Result || '...' }}
              </p>
            </div>

            <!-- Hop 2 Output (If 2-Hop Forward) -->
            <div v-if="strategy === 'forward'" :class="['p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 flex flex-col gap-1 animate-fadeIn']">
              <div :class="['flex items-center justify-between text-[10px] font-mono']">
                <span :class="['text-indigo-500 font-bold uppercase']">Hop 2 · {{ characterName }}'s Dialogue</span>
                <span v-if="hop2Latency" :class="['text-emerald-500 font-bold']">{{ hop2Latency }}ms</span>
                <span v-else-if="hop2Processing" :class="['text-indigo-500 animate-pulse']">Thinking in character...</span>
              </div>
              <p :class="['text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap font-medium']">
                {{ hop2Result || '...' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation Action Bar -->
    <div :class="['flex items-center justify-between pt-3 border-t border-neutral-200/80 dark:border-white/5']">
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>Back</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium']">
        Model: <span :class="['text-neutral-700 dark:text-neutral-200 font-semibold']">{{ activeModel || 'None Selected' }}</span>
        <span v-if="strategy === 'forward'" :class="['text-indigo-500 ml-1 font-bold']">(2-Hop)</span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="props.onNext"
      >
        <span>Continue</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
