import { beforeEach, describe, expect, it } from 'vitest'

import { clearThinkingAudioCache } from './pacing-cache'
import { isThinkingAudioCached, prewarmThinkingFillers } from './pacing-prewarm'

describe('pacing-prewarm', () => {
  beforeEach(async () => {
    await clearThinkingAudioCache()
  })

  const testVoice = {
    provider: 'test-tts',
    model: 'v1',
    voiceId: 'voice-alice',
    pitch: 0,
    rate: 1,
    language: 'en-US',
  }

  it('correctly reports uncached and cached phrases', async () => {
    const isCachedBefore = await isThinkingAudioCached(testVoice, 'Hello world')
    expect(isCachedBefore).toBe(false)

    // Prewarm
    const result = await prewarmThinkingFillers({
      phrases: [{ text: 'Hello world', category: 'generic', enabled: true }],
      voice: testVoice,
      synthesize: async () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer,
    })

    expect(result.succeeded).toBe(1)
    expect(result.cached).toBe(0)
    expect(result.failed).toBe(0)

    const isCachedAfter = await isThinkingAudioCached(testVoice, 'Hello world')
    expect(isCachedAfter).toBe(true)

    // Running again recognizes it as cached
    const result2 = await prewarmThinkingFillers({
      phrases: [{ text: 'Hello world', category: 'generic', enabled: true }],
      voice: testVoice,
      synthesize: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })

    expect(result2.cached).toBe(1)
    expect(result2.succeeded).toBe(0)
  })

  it('skips disabled phrases', async () => {
    const result = await prewarmThinkingFillers({
      phrases: [
        { text: 'Disabled phrase', category: 'generic', enabled: false },
        { text: 'Enabled phrase', category: 'analytical', enabled: true },
      ],
      voice: testVoice,
      synthesize: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    })

    expect(result.succeeded).toBe(1)
    expect(await isThinkingAudioCached(testVoice, 'Disabled phrase')).toBe(false)
    expect(await isThinkingAudioCached(testVoice, 'Enabled phrase')).toBe(true)
  })

  it('handles synthesis errors gracefully and continues to next phrase', async () => {
    let callCount = 0
    const result = await prewarmThinkingFillers({
      phrases: [
        { text: 'Failing phrase', category: 'generic', enabled: true },
        { text: 'Working phrase', category: 'generic', enabled: true },
      ],
      voice: testVoice,
      synthesize: async (text) => {
        callCount++
        if (text === 'Failing phrase') {
          throw new Error('TTS Rate Limit')
        }
        return new Uint8Array([1, 2, 3, 4]).buffer
      },
    })

    expect(callCount).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toContain('TTS Rate Limit')
    expect(await isThinkingAudioCached(testVoice, 'Working phrase')).toBe(true)
  })
})
