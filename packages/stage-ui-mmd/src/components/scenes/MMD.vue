<script setup lang="ts">
/*
  * Root MMD scene component.
  *
  * Unlike the VRM renderer (which is declarative via TresJS), MMD is driven
  * imperatively: MMDAnimationHelper owns the animation/IK/grant/physics step
  * and must run in a hand-managed render loop. This component owns the
  * WebGLRenderer, camera, lights, OrbitControls, and the per-frame pipeline,
  * and exposes the same contract Stage.vue expects from every renderer
  * (canvasElement / captureFrame / setEmotion).
*/

import type { SkinnedMesh } from 'three'

import type { GazeOffset, MMDAnimationManager, MorphController } from '../../composables/mmd'
import type { ResolvedMMDModel } from '../../utils/mmd-loader'

import { errorMessageFrom } from '@moeru/std'
import { Screen } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import {
  AmbientLight,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  Euler,
  Group,
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three-stdlib'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'

import {
  createGazeController,
  createMMDAnimationManager,
  createMMDLoaderContext,
  createMorphController,
  EYE_PITCH_LIMIT,
  EYE_YAW_LIMIT,
  loadMMDAnimationClip,
  useMMDBlink,
  useMMDEmote,
  useMMDLipSync,
} from '../../composables/mmd'
import { Emotion, EMOTION_VALUES } from '../../constants/emotions'
import { useMMD } from '../../stores/mmd'
import { loadMMDModelFromSource } from '../../utils/mmd-loader'

const props = withDefaults(defineProps<{
  modelSrc?: string
  modelId?: string
  paused?: boolean
  cursorPosition?: { x: number, y: number }
  mouthOpenSize?: number
  currentAudioSource?: AudioBufferSourceNode
  enableOrbitControls?: boolean
  textureMap?: Map<string, string | ImageBitmap>
  scale?: number
  positionX?: number
  positionY?: number
  interactionMode?: string
  draggable?: boolean
  /** Card-level idle animation cycle list (from extensions.airi.acting.idleAnimations). */
  idleAnimations?: string[]
  previewExpression?: string
}>(), {
  paused: false,
  enableOrbitControls: false,
  mouthOpenSize: 0,
  draggable: false,
})

const emit = defineEmits<{
  (e: 'error', err: unknown): void
  (e: 'scaleChange', val: number): void
  (e: 'offsetChange', val: { x: number, y: number }): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const mmdStore = useMMD()
const {
  physicsEnabled,
  ikEnabled,
  grantEnabled,
  physicsGravity,
  gazeMode,
  position,
  scale,
  rotationY,
  morphOverrides,
  emotionActionMap,
  materialOpacity,
  idleMotionName,
  availableMotions,
  customMotions,
  oneShotAction,
  cameraFov,
  ambientColor,
  ambientIntensity,
  directionalColor,
  directionalIntensity,
  directionalPosition,
  albedoGlow,
  renderScale,
} = storeToRefs(mmdStore)

const allMotions = computed(() => [
  ...availableMotions.value.map(name => ({ id: name, name })),
  ...customMotions.value,
])

const canvasRef = ref<HTMLCanvasElement>()

// Imperative three.js objects (no reactivity — mutated in the render loop).
let renderer: WebGLRenderer | undefined
let scene: Scene | undefined
let camera: PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let ambientLight: AmbientLight | undefined
let directionalLight: DirectionalLight | undefined
let modelGroup: Group | undefined
let resolved: ResolvedMMDModel | undefined
let mesh: SkinnedMesh | undefined
let morphs: MorphController | undefined
let animation: MMDAnimationManager | undefined
let emote: ReturnType<typeof useMMDEmote> | undefined
// Set of motion names already registered with the current model.
const registeredMotions = new Set<string>()
const clock = new Clock()
let rafHandle = 0
let localBlobUrls: string[] = []
// Idle cycle state — mirrors VRM's cycle pattern.
let cycleAdvancePending = false
let activePreviewMorph: string | undefined
let activeFinishedListener: ((e: any) => void) | undefined

// Lip-sync owns Vue lifecycle hooks, so it must be created during setup. It
// is fed the live audio source and applied to whichever morphs are mounted.
const audioRef = shallowRef<AudioBufferSourceNode | undefined>(props.currentAudioSource)
watch(() => props.currentAudioSource, v => audioRef.value = v)
const lipSync = useMMDLipSync(audioRef)
const blink = useMMDBlink()
let gaze: ReturnType<typeof createGazeController> | undefined

function canvasElement() {
  return canvasRef.value
}

function captureFrame(): Promise<Blob | null> | undefined {
  if (!renderer || !scene || !camera)
    return undefined
  // preserveDrawingBuffer keeps the last frame readable for the snapshot.
  renderer.render(scene, camera)
  return new Promise(resolve => canvasRef.value?.toBlob(resolve, 'image/png'))
}

/**
 * Resolves the gaze target for the current tracking mode.
 *
 * - `none`   → `undefined`, so the gaze controller idle-saccades.
 * - `camera` → centered offset, so the model looks forward toward the camera.
 * - `mouse`  → cursor position normalized to the canvas, or `undefined`
 *   (idle saccades) when there is no cursor.
 */
function resolveGazeOffset(): GazeOffset | undefined {
  if (gazeMode.value === 'none')
    return undefined

  if (gazeMode.value === 'camera') {
    // Aim the eyes at the camera: take the camera direction relative to the
    // look-at center, bring it into the model's local frame (so the user's
    // rotation is accounted for), and convert to yaw/pitch fractions of the
    // eye swing limits. Clamped, so an off-axis camera reads as a hard look.
    if (!camera || !controls || !modelGroup)
      return { x: 0, y: 0 }
    const dir = camera.position.clone().sub(controls.target).normalize()
    dir.applyQuaternion(new Quaternion().copy(modelGroup.quaternion).invert())
    const yaw = Math.atan2(dir.x, dir.z)
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)))
    return {
      x: Math.max(-1, Math.min(1, yaw / EYE_YAW_LIMIT)),
      y: Math.max(-1, Math.min(1, -pitch / EYE_PITCH_LIMIT)),
    }
  }

  // mouse
  if (!props.cursorPosition || !canvasRef.value)
    return undefined
  const rect = canvasRef.value.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0)
    return undefined
  const nx = ((props.cursorPosition.x - rect.left) / rect.width) * 2 - 1
  const ny = ((props.cursorPosition.y - rect.top) / rect.height) * 2 - 1
  return { x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) }
}

