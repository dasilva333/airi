import type { HackerAdapter, HackerApplyMeta, HackerPart, HackerTexture, HackerTextureId } from '../types'
import type { Live2dTextureMutation } from './live2d-exporter'
import type { BaseTextureSwap } from './live2d-texture'

import { Texture } from '@pixi/core'
import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useSettings } from '../../../../../../../stores/settings'
import { buildExportFileName } from '../../domain/export-filename'
import { exportLive2dZip } from './live2d-exporter'
import { replaceBaseTexture, restoreBaseTexture } from './live2d-texture'

interface Live2dTextureEntry {
  texture: any
  index: number
}

function getTextureUrl(texture: any): string | null {
  if (!texture)
    return null
  const base = texture.baseTexture || texture
  const resource = base?.resource
  if (resource?.src)
    return resource.src
  if (resource?.source?.src)
    return resource.source.src
  if (base?.source?.src)
    return base.source.src
  return null
}

function isZipBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4)
    return false
  const bytes = new Uint8Array(buffer, 0, 4)
  return bytes[0] === 0x50 && bytes[1] === 0x4B
}

async function toBase64(url: string): Promise<string> {
  if (url.startsWith('data:'))
    return url.split(',')[1]
  const response = await fetch(url)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export function useLive2dHackerAdapter(): HackerAdapter {
  const live2dStore = useLive2d()
  const settingsStore = useSettings()
  const { model } = storeToRefs(live2dStore)

  const textures = ref<HackerTexture[]>([])
  const parts = ref<HackerPart[]>([])
  const sourceZip = ref<ArrayBuffer | null>(null)
  const sourceLoading = ref(false)
  const sourceError = ref<string | null>(null)

  const entries = new Map<number, Live2dTextureEntry>()
  const originals = new Map<number, BaseTextureSwap<any>>()
  const mutations = new Map<number, Live2dTextureMutation>()
  const rawApplied = new Map<number, string>()
  let sourceToken = 0

  const ready = computed(() => Boolean(model.value))

  const identity = computed(() => {
    const settings = (model.value?.internalModel as any)?.settings
    return settingsStore.stageModelSelected
      || settingsStore.stageModelSelectedUrl
      || settings?.name
      || 'live2d'
  })

  const exportUnavailableReason = computed(() => {
    if (sourceLoading.value)
      return 'Preparing the source ZIP…'
    if (!sourceZip.value)
      return sourceError.value || 'Load a ZIP bundle to export a complete model.'
    return null
  })

  function drawables(): any[] {
    return (model.value?.internalModel as any)?.drawables ?? []
  }

  function rebuild() {
    entries.clear()
    textures.value = []
    const activeModel: any = model.value
    if (!activeModel?.textures)
      return

    textures.value = activeModel.textures.map((texture: any, index: number) => {
      entries.set(index, { texture, index })
      return {
        id: index,
        name: `Atlas ${index}`,
        kind: 'Atlas',
        previewUrl: getTextureUrl(texture),
        width: texture.baseTexture?.width ?? null,
        height: texture.baseTexture?.height ?? null,
        owners: [`Atlas ${index}`],
        hasAlpha: null,
        shared: false,
      }
    })
  }

  async function loadSourceZip() {
    const token = ++sourceToken
    sourceZip.value = null
    sourceError.value = null
    sourceLoading.value = true

    try {
      const file = settingsStore.stageModelSelectedFile
      const url = settingsStore.stageModelSelectedUrl

      let buffer: ArrayBuffer | null = null
      if (file && (/\.zip$/i.test(file.name) || file.type.includes('zip'))) {
        buffer = await file.arrayBuffer()
      }
      else if (!file && url && (url.startsWith('blob:') || /\.zip(?:[?#]|$)/i.test(url))) {
        const response = await fetch(url)
        if (!response.ok)
          throw new Error(`Could not load source ZIP (${response.status})`)
        buffer = await response.arrayBuffer()
      }

      if (token !== sourceToken)
        return
      if (!buffer) {
        sourceError.value = 'Load a ZIP bundle to export a complete model.'
        return
      }
      if (!isZipBuffer(buffer)) {
        sourceError.value = 'The loaded source is not a ZIP bundle.'
        return
      }
      sourceZip.value = buffer
    }
    catch (e: any) {
      if (token === sourceToken)
        sourceError.value = e?.message || 'Could not read the source ZIP.'
    }
    finally {
      if (token === sourceToken)
        sourceLoading.value = false
    }
  }

  async function applyTexture(id: number, url: string): Promise<void> {
    const entry = entries.get(id)
    if (!entry)
      throw new Error('Atlas page is no longer available')

    const newTexture = Texture.from(url)
    if (!newTexture.baseTexture.valid) {
      await new Promise<void>((resolve, reject) => {
        newTexture.baseTexture.once('loaded', resolve)
        newTexture.baseTexture.once('error', reject)
      })
    }

    const mutationData = await toBase64(url)
    const swap = replaceBaseTexture(entry.texture, newTexture.baseTexture, drawables())
    const existing = originals.get(id)
    if (!existing) {
      originals.set(id, swap)
    }
    else {
      for (const drawable of swap.swappedDrawables) {
        if (!existing.swappedDrawables.includes(drawable))
          existing.swappedDrawables.push(drawable)
      }
    }

    mutations.set(id, { index: id, data: mutationData, mimeType: 'image/png' })
    rawApplied.set(id, url)
    // NOTICE: do not call live2dStore.shouldUpdateView() here. Model.vue treats
    // that event as a model reload request (loadModel()), which remounts the
    // settings page and loses the Lab selection. The baseTexture swap updates
    // the existing Pixi textures in place; the render ticker picks it up.
  }

  function restoreTexture(id: number): void {
    const entry = entries.get(id)
    const original = originals.get(id)
    if (!entry || !original)
      return
    restoreBaseTexture(entry.texture, original)
    mutations.delete(id)
    rawApplied.delete(id)
  }

  async function getGenerationBase(id: number): Promise<string> {
    const applied = rawApplied.get(id)
    if (applied)
      return applied
    const entry = entries.get(id)
    const url = getTextureUrl(entry?.texture)
    if (!url)
      throw new Error('No source atlas page available for generation')
    return url
  }

  async function exportAsset() {
    if (!sourceZip.value)
      throw new Error(exportUnavailableReason.value || 'Load a ZIP bundle to export a complete model.')

    const modelSettings = (model.value?.internalModel as any)?.settings
    const settingsUrl = typeof modelSettings?.url === 'string' ? modelSettings.url : undefined
    const modelName = typeof modelSettings?.name === 'string' ? modelSettings.name.split(/[\\/]/).pop() : undefined
    const model3Path = settingsUrl && /\.model3?\.json(?:[?#]|$)/i.test(settingsUrl)
      ? settingsUrl
      : (modelName ? `${modelName.replace(/\.model3?\.json$/i, '').replace(/\.(model3|json)$/i, '')}.model3.json` : undefined)
    const data = await exportLive2dZip({
      source: sourceZip.value,
      mutations: [...mutations.values()],
      model3Path,
    })

    const displayModel: any = settingsStore.stageModelSelectedDisplayModel
    const filename = buildExportFileName({
      metaName: modelSettings?.name,
      displayModelName: displayModel?.name,
      displayModelFileName: displayModel?.file?.name,
      selectedFileName: settingsStore.stageModelSelectedFile?.name,
      selectedUrl: settingsStore.stageModelSelectedUrl,
      displayModelUrl: displayModel?.url,
      selectedModelId: settingsStore.stageModelSelected,
    }, new Date(), 'zip', 'HACK')

    return {
      blob: new Blob([data.slice().buffer as ArrayBuffer], { type: 'application/zip' }),
      filename,
    }
  }

  function reset() {
    for (const [id, original] of originals.entries()) {
      const entry = entries.get(id)
      if (entry)
        restoreBaseTexture(entry.texture, original)
    }
    originals.clear()
    mutations.clear()
    rawApplied.clear()
  }

  function dispose() {
    originals.clear()
    mutations.clear()
    rawApplied.clear()
    entries.clear()
    sourceZip.value = null
  }

  watch(model, () => {
    originals.clear()
    mutations.clear()
    rawApplied.clear()
    rebuild()
  }, { immediate: true })

  watch(
    () => [settingsStore.stageModelSelectedFile, settingsStore.stageModelSelectedUrl],
    () => {
      void loadSourceZip()
    },
    { immediate: true },
  )

  return {
    kind: 'live2d',
    get identity() {
      return identity.value
    },
    label: 'Live2D',
    capabilities: {
      textures: true,
      preview: true,
      revert: true,
      parts: false,
      materials: false,
      previewGamma: false,
      export: 'full-bundle',
    },
    ready,
    textures,
    parts,
    ownerNoun: 'atlas page',
    acceptedUploadMimes: ['image/png'],
    exportUnavailableReason,
    getGenerationBase: (id: HackerTextureId) => getGenerationBase(Number(id)),
    applyTexture: (id: HackerTextureId, dataUrl: string, _meta: HackerApplyMeta) => applyTexture(Number(id), dataUrl),
    restoreTexture: (id: HackerTextureId) => restoreTexture(Number(id)),
    exportAsset,
    reset,
    dispose,
  }
}
