import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBackgroundStore } from './background'

const DB = new Map<string, unknown>()

vi.mock('localforage', () => ({
  default: {
    keys: vi.fn(async () => [...DB.keys()]),
    getItem: vi.fn(async (key: string) => DB.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      DB.set(key, value)
      return value
    }),
    removeItem: vi.fn(async (key: string) => {
      DB.delete(key)
    }),
    iterate: vi.fn(async () => {}),
  },
}))

// BackgroundStore reads activeCard/extensions only through these two stores;
// stub them so the seeding path works without a full app context.
vi.mock('./modules/airi-card', () => ({
  useAiriCardStore: () => ({
    activeCard: null,
    activeCardId: 'default',
  }),
}))

vi.mock('./chat/session-store', () => ({
  useChatSessionStore: () => ({
    activeSessionId: 's1',
    getCharacterIndex: () => ({ activeSessionId: 's1' }),
    getSessionMeta: () => ({ universeId: 'global' }),
  }),
}))

vi.mock('./event-log', () => ({
  useEventLogStore: () => ({
    log: vi.fn(),
  }),
}))

const BUILTIN_IDS = ['builtin:cozy-tea-corner', 'builtin:cute-streaming-room', 'builtin:summer-sky-meadow']

describe('useBackgroundStore builtin seeding', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const origFetch = globalThis.fetch
  const origCreateObjectURL = URL.createObjectURL
  const origRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    DB.clear()
    errorSpy.mockClear()
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = origFetch
    URL.createObjectURL = origCreateObjectURL
    URL.revokeObjectURL = origRevokeObjectURL

    errorSpy.mockClear()
  })

  it('seeds all builtins when fetch succeeds and never logs a seed failure', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([new Uint8Array(64)], { type: 'image/avif' }),
    })) as unknown as typeof fetch

    setActivePinia(createPinia())
    const store = useBackgroundStore()
    await store.initializeStore()

    expect(store.loading).toBe(false)
    for (const id of BUILTIN_IDS) {
      const entry = store.entries.get(id)
      expect(entry, `missing seeded entry ${id}`).toBeDefined()
      expect(entry!.type).toBe('builtin')
      expect(entry!.blob).toBeInstanceOf(Blob)
      expect(entry!.blob.size).toBe(64)
      expect(entry!.characterId).toBeNull()
    }
    expect(store.entries.size).toBe(BUILTIN_IDS.length)

    const seedFailures = errorSpy.mock.calls.filter(args => String(args[0]).includes('Failed to seed builtin'))
    expect(seedFailures).toHaveLength(0)

    // Persisted for the next window.
    for (const id of BUILTIN_IDS) {
      expect(DB.get(id)).toBeDefined()
    }
  })

  it('logs exactly one failure per failing builtin and still initializes the store', async () => {
    // First builtin fails, others succeed.
    let call = 0
    globalThis.fetch = vi.fn(async () => {
      call += 1
      if (call === 1)
        throw new Error('network down')
      return {
        ok: true,
        blob: async () => new Blob([new Uint8Array(32)], { type: 'image/avif' }),
      }
    }) as unknown as typeof fetch

    setActivePinia(createPinia())
    const store = useBackgroundStore()
    await store.initializeStore()

    expect(store.loading).toBe(false)
    const seedFailures = errorSpy.mock.calls.filter(args => String(args[0]).includes('Failed to seed builtin'))
    expect(seedFailures).toHaveLength(1)
    expect(String(seedFailures[0][1])).toBe('builtin:cozy-tea-corner')

    // Remaining builtins still seeded; the store is usable.
    const second = store.entries.get('builtin:cute-streaming-room')
    expect(second).toBeDefined()
    expect(second!.blob.size).toBe(32)
    const third = store.entries.get('builtin:summer-sky-meadow')
    expect(third).toBeDefined()
    expect(third!.blob.size).toBe(32)
    expect(store.entries.has('builtin:cute-streaming-room')).toBe(true)
    expect(store.entries.has('builtin:summer-sky-meadow')).toBe(true)
  })

  it('does not refetch builtins that already exist in storage', async () => {
    for (const id of BUILTIN_IDS) {
      DB.set(id, {
        id,
        type: 'builtin',
        characterId: null,
        title: id,
        blob: new Blob([new Uint8Array(8)]),
        createdAt: 1,
      })
    }
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob([new Uint8Array(99)]),
    }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    setActivePinia(createPinia())
    const store = useBackgroundStore()
    await store.initializeStore()

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(store.entries.size).toBe(BUILTIN_IDS.length)
    expect(store.entries.get('builtin:cozy-tea-corner')!.blob.size).toBe(8)
  })
})
