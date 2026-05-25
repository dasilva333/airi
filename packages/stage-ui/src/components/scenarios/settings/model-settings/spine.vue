<script setup lang="ts">
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { useSpine } from '@proj-airi/stage-ui-spine'
import { Button, FieldRange, Select, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettingsSpine } from '../../../../stores/settings/spine'
import { Section } from '../../../layouts'
import { ColorPalette } from '../../../widgets'

const props = withDefaults(
  defineProps<{
    palette: string[]
    allowExtractColors?: boolean
    modelId?: string
  }>(),
  {
    allowExtractColors: true,
  },
)

defineEmits<(e: 'extractColorsFromModel') => void>()

const { t } = useI18n()

const settingsSpine = useSettingsSpine()
const { spineDefaultMixDuration, spineMaxFps, spineRenderScale } = storeToRefs(settingsSpine)

const { stageModelSelected } = storeToRefs(useSettings())
const positioningStore = usePositioningStore()

const spineStore = useSpine()
const {
  currentAnimation,
  activeAnimations,
  availableAnimations,
  currentSkin,
  availableSkins,
  availableVariants,
  currentVariant,
  animationSpeed,
} = storeToRefs(spineStore)

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
const hasMultipleVariants = computed(() => availableVariants.value.length > 1)

const variantOptions = computed(() =>
  availableVariants.value.map((v) => ({
    description: '',
    label: v.name,
    value: v.name,
  })),
)

/* const animationOptions = computed(() => availableAnimations.value.map(animation => ({
  label: animation.name,
  value: animation.name,
  description: `${animation.duration.toFixed(2)}s`,
}))) */

const skinOptions = computed(() =>
  availableSkins.value.map((skin) => ({
    description: '',
    label: skin.name,
    value: skin.name,
  })),
)

const fpsOptions = computed(() => [
  { label: t('settings.spine.fps.options.unlimited'), value: 0 },
  { label: '60', value: 60 },
  { label: '30', value: 30 },
])

function handleVariantSelect(variantName: string | number | undefined) {
  if (typeof variantName !== 'string') return
  currentVariant.value = variantName
}

function handleSkinSelect(skinName: string | number | undefined) {
  if (typeof skinName !== 'string') return
  currentSkin.value = skinName
}

function toggleAnimation(name: string) {
  const modelId = props.modelId || 'default'
  const currentModelAnims = activeAnimations.value[modelId] || {}
  const current = currentModelAnims[name] || false

  activeAnimations.value = {
    ...activeAnimations.value,
    [modelId]: {
      ...currentModelAnims,
      [name]: !current,
    },
  }
}

function handleAnimationSelect(animationName: string | number | undefined) {
  if (animationName === '') {
    currentAnimation.value = { ...currentAnimation.value, name: '' }
    return
  }
  if (typeof animationName !== 'string') return
  currentAnimation.value = { ...currentAnimation.value, name: animationName }
}

function resetAllAnimations() {
  const modelId = props.modelId || 'default'
  activeAnimations.value = {
    ...activeAnimations.value,
    [modelId]: {},
  }
}

const animationMappings = ref<Record<string, string>>({})
const hiddenAnimations = ref<string[]>([])
const showHiddenAnimations = ref(false)
const filterRenamedOnly = ref(false)
const editingAnimationKey = ref<string | null>(null)
const editingAnimationValue = ref('')

const filteredAnimations = computed(() => {
  return availableAnimations.value.filter((animation) => {
    // Filter hidden
    if (!showHiddenAnimations.value && hiddenAnimations.value.includes(animation.name)) {
      return false
    }
    // Filter renamed
    if (filterRenamedOnly.value && !animationMappings.value[animation.name]) {
      return false
    }
    return true
  })
})

function toggleVisibility(name: string) {
  if (hiddenAnimations.value.includes(name)) {
    hiddenAnimations.value = hiddenAnimations.value.filter((p) => p !== name)
  } else {
    hiddenAnimations.value = [...hiddenAnimations.value, name]
  }
}

function startEditing(animation: any) {
  editingAnimationKey.value = animation.name
  editingAnimationValue.value = animationMappings.value[animation.name] || ''
}

