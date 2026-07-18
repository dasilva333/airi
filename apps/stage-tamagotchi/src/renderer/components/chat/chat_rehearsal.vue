<script setup lang="ts">
import type { ChatProvider } from '@xsai-ext/providers/utils'

import { useCustomVrmAnimationsStore } from '@proj-airi/stage-ui-three'
import { ModelCustomizer, ModelPromptGeneratorModal } from '@proj-airi/stage-ui/components/scenarios/settings/model-settings'
import { useAnimaDexWizardStore } from '@proj-airi/stage-ui/stores/animadex-wizard'
import { useChatOrchestratorStore } from '@proj-airi/stage-ui/stores/chat'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAutonomousArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry-autonomous'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsControlStrip } from '@proj-airi/stage-ui/stores/settings/control-strip'
import { buildVRMA, VRMA_SYSTEM_PROMPT, VRMAMotionSpecSchema } from '@proj-airi/stage-ui/utils'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import * as v from 'valibot'

const airiCardStore = useAiriCardStore()
const displayModelsStore = useDisplayModelsStore()
const wizardStore = useAnimaDexWizardStore()
const controlStripStore = useSettingsControlStrip()
const autonomousArtistryStore = useAutonomousArtistryStore()
const llmStore = useLLM()
const consciousnessStore = useConsciousnessStore()
const providersStore = useProvidersStore()
const orchestrator = useChatOrchestratorStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { stageEnabled } = storeToRefs(controlStripStore)
const { activeProvider, activeModel } = storeToRefs(consciousnessStore)

onMounted(async () => {
  if (wizardStore.characters.length === 0)
    await wizardStore.loadCatalog()
})

const selectedKey = ref<string | null>(null)

function getModelPreviewUrl(modelId?: string) {
  if (!modelId)
    return ''
  const model = displayModelsStore.displayModels.find(m => m.id === modelId)
  return model?.previewImage || ''
}

/**
 * Rehearsal room is only concerned with 3D models that are physically "on set".
 *
 * Case A (Multi-Actor): collect every visual_asset entry that has a manifestation.modelId bound.
 *
 * Case B (Single-Actor / Fallback): If NO entries have a manifestation.modelId,
 * we synthesize 1 manually constructed item representing the active modules.displayModelId.
 */
const onSetModels = computed(() => {
  if (!activeCard.value)
    return []

  const assets = (activeCard.value.extensions?.airi?.visual_assets || {}) as Record<string, any>
  const modules = (activeCard.value.extensions?.airi?.modules || {}) as Record<string, any>

  const list: Array<{
    key: string
    name: string
    modelId: string
    avatarUrl: string
    isFallback: boolean
  }> = []

  // Check visual assets for per-actor manifestations
  for (const key of Object.keys(assets)) {
    const asset = assets[key] || {}
    const mod = modules[key] || {}

    const modelId = mod.manifestation?.modelId || asset.manifestation?.modelId
    if (!modelId)
      continue

    let displayName = key
    if (key === 'concept_user')
      displayName = 'User Entity'
    else
      displayName = key.replace(/^(actor_|actress_)/, '').replace(/_/g, ' ')

    let avatarUrl = getModelPreviewUrl(modelId)
    if (!avatarUrl) {
      const rawPrompt = mod.prompt || asset.prompt || ''
      const match = wizardStore.findCatalogCharacter(rawPrompt)
      const canonicalTrigger = match ? match.trigger : rawPrompt.split(',')[0]?.trim()
      avatarUrl = wizardStore.getCharacterThumbUrl(canonicalTrigger) || ''
    }

    list.push({
      key,
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      modelId,
      avatarUrl,
      isFallback: false,
    })
  }

  // Fallback Case B: Simple/Gen1 card with no per-actor manifestations.
  // Synthesize one single-item roster representing modules.displayModelId
  if (list.length === 0) {
    const fallbackId = modules.displayModelId
    if (fallbackId) {
      const displayName = (activeCard.value as any).nickname || activeCard.value.name || 'Primary Actor'
      let avatarUrl = getModelPreviewUrl(fallbackId)
      if (!avatarUrl) {
        const rawPrompt = activeCard.value.systemPrompt || ''
        const match = wizardStore.findCatalogCharacter(rawPrompt)
        const canonicalTrigger = match ? match.trigger : rawPrompt.split(',')[0]?.trim()
        avatarUrl = wizardStore.getCharacterThumbUrl(canonicalTrigger) || ''
      }

      list.push({
        key: 'actor_primary',
        name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        modelId: fallbackId,
        avatarUrl,
        isFallback: true,
      })
    }
  }

  console.log('[RehearsalRoom] onSetModels computed:', {
    cardId: activeCardId.value,
    count: list.length,
    models: list.map(m => ({ key: m.key, modelId: m.modelId, isFallback: m.isFallback })),
  })

  return list
})

