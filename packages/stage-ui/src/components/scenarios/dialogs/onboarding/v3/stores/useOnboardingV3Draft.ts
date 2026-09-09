import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export type OnboardingArchitecture = 'local' | 'cloud'

export type ExperienceArchetypeId = 'quiet' | 'casual' | 'copilot' | 'performer'

export interface ModuleBundleConfig {
  hearing: boolean
  speech: boolean
  thinking: boolean
  emotions: boolean
  artistry: boolean
  sensory: boolean
  memory: boolean
  tools: boolean
}

export interface OnboardingV3DraftState {
  architecture: OnboardingArchitecture
  experienceArchetype: ExperienceArchetypeId
  modules: ModuleBundleConfig
  personaCardId?: string
  personaSource?: 'preset' | 'import'
  importedCardDraft?: any
  vesselDisplayModelId?: string
  userName?: string
  userDescription?: string
  userPrompt?: string
  selectedUserArchetypeId?: string
  companionHonorific?: string
  sttProvider?: string
  sttModel?: string
  sttTriggerKey?: string
  llmProvider?: string
  llmModel?: string
  pacingPreset?: 'disabled' | 'snappy' | 'balanced' | 'deep'
  subconsciousAsides?: boolean
  subconsciousTier1?: boolean
  subconsciousTier2?: boolean
  subconsciousTier3?: boolean
  overrideLimits?: boolean
  contextWidth?: number
  maxTokens?: number
  customProse?: string
  ttsProvider?: string
  ttsModel?: string
  ttsVoiceId?: string
  ttsPitch?: number
  ttsRate?: number
  artistryProvider?: 'pollinations' | 'comfyui' | 'nanobanana' | 'replicate' | 'none'
  artistryModel?: string
  artistryApiKey?: string
  artistryComfyServerUrl?: string
  artistryComfyWorkflow?: string
  artistryVisualPrompt?: string
  artistryDirectorEnabled?: boolean
  artistryDirectorTarget?: 'assistant' | 'user'
  screenWatcherEnabled?: boolean
  screenWatcherMode?: 'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'
  screenWatcherTier?: 'lightweight' | 'moondream'
  screenWatcherInterval?: number
  heartbeatsEnabled?: boolean
  heartbeatsInterval?: number
  operatingScheduleEnabled?: boolean
  wakeUpTime?: string
  bedTime?: string
  pauseOnAfk?: boolean
  afkMinutes?: number
  sensorGroundingEnabled?: boolean
  salienceGatingEnabled?: boolean
  heartbeatsContextWindowHistory?: boolean
  heartbeatsContextSystemLoad?: boolean
  heartbeatsContextUsageMetrics?: boolean
  eventLedgerEnabled?: boolean
  eventLedgerSampleDepth?: number
  eventLedgerDomains?: string[]
  smartSilenceDirectiveEnabled?: boolean
  memoryShortTermEnabled?: boolean
  memoryLongTermJournalEnabled?: boolean
  memoryDreamStateEnabled?: boolean
  mcpWebSearchEnabled?: boolean
  mcpFilesystemEnabled?: boolean
}

export const ARCHETYPE_MODULE_PRESETS: Record<ExperienceArchetypeId, ModuleBundleConfig> = {
  quiet: {
    hearing: false,
    speech: false,
    thinking: false,
    emotions: false,
    artistry: false,
    sensory: false,
    memory: true,
    tools: false,
  },
  casual: {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: true,
    artistry: false,
    sensory: false,
    memory: true,
    tools: false,
  },
  copilot: {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: false,
    artistry: false,
    sensory: true,
    memory: true,
    tools: true,
  },
  performer: {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: true,
    artistry: true,
    sensory: true,
    memory: true,
    tools: true,
  },
}

