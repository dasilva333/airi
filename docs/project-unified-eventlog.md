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

## 3. Curated Event Catalog by Domain

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
  payload?: T // Optional raw data for UI drawer inspection
  inspectable?: boolean // Whether raw payload can be expanded in UI drawer
}
```

### Curated Domain Event Specifications:

#### 1. Visual Attention & Perception (`[Vision]`)
*Only promoted, high-salience events survive.*
- **`vision:promoted_event`**: `[Vision] Active Window: {windowTitle} — {vlmCaption}`
  - *Example*: `[10:51 AM] [Vision] Active Window: VS Code (contract.ts) — Noticed TypeScript error on line 42.`

#### 2. Tools & MCP Executions (`[Tools]`)
*Tracks actual completed or failed actions.*
- **`tool:executed`**: `[Tools] Executed {toolName} — Result: {naturalSummary}`
  - *Example*: `[10:48 AM] [Tools] Executed mcp::read_file on contract.ts — Read 145 lines.`
- **`tool:failed`**: `[Tools] Failed {toolName} — Error: {errorMessage}`
  - *Example*: `[10:49 AM] [Tools] Failed mcp::write_file — Permission denied on /etc/config.`
- **`mcp:server_status`**: `[Tools] MCP Server '{serverName}' {status: connected/disconnected}`
  - *Example*: `[10:40 AM] [Tools] MCP Server 'desktop-automation' connected (4 tools available).`

#### 3. User & Assistant Dialogue (`[Chat]`)
*High-level conversation markers only—no streaming chunks or token arrays.*
- **`chat:user_sent`**: `[Chat] User: "{textSnippet}"`
  - *Example*: `[10:50 AM] [Chat] User: "Can you help me check this code?"`
- **`chat:assistant_responded`**: `[Chat] Assistant: "{textSnippet}"`
  - *Example*: `[10:50 AM] [Chat] Assistant: "Sure! Let's take a look at the contract file."`
- **`chat:producer_choice_selected`**: `[Chat] User selected suggestion: "{choiceLabel}"`
  - *Example*: `[10:52 AM] [Chat] User selected suggestion: "Ask about perspective skew"`

#### 4. Proactivity & Sensor State (`[Proactivity]`)
*Curated window transitions and heartbeat outcomes.*
- **`sensor:window_transition`**: `[Proactivity] Switched window to {appName} ({windowTitle})`
  - *Example*: `[10:45 AM] [Proactivity] Switched window to VS Code (contract.ts)`
- **`sensor:user_idle`**: `[Proactivity] User became AFK / Idle ({idleMinutes}m)`
  - *Example*: `[11:00 AM] [Proactivity] User became AFK (15m idle)`
- **`proactivity:heartbeat_gated`**: `[Proactivity] Heartbeat checked state — Silent (NO_REPLY)`
  - *Example*: `[10:55 AM] [Proactivity] Heartbeat checked state — Silent (NO_REPLY)`
- **`proactivity:heartbeat_spoke`**: `[Proactivity] Heartbeat initiated proactive thought: "{thoughtSnippet}"`
  - *Example*: `[10:58 AM] [Proactivity] Heartbeat initiated proactive thought: "Noticed user has been coding for 1 hour"`

#### 5. Memory & Journaling (`[Memory]`)
*All memory milestones are high-value and retained.*
- **`memory:text_journal`**: `[Memory] Saved text journal entry: "{titleOrSnippet}"`
  - *Example*: `[10:30 AM] [Memory] Saved text journal entry: "Fixed 3D perspective skew math"`
- **`memory:image_journal`**: `[Memory] Generated image journal moment: "{promptSnippet}"`
  - *Example*: `[10:35 AM] [Memory] Generated image journal moment: "Cyberpunk desk with Live2D character"`
- **`memory:lifetime_updated`**: `[Memory] Updated Lifetime Memory Artifact (version {v})`
  - *Example*: `[09:00 AM] [Memory] Updated Lifetime Memory Artifact (version 14)`
- **`memory:dreaming_pass`**: `[Memory] Subconscious dreaming pass completed — Mood shifted to {mood}`
  - *Example*: `[07:00 AM] [Memory] Subconscious dreaming pass completed — Mood shifted to Companionable`

#### 6. Stage & Scene (`[Stage]`)
*Visual character shifts that affect presence.*
- **`stage:outfit_switched`**: `[Stage] Switched outfit to {outfitName}`
  - *Example*: `[10:00 AM] [Stage] Switched outfit to Casual Hoodie`
- **`stage:background_changed`**: `[Stage] Changed scene background to {bgName}`
  - *Example*: `[10:05 AM] [Stage] Changed scene background to Evening Study`
- **`stage:tethered_caption`**: `[Stage] Floating caption displayed: "{captionText}"`
  - *Example*: `[10:52 AM] [Stage] Floating caption displayed: "Hello there! ✨ Floating with AIRI! 💖🌸"`

#### 7. External Messaging (`[Discord]`)
*Only user-facing external communications.*
- **`discord:message_received`**: `[Discord] Received message from @{author} in #{channel}: "{textSnippet}"`
  - *Example*: `[08:25 AM] [Discord] Received message from @Cody in #general: "Need help with proactivity heartbeats"`
- **`discord:command_executed`**: `[Discord] Executed slash command /{commandName}`
  - *Example*: `[08:26 AM] [Discord] Executed slash command /vibe`

---

## 4. Sampling Payload Example for LLM Context

When a proactivity heartbeat ticks or when sampling recent events for context, the store exports a compact block:

```text
[ Unified Event Stream (Last 6 Events) ]
• [10:45 AM] [Proactivity] Switched window to VS Code (contract.ts)
• [10:48 AM] [Tools] Executed mcp::read_file on contract.ts — Read 145 lines.
• [10:50 AM] [Memory] Saved text journal entry: "Fixed 3D perspective skew math"
• [10:51 AM] [Vision] Active Window: VS Code — Noticed TypeScript error on line 42.
• [10:52 AM] [Stage] Floating caption displayed: "Hello there! ✨ Floating with AIRI! 💖🌸"
• [10:55 AM] [Proactivity] Heartbeat checked state — Silent (NO_REPLY)
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

## 7. Phased Implementation Roadmap

- [x] **Phase 1: Architecture & Curated Specification** (`docs/project-unified-eventlog.md`).
- [ ] **Phase 2: IndexedDB Storage & Pinia Store with BYOS Interceptor** (`packages/stage-ui/src/stores/event-log.ts` with localforage/unstorage persistence & cloud sync outbox alignment).
- [ ] **Phase 3: Chat Area Left Drawer UI Surface** (`packages/stage-layouts/src/components/Widgets/ChatArea.vue` slide-over drawer with search, category filters, and live event cards).
- [ ] **Phase 4: Seed Initial Test Emitters** (Wire `stage:tethered_caption` and `chat:user_sent` to verify live streaming into the UI drawer).
- [ ] **Phase 5: Full Subsystem Event Wiring & Dual Push/Pull Integration** (Connect Attention Ecology promoted events, MCP tool calls, memory writes, and proactivity heartbeats).
