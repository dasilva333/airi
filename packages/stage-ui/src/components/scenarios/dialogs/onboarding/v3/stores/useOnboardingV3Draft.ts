import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

export type OnboardingArchitecture = 'local' | 'cloud'

export type ExperienceArchetypeId = 'quiet' | 'casual' | 'muse' | 'copilot' | 'roommate' | 'swiss-army' | 'performer'

export interface ModuleBundleConfig {
  hearing: boolean
  speech: boolean
  thinking: boolean
  emotions: boolean
  memory: boolean
  vision: boolean
  screen: boolean
  proactivity: boolean
  artistry: boolean
  tools: boolean
  sensory?: boolean
}

export interface StoryProposalItem {
  id: string
  title: string
  greeting: string
  scenario: string
}

export interface OnboardingV3DraftState {
  architecture: OnboardingArchitecture
  experienceArchetype: ExperienceArchetypeId
  modules: ModuleBundleConfig
  personaCardId?: string
  personaSource?: 'preset' | 'import' | 'creator'
  importedCardDraft?: any
  customCharacterAvatarUrl?: string
  customCharacterTags?: string[]
  customCharacterSeries?: string
  customCharacterTrope?: string
  customCharacterGuidance?: string
  customCharacterProposals?: StoryProposalItem[]
  selectedProposalId?: string
  customCharacterCardBundle?: any
  customCharacterProposal?: any
  vesselDisplayModelId?: string
  userName?: string
  userDescription?: string
  userPrompt?: string
  userGender?: 'male' | 'female' | 'non-binary'
  selectedUserArchetypeId?: string
  companionName?: string
  companionHonorific?: string
  sttProvider?: string
  sttModel?: string
  sttTriggerKey?: string
  llmProvider?: string
  llmModel?: string
  llmApiKey?: string
  llmBaseUrl?: string
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
  visionProvider?: string
  visionModel?: string
  visionStrategy?: 'direct' | 'forward'
  visionPromptShimDirect?: string
  visionPromptShimForward?: string
  artistryProvider?: 'pollinations' | 'comfyui' | 'nanobanana' | 'replicate' | 'none'
  artistryModel?: string
  artistryApiKey?: string
  artistryComfyServerUrl?: string
  artistryComfyWorkflow?: string
  artistryVisualPrompt?: string
  artistryDirectorEnabled?: boolean
  artistryDirectorTarget?: 'assistant' | 'user'
  artistryImageJournalToolEnabled?: boolean
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
  memoryShortTermWindowSize?: number
  memoryShortTermTokenBudget?: number
  memoryLongTermJournalEnabled?: boolean
  memoryLifetimeEnabled?: boolean
  memoryLifetimeTier?: 'lightweight' | 'relational' | 'deep'
  memoryDreamStateEnabled?: boolean
  mcpWebSearchEnabled?: boolean
  mcpFilesystemEnabled?: boolean
  toolMotionGeneratorEnabled?: boolean
  emotionsCurated?: boolean
  expressionMappings?: Record<string, string>
  actingModelExpressionPrompt?: string
  previewStrength?: number
}

