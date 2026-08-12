<script setup lang="ts">
import type { AiriExtension } from '@proj-airi/stage-ui/stores/modules/airi-card'

import { DEFAULT_POST_HISTORY_INSTRUCTIONS } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings/stage-model'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { Button } from '@proj-airi/ui'
import { Select } from '@proj-airi/ui/components/form'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

const props = withDefaults(defineProps<{
  modelValue: boolean
  cardData: any // Raw normalized imported card
  draftOnly?: boolean
}>(), {
  draftOnly: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported', cardId: string): void
  (e: 'submitDraft', cardData: any): void
}>()

const cardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const llmStore = useLLM()

const speechStore = useSpeechStore()
const providersStore = useProvidersStore()
const displayModelsStore = useDisplayModelsStore()
const stageModelStore = useSettingsStageModel()
const userProfileStore = useSettingsUserProfile()

const { activeProvider: consciousnessProvider, activeModel: defaultConsciousnessModel } = storeToRefs(consciousnessStore)
const { activeSpeechProvider: speechProvider, activeSpeechModel: defaultSpeechModel, activeSpeechVoiceId: defaultSpeechVoiceId } = storeToRefs(speechStore)
const { stageModelSelected: defaultDisplayModelId } = storeToRefs(stageModelStore)

const currentStep = ref(1)

// Form states
const name = ref('')
const selectedDisplayModelId = ref('')
const selectedConsciousnessProvider = ref('')
const selectedConsciousnessModel = ref('')
const selectedSpeechProvider = ref('')
const selectedSpeechModel = ref('')
const selectedSpeechVoiceId = ref('')
const userName = ref('')
const description = ref('')
const artistryPromptPrefix = ref('')

// Loading states for Sparkle AI generators
const generatingDescription = ref(false)
const generatingPrefix = ref(false)

const hasUserPattern = computed(() => {
  if (!props.cardData)
    return false
  const fields = [
    props.cardData.description,
    props.cardData.personality,
    props.cardData.scenario,
    props.cardData.systemPrompt,
    ...(props.cardData.greetings || []),
  ]
  return fields.some(f => typeof f === 'string' && f.includes('{{user}}'))
})

// Toggles (Wizard defaults)
const artistryAutonomousEnabled = ref(false)
const dreamStateEnabled = ref(true)
const proactivityEnabled = ref(false)

const importModelSearch = ref('')

// Options computed properties
const displayModelOptions = computed(() => {
  let list = displayModelsStore.displayModels

  if (importModelSearch.value.trim()) {
    const q = importModelSearch.value.trim().toLowerCase()
    list = list.filter((model) => {
      const nameMatches = model.name.toLowerCase().includes(q)
      const tagMatches = model.tags && Array.isArray(model.tags) && model.tags.some(t => t.toLowerCase().includes(q))
      return nameMatches || tagMatches
    })
  }

  return list.map((model) => {
    const isLive2D = model.format === DisplayModelFormat.Live2dZip || model.format === DisplayModelFormat.Live2dDirectory
    const isSpine = model.format === DisplayModelFormat.SpineZip
    const isMmd = model.format === DisplayModelFormat.PMXZip || model.format === DisplayModelFormat.PMXDirectory || model.format === DisplayModelFormat.PMD
    let prefix = '[VRM]'
    if (isLive2D)
      prefix = '[Live2D]'
    else if (isSpine)
      prefix = '[Spine]'
    else if (isMmd)
      prefix = '[MMD]'
    return {
      id: model.id,
      name: model.name,
      prefix,
      preview: model.previewImage,
    }
  })
})

const consciousnessProviderOptions = computed(() => {
  return providersStore.configuredChatProvidersMetadata.map(provider => ({
    value: provider.id,
    label: provider.localizedName || provider.name,
  }))
})

const consciousnessModelOptions = computed(() => {
  const provider = selectedConsciousnessProvider.value || consciousnessProvider.value
  if (!provider)
    return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map(model => ({
    value: model.id,
    label: model.name || model.id,
  }))
})

const speechProviderOptions = computed(() => {
  return providersStore.configuredSpeechProvidersMetadata.map(provider => ({
    value: provider.id,
    label: provider.localizedName || provider.name,
  }))
})

const speechModelOptions = computed(() => {
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (!provider)
    return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map(model => ({
    value: model.id,
    label: model.name || model.id,
  }))
})

const speechVoiceOptions = computed(() => {
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (!provider)
    return []
  const voices = speechStore.getVoicesForProvider(provider)
  return voices.map(voice => ({
    value: voice.id,
    label: voice.name || voice.id,
  }))
})

// Computed normalized card metadata for CCv2 / CCv3 / SillyTavern payloads
const extractedCardMeta = computed(() => {
  const card = props.cardData
  if (!card) {
    console.info('[CardImport:Stage4:ExtractedMeta] cardData is null/undefined')
    return { name: '', greetings: [] as string[], personality: '' }
  }

  const d = card.data || card

  const cardName = d.name || card.name || 'Imported Card'

  let greetings: string[] = []
  if (Array.isArray(d.greetings) && d.greetings.length > 0) {
    greetings = [...d.greetings]
  }
  else if (Array.isArray(card.greetings) && card.greetings.length > 0) {
    greetings = [...card.greetings]
  }
  else {
    if (d.first_mes)
      greetings.push(d.first_mes)
    if (Array.isArray(d.alternate_greetings))
      greetings.push(...d.alternate_greetings)
    if (greetings.length === 0 && card.first_mes)
      greetings.push(card.first_mes)
  }

  const personality = d.personality || d.description || d.system_prompt || card.personality || card.description || ''

  console.info('[CardImport:Stage4:ExtractedMeta]', {
    hasDataObj: Boolean(card.data),
    resolvedName: cardName,
    greetingsCount: greetings.length,
    greetingsSample: greetings.slice(0, 2),
    personalityLength: personality.length,
    personalitySnippet: personality.slice(0, 120),
    dataKeys: card.data ? Object.keys(card.data) : null,
    topLevelKeys: Object.keys(card),
  })

  return { name: cardName, greetings, personality }
})

// Initialize state
watch(() => [props.modelValue, props.cardData], () => {
  if (props.modelValue && props.cardData) {
    console.info('[CardImport:Stage3:WizardInput]', {
      modelValue: props.modelValue,
      draftOnly: props.draftOnly,
      rawCardData: props.cardData,
      topLevelKeys: Object.keys(props.cardData),
      dataKeys: props.cardData?.data ? Object.keys(props.cardData.data) : null,
    })

    currentStep.value = 1
    name.value = extractedCardMeta.value.name
    userName.value = userProfileStore.name || ''
    selectedDisplayModelId.value = defaultDisplayModelId.value || ''
    selectedConsciousnessProvider.value = consciousnessProvider.value || ''
    selectedConsciousnessModel.value = defaultConsciousnessModel.value || ''
    selectedSpeechProvider.value = speechProvider.value || ''
    selectedSpeechModel.value = defaultSpeechModel.value || ''
    selectedSpeechVoiceId.value = defaultSpeechVoiceId.value || ''
    description.value = props.cardData.description || props.cardData.data?.description || ''
    artistryPromptPrefix.value = props.cardData.extensions?.airi?.artistry?.prompt || ''

    // Toggles defaults
    artistryAutonomousEnabled.value = false
    dreamStateEnabled.value = true
    proactivityEnabled.value = false
  }
}, { immediate: true })

watch(selectedConsciousnessProvider, async (newProvider) => {
  if (newProvider) {
    await consciousnessStore.loadModelsForProvider(newProvider)
    selectedConsciousnessModel.value = ''
  }
})

watch(selectedSpeechProvider, async (newProvider) => {
  if (newProvider) {
    await speechStore.loadVoicesForProvider(newProvider)
    const metadata = providersStore.getProviderMetadata(newProvider)
    if (metadata?.capabilities.listModels) {
      await providersStore.fetchModelsForProvider(newProvider)
    }
    selectedSpeechModel.value = ''
    selectedSpeechVoiceId.value = ''
  }
})

async function generateVisualDescription() {
  const providerId = selectedConsciousnessProvider.value || consciousnessProvider.value
  const modelId = selectedConsciousnessModel.value || defaultConsciousnessModel.value

  if (!providerId || !modelId) {
    toast.error('Please configure the consciousness provider and model in Step 3 first.')
    return
  }

  generatingDescription.value = true
  try {
    const activeProvider = await providersStore.getProviderInstance(providerId) as any
    if (!activeProvider) {
      throw new Error(`Failed to instantiate provider: ${providerId}`)
    }

    const cardContext = {
      name: name.value.trim(),
      description: props.cardData?.description || '',
      personality: props.cardData?.personality || '',
      scenario: props.cardData?.scenario || '',
      systemPrompt: props.cardData?.systemPrompt || '',
    }

    const systemInstruction = 'You are an expert prompt crafter helping a user write a vivid 2-3 paragraph physical/visual description of a companion character in prose. Focus strictly on their physical features, demeanor, age, clothing default, and outfit motifs.'
    const systemPromptContent = `${systemInstruction}\n\nCore Set Context:\n${JSON.stringify(cardContext, null, 2)}`

    const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = [
      { role: 'system', content: systemPromptContent },
    ]

    const existingText = description.value.trim()
    if (existingText) {
      messages.push({
        role: 'user',
        content: `Here is the existing text for this field:\n${existingText}`,
      })
    }

    let userPrompt = 'Template style to generate: "Write a balanced physical description highlighting age, demeanor, key visual motifs, and default clothing."'
    if (existingText) {
      userPrompt += '\n\nMake sure to keep the core of the existing text and build on it by revamping it or adding to it according to the template style, but do not omit key existing details.'
    }
    userPrompt += '\n\nPlease output only the optimized raw text content. Do not wrap in markdown code blocks unless it is structured markdown. Do not include introductory or concluding conversational text.'

    messages.push({ role: 'user', content: userPrompt })

    const llmResponse = await llmStore.generate(modelId, activeProvider, messages)
    const resultText = llmResponse.text?.trim() || ''
    if (resultText) {
      description.value = resultText
      toast.success('Visual description generated successfully!')
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    console.error('[ImportWizard] Description generation failed:', err)
    toast.error(err.message || 'Failed to generate visual description.')
  }
  finally {
    generatingDescription.value = false
  }
}

async function generateImagePrompt() {
  const providerId = selectedConsciousnessProvider.value || consciousnessProvider.value
  const modelId = selectedConsciousnessModel.value || defaultConsciousnessModel.value

  if (!providerId || !modelId) {
    toast.error('Please configure the consciousness provider and model in Step 3 first.')
    return
  }

  generatingPrefix.value = true
  try {
    const activeProvider = await providersStore.getProviderInstance(providerId) as any
    if (!activeProvider) {
      throw new Error(`Failed to instantiate provider: ${providerId}`)
    }

    const cardContext = {
      name: name.value.trim(),
      description: description.value || props.cardData?.description || '',
    }

    let extractedVisualTags = ''
    try {
      const displayModelId = selectedDisplayModelId.value
      if (displayModelId) {
        const model = await displayModelsStore.getDisplayModel(displayModelId)
        if (model && model.previewImage) {
          const providerIdBlip = 'blip-local'
          providersStore.initializeProvider(providerIdBlip)
          if (!providersStore.addedProviders[providerIdBlip]) {
            providersStore.markProviderAdded(providerIdBlip)
          }
          if (providersStore.providerRuntimeState[providerIdBlip]) {
            providersStore.providerRuntimeState[providerIdBlip].isConfigured = true
          }

          const providerInstance = await providersStore.getProviderInstance<any>(providerIdBlip)
          if (providerInstance) {
            await providerInstance.loadModel()
            const tags = await providerInstance.captionImage(model.previewImage)
            extractedVisualTags = tags
          }
        }
      }
    }
    catch (err) {
      console.warn('[ImportWizard] Visual tag extraction skipped or failed:', err)
    }

    const systemInstruction = `You are an expert prompt crafter. Your task is to extract key physical traits from the companion's description, and merge them with the 'Extracted Visual Tags from Character Model Preview (Ground Truth)' provided in the context. Convert them into high-quality, comma-separated Stable Diffusion prompt tags with weights (e.g. (((short brown bob hair:1.5))), ((amber eyes:1.4))). Follow the style specified by the template prompt strictly.

Critical Filtering Instructions:
- No Poses or Composition: Do NOT include tags describing temporary poses, actions, or views (e.g., standing, sitting, t-pose, hand on hip, looking at viewer, full body, upper body, close-up).
- No Preview Backgrounds: Do NOT include tags describing the preview's background (e.g., black background, white background, simple background, transparent background).
- No Emotion/Personality Lock: Exclude emotional expressions (e.g., smile, happy, sad, open mouth, blush) to allow expressions to change dynamically.`

    let systemPromptContent = `${systemInstruction}\n\nCore Set Context:\n${JSON.stringify(cardContext, null, 2)}`
    if (extractedVisualTags) {
      systemPromptContent += `\n\nExtracted Visual Tags from Character Model Preview (Ground Truth):\n${extractedVisualTags}`
    }

    const messages: { role: 'system' | 'user' | 'assistant', content: string }[] = [
      { role: 'system', content: systemPromptContent },
    ]

    const existingText = artistryPromptPrefix.value.trim()
    if (existingText) {
      messages.push({
        role: 'user',
        content: `Here is the existing text for this field:\n${existingText}`,
      })
    }

    let userPrompt = 'Template style to generate: "Generates general style tags (medium, lighting, aesthetic) + facial/body description + default attire and clothing accessories, represented as weighted comma-separated tags."'
    if (existingText) {
      userPrompt += '\n\nMake sure to keep the core of the existing text and build on it by revamping it or adding to it according to the template style, but do not omit key existing details.'
    }
    userPrompt += '\n\nPlease output only the optimized raw text content. Do not wrap in markdown code blocks unless it is structured markdown. Do not include introductory or concluding conversational text.'

    messages.push({ role: 'user', content: userPrompt })

    const llmResponse = await llmStore.generate(modelId, activeProvider, messages)
    const resultText = llmResponse.text?.trim() || ''
    if (resultText) {
      artistryPromptPrefix.value = resultText
      toast.success('Artistry prompt prefix generated successfully!')
    }
    else {
      throw new Error('Empty response received from LLM.')
    }
  }
  catch (err: any) {
    console.error('[ImportWizard] Prefix generation failed:', err)
    toast.error(err.message || 'Failed to generate image prompt prefix.')
  }
  finally {
    generatingPrefix.value = false
  }
}

// Handle wizard navigation
function nextStep() {
  if (currentStep.value === 1) {
    if (!name.value.trim()) {
      toast.error('Character name is required.')
      return
    }
    if (hasUserPattern.value && !userName.value.trim()) {
      toast.error('Your name is required by this card.')
      return
    }
  }
  if (currentStep.value < 5) {
    currentStep.value++
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

async function finalizeImport() {
  try {
    const replacePatterns = (text: string) => {
      if (typeof text !== 'string')
        return text
      let res = text.replace(/\{\{char\}\}/g, name.value.trim())
      if (userName.value.trim()) {
        res = res.replace(/\{\{user\}\}/g, userName.value.trim())
      }
      return res
    }

    // Replace greetings
    const formattedGreetings = (props.cardData.greetings || []).map((g: string) => replacePatterns(g))

    // Replace message examples
    const formattedMessageExample = (props.cardData.messageExample || []).map((example: any) => {
      if (Array.isArray(example)) {
        return example.map((line: string) => replacePatterns(line))
      }
      return replacePatterns(example)
    })

    const finalCard = {
      ...props.cardData,
      name: name.value.trim(),
      description: replacePatterns(description.value.trim()),
      personality: replacePatterns(props.cardData.personality || ''),
      scenario: replacePatterns(props.cardData.scenario || ''),
      systemPrompt: replacePatterns(props.cardData.systemPrompt) || '.',
      postHistoryInstructions: replacePatterns(props.cardData.postHistoryInstructions) || DEFAULT_POST_HISTORY_INSTRUCTIONS,
      greetings: formattedGreetings,
      messageExample: formattedMessageExample,
      extensions: {
        ...props.cardData.extensions,
        airi: {
          ...props.cardData.extensions?.airi,
          modules: {
            ...props.cardData.extensions?.airi?.modules,
            consciousness: {
              provider: selectedConsciousnessProvider.value,
              model: selectedConsciousnessModel.value,
            },
            speech: {
              provider: selectedSpeechProvider.value,
              model: selectedSpeechModel.value,
              voice_id: selectedSpeechVoiceId.value,
            },
            displayModelId: selectedDisplayModelId.value,
            activeBackgroundId: 'none',
          },
          artistry: {
            ...props.cardData.extensions?.airi?.artistry,
            autonomousEnabled: artistryAutonomousEnabled.value,
            prompt: artistryPromptPrefix.value.trim(),
          },
          dreamState: {
            ...props.cardData.extensions?.airi?.dreamState,
            enabled: dreamStateEnabled.value,
          },
          heartbeats: {
            ...props.cardData.extensions?.airi?.heartbeats,
            enabled: proactivityEnabled.value,
          },
        } as AiriExtension,
      },
    }

    // Import embedded virtual voice profiles into speech store
    const embeddedProfiles = props.cardData.extensions?.airi?.voice_profiles
    if (Array.isArray(embeddedProfiles)) {
      for (const profile of embeddedProfiles) {
        if (profile && profile.id) {
          const exists = speechStore.savedVoiceProfiles.some((p: any) => p.id === profile.id)
          if (!exists) {
            console.log(`[ImportWizard] Importing virtual voice profile: ${profile.name} (${profile.id})`)
            speechStore.saveVoiceProfile(profile)
          }
          else {
            console.warn(`[ImportWizard] Skipping voice profile import for existing ID: ${profile.id}`)
          }
        }
      }
    }

    if (props.draftOnly) {
      emit('submitDraft', finalCard)
      emit('update:modelValue', false)
      toast.success('Companion draft successfully configured!')
      return
    }

    const newId = await cardStore.addCard(finalCard)
    emit('imported', newId)
    emit('update:modelValue', false)
    toast.success('Companion successfully configured and saved!')
  }
  catch (error) {
    console.error('[ImportWizard] Error saving card:', error)
    toast.error('Failed to save imported card.')
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-100 m-0 max-h-[90vh] max-w-3xl w-[92vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white p-6 shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800">
        <div class="h-full flex flex-col gap-6 overflow-hidden">
          <!-- Title & Step Tracker -->
          <div class="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-700">
            <div>
              <DialogTitle class="from-primary-500 to-primary-400 bg-gradient-to-r bg-clip-text text-xl text-transparent font-bold">
                Configure Imported Companion
              </DialogTitle>
              <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                Finetune your new companion before introducing them to the stage.
              </p>
            </div>
            <div class="flex gap-1">
              <span
                v-for="s in (props.draftOnly ? 1 : 5)"
                :key="s"
                :class="[
                  'h-2 w-8 rounded-full transition-all duration-300',
                  currentStep >= s ? 'bg-primary-500' : 'bg-neutral-200 dark:bg-neutral-700',
                ]"
              />
            </div>
          </div>

          <!-- Step Content Container -->
          <div class="flex-1 overflow-y-auto pr-1">
            <!-- STEP 1: Identity & Prompts -->
            <div v-if="currentStep === 1" class="flex flex-col gap-5">
              <div class="flex flex-col gap-2">
                <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Name</label>
                <input
                  v-model="name"
                  type="text"
                  placeholder="Companion name"
                  class="w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
                >
              </div>

              <div v-if="hasUserPattern" class="flex flex-col gap-2">
                <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Your Name (Required by Card)</label>
                <input
                  v-model="userName"
                  type="text"
                  placeholder="Enter your name (replacing {{user}})"
                  class="w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
                >
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Greetings</label>
                <div class="max-h-[100px] overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50/40 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-950/40">
                  <div v-for="(greet, i) in (extractedCardMeta.greetings.length ? extractedCardMeta.greetings : props.cardData?.greetings)" :key="i" class="mb-2 last:mb-0">
                    <strong>Greeting {{ Number(i) + 1 }}:</strong> {{ greet }}
                  </div>
                  <div v-if="!extractedCardMeta.greetings.length && !props.cardData?.greetings?.length" class="italic">
                    No greetings imported.
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Personality & Context (Read-Only)</label>
                <textarea
                  readonly
                  :value="extractedCardMeta.personality || 'No personality prompt found.'"
                  rows="4"
                  class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/40 p-3 text-xs text-neutral-500 outline-none dark:border-neutral-700 dark:bg-neutral-950/40"
                />
              </div>
            </div>

            <!-- STEP 2: Visual Avatar -->
            <div v-if="currentStep === 2" class="flex flex-col gap-4">
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                Choose the visual model to represent this companion on stage.
              </p>
              <!-- Search Input -->
              <div class="relative">
                <span class="i-solar:magnifer-linear absolute left-2.5 top-2 text-xs text-neutral-400" />
                <input
                  v-model="importModelSearch"
                  type="text"
                  placeholder="Search avatars..."
                  class="w-full border border-neutral-200/10 rounded-xl bg-neutral-200/40 py-1 pl-7 pr-2.5 text-[11px] text-neutral-700 dark:border-neutral-800/10 dark:bg-neutral-800/40 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                >
              </div>
              <div class="grid grid-cols-2 max-h-[300px] gap-4 overflow-y-auto p-1 sm:grid-cols-3">
                <div
                  v-for="model in displayModelOptions"
                  :key="model.id"
                  :class="[
                    'relative cursor-pointer overflow-hidden rounded-xl border-2 p-2 flex flex-col items-center justify-between transition-all aspect-[3/4]',
                    selectedDisplayModelId === model.id
                      ? 'border-primary-500 bg-primary-500/5'
                      : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900',
                  ]"
                  @click="selectedDisplayModelId = model.id"
                >
                  <div class="relative h-[70%] w-full flex items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-950">
                    <img v-if="model.preview" :src="model.preview" class="h-full w-full object-cover">
                    <div v-else class="i-solar-gallery-bold text-3xl text-neutral-300 dark:text-neutral-700" />
                    <span class="absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white font-bold uppercase">
                      {{ model.prefix }}
                    </span>
                  </div>
                  <div class="mt-2 w-full text-center">
                    <p class="truncate text-xs text-neutral-700 font-bold dark:text-neutral-300">
                      {{ model.name }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 3: Core Modules -->
            <div v-if="currentStep === 3" class="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div class="flex flex-col gap-4 border border-neutral-100 rounded-2xl bg-neutral-50/50 p-4 dark:border-neutral-700/55 dark:bg-neutral-900/30">
                <h4 class="flex items-center gap-2 text-sm text-neutral-700 font-bold dark:text-neutral-200">
                  <div i-lucide:brain class="text-primary-500" /> Consciousness (LLM)
                </h4>
                <div class="flex flex-col gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs text-neutral-400">Provider</label>
                    <Select
                      v-model="selectedConsciousnessProvider"
                      :options="consciousnessProviderOptions"
                      placeholder="Use default provider"
                      class="w-full"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs text-neutral-400">Model</label>
                    <Select
                      v-model="selectedConsciousnessModel"
                      :options="consciousnessModelOptions"
                      placeholder="Use default model"
                      :disabled="!selectedConsciousnessProvider"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-4 border border-neutral-100 rounded-2xl bg-neutral-50/50 p-4 dark:border-neutral-700/55 dark:bg-neutral-900/30">
                <h4 class="flex items-center gap-2 text-sm text-neutral-700 font-bold dark:text-neutral-200">
                  <div i-lucide:mic class="text-primary-500" /> Speech (TTS)
                </h4>
                <div class="flex flex-col gap-3">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs text-neutral-400">Provider</label>
                    <Select
                      v-model="selectedSpeechProvider"
                      :options="speechProviderOptions"
                      placeholder="Use default provider"
                      class="w-full"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs text-neutral-400">Model</label>
                    <Select
                      v-model="selectedSpeechModel"
                      :options="speechModelOptions"
                      placeholder="Use default model"
                      :disabled="!selectedSpeechProvider"
                      class="w-full"
                    />
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-xs text-neutral-400">Voice</label>
                    <Select
                      v-model="selectedSpeechVoiceId"
                      :options="speechVoiceOptions"
                      placeholder="Use default voice"
                      :disabled="!selectedSpeechProvider"
                      class="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 4: Quick Toggles -->
            <div v-if="currentStep === 4" class="flex flex-col gap-4">
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                Set final initial preferences for your companion's extra behaviors.
              </p>

              <div class="flex flex-col gap-3">
                <div class="flex items-center justify-between border border-neutral-100 rounded-xl bg-neutral-50/30 p-4 dark:border-neutral-700/40 dark:bg-neutral-900/20">
                  <div class="flex flex-col gap-1">
                    <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Dream State (Journaling)</label>
                    <p class="max-w-md text-xs text-neutral-400">
                      Let the companion periodically write thoughts, reflect on logs, and write down journals.
                    </p>
                  </div>
                  <input v-model="dreamStateEnabled" type="checkbox" class="h-5 w-5 cursor-pointer accent-primary-500">
                </div>

                <div class="flex items-center justify-between border border-neutral-100 rounded-xl bg-neutral-50/30 p-4 dark:border-neutral-700/40 dark:bg-neutral-900/20">
                  <div class="flex flex-col gap-1">
                    <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Autonomous Artistry</label>
                    <p class="max-w-md text-xs text-neutral-400">
                      Allow the companion to autonomously trigger emotes and manners without direct instructions.
                    </p>
                  </div>
                  <input v-model="artistryAutonomousEnabled" type="checkbox" class="h-5 w-5 cursor-pointer accent-primary-500">
                </div>

                <div class="flex items-center justify-between border border-neutral-100 rounded-xl bg-neutral-50/30 p-4 dark:border-neutral-700/40 dark:bg-neutral-900/20">
                  <div class="flex flex-col gap-1">
                    <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Active Proactivity</label>
                    <p class="max-w-md text-xs text-neutral-400">
                      Allow companion to initiate conversations periodically without user prompts.
                    </p>
                  </div>
                  <input v-model="proactivityEnabled" type="checkbox" class="h-5 w-5 cursor-pointer accent-primary-500">
                </div>
              </div>
            </div>

            <!-- STEP 5: Visual Description & Artistry -->
            <div v-if="currentStep === 5" class="flex flex-col gap-4">
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                Finetune your companion's visual description and prompt prefix to keep them self-aware and visually consistent.
              </p>

              <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                  <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Visual Description</label>
                  <textarea
                    v-model="description"
                    placeholder="Enter visual/physical details in prose..."
                    rows="4"
                    class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
                  />
                  <Button
                    variant="secondary"
                    class="w-full flex items-center justify-center gap-2"
                    :disabled="generatingDescription"
                    @click="generateVisualDescription"
                  >
                    <div v-if="generatingDescription" class="i-solar:refresh-bold animate-spin" />
                    <div v-else class="i-solar:sparkles-bold-duotone text-violet-500" />
                    {{ generatingDescription ? 'Generating description...' : 'Generate Visual Description of Model' }}
                  </Button>
                </div>

                <div v-if="artistryAutonomousEnabled" class="flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-700/50">
                  <label class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">Artistry Prompt Prefix</label>
                  <textarea
                    v-model="artistryPromptPrefix"
                    placeholder="Enter Stable Diffusion prompt tags (e.g. blonde hair, blue eyes)..."
                    rows="3"
                    class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:focus:border-primary-400"
                  />
                  <Button
                    variant="secondary"
                    class="w-full flex items-center justify-center gap-2"
                    :disabled="generatingPrefix"
                    @click="generateImagePrompt"
                  >
                    <div v-if="generatingPrefix" class="i-solar:refresh-bold animate-spin" />
                    <div v-else class="i-solar:sparkles-bold-duotone text-violet-500" />
                    {{ generatingPrefix ? 'Generating image prompt...' : 'Generate Image Prompt of Model' }}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <!-- Wizard Footer Controls -->
          <div class="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <template v-if="props.draftOnly">
              <Button
                variant="secondary"
                icon="i-solar:close-circle-bold-duotone"
                label="Cancel"
                @click="emit('update:modelValue', false)"
              />
              <Button
                variant="primary"
                icon="i-solar:check-circle-bold-duotone"
                label="Stage Companion"
                @click="finalizeImport"
              />
            </template>
            <template v-else>
              <Button
                variant="secondary"
                icon="i-solar:arrow-left-bold-duotone"
                label="Back"
                :disabled="currentStep === 1"
                @click="prevStep"
              />
              <Button
                v-if="currentStep < 5"
                variant="primary"
                icon="i-solar:arrow-right-bold-duotone"
                label="Next"
                @click="nextStep"
              />
              <Button
                v-else
                variant="primary"
                icon="i-solar:check-circle-bold-duotone"
                label="Complete Setup"
                @click="finalizeImport"
              />
            </template>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
