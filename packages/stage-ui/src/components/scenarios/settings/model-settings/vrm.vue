<script setup lang="ts">
import { useCustomVrmAnimationsStore, useModelStore } from '@proj-airi/stage-ui-three'
import { Button, Callout, Checkbox, Select, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAiriCardStore } from '../../../../stores/modules'
import { useVHackStore } from '../../../../stores/vhack'
import { Container, PropertyColor, PropertyNumber } from '../../../data-pane'
import { ColorPalette } from '../../../widgets'
import VRMExpressions from './vrm-expressions.vue'

defineProps<{
  palette: string[]
}>()

defineEmits<(e: 'extractColorsFromModel') => void>()

const { t } = useI18n()

const modelStore = useModelStore()
const vhackStore = useVHackStore()
const customVrmAnimationsStore = useCustomVrmAnimationsStore()
const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)
const { updateCard } = airiCardStore

const {
  modelSize,
  modelOffset,
  cameraFOV,
  modelRotationY,
  cameraDistance,
  trackingMode,

  directionalLightRotation,
  directionalLightIntensity,
  directionalLightColor,

  ambientLightIntensity,
  ambientLightColor,

  hemisphereLightIntensity,
  hemisphereSkyColor,
  hemisphereGroundColor,

  envSelect,
  skyBoxIntensity,
  vrmIdleAnimation,
  vrmIdleCycleEnabled,
} = storeToRefs(modelStore)
const { animationOptions } = storeToRefs(customVrmAnimationsStore)

// NOTICE: sceneMutationLocked was removed upstream; hardcoded to false.
const sceneMutationLocked = computed(() => false)
const trackingOptions = computed<
  {
    value: 'camera' | 'mouse' | 'none'
    label: string
    class: string
  }[]
>(() => [
  { class: 'col-start-3', label: t('settings.vrm.scale-and-position.options.option.camera'), value: 'camera' },
  { class: 'col-start-4', label: t('settings.vrm.scale-and-position.options.option.mouse'), value: 'mouse' },
  { class: 'col-start-5', label: t('settings.vrm.scale-and-position.options.option.disabled'), value: 'none' },
])

const activeTab = ref<'placement' | 'lighting'>('placement')

const vrmTabs = computed(() => [
  { icon: 'i-solar:square-academic-cap-bold-duotone', label: 'Placement', value: 'placement' },
  { icon: 'i-solar:lightbulb-bold-duotone', label: 'Lighting', value: 'lighting' },
])

const activeCharacterTab = ref<'expressions' | 'animations'>('expressions')
const characterTabs = computed(() => [
  { icon: 'i-solar:smile-circle-bold-duotone', label: 'Expressions', value: 'expressions' },
  { icon: 'i-solar:play-bold-duotone', label: 'Animations', value: 'animations' },
])

// switch between hemisphere light and sky box
const settingsLockClass = computed(() => {
  return sceneMutationLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})

const envOptions = computed(() => [
  {
    icon:
      envSelect.value === 'hemisphere'
        ? 'i-solar:forbidden-circle-bold rotate-45'
        : 'i-solar:forbidden-circle-linear rotate-45',
    label: 'Hemisphere',
    value: 'hemisphere',
  },
  {
    icon: envSelect.value === 'skyBox' ? 'i-solar:gallery-circle-bold' : 'i-solar:gallery-circle-linear',
    label: 'SkyBox',
    value: 'skyBox',
  },
])

function isAnimationSelected(key: string) {
  return activeCard.value?.extensions?.airi?.acting?.idleAnimations?.includes(key) ?? false
}

function toggleAnimation(key: string) {
  if (!activeCardId.value || !activeCard.value) return

  const current = activeCard.value.extensions.airi.acting?.idleAnimations || []
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key]

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
</script>

