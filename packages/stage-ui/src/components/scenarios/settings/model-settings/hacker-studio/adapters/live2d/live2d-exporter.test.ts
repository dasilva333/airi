import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import { exportLive2dZip } from './live2d-exporter'

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

function manifest(textures: string[], extra: Record<string, any> = {}) {
  return JSON.stringify({
    Version: 3,
    FileReferences: { Textures: textures },
    ...extra,
  })
}

describe('hacker-studio: Live2D ZIP exporter', () => {
  it('replaces the target atlas page and preserves every other entry', async () => {
    const source = await makeZip({
      'model/avatar.model3.json': manifest(['textures/body.png', 'textures/face.png']),
      'model/textures/body.png': new Uint8Array([1, 2, 3]),
      'model/textures/face.png': new Uint8Array([4, 5, 6]),
      'model/extra.txt': 'untouched',
    })

    const output = await exportLive2dZip({
      source,
      mutations: [{ index: 0, data: toBase64([9, 8, 7, 6]), mimeType: 'image/png' }],
    })
    const zip = await readZip(output)

    expect(await readBytes(zip, 'model/textures/body.png')).toEqual([9, 8, 7, 6])
    expect(await readBytes(zip, 'model/textures/face.png')).toEqual([4, 5, 6])
    expect(await zip.file('model/extra.txt')!.async('string')).toBe('untouched')
    expect(JSON.parse(await zip.file('model/avatar.model3.json')!.async('string')).FileReferences.Textures).toEqual([
      'textures/body.png',
      'textures/face.png',
    ])
  })

  it('maps the filtered runtime index back across blank texture slots', async () => {
    const source = await makeZip({
      'model/avatar.model3.json': manifest(['', 'textures/a.png', 'textures/b.png']),
      'model/textures/a.png': new Uint8Array([1]),
      'model/textures/b.png': new Uint8Array([2]),
    })

    const output = await exportLive2dZip({
      source,
      mutations: [
        { index: 0, data: toBase64([10]) },
        { index: 1, data: toBase64([20]) },
      ],
    })
    const zip = await readZip(output)

    expect(await readBytes(zip, 'model/textures/a.png')).toEqual([10])
    expect(await readBytes(zip, 'model/textures/b.png')).toEqual([20])
  })

  it('matches texture paths case-insensitively', async () => {
    const source = await makeZip({
      'model/avatar.model3.json': manifest(['Textures/Body.PNG']),
      'model/Textures/Body.PNG': new Uint8Array([1, 1]),
    })

    const output = await exportLive2dZip({
      source,
      mutations: [{ index: 0, data: toBase64([7]) }],
    })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'model/Textures/Body.PNG')).toEqual([7])
  })

  it('creates the declared path when the ZIP entry is missing', async () => {
    const source = await makeZip({
      'avatar.model3.json': manifest(['textures/missing.png']),
      'avatar.moc3': new Uint8Array([1]),
    })

    const output = await exportLive2dZip({
      source,
      mutations: [{ index: 0, data: toBase64([5, 5]) }],
    })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'textures/missing.png')).toEqual([5, 5])
  })

  it('finds legacy model.json manifests', async () => {
    const source = await makeZip({
      'model/model.json': manifest(['textures/body.png']),
      'model/textures/body.png': new Uint8Array([1]),
    })

    const output = await exportLive2dZip({
      source,
      mutations: [{ index: 0, data: toBase64([4]) }],
    })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'model/textures/body.png')).toEqual([4])
  })

  it('selects the loaded manifest in a multi-model ZIP', async () => {
    const source = await makeZip({
      'collection/alpha.model3.json': manifest(['alpha/textures/alpha.png']),
      'collection/alpha/textures/alpha.png': new Uint8Array([1]),
      'collection/beta.model3.json': manifest(['beta/textures/beta.png']),
      'collection/beta/textures/beta.png': new Uint8Array([2]),
    })

    const output = await exportLive2dZip({
      source,
      model3Path: 'beta.model3.json',
      mutations: [{ index: 0, data: toBase64([22]) }],
    })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'collection/beta/textures/beta.png')).toEqual([22])
    expect(await readBytes(zip, 'collection/alpha/textures/alpha.png')).toEqual([1])
  })

  it('fails clearly when no manifest exists', async () => {
    const source = await makeZip({ 'model/readme.txt': 'no manifest' })
    await expect(exportLive2dZip({ source })).rejects.toThrow('model3.json not found')
  })

  it('returns the original bundle when there are no mutations', async () => {
    const source = await makeZip({
      'model/avatar.model3.json': manifest(['textures/body.png']),
      'model/textures/body.png': new Uint8Array([1, 2]),
    })

    const output = await exportLive2dZip({ source })
    const zip = await readZip(output)
    expect(await readBytes(zip, 'model/textures/body.png')).toEqual([1, 2])
  })
})
