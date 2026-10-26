/**
 * Single-owner search coordinator using BroadcastChannel.
 *
 * Ensures only ONE embedding worker / ONNX session is resident in memory
 * across all windows (main stage, chat, settings, onboarding).
 *
 * The elected Leader (typically mainWindow) hosts the physical search worker
 * (see `search/index.ts`), while secondary windows proxy their init / index /
 * search / remove / persist calls over the 'airi:inference:search'
 * BroadcastChannel.
 *
 * Design mirrors `libs/inference/adapters/web-llm-channel.ts`:
 * - Election is `isMainWindow()` hash check + 150 ms ping discovery, with
 *   self-election fallback so single-window web keeps working unchanged.
 * - Replies are `requestId`-scoped; receivers never re-emit (no A→B→A loops).
 * - Worker payloads already survive structured clone today (they cross
 *   `worker.postMessage`), so forwarding them over BroadcastChannel adds no
 *   new serialization constraints. The one exception is `AbortSignal`, which
 *   is stripped client-side — abort stays caller-local like `callWorker`.
 *
 * Known race (inherited from web-llm-channel): a secondary that self-elects
 * while the main window is closed keeps leadership; if the main window then
 * opens it pings, finds the secondary leader, and becomes a client. Two
 * residents only occur if both elect simultaneously with no pong in flight.
 */

import { isMainWindow } from '../../inference/adapters/web-llm-channel'
import { createRequestId, serializeWorkerError } from '../../inference/protocol'

export const SEARCH_CHANNEL_NAME = 'airi:inference:search'
const PING_TIMEOUT_MS = 150

/**
 * Which execution provider actually loaded the embedder. `wasm` means the
 * fp32 CPU fallback (WebGPU unavailable or failed) — the slow path that pins
 * cores, and the one the index telemetry must surface.
 */
export interface EmbedderStatus {
  device: 'webgpu' | 'wasm'
  dtype: string
  modelId: string
}

export interface SearchIndexStatus {
  embedder: EmbedderStatus | null
  documents: number
  vectors: number
  lastIndexedTurnAt?: number
}

/**
 * Backend shape consumed by `layeredMemory`. Mirrors the `searchWorker`
 * export of `search/index.ts` so the swap is one object.
 */
export interface SearchBackend {
  init: (snapshot?: any) => Promise<any>
  index: (documents: any[]) => Promise<any>
  search: (
    query: string,
    limit?: number,
    characterId?: string,
    temporalHooks?: any[],
    signal?: AbortSignal,
    vector?: number[],
  ) => Promise<any>
  remove: (id: string) => Promise<any>
  /** `watermark` overrides the persisted coverage frontier (see layeredMemory.persist). */
  persist: (watermark?: number) => Promise<any>
  /** Read-only snapshot of live worker state; never triggers a model load. */
  status: () => Promise<SearchIndexStatus | null>
}

type SearchRpcOp = 'init' | 'index' | 'search' | 'remove' | 'persist' | 'status'

export type SearchChannelMessage
  = | { type: 'ping', senderId: string }
    | { type: 'pong', senderId: string, leaderId: string }
    | { type: 'rpc', requestId: string, senderId: string, op: SearchRpcOp, args: any[] }
    | { type: 'rpc-done', requestId: string, result: any }
    | { type: 'rpc-error', requestId: string, error: { name: string, message: string, stack?: string } }

/**
 * Attach leader serving to an open channel. Every `rpc` is executed against
 * the local backend and answered directly — followers never see each other.
 */
export function serveSearchLeader(channel: BroadcastChannel, backend: SearchBackend): void {
  const leaderId = createRequestId()
  channel.addEventListener('message', async (event: Event) => {
    const msg = (event as MessageEvent<SearchChannelMessage>).data
    if (!msg || typeof msg !== 'object')
      return

    if (msg.type === 'ping') {
      channel.postMessage({ type: 'pong', senderId: leaderId, leaderId } satisfies SearchChannelMessage)
      return
    }

    if (msg.type !== 'rpc')
      return

    const { requestId, op, args } = msg
    try {
      const result = await backend[op](...(args as [any]))
      channel.postMessage({ type: 'rpc-done', requestId, result } satisfies SearchChannelMessage)
    }
    catch (err) {
      const serialized = serializeWorkerError(err)
      channel.postMessage({
        type: 'rpc-error',
        requestId,
        error: { name: serialized.name, message: serialized.message, stack: serialized.stack },
      } satisfies SearchChannelMessage)
    }
  })
}

