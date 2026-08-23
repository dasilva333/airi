<script setup lang="ts">
import type { Application } from '@pixi/app'

import type { PixiLive2DInternalModel } from '../../../composables/live2d'

import JSZip from 'jszip'

import { DSLVirtualMachine } from '@proj-airi/live2d-runtime'
import { listenBeatSyncBeatSignal } from '@proj-airi/stage-shared/beat-sync'
import { useTheme } from '@proj-airi/ui'
import { breakpointsTailwind, until, useBreakpoints, useBroadcastChannel, useDebounceFn } from '@vueuse/core'
import { formatHex } from 'culori'
import { Mutex } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { DropShadowFilter } from 'pixi-filters'
import { config, Live2DFactory, Live2DModel, MotionPriority } from 'pixi-live2d-display/cubism4'
import { computed, onMounted, onUnmounted, ref, shallowRef, toRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import {
  createBeatSyncController,

  hookArtMeshColorsAfterModelUpdate,
  useLive2DMotionManagerUpdate,
  useMotionUpdatePluginAutoEyeBlink,
  useMotionUpdatePluginBeatSync,
  useMotionUpdatePluginIdleDisable,
  useMotionUpdatePluginIdleFocus,
  useMotionUpdatePluginMouseFocus,
} from '../../../composables/live2d'
import { Emotion, EmotionNeutralMotionName } from '../../../constants/emotions'
import { consumePendingDslGroups } from '../../../runtime/dsl-capture'
import { buildAdapterPorts, Live2DRuntimeAdapter } from '../../../runtime/live2d-runtime-adapter'
import { DSL_INTIMACY_MAX, useDslIntimacyStore } from '../../../stores/dsl-intimacy'
import { useLive2d } from '../../../stores/live2d'
import { setOnZipLoaded } from '../../../utils/live2d-zip-loader'
import { OPFSCacheV2 } from '../../../utils/opfs-loader'
import { extractArtMeshColorsFromVTube, listVTubeColorRelatedKeys } from '../../../utils/vtube-artmesh-colors'

const props = withDefaults(defineProps<{
  modelSrc?: string
  modelId?: string
  modelFile?: File

  app?: Application
  mouthOpenSize?: number
  width: number
  height: number
  paused?: boolean
  focusAt?: { x: number, y: number }
  disableFocusAt?: boolean
  followSpeed?: number
  xOffset?: number | string
  yOffset?: number | string
  scale?: number
  themeColorsHue?: number
  themeColorsHueDynamic?: boolean
  live2dIdleAnimationEnabled?: boolean
  live2dAutoBlinkEnabled?: boolean
  live2dForceAutoBlinkEnabled?: boolean
  live2dShadowEnabled?: boolean
  idleAnimations?: string[]
  interactionMode?: 'orbit' | 'tactile'
}>(), {
  mouthOpenSize: 0,
  paused: false,
  focusAt: () => ({ x: 0, y: 0 }),
  disableFocusAt: false,
  followSpeed: 0.5,
  scale: 1,
  themeColorsHue: 220.44,
  themeColorsHueDynamic: false,
  live2dIdleAnimationEnabled: true,
  live2dAutoBlinkEnabled: true,
  live2dForceAutoBlinkEnabled: false,
  live2dShadowEnabled: true,
  idleAnimations: () => [],
  interactionMode: 'tactile',
})

const emits = defineEmits<{
  (e: 'modelLoaded'): void
  (e: 'error', error: Error): void
  (e: 'hitAreaHover', value: { name: string, x: number, y: number, hovered: boolean } | null): void
}>()

// Global Model Access for LHacker
setOnZipLoaded((buffer) => {
  (window as any).__LHACK_LAST_ZIP_BUFFER__ = buffer
})

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

function parsePropsOffset() {
  let xOffset = Number.parseFloat(String(props.xOffset)) || 0
  let yOffset = Number.parseFloat(String(props.yOffset)) || 0

  if (String(props.xOffset).endsWith('%')) {
    xOffset = (Number.parseFloat(String(props.xOffset).replace('%', '')) / 100) * props.width
  }
  if (String(props.yOffset).endsWith('%')) {
    yOffset = (Number.parseFloat(String(props.yOffset).replace('%', '')) / 100) * props.height
  }

  return {
    xOffset,
    yOffset,
  }
}

function showHtml5Notification(title: string, body: string) {
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, silent: true })
      }
      else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(title, { body, silent: true })
          }
        })
      }
    }
  }
  catch (e) {
    console.warn('[Live2D Notification] Failed to show web notification:', e)
  }
}

const modelSrcRef = toRef(() => props.modelSrc)

const modelLoading = ref(false)
// NOTICE: boolean is sufficient; this flag is only used inside loadModel to bail out if the component unmounts mid-load.
let isUnmounted = false

const modelLoadMutex = new Mutex()

// --- Live2D DSL runtime (additive; never alters existing Cubism behavior) ---
let dslVM: DSLVirtualMachine | null = null
let dslAdapter: Live2DRuntimeAdapter | null = null

function disposeDslRuntime() {
  dslAdapter?.setOnMotionGroupEnabledChange(null)
  dslAdapter?.dispose()
  dslAdapter = null
  dslVM = null
}

/**
 * Whether a DSL `motions disable <group>` gate currently blocks this motion. DSL pool names
 * don't always equal the physical motion group (e.g. `Leave60_70_80` drives the `Idle` pool),
 * so we honor both the exact group and the model's idle-group alias.
 */
function dslMotionGroupBlocked(group: string, index: number): boolean {
  if (!dslAdapter)
    return false
  if (dslAdapter.isMotionGroupEnabled(group) === false)
    return true
  const internalModel = model.value?.internalModel as any
  const idlePhysical = internalModel?.motionManager?.groups?.idle as string | undefined
  const isIdleLike = (!!idlePhysical && group === idlePhysical) || isConfiguredIdleMotion(group, index)
  return !!idlePhysical && isIdleLike && dslAdapter.isMotionGroupEnabled(idlePhysical) === false
}

const offset = computed(() => parsePropsOffset())

const pixiApp = toRef(() => props.app)
const paused = toRef(() => props.paused)
const live2dStore = useLive2d()
const { post: postCaption } = useBroadcastChannel<any, any>({ name: 'airi-caption-overlay' })
const { model } = storeToRefs(live2dStore)

const initialModelWidth = ref<number>(0)
const initialModelHeight = ref<number>(0)
const mouthOpenSize = computed(() => Math.max(0, Math.min(100, props.mouthOpenSize)))
const lastUpdateTime = ref(0)
const artMeshColors = ref<Record<string, string>>({})
const neutralParameterBaseline = ref<number[]>([])
const settledIdleParameterBaseline = ref<number[]>([])

enum Live2DMotionPlaybackContext {
  // The user is inspecting the raw motion in settings, so favor literal playback.
  SettingsPreview = 'settings-preview',
  // The model is on stage or actor route, where idle should feel like a settled living pose.
  StageIdle = 'stage-idle',
  // A tactile/tap reaction should interrupt immediately, then hand control back to idle.
  StageReaction = 'stage-reaction',
  // Fallback for regular programmatic motion starts.
  Direct = 'direct',
}

enum Live2DMotionPlaybackPolicy {
  // Honor the model author metadata as directly as possible.
  LiteralPreview = 'literal-preview',
  // Treat short looping idle files as settle-into-idle motions, then let blink/breath/physics live.
  NaturalIdleSettle = 'natural-idle-settle',
  // Play a reaction immediately without treating it as the standing idle baseline.
  ReactionThenIdle = 'reaction-then-idle',
}

function selectedRuntimeMotionKey(suffix: 'group' | 'index') {
  return `live2d-${props.modelId || 'global'}-selected-motion-${suffix}`
}

function getSelectedRuntimeMotion() {
  const group = localStorage.getItem(selectedRuntimeMotionKey('group'))
    ?? localStorage.getItem('selected-runtime-motion-group')
  const index = localStorage.getItem(selectedRuntimeMotionKey('index'))
    ?? localStorage.getItem('selected-runtime-motion-index')

  if (group === null || index === null)
    return null

  const parsedIndex = Number.parseInt(index)
  if (Number.isNaN(parsedIndex))
    return null

  return { group, index: parsedIndex }
}

function parseCycleMotions(idleAnimations: string[] | undefined) {
  return idleAnimations
    ?.filter(k => k.startsWith('live2d:'))
    .map((k) => {
      const [_, group, indexStr] = k.split(':')
      return {
        group,
        index: Number.parseInt(indexStr),
      }
    })
    .filter(m => m.group && !Number.isNaN(m.index)) || []
}

function getRouteHash() {
  return window.location.hash || '#/'
}

function isStageRoute() {
  const hash = getRouteHash()
  return hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')
}

function isSettingsRoute() {
  return getRouteHash().startsWith('#/settings')
}

function isConfiguredIdleMotion(group: string, index: number) {
  const cycleMotions = parseCycleMotions(props.idleAnimations)
  if (cycleMotions.some(m => m.group === group && m.index === index))
    return true

  const selectedMotion = getSelectedRuntimeMotion()
  return selectedMotion?.group === group && selectedMotion.index === index
}

