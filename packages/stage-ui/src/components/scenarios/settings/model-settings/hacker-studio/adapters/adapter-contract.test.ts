import type { HackerAdapter, HackerTexture } from './types'

import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useHackerStudio } from '../composables/use-hacker-studio'

function texture(id: number, name: string): HackerTexture {
  return {
    id,
    name,
    kind: 'Main',
    previewUrl: `blob:${id}`,
    width: 2048,
    height: 2048,
    owners: [`Material ${id}`],
    hasAlpha: true,
    shared: false,
  }
}

function fakeAdapter(options: { exportEnabled?: boolean } = {}) {
  const textures = ref([texture(1, 'Tex 1'), texture(2, 'Tex 2')])
  const parts = ref([])
  const applied: { id: number, dataUrl: string, meta: any }[] = []
  const restored: number[] = []
  const disposed: number[] = []

  const adapter: HackerAdapter = {
    kind: 'vrm',
    identity: 'vrm:avatar-a',
    label: 'VRM',
    capabilities: {
      textures: true,
      preview: true,
      revert: true,
      parts: true,
      materials: true,
      previewGamma: true,
      export: options.exportEnabled === false ? 'disabled' : 'full-bundle',
    },
    ready: ref(true),
    textures,
    parts,
    async getGenerationBase(id) {
      return `base:${id}`
    },
    async applyTexture(id, dataUrl, meta) {
      applied.push({ id, dataUrl, meta })
    },
    restoreTexture(id) {
      restored.push(id)
    },
    async exportAsset() {
      return { blob: new Blob(['vrm']), filename: 'avatar.vrm' }
    },
    reset() {},
    dispose() {
      disposed.push(1)
    },
  }

  return { adapter, textures, applied, restored, disposed }
}

describe('hacker-studio: adapter controller contract', () => {
  it('selects textures and derives the selected descriptor', () => {
    const { adapter } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    studio.selectTexture(2)
    expect(studio.selectedTexture.value?.name).toBe('Tex 2')
  })

  it('preserves prompt across mode switches and never resets it on selection', () => {
    const { adapter } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    studio.setPrompt('Midnight navy fabric')
    studio.setMode('prompt')
    studio.selectTexture(1)
    expect(studio.mode.value).toBe('prompt')
    expect(studio.prompt.value).toBe('Midnight navy fabric')
  })

  it('applies an upload, records origin metadata, and marks the preview active', async () => {
    const { adapter, applied } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    studio.selectTexture(1)
    await studio.applyUpload(1, 'data:image/png;base64,AAAA', 'cardigan.png')
    expect(applied).toEqual([{
      id: 1,
      dataUrl: 'data:image/png;base64,AAAA',
      meta: { source: 'upload', fileName: 'cardigan.png' },
    }])
    expect(studio.currentReplacement.value).toEqual({
      url: 'data:image/png;base64,AAAA',
      source: 'upload',
      fileName: 'cardigan.png',
    })
    expect(studio.currentPreviewing.value).toBe(true)
  })

  it('keeps replacement origin per texture across selection changes', async () => {
    const { adapter } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    await studio.applyUpload(1, 'data:image/png;base64,ONE', 'one.png')
    studio.selectTexture(2)
    expect(studio.currentReplacement.value).toBeNull()
    studio.selectTexture(1)
    expect(studio.currentReplacement.value?.fileName).toBe('one.png')
  })

  it('toggles preview by restoring and re-applying the stored replacement', async () => {
    const { adapter, applied, restored } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    studio.selectTexture(1)
    await studio.applyUpload(1, 'data:image/png;base64,ONE', 'one.png')
    applied.length = 0

    await studio.togglePreview(1)
    expect(restored).toEqual([1])
    expect(studio.currentPreviewing.value).toBe(false)

    await studio.togglePreview(1)
    expect(applied).toEqual([{
      id: 1,
      dataUrl: 'data:image/png;base64,ONE',
      meta: { source: 'upload', fileName: 'one.png' },
    }])
    expect(studio.currentPreviewing.value).toBe(true)
  })

  it('reverts a texture and clears its replacement/preview state', async () => {
    const { adapter, restored } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    await studio.applyUpload(1, 'data:image/png;base64,ONE', 'one.png')
    studio.revertTexture(1)
    expect(restored).toEqual([1])
    expect(studio.replacementFor(1)).toBeNull()
    expect(studio.previewingFor(1)).toBe(false)
  })

  it('applies a generation result to its originating texture while another is selected', async () => {
    const { adapter, applied } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    const context = await studio.beginGeneration(1)
    studio.selectTexture(2)
    const appliedResult = await studio.applyGenerationResult(context, 'data:image/png;base64,GEN')
    expect(appliedResult).toBe(true)
    expect(applied.at(-1)?.id).toBe(1)
    expect(studio.replacementFor(1)?.source).toBe('generated')
    expect(studio.currentReplacement.value).toBeNull()
  })

  it('discards a late generation result after a newer upload', async () => {
    const { adapter, applied } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    const context = await studio.beginGeneration(1)
    await studio.applyUpload(1, 'data:image/png;base64,NEW', 'new.png')
    const before = applied.length
    const appliedResult = await studio.applyGenerationResult(context, 'data:image/png;base64,OLD')
    expect(appliedResult).toBe(false)
    expect(applied).toHaveLength(before)
    expect(studio.generationError.value).toContain('result discarded')
    expect(studio.replacementFor(1)?.fileName).toBe('new.png')
  })

  it('discards a generation result after revert', async () => {
    const { adapter, applied } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    const context = await studio.beginGeneration(1)
    studio.revertTexture(1)
    const before = applied.length
    expect(await studio.applyGenerationResult(context, 'data:image/png;base64,OLD')).toBe(false)
    expect(applied).toHaveLength(before)
    expect(studio.replacementFor(1)).toBeNull()
  })

  it('exposes export only when the adapter declares a full bundle', async () => {
    const enabled = useHackerStudio(fakeAdapter().adapter)
    await expect(enabled.exportAsset()).resolves.toMatchObject({ filename: 'avatar.vrm' })

    const disabled = useHackerStudio(fakeAdapter({ exportEnabled: false }).adapter)
    await expect(disabled.exportAsset()).rejects.toThrow('Export is unavailable')
  })

  it('resets session state and disposes the adapter', async () => {
    const { adapter, disposed } = fakeAdapter()
    const studio = useHackerStudio(adapter)
    await studio.applyUpload(1, 'data:image/png;base64,ONE', 'one.png')
    studio.setPrompt('keep?')
    studio.reset()
    expect(studio.replacementFor(1)).toBeNull()
    expect(studio.selectedTextureId.value).toBeNull()
    expect(studio.prompt.value).toBe('keep?')
    studio.dispose()
    expect(disposed).toEqual([1])
  })
})