const computedScale = computed(() => props.scale !== undefined ? props.scale : scale.value)
const computedPositionX = computed(() => props.positionX !== undefined ? props.positionX / 100 : position.value.x)
const computedPositionY = computed(() => props.positionY !== undefined ? props.positionY / 100 : position.value.y)
const isOrbitControlsEnabled = computed(() => props.enableOrbitControls || props.interactionMode === 'orbit')

function applyTransform() {
  if (!modelGroup)
    return
  modelGroup.scale.setScalar(computedScale.value)
  modelGroup.rotation.y = rotationY.value
  modelGroup.position.set(computedPositionX.value, computedPositionY.value, 0)
}

const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let initialOffsetX = 0
let initialOffsetY = 0

function handleWheel(event: WheelEvent) {
  if (props.interactionMode !== 'drag' && props.interactionMode !== 'positioning')
    return

  const delta = event.deltaY * -0.0005
  const newScale = Math.min(Math.max((props.scale || 1) + delta, 0.1), 15)
  emit('scaleChange', newScale)
}

function handlePointerDown(event: PointerEvent) {
  console.log('[MMD] handlePointerDown, mode:', props.interactionMode)
  if (props.interactionMode !== 'drag' && props.interactionMode !== 'positioning')
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(event.pointerId)
  }

  isDragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY

  initialOffsetX = props.positionX || 0
  initialOffsetY = props.positionY || 0
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value)
    return

  console.log('[MMD] handlePointerMove dragging')
  const SENSITIVITY = 2.0
  const deltaX = (event.clientX - dragStartX) * SENSITIVITY
  const deltaY = (event.clientY - dragStartY) * SENSITIVITY

  const newX = initialOffsetX + deltaX
  const newY = initialOffsetY - deltaY

  emit('offsetChange', { x: newX, y: newY })
}

