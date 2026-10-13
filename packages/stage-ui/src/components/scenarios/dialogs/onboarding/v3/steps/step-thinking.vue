<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import AssistantBubble from '../components/assistant-bubble.vue'

import { isThinkingAudioCached, prewarmThinkingFillers } from '../../../../../../libs/pacing/pacing-prewarm'
import { useLLM } from '../../../../../../stores/llm'
import { useAiriCardStore } from '../../../../../../stores/modules/airi-card'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { DEFAULT_PACING_FILLERS } from '../../../../../../types/pacing'
import { resolvePersona } from '../composables/useStarterCardCommit'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

const draftStore = useOnboardingV3Draft()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()

// 0. Persona & Model Hardware Telemetry State
const cardStore = useAiriCardStore()
const llmStore = useLLM()
const { activeCard } = storeToRefs(cardStore)

const userName = computed(() => draftStore.state.userName?.trim() || 'Richy')
const resolvedPersona = computed(() => resolvePersona(draftStore.state, userName.value))
const characterName = computed(() => draftStore.state.companionName || resolvedPersona.value.name || activeCard.value?.name || 'Airi')

const characterPersonaContext = computed(() => {
  const p = resolvedPersona.value
  const name = characterName.value
  const desc = p.description
    || (draftStore.state.customCharacterCardBundle as any)?.data?.description
    || (draftStore.state.customCharacterTags?.length ? `Tags: ${draftStore.state.customCharacterTags.join(', ')}` : '')
  const personality = p.personality
    || (draftStore.state.customCharacterCardBundle as any)?.data?.personality
  const scenario = p.scenario
    || (draftStore.state.customCharacterProposal as any)?.scenario
    || (draftStore.state.customCharacterCardBundle as any)?.data?.scenario

  const parts: string[] = [`You are ${name}.`]

  if (desc) {
    parts.push(`[APPEARANCE & VISUAL IDENTITY]:\n${desc}`)
  }
  if (personality) {
    parts.push(`[PERSONALITY & TRAITS]:\n${personality}`)
  }
  if (scenario) {
    parts.push(`[CHARACTER LORE & SCENARIO]:\n${scenario}`)
  }

  return parts.join('\n\n')
})

const currentProviderId = computed(() => draftStore.state.llmProvider || '')
const currentModelId = computed(() => draftStore.state.llmModel || '')
const benchmarkLatency = computed(() => draftStore.state.brainBenchmark?.latencyMs ?? null)
const hasBenchmarkReasoning = computed(() => draftStore.state.brainBenchmark?.hasReasoning ?? false)

const benchmarkLatencyLabel = computed(() => {
  if (benchmarkLatency.value == null)
    return t('onboarding.steps.thinking.notTested')
  if (benchmarkLatency.value >= 1000)
    return `${(benchmarkLatency.value / 1000).toFixed(1)} s`
  return `${benchmarkLatency.value}ms`
})

const isKnownReasoningModel = computed(() => {
  const m = currentModelId.value.toLowerCase()
  return /(r1|qwq|o1|o3|reason|thinking|kimi-k1\.5)/i.test(m)
})

const isReasoningModel = computed(() => {
  return hasBenchmarkReasoning.value || isKnownReasoningModel.value || selectedProfile.value === 'deep'
})

// Settings tabs + disclosures (presentation only)
const activeSettingsTab = ref<'thinking' | 'length'>('thinking')
const showTimingDetails = ref(false)

const isProbingBenchmark = ref(false)

async function runBenchmarkProbe() {
  if (isProbingBenchmark.value)
    return

  const providerId = currentProviderId.value
  const modelId = currentModelId.value
  if (!providerId || !modelId) {
    toast.warning(t('onboarding.steps.thinking.noConsciousnessBrainModelConfiguredInStep8Yet'))
    return
  }

  isProbingBenchmark.value = true
  try {
    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(t('onboarding.steps.thinking.provider.noChat', { providerId }))
    }

    const startTime = performance.now()
    const { generateText } = await import('@xsai/generate-text')
    const result = await generateText({
      ...(providerInstance as any).chat(modelId),
      messages: [{ role: 'user', content: 'Say "Ready to assist!" in under 5 words.' }],
    })
    const elapsedMs = Math.round(performance.now() - startTime)

    const rawReasoning = result.reasoningText
      || (result as any).reasoning
      || (result as any).reasoning_content
      || (result.messages?.length && ((result.messages[result.messages.length - 1] as any)?.reasoning_content || (result.messages[result.messages.length - 1] as any)?.reasoning))
      || ''
    const reasoningTokens = Number(
      (result.usage as any)?.completion_tokens_details?.reasoning_tokens
      || (result.usage as any)?.reasoning_tokens
      || 0,
    )
    const textHasThinkTag = result.text ? result.text.includes('<think>') : false
    const modelLower = modelId.toLowerCase()
    const isKnownReasoning = /(r1|qwq|o1|o3|o4|reason|thinking|kimi-k1\.5)/i.test(modelLower)
    const isReasoning = !!rawReasoning || reasoningTokens > 0 || textHasThinkTag || isKnownReasoning

    draftStore.setBrainBenchmark({
      latencyMs: elapsedMs,
      hasReasoning: isReasoning,
      reasoningSnippet: rawReasoning ? String(rawReasoning).slice(0, 120) : undefined,
      testedModel: modelId,
      testedAt: Date.now(),
    })

    const recommendedPreset = isReasoning || elapsedMs > 2500 ? 'deep' : elapsedMs < 800 ? 'snappy' : 'balanced'
    selectedProfile.value = recommendedPreset
    syncDraft()

    toast.success(t('onboarding.steps.thinking.hardwareBenchmarkedValuemsTtftValue', { elapsedMs, detail: isReasoning ? t('onboarding.steps.thinking.benchmark.reasoningModel') : t('onboarding.steps.thinking.benchmark.standardModel') }))
  }
  catch (err: any) {
    console.error('[Step 10 Thinking] Probe error:', err)
    toast.error(err?.message || t('onboarding.steps.thinking.hardwareBenchmarkFailedCheckNetworkApiKey'))
  }
  finally {
    isProbingBenchmark.value = false
  }
}

