---
name: airi-cloud-relay-infrastructure
description: "Use when working with deploying, configuring, or maintaining Cloudflare Workers edge relay services ('Vercel for Characters'), Edge KV memory models, Discord interaction webhooks, or CloudflareStageDeployer execution."
---

# Overview & Surface Map
Governs the architecture and implementation of **Cloud Relay** ("Vercel for Characters"). AIRI local desktop acts as the control plane and authoring studio, while serverless Cloudflare Workers handle 24/7 proactive character presence, Discord interaction webhooks, and Edge KV state management when the local AIRI desktop client is offline.

The philosophy is **Local-First, Zero-Custody, and Edge-Native**. There are no proprietary AIRI backend servers; character instances run directly on user-owned Cloudflare accounts.

# Key Code Paths
- `apps/stage-edge/`: Core implementation of the Cloudflare Worker templates and relay logic.
  - `src/index.ts`: The HTTP Interaction Worker entry point (V8 isolate).
  - `src/discord/`: Discord Slash Command handling and Ed25519 signature verification.
  - `src/deployer/`: `CloudflareStageDeployer` logic for programmatic ES module Worker bundling and deployment via Cloudflare REST API.
  - `src/memory/`: Cloudflare KV interaction layer.
  - `src/inference/`: LLM abstraction wrappers (e.g. Gemini, OpenAI) built for Edge environments.
- **Docs:**
  - `docs/cloud-relay-design.md`: Master document for Cloud Relay Architecture.
  - `docs/project-generic-cloudflare-framework-plan.md`: Generic Cloudflare framework plan.

# Architecture: Cloud Relay ("Vercel for Characters")
Cloud Relay allows users to deploy character instances as serverless Cloudflare Workers, providing 24/7 access (e.g. via Discord) even when the local AIRI desktop app is closed.

1. **Stateless Edge Execution**: The Worker wakes via HTTP POST (e.g. from Discord Interactions), verifies the Ed25519 signature, reads conversation context from KV, calls an LLM API, writes updated context to KV, and responds. There are no WebSockets.
2. **KV Namespace Layout (`airi-kv-<characterName>`)**:
   - `context/rolling`: Recent N messages.
   - `context/summary`: Long-term context.
   - `memory/facts`: Persistent user facts.
   - `meta/config`: Character persona configuration snapshot.
3. **Automated Client-Side Deployment**: The deployment (`CloudflareStageDeployer`) happens entirely from the AIRI local client using Cloudflare OAuth 2.0 PKCE, creating KV namespaces, bundling the Worker, and registering Discord Webhooks automatically.

# Core SOPs
1. **Worker Execution Limits:** When modifying `stage-edge`, adhere to strict V8 isolate execution limits (50ms CPU time limit on Cloudflare free tier). Do not use unsupported Node.js built-ins.
2. **Deterministic Namespace Mapping:** Respect deterministic `namespaceId` matching (`namespaceId` mapped to `cloudRelayInstances` store) when syncing relay memories back to AIRI local desktop.
3. **API Proxies:** Use standard Cloudflare API proxies for hiding CORS and credential leakage for provider integrations on the Edge. Do not expose `GEMINI_API_KEY` or `OPENAI_API_KEY` to the client.

# Known Pitfalls & Failure Modes
- **Edge Execution Limits:** Cloudflare Workers have a 50ms CPU time limit on the free tier. Avoid heavy synchronous loops.
- **Eventual Consistency:** Cloudflare Edge KV propagation delays can lead to temporary data desync in distributed edge reads.
