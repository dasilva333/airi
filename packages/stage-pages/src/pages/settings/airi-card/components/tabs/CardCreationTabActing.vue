<script setup lang="ts">
import type { PrewarmProgressEvent } from '@proj-airi/stage-ui/libs/pacing'
import type { SpeechCapabilitiesInfo } from '@proj-airi/stage-ui/stores/providers'
import type { ThinkingCategory, ThinkingFillerPhrase } from '@proj-airi/stage-ui/types/pacing'

import {
  clearThinkingAudioCache,
  getThinkingAudio,
  isThinkingAudioCached,

  prewarmThinkingFillers,
} from '@proj-airi/stage-ui/libs/pacing'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { DEFAULT_PACING_FILLERS } from '@proj-airi/stage-ui/types/pacing'
import { FieldInput } from '@proj-airi/ui'
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  actingModelEmotionOptions: string[]
  actingModelMotionOptions: string[]
  actingGroupedExpressionTags: { category: string, tags: { tag: string, description?: string }[] }[]
  actingMannerismOptions: NonNullable<SpeechCapabilitiesInfo['mannerisms']>
  actingSpeechCapabilitiesLoading: boolean
  selectedSpeechProviderLabel: string
  isVrmaExpression: (name: string) => boolean
  isLive2d: boolean
  insertModelEmotion: (name: string) => void
  insertModelMotion: (name: string) => void
  insertModelVfx?: (name: string) => void
  insertSpeechTag: (tag: string, description?: string) => void
  insertSpeechMannerism: (id: string) => void
  actingIdleAnimationOptions: { label: string, value: string }[]
  selectedSpeechProvider?: string
  selectedSpeechModel?: string
  selectedSpeechVoiceId?: string
}>()

const emit = defineEmits<{
  (e: 'sparkle-click', fieldId: string): void
}>()

// Existing Acting Models
const selectedActingModelExpressionPrompt = defineModel<string>('selectedActingModelExpressionPrompt', { required: true })
const selectedActingSpeechExpressionPrompt = defineModel<string>('selectedActingSpeechExpressionPrompt', { required: true })
const selectedActingSpeechMannerismPrompt = defineModel<string>('selectedActingSpeechMannerismPrompt', { required: true })
const selectedActingIdleAnimations = defineModel<string[]>('selectedActingIdleAnimations', { required: true })

// Conversational Pacing Models
const pacingEnabled = defineModel<boolean>('pacingEnabled', { default: false })
const pacingArmMinMs = defineModel<number>('pacingArmMinMs', { default: 1200 })
const pacingArmMaxMs = defineModel<number>('pacingArmMaxMs', { default: 3500 })
const pacingMaxFillerDurationMs = defineModel<number>('pacingMaxFillerDurationMs', { default: 1200 })
const pacingCategoryThreshold = defineModel<number>('pacingCategoryThreshold', { default: 1 })
const pacingMaxFillersPerTurn = defineModel<number>('pacingMaxFillersPerTurn', { default: 3 })
const pacingIntervalMs = defineModel<number>('pacingIntervalMs', { default: 15000 })
const pacingFillers = defineModel<ThinkingFillerPhrase[]>('pacingFillers', {
  default: () => [...DEFAULT_PACING_FILLERS],
})

// Sub-Tab Navigation
type ActingSubTabId = 'expressions' | 'speech' | 'mannerisms' | 'pacing'
const activeSubTab = ref<ActingSubTabId>('expressions')

const subTabs = [
  { id: 'expressions' as const, label: 'Model Expressions', icon: 'i-solar:smile-circle-bold-duotone', desc: 'Emotions, motions, and idle loops' },
  { id: 'speech' as const, label: 'Speech Tags', icon: 'i-solar:soundwave-bold-duotone', desc: 'Audio expressions & caption FX' },
  { id: 'mannerisms' as const, label: 'Mannerisms', icon: 'i-solar:chat-round-dots-bold-duotone', desc: 'Vocal styles & dialect cues' },
  { id: 'pacing' as const, label: 'Pacing & Fillers', icon: 'i-solar:hourglass-bold-duotone', desc: 'Thinking fillers & latency pacing' },
]

function toggleIdleAnimation(name: string) {
  if (selectedActingIdleAnimations.value.includes(name)) {
    selectedActingIdleAnimations.value = selectedActingIdleAnimations.value.filter(n => n !== name)
  }
  else {
    selectedActingIdleAnimations.value = [...selectedActingIdleAnimations.value, name]
  }
}

