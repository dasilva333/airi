import { beforeEach, describe, expect, it } from 'vitest'

import { tryAcquireSyncLease } from './sync-lease'

// Stage windows share localStorage, so these tests simulate "another window"
// by hand-writing lease keys directly. nanoid alphabet tops out at 'z', so a
// long string of z's is lexicographically greater than any real holder id.
const GREATER_HOLDER = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzz'
const GREATER_KEY = `settings/sync/lease-reconcile-${GREATER_HOLDER}`
const FRESH = () => JSON.stringify({ holder: GREATER_HOLDER, expiresAt: Date.now() + 300_000 })

describe('tryAcquireSyncLease', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('first acquirer wins when the lease is uncontested', () => {
    const { won, release } = tryAcquireSyncLease('reconcile')
    expect(won).toBe(true)
    release()
  })

  it('loses to a fresh competing lease from another window, and release keeps the competitor key', () => {
    localStorage.setItem(GREATER_KEY, FRESH())
    const { won, release } = tryAcquireSyncLease('reconcile')
    expect(won).toBe(false)
    release()
    expect(localStorage.getItem(GREATER_KEY)).not.toBeNull()
  })

  it('ignores (and collects) expired leases from dead windows', () => {
    const expiredKey = 'settings/sync/lease-reconcile-expired-window'
    localStorage.setItem(expiredKey, JSON.stringify({ holder: 'expired-window', expiresAt: Date.now() - 1_000 }))
    const { won, release } = tryAcquireSyncLease('reconcile')
    expect(won).toBe(true)
    expect(localStorage.getItem(expiredKey)).toBeNull()
    release()
  })

  it('release removes only its own key', () => {
    const a = tryAcquireSyncLease('reconcile')
    expect(a.won).toBe(true)
    localStorage.setItem(GREATER_KEY, FRESH())
    a.release()
    expect(localStorage.getItem(GREATER_KEY)).not.toBeNull()
    const remaining = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter(k => k?.startsWith('settings/sync/lease-reconcile-'))
    expect(remaining).toEqual([GREATER_KEY])
  })

  it('tolerates unparseable lease entries without crashing', () => {
    localStorage.setItem('settings/sync/lease-reconcile-garbage', '{not json')
    localStorage.setItem('settings/sync/lease-reconcile-shape', JSON.stringify({ foo: 1 }))
    const { won, release } = tryAcquireSyncLease('reconcile')
    expect(won).toBe(true)
    release()
  })

  it('outbox and reconcile leases are independent', () => {
    localStorage.setItem(GREATER_KEY, FRESH()) // greater holder for reconcile only
    const outbox = tryAcquireSyncLease('outbox')
    expect(outbox.won).toBe(true)
    outbox.release()
  })
})
