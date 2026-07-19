# AIRI Data Catalog

A comprehensive inventory of every persisted store, namespace, and key in the AIRI codebase — their shapes, file locations, sync behaviors, and relationships. Intended as a reference for implementing selective sync, adding new stores, or debugging persistence issues.

---

## Storage Layer Architecture

AIRI uses **three** persistence backends, each suited to different data profiles:

| Layer | Backend | Use Case | Key Pattern |
| :--- | :--- | :--- | :--- |
| **Structured data** | IndexedDB via `unstorage` (base: `airi-local`) | App data that needs querying, merging, and cross-device sync | `local:{namespace}/{...}` |
| **Blob/binary data** | IndexedDB via `localforage` (auto-managed DB) | Large binary assets (images, models, audio) | `{prefix}-{id}` |
| **Settings/preferences** | Browser `localStorage` | Small key-value config, credentials, UI state | `settings/{group}/{key}` |

### Unified Storage Layer (`database/storage.ts`)

The core abstraction is `unstorage` with an in-memory base driver and two IndexedDB mounts:

```typescript
const storage = createStorage({ driver: memoryDriver() })
storage.mount('local', indexedDbDriver({ base: 'airi-local' })) // main data
storage.mount('outbox', indexedDbDriver({ base: 'airi-sync-queue' })) // sync queue
```

**All** `storage.setItem`, `storage.setItemRaw`, and `storage.removeItem` calls are monkey-patched in `storage.ts` to automatically enqueue sync operations into the `outbox:` namespace (unless `storageState.isImportingRemoteData` is `true`).

**File:** `packages/stage-ui/src/database/storage.ts`
**Repos directory:** `packages/stage-ui/src/database/repos/`

---

## 1. IndexedDB — Structured Data (`local:*`)

All keys in this namespace go through `storage.setItemRaw` / `storage.getItemRaw` and are automatically tracked by the sync engine's outbox.

### 1.1 AIRI Cards

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:airi-cards` |
| **Repo** | `packages/stage-ui/src/database/repos/` (direct `storage.setItemRaw` in store) |
| **Store** | `packages/stage-ui/src/stores/modules/airi-card.ts` — `useAiriCardStore` |
| **Type** | `[string, AiriCard][]` — array of `[cardId, card]` tuples |
| **Sync** | **Merged** — `mergeAiriCards()` with per-card `updatedAt`/`createdAt` timestamp LWW |
| **Size** | Medium (~600 KB max for large collections) |

```typescript
// File: packages/stage-ui/src/types/character.ts (Card base)
// File: packages/stage-ui/src/stores/modules/airi-card.ts (AiriCard/AiriExtension)

interface AiriCard extends Card {
  extensions: {
    airi: AiriExtension
  } & Card['extensions']
  updatedAt?: number
  createdAt?: number
}

interface AiriExtension {
  modules: {
    consciousness: { provider: string, model: string, moduleConfigs?: Record<string, any> }
    speech: { provider: string, model: string, voice_id: string, pitch?: number, rate?: number, ssml?: boolean, language?: string }
    vrm?: { source?: 'file' | 'url', file?: string, url?: string }
    live2d?: {
      source?: 'file' | 'url'
      file?: string
      url?: string
      activeExpressions?: Record<string, number>
      modelParameters?: Record<string, number>
      motionMappings?: Record<string, string> // @deprecated - Moved to DisplayModel
      hiddenMotions?: string[] // @deprecated - Moved to DisplayModel
    }
    displayModelId?: string
    activeBackgroundId?: string | null
    selectedModelId?: string // legacy
    active_expressions?: Record<string, number>
  }
  imageJournal?: { selfie: boolean }
  artistry?: {
    provider?: string
    model?: string
    promptPrefix?: string
    widgetInstruction?: string
    spawnMode?: 'bg' | 'widget' | 'inline' | 'bg_widget'
    options?: Record<string, any>
    autonomousEnabled?: boolean
    autonomousThreshold?: number
    autonomousTarget?: 'user' | 'assistant'
    autonomousMonitorEnabled?: boolean
    autonomousHistoryDepth?: number
  }
  generation?: CharacterGenerationConfig
  acting?: ActingConfig
  outfits?: AiriOutfit[]
  agents: { [key: string]: { prompt: string, enabled?: boolean } }
  heartbeats?: HeartbeatConfig
  dreamState?: DreamStateConfig
  shortTermMemory?: ShortTermMemoryConfig
  groundingEnabled?: boolean
  visual_assets?: Record<string, {
    description: string
    prompt?: string
    isBase?: boolean
    artistry?: { provider?: string, model?: string, options?: Record<string, any> }
    manifestation?: { modelId?: string, mood?: string, backgroundId?: string, active_expressions?: Record<string, number> }
    idleAnimations?: string[]
    speech?: { provider: string, model: string, voice_id: string }
  }>
  eternal_record?: { relational_milestones?: string[], lore_bits?: string[] }
  proactivity_metrics?: { ttsCount: number, sttCount: number, chatCount: number, totalTurns: number }
  active_concepts?: string[]
  active_state?: {
    displayModelId?: string
    activeBackgroundId?: string | null
    active_expressions?: Record<string, number>
  }
}

interface ActingConfig {
  modelExpressionPrompt: string
  speechExpressionPrompt: string
  speechMannerismPrompt: string
  idleAnimations?: string[]
}
```

### 1.1.2 Base Card properties (Character Card Spec V2/V3)

The root properties of the character card structure extend the base specification:

```typescript
// File: packages/ccc/src/define/card.ts

interface Card {
  name: string // Display/character name
  nickname?: string // Custom user-defined display nickname
  version: string // Character version (e.g. "1.0.0")
  greetings?: string[] // greetings[0] is first_mes, greetings.slice(1) is alternate_greetings
  notes?: string // Creator notes
  description?: string // Short summary descriptions
  personality?: string // Character traits and tags
  scenario?: string // Current circumstance and setting
  systemPrompt?: string // Core LLM system instructions / prompts
  tags?: string[] // Filter tags (anime, video-game, etc)
  messageExample?: Message[][] // Array of sample chat messages
}
```

### 1.2 Characters (Community Catalog)

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:characters` |
| **Repo** | `packages/stage-ui/src/database/repos/characters.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/characters.ts` — `useCharacterStore` |
| **Type** | `Character[]` |
| **Sync** | Full LWW replacement |
| **Size** | Small (~KB per character) |

```typescript
// File: packages/stage-ui/src/types/character.ts

interface Character {
  id: string
  version: number
  coverUrl: string
  avatarUrl: string
  creatorRole: string
  priceCredit: number
  likesCount: number
  bookmarksCount: number
  interactionsCount: number
  forksCount: number
  creatorId: string
  ownerId: string
  characterId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  capabilities: string[]
  avatarModels: { id: string, avatarType: string, url: string, coverUrl?: string }[]
  i18n: { language: string, title: string, description: string, tagline?: string }[]
  prompts: { promptId: string, text: string }[]
  likes: { userId: string, createdAt: string }[]
  bookmarks: { userId: string, createdAt: string }[]
}
```