const FALLBACK_MOOD_TAGS = [
  { tag: 'happy', description: 'Happy / Joy / Laugh / Grin / Smile' },
  { tag: 'flustered', description: 'Flustered / Blush / Shy / Heart-Curl Tail' },
  { tag: 'angry', description: 'Angry / Mad / Annoy / Jagged Starburst & Anger Mark 💢' },
  { tag: 'surprised', description: 'Surprise / Shock / Gasp / Impact Flash' },
  { tag: 'thinking', description: 'Thinking / Ponder / Cloud Bubble & Thought Dots' },
  { tag: 'sad', description: 'Sad / Cry / Sorrow / Drooping Tail & Raindrops' },
  { tag: 'yandere', description: 'Yandere / Possessive / Vignette & Heartbeat Pulse' },
  { tag: 'sleepy', description: 'Sleepy / Tired / Yawn / Floating Fireflies' },
]

const CAPTION_FX_STRUCTURAL_TAGS = [
  { snippet: 'u-um...', tag: 'Stutter', description: 'Flustered ➔ Blush Wash, Sweat Drop & Wobble' },
  { snippet: '(hmm... what if...)', tag: 'Parenthetical Aside', description: 'Inner Monologue ➔ Scalloped Cloud & Thought Dots' },
  { snippet: 'WHAT?! No way!!', tag: 'Punctuation Spike', description: 'Shock ➔ Impact Burst & Spring Scale Punch' },
  { snippet: 'Nya~ meow!', tag: 'Cat Speech', description: 'Playful ➔ Dynamic Wagging Tail' },
  { snippet: 'belong to me... 🖤', tag: 'Yandere Cue', description: 'Possessive ➔ Dark Vignette & Heartbeat Outline Pulse' },
]

const ELEMENTAL_VFX_OPTIONS = [
  { key: 'fire', label: '🔥 Fire Boost', token: '<|ACT:vfx="fire"|>', desc: 'Molten cinder fracture ground decal, bone-tethered ascending flame tongues & rising ember sparks.' },
  { key: 'electric', label: '⚡ Electric Boost', token: '<|ACT:vfx="electric"|>', desc: 'Concentric high-voltage discharge ground ring, biological Fresnel rim & crackling arc sparks.' },
  { key: 'magic', label: '✨ Magic Boost', token: '<|ACT:vfx="magic"|>', desc: 'Rotating arcane rune seal, ascending double-helical ribbons & floating starlight motes.' },
  { key: 'verdant', label: '🍃 Verdant Boost', token: '<|ACT:vfx="verdant"|>', desc: 'Sacred 8-fold lotus blossom mandala, creeping vine field & drifting bio-spores.' },
]

function onInsertVfx(vfxKey: string) {
  if (props.insertModelVfx) {
    props.insertModelVfx(vfxKey)
  }
  else {
    const line = `- <|ACT:vfx="${vfxKey}"|>`
    if (selectedActingModelExpressionPrompt.value?.includes(line))
      return
    const suffix = selectedActingModelExpressionPrompt.value?.endsWith('\n') || !selectedActingModelExpressionPrompt.value ? '' : '\n'
    selectedActingModelExpressionPrompt.value = `${selectedActingModelExpressionPrompt.value || ''}${suffix}${line}\n`
  }
}

