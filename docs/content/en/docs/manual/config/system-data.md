---
title: System & Data Management
description: Managing local persistence, IndexedDB storage, cloud backup sync (BYOS), and data lifecycles.
---

# System & Data Management

AIRI gives you complete ownership of your data. This section explains how your settings, character cards, memories, and 3D models are stored locally, how to configure automated cloud backups, and how to safely export or wipe application state.

---

## 1. Where Your Data Lives

AIRI utilizes a dual-engine local storage architecture directly inside your browser / Electron client:

```
┌─────────────────────────────────────────────────────────────┐
│                    AIRI Local Storage                       │
├──────────────────────────────┬──────────────────────────────┤
│    IndexedDB (unstorage)     │    localforage (Blob Store)  │
│  - Chat Sessions & Messages  │  - Uploaded VRM / Live2D     │
│  - Text Journals & Echo Chips│  - Artistry Backgrounds      │
│  - Provider Accounts & Keys  │  - Custom Voice Models (WAV) │
│  - Character Card Metadata   │  - Cache Blobs               │
└──────────────────────────────┴──────────────────────────────┘
```

- **IndexedDB (`local:*`)**: High-speed, structured storage for all configuration, character cards, prompt templates, and conversational memory records.
- **localforage (Binary Asset Store)**: Specialized storage for large binary models, textures, animations, and generated background images.
- **Zero Cloud Dependence**: AIRI runs 100% locally out of the box. No personal telemetry or chat logs are sent to central servers.

---

## 2. Cloud Backup & Sync (BYOS)

If you switch between a desktop and laptop or want an automated off-site backup of your companion's memory, AIRI provides **Bring Your Own Storage (BYOS)**:

### Supported Storage Adapters
- **Amazon S3 / Cloudflare R2 / MinIO**: Compatible with any standard S3-compatible bucket.
- **Google Drive / Dropbox**: Connect via OAuth for seamless personal cloud syncing.

### Configuring Cloud Sync
1. Navigate to **Settings &rarr; System &rarr; Cloud Sync**.
2. Select your storage provider (e.g., **S3 / R2**).
3. Enter your Endpoint URL, Bucket Name, Region, and Access/Secret Keys.
4. Click **Test & Sync Now**.

> [!TIP]
> **Outbox Queue & Conflict Resolution**: AIRI uses an offline-first outbox sync queue. If you make changes while offline, AIRI automatically synchronizes memory and settings the next time an internet connection is established.

---

## 3. Data Export & Backups

In **Settings &rarr; System & Data**:

- **Export All Characters & Chats**: Downloads a complete `.json` / `.zip` archive of all conversation history, journal entries, and character profiles.
- **Import Backup**: Restores your companion state from a previously exported archive.
- **Model Cache Cleanup**: Clears unused 3D/2D model binary caches to reclaim local disk space.

---

## 4. Reset & Danger Zone

When you want a fresh start or need to troubleshoot a corrupted setting:

- **Reset Module Settings**: Restores TTS, STT, and LLM provider defaults without deleting chat history.
- **Delete All Conversations**: Wipes the active chat session database while preserving character cards and settings.
- **Factory Reset (Wipe Everything)**: Completely purges all IndexedDB databases, localforage blobs, and local preferences, restoring AIRI to initial first-run onboarding state.
