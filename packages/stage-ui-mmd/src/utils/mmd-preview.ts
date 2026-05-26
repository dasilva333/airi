import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { loadMmd } from '../composables/mmd/core'
import type { MmdTextureFile } from './mmd-zip-extractor'

/**
 * Render an MMD file to an offscreen canvas and return a preview data URL.
 */
export async function loadMmdModelPreview(
  modelFile: File,
  textureFiles: MmdTextureFile[],
): Promise<string | undefined> {
  console.log('[MMD:Preview] Starting preview generation for:', modelFile.name)

  // 2. Create texture map (filename -> blob URL)
  const textureMap = new Map<string, string>()
  const revokedUrls: string[] = []

  for (const tex of textureFiles) {
    const url = URL.createObjectURL(tex.file)
    textureMap.set(tex.relativePath, url)
    revokedUrls.push(url)
  }

  const modelUrl = URL.createObjectURL(modelFile)
  revokedUrls.push(modelUrl)

  // 3. Setup offscreen canvas and renderer
  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = 1440
  offscreenCanvas.height = 2560
  offscreenCanvas.style.position = 'absolute'
  offscreenCanvas.style.top = '0'
  offscreenCanvas.style.left = '0'
  offscreenCanvas.style.objectFit = 'cover'
  offscreenCanvas.style.display = 'block'
  offscreenCanvas.style.zIndex = '10000000000'
  offscreenCanvas.style.opacity = '0'
  document.body.appendChild(offscreenCanvas)

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas: offscreenCanvas,
    preserveDrawingBuffer: true,
  })
  renderer.setSize(offscreenCanvas.width, offscreenCanvas.height, false)
  renderer.setPixelRatio(1)

  const scene = new Scene()
  const camera = new PerspectiveCamera(40, offscreenCanvas.width / offscreenCanvas.height, 0.01, 1000)
  const ambientLight = new AmbientLight(0xffffff, 0.8)
  const directionalLight = new DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(1, 1, 1)
  scene.add(ambientLight, directionalLight)

  let mmdInstance: any

  try {
    // 4. Load the MMD model with the texture map!
    const result = await loadMmd(modelUrl, { scene, textureMap })
    if (!result) return undefined

    mmdInstance = result.mmd
    const { modelCenter, initialCameraOffset } = result

    // Use core.ts's precomputed offset to frame the model perfectly from the front
    camera.position.copy(initialCameraOffset)
    camera.lookAt(modelCenter)
    camera.updateProjectionMatrix()

    // Force a few frames of update to ensure physics and materials stabilize
    if (mmdInstance && mmdInstance.update) {
      mmdInstance.update(0.1)
      mmdInstance.update(0)
    }

    // Small delay to let textures/materials settle after updates
    await new Promise((resolve) => setTimeout(resolve, 5000))
    renderer.render(scene, camera)

    const dataUrl = offscreenCanvas.toDataURL()

    return dataUrl
  } catch (error) {
    console.error('Error during MMD capture:', error)
    return undefined
  } finally {
    renderer.dispose()
    if (mmdInstance) {
      const mesh = mmdInstance.mesh
      mesh.traverse((child: any) => {
        if (child.geometry?.dispose) child.geometry.dispose()

        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          for (const mat of materials) {
            if (mat?.map?.dispose) mat.map.dispose()
            mat?.dispose?.()
          }
        }
      })
    }
    // Revoke all object URLs
    for (const url of revokedUrls) {
      URL.revokeObjectURL(url)
    }
    if (offscreenCanvas.isConnected) document.body.removeChild(offscreenCanvas)
  }
}
