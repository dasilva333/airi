---
name: airi-memory-lifetime
description: >-
  Use when working with AIRI memory pillar 5 — Lifetime Artifacts: memory-lifetime.ts store (995 lines), lifetime-memory.repo (local:memory/lifetime/{characterId}:{universeId} with one-way old-key migration), the 5-stage resumable provisioning pipeline (collect → chunk → base → distill_pass_1 → distill_pass_2 → success), collectSourceDocs, callJsonMode with retry/backoff, reprovisionFromChunks/restart, and the [Lifetime Artifact] prompt injection. Trigger on lifetime memory, eternal thread, distilled artifact, or provisioning synthesis. Hub: airi-memory-systems.
---

# Memory Pillar 5 — Lifetime Artifacts

The synthesized, distilled long-horizon identity/relationship blueprint per character+universe — what keeps relationship identity coherent across fresh sessions. Built by the resumable provisioning pipeline (progress tracked by pillar 8).

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/memory-lifetime.ts` (995 ln) — `useMemoryLifetimeStore` :304 |
| Repo | `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts` → `local:memory/lifetime/{characterId}:{universeId}` (one-way migration from bare `{characterId}` :10) |
| Artifact | `LifetimeArchive` + `DistilledPack` (`normalizeLifetimeArchive` :147, `normalizeDistilledPack` :134) |
| Data catalog | `docs/data-catalog.md` §1.8 |

## Key Mechanisms

- **Provision pipeline**: `provision(characterId, universeId='global', resume=false, intervalSeconds=0, contextLimitTokens=64, targetTokens=1000)` (:586) runs 5 stages across generations:
  1. `collectSourceDocs()` (:359) gathers universe-scoped evidence (sessions, STMM, journal candidates).
  2. Chunked summarization under the context-limit token cap.
  3. Base archive synthesis via `callJsonMode()` (:491) with schema validation (:475) and `withRetry()` (:568, 3 retries, exponential backoff base 2000 ms).
  4. `distill_pass_1` then `distill_pass_2` produce the final distilled artifact (markdown render helpers :211/:274 for review).
- **Resume**: interval cooldown (`maybeDelay`) makes very long builds survivable; phase + chunk summaries persist in the provisioning-session repo (`airi-memory-provisioning`).
- `reprovisionFromChunks()` (:922) re-distills without re-aggregating sources; `restart()` (:976) resets a build cleanly.
- **Prompt injection**: `session-store.ts` `buildLifetimeMemoryContext()` (:226) injects the single distilled artifact as `[Lifetime Artifact]`.

## Pitfalls

- Repo key is `{characterId}:{universeId}` now — code still reads the old bare key only via the migration helper (:10); don't write bare keys.
- Provider/model for provisioning comes from the card's `consciousness` module fallback to active provider; a misconfigured card consciousness silently switches the synthesis brain.
- The artifact is derived (regenerable) but must not overwrite sacral journal entries during source collection — reads only.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: run provisioning from the Eternal Thread / Memory settings UI and watch `local:memory/provisioning-session/{characterId}` advance `aggregating → chunking → synthesizing → distill_pass_1 → distill_pass_2 → success` (see `airi-memory-provisioning`).

## Sources

`docs/memory_lab/lifetime-artifact-generation-plan.md`; `docs/memory_lab/memory-engine-integration-plan.md`; `docs/data-catalog.md` §1.8/§1.9; peer: `airi-memory-systems` (hub), `airi-memory-provisioning`, `airi-memory-ui-pages` (Eternal Thread), `airi-memory-chat-sessions`.
