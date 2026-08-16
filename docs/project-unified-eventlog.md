# Specification: Unified System Event Log & Stream ("AIRI Event Ledger")

**Status:** Approved Core Architecture Specification · **Target Area:** `packages/stage-ui/src/stores/event-log.ts` & `packages/stage-layouts/src/components/Widgets/ChatArea.vue` (Left Drawer UI)

---

## 1. Executive Summary & Core Philosophy

Currently, AIRI's awareness mechanisms rely on fragmented, feature-specific "intrusion" hacks (e.g., Journal Intrusions, Dreaming Intrusions) to keep the stateless LLM informed of recent actions without bloating main chat history. While effective in isolation, this approach leaves critical gaps—such as autonomous MCP tool executions during heartbeats, screen perception events, and speech state shifts—hidden behind separate siloes.

The **Unified System Event Log ("AIRI Event Ledger")** establishes a single, high-density, structured event stream for the entire application. Every promoted action, perception event, tool call, memory write, and telemetry shift appends to a central log.

### Core Architectural Principles:
1. **Natural Language Density**: Events are formatted into clean, 1-line natural language sentences (`formatNaturalLanguage(event)`). Sampling 20 events for an LLM context payload consumes only ~200–300 tokens total.
2. **Dual Representation (AI Context vs. UI Debugger)**:
   - **LLM Sensor Stream**: Receives *only* the natural text summary (`"Active Window: VS Code — Noticed TypeScript error on line 42"`).
   - **UI Drawer Inspector**: Users can toggle inspectable details (`inspectable: true`) to view raw parameters when debugging.
3. **Strict Curation (Zero Internal Noise / Zero Pipeline Spam)**:
   - Rejects Stage 0 pixel deltas, Stage 1 vector math, VAD audio chunks, model attach loops, and BroadcastChannel IPC plumbing. Only meaningful cognitive or operational events are logged.

---

## 2. UI Surface Location: Chat Drawer Event Log Inspector

The primary UI surface for inspecting, filtering, and watching the Unified Event Stream is embedded directly into the **Left Slide-Over Drawer of the Chat Area UI** (`packages/stage-layouts/src/components/Widgets/ChatArea.vue`), accessible by clicking the hamburger icon (`☰`) at the top left of the chat surface.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ☰ AIRI Chat Surface                                                 [⚙] [✕] │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ 📜 UNIFIED EVENT LEDGER          │                                         │
│ [ Search events...      ] [Filter]│ 💬 Main Roleplay & Conversation Surface │
│ ───────────────────────────────── │                                         │
│ 🟣 10:51 AM [Vision]             │  Assistant:                             │
│   Active Window: VS Code          │  "Hello there! ✨ Floating with AIRI!   │
│   └─► Noticed error on line 42    │   I noticed that terminal error on line │
│                                   │   42, would you like me to inspect it?" │
│ 🟢 10:50 AM [Memory]              │                                         │
│   Saved text journal moment       │                                         │
│   └─► "Fixed 3D perspective skew" │                                         │
│                                   │                                         │
│ 🔵 10:48 AM [Tools]               │                                         │
│   Executed mcp::read_file         │                                         │
│   └─► Read contract.ts (145 lines)│                                         │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### Drawer UI Features:
* **Live Streaming Stream**: Real-time auto-scroll as events fire in the background.
* **Category Filtering Badges**: Toggle visibility by domain (`Vision`, `Tools`, `Chat`, `Proactivity`, `Memory`, `Stage`, `Discord`).
* **Inspectable Payload Toggle**: Expand any event row to view raw parameters if marked inspectable.
* **Search Bar**: Instant keyword filtering across natural language strings.

---

## 3. Curated Event Catalog by Domain & Live Implementation Status

Every event adheres to a clean TypeScript interface:

```ts
export type EventCategory = 'vision' | 'tools' | 'chat' | 'proactivity' | 'memory' | 'stage' | 'discord'

export interface AiriSystemEvent<T = Record<string, unknown>> {
  id: string // UUIDv4
  timestamp: number // Unix epoch ms
  isoTime: string // ISO timestamp
  category: EventCategory // Bucket domain
  type: string // Specific event type identifier
  source: string // Subsystem origin (e.g. 'mcp:desktop', 'attention-ecology')
  textSummary: string // Natural language 1-line text sentence for LLM stream
  payload?: T // Lightweight stable keys only ({ id, title, source, characterId })
  inspectable?: boolean // Whether raw payload can be expanded in UI drawer
}
```

### 📋 Curated Domain Event Specifications & Implementation Status:

