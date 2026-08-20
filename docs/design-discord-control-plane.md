# Design Document: Unified Discord Control Plane & Edge Relay Architecture

**Status:** Updated Architectural Blueprint & Workspace Package Specification (`apps/stage-edge`)
**Authors:** AIRI Team & AI Assistant
**Target Workspace:** `apps/stage-edge/` & `packages/stage-pages/src/pages/settings/modules/discord.vue`
**Related Docs:**
- [`design-cloud-relay.md`](./design-cloud-relay.md) — Architectural specification for always-on Cloudflare Worker character presence.
- [`cloud-relay-worker.js`](./cloud-relay-worker.js) — The 5,700-line monolithic Cloudflare Worker reference implementation.
- [`design-discord-context-routing.md`](./design-discord-context-routing.md) — Channel context routing (`channel-{id}`, `dm-{userId}`), DM privacy isolation, and Access Control List (ACL) permission matrix.
- [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md) — BYOS Cloud Sync engine.

---

## 1. Vision & Executive Summary

AIRI is transitioning from a **local-only desktop runtime** to a **unified character authoring studio & edge control plane**.

While local desktop execution offers high-fidelity Live2D/VRM stage rendering and local inference, users who are mobile or away from their PCs lose 24/7 access to their characters.

To turn AIRI into a **"Vercel for AI Characters"**, we decouple the 5,700-line Cloudflare Worker monolith into a dedicated monorepo workspace package at **`apps/stage-edge`** (`@proj-airi/stage-edge`).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 💬 Discord Integration & Cloud Control Plane                                    │
├───────────────────────────┬───────────────────────────┬─────────────────────────┤
│ 🔌 Bot Connection         │ 🌐 Cloud Relay Studio     │ 🔐 Access & Routing     │
│   (Local Runtime & Tokens)│   (Vercel for Characters) │   (Channel ACL Matrix)  │
└───────────────────────────┴───────────────────────────┴─────────────────────────┘
```

---

## 2. Workspace Project Architecture (`apps/stage-edge`)

`apps/stage-edge` is structured into modular TypeScript subsystems, built via `tsdown` into a standalone, zero-dependency Cloudflare Worker bundle:

```
apps/stage-edge/
├── package.json                    ← @proj-airi/stage-edge
├── tsconfig.json                   ← ES2022 / Cloudflare Worker types
├── wrangler.json.example           ← Committed template for deployment & local dev
├── .gitignore                      ← Ignores wrangler.json & dist/
├── tsdown.config.ts                ← Bundles TS modules into standalone worker.js
├── src/
│   ├── index.ts                    ← Cloudflare Worker fetch handler
│   ├── crypto/
│   │   └── ed25519.ts              ← Ed25519 signature verification
│   ├── discord/
│   │   ├── client.ts               ← REST & webhook formatters
│   │   ├── router.ts               ← Command & DM interaction routing
│   │   └── acl.ts                  ← Access control permission matrix
│   ├── memory/
│   │   ├── kv.ts                   ← Configurable memory window (Fixed vs. Unlimited)
│   │   └── compaction.ts           ← Memory summarizer engine
│   ├── inference/
│   │   ├── gemini.ts               ← Gemini Flash multimodal adapter
│   │   └── openai.ts               ← OpenAI compatible edge adapter
│   └── templates/
│       └── character.ts            ← System prompt assembly & BYOS sync formatters
└── tests/
    └── ed25519.test.ts             ← Unit tests for crypto verification
