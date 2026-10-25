<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Checkbox, FieldRange, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelCustomizerSkeleton from './components/ModelCustomizerSkeleton.vue'
import ModelSceneSettings from './components/ModelSceneSettings.vue'
import VRMExpressions from './vrm-expressions.vue'
import HackerPanel from './vrm-vhack/HackerPanel.vue'

import { usePositioningStore } from '../../../../stores/settings/positioning'
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
const positioningStore = usePositioningStore()

const {
  modelSize,
  followSpeed,
  maxFps,
} = storeToRefs(modelStore)

const fpsOptions = computed(() => [
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 0, label: t('settings.vrm.fps.options.unlimited') },
])

const mouseTrackingEnabled = computed({
  get: () => modelStore.trackingMode === 'mouse',
  set: (val) => {
    modelStore.trackingMode = val ? 'mouse' : 'none'
  },
})

// NOTICE: sceneMutationLocked was removed upstream; hardcoded to false.
const sceneMutationLocked = computed(() => false)

// switch between hemisphere light and sky box
const settingsLockClass = computed(() => {
  return sceneMutationLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})

const isReadyToHydrate = ref(false)

onMounted(() => {
  // Defer heavy expressions hydration until stage viewport paints its initial frame
  requestAnimationFrame(() => {
    setTimeout(() => {
      isReadyToHydrate.value = true
    }, 150)
  })
})
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
      <div :class="settingsLockClass" class="min-w-0 w-full flex flex-col gap-4 overflow-hidden p-2">
        <VRMExpressions v-if="isReadyToHydrate" :model-id="modelId" />
        <ModelCustomizerSkeleton v-else />
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

    <!-- === Behavior & performance === -->
    <Section
      title="Behavior & performance"
      icon="i-solar:settings-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
      size="sm"
      :expand="true"
    >
      <div flex="~ col gap-4" p-2 :class="settingsLockClass">
        <!-- Mouse Tracking & Follow Speed -->
        <div flex="~ col gap-4" class="border-b border-neutral-100 pb-4 dark:border-neutral-800">
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

        <!-- Frame Rate Limit -->
        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('settings.vrm.fps.title') }}</span>
            <span class="text-[10px] text-neutral-400">{{ t('settings.vrm.fps.description') }}</span>
          </div>
          <SelectTab v-model="maxFps" :options="fpsOptions" size="sm" />
        </div>
      </div>
    </Section>

    <!-- === Avatar Appearance (docked V-HACK inspector) === -->
    <Section
      title="Avatar Appearance"
      icon="i-solar:mask-h-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
      size="sm"
      :expand="true"
    >
      <div class="min-w-0 w-full flex flex-col gap-2 p-2">
        <p class="px-1 text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
          Replace textures and fine-tune their appearance.
        </p>
        <HackerPanel />
      </div>
    </Section>
  </div>
</template>
