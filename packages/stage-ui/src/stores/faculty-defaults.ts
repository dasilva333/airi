import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export type FacultyName = 'consciousness' | 'speech' | 'hearing' | 'artistry' | 'vision'

export type FailoverTrigger = 'auth' | 'quota' | 'server_error' | 'timeout'

export interface FacultyConfig {
  primaryProvider: string
  primaryModel: string
  primaryVoiceId?: string
  fallbackProvider: string
  fallbackModel: string
  fallbackVoiceId?: string
  autoFailover: boolean
  failoverTriggers: FailoverTrigger[]
  notificationStyle: 'toast' | 'badge' | 'silent'
  recoveryIntervalMinutes: number
}

export interface GlobalFacultyDefaultsState {
  consciousness: FacultyConfig
  speech: FacultyConfig
  hearing: FacultyConfig
  artistry: FacultyConfig
  vision: FacultyConfig
}

export const FACTORY_SAFE_DEFAULTS: GlobalFacultyDefaultsState = {
  consciousness: {
    primaryProvider: 'mimo',
    primaryModel: 'mimo-auto',
    fallbackProvider: 'web-llm',
    fallbackModel: '',
    autoFailover: true,
    failoverTriggers: ['auth', 'quota', 'server_error', 'timeout'],
    notificationStyle: 'toast',
    recoveryIntervalMinutes: 15,
  },
  speech: {
    primaryProvider: 'kokoro-local',
    primaryModel: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    primaryVoiceId: 'af_heart', // Warm, conversational general female catch-all voice
    fallbackProvider: 'web-speech-api',
    fallbackModel: '',
    fallbackVoiceId: '',
    autoFailover: true,
    failoverTriggers: ['server_error', 'timeout'],
    notificationStyle: 'toast',
    recoveryIntervalMinutes: 0,
  },
  hearing: {
    primaryProvider: 'whisper-local',
    primaryModel: 'onnx-community/whisper-tiny',
    fallbackProvider: 'web-speech-api',
    fallbackModel: '',
    autoFailover: true,
    failoverTriggers: ['server_error', 'timeout'],
    notificationStyle: 'toast',
    recoveryIntervalMinutes: 0,
  },
  artistry: {
    primaryProvider: 'pollinations',
    primaryModel: '', // Free Auto Router (no &model= param, 100% free zero-key unauthenticated tier)
    fallbackProvider: 'comfyui',
    fallbackModel: '',
    autoFailover: true,
    failoverTriggers: ['server_error', 'timeout'],
    notificationStyle: 'toast',
    recoveryIntervalMinutes: 15,
  },
  vision: {
    primaryProvider: 'moondream-local',
    primaryModel: 'Xenova/moondream2',
    fallbackProvider: '',
    fallbackModel: '',
    autoFailover: false,
    failoverTriggers: [],
    notificationStyle: 'toast',
    recoveryIntervalMinutes: 0,
  },
}

// NOTICE: Earlier defaults saved `openai/whisper-*` ids. The local Whisper worker loads the id as a
// Hugging Face repo and only the `onnx-community/whisper-*` repos ship ONNX weights.
function migrateWhisperModelId(model: string): string {
  return model.replace(/^("?)openai\/whisper-(tiny|base|small)("?)$/, '$1onnx-community/whisper-$2$3')
}