```

---

## 3. Key Evolution: Configurable Memory Window Modes

A fixed 10-message rolling window forces a character to act like a generic assistant. To support **deep, long-term character coherence**, `apps/stage-edge/src/memory/kv.ts` introduces **Configurable Memory Window Modes**:

```typescript
export interface MemoryWindowConfig {
  mode: 'fixed' | 'unlimited'
  maxTurns?: number // Default: 10 or 20 (for concise assistant turns)
}
```

### **Memory Mode Segmentation**:
1. **Assistant Mode (`fixed`)**:
   - Fetches the last $N$ turns (e.g. 10 or 20 turns) to conserve token costs and ensure quick, task-oriented replies.
2. **Deep Coherence Character Mode (`unlimited`)**:
   - Retrieves the **full, un-truncated interaction history** from Cloudflare KV.
   - Combined with 20-turn memory summarization (`compaction.ts`), this allows characters to retain long-term context, recall past conversations, and maintain a consistent personality.

---

## 4. Control Plane UI & Edge Studio Deployment

### 4.1 Deployment Safety & Secret Protection
- **`wrangler.json.example`**: Committed as a template in `apps/stage-edge/`.
- **`wrangler.json` / `wrangler.toml`**: Strictly gitignored in `.gitignore` to prevent API keys or deployment targets from leaking into Git.

### 4.2 Single-Click Edge Deployment
- Reuses Cloudflare credentials from BYOS Cloud Sync (`project-byos-cloud-sync.md`), 1-click Cloudflare OAuth PKCE login (`loginWithCloudflareOAuth` via `http://localhost:8976/oauth/callback`), or manual API Token entry.
- Automatically injects `SYSTEM_PROMPT`, `MEMORY_MODE` (`fixed` vs. `unlimited`), `DISCORD_PUBLIC_KEY`, and `GEMINI_API_KEY`.
- Deploys the worker via Cloudflare REST API in a client-side, zero-custody fashion.

---

## 5. Architectural Standards: Lifecycle, Identity & Reconciliation

### 5.1 Explicit 3-State Execution Lifecycle (`discordExecutionMode` & `enabled`)

Execution mode and pause states are **explicitly user-driven** rather than inferred through automatic magic heuristics:

| State | `discordExecutionMode` | `enabled` | Hardware State | Discord Endpoint / Gateway Behavior |
|---|---|---|---|---|
| **Local Gateway (Desktop)** | `'local'` | `true` | Desktop App Running | Local Gateway WebSocket process active. |
| **Cloud Relay (Edge)** | `'remote'` | `true` | Any (PC On or Off) | Discord Interactions Endpoint URL set to `https://<script>.workers.dev/discord`. |
| **Paused / Unlinked** | `'local'` / `'remote'` | `false` | Any | Desktop WS disconnected OR Discord Interactions Endpoint URL unlinked (set to empty/null). |

#### Teardown vs. Pause Disambiguation:
- **Pause / Unlink (Tab 1 & Tab 2)**: Clears the Discord Interactions Endpoint URL so the Cloudflare Worker sits dormant without handling live events. The Worker script and KV store remain preserved on Cloudflare.
- **Full Nuke / Teardown (Tab 2 Exclusive)**: Deletes the Worker script (`DELETE /workers/scripts/{scriptName}`) and purges the Cloudflare KV namespace (`DELETE /kv/namespaces/{id}`).

### 5.2 Primary Owner Identity Resolution (`ownerUsername` -> `ownerUserId`)

Asking users for an 18-digit Discord Snowflake ID is poor UX (requires developer mode).

- **Username Input**: Tab 1 accepts standard Discord handles/usernames (e.g. `dasilva333`).
- **Automatic Resolution**: During service startup or deployment validation, AIRI queries the Discord REST API / Gateway cache to resolve the username into the 18-digit `ownerUserId`.
- **Role**: `ownerUserId` enforces **Root Admin ACL privileges** (`/settings`, `/character`, `/summon`, `/leave`) and identifies primary owner messages during Cloud Relay memory reconciliation.

### 5.3 Deployment Flow: Target Session Selection & "Review & Inspect Details" Modal

The deployment workflow uses a gentle, 2-step review sequence to provide full transparency before anything is packaged or pushed to Cloudflare:

1. **Step 1: Target Session Selection (`[🚀 Deploy Character to Cloudflare Edge]`)**:
   - Opens a modal showing the character's parallel timeline sessions (matching `ChatSessionModal.vue`).
   - Displays real message counts (e.g. `127 messages`), creation dates, universe tags, and active GUI status.
   - Offers a 1-click **`+ Start New Dedicated Relay Session`** option for isolated Cloud Relay interactions.

