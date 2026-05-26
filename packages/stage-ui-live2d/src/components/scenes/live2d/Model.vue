<script setup lang="ts">
import type { Application } from '@pixi/app'
import { listenBeatSyncBeatSignal } from '@proj-airi/stage-shared/beat-sync'
import { live2dLogger } from '@proj-airi/stage-shared/debug'
import { useTheme } from '@proj-airi/ui'
import { breakpointsTailwind, until, useBreakpoints, useDebounceFn } from '@vueuse/core'
import { formatHex } from 'culori'
import { Mutex } from 'es-toolkit'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import { DropShadowFilter } from 'pixi-filters'
import { config, Live2DFactory, Live2DModel, MotionPriority } from 'pixi-live2d-display/cubism4'
import { computed, onMounted, onUnmounted, ref, shallowRef, toRef, watch } from 'vue'
import type { PixiLive2DInternalModel } from '../../../composables/live2d'
import {
  createBeatSyncController,
  hookArtMeshColorsAfterModelUpdate,
  useLive2DMotionManagerUpdate,
  useMotionUpdatePluginAutoEyeBlink,
  useMotionUpdatePluginBeatSync,
  useMotionUpdatePluginIdleDisable,
  useMotionUpdatePluginIdleFocus,
} from '../../../composables/live2d'
import { Emotion, EmotionNeutralMotionName } from '../../../constants/emotions'
import { useLive2d } from '../../../stores/live2d'
import { setOnZipLoaded } from '../../../utils/live2d-zip-loader'
import { OPFSCacheV2 } from '../../../utils/opfs-loader'
import { extractArtMeshColorsFromVTube, listVTubeColorRelatedKeys } from '../../../utils/vtube-artmesh-colors'

interface Live2DCdiParameter {
  Id?: string
  id?: string
  Name?: string
  name?: string
  GroupId?: string
  groupId?: string
}

interface Live2DCdiGroup {
  Id?: string
  id?: string
  Name?: string
  name?: string
}

interface Live2DExpressionFile {
  name: string
  fileName: string
  data?: unknown
}

interface Live2DExpressionEntry {
  name: string
  fileName: string
  data?: { Parameters?: Live2DCdiParameter[] }
}

interface Live2DHitArea {
  Name?: string
  name?: string
  Id?: string
  id?: string
}

interface Live2DMotionDefinition {
  File?: string
  file?: string
}

interface ResolvedMetadata {
  cdiData: Record<string, unknown> | null
  expFiles: Live2DExpressionFile[]
  savedActiveExpressions: string[]
  artMeshColors: Record<string, string>
}

const props = withDefaults(
  defineProps<{
    modelSrc?: string
    modelId?: string
    modelFile?: File

    app?: Application
    mouthOpenSize?: number
    width: number
    height: number
    paused?: boolean
    focusAt?: { x: number; y: number }
    disableFocusAt?: boolean
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
  }>(),
  {
    disableFocusAt: false,
    focusAt: () => ({ x: 0, y: 0 }),
    idleAnimations: () => [],
    interactionMode: 'orbit',
    live2dAutoBlinkEnabled: true,
    live2dForceAutoBlinkEnabled: false,
    live2dIdleAnimationEnabled: true,
    live2dShadowEnabled: true,
    mouthOpenSize: 0,
    paused: false,
    scale: 1,
    themeColorsHue: 220.44,
    themeColorsHueDynamic: false,
  },
)

const emits = defineEmits<{
  (e: 'modelLoaded'): void
  (e: 'error', error: Error): void
  (e: 'hitAreaHover', value: { name: string; x: number; y: number; hovered: boolean } | null): void
}>()