### 1.3 Providers Configuration

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:providers` |
| **Repo** | `packages/stage-ui/src/database/repos/providers.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/provider-catalog.ts` |
| **Type** | `Record<string, ProviderCatalogProvider>` |
| **Sync** | Full LWW replacement |
| **Size** | Small (~KB) |

```typescript
// File: packages/stage-ui/src/database/repos/providers.repo.ts

interface ProviderCatalogProvider {
  id: string
  definitionId: string
  name: string
  config: Record<string, any>
  validated: boolean
  validationBypassed: boolean
}
```

### 1.4 Chat Sessions Index

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:chat/index/{userId}` |
| **Repo** | `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/chat/session-store.ts` — `useChatSessionStore` |
| **Type** | `ChatSessionsIndex` |
| **Sync** | **Merged** — `mergeChatIndices()` with per-character, per-session timestamp LWW |
| **Size** | Small (~KB) |

```typescript
// File: packages/stage-ui/src/database/repos/chat-sessions.repo.ts

interface ChatSessionsIndex {
  userId: string
  characters: Record<string, {
    activeSessionId: string
    sessions: Record<string, ChatSessionMeta>
  }>
}

interface ChatSessionMeta {
  sessionId: string
  userId: string
  characterId: string
  title?: string
  messageCount?: number
  createdAt: number
  updatedAt: number
}
```

### 1.5 Chat Session Records (Messages)

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:chat/sessions/{sessionId}` |
| **Repo** | `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/chat/session-store.ts` |
| **Type** | `ChatSessionRecord` |
| **Sync** | **Merge + conflict detection** — messages merged by `id` dedup + `updatedAt`/`createdAt` LWW through `mergeArraysById()`. Safety heuristics guard against >5x contraction. Conflicts stored for manual resolution. |
| **Size** | Potentially large (full chat logs, thousands of messages) |

```typescript
interface ChatSessionRecord {
  meta: ChatSessionMeta
  messages: ChatHistoryItem[]
}

// File: packages/stage-ui/src/stores/chat/session-store.ts

interface ChatHistoryItem {
  id: string
  role: string
  content: string
  slices?: any[]
  tool_results?: any[]
  categorization?: string
  createdAt: number
}
```

### 1.6 Long-Term Memory (Text Journal)

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:memory/text-journal/{userId}` |
| **Repo** | `packages/stage-ui/src/database/repos/text-journal.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/memory-text-journal.ts` — `useTextJournalStore` |
| **Type** | `TextJournalEntry[]` |
| **Sync** | **Merged** — `mergeArraysById()` with ID dedup + timestamp LWW |
| **Size** | Medium (accumulates over time) |

```typescript
// File: packages/stage-ui/src/database/repos/text-journal.repo.ts

interface TextJournalEntry {
  id: string
  userId: string
  characterId: string
  characterName: string
  title: string
  content: string
  source: 'tool' | 'chat' | 'proactivity' | 'user' | 'seed' | 'episode'
  type?: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  last_review: number
  surprise?: number
  embedding?: number[]
  version?: number
  createdAt: number
  updatedAt: number
}
```

### 1.7 Short-Term Memory

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:memory/short-term/{userId}` |
| **Repo** | `packages/stage-ui/src/database/repos/short-term-memory.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/memory-short-term.ts` — `useShortTermMemoryStore` |
| **Type** | `ShortTermMemoryBlock[]` |
| **Sync** | **Merged** — `mergeArraysById()` with ID dedup + timestamp LWW |
| **Size** | Small-Medium (~365 daily blocks max) |

```typescript
// File: packages/stage-ui/src/database/repos/short-term-memory.repo.ts

interface ShortTermMemoryBlock {
  id: string
  userId: string
  characterId: string
  characterName: string
  date: string // YYYY-MM-DD
  source: 'automatic' | 'rebuilt'
  summary: string
  estimatedTokens: number
  messageCount: number
  sessionCount: number
  createdAt: number
  updatedAt: number
}
```

### 1.8 Lifetime Memory Artifacts

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:memory/lifetime/{characterId}` |
| **Repo** | `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/memory-lifetime.ts` — `useMemoryLifetimeStore` |
| **Type** | `LifetimeMemoryArtifact` |
| **Sync** | Full LWW |
| **Size** | Small-Medium (~1-7 KB distilled, ~7 KB base archive) |

```typescript
// File: packages/stage-ui/src/database/repos/lifetime-memory.repo.ts

interface LifetimeMemoryArtifact {
  id: string
  characterId: string
  version: number
  chunkSummaries: any[]
  baseArchive?: LifetimeArchive
  baseContent: string
  distillPass1Pack?: DistilledPack
  distilledContent: string
  sourceManifest: {
    rawTurnCount: number
    stmmBlockCount: number
    ltmmEntryCount: number
  }
  createdAt: number
  updatedAt: number
  metadata: {
    model: string
    totalElapsedMs: number
    chunkCount: number
    targetTokens?: number
  }
}

interface LifetimeArchive {
  relationship_summary: string
  recurring_preferences: string[]
  recurring_topics: string[]
  relationship_dynamics: string[]
  user_mannerisms: string[]
  meaningful_old_moments: string[]
  inside_jokes_or_motifs: string[]
  archive_notes: string[]
}

interface DistilledPack {
  relationship_core: string[]
  user_patterns: string[]
  shared_rituals: string[]
  stable_topics: string[]
  meaningful_old_moments: string[]
  inside_jokes_or_motifs: string[]
  compression_notes: string[]
}
```

### 1.9 Provisioning Sessions (Lifetime Memory Build State)

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:memory/provisioning-session/{characterId}` |
| **Repo** | `packages/stage-ui/src/database/repos/provisioning-session.repo.ts` |
| **Store** | `useMemoryLifetimeStore` (intermediate state) |
| **Type** | `ProvisioningSession` |
| **Sync** | Full LWW, temporary (cleared on completion) |
| **Size** | Small, temporary |

```typescript
interface ProvisioningSession {
  characterId: string
  phase: 'idle' | 'aggregating' | 'chunking' | 'synthesizing' | 'distill_pass_1' | 'distill_pass_2' | 'success'
  chunkSummaries: any[]
  baseArchive?: any
  baseContent?: string
  distillPass1Pack?: any
  sourceDocCount: number
  totalChunks: number
  completedChunks: number
  updatedAt: number
  targetTokens?: number
  contextLimitTokens?: number
}
```

### 1.10 Echo Chips

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:memory/echo-chips/{userId}` |
| **Repo** | `packages/stage-ui/src/database/repos/echo-chips.repo.ts` |
| **Store** | `packages/stage-ui/src/stores/echo-chips.ts` — `useEchoesStore` |
| **Type** | `EchoChip[]` |
| **Sync** | **Merged** — `mergeArraysById()` with ID dedup + timestamp LWW |
| **Size** | Small (2-5 word semantic bursts) |

```typescript
interface EchoChip {
  id: string
  userId: string
  characterId: string
  date: string // YYYY-MM-DD
  content: string // 2-5 word burst
  type: 'mood' | 'flavor' | 'journal_candidate'
  relevanceScore: number // 0-1
  evidenceIndices?: number[]
  createdAt: number
}
```

