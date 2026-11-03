import type { TransportAdapter, TransportHandler } from '@proj-airi/stage-shared'

import { describe, expect, it, vi } from 'vitest'

import { createLibp2pTransportAdapter } from './transport-adapter'

describe('createLibp2pTransportAdapter', () => {
  it('delegates start/stop/broadcast/subscribe to deps', async () => {
    const initialize = vi.fn(async () => {})
    const dispose = vi.fn(async () => {})
    const publish = vi.fn(async (_t: string, _d: Uint8Array) => {})
    const subscribe = vi.fn((_t: string, _h: (d: Uint8Array) => void) => () => {})
    const adapter = createLibp2pTransportAdapter({
      deps: { initialize, dispose, publish, subscribe },
    })

    expect(adapter.id).toBe('libp2p-mesh')

    await adapter.start()
    expect(initialize).toHaveBeenCalledOnce()

    const payload = new Uint8Array([1, 2, 3])
    await adapter.broadcast('airi/test', payload)
    expect(publish).toHaveBeenCalledWith('airi/test', payload)

    const handler: TransportHandler<unknown> = () => {}
    const unsub = await adapter.subscribe('airi/test', handler)
    expect(typeof unsub).toBe('function')

    await adapter.stop()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('defaults to local-only mesh capabilities', () => {
    const adapter = createLibp2pTransportAdapter({
      deps: {
        initialize: async () => {},
        dispose: async () => {},
        publish: async () => {},
        subscribe: () => () => {},
      },
    })
    expect(adapter.capabilities?.isLocalOnly).toBe(true)
    expect(adapter.capabilities?.requiresExternalRelay).toBe(false)
  })

  it('allows capability overrides', () => {
    const adapter = createLibp2pTransportAdapter({
      deps: {
        initialize: async () => {},
        dispose: async () => {},
        publish: async () => {},
        subscribe: () => () => {},
      },
      capabilities: { requiresExternalRelay: true },
    })
    expect(adapter.capabilities?.requiresExternalRelay).toBe(true)
    expect(adapter.capabilities?.isLocalOnly).toBe(true)
  })

  it('satisfies the TransportAdapter contract', () => {
    const adapter: TransportAdapter = createLibp2pTransportAdapter({
      deps: {
        initialize: async () => {},
        dispose: async () => {},
        publish: async () => {},
        subscribe: () => () => {},
      },
    })
    expect(adapter).toBeDefined()
  })

  it('preserves senderId and timestamp from subscriber metadata', async () => {
    let capturedHandler: ((data: Uint8Array, meta?: { senderId?: string, timestamp?: number }) => void) | undefined
    const subscribe = vi.fn((_t: string, handler: any) => {
      capturedHandler = handler
      return () => {}
    })

    const adapter = createLibp2pTransportAdapter({
      deps: {
        initialize: async () => {},
        dispose: async () => {},
        publish: async () => {},
        subscribe,
      },
    })

    const received: any[] = []
    await adapter.subscribe('airi/presence', (msg: any) => {
      received.push(msg)
    })

    expect(capturedHandler).toBeDefined()
    const encoded = new TextEncoder().encode(JSON.stringify({ hello: 'peer' }))
    const customTime = 1730000000000
    capturedHandler!(encoded, { senderId: 'peer-abc-123', timestamp: customTime })

    expect(received).toHaveLength(1)
    expect(received[0].senderId).toBe('peer-abc-123')
    expect(received[0].timestamp).toBe(customTime)
    expect(received[0].payload).toEqual({ hello: 'peer' })
  })
})