function resolveMotionPlaybackContext(group: string, index = 0) {
  if (isSettingsRoute())
    return Live2DMotionPlaybackContext.SettingsPreview

  if (isStageRoute() && isConfiguredIdleMotion(group, index))
    return Live2DMotionPlaybackContext.StageIdle

  if (isStageRoute())
    return Live2DMotionPlaybackContext.StageReaction

  return Live2DMotionPlaybackContext.Direct
}

function resolveMotionPlaybackPolicy(context: Live2DMotionPlaybackContext) {
  switch (context) {
    case Live2DMotionPlaybackContext.StageIdle:
      return Live2DMotionPlaybackPolicy.NaturalIdleSettle
    case Live2DMotionPlaybackContext.StageReaction:
      return Live2DMotionPlaybackPolicy.ReactionThenIdle
    case Live2DMotionPlaybackContext.SettingsPreview:
    case Live2DMotionPlaybackContext.Direct:
    default:
      return Live2DMotionPlaybackPolicy.LiteralPreview
  }
}

const { isDark: dark } = useTheme()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = computed(() => breakpoints.between('sm', 'md').value || breakpoints.smaller('sm').value)
const dropShadowFilter = shallowRef(new DropShadowFilter({
  alpha: 0.2,
  blur: 0,
  distance: 20,
  rotation: 45,
}))

function getCoreModel() {
  return model.value?.internalModel?.coreModel as any
}

function captureNeutralParameterBaseline(coreModel: any) {
  const count = coreModel.getParameterCount?.()
  if (typeof count !== 'number')
    return

  neutralParameterBaseline.value = Array.from({ length: count }, (_, index) => {
    const defaultValue = coreModel.getParameterDefaultValue?.(index)
    if (typeof defaultValue === 'number')
      return defaultValue

    return coreModel.getParameterValueByIndex?.(index) ?? 0
  })
}

function captureSettledIdleParameterBaseline(coreModel: any) {
  const count = coreModel.getParameterCount?.()
  if (typeof count !== 'number')
    return

  settledIdleParameterBaseline.value = Array.from({ length: count }, (_, index) => {
    return coreModel.getParameterValueByIndex?.(index) ?? 0
  })

  // Capture samples for logging
  const sampleParams: Record<string, number> = {}
  const paramIds = coreModel._parameterIds || coreModel._model?._parameterIds || []
  paramIds.forEach((id: string, index: number) => {
    if (index < 10 || id.includes('Angle') || id.includes('Eye') || id.includes('Mouth') || id.includes('Breath') || id.includes('Cheek')) {
      sampleParams[id] = Number((coreModel.getParameterValueByIndex?.(index) ?? 0).toFixed(2))
    }
  })

  console.info(
    `[Live2D-Baseline] 📸 Captured Settled Idle Snapshot | Reason: "Idle motion finished settling with breath/blink" | State:`,
    {
      parameterCount: count,
      sampleValues: sampleParams,
    },
  )
}

function restoreNeutralParameterBaseline(coreModel: any) {
  const hasSettledSnapshot = settledIdleParameterBaseline.value.length > 0
  const baselineToUse = hasSettledSnapshot ? settledIdleParameterBaseline.value : neutralParameterBaseline.value

  if (baselineToUse.length === 0) {
    console.warn(`[Live2D-Transition] 🧹 Restoring Model Baseline | No baseline available to restore`)
    return
  }

  baselineToUse.forEach((value, index) => {
    coreModel.setParameterValueByIndex?.(index, value)
  })
  coreModel.saveParameters?.()

  // Log snapshot restore action
  const sampleParams: Record<string, number> = {}
  const paramIds = coreModel._parameterIds || coreModel._model?._parameterIds || []
  paramIds.forEach((id: string, index: number) => {
    if (index < 10 || id.includes('Angle') || id.includes('Eye') || id.includes('Mouth') || id.includes('Breath') || id.includes('Cheek')) {
      sampleParams[id] = Number((coreModel.getParameterValueByIndex?.(index) ?? 0).toFixed(2))
    }
  })

  console.info(
    `[Live2D-Transition] 🧹 Restoring Model Baseline | Actions:`,
    {
      action: 'stop-all-motions',
      snapshotUsed: hasSettledSnapshot ? 'settled-idle-snapshot' : 'load-time-neutral-defaults',
      parametersRestoredCount: baselineToUse.length,
      restoredValuesSample: sampleParams,
    },
  )
}

function setScaleAndPosition() {
  if (!model.value)
    return

  let offsetFactor = 1.0
  if (isMobile.value) {
    offsetFactor = 1.0
  }

  const heightScale = (props.height * 0.95 / initialModelHeight.value * offsetFactor)
  const widthScale = (props.width * 0.95 / initialModelWidth.value * offsetFactor)
  let scale = Math.min(heightScale, widthScale)

  // Prevent zero or NaN values to fix the "headless" model issue.
  if (Number.isNaN(scale) || scale <= 0) {
    scale = 1e-6
  }

  model.value.scale.set(scale * props.scale, scale * props.scale)
  model.value.x = (props.width / 2) + offset.value.xOffset
  model.value.y = (props.height / 2) + offset.value.yOffset

  // CRITICAL FIX: Prevent PIXI filters from clipping out-of-bounds meshes
  if (pixiApp.value?.renderer?.screen) {
    model.value.filterArea = pixiApp.value.renderer.screen
  }
}

const {
  currentMotion,
  availableMotions,
  motionMap,
  modelParameters,
  availableExpressions,
  parameterMetadata,
  expressionData,
  activeExpressions,
} = storeToRefs(live2dStore)

function findExpressionData(fileName: string) {
  const targetBase = fileName.split(/[\\/]/).pop()?.toLowerCase()
  return expressionData.value.find((e: any) => {
    if (e.fileName === fileName)
      return true
    const eBase = e.fileName.split(/[\\/]/).pop()?.toLowerCase()
    return !!targetBase && targetBase === eBase
  })
}

const themeColorsHue = toRef(() => props.themeColorsHue)
const themeColorsHueDynamic = toRef(() => props.themeColorsHueDynamic)
const live2dIdleAnimationEnabled = toRef(() => props.live2dIdleAnimationEnabled)
const live2dAutoBlinkEnabled = toRef(() => props.live2dAutoBlinkEnabled)
const live2dForceAutoBlinkEnabled = toRef(() => props.live2dForceAutoBlinkEnabled)
const live2dShadowEnabled = toRef(() => props.live2dShadowEnabled)

const localCurrentMotion = ref<{ group: string, index: number }>({ group: 'Idle', index: 0 })
const beatSync = createBeatSyncController({
  baseAngles: () => ({
    x: modelParameters.value.angleX,
    y: modelParameters.value.angleY,
    z: modelParameters.value.angleZ,
  }),
  initialStyle: 'sway-sine',
})

// Listen for model reload requests (e.g., when runtime motion is uploaded)
const disposeShouldUpdateView = live2dStore.onShouldUpdateView(() => {
  loadModel()
})

function parseVTubeJson(text: string): { savedActiveExpressions: string[], artMeshColors: Record<string, string> } {
  const vtubeData = JSON.parse(text) as Record<string, unknown>
  const artMeshColors = extractArtMeshColorsFromVTube(vtubeData)
  if (Object.keys(artMeshColors).length === 0) {
    console.warn(
      '[Live2D] .vtube.json parsed but no ArtMesh multiply/screen colors found. Related keys:',
      listVTubeColorRelatedKeys(vtubeData),
    )
  }
  return {
    savedActiveExpressions: Array.isArray(vtubeData.SavedActiveExpressions)
      ? vtubeData.SavedActiveExpressions as string[]
      : [],
    artMeshColors,
  }
}

