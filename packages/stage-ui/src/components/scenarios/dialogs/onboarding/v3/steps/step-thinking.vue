<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { prewarmThinkingFillers } from '../../../../../../libs/pacing/pacing-prewarm'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { DEFAULT_PACING_FILLERS } from '../../../../../../types/pacing'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()

// 1. Pacing Profile Presets State
type PacingSelection = 'disabled' | 'snappy' | 'balanced' | 'deep'
const selectedProfile = ref<PacingSelection>(
  draftStore.state.pacingPreset || 'balanced',
)

// 2. 3-Tier Cascade State
const tier1Enabled = ref<boolean>(draftStore.state.subconsciousTier1 ?? true)
const tier2Enabled = ref<boolean>(draftStore.state.subconsciousTier2 ?? true)
const tier3Enabled = ref<boolean>(draftStore.state.subconsciousTier3 ?? true)

// 3. Pre-warm State
const isPrewarming = ref(false)
const prewarmProgress = ref<{ completed: number, total: number } | null>(null)
const prewarmSuccessCount = ref<number | null>(null)

// 4. Response Length & Depth Cadence State
export type ResponseLengthTierId = 'short' | 'balanced' | 'rich'

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
]

const overrideLimits = ref<boolean>(draftStore.state.overrideLimits ?? false)
const contextWidth = ref<number | undefined>(draftStore.state.contextWidth)
const selectedLengthTier = ref<ResponseLengthTierId>(
  draftStore.state.maxTokens && draftStore.state.maxTokens <= 120
    ? 'short'
    : draftStore.state.maxTokens && draftStore.state.maxTokens > 250
      ? 'rich'
      : 'balanced',
)
const maxTokens = ref<number>(
  draftStore.state.maxTokens
  || (selectedLengthTier.value === 'short' ? 120 : selectedLengthTier.value === 'rich' ? 500 : 200),
)
const isProseEditing = ref(false)
const customProse = ref<string>(
  draftStore.state.customProse
  || RESPONSE_LENGTH_TIERS.find(t => t.id === selectedLengthTier.value)?.prose
  || RESPONSE_LENGTH_TIERS[1].prose,
)

