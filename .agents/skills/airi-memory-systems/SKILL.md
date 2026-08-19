---
name: airi-memory-systems
description: >-
  Use when working with AIRI memory systems at scale — the Eight Pillars of Memory hub skill covering chat sessions, text journal (LTMM), short-term daily summaries (STMM), echo chips, lifetime artifacts, image journal / autonomous artistry backgrounds, event log, and provisioning sessions. This skill is deliberately a map-of-maps: it locates each pillar's store, repo, storage namespace, universe tagging, and prompt-injection point, then defers implementation detail to the eight dedicated pillar skills plus retrieval (airi-memory-retrieval-engine), consolidation (airi-memory-consolidation-dreaming), and UI (airi-memory-ui-pages). Trigger on cross-pillar questions, universe isolation, memory data model overview, or "which skill owns this memory". Grounded in: docs/data-catalog.md, docs/timeline-flat-design.md, docs/memory_lab/.
---

# AIRI Memory Systems — The Eight Pillars Hub

Every durable piece of character memory in AIRI is one of **eight pillars** (user canonical framing; the six-pillar table in `docs/timeline-flat-design.md` §2 is the original citation, extended here with Event Log and Provisioning). Each pillar is effectively **its own store/repo and its own feature** — this hub skill only maps them; for implementation depth, load the pillar's dedicated skill.

## 1. The Eight Pillars at a Glance

