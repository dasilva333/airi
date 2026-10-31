import { describe, expect, it } from 'vitest'

import { createLoopbackTransport, safePublishOrBroadcast } from './transport'

describe('createLoopbackTransport', () => {
  it('delivers broadcast to subscribers and unsubscribes', async () => {
    const transport = createLoopbackTransport()
    await transport.start()
    expect(transport.status).toBe('connected')

    const received: unknown[] = []
    const unsubscribe = await transport.subscribe('nap_propose', msg => received.push(msg.payload))
    await transport.broadcast('nap_propose', { hello: true })
    expect(received).toEqual([{ hello: true }])

    unsubscribe()
    await transport.broadcast('nap_propose', { hello: false })
    expect(received).toEqual([{ hello: true }])
    await transport.stop()
    expect(transport.status).toBe('disconnected')
  })

  it('sendToPeer returns false with no subscribers', async () => {
    const transport = createLoopbackTransport()
    await transport.start()
    expect(await transport.sendToPeer('peer-1', 'nap_turn', {})).toBe(false)
    await transport.stop()
  })

  it('exposes sovereignty capabilities and optional publish/initialize/dispose', async () => {
    const transport = createLoopbackTransport()
    expect(transport.capabilities).toEqual({
      isLocalOnly: true,
      supportsMultiParty: true,
      supportsMeshGossip: true,
      requiresExternalRelay: false,
    })

    await transport.initialize?.()
    expect(transport.status).toBe('connected')

    const received: unknown[] = []
    await transport.subscribe('mesh_bytes', msg => received.push(msg.payload))
    const bytes = new TextEncoder().encode('raw-data')
    await transport.publish?.('mesh_bytes', bytes)
    expect(received).toEqual([bytes])

    await transport.dispose?.()
    expect(transport.status).toBe('disconnected')
  })

  it('safePublishOrBroadcast safely routes to publish or falls back to broadcast', async () => {
    const withPublish = createLoopbackTransport()
    await withPublish.start()
    const receivedPublish: unknown[] = []
    await withPublish.subscribe('topic1', msg => receivedPublish.push(msg.payload))
    await safePublishOrBroadcast(withPublish, 'topic1', { test: 1 })
    expect(receivedPublish.length).toBe(1)
    expect(receivedPublish[0]).toBeInstanceOf(Uint8Array)

    // Adapter without publish: falls back to broadcast
    const withoutPublish = {
      id: 'loopback' as const,
      status: 'connected' as const,
      start: async () => {},
      stop: async () => {},
      sendToPeer: async () => true,
      broadcast: async (_t: string, p: any) => { receivedBroadcast.push(p) },
      subscribe: async () => () => {},
    }
    const receivedBroadcast: unknown[] = []
    await safePublishOrBroadcast(withoutPublish, 'topic2', { test: 2 })
    expect(receivedBroadcast).toEqual([{ test: 2 }])
  })
})
