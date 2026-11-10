<script setup lang="ts">
import type { PrewarmProgressEvent } from '@proj-airi/stage-ui/libs/pacing'
import type { SpeechCapabilitiesInfo } from '@proj-airi/stage-ui/stores/providers'
import type { PacingProfileId, ThinkingCategory, ThinkingFillerPhrase } from '@proj-airi/stage-ui/types/pacing'

import { DEFAULT_THINK_ALOUD_PROMPT } from '@proj-airi/stage-ui/constants/prompts/character-defaults'
import { isNeedleModelCached, needleClient } from '@proj-airi/stage-ui/libs/inference'
import {
  clearThinkingAudioCache,
  getThinkingAudio,
  isThinkingAudioCached,
  prewarmThinkingFillers,
} from '@proj-airi/stage-ui/libs/pacing'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import {
  DEFAULT_PACING_FILLERS,
  detectActivePacingProfile,
  PACING_PROFILES,
} from '@proj-airi/stage-ui/types/pacing'
import { FieldInput } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'

import ActingSubTabPacingPlayground from './ActingSubTabPacingPlayground.vue'

interface Props {
  selectedSpeechProvider?: string
  selectedSpeechModel?: string
  selectedSpeechVoiceId?: string
  selectedSpeechProviderLabel?: string
  actingMannerismOptions?: NonNullable<SpeechCapabilitiesInfo['mannerisms']>
  insertSpeechMannerism?: (id: string) => void
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigate-to-playground'): void
  (e: 'sparkle-click', fieldId: string): void
}>()

// Mannerism & Thinking Prompt Models
const selectedActingSpeechMannerismPrompt = defineModel<string>('selectedActingSpeechMannerismPrompt', { required: true })

// Conversational Pacing Models
const pacingEnabled = defineModel<boolean>('pacingEnabled', { default: false })
const pacingArmMinMs = defineModel<number>('pacingArmMinMs', { default: 1200 })
const pacingArmMaxMs = defineModel<number>('pacingArmMaxMs', { default: 3500 })
const pacingMaxFillerDurationMs = defineModel<number>('pacingMaxFillerDurationMs', { default: 3000 })
const pacingCategoryThreshold = defineModel<number>('pacingCategoryThreshold', { default: 1 })
const pacingMaxFillersPerTurn = defineModel<number>('pacingMaxFillersPerTurn', { default: 3 })
const pacingIntervalMs = defineModel<number>('pacingIntervalMs', { default: 15000 })
const pacingFillers = defineModel<ThinkingFillerPhrase[]>('pacingFillers', {
  default: () => [...DEFAULT_PACING_FILLERS],
})

// Dynamic Pacing Models
const pacingDynamicAsidesEnabled = defineModel<boolean>('pacingDynamicAsidesEnabled', { default: false })
const pacingSemanticExtractorEnabled = defineModel<boolean>('pacingSemanticExtractorEnabled', { default: false })
const pacingDynamicAfterMs = defineModel<number>('pacingDynamicAfterMs', { default: 15000 })
const pacingCandidateTtlMs = defineModel<number>('pacingCandidateTtlMs', { default: 15000 })
const pacingMaxFillerSynthesisBudgetMs = defineModel<number>('pacingMaxFillerSynthesisBudgetMs', { default: 3200 })
const pacingMaxSynthesisBudgetMs = defineModel<number>('pacingMaxSynthesisBudgetMs', { default: 3200 })
const pacingProfile = defineModel<string>('pacingProfile', { default: 'balanced' })
const pacingExperimentalOrganicPivots = defineModel<boolean>('pacingExperimentalOrganicPivots', { default: false })

const THINK_ALOUD_TEMPLATE = DEFAULT_THINK_ALOUD_PROMPT

const PACING_STYLE_TEMPLATE = `When working through complex questions, feel free to use natural conversational acknowledgments and thinking pauses before providing your complete detailed answer.`

function safeAppendMannerismPrompt(template: string) {
  const current = selectedActingSpeechMannerismPrompt.value?.trim() || ''
  if (!current) {
    selectedActingSpeechMannerismPrompt.value = template
  }
  else if (!current.includes(template.trim())) {
    selectedActingSpeechMannerismPrompt.value = `${current}\n\n${template}`
  }
}

function onDynamicAsidesToggle(event: Event) {
  const target = event.target as HTMLInputElement
  const enabled = target.checked
  pacingDynamicAsidesEnabled.value = enabled
  if (enabled) {
    const current = selectedActingSpeechMannerismPrompt.value?.trim() || ''
    if (!current.includes('think_aloud')) {
      safeAppendMannerismPrompt(THINK_ALOUD_TEMPLATE)
    }
  }
}

function handleInsertSpeechMannerism(id: string) {
  if (props.insertSpeechMannerism) {
    props.insertSpeechMannerism(id)
  }
}

// Stores
const speechStore = useSpeechStore()
const providersStore = useProvidersStore()

