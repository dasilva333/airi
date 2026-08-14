<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import CompanionBubble from '../components/companion-bubble.vue'

import { getStarterCharacter, STARTER_CHARACTERS } from '../../../../../../constants/prompts/character-defaults'
import { getKokoroAdapter } from '../../../../../../libs/inference/adapters/kokoro'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { getMossAdapterInstance } from '../../../../../../stores/providers/moss-audio-utils'
import { getPocketTtsAdapterInstance } from '../../../../../../stores/providers/pocket-audio-utils'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { KOKORO_MODELS } from '../../../../../../workers/kokoro/constants'
import { useOnboardingV2Draft } from '../draft-store'
import { onboardingV2GateKey } from '../gate'

// V2 onboarding — Step 6: Contextual Speech (Her Voice Studio Setup).

const draftStore = useOnboardingV2Draft()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const userProfileStore = useSettingsUserProfile()

const USER_TOKEN_REGEX = /(?<!\{)\{user\}(?!\})/g

function normalizeProviderId(id: string) {
  if (id === 'kokoro')
    return 'kokoro-local'
  if (id === 'pocket')
    return 'pocket-tts-local'
  if (id === 'moss')
    return 'moss-nano-local'
  return id
}

const selectedProvider = ref<string>(draftStore.state.speech.provider || 'pocket')
const selectedModel = ref<string>(draftStore.state.speech.model || 'english_2026-04')
const selectedVoice = ref<string>(draftStore.state.speech.voiceId || 'anna')

const showApiKey = ref(false)
const apiKeyInput = ref('')

const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadError = ref('')
const isEngineReady = ref(false)

const speed = ref(1.0)
const pitch = ref(1.0)
const isPlaying = ref(false)

const isLocalProvider = computed(() => {
  const norm = normalizeProviderId(selectedProvider.value)
  return ['kokoro-local', 'pocket-tts-local', 'moss-nano-local'].includes(norm)
})

// Dynamic models & listVoices queries from stores
const providerModels = computed(() => providersStore.getModelsForProvider(normalizeProviderId(selectedProvider.value)) || [])
const providerVoices = computed(() => speechStore.getVoicesForProvider(normalizeProviderId(selectedProvider.value)) || [])

// Auto-fill API credentials from saved provider instances and trigger dynamic model/voice fetching
watch(selectedProvider, async (providerId) => {
  if (!providerId)
    return

  const normId = normalizeProviderId(providerId)

  // 1. Pre-fill API key from saved credentials
  const config = providersStore.getProviderConfig(normId)
  if (config?.apiKey) {
    apiKeyInput.value = String(config.apiKey)
  }
  else {
    apiKeyInput.value = ''
  }

  // 2. Fetch models and listVoices dynamically if non-local cloud provider
  if (!isLocalProvider.value) {
    void providersStore.fetchModelsForProvider(normId)
    void speechStore.loadVoicesForProvider(normId)
  }
  else {
    void checkEngineReadiness()
  }
}, { immediate: true })

watch(apiKeyInput, (val) => {
  if (!isLocalProvider.value && val.trim()) {
    const normId = normalizeProviderId(selectedProvider.value)
    providersStore.providers[normId] = {
      ...providersStore.providers[normId],
      apiKey: val.trim(),
    }
  }
})

const showHfTokenInput = ref(false)
const hfTokenInput = ref(typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || '' : '')

function saveHfToken() {
  if (typeof localStorage !== 'undefined') {
    if (hfTokenInput.value.trim()) {
      localStorage.setItem('settings/connection/hf-token', hfTokenInput.value.trim())
    }
    else {
      localStorage.removeItem('settings/connection/hf-token')
    }
  }
}

