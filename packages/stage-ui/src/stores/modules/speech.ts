import type { SpeechProviderWithExtraOptions } from '@xsai-ext/providers/utils'

import type { BracketAction, VoiceInfo, VoiceProfile } from '../providers'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { refManualReset } from '@vueuse/core'
import { generateSpeech } from '@xsai/generate-speech'
import { defineStore, storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { toXml } from 'xast-util-to-xml'
import { x } from 'xastscript'

import { speechAudioCache } from '../../services/speech/audio-cache'
import {
  braceBareScripts,
  detectSpeechLanguage,
  findBareLatex,
  replaceBalancedCommand,
  speakMath,
  toSpeechLanguage,
} from '../../utils/math-speech'
import { verbalizeWebAddressesAndLinks } from '../../utils/web-address-speech'
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

export function integerToWords(num: number): string {
  if (num === 0)
    return 'zero'
  if (num < 0)
    return `minus ${integerToWords(Math.abs(num))}`

  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  function convertThreeDigits(n: number): string {
    let str = ''
    if (n >= 100) {
      str += `${ones[Math.floor(n / 100)]} hundred`
      n %= 100
      if (n > 0)
        str += ' '
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)]
      n %= 10
      if (n > 0)
        str += `-${ones[n]}`
    }
    else if (n > 0) {
      str += ones[n]
    }
    return str
  }

  let words = ''
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000)
    words += `${convertThreeDigits(thousands)} thousand`
    num %= 1000
    if (num > 0)
      words += ' '
  }
  if (num > 0) {
    words += convertThreeDigits(num)
  }
  return words
}

export function verbalizePrices(text: string, _language = 'en'): string {
  // Matches dollar amounts like $19.99, $1,200.50, $5, $0.50
  const priceRegex = /\$(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?(?=$|[\s,.;:!?)\]])/g
  return text.replace(priceRegex, (_, dollarsStr, centsStr) => {
    const dollars = Number.parseInt(dollarsStr.replace(/,/g, ''), 10)
    if (Number.isNaN(dollars))
      return _

    const dollarsWord = integerToWords(dollars)
    const dollarUnit = dollars === 1 ? 'dollar' : 'dollars'

    if (centsStr !== undefined) {
      const paddedCents = centsStr.length === 1 ? `${centsStr}0` : centsStr
      const cents = Number.parseInt(paddedCents, 10)
      if (cents > 0) {
        const centsWord = integerToWords(cents)
        const centUnit = cents === 1 ? 'cent' : 'cents'
        if (dollars === 0)
          return `${centsWord} ${centUnit}`
        return `${dollarsWord} ${dollarUnit} and ${centsWord} ${centUnit}`
      }
    }

    return `${dollarsWord} ${dollarUnit}`
  })
}

export interface PlaygroundPreset {
  id: string
  label: string
  text: string
}

export const PLAYGROUND_PRESETS: PlaygroundPreset[] = [
  {
    id: 'everyday',
    label: 'Everyday dialogue',
    text: '*smiles* Your total is $19.99 😊\nLet\'s try a softer voice.',
  },
  {
    id: 'math',
    label: 'Technical & math',
    text: 'The solution to $x^2 + y^2 = z^2$ is simple, and costs $4.50.',
  },
  {
    id: 'chemistry',
    label: 'Chemical reactions',
    text: 'When \\ce{H2O} reacts with \\ce{CO2}, carbonic acid forms.',
  },
  {
    id: 'roleplay',
    label: 'Roleplay & stage directions',
    text: '*giggles softly* [happy] (whispering in your ear) <aside> Are you ready? ~nyan~',
  },
  {
    id: 'code',
    label: 'Code & markdown',
    text: 'Here is how to run it:\n```bash\npnpm dev\n```\nIt costs $0.00 to try.',
  },
]

