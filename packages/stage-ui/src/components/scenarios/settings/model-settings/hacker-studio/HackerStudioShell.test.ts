// @vitest-environment jsdom
import type { HackerAdapter, HackerMaterialControl, HackerTexture } from './adapters/types'

import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref } from 'vue'

import HackerStudioShell from './HackerStudioShell.vue'

import { useHackerStudio } from './composables/use-hacker-studio'

vi.mock('@proj-airi/electron-vueuse', () => ({
  useElectronEventaInvoke: () => vi.fn(),
}))

function texture(): HackerTexture {
  return {
    id: 7,
    name: 'N00_000_00_Body_00_SKIN',
    kind: 'Main',
    previewUrl: 'data:image/png;base64,iVBORw0KGgo=',
    width: 2048,
    height: 2048,
    owners: ['Body', 'Body outline'],
    hasAlpha: true,
    shared: true,
  }
}

function createAdapter() {
  const textures = ref([texture()])
  const parts = ref([{ id: 'part-1', name: 'Body', kind: 'SkinnedMesh', visible: true, canFocus: true }])
  const materialControls = ref<HackerMaterialControl[]>([
    { id: 'rimWidth', label: 'Rim Width', kind: 'range', min: 0, max: 1, step: 0.01, value: 0.5 },
    { id: 'additiveBlending', label: 'Additive Blending', kind: 'toggle', value: false },
  ])
  const selected: number[] = []
  const adapter: HackerAdapter = {
    kind: 'vrm',
    identity: 'vrm:shell-test',
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
    ready: ref(true),
    textures,
    parts,
    materialControls,
    selectTexture(id) {
      selected.push(Number(id))
    },
    async getGenerationBase() {
      return 'data:image/png;base64,AAAA'
    },
    async applyTexture() {},
    restoreTexture() {},
    setMaterialControl(id, value) {
      const control = materialControls.value.find(item => item.id === id)
      if (control)
        control.value = value
    },
    setPartVisibility(id, visible) {
      parts.value = parts.value.map(part => part.id === id ? { ...part, visible } : part)
    },
    async exportAsset() {
      return { blob: new Blob(['vrm']), filename: 'avatar.vrm' }
    },
    reset() {},
    dispose() {},
  }
  return { adapter, selected }
}

describe('hacker-studio: shell smoke test', () => {
  let pinia: ReturnType<typeof createPinia>
  let container: HTMLDivElement
  let app: ReturnType<typeof createApp> | null = null

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    app?.unmount()
    app = null
    container.remove()
    disposePinia(pinia)
    sessionStorage.removeItem('hacker-studio-mode')
  })

  it('renders the texture deck', async () => {
    const { adapter } = createAdapter()
    const studio = useHackerStudio(adapter)
    app = createApp(HackerStudioShell, { adapter, studio })
    app.mount(container)
    await nextTick()

    expect(container.textContent).toContain('Textures')
    expect(container.querySelector('input[placeholder="Find a texture or material..."]')).toBeTruthy()
    expect(container.textContent).toContain('N00_000_00_Body_00_SKIN')
    expect(container.textContent).toContain('1 texture')
  })

  it('selects a texture and renders its owners and material controls', async () => {
    const { adapter, selected } = createAdapter()
    const studio = useHackerStudio(adapter)
    app = createApp(HackerStudioShell, { adapter, studio })
    app.mount(container)
    await nextTick()

    const textureCard = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('N00_000_00_Body_00_SKIN'))
    expect(textureCard).toBeTruthy()
    textureCard!.click()
    await nextTick()

    expect(selected).toEqual([7])
    expect(studio.selectedTextureId.value).toBe(7)
    expect(container.textContent).toContain('Lab')
    expect(container.textContent).toContain('Used by 2 materials')
    expect(container.textContent).toContain('Material adjustments')
    expect(container.textContent).toContain('Rim Width')
  })
})
