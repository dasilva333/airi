<script setup lang="ts">
import type { Card } from '@proj-airi/ccc'
import type { AiriExtension } from '@proj-airi/stage-ui/stores/modules/airi-card'
import type { SpeechCapabilitiesInfo } from '@proj-airi/stage-ui/stores/providers'

import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { animations } from '@proj-airi/stage-ui-three/assets/vrm'
import { DEFAULT_ARTISTRY_WIDGET_INSTRUCTION } from '@proj-airi/stage-ui/constants/prompts/artistry-instruction'
import { DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT, DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT, DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT, DEFAULT_ARTISTRY_INTRUSION_PROMPT, DEFAULT_DREAM_INTRUSION_PROMPT, DEFAULT_HEARTBEATS_PROMPT, DEFAULT_JOURNAL_INTRUSION_PROMPT, DEFAULT_POST_HISTORY_INSTRUCTIONS, DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings/stage-model'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import FieldAiGeneratorModal from './FieldAiGeneratorModal.vue'
import ImageTagExtractorModal from './ImageTagExtractorModal.vue'
import CardCreationTabActing from './tabs/CardCreationTabActing.vue'
import CardCreationTabArtistry from './tabs/CardCreationTabArtistry.vue'
import CardCreationTabCognition from './tabs/CardCreationTabCognition.vue'
import CardCreationTabGeneration from './tabs/CardCreationTabGeneration.vue'
import CardCreationTabIdentity from './tabs/CardCreationTabIdentity.vue'
import CardCreationTabModules from './tabs/CardCreationTabModules.vue'
import CardCreationTabProactivity from './tabs/CardCreationTabProactivity.vue'
import CardCreationTabTools from './tabs/CardCreationTabTools.vue'

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'studio', cardId: string): void
}>()

function kebabcase(str: string): string {
  return str
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Props {
  modelValue: boolean
  cardId?: string // If provided, edit mode; otherwise create mode
}

const modelValue = defineModel<boolean>()

const { t } = useI18n()
const cardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const artistryStore = useArtistryStore()
const proactivityStore = useProactivityStore()
const providersStore = useProvidersStore()
const displayModelsStore = useDisplayModelsStore()
const stageModelStore = useSettingsStageModel()
const modelStore = useModelStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const backgroundStore = useBackgroundStore()
const live2dStore = useLive2d()
const mmdStore = useMmd()
const spineStore = useSpine()

const { sensorPayload } = storeToRefs(proactivityStore)
const { activeProvider: consciousnessProvider, activeModel: defaultConsciousnessModel } = storeToRefs(consciousnessStore)
const { activeSpeechProvider: speechProvider, activeSpeechModel: defaultSpeechModel, activeSpeechVoiceId: defaultSpeechVoiceId } = storeToRefs(speechStore)
const { stageModelSelected: defaultDisplayModelId } = storeToRefs(stageModelStore)
const { activeProvider: defaultArtistryProvider } = storeToRefs(artistryStore)
const { availableExpressions } = storeToRefs(modelStore)
const { animationOptions } = storeToRefs(customVrmAnimationsStore)
const { availableExpressions: live2dExpressions } = storeToRefs(live2dStore)
const { availableMorphs: mmdMorphs, availableMotions: mmdMotions, customMotions: mmdCustomMotions } = storeToRefs(mmdStore)
const { availableAnimations: spineAnimations } = storeToRefs(spineStore)

// Determine if we're in edit mode
const isEditMode = computed(() => !!props.cardId)

const isLive2d = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find(m => m.id === modelId)
  if (!model)
    return false
  return model.format === DisplayModelFormat.Live2dZip || model.format === DisplayModelFormat.Live2dDirectory
})

const isSpine = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find(m => m.id === modelId)
  if (!model)
    return false
  return model.format === DisplayModelFormat.SpineZip
})

const isMmd = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find(m => m.id === modelId)
  if (!model)
    return false
  return model.format === DisplayModelFormat.PMXZip || model.format === DisplayModelFormat.PMXDirectory || model.format === DisplayModelFormat.PMD
})

// Modules configuration
const selectedConsciousnessProvider = ref<string>('')
const selectedConsciousnessModel = ref<string>('')
const selectedSpeechProvider = ref<string>('')
const selectedSpeechModel = ref<string>('')
const selectedSpeechVoiceId = ref<string>('')
const selectedDisplayModelId = ref<string>('')
const selectedActiveBackgroundId = ref<string>('none')
const cognitivePipelineEnabled = ref<boolean>(false)
const firstHopProcessor = ref<'none' | 'local_nan0'>('none')
const selectedFirstHopProvider = ref<string>('')
const selectedFirstHopModel = ref<string>('')
const selectedArtistryProvider = ref<string>('')
const selectedArtistryModel = ref<string>('')
const selectedArtistryPromptPrefix = ref<string>('')
const selectedArtistryWidgetInstruction = ref<string>('')
const selectedArtistryAutonomousEnabled = ref<boolean>(false)
const selectedArtistryAutonomousThreshold = ref<number>(49)
const selectedArtistryAutonomousTarget = ref<'user' | 'assistant'>('assistant')
const selectedArtistryAutonomousMonitorEnabled = ref<boolean>(true)
const selectedArtistryAutonomousMonitorDiscordEnabled = ref<boolean>(false)
const selectedArtistryAutonomousHistoryDepth = ref<number>(3)
const selectedArtistryAutonomousModelMode = ref<'inherit' | 'custom'>('inherit')
const selectedArtistryAutonomousProvider = ref<string>('')
const selectedArtistryAutonomousModel = ref<string>('')
const selectedArtistrySpawnMode = ref<'bg' | 'widget' | 'inline' | 'bg_widget'>('bg')
const selectedArtistryConfigStr = ref<string>('{\n  \n}')
const generationEnabled = ref<boolean>(false)
const generationProvider = ref<string>('')
const generationModel = ref<string>('')
const generationMaxTokens = ref<number | undefined>(undefined)
const generationTemperature = ref<number | undefined>(undefined)
const generationTopP = ref<number | undefined>(undefined)
const generationContextWidth = ref<number | undefined>(undefined)
const generationAdvancedJson = ref<string>('{\n  \n}')
const generationReasoningFallback = ref<boolean>(true)
const compactionStrategy = ref<string>('none')
const compactionMinKeepTurns = ref<number | undefined>(15)
const generationAllowedTools = ref<string[] | undefined>(undefined)
const selectedActingModelExpressionPrompt = ref<string>('')
const selectedActingSpeechExpressionPrompt = ref<string>('')
const selectedActingSpeechMannerismPrompt = ref<string>('')
const selectedActingIdleAnimations = ref<string[]>([])

// Placeholder state variables for Tools tab
const selectedTextJournalInstruction = ref<string>('')
const selectedInjectDreamContext = ref<boolean>(false)
const selectedInjectJournalContext = ref<boolean>(false)
const selectedInjectArtistryContext = ref<boolean>(false)
const selectedDreamIntrusionPrompt = ref<string>('')
const selectedJournalIntrusionPrompt = ref<string>('')
const selectedArtistryIntrusionPrompt = ref<string>('')

// Resolve which visual asset (actor) corresponds to the currently active stage model.
// Returns the actor key and its idleAnimations override, or null if no override exists.
const activeActorIdleOverride = computed<{ key: string, idleAnimations: string[] } | null>(() => {
  const card = isEditMode.value && props.cardId ? cardStore.getCard(props.cardId) : undefined
  if (!card)
    return null
  const airiExt = card.extensions?.airi as any
  const visualAssets = airiExt?.visual_assets || {}
  const modelId = defaultDisplayModelId.value
  if (!modelId)
    return null

  for (const [key, asset] of Object.entries(visualAssets)) {
    const a = asset as any
    if (a?.manifestation?.modelId === modelId && a.idleAnimations) {
      return { key, idleAnimations: [...a.idleAnimations] }
    }
  }
  return null
})

// When the stage model changes (e.g. toggling concepts in Studio tab),
// sync the Acting tab's idle animation selection to reflect the active actor's override.
watch(defaultDisplayModelId, () => {
  const override = activeActorIdleOverride.value
  if (override) {
    selectedActingIdleAnimations.value = [...override.idleAnimations]
  }
  else {
    // Fall back to the global card-level idle animations
    const card = isEditMode.value && props.cardId ? cardStore.getCard(props.cardId) : undefined
    const airiExt = card?.extensions?.airi as any
    selectedActingIdleAnimations.value = [...(airiExt?.acting?.idleAnimations || [])]
  }
})

// When the user edits idle animations in the Acting tab while an actor override is active,
// live-persist the changes back to that actor's visual_assets block.
watch(selectedActingIdleAnimations, (newAnims) => {
  const override = activeActorIdleOverride.value
  if (!override || !isEditMode.value || !props.cardId)
    return

  const card = cardStore.getCard(props.cardId)
  if (!card)
    return

  const extension = JSON.parse(JSON.stringify(card.extensions || {}))
  if (extension.airi?.visual_assets?.[override.key]) {
    extension.airi.visual_assets[override.key].idleAnimations = [...newAnims]
    cardStore.updateCard(props.cardId, {
      ...card,
      extensions: extension,
    })
  }
}, { deep: true })

