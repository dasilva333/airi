---
name: airi-memory-retrieval-engine
description: >-
  Use when working with AIRI memory retrieval and ranking — hybrid semantic search, Tiered Router, 5W extraction, concept normalization, multi-field candidate search, fused-signal reranking, and the docs/memory_lab specs (retrieval-and-ranking-spec, search-probe-harness-plan) plus packages/stage-ui/src/libs/search/layered-memory.ts.
---

## Key Files/Locations

- `docs/memory_lab/retrieval-and-ranking-spec.md` — Canonical spec for the retrieval pipeline; defines query analysis, search plans, candidate fusion, reranking, category priors, and evidence selection.
- `docs/memory_lab/search-probe-harness-plan.md` — Test-harness plan for measuring product-shaped search quality and latency (requires iterative search, hit@k, <30s wall clock).
- `packages/stage-ui/src/libs/workers/search/search.worker.ts` — Browser-native search worker. Runs `@huggingface/transformers` (`Xenova/bge-small-en-v1.5` on WebGPU/WASM) for embeddings alongside an in-memory `Map<string, SearchDocument>` and token frequency caches for BM25.
- `packages/stage-ui/src/libs/search/layered-memory.ts` — Wrapper over the search worker; persists index snapshots to a separate `airi-search-index` IndexedDB via unstorage; maps record kinds to layers (`raw`/`stmm`/`ltmm`).
- `packages/stage-ui/src/libs/search/hybrid-scorer.ts` — `defaultScorerConfig` (`weightVector: 0.68`, `weightKeyword: 0.32`, `temporalWeight: 0.12`, `minVectorSimilarity: 0.38`, `minScoreSpread: 0.04`, `halfLifeDays: 30`, `rrfK: 60`, `mmrLambda: 0.5`) + `scoreHybridResults()` combine vector and keyword signals into a fused rank.
- `packages/stage-ui/src/stores/memory-text-journal.ts` — `searchEntries({ query, limit: 3, characterId })` executes layered memory queries across LTMM/STMM/Raw.
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

- **Candidate pool sizing vs limit** — `search.worker.ts` computes `candidateLimit = Math.max(limit * 5, 20)` (minimum 20 candidates). The final scored list is sliced to `limit` (default 3 in chat ingestion / pre-flight grounding). Do not assume `limit` is what the worker retrieves from raw vector candidates.
- **Worker in-memory RAM vs IndexedDB** — Embeddings and BM25 index maps live in the Web Worker's heap in RAM for instant lookup. When documents are indexed/removed, `searchWorker.persist()` outputs a snapshot that is saved to IndexedDB (`airi-search-index`). If you bypass `layeredMemory.persist()` or fail to call `init()`, the worker starts empty.
- **Single wide search** — The spec explicitly forbids "one wide blind search"; always prefer multi-pass retrieval with purpose-built search plans (baseline, temporal, multi-hop, causal, open-domain).
- **Treating `room` as a hard filter** — `room` is optional experimental metadata and should only be a soft reranking feature / hint, not a mandatory taxonomy gate.
- **Rewriting protected layers** — The retrieval spec says the system should remain "evidence-first"; summaries are allowed for open-domain but must stay anchored to evidence. Never let a retrospective/abstraction summary become the sole citation for a fact check.
- **Key mismatch in search index** — `layered-memory.ts` uses `KIND_MAP` to translate document kinds (`user_turn`, `journal_entry`, `echo_chip`, …) to memory layers (`raw`, `stmm`, `ltmm`). If your new record type isn't mapped, it will be treated as `raw`.
- **Ignoring latency targets** — The product requirement is <30s per search interaction, with a preference for speed over absolute top-1 perfection because the agent loop may search again.
- **Missing debug observability** — Every benchmark/production run should emit a dated artifact folder with question analysis, raw search inputs, candidate pools, selected evidence, prompts, model outputs, and any failure traces.
- **Overfitting to a category** — `c4` single-hop needs literal evidence lists; don't drown it in summaries. `c3` open-domain allows summaries, but still requires evidence-first grounding.


### Authoritative Design & Architecture Documents

- [docs/memory_lab/retrieval-and-ranking-spec.md](docs/memory_lab/retrieval-and-ranking-spec.md) — Canonical spec for the retrieval pipeline.
- [docs/memory_lab/search-probe-harness-plan.md](docs/memory_lab/search-probe-harness-plan.md) — Test-harness plan for measuring product-shaped search quality.
- [docs/memory_lab/evaluation-and-benchmarking-methodology.md](docs/memory_lab/evaluation-and-benchmarking-methodology.md) — Evaluation and benchmarking methodology.
- [docs/memory_lab/benchmark_history_and_outlook.md](docs/memory_lab/benchmark_history_and_outlook.md) — Benchmark history and outlook.
- [docs/memory_lab/scoped-probe-window-plan.md](docs/memory_lab/scoped-probe-window-plan.md) — Scoped probe window plan.
- [docs/content/en/docs/advanced/architecture/design-semantic-search-browser-native.md](docs/content/en/docs/advanced/architecture/design-semantic-search-browser-native.md) — Browser-native semantic search design.
- [docs/content/en/docs/advanced/architecture/blueprint-semantic-search-integration.md](docs/content/en/docs/advanced/architecture/blueprint-semantic-search-integration.md) — Semantic search integration blueprint.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §9 memory-systems canonical path index.

## Verification

1. Run `pnpm -F stage-ui typecheck` to ensure the search libs and related stores compile after any change.
2. Inspect the `airi-search-index` IndexedDB (DevTools → Application → IndexedDB) to confirm documents were indexed under the expected layer/kind.
3. Execute a manual query through the search API (or a quick probe per `search-probe-harness-plan.md`) and confirm: (a) answers surface near top, (b) the experience is iterative, (c) the total loop stays <30s, and (d) per-run artifacts include plan names, per-plan ranks, matched fields, and final fusion scores.
