<script setup lang="ts">
import type { AnimationState, AssetManager, Skeleton, SpineCanvas, SpineCanvasApp } from '@esotericsoftware/spine-webgl'

import type { SpineAnimationManager } from '../../../composables/spine'
import type { Emotion } from '../../../constants/emotions'
import type { SpineModelVariant } from '../../../utils/spine-zip-loader'

import { Mutex } from 'es-toolkit'
import { storeToRefs } from 'pinia'
import { nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue'

import { useSpineAnimationManager } from '../../../composables/spine'
import { EMOTION_SpineAnimationName_value, SPINE_IDLE_TRACK, SpineAnimationName } from '../../../constants/emotions'
import { useSpine } from '../../../stores/spine'
import { loadSpineRuntime } from '../../../utils/spine-runtime'
import { detectSpineVersionFromBinary, detectSpineVersionFromJson } from '../../../utils/spine-version'
import { loadSpineZip } from '../../../utils/spine-zip-loader'

const props = withDefaults(defineProps<{
  modelSrc?: string
  modelId?: string
  canvas?: HTMLCanvasElement
  width: number
  height: number
  paused?: boolean
  premultipliedAlpha?: boolean
  defaultMixDuration?: number
  idleAnimationEnabled?: boolean
  maxFps?: number
  interactionMode?: 'orbit' | 'tactile'
  xOffset?: number | string
  yOffset?: number | string
  scale?: number
  idleAnimations?: string[]
  mouthOpenSize?: number
}>(), {
  paused: false,
  premultipliedAlpha: false,
  defaultMixDuration: 0.2,
  idleAnimationEnabled: true,
  maxFps: 0,
  interactionMode: 'orbit',
  xOffset: 0,
  yOffset: 0,
  scale: 1,
  idleAnimations: () => [],
  mouthOpenSize: 0,
})

const emits = defineEmits<{
  (e: 'modelLoaded'): void
  (e: 'error', error: Error): void
  (e: 'animationsDiscovered', value: { animations: { name: string, duration: number }[], skins: { name: string }[] }): void
  (e: 'hitAreaHover', value: { name: string, x: number, y: number, hovered: boolean } | null): void
}>()

const componentState = defineModel<'pending' | 'loading' | 'mounted'>('state', { default: 'pending' })

const spineStore = useSpine()
const {
  currentAnimation,
  activeAnimations,
  currentSkin,
  availableAnimations,
  availableSkins,
  availableVariants,
  currentVariant,
  animationSpeed,
  premultipliedAlpha: storePremultipliedAlpha,
  oneShotAnimation,
  hitDetectionMode,
  radialHitRadius,
} = storeToRefs(spineStore)

let isUnmounted = false
let loggedBBoxThisLoad = false
let isTalkActive = false
const modelLoadMutex = new Mutex()
const modelLoading = ref(false)

// Live runtime objects.
let spineCanvas: SpineCanvas | undefined
let assetCleanup: (() => void) | undefined
let animationManager: SpineAnimationManager | undefined
let skeleton: Skeleton | undefined
let animationState: AnimationState | undefined
let loadedVariants: SpineModelVariant[] = []
let prevActiveAnimations: Record<string, boolean> = {}
let model0Motions: Record<string, any> = {}
let model0HitAreas: any[] = []
let loadedBlobUrls: Record<string, string> | undefined
/**
 * Base scale read from model0.json `options.scale_factor`.
 * Scene-type models authored in external editors set this to bring the
 * skeleton's world units into a renderable pixel range. Defaults to 1 so
 * models without a model0.json are unaffected.
 */
let model0ScaleFactor = 1
/** Single audio instance for model0 motions — prevents overlapping playback. */
let currentSpineAudio: HTMLAudioElement | null = null
/** Motions already fired in the current activation cycle — prevents re-trigger after one-shot finishes. */
const triggeredMotions = new Set<string>()

const canvas = toRef(() => props.canvas)
const modelSrc = toRef(() => props.modelSrc)
const paused = toRef(() => props.paused)

let hoveredArea: string | null = null

function checkBoneHit(areaName: string, bone: any, targetX: number, targetY: number): boolean {
  if (!canvas.value || !skeleton)
    return false

  const mode = hitDetectionMode.value || 'bounds'
  const boneCanvasX = canvas.value.width / 2 + bone.worldX
  const boneCanvasY = canvas.value.height / 2 - bone.worldY

  if (mode === 'radial') {
    const radius = radialHitRadius.value || 35
    const dist = Math.sqrt((targetX - boneCanvasX) ** 2 + (targetY - boneCanvasY) ** 2)
    return dist < radius
  }

  // Bounds / BoundingBox Mode: Check slot attachment or bounding box polygon
  const slot = skeleton.findSlot(areaName) || skeleton.findSlot(bone.data.name)
  if (slot && slot.attachment) {
    // If slot has a bounding box or mesh attachment, verify bounding box limits
    const offset = { x: 0, y: 0 } as any
    const size = { x: 0, y: 0 } as any
    skeleton.getBounds?.(offset, size, [])
  }

  // Exact fallback threshold for bounds projection
  const radius = radialHitRadius.value || 35
  const dist = Math.sqrt((targetX - boneCanvasX) ** 2 + (targetY - boneCanvasY) ** 2)
  return dist < radius
}

function onCanvasMouseMove(event: MouseEvent) {
  if (!canvas.value || !skeleton || props.interactionMode !== 'tactile')
    return

  const rect = canvas.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const realMouseX = mouseX * (canvas.value.width / canvas.value.clientWidth)
  const realMouseY = mouseY * (canvas.value.height / canvas.value.clientHeight)

  let found = false
  for (const area of model0HitAreas) {
    const bone = skeleton.findBone(area.id || area.name)
    if (!bone)
      continue

    const boneCanvasX = canvas.value.width / 2 + bone.worldX
    const boneCanvasY = canvas.value.height / 2 - bone.worldY

    if (checkBoneHit(area.id || area.name, bone, realMouseX, realMouseY)) {
      found = true
      if (hoveredArea !== area.name) {
        hoveredArea = area.name
        const cssX = boneCanvasX * (canvas.value.clientWidth / canvas.value.width)
        const cssY = boneCanvasY * (canvas.value.clientHeight / canvas.value.height)
        emits('hitAreaHover', { name: area.name, x: cssX, y: cssY, hovered: true })
      }
      break
    }
  }

  if (!found && hoveredArea) {
    hoveredArea = null
    emits('hitAreaHover', null)
  }
}

function onCanvasClick(event: MouseEvent) {
  if (!canvas.value || !skeleton || props.interactionMode !== 'tactile')
    return

  const rect = canvas.value.getBoundingClientRect()
  const clickX = event.clientX - rect.left
  const clickY = event.clientY - rect.top

  // Scale click coordinates to match canvas physical pixels (Retina display handling)
  const realClickX = clickX * (canvas.value.width / canvas.value.clientWidth)
  const realClickY = clickY * (canvas.value.height / canvas.value.clientHeight)

  console.log(`[Spine Click] Mode: ${hitDetectionMode.value} | Client: (${clickX}, ${clickY}) | Physical Canvas: ${canvas.value.width}x${canvas.value.height}`)

  for (const area of model0HitAreas) {
    const bone = skeleton.findBone(area.id || area.name)
    if (!bone) {
      console.warn(`[Spine Click] Hit area bone "${area.id || area.name}" not found.`)
      continue
    }

    if (checkBoneHit(area.id || area.name, bone, realClickX, realClickY)) {
      console.log(`[Spine Click] Hit detected on bone: ${area.name}`)

      const motionName = `tap_${area.name}`
      const motionConfig = model0Motions[motionName]

      console.log(`[Spine Audio] Looking up motionName="${motionName}", found=${!!motionConfig}, length=${motionConfig?.length ?? 0}`)
      console.log(`[Spine Audio] All known motion keys:`, Object.keys(model0Motions))

      if (motionConfig && motionConfig.length > 0) {
        const randomIndex = Math.floor(Math.random() * motionConfig.length)
        const config = motionConfig[randomIndex]

        console.log(`[Spine Audio] Selected config[${randomIndex}]:`, JSON.stringify(config))

        // Use track 5 for hit motions (one-shot)
        const trackIndex = 5
        if (animationState) {
          const entry = animationState.setAnimation(trackIndex, config.file, false)
          console.log(`[Spine Audio] setAnimation("${config.file}") entry=${!!entry}`)
          if (entry) {
            entry.listener = {
              complete: () => {
                if (animationState)
                  animationState.setEmptyAnimation(trackIndex, 0.2)
              },
            }
          }
        }

        // Play audio (if leader)
        const hash = window.location.hash || '#/'
        const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')
        console.log(`[Spine Audio] hash="${hash}", isStage=${isStage}, config.sound="${config.sound}"`)
        console.log(`[Spine Audio] loadedBlobUrls exists=${!!loadedBlobUrls}, hasSoundKey=${!!(loadedBlobUrls && loadedBlobUrls[config.sound])}`)
        if (loadedBlobUrls) {
          console.log(`[Spine Audio] Available blob URL keys:`, Object.keys(loadedBlobUrls))
        }

        if (isStage && config.sound && loadedBlobUrls && loadedBlobUrls[config.sound]) {
          if (currentSpineAudio) {
            currentSpineAudio.pause()
            currentSpineAudio.currentTime = 0
          }
          currentSpineAudio = new Audio(loadedBlobUrls[config.sound])
          console.log(`[Spine Audio] Playing sound: "${config.sound}" via blob URL`)
          currentSpineAudio.play().catch(e => console.error('[Spine] Failed to play audio:', e))
        }
        else {
          console.warn(`[Spine Audio] Audio skipped. isStage=${isStage}, sound="${config.sound}", blobUrlFound=${!!(loadedBlobUrls && loadedBlobUrls[config.sound])}`)
        }
      }
      break // Only trigger one hit per click
    }
  }
}

function disposeSpine() {
  canvas.value?.removeEventListener('click', onCanvasClick)
  canvas.value?.removeEventListener('mousemove', onCanvasMouseMove)
  if (spineCanvas) {
    try {
      spineCanvas.dispose()
    }
    catch (err) {
      console.warn('[Spine] Failed to dispose SpineCanvas:', err)
    }
    spineCanvas = undefined
  }
  assetCleanup?.()
  assetCleanup = undefined
  animationManager = undefined
  skeleton = undefined
  animationState = undefined
  isTalkActive = false
  spineStore.isModelLoaded = false
}

async function loadModel() {
  await modelLoadMutex.acquire()
  loggedBBoxThisLoad = false
  isTalkActive = false
  model0ScaleFactor = 1

  modelLoading.value = true
  componentState.value = 'loading'

  try {
    if (!canvas.value) {
      modelLoading.value = false
      componentState.value = 'mounted'
      return
    }

    await nextTick()

    if (!modelSrc.value) {
      console.warn('[Spine] No model source provided')
      disposeSpine()
      modelLoading.value = false
      componentState.value = 'mounted'
      return
    }

    disposeSpine()

    let assetPaths: { skeletonPath: string, atlasPath: string, skeletonFormat: 'binary' | 'json', texturePaths: string[] }
    let pathPrefix = ''
    let blobUrls: Record<string, string> | undefined
    let rawData: Record<string, Uint8Array | string> | undefined

    const isLocalBlob = modelSrc.value.startsWith('blob:')
    if (isLocalBlob || modelSrc.value.endsWith('.zip')) {
      const response = await fetch(modelSrc.value)
      const blob = await response.blob()
      const file = new File([blob], 'model.zip', { type: 'application/zip' })
      const loaded = await loadSpineZip(file)
      loadedVariants = loaded.variants

      // Populate variant store.
      availableVariants.value = loaded.variants.map(v => ({ name: v.name }))
      // Select stored variant or default to first.
      const selectedVariant = loaded.variants.find(v => v.name === currentVariant.value)
        ?? loaded.variants[0]
      if (selectedVariant && currentVariant.value !== selectedVariant.name)
        currentVariant.value = selectedVariant.name

      // Auto-detect PMA from the atlas header — the Spine editor writes
      // `pma:true` when the atlas is packed with pre-multiplied alpha.
      // Absence means straight-alpha. This drives the WebGL blending mode.
      storePremultipliedAlpha.value = selectedVariant?.premultipliedAlpha ?? loaded.premultipliedAlpha

      assetPaths = selectedVariant.layout
      blobUrls = loaded.blobUrls
      loadedBlobUrls = blobUrls
      rawData = loaded.rawData
      assetCleanup = loaded.dispose
    }
    else {
      // Plain URL case: assume a sibling .skel/.json + .atlas next to the source.
      const baseUrl = new URL(modelSrc.value, window.location.href)
      pathPrefix = baseUrl.href.replace(/\/[^/]+$/, '/')
      const baseName = baseUrl.pathname.replace(/^.*\//, '').replace(/\.(?:json|skel|atlas)(?:\.txt)?$/i, '')
      const skeletonFormat: 'binary' | 'json' = baseUrl.pathname.toLowerCase().endsWith('.json') ? 'json' : 'binary'
      assetPaths = {
        skeletonPath: `${baseName}.${skeletonFormat === 'binary' ? 'skel' : 'json'}`,
        atlasPath: `${baseName}.atlas`,
        skeletonFormat,
        texturePaths: [],
      }
    }

    // Detect version from skeleton data to load the matching runtime.
    let detectedVersion = rawData
      ? (assetPaths.skeletonFormat === 'binary'
          ? detectSpineVersionFromBinary(rawData[assetPaths.skeletonPath] as Uint8Array)
          : detectSpineVersionFromJson(rawData[assetPaths.skeletonPath] as string))
      : undefined
    if (!detectedVersion)
      detectedVersion = '4.2'
    const spine = await loadSpineRuntime(detectedVersion)
    console.log(`[Spine] Detected skeleton version: ${detectedVersion}`)

    if (isUnmounted) {
      assetCleanup?.()
      modelLoading.value = false
      componentState.value = 'mounted'
      return
    }

    // Inspect actual texture dimensions to see if they've been resized from the atlas size.
    const actualDimensions: Record<string, { width: number, height: number }> = {}
    if (blobUrls) {
      const isTexture = (p: string) => /\.(png|jpg|jpeg|webp)$/i.test(p)
      await Promise.all(Object.entries(blobUrls).map(([path, url]) => {
        if (!isTexture(path))
          return Promise.resolve()
        return new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => {
            actualDimensions[path] = { width: img.naturalWidth, height: img.naturalHeight }
            const bare = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
            actualDimensions[bare] = { width: img.naturalWidth, height: img.naturalHeight }
            resolve()
          }
          img.onerror = () => resolve()
          img.src = url
        })
      }))
    }

    if (rawData && rawData[assetPaths.atlasPath]) {
      const originalAtlas = rawData[assetPaths.atlasPath] as string
      rawData[assetPaths.atlasPath] = patchAtlasText(originalAtlas, actualDimensions)
    }

    await new Promise<void>((resolve, reject) => {
      const app: SpineCanvasApp = {
        loadAssets: (sc) => {
          const am = sc.assetManager
          // NOTICE:
          // Patch BEFORE any load calls. SpineCanvas calls loadAssets
          // synchronously in its constructor, and am.loadBinary/loadJson/
          // loadTextureAtlas immediately dispatch XHRs. The downloader
          // checks rawDataUris at dispatch time — if we patch after the
          // constructor returns, requests already hit the dev server.
          if (blobUrls)
            patchAssetManagerForZipAssets(am, blobUrls, rawData!, assetPaths.texturePaths)

          if (assetPaths.skeletonFormat === 'binary')
            am.loadBinary(assetPaths.skeletonPath)
          else
            am.loadJson(assetPaths.skeletonPath)

          am.loadTextureAtlas(assetPaths.atlasPath)
        },
        initialize: (sc) => {
          try {
            if (canvas.value) {
              const rect = canvas.value.getBoundingClientRect()
              console.log('[Spine] Canvas BBox on load:', {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left,
              })
            }

            const am = sc.assetManager
            const atlas = am.require(assetPaths.atlasPath) as import('@esotericsoftware/spine-webgl').TextureAtlas
            const attachmentLoader = new spine.AtlasAttachmentLoader(atlas)
            const skeletonData = assetPaths.skeletonFormat === 'binary'
              ? new spine.SkeletonBinary(attachmentLoader).readSkeletonData(am.require(assetPaths.skeletonPath) as Uint8Array)
              : new spine.SkeletonJson(attachmentLoader).readSkeletonData(am.require(assetPaths.skeletonPath) as string)

            // Parse model0.json before positioning so scale_factor is known
            // when applyTransformFromStore() runs below.
            let model0Data: any
            const model0Str = rawData?.['model0.json']
            if (model0Str) {
              try {
                model0Data = JSON.parse(model0Str as string)
                // Read scale_factor: scene-type models set this to bring
                // their large atlas coordinate space into a displayable range.
                const sf = model0Data?.options?.scale_factor
                if (typeof sf === 'number' && sf > 0) {
                  model0ScaleFactor = sf
                  console.log(`[Spine] model0 scale_factor=${sf}`)
                }
              }
              catch (e) {
                console.error('[Spine] Failed to parse model0.json:', e)
              }
            }

            skeleton = new spine.Skeleton(skeletonData)

            const talkAnim = skeletonData.animations.find(a => a.name === 'talk_start' || a.name.includes('talk'))
            if (talkAnim) {
              console.log('[Spine Debug] talk_start timelines:', talkAnim.timelines.map((t: any) => {
                const type = t.constructor ? t.constructor.name : 'Unknown'
                const bone = t.boneIndex !== undefined ? skeletonData.bones[t.boneIndex]?.name : undefined
                const slot = t.slotIndex !== undefined ? skeletonData.slots[t.slotIndex]?.name : undefined
                return { type, bone, slot }
              }))
            }

            console.log('[Spine Debug] Loaded bones:', skeleton.bones.map(b => b.data.name))
            skeleton.setToSetupPose()
            applyTransformFromStore()

            const stateData = new spine.AnimationStateData(skeletonData)
            stateData.defaultMix = props.defaultMixDuration
            animationState = new spine.AnimationState(stateData)

            animationState.addListener({
              complete: (entry) => {
                if (entry.trackIndex === SPINE_IDLE_TRACK && props.idleAnimationEnabled) {
                  playNextIdleCycleAnimation()
                }
              },
            })

            animationManager = useSpineAnimationManager(animationState, skeleton, {
              mixDuration: props.defaultMixDuration,
              idleAnimationEnabled: props.idleAnimationEnabled,
            })

            // Inventory animations and skins, populate the store.
            const animations = skeletonData.animations.map(animation => ({ name: animation.name, duration: animation.duration }))

            // Apply motions and hit_areas from the already-parsed model0Data.
            if (model0Data) {
              if (model0Data.motions) {
                model0Motions = model0Data.motions
                for (const key in model0Data.motions) {
                  if (key !== 'idle' && !animations.find(a => a.name === key)) {
                    animations.push({ name: key, duration: 0 }) // virtual motion
                  }
                }
              }
              if (model0Data.hit_areas) {
                model0HitAreas = model0Data.hit_areas
              }
            }

            const skins = skeletonData.skins.map(s => ({ name: s.name }))
            availableAnimations.value = animations
            availableSkins.value = skins
            emits('animationsDiscovered', { animations, skins })

            // Apply the user's saved skin (if any).
            applySkin(currentSkin.value)

            // Apply the user's saved idle animation or start cycle.
            if (props.idleAnimations && parseCycleAnimations(props.idleAnimations).length > 0) {
              playNextIdleCycleAnimation()
            }
            else {
              applyCurrentAnimation()
            }

            // Apply active independent animations.
            applyActiveAnimations(props.modelId ? activeAnimations.value[props.modelId] || {} : {})

            if (props.interactionMode === 'tactile') {
              canvas.value?.addEventListener('click', onCanvasClick)
              canvas.value?.addEventListener('mousemove', onCanvasMouseMove)
            }
            spineStore.isModelLoaded = true
            emits('modelLoaded')
            resolve()
          }
          catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            emits('error', error)
            reject(error)
          }
        },
        update: (_sc, delta) => {
          if (!skeleton || !animationState)
            return
          if (paused.value) {
            return
          }
          animationState.update(delta * animationSpeed.value)
          animationState.apply(skeleton)

          if (props.mouthOpenSize !== undefined) {
            const mouthOpen = props.mouthOpenSize > 0
            if (mouthOpen !== isTalkActive) {
              isTalkActive = mouthOpen
              if (mouthOpen) {
                const hasTalkStart = skeleton.data.findAnimation('talk_start') !== null
                if (hasTalkStart) {
                  animationState.setAnimation(4, 'talk_start', true)
                }
              }
              else {
                const hasTalkEnd = skeleton.data.findAnimation('talk_end') !== null
                if (hasTalkEnd) {
                  animationState.setAnimation(4, 'talk_end', false)
                }
                else {
                  animationState.setEmptyAnimation(4, 0.2)
                }
              }
            }

            // Fallback for bone-driven mouths
            const mouthBone = skeleton.findBone('mouth') || skeleton.findBone('jaw') || skeleton.findBone('mouth_open')
            if (mouthBone) {
              mouthBone.y = mouthBone.data.y - (props.mouthOpenSize * 15)
            }
          }
          // Physics was added in Spine 4.2; older runtimes take no argument.
          if (spine.Physics && (spine.Physics as any).update)
            skeleton.updateWorldTransform((spine.Physics as any).update)
          else
            (skeleton as any).updateWorldTransform()
        },
        render: (sc) => {
          if (!skeleton || !canvas.value)
            return
          const renderer = sc.renderer

          const oldWidth = canvas.value.width
          const oldHeight = canvas.value.height

          renderer.resize(spine.ResizeMode.Expand)

          if (canvas.value.width !== oldWidth || canvas.value.height !== oldHeight) {
            applyTransformFromStore()
          }

          if (!loggedBBoxThisLoad && canvas.value) {
            loggedBBoxThisLoad = true
            const rect = canvas.value.getBoundingClientRect()
            console.log('[Spine Debug] Stage/Canvas CSS BBox:', { width: rect.width, height: rect.height, left: rect.left, top: rect.top })
            console.log('[Spine Debug] Canvas Internal Buffer:', { width: canvas.value.width, height: canvas.value.height })
            console.log('[Spine Debug] Skeleton Origin:', { x: skeleton.x, y: skeleton.y, scaleX: skeleton.scaleX, scaleY: skeleton.scaleY })

            for (const area of model0HitAreas) {
              const bone = skeleton.findBone(area.id || area.name)
              if (bone) {
                const boneCanvasX = canvas.value.width / 2 + bone.worldX
                const boneCanvasY = canvas.value.height / 2 - bone.worldY
                console.log(`[Spine Debug] Hit Area [${area.name}]: bone.worldX=${bone.worldX.toFixed(2)}, bone.worldY=${bone.worldY.toFixed(2)} | Calculated Center=(${boneCanvasX.toFixed(2)}, ${boneCanvasY.toFixed(2)})`)
              }
            }

            if (skeleton.bones) {
              console.group('[Spine Debug] All Bones (Setup/First Frame)')
              console.log(`Total Bones: ${skeleton.bones.length}`)
              const boneInfo = skeleton.bones.map(b => ({
                name: b.data.name,
                parent: b.parent ? b.parent.data.name : 'none',
                x: Number(b.x.toFixed(2)),
                y: Number(b.y.toFixed(2)),
                worldX: Number(b.worldX.toFixed(2)),
                worldY: Number(b.worldY.toFixed(2)),
              }))
              console.table(boneInfo)
              console.groupEnd()
            }
          }

          sc.gl.clearColor(0, 0, 0, 0)
          sc.gl.clear(sc.gl.COLOR_BUFFER_BIT)
          renderer.begin()
          renderer.drawSkeleton(skeleton, storePremultipliedAlpha.value)
          renderer.end()
        },
        error: (_sc, errors: Record<string, string>) => {
          const message = Object.values(errors).join('; ')
          const error = new Error(message)
          emits('error', error)
          reject(error)
        },
      }

      spineCanvas = new spine.SpineCanvas(canvas.value!, {
        app,
        pathPrefix,
        webglConfig: { alpha: true, premultipliedAlpha: storePremultipliedAlpha.value, preserveDrawingBuffer: true },
      })
    })
  }
  catch (err) {
    console.error('[Spine] Failed to load model:', err)
    emits('error', err instanceof Error ? err : new Error(String(err)))
  }
  finally {
    modelLoading.value = false
    componentState.value = 'mounted'
    modelLoadMutex.release()
  }
}