const actingSpeechCapabilities = ref<SpeechCapabilitiesInfo | null>(null)
const actingSpeechCapabilitiesLoading = ref<boolean>(false)

const DEFAULT_ACTING_MODEL_PROMPT = DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT

const MANNERISM_HELPER_SNIPPETS: Record<string, string> = {
  tilde: `## Tilde Replacements
Use occasional \`~\` when sounding playful, sing-song, teasing, or gently affectionate.
- Keep it light and sparse.
- Avoid using it on every sentence.
- Prefer it when the line should feel airy or mischievous.
`,
  eyes: `## Emoticon Replacements
Use short emoticon-style reactions when a strong expression would land better as a quick face than as plain words.
- Keep them readable and emotionally obvious.
- Use them for spikes of embarrassment, excitement, confusion, or stress.
- Do not overuse them in serious or dense exposition.
`,
  hmph: `## Hmph Variants
Use brief pouty or dismissive mannerisms when sounding stubborn, embarrassed, bratty, or mildly annoyed.
- Keep them occasional.
- Let them color the line instead of replacing the content.
- Use them when attitude matters more than pure politeness.
`,
}

// Heartbeats configuration
const heartbeatsEnabled = ref<boolean>(false)
const heartbeatsIntervalMinutes = ref<number>(5)
const heartbeatsPrompt = ref<string>('')
const heartbeatsInjectIntoPrompt = ref<boolean>(true)
const heartbeatsUseAsLocalGate = ref<boolean>(true)
const heartbeatsScheduleStart = ref<string>('09:00')
const heartbeatsScheduleEnd = ref<string>('22:00')
const heartbeatsContextWindowHistory = ref<boolean>(true)
const heartbeatsContextSystemLoad = ref<boolean>(true)
const heartbeatsContextUsageMetrics = ref<boolean>(true)
const heartbeatsRespectSchedule = ref<boolean>(true)
const dreamStateEnabled = ref<boolean>(false)
const dreamStateStrictAfkGating = ref<boolean>(true)
const dreamStateRichness = ref<'minimal' | 'balanced' | 'lush'>('balanced')
const dreamStateAfkThresholdMinutes = ref<number>(5)
const dreamStateSessionTimeoutMinutes = ref<number>(60)
const dreamStateMaxSessionsPerDay = ref<number>(4)
const dreamStateInjectDreamContext = ref<boolean>(true)
const dreamStateMinConversationTurns = ref<number>(4)

// Screen Watching (Attention Ecology)
const screenWatchingEnabled = ref<boolean>(false)
const screenWatchingDeliveryMode = ref<'both' | 'bubble_only' | 'tts_only' | 'off'>('both')
const screenWatchingSourceType = ref<'displays' | 'applications' | 'auto_focused'>('displays')
const screenWatchingSourceId = ref<string>('')
const screenWatchingCaptureIntervalMs = ref<number>(2000)
const screenWatchingDownscalePercent = ref<number>(100)
const screenWatchingWorkload = ref<'attention-guard' | 'screen:interpret' | 'screen:ocr'>('attention-guard')
const screenWatchingPublishToContext = ref<boolean>(false)
const screenWatchingInterestTags = ref<string[]>(['antigravity', 'terminal_error', 'youtube', 'discord'])
const screenWatchingDeferWhileSpeaking = ref<boolean>(true)
const screenWatchingMaxPerHour = ref<number>(4)
const screenWatchingHysteresisMinutes = ref<number>(3)

// Sensors & Event Ledger
const eventLedgerEnabled = ref<boolean>(true)
const eventLedgerSampleDepth = ref<number>(6)
const eventLedgerDomains = ref<string[]>(['vision', 'tools', 'chat', 'memory', 'discord'])

// Short-Term Memory (24h Daily Summaries)
const shortTermMemoryEnabled = ref<boolean>(true)
const shortTermMemoryWindowSize = ref<number>(3)
const shortTermMemoryTokenBudget = ref<number>(1000)

const groundingEnabled = ref<boolean>(false)

watch(dreamStateInjectDreamContext, (val) => {
  selectedInjectDreamContext.value = val
})

watch(selectedInjectDreamContext, (val) => {
  dreamStateInjectDreamContext.value = val
})

const staticSamplePayload = `[Sensor Data]
User Idle: 15s
[ VS Code ] [ 15m ] [ 10:45 - 11:00 ]
[ Spotify ] [ 3m ] [ 11:00 - 11:03 ]
CPU Load (1/5/15): 0.5 | 0.72 | 0.61
GPU Load (Avg): 0.45
Volume Level: 85%
Current Local Time: 14:30
Active Character Default Background: cozy-tea-corner-in-pastel-hues.png

[Usage Metrics (Last Hr)]
TTS (Last Hr): 5
STT (Last Hr): 0
Chat (Last Hr): 2
Journal Entries (Last Hr): 1
Turn Count: 498 (Next Target: 500)`

const consciousnessProviderOptions = computed(() => {
  return providersStore.configuredChatProvidersMetadata.map(provider => ({
    value: provider.id,
    label: provider.localizedName || provider.name,
  }))
})

const artistryProviderOptions = computed(() => {
  return [
    { value: 'none', label: 'None (Disabled)' },
    { value: 'replicate', label: 'Replicate' },
    { value: 'comfyui', label: 'ComfyUI' },
  ]
})

// Computed: available consciousness models options
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

const generationProviderOptions = computed(() => consciousnessProviderOptions.value)

const generationModelOptions = computed(() => {
  const provider = generationProvider.value || selectedConsciousnessProvider.value || consciousnessProvider.value
  if (!provider)
    return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map(model => ({
    value: model.id,
    label: model.name || model.id,
  }))
})

const firstHopModelOptions = computed(() => {
  const provider = selectedFirstHopProvider.value || consciousnessProvider.value
  if (!provider)
    return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map(model => ({
    value: model.id,
    label: model.name || model.id,
  }))
})

// Computed: available speech provider options
const speechProviderOptions = computed(() => {
  return providersStore.configuredSpeechProvidersMetadata.map(provider => ({
    value: provider.id,
    label: provider.localizedName || provider.name,
  }))
})

// Computed: available speech models options
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

// Computed: available speech voices options
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

const displayModelOptions = computed(() => {
  return displayModelsStore.displayModels.map((model) => {
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
      value: model.id,
      label: `${prefix} ${model.name}`,
    }
  })
})

const sceneOptions = computed(() => {
  const backgrounds = backgroundStore.getCharacterBackgrounds(props.cardId)
  return [
    { value: 'none', label: t('settings.pages.card.creation.none') },
    ...backgrounds.map(bg => ({
      value: bg.id,
      label: bg.type === 'journal' ? `Journal: ${bg.title}` : bg.title,
    })),
  ]
})

const activeCardModel = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value || cardStore.activeCard?.extensions?.airi?.modules?.displayModelId
  return modelId ? displayModelsStore.displayModels.find(m => m.id === modelId) : null
})

const actingModelEmotionOptions = computed(() => {
  const activeModel = activeCardModel.value
  if (activeModel?.expressions && activeModel.expressions.length > 0) {
    const mappings = activeModel.emotionMappings || {}
    const hidden = activeModel.hiddenExpressions || []
    const mapped: string[] = []

    for (const key of activeModel.expressions) {
      if (hidden.includes(key))
        continue
      const customName = mappings[key]
      if (customName && customName.trim()) {
        mapped.push(customName.trim())
      }
      else {
        mapped.push(key)
      }
    }
    return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
  }

  if (isLive2d.value) {
    const mappings = activeModel?.emotionMappings || {}
    const hidden = activeModel?.hiddenExpressions || []
    const mapped = live2dExpressions.value
      .filter(e => !hidden.includes(e.fileName) && !hidden.includes(e.name))
      .map(e => mappings[e.fileName] || mappings[e.name] || e.name)
    return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
  }

  if (isMmd.value) {
    const mappings = activeModel?.emotionMappings || mmdStore.morphMappings || {}
    const hidden = activeModel?.hiddenExpressions || mmdStore.hiddenMorphs || []

    const mapped: string[] = []
    for (const m of mmdMorphs.value) {
      if (hidden.includes(m))
        continue
      const mappedName = mappings[m]
      mapped.push(mappedName || m)
    }
    return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
  }

  const mappings = activeModel?.emotionMappings || {}
  const hidden = activeModel?.hiddenExpressions || []
  const mapped = availableExpressions.value
    .filter(e => !hidden.includes(e))
    .map(e => mappings[e] || e)
  return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
})

