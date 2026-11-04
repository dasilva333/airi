<script setup lang="ts">
import type { AiriCard } from '@proj-airi/stage-ui/stores/modules/airi-card'

import DOMPurify from 'dompurify'

import { CharacterContextDialog, StageBackgroundPicker } from '@proj-airi/stage-ui/components/scenarios/dialogs'
import { DEFAULT_ARTISTRY_WIDGET_INSTRUCTION } from '@proj-airi/stage-ui/constants/prompts/artistry-instruction'
import {
  DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT,
  DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT,
  DEFAULT_ARTISTRY_INTRUSION_PROMPT,
  DEFAULT_DREAM_INTRUSION_PROMPT,
  DEFAULT_HEARTBEATS_PROMPT,
  DEFAULT_JOURNAL_INTRUSION_PROMPT,
  DEFAULT_POST_HISTORY_INSTRUCTIONS,
  DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION,
} from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import {
  useArtistryStore,
  useConsciousnessStore,
  useDisplayModelsStore,
  useSpeechStore,
} from '@proj-airi/stage-ui/stores'
import {
  buildSystemPrompt,
  useAiriCardStore,
} from '@proj-airi/stage-ui/stores/modules/airi-card'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import DeleteCardDialog from './DeleteCardDialog.vue'

interface Props {
  modelValue: boolean
  cardId: string
  initialTab?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'edit', cardId: string): void
}>()

const { t } = useI18n()
const cardStore = useAiriCardStore()
const consciousnessStore = useConsciousnessStore()
const speechStore = useSpeechStore()
const artistryStore = useArtistryStore()
const displayModelsStore = useDisplayModelsStore()

const { removeCard } = cardStore
const { activeCardId } = storeToRefs(cardStore)
const { activeProvider: consciousnessProvider, activeModel: defaultConsciousnessModel } = storeToRefs(consciousnessStore)
const { activeSpeechProvider: speechProvider, activeSpeechModel: defaultSpeechModel, activeSpeechVoiceId: defaultVoiceId } = storeToRefs(speechStore)
const { activeProvider: defaultArtistryProvider } = storeToRefs(artistryStore)

// Get selected card data
const selectedCard = computed<AiriCard | undefined>(() => {
  if (!props.cardId)
    return undefined
  return cardStore.getCard(props.cardId)
})

const airiExt = computed(() => selectedCard.value?.extensions?.airi)

// Get module settings
const moduleSettings = computed(() => {
  if (!selectedCard.value || !selectedCard.value.extensions?.airi?.modules) {
    return {
      consciousnessProvider: '',
      consciousness: '',
      speechProvider: '',
      speech: '',
      voice: '',
      displayModelId: '',
    }
  }

  const modules = selectedCard.value.extensions.airi.modules
  return {
    consciousnessProvider: modules.consciousness?.provider || '',
    consciousness: modules.consciousness?.model || '',
    speechProvider: modules.speech?.provider || '',
    speech: modules.speech?.model || '',
    voice: modules.speech?.voice_id || '',
    displayModelId: modules.displayModelId || '',
  }
})

// Check if card is active
const isActive = computed(() => props.cardId === activeCardId.value)

// Animation control for card activation
const isActivating = ref(false)

async function handleActivate() {
  isActivating.value = true
  try {
    await cardStore.activateCard(props.cardId)
  }
  catch (err) {
    console.error('[CardDetailDialog] Failed to activate card:', err)
  }
  finally {
    isActivating.value = false
  }
}

function highlightTagToHtml(text?: string) {
  if (!text)
    return ''
  return DOMPurify.sanitize(text.replace(/\{\{(.*?)\}\}/g, '<span class="bg-primary-500/20 inline-block px-1 rounded text-primary-700 dark:text-primary-300 font-mono">{{ $1 }}</span>').trim())
}

// Delete confirmation
const showDeleteConfirm = ref(false)

function handleDeleteConfirm() {
  if (selectedCard.value) {
    removeCard(props.cardId)
    emit('update:modelValue', false)
  }
  showDeleteConfirm.value = false
}

const showContextPreview = ref(false)
const effectiveSystemPrompt = computed(() => buildSystemPrompt(selectedCard.value))

interface Tab {
  id: string
  label: string
  icon: string
}

function normalizeTab(tab?: string): string {
  if (!tab)
    return 'character'
  if (tab === 'studio' || tab === 'staging')
    return 'character'
  if (tab === 'modules')
    return 'engine'
  if (['character', 'directives', 'engine', 'proactivity', 'gallery'].includes(tab))
    return tab
  return 'character'
}

// Active tab ID state
const activeTabId = ref(normalizeTab(props.initialTab))

// Watch for initialTab changes to reset the tab when opening from a deep-link
watch(() => props.initialTab, (newTab) => {
  if (newTab) {
    activeTabId.value = normalizeTab(newTab)
  }
})

// Watch for dialog open to apply initialTab
watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.initialTab) {
    activeTabId.value = normalizeTab(props.initialTab)
  }
})

// 5 canonical tabs in agreed order: [ Character ] [ Directives ] [ Engine ] [ Proactivity ] [ Gallery ]
const tabs = computed<Tab[]>(() => [
  {
    id: 'character',
    label: t('settings.pages.card.character', 'Character'),
    icon: 'i-solar:user-rounded-linear',
  },
  {
    id: 'directives',
    label: 'Directives',
    icon: 'i-solar:code-file-linear',
  },
  {
    id: 'engine',
    label: 'Engine',
    icon: 'i-solar:cpu-bolt-linear',
  },
  {
    id: 'proactivity',
    label: 'Proactivity',
    icon: 'i-solar:heart-pulse-linear',
  },
  {
    id: 'gallery',
    label: 'Gallery',
    icon: 'i-solar:gallery-linear',
  },
])

