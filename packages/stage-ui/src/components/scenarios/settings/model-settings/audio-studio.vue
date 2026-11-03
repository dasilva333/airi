<script setup lang="ts">
import type { BracketAction, CodeBlockAction, NotationAction, VoiceProfile } from '../../../../stores/providers/types'

import { createAudioBlob } from '@proj-airi/stage-shared'
import {
  FieldCheckbox,
  FieldInput,
  FieldRange,
  Textarea,
} from '@proj-airi/ui'
import { generateSpeech } from '@xsai/generate-speech'
import { storeToRefs } from 'pinia'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { applyVoiceProfileEffects } from '../../../../composables/audio/audio-effects'
import { useAudioContext } from '../../../../stores/audio'
import { PLAYGROUND_PRESETS, useSpeechStore } from '../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../stores/providers'

type StudioTab = 'cleanup' | 'profile' | 'effects'

const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const { audioContext } = useAudioContext()

const { savedVoiceProfiles } = storeToRefs(speechStore)
const { allAudioSpeechProvidersMetadata } = storeToRefs(providersStore)

// Navigation Tabs
const activeTab = ref<StudioTab>('profile')

// Active selected profile
const activeProfileId = ref<string>('')
const activeProfile = computed(() => savedVoiceProfiles.value.find(p => p.id === activeProfileId.value))

// Popover open state & search query for voice profiles
const isProfilePopoverOpen = ref(false)
const searchQuery = ref('')
const filteredVoiceProfiles = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const list = savedVoiceProfiles.value.filter(p => p.id !== 'voice_profile_auto_preview')
  if (!query)
    return list

  return list.filter((p) => {
    const name = (p.name || '').toLowerCase()
    const provider = (p.baseProvider || '').toLowerCase()
    const voice = (p.baseVoice || '').toLowerCase()
    return name.includes(query) || provider.includes(query) || voice.includes(query)
  })
})

// UI Form State representing the active profile
const form = ref<VoiceProfile>({
  id: '',
  name: '',
  baseProvider: 'speech-noop',
  baseModel: '',
  baseVoice: '',
  effects: {
    pitch: 0,
    rate: 1,
    volume: 100,
    asmr: 0,
    radio: 0,
    robot: 0,
    reverb: 0,
    spatial: 0,
  },
  ust: {
    enabled: true,
    asterisks: 'flatten',
    squareBrackets: 'mute',
    parentheses: 'passThrough',
    angleBrackets: 'flatten',
    customBracketEnabled: false,
    customBracketStart: '',
    customBracketEnd: '',
    customBracketAction: 'passThrough',
    mathFormulas: 'passThrough',
    chemicalNotation: 'passThrough',
    codeBlocks: 'mute',
    readCurrencyNaturally: true,
    readWebAddressesNaturally: true,
    formulaLanguage: 'auto',
    stripEmojis: true,
    stripSymbols: true,
    tildeReplacement: 'nyan',
    customReplacements: [],
  },
})

// Autosave feedback
const hasSaved = ref(false)
let saveTimeout: ReturnType<typeof setTimeout> | undefined

const readCurrencyNaturallyModel = computed({
  get: () => form.value.ust.readCurrencyNaturally !== false,
  set: (val: boolean) => {
    form.value.ust.readCurrencyNaturally = val
    saveProfile()
  },
})

const readWebAddressesNaturallyModel = computed({
  get: () => form.value.ust.readWebAddressesNaturally !== false,
  set: (val: boolean) => {
    form.value.ust.readWebAddressesNaturally = val
    saveProfile()
  },
})

const customBracketEnabledModel = computed({
  get: () => !!form.value.ust.customBracketEnabled,
  set: (val: boolean) => {
    form.value.ust.customBracketEnabled = val
    saveProfile()
  },
})

// Available options for the form based on selection
const availableModels = ref<any[]>([])
const availableVoices = ref<any[]>([])
const isLoadingModels = ref(false)
const isLoadingVoices = ref(false)

async function loadBaseProviderModelsAndVoices() {
  const providerId = form.value.baseProvider
  if (!providerId || providerId === 'speech-noop') {
    availableModels.value = []
    availableVoices.value = []
    return
  }

  isLoadingModels.value = true
  isLoadingVoices.value = true

  try {
    const models = await providersStore.getModelsForProvider(providerId) || []
    availableModels.value = models

    // Attempt to load and fetch voices for base provider
    const voices = await speechStore.loadVoicesForProvider(providerId) || []
    availableVoices.value = voices
  }
  catch (e) {
    console.error('Failed to load base provider choices:', e)
  }
  finally {
    isLoadingModels.value = false
    isLoadingVoices.value = false
  }
}

watch(() => form.value.baseProvider, () => {
  void loadBaseProviderModelsAndVoices()
})

// Helper to determine if an action matches pass-through (handles legacy 'ignore')
function isPassThrough(action?: BracketAction | NotationAction | CodeBlockAction): boolean {
  return action === 'passThrough' || action === 'ignore'
}