const actingIdleAnimationOptions = computed(() => {
  const activeModel = activeCardModel.value
  const motionMappings = activeModel?.motionMappings || {}
  const hiddenMotions = activeModel?.hiddenMotions || []

  const normalize = (s: string) =>
    s.split(/[\\/]/).pop()?.replace(/_File_\d+/gi, '').replace(/\.(motion3\.)?json$/i, '').replace(/^(motions?|expressions?)[_-]/i, '').toLowerCase() || s.toLowerCase()

  function resolveMotionLabel(rawKey: string): { label: string, value: string } {
    const cleanName = rawKey.split('/').pop()?.replace('.motion3.json', '').replace('.json', '') || rawKey
    const rawNorm = normalize(rawKey)
    let mappedName = motionMappings[rawKey]
    if (!mappedName) {
      for (const [mapKey, val] of Object.entries(motionMappings)) {
        if (normalize(mapKey) === rawNorm) {
          mappedName = val as string
          break
        }
      }
    }
    const finalLabel = mappedName || cleanName
    return { label: finalLabel, value: finalLabel }
  }

  if (activeModel?.motions && activeModel.motions.length > 0) {
    const options: { label: string, value: string }[] = []
    for (const key of activeModel.motions) {
      if (hiddenMotions.includes(key))
        continue
      options.push(resolveMotionLabel(key))
    }
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }

  if (isLive2d.value) {
    const options: { label: string, value: string }[] = []
    live2dStore.availableMotions.forEach((m) => {
      if (hiddenMotions.includes(m.fileName))
        return
      options.push(resolveMotionLabel(m.fileName))
    })
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }

  if (isSpine.value) {
    return spineAnimations.value
      .filter(a => !hiddenMotions.includes(a.name))
      .map(a => resolveMotionLabel(a.name))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  if (isMmd.value) {
    const builtIn = mmdMotions.value
      .filter(m => !hiddenMotions.includes(m))
      .map(m => resolveMotionLabel(m))
    const custom = mmdCustomMotions.value
      .filter(m => !hiddenMotions.includes(m.name) && (!m.id || !hiddenMotions.includes(m.id)))
      .map(m => resolveMotionLabel(m.name))
    return [...builtIn, ...custom].sort((a, b) => a.label.localeCompare(b.label))
  }

  return animationOptions.value
})

const actingModelMotionOptions = computed(() => {
  return actingIdleAnimationOptions.value.map(opt => opt.value)
})

function isVrmaExpression(name: string) {
  return name in animations
}

const actingExpressionTags = computed(() => actingSpeechCapabilities.value?.expressionTags || [])

const actingGroupedExpressionTags = computed(() => {
  const groups = new Map<string, { tag: string, description?: string }[]>()
  for (const tag of actingExpressionTags.value) {
    const key = tag.category || 'other'
    if (!groups.has(key))
      groups.set(key, [])
    groups.get(key)!.push({ tag: tag.tag, description: tag.description })
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, tags]) => ({
      category,
      tags: tags.sort((a, b) => a.tag.localeCompare(b.tag)),
    }))
})

const actingMannerismOptions = computed(() => actingSpeechCapabilities.value?.mannerisms || [])

async function loadActingSpeechCapabilities(providerId: string) {
  actingSpeechCapabilitiesLoading.value = true
  try {
    const metadata = providersStore.getProviderMetadata(providerId)
    const capabilities = await metadata.capabilities.getSpeechCapabilities?.(providersStore.getProviderConfig(providerId))
    actingSpeechCapabilities.value = capabilities ?? null
  }
  catch {
    actingSpeechCapabilities.value = null
  }
  finally {
    actingSpeechCapabilitiesLoading.value = false
  }
}

function appendUniqueLine(target: typeof selectedActingModelExpressionPrompt, line: string) {
  if (target.value.includes(line))
    return

  const suffix = target.value.endsWith('\n') || !target.value ? '' : '\n'
  target.value = `${target.value}${suffix}${line}\n`
}

function insertModelEmotion(name: string) {
  appendUniqueLine(selectedActingModelExpressionPrompt, `- <|ACT:emotion="${name}"|>`)
}

function insertModelMotion(name: string) {
  appendUniqueLine(selectedActingModelExpressionPrompt, `- <|ACT:motion="${name}"|>`)
}

function insertSpeechTag(tag: string, description?: string) {
  const line = description
    ? `- \`[${tag}]\` - ${description}`
    : `- \`[${tag}]\``
  appendUniqueLine(selectedActingSpeechExpressionPrompt, line)
}

function insertSpeechMannerism(id: string) {
  const snippet = MANNERISM_HELPER_SNIPPETS[id]
  if (!snippet || selectedActingSpeechMannerismPrompt.value.includes(snippet.trim()))
    return

  const suffix = selectedActingSpeechMannerismPrompt.value.endsWith('\n') || !selectedActingSpeechMannerismPrompt.value ? '' : '\n\n'
  selectedActingSpeechMannerismPrompt.value = `${selectedActingSpeechMannerismPrompt.value}${suffix}${snippet}`
}

onMounted(() => {
  displayModelsStore.loadDisplayModelsFromIndexedDB()
})

// Load models for current providers on init
watch(() => [consciousnessProvider.value, speechProvider.value], async ([consProvider, spProvider]) => {
  if (consProvider) {
    await consciousnessStore.loadModelsForProvider(consProvider)
  }
  if (spProvider) {
    await speechStore.loadVoicesForProvider(spProvider)
    const metadata = providersStore.getProviderMetadata(spProvider)
    if (metadata?.capabilities.listModels) {
      await providersStore.fetchModelsForProvider(spProvider)
    }
  }
}, { immediate: true })

// Watch consciousness provider changes and reload models
watch(selectedConsciousnessProvider, async (newProvider, oldProvider) => {
  if (oldProvider !== undefined && newProvider !== oldProvider && newProvider) {
    await consciousnessStore.loadModelsForProvider(newProvider)
    // Reset model selection to default or empty
    selectedConsciousnessModel.value = ''
  }
})

watch(generationProvider, async (newProvider, oldProvider) => {
  if (oldProvider !== undefined && newProvider !== oldProvider && newProvider) {
    await consciousnessStore.loadModelsForProvider(newProvider)
    generationModel.value = ''
  }
})

watch(selectedFirstHopProvider, async (newProvider, oldProvider) => {
  if (oldProvider !== undefined && newProvider !== oldProvider && newProvider) {
    await consciousnessStore.loadModelsForProvider(newProvider)
    selectedFirstHopModel.value = ''
  }
})

// Watch speech provider changes and reload models/voices
watch(selectedSpeechProvider, async (newProvider, oldProvider) => {
  if (oldProvider !== undefined && newProvider !== oldProvider && newProvider) {
    await speechStore.loadVoicesForProvider(newProvider)
    const metadata = providersStore.getProviderMetadata(newProvider)
    if (metadata?.capabilities.listModels) {
      await providersStore.fetchModelsForProvider(newProvider)
    }
    await loadActingSpeechCapabilities(newProvider)

    const availableModels = providersStore.getModelsForProvider(newProvider)
    if (selectedSpeechModel.value && availableModels.length > 0 && !availableModels.some(m => m.id === selectedSpeechModel.value)) {
      selectedSpeechModel.value = ''
    }
    const availableVoices = speechStore.getVoicesForProvider(newProvider)
    if (selectedSpeechVoiceId.value && availableVoices.length > 0 && !availableVoices.some(v => v.id === selectedSpeechVoiceId.value) && !speechStore.savedVoiceProfiles.some(p => p.id === selectedSpeechVoiceId.value)) {
      selectedSpeechVoiceId.value = ''
    }
  }
})

// Reload voices when speech model changes without clobbering voice ID
watch(selectedSpeechModel, async (newModel, oldModel) => {
  // Only reload if model actually changed and we're not initializing
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (oldModel !== undefined && newModel !== oldModel && provider) {
    // Reload voices for the current provider
    await speechStore.loadVoicesForProvider(provider)
  }
})

// Tab type definition
interface Tab {
  id: string
  label: string
  icon: string
}

// Active tab ID state
const activeTabId = ref('')

// Tabs for card details
const tabs: Tab[] = [
  { id: 'identity', label: 'Identity', icon: 'i-solar:user-circle-bold-duotone' },
  { id: 'generation', label: 'Generation', icon: 'i-solar:tuning-square-bold-duotone' },
  { id: 'acting', label: 'Acting', icon: 'i-solar:mask-happly-bold-duotone' },
  { id: 'modules', label: t('settings.pages.card.modules'), icon: 'i-solar:widget-4-bold-duotone' },
  { id: 'artistry', label: t('settings.pages.modules.artistry.title'), icon: 'i-solar:gallery-bold-duotone' },
  { id: 'proactivity', label: t('settings.pages.card.creation.proactivity', 'Proactivity'), icon: 'i-solar:heart-pulse-bold-duotone' },
  { id: 'tools', label: 'Tools', icon: 'i-solar:widget-bold-duotone' },
  { id: 'cognition', label: 'Cognition', icon: 'i-solar:cpu-bolt-bold-duotone' },
]

