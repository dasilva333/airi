---
name: airi-memory-event-log
description: >-
  Use when working with AIRI memory pillar 7 — the Event Log ledger: event-log.ts store (144 lines), unstorage key local:event-log with 500-entry capacity, AiriSystemEvent records with seven categories (vision/tools/chat/proactivity/memory/stage/discord), appendEvent/clearLog/getRecentEventsText, heartbeat ledger injection into proactivity, and the Event Ledger UI pane. Trigger on event ledger, system events, appendEvent, or activity tracing. Hub: airi-memory-systems.
---

# Memory Pillar 7 — Event Log

A bounded, append-mostly system ledger of what AIRI has been doing — the character's short-term awareness of her own recent activity. Not a chat memory pillar; it informs proactivity heartbeats and the user-facing Event Ledger view.

## Store & Persistence

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/event-log.ts` (144 ln) — `useEventLogStore` :25 |
| Persistence | unstorage key `local:event-log` via `database/storage.ts` |
| Capacity | 500 events (`DEFAULT_MAX_CAPACITY` :23) — newest-first, tail-trimmed on overflow |
| Record | `AiriSystemEvent` — id, timestamp/isoTime, category, type, source, textSummary, payload?, inspectable? |
| Categories | `'vision' | 'tools' | 'chat' | 'proactivity' | 'memory' | 'stage' | 'discord'` (:6) |

## Key Mechanisms

- `appendEvent({ category, type, source, textSummary, payload?, inspectable? })` (:59) — lazy `init()` (:33), newest-first unshift, trimmed + persisted per write (:85-89); `inspectable` defaults true when payload is non-empty.
- `isPaused` (:29) gates recording — while paused events are not appended or persisted.
- `getRecentEventsText(count = 6)` (:115) — plain-text digest for prompt injection. Primary consumer: **proactivity heartbeats** (`proactivity.ts:673`) feed the last six ledger lines into the heartbeat context so AIRI can reflect on what she just did (journaling, dreaming, artistry) — the introspective feedback loop.
- UI: Event Ledger pane in the desktop chat workspace (`chat_event_log.vue`) with category filter/search/pause (`searchQuery` / `selectedCategory` / `isPaused` refs :28-30).

## Pitfalls

- This is a rolling log, not archive-grade memory — 500-cap means older events fall off; anything meant to be durable belongs in the journal (pillar 2).
- `appendEvent` persists per write; high-frequency appenders (e.g. per-chunk stage events) can thrash IndexedDB — batch or downsample at the source.
- Categories are a fixed union — adding one requires updating `EventCategory` (:6) and the ledger UI filter.
- Unlike other pillars there is no `characterId`/`universeId` scoping — the ledger is app-global by design.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: perform actions across categories (tool call, Discord message, heartbeat) and confirm entries stream into the Event Ledger pane and `local:event-log` persists.

## Sources

`apps/stage-tamagotchi/src/renderer/components/chat/chat_event_log.vue` (UI); `docs/memory_lab/state-of-system.md`; peer: `airi-memory-systems` (hub), `airi-proactivity-sensory-telemetry` (ledger consumer), `airi-tool-registry-builtin-tools` (tool-category events).