function getInitialStateWithMigration(): GlobalFacultyDefaultsState {
  const base = JSON.parse(JSON.stringify(FACTORY_SAFE_DEFAULTS)) as GlobalFacultyDefaultsState

  if (typeof window === 'undefined')
    return base

  try {
    const activeHearingModel = window.localStorage.getItem('settings/hearing/active-model')
    if (activeHearingModel && migrateWhisperModelId(activeHearingModel) !== activeHearingModel)
      window.localStorage.setItem('settings/hearing/active-model', migrateWhisperModelId(activeHearingModel))

    const existing = window.localStorage.getItem('settings/faculties/defaults')
    if (existing) {
      const parsed = JSON.parse(existing)
      const hearing = { ...base.hearing, ...parsed.hearing }
      return {
        consciousness: { ...base.consciousness, ...parsed.consciousness },
        speech: { ...base.speech, ...parsed.speech },
        hearing: {
          ...hearing,
          primaryModel: migrateWhisperModelId(hearing.primaryModel),
          fallbackModel: migrateWhisperModelId(hearing.fallbackModel),
        },
        artistry: { ...base.artistry, ...parsed.artistry },
        vision: { ...base.vision, ...parsed.vision },
      }
    }

    // Migrate from legacy individual localStorage keys if present
    const legacyConsciousnessProvider = window.localStorage.getItem('settings/consciousness/active-provider')
    const legacyConsciousnessModel = window.localStorage.getItem('settings/consciousness/active-model')
    if (legacyConsciousnessProvider && legacyConsciousnessProvider !== '""') {
      base.consciousness.primaryProvider = legacyConsciousnessProvider.replace(/^"|"$/g, '')
      if (legacyConsciousnessModel)
        base.consciousness.primaryModel = legacyConsciousnessModel.replace(/^"|"$/g, '')
    }

    const legacySpeechProvider = window.localStorage.getItem('settings/speech/active-provider')
    const legacySpeechModel = window.localStorage.getItem('settings/speech/active-model')
    const legacySpeechVoice = window.localStorage.getItem('settings/speech/voice')
    if (legacySpeechProvider && legacySpeechProvider !== '""' && !legacySpeechProvider.includes('speech-noop')) {
      base.speech.primaryProvider = legacySpeechProvider.replace(/^"|"$/g, '')
      if (legacySpeechModel)
        base.speech.primaryModel = legacySpeechModel.replace(/^"|"$/g, '')
      if (legacySpeechVoice && legacySpeechVoice !== '""')
        base.speech.primaryVoiceId = legacySpeechVoice.replace(/^"|"$/g, '')
    }

    const legacyHearingProvider = window.localStorage.getItem('settings/hearing/active-provider')
    const legacyHearingModel = window.localStorage.getItem('settings/hearing/active-model')
    if (legacyHearingProvider && legacyHearingProvider !== '""') {
      base.hearing.primaryProvider = legacyHearingProvider.replace(/^"|"$/g, '')
      if (legacyHearingModel)
        base.hearing.primaryModel = legacyHearingModel.replace(/^"|"$/g, '')
    }

    const legacyArtistryProvider = window.localStorage.getItem('artistry-provider')
    const legacyArtistryModel = window.localStorage.getItem('artistry-model')
    if (legacyArtistryProvider && legacyArtistryProvider !== '""' && !legacyArtistryProvider.includes('comfyui')) {
      base.artistry.primaryProvider = legacyArtistryProvider.replace(/^"|"$/g, '')
      if (legacyArtistryModel)
        base.artistry.primaryModel = legacyArtistryModel.replace(/^"|"$/g, '')
    }

    const legacyVisionProvider = window.localStorage.getItem('settings/vision/active-provider')
    const legacyVisionModel = window.localStorage.getItem('settings/vision/active-model')
    if (legacyVisionProvider && legacyVisionProvider !== '""') {
      base.vision.primaryProvider = legacyVisionProvider.replace(/^"|"$/g, '')
      if (legacyVisionModel)
        base.vision.primaryModel = legacyVisionModel.replace(/^"|"$/g, '')
    }
  }
  catch (e) {
    console.warn('[FacultyDefaults] Failed to migrate legacy faculty settings:', e)
  }

  return base
}

