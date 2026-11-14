import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveWebSocketUrl, useModsServerChannelStore } from './channel-server'

// Fake Client that never authenticates — drives the 5s auth-timeout safety path.
vi.mock('@proj-airi/server-sdk', () => {
  class FakeClient {
    constructor(public options: any) {}
    close() {}
    updateToken() {}
    getToken() { return '' }
    onEvent() {}
    offEvent() {}
    send() {}
  }
  return {
    Client: FakeClient,
    WebSocketEventSource: { StageWeb: 'stage-web', StageTamagotchi: 'stage-tamagotchi', StageCapacitor: 'stage-capacitor' },
  }
})

describe('useModsServerChannelStore initialize', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears initializing and marks unreachable after the auth timeout, and initialize() can be called again', async () => {
    const store = useModsServerChannelStore()

    const first = store.initialize()
    await vi.advanceTimersByTimeAsync(5000)
    await first

    expect(store.status).toBe('unreachable')
    expect(store.connected).toBe(false)

    // The timed-out attempt must not wedge initialize() into returning a stale promise.
    const second = store.initialize()
    await vi.advanceTimersByTimeAsync(5000)
    await second

    expect(store.status).toBe('unreachable')
    expect(store.connected).toBe(false)
  })
})

describe('resolveWebSocketUrl', () => {
  function fakeGetItem(entries: Record<string, string>): (key: string) => string | null {
    return key => key in entries ? entries[key] : null
  }

  it('uses the user override verbatim when set', () => {
    expect(resolveWebSocketUrl(fakeGetItem({ 'settings/connection/websocket-url': 'wss://gateway.example.com/custom' })))
      .toBe('wss://gateway.example.com/custom')
  })

  it('derives ws://localhost:6121/ws from defaults when nothing is stored', () => {
    expect(resolveWebSocketUrl(fakeGetItem({}))).toBe('ws://localhost:6121/ws')
  })

  it('derives wss:// when tls-enabled is "true"', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'example.test',
      'settings/server-channel/port': '6443',
      'settings/server-channel/tls-enabled': 'true',
    }))).toBe('wss://example.test:6443/ws')
  })

  it('falls back to the legacy websocket-tls-config probe when tls-enabled key is absent', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/websocket-tls-config': JSON.stringify({ cert: 'x', key: 'y' }),
    }))).toBe('wss://localhost:6121/ws')

    // Legacy key holding JSON null (no TLS) stays ws.
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/websocket-tls-config': 'null',
    }))).toBe('ws://localhost:6121/ws')

    // Malformed legacy JSON does not crash, stays ws.
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/websocket-tls-config': '{not-json',
    }))).toBe('ws://localhost:6121/ws')
  })

  it('ignores derived host/port with characters outside [A-Za-z0-9.-] and non-1..65535 ports', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'evil.com/x?y=',
      'settings/server-channel/port': '6121',
    }))).toBe('ws://localhost:6121/ws')

    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'good.example.test',
      'settings/server-channel/port': '70000',
    }))).toBe('ws://localhost:6121/ws')

    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'good.example.test',
      'settings/server-channel/port': '0',
    }))).toBe('ws://localhost:6121/ws')

    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'good.example.test',
      'settings/server-channel/port': 'not-a-port',
    }))).toBe('ws://localhost:6121/ws')
  })

  it('ignores a "false" tls-enabled key instead of falling back to the legacy probe', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/tls-enabled': 'false',
      'settings/server-channel/websocket-tls-config': JSON.stringify({ cert: 'x' }),
    }))).toBe('ws://localhost:6121/ws')
  })

  it('treats an empty override as "derive" instead of producing a broken URL', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/connection/websocket-url': '',
      'settings/server-channel/tls-enabled': 'true',
    }))).toBe('wss://localhost:6121/ws')
  })

  it('rewrites non-loopback ws:// override to wss:// instead of cleartext', () => {
    expect(resolveWebSocketUrl(fakeGetItem({ 'settings/connection/websocket-url': 'ws://192.168.1.10:6121/ws' })))
      .toBe('wss://192.168.1.10:6121/ws')
  })

  it('rewrites a derived non-loopback ws:// (tls flag false) to wss://', () => {
    expect(resolveWebSocketUrl(fakeGetItem({
      'settings/server-channel/hostname': 'nas.example.lan',
      'settings/server-channel/port': '6121',
      'settings/server-channel/tls-enabled': 'false',
    }))).toBe('wss://nas.example.lan:6121/ws')
  })

  it('keeps loopback ws:// untouched', () => {
    expect(resolveWebSocketUrl(fakeGetItem({ 'settings/connection/websocket-url': 'ws://127.0.0.1:6121/ws' })))
      .toBe('ws://127.0.0.1:6121/ws')
  })
})
