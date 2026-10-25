import type { HackerAdapter, HackerMaterialControl, HackerPart, HackerTexture, HackerTextureId } from '../types'
import type { VrmHiddenPrimitive } from '../vrm/glb-exporter'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import * as THREE from 'three'

import { useAiriCardStore } from '../../../../../../../stores/modules/airi-card'
import { useSettings } from '../../../../../../../stores/settings'
import { buildExportFileName } from '../../domain/export-filename'
import { prettyMaterialName } from '../../domain/material-owners'
import { linearizeRgba } from '../../domain/preview-gamma'
import { textureIdentitiesMatch } from '../../domain/texture-identity'
import { exportVrmBinary } from '../vrm/glb-exporter'

interface VrmTextureEntry {
  texture: any
  type: string
  nodeName: string
  materials: Set<string>
  material: any
}

function imageHasAlpha(image: any): boolean {
  const width = image?.width || image?.naturalWidth
  const height = image?.height || image?.naturalHeight
  if (!width || !height)
    return false
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * Math.min(1, 256 / Math.max(width, height))))
  canvas.height = Math.max(1, Math.round(height * Math.min(1, 256 / Math.max(width, height))))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return false
  try {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255)
        return true
    }
  }
  catch {}
  return false
}

function getTextureUrl(texture: any): string | null {
  if (!texture?.image)
    return null
  try {
    if (texture.image instanceof HTMLCanvasElement)
      return texture.image.toDataURL()
    if (texture.image instanceof HTMLImageElement)
      return texture.image.src
    if (texture.image instanceof ImageBitmap) {
      const canvas = document.createElement('canvas')
      canvas.width = texture.image.width
      canvas.height = texture.image.height
      canvas.getContext('2d')?.drawImage(texture.image, 0, 0)
      return canvas.toDataURL()
    }
  }
  catch {}
  return null
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function stripSuffix(value: string): string {
  return value.replace(/(_\d+)$/, '')
}

export function useVrmHackerAdapter(): HackerAdapter {
  const modelStore = useModelStore()
  const settingsStore = useSettings()
  const airiCardStore = useAiriCardStore()
  const { activeVrm, activeVrmParser } = storeToRefs(modelStore)

  const textures = ref<HackerTexture[]>([])
  const parts = ref<HackerPart[]>([])
  const materialControls = ref<HackerMaterialControl[]>([])
  const ready = computed(() => Boolean(activeVrm.value))

  const entries = new Map<HackerTextureId, VrmTextureEntry>()
  const nodesById = new Map<string, any>()
  const initialVisibility = new Map<string, boolean>()
  const initialMaterials = new Map<string, any>()
  const originalImages = new Map<string, any>()
  const mutations = new Map<number, { data: string, mimeType: string }>()
  const rawApplied = new Map<HackerTextureId, string>()
  let selectedMaterial: any = null
  let sourceBuffer: ArrayBuffer | null = null

  function getGltfImageIndex(texture: any): number | null {
    if (!activeVrmParser.value || !texture)
      return null
    const assoc = activeVrmParser.value.associations.get(texture)
    if (assoc?.textures !== undefined) {
      const gltfTex = activeVrmParser.value.json.textures[assoc.textures]
      return gltfTex?.source ?? null
    }
    return null
  }

  function getGltfNodeIndex(node: any, gltf?: any): number | null {
    if (!activeVrmParser.value || !node)
      return null
    const assoc = activeVrmParser.value.associations.get(node)
    if (assoc?.nodes !== undefined)
      return assoc.nodes

    if (gltf && node.name) {
      const sceneName = normalizeName(stripSuffix(node.name))
      const nodeIdx = gltf.nodes.findIndex((item: any) => item.name && normalizeName(stripSuffix(item.name)) === sceneName)
      if (nodeIdx !== -1)
        return nodeIdx
      const meshIdx = gltf.nodes.findIndex((item: any) => {
        if (item.mesh === undefined)
          return false
        const mesh = gltf.meshes[item.mesh]
        return mesh?.name && normalizeName(stripSuffix(mesh.name)) === sceneName
      })
      if (meshIdx !== -1)
        return meshIdx
    }
    return null
  }

  function textureFingerprint(texture: any): string | null {
    return texture?.image?.uuid || texture?.image?.src || texture?.uuid || null
  }

  function textureMatchesSlot(slot: any, target: any, targetIdx: number | null): boolean {
    if (!slot || !target)
      return false
    return textureIdentitiesMatch(
      { index: getGltfImageIndex(slot), fingerprint: textureFingerprint(slot) },
      { index: targetIdx, fingerprint: textureFingerprint(target) },
    )
  }

  function materialValue(material: any, prop: 'rimWidth' | 'shadeShift' | 'shadeToony'): number {
    if (prop === 'rimWidth')
      return material.rimWidthFactor ?? material.uniforms?.rimWidth?.value ?? 0
    if (prop === 'shadeShift')
      return material.shadingShiftFactor ?? material.uniforms?.shadingShift?.value ?? 0
    return material.shadingToonyFactor ?? material.uniforms?.shadingToony?.value ?? 0
  }

  function updateMaterialProp(prop: 'rimWidth' | 'shadeShift' | 'shadeToony', value: number) {
    if (!selectedMaterial)
      return
    const material = selectedMaterial
    if (prop === 'rimWidth') {
      if ('rimWidthFactor' in material)
        material.rimWidthFactor = value
      else if (material.uniforms?.rimWidth)
        material.uniforms.rimWidth.value = value
      else material.rimWidth = value
    }
    else if (prop === 'shadeShift') {
      if ('shadingShiftFactor' in material)
        material.shadingShiftFactor = value
      else if (material.uniforms?.shadingShift)
        material.uniforms.shadingShift.value = value
      else material.shadeShift = value
    }
    else {
      if ('shadingToonyFactor' in material)
        material.shadingToonyFactor = value
      else if (material.uniforms?.shadingToony)
        material.uniforms.shadingToony.value = value
      else material.shadeToony = value
    }
    material.needsUpdate = true
    syncMaterialControls()
  }

  function syncMaterialControls() {
    if (!selectedMaterial) {
      materialControls.value = []
      return
    }
    const material = selectedMaterial
    materialControls.value = [
      {
        id: 'rimWidth',
        label: 'Rim Width',
        kind: 'range',
        min: 0,
        max: 1,
        step: 0.01,
        value: materialValue(material, 'rimWidth'),
      },
      {
        id: 'shadeShift',
        label: 'Shade Shift',
        kind: 'range',
        min: -1,
        max: 1,
        step: 0.01,
        value: materialValue(material, 'shadeShift'),
      },
      {
        id: 'additiveBlending',
        label: 'Additive Blending',
        kind: 'toggle',
        value: material.blending === 2,
      },
    ]
  }

  function takeSnapshot() {
    initialMaterials.clear()
    initialVisibility.clear()
    activeVrm.value?.scene.traverse((node: any) => {
      if (node.type === 'Mesh' || node.type === 'SkinnedMesh') {
        initialVisibility.set(node.uuid, node.visible)
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) {
          if (!material?.uuid || initialMaterials.has(material.uuid))
            continue
          initialMaterials.set(material.uuid, {
            rimWidth: materialValue(material, 'rimWidth'),
            shadeShift: materialValue(material, 'shadeShift'),
            shadeToony: materialValue(material, 'shadeToony'),
            blending: material.blending,
            transparent: material.transparent,
          })
        }
      }
    })
  }

  function rebuild() {
    entries.clear()
    nodesById.clear()
    textures.value = []
    parts.value = []
    materialControls.value = []
    selectedMaterial = null

    if (!activeVrm.value)
      return

    const found = new Map<string, VrmTextureEntry>()
    activeVrm.value.scene.traverse((node: any) => {
      if (node.type === 'Mesh' || node.type === 'SkinnedMesh') {
        nodesById.set(node.uuid, node)
        parts.value.push({
          id: node.uuid,
          name: node.name || 'Unnamed Mesh',
          kind: node.type,
          visible: node.visible,
          canFocus: true,
        })
      }
      if (!node.material)
        return

      const materials = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of materials) {
        const slots = [
          { tex: material.map, type: 'Main' },
          { tex: material.shadeMultiplyTexture, type: 'Shade' },
          { tex: material.rimMultiplyTexture, type: 'Rim' },
          { tex: material.sphereAddTexture, type: 'MatCap' },
        ]
        for (const slot of slots) {
          if (!slot.tex)
            continue
          const idx = getGltfImageIndex(slot.tex)
          const key = idx !== null ? String(idx) : (slot.tex.image?.uuid || slot.tex.image?.src || slot.tex.uuid)
          const materialName = prettyMaterialName(material.name || node.name || 'Unnamed material')
          let entry = found.get(key)
          if (!entry) {
            entry = { texture: slot.tex, type: slot.type, nodeName: node.name, materials: new Set(), material }
            found.set(key, entry)
          }
          entry.materials.add(materialName)
        }
      }
    })

    let nextId = 0
    for (const entry of found.values()) {
      const id = nextId++
      entries.set(id, entry)
      textures.value.push({
        id,
        name: entry.texture.name || `Tex ${id}`,
        kind: entry.type,
        previewUrl: getTextureUrl(entry.texture),
        width: entry.texture.image?.width ?? null,
        height: entry.texture.image?.height ?? null,
        owners: [...entry.materials],
        hasAlpha: imageHasAlpha(entry.texture.image),
        shared: entry.materials.size > 1,
      })
    }

    takeSnapshot()
  }

  function selectTexture(id: HackerTextureId) {
    const entry = entries.get(id)
    selectedMaterial = entry?.material ?? null
    syncMaterialControls()
  }

  function setMaterialControl(id: string, value: number | boolean) {
    if (id === 'additiveBlending') {
      if (!selectedMaterial)
        return
      selectedMaterial.blending = value ? 2 : 1
      selectedMaterial.transparent = true
      selectedMaterial.needsUpdate = true
      syncMaterialControls()
      return
    }
    updateMaterialProp(id as 'rimWidth' | 'shadeShift', Number(value))
  }

  function setPartVisibility(id: string, visible: boolean) {
    const node = nodesById.get(id)
    if (!node)
      return
    node.visible = visible
    modelStore.setMeshVisibility(node.name || '', visible)
    parts.value = parts.value.map(part => part.id === id ? { ...part, visible } : part)
  }

  function targetIsColorMap(target: any, targetIdx: number | null): boolean {
    let found = false
    activeVrm.value?.scene.traverse((node: any) => {
      if (found || !node.material)
        return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of materials) {
        if (material.map && textureMatchesSlot(material.map, target, targetIdx)) {
          found = true
          break
        }
      }
    })
    return found
  }

  function linearizeForPreview(image: any): HTMLCanvasElement | null {
    if (!image?.width || !image?.height)
      return null
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return null
    ctx.drawImage(image, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    linearizeRgba(imageData.data)
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }

  function mimeFromUrl(url: string): string {
    if (url.startsWith('data:image/webp'))
      return 'image/webp'
    if (url.startsWith('data:image/jpeg'))
      return 'image/jpeg'
    return 'image/png'
  }

  async function applyTexture(id: HackerTextureId, url: string, _meta: any): Promise<void> {
    const entry = entries.get(id)
    if (!entry || !activeVrm.value)
      throw new Error('Texture is no longer available')

    const targetIdx = getGltfImageIndex(entry.texture)
    const shouldLinearize = targetIsColorMap(entry.texture, targetIdx)
    const texture = await new Promise<any>((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject)
    })

    const image = texture.image
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(image, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      let blackCount = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] <= 8 && data[i + 1] <= 8 && data[i + 2] <= 8) {
          data[i + 3] = 0
          blackCount++
        }
      }
      if (blackCount > 0) {
        ctx.putImageData(imageData, 0, 0)
        texture.image = canvas
      }
    }

    const exportImage = texture.image
    const previewImage = shouldLinearize
      ? (linearizeForPreview(exportImage) ?? exportImage)
      : exportImage

    activeVrm.value.scene.traverse((node: any) => {
      if (!node.material)
        return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of materials) {
        let updated = false
        for (const slot of ['map', 'shadeMultiplyTexture', 'rimMultiplyTexture', 'sphereAddTexture']) {
          const currentSlotTexture = material[slot]
          if (!currentSlotTexture || !textureMatchesSlot(currentSlotTexture, entry.texture, targetIdx))
            continue
          if (!originalImages.has(currentSlotTexture.uuid))
            originalImages.set(currentSlotTexture.uuid, currentSlotTexture.image)
          currentSlotTexture.image = previewImage
          currentSlotTexture.colorSpace = texture.colorSpace
          currentSlotTexture.needsUpdate = true
          updated = true

          const imageIndex = getGltfImageIndex(currentSlotTexture)
          if (imageIndex !== null) {
            const mimeType = mimeFromUrl(url)
            const dataUrl = exportImage instanceof HTMLCanvasElement ? exportImage.toDataURL(mimeType) : url
            mutations.set(imageIndex, { data: dataUrl.split(',')[1], mimeType })
          }
        }
        if (updated)
          material.needsUpdate = true
      }
    })
    rawApplied.set(id, url)
  }

  function restoreTexture(id: HackerTextureId): void {
    const entry = entries.get(id)
    if (!entry || !activeVrm.value)
      return
    const targetIdx = getGltfImageIndex(entry.texture)
    activeVrm.value.scene.traverse((node: any) => {
      if (!node.material)
        return
      const materials = Array.isArray(node.material) ? node.material : [node.material]
      for (const material of materials) {
        for (const slot of ['map', 'shadeMultiplyTexture', 'rimMultiplyTexture', 'sphereAddTexture']) {
          const slotTexture = material[slot]
          if (!slotTexture || !textureMatchesSlot(slotTexture, entry.texture, targetIdx))
            continue
          const original = originalImages.get(slotTexture.uuid)
          if (original) {
            slotTexture.image = original
            slotTexture.needsUpdate = true
          }
        }
        material.needsUpdate = true
      }
    })
    if (targetIdx !== null)
      mutations.delete(targetIdx)
    rawApplied.delete(id)
  }

  async function getGenerationBase(id: HackerTextureId): Promise<string> {
    const applied = rawApplied.get(id)
    if (applied)
      return applied
    const entry = entries.get(id)
    const url = getTextureUrl(entry?.texture)
    if (!url)
      throw new Error('No raw texture available for generation')
    return url
  }

  async function ensureSourceBuffer(): Promise<ArrayBuffer | null> {
    if (sourceBuffer)
      return sourceBuffer
    if (settingsStore.stageModelSelectedFile) {
      sourceBuffer = await settingsStore.stageModelSelectedFile.arrayBuffer()
      return sourceBuffer
    }
    const sourceUrl = settingsStore.stageModelSelectedUrl
      || (settingsStore.stageModelSelectedDisplayModel as any)?.url
    if (sourceUrl) {
      const response = await fetch(sourceUrl)
      sourceBuffer = await response.arrayBuffer()
      return sourceBuffer
    }
    return null
  }

  function buildFilename(): string {
    const displayModel: any = settingsStore.stageModelSelectedDisplayModel
    return buildExportFileName({
      metaName: activeVrm.value?.meta?.name,
      metaTitle: activeVrm.value?.meta?.title,
      displayModelName: displayModel?.name,
      displayModelFileName: displayModel?.file?.name,
      selectedFileName: settingsStore.stageModelSelectedFile?.name,
      selectedUrl: settingsStore.stageModelSelectedUrl,
      displayModelUrl: displayModel?.url,
      cardName: airiCardStore.activeCard?.name,
      selectedModelId: settingsStore.stageModelSelected,
    }, new Date(), 'vrm')
  }

  async function exportAsset() {
    const source = await ensureSourceBuffer()
    if (!source)
      throw new Error('No source binary found')
    const gltf = activeVrmParser.value?.json
    if (!gltf)
      throw new Error('No parsed glTF metadata available')

    const hiddenPrimitives: VrmHiddenPrimitive[] = []
    const hiddenNodeIndices: number[] = []
    activeVrm.value?.scene.traverse((node: any) => {
      if (node.visible !== false || (node.type !== 'Mesh' && node.type !== 'SkinnedMesh') || node.name?.startsWith('VRMExpression'))
        return
      const assoc = activeVrmParser.value.associations.get(node)
      if (assoc?.meshes !== undefined && assoc?.primitives !== undefined) {
        if (gltf.meshes?.[assoc.meshes]?.primitives?.[assoc.primitives])
          hiddenPrimitives.push({ meshIndex: assoc.meshes, primitiveIndex: assoc.primitives })
      }
      else {
        const nodeIdx = getGltfNodeIndex(node, gltf)
        if (nodeIdx !== null && gltf.nodes?.[nodeIdx])
          hiddenNodeIndices.push(nodeIdx)
      }
    })

    const output = exportVrmBinary({
      source,
      mutations: [...mutations.entries()].map(([imageIndex, mutation]) => ({
        imageIndex,
        data: mutation.data,
        mimeType: mutation.mimeType,
      })),
      hiddenPrimitives,
      hiddenNodeIndices,
    })
    return {
      blob: new Blob([output], { type: 'application/octet-stream' }),
      filename: buildFilename(),
    }
  }

  function reset() {
    for (const [uuid, image] of originalImages.entries()) {
      activeVrm.value?.scene.traverse((node: any) => {
        if (!node.material)
          return
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) {
          for (const slot of ['map', 'shadeMultiplyTexture', 'rimMultiplyTexture', 'sphereAddTexture']) {
            const texture = material[slot]
            if (texture?.uuid === uuid) {
              texture.image = image
              texture.needsUpdate = true
              material.needsUpdate = true
            }
          }
        }
      })
    }
    mutations.clear()
    rawApplied.clear()
    for (const [id, visible] of initialVisibility.entries()) {
      const node = nodesById.get(id)
      if (node)
        node.visible = visible
    }
    for (const [uuid, snapshot] of initialMaterials.entries()) {
      let found = false
      activeVrm.value?.scene.traverse((node: any) => {
        if (found || !node.material)
          return
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        for (const material of materials) {
          if (material.uuid !== uuid)
            continue
          if ('rimWidthFactor' in material)
            material.rimWidthFactor = snapshot.rimWidth
          else if (material.uniforms?.rimWidth)
            material.uniforms.rimWidth.value = snapshot.rimWidth
          if ('shadingShiftFactor' in material)
            material.shadingShiftFactor = snapshot.shadeShift
          else if (material.uniforms?.shadingShift)
            material.uniforms.shadingShift.value = snapshot.shadeShift
          if ('shadingToonyFactor' in material)
            material.shadingToonyFactor = snapshot.shadeToony
          else if (material.uniforms?.shadingToony)
            material.uniforms.shadingToony.value = snapshot.shadeToony
          material.blending = snapshot.blending
          material.transparent = snapshot.transparent
          material.needsUpdate = true
          found = true
          break
        }
      })
    }
    parts.value = parts.value.map((part) => {
      const node = nodesById.get(part.id)
      return { ...part, visible: node?.visible ?? part.visible }
    })
    selectedMaterial = null
    materialControls.value = []
  }

  function dispose() {
    sourceBuffer = null
    entries.clear()
    nodesById.clear()
    originalImages.clear()
    mutations.clear()
    rawApplied.clear()
  }

  watch(activeVrm, () => {
    sourceBuffer = null
    originalImages.clear()
    mutations.clear()
    rawApplied.clear()
    rebuild()
  }, { immediate: true })

  return {
    kind: 'vrm',
    get identity() {
      return modelStore.activeVrmIdentity || settingsStore.stageModelSelected || 'vrm'
    },
    label: 'VRM',
    capabilities: {
      textures: true,
      preview: true,
      revert: true,
      parts: true,
      materials: true,
      previewGamma: true,
      export: 'full-bundle',
    },
    ready,
    textures,
    parts,
    materialControls,
    selectTexture,
    getGenerationBase,
    applyTexture,
    restoreTexture,
    setMaterialControl,
    setPartVisibility,
    exportAsset,
    reset,
    dispose,
  }
}
