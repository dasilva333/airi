<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import AssistantBubble from '../components/assistant-bubble.vue'

import { parseActor } from '../../../../../../composables/queues'
import { stripMarkers, stripPacingEnvelopes } from '../../../../../../composables/response-categoriser'
import { useLocalVoiceClone } from '../../../../../../composables/use-local-voice-clone'
import { useProcessSpawner } from '../../../../../../composables/use-process-spawner'
import { getStarterCharacter, STARTER_CHARACTERS } from '../../../../../../constants/prompts/character-defaults'
import { STARTER_VOICE_CATALOG } from '../../../../../../constants/voices/starter-voice-catalog'
import { getKokoroAdapter } from '../../../../../../libs/inference/adapters/kokoro'
import { useSpeechStore } from '../../../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../../../stores/providers'
import { getMossAdapterInstance } from '../../../../../../stores/providers/moss-audio-utils'
import { getPocketTtsAdapterInstance } from '../../../../../../stores/providers/pocket-audio-utils'
import { useSettingsUserProfile } from '../../../../../../stores/settings/user-profile'
import { KOKORO_MODELS } from '../../../../../../workers/kokoro/constants'
import { formatActorName } from '../../../../../markdown/actor-colors'
import { useOnboardingV3Draft } from '../stores/useOnboardingV3Draft'

const props = defineProps<{
  onNext: () => void
  onPrevious: () => void
}>()

const { t } = useI18n()

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
  if (id === 'chatterbox')
    return 'airi-audio-server'
  return id
}

// 1. Initial State from Draft
const starterChar = getStarterCharacter(draftStore.state.personaCardId)
const defaultInitialVoice = starterChar?.defaultVoiceId || 'airi_relu'

const selectedProvider = ref<string>(
  draftStore.state.ttsProvider
  || (draftStore.state.architecture === 'local' ? 'pocket' : 'pocket'),
)
const selectedModel = ref<string>(draftStore.state.ttsModel || 'english_2026-04')
const selectedVoice = ref<string>(draftStore.state.ttsVoiceId || defaultInitialVoice)
const speed = ref<number>(draftStore.state.ttsRate ?? 1.0)
const pitch = ref<number>(draftStore.state.ttsPitch ?? 1.0)

type EngineSegment = 'builtin' | 'server' | 'cloud'

function resolveInitialSegment(prov: string): EngineSegment {
  const norm = normalizeProviderId(prov)
  if (norm === 'airi-audio-server')
    return 'server'
  if (['kokoro-local', 'pocket-tts-local', 'moss-nano-local', 'pocket', 'kokoro', 'moss'].includes(norm))
    return 'builtin'
  return 'cloud'
}

const activeEngineSegment = ref<EngineSegment>(resolveInitialSegment(selectedProvider.value))

// API credentials
const showApiKey = ref(false)
const apiKeyInput = ref('')

// Hugging Face Token for gated models (Pocket-TTS voices)
const showHfTokenInput = ref(false)
const hfTokenInput = ref(typeof localStorage !== 'undefined' ? localStorage.getItem('settings/connection/hf-token') || '' : '')
const isHFTokenModalOpen = ref(false)

function saveHfToken() {
  if (typeof localStorage !== 'undefined') {
    const trimmed = hfTokenInput.value.trim()
    if (trimmed) {
      localStorage.setItem('settings/connection/hf-token', trimmed)
    }
    else {
      localStorage.removeItem('settings/connection/hf-token')
    }
  }
}

watch(hfTokenInput, (val) => {
  if (typeof localStorage !== 'undefined') {
    const trimmed = val.trim()
    if (trimmed) {
      localStorage.setItem('settings/connection/hf-token', trimmed)
    }
    else {
      localStorage.removeItem('settings/connection/hf-token')
    }
  }
})

const hfTokenStatus = computed(() => {
  const token = hfTokenInput.value.trim()
  if (!token) {
    return { state: 'empty', message: '', tip: '' }
  }
  if (token.startsWith('HF')) {
    return {
      state: 'error',
      message: 'S3 Key detected (starts with "HF")',
      tip: 'This looks like an S3 storage credential. Pocket-TTS requires a User Access Token starting with "hf_" from huggingface.co/settings/tokens.',
    }
  }
  if (!token.startsWith('hf_')) {
    return {
      state: 'warning',
      message: 'Token should start with "hf_"',
      tip: 'Hugging Face User Access Tokens normally start with "hf_". Make sure you copied an access token, not a bucket key.',
    }
  }
  if (token.length < 15) {
    return {
      state: 'warning',
      message: 'Token is unusually short',
      tip: 'Please check that the full token was pasted.',
    }
  }
  return {
    state: 'valid',
    message: 'Valid token format',
    tip: 'Ensure you clicked "Agree and access repository" on kyutai/pocket-tts.',
  }
})

function selectStarterVoice(voiceId = 'airi_relu') {
  selectedVoice.value = voiceId
  isHFTokenModalOpen.value = false
  const match = STARTER_VOICE_CATALOG.find(v => v.id === voiceId)
  toast.success(`Switched to "${match?.name || voiceId}". Offline starter voices do not need an HF token!`)
}

function openHFTokenPage() {
  window.open('https://huggingface.co/settings/tokens', '_blank')
}

function openHFGatePage() {
  window.open('https://huggingface.co/kyutai/pocket-tts', '_blank')
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

const audioServerPromptTranscript = ref('')
const showTranscriptDisclosure = ref(false)
const showServerSetup = ref(false)
const copiedStep = ref<number | null>(null)

function copyCommand(cmd: string, stepIndex: number) {
  if (typeof navigator !== 'undefined') {
    void navigator.clipboard.writeText(cmd)
    copiedStep.value = stepIndex
    setTimeout(() => {
      if (copiedStep.value === stepIndex)
        copiedStep.value = null
    }, 2000)
  }
}

function isLocalServerAddress(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)
  }
  catch {
    return url.includes('localhost') || url.includes('127.0.0.1')
  }
}