| # | Pillar | Store | Repo / key | Dedicated skill |
| --- | --- | --- | --- | --- |
| 1 | Chat Sessions | `stores/chat/session-store.ts` (1529 ln) | `chat-sessions.repo` → `local:chat/*` | `airi-memory-chat-sessions` |
| 2 | Text Journal (LTMM) | `stores/memory-text-journal.ts` (598 ln) | `text-journal.repo` → `local:memory/text-journal/{userId}` | `airi-memory-text-journal` |
| 3 | Short-Term Memory (STMM) | `stores/memory-short-term.ts` (574 ln) | `short-term-memory.repo` → `local:memory/short-term/{userId}` | `airi-memory-short-term` |
| 4 | Echo Chips | `stores/echo-chips.ts` (374 ln) | `echo-chips.repo` → `local:memory/echo-chips/{userId}` | `airi-memory-echo-chips` |
| 5 | Lifetime Artifact | `stores/memory-lifetime.ts` (995 ln) | `lifetime-memory.repo` → `local:memory/lifetime/{characterId}:{universeId}` | `airi-memory-lifetime` |
| 6 | Image Journal (incl. Autonomous Artistry) | `stores/background.ts` | `localforage` `bg-{nanoid}` keys (`BackgroundEntry` type `journal`/`selfie`) | `airi-memory-image-journal` |
| 7 | Event Log | `stores/event-log.ts` (144 ln) | unstorage key `local:event-log` (cap 500) | `airi-memory-event-log` |
| 8 | Provisioning Session | (lives in #5's pipeline) | `provisioning-session.repo` → `local:memory/provisioning-session/{characterId}` | `airi-memory-provisioning` |

Secondary engines sitting across pillars (not pillars themselves):
- **Retrieval/RAG** — `libs/search/layered-memory.ts`, `hybrid-scorer.ts`, search worker → `airi-memory-retrieval-engine`
- **Consolidation/Dreaming** — nightly summarization, Sacred Journal Rule, DRMM → `airi-memory-consolidation-dreaming`
- **Memory Settings UI / Eternal Thread** → `airi-memory-ui-pages`

## 2. The Prompt-Injection Spine (how pillars reach the LLM)

All memory lands in the system prompt through `session-store.ts`, never directly from the memory stores:

- `buildShortTermMemoryContext(characterId)` (:210) — last `windowSize` (default 3, `card.extensions.airi.shortTermMemory`) STMM blocks as `[Short-Term Memory]`.
- `buildLifetimeMemoryContext(characterId)` (:226) — the single distilled lifetime artifact as `[Lifetime Artifact]`.
- Grounded journal RAG — top-3 journal entries (plus search-scoped candidates) per `airi-memory-retrieval-engine` limits.
- Recent Echo Chips and Event-Ledger text (`eventLogStore.getRecentEventsText(6)`, consumed by proactivity at `proactivity.ts:673`) ride the heartbeat/retrieval paths.

## 3. Universe Isolation (the flat model, not Git branching)

Per `docs/timeline-flat-design.md`: a Universe (`universeId`) decouples chat threads from memory banks; multiple sessions share one universe's memory. Consequences every pillar skill must respect:

- Entries carry `universeId?: string`; every query falls back `entry.universeId || 'global'` (implemented in text-journal :90, STMM `collectCharacterDayBuckets(charId, universeId)`, background `journalEntries` computed :299).
- Lifetime is universe-keyed; sessions carry `universeId` in `sessionMetas`; migration/rescoping flows edit tags, never move history (flat-model §3 / §7 Smart-Heal).
- The old nested-timeline design (`docs/timeline-nested-design.md`) is superseded — do not implement ancestry walking.

## 4. Storage-Layer Boundary

`local:*` namespaces go through `database/storage.ts` (unstorage, sync-engine tracked). **Binary blobs bypass it**: backgrounds/images live in `localforage` (separate IndexedDB) reconciled via `reconcileBackgrounds()` — see `docs/data-catalog.md` §3.1 and `airi-binary-safety` for the binary-proxy pitfalls (toRaw before setItem).

## 5. Cross-Pillar Flows

1. **Turn → memory**: `chat.ts` inscribes turn → STMM rebuild (today/yesterday) → journal tool calls (LTMM) → AA/headless image save (pillar 6) → event-log append (pillar 7).
2. **Consolidation**: Dreaming/summarization loops (STMM→ journal candidates → chips → lifetime distill) — `airi-memory-consolidation-dreaming`.
3. **Provisioning**: raw history → 5-stage artifact build tracked by pillar 8 → lifetime keyed per universe.
4. **Retrieval**: semantic index (`airi-search-index` IndexedDB) unifies `memory_block`→stmm, `journal_entry`→ltmm, raw turns for verbatim recall.

## 6. Common Pitfalls

- **Breaking the Sacred Journal rule** — pillar 2 manual entries are append-only; workers may derive but never rewrite/delete (see consolidation skill).
- **Forgetting `|| 'global'` universe fallback** — every per-character read must apply it; missing it causes memories to leak across universes.
- **Confusing `image_journal` with Autonomous Artistry** — the tool is assistant-initiated; AA is a deterministic side-channel (2nd LLM) that calls the same save path while the talking assistant stays unaware. Details: `airi-memory-image-journal`.
- **Assuming everything is in `local:*`** — blob-heavy pillars (backgrounds/image journal, models, stickers) are `localforage`.
- **Lifetime key shape** — current key is `{characterId}:{universeId}` with one-way migration from bare `{characterId}` (`lifetime-memory.repo.ts:10`).

## 7. Verification

- `pnpm -F @proj-airi/stage-ui typecheck` for store/repo changes (add App: `pnpm -F @proj-airi/stage-tamagotchi typecheck`).
- Spot-check each touched pillar's key in DevTools Application → IndexedDB (`airi-*` / `local:*`), and binaries under the `localforage` instance — keep Subject A's memory distinct per universe while testing.

## 8. Authoritative Sources

- `docs/data-catalog.md` — the storage ground truth for all eight pillars (IndexedDB/`localforage`/localStorage split).
- `docs/timeline-flat-design.md` / `docs/timeline-nested-design.md` — Universe model (flat is canonical).
- `docs/memory_lab/` — schema, retrieval, provisioning, evaluation specs (see pillar skills for per-spec links).
- `docs/rosetta-stone.md` — canonical path index; §9 memory-systems.
- Peer skills: `airi-memory-chat-sessions`, `airi-memory-text-journal`, `airi-memory-short-term`, `airi-memory-echo-chips`, `airi-memory-lifetime`, `airi-memory-image-journal`, `airi-memory-event-log`, `airi-memory-provisioning`, `airi-memory-retrieval-engine`, `airi-memory-consolidation-dreaming`, `airi-memory-ui-pages`, `airi-data-persistence`, `airi-binary-safety`.
