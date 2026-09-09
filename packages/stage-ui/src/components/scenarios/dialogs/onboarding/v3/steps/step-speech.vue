<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { getStarterCharacter, STARTER_CHARACTERS } from '../../../../../../constants/prompts/character-defaults'
import { getKokoroAdapter } from '../../../../../../libs/inference/adapters/kokoro'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { getMossAdapterInstance } from '../../../../../../stores/providers/moss-audio-utils'
import { getPocketTtsAdapterInstance } from '../../../../../../stores/providers/pocket-audio-utils'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { KOKORO_MODELS } from '../../../../../../workers/kokoro/constants'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const draftStore = useOnboardingV3Draft()
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

// 1. Initial State from Draft
const selectedProvider = ref<string>(
  draftStore.state.ttsProvider
  || (draftStore.state.architecture === 'local' ? 'pocket' : 'pocket'),
)
const selectedModel = ref<string>(draftStore.state.ttsModel || 'english_2026-04')
const selectedVoice = ref<string>(draftStore.state.ttsVoiceId || 'anna')
const speed = ref<number>(draftStore.state.ttsRate ?? 1.0)
const pitch = ref<number>(draftStore.state.ttsPitch ?? 1.0)

const activeEngineTab = ref<'local' | 'cloud'>(
  ['kokoro-local', 'pocket-tts-local', 'moss-nano-local', 'pocket', 'kokoro', 'moss'].includes(selectedProvider.value)
    ? 'local'
    : 'cloud',
)

// Auto-switch provider when switching between Local and Cloud tabs
watch(activeEngineTab, (tab) => {
  if (tab === 'cloud' && isLocalProvider.value) {
    selectedProvider.value = cloudProviders.value[0]?.id || 'elevenlabs'
  }
  else if (tab === 'local' && !isLocalProvider.value) {
    selectedProvider.value = 'pocket'
  }
})

// API credentials
const showApiKey = ref(false)
const apiKeyInput = ref('')

// Local download state
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadError = ref('')
const isEngineReady = ref(false)

// Audio playback state
const isPlayingSample = ref(false)
const audioPlayer = ref<HTMLAudioElement | null>(null)

const isLocalProvider = computed(() => {
  const norm = normalizeProviderId(selectedProvider.value)
  return ['kokoro-local', 'pocket-tts-local', 'moss-nano-local'].includes(norm)
})

// Dynamic models & listVoices queries from stores
const providerModels = computed(() => providersStore.getModelsForProvider(normalizeProviderId(selectedProvider.value)) || [])
const providerVoices = computed(() => speechStore.getVoicesForProvider(normalizeProviderId(selectedProvider.value)) || [])

