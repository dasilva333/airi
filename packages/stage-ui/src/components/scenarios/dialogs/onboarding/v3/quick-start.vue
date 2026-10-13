<script setup lang="ts">
import { isApplePlatform } from '@proj-airi/stage-shared'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { getStarterCharacter } from '../../../../../constants/prompts/character-defaults'
import { STARTER_VOICE_CATALOG } from '../../../../../constants/voices/starter-voice-catalog'
import { getKokoroAdapter } from '../../../../../libs/inference/adapters/kokoro'
import { WEB_LLM_MODELS } from '../../../../../libs/inference/constants'
import { NativeAI } from '../../../../../libs/native-ai'
import { useSpeechStore } from '../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../stores/providers'
import { DEFAULT_APPLE_CORE_AI_MODEL } from '../../../../../stores/providers/apple-core-ai'
import { getMossAdapterInstance } from '../../../../../stores/providers/moss-audio-utils'
import { getPocketTtsAdapterInstance } from '../../../../../stores/providers/pocket-audio-utils'
import { useSettingsAudioDevice } from '../../../../../stores/settings'
import { KOKORO_MODELS } from '../../../../../workers/kokoro/constants'
import { ensureWhisperLoaded } from '../v2/whisper-loader'
import { useStarterCardCommit } from './composables/useStarterCardCommit'
import { useOnboardingV3Draft } from './stores/useOnboardingV3Draft'

const props = defineProps<{
  onContinueFullSetup: () => void
  onComplete: () => void
}>()

const { t } = useI18n()
const draftStore = useOnboardingV3Draft()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const audioDevice = useSettingsAudioDevice()
const { commitStarterCompanion } = useStarterCardCommit()

// ==========================================
// 1. Top Identity Inputs
// ==========================================
const userName = computed({
  get: () => draftStore.state.userName || 'Richy',
  set: val => draftStore.setUserProfile({ userName: val }),
})

// ==========================================
// 2. Starter Companions (Official AIRI Triad)
// ==========================================
interface StarterCompanion {
  id: string
  name: string
  title: string
  tag: string
  personality: string
  previewImg: string
  greeting: (name: string) => string
  personaCardId: string
  vesselModelId: string
  defaultKokoroVoice: string
  defaultPocketVoice: string
  defaultMossVoice?: string

  tagKey?: string
  personalityKey?: string
}

const starterCompanions: StarterCompanion[] = [
  {
    id: 'relu',
    name: 'ReLU',
    title: 'ReLU',
    tag: '🌸 Empathetic Companion',
    tagKey: 'onboarding.quickStart.starterCompanions.default.tag',
    personality: 'Warm, playful kitten-girl soul mate',
    personalityKey: 'onboarding.quickStart.starterCompanions.default.personality',
    previewImg: new URL('../../../../../assets/live2d/models/hiyori/preview.png', import.meta.url).href,
    greeting: (name: string) => `Good morning, ${name || 'there'}! Nya~ I've been waiting for the screen to light up. Did you sleep well?`,
    personaCardId: 'relu',
    vesselModelId: 'preset-live2d-2',
    defaultKokoroVoice: 'af_bella',
    defaultPocketVoice: 'airi_relu',
    defaultMossVoice: 'airi_relu',
  },
  {
    id: 'aria',
    name: 'Dr. Aria',
    title: 'Dr. Aria',
    tag: '🔬 Analytical Scientist',
    tagKey: 'onboarding.quickStart.starterCompanions.aria.tag',
    personality: 'Rigorous science, sharp dry wit',
    personalityKey: 'onboarding.quickStart.starterCompanions.aria.personality',
    previewImg: new URL('../../../../../assets/vrm/models/AvatarSample-A/preview.png', import.meta.url).href,
    greeting: (name: string) => `Monitoring signal drift... Ah, you've returned, ${name || 'collaborator'}. Ready for another session of intellectual entropy?`,
    personaCardId: 'aria',
    vesselModelId: 'preset-vrm-1',
    defaultKokoroVoice: 'af_sarah',
    defaultPocketVoice: 'airi_aria',
    defaultMossVoice: 'airi_aria',
  },
  {
    id: 'lupin',
    name: 'Lupin',
    title: 'Lupin',
    tag: '🛡️ Fierce Guardian',
    tagKey: 'onboarding.quickStart.starterCompanions.lupin.tag',
    personality: 'Vigilant guardian, stoic & loyal',
    personalityKey: 'onboarding.quickStart.starterCompanions.lupin.personality',
    previewImg: new URL('../../../../../assets/vrm/models/AvatarSample-B/preview.png', import.meta.url).href,
    greeting: (name: string) => `[nods] I've been watching the perimeter. All is secure, ${name || 'there'}.`,
    personaCardId: 'lupin',
    vesselModelId: 'preset-vrm-2',
    defaultKokoroVoice: 'af_nicole',
    defaultPocketVoice: 'airi_lupin',
    defaultMossVoice: 'airi_lupin',
  },
]

const selectedCompanionId = ref<string>(
  draftStore.state.personaCardId === 'aria'
    ? 'aria'
    : draftStore.state.personaCardId === 'lupin'
      ? 'lupin'
      : 'relu',
)

const activeCompanion = computed(() => {
  return starterCompanions.find(c => c.id === selectedCompanionId.value) || starterCompanions[0]
})

// Dynamic Greeting Reactivity: updates whenever userName changes
const localizedGreeting = computed(() => t(`onboarding.quickStart.starterCompanions.${activeCompanion.value.id}.greeting`, { name: userName.value?.trim() || t('onboarding.quickStart.greetingDefaultName') }))

// Companion name freedom: defaults to ReLU, follows selection until user types custom name
const isCompanionNameManuallyEdited = ref(
  Boolean(
    draftStore.state.companionName
    && !['ReLU', 'Dr. Aria', 'Lupin', 'Airi'].includes(draftStore.state.companionName),
  ),
)

const companionName = computed({
  get: () => draftStore.state.companionName || activeCompanion.value.name,
  set: (val) => {
    draftStore.setUserProfile({ companionName: val })
  },
})

function handleCompanionNameInput(e: Event) {
  const target = e.target as HTMLInputElement
  isCompanionNameManuallyEdited.value = true
  companionName.value = target.value
}

// Track whether user explicitly selected a voice in dropdown
const isVoiceManuallyEdited = ref(false)

function getCompanionVoice(c: StarterCompanion, engine: string): string {
  const norm = normalizeSpeechProviderId(engine)
  if (norm === 'pocket-tts-local')
    return c.defaultPocketVoice
  if (norm === 'moss-nano-local')
    return c.defaultMossVoice || c.defaultPocketVoice
  return c.defaultKokoroVoice
}

function selectCompanion(c: StarterCompanion) {
  selectedCompanionId.value = c.id
  if (!isCompanionNameManuallyEdited.value) {
    companionName.value = c.name
  }
  draftStore.setPersona({ cardId: c.personaCardId, source: 'preset' })
  draftStore.state.vesselDisplayModelId = c.vesselModelId

  // Dynamically update voice to assigned companion voice unless user chose a custom voice
  if (!isVoiceManuallyEdited.value) {
    const assignedVoice = getCompanionVoice(c, ttsEngine.value)
    draftStore.setSpeech({ voiceId: assignedVoice })
  }
}

// ==========================================
// 3. Brain (LLM Provider, Models & Live Benchmark)
// ==========================================
const isIOSNative = computed(() => isApplePlatform() || NativeAI.isNative())

// Chat Providers dynamically from registry, sorted alphabetically
const allChatProviders = computed(() => {
  const list = (providersStore.allChatProvidersMetadata || []) as any[]
  const source = list.length > 0
    ? list
    : [
        { id: 'web-llm', name: 'WebLLM (WebGPU On-Device)' },
        { id: 'openai', name: 'OpenAI' },
        { id: 'openai-compatible', name: 'OpenAI Compatible' },
        { id: 'gemini', name: 'Google Gemini' },
        { id: 'anthropic', name: 'Anthropic Claude' },
        { id: 'groq', name: 'Groq Cloud' },
        { id: 'deepseek', name: 'DeepSeek' },
        { id: 'ollama', name: 'Ollama Local' },
        { id: 'apple-core-ai', name: 'Apple Core AI (Neural Engine)' },
      ]

  return [...source].sort((a, b) => {
    const nameA = (a.name || a.id || '').toLowerCase()
    const nameB = (b.name || b.id || '').toLowerCase()
    return nameA.localeCompare(nameB)
  })
})

