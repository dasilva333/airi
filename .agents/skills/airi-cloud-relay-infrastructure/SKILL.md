---
name: airi-cloud-relay-infrastructure
description: >-
  Use when working with deploying, configuring, or maintaining Cloudflare Workers edge relay services ('Vercel for Characters'), Edge KV memory models, Discord interaction webhooks, CloudflareStageDeployer execution, or the CORS reverse-proxy worker.
---

# AIRI Cloud Relay & Edge Infrastructure

Governs **Cloud Relay** ("Vercel for Characters"). AIRI local desktop acts as the zero-custody control plane and authoring studio; serverless Cloudflare Workers handle 24/7 proactive character presence, Discord interaction webhooks, and Edge KV state while the local client is offline.

Philosophy: **Local-First, Zero-Custody, Edge-Native**. There are no proprietary AIRI backend servers; character instances run on user-owned Cloudflare accounts.

---

## 1. Verified Surface Map

### Worker source (`apps/stage-edge/`)
- `src/index.ts` — HTTP Interaction Worker entry (V8 isolate): OPTIONS preflight, `/health`, `/cors-proxy` + `/proxy` (Web CORS reverse-proxy), POST `/discord` (Ed25519-verified interaction webhook).
- `src/discord/acl.ts` — `UserRole` enum `OWNER | DESIGNATED | VISITOR` + `isAllowedInteraction(userId, config)` (owner or designated only).
- `src/discord/client.ts` — Discord REST helpers: `fetchDiscordPublicKey(botToken)`, `registerSlashCommands`, `updateInteractionsEndpointUrl`.
- `src/crypto/ed25519.ts` — `verifyDiscordSignature` Ed25519 verification for EVERY incoming webhook (including Type 1 PING).
- `src/inference/llm.ts` — provider-agnostic OpenAI-compatible caller (`generateLlmReply`).
- `src/memory/kv.ts` — `KvMemoryStore`: transactional per-turn keys + `MemoryWindowConfig` (`fixed` default 10, `unlimited` full context).
- `src/templates/character.ts` — `buildSystemInstruction({ name, personality, systemPrompt })`.
- `src/deployer/index.ts` — `CloudflareStageDeployer` (client-side deployer, OAuth token or PKCE flow).
- `src/deployer/oauth.ts` — Cloudflare OAuth 2.0 PKCE flow (openauthorization popup used by onboarding).
- `src/deployer/packager.ts` — in-memory esbuild Worker bundling; on failure falls back to `../bundle-code` `BUNDLED_WORKER_SCRIPT`.
- `src/cli.ts`, `src/bundle-code.ts` — CLI helper + static fallback bundle.

### Desktop control plane (`packages/stage-ui/src/stores/modules/`)
- `cloudflare.ts` — OAuth session, `CloudflareStageDeployer` facade calls, `saveToEdgeVault`/`fetchFromEdgeVault` (Edge Vault CRUD, namespace titled `airi-edge-vault`).
- `discord.ts` — `deployCloudRelay` action + `cloudRelayInstances` persisted map (see §4), `fetchCloudRelayMemories(namespaceId, key)`.
- `modules/onboarding-v2` — Step 7 Cloud Infra: OAuth PKCE → deploy CORS proxy / Discord worker / R2 backup, restore from existing instances.

### Design docs
- `docs/cloud-relay-design.md` — master Cloud Relay architecture doc.
- `docs/project-generic-cloudflare-framework-plan.md` — generic Cloudflare framework plan.
- `docs/design-discord-control-plane.md`, `docs/design-discord-context-routing.md` — control-plane + context-routing lineage. (There is NO `docs/design-discord-cloud-relay.md`.)

---

## 2. Env Contract & Worker Runtime

```ts
export interface Env {
  LLM_API_KEY: string // secret_text binding
  LLM_MODEL?: string // plain_text (e.g. 'gemini-3.5-flash-lite')
  LLM_BASE_URL?: string // plain_text, provider-agnostic
  DISCORD_PUBLIC_KEY: string // secret_text
  SYSTEM_PROMPT?: string // optional; overridable from KV 'system/prompt'
  CHARACTER_NAME?: string // plain_text
  MEMORY?: KVNamespace // kv_namespace binding
}
```

Worker behavior (`src/index.ts`):
- **OPTIONS**: CORS preflight, `Access-Control-Allow-Origin: *`.
- **`/health`**: `{ status: 'ok', worker: '@proj-airi/stage-edge' }`.
- **`/cors-proxy` / `/proxy`**: `?url=` or `x-target-url` header; strips `host`/`referer`/`origin`; `x-target-authorization` remaps to `Authorization`. Used for provider APIs on the Edge without leaking keys to the client.
- **`/discord`**: verify Ed25519 (401 on failure). Type 1 → `{type:1}` PONG. Type 2 → load `system/prompt` from KV if present (overrides `SYSTEM_PROMPT`), read `context/rolling`, run `generateLlmReply`, then **defer** with `ctx.waitUntil` + reply `{type:5}` (Discord DEFERRED). The deferred job:
  - pushes user+assistant turns into `context/rolling` (capped at 50), PATCHes `messages/@original` at `https://discord.com/api/v10/webhooks/{appId}/{token}/messages/@original`;
  - **2000-char trim** — `safeContent.slice(0, 1930) + "\n\n*(Truncated to fit Discord 2000-character limit)*"`;
  - on error PATCHes an inline error message (`Edge Inference Error: ... | baseUrl= | model=`).

