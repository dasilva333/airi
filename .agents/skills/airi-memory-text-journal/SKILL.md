---
name: airi-memory-text-journal
description: >-
  Use when working with AIRI memory pillar 2 — the Long-Term Text Journal (LTMM): memory-text-journal.ts store (598 lines), text-journal.repo (local:memory/text-journal/{userId}), the Sacred Journal append-only rule, the text_journal builtin tool (create/search), universe-scoped entry filtering, and journal indexing into the semantic search layer. Trigger on journal entries, LTMM, text_journal tool, or sacred/append-only journal constraints. Airi memory pillar hub: airi-memory-systems.
---

# Memory Pillar 2 — Text Journal (LTMM)

The durable, append-only long-term memory archive. Entries are authored by the assistant via the `text_journal` tool (or manual edits) and are the highest-authority memory class — core to the Sacred Journal Rule.

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/memory-text-journal.ts` (598 ln) — `useTextJournalStore` :60 |
| Repo | `packages/stage-ui/src/database/repos/text-journal.repo.ts` → `local:memory/text-journal/{userId}` |
| Entries | `TextJournalEntry` (`characterId`, `universeId?`, `sessionId?`, title/content, timestamps) |
| Data catalog | `docs/data-catalog.md` §1.6 |

## Key Mechanisms

- **Universe scoping**: `sortedEntries` computed (:80+) resolves the active session's `universeId` via `chatSessionStore.getSessionMeta(activeSessionId)` and filters `entry.universeId || 'global'` (:90) — the canonical fallback every read must use.
- **Writing path**: assistant tool call `text_journal` (`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/text-journal.ts`; actions `create`/`search`) → store append → repo persist → search index refresh.
- **Search integration**: `backgroundIndexAll()` (:131+) maps entries into the layered search pipeline (`journal_entry` kind → `ltmm` layer) so semantic recall covers the journal.
- **Cross-intrusion staging**: journal writes are announced over the `airi-intrusion-staging` BroadcastChannel for contextual card updates (:67-70).

## The Sacred Journal Rule

Manual and assistant-written journal entries are **append-only and high-authority**:

- No automated worker may edit, delete, or rewrite an entry in place.
- Derived stores (lifetime artifacts, echo chips, STMM) may be regenerated; the journal cannot.
- Any feature that "updates" a journal entry must create a new entry instead. This is audited by `airi-memory-consolidation-dreaming` and the Rosetta Stone.

## Pitfalls

- Filtering by `characterId` alone without the universe fallback leaks memories across storylines.
- The `text_journal` tool gate: cards without an `allowedTools` entry for `text_journal` filter the tool out at the gateway (`llm.ts` `filterToolsByAllowedTools`).
- Do not store large blobs in entries — text only; images belong to pillar 6.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: trigger a journal tool call, confirm the `local:memory/text-journal/{userId}` write, and that the Eternal Thread UI lists it (see `airi-memory-ui-pages`).

## Sources

`docs/content/en/docs/advanced/architecture/arch-long-term-memory-journal.md`; `docs/content/en/docs/advanced/architecture/design-text-journal-storage.md`; `docs/memory_lab/memory-schema-and-lifecycle-spec.md` (Journal/Sacred record family); peer skills: `airi-memory-systems` (hub), `airi-memory-retrieval-engine`, `airi-memory-consolidation-dreaming`, `airi-data-persistence`.