export const useOnboardingV3Draft = defineStore('onboarding-v3-draft', () => {
  const state = useLocalStorageManualReset<OnboardingV3DraftState>('onboarding/v3-draft', {
    architecture: 'local',
    experienceArchetype: 'casual',
    modules: {
      hearing: true,
      speech: true,
      thinking: true,
      emotions: true,
      artistry: false,
      sensory: false,
      memory: true,
      tools: false,
    },
    pacingPreset: 'balanced',
    subconsciousAsides: true,
    artistryProvider: 'pollinations',
    artistryModel: '',
    artistryDirectorEnabled: true,
    artistryDirectorTarget: 'assistant',
    screenWatcherEnabled: true,
    screenWatcherMode: 'voice-and-bubble',
    screenWatcherTier: 'lightweight',
    screenWatcherInterval: 2000,
    heartbeatsEnabled: true,
    heartbeatsInterval: 5,
    operatingScheduleEnabled: true,
    wakeUpTime: '09:00',
    bedTime: '22:00',
    pauseOnAfk: true,
    afkMinutes: 5,
    sensorGroundingEnabled: true,
    salienceGatingEnabled: true,
    heartbeatsContextWindowHistory: true,
    heartbeatsContextSystemLoad: true,
    heartbeatsContextUsageMetrics: true,
    eventLedgerEnabled: true,
    eventLedgerSampleDepth: 6,
    eventLedgerDomains: ['vision', 'tools', 'chat', 'memory', 'discord'],
    smartSilenceDirectiveEnabled: true,
    memoryShortTermEnabled: true,
    memoryLongTermJournalEnabled: true,
    memoryDreamStateEnabled: true,
    mcpWebSearchEnabled: false,
    mcpFilesystemEnabled: false,
    personaCardId: 'default',
    personaSource: 'preset',
    sttProvider: 'browser-web-speech-api',
    sttModel: 'onnx-community/whisper-tiny',
    sttTriggerKey: 'Caps',
  })

  // Ensure backwards compatibility and fallback for existing localStorage drafts
  if (!state.value.experienceArchetype) {
    state.value.experienceArchetype = 'casual'
  }
  if (!state.value.modules) {
    state.value.modules = {
      ...ARCHETYPE_MODULE_PRESETS[state.value.experienceArchetype],
    }
  }
  if (!state.value.personaCardId) {
    state.value.personaCardId = 'default'
    state.value.personaSource = 'preset'
  }
  if (!state.value.sttProvider) {
    state.value.sttProvider = 'browser-web-speech-api'
    state.value.sttModel = 'onnx-community/whisper-tiny'
    state.value.sttTriggerKey = 'Caps'
  }

  function setArchitecture(architecture: OnboardingArchitecture) {
    state.value.architecture = architecture
  }

  function setExperienceArchetype(archetype: ExperienceArchetypeId) {
    state.value.experienceArchetype = archetype
    state.value.modules = { ...ARCHETYPE_MODULE_PRESETS[archetype] }
  }

  function toggleModule(key: keyof ModuleBundleConfig, enabled?: boolean) {
    if (!state.value.modules) {
      state.value.modules = {
        ...ARCHETYPE_MODULE_PRESETS[state.value.experienceArchetype || 'casual'],
      }
    }
    state.value.modules[key] = enabled !== undefined ? enabled : !state.value.modules[key]
  }

  function setUserProfile(profile: {
    name?: string
    description?: string
    prompt?: string
    archetypeId?: string
  }) {
    if (profile.name !== undefined)
      state.value.userName = profile.name
    if (profile.description !== undefined)
      state.value.userDescription = profile.description
    if (profile.prompt !== undefined)
      state.value.userPrompt = profile.prompt
    if (profile.archetypeId !== undefined)
      state.value.selectedUserArchetypeId = profile.archetypeId
  }

  function setVessel(displayModelId: string, visualPrompt?: string) {
    state.value.vesselDisplayModelId = displayModelId
    if (visualPrompt !== undefined)
      state.value.artistryVisualPrompt = visualPrompt
  }

  function setPersona(persona: { cardId?: string, source?: 'preset' | 'import', importedCardDraft?: any }) {
    if (persona.cardId !== undefined)
      state.value.personaCardId = persona.cardId
    if (persona.source !== undefined)
      state.value.personaSource = persona.source
    if (persona.importedCardDraft !== undefined)
      state.value.importedCardDraft = persona.importedCardDraft
  }

  function setHearing(hearing: {
    provider?: string
    model?: string
    triggerKey?: string
  }) {
    if (hearing.provider !== undefined)
      state.value.sttProvider = hearing.provider
    if (hearing.model !== undefined)
      state.value.sttModel = hearing.model
    if (hearing.triggerKey !== undefined)
      state.value.sttTriggerKey = hearing.triggerKey
  }

  function setConsciousness(consciousness: {
    provider?: string
    model?: string
  }) {
    if (consciousness.provider !== undefined)
      state.value.llmProvider = consciousness.provider
    if (consciousness.model !== undefined)
      state.value.llmModel = consciousness.model
  }

  function setSpeech(speech: {
    provider?: string
    model?: string
    voiceId?: string
    pitch?: number
    rate?: number
  }) {
    if (speech.provider !== undefined)
      state.value.ttsProvider = speech.provider
    if (speech.model !== undefined)
      state.value.ttsModel = speech.model
    if (speech.voiceId !== undefined)
      state.value.ttsVoiceId = speech.voiceId
    if (speech.pitch !== undefined)
      state.value.ttsPitch = speech.pitch
    if (speech.rate !== undefined)
      state.value.ttsRate = speech.rate
  }

  function setThinking(thinking: {
    pacingPreset?: 'disabled' | 'snappy' | 'balanced' | 'deep'
    subconsciousAsides?: boolean
    subconsciousTier1?: boolean
    subconsciousTier2?: boolean
    subconsciousTier3?: boolean
    overrideLimits?: boolean
    contextWidth?: number
    maxTokens?: number
    customProse?: string
  }) {
    if (thinking.pacingPreset !== undefined)
      state.value.pacingPreset = thinking.pacingPreset
    if (thinking.subconsciousAsides !== undefined)
      state.value.subconsciousAsides = thinking.subconsciousAsides
    if (thinking.subconsciousTier1 !== undefined)
      state.value.subconsciousTier1 = thinking.subconsciousTier1
    if (thinking.subconsciousTier2 !== undefined)
      state.value.subconsciousTier2 = thinking.subconsciousTier2
    if (thinking.subconsciousTier3 !== undefined)
      state.value.subconsciousTier3 = thinking.subconsciousTier3
    if (thinking.overrideLimits !== undefined)
      state.value.overrideLimits = thinking.overrideLimits
    if (thinking.contextWidth !== undefined)
      state.value.contextWidth = thinking.contextWidth
    if (thinking.maxTokens !== undefined)
      state.value.maxTokens = thinking.maxTokens
    if (thinking.customProse !== undefined)
      state.value.customProse = thinking.customProse
  }

  function setArtistry(artistry: {
    provider?: 'pollinations' | 'comfyui' | 'nanobanana' | 'replicate' | 'none'
    model?: string
    apiKey?: string
    comfyServerUrl?: string
    comfyWorkflow?: string
    visualPrompt?: string
    directorEnabled?: boolean
    directorTarget?: 'assistant' | 'user'
  }) {
    if (artistry.provider !== undefined)
      state.value.artistryProvider = artistry.provider
    if (artistry.model !== undefined)
      state.value.artistryModel = artistry.model
    if (artistry.apiKey !== undefined)
      state.value.artistryApiKey = artistry.apiKey
    if (artistry.comfyServerUrl !== undefined)
      state.value.artistryComfyServerUrl = artistry.comfyServerUrl
    if (artistry.comfyWorkflow !== undefined)
      state.value.artistryComfyWorkflow = artistry.comfyWorkflow
    if (artistry.visualPrompt !== undefined)
      state.value.artistryVisualPrompt = artistry.visualPrompt
    if (artistry.directorEnabled !== undefined)
      state.value.artistryDirectorEnabled = artistry.directorEnabled
    if (artistry.directorTarget !== undefined)
      state.value.artistryDirectorTarget = artistry.directorTarget
  }

  function setSensory(sensory: {
    screenWatcherEnabled?: boolean
    screenWatcherMode?: 'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'
    screenWatcherTier?: 'lightweight' | 'moondream'
    screenWatcherInterval?: number
    heartbeatsEnabled?: boolean
    heartbeatsInterval?: number
    operatingScheduleEnabled?: boolean
    wakeUpTime?: string
    bedTime?: string
    pauseOnAfk?: boolean
    afkMinutes?: number
    sensorGroundingEnabled?: boolean
    salienceGatingEnabled?: boolean
    heartbeatsContextWindowHistory?: boolean
    heartbeatsContextSystemLoad?: boolean
    heartbeatsContextUsageMetrics?: boolean
    eventLedgerEnabled?: boolean
    eventLedgerSampleDepth?: number
    eventLedgerDomains?: string[]
    smartSilenceDirectiveEnabled?: boolean
  }) {
    if (sensory.screenWatcherEnabled !== undefined)
      state.value.screenWatcherEnabled = sensory.screenWatcherEnabled
    if (sensory.screenWatcherMode !== undefined)
      state.value.screenWatcherMode = sensory.screenWatcherMode
    if (sensory.screenWatcherTier !== undefined)
      state.value.screenWatcherTier = sensory.screenWatcherTier
    if (sensory.screenWatcherInterval !== undefined)
      state.value.screenWatcherInterval = sensory.screenWatcherInterval
    if (sensory.heartbeatsEnabled !== undefined)
      state.value.heartbeatsEnabled = sensory.heartbeatsEnabled
    if (sensory.heartbeatsInterval !== undefined)
      state.value.heartbeatsInterval = sensory.heartbeatsInterval
    if (sensory.operatingScheduleEnabled !== undefined)
      state.value.operatingScheduleEnabled = sensory.operatingScheduleEnabled
    if (sensory.wakeUpTime !== undefined)
      state.value.wakeUpTime = sensory.wakeUpTime
    if (sensory.bedTime !== undefined)
      state.value.bedTime = sensory.bedTime
    if (sensory.pauseOnAfk !== undefined)
      state.value.pauseOnAfk = sensory.pauseOnAfk
    if (sensory.afkMinutes !== undefined)
      state.value.afkMinutes = sensory.afkMinutes
    if (sensory.sensorGroundingEnabled !== undefined)
      state.value.sensorGroundingEnabled = sensory.sensorGroundingEnabled
    if (sensory.salienceGatingEnabled !== undefined)
      state.value.salienceGatingEnabled = sensory.salienceGatingEnabled
    if (sensory.heartbeatsContextWindowHistory !== undefined)
      state.value.heartbeatsContextWindowHistory = sensory.heartbeatsContextWindowHistory
    if (sensory.heartbeatsContextSystemLoad !== undefined)
      state.value.heartbeatsContextSystemLoad = sensory.heartbeatsContextSystemLoad
    if (sensory.heartbeatsContextUsageMetrics !== undefined)
      state.value.heartbeatsContextUsageMetrics = sensory.heartbeatsContextUsageMetrics
    if (sensory.eventLedgerEnabled !== undefined)
      state.value.eventLedgerEnabled = sensory.eventLedgerEnabled
    if (sensory.eventLedgerSampleDepth !== undefined)
      state.value.eventLedgerSampleDepth = sensory.eventLedgerSampleDepth
    if (sensory.eventLedgerDomains !== undefined)
      state.value.eventLedgerDomains = sensory.eventLedgerDomains
    if (sensory.smartSilenceDirectiveEnabled !== undefined)
      state.value.smartSilenceDirectiveEnabled = sensory.smartSilenceDirectiveEnabled
  }

  function reset() {
    state.reset()
  }

  return {
    state,
    setArchitecture,
    setExperienceArchetype,
    toggleModule,
    setUserProfile,
    setVessel,
    setPersona,
    setHearing,
    setConsciousness,
    setSpeech,
    setThinking,
    setArtistry,
    setSensory,
    reset,
  }
})