function normalizeServerUrl(url: string): string {
  let trimmed = url.trim()
  if (!trimmed)
    return 'http://127.0.0.1:8095/v1/'
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `http://${trimmed}`
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

const serverAddress = ref<string>(
  (providersStore.providers['airi-audio-server']?.baseUrl as string) || 'http://127.0.0.1:8095/v1/',
)

function persistServerAddress(url: string) {
  const norm = normalizeServerUrl(url)
  if (!providersStore.providers['airi-audio-server']) {
    providersStore.providers['airi-audio-server'] = {}
  }
  providersStore.providers['airi-audio-server'].baseUrl = norm
}

watch(serverAddress, (newVal) => {
  persistServerAddress(newVal)
})

const serverStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
const serverError = ref('')
const serverModels = ref<Array<{ id: string, label: string }>>([])
const serverVoices = ref<Array<{ id: string, label: string, type?: string }>>([])

const audioSpawner = useProcessSpawner({
  storageKeyPrefix: 'settings/providers/airi-audio-server',
  defaultSpawnCommand: (providersStore.providers['airi-audio-server']?.spawnCommand as string) || '',
  defaultStopCommand: (providersStore.providers['airi-audio-server']?.stopCommand as string) || '',
  defaultAutoSpawn: false,
  spawnSuccessDelayMs: 1500,
  stopSuccessDelayMs: 1000,
  onSpawnSuccess: () => connectAudioServer(false),
  onStopSuccess: () => {
    serverStatus.value = 'disconnected'
  },
})

async function connectAudioServer(isSilent = false) {
  serverStatus.value = 'connecting'
  serverError.value = ''

  const rawUrl = normalizeServerUrl(serverAddress.value)
  const rootUrl = rawUrl.replace(/\/v1\/?$/, '/')

  try {
    const config = providersStore.getProviderConfig('airi-audio-server')
    const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : ''
    const headers: Record<string, string> = apiKey ? { Authorization: `Bearer ${apiKey}` } : {}

    const [modelsRes, healthRes] = await Promise.all([
      fetch(`${rawUrl}models`, { headers }).catch(() => null),
      fetch(`${rootUrl}health`, { headers }).catch(() => null),
    ])

    if ((modelsRes && modelsRes.ok) || (healthRes && healthRes.ok)) {
      serverStatus.value = 'connected'
      selectedProvider.value = 'airi-audio-server'
      providersStore.markProviderAdded('airi-audio-server')

      // Query models
      if (modelsRes && modelsRes.ok) {
        const data = await modelsRes.json().catch(() => ({}))
        const list = Array.isArray(data?.data) ? data.data : []
        if (list.length > 0) {
          serverModels.value = list.map((m: any) => ({
            id: m.id,
            label: m.name || m.display_name || m.id,
          }))
        }
      }

      if (serverModels.value.length === 0) {
        serverModels.value = [
          { id: 'omnivoice-tts', label: 'OmniVoice Q8_0 (Recommended)' },
          { id: 'higgs-audio-tts', label: 'Higgs Audio v3 TTS Q8_0' },
          { id: 'fish-audio-tts', label: 'Fish Audio S2 Pro Q8_0' },
          { id: 'chatterbox-tts', label: 'Chatterbox TTS Q8_0' },
          { id: 'moss-tts', label: 'MOSS TTS Local v1.5 Q8_0' },
        ]
      }

      if (!serverModels.value.some(m => m.id === selectedModel.value)) {
        selectedModel.value = serverModels.value[0].id
      }

      // Query voices
      const voicesRes = await fetch(`${rawUrl}voices`, { headers }).catch(() => null)
      if (voicesRes && voicesRes.ok) {
        const data = await voicesRes.json().catch(() => ({}))
        const list = Array.isArray(data?.voices) ? data.voices : []
        if (list.length > 0) {
          serverVoices.value = list.map((v: any) => ({
            id: v.voice_id || v.id || v.name,
            label: v.name || v.voice_id || v.id,
            type: v.type,
          }))
        }
      }

      if (serverVoices.value.length === 0) {
        serverVoices.value = [
          { id: 'omnivoice-default', label: 'OmniVoice Default (Female Warm)' },
          { id: 'female-calm', label: 'Female Calm' },
          { id: 'male-deep', label: 'Male Deep' },
          { id: 'anime-girl', label: 'Anime Girl (Energetic)' },
          { id: 'chatterbox-default', label: 'Chatterbox Default' },
        ]
      }

      if (!serverVoices.value.some(v => v.id === selectedVoice.value)) {
        selectedVoice.value = serverVoices.value[0].id
      }
      if (!serverVoices.value.some(v => v.id === selectedUserVoice.value)) {
        selectedUserVoice.value = serverVoices.value[1]?.id || serverVoices.value[0].id
      }

      void speechStore.loadVoicesForProvider('airi-audio-server')

      if (!isSilent) {
        toast.success('Connected to AIRI Audio Server!')
      }
    }
    else {
      serverStatus.value = 'error'
      serverError.value = 'Server did not respond on configured port. Is airi-audio-server running?'
      if (!isSilent) {
        toast.error(serverError.value)
      }
    }
  }
  catch (err: any) {
    serverStatus.value = 'error'
    serverError.value = err?.message || 'Failed to connect to audio server.'
    if (!isSilent) {
      toast.error(serverError.value)
    }
  }
}

async function refreshServerVoices() {
  if (serverStatus.value !== 'connected') {
    await connectAudioServer(false)
    return
  }
  await connectAudioServer(false)
  toast.success('Voice catalog updated from server')
}

async function processAudioClone(file: File) {
  const normId = normalizeProviderId(selectedProvider.value)
  try {
    toast.info(`Cloning vocal timbre from "${file.name}"...`)
    const cloned = await cloneVoiceFromFile(file, {
      referenceText: audioServerPromptTranscript.value.trim() || undefined,
    })
    audioServerPromptTranscript.value = ''
    // Refresh voices catalog
    await speechStore.loadVoicesForProvider(normId)
    if (normId === 'airi-audio-server') {
      await connectAudioServer(true)
    }
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
  if (!currentVoiceId)
    return false
  if (currentVoiceId.startsWith('voice-profile-') || currentVoiceId.startsWith('pocket_clone_') || currentVoiceId.startsWith('moss_clone_'))
    return true
  const v = providerVoices.value.find((item: any) => item.id === currentVoiceId)
  return (v as any)?.type === 'cloned' || (v as any)?.description?.includes('Cloned')
})

async function handleDeleteCurrentClonedVoice() {
  const currentVoiceId = activeVoiceTab.value === 'user' ? selectedUserVoice.value : selectedVoice.value
  if (!isSelectedVoiceCloned.value)
    return

  const normId = normalizeProviderId(selectedProvider.value)
  try {
    await removeClonedVoice(currentVoiceId)
    await speechStore.loadVoicesForProvider(normId)
    if (activeVoiceTab.value === 'user') {
      if (selectedUserVoice.value === currentVoiceId) {
        selectedUserVoice.value = availableVoices.value[0]?.id || ''
      }
    }
    else {
      if (selectedVoice.value === currentVoiceId) {
        selectedVoice.value = availableVoices.value[0]?.id || ''
      }
    }
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
    desc: 'Local speech with support for voice samples.',
    badges: ['🇺🇸 EN', '🇫🇷 FR', '🇪🇸 ES', '🇩🇪 DE', '🇮🇹 IT', '🇯🇵 JP (★ Sakura)'],
  },
  {
    id: 'kokoro',
    normId: 'kokoro-local',
    name: 'Kokoro Local TTS',
    icon: 'i-solar:heart-bold-duotone',
    accent: 'text-pink-500 dark:text-pink-400',
    tag: 'NEURAL AUDIO',
    desc: 'Expressive English voices.',
    badges: ['🇺🇸 EN (US)', '🇬🇧 EN (UK)'],
  },
  {
    id: 'moss',
    normId: 'moss-nano-local',
    name: 'Moss-Nano Local',
    icon: 'i-solar:bolt-bold-duotone',
    accent: 'text-amber-500 dark:text-amber-400',
    tag: 'ULTRA-FAST',
    desc: 'A lightweight local speech engine.',
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
  'airi-audio-server',
  'chatterbox',
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

const selectedProviderName = computed(() => {
  const norm = normalizeProviderId(selectedProvider.value)
  if (norm === 'airi-audio-server') {
    return 'AIRI Audio Server'
  }
  if (isLocalProvider.value) {
    const local = localEngines.find(e => e.id === selectedProvider.value || e.normId === selectedProvider.value)
    return local?.name || 'Local TTS'
  }
  return activeProviderDisplayName.value || 'Cloud TTS'
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
      ...STARTER_VOICE_CATALOG.map(v => ({ id: v.id, label: `★ ${v.name}` })),
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
      ...STARTER_VOICE_CATALOG.map(v => ({ id: v.id, label: `★ ${v.name}` })),
      { id: 'Trump', label: 'Trump (Preset)' },
      { id: 'LJS', label: 'LJ Speech (Female Preset)' },
    ]
  }
  if (normId === 'deepgram-tts') {
    return [
      { id: 'aura-2-luna-en', label: 'Luna (Female · Friendly & Natural)' },
      { id: 'aura-2-asteria-en', label: 'Asteria (Female · Confident & Clear)' },
      { id: 'aura-2-aurora-en', label: 'Aurora (Female · Cheerful & Expressive)' },
      { id: 'aura-2-cora-en', label: 'Cora (Female · Smooth & Melodic)' },
      { id: 'aura-2-orion-en', label: 'Orion (Male · Approachable & Calm)' },
      { id: 'aura-2-zeus-en', label: 'Zeus (Male · Deep & Trustworthy)' },
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
    const companionVoice = getStarterCharacter(draftStore.state.personaCardId)?.defaultVoiceId
    const norm = normalizeProviderId(selectedProvider.value)
    const isLocalZeroShot = ['pocket-tts-local', 'moss-nano-local'].includes(norm)

    if (isLocalZeroShot && companionVoice && voices.some(v => v.id === companionVoice) && (!selectedVoice.value || selectedVoice.value === 'anna' || !voices.some(v => v.id === selectedVoice.value))) {
      selectedVoice.value = companionVoice
    }
    else if (!selectedVoice.value || !voices.some(v => v.id === selectedVoice.value)) {
      selectedVoice.value = voices[0].id
    }

    if (!selectedUserVoice.value || !voices.some(v => v.id === selectedUserVoice.value)) {
      const alt = voices.find(v => v.id !== selectedVoice.value) || voices[0]
      selectedUserVoice.value = alt.id
    }
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
  const userName = draftStore.state.userName || userProfileStore.name || 'Richy'

  if (draftStore.state.importedCardDraft) {
    const rawData = draftStore.state.importedCardDraft as any
    const data = rawData.data || rawData
    const greeting = data.first_mes || data.greetings?.[0] || ''
    const substituted = greeting.replace(USER_TOKEN_REGEX, userName)
    const actorId = parseActor(substituted)
    let actorName: string | undefined
    if (actorId) {
      const airiExt = data.extensions?.airi
      actorName = airiExt?.visual_assets?.[actorId]?.name || formatActorName(actorId)
    }
    return {
      name: data.nickname || data.name || 'Companion',
      actorName,
      greeting: stripPacingEnvelopes(stripMarkers(substituted)).trim(),
    }
  }

  if (STARTER_CHARACTERS[personaCardId]) {
    const p = getStarterCharacter(personaCardId)
    const substituted = (p.greetings[0] || '').replace(USER_TOKEN_REGEX, userName)
    return {
      name: p.name,
      actorName: undefined,
      greeting: stripPacingEnvelopes(stripMarkers(substituted)).trim(),
    }
  }

  const d = STARTER_CHARACTERS.default
  const substituted = (d.greetings[0] || '').replace(USER_TOKEN_REGEX, userName)
  return {
    name: d.name,
    actorName: undefined,
    greeting: stripPacingEnvelopes(stripMarkers(substituted)).trim(),
  }
})

const companionName = computed(() => resolvedPersona.value.name || 'Companion')
const userName = computed(() => draftStore.state.userName || userProfileStore.name || 'Richy')

const sampleGreeting = computed(() => {
  if (resolvedPersona.value.greeting)
    return resolvedPersona.value.greeting
  return `Hello ${userName.value}! I'm ${companionName.value}. Everything is ready — how do I sound?`
})

watch(sampleText, (val) => {
  if (val && (val.includes('<|') || val.includes('<think_aloud'))) {
    sampleText.value = stripPacingEnvelopes(stripMarkers(val)).trim()
  }
})

watch([sampleGreeting, companionName, userName], ([g, cName, uName]) => {
  if (!sampleText.value || sampleText.value === g || sampleText.value.includes('<|')) {
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
  if (!sampleText.value || sampleText.value.includes('<|')) {
    sampleText.value = sampleGreeting.value
  }
  if (selectedProvider.value === 'airi-audio-server' || activeEngineSegment.value === 'server') {
    void connectAudioServer(true)
  }
  else {
    void checkEngineReadiness()
    void speechStore.loadVoicesForProvider(normalizeProviderId(selectedProvider.value))
  }
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
    const rawTextToSpeak = target === 'user'
      ? (userSampleText.value || `Hello ${companionName.value}! I am ${userName.value}.`)
      : (sampleText.value || sampleGreeting.value)
    const textToSpeak = stripPacingEnvelopes(stripMarkers(rawTextToSpeak)).trim()
    const providerId = normalizeProviderId(selectedProvider.value)
    let voiceId = target === 'user'
      ? (selectedUserVoice.value || availableVoices.value[1]?.id || availableVoices.value[0]?.id || 'adam')
      : (selectedVoice.value || availableVoices.value[0]?.id || 'anna')
    let modelId = selectedModel.value || availableModels.value[0]?.id || 'english_2026-04'

    if (activeEngineSegment.value === 'server') {
      if (serverStatus.value !== 'connected') {
        toast.info('Connect to your audio server to load a model and voice.')
        isPlayingTarget.value = null
        return
      }
      voiceId = target === 'user'
        ? (selectedUserVoice.value || serverVoices.value[1]?.id || serverVoices.value[0]?.id || 'omnivoice-default')
        : (selectedVoice.value || serverVoices.value[0]?.id || 'omnivoice-default')
      modelId = selectedModel.value || serverModels.value[0]?.id || 'omnivoice-tts'
    }

    const providerInstance = await providersStore.getProviderInstance(providerId)
    if (!providerInstance) {
      toast.error(`Speech provider "${providerId}" is not configured.`)
      isPlayingTarget.value = null
      return
    }

    toast.info(`Synthesizing ${target === 'user' ? userName.value : companionName.value}'s voice...`)
    const targetSpeed = target === 'user' ? userSpeed.value : speed.value
    const targetPitch = target === 'user' ? userPitch.value : pitch.value
    const audioData = await speechStore.speech(
      providerInstance as any,
      modelId,
      textToSpeak,
      voiceId,
      {
        speed: targetSpeed,
        pitch: targetPitch,
      },
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
  draftStore.setSpeech({
    provider: normalizeProviderId(selectedProvider.value),
    model: selectedModel.value,
    voiceId: selectedVoice.value,
    pitch: pitch.value,
    rate: speed.value,
  })
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
  <div :class="['w-full h-full flex flex-col justify-between select-none animate-fadeIn']">
    <!-- Hidden File Input for Audio Voice Cloning -->
    <input
      ref="audioFileInputRef"
      type="file"
      accept="audio/*"
      class="hidden"
      @change="handleAudioFileSelect"
    >

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
            {{ t('onboarding.steps.speech.title') }}
          </h1>
        </div>

        <AssistantBubble
          message="Let’s find a voice that feels right. Choose an engine, adjust the voice, and listen to a sample."
          step-key="speech"
          sticker-id="airi-agree"
          tone="primary"
        />
      </div>

      <!-- Two-panel workspace -->
      <div :class="['w-full max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)] gap-5 lg:gap-6 items-stretch']">
        <!-- Left panel: speech engine -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="100"
          :class="[
            'rounded-[20px] border p-4 sm:p-5 min-w-0 min-h-0 flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <div :class="['flex items-start gap-2.5']">
            <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
              <div :class="['i-solar:settings-bold-duotone h-4 w-4']" />
            </div>
            <div :class="['min-w-0']">
              <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                Speech engine
              </h2>
              <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5']">
                Choose how speech runs for your companion.
              </p>
            </div>
          </div>

          <!-- Engine route segments: Built-in · AIRI server · Cloud -->
          <div :class="['flex items-center gap-1 rounded-xl bg-neutral-200/50 p-1 dark:bg-neutral-800/50']">
            <button
              type="button"
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs transition-all cursor-pointer min-h-[44px]',
                activeEngineSegment === 'builtin'
                  ? 'border border-primary-500/80 bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30 font-bold shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent font-medium',
              ]"
              @click="activeEngineSegment = 'builtin'"
            >
              <div :class="['i-solar:monitor-outline h-4 w-4']" />
              <span>Built-in</span>
            </button>
            <button
              type="button"
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs transition-all cursor-pointer min-h-[44px]',
                activeEngineSegment === 'server'
                  ? 'border border-primary-500/80 bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30 font-bold shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent font-medium',
              ]"
              @click="activeEngineSegment = 'server'"
            >
              <div :class="['i-solar:server-square-bold-duotone h-4 w-4']" />
              <span>AIRI server</span>
            </button>
            <button
              type="button"
              :class="[
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs transition-all cursor-pointer min-h-[44px]',
                activeEngineSegment === 'cloud'
                  ? 'border border-primary-500/80 bg-primary-500/10 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30 font-bold shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent font-medium',
              ]"
              @click="activeEngineSegment = 'cloud'"
            >
              <div :class="['i-solar:cloud-outline h-4 w-4']" />
              <span>Cloud</span>
            </button>
          </div>

          <!-- Built-in engine cards -->
          <div v-if="activeEngineSegment === 'builtin'" :class="['flex flex-col gap-2.5']">
            <div
              v-for="engine in localEngines"
              :key="engine.id"
              :class="[
                'relative p-3 rounded-2xl border transition-all cursor-pointer flex items-center gap-3 text-left min-h-[96px]',
                selectedProvider === engine.id || selectedProvider === engine.normId
                  ? 'border-primary-500/80 bg-primary-500/5 dark:bg-primary-500/10 ring-1 ring-primary-500/40'
                  : 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-300 dark:hover:border-white/20',
              ]"
              @click="selectedProvider = engine.id"
            >
              <div :class="['w-10 h-10 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-white/10 flex items-center justify-center text-lg shadow-sm flex-shrink-0', engine.accent]">
                <div :class="[engine.icon, 'w-5 h-5']" />
              </div>

              <div :class="['min-w-0 flex-1']">
                <div :class="['flex items-center gap-2']">
                  <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white truncate']">
                    {{ engine.name }}
                  </h3>
                </div>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate']">
                  {{ engine.desc }}
                </p>
                <div :class="['mt-1.5 flex flex-wrap items-center gap-1']">
                  <span
                    v-for="badge in engine.badges"
                    :key="badge"
                    :class="['text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 font-mono']"
                  >
                    {{ badge }}
                  </span>
                </div>
              </div>

              <div
                :class="[
                  'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
                  selectedProvider === engine.id || selectedProvider === engine.normId
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-neutral-300 dark:border-neutral-600',
                ]"
              >
                <div
                  v-if="selectedProvider === engine.id || selectedProvider === engine.normId"
                  :class="['w-2 h-2 rounded-full bg-white']"
                />
              </div>
            </div>

            <!-- Built-in Model Selection & Weights Activation Bar -->
            <div v-if="isLocalProvider" :class="['flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] mt-1']">
              <div :class="['flex flex-col sm:flex-row sm:items-center justify-between gap-2']">
                <div>
                  <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                    Model
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
              <div :class="['flex flex-col gap-2.5 pt-2 border-t border-neutral-200/60 dark:border-white/5']">
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

                  <div v-if="showHfTokenInput" :class="['flex flex-col gap-2 pt-1']">
                    <div :class="['flex flex-wrap items-center gap-2']">
                      <input
                        v-model="hfTokenInput"
                        type="password"
                        placeholder="hf_..."
                        :class="[
                          'flex-1 min-w-[200px] px-3 py-1.5 rounded-xl text-xs font-mono bg-white dark:bg-neutral-900 border outline-none transition',
                          hfTokenStatus.state === 'error' ? 'border-red-400 dark:border-red-500/60 focus:border-red-500' : 'border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white focus:border-primary-500',
                        ]"
                        @input="saveHfToken"
                      >
                      <a
                        href="https://huggingface.co/kyutai/pocket-tts"
                        target="_blank"
                        rel="noopener noreferrer"
                        :class="['flex items-center gap-1 px-2.5 py-1 text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer']"
                      >
                        <span>Accept Gate</span>
                        <div :class="['i-solar:square-top-down-bold w-3.5 h-3.5']" />
                      </a>
                      <a
                        href="https://huggingface.co/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        :class="['flex items-center gap-1 px-2.5 py-1 text-xs text-primary-500 font-semibold hover:underline cursor-pointer']"
                      >
                        <span>Get Token</span>
                        <div :class="['i-solar:square-top-down-bold w-3.5 h-3.5']" />
                      </a>
                    </div>

                    <div v-if="hfTokenStatus.message || hfTokenStatus.tip" :class="['text-[11px] leading-tight flex items-start gap-1', hfTokenStatus.state === 'error' ? 'text-red-500' : hfTokenStatus.state === 'warning' ? 'text-amber-500' : 'text-emerald-500']">
                      <div :class="[hfTokenStatus.state === 'error' ? 'i-solar:danger-triangle-bold' : hfTokenStatus.state === 'warning' ? 'i-solar:info-circle-bold' : 'i-solar:check-circle-bold', 'w-3.5 h-3.5 flex-shrink-0 mt-0.2']" />
                      <span>{{ hfTokenStatus.tip || hfTokenStatus.message }}</span>
                    </div>

                    <div :class="['text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 pt-0.5']">
                      <div :class="['i-solar:shield-check-bold-duotone w-3.5 h-3.5 text-emerald-500 flex-shrink-0']" />
                      <span>Tip: All <strong>★ Starter Voices</strong> (such as ★ Sakura and ★ ReLU) run 100% offline without needing any HF token.</span>
                    </div>
                  </div>
                </div>

                <!-- Activation / Readiness Trigger Row -->
                <div :class="['flex flex-wrap items-center justify-between gap-3 pt-1']">
                  <div :class="['flex items-center gap-2']">
                    <button
                      v-if="!isEngineReady && !isDownloading"
                      type="button"
                      :class="['flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-4 py-2 shadow-sm shadow-primary-600/30 transition-all cursor-pointer']"
                      @click="activateAndDownloadEngine"
                    >
                      <div :class="['i-solar:download-square-bold-duotone w-4 h-4']" />
                      <span>Activate & download</span>
                    </button>

                    <button
                      v-else-if="isDownloading"
                      type="button"
                      disabled
                      :class="['flex cursor-wait items-center gap-2 rounded-xl bg-primary-500/80 text-white text-xs font-semibold px-4 py-2']"
                    >
                      <div :class="['i-solar:restart-square-bold w-4 h-4 animate-spin']" />
                      <span>Downloading Weights ({{ downloadProgress }}%)...</span>
                    </button>

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
          </div>

          <!-- AIRI Audio Server Segment -->
          <div v-else-if="activeEngineSegment === 'server'" :class="['flex flex-col gap-4']">
            <!-- Header Block -->
            <div :class="['flex items-start gap-3']">
              <div :class="['w-9 h-9 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
                <div :class="['i-solar:server-square-bold-duotone w-5 h-5']" />
              </div>
              <div :class="['min-w-0 flex-1']">
                <h3 :class="['text-sm font-bold text-neutral-900 dark:text-white leading-tight']">
                  AIRI Audio Server
                </h3>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug']">
                  Run speech through a separate server on this computer or another machine.
                </p>
              </div>
            </div>

            <!-- Server Address -->
            <div :class="['flex flex-col gap-1.5']">
              <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                Server address
              </label>
              <input
                v-model="serverAddress"
                type="text"
                placeholder="http://127.0.0.1:8095/v1/"
                :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 font-mono shadow-sm']"
              >
            </div>

            <!-- Status Indicator and Connect Action -->
            <div :class="['flex items-center justify-between gap-3']">
              <div :class="['flex items-center gap-2 min-w-0']">
                <span
                  :class="[
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    serverStatus === 'connected'
                      ? 'bg-emerald-500 animate-pulse'
                      : serverStatus === 'connecting'
                        ? 'bg-primary-500 animate-pulse'
                        : serverStatus === 'error'
                          ? 'bg-amber-500'
                          : 'bg-neutral-400 dark:bg-neutral-600',
                  ]"
                />
                <span
                  :class="[
                    'text-xs font-medium truncate',
                    serverStatus === 'connected'
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : serverStatus === 'connecting'
                        ? 'text-primary-500'
                        : serverStatus === 'error'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-neutral-500 dark:text-neutral-400',
                  ]"
                >
                  {{
                    serverStatus === 'connected'
                      ? 'Connected'
                      : serverStatus === 'connecting'
                        ? 'Connecting...'
                        : serverStatus === 'error'
                          ? (serverError || 'Connection failed')
                          : 'Not connected'
                  }}
                </span>
              </div>

              <button
                type="button"
                :disabled="serverStatus === 'connecting'"
                :class="[
                  'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm',
                  serverStatus === 'connecting'
                    ? 'bg-primary-500/70 text-white cursor-wait'
                    : 'bg-primary-500 hover:bg-primary-600 text-white shadow-primary-500/20 active:scale-95',
                ]"
                @click="connectAudioServer(false)"
              >
                <div :class="[serverStatus === 'connecting' ? 'i-solar:restart-bold animate-spin' : 'i-solar:link-bold', 'w-3.5 h-3.5']" />
                <span>{{ serverStatus === 'connecting' ? 'Connecting...' : 'Connect' }}</span>
              </button>
            </div>

            <!-- Speech Model Dropdown -->
            <div :class="['flex flex-col gap-1.5']">
              <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                Speech model
              </label>
              <div :class="['relative']">
                <select
                  v-if="serverStatus === 'connected'"
                  v-model="selectedModel"
                  :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-sm appearance-none pr-8']"
                >
                  <option
                    v-for="m in serverModels"
                    :key="m.id"
                    :value="m.id"
                  >
                    {{ m.label }}
                  </option>
                </select>
                <select
                  v-else
                  disabled
                  :class="['w-full px-3 py-2 rounded-xl text-xs bg-neutral-100/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-white/5 text-neutral-400 dark:text-neutral-500 cursor-not-allowed appearance-none pr-8']"
                >
                  <option selected>
                    Connect to load models
                  </option>
                </select>
                <div :class="['pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 i-solar:alt-arrow-down-line-duotone w-4 h-4 text-neutral-400']" />
              </div>
              <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
                Models are discovered from your server.
              </p>
            </div>

            <!-- Server Setup Disclosure -->
            <div :class="['rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] overflow-hidden transition-all']">
              <button
                type="button"
                :class="[
                  'w-full p-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer',
                  'hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]',
                ]"
                @click="showServerSetup = !showServerSetup"
              >
                <div :class="['flex items-center gap-3 min-w-0 flex-1']">
                  <div :class="['w-8 h-8 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center flex-shrink-0']">
                    <div :class="['i-solar:settings-minimalistic-bold-duotone w-4 h-4']" />
                  </div>
                  <div :class="['min-w-0 flex flex-col']">
                    <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                      Server setup
                    </span>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5']">
                      Startup options and installation guidance
                    </p>
                  </div>
                </div>
                <div :class="[showServerSetup ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone', 'w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform']" />
              </button>

              <div v-if="showServerSetup" :class="['p-4 pt-1 flex flex-col gap-4 border-t border-neutral-200/40 dark:border-white/5']">
                <!-- Auto-start with AIRI toggle (Electron + Local server address only) -->
                <div
                  v-if="audioSpawner.isElectron.value && isLocalServerAddress(serverAddress)"
                  :class="['flex items-center justify-between gap-3 p-3 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-neutral-900/40']"
                >
                  <div :class="['min-w-0 flex flex-col']">
                    <span :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                      Start automatically with AIRI
                    </span>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-tight']">
                      Launch audio server sidecar when the desktop app opens.
                    </p>
                  </div>
                  <label :class="['relative inline-flex items-center cursor-pointer flex-shrink-0']">
                    <input
                      v-model="audioSpawner.autoSpawnOnLaunch.value"
                      type="checkbox"
                      :class="['sr-only peer']"
                    >
                    <div
                      :class="[
                        'w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700',
                        'peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\']',
                        'after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full',
                        'after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600',
                      ]"
                    />
                  </label>
                </div>

                <!-- Quick Setup Guide -->
                <div :class="['flex flex-col gap-2.5']">
                  <div :class="['flex items-center justify-between']">
                    <span :class="['text-[11px] font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                      Quick Setup (Local Machine)
                    </span>
                    <a
                      href="https://github.com/dasilva333/airi-audio-server"
                      target="_blank"
                      rel="noopener noreferrer"
                      :class="['text-[11px] text-primary-500 hover:underline flex items-center gap-1 font-semibold']"
                    >
                      <span :class="['i-simple-icons:github text-xs']" />
                      <span>GitHub</span>
                      <span :class="['i-solar:arrow-right-up-linear text-[10px]']" />
                    </a>
                  </div>

                  <div :class="['grid grid-cols-1 gap-2 text-xs']">
                    <!-- Step 1 -->
                    <div :class="['flex items-center justify-between p-2.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-neutral-900/40']">
                      <div :class="['min-w-0 flex-1 pr-2']">
                        <span :class="['text-[10px] font-bold text-primary-600 dark:text-primary-400 block']">1. Clone repository</span>
                        <code :class="['text-[10px] text-neutral-700 dark:text-neutral-300 font-mono block truncate mt-0.5']">git clone https://github.com/dasilva333/airi-audio-server.git</code>
                      </div>
                      <button
                        type="button"
                        :class="['text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex-shrink-0']"
                        @click="copyCommand('git clone https://github.com/dasilva333/airi-audio-server.git', 1)"
                      >
                        {{ copiedStep === 1 ? 'Copied!' : 'Copy' }}
                      </button>
                    </div>

                    <!-- Step 2 -->
                    <div :class="['flex items-center justify-between p-2.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-neutral-900/40']">
                      <div :class="['min-w-0 flex-1 pr-2']">
                        <span :class="['text-[10px] font-bold text-primary-600 dark:text-primary-400 block']">2. Install dependencies</span>
                        <code :class="['text-[10px] text-neutral-700 dark:text-neutral-300 font-mono block truncate mt-0.5']">npm install</code>
                      </div>
                      <button
                        type="button"
                        :class="['text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex-shrink-0']"
                        @click="copyCommand('npm install', 2)"
                      >
                        {{ copiedStep === 2 ? 'Copied!' : 'Copy' }}
                      </button>
                    </div>

                    <!-- Step 3 -->
                    <div :class="['flex items-center justify-between p-2.5 rounded-xl border border-neutral-200/60 dark:border-white/5 bg-white/60 dark:bg-neutral-900/40']">
                      <div :class="['min-w-0 flex-1 pr-2']">
                        <span :class="['text-[10px] font-bold text-primary-600 dark:text-primary-400 block']">3. Run server (Port 8095)</span>
                        <code :class="['text-[10px] text-neutral-700 dark:text-neutral-300 font-mono block truncate mt-0.5']">npm start</code>
                      </div>
                      <button
                        type="button"
                        :class="['text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer flex-shrink-0']"
                        @click="copyCommand('npm start', 3)"
                      >
                        {{ copiedStep === 3 ? 'Copied!' : 'Copy' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Callout Card: Runs separately from AIRI -->
            <div :class="['rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-500/10 p-3.5 flex items-start gap-3']">
              <div :class="['w-8 h-8 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center flex-shrink-0']">
                <div :class="['i-solar:link-bold w-4 h-4']" />
              </div>
              <div :class="['min-w-0 flex-1']">
                <h4 :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                  Runs separately from AIRI
                </h4>
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed']">
                  The server runs the speech model. AIRI connects to it to discover voices and play speech.
                </p>
              </div>
            </div>
          </div>

          <!-- Cloud Providers Grid -->
          <div v-else-if="activeEngineSegment === 'cloud'" :class="['flex flex-col gap-4']">
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

            <!-- Cloud Model Architecture -->
            <div :class="['flex flex-col gap-3 p-4 rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]']">
              <div :class="['flex flex-col sm:flex-row sm:items-center justify-between gap-2']">
                <div>
                  <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                    Model
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
            </div>
          </div>
        </div>

        <!-- Right panel: voice & preview -->
        <div
          v-motion
          :initial="{ opacity: 0, y: 8 }"
          :enter="{ opacity: 1, y: 0 }"
          :duration="350"
          :delay="150"
          :class="[
            'rounded-[20px] border p-4 sm:p-5 min-w-0 min-h-0 flex flex-col gap-4',
            'border-neutral-200/80 bg-white/70 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/60 backdrop-blur-md',
          ]"
        >
          <!-- Panel Header: Title + Voice profile tabs -->
          <div :class="['flex flex-col sm:flex-row sm:items-center justify-between gap-3']">
            <div :class="['flex items-start gap-2.5 min-w-0']">
              <div :class="['h-8 w-8 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center flex-shrink-0']">
                <div :class="['i-solar:soundwave-bold-duotone h-4 w-4']" />
              </div>
              <div :class="['min-w-0']">
                <h2 :class="['text-base font-bold text-neutral-900 dark:text-white leading-tight']">
                  Voice & preview
                </h2>
                <p :class="['text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate']">
                  Choose a voice, then listen to a sample.
                </p>
              </div>
            </div>

            <!-- Voice profile tabs in header -->
            <div :class="['flex items-center gap-1 rounded-xl bg-neutral-200/50 p-1 dark:bg-neutral-800/50 flex-shrink-0']">
              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer',
                  activeVoiceTab === 'companion'
                    ? 'border border-primary-500/80 bg-primary-500/15 text-primary-600 dark:text-primary-400 ring-1 ring-primary-500/30 font-bold shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent font-medium',
                ]"
                @click="activeVoiceTab = 'companion'"
              >
                <div :class="['i-solar:heart-bold w-3.5 h-3.5 text-primary-500']" />
                <span>Companion voice</span>
              </button>

              <button
                type="button"
                :class="[
                  'flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs transition-all cursor-pointer',
                  activeVoiceTab === 'user'
                    ? 'border border-purple-500/80 bg-purple-500/15 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/30 font-bold shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 border border-transparent font-medium',
                ]"
                @click="activeVoiceTab = 'user'"
              >
                <div :class="['i-solar:user-speak-bold-duotone w-3.5 h-3.5 text-purple-500']" />
                <span>Your voice profile</span>
              </button>
            </div>
          </div>

          <!-- AIRI SERVER VOICE & PREVIEW WORKSPACE -->
          <div
            v-if="activeEngineSegment === 'server'"
            :class="['flex flex-col gap-4 animate-fadeIn']"
          >
            <!-- Voice Selector row -->
            <div :class="['flex flex-col gap-1.5']">
              <label :class="['text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wide']">
                Voice
              </label>
              <div :class="['flex items-center gap-2']">
                <div :class="['relative flex-1 min-w-0']">
                  <select
                    v-if="serverStatus === 'connected' && activeVoiceTab === 'companion'"
                    v-model="selectedVoice"
                    :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-sm appearance-none pr-8']"
                  >
                    <option
                      v-for="voice in serverVoices"
                      :key="voice.id"
                      :value="voice.id"
                    >
                      {{ voice.label }}
                    </option>
                  </select>
                  <select
                    v-else-if="serverStatus === 'connected' && activeVoiceTab === 'user'"
                    v-model="selectedUserVoice"
                    :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 cursor-pointer shadow-sm appearance-none pr-8']"
                  >
                    <option
                      v-for="voice in serverVoices"
                      :key="voice.id"
                      :value="voice.id"
                    >
                      {{ voice.label }}
                    </option>
                  </select>
                  <select
                    v-else
                    disabled
                    :class="['w-full px-3 py-2 rounded-xl text-xs bg-neutral-100/60 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-white/5 text-neutral-400 dark:text-neutral-500 cursor-not-allowed appearance-none pr-8']"
                  >
                    <option selected>
                      Connect to load voices
                    </option>
                  </select>
                  <div :class="['pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 i-solar:alt-arrow-down-line-duotone w-4 h-4 text-neutral-400']" />
                </div>

                <button
                  type="button"
                  :class="[
                    'h-9 px-3.5 rounded-xl border border-neutral-200/80 dark:border-white/10 bg-white dark:bg-neutral-900 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm flex-shrink-0',
                  ]"
                  title="Load voice catalog from server"
                  @click="refreshServerVoices"
                >
                  <div :class="['i-solar:restart-bold-duotone w-3.5 h-3.5 text-primary-500']" />
                  <span>Load voices</span>
                </button>
              </div>
            </div>

            <!-- Box 1: Use a voice sample -->
            <div
              :class="[
                'flex items-center justify-between gap-3 p-3 rounded-2xl border transition-all',
                serverStatus === 'connected'
                  ? 'border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02]'
                  : 'border-neutral-200/40 dark:border-white/5 bg-neutral-50/30 dark:bg-white/[0.01] opacity-75',
              ]"
            >
              <div :class="['min-w-0 flex flex-1 items-center gap-2.5']">
                <div :class="['w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center flex-shrink-0']">
                  <div v-if="isCloning" :class="['i-solar:restart-circle-bold w-4 h-4 animate-spin text-primary-500']" />
                  <div v-else :class="['i-solar:upload-track-2-bold-duotone w-4 h-4']" />
                </div>
                <div :class="['min-w-0 flex flex-col']">
                  <span :class="['text-xs font-bold text-neutral-900 dark:text-white']">
                    Use a voice sample
                  </span>
                  <p :class="['truncate text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5']">
                    {{ serverStatus === 'connected' ? 'Upload 5–10 seconds of audio · WAV or MP3' : 'Voice upload is available after connecting.' }}
                  </p>
                </div>
              </div>

              <div :class="['flex flex-shrink-0 items-center gap-2']">
                <button
                  v-if="isSelectedVoiceCloned && serverStatus === 'connected'"
                  type="button"
                  :class="['p-1.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-semibold cursor-pointer transition-colors']"
                  title="Delete currently selected custom voice clone"
                  @click="handleDeleteCurrentClonedVoice"
                >
                  <div :class="['i-solar:trash-bin-trash-bold h-3.5 w-3.5']" />
                </button>

                <button
                  type="button"
                  :disabled="serverStatus !== 'connected' || isCloning"
                  :class="[
                    'px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm',
                    serverStatus === 'connected' && !isCloning
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 cursor-pointer border border-white/10'
                      : 'bg-neutral-200/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-transparent',
                  ]"
                  @click="triggerAudioFileInput"
                >
                  <div :class="[isCloning ? 'i-solar:restart-circle-bold animate-spin' : 'i-solar:cloud-upload-bold', 'w-3.5 h-3.5']" />
                  <span>{{ isCloning ? 'Cloning...' : 'Upload audio' }}</span>
                </button>
              </div>
            </div>

            <!-- Box 2: Words spoken in the sample (Disclosure) -->
            <div :class="['rounded-2xl border border-neutral-200/60 dark:border-white/5 bg-neutral-50/50 dark:bg-white/[0.02] overflow-hidden transition-all']">
              <button
                type="button"
                :class="[
                  'w-full p-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer',
                  'hover:bg-neutral-100/60 dark:hover:bg-white/[0.04]',
                ]"
                @click="showTranscriptDisclosure = !showTranscriptDisclosure"
              >
                <div :class="['flex items-center gap-2.5 min-w-0 flex-1']">
                  <div :class="['w-8 h-8 rounded-xl bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center flex-shrink-0']">
                    <div :class="['i-solar:document-text-bold-duotone w-4 h-4']" />
                  </div>
                  <div :class="['min-w-0 flex flex-col']">
                    <span :class="['text-xs font-bold text-neutral-900 dark:text-white truncate']">
                      Words spoken in the sample
                    </span>
                    <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5']">
                      Review or enter the reference transcript after upload.
                    </p>
                  </div>
                </div>
                <div :class="[showTranscriptDisclosure ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone', 'w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform']" />
              </button>

              <div v-if="showTranscriptDisclosure" :class="['p-3 pt-1 flex flex-col gap-1.5 border-t border-neutral-200/40 dark:border-white/5']">
                <textarea
                  v-model="audioServerPromptTranscript"
                  rows="2"
                  placeholder="Type exact words spoken in the audio sample..."
                  :class="['w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 resize-none shadow-sm']"
                />
                <p :class="['text-[11px] text-neutral-500 dark:text-neutral-400']">
                  Check that this matches the recording.
                </p>
              </div>
            </div>

            <!-- Acoustic Sliders (Speaking Speed & Pitch) -->
            <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1']">
              <div :class="['flex flex-col gap-1.5']">
                <div :class="['flex items-center justify-between text-xs font-semibold']">
                  <span :class="['text-neutral-600 dark:text-neutral-400']">Speaking speed</span>
                  <span :class="['text-primary-500 font-mono']">
                    {{ (activeVoiceTab === 'user' ? userSpeed : speed).toFixed(2) }}x
                  </span>
                </div>
                <input
                  v-if="activeVoiceTab === 'user'"
                  v-model.number="userSpeed"
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
                >
                <input
                  v-else
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
                  <span :class="['text-neutral-600 dark:text-neutral-400']">Pitch</span>
                  <span :class="['text-primary-500 font-mono']">
                    {{ (activeVoiceTab === 'user' ? userPitch : pitch).toFixed(2) }}x
                  </span>
                </div>
                <input
                  v-if="activeVoiceTab === 'user'"
                  v-model.number="userPitch"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
                >
                <input
                  v-else
                  v-model.number="pitch"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  :class="['w-full accent-primary-500 cursor-pointer h-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800']"
                >
              </div>
            </div>

            <!-- Hear this voice -->
            <div :class="['flex flex-col gap-2 pt-1']">
              <span :class="['text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wide']">
                Hear this voice
              </span>
              <div :class="['flex items-center justify-between gap-2']">
                <span :class="['text-xs font-medium text-neutral-500 dark:text-neutral-400']">
                  Sample text
                </span>
                <button
                  type="button"
                  :class="['text-[11px] text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors cursor-pointer']"
                  @click="activeVoiceTab === 'user' ? resetUserSampleText() : resetSampleText()"
                >
                  Reset text
                </button>
              </div>

              <textarea
                v-if="activeVoiceTab === 'user'"
                v-model="userSampleText"
                rows="3"
                placeholder="Enter user sample speech to preview..."
                :class="['w-full min-h-[88px] resize-y px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 select-text leading-relaxed shadow-inner']"
              />
              <textarea
                v-else
                v-model="sampleText"
                rows="3"
                placeholder="Enter greeting sample text to preview..."
                :class="['w-full min-h-[88px] resize-y px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 select-text leading-relaxed shadow-inner']"
              />

              <button
                type="button"
                :disabled="serverStatus !== 'connected' && !isPlayingCompanion && !isPlayingUser"
                :class="[
                  'w-full px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 shadow-sm',
                  (isPlayingCompanion || isPlayingUser)
                    ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                    : serverStatus === 'connected'
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-white/10 cursor-pointer'
                      : 'bg-neutral-200/80 dark:bg-neutral-800/60 text-neutral-400 dark:text-neutral-500 border border-transparent cursor-not-allowed',
                ]"
                @click="togglePreview(activeVoiceTab)"
              >
                <div :class="[(isPlayingCompanion || isPlayingUser) ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
                <span>{{ (isPlayingCompanion || isPlayingUser) ? 'Stop' : 'Play preview' }}</span>
              </button>

              <div :class="['flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 pt-0.5']">
                <div :class="['i-solar:info-circle-bold w-4 h-4 flex-shrink-0 text-neutral-400']" />
                <span>{{ serverStatus === 'connected' ? 'Voice ready · Click to preview audio sample.' : 'Connect to your audio server to load a model and voice.' }}</span>
              </div>
            </div>
          </div>

          <!-- BUILT-IN / CLOUD WORKSPACE -->
          <template v-else>
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
                  Voice
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

              <!-- Voice sample upload -->
              <div
                v-if="supportsVoiceCloning"
                :class="[
                  'flex items-center justify-between gap-3 p-3 rounded-2xl border border-dashed transition-all cursor-pointer select-none',
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
                    <div v-else class="i-solar:upload-track-2-bold-duotone h-4 w-4" />
                  </div>

                  <div class="min-w-0 flex flex-col">
                    <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                      Use a voice sample
                    </span>
                    <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      Upload 5–10 seconds of audio · WAV or MP3
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
                    <span>{{ isCloning ? 'Cloning...' : 'Upload audio' }}</span>
                  </button>
                </div>
              </div>

              <!-- AIRI Audio Server Prompt Transcript Input (Zero-Shot Alignment) -->
              <div
                v-if="supportsVoiceCloning && normalizeProviderId(selectedProvider) === 'airi-audio-server'"
                class="flex flex-col gap-1 px-1 -mt-1"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-neutral-400 font-bold uppercase dark:text-neutral-500">
                    Prompt Spoken Transcript (Optional)
                  </span>
                  <span class="text-[9px] text-amber-600 font-medium dark:text-amber-400">
                    Acoustic Alignment for OmniVoice / Higgs / Fish
                  </span>
                </div>
                <input
                  v-model="audioServerPromptTranscript"
                  type="text"
                  placeholder="Type exact words spoken in the audio sample before dropping..."
                  class="w-full border border-neutral-200/80 rounded-xl bg-white/60 px-3 py-1.5 text-xs text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900/60 dark:text-neutral-200"
                >
              </div>

              <!-- Acoustic Sliders (Speed & Pitch) -->
              <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1']">
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

              <!-- Companion voice preview -->
              <div :class="['flex flex-col gap-2']">
                <span :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Hear this voice.
                </span>
                <div :class="['flex items-center justify-between gap-2']">
                  <span :class="['text-xs font-semibold text-neutral-500 dark:text-neutral-400']">
                    Sample text
                  </span>
                  <button
                    type="button"
                    :class="['text-[11px] text-neutral-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium transition-colors cursor-pointer']"
                    @click="resetSampleText"
                  >
                    Reset text
                  </button>
                </div>

                <textarea
                  v-model="sampleText"
                  rows="4"
                  placeholder="Enter greeting sample text to preview..."
                  :class="['w-full min-h-[110px] resize-y px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-primary-500 select-text leading-relaxed']"
                />
                <button
                  type="button"
                  :disabled="isLocalProvider && !isEngineReady"
                  :class="[
                    'w-full px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 shadow-sm',
                    isPlayingCompanion
                      ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                      : 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-600/30 cursor-pointer',
                    (isLocalProvider && !isEngineReady) && 'opacity-50 cursor-not-allowed hover:bg-primary-600 shadow-none',
                  ]"
                  @click="togglePreview('companion')"
                >
                  <div :class="[isPlayingCompanion ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
                  <span>{{ isPlayingCompanion ? 'Stop' : 'Play preview' }}</span>
                </button>
                <div
                  v-if="isLocalProvider && !isEngineReady"
                  :class="['flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium']"
                >
                  <div :class="['i-solar:danger-triangle-bold-duotone w-4 h-4 flex-shrink-0']" />
                  <span v-if="isDownloading">Downloading engine weights ({{ downloadProgress }}%)…</span>
                  <span v-else>Download the selected engine to hear this voice.</span>
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
                  Voice
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

              <!-- Voice sample upload -->
              <div
                v-if="supportsVoiceCloning"
                :class="[
                  'flex items-center justify-between gap-3 p-3 rounded-2xl border border-dashed transition-all cursor-pointer select-none',
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
                    <div v-else class="i-solar:upload-track-2-bold-duotone h-4 w-4" />
                  </div>

                  <div class="min-w-0 flex flex-col">
                    <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">
                      Use a voice sample
                    </span>
                    <p class="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                      Upload 5–10 seconds of audio · WAV or MP3
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
                    <span>{{ isCloning ? 'Cloning...' : 'Upload audio' }}</span>
                  </button>
                </div>
              </div>

              <!-- AIRI Audio Server Prompt Transcript Input (Zero-Shot Alignment) -->
              <div
                v-if="supportsVoiceCloning && normalizeProviderId(selectedProvider) === 'airi-audio-server'"
                class="flex flex-col gap-1 px-1 -mt-1"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] text-neutral-400 font-bold uppercase dark:text-neutral-500">
                    Prompt Spoken Transcript (Optional)
                  </span>
                  <span class="text-[9px] text-purple-600 font-medium dark:text-purple-400">
                    Acoustic Alignment for OmniVoice / Higgs / Fish
                  </span>
                </div>
                <input
                  v-model="audioServerPromptTranscript"
                  type="text"
                  placeholder="Type exact words spoken in the audio sample before dropping..."
                  class="w-full border border-neutral-200/80 rounded-xl bg-white/60 px-3 py-1.5 text-xs text-neutral-800 outline-none dark:border-neutral-800 focus:border-purple-500 dark:bg-neutral-900/60 dark:text-neutral-200"
                >
              </div>

              <!-- Acoustic Sliders (Speed & Pitch) -->
              <div :class="['grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1']">
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

              <!-- User voice preview -->
              <div :class="['flex flex-col gap-2']">
                <span :class="['text-sm font-bold text-neutral-900 dark:text-white']">
                  Hear this voice.
                </span>
                <div :class="['flex items-center justify-between gap-2']">
                  <span :class="['text-xs font-semibold text-neutral-500 dark:text-neutral-400']">
                    Sample text
                  </span>
                  <button
                    type="button"
                    :class="['text-[11px] text-neutral-500 hover:text-purple-600 dark:hover:text-purple-400 font-medium transition-colors cursor-pointer']"
                    @click="resetUserSampleText"
                  >
                    Reset text
                  </button>
                </div>

                <textarea
                  v-model="userSampleText"
                  rows="4"
                  placeholder="Enter user sample speech to preview..."
                  :class="['w-full min-h-[110px] resize-y px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-white/10 text-neutral-900 dark:text-white outline-none focus:border-purple-500 select-text leading-relaxed']"
                />
                <button
                  type="button"
                  :disabled="isLocalProvider && !isEngineReady"
                  :class="[
                    'w-full px-4 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 flex-shrink-0 shadow-sm',
                    isPlayingUser
                      ? 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 cursor-pointer',
                    (isLocalProvider && !isEngineReady) && 'opacity-50 cursor-not-allowed hover:bg-purple-600 shadow-none',
                  ]"
                  @click="togglePreview('user')"
                >
                  <div :class="[isPlayingUser ? 'i-solar:stop-circle-bold w-4 h-4' : 'i-solar:play-circle-bold w-4 h-4']" />
                  <span>{{ isPlayingUser ? 'Stop' : 'Play preview' }}</span>
                </button>
                <div
                  v-if="isLocalProvider && !isEngineReady"
                  :class="['flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium']"
                >
                  <div :class="['i-solar:danger-triangle-bold-duotone w-4 h-4 flex-shrink-0']" />
                  <span v-if="isDownloading">Downloading engine weights ({{ downloadProgress }}%)…</span>
                  <span v-else>Download the selected engine to hear this voice.</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Bottom Navigation Bar -->
      <div :class="['flex-shrink-0 pt-4 flex items-center justify-between border-t border-neutral-200/60 dark:border-white/5']">
        <button
          type="button"
          :class="[
            'px-4 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
            'hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5',
          ]"
          @click="props.onPrevious"
        >
          <div :class="['i-solar:alt-arrow-left-line-duotone h-4 w-4']" />
          <span>{{ t('onboarding.shell.previous') }}</span>
        </button>

        <!-- Status Indicator -->
        <div :class="['text-xs font-medium text-center hidden sm:block truncate max-w-xs md:max-w-md']">
          <span v-if="activeEngineSegment === 'server'" :class="['text-neutral-500 dark:text-neutral-400']">
            Set up your voice now, or finish later.
          </span>
          <span v-else-if="isLocalProvider && isEngineReady" :class="['text-emerald-600 dark:text-emerald-400 font-semibold']">
            {{ selectedProviderName }} engine ready · Voice calibrated
          </span>
          <span v-else-if="isLocalProvider && isDownloading" :class="['text-primary-500 font-semibold']">
            Downloading engine weights ({{ downloadProgress }}%)...
          </span>
          <span v-else-if="!isLocalProvider" :class="['text-neutral-500 dark:text-neutral-400']">
            {{ selectedProviderName }} selected
          </span>
          <span v-else :class="['text-neutral-400']">
            Voice calibrated · Ready to proceed
          </span>
        </div>

        <div :class="['flex items-center gap-2']">
          <button
            type="button"
            :class="[
              'px-3.5 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white',
              'hover:bg-neutral-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer',
            ]"
            @click="props.onNext"
          >
            Setup later
          </button>

          <Button
            variant="primary"
            size="md"
            :class="[
              'flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-5 py-2',
              'text-xs font-semibold text-white shadow-md shadow-primary-600/25 transition-all active:scale-95 cursor-pointer',
            ]"
            @click="handleContinue"
          >
            <span>{{ t('onboarding.shell.next') }}</span>
            <div :class="['i-solar:alt-arrow-right-line-duotone h-4 w-4']" />
          </Button>
        </div>
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
            class="max-w-md w-full border border-neutral-200/80 rounded-3xl bg-white p-6 shadow-2xl dark:border-neutral-800/80 dark:bg-neutral-900"
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
            <p class="mb-4 text-sm text-neutral-600 leading-relaxed dark:text-neutral-300">
              The voice you selected (<span class="text-neutral-800 font-semibold dark:text-neutral-100">{{ selectedVoice }}</span>) is hosted on a gated Hugging Face repository.
              To use it, you need a free Hugging Face account, accept the model gate, and paste your access token below.
            </p>

            <!-- Alternative: Free Offline Starter Voices -->
            <div class="mb-4 border border-emerald-500/20 rounded-2xl bg-emerald-500/5 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div class="flex items-center gap-2 text-xs text-emerald-700 font-semibold dark:text-emerald-300">
                <div class="i-solar:shield-check-bold-duotone size-4 shrink-0 text-emerald-500" />
                <span>Skip the token: Free offline starter voices</span>
              </div>
              <p class="mt-1 text-[11px] text-neutral-600 dark:text-neutral-400">
                These voices run 100% locally with zero-shot cloning — no HF account or token needed:
              </p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="cursor-pointer border border-emerald-500/30 rounded-xl bg-white px-2.5 py-1 text-xs text-emerald-700 font-medium shadow-sm transition active:scale-95 hover:border-emerald-500 dark:bg-neutral-800 dark:text-emerald-300"
                  @click="selectStarterVoice('airi_relu')"
                >
                  ★ ReLU (Empathetic)
                </button>
                <button
                  type="button"
                  class="cursor-pointer border border-emerald-500/30 rounded-xl bg-white px-2.5 py-1 text-xs text-emerald-700 font-medium shadow-sm transition active:scale-95 hover:border-emerald-500 dark:bg-neutral-800 dark:text-emerald-300"
                  @click="selectStarterVoice('airi_sakura')"
                >
                  ★ Sakura (Japanese 🇯🇵)
                </button>
                <button
                  type="button"
                  class="cursor-pointer border border-emerald-500/30 rounded-xl bg-white px-2.5 py-1 text-xs text-emerald-700 font-medium shadow-sm transition active:scale-95 hover:border-emerald-500 dark:bg-neutral-800 dark:text-emerald-300"
                  @click="selectStarterVoice('airi_aria')"
                >
                  ★ Dr. Aria
                </button>
              </div>
            </div>

            <!-- Steps -->
            <ol class="mb-4 text-xs text-neutral-500 space-y-2 dark:text-neutral-400">
              <li class="flex items-start gap-2">
                <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">1</span>
                <span>Create an account at <a href="https://huggingface.co" target="_blank" rel="noopener noreferrer" class="text-neutral-800 font-semibold underline dark:text-neutral-200">huggingface.co</a></span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">2</span>
                <span>
                  Visit <a href="https://huggingface.co/kyutai/pocket-tts" target="_blank" rel="noopener noreferrer" class="text-amber-600 font-semibold underline dark:text-amber-400">kyutai/pocket-tts</a> and click <strong>"Agree and access repository"</strong>
                  <span class="block text-[10px] text-amber-600/80 dark:text-amber-400/80">⚠️ Required: Without accepting the gate, HF blocks access even with a valid token.</span>
                </span>
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 size-4 flex shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] text-amber-600 font-bold dark:text-amber-400">3</span>
                <span>
                  Generate a <strong>User Access Token</strong> with <strong>Read</strong> role at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" class="text-neutral-800 font-semibold underline dark:text-neutral-200">huggingface.co/settings/tokens</a> (token starts with <code class="rounded bg-neutral-200/60 px-1 py-0.5 text-[10px] font-mono dark:bg-white/10">hf_</code>)
                </span>
              </li>
            </ol>

            <!-- Quick Token Input inside Modal -->
            <div class="mb-5 flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <label class="text-[11px] text-neutral-600 font-semibold dark:text-neutral-300">Paste Token Here</label>
                <span
                  v-if="hfTokenStatus.message"
                  :class="[
                    'text-[10px] font-medium',
                    hfTokenStatus.state === 'error' ? 'text-red-500' : hfTokenStatus.state === 'warning' ? 'text-amber-500' : 'text-emerald-500',
                  ]"
                >
                  {{ hfTokenStatus.message }}
                </span>
              </div>
              <input
                v-model="hfTokenInput"
                type="password"
                placeholder="hf_..."
                :class="[
                  'w-full border rounded-xl bg-neutral-100 px-3 py-2 text-xs font-mono outline-none dark:bg-neutral-800 dark:text-white transition',
                  hfTokenStatus.state === 'error' ? 'border-red-400 dark:border-red-500/60 focus:border-red-500' : 'border-neutral-200 dark:border-white/10 focus:border-primary-500',
                ]"
                @input="saveHfToken"
              >
              <p v-if="hfTokenStatus.tip" :class="['text-[11px] leading-tight', hfTokenStatus.state === 'error' ? 'text-red-500' : hfTokenStatus.state === 'warning' ? 'text-amber-500' : 'text-neutral-500 dark:text-neutral-400']">
                {{ hfTokenStatus.tip }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button
                type="button"
                class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-amber-500 py-2.5 text-xs text-white font-semibold shadow-amber-500/25 shadow-md transition active:scale-95 hover:bg-amber-600"
                @pointerdown.stop
                @click.stop="openHFGatePage"
              >
                <div class="i-solar:shield-check-bold-duotone size-3.5" />
                <span>1. Accept Gate</span>
              </button>
              <button
                type="button"
                class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-neutral-800 py-2.5 text-xs text-white font-semibold transition active:scale-95 dark:bg-neutral-700 hover:bg-neutral-700"
                @pointerdown.stop
                @click.stop="openHFTokenPage"
              >
                <div class="i-solar:key-bold-duotone size-3.5" />
                <span>2. Get Token</span>
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-2xl bg-neutral-100 px-4 py-2.5 text-xs text-neutral-600 font-semibold transition active:scale-98 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
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
  </div>
</template>