/**
 * Patches the AssetManager's Downloader to serve ZIP-extracted assets from
 * memory. Skeleton/atlas data is served directly from `rawData`; texture
 * pages use blob URLs registered in `rawDataUris` for `image.src`.
 *
 * NOTICE:
 * Spine's Downloader.rawDataUris has a broken heuristic: values without "."
 * are decoded as data: URIs via atob(). In Electron, blob URLs are
 * `blob:null/<uuid>` (no dots) → treated as inline data → 400 error.
 * Even with data: URIs, the atob round-trip corrupts multi-byte binary.
 * We bypass rawDataUris entirely for text/binary and monkey-patch the
 * download methods to resolve from the in-memory `rawData` map.
 * Source: spine-core/AssetManagerBase.js Downloader class.
 * Removal condition: Spine ships a Blob/ArrayBuffer-aware asset loader.
 */
function patchAssetManagerForZipAssets(
  assetManager: AssetManager,
  blobUrls: Record<string, string>,
  rawData: Record<string, Uint8Array | string>,
  texturePaths: string[],
) {
  const downloader = (assetManager as unknown as {
    downloader?: {
      rawDataUris: Record<string, string>
      downloadText: (url: string, success: (data: string) => void, error: (status: number, responseText: string) => void) => void
      downloadBinary: (url: string, success: (data: Uint8Array) => void, error: (status: number, response: unknown) => void) => void
    }
  }).downloader
  if (!downloader)
    return

  // Build a lookup keyed by both full path and bare filename.
  const textLookup = new Map<string, string>()
  const binaryLookup = new Map<string, Uint8Array>()
  for (const [path, data] of Object.entries(rawData)) {
    const bare = path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path
    if (typeof data === 'string') {
      textLookup.set(path, data)
      textLookup.set(bare, data)
    }
    else {
      binaryLookup.set(path, data)
      binaryLookup.set(bare, data)
    }
  }

  const origDownloadText = downloader.downloadText.bind(downloader)
  const origDownloadBinary = downloader.downloadBinary.bind(downloader)

  downloader.downloadText = (url, success, error) => {
    const data = textLookup.get(url)
    if (data !== undefined) {
      queueMicrotask(() => success(data))
      return
    }
    origDownloadText(url, success, error)
  }

  downloader.downloadBinary = (url, success, error) => {
    const data = binaryLookup.get(url)
    if (data !== undefined) {
      queueMicrotask(() => success(data))
      return
    }
    origDownloadBinary(url, success, error)
  }

  // Texture blob URLs → rawDataUris for image.src resolution in loadTexture.
  for (const path of texturePaths) {
    const url = blobUrls[path]
    if (!url)
      continue
    downloader.rawDataUris[path] = url
    const slash = path.lastIndexOf('/')
    if (slash !== -1)
      downloader.rawDataUris[path.slice(slash + 1)] = url
  }
}

