import { afterEach, describe, expect, it, vi } from 'vitest'

class DuplicateDeliveryChannel {
  private readonly listeners = new Set<(event: MessageEvent) => void>()

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener)
  }

  postMessage(message: { kind: 'request' | 'response' }): void {
    const deliveries = message.kind === 'request' ? 2 : 1
    for (let count = 0; count < deliveries; count += 1) {
      for (const listener of this.listeners)
        listener({ data: message } as MessageEvent)
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('nan0 owner bridge retry idempotency', () => {
  it('executes a duplicated temporal evaluation request once', async () => {
    vi.stubGlobal('BroadcastChannel', DuplicateDeliveryChannel)
    vi.stubGlobal('window', {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    })
    const { requestNan0Owner, setNan0OwnerHandler } = await import('./nan0-bridge')
    const handler = vi.fn(async () => ({ evaluations: [], nextEvaluationAt: null }))
    const removeOwner = setNan0OwnerHandler('owner-renderer', handler as never)

    const result = await requestNan0Owner('executor-renderer', 'evaluateTemporalAutonomy', {
      reason: 'interval',
      hostReady: true,
    })

    expect(result).toEqual({ evaluations: [], nextEvaluationAt: null })
    expect(handler).toHaveBeenCalledOnce()
    removeOwner()
  })
})
