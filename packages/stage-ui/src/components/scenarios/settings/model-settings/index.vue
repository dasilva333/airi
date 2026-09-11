<script setup lang="ts">
import type { DisplayModel } from '../../../../stores/display-models'

import { useMmd } from '@proj-airi/stage-ui-mmd/stores'
import { useSpine } from '@proj-airi/stage-ui-spine/stores'
import { Button, Callout } from '@proj-airi/ui'
import { useLocalStorage, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useIdleAnimations } from '../../../../composables'
import { useAiriCardStore } from '../../../../stores/modules'
import { useSettings } from '../../../../stores/settings'
import { usePositioningStore } from '../../../../stores/settings/positioning'
import { useVHackStore } from '../../../../stores/vhack'
import { ModelAssignmentModal } from '../../dialogs/model-assignment'
import { ModelSelectorDialog } from '../../dialogs/model-selector'

const props = defineProps<{
  palette: string[]
  settingsClass?: string | string[]

  live2dSceneClass?: string | string[]
  vrmSceneClass?: string | string[]
  initialTab?: 'library' | 'explore' | 'cloud'
}>()
defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()
const Live2DScene = defineAsyncComponent(() => import('@proj-airi/stage-ui-live2d').then(m => m.Live2DScene))
const ThreeScene = defineAsyncComponent(() => import('@proj-airi/stage-ui-three').then(m => m.ThreeScene))
const SpineScene = defineAsyncComponent(() => import('@proj-airi/stage-ui-spine').then(m => m.SpineScene))
const MMDScene = defineAsyncComponent(() => import('@proj-airi/stage-ui-mmd').then(m => m.MMDScene))

const Live2D = defineAsyncComponent(() => import('./live2d.vue'))
const VRM = defineAsyncComponent(() => import('./vrm.vue'))
const Spine = defineAsyncComponent(() => import('./spine.vue'))
const MMD = defineAsyncComponent(() => import('./mmd.vue'))

const HackerPanel = defineAsyncComponent(() => import('./vrm-vhack/HackerPanel.vue'))
const LHackerPanel = defineAsyncComponent(() => import('./live2d-lhack/LHackerPanel.vue'))

const router = useRouter()
const modelSelectorOpen = ref(false)
const modelSelectorTab = ref<'library' | 'explore' | 'cloud'>(props.initialTab || 'library')

function openModelSelector(tab: 'library' | 'explore' | 'cloud' = 'library') {
  if (tab === 'explore') {
    router.push('/settings/models/explore')
    return
  }
  modelSelectorTab.value = tab
  modelSelectorOpen.value = true
}
const modelAssignmentOpen = ref(false)
const positionCursor = useMouse()
const settingsStore = useSettings()
const vhackStore = useVHackStore()
const spineStore = useSpine()
const {
  live2dDisableFocus,
  stageModelSelectedUrl,
  stageModelSelectedFile,
  stageModelSelected,
  stageModelSelectedDisplayModel,
  stageModelRenderer,
  themeColorsHue,
  themeColorsHueDynamic,
  live2dIdleAnimationEnabled,
  live2dAutoBlinkEnabled,
  live2dForceAutoBlinkEnabled,
  live2dShadowEnabled,
  live2dMaxFps,
} = storeToRefs(settingsStore)
const { premultipliedAlpha: spinePremultipliedAlpha } = storeToRefs(spineStore)

const positioningStore = usePositioningStore()
const mmdStore = useMmd()
const { previewExpression } = storeToRefs(mmdStore)

const computedScale = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).scale
})

const computedXOffset = computed(() => {
  return positioningStore.getPosition(stageModelSelected.value).x
})

const computedYOffset = computed(() => {
  const y = positioningStore.getPosition(stageModelSelected.value).y
  if (stageModelRenderer.value === 'live2d') {
    return -y
  }
  return y
})

const airiCardStore = useAiriCardStore()
const { activeCard, activeCardId } = storeToRefs(airiCardStore)

const { resolveActiveIdleAnimations } = useIdleAnimations()

const resolvedIdleAnimations = computed(() => {
  return resolveActiveIdleAnimations(activeCard.value, stageModelSelected.value)
})

const currentSelectedDisplayModel = computed<DisplayModel | undefined>(() => stageModelSelectedDisplayModel.value)

const modelSupportCalloutDismissed = useLocalStorage('airi-model-support-callout-dismissed', false)

const live2dRef = ref<any>()
const threeSceneRef = ref<any>()
const isStageExpanded = ref(false)

onMounted(async () => {
  if (!stageModelSelected.value) {
    const cardModelId = activeCard.value?.extensions?.airi?.active_state?.displayModelId
      ?? activeCard.value?.extensions?.airi?.modules?.displayModelId
    if (cardModelId) {
      stageModelSelected.value = cardModelId
    }
  }
  if (!stageModelRenderer.value || !stageModelSelectedDisplayModel.value || !stageModelSelectedUrl.value) {
    await settingsStore.updateStageModel('model-settings mounted')
  }
})