// Active selection — resolves to selectedKey, or falls back to active concept on stage, or first element
const selectedModel = computed(() => {
  if (onSetModels.value.length === 0)
    return null

  const activeConcepts = activeCard.value?.extensions?.airi?.active_concepts || []
  // Priority: 1. explicit selection, 2. last active concept that matches a model on set, 3. first model on set
  const key = selectedKey.value
    || [...activeConcepts].reverse().find(id => onSetModels.value.some(m => m.key === id))
    || onSetModels.value[0]?.key

  return onSetModels.value.find(m => m.key === key) || onSetModels.value[0] || null
})

// Update selectedKey to keep UI selector highlighted
watch(selectedModel, (newVal) => {
  if (newVal && selectedKey.value !== newVal.key) {
    selectedKey.value = newVal.key
  }
}, { immediate: true })

const activeModelId = computed<string | null>(() => {
  return selectedModel.value?.modelId || null
})

// Resolve Model Format
const currentModel = computed(() => {
  return displayModelsStore.displayModels.find(m => m.id === activeModelId.value)
})

const modelType = computed<'live2d' | 'vrm' | 'mmd' | 'spine' | 'unknown'>(() => {
  if (!currentModel.value)
    return 'unknown'
  const fmt = currentModel.value.format
  if (fmt === DisplayModelFormat.Live2dZip || fmt === DisplayModelFormat.Live2dDirectory)
    return 'live2d'
  if (fmt === DisplayModelFormat.VRM)
    return 'vrm'
  if (fmt === DisplayModelFormat.PMXZip || fmt === DisplayModelFormat.PMXDirectory || fmt === DisplayModelFormat.PMD)
    return 'mmd'
  if (fmt === DisplayModelFormat.SpineZip)
    return 'spine'
  return 'unknown'
})

// Sandbox states & methods
const playgroundText = ref('<|ACT:emotion="happy"|> Hello world! Welcome to the Stage.')
const isRehearsing = ref(false)
const isGeneratingMotion = ref(false)
const shouldDownloadBackup = ref(false)
const isGeneratingAI = ref(false)
const showPromptGenerator = ref(false)
const aiSuggestions = ref<Array<{ title: string, dialogue: string }>>([])

const visibleEmotions = ref<string[]>([])
const visibleMotions = ref<string[]>([])

function handleVisibleCapabilitiesUpdate(payload: { emotions: string[], motions: string[] }) {
  visibleEmotions.value = payload.emotions
  visibleMotions.value = payload.motions
}

function handleInsertToken(token: string) {
  if (playgroundText.value.trim().length > 0) {
    playgroundText.value = `${playgroundText.value.trim()} ${token}`
  }
  else {
    playgroundText.value = token
  }
  toast.success('Appended token to sandbox!')
}