// =========================================================================
// Pacing & Fillers Subsystem State & Methods
// =========================================================================
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
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <!-- Header Summary -->
    <div class="mb-4">
      <h3 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
        Acting & Behavioral Performance
      </h3>
      <p class="text-xs text-neutral-500 dark:text-neutral-400">
        Configure avatar expressions, speech tags, vocal mannerisms, and conversational pacing fillers.
      </p>
    </div>

    <!-- Sub-Navigation Segmented Pill Bar -->
    <div class="mb-5 flex flex-wrap items-center gap-1.5 border border-neutral-200 rounded-xl bg-neutral-100/70 p-1.5 dark:border-neutral-800 dark:bg-neutral-900/60">
      <button
        v-for="tab in subTabs"
        :key="tab.id"
        type="button"
        :class="[
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150',
          activeSubTab === tab.id
            ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm border border-neutral-200/80 dark:border-neutral-700'
            : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeSubTab = tab.id"
      >
        <span :class="[tab.icon, 'text-base']" />
        <span class="font-medium">{{ tab.label }}</span>
      </button>
    </div>

    <!-- Sub-Tab Panels Container -->
    <div class="border border-neutral-200/80 rounded-xl bg-white/70 p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40">
      <!-- ================================================================= -->
      <!-- 0. MODEL EXPRESSIONS SUB-TAB                                      -->
      <!-- ================================================================= -->
      <div v-if="activeSubTab === 'expressions'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <div class="i-solar:smile-circle-bold-duotone text-lg text-primary-500" />
              <h4 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Model Expressions & Kinetic Motions
              </h4>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Configure idle cycle animations, ACT emotion and motion prompt directives, and model kinetic capabilities.
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <!-- Idle Loop / Cycle Animations -->
          <div class="border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-700/70 dark:bg-neutral-950/30">
            <div class="mb-1 text-sm text-neutral-800 font-medium dark:text-neutral-200">
              Idle Loop / Cycle Animations
            </div>
            <div class="mb-3 text-xs text-neutral-500">
              Pick from the animations available which ones you would like for your character to cycle through automatically.
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="opt in actingIdleAnimationOptions"
                  :key="opt.value"
                  type="button"
                  class="flex items-center gap-1 border rounded-full px-3 py-1 text-xs outline-none transition-colors"
                  :class="[
                    selectedActingIdleAnimations.includes(opt.value)
                      ? 'bg-primary-50/50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 border-primary-200/50'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-primary-400 hover:text-primary-500',
                  ]"
                  @click="toggleIdleAnimation(opt.value)"
                >
                  <div class="i-solar:running-bold-duotone text-[10px]" />
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <!-- ACT / Model Expressions Prompt -->
          <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
            <div class="max-w-full">
              <label class="flex flex-col gap-4">
                <div>
                  <div class="flex items-center gap-1 text-sm font-medium">
                    ACT / Model Expressions & Capabilities
                  </div>
                  <div class="text-xs text-neutral-500 dark:text-neutral-400">
                    Teach AIRI how to emit ACT tokens for avatar emotions/outfits and motion cues.
                  </div>
                </div>
                <div class="relative w-full">
                  <textarea
                    v-model="selectedActingModelExpressionPrompt"
                    rows="6"
                    placeholder="ACT / Model Expressions"
                    class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
                  />
                  <button
                    type="button"
                    style="position: absolute; top: 8px; right: 8px; z-index: 50; display: flex; height: 32px; width: 32px; align-items: center; justify-center; border-radius: 8px; border: none; cursor: pointer; background: transparent;"
                    class="text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                    title="Optimize with AI"
                    @click.prevent="emit('sparkle-click', 'actingModelExpression')"
                  >
                    <span class="i-ph:sparkle animate-pulse text-lg" style="display: inline-block; width: 1.2em; height: 1.2em;" />
                  </button>
                </div>
              </label>
            </div>

            <div class="mt-4 flex flex-col gap-4">
              <!-- Emotions & Outfits Section -->
              <div class="flex flex-col gap-2">
                <div class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                  🎨 Emotions & Outfits <span v-if="actingModelEmotionOptions.length">({{ actingModelEmotionOptions.length }})</span>
                </div>
                <div v-if="actingModelEmotionOptions.length" class="flex flex-wrap gap-2">
                  <button
                    v-for="name in actingModelEmotionOptions"
                    :key="name"
                    type="button"
                    class="flex items-center gap-1 border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                    @click="insertModelEmotion(name)"
                  >
                    <div class="i-solar:palette-bold-duotone text-[10px]" />
                    {{ name }}
                  </button>
                </div>
                <div v-else class="text-xs text-neutral-400 italic">
                  No emotion/outfit variants surfaced for this model.
                </div>
              </div>

              <!-- Motions & Animations Section -->
              <div class="flex flex-col gap-2">
                <div class="text-xs text-neutral-600 font-medium dark:text-neutral-300">
                  🏃 Motions & Animations <span v-if="actingModelMotionOptions.length">({{ actingModelMotionOptions.length }})</span>
                </div>
                <div v-if="actingModelMotionOptions.length" class="flex flex-wrap gap-2">
                  <button
                    v-for="name in actingModelMotionOptions"
                    :key="name"
                    type="button"
                    class="flex items-center gap-1 border border-primary-200/50 rounded-full bg-primary-50/50 px-3 py-1 text-xs text-primary-700 transition-colors dark:border-primary-900/40 hover:border-primary-400 dark:bg-primary-900/20 dark:text-primary-300 hover:text-primary-500"
                    @click="insertModelMotion(name)"
                  >
                    <div class="i-solar:running-bold-duotone text-[10px]" />
                    {{ name }}
                  </button>
                </div>
                <div v-else class="text-xs text-neutral-400 italic">
                  No motion cues surfaced for this model.
                </div>
              </div>

              <!-- Elemental VFX & Auras Section -->
              <div v-if="!isLive2d" class="flex flex-col gap-2">
                <div class="flex items-center justify-between text-xs text-neutral-600 font-medium dark:text-neutral-300">
                  <div class="flex items-center gap-1.5">
                    <div class="i-solar:fire-bold-duotone text-orange-500" />
                    <span>✨ Elemental VFX & Auras (3D / VRM / MMD)</span>
                  </div>
                  <span class="text-[10px] text-neutral-400 font-normal">Kinetic Auras & Ground Decals</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="vfx in ELEMENTAL_VFX_OPTIONS"
                    :key="vfx.key"
                    type="button"
                    class="flex cursor-pointer items-center gap-1.5 border border-orange-200/50 rounded-full bg-orange-50/40 px-3 py-1 text-xs text-orange-800 transition-colors dark:border-orange-900/40 hover:border-orange-400 dark:bg-orange-950/20 dark:text-orange-300 hover:text-orange-600"
                    :title="vfx.desc"
                    @click="onInsertVfx(vfx.key)"
                  >
                    <span>{{ vfx.label }}</span>
                    <span class="text-[10px] font-mono opacity-70">{{ vfx.token }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 1. SPEECH TAGS SUB-TAB                                            -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'speech'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <div class="i-solar:soundwave-bold-duotone text-lg text-primary-500" />
              <h4 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Speech Tags & Audio Expressions
              </h4>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Teach AIRI how to use provider-side vocal tags and trigger head-tethered caption effects.
            </p>
          </div>
        </div>

        <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
          <div class="max-w-full">
            <label class="flex flex-col gap-4">
              <div>
                <div class="flex items-center gap-1 text-sm font-medium">
                  Speech Tags / Audio Expressions
                </div>
                <div class="text-xs text-neutral-500 dark:text-neutral-400">
                  Teach AIRI how to use provider-side vocal tags when the selected speech provider supports them.
                </div>
              </div>
              <div class="relative w-full">
                <textarea
                  v-model="selectedActingSpeechExpressionPrompt"
                  rows="6"
                  placeholder="Speech Tags / Audio Expressions"
                  class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
                />
                <button
                  type="button"
                  style="position: absolute; top: 8px; right: 8px; z-index: 50; display: flex; height: 32px; width: 32px; align-items: center; justify-content: center; border-radius: 8px; border: none; cursor: pointer; background: transparent;"
                  class="text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                  title="Optimize with AI"
                  @click.prevent="emit('sparkle-click', 'actingSpeechExpression')"
                >
                  <span class="i-ph:sparkle animate-pulse text-lg" style="display: inline-block; width: 1.2em; height: 1.2em;" />
                </button>
              </div>
            </label>
          </div>

          <div class="mt-4 flex flex-col gap-3">
            <div class="text-xs text-neutral-500">
              Speech tag helpers for provider
              <span class="text-neutral-700 font-medium dark:text-neutral-200">{{ selectedSpeechProviderLabel }}</span>
            </div>
            <div v-if="actingSpeechCapabilitiesLoading" class="text-xs text-neutral-400">
              Loading speech capability helpers...
            </div>
            <div v-else-if="actingGroupedExpressionTags.length" class="flex flex-col gap-3">
              <div v-for="group in actingGroupedExpressionTags" :key="group.category" class="flex flex-col gap-2">
                <div class="text-xs text-neutral-500 tracking-wide uppercase">
                  {{ group.category }}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="tag in group.tags"
                    :key="`${group.category}:${tag.tag}`"
                    type="button"
                    class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                    :title="tag.description || tag.tag"
                    @click="insertSpeechTag(tag.tag, tag.description)"
                  >
                    [{{ tag.tag }}]
                  </button>
                </div>
              </div>
            </div>
            <div v-else class="flex flex-col gap-3">
              <div class="border border-primary-200/60 rounded-lg bg-primary-50/40 p-2.5 text-xs text-primary-900/80 dark:border-primary-800/40 dark:bg-primary-950/30 dark:text-primary-200">
                💡 <strong>Head-Tethered Caption FX:</strong> AIRI's live speech bubble dynamically morphs its vector shape, wags its tail, and renders WebGL ambient effects (hearts, rain, scanlines, starbursts) from these cues!
              </div>

              <div class="flex flex-col gap-1.5">
                <div class="text-xs text-neutral-400 font-medium">
                  Bracket Mood Tags
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="item in FALLBACK_MOOD_TAGS"
                    :key="item.tag"
                    type="button"
                    class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                    :title="item.description"
                    @click="insertSpeechTag(item.tag, item.description)"
                  >
                    [{{ item.tag }}]
                  </button>
                </div>
              </div>

              <div class="mt-1 flex flex-col gap-1.5">
                <div class="text-xs text-neutral-400 font-medium">
                  Structural & Punctuation Cues
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="item in CAPTION_FX_STRUCTURAL_TAGS"
                    :key="item.tag"
                    type="button"
                    class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                    :title="item.description"
                    @click="insertSpeechTag(item.snippet, item.description)"
                  >
                    {{ item.tag }}: <span class="font-mono opacity-80">{{ item.snippet }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 2. MANNERISMS SUB-TAB                                             -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'mannerisms'" class="flex flex-col gap-6">
        <div class="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <div class="i-solar:chat-round-dots-bold-duotone text-lg text-primary-500" />
              <h4 class="text-sm text-neutral-800 font-semibold dark:text-neutral-100">
                Vocal Mannerisms & Speech Patterns
              </h4>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Teach AIRI character-specific speech habits and mannerisms supported by the active speech engine.
            </p>
          </div>
        </div>

        <div class="border border-neutral-200 rounded-xl p-4 dark:border-neutral-700">
          <FieldInput
            v-model="selectedActingSpeechMannerismPrompt"
            label="Speech Mannerisms"
            description="Teach AIRI when to use provider-supported speech mannerisms without exposing raw transformation internals."
            :single-line="false"
          />
          <div class="mt-3 flex flex-col gap-3">
            <div class="text-xs text-neutral-500">
              Insert helper blurbs from the current speech provider
            </div>
            <div v-if="actingMannerismOptions.length" class="flex flex-wrap gap-2">
              <button
                v-for="item in actingMannerismOptions"
                :key="item.id"
                type="button"
                class="border border-neutral-200 rounded-full px-3 py-1 text-xs text-neutral-600 transition-colors dark:border-neutral-700 hover:border-primary-400 dark:text-neutral-300 hover:text-primary-500"
                :title="item.description || item.label"
                @click="insertSpeechMannerism(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
            <div v-else class="text-xs text-neutral-400">
              No provider-side mannerism helpers are currently available for this speech provider.
            </div>
          </div>
        </div>
      </div>

      <!-- ================================================================= -->
      <!-- 3. PACING & FILLERS SUB-TAB                                       -->
      <!-- ================================================================= -->
      <div v-else-if="activeSubTab === 'pacing'" class="flex flex-col gap-6">
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
                Conversational Pacing & Thinking Fillers
              </label>
            </div>
            <p class="pl-6 text-xs text-neutral-500 dark:text-neutral-400">
              Bridges network and reasoning latency by playing cached audio filler phrases ("Hmm...", "Let me check that...") when model inference exceeds the latency deadline.
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

        <!-- Adaptive Latency Sliders -->
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="text-xs text-neutral-700 font-semibold tracking-wider uppercase dark:text-neutral-300">
              Adaptive Latency & Pacing Thresholds
            </span>
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
                min="400"
                max="2200"
                step="50"
                class="h-1.5 w-full cursor-pointer accent-primary-500"
              >
              <div class="flex items-center justify-between text-[10px] text-neutral-400">
                <span>400ms (Snappy)</span>
                <span>1200ms (Default)</span>
                <span>2200ms</span>
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
          <span><strong>Tip:</strong> If a reasoning model deliberates before deciding to remain silent (such as during quiet background proactivity evaluations or returning <code>NO_REPLY</code>), filler phrases allow the avatar to naturally think out loud. For complete silent stealth, disable pacing for that persona.</span>
        </div>
      </div>
    </div>
  </div>
</template>