// Global Model Access for LHacker
setOnZipLoaded((buffer) => {
  ;(window as unknown as Record<string, unknown>).__LHACK_LAST_ZIP_BUFFER__ = buffer
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

const modelSrcRef = toRef(() => props.modelSrc)

const modelLoading = ref(false)
// NOTICE: boolean is sufficient; this flag is only used inside loadModel to bail out if the component unmounts mid-load.
const isUnmounted = ref(false)

const modelLoadMutex = new Mutex()

const offset = computed(() => parsePropsOffset())

const pixiApp = toRef(() => props.app)
const paused = toRef(() => props.paused)
const focusAt = toRef(() => props.focusAt)
const live2dStore = useLive2d()
const { model } = storeToRefs(live2dStore)

const initialModelWidth = ref<number>(0)
const initialModelHeight = ref<number>(0)
const mouthOpenSize = computed(() => Math.max(0, Math.min(100, props.mouthOpenSize)))
const lastUpdateTime = ref(0)
const artMeshColors = ref<Record<string, string>>({})

const { isDark: dark } = useTheme()
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = computed(() => breakpoints.between('sm', 'md').value || breakpoints.smaller('sm').value)
const dropShadowFilter = shallowRef(
  new DropShadowFilter({
    alpha: 0.2,
    blur: 0,
    distance: 20,
    rotation: 45,
  }),
)

function getCoreModel(): PixiLive2DInternalModel['coreModel'] | undefined {
  return model.value?.internalModel?.coreModel as PixiLive2DInternalModel['coreModel'] | undefined
}

function setScaleAndPosition() {
  if (!model.value) return

  const offsetFactor = isMobile.value ? 1.0 : 1.0

  const heightScale = ((props.height * 0.95) / initialModelHeight.value) * offsetFactor
  const widthScale = ((props.width * 0.95) / initialModelWidth.value) * offsetFactor
  let scale = Math.min(heightScale, widthScale)

  // Prevent zero or NaN values to fix the "headless" model issue.
  if (Number.isNaN(scale) || scale <= 0) {
    scale = 1e-6
  }

  model.value.scale.set(scale * props.scale, scale * props.scale)
  model.value.x = props.width / 2 + offset.value.xOffset
  model.value.y = props.height / 2 + offset.value.yOffset

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

const themeColorsHue = toRef(() => props.themeColorsHue)
const themeColorsHueDynamic = toRef(() => props.themeColorsHueDynamic)
const live2dIdleAnimationEnabled = toRef(() => props.live2dIdleAnimationEnabled)
const live2dAutoBlinkEnabled = toRef(() => props.live2dAutoBlinkEnabled)
const live2dForceAutoBlinkEnabled = toRef(() => props.live2dForceAutoBlinkEnabled)
const live2dShadowEnabled = toRef(() => props.live2dShadowEnabled)

const localCurrentMotion = ref<{ group: string; index: number }>({ group: 'Idle', index: 0 })
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

function parseVTubeJson(text: string): { savedActiveExpressions: string[]; artMeshColors: Record<string, string> } {
  const vtubeData = JSON.parse(text) as Record<string, unknown>
  const artMeshColors = extractArtMeshColorsFromVTube(vtubeData)
  if (Object.keys(artMeshColors).length === 0) {
    console.warn(
      '[Live2D] .vtube.json parsed but no ArtMesh multiply/screen colors found. Related keys:',
      listVTubeColorRelatedKeys(vtubeData),
    )
  }
  return {
    artMeshColors,
    savedActiveExpressions: Array.isArray(vtubeData.SavedActiveExpressions)
      ? (vtubeData.SavedActiveExpressions as string[])
      : [],
  }
}

async function extractFromZip(
  zip: JSZip,
  filePaths: string[],
): Promise<{
  cdiData: Record<string, unknown> | null
  expFiles: Live2DExpressionFile[]
  savedActiveExpressions: string[]
  artMeshColors: Record<string, string>
}> {
  let cdiData: Record<string, unknown> | null = null
  const expFiles: Live2DExpressionFile[] = []
  let savedActiveExpressions: string[] = []
  let artMeshColors: Record<string, string> = {}

  const cdiPath = filePaths.find((f: string) => f.toLowerCase().endsWith('.cdi3.json'))
  if (cdiPath) {
    const text = await zip.file(cdiPath)?.async('text')
    if (text) cdiData = JSON.parse(text)
  }

  const expPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.exp3.json'))
  const expResults = await Promise.all(
    expPaths.map(async (expPath) => {
      const text = await zip.file(expPath)?.async('text')
      if (text) {
        const baseName = expPath.split('/').pop()?.replace('.exp3.json', '') || expPath
        return {
          data: JSON.parse(text),
          fileName: expPath,
          name: baseName,
        }
      }
      return null
    }),
  )
  for (const result of expResults) {
    if (result) expFiles.push(result)
  }

  const vtubePath = filePaths.find((f: string) => f.toLowerCase().endsWith('.vtube.json'))
  if (vtubePath) {
    try {
      const text = await zip.file(vtubePath)?.async('text')
      if (text) {
        const parsed = parseVTubeJson(text)
        savedActiveExpressions = parsed.savedActiveExpressions
        artMeshColors = parsed.artMeshColors
      }
    } catch {
      // intentionally empty - vtube.json parsing failure is non-critical
    }
  }

  return { artMeshColors, cdiData, expFiles, savedActiveExpressions }
}

async function extractFromFiles(cachedFiles: File[]): Promise<{
  cdiData: Record<string, unknown> | null
  expFiles: Live2DExpressionFile[]
  savedActiveExpressions: string[]
  artMeshColors: Record<string, string>
}> {
  let cdiData: Record<string, unknown> | null = null
  const expFiles: Live2DExpressionFile[] = []
  let savedActiveExpressions: string[] = []
  let artMeshColors: Record<string, string> = {}

  const cdiFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.cdi3.json'))
  if (cdiFile) {
    const text = await cdiFile.text()
    cdiData = JSON.parse(text)
  }

  const cachedExpFiles = cachedFiles.filter((f: File) => f.name.toLowerCase().endsWith('.exp3.json'))
  const cachedExpResults = await Promise.all(
    cachedExpFiles.map(async (expFile) => {
      const text = await expFile.text()
      const baseName = expFile.name.split('/').pop()?.replace('.exp3.json', '') || expFile.name
      return {
        data: JSON.parse(text),
        fileName: expFile.webkitRelativePath || expFile.name,
        name: baseName,
      }
    }),
  )
  expFiles.push(...cachedExpResults)

  const vtubeFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.vtube.json'))
  if (vtubeFile) {
    try {
      const text = await vtubeFile.text()
      const parsed = parseVTubeJson(text)
      savedActiveExpressions = parsed.savedActiveExpressions
      artMeshColors = parsed.artMeshColors
    } catch {
      // intentionally empty - vtube.json parsing failure is non-critical
    }
  }

  return { artMeshColors, cdiData, expFiles, savedActiveExpressions }
}

async function resolveMetadata(): Promise<ResolvedMetadata> {
  const cdiData: Record<string, unknown> | null = null
  const expFiles: Live2DExpressionFile[] = []
  let savedActiveExpressions: string[] = []
  let artMeshColors: Record<string, string> = {}

  // Case 1: Direct File upload (ZIP file)
  if (props.modelFile && props.modelFile.name.toLowerCase().endsWith('.zip')) {
    try {
      const buffer = await props.modelFile.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      const filePaths = Object.keys(zip.files)
      const result = await extractFromZip(zip, filePaths)

      console.info(
        '[Live2D Metadata] Extracted CDI, EXP & VTube config directly from uploaded ZIP file',
        Object.keys(result.artMeshColors).length > 0
          ? `(${Object.keys(result.artMeshColors).length} ArtMesh colors)`
          : '(no ArtMesh colors in .vtube.json)',
      )
      return { ...result, cdiData: result.cdiData }
    } catch (e) {
      console.warn('[Live2D Metadata] Failed to parse uploaded ZIP file:', e)
    }
  }

  // Case 2: OPFS Cache (already unzipped individual files)
  if (props.modelId && props.modelSrc) {
    try {
      const cachedFiles = await OPFSCacheV2.get(props.modelId, props.modelSrc)
      if (cachedFiles) {
        const zipFile = cachedFiles.find((f: File) => f.name.toLowerCase().endsWith('.zip'))
        if (zipFile) {
          const buffer = await zipFile.arrayBuffer()
          const zip = await JSZip.loadAsync(buffer)
          const filePaths = Object.keys(zip.files)
          const result = await extractFromZip(zip, filePaths)
          console.info('[Live2D Metadata] Extracted CDI, EXP & VTube config from cached ZIP file in OPFS')
          return { ...result, cdiData: result.cdiData }
        } else {
          const result = await extractFromFiles(cachedFiles)
          console.info('[Live2D Metadata] Extracted CDI, EXP & VTube config directly from cached files in OPFS')
          return { ...result, cdiData: result.cdiData }
        }
      }
    } catch (e) {
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
        const resp = await fetch(`${baseUrl}${encodeURIComponent(vtubeFileName)}`)
        if (!resp.ok) continue
        const parsed = parseVTubeJson(await resp.text())
        savedActiveExpressions = parsed.savedActiveExpressions
        artMeshColors = parsed.artMeshColors
        if (Object.keys(artMeshColors).length > 0) {
          console.info(
            '[Live2D Metadata] Extracted ArtMesh colors from HTTP .vtube.json:',
            vtubeFileName,
            Object.keys(artMeshColors).length,
          )
          break
        }
      } catch {
        // intentionally empty - vtube.json fetching failure is non-critical
      }
    }
  }

  return { artMeshColors, cdiData, expFiles, savedActiveExpressions }
}

function isStageRoute(): boolean {
  const hash = window.location.hash || '#/'
  return hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')
}

function setupModelScene(live2DModel: Live2DModel<PixiLive2DInternalModel>) {
  model.value = live2DModel
  pixiApp.value?.stage?.addChild(model.value)
  model.value.update(0)
  const bounds = model.value.getLocalBounds()
  const logicalWidth = model.value.internalModel.width
  const logicalHeight = model.value.internalModel.height

  console.info(
    `[Live2D Load] Logical Canvas: ${logicalWidth}x${logicalHeight} | True Bounds: ${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)}`,
  )

  if (bounds.width > logicalWidth || bounds.height > logicalHeight) {
    initialModelWidth.value = bounds.width
    initialModelHeight.value = bounds.height
  } else {
    initialModelWidth.value = logicalWidth
    initialModelHeight.value = logicalHeight
  }

  model.value.anchor.set(0.5, 0.5)
  setScaleAndPosition()
}

function setupModelInteraction(live2DModel: Live2DModel<PixiLive2DInternalModel>) {
  const settings = live2DModel.internalModel?.settings as { hitAreas?: Live2DHitArea[] } | undefined
  const declaredHitAreas = settings?.hitAreas ?? []
  console.info(
    `[Live2D Tactile] Loaded model has ${declaredHitAreas.length} hitboxes:`,
    declaredHitAreas.map((h: Live2DHitArea) => `${h.Name || h.name} -> ${h.Id || h.id}`),
  )

  model.value?.on('hit', (hitAreas) => {
    if (model.value && hitAreas.includes('body')) model.value.motion('tap_body')
  })
}

function buildAvailableMotions(motionManager: PixiLive2DInternalModel['motionManager']): void {
  availableMotions.value = Object.entries(motionManager.definitions)
    .flatMap(
      ([motionName, definition]) =>
        (definition as Live2DMotionDefinition[] | undefined)?.map((motion: Live2DMotionDefinition, index: number) => ({
          fileName: motion.File ?? motion.file ?? '',
          motionIndex: index,
          motionName,
        })) || [],
    )
    .filter(Boolean)
}

function configureMotionLoop(
  motionManager: PixiLive2DInternalModel['motionManager'],
  groupName: string,
  indexStr: string,
) {
  const groups = motionManager.groups as unknown as Record<string, number | undefined>
  const groupIndex = groups[groupName]
  if (groupIndex !== undefined && motionManager.motionGroups[groupIndex]) {
    const motionIndex = Number.parseInt(indexStr, 10)
    const motion = motionManager.motionGroups[groupIndex][motionIndex]
    if (motion && motion._looper) {
      motion._looper.loopDuration = 0
      console.info('[Live2D Cycle] Configured motion to loop infinitely:', groupName, motionIndex)
    }
  }
}

function parseCycleMotions() {
  return (
    props.idleAnimations
      ?.filter((k) => k.startsWith('live2d:'))
      .map((k) => {
        const [_, group, indexStr] = k.split(':')
        return {
          group,
          index: Number.parseInt(indexStr),
        }
      }) ?? []
  )
}

function setupMotionLooping(motionManager: PixiLive2DInternalModel['motionManager']) {
  const cycleMotions = parseCycleMotions()

  if (cycleMotions.length > 0) {
    cycleMotions.forEach((m) => configureMotionLoop(motionManager, m.group, String(m.index)))
  } else {
    const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
    const selectedMotionIndex = localStorage.getItem('selected-runtime-motion-index')
    if (selectedMotionGroup !== null && selectedMotionIndex) {
      configureMotionLoop(motionManager, selectedMotionGroup, selectedMotionIndex)
    }
  }
}

function scheduleInitialMotion() {
  const cycleMotions = parseCycleMotions()

  if (cycleMotions.length > 0) {
    setTimeout(() => {
      console.info(
        '[Live2D Cycle] Playing initial motion from card cycle subset:',
        cycleMotions[0].group,
        cycleMotions[0].index,
      )
      currentMotion.value = {
        group: cycleMotions[0].group,
        index: cycleMotions[0].index,
      }
    }, 300)
  } else {
    const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
    const selectedMotionIndex = localStorage.getItem('selected-runtime-motion-index')
    if (selectedMotionGroup !== null && selectedMotionIndex) {
      setTimeout(() => {
        console.info('Playing selected runtime motion:', selectedMotionGroup, selectedMotionIndex)
        currentMotion.value = {
          group: selectedMotionGroup,
          index: Number.parseInt(selectedMotionIndex),
        }
      }, 300)
    }
  }
}

function removeIdleEyeBallMovements(motionManager: PixiLive2DInternalModel['motionManager']) {
  if (motionManager.groups.idle) {
    motionManager.motionGroups[motionManager.groups.idle]?.forEach((motion) => {
      motion._motionData.curves.forEach((curve: { id: string }) => {
        if (curve.id === 'ParamEyeBallX' || curve.id === 'ParamEyeBallY') {
          curve.id = `_${curve.id}`
        }
      })
    })
  }
}

function setupMotionManagerPlugins(
  internalModel: PixiLive2DInternalModel,
  motionManager: PixiLive2DInternalModel['motionManager'],
) {
  const motionManagerUpdate = useLive2DMotionManagerUpdate({
    internalModel,
    lastUpdateTime,
    live2dAutoBlinkEnabled,
    live2dForceAutoBlinkEnabled,
    live2dIdleAnimationEnabled,
    modelParameters,
    motionManager,
  })

  motionManagerUpdate.register(useMotionUpdatePluginBeatSync(beatSync), 'pre')
  motionManagerUpdate.register(useMotionUpdatePluginIdleDisable(), 'pre')
  motionManagerUpdate.register(useMotionUpdatePluginIdleFocus(), 'post')
  motionManagerUpdate.register(useMotionUpdatePluginAutoEyeBlink(), 'post')

  hookArtMeshColorsAfterModelUpdate(internalModel, artMeshColors)

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

  motionManagerUpdate.register((ctx) => {
    const params = ctx.modelParameters.value
    for (const key in params) {
      if (!standardKeys.has(key) && key.startsWith('Param')) {
        try {
          ctx.model.setParameterValueById(key, params[key] as number)
        } catch {
          // intentionally empty - parameter setting failure is non-critical
        }
      }
    }
  }, 'post')

  const hookedUpdate = motionManager.update as (model: PixiLive2DInternalModel['coreModel'], now: number) => boolean
  motionManager.update = (m: PixiLive2DInternalModel['coreModel'], now: number) =>
    motionManagerUpdate.hookUpdate(m, now, hookedUpdate)
}

function setupMotionEventHandlers(motionManager: PixiLive2DInternalModel['motionManager']) {
  motionManager.on('motionStart', (group, index, audio) => {
    localCurrentMotion.value = { group, index }

    if (!isStageRoute() && audio) {
      try {
        audio.muted = true
        audio.pause()
      } catch (e) {
        console.warn('[Live2D Audio] Failed to mute/pause non-leader audio:', e)
      }
    }
  })

  motionManager.on('motionFinish', () => {
    if (!live2dIdleAnimationEnabled.value) return

    const cycleMotions = parseCycleMotions()

    if (cycleMotions.length > 0) {
      let nextMotion = cycleMotions[0]
      if (cycleMotions.length > 1) {
        const current = currentMotion.value
        const choices = cycleMotions.filter((m) => m.group !== current?.group || m.index !== current?.index)
        const selection = choices.length > 0 ? choices : cycleMotions
        nextMotion = selection[Math.floor(Math.random() * selection.length)]
      }
      console.info('[Live2D Cycle] Motion finished, playing next subset motion:', nextMotion.group, nextMotion.index)
      requestAnimationFrame(() => {
        currentMotion.value = { group: nextMotion.group, index: nextMotion.index }
      })
      return
    }

    const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
    const selectedMotionIndex = localStorage.getItem('selected-runtime-motion-index')
    if (selectedMotionGroup !== null && selectedMotionIndex) {
      console.info('Motion finished, restarting runtime motion:', selectedMotionGroup, selectedMotionIndex)
      requestAnimationFrame(() => {
        currentMotion.value = {
          group: selectedMotionGroup,
          index: Number.parseInt(selectedMotionIndex),
        }
      })
    }
  })
}

function applyStoredParameters(coreModel: PixiLive2DInternalModel['coreModel']) {
  coreModel.setParameterValueById('ParamMouthOpenY', modelParameters.value.mouthOpen)
  coreModel.setParameterValueById('ParamMouthForm', modelParameters.value.mouthForm)
  coreModel.setParameterValueById('ParamCheek', modelParameters.value.cheek)
  coreModel.setParameterValueById('ParamBodyAngleX', modelParameters.value.bodyAngleX)
  coreModel.setParameterValueById('ParamBodyAngleY', modelParameters.value.bodyAngleY)
  coreModel.setParameterValueById('ParamBodyAngleZ', modelParameters.value.bodyAngleZ)
  coreModel.setParameterValueById('ParamBreath', modelParameters.value.breath)
}

function getParameterValue(internalModel: PixiLive2DInternalModel, id: string): number {
  try {
    return (
      (internalModel.coreModel as unknown as { getParameterValueById: (id: string) => number }).getParameterValueById(
        id,
      ) || 0
    )
  } catch {
    return 0
  }
}

function populateParameterMetadataFromCdi(
  cdiData: Record<string, unknown>,
  internalModel: PixiLive2DInternalModel,
): void {
  const cdiParams =
    (cdiData?.Parameters as Live2DCdiParameter[] | undefined) ||
    (cdiData?.parameters as Live2DCdiParameter[] | undefined)
  if (!cdiParams) return

  const newParameters: Record<string, number> = {}
  cdiParams.forEach((p: Live2DCdiParameter) => {
    const id = p.Id || p.id
    if (id && modelParameters.value[id] === undefined) {
      newParameters[id] = getParameterValue(internalModel, id)
    }
  })
  Object.assign(modelParameters.value, newParameters)

  parameterMetadata.value = cdiParams.map((p: Live2DCdiParameter) => ({
    groupId: p.GroupId || p.groupId,
    id: p.Id || p.id || '',
    name: p.Name || p.name || p.Id || p.id || '',
  }))

  const groups =
    (cdiData?.ParameterGroups as Live2DCdiGroup[] | undefined) ||
    (cdiData?.parameterGroups as Live2DCdiGroup[] | undefined)
  if (groups) {
    parameterMetadata.value.forEach((p) => {
      const group = groups.find((g: Live2DCdiGroup) => (g.Id || g.id) === p.groupId)
      if (group) p.groupName = group.Name || group.name
    })
  }
  console.info('Populated parameterMetadata from CDI:', parameterMetadata.value.length)
}

function populateParameterMetadataFromCore(internalModel: PixiLive2DInternalModel): void {
  try {
    const core = internalModel.coreModel as unknown as {
      _parameterIds?: string[]
      _model?: { _parameterIds?: string[] }
    }
    const paramIds = core?._parameterIds || core?._model?._parameterIds || []
    if (paramIds.length === 0) return

    parameterMetadata.value = paramIds.map((id: string) => ({ id, name: id }))
    const newCoreParameters: Record<string, number> = {}
    for (const p of parameterMetadata.value) {
      if (modelParameters.value[p.id] === undefined) {
        newCoreParameters[p.id] = getParameterValue(internalModel, p.id)
      }
    }
    Object.assign(modelParameters.value, newCoreParameters)
  } catch (e) {
    console.warn('Could not extract parameter IDs from core model:', e)
  }
}

async function fetchCdiFromUrl(cdiFileName: string): Promise<Record<string, unknown> | null> {
  if (!props.modelSrc || props.modelSrc.startsWith('blob:')) return null

  const baseUrl = props.modelSrc.substring(0, props.modelSrc.lastIndexOf('/') + 1)
  try {
    const resp = await fetch(`${baseUrl}${encodeURIComponent(cdiFileName)}`)
    if (resp.ok && !isUnmounted.value && model.value) return (await resp.json()) as Record<string, unknown>
  } catch {
    // intentionally empty - CDI fetching failure is non-critical
  }
  return null
}

async function resolveCdiData(
  resolvedMeta: ResolvedMetadata,
  settings: { _cdiData?: Record<string, unknown> } | undefined,
  fileRefs: Record<string, unknown> | undefined,
): Promise<Record<string, unknown> | null> {
  const cdiData = resolvedMeta.cdiData || settings?._cdiData || null
  if (cdiData) return cdiData

  const cdiFileName = (fileRefs?.DisplayInfo as string | undefined) || (fileRefs?.Cdi as string | undefined)
  if (!cdiFileName) return null

  return await fetchCdiFromUrl(cdiFileName)
}

function applyExpressionFiles(expFiles: Live2DExpressionFile[]): void {
  availableExpressions.value = expFiles.map((exp: Live2DExpressionFile) => ({
    fileName: exp.fileName,
    name: exp.name,
  }))
  expressionData.value = expFiles.map((exp: Live2DExpressionFile) => ({
    data: exp.data ?? {},
    fileName: exp.fileName,
    name: exp.name,
  }))
  console.info('Populated expressions from zip-extracted files:', expFiles.length)
}

async function fetchExpressionDataFromUrls(): Promise<void> {
  if (!props.modelSrc || props.modelSrc.startsWith('blob:')) return

  const baseUrl = props.modelSrc.substring(0, props.modelSrc.lastIndexOf('/') + 1)
  const fetchPromises = availableExpressions.value.map(async (exp) => {
    try {
      const resp = await fetch(`${baseUrl}${encodeURIComponent(exp.fileName)}`)
      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>
        return { data, fileName: exp.fileName, name: exp.name }
      }
    } catch (err) {
      console.warn(`[Live2D] Failed to fetch expression ${exp.fileName}:`, err)
    }
    return null
  })
  const results = await Promise.all(fetchPromises)
  if (!isUnmounted.value && model.value) {
    expressionData.value = results.filter(
      (r): r is { name: string; fileName: string; data: Record<string, unknown> } => r !== null,
    )
    console.info('Fetched expression data from URLs:', expressionData.value.length)
  }
}

function populateExpressionsFromFileRefs(
  expressions: Array<{ Name?: string; name?: string; File?: string; file?: string }>,
): void {
  availableExpressions.value = expressions.map((exp) => ({
    fileName: exp.File || exp.file || '',
    name: exp.Name || exp.name || exp.File?.split('/').pop()?.replace('.exp3.json', '') || '',
  }))
  console.info('Populated expressions from FileRefs:', availableExpressions.value.length)
}

function populateExpressionsFromManager(internalModel: PixiLive2DInternalModel): void {
  const expressionManager = (
    internalModel as unknown as {
      expressionManager?: { definitions?: Record<string, { File?: string; file?: string }> }
    }
  ).expressionManager
  if (!expressionManager?.definitions) return

  const defs = expressionManager.definitions
  availableExpressions.value = Object.keys(defs).map((name) => ({
    fileName: defs[name]?.File || defs[name]?.file || name,
    name,
  }))
  console.info('Populated expressions from expressionManager:', availableExpressions.value.length)
}

async function resolveExpressionMetadata(
  resolvedMeta: ResolvedMetadata,
  settings: { _expFiles?: Live2DExpressionFile[] } | undefined,
  fileRefs: Record<string, unknown> | undefined,
  internalModel: PixiLive2DInternalModel,
): Promise<void> {
  const expFiles =
    resolvedMeta.expFiles && resolvedMeta.expFiles.length > 0 ? resolvedMeta.expFiles : (settings?._expFiles ?? [])
  if (expFiles && expFiles.length > 0) {
    applyExpressionFiles(expFiles)
    return
  }

  const expressions =
    (fileRefs?.Expressions as Array<{ Name?: string; name?: string; File?: string; file?: string }> | undefined) ||
    (fileRefs?.expressions as Array<{ Name?: string; name?: string; File?: string; file?: string }> | undefined)
  if (expressions && Array.isArray(expressions)) {
    populateExpressionsFromFileRefs(expressions)
    await fetchExpressionDataFromUrls()
    return
  }

  populateExpressionsFromManager(internalModel)
}

function applySavedActiveExpressions(savedActiveExpressions: string[], modelKey: string): void {
  const defaultsLoadedKey = `live2d_vtube_defaults_loaded_${modelKey}`
  if (localStorage.getItem(defaultsLoadedKey) === 'true') return

  if (!savedActiveExpressions || savedActiveExpressions.length === 0) return

  console.info('[Live2D] Activating saved active expressions from .vtube.json:', savedActiveExpressions)
  for (const savedExp of savedActiveExpressions) {
    const expEntry = expressionData.value.find((e: Live2DExpressionEntry) => {
      const eName = e.fileName.split('/').pop()?.toLowerCase()
      const sName = savedExp.split('/').pop()?.toLowerCase()
      return eName === sName
    })
    if (expEntry) {
      activeExpressions.value[expEntry.fileName] = 1
    }
  }
  localStorage.setItem(defaultsLoadedKey, 'true')
}

function pruneInvalidActiveExpressions(): void {
  const validKeys = new Set(availableExpressions.value.map((e) => e.fileName))
  const prevCount = Object.keys(activeExpressions.value).length
  const filtered = Object.fromEntries(Object.entries(activeExpressions.value).filter(([key]) => validKeys.has(key)))
  if (Object.keys(filtered).length !== prevCount) {
    activeExpressions.value = filtered
  }
}

function applyExpressionParameters(): void {
  if (expressionData.value.length === 0 || Object.keys(activeExpressions.value).length === 0) return

  for (const [fileName, weight] of Object.entries(activeExpressions.value)) {
    if (weight <= 0) continue

    const expEntry = expressionData.value.find((e: Live2DExpressionEntry) => e.fileName === fileName)
    if (!expEntry?.data || typeof expEntry.data !== 'object') continue

    const params = (
      expEntry.data as { Parameters?: Array<{ Id?: string; id?: string; Value?: number; value?: number }> }
    ).Parameters
    if (!params) continue

    for (const param of params) {
      const id = param.Id || param.id
      const value = param.Value ?? param.value
      if (id !== undefined && value !== undefined) {
        modelParameters.value[id] = value
      }
    }
  }
}

async function parseAndApplyMetadata(internalModel: PixiLive2DInternalModel) {
  try {
    const settings = internalModel.settings as
      | { json?: Record<string, unknown>; _cdiData?: Record<string, unknown>; _expFiles?: Live2DExpressionFile[] }
      | undefined
    const rawJson = settings?.json as Record<string, unknown> | undefined
    const fileRefs =
      (rawJson?.FileReferences as Record<string, unknown> | undefined) ||
      (rawJson?.fileReferences as Record<string, unknown> | undefined)

    const resolvedMeta = await resolveMetadata()
    const cdiData = await resolveCdiData(resolvedMeta, settings, fileRefs)

    artMeshColors.value = resolvedMeta.artMeshColors || {}
    if (Object.keys(artMeshColors.value).length > 0) {
      console.info('[Live2D] Loaded ArtMesh colors from .vtube.json:', Object.keys(artMeshColors.value).length)
    }

    if (cdiData && !isUnmounted.value && model.value) {
      populateParameterMetadataFromCdi(cdiData, internalModel)
    }

    if (parameterMetadata.value.length === 0) {
      populateParameterMetadataFromCore(internalModel)
    }

    await resolveExpressionMetadata(resolvedMeta, settings, fileRefs, internalModel)

    const modelKey = props.modelId || props.modelSrc
    if (modelKey) {
      applySavedActiveExpressions(resolvedMeta.savedActiveExpressions, modelKey)
    }

    pruneInvalidActiveExpressions()
    applyExpressionParameters()
  } catch (e) {
    console.error('[Live2D-Alpha] Metadata parsing failure:', e)
  }
}

function resetLoadingState(): void {
  availableExpressions.value = []
  expressionData.value = []
  componentState.value = 'loading'
}

async function waitForPixiApp(): Promise<boolean> {
  if (pixiApp.value?.stage) return true

  try {
    await until(() => Boolean(pixiApp.value?.stage)).toBeTruthy({ timeout: 1500 })
    return true
  } catch {
    return false
  }
}

function destroyOldModel(): void {
  if (!model.value || !pixiApp.value?.stage) return

  try {
    pixiApp.value.stage.removeChild(model.value)
    model.value.destroy()
  } catch (error) {
    console.warn('Error removing old model:', error)
  }
  model.value = undefined
}

function populateMotionMap(): void {
  availableMotions.value.forEach((motion) => {
    if (motion.motionName in Emotion) {
      motionMap.value[motion.fileName] = motion.motionName
    } else {
      motionMap.value[motion.fileName] = EmotionNeutralMotionName
    }
  })
}

function setupModelPipeline(live2DModel: Live2DModel<PixiLive2DInternalModel>): void {
  setupModelScene(live2DModel)
  setupModelInteraction(live2DModel)

  if (!model.value) {
    console.warn('[Live2D] setupModelPipeline called but model is not set')
    return
  }
  const internalModel = model.value.internalModel
  const coreModel = internalModel.coreModel
  const motionManager = internalModel.motionManager
  coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenSize.value)

  buildAvailableMotions(motionManager)
  setupMotionLooping(motionManager)

  if (live2dIdleAnimationEnabled.value) {
    scheduleInitialMotion()
  }

  removeIdleEyeBallMovements(motionManager)
  setupMotionManagerPlugins(internalModel, motionManager)
  setupMotionEventHandlers(motionManager)

  applyStoredParameters(coreModel)
}

