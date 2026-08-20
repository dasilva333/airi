---
name: airi-memory-consolidation-dreaming
description: >-
  Use when working with AIRI memory consolidation and dreaming — the triple-store model (STMM ephemeral / LTMM immutable / DRMM dynamic), Sacred Journal Rule, PCL contradiction handling with invalidation gates, Dreaming Worker, Emotional Exhaust deltas updating global MoodState, and docs/memory_lab spec files (design-prospective-rich-journal, memory-schema-and-lifecycle-spec, memory-lifecycle-and-features).
---

## Key Files/Locations

- `docs/memory_lab/design-prospective-rich-journal.md` — Defines the Triple-Store model, the explicit split between **Proactive Amusement** vs **Memory Consolidation (Dreaming)**, the Sacred Irreplaceable Journal Rule, the Dream Worker purpose, and the "Emotional Exhaust" / `MoodState` mechanism.
- `docs/memory_lab/memory-schema-and-lifecycle-spec.md` — Canonical schema & lifecycle; defines record families (Fact, Event, Session Summary, Profile Summary, Sacred/Journal), authority ordering, lifecycle stages (Observe → Extract → Normalize → Store → Reinforce → Update → Invalidate/Supersede → Summarize → Consolidate → Retire), and contradiction handling.
- `docs/memory_lab/memory-lifecycle-and-features.md` — Lifecycle & features spec; covers the triple-format Adaptive Indexing Model (Raw, Summary/STMM, Journal/LTMM), immutable historical integrity, and mood-tag emission rules.
- `packages/stage-ui/src/types/mood.ts` — `MoodState` interface (`current: CoreMood`, `intensity: 0..1`, `valence: -1..1`, `arousal: -1..1`, `lastUpdate`); mood logging via `MoodLogEntry` (`timestamp`, `userId`, `characterId`, `context`, `shift.valence`, `shift.arousal`).
- For runtime integration, see memory stores (`packages/stage-ui/src/stores/memory-short-term.ts`, `memory-text-journal.ts`, `memory-lifetime.ts`, `echo-chips.ts`) and the persistence repos under `packages/stage-ui/src/database/repos/`.

## When to Use
Use this skill when:
- Designing, implementing, or reviewing the **Triple-Store architecture** (Ephemeral STMM, Immutable Sacred LTMM, Dynamic DRMM) as described in `design-prospective-rich-journal.md`.
- Adding or modifying any worker that does memory consolidation ("Dreaming"): deriving new facts, episodes, or semantic tags from raw history or LTMM, or writing into the DRMM layer.
- Enforcing the **Sacred Irreplaceable Journal Rule** — user/manual journal entries (and other LTMM records) are immutable by automated processes; workers derive value but never rewrite.
- Handling contradictions or evolving truths via the **PCL (Predict-Calibrate-Learn)** flow and invalidation gates (e.g., "I like coffee" → "I hate coffee" should supersede, not silently overwrite).
- Updating the global **`MoodState`** through Emotional Exhaust / Sentiment Deltas from consolidation passes (the dreaming worker's side effect that updates `MoodState.current`, `intensity`, `valence`, `arousal`).
- Building UI surfaces (Rich Journal feed) that show Daily Recap, Personal Insight, Episode, or Fact artifacts (see `design-prospective-rich-journal.md` and `memory-schema-and-lifecycle-spec.md`).

## Common Pitfalls

- **Resurrecting the old flat memory model** — The compact 24h blocks are not the only truth. The current direction is a mixed rail of STMM recap blocks plus chronological semantic chips / episodes (see `memory-schema-and-lifecycle-spec.md` Deep Dives).
- **Letting the Dreaming Worker edit LTMM** — Manual journal entries are "sacred": never overwrite, delete, or resynthesize them in place. They may be cited, linked, or used as provenance, but their content stays frozen.
- **Skipping supersession/invalidation semantics** — When a belief changes, the old record remains historical and the new one becomes current. Hard-deleting contradicts the spec and destroys auditability.
- **Assuming mood updates are free-form** — Mood emission must map to the 6+1 standardized tags (`happy | sad | surprised | angry | neutral | think | cool`) from `memory-lifecycle-and-features.md`; the consolidation pass emits a Sentiment Delta (valence/arousal) that updates `MoodState`.
- **Confusing summarization with evidence** — Summaries (Session Summary / Profile Summary) are allowed in open-domain answers but must remain *anchored* to underlying evidence; they are never a universal replacement for literal facts.
- **Ignoring authority tiers** — The spec defines an authority ordering: user-authored/manual journal records rank highest, followed by observed/repeated facts, well-provenanced events, session summaries, profile summaries, and derived/speculative abstractions. Do not treat all records equally.
- **Backward-compat shims for preserved chat logs** — Raw chat logs are operational input, not sacred memory; users may delete them. Don't build features that require raw chat logs to persist forever for correctness (they should be safe to lose once indexed).


### Authoritative Design & Architecture Documents

- [docs/memory_lab/design-prospective-rich-journal.md](docs/memory_lab/design-prospective-rich-journal.md) — Triple-Store model, Sacred Journal Rule, Dream Worker, Emotional Exhaust/MoodState.
- [docs/memory_lab/memory-schema-and-lifecycle-spec.md](docs/memory_lab/memory-schema-and-lifecycle-spec.md) — Canonical schema & lifecycle spec.
- [docs/memory_lab/memory-lifecycle-and-features.md](docs/memory_lab/memory-lifecycle-and-features.md) — Lifecycle & features spec (Adaptive Indexing Model).
- [docs/memory_lab/great_merger_cheat_sheet.md](docs/memory_lab/great_merger_cheat_sheet.md) — Great merger cheat sheet.
- [docs/memory_lab/ultimate_hybrid_design_doc_detailed.md](docs/memory_lab/ultimate_hybrid_design_doc_detailed.md) — Ultimate hybrid design doc (detailed).
- [docs/memory_lab/lifetime-artifact-generation-plan.md](docs/memory_lab/lifetime-artifact-generation-plan.md) — Lifetime artifact generation plan.
- [docs/arch-long-term-memory-journal.md](docs/arch-long-term-memory-journal.md) — Long-term memory journal architecture.

## Verification

1. `pnpm -F stage-ui typecheck` (or the relevant workspace typecheck) after editing stores, types, or docs consumers.
2. Confirm the invariants hold in the running app:
   - Manual journal entries (LTMM) stay unchanged after a consolidation pass.
   - STMM recap blocks are reinjected in the last-configured window after a chat reset.
   - Mood/log updates emitted during Dreaming produce a measurable `MoodState` delta and a `MoodLogEntry` that lands in the appropriate store/logs.
   - Contradictions result in new/linked records with `Invalidate`/`Supersede` semantics rather than silent overwrite.
3. Validate artifact feeds (chat UI rail, Rich Journal feed) render the three tiers distinctly (Daily Recap, Personal Insight, Episode, Fact) and that the UI respects the "sacred" distinction when any kind of edit affordance is exposed.

## Related Skills & References

- **Key Documents**: [[design-prospective-rich-journal]], [[memory-schema-and-lifecycle-spec]], [[memory-lifecycle-and-features]], [[great_merger_cheat_sheet]], [[ultimate_hybrid_design_doc_detailed]], [[lifetime-artifact-generation-plan]], [[arch-long-term-memory-journal]]