2. **Step 2: "Review & Inspect Details" Modal**:
   - Renamed softly to **"Review & Inspect Details"** so users feel confident inspecting their configuration rather than being intimidated by a rigid "Confirmation Modal".
   - **Summary Banner**: Displays resolved Bot Name (`AIRI#1234`), Target Session Name (`The Fat Cat`), and Memory Mode (`Unlimited` vs `Fixed 10-turn`).
   - **Consciousness (LLM) Selection (`BrainModelPicker`)**: Incorporates the standard `BrainModelPicker` component (`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabModules.vue`) allowing the user to select the edge inference LLM provider and model (e.g. OpenAI-compatible endpoints, OpenRouter, Gemini, Groq, DeepSeek). Automatically extracts the provider's configured API key & endpoint from `useProviderStore` and validates credentials before enabling deployment.
   - **History Depth / Context Continuity Control**: A dedicated selector allowing the user to choose how much local chat history to package and upload to Cloudflare KV:
     - `System Prompt Only` (Clean Slate / Default)
     - `Last 10 Messages` (Recent Context)
     - `Last 50 Messages` (Extended Coherence)
     - `Full Session History` (Complete Continuity)
     Messages are extracted from `useChatSessionStore()` for the target `sessionId` and seeded into Cloudflare KV key `context/rolling` during deployment, ensuring 100% personality & dialogue continuity on Discord from the first interaction.
   - **System Prompt Previewer**: An inline collapsible inspector that renders the complete assembled prompt generated by `buildSystemPrompt()` / `refreshActiveSystemMessage()`, giving users 100% visibility into what character traits and memory summaries will be uploaded to Cloudflare.

### 5.4 Visual Memory Review & Reconciliation Modal (Cozy User Flow)

When clicking **`[Sync Memories ↓]`** on a deployed instance card, AIRI executes a zero-surprise, 5-step cozy user flow:

1. **Click Trigger**: User clicks **`[Sync Memories ↓]`** on a deployed character card. Loading toast shows *"Fetching Cloud Relay memories from Cloudflare Edge..."*.
2. **In-Memory Pre-computation**: AIRI queries the exact `namespaceId` for that card, normalizes display text, and runs Right-to-Left Sequence Alignment against local session history.
3. **Modal Review**: A modal opens pre-checking new turns (defaulting to owner messages checked).
4. **Quick Filters**: Preset buttons `[Select Only Owner]` and `[Select All]` allow 1-click filtering of multi-user server chatter.
5. **Final Merge**: User clicks **`[📥 Merge N Selected]`** to commit selected turns to local IndexedDB, updating the desktop chat timeline immediately.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 📥 Review & Reconcile Cloud Relay Memories                             │
│ Session: "main-session" | Cloud Worker: airi-stage-edge.workers.dev    │
├────────────────────────────────────────────────────────────────────────┤
│ Select entries to merge into local session:                            │
│                                                                        │
│ Quick Filters: [ Select Only Owner (dasilva333) ]   [ Select All ]     │
│ ────────────────────────────────────────────────────────────────────── │
│ [x] 💬 10:42 AM — [dasilva333]: "Hey AIRI, remind me to check GPU"    │
│ [x] 🤖 10:42 AM — [AIRI]: "Got it! Logged in memory."                  │
│ [ ] 💬 11:15 AM — [GuestUser]: "What's the weather in Tokyo?"          │
│ ────────────────────────────────────────────────────────────────────── │
│ [ Cancel ]                                   [ 📥 Merge 2 Selected ]   │
└────────────────────────────────────────────────────────────────────────┘
```

**Features & Safety Guarantees**:
- **Zero-Blind Ingestion**: No local database mutation occurs until the user reviews the modal and clicks **`[📥 Merge N Selected]`**.
- **Deterministic KV Namespace Target**: Queries the explicit `namespaceId` recorded in `cloudRelayInstances` for the active card, ensuring zero cross-talk between different deployed characters.
- **Display-Content Normalization**: Compares clean display `content` (without internal orchestration tokens like `<|ACT:...|>`), preventing false mismatches against local `rawContent`.
- **Right-to-Left Sequence Alignment**: Walks local history backwards to find a 2–3 turn sequence anchor match, preventing false duplicates on short phrases like `"hi"`.
- **Transparency**: Pre-views all incoming messages and learned facts before writing to local storage.
- **Preset Filters**: 1-click **`[Select Only Owner]`** filter isolates messages from `ownerUserId` and ignores multi-user server chatter.
- **Safety**: Zero risk of unintentional local session corruption or unwanted multi-user text ingestion.

## Relevant Skills

- [[airi-cloud-relay-infrastructure]]
- [[airi-discord-integration]]
