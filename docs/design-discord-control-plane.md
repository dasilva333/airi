# Design Document: Unified Discord Control Plane & Cloud Relay Integration

**Status:** Proposed / Architectural Blueprint
**Authors:** AIRI Team & AI Assistant
**Target Surface:** `packages/stage-pages/src/pages/settings/modules/discord.vue`
**Related & Reference Docs:**
- [`cloud-relay-design.md`](./cloud-relay-design.md) — Architectural specification for always-on Cloudflare Worker character presence.
- [`cloud-relay-worker.js`](./cloud-relay-worker.js) — The 5,700-line production-ready, zero-dependency Cloudflare Worker implementation (Ed25519 verification, transactional KV compaction, memory summary engine).
- [`design-discord-context-routing.md`](./design-discord-context-routing.md) — Channel context routing (`channel-{id}`, `dm-{userId}`), DM privacy isolation, and Access Control List (ACL) permission matrix.
- [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md) — BYOS Cloud Sync engine whose Cloudflare R2/KV credentials and zero-custody architecture this subsystem extends.

---

## 1. Vision & Executive Summary

AIRI is transitioning from a **local-only desktop runtime** to a **unified character authoring studio & control plane**.

While local desktop execution offers high-fidelity Live2D/VRM stage rendering and local inference, users who are mobile or away from their PCs lose 24/7 access to their characters. Community deployments (pioneered by Göndul and Ansem) proved that lightweight Cloudflare Workers backed by cloud LLMs (Gemini, OpenAI) solve the 24/7 access problem.

Rather than fragmenting Discord settings across separate, disconnected sub-pages (`Settings > Discord`, `Settings > Modules > Cloud Relay`, `Settings > Permissions`), this specification unifies all Discord bot connections, edge deployment pipelines, and channel/ACL security matrices into a **single, cohesive 3-Tab Control Plane interface**.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 💬 Discord Integration & Cloud Control Plane                                    │
├───────────────────────────┬───────────────────────────┬─────────────────────────┤
│ 🔌 Bot Connection         │ 🌐 Cloud Relay Studio     │ 🔐 Access & Routing     │
│   (Local Runtime & Tokens)│   (Vercel for Characters) │   (Channel ACL Matrix)  │
└───────────────────────────┴───────────────────────────┴─────────────────────────┘
```

---

## 2. Unified 3-Tab Control Plane Layout

### Tab 1: 🔌 Bot Connection (Local Runtime & Credentials)

This tab manages the core Discord Bot identity and local desktop execution.

* **Bot Credentials**:
  * `DISCORD_CLIENT_ID`: Discord Application Client ID.
  * `DISCORD_BOT_TOKEN`: Bot authentication token.
  * `DISCORD_PUBLIC_KEY`: Ed25519 Public Key for HTTP interaction signature verification.
* **Local Runtime Controls**:
  * Toggle local desktop bot listener (`Active` / `Disabled`).
  * Command toggles: `/voicecall` (classic & Gemini Live PCM audio streaming), `/voicemode` (`puppet`, `voicenote`, `none`), `/selfie` (stage viewport capture), `/timelines`, `/journalmoment`.
* **Single-Source Credential Guarantee**: Credentials entered here automatically propagate to Tab 2 (Cloud Relay Studio) and Tab 3 (Access Control), eliminating repetitive copy-pasting.

---

### Tab 2: 🌐 Cloud Relay Studio ("Vercel for AI Characters")

This tab turns AIRI into a **one-click deployment studio** to push standing character instances to the edge via Cloudflare Workers.

```
┌─────────────────────────────────────────────────────────┐
│  🌐 Loona — Cloud Relay Deployment          [Live ✅]  │
│  Worker URL: https://loona-relay.username.workers.dev    │
│  Connector:  Discord (@LoonaBot)                        │
│  LLM:        gemini-2.0-flash                           │
│  Last active: 2 hours ago                               │
│                                                         │
│  [Sync Memories ↓]  [Configure]  [View Logs]  [Teardown]│
└─────────────────────────────────────────────────────────┘
```

* **Deployment Flow (`[Deploy Relay]` Button)**:
  1. Reuses Cloudflare credentials from BYOS Cloud Sync (`project-byos-cloud-sync.md`) or prompts for a Cloudflare API Token (`Workers Scripts:Edit` + `KV Storage:Edit`).
  2. Creates a Cloudflare KV namespace `airi-relay-<characterId>`.
  3. Bundles the production `cloud-relay-worker.js` template, injecting `SYSTEM_PROMPT`, `OWNER_USER_ID`, `DISCORD_PUBLIC_KEY`, and `GEMINI_API_KEY`.
  4. Deploys the worker via Cloudflare REST API (`api.cloudflare.com/client/v4/...`) in a client-side, zero-custody fashion.
* **Transactional Memory & Compaction Architecture**:
  * Worker executes HTTP Interactions using the Discord Type 5 deferred response pattern (resolving within <5ms).
  * Writes turns to KV write-ahead logs (`history_turn_<userId>_<interactionId>`).
  * Compacts turns every 10 complete interactions into immutable archives (`history_archive_<userId>_*`).
  * Summarizes long-term owner memory every 20 turns (`memory_summary_<userId>_*`).
* **Bidirectional Memory Sync (`[Sync Memories ↓]`)**:
  * Pulls Cloudflare KV summaries and rolling context into local AIRI Pinia stores (`short-term-memory`, `text-journal`), merging cloud interactions with the desktop timeline seamlessly upon returning to the PC.

---

### Tab 3: 🔐 Access & Routing (Channel Mapping & ACL Matrix)

This tab unifies channel routing, DM isolation, and security permissions for **both local desktop execution and cloud relay deployments**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Global Fallback Mode: [ Strict Fallback (Ignore Unmapped) ▾ ]           │
├─────────────────────────────────────────────────────────────────────────┤
│ Context Routing Table                                                   │
│ ┌──────────────────────┬────────────────────┬─────────────────┬────────┐│
│ │ Context Key          │ Target Character   │ Session         │ Action ││
│ ├──────────────────────┼────────────────────┼─────────────────┼────────┤│
│ │ #general             │ AIRI (Gold Standard)│ Global Session  │ [Edit] ││
│ │ dm-3849204829104     │ Loona              │ Private DM      │ [Edit] ││
│ │ thread-99482103      │ Nan0               │ Staging Thread  │ [Delete]│
│ └──────────────────────┴────────────────────┴─────────────────┴────────┘│
│                                                                         │
│ Access Control List (ACL) Matrix                                        │
│ • Admin Commands (/settings, /summon): [ Owner Only (Default) ▾ ]       │
│ • Media Commands (/selfie, /voicecall):  [ Whitelisted Roles ▾ ]       │
│ • Raw Message Chat Triggers:            [ Mentions Only ▾ ]            │
└─────────────────────────────────────────────────────────────────────────┘
```