async function resolveMetadata() {
  let cdiData: any = null
  const expFiles: any[] = []
  let savedActiveExpressions: string[] = []
  let artMeshColors: Record<string, string> = {}

  // Case 1: Direct File upload (ZIP file)
  if (props.modelFile && props.modelFile.name.toLowerCase().endsWith('.zip')) {
    try {
      const buffer = await props.modelFile.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      const filePaths = Object.keys(zip.files)

      const cdiPath = filePaths.find((f: string) => f.toLowerCase().endsWith('.cdi3.json'))
      if (cdiPath) {
        const text = await zip.file(cdiPath)!.async('text')
        cdiData = JSON.parse(text)
      }

      const jsonPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.json'))
      for (const jsonPath of jsonPaths) {
        const text = await zip.file(jsonPath)!.async('text')
        try {
          const parsed = JSON.parse(text)
          if (parsed && (parsed.Type === 'Live2D Expression' || parsed.type === 'Live2D Expression')) {
            const baseName = jsonPath.split('/').pop()?.replace(/\.exp3?\.json$/i, '') || jsonPath
            expFiles.push({
              name: baseName,
              fileName: jsonPath,
              data: parsed,
            })
          }
        }
        catch {}
      }

      const vtubePath = filePaths.find((f: string) => f.toLowerCase().endsWith('.vtube.json'))
      if (vtubePath) {
        try {
          const text = await zip.file(vtubePath)!.async('text')
          const parsed = parseVTubeJson(text)
          savedActiveExpressions = parsed.savedActiveExpressions
          artMeshColors = parsed.artMeshColors
        }
        catch {}
      }

      console.info(
        '[Live2D Metadata] Extracted CDI, EXP & VTube config directly from uploaded ZIP file',
        Object.keys(artMeshColors).length > 0 ? `(${Object.keys(artMeshColors).length} ArtMesh colors)` : '(no ArtMesh colors in .vtube.json)',
      )
      return { cdiData, expFiles, savedActiveExpressions, artMeshColors }
    }
    catch (e) {
      console.warn('[Live2D Metadata] Failed to parse uploaded ZIP file:', e)
    }
  }

  // Case 2: OPFS Cache (already unzipped individual files)
  if (props.modelId && props.modelSrc) {
    try {
      const cachedFiles = await OPFSCacheV2.get(props.modelId, props.modelSrc)
      if (cachedFiles) {
        // Sometimes OPFS stores the ZIP file itself, or individual files
        const zipFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.zip'))
        if (zipFile) {
          const buffer = await zipFile.arrayBuffer()
          const zip = await JSZip.loadAsync(buffer)
          const filePaths = Object.keys(zip.files)

          const cdiPath = filePaths.find((f: string) => f.toLowerCase().endsWith('.cdi3.json'))
          if (cdiPath) {
            const text = await zip.file(cdiPath)!.async('text')
            cdiData = JSON.parse(text)
          }

          const jsonPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.json'))
          for (const jsonPath of jsonPaths) {
            const text = await zip.file(jsonPath)!.async('text')
            try {
              const parsed = JSON.parse(text)
              if (parsed && (parsed.Type === 'Live2D Expression' || parsed.type === 'Live2D Expression')) {
                const baseName = jsonPath.split('/').pop()?.replace(/\.exp3?\.json$/i, '') || jsonPath
                expFiles.push({
                  name: baseName,
                  fileName: jsonPath,
                  data: parsed,
                })
              }
            }
            catch {}
          }

          const vtubePath = filePaths.find((f: string) => f.toLowerCase().endsWith('.vtube.json'))
          if (vtubePath) {
            try {
              const text = await zip.file(vtubePath)!.async('text')
              const parsed = parseVTubeJson(text)
              savedActiveExpressions = parsed.savedActiveExpressions
              artMeshColors = parsed.artMeshColors
            }
            catch {}
          }

          console.info('[Live2D Metadata] Extracted CDI, EXP & VTube config from cached ZIP file in OPFS')
        }
        else {
          // It's a flat directory of files
          const cdiFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.cdi3.json'))
          if (cdiFile) {
            const text = await cdiFile.text()
            cdiData = JSON.parse(text)
          }

          const cachedJsonFiles = cachedFiles.filter((f: File) => f.name.toLowerCase().endsWith('.json'))
          for (const jsonFile of cachedJsonFiles) {
            const text = await jsonFile.text()
            try {
              const parsed = JSON.parse(text)
              if (parsed && (parsed.Type === 'Live2D Expression' || parsed.type === 'Live2D Expression')) {
                const baseName = jsonFile.name.split('/').pop()?.replace(/\.exp3?\.json$/i, '') || jsonFile.name
                expFiles.push({
                  name: baseName,
                  fileName: jsonFile.webkitRelativePath || jsonFile.name,
                  data: parsed,
                })
              }
            }
            catch {}
          }

          const vtubeFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.vtube.json'))
          if (vtubeFile) {
            try {
              const text = await vtubeFile.text()
              const parsed = parseVTubeJson(text)
              savedActiveExpressions = parsed.savedActiveExpressions
              artMeshColors = parsed.artMeshColors
            }
            catch {}
          }

          console.info('[Live2D Metadata] Extracted CDI, EXP & VTube config directly from cached files in OPFS')
        }
        return { cdiData, expFiles, savedActiveExpressions, artMeshColors }
      }
    }
    catch (e) {
      console.warn('[Live2D Metadata] Failed to parse from OPFS cache:', e)
    }
  }

  // Case 3: HTTP fetch for URL-based models (non-ZIP)
  if (props.modelSrc && !props.modelSrc.startsWith('blob:') && Object.keys(artMeshColors).length === 0) {
    const baseUrl = props.modelSrc.substring(0, props.modelSrc.lastIndexOf('/') + 1)
    const modelFileName = props.modelSrc.split('/').pop() ?? ''
    const modelBaseName = modelFileName.replace(/\.model3\.json$/i, '')
    const vtubeCandidates = [
      `${modelBaseName}.vtube.json`,
      '.vtube.json',
      `${modelFileName.replace('.model3.json', '')}.vtube.json`,
    ].filter((name, index, arr) => arr.indexOf(name) === index)

    for (const vtubeFileName of vtubeCandidates) {
      try {
        const resp = await fetch(baseUrl + encodeURIComponent(vtubeFileName))
        if (!resp.ok)
          continue
        const parsed = parseVTubeJson(await resp.text())
        savedActiveExpressions = parsed.savedActiveExpressions
        artMeshColors = parsed.artMeshColors
        if (Object.keys(artMeshColors).length > 0) {
          console.info('[Live2D Metadata] Extracted ArtMesh colors from HTTP .vtube.json:', vtubeFileName, Object.keys(artMeshColors).length)
          break
        }
      }
      catch {}
    }
  }

  return { cdiData, expFiles, savedActiveExpressions, artMeshColors }
}

