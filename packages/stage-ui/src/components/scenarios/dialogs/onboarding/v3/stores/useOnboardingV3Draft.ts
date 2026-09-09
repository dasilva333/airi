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
  llmProvider?: string
  llmModel?: string
  pacingPreset?: 'snappy' | 'balanced' | 'deep'
  subconsciousAsides?: boolean
  ttsProvider?: string
  ttsVoiceId?: string
  artistryProvider?: 'pollinations' | 'comfyui' | 'none'
  artistryVisualPrompt?: string
  artistryDirectorEnabled?: boolean
  screenWatcherEnabled?: boolean
  screenWatcherMode?: 'voice-and-bubble' | 'bubble-only' | 'voice-only' | 'muted'
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
    artistryDirectorEnabled: true,
    screenWatcherEnabled: true,
    screenWatcherMode: 'voice-and-bubble',
    memoryShortTermEnabled: true,
    memoryLongTermJournalEnabled: true,
    memoryDreamStateEnabled: true,
    mcpWebSearchEnabled: false,
    mcpFilesystemEnabled: false,
    personaCardId: 'default',
    personaSource: 'preset',
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
    reset,
  }
})
