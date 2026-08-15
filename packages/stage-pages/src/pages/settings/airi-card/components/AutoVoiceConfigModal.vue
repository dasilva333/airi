<script setup lang="ts">
import { useIdleAnimations } from '@proj-airi/stage-ui/composables'
import { voicePresets } from '@proj-airi/stage-ui/constants/voices'
import { useLLM } from '@proj-airi/stage-ui/stores/llm'
import { useConsciousnessStore } from '@proj-airi/stage-ui/stores/modules/consciousness'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { Button } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface Character {
  id: string
  name: string
  trigger: string
  copyrightIndex: number
  tags: string
  traits: [number, number, number, number]
}

interface Props {
  modelValue: boolean
  selectedCharacters: Character[]
  copyrights: string[]
  genders: string[]
  boundModels: Record<string, string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'apply', payload: Record<string, { baseProvider: string, baseModel: string, baseVoice: string, idleAnimations?: string[] }>): void
}>()

const llmStore = useLLM()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const consciousnessStore = useConsciousnessStore()

const state = ref<'idle' | 'loading' | 'results' | 'error'>('idle')
const errorMessage = ref('')

const deepgramVoicePresets = [
  { id: 'aura-2-amalthea-en', name: 'Amalthea', gender: 'Female', accent: 'PH', description: 'Young Adult, Filipino, Cheerful, engaging and natural.' },
  { id: 'aura-2-andromeda-en', name: 'Andromeda', gender: 'Female', accent: 'US', description: 'Adult, American, Casual, expressive.' },
  { id: 'aura-2-apollo-en', name: 'Apollo', gender: 'Male', accent: 'US', description: 'Adult, American, Confident, comfortable.' },
  { id: 'aura-2-arcas-en', name: 'Arcas', gender: 'Male', accent: 'US', description: 'Adult, American, Natural, smooth, clear.' },
  { id: 'aura-2-aries-en', name: 'Aries', gender: 'Male', accent: 'US', description: 'Adult, American, Warm, energetic, caring.' },
  { id: 'aura-2-asteria-en', name: 'Asteria', gender: 'Female', accent: 'US', description: 'Adult, American, Clear, confident, energetic.' },
  { id: 'aura-2-athena-en', name: 'Athena', gender: 'Female', accent: 'US', description: 'Mature, American, Calm, smooth, professional.' },
  { id: 'aura-2-atlas-en', name: 'Atlas', gender: 'Male', accent: 'US', description: 'Mature, American, Enthusiastic, confident, friendly.' },
  { id: 'aura-2-aurora-en', name: 'Aurora', gender: 'Female', accent: 'US', description: 'Adult, American, Cheerful, expressive, energetic.' },
  { id: 'aura-2-callista-en', name: 'Callista', gender: 'Female', accent: 'US', description: 'Adult, American, Clear, energetic, smooth.' },
  { id: 'aura-2-cora-en', name: 'Cora', gender: 'Female', accent: 'US', description: 'Adult, American, Smooth, melodic, caring.' },
  { id: 'aura-2-cordelia-en', name: 'Cordelia', gender: 'Female', accent: 'US', description: 'Young Adult, American, Approachable, warm.' },
  { id: 'aura-2-delia-en', name: 'Delia', gender: 'Female', accent: 'US', description: 'Young Adult, American, Casual, friendly, breathy.' },
  { id: 'aura-2-draco-en', name: 'Draco', gender: 'Male', accent: 'UK', description: 'Adult, British, Warm, trustworthy, baritone.' },
  { id: 'aura-2-electra-en', name: 'Electra', gender: 'Female', accent: 'US', description: 'Adult, American, Professional, engaging.' },
  { id: 'aura-2-harmonia-en', name: 'Harmonia', gender: 'Female', accent: 'US', description: 'Adult, American, Empathetic, clear, calm.' },
  { id: 'aura-2-helena-en', name: 'Helena', gender: 'Female', accent: 'US', description: 'Adult, American, Caring, natural, friendly, raspy.' },
  { id: 'aura-2-hera-en', name: 'Hera', gender: 'Female', accent: 'US', description: 'Adult, American, Smooth, warm, professional.' },
  { id: 'aura-2-hermes-en', name: 'Hermes', gender: 'Male', accent: 'US', description: 'Adult, American, Expressive, engaging, professional.' },
  { id: 'aura-2-hyperion-en', name: 'Hyperion', gender: 'Male', accent: 'AU', description: 'Adult, Australian, Caring, warm, empathetic.' },
  { id: 'aura-2-iris-en', name: 'Iris', gender: 'Female', accent: 'US', description: 'Young Adult, American, Cheerful, positive, approachable.' },
  { id: 'aura-2-janus-en', name: 'Janus', gender: 'Female', accent: 'US', description: 'Adult, Southern American, Smooth, trustworthy.' },
  { id: 'aura-2-juno-en', name: 'Juno', gender: 'Female', accent: 'US', description: 'Adult, American, Natural, engaging, breathy.' },
  { id: 'aura-2-jupiter-en', name: 'Jupiter', gender: 'Male', accent: 'US', description: 'Adult, American, Expressive, baritone.' },
  { id: 'aura-2-luna-en', name: 'Luna', gender: 'Female', accent: 'US', description: 'Young Adult, American, Friendly, natural, engaging.' },
  { id: 'aura-2-mars-en', name: 'Mars', gender: 'Male', accent: 'US', description: 'Adult, American, Smooth, patient, trustworthy.' },
  { id: 'aura-2-minerva-en', name: 'Minerva', gender: 'Female', accent: 'US', description: 'Adult, American, Positive, friendly, natural.' },
  { id: 'aura-2-neptune-en', name: 'Neptune', gender: 'Male', accent: 'US', description: 'Adult, American, Professional, patient, polite.' },
  { id: 'aura-2-odysseus-en', name: 'Odysseus', gender: 'Male', accent: 'US', description: 'Adult, American, Calm, smooth, comfortable.' },
  { id: 'aura-2-ophelia-en', name: 'Ophelia', gender: 'Female', accent: 'US', description: 'Adult, American, Expressive, enthusiastic, cheerful.' },
  { id: 'aura-2-orion-en', name: 'Orion', gender: 'Male', accent: 'US', description: 'Adult, American, Approachable, comfortable, calm.' },
  { id: 'aura-2-orpheus-en', name: 'Orpheus', gender: 'Male', accent: 'US', description: 'Adult, American, Professional, clear, confident.' },
  { id: 'aura-2-pandora-en', name: 'Pandora', gender: 'Female', accent: 'UK', description: 'Adult, British, Smooth, calm, breathy.' },
  { id: 'aura-2-phoebe-en', name: 'Phoebe', gender: 'Female', accent: 'US', description: 'Adult, American, Energetic, warm, casual.' },
  { id: 'aura-2-pluto-en', name: 'Pluto', gender: 'Male', accent: 'US', description: 'Adult, American, Smooth, calm, empathetic, baritone.' },
  { id: 'aura-2-saturn-en', name: 'Saturn', gender: 'Male', accent: 'US', description: 'Adult, American, Knowledgeable, confident, baritone.' },
  { id: 'aura-2-selene-en', name: 'Selene', gender: 'Female', accent: 'US', description: 'Adult, American, Expressive, engaging, energetic.' },
  { id: 'aura-2-thalia-en', name: 'Thalia', gender: 'Female', accent: 'US', description: 'Adult, American, Clear, confident, energetic.' },
  { id: 'aura-2-theia-en', name: 'Theia', gender: 'Female', accent: 'AU', description: 'Adult, Australian, Expressive, polite, sincere.' },
  { id: 'aura-2-vesta-en', name: 'Vesta', gender: 'Female', accent: 'US', description: 'Adult, American, Natural, expressive, patient.' },
  { id: 'aura-2-zeus-en', name: 'Zeus', gender: 'Male', accent: 'US', description: 'Adult, American, Deep, trustworthy, smooth.' },
]