defineExpose({
  openModelSelector,
  captureFrame: async () => {
    if (stageModelRenderer.value === 'live2d') {
      return (live2dRef.value as any)?.captureFrame()
    }
    else if (stageModelRenderer.value === 'vrm') {
      return threeSceneRef.value?.captureFrame()
    }
    return null
  },
})

async function handleModelPick(selectedModel: DisplayModel | undefined) {
  stageModelSelected.value = selectedModel?.id ?? ''
  await settingsStore.updateStageModel()
}

function handleScaleChange(newScale: number) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, { ...current, scale: newScale })
}

function handleOffsetChange(offset: { x: number, y: number }) {
  const key = stageModelSelected.value
  const current = positioningStore.getPosition(key)
  positioningStore.setPosition(key, {
    ...current,
    x: offset.x,
    y: stageModelRenderer.value === 'live2d' ? -offset.y : offset.y,
  })
}
</script>

<template>
  <div class="relative h-full w-full flex flex-col gap-3 overflow-hidden md:flex-row">
    <!-- Stage Viewport Container -->
    <!-- In Portrait (< md): Dedicated top viewport (split or expanded) -->
    <!-- In Landscape (>= md): Full right canvas area -->
    <div
      :class="[
        'order-1 md:order-2 relative overflow-hidden transition-all duration-300 ease-in-out',
        // Mobile / Portrait split view classes
        'w-full md:w-auto md:flex-1 md:h-full',
        isStageExpanded
          ? 'h-[76dvh]'
          : 'h-[36dvh] sm:h-[42dvh] md:h-full',
        'rounded-2xl md:rounded-none border md:border-none border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-100/40 dark:bg-neutral-900/30 shadow-inner md:shadow-none shrink-0',
      ]"
    >
      <!-- Floating Stage HUD for Mobile / Portrait -->
      <div class="absolute right-2 top-2 z-20 flex items-center gap-1.5 md:hidden">
        <button
          type="button"
          :class="[
            'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg backdrop-blur-md transition shadow-sm select-none cursor-pointer',
            isStageExpanded
              ? 'bg-primary-500 text-white shadow-primary-500/30'
              : 'bg-neutral-900/70 text-neutral-200 hover:bg-neutral-900/90 border border-white/10',
          ]"
          @click="isStageExpanded = !isStageExpanded"
        >
          <div :class="isStageExpanded ? 'i-solar:minimize-square-minimalistic-bold' : 'i-solar:maximize-square-minimalistic-bold'" class="text-sm" />
          <span>{{ isStageExpanded ? 'Split' : 'Expand' }}</span>
        </button>
      </div>

      <!-- Format Badge -->
      <div class="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-1.5 border border-white/10 rounded-full bg-neutral-900/70 px-2.5 py-1 text-[10px] text-neutral-300 font-semibold tracking-wider uppercase shadow-sm backdrop-blur-md">
        <div class="size-1.5 animate-pulse rounded-full bg-primary-400" />
        <span>{{ stageModelRenderer }}</span>
      </div>

      <!-- Live2D component for 2D stage view -->
      <template v-if="stageModelRenderer === 'live2d'">
        <div class="absolute inset-0 h-full w-full" :class="[...(props.live2dSceneClass ? (typeof props.live2dSceneClass === 'string' ? [props.live2dSceneClass] : props.live2dSceneClass) : [])]">
          <Live2DScene
            :paused="modelSelectorOpen"
            :focus-at="{ x: positionCursor.x.value, y: positionCursor.y.value }"
            :model-src="stageModelSelectedUrl"
            :model-id="stageModelSelected"
            :model-file="stageModelSelectedFile"
            :disable-focus-at="live2dDisableFocus"
            :scale="computedScale"
            :x-offset="computedXOffset"
            :y-offset="computedYOffset"
            :theme-colors-hue="themeColorsHue"
            :theme-colors-hue-dynamic="themeColorsHueDynamic"
            :live2d-idle-animation-enabled="live2dIdleAnimationEnabled"
            :live2d-auto-blink-enabled="live2dAutoBlinkEnabled"
            :live2d-force-auto-blink-enabled="live2dForceAutoBlinkEnabled"
            :live2d-shadow-enabled="live2dShadowEnabled"
            :live2d-max-fps="live2dMaxFps"
            :draggable="true"
            @scale-change="handleScaleChange"
            @offset-change="handleOffsetChange"
          />
        </div>
      </template>

      <!-- VRM component for 3D stage view -->
      <template v-if="stageModelRenderer === 'vrm'">
        <div class="absolute inset-0 h-full w-full" :class="[...(props.vrmSceneClass ? (typeof props.vrmSceneClass === 'string' ? [props.vrmSceneClass] : props.vrmSceneClass) : [])]">
          <ThreeScene
            ref="threeSceneRef"
            :paused="modelSelectorOpen"
            :model-src="stageModelSelectedUrl"
            :model-identity="stageModelSelected"
            :idle-animations="resolvedIdleAnimations"
            @binary-loaded="vhackStore.setSourceArrayBuffer"
          />
        </div>
      </template>

      <!-- Spine component for 2D stage view -->
      <template v-if="stageModelRenderer === 'spine'">
        <div class="absolute inset-0 h-full w-full" :class="[...(props.live2dSceneClass ? (typeof props.live2dSceneClass === 'string' ? [props.live2dSceneClass] : props.live2dSceneClass) : [])]">
          <SpineScene
            :paused="modelSelectorOpen"
            :model-src="stageModelSelectedUrl"
            :model-id="stageModelSelected"
            :x-offset="computedXOffset"
            :y-offset="computedYOffset"
            :scale="computedScale"
            :premultiplied-alpha="spinePremultipliedAlpha"
            :idle-animations="resolvedIdleAnimations"
          />
        </div>
      </template>

      <!-- MMD component for 3D stage view -->
      <template v-if="stageModelRenderer === 'mmd'">
        <div class="absolute inset-0 h-full w-full" :class="[...(props.vrmSceneClass ? (typeof props.vrmSceneClass === 'string' ? [props.vrmSceneClass] : props.vrmSceneClass) : [])]">
          <MMDScene
            :paused="modelSelectorOpen"
            :model-src="stageModelSelectedUrl"
            :texture-map="settingsStore.mmdTextureMap"
            :scale="computedScale"
            :position-x="computedXOffset"
            :position-y="computedYOffset"
            :idle-animations="resolvedIdleAnimations"
            interaction-mode="drag"
            :preview-expression="previewExpression || undefined"
            @scale-change="handleScaleChange"
            @offset-change="handleOffsetChange"
          />
        </div>
      </template>
    </div>

    <!-- Controls Container -->
    <!-- In Portrait (< md): Scrollable bottom sheet -->
    <!-- In Landscape (>= md): Fixed width left column -->
    <div
      :class="[
        'order-2 md:order-1 flex flex-col gap-2 z-10 overflow-y-auto p-1',
        'w-full md:w-[380px] lg:w-[420px] xl:w-[440px] md:shrink-0',
        isStageExpanded ? 'hidden md:flex' : 'flex-1 min-h-0',
        ...(props.settingsClass
          ? (typeof props.settingsClass === 'string' ? [props.settingsClass] : props.settingsClass)
          : []),
      ]"
    >
      <div v-if="!modelSupportCalloutDismissed" class="relative">
        <Callout label="We support both 2D and 3D models">
          <p>
            Click <button type="button" class="cursor-pointer font-semibold underline hover:text-primary-600 dark:hover:text-primary-300" @click="openModelSelector('library')">
              Select Model
            </button> to import models into your catalog. We support <strong>Live2D</strong> (Cubism 3.0 to 5.0 <code>.zip</code>), <strong>MMD</strong> (PMX files in <code>.zip</code>), <strong>Spine</strong> (3.8 to 4.2 <code>.zip</code>), and <strong>VRM</strong> (both 0.x and 1.x <code>.vrm</code>).
          </p>
          <p>
            Custom animation uploads are also supported for VRM and MMD via <code>.vrma</code> and <code>.vmd</code> motion files. Check out <button type="button" class="cursor-pointer font-semibold underline hover:text-primary-600 dark:hover:text-primary-300" @click="router.push('/settings/models/explore')">
              Discover Avatars
            </button> to discover and download new community models!
          </p>
        </Callout>
        <div
          class="absolute right-2 top-2 cursor-pointer text-neutral-500 transition hover:text-neutral-700"
          i-solar:eye-closed-bold-duotone
          @click="modelSupportCalloutDismissed = true"
        />
      </div>

      <div :class="['flex w-full gap-2']">
        <ModelSelectorDialog v-model:show="modelSelectorOpen" :selected-model="currentSelectedDisplayModel" :initial-tab="modelSelectorTab" @pick="handleModelPick">
          <Button variant="secondary" class="flex-1">
            Select Model
          </Button>
        </ModelSelectorDialog>
        <ModelAssignmentModal
          v-model:show="modelAssignmentOpen"
          :selected-model="currentSelectedDisplayModel"
          :model-id="stageModelSelected"
        >
          <Button
            variant="secondary"
            class="flex-1"
            :disabled="!activeCardId"
          >
            Apply to Character...
          </Button>
        </ModelAssignmentModal>
      </div>

      <Live2D
        v-if="stageModelRenderer === 'live2d'"
        ref="live2dRef"
        :palette="palette"
        :model-id="stageModelSelected"
        @extract-colors-from-model="$emit('extractColorsFromModel')"
      />
      <VRM
        v-if="stageModelRenderer === 'vrm'"
        ref="vrmRef"
        :palette="palette"
        :model-id="stageModelSelected"
        @extract-colors-from-model="$emit('extractColorsFromModel')"
      />
      <Spine
        v-if="stageModelRenderer === 'spine'"
        :palette="palette"
        :model-id="stageModelSelected"
        @extract-colors-from-model="$emit('extractColorsFromModel')"
      />
      <MMD
        v-if="stageModelRenderer === 'mmd'"
        :palette="palette"
        :model-id="stageModelSelected"
        @extract-colors-from-model="$emit('extractColorsFromModel')"
      />
    </div>

    <HackerPanel v-if="stageModelRenderer === 'vrm'" />
    <LHackerPanel v-if="stageModelRenderer === 'live2d'" />
  </div>
</template>