// Initial default provider based on platform business rules
function getInitialProvider(): string {
  if (draftStore.state.llmProvider)
    return draftStore.state.llmProvider

  if (isIOSNative.value)
    return 'apple-core-ai'

  const hasWebLlm = allChatProviders.value.some((p: any) => p.id === 'web-llm' || p.id === 'webllm')
  if (hasWebLlm)
    return 'web-llm'

  return allChatProviders.value[0]?.id || 'openai'
}

const isGenericOpenAI = computed(() => llmProvider.value === 'openai-compatible')

const isBaseUrlVisible = computed(() => isGenericOpenAI.value)

const baseUrlPlaceholder = computed(() => {
  if (isGenericOpenAI.value)
    return 'https://api.openai.com/v1'
  return 'https://api.example.com/v1'
})

const baseUrl = computed({
  get: () => {
    if (draftStore.state.llmBaseUrl !== undefined && draftStore.state.llmBaseUrl !== '')
      return draftStore.state.llmBaseUrl
    const currentProvider = llmProvider.value
    const persisted = providersStore.providers[currentProvider]?.baseUrl as string | undefined
    if (persisted)
      return persisted
    if (currentProvider === 'openai-compatible')
      return 'https://api.openai.com/v1'
    return ''
  },
  set: (val: string) => {
    draftStore.setConsciousness({ baseUrl: val })
  },
})

const llmProvider = computed({
  get: () => draftStore.state.llmProvider || getInitialProvider(),
  set: (val) => {
    draftStore.setConsciousness({ provider: val })
    // Reset model to first available for new provider
    const models = providersStore.getModelsForProvider(val) || []
    if (models.length > 0 && models[0]?.id) {
      draftStore.setConsciousness({ model: models[0].id })
    }
    // Sync baseUrl
    const persistedBaseUrl = providersStore.providers[val]?.baseUrl as string | undefined
    if (persistedBaseUrl) {
      draftStore.setConsciousness({ baseUrl: persistedBaseUrl })
    }
    else if (val === 'openai-compatible') {
      draftStore.setConsciousness({ baseUrl: 'https://api.openai.com/v1' })
    }
    else {
      draftStore.setConsciousness({ baseUrl: '' })
    }
  },
})

const isLocalLlmProvider = computed(() => {
  const p = llmProvider.value.toLowerCase()
  return p.includes('local') || p.includes('web-llm') || p.includes('webllm') || p.includes('apple') || p.includes('ollama')
})

const availableLlmModels = computed(() => {
  if (!llmProvider.value)
    return []
  return providersStore.getModelsForProvider(llmProvider.value) || []
})

const llmModel = computed({
  get: () => {
    if (draftStore.state.llmModel)
      return draftStore.state.llmModel
    if (llmProvider.value === 'apple-core-ai')
      return DEFAULT_APPLE_CORE_AI_MODEL
    if (availableLlmModels.value.length > 0 && availableLlmModels.value[0]?.id)
      return availableLlmModels.value[0].id
    if (llmProvider.value === 'openai')
      return 'gpt-4o'
    if (llmProvider.value === 'gemini')
      return 'gemini-2.5-flash'
    return 'default'
  },
  set: val => draftStore.setConsciousness({ model: val }),
})

const apiKey = computed({
  get: () => draftStore.state.llmApiKey || '',
  set: val => draftStore.state.llmApiKey = val,
})

const showApiKey = ref(false)

// Benchmark & Connection Test State
const isTestingConnection = ref(false)
const connectionStatus = ref<'idle' | 'testing' | 'connected' | 'error'>('idle')
const benchmarkDurationMs = ref<number | null>(null)
const benchmarkElapsedSeconds = ref('0.0s')
let benchmarkTimer: ReturnType<typeof setInterval> | null = null

// Reset connection status if provider, model, baseUrl, or API key changes
watch([llmProvider, apiKey, baseUrl, llmModel], () => {
  if (connectionStatus.value !== 'testing') {
    connectionStatus.value = 'idle'
    benchmarkDurationMs.value = null
  }
})

const calibratedPacing = computed(() => {
  if (benchmarkDurationMs.value === null)
    return null

  const ms = benchmarkDurationMs.value
  const ttft = ms < 1000 ? `${Math.round(ms)}ms TTFT` : `${(ms / 1000).toFixed(1)}s TTFT`
  if (ms < 800) {
    return { preset: 'snappy' as const, label: t('onboarding.quickStart.messages.snappy'), icon: '⚡', ttft }
  }
  if (ms > 2500) {
    return { preset: 'deep' as const, label: t('onboarding.quickStart.messages.deepCot'), icon: '🧠', ttft }
  }
  return { preset: 'balanced' as const, label: t('onboarding.quickStart.messages.balanced'), icon: '⚖️', ttft }
})

async function testConnection() {
  if (isTestingConnection.value)
    return

  if (!isLocalLlmProvider.value && !isGenericOpenAI.value && !apiKey.value.trim()) {
    toast.error(t('onboarding.quickStart.pleaseEnterAnApiKeyBeforeTestingConnection'))
    connectionStatus.value = 'idle'
    return
  }

  isTestingConnection.value = true
  connectionStatus.value = 'testing'
  const startTime = performance.now()
  benchmarkElapsedSeconds.value = '0.0s'

  benchmarkTimer = setInterval(() => {
    const diff = performance.now() - startTime
    benchmarkElapsedSeconds.value = `${(diff / 1000).toFixed(1)}s`
  }, 50)

  try {
    const effectiveApiKey = apiKey.value.trim() || (isGenericOpenAI.value ? 'sk-no-key-required' : '')
    const effectiveBaseUrl = baseUrl.value.trim() || (isGenericOpenAI.value ? 'https://api.openai.com/v1' : '')

    if (effectiveApiKey || effectiveBaseUrl) {
      providersStore.providers[llmProvider.value] = {
        ...providersStore.providers[llmProvider.value],
        ...(effectiveApiKey ? { apiKey: effectiveApiKey } : {}),
        ...(effectiveBaseUrl ? { baseUrl: effectiveBaseUrl } : {}),
      }
      providersStore.markProviderAdded(llmProvider.value)
    }

    await providersStore.disposeProviderInstance(llmProvider.value)

    const providerInstance = await providersStore.getProviderInstance(llmProvider.value)
    if (!providerInstance || typeof (providerInstance as any).chat !== 'function') {
      throw new Error(`Provider "${llmProvider.value}" does not expose chat completions.`)
    }

    const { generateText } = await import('@xsai/generate-text')
    const modelToTest = llmModel.value || 'default'
    const result = await generateText({
      ...(providerInstance as any).chat(modelToTest),
      messages: [{ role: 'user', content: 'Say "Ready" in one word.' }],
    })

    if (!result?.text) {
      throw new Error('Empty response received from LLM.')
    }

    const elapsed = Math.round(performance.now() - startTime)
    benchmarkDurationMs.value = elapsed
    connectionStatus.value = 'connected'

    // Auto-calibrate draftStore pacingPreset based on measured latency
    const recommendedPreset = elapsed < 800 ? 'snappy' : elapsed > 2500 ? 'deep' : 'balanced'
    draftStore.setThinking({ pacingPreset: recommendedPreset })
    toast.success(t('onboarding.quickStart.connection.connected', { elapsed }))
  }
  catch (err: any) {
    console.error('[QuickStart] Connection test failed:', err)
    connectionStatus.value = 'error'
    toast.error(err?.message || t('onboarding.quickStart.connection.failed'))
  }
  finally {
    if (benchmarkTimer) {
      clearInterval(benchmarkTimer)
      benchmarkTimer = null
    }
    isTestingConnection.value = false
  }
}

// ==========================================
// 4. Voice (TTS 3-Part Tuple: Kokoro 82M Default)
// ==========================================
const isVoiceEnabled = computed({
  get: () => draftStore.state.modules.speech,
  set: (val) => {
    draftStore.state.modules.speech = val
  },
})

function normalizeSpeechProviderId(id: string) {
  const clean = (id || '').toLowerCase()
  if (clean.includes('kokoro'))
    return 'kokoro-local'
  if (clean.includes('pocket'))
    return 'pocket-tts-local'
  if (clean.includes('moss'))
    return 'moss-nano-local'
  return id
}