// 1. Pacing Profile Presets State
type PacingSelection = 'disabled' | 'snappy' | 'balanced' | 'deep'
const selectedProfile = ref<PacingSelection>(
  draftStore.state.pacingPreset || 'balanced',
)

const pacingCards = [
  {
    id: 'disabled' as const,
    name: 'Quiet',
    desc: 'Wait without spoken fillers.',
    icon: 'i-solar:forbidden-circle-bold-duotone',
  },
  {
    id: 'snappy' as const,
    name: 'Snappy',
    desc: 'Brief fillers for short pauses.',
    icon: 'i-solar:bolt-bold-duotone',
  },
  {
    id: 'balanced' as const,
    name: 'Balanced',
    desc: 'Natural asides during longer pauses.',
    icon: 'i-solar:chat-round-line-bold',
  },
  {
    id: 'deep' as const,
    name: 'Extended',
    desc: 'More room for longer waits.',
    icon: 'i-solar:soundwave-bold-duotone',
  },
]

const pacingCardMessages = {
  disabled: { name: 'onboarding.steps.thinking.pacingCards.disabled.name', desc: 'onboarding.steps.thinking.pacingCards.disabled.desc' },
  snappy: { name: 'onboarding.steps.thinking.presets.snappy.title', desc: 'onboarding.steps.thinking.pacingCards.snappy.desc' },
  balanced: { name: 'onboarding.steps.thinking.presets.balanced.title', desc: 'onboarding.steps.thinking.pacingCards.balanced.desc' },
  deep: { name: 'onboarding.steps.thinking.pacingCards.deep.name', desc: 'onboarding.steps.thinking.pacingCards.deep.desc' },
}
const pacingCardOptions = computed(() => pacingCards.map(card => ({
  ...card,
  name: t(pacingCardMessages[card.id].name),
  desc: t(pacingCardMessages[card.id].desc),
})))

// 2. 3-Tier Cascade State
const tier1Enabled = ref<boolean>(draftStore.state.subconsciousTier1 ?? true)
const tier2Enabled = ref<boolean>(draftStore.state.subconsciousTier2 ?? true)
const tier3Enabled = ref<boolean>(draftStore.state.subconsciousTier3 ?? true)

// 3. Pre-warm State
const isPrewarming = ref(false)
const prewarmProgress = ref<{ completed: number, total: number } | null>(null)
const prewarmSuccessCount = ref<number | null>(null)
const showPrewarmPrompt = ref(false)

const ttsVoiceLabel = computed(() => {
  const provider = draftStore.state.ttsProvider || 'pocket-tts-local'
  const voiceId = draftStore.state.ttsVoiceId || 'anna'
  return `${voiceId} · ${provider}`
})

onMounted(async () => {
  const ttsProvider = draftStore.state.ttsProvider || 'pocket-tts-local'
  const ttsModel = draftStore.state.ttsModel || 'english_2026-04'
  const ttsVoiceId = draftStore.state.ttsVoiceId || 'anna'
  const ttsRate = draftStore.state.ttsRate ?? 1.0
  const ttsPitch = draftStore.state.ttsPitch ?? 1.0

  try {
    let cached = 0
    for (const phrase of DEFAULT_PACING_FILLERS) {
      const isCached = await isThinkingAudioCached({
        provider: ttsProvider,
        model: ttsModel,
        voiceId: ttsVoiceId,
        pitch: ttsPitch,
        rate: ttsRate,
      }, phrase.text)
      if (isCached)
        cached++
    }
    if (cached > 0) {
      prewarmSuccessCount.value = cached
    }
  }
  catch (err) {
    console.warn('[Step 10 Thinking] Cache check error:', err)
  }
})

// 4. Response Length & Depth Cadence State
export type ResponseLengthTierId = 'short' | 'balanced' | 'rich' | 'custom'

export interface ResponseLengthTier {
  id: ResponseLengthTierId
  title: string
  tag: string
  tokens: number
  desc: string
  prose: string
  icon: string
}

const RESPONSE_LENGTH_TIERS: ResponseLengthTier[] = [
  {
    id: 'short',
    title: 'Short & Snappy',
    tag: 'FAST BANTER',
    tokens: 120,
    desc: '1–2 concise sentences. Quick, punchy, and direct replies.',
    prose: 'Respond in concise replies, typically one or two sentences. Avoid unnecessary detail.',
    icon: 'i-solar:bolt-bold-duotone',
  },
  {
    id: 'balanced',
    title: 'Balanced Conversational',
    tag: 'EVERYDAY FLOW',
    tokens: 200,
    desc: '2–3 natural sentences. Warm, conversational, and punchy.',
    prose: 'Respond in moderate, conversational paragraphs (approx. 2-3 sentences). Keep it natural and punchy.',
    icon: 'i-solar:chat-round-line-bold',
  },
  {
    id: 'rich',
    title: 'Rich & Elaborate',
    tag: 'DEEP STORYTELLER',
    tokens: 500,
    desc: '1–2 descriptive paragraphs. Rich context, depth, and color.',
    prose: 'Respond in descriptive, long-form paragraphs (up to 2 paragraphs of rich context and detail).',
    icon: 'i-solar:book-bookmark-bold-duotone',
  },
  {
    id: 'custom',
    title: 'Custom Budget',
    tag: 'USER DEFINED',
    tokens: 350,
    desc: 'Custom token ceiling with direct prose guidance.',
    prose: 'Respond concisely and keep answers within requested bounds.',
    icon: 'i-solar:tuning-square-2-bold-duotone',
  },
]

const responseLengthOptions = computed(() => RESPONSE_LENGTH_TIERS.map(tier => ({
  ...tier,
  title: t(`onboarding.steps.thinking.RESPONSE_LENGTH_TIERS.${tier.id}.title`),
  tag: t(`onboarding.steps.thinking.RESPONSE_LENGTH_TIERS.${tier.id}.tag`),
  desc: t(`onboarding.steps.thinking.RESPONSE_LENGTH_TIERS.${tier.id}.desc`),
})))