async function loadModel() {
  const hash = window.location.hash || '#/'
  const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')
  config.sound = isStage

  await until(modelLoading).not.toBeTruthy()

  await modelLoadMutex.acquire()
  try {
    modelLoading.value = true
    availableExpressions.value = []
    expressionData.value = []
    settledIdleParameterBaseline.value = []

    // activeExpressions.value is NOT wiped here to preserve card state, ghost keys are cleaned up later
    componentState.value = 'loading'

    if (!pixiApp.value || !pixiApp.value.stage) {
      try {
        // NOTICE: shouldUpdateView can fire while the canvas (pixiApp) is being torn down/recreated.
        // Wait briefly for the new stage instead of bailing out, otherwise we keep a blank screen.
        await until(() => !!pixiApp.value && !!pixiApp.value.stage).toBeTruthy({ timeout: 1500 })
      }
      catch {
        return
      }
    }

    // REVIEW: here as await until(...) guarded the pixiApp and stage to be valid.
    if (model.value && pixiApp.value?.stage) {
      try {
        pixiApp.value.stage.removeChild(model.value)
        model.value.destroy()
      }
      catch (error) {
        console.warn('Error removing old model:', error)
      }
      model.value = undefined
    }
    if (!modelSrcRef.value) {
      console.warn('No Live2D model source provided.')
      return
    }

    if (isUnmounted) {
      return
    }

    const live2DModel = new Live2DModel<PixiLive2DInternalModel>()
    await Live2DFactory.setupLive2DModel(live2DModel, { url: modelSrcRef.value, id: props.modelId, file: props.modelFile }, { autoInteract: false })

    // NOTICE: setupLive2DModel is async; pixiApp or stage could have been destroyed during the wait.
    if (isUnmounted || !pixiApp.value || !pixiApp.value.stage) {
      live2DModel.destroy()
      return
    }

    availableMotions.value.forEach((motion) => {
      if (motion.motionName in Emotion) {
        motionMap.value[motion.fileName] = motion.motionName
      }
      else {
        motionMap.value[motion.fileName] = EmotionNeutralMotionName
      }
    })

    // --- Scene
    model.value = live2DModel
    // REVIEW: pixiApp and stage are guaranteed to be valid here due to the check above.
    pixiApp.value.stage.addChild(model.value)
    // Safety fallback: if the logical canvas is missing or tiny (common in certain exports),
    // use the actual container bounds to prevent a massive scale explosion.
    // Always force an update and use local bounds to account for meshes extending beyond logical canvas
    model.value.update(0)
    const bounds = model.value.getLocalBounds()
    const logicalWidth = model.value.internalModel.width
    const logicalHeight = model.value.internalModel.height

    console.info(`[Live2D Load] Logical Canvas: ${logicalWidth}x${logicalHeight} | True Bounds: ${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)}`)

    // Use true bounds if they are significantly larger than the logical canvas
    if (bounds.width > logicalWidth || bounds.height > logicalHeight) {
      initialModelWidth.value = bounds.width
      initialModelHeight.value = bounds.height
    }
    else {
      initialModelWidth.value = logicalWidth
      initialModelHeight.value = logicalHeight
    }

    // Set anchor to 0.5 to center the model correctly when positioned at width/2, height/2
    model.value.anchor.set(0.5, 0.5)
    setScaleAndPosition()

    // --- Interaction

    const declaredHitAreas = (live2DModel.internalModel?.settings as any)?.hitAreas || []
    console.info(`[Live2D Tactile] Loaded model has ${declaredHitAreas.length} hitboxes:`, declaredHitAreas.map((h: any) => `${h.Name || h.name} -> ${h.Id || h.id}`))

    model.value.on('hit', (hitAreas) => {
      if (model.value && hitAreas.includes('body'))
        model.value.motion('tap_body')
    })

    // --- Motion

    const internalModel = model.value.internalModel
    const coreModel = internalModel.coreModel
    const motionManager = internalModel.motionManager
    captureNeutralParameterBaseline(coreModel)
    coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenSize.value)

    availableMotions.value = Object
      .entries(motionManager.definitions)
      .flatMap(([motionName, definition]) => (definition?.map((motion: any, index: number) => ({
        motionName,
        motionIndex: index,
        fileName: motion.File || motion.Sound || motion.Name || `Unknown_${index}`,
        sound: motion.Sound,
        text: motion.Text,
        language: motion.Language,
      })) || []))
      .filter(Boolean)

    // Configure the loop settings for motions in the cycle subset or selected motion
    const cycleMotions = parseCycleMotions(props.idleAnimations)

    const configureMotionLoop = (groupName: string, indexStr: string) => {
      const motionIndex = Number.parseInt(indexStr)
      const context = resolveMotionPlaybackContext(groupName, motionIndex)
      const policy = resolveMotionPlaybackPolicy(context)
      if (policy === Live2DMotionPlaybackPolicy.NaturalIdleSettle)
        return

      const groupIndex = (motionManager.groups as Record<string, any>)[groupName]
      if (groupIndex !== undefined && motionManager.motionGroups[groupIndex]) {
        const motion = motionManager.motionGroups[groupIndex][motionIndex]
        if (motion && motion._looper) {
          // Force the motion to loop
          motion._looper.loopDuration = 0 // 0 means infinite loop
          console.info('[Live2D Cycle] Configured motion to loop infinitely:', groupName, motionIndex)
        }
      }
    }

    if (cycleMotions.length > 0) {
      cycleMotions.forEach(m => configureMotionLoop(m.group, String(m.index)))
    }
    else {
      const selectedMotion = getSelectedRuntimeMotion()
      if (selectedMotion) {
        configureMotionLoop(selectedMotion.group, String(selectedMotion.index))
      }
    }

    if (live2dIdleAnimationEnabled.value) {
      if (cycleMotions.length > 0) {
        const first = cycleMotions[0]
        if (!dslMotionGroupBlocked(first.group, first.index)) {
          setTimeout(() => {
            console.info('[Live2D Cycle] Playing initial motion from card cycle subset:', first.group, first.index)
            currentMotion.value = { group: first.group, index: first.index }
          }, 300)
        }
      }
      else {
        const selectedMotion = getSelectedRuntimeMotion()
        if (selectedMotion && !dslMotionGroupBlocked(selectedMotion.group, selectedMotion.index)) {
          setTimeout(() => {
            console.info('Playing selected runtime motion:', selectedMotion.group, selectedMotion.index)
            currentMotion.value = {
              group: selectedMotion.group,
              index: selectedMotion.index,
            }
          }, 300)
        }
      }
    }

    // Remove eye ball movements from idle motion group to prevent conflicts
    // This is too hacky
    // FIXME: it cannot blink if loading a model only have idle motion
    if (motionManager.groups.idle) {
      motionManager.motionGroups[motionManager.groups.idle]?.forEach((motion) => {
        motion._motionData.curves.forEach((curve: any) => {
        // TODO: After emotion mapper, stage editor, eye related parameters should be take cared to be dynamical instead of hardcoding
          if (curve.id === 'ParamEyeBallX' || curve.id === 'ParamEyeBallY') {
            curve.id = `_${curve.id}`
          }
        })
      })
    }

    // This is hacky too
    const motionManagerUpdate = useLive2DMotionManagerUpdate({
      internalModel,
      motionManager,
      modelParameters,
      live2dIdleAnimationEnabled,
      live2dAutoBlinkEnabled,
      live2dForceAutoBlinkEnabled,
      lastUpdateTime,
    })

    const disableFocusAtRef = toRef(() => props.disableFocusAt)
    const followSpeedRef = toRef(() => props.followSpeed)
    const focusAtRef = toRef(() => props.focusAt)
    const modelRef = ref(model)

    motionManagerUpdate.register(useMotionUpdatePluginBeatSync(beatSync), 'pre')
    motionManagerUpdate.register(useMotionUpdatePluginIdleDisable(), 'pre')
    motionManagerUpdate.register(useMotionUpdatePluginMouseFocus(focusAtRef, disableFocusAtRef, followSpeedRef, modelRef, toRef(() => props.width), toRef(() => props.height)), 'post')
    motionManagerUpdate.register(useMotionUpdatePluginIdleFocus(disableFocusAtRef), 'post')
    motionManagerUpdate.register(useMotionUpdatePluginAutoEyeBlink(), 'post')

    // Real-time lip-sync mouth opening
    motionManagerUpdate.register((ctx) => {
      const size = props.mouthOpenSize ?? 0
      ctx.model.setParameterValueById('ParamMouthOpenY', Math.max(0, Math.min(1.0, size)))
    }, 'post')

    // NOTICE: ArtMesh colors must be applied after coreModel.update(), not in the motion hook.
    // See Cubism4InternalModel.update(): motionManager.update → … → model.update() → draw.
    hookArtMeshColorsAfterModelUpdate(internalModel, artMeshColors)

    // Pre-allocate the standardKeys set outside the ticker loop to prevent massive GC pressure (60fps)
    const standardKeys = new Set([
      'angleX',
      'angleY',
      'angleZ',
      'leftEyeOpen',
      'rightEyeOpen',
      'leftEyeSmile',
      'rightEyeSmile',
      'leftEyebrowLR',
      'rightEyebrowLR',
      'leftEyebrowY',
      'rightEyebrowY',
      'leftEyebrowAngle',
      'rightEyebrowAngle',
      'leftEyebrowForm',
      'rightEyebrowForm',
      'mouthOpen',
      'mouthForm',
      'cheek',
      'bodyAngleX',
      'bodyAngleY',
      'bodyAngleZ',
      'breath',
    ])

    // Custom parameters plugin: applies toggle/slider/expression values from the store
    motionManagerUpdate.register((ctx) => {
      // Diagnostic: keep raw Param* replay disabled while testing motion playback
      // conflicts between discovered parameters and active motion curves.
      const modelId = props.modelId
      const isReplayDisabled = modelId ? (live2dStore.modelParamReplayDisabled[modelId] ?? true) : true
      if (isReplayDisabled) {
        return
      }

      const params = ctx.modelParameters.value
      // Only apply keys that start with "Param" and aren't the standard ones managed by other plugins
      for (const key in params) {
        if (!standardKeys.has(key) && key.startsWith('Param')) {
          try {
            ctx.model.setParameterValueById(key, params[key] as number)
          }
          catch {
            // Silently ignore if parameter doesn't exist on this model
          }
        }
      }
    }, 'post')

    const hookedUpdate = motionManager.update as (model: PixiLive2DInternalModel['coreModel'], now: number) => boolean
    motionManager.update = function (model: PixiLive2DInternalModel['coreModel'], now: number) {
      return motionManagerUpdate.hookUpdate(model, now, hookedUpdate)
    }

    motionManager.on('motionStart', (group, index, audio) => {
      localCurrentMotion.value = { group, index }

      const hash = window.location.hash || '#/'
      const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')

      const groupMotions = availableMotions.value.filter(m => m.motionName === group)
      const activeMotionDef = groupMotions.find(m => m.motionIndex === index)

      if (activeMotionDef) {
        // Find all duplicate motions that share the exact same asset bindings
        const siblings = groupMotions.filter(m => m.fileName === activeMotionDef.fileName && m.sound === activeMotionDef.sound)

        // Coalesce text: Prefer English variations, fallback to the default/first one
        const enLocalized = siblings.find(m => m.language && m.language.toLowerCase().startsWith('en'))
        const defaultDef = siblings.find(m => !m.language) || activeMotionDef

        const resolvedTextDef = enLocalized?.text ? enLocalized : defaultDef

        if (resolvedTextDef.text) {
          live2dStore.activeMotionText = { text: resolvedTextDef.text, language: resolvedTextDef.language }
          if (!isStage) {
            toast(resolvedTextDef.text, {
              description: resolvedTextDef.language ? `Localized (${resolvedTextDef.language})` : 'Original Transcript',
            })
          }
          else {
            const captionsEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('settings/captions/enabled') !== 'false'
            if (captionsEnabled) {
              postCaption({
                type: 'caption-assistant',
                segments: [
                  {
                    text: resolvedTextDef.text,
                    color: '#ca9ee6',
                    actorId: props.modelId || 'live2d',
                    isActive: true,
                  },
                ],
              })
            }
            else {
              const title = 'AIRI'
              const body = resolvedTextDef.text
              const hasElectron = typeof window !== 'undefined' && (window as any).electron?.ipcRenderer
              if (hasElectron) {
                try {
                  (window as any).electron.ipcRenderer.send('show-os-notification', {
                    title,
                    body,
                    silent: true,
                  })
                }
                catch (e) {
                  console.warn('[Live2D Notification] Failed to send show-os-notification IPC:', e)
                  showHtml5Notification(title, body)
                }
              }
              else {
                showHtml5Notification(title, body)
              }
            }
          }
        }
        else {
          live2dStore.activeMotionText = null
        }
      }
      else {
        live2dStore.activeMotionText = null
      }

      if (!isStage && audio) {
        try {
          audio.muted = true
          audio.pause()
        }
        catch (e) {
          console.warn('[Live2D Audio] Failed to mute/pause non-leader audio:', e)
        }
      }
    })

    // Listen for motion finish to restart runtime motion for looping
    motionManager.on('motionFinish', () => {
      if (!live2dIdleAnimationEnabled.value) {
        restoreNeutralParameterBaseline(coreModel)
        return
      }

      const current = currentMotion.value
      if (current) {
        const context = resolveMotionPlaybackContext(current.group, current.index)
        const policy = resolveMotionPlaybackPolicy(context)
        if (policy === Live2DMotionPlaybackPolicy.NaturalIdleSettle) {
          console.info('[Live2D Policy] Stage idle settled; leaving neutral baseline intact without immediate restart')
          if (settledIdleParameterBaseline.value.length === 0) {
            captureSettledIdleParameterBaseline(coreModel)
          }
          return
        }
      }

      // Parse current card cycle subset, excluding any pool the DSL has disabled
      // (`motions disable <group>`) so a gated idle motion is never auto-restarted.
      const cycleMotions = parseCycleMotions(props.idleAnimations)
        .filter(m => !dslMotionGroupBlocked(m.group, m.index))

      if (cycleMotions.length > 0) {
        let nextMotion = cycleMotions[0]

        if (cycleMotions.length > 1) {
          // Select a random motion from the subset (ideally excluding the one that just finished)
          const current = currentMotion.value
          const choices = cycleMotions.filter(
            m => m.group !== current?.group || m.index !== current?.index,
          )
          const selection = choices.length > 0 ? choices : cycleMotions
          nextMotion = selection[Math.floor(Math.random() * selection.length)]
        }

        console.info('[Live2D Cycle] Motion finished, playing next subset motion:', nextMotion.group, nextMotion.index)
        requestAnimationFrame(() => {
          currentMotion.value = {
            group: nextMotion.group,
            index: nextMotion.index,
          }
        })
        return
      }

      const selectedMotion = getSelectedRuntimeMotion()

      if (selectedMotion && !dslMotionGroupBlocked(selectedMotion.group, selectedMotion.index)) {
        // Restart the selected runtime motion immediately for seamless looping
        console.info('Motion finished, restarting runtime motion:', selectedMotion.group, selectedMotion.index)
        // Use requestAnimationFrame to restart on the next frame for smooth transition
        requestAnimationFrame(() => {
          currentMotion.value = {
            group: selectedMotion.group,
            index: selectedMotion.index,
          }
        })
      }
      else {
        restoreNeutralParameterBaseline(coreModel)
      }
    })

    // Apply all stored parameters to the model
    coreModel.setParameterValueById('ParamMouthOpenY', modelParameters.value.mouthOpen)
    coreModel.setParameterValueById('ParamMouthForm', modelParameters.value.mouthForm)
    coreModel.setParameterValueById('ParamCheek', modelParameters.value.cheek)
    coreModel.setParameterValueById('ParamBodyAngleX', modelParameters.value.bodyAngleX)
    coreModel.setParameterValueById('ParamBodyAngleY', modelParameters.value.bodyAngleY)
    coreModel.setParameterValueById('ParamBodyAngleZ', modelParameters.value.bodyAngleZ)
    coreModel.setParameterValueById('ParamBreath', modelParameters.value.breath)

    // --- Metadata Parsing (CDI & EXP) - ALPHA DEBUG MODE
    try {
      const settings = internalModel.settings as any
      const rawJson = settings?.json

      const fileRefs = rawJson?.FileReferences || rawJson?.fileReferences

      // 1. CDI Parsing - Priority: zip-extracted > http fetch > core model fallback
      const resolvedMeta = await resolveMetadata()
      let cdiData = resolvedMeta.cdiData || settings?._cdiData
      artMeshColors.value = resolvedMeta.artMeshColors || {}
      if (Object.keys(artMeshColors.value).length > 0) {
        console.info('[Live2D] Loaded ArtMesh colors from .vtube.json:', Object.keys(artMeshColors.value).length)
      }

      if (!cdiData) {
        // Try HTTP fetch for non-zip models
        const cdiFileName = fileRefs?.DisplayInfo || fileRefs?.Cdi
        if (cdiFileName && props.modelSrc && !props.modelSrc.startsWith('blob:')) {
          const baseUrl = props.modelSrc.substring(0, props.modelSrc.lastIndexOf('/') + 1)
          try {
            const resp = await fetch(baseUrl + encodeURIComponent(cdiFileName))
            if (resp.ok && !isUnmounted && model.value)
              cdiData = await resp.json()
          }
          catch {}
        }
      }

      if (cdiData && !isUnmounted && model.value) {
        const params = cdiData?.Parameters || cdiData?.parameters
        if (params) {
          // Initialize missing modelParameters from core model defaults BEFORE setting metadata
          // This avoids the UI rendering sliders with undefined/NaN values
          params.forEach((p: any) => {
            const id = p.Id || p.id
            if (modelParameters.value[id] === undefined) {
              try {
                modelParameters.value[id] = (internalModel.coreModel as any).getParameterValueById(id) || 0
              }
              catch {
                modelParameters.value[id] = 0
              }
            }
          })

          parameterMetadata.value = params.map((p: any) => ({
            id: p.Id || p.id,
            name: p.Name || p.name,
            groupId: p.GroupId || p.groupId,
          }))

          const groups = cdiData?.ParameterGroups || cdiData?.parameterGroups
          if (groups) {
            parameterMetadata.value.forEach((p) => {
              const group = groups.find((g: any) => (g.Id || g.id) === p.groupId)
              if (group)
                p.groupName = group.Name || group.name
            })
          }
          console.info('✅ Populated parameterMetadata from CDI:', parameterMetadata.value.length)
        }
      }

      // Fallback: extract IDs directly from the core model
      if (parameterMetadata.value.length === 0) {
        try {
          const core = internalModel.coreModel as any
          // Try various known Cubism SDK structures
          const paramIds = core?._parameterIds || core?._model?._parameterIds || []
          if (paramIds.length > 0) {
            parameterMetadata.value = paramIds.map((id: string) => ({ id, name: id }))

            // Initialize missing modelParameters from core model defaults
            parameterMetadata.value.forEach((p) => {
              if (modelParameters.value[p.id] === undefined) {
                try {
                  modelParameters.value[p.id] = (internalModel.coreModel as any).getParameterValueById(p.id) || 0
                }
                catch {
                  modelParameters.value[p.id] = 0
                }
              }
            })
          }
        }
        catch (e) {
          console.warn('⚠️ Could not extract parameter IDs from core model:', e)
        }
      }

      // 2. Expressions Parsing - Priority: zip-extracted > FileRefs > expressionManager
      const expFiles = (resolvedMeta.expFiles && resolvedMeta.expFiles.length > 0) ? resolvedMeta.expFiles : settings?._expFiles
      if (expFiles && expFiles.length > 0) {
        availableExpressions.value = expFiles.map((exp: any) => ({
          name: exp.name,
          fileName: exp.fileName,
        }))
        // Also store the full expression data so the UI can apply them
        expressionData.value = expFiles
        console.info('✅ Populated expressions from zip-extracted files:', expFiles.length)
      }
      else {
        const expressions = fileRefs?.Expressions || fileRefs?.expressions
        if (expressions && Array.isArray(expressions)) {
          availableExpressions.value = expressions.map((exp: any) => ({
            name: exp.Name || exp.name || exp.File?.split('/').pop()?.replace('.exp3.json', ''),
            fileName: exp.File || exp.file,
          }))

          // Fetch expression data for URL-based models so they can be restored
          if (props.modelSrc && !props.modelSrc.startsWith('blob:')) {
            const baseUrl = props.modelSrc.substring(0, props.modelSrc.lastIndexOf('/') + 1)
            const fetchPromises = availableExpressions.value.map(async (exp) => {
              try {
                const resp = await fetch(baseUrl + encodeURIComponent(exp.fileName))
                if (resp.ok) {
                  const data = await resp.json()
                  return { name: exp.name, fileName: exp.fileName, data }
                }
              }
              catch (err) {
                console.warn(`[Live2D] Failed to fetch expression ${exp.fileName}:`, err)
              }
              return null
            })
            const results = await Promise.all(fetchPromises)
            if (!isUnmounted && model.value) {
              expressionData.value = results.filter((r): r is any => r !== null)
              console.info('✅ Fetched expression data from URLs:', expressionData.value.length)
            }
          }
          console.info('✅ Populated expressions from FileRefs:', availableExpressions.value.length)
        }
        else {
          const expressionManager = (internalModel as any).expressionManager
          if (expressionManager?.definitions) {
            const defs = expressionManager.definitions
            availableExpressions.value = Object.keys(defs).map(name => ({
              name,
              fileName: defs[name]?.File || defs[name]?.file || name,
            }))
            console.info('✅ Populated expressions from expressionManager:', availableExpressions.value.length)
          }
        }
      }

      // 2b. Initialize activeExpressions from .vtube.json saved active expressions if available
      const modelKey = props.modelId || props.modelSrc
      const defaultsLoadedKey = modelKey ? `live2d_vtube_defaults_loaded_${modelKey}` : null
      const hasLoadedDefaults = defaultsLoadedKey ? localStorage.getItem(defaultsLoadedKey) === 'true' : false

      if (!hasLoadedDefaults && resolvedMeta.savedActiveExpressions && resolvedMeta.savedActiveExpressions.length > 0) {
        console.info('[Live2D] Activating saved active expressions from .vtube.json:', resolvedMeta.savedActiveExpressions)
        for (const savedExp of resolvedMeta.savedActiveExpressions) {
          const expEntry = expressionData.value.find((e: any) => {
            const eName = e.fileName.split('/').pop()?.toLowerCase()
            const sName = savedExp.split('/').pop()?.toLowerCase()
            return eName === sName
          })
          if (expEntry) {
            activeExpressions.value[expEntry.fileName] = 1
          }
        }
        if (defaultsLoadedKey) {
          localStorage.setItem(defaultsLoadedKey, 'true')
        }
      }

      // 2c. Clean up any activeExpressions keys that do not exist in the current availableExpressions
      // This ensures we don't keep ghost expressions from previously loaded models when switching.
      const validKeys = new Set(availableExpressions.value.map(e => e.fileName))
      const validBasenames = new Set(
        availableExpressions.value.map(e => e.fileName.split(/[\\/]/).pop()?.toLowerCase()).filter(Boolean),
      )
      const nextActiveExpressions = { ...activeExpressions.value }
      let hasDeletes = false
      for (const key of Object.keys(nextActiveExpressions)) {
        const keyBase = key.split(/[\\/]/).pop()?.toLowerCase()
        if (!validKeys.has(key) && (!keyBase || !validBasenames.has(keyBase))) {
          delete nextActiveExpressions[key]
          hasDeletes = true
        }
      }
      if (hasDeletes) {
        activeExpressions.value = nextActiveExpressions
      }

      // 3. Restore saved active expressions on model load
      if (expressionData.value.length > 0 && Object.keys(activeExpressions.value).length > 0) {
        for (const [fileName, weight] of Object.entries(activeExpressions.value)) {
          if (weight > 0) {
            const expEntry = findExpressionData(fileName)
            if (expEntry?.data?.Parameters) {
              for (const param of expEntry.data.Parameters) {
                const id = param.Id || param.id
                const value = param.Value ?? param.value
                if (id !== undefined && value !== undefined) {
                  modelParameters.value[id] = value
                }
              }
            }
          }
        }
      }
    }
    catch (e) {
      console.error('❌ [Live2D-Alpha] Metadata parsing failure:', e)
    }

    emits('modelLoaded')

    // --- Live2D DSL runtime bootstrap (additive; failures never break the render) ---
    try {
      disposeDslRuntime()

      const rawGroups = consumePendingDslGroups()
      const hasDsl = rawGroups.length > 0
      if (!hasDsl)
        return

      // Intimacy lives in the dedicated model-scoped DSL intimacy store (Option 1). It is
      // intentionally separate from the dating-sim 0-100 score so DSL manifests can use
      // raw 0-100k+ thresholds and bonuses. project to display only at the UI boundary.
      const dslIntimacy = useDslIntimacyStore()
      dslAdapter = new Live2DRuntimeAdapter({
        model: model.value!,
        modelId: props.modelId,
        getIntimacy: () => dslIntimacy.getRaw(props.modelId),
        addIntimacy: delta => dslIntimacy.add(props.modelId, delta),
        host: {
          // Phase 3 placeholder: costume swap renders as a no-op until the render host
          // performs the actual model hot-swap. State (heap) is preserved regardless.
          // The optional `index` (numeric costume slot / multi-.moc3 chains) is plumbed
          // through for future consumption; the swap itself stays host-side.
          changeCostume: (_modelFile: string, _index?: number) => {},
          showSpeechText: (text) => {
            live2dStore.activeMotionText = { text }
          },
          showChoices: () => {},
        },
        resolveAssetUrl: file => file,
      })

      dslVM = new DSLVirtualMachine({
        host: {
          ...buildAdapterPorts(dslAdapter),
          // Intimacy write-back goes through the adapter's injected accessors (stubbed
          // until Phase 3 wiring to the dating-sim store).
          intimacy: {
            getIntimacy: () => dslAdapter!.getIntimacy(),
            addIntimacy: (delta: number) => dslAdapter!.addIntimacy(delta),
          },
          // DSL change_cos must also notify the adapter so its dispose can clean up.
          costume: { changeCostume: (file: string, index?: number) => dslAdapter!.changeCostume(file, index) },
        },
      })
      dslVM.loadGroups(rawGroups)
      // Bridge resolution: when the dating-sim overlay replies with a chosen option,
      // resume the VM. Registered here so the adapter never needs a VM reference.
      dslAdapter.setSelectChoiceHandler(idx => dslVM?.selectChoice(idx))
      // When a DSL `motions disable <group>` fires, ensure a currently-looping motion in
      // that group stops even if the pool was mid-idle. The adapter already stops the exact
      // active group; this guard clears a lingering currentMotion so the restart path below
      // won't immediately resurrect a disabled idle motion.
      dslAdapter.setOnMotionGroupEnabledChange((ref, enabled) => {
        if (enabled)
          return
        const cur = currentMotion.value
        if (cur && !dslAdapter!.isMotionGroupEnabled(cur.group) && cur.group === ref.group) {
          try {
            model.value?.internalModel?.motionManager?.stopAllMotions()
          }
          catch { /* renderer torn down — nothing to stop */ }
        }
      })
    }
    catch (dslError) {
      console.warn('[Live2D DSL] Failed to bootstrap runtime (non-fatal):', dslError)
      disposeDslRuntime()
    }
  }
  catch (error) {
    console.error('[Live2D] Failed to load model:', error)
    emits('error', error instanceof Error ? error : new Error(String(error)))
  }
  finally {
    modelLoading.value = false
    componentState.value = 'mounted'
    modelLoadMutex.release()
  }
}