function awaitPong(channel: BroadcastChannel): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let resolved = false
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        channel.removeEventListener('message', handlePong)
        resolve(false)
      }
    }, PING_TIMEOUT_MS)

    function handlePong(event: Event) {
      const msg = (event as MessageEvent<SearchChannelMessage>).data
      if (msg?.type === 'pong') {
        if (!resolved) {
          resolved = true
          clearTimeout(timeout)
          channel.removeEventListener('message', handlePong)
          resolve(true)
        }
      }
    }

    channel.addEventListener('message', handlePong)
    channel.postMessage({ type: 'ping', senderId: createRequestId() } satisfies SearchChannelMessage)
  })
}

/**
 * Client proxy: same `SearchBackend` shape, executed on the leader. Abort is
 * caller-local (mirrors `callWorker`): the in-flight leader op runs to
 * completion but the caller stops waiting.
 */
export function createChannelSearchClient(channel: BroadcastChannel): SearchBackend {
  function rpc<T>(op: SearchRpcOp, args: any[], signal?: AbortSignal): Promise<T> {
    if (signal?.aborted)
      return Promise.reject(new DOMException('Aborted', 'AbortError'))
    const requestId = createRequestId()

    return new Promise<T>((resolve, reject) => {
      const cleanup = () => {
        channel.removeEventListener('message', handleMessage)
        signal?.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        cleanup()
        reject(new DOMException('Aborted', 'AbortError'))
      }

      function handleMessage(event: Event) {
        const msg = (event as MessageEvent<SearchChannelMessage>).data
        if (!msg || typeof msg !== 'object' || !('requestId' in msg) || (msg as { requestId: string }).requestId !== requestId)
          return
        if (msg.type === 'rpc-done') {
          cleanup()
          resolve(msg.result as T)
          return
        }
        if (msg.type === 'rpc-error') {
          cleanup()
          const err = new Error(msg.error.message)
          err.name = msg.error.name || 'Error'
          if (msg.error.stack)
            err.stack = msg.error.stack
          reject(err)
        }
      }

      signal?.addEventListener('abort', onAbort, { once: true })
      channel.addEventListener('message', handleMessage)
      channel.postMessage({ type: 'rpc', requestId, senderId: createRequestId(), op, args } satisfies SearchChannelMessage)
    })
  }

  return {
    init: (snapshot?: any) => rpc('init', [snapshot]),
    index: (documents: any[]) => rpc('index', [documents]),
    search: (query: string, limit?: number, characterId?: string, temporalHooks?: any[], signal?: AbortSignal, vector?: number[]) =>
      rpc('search', [query, limit, characterId, temporalHooks, vector], signal),
    remove: (id: string) => rpc('remove', [id]),
    persist: (watermark?: number) => rpc('persist', [watermark]),
    status: () => rpc('status', []),
  }
}

export interface ResolveSearchBackendOptions {
  /** Build the leader-local backend (physical worker). Only called when elected. */
  createLeaderBackend: () => SearchBackend
  /** Override channel construction (tests). Return null to force leader mode. */
  openChannel?: () => BroadcastChannel | null
  /** Override window-role detection (tests). Defaults to `isMainWindow()`. */
  isLeader?: boolean
}

/**
 * Resolve the process-local `SearchBackend`: leader-hosted worker or channel
 * proxy. Without `BroadcastChannel` (SSR/tests) this always hosts locally.
 */
export async function resolveSearchBackend(options: ResolveSearchBackendOptions): Promise<SearchBackend> {
  const channel = options.openChannel
    ? options.openChannel()
    : (typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(SEARCH_CHANNEL_NAME) : null)

  if (!channel)
    return options.createLeaderBackend()

  const wantsLeadership = options.isLeader ?? isMainWindow()
  if (wantsLeadership) {
    // NOTICE: create the backend ONCE — serving and returning different
    // instances would host two workers in the leader.
    const backend = options.createLeaderBackend()
    serveSearchLeader(channel, backend)
    return backend
  }

  const leaderFound = await awaitPong(channel)
  if (leaderFound)
    return createChannelSearchClient(channel)

  // No leader active; this window takes leadership.
  const backend = options.createLeaderBackend()
  serveSearchLeader(channel, backend)
  return backend
}
