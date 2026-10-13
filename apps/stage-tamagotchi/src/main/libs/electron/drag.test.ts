import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

describe('startDraggingWindow', () => {
  it('does not throw when invoked on current platform', async () => {
    const { startDraggingWindow } = await import('./drag')
    expect(() => startDraggingWindow(Buffer.from([0, 1, 2]))).not.toThrow()
  })

  it('safely no-ops on Linux without attempting to load native plugin', async () => {
    const { vi } = await import('vitest')
    vi.resetModules()
    vi.doMock('std-env', () => ({ isLinux: true }))
    const { startDraggingWindow } = await import('./drag')
    expect(() => startDraggingWindow(Buffer.from([0, 1, 2]))).not.toThrow()
    vi.doUnmock('std-env')
  })
})
