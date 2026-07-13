<script setup lang="ts">
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Callout, Checkbox, FieldRange, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelSceneSettings from './components/ModelSceneSettings.vue'
import VRMExpressions from './vrm-expressions.vue'

import { useAiriCardStore } from '../../../../stores/modules'
import { usePositioningStore } from '../../../../stores/settings/positioning'
import { useVHackStore } from '../../../../stores/vhack'
import { Section } from '../../../layouts'

defineProps<{
  palette: string[]
  modelId?: string
}>()

defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()

const { t } = useI18n()

const modelStore = useModelStore()
const vhackStore = useVHackStore()
const positioningStore = usePositioningStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { updateCard } = airiCardStore

const {
  modelSize,
  vrmIdleAnimation,
  followSpeed,
} = storeToRefs(modelStore)

const mouseTrackingEnabled = computed({
  get: () => modelStore.trackingMode === 'mouse',
  set: (val) => {
    modelStore.trackingMode = val ? 'mouse' : 'none'
  },
})
const { animationOptions } = storeToRefs(customVrmAnimationsStore)

// NOTICE: sceneMutationLocked was removed upstream; hardcoded to false.
const sceneMutationLocked = computed(() => false)

const activeCharacterTab = ref<'expressions' | 'animations'>('expressions')
const characterTabs = computed(() => [
  { label: t('settings.live2d.customization.tabs.expressions'), value: 'expressions', icon: 'i-solar:smile-circle-bold-duotone' },
  { label: t('settings.live2d.customization.tabs.animations'), value: 'animations', icon: 'i-solar:play-bold-duotone' },
])

// switch between hemisphere light and sky box
const settingsLockClass = computed(() => {
  return sceneMutationLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})

const animationMappings = ref<Record<string, string>>({})
const hiddenAnimations = ref<string[]>([])
const showHiddenAnimations = ref(false)
const filterRenamedOnly = ref(false)
const editingAnimationKey = ref<string | null>(null)
const editingAnimationValue = ref('')

const filteredAnimations = computed(() => {
  return animationOptions.value.filter((animation) => {
    // Filter hidden
    if (!showHiddenAnimations.value && hiddenAnimations.value.includes(animation.value)) {
      return false
    }
    // Filter renamed
    if (filterRenamedOnly.value && !animationMappings.value[animation.value]) {
      return false
    }
    return true
  })
})

function isAnimationSelected(key: string) {
  return activeCard.value?.extensions?.airi?.acting?.idleAnimations?.includes(key) ?? false
}

function toggleAnimation(key: string) {
  if (!activeCardId.value || !activeCard.value)
    return

  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(key)
    ? current.filter(k => k !== key)
    : [...current, key]

  updateCard(activeCardId.value, {
    extensions: {
      ...activeCard.value.extensions,
      airi: {
        ...activeCard.value.extensions.airi,
        acting: {
          ...activeCard.value.extensions.airi.acting,
          idleAnimations: next,
        },
      },
    },
  })
}

function toggleVisibility(name: string) {
  if (hiddenAnimations.value.includes(name)) {
    hiddenAnimations.value = hiddenAnimations.value.filter(p => p !== name)
  }
  else {
    hiddenAnimations.value = [...hiddenAnimations.value, name]
  }
}

function startEditing(animation: any) {
  editingAnimationKey.value = animation.value
  editingAnimationValue.value = animationMappings.value[animation.value] || ''
}