#### 1. Memory & Journaling (`[Memory]`)
*High-value memory milestones and introspections.*
* **`memory:text_journal`** — `[Memory] Saved text journal entry: "{title}"`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/memory-text-journal.ts:createEntry`)
  * **Summary:** `Saved text journal entry: "Fixed 3D perspective skew math"`
  * **Payload:** `{ id, title, source, characterId }`
* **`memory:image_journal`** — `[Memory] Generated image journal artwork: "{title}"`
  * **Status:** ✅ **COMPLETED** (Centralized at `backgroundStore.addBackground` & `image-journal.ts`)
  * **Summary:** `Generated image journal artwork: "Cyberpunk desk with Live2D character"`
  * **Payload:** `{ id, title, mode, characterId }`
* **`memory:dream_consolidated`** — `[Memory] Dream state consolidated: synthesized {count} echo chips ({richness})`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/proactivity.ts:evaluateDreamState`)
  * **Summary:** `Dream state consolidated: synthesized 4 echo chips (balanced)`
  * **Payload:** `{ characterId, chipCount, richness, lastTurnAt }`
* **`memory:lifetime_updated`** — `[Memory] Updated Lifetime Memory Artifact (version {v})`
  * **Status:** ⏸️ **DEFERRED** (Pending dedicated Lifetime Memory architecture & design document)

#### 2. User & Assistant Dialogue (`[Chat]`)
*High-level conversation markers with source tag differentiation (text, voice STT, Discord).*
* **`chat:user-message-ingested`** — `[Chat] User: "{textSnippet}"`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/chat.ts:ingest`)
  * **Summary:** `User: "Can you help me check this code?"`
  * **Payload:** `{ role: 'user', messageId, source: 'text', timestamp }`
* **`chat:user-voice-ingested`** — `[Chat] User (voice): "{textSnippet}"`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/chat.ts:ingest`)
  * **Summary:** `User (voice): "Good morning Kira, how are you?"`
  * **Payload:** `{ role: 'user', messageId, source: 'stt', timestamp }`
* **`chat:user-discord-ingested`** — `[Chat] User (@{username} via Discord): "{textSnippet}"`
  * **Status:** ⏳ **PENDING** (To be tagged directly in `chat.ts:ingest` when forwarded from Discord)
  * **Summary:** `User (@Cody via Discord): "Need help with proactivity heartbeats"`
  * **Payload:** `{ role: 'user', messageId, source: 'discord', author: '@Cody' }`
* **`chat:assistant-reply-completed`** — `[Chat] {characterName} replied: "{textSnippet}"`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/chat.ts:performSend`)
  * **Summary:** `Kira replied: "Sure! Let's take a look at the contract file."`
  * **Payload:** `{ role: 'assistant', messageId, timestamp }`

#### 3. Proactivity & Sensor State (`[Proactivity]`)
*Heartbeat outcomes, telemetry gating, and idle-return transitions.*
* **`proactivity:heartbeat_gated`** — `[Proactivity] Proactive heartbeat evaluated: silent (NO_REPLY)`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/proactivity.ts:evaluateHeartbeat`)
  * **Summary:** `Proactive heartbeat evaluated: silent (NO_REPLY)`
  * **Payload:** `{ provider, model, idleSec }`
* **`proactivity:heartbeat_spoke`** — `[Proactivity] {characterName} proactively spoke: "{thoughtSnippet}"`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/proactivity.ts:evaluateHeartbeat`)
  * **Summary:** `Kira proactively spoke: "I noticed you've been focused on TypeScript for a while..."`
  * **Payload:** `{ message, provider, model }`
* **`sensor:user_idle_resumed`** — `[Proactivity] User returned after being idle for {idleMinutes}m`
  * **Status:** ⏳ **PENDING** (`packages/stage-ui/src/stores/proactivity.ts`)
  * **Definition:** Qualified as duration in minutes being idle before activity was restored.
  * **Summary:** `User returned after being idle for 42m`
  * **Payload:** `{ idleMinutes, previousIdleSec, restoredAt }`
* **`sensor:window_transition`** — `[Proactivity] Switched window to {appName} ({windowTitle})`
  * **Status:** ⏳ **PENDING** (`packages/stage-ui/src/stores/proactivity.ts:updateSensors`)

#### 4. Tools & MCP Executions (`[Tools]`)
*Tracks completed or failed tool invocations and notable MCP server connection drops.*
* **`tools:tool-executed`** — `[Tools] Executed {toolName} — Result: {naturalSummary}`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/chat.ts:toolCallQueue`)
  * **Summary:** `Executed mcp::read_file — Result: Read contract.ts (145 lines)`
  * **Payload:** `{ id, toolName, state: 'done' }`
