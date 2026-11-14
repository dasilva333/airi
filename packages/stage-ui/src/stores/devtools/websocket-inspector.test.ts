import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWebSocketInspectorStore } from './websocket-inspector'

describe('websocket-inspector redaction', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('redacts the token on module:authenticate events', () => {
    const store = useWebSocketInspectorStore()
    store.add('outgoing', { type: 'module:authenticate', data: { token: 'super-secret-token', source: { name: 'app', version: '1' } } } as any)
    const item = store.history[0]!
    expect((item.event as any).data.token).toBe('[redacted]')
    expect(JSON.stringify(store.history)).not.toContain('super-secret-token')
  })

  it('leaves other events untouched', () => {
    const store = useWebSocketInspectorStore()
    store.add('incoming', { type: 'module:authenticated', data: { source: { name: 'app' } } } as any)
    expect((store.history[0]!.event as any).data.source.name).toBe('app')
  })
})