function finalizeModelLoad(live2DModel: Live2DModel<PixiLive2DInternalModel>): void {
  populateMotionMap()
  setupModelPipeline(live2DModel)
}

async function loadModel() {
  live2dLogger.log('loadModel() called', {
    modelFile: props.modelFile?.name,
    modelId: props.modelId,
    modelSrc: modelSrcRef.value,
  })
  live2dLogger.time('live2d:loadModel')
  config.sound = isStageRoute()

  await until(modelLoading).not.toBeTruthy()
  await modelLoadMutex.acquire()

  modelLoading.value = true
  resetLoadingState()

  if (!(await waitForPixiApp())) {
    live2dLogger.warn('Pixi app not ready after timeout')
    modelLoading.value = false
    componentState.value = 'mounted'
    return
  }

  destroyOldModel()

  if (!modelSrcRef.value) {
    live2dLogger.warn('No Live2D model source provided')
    modelLoading.value = false
    componentState.value = 'mounted'
    return
  }

  if (isUnmounted.value) {
    live2dLogger.warn('Component unmounted before load could start')
    modelLoading.value = false
    componentState.value = 'mounted'
    return
  }

  try {
    live2dLogger.log('Creating Live2DModel instance...')
    const live2DModel = new Live2DModel<PixiLive2DInternalModel>()
    live2dLogger.log('Calling Live2DFactory.setupLive2DModel...', {
      file: props.modelFile?.name,
      id: props.modelId,
      url: modelSrcRef.value,
    })
    live2dLogger.time('live2d:setupLive2DModel')
    await Live2DFactory.setupLive2DModel(
      live2DModel,
      { file: props.modelFile, id: props.modelId, url: modelSrcRef.value },
      { autoInteract: false },
    )
    live2dLogger.timeEnd('live2d:setupLive2DModel')
    live2dLogger.log('Live2DFactory.setupLive2DModel completed ✓')

    if (isUnmounted.value || !pixiApp.value || !pixiApp.value.stage) {
      live2dLogger.warn('Component unmounted or Pixi app lost during load')
      live2DModel.destroy()
      modelLoading.value = false
      componentState.value = 'mounted'
      return
    }

    live2dLogger.log('Finalizing model load (scene, interaction, motions, metadata)...')
    finalizeModelLoad(live2DModel)
    if (!model.value) {
      live2dLogger.warn('model not set after finalizeModelLoad')
      return
    }
    live2dLogger.log('Parsing and applying metadata...')
    await parseAndApplyMetadata(model.value.internalModel)

    emits('modelLoaded')
    live2dLogger.log('Live2D model fully loaded and mounted ✓')
    live2dLogger.timeEnd('live2d:loadModel')
  } catch (error) {
    live2dLogger.error('Failed to load Live2D model:', error)
    emits('error', error instanceof Error ? error : new Error(String(error)))
  } finally {
    modelLoading.value = false
    componentState.value = 'mounted'
    modelLoadMutex.release()
  }
}

