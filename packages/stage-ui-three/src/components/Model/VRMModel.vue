<script setup lang="ts">
/*
  * - Core component for loading and displaying VRM model
  * - Load model, get some geometry data for initialisation
  * - Shader injection and rendering setting
  * - Load & initialise animation
*/

import type { VRM } from '@pixiv/three-vrm'
import type {
  AnimationAction,
  AnimationClip,
  Group,
  Object3D,
  PerspectiveCamera,
  SphericalHarmonics3,
} from 'three'
import type { Ref, WatchStopHandle } from 'vue'

import type { Vec3 } from '../../stores/model-store'

import { VRMUtils } from '@pixiv/three-vrm'
import { useLoop, useTresContext } from '@tresjs/core'
import { until, useEventListener, useMouse } from '@vueuse/core'
import {
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  MathUtils,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  toRefs,
  watch,
} from 'vue'

import {
  createIblProbeController,
  normalizeEnvMode,
  updateNprShaderSetting,
} from '../../composables/shader/ibl'
// From stage-ui-three package
import {
  clipFromVRMAnimation,
  loadVRMAnimation,
  reAnchorRootPositionTrack,
  useBlink,
  useIdleEyeSaccades,
} from '../../composables/vrm/animation'
import { loadVrm } from '../../composables/vrm/core'
import { useVRMEmote } from '../../composables/vrm/expression'
import { useVRMLipSync } from '../../composables/vrm/lip-sync'
import { useVRMClothInteraction } from '../../composables/vrm/use-vrm-cloth-interaction'
import { useCustomVrmAnimationsStore } from '../../stores/custom-vrm-animations'
import { useModelStore } from '../../stores/model-store'

/*
  * Props:
  * - modelSrc: model src string to load model asset
  * - idleAnimation: animation src for model
  * - loadAnimations: TBC
  * - paused: if the animation is paused
  * - nprIrrSH: Spherical Harmonics computed from the sky box, used for IBL
  *
  * - modelOffset: The placing offset of model (x, y, z)
  * - modelRotationY: The rotation of the model (y-axis)
*/
const props = withDefaults(defineProps<{
  mouthOpenSize?: number
  currentAudioSource?: AudioBufferSourceNode
  modelSrc?: string
  modelIdentity?: string
  lastModelSrc?: string
  lastModelIdentity?: string
  idleAnimation: string
  idleAnimations?: string[]
  idleCycleEnabled?: boolean
  // loadAnimations?: string[]
  paused?: boolean

  envSelect: string
  skyBoxIntensity: number
  nprIrrSH?: SphericalHarmonics3 | null

  modelOffset: Vec3
  modelRotationY: number
  lookAtTarget: Vec3
  trackingMode: string
  eyeHeight: number
  cameraPosition: Vec3

  camera: PerspectiveCamera
}>(), {
  paused: false,
})
/*
  * Emits:
  * - model-core-loading-progress
  * - model-core-error
  * - model-core-ready
  *
*/
const emit = defineEmits<{
  (e: 'loadingProgress', value: number): void
  (e: 'loadStart'): void
  (e: 'cameraPosition', value: Vec3): void
  (e: 'modelOrigin', value: Vec3): void
  (e: 'modelSize', value: Vec3): void
  (e: 'modelRotationY', value: number): void
  (e: 'eyeHeight', value: number): void
  (e: 'lookAtTarget', value: Vec3): void

  (e: 'error', value: unknown): void
  (e: 'loaded', value: { modelIdentity?: string, modelSrc: string }): void
  (e: 'binaryLoaded', value: ArrayBuffer): void
  (e: 'finished'): void
  (e: 'playStatus', value: { duration: number, url: string }): void
}>()

const {
  mouthOpenSize,
  currentAudioSource,
  modelSrc,
  modelIdentity,
  lastModelSrc,
  lastModelIdentity,
  // loadAnimations, // TBC
  paused,

  envSelect,
  skyBoxIntensity,
  nprIrrSH,

  modelOffset,
  modelRotationY,
  lookAtTarget,
  trackingMode,
  eyeHeight,

  camera,
} = toRefs(props)

