---
name: airi-byos-cloud-sync
description: "Use when working with Bring Your Own Storage (BYOS) active state cloud backup, S3/R2/Google Drive storage adapters, unstorage outbox queues, IndexedDB sync reconciliations, or multi-device state synchronization."
---

# Overview & Surface Map
Governs the architecture and implementation of **BYOS (Bring Your Own Storage) Cloud Sync**. Provides privacy-preserving, active-state backup and multi-device state synchronization using standard user-owned S3, Cloudflare R2, or Google Drive AppData storage backends.

The philosophy is **Local-First, Zero-Custody, and Seamless Persistence**. AIRI active state (IndexedDB databases, character cards, event logs, background wallpapers, display models) is continuously backed up to user-owned object storage without intermediate AIRI servers.

# Key Code Paths
- `packages/stage-ui/src/database/storage.ts`: The main storage interceptor that handles BYOS outbox tracking using `unstorage`.
- `packages/stage-ui/src/stores/settings/`: Storage provider configuration and cloud sync connection state.
- **Docs:**
  - `docs/project-byos-cloud-sync.md`: Master document for BYOS logic, S3/R2 reconciliations, and merge rules.
  - `docs/project-audit-cloudsync.md`: Cloud sync audit and verification protocols.

# Architecture: BYOS Cloud Sync Engine
Provides privacy-preserving multi-device sync using standard S3/R2/Google Drive backends.

1. **Unified Interceptor Layer (`unstorage`)**: Rather than hooking into every database repository, mutations to `local:` namespaces are patched to enqueue sync operations into `outbox:queue/*` and update modification timestamps in `local:sync-metadata/timestamps/*`.
2. **Reconciliation Strategy**:
   - **Standard Keys:** Uses Last-Write-Wins (LWW) comparing remote `mtime` and local timestamp. For S3, `LastModified` is used as `mtime`.
   - **Mergeable Keys** (`airi-cards`, `short-term-memory`, `event-log`, etc.): Merged by item ID using LWW or union-merge.
   - **Display Model Manifests**: `groups`/`tags` are union-merged; `nsfw` is source-wins; `expressions`/`motions` are local-wins.
3. **Google Drive AppData Sandbox**: For seamless UX, S3/Cloudflare credentials can be stored encrypted in the user's hidden Google Drive `appDataFolder` (`airi_bootstrap.json`), achieving a single-sign-on-like experience without AIRI custody.

# Core SOPs & Guidelines
1. **Loop Prevention (`isImportingRemoteData`)**: Ensure `storageState.isImportingRemoteData` is strictly respected in outbox interceptors; imported remote data must not re-enqueue into `outbox:queue/*`.
2. **Binary Asset Handling**: `localforage` (blob storage for wallpapers/models) converts backgrounds to AVIF on upload to save bandwidth, tracking deletions in `sync-metadata`.
3. **Anti-Contraction Safeguard**: The sync engine blocks operations that replace a large dataset (>10KB) with a tiny one (<2KB) to prevent accidental remote data erasure.

# Known Pitfalls & Failure Modes
- **Infinite Sync Loops**: Forgetting to check `isImportingRemoteData` during remote data ingestion will trigger infinite re-upload cascades.
- **S3 mtime Translations**: S3 objects do not support custom file modification time writes. AIRI relies on the native `LastModified` timestamp returned by `ListObjectsV2`, requiring precise sequence tracking to avoid redundant downloads.
- **Contraction Triggers**: Replacing a database with an empty array triggers an anti-contraction error requiring manual conflict resolution.