async function createMotion() {
  const prompt = playgroundText.value.trim()
  if (!prompt) {
    toast.error('Please enter a motion description in the text box.')
    return
  }

  const providerId = activeProvider.value
  const model = activeModel.value
  if (!providerId || !model) {
    toast.error('Please configure an active LLM provider first.')
    return
  }

  const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
  if (!provider) {
    toast.error(`Failed to resolve provider instance for "${providerId}".`)
    return
  }

  try {
    isGeneratingMotion.value = true
    toast.info('Generating motion spec via LLM...')

    const messages = [
      { role: 'system' as const, content: VRMA_SYSTEM_PROMPT },
      { role: 'user' as const, content: `Create a motion animation for: ${prompt}` },
    ]

    const spec = await llmStore.generateObject(model, provider, {
      messages,
      schema: VRMAMotionSpecSchema,
      maxAttempts: 3,
    })

    toast.info('Compiling motion to VRMA...')
    const buffer = buildVRMA(spec)

    // Save to Database (custom-vrm-animations store / localforage)
    let dbSaveSuccess = false
    let animationKey = ''
    try {
      const fileName = `${spec.name || 'motion'}.vrma`
      const file = new File([buffer], fileName, { type: 'model/gltf-binary' })
      animationKey = await customVrmAnimationsStore.addCustomAnimation(file)
      toast.success('Motion saved to library successfully!')
      dbSaveSuccess = true
    }
    catch (dbErr: any) {
      console.error('[CreateMotion] Database save failed:', dbErr)
      toast.error(`Library save failed: ${dbErr.message || String(dbErr)}. Running backup download...`)
    }

    // Failsafe backup download if requested or if DB save failed
    if (shouldDownloadBackup.value || !dbSaveSuccess) {
      const blob = new Blob([buffer], { type: 'model/gltf-binary' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${spec.name || 'motion'}.vrma`
      a.click()
      URL.revokeObjectURL(url)

      if (dbSaveSuccess) {
        toast.success('Backup file downloaded successfully!')
      }
    }

    // Automatically stage the ACT token and play the rehearsal
    if (dbSaveSuccess && animationKey) {
      playgroundText.value = `<|ACT:motion="${spec.name || 'motion'}"|>`
      setTimeout(() => {
        void playRehearsal()
      }, 500)
    }
  }
  catch (err: any) {
    console.error('[CreateMotion] Failed:', err)
    toast.error(`Generation failed: ${err.message || String(err)}`)
  }
  finally {
    isGeneratingMotion.value = false
  }
}

async function playRehearsal() {
  if (!stageEnabled.value) {
    toast.error('Stage window must be open to orchestrate rehearsals.')
    return
  }
  if (isRehearsing.value)
    return
  isRehearsing.value = true

  try {
    const text = playgroundText.value.trim()
    console.info('[Rehearsal Playback] Streaming via Chat Orchestrator hooks:', text)

    const dummyContext = {
      assistantMessageId: `rehearsal-${Date.now()}`,
      assistantMessageCreatedAt: Date.now(),
    }

    // Start of response
    await orchestrator.emitBeforeSendHooks('', dummyContext as any)

    // Split content into markers and text segments
    const parts = text.split(/(<\|(?:ACT|DELAY|ACTOR)[^\r\n]*?(?:\|>|>))/gi)
    for (const part of parts) {
      if (!part)
        continue

      // Delay slightly between streams to simulate standard streaming token rate
      await new Promise(resolve => setTimeout(resolve, 80))

      if (part.startsWith('<|')) {
        console.info('[Rehearsal Playback] Emitting Special Tag:', part)
        await orchestrator.emitTokenSpecialHooks(part, dummyContext as any)
      }
      else {
        console.info('[Rehearsal Playback] Emitting Literal Text:', part)
        await orchestrator.emitTokenLiteralHooks(part, dummyContext as any)
      }
    }

    // End of stream
    await orchestrator.emitStreamEndHooks(dummyContext as any)

    const content = text.replace(/<\|ACT:[^|]+\|>/g, '').trim()
    await orchestrator.emitAssistantResponseEndHooks(content, dummyContext as any)

    setTimeout(() => {
      isRehearsing.value = false
    }, 1000)
  }
  catch (err) {
    console.error('Rehearsal playback streaming failed:', err)
    isRehearsing.value = false
  }
}

async function suggestDialogue() {
  if (!activeCard.value)
    return
  if (!activeProvider.value || !activeModel.value) {
    toast.error('No active LLM model or provider is selected. Configure them in settings first.')
    return
  }

  isGeneratingAI.value = true
  aiSuggestions.value = []

  try {
    const providerInstance = await providersStore.getProviderInstance(activeProvider.value)
    if (!providerInstance) {
      throw new Error('Failed to get active LLM provider instance.')
    }

    const emotionsList = visibleEmotions.value
    const motionsList = visibleMotions.value

    const systemPrompt = `You are a creative dialogue script designer for a VTuber/AI agent rehearsal sandbox.
The user wants to generate 4 dialogue acting presets.
The avatar has the following acting capabilities:
- Available Emotions: [ ${emotionsList.join(', ') || 'None'} ]
- Available Motions: [ ${motionsList.join(', ') || 'None'} ]

Requirements for the dialogue presets:
1. Generate exactly 4 presets.
2. For each preset, create a short, punchy 1-2 word title (e.g., 'Shy Greeting', 'Surprised Gasps', 'Flustered Anger', 'Deep Thought').
3. For each preset, write a natural dialogue line and embed <|ACT:emotion="key"|> or <|ACT:motion="key"|> tokens naturally inside the text.
4. Try to make at least 2 presets use a single emotion/motion token, and 2 presets use a combination of both an emotion and a motion (if both lists have items).
5. Only use the exact emotion and motion keys listed above. Do not invent new ones.

Example output structure:
Preset 1: Title: 'Happy Wave', Dialogue: '<|ACT:emotion="happy"|> Hello there! <|ACT:motion="wave"|> I am so glad to see you!'
Preset 2: Title: 'Flustered Shock', Dialogue: '<|ACT:emotion="surprised"|> Wait! What do you mean by that?!'`

    const schema = v.object({
      suggestions: v.array(
        v.object({
          title: v.string(),
          dialogue: v.string(),
        }),
      ),
    })

    const result = await llmStore.generateObject<any>(
      activeModel.value,
      providerInstance as any,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate 4 creative acting presets.' },
        ],
        schema,
      },
    )

    if (result && Array.isArray(result.suggestions)) {
      aiSuggestions.value = result.suggestions
      toast.success('Generated 4 new acting presets!')
    }
    else {
      throw new Error('Invalid response structure.')
    }
  }
  catch (err) {
    console.error('AI suggestion failed:', err)
    toast.error(`AI Suggestion failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  finally {
    isGeneratingAI.value = false
  }
}

const dynamicPresets = computed(() => {
  const emotionsList = visibleEmotions.value
  const motionsList = visibleMotions.value

  const presets = []

  if (emotionsList.length > 0) {
    presets.push({
      label: 'Single Emotion',
      text: `<|ACT:emotion="${emotionsList[0]}"|> Hello world!`,
    })
  }
  else if (motionsList.length > 0) {
    presets.push({
      label: 'Single Motion',
      text: `<|ACT:motion="${motionsList[0]}"|> Hello world!`,
    })
  }

  if (emotionsList.length > 1) {
    presets.push({
      label: 'Dual Emotions',
      text: `<|ACT:emotion="${emotionsList[0]}"|> This is a sandbox test. <|ACT:emotion="${emotionsList[1]}"|>`,
    })
  }
  else if (motionsList.length > 1) {
    presets.push({
      label: 'Dual Motions',
      text: `<|ACT:motion="${motionsList[0]}"|> This is a sandbox test. <|ACT:motion="${motionsList[1]}"|>`,
    })
  }

  if (emotionsList.length > 0 && motionsList.length > 0) {
    presets.push({
      label: 'Combo Tag',
      text: `<|ACT:emotion="${emotionsList[0]}",motion="${motionsList[0]}"|> Moving and speaking.`,
    })
  }

  if (emotionsList.length > 1 && motionsList.length > 1) {
    presets.push({
      label: 'Dual Combos',
      text: `<|ACT:emotion="${emotionsList[0]}",motion="${motionsList[0]}"|> Starting off... <|ACT:emotion="${emotionsList[1]}",motion="${motionsList[1]}"|> and transitioning.`,
    })
  }

  return presets
})

const activeEmotions = computed(() => visibleEmotions.value)

const activeMotions = computed(() => visibleMotions.value)

async function handlePromptSave(newValue: string) {
  if (!activeCard.value || !activeCardId.value)
    return

  const currentActing = activeCard.value.extensions?.airi?.acting || {}

  airiCardStore.updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions.airi,
        acting: {
          ...currentActing,
          modelExpressionPrompt: newValue,
        },
      },
    },
  })
  toast.success('Acting instructions updated successfully on character card!')
}