function handlePointerUp(event: PointerEvent) {
  console.log('[MMD] handlePointerUp')
  if (!isDragging.value)
    return

  const target = event.currentTarget as HTMLElement
  if (target && typeof target.releasePointerCapture === 'function') {
    target.releasePointerCapture(event.pointerId)
  }

  isDragging.value = false
}

/**
 * three.Color rejects 8-digit `#RRGGBBAA` hex, which the color picker emits.
 * Strip the alpha channel so light colors actually apply.
 */
function normalizeHex(hex: string): string {
  return /^#[0-9a-f]{8}$/i.test(hex) ? hex.slice(0, 7) : hex
}

/** Sets the albedo self-glow on every material (live, from the settings store). */
function applyMaterialGlow(value: number) {
  modelGroup?.traverse((object) => {
    if (!(object instanceof Mesh))
      return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      const mat = material as { emissiveIntensity?: number }
      if (typeof mat.emissiveIntensity === 'number')
        mat.emissiveIntensity = value
    }
  })
}

/** Collects the model's materials as descriptors for the settings UI. */
function collectMaterials(): { name: string, label: string, index: number }[] {
  const descriptors: { name: string, label: string, index: number }[] = []
  let index = 0
  modelGroup?.traverse((object) => {
    if (!(object instanceof Mesh))
      return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      descriptors.push({ name: material.name, label: material.name || `Material ${index}`, index })
      index++
    }
  })
  return descriptors
}

/**
 * Applies per-material opacity overrides (keyed by material name). Captures
 * each material's original `transparent` flag once so restoring full opacity
 * does not force-disable a material that was authored transparent.
 */
function applyMaterialOpacity() {
  const overrides = materialOpacity.value
  modelGroup?.traverse((object) => {
    if (!(object instanceof Mesh))
      return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      const cached = material.userData.__origTransparent
      const origTransparent = typeof cached === 'boolean'
        ? cached
        : (material.userData.__origTransparent = material.transparent ?? false)
      const opacity = overrides[material.name] ?? 1
      material.opacity = opacity
      material.transparent = origTransparent || opacity < 1
      material.needsUpdate = true
    }
  })
}

function setupScene() {
  const canvas = canvasRef.value!
  renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.outputColorSpace = SRGBColorSpace
  // MMD toon materials are not PBR/HDR; filmic tone mapping desaturates and
  // washes them out, so render their colors directly.
  renderer.toneMapping = NoToneMapping
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * renderScale.value)

  scene = new Scene()
  camera = new PerspectiveCamera(cameraFov.value, 1, 0.1, 1000)
  camera.position.set(0, 1, 3)

  // Toon shading with an albedo self-glow (applied at load): keep direct lights
  // moderate so the lit side doesn't blow out, while the glow + ambient keep the
  // shadow side bright. All values are user-adjustable via the settings store.
  ambientLight = new AmbientLight(new Color(normalizeHex(ambientColor.value)), ambientIntensity.value)
  scene.add(ambientLight)
  directionalLight = new DirectionalLight(new Color(normalizeHex(directionalColor.value)), directionalIntensity.value)
  directionalLight.position.set(directionalPosition.value.x, directionalPosition.value.y, directionalPosition.value.z)
  scene.add(directionalLight)

  controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.enabled = isOrbitControlsEnabled.value
}

/** Frames the camera so the whole model fits the viewport, and centers it. */
function frameCamera() {
  if (!camera || !controls || !modelGroup)
    return
  modelGroup.updateMatrixWorld(true)
  const box = new Box3().setFromObject(modelGroup)
  if (box.isEmpty())
    return
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())

  // Fit to BOTH axes using the camera aspect, so the model fills a portrait or
  // landscape viewport without being cropped (mirrors Spine's auto-fit).
  const vFov = (camera.fov * Math.PI) / 180
  const fitHeightDistance = (size.y / 2) / Math.tan(vFov / 2)
  const fitWidthDistance = (size.x / 2) / (Math.tan(vFov / 2) * camera.aspect)
  const distance = 1.2 * Math.max(fitHeightDistance, fitWidthDistance)

  camera.position.set(center.x, center.y, center.z + distance)
  camera.near = Math.max(distance / 100, 0.01)
  camera.far = distance * 100
  camera.updateProjectionMatrix()
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}

