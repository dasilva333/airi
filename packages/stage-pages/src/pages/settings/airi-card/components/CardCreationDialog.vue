<script setup lang="ts">
import type { Card } from '@proj-airi/ccc'
import { DEFAULT_ARTISTRY_WIDGET_INSTRUCTION } from '@proj-airi/stage-ui/constants/prompts/artistry-instruction'
import {
  DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT,
  DEFAULT_HEARTBEATS_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
} from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { DisplayModelFormat, useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import type { AiriExtension } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProactivityStore } from '@proj-airi/stage-ui/stores/proactivity'
import type { SpeechCapabilitiesInfo } from '@proj-airi/stage-ui/stores/providers'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsStageModel } from '@proj-airi/stage-ui/stores/settings/stage-model'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { useMmd } from '@proj-airi/stage-ui-mmd'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { animations } from '@proj-airi/stage-ui-three/assets/vrm'
import { Button } from '@proj-airi/ui'
import kebabcase from '@stdlib/string-base-kebabcase'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, onMounted, ref, toRaw, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import CardCreationTabActing from './tabs/CardCreationTabActing.vue'
import CardCreationTabArtistry from './tabs/CardCreationTabArtistry.vue'
import CardCreationTabBehavior from './tabs/CardCreationTabBehavior.vue'
import CardCreationTabGeneration from './tabs/CardCreationTabGeneration.vue'
import CardCreationTabIdentity from './tabs/CardCreationTabIdentity.vue'
import CardCreationTabModules from './tabs/CardCreationTabModules.vue'
import CardCreationTabProactivity from './tabs/CardCreationTabProactivity.vue'

interface Props {
  modelValue: boolean
  cardId?: string // If provided, edit mode; otherwise create mode
}

const props = defineProps<Props>()
const emit = defineEmits<(e: 'update:modelValue', value: boolean) => void>()

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
const { activeProvider: consciousnessProvider, activeModel: defaultConsciousnessModel } =
  storeToRefs(consciousnessStore)
const {
  activeSpeechProvider: speechProvider,
  activeSpeechModel: defaultSpeechModel,
  activeSpeechVoiceId: defaultSpeechVoiceId,
} = storeToRefs(speechStore)
const { stageModelSelected: defaultDisplayModelId } = storeToRefs(stageModelStore)
const { activeProvider: defaultArtistryProvider } = storeToRefs(artistryStore)
const { availableExpressions } = storeToRefs(modelStore)
const { animationOptions } = storeToRefs(customVrmAnimationsStore)
const { availableExpressions: live2dExpressions } = storeToRefs(live2dStore)
const { availableMorphs: mmdMorphs, availableMotions: mmdMotions } = storeToRefs(mmdStore)
const { availableAnimations: spineAnimations } = storeToRefs(spineStore)

// Determine if we're in edit mode
const isEditMode = computed(() => !!props.cardId)

const isLive2d = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find((m) => m.id === modelId)
  if (!model) return false
  return model.format === DisplayModelFormat.Live2dZip || model.format === DisplayModelFormat.Live2dDirectory
})

const isSpine = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find((m) => m.id === modelId)
  if (!model) return false
  return model.format === DisplayModelFormat.SpineZip
})

const isMmd = computed(() => {
  const modelId = selectedDisplayModelId.value || defaultDisplayModelId.value
  const model = displayModelsStore.displayModels.find((m) => m.id === modelId)
  if (!model) return false
  return (
    model.format === DisplayModelFormat.PMXZip ||
    model.format === DisplayModelFormat.PMXDirectory ||
    model.format === DisplayModelFormat.PMD
  )
})

