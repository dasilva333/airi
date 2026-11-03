import type {
  TransportAdapter,
  TransportCapabilities,
  TransportHandler,
  TransportStatus,
} from '@proj-airi/stage-shared'

/**
 * Dependencies the libp2p transport adapter delegates to. Injecting them keeps
 * the adapter pure and unit-testable without spinning up a real libp2p node;
 * production wiring supplies the live node's functions (see `index.ts`).
 *
 * `publish`/`subscribe` are the pub/sub surface; `start`/`stop`/`sendToPeer`
 * are optional upstream-aligned helpers. When omitted, the adapter degrades to
 * pub/sub only (status reports 'connected' after start).
 */
export interface Libp2pTransportAdapterDeps {
  initialize: () => Promise<void>
  dispose: () => Promise<void>
  publish: (topic: string, data: Uint8Array) => Promise<void>
  subscribe: (topic: string, handler: (data: Uint8Array, meta?: { senderId?: string, timestamp?: number }) => void) => () => void
  /** Optional: resolve a peer's worker URL / direct dial for sendToPeer. */
  sendToPeer?: (peerId: string, topic: string, payload: unknown) => Promise<boolean>
}

export interface Libp2pTransportAdapterOptions {
  /** Override the default capability flags (defaults: local-only mesh). */
  capabilities?: Partial<TransportCapabilities>
  deps: Libp2pTransportAdapterDeps
}

const DEFAULT_CAPABILITIES: TransportCapabilities = {
  isLocalOnly: true,
  supportsMultiParty: true,
  supportsMeshGossip: true,
  requiresExternalRelay: false,
}

export function createLibp2pTransportAdapter(
  options: Libp2pTransportAdapterOptions,
): TransportAdapter {
  const capabilities: TransportCapabilities = Object.freeze({
    ...DEFAULT_CAPABILITIES,
    ...options.capabilities,
  })
  const { initialize, dispose, publish, subscribe, sendToPeer } = options.deps

  let status: TransportStatus = 'disconnected'

  const adapter: TransportAdapter = {
    id: 'libp2p-mesh',
    get status() { return status },
    capabilities,
    // Upstream-aligned lifecycle
    start: async () => { await initialize(); status = 'connected' },
    stop: async () => { await dispose(); status = 'disconnected' },
    // Peer-addressed delivery (gossipsub has no native peer routing; fall back to publish)
    sendToPeer: async (peerId: string, topic: string, payload: unknown) => {
      if (sendToPeer)
        return sendToPeer(peerId, topic, payload)
      try {
        await publish(topic, new TextEncoder().encode(JSON.stringify(payload)))
        return true
      }
      catch {
        return false
      }
    },
    broadcast: async (topic: string, payload: unknown) => {
      const data = payload instanceof Uint8Array
        ? payload
        : new TextEncoder().encode(JSON.stringify(payload))
      await publish(topic, data)
    },
    subscribe: async <T>(topic: string, handler: TransportHandler<T>) => {
      const inner = (data: Uint8Array, meta?: { senderId?: string, timestamp?: number }) => {
        let parsed: unknown = data
        try { parsed = JSON.parse(new TextDecoder().decode(data)) }
        catch { /* keep raw */ }
        handler({
          topic,
          payload: parsed as T,
          senderId: meta?.senderId ?? 'mesh',
          timestamp: meta?.timestamp ?? Date.now(),
        })
      }
      // The libp2p subscriber hands raw bytes; wrap so handler gets a TransportMessage.
      // NOTICE: meta (senderId/timestamp) preserved when the dep subscriber supplies it,
      // instead of hardcoding 'mesh'/Date.now() — keeps peer identity stable across hops.
      const unsub = subscribe(topic, (raw, meta) => {
        inner(raw, meta as { senderId?: string, timestamp?: number } | undefined)
      })
      return unsub
    },
    // Fork extras
    initialize,
    dispose,
    publish: async (topic: string, payload: Uint8Array) => publish(topic, payload),
  }

  // Keep status in sync with initialize/dispose callers that bypass start/stop.
  const origInit = initialize
  const origDispose = dispose
  adapter.initialize = async () => { await origInit(); status = 'connected' }
  adapter.dispose = async () => { await origDispose(); status = 'disconnected' }

  return adapter
}