const awsPollyVoicePresets = [
  { id: 'Lisa', name: 'Lisa', gender: 'Female', accent: 'nl-BE', description: 'A soft, medium-pitched adult female voice with a warm, professional Flemish accent and smooth, gentle cadence.' },
  { id: 'Laura', name: 'Laura', gender: 'Female', accent: 'nl-NL', description: 'A warm, mature, medium-to-low pitched adult female voice with a clear Dutch accent and calm, professional presence.' },
  { id: 'Olivia', name: 'Olivia', gender: 'Female', accent: 'en-AU', description: 'A youthful, cheerful female voice with a bright Australian accent, clear timbre, and energetic, friendly cadence.' },
  { id: 'Amy', name: 'Amy', gender: 'Female', accent: 'en-GB', description: 'A warm, clear, and professional adult female voice with a smooth British accent and a sincere, confident cadence.' },
  { id: 'Brian', name: 'Brian', gender: 'Male', accent: 'en-GB', description: 'A deep, resonant, and calm baritone male voice with a polished British accent, sounding mature and authoritative yet reassuring.' },
  { id: 'Kajal', name: 'Kajal', gender: 'Female', accent: 'en-IN', description: 'A gentle, medium-pitched adult female voice with a smooth Indian English accent, clear timbre, and a professional, sincere delivery.' },
  { id: 'Niamh', name: 'Niamh', gender: 'Female', accent: 'en-IE', description: 'A warm, slightly breathy adult female voice with a soft Irish accent, friendly cadence, and gentle, comforting tone.' },
  { id: 'Aria', name: 'Aria', gender: 'Female', accent: 'en-NZ', description: 'A bright, youthful adult female voice with a clear New Zealand accent, smooth timbre, and approachable, professional cadence.' },
  { id: 'Jasmine', name: 'Jasmine', gender: 'Female', accent: 'en-SG', description: 'A calm, professional, and clear adult female voice with a subtle Singaporean accent, medium pitch, and a confident, steady delivery.' },
  { id: 'Ayanda', name: 'Ayanda', gender: 'Female', accent: 'en-ZA', description: 'A rich, deep, and smooth mature female voice with a professional South African accent, confident presence, and warm cadence.' },
  { id: 'Danielle', name: 'Danielle', gender: 'Female', accent: 'en-US', description: 'A clear, bright, and professional adult female voice with a standard American accent, friendly cadence, and warm timbre.' },
  { id: 'Joanna', name: 'Joanna', gender: 'Female', accent: 'en-US', description: 'A smooth, confident, and professional adult female voice with a standard American accent and a clear, authoritative presence.' },
  { id: 'Salli', name: 'Salli', gender: 'Female', accent: 'en-US', description: 'A youthful, bright, and cheerful female voice with a light American accent, energetic cadence, and friendly tone.' },
  { id: 'Matthew', name: 'Matthew', gender: 'Male', accent: 'en-US', description: 'A warm, natural, medium-pitched adult male voice with a standard American accent, smooth timbre, and friendly, professional cadence.' },
  { id: 'Ruth', name: 'Ruth', gender: 'Female', accent: 'en-US', description: 'A mature, warm, and comforting female voice with a standard American accent, smooth timbre, and a reassuring, professional presence.' },
  { id: 'Stephen', name: 'Stephen', gender: 'Male', accent: 'en-US', description: 'A clear, confident, and professional adult male voice with a standard American accent, medium pitch, and energetic delivery.' },
  { id: 'Tiffany', name: 'Tiffany', gender: 'Female', accent: 'en-US', description: 'A youthful, bright, and clear female voice with a standard American accent, friendly cadence, and cheerful, approachable tone.' },
  { id: 'Lea', name: 'Lea', gender: 'Female', accent: 'fr-FR', description: 'A smooth, soft, and slightly breathy adult female voice with a clear French accent and a gentle, romantic cadence.' },
  { id: 'Remi', name: 'Remi', gender: 'Male', accent: 'fr-FR', description: 'A warm, medium-pitched adult male voice with a smooth French accent, calm timbre, and professional, polite tone.' },
  { id: 'Isabelle', name: 'Isabelle', gender: 'Female', accent: 'fr-BE', description: 'A soft, gentle, and warm adult female voice with a Belgian French accent, clear timbre, and a sincere, reassuring cadence.' },
  { id: 'Gabrielle', name: 'Gabrielle', gender: 'Female', accent: 'fr-CA', description: 'A clear, confident, and expressive adult female voice with a Canadian French accent, medium pitch, and professional delivery.' },
  { id: 'Liam', name: 'Liam', gender: 'Male', accent: 'fr-CA', description: 'A friendly, energetic, and youthful adult male voice with a Canadian French accent, clear timbre, and warm tone.' },
  { id: 'Vicki', name: 'Vicki', gender: 'Female', accent: 'de-DE', description: 'A clear, precise, and professional adult female voice with a standard German accent, medium pitch, and confident presence.' },
  { id: 'Hannah', name: 'Hannah', gender: 'Female', accent: 'de-AT', description: 'A warm, friendly, and smooth adult female voice with an Austrian German accent, clear timbre, and gentle cadence.' },
  { id: 'Sabrina', name: 'Sabrina', gender: 'Female', accent: 'de-CH', description: 'A calm, professional, and slightly bright adult female voice with a Swiss German accent and a reassuring, clear delivery.' },
  { id: 'Bianca', name: 'Bianca', gender: 'Female', accent: 'it-IT', description: 'A clear, medium-pitched adult female voice with a distinct Italian accent, smooth and warm timbre, and a professional, confident cadence.' },
  { id: 'Seoyeon', name: 'Seoyeon', gender: 'Female', accent: 'ko-KR', description: 'A youthful, light, and bright adult female voice with a clear Korean accent, clear timbre, and a cheerful, friendly delivery.' },
  { id: 'Ola', name: 'Ola', gender: 'Female', accent: 'pl-PL', description: 'A smooth, medium-pitched adult female voice with a clear Polish accent, warm and friendly timbre, and professional cadence.' },
  { id: 'Camila', name: 'Camila', gender: 'Female', accent: 'pt-BR', description: 'A warm, expressive adult female voice with a smooth Brazilian Portuguese accent, clear timbre, and a confident, natural delivery.' },
  { id: 'Lucia', name: 'Lucia', gender: 'Female', accent: 'es-ES', description: 'A clear, energetic, and professional adult female voice with a standard Spanish accent, medium pitch, and confident cadence.' },
  { id: 'Sergio', name: 'Sergio', gender: 'Male', accent: 'es-ES', description: 'A warm, friendly, medium-pitched adult male voice with a standard Spanish accent, smooth timbre, and approachable delivery.' },
  { id: 'Mia', name: 'Mia', gender: 'Female', accent: 'es-MX', description: 'A youthful, soft, and warm female voice with a clear Mexican Spanish accent, gentle timbre, and a sincere cadence.' },
  { id: 'Andres', name: 'Andres', gender: 'Male', accent: 'es-MX', description: 'A clear, professional, and confident adult male voice with a standard Mexican Spanish accent, medium pitch, and steady cadence.' },
  { id: 'Lupe', name: 'Lupe', gender: 'Female', accent: 'es-US', description: 'A mature, warm, and professional adult female voice with a standard US Spanish accent, smooth timbre, and reassuring presence.' },
  { id: 'Pedro', name: 'Pedro', gender: 'Male', accent: 'es-US', description: 'A friendly, energetic, and medium-pitched adult male voice with a US Spanish accent, clear timbre, and dynamic delivery.' },
]

