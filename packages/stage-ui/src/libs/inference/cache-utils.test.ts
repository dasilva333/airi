import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearSingleModelCache, evictOtherPocketModels, getDetailedModelCacheMap, isModelCached } from './cache-utils'

describe('isModelCached - moondream2', () => {
  const originalCaches = globalThis.caches

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    if (originalCaches !== undefined) {
      globalThis.caches = originalCaches
    }
    else {
      delete (globalThis as any).caches
    }
  })

  it('should return false if moondream2 is not in cache', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([]),
    }
    globalThis.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
    } as any

    const cached = await isModelCached('Xenova/moondream2')
    expect(cached).toBe(false)
  })

  it('should return false if only partial shards or config files are cached', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/config.json' },
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/onnx/decoder_model_merged_q4.onnx' },
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/onnx/embed_tokens.onnx' },
        // missing vision_encoder
      ]),
    }
    globalThis.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
    } as any

    const cached = await isModelCached('Xenova/moondream2')
    expect(cached).toBe(false)
  })

  it('should return true when all 3 required shards (decoder, vision, embed) are cached', async () => {
    const mockCache = {
      keys: vi.fn().mockResolvedValue([
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/config.json' },
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/onnx/decoder_model_merged_q4.onnx' },
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/onnx/embed_tokens.onnx' },
        { url: 'https://huggingface.co/Xenova/moondream2/resolve/main/onnx/vision_encoder_quantized.onnx' },
      ]),
    }
    globalThis.caches = {
      open: vi.fn().mockResolvedValue(mockCache),
    } as any

    const cached = await isModelCached('Xenova/moondream2')
    expect(cached).toBe(true)
  })
})

interface FakeFsNode {
  kind: 'file' | 'directory'
  size?: number
  children?: Map<string, FakeFsNode>
}

// Minimal OPFS FileSystemDirectoryHandle stand-in: values(), getDirectoryHandle(),
// getFileHandle(), removeEntry() over an in-memory node tree.
function createFakeDirHandle(children: Map<string, FakeFsNode>) {
  return {
    async* values() {
      for (const [name, node] of children) {
        if (node.kind === 'file') {
          yield { kind: 'file', name, async getFile() { return { size: node.size ?? 0 } } }
        }
        else {
          // Real directory entries are handles: the recursive sizer calls
          // values() on them, so delegate to a child handle.
          const childHandle = createFakeDirHandle(node.children!)
          yield { kind: 'directory', name, values: childHandle.values.bind(childHandle) }
        }
      }
    },
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      const node = children.get(name)
      if (node?.kind === 'directory')
        return createFakeDirHandle(node.children!)
      if (opts?.create) {
        const fresh: FakeFsNode = { kind: 'directory', children: new Map() }
        children.set(name, fresh)
        return createFakeDirHandle(fresh.children!)
      }
      throw new Error('NotFoundError')
    },
    async getFileHandle(name: string) {
      const node = children.get(name)
      if (node?.kind === 'file')
        return { async getFile() { return { size: node.size ?? 0 } } }
      throw new Error('NotFoundError')
    },
    async removeEntry(name: string) {
      if (!children.has(name))
        throw new Error('NotFoundError')
      children.delete(name)
    },
  }
}

// Builds `pocket-tts-browser-model-store` with a shared root file plus one
// 8-file bundle dir (+ 1 voice embedding) per language. ~166MB per language.
function mockPocketStore(langs: string[]) {
  const pocketChildren = new Map<string, FakeFsNode>()
  pocketChildren.set('sentencepiece.js', { kind: 'file', size: 5000 })
  for (const lang of langs) {
    const langChildren = new Map<string, FakeFsNode>()
    for (let i = 0; i < 8; i++)
      langChildren.set(`part${i}.onnx`, { kind: 'file', size: 20_000_000 })
    langChildren.set('voices', {
      kind: 'directory',
      children: new Map([['anna.safetensors', { kind: 'file', size: 6_000_000 }]]),
    })
    pocketChildren.set(lang, { kind: 'directory', children: langChildren })
  }
  const rootChildren = new Map<string, FakeFsNode>([
    ['pocket-tts-browser-model-store', { kind: 'directory', children: pocketChildren }],
  ])
  const rootHandle = createFakeDirHandle(rootChildren)
  vi.stubGlobal('navigator', {
    storage: { async getDirectory() { return rootHandle } },
  })
  return { rootChildren, pocketChildren }
}

describe('pocket TTS OPFS registry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports not cached when OPFS is unavailable', async () => {
    expect(await isModelCached('pocket-tts-local')).toBe(false)
    const map = await getDetailedModelCacheMap()
    expect(map['pocket-tts-local']).toEqual({ cached: false, sizeBytes: 0 })
  })

  it('reports cached with recursive size across bundles, voices, and shared files', async () => {
    mockPocketStore(['english_2026-04'])

    expect(await isModelCached('pocket-tts-local')).toBe(true)

    const map = await getDetailedModelCacheMap()
    // 8 × 20MB parts + 6MB voice + 5KB shared sentencepiece.js
    expect(map['pocket-tts-local']).toEqual({ cached: true, sizeBytes: 8 * 20_000_000 + 6_000_000 + 5000 })
  })

  it('evicts other language dirs but keeps the active bundle and shared root files', async () => {
    const { pocketChildren } = mockPocketStore(['english_2026-04', 'french_24l'])

    // Bare language code normalizes to the bundle folder (mirrors the worker).
    await evictOtherPocketModels('french')

    expect(pocketChildren.has('english_2026-04')).toBe(false)
    expect(pocketChildren.has('french_24l')).toBe(true)
    expect(pocketChildren.has('sentencepiece.js')).toBe(true)
    // Full-dir evict: the kept bundle retains its voices.
    expect(pocketChildren.get('french_24l')!.children!.has('voices')).toBe(true)
  })

  it('treats canonical folder ids as keep targets', async () => {
    const { pocketChildren } = mockPocketStore(['english_2026-04', 'german_24l'])

    await evictOtherPocketModels('english_2026-04')

    expect(pocketChildren.has('english_2026-04')).toBe(true)
    expect(pocketChildren.has('german_24l')).toBe(false)
  })

  it('clearSingleModelCache removes the whole Pocket store', async () => {
    mockPocketStore(['english_2026-04'])

    await clearSingleModelCache('pocket-tts-local')

    expect(await isModelCached('pocket-tts-local')).toBe(false)
  })
})