// Modules configuration
const selectedConsciousnessProvider = ref<string>('')
const selectedConsciousnessModel = ref<string>('')
const selectedSpeechProvider = ref<string>('')
const selectedSpeechModel = ref<string>('')
const selectedSpeechVoiceId = ref<string>('')
const selectedDisplayModelId = ref<string>('')
const selectedActiveBackgroundId = ref<string>('none')
const selectedArtistryProvider = ref<string>('')
const selectedArtistryModel = ref<string>('')
const selectedArtistryPromptPrefix = ref<string>('')
const selectedArtistryWidgetInstruction = ref<string>('')
const selectedArtistryAutonomousEnabled = ref<boolean>(false)
const selectedArtistryAutonomousThreshold = ref<number>(70)
const selectedArtistryAutonomousTarget = ref<'user' | 'assistant'>('user')
const selectedArtistryAutonomousMonitorEnabled = ref<boolean>(true)
const selectedArtistryAutonomousHistoryDepth = ref<number>(3)
const selectedArtistrySpawnMode = ref<'bg' | 'widget' | 'inline' | 'bg_widget'>('bg_widget')
const selectedArtistryConfigStr = ref<string>('{\n  \n}')
const generationEnabled = ref<boolean>(false)
const generationProvider = ref<string>('')
const generationModel = ref<string>('')
const generationMaxTokens = ref<number | undefined>(undefined)
const generationTemperature = ref<number | undefined>(undefined)
const generationTopP = ref<number | undefined>(undefined)
const generationContextWidth = ref<number | undefined>(undefined)
const generationAdvancedJson = ref<string>('{\n  \n}')
const selectedActingModelExpressionPrompt = ref<string>('')
const selectedActingSpeechExpressionPrompt = ref<string>('')
const selectedActingSpeechMannerismPrompt = ref<string>('')
const selectedActingIdleAnimations = ref<string[]>([])
const actingSpeechCapabilities = ref<SpeechCapabilitiesInfo | null>(null)
const actingSpeechCapabilitiesLoading = ref<boolean>(false)

const DEFAULT_ACTING_MODEL_PROMPT = DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT

const MANNERISM_HELPER_SNIPPETS: Record<string, string> = {
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
  tilde: `## Tilde Replacements
Use occasional \`~\` when sounding playful, sing-song, teasing, or gently affectionate.
- Keep it light and sparse.
- Avoid using it on every sentence.
- Prefer it when the line should feel airy or mischievous.
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
const groundingEnabled = ref<boolean>(false)

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
  return providersStore.configuredChatProvidersMetadata.map((provider) => ({
    label: provider.localizedName || provider.name,
    value: provider.id,
  }))
})

const artistryProviderOptions = computed(() => {
  return [
    { label: 'None (Disabled)', value: 'none' },
    { label: 'Replicate', value: 'replicate' },
    { label: 'ComfyUI', value: 'comfyui' },
  ]
})

// Computed: available consciousness models options
const consciousnessModelOptions = computed(() => {
  const provider = selectedConsciousnessProvider.value || consciousnessProvider.value
  if (!provider) return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map((model) => ({
    label: model.name || model.id,
    value: model.id,
  }))
})

const generationProviderOptions = computed(() => consciousnessProviderOptions.value)

const generationModelOptions = computed(() => {
  const provider = generationProvider.value || selectedConsciousnessProvider.value || consciousnessProvider.value
  if (!provider) return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map((model) => ({
    label: model.name || model.id,
    value: model.id,
  }))
})

// Computed: available speech provider options
const speechProviderOptions = computed(() => {
  return providersStore.configuredSpeechProvidersMetadata.map((provider) => ({
    label: provider.localizedName || provider.name,
    value: provider.id,
  }))
})

// Computed: available speech models options
const speechModelOptions = computed(() => {
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (!provider) return []
  const models = providersStore.getModelsForProvider(provider)
  return models.map((model) => ({
    label: model.name || model.id,
    value: model.id,
  }))
})

// Computed: available speech voices options
const speechVoiceOptions = computed(() => {
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (!provider) return []
  const voices = speechStore.getVoicesForProvider(provider)
  return voices.map((voice) => ({
    label: voice.name || voice.id,
    value: voice.id,
  }))
})

const displayModelOptions = computed(() => {
  return displayModelsStore.displayModels.map((model) => {
    const isLive2D =
      model.format === DisplayModelFormat.Live2dZip || model.format === DisplayModelFormat.Live2dDirectory
    const prefix = isLive2D ? '[Live2D]' : '[VRM]'
    return {
      label: `${prefix} ${model.name}`,
      value: model.id,
    }
  })
})

const sceneOptions = computed(() => {
  const backgrounds = backgroundStore.getCharacterBackgrounds(props.cardId)
  return [
    { label: t('settings.pages.card.creation.none'), value: 'none' },
    ...backgrounds.map((bg) => ({
      label: bg.type === 'journal' ? `Journal: ${bg.title}` : bg.title,
      value: bg.id,
    })),
  ]
})

const actingModelExpressionOptions = computed(() => {
  if (isLive2d.value) {
    const exps = live2dExpressions.value.map((e) => e.name)
    const motionMappings = cardStore.activeCard?.extensions?.airi?.modules?.live2d?.motionMappings || {}
    const hiddenMotions = cardStore.activeCard?.extensions?.airi?.modules?.live2d?.hiddenMotions || []

    const mappedMotions: string[] = []
    const unmappedMotions: string[] = []

    live2dStore.availableMotions.forEach((m) => {
      if (hiddenMotions.includes(m.fileName)) return

      const name = m.fileName.split('/').pop() || m.fileName
      const cleanName = name.replace('.motion3.json', '').replace('.json', '')
      const mappedName = motionMappings[m.fileName]

      if (mappedName) {
        mappedMotions.push(mappedName)
      } else {
        unmappedMotions.push(cleanName)
      }
    })

    mappedMotions.sort((a, b) => a.localeCompare(b))
    unmappedMotions.sort((a, b) => a.localeCompare(b))

    if (mappedMotions.length > 0) {
      return [...new Set([...exps, ...mappedMotions])]
    } else {
      return [...new Set([...exps, ...unmappedMotions])]
    }
  }
  if (isSpine.value) {
    return spineAnimations.value.map((a) => a.name).sort((a, b) => a.localeCompare(b))
  }
  if (isMmd.value) {
    const mappings = mmdStore.morphMappings || {}
    const hidden = mmdStore.hiddenMorphs || []

    const mapped: string[] = []
    const unmapped: string[] = []

    mmdMorphs.value.forEach((m) => {
      if (hidden.includes(m)) return

      const mappedName = mappings[m]
      if (mappedName) {
        mapped.push(mappedName)
      } else {
        unmapped.push(m)
      }
    })

    if (mapped.length > 0) {
      return [...new Set(mapped)].sort((a, b) => a.localeCompare(b))
    } else {
      return [...new Set(unmapped)].sort((a, b) => a.localeCompare(b))
    }
  }
  const modelExps = [...availableExpressions.value]
  const vrmaExps = Object.keys(animations)
  return [...new Set([...modelExps, ...vrmaExps])].sort((a, b) => a.localeCompare(b))
})

const actingIdleAnimationOptions = computed(() => {
  if (isLive2d.value) {
    const motionMappings = cardStore.activeCard?.extensions?.airi?.modules?.live2d?.motionMappings || {}
    const hiddenMotions = cardStore.activeCard?.extensions?.airi?.modules?.live2d?.hiddenMotions || []

    const mappedMotions: { label: string; value: string }[] = []
    const unmappedMotions: { label: string; value: string }[] = []

    live2dStore.availableMotions.forEach((m) => {
      if (hiddenMotions.includes(m.fileName)) return

      const name = m.fileName.split('/').pop() || m.fileName
      const cleanName = name.replace('.motion3.json', '').replace('.json', '')
      const mappedName = motionMappings[m.fileName]

      if (mappedName) {
        mappedMotions.push({ label: mappedName, value: mappedName })
      } else {
        unmappedMotions.push({ label: cleanName, value: cleanName })
      }
    })

    mappedMotions.sort((a, b) => a.label.localeCompare(b.label))
    unmappedMotions.sort((a, b) => a.label.localeCompare(b.label))

    if (mappedMotions.length > 0) {
      return mappedMotions
    } else {
      return unmappedMotions
    }
  }
  if (isSpine.value) {
    return spineAnimations.value.map((a) => ({ label: a.name, value: a.name }))
  }
  if (isMmd.value) {
    return mmdMotions.value.map((m) => ({ label: m, value: m }))
  }
  return animationOptions.value
})

function isVrmaExpression(name: string) {
  return name in animations
}

const actingExpressionTags = computed(() => actingSpeechCapabilities.value?.expressionTags || [])

const actingGroupedExpressionTags = computed(() => {
  const groups = new Map<string, { tag: string; description?: string }[]>()
  for (const tag of actingExpressionTags.value) {
    const key = tag.category || 'other'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ description: tag.description, tag: tag.tag })
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
    const capabilities = await metadata.capabilities.getSpeechCapabilities?.(
      providersStore.getProviderConfig(providerId),
    )
    actingSpeechCapabilities.value = capabilities ?? null
  } catch {
    actingSpeechCapabilities.value = null
  } finally {
    actingSpeechCapabilitiesLoading.value = false
  }
}

function appendUniqueLine(target: typeof selectedActingModelExpressionPrompt, line: string) {
  if (target.value.includes(line)) return

  const suffix = target.value.endsWith('\n') || !target.value ? '' : '\n'
  target.value = `${target.value}${suffix}${line}\n`
}

function insertModelExpression(name: string) {
  if (isLive2d.value) {
    const isExpression = live2dExpressions.value.some((e) => e.name === name)
    const motionMappings = cardStore.activeCard?.extensions?.airi?.modules?.live2d?.motionMappings || {}
    const isMotion = live2dStore.availableMotions.some((m) => {
      const displayName = m.fileName.split('/').pop() || m.fileName
      const cleanName = displayName.replace('.motion3.json', '').replace('.json', '')
      const mappedName = motionMappings[m.fileName]
      return displayName === name || cleanName === name || mappedName === name
    })

    if (isExpression) {
      appendUniqueLine(selectedActingModelExpressionPrompt, `- <|ACT:emotion:"${name}"|>`)
    } else if (isMotion) {
      appendUniqueLine(selectedActingModelExpressionPrompt, `- <|ACT:motion:"${name}"|>`)
    } else {
      appendUniqueLine(selectedActingModelExpressionPrompt, `- \`${name}\``)
    }
  } else {
    appendUniqueLine(selectedActingModelExpressionPrompt, `- \`${name}\``)
  }
}

