<script setup lang="ts">
import type { FacultyName, FailoverTrigger } from '@proj-airi/stage-ui/stores'

import { POLLINATIONS_DEFAULT_MODELS, REPLICATE_IMAGEGEN_PRESETS } from '@proj-airi/stage-shared'
import { useFacultyDefaultsStore } from '@proj-airi/stage-ui/stores'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { toast } from 'vue-sonner'

const facultyDefaultsStore = useFacultyDefaultsStore()
const providersStore = useProvidersStore()
const airiCardStore = useAiriCardStore()
const artistryStore = useArtistryStore()
const speechStore = useSpeechStore()
const userProfileStore = useSettingsUserProfile()

const {
  defaults,
  consciousness,
  speech,
  hearing,
  artistry,
  vision,
  isGlobalCircuitBreakerEnabled,
} = storeToRefs(facultyDefaultsStore)

const { activeCard } = storeToRefs(airiCardStore)

const {
  allChatProvidersMetadata,
  allAudioSpeechProvidersMetadata,
  allAudioTranscriptionProvidersMetadata,
  allVisionProvidersMetadata,
} = storeToRefs(providersStore)

const {
  pollinationsCachedModels,
  comfyuiSavedWorkflows,
} = storeToRefs(artistryStore)

const activeDrawerFaculty = ref<FacultyName | null>(null)
const tempPrimaryProvider = ref('')
const tempPrimaryModel = ref('')
const tempPrimaryVoiceId = ref('af_heart')
const tempFallbackProvider = ref('')
const tempFallbackModel = ref('')
const tempFallbackVoiceId = ref('')
const tempAutoFailover = ref(true)
const tempTriggers = ref<FailoverTrigger[]>([])
const tempNotificationStyle = ref<'toast' | 'badge' | 'silent'>('toast')
const tempRecoveryInterval = ref(15)

const showSimulatedToast = ref(false)

const activeCharacterName = computed(() => activeCard.value?.name || 'Active Companion')

// Compute active card override text for the current drawer faculty
const activeCardOverrideText = computed(() => {
  if (!activeDrawerFaculty.value || !activeCard.value)
    return 'None (Inheriting Global Preferred)'

  const ext = activeCard.value.extensions?.airi
  if (!ext)
    return 'None (Inheriting Global Preferred)'

  if (activeDrawerFaculty.value === 'consciousness') {
    const p = ext.modules?.consciousness?.provider
    const m = ext.modules?.consciousness?.model
    return (p && p !== 'inherit' && p !== 'default') ? `${p} / ${m || 'default'}` : 'None (Inheriting Global Preferred)'
  }
  if (activeDrawerFaculty.value === 'speech') {
    const v = ext.modules?.speech?.voice_id || ext.modules?.speech?.model
    const p = ext.modules?.speech?.provider
    return (p && p !== 'inherit' && p !== 'default') ? `${p} / ${v || 'default'}` : 'None (Inheriting Global Preferred)'
  }
  if (activeDrawerFaculty.value === 'artistry') {
    const p = ext.artistry?.provider
    const m = ext.artistry?.model
    return p ? `${p} / ${m || 'default'}` : 'None (Inheriting Global Preferred)'
  }
  return 'System Hardware / Client Sensor'
})

const facultyPlaygroundRoute = computed(() => {
  if (!activeDrawerFaculty.value)
    return '/settings/modules'
  return `/settings/modules/${activeDrawerFaculty.value}`
})

interface FacultyMeta {
  id: FacultyName
  name: string
  icon: string
  badgeColor: string
  primaryLabel: string
  fallbackLabel: string
}

function formatEngineLabel(provider: string, model: string, voiceId?: string): string {
  if (!provider)
    return 'Unset'
  if (provider === 'pollinations') {
    if (!model)
      return 'Pollinations (Auto Free)'
    return `Pollinations (${model})`
  }
  if (provider === 'kokoro-local')
    return voiceId ? `Kokoro 82M (${voiceId})` : 'Kokoro 82M'
  if (provider === 'whisper-local')
    return 'Whisper Tiny'
  if (provider === 'blip' || provider === 'wd14' || provider === 'blip-local')
    return 'Waifu Diffusion (WD Tagger)'
  if (provider === 'moondream' || provider === 'moondream-local')
    return 'Moondream2 (1.6B VLM)'
  if (provider === 'web-speech-api')
    return 'Web Speech API'
  if (provider === 'mimo')
    return 'MiMo (Free)'
  if (provider === 'speech-noop')
    return 'Mute / Silent'
  if (voiceId)
    return `${provider} (${voiceId})`
  if (model) {
    const shortModel = model.includes('/') ? model.split('/').pop() : model
    return `${provider} (${shortModel})`
  }
  return provider
}