// Active tab state
const activeTab = computed({
  get: () => {
    if (!tabs.value.find(tab => tab.id === activeTabId.value))
      return tabs.value[0]?.id || 'character'
    return activeTabId.value
  },
  set: (value: string) => {
    activeTabId.value = value
  },
})

// Helper function to generate placeholder text for default values
function getDefaultPlaceholder(defaultValue: string | undefined): string {
  return defaultValue
    ? `${t('settings.pages.card.creation.use_default')} (${defaultValue})`
    : t('settings.pages.card.creation.use_default_not_configured')
}

function getModuleDisplayValue(value: string | undefined, defaultValue: string | undefined): string {
  return value || getDefaultPlaceholder(defaultValue)
}

// -------------------------------------------------------------
// TAB 1: Character (Lore & Staging Concepts / Visual Assets)
// -------------------------------------------------------------
const visualAssets = computed(() => airiExt.value?.visual_assets || {})
const activeConcepts = computed<string[]>(() => airiExt.value?.active_concepts || [])

const conceptsList = computed(() => {
  return Object.entries(visualAssets.value).map(([key, asset]) => {
    const a = asset as any
    const isBase = a?.isBase ?? false
    const isActiveConcept = activeConcepts.value.includes(key)
    const modelId = a?.manifestation?.modelId
    const matchedModel = modelId ? (displayModelsStore.displayModels || []).find((m: any) => m.id === modelId) : null
    return {
      key,
      name: a?.name || key,
      isBase,
      isActive: isActiveConcept,
      modelId,
      modelName: matchedModel?.name || modelId || '',
      description: a?.description || '',
      prompt: a?.prompt || '',
    }
  })
})

// -------------------------------------------------------------
// TAB 2: Directives (All debug & hidden runtime prompts)
// -------------------------------------------------------------
interface DirectiveItem {
  id: string
  title: string
  category: string
  categoryColor: string
  icon: string
  content: string
  isCustom: boolean
  description: string
}

const copiedDirectiveId = ref<string | null>(null)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyDirective(id: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedDirectiveId.value = id
    if (copyTimeout)
      clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => {
      copiedDirectiveId.value = null
    }, 2000)
  }
  catch (err) {
    console.error('Failed to copy directive to clipboard:', err)
  }
}

function directiveCategoryClass(color: string): string {
  switch (color) {
    case 'primary':
      return 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20'
    case 'amber':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    case 'purple':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
    case 'pink':
      return 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
    case 'emerald':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    case 'indigo':
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
    case 'cyan':
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
    case 'violet':
      return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
    default:
      return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20'
  }
}