function saveAnimationName(name: string) {
  if (editingAnimationValue.value.trim() === '') {
    const updated = { ...animationMappings.value }
    delete updated[name]
    animationMappings.value = updated
  }
  else {
    animationMappings.value = { ...animationMappings.value, [name]: editingAnimationValue.value.trim() }
  }
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

function cancelEditing() {
  editingAnimationKey.value = null
  editingAnimationValue.value = ''
}

function handleAnimationSelect(animationName: string | number | undefined) {
  if (animationName === '') {
    vrmIdleAnimation.value = ''
    if (activeCardId.value && activeCard.value) {
      // Filter out prefix-less (VRM) animations from card idleAnimations cycle list
      const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
      const next = current.filter(key => key.includes(':'))
      updateCard(activeCardId.value, {
        extensions: {
          ...activeCard.value.extensions,
          airi: {
            ...activeCard.value.extensions.airi,
            acting: {
              ...activeCard.value.extensions.airi.acting,
              idleAnimations: next,
            },
          },
        },
      })
    }
    return
  }
  if (typeof animationName !== 'string')
    return
  vrmIdleAnimation.value = animationName
}
</script>

<template>
  <div flex="~ col gap-4 w-full">
    <!-- === Character Customizations === -->
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
      <div class="mb-4 px-2 pt-2">
        <SelectTab v-model="activeCharacterTab" :options="characterTabs" size="sm" compact class="mb-4" />
      </div>

      <div :class="settingsLockClass">
        <!-- === Expressions Tab === -->
        <div v-if="activeCharacterTab === 'expressions'" class="min-w-0 w-full flex flex-col gap-4 overflow-hidden p-2">
          <VRMExpressions />
        </div>

        <!-- === Motions Tab === -->
        <div v-else-if="activeCharacterTab === 'animations'" :class="['w-full', 'min-w-0']">
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
                !vrmIdleAnimation ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
              @click="handleAnimationSelect('')"
            >
              <div class="flex items-center gap-2">
                <div v-if="!vrmIdleAnimation" class="h-2 w-2 rounded-full bg-primary-500" />
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
              :key="animation.value"
              :class="[
                'flex items-center justify-between px-4 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 transition-colors',
                vrmIdleAnimation === animation.value || isAnimationSelected(animation.value) ? 'bg-primary-50/50 dark:bg-primary-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
              ]"
            >
              <!-- Left Side: Name -->
              <div class="min-w-0 flex-1 cursor-pointer" @click="handleAnimationSelect(animation.value)">
                <div class="flex items-center gap-2">
                  <!-- Active Indicator -->
                  <div v-if="vrmIdleAnimation === animation.value" class="h-2 w-2 rounded-full bg-primary-500" />

                  <!-- Name (Editable) -->
                  <div v-if="editingAnimationKey === animation.value" class="flex flex-1 items-center gap-1" @click.stop>
                    <input
                      v-model="editingAnimationValue"
                      type="text"
                      :placeholder="animation.label"
                      class="max-w-[230px] w-full border-b border-primary-500 bg-transparent text-sm dark:text-neutral-100 focus:outline-none"
                      @keydown.enter="saveAnimationName(animation.value)"
                      @keydown.esc="cancelEditing"
                    >
                    <button class="text-xs text-green-500 hover:text-green-600" @click="saveAnimationName(animation.value)">
                      <div class="i-solar:check-circle-bold-duotone text-lg" />
                    </button>
                    <button class="text-xs text-red-500 hover:text-red-600" @click="cancelEditing">
                      <div class="i-solar:close-circle-bold-duotone text-lg" />
                    </button>
                  </div>
                  <div v-else class="max-w-[230px] truncate text-sm text-neutral-900 font-medium dark:text-neutral-100">
                    {{ animationMappings[animation.value] || animation.label }}
                  </div>
                </div>
              </div>

              <!-- Right Side: Actions -->
              <div class="flex items-center gap-1" @click.stop>
                <!-- Loop / Cycle Toggle -->
                <button
                  v-if="activeCard"
                  :class="[
                    'rounded p-1 transition-colors',
                    isAnimationSelected(animation.value)
                      ? 'text-primary-500 hover:text-primary-600 bg-primary-500/10'
                      : 'text-neutral-400 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:bg-neutral-800',
                  ]"
                  :title="isAnimationSelected(animation.value) ? 'Remove from Idle Cycle' : 'Add to Idle Cycle'"
                  @click="toggleAnimation(animation.value)"
                >
                  <div class="i-solar:infinity-bold-duotone text-sm" />
                </button>

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
                  :title="hiddenAnimations.includes(animation.value) ? 'Show' : 'Hide'"
                  @click="toggleVisibility(animation.value)"
                >
                  <div :class="hiddenAnimations.includes(animation.value) ? 'i-solar:eye-closed-bold-duotone' : 'i-solar:eye-bold-duotone'" class="text-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>

    <ModelSceneSettings
      :store="modelStore"
      :positioning-store="positioningStore"
      :model-id="modelId"
      :model-size="modelSize"
      :palette="palette"
      :scene-mutation-locked="sceneMutationLocked"
    />

    <!-- === Advanced Tools === -->
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
      <div flex="~ col gap-4" p-2 :class="settingsLockClass">
        <!-- Mouse Tracking & Follow Speed -->
        <div flex="~ col gap-4" class="mb-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div flex="~ items-center justify-between">
            <div flex="~ col gap-0.5">
              <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('settings.vrm.scale-and-position.mouse-tracking') }}</span>
              <span class="text-[10px] text-neutral-400">{{ t('settings.vrm.scale-and-position.mouse-tracking-desc') }}</span>
            </div>
            <Checkbox v-model="mouseTrackingEnabled" :disabled="sceneMutationLocked" />
          </div>

          <div v-if="mouseTrackingEnabled" flex="~ col gap-2">
            <FieldRange
              v-model="followSpeed"
              :min="0.01"
              :max="1"
              :step="0.01"
              :disabled="sceneMutationLocked"
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

        <div flex="~ col gap-2">
          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            V-HACK Editor
          </div>
          <Button
            :variant="vhackStore.isHackerModeActive ? 'primary' : 'secondary'"
            :disabled="sceneMutationLocked"
            @click="vhackStore.toggleHackerMode"
          >
            <template #icon>
              <div i-solar:mask-h-bold-duotone />
            </template>
            V-HACK Dashboard
          </Button>
          <p class="mb-2 px-1 text-[10px] text-neutral-400">
            Open the Hacker Inspector for real-time mesh and material modding.
          </p>

          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Theme Extraction
          </div>
          <Button variant="secondary" :disabled="sceneMutationLocked" @click="$emit('extractColorsFromModel')">
            <template #icon>
              <div i-solar:palette-bold-duotone />
            </template>
            {{ t('settings.vrm.theme-color-from-model.button-extract.title') }}
          </Button>
          <p class="px-1 text-[10px] text-neutral-400">
            Extract dominant colors from the model texture to set UI theme.
          </p>
        </div>

        <div flex="~ col gap-2">
          <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
            Model Information
          </div>
          <Callout :label="t('settings.vrm.scale-and-position.model-info-title')">
            <div class="text-[11px] text-neutral-600 space-y-1 dark:text-neutral-400">
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-x') }}</span>
                <span font-mono>{{ modelSize.x.toFixed(4) }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-y') }}</span>
                <span font-mono>{{ modelSize.y.toFixed(4) }}</span>
              </div>
              <div class="flex justify-between">
                <span>{{ t('settings.vrm.scale-and-position.model-info-z') }}</span>
                <span font-mono>{{ modelSize.z.toFixed(4) }}</span>
              </div>
            </div>
          </Callout>
        </div>

        <Callout theme="lime" label="Tips!">
          <div class="text-[11px] text-neutral-600 leading-relaxed dark:text-neutral-400">
            {{ t('settings.vrm.scale-and-position.tips') }}
          </div>
        </Callout>
      </div>
    </Section>
  </div>
</template>