// Active tab state - set to first available tab by default
const activeTab = computed({
  get: () => {
    // If current active tab is not in available tabs, reset to first tab
    if (!tabs.find(tab => tab.id === activeTabId.value))
      return tabs[0]?.id || ''
    return activeTabId.value
  },
  set: (value: string) => {
    activeTabId.value = value
  },
})

// Check for errors, and save built Cards :

const showError = ref<boolean>(false)
const errorMessage = ref<string>('')

async function saveCard(card: Card): Promise<boolean> {
  // Before saving, let's validate what the user entered :
  const rawCard: Card = toRaw(card)
  const existingAiriExt = (isEditMode.value && props.cardId)
    ? cardStore.getCard(props.cardId)?.extensions?.airi as AiriExtension | undefined
    : undefined

  if (!((rawCard.name?.length ?? 0) > 0)) {
    // No name
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.name')
    return false
  }
  else if (!/^(?:\d+\.)+\d+$/.test(rawCard.version)) {
    // Invalid version
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.version')
    return false
  }
  else if (!((rawCard.description?.length ?? 0) > 0)) {
    // No description
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.description')
    return false
  }
  else if (!((rawCard.personality?.length ?? 0) > 0)) {
    // No personality
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.personality')
    return false
  }
  else if (!((rawCard.scenario?.length ?? 0) > 0)) {
    // No Scenario
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.scenario')
    return false
  }
  else if (!((rawCard.systemPrompt?.length ?? 0) > 0)) {
    // No sys prompt
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.systemprompt')
    return false
  }
  else if (!((rawCard.postHistoryInstructions?.length ?? 0) > 0)) {
    // No post history prompt
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.posthistoryinstructions')
    return false
  }
  showError.value = false

  const generationKnown = {
    maxTokens: normalizeOptionalNumber(generationMaxTokens.value),
    temperature: normalizeOptionalNumber(generationTemperature.value),
    topP: normalizeOptionalNumber(generationTopP.value),
    contextWidth: normalizeOptionalNumber(generationContextWidth.value),
    reasoningFallback: generationReasoningFallback.value,
    allowedTools: toRaw(generationAllowedTools.value),
  }
  let generationAdvanced: Record<string, any> | undefined

  try {
    generationAdvanced = generationAdvancedJson.value.trim()
      ? JSON.parse(generationAdvancedJson.value)
      : undefined
  }
  catch {
    showError.value = true
    errorMessage.value = 'Generation Advanced JSON must be valid JSON before saving.'
    return false
  }

  let artistryConfig: Record<string, any> | undefined
  try {
    artistryConfig = selectedArtistryConfigStr.value.trim()
      ? JSON.parse(selectedArtistryConfigStr.value)
      : undefined
  }
  catch {
    showError.value = true
    errorMessage.value = 'Artistry Config must be valid JSON before saving.'
    return false
  }

  // Build card with modules extension
  const cardWithModules = {
    ...rawCard,
    extensions: {
      ...rawCard.extensions,
      airi: {
        ...existingAiriExt,
        modules: {
          ...existingAiriExt?.modules,
          consciousness: {
            provider: selectedConsciousnessProvider.value || consciousnessProvider.value,
            model: selectedConsciousnessModel.value || defaultConsciousnessModel.value,
          },
          cognition: {
            enabled: cognitivePipelineEnabled.value,
            processor: firstHopProcessor.value,
            provider: selectedFirstHopProvider.value || consciousnessProvider.value,
            model: selectedFirstHopModel.value,
          },
          speech: {
            provider: selectedSpeechProvider.value || speechProvider.value,
            model: selectedSpeechModel.value || defaultSpeechModel.value,
            voice_id: selectedSpeechVoiceId.value || defaultSpeechVoiceId.value,
          },
          displayModelId: selectedDisplayModelId.value || defaultDisplayModelId.value,
          activeBackgroundId: selectedActiveBackgroundId.value || 'none',
        },
        agents: existingAiriExt?.agents || {},
        heartbeats: {
          ...existingAiriExt?.heartbeats,
          enabled: heartbeatsEnabled.value,
          intervalMinutes: heartbeatsIntervalMinutes.value,
          prompt: heartbeatsPrompt.value,
          injectIntoPrompt: heartbeatsInjectIntoPrompt.value,
          useAsLocalGate: heartbeatsUseAsLocalGate.value,
          contextOptions: {
            ...existingAiriExt?.heartbeats?.contextOptions,
            windowHistory: heartbeatsContextWindowHistory.value,
            systemLoad: heartbeatsContextSystemLoad.value,
            usageMetrics: heartbeatsContextUsageMetrics.value,
          },
          schedule: {
            ...existingAiriExt?.heartbeats?.schedule,
            start: heartbeatsScheduleStart.value,
            end: heartbeatsScheduleEnd.value,
          },
          respectSchedule: heartbeatsRespectSchedule.value,
        },
        dreamState: {
          ...existingAiriExt?.dreamState,
          enabled: dreamStateEnabled.value,
          strictAfkGating: dreamStateStrictAfkGating.value,
          journalingThreshold: dreamStateRichness.value,
          maxSessionsPerDay: dreamStateMaxSessionsPerDay.value,
          sessionTimeoutMinutes: dreamStateSessionTimeoutMinutes.value,
          afkThresholdMinutes: dreamStateAfkThresholdMinutes.value,
          minConversationTurns: dreamStateMinConversationTurns.value || 4,
          lastProcessedAt: existingAiriExt?.dreamState?.lastProcessedAt,
          dailyRunDate: existingAiriExt?.dreamState?.dailyRunDate,
          dailyRunCount: existingAiriExt?.dreamState?.dailyRunCount ?? 0,
          injectDreamContext: dreamStateInjectDreamContext.value,
          dreamIntrusionPrompt: selectedDreamIntrusionPrompt.value,
        },
        shortTermMemory: {
          ...existingAiriExt?.shortTermMemory,
          windowSize: shortTermMemoryWindowSize.value,
          tokenBudgetPerDay: shortTermMemoryTokenBudget.value,
        },
        screenWatching: {
          ...existingAiriExt?.screenWatching,
          enabled: screenWatchingEnabled.value,
          deliveryMode: screenWatchingDeliveryMode.value,
          sourceType: screenWatchingSourceType.value,
          sourceId: screenWatchingSourceId.value,
          captureIntervalMs: screenWatchingCaptureIntervalMs.value,
          downscalePercent: screenWatchingDownscalePercent.value,
          workload: screenWatchingWorkload.value,
          publishToContext: screenWatchingPublishToContext.value,
          interestTags: screenWatchingInterestTags.value,
          deferWhileSpeaking: screenWatchingDeferWhileSpeaking.value,
          maxPerHour: screenWatchingMaxPerHour.value,
          hysteresisMinutes: screenWatchingHysteresisMinutes.value,
        },
        eventLedger: {
          ...existingAiriExt?.eventLedger,
          enabled: eventLedgerEnabled.value,
          sampleDepth: eventLedgerSampleDepth.value,
          domains: eventLedgerDomains.value,
        },
        acting: {
          ...existingAiriExt?.acting,
          modelExpressionPrompt: selectedActingModelExpressionPrompt.value,
          speechExpressionPrompt: selectedActingSpeechExpressionPrompt.value,
          speechMannerismPrompt: selectedActingSpeechMannerismPrompt.value,
          // Only write to the global fallback if no actor-specific override is active.
          // If an actor override is active, we write the idle animations to that actor's visual_assets block instead.
          idleAnimations: activeActorIdleOverride.value
            ? [...(existingAiriExt?.acting?.idleAnimations || [])]
            : [...(selectedActingIdleAnimations.value || [])],
        },
        generation: {
          ...existingAiriExt?.generation,
          enabled: generationEnabled.value,
          provider: generationProvider.value || selectedConsciousnessProvider.value || consciousnessProvider.value,
          model: generationModel.value || selectedConsciousnessModel.value || defaultConsciousnessModel.value,
          known: {
            ...existingAiriExt?.generation?.known,
            ...generationKnown,
          },
          advanced: generationAdvanced,
          compaction: {
            strategy: compactionStrategy.value,
            minKeepTurns: compactionMinKeepTurns.value ?? 15,
          },
        },
        groundingEnabled: groundingEnabled.value,
        visual_assets: existingAiriExt?.visual_assets || {},
        active_concepts: existingAiriExt?.active_concepts || [],
        eternal_record: existingAiriExt?.eternal_record || { relational_milestones: [], lore_bits: [] },
      } as AiriExtension,
    },
  }

  // Inject artistry manually to avoid TS errors
  cardWithModules.extensions.airi.artistry = {
    provider: selectedArtistryProvider.value || defaultArtistryProvider.value,
    model: selectedArtistryModel.value,
    promptPrefix: selectedArtistryPromptPrefix.value,
    widgetInstruction: selectedArtistryWidgetInstruction.value,
    spawnMode: selectedArtistrySpawnMode.value,
    autonomousEnabled: selectedArtistryAutonomousEnabled.value,
    autonomousThreshold: selectedArtistryAutonomousThreshold.value,
    autonomousTarget: selectedArtistryAutonomousTarget.value,
    autonomousMonitorEnabled: selectedArtistryAutonomousMonitorEnabled.value,
    autonomousMonitorDiscordEnabled: selectedArtistryAutonomousMonitorDiscordEnabled.value,
    autonomousHistoryDepth: selectedArtistryAutonomousHistoryDepth.value,
    autonomousModelMode: selectedArtistryAutonomousModelMode.value,
    autonomousProvider: selectedArtistryAutonomousProvider.value,
    autonomousModel: selectedArtistryAutonomousModel.value,
    options: artistryConfig,
    injectArtistryContext: selectedInjectArtistryContext.value,
    artistryIntrusionPrompt: selectedArtistryIntrusionPrompt.value,
  }

  cardWithModules.extensions.airi.textJournal = {
    widgetInstruction: selectedTextJournalInstruction.value,
    injectJournalContext: selectedInjectJournalContext.value,
    journalIntrusionPrompt: selectedJournalIntrusionPrompt.value,
  }

  console.log('[CardCreationDialog] 📊 DUMPING SAVED CHARACTER PROFILE GRAPH:', {
    isEditMode: isEditMode.value,
    cardId: props.cardId,
    name: cardWithModules.name,
    speechFormState: {
      selectedSpeechProvider: selectedSpeechProvider.value,
      selectedSpeechModel: selectedSpeechModel.value,
      selectedSpeechVoiceId: selectedSpeechVoiceId.value,
      defaultSpeechVoiceId: defaultSpeechVoiceId.value,
    },
    modules: cardWithModules.extensions.airi.modules,
    extensionsAiri: cardWithModules.extensions.airi,
    fullCardPayload: JSON.parse(JSON.stringify(cardWithModules)),
  })

  if (isEditMode.value && props.cardId) {
    // Edit mode: update existing card
    cardStore.updateCard(props.cardId, cardWithModules)
  }
  else {
    // Create mode: add new card
    await cardStore.addCard(cardWithModules)
  }

  modelValue.value = false // Close this
  return true
}

