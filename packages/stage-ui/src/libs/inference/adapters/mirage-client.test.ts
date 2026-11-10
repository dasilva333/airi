import { describe, expect, it, vi } from 'vitest'

import { createMirageClient, getMirageClient } from './mirage-client'

describe('mirageClient (Cactus Mirage Local Vision Coprocessor)', () => {
  it('instantiates and provides expected interface', () => {
    const client = createMirageClient()
    expect(typeof client.isReady).toBe('function')
    expect(typeof client.isPreparing).toBe('function')
    expect(typeof client.isCached).toBe('function')
    expect(typeof client.prepare).toBe('function')
    expect(typeof client.analyzeFrame).toBe('function')
    expect(typeof client.detectTarget).toBe('function')
    expect(typeof client.terminate).toBe('function')
  })

  it('provides singleton instance via getMirageClient', () => {
    const client1 = getMirageClient()
    const client2 = getMirageClient()
    expect(client1).toBe(client2)
  })

  it('prepares and reports progress in non-worker environments', async () => {
    const client = createMirageClient()
    const progressSpy = vi.fn()

    const ready = await client.prepare(progressSpy)
    expect(ready).toBe(true)
    expect(client.isReady()).toBe(true)
    expect(progressSpy).toHaveBeenCalledWith(1.0, expect.any(String))
  })

  it('analyzes frame in test environment', async () => {
    const client = createMirageClient()
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const res = await client.analyzeFrame(dummyImage, { detectErrors: true, locateFocalArea: true })
    expect(res).toBeDefined()
    expect(typeof res.confidence).toBe('number')
    expect(res.confidence).toBeGreaterThan(0.5)
    expect(res.boundingBox).toBeDefined()
    expect(Array.isArray(res.boxes)).toBe(true)
    expect(typeof res.latencyMs).toBe('number')
  })

  it('detects target (face_and_bust / error_modal)', async () => {
    const client = createMirageClient()
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const box = await client.detectTarget(dummyImage, 'face_and_bust')
    expect(box).toBeDefined()
    if (box) {
      expect(box.top).toBeDefined()
      expect(box.left).toBeDefined()
      expect(box.label).toBe('face_and_bust')
    }
  })

  it('handles abort signal cleanly', async () => {
    const client = createMirageClient()
    const dummyImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const controller = new AbortController()
    controller.abort()

    await expect(client.analyzeFrame(dummyImage, { signal: controller.signal })).rejects.toThrow('Aborted')
  })

  it('handles terminate cleanly without error', () => {
    const client = createMirageClient()
    expect(() => client.terminate()).not.toThrow()
  })
})
