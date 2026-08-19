---
name: airi-memory-lifetime
description: >-
  Use when working with AIRI memory pillar 5 — Lifetime Artifacts: memory-lifetime.ts store (~1360 lines), lifetime-memory.repo (local:memory/lifetime/{characterId}:{universeId} with one-way old-key migration), the 5-stage resumable provisioning pipeline (collect → chunk → base → distill_pass_1 → distill_pass_2 → success), collectSourceDocs, callJsonMode with retry/backoff, reprovisionFromChunks/restart, the [Lifetime Artifact] prompt injection, and the implemented incremental maintenance lifecycle (STMM-cadence trigger in App.vue, universe-scoped 24h raw-log input via collectWindowedDocs, full merged artifact + changelog diff output, per-universe lastConsumedDay watermark, zero-change path, capped audit chain). Trigger on lifetime memory, eternal thread, distilled artifact, provisioning synthesis, or lifetime maintenance. Hub: airi-memory-systems.
---

# Memory Pillar 5 — Lifetime Artifacts

The synthesized, distilled long-horizon identity/relationship blueprint per character+universe — what keeps relationship identity coherent across fresh sessions. Universe-scoped: a lifetime artifact is the product of ALL memories in that universe, encompassing every timeline/session sharing the same `universeId`.

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/memory-lifetime.ts` (~1360 ln) — `useMemoryLifetimeStore` :405 |
| Repo | `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts` → `local:memory/lifetime/{characterId}:{universeId}` (one-way migration from bare `{characterId}` :10) |
| Artifact | `LifetimeMemoryArtifact` (`types/lifetime-memory.ts`, incl. `LifetimeUpdateRecord` audit + `finalPack`) + store-local `LifetimeArchive` + `DistilledPack` (`normalizeLifetimeArchive` :193, `normalizeDistilledPack` :180) |
| Data catalog | `docs/data-catalog.md` §1.8 |

## Lifecycle & Status

| Phase | Description | Status |
| :--- | :--- | :--- |
| 1. Full initialization | One-time full-history build (`provision()`) | **Implemented** |
| 2. Incremental daily update | STMM-cadence merge of new evidence into the existing artifact | **Implemented** (`applyIncrementalUpdate()`) |
| 3. Diff-chain rebase/rollup | Consolidate accumulated diffs into a new canonical base | **Implemented (v1 simplified)** — merged artifact stored whole, audit chain capped at 30, `reprovisionFromChunks`/`restart` = manual reset |
| 4. Manual rebuild | `reprovisionFromChunks()` / `restart()` | **Implemented** (full-rebuild variants only) |

Current reality: artifacts produced before incremental maintenance lack `lastConsumedDay`/`finalPack`; the first `applyIncrementalUpdate` run bootstraps the watermark to yesterday and returns (silently forward-sealing legacy artifacts).

## Initialization (Implemented)

`provision(characterId, universeId='global', resume=false, intervalSeconds=0, contextLimitTokens=64, targetTokens=1000)` (:687) runs 5 stages:

1. `collectSourceDocs()` (:460) gathers universe-scoped evidence (sessions — universe-filtered, longest session = Canonical Timeline, branches deduped as Alternative Paths —, STMM blocks, LTMM journal entries).
2. Chunked durable-fact extraction under the context-limit token cap.
3. Base archive synthesis via `callJsonMode()` (:592) with schema validation (:576) and `withRetry()` (:669, 3 retries, exponential backoff base 2000 ms).
4. `distill_pass_1` then `distill_pass_2` produce the final distilled artifact (markdown render helpers :257/:375 for review).
5. Persist artifact, delete provisioning session, broadcast `airi:lifetime-memory-sync`.

- Resume: interval cooldown (`maybeDelay`) makes very long builds survivable; phase + chunk summaries persist in the provisioning-session repo (`airi-memory-provisioning`).
- `reprovisionFromChunks()` (:1286) re-distills without re-aggregating sources; `restart()` (:1340) resets a build cleanly.
- Init now writes the forward watermark `metadata.lastConsumedDay` (latest source doc day) and stores `finalPack` — the merge target for incremental updates.
- **Prompt injection**: `session-store.ts` `buildLifetimeMemoryContext()` (:226) injects the single distilled artifact as `[Lifetime Artifact]`.

## Incremental Maintenance Design (Validated in Lab, Implemented)

Lab-validated mechanism (`docs/memory_lab/state-of-system.md`, "base artifact plus accumulated diffs"): staged runs proved chunk 8 builds the base, chunk 9 updates it yielding diff 1, chunk 10 updates base + diff 1 yielding diff 2 — diffs shrink on stable days, grow only on real long-horizon change. Production cadence was theorized in `docs/memory_lab/lifetime-artifact-generation-plan.md` ("Incremental Update Inputs") but never built. This design merges both.

- **Trigger**: STMM (pillar 3) daily block generation success — the "yesterday" cadence. NOT Dream State / AFK: AFK would mutate the artifact multiple times per day, which is too volatile and noisy. One refresh opportunity per day; actual change conditional on durable new evidence.
  - Implementation: `apps/stage-tamagotchi/src/renderer/App.vue` `ensureYesterdayShortTermBlockForActiveCharacter()` fires `applyIncrementalUpdate()` after `ensureYesterdayBlock()` (boot + active-card switch), cron-free, interruptible, never blocks boot.
- **Input** (all universe-scoped via `{characterId}:{universeId}`):
  - Current lifetime artifact
  - Yesterday's 24h raw log window (same window STMM consumed, across all timelines in the universe)
  - New LTMM (pillar 2) journal entries since a per-universe watermark
- **Output**: the **full merged artifact** + a change record (the "diff"). Prose diffs are audit/bookkeeping, NOT mechanically-applicable patches — the model re-emits the whole merged pack.
- **Zero-change path**: routine days → model declares no durable change → artifact untouched, zero/near-zero diff recorded. Core principle: "tweak if needed", never rewrite the relationship around yesterday, never drop older meaningful moments.
- **Change threshold**: only material change for a new recurring preference, changed relationship pattern, sticky new inside joke, major emotional event, new stable mannerism, or new long-horizon shared memory.

### Implementation Map (`memory-lifetime.ts` keys)

| Concern | Key |
| :--- | :--- |
| Initialization | `provision()` :687 |
| Incremental update | `applyIncrementalUpdate()` :1117 — entry point, fired on boot/card-switch from `App.vue` |
| Windowed collector | `collectWindowedDocs()` :1033 — universe-scoped raw turns + new LTMM after the watermark |
| Merge prompt | `buildIncrementalMergePrompt()` :331 + `IncrementalMergeSchema` :100 (structured JSON with `changed` flag) |
| Bootstrap watermark | `getYesterdayLocalDayKey()` :168 — forward-seal fallback for legacy artifacts |
| Catchup cap | `MAX_CATCHUP_DAYS_PER_RUN = 14` — leftover days roll to the next trigger |
| Version | `artifact.version` — bumped only on changed merges |
| Watermark | `metadata.lastConsumedDay` — the last fully-consumed day |

### Gaps Checklist (Status)

- [x] Watermark on artifact metadata (per `{characterId}:{universeId}` — the last consumed STMM day key / LTMM cutoff) — done, bootstrap path seals legacy artifacts at yesterday
- [x] Trigger hook: after STMM `ensureYesterdayBlock()` — done, wired in `App.vue` boot + card-switch watcher
- [x] Update collector: universe-scoped 24h raw window since the watermark + new LTMM — `collectWindowedDocs()`
- [x] Merge pass: prompt + JSON schema enforcing merge rules — done, model re-emits full pack each run
- [x] Zero-change detection contract — done, `changed: false` from model leaves artifact untouched
- [x] Version / diff-record storage — `version` bumped only on changes; `updateHistory` capped at 30 audit entries
- [x] Rebase rules (v1 simplified) — merged artifact stored whole; manual reset = `reprovisionFromChunks()`/`restart()`. Real auto-rollup (consolidation pass when the diff chain degrades) is deferred to v2

## Pitfalls

- Repo key is `{characterId}:{universeId}` now — code still reads the old bare key only via the migration helper (:10); don't write bare keys.
- Universe scoping is mandatory end to end: source collection, watermark, and trigger hook must all agree on `universeId` (default `'global'`) or universes cross-contaminate.
- Provider/model for provisioning comes from the card's `consciousness` module fallback to active provider; a misconfigured card consciousness silently switches the synthesis brain.
- The artifact is derived (regenerable) but must not overwrite sacral journal entries during source collection — reads only.
- Incremental update must not re-run the full chunking pipeline; inputs are the existing artifact + 24h window, not full history.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: run provisioning from the Eternal Thread / Memory settings UI and watch `local:memory/provisioning-session/{characterId}` advance `aggregating → chunking → synthesizing → distill_pass_1 → distill_pass_2 → success` (see `airi-memory-provisioning`). Once maintenance lands: trigger an STMM daily generation and confirm the watermark advances and the artifact version increments (or zero-change is recorded).

## Sources

`docs/memory_lab/lifetime-artifact-generation-plan.md` (update cadence, change threshold, rebase rules, failure modes); `docs/memory_lab/state-of-system.md` (base + diffs validation); `docs/memory_lab/memory-engine-integration-plan.md` (original Dream State hook sketch, superseded by STMM trigger); `docs/data-catalog.md` §1.8/§1.9; peer: `airi-memory-systems` (hub), `airi-memory-provisioning`, `airi-memory-short-term` (trigger/cadence), `airi-memory-text-journal` (LTMM input), `airi-memory-ui-pages` (Eternal Thread), `airi-memory-chat-sessions`.
