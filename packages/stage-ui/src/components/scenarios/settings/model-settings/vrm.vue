<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Callout, Checkbox, FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ModelSceneSettings from './components/ModelSceneSettings.vue'
import VRMExpressions from './vrm-expressions.vue'

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

const {
  modelSize,
  followSpeed,
} = storeToRefs(modelStore)

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
        <VRMExpressions :model-id="modelId" />
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