function applyTransformFromStore() {
  if (!skeleton || !canvas.value)
    return

  const w = canvas.value.width
  const h = canvas.value.height
  const data = skeleton.data

  // Effective scale = model0.json scale_factor × user scale.
  // model0ScaleFactor is 1 for models without a model0.json.
  const effectiveScale = model0ScaleFactor * props.scale

  const bbCenterX = data.x + data.width / 2
  const bottomPadY = h * 0.05

  let parsedX = 0
  if (props.xOffset !== undefined) {
    if (typeof props.xOffset === 'string' && props.xOffset.endsWith('%')) {
      parsedX = (Number.parseFloat(props.xOffset) / 100) * w
    }
    else {
      parsedX = Number(props.xOffset)
    }
  }
  if (Number.isNaN(parsedX))
    parsedX = 0

  let parsedY = 0
  if (props.yOffset !== undefined) {
    if (typeof props.yOffset === 'string' && props.yOffset.endsWith('%')) {
      parsedY = (Number.parseFloat(props.yOffset) / 100) * h
    }
    else {
      parsedY = Number(props.yOffset)
    }
  }
  if (Number.isNaN(parsedY))
    parsedY = 0

  if (model0ScaleFactor !== 1) {
    // In Spine WebGL, the camera is centered at (0, 0), so the visible canvas
    // coordinates range from -w/2 to w/2 (X) and -h/2 to h/2 (Y).
    skeleton.x = -bbCenterX * effectiveScale + parsedX
    skeleton.y = -h / 2 + bottomPadY - data.y * effectiveScale + parsedY
  }
  else {
    // Standard character model: root-relative positioning.
    skeleton.x = parsedX
    skeleton.y = parsedY
  }
  skeleton.scaleX = effectiveScale
  skeleton.scaleY = effectiveScale

  // [Spine:Origin] Diagnostic — remove once positioning is confirmed correct.
  console.group('[Spine:Origin] applyTransformFromStore')
  console.table({
    'canvas.width': w,
    'canvas.height': h,
    'model0ScaleFactor': model0ScaleFactor,
    'props.scale (user)': props.scale,
    'effectiveScale': effectiveScale,
    'data.x (bbox left)': data.x,
    'data.y (bbox bottom)': data.y,
    'data.width': data.width,
    'data.height': data.height,
    'bbCenterX': bbCenterX,
    'bbCenterY (data.y + h/2)': data.y + data.height / 2,
    'bottomPadY (h*0.05)': bottomPadY,
    'skeleton.x → set to': skeleton.x,
    'skeleton.y → set to': skeleton.y,
    'props.xOffset': props.xOffset,
    'props.yOffset': props.yOffset,
  })
  console.log('[Spine:Origin] Bones (first 5 world positions after setToSetupPose):', skeleton.bones.slice(0, 5).map(b => ({ name: b.data.name, worldX: b.worldX.toFixed(1), worldY: b.worldY.toFixed(1) })))
  console.groupEnd()
}