### 1.11 Director Notes

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:director/sessions/{sessionId}` |
| **Repo** | `packages/stage-ui/src/database/repos/director-notes.repo.ts` |
| **Store** | Director notes system (referenced by autonomy stores) |
| **Type** | `DirectorNote[]` |
| **Sync** | Full LWW, conflict-protected (critical key) |
| **Size** | Small |

```typescript
interface DirectorNote {
  id: string
  sessionId: string
  type: 'director-note'
  content: string
  intensity: number
  title?: string
  prompt?: string
  target?: 'user' | 'assistant'
  state: 'pending' | 'done'
  selected_concepts?: string[]
  scratchpad?: string
  createdAt: number
  isArchived?: boolean
}
```

### 1.12 Sync Metadata — Timestamps

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:sync-metadata/timestamps/{keyWithoutPrefix}` |
| **File** | `packages/stage-ui/src/database/storage.ts` (written), `packages/stage-ui/src/stores/sync-engine.ts` (read) |
| **Type** | `number` — Unix ms timestamp |
| **Description** | Written on every `storage.setItemRaw`/`removeItem` to track the last modification time of each key |
| **Sync** | **Skipped** by the sync engine (internal metadata) |

### 1.13 Sync Metadata — Conflicts

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:sync-metadata/conflicts/{localKey}` |
| **File** | `packages/stage-ui/src/stores/sync-engine.ts` |
| **Type** | Object with conflict metadata |
| **Sync** | **Skipped** (internal metadata) |

```typescript
interface SyncConflict {
  key: string
  localTimestamp: number
  remoteTimestamp: number
  localSize: number
  remoteSize: number
  remoteRelPath: string
  conflictTime: number
  sessionDetails?: any
}
```

### 1.14 Sync Metadata — Deleted Backgrounds

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:sync-metadata/deleted-backgrounds/{backgroundId}` |
| **File** | `packages/stage-ui/src/stores/background.ts` (lines 313, 348) |
| **Type** | `number` — `Date.now()` |
| **Sync** | **Skipped** (internal metadata) |

