import type { VRM } from '@pixiv/three-vrm'
import type { Object3D } from 'three'
import * as THREE from 'three'
import { CanvasTexture, Line, Raycaster, Sprite, SpriteMaterial, Vector2, Vector3 } from 'three'
import { ref, shallowRef } from 'vue'

import { useModelStore } from '../../stores/model-store'

/**
 * useVRMClothInteraction
 * R&D Prototype for "Wired-style" tactile cloth interaction.
 * Allows users to "tug" on fabric using mouse drag, with visual tethering.
 */
export function useVRMClothInteraction() {
  const isDragging = ref(false)
  const targetBone = shallowRef<Object3D | null>(null)

  // Cache for performance-heavy lookups
  const nodes = {
    boundary: new THREE.Box3(), // Persistent hit-aura
    hasBoundary: false,
    head: null as Object3D | null,
    jaw: null as Object3D | null,
  }

  // Interaction State
  const modelStore = useModelStore()
  const activePuffs: Sprite[] = []
  const clothMeshCache = shallowRef<Object3D[]>([])
  const boneCache = shallowRef<Object3D[]>([])

  // Persistent Rest-Position Memory (Stops Drift)
  const boneBaseCache = new Map<string, Vector3>()

  // Initialize Tether Line Mesh
  const lineGeom = new THREE.BufferGeometry()
  const tetherPosBuffer = new Float32Array(6) // Reuse this buffer
  lineGeom.setAttribute('position', new THREE.BufferAttribute(tetherPosBuffer, 3))
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.4, transparent: true })
  const tetherLine = shallowRef<Line>(new Line(lineGeom, lineMat))
  const basePosition = new Vector3()
  const currentTension = ref(0)
  const maxStretch = 0.15 // 15cm max pull

  // Texture Cache
  let puffTexture: THREE.Texture | null = null

  function getPuffTexture() {
    if (puffTexture) return puffTexture

    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    ctx.arc(32, 32, 28, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    puffTexture = new CanvasTexture(canvas)
    return puffTexture
  }

  // Interaction Helpers
  const raycaster = new Raycaster()
  const mouse = new Vector2()
  const intersectionPoint = new Vector3()
  const grabPoint = new Vector3() // Local point in vrm.scene where grab started

  // Wardrobe Manifest: TextureIndex -> { expression, sisters[] }
  // This is the precomputed "Rosetta Stone" built at load time.
  const wardrobeManifest = new Map<number, { active: any; siblings: any[] }>()

  function resolveNodes(vrm: VRM) {
    if (!vrm) return
    if (!nodes.jaw || !nodes.head) {
      nodes.jaw = vrm.humanoid?.getNormalizedBoneNode('jaw') || null
      nodes.head = vrm.humanoid?.getNormalizedBoneNode('head') || null
    }

    // [SPEED-FIX] Calculate boundary strictly ONCE per model load
    if (!nodes.hasBoundary) {
      nodes.boundary.setFromObject(vrm.scene)
      nodes.hasBoundary = true

      // [PERFORMANCE-RESTORATION] Only cache primary renderable meshes
      const meshes: Object3D[] = []
      const bones: Object3D[] = []
      vrm.scene.traverse((obj) => {
        if ((obj.type === 'Mesh' || obj.type === 'SkinnedMesh') && obj.visible) {
          const name = obj.name.toLowerCase()
          const isOutline = name.includes('outline')
          const isInternal = name.includes('collider') || name.includes('proxy')

          if (!isInternal && !isOutline) {
            meshes.push(obj)
          }
        }
        if (obj.type === 'Bone') {
          bones.push(obj)
        }
      })
      clothMeshCache.value = meshes
      boneCache.value = bones

      // [WIRED-PRECOMPUTATION] Build the Wardrobe Manifest once
      // This eliminates the 10s "discovery" period on first click.
      if (vrm.expressionManager && modelStore.activeVrmParser) {
        const start = performance.now()
        vrm.expressionManager.expressions.forEach((expr: any) => {
          const binds = expr.binds || expr._binds || []
          binds.forEach((b: any) => {
            if (!b.material) return
            const tex = b.material.map || b.material.shadeMultiplyTexture
            const assoc = modelStore.activeVrmParser.associations.get(tex)
            const hitTexIndex =
              assoc && assoc.textures !== undefined
                ? modelStore.activeVrmParser.json.textures[assoc.textures]?.source
                : null

            if (hitTexIndex !== null) {
              if (!wardrobeManifest.has(hitTexIndex)) {
                wardrobeManifest.set(hitTexIndex, { active: null, siblings: [] })
              }
              const entry = wardrobeManifest.get(hitTexIndex)!
              entry.siblings.push(expr)
            }
          })
        })
        console.log(
          `[WIRED] Wardrobe Manifest Precomputed in ${(performance.now() - start).toFixed(2)}ms. Mapped ${wardrobeManifest.size} texture slots.`,
        )
      }
    }
  }

  function spawnPuff(point: Vector3, scene: THREE.Object3D) {
    const localPoint = point.clone()
    scene.worldToLocal(localPoint)

    const material = new SpriteMaterial({
      depthTest: false,
      map: getPuffTexture(),
      opacity: 0.8,
      transparent: true,
    })

    material.color.setHSL(Math.random(), 0.8, 0.6)

    const puff = new Sprite(material)
    puff.position.copy(localPoint)
    puff.scale.set(0.05, 0.05, 0.05)
    scene.add(puff)
    activePuffs.push(puff)
  }

  /**
   * Attempt to "grab" a piece of cloth
   */
  function startTug(
    event: { x: number; y: number; isCtrlPressed?: boolean; isDoubleClick?: boolean },
    camera: THREE.Camera,
    vrm: VRM,
    vrmEmote?: any, // Accept managed emote service
  ) {
    if (!vrm || modelStore.interactionMode !== 'tactile') return

    mouse.x = (event.x / window.innerWidth) * 2 - 1
    mouse.y = -(event.y / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    resolveNodes(vrm)

    if (!raycaster.ray.intersectsBox(nodes.boundary)) return

    const visibleMeshes = clothMeshCache.value.filter((m) => m.visible)

    const candidates: { mesh: THREE.Mesh; distance: number }[] = []
    const sphere = new THREE.Sphere()

    visibleMeshes.forEach((obj: any) => {
      if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere()
      sphere.copy(obj.geometry.boundingSphere).applyMatrix4(obj.matrixWorld)

      if (raycaster.ray.intersectsSphere(sphere)) {
        const dist = raycaster.ray.origin.distanceTo(sphere.center)
        candidates.push({ distance: dist, mesh: obj })
      }
    })

    const targetMeshes = candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((c) => c.mesh)
    let intersects = raycaster.intersectObjects(targetMeshes, false)

    // Ghost Picking: If Ctrl is pressed and we missed, fallback to testing hidden meshes
    if (intersects.length === 0 && event.isCtrlPressed) {
      const hiddenMeshes = clothMeshCache.value.filter((m) => !m.visible)
      const hiddenCandidates: { mesh: THREE.Mesh; distance: number }[] = []
      hiddenMeshes.forEach((obj: any) => {
        if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere()
        sphere.copy(obj.geometry.boundingSphere).applyMatrix4(obj.matrixWorld)

        if (raycaster.ray.intersectsSphere(sphere)) {
          const dist = raycaster.ray.origin.distanceTo(sphere.center)
          hiddenCandidates.push({ distance: dist, mesh: obj })
        }
      })
      const hiddenTargetMeshes = hiddenCandidates
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((c) => c.mesh)
      intersects = raycaster.intersectObjects(hiddenTargetMeshes, false)
    }

    if (intersects.length > 0) {
      const hit = intersects[0]

      // MUX: Ctrl+Click (Visibility Toggle)
      if (event.isCtrlPressed) {
        window.dispatchEvent(
          new CustomEvent('vrm-node-visibility-toggle', { detail: { node: hit.object, uuid: hit.object.uuid } }),
        )
        return // Abort drag and emotions
      }

      // MUX: Double Click (Wardrobe Discovery)
      if (event.isDoubleClick) {
        triggerDiscovery(vrm, hit.object)
        return // Abort drag and emotions
      }

      intersectionPoint.copy(hit.point)

      let nearestBone: Object3D | null = null
      let minDist = Infinity

      boneCache.value.forEach((obj) => {
        const boneWorldPos = new Vector3()
        obj.getWorldPosition(boneWorldPos)
        const d = boneWorldPos.distanceTo(intersectionPoint)
        if (d < minDist) {
          minDist = d
          nearestBone = obj
        }
      })

      if (nearestBone) {
        const bone = nearestBone as Object3D
        isDragging.value = true
        targetBone.value = bone

        if (!boneBaseCache.has(bone.name)) {
          boneBaseCache.set(bone.name, bone.position.clone())
        }
        basePosition.copy(boneBaseCache.get(bone.name)!)

        grabPoint.copy(intersectionPoint)
        vrm.scene.worldToLocal(grabPoint)

        const boneName = bone.name.toLowerCase()
        if (
          boneName.includes('bust') ||
          boneName.includes('chest') ||
          (boneName.includes('upper') && boneName.includes('leg'))
        ) {
          if (vrmEmote?.setEmotionWithResetAfter) {
            vrmEmote.setEmotionWithResetAfter('happy', 2000, 1.0)
          }
        }

        spawnPuff(intersectionPoint, vrm.scene)
      }
    }
  }

  function triggerDiscovery(vrm: VRM, hitObject: Object3D) {
    const material = (hitObject as any).material
    const mat = Array.isArray(material) ? material[0] : material

    if (vrm.expressionManager && modelStore.activeVrmParser) {
      const normalizeRaw = (name: string) => name.replace(/^VRMExpression_/, '')
      const formatName = (name: string) =>
        normalizeRaw(name)
          .split('_')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ')

      const tex = mat?.map || mat?.shadeMultiplyTexture
      const assoc = modelStore.activeVrmParser.associations.get(tex)
      const hitTexIndex =
        assoc && assoc.textures !== undefined ? modelStore.activeVrmParser.json.textures[assoc.textures]?.source : null

      if (hitTexIndex !== null && wardrobeManifest.has(hitTexIndex)) {
        const entry = wardrobeManifest.get(hitTexIndex)!
        const activeOutfit = entry.siblings.find((s: any) => s.weight > 0.5)

        // Build siblings as { display, raw } pairs for the UI
        const seen = new Set<string>()
        const siblingPairs = entry.siblings
          .filter((s: any) => {
            if (seen.has(s.name)) return false
            seen.add(s.name)
            return true
          })
          .map((s: any) => ({ display: formatName(s.name), raw: normalizeRaw(s.name) }))

        // Determine the active outfit pair
        const activePair = activeOutfit
          ? { display: formatName(activeOutfit.name), raw: normalizeRaw(activeOutfit.name) }
          : siblingPairs[0] || { display: 'Unknown', raw: '' }

        const restSiblings = siblingPairs.filter((p) => p.raw !== activePair.raw)

        // Update Global State for UI
        modelStore.detectedWardrobe = {
          active: activePair,
          siblings: restSiblings,
          texIndex: hitTexIndex,
        }
      }
    }
  }

  function handleTug(event: { x: number; y: number }, camera: THREE.Camera) {
    if (!isDragging.value || !targetBone.value || modelStore.interactionMode !== 'tactile') return

    mouse.x = (event.x / window.innerWidth) * 2 - 1
    mouse.y = -(event.y / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)

    const plane = new THREE.Plane()
    const boneWorldPos = new Vector3()
    targetBone.value.getWorldPosition(boneWorldPos)
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()).negate(), boneWorldPos)

    const dragTarget = new Vector3()
    raycaster.ray.intersectPlane(plane, dragTarget)

    const parent = targetBone.value.parent
    if (parent) {
      const localTarget = parent.worldToLocal(dragTarget.clone())
      const pullDir = localTarget.sub(basePosition)
      const dist = pullDir.length()
      currentTension.value = Math.min(dist / maxStretch, 1.0)
      if (dist > maxStretch) pullDir.normalize().multiplyScalar(maxStretch)
      targetBone.value.position.copy(basePosition.clone().add(pullDir))
    }
  }

  function endTug() {
    isDragging.value = false
  }

  /**
   * Main update loop for physics and emotional sync
   */
  function update(vrm: VRM, delta: number, vrmEmote?: any) {
    if (!vrm) return

    // [PRODUCTION-HOT-PATH] Early return STRICTLY if nothing is moving/interacting
    if (!isDragging.value && activePuffs.length === 0 && currentTension.value === 0 && !targetBone.value) return

    resolveNodes(vrm)

    // Update Puffs (Fade and Scale) - Optimized loop
    for (let i = activePuffs.length - 1; i >= 0; i--) {
      const puff = activePuffs[i]
      puff.scale.multiplyScalar(1.03)
      const mat = puff.material as SpriteMaterial
      mat.opacity -= delta * 1.5
      if (mat.opacity <= 0) {
        puff.removeFromParent()
        mat.dispose()
        activePuffs.splice(i, 1)
      }
    }

    // Spring Back Logic
    if (!isDragging.value && targetBone.value) {
      targetBone.value.position.lerp(basePosition, 0.15) // Slightly snappier
      currentTension.value = Math.max(0, currentTension.value - 0.2) // Faster tension decay

      // [SNAPPING-FIX] Ensure precise restoration before setting target to null
      if (targetBone.value.position.distanceTo(basePosition) < 0.0001) {
        targetBone.value.position.copy(basePosition)
        targetBone.value = null
      }
    }

    // Decay expressions for transient feedback (Fade back to neutral)
    if (vrm.expressionManager) {
      const currentHappy = vrm.expressionManager.getValue('happy') ?? 0
      if (currentHappy > 0) {
        vrm.expressionManager.setValue('happy', Math.max(0, currentHappy - delta * 1.5))
      }
    }

    // Emotional Coupling (Default reactive behavior for tugging)
    // Leveraging the global emote system to ensure character-specific mappings and compound reactions.
    if (vrmEmote && currentTension.value > 0) {
      const tension = currentTension.value
      if (vrmEmote.currentEmotion !== 'angry') {
        vrmEmote.setEmotion('angry', tension)
      } else {
        vrmEmote.updateIntensity(tension)
      }
    } else if (vrmEmote && currentTension.value === 0 && vrmEmote.currentEmotion === 'angry') {
      // Return to neutral when tension is fully released
      vrmEmote.setEmotion('neutral')
    }

    updateTether(vrm)
  }

  function updateTether(vrm: VRM) {
    if (!tetherLine.value || !isDragging.value || !targetBone.value) {
      if (tetherLine.value) tetherLine.value.visible = false
      return
    }

    const mouthPoint = new Vector3()
    const anchor = nodes.jaw || nodes.head
    if (anchor) anchor.getWorldPosition(mouthPoint)
    else vrm.scene.getWorldPosition(mouthPoint)

    const bonePos = new Vector3()
    targetBone.value.getWorldPosition(bonePos)

    // Note: Line geometry setFromPoints is fine for prototype
    tetherLine.value.visible = true
    const geometry = tetherLine.value.geometry as THREE.BufferGeometry
    geometry.setFromPoints([mouthPoint, bonePos])
  }

  return {
    currentTension,
    endTug,
    handleTug,
    isDragging,
    startTug,
    tetherLine,
    update,
  }
}