function applyCurrentAnimation() {
  if (!animationManager)
    return
  const desired = currentAnimation.value?.name ?? SpineAnimationName.Idle
  animationManager.setIdle(desired)
}

function parseCycleAnimations(idleAnimations: string[] | undefined) {
  return idleAnimations
    ? idleAnimations
        .filter(key => key.startsWith('spine:'))
        .map(key => key.substring(6))
    : []
}

function playNextIdleCycleAnimation() {
  if (!animationState || !animationManager)
    return

  const cycle = parseCycleAnimations(props.idleAnimations)
  if (cycle.length === 0) {
    applyCurrentAnimation()
    return
  }

  let nextAnim = cycle[0]
  if (cycle.length > 1) {
    const currentTrack = animationState.getCurrent(SPINE_IDLE_TRACK)
    const currentName = currentTrack?.animation?.name
    const choices = cycle.filter(name => name !== currentName)
    const selection = choices.length > 0 ? choices : cycle
    nextAnim = selection[Math.floor(Math.random() * selection.length)]
  }

  const resolved = animationManager.resolveAnimation(nextAnim)
  if (resolved) {
    const loop = cycle.length === 1
    animationState.setAnimation(SPINE_IDLE_TRACK, resolved, loop)
  }
}

function applyActiveAnimations(activeAnims: Record<string, boolean>) {
  const state = animationState
  if (!state || !availableAnimations.value)
    return

  availableAnimations.value.forEach((anim, index) => {
    const trackIndex = 10 + index
    const isActive = activeAnims[anim.name] || false

    // Skip the animation that is currently set as the base idle animation
    if (anim.name === currentAnimation.value?.name) {
      const currentTrack = state.getCurrent(trackIndex)
      if (currentTrack && currentTrack.animation?.name === anim.name) {
        state.setEmptyAnimation(trackIndex, props.defaultMixDuration)
      }
      return
    }

    const currentTrack = state.getCurrent(trackIndex)
    const motionConfig = model0Motions[anim.name]

    if (isActive) {
      // model0 mapped motion — one-shot with random audio
      if (motionConfig && motionConfig.length > 0) {
        // Already fired this activation cycle — do nothing until toggled off and on
        if (triggeredMotions.has(anim.name))
          return

        triggeredMotions.add(anim.name)

        const randomIndex = Math.floor(Math.random() * motionConfig.length)
        const config = motionConfig[randomIndex]

        if (!config || !config.file) {
          console.warn(`[Spine] Triggered motion "${anim.name}" has no animation file defined. Skipping.`)
          return
        }

        state.setAnimation(trackIndex, config.file, false)

        if (config.sound && loadedBlobUrls && loadedBlobUrls[config.sound]) {
          // Leadership Election: Only the "Stage" window handles audio playback
          const hash = window.location.hash || '#/'
          const isStage = hash === '#/' || hash.startsWith('#/stage') || hash.startsWith('#/actor')

          if (isStage) {
            // Stop any previously playing audio first
            if (currentSpineAudio) {
              currentSpineAudio.pause()
              currentSpineAudio.currentTime = 0
            }
            currentSpineAudio = new Audio(loadedBlobUrls[config.sound])
            currentSpineAudio.play().catch(e => console.error('[Spine] Failed to play audio:', e))
          }
        }
        else {
          console.warn(`[Spine] Audio file not found or blob URL missing for: ${config.sound}`)
        }
      }
      // Regular skeleton animation — loop as usual
      else {
        const isPlaying = currentTrack && currentTrack.animation?.name === anim.name
        if (!isPlaying && animationState)
          animationState.setAnimation(trackIndex, anim.name, true)
      }
    }
    else {
      // Motion was deactivated — clear trigger state so it can fire again next time
      triggeredMotions.delete(anim.name)

      const expectedName = (motionConfig && motionConfig[0]) ? motionConfig[0].file : anim.name
      const isPlaying = currentTrack && currentTrack.animation?.name === expectedName
      if (isPlaying && animationState) {
        animationState.setEmptyAnimation(trackIndex, props.defaultMixDuration)
        skeleton?.setToSetupPose()
      }
    }
  })
}