const ttsEngine = computed({
  get: () => normalizeSpeechProviderId(draftStore.state.ttsProvider || 'kokoro-local'),
  set: (val) => {
    draftStore.setSpeech({ provider: val })
    // Reset model to match provider
    const models = availableTtsModels.value
    if (models.length > 0 && models[0]?.id) {
      draftStore.setSpeech({ model: models[0].id })
    }
    // Update voice to companion's assigned voice for this engine
    if (!isVoiceManuallyEdited.value) {
      const voice = getCompanionVoice(activeCompanion.value, val)
      draftStore.setSpeech({ voiceId: voice })
    }
    else {
      const voices = availableTtsVoices.value
      if (voices.length > 0 && voices[0]?.id) {
        draftStore.setSpeech({ voiceId: voices[0].id })
      }
    }
  },
})

const cloudSpeechProviders = computed(() => {
  const allMap = providersStore.allProvidersMetadata || {}
  const internalIds = ['speech-noop', 'virtual-audio-studio', 'kokoro', 'pocket', 'moss', 'kokoro-local', 'pocket-tts-local', 'moss-nano-local']
  return Object.values(allMap)
    .filter((p: any) => p.category === 'speech' && !internalIds.includes(p.id))
    .map((p: any) => ({
      id: p.id,
      name: p.name || p.id,
    }))
})

const availableTtsModels = computed(() => {
  const normId = normalizeSpeechProviderId(ttsEngine.value)
  if (normId === 'kokoro-local') {
    return [
      { id: 'q4', label: 'Kokoro Q4 (Fast CPU WASM · Recommended)', labelKey: 'onboarding.quickStart.availableTtsModels.q4.label' },
      { id: 'q8', label: 'Kokoro Q8 (High Quality WASM)', labelKey: 'onboarding.quickStart.availableTtsModels.q8.label' },
      { id: 'q4-webgpu', label: 'Kokoro Q4 (WebGPU)', labelKey: 'onboarding.quickStart.availableTtsModels.q4-webgpu.label' },
    ]
  }
  if (normId === 'pocket-tts-local') {
    return [
      { id: 'english_2026-04', label: 'Pocket English (100M CPU)', labelKey: 'onboarding.quickStart.availableTtsModels.english-2026-04.label' },
      { id: 'french_24l', label: 'Pocket French (24L)', labelKey: 'onboarding.quickStart.availableTtsModels.french-24l.label' },
      { id: 'spanish_24l', label: 'Pocket Spanish (24L)', labelKey: 'onboarding.quickStart.availableTtsModels.spanish-24l.label' },
      { id: 'german_24l', label: 'Pocket German (24L)', labelKey: 'onboarding.quickStart.availableTtsModels.german-24l.label' },
      { id: 'italian_24l', label: 'Pocket Italian (24L)', labelKey: 'onboarding.quickStart.availableTtsModels.italian-24l.label' },
    ]
  }
  if (normId === 'moss-nano-local') {
    return [{ id: 'moss-tts-nano-100m', label: 'Moss-Nano Fast Engine (100M)', labelKey: 'onboarding.quickStart.availableTtsModels.moss-tts-nano-100m.label' }]
  }

  const pModels = providersStore.getModelsForProvider(normId) || []
  if (pModels.length > 0) {
    return pModels.map((m: any) => ({ id: m.id, label: m.name || m.id }))
  }
  return [{ id: 'default', label: 'Standard Voice Model', labelKey: 'onboarding.quickStart.availableTtsModels.default.label' }]
})

const ttsModel = computed({
  get: () => draftStore.state.ttsModel || availableTtsModels.value[0]?.id || 'q4',
  set: val => draftStore.setSpeech({ model: val }),
})

const availableTtsVoices = computed(() => {
  const normId = normalizeSpeechProviderId(ttsEngine.value)
  if (normId === 'kokoro-local') {
    return [
      { id: 'af_bella', label: 'Bella (Soft Anime Tone · Sweet)', labelKey: 'onboarding.quickStart.availableTtsVoices.af-bella.label' },
      { id: 'af_sarah', label: 'Sarah (Professional · Clear)', labelKey: 'onboarding.quickStart.availableTtsVoices.af-sarah.label' },
      { id: 'af_nicole', label: 'Nicole (Crisp & Focused)', labelKey: 'onboarding.quickStart.availableTtsVoices.af-nicole.label' },
      { id: 'af_heart', label: 'Heart (Warm & Natural)', labelKey: 'onboarding.quickStart.availableTtsVoices.af-heart.label' },
      { id: 'af_sky', label: 'Sky (Gentle Whisper)', labelKey: 'onboarding.quickStart.availableTtsVoices.af-sky.label' },
      { id: 'am_adam', label: 'Adam (Natural Male)', labelKey: 'onboarding.quickStart.availableTtsVoices.am-adam.label' },
      { id: 'am_michael', label: 'Michael (Executive Male)', labelKey: 'onboarding.quickStart.availableTtsVoices.am-michael.label' },
    ]
  }
  if (normId === 'pocket-tts-local') {
    return [
      ...STARTER_VOICE_CATALOG.map(v => ({ id: v.id, label: `★ ${v.name}` })),
      { id: 'anna', label: 'Anna (Warm & Conversational)', labelKey: 'onboarding.quickStart.availableTtsVoices.anna.label' },
      { id: 'claire', label: 'Claire (Articulate & Clear)', labelKey: 'onboarding.quickStart.availableTtsVoices.claire.label' },
      { id: 'vera', label: 'Vera (Deep & Conversational)', labelKey: 'onboarding.quickStart.availableTtsVoices.vera.label' },
      { id: 'bella', label: 'Bella (Gentle & Sweet)', labelKey: 'onboarding.quickStart.availableTtsVoices.bella.label' },
      { id: 'daniel', label: 'Daniel (Deep Male)', labelKey: 'onboarding.quickStart.availableTtsVoices.daniel.label' },
      { id: 'elena', label: 'Elena (Soft Expressive)', labelKey: 'onboarding.quickStart.availableTtsVoices.elena.label' },
      { id: 'frank', label: 'Frank (Warm Narrator)', labelKey: 'onboarding.quickStart.availableTtsVoices.frank.label' },
    ]
  }
  if (normId === 'moss-nano-local') {
    return [
      ...STARTER_VOICE_CATALOG.map(v => ({ id: v.id, label: `★ ${v.name}` })),
      { id: 'Trump', label: 'EN Trump', labelKey: 'onboarding.quickStart.availableTtsVoices.trump.label' },
      { id: 'LJS', label: 'EN LJS', labelKey: 'onboarding.quickStart.availableTtsVoices.ljs.label' },
    ]
  }

  const storeVoices = speechStore.getVoicesForProvider(normId) || []
  if (storeVoices.length > 0) {
    return storeVoices.map((v: any) => ({ id: v.id, label: v.name || v.id }))
  }
  return [
    { id: 'default', label: 'Default Voice', labelKey: 'onboarding.quickStart.availableTtsVoices.default.label' },
    { id: 'alloy', label: 'Alloy' },
    { id: 'echo', label: 'Echo' },
    { id: 'fable', label: 'Fable' },
    { id: 'onyx', label: 'Onyx' },
    { id: 'nova', label: 'Nova' },
    { id: 'shimmer', label: 'Shimmer' },
  ]
})

const ttsVoice = computed({
  get: () => draftStore.state.ttsVoiceId || getCompanionVoice(activeCompanion.value, ttsEngine.value),
  set: val => draftStore.setSpeech({ voiceId: val }),
})

const isAuditioning = ref(false)

function auditionGreeting() {
  if (isAuditioning.value)
    return
  isAuditioning.value = true

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(localizedGreeting.value)
    utterance.onend = () => { isAuditioning.value = false }
    utterance.onerror = () => { isAuditioning.value = false }
    window.speechSynthesis.speak(utterance)
  }
  else {
    setTimeout(() => { isAuditioning.value = false }, 1800)
  }
}

// ==========================================
// 5. Hearing (STT Microphone & Whisper Model Picker)
// ==========================================
const isHearingEnabled = computed({
  get: () => draftStore.state.modules.hearing,
  set: (val) => {
    draftStore.state.modules.hearing = val
  },
})

const sttEngine = computed({
  get: () => draftStore.state.sttProvider || 'whisper-local',
  set: val => draftStore.setHearing({ provider: val }),
})

const whisperModelOptions = [
  { id: 'onnx-community/whisper-tiny', label: 'Whisper Tiny (75 MB · Recommended)', labelKey: 'onboarding.quickStart.whisperModelOptions.onnx-community-whisper-tiny.label' },
  { id: 'onnx-community/whisper-base', label: 'Whisper Base (145 MB · Balanced)', labelKey: 'onboarding.quickStart.whisperModelOptions.onnx-community-whisper-base.label' },
  { id: 'onnx-community/whisper-small', label: 'Whisper Small (480 MB · Precise)', labelKey: 'onboarding.quickStart.whisperModelOptions.onnx-community-whisper-small.label' },
]