* **`tools:tool-failed`** — `[Tools] Failed {toolName} — Error: {errorMessage}`
  * **Status:** ✅ **COMPLETED** (`packages/stage-ui/src/stores/chat.ts:toolCallQueue`)
  * **Summary:** `Failed mcp::write_file — Error: Permission denied`
  * **Payload:** `{ id, toolName, state: 'error' }`
* **`mcp:server_status`** — `[Tools] MCP Server '{serverName}' {status: crashed/disconnected/reconnected}`
  * **Status:** ⏳ **PENDING** (`apps/stage-tamagotchi/src/main/services/airi/mcp-servers/index.ts`)
  * **Discipline:** Strictly non-spammy; emits only on unexpected disconnects, errors, or manual reconnections (no startup spam).

#### 5. Visual Attention & Perception (`[Vision]`)
*Promoted high-salience screen events.*
* **`vision:promoted_event`** — `[Vision] Active Window: {windowTitle} — {vlmCaption}`
  * **Status:** ⏸️ **DEFERRED** (Scheduled for Screen Watching Phase 3)

#### 6. Stage & Scene (`[Stage]`)
*Presence, avatar shifts, and tactile interactions.*
* **`stage:tactile_interaction`** — `[Stage] User {interactionType} character {bodyPart}`
  * **Status:** 💡 **UNDER CONSIDERATION** (For Live2D/VRM models with raycast / hit-testing support)
  * **Summary:** `User patted head` / `User tapped shoulder`
  * **Payload:** `{ modelId, hitArea, interactionType }`
* **`stage:outfit_switched`** — `[Stage] Switched outfit to {outfitName}`
  * **Status:** ⏸️ **DEFERRED**
* **`stage:background_changed`** — `[Stage] Changed scene background to {bgName}`
  * **Status:** ⏸️ **DEFERRED**

#### 7. External Messaging (`[Discord]`)
*User-facing Discord slash commands.*
* **`discord:command_executed`** — `[Discord] Executed slash command /{commandName}`
  * **Status:** ⏳ **PENDING** (`packages/stage-ui/src/stores/modules/discord.ts`)
  * **Summary:** `Executed slash command /vibe`
  * **Payload:** `{ commandName, author, channel }`

---

## 4. Sampling Payload Example for LLM Context

When a proactivity heartbeat ticks or when sampling recent events for context, the store exports a compact block:

```text
[ Unified Event Stream (Last 6 Events) ]
• [10:45 AM] [Chat] User (voice): "Can you help me check this code?"
• [10:48 AM] [Tools] Executed mcp::read_file — Result: Read contract.ts (145 lines)
• [10:50 AM] [Memory] Saved text journal entry: "Fixed 3D perspective skew math"
• [10:52 AM] [Memory] Generated image journal artwork: "Cyberpunk desk scene"
• [10:55 AM] [Proactivity] Proactive heartbeat evaluated: silent (NO_REPLY)
• [11:00 AM] [Memory] Dream state consolidated: synthesized 4 echo chips (balanced)
```

---

## 5. Storage & Persistence Model (IndexedDB via localforage / unstorage)

Events are persisted in IndexedDB under `airi:event-log` with automatic rolling retention:
- **Rolling Window Limit**: 500 events maximum retained in IndexedDB.
- **In-Memory Store**: `useEventLogStore()` holds recent events reactive for UI drawer rendering.
- **Persistence Driver**: Uses localforage / unstorage IndexedDB driver (`createStorage({ driver: indexedbDriver() })`).

---

## 6. BYOS Cloud Sync Engine Integration & Alignment

To ensure multi-device synchronization (e.g., syncing event ledgers between laptop, desktop, or mobile instances) remains perfectly in sync without data loss, race conditions, or infinite loops, the Event Log store integrates directly into AIRI's BYOS (Bring Your Own Storage) Cloud Sync engine (`packages/stage-ui/src/database/storage.ts` & `airi-cloud-relay-infrastructure` skill):

### 6.1 Unstorage Outbox Interceptor & Namespace Binding
- **Namespace Registration**: The event ledger is registered under `event-log:*` inside the unified `unstorage` interceptor in `storage.ts`.
- **Outbox Enqueue**: Local mutations to `local:event-log/*` automatically enqueue sync tasks into `outbox:queue/*` and update modification timestamps under `local:sync-metadata/timestamps/*`.