function applySkin(skinName: string) {
  if (!skeleton)
    return

  if (!skinName) {
    skeleton.setSkinByName(skeleton.data.defaultSkin?.name ?? skeleton.data.skins[0]?.name ?? 'default')
    skeleton.setSlotsToSetupPose()
    return
  }

  const skin = skeleton.data.findSkin(skinName)
  if (skin) {
    skeleton.setSkin(skin)
    skeleton.setSlotsToSetupPose()
  }
}

/**
 * Plays an emotion-tagged animation on the dedicated emotion track.
 *
 * Use when:
 * - The chat orchestrator emits an `EmotionPayload`. The Stage component
 *   forwards the emotion name here so the model can react in real time
 *   without disturbing the persistent idle loop on track 0.
 *
 * Expects:
 * - The skeleton has loaded (`componentState === 'mounted'`). The call is
 *   a no-op if invoked before then.
 *
 * Returns:
 * - The resolved animation name when one was found, otherwise `undefined`.
 */
function setEmotion(emotion: Emotion, _intensity: number = 1): string | undefined {
  if (!animationManager)
    return undefined
  const animationName = EMOTION_SpineAnimationName_value[emotion] || emotion
  const entry = animationManager.playEmotion(animationName)
  return entry?.animation?.name
}

watch(modelSrc, async () => await loadModel(), { immediate: true })
watch(canvas, async (next, prev) => {
  if (next && next !== prev)
    await loadModel()
})