const resolvedPersona = computed(() => {
  const persona = draftStore.state.persona
  const userName = userProfileStore.name || 'Manager'

  if (persona.importedCardDraft) {
    const rawData = persona.importedCardDraft as any
    const data = rawData.data || rawData
    const greeting = data.first_mes || data.greetings?.[0]
    return {
      name: data.nickname || data.name || 'Companion',
      greeting: greeting ? greeting.replace(USER_TOKEN_REGEX, userName) : '',
    }
  }

  const cardId = persona.cardId || 'default'
  if (STARTER_CHARACTERS[cardId]) {
    const p = getStarterCharacter(cardId)
    return {
      name: p.name,
      greeting: (p.greetings[0] || '').replace(USER_TOKEN_REGEX, userName),
    }
  }

  const d = STARTER_CHARACTERS.default
  return {
    name: d.name,
    greeting: (d.greetings[0] || '').replace(USER_TOKEN_REGEX, userName),
  }
})

const sampleText = ref('')

watch(resolvedPersona, (p) => {
  if (p.greeting) {
    sampleText.value = p.greeting
  }
  else {
    sampleText.value = `Hello ${userProfileStore.name || 'Manager'}! I'm ${p.name}. Everything is ready — how do I sound?`
  }
}, { immediate: true })

// Synchronize with transient onboarding draft store
if (!draftStore.state.speech.provider) {
  draftStore.setSpeech({
    provider: normalizeProviderId(selectedProvider.value),
    model: selectedModel.value,
    voiceId: selectedVoice.value,
  })
}

watch([selectedProvider, selectedModel, selectedVoice], () => {
  draftStore.setSpeech({
    provider: normalizeProviderId(selectedProvider.value),
    model: selectedModel.value,
    voiceId: selectedVoice.value,
  })
})

// 1. Local Engine Hero Cards
const localEngines = [
  {
    id: 'pocket',
    name: 'Pocket-TTS Local',
    icon: 'i-solar:microphone-3-bold-duotone',
    accent: 'text-emerald-500',
    tag: 'RECOMMENDED · CPU',
    desc: 'Low-latency ~100M multilingual CPU engine with zero-shot voice synthesis.',
    badges: ['🇺🇸 EN', '🇫🇷 FR', '🇪🇸 ES', '🇩🇪 DE', '🇮🇹 IT'],
  },
  {
    id: 'kokoro',
    name: 'Kokoro Local TTS',
    icon: 'i-solar:heart-bold-duotone',
    accent: 'text-pink-500',
    tag: 'NEURAL AUDIO',
    desc: 'High-quality 82M neural TTS with expressive multilingual voices.',
    badges: ['🇺🇸 EN', '🇯🇵 JP', '🇨🇳 ZH', '🇪🇸 ES', '🇫🇷 FR'],
  },
  {
    id: 'moss',
    name: 'Moss-Nano Local',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-amber-500',
    tag: 'ULTRA-FAST',
    desc: 'Tiny low-resource voice engine for instant speech on any hardware.',
    badges: ['🇺🇸 EN', '🇨🇳 ZH'],
  },
]