<template>
  <div flex="~ col gap-4 w-full">
    <!-- === Character Customizations === -->
    <Container
      title="Character Customizations"
      icon="i-solar:user-bold-duotone"
      :expanded="true"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
    >
      <div class="mb-4 px-2 pt-2">
        <SelectTab v-model="activeCharacterTab" :options="characterTabs" size="sm" />
      </div>

      <div :class="settingsLockClass">
        <!-- === Expressions Tab === -->
        <div v-if="activeCharacterTab === 'expressions'" flex="~ col gap-4" p-2>
          <VRMExpressions />
        </div>

        <!-- === Animations Tab === -->
        <div v-if="activeCharacterTab === 'animations'" flex="~ col gap-4" p-2>
          <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
            <div class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
              {{ t('settings.vrm.idle-animation.title') }}
            </div>
            <div />
            <div grid-col-span-3>
              <Select
                v-model="vrmIdleAnimation"
                :options="animationOptions"
                :disabled="sceneMutationLocked"
                class="w-full"
              />
            </div>

            <div class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
              Random Cycle
            </div>
            <div />
            <div grid-col-span-3 flex items-center>
              <Checkbox v-model="vrmIdleCycleEnabled" />
              <span class="ml-2 text-[10px] text-neutral-400 italic">Automatically cycle through idle animations</span>
            </div>

            <template v-if="activeCard">
              <div class="col-span-full mb-2 mt-4 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
                Cycle Subset
              </div>
              <div class="col-span-full max-h-40 flex flex-col gap-2 overflow-y-auto rounded-lg bg-black/5 p-2 dark:bg-white/5">
                <div
                  v-for="option in animationOptions"
                  :key="option.value"
                  class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 transition hover:bg-black/5 dark:hover:bg-white/5"
                  @click="toggleAnimation(option.value)"
                >
                  <Checkbox
                    :model-value="isAnimationSelected(option.value)"
                    @update:model-value="toggleAnimation(option.value)"
                  />
                  <span class="text-xs text-neutral-600 dark:text-neutral-300">{{ option.label }}</span>
                </div>
              </div>
              <p class="col-span-full mt-1 text-[10px] text-neutral-400 italic">
                If none are selected, all animations will be included in the cycle.
              </p>
            </template>
          </div>
        </div>
      </div>
    </Container>

    <Container
      :title="t('settings.pages.models.sections.section.scene')"
      icon="i-solar:people-nearby-bold-duotone"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
    >
      <ColorPalette class="mb-4 mt-2" :colors="palette.map(hex => ({ hex, name: hex }))" mx-auto />

      <!-- Tab Selection -->
      <div class="mb-4 px-2">
        <SelectTab v-model="activeTab" :options="vrmTabs" size="sm" />
      </div>

      <div :class="settingsLockClass">
        <!-- === Placement Tab === -->
        <div v-if="activeTab === 'placement'" flex="~ col gap-4" p-2>
          <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
            <PropertyNumber
              v-model="modelOffset.x"
              :config="{ min: -modelSize.x * 2, max: modelSize.x * 2, step: modelSize.x / 1000, label: 'X', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.x')"
            />
            <PropertyNumber
              v-model="modelOffset.y"
              :config="{ min: -modelSize.y * 2, max: modelSize.y * 2, step: modelSize.y / 1000, label: 'Y', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.y')"
            />
            <PropertyNumber
              v-model="modelOffset.z"
              :config="{ min: -modelSize.z * 2, max: modelSize.z * 2, step: modelSize.z / 1000, label: 'Z', formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.z')"
            />
            <PropertyNumber
              v-model="modelRotationY"
              :config="{ min: -180, max: 180, step: 1, label: t('settings.vrm.scale-and-position.rotation-y'), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.rotation-y')"
            />
            <PropertyNumber
              v-model="cameraDistance"
              :config="{ min: modelSize.z, max: modelSize.z * 20, step: modelSize.z / 100, label: t('settings.vrm.scale-and-position.camera-distance'), formatValue: val => val?.toFixed(4), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.camera-distance')"
            />
            <PropertyNumber
              v-model="cameraFOV"
              :config="{ min: 1, max: 180, step: 1, label: t('settings.vrm.scale-and-position.fov'), disabled: sceneMutationLocked }"
              :label="t('settings.vrm.scale-and-position.fov')"
            />

            <!-- Eye Tracking Mode -->
            <div class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
              {{ t('settings.vrm.scale-and-position.eye-tracking-mode.title') }}
            </div>
            <div />
            <div grid-col-span-3>
              <SelectTab
                v-model="trackingMode"
                :options="trackingOptions"
                :disabled="sceneMutationLocked"
                size="sm"
              />
            </div>
          </div>
        </div>

        <!-- === Lighting Tab === -->
        <div v-if="activeTab === 'lighting'" flex="~ col gap-6" p-2>
          <!-- Directional Light -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Directional Light
            </div>
            <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyNumber
                v-model="directionalLightRotation.x"
                :config="{ min: -180, max: 180, step: 1, label: 'X°', formatValue: val => val?.toFixed(0), disabled: sceneMutationLocked }"
                label="Rotation X"
              />
              <PropertyNumber
                v-model="directionalLightRotation.y"
                :config="{ min: -180, max: 180, step: 1, label: 'Y°', formatValue: val => val?.toFixed(0), disabled: sceneMutationLocked }"
                label="Rotation Y"
              />
              <PropertyColor
                v-model="directionalLightColor"
                :disabled="sceneMutationLocked"
                label="Color"
              />
              <PropertyNumber
                v-model="directionalLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
          </div>

          <!-- Ambient Light -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Ambient Light
            </div>
            <div grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyColor
                v-model="ambientLightColor"
                :disabled="sceneMutationLocked"
                label="Color"
              />
              <PropertyNumber
                v-model="ambientLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
          </div>

          <!-- Environment -->
          <div flex="~ col gap-2">
            <div class="px-1 text-[10px] text-neutral-400 font-bold tracking-wider uppercase">
              Environment
            </div>
            <div class="mb-1">
              <SelectTab v-model="envSelect" :options="envOptions" :disabled="sceneMutationLocked" size="sm" />
            </div>

            <div v-if="envSelect === 'hemisphere'" grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyColor
                v-model="hemisphereSkyColor"
                :disabled="sceneMutationLocked"
                label="Sky Color"
              />
              <PropertyColor
                v-model="hemisphereGroundColor"
                :disabled="sceneMutationLocked"
                label="Ground Color"
              />
              <PropertyNumber
                v-model="hemisphereLightIntensity"
                :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                label="Intensity"
              />
            </div>
            <div v-else grid="~ cols-5 gap-y-2 gap-x-1" items-center>
              <PropertyNumber
                v-model="skyBoxIntensity"
                :config="{ min: 0, max: 1, step: 0.01, label: 'Intensity', disabled: sceneMutationLocked }"
                :label="t('settings.vrm.skybox.skybox-intensity')"
              />
            </div>
          </div>
        </div>
      </div>
    </Container>

    <!-- === Advanced Tools === -->
    <Container
      title="Advanced"
      icon="i-solar:settings-bold-duotone"
      :expanded="false"
      :class="[
        'rounded-xl',
        'bg-white/80  dark:bg-black/75',
        'backdrop-blur-lg',
      ]"
    >
      <div flex="~ col gap-4" p-2 :class="settingsLockClass">
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
    </Container>
  </div>
</template>
