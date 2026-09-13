<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useLocalVoiceClone } from '../../../../../../composables/use-local-voice-clone'
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

// Hugging Face Token for gated models (Pocket-TTS voices)
const showHfTokenInput = ref(false)
const hfTokenInput = ref(typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || '' : '')
const isHFTokenModalOpen = ref(false)

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

function openHFTokenPage() {
  isHFTokenModalOpen.value = false
  window.open('https://huggingface.co/settings/tokens', '_blank')
}

// Local download state
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadStatusText = ref('')
const downloadError = ref('')
const isEngineReady = ref(false)

// Audio playback & calibration targets
const activeVoiceTab = ref<'companion' | 'user'>('companion')
const selectedUserVoice = ref<string>(userProfileStore.voiceProfileId || '')
const userSpeed = ref<number>(1.0)
const userPitch = ref<number>(1.0)

const sampleText = ref<string>('')
const userSampleText = ref<string>('')

const isPlayingTarget = ref<'companion' | 'user' | null>(null)
const isPlayingCompanion = computed(() => isPlayingTarget.value === 'companion')
const isPlayingUser = computed(() => isPlayingTarget.value === 'user')
const audioPlayer = ref<HTMLAudioElement | null>(null)

// Local Zero-Shot Voice Cloning Composable & Handlers
const {
  isCloning,
  supportsVoiceCloning,
  cloneVoiceFromFile,
  removeClonedVoice,
} = useLocalVoiceClone(selectedProvider)

const audioFileInputRef = ref<HTMLInputElement | null>(null)
const isDraggingAudio = ref(false)

function triggerAudioFileInput() {
  audioFileInputRef.value?.click()
}

async function handleAudioFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    await processAudioClone(file)
  }
  target.value = ''
}

async function handleAudioDrop(e: DragEvent) {
  isDraggingAudio.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) {
    await processAudioClone(file)
  }
}

async function processAudioClone(file: File) {
  const normId = normalizeProviderId(selectedProvider.value)
  try {
    toast.info(`Cloning vocal timbre from "${file.name}"...`)
    const cloned = await cloneVoiceFromFile(file)
    // Refresh voices catalog
    await speechStore.loadVoicesForProvider(normId)
    // Select newly cloned voice
    if (activeVoiceTab.value === 'user') {
      selectedUserVoice.value = cloned.id
    }
    else {
      selectedVoice.value = cloned.id
    }
    toast.success(`Voice "${cloned.name}" cloned and activated!`)
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to clone voice from sample.')
  }
}

const isSelectedVoiceCloned = computed(() => {
  const currentVoiceId = activeVoiceTab.value === 'user' ? selectedUserVoice.value : selectedVoice.value
  return currentVoiceId.startsWith('voice-profile-') || currentVoiceId.startsWith('pocket_clone_') || currentVoiceId.startsWith('moss_clone_')
})

async function handleDeleteCurrentClonedVoice() {
  const currentVoiceId = activeVoiceTab.value === 'user' ? selectedUserVoice.value : selectedVoice.value
  if (!isSelectedVoiceCloned.value)
    return

  const normId = normalizeProviderId(selectedProvider.value)
  try {
    await removeClonedVoice(currentVoiceId)
    await speechStore.loadVoicesForProvider(normId)
    toast.success('Cloned voice deleted')
  }
  catch (err: any) {
    toast.error(err?.message || 'Failed to delete cloned voice')
  }
}

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

  // 1. Prioritize dynamic provider voices from speechStore (including custom cloned voices)
  if (providerVoices.value.length > 0) {
    return providerVoices.value.map((v: any) => ({
      id: v.id,
      label: v.name ? `${v.name}${v.lang ? ` (${v.lang})` : ''}` : v.id,
    }))
  }

  // 2. Static fallbacks while dynamic catalog is loading
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
  if (voices.length > 0) {
    if (!selectedVoice.value || !voices.some(v => v.id === selectedVoice.value)) {
      selectedVoice.value = voices[0].id
    }
    if (!selectedUserVoice.value || !voices.some(v => v.id === selectedUserVoice.value)) {
      const alt = voices.find(v => v.id !== selectedVoice.value) || voices[0]
      selectedUserVoice.value = alt.id
    }
  }
}, { immediate: true })

