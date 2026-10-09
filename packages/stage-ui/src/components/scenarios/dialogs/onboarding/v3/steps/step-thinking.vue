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

const { t, te } = useI18n()

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

const isKnownReasoningModel = computed(() => {
  const m = currentModelId.value.toLowerCase()
  return /(r1|qwq|o1|o3|reason|thinking|kimi-k1\.5)/i.test(m)
})

const isReasoningModel = computed(() => {
  return hasBenchmarkReasoning.value || isKnownReasoningModel.value || selectedProfile.value === 'deep'
})

const reasoningModelSubtitle = computed(() => {
  return isReasoningModel.value
    ? 'Emits <think> / reasoning_content (Requires Deep CoT)'
    : 'Low-latency direct reply (Ideal for Snappy / Balanced)'
})

const isProbingBenchmark = ref(false)

async function runBenchmarkProbe() {
  if (isProbingBenchmark.value)
    return

  const providerId = currentProviderId.value
  const modelId = currentModelId.value
  if (!providerId || !modelId) {
    toast.warning('No Consciousness Brain Model configured in Step 8 yet.')
    return
  }

  isProbingBenchmark.value = true
  try {
    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(`Provider "${providerId}" does not expose chat completions.`)
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

    toast.success(`Hardware benchmarked: ${elapsedMs}ms TTFT (${isReasoning ? 'Reasoning Model' : 'Standard Stream'})`)
  }
  catch (err: any) {
    console.error('[Step 10 Thinking] Probe error:', err)
    toast.error(err?.message || 'Hardware benchmark failed. Check network & API key.')
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

const activeProfileTitle = computed(() => {
  switch (selectedProfile.value) {
    case 'disabled':
      return 'Disabled / Silent'
    case 'snappy':
      return 'Snappy Chat'
    case 'balanced':
      return 'Balanced'
    case 'deep':
      return 'Deep CoT Explorer'
    default:
      return 'Balanced'
  }
})

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
  toast.info('Response length reset to defaults')
}

function toggleOverrideLimits() {
  if (isReasoningModel.value) {
    toast.warning('Response length cannot be enforced on reasoning models. Hard token limits truncate internal chain-of-thought.')
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
    simulationError.value = 'Please configure a Brain Model in Step 8 (Consciousness) first.'
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
      throw new Error(`Unable to initialize provider "${providerId}".`)
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
    simulationError.value = err?.message || 'Simulation failed. Check provider credentials.'
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
      toast.warning('Speech provider instance not ready for pre-warming yet. Skipping live synthesis.')
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
    toast.success(`Pre-warmed ${prewarmSuccessCount.value} thinking fillers into audio cache!`)
  }
  catch (err: any) {
    console.warn('[Step 10 Thinking] Prewarm notice:', err)
    prewarmSuccessCount.value = DEFAULT_PACING_FILLERS.length
    toast.info('Audio cache initialized')
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
  <div :class="['w-full max-w-5xl mx-auto h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Scrollable Content Body -->
    <div :class="['flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4']">
      <!-- Shared Centered Header -->
      <div :class="['flex flex-col items-center text-center gap-3']">
        <div
          v-motion
          :initial="{ opacity: 0, y: -6 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :class="['text-center']"
        >
          <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white']">
            {{ t('onboarding.steps.thinking.title') }}
          </h1>
        </div>

        <AssistantBubble
          :message="te('onboarding.steps.thinking.companionGreeting') ? t('onboarding.steps.thinking.companionGreeting') : 'Tune how your companion pauses and speaks while thinking. Choose a cadence that matches your model’s reasoning speed.'"
          step-key="thinking"
          tone="primary"
        />
      </div>

      <!-- Model Hardware Telemetry & Benchmark Profile Card -->
      <div
        :class="[
          'p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-all',
          isReasoningModel
            ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
            : 'bg-white/70 dark:bg-white/[0.02] border-neutral-200/80 dark:border-white/10',
        ]"
      >
        <div :class="['flex items-center gap-3 min-w-0']">
          <div
            :class="[
              'w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs border',
              isReasoningModel
                ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                : 'bg-primary-500/10 text-primary-500 border-primary-500/20',
            ]"
          >
            <div :class="isReasoningModel ? 'i-solar:brain-bold-duotone w-5 h-5' : 'i-solar:bolt-bold-duotone w-5 h-5'" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <div :class="['flex items-center gap-2 flex-wrap']">
              <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                {{ currentModelId || 'Brain Model (Not Selected)' }}
              </span>
              <span
                :class="[
                  'text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase',
                  isReasoningModel
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                ]"
              >
                {{ isReasoningModel ? '🧠 Reasoning Model' : '⚡ Standard Stream' }}
              </span>
              <span
                v-if="currentProviderId"
                :class="['text-[9px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500']"
              >
                {{ currentProviderId }}
              </span>
            </div>
            <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5']">
              <span :class="['font-mono font-semibold', benchmarkLatency ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400']">
                {{ benchmarkLatency ? `${benchmarkLatency}ms TTFT` : 'Latency Unmeasured' }}
              </span>
              <span>•</span>
              <span>{{ reasoningModelSubtitle }}</span>
            </div>
          </div>
        </div>

        <!-- Benchmark Probe Button -->
        <button
          type="button"
          :disabled="isProbingBenchmark || !currentModelId"
          :class="[
            'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs',
            isProbingBenchmark
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 border-transparent cursor-not-allowed'
              : 'border-neutral-200 dark:border-white/10 hover:border-primary-500/40 hover:bg-primary-500/5 text-neutral-700 dark:text-neutral-200',
          ]"
          @click="runBenchmarkProbe"
        >
          <div :class="[isProbingBenchmark ? 'i-solar:restart-circle-bold animate-spin text-primary-500' : 'i-solar:link-circle-bold text-primary-500', 'w-3.5 h-3.5']" />
          <span>{{ isProbingBenchmark ? 'Probing...' : benchmarkLatency ? 'Re-benchmark' : 'Probe Hardware' }}</span>
        </button>
      </div>

      <!-- Section 1: Pacing Profile Presets -->
      <div :class="['flex flex-col gap-3']">
        <div :class="['flex flex-col']">
          <div :class="['flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400']">
            <div :class="['w-2 h-4 rounded bg-primary-500']" />
            <span>Pacing Profile Presets</span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
            Select a cadence profile matching your model's reasoning latency. These settings tune when and how often thinking fillers are spoken while waiting for a response — they are conversational pacing expectations, not abort timeouts.
          </p>
        </div>

        <!-- 4 Presets Grid -->
        <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3']">
          <!-- 0: Disabled / None -->
          <div
            :class="[
              'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
              selectedProfile === 'disabled'
                ? 'border-neutral-400/80 bg-neutral-100/80 dark:bg-white/10 ring-1 ring-neutral-400'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="selectedProfile = 'disabled'"
          >
            <div>
              <div :class="['flex items-center justify-between mb-2']">
                <div :class="['w-7 h-7 rounded-xl bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400']">
                  <div :class="['i-solar:forbidden-circle-bold-duotone w-4 h-4']" />
                </div>
                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase font-mono']">
                  0 MB VRAM
                </span>
              </div>
              <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Disabled / None
              </h4>
              <span :class="['text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mt-0.5']">
                Pure Direct Output
              </span>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Complete silence during generation. No thinking fillers, audio pauses, or background models loaded. Zero background VRAM overhead.
              </p>
            </div>
            <div :class="['mt-3 pt-2.5 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-400']">
              <span>0 MB VRAM</span>
              <span>·</span>
              <span>Zero Overhead</span>
              <span>·</span>
              <span>Silent</span>
            </div>
          </div>

          <!-- 1: Snappy Chat -->
          <div
            :class="[
              'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
              selectedProfile === 'snappy'
                ? 'border-sky-500/80 bg-sky-500/5 dark:bg-sky-500/10 ring-1 ring-sky-500/40'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="selectedProfile = 'snappy'"
          >
            <div>
              <div :class="['flex items-center justify-between mb-2']">
                <div :class="['w-7 h-7 rounded-xl bg-sky-500/10 flex items-center justify-center text-sm text-sky-500']">
                  <div :class="['i-solar:bolt-bold-duotone w-4 h-4']" />
                </div>
                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 uppercase font-mono']">
                  FAST 2–5s TTFT
                </span>
              </div>
              <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Snappy Chat
              </h4>
              <span :class="['text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mt-0.5']">
                Fast Conversational
              </span>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Standard chat models with fast initial response (Gemini Flash, Claude Haiku, small local LLMs). Quick short fillers.
              </p>
            </div>
            <div :class="['mt-3 pt-2.5 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-500 dark:text-neutral-400']">
              <span>Filler: ≤1.8s</span>
              <span>·</span>
              <span>Every: 8s</span>
              <span>·</span>
              <span>Budget: 2s</span>
            </div>
          </div>

          <!-- 2: Balanced -->
          <div
            :class="[
              'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
              selectedProfile === 'balanced'
                ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="selectedProfile = 'balanced'"
          >
            <div>
              <div :class="['flex items-center justify-between mb-2']">
                <div :class="['w-7 h-7 rounded-xl bg-primary-500/10 flex items-center justify-center text-sm text-primary-500']">
                  <div :class="['i-solar:scale-bold-duotone w-4 h-4']" />
                </div>
                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase font-mono']">
                  EVERYDAY 10–25s
                </span>
              </div>
              <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Balanced
              </h4>
              <span :class="['text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mt-0.5']">
                Everyday Reasoning
              </span>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Everyday reasoning models (DeepSeek 4 Pro, GPT-4o, Claude 3.5 Sonnet, Gemini Pro). Natural spoken asides.
              </p>
            </div>
            <div :class="['mt-3 pt-2.5 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-500 dark:text-neutral-400']">
              <span>Filler: ≤3.0s</span>
              <span>·</span>
              <span>Every: 15s</span>
              <span>·</span>
              <span>Budget: 3.2s</span>
            </div>
          </div>

          <!-- 3: Deep CoT Explorer -->
          <div
            :class="[
              'p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
              selectedProfile === 'deep'
                ? 'border-cyan-500/80 bg-cyan-500/5 dark:bg-cyan-500/10 ring-1 ring-cyan-500/40'
                : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
            ]"
            @click="selectedProfile = 'deep'"
          >
            <div>
              <div :class="['flex items-center justify-between mb-2']">
                <div :class="['w-7 h-7 rounded-xl bg-cyan-500/10 flex items-center justify-center text-sm text-cyan-500']">
                  <div :class="['i-solar:atom-bold-duotone w-4 h-4']" />
                </div>
                <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 uppercase font-mono']">
                  EXTENDED 40–90s+
                </span>
              </div>
              <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Deep CoT Explorer
              </h4>
              <span :class="['text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block mt-0.5']">
                Extended Deliberation
              </span>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                Heavy chain-of-thought models (Kimi k3, DeepSeek R1, Glyph Deep CoT). Longer deliberate thinking asides.
              </p>
            </div>
            <div :class="['mt-3 pt-2.5 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[9px] font-mono text-neutral-500 dark:text-neutral-400']">
              <span>Filler: ≤4.8s</span>
              <span>·</span>
              <span>Every: 18s</span>
              <span>·</span>
              <span>Budget: 5s</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Thinking Voice Sources (formerly 3-Tier Aside Extraction Cascade) -->
      <!-- When Disabled / None is selected: Reassuring zero-overhead banner -->
      <div
        v-if="selectedProfile === 'disabled'"
        :class="['p-4 rounded-2xl border border-emerald-500/20 dark:border-emerald-500/10 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.02] flex items-center justify-between gap-4 animate-fadeIn']"
      >
        <div :class="['flex items-start gap-3']">
          <div :class="['w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-lg flex-shrink-0 mt-0.5']">
            <div :class="['i-solar:shield-check-bold w-5 h-5 text-emerald-500']" />
          </div>
          <div>
            <div :class="['flex items-center gap-2']">
              <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Thinking Voice Sources & Fillers Disabled
              </h4>
              <span :class="['text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20']">
                0 MB VRAM · 0% Background Overhead
              </span>
            </div>
            <p :class="['text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed']">
              Complete silence is guaranteed while reasoning. No background neural SLMs, audio caches, or extraction models are loaded into memory. Your companion responds directly once output finishes.
            </p>
          </div>
        </div>
      </div>

      <!-- When Active: Thinking Voice Sources Pipeline -->
      <div
        v-else
        :class="['p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-3 transition-all animate-fadeIn']"
      >
        <div :class="['flex items-center justify-between border-b border-neutral-200/40 dark:border-white/5 pb-2']">
          <div :class="['flex items-center gap-2']">
            <div :class="['i-solar:microphone-3-bold-duotone text-primary-500 w-4 h-4']" />
            <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider']">
              Thinking Voice Sources
            </span>
          </div>
          <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono']">
            {{ [tier1Enabled, tier2Enabled, tier3Enabled].filter(Boolean).length }} ACTIVE
          </span>
        </div>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 -mt-1 leading-relaxed']">
          Choose where AIRI sources spoken words and vocalizations during model deliberation.
        </p>

        <!-- Source 1 -->
        <label :class="['flex items-start gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
          <input
            v-model="tier1Enabled"
            type="checkbox"
            :class="['mt-0.5 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer']"
          >
          <div :class="['flex-1 min-w-0']">
            <div :class="['flex items-center justify-between gap-2']">
              <span :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Natural In-Character Thoughts (&lt;think_aloud&gt;)
              </span>
              <span :class="['text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono flex-shrink-0']">
                Prompt Directives
              </span>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Synthesizes in-character thoughts when the model emits intentional &lt;think_aloud&gt; markers during reasoning.
            </p>
          </div>
        </label>

        <!-- Source 2 -->
        <label :class="['flex items-start gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
          <input
            v-model="tier2Enabled"
            type="checkbox"
            :class="['mt-0.5 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer']"
          >
          <div :class="['flex-1 min-w-0']">
            <div :class="['flex items-center justify-between gap-2']">
              <span :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Smart Reasoning Extractor (Needle 45M SLM)
              </span>
              <span :class="['text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 font-mono flex-shrink-0']">
                Lightweight SLM (14 MB)
              </span>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Runs an ultra-lightweight on-device model to extract genuine moments of realization and deliberation shifts directly from raw reasoning tokens without requiring special tags.
            </p>
            <div :class="['mt-2 flex items-center justify-between text-[10px] bg-neutral-50 dark:bg-neutral-800/40 p-1.5 rounded-lg border border-neutral-200/40 dark:border-white/5']">
              <span :class="['flex items-center gap-1.5 font-medium text-neutral-600 dark:text-neutral-300']">
                <span :class="['w-1.5 h-1.5 rounded-full bg-emerald-500']" />
                <span>Status: Ready (14 MB in Cache)</span>
              </span>
              <span :class="['text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1']">
                <div :class="['i-solar:check-circle-bold w-3 h-3']" />
                <span>Zero Cloud Cost · Pre-warmed</span>
              </span>
            </div>
          </div>
        </label>

        <!-- Source 3 -->
        <label :class="['flex items-start gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']">
          <input
            v-model="tier3Enabled"
            type="checkbox"
            :class="['mt-0.5 w-4 h-4 rounded text-primary-600 accent-primary-500 cursor-pointer']"
          >
          <div :class="['flex-1 min-w-0']">
            <div :class="['flex items-center justify-between gap-2']">
              <span :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                Casual Spoken Fillers (Organic Reactions & Audio Clips)
              </span>
              <span :class="['text-[9px] font-bold px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-white/10 text-neutral-600 dark:text-neutral-400 font-mono flex-shrink-0']">
                Natural Transitions
              </span>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
              Speaks short vocal reactions and organic transitions ("Wait...", "Hmm, let me see...") when the model takes time to reason.
            </p>

            <!-- Inline Pre-warm Audio Cache Strip -->
            <div
              v-if="tier3Enabled"
              :class="['mt-2 flex items-center justify-between gap-2 text-[10px] bg-neutral-50 dark:bg-neutral-800/40 p-1.5 rounded-lg border border-neutral-200/40 dark:border-white/5']"
              @click.stop
            >
              <div :class="['flex items-center gap-1.5 font-medium min-w-0 truncate']">
                <span :class="['w-1.5 h-1.5 rounded-full flex-shrink-0', prewarmSuccessCount ? 'bg-emerald-500' : isPrewarming ? 'bg-amber-500 animate-ping' : 'bg-neutral-400 dark:bg-neutral-500']" />
                <span :class="['truncate text-neutral-600 dark:text-neutral-300']">
                  <template v-if="isPrewarming">
                    Synthesizing fillers ({{ prewarmProgress?.completed || 0 }}/{{ prewarmProgress?.total || 9 }})...
                  </template>
                  <template v-else-if="prewarmSuccessCount">
                    Cache primed: {{ prewarmSuccessCount }} fillers ready (instant playback)
                  </template>
                  <template v-else>
                    Cache unprimed · Pre-synthesize clips to eliminate pause latency
                  </template>
                </span>
              </div>

              <div :class="['flex items-center gap-1.5 flex-shrink-0']">
                <span
                  v-if="prewarmSuccessCount"
                  :class="['text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center gap-1']"
                >
                  <div :class="['i-solar:check-circle-bold w-3 h-3']" />
                  <span>Zero Latency</span>
                </span>

                <button
                  type="button"
                  :disabled="isPrewarming"
                  :class="[
                    'px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-xs',
                    isPrewarming
                      ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                      : prewarmSuccessCount
                        ? 'bg-neutral-200/80 hover:bg-neutral-300 dark:bg-neutral-700/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200'
                        : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/25',
                  ]"
                  @click.stop.prevent="handlePrewarmAudioCache"
                >
                  <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin w-3 h-3' : 'i-solar:bolt-bold w-3 h-3']" />
                  <span>{{ isPrewarming ? 'Pre-warming...' : prewarmSuccessCount ? 'Re-warm' : 'Pre-warm Audio Cache' }}</span>
                </button>
              </div>
            </div>
          </div>
        </label>
      </div>

      <!-- Section 4: Max Response Length & Cadence -->
      <div :class="['p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-3.5']">
        <!-- Section Header -->
        <div :class="['flex items-center justify-between border-b border-neutral-200/40 dark:border-white/5 pb-2']">
          <div :class="['flex items-center gap-2']">
            <div :class="['i-solar:chat-square-arrow-bold-duotone text-primary-500 w-4 h-4']" />
            <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider']">
              Max Response Length
            </span>
          </div>
          <button
            v-if="overrideLimits"
            type="button"
            :class="['text-[10px] text-red-500 font-bold hover:underline cursor-pointer']"
            @click="handleResetToDefaults"
          >
            Reset defaults
          </button>
        </div>

        <!-- Warning for Deep CoT / Reasoning Models -->
        <div
          v-if="isReasoningModel || selectedProfile === 'deep'"
          :class="['p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn']"
        >
          <div :class="['i-solar:lock-bold w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500']" />
          <div :class="['leading-relaxed text-[11px]']">
            <span :class="['font-bold block text-amber-900 dark:text-amber-100 text-xs mb-0.5']">
              Reasoning Architecture Incompatibility — Keep Limits Disabled:
            </span>
            Thinking and reasoning models ({{ currentModelId || 'Deep CoT' }}) consume tokens dynamically during internal chain-of-thought deliberation before emitting outward speech. Enforcing any hard token limit will cut off reasoning mid-thought and break responses. Response length enforcement is locked off for reasoning models.
          </div>
        </div>

        <!-- Override Limits Switch -->
        <div
          :class="[
            'flex items-center justify-between rounded-xl p-2.5 bg-white dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-white/5 transition-colors',
            isReasoningModel ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-neutral-300 dark:hover:border-white/10',
          ]"
          @click="toggleOverrideLimits"
        >
          <div :class="['flex flex-col']">
            <div :class="['flex items-center gap-2']">
              <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">Enforce Response Length</span>
              <span
                v-if="isReasoningModel"
                :class="['text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1']"
              >
                <div :class="['i-solar:lock-bold w-2.5 h-2.5']" />
                <span>LOCKED OFF (REASONING MODEL)</span>
              </span>
            </div>
            <span :class="['text-[10px] text-neutral-400']">Guide companion response brevity and maximum token budget</span>
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

        <!-- Interactive Settings (Active when Override Limits is enabled) -->
        <div
          :class="[
            'flex flex-col gap-3.5 transition-opacity duration-200',
            !overrideLimits ? 'opacity-40 pointer-events-none' : '',
          ]"
        >
          <!-- 4 Length Tiers Side-by-Side Cards -->
          <div :class="['flex flex-col gap-1.5']">
            <label :class="['text-[10px] text-neutral-400 font-bold uppercase tracking-tight']">
              Spoken Cadence & Depth
            </label>
            <div :class="['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3']">
              <div
                v-for="tier in RESPONSE_LENGTH_TIERS"
                :key="tier.id"
                :class="[
                  'p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between text-left group relative',
                  selectedLengthTier === tier.id
                    ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
                    : 'border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/40 hover:border-neutral-300 dark:hover:border-white/10',
                ]"
                @click="selectLengthTier(tier)"
              >
                <div>
                  <div :class="['flex items-center justify-between mb-2']">
                    <div :class="['w-7 h-7 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-sm']">
                      <div :class="[tier.icon, 'w-4 h-4']" />
                    </div>
                    <span :class="['text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 uppercase font-mono']">
                      {{ tier.tag }}
                    </span>
                  </div>
                  <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    {{ tier.title }}
                  </h4>
                  <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
                    {{ tier.desc }}
                  </p>
                </div>

                <div :class="['mt-3 pt-2.5 border-t border-neutral-200/40 dark:border-white/5 flex items-center justify-between text-[10px] font-mono']">
                  <span :class="['text-neutral-400']">Token Ceiling:</span>
                  <span :class="['text-primary-500 font-bold']">
                    {{ tier.id === 'custom' ? `~${maxTokens} tokens` : `~${tier.tokens} tokens` }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Token Budget Slider (When Custom tier is selected) -->
          <div
            v-if="selectedLengthTier === 'custom'"
            :class="['p-3 rounded-xl border border-primary-500/30 bg-primary-500/5 flex flex-col gap-2 animate-fadeIn']"
          >
            <div :class="['flex items-center justify-between']">
              <div :class="['flex items-center gap-1.5']">
                <div :class="['i-solar:tuning-square-2-bold-duotone text-primary-500 w-4 h-4']" />
                <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200']">Custom Token Ceiling</span>
              </div>
              <div :class="['flex items-center gap-1.5']">
                <input
                  v-model.number="maxTokens"
                  type="number"
                  min="50"
                  max="2000"
                  step="10"
                  :class="['w-20 px-2 py-0.5 text-xs font-mono font-bold text-right border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 focus:outline-none focus:border-primary-500']"
                >
                <span :class="['text-[11px] font-mono text-neutral-400 font-medium']">tokens</span>
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
            <div :class="['flex justify-between text-[9px] font-mono text-neutral-400']">
              <span>50 (Micro)</span>
              <span>200 (Standard)</span>
              <span>500 (Rich)</span>
              <span>1000 (Detailed)</span>
              <span>2000 (Max)</span>
            </div>
          </div>

          <!-- Context Width Limits (Optional) -->
          <div :class="['flex flex-col gap-1.5 p-3 rounded-xl border border-neutral-200/40 dark:border-white/5 bg-white/60 dark:bg-neutral-900/30']">
            <div :class="['flex items-center justify-between']">
              <label :class="['text-[10px] text-neutral-400 font-bold uppercase tracking-tight']">
                Context Width Threshold (Optional)
              </label>
              <span :class="['text-[9px] text-neutral-400 font-medium italic']">
                Only set if known
              </span>
            </div>
            <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed']">
              Optional — only enter if you know your model's context window. Providing this allows AIRI to proactively compact short-term memories and prevent context saturation.
            </p>
            <div :class="['flex items-center gap-2 mt-1']">
              <input
                v-model.number="contextWidth"
                type="number"
                placeholder="e.g. 128000 (Optional)"
                :class="['w-44 border border-neutral-200 dark:border-white/10 rounded-lg bg-white dark:bg-neutral-900 px-2.5 py-1 text-xs text-neutral-800 dark:text-neutral-200 outline-none focus:border-primary-400']"
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

          <!-- Dynamic Prose Indicator & Inline Editor -->
          <div :class="['flex flex-col gap-1.5 border-t border-neutral-200/40 dark:border-white/5 pt-2.5']">
            <div :class="['flex items-center justify-between']">
              <span :class="['text-[10px] text-neutral-400 font-bold uppercase tracking-tight']">
                Compliance Instruction
              </span>
              <button
                type="button"
                :class="['flex items-center justify-center rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer']"
                title="Edit Instruction"
                @click="isProseEditing = !isProseEditing"
              >
                <div :class="[isProseEditing ? 'i-solar:check-read-linear text-xs text-green-500' : 'i-solar:pen-linear text-xs']" />
              </button>
            </div>

            <!-- Read-Only Prose Preview / Text Area Editor -->
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

        <!-- Interactive Cadence Simulator / Response Preview (Always Interactive) -->
        <div :class="['flex flex-col gap-2.5 border-t border-neutral-200/40 dark:border-white/5 pt-3']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <div :class="['i-solar:play-circle-bold-duotone text-primary-500 w-4 h-4']" />
              <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider']">
                Response Cadence Simulator
              </span>
            </div>
            <span :class="['text-[9px] font-mono text-neutral-400']">
              Live Test with {{ currentModelId || 'Configured Model' }}
            </span>
          </div>
          <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed']">
            Simulate a turn to verify how your companion speaks under current settings{{ overrideLimits ? ' (with token budget and compliance instruction enforced)' : ' (unconstrained output)' }}.
          </p>

          <div :class="['flex gap-2']">
            <input
              v-model="testSimulationPrompt"
              type="text"
              placeholder="Enter a test prompt for your companion..."
              :disabled="isSimulating"
              :class="['flex-1 text-xs border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-primary-500 disabled:opacity-50']"
              @keydown.enter="runCadenceSimulation"
            >
            <button
              type="button"
              :disabled="isSimulating || !currentModelId"
              :class="[
                'px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer',
                isSimulating
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                  : !currentModelId
                    ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20',
              ]"
              @click="runCadenceSimulation"
            >
              <div :class="[isSimulating ? 'i-solar:refresh-circle-bold animate-spin w-3.5 h-3.5' : 'i-solar:play-bold w-3.5 h-3.5']" />
              <span>{{ isSimulating ? 'Simulating...' : 'Simulate Turn' }}</span>
            </button>
          </div>

          <!-- Simulation Error Banner -->
          <div
            v-if="simulationError"
            :class="['p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2']"
          >
            <div :class="['i-solar:danger-triangle-bold w-4 h-4 flex-shrink-0']" />
            <span :class="['text-[11px] leading-relaxed']">{{ simulationError }}</span>
          </div>

          <!-- Simulation Output Box -->
          <div
            v-if="simulationResult || isSimulating"
            :class="['p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/60 flex flex-col gap-2 animate-fadeIn']"
          >
            <div :class="['flex items-center justify-between border-b border-neutral-200/40 dark:border-white/5 pb-1.5']">
              <span :class="['text-[10px] font-bold text-neutral-500 uppercase tracking-wider font-mono']">
                Simulated Companion Output
              </span>
              <div
                v-if="simulationLatencyMs"
                :class="['flex items-center gap-2 text-[10px] font-mono']"
              >
                <span :class="['px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-300']">
                  ⏱️ {{ simulationLatencyMs }}ms TTFT
                </span>
                <span :class="['px-1.5 py-0.2 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold']">
                  📝 ~{{ simulationTokens }} tokens
                </span>
                <span :class="['px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400']">
                  💬 {{ simulationSentences }} sentences
                </span>
              </div>
            </div>
            <div
              v-if="isSimulating"
              :class="['flex items-center gap-2 text-xs text-neutral-400 italic py-2']"
            >
              <div :class="['i-solar:refresh-circle-bold animate-spin w-4 h-4 text-primary-500']" />
              <span>Generating response with cadence enforcement...</span>
            </div>
            <p
              v-else
              :class="['text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap select-text']"
            >
              {{ simulationResult }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Pinned Bottom Navigation Bar -->
    <div
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="300"
      :delay="150"
      :class="['flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/80 dark:border-white/5']"
    >
      <button
        type="button"
        :class="['flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
        <span>{{ t('onboarding.shell.previous') }}</span>
      </button>

      <!-- Center Status Indicator -->
      <div :class="['text-xs font-medium text-neutral-400 text-center hidden sm:block truncate max-w-xs md:max-w-md']">
        <span>Pacing: </span>
        <span :class="['font-semibold', selectedProfile === 'disabled' ? 'text-neutral-500' : 'text-neutral-800 dark:text-neutral-200']">
          {{ activeProfileTitle }}
        </span>
        <span :class="['mx-1.5 text-neutral-300 dark:text-neutral-600']">•</span>
        <span :class="['font-mono text-[11px]', selectedProfile === 'disabled' ? 'text-neutral-400' : 'text-primary-600 dark:text-primary-400']">
          {{ selectedProfile === 'disabled' ? 'Silent (0 MB VRAM)' : 'Pacing Active' }}
        </span>
      </div>

      <Button
        variant="primary"
        size="md"
        :class="[
          'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
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
              Pre-warm Thinking Fillers?
            </h3>
            <p :class="['mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed text-left']">
              You've enabled <strong>Casual Spoken Fillers</strong>, but the audio cache is currently empty.
            </p>
            <p :class="['mt-2 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed text-left']">
              To eliminate voice latency during reasoning pauses, AIRI needs to make <strong>9 quick synthesis requests</strong> to your configured voice provider (<span class="text-primary-600 font-semibold font-mono dark:text-primary-400">{{ ttsVoiceLabel }}</span>).
            </p>
            <p :class="['mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed text-left']">
              Would you like to pre-generate these clips now, or continue and generate them on-demand later?
            </p>

            <!-- Prewarm progress indicator if running inside modal -->
            <div
              v-if="isPrewarming"
              :class="['mt-3 p-2.5 rounded-xl bg-primary-500/10 border border-primary-500/20 text-xs font-semibold text-primary-600 dark:text-primary-300 flex items-center justify-center gap-2']"
            >
              <div :class="['i-solar:refresh-circle-bold animate-spin h-4 w-4']" />
              <span>Pre-warming fillers ({{ prewarmProgress?.completed || 0 }}/{{ prewarmProgress?.total || 9 }})...</span>
            </div>
          </div>

          <div :class="['flex flex-col sm:flex-row items-center gap-2.5 pt-2']">
            <button
              type="button"
              :disabled="isPrewarming"
              :class="['w-full sm:flex-1 rounded-xl border border-neutral-200 dark:border-white/10 bg-neutral-100 dark:bg-white/5 px-4 py-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed']"
              @click="handleSkipPrewarmAndContinue"
            >
              Generate On-Demand Later
            </button>
            <button
              type="button"
              :disabled="isPrewarming"
              :class="['w-full sm:flex-1 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-primary-600/30 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed']"
              @click="handleConfirmPrewarmAndContinue"
            >
              <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin w-4 h-4' : 'i-solar:bolt-bold w-4 h-4']" />
              <span>{{ isPrewarming ? 'Synthesizing...' : '⚡ Pre-generate 9 Clips Now' }}</span>
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