interface VoiceProviderConfig {
  id: string
  label: string
  baseProvider: string
  getDefaultModel: () => string
  voices: Array<{ id: string, name: string, gender: string, accent: string, description: string }>
}

const voiceProvidersRegistry: Record<string, VoiceProviderConfig> = {
  'kokoro-local': {
    id: 'kokoro-local',
    label: 'Kokoro (Local Engine)',
    baseProvider: 'kokoro-local',
    getDefaultModel: () => (providersStore.getProviderConfig('kokoro-local')?.model as string) || 'q4',
    voices: voicePresets,
  },
  'deepgram-tts': {
    id: 'deepgram-tts',
    label: 'Deepgram Aura-2 (Remote TTS)',
    baseProvider: 'deepgram-tts',
    getDefaultModel: () => 'aura-2',
    voices: deepgramVoicePresets,
  },
  'aws-polly-tts': {
    id: 'aws-polly-tts',
    label: 'Amazon Polly (Cloud Engine)',
    baseProvider: 'aws-polly-tts',
    getDefaultModel: () => 'generative',
    voices: awsPollyVoicePresets,
  },
}

const selectedProvider = ref<string>('kokoro-local')
const currentVoicePresets = computed(() => {
  return voiceProvidersRegistry[selectedProvider.value]?.voices || []
})