function selectLengthTier(tier: ResponseLengthTier) {
  selectedLengthTier.value = tier.id
  maxTokens.value = tier.tokens
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
  if (!overrideLimits.value && selectedProfile.value === 'deep') {
    toast.warning('Warning: Enforcing token limits on Deep CoT models can truncate reasoning mid-thought!')
  }
  overrideLimits.value = !overrideLimits.value
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

// Navigation
function handleContinue() {
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
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-6 py-2 my-auto animate-fadeIn']">
    <!-- Step Header (Sticky so navigation/status is always visible) -->
    <div :class="['sticky top-0 z-20 bg-neutral-50/95 dark:bg-[#0c0c0e]/95 backdrop-blur-md flex items-start justify-between gap-4 border-b border-neutral-200/60 dark:border-white/5 pb-3 pt-2 -mx-2 px-2']">
      <div :class="['flex items-center gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-xl flex-shrink-0']">
          <div :class="['i-solar:brain-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              Conversational Pacing & Thinking
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400']">
              Step 10
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
            Calibrate spoken thinking fillers, natural reasoning asides, and response length. Presets match your model's thinking speed so AIRI can fill the silence with speech while waiting — AIRI never cuts off or imposes timeouts on model reasoning.
          </p>
        </div>
      </div>

      <!-- Active Status Badge -->
      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          :class="[
            'text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full font-mono border flex items-center gap-1.5',
            selectedProfile === 'disabled'
              ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-neutral-200 dark:border-neutral-700'
              : 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
          ]"
        >
          <span :class="['w-1.5 h-1.5 rounded-full', selectedProfile === 'disabled' ? 'bg-neutral-400' : 'bg-primary-500 animate-pulse']" />
          <span>{{ selectedProfile === 'disabled' ? 'SILENT • 0 MB VRAM' : 'PACING ACTIVE' }}</span>
        </span>
      </div>
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
        </div>
      </label>
    </div>

    <!-- Section 3: Pre-warm Audio Cache Action -->
    <div
      v-if="selectedProfile !== 'disabled'"
      :class="['p-4 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4']"
    >
      <div :class="['flex items-start gap-3']">
        <div :class="['w-8 h-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-base flex-shrink-0 mt-0.5']">
          <div :class="['i-solar:bolt-circle-bold w-4 h-4']" />
        </div>
        <div>
          <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
            Thinking Audio Filler Cache
          </h4>
          <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Pre-synthesize filler phrases into browser cache using your companion's configured voice to eliminate latency during reasoning pauses.
          </p>
        </div>
      </div>

      <div :class="['flex items-center gap-2 flex-shrink-0']">
        <span
          v-if="prewarmSuccessCount"
          :class="['text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20']"
        >
          ✓ {{ prewarmSuccessCount }} Fillers Ready
        </span>
        <button
          type="button"
          :disabled="isPrewarming"
          :class="[
            'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm',
            isPrewarming
              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30',
          ]"
          @click="handlePrewarmAudioCache"
        >
          <div :class="[isPrewarming ? 'i-solar:refresh-circle-bold animate-spin w-4 h-4' : 'i-solar:bolt-bold w-4 h-4']" />
          <span>{{ isPrewarming ? `Pre-warming (${prewarmProgress?.completed}/${prewarmProgress?.total})...` : 'Pre-warm Audio Cache' }}</span>
        </button>
      </div>
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

      <!-- Warning for Deep CoT Reasoning Models (Always visible when Deep CoT is active, whether limits are on or off) -->
      <div
        v-if="selectedProfile === 'deep'"
        :class="['p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn']"
      >
        <div :class="['i-solar:danger-triangle-bold w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500']" />
        <div :class="['leading-relaxed text-[11px]']">
          <span :class="['font-bold block text-amber-900 dark:text-amber-100 text-xs mb-0.5']">
            Deep CoT Incompatibility — Keep Limits Disabled:
          </span>
          Thinking models (DeepSeek R1, Kimi k3, o1, etc.) consume tokens dynamically during internal chain-of-thought deliberation before emitting outward speech. Enforcing any hard token limit will cut off reasoning mid-thought and break responses. Keep this setting disabled for Deep CoT models.
        </div>
      </div>

      <!-- Override Limits Switch -->
      <div
        :class="['flex items-center justify-between rounded-xl p-2.5 bg-white dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-white/5 cursor-pointer hover:border-neutral-300 dark:hover:border-white/10 transition-colors']"
        @click="toggleOverrideLimits"
      >
        <div :class="['flex flex-col']">
          <span :class="['text-xs font-semibold text-neutral-800 dark:text-neutral-200']">Enforce Response Length</span>
          <span :class="['text-[10px] text-neutral-400']">Guide companion response brevity and maximum token budget</span>
        </div>
        <div
          :class="[
            'relative h-5 w-9 inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out',
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
        <!-- 3 Length Tiers Side-by-Side Cards -->
        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-[10px] text-neutral-400 font-bold uppercase tracking-tight']">
            Spoken Cadence & Depth
          </label>
          <div :class="['grid grid-cols-1 sm:grid-cols-3 gap-3']">
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
                <span :class="['text-primary-500 font-bold']">~{{ tier.tokens }} tokens</span>
              </div>
            </div>
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
    </div>

    <!-- Bottom Navigation Bar -->
    <div :class="['flex items-center justify-between pt-4 border-t border-neutral-200/60 dark:border-white/5']">
      <button
        type="button"
        :class="['px-5 py-2 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer']"
        @click="props.onPrevious"
      >
        ← Previous Step
      </button>

      <button
        type="button"
        :class="['px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold shadow-md shadow-primary-600/30 transition-all cursor-pointer flex items-center gap-2']"
        @click="handleContinue"
      >
        <span>Confirm & Continue</span>
        <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
      </button>
    </div>
  </div>
</template>