function insertSpeechTag(tag: string, description?: string) {
  const line = description ? `- \`[${tag}]\` - ${description}` : `- \`[${tag}]\``
  appendUniqueLine(selectedActingSpeechExpressionPrompt, line)
}

function insertSpeechMannerism(id: string) {
  const snippet = MANNERISM_HELPER_SNIPPETS[id]
  if (!snippet || selectedActingSpeechMannerismPrompt.value.includes(snippet.trim())) return

  const suffix =
    selectedActingSpeechMannerismPrompt.value.endsWith('\n') || !selectedActingSpeechMannerismPrompt.value ? '' : '\n\n'
  selectedActingSpeechMannerismPrompt.value = `${selectedActingSpeechMannerismPrompt.value}${suffix}${snippet}`
}

onMounted(() => {
  displayModelsStore.loadDisplayModelsFromIndexedDB()
})

// Load models for current providers on init
watch(
  () => [consciousnessProvider.value, speechProvider.value],
  async ([consProvider, spProvider]) => {
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
  },
  { immediate: true },
)

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

// Watch speech provider changes and reload models/voices
watch(selectedSpeechProvider, async (newProvider, oldProvider) => {
  if (oldProvider !== undefined && newProvider !== oldProvider && newProvider) {
    await speechStore.loadVoicesForProvider(newProvider)
    const metadata = providersStore.getProviderMetadata(newProvider)
    if (metadata?.capabilities.listModels) {
      await providersStore.fetchModelsForProvider(newProvider)
    }
    await loadActingSpeechCapabilities(newProvider)
    // Reset model and voice selection
    selectedSpeechModel.value = ''
    selectedSpeechVoiceId.value = ''
  }
})