// Model and scene ref
const { scene } = useTresContext()
const vrm = shallowRef<VRM | null>(null)
const vrmGroup = shallowRef<Group>()
const modelLoaded = ref<boolean>(false)
const initialHipWorldPosition = shallowRef<Vector3 | null>(null)
// for eye tracking modes
const { x: mouseX, y: mouseY } = useMouse()
const raycaster = new Raycaster()
const mouse = new Vector2()
const mouseTarget = shallowRef<Vec3>()
let stopMouseWatch: WatchStopHandle | undefined

let isUnmounted = false
let currentLoadId = 0

// Expressions
const blink = useBlink()
const idleEyeSaccades = useIdleEyeSaccades(computed(() => modelStore.followSpeed))
const vrmEmote = ref<ReturnType<typeof useVRMEmote>>()
const modelStore = useModelStore()
const vrmLipSync = useVRMLipSync(currentAudioSource)
const vrmClothTug = useVRMClothInteraction()

// Setup Pointer Interaction (Moved below initialization to fix ReferenceError)
useEventListener('mousedown', (e) => {
  if (modelStore.interactionMode === 'tactile' && vrm.value && camera.value) {
    vrmClothTug.startTug({ x: e.clientX, y: e.clientY, isCtrlPressed: e.ctrlKey }, camera.value, vrm.value, vrmEmote.value)
  }
})

useEventListener('dblclick', (e) => {
  if (modelStore.interactionMode === 'tactile' && vrm.value && camera.value) {
    vrmClothTug.startTug({ x: e.clientX, y: e.clientY, isDoubleClick: true }, camera.value, vrm.value, vrmEmote.value)
  }
})

useEventListener('mousemove', (e) => {
  if (modelStore.interactionMode === 'tactile' && camera.value) {
    vrmClothTug.handleTug({ x: e.clientX, y: e.clientY }, camera.value)
  }
})

useEventListener('mouseup', () => {
  if (modelStore.interactionMode === 'tactile') {
    vrmClothTug.endTug()
  }
})

// Animation related state — kept as plain variables (NOT Vue reactive) because
// Three.js objects must not be wrapped in Vue proxies. The deep proxy created by
// ref() causes identity mismatches: e.action !== currentAction even when they
// represent the same AnimationAction, breaking the cycle's finished-event guard.
let vrmAnimationMixer: AnimationMixer | undefined
const { onBeforeRender, stop, start } = useLoop()

type VrmFrameHook = (vrm: VRM, delta: number) => void
const vrmFrameHook = shallowRef<VrmFrameHook>()
let disposeBeforeRenderLoop: (() => void | undefined)

// For sky box update
const nprProgramVersion = ref(0)
// For MToon IBL
let airiIblProbe: ReturnType<typeof createIblProbeController> | null = null

// clean the previous vrm model loaded
function componentCleanUp() {
  // clear animation
  disposeBeforeRenderLoop?.()
  // clear vrm group
  if (vrmGroup.value) {
    vrmGroup.value.removeFromParent()
  }
  // deep clear
  if (vrm.value) {
    // TODO: after bumping up to three 0.180.0 with @types/three 0.180.0,
    //   Argument of type 'Group<Object3DEventMap>' is not assignable to parameter of type 'Object3D<Object3DEventMap>'.
    //     Type 'Group<Object3DEventMap>' is missing the following properties from type 'Object3D<Object3DEventMap>': setPointerCapture, releasePointerCapture, hasPointerCapture
    //
    // Currently, AFAIK, https://github.com/pmndrs/xr/blob/456aa380206e93888cd3a5741a1534e672ae3106/packages/pointer-events/src/pointer.ts#L69-L100 declares
    // declare module 'three' {
    //   interface Object3D {
    //     setPointerCapture(pointerId: number): void
    //     releasePointerCapture(pointerId: number): void
    //     hasPointerCapture(pointerId: number): boolean

    //     intersectChildren?: boolean
    //     interactableDescendants?: Array<Object3D>
    //     /**
    //      * @deprecated
    //      */
    //     ancestorsHaveListeners?: boolean
    //     ancestorsHavePointerListeners?: boolean
    //     ancestorsHaveWheelListeners?: boolean
    //   }
    // }
    //
    // And in @tresjs/core v5, it uses the @pmndrs/pointer-events internally.
    // Somehow the Object3D from @types/three and the one augmented by @pmndrs/pointer-events are not compatible.
    // This needs to be fixed later.
    VRMUtils.deepDispose(vrm.value.scene as unknown as Object3D)
  }
  // clear IBL probe
  airiIblProbe?.dispose()
  airiIblProbe = null
  initialHipWorldPosition.value = null

  // clear cloth interaction tether
  if (vrmClothTug.tetherLine.value) {
    vrmClothTug.tetherLine.value.removeFromParent()
  }

  modelStore.activeVrm = null
  modelStore.activeVrmIdentity = ''

  cycleAdvancePending = false
  clipCache.clear()
  currentAction = null
  vrmAnimationMixer?.removeEventListener('finished', onAnimationFinished)
  vrmAnimationMixer = undefined
}

