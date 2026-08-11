---
name: airi-cloud-relay-infrastructure
description: "Use when working with deploying, configuring, or maintaining Cloudflare Workers edge relay services, Edge KV memory models, BYOS cloud sync outbox queues, or commercial API server proxy boundaries."
---

# Overview & Surface Map
Governs the architecture and implementation of cloud connectivity, edge relays, and Bring Your Own Storage (BYOS) cloud sync for the AIRI ecosystem. It covers the serverless deployment of character instances to Cloudflare Workers (Cloud Relay), the management of their ephemeral state using Edge KV, and the synchronization logic that reconciles remote storage back to local IndexedDB instances.

The philosophy is **Local-First, Zero-Custody, and Edge-Native**. AIRI acts as the control plane and authoring studio, while the cloud handles 24/7 proactive presence and multi-device persistence without any proprietary AIRI backend servers.

# Key Code Paths
- `airi_dasilva333/apps/stage-edge/`: Core implementation of the Cloudflare Worker templates and relay logic.
  - `src/index.ts`: The HTTP Interaction Worker entry point.
  - `src/discord/`: Discord Slash Command handling and Ed25519 signature verification.
  - `src/deployer/`: `CloudflareStageDeployer` logic for programmatic ES module Worker bundling and deployment via Cloudflare REST API.
  - `src/memory/`: Cloudflare KV interaction layer.
  - `src/inference/`: LLM abstraction wrappers (e.g. Gemini, OpenAI) built for Edge environments.
- `airi_dasilva333/packages/stage-ui/src/database/storage.ts`: The main storage interceptor that handles BYOS outbox tracking using `unstorage`.
- **Docs:**
  - `airi_dasilva333/docs/cloud-relay-design.md`: Master document for Cloud Relay Architecture.
  - `airi_dasilva333/docs/project-byos-cloud-sync.md`: Master document for BYOS logic and S3/R2 reconciliations.

# Architecture: Cloud Relay
Cloud Relay allows users to deploy character instances as serverless Cloudflare Workers, providing 24/7 access (e.g., via Discord) even when the local AIRI client is off.

1. **Stateless Edge Execution**: The Worker wakes via HTTP POST (e.g., from Discord Interactions), verifies the Ed25519 signature, reads conversation context from KV, calls an LLM API, writes updated context to KV, and responds. There are no WebSockets.
2. **KV Namespace Layout (`airi-kv-<characterName>`)**:
   - `context/rolling`: Recent N messages.
   - `context/summary`: Long-term context.
   - `memory/facts`: Persistent user facts.
   - `meta/config`: Character persona configuration snapshot.
3. **Automated Client-Side Deployment**: The deployment (`CloudflareStageDeployer`) happens entirely from the AIRI local client using Cloudflare OAuth 2.0 PKCE, creating KV namespaces, bundling the Worker, and registering Discord Webhooks automatically.

# Architecture: BYOS Cloud Sync Engine
Provides privacy-preserving multi-device sync using standard S3/R2 backends.

1. **Unified Interceptor Layer (`unstorage`)**: Rather than hooking into every database repository, mutations to `local:` namespaces are patched to enqueue sync operations into `outbox:queue/*` and update modification timestamps in `local:sync-metadata/timestamps/*`.
2. **Reconciliation Strategy**:
   - **Standard Keys:** Uses Last-Write-Wins (LWW) comparing remote `mtime` and local timestamp. For S3, `LastModified` is used as `mtime`.
   - **Mergeable Keys** (`airi-cards`, `short-term-memory`, etc.): Merged by item ID using LWW.
   - **Display Model Manifests**: `groups`/`tags` are union-merged; `nsfw` is source-wins; `expressions`/`motions` are local-wins.
3. **Google Drive AppData Sandbox**: For seamless UX, S3/Cloudflare credentials can be stored encrypted in the user's hidden Google Drive `appDataFolder` (`airi_bootstrap.json`), achieving a single-sign-on-like experience without AIRI custody.

# Core SOPs
1. **Worker Deployment modifications:** When modifying `stage-edge`, ensure changes adhere to strict V8 isolate execution limits. Do not use Node.js built-ins that are unsupported in Workers.
2. **Memory Models Mapping:**
   - Ensure you respect the deterministic Namespace ID matching (`namespaceId` mapped to `cloudRelayInstances` store) when syncing relay memories back to AIRI.
   - For BYOS, remember that `localforage` (blob storage for backgrounds/models) has specific reconciliation logic (e.g. converting backgrounds to AVIF on upload to save space, tracking deletions in `sync-metadata`).
3. **API Proxies:** Use standard Cloudflare API proxies for hiding CORS and credential leakage for provider integrations on the Edge. Do not expose `GEMINI_API_KEY` or `OPENAI_API_KEY` to the client.

# Known Pitfalls
- **Edge Execution Limits:** Cloudflare Workers have a 50ms CPU time limit on the free tier. Do not perform heavy synchronous tasks or use unsupported dependencies.
- **Eventual Consistency:** Cloudflare Edge KV propagation delays can lead to temporary data desync. Treat KV writes as eventually consistent in distributed edge reads.
- **BYOS Contraction Checks:** The BYOS engine blocks operations that replace a large dataset (>10KB) with a much smaller one (<2KB) to prevent accidental data loss. This triggers a manual conflict resolution prompt.
- **S3 mtime Translations:** S3 objects do not support custom file modification time writes. We rely entirely on the native `LastModified` timestamp returned by `ListObjectsV2`, which requires precise sequence tracking to avoid redundant downloads.
- **Infinite Sync Loops:** Ensure `storageState.isImportingRemoteData` is strictly respected in the outbox interceptor, otherwise imported data will instantly trigger a re-upload.

# Verification Steps
- Validate `stage-edge` locally using Wrangler dev/Miniflare to simulate Edge execution environment and KV bindings.
- Run typechecks for `stage-edge` and ensure no Node-only imports slip in.
- Test BYOS merge conflicts locally by intentionally modifying a key in IndexedDB and simulating an older timestamp on the mock S3 client.

## 1. Overview & Surface Map

## 2. Key Code Paths

## 3. Core SOPs & Guidelines

## 4. Known Pitfalls & Failure Modes

## 5. Verification Workflows