function resize() {
  if (!renderer || !camera || !canvasRef.value)
    return
  const w = canvasRef.value.clientWidth
  const h = canvasRef.value.clientHeight
  if (w === 0 || h === 0)
    return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function renderLoop() {
  rafHandle = requestAnimationFrame(renderLoop)
  const delta = clock.getDelta()

  if (props.paused || !renderer || !scene || !camera)
    return

  if (animation) {
    // One imperative step: animation mixer → IK → grant → physics.
    animation.update(delta)
    // Apply AIRI-owned morphs after the helper so lip-sync/expression win
    // over any VMD mouth/expression keyframes.
    emote?.update(delta)
    blink.update(morphs, delta)
    lipSync.update(morphs, delta)
    if (props.mouthOpenSize > 0 && !props.currentAudioSource) {
      morphs?.set('vowelA', props.mouthOpenSize * 0.7)
    }
    // Gaze rotates eye/head bones, also after the helper.
    gaze?.update(resolveGazeOffset(), delta)

    // Apply raw morph preview (settings panel)
    if (mesh?.morphTargetDictionary && mesh.morphTargetInfluences) {
      if (activePreviewMorph && activePreviewMorph !== props.previewExpression) {
        const idx = mesh.morphTargetDictionary[activePreviewMorph]
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = 0
        }
        activePreviewMorph = undefined
      }
      if (props.previewExpression) {
        const idx = mesh.morphTargetDictionary[props.previewExpression]
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = 1
          activePreviewMorph = props.previewExpression
        }
      }
    }
  }

  controls?.update()
  renderer.render(scene, camera)
}

function disposeModel() {
  if (animation) {
    animation.dispose()
    animation = undefined
  }
  if (modelGroup && scene) {
    scene.remove(modelGroup)
    modelGroup.traverse((obj) => {
      if (obj instanceof Mesh) {
        obj.geometry?.dispose?.()
        const material = obj.material
        if (Array.isArray(material))
          material.forEach(m => m.dispose())
        else
          material?.dispose?.()
      }
    })
  }
  resolved?.dispose()
  for (const url of localBlobUrls) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url)
      }
      catch {}
    }
  }
  localBlobUrls = []
  registeredMotions.clear()
  modelGroup = undefined
  mesh = undefined
  morphs = undefined
  emote = undefined
  gaze = undefined
  resolved = undefined
  activePreviewMorph = undefined
  activeFinishedListener = undefined
  mmdStore.isModelLoaded = false
}

/**
 * Returns the MMD-relevant names from the card's `idleAnimations` prop,
 * stripping foreign prefixes (live2d:, spine:) that don't apply here.
 */
function parseMmdCycleAnimations(): string[] {
  if (!props.idleAnimations || props.idleAnimations.length === 0)
    return []
  return props.idleAnimations.filter(
    key => !key.startsWith('live2d:') && !key.startsWith('spine:'),
  )
}

/**
 * Applies the card-level idle cycle to the animation manager.
 *
 * - 0 animations  → falls back to the store `idleMotionName` (single loop)
 * - 1 animation   → plays it on LoopRepeat (infinite loop)
 * - 2+ animations → plays each LoopOnce, then randomly picks the next,
 *                   avoiding the one that just finished when possible.
 */