const clipCache = new Map<string, AnimationClip>()
let currentAction: AnimationAction | null = null

const customVrmAnimationsStore = useCustomVrmAnimationsStore()

const resolvedActiveIdleUrl = computed(() => {
  return customVrmAnimationsStore.resolveAnimationUrl(modelStore.vrmIdleAnimation)
})

const activeAnimationUrl = computed(() => {
  if (props.idleAnimation && props.idleAnimation !== new URL('../../assets/vrm/animations/idle_loop.vrma', import.meta.url).href) {
    return props.idleAnimation
  }
  return resolvedActiveIdleUrl.value
})

function parseVrmCycleAnimations(idleAnimations: string[] | undefined) {
  if (!idleAnimations)
    return []
  return idleAnimations.filter(key => !key.startsWith('live2d:') && !key.startsWith('spine:'))
}

const vrmCycleAnimationUrls = computed(() => {
  const keys = parseVrmCycleAnimations(props.idleAnimations)
  return keys.map(key => customVrmAnimationsStore.resolveAnimationUrl(key))
})

async function playBaseAnimation() {
  if (!vrm.value || !vrmAnimationMixer)
    return

  const url = activeAnimationUrl.value
  if (!url)
    return

  try {
    let clip = clipCache.get(url)
    if (!clip) {
      const animation = await loadVRMAnimation(url)
      const loadedClip = await clipFromVRMAnimation(vrm.value, animation)
      if (!loadedClip)
        return

      reAnchorRootPositionTrack(loadedClip, vrm.value, initialHipWorldPosition.value ?? undefined)
      loadedClip.tracks = loadedClip.tracks.filter(track => !track.name.includes('blendShapes') && !track.name.includes('expressions'))
      clipCache.set(url, loadedClip)
      clip = loadedClip
    }

    if (!vrmAnimationMixer)
      return

    const newAction = vrmAnimationMixer.clipAction(clip)
    const fadeDuration = 0.8

    newAction.setLoop(LoopRepeat, Infinity)
    newAction.clampWhenFinished = false
    newAction.reset()
    newAction.setEffectiveWeight(1)
    newAction.play()

    emit('playStatus', {
      duration: clip.duration,
      url,
    })

    if (currentAction && currentAction !== newAction) {
      newAction.crossFadeFrom(currentAction, fadeDuration, true)
    }
    else {
      newAction.fadeIn(fadeDuration)
    }

    currentAction = newAction
  }
  catch (err) {
    console.error('[VRMModel] Failed to play base animation:', err)
  }
}

async function playNextIdleCycleAnimation() {
  if (!vrm.value || !vrmAnimationMixer)
    return

  const cycle = vrmCycleAnimationUrls.value
  if (cycle.length === 0) {
    playBaseAnimation()
    return
  }

  let nextAnimUrl = cycle[0]
  if (cycle.length > 1) {
    const currentClip = currentAction?.getClip()
    const choices = cycle.filter((url) => {
      const clip = clipCache.get(url)
      return !clip || clip !== currentClip
    })
    const targetChoices = choices.length > 0 ? choices : cycle
    nextAnimUrl = targetChoices[Math.floor(Math.random() * targetChoices.length)]
  }

  try {
    let clip = clipCache.get(nextAnimUrl)
    if (!clip) {
      const animation = await loadVRMAnimation(nextAnimUrl)
      const loadedClip = await clipFromVRMAnimation(vrm.value, animation)
      if (!loadedClip)
        return

      reAnchorRootPositionTrack(loadedClip, vrm.value, initialHipWorldPosition.value ?? undefined)
      loadedClip.tracks = loadedClip.tracks.filter(track => !track.name.includes('blendShapes') && !track.name.includes('expressions'))
      clipCache.set(nextAnimUrl, loadedClip)
      clip = loadedClip
    }

    if (!vrmAnimationMixer)
      return

    const newAction = vrmAnimationMixer.clipAction(clip)
    const fadeDuration = 0.8

    if (cycle.length === 1) {
      newAction.setLoop(LoopRepeat, Infinity)
      newAction.clampWhenFinished = false
    }
    else {
      newAction.setLoop(LoopOnce, 1)
      newAction.clampWhenFinished = true
    }

    newAction.reset()
    newAction.setEffectiveWeight(1)
    newAction.play()

    emit('playStatus', {
      duration: clip.duration,
      url: nextAnimUrl,
    })

    if (currentAction && currentAction !== newAction) {
      newAction.crossFadeFrom(currentAction, fadeDuration, true)
    }
    else {
      newAction.fadeIn(fadeDuration)
    }

    currentAction = newAction
  }
  catch (err) {
    console.error('[VRMModel] Failed to play next cycle animation:', err)
  }
}

