import { describe, expect, it } from 'vitest'

import { createProviderRegistry } from './index'

const mockT = ((key: string) => key) as any

describe('provider metadata contract validation', () => {
  it('enforces canonical metadata rules across all registered providers', () => {
    const registry = createProviderRegistry(mockT, {})

    for (const [providerId, metadata] of Object.entries(registry)) {
      // 1. ID matching
      expect(metadata.id, `Provider '${providerId}' metadata.id must match dictionary key`).toBe(providerId)

      // 2. Category presence
      expect(metadata.category, `Provider '${providerId}' must have a valid category string`).toBeTruthy()
      expect(typeof metadata.category).toBe('string')

      // 3. Tasks array presence
      expect(Array.isArray(metadata.tasks), `Provider '${providerId}' tasks must be an array`).toBe(true)
      expect(metadata.tasks.length, `Provider '${providerId}' must specify at least one task`).toBeGreaterThan(0)

      // 4. Name & Description presence
      expect(metadata.name, `Provider '${providerId}' must have a name`).toBeTruthy()
      expect(metadata.description, `Provider '${providerId}' must have a description`).toBeTruthy()
    }
  })
})
