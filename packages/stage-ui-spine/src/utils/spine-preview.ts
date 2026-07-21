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

    console.log(`[Spine] Detected version for preview: ${detectedVersion}`)

    if (!detectedVersion) {
      console.warn('[Spine] Failed to detect version for preview. Aborting.')
      throw new Error('Failed to detect Spine version.')
    }
    const spine = await loadSpineRuntime(detectedVersion)

    const previewWidth = 720
    const previewHeight = 960

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
            if (spine.Physics && (spine.Physics as any).none !== undefined)
              (skeleton as any).updateWorldTransform((spine.Physics as any).none)
            else
              (skeleton as any).updateWorldTransform()

            // Calculate actual bone-based boundaries to bypass artificial design canvas size limits
            let minX = Infinity
            let maxX = -Infinity
            let minY = Infinity
            let maxY = -Infinity
            for (const bone of skeleton.bones) {
              if (bone.data.name === 'root' && skeleton.bones.length > 1)
                continue
              if (bone.worldX < minX)
                minX = bone.worldX
              if (bone.worldX > maxX)
                maxX = bone.worldX
              if (bone.worldY < minY)
                minY = bone.worldY
              if (bone.worldY > maxY)
                maxY = bone.worldY
            }
            const bonesWidth = (maxX - minX) > 0 ? (maxX - minX) : 300
            const bonesHeight = (maxY - minY) > 0 ? (maxY - minY) : 600
            const bonesCenterX = (minX + maxX) / 2

            // Find head/neck and hip/torso bones for portrait framing
            const headBone = findBoneByNames(skeleton, ['head', 'face', 'neck', 'nose'])
            const hipBone = findBoneByNames(skeleton, ['hip', 'pelvis', 'waist', 'spine', 'chest', 'torso', 'body'])

            let localTopY = 0
            let localBottomY = 0
            let localCenterX = 0
            let hasHumanoidBones = false

            if (headBone && hipBone) {
              localTopY = headBone.worldY
              localBottomY = hipBone.worldY
              // Center horizontally on the head/face to keep the head fully in frame for portrait crops
              localCenterX = headBone.worldX
              hasHumanoidBones = true
            }
            else if (headBone) {
              localTopY = headBone.worldY
              localBottomY = headBone.worldY - bonesHeight * 0.45
              localCenterX = headBone.worldX
              hasHumanoidBones = true
            }
            else if (skeletonData.height > 0) {
              // Fallback to bounding box upper body (approx 40% to 90% of height)
              localTopY = (skeletonData.y || 0) + skeletonData.height * 0.9
              localBottomY = (skeletonData.y || 0) + skeletonData.height * 0.4
              localCenterX = (skeletonData.x || 0) + (skeletonData.width || 0) / 2
            }
            else {
              // Fallback to bone bounding box upper half
              localTopY = maxY
              localBottomY = minY + bonesHeight * 0.45
              localCenterX = bonesCenterX
            }

            const targetHeight = Math.max(50, localTopY - localBottomY)
            // Scale to fit the target portrait height nicely
            let fitScale = 1
            const padding = 0.65 // Keep upper body occupying 65% of the canvas height
            fitScale = (previewHeight * padding) / targetHeight

            // Safe guard against extreme scales
            if (skeletonData.width > 0 && skeletonData.height > 0) {
              let maxScale = (previewHeight * 0.9) / skeletonData.height
              if (hasHumanoidBones) {
                // If we found humanoid bones, ignore the artificial design canvas height constraint
                maxScale = 2.0
              }
              fitScale = Math.min(fitScale, maxScale)
            }
            // Safe guard against extreme scales using the actual bone width
            let maxScaleX = (previewWidth * 0.85) / bonesWidth
            if (hasHumanoidBones) {
              // For humanoid figures, we care about the torso/head width rather than wing/weapon span.
              // We can estimate the body width as roughly 80% of the target portrait height.
              const bodyWidthEst = targetHeight * 0.8
              maxScaleX = (previewWidth * 0.85) / bodyWidthEst
            }
            fitScale = Math.min(fitScale, maxScaleX)

            skeleton.scaleX = fitScale
            skeleton.scaleY = fitScale

            skeleton.x = previewWidth / 2 - localCenterX * fitScale
            skeleton.y = previewHeight / 2 - ((localBottomY + localTopY) / 2) * fitScale

            console.log('[Spine-Preview-Recon] Starting thumbnail generation')
            console.log(`[Spine-Preview-Recon] Preview Canvas: ${previewWidth}x${previewHeight}`)
            console.log(`[Spine-Preview-Recon] SkeletonData Bounds: x=${skeletonData.x}, y=${skeletonData.y}, width=${skeletonData.width}, height=${skeletonData.height}`)
            console.log(`[Spine-Preview-Recon] Bone Bounds (world): minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}, width=${bonesWidth}, height=${bonesHeight}, centerX=${bonesCenterX}`)
            console.log(`[Spine-Preview-Recon] Detected Bones: headBone=${headBone?.data.name} (${headBone ? `worldX=${headBone.worldX}, worldY=${headBone.worldY}` : 'N/A'}), hipBone=${hipBone?.data.name} (${hipBone ? `worldX=${hipBone.worldX}, worldY=${hipBone.worldY}` : 'N/A'})`)
            console.log(`[Spine-Preview-Recon] Selected Region: localTopY=${localTopY}, localBottomY=${localBottomY}, localCenterX=${localCenterX}, targetHeight=${targetHeight}, hasHumanoidBones=${hasHumanoidBones}`)
            console.log(`[Spine-Preview-Recon] Scaling: initialScale=${(previewHeight * padding) / targetHeight}, finalFitScale=${fitScale} (padding=${padding})`)
            console.log(`[Spine-Preview-Recon] Final Placement: skeleton.x=${skeleton.x}, skeleton.y=${skeleton.y}, skeleton.scaleX=${skeleton.scaleX}, skeleton.scaleY=${skeleton.scaleY}`)

            ;(canvasApp as unknown as { __previewSkeleton: import('@esotericsoftware/spine-webgl').Skeleton }).__previewSkeleton = skeleton
          },
          update: (canvasApp: import('@esotericsoftware/spine-webgl').SpineCanvas, _delta: number) => {
            const skeleton = (canvasApp as unknown as { __previewSkeleton?: import('@esotericsoftware/spine-webgl').Skeleton }).__previewSkeleton
            if (skeleton) {
              // Disable physics for preview to avoid bloom/light expansion
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
              console.log('[Spine] Reached 120 frames. Generating ZIP...')
              zip.generateAsync({ type: 'blob' }).then((blob) => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `spine_frames_${Date.now()}.zip`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                console.log('[Spine] Frames ZIP downloaded')

                // Now finish the preview with frame 1
                finish(frame1DataUrl)
              }).catch((err) => {
                console.error('[Spine] Failed to generate ZIP:', err)
                finish(undefined)
              })
            }
            else {
              // Production mode: Capture frame 1 and exit immediately
              if (frameCount === 1) {
                try {
                  const dataUrl = canvas!.toDataURL('image/png')
                  finish(dataUrl)
                }
                catch (err) {
                  console.error('[Spine] Failed to capture preview frame:', err)
                  finish(undefined)
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

        new SpineCanvasCtor(canvas!, {
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

function findBoneByNames(skeleton: import('@esotericsoftware/spine-webgl').Skeleton, names: string[]) {
  // Check exact match first
  for (const name of names) {
    const bone = skeleton.bones.find(b => b.data.name.toLowerCase() === name.toLowerCase())
    if (bone)
      return bone
  }
  // Substring match fallback
  for (const name of names) {
    const bone = skeleton.bones.find(b => b.data.name.toLowerCase().includes(name.toLowerCase()))
    if (bone)
      return bone
  }
  return null
}