// Flag to prevent double-advancing when multiple finished events arrive in one frame
let cycleAdvancePending = false

function onAnimationFinished(e: any) {
  if (e.action !== currentAction)
    return

  emit('finished')

  const cycle = vrmCycleAnimationUrls.value
  if (cycle.length > 1 && !cycleAdvancePending) {
    cycleAdvancePending = true
    // Defer out of the Three.js mixer.update() call stack — calling clipAction()/play()
    // synchronously from within a finished event can cause internal mixer state issues.
    setTimeout(() => {
      cycleAdvancePending = false
      playNextIdleCycleAnimation()
    }, 0)
  }
}

async function playTransientAnimation(key: string) {
  if (!vrm.value || !vrmAnimationMixer)
    return

  const url = customVrmAnimationsStore.resolveAnimationUrl(key)
  if (!url)
    return

  try {
    let clip = clipCache.get(url)
    if (!clip) {
      const animation = await loadVRMAnimation(url)
      const loadedClip = await clipFromVRMAnimation(vrm.value, animation)
      if (!loadedClip)
        return

      reAnchorRootPositionTrack(loadedClip, vrm.value, initialHipWorldPosition.value ?? undefined)
      loadedClip.tracks = loadedClip.tracks.filter(track => !track.name.includes('blendShapes') && !track.name.includes('expressions'))
      clipCache.set(url, loadedClip)
      clip = loadedClip
    }

    if (!vrmAnimationMixer)
      return

    const newAction = vrmAnimationMixer.clipAction(clip)
    const fadeDuration = 0.5

    newAction.setLoop(LoopOnce, 1)
    newAction.clampWhenFinished = true
    newAction.reset()
    newAction.setEffectiveWeight(1)
    newAction.play()

    emit('playStatus', {
      duration: clip.duration,
      url,
    })

    if (currentAction && currentAction !== newAction) {
      newAction.crossFadeFrom(currentAction, fadeDuration, true)
    }
    else {
      newAction.fadeIn(fadeDuration)
    }

    currentAction = newAction

    const onFinished = (e: any) => {
      if (e.action === newAction) {
        vrmAnimationMixer?.removeEventListener('finished', onFinished)
        const cycle = vrmCycleAnimationUrls.value
        if (cycle.length > 0) {
          playNextIdleCycleAnimation()
        }
        else {
          playBaseAnimation()
        }
      }
    }
    vrmAnimationMixer.addEventListener('finished', onFinished)
  }
  catch (err) {
    console.error('[VRMModel] Failed to play transient animation:', err)
  }
}

// look at mouse
function lookAtMouse(
  mouseX: number,
  mouseY: number,
  camera: Ref<PerspectiveCamera>,
): Vec3 {
  mouse.x = (mouseX / window.innerWidth) * 2 - 1
  mouse.y = -(mouseY / window.innerHeight) * 2 + 1

  // Raycast from the mouse position
  raycaster.setFromCamera(mouse, camera.value)

  // Create a plane in front of the camera
  const cameraDirection = new Vector3()
  camera.value.getWorldDirection(cameraDirection) // Get camera's forward direction

  const plane = new Plane()
  plane.setFromNormalAndCoplanarPoint(
    cameraDirection,
    camera.value.position.clone().add(cameraDirection.multiplyScalar(1)), // 1 unit in front of the camera
  )

  const intersection = new Vector3()
  raycaster.ray.intersectPlane(plane, intersection)
  return { x: intersection.x, y: intersection.y, z: intersection.z }
}

