---
name: airi-chatbox-ui-surface
description: >-
  Use when working with the AIRI chatbox UI surface: WhisperDock input dock, chat message bubbles (assistant/user), tool-call blocks, the right-click/long-press action-menu (copy/delete/edit/retry/fork/journal moment), journal preview chips, mood/vibe echo chips, tiering/toolbar strips, TOK indicator, image drop zone, DirectorNote/ProducerChoice ACT bubbles, and useChatComposer ingestion. Covers packages/stage-layouts/src/components/Widgets/ChatArea.vue, packages/stage-ui/src/components/scenarios/chat/, and apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue. Triggers on editing chat bubbles, the message context menu, composer state, journal chips, or cross-window chat sync.
---

# AirI Chatbox UI Surface

## Surface Map

- **Desktop chat host (Electron):** `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (~1616 lines)
  - The primary chat window. Hosts the message history, toolbar strip, journal/media chips, mood/flavor echo chips, grounding preview panel, image drop zone, and the composer `<BasicTextarea>`. **It manages its own `messageInput` / `attachments` state directly (lines 46-47) and does NOT use `useChatComposer`.**
  - Toolbar/composer buttons: `ChatImagesPopover` (~line 1226), Suggest/Producer wand popover (~lines 1232-1299).
  - Image drop zone: `isDragging` / `handleDrop` (~lines 687-707), drop handlers wired at lines 880-884.
- **Mobile/layout chat container (shared widget):** `packages/stage-layouts/src/components/Widgets/ChatArea.vue` (469 lines)
  - Wraps the composer for the stage-layout surface. **Uses `useChatComposer`** (destructured at lines 56-71) and binds `trashConfirmOpen` (lines 73-79).
  - Maintains its own token counter / context-width indicator (lines 89-137), mic volume popover, grounding toggle, trash-confirm dialog.
- **WhisperDock (standalone floating input dock):** `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` (340 lines)
  - Export: `packages/stage-ui/src/components/scenarios/chat/index.ts`. Rendered by `apps/stage-tamagotchi/src/renderer/pages/actor.vue`.
  - 4-state open/close lifecycle; calls `chatStore.ingest(...)` directly at line 108 (does NOT use `useChatComposer`).

## Store Map (Pinia)

- `useChatOrchestratorStore` (`packages/stage-ui/src/stores/chat.ts:97`) — central pipeline: `ingest(...)`, `onAfterMessageComposed(...)`, streaming, tool-call bridging.
- `useChatSessionStore` (`packages/stage-ui/src/stores/chat/session-store.ts`) — session + `messages`.
- `useChatStreamStore` (`packages/stage-ui/src/stores/chat/stream-store.ts`) — `streamingMessage`.
- `useChatMaintenanceStore` (`packages/stage-ui/src/stores/chat/maintenance.ts`) — `cleanupMessages`.
- `useSettingsChat` (`packages/stage-ui/src/stores/settings.ts` / `stores/settings/index`) — `sendMode` + `suggestMode`.
- `useAiriCardStore` (`packages/stage-ui/src/stores/modules/airi-card.ts`) — card state + `updateCard`.
- `useConsciousnessStore` (`stores/modules/consciousness.ts`) — `activeModel` / `activeProvider`.
- `useBackgroundStore` (`stores/background.ts`) — `journalEntries` used for media chips.
- `useJournalPreviewStore` (`stores/journal-preview.ts`) — `openTextPreview` / `openImagePreview` / `downloadImage`.
- `useTextJournalStore` (`stores/memory-text-journal.ts`), `useShortTermMemoryStore` (`stores/memory-short-term.ts`) — journal/memory chips.
- `useEchoesStore` (`stores/echo-chips.ts`) — mood/flavor echo chips.

## Key Code Paths

- **Chat scenario components directory:** `packages/stage-ui/src/components/scenarios/chat/`
  - `history.vue` — message list container (renders items, bubbles).
  - `assistant-item.vue`, `user-item.vue` — per-role message bubbles.
  - `response-part.vue` — renders one slice of a response (text/tool-call/etc).
  - `tool-call-block.vue` — inline tool-call chip/progress for a message slice.
  - `DirectorNoteBubble.vue`, `ProducerChoiceBubble.vue` — ACT / Director-note bubbles.
  - `JournalMomentModal.vue`, `JournalPreviewModal.vue` — journal overlays.
  - `constants.ts`, `composables/`, `message-key.ts/+ .test.ts`, `utils.ts`, `index.ts` (exports).
- **Action menu (right-click / long-press):**
  - `packages/stage-ui/src/components/scenarios/chat/components/action-menu/index.ts:1-81` — `ChatActionMenuAction` type (`copy | delete | delete-following | fork | fork-switch | edit | retry | journal`) + `createChatActionMenuItems(...)` builder (labels/icons/dividers).
  - `.../action-menu/index.vue` (514 lines) — Reka `ContextMenu*` + `DropdownMenu*` pieces, animejs long-press scale, floating trigger visibility logic, `UniversePickerModal` fork flow.
- **Composer composable (shared ingestion state):** `packages/stage-ui/src/composables/use-chat-composer.ts:23` — `useChatComposer(options)` returns `{ messageInput, attachments, isComposing, isImagineMode, isListening, trashConfirmOpen, handleFileSelect, removeAttachment, handleTrashClick, handleSaveAndClear, handleClearAnyway, handleSend, startListening, stopListening }`. Exported via `packages/stage-ui/src/composables/index.ts:9`.
- **Cross-cutting helpers:** `packages/stage-shared/src/text.ts:71` — `healMozibake(text)` used by `packages/stage-ui/src/stores/chat.ts` and `packages/stage-ui/src/components/markdown/markdown-renderer.vue` to repair UTF-8 scrambles before render.
- **Tool-call bridging (marker→tool):** `packages/stage-ui/src/stores/chat.ts:~765-870` — `tryBridgeMarker()` parses marker syntax (`<|tool:args|>`, `[call_tool:...]`, `<tool_call>...`) into manual tool-call objects enqueued with `index: 0` (see Pitfalls).

## Core SOPs

### 1) Add or remove an action-menu item (e.g. a "Pin" action)
Both files must stay in lock-step — the menu is driven by a **builder function**, not the template:
1. Extend `ChatActionMenuAction` in `components/action-menu/index.ts:1` with your new action literal.
2. Add a branch in `createChatActionMenuItems(...)` (same file, lines 11-79) with `action`, `label`, an Iconify icon class, an optional `divider: true`, and `danger: true` if destructive. Re-run the final `.filter(Boolean)` by conditionally returning `null` when your `canX` option is off.
3. In `components/action-menu/index.vue`, add the emit to `defineEmits` (~lines 52-61), add a `handleAction` branch (`if (action === '<your>') emit('<your>'); return`) (~line 155), and extend the template `menuItems` rendering if you need custom behavior (the template iterates `menuItems` already at lines 398/455/482).
4. Wire the new emit on the consumer (`assistant-item.vue` / `user-item.vue` / history-item wrapper).

### 2) Style bubbles / chips (desktop chat host)
- Edit `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`. Echo chips are class-switched by `entry.echoType === 'mood' | 'flavor'` (defaults otherwise) around lines 967-988; journal chip card styles live at lines 993-1063.
- For mobile/stage-layout surfaces edit `ChatArea.vue`. Prefer existing UnoCSS patterns (`:class="[...]"` arrays, `bg-*`, `dark:*` tokens). Don't introduce Tailwind-only utilities or new color themes.
- Reuse the existing fade/(animejs) transitions; do not add a new global animation without checking `packages/ui` / existing keyframes first (e.g. WhisperDock uses scoped `@keyframes whisper-glow`, lines 328-339).

### 3) Composer / send-state handling
- **If you are editing the shared/mobile/widget path** (`ChatArea.vue`), reuse `useChatComposer({ tools })` — it already wires `messageInput`, `attachments`, `handleSend`, trash-confirm, and imagine mode, and posts to `useChatOrchestratorStore().ingest(...)`.
- **If you are editing the desktop chat host** (`InteractiveArea.vue`), it manages `messageInput`/`attachments` locally (lines 46-47) and implements its own `handleSend()` (line 535); still route the actual send through `chatOrchestrator.ingest(...)`. Do NOT bolt `useChatComposer` into `InteractiveArea.vue` unless you are deliberately unifying them.
- **If you are editing WhisperDock**, it calls `chatStore.ingest` directly (line 108); keep optimistic-clear/draft-restore behavior intact.

### 4) Journal / memory chip rendering
- Chips come from `groupedTextEntries` / `latestImageEntries` computed in `InteractiveArea.vue`. Grouping logic (splitting single entries vs `echo-group` tickers) is at lines ~329-348; click opens `useJournalPreviewStore().openTextPreview(...)` / `openImagePreview(...)`.

## Known Pitfalls

- **Per-window Pinia stores need BroadcastChannel sync.** Chat and director state mutate independently in each Electron window. Mutations must post the canonical `BroadcastChannel` event (see `docs/rosetta-stone.md` §13 for the full registry — do not re-list every channel here). The ones you'll most often touch from this surface: `airi:director-notes-sync` (director notes; publisher in `packages/stage-ui/src/stores/modules/artistry-autonomous.ts:58`) and the chat/presence channels (`airi-chat-input-bridge`, `airi-chat-stream`, `airi-chat-present`, `airi-intrusion-staging`). Match the exact channel-name string.
- **`healMozibake` iterates by code point, not UTF-16 index.** In `packages/stage-shared/src/text.ts:71-133` the repair loop uses `for (const char of healed)` and `char.codePointAt(0)` (lines 103-120) so surrogate pairs are encoded back correctly. If you lint-clean or refactor this helper, do not "simplify" to index-based `charCodeAt(i)` — that corrupts multi-byte characters.
- **Avoid eager `{ deep: true }` watchers on store data.** This codebase already runs expensive watchers inside the action-menu visibility sentinel system; adding another eager `deep` watcher over `messages` or `historyMessages` in `InteractiveArea.vue` will burn CPU on every streaming delta. Prefer `computed()` or targeted `watch(() => store.someField)` and keep `immediate: true` only where it already exists.
- **Manual tool-call objects need `index: 0` for strict OpenAI/DeepSeek gateways.** The marker-bridging path in `packages/stage-ui/src/stores/chat.ts` (~line 856-870) constructs `{ id: \`bridge-${nanoid()}\`, index: 0, type: 'function', function: {...} }` manually when converting inline markers into tool-calls. If you synthesize tool-calls elsewhere you must include `index: 0`; gateways that validate the strict OpenAI/DeepSeek schema will reject the call without it.
- **`useChatComposer` unifies desktop/mobile ingestion — but not every surface uses it.** `ChatArea.vue` (stage-layout/mobile) uses it; `InteractiveArea.vue` (desktop host) and `WhisperDock.vue` manage composer state manually and only call `ingest(...)`. Before changing ingestion behavior, decide which surface(s) you actually mean; a change to the composable will not ripple into `InteractiveArea.vue`.
- **Action menu items must be added through `createChatActionMenuItems(...)` in `index.ts`.** The `.vue` template iterates that array for both the inline/hover dropdown AND the floating-trigger dropdown AND the context menu (lines 398, 455, 482). Appending a one-off `<DropdownMenuItem>` in the template will only patch one of three render sites.

## Verification

- Stage-UI-only changes (chat components, composer, markdown renderer): `pnpm -F @proj-airi/stage-ui typecheck`
- Desktop chat host changes (`InteractiveArea.vue`, shared eventa contracts): `pnpm -F @proj-airi/stage-tamagotchi typecheck` (runs `tsc --noEmit -p tsconfig.node.json` then `vue-tsc --noEmit -p tsconfig.web.json`)
- UI-only class/copy tweaks normally need no script; run the above when you changed TS logic, a store, an import, or the `createChatActionMenuItems` signature.