function applyIdleCycle(): void {
  if (!animation)
    return

  const mixer = animation.getMixer()
  if (mixer && activeFinishedListener) {
    mixer.removeEventListener('finished', activeFinishedListener)
    activeFinishedListener = undefined
  }

  const cycle = parseMmdCycleAnimations().filter(name => registeredMotions.has(name))

  if (cycle.length === 0) {
    // No card-level cycle — honour the store's single idle motion.
    if (idleMotionName.value && registeredMotions.has(idleMotionName.value))
      animation.setIdleMotion(idleMotionName.value)
    return
  }

  if (cycle.length === 1) {
    // Single selection: loop it forever, same as before.
    animation.setIdleMotion(cycle[0])
    return
  }

  if (!mixer)
    return

  // Multiple selections: play one LoopOnce, advance randomly on finish.
  // We use playCycleAction (no auto-revert) so our cycle listener isn't
  // fighting the manager's built-in revertToIdleOnFinish handler.
  function playNext(avoidName?: string): void {
    if (!animation || !mixer)
      return
    const current = parseMmdCycleAnimations().filter(name => registeredMotions.has(name))
    if (current.length === 0)
      return

    const choices = avoidName && current.length > 1
      ? current.filter(n => n !== avoidName)
      : current
    const nextName = choices[Math.floor(Math.random() * choices.length)]

    // Play as LoopOnce — our finished listener will advance to the next clip.
    animation.playCycleAction(nextName, 0.6)

    // Register our own finished listener to advance the cycle.
    if (!cycleAdvancePending) {
      const onFinished = (e: { action: { getClip: () => { name: string } } }) => {
        if (e.action.getClip().name !== nextName)
          return
        mixer!.removeEventListener('finished', onFinished)
        if (activeFinishedListener === onFinished) {
          activeFinishedListener = undefined
        }
        if (!cycleAdvancePending) {
          cycleAdvancePending = true
          setTimeout(() => {
            cycleAdvancePending = false
            playNext(nextName)
          }, 0)
        }
      }
      activeFinishedListener = onFinished
      mixer.addEventListener('finished', onFinished)
    }
  }

  playNext()
}

/**
 * Loads and registers any imported VMD motions not yet bound to the current
 * model, then (re)applies the idle cycle. Safe to call repeatedly;
 * already-registered motions are skipped.
 */
async function syncMotions() {
  if (!animation || !mesh)
    return

  // Always use a fresh loader context per sync so a previously failed/stale
  // LoadingManager cannot poison subsequent loads.
  const loaderCtx = createMMDLoaderContext()

  for (const descriptor of allMotions.value) {
    if (registeredMotions.has(descriptor.name))
      continue
    let url = ''
    let isBlob = false
    try {
      if (descriptor.id.startsWith('mmd-motion-')) {
        const file = await mmdStore.getMotionFile(descriptor.id)
        if (!file) {
          console.warn(`[mmd] motion file "${descriptor.name}" (${descriptor.id}) not found in storage`)
          continue
        }
        url = URL.createObjectURL(file)
        isBlob = true
      }
      else {
        url = `/assets/mmd/animations/${descriptor.name}`
      }

      const clip = await loadMMDAnimationClip(loaderCtx.loader, url, mesh)
      animation.registerClip(descriptor.name, clip)
      registeredMotions.add(descriptor.name)
      if (clip.tracks.length === 0) {
        console.warn(
          `[mmd] motion "${descriptor.name}" loaded but has 0 tracks matching this model. `
          + 'The VMD\'s bone/morph names likely do not match the model (different rig/naming).',
        )
      }
    }
    catch (err) {
      console.error('[mmd] failed to load motion', descriptor.name, errorMessageFrom(err))
      // Do NOT emit 'error' for individual motion failures — one bad VMD should
      // never abort the whole load or surface as a model error to the parent.
    }
    finally {
      if (isBlob && url)
        URL.revokeObjectURL(url)
    }
  }

  applyIdleCycle()
}