const PROVIDER_DISPLAY_NAMES: Record<string, { name: string, icon?: string, consoleUrl?: string }> = {
  'elevenlabs': { name: 'ElevenLabs', icon: 'i-simple-icons:elevenlabs', consoleUrl: 'https://elevenlabs.io/app/settings/api-keys' },
  'openai-audio-speech': { name: 'OpenAI Audio', icon: 'i-simple-icons:openai', consoleUrl: 'https://platform.openai.com/api-keys' },
  'openai-audio': { name: 'OpenAI Audio', icon: 'i-simple-icons:openai', consoleUrl: 'https://platform.openai.com/api-keys' },
  'deepgram-tts': { name: 'Deepgram Aura', icon: 'i-solar:soundwave-bold-duotone', consoleUrl: 'https://console.deepgram.com' },
  'microsoft-speech': { name: 'Azure Speech', icon: 'i-simple-icons:microsoftazure', consoleUrl: 'https://portal.azure.com' },
  'azure-speech': { name: 'Azure Speech', icon: 'i-simple-icons:microsoftazure', consoleUrl: 'https://portal.azure.com' },
  'aws-polly-tts': { name: 'AWS Polly', icon: 'i-simple-icons:amazonaws', consoleUrl: 'https://console.aws.amazon.com/polly' },
  'fish-speech': { name: 'Fish Speech', icon: 'i-solar:fish-bold-duotone', consoleUrl: 'https://fish.audio' },
  'chatterbox': { name: 'Chatterbox', icon: 'i-solar:chat-round-bold-duotone' },
  'index-tts-vllm': { name: 'Index TTS', icon: 'i-solar:server-square-bold-duotone' },
  'alibaba-cloud-model-studio': { name: 'Alibaba Qwen TTS', icon: 'i-simple-icons:alibabacloud', consoleUrl: 'https://dashscope.console.aliyun.com' },
  'volcengine': { name: 'Volcengine', icon: 'i-solar:fire-bold-duotone', consoleUrl: 'https://console.volcengine.com' },
  'openrouter-audio-speech': { name: 'OpenRouter Audio', icon: 'i-solar:route-bold-duotone', consoleUrl: 'https://openrouter.ai/keys' },
  'xai-audio-speech': { name: 'xAI Audio', icon: 'i-simple-icons:x', consoleUrl: 'https://console.x.ai' },
  'player2-speech': { name: 'Player2 Speech', icon: 'i-solar:gamepad-bold-duotone' },
  'comet-api-speech': { name: 'Comet API', icon: 'i-solar:rocket-bold-duotone' },
}

const INTERNAL_PROVIDERS = [
  'speech-noop',
  'virtual-audio-studio',
  'browser-local-audio-speech',
  'kokoro',
  'pocket',
  'moss',
  'kokoro-local',
  'pocket-tts-local',
  'moss-nano-local',
]

// 2. Query registry dynamically for remote cloud providers
const cloudProviders = computed(() => {
  const allMap = providersStore.allProvidersMetadata || {}
  const items = Object.values(allMap).filter(p => p.category === 'speech' && !INTERNAL_PROVIDERS.includes(p.id))

  if (items.length > 0) {
    return items.map((p) => {
      const known = PROVIDER_DISPLAY_NAMES[p.id]
      return {
        id: p.id,
        name: known?.name || (p as any).name || p.id,
        icon: known?.icon || p.icon || 'i-solar:cloud-bold-duotone',
        consoleUrl: known?.consoleUrl || (p as any).consoleUrl || (p as any).websiteUrl || '',
      }
    })
  }

  // Seeded fallback list if store is uninitialized during static render
  return Object.entries(PROVIDER_DISPLAY_NAMES).slice(0, 5).map(([id, info]) => ({
    id,
    name: info.name,
    icon: info.icon || 'i-solar:cloud-bold-duotone',
    consoleUrl: info.consoleUrl || '',
  }))
})

const activeConsoleUrl = computed(() => {
  const match = cloudProviders.value.find(p => p.id === selectedProvider.value)
  return match?.consoleUrl || ''
})

const availableModels = computed(() => {
  const normId = normalizeProviderId(selectedProvider.value)
  if (normId === 'pocket-tts-local') {
    return [
      { id: 'english_2026-04', label: 'Pocket TTS English (100M CPU)' },
      { id: 'french_24l', label: 'Pocket TTS French (24L)' },
      { id: 'spanish_24l', label: 'Pocket TTS Spanish (24L)' },
      { id: 'german_24l', label: 'Pocket TTS German (24L)' },
      { id: 'italian_24l', label: 'Pocket TTS Italian (24L)' },
    ]
  }
  if (normId === 'kokoro-local') {
    return [
      { id: 'q4', label: 'Kokoro Q4 (Fast CPU WASM)' },
      { id: 'q8', label: 'Kokoro Q8 (High Quality WASM)' },
      { id: 'q4-webgpu', label: 'Kokoro Q4 (WebGPU)' },
    ]
  }
  if (normId === 'moss-nano-local') {
    return [{ id: 'moss-tts-nano-100m', label: 'Moss-Nano Fast Engine (100M)' }]
  }

  if (providerModels.value.length > 0) {
    return providerModels.value.map((m: any) => ({
      id: m.id,
      label: m.name || m.id,
    }))
  }

  if (selectedProvider.value === 'elevenlabs')
    return [{ id: 'eleven_multilingual_v2', label: 'Eleven Multilingual v2' }, { id: 'eleven_turbo_v2_5', label: 'Eleven Turbo v2.5' }]
  if (selectedProvider.value === 'openai-audio' || selectedProvider.value === 'openai-audio-speech')
    return [{ id: 'tts-1', label: 'OpenAI TTS-1' }, { id: 'tts-1-hd', label: 'OpenAI TTS-1 HD' }]
  return [{ id: 'default', label: 'Standard Voice Model' }]
})