// Cards data holders :

// Initialize card data - load from existing card if in edit mode
function initializeCard(): Card {
  // Extract existing card data if in edit mode
  const existingCard = (isEditMode.value && props.cardId) ? cardStore.getCard(props.cardId) : undefined
  const airiExt = existingCard?.extensions?.airi as AiriExtension | undefined

  // Initialize module selections with fallback logic (handles all cases: create, edit with/without extension)
  selectedConsciousnessProvider.value = airiExt?.modules?.consciousness?.provider || consciousnessProvider.value
  selectedConsciousnessModel.value = airiExt?.modules?.consciousness?.model || defaultConsciousnessModel.value
  selectedSpeechProvider.value = airiExt?.modules?.speech?.provider || speechProvider.value
  selectedSpeechModel.value = airiExt?.modules?.speech?.model || defaultSpeechModel.value
  selectedSpeechVoiceId.value = airiExt?.modules?.speech?.voice_id || defaultSpeechVoiceId.value
  selectedDisplayModelId.value = airiExt?.modules?.displayModelId || defaultDisplayModelId.value
  const activeBg = airiExt?.modules?.activeBackgroundId || (airiExt?.modules as any)?.preferredBackgroundId
  selectedActiveBackgroundId.value = !activeBg ? 'none' : activeBg
  cognitivePipelineEnabled.value = (airiExt?.modules as any)?.cognition?.enabled ?? false
  firstHopProcessor.value = (airiExt?.modules as any)?.cognition?.processor ?? 'none'
  selectedFirstHopProvider.value = (airiExt?.modules as any)?.cognition?.provider || consciousnessProvider.value
  selectedFirstHopModel.value = (airiExt?.modules as any)?.cognition?.model || ''
  selectedArtistryProvider.value = airiExt?.artistry?.provider || defaultArtistryProvider.value
  selectedArtistryModel.value = airiExt?.artistry?.model || ''
  selectedArtistryPromptPrefix.value = airiExt?.artistry?.promptPrefix || ''
  selectedArtistryWidgetInstruction.value = airiExt?.artistry?.widgetInstruction ?? DEFAULT_ARTISTRY_WIDGET_INSTRUCTION
  selectedArtistryAutonomousEnabled.value = airiExt?.artistry?.autonomousEnabled ?? false
  selectedArtistryAutonomousThreshold.value = airiExt?.artistry?.autonomousThreshold ?? 49
  selectedArtistryAutonomousMonitorEnabled.value = airiExt?.artistry?.autonomousMonitorEnabled ?? true
  selectedArtistryAutonomousMonitorDiscordEnabled.value = airiExt?.artistry?.autonomousMonitorDiscordEnabled ?? false
  selectedArtistryAutonomousHistoryDepth.value = airiExt?.artistry?.autonomousHistoryDepth ?? 3
  selectedArtistryAutonomousModelMode.value = airiExt?.artistry?.autonomousModelMode ?? 'inherit'
  selectedArtistryAutonomousProvider.value = airiExt?.artistry?.autonomousProvider || ''
  selectedArtistryAutonomousModel.value = airiExt?.artistry?.autonomousModel || ''
  selectedArtistryAutonomousTarget.value = airiExt?.artistry?.autonomousTarget ?? 'assistant'
  selectedArtistrySpawnMode.value = airiExt?.artistry?.spawnMode ?? 'bg'
  generationEnabled.value = airiExt?.generation?.enabled ?? false
  generationProvider.value = airiExt?.generation?.provider || airiExt?.modules?.consciousness?.provider || consciousnessProvider.value
  generationModel.value = airiExt?.generation?.model || airiExt?.modules?.consciousness?.model || defaultConsciousnessModel.value
  generationMaxTokens.value = normalizeOptionalNumber(airiExt?.generation?.known?.maxTokens)
  generationTemperature.value = normalizeOptionalNumber(airiExt?.generation?.known?.temperature)
  generationTopP.value = normalizeOptionalNumber(airiExt?.generation?.known?.topP)
  generationContextWidth.value = normalizeOptionalNumber(airiExt?.generation?.known?.contextWidth)
  generationReasoningFallback.value = airiExt?.generation?.known?.reasoningFallback ?? true
  generationAllowedTools.value = airiExt?.generation?.known?.allowedTools
  generationAdvancedJson.value = airiExt?.generation?.advanced ? JSON.stringify(airiExt.generation.advanced, null, 2) : '{\n  \n}'
  selectedActingModelExpressionPrompt.value = airiExt?.acting?.modelExpressionPrompt ?? DEFAULT_ACTING_MODEL_PROMPT
  selectedActingSpeechExpressionPrompt.value = airiExt?.acting?.speechExpressionPrompt ?? DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT
  selectedActingSpeechMannerismPrompt.value = airiExt?.acting?.speechMannerismPrompt ?? DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT
  // Context-aware idle animation initialization:
  // Check if the current stage model matches an actor with custom idleAnimations override.
  const visualAssets = airiExt?.visual_assets || {}
  const currentModelId = defaultDisplayModelId.value
  let resolvedIdleAnims = airiExt?.acting?.idleAnimations || []
  if (currentModelId) {
    for (const asset of Object.values(visualAssets)) {
      const a = asset as any
      if (a?.manifestation?.modelId === currentModelId && a.idleAnimations) {
        resolvedIdleAnims = a.idleAnimations
        break
      }
    }
  }
  selectedActingIdleAnimations.value = [...resolvedIdleAnims]
  compactionStrategy.value = airiExt?.generation?.compaction?.strategy || 'none'
  compactionMinKeepTurns.value = airiExt?.generation?.compaction?.minKeepTurns ?? 15
  try {
    selectedArtistryConfigStr.value = airiExt?.artistry?.options ? JSON.stringify(airiExt.artistry.options, null, 2) : '{\n  \n}'
  }
  catch {
    selectedArtistryConfigStr.value = '{\n  \n}'
  }

  heartbeatsEnabled.value = airiExt?.heartbeats?.enabled ?? false
  heartbeatsIntervalMinutes.value = airiExt?.heartbeats?.intervalMinutes ?? 5
  heartbeatsPrompt.value = airiExt?.heartbeats?.prompt ?? DEFAULT_HEARTBEATS_PROMPT
  heartbeatsInjectIntoPrompt.value = airiExt?.heartbeats?.injectIntoPrompt ?? true
  heartbeatsUseAsLocalGate.value = airiExt?.heartbeats?.useAsLocalGate ?? true
  heartbeatsScheduleStart.value = airiExt?.heartbeats?.schedule?.start ?? '09:00'
  heartbeatsScheduleEnd.value = airiExt?.heartbeats?.schedule?.end ?? '22:00'
  heartbeatsContextWindowHistory.value = airiExt?.heartbeats?.contextOptions?.windowHistory ?? true
  heartbeatsContextSystemLoad.value = airiExt?.heartbeats?.contextOptions?.systemLoad ?? true
  heartbeatsContextUsageMetrics.value = airiExt?.heartbeats?.contextOptions?.usageMetrics ?? true
  heartbeatsRespectSchedule.value = airiExt?.heartbeats?.respectSchedule ?? true
  // Dream State
  dreamStateEnabled.value = airiExt?.dreamState?.enabled ?? false
  dreamStateStrictAfkGating.value = airiExt?.dreamState?.strictAfkGating ?? true
  dreamStateRichness.value = airiExt?.dreamState?.journalingThreshold ?? 'balanced'
  dreamStateAfkThresholdMinutes.value = airiExt?.dreamState?.afkThresholdMinutes ?? 5
  dreamStateSessionTimeoutMinutes.value = airiExt?.dreamState?.sessionTimeoutMinutes ?? 60
  dreamStateMaxSessionsPerDay.value = airiExt?.dreamState?.maxSessionsPerDay ?? 4
  dreamStateMinConversationTurns.value = airiExt?.dreamState?.minConversationTurns ?? 4
  dreamStateInjectDreamContext.value = airiExt?.dreamState?.injectDreamContext ?? false

  // Screen Watching (Attention Ecology)
  screenWatchingEnabled.value = airiExt?.screenWatching?.enabled ?? false
  screenWatchingDeliveryMode.value = airiExt?.screenWatching?.deliveryMode ?? 'both'
  screenWatchingSourceType.value = airiExt?.screenWatching?.sourceType ?? 'displays'
  screenWatchingSourceId.value = airiExt?.screenWatching?.sourceId ?? ''
  screenWatchingCaptureIntervalMs.value = airiExt?.screenWatching?.captureIntervalMs ?? 2000
  screenWatchingDownscalePercent.value = airiExt?.screenWatching?.downscalePercent ?? 100
  screenWatchingWorkload.value = airiExt?.screenWatching?.workload ?? 'attention-guard'
  screenWatchingPublishToContext.value = airiExt?.screenWatching?.publishToContext ?? false
  screenWatchingInterestTags.value = airiExt?.screenWatching?.interestTags ?? ['antigravity', 'terminal_error', 'youtube', 'discord']
  screenWatchingDeferWhileSpeaking.value = airiExt?.screenWatching?.deferWhileSpeaking ?? true
  screenWatchingMaxPerHour.value = airiExt?.screenWatching?.maxPerHour ?? 4
  screenWatchingHysteresisMinutes.value = airiExt?.screenWatching?.hysteresisMinutes ?? 3

  // Sensors & Event Ledger
  eventLedgerEnabled.value = airiExt?.eventLedger?.enabled ?? true
  eventLedgerSampleDepth.value = airiExt?.eventLedger?.sampleDepth ?? 6
  eventLedgerDomains.value = airiExt?.eventLedger?.domains ?? ['vision', 'tools', 'chat', 'memory', 'discord']

  // Short-Term Memory (24h Daily Summaries)
  shortTermMemoryEnabled.value = airiExt?.shortTermMemory ? true : true
  shortTermMemoryWindowSize.value = airiExt?.shortTermMemory?.windowSize ?? 3
  shortTermMemoryTokenBudget.value = airiExt?.shortTermMemory?.tokenBudgetPerDay ?? 1000

  groundingEnabled.value = airiExt?.groundingEnabled ?? false

  // Load Tools Tab configuration
  selectedInjectDreamContext.value = airiExt?.dreamState?.injectDreamContext ?? false
  selectedDreamIntrusionPrompt.value = airiExt?.dreamState?.dreamIntrusionPrompt ?? DEFAULT_DREAM_INTRUSION_PROMPT
  selectedInjectJournalContext.value = airiExt?.textJournal?.injectJournalContext ?? false
  selectedJournalIntrusionPrompt.value = airiExt?.textJournal?.journalIntrusionPrompt ?? DEFAULT_JOURNAL_INTRUSION_PROMPT
  selectedInjectArtistryContext.value = airiExt?.artistry?.injectArtistryContext ?? false
  selectedArtistryIntrusionPrompt.value = airiExt?.artistry?.artistryIntrusionPrompt ?? DEFAULT_ARTISTRY_INTRUSION_PROMPT
  selectedTextJournalInstruction.value = airiExt?.textJournal?.widgetInstruction ?? DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION

  loadActingSpeechCapabilities(selectedSpeechProvider.value || speechProvider.value)

  // Return existing card data or defaults
  if (existingCard) {
    return { ...toRaw(existingCard) }
  }

  return {
    name: t('settings.pages.card.creation.defaults.name'),
    nickname: undefined,
    version: '1.0',
    description: '',
    notes: undefined,
    personality: t('settings.pages.card.creation.defaults.personality'),
    scenario: t('settings.pages.card.creation.defaults.scenario'),
    systemPrompt: t('settings.pages.card.creation.defaults.systemprompt'),
    postHistoryInstructions: (t('settings.pages.card.creation.defaults.posthistoryinstructions') !== 'settings.pages.card.creation.defaults.posthistoryinstructions' && t('settings.pages.card.creation.defaults.posthistoryinstructions')) || DEFAULT_POST_HISTORY_INSTRUCTIONS,
    greetings: [],
    messageExample: [],
  }
}

