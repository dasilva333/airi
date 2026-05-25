import type { VRM, VRMCore } from '@pixiv/three-vrm'
import { VRMExpression, VRMExpressionMorphTargetBind } from '@pixiv/three-vrm'
import { VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation'
import type { Mesh, Object3D, Scene } from 'three'
import { Box3, Group, Quaternion, Vector3 } from 'three'

import { useVRMLoader } from './loader'
import { vrmLogger } from '@proj-airi/stage-shared/debug'

interface GLTFUserdata extends Record<string, unknown> {
  vrm?: VRM
  vrmCore?: VRMCore
}

export async function loadVrm(
  model: string,
  options?: {
    scene?: Scene
    lookAt?: boolean
    onProgress?: (progress: ProgressEvent<EventTarget>) => void | Promise<void>
  },
): Promise<
  | {
      _vrm: VRM
      _vrmGroup: Group
      modelCenter: Vector3
      modelSize: Vector3
      initialCameraOffset: Vector3
      parser: any
      unmappedExpressions: string[]
    }
  | undefined
> {
  vrmLogger.log('loadVrm: starting GLTF load...', { model })
  vrmLogger.time('vrm:gltfLoad')
  const loader = useVRMLoader()
  const gltf = await loader.loadAsync(model, (progress) => options?.onProgress?.(progress))
  vrmLogger.timeEnd('vrm:gltfLoad')

  const userData = gltf.userData as GLTFUserdata
  if (!userData.vrm) {
    vrmLogger.error('loadVrm: GLTF loaded but no VRM data found in userData')
    return
  }

  const _vrm = userData.vrm
  vrmLogger.log('loadVrm: VRM data found ✓', { expressionCount: Object.keys(_vrm.expressionManager?.expressionMap ?? {}).length })

  // calling these functions greatly improves the performance
  // VRMUtils.removeUnnecessaryVertices(_vrm.scene)
  // VRMUtils.combineSkeletons(_vrm.scene)

  // Zero out all expression weights on load.
  // Some VRM models (e.g. Satoimo) ship with non-zero default weights
  // for custom expressions (hearts, glasses, music overlays), causing
  // everything to render simultaneously ("megazord" state).
  // This runs at load time so both static preview and animated views start clean.
  if (_vrm.expressionManager) {
    const expressionNames = Object.keys(_vrm.expressionManager.expressionMap)
    for (const name of expressionNames) {
      _vrm.expressionManager.setValue(name, 0)
    }
    _vrm.expressionManager.update()
  }

  // Discovery Logic: Find "lost" morph targets that aren't registered as expressions
  const unmappedExpressions: string[] = []
  if (_vrm.expressionManager) {
    const existingExpressions = new Set(Object.keys(_vrm.expressionManager.expressionMap))
    _vrm.scene.traverse((obj: Object3D) => {
      const mesh = obj as Mesh
      if (mesh.isMesh && mesh.morphTargetDictionary) {
        Object.keys(mesh.morphTargetDictionary).forEach((name) => {
          if (!existingExpressions.has(name) && !unmappedExpressions.includes(name)) {
            unmappedExpressions.push(name)

            // UNLOCK SURGERY: Register this "lost" morph target as a real VRM expression.
            // This allows it to be controlled via the standard VRM extension API
            // and discovered by AIRI's expression system.
            const newExpression = new VRMExpression(name)
            newExpression.addBind(
              new VRMExpressionMorphTargetBind({
                index: mesh.morphTargetDictionary![name],
                primitives: [mesh],
                weight: 1.0,
              }),
            )
            _vrm.expressionManager!.registerExpression(newExpression)
          }
        })
      }
    })
  }

  // Disable frustum culling
  _vrm.scene.traverse((object: Object3D) => {
    object.frustumCulled = false
  })

  // Add look at quaternion proxy to the VRM; which is needed to play the look at animation
  if (options?.lookAt && _vrm.lookAt) {
    const lookAtQuatProxy = new VRMLookAtQuaternionProxy(_vrm.lookAt)
    lookAtQuatProxy.name = 'lookAtQuaternionProxy'
    _vrm.scene.add(lookAtQuatProxy)
  }

  const _vrmGroup = new Group()
  _vrmGroup.add(_vrm.scene)
  // Add to scene
  if (options?.scene) {
    options.scene.add(_vrmGroup)
  }

  // Preset the facing direction
  const targetDirection = new Vector3(0, 0, -1) // Default facing direction
  const lookAt = _vrm.lookAt
  const quaternion = new Quaternion()
  if (lookAt) {
    const facingDirection = lookAt.faceFront
    quaternion.setFromUnitVectors(facingDirection.normalize(), targetDirection.normalize())
    _vrmGroup.quaternion.premultiply(quaternion)
    _vrmGroup.updateMatrixWorld(true)
  } else {
    console.warn('No look-at target found in VRM model')
  }
  ;(_vrm as VRM).springBoneManager?.reset()
  _vrmGroup.updateMatrixWorld(true)

  function computeBoundingBox(vrm: Object3D) {
    const box = new Box3()
    const childBox = new Box3()

    vrm.updateMatrixWorld(true)

    vrm.traverse((obj) => {
      if (!obj.visible) return
      const mesh = obj as Mesh
      if (!mesh.isMesh) return
      if (!mesh.geometry) return
      // This traverse mesh console print will be important for future debugging
      // console.debug("mesh node: ", mesh)

      // Selectively filter out VRM spring bone colliders
      if (mesh.name.startsWith('VRMC_springBone_collider')) return

      const geometry = mesh.geometry
      if (!geometry.boundingBox) {
        geometry.computeBoundingBox()
      }

      childBox.copy(geometry.boundingBox!)
      childBox.applyMatrix4(mesh.matrixWorld)

      box.union(childBox)
    })

    return box
  }

  const box = computeBoundingBox(_vrm.scene)
  const modelSize = new Vector3()
  const modelCenter = new Vector3()
  box.getSize(modelSize)
  box.getCenter(modelCenter)

  // CRITICAL: Try to find the head bone for precise centering.
  // Bounding boxes can be skewed by invisible scene objects or large accessories.
  const headBone = _vrm.humanoid?.getRawBoneNode('head')
  if (headBone) {
    headBone.getWorldPosition(modelCenter)
    // Adjust focus slightly down to include the upper chest in the "headshot"
    modelCenter.y -= modelSize.y / 20
  } else {
    // Fallback to bounding box pivot if no humanoid head is found
    modelCenter.y += modelSize.y / 5
  }

  // Compute the initial camera position (once per loaded model)
  // In order to see the up-2/3 part fo the model, z = (y/3) / tan(fov/2)
  const fov = 40 // default fov = 40 degrees
  const radians = ((fov / 2) * Math.PI) / 180
  const initialCameraOffset = new Vector3(
    modelSize.x / 16,
    modelSize.y / 8, // default y value
    -(modelSize.y / 3) / Math.tan(radians), // default z value
  )

  return {
    _vrm,
    _vrmGroup,
    initialCameraOffset,
    modelCenter,
    modelSize,
    parser: gltf.parser,
    unmappedExpressions,
  }
}