// Load profile data into form when selected profile changes
watch(activeProfile, (newProfile) => {
  if (newProfile) {
    const loaded: VoiceProfile = JSON.parse(JSON.stringify(newProfile))

    // Ensure UST structure exists
    if (!loaded.ust) {
      loaded.ust = {
        enabled: true,
        asterisks: 'flatten',
        squareBrackets: 'mute',
        parentheses: 'passThrough',
        angleBrackets: 'flatten',
        customBracketEnabled: false,
        customBracketStart: '',
        customBracketEnd: '',
        customBracketAction: 'passThrough',
        mathFormulas: 'passThrough',
        chemicalNotation: 'passThrough',
        codeBlocks: 'mute',
        readCurrencyNaturally: true,
        readWebAddressesNaturally: true,
        formulaLanguage: 'auto',
        stripEmojis: true,
        stripSymbols: true,
        tildeReplacement: 'nyan',
        customReplacements: [],
      }
    }

    // Auto-migrate legacy UST actions and defaults
    if (loaded.ust.asterisks === 'ignore')
      loaded.ust.asterisks = 'passThrough'
    if (loaded.ust.squareBrackets === 'ignore')
      loaded.ust.squareBrackets = 'passThrough'
    if (loaded.ust.parentheses === 'ignore')
      loaded.ust.parentheses = 'passThrough'
    if (loaded.ust.angleBrackets === 'ignore')
      loaded.ust.angleBrackets = 'passThrough'
    if (loaded.ust.customBracketAction === 'ignore')
      loaded.ust.customBracketAction = 'passThrough'

    if (loaded.ust.readCurrencyNaturally === undefined)
      loaded.ust.readCurrencyNaturally = true
    if (loaded.ust.readWebAddressesNaturally === undefined)
      loaded.ust.readWebAddressesNaturally = true
    if (loaded.ust.mathFormulas === undefined)
      loaded.ust.mathFormulas = 'passThrough'
    if (loaded.ust.chemicalNotation === undefined)
      loaded.ust.chemicalNotation = 'passThrough'
    if (loaded.ust.codeBlocks === undefined)
      loaded.ust.codeBlocks = 'mute'
    if (loaded.ust.formulaLanguage === undefined)
      loaded.ust.formulaLanguage = 'auto'

    form.value = loaded
  }
}, { immediate: true })

// Initialize list
onMounted(async () => {
  const firstReal = savedVoiceProfiles.value.find(p => p.id !== 'voice_profile_auto_preview')
  if (firstReal && !activeProfileId.value) {
    activeProfileId.value = firstReal.id
  }
  else if (!firstReal) {
    createNewProfile()
  }
})

// Profile Actions
function createNewProfile() {
  const id = `voice_profile_${Date.now()}`
  const newProfile: VoiceProfile = {
    id,
    name: 'New Custom Voice',
    baseProvider: 'speech-noop',
    baseModel: '',
    baseVoice: '',
    effects: {
      pitch: 0,
      rate: 1,
      volume: 100,
      asmr: 0,
      radio: 0,
      robot: 0,
      reverb: 0,
      spatial: 0,
    },
    ust: {
      enabled: true,
      asterisks: 'flatten',
      squareBrackets: 'mute',
      parentheses: 'passThrough',
      angleBrackets: 'flatten',
      customBracketEnabled: false,
      customBracketStart: '',
      customBracketEnd: '',
      customBracketAction: 'passThrough',
      mathFormulas: 'passThrough',
      chemicalNotation: 'passThrough',
      codeBlocks: 'mute',
      readCurrencyNaturally: true,
      readWebAddressesNaturally: true,
      formulaLanguage: 'auto',
      stripEmojis: true,
      stripSymbols: true,
      tildeReplacement: 'nyan',
      customReplacements: [],
    },
  }
  speechStore.saveVoiceProfile(newProfile)
  activeProfileId.value = id
}

function saveProfile() {
  if (!form.value.id)
    return
  speechStore.saveVoiceProfile(JSON.parse(JSON.stringify(form.value)))
  hasSaved.value = true
  if (saveTimeout)
    clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    hasSaved.value = false
  }, 2200)
}

function deleteProfile(id: string) {
  speechStore.deleteVoiceProfile(id)
  const remaining = savedVoiceProfiles.value.filter(p => p.id !== 'voice_profile_auto_preview')
  if (activeProfileId.value === id) {
    activeProfileId.value = remaining[0]?.id || ''
  }
  if (remaining.length === 0) {
    createNewProfile()
  }
}

function duplicateProfile(profile: VoiceProfile) {
  const duplicated: VoiceProfile = JSON.parse(JSON.stringify(profile))
  duplicated.id = `voice_profile_${Date.now()}`
  duplicated.name = `${profile.name} (Copy)`
  speechStore.saveVoiceProfile(duplicated)
  activeProfileId.value = duplicated.id
}

// Custom Replacement Rules
function addCustomReplacement() {
  if (!form.value.ust.customReplacements) {
    form.value.ust.customReplacements = []
  }
  form.value.ust.customReplacements.push({
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'text',
    pattern: '',
    replacement: '',
    caseSensitive: false,
    wholeWord: false,
  })
  saveProfile()
}

function removeCustomReplacement(index: number) {
  if (form.value.ust.customReplacements) {
    form.value.ust.customReplacements.splice(index, 1)
    saveProfile()
  }
}

// Playground Logic
const isGenerating = ref(false)
const audioUrl = ref('')
let currentPlayNode: AudioBufferSourceNode | null = null
let currentEffectsCleanup: (() => void) | undefined

function selectPreset(presetId: string) {
  const found = PLAYGROUND_PRESETS.find(p => p.id === presetId)
  if (found) {
    speechStore.playgroundPreset = found.id
    speechStore.playgroundTestText = found.text
  }
}

// Pure reactive preview of transformed text
const previewTransformed = computed(() => {
  return speechStore.applyUSTTransformations(
    speechStore.playgroundTestText,
    form.value.ust,
    form.value.ust.formulaLanguage || speechStore.selectedLanguage,
  )
})

