import { useModelStore } from '@proj-airi/stage-ui-three'
// @vitest-environment jsdom
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVrmHackerAdapter } from './use-vrm-hacker-adapter'

vi.mock('../../../../../../../stores/modules/airi-card', () => ({
  useAiriCardStore: () => ({ activeCard: { name: 'Test Avatar' } }),
}))

function fakeModel() {
  const image = new Image()
  Object.defineProperty(image, 'width', { value: 2048 })
  Object.defineProperty(image, 'height', { value: 2048 })
  image.src = 'data:image/png;base64,iVBORw0KGgo='

  const texture = { uuid: 'tex-body', name: 'Body', image }
  const material = {
    uuid: 'mat-body',
    name: 'N00_000_00_Body_00_SKIN (Instance)',
    map: texture,
    rimWidthFactor: 0.25,
    shadingShiftFactor: -0.1,
    shadingToonyFactor: 0.8,
    blending: 1,
    transparent: false,
  }
  const node = {
    type: 'Mesh',
    uuid: 'node-body',
    name: 'Body',
    visible: true,
    material,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
  const scene = {
    traverse(callback: (node: any) => void) {
      callback(node)
    },
  }
  return {
    texture,
    material,
    node,
    vrm: { scene, meta: { name: 'AvatarSample_A' } },
    parser: {
      associations: new Map<any, any>([[texture, { textures: 0 }]]),
      json: {
        textures: [{ source: 0 }],
        nodes: [{ name: 'Body' }],
        meshes: [],
        materials: [],
        buffers: [{ byteLength: 0 }],
        bufferViews: [],
        images: [],
      },
    },
  }
}

describe('hacker-studio: VRM adapter characterization', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    disposePinia(pinia)
  })

  it('extracts textures, parts, owners, and material controls from the live scene', () => {
    const model = fakeModel()
    const store = useModelStore()
    store.activeVrm = model.vrm
    store.activeVrmParser = model.parser
    store.activeVrmIdentity = 'https://example.com/avatar.vrm'

    const adapter = useVrmHackerAdapter()
    expect(adapter.textures.value).toHaveLength(1)
    expect(adapter.textures.value[0]).toMatchObject({
      id: 0,
      name: 'Body',
      kind: 'Main',
      width: 2048,
      height: 2048,
      owners: ['Body_00_SKIN'],
    })
    expect(adapter.parts.value).toHaveLength(1)
    expect(adapter.parts.value[0]).toMatchObject({
      id: 'node-body',
      name: 'Body',
      visible: true,
    })

    adapter.selectTexture?.(0)
    expect(adapter.materialControls?.value.map(control => control.id)).toEqual([
      'rimWidth',
      'shadeShift',
      'additiveBlending',
    ])
    expect(adapter.materialControls?.value[0].value).toBe(0.25)
  })

  it('updates part visibility and reports the adapter identity', () => {
    const model = fakeModel()
    const store = useModelStore()
    store.activeVrm = model.vrm
    store.activeVrmParser = model.parser
    store.activeVrmIdentity = 'https://example.com/avatar.vrm'

    const adapter = useVrmHackerAdapter()
    adapter.setPartVisibility?.('node-body', false)
    expect(model.node.visible).toBe(false)
    expect(adapter.parts.value[0].visible).toBe(false)
    expect(adapter.identity).toBe('https://example.com/avatar.vrm')
  })
})