// 2. Engine Presets / Hero Cards
const localEngines = [
  {
    id: 'pocket',
    normId: 'pocket-tts-local',
    name: 'Pocket-TTS Local',
    icon: 'i-solar:microphone-3-bold-duotone',
    accent: 'text-emerald-500 dark:text-emerald-400',
    tag: 'RECOMMENDED · CPU',
    desc: 'Low-latency ~100M multilingual CPU engine with zero-shot voice synthesis.',
    badges: ['🇺🇸 EN', '🇫🇷 FR', '🇪🇸 ES', '🇩🇪 DE', '🇮🇹 IT'],
  },
  {
    id: 'kokoro',
    normId: 'kokoro-local',
    name: 'Kokoro Local TTS',
    icon: 'i-solar:heart-bold-duotone',
    accent: 'text-pink-500 dark:text-pink-400',
    tag: 'NEURAL AUDIO',
    desc: 'High-quality 82M neural TTS with expressive multilingual voices.',
    badges: ['🇺🇸 EN', '🇯🇵 JP', '🇨🇳 ZH', '🇪🇸 ES', '🇫🇷 FR'],
  },
  {
    id: 'moss',
    normId: 'moss-nano-local',
    name: 'Moss-Nano Local',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-amber-500 dark:text-amber-400',
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
  'airi-audio-server': { name: 'AIRI Audio Server', icon: 'i-solar:server-square-bold-duotone', consoleUrl: 'https://github.com/dasilva333/airi-audio-server' },
  'alibaba-cloud-model-studio': { name: 'Alibaba Qwen TTS', icon: 'i-simple-icons:alibabacloud', consoleUrl: 'https://dashscope.console.aliyun.com' },
}

const INTERNAL_PROVIDERS = [
  'speech-noop',
  'virtual-audio-studio',
  'kokoro',
  'pocket',
  'moss',
  'kokoro-local',
  'pocket-tts-local',
  'moss-nano-local',
]

const cloudProviders = computed(() => {
  const allMap = providersStore.allProvidersMetadata || {}
  const items = Object.values(allMap).filter(p => p.category === 'speech' && !INTERNAL_PROVIDERS.includes(p.id))

  const seen = new Set<string>()
  const list: Array<{ id: string, name: string, icon: string, consoleUrl: string }> = []

  if (items.length > 0) {
    for (const p of items) {
      if (p.id.includes('noop') || p.id.includes('test'))
        continue

      const known = PROVIDER_DISPLAY_NAMES[p.id]
      let displayName = known?.name || (p as any).name || p.id
      if (displayName.startsWith('settings.')) {
        displayName = p.id
          .replace(/-speech|-tts/g, '')
          .split('-')
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ')
      }

      if (seen.has(displayName))
        continue
      seen.add(displayName)

      list.push({
        id: p.id,
        name: displayName,
        icon: known?.icon || p.icon || 'i-solar:cloud-bold-duotone',
        consoleUrl: known?.consoleUrl || (p as any).consoleUrl || (p as any).websiteUrl || '',
      })
    }
    return list
  }

  return Object.entries(PROVIDER_DISPLAY_NAMES).slice(0, 6).map(([id, info]) => ({
    id,
    name: info.name,
    icon: info.icon || 'i-solar:cloud-bold-duotone',
    consoleUrl: info.consoleUrl || '',
  }))
})

const activeProviderDisplayName = computed(() => {
  const match = cloudProviders.value.find(p => p.id === selectedProvider.value)
  return match?.name || PROVIDER_DISPLAY_NAMES[selectedProvider.value]?.name || selectedProvider.value
})

const activeConsoleUrl = computed(() => {
  const match = cloudProviders.value.find(p => p.id === selectedProvider.value)
  return match?.consoleUrl || ''
})

// 3. Models & Voices Resolution
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

// Auto-select valid model & voice
watch(availableModels, (models) => {
  if (models.length > 0 && (!selectedModel.value || !models.some(m => m.id === selectedModel.value))) {
    selectedModel.value = models[0].id
  }
}, { immediate: true })

watch(availableVoices, (voices) => {
  if (voices.length > 0 && (!selectedVoice.value || !voices.some(v => v.id === selectedVoice.value))) {
    selectedVoice.value = voices[0].id
  }
}, { immediate: true })

// Pre-fill API key on provider change
watch(selectedProvider, async (providerId) => {
  if (!providerId)
    return

  const normId = normalizeProviderId(providerId)
  const config = providersStore.getProviderConfig(normId)
  if (config?.apiKey) {
    apiKeyInput.value = String(config.apiKey)
  }
  else {
    apiKeyInput.value = ''
  }

  if (!isLocalProvider.value) {
    void providersStore.fetchModelsForProvider(normId)
    void speechStore.loadVoicesForProvider(normId)
  }
  else {
    void checkEngineReadiness()
  }
}, { immediate: true })

// 4. Greeting Text Resolution
const resolvedPersona = computed(() => {
  const personaCardId = draftStore.state.personaCardId || 'default'
  const userName = draftStore.state.userName || userProfileStore.name || 'Manager'

  if (draftStore.state.importedCardDraft) {
    const rawData = draftStore.state.importedCardDraft as any
    const data = rawData.data || rawData
    const greeting = data.first_mes || data.greetings?.[0]
    return {
      name: data.nickname || data.name || 'Companion',
      greeting: greeting ? greeting.replace(USER_TOKEN_REGEX, userName) : '',
    }
  }

  if (STARTER_CHARACTERS[personaCardId]) {
    const p = getStarterCharacter(personaCardId)
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

const companionName = computed(() => resolvedPersona.value.name || 'Companion')
const userName = computed(() => draftStore.state.userName || userProfileStore.name || 'User')

const sampleGreeting = computed(() => {
  if (resolvedPersona.value.greeting)
    return resolvedPersona.value.greeting
  return `Hello ${userName.value}! I'm ${companionName.value}. Everything is ready — how do I sound?`
})

// 5. Engine Readiness & Weights Download
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
    console.error('[Step 9 Speech] Download error:', err)
    downloadError.value = err?.message || 'Failed to download TTS weights'
    toast.error(downloadError.value)
    isEngineReady.value = false
  }
  finally {
    isDownloading.value = false
  }
}

// 6. Audio Sample Playback
async function togglePreview() {
  if (isPlayingSample.value) {
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      audioPlayer.value = null
    }
    isPlayingSample.value = false
    return
  }

  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }

  // Pre-download weights if local engine is chosen and not ready
  if (isLocalProvider.value && !isEngineReady.value) {
    toast.info('Downloading voice engine weights first...')
    await activateAndDownloadEngine()
    if (!isEngineReady.value)
      return
  }

  isPlayingSample.value = true
  try {
    const textToSpeak = sampleGreeting.value
    const providerId = normalizeProviderId(selectedProvider.value)
    const voiceId = selectedVoice.value || availableVoices.value[0]?.id || 'anna'
    const modelId = selectedModel.value || availableModels.value[0]?.id || 'english_2026-04'

    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance) {
      toast.error(`Speech provider "${providerId}" is not configured.`)
      isPlayingSample.value = false
      return
    }

    toast.info(`Synthesizing ${companionName.value}'s voice...`)
    const audioData = await speechStore.speech(
      providerInstance as any,
      modelId,
      textToSpeak,
      voiceId,
    )

    if (!audioData || audioData.byteLength === 0) {
      throw new Error('TTS returned empty audio stream')
    }

    const blob = new Blob([audioData], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioPlayer.value = audio

    audio.onended = () => {
      isPlayingSample.value = false
      audioPlayer.value = null
    }
    audio.onerror = () => {
      isPlayingSample.value = false
      audioPlayer.value = null
      toast.error('Audio playback error')
    }

    await audio.play()
  }
  catch (err: any) {
    console.error('[Step 9 Speech] Audio preview error:', err)
    toast.error(err?.message || 'Voice playback failed')
    isPlayingSample.value = false
  }
}