async function playTestVoice() {
  const textToTest = speechStore.playgroundTestText
  if (!textToTest.trim() || isGenerating.value)
    return

  isGenerating.value = true

  try {
    stopTestAudio()

    const providerId = form.value.baseProvider
    const model = form.value.baseModel
    const voiceId = form.value.baseVoice

    if (providerId === 'speech-noop' || !model || !voiceId) {
      console.warn('Sandbox requires provider, model, and voice options to be set')
      isGenerating.value = false
      return
    }

    const provider = await providersStore.getProviderInstance(providerId) as any
    const providerConfig = providersStore.getProviderConfig(providerId)

    // Apply the UST text transformations configured in our form to the text
    const transformedText = speechStore.applyUSTTransformations(
      textToTest,
      form.value.ust,
      form.value.ust.formulaLanguage || speechStore.selectedLanguage,
    )

    if (!transformedText.trim()) {
      console.warn('Transformed text is empty; skipping synthesis')
      isGenerating.value = false
      return
    }

    const response = await generateSpeech({
      ...provider.speech(model, providerConfig),
      input: transformedText,
      voice: voiceId,
    })

    if (!response || response.byteLength === 0) {
      isGenerating.value = false
      return
    }

    // Set downloadable audio source URL
    audioUrl.value = URL.createObjectURL(createAudioBlob(response))

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const audioBuffer = await audioContext.decodeAudioData(response.slice(0))
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    currentPlayNode = source

    // Connect Web Audio API effect nodes
    const effectsResult = applyVoiceProfileEffects(audioContext, source, form.value.effects)
    currentEffectsCleanup = effectsResult.cleanup

    effectsResult.lastNode.connect(audioContext.destination)
    source.start(0)

    source.onended = () => {
      stopTestAudio(false)
    }
  }
  catch (error) {
    console.error('Playground generation error:', error)
  }
  finally {
    isGenerating.value = false
  }
}

function stopTestAudio(clearUrl = true) {
  if (currentPlayNode) {
    try {
      currentPlayNode.stop()
    }
    catch {}
    currentPlayNode = null
  }
  if (currentEffectsCleanup) {
    currentEffectsCleanup()
    currentEffectsCleanup = undefined
  }
  if (clearUrl && audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
})
</script>

