import { storage } from '../database/storage'

// Device-local tombstone bookkeeping for BYOS mergeable keys.
// Shape: `Record<fullMergeableKey, entryId[]>` — e.g. `{ 'local:memory/text-journal/abc': ['id1'] }`.
// Ids are appended FIFO per key; each key's list is capped at SYNC_TOMBSTONE_CAP with the
// oldest entries evicted first. Cap-not-TTL because merge payloads carry no trustworthy
// clock for "when the delete happened" and expiry machinery would resurrect ancient deletes
// on clock skew; 1000 recent deletes per key bounds storage while covering realistic churn.
// The cap is per keyPrefix, not global: `{ key -> ids[] }` carries no cross-key order and
// tombstones intentionally carry no timestamps.
//
// `local:sync/tombstones` is deliberately NOT a mergeable/synced key (device-local
// bookkeeping, like local:sync-metadata/*). storage.ts enqueueSync() excludes it from the
// outbox so writing tombstones never triggers a sync upload.
export const SYNC_TOMBSTONES_KEY = 'local:sync/tombstones'
export const SYNC_TOMBSTONE_CAP = 1000

export async function readSyncTombstones(): Promise<Record<string, string[]>> {
  return await storage.getItemRaw<Record<string, string[]>>(SYNC_TOMBSTONES_KEY) ?? {}
}

export async function getSyncTombstoneIds(key: string): Promise<Set<string>> {
  try {
    const all = await readSyncTombstones()
    return new Set(all[key] ?? [])
  }
  catch (err) {
    // NOTICE: tombstones are a best-effort delete guard — a read failure must not break sync
    console.error('[SyncEngine] Failed to read sync tombstones:', err)
    return new Set()
  }
}

/**
 * Record that `ids` were deleted locally for mergeable `key`. Tombstoned ids are dropped
 * from future local↔remote merges for that key, so deletes stick across devices.
 */
export async function markSyncTombstone(key: string, ids: string[]): Promise<void> {
  const clean = ids.filter(Boolean).map(String)
  if (clean.length === 0)
    return
  try {
    const all = await readSyncTombstones()
    const arr = all[key] ?? (all[key] = [])
    for (const id of clean) {
      const existing = arr.indexOf(id)
      if (existing >= 0)
        arr.splice(existing, 1)
      arr.push(id)
    }
    if (arr.length > SYNC_TOMBSTONE_CAP)
      all[key] = arr.slice(-SYNC_TOMBSTONE_CAP)
    await storage.setItemRaw(SYNC_TOMBSTONES_KEY, all)
  }
  catch (err) {
    // NOTICE: a tombstone write failure must not break the user's delete/save flow
    console.error('[SyncEngine] Failed to persist sync tombstones:', err)
  }
}