### 1.15 Sync Metadata — Deleted Models

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:sync-metadata/deleted-models/{modelId}` |
| **File** | `packages/stage-ui/src/stores/display-models.ts` (line 687) |
| **Type** | `true` (boolean) |
| **Sync** | **Skipped** (internal metadata) |

### 1.16 localStorage Bridge (Synced Settings)

| Attribute | Value |
| :--- | :--- |
| **Key** | `local:localstorage/{settingsKey}` |
| **File** | `packages/stage-ui/src/stores/sync-engine.ts` |
| **Type** | `{ value: string }` — wraps the raw localStorage value |
| **Description** | Selected localStorage keys are mirrored into IndexedDB so they can be synced across devices. Written by `dumpLocalStorageToIndexedDb()`, restored by `restoreLocalStorageFromIndexedDb()`. |
| **Exclusions** | `airi-cards`, `scene/backgrounds`, `airi_cc_*`, `settings/sync/*` |
| **Sync** | Full LWW |

---

## 2. IndexedDB — Sync Outbox Queue (`outbox:*`)

### 2.1 Outbox Queue

| Attribute | Value |
| :--- | :--- |
| **Key** | `outbox:queue/{keyWithoutPrefix}` |
| **Mount** | `storage.mount('outbox', indexedDbDriver({ base: 'airi-sync-queue' }))` |
| **File** | `packages/stage-ui/src/database/storage.ts` (written), `sync-engine.ts` (processed) |
| **Type** | `SyncQueueEntry` |
| **Lifecycle** | Written on every local mutation, read/processed by `processOutbox()`, then deleted |
| **Size** | Tiny, ephemeral |

```typescript
interface SyncQueueEntry {
  key: string // e.g. "local:chat/sessions/abc123"
  action: 'upsert' | 'delete'
  timestamp: number
}
```

---

## 3. IndexedDB (localforage) — Binary/Blob Assets

This layer bypasses `unstorage` and writes directly to `localforage` (a separate IndexedDB instance). Because these keys are NOT tracked by the `storage` monkey-patch, **the sync engine reconciles them separately** via dedicated reconciliation functions (`reconcileBackgrounds()`, `reconcileModels()`).

### 3.1 Background Images

| Attribute | Value |
| :--- | :--- |
| **Store** | `packages/stage-ui/src/stores/background.ts` |
| **Key Pattern** | `bg-{nanoid}` (current), `builtin:{id}` (built-in), `image-journal-{nanoid}` (legacy, migrated) |
| **Type** | `BackgroundEntry` |
| **Sync** | Via `reconcileBackgrounds()` — metadata JSON + raw PNG under `assets/backgrounds/{id}.json` / `assets/backgrounds/{id}.png` |
| **Size** | Large (image binaries, MBs each) |

```typescript
// File: packages/stage-ui/src/stores/background.ts

interface BackgroundEntry {
  id: string
  type: 'builtin' | 'scene' | 'journal' | 'selfie'
  characterId: string | null
  title: string
  blob: Blob
  url?: string
  prompt?: string
  remixId?: string
  createdAt: number
}
```

There is also a second background store in `packages/stage-layouts/src/stores/background.ts` with key pattern `background-{id}` (`STORAGE_PREFIX = 'background-'`) for user-uploaded backgrounds.

### 3.2 Display Models (VRM / Live2D / Spine / MMD)

| Attribute | Value |
| :--- | :--- |
| **Store** | `packages/stage-ui/src/stores/display-models.ts` |
| **Key Pattern** | `display-model-{nanoid}` (file models), `{id}-textures` (MMD textures), keys by raw `{id}` (URL models) |
| **Type** | `DisplayModelFile` / `DisplayModelURL` |
| **Sync** | Via `reconcileModels()` — manifest at `assets/models/manifest.json`, binaries at `assets/models/{id}.bin`, textures at `assets/models/{id}-textures.json`, previews at `assets/models/{id}-preview.png` |
| **Size** | Very Large (model binaries, MBs-GBs each) |

```typescript
// File: packages/stage-ui/src/stores/display-models.ts

enum DisplayModelFormat {
  Live2dZip = 'live2d-zip',
  Live2dDirectory = 'live2d-directory',
  VRM = 'vrm',
  SpineZip = 'spine-zip',
  PMXZip = 'pmx-zip',
  PMXDirectory = 'pmx-directory',
  PMD = 'pmd',
}

interface DisplayModelFile {
  id: string
  format: DisplayModelFormat
  type: 'file'
  file: File
  name: string
  previewImage?: string
  importedAt: number
  nsfw?: boolean
  groups?: string[]
  tags?: string[]
  expressions?: string[]
  motions?: string[]
  emotionMappings?: Record<string, string>
  motionMappings?: Record<string, string>
  hiddenExpressions?: string[]
  hiddenMotions?: string[]
  favoriteExpressions?: string[]
}

interface DisplayModelURL {
  id: string
  format: DisplayModelFormat
  type: 'url'
  url: string
  name: string
  previewImage?: string
  importedAt: number
  nsfw?: boolean
  groups?: string[]
  tags?: string[]
  expressions?: string[]
  motions?: string[]
  emotionMappings?: Record<string, string>
  motionMappings?: Record<string, string>
  hiddenExpressions?: string[]
  hiddenMotions?: string[]
  favoriteExpressions?: string[]
}

type DisplayModel = DisplayModelFile | DisplayModelURL
```

### 3.3 Stickers

| Attribute | Value |
| :--- | :--- |
| **Store** | `packages/stage-ui/src/stores/stickers.ts` |
| **Key Pattern** | `sticker-data-{id}` |
| **Type** | `Blob` (image binary) |
| **Sync** | **Not synced** via BYOS |
| **Size** | Medium (image files) |

```typescript
// File: packages/stage-ui/src/stores/stickers.ts

interface StickerMetadata {
  id: string
  label: string
  addedAt: number
  originalName: string
  mimeType: string
  characterId?: string
}

interface StickerPlacement {
  instanceId: string
  stickerId: string
  x: number
  y: number
  rotation: number
  scale: number
  createdAt: number
  expiresAt?: number
}
```

Metadata is stored in localStorage under `stickers/library-v2`; binary data is in localforage under `sticker-data-{id}`.

### 3.4 Custom VRM Animations

| Attribute | Value |
| :--- | :--- |
| **Store** | `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` |
| **Key Pattern** | `custom-vrma-animation-{id}` |
| **Type** | `StoredCustomVrmAnimation` |
| **Sync** | **Not synced** via BYOS |
| **Size** | Medium (animation files) |

```typescript
// File: packages/stage-ui-three/src/stores/custom-vrm-animations.ts

interface StoredCustomVrmAnimation {
  id: string
  name: string
  description?: string
  blob: Blob
  importedAt: number
  duration?: number
  tags?: string[]
}
```

---

## 4. localStorage — Settings, Preferences & UI State

### 4.1 General / App Settings

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/language` | `string` | `''` | `stores/settings/general.ts` |
| `settings/disable-transitions` | `boolean` | `true` | `stores/settings/general.ts` |
| `settings/use-page-specific-transitions` | `boolean` | `true` | `stores/settings/general.ts` |
| `settings/privacy/remote-sync-enabled` | `boolean` | `false` | `stores/settings/general.ts` |
| `settings/websocket/secure-enabled` | `boolean` | `false` | `stores/settings/general.ts` |
| `settings/stage-enabled` | `boolean` | `true` | `stores/settings/control-strip.ts` |
| `settings/chat-open` | `boolean` | `false` | `stores/settings/control-strip.ts` |
| `settings/caption-open` | `boolean` | `false` | `stores/settings/control-strip.ts` |
| `settings/allow-visible-on-all-workspaces` | `boolean` | `true` | `stores/settings/controls-island.ts` |
| `settings/always-on-top` | `boolean` | `true` | `stores/settings/controls-island.ts` |

### 4.2 Theme

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/theme/colors/hue` | `number` | `220.44` | `stores/settings/theme.ts` |
| `settings/theme/colors/hue-dynamic` | `boolean` | `false` | `stores/settings/theme.ts` |
| `settings/theme/background/gallery-options` | `Record<string, { id, blur }>` | — | `packages/stage-layouts/src/stores/background.ts` |
| `settings/theme/background/gallery-active` | `string` | — | `packages/stage-layouts/src/stores/background.ts` |

### 4.3 Consciousness (LLM)

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/consciousness/active-provider` | `string` | `''` | `stores/modules/consciousness.ts` |
| `settings/consciousness/active-model` | `string` | `''` | `stores/modules/consciousness.ts` |
| `settings/consciousness/active-custom-model` | `string` | `''` | `stores/modules/consciousness.ts` |

### 4.4 Speech (TTS)

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/speech/active-provider` | `string` | `'speech-noop'` | `stores/modules/speech.ts` |
| `settings/speech/active-model` | `string` | `''` | `stores/modules/speech.ts` |
| `settings/speech/voice` | `string` | `''` | `stores/modules/speech.ts` |
| `settings/speech/pitch` | `number` | `0` | `stores/modules/speech.ts` |
| `settings/speech/rate` | `number` | `1` | `stores/modules/speech.ts` |
| `settings/speech/ssml-enabled` | `boolean` | `false` | `stores/modules/speech.ts` |
| `settings/speech/language` | `string` | `'en-US'` | `stores/modules/speech.ts` |
| `settings/speech/voice-profiles` | `VoiceProfile[]` | `[]` | `stores/modules/speech.ts` |

```typescript
// File: packages/stage-ui/src/stores/providers/types.ts

interface VoiceProfile {
  id: string
  name: string
  baseProvider: string
  baseModel: string
  baseVoice: string
  effects: {
    pitch: number
    rate: number
    volume: number
    equalizer?: { bass: number, mid: number, treble: number }
    asmr: number
    radio: number
    robot: number
    reverb: number
    spatial: number
  }
  ust: {
    enabled: boolean
    mode: 'mute' | 'flatten' | 'custom'
    customStripChars: string
    stripEmojis: boolean
    stripSymbols: boolean
    tildeReplacement: string
  }
}
```

### 4.5 Hearing (STT)

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/hearing/active-provider` | `string` | `''` | `stores/modules/hearing.ts` |
| `settings/hearing/active-model` | `string` | `''` | `stores/modules/hearing.ts` |
| `settings/hearing/active-custom-model` | `string` | `''` | `stores/modules/hearing.ts` |
| `settings/hearing/auto-send-enabled` | `boolean` | `false` | `stores/modules/hearing.ts` |
| `settings/hearing/auto-send-delay` | `number` | `2000` | `stores/modules/hearing.ts` |
| `settings/hearing/detection-mode` | `'vad' \| 'manual'` | `'vad'` | `stores/modules/hearing.ts` |
| `settings/hearing/speech-provider-settings` | `Record<string, { deviceId, sampleRate }>` | `{}` | `stores/modules/hearing.ts` |
| `settings/hearing/transcription-provider-settings` | `Record<string, { deviceId, sampleRate }>` | `{}` | `stores/modules/hearing.ts` |

### 4.6 Vision (VLM)

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/vision/active-provider` | `string` | — | `stores/modules/vision.ts` |
| `settings/vision/active-model` | `string` | — | `stores/modules/vision.ts` |
| `settings/vision/context-window` | — | — | `stores/modules/vision.ts` |
| `settings/vision/prompt-shim` | — | — | `stores/modules/vision.ts` |
| `settings/vision/witness-enabled` | — | — | `stores/modules/vision.ts` |
| `settings/vision/witness-prompt` | — | — | `stores/modules/vision.ts` |
| `settings/vision/respect-schedule` | — | — | `stores/modules/vision.ts` |
| `settings/vision/last-heartbeat` | — | — | `stores/modules/vision.ts` |

### 4.7 Discord

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/discord/enabled` | `boolean` | — | `stores/modules/discord.ts` |
| `settings/discord/token` | `string` | — | `stores/modules/discord.ts` |
| `settings/discord/lastRegisteredVersion` | `string` | — | `stores/modules/discord.ts` |
| `settings/discord/chatMode` | `string` | — | `stores/modules/discord.ts` |

### 4.8 Artistry (Image Generation)

| Key | File |
| :--- | :--- |
| `artistry-provider` | `stores/modules/artistry.ts` |
| `artistry-model` | `stores/modules/artistry.ts` |
| `artistry-prompt-prefix` | `stores/modules/artistry.ts` |
| `artistry-provider-options` | `stores/modules/artistry.ts` |
| `artistry-comfyui-server-url` | `stores/modules/artistry.ts` |
| `artistry-comfyui-saved-workflows` | `stores/modules/artistry.ts` |
| `artistry-comfyui-active-workflow` | `stores/modules/artistry.ts` |
| `artistry-replicate-api-key` | `stores/modules/artistry.ts` |
| `artistry-replicate-default-model` | `stores/modules/artistry.ts` |
| `artistry-replicate-aspect-ratio` | `stores/modules/artistry.ts` |
| `artistry-replicate-inference-steps` | `stores/modules/artistry.ts` |
| `artistry-nanobanana-api-key` | `stores/modules/artistry.ts` |
| `artistry-nanobanana-model` | `stores/modules/artistry.ts` |
| `artistry-nanobanana-resolution` | `stores/modules/artistry.ts` |

### 4.9 Sync Engine

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/sync/enabled` | `boolean` | `false` | `stores/sync-engine.ts` |
| `settings/sync/interval` | `number` | `30` (min) | `stores/sync-engine.ts` |
| `settings/sync/conflict-strategy` | `'lww' \| 'remote-wins'` | `'lww'` | `stores/sync-engine.ts` |
| `settings/sync/active-provider` | `string` | `'local-fs'` | `stores/sync-engine.ts` |
| `settings/sync/fs-path` | `string` | OS-default | `stores/sync-engine.ts` |
| `settings/sync/s3-endpoint` | `string` | `''` | `stores/sync-engine.ts` |
| `settings/sync/s3-bucket` | `string` | `''` | `stores/sync-engine.ts` |
| `settings/sync/s3-region` | `string` | `'us-east-1'` | `stores/sync-engine.ts` |
| `settings/sync/s3-access-key-id` | `string` | `''` | `stores/sync-engine.ts` |
| `settings/sync/s3-secret-access-key` | `string` | `''` | `stores/sync-engine.ts` |
| `settings/sync/last-time` | `number` | `0` | `stores/sync-engine.ts` |

### 4.10 Chat

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/chat/send-mode` | `'enter' \| 'ctrl-enter' \| 'double-enter'` | `'enter'` | `stores/settings/chat.ts` |
| `settings/chat/stream-idle-timeout-ms` | `number` | `600000` | `stores/settings/chat.ts` |
| `settings/chat/show-director-notes` | `boolean` | `true` | `stores/settings/chat.ts` |
| `settings/chat/combine-system-messages` | `boolean` | `false` | `stores/settings/chat.ts` |
| `chat/messages/v2` | (chat history) | — | `stores/chat/constants.ts` |
| `chat/active-session` | `string` | — | `stores/chat/constants.ts` |

### 4.11 Control Strip

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/control-strip/orientation` | `'vertical' \| 'horizontal'` | `'vertical'` | `stores/settings/control-strip.ts` |
| `settings/control-strip/stage-mode` | `'positionMode' \| 'dragMode' \| 'tactileMode' \| 'orbitMode'` | `'tactileMode'` | `stores/settings/control-strip.ts` |
| `settings/control-strip/advanced-positioning-open` | `boolean` | `false` | `stores/settings/control-strip.ts` |
| `settings/control-strip/background-tint` | `string` (hex) | `'#171717'` | `stores/settings/control-strip.ts` |
| `settings/control-strip/collapsed` | `boolean` | `false` | `stores/settings/control-strip.ts` |
| `settings/control-strip/selfie-include-bg` | `boolean` | `true` | `stores/settings/control-strip.ts` |
| `settings/control-strip/buttons` | `ControlStripButton[]` | default catalog | `stores/settings/control-strip.ts` |
| `settings/control-strip/buttons-version` | `string` | `'v4'` | `stores/settings/control-strip.ts` |
| `settings/controls-island/icon-size` | `'auto' \| 'large' \| 'small'` | `'auto'` | `stores/settings/controls-island.ts` |
| `controls-island/fade-on-hover-enabled` | `boolean` | `false` | `stores/settings/controls-island.ts` |

### 4.12 Captions

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/captions/enabled` | `boolean` | `true` | `stores/settings/captions.ts` |
| `settings/captions/font-size` | `number` | `100` | `stores/settings/captions.ts` |
| `settings/captions/opacity` | `number` | `20` | `stores/settings/captions.ts` |
| `settings/captions/docking` | `CaptionDocking` | `'bottom'` | `stores/settings/captions.ts` |
| `settings/captions/follow-stage` | `boolean` | `false` | `stores/settings/captions.ts` |
| `settings/captions/layout-mode` | `CaptionLayoutMode` | `'single'` | `stores/settings/captions.ts` |
| `settings/captions/reset-trigger` | `number` | `0` | `stores/settings/captions.ts` |

### 4.13 Live2D

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/live2d/disable-focus` | `boolean` | `false` | `stores/settings/live2d.ts` |
| `settings/live2d/follow-speed` | `number` | `0.5` | `stores/settings/live2d.ts` |
| `settings/live2d/idle-animation-enabled` | `boolean` | `true` | `stores/settings/live2d.ts` |
| `settings/live2d/auto-blink-enabled` | `boolean` | `true` | `stores/settings/live2d.ts` |
| `settings/live2d/force-auto-blink-enabled` | `boolean` | `false` | `stores/settings/live2d.ts` |
| `settings/live2d/shadow-enabled` | `boolean` | `true` | `stores/settings/live2d.ts` |
| `settings/live2d/max-fps` | `number` | `0` | `stores/settings/live2d.ts` |

### 4.14 Spine

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/spine/premultiplied-alpha` | `boolean` | `true` | `stores/settings/spine.ts` |
| `settings/spine/default-mix` | `number` | `0.2` | `stores/settings/spine.ts` |
| `settings/spine/idle-enabled` | `boolean` | `true` | `stores/settings/spine.ts` |
| `settings/spine/max-fps` | `number` | `0` | `stores/settings/spine.ts` |
| `settings/spine/render-scale` | `number` | `1` | `stores/settings/spine.ts` |

### 4.15 MMD

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/mmd/idle-enabled` | `boolean` | `true` | `stores/settings/mmd.ts` |
| `settings/mmd/render-scale` | `number` | `1` | `stores/settings/mmd.ts` |

### 4.16 Model Positioning

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `settings/positioning/models` | `Record<string, PositionScale>` | `{}` | `stores/settings/positioning.ts` |

### 4.17 Provider Credentials & State

| Key | Type | File |
| :--- | :--- | :--- |
| `settings/credentials/providers` | `Record<string, Record<string, unknown>>` | `stores/providers.ts` |
| `settings/providers/added` | `Record<string, boolean>` | `stores/providers.ts` |
| `settings/providers/runtime` | `Record<string, ProviderRuntimeState>` | `stores/providers.ts` |

### 4.18 Onboarding

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `onboarding/completed` | `boolean` | `false` | `stores/onboarding.ts` |
| `onboarding/skipped` | `boolean` | `false` | `stores/onboarding.ts` |

### 4.19 Dating Sim / Producer

| Key | Type | Default | File |
| :--- | :--- | :--- | :--- |
| `airi:producer:context-depth` | `number` | `6` | `stores/dating-sim.ts` |
| `airi:dating-sim:game-mode` | `'open_ended' \| 'goal_driven'` | `'goal_driven'` | `stores/dating-sim.ts` |
| `airi:dating-sim:show-choice-weights` | `boolean` | `false` | `stores/dating-sim.ts` |
| `airi:dating-sim:max-score` | `number` | `15` | `stores/dating-sim.ts` |
| `airi:dating-sim:max-turns-temp` | `number` | `18` | `stores/dating-sim.ts` |
| `airi:dating-sim:scenery-route` | `'background' \| 'widget' \| 'bg_widget' \| 'inherit'` | `'inherit'` | `stores/dating-sim.ts` |

### 4.20 Other localStorage Keys

| Key | Type | File |
| :--- | :--- | :--- |
| `airi-card-active-id` | `string` (default `'default'`) | `stores/modules/airi-card.ts` |
| `airi-card/is-model-sync-prevented` | `boolean` | `stores/modules/airi-card.ts` |
| `stickers/library-v2` | `StickerMetadata[]` | `stores/stickers.ts` |
| `stickers/standalone-mode` | `boolean` | `stores/stickers.ts` |
| `settings/stage/view-controls-enabled` | `boolean` | `stores/settings/stage-model.ts` |
| `settings/mcp/server-cmd` | `string` | `stores/mcp.ts` |
| `settings/mcp/server-args` | `string` | `stores/mcp.ts` |
| `mcp/connected` | `boolean` | `stores/mcp.ts` |
| `settings/backup/enabled` | `boolean` | `stores/backup.ts` |
| `settings/backup/path` | `string` | `stores/backup.ts` |
| `settings/backup/last-time` | `number` | `stores/backup.ts` |
| `settings/connection/websocket-url` | `string` | `packages/stage-pages/.../ConnectionSettings.vue` |
| `settings/connection/auth-token` | `string` | `packages/stage-pages/.../ConnectionSettings.vue` |
| `settings/connection/hf-token` | `string` | `packages/stage-pages/.../ConnectionSettings.vue` |
| `airi:context-width-map` | `string` (JSON) | `packages/stage-pages/.../CardCreationTabGeneration.vue` |
| `airi-chatbox-draft` | `string` | `apps/stage-tamagotchi/.../InteractiveArea.vue` |
| `vhack_gemini_api_key` | `string` | `stores/vhack.ts` |
| `vhack_gemini_model` | `string` | `stores/vhack.ts` |
| `vhack_gemini_res` | `string` | `stores/vhack.ts` |
| `lhack_gemini_api_key` | `string` | `stores/lhack.ts` |
| `lhack_gemini_model` | `string` | `stores/lhack.ts` |
| `lhack_gemini_res` | `string` | `stores/lhack.ts` |
| `airi_cc_{sha256hash}` | `string` (JSON, cached color data) | `libs/character-media-resolver.ts` |
| `airi:debug` | `'1'` (string flag) | `stores/providers/helpers.ts` |

---

## 5. IndexedDB — Search Index (Separate DB)

| Attribute | Value |
| :--- | :--- |
| **Key** | `snapshot` |
| **Database** | `airi-search-index` (separate IndexedDB instance, not `unstorage`) |
| **File** | `packages/stage-ui/src/libs/search/layered-memory.ts` |
| **Type** | Search index snapshot |
| **Sync** | **Not synced** |
| **Size** | Varies |

This is a local-only search index for memory retrieval and is rebuilt on each device independently.

---

## 6. Sync Engine — Merge Strategies

All sync logic lives in `packages/stage-ui/src/stores/sync-engine.ts`.

### Strategy Types

| Strategy | Behavior |
| :--- | :--- |
| `'lww'` | Last-Writer-Wins — compares `mtime` timestamps |
| `'remote-wins'` | Remote always overwrites local |

### Mergeable Keys (custom merge logic)

These keys are merged rather than blindly replaced:

| Key | Merge Function | Strategy |
| :--- | :--- | :--- |
| `local:airi-cards` | `mergeAiriCards()` | Per-card `updatedAt`/`createdAt` timestamp LWW |
| `local:chat/index/{userId}` | `mergeChatIndices()` | Per-character, per-session timestamp LWW |
| `local:memory/short-term/{userId}` | `mergeArraysById()` | Array merge by `id`, timestamp LWW |
| `local:memory/text-journal/{userId}` | `mergeArraysById()` | Array merge by `id`, timestamp LWW |
| `local:memory/echo-chips/{userId}` | `mergeArraysById()` | Array merge by `id`, timestamp LWW |
| `local:chat/sessions/{sessionId}` | `mergeArraysById()` + `resolveConflict()` | Message-level merge with contraction safety |

### Safety Heuristics

- **Contraction detection**: If a replace would reduce a >10 KB dataset by >5x or below 2 KB, the operation is **blocked** and a conflict is created
- **Conflict storage**: `local:sync-metadata/conflicts/{key}` — manual resolution via UI (Keep Local / Keep Remote / Merge)
- **Monitored keys**: `local:chat/sessions/`, `local:characters`, `local:localstorage/`, `local:director/sessions/`, `local:chat/index/`

### Binary Asset Reconciliation

These bypass the `storage` outbox and are reconciled by dedicated functions:

| Function | Asset Type | Remote Path |
| :--- | :--- | :--- |
| `reconcileBackgrounds()` | Background images | `assets/backgrounds/{id}.json` + `assets/backgrounds/{id}.png` |
| `reconcileModels()` | Display models | `assets/models/manifest.json`, `assets/models/{id}.bin`, `assets/models/{id}-textures.json`, `assets/models/{id}-preview.png` |

---

## 7. Sync Backend Contract

### Remote File Structure

```
db/{namespace}/{path}.json            (e.g. db/chat/index/local.json)
assets/backgrounds/{id}.json
assets/backgrounds/{id}.png
assets/models/manifest.json
assets/models/{id}.bin
assets/models/{id}-textures.json
assets/models/{id}-preview.png
sync-engine-debug.log
```

### StorageClient Interface

```typescript
// File: packages/stage-ui/src/stores/sync-engine.ts

interface StorageClient {
  validate: () => Promise<{ success: boolean, error?: string }>
  listFiles: () => Promise<{ success: boolean, files?: Array<{ relPath: string, mtime: number, size: number }>, error?: string }>
  readFile: (relPath: string, encoding?: 'utf-8' | 'base64') => Promise<{ success: boolean, content?: string, error?: string }>
  writeFile: (relPath: string, content: string, encoding?: 'utf-8' | 'base64', append?: boolean) => Promise<{ success: boolean, mtime?: number, error?: string }>
  deleteFile: (relPath: string) => Promise<{ success: boolean, error?: string }>
}
```

Providers implementing this interface:
- **Local filesystem** (`ElectronFSClient`) — Electron-only, uses IPC to main process
- **S3-compatible** (`S3StorageClient`) — browser + Electron, uses native `fetch` + `DOMParser`

---

## 8. Cross-Store Reference Relationships

When the selective sync UI builds a "select by character" tree, it needs to walk semantic links between stores at runtime — **not** by storing redundant foreign keys, but by following existing reference chains. Below is every relationship chain that matters for selective sync, with the traversal path and any lookups needed to resolve labels → IDs.

### 8.1 Character → AIRI Card

This is the root of the tree — selecting a character filters everything below it.

```
charactersRepo (local:characters)                    → Character[].id
airiCardStore  (local:airi-cards)                    → AiriCard.id matches characterId
```

**Lookup:** `AiriCard` has no direct `characterId` — the `AiriCard.id` serves as the character identifier. Cards can exist without a matching `local:characters` entry (user-created vs. community catalog).

### 8.2 Character → Chat Sessions

```
characterId
  → local:chat/index/{userId}.characters[characterId].sessions[*]
    → local:chat/sessions/{sessionId}
```

**Lookup:** The session index already organizes sessions by `characterId` — this is the cheapest relationship to resolve.

### 8.3 Character → Memory (Short-Term, Text Journal, Echo Chips)

```
characterId
  → local:memory/short-term/{userId}[*].characterId === characterId
  → local:memory/text-journal/{userId}[*].characterId === characterId
  → local:memory/echo-chips/{userId}[*].characterId === characterId
```

**Lookup:** Every memory entry stores `characterId` directly. Iteration required (filter by characterId).

### 8.4 Character → Lifetime Memory

```
characterId
  → local:memory/lifetime/{characterId}   (keyed by characterId)
```

**Lookup:** Direct key access — the key itself is the characterId.

### 8.5 Character → Display Model

```
airiCard.extensions.airi.modules.displayModelId
  → localforage display-model-{modelId}
  → OR localforage {modelId}   (URL-based models stored by raw ID)
```

**Lookup:** The card's `displayModelId` is optional. If set, it can resolve to either a `DisplayModelFile` (imported file) or a `DisplayModelURL` (remote URL). The current `DisplayModel` interface has no `characterId` field — the only link is through the card.

**Note for selective sync:** Models can be shared across characters. The sync tree should display them once and mark them as "also used by: [other chars]" rather than duplicating.

### 8.6 Character → Background Images

```
airiCard.extensions.airi.modules.activeBackgroundId
  → localforage bg-{backgroundId}
```

Or via `visual_assets`:

```
airiCard.extensions.airi.visual_assets[*].manifestation.backgroundId
  → localforage bg-{backgroundId}
```

And from the image journal:

```
airiCard.extensions.airi.imageJournal.selfie
  → BackgroundEntry[].characterId === characterId   (type: 'selfie')
```

**Lookup:** Backgrounds also store `characterId` directly on the `BackgroundEntry`, so selfies and character-generated scenes can be found by direct filter.

### 8.7 Character → Voice Profile → Cloned Audio (The Full Chain)

This is the chain you're most concerned about for selective sync. It requires multiple hops and a **provider-level label lookup**, but no model changes.

```
Step 1: character → card → speech config
  airiCard.extensions.airi.modules.speech.voice_id
    → VoiceProfile.id  (from localStorage: settings/speech/voice-profiles[])

Step 2: resolve the profile
  VoiceProfile {
    id: string
    name: string           ← user-facing label
    baseProvider: string   ← e.g. 'moss-nano-local'
    baseModel: string
    baseVoice: string      ← this stores the voice CLONE LABEL for MOSS
    ...
  }

Step 3: resolve provider-side audio reference
  IF baseProvider === 'moss-nano-local':
    baseVoice (a label string like "My Voice Clone")
    → MOSS provider internal map: label → referenceAudioId
      (this map lives in provider metadata, not in the VoiceProfile model)
    → local:voice-profiles/{referenceAudioId}  (metadata)
    → localforage/{referenceAudioId}            (audio blob)
```

**Why no model change is needed:**

| What | Stores | How resolved |
| :--- | :--- | :--- |
| Label | `VoiceProfile.baseVoice` (already a string) | Comes from the provider's `listVoices()` output |
| referenceAudioId | MOSS provider's internal registry | `provider.getVoiceMeta(label).referenceAudioId` |
| Blob | `local:voice-profiles/{id}` | BYOS-tracked, keyed by referenceAudioId |
| Name | Profile name | User-set when uploading |

The selective sync UI would:
1. Load all `VoiceProfile` entries
2. Filter to those with `baseProvider === 'moss-nano-local'`
3. Call the MOSS provider's metadata API to get `label → audioId` mapping
4. Walk `airiCard → voice_id → baseVoice → audioId` for each card
5. Build the tree: character ☑ → voice profile ☑ → audio file ☑

This is all **derived at query time** — no stale references, no model migration.

### 8.8 Character → Visual Assets (Artistry-Generated)

```
airiCard.extensions.airi.visual_assets[*]
  → Each asset has a `manifestation` with optional:
    - modelId         → display-model-{modelId}
    - backgroundId    → bg-{backgroundId}
    - active_expressions
```

**Lookup:** Visual assets are embedded in the card itself — no additional store traversal needed for the metadata. If the referenced `backgroundId` or `modelId` is an imported asset, it would be in localforage.

### 8.9 Stickers → Character

```
stickerMetadata.characterId === characterId
  → localforage sticker-data-{stickerId}
```

**Lookup:** `StickerMetadata` already has an optional `characterId` field. If set, stickers are directly filterable by character.

### 8.10 Summary: The "Select by Character" Tree

When a user selects a character in the selective sync UI, the runtime tree builder would walk these chains and pre-check these store categories:

```
☐ Character "Asuka"
  ├── ☐ AIRI Card (local:airi-cards — always synced, small)
  ├── ☐ Chat Sessions (local:chat/sessions/* — filtered by characterId)
  ├── ☐ Long-Term Memory (local:memory/text-journal/*)
  ├── ☐ Short-Term Memory (local:memory/short-term/*)
  ├── ☐ Lifetime Memory (local:memory/lifetime/{characterId})
  ├── ☐ Echo Chips (local:memory/echo-chips/*)
  ├── ☐ Director Notes (local:director/sessions/*)
  ├── ─── ─── ASSETS ─── ───
  ├── ☐ Display Model  (via card.displayModelId → localforage)   [large]
  │     └── Also used by: [character A, character B]
  ├── ☐ Background Images (via card.activeBackgroundId + visual_assets → localforage)  [large]
  ├── ☐ Stickers (stickerMetadata.characterId → localforage)     [medium]
  ├── ─── ─── VOICE ─── ───
  ├── ☐ Voice Profile (settings/speech/voice-profiles[])
  │     └── ☐ Cloned Audio File (via MOSS label lookup → localforage)  [large]
  └── ─── ─── DERIVED ─── ───
      └── (Search Index — always rebuilt locally, never synced)
```

The derived category is the key insight — it's marked as always excluded because the search index (`airi-search-index`) is rebuilt per-device and has no value in being synced.

### 8.11 Runtime Lookup Cost

| Chain | Lookups Required | Cost |
| :--- | :--- | :--- |
| character → card | 1 (keyed by id) | O(1) |
| character → sessions | 1 (index already grouped) | O(1) per character |
| character → memory | filter by characterId | O(n) per store |
| character → display model | 1 keyed lookup | O(1) |
| character → backgrounds | 1 keyed + optional filter | O(1) + O(n) |
| character → voice → audio | 1 profile lookup + 1 provider API call | O(1) both |
| character → stickers | filter by characterId | O(n) |

The heaviest operation would be iterating memory stores by characterId, but that's already something the memory stores do internally. The tree builder can cache the map once and re-use it across the session.

---

## 9. Not-Yet-Synced (Future Selective Sync Candidates)

These stores exist but are NOT currently tracked by BYOS. They would need new entries in the Data Inventory and dedicated reconciliation logic (or be added to the existing outbox-based pattern):

| Store | Location | Reason Not Synced |
| :--- | :--- | :--- |
| **Stickers** (`sticker-data-*`) | `localforage` + localStorage | Binary assets, no reconciliation function yet |
| **Custom VRM Animations** (`custom-vrma-animation-*`) | `localforage` | Niche feature, no sync demand yet |
| **Search Index** (`airi-search-index`) | Separate IndexedDB | Rebuildable per-device, no value in syncing |
| **Dating Sim / Producer State** | localStorage | Ephemeral session state |
| **MCP Config** | localStorage | Machine-specific paths |
| **V-Hack / L-Hack Keys** | localStorage | Credentials, not intended for sync |

### Proposed: Voice Profiles Store

When implementing MOSS-TTS-Nano voice cloning, the voice profile store should follow the existing BYOS asset pattern:

| Component | Pattern | Example |
| :--- | :--- | :--- |
| **Metadata** | `local:voice-profiles/{profileId}` | JSON with `id`, `name`, `createdAt`, `durationMs`, `sampleRate`, `sourceFilename`, `sha256` |
| **Blob** | `assets/voice-profiles/{profileId}.{ext}` | Raw audio file (e.g. .ogg, .wav) |
| **Sync** | Via `storage` outbox (metadata) + dedicated reconciliation (binary) | Follows Background/Display Model pattern |
| **Selective Sync** | Flag as a selectively-syncable category (can be large) | User opt-in during sync |

---

## 10. Index of Key Files

### Persistence Layer
| File | Role |
| :--- | :--- |
| `packages/stage-ui/src/database/storage.ts` | Core `unstorage` setup + outbox monkey-patch |
| `packages/stage-ui/src/database/repos/characters.repo.ts` | Character catalog repo |
| `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` | Chat session index + records repo |
| `packages/stage-ui/src/database/repos/text-journal.repo.ts` | Long-term memory repo |
| `packages/stage-ui/src/database/repos/short-term-memory.repo.ts` | Short-term memory repo |
| `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts` | Lifetime memory artifact repo |
| `packages/stage-ui/src/database/repos/provisioning-session.repo.ts` | Provisioning session repo |
| `packages/stage-ui/src/database/repos/echo-chips.repo.ts` | Echo chips repo |
| `packages/stage-ui/src/database/repos/director-notes.repo.ts` | Director notes repo |
| `packages/stage-ui/src/database/repos/providers.repo.ts` | Provider catalog repo |

### Sync Engine
| File | Role |
| :--- | :--- |
| `packages/stage-ui/src/stores/sync-engine.ts` | Sync orchestrator, merge logic, `StorageClient` interface |

### Stores (non-exhaustive, key stores only)
| File | Namespace |
| :--- | :--- |
| `packages/stage-ui/src/stores/modules/airi-card.ts` | AIRI cards |
| `packages/stage-ui/src/stores/modules/consciousness.ts` | Consciousness settings |
| `packages/stage-ui/src/stores/modules/speech.ts` | Speech settings |
| `packages/stage-ui/src/stores/modules/hearing.ts` | Hearing settings |
| `packages/stage-ui/src/stores/modules/vision.ts` | Vision settings |
| `packages/stage-ui/src/stores/modules/discord.ts` | Discord settings |
| `packages/stage-ui/src/stores/modules/artistry.ts` | Artistry settings |
| `packages/stage-ui/src/stores/memory-text-journal.ts` | Text journal store |
| `packages/stage-ui/src/stores/memory-short-term.ts` | Short-term memory store |
| `packages/stage-ui/src/stores/memory-lifetime.ts` | Lifetime memory store |
| `packages/stage-ui/src/stores/echo-chips.ts` | Echo chips store |
| `packages/stage-ui/src/stores/background.ts` | Background images (localforage) |
| `packages/stage-ui/src/stores/display-models.ts` | Display models (localforage) |
| `packages/stage-ui/src/stores/stickers.ts` | Stickers (localforage + localStorage) |
| `packages/stage-ui/src/stores/providers.ts` | Provider registry & credentials |
| `packages/stage-ui/src/stores/chat/session-store.ts` | Chat sessions |
| `packages/stage-ui/src/stores/dating-sim.ts` | Dating sim state |

### Types
| File | Key Types |
| :--- | :--- |
| `packages/stage-ui/src/types/character.ts` | `Character`, `Card` |
| `packages/stage-ui/src/stores/modules/airi-card.ts` | `AiriCard`, `AiriExtension`, `HeartbeatConfig`, `DreamStateConfig`, `ActingConfig`, `AiriOutfit`, `CharacterGenerationConfig` |
| `packages/stage-ui/src/stores/providers/types.ts` | `ProviderMetadata`, `ModelInfo`, `VoiceInfo`, `VoiceProfile`, `ProviderRuntimeState` |
| `packages/stage-ui/src/stores/display-models.ts` | `DisplayModelFormat`, `DisplayModelFile`, `DisplayModelURL` |
| `packages/stage-ui/src/stores/background.ts` | `BackgroundEntry` |
| `packages/stage-ui/src/stores/stickers.ts` | `StickerMetadata`, `StickerPlacement` |
| `packages/stage-ui/src/stores/sync-engine.ts` | `StorageClient`, conflict types |

---

> **Maintainer note**: This document should be updated whenever a new `local:*` namespace, `localforage` key pattern, or significant localStorage key is added to the codebase. When implementing selective sync, reference Section 6 (Merge Strategies) to determine how each key should be handled, and Section 8 (Cross-Store Reference Relationships) for the runtime tree-building chains, and Section 9 (Not-Yet-Synced) for candidates needing reconciliation logic.
