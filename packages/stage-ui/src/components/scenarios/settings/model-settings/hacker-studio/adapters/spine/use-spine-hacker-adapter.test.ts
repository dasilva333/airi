// @vitest-environment jsdom
import type { SpineHackerRuntime } from '@proj-airi/stage-ui-spine'

import JSZip from 'jszip'

import { setSpineHackerRuntime } from '@proj-airi/stage-ui-spine'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSettings } from '../../../../../../../stores/settings'
import { useSpineHackerAdapter } from './use-spine-hacker-adapter'

async function makeZip(includeSource = true): Promise<ArrayBuffer | undefined> {
  if (!includeSource)
    return undefined
  const zip = new JSZip()
  zip.file('model/model.atlas', 'body.png\nsize: 1024,1024\nformat: RGBA8888\nfilter: Linear,Linear\n\nbody\n  bounds: 0,0,10,10\n')
  zip.file('model/model.json', JSON.stringify({ skeleton: { spine: '4.2' } }))
  zip.file('model/body.png', new Uint8Array([1, 2, 3]))
  return zip.generateAsync({ type: 'arraybuffer' })
}

function makeRuntime(sourceBuffer?: ArrayBuffer): SpineHackerRuntime {
  const page = {
    name: 'body.png',
    width: 1024,
    height: 1024,
    pma: false,
    minFilter: 9729,
    texture: {
      getImage: () => ({ src: 'data:image/png;base64,iVBORw0KGgo=' }),
      dispose: () => {},
    },
    setTexture(texture: any) {
      this.texture = texture
    },
  }
  return {
    atlas: { pages: [page] } as any,
    context: {} as any,
    layout: {
      skeletonPath: 'model/model.json',
      skeletonFormat: 'json',
      atlasPath: 'model/model.atlas',
      texturePaths: ['model/body.png'],
    },
    variantName: 'Hiyori',
    sourceBuffer,
    premultipliedAlpha: false,
    modelId: 'spine-preset',
    createTexture: () => ({ dispose() {} }),
  }
}

describe('hacker-studio: Spine adapter characterization', () => {
  let pinia: ReturnType<typeof createPinia>
  let settings: ReturnType<typeof useSettings>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    settings = useSettings()
    settings.stageModelSelected = 'spine-preset'
    settings.stageModelSelectedFile = undefined
    settings.stageModelSelectedUrl = undefined
    setSpineHackerRuntime(makeRuntime())
  })

  afterEach(() => {
    setSpineHackerRuntime(null)
    disposePinia(pinia)
  })

  it('extracts atlas pages and Spine capability defaults', () => {
    const adapter = useSpineHackerAdapter()
    expect(adapter.textures.value).toHaveLength(1)
    expect(adapter.textures.value[0]).toMatchObject({
      id: 0,
      name: 'body.png',
      kind: 'Atlas',
      width: 1024,
      height: 1024,
      owners: ['body.png'],
    })
    expect(adapter.parts.value).toEqual([])
    expect(adapter.ownerNoun).toBe('atlas page')
    expect(adapter.acceptedUploadMimes).toEqual(['image/png'])
    expect(adapter.capabilities).toMatchObject({
      parts: false,
      materials: false,
      previewGamma: false,
      export: 'full-bundle',
    })
    expect(adapter.identity).toBe('spine-preset')
  })

  it('reports why export is unavailable without a source ZIP', async () => {
    const adapter = useSpineHackerAdapter()
    expect(adapter.exportUnavailableReason?.value).toContain('Load a ZIP bundle')
    await expect(adapter.exportAsset()).rejects.toThrow('Load a ZIP bundle')
  })

  it('exports a valid HACK ZIP once a source archive is available', async () => {
    const source = await makeZip()
    setSpineHackerRuntime(makeRuntime(source))

    const adapter = useSpineHackerAdapter()
    await expect(adapter.exportUnavailableReason?.value).toBeNull()

    const result = await adapter.exportAsset()
    expect(result.filename).toMatch(/_HACK_\d{8}-\d{4}\.zip$/)
    expect(result.blob.type).toBe('application/zip')

    const output = await JSZip.loadAsync(await result.blob.arrayBuffer())
    expect(output.file('model/model.atlas')).toBeTruthy()
    expect(Array.from(await output.file('model/body.png')!.async('uint8array'))).toEqual([1, 2, 3])
  })

  it('rebuilds and clears descriptors when the runtime unloads', async () => {
    const adapter = useSpineHackerAdapter()
    expect(adapter.textures.value).toHaveLength(1)

    setSpineHackerRuntime(null)
    await Promise.resolve()
    expect(adapter.textures.value).toEqual([])
    expect(adapter.ready.value).toBe(false)
    expect(adapter.exportUnavailableReason?.value).toContain('Load a Spine model')
  })
})
