<script setup lang="ts">
import { useIdleAnimations } from '@proj-airi/stage-ui/composables'
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsUserProfile } from '@proj-airi/stage-ui/stores/settings/user-profile'
import { Button, FieldInput, Select } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import ImageTagExtractorModal from './ImageTagExtractorModal.vue'
import VoiceCreatorModal from './VoiceCreatorModal.vue'

interface ConceptData {
  description: string
  prompt: string
  isBase?: boolean
  idleAnimations?: string[]
  textColor?: string
  artistry?: {
    provider?: string
    model?: string
    options?: any
  }
  manifestation?: {
    modelId?: string
    mood?: string
    backgroundId?: string
    active_expressions?: Record<string, number>
  }
  speech?: {
    provider?: string
    model?: string
    voice_id?: string
  }
}

interface Props {
  modelValue: boolean
  conceptId?: string
  initialData?: ConceptData
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', payload: { id: string, data: ConceptData, clone: boolean }): void
}>()

const artistryStore = useArtistryStore()
const displayModelsStore = useDisplayModelsStore()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const backgroundStore = useBackgroundStore()
const airiCardStore = useAiriCardStore()
const userProfileStore = useSettingsUserProfile()
const selectedModelId = ref<string>('inherit')
const selectedExpressions = ref<Record<string, number>>({})

const availableExpressions = ref<{ key: string, name: string, type: 'live2d' | 'vrm' | 'spine' | 'mmd' }[]>([])

watch(selectedModelId, async (newId) => {
  if (!newId || newId === 'inherit') {
    availableExpressions.value = []
    return
  }
  const model = displayModelsStore.displayModels.find(m => m.id === newId)
  if (!model) {
    availableExpressions.value = []
    return
  }
  const caps = await displayModelsStore.getOrLoadModelCapabilities(newId)
  const list: { key: string, name: string, type: 'live2d' | 'vrm' | 'spine' | 'mmd' }[] = []

  const modelType = model.format.toLowerCase()
  const displayType = modelType.includes('live2d') ? 'live2d' : (modelType === 'vrm' ? 'vrm' : (modelType.includes('spine') ? 'spine' : 'mmd'))

  caps.expressions.forEach((name) => {
    list.push({ key: name, name, type: displayType })
  })
  availableExpressions.value = list
}, { immediate: true })

function toggleExpression(key: string) {
  if (selectedExpressions.value[key] !== undefined) {
    delete selectedExpressions.value[key]
  }
  else {
    selectedExpressions.value[key] = 1
  }
  selectedExpressions.value = { ...selectedExpressions.value }
}

function isExpressionActive(key: string) {
  return selectedExpressions.value[key] !== undefined && selectedExpressions.value[key] > 0
}

const { activeSpeechProvider } = storeToRefs(speechStore)

const activeTab = ref('identity')
const id = ref('')
const description = ref('')
const prompt = ref('')
const textColor = ref('')

// Image Tag Extractor State
const showTagExtractorModal = ref(false)
const extractorModelId = computed(() => {
  if (selectedModelId.value && selectedModelId.value !== 'inherit') {
    return selectedModelId.value
  }
  // Inherit active card's display model ID
  return airiCardStore.activeCard?.extensions?.airi?.modules?.displayModelId || ''
})

const hasManifestationModel = computed(() => {
  return !!extractorModelId.value
})

function handleTagExtractorApply(tags: string) {
  if (prompt.value) {
    const trimmed = prompt.value.trim()
    if (trimmed && !trimmed.endsWith(',')) {
      prompt.value = `${trimmed}, ${tags}`
    }
    else {
      prompt.value = `${trimmed} ${tags}`
    }
  }
  else {
    prompt.value = tags
  }
}

const conceptIds = computed(() => {
  return Object.keys(airiCardStore.activeCard?.extensions?.airi?.visual_assets || {})
    .filter(id => id !== props.conceptId)
})

function appendPromptTag(tag: string) {
  if (!tag)
    return
  const current = prompt.value.trim()
  if (!current) {
    prompt.value = tag
  }
  else if (current.endsWith(',')) {
    prompt.value = `${current} ${tag}`
  }
  else {
    prompt.value = `${current}, ${tag}`
  }
}

function handleLoadUserProfile() {
  if (!id.value) {
    id.value = 'concept_user'
  }
  if (!description.value) {
    description.value = userProfileStore.description || ''
  }
  appendPromptTag(userProfileStore.prompt || '')
}

// Concept Type
const isBase = ref(false)