function defaultTookAt(eyeHeight: number): Vec3 {
  return {
    x: 0,
    y: eyeHeight,
    z: -100,
  }
}

async function loadModel() {
  try {
    if (!scene.value) {
      console.warn('Scene is not ready, cannot load VRM model.')
      return
    }

    // console.log('[VRMModel] Loading:', modelSrc.value)

    const loadId = ++currentLoadId

    if (!modelSrc.value) {
      componentCleanUp()
      console.warn('NO model src, cannot load VRM model.')
      return
    }
    // Local file models are loaded through blob URLs, so a stable model identity
    // is required to avoid resetting the camera on every app restart.
    const currentModelIdentity = modelIdentity.value || modelSrc.value
    const previousModelIdentity = lastModelIdentity.value || lastModelSrc.value
    const isFirstLoad = currentModelIdentity !== previousModelIdentity

    try {
      emit('loadStart')
      // Load vrm model
      modelLoaded.value = false
      const _vrmInfo = await loadVrm(modelSrc.value, {
        scene: scene.value,
        lookAt: true,
        onProgress: progress => emit(
          'loadingProgress',
          Number((100 * progress.loaded / progress.total).toFixed(2)),
        ),
      })

      if (!_vrmInfo || !_vrmInfo._vrm || !_vrmInfo?._vrmGroup) {
        console.warn('VRM model loading failure!')
        return
      }
      const {
        _vrm,
        _vrmGroup,
        modelCenter: vrmModelCenter,
        modelSize: vrmModelSize,
        initialCameraOffset: vrmInitialCameraOffset,
        parser: vrmParser,
        unmappedExpressions: vrmUnlockedExpressions,
      } = _vrmInfo

      // ASYNC GUARD: If we unmounted or a new load started, dispose this model immediately
      if (isUnmounted || loadId !== currentLoadId) {
        console.warn('[VRMModel] Discarding model from stale/unmounted load:', loadId)
        VRMUtils.deepDispose(_vrm.scene as unknown as Object3D)
        _vrmGroup.removeFromParent()
        return
      }

      // Atomic Model Swap: Clean up the previous model right before mounting the new one
      componentCleanUp()

      /*
        * Model setting
      */
      vrm.value = _vrm
      vrmGroup.value = _vrmGroup

      // Add tether line to model group for local-to-world sync
      if (vrmClothTug.tetherLine.value) {
        _vrmGroup.add(vrmClothTug.tetherLine.value)
      }
      modelStore.activeVrm = _vrm
      modelStore.activeVrmParser = vrmParser
      modelStore.activeVrmIdentity = currentModelIdentity
      // If it's first load
      if (isFirstLoad) {
        emit('cameraPosition', {
          x: vrmModelCenter.x + vrmInitialCameraOffset.x,
          y: vrmModelCenter.y + vrmInitialCameraOffset.y,
          z: vrmModelCenter.z + vrmInitialCameraOffset.z,
        })
        emit('modelOrigin', {
          x: vrmModelCenter.x,
          y: vrmModelCenter.y,
          z: vrmModelCenter.z,
        })
        emit('modelSize', {
          x: vrmModelSize.x,
          y: vrmModelSize.y,
          z: vrmModelSize.z,
        })
      }

      // Set model facing direction
      // Lilia: I brought forward the rotation to the core.ts, so that any ad-hoc rotation will not impact the model centre position.
      if (isFirstLoad) {
        // Reset model rotation Y
        emit('modelRotationY', 0)
      }

      // Populate available expressions for the settings UI
      if (_vrm.expressionManager) {
        const nativeExpressions = Object.keys(_vrm.expressionManager.expressionMap)
        modelStore.availableExpressions = [...nativeExpressions, ...vrmUnlockedExpressions].sort()
      }

      // Populate discovered 3D mesh nodes for the wardrobe/outfits UI using native glTF nodes
      const meshNodes: Array<{ name: string, isSkinned: boolean, vertexCount: number }> = []
      const gltfNodes = vrmParser?.json?.nodes
      const gltfMeshes = vrmParser?.json?.meshes

      if (Array.isArray(gltfNodes) && gltfNodes.length > 0) {
        for (let i = 0; i < gltfNodes.length; i++) {
          const gNode = gltfNodes[i]
          if (gNode.mesh !== undefined) {
            const nodeName = gNode.name || gltfMeshes?.[gNode.mesh]?.name || `Mesh_${gNode.mesh}`
            let totalVerts = 0
            _vrm.scene.traverse((sceneNode: any) => {
              if (sceneNode.isMesh || sceneNode.isSkinnedMesh) {
                const assoc = vrmParser?.associations?.get(sceneNode)
                if (assoc && assoc.nodes === i) {
                  totalVerts += sceneNode.geometry?.attributes?.position?.count ?? 0
                }
                else if (sceneNode.name && (sceneNode.name === nodeName || sceneNode.name.startsWith(`${nodeName}baked`) || sceneNode.name.startsWith(`${nodeName}.`))) {
                  totalVerts += sceneNode.geometry?.attributes?.position?.count ?? 0
                }
              }
            })

            meshNodes.push({
              name: nodeName,
              isSkinned: gNode.skin !== undefined,
              vertexCount: totalVerts,
            })
          }
        }
      }
      else {
        _vrm.scene.traverse((node: any) => {
          if ((node.isMesh || node.isSkinnedMesh) && node.name) {
            meshNodes.push({
              name: node.name,
              isSkinned: Boolean(node.isSkinnedMesh),
              vertexCount: node.geometry?.attributes?.position?.count ?? 0,
            })
          }
        })
      }
      modelStore.discoveredMeshes = meshNodes

      const hipNode = _vrm.humanoid?.getNormalizedBoneNode('hips')
      if (hipNode) {
        hipNode.updateMatrixWorld(true)
        const hipWorldPosition = new Vector3()
        hipNode.getWorldPosition(hipWorldPosition)
        initialHipWorldPosition.value = hipWorldPosition
      }
      else {
        initialHipWorldPosition.value = null
      }

      /*
        * Animation setting
      */
      // play animation
      vrmAnimationMixer = new AnimationMixer(_vrm.scene)
      vrmAnimationMixer.addEventListener('finished', onAnimationFinished)

      const cycle = vrmCycleAnimationUrls.value
      if (cycle.length > 0) {
        await playNextIdleCycleAnimation()
      }
      else {
        await playBaseAnimation()
      }

      vrmEmote.value = useVRMEmote(_vrm)

      /*
        * Shader setting
      */
      // material selection
      // refactoring
      // MToon material sky box lightProbe setting
      if (!airiIblProbe && scene.value)
        airiIblProbe = createIblProbeController(scene.value)

      /*
        * Eye tracking setting
      */
      function getEyePosition(): number | null {
        const eye = vrm.value?.humanoid?.getNormalizedBoneNode('head')
        if (!eye)
          return null
        const eyePos = new Vector3()
        eye.getWorldPosition(eyePos)
        return eyePos.y
      }
      if (isFirstLoad) {
        const eyePositionY = getEyePosition()
        if (eyePositionY) {
          emit('eyeHeight', eyePositionY)
          emit('lookAtTarget', defaultTookAt(eyePositionY))
        }
      }

      // Standard VRM Update Loop
      disposeBeforeRenderLoop = onBeforeRender(({ delta }) => {
        if (vrm.value) {
          // Loop: Custom frame hook
          vrmFrameHook.value?.(vrm.value, delta)

          // Loop: Cloth Interaction (Wired R&D)
          vrmClothTug.update(vrm.value, delta, vrmEmote.value)

          // Update mixer
          vrmAnimationMixer?.update(delta)
        }
        const activeVrm = vrm.value
        if (!activeVrm)
          return

        // 1. Core update (humanoid, springbone, expressions)
        activeVrm.update(delta)

        // 2. Plugin updates
        blink.update(activeVrm, delta)
        idleEyeSaccades.update(activeVrm, lookAtTarget, delta)
        vrmEmote.value?.update(delta)

        if (mouthOpenSize.value !== undefined) {
          activeVrm.expressionManager?.setValue('aa', mouthOpenSize.value * 0.75)
        }
        else {
          vrmLipSync.update(activeVrm, delta)
        }

        // 3. Apply expression updates to meshes
        activeVrm.expressionManager?.update()
      }).off

      // ASYNC GUARD: Check again after animation loading
      if (isUnmounted || loadId !== currentLoadId) {
        console.warn('[VRMModel] Discarding model after animation load - stale/unmounted:', loadId)
        componentCleanUp() // This will use the latest vrm.value, but we should be careful
        // Better: dispose the specific ones we just loaded if they aren't assigned yet
        VRMUtils.deepDispose(_vrm.scene as unknown as Object3D)
        _vrmGroup.removeFromParent()
        return
      }

      // update the 'last model src'
      emit('loaded', {
        modelIdentity: modelIdentity.value,
        modelSrc: modelSrc.value,
      })
      modelLoaded.value = true
    }
    catch (err) {
      console.error(err)
      emit('error', err)
    }
  }
  catch (err) {
    console.error(err)
    emit('error', err)
  }
}