watch([() => props.width, () => props.height, () => props.xOffset, () => props.yOffset, () => props.scale], () => {
  applyTransformFromStore()
})

watch(currentAnimation, () => {
  const cycle = parseCycleAnimations(props.idleAnimations)
  if (cycle.length === 0) {
    applyCurrentAnimation()
  }
}, { deep: true })

watch(() => props.idleAnimations, (newAnims) => {
  if (!animationState || !animationManager || !props.idleAnimationEnabled)
    return

  const cycle = parseCycleAnimations(newAnims)
  if (cycle.length > 0) {
    const currentTrack = animationState.getCurrent(SPINE_IDLE_TRACK)
    const currentName = currentTrack?.animation?.name
    if (!currentName || !cycle.includes(currentName)) {
      playNextIdleCycleAnimation()
    }
  }
  else {
    applyCurrentAnimation()
  }
}, { deep: true })

watch(activeAnimations, (newVal) => {
  const current = props.modelId ? newVal[props.modelId] || {} : {}

  for (const name in prevActiveAnimations) {
    if (prevActiveAnimations[name] && !current[name]) {
      console.log(`[Spine] Animation removed: ${name}`)
      if (skeleton) {
        skeleton.setToSetupPose()
      }
    }
  }

  prevActiveAnimations = { ...current }
  applyActiveAnimations(current)
}, { deep: true })

