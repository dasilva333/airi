<script setup lang="ts">
/*
  * - Root vue component of stage-ui-three package
  * - This scene component the root for all the sub components in the 3d scene
  * - This package, stage-ui-three, is a stateful package
  * - Pinia store is used to store the data/configuration of the model, camera, lighting, etc.
  * - Src of model is obtained from stage-ui via props, which is NOT a part of stage-ui-three package
*/

import type { VRM } from '@pixiv/three-vrm'
import type { TresContext } from '@tresjs/core'
import type { DirectionalLight, SphericalHarmonics3, Texture, WebGLRenderer, WebGLRenderTarget } from 'three'

import type { Vec3 } from '../stores/model-store'

import { Screen } from '@proj-airi/ui'
import { TresCanvas } from '@tresjs/core'
import { useElementBounding } from '@vueuse/core'
import { formatHex } from 'culori'
import { storeToRefs } from 'pinia'
import {
  ACESFilmicToneMapping,
  Euler,
  MathUtils,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

// From stage-ui-three package
import { useRenderTargetRegionAtClientPoint } from '../composables/render-target'
import { useModelStore } from '../stores/model-store'
import { OrbitControls } from './Controls'
import { SkyBox } from './Environment'
import { VRMModel } from './Model'

const props = withDefaults(defineProps<{
  mouthOpenSize?: number
  currentAudioSource?: AudioBufferSourceNode
  modelSrc?: string
  modelIdentity?: string
  skyBoxSrc?: string
  showAxes?: boolean
  idleAnimation?: string
  idleAnimations?: string[]
  idleCycleEnabled?: boolean
  paused?: boolean
  renderScaleOverride?: number
  xOffset?: number
  yOffset?: number
  scale?: number
  draggable?: boolean
}>(), {
  showAxes: false,
  idleAnimation: new URL('../assets/vrm/animations/idle_loop.vrma', import.meta.url).href,
  idleAnimations: () => [],
  paused: false,
  draggable: false,
})

const emit = defineEmits<{
  (e: 'loadModelProgress', value: number): void
  (e: 'binaryLoaded', value: ArrayBuffer): void
  (e: 'error', value: unknown): void
  (e: 'finished'): void
  (e: 'playStatus', value: { duration: number, url: string }): void
  (e: 'scaleChange', value: number): void
  (e: 'offsetChange', value: { x: number, y: number }): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const sceneContainerRef = ref<HTMLDivElement>()
const { width, height } = useElementBounding(sceneContainerRef)
const modelStore = useModelStore()
const {
  lastModelSrc,
  lastModelIdentity,

  modelSize,
  modelOrigin,
  modelOffset,
  modelRotationY,

  cameraFOV,
  cameraPosition,
  cameraDistance,

  directionalLightPosition,
  directionalLightTarget,
  directionalLightRotation,
  directionalLightIntensity,
  directionalLightColor,

  ambientLightIntensity,
  ambientLightColor,

  hemisphereSkyColor,
  hemisphereGroundColor,
  hemisphereLightIntensity,

  lookAtTarget,
  trackingMode,
  eyeHeight,
  envSelect,
  skyBoxSrc,
  skyBoxIntensity,
  renderScale,
} = storeToRefs(modelStore)

const computedModelOffset = computed(() => {
  return {
    x: props.xOffset !== undefined ? props.xOffset / 100 : modelOffset.value.x,
    y: props.yOffset !== undefined ? props.yOffset / 100 : modelOffset.value.y,
    z: modelOffset.value.z,
  }
})

const modelRef = ref<InstanceType<typeof VRMModel>>()

const camera = shallowRef(new PerspectiveCamera())
const controlsRef = shallowRef<InstanceType<typeof OrbitControls>>()
const tresCanvasRef = shallowRef<TresContext>()
const skyBoxEnvRef = ref<InstanceType<typeof SkyBox>>()
const dirLightRef = ref<InstanceType<typeof DirectionalLight>>()
const { readRenderTargetRegionAtClientPoint, disposeRenderTarget } = useRenderTargetRegionAtClientPoint({
  getRenderer: () => tresCanvasRef.value?.renderer.instance as WebGLRenderer | undefined,
  getScene: () => tresCanvasRef.value?.scene.value,
  getCamera: () => camera.value,
  getCanvas: () => tresCanvasRef.value?.renderer.instance.domElement,
})

/*
  * Pinia store definition
  * - Lilia: We highly recommend you gather all the store data definition here
  * - Only this root component (ThreeScene) can directly access pinia store
*/
// TODO: remove the hard-coded pinia store and inject the data from here

/*
  * Handle upward info flow
  * - Sub components emit info => update pinia store
*/
// === OrbitControls ===
// Get camera update => update camera info in pinia
function onOrbitControlsCameraChanged(value: {
  newCameraPosition: Vec3
  newCameraDistance: number
}) {
  const posChanged = Math.abs(cameraPosition.value.x - value.newCameraPosition.x) > 1e-6
    || Math.abs(cameraPosition.value.y - value.newCameraPosition.y) > 1e-6
    || Math.abs(cameraPosition.value.z - value.newCameraPosition.z) > 1e-6
  if (posChanged) {
    cameraPosition.value = value.newCameraPosition
  }
  const distChanged = Math.abs(cameraDistance.value - value.newCameraDistance) > 1e-6
  if (distChanged) {
    cameraDistance.value = value.newCameraDistance
  }
}
const controlsReady = ref(false)
const controlEnable = ref<boolean>(false)

watch(() => modelStore.interactionMode, (mode) => {
  controlEnable.value = mode === 'orbit'
}, { immediate: true })

function onOrbitControlsReady() {
  controlsReady.value = true
}

//  === VRMModel ===
const modelLoaded = ref<boolean>(false)
function onVRMModelLoadStart() {
  modelLoaded.value = false
  controlEnable.value = false
}
function onVRMModelCameraPosition(value: Vec3) {
  cameraPosition.value.x = value.x
  cameraPosition.value.y = value.y
  cameraPosition.value.z = value.z
}
function onVRMModelModelOrigin(value: Vec3) {
  modelOrigin.value.x = value.x
  modelOrigin.value.y = value.y
  modelOrigin.value.z = value.z
}
function onVRMModelModelSize(value: Vec3) {
  modelSize.value.x = value.x
  modelSize.value.y = value.y
  modelSize.value.z = value.z
}
function onVRMModelRotationY(value: number) {
  modelRotationY.value = value
}
function onVRMModelEyeHeight(value: number) {
  eyeHeight.value = value
}
function onVRMModelLookAtTarget(value: Vec3) {
  lookAtTarget.value.x = value.x
  lookAtTarget.value.y = value.y
  lookAtTarget.value.z = value.z
}
function onVRMModelLoaded(value: { modelIdentity?: string, modelSrc: string }) {
  lastModelSrc.value = value.modelSrc
  lastModelIdentity.value = value.modelIdentity ?? value.modelSrc
  modelLoaded.value = true
}

// === sky box ===
const irrSHTex = ref<SphericalHarmonics3 | null>(null)
// Update irrSH for IBL
function onSkyBoxReady(EnvPayload: {
  hdri?: Texture | null
  pmrem?: WebGLRenderTarget | null
  irrSH: SphericalHarmonics3 | null
}) {
  irrSHTex.value = EnvPayload.irrSH || null
}

// === Tres Canvas ===
function onTresReady(context: TresContext) {
  tresCanvasRef.value = context
}

let unsubscribeTriggerEmotion: (() => void) | undefined
let unsubscribeTriggerMotion: (() => void) | undefined

onMounted(() => {
  if (envSelect.value === 'skyBox') {
    skyBoxEnvRef.value?.reload(skyBoxSrc.value)
  }
  unsubscribeTriggerEmotion = modelStore.onTriggerEmotion((name, intensity) => {
    if (name === 'neutral') {
      modelRef.value?.setExpression(name, intensity)
    }
    else {
      const decayMs = intensity * 3000
      modelRef.value?.setExpression(name, intensity, decayMs)
    }
  })
  unsubscribeTriggerMotion = modelStore.onTriggerMotion((name) => {
    modelRef.value?.playTransientAnimation(name)
  })
})

onUnmounted(() => {
  disposeRenderTarget()
  if (unsubscribeTriggerEmotion)
    unsubscribeTriggerEmotion()
  if (unsubscribeTriggerMotion)
    unsubscribeTriggerMotion()
})

const vrmFrameHook = shallowRef<((vrm: VRM, delta: number) => void) | undefined>(undefined)
const effectiveRenderScale = computed(() => props.renderScaleOverride ?? renderScale.value)

function applyVrmFrameHook() {
  modelRef.value?.setVrmFrameHook(vrmFrameHook.value)
}
watch(modelRef, () => applyVrmFrameHook(), { immediate: true })

// === Directional Light ===
// Directional light setup moved inline, no ready event needed
const sceneReady = ref(false)
// Setup directional light when controls are ready and we have the light ref
watch(
  [controlsReady, modelLoaded, dirLightRef],
  ([ctrlOk, loaded, dirLight]) => {
    if (!ctrlOk || !loaded || !dirLight || !camera.value || !controlsRef.value?.controls)
      return

    try {
      // setup initial target of directional light
      dirLight.parent?.add(dirLight.target)
      dirLight.target.position.set(
        directionalLightTarget.value.x,
        directionalLightTarget.value.y,
        directionalLightTarget.value.z,
      )
      dirLight.target.updateMatrixWorld()
      sceneReady.value = true
    }
    catch (error) {
      console.error('[ThreeScene] Failed to setup directional light:', error)
    }
  },
)

// Update component state based on scene readiness
watch([sceneReady, modelLoaded], ([ready, loaded]) => {
  if (ready && loaded) {
    componentState.value = 'mounted'
  }
  else if (loaded) {
    componentState.value = 'loading'
  }
  else {
    componentState.value = 'pending'
  }
}, { immediate: true })

function updateDirLightTarget(newRotation: { x: number, y: number, z: number }) {
  const light = dirLightRef.value
  if (!light)
    return

  const { x: rx, y: ry, z: rz } = newRotation
  const lightPosition = new Vector3(
    directionalLightPosition.value.x,
    directionalLightPosition.value.y,
    directionalLightPosition.value.z,
  )
  const origin = new Vector3(0, 0, 0)
  const euler = new Euler(
    MathUtils.degToRad(rx),
    MathUtils.degToRad(ry),
    MathUtils.degToRad(rz),
    'XYZ',
  )
  const initialForward = origin.clone().sub(lightPosition).normalize()
  const newForward = initialForward.applyEuler(euler).normalize()
  const distance = lightPosition.distanceTo(origin)
  const target = lightPosition.clone().addScaledVector(newForward, distance)

  light.target.position.copy(target)

  light.target.updateMatrixWorld()

  directionalLightTarget.value = { x: target.x, y: target.y, z: target.z }
  // console.debug("directional Light target update!: ", directionalLightTarget.value)
}

watch(directionalLightRotation, (newRotation) => {
  updateDirLightTarget(newRotation)
}, { deep: true })

defineExpose({
  setExpression: (expression: string, intensity = 1, resetMs?: number) => {
    modelRef.value?.setExpression(expression, intensity, resetMs)
  },
  playTransientAnimation: (key: string) => {
    modelRef.value?.playTransientAnimation(key)
  },
  setVrmFrameHook: (hook?: (vrm: VRM, delta: number) => void) => {
    vrmFrameHook.value = hook
    applyVrmFrameHook()
  },
  listExpressions: () => {
    return modelRef.value?.listExpressions() || []
  },
  canvasElement: () => {
    return tresCanvasRef.value?.renderer.instance.domElement
  },
  camera: () => camera.value,
  renderer: () => tresCanvasRef.value?.renderer.instance,
  scene: () => modelRef.value?.scene,
  stopAnimations: () => {
    modelRef.value?.stopAnimations()
  },
  restoreDefaultExpressions: () => {
    modelRef.value?.restoreDefaultExpressions()
  },
  readRenderTargetRegionAtClientPoint,
  captureFrame: async () => {
    if (!tresCanvasRef.value)
      return null

    const { renderer, scene } = tresCanvasRef.value
    renderer.instance.render(scene.value, camera.value)

    return new Promise<Blob | null>((resolve) => {
      renderer.instance.domElement.toBlob(resolve)
    })
  },
  getVRM: () => modelRef.value?.getVRM?.(),
  getHeadBone: () => modelRef.value?.getHeadBone?.(),
  getHeadPose: () => {
    const activeVrm = modelRef.value?.getVRM?.()
    const activeCam = camera.value
    const container = sceneContainerRef.value
    if (!activeVrm || !activeCam || !container)
      return null

    const headBone = activeVrm.humanoid?.getNormalizedBoneNode('head')
    if (!headBone)
      return null

    const worldPos = new Vector3()
    const worldQuat = new Quaternion()
    headBone.getWorldPosition(worldPos)
    headBone.getWorldQuaternion(worldQuat)

    // Project head top anchor (offset along head's local up vector so hair/hat are cleared)
    const headUp = new Vector3(0, 1, 0).applyQuaternion(worldQuat)
    const headTopPos = worldPos.clone().addScaledVector(headUp, 0.20)
    const ndc = headTopPos.project(activeCam)

    // Convert NDC to pixel coordinates relative to the container element
    const rect = container.getBoundingClientRect()
    const screenX = ((ndc.x + 1) / 2) * rect.width
    // In Three.js NDC, +Y is up, but in screen-space canvas +Y is down
    const screenY = ((-ndc.y + 1) / 2) * rect.height

    // Calculate approximate screen model height (head to hips projection)
    const hipsBone = activeVrm.humanoid?.getNormalizedBoneNode('hips')
    let modelHeightPx = rect.height * 0.5
    if (hipsBone) {
      const hipsPos = new Vector3()
      hipsBone.getWorldPosition(hipsPos)
      const hipsNdc = hipsPos.clone().project(activeCam)
      const hipsScreenY = ((-hipsNdc.y + 1) / 2) * rect.height
      modelHeightPx = Math.max(120, Math.abs(hipsScreenY - screenY) * 2.2)
    }

    // Euler rotation angles (YXZ order: yaw is around Y, pitch is around X, roll is around Z)
    const euler = new Euler().setFromQuaternion(worldQuat, 'YXZ')

    return {
      screenX,
      screenY,
      yaw: euler.y,
      pitch: euler.x,
      roll: euler.z,
      modelHeightPx,
    }
  },
})

function handleWheel(event: WheelEvent) {
  if (modelStore.interactionMode !== 'drag' && modelStore.interactionMode !== 'positioning')
    return

  const delta = event.deltaY * -0.0005
  const newScale = Math.min(Math.max((props.scale || 1) + delta, 0.1), 3)
  emit('scaleChange', newScale)
}

const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let initialOffsetX = 0
let initialOffsetY = 0

function handlePointerDown(event: PointerEvent) {
  if (modelStore.interactionMode !== 'drag' && modelStore.interactionMode !== 'positioning')
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(event.pointerId)
  }

  isDragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY

  initialOffsetX = props.xOffset || 0
  initialOffsetY = props.yOffset || 0
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value)
    return

  const deltaX = event.clientX - dragStartX
  const deltaY = event.clientY - dragStartY

  const newX = initialOffsetX - deltaX
  const newY = initialOffsetY - deltaY

  emit('offsetChange', { x: newX, y: newY })
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
</script>

<template>
  <Screen
    relative
    :class="(modelStore.interactionMode === 'drag' || modelStore.interactionMode === 'positioning') ? (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
  >
    <div ref="sceneContainerRef" class="h-full w-full">
      <TresCanvas
        v-show="true"
        :camera="camera"
        :alpha="true"
        :antialias="true"
        :dpr="effectiveRenderScale"
        :width="width"
        :height="height"
        :tone-mapping="ACESFilmicToneMapping"
        :tone-mapping-exposure="1"
        :clear-alpha="0"
        power-preference="high-performance"
        @ready="onTresReady"
      >
        <OrbitControls
          ref="controlsRef"
          :control-enable="controlEnable"
          :model-loaded="modelLoaded"
          :model-size="modelSize"
          :camera-position="cameraPosition"
          :camera-target="modelOrigin"
          :camera-f-o-v="cameraFOV"
          :camera-distance="props.scale !== undefined ? props.scale : cameraDistance"
          @orbit-controls-camera-changed="onOrbitControlsCameraChanged"
          @orbit-controls-ready="onOrbitControlsReady"
        />
        <SkyBox
          v-if="envSelect === 'skyBox'"
          ref="skyBoxEnvRef"
          :sky-box-src="skyBoxSrc"
          :as-background="true"
          @sky-box-ready="onSkyBoxReady"
        />
        <TresHemisphereLight
          v-else
          :color="formatHex(hemisphereSkyColor)"
          :ground-color="formatHex(hemisphereGroundColor)"
          :position="[0, 1, 0]"
          :intensity="hemisphereLightIntensity"
          cast-shadow
        />
        <TresAmbientLight
          :color="formatHex(ambientLightColor)"
          :intensity="ambientLightIntensity"
          cast-shadow
        />
        <TresDirectionalLight
          ref="dirLightRef"
          :color="formatHex(directionalLightColor)"
          :position="[directionalLightPosition.x, directionalLightPosition.y, directionalLightPosition.z]"
          :intensity="directionalLightIntensity"
          cast-shadow
        />
        <!-- <Suspense v-if="(tresCanvasRef as any)?.renderer">
          <EffectComposerPmndrs :multisampling="multisampling">
            <HueSaturationPmndrs v-bind="effectProps" />
          </EffectComposerPmndrs>
        </Suspense> -->
        <VRMModel
          ref="modelRef"

          :mouth-open-size="props.mouthOpenSize"
          :current-audio-source="props.currentAudioSource"
          :model-src="props.modelSrc"
          :model-identity="props.modelIdentity"
          :last-model-src="lastModelSrc"
          :last-model-identity="lastModelIdentity"
          :idle-animation="props.idleAnimation"
          :idle-animations="props.idleAnimations"
          :idle-cycle-enabled="props.idleCycleEnabled"
          :paused="props.paused"
          :env-select="envSelect"
          :sky-box-intensity="skyBoxIntensity"
          :npr-irr-s-h="irrSHTex"
          :model-offset="computedModelOffset"
          :model-rotation-y="modelRotationY"
          :look-at-target="lookAtTarget"
          :tracking-mode="trackingMode"
          :eye-height="eyeHeight"
          :camera-position="cameraPosition"
          :camera="camera"

          @loading-progress="(val: number) => emit('loadModelProgress', val)"
          @load-start="onVRMModelLoadStart"
          @camera-position="onVRMModelCameraPosition"
          @model-origin="onVRMModelModelOrigin"
          @model-size="onVRMModelModelSize"
          @model-rotation-y="onVRMModelRotationY"
          @eye-height="onVRMModelEyeHeight"
          @look-at-target="onVRMModelLookAtTarget"
          @error="(err: unknown) => emit('error', err)"
          @loaded="onVRMModelLoaded"
          @binary-loaded="(v: ArrayBuffer) => emit('binaryLoaded', v)"
          @finished="emit('finished')"
          @play-status="(v: { duration: number, url: string }) => emit('playStatus', v)"
        />
        <TresAxesHelper v-if="props.showAxes" :size="1" />
      </TresCanvas>
    </div>
  </Screen>
</template>