const facultiesList = computed<FacultyMeta[]>(() => [
  {
    id: 'consciousness',
    name: 'Mind (LLM)',
    icon: '🧠',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    primaryLabel: formatEngineLabel(consciousness.value.primaryProvider, consciousness.value.primaryModel),
    fallbackLabel: formatEngineLabel(consciousness.value.fallbackProvider, consciousness.value.fallbackModel),
  },
  {
    id: 'speech',
    name: 'Speech (TTS)',
    icon: '🗣️',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    primaryLabel: formatEngineLabel(speech.value.primaryProvider, speech.value.primaryModel, speech.value.primaryVoiceId),
    fallbackLabel: formatEngineLabel(speech.value.fallbackProvider, speech.value.fallbackModel, speech.value.fallbackVoiceId),
  },
  {
    id: 'hearing',
    name: 'Hearing (STT)',
    icon: '👂',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    primaryLabel: formatEngineLabel(hearing.value.primaryProvider, hearing.value.primaryModel),
    fallbackLabel: formatEngineLabel(hearing.value.fallbackProvider, hearing.value.fallbackModel),
  },
  {
    id: 'artistry',
    name: 'Artistry (Studio)',
    icon: '🎨',
    badgeColor: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
    primaryLabel: formatEngineLabel(artistry.value.primaryProvider, artistry.value.primaryModel),
    fallbackLabel: formatEngineLabel(artistry.value.fallbackProvider, artistry.value.fallbackModel),
  },
  {
    id: 'vision',
    name: 'Vision (VLM / Tags)',
    icon: '👁️',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    primaryLabel: formatEngineLabel(vision.value.primaryProvider, vision.value.primaryModel),
    fallbackLabel: formatEngineLabel(vision.value.fallbackProvider, vision.value.fallbackModel),
  },
])

// Provider definitions per faculty
interface ProviderItem {
  id: string
  name: string
  isRecommended?: boolean
}

const allFacultyProviders = computed<ProviderItem[]>(() => {
  if (!activeDrawerFaculty.value)
    return []

  if (activeDrawerFaculty.value === 'consciousness') {
    const recommendedMap: Record<string, string> = {
      'mimo': 'Xiaomi MiMo (Free Cloud • Zero Sign-Up)',
      'web-llm': 'WebLLM (Local In-Browser WebGPU)',
      'web-rwkv': 'RWKV-7 (Local WebGPU)',
      'ollama': 'Ollama (Local Server)',
    }
    const recommendedList: ProviderItem[] = Object.entries(recommendedMap).map(([id, name]) => ({
      id,
      name,
      isRecommended: true,
    }))
    const otherList: ProviderItem[] = allChatProvidersMetadata.value
      .filter(p => !(p.id in recommendedMap))
      .map(p => ({
        id: p.id,
        name: p.localizedName || p.name,
        isRecommended: false,
      }))
    return [...recommendedList, ...otherList]
  }

  if (activeDrawerFaculty.value === 'speech') {
    const recommendedMap: Record<string, string> = {
      'kokoro-local': 'Kokoro WebGPU (82MB Local)',
      'web-speech-api': 'Web Speech API (Instant Zero-Download)',
      'speech-noop': 'None (Mute Fallback)',
    }
    const recommendedList: ProviderItem[] = Object.entries(recommendedMap).map(([id, name]) => ({
      id,
      name,
      isRecommended: true,
    }))
    const otherList: ProviderItem[] = allAudioSpeechProvidersMetadata.value
      .filter(p => !(p.id in recommendedMap))
      .map(p => ({
        id: p.id,
        name: p.localizedName || p.name,
        isRecommended: false,
      }))
    return [...recommendedList, ...otherList]
  }

  if (activeDrawerFaculty.value === 'hearing') {
    const recommendedMap: Record<string, string> = {
      'whisper-local': 'Whisper Tiny (~39MB Local)',
      'web-speech-api': 'Web Speech API (Instant Zero-Download)',
    }
    const recommendedList: ProviderItem[] = Object.entries(recommendedMap).map(([id, name]) => ({
      id,
      name,
      isRecommended: true,
    }))
    const otherList: ProviderItem[] = allAudioTranscriptionProvidersMetadata.value
      .filter(p => !(p.id in recommendedMap))
      .map(p => ({
        id: p.id,
        name: p.localizedName || p.name,
        isRecommended: false,
      }))
    return [...recommendedList, ...otherList]
  }

  if (activeDrawerFaculty.value === 'artistry') {
    return [
      { id: 'pollinations', name: 'Pollinations AI (Zero-Config Free)', isRecommended: true },
      { id: 'comfyui', name: 'ComfyUI (Local GPU Node)', isRecommended: true },
      { id: 'nanobanana', name: 'Nano Banana (Google AI Studio)', isRecommended: false },
      { id: 'replicate', name: 'Replicate.ai (Cloud API)', isRecommended: false },
      { id: 'none', name: 'None (Disabled)', isRecommended: false },
    ]
  }

  if (activeDrawerFaculty.value === 'vision') {
    const recommendedMap: Record<string, string> = {
      moondream: 'Moondream2 VLM (Local, WebGPU)',
      blip: 'Waifu Diffusion Tagger (WD Local)',
      none: 'None (Skip Vision)',
    }
    const recommendedList: ProviderItem[] = [
      { id: 'moondream', name: 'Moondream2 VLM (Local, WebGPU)', isRecommended: true },
      { id: 'blip', name: 'Waifu Diffusion Tagger (WD Local)', isRecommended: true },
      { id: 'none', name: 'None (Skip Vision)', isRecommended: true },
    ]
    const otherList: ProviderItem[] = allVisionProvidersMetadata.value
      .filter(p => !(p.id in recommendedMap))
      .map(p => ({
        id: p.id,
        name: p.localizedName || p.name,
        isRecommended: false,
      }))
    return [...recommendedList, ...otherList]
  }

  return []
})

const recommendedProviders = computed(() => allFacultyProviders.value.filter(p => p.isRecommended))
const otherProviders = computed(() => allFacultyProviders.value.filter(p => !p.isRecommended))

