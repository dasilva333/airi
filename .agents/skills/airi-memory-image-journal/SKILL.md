---
name: airi-memory-image-journal
description: >-
  Use when working with AIRI memory pillar 6 — the Image Journal and Autonomous Artistry (AA): BackgroundEntry storage in background.ts (localforage, types builtin/scene/journal/selfie, bg-{nanoid} keys with image-journal- legacy migration), the assistant-callable image_journal tool (create/apply), the separate Autonomous Artistry deterministic side-pipeline (Director 2nd-LLM analysis → threshold gate → headless generation → journal save, invisible to the talking assistant), artistry providers/settings, and reconcileBackgrounds() sync. Trigger on image journal, autonomous artistry, generated art storage, journal/selfie backgrounds, or AA. Hub: airi-memory-systems.
---

# Memory Pillar 6 — Image Journal & Autonomous Artistry

Durable, append-only image history for AI-generated art. **Two completely separate producers write the same store** — and the distinction is the single most-misunderstood fact about this pillar:

1. **`image_journal` tool call** — the talking assistant decides to draw on its own turn (user asked, model called the tool; AA NOT involved). Gated per-card in the Tools tab (`CardCreationTabTools.vue`, `allowedTools` → gateway filter in `llm.ts`).
2. **Autonomous Artistry (AA)** — a deterministic side-pipeline that takes the chat turn, sends it to a **second LLM (the Director)** to decide *whether* this turn deserves an image and compose a prompt **unknown to the talking assistant**, then generates headlessly and saves it behind the scenes. AA is NOT a tool call; it never touches the assistant's tool loop or stream.

## The Store (shared destination)

| Attribute | Value |
| :--- | :--- |
| Store | `packages/stage-ui/src/stores/background.ts` — `BackgroundEntry` (:16) `type: 'builtin' | 'scene' | 'journal' | 'selfie'` |
| Persistence | `localforage` (separate IndexedDB, NOT the unstorage `local:*` layer) |
| Key pattern | `bg-{nanoid}` (current), `builtin:{id}`, legacy `image-journal-{nanoid}` migrated at load (background.ts :109-122) |
| Sync | `reconcileBackgrounds()` — metadata JSON + raw PNG under `assets/backgrounds/{id}.json` / `.png` (`docs/data-catalog.md` §3.1) |
| Scoping | `journalEntries` computed (:280+) filters `journal`/`selfie` by characterId + universe (`isUniverseMatch` :299) |

Note: a second background store exists in `packages/stage-layouts/src/stores/background.ts` (`background-{id}` prefix) for user-uploaded backgrounds — different surface, don't confuse them.

## Producer 1: the `image_journal` tool

`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/image-journal.ts`:

- Actions: `create` (prompt → headless generation via `artistryGenerateHeadless` eventa invoke :16/:29 → `backgroundStore.addBackground('journal', blob, title, prompt, cardId)` :90) and `apply`/`set_as_background` (search existing journal entries by id/title :166-196, set as stage background).
- Display modes: `inline | widget | bg | bg_widget` (:37) default to the character preference (`card.extensions.airi.artistry.spawnMode` :61).
- Registered conditionally: only when `artistry.configured` is true (`builtin/index.ts`).

## Producer 2: Autonomous Artistry

`packages/stage-ui/src/stores/modules/artistry-autonomous.ts` (1160 ln) — `useAutonomousArtistryStore`:

- **Trigger sites** (deterministic, per-turn): `chat.ts:536` (user message send), `chat.ts:1697` (assistant turn finished), `use-chat-composer.ts:211` (voice auto-send, target `'assistant'`).
- **Gate**: `artistry.autonomousEnabled` (card) + `isProcessing` single-flight guard (:453-456) + `autonomousThreshold` (default 70 :458).
- **Director analysis** (2nd LLM, :528-631): composes a Director prompt with the turn text, recent history (`autonomousHistoryDepth` default 3 :575), available visual concepts (`visual_assets` filtered to those with prompt/provider :496-500), previous scratchpad from director notes, dating-sim choice generation when enabled; model source is `autonomousModelMode` `inherit`/`custom` (:619-622).
- **Save**: `backgroundStore.addBackground('journal', blob, title, prompt, cardId)` (:827) — then per spawn mode can also update the card's `activeBackgroundId` (surgical `modules.activeBackgroundId` update :964+) and/or spawn the artistry widget.
- The talking assistant never sees AA's prompt or output except by noticing the new journal entry (and Director Notes, `director-notes.repo` — covered by the artistry concept-stack skills).

## Pitfalls

- **Do NOT conflate tool call with AA** — different trigger, different LLM call, different reasoning lineage; same save store. Debug questions ("why did she draw?") split here first.
- AA image events don't appear in the chat's tool traces; they surface via Director concept-stack manifestation (`applyCurrentStackManifestations()` :964+) and `onBackgroundAdded` hooks (:307) instead.
- Blobs are `localforage` — respect binary-safety rules (toRaw before setItem, `airi-binary-safety`).
- Legacy `image-journal-` key prefix auto-migrates (:109) — don't add new code paths using it.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: trigger a manual `image_journal create` tool call and separately an AA-enabled turn, confirm both land as `type:'journal'` `BackgroundEntry` with correct character/universe scoping.

## Sources

`docs/content/en/docs/advanced/architecture/design-image-journal-storage.md`; `docs/data-catalog.md` §3.1 (BackgroundEntry) & §4.8 (Artistry settings); peer: `airi-memory-systems` (hub), `airi-scenes-backgrounds`, `airi-binary-safety`, `airi-tool-registry-builtin-tools` (image_journal registration/gating), `airi-dating-sim-engine` (AA choice addon).