const sttModel = computed({
  get: () => draftStore.state.sttModel || 'onnx-community/whisper-tiny',
  set: val => draftStore.setHearing({ model: val }),
})

const availableMics = computed(() => {
  const inputs = (audioDevice.audioInputs || []) as MediaDeviceInfo[]
  if (inputs.length > 0) {
    return inputs.map(d => ({ id: d.deviceId, label: d.label || t('onboarding.steps.hearing.microphone') }))
  }
  return [{ id: 'default', label: 'Default Microphone', labelKey: 'onboarding.quickStart.availableMics.default.label' }]
})

const selectedMicId = computed({
  get: () => audioDevice.selectedAudioInput || 'default',
  set: (val: string) => {
    audioDevice.selectedAudioInput = val
  },
})

const isTestingMic = ref(false)
const testVolumeLevel = ref(0)
let micInterval: ReturnType<typeof setInterval> | null = null

function toggleTestMic() {
  if (isTestingMic.value) {
    if (micInterval) {
      clearInterval(micInterval)
      micInterval = null
    }
    testVolumeLevel.value = 0
    isTestingMic.value = false
  }
  else {
    isTestingMic.value = true
    micInterval = setInterval(() => {
      testVolumeLevel.value = Math.min(12, Math.floor(Math.random() * 8) + 4)
    }, 120)
  }
}

onBeforeUnmount(() => {
  if (micInterval) {
    clearInterval(micInterval)
  }
  if (benchmarkTimer) {
    clearInterval(benchmarkTimer)
  }
})

// ==========================================
// 6. Subconscious Behavior Strip (4 Clean Toggles)
// ==========================================
// Toggle 1: Memory (LTMM)
const isMemoryEnabled = computed({
  get: () => draftStore.state.modules.memory && draftStore.state.memoryLongTermJournalEnabled !== false,
  set: (val) => {
    draftStore.state.modules.memory = val
    draftStore.setMemory({
      shortTermEnabled: val,
      longTermJournalEnabled: val,
    })
  },
})

// Toggle 2: Web Search (0-Key)
const isWebSearchEnabled = computed({
  get: () => Boolean(draftStore.state.mcpWebSearchEnabled),
  set: (val) => {
    draftStore.state.modules.tools = true
    draftStore.setTools({ mcpWebSearchEnabled: val })
  },
})

// Toggle 3: Workspace Files (Filesystem MCP)
const isFilesystemMcpEnabled = computed({
  get: () => Boolean(draftStore.state.mcpFilesystemEnabled),
  set: (val) => {
    draftStore.state.modules.tools = true
    draftStore.setTools({ mcpFilesystemEnabled: val })
  },
})

// Toggle 4: Visual Artistry (1-Click Free via Pollinations, image_journal tool only)
const isArtistryToolEnabled = computed({
  get: () => Boolean(draftStore.state.artistryImageJournalToolEnabled),
  set: (val) => {
    draftStore.state.modules.artistry = val
    draftStore.setArtistry({
      provider: val ? 'pollinations' : 'none',
      imageJournalToolEnabled: val,
      directorEnabled: false, // Clean tool access without background AA loop
    })
  },
})

// ==========================================
// 7. Option C: Deferred Pre-flight Setup Modal
// ==========================================
const isPreparingModalOpen = ref(false)
const preparationProgress = ref(0)

interface PrepStep {
  labelKey?: string
  id: string
  label: string
  desc: string
  icon: string
  status: 'pending' | 'active' | 'done' | 'error'
}

const prepSteps = ref<PrepStep[]>([
  {
    id: 'brain',
    label: t('onboarding.quickStart.messages.brainConsciousness'),
    labelKey: 'onboarding.quickStart.prepSteps.brain.label',
    desc: t('onboarding.quickStart.messages.connectingNeuralReasoningPipeline'),
    icon: 'i-ph:brain-duotone',
    status: 'pending',
  },
  {
    id: 'hearing',
    label: t('onboarding.quickStart.messages.hearingAcoustics'),
    labelKey: 'onboarding.quickStart.prepSteps.hearing.label',
    desc: t('onboarding.quickStart.messages.verifyingWhisperLocalOnDeviceModel'),
    icon: 'i-solar:microphone-3-bold-duotone',
    status: 'pending',
  },
  {
    id: 'voice',
    label: t('onboarding.quickStart.messages.vocalSynthesis'),
    labelKey: 'onboarding.quickStart.prepSteps.voice.label',
    desc: t('onboarding.quickStart.messages.synthesizingKokoro82mVoiceEngine'),
    icon: 'i-solar:volume-loud-bold-duotone',
    status: 'pending',
  },
  {
    id: 'persona',
    label: t('onboarding.quickStart.messages.soulManifestation'),
    labelKey: 'onboarding.quickStart.prepSteps.persona.label',
    desc: t('onboarding.quickStart.messages.seedingCompanionPersonaMemory'),
    icon: 'i-solar:heart-bold-duotone',
    status: 'pending',
  },
])