async function setMotion(motionName: string, index?: number) {
  // TODO: motion? Not every Live2D model has motion, we do need to help users to set motion
  if (!model.value) {
    console.warn('Cannot set motion: model not loaded')
    return
  }

  if (!motionName || index === -1) {
    console.info('Stopping all motions (standstill/none state)')
    try {
      model.value.internalModel.motionManager.stopAllMotions()
    }
    catch (e) {
      console.warn('Failed to stop all motions:', e)
    }
    return
  }

  console.info('Setting motion:', motionName, 'index:', index)
  try {
    const hasMotion = await applyMotionPlaybackPolicy(motionName, index ?? 0)
    if (!hasMotion) {
      console.warn('[Model.vue] Aborting motion playback: motion is undefined or could not be loaded:', motionName, index)
      return
    }
    try {
      dslVM?.dispatch(motionName)
    }
    catch (e) {
      console.warn('[Live2D DSL] setMotion dispatch failed (non-fatal):', e)
    }

    await model.value.motion(motionName, index, MotionPriority.FORCE)
    console.info('Motion started successfully:', motionName)
  }
  catch (error) {
    console.error('Failed to start motion:', motionName, error)
  }
}

async function applyMotionPlaybackPolicy(motionName: string, index: number): Promise<boolean> {
  const currentModel = model.value
  const motionManager = currentModel?.internalModel?.motionManager
  if (!motionManager)
    return false

  const context = resolveMotionPlaybackContext(motionName, index)
  const policy = resolveMotionPlaybackPolicy(context)

  let motion
  try {
    motion = await motionManager.loadMotion?.(motionName, index)
  }
  catch (e) {
    console.warn('[Model.vue] Error loading motion:', e)
  }

  if (!motion)
    return false

  console.info(
    `[Live2D-Policy] 🔀 Motion Transition Requested | Context Info:`,
    {
      motionName,
      index,
      routeHash: window.location.hash || '#/',
      isStageRoute: isStageRoute(),
      isConfiguredIdle: isConfiguredIdleMotion(motionName, index),
      resolvedContext: context,
      resolvedPolicy: policy,
      resolvedMotion: motion,
    },
  )

  // ALWAYS stop previous motions and restore the baseline during a transition
  motionManager.stopAllMotions()
  restoreNeutralParameterBaseline(currentModel.internalModel.coreModel)

  if (policy === Live2DMotionPlaybackPolicy.NaturalIdleSettle) {
    motion.setIsLoop?.(false)
    if (motion._looper)
      motion._looper.loopDuration = motion.getLoopDuration?.() ?? motion._motionData?.duration ?? -1
    console.info('[Live2D Policy] Playing stage idle as a clean settle motion:', motionName, index)
    return true
  }

  const definition = motionManager.definitions?.[motionName]?.[index]
  const shouldLoop = definition?.Loop ?? motion._motionData?.loop
  if (typeof shouldLoop === 'boolean')
    motion.setIsLoop?.(shouldLoop)

  return true
}

