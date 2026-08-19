---
name: airi-memory-echo-chips
description: >-
  Use when working with AIRI memory pillar 4 — Echo Chips: echo-chips.ts store (374 lines), echo-chips.repo (local:memory/echo-chips/{userId}), 3–5 semantic chips per character (types mood / flavor / journal_candidate), RWKV-7 0.1B salience gating (winner-take-2-of-3 Delta-h vote), LLM tag synthesis via generateObject, collectWindowMessages evidence windows, and chip display in the right-context panel. Trigger on echo chips, memory chips, emotional anchors, or chip salience/synthesis. Hub: airi-memory-systems.
---

# Memory Pillar 4 — Echo Chips

Lightweight semantic fragments (3–5 per character) surfaced as at-a-glance recall in the context panel. Two-stage pipeline: a tiny RWKV model votes on which turns are salient, then the main LLM synthesizes the actual chip text.

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/echo-chips.ts` (374 ln) — `useEchoesStore` :106 |
| Repo | `packages/stage-ui/src/database/repos/echo-chips.repo.ts` → `local:memory/echo-chips/{userId}` |
| Chip shape | `EchoChip` — `type: 'mood' | 'flavor' | 'journal_candidate'` (+ text, characterId, universe/session tags) |
| Data catalog | `docs/data-catalog.md` §1.10 |

## Key Mechanisms

- **Evidence collection**: `collectWindowMessages(characterId, options?)` (:184) gathers the recent sanitized evidence window (`sanitizeChatContent` :52 strips markup).
- **Synthesis**: `synthesizeForCharacter()` (:238) → `llmStore.generateObject` produces 3–5 typed chips from the evidence window.
- **Salience gate (matters for accuracy)**: candidate turns pass the 0.1B RWKV-7 Δh state-vector winner-take-2-of-3 vote (Phase 4b provenance: L9–L11 @ 1.5×, Recall 0.818 / Precision 0.90 / F1 0.857 / FPR 0.125). The tiny model **only votes salience** — Phase 3 showed 0/14 structured output, so tag/text generation is always delegated to the LLM. Do not assume the local model emits final chips.
- `getCharacterChips(characterId)` (:180) feeds the context-panel ticker; universe filtering follows the session meta like all pillars.

## Pitfalls

- The gate is a candidate filter, not a generator — removing either stage breaks the pipeline.
- Chips are derived and regenerable (same as STMM); never treat one as a journal entry (discrete pillar 2).
- `journal_candidate`-type chips are hand-off points into the echo-chip → text-journal-promotion flow (consolidation skill).

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: trigger chip synthesis from Settings → Memory (echo lane) and confirm 3–5 chips land in `local:memory/echo-chips/{userId}` and the right-context panel.

## Sources

`docs/proposal-echo-chips-rwkv-synthesis.md`; `docs/memory_lab/state-of-system.md` (chip/pill generation); peer: `airi-memory-systems` (hub), `airi-memory-consolidation-dreaming`, `airi-local-inference-engines` (RWKV worker), `airi-memory-ui-pages`.
