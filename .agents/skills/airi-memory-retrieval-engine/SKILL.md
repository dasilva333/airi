---
name: airi-memory-retrieval-engine
description: >-
  Use when working with AIRI memory retrieval and ranking — hybrid semantic search, Tiered Router, 5W extraction, concept normalization, multi-field candidate search, fused-signal reranking, and the docs/memory_lab specs (retrieval-and-ranking-spec, search-probe-harness-plan) plus packages/stage-ui/src/libs/search/layered-memory.ts.
---

## Key Files/Locations

- `docs/memory_lab/retrieval-and-ranking-spec.md` — Canonical spec for the retrieval pipeline; defines query analysis, search plans, candidate fusion, reranking, category priors, and evidence selection.
- `docs/memory_lab/search-probe-harness-plan.md` — Test-harness plan for measuring product-shaped search quality and latency (requires iterative search, hit@k, <30s wall clock).
- `packages/stage-ui/src/libs/search/layered-memory.ts` — Wrapper over the search worker; persists to a separate `airi-search-index` IndexedDB; maps record kinds to layers (`raw`/`stmm`/`ltmm`).
- `packages/stage-ui/src/libs/search/hybrid-scorer.ts` — `defaultScorerConfig` + `scoreHybridResults()` combine vector and keyword signals into a fused rank.
- Docs root: `docs/rosetta-stone.md` §9 for the memory-systems canonical path index.

## When to Use
Use this skill when you need to design, debug, or benchmark memory retrieval:
- Implementing or improving the Tiered Router — distinguishing **Literal (single-hop)** from **Bridge C1 (multi-hop)** from **Detective C3 (open-domain)** queries and routing them appropriately.
- Changing how 5W extraction works (`who`/`what`/`where`/`when`/`why` + `temporal_marker` + `resolved_date`).
- Tuning multi-field candidate search over `fact`, `observed_text`, `subject`, `room`, etc.
- Updating fused-signal reranking (vector, lexical/BM25, focus-query similarity, keyword overlap, predicate overlap, entity overlap, temporal relevance, room affinity, subject match, dimension match, record-kind prior, cross-plan reciprocal-rank fusion).
- Working with the search-probe harness to validate that search is fast (<30s), iterative, and auditable (debug artifacts per run).
- Adding or modifying the search storages listed in `docs/memory_lab/memory-lifecycle-and-features.md` (raw adapter, summary adapter, journal adapter).

## Common Pitfalls

- **Single wide search** — The spec explicitly forbids "one wide blind search"; always prefer multi-pass retrieval with purpose-built search plans (baseline, temporal, multi-hop, causal, open-domain).
- **Treating `room` as a hard filter** — `room` is optional experimental metadata and should only be a soft reranking feature / hint, not a mandatory taxonomy gate.
- **Rewriting protected layers** — The retrieval spec says the system should remain "evidence-first"; summaries are allowed for open-domain but must stay anchored to evidence. Never let a retrospective/abstraction summary become the sole citation for a fact check.
- **Key mismatch in search index** — `layered-memory.ts` uses `KIND_MAP` to translate document kinds (`user_turn`, `journal_entry`, `echo_chip`, …) to memory layers (`raw`, `stmm`, `ltmm`). If your new record type isn't mapped, it will be treated as `raw`.
- **Ignoring latency targets** — The product requirement is <30s per search interaction, with a preference for speed over absolute top-1 perfection because the agent loop may search again.
- **Missing debug observability** — Every benchmark/production run should emit a dated artifact folder with question analysis, raw search inputs, candidate pools, selected evidence, prompts, model outputs, and any failure traces.
- **Overfitting to a category** — `c4` single-hop needs literal evidence lists; don't drown it in summaries. `c3` open-domain allows summaries, but still requires evidence-first grounding.

## Verification

1. Run `pnpm -F stage-ui typecheck` to ensure the search libs and related stores compile after any change.
2. Inspect the `airi-search-index` IndexedDB (DevTools → Application → IndexedDB) to confirm documents were indexed under the expected layer/kind.
3. Execute a manual query through the search API (or a quick probe per `search-probe-harness-plan.md`) and confirm: (a) answers surface near top, (b) the experience is iterative, (c) the total loop stays <30s, and (d) per-run artifacts include plan names, per-plan ranks, matched fields, and final fusion scores.