const card = ref<Card>(initializeCard())

// Reinitialize when cardId changes or dialog opens
watch(() => [props.modelValue, props.cardId], () => {
  if (props.modelValue) {
    card.value = initializeCard()
  }
})

function makeComputed<T extends keyof Card>(
  /*
  Function used to generate Computed values, with an optional sanitize function
  */
  key: T,
  transform?: (input: string) => string,
) {
  return computed({
    get: () => {
      return card.value[key] ?? ''
    },
    set: (val: string) => { // Set,
      const input = val.trim() // We first trim the value
      card.value[key] = (input.length > 0
        ? (transform ? transform(input) : input) // then potentially transform it
        : '') as Card[T]// or default to empty string value if nothing was given
    },
  })
}

const cardName = makeComputed('name', input => kebabcase(input))
const cardNickname = makeComputed('nickname')
const cardDescription = makeComputed('description')
const cardNotes = makeComputed('notes')

const cardPersonality = makeComputed('personality')
const cardScenario = makeComputed('scenario')
const cardGreetings = computed({
  get: () => card.value.greetings ?? [],
  set: (val: string[]) => {
    card.value.greetings = val || []
  },
})

const cardVersion = makeComputed('version')
const cardSystemPrompt = makeComputed('systemPrompt')
const cardPostHistoryInstructions = makeComputed('postHistoryInstructions')

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed)
      return undefined

    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

// Helper function to generate placeholder text for default values
function getDefaultPlaceholder(defaultValue: string | undefined): string {
  return defaultValue
    ? `${t('settings.pages.card.creation.use_default')} (${defaultValue})`
    : t('settings.pages.card.creation.use_default_not_configured')
}

// Sparkle AI Generator Modal State and Methods
const showGeneratorModal = ref(false)
const generatorFieldId = ref('')
const generatorFieldLabel = ref('')
const generatorFieldValue = ref('')

// Image Tag Extractor Modal State
const showTagExtractorModal = ref(false)
const extractorModelId = computed(() => selectedDisplayModelId.value || defaultDisplayModelId.value)

function handleTagExtractorApply(tags: string) {
  if (selectedArtistryPromptPrefix.value) {
    const trimmed = selectedArtistryPromptPrefix.value.trim()
    if (trimmed && !trimmed.endsWith(',')) {
      selectedArtistryPromptPrefix.value = `${trimmed}, ${tags}`
    }
    else {
      selectedArtistryPromptPrefix.value = `${trimmed} ${tags}`
    }
  }
  else {
    selectedArtistryPromptPrefix.value = tags
  }
}

function openTagExtractor() {
  showTagExtractorModal.value = true
}

const visualAssets = computed(() => {
  if (!isEditMode.value || !props.cardId)
    return {}
  const card = cardStore.getCard(props.cardId)
  return card?.extensions?.airi?.visual_assets || {}
})

const generatorCardContext = computed(() => ({
  name: cardName.value,
  nickname: cardNickname.value,
  description: cardDescription.value,
  personality: cardPersonality.value,
  scenario: cardScenario.value,
  systemPrompt: cardSystemPrompt.value,
  proactivitySensorPayload: sensorPayload.value || staticSamplePayload,
  visualAssets: visualAssets.value,
}))

const generatorActingContext = computed(() => {
  const flatSpeechTags = actingGroupedExpressionTags.value
    ? actingGroupedExpressionTags.value.flatMap(group => group.tags.map(t => t.tag))
    : []

  return {
    isLive2d: isLive2d.value,
    modelExpressions: [...(actingModelEmotionOptions.value || []), ...(actingModelMotionOptions.value || [])],
    speechTags: flatSpeechTags,
    speechProvider: selectedSpeechProvider.value || speechProvider.value || 'none',
  }
})