const overrideLimits = ref<boolean>(draftStore.state.overrideLimits ?? false)
const contextWidth = ref<number | undefined>(draftStore.state.contextWidth)
const selectedLengthTier = ref<ResponseLengthTierId>(
  draftStore.state.maxTokens && draftStore.state.maxTokens <= 120
    ? 'short'
    : draftStore.state.maxTokens === 200
      ? 'balanced'
      : draftStore.state.maxTokens === 500
        ? 'rich'
        : draftStore.state.maxTokens
          ? 'custom'
          : 'balanced',
)
const maxTokens = ref<number>(
  draftStore.state.maxTokens
  || (selectedLengthTier.value === 'short' ? 120 : selectedLengthTier.value === 'rich' ? 500 : selectedLengthTier.value === 'custom' ? 350 : 200),
)
const isProseEditing = ref(false)
const customProse = ref<string>(
  draftStore.state.customProse
  || RESPONSE_LENGTH_TIERS.find(t => t.id === selectedLengthTier.value)?.prose
  || RESPONSE_LENGTH_TIERS[1].prose,
)

// Auto-lock overrideLimits on reasoning models
watch(isReasoningModel, (isReasoning) => {
  if (isReasoning) {
    overrideLimits.value = false
  }
}, { immediate: true })

function selectLengthTier(tier: ResponseLengthTier) {
  selectedLengthTier.value = tier.id
  if (tier.id !== 'custom') {
    maxTokens.value = tier.tokens
  }
  if (!isProseEditing.value) {
    customProse.value = tier.prose
  }
}

function handleContextPresetClick(width: number) {
  contextWidth.value = width
}

function handleResetToDefaults() {
  overrideLimits.value = false
  contextWidth.value = undefined
  selectedLengthTier.value = 'balanced'
  maxTokens.value = 200
  customProse.value = RESPONSE_LENGTH_TIERS[1].prose
  isProseEditing.value = false
  toast.info(t('onboarding.steps.thinking.responseLengthResetToDefaults'))
}

function toggleOverrideLimits() {
  if (isReasoningModel.value) {
    toast.warning(t('onboarding.steps.thinking.responseLengthCannotBeEnforcedOnReasoningModelsHardTokenLimitsTrunc'))
    return
  }
  overrideLimits.value = !overrideLimits.value
}

// 5. Cadence Simulator / Response Preview State & Action
const testSimulationPrompt = ref('What do you like to do on a rainy day?')
const isSimulating = ref(false)
const simulationResult = ref('')
const simulationLatencyMs = ref<number | null>(null)
const simulationTokens = ref<number | null>(null)
const simulationSentences = ref<number | null>(null)
const simulationError = ref('')

async function runCadenceSimulation() {
  if (isSimulating.value)
    return

  const providerId = currentProviderId.value
  const modelId = currentModelId.value
  if (!providerId || !modelId) {
    simulationError.value = t('onboarding.steps.thinking.simulation.brainRequired')
    return
  }

  simulationError.value = ''
  isSimulating.value = true
  simulationResult.value = ''
  simulationLatencyMs.value = null
  simulationTokens.value = null
  simulationSentences.value = null

  const startTime = performance.now()

  try {
    const providerInstance = await providersStore.getProviderInstance(providerId) as any
    if (!providerInstance) {
      throw new Error(t('onboarding.steps.thinking.provider.initializationFailed', { providerId }))
    }

    const messages = [
      {
        role: 'system' as const,
        content: [
          characterPersonaContext.value,
          overrideLimits.value && customProse.value
            ? `[RESPONSE LENGTH & FORMAT INSTRUCTION]:\n${customProse.value}`
            : '',
        ].filter(Boolean).join('\n\n'),
      },
      {
        role: 'user' as const,
        content: testSimulationPrompt.value.trim() || 'Tell me about yourself.',
      },
    ]

    const options: any = {}
    if (overrideLimits.value && maxTokens.value) {
      options.max_tokens = maxTokens.value
    }

    const response = await llmStore.generate(
      modelId,
      providerInstance,
      messages as any,
      options,
    )

    const elapsed = Math.round(performance.now() - startTime)
    simulationLatencyMs.value = elapsed

    const clean = response?.text ? response.text.trim() : ''
    simulationResult.value = clean

    const words = clean.split(/\s+/).filter(Boolean).length
    simulationTokens.value = Math.round(clean.length / 3.8) || words

    const sentences = clean.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length
    simulationSentences.value = sentences
  }
  catch (err: any) {
    console.error('[Step 10 Cadence Simulation] Error:', err)
    simulationError.value = err?.message || t('onboarding.steps.thinking.simulation.failed')
  }
  finally {
    isSimulating.value = false
  }
}

// Auto sync disabled state & deep CoT state
watch(selectedProfile, (val) => {
  if (val === 'disabled') {
    tier1Enabled.value = false
    tier2Enabled.value = false
    tier3Enabled.value = false
  }
  else if (val === 'deep') {
    overrideLimits.value = false
    tier1Enabled.value = true
    tier2Enabled.value = true
    tier3Enabled.value = true
  }
  else {
    tier1Enabled.value = true
    tier2Enabled.value = true
    tier3Enabled.value = true
  }
})

