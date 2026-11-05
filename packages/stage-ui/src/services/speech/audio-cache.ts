import { ref } from 'vue'

/**
 * Options for configuring in-memory speech audio cache.
 */
export interface SpeechAudioCacheOptions {
  /**
   * Maximum number of synthesized audio items to retain in memory.
   * Defaults to 200 items.
   */
  maxEntries?: number
  /**
   * Maximum cumulative size in bytes across cached audio items.
   * Defaults to 50 MB (52,428,800 bytes).
   */
  maxBytes?: number
  /**
   * Name of the BroadcastChannel used to synchronize cache presence across windows.
   * Defaults to 'airi:speech-cache-sync'.
   */
  channelName?: string
  /**
   * Whether to enable cross-window broadcast synchronization.
   * Defaults to true.
   */
  enableBroadcast?: boolean
}

/**
 * Payload formats for cross-window speech cache presence sync.
 */
export type SpeechCacheSyncPayload
  = | { type: 'set', originId: string, key: string, messageId?: string, byteLength: number }
    | { type: 'associate', originId: string, key: string, messageId: string }
    | { type: 'evict', originId: string, key: string }
    | { type: 'clear', originId: string }
    | { type: 'sync-request', originId: string }
    | { type: 'sync-snapshot', originId: string, keys: string[], associations: Array<[string, string[]]> }

/**
 * Creates a deterministic cache key for a speech synthesis request.
 * The key reflects all parameters that alter output audio.
 */
export function createSpeechAudioCacheKey(options: {
  providerId: string
  model: string
  voiceId: string
  text: string
  pitch?: number
  speed?: number
  ssml?: boolean
  language?: string
  extra?: Record<string, unknown>
}): string {
  return JSON.stringify([
    options.providerId,
    options.model,
    options.voiceId,
    options.pitch ?? 0,
    options.speed ?? 1,
    options.ssml ?? false,
    options.language ?? '',
    options.extra ?? null,
    options.text.trim(),
  ])
}

/**
 * In-memory Least-Recently-Used (LRU) audio cache for synthesized speech.
 * Bounded by entry count (default 200) and byte budget (default 50 MB).
 * Tracks message associations, synchronizes presence across multi-window renderers
 * (Electron Chatbox & Stage), and exposes Vue reactivity for UI cache indicators.
 */
export class SpeechAudioCache {
  private readonly entries = new Map<string, ArrayBuffer>()
  private readonly messageToKeys = new Map<string, Set<string>>()
  private readonly keyToMessages = new Map<string, Set<string>>()
  private readonly maxEntries: number
  private readonly maxBytes: number
  private currentBytes = 0

  private readonly originId = Math.random().toString(36).slice(2)
  private channel: BroadcastChannel | null = null

  /**
   * Reactive tick triggering computed properties in Vue components
   * when cache entries are added, evicted, or associated.
   */
  readonly version = ref(0)

