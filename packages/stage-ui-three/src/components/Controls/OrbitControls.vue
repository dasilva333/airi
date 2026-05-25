<script setup lang="ts">
/*
 * - Extend OrbitControls from three
 * - Define camera behavior
 */

import { extend, useTres } from '@tresjs/core'
import { until } from '@vueuse/core'
import { MOUSE, PerspectiveCamera, TOUCH, Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// From stage-ui-three package
import { onMounted, onUnmounted, shallowRef, toRefs, watch } from 'vue'
import type { Vec3 } from '../../stores/model-store'

/*
 * Props:
 * - model size
 * - camera position
 * - camera target: camera looking at target
 * - camera fov angle
 * - camera distance: camera position - camera target
 */
const props = defineProps<{
  controlEnable: boolean
  modelLoaded: boolean
  modelSize: Vec3
  cameraPosition: Vec3
  cameraTarget: Vec3
  cameraFOV: number
  cameraDistance: number
}>()
/*
 * Emits:
 * - camera changed: orbit controls can receive user input and change camera's position
 * - ready
 */
const emit = defineEmits<{
  (
    e: 'orbitControlsCameraChanged',
    value: {
      newCameraPosition: Vec3
      newCameraDistance: number
    },
  ): void
  (e: 'orbitControlsReady'): void
}>()

const { controlEnable, modelLoaded, modelSize, cameraPosition, cameraTarget, cameraFOV, cameraDistance } = toRefs(props)

extend({ OrbitControls })

const { camera: cameraTres, renderer } = useTres()
const controls = shallowRef<OrbitControls>()
const camera = shallowRef<PerspectiveCamera | null>(null)

// Initialisation on onMounted
function registerInfoFlow() {
  let isProgrammatic = false

  /*
   * Downward info flow
   * - Pinia store value updated => command take effect
   */
  // Get mode size => update min/max camera distance
  watch(
    modelSize,
    (newSize) => {
      if (!controls.value) return
      isProgrammatic = true
      controls.value.minDistance = newSize.z
      controls.value.maxDistance = newSize.z * 20
      controls.value.update()
      isProgrammatic = false
    },
    { deep: true, immediate: true },
  )
  // Get camera position => update position
  watch(
    cameraPosition,
    (newPosition) => {
      if (!camera.value || !controls.value) return
      isProgrammatic = true
      camera.value.position.set(newPosition.x, newPosition.y, newPosition.z)
      camera.value.updateProjectionMatrix()
      controls.value.update()
      isProgrammatic = false
    },
    { deep: true, immediate: true },
  )
  // Get camera target => update target (actually the model center)
  watch(
    cameraTarget,
    (newTarget) => {
      if (!controls.value) return
      isProgrammatic = true
      controls.value!.target.set(newTarget.x, newTarget.y, newTarget.z)
      controls.value!.update()
      isProgrammatic = false
    },
    { deep: true, immediate: true },
  )
  // Get fov => update camera fov
  watch(
    cameraFOV,
    (newFOV) => {
      if (!camera.value || !controls.value) return
      isProgrammatic = true
      camera!.value!.fov = newFOV
      camera!.value!.updateProjectionMatrix()
      controls.value!.update()
      isProgrammatic = false
    },
    { immediate: true },
  )
  // Get camera distance => update camera distance
  watch(cameraDistance, (newDistance) => {
    if (!camera.value || !controls.value) return
    isProgrammatic = true
    const newPosition = new Vector3()
    const target = controls.value!.target
    const direction = new Vector3().subVectors(camera.value.position, target).normalize()
    newPosition.copy(target).addScaledVector(direction, newDistance)
    camera.value.position.set(newPosition.x, newPosition.y, newPosition.z)
    camera.value.updateProjectionMatrix()
    controls.value.update()
    isProgrammatic = false
  })
  watch(
    controlEnable,
    (newEnable) => {
      if (!camera.value || !controls.value) return
      controls.value.enableRotate = newEnable
      // [UX-FIX] Always allow zoom even if rotation is locked for interaction
      controls.value.enableZoom = true
    },
    { immediate: true },
  )

  /*
   * Upward info flow
   * - Emit info => update pinia store
   */
  // send camera update info
  const onChange = () => {
    if (isProgrammatic) return

    if (modelLoaded.value) {
      emit('orbitControlsCameraChanged', {
        newCameraDistance: controls.value!.getDistance(),
        newCameraPosition: {
          x: camera!.value!.position.x,
          y: camera!.value!.position.y,
          z: camera!.value!.position.z,
        },
      })
    }
  }
  controls.value?.addEventListener('change', onChange)
}

onMounted(async () => {
  // wait until camera is not undefined
  await until(() => cameraTres.value && renderer.domElement).toBeTruthy()
  // Prevent the data value fluctuation, camera setting should take effective after model loading
  await until(() => props.modelLoaded).toBeTruthy()
  if (!cameraTres.value || !renderer.domElement) {
    console.warn('Camera or Renderer initialisation failure!')
    return
  }
  // Narrow down the camera's type
  if (!(cameraTres.value instanceof PerspectiveCamera)) {
    console.warn('Camera is not perspective camera, type error!')
    return
  }
  camera.value = cameraTres.value as PerspectiveCamera
  // Obtain orbitControl instance
  controls.value = new OrbitControls(camera.value, renderer.domElement)
  controls.value.enablePan = false
  controls.value.enableZoom = false
  controls.value.enableRotate = false
  // Align to tresjs conventions
  controls.value.mouseButtons = {
    LEFT: MOUSE.ROTATE,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  }
  controls.value.touches = {
    ONE: TOUCH.ROTATE,
    TWO: TOUCH.DOLLY_PAN,
  }

  // define watch props and emit
  registerInfoFlow()
  controls.value.update()

  emit('orbitControlsReady')
})

onUnmounted(() => {})

defineExpose({
  controls,
  getDistance: () => controls.value?.getDistance(),
  setTarget: (target: { x: number; y: number; z: number }) => {
    if (controls.value) {
      controls.value.target.set(target.x, target.y, target.z)
      controls.value.update()
    }
  },
  update: () => controls.value?.update(),
})
</script>

<template>
  <slot />
</template>
