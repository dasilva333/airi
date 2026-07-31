<script setup lang="ts">
import { useSpine } from '@proj-airi/stage-ui-spine'
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelCustomizer from './ModelCustomizer.vue'

import { useSettingsSpine } from '../../../../stores/settings/spine'
import { Section } from '../../../layouts'
import { ColorPalette } from '../../../widgets'

const props = withDefaults(defineProps<{
  palette: string[]
  allowExtractColors?: boolean
  modelId?: string
}>(), {
  allowExtractColors: true,
})

defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()

const { t } = useI18n()

const settingsSpine = useSettingsSpine()
const {
  spineDefaultMixDuration,
  spineMaxFps,
  spineRenderScale,
} = storeToRefs(settingsSpine)

const { stageModelSelected } = storeToRefs(useSettings())
const positioningStore = usePositioningStore()

const spineStore = useSpine()
const {
  animationSpeed,
  hitDetectionMode,
  radialHitRadius,
} = storeToRefs(spineStore)

const hitDetectionOptions = [
  { value: 'bounds', label: 'Mesh / Bounding Box (Default)' },
  { value: 'radial', label: 'Radial Distance' },
]

const scale = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).scale,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, scale: val })
  },
})

const positionX = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).x,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, x: val })
  },
})

const positionY = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).y,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, y: val })
  },
})

// canExtractColors removed as it is unused in Phase 1

const fpsOptions = computed(() => [
  { value: 0, label: t('settings.spine.fps.options.unlimited') },
  { value: 60, label: '60' },
  { value: 30, label: '30' },
])
</script>

<template>
  <!-- Block 1: Character Customizations -->
  <Section
    title="Character Customizations"
    icon="i-solar:user-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80  dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
    size="sm"
    :expand="true"
  >
    <ModelCustomizer :model-id="props.modelId || stageModelSelected" :local-stage="true" />

    <!-- Global Spine Settings -->
    <div class="mt-4 border-t border-neutral-100 pt-4 space-y-4 dark:border-neutral-800">
      <FieldRange v-model="spineDefaultMixDuration" as="div" :min="0" :max="2" :step="0.05" :default-value="0.2" :label="t('settings.spine.animation.mix-duration')" />
      <FieldRange v-model="animationSpeed" as="div" :min="0.1" :max="3" :step="0.05" :default-value="1" :label="t('settings.spine.animation.speed')" />
    </div>
  </Section>

  <!-- Block 2: Scene -->
  <Section
    title="Scene"
    icon="i-solar:clapperboard-edit-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80  dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
    size="sm"
    :expand="true"
  >
    <FieldRange v-model="scale" as="div" :min="0.1" :max="6" :step="0.01" :default-value="1" :label="t('settings.spine.scale-and-position.scale')" />
    <FieldRange v-model="positionX" as="div" :min="-3000" :max="3000" :step="1" :default-value="0" :label="t('settings.spine.scale-and-position.x')" />
    <FieldRange v-model="positionY" as="div" :min="-3000" :max="3000" :step="1" :default-value="0" :label="t('settings.spine.scale-and-position.y')" />
  </Section>

  <!-- Block 3: Advanced -->
  <Section
    title="Advanced"
    icon="i-solar:settings-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80  dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
    size="sm"
    :expand="false"
  >
    <!-- Theme Extraction -->
    <div flex="~ col gap-2" class="mb-4">
      <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Theme Extraction
      </div>
      <ColorPalette class="mb-2 mt-2" :colors="palette.map(hex => ({ hex, name: hex }))" mx-auto />
      <Button variant="secondary" :disabled="true" @click="$emit('extractColorsFromModel')">
        {{ t('settings.spine.theme-color-from-model.button-extract.title') }}
      </Button>
      <p class="px-1 text-[10px] text-neutral-400">
        (Disabled for Phase 1)
      </p>
    </div>

    <!-- Hit Detection Mode -->
    <div flex="~ col gap-2" class="mb-4">
      <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Hit Detection Mode
      </div>
      <Select
        v-model="hitDetectionMode"
        :options="hitDetectionOptions"
        class="w-full"
      />
      <div v-if="hitDetectionMode === 'radial'" class="mt-2">
        <FieldRange
          v-model="radialHitRadius"
          as="div"
          :min="10"
          :max="250"
          :step="5"
          :default-value="35"
          label="Hit Radius (px)"
        />
      </div>
    </div>

    <!-- Rendering -->
    <div flex="~ col gap-2">
      <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
        Rendering
      </div>
      <div :class="['flex', 'items-center', 'justify-between', 'gap-2']">
        <div :class="['text-sm', 'font-medium']">
          {{ t('settings.spine.rendering.max-fps') }}
        </div>
        <SelectTab v-model="spineMaxFps" :options="fpsOptions" size="sm" :class="['shrink-0']" :disabled="true" />
      </div>
      <div class="mt-2">
        <FieldRange v-model="spineRenderScale" as="div" :min="0.5" :max="3" :step="0.1" :default-value="1" :label="t('settings.spine.rendering.render-scale')" />
      </div>
      <p class="px-1 text-[10px] text-neutral-400">
        (Rendering controls disabled for Phase 1)
      </p>
    </div>
  </Section>
</template>