watch(selectedUserVoice, (val) => {
  if (val) {
    userProfileStore.voiceProfileId = val
  }
}, { immediate: true })

// Synchronize speech settings reactively with transient onboarding draft store
watch([selectedProvider, selectedModel, selectedVoice, pitch, speed], ([prov, mod, voi, p, s]) => {
  draftStore.setSpeech({
    provider: normalizeProviderId(prov),
    model: mod,
    voiceId: voi,
    pitch: p,
    rate: s,
  })
}, { immediate: true })

// Pre-fill API key on provider change and load voices
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

  void speechStore.loadVoicesForProvider(normId)

  if (!isLocalProvider.value) {
    void providersStore.fetchModelsForProvider(normId)
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

watch([sampleGreeting, companionName, userName], ([g, cName, uName]) => {
  if (!sampleText.value || sampleText.value === g) {
    sampleText.value = g
  }
  if (!userSampleText.value) {
    userSampleText.value = `Hey ${cName}, I'm ${uName}! Looking forward to working with you.`
  }
}, { immediate: true })

function resetSampleText() {
  sampleText.value = sampleGreeting.value
}

function resetUserSampleText() {
  userSampleText.value = `Hey ${companionName.value}, I'm ${userName.value}! Looking forward to working with you.`
}

async function refreshVoices() {
  const normId = normalizeProviderId(selectedProvider.value)
  await speechStore.loadVoicesForProvider(normId)
  toast.success('Voice catalog refreshed')
}

onMounted(() => {
  void checkEngineReadiness()
  void speechStore.loadVoicesForProvider(normalizeProviderId(selectedProvider.value))
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
async function togglePreview(target: 'companion' | 'user' = 'companion') {
  if (isPlayingTarget.value === target) {
    if (audioPlayer.value) {
      audioPlayer.value.pause()
      audioPlayer.value = null
    }
    isPlayingTarget.value = null
    return
  }

  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
  isPlayingTarget.value = null

  // Pre-download weights if local engine is chosen and not ready
  if (isLocalProvider.value && !isEngineReady.value) {
    toast.info('Downloading voice engine weights first...')
    await activateAndDownloadEngine()
    if (!isEngineReady.value)
      return
  }

  isPlayingTarget.value = target
  try {
    const textToSpeak = target === 'user'
      ? (userSampleText.value || `Hello ${companionName.value}! I am ${userName.value}.`)
      : (sampleText.value || sampleGreeting.value)
    const providerId = normalizeProviderId(selectedProvider.value)
    const voiceId = target === 'user'
      ? (selectedUserVoice.value || availableVoices.value[1]?.id || availableVoices.value[0]?.id || 'adam')
      : (selectedVoice.value || availableVoices.value[0]?.id || 'anna')
    const modelId = selectedModel.value || availableModels.value[0]?.id || 'english_2026-04'

    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance) {
      toast.error(`Speech provider "${providerId}" is not configured.`)
      isPlayingTarget.value = null
      return
    }

    toast.info(`Synthesizing ${target === 'user' ? userName.value : companionName.value}'s voice...`)
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
      isPlayingTarget.value = null
      audioPlayer.value = null
    }
    audio.onerror = () => {
      isPlayingTarget.value = null
      audioPlayer.value = null
      toast.error('Audio playback error')
    }

    await audio.play()
  }
  catch (err: any) {
    console.error('[Step 9 Speech] Audio preview error:', err)
    const msg: string = err?.message || ''
    const isGated = msg.includes('401') || msg.includes('gated') || msg.includes('HF token') || msg.includes('huggingface')
    if (isGated) {
      isHFTokenModalOpen.value = true
    }
    else {
      toast.error(msg || 'Voice playback failed')
    }
    isPlayingTarget.value = null
  }
}

onBeforeUnmount(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause()
    audioPlayer.value = null
  }
  isPlayingTarget.value = null
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
  if (selectedUserVoice.value) {
    userProfileStore.voiceProfileId = selectedUserVoice.value
  }
  props.onNext()
}
</script>