const countdown = ref(15)
const countdownTimer = ref<any>(null)
const isTimerPaused = ref(false)

function startCountdown() {
  clearCountdown()
  countdownTimer.value = setInterval(() => {
    if (isTimerPaused.value)
      return
    countdown.value--
    if (countdown.value <= 0) {
      clearCountdown()
      void runAutoConfiguration()
    }
  }, 1000)
}

function clearCountdown() {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

function handlePauseTimer() {
  isTimerPaused.value = true
  clearCountdown()
}

function handleManualMatch() {
  clearCountdown()
  void runAutoConfiguration()
}

watch(selectedProvider, () => {
  handlePauseTimer()
})

interface Recommendation {
  characterId: string
  name: string
  voiceId: string
  rate: number
  pitch: number
  idleAnimations: string[]
  reasoning: string
}

const recommendations = ref<Recommendation[]>([])
const activePlayingId = ref<string | null>(null)

// Autocomplete and selection states
const { getAvailableModelMotions } = useIdleAnimations()
const dropdownOpenMap = ref<Record<string, boolean>>({})
const searchInputMap = ref<Record<string, string>>({})
const dropdownHighlightMap = ref<Record<string, number>>({})

function getFilteredDropdownOptions(rec: Recommendation) {
  const modelId = props.boundModels[rec.characterId]
  const motions = getAvailableModelMotions(modelId)
  const query = (searchInputMap.value[rec.characterId] || '').trim().toLowerCase()

  if (!query) {
    return motions.filter(m => !rec.idleAnimations.includes(m)).slice(0, 50)
  }

  return motions.filter(
    m => m.toLowerCase().includes(query) && !rec.idleAnimations.includes(m),
  )
}

function handleAddIdleAnimation(rec: Recommendation, val: string) {
  const cleanVal = val.trim()
  if (cleanVal && !rec.idleAnimations.includes(cleanVal)) {
    rec.idleAnimations.push(cleanVal)
  }
  searchInputMap.value[rec.characterId] = ''
  dropdownHighlightMap.value[rec.characterId] = 0
}

function handleRemoveIdleAnimation(rec: Recommendation, anim: string) {
  rec.idleAnimations = rec.idleAnimations.filter(a => a !== anim)
}

function handleToggleIdleAnimation(rec: Recommendation, anim: string) {
  if (rec.idleAnimations.includes(anim)) {
    handleRemoveIdleAnimation(rec, anim)
  }
  else {
    handleAddIdleAnimation(rec, anim)
  }
}

function selectHighlightedAnim(rec: Recommendation) {
  const opts = getFilteredDropdownOptions(rec)
  const idx = dropdownHighlightMap.value[rec.characterId] || 0
  if (opts.length > 0 && idx < opts.length) {
    handleAddIdleAnimation(rec, opts[idx])
  }
  else {
    const val = searchInputMap.value[rec.characterId] || ''
    handleAddIdleAnimation(rec, val)
  }
}

function highlightNext(rec: Recommendation) {
  const opts = getFilteredDropdownOptions(rec)
  if (opts.length > 0) {
    const current = dropdownHighlightMap.value[rec.characterId] || 0
    dropdownHighlightMap.value[rec.characterId] = (current + 1) % opts.length
  }
}

function highlightPrev(rec: Recommendation) {
  const opts = getFilteredDropdownOptions(rec)
  if (opts.length > 0) {
    const current = dropdownHighlightMap.value[rec.characterId] || 0
    dropdownHighlightMap.value[rec.characterId] = (current - 1 + opts.length) % opts.length
  }
}

function onAnimInputBlur(rec: Recommendation) {
  setTimeout(() => {
    dropdownOpenMap.value[rec.characterId] = false
  }, 150)
}
let activeAudio: HTMLAudioElement | null = null

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    state.value = 'idle'
    recommendations.value = []
    errorMessage.value = ''
    stopAudio()
    // Start countdown timer instead of running instantly
    selectedProvider.value = 'kokoro-local'
    countdown.value = 15
    isTimerPaused.value = false
    startCountdown()
  }
  else {
    stopAudio()
    clearCountdown()
  }
})