async function loadModel(src: string) {
  if (!scene)
    return

  componentState.value = 'loading'
  disposeModel()

  try {
    const blobUrlsToDispose: string[] = []
    const resolvedTextureMap = new Map<string, string>()

    if (props.textureMap) {
      for (const [path, value] of props.textureMap.entries()) {
        const normPath = path.replace(/\\/g, '/').toLowerCase()
        if (typeof value === 'string') {
          resolvedTextureMap.set(normPath, value)
        }
        else if (value instanceof ImageBitmap) {
          const canvas = document.createElement('canvas')
          canvas.width = value.width
          canvas.height = value.height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(value, 0, 0)
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
            if (blob) {
              const u = URL.createObjectURL(blob)
              resolvedTextureMap.set(normPath, u)
              blobUrlsToDispose.push(u)
            }
          }
        }
      }
    }
    localBlobUrls = blobUrlsToDispose

    const byBasename = new Map<string, string>()
    for (const [path, url] of resolvedTextureMap.entries()) {
      const slash = path.lastIndexOf('/')
      const base = slash === -1 ? path : path.slice(slash + 1)
      byBasename.set(base, url)
    }

    const urlModifier = (requested: string) => {
      const clean = requested.split(/[?#]/)[0]
      let decoded = clean
      try {
        decoded = decodeURIComponent(clean)
      }
      catch {}

      const normalizedPath = decoded.replace(/\\/g, '/').toLowerCase()

      for (const [path, url] of resolvedTextureMap.entries()) {
        if (normalizedPath.endsWith(path))
          return url
      }

      const slash = normalizedPath.lastIndexOf('/')
      const base = slash === -1 ? normalizedPath : normalizedPath.slice(slash + 1)
      const matched = byBasename.get(base)
      if (matched)
        return matched

      return requested.replace(/\\/g, '/')
    }

    resolved = await loadMMDModelFromSource(src, { urlModifier })
    mesh = resolved.mesh

    modelGroup = new Group()
    modelGroup.add(mesh)
    applyTransform()
    scene.add(modelGroup)

    morphs = createMorphController(mesh, morphOverrides.value)
    mmdStore.availableMorphs = morphs.availableMorphs
    if (!morphs.resolvedSlots.some(slot => slot.startsWith('vowel'))) {
      console.warn(
        '[mmd] no vowel mouth morphs (あ/い/う/え/お) resolved; lip-sync cannot move the mouth. '
        + 'Available morphs:',
        morphs.availableMorphs,
      )
    }

    emote = useMMDEmote(morphs)
    gaze = createGazeController(mesh)

    animation = createMMDAnimationManager(mesh, { physicsEnabled: physicsEnabled.value })
    // No preset idle VMD ships yet; init with an empty clip so physics/IK run.
    await animation.init()
    animation.setIKEnabled(ikEnabled.value)
    animation.setGrantEnabled(grantEnabled.value)
    animation.setGravity(physicsGravity.value)

    // Ensure the camera aspect matches the live canvas before fitting.
    resize()
    frameCamera()
    applyMaterialGlow(albedoGlow.value)
    mmdStore.availableMaterials = collectMaterials()
    applyMaterialOpacity()

    mmdStore.isModelLoaded = true
    componentState.value = 'mounted'

    // Bind any motions imported before this model mounted.
    await syncMotions()
  }
  catch (err) {
    componentState.value = 'pending'
    console.error('[mmd] failed to load model:', errorMessageFrom(err))
    emit('error', err)
  }
}

/** Plays the gesture motion mapped to an emotion, if the model has one. */
function setEmotion(emotion: string, intensity = 1) {
  const value = EMOTION_VALUES.includes(emotion as Emotion) ? emotion as Emotion : Emotion.Neutral
  emote?.setEmotion(value, intensity)

  const actionName = emotionActionMap.value[value]
  if (actionName)
    animation?.playAction(actionName, { loop: false })
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  setupScene()
  resizeObserver = new ResizeObserver(() => resize())
  if (canvasRef.value)
    resizeObserver.observe(canvasRef.value)
  resize()
  clock.start()
  renderLoop()

  if (props.modelSrc)
    loadModel(props.modelSrc)
})

onUnmounted(() => {
  cancelAnimationFrame(rafHandle)
  resizeObserver?.disconnect()
  disposeModel()
  controls?.dispose()
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
  }
  scene = undefined
  camera = undefined
  renderer = undefined
  controls = undefined
  ambientLight = undefined
  directionalLight = undefined
})

watch(() => props.modelSrc, (src) => {
  if (src)
    loadModel(src)
  else
    disposeModel()
})

watch(isOrbitControlsEnabled, (enabled) => {
  if (controls)
    controls.enabled = enabled
})

// View transform sliders.
watch([computedScale, rotationY, computedPositionX, computedPositionY], () => applyTransform())

// Solver/physics toggles.
watch(physicsEnabled, v => animation?.setPhysicsEnabled(v))
watch(ikEnabled, v => animation?.setIKEnabled(v))
watch(grantEnabled, v => animation?.setGrantEnabled(v))
watch(physicsGravity, v => animation?.setGravity(v))