export const ARCHETYPE_MODULE_PRESETS: Record<ExperienceArchetypeId, ModuleBundleConfig> = {
  'quiet': {
    hearing: false,
    speech: false,
    thinking: true,
    emotions: true,
    memory: true,
    vision: false,
    screen: false,
    proactivity: false,
    artistry: false,
    tools: false,
  },
  'casual': {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: true,
    memory: true,
    vision: true,
    screen: false,
    proactivity: false,
    artistry: false,
    tools: false,
  },
  'muse': {
    hearing: false,
    speech: true,
    thinking: true,
    emotions: true,
    memory: true,
    vision: true,
    screen: false,
    proactivity: false,
    artistry: true,
    tools: false,
  },
  'copilot': {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: false,
    memory: true,
    vision: false,
    screen: true,
    proactivity: false,
    artistry: false,
    tools: true,
  },
  'roommate': {
    hearing: false,
    speech: true,
    thinking: true,
    emotions: true,
    memory: true,
    vision: false,
    screen: true,
    proactivity: true,
    artistry: false,
    tools: false,
  },
  'swiss-army': {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: true,
    memory: true,
    vision: true,
    screen: true,
    proactivity: true,
    artistry: true,
    tools: true,
  },
  'performer': {
    hearing: true,
    speech: true,
    thinking: true,
    emotions: true,
    memory: true,
    vision: true,
    screen: true,
    proactivity: true,
    artistry: true,
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
      memory: true,
      vision: true,
      screen: false,
      proactivity: false,
      artistry: false,
      tools: false,
    },
    userGender: 'male',
    pacingPreset: 'balanced',
    subconsciousAsides: true,
    visionProvider: '',
    visionModel: '',
    visionStrategy: 'direct',
    visionPromptShimDirect: 'You are currently acting as a vision-capable stand-in for the main character. Keep your responses natural, in-character, and avoid any meta-commentary about "analyzing" or "describing" the image for the user. Just react to what you see as the character would.',
    visionPromptShimForward: 'You are an objective image analysis model. Analyze the provided image in the context of the conversation and the user\'s latest message. Describe the key visual details, subjects, actions, colors, text, or any specific elements mentioned or asked about by the user, so that the primary chat LLM can respond appropriately. Keep your analysis descriptive and objective, and avoid any conversational filler.',
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
    memoryShortTermWindowSize: 3,
    memoryShortTermTokenBudget: 1000,
    memoryLongTermJournalEnabled: true,
    memoryLifetimeEnabled: true,
    memoryLifetimeTier: 'relational',
    memoryDreamStateEnabled: true,
    mcpWebSearchEnabled: false,
    mcpFilesystemEnabled: false,
    toolMotionGeneratorEnabled: false,
    artistryImageJournalToolEnabled: false,
    personaCardId: 'default',
    personaSource: 'preset',
    sttProvider: 'whisper-local',
    sttModel: 'onnx-community/whisper-tiny',
    sttTriggerKey: 'Caps',
    ttsProvider: 'kokoro-local',
    ttsModel: 'q4',
    ttsVoiceId: 'af_bella',
  })

  // Ensure backwards compatibility and fallback for existing localStorage drafts
  if (!state.value.experienceArchetype) {
    state.value.experienceArchetype = 'casual'
  }
  if (state.value.experienceArchetype === 'performer') {
    state.value.experienceArchetype = 'swiss-army'
  }
  if (!state.value.modules) {
    state.value.modules = {
      ...ARCHETYPE_MODULE_PRESETS[state.value.experienceArchetype],
    }
  }
  else {
    if (state.value.modules.screen === undefined) {
      state.value.modules.screen = Boolean(state.value.modules.sensory)
    }
    if (state.value.modules.proactivity === undefined) {
      state.value.modules.proactivity = Boolean(state.value.modules.sensory)
    }
    if (state.value.modules.vision === undefined) {
      state.value.modules.vision = ['casual', 'muse', 'swiss-army', 'performer'].includes(state.value.experienceArchetype)
    }
  }
  if (!state.value.personaCardId) {
    state.value.personaCardId = 'default'
    state.value.personaSource = 'preset'
  }
  if (!state.value.sttProvider) {
    state.value.sttProvider = 'whisper-local'
    state.value.sttModel = 'onnx-community/whisper-tiny'
    state.value.sttTriggerKey = 'Caps'
  }
  if (!state.value.ttsProvider) {
    state.value.ttsProvider = 'kokoro-local'
    state.value.ttsModel = 'q4'
    state.value.ttsVoiceId = 'af_bella'
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
    userName?: string
    description?: string
    prompt?: string
    gender?: 'male' | 'female' | 'non-binary'
    userGender?: 'male' | 'female' | 'non-binary'
    archetypeId?: string
    companionName?: string
    companionHonorific?: string
  }) {
    if (profile.name !== undefined)
      state.value.userName = profile.name
    if (profile.userName !== undefined)
      state.value.userName = profile.userName
    if (profile.description !== undefined)
      state.value.userDescription = profile.description
    if (profile.prompt !== undefined)
      state.value.userPrompt = profile.prompt
    if (profile.gender !== undefined)
      state.value.userGender = profile.gender
    if (profile.userGender !== undefined)
      state.value.userGender = profile.userGender
    if (profile.archetypeId !== undefined)
      state.value.selectedUserArchetypeId = profile.archetypeId
    if (profile.companionName !== undefined)
      state.value.companionName = profile.companionName
    if (profile.companionHonorific !== undefined)
      state.value.companionHonorific = profile.companionHonorific
  }

  function setVessel(displayModelId: string, visualPrompt?: string) {
    state.value.vesselDisplayModelId = displayModelId
    if (visualPrompt !== undefined)
      state.value.artistryVisualPrompt = visualPrompt
  }

  function setPersona(persona: {
    cardId?: string
    source?: 'preset' | 'import' | 'creator'
    importedCardDraft?: any
  }) {
    if (persona.cardId !== undefined)
      state.value.personaCardId = persona.cardId
    if (persona.source !== undefined)
      state.value.personaSource = persona.source
    if (persona.importedCardDraft !== undefined)
      state.value.importedCardDraft = persona.importedCardDraft
  }

  function setCustomCharacterCreator(creator: {
    avatarUrl?: string
    tags?: string[]
    series?: string
    trope?: string
    guidance?: string
    proposals?: StoryProposalItem[]
    selectedProposalId?: string
    cardBundle?: any
    proposal?: any
  }) {
    if (creator.avatarUrl !== undefined)
      state.value.customCharacterAvatarUrl = creator.avatarUrl
    if (creator.tags !== undefined)
      state.value.customCharacterTags = creator.tags
    if (creator.series !== undefined)
      state.value.customCharacterSeries = creator.series
    if (creator.trope !== undefined)
      state.value.customCharacterTrope = creator.trope
    if (creator.guidance !== undefined)
      state.value.customCharacterGuidance = creator.guidance
    if (creator.proposals !== undefined)
      state.value.customCharacterProposals = creator.proposals
    if (creator.selectedProposalId !== undefined)
      state.value.selectedProposalId = creator.selectedProposalId
    if (creator.cardBundle !== undefined)
      state.value.customCharacterCardBundle = creator.cardBundle
    if (creator.proposal !== undefined)
      state.value.customCharacterProposal = creator.proposal
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
    apiKey?: string
    baseUrl?: string
  }) {
    if (consciousness.provider !== undefined)
      state.value.llmProvider = consciousness.provider
    if (consciousness.model !== undefined)
      state.value.llmModel = consciousness.model
    if (consciousness.apiKey !== undefined)
      state.value.llmApiKey = consciousness.apiKey
    if (consciousness.baseUrl !== undefined)
      state.value.llmBaseUrl = consciousness.baseUrl
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
    imageJournalToolEnabled?: boolean
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
    if (artistry.imageJournalToolEnabled !== undefined)
      state.value.artistryImageJournalToolEnabled = artistry.imageJournalToolEnabled
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

  function setVision(vision: {
    provider?: string
    model?: string
    strategy?: 'direct' | 'forward'
    promptShimDirect?: string
    promptShimForward?: string
  }) {
    if (vision.provider !== undefined)
      state.value.visionProvider = vision.provider
    if (vision.model !== undefined)
      state.value.visionModel = vision.model
    if (vision.strategy !== undefined)
      state.value.visionStrategy = vision.strategy
    if (vision.promptShimDirect !== undefined)
      state.value.visionPromptShimDirect = vision.promptShimDirect
    if (vision.promptShimForward !== undefined)
      state.value.visionPromptShimForward = vision.promptShimForward
  }

  function setScreen(screen: {
    screenWatcherEnabled?: boolean
    screenWatcherMode?: 'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'
    screenWatcherTier?: 'lightweight' | 'moondream'
    screenWatcherInterval?: number
  }) {
    if (screen.screenWatcherEnabled !== undefined)
      state.value.screenWatcherEnabled = screen.screenWatcherEnabled
    if (screen.screenWatcherMode !== undefined)
      state.value.screenWatcherMode = screen.screenWatcherMode
    if (screen.screenWatcherTier !== undefined)
      state.value.screenWatcherTier = screen.screenWatcherTier
    if (screen.screenWatcherInterval !== undefined)
      state.value.screenWatcherInterval = screen.screenWatcherInterval
  }

  function setProactivity(proactivity: {
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
    if (proactivity.heartbeatsEnabled !== undefined)
      state.value.heartbeatsEnabled = proactivity.heartbeatsEnabled
    if (proactivity.heartbeatsInterval !== undefined)
      state.value.heartbeatsInterval = proactivity.heartbeatsInterval
    if (proactivity.operatingScheduleEnabled !== undefined)
      state.value.operatingScheduleEnabled = proactivity.operatingScheduleEnabled
    if (proactivity.wakeUpTime !== undefined)
      state.value.wakeUpTime = proactivity.wakeUpTime
    if (proactivity.bedTime !== undefined)
      state.value.bedTime = proactivity.bedTime
    if (proactivity.pauseOnAfk !== undefined)
      state.value.pauseOnAfk = proactivity.pauseOnAfk
    if (proactivity.afkMinutes !== undefined)
      state.value.afkMinutes = proactivity.afkMinutes
    if (proactivity.sensorGroundingEnabled !== undefined)
      state.value.sensorGroundingEnabled = proactivity.sensorGroundingEnabled
    if (proactivity.salienceGatingEnabled !== undefined)
      state.value.salienceGatingEnabled = proactivity.salienceGatingEnabled
    if (proactivity.heartbeatsContextWindowHistory !== undefined)
      state.value.heartbeatsContextWindowHistory = proactivity.heartbeatsContextWindowHistory
    if (proactivity.heartbeatsContextSystemLoad !== undefined)
      state.value.heartbeatsContextSystemLoad = proactivity.heartbeatsContextSystemLoad
    if (proactivity.heartbeatsContextUsageMetrics !== undefined)
      state.value.heartbeatsContextUsageMetrics = proactivity.heartbeatsContextUsageMetrics
    if (proactivity.eventLedgerEnabled !== undefined)
      state.value.eventLedgerEnabled = proactivity.eventLedgerEnabled
    if (proactivity.eventLedgerSampleDepth !== undefined)
      state.value.eventLedgerSampleDepth = proactivity.eventLedgerSampleDepth
    if (proactivity.eventLedgerDomains !== undefined)
      state.value.eventLedgerDomains = proactivity.eventLedgerDomains
    if (proactivity.smartSilenceDirectiveEnabled !== undefined)
      state.value.smartSilenceDirectiveEnabled = proactivity.smartSilenceDirectiveEnabled
  }

  function setMemory(memory: {
    shortTermEnabled?: boolean
    shortTermWindowSize?: number
    shortTermTokenBudget?: number
    longTermJournalEnabled?: boolean
    lifetimeEnabled?: boolean
    lifetimeTier?: 'lightweight' | 'relational' | 'deep'
    dreamStateEnabled?: boolean
  }) {
    if (memory.shortTermEnabled !== undefined)
      state.value.memoryShortTermEnabled = memory.shortTermEnabled
    if (memory.shortTermWindowSize !== undefined)
      state.value.memoryShortTermWindowSize = memory.shortTermWindowSize
    if (memory.shortTermTokenBudget !== undefined)
      state.value.memoryShortTermTokenBudget = memory.shortTermTokenBudget
    if (memory.longTermJournalEnabled !== undefined)
      state.value.memoryLongTermJournalEnabled = memory.longTermJournalEnabled
    if (memory.lifetimeEnabled !== undefined)
      state.value.memoryLifetimeEnabled = memory.lifetimeEnabled
    if (memory.lifetimeTier !== undefined)
      state.value.memoryLifetimeTier = memory.lifetimeTier
    if (memory.dreamStateEnabled !== undefined)
      state.value.memoryDreamStateEnabled = memory.dreamStateEnabled
  }

  function setTools(tools: {
    mcpWebSearchEnabled?: boolean
    mcpFilesystemEnabled?: boolean
    toolMotionGeneratorEnabled?: boolean
  }) {
    if (tools.mcpWebSearchEnabled !== undefined)
      state.value.mcpWebSearchEnabled = tools.mcpWebSearchEnabled
    if (tools.mcpFilesystemEnabled !== undefined)
      state.value.mcpFilesystemEnabled = tools.mcpFilesystemEnabled
    if (tools.toolMotionGeneratorEnabled !== undefined)
      state.value.toolMotionGeneratorEnabled = tools.toolMotionGeneratorEnabled
  }

  function setEmotions(emotions: {
    emotionsCurated?: boolean
    expressionMappings?: Record<string, string>
    actingModelExpressionPrompt?: string
    previewStrength?: number
  }) {
    if (emotions.emotionsCurated !== undefined)
      state.value.emotionsCurated = emotions.emotionsCurated
    if (emotions.expressionMappings !== undefined)
      state.value.expressionMappings = emotions.expressionMappings
    if (emotions.actingModelExpressionPrompt !== undefined)
      state.value.actingModelExpressionPrompt = emotions.actingModelExpressionPrompt
    if (emotions.previewStrength !== undefined)
      state.value.previewStrength = emotions.previewStrength
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
    setCustomCharacterCreator,
    setHearing,
    setConsciousness,
    setSpeech,
    setThinking,
    setEmotions,
    setArtistry,
    setSensory,
    setVision,
    setScreen,
    setProactivity,
    setMemory,
    setTools,
    reset,
  }
})
