import { debug } from '@proj-airi/stage-shared'
import { nanoid } from 'nanoid'

export type SyncLeaseKind = 'reconcile' | 'outbox'

const leasePrefix = (kind: SyncLeaseKind) => `settings/sync/lease-${kind}-`

interface LeaseEntry {
  holder: string
  expiresAt: number
}

function readLeaseEntries(prefix: string, now: number): LeaseEntry[] {
  const entries: LeaseEntry[] = []
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix))
      keys.push(key)
  }
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null)
        continue
      const parsed = JSON.parse(raw) as Partial<LeaseEntry> | null
      if (!parsed || typeof parsed.holder !== 'string' || typeof parsed.expiresAt !== 'number')
        continue
      if (parsed.expiresAt <= now) {
        // Expired: collect opportunistically so dead windows don't accumulate keys.
        localStorage.removeItem(key)
        continue
      }
      entries.push({ holder: parsed.holder, expiresAt: parsed.expiresAt })
    }
    catch {
      // Unparseable lease entry: ignore it, don't let one bad window block sync.
    }
  }
  return entries
}

// Cross-window mutex for sync work. Stage windows share localStorage (same partition),
// so a plain localStorage election is enough — no IDB, no BroadcastChannel.
// Election: after writing our own key, the lexicographically greatest unexpired
// holder wins. Deterministic and race-tolerant: racing writers all read the same
// key set (modulo timing) and converge on the same winner.
export function tryAcquireSyncLease(kind: SyncLeaseKind, ttlMs = 300_000): { won: boolean, release: () => void } {
  const holder = nanoid()
  const prefix = leasePrefix(kind)
  const myKey = `${prefix}${holder}`
  const release = () => {
    try {
      localStorage.removeItem(myKey)
    }
    catch {}
  }

  const now = Date.now()
  try {
    localStorage.setItem(myKey, JSON.stringify({ holder, expiresAt: now + ttlMs } satisfies LeaseEntry))
    const entries = readLeaseEntries(prefix, now)
    const winner = entries.reduce<LeaseEntry | null>((max, entry) => (!max || entry.holder > max.holder ? entry : max), null)
    return { won: winner?.holder === holder, release }
  }
  catch (err) {
    // Fail closed: without localStorage we cannot arbitrate, so don't touch remote.
    debug('[SyncLease] Failed to acquire lease, skipping sync:', err)
    return { won: false, release }
  }
}