const directives = computed<DirectiveItem[]>(() => {
  if (!selectedCard.value)
    return []

  const list: DirectiveItem[] = []

  // 1. Core System Prompt
  if (selectedCard.value.systemPrompt) {
    list.push({
      id: 'system_prompt',
      title: 'Character System Prompt',
      category: 'Core Identity',
      categoryColor: 'primary',
      icon: 'i-solar:document-text-bold-duotone',
      content: selectedCard.value.systemPrompt,
      isCustom: true,
      description: 'Defines persona, rules of engagement, and baseline character worldview.',
    })
  }

  // 2. Post-History Instructions (Conversational Directive)
  const postHistory = selectedCard.value.postHistoryInstructions || DEFAULT_POST_HISTORY_INSTRUCTIONS
  list.push({
    id: 'post_history',
    title: 'Post-History Conversational Directive',
    category: 'Generation Invariant',
    categoryColor: 'amber',
    icon: 'i-solar:chat-round-line-bold-duotone',
    content: postHistory,
    isCustom: !!selectedCard.value.postHistoryInstructions,
    description: 'Injected at the very tail of the message stream before response generation.',
  })

  // 3. Model Expression & ACT Motion Cues
  const modelExpression = airiExt.value?.acting?.modelExpressionPrompt || DEFAULT_ACTING_MODEL_EXPRESSION_PROMPT
  list.push({
    id: 'acting_model_expression',
    title: 'Model Expression & ACT Motion Cues',
    category: 'Acting Directive',
    categoryColor: 'purple',
    icon: 'i-solar:smile-circle-bold-duotone',
    content: modelExpression,
    isCustom: !!airiExt.value?.acting?.modelExpressionPrompt,
    description: 'Instructs the LLM on emitting <|ACT:...|> expression and kinetic tokens.',
  })

  // 4. Speech Mannerism Directive
  const speechMannerism = airiExt.value?.acting?.speechMannerismPrompt || DEFAULT_ACTING_SPEECH_MANNERISM_PROMPT
  list.push({
    id: 'acting_speech_mannerism',
    title: 'Speech Mannerisms & Cadence Directive',
    category: 'Acting Directive',
    categoryColor: 'purple',
    icon: 'i-solar:soundwave-bold-duotone',
    content: speechMannerism,
    isCustom: !!airiExt.value?.acting?.speechMannerismPrompt,
    description: 'Shapes verbal cadence, stutter, pauses, and idiosyncratic speech dialect.',
  })

  // 5. Speech Expression Directive
  const speechExpression = airiExt.value?.acting?.speechExpressionPrompt || DEFAULT_ACTING_SPEECH_EXPRESSION_PROMPT
  list.push({
    id: 'acting_speech_expression',
    title: 'Speech Expression & Audio Tag Directive',
    category: 'Acting Directive',
    categoryColor: 'purple',
    icon: 'i-solar:record-bold-duotone',
    content: speechExpression,
    isCustom: !!airiExt.value?.acting?.speechExpressionPrompt,
    description: 'Directs square-bracket audio tags ([whisper], [gasp]) for supported TTS engines.',
  })

  // 6. Autonomous Artistry Widget Instruction
  const artistryWidget = airiExt.value?.artistry?.widgetInstruction || DEFAULT_ARTISTRY_WIDGET_INSTRUCTION
  list.push({
    id: 'artistry_widget',
    title: 'Autonomous Artistry Widget Directive',
    category: 'Autonomous Artistry',
    categoryColor: 'pink',
    icon: 'i-solar:palette-bold-duotone',
    content: artistryWidget,
    isCustom: !!airiExt.value?.artistry?.widgetInstruction,
    description: 'Guides image generation tool invocation and visual context grounding.',
  })

  // 7. Artistry Reflection Prompt
  const artistryIntrusion = airiExt.value?.artistry?.artistryIntrusionPrompt || DEFAULT_ARTISTRY_INTRUSION_PROMPT
  list.push({
    id: 'artistry_intrusion',
    title: 'Artistry Reflection Prompt',
    category: 'Autonomous Artistry',
    categoryColor: 'pink',
    icon: 'i-solar:camera-bold-duotone',
    content: artistryIntrusion,
    isCustom: !!airiExt.value?.artistry?.artistryIntrusionPrompt,
    description: 'Spontaneous autonomous artwork creation impulse during conversations.',
  })

  // 8. Text Journal Widget Instruction
  const journalWidget = airiExt.value?.textJournal?.widgetInstruction || DEFAULT_TEXT_JOURNAL_WIDGET_INSTRUCTION
  list.push({
    id: 'journal_widget',
    title: 'Text Journal Widget Directive',
    category: 'Sacred Journal',
    categoryColor: 'emerald',
    icon: 'i-solar:book-bookmark-bold-duotone',
    content: journalWidget,
    isCustom: !!airiExt.value?.textJournal?.widgetInstruction,
    description: 'Defines how long-term memory journal entries are recorded and structured.',
  })

  // 9. Journal Reflection Prompt
  const journalIntrusion = airiExt.value?.textJournal?.journalIntrusionPrompt || DEFAULT_JOURNAL_INTRUSION_PROMPT
  list.push({
    id: 'journal_intrusion',
    title: 'Journal Reflection Prompt',
    category: 'Sacred Journal',
    categoryColor: 'emerald',
    icon: 'i-solar:pen-new-square-bold-duotone',
    content: journalIntrusion,
    isCustom: !!airiExt.value?.textJournal?.journalIntrusionPrompt,
    description: 'Controls memory recording prompts and spontaneous reflection recording.',
  })

  // 10. Dream State Reflection Prompt
  const dreamIntrusion = airiExt.value?.dreamState?.dreamIntrusionPrompt || DEFAULT_DREAM_INTRUSION_PROMPT
  list.push({
    id: 'dream_intrusion',
    title: 'Dream State Reflection Prompt',
    category: 'Dream State',
    categoryColor: 'indigo',
    icon: 'i-solar:moon-stars-bold-duotone',
    content: dreamIntrusion,
    isCustom: !!airiExt.value?.dreamState?.dreamIntrusionPrompt,
    description: 'Prompts the LLM during deep-sleep autonomous memory consolidation sessions.',
  })

  // 11. Proactive Heartbeat Prompt
  const heartbeatPrompt = airiExt.value?.heartbeats?.prompt || DEFAULT_HEARTBEATS_PROMPT
  list.push({
    id: 'heartbeat_prompt',
    title: 'Proactive Ambient Heartbeat Prompt',
    category: 'Sensory & Heartbeats',
    categoryColor: 'cyan',
    icon: 'i-solar:heart-pulse-bold-duotone',
    content: heartbeatPrompt,
    isCustom: !!airiExt.value?.heartbeats?.prompt,
    description: 'Evaluates ambient telemetry and OS state to initiate spontaneous messages.',
  })

  // 12. Custom Agent Prompts
  if (airiExt.value?.agents) {
    Object.entries(airiExt.value.agents).forEach(([agentKey, agentVal]) => {
      const agentObj = agentVal as any
      if (agentObj?.prompt) {
        list.push({
          id: `agent_${agentKey}`,
          title: `Agent Directive: ${agentKey}`,
          category: 'Subagents',
          categoryColor: 'violet',
          icon: 'i-solar:cpu-bolt-bold-duotone',
          content: agentObj.prompt,
          isCustom: true,
          description: `Custom subagent instructions configured for ${agentKey}.`,
        })
      }
    })
  }

  return list
})

// -------------------------------------------------------------
// TAB 3: Engine (Physical Model, Brain/LLM, Generation Limits, Tools, 2-hop, System 1, Artistry)
// -------------------------------------------------------------
const resolvedDisplayModel = computed(() => {
  const modelId = moduleSettings.value.displayModelId
  if (!modelId)
    return null
  return (displayModelsStore.displayModels || []).find((m: any) => m.id === modelId)
})

const generationEnabled = computed(() => airiExt.value?.generation?.enabled ?? false)
const generationMaxTokens = computed(() => airiExt.value?.generation?.known?.maxTokens ?? 'Default (Uncapped)')
const generationContextWidth = computed(() => {
  const width = airiExt.value?.generation?.known?.contextWidth
  return width ? `${width.toLocaleString()} tokens` : 'Default / Auto'
})
const generationReasoningFallback = computed(() => airiExt.value?.generation?.known?.reasoningFallback ?? true)

