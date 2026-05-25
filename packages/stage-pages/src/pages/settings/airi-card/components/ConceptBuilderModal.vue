<script setup lang="ts">
import { useBackgroundStore } from '@proj-airi/stage-ui/stores/background'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useAiriCardStore } from '@proj-airi/stage-ui/stores/modules/airi-card'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button, FieldInput, Select } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'

interface ConceptData {
  description: string
  prompt: string
  isBase?: boolean
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
  (e: 'save', payload: { id: string; data: ConceptData }): void
}>()

const artistryStore = useArtistryStore()
const displayModelsStore = useDisplayModelsStore()
const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const modelStore = useModelStore()
const backgroundStore = useBackgroundStore()
const airiCardStore = useAiriCardStore()

const { activeSpeechProvider } = storeToRefs(speechStore)

const activeTab = ref('identity')
const id = ref('')
const description = ref('')
const prompt = ref('')

// Concept Type
const isBase = ref(false)

// Artistry Overrides
const selectedProvider = ref<string>('inherit')
const selectedModel = ref<string>('')
const selectedOptionsStr = ref<string>('{\n  \n}')

// Manifestation Overrides
const selectedModelId = ref<string>('inherit')
const selectedMood = ref<string>('')
const selectedExpressions = ref<Record<string, number>>({})

// Speech Overrides
const selectedSpeechProvider = ref<string>('inherit')
const selectedSpeechModel = ref<string>('')
const selectedSpeechVoiceId = ref<string>('')

// Scene Overrides
const selectedBackgroundId = ref<string>('inherit')

// Director status (determines if Scene tab is functional)
const isDirectorActive = computed(() => {
  return airiCardStore.activeCard?.extensions?.airi?.artistry?.autonomousEnabled ?? false
})

// Initialize when modal opens or props change
watch(
  () => [props.modelValue, props.conceptId, props.initialData],
  () => {
    if (props.modelValue) {
      activeTab.value = 'identity'
      id.value = props.conceptId || ''
      description.value = props.initialData?.description || ''
      prompt.value = props.initialData?.prompt || ''

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
    }
  },
  { immediate: true },
)

const providerOptions = [
  { label: 'Inherit Global', value: 'inherit' },
  { label: 'Replicate', value: 'replicate' },
  { label: 'ComfyUI', value: 'comfyui' },
  { label: 'Disable Artistry', value: 'none' },
]

const displayModelOptions = computed(() => [
  { label: 'Inherit Default', value: 'inherit' },
  ...displayModelsStore.displayModels.map((m) => ({
    label: m.name,
    value: m.id,
  })),
])

const speechProviderOptions = computed(() => [
  { label: 'Inherit Global', value: 'inherit' },
  { label: 'Disable Speech', value: 'none' },
  ...providersStore.configuredSpeechProvidersMetadata.map((p) => ({
    label: p.localizedName || p.name,
    value: p.id,
  })),
])

const speechModelOptions = computed(() => {
  const provider =
    selectedSpeechProvider.value === 'inherit' ? activeSpeechProvider.value : selectedSpeechProvider.value
  if (!provider || provider === 'none') return []
  return providersStore.getModelsForProvider(provider).map((m) => ({
    label: m.name || m.id,
    value: m.id,
  }))
})

const speechVoiceOptions = computed(() => {
  const provider =
    selectedSpeechProvider.value === 'inherit' ? activeSpeechProvider.value : selectedSpeechProvider.value
  if (!provider || provider === 'none') return []
  return speechStore.getVoicesForProvider(provider).map((v) => ({
    label: v.name || v.id,
    value: v.id,
  }))
})

