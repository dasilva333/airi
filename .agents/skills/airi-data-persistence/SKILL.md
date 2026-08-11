---
name: airi-data-persistence
description: "Use when working with writing or modifying database repositories, dual IndexedDB persistence layer (unstorage + localforage), sync engine outbox queues, or S3/ElectronFS reconciliations."
---

# Overview & Architecture

AIRI's data persistence architecture is designed for local-first operations, utilizing multiple IndexedDB instances backed by memory buffers, blob storage, and robust outbox-based synchronization mechanisms. It consists of three primary storage domains:

1. **Structured Data (`unstorage`):** In-memory storage synced to IndexedDB (`airi-local`), monkey-patched for automatic outbox enqueuing on mutation.
2. **Sync Outbox (`unstorage`):** A dedicated IndexedDB instance (`airi-sync-queue`) storing a queue of operations to be mirrored remotely (e.g., S3 or ElectronFS).
3. **Blob / Binary Storage (`localforage`):** Used for heavy assets (images, VRM/Live2D models, audio, stickers). This bypasses the outbox and is synchronized via specialized reconciliation loops.

# Key Components and Code Paths

### 1. Storage Drivers and Monkey-Patching
**Path:** `packages/stage-ui/src/database/storage.ts`
- Uses `unstorage` with a `memoryDriver()` base for speed, mounted to `indexedDbDriver()` for persistence.
- Crucially, `storage.setItem`, `storage.setItemRaw`, and `storage.removeItem` are overridden to automatically enqueue operations into `outbox:queue/*` unless `storageState.isImportingRemoteData` is `true`.

### 2. Synchronization Engine
**Path:** `packages/stage-ui/src/stores/sync-engine.ts`
- Contains `ElectronFSClient` and `S3StorageClient` implementing the `StorageClient` interface.
- Reads `outbox:queue/*` entries sequentially and executes mutations remotely.
- Employs conflict resolution heuristics (e.g., preventing >5x array contraction, resolving LWW via timestamps).

### 3. Repositories
**Path:** `packages/stage-ui/src/database/repos/*`
- Structured data entities have dedicated repository definitions (e.g., `characters.repo.ts`, `chat-sessions.repo.ts`, `text-journal.repo.ts`).
- Data access flows from UI stores -> Repositories -> `storage.ts`.

### 4. Binary/Blob Assets (localforage)
- Managed in feature-specific stores rather than centralized repositories.
- E.g., `packages/stage-ui/src/stores/background.ts`, `packages/stage-ui/src/stores/display-models.ts`.
- Specialized reconciliations (`reconcileBackgrounds()`, `reconcileModels()`) manage syncing independent of the main `outbox`.

# Core SOPs

### 1. Writing to Structured Data
- Use `storage.setItemRaw()` and `storage.getItemRaw()` for JSON-serializable structured data prefixed with `local:`.
- **Do not** write to `outbox:` directly. The monkey-patch in `storage.ts` handles enqueueing.
- If importing bulk data from a remote source, set `storageState.isImportingRemoteData = true` before writing to prevent cyclic sync loops, then set it back to `false`.

### 2. Managing Binary Assets
- Use `localforage` directly for blobs/files.
- Do not attempt to store `Blob` or `File` objects in `unstorage`.
- If adding a new binary asset type, implement a corresponding custom `reconcile` method in the sync engine.

### 3. Modifying the Sync Engine
- Ensure that you handle both `ElectronFSClient` and `S3StorageClient`.
- Avoid destructive conflict resolutions. Default to LWW (Last-Write-Wins) combined with timestamp checks (`local:sync-metadata/timestamps/*`).

# Known Pitfalls

- **Sync Conflicts & Loops:** Failing to toggle `storageState.isImportingRemoteData` when importing cloud data will queue all imported keys back into the outbox, causing exponential sync amplification.
- **Timestamp Metadata:** `local:sync-metadata/timestamps/*` are internal metadata used for conflict resolution and skipped during sync. Do not use these keys for app logic.
- **Large Blobs in `unstorage`:** Will cause quota issues and severely degrade sync engine performance since JSON serialization fails or becomes unwieldy.

# Verification Steps

1. Always verify that new structured endpoints are prefixed with `local:` (or they won't sync).
2. Validate any `unstorage` modifications via standard workspace checks (`pnpm -F @proj-airi/stage-ui typecheck`).
3. For sync engine updates, verify behavior against both `S3StorageClient` and `ElectronFSClient` if modifying interface contracts.

## 1. Overview & Surface Map

## 2. Key Code Paths

## 3. Core SOPs & Guidelines

## 4. Known Pitfalls & Failure Modes

## 5. Verification Workflows
