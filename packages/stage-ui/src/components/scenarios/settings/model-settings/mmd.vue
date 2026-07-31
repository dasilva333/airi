<script setup lang="ts">
import { useMmd } from '@proj-airi/stage-ui-mmd/stores/mmd'
import { Checkbox, FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelSceneSettings from './components/ModelSceneSettings.vue'
import ModelCustomizer from './ModelCustomizer.vue'

import { useDisplayModelsStore } from '../../../../stores/display-models'
import { useAiriCardStore } from '../../../../stores/modules'
import { useSettings } from '../../../../stores/settings'
import { usePositioningStore } from '../../../../stores/settings/positioning'
import { Section } from '../../../layouts'

const props = withDefaults(defineProps<{
  palette: string[]
  allowExtractColors?: boolean
  modelId?: string
}>(), {
  allowExtractColors: true,
})

const mmdStore = useMmd()
const positioningStore = usePositioningStore()
const settingsStore = useSettings()
const { t } = useI18n()
const { stageModelSelected } = storeToRefs(settingsStore)
const {
  morphMappings,
  hiddenMorphs,
  followSpeed,
  physicsEnabled,
  ikEnabled,
  grantEnabled,
  physicsGravity,
  gazeMode,
} = storeToRefs(mmdStore)

const mouseTrackingEnabled = computed({
  get: () => gazeMode.value === 'mouse',
  set: (val) => {
    gazeMode.value = val ? 'mouse' : 'none'
  },
})

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const displayModelsStore = useDisplayModelsStore()

// Local refs for MMD motions customization
const motionMappings = ref<Record<string, string>>({})
const hiddenMotions = ref<string[]>([])

// Watch mappings to save to display model metadata
// Watch card changes to load mappings & run legacy local storage migration
watch(activeCard, async (card) => {
  if (!card)
    return
  const displayModelId = airiCardStore.getCardDisplayModelId(activeCardId.value)
  if (!displayModelId)
    return

  const model = displayModelsStore.displayModels.find(m => m.id === displayModelId)
  if (model) {
    // Check for legacy local storage mappings to migrate
    const legacyMmdMappingsStr = localStorage.getItem('settings/mmd/morph-mappings')
    const legacyMmdHiddenStr = localStorage.getItem('settings/mmd/hidden-morphs')
    let migrated = false
    let updatedEmotionMappings = { ...model.emotionMappings }
    let updatedHiddenExpressions = [...(model.hiddenExpressions || [])]

    if (legacyMmdMappingsStr) {
      try {
        const legacyMappings = JSON.parse(legacyMmdMappingsStr)
        if (Object.keys(legacyMappings).length > 0) {
          updatedEmotionMappings = { ...updatedEmotionMappings, ...legacyMappings }
          migrated = true
        }
        localStorage.removeItem('settings/mmd/morph-mappings')
      }
      catch (e) {}
    }

    if (legacyMmdHiddenStr) {
      try {
        const legacyHidden = JSON.parse(legacyMmdHiddenStr)
        if (legacyHidden.length > 0) {
          updatedHiddenExpressions = Array.from(new Set([...updatedHiddenExpressions, ...legacyHidden]))
          migrated = true
        }
        localStorage.removeItem('settings/mmd/hidden-morphs')
      }
      catch (e) {}
    }

    if (migrated) {
      await displayModelsStore.updateDisplayModelMappings(displayModelId, {
        emotionMappings: updatedEmotionMappings,
        hiddenExpressions: updatedHiddenExpressions,
      })
    }

    morphMappings.value = model.emotionMappings || {}
    hiddenMorphs.value = model.hiddenExpressions || []
    motionMappings.value = model.motionMappings || {}
    hiddenMotions.value = model.hiddenMotions || []
  }
}, { immediate: true })
</script>

<template>
  <!-- Block 1: Character Customizations -->
  <Section
    title="Character Customizations"
    icon="i-solar:user-bold-duotone"
    :class="['rounded-xl', 'bg-white/80 dark:bg-black/75', 'backdrop-blur-lg']"
    size="sm"
    :expand="true"
  >
    <ModelCustomizer :model-id="props.modelId || stageModelSelected" :local-stage="true" />
  </Section>

  <!-- Block 2: Scene -->
  <ModelSceneSettings
    :store="mmdStore"
    :positioning-store="positioningStore"
    :model-id="props.modelId || stageModelSelected"
    :model-size="mmdStore.modelSize || { x: 1, y: 2, z: 1 }"
    :palette="palette"
  />

  <!-- Block 3: Advanced -->
  <Section
    title="Advanced"
    icon="i-solar:settings-bold-duotone"
    :class="['rounded-xl', 'bg-white/80 dark:bg-black/75', 'backdrop-blur-lg']"
    size="sm"
    :expand="false"
  >
    <div flex="~ col gap-4" p-2>
      <!-- Mouse Tracking & Follow Speed -->
      <div flex="~ col gap-4" class="mb-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
        <div flex="~ items-center justify-between">
          <div flex="~ col gap-0.5">
            <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('settings.vrm.scale-and-position.mouse-tracking') }}</span>
            <span class="text-[10px] text-neutral-400">{{ t('settings.vrm.scale-and-position.mouse-tracking-desc') }}</span>
          </div>
          <Checkbox v-model="mouseTrackingEnabled" />
        </div>

        <div v-if="mouseTrackingEnabled" flex="~ col gap-2">
          <FieldRange
            v-model="followSpeed"
            :min="0.01"
            :max="1"
            :step="0.01"
            :label="t('settings.vrm.scale-and-position.follow-speed')"
          >
            <template #label>
              <div flex="~ items-center justify-between" class="w-full">
                <div class="text-sm text-neutral-600 dark:text-neutral-400">
                  {{ t('settings.vrm.scale-and-position.follow-speed') }}
                </div>
                <div class="text-xs text-neutral-600 font-bold font-mono dark:text-neutral-400">
                  {{ followSpeed.toFixed(2) }}
                </div>
              </div>
            </template>
          </FieldRange>
        </div>
      </div>

      <!-- Physics Solver Toggles -->
      <div flex="~ col gap-4" class="mb-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
        <div flex="~ items-center justify-between">
          <span class="text-sm text-neutral-600 dark:text-neutral-400">Enable Physics</span>
          <Checkbox v-model="physicsEnabled" />
        </div>
        <div flex="~ items-center justify-between">
          <span class="text-sm text-neutral-600 dark:text-neutral-400">Enable IK Solvers</span>
          <Checkbox v-model="ikEnabled" />
        </div>
        <div flex="~ items-center justify-between">
          <span class="text-sm text-neutral-600 dark:text-neutral-400">Enable Append-Bone (Grant)</span>
          <Checkbox v-model="grantEnabled" />
        </div>
        <div flex="~ col gap-2">
          <FieldRange
            v-model="physicsGravity"
            :min="0"
            :max="200"
            :step="1"
            label="Gravity Strength"
          >
            <template #label>
              <div flex="~ items-center justify-between" class="w-full">
                <div class="text-sm text-neutral-600 dark:text-neutral-400">
                  Gravity Strength
                </div>
                <div class="text-xs text-neutral-600 font-bold font-mono dark:text-neutral-400">
                  {{ physicsGravity }}
                </div>
              </div>
            </template>
          </FieldRange>
        </div>
      </div>
    </div>
  </Section>
</template>