function openSparkleGenerator(fieldId: string) {
  generatorFieldId.value = fieldId
  if (fieldId === 'description') {
    generatorFieldLabel.value = t('settings.pages.card.creation.description')
    generatorFieldValue.value = cardDescription.value
  }
  else if (fieldId === 'systemPrompt') {
    generatorFieldLabel.value = t('settings.pages.card.systemprompt')
    generatorFieldValue.value = cardSystemPrompt.value
  }
  else if (fieldId === 'postHistoryInstructions') {
    generatorFieldLabel.value = t('settings.pages.card.posthistoryinstructions')
    generatorFieldValue.value = cardPostHistoryInstructions.value
  }
  else if (fieldId === 'personality') {
    generatorFieldLabel.value = t('settings.pages.card.personality')
    generatorFieldValue.value = cardPersonality.value
  }
  else if (fieldId === 'scenario') {
    generatorFieldLabel.value = t('settings.pages.card.scenario')
    generatorFieldValue.value = cardScenario.value
  }
  else if (fieldId === 'greetings') {
    generatorFieldLabel.value = t('settings.pages.card.creation.greetings')
    generatorFieldValue.value = cardGreetings.value.join('\n')
  }
  else if (fieldId === 'actingModelExpression') {
    generatorFieldLabel.value = 'ACT / Model Expressions'
    generatorFieldValue.value = selectedActingModelExpressionPrompt.value
  }
  else if (fieldId === 'actingSpeechExpression') {
    generatorFieldLabel.value = 'Speech Tags / Audio Expressions'
    generatorFieldValue.value = selectedActingSpeechExpressionPrompt.value
  }
  else if (fieldId === 'artistryPromptPrefix') {
    generatorFieldLabel.value = 'Artistry Prompt Default Prefix'
    generatorFieldValue.value = selectedArtistryPromptPrefix.value
  }
  else if (fieldId === 'heartbeatsPrompt') {
    generatorFieldLabel.value = 'Stealth Heartbeat Prompt'
    generatorFieldValue.value = heartbeatsPrompt.value
  }
  showGeneratorModal.value = true
}