const dropShadowColorComputer = ref<HTMLDivElement>()
const dropShadowAnimationId = ref(0)

function updateDropShadowFilter() {
  if (!model.value)
    return

  if (!live2dShadowEnabled.value) {
    model.value.filters = []
    return
  }

  if (!dropShadowColorComputer.value)
    return

  const color = getComputedStyle(dropShadowColorComputer.value).backgroundColor
  const hex = formatHex(color)
  if (!hex)
    return

  const parsedColor = Number(hex.replace('#', '0x'))

  if (dropShadowFilter.value.color !== parsedColor) {
    dropShadowFilter.value.color = parsedColor
  }

  if (!model.value.filters || model.value.filters.length === 0 || model.value.filters[0] !== dropShadowFilter.value) {
    model.value.filters = [dropShadowFilter.value]
  }
}

const handleResize = useDebounceFn(setScaleAndPosition, 100)

watch([() => props.width, () => props.height], handleResize)
watch([modelSrcRef, () => props.modelId, () => props.modelFile], async () => await loadModel(), { immediate: true })
watch(dark, updateDropShadowFilter, { immediate: true })
watch([model, themeColorsHue], updateDropShadowFilter)
watch(live2dShadowEnabled, updateDropShadowFilter)
watch([model, offset, () => props.scale, () => props.xOffset, () => props.yOffset], setScaleAndPosition)