watch(currentSkin, (skinName) => {
  applySkin(skinName)
})

watch(oneShotAnimation, (req) => {
  if (req)
    animationManager?.playEmotion(req.name, { loop: req.loop })
})

watch(currentVariant, async () => {
  if (loadedVariants.length > 1)
    await loadModel()
})

watch(() => props.interactionMode, (newMode) => {
  if (!canvas.value)
    return

  // Always remove first to avoid duplicates
  canvas.value.removeEventListener('click', onCanvasClick)
  canvas.value.removeEventListener('mousemove', onCanvasMouseMove)

  if (newMode === 'tactile') {
    canvas.value.addEventListener('click', onCanvasClick)
    canvas.value.addEventListener('mousemove', onCanvasMouseMove)
    console.log('[Spine] Tactile mode enabled, added listeners')
  }
  else {
    console.log('[Spine] Tactile mode disabled, removed listeners')
  }
})

watch(() => props.idleAnimationEnabled, () => {
  if (!animationManager || !skeleton || !animationState)
    return
  if (props.idleAnimationEnabled)
    applyCurrentAnimation()
  else
    animationState.setEmptyAnimation(0, props.defaultMixDuration)
})

watch(() => props.defaultMixDuration, (mix) => {
  if (animationState)
    animationState.data.defaultMix = mix
})

