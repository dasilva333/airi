import { afterEach, describe, expect, it, vi } from 'vitest'

import { resolveMing3Threads } from './ming3'

describe('resolveMing3Threads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 1 when crossOriginIsolated is false regardless of requested threads', () => {
    vi.stubGlobal('crossOriginIsolated', false)
    vi.stubGlobal('navigator', { hardwareConcurrency: 10 })

    expect(resolveMing3Threads('auto')).toBe(1)
    expect(resolveMing3Threads(undefined)).toBe(1)
    expect(resolveMing3Threads(2)).toBe(1)
    expect(resolveMing3Threads(4)).toBe(1)
    expect(resolveMing3Threads(8)).toBe(1)
  })

  it('resolves auto threads across core counts when isolated', () => {
    vi.stubGlobal('crossOriginIsolated', true)

    vi.stubGlobal('navigator', { hardwareConcurrency: 1 })
    expect(resolveMing3Threads('auto')).toBe(1)

    vi.stubGlobal('navigator', { hardwareConcurrency: 2 })
    expect(resolveMing3Threads('auto')).toBe(2)

    vi.stubGlobal('navigator', { hardwareConcurrency: 3 })
    expect(resolveMing3Threads('auto')).toBe(2)

    vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
    expect(resolveMing3Threads('auto')).toBe(2)

    vi.stubGlobal('navigator', { hardwareConcurrency: 6 })
    expect(resolveMing3Threads('auto')).toBe(3)

    vi.stubGlobal('navigator', { hardwareConcurrency: 8 })
    expect(resolveMing3Threads('auto')).toBe(4)

    vi.stubGlobal('navigator', { hardwareConcurrency: 10 })
    expect(resolveMing3Threads('auto')).toBe(4)

    vi.stubGlobal('navigator', { hardwareConcurrency: 16 })
    expect(resolveMing3Threads('auto')).toBe(4)
  })

  it('clamps explicit threads to hardwareConcurrency and bounds', () => {
    vi.stubGlobal('crossOriginIsolated', true)
    vi.stubGlobal('navigator', { hardwareConcurrency: 4 })

    expect(resolveMing3Threads(1)).toBe(1)
    expect(resolveMing3Threads(2)).toBe(2)
    expect(resolveMing3Threads(3)).toBe(3)
    expect(resolveMing3Threads(8)).toBe(4)
    expect(resolveMing3Threads(2.9)).toBe(2)
    expect(resolveMing3Threads(0)).toBe(2)
    expect(resolveMing3Threads(-1)).toBe(2)
  })
})
