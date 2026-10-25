// @vitest-environment jsdom
import type { Live2DModel } from 'pixi-live2d-display/cubism4'

import JSZip from 'jszip'

import { useLive2d } from '@proj-airi/stage-ui-live2d'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettings } from '../../../../../../../stores/settings'
import { useLive2dHackerAdapter } from './use-live2d-hacker-adapter'

const pixiState = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@pixi/core', () => ({
  Texture: { from: pixiState.from },
}))

function fakeModel() {
  const baseTexture = {
    width: 2048,
    height: 2048,
    resource: { src: 'data:image/png;base64,iVBORw0KGgo=' },
  }
  const texture = {
    baseTexture,
    update: vi.fn(),
  }
  return {
    model: {
      textures: [texture],
      internalModel: {
        drawables: [],
        settings: { name: 'Hiyori' },
      },
    } as unknown as Live2DModel,
    texture,
  }
}

async function makeZip(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('model/avatar.model3.json', JSON.stringify({
    Version: 3,
    FileReferences: { Textures: ['textures/body.png'] },
  }))
  zip.file('model/textures/body.png', new Uint8Array([1, 2, 3]))
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('hacker-studio: Live2D adapter characterization', () => {
  let pinia: ReturnType<typeof createPinia>
  let live2d: ReturnType<typeof useLive2d>
  let settings: ReturnType<typeof useSettings>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    live2d = useLive2d()
    settings = useSettings()
    settings.stageModelSelected = 'live2d-preset'
    settings.stageModelSelectedFile = undefined
    settings.stageModelSelectedUrl = undefined
    live2d.model = fakeModel().model
  })

  afterEach(() => {
    live2d.model = undefined
    disposePinia(pinia)
  })

  it('extracts atlas descriptors and Live2D capability defaults', () => {
    const adapter = useLive2dHackerAdapter()

    expect(adapter.textures.value).toHaveLength(1)
    expect(adapter.textures.value[0]).toMatchObject({
      id: 0,
      name: 'Atlas 0',
      kind: 'Atlas',
      width: 2048,
      height: 2048,
      owners: ['Atlas 0'],
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
    expect(adapter.identity).toBe('live2d-preset')
  })

  it('reports a visible export reason until a ZIP source is available', async () => {
    const adapter = useLive2dHackerAdapter()
    await vi.waitFor(() => {
      expect(adapter.exportUnavailableReason?.value).toContain('Load a ZIP bundle')
    })
    expect(adapter.capabilities.export).toBe('full-bundle')
  })

  it('applies and restores a baseTexture without requesting a model reload', async () => {
    const fake = fakeModel()
    // Preserve the real store model but expose a drawable wired to the target.
    const target = fake.texture
    const originalBase = target.baseTexture
    const drawable = { texture: { baseTexture: target.baseTexture, update: vi.fn() } }
    live2d.model = {
      textures: [target],
      internalModel: { drawables: [drawable], settings: { name: 'Hiyori' } },
    } as unknown as Live2DModel

    const nextBase = { valid: true, width: 2048, height: 2048, resource: { src: 'data:image/png;base64,NEW' } }
    pixiState.from.mockReturnValue({ baseTexture: nextBase })
    const reloadSpy = vi.spyOn(live2d, 'shouldUpdateView')
    const adapter = useLive2dHackerAdapter()

    await adapter.applyTexture(0, 'data:image/png;base64,TkVX', { source: 'upload' })
    expect(target.baseTexture).toBe(nextBase)
    expect(drawable.texture.baseTexture).toBe(nextBase)
    expect(reloadSpy).not.toHaveBeenCalled()

    adapter.restoreTexture(0)
    expect(target.baseTexture).toBe(originalBase)
    expect(drawable.texture.baseTexture).toBe(originalBase)
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('loads a local ZIP source and exports a valid HACK bundle', async () => {
    const source = await makeZip()
    settings.stageModelSelectedFile = new File([source], 'hiyori.zip', { type: 'application/zip' })

    const adapter = useLive2dHackerAdapter()
    await vi.waitFor(() => {
      expect(adapter.exportUnavailableReason?.value).toBeNull()
    })

    const result = await adapter.exportAsset()
    expect(result.filename).toMatch(/_HACK_\d{8}-\d{4}\.zip$/)
    expect(result.blob.type).toBe('application/zip')

    const output = await JSZip.loadAsync(await result.blob.arrayBuffer())
    expect(output.file('model/avatar.model3.json')).toBeTruthy()
    expect(Array.from(await output.file('model/textures/body.png')!.async('uint8array'))).toEqual([1, 2, 3])
  })
})