watch(paused, () => {
  // SpineCanvas does not expose a built-in pause; we toggle by stopping
  // the update step from advancing time (handled in the update callback).
  // We still let render run so the last frame remains visible.
})

function patchAtlasText(
  atlasText: string,
  actualDimensions: Record<string, { width: number, height: number }>,
): string {
  const lines = atlasText.split(/\r?\n/)
  const patchedLines: string[] = []

  let scaleX = 1
  let scaleY = 1
  let currentActualWidth = 0
  let currentActualHeight = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Detect page block header (image filename, doesn't contain colon or comma and is not indented)
    if (trimmed.length > 0 && line[0] !== ' ' && line[0] !== '\t' && !trimmed.includes(':') && !trimmed.includes(',')) {
      const dim = actualDimensions[trimmed]
      if (dim) {
        currentActualWidth = dim.width
        currentActualHeight = dim.height
      }
      else {
        currentActualWidth = 0
        currentActualHeight = 0
      }
      patchedLines.push(line)
      continue
    }

    if (trimmed.startsWith('size:')) {
      const parts = trimmed.substring(5).split(',')
      if (parts.length === 2) {
        const currentTextureWidth = Number.parseInt(parts[0])
        const currentTextureHeight = Number.parseInt(parts[1])
        if (currentActualWidth > 0 && currentActualHeight > 0 && (currentTextureWidth !== currentActualWidth || currentTextureHeight !== currentActualHeight)) {
          scaleX = currentActualWidth / currentTextureWidth
          scaleY = currentActualHeight / currentTextureHeight
          patchedLines.push(`size:${currentActualWidth},${currentActualHeight}`)
          continue
        }
      }
      patchedLines.push(line)
      continue
    }

    if (scaleX !== 1 || scaleY !== 1) {
      if (trimmed.startsWith('bounds:')) {
        const parts = trimmed.substring(7).split(',')
        if (parts.length === 4) {
          const x = Math.round(Number.parseInt(parts[0]) * scaleX)
          const y = Math.round(Number.parseInt(parts[1]) * scaleY)
          const w = Math.round(Number.parseInt(parts[2]) * scaleX)
          const h = Math.round(Number.parseInt(parts[3]) * scaleY)
          patchedLines.push(`${line.substring(0, line.indexOf('bounds:'))}bounds:${x},${y},${w},${h}`)
          continue
        }
      }
      if (trimmed.startsWith('offsets:')) {
        const parts = trimmed.substring(8).split(',')
        if (parts.length === 4) {
          const x = Math.round(Number.parseInt(parts[0]) * scaleX)
          const y = Math.round(Number.parseInt(parts[1]) * scaleY)
          const w = Math.round(Number.parseInt(parts[2]) * scaleX)
          const h = Math.round(Number.parseInt(parts[3]) * scaleY)
          patchedLines.push(`${line.substring(0, line.indexOf('offsets:'))}offsets:${x},${y},${w},${h}`)
          continue
        }
      }
    }

    patchedLines.push(line)
  }

  return patchedLines.join('\n')
}

onMounted(async () => {
  // First load is triggered by the immediate watch above when the canvas
  // becomes available.
})

onUnmounted(() => {
  isUnmounted = true
  disposeSpine()
})

defineExpose({
  setEmotion,
  listAnimations: () => animationManager?.listAnimations() ?? [],
  listSkins: () => availableSkins.value.map(s => s.name),
})

import.meta.hot?.dispose(() => {
  console.warn('[Dev] Reload on HMR dispose is active for this component. Performing a full reload.')
  window.location.reload()
})
</script>

<template>
  <slot />
</template>