onMounted(async () => {
  // wait until scene is not undefined
  await until(() => scene.value).toBeTruthy()
  await loadModel()

  /*
    * Downward info flow
    * - Pinia store value updated => command take effect
  */
  // watch if the model needs to be reloaded
  watch(modelSrc, (newSrc, oldSrc) => {
    if (newSrc !== oldSrc) {
      loadModel()
    }
  })
  // watch if the animation should be paused
  watch(paused, (isPaused) => {
    if (isPaused) {
      stop()
    }
    else {
      start()
    }
  }, { immediate: true })
  // update model position
  watch([
    () => modelOffset.value.x,
    () => modelOffset.value.y,
    () => modelOffset.value.z,
    vrmGroup,
  ], () => {
    if (vrmGroup.value) {
      vrmGroup.value.position.set(
        modelOffset.value.x,
        modelOffset.value.y,
        modelOffset.value.z,
      )
    }
  }, { immediate: true })
  // update model rotation
  watch([modelRotationY, vrmGroup], () => {
    if (vrmGroup.value) {
      vrmGroup.value.rotation.y = MathUtils.degToRad(modelRotationY.value)
    }
  }, { immediate: true })
  // update NPR sky box
  watch([envSelect, skyBoxIntensity, nprIrrSH], async () => {
    if (!vrm.value)
      return
    // force the program to flush
    nprProgramVersion.value += 1
    const mode = normalizeEnvMode(envSelect.value)

    // TODO: after bumping up to three 0.180.0 with @types/three 0.180.0,
    //   Argument of type 'Group<Object3DEventMap>' is not assignable to parameter of type 'Object3D<Object3DEventMap>'.
    //     Type 'Group<Object3DEventMap>' is missing the following properties from type 'Object3D<Object3DEventMap>': setPointerCapture, releasePointerCapture, hasPointerCapture
    //
    // Currently, AFAIK, https://github.com/pmndrs/xr/blob/456aa380206e93888cd3a5741a1534e672ae3106/packages/pointer-events/src/pointer.ts#L69-L100 declares
    // declare module 'three' {
    //   interface Object3D {
    //     setPointerCapture(pointerId: number): void
    //     releasePointerCapture(pointerId: number): void
    //     hasPointerCapture(pointerId: number): boolean

    //     intersectChildren?: boolean
    //     interactableDescendants?: Array<Object3D>
    //     /**
    //      * @deprecated
    //      */
    //     ancestorsHaveListeners?: boolean
    //     ancestorsHavePointerListeners?: boolean
    //     ancestorsHaveWheelListeners?: boolean
    //   }
    // }
    //
    // And in @tresjs/core v5, it uses the @pmndrs/pointer-events internally.
    // Somehow the Object3D from @types/three and the one augmented by @pmndrs/pointer-events are not compatible.
    // This needs to be fixed later.
    updateNprShaderSetting(vrm.value?.scene as unknown as Object3D, {
      mode,
      intensity: skyBoxIntensity.value,
      sh: nprIrrSH.value ?? null,
    })
    airiIblProbe?.update(mode, skyBoxIntensity.value, nprIrrSH.value ?? null)
  }, { immediate: true })
  // update eye tracking mode
  watch(trackingMode, (newMode) => {
    stopMouseWatch?.()
    stopMouseWatch = undefined
    if (newMode === 'mouse') {
      stopMouseWatch = watch([mouseX, mouseY], ([newX, newY]) => {
        mouseTarget.value = lookAtMouse(newX, newY, camera)
        // watch to update look at target to mouse
        emit('lookAtTarget', mouseTarget.value)
      }, { immediate: true, deep: true })
    }
    else {
      emit('lookAtTarget', defaultTookAt(eyeHeight.value))
    }
  }, { immediate: true })
  watch(lookAtTarget, (newTarget) => {
    if (vrm.value) {
      idleEyeSaccades.instantUpdate(vrm.value, newTarget)
    }
  }, { deep: true })

  // watch if the idle animation should be updated
  watch(activeAnimationUrl, () => {
    playBaseAnimation()
  })

  // watch cycle animations playlist changes
  watch(vrmCycleAnimationUrls, (urls) => {
    if (!vrm.value || !vrmAnimationMixer)
      return

    if (urls.length > 0) {
      const currentClip = currentAction?.getClip()
      const isPlayingCycleItem = urls.some((url) => {
        const clip = clipCache.get(url)
        return clip && clip === currentClip
      })

      if (!isPlayingCycleItem) {
        playNextIdleCycleAnimation()
      }
    }
    else {
      playBaseAnimation()
    }
  }, { deep: true })
})

