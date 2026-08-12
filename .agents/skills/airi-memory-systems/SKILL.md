---
name: airi-memory-systems
description: >-
  Use when working with AIRI memory systems — long-term journal, short-term daily summaries, lifetime-memory synthesis, Echo-Chips, semantic search indexing, and the stores/repos under packages/stage-ui/src (memory-text-journal, memory-short-term, memory-lifetime, echo-chips) including Orama/Voy/Transformers.js, RWKV-7 salience gating, and provisioning sessions.
---

## Key Files/Locations

**Pinia Stores**
- `packages/stage-ui/src/stores/memory-text-journal.ts` — Long-term journal (`local:memory/text-journal/{userId}`) used for append-only personal journal entries; owned by the user/AIRI, never auto-rewritten.
- `packages/stage-ui/src/stores/memory-short-term.ts` — Daily summary blocks (`local:memory/short-term/{userId}`) with `tokenBudgetPerDay` (default 1000) and `windowSize` (default 3); exposes `rebuildFromHistory()` and `rebuildToday()` for per-day token-budget rebuilding across chat history, and `ensureYesterdayBlock()` for continuity.
- `packages/stage-ui/src/stores/memory-lifetime.ts` — Eternal Thread lifetime artifact (`local:memory/lifetime/{characterId}`) plus provisioning pipeline; composes the synthesis prompts and orchestrates chunked summarization from raw history into a canned identity profile.
- `packages/stage-ui/src/stores/echo-chips.ts` — Semantic "Echo Chips" (`local:memory/echo-chips/{userId}`); `synthesizeForCharacter()` extracts 3–5 chips (types: `mood`, `flavor`, `journal_candidate`) via `llmStore.generateObject` against a sanitized evidence window.

**Database Repos**
- `packages/stage-ui/src/database/repos/text-journal.repo.ts`
- `packages/stage-ui/src/database/repos/short-term-memory.repo.ts`
- `packages/stage-ui/src/database/repos/lifetime-memory.repo.ts`
- `packages/stage-ui/src/database/repos/provisioning-session.repo.ts` — tracks `ProvisioningSession` (`local:memory/provisioning-session/{characterId}`) with phases `idle | aggregating | chunking | synthesizing | distill_pass_1 | distill_pass_2 | success`; persists chunk summaries so a long provisioning run can be resumed.
- `packages/stage-ui/src/database/repos/echo-chips.repo.ts`

**Semantic Search Index**
- `packages/stage-ui/src/libs/search/layered-memory.ts` — wraps the `searchWorker` and persists the snapshot to a separate `airi-search-index` IndexedDB store. Supports `init()`, `persist()`, `search(query, limit, characterId)`, `indexDocuments()`, `removeDocument()`; maps doc kinds (`user_turn`/`assistant_turn`/`memory_block`/`journal_entry`/`echo_chip`/`lifetime_entry`) to layers (`raw`/`stmm`/`ltmm`).
- `packages/stage-ui/src/libs/search/hybrid-scorer.ts` — computes fused (`vector`/`keyword`) hybrid scoring after retrieval.
- Search worker code lives under `packages/stage-ui/src/libs/workers/search/`.

## When to Use
Use this skill whenever you add, debug, or refactor anything that:
- Stores or retrieves long-term journal entries, short-term daily summary blocks, lifetime memory artifacts, or Echo Chips.
- Changes the daily-summary token budget (`tokenBudgetPerDay`) or the sliding context window (`windowSize`).
- Updates the 5-stage lifetime synthesis pipeline (collect → chunk → base → Pass 1 → Pass 2).
- Touches the embedding/semantic index (Orama / Voy / Transformers.js) or the `layered-memory.ts` search wrapper.
- Works with the RWKV-7 0.1B salience gate that decides which chat turns are promoted into Echo-Chip candidates.
- Deals with resumable provisioning sessions (LLM-based profile generation from raw chat).

## Common Pitfalls