function stopAudio() {
  if (activeAudio) {
    activeAudio.pause()
    activeAudio = null
  }
  activePlayingId.value = null
}

async function runAutoConfiguration() {
  state.value = 'loading'
  try {
    const activeModel = consciousnessStore.activeModel
    const activeProviderName = consciousnessStore.activeProvider
    if (!activeModel || !activeProviderName) {
      throw new Error('No active LLM configured in settings.')
    }
    const providerInstance = await providersStore.getProviderInstance(activeProviderName)
    if (!providerInstance) {
      throw new Error('Failed to retrieve active provider instance.')
    }

    const castList = props.selectedCharacters.map((c) => {
      const series = props.copyrights[c.copyrightIndex] || 'Unknown Series'
      const gender = props.genders[Number(c.traits[0] || 0)] || 'Unknown'
      return `- ID: "${c.id}", Name: "${c.name}", Series: "${series}", Gender: "${gender}", Description/Traits: ${c.tags}`
    }).join('\n')

    const voicesList = currentVoicePresets.value.map((v) => {
      return `- ID: "${v.id}", Name: "${v.name}", Gender: "${v.gender}", Description: ${v.description}`
    }).join('\n')

    // Format motions list for LLM matching
    const characterMotionsText = props.selectedCharacters.map((c) => {
      const modelId = props.boundModels[c.id]
      const motions = getAvailableModelMotions(modelId)
      return `Character: "${c.name}" (ID: "${c.id}") - Available Idle Motions: [${motions.join(', ')}]`
    }).join('\n')

    const systemMsg = `You are a professional character setup director. 
For each of the provided characters:
1. Match them with the single best-fitting voice from the available voice list of the selected provider.
2. Suggest optimal speech "rate" (speech speed, normally 1.0, range 0.7 to 1.4) and "pitch" (speech pitch, normally 1.0, range 0.7 to 1.4) matching their canon description.
3. Suggest 1 to 3 best-fitting "idleAnimations" selected ONLY from their specific "Available Idle Motions" list. Do not invent any animation names that are not in their list.

Return ONLY a raw JSON array matching this schema (no markdown formatting, no wrapping text):
[
  {
    "characterId": "the character ID string",
    "voiceId": "the selected voice ID from the available voices list",
    "rate": 1.0,
    "pitch": 1.0,
    "idleAnimations": ["motion1", "motion2"],
    "reasoning": "A 1-sentence explanation of why this configuration fits the character."
  }
]`

    const userMsg = `AVAILABLE VOICES FOR PROVIDER:\n${voicesList}\n\nCHARACTERS & AVAILABLE IDLE MOTIONS:\n${characterMotionsText}\n\nCHARACTERS PROFILE INFO:\n${castList}`

    const response = await llmStore.generate(activeModel, providerInstance as any, [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg },
    ])

    const rawText = (response.text || '').trim()
    let cleanJson = rawText
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match) {
      cleanJson = match[1].trim()
    }

    const parsed = JSON.parse(cleanJson)
    if (!Array.isArray(parsed)) {
      throw new TypeError('LLM did not return a valid array.')
    }

    recommendations.value = parsed.map((item: any) => {
      let char = props.selectedCharacters.find(c => c.id === item.characterId)
      if (!char && item.name) {
        char = props.selectedCharacters.find(c => c.name.toLowerCase() === item.name.toLowerCase())
      }
      return {
        characterId: char ? char.id : item.characterId,
        name: char ? char.name : (item.name || 'Unknown'),
        voiceId: item.voiceId || currentVoicePresets.value[0]?.id || '',
        rate: typeof item.rate === 'number' ? item.rate : 1.0,
        pitch: typeof item.pitch === 'number' ? item.pitch : 1.0,
        idleAnimations: Array.isArray(item.idleAnimations) ? item.idleAnimations : [],
        reasoning: item.reasoning || 'Automatically matched.',
      }
    })

    state.value = 'results'
  }
  catch (err: any) {
    console.error('[AutoVoiceConfigModal] Recommendation failed:', err)
    errorMessage.value = err.message || 'Unknown error occurred during analysis.'
    state.value = 'error'
  }
}

