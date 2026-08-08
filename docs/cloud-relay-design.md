# Design Document: Cloud Relay — Always-On Character Presence

**Status:** Active Implementation Phase (`apps/stage-edge` & Unified Discord Control Plane)

**Related Docs:**
- [`design-discord-control-plane.md`](./design-discord-control-plane.md) — Unified 3-tab Discord Control Plane & `@proj-airi/stage-edge` package architecture.
- [`design-discord-context-routing.md`](./design-discord-context-routing.md) — Discord channel context routing (`channel-{id}`, `dm-{userId}`), DM privacy isolation, and Access Control List (ACL) permission matrix.
- [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md) — The existing BYOS sync engine whose Cloudflare R2 credential integration and `StorageClient` interface this feature builds on.
- [`proposal-proactivity-vision.md`](./proposal-proactivity-vision.md) — The broader proactivity roadmap; Cloud Relay is a natural deployment target for proactive behaviors.

---

## 1. Problem Statement

AIRI is a local-first desktop application. Its richest experience — Live2D/VRM rendering, local LLM inference, plugin ecosystem, memory system — requires the user's machine to be on and nearby. This creates a hard access gap:

- **Mobile / commute access:** Users who are away from their PC cannot reach their character at all.
- **Always-on presence:** Characters cannot initiate contact, send check-ins, or accumulate context while the user is away.
- **Hardware constraints:** Some users (documented in community feedback) cannot run local 3GB+ model files or have machine policies that mandate the PC be powered off when unattended.

The insight from community users (Göndul/格恩達爾, Ansem) is that a **lightweight cloud deployment** — a Cloudflare Worker backed by a cloud LLM API — already solves the access problem today. AIRI owns that deployment experience end-to-end through `apps/stage-edge` instead of leaving users to vibe-code it themselves.

---

## 2. Proposed Solution: Cloud Relay

**Cloud Relay** is a core AIRI subsystem that lets users design a character in AIRI and deploy a persistent, cloud-hosted instance of that character — reachable 24/7 from any device, even when the local machine is powered off.

AIRI's role shifts from **local runtime only** to **control plane + authoring studio**:

| Layer | What it does | Implementation |
|---|---|---|
| **AIRI (local)** | Author cards, configure relay, manage sync, review memories | User's machine (`stage-tamagotchi` / `stage-ui`) |
| **Cloud Relay Worker** | Serves the character: handles interactions, calls LLM, reads/writes KV memory | Cloudflare Edge (`@proj-airi/stage-edge`) |
| **Discord / Frontends** | User-facing chat surface; hits the Worker's callback URL | Discord infra / Webhooks |

The model is analogous to **Vercel for character instances**: author locally, deploy to the edge, manage from the dashboard, the cloud runs independently.

---

## 3. Architecture

### 3.1 The Cloudflare Worker as a Character Instance (`apps/stage-edge`)

Cloudflare Workers use the **HTTP Interactions model** rather than a long-running WebSocket. The flow is:

```
User sends message (Discord slash command, future web chat, etc.)
        ↓
Discord / frontend POSTs to the Worker's registered callback URL (/discord)
        ↓
Cloudflare Worker wakes (cold start < 5ms at edge)
        ↓
Worker verifies ed25519 signature (crypto/ed25519.ts)
Worker reads conversation context from KV store (memory/kv.ts)
Worker calls cloud LLM API (inference/gemini.ts or inference/openai.ts)
Worker writes updated context back to KV
        ↓
Worker returns structured response to Discord / caller
        ↓
User sees reply — Worker goes idle
```

This is entirely **serverless and stateless per-invocation**. The Worker holds no persistent process; the Cloudflare KV store is the persistent layer.

### 3.2 Memory Architecture: Configurable Window Modes

Since Workers are stateless, all character memory is externalized to **Cloudflare KV** (`memory/kv.ts`):

