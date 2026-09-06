import JSZip from 'jszip'

import { loadSpineRuntime } from './spine-runtime'
import { detectSpineVersionFromBinary, detectSpineVersionFromJson } from './spine-version'
import { loadSpineZip } from './spine-zip-loader'

/**
 * Renders the first frame of a user-imported Spine ZIP to an offscreen
 * canvas and returns a data URL suitable for the model-selector grid.
 *
 * Use when:
 * - A user imports a `.zip` Spine model and the display-models store
 *   needs a thumbnail for the catalog tile.
 *
 * Expects:
 * - The ZIP passes `validateSpineZip()`; otherwise this returns `undefined`.
 *
 * Returns:
 * - A `data:image/png` URL when rendering succeeds, otherwise `undefined`.
 */
export async function loadSpineModelPreview(file: File): Promise<string | undefined> {
  let assets: Awaited<ReturnType<typeof loadSpineZip>> | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    assets = await loadSpineZip(file)

    const detectedVersion = assets.layout.skeletonFormat === 'binary'
      ? detectSpineVersionFromBinary(assets.rawData[assets.layout.skeletonPath] as Uint8Array)
      : detectSpineVersionFromJson(assets.rawData[assets.layout.skeletonPath] as string)

    console.info(`[Spine] Detected version for preview: ${detectedVersion}`)

    if (!detectedVersion) {
      console.warn('[Spine] Failed to detect version for preview. Aborting.')
      throw new Error('Failed to detect Spine version.')
    }
    const spine = await loadSpineRuntime(detectedVersion)

    const previewWidth = 512
    const previewHeight = 768

    canvas = document.createElement('canvas')
    canvas.width = previewWidth
    canvas.height = previewHeight
    // CRITICAL: Lock CSS dimensions so SceneRenderer.resize() doesn't create
    // an exponential feedback loop. Without these, clientWidth equals the buffer
    // size → resize() multiplies by DPR → buffer grows → clientWidth grows →
    // repeat. By frame 4 the canvas exceeds GPU limits and rendering explodes.
    canvas.style.width = `${previewWidth}px`
    canvas.style.height = `${previewHeight}px`
    canvas.style.position = 'absolute'
    canvas.style.left = '-99999px'
    canvas.style.top = '0'
    document.body.appendChild(canvas)

    const layout = assets.layout
    const blobUrls = assets.blobUrls
    const rawData = assets.rawData

    const skeletonAssetPath = layout.skeletonPath
    const atlasAssetPath = layout.atlasPath

    return await new Promise<string | undefined>((resolve) => {
      let resolved = false
      let frameCount = 0
      let frame1DataUrl: string | undefined
      const zip = new JSZip()
      const finish = (value: string | undefined) => {
        if (resolved)
          return
        resolved = true
        resolve(value)
      }

      try {
        const app: import('@esotericsoftware/spine-webgl').SpineCanvasApp = {
          loadAssets: (canvasApp: import('@esotericsoftware/spine-webgl').SpineCanvas) => {
            // NOTICE:
            // Patch BEFORE any load calls. SpineCanvas calls loadAssets
            // synchronously in its constructor, and load methods immediately
            // dispatch XHR. Patching after the constructor is too late.
            // Source/context: spine-core/AssetManagerBase.js Downloader class.
            // Removal condition: Spine ships a Blob/buffer-aware loader.
            const am = canvasApp.assetManager
            patchAssetManagerForZipAssets(am, blobUrls, rawData, layout.texturePaths)

            if (layout.skeletonFormat === 'binary')
              am.loadBinary(skeletonAssetPath)
            else
              am.loadJson(skeletonAssetPath)

            am.loadTextureAtlas(atlasAssetPath)
            for (const texPath of layout.texturePaths)
              am.loadTexture(texPath)
          },
          initialize: (canvasApp: import('@esotericsoftware/spine-webgl').SpineCanvas) => {
            const am = canvasApp.assetManager

            const atlas = am.require(atlasAssetPath) as import('@esotericsoftware/spine-webgl').TextureAtlas
            const skeletonData = layout.skeletonFormat === 'binary'
              ? new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas))
                  .readSkeletonData(am.require(skeletonAssetPath) as Uint8Array)
              : new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas))
                  .readSkeletonData(am.require(skeletonAssetPath) as string)

            const skeleton = new spine.Skeleton(skeletonData)
            skeleton.setToSetupPose()

            // NOTICE: Spine rigs often store body/outfit attachments inside named skins like "Normal".
            // skeletonData.defaultSkin is an object that always exists in Spine runtime, but may be empty
            // of body attachments. We explicitly set the skin to "Normal" or the first available skin,
            // then call setSlotsToSetupPose() so the entire body renders for the preview thumbnail.
            const targetSkin = skeletonData.findSkin('Normal')
              ?? (skeletonData.skins.find(s => s.name !== 'default') ?? skeletonData.skins[0])

            if (targetSkin) {
              skeleton.setSkin(targetSkin)
              skeleton.setSlotsToSetupPose()
            }

            // Position skeleton at 0,0 first to calculate local bounds
            skeleton.x = 0
            skeleton.y = 0
            skeleton.scaleX = 1
            skeleton.scaleY = 1
            if (spine.Physics && (spine.Physics as any).none !== undefined)
              (skeleton as any).updateWorldTransform((spine.Physics as any).none)
            else
              (skeleton as any).updateWorldTransform()

            // 1. Calculate actual bone-based boundaries across all bones
            let boneMinX = Infinity
            let boneMaxX = -Infinity
            let boneMinY = Infinity
            let boneMaxY = -Infinity
            for (const bone of skeleton.bones) {
              if (bone.data.name === 'root' && skeleton.bones.length > 1)
                continue
              if (bone.worldX < boneMinX)
                boneMinX = bone.worldX
              if (bone.worldX > boneMaxX)
                boneMaxX = bone.worldX
              if (bone.worldY < boneMinY)
                boneMinY = bone.worldY
              if (bone.worldY > boneMaxY)
                boneMaxY = bone.worldY
            }

            // 2. Try getting attachment mesh/region bounds with proper Vector2 instances if available
            let attachMinX = Infinity
            let attachMaxX = -Infinity
            let attachMinY = Infinity
            let attachMaxY = -Infinity
            let hasAttachmentBounds = false

            try {
              if (typeof (skeleton as any).getBounds === 'function' && (spine as any).Vector2) {
                const off = new (spine as any).Vector2()
                const sz = new (spine as any).Vector2()
                ;(skeleton as any).getBounds(off, sz, [])
                if (sz.x > 10 && sz.y > 10) {
                  attachMinX = off.x
                  attachMaxX = off.x + sz.x
                  attachMinY = off.y
                  attachMaxY = off.y + sz.y
                  hasAttachmentBounds = true
                }
              }
            }
            catch (e) {
              console.warn('[Spine Preview] getBounds error:', e)
            }

            // 3. Unified model bounds: prioritize attachment bounds, falling back to skeletonData or bones only if unavailable
            let charMinX = Infinity
            let charMaxX = -Infinity
            let charMinY = Infinity
            let charMaxY = -Infinity

            if (hasAttachmentBounds) {
              charMinX = attachMinX
              charMaxX = attachMaxX
              charMinY = attachMinY
              charMaxY = attachMaxY
            }
            else if (skeletonData.width > 10 && skeletonData.height > 10) {
              charMinX = skeletonData.x
              charMaxX = skeletonData.x + skeletonData.width
              charMinY = skeletonData.y
              charMaxY = skeletonData.y + skeletonData.height
            }
            else if (boneMinX !== Infinity && boneMaxX !== -Infinity) {
              charMinX = boneMinX
              charMaxX = boneMaxX
              charMinY = boneMinY
              charMaxY = boneMaxY
            }

            const charWidth = Math.max(50, charMaxX - charMinX)
            const charHeight = Math.max(50, charMaxY - charMinY)
            const charCenterX = (charMinX + charMaxX) / 2
            const charCenterY = (charMinY + charMaxY) / 2

            // Fit whole model inside 512x768 with ~7% breathing room
            const padding = 0.86
            const scaleX = (previewWidth * padding) / charWidth
            const scaleY = (previewHeight * padding) / charHeight
            const fitScale = Math.min(scaleX, scaleY)

            skeleton.scaleX = fitScale
            skeleton.scaleY = fitScale

            // In Spine SceneRenderer with camera centered at (0, 0), placing an object
            // at (-centerX * scale, -centerY * scale) puts its visual center exactly at the screen center (0, 0).
            skeleton.x = -charCenterX * fitScale
            skeleton.y = -charCenterY * fitScale

            console.info('[Spine Preview] Full-character bounds framed:', {
              charMinX,
              charMaxX,
              charMinY,
              charMaxY,
              charWidth,
              charHeight,
              charCenterX,
              charCenterY,
              fitScale,
              skeletonX: skeleton.x,
              skeletonY: skeleton.y,
            })

            // Set up animation state so the character assumes their natural standing/idle pose
            let animationState: any
            try {
              if ((spine as any).AnimationStateData && (spine as any).AnimationState) {
                const stateData = new (spine as any).AnimationStateData(skeletonData)
                animationState = new (spine as any).AnimationState(stateData)
                const idleAnim = skeletonData.findAnimation('idle')
                  ?? skeletonData.findAnimation('stand')
                  ?? skeletonData.animations[0]
                if (idleAnim) {
                  animationState.setAnimation(0, idleAnim.name, true)
                }
              }
            }
            catch (e) {
              console.warn('[Spine Preview] Animation state setup error:', e)
            }

            const stateHolder = canvasApp as unknown as {
              __previewSkeleton: import('@esotericsoftware/spine-webgl').Skeleton
              __previewAnimState?: any
            }
            stateHolder.__previewSkeleton = skeleton
            stateHolder.__previewAnimState = animationState
          },
          update: (canvasApp: import('@esotericsoftware/spine-webgl').SpineCanvas, delta: number) => {
            const stateHolder = canvasApp as unknown as {
              __previewSkeleton?: import('@esotericsoftware/spine-webgl').Skeleton
              __previewAnimState?: any
            }
            const skeleton = stateHolder.__previewSkeleton
            const animState = stateHolder.__previewAnimState
            if (skeleton) {
              if (animState) {
                animState.update(delta)
                animState.apply(skeleton)
              }
              if (spine.Physics && (spine.Physics as any).none !== undefined)
                skeleton.updateWorldTransform((spine.Physics as any).none)
              else
                (skeleton as any).updateWorldTransform()
            }
          },
          render: (canvasApp: import('@esotericsoftware/spine-webgl').SpineCanvas) => {
            const skeleton = (canvasApp as unknown as { __previewSkeleton?: import('@esotericsoftware/spine-webgl').Skeleton }).__previewSkeleton
            if (!skeleton)
              return

            const renderer = canvasApp.renderer
            renderer.resize(spine.ResizeMode.Expand)

            // Lock camera viewport to fixed previewWidth x previewHeight (512x768)
            // so devicePixelRatio scaling does not change world-space framing
            renderer.camera.setViewport(previewWidth, previewHeight)
            renderer.camera.update()

            canvasApp.gl.clearColor(0, 0, 0, 0)
            canvasApp.gl.clear(canvasApp.gl.COLOR_BUFFER_BIT)
            renderer.begin()
            renderer.drawSkeleton(skeleton, true)
            renderer.end()

            frameCount++

            // Set to true to record 120 frames and download a ZIP for debugging
            const DEBUG_MODE = false

            if (DEBUG_MODE) {
              // Capture frame
              if (frameCount <= 120) {
                try {
                  const dataUrl = canvas!.toDataURL('image/png')
                  const base64Data = dataUrl.split(',')[1]
                  zip.file(`frame_${String(frameCount).padStart(3, '0')}.png`, base64Data, { base64: true })

                  // Save frame 1 for the preview result
                  if (frameCount === 1) {
                    frame1DataUrl = dataUrl
                  }
                }
                catch (err) {
                  console.error('[Spine] Failed to capture frame:', err)
                }
              }

              if (frameCount !== 120)
                return

              // At frame 120, generate zip and download
              console.info('[Spine] Reached 120 frames. Generating ZIP...')
              zip.generateAsync({ type: 'blob' }).then((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `spine_frames_${Date.now()}.zip`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                console.info('[Spine] Frames ZIP downloaded')

                // Now finish the preview with frame 1
                finish(frame1DataUrl)
              }).catch((err) => {
                console.error('[Spine] Failed to generate ZIP:', err)
                finish(undefined)
              })
            }
            else {
              // Settle frames: allow animation timelines, IK constraints, and WebGL buffers
              // to settle for 15 frames (~250ms) before capturing (matching other model types)
              if (frameCount >= 15) {
                try {
                  const dataUrl = repageToPortrait(canvas!, previewWidth, previewHeight, 0.88)
                  finish(dataUrl)
                }
                catch (err) {
                  console.error('[Spine] Failed to capture/repage preview frame:', err)
                  finish(canvas?.toDataURL('image/webp', 0.85))
                }
                canvasApp.dispose() // Stop the render loop
              }
            }
          },
        }

        // Use a custom path handler so AssetManager fetches go through our
        // blob URLs instead of trying the resolved path on the network.
        const SpineCanvasCtor = spine.SpineCanvas as unknown as new (
          canvas: HTMLCanvasElement,
          config: { app: import('@esotericsoftware/spine-webgl').SpineCanvasApp, pathPrefix?: string, webglConfig?: WebGLContextAttributes },
        ) => import('@esotericsoftware/spine-webgl').SpineCanvas

        void new SpineCanvasCtor(canvas!, {
          app,
          pathPrefix: '',
          webglConfig: { alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true },
        })
      }
      catch (err) {
        console.error('[Spine] Preview generation failed:', err)
        finish(undefined)
      }

      // Hard timeout so a stuck load can't block the import flow.
      setTimeout(finish, 30000, undefined)
    })
  }
  catch (err) {
    console.error('[Spine] Preview generation failed:', err)
    throw err
  }
  finally {
    if (canvas?.isConnected)
      canvas.remove()
    assets?.dispose()
  }
}