export const useFacultyDefaultsStore = defineStore('faculty-defaults', () => {
  const defaults = useLocalStorageManualReset<GlobalFacultyDefaultsState>(
    'settings/faculties/defaults',
    getInitialStateWithMigration(),
  )

  const consciousness = computed(() => defaults.value.consciousness)
  const speech = computed(() => defaults.value.speech)
  const hearing = computed(() => defaults.value.hearing)
  const artistry = computed(() => defaults.value.artistry)
  const vision = computed(() => defaults.value.vision)

  const isGlobalCircuitBreakerEnabled = computed(() => {
    return defaults.value.consciousness.autoFailover
      || defaults.value.speech.autoFailover
      || defaults.value.hearing.autoFailover
      || defaults.value.artistry.autoFailover
  })

  function syncLegacyKeys(faculty: FacultyName, provider: string, model: string, voiceId?: string) {
    if (typeof window === 'undefined')
      return

    try {
      if (faculty === 'consciousness') {
        window.localStorage.setItem('settings/consciousness/active-provider', JSON.stringify(provider))
        window.localStorage.setItem('settings/consciousness/active-model', JSON.stringify(model))
      }
      else if (faculty === 'speech') {
        window.localStorage.setItem('settings/speech/active-provider', JSON.stringify(provider))
        window.localStorage.setItem('settings/speech/active-model', JSON.stringify(model))
        if (voiceId)
          window.localStorage.setItem('settings/speech/voice', JSON.stringify(voiceId))
      }
      else if (faculty === 'hearing') {
        window.localStorage.setItem('settings/hearing/active-provider', JSON.stringify(provider))
        window.localStorage.setItem('settings/hearing/active-model', JSON.stringify(model))
      }
      else if (faculty === 'artistry') {
        window.localStorage.setItem('artistry-provider', JSON.stringify(provider))
        window.localStorage.setItem('artistry-model', JSON.stringify(model))
      }
      else if (faculty === 'vision') {
        window.localStorage.setItem('settings/vision/active-provider', provider)
        window.localStorage.setItem('settings/vision/active-model', model)
      }
    }
    catch {}
  }

  function setPrimary(faculty: FacultyName, provider: string, model: string, voiceId?: string) {
    if (!defaults.value[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: {
        ...defaults.value[faculty],
        primaryProvider: provider,
        primaryModel: model,
        ...(voiceId !== undefined ? { primaryVoiceId: voiceId } : {}),
      },
    }
    syncLegacyKeys(faculty, provider, model, voiceId)
  }

  function setFallback(faculty: FacultyName, provider: string, model: string, voiceId?: string) {
    if (!defaults.value[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: {
        ...defaults.value[faculty],
        fallbackProvider: provider,
        fallbackModel: model,
        ...(voiceId !== undefined ? { fallbackVoiceId: voiceId } : {}),
      },
    }
  }

  function setCircuitBreaker(
    faculty: FacultyName,
    autoFailover: boolean,
    triggers?: FailoverTrigger[],
  ) {
    if (!defaults.value[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: {
        ...defaults.value[faculty],
        autoFailover,
        ...(triggers ? { failoverTriggers: triggers } : {}),
      },
    }
  }

  function setNotificationStyle(faculty: FacultyName, style: 'toast' | 'badge' | 'silent') {
    if (!defaults.value[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: {
        ...defaults.value[faculty],
        notificationStyle: style,
      },
    }
  }

  function setRecoveryInterval(faculty: FacultyName, minutes: number) {
    if (!defaults.value[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: {
        ...defaults.value[faculty],
        recoveryIntervalMinutes: minutes,
      },
    }
  }

  function resetToFactorySafe() {
    defaults.value = JSON.parse(JSON.stringify(FACTORY_SAFE_DEFAULTS))
    for (const faculty of Object.keys(FACTORY_SAFE_DEFAULTS) as FacultyName[]) {
      syncLegacyKeys(
        faculty,
        FACTORY_SAFE_DEFAULTS[faculty].primaryProvider,
        FACTORY_SAFE_DEFAULTS[faculty].primaryModel,
      )
    }
  }

  function resetFaculty(faculty: FacultyName) {
    if (!FACTORY_SAFE_DEFAULTS[faculty])
      return

    defaults.value = {
      ...defaults.value,
      [faculty]: { ...FACTORY_SAFE_DEFAULTS[faculty] },
    }
    syncLegacyKeys(
      faculty,
      FACTORY_SAFE_DEFAULTS[faculty].primaryProvider,
      FACTORY_SAFE_DEFAULTS[faculty].primaryModel,
    )
  }

  function resolveFaculty(
    faculty: FacultyName,
    cardOverride?: { provider?: string, model?: string, voiceId?: string },
  ): { provider: string, model: string, voiceId?: string, isFallback: boolean } {
    const cardProvider = cardOverride?.provider?.trim()
    const cardModel = cardOverride?.model?.trim()
    const cardVoiceId = cardOverride?.voiceId?.trim()

    if (cardProvider && cardProvider !== 'inherit' && cardProvider !== 'default') {
      return {
        provider: cardProvider,
        model: cardModel || '',
        voiceId: cardVoiceId,
        isFallback: false,
      }
    }

    const conf = defaults.value[faculty] || FACTORY_SAFE_DEFAULTS[faculty]
    return {
      provider: conf.primaryProvider,
      model: conf.primaryModel,
      voiceId: conf.primaryVoiceId,
      isFallback: false,
    }
  }

  return {
    defaults,
    consciousness,
    speech,
    hearing,
    artistry,
    vision,
    isGlobalCircuitBreakerEnabled,
    setPrimary,
    setFallback,
    setCircuitBreaker,
    setNotificationStyle,
    setRecoveryInterval,
    resetToFactorySafe,
    resetFaculty,
    resolveFaculty,
  }
})