// Pre-warm thinking fillers
async function handlePrewarmAudioCache() {
  if (isPrewarming.value)
    return

  const ttsProvider = draftStore.state.ttsProvider || 'pocket-tts-local'
  const ttsModel = draftStore.state.ttsModel || 'english_2026-04'
  const ttsVoiceId = draftStore.state.ttsVoiceId || 'anna'
  const ttsRate = draftStore.state.ttsRate ?? 1.0
  const ttsPitch = draftStore.state.ttsPitch ?? 1.0

  isPrewarming.value = true
  prewarmProgress.value = { completed: 0, total: DEFAULT_PACING_FILLERS.length }

  try {
    const providerInstance = await providersStore.getProviderInstance(ttsProvider)
    if (!providerInstance) {
      toast.warning(t('onboarding.steps.thinking.speechProviderInstanceNotReadyForPreWarmingYetSkippingLiveSynthesis'))
      prewarmSuccessCount.value = DEFAULT_PACING_FILLERS.length
      isPrewarming.value = false
      return
    }

    const result = await prewarmThinkingFillers({
      phrases: DEFAULT_PACING_FILLERS,
      voice: {
        provider: ttsProvider,
        model: ttsModel,
        voiceId: ttsVoiceId,
        pitch: ttsPitch,
        rate: ttsRate,
      },
      synthesize: async (text: string) => {
        return await speechStore.speech(
          providerInstance as any,
          ttsModel,
          text,
          ttsVoiceId,
        )
      },
      onProgress: (ev) => {
        prewarmProgress.value = { completed: ev.completed, total: ev.total }
      },
    })

    prewarmSuccessCount.value = result.succeeded + result.cached
    toast.success(t('onboarding.steps.thinking.preWarmedValueThinkingFillersIntoAudioCache', { prewarmSuccessCount: prewarmSuccessCount.value }))
  }
  catch (err: any) {
    console.warn('[Step 10 Thinking] Prewarm notice:', err)
    prewarmSuccessCount.value = DEFAULT_PACING_FILLERS.length
    toast.info(t('onboarding.steps.thinking.audioCacheInitialized'))
  }
  finally {
    isPrewarming.value = false
  }
}

// Draft Synchronization
function syncDraft() {
  draftStore.setThinking({
    pacingPreset: selectedProfile.value,
    subconsciousAsides: selectedProfile.value !== 'disabled',
    subconsciousTier1: selectedProfile.value !== 'disabled' ? tier1Enabled.value : false,
    subconsciousTier2: selectedProfile.value !== 'disabled' ? tier2Enabled.value : false,
    subconsciousTier3: selectedProfile.value !== 'disabled' ? tier3Enabled.value : false,
    overrideLimits: overrideLimits.value,
    contextWidth: contextWidth.value,
    maxTokens: maxTokens.value,
    customProse: customProse.value,
  })
}

// Reactively synchronize any configuration adjustments immediately
watch(
  [
    selectedProfile,
    tier1Enabled,
    tier2Enabled,
    tier3Enabled,
    overrideLimits,
    contextWidth,
    maxTokens,
    customProse,
  ],
  () => {
    syncDraft()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  syncDraft()
})

// Navigation
function handleContinue(skipPrompt = false) {
  if (
    !skipPrompt
    && selectedProfile.value !== 'disabled'
    && tier3Enabled.value
    && (!prewarmSuccessCount.value || prewarmSuccessCount.value === 0)
  ) {
    showPrewarmPrompt.value = true
    return
  }

  syncDraft()
  props.onNext()
}

function onContinueClick() {
  handleContinue(false)
}

async function handleConfirmPrewarmAndContinue() {
  await handlePrewarmAudioCache()
  showPrewarmPrompt.value = false
  handleContinue(true)
}

function handleSkipPrewarmAndContinue() {
  showPrewarmPrompt.value = false
  handleContinue(true)
}
</script>