function saveAnimationName(name: string) {
  if (editingAnimationValue.value.trim() === '') {
    const updated = { ...animationMappings.value }
    delete updated[name]
    animationMappings.value = updated
  } else {
    animationMappings.value = { ...animationMappings.value, [name]: editingAnimationValue.value.trim() }
  }
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

function cancelEditing() {
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

const showRenamedOnlyForOverlays = ref(false)

// Watch for changes in animationMappings to set the default
watch(
  animationMappings,
  (mappings) => {
    if (Object.keys(mappings).length > 0) {
      showRenamedOnlyForOverlays.value = true
    }
  },
  { immediate: true },
)

const filteredOverlays = computed(() => {
  if (showRenamedOnlyForOverlays.value) {
    return availableAnimations.value.filter((anim) => animationMappings.value[anim.name])
  }
  return availableAnimations.value
})
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
    <!-- Base Idle Animation -->
    <div class="mb-2 px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
      Base Idle Animation
    </div>
    <!-- Controls Bar -->
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex gap-1">
        <Button
          size="sm"
          :variant="showHiddenAnimations ? 'primary' : 'secondary'"
          @click="showHiddenAnimations = !showHiddenAnimations"
        >
          <template #icon>
            <div :class="showHiddenAnimations ? 'i-solar:eye-bold-duotone' : 'i-solar:eye-closed-bold-duotone'" />
          </template>
          {{ showHiddenAnimations ? 'Showing Hidden' : 'Hide Hidden' }}
        </Button>
        <Button
          size="sm"
          :variant="filterRenamedOnly ? 'primary' : 'secondary'"
          @click="filterRenamedOnly = !filterRenamedOnly"
        >
          <template #icon>
            <div class="i-solar:pen-bold-duotone" />
          </template>
          {{ filterRenamedOnly ? 'Renamed Only' : 'All' }}
        </Button>
      </div>
      <div class="text-xs text-neutral-500">
        {{ filteredAnimations.length }} animations
      </div>
    </div>
    <!-- Fixed Height Scrollable List -->
    <div class="mb-4 max-h-[300px] overflow-y-auto border border-neutral-200 rounded-lg bg-white dark:border-neutral-700 dark:bg-neutral-900">
      <!-- None Option -->
      <div
        :class="[
          'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 transition-colors cursor-pointer',
          !currentAnimation.name ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
        ]"
        @click="handleAnimationSelect('')"
      >
        <div class="flex items-center gap-2">
          <div v-if="!currentAnimation.name" class="h-2 w-2 rounded-full bg-primary-500" />
          <div class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
            None
          </div>
        </div>
      </div>

      <div v-if="filteredAnimations.length === 0" class="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
        No animations match filters
      </div>
      <div
        v-for="animation in filteredAnimations"
        :key="animation.name"
        :class="[
          'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors',
          currentAnimation.name === animation.name ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
        ]"
      >
        <!-- Left Side: Name -->
        <div class="min-w-0 flex-1 cursor-pointer" @click="handleAnimationSelect(animation.name)">
          <div class="flex items-center gap-2">
            <!-- Active Indicator -->
            <div v-if="currentAnimation.name === animation.name" class="h-2 w-2 rounded-full bg-primary-500" />

            <!-- Name (Editable) -->
            <div v-if="editingAnimationKey === animation.name" class="flex flex-1 items-center gap-1" @click.stop>
              <input
                v-model="editingAnimationValue"
                type="text"
                :placeholder="animation.name"
                class="max-w-[230px] w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                @keydown.enter="saveAnimationName(animation.name)"
                @keydown.esc="cancelEditing"
              >
              <button class="text-xs text-green-500 hover:text-green-600" @click="saveAnimationName(animation.name)">
                <div class="i-solar:check-circle-bold-duotone text-lg" />
              </button>
              <button class="text-xs text-red-500 hover:text-red-600" @click="cancelEditing">
                <div class="i-solar:close-circle-bold-duotone text-lg" />
              </button>
            </div>
            <div v-else class="max-w-[230px] truncate text-sm text-neutral-900 font-medium dark:text-neutral-100">
              {{ animationMappings[animation.name] || animation.name }}
            </div>
          </div>
          <div class="ml-4 text-xs text-neutral-500 dark:text-neutral-400">
            {{ animation.duration.toFixed(2) }}s
          </div>
        </div>

        <!-- Right Side: Actions -->
        <div class="flex items-center gap-1" @click.stop>
          <!-- Edit Button -->
          <button
            class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            title="Rename"
            @click="startEditing(animation)"
          >
            <div class="i-solar:pen-bold-duotone text-sm" />
          </button>

          <!-- Visibility Toggle -->
          <button
            class="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            :title="hiddenAnimations.includes(animation.name) ? 'Show' : 'Hide'"
            @click="toggleVisibility(animation.name)"
          >
            <div :class="hiddenAnimations.includes(animation.name) ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
          </button>
        </div>
      </div>
    </div>

    <!-- Independent Animations (Grid) -->
    <div class="mb-2 flex items-center justify-between px-1">
      <span class="text-[10px] text-neutral-400 font-bold tracking-wider uppercase">Independent Overlays</span>
      <div class="flex gap-1">
        <button
          class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="showRenamedOnlyForOverlays = !showRenamedOnlyForOverlays"
        >
          {{ showRenamedOnlyForOverlays ? 'Show All' : 'Show Renamed' }}
        </button>
        <button
          class="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700"
          @click="resetAllAnimations"
        >
          Reset All
        </button>
      </div>
    </div>
    <div v-if="filteredOverlays.length > 0" class="mb-4 flex flex-wrap gap-1">
      <button
        v-for="anim in filteredOverlays"
        :key="anim.name"
        :class="[
          'relative rounded-md px-2 py-1 text-xs transition-all duration-150',
          'border border-solid select-none',
          (activeAnimations[props.modelId || 'default'] || {})[anim.name]
            ? 'bg-primary-500/20 border-primary-400 text-primary-600 dark:text-primary-300 font-medium'
            : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700',
        ]"
        @click="toggleAnimation(anim.name)"
      >
        {{ animationMappings[anim.name] || anim.name }}
      </button>
    </div>
    <FieldRange v-model="spineDefaultMixDuration" as="div" :min="0" :max="2" :step="0.05" :label="t('settings.spine.animation.mix-duration')">
      <template #label>
        <div flex items-center>
          <div>{{ t('settings.spine.animation.mix-duration') }}</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => spineDefaultMixDuration = 0.2">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
    <FieldRange v-model="animationSpeed" as="div" :min="0.1" :max="3" :step="0.05" :label="t('settings.spine.animation.speed')">
      <template #label>
        <div flex items-center>
          <div>{{ t('settings.spine.animation.speed') }}</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => animationSpeed = 1">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>

    <!-- Variant -->
    <div v-if="hasMultipleVariants" class="mt-4">
      <Select
        :model-value="currentVariant"
        :options="variantOptions"
        class="w-full"
        @update:model-value="handleVariantSelect"
      />
    </div>

    <!-- Skin -->
    <div class="mt-4">
      <Select
        :model-value="currentSkin"
        :options="skinOptions"
        class="w-full"
        @update:model-value="handleSkinSelect"
      />
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
    <FieldRange v-model="scale" as="div" :min="0.1" :max="3" :step="0.01" :label="t('settings.spine.scale-and-position.scale')">
      <template #label>
        <div flex items-center>
          <div>{{ t('settings.spine.scale-and-position.scale') }}</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => scale = 1">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
    <FieldRange v-model="positionX" as="div" :min="-3000" :max="3000" :step="1" :label="t('settings.spine.scale-and-position.x')">
      <template #label>
        <div flex items-center>
          <div>{{ t('settings.spine.scale-and-position.x') }}</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => positionX = 0">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
    <FieldRange v-model="positionY" as="div" :min="-3000" :max="3000" :step="1" :label="t('settings.spine.scale-and-position.y')">
      <template #label>
        <div flex items-center>
          <div>{{ t('settings.spine.scale-and-position.y') }}</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => positionY = 0">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
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
        <FieldRange v-model="spineRenderScale" as="div" :min="0.5" :max="3" :step="0.1" :label="t('settings.spine.rendering.render-scale')">
          <template #label>
            <div flex items-center>
              <div>{{ t('settings.spine.rendering.render-scale') }}</div>
              <button px-2 text-xs outline-none title="Reset value to default" :disabled="true" @click="() => spineRenderScale = 1">
                <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
              </button>
            </div>
          </template>
        </FieldRange>
      </div>
      <p class="px-1 text-[10px] text-neutral-400">
        (Rendering controls disabled for Phase 1)
      </p>
    </div>
  </Section>
</template>