// Reset voice when speech model changes (different models may have different voices)
watch(selectedSpeechModel, async (newModel, oldModel) => {
  // Only reset if model actually changed and we're not initializing
  const provider = selectedSpeechProvider.value || speechProvider.value
  if (oldModel !== undefined && newModel !== oldModel && provider) {
    // Reload voices for the current provider
    await speechStore.loadVoicesForProvider(provider)

    // Reset voice selection to default
    selectedSpeechVoiceId.value = defaultSpeechVoiceId.value || ''
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
  {
    icon: 'i-solar:emoji-funny-square-bold-duotone',
    id: 'identity',
    label: t('settings.pages.card.creation.identity'),
  },
  { icon: 'i-solar:chat-round-line-bold-duotone', id: 'behavior', label: t('settings.pages.card.creation.behavior') },
  { icon: 'i-solar:tuning-square-bold-duotone', id: 'generation', label: 'Generation' },
  { icon: 'i-solar:mask-happly-bold-duotone', id: 'acting', label: 'Acting' },
  { icon: 'i-solar:widget-4-bold-duotone', id: 'modules', label: t('settings.pages.card.modules') },
  { icon: 'i-solar:gallery-bold-duotone', id: 'artistry', label: t('settings.pages.modules.artistry.title') },
  {
    icon: 'i-solar:heart-pulse-bold-duotone',
    id: 'proactivity',
    label: t('settings.pages.card.creation.proactivity', 'Proactivity'),
  },
]

// Active tab state - set to first available tab by default
const activeTab = computed({
  get: () => {
    // If current active tab is not in available tabs, reset to first tab
    if (!tabs.find((tab) => tab.id === activeTabId.value)) return tabs[0]?.id || ''
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
  const existingAiriExt =
    isEditMode.value && props.cardId
      ? (cardStore.getCard(props.cardId)?.extensions?.airi as AiriExtension | undefined)
      : undefined

  if (!((rawCard.name?.length ?? 0) > 0)) {
    // No name
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.name')
    return false
  } else if (!/^(?:\d+\.)+\d+$/.test(rawCard.version)) {
    // Invalid version
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.version')
    return false
  } else if (!((rawCard.description?.length ?? 0) > 0)) {
    // No description
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.description')
    return false
  } else if (!((rawCard.personality?.length ?? 0) > 0)) {
    // No personality
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.personality')
    return false
  } else if (!((rawCard.scenario?.length ?? 0) > 0)) {
    // No Scenario
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.scenario')
    return false
  } else if (!((rawCard.systemPrompt?.length ?? 0) > 0)) {
    // No sys prompt
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.systemprompt')
    return false
  } else if (!((rawCard.postHistoryInstructions?.length ?? 0) > 0)) {
    // No post history prompt
    showError.value = true
    errorMessage.value = t('settings.pages.card.creation.errors.posthistoryinstructions')
    return false
  }
  showError.value = false

  const generationKnown = {
    contextWidth: normalizeOptionalNumber(generationContextWidth.value),
    maxTokens: normalizeOptionalNumber(generationMaxTokens.value),
    temperature: normalizeOptionalNumber(generationTemperature.value),
    topP: normalizeOptionalNumber(generationTopP.value),
  }
  let generationAdvanced: Record<string, any> | undefined

  try {
    generationAdvanced = generationAdvancedJson.value.trim() ? JSON.parse(generationAdvancedJson.value) : undefined
  } catch {
    showError.value = true
    errorMessage.value = 'Generation Advanced JSON must be valid JSON before saving.'
    return false
  }

  let artistryConfig: Record<string, any> | undefined
  try {
    artistryConfig = selectedArtistryConfigStr.value.trim() ? JSON.parse(selectedArtistryConfigStr.value) : undefined
  } catch {
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
        acting: {
          ...existingAiriExt?.acting,
          idleAnimations: [...(selectedActingIdleAnimations.value || [])],
          modelExpressionPrompt: selectedActingModelExpressionPrompt.value,
          speechExpressionPrompt: selectedActingSpeechExpressionPrompt.value,
          speechMannerismPrompt: selectedActingSpeechMannerismPrompt.value,
        },
        active_concepts: existingAiriExt?.active_concepts || [],
        agents: existingAiriExt?.agents || {},
        dreamState: {
          ...existingAiriExt?.dreamState,
          afkThresholdMinutes: existingAiriExt?.dreamState?.afkThresholdMinutes || 5,
          dailyRunCount: existingAiriExt?.dreamState?.dailyRunCount ?? 0,
          dailyRunDate: existingAiriExt?.dreamState?.dailyRunDate,
          enabled: dreamStateEnabled.value,
          journalingThreshold: existingAiriExt?.dreamState?.journalingThreshold || 'balanced',
          lastProcessedAt: existingAiriExt?.dreamState?.lastProcessedAt,
          maxSessionsPerDay: existingAiriExt?.dreamState?.maxSessionsPerDay || 4,
          minConversationTurns: existingAiriExt?.dreamState?.minConversationTurns || 4,
          sessionTimeoutMinutes: existingAiriExt?.dreamState?.sessionTimeoutMinutes || 60,
          strictAfkGating: dreamStateStrictAfkGating.value,
        },
        eternal_record: existingAiriExt?.eternal_record || { lore_bits: [], relational_milestones: [] },
        generation: {
          ...existingAiriExt?.generation,
          advanced: generationAdvanced,
          enabled: generationEnabled.value,
          known: {
            ...existingAiriExt?.generation?.known,
            ...generationKnown,
          },
          model: generationModel.value || selectedConsciousnessModel.value || defaultConsciousnessModel.value,
          provider: generationProvider.value || selectedConsciousnessProvider.value || consciousnessProvider.value,
        },
        groundingEnabled: groundingEnabled.value,
        heartbeats: {
          ...existingAiriExt?.heartbeats,
          contextOptions: {
            ...existingAiriExt?.heartbeats?.contextOptions,
            systemLoad: heartbeatsContextSystemLoad.value,
            usageMetrics: heartbeatsContextUsageMetrics.value,
            windowHistory: heartbeatsContextWindowHistory.value,
          },
          enabled: heartbeatsEnabled.value,
          injectIntoPrompt: heartbeatsInjectIntoPrompt.value,
          intervalMinutes: heartbeatsIntervalMinutes.value,
          prompt: heartbeatsPrompt.value,
          respectSchedule: heartbeatsRespectSchedule.value,
          schedule: {
            ...existingAiriExt?.heartbeats?.schedule,
            end: heartbeatsScheduleEnd.value,
            start: heartbeatsScheduleStart.value,
          },
          useAsLocalGate: heartbeatsUseAsLocalGate.value,
        },
        modules: {
          ...existingAiriExt?.modules,
          activeBackgroundId: selectedActiveBackgroundId.value || 'none',
          consciousness: {
            model: selectedConsciousnessModel.value || defaultConsciousnessModel.value,
            provider: selectedConsciousnessProvider.value || consciousnessProvider.value,
          },
          displayModelId: selectedDisplayModelId.value || defaultDisplayModelId.value,
          speech: {
            model: selectedSpeechModel.value || defaultSpeechModel.value,
            provider: selectedSpeechProvider.value || speechProvider.value,
            voice_id: selectedSpeechVoiceId.value || defaultSpeechVoiceId.value,
          },
        },
        visual_assets: existingAiriExt?.visual_assets || {},
      } as AiriExtension,
    },
  }

  // Inject artistry manually to avoid TS errors
  cardWithModules.extensions.airi.artistry = {
    autonomousEnabled: selectedArtistryAutonomousEnabled.value,
    autonomousHistoryDepth: selectedArtistryAutonomousHistoryDepth.value,
    autonomousMonitorEnabled: selectedArtistryAutonomousMonitorEnabled.value,
    autonomousTarget: selectedArtistryAutonomousTarget.value,
    autonomousThreshold: selectedArtistryAutonomousThreshold.value,
    model: selectedArtistryModel.value,
    options: artistryConfig,
    promptPrefix: selectedArtistryPromptPrefix.value,
    provider: selectedArtistryProvider.value || defaultArtistryProvider.value,
    spawnMode: selectedArtistrySpawnMode.value,
    widgetInstruction: selectedArtistryWidgetInstruction.value,
  }

  if (isEditMode.value && props.cardId) {
    // Edit mode: update existing card
    cardStore.updateCard(props.cardId, cardWithModules)
  } else {
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
  const existingCard = isEditMode.value && props.cardId ? cardStore.getCard(props.cardId) : undefined
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
  selectedArtistryProvider.value = airiExt?.artistry?.provider || defaultArtistryProvider.value
  selectedArtistryModel.value = airiExt?.artistry?.model || ''
  selectedArtistryPromptPrefix.value = airiExt?.artistry?.promptPrefix || ''
  selectedArtistryWidgetInstruction.value = airiExt?.artistry?.widgetInstruction || DEFAULT_ARTISTRY_WIDGET_INSTRUCTION
  selectedArtistryAutonomousEnabled.value = airiExt?.artistry?.autonomousEnabled ?? false
  selectedArtistryAutonomousThreshold.value = airiExt?.artistry?.autonomousThreshold ?? 70
  selectedArtistryAutonomousMonitorEnabled.value = airiExt?.artistry?.autonomousMonitorEnabled ?? true
  selectedArtistryAutonomousHistoryDepth.value = airiExt?.artistry?.autonomousHistoryDepth ?? 3
  selectedArtistryAutonomousTarget.value = airiExt?.artistry?.autonomousTarget ?? 'user'
  selectedArtistrySpawnMode.value = airiExt?.artistry?.spawnMode ?? 'bg_widget'
  generationEnabled.value = airiExt?.generation?.enabled ?? false
  generationProvider.value =
    airiExt?.generation?.provider || airiExt?.modules?.consciousness?.provider || consciousnessProvider.value
  generationModel.value =
    airiExt?.generation?.model || airiExt?.modules?.consciousness?.model || defaultConsciousnessModel.value
  generationMaxTokens.value = normalizeOptionalNumber(airiExt?.generation?.known?.maxTokens)
  generationTemperature.value = normalizeOptionalNumber(airiExt?.generation?.known?.temperature)
  generationTopP.value = normalizeOptionalNumber(airiExt?.generation?.known?.topP)
  generationContextWidth.value = normalizeOptionalNumber(airiExt?.generation?.known?.contextWidth)
  generationAdvancedJson.value = airiExt?.generation?.advanced
    ? JSON.stringify(airiExt.generation.advanced, null, 2)
    : '{\n  \n}'
  selectedActingModelExpressionPrompt.value = airiExt?.acting?.modelExpressionPrompt || DEFAULT_ACTING_MODEL_PROMPT
  selectedActingSpeechExpressionPrompt.value =
    airiExt?.acting?.speechExpressionPrompt || DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT
  selectedActingSpeechMannerismPrompt.value =
    airiExt?.acting?.speechMannerismPrompt || DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT
  selectedActingIdleAnimations.value = [...(airiExt?.acting?.idleAnimations || [])]
  try {
    selectedArtistryConfigStr.value = airiExt?.artistry?.options
      ? JSON.stringify(airiExt.artistry.options, null, 2)
      : '{\n  \n}'
  } catch {
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
  dreamStateEnabled.value = airiExt?.dreamState?.enabled ?? false
  dreamStateStrictAfkGating.value = airiExt?.dreamState?.strictAfkGating ?? true
  groundingEnabled.value = airiExt?.groundingEnabled ?? false

  loadActingSpeechCapabilities(selectedSpeechProvider.value || speechProvider.value)

  // Return existing card data or defaults
  if (existingCard) {
    return { ...toRaw(existingCard) }
  }

  return {
    description: '',
    greetings: [],
    messageExample: [],
    name: t('settings.pages.card.creation.defaults.name'),
    nickname: undefined,
    notes: undefined,
    personality: t('settings.pages.card.creation.defaults.personality'),
    postHistoryInstructions:
      (t('settings.pages.card.creation.defaults.posthistoryinstructions') !==
        'settings.pages.card.creation.defaults.posthistoryinstructions' &&
        t('settings.pages.card.creation.defaults.posthistoryinstructions')) ||
      DEFAULT_POST_HISTORY_INSTRUCTIONS,
    scenario: t('settings.pages.card.creation.defaults.scenario'),
    systemPrompt: t('settings.pages.card.creation.defaults.systemprompt'),
    version: '1.0',
  }
}

const card = ref<Card>(initializeCard())

// Reinitialize when cardId changes or dialog opens
watch(
  () => [props.modelValue, props.cardId],
  () => {
    if (props.modelValue) {
      card.value = initializeCard()
    }
  },
)

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
    set: (val: string) => {
      // Set,
      const input = val.trim() // We first trim the value
      card.value[key] = (
        input.length > 0
          ? transform
            ? transform(input)
            : input // then potentially transform it
          : ''
      ) as Card[T] // or default to empty string value if nothing was given
    },
  })
}

const cardName = makeComputed('name', (input) => kebabcase(input))
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
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined

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
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-100 m-0 max-h-[90vh] max-w-6xl w-[92vw] flex flex-col overflow-auto border border-neutral-200 rounded-xl bg-white p-5 shadow-xl 2xl:w-[60vw] lg:w-[80vw] md:w-[85vw] xl:w-[70vw] -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800 sm:p-6">
        <div class="w-full flex flex-col gap-5">
          <DialogTitle text-2xl font-normal class="from-primary-500 to-primary-400 bg-gradient-to-r bg-clip-text text-transparent">
            {{ isEditMode ? t("settings.pages.card.edit_card") : t("settings.pages.card.create_card") }}
          </DialogTitle>

          <!-- Dialog tabs -->
          <div class="mt-4">
            <div class="border-b border-neutral-200 dark:border-neutral-700">
              <div class="flex justify-center -mb-px sm:justify-start space-x-1">
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
            v-model:card-post-history-instructions="cardPostHistoryInstructions"
            v-model:card-version="cardVersion"
          />
          <CardCreationTabBehavior
            v-else-if="activeTab === 'behavior'"
            v-model:card-personality="cardPersonality"
            v-model:card-scenario="cardScenario"
            v-model:card-greetings="cardGreetings"
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
            :provider-options="generationProviderOptions"
            :model-options="generationModelOptions"
            :provider-placeholder="getDefaultPlaceholder(selectedConsciousnessProvider || consciousnessProvider)"
            :model-placeholder="getDefaultPlaceholder(selectedConsciousnessModel || defaultConsciousnessModel)"
          />
          <CardCreationTabActing
            v-else-if="activeTab === 'acting'"
            v-model:selected-acting-model-expression-prompt="selectedActingModelExpressionPrompt"
            v-model:selected-acting-speech-expression-prompt="selectedActingSpeechExpressionPrompt"
            v-model:selected-acting-speech-mannerism-prompt="selectedActingSpeechMannerismPrompt"
            v-model:selected-acting-idle-animations="selectedActingIdleAnimations"
            :acting-idle-animation-options="actingIdleAnimationOptions"
            :acting-model-expression-options="actingModelExpressionOptions"
            :acting-grouped-expression-tags="actingGroupedExpressionTags"
            :acting-mannerism-options="actingMannerismOptions"
            :acting-speech-capabilities-loading="actingSpeechCapabilitiesLoading"
            :selected-speech-provider-label="selectedSpeechProvider || speechProvider || 'none'"
            :is-live2d="isLive2d"
            :is-vrma-expression="isVrmaExpression"
            :insert-model-expression="insertModelExpression"
            :insert-speech-tag="insertSpeechTag"
            :insert-speech-mannerism="insertSpeechMannerism"
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
            v-model:selected-artistry-autonomous-history-depth="selectedArtistryAutonomousHistoryDepth"
            v-model:selected-artistry-autonomous-target="selectedArtistryAutonomousTarget"
            v-model:selected-artistry-spawn-mode="selectedArtistrySpawnMode"
            v-model:selected-artistry-config-str="selectedArtistryConfigStr"
            :artistry-provider-options="artistryProviderOptions"
            :default-artistry-provider-placeholder="getDefaultPlaceholder(defaultArtistryProvider)"
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
            v-model:grounding-enabled="groundingEnabled"
            :sensor-payload="sensorPayload"
            :static-sample-payload="staticSamplePayload"
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
</template>