const backgroundOptions = computed(() => {
  const bgs = backgroundStore.availableBackgrounds || []
  return [
    { label: 'No Override', value: 'inherit' },
    ...bgs.map((bg) => ({
      label: bg.title || bg.id,
      value: bg.id,
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

function toggleExpression(name: string) {
  if (selectedExpressions.value[name] === 1) {
    delete selectedExpressions.value[name]
  } else {
    selectedExpressions.value[name] = 1
  }
}

function clearAllExpressions() {
  selectedExpressions.value = {}
}

function handleSave() {
  if (!id.value.trim()) return

  let options
  try {
    options = selectedOptionsStr.value.trim() ? JSON.parse(selectedOptionsStr.value) : undefined
  } catch (e) {
    // Ignore invalid JSON for now
  }

  emit('save', {
    data: {
      artistry:
        selectedProvider.value !== 'inherit'
          ? {
              model: selectedModel.value.trim(),
              options,
              provider: selectedProvider.value,
            }
          : undefined,
      description: description.value.trim(),
      isBase: isBase.value,
      manifestation: {
        active_expressions:
          Object.keys(selectedExpressions.value).length > 0 ? { ...selectedExpressions.value } : undefined,
        backgroundId: selectedBackgroundId.value !== 'inherit' ? selectedBackgroundId.value : undefined,
        modelId: selectedModelId.value !== 'inherit' ? selectedModelId.value : undefined,
        mood: selectedMood.value.trim() || undefined,
      },
      prompt: prompt.value.trim(),
      speech:
        selectedSpeechProvider.value !== 'inherit'
          ? {
              model: selectedSpeechModel.value.trim(),
              provider: selectedSpeechProvider.value,
              voice_id: selectedSpeechVoiceId.value.trim(),
            }
          : undefined,
    },
    id: id.value.trim(),
  })
  emit('update:modelValue', false)
}
</script>

<template>
  <DialogRoot :open="modelValue" @update:open="emit('update:modelValue', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-110 bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-110 m-0 max-h-[90vh] max-w-xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900">
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

            <FieldInput
              v-model="prompt"
              label="Prompt Snippet"
              placeholder=", (iridescent silver tape:1.4), high contrast"
              description="Keywords or modifiers to inject into the final image prompt."
              :single-line="false"
              :rows="3"
            />

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
          <div v-if="activeTab === 'manifestation'" class="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
            <div class="flex flex-col gap-2">
              <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Physical Model Override</label>
              <Select v-model="selectedModelId" :options="displayModelOptions" />
              <p class="text-[10px] text-neutral-500 italic">
                Forces a base model swap (Live2D/VRM) when this concept is active.
              </p>
            </div>

            <div class="border-t border-neutral-100 pt-4 dark:border-neutral-800">
              <div class="mb-3 flex items-center justify-between">
                <div class="flex flex-col">
                  <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">Expression Gallery (Wardrobe)</label>
                  <p class="text-[10px] text-neutral-500 leading-relaxed italic">
                    Toggle internal model blendshapes or clothing triggers to lock them.
                  </p>
                </div>
                <button
                  v-if="Object.keys(selectedExpressions).length > 0"
                  class="text-[10px] text-red-500 font-bold tracking-wider uppercase transition-colors hover:text-red-600"
                  @click="clearAllExpressions"
                >
                  Clear All
                </button>
              </div>

              <div v-if="modelStore.availableExpressions.length" class="max-h-64 flex flex-wrap gap-2 overflow-y-auto pb-2 pr-2">
                <button
                  v-for="name in modelStore.availableExpressions"
                  :key="name"
                  class="border rounded-full px-3 py-1 text-[10px] font-medium transition-all"
                  :class="[
                    selectedExpressions[name] === 1
                      ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                      : 'border-neutral-200 text-neutral-500 hover:border-primary-300 dark:border-neutral-700 dark:text-neutral-400',
                  ]"
                  @click="toggleExpression(name)"
                >
                  {{ name }}
                </button>
              </div>
              <div v-else class="border border-neutral-200 rounded-xl border-dashed bg-neutral-50/50 p-8 text-center dark:border-neutral-700 dark:bg-black/20">
                <div class="i-solar:ghost-broken mx-auto mb-2 text-3xl text-neutral-300" />
                <p class="text-xs text-neutral-400">
                  No expressions found.
                </p>
                <p class="mt-1 text-[10px] text-neutral-500">
                  Load the character on stage to populate this gallery.
                </p>
              </div>
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
                <Select v-model="selectedSpeechVoiceId" :options="speechVoiceOptions" />
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
</template>