function handleGeneratorSave(newValue: string) {
  if (generatorFieldId.value === 'description') {
    cardDescription.value = newValue
  }
  else if (generatorFieldId.value === 'systemPrompt') {
    cardSystemPrompt.value = newValue
  }
  else if (generatorFieldId.value === 'postHistoryInstructions') {
    cardPostHistoryInstructions.value = newValue
  }
  else if (generatorFieldId.value === 'personality') {
    cardPersonality.value = newValue
  }
  else if (generatorFieldId.value === 'scenario') {
    cardScenario.value = newValue
  }
  else if (generatorFieldId.value === 'greetings') {
    cardGreetings.value = newValue
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
  }
  else if (generatorFieldId.value === 'actingModelExpression') {
    selectedActingModelExpressionPrompt.value = newValue
  }
  else if (generatorFieldId.value === 'actingSpeechExpression') {
    selectedActingSpeechExpressionPrompt.value = newValue
  }
  else if (generatorFieldId.value === 'artistryPromptPrefix') {
    selectedArtistryPromptPrefix.value = newValue
  }
  else if (generatorFieldId.value === 'heartbeatsPrompt') {
    heartbeatsPrompt.value = newValue
  }
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[9999] m-0 max-h-[90vh] max-w-6xl w-[92vw] flex flex-col overflow-auto border border-neutral-200 rounded-xl bg-white p-5 shadow-xl 2xl:w-[60vw] lg:w-[80vw] md:w-[85vw] xl:w-[70vw] -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800 sm:p-6">
        <div class="w-full flex flex-col gap-5">
          <div flex="~ row" items-center justify-between>
            <DialogTitle text-2xl font-normal class="from-primary-500 to-primary-400 bg-gradient-to-r bg-clip-text text-transparent">
              {{ isEditMode ? t("settings.pages.card.edit_card") : t("settings.pages.card.create_card") }}
            </DialogTitle>
            <div v-if="isEditMode && props.cardId" flex="~ row" gap-2>
              <Button
                variant="secondary"
                icon="i-solar:clapperboard-play-bold-duotone"
                label="Studio"
                @click="emit('studio', props.cardId)"
              />
            </div>
          </div>

          <!-- Dialog tabs -->
          <div class="mt-4">
            <div class="border-b border-neutral-200 dark:border-neutral-700">
              <div class="flex flex-wrap justify-center gap-x-1 gap-y-1.5 -mb-px sm:justify-start">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  class="px-4 py-2 text-sm font-medium"
                  :class="[
                    activeTab === tab.id
                      ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 dark:border-primary-400'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300',
                  ]"
                  @click="activeTab = tab.id"
                >
                  <div class="flex items-center gap-1">
                    <div :class="tab.icon" />
                    {{ tab.label }}
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- Error div -->
          <div v-if="showError" class="w-full rounded-xl bg-red900">
            <p class="w-full p-4">
              {{ errorMessage }}
            </p>
          </div>

          <!-- Actual content -->
          <CardCreationTabIdentity
            v-if="activeTab === 'identity'"
            v-model:card-name="cardName"
            v-model:card-nickname="cardNickname"
            v-model:card-description="cardDescription"
            v-model:card-notes="cardNotes"
            v-model:card-system-prompt="cardSystemPrompt"
            v-model:card-version="cardVersion"
            v-model:card-personality="cardPersonality"
            v-model:card-scenario="cardScenario"
            v-model:card-greetings="cardGreetings"
            @sparkle-click="openSparkleGenerator"
          />
          <CardCreationTabGeneration
            v-else-if="activeTab === 'generation'"
            v-model:generation-enabled="generationEnabled"
            v-model:generation-provider="generationProvider"
            v-model:generation-model="generationModel"
            v-model:generation-max-tokens="generationMaxTokens"
            v-model:generation-temperature="generationTemperature"
            v-model:generation-top-p="generationTopP"
            v-model:generation-context-width="generationContextWidth"
            v-model:generation-advanced-json="generationAdvancedJson"
            v-model:generation-reasoning-fallback="generationReasoningFallback"
            v-model:card-post-history-instructions="cardPostHistoryInstructions"
            v-model:compaction-strategy="compactionStrategy"
            v-model:compaction-min-keep-turns="compactionMinKeepTurns"
            :provider-options="generationProviderOptions"
            :model-options="generationModelOptions"
            :provider-placeholder="getDefaultPlaceholder(selectedConsciousnessProvider || consciousnessProvider)"
            :model-placeholder="getDefaultPlaceholder(selectedConsciousnessModel || defaultConsciousnessModel)"
            @sparkle-click="openSparkleGenerator"
          />
          <CardCreationTabActing
            v-else-if="activeTab === 'acting'"
            v-model:selected-acting-model-expression-prompt="selectedActingModelExpressionPrompt"
            v-model:selected-acting-speech-expression-prompt="selectedActingSpeechExpressionPrompt"
            v-model:selected-acting-speech-mannerism-prompt="selectedActingSpeechMannerismPrompt"
            v-model:selected-acting-idle-animations="selectedActingIdleAnimations"
            :acting-idle-animation-options="actingIdleAnimationOptions"
            :acting-model-emotion-options="actingModelEmotionOptions"
            :acting-model-motion-options="actingModelMotionOptions"
            :acting-grouped-expression-tags="actingGroupedExpressionTags"
            :acting-mannerism-options="actingMannerismOptions"
            :acting-speech-capabilities-loading="actingSpeechCapabilitiesLoading"
            :selected-speech-provider-label="selectedSpeechProvider || speechProvider || 'none'"
            :is-live2d="isLive2d"
            :is-vrma-expression="isVrmaExpression"
            :insert-model-emotion="insertModelEmotion"
            :insert-model-motion="insertModelMotion"
            :insert-speech-tag="insertSpeechTag"
            :insert-speech-mannerism="insertSpeechMannerism"
            @sparkle-click="openSparkleGenerator"
          />
          <CardCreationTabModules
            v-else-if="activeTab === 'modules'"
            v-model:selected-consciousness-provider="selectedConsciousnessProvider"
            v-model:selected-consciousness-model="selectedConsciousnessModel"
            v-model:selected-speech-provider="selectedSpeechProvider"
            v-model:selected-speech-model="selectedSpeechModel"
            v-model:selected-speech-voice-id="selectedSpeechVoiceId"
            v-model:selected-display-model-id="selectedDisplayModelId"
            v-model:selected-active-background-id="selectedActiveBackgroundId"
            :consciousness-provider-options="consciousnessProviderOptions"
            :consciousness-model-options="consciousnessModelOptions"
            :speech-provider-options="speechProviderOptions"
            :speech-model-options="speechModelOptions"
            :speech-voice-options="speechVoiceOptions"
            :display-model-options="displayModelOptions"
            :scene-options="sceneOptions"
            :consciousness-provider-placeholder="getDefaultPlaceholder(consciousnessProvider)"
            :default-consciousness-model-placeholder="getDefaultPlaceholder(defaultConsciousnessModel)"
            :speech-provider-placeholder="getDefaultPlaceholder(speechProvider)"
            :default-speech-model-placeholder="getDefaultPlaceholder(defaultSpeechModel)"
            :default-speech-voice-id-placeholder="getDefaultPlaceholder(defaultSpeechVoiceId)"
            :default-display-model-id-placeholder="getDefaultPlaceholder(defaultDisplayModelId)"
            :consciousness-provider-active="Boolean(consciousnessProvider)"
            :speech-provider-active="Boolean(speechProvider)"
            :has-visual-assets="Object.keys(visualAssets).length > 0"
            @studio="emit('studio', props.cardId || '')"
          />
          <CardCreationTabCognition
            v-else-if="activeTab === 'cognition'"
            v-model:cognitive-pipeline-enabled="cognitivePipelineEnabled"
            v-model:first-hop-processor="firstHopProcessor"
            v-model:selected-first-hop-provider="selectedFirstHopProvider"
            v-model:selected-first-hop-model="selectedFirstHopModel"
            v-model:selected-consciousness-provider="selectedConsciousnessProvider"
            v-model:selected-consciousness-model="selectedConsciousnessModel"
            :consciousness-provider-options="consciousnessProviderOptions"
            :consciousness-model-options="consciousnessModelOptions"
            :first-hop-model-options="firstHopModelOptions"
            :default-consciousness-model-placeholder="getDefaultPlaceholder(defaultConsciousnessModel)"
            :default-first-hop-model-placeholder="getDefaultPlaceholder(defaultConsciousnessModel)"
            :consciousness-provider-active="Boolean(consciousnessProvider)"
            :first-hop-provider-active="Boolean(selectedFirstHopProvider || consciousnessProvider)"
          />
          <CardCreationTabArtistry
            v-else-if="activeTab === 'artistry'"
            v-model:selected-artistry-provider="selectedArtistryProvider"
            v-model:selected-artistry-model="selectedArtistryModel"
            v-model:selected-artistry-prompt-prefix="selectedArtistryPromptPrefix"
            v-model:selected-artistry-widget-instruction="selectedArtistryWidgetInstruction"
            v-model:selected-artistry-autonomous-enabled="selectedArtistryAutonomousEnabled"
            v-model:selected-artistry-autonomous-threshold="selectedArtistryAutonomousThreshold"
            v-model:selected-artistry-autonomous-monitor-enabled="selectedArtistryAutonomousMonitorEnabled"
            v-model:selected-artistry-autonomous-monitor-discord-enabled="selectedArtistryAutonomousMonitorDiscordEnabled"
            v-model:selected-artistry-autonomous-history-depth="selectedArtistryAutonomousHistoryDepth"
            v-model:selected-artistry-autonomous-model-mode="selectedArtistryAutonomousModelMode"
            v-model:selected-artistry-autonomous-provider="selectedArtistryAutonomousProvider"
            v-model:selected-artistry-autonomous-model="selectedArtistryAutonomousModel"
            v-model:selected-artistry-autonomous-target="selectedArtistryAutonomousTarget"
            v-model:selected-artistry-spawn-mode="selectedArtistrySpawnMode"
            v-model:selected-artistry-config-str="selectedArtistryConfigStr"
            :artistry-provider-options="artistryProviderOptions"
            :default-artistry-provider-placeholder="getDefaultPlaceholder(defaultArtistryProvider)"
            @sparkle-click="openSparkleGenerator"
            @extract-tags-click="openTagExtractor"
          />
          <CardCreationTabProactivity
            v-else-if="activeTab === 'proactivity'"
            v-model:heartbeats-enabled="heartbeatsEnabled"
            v-model:heartbeats-interval-minutes="heartbeatsIntervalMinutes"
            v-model:heartbeats-prompt="heartbeatsPrompt"
            v-model:heartbeats-inject-into-prompt="heartbeatsInjectIntoPrompt"
            v-model:heartbeats-use-as-local-gate="heartbeatsUseAsLocalGate"
            v-model:heartbeats-schedule-start="heartbeatsScheduleStart"
            v-model:heartbeats-schedule-end="heartbeatsScheduleEnd"
            v-model:heartbeats-context-window-history="heartbeatsContextWindowHistory"
            v-model:heartbeats-context-system-load="heartbeatsContextSystemLoad"
            v-model:heartbeats-context-usage-metrics="heartbeatsContextUsageMetrics"
            v-model:heartbeats-respect-schedule="heartbeatsRespectSchedule"
            v-model:dream-state-enabled="dreamStateEnabled"
            v-model:dream-state-strict-afk-gating="dreamStateStrictAfkGating"
            v-model:dream-state-richness="dreamStateRichness"
            v-model:dream-state-afk-threshold-minutes="dreamStateAfkThresholdMinutes"
            v-model:dream-state-session-timeout-minutes="dreamStateSessionTimeoutMinutes"
            v-model:dream-state-max-sessions-per-day="dreamStateMaxSessionsPerDay"
            v-model:dream-state-inject-dream-context="dreamStateInjectDreamContext"
            v-model:screen-watching-enabled="screenWatchingEnabled"
            v-model:screen-watching-delivery-mode="screenWatchingDeliveryMode"
            v-model:screen-watching-source-type="screenWatchingSourceType"
            v-model:screen-watching-source-id="screenWatchingSourceId"
            v-model:screen-watching-capture-interval-ms="screenWatchingCaptureIntervalMs"
            v-model:screen-watching-downscale-percent="screenWatchingDownscalePercent"
            v-model:screen-watching-workload="screenWatchingWorkload"
            v-model:screen-watching-publish-to-context="screenWatchingPublishToContext"
            v-model:screen-watching-interest-tags="screenWatchingInterestTags"
            v-model:screen-watching-defer-while-speaking="screenWatchingDeferWhileSpeaking"
            v-model:screen-watching-max-per-hour="screenWatchingMaxPerHour"
            v-model:screen-watching-hysteresis-minutes="screenWatchingHysteresisMinutes"
            v-model:event-ledger-enabled="eventLedgerEnabled"
            v-model:event-ledger-sample-depth="eventLedgerSampleDepth"
            v-model:event-ledger-domains="eventLedgerDomains"
            v-model:short-term-memory-enabled="shortTermMemoryEnabled"
            v-model:short-term-memory-window-size="shortTermMemoryWindowSize"
            v-model:short-term-memory-token-budget="shortTermMemoryTokenBudget"
            v-model:grounding-enabled="groundingEnabled"
            :sensor-payload="sensorPayload"
            :static-sample-payload="staticSamplePayload"
            @sparkle-click="openSparkleGenerator"
          />
          <CardCreationTabTools
            v-else-if="activeTab === 'tools'"
            v-model:selected-allowed-tools="generationAllowedTools"
            v-model:selected-image-journal-instruction="selectedArtistryWidgetInstruction"
            v-model:selected-text-journal-instruction="selectedTextJournalInstruction"
            v-model:selected-inject-dream-context="selectedInjectDreamContext"
            v-model:selected-inject-journal-context="selectedInjectJournalContext"
            v-model:selected-inject-artistry-context="selectedInjectArtistryContext"
            v-model:selected-dream-intrusion-prompt="selectedDreamIntrusionPrompt"
            v-model:selected-journal-intrusion-prompt="selectedJournalIntrusionPrompt"
            v-model:selected-artistry-intrusion-prompt="selectedArtistryIntrusionPrompt"
            :dream-state-enabled="dreamStateEnabled"
          />
          <div class="ml-auto mr-1 flex flex-row gap-2">
            <Button
              variant="secondary"
              icon="i-solar:undo-left-bold-duotone"
              :label="t('settings.pages.card.cancel')"
              :disabled="false"
              @click="modelValue = false"
            />
            <Button
              variant="primary"
              icon="i-solar:check-circle-bold-duotone"
              :label="isEditMode ? t('settings.pages.card.save') : t('settings.pages.card.creation.create')"
              :disabled="false"
              @click="saveCard(card)"
            />
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Sparkle AI Generator Modal -->
  <FieldAiGeneratorModal
    v-model="showGeneratorModal"
    :field-id="generatorFieldId"
    :field-label="generatorFieldLabel"
    :initial-value="generatorFieldValue"
    :card-context="generatorCardContext"
    :acting-context="generatorActingContext"
    :model-id="extractorModelId"
    @save="handleGeneratorSave"
  />

  <!-- Image Tag Extractor Modal -->
  <ImageTagExtractorModal
    v-model="showTagExtractorModal"
    :model-id="extractorModelId"
    @apply="handleTagExtractorApply"
  />
</template>