  constructor(options: SpeechAudioCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 200
    this.maxBytes = options.maxBytes ?? 50 * 1024 * 1024

    if (options.enableBroadcast !== false && typeof BroadcastChannel !== 'undefined') {
      try {
        const channelName = options.channelName ?? 'airi:speech-cache-sync'
        this.channel = new BroadcastChannel(channelName)
        this.channel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data)
        }
        // Request initial snapshot from any active leader window (e.g. Stage)
        this.channel.postMessage({
          type: 'sync-request',
          originId: this.originId,
        })
      }
      catch {
        // Fallback for constrained or mocked environments
      }
    }
  }

  get size(): number {
    void this.version.value
    return this.entries.size
  }

  get totalBytes(): number {
    void this.version.value
    return this.currentBytes
  }

  /**
   * Retrieves a cached audio buffer, updating its LRU position.
   * Note: In secondary windows (mirrors), returns undefined if the entry
   * is a 0-byte presence placeholder.
   */
  get(key: string): ArrayBuffer | undefined {
    const buffer = this.entries.get(key)
    if (!buffer || buffer.byteLength === 0)
      return undefined

    // Refresh LRU order by deleting and re-inserting
    this.entries.delete(key)
    this.entries.set(key, buffer)
    return buffer
  }

  /**
   * Checks whether a specific cache key exists without updating LRU order.
   */
  has(key: string): boolean {
    void this.version.value
    return this.entries.has(key)
  }

  /**
   * Stores an audio buffer in the cache under the given key,
   * evicting oldest entries if limits are exceeded.
   */
  set(key: string, buffer: ArrayBuffer, messageId?: string, broadcast = true): void {
    if (buffer.byteLength > this.maxBytes)
      return

    if (this.entries.has(key)) {
      const existing = this.entries.get(key)!
      this.currentBytes -= existing.byteLength
      this.entries.delete(key)
    }

    // Evict oldest entries until within entry limit and byte budget
    while (
      this.entries.size >= this.maxEntries
      || (this.currentBytes + buffer.byteLength > this.maxBytes && this.entries.size > 0)
    ) {
      const oldestKey = this.entries.keys().next().value
      if (!oldestKey)
        break
      this.evict(oldestKey, broadcast)
    }

    this.entries.set(key, buffer)
    this.currentBytes += buffer.byteLength

    if (messageId) {
      this.associateInternal(key, messageId)
    }

    this.version.value++

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'set',
        originId: this.originId,
        key,
        messageId,
        byteLength: buffer.byteLength,
      })
    }
  }

  /**
   * Associates an audio cache key with a specific chat message ID.
   */
  associate(key: string, messageId: string, broadcast = true): void {
    if (!messageId)
      return

    this.associateInternal(key, messageId)
    this.version.value++

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'associate',
        originId: this.originId,
        key,
        messageId,
      })
    }
  }

  private associateInternal(key: string, messageId: string): void {
    let keySet = this.messageToKeys.get(messageId)
    if (!keySet) {
      keySet = new Set<string>()
      this.messageToKeys.set(messageId, keySet)
    }
    keySet.add(key)

    let msgSet = this.keyToMessages.get(key)
    if (!msgSet) {
      msgSet = new Set<string>()
      this.keyToMessages.set(key, msgSet)
    }
    msgSet.add(messageId)
  }

  /**
   * Reactively checks if a message's audio is fully cached in memory.
   * If messageId is known, all of its segments must still be in RAM.
   * Falls back to checking text containment.
   */
  isMessageCached(messageId?: string, textFallback?: string): boolean {
    void this.version.value

    if (messageId && this.messageToKeys.has(messageId)) {
      const keys = this.messageToKeys.get(messageId)!
      if (keys.size === 0)
        return false
      for (const k of keys) {
        if (!this.entries.has(k))
          return false
      }
      return true
    }

    if (textFallback && textFallback.trim().length > 0) {
      const trimmed = textFallback.trim()
      for (const [key] of this.entries) {
        if (key.includes(JSON.stringify(trimmed)))
          return true
      }
    }

    return false
  }

  private evict(key: string, broadcast = true): void {
    const buffer = this.entries.get(key)
    if (buffer) {
      this.currentBytes -= buffer.byteLength
      this.entries.delete(key)
    }

    // Notice: we do NOT remove `key` from `messageToKeys` here.
    // Keeping `key` in `messageToKeys[messageId]` allows `isMessageCached(messageId)`
    // to detect that a previously registered segment has been evicted:
    // `!this.entries.has(k)` will accurately report false.

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'evict',
        originId: this.originId,
        key,
      })
    }
  }

  /**
   * Clears all cached audio and associations.
   */
  clear(broadcast = true): void {
    this.entries.clear()
    this.messageToKeys.clear()
    this.keyToMessages.clear()
    this.currentBytes = 0
    this.version.value++

    if (broadcast && this.channel) {
      this.channel.postMessage({
        type: 'clear',
        originId: this.originId,
      })
    }
  }

  /**
   * Handles incoming broadcast messages from peer windows.
   */
  private handleBroadcastMessage(payload: SpeechCacheSyncPayload): void {
    if (!payload || payload.originId === this.originId)
      return

    switch (payload.type) {
      case 'set':
        if (payload.key) {
          if (!this.entries.has(payload.key)) {
            // Secondary window presence indicator (0-byte placeholder)
            this.entries.set(payload.key, new ArrayBuffer(0))
          }
          if (payload.messageId) {
            this.associateInternal(payload.key, payload.messageId)
          }
          this.version.value++
        }
        break

      case 'associate':
        if (payload.key && payload.messageId) {
          this.associateInternal(payload.key, payload.messageId)
          this.version.value++
        }
        break

      case 'evict':
        if (payload.key) {
          this.entries.delete(payload.key)
          this.version.value++
        }
        break

      case 'clear':
        this.entries.clear()
        this.messageToKeys.clear()
        this.keyToMessages.clear()
        this.currentBytes = 0
        this.version.value++
        break

      case 'sync-request':
        // Only windows with actual audio bytes respond to sync requests
        if (this.currentBytes > 0 && this.channel) {
          const snapshotAssociations: Array<[string, string[]]> = []
          for (const [mId, keySet] of this.messageToKeys) {
            snapshotAssociations.push([mId, Array.from(keySet)])
          }
          this.channel.postMessage({
            type: 'sync-snapshot',
            originId: this.originId,
            keys: Array.from(this.entries.keys()),
            associations: snapshotAssociations,
          })
        }
        break

      case 'sync-snapshot':
        if (payload.keys) {
          for (const k of payload.keys) {
            if (!this.entries.has(k)) {
              this.entries.set(k, new ArrayBuffer(0))
            }
          }
        }
        if (payload.associations) {
          for (const [mId, keys] of payload.associations) {
            for (const k of keys) {
              this.associateInternal(k, mId)
            }
          }
        }
        this.version.value++
        break
    }
  }

  /**
   * Closes the BroadcastChannel and disposes of resources.
   */
  dispose(): void {
    this.channel?.close()
    this.channel = null
  }
}

/**
 * Global speech audio cache singleton (200 entries, 50 MB budget).
 */
export const speechAudioCache = new SpeechAudioCache()