const availableVoices = computed(() => {
  const normId = normalizeProviderId(selectedProvider.value)
  if (normId === 'pocket-tts-local') {
    return [
      { id: 'anna', label: 'Anna (Female · Conversational)' },
      { id: 'eve', label: 'Eve (Female · Conversational)' },
      { id: 'jane', label: 'Jane (Female · Conversational)' },
      { id: 'mary', label: 'Mary (Female · Conversational)' },
      { id: 'vera', label: 'Vera (Female · Conversational)' },
      { id: 'alba', label: 'Alba (Female · Reading)' },
      { id: 'charles', label: 'Charles (Male · Conversational)' },
      { id: 'george', label: 'George (Male · Conversational)' },
      { id: 'michael', label: 'Michael (Male · Conversational)' },
    ]
  }
  if (normId === 'kokoro-local') {
    return [
      { id: 'af_heart', label: 'Heart (Female · Warm)' },
      { id: 'af_bella', label: 'Bella (Female · Soft)' },
      { id: 'af_nicole', label: 'Nicole (Female · Energetic)' },
      { id: 'af_sky', label: 'Sky (Female · Sweet)' },
      { id: 'am_adam', label: 'Adam (Male · Natural)' },
      { id: 'am_michael', label: 'Michael (Male · Deep)' },
    ]
  }
  if (normId === 'moss-nano-local') {
    return [
      { id: 'Trump', label: 'Trump (Preset)' },
      { id: 'LJS', label: 'LJ Speech (Female Preset)' },
    ]
  }

  if (providerVoices.value.length > 0) {
    return providerVoices.value.map((v: any) => ({
      id: v.id,
      label: v.name ? `${v.name}${v.lang ? ` (${v.lang})` : ''}` : v.id,
    }))
  }

  return [
    { id: 'cloud_voice_1', label: 'Rachel (Expressive · Conversational)' },
    { id: 'cloud_voice_2', label: 'Domi (Confident · Energetic)' },
    { id: 'cloud_voice_3', label: 'Bella (Soft · Empathetic)' },
    { id: 'cloud_voice_4', label: 'Antoni (Smooth · Warm)' },
  ]
})

watch(availableModels, (models) => {
  if (models.length > 0 && (!selectedModel.value || !models.some((m: any) => m.id === selectedModel.value))) {
    selectedModel.value = models[0].id
  }
}, { immediate: true })

watch(availableVoices, (voices) => {
  if (voices.length > 0 && (!selectedVoice.value || !voices.some((v: any) => v.id === selectedVoice.value))) {
    selectedVoice.value = voices[0].id
  }
}, { immediate: true })

async function checkEngineReadiness() {
  const normId = normalizeProviderId(selectedProvider.value)
  try {
    if (normId === 'pocket-tts-local') {
      const adapter = await getPocketTtsAdapterInstance()
      isEngineReady.value = adapter.state === 'ready'
    }
    else if (normId === 'kokoro-local') {
      const adapter = await getKokoroAdapter()
      isEngineReady.value = adapter.state === 'ready'
    }
    else if (normId === 'moss-nano-local') {
      const adapter = await getMossAdapterInstance()
      isEngineReady.value = adapter.state === 'ready'
    }
    else {
      isEngineReady.value = true
    }
  }
  catch {
    isEngineReady.value = false
  }
}

