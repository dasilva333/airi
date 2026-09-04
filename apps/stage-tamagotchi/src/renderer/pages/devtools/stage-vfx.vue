<script setup lang="ts">
import type { VRM } from '@pixiv/three-vrm'
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'
import type { AnimationAction } from 'three'

import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { animations } from '@proj-airi/stage-ui-three/assets/vrm'
import {
  clipFromVRMAnimation,
  loadVRMAnimation,
  reAnchorRootPositionTrack,
} from '@proj-airi/stage-ui-three/composables/vrm'
import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import {
  AuraController,
  frame,
  VrmSocketResolver,
} from '@proj-airi/stage-ui/libs/vfx'
import {
  DisplayModelFormat,
  useDisplayModelsStore,
} from '@proj-airi/stage-ui/stores/display-models'
import { useRafFn } from '@vueuse/core'
import {
  AmbientLight,

  AnimationMixer,
  Color,
  DirectionalLight,
  GridHelper,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'

const displayModelsStore = useDisplayModelsStore()

// Viewport & Three.js references
const containerRef = ref<HTMLDivElement>()
let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let gridHelper: GridHelper | null = null

// Avatar & VFX engine
let activeVrm: VRM | null = null
const socketResolver = shallowRef<VrmSocketResolver | null>(null)
const auraController = shallowRef<AuraController | null>(null)

// Animation & Motion State
let animationMixer: AnimationMixer | null = null
let currentAction: AnimationAction | null = null
const idleMotionEnabled = ref(true)

// UI State
const modelSelectorOpen = ref(false)
const selectedModelId = ref<string>('')
const loadingModel = ref(false)
const modelError = ref('')
const debugSocketsEnabled = ref(true)
const timeScale = ref(1.0)
const lastFrameTime = ref(performance.now())

// Socket debug meshes (green wireframe spheres)
const socketGizmos = new Map<string, Mesh>()

// Simulated ACT Token state
const actTokenInput = ref('<|ACT:emotion="angry"|>')
const tokenLogs = ref<{ text: string, time: string }[]>([])

// Parameter bindings & continuous loop states
const keepFireActive = ref(false)
const keepElectricActive = ref(false)
const keepMagicActive = ref(false)

const flameHeight = ref(0.62)
const flameCoreColor = ref('#FFF2BF')
const flameColor = ref('#FF7314')
const electricVeinColor = ref('#4A92FF')
const magicCoreColor = ref('#FFDCFF')

const availableSockets = computed(() => {
  return socketResolver.value?.getAvailableSockets() || []
})

const currentModelName = computed(() => {
  if (loadingModel.value)
    return 'Loading model...'
  if (selectedModelId.value) {
    const found = displayModelsStore.displayModels.find(m => m.id === selectedModelId.value)
    if (found)
      return found.name
  }
  if (socketResolver.value)
    return 'Default VRM Mannequin'
  return 'No Avatar Loaded'
})

// Setup 3D Scene
function initScene() {
  if (!containerRef.value)
    return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new Scene()
  scene.background = new Color(0x0A0A0C)

  camera = new PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.set(0, 1.2, 3.2)

  renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.target.set(0, 0.9, 0)
  controls.update()

  // Lighting
  const ambient = new AmbientLight(0xFFFFFF, 0.8)
  scene.add(ambient)

  const dirLight = new DirectionalLight(0xFFF5E6, 1.6)
  dirLight.position.set(2, 4, 3)
  scene.add(dirLight)

  const rimLight = new DirectionalLight(0x6688FF, 0.6)
  rimLight.position.set(-2, 3, -2)
  scene.add(rimLight)

  // Ground Grid
  gridHelper = new GridHelper(10, 20, 0x334155, 0x1E293B)
  gridHelper.position.y = 0
  scene.add(gridHelper)

  // Initialize Aura Controller
  auraController.value = new AuraController({ scene })

  // Resize listener
  window.addEventListener('resize', handleResize)

  // Load initial fallback/active model
  void loadInitialAvatar()
}

function handleResize() {
  if (!containerRef.value || !renderer || !camera)
    return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

// Build socket debug gizmos
function createSocketGizmo(): Mesh {
  const geom = new SphereGeometry(0.035, 12, 8)
  const mat = new MeshBasicMaterial({
    color: 0x22C55E,
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  })
  return new Mesh(geom, mat)
}

function updateSocketGizmos() {
  if (!scene || !socketResolver.value)
    return

  const sockets = socketResolver.value.getAvailableSockets()
  for (const s of sockets) {
    if (!socketGizmos.has(s)) {
      const gizmo = createSocketGizmo()
      gizmo.name = `Gizmo:${s}`
      scene.add(gizmo)
      socketGizmos.set(s, gizmo)
    }

    const mesh = socketGizmos.get(s)!
    mesh.visible = debugSocketsEnabled.value

    if (debugSocketsEnabled.value) {
      const tf = socketResolver.value.getWorldTransform(s)
      if (tf)
        mesh.position.copy(tf.position)
    }
  }
}

// Model Loading
async function loadVRMFromUrl(url: string) {
  loadingModel.value = true
  modelError.value = ''

  try {
    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))

    const gltf = await loader.loadAsync(url)
    const vrm = gltf.userData.vrm as VRM

    if (!vrm)
      throw new Error('GLTF loaded, but no VRM instance found in userData.')

    // Stop and clear previous animation mixer
    if (animationMixer) {
      animationMixer.stopAllAction()
      animationMixer = null
      currentAction = null
    }

    // Cleanup previous model
    if (activeVrm && scene) {
      scene.remove(activeVrm.scene)
    }

    activeVrm = vrm
    vrm.scene.rotation.y = Math.PI // Face camera
    scene?.add(vrm.scene)

    // Wire universal socket resolver
    socketResolver.value = new VrmSocketResolver(vrm)
    auraController.value?.setResolver(socketResolver.value)

    // Start idle motion
    await playIdleAnimation(vrm)

    loadingModel.value = false
  }
  catch (err: any) {
    loadingModel.value = false
    modelError.value = err?.message || 'Failed to load VRM model'
  }
}