async function setMotion(motionName: string, index?: number) {
  if (!model.value) {
    console.warn('Cannot set motion: model not loaded')
    return
  }

  if (!motionName || index === -1) {
    console.info('Stopping all motions (standstill/none state)')
    try {
      model.value.internalModel.motionManager.stopAllMotions()
    } catch (e) {
      console.warn('Failed to stop all motions:', e)
    }
    return
  }

  console.info('Setting motion:', motionName, 'index:', index)
  try {
    await model.value.motion(motionName, index, MotionPriority.FORCE)
    console.info('Motion started successfully:', motionName)
  } catch (error) {
    console.error('Failed to start motion:', motionName, error)
  }
}

const dropShadowColorComputer = ref<HTMLDivElement>()
const dropShadowAnimationId = ref(0)

function updateDropShadowFilter() {
  if (!model.value) return

  if (!live2dShadowEnabled.value) {
    model.value.filters = []
    return
  }

  if (!dropShadowColorComputer.value) return

  const color = getComputedStyle(dropShadowColorComputer.value).backgroundColor
  const hex = formatHex(color)
  if (!hex) return

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
watch([offset, () => props.scale, () => props.xOffset, () => props.yOffset], setScaleAndPosition)

// Wrap drop shadow loop state in an IIFE to avoid polluting module scope
const { updateDropShadowFilterLoop } = (() => {
  let dropShadowFrameCounter = 0

  function updateDropShadowFilterLoop() {
    if (isUnmounted.value) {
      dropShadowAnimationId.value = 0
      return
    }

    dropShadowFrameCounter++
    if (dropShadowFrameCounter % 10 === 0) {
      updateDropShadowFilter()
    }

    if (!live2dShadowEnabled.value) {
      dropShadowAnimationId.value = 0
      return
    }

    dropShadowAnimationId.value = requestAnimationFrame(updateDropShadowFilterLoop)
  }

  return { updateDropShadowFilterLoop }
})()

watch(
  [themeColorsHueDynamic, live2dShadowEnabled],
  ([dynamic, shadowEnabled]) => {
    if (dynamic && shadowEnabled) {
      dropShadowAnimationId.value = requestAnimationFrame(updateDropShadowFilterLoop)
    } else {
      cancelAnimationFrame(dropShadowAnimationId.value)
      dropShadowAnimationId.value = 0
    }
  },
  { immediate: true },
)

watch(mouthOpenSize, (value) => {
  const coreModel = getCoreModel()
  if (coreModel) {
    coreModel.setParameterValueById('ParamMouthOpenY', value)
  }
})
watch(currentMotion, (value) => setMotion(value.group, value.index))
watch(paused, (value) => (value ? pixiApp.value?.stop() : pixiApp.value?.start()))

watch(model, (currModel) => {
  if (currModel) {
    applyParameters(currModel.internalModel.coreModel as PixiLive2DInternalModel['coreModel'], modelParameters.value)
  }
})

watch(
  modelParameters,
  (params) => {
    const coreModel = getCoreModel()
    if (coreModel) {
      applyParameters(coreModel, params)
    }
  },
  { deep: true },
)

const STANDARD_PARAM_KEYS = [
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

function applyParameters(coreModel: PixiLive2DInternalModel['coreModel'], params: Record<string, number>) {
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

  Object.entries(params).forEach(([key, value]) => {
    if (!STANDARD_PARAM_KEYS.includes(key)) {
      coreModel.setParameterValueById(key, value)
    }
  })
}

watch(live2dIdleAnimationEnabled, (enabled) => {
  if (!enabled && model.value) {
    const internalModel = model.value.internalModel
    internalModel?.motionManager?.stopAllMotions()
  }
})

watch(focusAt, (value) => {
  if (!model.value || props.disableFocusAt) return
  model.value.focus(value.x, value.y)
})

// Wrap canvas interaction state in an IIFE to avoid polluting module scope
const { setupCanvasListeners, cleanupCanvasListeners, interactionMode } = (() => {
  const interactionMode = toRef(() => props.interactionMode)
  let hoveredArea: string | null = null
  let boundCanvas: HTMLCanvasElement | null = null

  function onCanvasMouseMove(event: MouseEvent) {
    if (interactionMode.value !== 'tactile' || !model.value || !props.app) return

    const canvasEl = props.app.view as HTMLCanvasElement
    if (!canvasEl) return

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
        console.info(
          `[Live2D Tactile] Hovered hit area: ${hitArea} at global(${globalX.toFixed(1)}, ${globalY.toFixed(1)})`,
        )
      }
      emits('hitAreaHover', { hovered: true, name: hitArea, x: mouseX, y: mouseY })
    } else if (hoveredArea) {
      hoveredArea = null
      emits('hitAreaHover', null)
    }
  }

  function findMatchingMotionGroup(
    motionManager: PixiLive2DInternalModel['motionManager'],
    hitArea: string,
  ): string | undefined {
    const groups = Object.keys(motionManager.definitions || {})
    const hitLower = hitArea.toLowerCase()

    return (
      groups.find((g) => g.toLowerCase() === hitLower) ||
      groups.find((g) => g.toLowerCase().startsWith(hitLower)) ||
      groups.find((g) => hitLower.startsWith(g.toLowerCase())) ||
      groups.find((g) => g.toLowerCase().includes(hitLower)) ||
      groups.find((g) => hitLower.includes(g.toLowerCase()))
    )
  }

  function onCanvasClick(event: MouseEvent) {
    if (interactionMode.value !== 'tactile' || !model.value || !props.app) return

    const canvasEl = props.app.view as HTMLCanvasElement
    if (!canvasEl) return

    const rect = canvasEl.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    const globalX = mouseX * (props.app.screen.width / rect.width)
    const globalY = mouseY * (props.app.screen.height / rect.height)

    const hitAreas = model.value.hitTest(globalX, globalY)
    if (hitAreas && hitAreas.length > 0) {
      const hitArea = hitAreas[0]
      console.info(
        `[Live2D Tactile] Clicked hit area: ${hitArea} at global(${globalX.toFixed(1)}, ${globalY.toFixed(1)})`,
      )

      const internalModel = model.value.internalModel
      const motionManager = internalModel?.motionManager
      if (!motionManager) return

      const matchedGroup = findMatchingMotionGroup(motionManager, hitArea)
      if (matchedGroup) {
        const definitions = motionManager.definitions[matchedGroup] as Live2DMotionDefinition[] | undefined
        if (definitions && definitions.length > 0) {
          const randomIndex = Math.floor(Math.random() * definitions.length)
          console.info(
            `[Live2D Tactile] Playing motion for matched group: group="${matchedGroup}", index=${randomIndex}`,
          )
          model.value.motion(matchedGroup, randomIndex, MotionPriority.FORCE)
        }
      } else {
        console.warn(`[Live2D Tactile] No matching motion group found starting with or related to hitArea: ${hitArea}`)
        if (hitArea.toLowerCase().includes('body')) {
          model.value.motion('tap_body')
        }
      }
    }
  }

  function setupCanvasListeners() {
    cleanupCanvasListeners()

    if (interactionMode.value !== 'tactile' || !model.value || !props.app) return

    const canvasEl = props.app.view as HTMLCanvasElement
    if (!canvasEl) return

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

  return { cleanupCanvasListeners, interactionMode, setupCanvasListeners }
})()

watch(
  [interactionMode, model, () => props.app],
  () => {
    setupCanvasListeners()
  },
  { immediate: true },
)

onMounted(() => {
  const removeListener = listenBeatSyncBeatSignal(() => beatSync.scheduleBeat())
  onUnmounted(() => removeListener())
})

onMounted(() => {
  updateDropShadowFilter()
})

onUnmounted(() => {
  isUnmounted.value = true
  disposeShouldUpdateView?.()
  cleanupCanvasListeners()

  if (dropShadowAnimationId.value) {
    cancelAnimationFrame(dropShadowAnimationId.value)
    dropShadowAnimationId.value = 0
  }
})

function listMotionGroups() {
  return availableMotions.value
}

defineExpose({
  listMotionGroups,
  setMotion,
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
