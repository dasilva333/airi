import { describe, expect, it, vi } from 'vitest'

import { createMockLayeredMemoryModule } from './mock-layered-memory'

/**
 * Contract test for the shared `layeredMemory` mock factory.
 *
 * Every runtime export of the real module must exist on the factory output,
 * and every key of the real `layeredMemory` object (fields, getters and
 * methods) must exist on the mock. When the real module gains or loses a
 * member, this fails instead of letting hand-rolled mocks drift — the failure
 * class that previously produced 42 unhandled `fetchStatus` rejections.
 *
 * `importActual` bypasses `vi.mock` for the real module graph; the mock
 * factory itself never imports the real module, so there is no circularity.
 */
describe('mock-layered-memory contract', () => {
  it('mirrors every runtime export of the real layered-memory module', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('../libs/search/layered-memory')
    const mock = createMockLayeredMemoryModule()

    for (const key of Object.keys(actual)) {
      expect(mock, `missing mock export: ${key}`).toHaveProperty(key)
    }
    expect(mock.LAST_INDEXED_TURN_KEY).toBe(actual.LAST_INDEXED_TURN_KEY)
  })

  it('mirrors every field, getter and method of the real layeredMemory object', async () => {
    const actual = await vi.importActual<{ layeredMemory: Record<string, unknown> }>('../libs/search/layered-memory')
    const mock = createMockLayeredMemoryModule()
    const mockLayeredMemory = mock.layeredMemory as Record<string, unknown>

    for (const key of Object.keys(actual.layeredMemory)) {
      expect(mockLayeredMemory, `missing mock layeredMemory key: ${key}`).toHaveProperty(key)
    }
    // Methods must be callable fns, state fields must be present with neutral defaults.
    for (const method of ['init', 'fetchStatus', 'persist', 'search', 'indexDocuments', 'removeDocument']) {
      expect(typeof mockLayeredMemory[method], `layeredMemory.${method} should be a function`).toBe('function')
    }
    expect(mockLayeredMemory.lastTriage).toBeNull()
    expect(mockLayeredMemory.lastSearchMode).toBe('baseline')
    expect(mockLayeredMemory.lastIndexState).toBeNull()
    expect(mockLayeredMemory.lastEmbedderStatus).toBeNull()
    expect(mockLayeredMemory.isIndexing).toBe(false)
    expect(mockLayeredMemory.isPersisting).toBe(false)
  })

  it('applies per-suite overrides without dropping the rest of the shape', () => {
    const search = vi.fn(async () => [{ id: 'x' }])
    const mock = createMockLayeredMemoryModule({ layeredMemory: { search } })
    const mockLayeredMemory = mock.layeredMemory as Record<string, unknown>

    expect(mockLayeredMemory.search).toBe(search)
    expect(typeof mockLayeredMemory.init).toBe('function')
    expect(typeof mockLayeredMemory.fetchStatus).toBe('function')
  })
})