async function playIdleAnimation(vrm: VRM) {
  if (!vrm)
    return
  try {
    animationMixer = new AnimationMixer(vrm.scene)
    const animData = await loadVRMAnimation(animations.idleLoop)
    if (!animData)
      return
    const clip = await clipFromVRMAnimation(vrm, animData)
    if (!clip)
      return

    reAnchorRootPositionTrack(clip, vrm)
    clip.tracks = clip.tracks.filter(
      track => !track.name.includes('blendShapes') && !track.name.includes('expressions'),
    )

    const action = animationMixer.clipAction(clip)
    action.setLoop(LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.reset()
    action.setEffectiveWeight(1)
    if (idleMotionEnabled.value) {
      action.play()
    }
    currentAction = action
  }
  catch (err) {
    console.warn('[StageVFX] Failed to load idle animation, falling back to static pose:', err)
  }
}

function toggleIdleMotion() {
  idleMotionEnabled.value = !idleMotionEnabled.value
  if (!currentAction)
    return
  if (idleMotionEnabled.value) {
    currentAction.reset()
    currentAction.play()
  }
  else {
    currentAction.stop()
    if (activeVrm?.humanoid) {
      activeVrm.humanoid.resetNormalizedPose()
    }
  }
}

async function loadInitialAvatar() {
  // Try to find an existing VRM in the displayModelsStore
  const vrmModel = displayModelsStore.displayModels.find(m => m.format === DisplayModelFormat.VRM)
  if (vrmModel) {
    selectedModelId.value = vrmModel.id
    try {
      const full = await displayModelsStore.getDisplayModel(vrmModel.id)
      if (full) {
        if (full.type === 'file' && full.file) {
          const url = URL.createObjectURL(full.file)
          await loadVRMFromUrl(url)
          return
        }
        else if (full.type === 'url' && full.url) {
          await loadVRMFromUrl(full.url)
          return
        }
      }
    }
    catch {
      // Fallback
    }
  }

  // Create procedural stick avatar if no VRM is available
  createProceduralStickAvatar()
}

function createProceduralStickAvatar() {
  // Minimal procedural humanoid placeholder
  const placeholder = new Scene()
  const mat = new MeshBasicMaterial({ color: 0x475569, wireframe: true })

  const torso = new Mesh(new SphereGeometry(0.2, 8, 8), mat)
  torso.position.y = 1.0
  placeholder.add(torso)

  const head = new Mesh(new SphereGeometry(0.12, 8, 8), mat)
  head.position.y = 1.45
  placeholder.add(head)

  scene?.add(placeholder)
}

async function handleModelPick(model: DisplayModel | undefined) {
  modelSelectorOpen.value = false
  if (!model)
    return
  selectedModelId.value = model.id
  try {
    const full = await displayModelsStore.getDisplayModel(model.id)
    if (full) {
      if (full.type === 'file' && full.file) {
        const url = URL.createObjectURL(full.file)
        await loadVRMFromUrl(url)
      }
      else if (full.type === 'url' && full.url) {
        await loadVRMFromUrl(full.url)
      }
    }
  }
  catch (err: any) {
    modelError.value = err?.message || 'Failed to load picked model'
  }
}

// Render loop via useRafFn
useRafFn(() => {
  const now = performance.now()
  const dt = Math.min((now - lastFrameTime.value) / 1000, 0.1) * timeScale.value
  lastFrameTime.value = now

  if (animationMixer && idleMotionEnabled.value)
    animationMixer.update(dt)

  if (activeVrm)
    activeVrm.update(dt)

  // Update Frame Uniforms
  frame.uTime.value += dt
  frame.uDelta.value = dt

  // Update Aura Controller
  if (auraController.value) {
    // Sync live sliders & continuous loop toggles
    const ac = auraController.value
    ac.state.fire.keepActive = keepFireActive.value
    ac.state.fire.flameHeight = flameHeight.value
    ac.state.fire.palette.core = flameCoreColor.value
    ac.state.fire.palette.flame = flameColor.value

    ac.state.electric.keepActive = keepElectricActive.value
    ac.state.electric.palette.vein = electricVeinColor.value

    ac.state.magic.keepActive = keepMagicActive.value
    ac.state.magic.palette.core = magicCoreColor.value

    ac.update(dt)
  }

  // Update Socket Debug Spheres
  updateSocketGizmos()

  controls?.update()
  if (renderer && scene && camera)
    renderer.render(scene, camera)
})

// Aura triggers
function triggerAura(type: 'fire' | 'electric' | 'magic', duration = 5.0) {
  auraController.value?.triggerAura(type, duration)
}

function stopAura(type: 'fire' | 'electric' | 'magic') {
  auraController.value?.stopAura(type)
}

// ACT Token Simulator
function dispatchActToken(token: string) {
  const lower = token.toLowerCase()
  const timeStr = new Date().toLocaleTimeString()

  tokenLogs.value.unshift({ text: token, time: timeStr })
  if (tokenLogs.value.length > 8)
    tokenLogs.value.pop()

  if (lower.includes('angry') || lower.includes('flustered') || lower.includes('fire')) {
    triggerAura('fire', 6.0)
  }
  else if (lower.includes('excited') || lower.includes('focused') || lower.includes('electric')) {
    triggerAura('electric', 5.0)
  }
  else if (lower.includes('loving') || lower.includes('blushing') || lower.includes('magic')) {
    triggerAura('magic', 7.0)
  }
}

onMounted(() => {
  initScene()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationMixer) {
    animationMixer.stopAllAction()
    animationMixer = null
    currentAction = null
  }
  auraController.value?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans">
    <!-- Header -->
    <header class="flex items-center gap-3 border-b border-neutral-800/80 bg-neutral-900/50 px-4 py-2.5 backdrop-blur-md">
      <div class="flex items-center gap-2">
        <div class="i-solar:flame-bold-duotone size-5 text-orange-400" />
        <h1 class="text-sm text-neutral-100 font-bold tracking-wide">
          Stage VFX & Elemental Abilities Playground
        </h1>
      </div>
      <span class="rounded bg-primary-500/15 px-2 py-0.5 text-xs text-primary-300 font-mono">
        sandboxed · vrm & mmd socket harness
      </span>
      <div class="ml-auto flex items-center gap-3">
        <span class="text-xs text-neutral-400">
          Model: <span class="text-neutral-200 font-semibold">{{ currentModelName }}</span>
        </span>
        <button
          class="border border-neutral-700 rounded-lg bg-neutral-800/80 px-2.5 py-1 text-xs text-neutral-200 transition-colors hover:bg-neutral-700"
          @click="modelSelectorOpen = true"
        >
          Select Avatar
        </button>
      </div>
    </header>

    <!-- Main Workspace -->
    <div class="grid grid-cols-1 min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
      <!-- 3D Canvas Viewport -->
      <div class="relative h-full w-full overflow-hidden from-neutral-950 to-neutral-900 bg-gradient-to-b">
        <div ref="containerRef" class="h-full w-full" />

        <!-- Viewport HUD Overlay -->
        <div class="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-xs text-neutral-400 font-mono">
          <div class="flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 backdrop-blur">
            <div class="size-2 animate-pulse rounded-full bg-green-500" />
            <span>60 FPS · Three.js GLSL Sandbox</span>
          </div>
          <div class="rounded-md bg-black/40 px-2 py-0.5 text-[11px] text-neutral-500">
            Right Drag: Orbit · Scroll: Zoom
          </div>
        </div>

        <!-- Time & Motion Controls (Bottom Left) -->
        <div class="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 border border-neutral-800 rounded-lg bg-neutral-900/80 p-1 text-xs backdrop-blur-md">
          <span class="px-2 text-neutral-400 font-mono">Speed:</span>
          <button
            class="rounded px-2 py-0.5 transition-colors"
            :class="timeScale === 0 ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-300 hover:bg-neutral-800'"
            @click="timeScale = 0"
          >
            Pause (0x)
          </button>
          <button
            class="rounded px-2 py-0.5 transition-colors"
            :class="timeScale === 0.2 ? 'bg-primary-500/20 text-primary-300' : 'text-neutral-300 hover:bg-neutral-800'"
            @click="timeScale = 0.2"
          >
            Slomo (0.2x)
          </button>
          <button
            class="rounded px-2 py-0.5 transition-colors"
            :class="timeScale === 1.0 ? 'bg-primary-500/20 text-primary-300' : 'text-neutral-300 hover:bg-neutral-800'"
            @click="timeScale = 1.0"
          >
            Realtime (1x)
          </button>

          <div class="mx-1 h-3 w-px bg-neutral-700" />

          <button
            class="flex items-center gap-1 rounded px-2.5 py-0.5 transition-colors"
            :class="idleMotionEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'"
            @click="toggleIdleMotion"
          >
            <div :class="idleMotionEnabled ? 'i-solar:running-round-bold' : 'i-solar:accessibility-bold'" class="size-3.5" />
            <span>{{ idleMotionEnabled ? 'Idle Breathing (Motion)' : 'T-Pose (Rest)' }}</span>
          </button>
        </div>

        <!-- Error Toast -->
        <div v-if="modelError" class="absolute bottom-14 left-3 border border-red-500/30 rounded-lg bg-red-950/80 p-3 text-xs text-red-300 backdrop-blur">
          {{ modelError }}
        </div>
      </div>

      <!-- Right Inspector Sidebar -->
      <aside class="flex flex-col gap-4 overflow-y-auto border-l border-neutral-800/80 bg-neutral-900/60 p-4 backdrop-blur-lg">
        <!-- Section: Sockets & Rigging -->
        <div class="border border-neutral-800 rounded-xl bg-neutral-950/50 p-3.5">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="flex items-center gap-1.5 text-xs text-neutral-300 font-bold tracking-wider uppercase">
              <div class="i-solar:bone-bold-duotone size-4 text-emerald-400" />
              <span>Universal Sockets</span>
            </h2>
            <label class="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400">
              <input v-model="debugSocketsEnabled" type="checkbox" class="rounded accent-emerald-500">
              <span>Gizmos</span>
            </label>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="socket in availableSockets"
              :key="socket"
              class="border border-emerald-500/20 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 font-mono"
            >
              {{ socket }}
            </span>
            <span v-if="availableSockets.length === 0" class="text-xs text-neutral-500 italic">
              No sockets bound yet
            </span>
          </div>
        </div>

        <!-- Section: Bone-Tethered Character Auras -->
        <div class="flex flex-col gap-3 border border-neutral-800 rounded-xl bg-neutral-950/50 p-3.5">
          <h2 class="flex items-center gap-1.5 text-xs text-neutral-300 font-bold tracking-wider uppercase">
            <div class="i-solar:fire-bold-duotone size-4 text-orange-400" />
            <span>Procedural Auras & Ground Effects</span>
          </h2>

          <!-- Fire Boost -->
          <div class="flex flex-col gap-2 border border-orange-500/20 rounded-lg bg-orange-950/15 p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-orange-200 font-semibold">🔥 Fire Boost (Tongues, Embers & Burn Ground)</span>
              <div class="flex items-center gap-2">
                <label class="flex cursor-pointer items-center gap-1 text-[11px] text-orange-300/90">
                  <input v-model="keepFireActive" type="checkbox" class="rounded accent-orange-500">
                  <span>Keep Active</span>
                </label>
                <div class="flex gap-1">
                  <button
                    class="rounded bg-orange-600/80 px-2.5 py-1 text-xs text-white font-medium transition-colors hover:bg-orange-500"
                    @click="triggerAura('fire', 6.0)"
                  >
                    Ignite
                  </button>
                  <button
                    class="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                    @click="stopAura('fire')"
                  >
                    Cut
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-1 text-[11px] text-neutral-400">
              <label class="flex flex-col gap-1">
                <span>Height ({{ flameHeight }}m)</span>
                <input v-model.number="flameHeight" type="range" min="0.2" max="1.5" step="0.05" class="accent-orange-500">
              </label>
              <label class="flex flex-col gap-1">
                <span>Core Color</span>
                <input v-model="flameCoreColor" type="color" class="h-6 w-full cursor-pointer border-0 rounded bg-neutral-800">
              </label>
              <label class="flex flex-col gap-1">
                <span>Flame Color</span>
                <input v-model="flameColor" type="color" class="h-6 w-full cursor-pointer border-0 rounded bg-neutral-800">
              </label>
            </div>
          </div>

          <!-- Electric Boost -->
          <div class="flex flex-col gap-2 border border-sky-500/20 rounded-lg bg-sky-950/15 p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-sky-200 font-semibold">⚡ Electric Boost (Fresnel Rim, Sparks & Surge Ring)</span>
              <div class="flex items-center gap-2">
                <label class="flex cursor-pointer items-center gap-1 text-[11px] text-sky-300/90">
                  <input v-model="keepElectricActive" type="checkbox" class="rounded accent-sky-500">
                  <span>Keep Active</span>
                </label>
                <div class="flex gap-1">
                  <button
                    class="rounded bg-sky-600/80 px-2.5 py-1 text-xs text-white font-medium transition-colors hover:bg-sky-500"
                    @click="triggerAura('electric', 5.0)"
                  >
                    Surge
                  </button>
                  <button
                    class="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                    @click="stopAura('electric')"
                  >
                    Cut
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-neutral-400">
              <label class="flex flex-col gap-1">
                <span>Vein Color</span>
                <input v-model="electricVeinColor" type="color" class="h-6 w-full cursor-pointer border-0 rounded bg-neutral-800">
              </label>
            </div>
          </div>

          <!-- Magic Boost -->
          <div class="flex flex-col gap-2 border border-purple-500/20 rounded-lg bg-purple-950/15 p-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-purple-200 font-semibold">✨ Magic Boost (Helical Ribbons & Rune Seal)</span>
              <div class="flex items-center gap-2">
                <label class="flex cursor-pointer items-center gap-1 text-[11px] text-purple-300/90">
                  <input v-model="keepMagicActive" type="checkbox" class="rounded accent-purple-500">
                  <span>Keep Active</span>
                </label>
                <div class="flex gap-1">
                  <button
                    class="rounded bg-purple-600/80 px-2.5 py-1 text-xs text-white font-medium transition-colors hover:bg-purple-500"
                    @click="triggerAura('magic', 7.0)"
                  >
                    Cast
                  </button>
                  <button
                    class="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
                    @click="stopAura('magic')"
                  >
                    Cut
                  </button>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] text-neutral-400">
              <label class="flex flex-col gap-1">
                <span>Core Color</span>
                <input v-model="magicCoreColor" type="color" class="h-6 w-full cursor-pointer border-0 rounded bg-neutral-800">
              </label>
            </div>
          </div>
        </div>

        <!-- Section: ACT Token Simulator -->
        <div class="flex flex-col gap-2.5 border border-neutral-800 rounded-xl bg-neutral-950/50 p-3.5">
          <h2 class="flex items-center gap-1.5 text-xs text-neutral-300 font-bold tracking-wider uppercase">
            <div class="i-solar:chat-round-line-bold-duotone size-4 text-amber-400" />
            <span>ACT Token Simulator</span>
          </h2>
          <p class="text-[11px] text-neutral-400">
            Simulate cue execution from LLM streaming responses:
          </p>

          <div class="flex gap-1.5">
            <input
              v-model="actTokenInput"
              type="text"
              class="flex-1 border border-neutral-700 rounded bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 font-mono focus:border-primary-500 focus:outline-none"
              placeholder="<|ACT:emotion=...|>"
            >
            <button
              class="rounded bg-primary-600 px-3 py-1.5 text-xs text-white font-semibold hover:bg-primary-500"
              @click="dispatchActToken(actTokenInput)"
            >
              Send
            </button>
          </div>

          <!-- Quick Tokens -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            <button
              class="border border-orange-500/30 rounded bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-300 hover:bg-orange-500/20"
              @click="dispatchActToken('<|ACT:emotion=\&quot;angry\&quot;|>')"
            >
              🔥 angry
            </button>
            <button
              class="border border-sky-500/30 rounded bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-300 hover:bg-sky-500/20"
              @click="dispatchActToken('<|ACT:emotion=\&quot;excited\&quot;|>')"
            >
              ⚡ excited
            </button>
            <button
              class="border border-purple-500/30 rounded bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-300 hover:bg-purple-500/20"
              @click="dispatchActToken('<|ACT:emotion=\&quot;loving\&quot;|>')"
            >
              🌸 loving
            </button>
          </div>

          <!-- Dispatch Log -->
          <div v-if="tokenLogs.length > 0" class="mt-2 flex flex-col gap-1 border-t border-neutral-800/80 pt-2 text-[10px] font-mono">
            <div v-for="(l, idx) in tokenLogs" :key="idx" class="flex items-center justify-between text-neutral-400">
              <span class="truncate text-neutral-200">{{ l.text }}</span>
              <span class="text-neutral-500">{{ l.time }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Model Selector Dialog -->
    <ModelSelectorDialog
      v-model:show="modelSelectorOpen"
      @pick="handleModelPick"
    />
  </div>
</template>