// Artistry Overrides
const selectedProvider = ref<string>('inherit')
const selectedModel = ref<string>('')
const selectedOptionsStr = ref<string>('{\n  \n}')

// Manifestation Overrides
const selectedMood = ref<string>('')

// Speech Overrides
const selectedSpeechProvider = ref<string>('inherit')
const selectedSpeechModel = ref<string>('')
const selectedSpeechVoiceId = ref<string>('')
const showVoiceCreator = ref(false)

// Scene Overrides
const selectedBackgroundId = ref<string>('inherit')

// Director status (determines if Scene tab is functional)
const isDirectorActive = computed(() => {
  return airiCardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

// Initialize when modal opens or props change
watch(() => [props.modelValue, props.conceptId, props.initialData], () => {
  if (props.modelValue) {
    activeTab.value = 'identity'
    id.value = props.conceptId || ''
    description.value = props.initialData?.description || ''
    prompt.value = props.initialData?.prompt || ''
    textColor.value = props.initialData?.textColor || ''

    isBase.value = props.initialData?.isBase ?? false

    selectedProvider.value = props.initialData?.artistry?.provider || 'inherit'
    selectedModel.value = props.initialData?.artistry?.model || ''
    selectedOptionsStr.value = props.initialData?.artistry?.options
      ? JSON.stringify(props.initialData.artistry.options, null, 2)
      : '{\n  \n}'

    selectedModelId.value = props.initialData?.manifestation?.modelId || 'inherit'
    selectedMood.value = props.initialData?.manifestation?.mood || ''
    selectedSpeechProvider.value = props.initialData?.speech?.provider || 'inherit'
    selectedSpeechModel.value = props.initialData?.speech?.model || ''
    selectedSpeechVoiceId.value = props.initialData?.speech?.voice_id || ''

    selectedBackgroundId.value = props.initialData?.manifestation?.backgroundId || 'inherit'

    selectedExpressions.value = props.initialData?.manifestation?.active_expressions
      ? { ...props.initialData.manifestation.active_expressions }
      : {}

    selectedIdleAnimations.value = props.initialData?.idleAnimations
      ? [...props.initialData.idleAnimations]
      : []
  }
}, { immediate: true })

const manifestationSearch = ref('')
const manifestationFormatFilter = ref<'all' | 'live2d' | 'vrm' | 'spine' | 'mmd'>('all')

const selectedIdleAnimations = ref<string[]>([])
const newIdleAnimInput = ref('')
const isAnimDropdownOpen = ref(false)
const highlightedIndex = ref(0)

const { getAvailableModelMotions } = useIdleAnimations()

const availableMotionsForSelectedModel = computed(() => {
  return getAvailableModelMotions(selectedModelId.value)
})

const filteredDropdownOptions = computed(() => {
  const query = newIdleAnimInput.value.trim().toLowerCase()
  const motions = availableMotionsForSelectedModel.value

  if (!query) {
    return motions.filter(m => !selectedIdleAnimations.value.includes(m)).slice(0, 50)
  }

  return motions.filter(
    m => m.toLowerCase().includes(query) && !selectedIdleAnimations.value.includes(m),
  )
})

function onAnimInputBlur() {
  setTimeout(() => {
    isAnimDropdownOpen.value = false
  }, 150)
}

function selectHighlightedAnim() {
  const opts = filteredDropdownOptions.value
  if (opts.length > 0 && highlightedIndex.value < opts.length) {
    addSelectedAnim(opts[highlightedIndex.value])
  }
  else {
    addIdleAnimation()
  }
}

function addIdleAnimation() {
  const val = newIdleAnimInput.value.trim()
  if (val && !selectedIdleAnimations.value.includes(val)) {
    selectedIdleAnimations.value.push(val)
  }
  newIdleAnimInput.value = ''
  highlightedIndex.value = 0
}

function addSelectedAnim(name: string) {
  if (name && !selectedIdleAnimations.value.includes(name)) {
    selectedIdleAnimations.value.push(name)
  }
  newIdleAnimInput.value = ''
  highlightedIndex.value = 0
}

function removeIdleAnimation(name: string) {
  selectedIdleAnimations.value = selectedIdleAnimations.value.filter(n => n !== name)
}

function toggleIdleAnimation(name: string) {
  if (selectedIdleAnimations.value.includes(name)) {
    removeIdleAnimation(name)
  }
  else {
    selectedIdleAnimations.value.push(name)
  }
}

function highlightNext() {
  const max = filteredDropdownOptions.value.length
  if (max > 0) {
    highlightedIndex.value = (highlightedIndex.value + 1) % max
  }
}

function highlightPrev() {
  const max = filteredDropdownOptions.value.length
  if (max > 0) {
    highlightedIndex.value = (highlightedIndex.value - 1 + max) % max
  }
}

const mapFormatRenderer: Record<string, string> = {
  'live2d-zip': 'Live2D',
  'live2d-directory': 'Live2D',
  'vrm': 'VRM',
  'spine-zip': 'Spine',
  'pmx-directory': 'MMD',
  'pmx-zip': 'MMD',
  'pmd': 'MMD',
}

const filteredManifestationModels = computed(() => {
  let result = [...displayModelsStore.displayModels]

  // Search (matches name or tags partially)
  if (manifestationSearch.value.trim()) {
    const q = manifestationSearch.value.trim().toLowerCase()
    result = result.filter((m) => {
      const nameMatches = m.name.toLowerCase().includes(q)
      const tagMatches = m.tags && Array.isArray(m.tags) && m.tags.some(t => t.toLowerCase().includes(q))
      return nameMatches || tagMatches
    })
  }

  if (manifestationFormatFilter.value !== 'all') {
    result = result.filter((m) => {
      const fmt = m.format.toLowerCase()
      if (manifestationFormatFilter.value === 'live2d')
        return fmt.includes('live2d')
      if (manifestationFormatFilter.value === 'vrm')
        return fmt === 'vrm'
      if (manifestationFormatFilter.value === 'spine')
        return fmt.includes('spine')
      if (manifestationFormatFilter.value === 'mmd')
        return fmt.includes('pmx') || fmt === 'pmd'
      return true
    })
  }

  // Sort: Put the currently selected model first in the grid list
  if (selectedModelId.value && selectedModelId.value !== 'inherit') {
    const selectedIdx = result.findIndex(m => m.id === selectedModelId.value)
    if (selectedIdx > -1) {
      const [selectedItem] = result.splice(selectedIdx, 1)
      result.unshift(selectedItem)
    }
  }

  return result
})

// Helper to determine if the currently selected model is missing from displayModels
const isSelectedModelMissing = computed(() => {
  if (!selectedModelId.value || selectedModelId.value === 'inherit')
    return false
  return !displayModelsStore.displayModels.some(m => m.id === selectedModelId.value)
})

const providerOptions = [
  { value: 'inherit', label: 'Inherit Global' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'comfyui', label: 'ComfyUI' },
  { value: 'none', label: 'Disable Artistry' },
]

const speechProviderOptions = computed(() => [
  { value: 'inherit', label: 'Inherit Global' },
  { value: 'none', label: 'Disable Speech' },
  ...providersStore.configuredSpeechProvidersMetadata.map(p => ({
    value: p.id,
    label: p.localizedName || p.name,
  })),
])

const speechModelOptions = computed(() => {
  const provider = selectedSpeechProvider.value === 'inherit' ? activeSpeechProvider.value : selectedSpeechProvider.value
  if (!provider || provider === 'none')
    return []
  return providersStore.getModelsForProvider(provider).map(m => ({
    value: m.id,
    label: m.name || m.id,
  }))
})

const speechVoiceOptions = computed(() => {
  const provider = selectedSpeechProvider.value === 'inherit' ? activeSpeechProvider.value : selectedSpeechProvider.value
  if (!provider || provider === 'none')
    return []
  return speechStore.getVoicesForProvider(provider).map(v => ({
    value: v.id,
    label: v.name || v.id,
  }))
})

const backgroundOptions = computed(() => {
  const bgs = backgroundStore.availableBackgrounds || []
  return [
    { value: 'inherit', label: 'No Override' },
    ...bgs.map(bg => ({
      value: bg.id,
      label: bg.title || bg.id,
    })),
  ]
})

// Watchers for speech provider changes
watch(selectedSpeechProvider, async (newProvider) => {
  const provider = newProvider === 'inherit' ? activeSpeechProvider.value : newProvider
  if (provider && provider !== 'none') {
    await speechStore.loadVoicesForProvider(provider)
    const metadata = providersStore.getProviderMetadata(provider)
    if (metadata?.capabilities.listModels) {
      await providersStore.fetchModelsForProvider(provider)
    }
  }
})
function buildPayload(): { id: string, data: ConceptData } {
  let options
  try {
    options = selectedOptionsStr.value.trim() ? JSON.parse(selectedOptionsStr.value) : undefined
  }
  catch (e) {
    // Ignore invalid JSON for now
  }

  return {
    id: id.value.trim(),
    data: {
      description: description.value.trim(),
      prompt: prompt.value.trim(),
      isBase: isBase.value,
      idleAnimations: selectedIdleAnimations.value,
      textColor: textColor.value.trim() || undefined,
      artistry: selectedProvider.value !== 'inherit'
        ? {
            provider: selectedProvider.value,
            model: selectedModel.value.trim(),
            options,
          }
        : undefined,
      manifestation: {
        modelId: selectedModelId.value !== 'inherit' ? selectedModelId.value : undefined,
        mood: selectedMood.value.trim() || undefined,
        backgroundId: selectedBackgroundId.value !== 'inherit' ? selectedBackgroundId.value : undefined,
        active_expressions: Object.keys(selectedExpressions.value).length > 0
          ? { ...selectedExpressions.value }
          : undefined,
      },
      speech: selectedSpeechProvider.value !== 'inherit'
        ? {
            provider: selectedSpeechProvider.value,
            model: selectedSpeechModel.value.trim(),
            voice_id: selectedSpeechVoiceId.value.trim(),
          }
        : undefined,
    },
  }
}

function handleSave() {
  if (!id.value.trim())
    return
  emit('save', { ...buildPayload(), clone: false })
  emit('update:modelValue', false)
}

function handleClone() {
  if (!id.value.trim())
    return
  emit('save', { ...buildPayload(), clone: true })
  emit('update:modelValue', false)
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[10001] m-0 max-h-[90vh] max-w-xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900">
        <!-- Modal Header -->
        <div class="border-b border-neutral-100 p-6 pb-4 dark:border-neutral-800 sm:p-8">
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-primary-500/10 p-2 text-primary-500 shadow-primary-500/10 shadow-sm">
              <div class="i-solar:magic-stick-3-bold-duotone text-2xl" />
            </div>
            <div>
              <DialogTitle class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
                {{ conceptId ? 'Concept Studio' : 'New Concept' }}
              </DialogTitle>
              <code v-if="conceptId" class="rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 font-mono dark:bg-black/40">
                ID: {{ conceptId }}
              </code>
            </div>
          </div>

          <!-- Tab Navigation -->
          <div class="mt-6 flex gap-1">
            <button
              v-for="t in ['identity', 'artistry', 'manifestation', 'scene', 'speech']"
              :key="t"
              class="rounded-lg px-4 py-2 text-xs font-bold transition-all"
              :class="activeTab === t ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              @click="activeTab = t"
            >
              {{ t.charAt(0).toUpperCase() + t.slice(1) }}
            </button>
          </div>
        </div>

        <!-- Modal Content -->
        <div class="flex-1 overflow-y-auto p-6 sm:p-8">
          <!-- Identity Tab -->
          <div v-if="activeTab === 'identity'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <FieldInput
              v-model="id"
              label="Concept ID"
              placeholder="e.g. silver_performance"
              description="A unique identifier the Director will use to trigger this state."
              :disabled="!!conceptId"
            />

            <FieldInput
              v-model="description"
              label="Narrative Description"
              placeholder="When should this be used?"
              description="Helps the Director understand the context for this concept."
              :single-line="false"
              :rows="3"
            />

            <div class="max-w-full">
              <label class="flex flex-col gap-4">
                <div>
                  <div class="flex items-center gap-1 text-sm font-medium">
                    Prompt Snippet
                  </div>
                  <div class="text-xs text-neutral-500 dark:text-neutral-400">
                    Keywords or modifiers to inject into the final image prompt.
                  </div>
                </div>
                <div class="relative w-full">
                  <textarea
                    v-model="prompt"
                    rows="3"
                    placeholder=", (iridescent silver tape:1.4), high contrast"
                    class="focus:primary-300 dark:focus:primary-400/50 text-disabled:neutral-400 dark:text-disabled:neutral-600 cursor-disabled:not-allowed w-full border-2 border-neutral-100 rounded-lg border-solid bg-neutral-50 py-1.5 pl-2 pr-9 text-sm shadow-sm outline-none transition-all duration-200 ease-in-out dark:border-neutral-900 dark:bg-neutral-950 focus:bg-neutral-50 dark:focus:bg-neutral-900"
                  />
                  <button
                    v-if="hasManifestationModel"
                    type="button"
                    class="absolute right-2 top-2 h-8 w-8 flex items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-primary-500 dark:hover:bg-neutral-800 dark:hover:text-primary-400"
                    title="Extract tags from model preview (WD14)"
                    @click.prevent="showTagExtractorModal = true"
                  >
                    <span i-solar:tag-bold-duotone class="text-lg" />
                  </button>
                </div>
              </label>
              <!-- Quick Add Buttons -->
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  class="flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold transition-all dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-300 hover:text-white dark:hover:bg-primary-500"
                  title="Autofill with global user profile description and prompt tags"
                  @click.prevent="handleLoadUserProfile"
                >
                  <span class="i-solar:user-bold" />
                  + User Profile
                </button>
                <button
                  v-for="cid in conceptIds"
                  :key="cid"
                  type="button"
                  class="flex items-center gap-1 rounded-lg bg-neutral-100 px-2 py-1 text-[10px] text-neutral-600 font-bold transition-all dark:bg-neutral-800 hover:bg-primary-500 dark:text-neutral-300 hover:text-white dark:hover:bg-primary-500"
                  @click.prevent="appendPromptTag(`(concept_${cid})`)"
                >
                  <span class="i-solar:stars-minimalistic-bold" />
                  + {{ cid }}
                </button>
              </div>
            </div>

            <!-- Custom Actor Text Color Picker -->
            <div class="flex flex-col gap-2">
              <div>
                <label class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Custom Actor Highlight Color</label>
                <p class="dark:text-neutral-450 text-[10px] text-neutral-500 leading-relaxed">
                  Override the auto-generated HSL color for this actor's speech bubble highlight and name chip tags.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <input
                  v-model="textColor"
                  type="text"
                  placeholder="e.g. #a855f7"
                  class="flex-1 border border-neutral-200 rounded-lg bg-white px-3 py-2 text-sm text-neutral-800 outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600"
                >
                <div class="relative h-[38px] w-[38px] overflow-hidden border border-neutral-200 rounded-lg dark:border-neutral-800">
                  <input
                    v-model="textColor"
                    type="color"
                    class="absolute inset-0 h-full w-full cursor-pointer border-none bg-transparent p-0 opacity-100"
                  >
                </div>
              </div>
            </div>

            <!-- Base vs Layer toggle -->
            <div class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-black/20">
              <div>
                <span class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Base Concept (Exclusionary)</span>
                <p class="mt-0.5 text-[10px] text-neutral-500 leading-relaxed">
                  When active, clears the stack first. Use for outfits, character swaps, or any state that can't overlap.
                </p>
              </div>
              <button
                :class="[
                  'relative h-6 w-11 rounded-full transition-colors duration-200',
                  isBase ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600',
                ]"
                @click="isBase = !isBase"
              >
                <span
                  :class="[
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                    isBase ? 'translate-x-5' : 'translate-x-0',
                  ]"
                />
              </button>
            </div>
          </div>

          <!-- Artistry Tab -->
          <div v-if="activeTab === 'artistry'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Generation Provider</label>
              <Select v-model="selectedProvider" :options="providerOptions" />
              <p class="text-[10px] text-neutral-500 italic">
                The visual engine used for this concept.
              </p>
            </div>

            <div v-if="selectedProvider !== 'inherit' && selectedProvider !== 'none'" class="border-t border-neutral-100 pt-4 space-y-6 dark:border-neutral-800">
              <div v-if="selectedProvider === 'comfyui'" class="flex flex-col gap-2">
                <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Select Workflow</label>
                <Select
                  v-model="selectedModel"
                  :options="artistryStore.comfyuiSavedWorkflows.map(w => ({ value: w.id, label: w.name || w.id }))"
                />
                <p class="text-[10px] text-neutral-500 italic">
                  Choose from your registered ComfyUI templates.
                </p>
              </div>

              <FieldInput
                v-else
                v-model="selectedModel"
                label="Model ID"
                placeholder="e.g. black-forest-labs/flux-schnell"
              />

              <FieldInput
                v-model="selectedOptionsStr"
                label="Advanced Options (JSON)"
                description="Custom parameters for the specific provider."
                :single-line="false"
                :rows="6"
              />
            </div>
          </div>

          <!-- Manifestation Tab -->
          <div v-if="activeTab === 'manifestation'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Physical Model Override</label>

              <!-- Search & Filter Controls -->
              <div class="flex items-center gap-2">
                <div class="relative flex-1">
                  <span class="i-solar:magnifer-linear absolute left-2.5 top-1/2 translate-y-[-50%] text-xs text-neutral-400" />
                  <input
                    v-model="manifestationSearch"
                    type="text"
                    placeholder="Search models..."
                    class="w-full border border-neutral-200 rounded-lg bg-neutral-50 py-1.5 pl-8 pr-2.5 text-[11px] text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                  >
                </div>
                <select
                  v-model="manifestationFormatFilter"
                  class="cursor-pointer border border-neutral-200 rounded-lg bg-neutral-50 px-2 py-1.5 text-[11px] font-medium outline-none dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  <option value="all">
                    All Formats
                  </option>
                  <option value="live2d">
                    Live2D
                  </option>
                  <option value="vrm">
                    VRM
                  </option>
                  <option value="spine">
                    Spine
                  </option>
                  <option value="mmd">
                    MMD
                  </option>
                </select>
              </div>

              <!-- Compact Models Grid -->
              <div class="max-h-64 overflow-y-auto pr-1">
                <div class="grid grid-cols-3 gap-2">
                  <!-- Inherit Default Card -->
                  <div
                    :class="[
                      'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-all duration-200',
                      selectedModelId === 'inherit'
                        ? 'border-primary-500 ring-2 ring-primary-500/40 bg-primary-500/5 dark:bg-primary-500/10'
                        : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-primary-500/50 bg-neutral-50/50 dark:bg-neutral-800/40',
                    ]"
                    @click="selectedModelId = 'inherit'"
                  >
                    <span class="i-solar:restart-bold-duotone mb-1 text-2xl text-neutral-400" />
                    <span class="text-[9px] text-neutral-600 font-bold dark:text-neutral-300">Inherit Default</span>
                  </div>

                  <!-- Missing Model Card -->
                  <div
                    v-if="isSelectedModelMissing"
                    :class="[
                      'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-2 text-center transition-all duration-200 border-red-500 ring-2 ring-red-500/40 bg-red-500/10',
                    ]"
                  >
                    <span class="i-solar:danger-triangle-bold-duotone mb-1 text-2xl text-red-500" />
                    <span class="text-[9px] text-red-600 font-bold dark:text-red-400">Missing Model</span>
                    <span class="absolute bottom-0 left-0 right-0 truncate bg-red-950/80 px-1 py-0.5 text-center text-[7px] text-white font-mono">
                      {{ selectedModelId }}
                    </span>
                  </div>

                  <!-- Display Models Cards -->
                  <div
                    v-for="model in filteredManifestationModels"
                    :key="model.id"
                    :class="[
                      'group relative aspect-square border rounded-xl overflow-hidden cursor-pointer bg-neutral-200/10 dark:bg-neutral-800/10 transition-all duration-200',
                      selectedModelId === model.id
                        ? 'border-primary-500 ring-2 ring-primary-500/40'
                        : 'border-neutral-200/40 dark:border-neutral-800/40 hover:ring-2 hover:ring-primary-500/50',
                    ]"
                    @click="selectedModelId = model.id"
                  >
                    <img
                      v-if="model.previewImage"
                      :src="model.previewImage"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    >
                    <div v-else class="h-full w-full flex items-center justify-center bg-neutral-500/10 text-neutral-400">
                      <span class="i-solar:user-bold-duotone text-lg" />
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[8px] text-white">
                      <div class="truncate font-semibold">
                        {{ model.name }}
                      </div>
                      <div class="text-[6px] font-mono opacity-75">
                        {{ mapFormatRenderer[model.format] }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <p class="mt-1 text-[10px] text-neutral-500 italic">
                Forces a base model swap (Live2D/VRM/Spine/MMD) when this concept is active.
              </p>
            </div>

            <!-- Idle Loop / Cycle Animations -->
            <div class="flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">
                Idle Loop / Cycle Animations (Optional override)
              </label>
              <div class="text-[10px] text-neutral-500">
                Pick from the animations available for this model to cycle through automatically.
              </div>

              <!-- Autocomplete Input -->
              <div class="relative w-full">
                <input
                  v-model="newIdleAnimInput"
                  type="text"
                  placeholder="Search and add animation name..."
                  class="w-full border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
                  @focus="isAnimDropdownOpen = true"
                  @blur="onAnimInputBlur"
                  @keydown.enter.prevent="selectHighlightedAnim"
                  @keydown.down.prevent="highlightNext"
                  @keydown.up.prevent="highlightPrev"
                >

                <!-- Dropdown options -->
                <div
                  v-if="isAnimDropdownOpen && filteredDropdownOptions.length > 0"
                  class="absolute left-0 right-0 z-50 mt-1 max-h-40 overflow-y-auto border border-neutral-200 rounded-lg bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div
                    v-for="(opt, index) in filteredDropdownOptions"
                    :key="opt"
                    :class="[
                      'cursor-pointer px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 transition-colors hover:bg-primary-500/10 hover:text-primary-500',
                      highlightedIndex === index ? 'bg-primary-500/15 text-primary-500 dark:bg-primary-500/10' : '',
                    ]"
                    @mousedown="addSelectedAnim(opt)"
                  >
                    {{ opt }}
                  </div>
                </div>
              </div>

              <!-- Tags List (Accumulated outside input) -->
              <div v-if="selectedIdleAnimations.length > 0" class="flex flex-wrap gap-1.5 pt-1">
                <span
                  v-for="anim in selectedIdleAnimations"
                  :key="anim"
                  class="flex items-center gap-1 border border-primary-500/20 rounded-full bg-primary-500/10 px-3 py-1 text-[10px] text-primary-600 font-medium dark:text-primary-400"
                >
                  {{ anim }}
                  <button type="button" class="ml-1 text-[12px] text-neutral-400 leading-none hover:text-red-400 focus:outline-none" @click="removeIdleAnimation(anim)">
                    &times;
                  </button>
                </span>
              </div>

              <!-- Quick Helper Buttons -->
              <div v-if="availableMotionsForSelectedModel.length > 0" class="flex flex-wrap items-center gap-1">
                <span class="mr-1 text-[9px] text-neutral-500">Quick Add:</span>
                <button
                  v-for="preset in availableMotionsForSelectedModel.slice(0, 6)"
                  :key="preset"
                  type="button"
                  class="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-600 dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white"
                  @click="toggleIdleAnimation(preset)"
                >
                  + {{ preset }}
                </button>
              </div>
            </div>

            <!-- Active Expressions Override -->
            <div class="flex flex-col gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Active Expressions / Outfits</label>

              <div v-if="availableExpressions.length === 0" class="text-xs text-neutral-400 italic">
                No expressions available for the active model.
              </div>
              <div v-else class="max-h-48 flex flex-wrap gap-1.5 overflow-y-auto p-1">
                <button
                  v-for="exp in availableExpressions"
                  :key="exp.key"
                  type="button"
                  :class="[
                    'rounded-lg px-2.5 py-1.5 text-[11px] transition-all duration-150 border select-none font-medium',
                    isExpressionActive(exp.key)
                      ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400'
                      : 'bg-neutral-50 border-neutral-200 dark:bg-neutral-800/60 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700',
                  ]"
                  @click="toggleExpression(exp.key)"
                >
                  {{ exp.name }}
                </button>
              </div>
              <p class="text-[10px] text-neutral-500 italic">
                Toggles facial expressions or outfit presets (e.g. preset2 for black dress) to layer onto the base state.
              </p>
            </div>
          </div>

          <!-- Speech Tab -->
          <div v-if="activeTab === 'speech'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Speech Provider Override</label>
              <Select v-model="selectedSpeechProvider" :options="speechProviderOptions" />
              <p class="text-[10px] text-neutral-500 italic">
                Forces a specific TTS provider for this concept.
              </p>
            </div>

            <div v-if="selectedSpeechProvider !== 'none' && (selectedSpeechProvider !== 'inherit' || activeSpeechProvider)" class="border-t border-neutral-100 pt-4 space-y-6 dark:border-neutral-800">
              <div class="flex flex-col gap-2">
                <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Vocal Model</label>
                <Select v-model="selectedSpeechModel" :options="speechModelOptions" />
                <p class="text-[10px] text-neutral-500 italic">
                  Choose the TTS engine version.
                </p>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Persona Voice</label>
                <div class="flex items-center gap-2">
                  <Select v-model="selectedSpeechVoiceId" :options="speechVoiceOptions" class="flex-1" />
                  <Button
                    variant="secondary"
                    type="button"
                    class="h-[38px] flex items-center gap-1.5 border border-neutral-200 px-3 text-xs font-bold dark:border-neutral-800"
                    title="Create custom voice profile"
                    @click.prevent="showVoiceCreator = true"
                  >
                    <span class="i-solar:music-notes-bold-duotone text-sm" />
                    Create Custom Voice
                  </Button>
                </div>
                <p class="text-[10px] text-neutral-500 italic">
                  The unique voice assigned to this concept/actress.
                </p>
              </div>
            </div>
          </div>

          <!-- Scene Tab -->
          <div v-if="activeTab === 'scene'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <!-- Director Active Disclaimer -->
            <div v-if="isDirectorActive" class="flex items-start gap-3 border border-amber-300/40 rounded-xl bg-amber-50/80 p-4 dark:border-amber-600/30 dark:bg-amber-900/20">
              <div class="i-solar:danger-triangle-bold mt-0.5 shrink-0 text-lg text-amber-500" />
              <div>
                <span class="text-sm text-amber-800 font-bold dark:text-amber-300">Scene Control Disabled</span>
                <p class="mt-1 text-[11px] text-amber-700 leading-relaxed dark:text-amber-400">
                  The Autonomous Director is currently active for this character. Scene overrides defined here will be ignored while the Director manages the visual environment. Disable the Director in the Artistry settings to enable manual scene control.
                </p>
              </div>
            </div>

            <!-- Explanatory Header -->
            <div class="flex items-start gap-3 border border-neutral-200 rounded-xl bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-black/20">
              <div class="i-solar:clapperboard-open-play-bold-duotone mt-0.5 shrink-0 text-lg text-primary-500" />
              <div>
                <span class="text-sm text-neutral-700 font-bold dark:text-neutral-300">How Scene Overrides Work</span>
                <p class="mt-1 text-[11px] text-neutral-500 leading-relaxed">
                  When the <code class="rounded bg-neutral-200 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-700">&lt;|ACTOR:{{ id || 'ID' }}|&gt;</code> token is triggered during a conversation, the background will automatically switch to the one selected below.
                  This lets each character or costume maintain their own unique stage set.
                </p>
              </div>
            </div>

            <!-- Background Selector -->
            <div class="flex flex-col gap-2" :class="{ 'pointer-events-none opacity-40': isDirectorActive }">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Stage Background</label>
              <Select v-model="selectedBackgroundId" :options="backgroundOptions" />
              <p class="text-[10px] text-neutral-500 italic">
                Choose a background from your gallery. Add more via the Image Gallery.
              </p>
            </div>

            <!-- Background Preview -->
            <div v-if="selectedBackgroundId !== 'inherit'" class="mt-2">
              <div
                v-if="backgroundStore.getBackgroundUrl(selectedBackgroundId)"
                class="overflow-hidden border border-neutral-200 rounded-xl shadow-sm dark:border-neutral-700"
              >
                <img
                  :src="backgroundStore.getBackgroundUrl(selectedBackgroundId)!"
                  :alt="backgroundOptions.find(o => o.value === selectedBackgroundId)?.label || 'Preview'"
                  class="h-40 w-full object-cover"
                >
                <div class="bg-neutral-50/80 px-3 py-2 dark:bg-black/30">
                  <p class="truncate text-[10px] text-neutral-500 font-medium">
                    {{ backgroundOptions.find(o => o.value === selectedBackgroundId)?.label }}
                  </p>
                </div>
              </div>
              <div v-else class="border border-neutral-200 rounded-xl border-dashed bg-neutral-50/50 p-6 text-center dark:border-neutral-700 dark:bg-black/20">
                <div class="i-solar:gallery-broken mx-auto mb-2 text-2xl text-neutral-300" />
                <p class="text-xs text-neutral-400">
                  Preview unavailable — background may still be loading.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50/50 p-6 pt-4 dark:border-neutral-800 dark:bg-black/20 sm:p-8">
          <Button
            variant="secondary"
            label="Cancel"
            @click="emit('update:modelValue', false)"
          />
          <Button
            v-if="conceptId"
            variant="secondary"
            label="Clone"
            icon="i-solar:copy-linear"
            :disabled="!id.trim()"
            @click="handleClone"
          />
          <Button
            variant="primary"
            :label="conceptId ? 'Save Changes' : 'Create Concept'"
            icon="i-solar:check-read-linear"
            :disabled="!id.trim()"
            @click="handleSave"
          />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Image Tag Extractor Modal -->
  <ImageTagExtractorModal
    v-model="showTagExtractorModal"
    :model-id="extractorModelId"
    @apply="handleTagExtractorApply"
  />

  <!-- Voice Creator Modal -->
  <VoiceCreatorModal
    v-model="showVoiceCreator"
    :character-name="conceptId ? conceptId : undefined"
    @save="(payload) => {
      selectedSpeechProvider = payload.baseProvider
      selectedSpeechModel = payload.baseModel
      selectedSpeechVoiceId = payload.baseVoice
    }"
  />
</template>