onBeforeUnmount(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
})

// 7. Navigation Handlers
function handleContinue() {
  draftStore.setSpeech({
    provider: normalizeProviderId(selectedProvider.value),
    model: selectedModel.value,
    voiceId: selectedVoice.value,
    pitch: pitch.value,
    rate: speed.value,
  })
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-6 py-2 my-auto animate-fadeIn']">
    <!-- Step Header (Sticky so navigation/switch is always visible) -->
    <div :class="['sticky top-0 z-20 bg-neutral-50/95 dark:bg-[#0c0c0e]/95 backdrop-blur-md flex items-start justify-between gap-4 border-b border-neutral-200/60 dark:border-white/5 pb-3 pt-2 -mx-2 px-2']">
      <div :class="['flex items-center gap-3']">
        <div :class="['w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-xl flex-shrink-0']">
          <div :class="['i-solar:soundwave-bold-duotone w-5 h-5']" />
        </div>
        <div>
          <div :class="['flex items-center gap-2']">
            <h2 :class="['text-lg font-bold text-neutral-900 dark:text-white tracking-tight']">
              Neural Voice Studio
            </h2>
            <span :class="['text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400']">
              Step 9
            </span>
          </div>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
            Calibrate the vocal cords and neural acoustics of {{ companionName }}.
          </p>
        </div>
      </div>

      <!-- Mode Switcher (Local vs Cloud) -->
      <div :class="['flex p-1 rounded-xl bg-neutral-100 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 text-xs font-semibold flex-shrink-0 shadow-sm']">
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
            activeEngineTab === 'local'
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="activeEngineTab = 'local'"
        >
          <div :class="['i-solar:cpu-bolt-bold-duotone w-3.5 h-3.5']" />
          <span>Local Engines</span>
        </button>
        <button
          type="button"
          :class="[
            'px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
            activeEngineTab === 'cloud'
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="activeEngineTab = 'cloud'"
        >
          <div :class="['i-solar:cloud-bold-duotone w-3.5 h-3.5']" />
          <span>Cloud Providers</span>
        </button>
      </div>
    </div>

    <!-- Main Engine Selector -->
    <div v-if="activeEngineTab === 'local'" :class="['grid grid-cols-1 md:grid-cols-3 gap-4']">
      <div
        v-for="engine in localEngines"
        :key="engine.id"
        :class="[
          'relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group text-left',
          selectedProvider === engine.id || selectedProvider === engine.normId
            ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
            : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
        ]"
        @click="selectedProvider = engine.id"
      >
        <div>
          <div :class="['flex items-center justify-between mb-2.5']">
            <div :class="['w-8 h-8 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-white/10 flex items-center justify-center text-lg shadow-sm', engine.accent]">
              <div :class="[engine.icon, 'w-4 h-4']" />
            </div>
            <span :class="['text-[9px] font-bold px-2 py-0.5 rounded-md bg-neutral-200/60 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 uppercase tracking-wide font-mono']">
              {{ engine.tag }}
            </span>
          </div>

          <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white']">
            {{ engine.name }}
          </h3>
          <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed']">
            {{ engine.desc }}
          </p>
        </div>

        <div :class="['mt-4 pt-3 border-t border-neutral-200/40 dark:border-white/5 flex flex-wrap items-center gap-1']">
          <span
            v-for="badge in engine.badges"
            :key="badge"
            :class="['text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 font-mono']"
          >
            {{ badge }}
          </span>
        </div>
      </div>
    </div>

    <!-- Cloud Providers Grid -->
    <div v-else :class="['flex flex-col gap-4']">
      <div :class="['grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto p-1 border border-neutral-200/40 dark:border-white/5 rounded-2xl bg-neutral-50/40 dark:bg-white/[0.01]']">
        <button
          v-for="provider in cloudProviders"
          :key="provider.id"
          type="button"
          :class="[
            'p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 cursor-pointer',
            selectedProvider === provider.id
              ? 'border-primary-500/80 bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30'
              : 'border-neutral-200/60 dark:border-white/5 bg-white dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-white/20',
          ]"
          @click="selectedProvider = provider.id"
        >
          <div :class="['w-7 h-7 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-sm flex-shrink-0']">
            <div :class="[provider.icon || 'i-solar:cloud-bold-duotone', 'w-4 h-4']" />
          </div>
          <span :class="['text-xs font-semibold truncate']">
            {{ provider.name }}
          </span>
        </button>
      </div>

      <!-- Cloud API Key Configuration -->
      <div :class="['p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] flex flex-col gap-3']">
        <div :class="['flex items-center justify-between']">
          <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 tracking-wide uppercase']">
            {{ activeProviderDisplayName }} API Credentials
          </label>
          <a
            v-if="activeConsoleUrl"
            :href="activeConsoleUrl"
            target="_blank"
            rel="noopener noreferrer"
            :class="['text-xs text-primary-500 hover:underline flex items-center gap-1 font-medium']"
          >
            <span>Get API Key</span>
            <div :class="['i-solar:arrow-right-up-linear w-3 h-3']" />
          </a>
        </div>
        <div :class="['relative flex items-center']">
          <input
            v-model="apiKeyInput"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="Paste your API key here..."
            :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 pr-10']"
          >
          <button
            type="button"
            :class="['absolute right-2.5 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white cursor-pointer']"
            @click="showApiKey = !showApiKey"
          >
            <div :class="[showApiKey ? 'i-solar:eye-bold' : 'i-solar:eye-closed-bold', 'w-4 h-4']" />
          </button>
        </div>
      </div>
    </div>

    <!-- Model & Voice Parameters Selection -->
    <div :class="['grid grid-cols-1 md:grid-cols-2 gap-4']">
      <!-- Voice Model Selector -->
      <div :class="['flex flex-col gap-1.5']">
        <label :class="['text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide']">
          Engine Model
        </label>
        <select
          v-model="selectedModel"
          :class="['w-full px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer']"
        >
          <option
            v-for="model in availableModels"
            :key="model.id"
            :value="model.id"
          >
            {{ model.label }}
          </option>
        </select>
      </div>

      <!-- Voice Timbre Selector -->
      <div :class="['flex flex-col gap-1.5']">
        <label :class="['text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide']">
          Voice Persona Timbre
        </label>
        <select
          v-model="selectedVoice"
          :class="['w-full px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer']"
        >
          <option
            v-for="voice in availableVoices"
            :key="voice.id"
            :value="voice.id"
          >
            {{ voice.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Acoustic Sliders (Speed & Pitch) -->
    <div :class="['grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
      <!-- Speed Slider -->
      <div :class="['flex flex-col gap-1.5']">
        <div :class="['flex items-center justify-between text-xs font-semibold']">
          <span :class="['text-neutral-600 dark:text-neutral-400']">Speaking Rate</span>
          <span :class="['text-primary-500 font-mono']">{{ speed.toFixed(2) }}x</span>
        </div>
        <input
          v-model.number="speed"
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-white/10']"
        >
      </div>

      <!-- Pitch Slider -->
      <div :class="['flex flex-col gap-1.5']">
        <div :class="['flex items-center justify-between text-xs font-semibold']">
          <span :class="['text-neutral-600 dark:text-neutral-400']">Vocal Pitch</span>
          <span :class="['text-primary-500 font-mono']">{{ pitch.toFixed(2) }}x</span>
        </div>
        <input
          v-model.number="pitch"
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-white/10']"
        >
      </div>
    </div>

    <!-- Download Progress Bar (When Downloading Weights) -->
    <div
      v-if="isDownloading"
      :class="['p-4 rounded-2xl bg-primary-500/10 border border-primary-500/30 flex flex-col gap-2 animate-fadeIn']"
    >
      <div :class="['flex items-center justify-between text-xs font-semibold text-primary-600 dark:text-primary-400']">
        <span :class="['truncate max-w-sm']">{{ downloadStatusText }}</span>
        <span>{{ downloadProgress }}%</span>
      </div>
      <div :class="['w-full h-2 rounded-full bg-primary-500/20 overflow-hidden']">
        <div
          :class="['h-full bg-primary-500 transition-all duration-200 rounded-full']"
          :style="{ width: `${downloadProgress}%` }"
        />
      </div>
    </div>

    <!-- Live Audio Preview & Sample Card -->
    <div :class="['p-4 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900/60 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4']">
      <div :class="['flex items-start gap-3 w-full']">
        <div :class="['w-9 h-9 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center text-lg flex-shrink-0 mt-0.5']">
          <div :class="['i-solar:chat-round-line-bold w-4 h-4']" />
        </div>
        <div :class="['flex-1 min-w-0']">
          <div :class="['flex items-center gap-2']">
            <span :class="['text-xs font-bold text-neutral-800 dark:text-white']">
              {{ companionName }}'s Greeting Sample
            </span>
            <span :class="['text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-500 font-mono']">
              Live Preview
            </span>
          </div>
          <p :class="['text-xs text-neutral-600 dark:text-neutral-300 italic mt-1 leading-relaxed select-text']">
            "{{ sampleGreeting }}"
          </p>
        </div>
      </div>

      <!-- Play / Stop Button -->
      <button
        type="button"
        :class="[
          'px-5 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-sm',
          isPlayingSample
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30',
        ]"
        @click="togglePreview"
      >
        <div :class="[isPlayingSample ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
        <span>{{ isPlayingSample ? 'Stop Playback' : 'Listen to Voice' }}</span>
      </button>
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
