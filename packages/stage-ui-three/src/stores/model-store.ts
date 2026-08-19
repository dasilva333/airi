import type { Vector3 } from 'three'

import { useBroadcastChannel, useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import defaultSkyBoxSrc from '../components/Environment/assets/sky_linekotsi_23_HDRI.hdr?url'

// TODO: this is for future type injection features
// TODO: make a separate type.ts
export interface Vec3 { x: number, y: number, z: number }
export type TrackingMode = 'camera' | 'mouse' | 'none'
export type InteractionMode = 'orbit' | 'tactile' | 'drag' | 'positioning'
export type HexColor = string & { __hex?: true }

export interface DiscoveredMeshNode {
  name: string
  isSkinned: boolean
  vertexCount: number
}

export interface FieldBase<T> {
  space: string // name space
  key: string // name key
  default: T // default value
  // For future setting components UI display
  label: string
  group: string
  order: number
}
export type NumberField = FieldBase<number> & {
  type: 'number'
  min?: number
  max?: number
  step?: number
}
export type Vec3Field = FieldBase<Vector3> & {
  type: 'vec3'
}
export type ColorField = FieldBase<HexColor> & {
  type: 'color'
}
export type SelectField<T extends string = string> = FieldBase<T> & {
  type: 'select'
  options: readonly { label: string, value: T }[]
}

export interface FieldKindMap {
  number: { def: NumberField, value: number }
  vec3: { def: Vec3Field, value: Vector3 }
  color: { def: ColorField, value: HexColor }
  select: { def: SelectField<any>, value: string }
}
// type of Field
export type FieldDef = FieldKindMap[keyof FieldKindMap]['def']
// type of value
export type FieldValueOf<D> = D extends SelectField<infer T> ? T
  : D extends { type: infer K }
    ? K extends keyof FieldKindMap ? FieldKindMap[K]['value'] : never
    : never

type BroadcastChannelEvents
  = | BroadcastChannelEventShouldUpdateView
    | BroadcastChannelEventTriggerEmotion
    | BroadcastChannelEventTriggerMotion

interface BroadcastChannelEventShouldUpdateView {
  type: 'should-update-view'
  reason?: string
}

interface BroadcastChannelEventTriggerEmotion {
  type: 'trigger-emotion'
  name: string
  intensity: number
}

interface BroadcastChannelEventTriggerMotion {
  type: 'trigger-motion'
  name: string
}

export const useModelStore = defineStore('modelStore', () => {
  const activeVrm = ref<any>(null)
  const activeVrmParser = ref<any>(null)
  const activeVrmIdentity = ref<string>('')
  const { post, data } = useBroadcastChannel<BroadcastChannelEvents, BroadcastChannelEvents>({ name: 'airi-stores-live2d' })
  const shouldUpdateViewHooks = ref(new Set<(reason?: string) => void>())
  const triggerEmotionHooks = ref(new Set<(name: string, intensity: number) => void>())
  const triggerMotionHooks = ref(new Set<(name: string) => void>())

  const onShouldUpdateView = (hook: (reason?: string) => void) => {
    shouldUpdateViewHooks.value.add(hook)
    return () => {
      shouldUpdateViewHooks.value.delete(hook)
    }
  }

  function shouldUpdateView(reason?: string) {
    post({ type: 'should-update-view', reason })
    shouldUpdateViewHooks.value.forEach(hook => hook(reason))
  }

  const onTriggerEmotion = (hook: (name: string, intensity: number) => void) => {
    triggerEmotionHooks.value.add(hook)
    return () => {
      triggerEmotionHooks.value.delete(hook)
    }
  }

  function triggerEmotion(name: string, intensity: number) {
    post({ type: 'trigger-emotion', name, intensity })
    triggerEmotionHooks.value.forEach(hook => hook(name, intensity))
  }

  const onTriggerMotion = (hook: (name: string) => void) => {
    triggerMotionHooks.value.add(hook)
    return () => {
      triggerMotionHooks.value.delete(hook)
    }
  }

  function triggerMotion(name: string) {
    post({ type: 'trigger-motion', name })
    triggerMotionHooks.value.forEach(hook => hook(name))
  }

  watch(data, (event) => {
    if (event.type === 'should-update-view') {
      shouldUpdateViewHooks.value.forEach(hook => hook(event.reason))
    }
    else if (event.type === 'trigger-emotion') {
      triggerEmotionHooks.value.forEach(hook => hook(event.name, event.intensity))
    }
    else if (event.type === 'trigger-motion') {
      triggerMotionHooks.value.forEach(hook => hook(event.name))
    }
  })

  const scale = useLocalStorage('settings/stage-ui-three/scale', 1)
  const lastModelSrc = useLocalStorage('settings/stage-ui-three/lastModelSrc', '')
  const lastModelIdentity = useLocalStorage('settings/stage-ui-three/lastModelIdentity', '')

  const modelSize = useLocalStorage('settings/stage-ui-three/modelSize', { x: 0, y: 0, z: 0 })
  const modelOrigin = useLocalStorage('settings/stage-ui-three/modelOrigin', { x: 0, y: 0, z: 0 })
  const modelOffset = useLocalStorage('settings/stage-ui-three/modelOffset', { x: 0, y: 0, z: 0 })
  const modelRotationY = useLocalStorage('settings/stage-ui-three/modelRotationY', 0)

  const cameraFOV = useLocalStorage('settings/stage-ui-three/cameraFOV', 40)
  const cameraPosition = useLocalStorage('settings/stage-ui-three/camera-position', { x: 0, y: 0, z: -1 })
  const cameraDistance = useLocalStorage('settings/stage-ui-three/cameraDistance', 0)

  const interactionMode = useLocalStorage<InteractionMode>('settings/stage-ui-three/interaction-mode', 'tactile')

  const lookAtTarget = useLocalStorage('settings/stage-ui-three/lookAtTarget', { x: 0, y: 0, z: 0 })
  const trackingMode = useLocalStorage('settings/stage-ui-three/trackingMode', 'none' as 'camera' | 'mouse' | 'none')
  const followSpeed = useLocalStorage('settings/stage-ui-three/followSpeed', 0.1)
  const eyeHeight = useLocalStorage('settings/stage-ui-three/eyeHeight', 0)

  const availableExpressions = useLocalStorage<string[]>('settings/stage-ui-three/availableExpressions', [])
  const activeExpressions = useLocalStorage<Record<string, number>>('settings/stage-ui-three/activeExpressions', {})
  // Discovered 3D Mesh nodes in loaded VRM
  const discoveredMeshes = ref<DiscoveredMeshNode[]>([])
  // Maps VRM expression names to ACT emotion slots (e.g., { "anger": "angry", "pixel_glasses": "cool" })
  const emotionMappings = useLocalStorage<Record<string, string>>('settings/stage-ui-three/emotionMappings', {})
  // Quick-toggle favorite expression (e.g., "pixel_glasses")
  const favoriteExpression = useLocalStorage<string>('settings/stage-ui-three/favoriteExpression', '')

  const vrmIdleAnimation = useLocalStorage<string>('settings/stage-ui-three/vrmIdleAnimation', 'idleLoop')
  const vrmIdleCycleEnabled = useLocalStorage<boolean>('settings/stage-ui-three/vrmIdleCycleEnabled', false)

  function resetModelStore() {
    modelSize.value = { x: 0, y: 0, z: 0 }
    modelOrigin.value = { x: 0, y: 0, z: 0 }
    modelOffset.value = { x: 0, y: 0, z: 0 }
    modelRotationY.value = 0

    cameraFOV.value = 40
    cameraPosition.value = { x: 0, y: 0, z: 0 }
    cameraDistance.value = 0

    interactionMode.value = 'tactile'

    lookAtTarget.value = { x: 0, y: 0, z: 0 }
    trackingMode.value = 'none'
    followSpeed.value = 0.1
    eyeHeight.value = 0

    availableExpressions.value = []
    activeExpressions.value = {}
    discoveredMeshes.value = []
    emotionMappings.value = {}
    favoriteExpression.value = ''
    vrmIdleAnimation.value = 'idleLoop'
    vrmIdleCycleEnabled.value = false
    activeVrm.value = null
    activeVrmParser.value = null
    activeVrmIdentity.value = ''
    detectedWardrobe.value = { active: null, siblings: [], texIndex: null }
  }

  // === Tactile Interaction State ===
  const detectedWardrobe = ref<{
    active: { display: string, raw: string } | null
    siblings: { display: string, raw: string }[]
    texIndex: number | null
  }>({ active: null, siblings: [], texIndex: null })

  // === Lighting ===
  const directionalLightPosition = useLocalStorage('settings/stage-ui-three/scenes/scene/directional-light/position', { x: 0, y: 0, z: -1 })
  const directionalLightTarget = useLocalStorage('settings/stage-ui-three/scenes/scene/directional-light/target', { x: 0, y: 0, z: 0 })
  const directionalLightRotation = useLocalStorage('settings/stage-ui-three/scenes/scene/directional-light/rotation', { x: 0, y: 0, z: 0 })
  // TODO: Manual directional light intensity will not work for other
  //       scenes with different lighting setups. But since the model
  //       is possible to have MeshToonMaterial, and MeshBasicMaterial
  //       without envMap to be able to inherit lighting from HDRI map,
  //       we will have to figure out a way to make this work to apply
  //       different directional light and other lighting setups
  //       for different environments.
  // WORKAROUND: To achieve the rendering style of Warudo for anime style
  //             Genshin Impact, or so called Cartoon style rendering with
  //             harsh shadows and bright highlights.
  // REVIEW: This is a temporary solution, and will be replaced with
  //         a more flexible lighting system in the future.
  const directionalLightIntensity = useLocalStorage('settings/stage-ui-three/scenes/scene/directional-light/intensity', 2.02)
  // TODO: color are the same
  const directionalLightColor = useLocalStorage('settings/stage-ui-three/scenes/scene/directional-light/color', '#fffbf5')

  const hemisphereSkyColor = useLocalStorage('settings/stage-ui-three/scenes/scene/hemisphere-light/sky-color', '#FFFFFF')
  const hemisphereGroundColor = useLocalStorage('settings/stage-ui-three/scenes/scene/hemisphere-light/ground-color', '#222222')
  const hemisphereLightIntensity = useLocalStorage('settings/stage-ui-three/scenes/scene/hemisphere-light/intensity', 0.4)

  const ambientLightColor = useLocalStorage('settings/stage-ui-three/scenes/scene/ambient-light/color', '#FFFFFF')
  const ambientLightIntensity = useLocalStorage('settings/stage-ui-three/scenes/scene/ambient-light/intensity', 0.6)

  // Rendering quality
  const renderScale = useLocalStorage('settings/stage-ui-three/renderScale', Math.min(window.devicePixelRatio, 2))
  const multisampling = useLocalStorage('settings/stage-ui-three/multisampling', 4)

  // environment related setting
  const envSelect = useLocalStorage('settings/stage-ui-three/envEnabled', 'hemisphere' as 'hemisphere' | 'skyBox')
  const skyBoxSrc = useLocalStorage('settings/stage-ui-three/skyBoxUrl', defaultSkyBoxSrc)
  const skyBoxIntensity = useLocalStorage('settings/stage-ui-three/skyBoxIntensity', 0.1)

  return {
    scale,
    lastModelSrc,
    lastModelIdentity,

    modelSize,
    modelOrigin,
    modelOffset,
    modelRotationY,

    cameraFOV,
    cameraPosition,
    cameraDistance,
    interactionMode,

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
    followSpeed,
    eyeHeight,
    renderScale,
    multisampling,

    envSelect,
    skyBoxSrc,
    skyBoxIntensity,

    availableExpressions,
    activeExpressions,
    discoveredMeshes,
    emotionMappings,
    favoriteExpression,
    vrmIdleAnimation,
    vrmIdleCycleEnabled,

    activeVrm,
    activeVrmParser,
    activeVrmIdentity,
    detectedWardrobe,

    onShouldUpdateView,
    shouldUpdateView,
    onTriggerEmotion,
    triggerEmotion,
    onTriggerMotion,
    triggerMotion,

    resetModelStore,
  }
})