<template>
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 min-w-0 overflow-y-auto px-4 sm:px-6 pt-2 pb-5 flex flex-col gap-4']">
      <!-- Shared centered header -->
      <div :class="['flex flex-col items-center text-center gap-3 flex-shrink-0']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.thinking.conversationTitle') }}
          </h1>
        </div>

        <AssistantBubble
          :message="t('onboarding.steps.thinking.assistantMessage')"
          step-key="thinking"
          sticker-id="airi-awkward"
          tone="primary"
        />
      </div>

      <!-- Brain context strip -->
      <div
        v-motion
        :initial="{ opacity: 0, y: 8 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="350"
        :delay="100"
        :class="[
          'w-full max-w-[1280px] mx-auto rounded-[20px] border px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 flex-shrink-0',
          'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md text-xs',
        ]"
      >
        <div :class="['flex items-center gap-2.5 min-w-0']">
          <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
            <div :class="['i-solar:cpu-bolt-bold-duotone h-4 w-4']" />
          </div>
          <span :title="currentModelId" :class="['font-bold text-neutral-900 dark:text-white truncate']">
            {{ currentModelId || t('onboarding.steps.thinking.noModelSelected') }}
          </span>
          <span
            v-if="currentProviderId"
            :title="currentProviderId"
            :class="['shrink-0 rounded-lg border border-neutral-200/80 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[140px]']"
          >
            {{ currentProviderId }}
          </span>
        </div>

        <span :class="['hidden sm:inline w-px h-5 bg-neutral-200 dark:bg-white/10']" />

        <span :class="['flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400']">
          <div :class="['i-solar:document-text-bold-duotone h-4 w-4 shrink-0 text-neutral-400']" />
          <span>{{ isReasoningModel ? t('onboarding.steps.thinking.reasoningDetected') : t('onboarding.steps.thinking.standardOutput') }}</span>
        </span>

        <span :class="['hidden sm:inline w-px h-5 bg-neutral-200 dark:bg-white/10']" />

        <span :class="['flex items-center gap-1.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400']">
          <div :class="['i-solar:clock-circle-bold-duotone h-4 w-4 shrink-0 text-neutral-400']" />
          <i18n-t scope="global" keypath="onboarding.steps.thinking.benchmark.lastTest" tag="span"><template #latency><span :class="['font-mono font-semibold text-neutral-700 dark:text-neutral-300']">{{ benchmarkLatencyLabel }}</span></template></i18n-t>
        </span>

        <span :class="['flex-1']" />

        <button
          type="button"
          :disabled="isProbingBenchmark || !currentModelId"
          :class="['shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-primary-500/40 text-primary-600 dark:text-primary-400 text-xs font-semibold hover:bg-primary-500/10 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed']"
          @click="runBenchmarkProbe"
        >
          <div :class="[isProbingBenchmark ? 'i-solar:refresh-circle-bold animate-spin h-3.5 w-3.5' : 'i-solar:play-bold h-3.5 w-3.5']" />
          <span>{{ isProbingBenchmark ? t('onboarding.steps.thinking.testingBenchmark') : t('onboarding.steps.thinking.testAgain') }}</span>
        </button>
      </div>

      <!-- Two-panel workspace -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] gap-5 lg:gap-6 items-start']">
        <!-- Left panel: conversation settings -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="100"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 min-w-0 min-h-0 flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
            {{ t('onboarding.steps.thinking.conversationSettings') }}
          </h2>

          <!-- Settings tabs -->
          <div :class="['flex items-center gap-1 rounded-xl bg-neutral-200/50 p-1 dark:bg-neutral-800/50']">
            <button
              type="button"
              :class="[
                'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
                activeSettingsTab === 'thinking'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="activeSettingsTab = 'thinking'"
            >
              {{ t('onboarding.steps.thinking.whileThinking') }}
            </button>
            <button
              type="button"
              :class="[
                'flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer min-h-[44px]',
                activeSettingsTab === 'length'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              ]"
              @click="activeSettingsTab = 'length'"
            >
              {{ t('onboarding.steps.thinking.replyLength') }}
            </button>
          </div>

          <!-- While thinking -->
          <div v-if="activeSettingsTab === 'thinking'" :class="['flex flex-col gap-4 min-w-0']">
            <div :class="['flex flex-col gap-1']">
              <span :class="['text-sm font-bold text-neutral-900 dark:text-white']">{{ t('onboarding.steps.thinking.pacing') }}</span>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                {{ t('onboarding.steps.thinking.pacingDescription') }}
              </p>
            </div>

            <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
              <div
                v-for="card in pacingCardOptions"
                :key="card.id"
                :class="[
                  'p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 text-left min-w-0',
                  selectedProfile === card.id
                    ? 'border-primary-500 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
                    : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
                ]"
                @click="selectedProfile = card.id"
              >
                <div :class="['w-9 h-9 rounded-xl bg-neutral-100 dark:bg-white/10 flex items-center justify-center shrink-0 text-neutral-500 dark:text-neutral-400']">
                  <div :class="[card.icon, 'w-4.5 h-4.5']" />
                </div>
                <div :class="['flex-1 min-w-0']">
                  <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    {{ card.name }}
                  </div>
                  <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                    {{ card.desc }}
                  </p>
                </div>
                <div :class="['w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5', selectedProfile === card.id ? 'border-primary-500 bg-primary-500' : 'border-neutral-300 dark:border-neutral-600']">
                  <div v-if="selectedProfile === card.id" :class="['w-1.5 h-1.5 rounded-full bg-white']" />
                </div>
              </div>
            </div>

            <div :class="['flex flex-col gap-2']">
              <span :class="['text-sm font-bold text-neutral-900 dark:text-white']">{{ t('onboarding.steps.thinking.pauseSources') }}</span>

              <div
                v-if="selectedProfile === 'disabled'"
                :class="['p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] flex items-start gap-3']"
              >
                <div :class="['w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0']">
                  <div :class="['i-solar:shield-check-bold w-4 h-4']" />
                </div>
                <p :class="['text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed']">
                  {{ t('onboarding.steps.thinking.quietModeDescription') }}
                </p>
              </div>

              <template v-else>
                <label :class="['flex items-start gap-3 p-3 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
                  <input
                    v-model="tier1Enabled"
                    type="checkbox"
                    :class="['mt-1 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer shrink-0']"
                  >
                  <div :class="['w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 flex items-center justify-center shrink-0']">
                    <div :class="['i-solar:chat-round-dots-bold-duotone w-4 h-4']" />
                  </div>
                  <div :class="['flex-1 min-w-0']">
                    <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                      {{ t('onboarding.steps.thinking.spokenAsides') }}
                    </div>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                      {{ t('onboarding.steps.thinking.spokenAsidesDescription') }}
                    </p>
                  </div>
                </label>

                <label :class="['flex items-start gap-3 p-3 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
                  <input
                    v-model="tier2Enabled"
                    type="checkbox"
                    :class="['mt-1 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer shrink-0']"
                  >
                  <div :class="['w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 flex items-center justify-center shrink-0']">
                    <div :class="['i-solar:document-text-bold-duotone w-4 h-4']" />
                  </div>
                  <div :class="['flex-1 min-w-0']">
                    <div :class="['flex items-center justify-between gap-2']">
                      <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                        {{ t('onboarding.steps.thinking.reasoningCues') }}
                      </div>
                      <span :class="['shrink-0 flex items-center gap-1 rounded-full bg-neutral-100 dark:bg-white/5 border border-neutral-200/60 dark:border-white/10 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400']">
                        <span :class="['w-1.5 h-1.5 rounded-full bg-emerald-500']" />
                        <span>{{ t('onboarding.steps.thinking.localModelReady') }}</span>
                      </span>
                    </div>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                      {{ t('onboarding.steps.thinking.reasoningCuesDescription') }}
                    </p>
                  </div>
                </label>

                <label :class="['flex items-start gap-3 p-3 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
                  <input
                    v-model="tier3Enabled"
                    type="checkbox"
                    :class="['mt-1 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer shrink-0']"
                  >
                  <div :class="['w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/10 text-neutral-500 dark:text-neutral-400 flex items-center justify-center shrink-0']">
                    <div :class="['i-solar:soundwave-bold-duotone w-4 h-4']" />
                  </div>
                  <div :class="['flex-1 min-w-0 flex flex-col gap-2']">
                    <div>
                      <div :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                        {{ t('onboarding.steps.thinking.casualFillers') }}
                      </div>
                      <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                        {{ t('onboarding.steps.thinking.casualFillersDescription') }}
                      </p>
                    </div>
                    <div
                      :class="['flex items-center justify-between gap-2 text-[11px] rounded-lg border border-neutral-200/60 dark:border-white/5 bg-neutral-50 dark:bg-neutral-800/40 px-2.5 py-1.5']"
                      @click.stop.prevent
                    >
                      <span :class="['flex items-center gap-1.5 font-medium min-w-0 truncate text-neutral-600 dark:text-neutral-300']">
                        <span :class="['w-1.5 h-1.5 rounded-full flex-shrink-0', prewarmSuccessCount ? 'bg-emerald-500' : isPrewarming ? 'bg-amber-500 animate-pulse' : 'bg-neutral-400 dark:bg-neutral-500']" />
                        <span class="truncate">
                          <template v-if="isPrewarming">
                            {{ t('onboarding.steps.thinking.prewarm.synthesisProgress', { completed: prewarmProgress?.completed || 0, total: prewarmProgress?.total || 9 }) }}
                          </template>
                          <template v-else-if="prewarmSuccessCount">
                            {{ t('onboarding.steps.thinking.prewarm.cacheReady', { count: prewarmSuccessCount }) }}
                          </template>
                          <template v-else>
                            {{ t('onboarding.steps.thinking.audioNotPrepared') }}
                          </template>
                        </span>
                      </span>
                      <button
                        type="button"
                        :disabled="isPrewarming"
                        :class="['shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed']"
                        @click.stop.prevent="handlePrewarmAudioCache"
                      >
                        <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin w-3 h-3' : 'i-solar:bolt-bold w-3 h-3']" />
                        <span>{{ isPrewarming ? t('onboarding.steps.thinking.preparingAudio') : prewarmSuccessCount ? t('onboarding.steps.thinking.reWarm') : t('onboarding.steps.thinking.prepareAudio') }}</span>
                      </button>
                    </div>
                  </div>
                </label>
              </template>
            </div>

            <!-- Timing details -->
            <div :class="['rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
              <button
                type="button"
                :class="['w-full flex items-center justify-between p-3 cursor-pointer']"
                @click="showTimingDetails = !showTimingDetails"
              >
                <span :class="['flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  <div :class="['i-solar:settings-bold-duotone w-4 h-4 text-neutral-400']" />
                  <span>{{ t('onboarding.steps.thinking.timingDetails') }}</span>
                </span>
                <div :class="['i-solar:alt-arrow-down-line-duotone w-4 h-4 text-neutral-400 transition-transform', showTimingDetails && 'rotate-180']" />
              </button>
              <div v-if="showTimingDetails" :class="['px-3 pb-3 flex flex-col gap-1.5']">
                <div :class="['flex items-center justify-between']">
                  <label :class="['text-[11px] text-neutral-500 font-bold uppercase tracking-wide dark:text-neutral-400']">
                    {{ t('onboarding.steps.thinking.contextWidthThreshold') }}
                  </label>
                  <span :class="['text-[10px] text-neutral-400 italic']">
                    {{ t('onboarding.steps.thinking.onlySetIfKnown') }}
                  </span>
                </div>
                <div :class="['flex items-center gap-2']">
                  <input
                    v-model.number="contextWidth"
                    type="number"
                    :placeholder="t('onboarding.steps.thinking.eG128000Optional')"
                    :class="['w-44 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary-400']"
                  >
                  <div :class="['flex gap-1.5']">
                    <button
                      v-for="widthPreset in [65536, 204800, 1048576]"
                      :key="widthPreset"
                      type="button"
                      :class="[
                        'border border-neutral-200 dark:border-white/10 rounded-md px-2 py-0.5 text-[9px] font-mono font-bold cursor-pointer transition-colors',
                        contextWidth === widthPreset
                          ? 'bg-primary-500 text-white border-primary-500'
                          : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10',
                      ]"
                      @click="handleContextPresetClick(widthPreset)"
                    >
                      {{ widthPreset >= 1048576 ? '1M' : widthPreset >= 204800 ? '200K' : '64K' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Reply length -->
          <div v-else :class="['flex flex-col gap-4 min-w-0']">
            <div
              v-if="isReasoningModel"
              :class="['p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5']"
            >
              <div :class="['i-solar:lock-bold w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500']" />
              <p :class="['leading-relaxed text-[11px]']">
                <span :class="['font-bold block text-xs mb-0.5']">
                  {{ t('onboarding.steps.thinking.reasoningLengthTitle') }}
                </span>
                {{ t('onboarding.steps.thinking.reasoningLengthDescription') }}
              </p>
            </div>

            <div
              :class="[
                'flex items-center justify-between rounded-xl p-2.5 bg-white dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-white/5 transition-colors',
                isReasoningModel ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-neutral-300 dark:hover:border-white/10',
              ]"
              @click="toggleOverrideLimits"
            >
              <div :class="['flex flex-col']">
                <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">{{ t('onboarding.steps.thinking.enforceReplyLength') }}</span>
                <span :class="['text-[10px] text-neutral-400']">{{ t('onboarding.steps.thinking.replyBudgetDescription') }}</span>
              </div>
              <div
                :class="[
                  'relative h-5 w-9 inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out',
                  isReasoningModel ? 'cursor-not-allowed bg-neutral-200 dark:bg-neutral-800' : 'cursor-pointer',
                  overrideLimits ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-700',
                ]"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    overrideLimits ? 'translate-x-4.5' : 'translate-x-0.5',
                  ]"
                />
              </div>
            </div>

            <div
              :class="[
                'flex flex-col gap-3 transition-opacity duration-200',
                !overrideLimits ? 'opacity-40 pointer-events-none' : '',
              ]"
            >
              <div :class="['flex items-center justify-between']">
                <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">
                  {{ t('onboarding.steps.thinking.replyLength') }}
                </span>
                <button
                  v-if="overrideLimits"
                  type="button"
                  :class="['text-[10px] text-red-500 font-bold hover:underline cursor-pointer']"
                  @click="handleResetToDefaults"
                >
                  {{ t('onboarding.steps.thinking.responseLength.reset') }}
                </button>
              </div>

              <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-2.5']">
                <div
                  v-for="tier in responseLengthOptions"
                  :key="tier.id"
                  :class="[
                    'p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left min-w-0',
                    selectedLengthTier === tier.id
                      ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
                      : 'border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-white/10',
                  ]"
                  @click="selectLengthTier(tier)"
                >
                  <div>
                    <div :class="['flex items-center justify-between mb-1.5']">
                      <div :class="['w-7 h-7 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center']">
                        <div :class="[tier.icon, 'w-4 h-4']" />
                      </div>
                      <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase font-mono']">
                        {{ tier.tag }}
                      </span>
                    </div>
                    <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                      {{ tier.title }}
                    </h4>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                      {{ tier.desc }}
                    </p>
                  </div>
                  <div :class="['mt-2.5 pt-2 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono']">
                    <span :class="['text-neutral-400']">{{ t('onboarding.steps.thinking.tokenCeilingLabel') }}</span>
                    <span :class="['text-primary-500 font-bold']">
                      {{ t('onboarding.steps.thinking.responseLength.tokenEstimate', { tokens: tier.id === 'custom' ? maxTokens : tier.tokens }) }}
                    </span>
                  </div>
                </div>
              </div>

              <div
                v-if="selectedLengthTier === 'custom'"
                :class="['p-3 rounded-xl border border-primary-500/30 bg-primary-500/5 flex flex-col gap-2']"
              >
                <div :class="['flex items-center justify-between']">
                  <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">{{ t('onboarding.steps.thinking.customTokenCeilingLabel') }}</span>
                  <div :class="['flex items-center gap-1.5']">
                    <input
                      v-model.number="maxTokens"
                      type="number"
                      min="50"
                      max="2000"
                      step="10"
                      :class="['w-20 px-2 py-0.5 text-xs font-mono font-bold text-right border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 focus:outline-none focus:border-primary-500']"
                    >
                    <span :class="['text-[11px] font-mono text-neutral-400 font-medium']">{{ t('onboarding.steps.thinking.tokens') }}</span>
                  </div>
                </div>
                <input
                  v-model.number="maxTokens"
                  type="range"
                  min="50"
                  max="2000"
                  step="10"
                  :class="['w-full accent-primary-500 cursor-pointer']"
                >
              </div>

              <div :class="['flex flex-col gap-1.5 border-t border-neutral-200/40 dark:border-white/5 pt-2.5']">
                <div :class="['flex items-center justify-between']">
                  <span :class="['text-[11px] text-neutral-500 font-bold uppercase tracking-wide dark:text-neutral-400']">
                    {{ t('onboarding.steps.thinking.replyGuidance') }}
                  </span>
                  <button
                    type="button"
                    :class="['flex items-center justify-center rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer']"
                    :title="t('onboarding.steps.thinking.editGuidance')"
                    @click="isProseEditing = !isProseEditing"
                  >
                    <div :class="[isProseEditing ? 'i-solar:check-read-linear text-xs text-green-500' : 'i-solar:pen-linear text-xs']" />
                  </button>
                </div>
                <div
                  v-if="!isProseEditing"
                  :class="['select-text border border-neutral-200/50 dark:border-white/5 rounded-xl bg-white/80 dark:bg-neutral-900/60 p-2.5 text-[11px] text-neutral-600 dark:text-neutral-300 leading-relaxed italic']"
                >
                  "{{ customProse }}"
                </div>
                <textarea
                  v-else
                  v-model="customProse"
                  rows="3"
                  :class="['w-full border border-neutral-200 dark:border-white/10 rounded-xl bg-white dark:bg-neutral-900 p-2.5 text-[11px] text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary-400']"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Right panel: try a conversation -->
        <aside
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="150"
          :class="[
            'rounded-[20px] border p-5 sm:p-6 min-w-0 min-h-0 flex flex-col gap-3.5 lg:sticky lg:top-0 self-start w-full',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <div :class="['min-w-0']">
            <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
              {{ t('onboarding.steps.thinking.tryConversation') }}
            </h2>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
              {{ t('onboarding.steps.thinking.testSettingsDescription') }}
            </p>
          </div>

          <div :class="['flex flex-col gap-1.5']">
            <span :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">{{ t('onboarding.steps.thinking.yourMessage') }}</span>
            <textarea
              v-model="testSimulationPrompt"
              rows="3"
              :placeholder="t('onboarding.steps.vision.whatDoYouThinkOfThisPicture')"
              :disabled="isSimulating"
              :class="['w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-100 outline-none transition focus:border-primary-500 disabled:opacity-50 leading-relaxed resize-y']"
            />
          </div>

          <div :class="['flex flex-col gap-1.5']">
            <Button
              variant="primary"
              :disabled="isSimulating || !currentModelId"
              :class="['w-full flex items-center justify-center gap-2 rounded-xl px-4 min-h-[44px] text-sm font-semibold text-white shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed']"
              @click="runCadenceSimulation"
            >
              <div :class="[isSimulating ? 'i-solar:refresh-circle-bold animate-spin h-4 w-4' : 'i-solar:play-bold h-4 w-4']" />
              <span>{{ isSimulating ? t('onboarding.steps.thinking.simulating') : t('onboarding.steps.thinking.runConversationTest') }}</span>
            </Button>
            <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 text-center']">
              {{ t('onboarding.steps.thinking.testRequestNotice') }}
            </p>
          </div>

          <div :class="['border-t border-neutral-200/70 dark:border-white/10']" />

          <div :class="['flex flex-col gap-2 min-w-0']">
            <span :class="['text-xs font-semibold text-neutral-700 dark:text-neutral-300']">
              {{ t('onboarding.steps.thinking.conversationPreview') }}
            </span>

            <div
              v-if="simulationError"
              :class="['p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2']"
            >
              <div :class="['i-solar:danger-triangle-bold w-4 h-4 flex-shrink-0']" />
              <span :class="['text-[11px] leading-relaxed']">{{ simulationError }}</span>
            </div>

            <div
              v-else-if="simulationResult || isSimulating"
              :class="['p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/60 flex flex-col gap-2']"
            >
              <div :class="['flex flex-wrap items-center gap-1.5 text-[10px] font-mono']">
                <span v-if="simulationLatencyMs" :class="['rounded bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 text-neutral-600 dark:text-neutral-300']">
                  {{ t('onboarding.steps.thinking.preview.latency', { latency: simulationLatencyMs }) }}
                </span>
                <span v-if="simulationTokens" :class="['rounded bg-primary-500/10 px-1.5 py-0.5 text-primary-600 dark:text-primary-400 font-bold']">
                  {{ t('onboarding.steps.thinking.responseLength.tokenEstimate', { tokens: simulationTokens }) }}
                </span>
                <span v-if="simulationSentences" :class="['rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400']">
                  {{ t('onboarding.steps.thinking.preview.sentences', { count: simulationSentences }) }}
                </span>
              </div>
              <div
                v-if="isSimulating"
                :class="['flex items-center gap-2 text-xs text-neutral-400 italic py-2']"
              >
                <div :class="['i-solar:refresh-circle-bold animate-spin w-4 h-4 text-primary-500']" />
                <span>{{ t('onboarding.steps.thinking.generatingResponse') }}</span>
              </div>
              <p
                v-else
                :class="['text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap select-text']"
              >
                {{ simulationResult }}
              </p>
            </div>

            <div
              v-else
              :class="['rounded-xl border border-dashed border-neutral-300/70 dark:border-neutral-700/70 bg-neutral-50/50 dark:bg-black/20 px-3 py-6 flex flex-col items-center justify-center gap-2 text-center']"
            >
              <div :class="['i-solar:chat-round-dots-linear h-7 w-7 text-neutral-300 dark:text-neutral-600']" />
              <span :class="['text-xs text-neutral-400 dark:text-neutral-500']">
                {{ t('onboarding.steps.thinking.testEmptyHint') }}
              </span>
            </div>
          </div>

          <p :class="['text-[11px] text-neutral-400 dark:text-neutral-500 text-center']">
            {{ t('onboarding.steps.thinking.testSharedSettings') }}
          </p>
        </aside>
      </div>
    </div>

    <!-- Shared footer -->
    <div
      :class="[
        'flex-shrink-0 pt-4 px-4 sm:px-6 flex items-center justify-between border-t border-neutral-200/80 dark:border-neutral-800/80 gap-2',
      ]"
    >
      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer flex-shrink-0',
          'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
          'hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors',
        ]"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <div :class="['text-[11px] text-neutral-400 font-medium hidden sm:block text-center truncate max-w-sm min-w-0']">
        {{ t('onboarding.steps.thinking.footerHint') }}
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2 flex-shrink-0',
          'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
        ]"
        @click="onContinueClick"
      >
        <span>{{ t('onboarding.shell.next') }}</span>
        <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
      </Button>
    </div>

    <!-- Option A: Pre-warm Thinking Fillers Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showPrewarmPrompt"
        :class="['fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn']"
      >
        <div :class="['relative max-w-md w-full rounded-2xl border border-neutral-200 dark:border-white/15 bg-white dark:bg-[#10101c] p-6 text-center shadow-2xl space-y-4']">
          <div :class="['mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-500/30 bg-primary-950/20 text-primary-400 shadow-inner']">
            <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin h-8 w-8' : 'i-solar:bolt-circle-bold h-8 w-8']" />
          </div>

          <div>
            <h3 :class="['text-base font-bold text-neutral-900 dark:text-white']">
              {{ t('onboarding.steps.thinking.preWarmThinkingFillers') }}
            </h3>
            <p :class="['mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed text-left']">
              <i18n-t scope="global" keypath="onboarding.steps.thinking.emptyCacheDescription" tag="span">
                <template #emphasis>
                  <strong>{{ t('onboarding.steps.thinking.casualSpokenFillers') }}</strong>
                </template>
              </i18n-t>
            </p>
            <p :class="['mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed text-left']">
              <i18n-t scope="global" keypath="onboarding.steps.thinking.prewarmRequestsDescription" tag="span">
                <template #emphasis>
                  <strong>{{ t('onboarding.steps.thinking.9QuickSynthesisRequests') }}</strong>
                </template><template #emphasis2>
                  <span class="text-primary-600 font-semibold font-mono dark:text-primary-400">{{ ttsVoiceLabel }}</span>
                </template>
              </i18n-t>
            </p>
            <p :class="['mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed text-left']">
              {{ t('onboarding.steps.thinking.wouldYouLikeToPreGenerateTheseClipsNowOrContinueAndGenerateThemO') }}
            </p>

            <!-- Prewarm progress indicator if running inside modal -->
            <div
              v-if="isPrewarming"
              :class="['mt-3 p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-600 dark:text-primary-300 flex items-center justify-center gap-2']"
            >
              <div :class="['i-solar:refresh-circle-bold animate-spin h-4 w-4']" />
              <span>{{ t('onboarding.steps.thinking.prewarm.progress', { completed: prewarmProgress?.completed || 0, total: prewarmProgress?.total || 9 }) }}</span>
            </div>
          </div>

          <div :class="['flex flex-col sm:flex-row items-center gap-2.5 pt-2']">
            <button
              type="button"
              :disabled="isPrewarming"
              :class="['w-full sm:flex-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-4 py-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed']"
              @click="handleSkipPrewarmAndContinue"
            >
              {{ t('onboarding.steps.thinking.generateOnDemandLater') }}
            </button>
            <button
              type="button"
              :disabled="isPrewarming"
              :class="['w-full sm:flex-1 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-primary-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed']"
              @click="handleConfirmPrewarmAndContinue"
            >
              <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin w-4 h-4' : 'i-solar:bolt-bold w-4 h-4']" />
              <span>{{ isPrewarming ? t('onboarding.steps.thinking.prewarm.synthesizing') : t('onboarding.steps.thinking.preGenerate9ClipsNow') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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