// Two-Hop Routing & System 1
const twoHopRoutingEnabled = computed(() => airiExt.value?.cognition?.enabled ?? false)
const firstHopProcessorLabel = computed(() => {
  const p = airiExt.value?.firstHopProcessor
  if (p === 'nan0')
    return 'Local Nan0 Engine'
  if (p === 'universe_rag')
    return 'Universe RAG++'
  return 'Default Inherited'
})

const tier1LocalReflexEnabled = computed(() => airiExt.value?.cognition?.triggers?.tier1LocalReflexEnabled ?? true)
const tier2JevChallengerEnabled = computed(() => airiExt.value?.cognition?.triggers?.tier2JevChallengerEnabled ?? true)

// Allowed Tools
const allowedToolsList = computed(() => {
  const tools = airiExt.value?.generation?.known?.allowedTools
  const hasTextJournal = tools === undefined || tools.includes('text_journal')
  const hasImageJournal = tools === undefined || tools.includes('image_journal')
  const hasWebSearch = tools !== undefined && (tools.includes('web_search') || tools.includes('mcp_web_search'))
  const hasFilesystem = tools !== undefined && (tools.includes('filesystem') || tools.includes('mcp_filesystem'))
  const hasMotion = tools !== undefined && tools.includes('generate_motion')
  const knownKeys = ['text_journal', 'image_journal', 'web_search', 'mcp_web_search', 'filesystem', 'mcp_filesystem', 'generate_motion']
  const customTools = (tools || []).filter(t => !knownKeys.includes(t))

  return [
    { id: 'text_journal', label: 'Sacred Text Journal', icon: 'i-solar:notebook-bold-duotone', enabled: hasTextJournal },
    { id: 'image_journal', label: 'Image Journal (Selfie & Art)', icon: 'i-solar:gallery-wide-bold-duotone', enabled: hasImageJournal },
    { id: 'web_search', label: 'Web Search Grounding', icon: 'i-solar:global-bold-duotone', enabled: hasWebSearch },
    { id: 'filesystem', label: 'Local Filesystem & Workspace', icon: 'i-solar:folder-with-files-bold-duotone', enabled: hasFilesystem },
    { id: 'generate_motion', label: 'Dynamic Motion Generator', icon: 'i-solar:running-bold-duotone', enabled: hasMotion },
    ...customTools.map(ct => ({ id: ct, label: ct, icon: 'i-solar:plug-circle-bold-duotone', enabled: true })),
  ]
})

// Autonomous Artistry (Director)
const artistryAutonomousEnabled = computed(() => airiExt.value?.artistry?.autonomousEnabled ?? false)
const artistryAutonomousThreshold = computed(() => airiExt.value?.artistry?.autonomousThreshold ?? 49)
const artistryAutonomousModelMode = computed(() => airiExt.value?.artistry?.autonomousModelMode === 'custom' ? 'Custom Provider & Model' : 'Inherit Consciousness')
const artistrySpawnMode = computed(() => {
  const mode = airiExt.value?.artistry?.spawnMode ?? 'bg'
  if (mode === 'widget')
    return 'Floating Widget Canvas'
  if (mode === 'inline')
    return 'Chat Inline Attachment'
  return 'Background Scene (bg)'
})
const artistryResolvedProvider = computed(() => airiExt.value?.artistry?.provider || defaultArtistryProvider.value)
const artistryResolvedModel = computed(() => airiExt.value?.artistry?.model || 'Default')

// -------------------------------------------------------------
// TAB 4: Proactivity (STMM, Dream State, Screen Watching, Heartbeats, Operating Schedule)
// -------------------------------------------------------------
const shortTermMemoryEnabled = computed(() => airiExt.value?.shortTermMemory ? (airiExt.value.shortTermMemory.enabled ?? true) : true)
const shortTermMemoryWindowSize = computed(() => airiExt.value?.shortTermMemory?.windowSize ?? 3)
const shortTermMemoryTokenBudget = computed(() => (airiExt.value?.shortTermMemory?.tokenBudgetPerDay ?? 1000).toLocaleString())

const dreamStateEnabled = computed(() => airiExt.value?.dreamState?.enabled ?? false)
const dreamStateThreshold = computed(() => airiExt.value?.dreamState?.journalingThreshold ?? 'balanced')
const dreamStateAfkThreshold = computed(() => airiExt.value?.dreamState?.afkThresholdMinutes ?? 5)
const dreamStateMaxSessions = computed(() => airiExt.value?.dreamState?.maxSessionsPerDay ?? 4)
const dreamStateMinTurns = computed(() => airiExt.value?.dreamState?.minConversationTurns ?? 4)
const dreamStateStrictAfk = computed(() => airiExt.value?.dreamState?.strictAfkGating ?? true)

const screenWatchingEnabled = computed(() => airiExt.value?.screenWatching?.enabled ?? false)
const screenWatchingDeliveryModeLabel = computed(() => {
  const mode = airiExt.value?.screenWatching?.deliveryMode ?? 'both'
  if (mode === 'both')
    return 'Voice & Subtitle Bubble'
  if (mode === 'bubble_only')
    return 'Bubble Only (Silent)'
  if (mode === 'tts_only')
    return 'Voice Only'
  if (mode === 'off')
    return 'Muted'
  return mode
})
const screenWatchingEnableVlm = computed(() => airiExt.value?.screenWatching?.enableVlm ?? false)
const screenWatchingVlmTier = computed(() => airiExt.value?.screenWatching?.vlmTier ?? 'lightweight')
const screenWatchingCaptureIntervalSec = computed(() => ((airiExt.value?.screenWatching?.captureIntervalMs ?? 2000) / 1000).toFixed(1))
const screenWatchingMaxPerHour = computed(() => airiExt.value?.screenWatching?.maxPerHour ?? 4)
const screenWatchingWorkload = computed(() => airiExt.value?.screenWatching?.workload ?? 'attention-guard')
const screenWatchingDeferWhileSpeaking = computed(() => airiExt.value?.screenWatching?.deferWhileSpeaking ?? true)

