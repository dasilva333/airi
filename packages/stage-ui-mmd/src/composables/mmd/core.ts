import type { MMD } from '@moeru/three-mmd'
import type { Mesh, Object3D, Scene } from 'three'

import { Box3, Group, Vector3 } from 'three'

import { createMMDLoader, createTextureRemappingManager } from './loader'

/**
 * Load an MMD model (PMX/PMD) and prepare it for scene insertion.
 *
 * Use when:
 * - Loading a new MMD model from a URL
 *
 * Expects:
 * - A model URL (can be a blob URL)
 * - Optionally a texture map (filename -> blob URL) for resolving relative texture paths
 *
 * Returns:
 * - The MMD instance, a wrapping Group, bounding box metrics, and initial camera offset
 */
export async function loadMmd(
  modelUrl: string,
  options?: {
    scene?: Scene
    textureMap?: Map<string, string>
    onProgress?: (progress: ProgressEvent) => void | Promise<void>
  },
): Promise<
  | {
      mmd: MMD
      mmdGroup: Group
      modelCenter: Vector3
      modelSize: Vector3
      initialCameraOffset: Vector3
    }
  | undefined
> {
  console.log('[MMD:Core] Starting loadMmd for URL:', modelUrl)
  console.log('[MMD:Core] Texture map size:', options?.textureMap?.size ?? 0)

  // Create a loader with texture remapping if a texture map is provided
  const manager = options?.textureMap ? createTextureRemappingManager(options.textureMap) : undefined
  const loader = createMMDLoader(manager)

  console.log('[MMD:Core] Calling loader.loadAsync...')
  let mmd
  try {
    mmd = await loader.loadAsync(modelUrl, (progress: ProgressEvent) => {
      if (progress.total > 0) {
        console.log(`[MMD:Core] Progress: ${Math.round((progress.loaded / progress.total) * 100)}%`)
      }
      options?.onProgress?.(progress)
    })
  } catch (err) {
    console.error('[MMD:Core] loader.loadAsync FAILED:', err)
    throw err
  }

  console.log('[MMD:Core] loader.loadAsync completed!')
  if (!mmd || !mmd.mesh) {
    console.warn('[MMD:Core] Model loaded but mesh is missing!')
    return undefined
  }
  console.log('[MMD:Core] Loaded mesh name:', mmd.mesh.name)

  // Disable frustum culling on all children
  mmd.mesh.traverse((object: Object3D) => {
    object.frustumCulled = false
  })

  // Wrap in a group for scene management
  const mmdGroup = new Group()
  mmdGroup.add(mmd.mesh)

  if (options?.scene) {
    options.scene.add(mmdGroup)
  }

  // Compute bounding box
  const box = computeBoundingBox(mmd.mesh)
  const modelSize = new Vector3()
  const modelCenter = new Vector3()
  box.getSize(modelSize)
  box.getCenter(modelCenter)
  modelCenter.y += modelSize.y / 5

  // Compute initial camera offset
  const fov = 40
  const radians = ((fov / 2) * Math.PI) / 180
  const initialCameraOffset = new Vector3(0, modelCenter.y, modelSize.y / 3 / Math.tan(radians))

  return {
    initialCameraOffset,
    mmd,
    mmdGroup,
    modelCenter,
    modelSize,
  }
}

function computeBoundingBox(object: Object3D): Box3 {
  const box = new Box3()
  const childBox = new Box3()

  object.updateMatrixWorld(true)

  object.traverse((obj) => {
    if (!obj.visible) return

    const mesh = obj as Mesh
    if (!mesh.isMesh || !mesh.geometry) return

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()

    childBox.copy(mesh.geometry.boundingBox!)
    childBox.applyMatrix4(mesh.matrixWorld)
    box.union(childBox)
  })

  return box
}
