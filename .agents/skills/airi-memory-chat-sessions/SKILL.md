---
name: airi-memory-chat-sessions
description: >-
  Use when working with AIRI memory pillar 1 — Chat Sessions: the session store (packages/stage-ui/src/stores/chat/session-store.ts, 1529 lines), chat-sessions.repo (local:chat/*), per-character session index, fork/switch/invoice-turn flows, universe metadata on sessions, session-generation checkpoints, and the memory-context builders that inject STMM and lifetime artifacts into the prompt. Trigger on session lifecycle, persistence, multi-session/universe wiring, or "where do chat messages live". This skill covers only the session pillar — text journal, STMM, lifetime, etc. each have their own skill under the airi-memory-systems hub.
---

# Memory Pillar 1 — Chat Sessions

In-memory turn history + durable session metadata/index. The session store is both a memory pillar and the injection spine other pillars plug into (see the hub skill `airi-memory-systems`).

## Store & Repo

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/chat/session-store.ts` (1529 ln), `defineStore('chat-session')` :32 |
| Repo | `packages/stage-ui/src/database/repos/chat-sessions.repo.ts` — index under `local:chat/index/{characterId}`; per-session messages `local:chat/sessions/{sessionId}` |
| Data catalog | `docs/data-catalog.md` §1.4 (sessions index) & §1.5 (session records) |

## Key State & Mechanisms

- **Three-part state** (:46-49): `activeSessionId`, `sessionMessages` (Record of HistoryItem[]), `sessionMetas` (Record of `ChatSessionMeta`, carries `universeId`, title, timestamps), `sessionGenerations` (counter map).
- **Generation checkpoints** — `ensureGeneration()` (:261) + `sessionGenerations` give `performSend` its stop/cancel invalidation lever (`airi-interaction-pipelines` §2.2 / §7).
- **Lifecycle**: `initialize()` (:698) loads index → `ensureActiveSessionForCharacter()` (:589) auto-creates one per character → `loadSession()` (:494) lazy-loads messages → `inscribeTurn()` (:473) appends assistant/user turns → `persistSession()` (:363) writes.
- **Universe wiring** — `getSessionMeta(sessionId).universeId` is the single source of truth for *all* other pillars' universe filtering (pillar 2/3/5/6 read it); falls back `'global'` everywhere.
- **Fork/rename/delete** flows live in `chat/maintenance.ts` and the parallel-timelines UI (`ChatSessionModal.vue`); fork copies compiled messages + keeps/retargets `universeId`.
- **Bymid turn reconstruction** — initial greeting comes from `generateInitialMessageFromPrompt()` (:240) via `buildShortTermMemoryContext`+`buildLifetimeMemoryContext`.

## The Injection Spine (owner lives here)

- `buildShortTermMemoryContext(characterId)` (:210) — top `windowSize` (default 3) STMM blocks → `[Short-Term Memory]` block.
- `buildLifetimeMemoryContext(characterId)` (:226) — the distilled lifetime artifact → `[Lifetime Artifact]` block.
- These are the only sanctioned paths from memory pillars into the prompt — new injections belong here or in the retrieval layer, not ad-hoc.

## Pitfalls

- Do not mutate `sessionMessages` directly; go through `setSessionMessages`/`inscribeTurn` so persistence and id-assurance (`ensureSessionMessageIds` :102) run.
- Session store is hot-path — expensive per-turn work here slows every surface.
- Generation bumps race with the tool-call queue (see `airi-interaction-pipelines` §7.3 step 4).
- `airi-search-index` IndexedDB has no session index — semantic recall of raw turns uses the layered search (retrieval skill).

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: create/fork/switch sessions in Settings → Parallel Timelines and confirm `local:chat/*` writes in DevTools.

## Sources

`docs/data-catalog.md` §1.4/§1.5; `docs/timeline-flat-design.md`; peer: `airi-memory-systems` (hub), `airi-interaction-pipelines`, `airi-data-persistence`.

## Related Skills & References

- **Peer Skills**: [[airi-data-persistence]], [[airi-interaction-pipelines]], [[airi-memory-systems]]
- **Key Documents**: [[data-catalog]], [[timeline-flat-design]]