> [!NOTE]
> **KV layout (verified against source)**: the worker uses `system/prompt` (bypasses 5.1KB binding-size caps), `context/rolling` (JSON array of `{role,content}` history), and `ping → pong` seed. `KvMemoryStore` additionally writes per-turn keys `history_{userId}_turn_{timestamp}_{turnId}` for fixed/unlimited windows. Older skill/docs drafts naming `context/summary`, `memory/facts`, `meta/config` do **not** exist in source — do not reintroduce them.

---

## 3. CloudflareStageDeployer (Deployment)

`CloudflareStageDeployer` (ApiToken or OAuth-derived token) drives everything from the client:

- `getAccounts()` / `ensureAccountId()` — account resolution.
- `getSubdomain()` / `setSubdomain()` — workers.dev subdomain probe/claim (`PUT /accounts/{id}/workers/subdomain`).
- `ensureKvNamespace(title)` — dedupe by title else create; returns namespace ID. On deploy the worker creates **`airi-kv-{scriptName}`**.
- `setKvValue` / `getKvValue` — direct KV writes/reads.
- `deployWorker(options)`:
  1. Auto-resolve Discord Public Key from bot token (`fetchDiscordPublicKey`); fallback `demo_public_key_fallback`.
  2. `ensureKvNamespace('airi-kv-{scriptName}')`; seed `ping→pong`, optional `system/prompt`, optional `context/rolling`.
  3. Bundle via `packageWorkerScript()` (esbuild in-memory) with `BUNDLED_WORKER_SCRIPT` fallback.
  4. PUT script: `main_module: 'index.mjs'`, `compatibility_date: '2025-02-04'`, `compatibility_flags: ['nodejs_compat']`, bindings — `MEMORY` (kv_namespace), `CHARACTER_NAME`, `LLM_BASE_URL`, `LLM_MODEL` (plain_text), `LLM_API_KEY`, `DISCORD_PUBLIC_KEY` (secret_text).
  5. Register/enable workers.dev subdomain, derive `https://{scriptName}.{subdomain}.workers.dev`.
  6. Register the interactions endpoint (`{workerUrl}/discord`) + global slash commands via bot token.
  - Returns `{ workerUrl, namespaceId, publicKey }`.
- `deployCorsProxy()` — deploys the standalone CORS reverse-proxy worker (`airi-cors-proxy` by default), same subdomain flow.
- `deleteWorker(scriptName)` — tears down a deployed Worker.

---

## 4. Control Plane State & Persistence

`deployCloudRelay` (discord.ts) persists each instance into `cloudRelayInstances` — a `useLocalStorageManualReset` map keyed by `scriptName`:

```ts
interface CloudRelayInstance {
  scriptName: string
  workerUrl: string
  namespaceId: string
  memoryMode: 'fixed' | 'unlimited' // 'unlimited' when unset
  deployedAt: number
  cardId: string
  sessionId: string
}
```

- `fetchCloudRelayMemories(namespaceId, key = 'context/rolling')` pulls rolling history back into the local client.
- **Execution handover**: when a relay instance is deployed with `executionMode: 'remote'`, the local gateway pauses its own Discord turn loop; a memory-review modal offers restoring/merging remote context back once responses arrive. Keep this handover aware in any pipeline change (proactivity/chat flows must NOT double-answer).

---

## 5. Core SOPs

1. **Worker execution limits**: `stage-edge` runs in a V8 isolate — no Node built-ins beyond `nodejs_compat`; keep hot paths light (no heavy synchronous loops).
2. **Deterministic instance mapping**: always reconcile `namespaceId` ↔ `cloudRelayInstances` when syncing relay memories back to the local desktop; rely on the store map, never guess names.
3. **Secrets stay server-side**: `LLM_API_KEY`/`DISCORD_PUBLIC_KEY` are `secret_text` bindings; the client never reads them back. CORS purposes are handled by `/cors-proxy` so provider keys are not exposed to the renderer.
4. **Ed25519 first**: every Discord interaction — including Type 1 — must pass `verifyDiscordSignature`. Never accept Type 1/2 requests without verification.

---

## 6. Known Pitfalls & Failure Modes

- **Defers must PATCH**: Type 5 (deferred) requires the later PATCH to `messages/@original`; forgetting the waitUntil PATCH leaves the slash command "thinking" forever.
- **2000-char cap**: untrimmed replies over 2000 chars are rejected by Discord with an HTTP 400 PATCH error.
- **KV binding size**: large system prompts exceed the 5.1KB binding cap — read them from the `system/prompt` KV key instead (verified pattern in `src/index.ts`).
- **Eventual consistency**: Cloudflare KV propagation lag can momentarily desync edge reads; the per-turn key adapter (`history_*`) keeps windows coherent on writes-afforded reads.
- **No `docs/design-discord-cloud-relay.md`**: link the two real lineage docs (`design-discord-control-plane.md`, `design-discord-context-routing.md`), never a nonexistent path.
