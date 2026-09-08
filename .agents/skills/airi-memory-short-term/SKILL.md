---
name: airi-memory-short-term
description: >-
  Build/debug Short-Term Memory (STMM): daily summaries, continuity blocks, token budgets, history windows, rebuilds, deduplication, universe-scoped day buckets. Raw chat history uses airi-memory-chat-sessions; lifetime distillation uses airi-memory-lifetime.
---

# Memory Pillar 3 — Short-Term Memory (STMM)

Daily continuity blocks distilled from chat history — one block per character per day. This is the layer that gives a fresh session yesterday's continuity.

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/memory-short-term.ts` (598 ln) — `useShortTermMemoryStore` :136 |
| Repo | `packages/stage-ui/src/database/repos/short-term-memory.repo.ts` → `local:memory/short-term/{userId}` |
| Block shape | `ShortTermMemoryBlock` (`date` local day key, `summary`, `characterId`, `universeId?`, `sessionId?`) |
| Data catalog | `docs/data-catalog.md` §1.7 |

## Key Mechanisms

- **Per-day bucketing**: `collectCharacterDayBuckets(characterId, universeId = 'global')` (:263) groups message history into local day keys (`formatLocalDayKey` :62) filtered by universe.
- **Summarization**: `summarizeBucket()` (:310) calls `llmStore.generate` with `buildSummarizerMessages()` (:99 — language-aware context prompt) producing the day's block under the token budget.
- **Card config**: budget/window live on `card.extensions.airi.shortTermMemory`: `tokenBudgetPerDay` (fallback **1000**) and `windowSize` (fallback **3**). Never hardcode — per-card overrides are supported.
- **Rebuilds & Lifecycle**: `rebuildFromHistory()` (:368) re-derives all blocks for a character; `rebuildToday()` (:443) refreshes the current day; `ensureYesterdayBlock()` (:505) guarantees yesterday exists for session resets.
- **Multi-window safety & deduplication**: `normalizeBlocks()` collapses duplicates sharing `(userId, characterId, date, universeId)` to heal stored duplicates on load. `App.vue` gates `ensureYesterdayShortTermBlockForActiveCharacter()` to `isMainWindow` only to prevent multi-window Electron startup races.
- **Deletion**: `deleteBlock(blockId)` (:578) removes a daily summary block, persists to repo, and broadcasts `airi:short-term-memory-sync`.
- **Prompt injection**: the *consumer* is pillar 1 — `session-store.ts` `buildShortTermMemoryContext()` (:210) takes the newest `windowSize` blocks and emits `[Short-Term Memory]` in the system prompt.

## Pitfalls

- Blocks are derived, not sacred — they may be freely regenerated (unlike journal, pillar 2) or deleted by the user.
- Secondary Electron windows (Chat, Customizer, Control Strip) must NOT trigger automatic generation on boot or card switches — always guard via `isMainWindow`.
- In-memory concurrency locks (`runningEnsure`) are per-process; `ensureYesterdayBlock` and `rebuildToday` must perform in-flight index lookups before saving to avoid duplicate appends.
- Universe filter defaults to `'global'` — must match pillar 1's session `universeId` or sessions see the wrong continuity.
- Search layer: `memory_block` kind maps to `stmm` layer in `layered-memory.ts` (`airi-memory-retrieval-engine`) — a new block shape must keep the doc-kind mapping valid.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: trigger a rebuild in Settings → Memory (Short-Term lane, `airi-memory-ui-pages`) and confirm per-day block writes in `local:memory/short-term/{userId}`.

## Sources

`docs/arch-short-term-memory-summaries.md`; `docs/memory_lab/memory-lifecycle-and-features.md` (Summary adapter); peer: `airi-memory-systems` (hub), `airi-memory-consolidation-dreaming`, `airi-memory-chat-sessions`.

## Related Skills & References

- **Peer Skills**: [[airi-memory-chat-sessions]], [[airi-memory-consolidation-dreaming]], [[airi-memory-retrieval-engine]], [[airi-memory-systems]], [[airi-memory-ui-pages]]
- **Key Documents**: [[data-catalog]], [[arch-short-term-memory-summaries]], [[memory-lifecycle-and-features]]
