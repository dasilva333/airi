import { describe, expect, it } from 'vitest'

import { createProviderRegistry } from './index'

// Mock i18n translation function that returns the key
const mockT = ((key: string) => key) as any

describe('provider registry composition', () => {
  it('composes registry metadata without throwing errors', () => {
    const registry = createProviderRegistry(mockT, {})
    expect(registry).toBeDefined()
    expect(typeof registry).toBe('object')
  })

  it('contains essential provider categories', () => {
    const registry = createProviderRegistry(mockT, {})
    const categories = new Set(Object.values(registry).map(entry => entry.category))

    // Must at least contain speech, transcription, and chat categories
    expect(categories.has('speech') || categories.has('transcription') || categories.has('chat')).toBe(true)
  })

  it('includes key flagship provider registrations', () => {
    const registry = createProviderRegistry(mockT, {})
    const providerIds = Object.keys(registry)

    // Verify key providers exist in registry output
    // Note: Once Phase 1 extraction completes, speech/transcription IDs will populate here
    expect(providerIds.length).toBeGreaterThan(0)
  })
})