```
KV namespace: airi-kv-<characterName>
  ├── ping                   → Baseline diagnostic key ("pong")
  ├── context/rolling        → Recent N messages (sliding window or unlimited history)
  ├── context/summary        → Auto-summarized long-term context blob (compaction.ts)
  ├── memory/facts           → Persistent facts about user (name, preferences, etc.)
  └── meta/config            → Character config snapshot (persona, system prompt, tone)
```

**Memory Window Modes**:
1. **Fixed Mode (`fixed`)**: Retains a rolling window of recent turns (e.g. 10–20 turns) for concise, cost-effective assistant behavior.
2. **Unlimited / Deep Coherence Mode (`unlimited`)**: Retains full, un-truncated conversation history with automatic background compaction (`compaction.ts`).

### 3.3 Proactive Messaging via Cron Triggers

The Worker's default behavior is **reactive** (only responds when triggered). To give the character a heartbeat:

- A **Cloudflare Cron Trigger** wakes the Worker on a schedule (e.g. hourly, or at a configurable interval).
- The Worker evaluates a proactivity condition (e.g. "has the user not initiated in > N hours?").
- If true, the Worker uses Discord's REST API to `POST /channels/{channelId}/messages` directly — no interaction required.

### 3.4 Connector Architecture

The Worker is designed to be **connector-agnostic**:

| Connector | Mechanism | Status |
|---|---|---|
| Discord | Slash commands + Interactions webhook | Live in `apps/stage-edge` |
| Web chat widget | Simple HTTP POST endpoint on the Worker | Near-term |
| Telegram | Bot webhook to Worker URL | Roadmap |
| SMS / WhatsApp | Twilio webhook forwarded to Worker | Roadmap |

---

## 4. AIRI as Control Plane: Unified 3-Tab Discord Control Plane UI

The Discord module UI (`packages/stage-pages/src/pages/settings/modules/messaging-discord.vue` and `packages/stage-ui/src/components/modules/MessagingDiscord.vue`) is structured into a unified **3-Tab Navigation Bar**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 💬 Discord Integration & Cloud Control Plane                                    │
├───────────────────────────┬───────────────────────────┬─────────────────────────┤
│ 🔌 Bot Connection         │ 🌐 Cloud Relay Studio     │ 🔐 Access & Routing     │
│   (Local Runtime & Tokens)│   (Vercel for Characters) │   (Channel ACL Matrix)  │
└───────────────────────────┴───────────────────────────┴─────────────────────────┘
```

### 4.1 Tab Breakdown

1. **Tab 1: 🔌 Bot Connection (Local Desktop Service)**:
   - Manages the local Gateway WebSocket connection (`useDiscordStore`).
   - Token configuration, start/stop toggle, connectivity meters (ping, guilds list), vision/DM toggles, and expandable live developer log console.

2. **Tab 2: 🌐 Cloud Relay Studio (24/7 Edge Deployment)**:
   - **Authentication**: Supports 1-click **Cloudflare OAuth 2.0 PKCE Login** (`loginWithCloudflareOAuth` via local callback `http://localhost:8976/oauth/callback`) or manual Cloudflare API Token entry.
   - **Deployment Engine (`CloudflareStageDeployer`)**: Programmatically provisions KV namespaces, builds Worker script payloads, uploads ES modules, binds secrets (`GEMINI_API_KEY`, `SYSTEM_PROMPT`), enables `workers.dev` subdomains, and registers Discord Interactions URLs automatically.
   - **Instance Cards**: Displays active Cloud Relay status, public Worker URL, model binding, memory mode (`fixed` vs `unlimited`), and 1-click **[Sync Memories ↓]** and **[Teardown]** actions.

3. **Tab 3: 🔐 Access & Routing (Context & Permission Matrix)**:
   - **Channel Context Routing**: Maps Discord channels (`channel-{id}`), threads (`thread-{id}`), and DMs (`dm-{userId}`) to specific character cards and chat sessions (`design-discord-context-routing.md`).
   - **ACL Permission Matrix**: Defines command access levels (`Owner Only`, `Whitelisted Roles/Users`, `Everyone`, `Disabled`) with strict deny-first precedence rules.

