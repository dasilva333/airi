import { describe, expect, it, vi } from 'vitest'

import { createWhistleClient, getWhistleClient } from './whistle-client'

describe('whistleClient (Cactus Whistle Speech-to-Text)', () => {
  it('instantiates and provides expected interface', () => {
    const client = createWhistleClient()
    expect(typeof client.isReady).toBe('function')
    expect(typeof client.isPreparing).toBe('function')
    expect(typeof client.isCached).toBe('function')
    expect(typeof client.prepare).toBe('function')
    expect(typeof client.transcribe).toBe('function')
    expect(typeof client.terminate).toBe('function')
  })

  it('provides singleton instance via getWhistleClient', () => {
    const client1 = getWhistleClient()
    const client2 = getWhistleClient()
    expect(client1).toBe(client2)
  })

  it('prepares and reports progress in non-worker environments', async () => {
    const client = createWhistleClient()
    const progressSpy = vi.fn()

    const ready = await client.prepare(progressSpy)
    expect(ready).toBe(true)
    expect(client.isReady()).toBe(true)
    expect(progressSpy).toHaveBeenCalledWith(1.0, expect.any(String))
  })

  it('handles empty / silence transcription in test environment', async () => {
    const client = createWhistleClient()
    const emptyPcm = new Float32Array(16000 * 0.1) // 100ms silence

    const res = await client.transcribe(emptyPcm, { language: 'en' })
    expect(res).toBeDefined()
    expect(typeof res.text).toBe('string')
    expect(Array.isArray(res.words)).toBe(true)
  })

  it('handles abort signal cleanly', async () => {
    const client = createWhistleClient()
    const pcm = new Float32Array(16000)
    const controller = new AbortController()
    controller.abort()

    await expect(client.transcribe(pcm, { signal: controller.signal })).rejects.toThrow('Aborted')
  })

  it('handles terminate cleanly without error', () => {
    const client = createWhistleClient()
    expect(() => client.terminate()).not.toThrow()
  })
})