/**
 * Patches the AssetManager's Downloader to serve ZIP-extracted assets from
 * memory, bypassing the broken rawDataUris heuristic.
 *
 * NOTICE:
 * Spine's Downloader.rawDataUris treats values without "." as data: URIs
 * (atob decode). Blob URLs in Electron are `blob:null/<uuid>` (no dots) →
 * misidentified as data URIs → status 400. Even real data: URIs corrupt
 * multi-byte binary via atob round-trip.
 * Source: spine-core/AssetManagerBase.js Downloader class.
 * Removal condition: Spine ships a Blob/ArrayBuffer-aware asset loader.
 */
function patchAssetManagerForZipAssets(
  assetManager: import('@esotericsoftware/spine-webgl').AssetManager,
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

/**
 * Crops out transparent pixels from an HTMLCanvasElement.
 */
function cropEmptyPixels(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = sourceCanvas.width
  const height = sourceCanvas.height
  const ctx = sourceCanvas.getContext('2d')

  let imgData: ImageData | null = null
  if (ctx) {
    imgData = ctx.getImageData(0, 0, width, height)
  }
  else {
    // If sourceCanvas is WebGL, copy to a 2D canvas first
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx)
      return sourceCanvas

    tempCtx.drawImage(sourceCanvas, 0, 0)
    imgData = tempCtx.getImageData(0, 0, width, height)
  }

  const data = imgData.data
  let left = width
  let top = height
  let right = 0
  let bottom = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4
      if (data[index + 3] > 0 || data[index] > 0 || data[index + 1] > 0 || data[index + 2] > 0) {
        if (y < top)
          top = y
        if (x < left)
          left = x
        if (x > right)
          right = x
        if (y > bottom)
          bottom = y
      }
    }
  }

  // If entirely empty/transparent, return a copy of source
  if (right < left || bottom < top) {
    const emptyCanvas = document.createElement('canvas')
    emptyCanvas.width = width
    emptyCanvas.height = height
    emptyCanvas.getContext('2d')?.drawImage(sourceCanvas, 0, 0)
    return emptyCanvas
  }

  const croppedWidth = right - left + 1
  const croppedHeight = bottom - top + 1
  const croppedCanvas = document.createElement('canvas')
  croppedCanvas.width = croppedWidth
  croppedCanvas.height = croppedHeight
  const croppedCtx = croppedCanvas.getContext('2d')
  if (!croppedCtx)
    return sourceCanvas

  croppedCtx.drawImage(sourceCanvas, left, top, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight)
  return croppedCanvas
}

/**
 * Repages a canvas onto a target portrait canvas (512x768) centered with uniform padding.
 */
function repageToPortrait(sourceCanvas: HTMLCanvasElement, targetWidth = 512, targetHeight = 768, paddingFactor = 0.88): string {
  const cropped = cropEmptyPixels(sourceCanvas)
  const targetCanvas = document.createElement('canvas')
  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight
  const ctx = targetCanvas.getContext('2d')
  if (!ctx)
    return sourceCanvas.toDataURL('image/webp', 0.85)

  const maxFitW = targetWidth * paddingFactor
  const maxFitH = targetHeight * paddingFactor
  const scale = Math.min(maxFitW / cropped.width, maxFitH / cropped.height)

  const drawW = cropped.width * scale
  const drawH = cropped.height * scale
  const drawX = (targetWidth - drawW) / 2
  const drawY = (targetHeight - drawH) / 2

  ctx.drawImage(cropped, drawX, drawY, drawW, drawH)
  return targetCanvas.toDataURL('image/webp', 0.85)
}