async function activateAndDownloadEngine() {
  if (isDownloading.value)
    return

  isDownloading.value = true
  downloadProgress.value = 0
  downloadStatusText.value = 'Initializing weights download...'
  downloadError.value = ''

  try {
    const normId = normalizeProviderId(selectedProvider.value)

    if (normId === 'pocket-tts-local') {
      const adapter = await getPocketTtsAdapterInstance()
      await adapter.loadModel({
        language: selectedModel.value || 'english_2026-04',
        onProgress: (p: any) => {
          downloadProgress.value = Math.round(p.percent ?? (p.loaded && p.total ? (p.loaded / p.total) * 100 : 0))
          downloadStatusText.value = p.file || p.name || p.message || 'Downloading Pocket TTS weights...'
        },
      })
    }
    else if (normId === 'kokoro-local') {
      const adapter = await getKokoroAdapter()
      const modelDef = KOKORO_MODELS.find(m => m.id === selectedModel.value) || KOKORO_MODELS.find(m => m.id === 'q4') || KOKORO_MODELS[0]
      await adapter.loadModel(modelDef.quantization, modelDef.platform, {
        onProgress: (p: any) => {
          downloadProgress.value = Math.round(p.percent ?? (p.loaded && p.total ? (p.loaded / p.total) * 100 : 0))
          downloadStatusText.value = p.file || p.name || 'Downloading Kokoro weights...'
        },
      })
    }
    else if (normId === 'moss-nano-local') {
      const adapter = await getMossAdapterInstance()
      await adapter.loadModel({
        onProgress: (p: any) => {
          downloadProgress.value = Math.round(p.percent ?? (p.loaded && p.total ? (p.loaded / p.total) * 100 : 0))
          downloadStatusText.value = p.file || p.name || 'Downloading MOSS weights...'
        },
      })
    }

    isEngineReady.value = true
    downloadProgress.value = 100
    toast.success('Speech engine ready!')
  }
  catch (err: any) {
    console.error('[Step 6 Speech] Download error:', err)
    downloadError.value = err?.message || 'Failed to download TTS weights'
    toast.error(downloadError.value)
    isEngineReady.value = false
  }
  finally {
    isDownloading.value = false
  }
}

async function refreshVoices() {
  const normId = normalizeProviderId(selectedProvider.value)
  toast.info('Refreshing voice list...')
  try {
    const voices = await speechStore.loadVoicesForProvider(normId)
    if (voices && voices.length > 0) {
      toast.success(`Discovered ${voices.length} voices`)
    }
    else {
      toast.info('Voice catalog loaded')
    }
  }
  catch (err: any) {
    toast.error(err?.message || 'Could not load voices')
  }
}

function openConsole() {
  if (activeConsoleUrl.value) {
    window.open(activeConsoleUrl.value, '_blank')
  }
}

const audioPlayer = ref<HTMLAudioElement | null>(null)

async function togglePreview() {
  if (isPlaying.value) {
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      audioPlayer.value = null
    }
    isPlaying.value = false
    return
  }

  // If local provider and not ready yet, trigger download automatically first
  if (isLocalProvider.value && !isEngineReady.value) {
    toast.info('Initializing TTS engine weights first...')
    await activateAndDownloadEngine()
    if (!isEngineReady.value) {
      return
    }
  }

  isPlaying.value = true
  try {
    const textToSpeak = sampleText.value || 'Hello! I am ready to be your companion. How do I sound?'
    const providerId = normalizeProviderId(selectedProvider.value)
    const voiceId = selectedVoice.value || availableVoices.value[0]?.id || 'anna'
    const modelId = selectedModel.value || availableModels.value[0]?.id || 'english_2026-04'

    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance) {
      toast.error(`Speech provider "${providerId}" is not configured.`)
      isPlaying.value = false
      return
    }

    toast.info('Synthesizing voice audio preview...')
    const audioData = await speechStore.speech(
      providerInstance as any,
      modelId,
      textToSpeak,
      voiceId,
    )

    if (!audioData || audioData.byteLength === 0) {
      throw new Error('TTS provider returned empty audio buffer')
    }

    const blob = new Blob([audioData], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioPlayer.value = audio

    audio.onended = () => {
      isPlaying.value = false
      audioPlayer.value = null
    }
    audio.onerror = () => {
      isPlaying.value = false
      audioPlayer.value = null
      toast.error('Audio playback error')
    }

    await audio.play()
  }
  catch (error: any) {
    console.error('[Step 6 Speech] Preview error:', error)
    toast.error(error.message || 'Failed to synthesize voice preview.')
    isPlaying.value = false
  }
}