onUnmounted(() => {
  isUnmounted = true
  componentCleanUp()
})

if (import.meta.hot) {
  // Ensure cleanup on HMR
  import.meta.hot.dispose(() => {
    componentCleanUp()
  })
}

defineExpose({
  listExpressions() {
    return Object.keys(vrm.value?.expressionManager?.expressionMap || {})
  },
  setExpression(expression: string, intensity = 1, resetMs?: number) {
    if (resetMs !== undefined) {
      vrmEmote.value?.setEmotionWithResetAfter(expression, resetMs, intensity)
    }
    else {
      vrmEmote.value?.setEmotion(expression, intensity)
    }
  },
  playTransientAnimation(key: string) {
    void playTransientAnimation(key)
  },
  setVrmFrameHook(hook?: VrmFrameHook) {
    vrmFrameHook.value = hook
  },
  scene: computed(() => vrm.value?.scene),
  lookAtUpdate(target: Vec3) {
    if (vrm.value) {
      idleEyeSaccades.instantUpdate(vrm.value, target)
    }
  },
  stopAnimations() {
    vrmAnimationMixer?.stopAllAction()
  },
  restoreDefaultExpressions() {
    if (!vrm.value?.expressionManager)
      return
    for (const name of modelStore.availableExpressions) {
      const weight = modelStore.activeExpressions[name] || 0
      vrm.value.expressionManager.setValue(name, weight)
    }
    vrm.value.expressionManager.update()
  },
})