const CATEGORY_OPTIONS: { value: ThinkingCategory, label: string, badgeClass: string }[] = [
  { value: 'generic', label: 'Generic', badgeClass: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700' },
  { value: 'analytical', label: 'Analytical', badgeClass: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  { value: 'memory', label: 'Memory', badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
  { value: 'emotional', label: 'Emotional', badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  { value: 'uncertain', label: 'Uncertain', badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
]

function getCategoryBadgeClass(category: ThinkingCategory) {
  return CATEGORY_OPTIONS.find(c => c.value === category)?.badgeClass || 'bg-neutral-100 text-neutral-600'
}

// Cache status tracker
const cachedStatusMap = ref<Record<string, boolean>>({})
const isCheckingCache = ref(false)

function getResolvedVoiceConfig() {
  return {
    provider: props.selectedSpeechProvider || speechStore.activeSpeechProvider,
    model: props.selectedSpeechModel || speechStore.activeSpeechModel || '',
    voiceId: props.selectedSpeechVoiceId || speechStore.activeSpeechVoiceId || '',
    pitch: speechStore.pitch,
    rate: speechStore.rate,
    language: speechStore.selectedLanguage,
  }
}

async function refreshCacheStatuses() {
  isCheckingCache.value = true
  try {
    const voiceConfig = getResolvedVoiceConfig()
    const map: Record<string, boolean> = {}
    for (const filler of pacingFillers.value) {
      map[filler.text] = await isThinkingAudioCached(voiceConfig, filler.text)
    }
    cachedStatusMap.value = map
  }
  finally {
    isCheckingCache.value = false
  }
}

watch([() => props.selectedSpeechProvider, () => props.selectedSpeechModel, () => props.selectedSpeechVoiceId, pacingFillers], () => {
  void refreshCacheStatuses()
}, { deep: true })

onMounted(() => {
  void refreshCacheStatuses()
  void checkNeedleStatus()
})

const cachedFillersCount = computed(() => {
  return pacingFillers.value.filter(f => cachedStatusMap.value[f.text]).length
})

// Pre-warming execution
const isPrewarming = ref(false)
const prewarmProgress = ref<PrewarmProgressEvent | null>(null)
const prewarmError = ref<string | null>(null)

async function handlePrewarm() {
  if (isPrewarming.value)
    return
  isPrewarming.value = true
  prewarmError.value = null
  try {
    const voiceConfig = getResolvedVoiceConfig()
    await prewarmThinkingFillers({
      phrases: pacingFillers.value,
      voice: voiceConfig,
      synthesize: async (text: string) => {
        const providerInstance = await providersStore.getProviderInstance(voiceConfig.provider)
        if (!providerInstance)
          throw new Error(`Speech provider "${voiceConfig.provider}" unavailable`)
        return speechStore.speech(providerInstance as any, voiceConfig.model, text, voiceConfig.voiceId)
      },
      onProgress: (evt) => {
        prewarmProgress.value = evt
      },
    })
    await refreshCacheStatuses()
  }
  catch (err: any) {
    prewarmError.value = err?.message || String(err)
  }
  finally {
    isPrewarming.value = false
  }
}

async function handleClearCache() {
  await clearThinkingAudioCache()
  await refreshCacheStatuses()
}

// Needle 3 Subconscious Runtime (Tier 2 Semantic Extractor)
const isNeedlePrepared = ref(false)
const isNeedleDownloading = ref(false)
const needleDownloadProgress = ref(0)

async function checkNeedleStatus() {
  try {
    isNeedlePrepared.value = await isNeedleModelCached()
  }
  catch {
    isNeedlePrepared.value = false
  }
}

async function downloadAndPrepareNeedle() {
  if (isNeedleDownloading.value)
    return
  isNeedleDownloading.value = true
  needleDownloadProgress.value = 0
  try {
    const ok = await needleClient.prepare((ratio) => {
      needleDownloadProgress.value = Math.round(ratio * 100)
    })
    isNeedlePrepared.value = ok || await isNeedleModelCached()
  }
  catch (err) {
    console.warn('[ActingTab] Failed to prepare Needle 3:', err)
  }
  finally {
    isNeedleDownloading.value = false
  }
}

watch(pacingSemanticExtractorEnabled, (enabled) => {
  if (enabled) {
    void checkNeedleStatus()
  }
})

// Audition playback
const playingText = ref<string | null>(null)
let currentAudio: HTMLAudioElement | null = null

async function togglePlayFiller(phrase: ThinkingFillerPhrase) {
  if (playingText.value === phrase.text && currentAudio) {
    currentAudio.pause()
    currentAudio = null
    playingText.value = null
    return
  }

  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
    playingText.value = null
  }

  const voiceConfig = getResolvedVoiceConfig()
  let audioBlob: Blob | undefined
  const cached = await getThinkingAudio({
    provider: voiceConfig.provider,
    model: voiceConfig.model,
    voiceId: voiceConfig.voiceId,
    pitch: voiceConfig.pitch ?? 0,
    rate: voiceConfig.rate ?? 1,
    language: voiceConfig.language ?? 'en-US',
    text: phrase.text.trim(),
  })

  if (cached?.audio) {
    audioBlob = new Blob([cached.audio], { type: 'audio/mp3' })
  }
  else {
    try {
      const providerInstance = await providersStore.getProviderInstance(voiceConfig.provider)
      if (!providerInstance)
        return
      const buf = await speechStore.speech(providerInstance as any, voiceConfig.model, phrase.text, voiceConfig.voiceId)
      audioBlob = new Blob([buf], { type: 'audio/wav' })
    }
    catch (err) {
      console.error('[CardCreationTabActing] Failed to synthesize preview:', err)
      return
    }
  }

  if (!audioBlob)
    return

  const url = URL.createObjectURL(audioBlob)
  const audio = new Audio(url)
  currentAudio = audio
  playingText.value = phrase.text

  const cleanup = () => {
    URL.revokeObjectURL(url)
    if (playingText.value === phrase.text) {
      playingText.value = null
      currentAudio = null
    }
  }

  audio.onended = cleanup
  audio.onerror = cleanup
  try {
    await audio.play()
  }
  catch {
    cleanup()
  }
}

// Filter and phrase management
const categoryFilter = ref<'all' | ThinkingCategory>('all')

const filteredFillers = computed(() => {
  if (categoryFilter.value === 'all')
    return pacingFillers.value
  return pacingFillers.value.filter(f => f.category === categoryFilter.value)
})

const newPhraseText = ref('')
const newPhraseCategory = ref<ThinkingCategory>('generic')

function addPhrase() {
  const text = newPhraseText.value.trim()
  if (!text)
    return
  if (pacingFillers.value.some(f => f.text.toLowerCase() === text.toLowerCase()))
    return
  pacingFillers.value = [
    ...pacingFillers.value,
    { text, category: newPhraseCategory.value, enabled: true },
  ]
  newPhraseText.value = ''
  void refreshCacheStatuses()
}

function removePhrase(text: string) {
  pacingFillers.value = pacingFillers.value.filter(f => f.text !== text)
  delete cachedStatusMap.value[text]
}

function resetToDefaultFillers() {
  pacingFillers.value = JSON.parse(JSON.stringify(DEFAULT_PACING_FILLERS))
  void refreshCacheStatuses()
}

function applyPacingProfile(profileId: 'snappy' | 'balanced' | 'deep_cot') {
  const profile = PACING_PROFILES[profileId]
  if (!profile)
    return
  pacingProfile.value = profileId
  const s = profile.settings
  pacingArmMinMs.value = s.armMinMs
  pacingArmMaxMs.value = s.armMaxMs
  pacingMaxFillerDurationMs.value = s.maxFillerDurationMs
  pacingIntervalMs.value = s.pacingIntervalMs
  pacingMaxFillersPerTurn.value = s.maxFillersPerTurn
  pacingMaxSynthesisBudgetMs.value = s.maxSynthesisBudgetMs
  pacingMaxFillerSynthesisBudgetMs.value = s.maxFillerSynthesisBudgetMs
  pacingDynamicAsidesEnabled.value = s.dynamicAsidesEnabled
  pacingSemanticExtractorEnabled.value = s.semanticExtractorEnabled
  pacingDynamicAfterMs.value = s.dynamicAfterMs
  pacingCandidateTtlMs.value = s.candidateTtlMs

  if (s.semanticExtractorEnabled && !isNeedlePrepared.value && !isNeedleDownloading.value) {
    void downloadAndPrepareNeedle()
  }
}

const currentDetectedProfile = computed<PacingProfileId>(() => {
  return detectActivePacingProfile({
    armMinMs: pacingArmMinMs.value,
    armMaxMs: pacingArmMaxMs.value,
    maxFillerDurationMs: pacingMaxFillerDurationMs.value,
    pacingIntervalMs: pacingIntervalMs.value,
    maxFillersPerTurn: pacingMaxFillersPerTurn.value,
    maxSynthesisBudgetMs: pacingMaxSynthesisBudgetMs.value,
    dynamicAsidesEnabled: pacingDynamicAsidesEnabled.value,
    semanticExtractorEnabled: pacingSemanticExtractorEnabled.value,
  })
})

function resetThresholdsToDefaults() {
  applyPacingProfile('balanced')
}

const currentView = ref<'settings' | 'lab'>('settings')

defineExpose({
  applyPacingProfile,
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- View Switch (Settings vs Lab) -->
    <div class="flex items-center justify-between border-b border-neutral-200/80 pb-3 dark:border-neutral-800">
      <div class="flex items-center gap-2">
        <div class="i-solar:hourglass-bold-duotone text-lg text-primary-500" />
        <h3 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
          Thinking & Deliberation
        </h3>
      </div>
      <div class="inline-flex rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800/80">
        <button
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150',
            currentView === 'settings'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="currentView = 'settings'"
        >
          <span class="i-solar:settings-minimalistic-bold text-xs" />
          <span>Settings</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150',
            currentView === 'lab'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="currentView = 'lab'"
        >
          <span class="i-solar:test-tube-minimalistic-bold-duotone text-xs" />
          <span>Lab</span>
        </button>
      </div>
    </div>

    <!-- Lab View -->
    <ActingSubTabPacingPlayground
      v-if="currentView === 'lab'"
      :pacing-enabled="pacingEnabled"
      :selected-speech-provider="props.selectedSpeechProvider"
      :selected-speech-model="props.selectedSpeechModel"
      :selected-speech-voice-id="props.selectedSpeechVoiceId"
      @navigate-to-pacing="currentView = 'settings'"
      @apply-preset="applyPacingProfile"
    />

    <!-- Settings View -->
    <div v-else class="flex flex-col gap-6">
      <!-- Master Enable/Disable Bar -->
      <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <input
              id="pacing-master-toggle"
              v-model="pacingEnabled"
              type="checkbox"
              class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
            >
            <label for="pacing-master-toggle" class="cursor-pointer text-sm text-neutral-800 font-semibold dark:text-neutral-100">
              Thinking Fillers & Spoken Asides
            </label>
          </div>
          <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
            Bridges reasoning and network latency by playing cached audio fillers ("Hmm...", "Let me check that...") and live spoken asides while the model deliberates.
          </p>
        </div>
        <span
          :class="[
            'px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
            pacingEnabled
              ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
          ]"
        >
          {{ pacingEnabled ? 'Active' : 'Disabled' }}
        </span>
      </div>

      <!-- Thinking Lab Interactive Test Banner -->
      <div class="flex flex-wrap items-center justify-between gap-3 border border-primary-500/30 rounded-xl from-primary-500/10 via-primary-500/5 to-transparent bg-gradient-to-r p-3 dark:border-primary-500/20">
        <div class="flex items-center gap-2.5">
          <div class="h-8 w-8 flex items-center justify-center rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400">
            <span class="i-solar:test-tube-minimalistic-bold-duotone text-lg" />
          </div>
          <div>
            <div class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
              Thinking Lab (Interactive Audition Sandbox)
            </div>
            <div class="text-[11px] text-neutral-500 dark:text-neutral-400">
              Test reasoning latency, live spoken asides, and audio playback in an interactive sandbox.
            </div>
          </div>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs text-white font-medium shadow-sm transition-all active:scale-98 hover:bg-primary-700"
          @click="currentView = 'lab'"
        >
          <span>Open Lab</span>
          <span class="i-solar:arrow-right-bold text-xs" />
        </button>
      </div>

      <!-- 1-Click Pacing Profiles Presets -->
      <div class="border border-neutral-200/80 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/60">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="i-solar:slider-vertical-bold-duotone text-base text-primary-500" />
            <h4 class="text-xs text-neutral-800 font-semibold tracking-wider uppercase dark:text-neutral-200">
              Thinking Profile Presets
            </h4>
          </div>
          <span
            v-if="currentDetectedProfile === 'custom'"
            class="border border-amber-300/40 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600 font-semibold tracking-wider uppercase dark:border-amber-700/40 dark:bg-amber-400/15 dark:text-amber-300"
          >
            Customized
          </span>
          <span
            v-else
            class="border border-primary-200 rounded-full bg-primary-50/60 px-2 py-0.5 text-[10px] text-primary-700 font-semibold tracking-wider uppercase dark:border-primary-800 dark:bg-primary-950/60 dark:text-primary-300"
          >
            Preset Active
          </span>
        </div>
        <p class="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
          Select a calibrated profile to tune timing deadlines, audio duration ceilings, and dynamic aside budgets for your model's thinking speed.
        </p>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            v-for="profile in PACING_PROFILES"
            :key="profile.id"
            type="button"
            :class="[
              'group relative flex flex-col p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer',
              currentDetectedProfile === profile.id
                ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 ring-2 ring-primary-500/20'
                : 'border-neutral-200/80 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-950/30 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/50',
            ]"
            @click="applyPacingProfile(profile.id)"
          >
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    profile.icon,
                    'text-lg',
                    currentDetectedProfile === profile.id ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400 group-hover:text-primary-500',
                  ]"
                />
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  {{ profile.label }}
                </span>
              </div>
              <span
                v-if="currentDetectedProfile === profile.id"
                class="i-solar:check-circle-bold text-sm text-primary-600 dark:text-primary-400"
              />
            </div>
            <span class="mb-1 text-[11px] text-primary-600 font-medium dark:text-primary-400">
              {{ profile.subtitle }}
            </span>
            <p class="line-clamp-2 text-[11px] text-neutral-500 leading-tight dark:text-neutral-400">
              {{ profile.targetTurnDescription }}
            </p>
            <div class="mt-2.5 flex flex-wrap gap-1.5 border-t border-neutral-200/60 pt-2 text-[10px] text-neutral-500 dark:border-neutral-800/60 dark:text-neutral-400">
              <span class="rounded bg-neutral-200/60 px-1.5 py-0.5 font-mono dark:bg-neutral-800/60">
                Max: &le;{{ (profile.settings.maxFillerDurationMs / 1000).toFixed(1) }}s
              </span>
              <span class="rounded bg-neutral-200/60 px-1.5 py-0.5 font-mono dark:bg-neutral-800/60">
                Int: {{ (profile.settings.pacingIntervalMs / 1000).toFixed(0) }}s
              </span>
              <span class="rounded bg-neutral-200/60 px-1.5 py-0.5 font-mono dark:bg-neutral-800/60">
                Budget: {{ profile.settings.maxSynthesisBudgetMs }}ms
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Speech Style & Thinking Instructions Scratchpad -->
      <div class="border border-neutral-200 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/60">
        <div class="mb-3 flex flex-col gap-0.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-solar:chat-round-dots-bold-duotone text-primary-500" />
              <span class="text-xs text-neutral-800 font-semibold tracking-wider uppercase dark:text-neutral-200">
                Speech Style & Thinking Instructions
              </span>
            </div>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            Guide how your character communicates during thought pauses and reasoning. Use 1-click templates to teach the model to speak intentional <code>&lt;think_aloud&gt;</code> asides.
          </p>
        </div>

        <FieldInput
          v-model="selectedActingSpeechMannerismPrompt"
          label="Style & Thinking Prompt"
          description="Injected into the character's system prompt to guide thinking pauses, mannerisms, and spoken CoT asides."
          :single-line="false"
        />

        <!-- Warning banner if dynamic asides enabled without <think_aloud> in prompt -->
        <div
          v-if="pacingDynamicAsidesEnabled && !selectedActingSpeechMannerismPrompt?.includes('think_aloud')"
          class="mt-2.5 flex items-center gap-2 border border-amber-200 rounded-lg bg-amber-50/80 px-3 py-2 text-xs text-amber-700 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <div class="i-solar:danger-triangle-bold shrink-0 text-sm" />
          <span>Dynamic live asides are enabled, but your style & thinking prompt does not include instructions for <code>&lt;think_aloud&gt;</code>. Click "Insert &lt;think_aloud&gt; CoT Template" below to add them.</span>
        </div>

        <!-- Action Chips & Provider Mannerisms -->
        <div class="mt-3 flex flex-col gap-2.5">
          <div class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">
            Quick Insert Templates & Helpers
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="flex items-center gap-1.5 border border-primary-200 rounded-full bg-primary-50/60 px-3 py-1 text-xs text-primary-700 transition-colors dark:border-primary-800/80 dark:bg-primary-950/40 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/60"
              @click="safeAppendMannerismPrompt(THINK_ALOUD_TEMPLATE)"
            >
              <span class="i-solar:magic-stick-3-bold text-xs" />
              <span>Insert &lt;think_aloud&gt; CoT Template</span>
            </button>
            <button
              type="button"
              class="flex items-center gap-1.5 border border-primary-200 rounded-full bg-primary-50/60 px-3 py-1 text-xs text-primary-700 transition-colors dark:border-primary-800/80 dark:bg-primary-950/40 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/60"
              @click="safeAppendMannerismPrompt(PACING_STYLE_TEMPLATE)"
            >
              <span class="i-solar:magic-stick-3-bold text-xs" />
              <span>Insert Conversational Thinking Template</span>
            </button>
            <button
              v-for="item in props.actingMannerismOptions"
              :key="item.id"
              type="button"
              class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
              :title="item.description || item.label"
              @click="handleInsertSpeechMannerism(item.id)"
            >
              {{ item.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 3-Tier Aside Extraction Cascade Settings -->
      <div class="border border-neutral-200/80 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/60">
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <div class="i-solar:layers-bold-duotone text-base text-primary-500" />
                <h4 class="text-xs text-neutral-800 font-semibold tracking-wider uppercase dark:text-neutral-200">
                  3-Tier Aside Extraction Cascade
                </h4>
              </div>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                Multi-tier pipeline that extracts spoken thinking asides and vocalizations during deep reasoning.
              </p>
            </div>
            <span
              :class="[
                'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider',
                (pacingDynamicAsidesEnabled || pacingSemanticExtractorEnabled || pacingExperimentalOrganicPivots)
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700',
              ]"
            >
              {{ (pacingDynamicAsidesEnabled || pacingSemanticExtractorEnabled || pacingExperimentalOrganicPivots) ? 'Active' : 'Disabled' }}
            </span>
          </div>

          <!-- The 3 Tiers Stack -->
          <div class="flex flex-col gap-2.5 pt-1">
            <!-- Tier 1: Explicit Cues (<think_aloud>) -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5">
                  <input
                    id="tier-1-explicit-toggle"
                    :checked="pacingDynamicAsidesEnabled"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                    @change="onDynamicAsidesToggle"
                  >
                  <div class="flex flex-col gap-0.5">
                    <label for="tier-1-explicit-toggle" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                      Tier 1: Explicit Intent Markers (<code>&lt;think_aloud&gt;</code>)
                    </label>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Synthesizes on-the-fly vocalizations when the model emits intentional <code>&lt;think_aloud&gt;</code> markers during deep reasoning.
                    </p>
                  </div>
                </div>
                <span class="shrink-0 border border-amber-300/40 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-600 font-medium font-mono dark:border-amber-700/40 dark:bg-amber-400/15 dark:text-amber-300">
                  Zero Ambiguity
                </span>
              </div>
            </div>

            <!-- Tier 2: Cognitive Gating & Semantic Extraction (System 1 + Needle 3) -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5">
                  <input
                    id="tier-2-semantic-toggle"
                    v-model="pacingSemanticExtractorEnabled"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                  >
                  <div class="flex flex-col gap-0.5">
                    <label for="tier-2-semantic-toggle" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                      Tier 2: Cognitive Gating &amp; Subconscious Extraction (System 1 + Needle 3)
                    </label>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Universal System 1 (Jev / local ONNX / provider) classifies cognitive eligibility and hesitation shifts, while Needle 3 WebAssembly extracts the concise 2–8 word pivot span.
                    </p>
                  </div>
                </div>
                <span class="shrink-0 border border-blue-300/40 rounded bg-blue-500/10 px-1.5 py-0.5 text-[9px] text-blue-600 font-medium font-mono dark:border-blue-700/40 dark:bg-blue-400/15 dark:text-blue-300">
                  System 1 + Needle WASM
                </span>
              </div>

              <!-- Inline Prep & Status Panel (visible when enabled) -->
              <div v-if="pacingSemanticExtractorEnabled" class="mt-3 border-t border-neutral-200/70 pt-2.5 dark:border-neutral-800/70">
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <!-- System 1 Cognitive Classifier -->
                  <div class="flex items-center justify-between border border-neutral-200/60 rounded-lg bg-white/70 p-2 dark:border-neutral-800/60 dark:bg-neutral-900/60">
                    <div class="flex items-center gap-2">
                      <div class="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      <div class="flex flex-col">
                        <span class="text-[10px] text-neutral-400 font-semibold uppercase">Decision Engine</span>
                        <span class="text-[11px] text-neutral-700 font-medium dark:text-neutral-200">System 1 (Jev / ONNX)</span>
                      </div>
                    </div>
                    <span class="border border-emerald-300/40 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-600 font-medium font-mono dark:border-emerald-700/40 dark:bg-emerald-400/15 dark:text-emerald-300">
                      Active Gate
                    </span>
                  </div>

                  <!-- Needle 3 WASM Span Extractor -->
                  <div class="flex items-center justify-between border border-neutral-200/60 rounded-lg bg-white/70 p-2 dark:border-neutral-800/60 dark:bg-neutral-900/60">
                    <div class="flex items-center gap-2">
                      <div
                        class="h-2 w-2 rounded-full"
                        :class="isNeedlePrepared ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-500/70'"
                      />
                      <div class="flex flex-col">
                        <span class="text-[10px] text-neutral-400 font-semibold uppercase">Span Extractor</span>
                        <span class="text-[11px] text-neutral-700 font-medium dark:text-neutral-200">{{ isNeedlePrepared ? 'Needle 3 WASM (Laddered SAN)' : 'Needle 3 (Not in cache)' }}</span>
                      </div>
                    </div>
                    <button
                      v-if="!isNeedlePrepared"
                      type="button"
                      :disabled="isNeedleDownloading"
                      class="inline-flex items-center gap-1 border border-primary-500/30 rounded bg-primary-500/10 px-2 py-0.5 text-[10px] text-primary-600 font-medium transition disabled:cursor-not-allowed dark:border-primary-400/30 dark:bg-primary-400/15 hover:bg-primary-500/20 dark:text-primary-300 disabled:opacity-50"
                      @click="downloadAndPrepareNeedle"
                    >
                      <span v-if="isNeedleDownloading" class="i-solar:refresh-circle-bold animate-spin text-xs" />
                      <span v-else class="i-solar:bolt-bold text-xs" />
                      <span>{{ isNeedleDownloading ? `${needleDownloadProgress}%` : 'Pre-warm' }}</span>
                    </button>
                    <span v-else class="border border-emerald-300/40 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-600 font-medium font-mono dark:border-emerald-700/40 dark:bg-emerald-400/15 dark:text-emerald-300">
                      Pre-warmed
                    </span>
                  </div>
                </div>

                <!-- Download progress bar if in flight -->
                <div v-if="isNeedleDownloading" class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <div
                    class="h-full rounded-full bg-primary-500 transition-all duration-300"
                    :style="{ width: `${needleDownloadProgress}%` }"
                  />
                </div>

                <!-- Performance Advisory -->
                <div class="mt-2.5 flex items-start gap-2 border border-amber-200/70 rounded-lg bg-amber-50/70 p-2.5 text-[11px] text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0 text-xs text-amber-600 dark:text-amber-400" />
                  <p class="leading-relaxed">
                    <strong class="font-semibold">Performance Architecture:</strong> System 1 evaluates cognitive category and hesitation shifts at defined cadence intervals (~15s), while Needle 3 WebAssembly pinpoints the 2–8 word pivot span. If Needle is uninitialized, the engine automatically falls back to Tier 3 heuristic pattern extraction without blocking inference or stuttering UI.
                  </p>
                </div>
              </div>
            </div>

            <!-- Tier 3: Heuristic Keyword & Organic Pivots -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-start gap-2.5">
                  <input
                    id="tier-3-heuristics-toggle"
                    v-model="pacingExperimentalOrganicPivots"
                    type="checkbox"
                    class="mt-0.5 h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                  >
                  <div class="flex flex-col gap-0.5">
                    <label for="tier-3-heuristics-toggle" class="cursor-pointer text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                      Tier 3: Heuristic Pattern Matching & Organic Pivots
                    </label>
                    <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Detects organic thinking pivot sentences in raw CoT reasoning ("Wait, actually...", "Hmm, let me re-evaluate...") via pattern rules when higher tiers do not trigger.
                    </p>
                  </div>
                </div>
                <span class="shrink-0 border border-neutral-300/40 rounded bg-neutral-500/10 px-1.5 py-0.5 text-[9px] text-neutral-500 font-medium font-mono dark:border-neutral-700/40 dark:bg-neutral-400/15 dark:text-neutral-400">
                  Regex / Keywords
                </span>
              </div>
            </div>
          </div>

          <!-- Dynamic Aside Timing & Synthesis Sliders (visible if any tier active) -->
          <div v-if="pacingDynamicAsidesEnabled || pacingSemanticExtractorEnabled || pacingExperimentalOrganicPivots" class="grid grid-cols-1 gap-4 pt-2 md:grid-cols-3">
            <!-- Activation Delay (dynamicAfterMs) -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                  Dynamic Aside Delay
                </label>
                <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                  {{ (pacingDynamicAfterMs / 1000).toFixed(0) }}s
                </span>
              </div>
              <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Minimum reasoning time elapsed before live dynamic asides become eligible.
              </p>
              <input
                v-model.number="pacingDynamicAfterMs"
                type="range"
                min="5000"
                max="60000"
                step="1000"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>5s (Eager)</span>
                <span>15s (Balanced)</span>
                <span>60s (Deep CoT)</span>
              </div>
            </div>

            <!-- Candidate Expiry / TTL (candidateTtlMs) -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                  Candidate Expiry (TTL)
                </label>
                <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                  {{ (pacingCandidateTtlMs / 1000).toFixed(0) }}s
                </span>
              </div>
              <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Maximum freshness window before unvoiced cues expire.
              </p>
              <input
                v-model.number="pacingCandidateTtlMs"
                type="range"
                min="5000"
                max="45000"
                step="1000"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>5s (Fresh)</span>
                <span>15s (Default)</span>
                <span>45s (Extended)</span>
              </div>
            </div>

            <!-- Max Synthesis Budget (maxSynthesisBudgetMs) -->
            <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                  Dynamic Aside Synthesis Budget
                </label>
                <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                  {{ pacingMaxSynthesisBudgetMs }}ms
                </span>
              </div>
              <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Hard deadline for on-the-fly speech generation. Aborted if exceeded.
              </p>
              <input
                v-model.number="pacingMaxSynthesisBudgetMs"
                type="range"
                min="200"
                max="6000"
                step="50"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>200ms</span>
                <span>3200ms (Default)</span>
                <span>6000ms (Deep CoT)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Adaptive Latency Sliders -->
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
            Adaptive Latency & Thinking Thresholds
          </span>
          <button
            type="button"
            class="text-[11px] text-neutral-500 underline transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
            @click="resetThresholdsToDefaults"
          >
            Reset to Defaults
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Min Arm Delay -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Minimum Arm Delay
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                {{ pacingArmMinMs }}ms
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Earliest moment a filler can trigger during silent reasoning.
            </p>
            <input
              v-model.number="pacingArmMinMs"
              type="range"
              min="900"
              max="3500"
              step="50"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>900ms (Eager)</span>
              <span>1200ms (Default)</span>
              <span>3500ms (Patient)</span>
            </div>
          </div>

          <!-- Max Arm Ceiling -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Maximum Arm Ceiling
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                {{ pacingArmMaxMs }}ms
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Upper bound for adaptive arming on heavy multi-step turns.
            </p>
            <input
              v-model.number="pacingArmMaxMs"
              type="range"
              min="1500"
              max="6000"
              step="100"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>1500ms</span>
              <span>3500ms (Default)</span>
              <span>6000ms (Deep Work)</span>
            </div>
          </div>

          <!-- Max Filler Audio Duration -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Max Filler Audio Duration
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                {{ pacingMaxFillerDurationMs }}ms
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Phrases exceeding this duration are skipped to avoid talkover.
            </p>
            <input
              v-model.number="pacingMaxFillerDurationMs"
              type="range"
              min="800"
              max="6000"
              step="50"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>800ms (Snappy)</span>
              <span>3000ms (Default)</span>
              <span>6000ms (Deep CoT)</span>
            </div>
          </div>

          <!-- Category Classifier Sensitivity -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Reasoning Sensitivity Score
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                Score: {{ pacingCategoryThreshold }}
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Required confidence score from reasoning tokens before picking category.
            </p>
            <input
              v-model.number="pacingCategoryThreshold"
              type="range"
              min="1"
              max="10"
              step="1"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>1 (Instant match)</span>
              <span>3 (Moderate)</span>
              <span>10 (Strict)</span>
            </div>
          </div>

          <!-- Max Fillers Per Turn -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Max Fillers Per Turn
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                {{ pacingMaxFillersPerTurn }} phrases
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Maximum progression murmurs uttered during deep reasoning (1 for single-shot, 3–6 for deep CoT).
            </p>
            <input
              v-model.number="pacingMaxFillersPerTurn"
              type="range"
              min="1"
              max="8"
              step="1"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>1 (Single-shot)</span>
              <span>3 (Standard CoT)</span>
              <span>8 (Deep CoT)</span>
            </div>
          </div>

          <!-- Extended CoT Cadence -->
          <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-3.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
            <div class="flex items-center justify-between">
              <label class="text-xs text-neutral-800 font-medium dark:text-neutral-200">
                Extended CoT Cadence
              </label>
              <span class="text-xs text-primary-600 font-semibold font-mono dark:text-primary-400">
                {{ (pacingIntervalMs / 1000).toFixed(0) }}s
              </span>
            </div>
            <p class="mb-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              Spacing between milestone progression murmurs during long thinking phases.
            </p>
            <input
              v-model.number="pacingIntervalMs"
              type="range"
              min="5000"
              max="30000"
              step="1000"
              class="h-1.5 w-full cursor-pointer accent-primary-500"
            >
            <div class="flex items-center justify-between text-[10px] text-neutral-400">
              <span>5s (Fast)</span>
              <span>15s (Balanced)</span>
              <span>30s (Spacious)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pre-warm Audio Cache Banner -->
      <div class="border border-neutral-200/80 rounded-xl bg-white p-4 shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/60">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <div class="i-solar:bolt-bold text-amber-500" />
                <span class="text-xs text-neutral-800 font-semibold dark:text-neutral-200">
                  Pre-Warm Audio Cache
                </span>
                <span class="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-mono dark:bg-neutral-800">
                  {{ cachedFillersCount }}/{{ pacingFillers.length }} Cached
                </span>
              </div>
              <div class="text-[11px] text-neutral-500 dark:text-neutral-400">
                Target: <span class="font-mono">{{ props.selectedSpeechProviderLabel }}</span>
                <span v-if="props.selectedSpeechVoiceId" class="font-mono"> ({{ props.selectedSpeechVoiceId }})</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex items-center gap-1.5 border border-primary-500/30 rounded-lg bg-primary-50 px-3 py-1.5 text-xs text-primary-700 font-medium transition-colors dark:border-primary-500/40 dark:bg-primary-950/40 hover:bg-primary-100 dark:text-primary-300 disabled:opacity-50 dark:hover:bg-primary-900/50"
                :disabled="isPrewarming"
                @click="handlePrewarm"
              >
                <span v-if="isPrewarming" class="i-solar:refresh-bold animate-spin text-sm" />
                <span v-else class="i-solar:bolt-bold text-sm" />
                <span>{{ isPrewarming ? 'Synthesizing...' : 'Pre-warm Audio Cache' }}</span>
              </button>

              <button
                type="button"
                class="flex items-center gap-1 border border-neutral-200 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                title="Refresh cache status"
                :disabled="isCheckingCache || isPrewarming"
                @click="refreshCacheStatuses"
              >
                <span :class="['i-solar:refresh-bold text-sm', isCheckingCache ? 'animate-spin' : '']" />
              </button>

              <button
                type="button"
                class="flex items-center gap-1 border border-rose-200 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-600 transition-colors dark:border-rose-900/40 dark:bg-rose-950/30 hover:bg-rose-100 dark:text-rose-300 dark:hover:bg-rose-900/40"
                title="Clear thinking audio cache"
                :disabled="isPrewarming"
                @click="handleClearCache"
              >
                <span class="i-solar:trash-bin-trash-bold text-sm" />
                <span>Clear Cache</span>
              </button>
            </div>
          </div>

          <!-- Pre-warm Progress Bar -->
          <div v-if="isPrewarming && prewarmProgress" class="flex flex-col gap-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <div class="flex items-center justify-between text-[11px] text-neutral-500">
              <span>{{ prewarmProgress.currentText }}</span>
              <span>{{ prewarmProgress.completed }} / {{ prewarmProgress.total }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                class="h-full bg-primary-500 transition-all duration-300"
                :style="{ width: `${(prewarmProgress.completed / Math.max(prewarmProgress.total, 1)) * 100}%` }"
              />
            </div>
          </div>

          <!-- Error message if any -->
          <div v-if="prewarmError" class="text-xs text-rose-600 dark:text-rose-400">
            Pre-warming failed: {{ prewarmError }}
          </div>
        </div>
      </div>

      <!-- Filler Phrases Management -->
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
            Thinking Filler Phrases ({{ filteredFillers.length }})
          </span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="text-[11px] text-neutral-500 underline transition-colors hover:text-neutral-800 dark:hover:text-neutral-200"
              @click="resetToDefaultFillers"
            >
              Reset to Defaults
            </button>
          </div>
        </div>

        <!-- Category Filter Bar -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs rounded-lg transition-colors border',
              categoryFilter === 'all'
                ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-neutral-800 dark:border-neutral-200 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ]"
            @click="categoryFilter = 'all'"
          >
            All ({{ pacingFillers.length }})
          </button>
          <button
            v-for="cat in CATEGORY_OPTIONS"
            :key="cat.value"
            type="button"
            :class="[
              'px-2.5 py-1 text-xs rounded-lg transition-colors border',
              categoryFilter === cat.value
                ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 border-neutral-800 dark:border-neutral-200 font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800',
            ]"
            @click="categoryFilter = cat.value"
          >
            {{ cat.label }} ({{ pacingFillers.filter(f => f.category === cat.value).length }})
          </button>
        </div>

        <!-- Add Phrase Input Row -->
        <div class="flex flex-wrap items-center gap-2 border border-neutral-200/80 rounded-xl bg-neutral-50/60 p-2.5 dark:border-neutral-700/80 dark:bg-neutral-950/30">
          <input
            v-model="newPhraseText"
            type="text"
            placeholder="Enter new filler phrase (e.g. 'Let me ponder that...')"
            class="min-w-60 flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs outline-none transition-colors dark:border-neutral-700 focus:border-primary-400 dark:bg-neutral-800"
            @keydown.enter.prevent="addPhrase"
          >
          <select
            v-model="newPhraseCategory"
            class="border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option v-for="cat in CATEGORY_OPTIONS" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
          <button
            type="button"
            class="flex items-center gap-1 border border-primary-500/30 rounded-lg bg-primary-50 px-3 py-1.5 text-xs text-primary-700 font-medium transition-colors dark:border-primary-500/40 dark:bg-primary-950/40 hover:bg-primary-100 dark:text-primary-300 dark:hover:bg-primary-900/50"
            @click="addPhrase"
          >
            <span class="i-solar:add-circle-bold-duotone text-sm" />
            <span>Add Phrase</span>
          </button>
        </div>

        <!-- Phrases List Table -->
        <div class="flex flex-col gap-1.5">
          <div
            v-for="phrase in filteredFillers"
            :key="phrase.text"
            class="shadow-xs flex items-center justify-between gap-3 border border-neutral-200/80 rounded-xl bg-white p-3 transition-colors dark:border-neutral-700/80 hover:border-neutral-300 dark:bg-neutral-900/50 dark:hover:border-neutral-600"
          >
            <div class="flex flex-1 items-center gap-3">
              <input
                v-model="phrase.enabled"
                type="checkbox"
                class="h-4 w-4 border-gray-300 rounded text-primary-600 focus:ring-primary-500"
                title="Toggle phrase active"
              >
              <div class="flex flex-col gap-0.5">
                <span class="text-xs text-neutral-800 font-medium dark:text-neutral-200" :class="{ 'opacity-50 line-through': !phrase.enabled }">
                  "{{ phrase.text }}"
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <!-- Category Badge / Selector -->
              <select
                v-model="phrase.category"
                class="border rounded-md px-2 py-0.5 text-[11px] font-medium outline-none transition-colors"
                :class="getCategoryBadgeClass(phrase.category)"
              >
                <option v-for="cat in CATEGORY_OPTIONS" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </option>
              </select>

              <!-- Cache status chip -->
              <span
                :class="[
                  'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium',
                  cachedStatusMap[phrase.text]
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
                ]"
              >
                <span :class="cachedStatusMap[phrase.text] ? 'i-solar:check-circle-bold text-emerald-500' : 'i-solar:clock-circle-bold text-amber-500'" />
                <span>{{ cachedStatusMap[phrase.text] ? 'Cached' : 'Uncached' }}</span>
              </span>

              <!-- Play/Audition Button -->
              <button
                type="button"
                class="h-7 w-7 flex items-center justify-center border border-neutral-200 rounded-lg text-neutral-600 transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 hover:text-primary-600 dark:hover:bg-neutral-800"
                :title="playingText === phrase.text ? 'Stop preview' : 'Audition phrase audio'"
                @click="togglePlayFiller(phrase)"
              >
                <span :class="playingText === phrase.text ? 'i-solar:stop-circle-bold-duotone text-primary-500' : 'i-solar:play-circle-bold-duotone text-sm'" />
              </button>

              <!-- Delete Button -->
              <button
                type="button"
                class="h-7 w-7 flex items-center justify-center border border-transparent rounded-lg text-neutral-400 transition-colors hover:border-neutral-200 hover:text-rose-500 dark:hover:border-neutral-700"
                title="Remove phrase"
                @click="removePhrase(phrase.text)"
              >
                <span class="i-solar:trash-bin-trash-bold text-xs" />
              </button>
            </div>
          </div>

          <div v-if="filteredFillers.length === 0" class="py-6 text-center text-xs text-neutral-400 italic">
            No filler phrases found for this category.
          </div>
        </div>
      </div>

      <!-- Pacing & Proactivity / Thinking Model Tip -->
      <div class="flex items-start gap-2.5 border border-neutral-200/60 rounded-lg bg-neutral-50/60 p-3 text-xs text-neutral-500 dark:border-neutral-800/60 dark:bg-neutral-900/40 dark:text-neutral-400">
        <span class="i-solar:info-circle-bold-duotone mt-0.5 shrink-0 text-sm text-primary-500" />
        <span><strong>Tip:</strong> If a reasoning model deliberates before deciding to remain silent (such as during quiet background proactivity evaluations or returning <code>NO_REPLY</code>), filler phrases allow the avatar to naturally think out loud. For complete silent stealth, disable thinking fillers for that persona.</span>
      </div>
    </div>
  </div>
</template>