<template>
  <div class="w-full flex flex-col gap-6 text-sm">
    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-neutral-200/80 pb-3 dark:border-neutral-800/80">
      <button
        v-for="tab in ([
          { id: 'profile', label: 'Profile' },
          { id: 'cleanup', label: 'Speech Cleanup' },
          { id: 'effects', label: 'Audio Effects' },
        ] as const)"
        :key="tab.id"
        type="button"
        :class="[
          'flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
          activeTab === tab.id
            ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs'
            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/50',
        ]"
        @click="activeTab = tab.id"
      >
        <span>{{ tab.label }}</span>
        <span
          v-if="tab.id === 'cleanup' && form.ust.enabled"
          class="rounded-full bg-primary-500/10 px-1.5 py-0.2 text-[9px] text-primary-600 font-bold dark:text-primary-400"
        >
          Enabled
        </span>
      </button>
    </div>

    <!-- 2-COLUMN SPLIT-SCREEN WORKSPACE -->
    <div class="w-full flex flex-col items-start gap-6 lg:flex-row">
      <!-- LEFT COLUMN: CONFIGURATION STREAM (58%) -->
      <div class="w-full flex flex-1 flex-col gap-6 lg:w-[58%]">
        <!-- ================= TAB: SPEECH CLEANUP (UST) ================= -->
        <template v-if="activeTab === 'cleanup'">
          <!-- CARD 1: Universal Speech Transformer & Brackets -->
          <div
            :class="[
              'border border-neutral-200/70 dark:border-neutral-800/60 rounded-2xl',
              'bg-white/70 dark:bg-neutral-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm',
              'flex flex-col gap-5',
            ]"
          >
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
                  Universal Speech Transformer
                </h3>
                <p class="text-xs text-neutral-400 dark:text-neutral-500">
                  Clean and transform text before sending to voice provider.
                </p>
              </div>
              <FieldCheckbox
                v-model="form.ust.enabled"
                hide-description
                @update:model-value="saveProfile"
              />
            </div>

            <div v-if="form.ust.enabled" class="flex flex-col gap-4">
              <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
                Brackets & stage directions:
              </span>

              <div class="flex flex-col gap-3.5 border border-neutral-200/60 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800/60 dark:bg-neutral-950/40">
                <!-- Asterisks -->
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Asterisks (*...*)</span>
                    <span class="text-[10px] text-neutral-400">Used for italics, actions, or emotes</span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      v-for="act in (['mute', 'flatten', 'passThrough'] as const)"
                      :key="act"
                      type="button"
                      :class="[
                        'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                        (act === 'passThrough' ? isPassThrough(form.ust.asterisks) : form.ust.asterisks === act)
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                      ]"
                      @click="form.ust.asterisks = act; saveProfile()"
                    >
                      {{ act === 'passThrough' ? 'Pass through' : act === 'flatten' ? 'Flatten' : 'Mute' }}
                    </button>
                  </div>
                </div>

                <!-- Square Brackets -->
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Square Brackets ([...])</span>
                    <span class="text-[10px] text-neutral-400">Used for emotions, states, or ACT cues</span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      v-for="act in (['mute', 'flatten', 'passThrough', 'token'] as const)"
                      :key="act"
                      type="button"
                      :class="[
                        'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                        (act === 'passThrough' ? isPassThrough(form.ust.squareBrackets) : form.ust.squareBrackets === act)
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                      ]"
                      @click="form.ust.squareBrackets = act; saveProfile()"
                    >
                      {{ act === 'token' ? 'To token' : act === 'passThrough' ? 'Pass through' : act === 'flatten' ? 'Flatten' : 'Mute' }}
                    </button>
                  </div>
                </div>

                <!-- Parentheses -->
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Parentheses ((...))</span>
                    <span class="text-[10px] text-neutral-400">Used for whispers or background info</span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      v-for="act in (['mute', 'flatten', 'passThrough'] as const)"
                      :key="act"
                      type="button"
                      :class="[
                        'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                        (act === 'passThrough' ? isPassThrough(form.ust.parentheses) : form.ust.parentheses === act)
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                      ]"
                      @click="form.ust.parentheses = act; saveProfile()"
                    >
                      {{ act === 'passThrough' ? 'Pass through' : act === 'flatten' ? 'Flatten' : 'Mute' }}
                    </button>
                  </div>
                </div>

                <!-- Angle Brackets -->
                <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div class="flex flex-col">
                    <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Angle Brackets (&lt;...&gt;)</span>
                    <span class="text-[10px] text-neutral-400">Used for speech indicators or tags</span>
                  </div>
                  <div class="flex gap-1.5">
                    <button
                      v-for="act in (['mute', 'flatten', 'passThrough'] as const)"
                      :key="act"
                      type="button"
                      :class="[
                        'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                        (act === 'passThrough' ? isPassThrough(form.ust.angleBrackets) : form.ust.angleBrackets === act)
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                      ]"
                      @click="form.ust.angleBrackets = act; saveProfile()"
                    >
                      {{ act === 'passThrough' ? 'Pass through' : act === 'flatten' ? 'Flatten' : 'Mute' }}
                    </button>
                  </div>
                </div>

                <!-- Custom Bracket Definition -->
                <div class="mt-1 border-t border-neutral-200/60 pt-3 dark:border-neutral-800/60">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">+ Custom bracket delimiter</span>
                    <FieldCheckbox
                      v-model="customBracketEnabledModel"
                      hide-description
                    />
                  </div>

                  <div v-if="form.ust.customBracketEnabled" class="grid grid-cols-1 mt-3 gap-3 sm:grid-cols-3">
                    <FieldInput
                      v-model="form.ust.customBracketStart"
                      label="Start Symbol"
                      placeholder="e.g. {"
                      @update:model-value="saveProfile"
                    />
                    <FieldInput
                      v-model="form.ust.customBracketEnd"
                      label="End Symbol"
                      placeholder="e.g. }"
                      @update:model-value="saveProfile"
                    />
                    <div class="flex flex-col gap-1.5">
                      <label class="text-xs text-neutral-500 font-semibold">Action</label>
                      <select
                        v-model="form.ust.customBracketAction"
                        class="w-full border border-neutral-200 rounded-xl bg-white px-3 py-2 text-xs outline-none dark:border-neutral-800 dark:bg-neutral-900"
                        @change="saveProfile"
                      >
                        <option value="mute">
                          Mute
                        </option>
                        <option value="flatten">
                          Flatten
                        </option>
                        <option value="passThrough">
                          Pass through
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Inline Syntax Legend -->
                <div class="border-t border-neutral-200/60 pt-2 text-[11px] text-neutral-400 dark:border-neutral-800/60 dark:text-neutral-500">
                  <span class="text-neutral-600 font-medium dark:text-neutral-400">Mute:</span> skip contents ·
                  <span class="text-neutral-600 font-medium dark:text-neutral-400">Flatten:</span> keep text, remove markers ·
                  <span class="text-neutral-600 font-medium dark:text-neutral-400">Pass through:</span> unchanged
                </div>
              </div>
            </div>
          </div>

          <!-- CARD 2: Notation & Technical Speech -->
          <div
            v-if="form.ust.enabled"
            :class="[
              'border border-neutral-200/70 dark:border-neutral-800/60 rounded-2xl',
              'bg-white/70 dark:bg-neutral-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm',
              'flex flex-col gap-4',
            ]"
          >
            <div>
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
                Notation & technical speech
              </h3>
              <p class="text-xs text-neutral-400 dark:text-neutral-500">
                Choose how technical content, formulas, and prices are spoken.
              </p>
            </div>

            <div class="flex flex-col gap-3.5 border border-neutral-200/60 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800/60 dark:bg-neutral-950/40">
              <!-- Math Formulas -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Math formulas</span>
                  <span class="text-[10px] text-neutral-400">LaTeX & KaTeX equations ($x^2$, \[\dots\])</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['verbalize', 'mute', 'passThrough'] as const)"
                    :key="act"
                    type="button"
                    :class="[
                      'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                      (act === 'passThrough' ? isPassThrough(form.ust.mathFormulas) : form.ust.mathFormulas === act)
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                    ]"
                    @click="form.ust.mathFormulas = act; saveProfile()"
                  >
                    {{ act === 'verbalize' ? 'Verbalize' : act === 'passThrough' ? 'Pass through' : 'Mute' }}
                  </button>
                </div>
              </div>

              <!-- Chemical Notation -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Chemical notation</span>
                  <span class="text-[10px] text-neutral-400">mhchem formulas (\ce{H2O}, \ce{CO2})</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['verbalize', 'mute', 'passThrough'] as const)"
                    :key="act"
                    type="button"
                    :class="[
                      'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                      (act === 'passThrough' ? isPassThrough(form.ust.chemicalNotation) : form.ust.chemicalNotation === act)
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                    ]"
                    @click="form.ust.chemicalNotation = act; saveProfile()"
                  >
                    {{ act === 'verbalize' ? 'Verbalize' : act === 'passThrough' ? 'Pass through' : 'Mute' }}
                  </button>
                </div>
              </div>

              <!-- Code Blocks -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">Code blocks</span>
                  <span class="text-[10px] text-neutral-400">Fenced markdown blocks (```...```)</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['mute', 'passThrough'] as const)"
                    :key="act"
                    type="button"
                    :class="[
                      'border rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                      (act === 'passThrough' ? isPassThrough(form.ust.codeBlocks) : (form.ust.codeBlocks === act || (act === 'mute' && form.ust.codeBlocks === undefined)))
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                    ]"
                    @click="form.ust.codeBlocks = act; saveProfile()"
                  >
                    {{ act === 'passThrough' ? 'Pass through' : 'Mute' }}
                  </button>
                </div>
              </div>

              <!-- Read currency naturally -->
              <div class="border-t border-neutral-200/60 pt-3 dark:border-neutral-800/60">
                <FieldCheckbox
                  v-model="readCurrencyNaturallyModel"
                  label="Read currency naturally ($19.99 → words)"
                  description="Expands dollar signs and prices into natural spoken words before synthesis"
                />
              </div>

              <!-- Read web addresses & links naturally -->
              <div class="border-t border-neutral-200/60 pt-3 dark:border-neutral-800/60">
                <FieldCheckbox
                  v-model="readWebAddressesNaturallyModel"
                  label="Read web addresses & links naturally"
                  description="Expands URLs, file paths, and Obsidian wiki-links into natural spoken words before synthesis"
                />
              </div>

              <!-- Formula Language -->
              <div class="flex items-center justify-between border-t border-neutral-200/60 pt-3 dark:border-neutral-800/60">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">Formula language</span>
                  <span class="text-[10px] text-neutral-400">Language locale for spoken math expressions</span>
                </div>
                <select
                  v-model="form.ust.formulaLanguage"
                  class="border border-neutral-200 rounded-lg bg-white px-2.5 py-1.5 text-xs outline-none dark:border-neutral-800 dark:bg-neutral-900"
                  @change="saveProfile"
                >
                  <option value="auto">
                    Auto · Voice profile
                  </option>
                  <option value="en">
                    English (en)
                  </option>
                  <option value="ja">
                    Japanese (ja)
                  </option>
                  <option value="ko">
                    Korean (ko)
                  </option>
                  <option value="zh">
                    Chinese (zh)
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- CARD 3: Symbols & Replacements -->
          <div
            v-if="form.ust.enabled"
            :class="[
              'border border-neutral-200/70 dark:border-neutral-800/60 rounded-2xl',
              'bg-white/70 dark:bg-neutral-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm',
              'flex flex-col gap-4',
            ]"
          >
            <div>
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
                Symbols & replacements
              </h3>
              <p class="text-xs text-neutral-400 dark:text-neutral-500">
                Clean pictographs and define custom regex or plain text substitution rules.
              </p>
            </div>

            <!-- Emojis and Symbols -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldCheckbox
                v-model="form.ust.stripEmojis"
                label="Strip Emojis"
                description="Wipes Unicode pictographs so TTS does not create awkward pauses"
                @update:model-value="saveProfile"
              />

              <FieldCheckbox
                v-model="form.ust.stripSymbols"
                label="Strip Symbols & Kaomoji"
                description="Wipes non-alphanumeric symbols and kaomoji (Extreme Cleaning)"
                @update:model-value="saveProfile"
              />

              <div class="md:col-span-2">
                <FieldInput
                  v-model="form.ust.tildeReplacement"
                  label="Tilde (~) Replacement String"
                  description="Word to read when tildes are spoken (e.g. 'nyan'). Leave blank to purge."
                  placeholder="e.g. nyan"
                  @update:model-value="saveProfile"
                />
              </div>
            </div>

            <!-- Custom Replacement Rules -->
            <div class="flex flex-col gap-3 border-t border-neutral-200/60 pt-4 dark:border-neutral-800/60">
              <div class="flex items-center justify-between">
                <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
                  Custom replacement rules ({{ form.ust.customReplacements?.length || 0 }})
                </span>
                <button
                  type="button"
                  class="flex cursor-pointer items-center gap-1 border border-primary-500/30 rounded-lg bg-primary-500/10 px-2 py-1 text-xs text-primary-600 font-semibold hover:bg-primary-500/20 dark:text-primary-400"
                  @click="addCustomReplacement"
                >
                  <span class="text-xs">+ Add rule</span>
                </button>
              </div>

              <div v-if="form.ust.customReplacements && form.ust.customReplacements.length > 0" class="flex flex-col gap-3">
                <div
                  v-for="(rule, index) in form.ust.customReplacements"
                  :key="rule.id"
                  class="flex flex-col gap-3 border border-neutral-200/60 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-800/60 dark:bg-neutral-950/40"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        class="cursor-pointer border rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all"
                        :class="[
                          rule.type === 'text'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                        ]"
                        @click="rule.type = 'text'; saveProfile()"
                      >
                        Plain Text
                      </button>
                      <button
                        type="button"
                        class="cursor-pointer border rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all"
                        :class="[
                          rule.type === 'regex'
                            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                            : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                        ]"
                        @click="rule.type = 'regex'; saveProfile()"
                      >
                        Regex Match
                      </button>
                    </div>

                    <button
                      type="button"
                      class="cursor-pointer text-[11px] text-red-500 font-bold hover:underline"
                      @click="removeCustomReplacement(index)"
                    >
                      Remove
                    </button>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldInput
                      v-model="rule.pattern"
                      label="Search Pattern"
                      :placeholder="rule.type === 'regex' ? 'e.g. /nya/i' : 'e.g. Nya'"
                      @update:model-value="saveProfile"
                    />
                    <FieldInput
                      v-model="rule.replacement"
                      label="Replacement"
                      placeholder="e.g. meow"
                      @update:model-value="saveProfile"
                    />
                  </div>

                  <div v-if="rule.type === 'text'" class="flex items-center gap-4">
                    <FieldCheckbox
                      v-model="rule.caseSensitive"
                      label="Case Sensitive"
                      hide-description
                      @update:model-value="saveProfile"
                    />
                    <FieldCheckbox
                      v-model="rule.wholeWord"
                      label="Whole Word Only"
                      hide-description
                      @update:model-value="saveProfile"
                    />
                  </div>
                </div>
              </div>
              <p v-else class="py-2 text-center text-xs text-neutral-400 italic">
                No custom replacement rules defined yet.
              </p>
            </div>
          </div>

          <!-- Autosave state indicator -->
          <div class="flex items-center gap-2 py-1 text-xs text-neutral-400 dark:text-neutral-500">
            <div v-if="hasSaved" class="flex items-center gap-1.5 text-emerald-600 font-medium transition-opacity dark:text-emerald-400">
              <div class="i-solar:check-circle-bold text-sm" />
              <span>Changes saved</span>
            </div>
            <div v-else class="flex items-center gap-1.5 text-neutral-400">
              <div class="i-solar:shield-check-linear text-xs" />
              <span>Settings autosaved</span>
            </div>
          </div>
        </template>

        <!-- ================= TAB: PROFILE SETTINGS ================= -->
        <template v-else-if="activeTab === 'profile'">
          <div
            :class="[
              'border border-neutral-200/70 dark:border-neutral-800/60 rounded-2xl',
              'bg-white/70 dark:bg-neutral-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm',
              'flex flex-col gap-6',
            ]"
          >
            <div>
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
                Voice Settings Profile
              </h3>
              <p class="text-xs text-neutral-400 dark:text-neutral-500">
                Link this profile to a base provider engine and define custom name
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FieldInput
                v-model="form.name"
                label="Profile Name"
                description="Give your virtual voice profile a recognizable name"
                placeholder="e.g. Neuro Ashley"
                @update:model-value="saveProfile"
              />

              <div class="flex flex-col gap-1.5">
                <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">Base Provider</label>
                <select
                  v-model="form.baseProvider"
                  class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                  @change="saveProfile"
                >
                  <option value="speech-noop">
                    None (No-op)
                  </option>
                  <option
                    v-for="provider in allAudioSpeechProvidersMetadata.filter(p => p.id !== 'virtual-audio-studio' && p.id !== 'speech-noop')"
                    :key="provider.id"
                    :value="provider.id"
                  >
                    {{ provider.name }}
                  </option>
                </select>
              </div>

              <div v-if="form.baseProvider !== 'speech-noop'" class="flex flex-col gap-1.5">
                <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">Model</label>
                <div v-if="isLoadingModels" class="animate-pulse text-xs text-neutral-400">
                  Loading models...
                </div>
                <select
                  v-else
                  v-model="form.baseModel"
                  class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                  @change="saveProfile"
                >
                  <option value="">
                    Select a model
                  </option>
                  <option
                    v-for="model in availableModels"
                    :key="model.id"
                    :value="model.id"
                  >
                    {{ model.name || model.id }}
                  </option>
                </select>
              </div>

              <div v-if="form.baseProvider !== 'speech-noop'" class="flex flex-col gap-1.5">
                <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">Voice</label>
                <div v-if="isLoadingVoices" class="animate-pulse text-xs text-neutral-400">
                  Loading voices...
                </div>
                <template v-else>
                  <select
                    v-if="availableVoices.length > 0"
                    v-model="form.baseVoice"
                    class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                    @change="saveProfile"
                  >
                    <option value="">
                      Select a voice
                    </option>
                    <option
                      v-for="voice in availableVoices"
                      :key="voice.id"
                      :value="voice.id"
                    >
                      {{ voice.name || voice.id }}
                    </option>
                  </select>
                  <input
                    v-else
                    v-model="form.baseVoice"
                    type="text"
                    placeholder="Enter voice name manually (e.g. Abigail)"
                    class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                    @change="saveProfile"
                  >
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- ================= TAB: AUDIO EFFECTS (DSP) ================= -->
        <template v-else-if="activeTab === 'effects'">
          <div
            :class="[
              'border border-neutral-200/70 dark:border-neutral-800/60 rounded-2xl',
              'bg-white/70 dark:bg-neutral-900/60 p-5 md:p-6 shadow-sm backdrop-blur-sm',
              'flex flex-col gap-6',
            ]"
          >
            <div>
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-200">
                Audio Transformation Effects (DSP)
              </h3>
              <p class="text-xs text-neutral-400 dark:text-neutral-500">
                Adjust Web Audio API synthesis effects in real time
              </p>
            </div>

            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FieldRange
                v-model="form.effects.pitch"
                label="Pitch Tuning"
                description="Scales sample pitch via playback rate"
                :min="-100"
                :max="100"
                :step="1"
                :format-value="val => `${val}%`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.rate"
                label="Speech Speed"
                description="Adjust general speech rate multiplier"
                :min="0.5"
                :max="2.5"
                :step="0.05"
                :format-value="val => `${val}x`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.asmr"
                label="ASMR Intimacy / Softness"
                description="Dampens high sibilants and adds voice compression"
                :min="0"
                :max="100"
                :step="1"
                :format-value="val => `${val}%`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.radio"
                label="Retro Radio Filter"
                description="Applies telephone bandpass frequency cuts"
                :min="0"
                :max="100"
                :step="1"
                :format-value="val => `${val}%`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.robot"
                label="Robotic Comb Delay"
                description="Feedback metallic echo droid ring modulation"
                :min="0"
                :max="100"
                :step="1"
                :format-value="val => `${val}%`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.reverb"
                label="Cathedral Reverb / Space Echo"
                description="350ms multi-tap delay acoustics decay"
                :min="0"
                :max="100"
                :step="1"
                :format-value="val => `${val}%`"
                @update:model-value="saveProfile"
              />

              <FieldRange
                v-model="form.effects.spatial"
                label="Stereo Panning"
                description="Shift voice placement left to right"
                :min="-100"
                :max="100"
                :step="1"
                :format-value="val => val === 0 ? 'Center' : val < 0 ? `Left ${Math.abs(val)}%` : `Right ${val}%`"
                @update:model-value="saveProfile"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- RIGHT COLUMN: STICKY VOICE PROFILE & PLAYGROUND (42%) -->
      <div
        :class="[
          'w-full lg:w-[42%] lg:sticky lg:top-6 self-start flex flex-col gap-4',
        ]"
      >
        <div
          :class="[
            'border border-neutral-200/90 dark:border-neutral-800/90 rounded-2xl',
            'bg-white/80 dark:bg-neutral-900/80 p-5 shadow-sm backdrop-blur-md',
            'flex flex-col gap-4',
          ]"
        >
          <!-- Card Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="i-solar:soundwave-bold-duotone text-lg text-primary-500" />
              <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
                Voice Profile
              </h3>
            </div>
            <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-400 font-medium dark:bg-neutral-800/70 dark:text-neutral-500">
              📌 Follows scroll
            </span>
          </div>
          <p class="text-xs text-neutral-500 -mt-2 dark:text-neutral-400">
            Test this profile as you tune settings.
          </p>

          <!-- Voice Profile Selector & Quick Actions -->
          <div class="flex items-center gap-2">
            <!-- Searchable Profile Popover -->
            <PopoverRoot v-model:open="isProfilePopoverOpen">
              <PopoverTrigger as-child>
                <button
                  type="button"
                  :class="[
                    'flex-1 min-w-0 flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-all',
                    'border border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80',
                    'shadow-xs backdrop-blur-md',
                  ]"
                >
                  <div class="min-w-0 flex items-center gap-1.5 truncate">
                    <div class="i-solar:soundwave-bold shrink-0 text-sm text-primary-500" />
                    <span class="truncate text-neutral-800 font-semibold dark:text-neutral-200">
                      {{ form.name || 'Select Profile' }}
                    </span>
                    <span class="text-[10px] text-neutral-400">·</span>
                    <span class="truncate text-[11px] text-neutral-500">
                      {{ form.baseProvider !== 'speech-noop' ? form.baseProvider : 'Unbound' }}
                    </span>
                  </div>
                  <div class="i-solar:alt-arrow-down-linear shrink-0 text-xs text-neutral-400" />
                </button>
              </PopoverTrigger>

              <PopoverPortal>
                <PopoverContent
                  align="start"
                  :side-offset="8"
                  :class="[
                    'z-[10050] w-72 p-2 rounded-2xl border border-neutral-200/90 dark:border-neutral-800/90',
                    'bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-xl duration-150',
                  ]"
                >
                  <!-- Search filter input -->
                  <div class="relative mb-2 flex items-center px-1">
                    <div class="i-solar:magnifer-linear pointer-events-none absolute left-3 text-xs text-neutral-400" />
                    <input
                      v-model="searchQuery"
                      type="text"
                      placeholder="Filter profiles..."
                      class="w-full border border-neutral-200 rounded-lg bg-neutral-50 py-1.5 pl-7 pr-7 text-xs text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800/50 dark:text-neutral-200"
                    >
                    <button
                      v-if="searchQuery"
                      class="absolute right-3 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      @click="searchQuery = ''"
                    >
                      <div class="i-solar:close-circle-bold" />
                    </button>
                  </div>

                  <!-- Profiles List -->
                  <div class="max-h-56 flex flex-col gap-1 overflow-y-auto pr-1">
                    <button
                      v-for="profile in filteredVoiceProfiles"
                      :key="profile.id"
                      type="button"
                      :class="[
                        'flex items-center justify-between w-full p-2 rounded-xl text-left transition-all cursor-pointer',
                        activeProfileId === profile.id
                          ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300',
                      ]"
                      @click="activeProfileId = profile.id; isProfilePopoverOpen = false"
                    >
                      <div class="min-w-0 flex items-center gap-2">
                        <div
                          v-if="activeProfileId === profile.id"
                          class="i-solar:check-circle-bold shrink-0 text-sm text-primary-500"
                        />
                        <div v-else class="w-3.5 shrink-0" />
                        <div class="min-w-0 flex flex-col">
                          <span class="truncate text-xs font-semibold">{{ profile.name }}</span>
                          <span class="truncate text-[10px] text-neutral-400">
                            {{ profile.baseProvider !== 'speech-noop' ? `${profile.baseProvider} / ${profile.baseVoice || 'default'}` : 'Not bound' }}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div v-if="filteredVoiceProfiles.length === 0" class="py-4 text-center text-xs text-neutral-400">
                      No profiles found
                    </div>
                  </div>

                  <!-- Footer Action -->
                  <div class="mt-2 border-t border-neutral-100 pt-2 dark:border-neutral-800/80">
                    <button
                      type="button"
                      class="w-full flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs text-primary-600 font-semibold transition-colors hover:bg-primary-500/10 dark:text-primary-400"
                      @click="createNewProfile(); isProfilePopoverOpen = false"
                    >
                      <div class="i-solar:add-circle-bold text-sm" />
                      <span>New voice profile</span>
                    </button>
                  </div>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>

            <!-- New Profile Quick Button -->
            <button
              type="button"
              :class="[
                'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                'border border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80',
                'text-neutral-700 dark:text-neutral-300 shadow-xs shrink-0',
              ]"
              @click="createNewProfile"
            >
              <div class="i-solar:add-circle-bold text-sm text-neutral-500" />
              <span>New</span>
            </button>

            <!-- Secondary Actions Popover (Duplicate, Delete) -->
            <PopoverRoot>
              <PopoverTrigger as-child>
                <button
                  type="button"
                  :class="[
                    'flex items-center justify-center p-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer',
                    'border border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-800/60 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80',
                    'text-neutral-500 shadow-xs shrink-0',
                  ]"
                  title="More actions"
                >
                  <div class="i-solar:menu-dots-bold text-sm" />
                </button>
              </PopoverTrigger>
              <PopoverPortal>
                <PopoverContent
                  align="end"
                  :side-offset="8"
                  :class="[
                    'z-[10050] w-40 p-1.5 rounded-xl border border-neutral-200/90 dark:border-neutral-800/90',
                    'bg-white/95 dark:bg-neutral-900/95 shadow-xl backdrop-blur-xl',
                  ]"
                >
                  <button
                    type="button"
                    class="w-full flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 font-medium transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    @click="activeProfile && duplicateProfile(activeProfile)"
                  >
                    <div class="i-solar:copy-bold-duotone text-sm text-neutral-400" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    class="w-full flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 font-medium transition-colors hover:bg-red-500/10 dark:text-red-400"
                    @click="deleteProfile(activeProfileId)"
                  >
                    <div class="i-solar:trash-bin-trash-bold-duotone text-sm text-red-500" />
                    <span>Delete profile</span>
                  </button>
                </PopoverContent>
              </PopoverPortal>
            </PopoverRoot>
          </div>

          <!-- Test text input -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <label class="text-neutral-700 font-medium dark:text-neutral-300">Test text:</label>
              <span class="text-[10px] text-neutral-400">{{ speechStore.playgroundTestText.length }} chars</span>
            </div>
            <Textarea
              v-model="speechStore.playgroundTestText"
              :rows="3"
              class="w-full text-xs font-mono"
              placeholder="Type dialogue to test speech transformations..."
            />
          </div>

          <!-- Presets & Transform button -->
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <select
                :value="speechStore.playgroundPreset"
                class="w-full truncate border border-neutral-200 rounded-lg bg-neutral-50 px-2 py-1 text-xs text-neutral-700 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800/60 dark:text-neutral-300"
                @change="e => selectPreset((e.target as HTMLSelectElement).value)"
              >
                <option
                  v-for="preset in PLAYGROUND_PRESETS"
                  :key="preset.id"
                  :value="preset.id"
                >
                  {{ preset.label }}
                </option>
              </select>
            </div>

            <button
              type="button"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all',
                'border border-primary-500/30 bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 active:scale-95 shrink-0',
              ]"
              title="Preview transformation without TTS request"
            >
              <div class="i-solar:magic-stick-3-bold text-xs" />
              <span>Transform text</span>
            </button>
          </div>

          <!-- Transformed preview (Text sent to TTS) -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-neutral-700 font-medium dark:text-neutral-300">Text sent to TTS:</span>
              <span class="text-[10px] text-primary-600 font-medium dark:text-primary-400">Live preview</span>
            </div>
            <div
              :class="[
                'w-full min-h-[64px] max-h-[140px] overflow-y-auto p-2.5 rounded-xl text-xs font-mono',
                'border border-neutral-200/80 dark:border-neutral-800/80',
                'bg-neutral-50/80 dark:bg-neutral-950/50 text-neutral-800 dark:text-neutral-200',
                'whitespace-pre-wrap select-text',
              ]"
            >
              <template v-if="previewTransformed.length > 0">
                {{ previewTransformed }}
              </template>
              <span v-else class="text-neutral-400 italic">
                (No speech output · all content muted or empty)
              </span>
            </div>
            <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
              Text preview · no speech request
            </span>
          </div>

          <div class="h-px w-full bg-neutral-200/60 dark:bg-neutral-800/60" />

          <!-- Synthesis & Playback section -->
          <div class="flex flex-col gap-2">
            <span class="text-xs text-neutral-700 font-medium dark:text-neutral-300">
              Listen with current settings:
            </span>

            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="isGenerating || form.baseProvider === 'speech-noop' || !form.baseVoice"
                :class="[
                  'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  'border border-primary-500 bg-primary-500 text-white shadow-xs',
                  'hover:bg-primary-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                ]"
                @click="playTestVoice"
              >
                <div v-if="isGenerating" class="i-solar:spinner-line-duotone animate-spin text-sm" />
                <div v-else class="i-solar:play-circle-bold text-sm" />
                <span>{{ isGenerating ? 'Generating audio...' : 'Generate & play' }}</span>
              </button>

              <button
                type="button"
                :class="[
                  'p-2 rounded-xl text-xs border border-neutral-300 dark:border-neutral-700 transition-all cursor-pointer',
                  'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400',
                ]"
                title="Stop playback"
                @click="stopTestAudio(true)"
              >
                <div class="i-solar:stop-circle-bold text-base" />
              </button>
            </div>

            <div v-if="audioUrl" class="mt-1">
              <audio :src="audioUrl" controls class="h-8 w-full" />
            </div>

            <div class="mt-1 flex flex-col gap-0.5 text-[10px] text-neutral-400 dark:text-neutral-500">
              <span>Uses your TTS provider. Includes audio FX.</span>
              <span>✓ Up to date · Test text stays on tab switch</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
