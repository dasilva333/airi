export type TransportId = 'cloudflare-edge' | 'libp2p-mesh' | 'loopback'
export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface TransportMessage<T = unknown> {
  topic: string
  payload: T
  senderId: string
  timestamp: number
}

export type TransportHandler<T = unknown> = (msg: TransportMessage<T>) => void

// ── Sovereignty & Extended Mesh Extras (Optional) ───────────────────────────
export interface TransportCapabilities {
  readonly isLocalOnly: boolean
  readonly supportsMultiParty: boolean
  readonly supportsMeshGossip: boolean
  readonly requiresExternalRelay: boolean
}

export interface TransportAdapter {
  readonly id: TransportId
  readonly status: TransportStatus

  // Canonical lifecycle + delivery
  start: () => Promise<void>
  stop: () => Promise<void>
  sendToPeer: <T>(peerId: string, topic: string, payload: T) => Promise<boolean>
  broadcast: <T>(topic: string, payload: T) => Promise<void>
  subscribe: <T>(topic: string, handler: TransportHandler<T>) => Promise<() => void>

  // Extended & Mesh extras (optional, for backward compatibility & capability gating)
  readonly capabilities?: TransportCapabilities
  initialize?: () => Promise<void>
  dispose?: () => Promise<void>
  publish?: (topic: string, payload: Uint8Array) => Promise<void>
}

export interface CloudflareEdgeTransportConfig {
  workerOrigin: string
  senderPubkey: string
  sign: (message: string) => Promise<string>
}

export function createLoopbackTransport(): TransportAdapter {
  const subs = new Map<string, Set<TransportHandler<any>>>()
  let status: TransportStatus = 'disconnected'

  return {
    id: 'loopback',
    get status() { return status },
    async start() { status = 'connected' },
    async stop() {
      status = 'disconnected'
      subs.clear()
    },
    async sendToPeer(peerId, topic, payload) {
      const handlers = subs.get(topic)
      if (!handlers || handlers.size === 0)
        return false
      const msg = { topic, payload, senderId: peerId, timestamp: Date.now() }
      for (const handler of [...handlers]) handler(msg)
      return true
    },
    async broadcast(topic, payload) {
      const handlers = subs.get(topic)
      if (!handlers)
        return
      const msg = { topic, payload, senderId: 'local', timestamp: Date.now() }
      for (const handler of [...handlers]) handler(msg)
    },
    async subscribe(topic, handler) {
      let set = subs.get(topic)
      if (!set) {
        set = new Set()
        subs.set(topic, set)
      }
      set.add(handler as TransportHandler<any>)
      return () => {
        set!.delete(handler as TransportHandler<any>)
      }
    },
    capabilities: {
      isLocalOnly: true,
      supportsMultiParty: true,
      supportsMeshGossip: true,
      requiresExternalRelay: false,
    },
    initialize: async () => { status = 'connected' },
    dispose: async () => { status = 'disconnected'; subs.clear() },
    publish: async (topic, payload) => {
      const handlers = subs.get(topic)
      if (!handlers)
        return
      const msg = { topic, payload, senderId: 'local', timestamp: Date.now() }
      for (const handler of [...handlers]) handler(msg as TransportMessage<unknown>)
    },
  }
}

/**
 * Safely dispatches a topic payload over a TransportAdapter.
 *
 * If the adapter implements `publish` (e.g. libp2p raw byte stream), it encodes
 * and awaits `publish()`. Otherwise, it gracefully falls back to `broadcast()`.
 * This prevents runtime non-null assertion crashes when an adapter omits `publish`.
 */
export async function safePublishOrBroadcast<T = unknown>(
  adapter: TransportAdapter,
  topic: string,
  payload: T,
): Promise<void> {
  if (typeof adapter.publish === 'function') {
    const data = payload instanceof Uint8Array
      ? payload
      : new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload))
    await adapter.publish(topic, data)
  }
  else if (typeof adapter.broadcast === 'function') {
    await adapter.broadcast(topic, payload)
  }
}