const heartbeatsEnabled = computed(() => airiExt.value?.heartbeats?.enabled ?? false)
const heartbeatsIntervalMinutes = computed(() => airiExt.value?.heartbeats?.intervalMinutes ?? 5)
const heartbeatsLocalGate = computed(() => airiExt.value?.heartbeats?.useAsLocalGate ?? true)
const heartbeatsWindowHistory = computed(() => airiExt.value?.heartbeats?.contextOptions?.windowHistory ?? true)
const heartbeatsSystemLoad = computed(() => airiExt.value?.heartbeats?.contextOptions?.systemLoad ?? true)
const heartbeatsUsageMetrics = computed(() => airiExt.value?.heartbeats?.contextOptions?.usageMetrics ?? true)

const scheduleStart = computed(() => airiExt.value?.heartbeats?.schedule?.start ?? '09:00')
const scheduleEnd = computed(() => airiExt.value?.heartbeats?.schedule?.end ?? '22:00')
const scheduleRespect = computed(() => airiExt.value?.heartbeats?.respectSchedule ?? true)
const schedulePauseWhenAfk = computed(() => airiExt.value?.heartbeats?.pauseWhenAfk ?? true)
const scheduleAfkThreshold = computed(() => airiExt.value?.heartbeats?.afkThresholdMinutes ?? 5)
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[9999] m-0 max-h-[92vh] max-w-6xl w-[94vw] flex flex-col overflow-hidden border border-neutral-200 rounded-xl bg-white p-4 shadow-xl 2xl:w-[60vw] lg:w-[80vw] md:w-[85vw] xl:w-[70vw] -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-800 sm:p-6">
        <div v-if="selectedCard" class="w-full flex flex-col gap-4">
          <!-- Header with status indicator -->
          <div flex="~ col" gap-3>
            <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div flex="~ row" items-center gap-2>
                  <DialogTitle text-2xl font-normal class="from-primary-500 to-primary-400 bg-gradient-to-r bg-clip-text text-transparent">
                    {{ selectedCard.name }}
                  </DialogTitle>
                </div>
                <div mt-1 text-sm text-neutral-500 dark:text-neutral-400>
                  v{{ selectedCard.version }}
                  <template v-if="selectedCard.creator">
                    · {{ t('settings.pages.card.created_by') }} <span font-medium>{{ selectedCard.creator }}</span>
                  </template>
                </div>
              </div>

              <!-- Action buttons -->
              <div flex="~ row" gap-2>
                <!-- Edit button -->
                <Button
                  variant="secondary"
                  icon="i-solar:pen-bold-duotone"
                  label="Edit"
                  @click="emit('edit', props.cardId)"
                />
                <!-- Activation button -->
                <Button
                  variant="primary"
                  :icon="isActive ? 'i-solar:check-circle-bold-duotone' : 'i-solar:play-circle-broken'"
                  :label="isActive ? t('settings.pages.card.active') : t('settings.pages.card.activate')"
                  :disabled="isActive"
                  :class="{ 'animate-pulse': isActivating }"
                  @click="handleActivate"
                />
              </div>
            </div>

            <!-- Single-row responsive tabs header -->
            <div class="mt-2 border-b border-neutral-200 dark:border-neutral-700">
              <div class="no-scrollbar w-full flex items-center justify-between gap-0.5 overflow-x-auto -mb-px sm:justify-start sm:gap-1">
                <button
                  v-for="tab in tabs"
                  :key="tab.id"
                  type="button"
                  class="flex flex-1 items-center justify-center gap-1 border-b-2 px-1.5 py-2 text-xs font-medium transition-colors sm:flex-initial sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm"
                  :class="[
                    activeTab === tab.id
                      ? 'text-primary-600 dark:text-primary-400 border-primary-500 dark:border-primary-400 font-semibold'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 border-transparent',
                  ]"
                  @click="activeTab = tab.id"
                >
                  <div :class="tab.icon" class="shrink-0 text-xs sm:text-sm" />
                  <span class="whitespace-nowrap">{{ tab.label }}</span>
                </button>
              </div>
            </div>

            <!-- Scrollable content area for active tab -->
            <div class="max-h-[66vh] flex flex-col gap-5 overflow-y-auto pr-1">
              <!-- ======================================================== -->
              <!-- TAB 1: CHARACTER & STAGING CONCEPTS                       -->
              <!-- ======================================================== -->
              <div v-if="activeTab === 'character'" class="flex flex-col gap-5">
                <!-- Preview System Prompt Action -->
                <div class="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="i-solar:notes-bold-duotone"
                    label="Preview Combined System Prompt"
                    @click="showContextPreview = true"
                  />
                </div>

                <!-- Description -->
                <div v-if="selectedCard.description" class="flex flex-col gap-1.5">
                  <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                    <div class="i-solar:align-left-linear text-sm text-primary-500" />
                    {{ t('settings.pages.card.description_label', 'Description') }}
                  </h2>
                  <div
                    class="whitespace-pre-line border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 text-neutral-700 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:text-neutral-300 dark:hover:bg-black/40"
                    v-html="highlightTagToHtml(selectedCard.description)"
                  />
                </div>

                <!-- Creator Notes -->
                <div v-if="selectedCard.notes" class="flex flex-col gap-1.5">
                  <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                    <div class="i-solar:notes-linear text-sm text-primary-500" />
                    {{ t('settings.pages.card.creator_notes', 'Creator Notes') }}
                  </h2>
                  <div
                    class="whitespace-pre-line border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 text-neutral-700 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:text-neutral-300 dark:hover:bg-black/40"
                    v-html="highlightTagToHtml(selectedCard.notes)"
                  />
                </div>

                <!-- Personality & Scenario -->
                <div v-if="selectedCard.personality" class="flex flex-col gap-1.5">
                  <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                    <div class="i-solar:user-heart-linear text-sm text-primary-500" />
                    Personality
                  </h2>
                  <div
                    class="whitespace-pre-line border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 text-neutral-700 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:text-neutral-300 dark:hover:bg-black/40"
                    v-html="highlightTagToHtml(selectedCard.personality)"
                  />
                </div>

                <div v-if="selectedCard.scenario" class="flex flex-col gap-1.5">
                  <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                    <div class="i-solar:map-linear text-sm text-primary-500" />
                    Scenario
                  </h2>
                  <div
                    class="whitespace-pre-line border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 text-neutral-700 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:text-neutral-300 dark:hover:bg-black/40"
                    v-html="highlightTagToHtml(selectedCard.scenario)"
                  />
                </div>

                <!-- Staging Concepts & Visual Assets -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:clapperboard-linear text-sm text-primary-500" />
                      Staging Concepts & Visual Assets
                    </h2>
                    <span class="border border-primary-500/20 rounded-full bg-primary-500/10 px-2 py-0.5 text-xs text-primary-600 font-medium dark:text-primary-400">
                      {{ conceptsList.length }} Concept{{ conceptsList.length === 1 ? '' : 's' }}
                    </span>
                  </div>

                  <div v-if="conceptsList.length > 0" class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div
                      v-for="concept in conceptsList"
                      :key="concept.key"
                      class="flex flex-col gap-2 border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:hover:bg-black/40"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="truncate text-sm text-neutral-800 font-semibold dark:text-neutral-200">
                          {{ concept.name }}
                        </span>
                        <div class="flex shrink-0 items-center gap-1.5">
                          <span
                            v-if="concept.isActive"
                            class="inline-flex items-center gap-1 border border-emerald-500/20 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-600 font-medium dark:text-emerald-400"
                          >
                            <div class="i-solar:check-circle-bold text-xs" />
                            Active in Stack
                          </span>
                          <span
                            class="inline-flex items-center border rounded-full px-2 py-0.5 text-[11px] font-medium"
                            :class="concept.isBase ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'"
                          >
                            {{ concept.isBase ? 'Base' : 'Layer' }}
                          </span>
                        </div>
                      </div>

                      <div v-if="concept.modelName" class="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <div class="i-solar:box-minimalistic-linear" />
                        <span class="truncate">Model: {{ concept.modelName }}</span>
                      </div>

                      <p v-if="concept.description" class="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">
                        {{ concept.description }}
                      </p>
                      <p v-else-if="concept.prompt" class="line-clamp-2 text-xs text-neutral-500 italic dark:text-neutral-400">
                        "{{ concept.prompt }}"
                      </p>
                    </div>
                  </div>

                  <div
                    v-else
                    class="border border-neutral-200/40 rounded-lg bg-neutral-50/50 p-4 text-center text-xs text-neutral-400 dark:border-neutral-800/40 dark:bg-neutral-900/30"
                  >
                    No Staging visual asset concepts configured on this card.
                  </div>
                </div>
              </div>

              <!-- ======================================================== -->
              <!-- TAB 2: DIRECTIVES (Inspect all hidden/runtime prompts)   -->
              <!-- ======================================================== -->
              <div v-if="activeTab === 'directives'" class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <p class="text-xs text-neutral-500 dark:text-neutral-400">
                    Inspect all character prompts, system directives, acting cues, and autonomous reflection instructions in one place.
                  </p>
                  <span class="shrink-0 border border-neutral-200 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 font-medium dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {{ directives.length }} Directives
                  </span>
                </div>

                <div class="flex flex-col gap-3.5">
                  <div
                    v-for="directive in directives"
                    :key="directive.id"
                    class="flex flex-col gap-2.5 border border-neutral-200/50 rounded-lg bg-white/60 p-3.5 transition-all duration-200 dark:border-neutral-700/30 dark:bg-black/30 hover:bg-white/80 dark:hover:bg-black/40"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <div :class="directive.icon" class="text-base text-primary-500" />
                        <span class="text-sm text-neutral-800 font-semibold dark:text-neutral-200">
                          {{ directive.title }}
                        </span>
                        <span class="border rounded-full px-2 py-0.5 text-[11px] font-medium" :class="directiveCategoryClass(directive.categoryColor)">
                          {{ directive.category }}
                        </span>
                        <span
                          class="border rounded-full px-2 py-0.5 text-[10px] font-medium"
                          :class="directive.isCustom ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20 font-semibold' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                        >
                          {{ directive.isCustom ? 'Custom' : 'Default' }}
                        </span>
                      </div>

                      <button
                        type="button"
                        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-600 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        @click="copyDirective(directive.id, directive.content)"
                      >
                        <div :class="copiedDirectiveId === directive.id ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:copy-linear'" />
                        <span>{{ copiedDirectiveId === directive.id ? 'Copied!' : 'Copy' }}</span>
                      </button>
                    </div>

                    <p class="text-xs text-neutral-500 dark:text-neutral-400">
                      {{ directive.description }}
                    </p>

                    <div
                      class="max-h-48 overflow-y-auto whitespace-pre-wrap border border-neutral-200/50 rounded-md bg-neutral-50/80 p-3 text-xs text-neutral-700 leading-relaxed font-mono dark:border-neutral-800/50 dark:bg-neutral-900/60 dark:text-neutral-300"
                      v-html="highlightTagToHtml(directive.content)"
                    />
                  </div>
                </div>
              </div>

              <!-- ======================================================== -->
              <!-- TAB 3: ENGINE (Modules, Limits, Reflexes, Tools, Artistry) -->
              <!-- ======================================================== -->
              <div v-if="activeTab === 'engine'" class="flex flex-col gap-5">
                <!-- 1. Core Model & Consciousness -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:cpu-bold-duotone text-sm text-primary-500" />
                      Core Vessel, Brain & Voice Modules
                    </h2>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <!-- Display Model (Vessel) -->
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:box-minimalistic-linear" />
                        Display Model (Vessel)
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ resolvedDisplayModel?.name || moduleSettings.displayModelId || 'Default Stage Model' }}
                      </span>
                    </div>

                    <!-- Brain / LLM -->
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-lucide:brain" />
                        Brain (LLM Model)
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ getModuleDisplayValue(moduleSettings.consciousness, defaultConsciousnessModel) }}
                      </span>
                      <span class="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        Provider: {{ getModuleDisplayValue(moduleSettings.consciousnessProvider, consciousnessProvider) }}
                      </span>
                    </div>

                    <!-- Voice / TTS -->
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-lucide:music" />
                        Speech Voice (TTS)
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ getModuleDisplayValue(moduleSettings.voice, defaultVoiceId) }}
                      </span>
                      <span class="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        {{ getModuleDisplayValue(moduleSettings.speech, defaultSpeechModel) }} · {{ getModuleDisplayValue(moduleSettings.speechProvider, speechProvider) }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 2. Generation Spec & Limits (No top-p!) -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:tuning-square-2-bold-duotone text-sm text-primary-500" />
                      Generation Limits & Tuning
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="generationEnabled ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ generationEnabled ? 'Character Overrides Enabled' : 'Inheriting Global Defaults' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:hashtag-square-linear" />
                        Max Output Tokens
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ generationMaxTokens }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:ruler-angular-linear" />
                        Context Width Limit
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ generationContextWidth }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:chat-round-dots-linear" />
                        Reasoning Speech Fallback
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="generationReasoningFallback ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        <div :class="generationReasoningFallback ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear'" />
                        {{ generationReasoningFallback ? 'Enabled' : 'Disabled' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 3. Cognitive Pipeline & System 1 Reflexes -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:route-bold-duotone text-sm text-primary-500" />
                      Cognitive Pipeline & System 1 Reflexes
                    </h2>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:route-linear" />
                        Two-Hop Routing Pipeline
                      </span>
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                          :class="twoHopRoutingEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                        >
                          <div :class="twoHopRoutingEnabled ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear'" />
                          {{ twoHopRoutingEnabled ? 'Active' : 'Disabled' }}
                        </span>
                        <span class="text-xs text-neutral-500 dark:text-neutral-400">
                          ({{ firstHopProcessorLabel }})
                        </span>
                      </div>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:flash-linear" />
                        Tier 1 Local Reflex
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="tier1LocalReflexEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        <div :class="tier1LocalReflexEnabled ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear'" />
                        {{ tier1LocalReflexEnabled ? 'Active' : 'Bypassed' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:target-linear" />
                        Tier 2 Jev Challenger
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="tier2JevChallengerEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        <div :class="tier2JevChallengerEnabled ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:close-circle-linear'" />
                        {{ tier2JevChallengerEnabled ? 'Active' : 'Bypassed' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 4. Allowed Tools & Capabilities -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:wrench-linear text-sm text-primary-500" />
                      Allowed Tools & Capabilities
                    </h2>
                  </div>

                  <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    <div
                      v-for="tool in allowedToolsList"
                      :key="tool.id"
                      class="flex items-center justify-between border border-neutral-200/50 rounded-lg bg-white/60 p-2.5 dark:border-neutral-700/30 dark:bg-black/30"
                    >
                      <div class="flex items-center gap-2 truncate pr-2">
                        <div :class="tool.icon" class="shrink-0 text-sm text-primary-500" />
                        <span class="truncate text-xs text-neutral-700 font-medium dark:text-neutral-200">
                          {{ tool.label }}
                        </span>
                      </div>
                      <span
                        class="shrink-0 border rounded-full px-1.5 py-0.2 text-[10px] font-semibold"
                        :class="tool.enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'"
                      >
                        {{ tool.enabled ? 'ON' : 'OFF' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 5. Autonomous Artistry (Director) -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:palette-bold-duotone text-sm text-primary-500" />
                      Autonomous Artistry (Director Engine)
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="artistryAutonomousEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ artistryAutonomousEnabled ? 'Autonomous Director Active' : 'Director Disabled' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:flame-linear" />
                        Trigger Threshold
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ artistryAutonomousThreshold }} points
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:monitor-camera-linear" />
                        Spawn Target Mode
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ artistrySpawnMode }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:gallery-linear" />
                        Art Backend & Model
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ artistryResolvedProvider }}
                      </span>
                      <span class="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        Model: {{ artistryResolvedModel }} · {{ artistryAutonomousModelMode }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ======================================================== -->
              <!-- TAB 4: PROACTIVITY (STMM, Dream, Screen, Heartbeats, etc.) -->
              <!-- ======================================================== -->
              <div v-if="activeTab === 'proactivity'" class="flex flex-col gap-5">
                <!-- 1. Short-Term Memory -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:calendar-date-bold-duotone text-sm text-primary-500" />
                      24-Hour Short-Term Memory Consolidation (STMM)
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="shortTermMemoryEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ shortTermMemoryEnabled ? 'Active' : 'Disabled' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:clock-circle-linear" />
                        Rolling Daily Window
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ shortTermMemoryWindowSize }} days
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="flex items-center gap-1.5 text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        <div class="i-solar:database-linear" />
                        Token Budget Per Day
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ shortTermMemoryTokenBudget }} tokens
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 2. Dream State -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:moon-stars-bold-duotone text-sm text-primary-500" />
                      Dream State (Autonomous Memory Consolidation)
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="dreamStateEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ dreamStateEnabled ? 'Enabled' : 'Disabled' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Richness / Threshold
                      </span>
                      <span class="text-sm text-neutral-800 font-medium capitalize dark:text-neutral-200">
                        {{ dreamStateThreshold }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Idle AFK Threshold
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ dreamStateAfkThreshold }} minutes
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Max Sessions / Day
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ dreamStateMaxSessions }} sessions
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Strict AFK Gating
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ dreamStateStrictAfk ? 'Enforced' : 'Relaxed' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Min Conversation Turns
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ dreamStateMinTurns }} turns
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 3. Screen Watching (Attention Ecology) -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:eye-scan-bold-duotone text-sm text-primary-500" />
                      Screen Watching (Attention Ecology & Perception Ticker)
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="screenWatchingEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ screenWatchingEnabled ? 'Active' : 'Disabled' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Delivery Mode
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ screenWatchingDeliveryModeLabel }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        VLM Interpretation
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="screenWatchingEnableVlm ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        {{ screenWatchingEnableVlm ? `Active (${screenWatchingVlmTier})` : 'Disabled' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Ticker Interval
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ screenWatchingCaptureIntervalSec }}s
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Max / Hour
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ screenWatchingMaxPerHour }}/hr
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Workload Policy
                      </span>
                      <span class="truncate text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ screenWatchingWorkload }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Speaking Guard
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="screenWatchingDeferWhileSpeaking ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        {{ screenWatchingDeferWhileSpeaking ? 'Defer While Speaking' : 'Continuous' }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- 4. Proactive Heartbeats -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:heart-pulse-bold-duotone text-sm text-primary-500" />
                      Proactive Heartbeats (Ambient Pull & Stealth Heartbeats)
                    </h2>
                    <span
                      class="border rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="heartbeatsEnabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                    >
                      {{ heartbeatsEnabled ? 'Active' : 'Disabled' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Pulse Interval
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        Every {{ heartbeatsIntervalMinutes }} minutes
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Local Attention Gate
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="heartbeatsLocalGate ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        {{ heartbeatsLocalGate ? 'Enabled' : 'Bypassed' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Context Telemetry Ingested
                      </span>
                      <div class="flex flex-wrap gap-1 text-[11px] text-neutral-600 dark:text-neutral-300">
                        <span v-if="heartbeatsWindowHistory" class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-700">Windows</span>
                        <span v-if="heartbeatsSystemLoad" class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-700">System Load</span>
                        <span v-if="heartbeatsUsageMetrics" class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-700">Metrics</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 5. Operating Schedule & Bedtime -->
                <div class="flex flex-col gap-2.5">
                  <div class="flex items-center justify-between border-b border-neutral-200/60 pb-1 dark:border-neutral-700/50">
                    <h2 class="flex items-center gap-1.5 text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                      <div class="i-solar:alarm-linear text-sm text-primary-500" />
                      Character Operating Schedule & Bedtime
                    </h2>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Operating Hours Window
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ scheduleStart }} — {{ scheduleEnd }}
                      </span>
                      <span class="text-[11px] text-neutral-400 dark:text-neutral-500">
                        {{ scheduleRespect ? 'Respects Bedtime Schedule' : 'Unrestricted 24h' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Pause While AFK
                      </span>
                      <span
                        class="w-fit inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs font-medium"
                        :class="schedulePauseWhenAfk ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400 border-neutral-500/20'"
                      >
                        {{ schedulePauseWhenAfk ? 'Enabled' : 'Disabled' }}
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 border border-neutral-200/50 rounded-lg bg-white/60 p-3 dark:border-neutral-700/30 dark:bg-black/30">
                      <span class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                        Inactivity Threshold
                      </span>
                      <span class="text-sm text-neutral-800 font-medium dark:text-neutral-200">
                        {{ scheduleAfkThreshold }} minutes
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ======================================================== -->
              <!-- TAB 5: GALLERY                                            -->
              <!-- ======================================================== -->
              <div v-if="activeTab === 'gallery'">
                <StageBackgroundPicker :card-id="cardId" />
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="border border-neutral-200/50 rounded-xl bg-neutral-50/50 p-8 text-center shadow-sm dark:border-neutral-700/30 dark:bg-neutral-900/50"
        >
          <div class="i-solar:card-search-broken mx-auto mb-3 text-6xl text-neutral-400" />
          {{ t('settings.pages.card.card_not_found') }}
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Delete confirmation dialog -->
  <DeleteCardDialog
    v-model="showDeleteConfirm"
    :card-name="selectedCard?.name"
    @confirm="handleDeleteConfirm"
    @cancel="showDeleteConfirm = false"
  />

  <CharacterContextDialog
    v-model="showContextPreview"
    :character-name="selectedCard?.name"
    :system-prompt="effectiveSystemPrompt"
  />
</template>
