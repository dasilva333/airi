import { describe, expect, it } from 'vitest'

import { createSpeechAudioCacheKey, SpeechAudioCache } from './audio-cache'

describe('createSpeechAudioCacheKey', () => {
  it('creates deterministic keys based on audio parameters', () => {
    const key1 = createSpeechAudioCacheKey({
      providerId: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      text: 'Hello world!',
      pitch: 0,
      speed: 1,
    })

    const key2 = createSpeechAudioCacheKey({
      providerId: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      text: 'Hello world!',
      pitch: 0,
      speed: 1,
    })

    expect(key1).toBe(key2)
  })

  it('generates different keys for different text or voices', () => {
    const key1 = createSpeechAudioCacheKey({
      providerId: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: 'voice_a',
      text: 'Hello',
    })

    const key2 = createSpeechAudioCacheKey({
      providerId: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: 'voice_b',
      text: 'Hello',
    })

    const key3 = createSpeechAudioCacheKey({
      providerId: 'elevenlabs',
      model: 'eleven_multilingual_v2',
      voiceId: 'voice_a',
      text: 'Goodbye',
    })

    expect(key1).not.toBe(key2)
    expect(key1).not.toBe(key3)
  })
})

describe('speechAudioCache', () => {
  function createBuffer(size: number): ArrayBuffer {
    return new ArrayBuffer(size)
  }

  it('stores and retrieves cached audio buffers', () => {
    const cache = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, enableBroadcast: false })
    const buf = createBuffer(100)

    cache.set('key1', buf)
    expect(cache.has('key1')).toBe(true)
    expect(cache.size).toBe(1)
    expect(cache.totalBytes).toBe(100)
    expect(cache.get('key1')).toBe(buf)
  })

  it('evicts oldest entries when entry limit is exceeded', () => {
    const cache = new SpeechAudioCache({ maxEntries: 3, maxBytes: 1000, enableBroadcast: false })
    cache.set('k1', createBuffer(10))
    cache.set('k2', createBuffer(10))
    cache.set('k3', createBuffer(10))

    expect(cache.size).toBe(3)

    // Adding 4th should evict k1
    cache.set('k4', createBuffer(10))
    expect(cache.size).toBe(3)
    expect(cache.has('k1')).toBe(false)
    expect(cache.has('k2')).toBe(true)
    expect(cache.has('k3')).toBe(true)
    expect(cache.has('k4')).toBe(true)
  })

  it('refreshes LRU order on get', () => {
    const cache = new SpeechAudioCache({ maxEntries: 3, maxBytes: 1000, enableBroadcast: false })
    cache.set('k1', createBuffer(10))
    cache.set('k2', createBuffer(10))
    cache.set('k3', createBuffer(10))

    // Access k1, making k2 the oldest
    cache.get('k1')

    // Adding k4 should now evict k2, NOT k1
    cache.set('k4', createBuffer(10))
    expect(cache.has('k1')).toBe(true)
    expect(cache.has('k2')).toBe(false)
    expect(cache.has('k3')).toBe(true)
    expect(cache.has('k4')).toBe(true)
  })

  it('evicts oldest entries when byte budget is exceeded', () => {
    const cache = new SpeechAudioCache({ maxEntries: 10, maxBytes: 150, enableBroadcast: false })
    cache.set('k1', createBuffer(50))
    cache.set('k2', createBuffer(50))
    cache.set('k3', createBuffer(50))
    expect(cache.totalBytes).toBe(150)

    // Adding 50 bytes should evict k1
    cache.set('k4', createBuffer(50))
    expect(cache.has('k1')).toBe(false)
    expect(cache.has('k4')).toBe(true)
    expect(cache.totalBytes).toBe(150)
  })

  it('rejects items that alone exceed maxBytes', () => {
    const cache = new SpeechAudioCache({ maxEntries: 10, maxBytes: 100, enableBroadcast: false })
    cache.set('big', createBuffer(150))
    expect(cache.size).toBe(0)
    expect(cache.has('big')).toBe(false)
  })

  it('tracks message associations and isMessageCached', () => {
    const cache = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, enableBroadcast: false })
    cache.set('seg1', createBuffer(10), 'msg-1')
    cache.set('seg2', createBuffer(10), 'msg-1')

    expect(cache.isMessageCached('msg-1')).toBe(true)
    expect(cache.isMessageCached('msg-2')).toBe(false)

    // If one segment is evicted, isMessageCached becomes false
    const smallCache = new SpeechAudioCache({ maxEntries: 2, maxBytes: 1000, enableBroadcast: false })
    smallCache.set('s1', createBuffer(10), 'msg-a')
    smallCache.set('s2', createBuffer(10), 'msg-a')
    expect(smallCache.isMessageCached('msg-a')).toBe(true)

    // Evicts s1
    smallCache.set('s3', createBuffer(10), 'msg-b')
    expect(smallCache.isMessageCached('msg-a')).toBe(false)
    expect(smallCache.isMessageCached('msg-b')).toBe(true)
  })

  it('clears all entries and associations', () => {
    const cache = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, enableBroadcast: false })
    cache.set('k1', createBuffer(50), 'msg-1')
    expect(cache.size).toBe(1)
    expect(cache.isMessageCached('msg-1')).toBe(true)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.totalBytes).toBe(0)
    expect(cache.isMessageCached('msg-1')).toBe(false)
  })

  it('synchronizes cache additions and associations across instances via BroadcastChannel', async () => {
    if (typeof BroadcastChannel === 'undefined')
      return

    const channelName = `test:speech-cache-${Math.random().toString(36).slice(2)}`
    const leader = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, channelName })
    const follower = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, channelName })

    try {
      leader.set('sync-key-1', createBuffer(100), 'msg-sync-1')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(follower.has('sync-key-1')).toBe(true)
      expect(follower.isMessageCached('msg-sync-1')).toBe(true)
      // Follower mirrors presence without storing heavy audio byte buffer
      expect(follower.get('sync-key-1')).toBeUndefined()
    }
    finally {
      leader.dispose()
      follower.dispose()
    }
  })

  it('synchronizes evictions and clear across instances via BroadcastChannel', async () => {
    if (typeof BroadcastChannel === 'undefined')
      return

    const channelName = `test:speech-cache-${Math.random().toString(36).slice(2)}`
    const leader = new SpeechAudioCache({ maxEntries: 2, maxBytes: 1000, channelName })
    const follower = new SpeechAudioCache({ maxEntries: 10, maxBytes: 1000, channelName })

    try {
      leader.set('k1', createBuffer(50), 'msg-1')
      leader.set('k2', createBuffer(50), 'msg-2')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(follower.isMessageCached('msg-1')).toBe(true)
      expect(follower.isMessageCached('msg-2')).toBe(true)

      // Evict k1 by setting k3 in leader
      leader.set('k3', createBuffer(50), 'msg-3')
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(follower.isMessageCached('msg-1')).toBe(false)
      expect(follower.has('k1')).toBe(false)
      expect(follower.isMessageCached('msg-3')).toBe(true)

      // Clear leader
      leader.clear()
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(follower.has('k2')).toBe(false)
      expect(follower.has('k3')).toBe(false)
      expect(follower.isMessageCached('msg-2')).toBe(false)
      expect(follower.isMessageCached('msg-3')).toBe(false)
    }
    finally {
      leader.dispose()
      follower.dispose()
    }
  })
})
