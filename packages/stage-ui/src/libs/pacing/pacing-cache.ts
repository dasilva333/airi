import localforage from 'localforage'

export interface ThinkingAudioFingerprintParams {
  provider: string
  model: string
  voiceId: string
  pitch?: number
  rate?: number
  language?: string
  text: string
  format?: string
}

export interface ThinkingAudioEntry {
  key: string
  fingerprint: string
  text: string
  format: string
  durationMs: number
  byteLength: number
  createdAt: number
  lastUsedAt: number
}

export interface ThinkingAudioStorage {
  getItem: <T>(key: string) => Promise<T | null>
  setItem: <T>(key: string, value: T) => Promise<T>
  removeItem: (key: string) => Promise<void>
  clear: () => Promise<void>
  iterate: <T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U) => Promise<U | void>
}

let storageOverride: ThinkingAudioStorage | null = null

function createDefaultStorage(): ThinkingAudioStorage {
  // In browser or Electron renderer where indexedDB is supported
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    return localforage.createInstance({
      name: 'airi',
      storeName: 'thinking-audio-cache',
    })
  }

  // Resilient in-memory storage for headless tests, Node, and SSR
  const memory = new Map<string, any>()
  return {
    getItem: async <T>(key: string) => (memory.has(key) ? (memory.get(key) as T) : null),
    setItem: async <T>(key: string, value: T) => {
      memory.set(key, value)
      return value
    },
    removeItem: async (key: string) => {
      memory.delete(key)
    },
    clear: async () => {
      memory.clear()
    },
    iterate: async <T, U>(iteratee: (value: T, key: string, iterationNumber: number) => U) => {
      let i = 1
      for (const [k, v] of memory.entries()) {
        iteratee(v as T, k, i++)
      }
    },
  }
}

export function getThinkingAudioStorage(): ThinkingAudioStorage {
  if (!storageOverride) {
    storageOverride = createDefaultStorage()
  }
  return storageOverride
}

export function setThinkingAudioStorage(storage: ThinkingAudioStorage | null): void {
  storageOverride = storage
}

/**
 * Computes deterministic SHA-256 fingerprint for a voice+text payload.
 * Any change to voice parameters, model, or text produces an entirely distinct fingerprint.
 */
export async function computeThinkingAudioFingerprint(params: ThinkingAudioFingerprintParams): Promise<string> {
  const payload = [
    params.provider.trim(),
    params.model.trim(),
    params.voiceId.trim(),
    params.pitch ?? 1,
    params.rate ?? 1,
    (params.language ?? '').trim(),
    params.text.trim(),
    (params.format ?? 'audio/mp3').trim(),
  ].join('|')

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(payload)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  let hash = 5381
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) + payload.charCodeAt(i)
  }
  return `hash-${(hash >>> 0).toString(16)}`
}

/**
 * Persists pre-rendered thinking audio bytes and metadata.
 */
export async function saveThinkingAudio(
  params: ThinkingAudioFingerprintParams,
  buffer: ArrayBuffer,
  durationMs: number,
): Promise<string> {
  const storage = getThinkingAudioStorage()
  const fingerprint = await computeThinkingAudioFingerprint(params)
  const audioKey = `thinking-audio-${fingerprint}`
  const manifestKey = `thinking-manifest-${fingerprint}`

  const entry: ThinkingAudioEntry = {
    key: audioKey,
    fingerprint,
    text: params.text.trim(),
    format: params.format ?? 'audio/mp3',
    durationMs,
    byteLength: buffer.byteLength,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  }

  await Promise.all([
    storage.setItem(audioKey, buffer),
    storage.setItem(manifestKey, entry),
  ])

  return fingerprint
}

/**
 * Fast cache retrieval: returns raw ArrayBuffer and duration or null on cache miss.
 * Must execute in < 5ms without network calls.
 */
export async function getThinkingAudio(
  params: ThinkingAudioFingerprintParams,
): Promise<{ audio: ArrayBuffer, durationMs: number } | null> {
  const storage = getThinkingAudioStorage()
  const fingerprint = await computeThinkingAudioFingerprint(params)
  const audioKey = `thinking-audio-${fingerprint}`
  const manifestKey = `thinking-manifest-${fingerprint}`

  const [buffer, manifest] = await Promise.all([
    storage.getItem<ArrayBuffer>(audioKey),
    storage.getItem<ThinkingAudioEntry>(manifestKey),
  ])

  if (!buffer) {
    return null
  }

  if (manifest) {
    manifest.lastUsedAt = Date.now()
    void storage.setItem(manifestKey, manifest)
  }

  return {
    audio: buffer,
    durationMs: manifest?.durationMs ?? 1500,
  }
}

/**
 * Deletes a single thinking audio item and its manifest by fingerprint.
 */
export async function deleteThinkingAudio(fingerprint: string): Promise<void> {
  const storage = getThinkingAudioStorage()
  await Promise.all([
    storage.removeItem(`thinking-audio-${fingerprint}`),
    storage.removeItem(`thinking-manifest-${fingerprint}`),
  ])
}

/**
 * Wipes all cached thinking audio items from local storage.
 */
export async function clearThinkingAudioCache(): Promise<void> {
  const storage = getThinkingAudioStorage()
  await storage.clear()
}

/**
 * Lists all active thinking audio manifests in cache.
 */
export async function listThinkingAudioManifests(): Promise<ThinkingAudioEntry[]> {
  const storage = getThinkingAudioStorage()
  const manifests: ThinkingAudioEntry[] = []
  await storage.iterate<unknown, void>((val, key) => {
    if (key.startsWith('thinking-manifest-') && val) {
      manifests.push(val as ThinkingAudioEntry)
    }
  })
  return manifests
}
