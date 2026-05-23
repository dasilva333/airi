<script setup lang="ts">
import { Screen } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

import Live2DCanvas from './live2d/Canvas.vue'
import Live2DModel from './live2d/Model.vue'

import { useLive2d } from '../../stores/live2d'

import '../../utils/live2d-zip-loader'
import '../../utils/live2d-opfs-registration'

const props = withDefaults(defineProps<{
  modelSrc?: string
  modelId?: string
  modelFile?: File

  paused?: boolean
  mouthOpenSize?: number
  focusAt?: { x: number, y: number }
  disableFocusAt?: boolean
  scale?: number
  themeColorsHue?: number
  themeColorsHueDynamic?: boolean
  live2dIdleAnimationEnabled?: boolean
  live2dAutoBlinkEnabled?: boolean
  live2dForceAutoBlinkEnabled?: boolean
  live2dShadowEnabled?: boolean
  live2dMaxFps?: number
  xOffset?: number | string
  yOffset?: number | string
  idleAnimations?: string[]
  draggable?: boolean
}>(), {
  paused: false,
  focusAt: () => ({ x: 0, y: 0 }),
  mouthOpenSize: 0,
  themeColorsHue: 220.44,
  themeColorsHueDynamic: false,
  live2dIdleAnimationEnabled: true,
  live2dAutoBlinkEnabled: true,
  live2dForceAutoBlinkEnabled: false,
  live2dShadowEnabled: true,
  live2dMaxFps: 0,
  idleAnimations: () => [],
  draggable: false,
})

const emits = defineEmits<{
  (e: 'scaleChange', value: number): void
  (e: 'offsetChange', value: { x: number, y: number }): void
}>()
const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })
const componentStateCanvas = defineModel<'pending' | 'loading' | 'mounted'>('canvasState', { default: 'pending' })
const componentStateModel = defineModel<'pending' | 'loading' | 'mounted'>('modelState', { default: 'pending' })

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()

const live2d = useLive2d()
const { positionInPercentageString, scale: storeScale } = storeToRefs(live2d)

watch([componentStateModel, componentStateCanvas], () => {
  componentState.value = (componentStateModel.value === 'mounted' && componentStateCanvas.value === 'mounted')
    ? 'mounted'
    : 'loading'
})

function handleWheel(event: WheelEvent) {
  const delta = event.deltaY * -0.0005
  const currentScale = props.scale !== undefined ? props.scale : storeScale.value
  const newScale = Math.min(Math.max(currentScale + delta, 0.05), 10)
  emits('scaleChange', newScale)
}

const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let initialOffsetX = 0
let initialOffsetY = 0

function handlePointerDown(event: PointerEvent) {
  if (!props.draggable)
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(event.pointerId)
  }

  isDragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY

  let currentX = Number(props.xOffset)
  if (String(props.xOffset).endsWith('%')) {
    currentX = (Number.parseFloat(String(props.xOffset).replace('%', '')) / 100) * (live2dCanvasRef.value?.canvasElement()?.clientWidth || 0)
  }
  if (Number.isNaN(currentX)) {
    currentX = 0
  }

  let currentY = Number(props.yOffset)
  if (String(props.yOffset).endsWith('%')) {
    currentY = (Number.parseFloat(String(props.yOffset).replace('%', '')) / 100) * (live2dCanvasRef.value?.canvasElement()?.clientHeight || 0)
  }
  if (Number.isNaN(currentY)) {
    currentY = 0
  }

  initialOffsetX = currentX
  initialOffsetY = currentY
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value)
    return

  const deltaX = event.clientX - dragStartX
  const deltaY = event.clientY - dragStartY

  const newX = initialOffsetX + deltaX
  const newY = initialOffsetY + deltaY

  emits('offsetChange', { x: newX, y: newY })
}

function handlePointerUp(event: PointerEvent) {
  if (!isDragging.value)
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.releasePointerCapture === 'function') {
    target.releasePointerCapture(event.pointerId)
  }

  isDragging.value = false
}

defineExpose({
  canvasElement: () => {
    return live2dCanvasRef.value?.canvasElement()
  },
  captureFrame: () => {
    return live2dCanvasRef.value?.captureFrame()
  },
})
</script>

<template>
  <Screen
    v-slot="{ width, height }"
    relative
    :class="props.draggable ? (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <Live2DCanvas
      ref="live2dCanvasRef"
      v-slot="{ app }"
      v-model:state="componentStateCanvas"
      :width="width"
      :height="height"
      :resolution="2"
      :max-fps="live2dMaxFps"
      max-h="100dvh"
    >
      <Live2DModel
        v-model:state="componentStateModel"
        :model-src="modelSrc"
        :model-id="modelId"
        :model-file="modelFile"
        :app="app"
        :mouth-open-size="mouthOpenSize"
        :width="width"
        :height="height"
        :paused="paused"
        :focus-at="focusAt"
        :x-offset="props.xOffset !== undefined ? props.xOffset : positionInPercentageString.x"
        :y-offset="props.yOffset !== undefined ? props.yOffset : positionInPercentageString.y"
        :scale="props.scale !== undefined ? props.scale : storeScale"
        :disable-focus-at="disableFocusAt"
        :theme-colors-hue="themeColorsHue"
        :theme-colors-hue-dynamic="themeColorsHueDynamic"
        :live2d-idle-animation-enabled="live2dIdleAnimationEnabled"
        :live2d-auto-blink-enabled="live2dAutoBlinkEnabled"
        :live2d-force-auto-blink-enabled="live2dForceAutoBlinkEnabled"
        :live2d-shadow-enabled="live2dShadowEnabled"
        :idle-animations="idleAnimations"
      />
    </Live2DCanvas>
  </Screen>
</template>