export function applyUSTTransformations(text: string, ust?: VoiceProfile['ust'], language?: string): string {
  if (!ust || !ust.enabled)
    return text

  // Strip markdown image embeds (e.g., ![caption](url)) so they are not sent to the TTS
  let transformed = text.replace(/!\[.*?\]\(.*?\)/g, '')

  // 0. Markdown & Speech Sanitization (UST V2 & V3)
  // Code blocks handling (defaults to mute)
  const codeBlockAction = ust.codeBlocks ?? (ust.stripCodeBlocks !== false ? 'mute' : 'passThrough')
  if (codeBlockAction === 'mute') {
    transformed = transformed.replace(/```[\s\S]*?```/g, '')
  }

  // Strip raw HTML tags (e.g., <div>, <br/>) if enabled (default true)
  if (ust.stripHtml !== false) {
    transformed = transformed.replace(/<\/?[a-z][^>]*>/gi, '')
  }

  // Process markdown links [label](url) according to preserveMarkdownLinks setting (default 'extract_text')
  const preserveMarkdownLinks = ust.preserveMarkdownLinks ?? 'extract_text'
  if (preserveMarkdownLinks === 'extract_text') {
    transformed = transformed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  }
  else if (preserveMarkdownLinks === 'mute') {
    transformed = transformed.replace(/\[([^\]]+)\]\([^)]+\)/g, '')
  }

  // Normalize markdown block boundaries (headers, quotes, lists) into natural line pauses (default true)
  if (ust.normalizeBlockPauses !== false) {
    transformed = transformed.replace(/^#{1,6}\s+/gm, '')
    transformed = transformed.replace(/^>\s+/gm, '')
    transformed = transformed.replace(/^[-*+]\s+/gm, '')
    transformed = transformed.replace(/^\d+\.\s+/gm, '')
  }

  // Resolve formula verbalization base language
  const baseLanguage = ust.formulaLanguage && ust.formulaLanguage !== 'auto'
    ? ust.formulaLanguage
    : detectSpeechLanguage(text, toSpeechLanguage(language) || 'en')

  // Chemical notation handling (mute vs verbalize vs passThrough)
  const chemAction = ust.chemicalNotation ?? 'passThrough'
  if (chemAction === 'mute') {
    transformed = replaceBalancedCommand(transformed, 'ce', () => '')
  }
  else if (chemAction === 'verbalize') {
    transformed = replaceBalancedCommand(transformed, 'ce', (fullMatch) => {
      const spoken = speakMath(fullMatch, baseLanguage)
      return spoken ? ` ${spoken.trim()} ` : ''
    })
  }

  // Currency verbalization
  if (ust.readCurrencyNaturally !== false) {
    transformed = verbalizePrices(transformed, baseLanguage)
  }

  // Web addresses, file paths, and Obsidian wiki-links (PR #3332 / UST V3)
  if (ust.readWebAddressesNaturally !== false) {
    transformed = verbalizeWebAddressesAndLinks(transformed, baseLanguage)
  }

  // Math formulas handling (mute vs verbalize vs passThrough)
  const mathAction = ust.mathFormulas ?? 'passThrough'
  if (mathAction === 'mute') {
    transformed = transformed.replace(/\$\$[\s\S]*?\$\$/g, '')
    transformed = transformed.replace(/\\\[[\s\S]*?\\\]/g, '')
    transformed = transformed.replace(/\\\([\s\S]*?\\\)/g, '')
    transformed = transformed.replace(/(?<!\\|\$)\$((?!\s)(?:\\\$|[^$])+(?<!\s))\$(?!\$)/g, (match, inner) => {
      return /^\d+(?:\.\d+)?$/.test(inner.trim()) ? match : ''
    })
  }
  else if (mathAction === 'verbalize') {
    // 1. Display math: $$...$$
    transformed = transformed.replace(/\$\$([\s\S]*?)\$\$/g, (_, inner) => {
      const spoken = speakMath(inner.trim(), baseLanguage)
      return spoken ? ` ${spoken.trim()} ` : ''
    })
    // 2. Display math: \[...\]
    transformed = transformed.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => {
      const spoken = speakMath(inner.trim(), baseLanguage)
      return spoken ? ` ${spoken.trim()} ` : ''
    })
    // 3. Inline math: \(...\)
    transformed = transformed.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => {
      const spoken = speakMath(inner.trim(), baseLanguage)
      return spoken ? ` ${spoken.trim()} ` : ''
    })
    // 4. Inline math: $...$
    transformed = transformed.replace(/(?<!\\|\$)\$((?!\s)(?:\\\$|[^$])+(?<!\s))\$(?!\$)/g, (fullMatch, inner) => {
      if (/^\d+(?:\.\d+)?$/.test(inner.trim()))
        return fullMatch
      const spoken = speakMath(inner.trim(), baseLanguage)
      return spoken ? ` ${spoken.trim()} ` : ''
    })
    // 5. Bare LaTeX commands (e.g. \frac{1}{2}, \alpha = \beta)
    const bareSpans = findBareLatex(transformed)
    if (bareSpans.length > 0) {
      let result = ''
      let lastIndex = 0
      for (const span of bareSpans) {
        result += transformed.slice(lastIndex, span.start)
        const bareFormula = braceBareScripts(transformed.slice(span.start, span.end))
        const spoken = speakMath(bareFormula, baseLanguage)
        result += spoken ? ` ${spoken.trim()} ` : ''
        lastIndex = span.end
      }
      result += transformed.slice(lastIndex)
      transformed = result
    }
  }

  // Protect arithmetic operators (e.g., 2 * 3, 2**10, x**2) from bracket muting/flattening
  const mathPlaceholders: string[] = []
  if (ust.preserveMathOperators !== false) {
    transformed = transformed.replace(/(?<=\d)\s*\*{2}\s*(?=\d)|(?<=\b\w+)\s+\*{2}\s+(?=\w+\b)|(?<=\b[a-z]\b)\*{2}(?=\d+\b)/gi, (match) => {
      const id = `__UST_MATH_EXP_${mathPlaceholders.length}__`
      mathPlaceholders.push(match)
      return id
    })
    transformed = transformed.replace(/(?<=\d)\s*\*\s*(?=\d)|(?<=\b\w+)\s+\*\s+(?=\w+\b)/g, (match) => {
      const id = `__UST_MATH_MUL_${mathPlaceholders.length}__`
      mathPlaceholders.push(match)
      return id
    })
  }

  // 1. Resolve bracket action behaviors (supporting fallback/auto-migration of older profiles)
  let asterisks = ust.asterisks
  let squareBrackets = ust.squareBrackets
  let parentheses = ust.parentheses
  let angleBrackets = ust.angleBrackets
  const customBracketEnabled = ust.customBracketEnabled
  const customBracketStart = ust.customBracketStart || ''
  const customBracketEnd = ust.customBracketEnd || ''
  const customBracketAction = ust.customBracketAction || 'passThrough'

  if (!asterisks && !squareBrackets && !parentheses && !angleBrackets) {
    const legacyMode = ust.mode || 'mute'
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
      asterisks = 'passThrough'
      squareBrackets = 'passThrough'
      parentheses = 'passThrough'
      angleBrackets = 'passThrough'
    }
  }

  // Helper to process a bracket type
  const tokenPlaceholders: string[] = []
  const processBracket = (input: string, start: string, end: string, action: BracketAction): string => {
    if (action === 'ignore' || action === 'passThrough' || !start || !end) {
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
      return input.replace(regex, (_, content) => {
        const id = `__UST_TOKEN_${tokenPlaceholders.length}__`
        tokenPlaceholders.push(`<|${content}|>`)
        return id
      })
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

  // Legacy custom strip character fallback
  if (ust.mode === 'custom' && ust.customStripChars) {
    const escapedChars = ust.customStripChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (escapedChars) {
      const regex = new RegExp(`[${escapedChars}]`, 'g')
      transformed = transformed.replace(regex, '')
    }
  }

  // 3. Strip Emojis
  if (ust.stripEmojis) {
    transformed = transformed.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    transformed = transformed.replace(/\u200D/g, '')
  }

  // 4. Strip Symbols & Kaomoji (Extreme Cleaning)
  if (ust.stripSymbols) {
    transformed = transformed.replace(/[^\p{L}\p{N}\s.,!?;:"'-]/gu, '')
  }

  // Restore protected arithmetic operators
  if (mathPlaceholders.length > 0) {
    for (let i = 0; i < mathPlaceholders.length; i++) {
      transformed = transformed.replace(new RegExp(`__UST_MATH_(?:EXP|MUL)_${i}__`, 'g'), mathPlaceholders[i])
    }
  }

  // Restore protected tokens
  if (tokenPlaceholders.length > 0) {
    for (let i = 0; i < tokenPlaceholders.length; i++) {
      transformed = transformed.replace(new RegExp(`__UST_TOKEN_${i}__`, 'g'), tokenPlaceholders[i])
    }
  }

  // 5. Tilde substitution
  if (ust.tildeReplacement !== undefined) {
    const replacement = ust.tildeReplacement.trim()
    if (replacement) {
      transformed = transformed.replace(/~/g, ` ${replacement} `)
    }
    else {
      transformed = transformed.replace(/~/g, '')
    }
  }

  // 6. Custom Replacement Rules
  if (ust.customReplacements && Array.isArray(ust.customReplacements)) {
    for (const rule of ust.customReplacements) {
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

  return transformed
    .split('\n')
    .map(line => line.replace(/[^\S\r\n]+/g, ' ').trim())
    .filter((line, i, arr) => line.length > 0 || (i > 0 && arr[i - 1].length > 0))
    .join('\n')
    .trim()
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
  const outputVolume = useLocalStorageManualReset<number>('settings/speech/output-volume', 1.0)
  const speechEnabled = useLocalStorageManualReset<boolean>('settings/speech/enabled', true)
  const ssmlEnabled = useLocalStorageManualReset<boolean>('settings/speech/ssml-enabled', false)
  const isLoadingSpeechProviderVoices = refManualReset<boolean>(false)
  const speechProviderError = refManualReset<string | null>(null)
  const availableVoices = refManualReset<Record<string, VoiceInfo[]>>({})
  const selectedLanguage = useLocalStorageManualReset<string>('settings/speech/language', 'en-US')
  const modelSearchQuery = refManualReset<string>('')

  // Virtual Voice Profiles State
  const savedVoiceProfiles = useLocalStorageManualReset<VoiceProfile[]>('settings/speech/voice-profiles', [])

  // Playground state for Audio Studio
  const playgroundTestText = useLocalStorageManualReset<string>(
    'settings/speech/playground-test-text',
    PLAYGROUND_PRESETS[0]?.text || '*smiles* Your total is $19.99 😊\nLet\'s try a softer voice.',
  )
  const playgroundPreset = refManualReset<string>('everyday')

  function previewTransformText(text: string, ust?: VoiceProfile['ust'], language?: string): string {
    return applyUSTTransformations(text, ust, ust?.formulaLanguage || language || selectedLanguage.value)
  }

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
  watch(activeSpeechProvider, async (newProvider, oldProvider) => {
    if (newProvider && oldProvider !== undefined && newProvider !== oldProvider) {
      await Promise.all([
        loadVoicesForProvider(newProvider),
        providersStore.fetchModelsForProvider(newProvider),
      ])
      // Don't reset voice settings when changing providers to allow for persistence
    }
  })

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
    const baseId = providerId.includes(':') ? providerId.split(':')[0] : providerId
    if (metadataLoaded && !providersStore.providerMetadata[baseId]) {
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
    if (providerId === 'chatterbox' || providerId === 'airi-audio-server') {
      return text
    }

    const isVirtual = providerId === 'virtual-audio-studio' || !!voiceProfileId
    const targetVoiceId = voiceProfileId || activeSpeechVoiceId.value
    let profile = isVirtual ? savedVoiceProfiles.value.find(p => p.id === targetVoiceId || p.name === targetVoiceId) : null

    // If no virtual profile matched, check if any saved profile matches the active voice ID and provider
    if (!profile && savedVoiceProfiles.value.length > 0) {
      profile = savedVoiceProfiles.value.find(p => p.baseVoice === activeSpeechVoiceId.value && p.baseProvider === activeSpeechProvider.value) || null
    }

    if (!profile || !profile.ust.enabled) {
      return text
    }

    const targetLang = profile.ust.formulaLanguage && profile.ust.formulaLanguage !== 'auto'
      ? profile.ust.formulaLanguage
      : (activeSpeechVoice.value?.languages[0]?.code || selectedLanguage.value)

    return applyUSTTransformations(text, profile.ust, targetLang)
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
    const profile = savedVoiceProfiles.value.find(p => p.id === voice || p.name === voice)

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
      if (model === 'virtual' || (targetProvider as any)?.speech?.('virtual')?.baseURL?.includes('virtual-audio-studio')) {
        const fallbackProviderId = activeSpeechProvider.value !== 'virtual-audio-studio' && activeSpeechProvider.value !== 'speech-noop'
          ? activeSpeechProvider.value
          : 'pocket-tts-local'
        const rawFallback = await providersStore.getProviderInstance(fallbackProviderId)
        if (rawFallback) {
          targetProvider = rawFallback as any
          targetModel = activeSpeechModel.value || (providersStore.getProviderConfig(fallbackProviderId)?.model as string) || 'english_2026-04'
        }
      }
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
    outputVolume,
    speechEnabled,
    ssmlEnabled,
    selectedLanguage,
    isLoadingSpeechProviderVoices,
    speechProviderError,
    availableVoices,
    modelSearchQuery,

    savedVoiceProfiles,
    playgroundTestText,
    playgroundPreset,

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
    previewTransformText,
    applyUSTTransformations,
    saveVoiceProfile,
    deleteVoiceProfile,
    resetState,
    audioCache: speechAudioCache,
  }
})