async function handleStartChatting() {
  draftStore.setUserProfile({
    userName: userName.value,
    companionName: companionName.value,
  })

  // Open deferred pre-flight modal
  isPreparingModalOpen.value = true
  preparationProgress.value = 5

  const charName = companionName.value || activeCompanion.value.name
  const charRawVoice = ttsVoice.value || getCompanionVoice(activeCompanion.value, ttsEngine.value)
  const normSpeechId = normalizeSpeechProviderId(ttsEngine.value)
  const profileId = `voice_profile_${charName.toLowerCase().replace(/\s+/g, '_')}`

  try {
    // ----------------------------------------------------
    // Step 0: Consciousness Core (LLM Brain)
    // ----------------------------------------------------
    prepSteps.value[0].status = 'active'
    if (llmProvider.value === 'web-llm') {
      prepSteps.value[0].desc = t('onboarding.quickStart.preparation.checkingCache')
      try {
        const { getWebLlmAdapter } = await import('../../../../../libs/inference/adapters/web-llm')
        const adapter = await getWebLlmAdapter()
        if (adapter.state !== 'ready' || adapter.manifest?.modelId !== llmModel.value) {
          prepSteps.value[0].desc = t('onboarding.quickStart.preparation.downloadingWeights')
          const curated = WEB_LLM_MODELS.find(m => m.id === llmModel.value)
          await adapter.loadModel(
            { modelId: llmModel.value, vramMB: curated?.vramMB },
            {
              onProgress: (p: any) => {
                const percent = typeof p?.percent === 'number' && p.percent >= 0
                  ? p.percent
                  : (p && p.loaded && p.total ? (p.loaded / p.total) * 100 : 0)
                prepSteps.value[0].desc = t('onboarding.quickStart.preparation.webLlmProgress', { percent: Math.round(percent) })
                preparationProgress.value = Math.max(5, Math.min(24, Math.round(5 + (percent * 0.2))))
              },
            },
          )
        }
      }
      catch (err) {
        console.warn('[QuickStart] WebLLM initialization notice:', err)
      }
    }
    else {
      prepSteps.value[0].desc = t('onboarding.quickStart.preparation.configuringProvider', { provider: llmProvider.value })
      const effectiveApiKey = apiKey.value.trim() || (isGenericOpenAI.value ? 'sk-no-key-required' : '')
      const effectiveBaseUrl = baseUrl.value.trim() || (isGenericOpenAI.value ? 'https://api.openai.com/v1' : '')
      if (effectiveApiKey || effectiveBaseUrl) {
        providersStore.providers[llmProvider.value] = {
          ...providersStore.providers[llmProvider.value],
          ...(effectiveApiKey ? { apiKey: effectiveApiKey } : {}),
          ...(effectiveBaseUrl ? { baseUrl: effectiveBaseUrl } : {}),
          model: llmModel.value,
        }
        providersStore.markProviderAdded(llmProvider.value)
      }
      await providersStore.disposeProviderInstance(llmProvider.value)
      await new Promise(resolve => setTimeout(resolve, 280))
    }
    prepSteps.value[0].desc = t('onboarding.quickStart.preparation.brainReady')
    prepSteps.value[0].status = 'done'
    preparationProgress.value = 25

    // ----------------------------------------------------
    // Step 1: Hearing Acoustics (STT)
    // ----------------------------------------------------
    prepSteps.value[1].status = 'active'
    if (isHearingEnabled.value) {
      if (sttEngine.value === 'whisper-local') {
        prepSteps.value[1].desc = t('onboarding.quickStart.preparation.checkingWhisper')
        try {
          await ensureWhisperLoaded({
            model: sttModel.value,
            onProgress: (p: any) => {
              if (p.phase === 'warmup') {
                prepSteps.value[1].desc = t('onboarding.quickStart.preparation.warmingUp')
              }
              else if (typeof p.percent === 'number' && p.percent >= 0) {
                prepSteps.value[1].desc = t('onboarding.quickStart.preparation.whisperProgress', { percent: Math.round(p.percent) })
                preparationProgress.value = Math.max(25, Math.min(49, Math.round(25 + (p.percent * 0.25))))
              }
            },
          })
          prepSteps.value[1].desc = t('onboarding.quickStart.preparation.whisperReady')
        }
        catch (err) {
          console.warn('[QuickStart] Whisper initialization notice:', err)
        }
      }
      else {
        prepSteps.value[1].desc = t('onboarding.quickStart.preparation.microphoneReady')
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    else {
      prepSteps.value[1].desc = t('onboarding.quickStart.preparation.hearingMuted')
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    prepSteps.value[1].status = 'done'
    preparationProgress.value = 50

    // ----------------------------------------------------
    // Step 2: Vocal Synthesis (TTS)
    // ----------------------------------------------------
    prepSteps.value[2].status = 'active'
    if (isVoiceEnabled.value) {
      if (normSpeechId === 'kokoro-local') {
        prepSteps.value[2].desc = t('onboarding.quickStart.preparation.checkingKokoro')
        try {
          const adapter = await getKokoroAdapter()
          const modelDef = KOKORO_MODELS.find(m => m.id === ttsModel.value) || KOKORO_MODELS.find(m => m.id === 'q4') || KOKORO_MODELS[0]
          await adapter.loadModel(modelDef.quantization, modelDef.platform, {
            onProgress: (p: any) => {
              const percent = Math.round(p.percent ?? (p.loaded && p.total ? (p.loaded / p.total) * 100 : 0))
              prepSteps.value[2].desc = t('onboarding.quickStart.preparation.kokoroProgress', { percent })
              preparationProgress.value = Math.max(50, Math.min(74, Math.round(50 + (percent * 0.24))))
            },
          })
          prepSteps.value[2].desc = t('onboarding.quickStart.preparation.kokoroReady', { voice: charRawVoice })
        }
        catch (err) {
          console.warn('[QuickStart] Kokoro weights loading notice:', err)
        }
      }
      else if (normSpeechId === 'pocket-tts-local') {
        prepSteps.value[2].desc = t('onboarding.quickStart.preparation.loadingPocket')
        try {
          const adapter = await getPocketTtsAdapterInstance()
          await adapter.loadModel({ language: ttsModel.value || 'english_2026-04' })
        }
        catch (err) {
          console.warn('[QuickStart] Pocket-TTS notice:', err)
        }
      }
      else if (normSpeechId === 'moss-nano-local') {
        try {
          const adapter = await getMossAdapterInstance()
          await adapter.loadModel()
        }
        catch (err) {
          console.warn('[QuickStart] Moss notice:', err)
        }
      }
      else {
        prepSteps.value[2].desc = t('onboarding.quickStart.preparation.speechConnected', { provider: normSpeechId })
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Save character voice profile into speechStore
      try {
        speechStore.saveVoiceProfile({
          id: profileId,
          name: `${charName}'s Voice`,
          baseProvider: normSpeechId,
          baseModel: ttsModel.value,
          baseVoice: charRawVoice,
          effects: {
            pitch: 1.0,
            rate: 1.0,
            volume: 1.0,
            asmr: 0,
            radio: 0,
            robot: 0,
            reverb: 0,
            spatial: 0,
          },
          ust: {
            enabled: true,
            mode: 'mute' as any,
            customStripChars: '*_[]()<>"\'',
            stripEmojis: true,
            tildeReplacement: '',
            autoLowercaseCapsThreshold: 2,
            autoLowercaseCapsExclude: [],
            convertBracketsToTokenFormat: true,
            customReplacements: [],
          },
        } as any)
        speechStore.activeSpeechProvider = normSpeechId
        speechStore.activeSpeechModel = ttsModel.value
        speechStore.activeSpeechVoiceId = profileId
      }
      catch (err) {
        console.warn('[QuickStart] Voice profile save notice:', err)
      }
    }
    else {
      prepSteps.value[2].desc = t('onboarding.quickStart.preparation.speechMuted')
      await new Promise(resolve => setTimeout(resolve, 150))
    }
    prepSteps.value[2].status = 'done'
    preparationProgress.value = 75

    // ----------------------------------------------------
    // Step 3: Soul Manifestation (Card & Stage Seeding)
    // ----------------------------------------------------
    prepSteps.value[3].status = 'active'
    prepSteps.value[3].desc = t('onboarding.quickStart.preparation.seedingPersona', { name: charName })

    const starter = getStarterCharacter(selectedCompanionId.value)

    // Sync transient draft state before atomic commit
    draftStore.state.userName = userName.value
    draftStore.state.companionName = charName
    draftStore.state.personaCardId = selectedCompanionId.value
    draftStore.state.vesselDisplayModelId = activeCompanion.value.vesselModelId || 'preset-live2d-2'
    draftStore.state.llmProvider = llmProvider.value
    draftStore.state.llmModel = llmModel.value
    draftStore.state.llmApiKey = apiKey.value
    draftStore.state.llmBaseUrl = baseUrl.value
    draftStore.state.ttsProvider = normSpeechId
    draftStore.state.ttsModel = ttsModel.value
    draftStore.state.ttsVoiceId = charRawVoice
    draftStore.state.modules.hearing = isHearingEnabled.value
    draftStore.state.modules.speech = isVoiceEnabled.value
    draftStore.state.modules.artistry = isArtistryToolEnabled.value
    draftStore.state.artistryImageJournalToolEnabled = isArtistryToolEnabled.value
    draftStore.state.artistryVisualPrompt = starter.artistryPromptPrefix || ''
    draftStore.state.modules.memory = isMemoryEnabled.value
    draftStore.state.memoryLongTermJournalEnabled = isMemoryEnabled.value
    draftStore.state.modules.tools = true
    draftStore.state.mcpWebSearchEnabled = isWebSearchEnabled.value
    draftStore.state.mcpFilesystemEnabled = isFilesystemMcpEnabled.value
    const preset = calibratedPacing.value?.preset || draftStore.state.pacingPreset || 'balanced'
    draftStore.state.pacingPreset = preset
    draftStore.state.subconsciousAsides = true
    draftStore.state.subconsciousTier1 = true
    draftStore.state.subconsciousTier2 = true

    try {
      await commitStarterCompanion(draftStore.state)
    }
    catch (err) {
      console.warn('[QuickStart] Companion commit notice:', err)
    }

    prepSteps.value[3].desc = t('onboarding.quickStart.preparation.stageReady', { name: charName })
    prepSteps.value[3].status = 'done'
    preparationProgress.value = 100

    await new Promise(resolve => setTimeout(resolve, 450))
    props.onComplete()
  }
  catch (err: any) {
    console.error('[QuickStart] Pre-flight preparation error:', err)
    toast.error(t('onboarding.quickStart.setupEncounteredAnIssueButYouCanContinueIntoStage'))
    await new Promise(resolve => setTimeout(resolve, 500))
    props.onComplete()
  }
}
</script>

<template>
  <div :class="['w-full max-w-5xl mx-auto flex flex-col justify-between py-2 px-4 gap-4 animate-fadeIn select-none relative']">
    <!-- 1. Header & Identity Strip -->
    <div :class="['flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1 border-b border-neutral-200/80 dark:border-white/5']">
      <div>
        <h1 :class="['text-2xl font-bold tracking-tight text-neutral-900 dark:text-white flex items-center gap-2']">
          <span>{{ t('onboarding.quickStart.title') }}</span>
          <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20']">
            {{ t('onboarding.quickStart.fastTrack60s') }}
          </span>
        </h1>
        <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
          {{ t('onboarding.quickStart.subtitle') }}
        </p>
      </div>

      <!-- Identity Strip (Your name & Companion name) -->
      <div :class="['flex items-center gap-3 self-stretch sm:self-auto']">
        <div :class="['flex flex-col gap-1']">
          <label :class="['text-[11px] font-medium text-neutral-500 dark:text-neutral-400']">{{ t('onboarding.steps.profile.userName.label') }}</label>
          <input
            v-model="userName"
            type="text"
            placeholder="Richy"
            :class="['h-8 px-3 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white/80 dark:bg-black/40 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 w-32 font-medium']"
          >
        </div>
        <div :class="['flex flex-col gap-1']">
          <label :class="['text-[11px] font-medium text-neutral-500 dark:text-neutral-400']">{{ t('onboarding.quickStart.companionName') }}</label>
          <input
            :value="companionName"
            type="text"
            :placeholder="t('settings.pages.card.creation.defaults.name')"
            :class="['h-8 px-3 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white/80 dark:bg-black/40 text-xs text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 w-32 font-medium']"
            @input="handleCompanionNameInput"
          >
        </div>
      </div>
    </div>

    <!-- 2. Main 2x2 Infrastructure Grid -->
    <div :class="['grid grid-cols-1 md:grid-cols-2 gap-4']">
      <!-- Top-Left: Brain (LLM Provider, Models & Live Benchmark) -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/40 p-4 flex flex-col justify-between gap-3 shadow-sm backdrop-blur-sm']">
        <div>
          <div :class="['flex items-center justify-between mb-1']">
            <div :class="['flex items-center gap-2']">
              <div :class="['h-7 w-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-sm']">
                <div :class="['i-ph:brain-duotone text-base']" />
              </div>
              <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.quickStart.brain') }}
              </h2>
            </div>
            <span :class="['text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono']">
              {{ t('onboarding.quickStart.required') }}
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
            {{ t('onboarding.quickStart.brainDescription', { companionName }) }}
          </p>
        </div>

        <div :class="['space-y-2.5 text-xs']">
          <!-- Full Provider Dropdown -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.providers.providerLabel') }}</span>
            <select
              v-model="llmProvider"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer']"
            >
              <option
                v-for="p in allChatProviders"
                :key="p.id"
                :value="p.id"
              >
                {{ (p as any).name || p.id }}
              </option>
            </select>
          </div>

          <!-- Base URL Input (Required/customizable for OpenAI Compatible) -->
          <div v-if="isBaseUrlVisible" :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.baseUrl') }}</span>
            <input
              v-model="baseUrl"
              type="text"
              :placeholder="baseUrlPlaceholder"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] focus:outline-none']"
            >
          </div>

          <!-- API Key Input (Hidden for local on-device providers) -->
          <div v-if="!isLocalLlmProvider" :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.apiKey') }}</span>
            <div :class="['relative flex-1']">
              <input
                v-model="apiKey"
                :type="showApiKey ? 'text' : 'password'"
                :placeholder="isGenericOpenAI ? 'sk-... (optional)' : 'sk-...'"
                :class="['w-full h-8 pl-2.5 pr-8 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] focus:outline-none']"
              >
              <button
                type="button"
                :class="['absolute right-2 top-1.5 text-neutral-400 hover:text-neutral-200 cursor-pointer']"
                @click="showApiKey = !showApiKey"
              >
                <div :class="[showApiKey ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold', 'w-4 h-4']" />
              </button>
            </div>
          </div>

          <!-- Model Selector -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.providers.modelLabel') }}</span>
            <select
              v-if="availableLlmModels.length > 0"
              v-model="llmModel"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] focus:outline-none cursor-pointer']"
            >
              <option
                v-for="m in availableLlmModels"
                :key="m.id"
                :value="m.id"
              >
                {{ m.name || m.id }}
              </option>
            </select>
            <input
              v-else
              v-model="llmModel"
              type="text"
              placeholder="gpt-4o"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 font-mono text-[11px] focus:outline-none']"
            >
          </div>
        </div>

        <!-- Connection Test & Benchmark Row -->
        <div :class="['flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-white/5 gap-2 flex-wrap']">
          <button
            type="button"
            :class="['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0']"
            :disabled="isTestingConnection"
            @click="testConnection"
          >
            <div :class="[isTestingConnection ? 'i-solar:restart-circle-bold animate-spin text-cyan-400' : 'i-solar:link-circle-bold text-cyan-400', 'w-3.5 h-3.5']" />
            <span>{{ isTestingConnection ? t('onboarding.quickStart.testingValue', { benchmarkElapsedSeconds }) : t('onboarding.quickStart.testConnection') }}</span>
          </button>

          <div :class="['flex items-center gap-2']">
            <!-- Calibrated Pacing Badge inside Brain Section (Only when calibrated and connected) -->
            <div
              v-if="connectionStatus === 'connected' && calibratedPacing"
              :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 text-[10px] font-mono font-medium shadow-xs']"
            >
              <span>{{ calibratedPacing.icon }}</span>
              <span>{{ t('onboarding.quickStart.calibratedPacing', { label: calibratedPacing.label, ttft: calibratedPacing.ttft }) }}</span>
            </div>

            <!-- Status Indicator -->
            <div
              v-if="connectionStatus === 'connected'"
              :class="['flex items-center gap-1.5 text-[11px] font-medium text-emerald-500 dark:text-emerald-400 font-mono']"
            >
              <span :class="['w-2 h-2 rounded-full bg-emerald-500']" />
              <span>{{ t('settings.pages.modules.messaging-discord.connectivity.connected') }}</span>
            </div>
            <div
              v-else-if="connectionStatus === 'error'"
              :class="['flex items-center gap-1.5 text-[11px] font-medium text-rose-500 dark:text-rose-400 font-mono']"
            >
              <span :class="['w-2 h-2 rounded-full bg-rose-500']" />
              <span>{{ t('onboarding.quickStart.failed') }}</span>
            </div>
            <div
              v-else-if="!isLocalLlmProvider && !isGenericOpenAI && !apiKey.trim()"
              :class="['flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 font-mono']"
            >
              <span :class="['w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600']" />
              <span>{{ t('onboarding.quickStart.keyRequired') }}</span>
            </div>
            <div
              v-else
              :class="['flex items-center gap-1.5 text-[11px] font-medium text-neutral-400 font-mono']"
            >
              <span :class="['w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600']" />
              <span>{{ t('onboarding.quickStart.notTested') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top-Right: Companion (De-framed Triad: ReLU, Dr. Aria, Lupin) -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/40 p-4 flex flex-col justify-between gap-3 shadow-sm backdrop-blur-sm']">
        <div>
          <div :class="['flex items-center gap-2 mb-1']">
            <div :class="['h-7 w-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center text-sm']">
              <div :class="['i-solar:heart-bold-duotone text-base']" />
            </div>
            <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
              {{ t('onboarding.quickStart.companion') }}
            </h2>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
            {{ t('onboarding.quickStart.chooseWhoWillBeByYourSide') }}
          </p>
        </div>

        <!-- 3 De-framed Starter Cards Row -->
        <div :class="['grid grid-cols-3 gap-2.5']">
          <div
            v-for="c in starterCompanions"
            :key="c.id"
            :class="[
              'relative rounded-xl border p-2 flex flex-col items-center text-center cursor-pointer transition-all duration-200 group select-none',
              c.id === selectedCompanionId
                ? 'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/30 ring-2 ring-cyan-500/40 shadow-sm'
                : 'border-neutral-200/80 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20 hover:bg-neutral-100/50 dark:hover:bg-white/[0.04]',
            ]"
            @click="selectCompanion(c)"
          >
            <!-- Floating Check Badge -->
            <div
              v-if="c.id === selectedCompanionId"
              :class="['absolute top-1.5 right-1.5 h-4.5 w-4.5 rounded-full bg-cyan-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm z-10']"
            >
              ✓
            </div>

            <!-- Full-Bleed Expanded Avatar Thumbnail -->
            <div :class="['w-full h-20 rounded-lg overflow-hidden mb-2 bg-neutral-100 dark:bg-neutral-800/80 relative']">
              <img
                :src="c.previewImg"
                :alt="c.name"
                :class="['h-full w-full object-cover group-hover:scale-105 transition-transform duration-300']"
                @error="(e: any) => { e.target.style.display = 'none' }"
              >
            </div>

            <!-- Name & Tag -->
            <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate max-w-full']">
              {{ c.name }}
            </span>
            <span :class="['text-[10px] text-neutral-400 dark:text-neutral-500 font-medium truncate max-w-full']">
              {{ 'tagKey' in c && c.tagKey ? t(c.tagKey) : c.tag }}
            </span>
          </div>
        </div>

        <!-- Active Companion Subtitle & Reactive Speech Bubble Preview -->
        <div :class="['space-y-1.5 pt-0.5']">
          <div :class="['text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5']">
            <span :class="['font-bold text-neutral-800 dark:text-neutral-200']">{{ activeCompanion.title }}</span>
            <span>•</span>
            <span :class="['truncate']">{{ activeCompanion.personalityKey ? t(activeCompanion.personalityKey) : activeCompanion.personality }}</span>
          </div>

          <!-- Dynamic Speech Bubble (Reacts immediately to userName change) -->
          <div :class="['relative rounded-xl border border-cyan-500/30 bg-cyan-500/5 dark:bg-cyan-950/20 px-3 py-2 text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed']">
            "{{ localizedGreeting }}"
          </div>
        </div>
      </div>

      <!-- Bottom-Left: Voice (TTS 3-Part Tuple: Kokoro 82M Default) -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/40 p-4 flex flex-col justify-between gap-3 shadow-sm backdrop-blur-sm']">
        <div :class="['flex items-start justify-between gap-2']">
          <div>
            <div :class="['flex items-center gap-2 mb-1']">
              <div :class="['h-7 w-7 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center text-sm']">
                <div :class="['i-solar:volume-loud-bold-duotone text-base']" />
              </div>
              <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('settings.voices') }}
              </h2>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
              {{ t('onboarding.quickStart.voiceDescription', { companionName }) }}
            </p>
          </div>

          <!-- Master Toggle Switch -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-0.5']">
            <input
              v-model="isVoiceEnabled"
              type="checkbox"
              :class="['sr-only peer']"
            >
            <div :class="['w-10 h-5.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-cyan-500']" />
          </label>
        </div>

        <div :class="['space-y-2.5 text-xs', !isVoiceEnabled && 'opacity-50 pointer-events-none']">
          <!-- 1. Engine Dropdown (Kokoro 82M Default) -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.engine') }}</span>
            <select
              v-model="ttsEngine"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer']"
            >
              <optgroup :label="t('onboarding.quickStart.localOnDeviceZeroCloud')">
                <option value="kokoro-local">
                  {{ t('onboarding.quickStart.kokoro82mTtsZeroGateWebgpuWasm') }}
                </option>
                <option value="pocket-tts-local">
                  {{ t('onboarding.quickStart.pocketTtsLocal100mCpu') }}
                </option>
                <option value="moss-nano-local">
                  {{ t('onboarding.quickStart.mossNanoLocalUltraFast') }}
                </option>
              </optgroup>
              <optgroup v-if="cloudSpeechProviders.length > 0" :label="t('onboarding.steps.vision.tabs.custom')">
                <option
                  v-for="p in cloudSpeechProviders"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.name }}
                </option>
              </optgroup>
            </select>
          </div>

          <!-- 2. Model Dropdown -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.providers.modelLabel') }}</span>
            <select
              v-model="ttsModel"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer']"
            >
              <option
                v-for="m in availableTtsModels"
                :key="m.id"
                :value="m.id"
              >
                {{ 'labelKey' in m && m.labelKey ? t(m.labelKey) : m.label }}
              </option>
            </select>
          </div>

          <!-- 3. Voice Dropdown (Paired with Character Persona) -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('settings.voices') }}</span>
            <select
              :value="ttsVoice"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer']"
              @change="(e: any) => {
                isVoiceManuallyEdited = true
                ttsVoice = e.target.value
              }"
            >
              <option
                v-for="v in availableTtsVoices"
                :key="v.id"
                :value="v.id"
              >
                {{ 'labelKey' in v && v.labelKey ? t(v.labelKey) : v.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Audition & Status Row -->
        <div :class="['flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-white/5']">
          <button
            type="button"
            :class="['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer']"
            :disabled="!isVoiceEnabled || isAuditioning"
            @click="auditionGreeting"
          >
            <div :class="[isAuditioning ? 'i-solar:soundwave-bold animate-pulse text-cyan-400' : 'i-solar:volume-loud-bold text-cyan-400', 'w-3.5 h-3.5']" />
            <span>{{ isAuditioning ? t('onboarding.quickStart.voiceAudition.speaking') : t('onboarding.quickStart.hearGreeting') }}</span>
          </button>

          <div :class="['flex items-center gap-1.5 text-[11px] font-medium font-mono', isVoiceEnabled ? 'text-emerald-500 dark:text-emerald-400' : 'text-neutral-400']">
            <span :class="['w-2 h-2 rounded-full', isVoiceEnabled ? 'bg-emerald-500' : 'bg-neutral-400']" />
            <span>{{ isVoiceEnabled ? t('onboarding.quickStart.ready') : t('onboarding.quickStart.muted') }}</span>
          </div>
        </div>
      </div>

      <!-- Bottom-Right: Hearing (STT Whisper Local + Model Picker) -->
      <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/70 dark:bg-neutral-900/40 p-4 flex flex-col justify-between gap-3 shadow-sm backdrop-blur-sm']">
        <div :class="['flex items-start justify-between gap-2']">
          <div>
            <div :class="['flex items-center gap-2 mb-1']">
              <div :class="['h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-sm']">
                <div :class="['i-solar:microphone-3-bold-duotone text-base']" />
              </div>
              <h2 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.steps.hearing.label') }}
              </h2>
            </div>
            <p :class="['text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed']">
              {{ t('onboarding.quickStart.hearingDescription', { companionName }) }}
            </p>
          </div>

          <!-- Master Toggle Switch -->
          <label :class="['relative inline-flex items-center cursor-pointer shrink-0 mt-0.5']">
            <input
              v-model="isHearingEnabled"
              type="checkbox"
              :class="['sr-only peer']"
            >
            <div :class="['w-10 h-5.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-cyan-500']" />
          </label>
        </div>

        <div :class="['space-y-2.5 text-xs', !isHearingEnabled && 'opacity-50 pointer-events-none']">
          <!-- Engine Selector (Whisper Local Default) -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.engine') }}</span>
            <select
              v-model="sttEngine"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer']"
            >
              <option value="whisper-local">
                {{ t('onboarding.quickStart.whisperLocalWebgpuOnDevice') }}
              </option>
              <option value="browser-web-speech-api">
                {{ t('onboarding.quickStart.browserWebSpeech') }}
              </option>
            </select>
          </div>

          <!-- Model Picker (When Whisper Local selected, defaults to tiny) -->
          <div v-if="sttEngine === 'whisper-local'" :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('onboarding.quickStart.providers.modelLabel') }}</span>
            <select
              v-model="sttModel"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer font-mono text-[11px]']"
            >
              <option
                v-for="m in whisperModelOptions"
                :key="m.id"
                :value="m.id"
              >
                {{ 'labelKey' in m && m.labelKey ? t(m.labelKey) : m.label }}
              </option>
            </select>
          </div>

          <!-- Microphone Device Picker -->
          <div :class="['flex items-center justify-between gap-3']">
            <span :class="['text-neutral-500 dark:text-neutral-400 w-20 shrink-0']">{{ t('settings.microphone') }}</span>
            <select
              v-model="selectedMicId"
              :class="['flex-1 h-8 px-2.5 rounded-xl border border-neutral-300/80 dark:border-white/10 bg-white dark:bg-neutral-800/90 text-neutral-800 dark:text-neutral-200 focus:outline-none cursor-pointer truncate']"
            >
              <option
                v-for="mic in availableMics"
                :key="mic.id"
                :value="mic.id"
              >
                {{ 'labelKey' in mic && mic.labelKey ? t(mic.labelKey) : mic.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- VU Meter & Test Button Row -->
        <div :class="['flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-white/5 gap-3']">
          <!-- Animated Audio VU Meter -->
          <div :class="['flex items-center gap-1.5 flex-1 min-w-0']">
            <div :class="['flex items-center gap-0.5 h-3']">
              <span
                v-for="i in 12"
                :key="i"
                :class="[
                  'w-1 rounded-full transition-all duration-100',
                  isTestingMic && i <= testVolumeLevel
                    ? 'bg-cyan-400 h-3 animate-pulse'
                    : 'bg-neutral-300 dark:bg-neutral-700 h-1.5',
                ]"
              />
            </div>
            <span :class="['text-[10px] text-neutral-400 font-mono truncate']">
              {{ isTestingMic ? t('onboarding.quickStart.hearing.listening') : t('onboarding.quickStart.idle') }}
            </span>
          </div>

          <button
            type="button"
            :class="['inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer shrink-0']"
            :disabled="!isHearingEnabled"
            @click="toggleTestMic"
          >
            <div :class="[isTestingMic ? 'i-solar:microphone-bold text-cyan-400 animate-pulse' : 'i-solar:microphone-3-bold text-cyan-400', 'w-3.5 h-3.5']" />
            <span>{{ isTestingMic ? t('onboarding.quickStart.stopTest') : t('onboarding.quickStart.testMicrophone') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Subconscious Behavior Strip (4 Clean Toggles) -->
    <div :class="['rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/60 dark:bg-neutral-900/30 p-3.5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs shadow-sm backdrop-blur-sm']">
      <!-- 1. Memory (LTMM) -->
      <div :class="['flex items-center justify-between gap-2 p-1.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]']">
        <div :class="['flex items-center gap-2 min-w-0']">
          <div :class="['h-6 w-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center text-xs shrink-0']">
            <div :class="['i-solar:database-bold-duotone text-sm']" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <span :class="['font-bold text-neutral-900 dark:text-white text-[11px] truncate']">{{ t('onboarding.quickStart.memoryLtmm') }}</span>
            <span :class="['text-[10px] text-neutral-400 leading-none truncate']">{{ t('onboarding.quickStart.rememberAcrossSessions') }}</span>
          </div>
        </div>
        <label :class="['relative inline-flex items-center cursor-pointer shrink-0']">
          <input
            v-model="isMemoryEnabled"
            type="checkbox"
            :class="['sr-only peer']"
          >
          <div :class="['w-8 h-4.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500']" />
        </label>
      </div>

      <!-- 2. Web Search (0-Key) -->
      <div :class="['flex items-center justify-between gap-2 p-1.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]']">
        <div :class="['flex items-center gap-2 min-w-0']">
          <div :class="['h-6 w-6 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center text-xs shrink-0']">
            <div :class="['i-solar:magnifer-bold-duotone text-sm']" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <span :class="['font-bold text-neutral-900 dark:text-white text-[11px] truncate']">{{ t('onboarding.quickStart.webSearch') }}</span>
            <span :class="['text-[10px] text-neutral-400 leading-none truncate']">{{ t('onboarding.quickStart.realTimeOpenSearch') }}</span>
          </div>
        </div>
        <label :class="['relative inline-flex items-center cursor-pointer shrink-0']">
          <input
            v-model="isWebSearchEnabled"
            type="checkbox"
            :class="['sr-only peer']"
          >
          <div :class="['w-8 h-4.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500']" />
        </label>
      </div>

      <!-- 3. Workspace Files (Filesystem MCP) -->
      <div :class="['flex items-center justify-between gap-2 p-1.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]']">
        <div :class="['flex items-center gap-2 min-w-0']">
          <div :class="['h-6 w-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center text-xs shrink-0']">
            <div :class="['i-solar:folder-with-files-bold-duotone text-sm']" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <span :class="['font-bold text-neutral-900 dark:text-white text-[11px] truncate']">{{ t('onboarding.quickStart.workspaceFiles') }}</span>
            <span :class="['text-[10px] text-neutral-400 leading-none truncate']">{{ t('onboarding.quickStart.safeProjectsReading') }}</span>
          </div>
        </div>
        <label :class="['relative inline-flex items-center cursor-pointer shrink-0']">
          <input
            v-model="isFilesystemMcpEnabled"
            type="checkbox"
            :class="['sr-only peer']"
          >
          <div :class="['w-8 h-4.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500']" />
        </label>
      </div>

      <!-- 4. Visual Artistry (1-Click Free Pollinations, image_journal tool only) -->
      <div :class="['flex items-center justify-between gap-2 p-1.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/40 dark:bg-white/[0.02]']">
        <div :class="['flex items-center gap-2 min-w-0']">
          <div :class="['h-6 w-6 rounded-lg bg-pink-500/15 text-pink-400 flex items-center justify-center text-xs shrink-0']">
            <div :class="['i-solar:palette-round-bold-duotone text-sm']" />
          </div>
          <div :class="['flex flex-col min-w-0']">
            <span :class="['font-bold text-neutral-900 dark:text-white text-[11px] truncate']">{{ t('onboarding.quickStart.visualArtistry') }}</span>
            <span :class="['text-[10px] text-neutral-400 leading-none truncate']">{{ t('onboarding.quickStart.1ClickFreePollinations') }}</span>
          </div>
        </div>
        <label :class="['relative inline-flex items-center cursor-pointer shrink-0']">
          <input
            v-model="isArtistryToolEnabled"
            type="checkbox"
            :class="['sr-only peer']"
          >
          <div :class="['w-8 h-4.5 bg-neutral-200 dark:bg-neutral-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-empty after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-cyan-500']" />
        </label>
      </div>
    </div>

    <!-- 4. Footer Actions -->
    <div :class="['flex items-center justify-between pt-1 border-t border-neutral-200/80 dark:border-white/5']">
      <div :class="['flex items-center gap-2 text-xs']">
        <span :class="['w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse']" />
        <div :class="['flex flex-col']">
          <span :class="['font-bold text-neutral-900 dark:text-white text-[11px]']">{{ t('onboarding.quickStart.readyTitle', { companionName }) }}</span>
          <span :class="['text-[10px] text-neutral-400 leading-none']">{{ t('onboarding.quickStart.allSystemsConfiguredAndCalibrated') }}</span>
        </div>
      </div>

      <div :class="['flex items-center gap-3']">
        <button
          type="button"
          :class="['px-3.5 py-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white text-xs font-medium transition-colors cursor-pointer hover:bg-black/5 dark:hover:bg-white/5']"
          @click="props.onContinueFullSetup"
        >
          {{ t('onboarding.steps.welcome.actions.guidedSetup') }}
        </button>
        <button
          type="button"
          :class="[
            'px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-xs',
            'shadow-lg shadow-cyan-500/25 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5',
          ]"
          @click="handleStartChatting"
        >
          <span>{{ t('onboarding.quickStart.launch') }}</span>
          <div :class="['i-solar:arrow-right-linear w-4 h-4']" />
        </button>
      </div>
    </div>

    <!-- 5. Option C: Deferred Pre-flight Setup Modal -->
    <Teleport to="body">
      <div
        v-if="isPreparingModalOpen"
        :class="['fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn select-none']"
      >
        <div :class="['w-full max-w-md rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 p-6 shadow-2xl flex flex-col gap-5']">
          <!-- Header -->
          <div :class="['flex items-center gap-3']">
            <div :class="['h-10 w-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-xl shrink-0']">
              <div :class="['i-solar:sparkles-bold animate-spin']" />
            </div>
            <div>
              <h3 :class="['text-base font-bold text-neutral-900 dark:text-white']">
                {{ t('onboarding.quickStart.preparingCompanion', { companionName }) }}
              </h3>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                {{ t('onboarding.quickStart.initializingNeuralEnginesAndLocalMemory') }}
              </p>
            </div>
          </div>

          <!-- Overall Progress Bar -->
          <div :class="['space-y-1.5']">
            <div :class="['flex items-center justify-between text-[11px] font-mono text-neutral-500 dark:text-neutral-400']">
              <span>{{ t('onboarding.quickStart.setupProgress') }}</span>
              <span>{{ preparationProgress }}%</span>
            </div>
            <div :class="['w-full h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden']">
              <div
                :class="['h-full bg-cyan-500 rounded-full transition-all duration-300 shadow-sm']"
                :style="{ width: `${preparationProgress}%` }"
              />
            </div>
          </div>

          <!-- Steps Checklist -->
          <div :class="['space-y-2.5 pt-1']">
            <div
              v-for="step in prepSteps"
              :key="step.id"
              :class="[
                'flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs',
                step.status === 'done'
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-neutral-900 dark:text-white'
                  : step.status === 'active'
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-neutral-900 dark:text-white'
                    : 'border-neutral-200/60 dark:border-white/5 opacity-50 text-neutral-500',
              ]"
            >
              <div :class="['flex items-center gap-2.5 min-w-0']">
                <div :class="[step.icon, 'text-base shrink-0 text-cyan-400']" />
                <div :class="['flex flex-col min-w-0']">
                  <span :class="['font-semibold text-xs truncate']">{{ 'labelKey' in step && step.labelKey ? t(step.labelKey) : step.label }}</span>
                  <span :class="['text-[10px] text-neutral-400 dark:text-neutral-500 truncate']">{{ step.desc }}</span>
                </div>
              </div>

              <!-- Status Indicator -->
              <div :class="['shrink-0 ml-2']">
                <div
                  v-if="step.status === 'done'"
                  :class="['h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold']"
                >
                  ✓
                </div>
                <div
                  v-else-if="step.status === 'active'"
                  :class="['h-5 w-5 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin']"
                />
                <span
                  v-else
                  :class="['text-[10px] text-neutral-400 font-mono']"
                >
                  {{ t('onboarding.quickStart.queued') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
