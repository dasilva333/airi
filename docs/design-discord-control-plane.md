# Design Document: Unified Discord Control Plane & Edge Relay Architecture

**Status:** Updated Architectural Blueprint & Workspace Package Specification (`apps/stage-edge`)
**Authors:** AIRI Team & AI Assistant
**Target Workspace:** `apps/stage-edge/` & `packages/stage-pages/src/pages/settings/modules/discord.vue`
**Related Docs:**
- [`cloud-relay-design.md`](./cloud-relay-design.md) — Architectural specification for always-on Cloudflare Worker character presence.
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
- Reuses Cloudflare credentials from BYOS Cloud Sync (`project-byos-cloud-sync.md`) or prompts for a Cloudflare API Token (`Workers Scripts:Edit` + `KV Storage:Edit`).
- Automatically injects `SYSTEM_PROMPT`, `MEMORY_MODE` (`fixed` vs. `unlimited`), `DISCORD_PUBLIC_KEY`, and `GEMINI_API_KEY`.
- Deploys the worker via Cloudflare REST API in a client-side, zero-custody fashion.
