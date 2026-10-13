import fs from 'node:fs'
import path from 'node:path'

import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// ROOT CAUSE: `patches/@huggingface__transformers.patch` patches `RawImage.fromBlob` (and canvas helpers)
// to prevent macOS WebGPU/WebWorker `OffscreenCanvas` and `ImageBitmap` memory leaks by calling `img.close()`
// and setting `canvas.width = 0; canvas.height = 0`. Per the W3C HTML spec and Chromium Blink (`ImageBitmap::close`),
// calling `img.close()` detaches the underlying graphics buffer and immediately mutates `img.width = 0` and
// `img.height = 0`. Previously, `fromBlob` called `img.close()` BEFORE `return new this(data, img.width, img.height, 4)`,
// producing a `RawImage` with `width = 0, height = 0`. When `SiglipImageProcessor` (Moondream) subsequently called
// `image.resize(378, 378)` -> `this.toCanvas()` -> `new ImageData(cloned.data, cloned.width, cloned.height)`,
// Chromium threw `IndexSizeError: Failed to construct 'ImageData': The source width is zero or not a number`.

const require = createRequire(import.meta.url)
const resolvedEntry = require.resolve('@huggingface/transformers')
const transformersRoot = path.resolve(path.dirname(resolvedEntry), '..')
const testDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testDir, '../../../../..')

interface MockBitmapRecord {
  width: number
  height: number
  closed: boolean
  closeCalls: number
  close: () => void
}

interface MockCanvasRecord {
  width: number
  height: number
  initialWidth: number
  initialHeight: number
  getContext: (type: string) => {
    drawImage: (...args: unknown[]) => void
    putImageData: (...args: unknown[]) => void
    getImageData: (_x: number, _y: number, w: number, h: number) => ImageData
  }
  convertToBlob: (options?: { type?: string, quality?: number }) => Promise<Blob>
}

class SpecFaithfulImageData {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
    const width = typeof dataOrWidth === 'number' ? dataOrWidth : widthOrHeight
    const height = typeof dataOrWidth === 'number' ? widthOrHeight : maybeHeight!

    if (!width || Number.isNaN(width)) {
      const err = new Error('Failed to construct \'ImageData\': The source width is zero or not a number.')
      err.name = 'IndexSizeError'
      throw err
    }
    if (!height || Number.isNaN(height)) {
      const err = new Error('Failed to construct \'ImageData\': The source height is zero or not a number.')
      err.name = 'IndexSizeError'
      throw err
    }

    this.width = width
    this.height = height
    this.data = typeof dataOrWidth === 'number'
      ? new Uint8ClampedArray(width * height * 4)
      : dataOrWidth
  }
}

