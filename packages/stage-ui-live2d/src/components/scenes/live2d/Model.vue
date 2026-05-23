<script setup lang="ts">
import type { Application } from '@pixi/app'

import type { PixiLive2DInternalModel } from '../../../composables/live2d'

import JSZip from 'jszip'

import { listenBeatSyncBeatSignal } from '@proj-airi/stage-shared/beat-sync'
import { useTheme } from '@proj-airi/ui'
import { breakpointsTailwind, until, useBreakpoints, useDebounceFn } from '@vueuse/core'
import { formatHex } from 'culori'
import { Mutex } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { DropShadowFilter } from 'pixi-filters'
import { config, Live2DFactory, Live2DModel, MotionPriority } from 'pixi-live2d-display/cubism4'
import { computed, onMounted, onUnmounted, ref, shallowRef, toRef, watch } from 'vue'

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
}>(), {
  mouthOpenSize: 0,
  paused: false,
  focusAt: () => ({ x: 0, y: 0 }),
  disableFocusAt: false,
  scale: 1,
  themeColorsHue: 220.44,
  themeColorsHueDynamic: false,
  live2dIdleAnimationEnabled: true,
  live2dAutoBlinkEnabled: true,
  live2dForceAutoBlinkEnabled: false,
  live2dShadowEnabled: true,
  idleAnimations: () => [],
})