<template>
  <div :class="['w-full max-w-4xl mx-auto flex flex-col gap-6 py-2 my-auto animate-fadeIn']">
    <!-- Hidden File Input for Audio Voice Cloning -->
    <input
      ref="audioFileInputRef"
      type="file"
      accept="audio/*"
      class="hidden"
      @change="handleAudioFileSelect"
    >
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

    <!-- Model Architecture & Local Engine Provisioning Panel -->
    <div :class="['flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
      <div :class="['flex flex-col sm:flex-row sm:items-center justify-between gap-2']">
        <div>
          <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
            Engine Model Architecture
          </label>
          <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
            Select the underlying neural checkpoint or speech synthesis model.
          </p>
        </div>
        <select
          v-model="selectedModel"
          :class="['w-full sm:w-64 px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-sm']"
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

      <!-- Local Provisioning & Weights Activation Bar -->
      <div v-if="isLocalProvider" :class="['flex flex-col gap-2.5 pt-2 border-t border-neutral-200/60 dark:border-white/5']">
        <!-- Optional Hugging Face Token Accordion for Gated Models (Pocket-TTS) -->
        <div :class="['flex flex-col gap-2 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-neutral-900/40']">
          <button
            type="button"
            :class="['flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors w-full']"
            @click="showHfTokenInput = !showHfTokenInput"
          >
            <div :class="['flex items-center gap-2']">
              <div :class="['i-lobe-icons:huggingface w-4 h-4 text-amber-500']" />
              <span :class="['font-semibold']">Hugging Face Access Token (for Pocket-TTS gated voices)</span>
            </div>
            <div :class="[showHfTokenInput ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone', 'w-4 h-4 text-neutral-400']" />
          </button>

          <div v-if="showHfTokenInput" :class="['flex gap-2 pt-1']">
            <input
              v-model="hfTokenInput"
              type="password"
              placeholder="hf_..."
              :class="['flex-1 px-3 py-1.5 rounded-xl text-xs font-mono bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500']"
              @input="saveHfToken"
            >
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              :class="['flex items-center self-center gap-1 px-2.5 py-1 text-xs text-primary-500 font-semibold hover:underline cursor-pointer']"
            >
              <span>Get Token</span>
              <div :class="['i-solar:square-top-down-bold w-3.5 h-3.5']" />
            </a>
          </div>
        </div>

        <!-- Activation / Readiness Trigger Row -->
        <div :class="['flex flex-wrap items-center justify-between gap-3 pt-1']">
          <div :class="['flex items-center gap-2']">
            <!-- If not ready and not downloading: Show Activate & Download -->
            <button
              v-if="!isEngineReady && !isDownloading"
              type="button"
              :class="['flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-4 py-2 shadow-sm shadow-primary-600/30 transition-all cursor-pointer']"
              @click="activateAndDownloadEngine"
            >
              <div :class="['i-solar:download-square-bold-duotone w-4 h-4']" />
              <span>Activate & Download Engine</span>
            </button>

            <!-- If downloading: Show disabled downloading spinner -->
            <button
              v-else-if="isDownloading"
              type="button"
              disabled
              :class="['flex cursor-wait items-center gap-2 rounded-xl bg-primary-500/80 text-white text-xs font-semibold px-4 py-2']"
            >
              <div :class="['i-solar:restart-square-bold w-4 h-4 animate-spin']" />
              <span>Downloading Weights ({{ downloadProgress }}%)...</span>
            </button>

            <!-- If ready: Show green badge + Re-download button -->
            <div v-else :class="['flex items-center gap-2']">
              <span :class="['flex items-center gap-1.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-3 py-1.5 ring-1 ring-emerald-500/20']">
                <div :class="['i-solar:check-circle-bold-duotone w-4 h-4']" />
                <span>Engine Initialized & Ready</span>
              </span>
              <button
                type="button"
                :class="['rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer']"
                title="Force re-download weights"
                @click="activateAndDownloadEngine"
              >
                Re-download
              </button>
            </div>
          </div>

          <span v-if="isDownloading" :class="['text-xs text-primary-500 font-mono font-semibold']">
            {{ downloadProgress }}%
          </span>
        </div>

        <!-- Download Progress Bar -->
        <div v-if="isDownloading" :class="['flex flex-col gap-1 mt-1']">
          <div :class="['w-full h-2 rounded-full bg-primary-500/20 overflow-hidden']">
            <div
              :class="['h-full bg-primary-500 transition-all duration-200 rounded-full']"
              :style="{ width: `${downloadProgress}%` }"
            />
          </div>
          <span v-if="downloadStatusText" :class="['truncate text-[11px] text-neutral-400 font-mono']">
            {{ downloadStatusText }}
          </span>
        </div>

        <!-- Download Error Box -->
        <div
          v-if="downloadError"
          :class="['flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400']"
        >
          <div :class="['i-solar:danger-triangle-bold-duotone w-4 h-4 flex-shrink-0 mt-0.5 text-red-500']" />
          <div :class="['flex-1 min-w-0']">
            <span :class="['font-bold']">Download Failed:</span>
            <p :class="['text-[11px] break-all leading-snug mt-0.5']">
              {{ downloadError }}
            </p>
          </div>
          <button
            type="button"
            :class="['px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-300 font-semibold cursor-pointer text-xs transition-colors']"
            @click="activateAndDownloadEngine"
          >
            Retry
          </button>
        </div>
      </div>
    </div>

    <!-- Dual Voice Calibration Section -->
    <div :class="['flex flex-col gap-4']">
      <!-- Target Switcher Tabs: Companion Voice vs User Voice Profile -->
      <div :class="['flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10']">
        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeVoiceTab === 'companion'
              ? 'bg-white dark:bg-neutral-800 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="activeVoiceTab = 'companion'"
        >
          <div :class="['i-solar:heart-bold-duotone w-4 h-4']" />
          <span :class="['truncate']">{{ companionName }}'s Voice</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeVoiceTab === 'user'
              ? 'bg-white dark:bg-neutral-800 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
          ]"
          @click="activeVoiceTab = 'user'"
        >
          <div :class="['i-solar:user-speak-bold-duotone w-4 h-4 text-purple-500']" />
          <span :class="['truncate']">{{ userName }}'s Voice Profile</span>
        </button>
      </div>

      <!-- COMPANION VOICE CALIBRATION PANEL -->
      <div
        v-if="activeVoiceTab === 'companion'"
        :class="['flex flex-col gap-4 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] animate-fadeIn']"
      >
        <div :class="['flex items-center justify-between']">
          <div :class="['flex items-center gap-2']">
            <div :class="['i-solar:heart-bold-duotone w-4 h-4 text-primary-500']" />
            <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider']">
              {{ companionName }}'s Voice Persona
            </span>
          </div>
          <span :class="['text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary-500/10 text-primary-600 dark:text-primary-400']">
            Companion Voice
          </span>
        </div>

        <!-- Timbre Selector with Refresh Voices Button -->
        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide']">
            Voice Persona Timbre
          </label>
          <div :class="['flex items-center gap-2']">
            <select
              v-model="selectedVoice"
              :class="['flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-sm']"
            >
              <option
                v-for="voice in availableVoices"
                :key="voice.id"
                :value="voice.id"
              >
                {{ voice.label }}
              </option>
            </select>
            <button
              type="button"
              :class="['h-9 px-3 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm']"
              title="Refresh voice catalog"
              @click="refreshVoices"
            >
              <div :class="['i-solar:restart-bold-duotone w-3.5 h-3.5 text-primary-500']" />
              <span>Load Voices</span>
            </button>
          </div>
        </div>

        <!-- 1-Row Inline Instant Voice Clone Dropzone -->
        <div
          v-if="supportsVoiceCloning"
          :class="[
            'flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-dashed transition-all cursor-pointer select-none',
            isDraggingAudio
              ? 'border-primary-500 bg-primary-500/10'
              : 'border-neutral-300/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-primary-500/40',
          ]"
          @dragover.prevent="isDraggingAudio = true"
          @dragleave.prevent="isDraggingAudio = false"
          @drop.prevent="handleAudioDrop"
          @click="triggerAudioFileInput"
        >
          <div class="min-w-0 flex flex-1 items-center gap-2.5">
            <div :class="['w-8 h-8 rounded-xl bg-primary-500/15 text-primary-500 flex items-center justify-center flex-shrink-0 text-sm']">
              <div v-if="isCloning" class="i-solar:restart-circle-bold h-4 w-4 animate-spin" />
              <div v-else class="i-solar:magic-stick-3-bold-duotone h-4 w-4" />
            </div>

            <div class="min-w-0 flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                  Instant Zero-Shot Voice Clone
                </span>
                <span class="rounded bg-primary-500/15 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold font-mono uppercase dark:text-primary-400">
                  Neural Clone
                </span>
              </div>
              <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ isCloning ? 'Conditioning neural audio waveform...' : 'Drop 5–10s audio sample (.wav, .mp3) or click to browse' }}
              </p>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center gap-2" @click.stop>
            <button
              v-if="isSelectedVoiceCloned"
              type="button"
              :class="['p-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors']"
              title="Delete currently selected custom voice clone"
              @click="handleDeleteCurrentClonedVoice"
            >
              <div class="i-solar:trash-bin-trash-bold h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              :disabled="isCloning"
              :class="[
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/20',
                isCloning && 'opacity-60 cursor-not-allowed',
              ]"
              @click="triggerAudioFileInput"
            >
              <div class="i-solar:upload-track-2-bold-duotone h-3.5 w-3.5" />
              <span>{{ isCloning ? 'Cloning...' : 'Upload WAV' }}</span>
            </button>
          </div>
        </div>

        <!-- Acoustic Sliders (Speed & Pitch) -->
        <div :class="['grid grid-cols-1 md:grid-cols-2 gap-4 pt-1']">
          <div :class="['flex flex-col gap-1.5']">
            <div :class="['flex items-center justify-between text-xs font-semibold']">
              <span :class="['text-neutral-600 dark:text-neutral-400']">Speech Rate / Speed</span>
              <span :class="['text-primary-500 font-mono']">{{ speed.toFixed(2) }}x</span>
            </div>
            <input
              v-model.number="speed"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
            >
          </div>

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
              :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
            >
          </div>
        </div>

        <!-- Companion Audio Preview & Editable Playground -->
        <div :class="['p-3.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900/60 shadow-sm flex flex-col gap-2.5']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <span :class="['text-xs font-bold text-neutral-800 dark:text-white']">
                {{ companionName }}'s Greeting Sample
              </span>
              <span :class="['text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/10 text-neutral-500 font-mono']">
                Live Preview
              </span>
            </div>
            <button
              type="button"
              :class="['text-[11px] text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors cursor-pointer']"
              @click="resetSampleText"
            >
              Reset Text
            </button>
          </div>

          <div :class="['flex items-center gap-2.5']">
            <input
              v-model="sampleText"
              type="text"
              placeholder="Enter greeting sample text to preview..."
              :class="['flex-1 px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 select-text']"
            >
            <button
              type="button"
              :class="[
                'px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-sm',
                isPlayingCompanion
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30',
              ]"
              @click="togglePreview('companion')"
            >
              <div :class="[isPlayingCompanion ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
              <span>{{ isPlayingCompanion ? 'Stop' : 'Play Preview' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- USER / PRODUCER VOICE CALIBRATION PANEL -->
      <div
        v-else
        :class="['flex flex-col gap-4 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] animate-fadeIn']"
      >
        <div :class="['flex items-center justify-between']">
          <div :class="['flex items-center gap-2']">
            <div :class="['i-solar:user-speak-bold-duotone w-4 h-4 text-purple-500']" />
            <span :class="['text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider']">
              {{ userName }}'s Voice Profile
            </span>
          </div>
          <span :class="['text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400']">
            Producer / User Voice
          </span>
        </div>

        <!-- Timbre Selector with Refresh Voices Button -->
        <div :class="['flex flex-col gap-1.5']">
          <label :class="['text-xs font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide']">
            User Voice Persona
          </label>
          <div :class="['flex items-center gap-2']">
            <select
              v-model="selectedUserVoice"
              :class="['flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-purple-500 cursor-pointer shadow-sm']"
            >
              <option
                v-for="voice in availableVoices"
                :key="voice.id"
                :value="voice.id"
              >
                {{ voice.label }}
              </option>
            </select>
            <button
              type="button"
              :class="['h-9 px-3 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm']"
              title="Refresh voice catalog"
              @click="refreshVoices"
            >
              <div :class="['i-solar:restart-bold-duotone w-3.5 h-3.5 text-purple-500']" />
              <span>Load Voices</span>
            </button>
          </div>
        </div>

        <!-- 1-Row Inline Instant Voice Clone Dropzone -->
        <div
          v-if="supportsVoiceCloning"
          :class="[
            'flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl border border-dashed transition-all cursor-pointer select-none',
            isDraggingAudio
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-neutral-300/80 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] hover:border-purple-500/40',
          ]"
          @dragover.prevent="isDraggingAudio = true"
          @dragleave.prevent="isDraggingAudio = false"
          @drop.prevent="handleAudioDrop"
          @click="triggerAudioFileInput"
        >
          <div class="min-w-0 flex flex-1 items-center gap-2.5">
            <div :class="['w-8 h-8 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center flex-shrink-0 text-sm']">
              <div v-if="isCloning" class="i-solar:restart-circle-bold h-4 w-4 animate-spin" />
              <div v-else class="i-solar:magic-stick-3-bold-duotone h-4 w-4" />
            </div>

            <div class="min-w-0 flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                  Instant Zero-Shot Voice Clone
                </span>
                <span class="rounded bg-purple-500/15 px-1.5 py-0.2 text-[9px] text-purple-600 font-bold font-mono uppercase dark:text-purple-400">
                  User Voice
                </span>
              </div>
              <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ isCloning ? 'Conditioning neural audio waveform...' : 'Drop 5–10s audio sample (.wav, .mp3) or click to browse' }}
              </p>
            </div>
          </div>

          <div class="flex flex-shrink-0 items-center gap-2" @click.stop>
            <button
              v-if="isSelectedVoiceCloned"
              type="button"
              :class="['p-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors']"
              title="Delete currently selected custom voice clone"
              @click="handleDeleteCurrentClonedVoice"
            >
              <div class="i-solar:trash-bin-trash-bold h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              :disabled="isCloning"
              :class="[
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20',
                isCloning && 'opacity-60 cursor-not-allowed',
              ]"
              @click="triggerAudioFileInput"
            >
              <div class="i-solar:upload-track-2-bold-duotone h-3.5 w-3.5" />
              <span>{{ isCloning ? 'Cloning...' : 'Upload WAV' }}</span>
            </button>
          </div>
        </div>

        <!-- Acoustic Sliders (Speed & Pitch) -->
        <div :class="['grid grid-cols-1 md:grid-cols-2 gap-4 pt-1']">
          <div :class="['flex flex-col gap-1.5']">
            <div :class="['flex items-center justify-between text-xs font-semibold']">
              <span :class="['text-neutral-600 dark:text-neutral-400']">Speech Rate / Speed</span>
              <span :class="['text-purple-500 font-mono']">{{ userSpeed.toFixed(2) }}x</span>
            </div>
            <input
              v-model.number="userSpeed"
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              :class="['w-full accent-purple-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
            >
          </div>

          <div :class="['flex flex-col gap-1.5']">
            <div :class="['flex items-center justify-between text-xs font-semibold']">
              <span :class="['text-neutral-600 dark:text-neutral-400']">Vocal Pitch</span>
              <span :class="['text-purple-500 font-mono']">{{ userPitch.toFixed(2) }}x</span>
            </div>
            <input
              v-model.number="userPitch"
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              :class="['w-full accent-purple-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
            >
          </div>
        </div>

        <!-- User Audio Preview & Editable Playground -->
        <div :class="['p-3.5 rounded-2xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900/60 shadow-sm flex flex-col gap-2.5']">
          <div :class="['flex items-center justify-between']">
            <div :class="['flex items-center gap-2']">
              <span :class="['text-xs font-bold text-neutral-800 dark:text-white']">
                {{ userName }}'s Spoken Sample
              </span>
              <span :class="['text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-semibold']">
                Producer Sample
              </span>
            </div>
            <button
              type="button"
              :class="['text-[11px] text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors cursor-pointer']"
              @click="resetUserSampleText"
            >
              Reset Text
            </button>
          </div>

          <div :class="['flex items-center gap-2.5']">
            <input
              v-model="userSampleText"
              type="text"
              placeholder="Enter user sample speech to preview..."
              :class="['flex-1 px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-purple-500 select-text']"
            >
            <button
              type="button"
              :class="[
                'px-4 py-2 rounded-xl font-semibold text-xs transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-sm',
                isPlayingUser
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30',
              ]"
              @click="togglePreview('user')"
            >
              <div :class="[isPlayingUser ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
              <span>{{ isPlayingUser ? 'Stop' : 'Play Preview' }}</span>
            </button>
          </div>
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

    <!-- Hugging Face Token Helper Modal -->
    <Teleport to="body">
      <div
        v-if="isHFTokenModalOpen"
        class="pointer-events-auto fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @pointerdown.stop
        @mousedown.stop
        @touchstart.stop
        @click.stop.self="isHFTokenModalOpen = false"
      >
        <div
          class="max-w-sm w-full border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
          @pointerdown.stop
          @mousedown.stop
          @touchstart.stop
          @click.stop
        >
          <!-- Icon + Title -->
          <div class="mb-4 flex items-center gap-3">
            <div class="size-12 flex shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 dark:bg-amber-500/25">
              <div class="i-solar:key-bold-duotone size-6.5" />
            </div>
            <div>
              <h3 class="text-base text-neutral-900 font-bold dark:text-white">
                Hugging Face Token Required
              </h3>
              <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                This voice is behind a gated model
              </p>
            </div>
          </div>

          <!-- Body -->
          <p class="mb-5 text-sm text-neutral-600 leading-relaxed dark:text-neutral-300">
            The voice you selected (<span class="text-neutral-800 font-semibold dark:text-neutral-100">{{ selectedVoice }}</span>) is hosted on a gated Hugging Face repository.
            To use it, you need a free Hugging Face account, accept the model gate, and paste your access token below.
          </p>

          <!-- Steps -->
          <ol class="mb-5 text-xs text-neutral-500 space-y-2 dark:text-neutral-400">
            <li class="flex items-start gap-2">
              <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">1</span>
              <span>Create a free account at <span class="text-neutral-700 font-semibold dark:text-neutral-200">huggingface.co</span></span>
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">2</span>
              <span>Accept the gate at <span class="text-neutral-700 font-semibold dark:text-neutral-200">kyutai/pocket-tts</span></span>
            </li>
            <li class="flex items-start gap-2">
              <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">3</span>
              <span>Generate a <span class="text-neutral-700 font-semibold dark:text-neutral-200">Read</span> token and paste it below</span>
            </li>
          </ol>

          <!-- Quick Token Input inside Modal -->
          <div class="mb-5 flex flex-col gap-1.5">
            <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">Paste Token Here</label>
            <input
              v-model="hfTokenInput"
              type="password"
              placeholder="hf_..."
              class="w-full border border-neutral-200 rounded-xl bg-neutral-100 px-3 py-2 text-xs text-neutral-900 font-mono outline-none dark:border-white/10 focus:border-primary-500 dark:bg-neutral-800 dark:text-white"
              @input="saveHfToken"
            >
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              type="button"
              class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-amber-500 py-2.5 text-xs text-white font-semibold shadow-amber-500/25 shadow-md transition active:scale-95 hover:bg-amber-600"
              @pointerdown.stop
              @click.stop="openHFTokenPage"
            >
              <div class="i-solar:key-bold-duotone size-3.5" />
              <span>Get Token</span>
            </button>
            <button
              type="button"
              class="flex-1 cursor-pointer rounded-2xl bg-neutral-100 py-2.5 text-xs text-neutral-600 font-semibold transition active:scale-98 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
              @pointerdown.stop
              @click.stop="isHFTokenModalOpen = false"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