describe('@huggingface/transformers RawImage memory-leak & dimension invariants', () => {
  const createdBitmaps: MockBitmapRecord[] = []
  const createdCanvases: MockCanvasRecord[] = []
  let RawImageClass: any

  beforeAll(async () => {
    // `@huggingface/transformers/src/env.js` evaluates `IS_BROWSER_ENV` at module load time.
    // Stub browser + worker globals BEFORE importing `src/utils/image.js` so `RawImage` binds
    // its browser/worker `OffscreenCanvas` + `createImageBitmap` + `ImageData` code path.
    vi.stubGlobal('window', { document: {} })
    vi.stubGlobal('self', globalThis)
    vi.stubGlobal('ImageData', SpecFaithfulImageData)

    vi.stubGlobal('createImageBitmap', vi.fn(async (_blob: Blob): Promise<MockBitmapRecord> => {
      const bitmap: MockBitmapRecord = {
        width: 640,
        height: 480,
        closed: false,
        closeCalls: 0,
        close() {
          this.closed = true
          this.closeCalls += 1
          // W3C HTML spec / Blink invariant: closing an ImageBitmap zeroes its dimensions in-place.
          this.width = 0
          this.height = 0
        },
      }
      createdBitmaps.push(bitmap)
      return bitmap
    }))

    class SpecFaithfulOffscreenCanvas implements MockCanvasRecord {
      width: number
      height: number
      readonly initialWidth: number
      readonly initialHeight: number

      constructor(width: number, height: number) {
        this.width = width
        this.height = height
        this.initialWidth = width
        this.initialHeight = height
        createdCanvases.push(this)
      }

      getContext(_type: string) {
        return {
          drawImage: (source: unknown) => {
            if (source && typeof source === 'object' && 'closed' in source && (source as MockBitmapRecord).closed) {
              const err = new Error('Failed to execute \'drawImage\' on \'OffscreenCanvasRenderingContext2D\': The image source is detached.')
              err.name = 'InvalidStateError'
              throw err
            }
          },
          putImageData: (..._args: unknown[]) => {},
          getImageData: (_x: number, _y: number, w: number, h: number) => {
            return new SpecFaithfulImageData(new Uint8ClampedArray(w * h * 4), w, h) as unknown as ImageData
          },
        }
      }

      async convertToBlob(options?: { type?: string, quality?: number }) {
        return new Blob(['encoded'], { type: options?.type ?? 'image/png' })
      }
    }

    vi.stubGlobal('OffscreenCanvas', SpecFaithfulOffscreenCanvas)

    const imageModuleUrl = pathToFileURL(path.join(transformersRoot, 'src/utils/image.js')).href
    const imageModule = await import(imageModuleUrl)
    RawImageClass = imageModule.RawImage
  })

  beforeEach(() => {
    createdBitmaps.length = 0
    createdCanvases.length = 0
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  describe('layer 1: Behavioral W3C-Spec Simulation', () => {
    it('preserves non-zero RawImage dimensions when ImageBitmap.close() zeroes img.width/height and releases scratch canvas', async () => {
      const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
      const rawImage = await RawImageClass.fromBlob(blob)

      // 1. ImageBitmap was created and explicitly closed to prevent GPU/RAM backing-store leaks
      expect(createdBitmaps).toHaveLength(1)
      expect(createdBitmaps[0]!.closed).toBe(true)
      expect(createdBitmaps[0]!.closeCalls).toBe(1)
      // Confirm our spec-faithful mock actually mutated bitmap dimensions to 0 upon close()
      expect(createdBitmaps[0]!.width).toBe(0)
      expect(createdBitmaps[0]!.height).toBe(0)

      // 2. RawImage captured the pre-close dimensions instead of reading post-close 0x0
      expect(rawImage.width).toBe(640)
      expect(rawImage.height).toBe(480)
      expect(rawImage.channels).toBe(4)
      expect(rawImage.data.length).toBe(640 * 480 * 4)

      // 3. Scratch OffscreenCanvas was zeroed out after pixel extraction
      expect(createdCanvases).toHaveLength(1)
      expect(createdCanvases[0]!.initialWidth).toBe(640)
      expect(createdCanvases[0]!.initialHeight).toBe(480)
      expect(createdCanvases[0]!.width).toBe(0)
      expect(createdCanvases[0]!.height).toBe(0)
    })

    it('completes Moondream SiglipImageProcessor resize(378, 378) -> toCanvas() without throwing IndexSizeError', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
      const rawImage = await RawImageClass.fromBlob(blob)
      createdCanvases.length = 0

      const resized = await rawImage.resize(378, 378)

      expect(resized.width).toBe(378)
      expect(resized.height).toBe(378)
      expect(resized.channels).toBe(4)

      // Both the `toCanvas()` source canvas and `resize()` targetCanvas must be zeroed after resize
      expect(createdCanvases).toHaveLength(2)
      for (const canvas of createdCanvases) {
        expect(canvas.width).toBe(0)
        expect(canvas.height).toBe(0)
      }
    })

    it('zeroes temporary OffscreenCanvas backing stores across pad, crop, center_crop, and toBlob', async () => {
      const rawImage = await RawImageClass.fromBlob(new Blob(['img'], { type: 'image/png' }))
      createdCanvases.length = 0

      const padded = await rawImage.pad([10, 10, 20, 20])
      expect(padded.width).toBe(660)
      expect(padded.height).toBe(520)

      const cropped = await padded.crop([0, 0, 399, 299])
      expect(cropped.width).toBe(400)
      expect(cropped.height).toBe(300)

      const centerCropped = await cropped.center_crop(200, 200)
      expect(centerCropped.width).toBe(200)
      expect(centerCropped.height).toBe(200)

      const outBlob = await centerCropped.toBlob('image/webp', 0.9)
      expect(outBlob.type).toBe('image/webp')

      // Every intermediate OffscreenCanvas created across pad (2), crop (2), center_crop (2), and toBlob (1)
      // must have its width and height reset to 0.
      expect(createdCanvases).toHaveLength(7)
      for (const canvas of createdCanvases) {
        expect(canvas.width).toBe(0)
        expect(canvas.height).toBe(0)
      }
    })
  })

  describe('layer 2: Multi-Bundle Patch Parity Guard', () => {
    const bundleTargets = [
      'src/utils/image.js',
      'dist/transformers.js',
      'dist/transformers.web.js',
    ]

    it.each(bundleTargets)('enforces pre-close dimension capture and canvas zeroing in %s', (relativeTarget) => {
      const targetPath = path.join(transformersRoot, relativeTarget)
      const source = fs.readFileSync(targetPath, 'utf8')

      const fromBlobMatch = source.match(/static async fromBlob\(blob\)\s*\{[\s\S]*?return new this\([^)]+\);\s*\}/)
      expect(fromBlobMatch, `Expected to find RawImage.fromBlob in ${relativeTarget}`).not.toBeNull()

      const fromBlobBody = fromBlobMatch![0]
      const widthCaptureIdx = fromBlobBody.indexOf('const width = img.width;')
      const heightCaptureIdx = fromBlobBody.indexOf('const height = img.height;')
      const closeIdx = fromBlobBody.indexOf('img.close()')
      const zeroWidthIdx = fromBlobBody.indexOf('canvas.width = 0;')
      const returnIdx = fromBlobBody.indexOf('return new this(data, width, height, 4);')

      expect(widthCaptureIdx).toBeGreaterThan(-1)
      expect(heightCaptureIdx).toBeGreaterThan(-1)
      expect(closeIdx).toBeGreaterThan(widthCaptureIdx)
      expect(closeIdx).toBeGreaterThan(heightCaptureIdx)
      expect(zeroWidthIdx).toBeGreaterThan(closeIdx)
      expect(returnIdx).toBeGreaterThan(closeIdx)

      // Invariant: `img.width` and `img.height` must NEVER be referenced after `img.close()`
      const afterClose = fromBlobBody.slice(closeIdx)
      expect(afterClose).not.toContain('img.width')
      expect(afterClose).not.toContain('img.height')
    })

    it('keeps patches/@huggingface__transformers.patch free of post-close img.width/height reads', () => {
      const patchPath = path.join(repoRoot, 'patches/@huggingface__transformers.patch')
      const patchContent = fs.readFileSync(patchPath, 'utf8')

      expect(patchContent).toContain('+            const width = img.width;')
      expect(patchContent).toContain('+            const height = img.height;')
      expect(patchContent).toContain('+            return new this(data, width, height, 4);')
      expect(patchContent).not.toContain('return new this(data, img.width, img.height, 4);')
    })
  })
})
