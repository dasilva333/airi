# Technical Documentation: BYOS Cloud Sync Audit Recon Tool (`project-audit-cloudsync.md`)

**Status:** Confirmed / Operational
**Script Location:** [`scripts/audit_backup_sync.mjs`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/scripts/audit_backup_sync.mjs)
**Reference Specification:** [`docs/data-catalog.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/data-catalog.md)

---

## 🎯 Purpose & Design Philosophy

The **BYOS Cloud Sync Audit Tool** is an automated, non-destructive reconnaissance script. Its purpose is to perform a granular, multi-store comparison between local browser/Electron IndexedDB storage (`airi-local`, `airi-sync-queue`, `localforage`) and remote Bring Your Own Storage (BYOS) shares (`/Volumes/AIRI-Backup-Share` or S3 backends).

Rather than acting as a simple file wrapper, the auditor acts as a diagnostic tool to:
1. Validate that all local state (cards, chat logs, memories, binary backgrounds, models) has reached parity on the remote share.
2. Prevent accidental data loss prior to clearing site storage or wiping IndexedDB.
3. Expose implementation gaps and sync shortcomings in AIRI's binary asset reconciliation pipeline.

---

## 🏗️ Architecture & Native Execution

The tool runs in headless Electron mode, setting the app's `userData` directory to `@proj-airi/stage-tamagotchi` so it accesses the exact IndexedDBLevelDB container used by the desktop app:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Electron Audit Container                        │
│                                                                        │
│  app.setPath('userData', '~/.../@proj-airi/stage-tamagotchi')          │
│  ensureLocalOriginServer(5173) ──► Serves 127.0.0.1:5173              │
│  BrowserWindow.loadURL('http://localhost:5173')                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Renderer Context (executeJavaScript)                  │
│                                                                        │
│  indexedDB.open('keyval-store')  ──► Scans 4,600+ structured keys     │
│  indexedDB.open('localforage')   ──► Scans 1,900+ binary asset keys   │
│  ipcRenderer.send('audit-progress') ──► Real-time stdout progress logs  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Findings & Discovered Gaps from Recent Audit Run

When executing `npx electron scripts/audit_backup_sync.mjs /Volumes/AIRI-Backup-Share`, the auditor completed scanning **4,654 keyval items** and **1,955 localforage items** in ~15 seconds.

### Key Successes
- **Outbox Sync Queue (`airi-sync-queue`):** `0` pending uncommitted mutations (Queue is 100% clean).
- **Chat Sessions:** `1,208` local chat sessions were audited against `1,208` remote backup sessions with 0 timestamp discrepancies.

### Identified Gaps & Shortcomings (Recon Results)

| Component | Audit Observation | Root Cause / Resolution Achieved |
| :--- | :--- | :--- |
| **Background Images** | **1,461 local backgrounds reported missing on share in early audit pass** | **Origin Port Mismatch (Resolved):** Early audit executed on port `47173`, creating a blank IndexedDB partition (`http_localhost_47173`). Re-running audit on port `5173` confirmed **1,461 / 1,461 local backgrounds were 100% mirrored on remote share.** |
| **Quota Guard Valve** | **"Sync aborted: Storage quota running low"** error when local disk >90% full | **Direction-Aware Guard (Resolved):** Refactored `checkQuotaLimit()` in `sync-engine.ts` with `mode: 'download' \| 'any'`. Local-to-remote uploads (backgrounds, metadata) are never blocked by local quota since they write outward to the SMB share/S3. |
| **Remote Storage Footprint** | **2.05 GB remote background directory footprint** (~1.41 MB PNG per image) | **Batch AVIF Optimization (Resolved):** Batch re-encoded 1,461 remote PNGs to AVIF via `scripts/optimize_backgrounds.mjs`, dropping remote footprint by **93% (from 2.05 GB to ~140 MB)** with zero perceptible quality loss. |
| **Custom Voice Profiles** | **Undocumented `moss-voice-profiles-metadata` & `voice-profile-blobs` databases** | **Deep Audit Discovery (Resolved):** Exhaustive IndexedDB scanning uncovered custom MOSS voice cloning profiles (`Voices_OneShot_CRS_EN`). Rescued reference `.wav` blob to `/Volumes/AIRI-Backup-Share/assets/voice-profiles/`, added `reconcileVoiceProfiles()` to `sync-engine.ts`, and updated `data-catalog.md` and `audit_backup_sync.mjs`. |
| **AIRI Cards Key Lookup** | Card scan reported `0` local cards despite cards existing | The audit key matcher checked `airi-cards` vs `local:airi-cards` in `keyval-store` key prefixes. |
| **Local-Only Display Models** | Models stored in `localforage` without remote manifest entries | Custom imported models or VRMs uploaded locally that were never checked in selective sync or uploaded to `assets/models/manifest.json`. |

---

## 🚀 Native AVIF Background Archive Architecture (Option B)

To ensure high-performance local rendering while maintaining long-term cloud storage efficiency, AIRI uses **Option B (Archive Compression)** for background image management:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          LOCAL SYSTEM (Vite / Renderer)                   │
│                                                                           │
│  • Canvas / AI Capture  ──► Saved as high-res PNG to localforage           │
│  • UI Display           ──► URL.createObjectURL() renders full-res PNG   │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      │  byos-fs:write-file
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS (Electron IPC)                       │
│                                                                           │
│  • Intercepts uploads to assets/backgrounds/*.png                          │
│  • If sharp is available: Re-encodes PNG ──► AVIF (quality 72, effort 4)   │
│  • Writes assets/backgrounds/${id}.avif to SMB Share / Cloud Bucket       │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       REMOTE BACKUP SHARE / CLOUD BUCKET                  │
│                                                                           │
│  • Background files stored as .avif (~50-100 KB vs ~1.7 MB PNG)           │
│  • SyncEngine detects .avif / .webp / .png extensions on download          │
│  • Reconstructs Blob with correct MIME type (image/avif) on restore       │
└───────────────────────────────────────────────────────────────────────────┘
```

### Sync Engine Multi-Format Support (`packages/stage-ui/src/stores/sync-engine.ts`)
1. **Remote Discovery:** `remoteBgs` Map tracks `{ json?: string, image?: string }`, matching `.png`, `.avif`, and `.webp`.
2. **MIME Detection:** Reads the remote image extension and constructs the appropriate `data:${mimeType};base64` data URL on download restore.
3. **Content-Type Header:** S3/Local FS client maps `.avif` to `image/avif` and `.webp` to `image/webp`.

---

## 🛠️ How to Run the Recon Audit

To execute the auditor against your Samba share or local backup folder:

```bash
npx electron scripts/audit_backup_sync.mjs /Volumes/AIRI-Backup-Share
```

Progress is reported live in stdout:
```
Extracting full local IndexedDB & Localforage data catalog...
[Progress] Opening IndexedDB keyval-store...
[Progress] Scanning 4654 keys in keyval-store...
[Progress] Read keyval keys: 1000/4654
...
[Progress] Read localforage items: 1955/1955
[Progress] IndexedDB & localforage extraction complete!
```

---

## 📝 Documenting Gaps for Collaborative Resolution

This document serves as the living record for sync shortcomings flagged by the auditor. When new storage stores are added to [`docs/data-catalog.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/data-catalog.md), corresponding audit rules should be updated in `scripts/audit_backup_sync.mjs`.