async function playPreview(rec: Recommendation) {
  if (activePlayingId.value === rec.characterId) {
    stopAudio()
    return
  }

  stopAudio()
  activePlayingId.value = rec.characterId

  try {
    const provider = await providersStore.getProviderInstance('virtual-audio-studio')
    if (!provider) {
      throw new Error('Virtual Audio Studio provider is not active.')
    }

    const providerConfig = voiceProvidersRegistry[selectedProvider.value]
    if (!providerConfig) {
      throw new Error(`Voice provider configuration not found in registry: ${selectedProvider.value}`)
    }
    const baseProvider = providerConfig.baseProvider
    const baseModel = providerConfig.getDefaultModel()
    const testText = `Hello, I am ${rec.name}. How does my voice sound?`

    // Save a temporary voice profile to speechStore to run pitch and rate effects via the proxy
    const tempProfileId = 'voice_profile_auto_preview'
    const tempProfile = {
      id: tempProfileId,
      name: 'Voice Profile Auto Preview',
      baseProvider,
      baseModel,
      baseVoice: rec.voiceId,
      effects: {
        pitch: rec.pitch,
        rate: rec.rate,
        volume: 1.0,
        asmr: 0,
        radio: 0,
        robot: 0,
        reverb: 0,
        spatial: 0,
      },
      ust: {
        enabled: true,
        mode: 'flatten' as any,
        customStripChars: '*_[]()<>"\'',
        stripEmojis: true,
        tildeReplacement: '',
        autoLowercaseCapsThreshold: 2,
        autoLowercaseCapsExclude: [],
        convertBracketsToTokenFormat: true,
        customReplacements: [],
      },
    }

    console.log('[AutoVoiceConfigModal] Saving temporary preview voice profile:', tempProfile)

    // Trigger array replacement to ensure LocalStorage/Vue reactivity runs
    const currentProfiles = [...(speechStore.savedVoiceProfiles || [])]
    const profileIdx = currentProfiles.findIndex(p => p.id === tempProfileId)
    if (profileIdx !== -1) {
      currentProfiles[profileIdx] = tempProfile as any
    }
    else {
      currentProfiles.push(tempProfile as any)
    }
    speechStore.savedVoiceProfiles = currentProfiles

    const audioData = await speechStore.speech(
      provider as any,
      'virtual',
      testText,
      tempProfileId,
    )

    if (activePlayingId.value !== rec.characterId)
      return

    const audioUrl = URL.createObjectURL(new Blob([audioData]))
    const audio = new Audio(audioUrl)
    audio.addEventListener('ended', () => {
      if (activePlayingId.value === rec.characterId) {
        activePlayingId.value = null
      }
    })
    activeAudio = audio
    audio.play()
  }
  catch (err: any) {
    toast.error(err.message || 'Failed to play voice preview.')
    activePlayingId.value = null
  }
}

