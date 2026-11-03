import type { TransportAdapter } from '@proj-airi/stage-shared'

import { describe, expect, it } from 'vitest'

import { createTransportRegistry } from './transport-registry'

function makeAdapter(id: string, requiresExternalRelay = false): TransportAdapter {
  return {
    id: id as TransportAdapter['id'],
    status: 'disconnected',
    start: async () => {},
    stop: async () => {},
    sendToPeer: async () => false,
    broadcast: async () => {},
    subscribe: async () => () => {},
    capabilities: {
      isLocalOnly: !requiresExternalRelay,
      supportsMultiParty: true,
      supportsMeshGossip: true,
      requiresExternalRelay,
    },
    initialize: async () => {},
    dispose: async () => {},
    publish: async () => {},
  }
}

describe('createTransportRegistry', () => {
  it('registers and retrieves an adapter by id', () => {
    const reg = createTransportRegistry()
    const adapter = makeAdapter('libp2p-mesh')
    reg.register(adapter)
    expect(reg.get('libp2p-mesh')).toBe(adapter)
  })

  it('returns undefined for an unknown id', () => {
    const reg = createTransportRegistry()
    expect(reg.get('nope')).toBeUndefined()
  })

  it('lists registered adapters in registration order', () => {
    const reg = createTransportRegistry()
    const a = makeAdapter('a')
    const b = makeAdapter('b')
    reg.register(a)
    reg.register(b)
    expect(reg.list()).toEqual([a, b])
  })

  it('replaces an adapter when re-registering the same id', () => {
    const reg = createTransportRegistry()
    const first = makeAdapter('x')
    const second = makeAdapter('x')
    reg.register(first)
    reg.register(second)
    expect(reg.get('x')).toBe(second)
    expect(reg.list()).toHaveLength(1)
  })

  it('initializes a local adapter in sovereign mode', async () => {
    const reg = createTransportRegistry()
    const adapter = makeAdapter('local', false)
    let initialized = false
    adapter.initialize = async () => {
      initialized = true
    }
    reg.register(adapter)
    await reg.initialize('local', true)
    expect(initialized).toBe(true)
  })

  it('refuses a relay-requiring adapter in sovereign mode', async () => {
    const reg = createTransportRegistry()
    reg.register(makeAdapter('cloud', true))
    await expect(reg.initialize('cloud', true)).rejects.toThrow(/external relay/i)
  })

  it('allows a relay-requiring adapter in non-sovereign mode', async () => {
    const reg = createTransportRegistry()
    const adapter = makeAdapter('cloud', true)
    let initialized = false
    adapter.initialize = async () => {
      initialized = true
    }
    reg.register(adapter)
    await reg.initialize('cloud', false)
    expect(initialized).toBe(true)
  })

  it('rejects initialize for an unknown id', async () => {
    const reg = createTransportRegistry()
    await expect(reg.initialize('nope', false)).rejects.toThrow(/unknown/i)
  })
})

describe('sovereignty gate (phase5/tdd)', () => {
  it('rejects initializing an adapter with requiresExternalRelay when sovereign', async () => {
    const reg = createTransportRegistry()
    reg.register({
      id: 'cloud-edge-test',
      status: 'disconnected',
      capabilities: {
        isLocalOnly: false,
        supportsMultiParty: true,
        supportsMeshGossip: false,
        requiresExternalRelay: true,
      },
      async initialize() {},
      async start() {},
      async stop() {},
      async sendToPeer() { return false },
      async broadcast() {},
      subscribe() { return () => {} },
    } as any)
    await expect(reg.initialize('cloud-edge-test', true)).rejects.toThrow()
  })

  it('allows initializing a local adapter when sovereign', async () => {
    const reg = createTransportRegistry()
    reg.register({
      id: 'local-test',
      status: 'disconnected',
      capabilities: {
        isLocalOnly: true,
        supportsMultiParty: false,
        supportsMeshGossip: true,
        requiresExternalRelay: false,
      },
      async initialize() { this.status = 'connected' },
      async start() {},
      async stop() {},
      async sendToPeer() { return true },
      async broadcast() {},
      subscribe() { return () => {} },
    } as any)
    await expect(reg.initialize('local-test', true)).resolves.toBeUndefined()
  })

  it('captures requiresExternalRelay at register time for gate decisions', async () => {
    const reg = createTransportRegistry()
    const adapter: any = {
      id: 'mut-test',
      status: 'disconnected',
      capabilities: {
        isLocalOnly: false,
        supportsMultiParty: true,
        supportsMeshGossip: false,
        requiresExternalRelay: true,
      },
      async initialize() {},
      async start() {},
      async stop() {},
      async sendToPeer() { return false },
      async broadcast() {},
      subscribe() { return () => {} },
    }
    reg.register(adapter)
    adapter.capabilities.requiresExternalRelay = false
    await expect(reg.initialize('mut-test', true)).rejects.toThrow()
  })

  it('rejects initializing a missing adapter', async () => {
    const reg = createTransportRegistry()
    await expect(reg.initialize('nope', false)).rejects.toThrow()
  })
})
