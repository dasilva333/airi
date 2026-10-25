import type { SpineHackerRuntime } from '@proj-airi/stage-ui-spine'

import type { HackerAdapter, HackerApplyMeta, HackerPart, HackerTexture, HackerTextureId } from '../types'
import type { SpinePageMutation } from './spine-exporter'
import type { SpinePageTextureSwap } from './spine-texture'

import { createSpinePageTexture, useSpineHackerRuntime } from '@proj-airi/stage-ui-spine'
import { computed, ref, watch } from 'vue'

import { useSettings } from '../../../../../../../stores/settings'
import { buildExportFileName } from '../../domain/export-filename'
import { exportSpineZip } from './spine-exporter'
import { replaceSpinePageTexture, restoreSpinePageTexture } from './spine-texture'

interface SpineTextureEntry {
  page: any
  path: string
}

interface SpineOriginals {
  runtime: SpineHackerRuntime
  swap: SpinePageTextureSwap
}

function basename(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

function dirname(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash + 1)
}

function getPagePreviewUrl(page: any): string | null {
  const image = page?.texture?.getImage?.()
  if (!image)
    return null
  if (typeof image.src === 'string' && image.src)
    return image.src
  try {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d')?.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  }
  catch {
    return null
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not decode that atlas page.'))
    image.src = url
  })
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

function resolvePagePath(runtime: SpineHackerRuntime, page: any, index: number): string {
  const paths = runtime.layout.texturePaths
  const direct = paths[index]
  if (direct && basename(direct).toLowerCase() === basename(page.name).toLowerCase())
    return direct

  const matched = paths.find(path => basename(path).toLowerCase() === basename(page.name).toLowerCase())
  if (matched)
    return matched

  return `${dirname(runtime.layout.atlasPath)}${page.name}`
}

export function useSpineHackerAdapter(): HackerAdapter {
  const settingsStore = useSettings()
  const runtime = useSpineHackerRuntime()

  const textures = ref<HackerTexture[]>([])
  const parts = ref<HackerPart[]>([])
  const entries = new Map<number, SpineTextureEntry>()
  const originals = new Map<number, SpineOriginals>()
  const mutations = new Map<number, SpinePageMutation>()
  const rawApplied = new Map<number, string>()

  const ready = computed(() => Boolean(runtime.value))

  const identity = computed(() => {
    const rt = runtime.value
    return settingsStore.stageModelSelected
      || rt?.variantName
      || rt?.modelId
      || 'spine'
  })

  const exportUnavailableReason = computed(() => {
    if (!runtime.value)
      return 'Load a Spine model to edit its atlas pages.'
    if (!runtime.value.sourceBuffer)
      return 'Load a ZIP bundle to export a complete model.'
    return null
  })

  function rebuild() {
    entries.clear()
    textures.value = []
    const rt = runtime.value
    if (!rt)
      return

    textures.value = rt.atlas.pages.map((page: any, index: number) => {
      const path = resolvePagePath(rt, page, index)
      entries.set(index, { page, path })
      const hints: string[] = []
      if (page.pma)
        hints.push('PMA atlas page: the replacement PNG must be exported with premultiplied alpha.')
      if (!path.toLowerCase().endsWith('.png'))
        hints.push(`Source page is not a PNG (${path.split('.').pop()}); a PNG replacement will be stored at the same path.`)
      return {
        id: index,
        name: page.name,
        kind: 'Atlas',
        previewUrl: getPagePreviewUrl(page),
        width: page.width ?? null,
        height: page.height ?? null,
        owners: [page.name],
        hasAlpha: null,
        shared: false,
        hint: hints.length ? hints.join(' ') : undefined,
      }
    })
  }

  async function applyTexture(id: number, url: string, decodedImage?: HTMLImageElement): Promise<void> {
    const entry = entries.get(id)
    const rt = runtime.value
    if (!entry || !rt)
      throw new Error('Atlas page is no longer available')

    const image = decodedImage ?? await loadImage(url)
    const width = image.naturalWidth || image.width
    const height = image.naturalHeight || image.height
    if (!width || !height)
      throw new Error('Replacement atlas page has no readable dimensions.')

    const mutationData = await toBase64(url)
    const nextTexture = createSpinePageTexture(rt, image, entry.page)
    const previousTexture = entry.page.texture
    const swap = replaceSpinePageTexture(entry.page, nextTexture)

    const existing = originals.get(id)
    if (!existing) {
      originals.set(id, { runtime: rt, swap })
    }
    else if (previousTexture && previousTexture !== existing.swap.previousTexture) {
      try {
        previousTexture.dispose?.()
      }
      catch {}
    }

    mutations.set(id, { path: entry.path, data: mutationData })
    rawApplied.set(id, url)
    // No shouldUpdateView()/loadModel() call: the atlas page is sampled by the
    // continuous Spine renderer, and reloading would remount the settings UI.
  }

  function restoreTexture(id: number): void {
    const entry = entries.get(id)
    const original = originals.get(id)
    if (!entry || !original || original.runtime !== runtime.value)
      return

    const current = entry.page.texture
    restoreSpinePageTexture(entry.page, original.swap)
    if (current && current !== original.swap.previousTexture) {
      try {
        current.dispose?.()
      }
      catch {}
    }
    mutations.delete(id)
    rawApplied.delete(id)
  }

  async function getGenerationBase(id: number): Promise<string> {
    const applied = rawApplied.get(id)
    if (applied)
      return applied
    const entry = entries.get(id)
    const url = entry ? getPagePreviewUrl(entry.page) : null
    if (!url)
      throw new Error('No source atlas page available for generation')
    return url
  }

  async function exportAsset() {
    const rt = runtime.value
    if (!rt?.sourceBuffer)
      throw new Error(exportUnavailableReason.value || 'Load a ZIP bundle to export a complete model.')

    const data = await exportSpineZip({
      source: rt.sourceBuffer,
      atlasPath: rt.layout.atlasPath,
      mutations: [...mutations.values()],
    })

    const displayModel: any = settingsStore.stageModelSelectedDisplayModel
    const filename = buildExportFileName({
      metaName: rt.variantName,
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
    const rt = runtime.value
    for (const [id, original] of originals.entries()) {
      if (!rt || original.runtime !== rt)
        continue
      const entry = entries.get(id)
      if (!entry)
        continue
      const current = entry.page.texture
      restoreSpinePageTexture(entry.page, original.swap)
      if (current && current !== original.swap.previousTexture) {
        try {
          current.dispose?.()
        }
        catch {}
      }
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
  }

  watch(runtime, () => {
    // The old runtime has already been disposed by Model.vue; never restore
    // textures against it. Just drop the stale adapter bookkeeping.
    originals.clear()
    mutations.clear()
    rawApplied.clear()
    rebuild()
  }, { immediate: true })

  return {
    kind: 'spine',
    get identity() {
      return identity.value
    },
    label: 'Spine',
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
    applyTexture: (id: HackerTextureId, dataUrl: string, _meta: HackerApplyMeta, image?: HTMLImageElement) => applyTexture(Number(id), dataUrl, image),
    restoreTexture: (id: HackerTextureId) => restoreTexture(Number(id)),
    exportAsset,
    reset,
    dispose,
  }
}