const emits = defineEmits<{
  (e: 'modelLoaded'): void
  (e: 'error', error: Error): void
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

const modelSrcRef = toRef(() => props.modelSrc)

const modelLoading = ref(false)
// NOTICE: boolean is sufficient; this flag is only used inside loadModel to bail out if the component unmounts mid-load.
let isUnmounted = false

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
const dropShadowFilter = shallowRef(new DropShadowFilter({
  alpha: 0.2,
  blur: 0,
  distance: 20,
  rotation: 45,
}))

function getCoreModel() {
  return model.value?.internalModel?.coreModel as any
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

      const expPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.exp3.json'))
      for (const expPath of expPaths) {
        const text = await zip.file(expPath)!.async('text')
        const baseName = expPath.split('/').pop()?.replace('.exp3.json', '') || expPath
        expFiles.push({
          name: baseName,
          fileName: expPath,
          data: JSON.parse(text),
        })
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

          const expPaths = filePaths.filter((f: string) => f.toLowerCase().endsWith('.exp3.json'))
          for (const expPath of expPaths) {
            const text = await zip.file(expPath)!.async('text')
            const baseName = expPath.split('/').pop()?.replace('.exp3.json', '') || expPath
            expFiles.push({
              name: baseName,
              fileName: expPath,
              data: JSON.parse(text),
            })
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

          const cachedExpFiles = cachedFiles.filter((f: File) => f.name.toLowerCase().endsWith('.exp3.json'))
          for (const expFile of cachedExpFiles) {
            const text = await expFile.text()
            const baseName = expFile.name.split('/').pop()?.replace('.exp3.json', '') || expFile.name
            expFiles.push({
              name: baseName,
              fileName: expFile.webkitRelativePath || expFile.name,
              data: JSON.parse(text),
            })
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
  const isStage = hash === '#/' || hash.startsWith('#/stage')
  config.sound = isStage

  await until(modelLoading).not.toBeTruthy()

  await modelLoadMutex.acquire()

  modelLoading.value = true
  availableExpressions.value = []
  expressionData.value = []

  // activeExpressions.value is NOT wiped here to preserve card state, ghost keys are cleaned up later
  componentState.value = 'loading'

  if (!pixiApp.value || !pixiApp.value.stage) {
    try {
      // NOTICE: shouldUpdateView can fire while the canvas (pixiApp) is being torn down/recreated.
      // Wait briefly for the new stage instead of bailing out, otherwise we keep a blank screen.
      await until(() => !!pixiApp.value && !!pixiApp.value.stage).toBeTruthy({ timeout: 1500 })
    }
    catch {
      modelLoading.value = false
      componentState.value = 'mounted'
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
    modelLoading.value = false
    componentState.value = 'mounted'
    return
  }

  try {
    if (isUnmounted) {
      modelLoading.value = false
      componentState.value = 'mounted'
      return
    }

    const live2DModel = new Live2DModel<PixiLive2DInternalModel>()
    await Live2DFactory.setupLive2DModel(live2DModel, { url: modelSrcRef.value, id: props.modelId, file: props.modelFile }, { autoInteract: false })

    // NOTICE: setupLive2DModel is async; pixiApp or stage could have been destroyed during the wait.
    if (isUnmounted || !pixiApp.value || !pixiApp.value.stage) {
      live2DModel.destroy()
      modelLoading.value = false
      componentState.value = 'mounted'
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

    model.value.on('hit', (hitAreas) => {
      if (model.value && hitAreas.includes('body'))
        model.value.motion('tap_body')
    })

    // --- Motion

    const internalModel = model.value.internalModel
    const coreModel = internalModel.coreModel
    const motionManager = internalModel.motionManager
    coreModel.setParameterValueById('ParamMouthOpenY', mouthOpenSize.value)

    availableMotions.value = Object
      .entries(motionManager.definitions)
      .flatMap(([motionName, definition]) => (definition?.map((motion: any, index: number) => ({
        motionName,
        motionIndex: index,
        fileName: motion.File,
      })) || []))
      .filter(Boolean)

    // Configure the loop settings for motions in the cycle subset or selected motion
    const cycleMotions = props.idleAnimations
      ?.filter(k => k.startsWith('live2d:'))
      .map((k) => {
        const [_, group, indexStr] = k.split(':')
        return {
          group,
          index: Number.parseInt(indexStr),
        }
      }) || []

    const configureMotionLoop = (groupName: string, indexStr: string) => {
      const groupIndex = (motionManager.groups as Record<string, any>)[groupName]
      if (groupIndex !== undefined && motionManager.motionGroups[groupIndex]) {
        const motionIndex = Number.parseInt(indexStr)
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
      const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
      const selectedMotionIndex = localStorage.getItem('selected-runtime-motion-index')
      if (selectedMotionGroup !== null && selectedMotionIndex) {
        configureMotionLoop(selectedMotionGroup, selectedMotionIndex)
      }
    }

    if (live2dIdleAnimationEnabled.value) {
      if (cycleMotions.length > 0) {
        setTimeout(() => {
          console.info('[Live2D Cycle] Playing initial motion from card cycle subset:', cycleMotions[0].group, cycleMotions[0].index)
          currentMotion.value = {
            group: cycleMotions[0].group,
            index: cycleMotions[0].index,
          }
        }, 300)
      }
      else {
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

    motionManagerUpdate.register(useMotionUpdatePluginBeatSync(beatSync), 'pre')
    motionManagerUpdate.register(useMotionUpdatePluginIdleDisable(), 'pre')
    motionManagerUpdate.register(useMotionUpdatePluginIdleFocus(), 'post')
    motionManagerUpdate.register(useMotionUpdatePluginAutoEyeBlink(), 'post')

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
      const isStage = hash === '#/' || hash.startsWith('#/stage')

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
        return
      }

      // Parse current card cycle subset
      const cycleMotions = props.idleAnimations
        ?.filter(k => k.startsWith('live2d:'))
        .map((k) => {
          const [_, group, indexStr] = k.split(':')
          return {
            group,
            index: Number.parseInt(indexStr),
          }
        }) || []

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

      const selectedMotionGroup = localStorage.getItem('selected-runtime-motion-group')
      const selectedMotionIndex = localStorage.getItem('selected-runtime-motion-index')

      if (selectedMotionGroup !== null && selectedMotionIndex) {
        // Restart the selected runtime motion immediately for seamless looping
        console.info('Motion finished, restarting runtime motion:', selectedMotionGroup, selectedMotionIndex)
        // Use requestAnimationFrame to restart on the next frame for smooth transition
        requestAnimationFrame(() => {
          currentMotion.value = {
            group: selectedMotionGroup,
            index: Number.parseInt(selectedMotionIndex),
          }
        })
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
      const nextActiveExpressions = { ...activeExpressions.value }
      let hasDeletes = false
      for (const key of Object.keys(nextActiveExpressions)) {
        if (!validKeys.has(key)) {
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
            const expEntry = expressionData.value.find((e: any) => e.fileName === fileName)
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
    await model.value.motion(motionName, index, MotionPriority.FORCE)
    console.info('Motion started successfully:', motionName)
  }
  catch (error) {
    console.error('Failed to start motion:', motionName, error)
  }
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
watch([offset, () => props.scale, () => props.xOffset, () => props.yOffset], setScaleAndPosition)

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

watch(mouthOpenSize, (value) => {
  const coreModel = getCoreModel()
  if (coreModel) {
    coreModel.setParameterValueById('ParamMouthOpenY', value)
  }
})
watch(currentMotion, value => setMotion(value.group, value.index))
watch(paused, value => value ? pixiApp.value?.stop() : pixiApp.value?.start())

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

watch(focusAt, (value) => {
  if (!model.value)
    return
  if (props.disableFocusAt)
    return

  model.value.focus(value.x, value.y)
})

onMounted(() => {
  const removeListener = listenBeatSyncBeatSignal(() => beatSync.scheduleBeat())
  onUnmounted(() => removeListener())
})

onMounted(async () => {
  updateDropShadowFilter()
})

onUnmounted(() => {
  isUnmounted = true
  disposeShouldUpdateView?.()

  // NOTICE: Explicitly cancel the drop shadow RAF loop on unmount. The isUnmounted
  // guard inside the loop is the primary defense, but cancelling the pending frame
  // prevents even one extra tick from firing after teardown.
  if (dropShadowAnimationId.value) {
    cancelAnimationFrame(dropShadowAnimationId.value)
    dropShadowAnimationId.value = 0
  }
})

function listMotionGroups() {
  return availableMotions.value
}

defineExpose({
  setMotion,
  listMotionGroups,
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