### 4.2 Automated Client-Side 2-Step Deployment Sequence

Deployment sequence (triggered by **[🚀 Deploy Character to Cloudflare Edge]** button in Tab 2):

```
1. Step 1: Session Selector Modal → User selects target timeline session (Active GUI, existing timeline, or dedicated new relay session).
2. Step 2: "Review & Inspect Details" Modal:
   - Summary Banner: Displays character name, target session name, memory mode, and target Discord servers list.
   - Consciousness (LLM Provider & Model Picker): User selects edge inference engine via `BrainModelPicker` (OpenAI-compatible, OpenRouter, Gemini, Groq, DeepSeek). Credentials are auto-sourced from AIRI Provider settings (`useProviderStore`).
   - Assembled System Prompt Inspector: Collapsible live inspector rendering `buildSystemPrompt()` character persona + memory context.
3. User clicks [🚀 Launch Deployment to Cloudflare]:
   - OAuth PKCE exchange / token check → authenticates zero-custody with Cloudflare REST API.
   - AIRI creates KV namespace `airi-kv-<scriptName>` and seeds initial memory context.
   - AIRI packages ES module Worker bundle (`packager.ts`) with assembled system prompt & API secrets.
   - AIRI uploads ES module payload via PUT `https://api.cloudflare.com/client/v4/accounts/{accountId}/workers/scripts/{scriptName}`.
   - AIRI enables `workers.dev` subdomain & fetches live endpoint URL.
   - AIRI registers Discord Interactions Endpoint URL (`{workerUrl}/discord`) & global slash commands via Discord REST API.
   - Execution Switch: `executionMode` switches to `'remote'` and local gateway pauses (`stopService()`) so Cloudflare Edge takes over live interactions cleanly.
