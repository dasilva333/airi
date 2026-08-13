<script setup lang="ts">
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'

import { BrainModelPicker } from '@proj-airi/stage-ui/components/scenarios/chat'
import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { useSpeechStore } from '@proj-airi/stage-ui/stores/modules/speech'
import { Select } from '@proj-airi/ui/components/form'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import VoiceCreatorModal from '../VoiceCreatorModal.vue'

const props = defineProps<{
  consciousnessProviderOptions: { value: string, label: string }[]
  consciousnessModelOptions: { value: string, label: string }[]
  speechProviderOptions: { value: string, label: string }[]
  speechModelOptions: { value: string, label: string }[]
  speechVoiceOptions: { value: string, label: string }[]
  displayModelOptions: { value: string, label: string }[]
  sceneOptions: { value: string, label: string }[]
  consciousnessProviderPlaceholder: string
  defaultConsciousnessModelPlaceholder: string
  speechProviderPlaceholder: string
  defaultSpeechModelPlaceholder: string
  defaultSpeechVoiceIdPlaceholder: string
  defaultDisplayModelIdPlaceholder: string
  consciousnessProviderActive: boolean
  speechProviderActive: boolean
  hasVisualAssets?: boolean
}>()

const emit = defineEmits<{
  (e: 'studio'): void
}>()
const selectedConsciousnessProvider = defineModel<string>('selectedConsciousnessProvider', { required: true })
const selectedConsciousnessModel = defineModel<string>('selectedConsciousnessModel', { required: true })
const selectedSpeechProvider = defineModel<string>('selectedSpeechProvider', { required: true })
const selectedSpeechModel = defineModel<string>('selectedSpeechModel', { required: true })
const selectedSpeechVoiceId = defineModel<string>('selectedSpeechVoiceId', { required: true })
const selectedDisplayModelId = defineModel<string>('selectedDisplayModelId', { required: true })
const selectedActiveBackgroundId = defineModel<string>('selectedActiveBackgroundId', { required: true })

const { t } = useI18n()
const displayModelsStore = useDisplayModelsStore()
const speechStore = useSpeechStore()

const modelSelectorOpen = ref(false)
const showVoiceCreator = ref(false)

const selectedModel = computed<DisplayModel | undefined>(() => {
  return displayModelsStore.displayModels.find(m => m.id === selectedDisplayModelId.value)
})

const formatLabel = computed(() => {
  if (!selectedModel.value)
    return ''
  const fmt = selectedModel.value.format.toLowerCase()
  if (fmt.includes('live2d'))
    return 'Live2D'
  if (fmt === 'vrm')
    return 'VRM'
  if (fmt.includes('spine'))
    return 'Spine'
  if (fmt.includes('pmx') || fmt === 'pmd')
    return 'MMD'
  return selectedModel.value.format.toUpperCase()
})

const activeVoiceDisplay = computed(() => {
  if (!selectedSpeechVoiceId.value)
    return 'Default Voice'

  const profile = speechStore.savedVoiceProfiles.find(p => p.id === selectedSpeechVoiceId.value)
  if (profile)
    return profile.name

  const opt = props.speechVoiceOptions?.find(v => v.value === selectedSpeechVoiceId.value)
  if (opt)
    return opt.label

  return selectedSpeechVoiceId.value
})