// Morph-slot overrides: rebind each slot the user remapped (empty = auto).
watch(morphOverrides, (overrides) => {
  if (!morphs)
    return
  for (const [slot, name] of Object.entries(overrides))
    morphs.override(slot as Parameters<MorphController['override']>[0], (name as string) ?? '')
}, { deep: true })

// One-shot motion requests from tools/the act bus.
watch(oneShotAction, (request) => {
  if (request)
    animation?.playAction(request.name, { loop: request.loop })
})

// Newly imported VMD motions: load and register them against the live model.
watch(allMotions, () => {
  void syncMotions()
}, { deep: true })

// Idle-motion selection from the settings panel (store fallback when no card cycle).
watch(idleMotionName, () => {
  applyIdleCycle()
})

// Card-level idle cycle changes (Acting tab selections).
watch(() => props.idleAnimations, () => {
  // Reset cycle state so the new selection starts fresh.
  cycleAdvancePending = false
  applyIdleCycle()
}, { deep: true })

// Scene settings — lighting.
watch([ambientColor, ambientIntensity], () => {
  if (!ambientLight)
    return
  ambientLight.color.set(normalizeHex(ambientColor.value))
  ambientLight.intensity = ambientIntensity.value
})
watch([directionalColor, directionalIntensity], () => {
  if (!directionalLight)
    return
  directionalLight.color.set(normalizeHex(directionalColor.value))
  directionalLight.intensity = directionalIntensity.value
})
watch(directionalPosition, () => {
  directionalLight?.position.set(directionalPosition.value.x, directionalPosition.value.y, directionalPosition.value.z)
}, { deep: true })

// Scene settings — camera & rendering.
watch(cameraFov, () => {
  if (!camera)
    return
  camera.fov = cameraFov.value
  camera.updateProjectionMatrix()
})
watch(renderScale, () => {
  renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 2) * renderScale.value)
  resize()
})
watch(albedoGlow, () => applyMaterialGlow(albedoGlow.value))
watch(materialOpacity, () => applyMaterialOpacity(), { deep: true })

defineExpose({
  canvasElement,
  captureFrame,
  setEmotion,
  listMorphs: () => morphs?.availableMorphs ?? [],
  listMotions: () => animation?.availableClips() ?? [],
  getHeadPose: () => {
    if (!mesh || !camera || !canvasRef.value)
      return null

    // Find MMD head bone (standard MMD PMX/PMD rig: '頭' or English 'head')
    const headBone = mesh.skeleton?.bones?.find(
      b => b.name === '頭' || b.name.toLowerCase() === 'head',
    )
    if (!headBone)
      return null

    const worldPos = new Vector3()
    const worldQuat = new Quaternion()
    headBone.getWorldPosition(worldPos)
    headBone.getWorldQuaternion(worldQuat)

    // Project head top anchor (offset along head's local up vector so hair/hat are cleared)
    const headUp = new Vector3(0, 1, 0).applyQuaternion(worldQuat)
    const headTopPos = worldPos.clone().addScaledVector(headUp, 2.0)
    const ndc = headTopPos.project(camera)

    const rect = canvasRef.value.getBoundingClientRect()
    const screenX = ((ndc.x + 1) / 2) * rect.width
    const screenY = ((-ndc.y + 1) / 2) * rect.height

    // Calculate approximate screen model height (head to hips/center)
    const hipsBone = mesh.skeleton?.bones?.find(
      b => b.name === 'センター' || b.name === '下半身' || b.name.toLowerCase().includes('hip'),
    )
    let modelHeightPx = rect.height * 0.5
    if (hipsBone) {
      const hipsPos = new Vector3()
      hipsBone.getWorldPosition(hipsPos)
      const hipsNdc = hipsPos.clone().project(camera)
      const hipsScreenY = ((-hipsNdc.y + 1) / 2) * rect.height
      modelHeightPx = Math.max(120, Math.abs(hipsScreenY - screenY) * 2.2)
    }

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
</script>

<template>
  <Screen
    relative
    :class="(props.interactionMode === 'drag' || props.interactionMode === 'positioning') ? (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
    @pointercancel="handlePointerUp"
    @dragstart.prevent
  >
    <canvas ref="canvasRef" h-full w-full />
  </Screen>
</template>