```

All operations run client-side in a zero-custody architecture — no intermediary AIRI server touched.

This means AIRI remains the **source of truth for character configuration** — the cloud instance is always a projection of what AIRI holds locally.

---

## 5. Memory Sync: Local ↔ Cloud Relay

This is the most strategically valuable piece of the feature. It closes the loop between the always-on cloud experience and the rich local AIRI experience.

### 5.1 Sync Directionality

**v1 — Pull-only (remote → local):**
The simplest and safest model. The user hits **[Sync Memories ↓]** in the dashboard and AIRI fetches the relay KV contents, deserializes them, and imports them into the local memory system. No conflict resolution needed because the flow is one-directional.

**v2 — Bidirectional:**
The local memory system can push updates back up to the relay KV, so that conversations had locally in AIRI are also visible to the cloud character. This requires the conflict resolution logic already designed in BYOS (LWW per-item merges on `short-term-memory`, `text-journal`, etc.).

### 5.2 Key Mapping: Relay KV → AIRI Local Memory

| Relay KV Key | AIRI Local Storage Key | Merge Strategy |
|---|---|---|
| `context/rolling` | `local:memory/short-term/local` | Append-merge by message ID, LWW |
| `context/summary` | `local:memory/text-journal/local` | Append-merge by entry ID |
| `memory/facts` | `local:memory/echo-chips/local` | Merge by fact key, LWW |
| `memory/events` | `local:memory/echo-chips/local` (event type) | Merge by event ID |

The merge keys and strategies are consistent with the BYOS engine's existing mergeable-key handling, which means the sync import path can reuse the same `StorageClient` reconciliation logic with a new KV adapter rather than an S3 adapter.

### 5.3 Automatic Sync Option

An optional **background auto-sync** mode polls the relay KV on a configurable interval (e.g. every 15 minutes when AIRI is open) and quietly imports new relay memories. A notification badge on the character card in AIRI signals new relay memories available.

### 5.4 The Safety Heuristic

The BYOS contraction-check heuristic (blocking sync if a large dataset would be replaced by a much smaller one) applies equally to relay imports. A relay memory wipe (e.g. from a Worker redeploy) should never silently overwrite a healthy local memory store.

---

## 6. Why This Preserves AIRI's Value

A concern this feature must address: "if a user just needs a cloud bot, why do they need AIRI at all?"

The answer is that AIRI is the **only place where the full experience is authored and managed**:

| Capability | AIRI Local | Cloud Relay alone |
|---|---|---|
| Rich card creation & editing | ✅ | ❌ |
| Live2D / VRM / Spine rendering | ✅ | ❌ |
| Local LLM inference (offline) | ✅ | ❌ |
| Plugin ecosystem | ✅ | ❌ |
| Full memory RAG system | ✅ | Partial (rolling window only) |
| Always-on / mobile access | ❌ | ✅ |
| Works with PC off | ❌ | ✅ |
| 24/7 uptime | ❌ | ✅ |

Cloud Relay is **not a replacement** — it is an extension. AIRI is the studio; the relay is the broadcast layer. Users who only want a cloud bot get a dead-simple deployment path. Users who want the full experience get seamless continuity between local and cloud.

---

## 7. Positioning

**AIRI = Vercel for character instances.**

You author your character locally with all of AIRI's tooling. You click Deploy. The character goes live on the edge — accessible from Discord on your phone, from a browser, from a friend's device. You manage, configure, and reconfigure from AIRI. When you get home, you sync memories down and pick up the conversation locally with full context.

**Suggested feature name:** **Presence** or **Cloud Relay**
- *Presence* — user-facing; emphasizes the character is always out there
- *Cloud Relay* — technical; emphasizes the architecture (local ↔ cloud relay)

Recommendation: surface as **"Always-On Presence"** in UI copy, use **"Cloud Relay"** in internal docs and code identifiers.

---

## 8. Open Questions

1. **Worker template ownership:** The Cloudflare Worker script template needs to be maintained in the AIRI repository. Where does it live — `integrations/cloud-relay/`? What is the release/update strategy when the template changes?

2. **Credential security for LLM API keys:** The LLM API key stored as a Worker secret is under the user's Cloudflare account, not AIRI's custody. But AIRI needs to know it at deploy time to upload it. Should AIRI store it locally in the OS keychain post-deploy, or prompt on every redeploy?

3. **Multi-character support:** Should a single Cloudflare account support multiple simultaneous relay deployments (one Worker per character), or is there a single Worker that routes by character ID?

4. **Discord bot token ownership:** The user needs a Discord bot application and token. Should AIRI provide a guided bot-creation walkthrough (linking to Discord Developer Portal), or is there a hosted relay bot option where multiple users share an AIRI-operated Discord app?

5. **Relay → local push (v2):** When the user chats locally in AIRI, should those messages be pushed up to the relay KV so the cloud character maintains continuity? This would make the relay the universal memory store, but it adds write-on-every-message overhead.

6. **Free tier limits:** Cloudflare Workers free tier allows 100k requests/day and KV reads/writes within limits. For casual personal use this is ample, but heavy users may hit it. Should the dashboard expose usage metrics and warn proactively?

---

## 9. Verification Plan

### Pre-Implementation (Design Phase)
- [ ] Prototype Cloudflare Worker template that accepts a POST, reads KV context, calls a LLM API, and returns a response — verifies the core loop works end-to-end without AIRI.
- [ ] Verify Cloudflare REST API supports programmatic Worker upload and KV namespace creation (confirm against `api.cloudflare.com/client/v4/accounts/{accountId}/workers/scripts`).

### Implementation
- [ ] Unit test the KV ↔ AIRI memory key mapping and merge logic using the existing `StorageClient` test harness.
- [ ] Integration test: deploy a Worker from AIRI dashboard, send a test message via the Worker URL directly, verify KV state, trigger sync, verify local memory updated.
- [ ] Manual: Discord end-to-end — deploy relay, add bot to a test server, send a slash command, verify reply, sync memories, verify memory appears in AIRI.

### Manual Verification (User-Facing)
- Deploy button creates a working, publicly reachable Worker.
- Relay KV memories appear in AIRI local memory after Sync ↓.
- Teardown fully removes Worker and KV namespace from Cloudflare account.