### 6.2 Item-Level Mergeable Reconciliation Strategy
- **Keyed by Event ID**: Individual event entries are stored as discrete items (`event-log:event:<id>`).
- **Union-Merge by ID**: When reconciling remote cloud events from S3/R2 with local IndexedDB instances, events are union-merged by item ID (`id`) and sorted chronologically by `timestamp`.
- **Bounding Retention Cap**: Both local and remote storage layers enforce a maximum 500-event rolling cap (`maxCapacity = 500`). Events beyond the cap decay naturally without generating deletion conflict noise.

### 6.3 Loop-Prevention Guard (`isImportingRemoteData`)
- During remote cloud sync imports, the storage engine sets `storageState.isImportingRemoteData = true` prior to writing incoming events into IndexedDB.
- This ensures remote events imported from S3/R2 do not re-enqueue into `outbox:queue/*`, preventing infinite upload loops across devices.

---

## 7. Implementation Scorecard & Roadmap

| Domain | Event Type | Target Source | Status |
| :--- | :--- | :--- | :--- |
| **Memory** | `memory:text_journal` | `memory-text-journal.ts:createEntry` | ✅ **DONE** |
| **Memory** | `memory:image_journal` | `backgroundStore.addBackground` & `image-journal.ts` | ✅ **DONE** |
| **Memory** | `memory:dream_consolidated` | `proactivity.ts:evaluateDreamState` | ✅ **DONE** |
| **Memory** | `memory:lifetime_updated` | `memory-lifetime.ts` | ⏸️ **DEFERRED** *(Design doc needed)* |
| **Chat** | `chat:user-message-ingested` | `chat.ts:ingest` (text) | ✅ **DONE** |
| **Chat** | `chat:user-voice-ingested` | `chat.ts:ingest` (STT voice) | ✅ **DONE** |
| **Chat** | `chat:user-discord-ingested` | `chat.ts:ingest` (Discord source tag) | ⏳ **PENDING** |
| **Chat** | `chat:assistant-reply-completed` | `chat.ts:performSend` | ✅ **DONE** |
| **Proactivity** | `proactivity:heartbeat_gated` | `proactivity.ts:evaluateHeartbeat` (`NO_REPLY`) | ✅ **DONE** |
| **Proactivity** | `proactivity:heartbeat_spoke` | `proactivity.ts:evaluateHeartbeat` | ✅ **DONE** |
| **Proactivity** | `sensor:user_idle_resumed` | `proactivity.ts` | ⏳ **PENDING** |
| **Proactivity** | `sensor:window_transition` | `proactivity.ts:updateSensors` | ⏳ **PENDING** |
| **Tools** | `tools:tool-executed` | `chat.ts:toolCallQueue` | ✅ **DONE** |
| **Tools** | `tools:tool-failed` | `chat.ts:toolCallQueue` | ✅ **DONE** |
| **Tools** | `mcp:server_status` | `mcp-servers/index.ts` (Non-spammy) | ⏳ **PENDING** |
| **Vision** | `vision:promoted_event` | `attention-ecology-vision` | ⏸️ **DEFERRED** |
| **Stage** | `stage:tactile_interaction` | Hit-test / Raycast listeners | 💡 **CONSIDERATION** |
| **Stage** | `stage:outfit_switched` | `airi-card.ts` | ⏸️ **DEFERRED** |
| **Stage** | `stage:background_changed` | `background.ts` | ⏸️ **DEFERRED** |
| **Discord** | `discord:command_executed` | `discord.ts` | ⏳ **PENDING** |

---

### Phased Roadmap Milestones:
- [x] **Phase 1: Architecture & Curated Specification** (`docs/project-unified-eventlog.md`).
- [x] **Phase 2: IndexedDB Storage & Pinia Store** (`packages/stage-ui/src/stores/event-log.ts` with localforage persistence & rolling capacity).
- [x] **Phase 3: Live UI Drawer & Sidebar Surface** (`apps/stage-tamagotchi/src/renderer/components/chat/chat_event_log.vue` with search, category filters, and live card inspection).
- [x] **Phase 4: Core Subsystem Event Emitters** (Text Journal, Image Journal, Dream Consolidation, Voice STT, User/Assistant Chat, Heartbeat Gated/Spoke, Tool Execution Success/Failures).
- [ ] **Phase 5: Extended Telemetry & Peripheral Emitters** (`sensor:user_idle_resumed`, Discord source tags, Discord slash commands, non-spammy MCP health).