function handleSaveVoice(payload: { baseProvider: string, baseModel: string, baseVoice: string }) {
  selectedSpeechProvider.value = payload.baseProvider
  selectedSpeechModel.value = payload.baseModel
  selectedSpeechVoiceId.value = payload.baseVoice
}
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-3">
      {{ t('settings.pages.card.creation.modules_info') }}
    </p>

    <div :class="['grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-4', 'ml-auto', 'mr-auto', 'w-90%']">
      <!-- Row 1 Left: Consciousness (LLM) -->
      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:brain />
          Consciousness (LLM)
        </label>
        <BrainModelPicker
          v-model:provider="selectedConsciousnessProvider"
          v-model:model="selectedConsciousnessModel"
          variant="button"
          title="Select Consciousness LLM"
          side="bottom"
          class="w-full"
        />
      </div>

      <!-- Row 1 Right: Voice / Speech Button -->
      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:music />
          Voice / Speech
        </label>
        <button
          type="button"
          class="h-9 w-full flex items-center justify-between border border-neutral-200 rounded-xl bg-white px-3 text-xs text-neutral-700 font-medium shadow-sm transition-all dark:border-neutral-800 hover:border-primary-300 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-primary-800"
          title="Configure Custom Voice"
          @click="showVoiceCreator = true"
        >
          <div class="flex items-center gap-2 overflow-hidden pr-2">
            <div class="i-solar:music-notes-bold-duotone shrink-0 text-sm text-primary-500" />
            <span class="truncate text-[11px] font-mono">
              {{ activeVoiceDisplay }}
            </span>
          </div>
          <div class="i-solar:pen-bold-duotone ml-1 shrink-0 text-xs text-neutral-400" />
        </button>
      </div>

      <!-- Studio Multi-Actor Voice Warning Callout (Span 2) -->
      <div
        v-if="hasVisualAssets"
        :class="[
          'sm:col-span-2 flex flex-col gap-2 rounded-xl p-3 text-xs leading-relaxed transition-all',
          'border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200',
        ]"
      >
        <div class="flex items-start gap-2">
          <div class="i-solar:info-circle-bold-duotone mt-0.5 shrink-0 text-base text-amber-600 dark:text-amber-400" />
          <p>
            This card contains Studio actor concepts (<code class="rounded bg-amber-500/20 px-1 py-0.5 text-[11px] font-mono">visual_assets</code>), so voices are managed dynamically per actor rather than globally. This field serves as a base display / fallback value. To configure an actor's voice, open <strong>Studio</strong>, click the <strong>Edit</strong> button on the target actor in the <strong>Concept Registry</strong>, switch to the <strong>Speech</strong> tab, and assign their voice there.
          </p>
        </div>
        <button
          type="button"
          class="ml-6 inline-flex items-center self-start gap-1.5 text-[11px] text-amber-700 font-bold dark:text-amber-300 hover:underline"
          @click="emit('studio')"
        >
          <div class="i-solar:clapperboard-play-bold-duotone text-xs" />
          <span>Configure actor voices in Studio &rarr;</span>
        </button>
      </div>

      <!-- Row 2: Models / Avatar (Span 2) -->
      <div :class="['flex', 'flex-col', 'gap-2', 'sm:col-span-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-solar:user-circle-bold-duotone />
          Models / Avatar
        </label>

        <div
          class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/30"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <!-- Preview Image -->
            <div class="h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-950">
              <img
                v-if="selectedModel?.previewImage"
                :src="selectedModel.previewImage"
                class="h-full w-full object-cover"
              >
              <div v-else class="i-solar:gallery-bold text-xl text-neutral-300 dark:text-neutral-700" />
            </div>

            <!-- Model Info -->
            <div class="min-w-0 flex flex-col">
              <span class="truncate text-xs text-neutral-700 font-bold dark:text-neutral-200">
                {{ selectedModel?.name || 'Inherit Default' }}
              </span>
              <span
                v-if="selectedModel"
                class="mt-0.5 self-start rounded bg-primary-500/10 px-1.5 py-0.2 text-[8px] text-primary-500 font-bold uppercase"
              >
                {{ formatLabel }}
              </span>
              <span
                v-else
                class="mt-0.5 self-start rounded bg-neutral-200/50 px-1.5 py-0.2 text-[8px] text-neutral-500 font-bold uppercase dark:bg-neutral-800"
              >
                Default
              </span>
            </div>
          </div>

          <!-- Select Trigger Button -->
          <button
            type="button"
            class="h-8 flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg bg-white px-3 text-xs text-neutral-700 font-semibold shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="modelSelectorOpen = true"
          >
            <div class="i-solar:gallery-send-bold-duotone text-xs" />
            <span>Select Avatar</span>
          </button>
        </div>

        <!-- Model Selector Dialog Component -->
        <ModelSelectorDialog
          v-model:show="modelSelectorOpen"
          :selected-model="selectedModel"
          @pick="(model) => selectedDisplayModelId = model?.id || ''"
        />
      </div>

      <!-- Row 3: Preferred Background (Span 2) -->
      <div :class="['flex', 'flex-col', 'gap-2', 'sm:col-span-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-solar:gallery-bold-duotone />
          {{ t('settings.pages.card.creation.preferred_background') }}
        </label>
        <Select
          v-model="selectedActiveBackgroundId"
          :options="sceneOptions"
          placeholder="Select background preference"
          class="w-full"
        />
      </div>
    </div>

    <!-- Voice Creator Modal -->
    <VoiceCreatorModal
      v-model="showVoiceCreator"
      @save="handleSaveVoice"
    />
  </div>
</template>