* **Global Fallback Modes**:
  1. `Strict Fallback (Ignore)` *(Default)*: Any unmapped channel, thread, or DM is completely ignored, preventing accidental public broadcasts.
  2. `Shared / Legacy`: All channels share the desktop app's currently active character and session.
  3. `Isolated Fallback (Auto-Create)`: Unmapped channels auto-initialize a new session.
* **DM Privacy Isolation (`dm-{userId}`)**:
  * Direct Messages are key-isolated per user ID.
  * DM roleplay sessions are hidden from global session selectors, history lookups, and shared logs.
* **Single-Pass Policy Packaging**:
  * Channel mappings and ACL rules configured in Tab 3 are bundled into env vars during `[Deploy Relay]`, ensuring **cloud worker deployments enforce the exact same channel access and privacy controls as the desktop app**.

---

## 3. Phased Implementation Roadmap

1. **Phase 1: UI Navigation & Credential Consolidation**
   - Refactor `packages/stage-pages/src/pages/settings/modules/discord.vue` to adopt the 3-tab layout (`Bot Connection`, `Cloud Relay`, `Access & Routing`).
   - Share Bot Token and Public Key inputs across all tabs.

2. **Phase 2: Access & Routing Plumbing (Tab 3)**
   - Implement persistent route store in Pinia (`useDiscordStore`).
   - Integrate context resolver for `channel-{id}` and `dm-{userId}` mappings.

3. **Phase 3: Cloud Relay Deployment Engine (Tab 2)**
   - Wire `cloud-relay-worker.js` deployment script into Cloudflare REST API endpoints.
   - Implement `[Sync Memories ↓]` bidirectional sync between Cloudflare KV and BYOS sync engine (`sync-engine.ts`).

---

## 4. Verification & Testing Strategy

- **Local Bot Verification**: Test `/voicecall`, `/selfie`, and channel context routing across desktop Electron sessions.
- **Cloud Relay Verification**:
  - Deploy worker template to Cloudflare via Tab 2.
  - Send `/chat` interaction via Discord bot. Verify Ed25519 signature validation and <5ms HTTP response.
  - Verify 10-turn KV archival, 20-turn memory summarization, and `[Sync Memories ↓]` sync back into AIRI.