const gate = inject(onboardingV2GateKey, null)
onMounted(() => {
  gate?.setGate('speech', {
    canProceed: true,
    skipLabel: 'Skip Step',
  })
})
onBeforeUnmount(() => {
  gate?.clearGate('speech')
})
</script>

<template>
  <div class="h-full flex flex-col gap-4 overflow-hidden">
    <div class="flex-shrink-0">
      <h2 class="text-xl text-neutral-800 font-semibold md:text-2xl dark:text-neutral-100">
        Her Voice Studio
      </h2>
      <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Match the voice to the body & soul — local-first neural TTS or cloud studio.
      </p>
    </div>

    <CompanionBubble
      class="flex-shrink-0"
      message="Choose how your companion will sound! Local voices run 100% offline on your device, or connect a cloud provider to unlock custom voice clones."
    />

    <div class="min-h-0 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
      <!-- SECTION A: Local Hero Cards (Top Row) -->
      <div class="flex flex-col gap-2">
        <span class="px-1 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Local Built-in Engines
        </span>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            v-for="engine in localEngines"
            :key="engine.id"
            :class="[
              'group relative flex flex-col justify-between border-2 rounded-xl p-3.5 text-left transition-all duration-300',
              selectedProvider === engine.id
                ? 'border-primary-500 bg-primary-500/5 shadow-lg shadow-primary-500/10 dark:border-primary-400'
                : 'border-neutral-200/60 bg-white/40 dark:border-neutral-800/80 dark:bg-neutral-900/40 hover:border-primary-500/50',
            ]"
            @click="selectedProvider = engine.id"
          >
            <div>
              <div class="flex items-center justify-between gap-2">
                <div
                  class="h-8 w-8 flex items-center justify-center rounded-lg"
                  :class="[selectedProvider === engine.id ? 'bg-primary-500/15' : 'bg-neutral-100 dark:bg-neutral-800']"
                >
                  <div class="h-5 w-5" :class="[engine.icon, engine.accent]" />
                </div>
                <span class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500 font-bold dark:bg-neutral-800 dark:text-neutral-400">{{ engine.tag }}</span>
              </div>
              <span class="mt-2 block text-xs text-neutral-800 font-bold dark:text-neutral-100">{{ engine.name }}</span>
              <p class="mt-1 text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                {{ engine.desc }}
              </p>
            </div>

            <div class="mt-3 flex flex-wrap gap-1 border-t border-neutral-200/40 pt-2 dark:border-neutral-800/40">
              <span
                v-for="badge in engine.badges"
                :key="badge"
                class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 font-semibold dark:bg-neutral-800 dark:text-neutral-300"
              >
                {{ badge }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- SECTION A2: Remote Cloud Providers (Mini-Card Grid) -->
      <div class="flex flex-col gap-2">
        <span class="px-1 text-xs text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Remote Cloud Providers
        </span>
        <div class="grid grid-cols-2 gap-2 md:grid-cols-5 sm:grid-cols-4">
          <button
            v-for="provider in cloudProviders"
            :key="provider.id"
            :class="[
              'flex items-center gap-2 border rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-all',
              selectedProvider === provider.id
                ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                : 'border-neutral-200/60 bg-white/40 text-neutral-700 dark:border-neutral-800/80 dark:bg-neutral-900/40 dark:text-neutral-300 hover:border-primary-500/40',
            ]"
            @click="selectedProvider = provider.id"
          >
            <div :class="[provider.icon]" class="h-4 w-4 flex-shrink-0 text-sky-500" />
            <span class="truncate">{{ provider.name }}</span>
          </button>
        </div>
      </div>

      <!-- SECTION B: Model Selection & Provisioning Panel -->
      <div class="border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Active Model</label>
          <select
            v-model="selectedModel"
            class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
              {{ model.label }}
            </option>
          </select>
        </div>

        <!-- Local Provisioning Branch: Download Progress & Readiness Status -->
        <div v-if="isLocalProvider" class="flex flex-col gap-2 pt-1">
          <!-- Optional Hugging Face Token for gated models (like kyutai/pocket-tts voices) -->
          <div class="flex flex-col gap-1 rounded-lg bg-neutral-50/80 p-2.5 dark:bg-neutral-800/40">
            <button
              type="button"
              class="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              @click="showHfTokenInput = !showHfTokenInput"
            >
              <div class="flex items-center gap-1.5">
                <div class="i-lobe-icons:huggingface h-3.5 w-3.5" />
                <span class="font-semibold">Hugging Face Token (for Pocket-TTS gated voices)</span>
              </div>
              <div :class="showHfTokenInput ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'" class="h-3.5 w-3.5" />
            </button>
            <div v-if="showHfTokenInput" class="flex gap-2 pt-1.5">
              <input
                v-model="hfTokenInput"
                type="password"
                placeholder="hf_..."
                class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-1.5 text-xs font-mono outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
                @input="saveHfToken"
              >
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                class="flex items-center self-center gap-1 px-1 text-[11px] text-primary-500 font-semibold hover:underline"
              >
                <span>Get Token</span>
                <div class="i-solar:square-top-down-bold h-3 w-3" />
              </a>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <button
              v-if="!isEngineReady && !isDownloading"
              class="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3.5 py-1.5 text-xs text-white font-bold transition-transform active:scale-95 hover:bg-primary-600"
              @click="activateAndDownloadEngine"
            >
              <div class="i-solar:download-square-bold-duotone h-4 w-4" />
              <span>Activate & Download Engine</span>
            </button>

            <button
              v-else-if="isDownloading"
              disabled
              class="flex cursor-wait items-center gap-1.5 rounded-lg bg-primary-500/80 px-3.5 py-1.5 text-xs text-white font-bold"
            >
              <div class="i-solar:restart-square-bold h-4 w-4 animate-spin" />
              <span>Downloading Weights...</span>
            </button>

            <div v-else class="flex items-center gap-2">
              <span class="flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-600 font-bold dark:text-emerald-400">
                <div class="i-solar:check-circle-bold-duotone h-4 w-4" />
                Engine Initialized & Ready
              </span>
              <button
                class="border border-neutral-200 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600 font-semibold transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                title="Force re-download weights"
                @click="activateAndDownloadEngine"
              >
                Re-download
              </button>
            </div>

            <span v-if="isDownloading" class="text-xs text-primary-500 font-mono">{{ downloadProgress }}%</span>
          </div>

          <!-- Progress Bar & Status Text -->
          <div v-if="isDownloading" class="flex flex-col gap-1">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div class="h-full bg-primary-500 transition-all duration-300" :style="{ width: `${downloadProgress}%` }" />
            </div>
            <span v-if="downloadStatusText" class="truncate text-[10px] text-neutral-400 font-mono dark:text-neutral-500">{{ downloadStatusText }}</span>
          </div>

          <!-- Error Alert if failed -->
          <div v-if="downloadError" class="flex items-start gap-2 border border-red-500/30 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
            <div class="i-solar:danger-triangle-bold-duotone mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <div class="min-w-0 flex-1">
              <span class="font-bold">Download Failed:</span>
              <p class="mt-0.5 break-all text-[11px] leading-snug">
                {{ downloadError }}
              </p>
            </div>
            <button
              class="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-600 font-bold hover:bg-red-500/30 dark:text-red-300"
              @click="activateAndDownloadEngine"
            >
              Retry
            </button>
          </div>
        </div>

        <!-- Remote Provisioning Branch: Password API Key Input with Eye Toggle & Console Link -->
        <div v-else class="flex flex-col gap-1.5 pt-1">
          <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">API Credentials</label>
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <input
                v-model="apiKeyInput"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="Enter API Key (sk-...)"
                class="w-full border border-neutral-200 rounded-lg bg-white py-2 pl-3 pr-9 text-xs font-mono outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
              >
              <button
                class="absolute right-2.5 top-1/2 text-neutral-400 -translate-y-1/2 hover:text-neutral-600 dark:hover:text-neutral-200"
                title="Toggle visibility"
                @click="showApiKey = !showApiKey"
              >
                <div :class="showApiKey ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="h-4 w-4" />
              </button>
            </div>

            <button
              v-if="activeConsoleUrl"
              class="h-9 flex items-center justify-center border border-neutral-200 rounded-lg bg-neutral-100 px-3 text-xs text-neutral-600 font-semibold transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              title="Get API Key from provider console"
              @click="openConsole"
            >
              <div class="i-solar:export-bold-duotone mr-1 h-4 w-4 text-sky-500" />
              Console ↗
            </button>
          </div>
        </div>
      </div>

      <!-- SECTION C: Unified Voice Selection & Tone Tuning Controls -->
      <div class="border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md space-y-4 dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <!-- Voice Dropdown + Load Voices Button -->
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">Voice Persona</label>
          <div class="flex items-center gap-2">
            <select
              v-model="selectedVoice"
              class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <option v-for="voice in availableVoices" :key="voice.id" :value="voice.id">
                {{ voice.label }}
              </option>
            </select>

            <button
              class="h-9 flex items-center gap-1.5 border border-neutral-200 rounded-lg bg-neutral-100 px-3 text-xs text-neutral-700 font-semibold transition-colors dark:border-neutral-700 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              title="Refresh voice catalog"
              @click="refreshVoices"
            >
              <div class="i-solar:restart-bold-duotone h-4 w-4 text-primary-500" />
              <span>Load Voices</span>
            </button>
          </div>
        </div>

        <!-- Speed & Pitch Sliders (Range: 0.75x to 1.5x) -->
        <div class="grid grid-cols-1 gap-4 border-t border-neutral-200/50 pt-3 sm:grid-cols-2 dark:border-neutral-800/50">
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">
              <span>Speech Rate / Speed</span>
              <span class="text-primary-500 font-mono">{{ speed.toFixed(2) }}x</span>
            </div>
            <input
              v-model.number="speed"
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              class="h-1.5 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
            >
          </div>

          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">
              <span>Pitch Modifier</span>
              <span class="text-primary-500 font-mono">{{ pitch.toFixed(2) }}x</span>
            </div>
            <input
              v-model.number="pitch"
              type="range"
              min="0.75"
              max="1.5"
              step="0.05"
              class="h-1.5 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
            >
          </div>
        </div>
      </div>

      <!-- SECTION D: Live Audio Preview Playground -->
      <div class="border border-neutral-200/60 rounded-xl bg-white/40 p-4 backdrop-blur-md space-y-3 dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <span class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase dark:text-neutral-500">
          Live Audio Playground
        </span>

        <div class="flex items-center gap-2">
          <input
            v-model="sampleText"
            type="text"
            class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 outline-none dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
          >

          <button
            :class="[
              'flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-all active:scale-95 shadow-md',
              isPlaying ? 'bg-amber-500 shadow-amber-500/20' : 'bg-primary-500 shadow-primary-500/20 hover:bg-primary-600',
            ]"
            @click="togglePreview"
          >
            <div :class="isPlaying ? 'i-solar:pause-bold' : 'i-solar:play-bold'" class="h-4 w-4" />
            {{ isPlaying ? 'Playing...' : 'Play Preview' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
