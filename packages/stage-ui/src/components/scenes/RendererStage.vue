<script setup lang="ts">
import { Live2DScene } from '@proj-airi/stage-ui-live2d'
import { MMDScene } from '@proj-airi/stage-ui-mmd'
import { SpineScene } from '@proj-airi/stage-ui-spine'
import { ThreeScene, useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import { useAiriCardStore } from '../../stores/modules'
import { useSettings } from '../../stores/settings'
import { useVHackStore } from '../../stores/vhack'

const props = withDefaults(defineProps<{
  paused?: boolean
  focusAt: { x: number, y: number }
  xOffset?: number | string
  yOffset?: number | string
  scale?: number
  mouthOpenSize?: number
  currentAudioSource?: AudioBufferSourceNode
  isWindowResizing?: boolean
  vrmActiveAnimation?: string
  vrmEffectiveIdleCycleEnabled?: boolean
}>(), {
  paused: false,
  scale: 1,
  mouthOpenSize: 0,
  isWindowResizing: false,
  vrmEffectiveIdleCycleEnabled: false,
})

const emits = defineEmits<{
  (e: 'hitAreaHover', value: { name: string, x: number, y: number, hovered: boolean } | null): void
  (e: 'scaleChange', value: number): void
  (e: 'offsetChange', value: { x: number, y: number }): void
  (e: 'animationFinished'): void
  (e: 'animationPlayStatus', status: { duration: number, url: string }): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const vrmViewerRef = ref<InstanceType<typeof ThreeScene>>()
const live2dSceneRef = ref<InstanceType<typeof Live2DScene>>()
const spineViewerRef = ref<InstanceType<typeof SpineScene>>()

const settingsStore = useSettings()
const vhackStore = useVHackStore()
const { activeCard } = storeToRefs(useAiriCardStore())
const {
  stageModelRenderer,
  stageViewControlsEnabled,
  live2dDisableFocus,
  stageModelSelectedUrl,
  stageModelSelectedFile,
  stageModelSelected,
  themeColorsHue,
  themeColorsHueDynamic,
  live2dIdleAnimationEnabled,
  live2dAutoBlinkEnabled,
  live2dForceAutoBlinkEnabled,
  live2dShadowEnabled,
  live2dMaxFps,
  mmdTextureMap,
} = storeToRefs(settingsStore)

const vrmStore = useModelStore()

const reducedRenderScale = computed(() => {
  const nextScale = Math.min(vrmStore.renderScale, 0.75)
  return Math.max(0.5, nextScale)
})

function canvasElement() {
  if (stageModelRenderer.value === 'live2d')
    return live2dSceneRef.value?.canvasElement()
  else if (stageModelRenderer.value === 'vrm')
    return vrmViewerRef.value?.canvasElement()
}

function readRenderTargetRegionAtClientPoint(clientX: number, clientY: number, radius: number) {
  if (stageModelRenderer.value !== 'vrm')
    return null
  return vrmViewerRef.value?.readRenderTargetRegionAtClientPoint?.(clientX, clientY, radius) ?? null
}

async function captureFrame() {
  return (stageModelRenderer.value === 'live2d'
    ? live2dSceneRef.value?.captureFrame()
    : vrmViewerRef.value?.captureFrame())
}

defineExpose({
  canvasElement,
  captureFrame,
  readRenderTargetRegionAtClientPoint,
  vrmViewerRef,
  live2dSceneRef,
  spineViewerRef,
})
</script>

<template>
  <div class="relative h-full w-full">
    <Live2DScene
      v-if="stageModelRenderer === 'live2d'"
      ref="live2dSceneRef"
      v-model:state="componentState"
      :class="['min-w-50% <lg:full min-h-100 sm:100', 'h-full w-full flex-1']"
      :model-src="stageModelSelectedUrl"
      :model-id="stageModelSelected"
      :model-file="stageModelSelectedFile"
      :focus-at="focusAt"
      :mouth-open-size="mouthOpenSize"
      :paused="paused"
      :x-offset="xOffset"
      :y-offset="yOffset"
      :scale="scale"
      :disable-focus-at="live2dDisableFocus"
      :theme-colors-hue="themeColorsHue"
      :theme-colors-hue-dynamic="themeColorsHueDynamic"
      :live2d-idle-animation-enabled="live2dIdleAnimationEnabled"
      :live2d-auto-blink-enabled="live2dAutoBlinkEnabled"
      :live2d-force-auto-blink-enabled="live2dForceAutoBlinkEnabled"
      :live2d-shadow-enabled="live2dShadowEnabled"
      :live2d-max-fps="live2dMaxFps"
      :idle-animations="activeCard?.extensions?.airi?.acting?.idleAnimations"
      :draggable="stageViewControlsEnabled"
      :interaction-mode="vrmStore.interactionMode"
      @scale-change="(val) => emits('scaleChange', val)"
      @offset-change="(val) => emits('offsetChange', val)"
      @hit-area-hover="(val) => emits('hitAreaHover', val)"
    />
    <ThreeScene
      v-if="stageModelRenderer === 'vrm'"
      ref="vrmViewerRef"
      v-model:state="componentState"
      :model-src="stageModelSelectedUrl"
      :model-identity="stageModelSelected"
      :idle-animation="props.vrmActiveAnimation"
      :idle-cycle-enabled="props.vrmEffectiveIdleCycleEnabled"
      :render-scale-override="isWindowResizing ? reducedRenderScale : undefined"
      :class="['min-w-50% <lg:full min-h-100 sm:100', 'h-full w-full flex-1']"
      :paused="paused"
      :show-axes="stageViewControlsEnabled"
      :current-audio-source="currentAudioSource"
      @error="console.error"
      @binary-loaded="vhackStore.setSourceArrayBuffer"
      @finished="emits('animationFinished')"
      @play-status="(status) => emits('animationPlayStatus', status)"
    />
    <SpineScene
      v-if="stageModelRenderer === 'spine'"
      ref="spineViewerRef"
      v-model:state="componentState"
      :model-src="stageModelSelectedUrl"
      :model-id="stageModelSelected"
      :class="['min-w-50% <lg:full min-h-100 sm:100', 'h-full w-full flex-1']"
      :paused="paused"
      :interaction-mode="vrmStore.interactionMode"
      :x-offset="xOffset !== undefined ? Number(xOffset) : undefined"
      :y-offset="yOffset !== undefined ? Number(yOffset) : undefined"
      :scale="scale !== undefined ? Number(scale) : undefined"
      @hit-area-hover="(val) => emits('hitAreaHover', val)"
    />
    <MMDScene
      v-if="stageModelRenderer === 'mmd' && stageModelSelectedUrl"
      v-model:state="componentState"
      :class="['min-w-50% <lg:full min-h-100 sm:100', 'h-full w-full flex-1']"
      :model-src="stageModelSelectedUrl"
      :paused="paused"
      :current-audio-source="currentAudioSource"
      :texture-map="mmdTextureMap"
      @error="console.error"
    />
  </div>
</template>
