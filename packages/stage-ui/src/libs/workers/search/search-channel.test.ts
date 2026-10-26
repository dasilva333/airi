import type { SearchBackend } from './search-channel'

import { describe, expect, it, vi } from 'vitest'

import { createChannelSearchClient, resolveSearchBackend, SEARCH_CHANNEL_NAME, serveSearchLeader } from './search-channel'

// ROOT CAUSE:
//
// Every Electron renderer (main, chat, settings, …) spawned its own search
// worker and loaded its own EmbeddingGemma ONNX session (~3 GB: 2 GB JS
// ArrayBuffers + WebGPU buffers + WASM linear memory). Opening the Chat
// window alone added 3.2 GB in 10 s (PID 93979, 2026-10-17 23:11).
//
// BEFORE: `libs/workers/search/index.ts` unconditionally ran
// `new Worker(searchWorkerUrl)` per window with no sharing or eviction.
//
// FIXED BY: single-owner routing — one leader hosts the physical worker
// behind `createGpuWorkerHost` (15-min idle TTL), secondaries proxy over
// the `airi:inference:search` BroadcastChannel and never spawn a worker.

// In-process BroadcastChannel double: delivers to every OTHER live instance,
// like the real primitive (no self-delivery).
class FakeBroadcastChannel {
  static live = new Set<FakeBroadcastChannel>()
  name: string
  listeners = new Map<string, Set<(event: any) => void>>()
  closed = false

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.live.add(this)
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type))
      this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(listener)
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    this.listeners.get(type)?.delete(listener)
  }

  postMessage(data: any) {
    for (const peer of FakeBroadcastChannel.live) {
      if (peer === this || peer.closed || peer.name !== this.name)
        continue
      const handlers = peer.listeners.get('message')
      if (!handlers?.size)
        continue
      queueMicrotask(() => {
        for (const handler of [...handlers])
          handler({ data })
      })
    }
  }

  close() {
    this.closed = true
    FakeBroadcastChannel.live.delete(this)
  }

  static reset() {
    for (const peer of [...FakeBroadcastChannel.live])
      peer.close()
    FakeBroadcastChannel.live.clear()
  }
}

function makeLeaderBackend(): SearchBackend & { calls: unknown[][] } {
  const calls: unknown[][] = []
  const record = (op: string) => (...args: unknown[]) => {
    calls.push([op, ...args])
    if (op === 'search')
      return Promise.resolve({ vectorHits: [], keywordHits: [], documents: [{ id: 'doc-1' }], queryVector: [0.1] })
    if (op === 'init')
      return Promise.resolve({ type: 'ready', stale: false })
    if (op === 'index')
      return Promise.resolve(2)
    if (op === 'persist')
      return Promise.resolve({ documents: [] })
    if (op === 'status')
      return Promise.resolve({ embedder: null, documents: 3, vectors: 2 })
    return Promise.resolve({ type: 'removed', existed: true })
  }
  return {
    calls,
    init: record('init'),
    index: record('index'),
    search: record('search'),
    remove: record('remove'),
    persist: record('persist'),
    status: record('status'),
  }
}

describe('search-channel', () => {
  it('exposes the documented channel name', () => {
    expect(SEARCH_CHANNEL_NAME).toBe('airi:inference:search')
  })

  it('self-elects a leader when no pong arrives, creating the backend exactly once', async () => {
    FakeBroadcastChannel.reset()
    const createLeaderBackend = vi.fn(() => makeLeaderBackend())
    const backend = await resolveSearchBackend({
      createLeaderBackend,
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: false,
    })

    expect(createLeaderBackend).toHaveBeenCalledTimes(1)
    const res = await backend.search('hello', 3)
    expect((res as any).documents).toEqual([{ id: 'doc-1' }])
    expect(createLeaderBackend).toHaveBeenCalledTimes(1)
    FakeBroadcastChannel.reset()
  })

  it('proxies client calls to the leader without running them locally', async () => {
    FakeBroadcastChannel.reset()
    const leaderBackend = makeLeaderBackend()
    await resolveSearchBackend({
      createLeaderBackend: () => leaderBackend,
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: true,
    })
    const client = await resolveSearchBackend({
      createLeaderBackend: () => { throw new Error('client must not host a worker') },
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: false,
    })

    const res: any = await client.search('query', 5, 'char-1', [{ text: 't' }])
    expect(res.documents).toEqual([{ id: 'doc-1' }])
    expect(res.queryVector).toEqual([0.1])
    // Leader saw the forwarded args (signal stripped); executed exactly once.
    expect(leaderBackend.calls).toEqual([['search', 'query', 5, 'char-1', [{ text: 't' }], undefined]])
    FakeBroadcastChannel.reset()
  })

  it('proxies the read-only status probe to the leader', async () => {
    FakeBroadcastChannel.reset()
    const leaderBackend = makeLeaderBackend()
    await resolveSearchBackend({
      createLeaderBackend: () => leaderBackend,
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: true,
    })
    const client = await resolveSearchBackend({
      createLeaderBackend: () => { throw new Error('client must not host a worker') },
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: false,
    })

    const status = await client.status()
    expect(status).toEqual({ embedder: null, documents: 3, vectors: 2 })
    expect(leaderBackend.calls).toEqual([['status']])
    FakeBroadcastChannel.reset()
  })

  it('propagates leader errors with message intact', async () => {
    FakeBroadcastChannel.reset()
    const failing: SearchBackend = {
      ...makeLeaderBackend(),
      search: () => Promise.reject(new Error('leader exploded')),
    }
    await resolveSearchBackend({
      createLeaderBackend: () => failing,
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: true,
    })
    const client = await resolveSearchBackend({
      createLeaderBackend: () => makeLeaderBackend(),
      openChannel: () => new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel,
      isLeader: false,
    })

    await expect(client.search('q')).rejects.toThrow('leader exploded')
    FakeBroadcastChannel.reset()
  })

  it('rejects locally on abort without contacting the leader', async () => {
    FakeBroadcastChannel.reset()
    const leaderBackend = makeLeaderBackend()
    const channel = new FakeBroadcastChannel(SEARCH_CHANNEL_NAME) as unknown as BroadcastChannel
    serveSearchLeader(channel, leaderBackend)
    const client = createChannelSearchClient(channel)

    const controller = new AbortController()
    controller.abort()
    await expect(client.search('q', 3, undefined, undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(leaderBackend.calls).toEqual([])
    FakeBroadcastChannel.reset()
  })
})