let dropShadowFrameCounter = 0
// TODO: This is hacky!
function updateDropShadowFilterLoop() {
  // NOTICE: Guard against orphaned RAF loops. When the component unmounts during
  // an ACTOR swap, the old loop must die immediately, otherwise it retains the
  // full Live2DModel in closure memory and keeps calling getComputedStyle on a
  // detached DOM node, eventually crashing the renderer via OOM / main-thread lockup.
  if (isUnmounted) {
    dropShadowAnimationId.value = 0
    return
  }

  dropShadowFrameCounter++
  // Throttle the getComputedStyle DOM read to prevent layout thrashing (1fps lag)
  if (dropShadowFrameCounter % 10 === 0) {
    updateDropShadowFilter()
  }

  if (!live2dShadowEnabled.value) {
    dropShadowAnimationId.value = 0
    return
  }

  dropShadowAnimationId.value = requestAnimationFrame(updateDropShadowFilterLoop)
}

watch([themeColorsHueDynamic, live2dShadowEnabled], ([dynamic, shadowEnabled]) => {
  if (dynamic && shadowEnabled) {
    dropShadowAnimationId.value = requestAnimationFrame(updateDropShadowFilterLoop)
  }
  else {
    cancelAnimationFrame(dropShadowAnimationId.value)
    dropShadowAnimationId.value = 0
  }
}, { immediate: true })

watch(activeExpressions, (newExps, oldExps) => {
  if (!model.value || expressionData.value.length === 0)
    return

  console.info('[Live2D Model] activeExpressions changed:', newExps)

  // 1. Gather all parameters that need to be reset
  const paramsToReset = new Set<string>()

  // Find which expressions are now inactive
  const oldKeys = oldExps ? Object.keys(oldExps) : []
  for (const key of oldKeys) {
    if (!newExps?.[key]) {
      const expEntry = findExpressionData(key)
      if (expEntry?.data?.Parameters) {
        expEntry.data.Parameters.forEach((param: any) => {
          const id = param.Id || param.id
          if (id !== undefined) {
            paramsToReset.add(id)
          }
        })
      }
    }
  }

  // Reset those parameters to neutral default first
  paramsToReset.forEach((id) => {
    // Find default value from neutral baseline
    const paramIds = (model.value?.internalModel?.coreModel as any)?._parameterIds || []
    const paramIndex = paramIds.indexOf(id)
    if (paramIndex !== -1) {
      const defaultVal = neutralParameterBaseline.value[paramIndex] ?? 0
      modelParameters.value[id] = defaultVal
    }
  })

  // 2. Apply all active expressions' parameters
  for (const [fileName, weight] of Object.entries(newExps || {})) {
    if (weight > 0) {
      const expEntry = findExpressionData(fileName)
      if (expEntry?.data?.Parameters) {
        for (const param of expEntry.data.Parameters) {
          const id = param.Id || param.id
          const value = param.Value ?? param.value
          if (id !== undefined && value !== undefined) {
            modelParameters.value[id] = value
          }
        }
      }
    }
  }
}, { deep: true })

watch(mouthOpenSize, (value) => {
  const coreModel = getCoreModel()
  if (coreModel) {
    coreModel.setParameterValueById('ParamMouthOpenY', value)
  }
})
watch(currentMotion, value => setMotion(value.group, value.index))
watch(paused, value => value ? pixiApp.value?.stop() : pixiApp.value?.start())
watch(() => props.idleAnimations, (idleAnimations) => {
  if (!model.value || !live2dIdleAnimationEnabled.value)
    return

  const cycleMotions = parseCycleMotions(idleAnimations)
  if (cycleMotions.length === 0)
    return

  const alreadyInCycle = cycleMotions.some(m =>
    currentMotion.value?.group === m.group && currentMotion.value?.index === m.index,
  )
  if (alreadyInCycle)
    return

  const nextMotion = cycleMotions[0]
  console.info('[Live2D Cycle] Idle cycle changed, switching to first configured motion:', nextMotion.group, nextMotion.index)
  currentMotion.value = {
    group: nextMotion.group,
    index: nextMotion.index,
  }
}, { deep: true })

// Watch for model changes to apply current parameters once
watch(model, (currModel) => {
  if (currModel) {
    applyParameters(currModel.internalModel.coreModel as any, modelParameters.value)
  }
})

// Watch parameters deeply but apply only if model exists
watch(modelParameters, (params) => {
  const coreModel = getCoreModel()
  if (coreModel) {
    applyParameters(coreModel, params)
  }
}, { deep: true })

function applyParameters(coreModel: any, params: Record<string, number>) {
  // Standard parameters
  coreModel.setParameterValueById('ParamAngleX', params.angleX)
  coreModel.setParameterValueById('ParamAngleY', params.angleY)
  coreModel.setParameterValueById('ParamAngleZ', params.angleZ)
  coreModel.setParameterValueById('ParamEyeLOpen', params.leftEyeOpen)
  coreModel.setParameterValueById('ParamEyeROpen', params.rightEyeOpen)
  coreModel.setParameterValueById('ParamEyeSmile', params.leftEyeSmile)
  coreModel.setParameterValueById('ParamBrowLX', params.leftEyebrowLR)
  coreModel.setParameterValueById('ParamBrowRX', params.rightEyebrowLR)
  coreModel.setParameterValueById('ParamBrowLY', params.leftEyebrowY)
  coreModel.setParameterValueById('ParamBrowRY', params.rightEyebrowY)
  coreModel.setParameterValueById('ParamBrowLAngle', params.leftEyebrowAngle)
  coreModel.setParameterValueById('ParamBrowRAngle', params.rightEyebrowAngle)
  coreModel.setParameterValueById('ParamBrowLForm', params.leftEyebrowForm)
  coreModel.setParameterValueById('ParamBrowRForm', params.rightEyebrowForm)
  coreModel.setParameterValueById('ParamMouthOpenY', params.mouthOpen)
  coreModel.setParameterValueById('ParamMouthForm', params.mouthForm)
  coreModel.setParameterValueById('ParamCheek', params.cheek)
  coreModel.setParameterValueById('ParamBodyAngleX', params.bodyAngleX)
  coreModel.setParameterValueById('ParamBodyAngleY', params.bodyAngleY)
  coreModel.setParameterValueById('ParamBodyAngleZ', params.bodyAngleZ)
  coreModel.setParameterValueById('ParamBreath', params.breath)

  // Dynamic parameters (from CDI)
  Object.entries(params).forEach(([key, value]) => {
    // If it's not one of our standard keys, it's a dynamic one
    const standardKeys = [
      'angleX',
      'angleY',
      'angleZ',
      'leftEyeOpen',
      'rightEyeOpen',
      'leftEyeSmile',
      'leftEyebrowLR',
      'rightEyebrowLR',
      'leftEyebrowY',
      'rightEyebrowY',
      'leftEyebrowAngle',
      'rightEyebrowAngle',
      'leftEyebrowForm',
      'rightEyebrowForm',
      'mouthOpen',
      'mouthForm',
      'cheek',
      'bodyAngleX',
      'bodyAngleY',
      'bodyAngleZ',
      'breath',
    ]
    if (!standardKeys.includes(key)) {
      coreModel.setParameterValueById(key, value)
    }
  })
}

// Watch for idle animation setting changes and stop motions if disabled
watch(live2dIdleAnimationEnabled, (enabled) => {
  if (!enabled && model.value) {
    const internalModel = model.value.internalModel
    if (internalModel?.motionManager) {
      internalModel.motionManager.stopAllMotions()
    }
  }
})

onMounted(() => {
  const removeListener = listenBeatSyncBeatSignal((e) => {
    console.debug('[Live2D Model] Received beat signal:', e)
    beatSync.scheduleBeat()
  })
  const cleanupTriggerMotion = live2dStore.onTriggerMotion((group, index) => {
    setMotion(group, index)
  })
  onUnmounted(() => {
    removeListener()
    cleanupTriggerMotion()
  })
})

onMounted(async () => {
  updateDropShadowFilter()
})

onUnmounted(() => {
  isUnmounted = true
  disposeShouldUpdateView?.()
  disposeDslRuntime()
  cleanupCanvasListeners()

  // NOTICE: Explicitly cancel the drop shadow RAF loop on unmount. The isUnmounted
  // guard inside the loop is the primary defense, but cancelling the pending frame
  // prevents even one extra tick from firing after teardown.
  if (dropShadowAnimationId.value) {
    cancelAnimationFrame(dropShadowAnimationId.value)
    dropShadowAnimationId.value = 0
  }
})

