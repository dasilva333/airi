import { describe, expect, it } from 'vitest'

import { getMossAdapterInstance } from './moss-audio-utils'

describe('mOSS audio utilities unit tests', () => {
  it('instantiates MOSS adapter singleton lazily', async () => {
    const adapter1 = await getMossAdapterInstance()
    const adapter2 = await getMossAdapterInstance()

    expect(adapter1).toBeDefined()
    expect(adapter2).toBeDefined()
    expect(adapter1).toBe(adapter2) // Must be identical singleton instance
  })
})