// Click handler
function selectModel(m: typeof onSetModels.value[0]) {
  selectedKey.value = m.key
  if (!m.isFallback) {
    // Case A (Multi-Actor Concepts): Activate the concept on stage via concept stack
    void autonomousArtistryStore.activateConcept(m.key)
  }
  else if (activeCard.value && activeCardId.value) {
    // Case B (Single-Actor Fallback): Manually sync card's top-level displayModelId
    const extension = JSON.parse(JSON.stringify(activeCard.value.extensions || {}))
    if (!extension.airi)
      extension.airi = {}
    if (!extension.airi.modules)
      extension.airi.modules = {}

    extension.airi.modules.displayModelId = m.modelId

    void airiCardStore.updateCard(activeCardId.value, {
      ...activeCard.value,
      extensions: extension,
    })
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden bg-white dark:bg-neutral-900/10">
    <!-- Header -->
    <div class="shrink-0 px-4 pb-2 pt-4">
      <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
        Rehearsal Room
      </h3>
      <p class="mt-0.5 text-[10px] text-neutral-500">
        Select a model then map emotion &amp; motion keys in real time.
      </p>
    </div>

    <!-- Stage offline warning -->
    <div
      v-if="!stageEnabled"
      class="mx-4 mb-2 border border-amber-200/50 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:border-amber-900/50 dark:text-amber-400"
    >
      <div class="flex items-center gap-1 font-semibold">
        <div class="i-solar:shield-warning-bold-duotone text-sm" />
        Stage Window Offline
      </div>
      <p class="mt-0.5 text-[10px] leading-relaxed opacity-80">
        Open the Stage window to preview expressions live.
      </p>
    </div>

    <!-- No card loaded -->
    <div v-if="!activeCardId" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div class="i-solar:user-id-bold-duotone mb-2 text-4xl text-neutral-300 dark:text-neutral-700" />
      <h4 class="text-sm text-neutral-700 font-semibold dark:text-neutral-300">
        No Card Active
      </h4>
      <p class="mt-1 max-w-xs text-xs text-neutral-500">
        Open a chat session with an active character card to use the rehearsal room.
      </p>
    </div>

    <template v-else>
      <!-- Unified Model Selector Grid (5 columns) -->
      <div class="shrink-0 px-4 pb-2">
        <div v-if="onSetModels.length === 0" class="py-2 text-center text-[10px] text-neutral-400 italic">
          No models bound to this card.
        </div>
        <div v-else class="grid grid-cols-5 gap-1.5">
          <button
            v-for="m in onSetModels"
            :key="m.key"
            class="group relative h-16 w-full flex flex-col justify-end overflow-hidden border rounded-xl transition-all duration-200"
            :class="selectedModel?.key === m.key
              ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md shadow-primary-500/10'
              : 'border-neutral-200 dark:border-neutral-800 opacity-60 hover:opacity-90 hover:border-neutral-300 dark:hover:border-neutral-700'"
            @click="selectModel(m)"
          >
            <!-- Avatar -->
            <div class="absolute inset-0 bg-neutral-100 dark:bg-neutral-900">
              <img
                v-if="m.avatarUrl"
                :src="m.avatarUrl"
                class="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
              >
              <div v-else class="h-full w-full flex items-center justify-center text-neutral-400 dark:text-neutral-600">
                <div class="i-solar:user-bold-duotone text-xl" />
              </div>
            </div>
            <div class="absolute inset-0 from-black/80 via-black/20 to-transparent bg-gradient-to-t" />
            <div class="relative z-10 px-1.5 pb-1.5">
              <span class="line-clamp-1 block text-[9px] text-white font-bold leading-tight drop-shadow">
                {{ m.name }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Divider -->
      <div v-if="onSetModels.length > 0" class="mx-4 mb-2 border-t border-neutral-100 dark:border-neutral-800/60" />

      <!-- Sandbox Playground -->
      <div class="shrink-0 px-4 pb-3">
        <div class="border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-950/20">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Sandbox Playground</span>
          </div>

          <div class="border border-neutral-200 rounded-lg bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <textarea
              v-model="playgroundText"
              rows="2"
              class="w-full border-none bg-transparent p-2 text-xs dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-0"
              placeholder="e.g. <|ACT:emotion=&quot;happy&quot;|> Hello world!"
            />
          </div>

          <div class="mt-2 flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <button
                class="flex cursor-pointer items-center gap-1 rounded bg-primary-500/10 px-2.5 py-1 text-[10px] text-primary-600 font-bold transition-all hover:bg-primary-500/20 dark:text-primary-400"
                :disabled="isRehearsing"
                @click="playRehearsal"
              >
                <div :class="isRehearsing ? 'i-solar:spinner-bold animate-spin text-[10px]' : 'i-solar:clapperboard-play-bold-duotone'" />
                Act
              </button>

              <button
                v-if="modelType === 'vrm'"
                class="flex cursor-pointer items-center gap-1 rounded bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-600 font-bold transition-all hover:bg-indigo-500/20 dark:text-indigo-400 disabled:opacity-50"
                :disabled="isGeneratingMotion"
                @click="createMotion"
              >
                <div :class="isGeneratingMotion ? 'i-solar:spinner-bold animate-spin text-[10px]' : 'i-solar:magic-stick-3-bold-duotone'" />
                Create Motion
              </button>

              <button
                class="flex cursor-pointer items-center gap-1 rounded bg-primary-500/10 px-2.5 py-1 text-[10px] text-primary-600 font-medium transition-all hover:bg-primary-500/20 dark:text-primary-400"
                :disabled="isGeneratingAI"
                @click="suggestDialogue"
              >
                <div :class="isGeneratingAI ? 'i-solar:spinner-bold animate-spin text-[10px]' : 'i-solar:magic-stick-3-bold-duotone'" />
                {{ isGeneratingAI ? 'Generating...' : 'Suggest Dialog' }}
              </button>

              <button
                class="flex cursor-pointer items-center gap-1 rounded bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-600 font-medium transition-all hover:bg-indigo-500/20 dark:text-indigo-400"
                @click="showPromptGenerator = true"
              >
                <div class="i-ph:sparkle animate-pulse text-[10px]" />
                Generate Acting Instructions
              </button>
            </div>

            <div v-if="modelType === 'vrm'" class="flex items-center gap-2 pl-0.5">
              <label class="flex cursor-pointer select-none items-center gap-1.5 py-0.5">
                <input
                  v-model="shouldDownloadBackup"
                  type="checkbox"
                  class="h-3 w-3 border-neutral-300 rounded text-indigo-500 accent-indigo-500 focus:ring-indigo-500"
                >
                <span class="text-[9px] text-neutral-400 font-semibold dark:text-neutral-500">Download backup file to disk</span>
              </label>
            </div>

            <p class="text-[9px] text-neutral-400 leading-normal dark:text-neutral-500">
              Clicking this compiles all visible emotions, motions, and actor profiles into detailed markdown instructions that teach the AI how and when to emote. You can save these instructions directly to your character card's system settings.
            </p>
          </div>

          <!-- presets & suggestions tray -->
          <div class="flex flex-wrap gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <!-- Dynamic Templates (Always Available) -->
            <button
              v-for="p in dynamicPresets"
              :key="p.label"
              class="cursor-pointer border border-primary-200/50 rounded bg-primary-50/20 px-2 py-0.5 text-[9px] text-primary-600 font-bold transition-all dark:border-primary-900/40 dark:bg-primary-950/10 hover:bg-primary-500/10 dark:text-primary-400"
              @click="playgroundText = p.text"
            >
              {{ p.label }}
            </button>

            <!-- LLM Suggestions -->
            <button
              v-for="s in aiSuggestions"
              :key="s.title"
              class="cursor-pointer border border-neutral-200 rounded bg-white px-2 py-0.5 text-[9px] text-neutral-600 font-medium transition-all dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              @click="playgroundText = s.dialogue"
            >
              {{ s.title }}
            </button>
          </div>
        </div>
      </div>

      <!-- No model active -->
      <div v-if="!activeModelId" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div class="i-solar:link-broken-bold-duotone mb-2 text-4xl text-neutral-300 dark:text-neutral-700" />
        <h4 class="text-sm text-neutral-700 font-semibold dark:text-neutral-300">
          No Model Active
        </h4>
        <p class="mt-1 max-w-xs text-xs text-neutral-500">
          Bind a model in Settings → Card → Studio.
        </p>
      </div>

      <!-- ModelCustomizer powered by active model -->
      <div v-else class="flex flex-1 flex-col overflow-hidden px-4 pb-4">
        <ModelCustomizer
          :key="activeModelId"
          :model-id="activeModelId"
          :show-insert-actions="true"
          @insert-token="handleInsertToken"
          @update:visible-capabilities="handleVisibleCapabilitiesUpdate"
        />
      </div>

      <!-- Prompt Instructions Generator Modal -->
      <ModelPromptGeneratorModal
        v-model="showPromptGenerator"
        :active-emotions="activeEmotions"
        :active-motions="activeMotions"
        :on-set-models="onSetModels"
        @save="handlePromptSave"
      />
    </template>
  </div>
</template>