- **Citing `crates/` for memory code** — the legacy Tauri path is gone. All current memory code lives in `packages/stage-ui/src/stores/` and `packages/stage-ui/src/database/repos/`.
- **Breaking the sacred journal rule** — Long-term / manual journal entries (`text-journal.repo.ts`) are append-only and high-authority. Do not introduce in-place editing, deletion, or auto-rewriting by workers; only derived stores (DRMM/lifetime/echo-chips) may be updated by the consolidation pipelines.
- **Forgetting the separate search index** — `layered-memory.ts` persists vector/embeddings to a *separate* IndexedDB named `airi-search-index`. Data loss or schema mismatches often come from assuming the index lives in the regular `local:*` namespace.
- **Wrong layer mapping** — `KIND_MAP` in `layered-memory.ts` maps `memory_block` → `stmm`, `journal_entry` → `ltmm`, etc. If you add a new record kind and don't add the mapping, the query router will treat it as `raw`.
- **Missing resume checkpoints** — Lifetime provisioning is resumable via `provisioning-session.repo.ts`. Never refactor the pipeline to clear state without writing an update; do not bypass `collectSourceDocs()` -> chunked summarization.
- **Echo-Chips salience over-promise** — Echo-Chips are *gated* by a 0.1B RWKV-7 Δh state-vector vote (Phase 4b provenance: L9–L11 Δh vote-2of3 @ 1.5×, Recall 0.818 / Precision 0.90 / F1 0.857 / FPR 0.125). The 0.1B model itself does **not** generate tags (Phase 3 showed 0/14 structured output) — tag generation is delegated to the LLM in `synthesizeForCharacter()`. Don't assume the tiny model emits final chips.
- **Token budget mishandling** — `rebuildFromHistory()` and `rebuildToday()` in `memory-short-term.ts` source `tokenBudgetPerDay` from `card.extensions.airi.shortTermMemory` with a fallback of 1000. Hard-coding a different default will desync character-specific configs.


### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §9 memory-systems canonical path index.
- [docs/content/en/docs/advanced/architecture/arch-memory-system-overview.md](docs/content/en/docs/advanced/architecture/arch-memory-system-overview.md) — Memory system architecture overview.
- [docs/content/en/docs/advanced/architecture/arch-long-term-memory-journal.md](docs/content/en/docs/advanced/architecture/arch-long-term-memory-journal.md) — Long-term memory journal architecture.
- [docs/content/en/docs/advanced/architecture/arch-short-term-memory-summaries.md](docs/content/en/docs/advanced/architecture/arch-short-term-memory-summaries.md) — Short-term memory summaries architecture.
- [docs/content/en/docs/advanced/architecture/design-text-journal-storage.md](docs/content/en/docs/advanced/architecture/design-text-journal-storage.md) — Text journal storage design.
- [docs/content/en/docs/advanced/architecture/design-image-journal-storage.md](docs/content/en/docs/advanced/architecture/design-image-journal-storage.md) — Image journal storage design.
- [docs/memory_lab/state-of-system.md](docs/memory_lab/state-of-system.md) — Memory lab state-of-system document.
- [docs/memory_lab/memory-engine-integration-plan.md](docs/memory_lab/memory-engine-integration-plan.md) — Memory engine integration plan.
- [docs/memory_lab/production-transition-spec.md](docs/memory_lab/production-transition-spec.md) — Memory production transition spec.
- [docs/proposal-echo-chips-rwkv-synthesis.md](docs/proposal-echo-chips-rwkv-synthesis.md) — Echo chips RWKV synthesis proposal.

## Verification

1. `pnpm -F stage-ui typecheck` (or the workspace-specific typecheck) to ensure the stores and repos compile.
2. Inspect `localStorage` equivalent in the app: confirm `local:memory/short-term/*`, `local:memory/text-journal/*`, and `local:memory/echo-chips/*` populate after a journal refresh / rebuild run.
3. Run a journaling or rebuild action in the Settings → "Short-Term Memory" UI (or via the internal store call) and verify a `Snapshot` write occurs in the `airi-search-index` IndexedDB (visible in the browser DevTools Application tab).
4. For lifetime memory changes, verify `provisioning-session.repo.ts` state progresses through phases `aggregating → chunking → synthesizing → distill_pass_1 → distill_pass_2 → success` and that the final artifact appears in `local:memory/lifetime/{characterId}`.
