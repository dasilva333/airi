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
  followSpeed?: number
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
  interactionMode?: 'orbit' | 'tactile'
}>(), {
  paused: false,
  focusAt: () => ({ x: 0, y: 0 }),
  disableFocusAt: false,
  followSpeed: 0.5,
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
  interactionMode: 'orbit',
})

const emits = defineEmits<{
  (e: 'scaleChange', value: number): void
  (e: 'offsetChange', value: { x: number, y: number }): void
  (e: 'hitAreaHover', value: { name: string, x: number, y: number, hovered: boolean } | null): void
}>()
const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })
const componentStateCanvas = defineModel<'pending' | 'loading' | 'mounted'>('canvasState', { default: 'pending' })
const componentStateModel = defineModel<'pending' | 'loading' | 'mounted'>('modelState', { default: 'pending' })

const live2dCanvasRef = ref<InstanceType<typeof Live2DCanvas>>()

const live2d = useLive2d()
const { positionInPercentageString, scale: storeScale } = storeToRefs(live2d)

const hoverState = ref<{ name: string, x: number, y: number } | null>(null)

function handleHitAreaHover(value: { name: string, x: number, y: number, hovered: boolean } | null) {
  if (value && value.hovered) {
    hoverState.value = value
  }
  else {
    hoverState.value = null
  }
  emits('hitAreaHover', value)
}

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
const isPinching = ref(false)

const activePointers = new Map<number, { clientX: number, clientY: number }>()
let initialPinchDistance = 0
let initialPinchScale = 1

let dragStartX = 0
let dragStartY = 0
let initialOffsetX = 0
let initialOffsetY = 0

function getPointersDistance(p1: { clientX: number, clientY: number }, p2: { clientX: number, clientY: number }) {
  return Math.hypot(p1.clientX - p2.clientX, p1.clientY - p2.clientY)
}

function resolveCurrentOffsets() {
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

  return { currentX, currentY }
}

function handlePointerDown(event: PointerEvent) {
  if (!props.draggable)
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.setPointerCapture === 'function') {
    try {
      target.setPointerCapture(event.pointerId)
    }
    catch {}
  }

  activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

  if (activePointers.size === 2) {
    isDragging.value = false
    isPinching.value = true
    const [p1, p2] = Array.from(activePointers.values())
    initialPinchDistance = getPointersDistance(p1, p2)
    initialPinchScale = props.scale !== undefined ? props.scale : storeScale.value
  }
  else if (activePointers.size === 1) {
    isDragging.value = true
    isPinching.value = false
    dragStartX = event.clientX
    dragStartY = event.clientY

    const { currentX, currentY } = resolveCurrentOffsets()
    initialOffsetX = currentX
    initialOffsetY = currentY
  }
}

function handlePointerMove(event: PointerEvent) {
  if (!activePointers.has(event.pointerId))
    return

  activePointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })

  if (isPinching.value && activePointers.size >= 2) {
    const [p1, p2] = Array.from(activePointers.values())
    const currentDistance = getPointersDistance(p1, p2)
    if (initialPinchDistance > 0) {
      const scaleFactor = currentDistance / initialPinchDistance
      const newScale = Math.min(Math.max(initialPinchScale * scaleFactor, 0.05), 10)
      emits('scaleChange', newScale)
    }
  }
  else if (isDragging.value && activePointers.size === 1) {
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY

    const newX = initialOffsetX + deltaX
    const newY = initialOffsetY + deltaY

    emits('offsetChange', { x: newX, y: newY })
  }
}

function handlePointerUp(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (target && typeof target.releasePointerCapture === 'function') {
    try {
      target.releasePointerCapture(event.pointerId)
    }
    catch {}
  }

  activePointers.delete(event.pointerId)

  if (activePointers.size === 0) {
    isDragging.value = false
    isPinching.value = false
  }
  else if (activePointers.size === 1) {
    isPinching.value = false
    isDragging.value = true
    const remaining = Array.from(activePointers.values())[0]
    dragStartX = remaining.clientX
    dragStartY = remaining.clientY

    const { currentX, currentY } = resolveCurrentOffsets()
    initialOffsetX = currentX
    initialOffsetY = currentY
  }
}

defineExpose({
  canvasElement: () => {
    return live2dCanvasRef.value?.canvasElement()
  },
  captureFrame: () => {
    return live2dCanvasRef.value?.captureFrame()
  },
  // Exposed so in-scene overlays (e.g. HeadTetheredCaption) can attach PIXI
  // children to the same stage. Function (not a ref) so callers always read
  // the current Application instance. The canvas's defineExpose unwraps the
  // inner `pixiApp` ref at access time.
  live2dApp: () => live2dCanvasRef.value?.pixiApp,
})
</script>

<template>
  <Screen
    v-slot="{ width, height }"
    relative
    :class="[
      props.draggable ? ((isDragging || isPinching) ? 'cursor-grabbing select-none touch-none' : 'cursor-grab touch-none') : '',
    ]"
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
        :follow-speed="props.followSpeed !== undefined ? props.followSpeed : 0.5"
        :theme-colors-hue="themeColorsHue"
        :theme-colors-hue-dynamic="themeColorsHueDynamic"
        :live2d-idle-animation-enabled="live2dIdleAnimationEnabled"
        :live2d-auto-blink-enabled="live2dAutoBlinkEnabled"
        :live2d-force-auto-blink-enabled="live2dForceAutoBlinkEnabled"
        :live2d-shadow-enabled="live2dShadowEnabled"
        :idle-animations="idleAnimations"
        :interaction-mode="interactionMode"
        @hit-area-hover="handleHitAreaHover"
      />
    </Live2DCanvas>

    <!-- SVG Overlay for Hover Effect -->
    <svg
      v-if="hoverState && interactionMode === 'tactile'"
      class="pointer-events-none absolute inset-0"
      :width="width"
      :height="height"
    >
      <defs>
        <radialGradient id="pink-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(249, 168, 212, 0.4)" />
          <stop offset="100%" stop-color="rgba(249, 168, 212, 0)" />
        </radialGradient>
      </defs>
      <circle
        :cx="hoverState.x"
        :cy="hoverState.y"
        r="40"
        fill="url(#pink-glow)"
      />
    </svg>
  </Screen>
</template>
