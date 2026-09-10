import { useBroadcastChannel } from '@vueuse/core'

// Module-level staging for cross-window intrusion injection.
// When the secondary window creates a journal moment, it broadcasts the staging data
// via BroadcastChannel. The main window stores it here so performSend can read it.
//
// This file is intentionally separated from chat.ts and memory-text-journal.ts
// to avoid circular imports between those two modules.

export const pendingIntrusionStaging: {
  journal?: { entryText: string, timestamp: number }
  artistry?: { prompt: string, timestamp: number }
} = {}

const { post: postIntrusionStaging } = useBroadcastChannel<
  { type: 'journal' | 'artistry', data: any },
  { type: 'journal' | 'artistry', data: any }
>({ name: 'airi-intrusion-staging' })

export interface JournalStagingData {
  entryText: string
  timestamp: number
}

export interface ArtistryStagingData {
  prompt: string
  timestamp: number
}

export interface IntrusionLease {
  leaseId: string
  journal?: JournalStagingData
  artistry?: ArtistryStagingData
}

export const activeIntrusionLeases = new Map<string, IntrusionLease>()

/** Stage a pending journal entry for injection into the next user turn. */
export function stageJournalIntrusion(data: { entryText: string, timestamp: number }, skipBroadcast = false) {
  pendingIntrusionStaging.journal = data
  console.warn('[Intrusion Staging] Journal intrusion staged locally:', data.entryText.substring(0, 50))
  if (!skipBroadcast) {
    postIntrusionStaging({ type: 'journal', data })
  }
}

/** Stage a pending artistry reflection for injection into the next user turn. */
export function stageArtistryIntrusion(data: { prompt: string, timestamp: number }, skipBroadcast = false) {
  pendingIntrusionStaging.artistry = data
  console.warn('[Intrusion Staging] Artistry intrusion staged locally:', data.prompt.substring(0, 50))
  if (!skipBroadcast) {
    postIntrusionStaging({ type: 'artistry', data })
  }
}

export interface LeaseIntrusionsOptions {
  leaseJournal?: boolean
  leaseArtistry?: boolean
}

/**
 * Lease any pending intrusions for a specific turn attempt.
 * Atomically moves pending staging items into an active lease so that
 * subsequent turns do not double-inject them, while retaining the data
 * in memory in case the turn aborts or errors.
 */
export function leaseIntrusions(leaseId: string, options?: LeaseIntrusionsOptions): IntrusionLease {
  const shouldLeaseJournal = options?.leaseJournal ?? true
  const shouldLeaseArtistry = options?.leaseArtistry ?? true

  const lease: IntrusionLease = {
    leaseId,
    journal: shouldLeaseJournal ? pendingIntrusionStaging.journal : undefined,
    artistry: shouldLeaseArtistry ? pendingIntrusionStaging.artistry : undefined,
  }

  // Atomically clear pending staging slots so concurrent/subsequent turns won't re-lease them
  if (shouldLeaseJournal) {
    delete pendingIntrusionStaging.journal
  }
  if (shouldLeaseArtistry) {
    delete pendingIntrusionStaging.artistry
  }

  if (lease.journal || lease.artistry) {
    activeIntrusionLeases.set(leaseId, lease)
    console.warn('[Intrusion Staging] Leased intrusions for turn:', leaseId, {
      hasJournal: !!lease.journal,
      hasArtistry: !!lease.artistry,
    })
  }

  return lease
}

/**
 * Commit a lease when the turn completes and persists successfully.
 * Permanently deletes the leased data.
 */
export function commitIntrusions(leaseId: string): void {
  const lease = activeIntrusionLeases.get(leaseId)
  if (lease) {
    activeIntrusionLeases.delete(leaseId)
    console.warn('[Intrusion Staging] Committed and permanently consumed intrusions for turn:', leaseId)
  }
}

/**
 * Rollback a lease if the turn failed, aborted, or had a provider error.
 * Restores the leased data back to pending staging so it can be presented on the next turn.
 */
export function rollbackIntrusions(leaseId: string): void {
  const lease = activeIntrusionLeases.get(leaseId)
  if (!lease)
    return

  activeIntrusionLeases.delete(leaseId)

  // If pending slots haven't been overwritten by newer entries, restore leased data
  if (lease.journal && !pendingIntrusionStaging.journal) {
    pendingIntrusionStaging.journal = lease.journal
    postIntrusionStaging({ type: 'journal', data: lease.journal })
  }

  if (lease.artistry && !pendingIntrusionStaging.artistry) {
    pendingIntrusionStaging.artistry = lease.artistry
    postIntrusionStaging({ type: 'artistry', data: lease.artistry })
  }

  console.warn('[Intrusion Staging] Rolled back leased intrusions for turn:', leaseId)
}

/** Clear the journal staging after it has been consumed by performSend. */
export function clearJournalStaging() {
  delete pendingIntrusionStaging.journal
  console.warn('[Intrusion Staging] Cleared journal staging after injection')
}

/** Clear the artistry staging after it has been consumed by performSend. */
export function clearArtistryStaging() {
  delete pendingIntrusionStaging.artistry
  console.warn('[Intrusion Staging] Cleared artistry staging after injection')
}

/** Reset all staging and leases (useful for test resets). */
export function resetIntrusionStaging() {
  delete pendingIntrusionStaging.journal
  delete pendingIntrusionStaging.artistry
  activeIntrusionLeases.clear()
}
