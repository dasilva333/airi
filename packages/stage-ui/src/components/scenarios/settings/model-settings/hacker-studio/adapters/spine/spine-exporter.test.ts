import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import { exportSpineZip } from './spine-exporter'

function toBase64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes))
}

async function makeZip(files: Record<string, string | Uint8Array>): Promise<ArrayBuffer> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(files))
    zip.file(path, content)
  return zip.generateAsync({ type: 'arraybuffer' })
}

async function readZip(buffer: Uint8Array) {
  return JSZip.loadAsync(buffer)
}

async function readBytes(zip: JSZip, path: string): Promise<number[]> {
  return Array.from(await zip.file(path)!.async('uint8array'))
}

const ATLAS = `body.png
size: 2048,2048
format: RGBA8888
filter: Linear,Linear
pma: true

body
  bounds: 0,0,100,100

face.png
size: 1024,1024
format: RGBA8888
filter: Linear,Linear

face
  bounds: 0,0,50,50
`

const SKELETON = JSON.stringify({ skeleton: { spine: '4.2' }, bones: [] })

describe('hacker-studio: Spine ZIP exporter', () => {
  it('replaces the page image while preserving atlas UV metadata', async () => {
    const source = await makeZip({
      'model/model.atlas': ATLAS,
      'model/model.json': SKELETON,
      'model/body.png': new Uint8Array([1, 2, 3]),
      'model/face.png': new Uint8Array([4, 5]),
      'model/extra.txt': 'untouched',
    })

    const output = await exportSpineZip({
      source,
      atlasPath: 'model/model.atlas',
      mutations: [{ path: 'model/body.png', data: toBase64([9, 8, 7]) }],
    })
    const zip = await readZip(output)

    expect(await readBytes(zip, 'model/body.png')).toEqual([9, 8, 7])
    expect(await readBytes(zip, 'model/face.png')).toEqual([4, 5])
    expect(await zip.file('model/extra.txt')!.async('string')).toBe('untouched')
    expect(await zip.file('model/model.atlas')!.async('string')).toBe(ATLAS)
  })

  it('preserves the atlas when no mutations are supplied', async () => {
    const source = await makeZip({
      'model/model.atlas': ATLAS,
      'model/model.json': SKELETON,
      'model/body.png': new Uint8Array([1]),
      'model/face.png': new Uint8Array([2]),
    })

    const output = await exportSpineZip({ source, atlasPath: 'model/model.atlas', mutations: [] })
    const zip = await readZip(output)
    expect(await zip.file('model/model.atlas')!.async('string')).toBe(ATLAS)
  })

  it('matches atlas and page paths case-insensitively', async () => {
    const source = await makeZip({
      'Model/Model.Atlas': ATLAS,
      'Model/Body.PNG': new Uint8Array([1]),
      'Model/face.png': new Uint8Array([2]),
    })

    const output = await exportSpineZip({
      source,
      atlasPath: 'model/model.atlas',
      mutations: [{ path: 'model/BODY.png', data: toBase64([7]) }],
    })
    const zip = await readZip(output)

    expect(await readBytes(zip, 'Model/Body.PNG')).toEqual([7])
    expect(await zip.file('Model/Model.Atlas')!.async('string')).toBe(ATLAS)
  })

  it('creates a missing page entry from the mutation path', async () => {
    const source = await makeZip({
      'model/model.atlas': ATLAS,
      'model/model.json': SKELETON,
      'model/face.png': new Uint8Array([2]),
    })

    const output = await exportSpineZip({
      source,
      atlasPath: 'model/model.atlas',
      mutations: [{ path: 'model/body.png', data: toBase64([6]) }],
    })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'model/body.png')).toEqual([6])
  })

  it('fails clearly when the atlas is missing', async () => {
    const source = await makeZip({ 'model/model.json': SKELETON })
    await expect(exportSpineZip({
      source,
      atlasPath: 'model/model.atlas',
      mutations: [],
    })).rejects.toThrow('Spine atlas not found')
  })
})