// === Manual Expression Sync ===
// Applies weights from the settings panel (activeExpressions in store)
// directly to the VRM model, bypassing the ACT emotion system.
// Watches both activeExpressions AND modelLoaded so it fires:
//   - When the user toggles an expression (change in activeExpressions)
//   - When the model finishes loading (modelLoaded becomes true)
watch([() => modelStore.activeExpressions, modelLoaded], ([active, loaded]) => {
  if (!loaded || !vrm.value?.expressionManager)
    return

  for (const name of modelStore.availableExpressions) {
    const weight = active[name] || 0
    // Optimization: query current weight to minimize manager updates
    if (vrm.value.expressionManager.getValue(name) !== weight) {
      vrm.value.expressionManager.setValue(name, weight)
    }
  }
  vrm.value.expressionManager.update()
}, { deep: true })

// === ACT Emotion Mapping Sync ===
// Injects user-configured VRM expression → ACT emotion mappings
// into the emote system (Layer 3: ACT Mapping).
// Also watches modelLoaded so mappings are applied on boot.
watch([() => modelStore.emotionMappings, modelLoaded], ([mappings, loaded]) => {
  if (!loaded || !vrmEmote.value || !vrm.value?.expressionManager)
    return

  // For each mapping: emotionMappings[vrmExpressionName] = actEmotionSlot
  // e.g., { "anger": "angry" } means the ACT "angry" emotion should fire VRM "anger"
  // We invert the map: for each ACT slot, collect the VRM expressions mapped to it
  const actToVrm = new Map<string, { name: string, value: number }[]>()
  for (const [vrmName, actSlot] of Object.entries(mappings)) {
    if (!actSlot)
      continue
    if (!actToVrm.has(actSlot))
      actToVrm.set(actSlot, [])
    actToVrm.get(actSlot)!.push({ name: vrmName, value: 1.0 })
  }

  // Register/update each ACT emotion with the user's mapped expressions
  for (const [actSlot, expressions] of actToVrm) {
    vrmEmote.value.addEmotionState(actSlot, {
      expression: expressions,
      blendDuration: 0.3,
    })
  }
}, { deep: true })
</script>

<template>
  <slot v-if="modelLoaded" />
</template>