function handleApply() {
  const payload: Record<string, { baseProvider: string, baseModel: string, baseVoice: string, idleAnimations?: string[] }> = {}
  const providerConfig = voiceProvidersRegistry[selectedProvider.value]
  if (!providerConfig) {
    throw new Error(`Voice provider configuration not found in registry: ${selectedProvider.value}`)
  }
  const baseProvider = providerConfig.baseProvider
  const baseModel = providerConfig.getDefaultModel()

  const currentProfiles = [...(speechStore.savedVoiceProfiles || [])]

  recommendations.value.forEach((rec) => {
    const profileId = `voice_profile_${rec.name.trim()}_auto`

    const newProfile = {
      id: profileId,
      name: `${rec.name} (Auto)`,
      baseProvider,
      baseModel,
      baseVoice: rec.voiceId,
      effects: {
        pitch: rec.pitch,
        rate: rec.rate,
        volume: 1.0,
        asmr: 0,
        radio: 0,
        robot: 0,
        reverb: 0,
        spatial: 0,
      },
      ust: {
        enabled: true,
        mode: 'flatten' as any,
        customStripChars: '*_[]()<>"\'',
        stripEmojis: true,
        tildeReplacement: '',
        autoLowercaseCapsThreshold: 2,
        autoLowercaseCapsExclude: [],
        convertBracketsToTokenFormat: true,
        customReplacements: [],
      },
    }

    console.log(`[AutoVoiceConfigModal] Saving final configured voice profile for ${rec.name}:`, newProfile)

    const profileIdx = currentProfiles.findIndex(p => p.id === profileId)
    if (profileIdx !== -1) {
      currentProfiles[profileIdx] = newProfile as any
    }
    else {
      currentProfiles.push(newProfile as any)
    }

    payload[rec.characterId] = {
      baseProvider: 'virtual-audio-studio',
      baseModel: 'virtual',
      baseVoice: profileId,
      idleAnimations: [...rec.idleAnimations],
    }
  })

  speechStore.savedVoiceProfiles = currentProfiles

  emit('apply', payload)
  emit('update:modelValue', false)
  toast.success('Successfully applied character voice & motion configurations!')
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md" />
      <DialogContent
        class="border-neutral-205 fixed left-1/2 top-1/2 z-[10001] m-0 max-h-[85vh] max-w-2xl w-[90vw] flex flex-col overflow-hidden border rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <!-- Header -->
        <div class="border-b border-neutral-200 p-6 dark:border-neutral-800">
          <div class="flex items-center gap-2">
            <div class="text-primary-505 shadow-primary-505/10 rounded-xl bg-primary-500/10 p-2 shadow-sm">
              <div class="i-solar:magic-stick-3-bold-duotone animate-pulse text-xl" />
            </div>
            <DialogTitle class="text-base text-neutral-800 font-bold dark:text-neutral-100">
              Magic Character Configurator
            </DialogTitle>
          </div>
        </div>

        <!-- Body Content -->
        <div class="min-h-[250px] flex flex-1 flex-col overflow-y-auto bg-white p-6 dark:bg-neutral-900">
          <!-- Idle / Countdown State -->
          <div v-if="state === 'idle'" class="flex flex-1 flex-col items-center justify-center gap-6 py-6">
            <div class="text-center space-y-1">
              <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
                Auto-Matching configuration
              </h4>
              <p class="max-w-sm text-xs text-neutral-500 leading-normal dark:text-neutral-400">
                Matches your cast with the best voices and motions. Adjust provider settings below or begin immediately.
              </p>
            </div>

            <!-- Provider Selection & Match actions -->
            <div class="max-w-sm w-full border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 space-y-4 dark:border-neutral-800 dark:bg-neutral-950/20">
              <div class="flex flex-col gap-1.5">
                <label class="dark:text-neutral-450 text-[10px] text-neutral-500 font-bold tracking-wider uppercase">Voice Provider</label>
                <select
                  v-model="selectedProvider"
                  class="w-full border border-neutral-200 rounded-lg bg-white px-3 py-2 text-xs text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200"
                >
                  <option value="kokoro-local">
                    Kokoro (Local Engine)
                  </option>
                  <option value="deepgram-tts">
                    Deepgram Aura-2 (Remote TTS)
                  </option>
                  <option value="aws-polly-tts">
                    Amazon Polly (Cloud Engine)
                  </option>
                </select>
              </div>

              <div class="flex items-center gap-2 pt-2">
                <Button variant="primary" class="h-9 flex-1 text-xs font-bold" @click="handleManualMatch">
                  Match Now
                </Button>

                <button
                  v-if="!isTimerPaused"
                  class="dark:hover:bg-neutral-850 h-9 w-9 flex items-center justify-center border border-neutral-200 rounded-lg bg-white text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-50 dark:text-neutral-400"
                  title="Pause countdown"
                  @click="handlePauseTimer"
                >
                  <div class="i-solar:pause-bold text-sm" />
                </button>
              </div>
            </div>

            <!-- Sleek countdown loading bar -->
            <div class="max-w-sm w-full flex flex-col gap-2">
              <div class="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                <span>{{ isTimerPaused ? 'Timer Paused' : `Auto-matching in ${countdown}s...` }}</span>
                <span class="font-mono">{{ Math.round((countdown / 15) * 100) }}%</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  class="h-full bg-primary-500 transition-all duration-300 ease-out"
                  :style="{ width: isTimerPaused ? '0%' : `${(countdown / 15) * 100}%` }"
                />
              </div>
            </div>
          </div>

          <!-- Loading State -->
          <div v-else-if="state === 'loading'" class="flex flex-1 flex-col items-center justify-center gap-4 py-8">
            <div class="h-10 w-10 flex items-center justify-center rounded-full bg-primary-500/15 text-primary-400">
              <span class="i-solar:restart-square-outline animate-spin text-2xl" />
            </div>
            <div class="text-center">
              <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
                Analyzing Cast Profiles
              </h4>
              <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                matching characters with the best voice presets and idle loop animations...
              </p>
            </div>
          </div>

          <!-- Error State -->
          <div v-else-if="state === 'error'" class="flex flex-1 flex-col items-center justify-center gap-4 py-8">
            <div class="h-10 w-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <span class="i-solar:shield-warning-bold text-2xl" />
            </div>
            <div class="text-center">
              <h4 class="text-sm text-neutral-800 font-bold dark:text-neutral-200">
                Configuration Failed
              </h4>
              <p class="mt-1 text-xs text-red-500 dark:text-red-400">
                {{ errorMessage }}
              </p>
            </div>
            <Button variant="secondary" class="mt-2 text-xs" @click="runAutoConfiguration">
              Retry Configuration
            </Button>
          </div>

          <!-- Results Review State -->
          <div v-else-if="state === 'results'" class="flex flex-col gap-4">
            <p class="text-xs text-neutral-600 leading-normal dark:text-neutral-400">
              Review and adjust the recommended voice presets, speed/pitch modifiers, and idle animation overrides for each character. Click Apply to save assignments for all characters at once.
            </p>

            <div class="flex flex-col gap-3">
              <div
                v-for="rec in recommendations"
                :key="rec.characterId"
                class="border-neutral-205 flex flex-col border rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-950/20"
              >
                <!-- Character & Voice Selector Row -->
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <!-- Character title -->
                  <div class="flex items-center gap-2">
                    <div class="text-primary-505 i-solar:user-circle-bold-duotone shrink-0 text-lg dark:text-primary-400" />
                    <span class="text-sm text-neutral-800 font-bold dark:text-neutral-100">{{ rec.name }}</span>
                  </div>

                  <!-- Voice settings controls -->
                  <div class="flex items-center gap-3">
                    <!-- Dropdown preset picker -->
                    <select
                      v-model="rec.voiceId"
                      class="border border-neutral-200 rounded-lg bg-white px-2 py-1 text-xs text-neutral-700 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-300"
                    >
                      <option v-for="voice in currentVoicePresets" :key="voice.id" :value="voice.id">
                        {{ voice.name }} ({{ voice.gender }})
                      </option>
                    </select>

                    <!-- Preview voice btn -->
                    <button
                      class="h-7 flex items-center gap-1 border border-neutral-200 rounded bg-neutral-100 px-2.5 text-xs text-neutral-700 transition-colors dark:border-none dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      @click="playPreview(rec)"
                    >
                      <span
                        :class="activePlayingId === rec.characterId ? 'i-solar:pause-circle-bold-duotone text-primary-500 dark:text-primary-400 animate-pulse' : 'i-solar:play-stream-bold-duotone'"
                        class="shrink-0 text-sm"
                      />
                      <span>{{ activePlayingId === rec.characterId ? 'Stop' : 'Preview' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Sliders Row -->
                <div class="grid grid-cols-1 mt-3.5 gap-4 border-t border-neutral-200 pt-3 sm:grid-cols-2 dark:border-neutral-800/40">
                  <!-- Pitch slider -->
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                      <span>Pitch Modifier</span>
                      <span class="text-primary-600 font-mono dark:text-primary-400">{{ rec.pitch.toFixed(2) }}x</span>
                    </div>
                    <input
                      v-model.number="rec.pitch"
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.05"
                      class="h-1 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                    >
                  </div>

                  <!-- Speed Rate slider -->
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
                      <span>Speed Rate</span>
                      <span class="text-primary-600 font-mono dark:text-primary-400">{{ rec.rate.toFixed(2) }}x</span>
                    </div>
                    <input
                      v-model.number="rec.rate"
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.05"
                      class="h-1 cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-800"
                    >
                  </div>
                </div>

                <!-- Idle Loop / Cycle Animations Override -->
                <div class="mt-3.5 flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-800/40">
                  <label class="dark:text-neutral-450 text-[10px] text-neutral-500 font-bold">
                    Idle Loop Override
                  </label>

                  <!-- Autocomplete Input -->
                  <div class="relative w-full">
                    <input
                      v-model="searchInputMap[rec.characterId]"
                      type="text"
                      placeholder="Search and add animation name..."
                      class="w-full border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                      @focus="dropdownOpenMap[rec.characterId] = true"
                      @blur="onAnimInputBlur(rec)"
                      @keydown.enter.prevent="selectHighlightedAnim(rec)"
                      @keydown.down.prevent="highlightNext(rec)"
                      @keydown.up.prevent="highlightPrev(rec)"
                    >

                    <!-- Dropdown Options -->
                    <div
                      v-if="dropdownOpenMap[rec.characterId] && getFilteredDropdownOptions(rec).length > 0"
                      class="absolute left-0 right-0 z-50 mt-1 max-h-32 overflow-y-auto border border-neutral-200 rounded-lg bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
                    >
                      <div
                        v-for="(opt, idx) in getFilteredDropdownOptions(rec)"
                        :key="opt"
                        :class="[
                          'cursor-pointer px-3 py-1 text-[11px] text-neutral-750 dark:text-neutral-300 transition-colors hover:bg-primary-500/10 hover:text-primary-500',
                          (dropdownHighlightMap[rec.characterId] || 0) === idx ? 'bg-primary-500/15 text-primary-500' : '',
                        ]"
                        @mousedown="handleAddIdleAnimation(rec, opt)"
                      >
                        {{ opt }}
                      </div>
                    </div>
                  </div>

                  <!-- Accumulated Tags List -->
                  <div v-if="rec.idleAnimations.length > 0" class="flex flex-wrap gap-1.5 pt-0.5">
                    <span
                      v-for="anim in rec.idleAnimations"
                      :key="anim"
                      class="flex items-center gap-1 rounded bg-primary-500/10 px-2.5 py-0.5 text-[9px] text-primary-500 font-medium dark:text-primary-400"
                    >
                      {{ anim }}
                      <button type="button" class="ml-1 text-[10px] text-neutral-400 font-bold hover:text-red-400 focus:outline-none" @click="handleRemoveIdleAnimation(rec, anim)">
                        &times;
                      </button>
                    </span>
                  </div>

                  <!-- Dynamic Quick Add Presets -->
                  <div v-if="getAvailableModelMotions(props.boundModels[rec.characterId]).length > 0" class="flex flex-wrap items-center gap-1">
                    <span class="mr-1 text-[9px] text-neutral-400 dark:text-neutral-500">Quick Add:</span>
                    <button
                      v-for="preset in getAvailableModelMotions(props.boundModels[rec.characterId]).slice(0, 6)"
                      :key="preset"
                      type="button"
                      class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 hover:text-white dark:hover:bg-neutral-700"
                      @click="handleToggleIdleAnimation(rec, preset)"
                    >
                      + {{ preset }}
                    </button>
                  </div>
                </div>

                <!-- Reasoning text -->
                <p class="mt-3.5 border-t border-neutral-200 pt-2 text-[11px] text-neutral-600 leading-normal italic dark:border-neutral-800/40 dark:text-neutral-400">
                  💡 {{ rec.reasoning }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50/50 px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          <Button
            variant="secondary"
            class="h-9 px-4 text-xs font-semibold"
            @click="emit('update:modelValue', false)"
          >
            Cancel
          </Button>
          <Button
            v-if="state === 'results'"
            variant="primary"
            class="h-9 px-5 text-xs font-bold"
            @click="handleApply"
          >
            Apply Assignments
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