function resolveModelsForFacultyProvider(faculty: FacultyName | null, provider: string): Array<{ id: string, name: string }> {
  if (!faculty || !provider)
    return []

  if (faculty === 'artistry') {
    if (provider === 'pollinations') {
      const list = pollinationsCachedModels.value.length > 0
        ? pollinationsCachedModels.value
        : POLLINATIONS_DEFAULT_MODELS
      return list.map(m => ({
        id: m.id,
        name: m.id === ''
          ? 'Free Auto Router (Zero-Key / Unauthenticated)'
          : (m.price ? `${m.name} (${m.price})` : m.name),
      }))
    }
    if (provider === 'nanobanana') {
      return [
        { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2 (Gemini 3.1 Flash Image)' },
        { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro (Gemini 3 Pro Image)' },
        { id: 'gemini-2.5-flash-image', name: 'Nano Banana (Gemini 2.5 Flash Image)' },
      ]
    }
    if (provider === 'replicate') {
      return REPLICATE_IMAGEGEN_PRESETS.map(p => ({
        id: p.id,
        name: `${p.label} (${p.cost})`,
      }))
    }
    if (provider === 'comfyui') {
      if (!comfyuiSavedWorkflows.value || comfyuiSavedWorkflows.value.length === 0) {
        return [{ id: '', name: 'Default Workflow (or configure in Settings)' }]
      }
      return comfyuiSavedWorkflows.value.map(wf => ({
        id: wf.id,
        name: `${wf.name} (${Object.values(wf.exposedFields || {}).reduce((n, arr) => n + (arr?.length || 0), 0)} exposed fields)`,
      }))
    }
    if (provider === 'none') {
      return [{ id: 'none', name: 'None (Disabled)' }]
    }
  }

  if (faculty === 'consciousness') {
    if (provider === 'mimo') {
      return [{ id: 'mimo-auto', name: 'mimo-auto (Free Xiaomi Cloud)' }]
    }
    if (provider === 'web-llm') {
      return [
        { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 1B (Fast WebGPU)' },
        { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 0.5B (Lightweight WebGPU)' },
        { id: 'SmolLM2-360M-Instruct-q4f16_1-MLC', name: 'SmolLM2 360M (Ultra-light WebGPU)' },
        { id: 'Llama-3-8B-Instruct-q4f32_1-MLC', name: 'Llama 3 8B (Quality WebGPU)' },
      ]
    }
    if (provider === 'web-rwkv') {
      return [
        { id: 'RWKV-7-0.1B-World', name: 'RWKV-7 0.1B (Ultra-fast WebGPU)' },
        { id: 'RWKV-7-0.4B-World', name: 'RWKV-7 0.4B (Balanced WebGPU)' },
        { id: 'RWKV-7-1.5B-World', name: 'RWKV-7 1.5B (High-capacity WebGPU)' },
      ]
    }
    const list = providersStore.getModelsForProvider(provider)
    if (list.length > 0)
      return list.map(m => ({ id: m.id, name: m.name || m.id }))
  }

  if (faculty === 'speech') {
    if (provider === 'kokoro-local') {
      return [
        { id: 'onnx-community/Kokoro-82M-v1.0-ONNX', name: 'Kokoro 82M v1.0 (WebGPU)' },
      ]
    }
    if (provider === 'web-speech-api') {
      return [{ id: '', name: 'System Default Voice' }]
    }
    if (provider === 'speech-noop') {
      return [{ id: '', name: 'Mute / Silent' }]
    }
    const list = providersStore.getModelsForProvider(provider)
    if (list.length > 0)
      return list.map(m => ({ id: m.id, name: m.name || m.id }))
  }

  if (faculty === 'hearing') {
    if (provider === 'whisper-local') {
      return [
        { id: 'openai/whisper-tiny', name: 'Whisper Tiny (~39MB WebGPU)' },
        { id: 'openai/whisper-base', name: 'Whisper Base (~74MB WebGPU)' },
        { id: 'openai/whisper-small', name: 'Whisper Small (~244MB WebGPU)' },
      ]
    }
    if (provider === 'web-speech-api') {
      return [{ id: '', name: 'System Default Speech Recognition' }]
    }
    if (provider === 'deepgram') {
      return [
        { id: 'nova-2', name: 'Nova-2' },
        { id: 'nova-2-general', name: 'Nova-2 General' },
      ]
    }
    if (provider === 'openai') {
      return [{ id: 'whisper-1', name: 'Whisper-1' }]
    }
    if (provider === 'groq') {
      return [
        { id: 'whisper-large-v3', name: 'Whisper Large v3' },
        { id: 'whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo' },
      ]
    }
    const list = providersStore.getModelsForProvider(provider)
    if (list.length > 0)
      return list.map(m => ({ id: m.id, name: m.name || m.id }))
  }

  if (faculty === 'vision') {
    if (provider === 'moondream' || provider === 'moondream-local') {
      return [
        { id: 'Xenova/moondream2', name: 'Moondream2 (1.6B ~700MB)' },
      ]
    }
    if (provider === 'blip' || provider === 'wd14' || provider === 'blip-local') {
      return [
        { id: 'SmilingWolf/wd-swinv2-tagger-v3', name: 'WD SwinV2 Tagger v3 (~450MB)' },
        { id: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', name: 'WD14 SwinV2 Tagger (~300MB)' },
      ]
    }
    if (provider === 'none' || !provider) {
      return [{ id: '', name: 'None (Skip Vision)' }]
    }
    if (provider === 'openai') {
      return [
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      ]
    }
    if (provider === 'gemini') {
      return [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      ]
    }
    const list = providersStore.getModelsForProvider(provider)
    if (list.length > 0)
      return list.map(m => ({ id: m.id, name: m.name || m.id }))
  }

  return []
}

const primaryProviderModels = computed(() => resolveModelsForFacultyProvider(activeDrawerFaculty.value, tempPrimaryProvider.value))
const fallbackProviderModels = computed(() => resolveModelsForFacultyProvider(activeDrawerFaculty.value, tempFallbackProvider.value))

interface VoiceOption {
  id: string
  name: string
  group?: string
}

const primarySpeechVoices = computed<VoiceOption[]>(() => {
  if (activeDrawerFaculty.value !== 'speech')
    return []

  const p = tempPrimaryProvider.value
  const result: VoiceOption[] = []

  // If user profile has a configured voice, offer it
  if (userProfileStore.voiceProfileId) {
    result.push({
      id: userProfileStore.voiceProfileId,
      name: `User Configured Voice (${userProfileStore.voiceProfileId})`,
      group: 'User Profile',
    })
  }

  // If Audio Studio has virtual voice profiles saved
  if (speechStore.savedVoiceProfiles && speechStore.savedVoiceProfiles.length > 0) {
    for (const vp of speechStore.savedVoiceProfiles) {
      result.push({
        id: vp.id,
        name: `${vp.name} (Virtual Voice)`,
        group: 'Audio Studio Profiles',
      })
    }
  }

  if (p === 'kokoro-local') {
    result.push(
      { id: 'af_heart', name: 'Heart (Female · Warm - Recommended Catch-All)', group: 'Kokoro Recommended' },
      { id: 'af_bella', name: 'Bella (Female · Soft)', group: 'Kokoro Voices' },
      { id: 'af_nicole', name: 'Nicole (Female · Energetic)', group: 'Kokoro Voices' },
      { id: 'af_sky', name: 'Sky (Female · Sweet)', group: 'Kokoro Voices' },
      { id: 'af_sarah', name: 'Sarah (Female · Professional)', group: 'Kokoro Voices' },
      { id: 'am_adam', name: 'Adam (Male · Natural)', group: 'Kokoro Voices' },
      { id: 'am_michael', name: 'Michael (Male · Deep)', group: 'Kokoro Voices' },
    )
  }
  else if (p === 'pocket-tts-local') {
    result.push(
      { id: 'anna', name: 'Anna (Female · Conversational - Recommended)', group: 'Pocket Recommended' },
      { id: 'eve', name: 'Eve (Female · Conversational)', group: 'Pocket Voices' },
      { id: 'jane', name: 'Jane (Female · Conversational)', group: 'Pocket Voices' },
      { id: 'charles', name: 'Charles (Male · Conversational)', group: 'Pocket Voices' },
      { id: 'george', name: 'George (Male · Conversational)', group: 'Pocket Voices' },
    )
  }
  else if (p === 'moss-nano-local') {
    result.push(
      { id: 'LJS', name: 'LJ Speech (Female - Recommended)', group: 'Moss Voices' },
      { id: 'Trump', name: 'Trump (Preset)', group: 'Moss Voices' },
    )
  }
  else if (p === 'openai-audio-speech' || p === 'openai-compatible-audio-speech') {
    result.push(
      { id: 'alloy', name: 'Alloy', group: 'OpenAI Voices' },
      { id: 'echo', name: 'Echo', group: 'OpenAI Voices' },
      { id: 'fable', name: 'Fable', group: 'OpenAI Voices' },
      { id: 'onyx', name: 'Onyx', group: 'OpenAI Voices' },
      { id: 'nova', name: 'Nova', group: 'OpenAI Voices' },
      { id: 'shimmer', name: 'Shimmer', group: 'OpenAI Voices' },
    )
  }
  else if (p === 'web-speech-api') {
    result.push({
      id: '',
      name: 'System Default Browser Voice',
      group: 'Web Speech API',
    })
  }
  else if (p === 'speech-noop') {
    result.push({
      id: '',
      name: 'Mute / Silent',
      group: 'Mute',
    })
  }

  // Dynamic voices from speechStore if present
  const dynVoices = speechStore.availableVoices[p] || []
  if (dynVoices.length > 0) {
    for (const v of dynVoices) {
      if (!result.some(r => r.id === v.id)) {
        result.push({
          id: v.id,
          name: v.name ? `${v.name}${v.languages?.[0]?.title ? ` (${v.languages[0].title})` : ''}` : v.id,
          group: 'Provider Remote Voices',
        })
      }
    }
  }

  return result
})

const primarySpeechVoiceGroups = computed(() => {
  const groups: Record<string, VoiceOption[]> = {}
  for (const v of primarySpeechVoices.value) {
    const g = v.group || 'Standard Voices'
    if (!groups[g])
      groups[g] = []
    groups[g].push(v)
  }
  return groups
})

const speechFallbackPreset = computed({
  get() {
    if (tempFallbackProvider.value === 'web-speech-api')
      return 'web-speech'
    if (tempFallbackProvider.value === 'kokoro-local')
      return 'kokoro-heart'
    if (tempFallbackProvider.value === 'pocket-tts-local')
      return 'pocket-anna'
    if (tempFallbackProvider.value === 'speech-noop')
      return 'mute'
    return 'custom'
  },
  set(val: string) {
    if (val === 'web-speech') {
      tempFallbackProvider.value = 'web-speech-api'
      tempFallbackModel.value = ''
      tempFallbackVoiceId.value = ''
    }
    else if (val === 'kokoro-heart') {
      tempFallbackProvider.value = 'kokoro-local'
      tempFallbackModel.value = 'q4f16'
      tempFallbackVoiceId.value = 'af_heart'
    }
    else if (val === 'pocket-anna') {
      tempFallbackProvider.value = 'pocket-tts-local'
      tempFallbackModel.value = 'english_2026-04'
      tempFallbackVoiceId.value = 'anna'
    }
    else if (val === 'mute') {
      tempFallbackProvider.value = 'speech-noop'
      tempFallbackModel.value = ''
      tempFallbackVoiceId.value = ''
    }
  },
})

// Proactively fetch models when primary provider changes
watch(tempPrimaryProvider, async (p) => {
  if (p) {
    if (activeDrawerFaculty.value === 'consciousness') {
      await providersStore.fetchModelsForProvider(p)
    }
    else if (activeDrawerFaculty.value === 'artistry' && p === 'pollinations') {
      await artistryStore.fetchPollinationsModels()
    }
    else if (activeDrawerFaculty.value === 'speech') {
      await speechStore.loadVoicesForProvider(p)
      if (p === 'kokoro-local' && (!tempPrimaryVoiceId.value || tempPrimaryVoiceId.value === 'alloy' || tempPrimaryVoiceId.value === 'anna')) {
        tempPrimaryVoiceId.value = 'af_heart'
      }
      else if (p === 'pocket-tts-local' && (!tempPrimaryVoiceId.value || tempPrimaryVoiceId.value === 'af_heart')) {
        tempPrimaryVoiceId.value = 'anna'
      }
    }
  }
})

watch(tempFallbackProvider, async (p) => {
  if (p) {
    if (activeDrawerFaculty.value === 'consciousness') {
      await providersStore.fetchModelsForProvider(p)
    }
    else if (activeDrawerFaculty.value === 'artistry' && p === 'pollinations') {
      await artistryStore.fetchPollinationsModels()
    }
  }
})

function openDrawer(faculty: FacultyName) {
  activeDrawerFaculty.value = faculty
  const conf = defaults.value[faculty]
  tempPrimaryProvider.value = conf.primaryProvider
  tempPrimaryModel.value = conf.primaryModel
  tempPrimaryVoiceId.value = conf.primaryVoiceId || (faculty === 'speech' ? 'af_heart' : '')
  tempFallbackProvider.value = conf.fallbackProvider
  tempFallbackModel.value = conf.fallbackModel
  tempFallbackVoiceId.value = conf.fallbackVoiceId || ''
  tempAutoFailover.value = conf.autoFailover
  tempTriggers.value = [...conf.failoverTriggers]
  tempNotificationStyle.value = conf.notificationStyle
  tempRecoveryInterval.value = conf.recoveryIntervalMinutes

  if (faculty === 'consciousness') {
    if (conf.primaryProvider)
      providersStore.fetchModelsForProvider(conf.primaryProvider)
    if (conf.fallbackProvider)
      providersStore.fetchModelsForProvider(conf.fallbackProvider)
  }
  else if (faculty === 'artistry') {
    artistryStore.fetchPollinationsModels()
  }
  else if (faculty === 'speech') {
    if (conf.primaryProvider)
      speechStore.loadVoicesForProvider(conf.primaryProvider)
  }
}

function closeDrawer() {
  activeDrawerFaculty.value = null
}

function toggleTrigger(trigger: FailoverTrigger) {
  const idx = tempTriggers.value.indexOf(trigger)
  if (idx >= 0)
    tempTriggers.value.splice(idx, 1)
  else
    tempTriggers.value.push(trigger)
}

function saveDrawer() {
  if (!activeDrawerFaculty.value)
    return

  const f = activeDrawerFaculty.value
  facultyDefaultsStore.setPrimary(
    f,
    tempPrimaryProvider.value,
    tempPrimaryModel.value,
    f === 'speech' ? tempPrimaryVoiceId.value : undefined,
  )
  facultyDefaultsStore.setFallback(
    f,
    tempFallbackProvider.value,
    tempFallbackModel.value,
    f === 'speech' ? tempFallbackVoiceId.value : undefined,
  )
  facultyDefaultsStore.setCircuitBreaker(f, tempAutoFailover.value, tempTriggers.value)
  facultyDefaultsStore.setNotificationStyle(f, tempNotificationStyle.value)
  facultyDefaultsStore.setRecoveryInterval(f, tempRecoveryInterval.value)

  toast.success(`Saved fallback settings for ${f}`)
  closeDrawer()
}

function handleResetToFactorySafe() {
  facultyDefaultsStore.resetToFactorySafe()
  toast.success('Reset to Factory Safe defaults: MiMo, Pollinations, Kokoro, Whisper & WD14!')
}

function handleGlobalCircuitBreakerToggle() {
  const nextState = !isGlobalCircuitBreakerEnabled.value
  for (const f of ['consciousness', 'speech', 'hearing', 'artistry'] as FacultyName[]) {
    facultyDefaultsStore.setCircuitBreaker(f, nextState)
  }
  toast.info(`Global Circuit Breaker ${nextState ? 'Enabled' : 'Disabled'}`)
}

function simulateFailover() {
  showSimulatedToast.value = true
  setTimeout(() => {
    showSimulatedToast.value = false
  }, 6000)
}
</script>

<template>
  <div flex="~ col gap-4" relative>
    <!-- Main Card Container -->
    <div
      class="border border-cyan-500/20 rounded-2xl from-cyan-500/5 via-neutral-500/5 to-neutral-500/10 bg-gradient-to-b p-4 shadow-sm dark:border-cyan-400/20 dark:from-cyan-400/5 sm:p-5"
    >
      <!-- Header Row -->
      <div class="flex flex-col gap-3 border-b border-neutral-200/60 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800/80">
        <div class="flex items-start gap-3">
          <div class="mt-0.5 size-9 flex shrink-0 items-center justify-center border border-cyan-500/30 rounded-xl bg-cyan-500/15 text-cyan-600 dark:border-cyan-400/30 dark:bg-cyan-400/15 dark:text-cyan-300">
            <div class="i-solar:shield-star-bold-duotone size-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-sm text-neutral-900 font-bold sm:text-base dark:text-neutral-100">
                Global Faculties & Resilient Fallbacks
              </h2>
              <span class="border border-emerald-500/30 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 font-bold dark:bg-emerald-400/15 dark:text-emerald-300">
                Active
              </span>
            </div>
            <p class="mt-0.5 text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
              Default AI engines used whenever cards inherit settings, or as immediate safety-nets if your primary API hits quota limits (429/401/outage).
            </p>
          </div>
        </div>

        <!-- Global Actions -->
        <div class="flex items-center self-start gap-3 pt-1 sm:self-auto sm:pt-0">
          <button
            type="button"
            class="flex items-center gap-1.5 border border-emerald-500/30 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 font-semibold transition-all hover:bg-emerald-500/20 dark:text-emerald-300"
            @click="handleResetToFactorySafe"
          >
            <div class="i-solar:restart-bold size-3.5" />
            <span>Reset to Factory Safe</span>
          </button>

          <button
            type="button"
            :class="[
              'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5',
              isGlobalCircuitBreakerEnabled
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 border-neutral-300 dark:border-neutral-700',
            ]"
            @click="handleGlobalCircuitBreakerToggle"
          >
            <div class="i-solar:bolt-circle-bold-duotone size-3.5" />
            <span>Circuit Breaker: {{ isGlobalCircuitBreakerEnabled ? 'ON' : 'OFF' }}</span>
          </button>
        </div>
      </div>

      <!-- 5-Faculty Matrix Cards Grid -->
      <div class="grid grid-cols-1 mt-4 gap-3 lg:grid-cols-5 sm:grid-cols-2">
        <div
          v-for="faculty in facultiesList"
          :key="faculty.id"
          class="group relative cursor-pointer border border-neutral-200/80 rounded-xl bg-white/70 p-3.5 transition-all dark:border-neutral-800/80 hover:border-cyan-500/50 dark:bg-neutral-900/60 hover:shadow-md dark:hover:bg-neutral-800/50"
          @click="openDrawer(faculty.id)"
        >
          <!-- Faculty Title Row -->
          <div class="mb-2 flex items-center justify-between gap-1">
            <div class="flex items-center gap-1.5 text-xs text-neutral-800 font-bold dark:text-neutral-200">
              <span class="text-sm">{{ faculty.icon }}</span>
              <span>{{ faculty.name }}</span>
            </div>
            <div class="size-2 rounded-full bg-emerald-500" title="Operational" />
          </div>

          <!-- Primary & Fallback Stack -->
          <div class="text-xs space-y-2">
            <div>
              <span class="block text-[10px] text-neutral-500 font-semibold uppercase">Primary Default</span>
              <div class="truncate text-xs text-neutral-900 font-medium transition-colors dark:text-neutral-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                {{ faculty.primaryLabel }}
              </div>
            </div>

            <div class="border-t border-neutral-100 pt-1 dark:border-neutral-800/80">
              <div class="flex items-center justify-between text-[10px] text-cyan-600 font-semibold uppercase dark:text-cyan-400">
                <span>Safety Fallback</span>
                <span class="text-[9px] text-emerald-600 font-mono dark:text-emerald-400">Ready</span>
              </div>
              <div class="truncate text-xs text-neutral-600 font-medium dark:text-neutral-400">
                {{ faculty.fallbackLabel }}
              </div>
            </div>
          </div>

          <!-- Footer status pill -->
          <div class="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 text-[11px] text-neutral-400 dark:border-neutral-800/60">
            <span class="text-[10px] text-emerald-600 font-mono dark:text-emerald-400">
              {{ defaults[faculty.id].autoFailover ? 'Auto-Failover ON' : 'Manual Only' }}
            </span>
            <div class="i-solar:settings-bold-duotone size-3.5 text-cyan-600 transition-transform group-hover:scale-110 dark:text-cyan-400" />
          </div>
        </div>
      </div>

      <!-- Footer Help & Test Trigger -->
      <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200/60 pt-3 text-xs dark:border-neutral-800/80">
        <div class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
          <div class="i-solar:info-circle-bold-duotone size-3.5 text-cyan-500" />
          <span>Character Cards override these defaults when explicit engines are assigned.</span>
        </div>
        <button
          type="button"
          class="flex items-center gap-1 border border-amber-500/30 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 font-semibold transition-all hover:bg-amber-500/20 dark:text-amber-300"
          @click="simulateFailover"
        >
          <div class="i-solar:bolt-bold size-3" />
          <span>Simulate 429 Failover</span>
        </button>
      </div>
    </div>

    <!-- Simulated Failover Notification Toast -->
    <div
      v-if="showSimulatedToast"
      class="border border-amber-500/40 rounded-xl bg-amber-500/10 p-3 shadow-lg backdrop-blur-md dark:bg-neutral-900"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-2.5">
          <div class="size-6 flex shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
            ⚡
          </div>
          <div>
            <div class="flex items-center gap-2 text-xs text-neutral-900 font-bold dark:text-neutral-100">
              <span>Circuit Breaker Activated</span>
              <span class="border border-amber-500/30 rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] text-amber-700 font-mono dark:text-amber-300">
                HTTP 429 Quota
              </span>
            </div>
            <p class="mt-0.5 text-xs text-neutral-700 dark:text-neutral-300">
              Primary model quota reached. Seamlessly answered via <strong>{{ defaults.consciousness.fallbackProvider }}</strong> fallback.
            </p>
          </div>
        </div>
        <button type="button" class="text-xs text-neutral-400 hover:text-neutral-200" @click="showSimulatedToast = false">
          ✕
        </button>
      </div>
    </div>

    <!-- Expandable Faculty Configuration Drawer / Modal -->
    <div
      v-if="activeDrawerFaculty"
      class="border border-cyan-500/30 rounded-2xl bg-white p-5 shadow-xl transition-all space-y-4 dark:border-cyan-400/30 dark:bg-neutral-950"
    >
      <!-- Drawer Header with Active Companion Breadcrumb -->
      <div class="flex flex-col gap-2 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
        <div class="flex items-center gap-2">
          <span class="text-xl">⚙️</span>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm text-neutral-900 font-bold capitalize dark:text-neutral-100">
                {{ activeDrawerFaculty }} Configuration & Failover
              </h3>
              <!-- Active Card Contextual Badge -->
              <span class="border border-neutral-200 rounded px-2 py-0.5 text-[10px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                Active Card ({{ activeCharacterName }}): {{ activeCardOverrideText }}
              </span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">
              Configure primary default engine, automated fallback safety net, and failover trigger rules.
            </p>
          </div>
        </div>
        <button
          type="button"
          class="size-7 flex items-center self-start justify-center rounded-lg bg-neutral-100 text-neutral-500 sm:self-auto dark:bg-neutral-900 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
          @click="closeDrawer"
        >
          ✕
        </button>
      </div>

      <!-- Engine Selectors: Dual Pairs (Primary Pair + Fallback Pair) -->
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <!-- 1. Primary Global Default Engine Pair / Triplet -->
        <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3.5 space-y-2 dark:border-neutral-800/80 dark:bg-neutral-900/40">
          <div class="flex items-center justify-between text-xs text-neutral-800 font-semibold dark:text-neutral-200">
            <span>Primary Global Default Engine</span>
            <span class="text-[10px] text-neutral-400">Used when cards inherit</span>
          </div>

          <!-- If Speech: 3 dropdowns (Provider, Model, Voice) -->
          <div v-if="activeDrawerFaculty === 'speech'" class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase">Provider</label>
              <select
                v-model="tempPrimaryProvider"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <optgroup v-if="recommendedProviders.length > 0" label="Recommended Starters (Free & Local)">
                  <option v-for="p in recommendedProviders" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </optgroup>
                <optgroup v-if="otherProviders.length > 0" label="All Available Providers">
                  <option v-for="p in otherProviders" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase">Model</label>
              <select
                v-if="primaryProviderModels.length > 0"
                v-model="tempPrimaryModel"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option v-for="m in primaryProviderModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
              <input
                v-else
                v-model="tempPrimaryModel"
                type="text"
                placeholder="Model ID (or default)"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
            </div>

            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase">Voice (Default Voice)</label>
              <select
                v-if="primarySpeechVoices.length > 0"
                v-model="tempPrimaryVoiceId"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <optgroup v-for="(vList, gName) in primarySpeechVoiceGroups" :key="gName" :label="gName">
                  <option v-for="v in vList" :key="v.id" :value="v.id">
                    {{ v.name }}
                  </option>
                </optgroup>
              </select>
              <input
                v-else
                v-model="tempPrimaryVoiceId"
                type="text"
                placeholder="Voice ID (e.g. af_heart)"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
            </div>
          </div>

          <!-- Other faculties: 2 dropdowns (Provider, Model) -->
          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase">Provider</label>
              <select
                v-model="tempPrimaryProvider"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <optgroup v-if="recommendedProviders.length > 0" label="Recommended Starters (Free & Local)">
                  <option v-for="p in recommendedProviders" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </optgroup>
                <optgroup v-if="otherProviders.length > 0" label="All Available Providers">
                  <option v-for="p in otherProviders" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase">Model / Preset</label>
              <select
                v-if="primaryProviderModels.length > 0"
                v-model="tempPrimaryModel"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option v-for="m in primaryProviderModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
              <input
                v-else
                v-model="tempPrimaryModel"
                type="text"
                placeholder="Model ID (or leave blank)"
                class="w-full border border-neutral-300 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-neutral-700 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
            </div>
          </div>
        </div>

        <!-- 2. Automated Safety Fallback Engine Pair / Streamlined Single Selector -->
        <div class="border border-cyan-500/30 rounded-xl bg-cyan-500/5 p-3.5 space-y-2 dark:border-cyan-400/30 dark:bg-cyan-400/5">
          <div class="flex items-center justify-between text-xs text-cyan-700 font-semibold dark:text-cyan-300">
            <span>Automated Safety Fallback Engine</span>
            <span class="text-[10px] text-emerald-600 font-mono dark:text-emerald-400">Zero-sign-up safe</span>
          </div>

          <!-- If Speech: Streamlined Single Selector (No 6-dropdown sprawl) -->
          <div v-if="activeDrawerFaculty === 'speech'" class="space-y-2">
            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase dark:text-neutral-400">
                Safety Fallback Engine (1-Click Catch-All)
              </label>
              <select
                v-model="speechFallbackPreset"
                class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option value="web-speech">
                  Web Speech API (Browser Voice · Instant Zero-Download Safety Net)
                </option>
                <option value="kokoro-heart">
                  Kokoro WebGPU af_heart (Local Warm Female Catch-All · 82MB)
                </option>
                <option value="pocket-anna">
                  Pocket-TTS anna (Local Multilingual CPU Catch-All · ~100MB)
                </option>
                <option value="mute">
                  Mute / Silent (speech-noop)
                </option>
                <option value="custom">
                  Custom Provider / Model / Voice...
                </option>
              </select>
            </div>

            <!-- If custom is selected, expand to custom provider/model selects -->
            <div v-if="speechFallbackPreset === 'custom'" class="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase dark:text-neutral-400">Fallback Provider</label>
                <select
                  v-model="tempFallbackProvider"
                  class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  <optgroup v-if="recommendedProviders.length > 0" label="Recommended Fallbacks (Free & Local)">
                    <option v-for="f in recommendedProviders" :key="f.id" :value="f.id">
                      {{ f.name }}
                    </option>
                  </optgroup>
                  <optgroup v-if="otherProviders.length > 0" label="All Available Providers">
                    <option v-for="f in otherProviders" :key="f.id" :value="f.id">
                      {{ f.name }}
                    </option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase dark:text-neutral-400">Fallback Model</label>
                <select
                  v-if="fallbackProviderModels.length > 0"
                  v-model="tempFallbackModel"
                  class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  <option v-for="m in fallbackProviderModels" :key="m.id" :value="m.id">
                    {{ m.name }}
                  </option>
                </select>
                <input
                  v-else
                  v-model="tempFallbackModel"
                  type="text"
                  placeholder="Model ID (or default)"
                  class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
              </div>
            </div>
          </div>

          <!-- Other faculties: 2 dropdowns (Fallback Provider, Fallback Model) -->
          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase dark:text-neutral-400">Fallback Provider</label>
              <select
                v-model="tempFallbackProvider"
                class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <optgroup v-if="recommendedProviders.length > 0" label="Recommended Fallbacks (Free & Local)">
                  <option v-for="f in recommendedProviders" :key="f.id" :value="f.id">
                    {{ f.name }}
                  </option>
                </optgroup>
                <optgroup v-if="otherProviders.length > 0" label="All Available Providers">
                  <option v-for="f in otherProviders" :key="f.id" :value="f.id">
                    {{ f.name }}
                  </option>
                </optgroup>
              </select>
            </div>

            <div>
              <label class="mb-1 block text-[10px] text-neutral-500 font-semibold uppercase dark:text-neutral-400">Fallback Model</label>
              <select
                v-if="fallbackProviderModels.length > 0"
                v-model="tempFallbackModel"
                class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
                <option v-for="m in fallbackProviderModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
              <input
                v-else
                v-model="tempFallbackModel"
                type="text"
                placeholder="Model ID (or default)"
                class="w-full border border-cyan-500/40 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-900 dark:border-cyan-500/40 focus:border-cyan-500 dark:bg-neutral-900 dark:text-neutral-100 focus:outline-none"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Failover Trigger Checklist -->
      <div class="border border-neutral-200/80 rounded-xl bg-neutral-50/50 p-3.5 space-y-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/40">
        <div class="flex items-center justify-between">
          <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">Failover Trigger Conditions</span>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
            <input v-model="tempAutoFailover" type="checkbox" class="rounded text-cyan-500">
            <span>Enable Circuit Breaker</span>
          </label>
        </div>

        <div class="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
          <label class="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="tempTriggers.includes('quota')"
              class="rounded text-cyan-500"
              @change="toggleTrigger('quota')"
            >
            <span>HTTP 429: Rate Limit / Quota Exhaustion</span>
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="tempTriggers.includes('auth')"
              class="rounded text-cyan-500"
              @change="toggleTrigger('auth')"
            >
            <span>HTTP 401/403: Expired / Invalid Key</span>
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="tempTriggers.includes('server_error')"
              class="rounded text-cyan-500"
              @change="toggleTrigger('server_error')"
            >
            <span>HTTP 500/503: Provider Outage</span>
          </label>
          <label class="flex cursor-pointer items-center gap-2 text-neutral-700 dark:text-neutral-300">
            <input
              type="checkbox"
              :checked="tempTriggers.includes('timeout')"
              class="rounded text-cyan-500"
              @change="toggleTrigger('timeout')"
            >
            <span>Network Timeout (>15 seconds)</span>
          </label>
        </div>
      </div>

      <!-- Notification & Recovery -->
      <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">User Notification Style</label>
          <select
            v-model="tempNotificationStyle"
            class="w-full border border-neutral-300 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <option value="toast">
              Subtle Toast ("Switched to fallback")
            </option>
            <option value="badge">
              Inline Badge on Assistant Message
            </option>
            <option value="silent">
              Silent (No visible alert)
            </option>
          </select>
        </div>
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 font-medium dark:text-neutral-400">Automatic Primary Recovery</label>
          <select
            v-model="tempRecoveryInterval"
            class="w-full border border-neutral-300 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <option :value="15">
              Retry Primary every 15 minutes
            </option>
            <option :value="60">
              Retry Primary every 1 hour
            </option>
            <option :value="0">
              Stay on Fallback until manual reset
            </option>
          </select>
        </div>
      </div>

      <!-- Drawer Footer with Playground Bridge Link -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <!-- Left: Playground Bridge Link -->
        <RouterLink
          :to="facultyPlaygroundRoute"
          class="inline-flex items-center gap-1.5 border border-neutral-300 rounded-lg px-3 py-1.5 text-xs text-neutral-700 font-semibold transition-all dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <div class="i-solar:tuning-square-2-bold-duotone size-4 text-cyan-600 dark:text-cyan-400" />
          <span>Open Full {{ activeDrawerFaculty }} Playground →</span>
        </RouterLink>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-700 font-medium dark:bg-neutral-900 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeDrawer"
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-lg bg-cyan-600 px-4 py-1.5 text-xs text-white font-bold dark:bg-cyan-500 hover:bg-cyan-500 dark:text-neutral-950 dark:hover:bg-cyan-400"
            @click="saveDrawer"
          >
            Apply to System
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
