import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { BracketAction, VoiceInfo, VoiceProfile } from '../providers'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { generateSpeech } from '@xsai/generate-speech'
import { defineStore, storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { toXml } from 'xast-util-to-xml'
import { x } from 'xastscript'

import { useOnboardingStore } from '../onboarding'
import { useProactivityStore } from '../proactivity'
import { useProvidersStore } from '../providers'

export function toSignedPercent(value: number): string {
  if (value > 0)
    return `+${value}%`
  if (value < 0)
    return `-${Math.abs(value)}%`
  return '0%'
}

export const useSpeechStore = defineStore('speech', () => {
  const providersStore = useProvidersStore()
  const onboardingStore = useOnboardingStore()
  const { allAudioSpeechProvidersMetadata } = storeToRefs(providersStore)

  // State
  const activeSpeechProvider = useLocalStorageManualReset<string>('settings/speech/active-provider', 'speech-noop')
  const activeSpeechModel = useLocalStorageManualReset<string>('settings/speech/active-model', '')
  const activeSpeechVoiceId = useLocalStorageManualReset<string>('settings/speech/voice', '')
  const activeSpeechVoice = refManualReset<VoiceInfo | undefined>(undefined)

  const pitch = useLocalStorageManualReset<number>('settings/speech/pitch', 0)
  const rate = useLocalStorageManualReset<number>('settings/speech/rate', 1)
  const ssmlEnabled = useLocalStorageManualReset<boolean>('settings/speech/ssml-enabled', false)
  const isLoadingSpeechProviderVoices = refManualReset<boolean>(false)
  const speechProviderError = refManualReset<string | null>(null)
  const availableVoices = refManualReset<Record<string, VoiceInfo[]>>({})
  const selectedLanguage = useLocalStorageManualReset<string>('settings/speech/language', 'en-US')
  const modelSearchQuery = refManualReset<string>('')

  // Virtual Voice Profiles State
  const savedVoiceProfiles = useLocalStorageManualReset<VoiceProfile[]>('settings/speech/voice-profiles', [])

  // Computed properties
  const availableSpeechProvidersMetadata = computed(() => allAudioSpeechProvidersMetadata.value)

  // Computed properties
  const supportsModelListing = computed(() => {
    return providersStore.getProviderMetadata(activeSpeechProvider.value)?.capabilities.listModels !== undefined
  })

  const providerModels = computed(() => {
    return providersStore.getModelsForProvider(activeSpeechProvider.value)
  })

  const isLoadingActiveProviderModels = computed(() => {
    return providersStore.isLoadingModels[activeSpeechProvider.value] || false
  })

  const activeProviderModelError = computed(() => {
    return providersStore.modelLoadError[activeSpeechProvider.value] || null
  })

  const filteredModels = computed(() => {
    if (!modelSearchQuery.value.trim()) {
      return providerModels.value
    }

    const query = modelSearchQuery.value.toLowerCase().trim()
    return providerModels.value.filter(model =>
      model.name.toLowerCase().includes(query)
      || model.id.toLowerCase().includes(query)
      || (model.description && model.description.toLowerCase().includes(query)),
    )
  })

  const supportsSSML = computed(() => {
    // Check provider metadata first
    const metadata = providersStore.getProviderMetadata(activeSpeechProvider.value)
    if (metadata?.capabilities.supportsSSML !== undefined) {
      return metadata.capabilities.supportsSSML
    }

    // Legacy fallback/overrides
    if (activeSpeechProvider.value === 'alibaba-cloud-model-studio' && activeSpeechModel.value === 'cosyvoice-v2') {
      return true
    }
    return ['elevenlabs', 'microsoft-speech', 'azure-speech'].includes(activeSpeechProvider.value)
  })

  const supportsPitch = computed(() => {
    const metadata = providersStore.getProviderMetadata(activeSpeechProvider.value)
    if (metadata?.capabilities.supportsPitch !== undefined) {
      return metadata.capabilities.supportsPitch
    }
    // Default to true for backward compatibility with unspecified providers if needed,
    // but per requirements we want to be explicit.
    return false
  })

  async function loadVoicesForProvider(provider: string) {
    if (!provider) {
      return []
    }

    isLoadingSpeechProviderVoices.value = true
    speechProviderError.value = null

    try {
      const config = providersStore.getProviderConfig(provider)
      const metadata = providersStore.getProviderMetadata(provider)

      // Only attempt to fetch voices if the provider is actually configured
      if (metadata.validators?.validateProviderConfig) {
        const validation = await metadata.validators.validateProviderConfig(config)
        if (!validation.valid) {
          console.warn(`[Speech] Skipping voice fetch for unconfigured provider: ${provider}`)
          return []
        }
      }

      const voices = await metadata.capabilities.listVoices?.(config) || []
      // Reassign to trigger reactivity when adding/updating provider entries
      availableVoices.value = {
        ...availableVoices.value,
        [provider]: voices,
      }
      return voices
    }
    catch (error) {
      console.error(`Error fetching voices for ${provider}:`, error)
      speechProviderError.value = error instanceof Error ? error.message : 'Unknown error'
      return []
    }
    finally {
      isLoadingSpeechProviderVoices.value = false
    }
  }

  // Get voices for a specific provider
  function getVoicesForProvider(provider: string) {
    return availableVoices.value[provider] || []
  }

  // Watch for provider changes and load voices/models
  watch(activeSpeechProvider, async (newProvider) => {
    if (newProvider) {
      await Promise.all([
        loadVoicesForProvider(newProvider),
        providersStore.fetchModelsForProvider(newProvider),
      ])
      // Don't reset voice settings when changing providers to allow for persistence
    }
  }, { immediate: true })

  // Self-healing: Reset active provider if it no longer exists
  const selfHealProvider = () => {
    // Bypass self-healing during onboarding
    if (onboardingStore.needsOnboarding)
      return

    const providerId = activeSpeechProvider.value
    if (providerId === 'speech-noop')
      return

    const metadataLoaded = Object.keys(providersStore.providerMetadata).length > 0

    // Only reset if metadata is loaded and the provider actually doesn't exist in metadata
    if (metadataLoaded && !providersStore.providerMetadata[providerId]) {
      activeSpeechProvider.value = 'speech-noop'
      activeSpeechModel.value = ''
      activeSpeechVoiceId.value = ''
      activeSpeechVoice.value = undefined
    }
  }

  watch(activeSpeechProvider, selfHealProvider, { immediate: true })
  watch(() => providersStore.providerMetadata, selfHealProvider, { deep: true })

  if (!activeSpeechProvider.value) {
    activeSpeechProvider.value = 'speech-noop'
  }

  onMounted(() => {
    loadVoicesForProvider(activeSpeechProvider.value).then(() => {
      if (activeSpeechVoiceId.value) {
        activeSpeechVoice.value = availableVoices.value[activeSpeechProvider.value]?.find(voice => voice.id === activeSpeechVoiceId.value)
      }
    })
  })

  const updateActiveVoice = () => {
    const voiceId = activeSpeechVoiceId.value
    const voices = availableVoices.value
    if (voiceId) {
      // For OpenAI Compatible, create a custom voice object if no voices were discovered
      if (activeSpeechProvider.value === 'openai-compatible-audio-speech') {
        const foundVoice = voices[activeSpeechProvider.value]?.find(voice => voice.id === voiceId)
        if (foundVoice) {
          activeSpeechVoice.value = foundVoice
        }
        else {
          activeSpeechVoice.value = {
            id: voiceId,
            name: voiceId,
            description: voiceId,
            previewURL: '',
            languages: [{ code: 'en', title: 'English' }],
            provider: activeSpeechProvider.value,
            gender: 'neutral',
          }
        }
      }
      else {
        // For other providers, find voice in available voices
        const foundVoice = voices[activeSpeechProvider.value]?.find(voice => voice.id === voiceId)
        // Only update if we found a voice, or if activeSpeechVoice is not set
        if (foundVoice || !activeSpeechVoice.value) {
          activeSpeechVoice.value = foundVoice
        }
      }
    }
  }

  watch(activeSpeechVoiceId, updateActiveVoice, { immediate: true })
  watch(availableVoices, updateActiveVoice, { deep: true })

  /**
   * Transforms text before sending to TTS provider
   */
  function transformTextForSpeech(text: string, providerId: string, voiceProfileId?: string): string {
    if (providerId === 'chatterbox') {
      return text
    }

    const isVirtual = providerId === 'virtual-audio-studio' || !!voiceProfileId
    const targetVoiceId = voiceProfileId || activeSpeechVoiceId.value
    const profile = isVirtual ? savedVoiceProfiles.value.find(p => p.id === targetVoiceId) : null

    if (!profile || !profile.ust.enabled) {
      return text
    }

    // Strip markdown image embeds (e.g., ![caption](url)) so they are not sent to the TTS
    let transformed = text.replace(/!\[.*?\]\(.*?\)/g, '')

    // 1. Resolve bracket action behaviors (supporting fallback/auto-migration of older profiles)
    let asterisks = profile.ust.asterisks
    let squareBrackets = profile.ust.squareBrackets
    let parentheses = profile.ust.parentheses
    let angleBrackets = profile.ust.angleBrackets
    const customBracketEnabled = profile.ust.customBracketEnabled
    const customBracketStart = profile.ust.customBracketStart || ''
    const customBracketEnd = profile.ust.customBracketEnd || ''
    const customBracketAction = profile.ust.customBracketAction || 'ignore'

    if (!asterisks && !squareBrackets && !parentheses && !angleBrackets) {
      const legacyMode = profile.ust.mode || 'mute'
      if (legacyMode === 'mute') {
        asterisks = 'mute'
        squareBrackets = 'mute'
        parentheses = 'mute'
        angleBrackets = 'mute'
      }
      else if (legacyMode === 'flatten') {
        asterisks = 'flatten'
        squareBrackets = 'flatten'
        parentheses = 'flatten'
        angleBrackets = 'flatten'
      }
      else {
        asterisks = 'ignore'
        squareBrackets = 'ignore'
        parentheses = 'ignore'
        angleBrackets = 'ignore'
      }
    }

    // Helper to process a bracket type
    const processBracket = (input: string, start: string, end: string, action: BracketAction): string => {
      if (action === 'ignore' || !start || !end) {
        return input
      }

      const escStart = start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escEnd = end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      if (action === 'mute') {
        const regex = new RegExp(`${escStart}.*?${escEnd}`, 'g')
        let result = input.replace(regex, '')
        const boundaryRegex = new RegExp(`[${escStart}${escEnd}]`, 'g')
        result = result.replace(boundaryRegex, '')
        return result
      }
      else if (action === 'flatten') {
        const boundaryRegex = new RegExp(`[${escStart}${escEnd}]`, 'g')
        return input.replace(boundaryRegex, '')
      }
      else if (action === 'token') {
        const regex = new RegExp(`${escStart}(.*?)${escEnd}`, 'g')
        return input.replace(regex, '<|$1|>')
      }

      return input
    }

    // 2. Process bracket modes
    transformed = processBracket(transformed, '*', '*', asterisks)
    transformed = processBracket(transformed, '[', ']', squareBrackets)
    transformed = processBracket(transformed, '(', ')', parentheses)
    transformed = processBracket(transformed, '<', '>', angleBrackets)

    // Process custom bracket if enabled
    if (customBracketEnabled) {
      transformed = processBracket(transformed, customBracketStart, customBracketEnd, customBracketAction)
    }

    // Legacy custom strip character fallback (if profile has customStripChars and was in custom mode)
    if (profile.ust.mode === 'custom' && profile.ust.customStripChars) {
      const escapedChars = profile.ust.customStripChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (escapedChars) {
        const regex = new RegExp(`[${escapedChars}]`, 'g')
        transformed = transformed.replace(regex, '')
      }
    }

    // 3. Strip Emojis
    if (profile.ust.stripEmojis) {
      transformed = transformed.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      transformed = transformed.replace(/\u200D/g, '')
    }

    // 4. Strip Symbols & Kaomoji (Extreme Cleaning)
    if (profile.ust.stripSymbols) {
      transformed = transformed.replace(/[^\p{L}\p{N}\s.,!?;:"'-]/gu, '')
    }

    // 5. Tilde substitution
    if (profile.ust.tildeReplacement !== undefined) {
      const replacement = profile.ust.tildeReplacement.trim()
      if (replacement) {
        transformed = transformed.replace(/~/g, ` ${replacement} `)
      }
      else {
        transformed = transformed.replace(/~/g, '')
      }
    }

    // 6. Custom Replacement Rules
    if (profile.ust.customReplacements && Array.isArray(profile.ust.customReplacements)) {
      for (const rule of profile.ust.customReplacements) {
        if (!rule.pattern)
          continue
        try {
          if (rule.type === 'regex') {
            let pattern = rule.pattern
            let flags = ''
            if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
              const lastSlash = pattern.lastIndexOf('/')
              flags = pattern.slice(lastSlash + 1)
              pattern = pattern.slice(1, lastSlash)
            }
            const regex = new RegExp(pattern, flags)
            transformed = transformed.replace(regex, rule.replacement)
          }
          else {
            const escPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const flags = rule.caseSensitive ? 'g' : 'gi'
            const regexStr = rule.wholeWord ? `\\b${escPattern}\\b` : escPattern
            const regex = new RegExp(regexStr, flags)
            transformed = transformed.replace(regex, rule.replacement)
          }
        }
        catch (err) {
          console.error('Failed to apply custom replacement rule:', rule, err)
        }
      }
    }

    return transformed.replace(/\s+/g, ' ').trim()
  }

  /**
   * Generate speech using the specified provider and settings
   *
   * @param provider The speech provider instance
   * @param model The model to use
   * @param input The text input to convert to speech
   * @param voice The voice ID to use
   * @param providerConfig Additional provider configuration
   * @returns ArrayBuffer containing the audio data
   */
  async function speech(
    provider: SpeechProviderWithExtraOptions<string, any>,
    model: string,
    input: string,
    voice: string,
    providerConfig: Record<string, any> = {},
  ): Promise<ArrayBuffer> {
    const profile = savedVoiceProfiles.value.find(p => p.id === voice)

    let targetProvider = provider
    let targetModel = model
    let targetVoice = voice
    let targetConfig = providerConfig
    let transformedInput = input

    if (profile) {
      const rawProvider = await providersStore.getProviderInstance(profile.baseProvider)
      if (rawProvider) {
        targetProvider = rawProvider as any
        targetModel = profile.baseModel || (providersStore.getProviderConfig(profile.baseProvider)?.model as string) || ''
        targetVoice = profile.baseVoice
        targetConfig = profile.effects
        transformedInput = transformTextForSpeech(input, 'virtual-audio-studio', profile.id)
      }
      else {
        transformedInput = transformTextForSpeech(input, activeSpeechProvider.value)
      }
    }
    else {
      transformedInput = transformTextForSpeech(input, activeSpeechProvider.value)
    }

    // Bail if transformer emptied the text
    if (!transformedInput.trim()) {
      return new ArrayBuffer(0)
    }

    const response = await generateSpeech({
      ...targetProvider.speech(targetModel, {
        ...targetConfig,
      }),
      input: transformedInput,
      voice: targetVoice,
    })

    const proactivityStore = useProactivityStore()
    proactivityStore.incrementMetric('tts')

    return response
  }

  function generateSSML(
    text: string,
    voice: VoiceInfo,
    providerConfig?: Record<string, any>,
  ): string {
    const pitch = providerConfig?.pitch
    const speed = providerConfig?.speed
    const volume = providerConfig?.volume

    const prosody = {
      pitch: pitch != null
        ? toSignedPercent(pitch)
        : undefined,
      rate: speed != null
        ? speed !== 1.0
          ? `${speed}`
          : '1'
        : undefined,
      volume: volume != null
        ? toSignedPercent(volume)
        : undefined,
    }

    const hasProsody = Object.values(prosody).some(value => value != null)

    const ssmlXast = x('speak', { 'version': '1.0', 'xmlns': 'http://www.w3.org/2001/10/synthesis', 'xml:lang': voice.languages[0]?.code || 'en-US' }, [
      x('voice', { name: voice.id, gender: voice.gender || 'neutral' }, [
        hasProsody
          ? x('prosody', {
              pitch: prosody.pitch,
              rate: prosody.rate,
              volume: prosody.volume,
            }, [
              text,
            ])
          : text,
      ]),
    ])

    return toXml(ssmlXast)
  }

  const configured = computed(() => {
    if (activeSpeechProvider.value === 'speech-noop')
      return false

    if (!activeSpeechProvider.value)
      return false

    let hasModel = !!activeSpeechModel.value
    let hasVoice = !!activeSpeechVoiceId.value

    // For OpenAI Compatible providers, check provider config as fallback
    if (activeSpeechProvider.value === 'openai-compatible-audio-speech') {
      const providerConfig = providersStore.getProviderConfig(activeSpeechProvider.value)
      hasModel ||= !!providerConfig?.model
      hasVoice ||= !!providerConfig?.voice
    }

    return hasModel && hasVoice
  })

  function resetState() {
    activeSpeechProvider.reset()
    activeSpeechModel.reset()
    activeSpeechVoiceId.reset()
    activeSpeechVoice.reset()
    pitch.reset()
    rate.reset()
    savedVoiceProfiles.reset()
    ssmlEnabled.reset()
    selectedLanguage.reset()
    modelSearchQuery.reset()

    availableVoices.reset()
    speechProviderError.reset()
    isLoadingSpeechProviderVoices.reset()
  }

  function saveVoiceProfile(profile: VoiceProfile) {
    const index = savedVoiceProfiles.value.findIndex(p => p.id === profile.id)
    if (index !== -1) {
      savedVoiceProfiles.value[index] = profile
    }
    else {
      savedVoiceProfiles.value.push(profile)
    }
    if (activeSpeechProvider.value === 'virtual-audio-studio') {
      void loadVoicesForProvider('virtual-audio-studio')
    }
  }

  function deleteVoiceProfile(id: string) {
    savedVoiceProfiles.value = savedVoiceProfiles.value.filter(p => p.id !== id)
    if (activeSpeechVoiceId.value === id) {
      activeSpeechVoiceId.value = ''
      activeSpeechVoice.value = undefined
    }
    if (activeSpeechProvider.value === 'virtual-audio-studio') {
      void loadVoicesForProvider('virtual-audio-studio')
    }
  }

  return {
    // State
    configured,
    activeSpeechProvider,
    activeSpeechModel,
    activeSpeechVoice,
    activeSpeechVoiceId,
    pitch,
    rate,
    ssmlEnabled,
    selectedLanguage,
    isLoadingSpeechProviderVoices,
    speechProviderError,
    availableVoices,
    modelSearchQuery,

    savedVoiceProfiles,

    // Computed
    availableSpeechProvidersMetadata,
    supportsSSML,
    supportsPitch,
    supportsModelListing,
    providerModels,
    isLoadingActiveProviderModels,
    activeProviderModelError,
    filteredModels,

    // Actions
    speech,
    loadVoicesForProvider,
    getVoicesForProvider,
    generateSSML,
    transformTextForSpeech,
    saveVoiceProfile,
    deleteVoiceProfile,
    resetState,
  }
})