const interactionMode = toRef(() => props.interactionMode)
let hoveredArea: string | null = null
let boundCanvas: HTMLCanvasElement | null = null

function onCanvasMouseMove(event: MouseEvent) {
  if (!model.value || !props.app)
    return

  const canvasEl = props.app.view as HTMLCanvasElement
  if (!canvasEl)
    return

  const rect = canvasEl.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const globalX = mouseX * (props.app.screen.width / rect.width)
  const globalY = mouseY * (props.app.screen.height / rect.height)

  const hitAreas = model.value.hitTest(globalX, globalY)

  if (hitAreas && hitAreas.length > 0) {
    const hitArea = hitAreas[0]
    if (hoveredArea !== hitArea) {
      hoveredArea = hitArea
      console.info(`[Live2D Tactile] Hovered hit area: ${hitArea} at global(${globalX.toFixed(1)}, ${globalY.toFixed(1)})`)
      emits('hitAreaHover', { name: hitArea, x: mouseX, y: mouseY, hovered: true })
    }
    else {
      // Glow follows the cursor: emit updated cursor position
      emits('hitAreaHover', { name: hitArea, x: mouseX, y: mouseY, hovered: true })
    }
  }
  else if (hoveredArea) {
    hoveredArea = null
    emits('hitAreaHover', null)
  }
}

function onCanvasClick(event: MouseEvent) {
  if (!model.value || !props.app)
    return

  const canvasEl = props.app.view as HTMLCanvasElement
  if (!canvasEl)
    return

  const rect = canvasEl.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const globalX = mouseX * (props.app.screen.width / rect.width)
  const globalY = mouseY * (props.app.screen.height / rect.height)

  const hitAreas = model.value.hitTest(globalX, globalY)
  if (hitAreas && hitAreas.length > 0) {
    const hitArea = hitAreas[0]
    console.info(`[Live2D Tactile] Clicked hit area: ${hitArea} at global(${globalX.toFixed(1)}, ${globalY.toFixed(1)})`)

    // DSL runtime: dispatch the hit area's interaction group (e.g. Tapbody). The VM
    // guards/selects by group-name similarity, so unknown areas harmlessly return
    // undefined. Physical motion/expression fallthrough below is untouched.
    try {
      dslVM?.dispatch(hitArea)
    }
    catch (e) {
      console.warn('[Live2D DSL] dispatch failed (non-fatal):', e)
    }

    const internalModel = model.value.internalModel
    const motionManager = internalModel?.motionManager
    if (!motionManager)
      return

    // Categorical pooling system based on body parts
    const hitAreaLower = hitArea.toLowerCase()

    const privateHitAreas = ['bust', 'chest', 'boob', 'breast', 'crotch', 'skirt', 'thigh', 'leg', 'butt', 'hip', 'belly', 'private', '胸', '股', '尻', '脚', '足', 'おっぱい', 'お腹']
    const headHitAreas = ['head', 'face', 'hair', '頭', 'アタマ', '顔', '髪']
    const handHitAreas = ['hand', 'arm', 'finger', '手', '腕']

    let emotionKeywords: string[] = []

    if (privateHitAreas.some(k => hitAreaLower.includes(k))) {
      // Dynamic responses for sensitive areas
      emotionKeywords = ['angry', 'anger', 'mad', 'frown', 'disgust', 'upset', 'hate', '怒', 'blush', 'shy', 'embarrass', 'red', '照', '恥', 'surprise', 'shock', 'gasp', '驚', 'cry', 'tear', 'sad', '泣', '悲']
    }
    else if (headHitAreas.some(k => hitAreaLower.includes(k))) {
      // Dynamic responses for headpats
      emotionKeywords = ['happy', 'smile', 'joy', 'laugh', 'glad', 'fun', '喜', '笑', 'wink', 'proud', 'smug', 'heh', 'ドヤ', 'blush', 'shy', '照', 'sleep', 'close', '眠', '閉']
    }
    else if (handHitAreas.some(k => hitAreaLower.includes(k))) {
      // Dynamic responses for holding hands
      emotionKeywords = ['happy', 'smile', 'fun', 'glad', '喜', '笑', 'wink', 'surprise', 'shock', '驚', 'confused', 'think', 'what', '困', '思']
    }

    let triggered = false

    if (emotionKeywords.length > 0) {
      // Filter expressions that match the context keywords
      const choices = availableExpressions.value.filter(e => emotionKeywords.some(k => e.name.toLowerCase().includes(k)))
      if (choices.length > 0) {
        const selected = choices[Math.floor(Math.random() * choices.length)]
        console.info(`[Live2D Tactile] Click mapped to expression: ${selected.name}`)
        live2dStore.triggerEmotion(selected.name)
        triggered = true
      }
    }

    // Play corresponding motion if no expression triggered or in addition
    const groups = Object.keys(motionManager.definitions || {})
    let matchedGroup = groups.find(g => g.toLowerCase() === hitArea.toLowerCase())
    if (!matchedGroup) {
      matchedGroup = groups.find(g => g.toLowerCase().startsWith(hitArea.toLowerCase()))
    }
    if (!matchedGroup) {
      matchedGroup = groups.find(g => hitArea.toLowerCase().startsWith(g.toLowerCase()))
    }
    if (!matchedGroup) {
      matchedGroup = groups.find(g => g.toLowerCase().includes(hitArea.toLowerCase()))
    }
    if (!matchedGroup) {
      matchedGroup = groups.find(g => hitArea.toLowerCase().includes(g.toLowerCase()))
    }

    if (matchedGroup) {
      const definitions = motionManager.definitions[matchedGroup]
      if (definitions && definitions.length > 0) {
        const randomIndex = Math.floor(Math.random() * definitions.length)
        console.info(`[Live2D Tactile] Playing motion for matched group: group="${matchedGroup}", index=${randomIndex}`)
        model.value.motion(matchedGroup, randomIndex, MotionPriority.FORCE)
        triggered = true
      }
    }

    if (!triggered) {
      console.warn(`[Live2D Tactile] No matching motion/expression group found starting with or related to hitArea: ${hitArea}`)
      if (hitArea.toLowerCase().includes('body')) {
        model.value.motion('tap_body')
      }
      else if (availableExpressions.value.length > 0) {
        // Fallback: pick any random expression if nothing specifically matched
        const selected = availableExpressions.value[Math.floor(Math.random() * availableExpressions.value.length)]
        console.info(`[Live2D Tactile] Playing generic fallback expression: ${selected.name}`)
        live2dStore.triggerEmotion(selected.name)
      }
    }
  }
}

function setupCanvasListeners() {
  cleanupCanvasListeners()

  if (!model.value || !props.app)
    return

  const canvasEl = props.app.view as HTMLCanvasElement
  if (!canvasEl)
    return

  canvasEl.addEventListener('mousemove', onCanvasMouseMove)
  canvasEl.addEventListener('click', onCanvasClick)
  boundCanvas = canvasEl
  console.info('[Live2D Tactile] Registered canvas tactile listeners')
}

function cleanupCanvasListeners() {
  if (boundCanvas) {
    boundCanvas.removeEventListener('mousemove', onCanvasMouseMove)
    boundCanvas.removeEventListener('click', onCanvasClick)
    boundCanvas = null
    console.info('[Live2D Tactile] Unregistered canvas tactile listeners')
  }
}

watch([interactionMode, model, () => props.app], () => {
  setupCanvasListeners()
}, { immediate: true })

function listMotionGroups() {
  return availableMotions.value
}

// --- Standalone playground introspection (Phase 4) -------------------------
// The VM is created internally on model load and is not reactive, so the
// playground polls `getDslState()` on a timer (or after each interaction).
const dslIntimacyStore = useDslIntimacyStore()

/** Dispatch a DSL interaction group (e.g. Tapbody / a Choices NextMtn) into the VM. */
function dispatchDsl(group: string) {
  return dslVM?.dispatch(group)
}

/** Resolve the currently pending Choices menu by index (resumes the VM chain). */
function selectDslChoice(index: number) {
  return dslVM?.selectChoice(index)
}

/** Read-only snapshot of the live DSL runtime for the VarFloats inspector UI. */
function getDslState() {
  return {
    active: dslVM !== null,
    varFloats: dslVM?.vars.snapshot() ?? {},
    pendingChoices: dslVM?.getPendingChoices() ?? null,
    intimacyRaw: dslIntimacyStore.getRaw(props.modelId),
    intimacyDisplay: Math.round((dslIntimacyStore.getRaw(props.modelId) / DSL_INTIMACY_MAX) * 100),
  }
}

defineExpose({
  setMotion,
  listMotionGroups,
  dispatchDsl,
  selectDslChoice,
  getDslState,
})

import.meta.hot?.dispose(() => {
  console.warn('[Dev] Reload on HMR dispose is active for this component. Performing a full reload.')
  window.location.reload()
})
</script>

<template>
  <div ref="dropShadowColorComputer" hidden bg="primary-400 dark:primary-500" />
  <slot />
</template>
