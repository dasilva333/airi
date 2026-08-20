---
name: airi-desktop-chatbox
description: >-
  Use when working with the AIRI desktop (Electron stage-tamagotchi) chat window as a whole: the persistent hub window pages/chat.vue, its top-left hamburger Workspace Routes, the 9 workspace sub-surfaces (Chat View, Director's Monitor, World Bible, Studio, Media Library, Eternal Thread, Event Ledger, Notes, Rehearsal), the desktop InteractiveArea.vue composer host, chat message bubbles, tool-call blocks, the action-menu, journal/echo chips, the amber Pre-Flight Grounding panel, and shared stage-ui chat primitives (history.vue, bubbles, popovers) that web/pocket also build on. Covers apps/stage-tamagotchi/src/renderer/pages/chat.vue, apps/stage-tamagotchi/src/renderer/components/chat/, components/InteractiveArea.vue, and packages/stage-ui/src/components/scenarios/chat/. Triggers on editing desktop chat bubbles, the message context menu, composer state, workspace navigation, journal chips, or cross-window chat sync. Mobile/web portrait & landscape chatboxes are summarized in §1 — for their internals see packages/stage-layouts.
---

# Airi Desktop Chatbox

This skill is scoped to the **desktop (stage-tamagotchi Electron) chat experience**. AIRI has three genuinely distinct chatboxes (plus WhisperDock, documented under honor §3):

1. **Desktop chatbox** — the full-featured Electron chat window. This document.
2. **Web/Pocket portrait** — `MobileWhisperSheet` in `packages/stage-layouts/src/components/Layouts/MobileWhisperSheet.vue`; compact 4-posture phone experience.
3. **Web/Pocket landscape** — edge-docked `packages/stage-layouts/src/components/Layouts/InteractiveArea.vue`; closest to desktop parity, and the only surface that still **lacks suggestions**.

Shared primitives (`scenarios/chat/*`) are desktop-owned but consumed everywhere; they are documented here in §6.

## 1. The Three (+1) Chatbox Surfaces

| Surface | Entry | Composer | Suggestions/Wand | History |
| --- | --- | --- | --- | --- |
| Desktop (Electron) | `apps/stage-tamagotchi/src/renderer/pages/chat.vue` | `components/InteractiveArea.vue` (own state) | Yes — magic wand + Suggest-Mode popover + Producer quick-suggests | Yes |
| Web/Pocket portrait (md- && portrait) | `apps/stage-web/src/pages/index.vue:267`, `apps/stage-pocket/src/pages/index.vue:252` | `MobileWhisperSheet` → `WhisperComposerBar` (`useChatComposer`) | Yes — via `WhisperComposerBar` | Yes — 85dvh sheet in `history` posture |
| Web/Pocket landscape | same index pages | `Layouts/InteractiveArea.vue` → `Widgets/ChatArea.vue` (`useChatComposer`) | **No — no wand/suggest UI** | Yes |
| WhisperDock (honorable mention) | `apps/stage-tamagotchi/src/renderer/pages/actor.vue:~710` | `WhisperDock` → `WhisperComposerBar` | Yes (the bar's wand) | **No — input dock only, not a strict chatbox** |

- Orientation routing: `isLandscape = useMediaQuery('(orientation: landscape)')` + `isPortraitMobile = breakpoints.smaller('md') && !isLandscape` (`apps/stage-web/src/pages/index.vue:72-73`; pocket identical at 258-267). `v-if="!isPortraitMobile"` mounts `Layouts/InteractiveArea.vue`, else `MobileWhisperSheet`.
- `stage-web` and `stage-pocket` are twin mirrors of the same `index.vue` structure; fix both in lockstep.
- Portrait sheet: `MobileWhisperSheet.vue` (~321 lines) composes `ChatHistory` + `WhisperComposerBar` with `MobilePosture` (`voice` | `composer` | `preview` | `history`, default `preview`, `stepPosture` up/down, grab-handle transitions) and `PresentationMode` (`translucent` | `frosted`, persisted at `airi:mobile-chat-presentation-mode`).
- `WhisperComposerBar.vue` (520 lines, fully-featured) is the shared composer: `useChatComposer({ tools, onSendStart, onSendError })` at line 106 + its own Producer/wand logic (mirrors InteractiveArea pattern) + provider-config prompt; exposes `send()` (`defineExpose` at line 250).

## 2. Chat Window Hub & Workspace Routes (Hamburger)

Entry: `apps/stage-tamagotchi/src/renderer/pages/chat.vue`; window: `apps/stage-tamagotchi/src/main/windows/chat/index.ts` (label/tag `chat`, loaded at `:197`).

- Inside the header: hamburger (`i-solar:hamburger-menu-bold`, around line 559) opens the **Workspace Routes drawer** (~line 1171); on desktop `md:+` there is also a persistent left sidebar (~line 1217) rendering the same entries.
- Both render the route array `v-for="item in [...] as const"` — the drawer copy and the sidebar copy are **duplicated inline arrays**; new entries must be added (and kept in the same order) in both places.
- The active surface is persisted to `localStorage['airi:chat:left-panel-active']` and resolved to a sub-surface component by `activeSurfaceComponent` (chat.vue ~lines 95-108). The `Settings` footer is not an entry in the array; it calls `selectSurface('messages')` in a separate footer block.
- Window size presets (`mini` | `medium` | `large` | `full`) go through `electronApplySizePreset({ target: 'chat', preset })` (chat.vue:50-54).

### 2.1 Workspace sub-views

Route arrays inside the template of `pages/chat.vue` (drawer is around line 1178, sidebar around line 1225). Each sub-surface is a thin Electron wrapper at `apps/stage-tamagotchi/src/renderer/components/chat/<file>.vue` sitting on top of the shared stage-ui/stage-pages primitives.

| Label (id) | Wrapper (`components/chat/`) | Reusable views / stores |
| --- | --- | --- |
| Chat View (`messages`) | `chat_messages.vue` — thin ref-forwarding wrapper around `components/InteractiveArea.vue`; only via `defineExpose({ interactiveAreaRef })` re-exposes it so that the right-panel actions of the hub can call into the host | the entire desktop chat experience (§3) |
| Director's Monitor (`director`) | `chat_director.vue` | `DirectorMonitorView` (`packages/stage-ui/src/components/scenarios/chat/components/DirectorMonitorView.vue`) with `:session-id` — directive timeline, visual parameters, narrative pacing |
| World Bible (`world`) | `chat_world.vue` | `CharacterContextView` (`packages/stage-ui/src/components/scenarios/chat/components/CharacterContextView.vue`) with `:character-id` — active prompts, rules, action hooks, injected dating sim |
| Studio (`characters`) | `chat_studio.vue` | `useAnimaDexWizardStore` catalog + `useDisplayModelsStore` + `useBackgroundStore`; `electronOpenSettings` deep link (`/settings/airi-card?...&tab=studio`) |
| Media Library (`media`) | `chat_media.vue` | `StageBackgroundPicker :card-id` (stage-ui scenarios/dialogs) — generated media/backgrounds per card |
| Eternal Thread (`archives`) | `chat_lifetime.vue` | `useMemoryLifetimeStore` + `packages/stage-pages/src/pages/settings/modules/components/LifetimeHistoryModal.vue` / `LifetimeProvisioningModal.vue` — lifetime memory artifacts, provisioning, history |
| Event Ledger (`event-log`) | `chat_event_log.vue` | `useEventLogStore` (`packages/stage-ui/src/stores/event-log.ts`) with category filters (`all / vision / tools / chat / proactivity / memory / stage / discord`), expandable event rows |
| Notes (`notes`) | `chat_notes.vue` | **Placeholder stub** (template only, "Placeholder surface for workspace scratch notes") |
| Rehearsal (`rehearsal`) | `chat_rehearsal.vue` | VRM + display model + artistry rehearsal loop: `useTextToMotionStore`, `useCustomVrmAnimationsStore`, `useAnimaDexWizardStore`, `useLLM`, `ModelCustomizer` / `ModelPromptGeneratorModal`, valibot-defined config |
| Settings (footer only, button after `border-t`) | no wrapper — inside the hub itself | calls `selectSurface('messages')` |

- Empty-state guards: `chat_director`, `chat_world`, `chat_media` all guard on `activeSessionId` / `activeCardId` and render a centered empty state if absent — follow that pattern for new surfaces.
- Do **not** add window-level nav drawers or hamburger buttons inside the composer widgets (`InteractiveArea.vue` / `Widgets/ChatArea.vue`). Workspace entries belong in the route array of `chat.vue` + its component map.

## 3. Desktop Composer Host — `InteractiveArea.vue`

`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` (~1627 lines). **Manages its own `messageInput` / `attachments` state (lines 46-47) and does not use `useChatComposer`.**

- `handleSend()` (line 535): optimistic clear + draft restore on failure, URL revocation; empty input with no messages ingests the `INVOKE_CHARACTER_FIRST` sentinel (lines 560, 568). `{ ingest, onAfterMessageComposed }` is destructured from the orchestrator at line 63.
- Composer template: `<BasicTextarea>` at ~line 1217 (`sendMode` + `suggestMode` bindings, `@suggest` triggers `handleQuickSuggest`), `ChatImagesPopover` at ~line 1237, Producer magic-wand + Suggest-Mode popover + onboarding tooltip popovers at ~lines 1242-1340. Right-click on wand → `isWandMenuOpen`; wand tuning is localStorage-persisted (`airi:producer:context-depth`, `airi:producer:suggestion-count`, `airi:producer:short-replies`, lines 395-397), driving `useProducer().generateSuggestions` via `handleQuickSuggest()` (line 409); suggestions render as `producerSuggestion` choices (lines 389-452).
- Image drop: `isDragging` (line 687) / `handleDrop` (line 702); drag enter/over/leave/drop attached at lines 880-884.
- `messageInput` persists to localStorage via a watcher (line 764) — draft survives restarts.

## 4. Shared Chat Primitives (desktop-owned, cross-surface)

`packages/stage-ui/src/components/scenarios/chat/` — canonical barrel export `index.ts` (`ChatHistory`, `ChatAssistantItem`, `ChatUserItem`, `WhisperDock`, `WhisperComposerBar`, popovers/modals…).

- `history.vue` (~221 lines) — message list; renders role bubbles, `ChatErrorItem`, `DirectorNoteBubble` (line 182). `variant`-aware (portrait sheet uses its own scroll behavior).
- `assistant-item.vue` / `user-item.vue` — role bubbles; `response-part.vue` — one response slice (text/tool-call/etc); `tool-call-block.vue` — tool-call chip/progress.
- ACT/Director/Producer: `DirectorNoteBubble.vue`, `ProducerChoiceBubble.vue`, `ProducerGuidanceModal.vue`.
- Journal: `JournalMomentModal.vue`, `JournalPreviewModal.vue`. Popovers/modals: `ChatBrainPopover`, `BrainModelPicker`, `ChatGroundingPopover`, `ChatImagesPopover`, `ChatMemoryPopover`, `ChatSessionModal`.
- Subdirs: `components/` (`action-menu/`, `CharacterContextView.vue`, `DirectorMonitorView.vue`), `composables/use-element-scroll.ts`; plus `constants.ts`, `message-key.ts(+ .test.ts)`, `utils.ts`, `error-item.vue`.

### Action menu (right-click / long-press)

- `components/action-menu/index.ts:1-81` — `ChatActionMenuAction` type (`copy | delete | delete-following | fork | fork-switch | edit | retry | journal`) + `createChatActionMenuItems(...)` builder (lines 11-79).
- `components/action-menu/index.vue` (514 lines) — Reka `ContextMenu*` + `DropdownMenu*`, animejs `createTimeline` long-press scale (line 9), floating trigger visibility. Emits at 52-61 (`fork`/`fork-switch` take `universeId: string`); `menuItems` computed at 107; `handleAction` at 155; fork flow via `UniversePickerModal` (import line 26, template line 507). The template iterates the builder array at **three** render sites (lines 398, 455, 482).

### Composer composable (shared ingestion)

`packages/stage-ui/src/composables/use-chat-composer.ts:23` — `useChatComposer(options: { tools?, onSendStart?, onSendSuccess?, onSendError? })` returns `{ messageInput, attachments, isComposing, isImagineMode, isListening, trashConfirmOpen, handleFilePaste, handleFileSelect, removeAttachment, handleTrashClick, handleSaveAndClear, handleClearAnyway, handleSend, startListening, stopListening }` (lines 394-411). Calls `chatOrchestrator.ingest(...)` internally; `isImagineMode` short-circuits to `useAutonomousArtistryStore().runArtistTask(...)`; voice auto-send via `debouncedAutoSend` (~lines 60-103, 243); restores input + attachments on error. Exported via `packages/stage-ui/src/composables/index.ts:9`.

**Consumers today:** `packages/stage-layouts/src/components/Widgets/ChatArea.vue:58` (landscape) and `scenarios/chat/WhisperComposerBar.vue:106` (portrait sheet + WhisperDock). Desktop `InteractiveArea.vue` ingests directly — composable changes never ripple there.

## 5. Store Map (Pinia)

- `useChatOrchestratorStore` (`packages/stage-ui/src/stores/chat.ts:98`) — central pipeline: `ingest(...)`, `onAfterMessageComposed(...)`, streaming, marker→tool bridging. ~2000-line setup store: `performSend` (243, treats `INVOKE_CHARACTER_FIRST` specially at :249), grounding system-block injection (~565-625), bridge loops (~1033, 1049, 1550), stream healing (1457, 1490). See the ~line 91 comment about Pinia setup-store re-runs during Vite HMR.
- Chat family under `packages/stage-ui/src/stores/chat/`: `session-store.ts:32` (`useChatSessionStore`), `stream-store.ts:9` (`useChatStreamStore`), `maintenance.ts:9` (`useChatMaintenanceStore`), `compaction.ts`, `constants.ts` (`CHAT_STREAM_CHANNEL_NAME = 'airi-chat-stream'`, `CONTEXT_CHANNEL_NAME = 'airi-context-update'`), `context-store.ts` + `context-providers/`, `data-store.ts`, `hooks.ts`, `intrusion-staging.ts`, `recent-topics.ts`, `salience.ts`, `session-message-merge.ts(+.test.ts)`, `state.ts`.
- Sub-surface stores: `useEventLogStore` (`stores/event-log.ts`), `useMemoryLifetimeStore` (`stores/memory-lifetime.ts`), `useAnimaDexWizardStore` (`stores/animadex-wizard.ts`), `useDisplayModelsStore` (`stores/display-models.ts`), `useTextToMotionStore` (`stores/modules/text-to-motion.ts`), `useCustomVrmAnimationsStore` (stage-ui-three).
- `useSettingsChat` (`packages/stage-ui/src/stores/settings/chat.ts:7`) — `sendMode` + `suggestMode`. There is no `stores/settings.ts`; the barrel is `stores/settings/index.ts`.
- `useAiriCardStore` (`stores/modules/airi-card.ts`) — card + `buildSystemPrompt` (used by ChatArea's context dialog).
- `useConsciousnessStore` (`stores/modules/consciousness.ts`) — `activeModel` / `activeProvider`.
- `useBackgroundStore` (`stores/background.ts`) — `journalEntries` backing InteractiveArea's media chips (lines 355-361).
- `useJournalPreviewStore` (`stores/journal-preview.ts:12`) — `openTextPreview` / `openImagePreview` / `downloadImage`.
- `useTextJournalStore` (`stores/memory-text-journal.ts`) — re-subscribes `CHAT_STREAM_CHANNEL_NAME` (:64) and `airi-intrusion-staging` (:70); `useShortTermMemoryStore` (`stores/memory-short-term.ts`).
- `useEchoesStore` (`stores/echo-chips.ts`) — mood/flavor echo chips.

## 6. Desktop-Focused SOPs

### 6.1 Add a Workspace Route / sub-view
1. Define `components/chat/<name>.vue` (thin wrapper; reuse a stage-ui view or stage-pages modal when the primitive already exists).
2. Import into `pages/chat.vue` alongside the existing sub-surface imports.
3. Add the `activeSurfaceComponent` map entry (~lines 95-108) with a matching id.
4. Add the label/icon entry to **both** inline template arrays (drawer ~1178 and sidebar ~1225) — they're duplicated.
5. Update the `useLocalStorage` union type on `airi:chat:left-panel-active` if you add a new id; also extend `EventCategoryFilter` etc. if your surface adds store filters.

### 6.2 Add or remove an action menu item (e.g. "Pin")
Keep both files in lockstep — the menu is driven by the **builder function**, not the template:
1. Extend `ChatActionMenuAction` in `action-menu/index.ts:1`.
2. Add a builder branch in `createChatActionMenuItems(...)` (11-79) with `action`, `label`, Iconify icon, optional `divider: true`, and `danger: true` if destructive; return `null` when your `canX` option is off — the trailing `.filter(Boolean)` drops it.
3. In `action-menu/index.vue`: emit in `defineEmits` (52-61), `handleAction` branch (~155); only touch the template if you need custom layout — the three iteration sites (398, 455, 482) pick up new entries automatically.
4. Wire the emit on the consumer (`assistant-item.vue` / `user-item.vue`).

### 6.3 Composer / send-state handling
- **Desktop host** (`InteractiveArea.vue`): local `messageInput`/`attachments` (46-47) + own `handleSend()` (535) with optimistic clear + URL revocation + draft restore, including the `INVOKE_CHARACTER_FIRST` empty-input path. Routing sends go through `chatOrchestrator.ingest(...)`. Do **not** bolt `useChatComposer` into here unless you deliberately intend unifying the surfaces.
- **Shared/mobile widget path** (`Widgets/ChatArea.vue`): reuse `useChatComposer({ tools })` — owns `messageInput`, `attachments`, `handleSend`, trash-confirm, imagine mode, posting to `useChatOrchestratorStore().ingest(...)`. Note: this widget has **no wand/suggestions** — the only parity gap between landscape and desktop/portrait.
- **WhisperDock / whisper bar**: the dock is lifecycle-only (open/close/proximity, `update:open`, `dismiss()`); sending lives in `WhisperComposerBar.vue` via `useChatComposer` with `onSendStart`/`onSendError`. Keep those intact when modifying the bar; don't "fix" WhisperDock expecting the send logic to live there.

### 6.4 Journal / memory chips (desktop host)
- Chips come from `groupedTextEntries` (line 327) / `latestImageEntries` (352). Group splitting into `'single' | 'echo-group'` at ~327-350; echo entries carry `echoType` from `useEchoesStore` (set at 271, 317). Click opens `useJournalPreviewStore().openTextPreview(...)` / `openImagePreview(...)` (bound at line 211, rendered at ~906-1060; collapsed flags `airi:chat:memories-collapsed` / `airi:chat:media-collapsed`).

### 6.5 Pre-Flight Grounding Panel (desktop only)
- Location: `InteractiveArea.vue:~1077-1190` (amber `.grounding-preview-panel`, shown when any grounding source is active).
- Debounced real-time search: `watchDebounced(messageInput, ..., { debounce: 1000 })` (155-184) → `textJournalStore.searchEntries({ query, limit: 3, characterId })` when `activeCard.extensions.airi.groundingMemoryEnabled`; sibling watcher (186-207) re-searches when the flag flips on.
- Badges (1092-1108): `Sensors Active` (`groundingEnabled`), `Grounded Memories (N)`, `Recent Topics (N)` (`groundingTopicsEnabled && recentTopics.length`), salience pill (`salienceEnabled`; `Salience Vibe Active` only when `salienceHot && salienceHistory.length > 0`, else `Salience Standby`), `Visual Scene Active` (`groundingDirectorScratchpadEnabled && latestDirectorScratchpad`).
- Injection alignment: `performSend` in `stores/chat.ts` injects `[ENVIRONMENTAL AWARENESS]` (~570), `[GROUNDED LONG-TERM MEMORIES]` (~588), `[RECENT TOPICS]` (~605), `[VISUAL STATE BOARD]` (~620).

### 6.6 Bubble / chip styling (desktop host)
- Echo chips class-switch on `entry.echoType === 'mood' | 'flavor'` (else indigo) in the chip row at ~960-1000; the echo-group two-story ticker sits above the single-entry cards. Journal chip download handlers call `journalPreviewStore.downloadImage` (~line 1057).
- On stage-layout surfaces, edit `Widgets/ChatArea.vue`. Prefer the existing UnoCSS patterns (`:class="[...]"` arrays, `bg-*`, `dark:*` tokens); no Tailwind-only utilities, no new color themes. Reuse existing keyframes/transitions before adding new ones.

## 7. Known Pitfalls

- **Composer divergence is real.** 4 surfaces, 2 ingestion paths. `useChatComposer` covers landscape `Widgets/ChatArea.vue` and `WhisperComposerBar`; `InteractiveArea.vue` and actor's page manage composer state by hand. A composable change never ripples into the desktop host — decide which surface you mean.
- **Workspace Route arrays are duplicated inline** inside the `pages/chat.vue` template (drawer + sidebar). Update both, or entries silently show up in only one menu.
- **`chat_messages.vue` exists only to forward a ref**: the right panel of the hub calls methods on `interactiveAreaRef` through it. Don't add logic there, don't delete it without rewiring `activeSurfaceRef?.interactiveAreaRef` (`chat.vue`:29-31).
- **WhisperDock is not the sender** — a lifecycle shell around `WhisperComposerBar`. Sending behavior "inside WhisperDock" actually means the bar (or the composable).
- **Per-window Pinia stores need BroadcastChannel sync.** Chat/Director state mutates independently in each Electron window; mutations must post canonical channels (see `docs/rosetta-stone.md` §13 for the full registry). From this surface: `airi:director-notes-sync` (publisher at `packages/stage-ui/src/stores/modules/artistry-autonomous.ts:58`), `airi-chat-input-bridge` (chat.ts:136), `airi-chat-stream` (constants.ts), `airi-intrusion-staging` (intrusion-staging.ts:18), `airi-chat-present` (ControlStripHost.vue:149). Match the channel strings exactly.
- **`healMozibake` iterates by code point, not UTF-16 index.** In `packages/stage-shared/src/text.ts:71-133`, the byte-reconstruction loop uses `for (const char of healed)` + `char.codePointAt(0)`, re-encoding surrogate pairs with `TextEncoder`. Do **not** "simplify" to index-based `charCodeAt(i)` — it corrupts multi-byte characters.
- **Avoid eager `{ deep: true }` watchers on session/stream data.** Streaming deltas constantly hit this surface; prefer `computed()` or narrow `watch(() => store.someField)`. Existing watchers in `InteractiveArea.vue` (lines 85, 186, 487, 764, 804) are deliberately non-deep.
- **Synthetic tool calls need `index: 0`.** The marker bridge (chat.ts ~893-901) constructs `{ id: `bridge-${nanoid()}`, index: 0, type: 'function', function: {...} }`. Strict OpenAI/DeepSeek gateways reject synthetic calls without `index: 0`.
- **Action menu entries go only through `createChatActionMenuItems(...)`** — the `.vue` renders the builder array at 3 sites (inline/hover, floating, context). Hand-adding a one-off menu item in the template patches only one site.
- **`performSend` treats the `INVOKE_CHARACTER_FIRST` sentinel specially** (chat.ts:249 converts it to an empty message; ingest options carry `triggerOnly`). Don't trim/normalize the message before `performSend` without preserving that path.

## 8. Verification

- stage-ui only (chat components, composer, markdown renderer): `pnpm -F @proj-airi/stage-ui typecheck`
- stage-layouts widgets (`Widgets/ChatArea.vue`, Layouts): `pnpm -F @proj-airi/stage-layouts typecheck`
- Desktop chat host (`InteractiveArea.vue`, `pages/chat.vue`, `components/chat/*`, eventa contracts): `pnpm -F @proj-airi/stage-tamagotchi typecheck` (runs `tsc --noEmit -p tsconfig.node.json`, then `vue-tsc --noEmit -p tsconfig.web.json`)
- UI-only class/copy changes usually need no script; run the above when TS logic, stores, imports, or the `createChatActionMenuItems` signature changed.

## 9. Canonical Design & Architecture Docs

- [docs/design-tamagotchi-chatbox-ux-improvements.md](docs/design-tamagotchi-chatbox-ux-improvements.md) — Tamagotchi chatbox UX improvements design.
- [docs/design-chatbox-magic-wand-flow.md](docs/design-chatbox-magic-wand-flow.md) — Chatbox magic-wand flow design.
- [docs/proposal-chatbox-revamp.md](docs/proposal-chatbox-revamp.md) — Chatbox revamp proposal.
- [docs/proposal-chatbox-slash-commands.md](docs/proposal-chatbox-slash-commands.md) — Chatbox slash-commands proposal.
- [docs/content/en/docs/showcase/05-chatbox-redesign.md](docs/content/en/docs/showcase/05-chatbox-redesign.md) — Chatbox redesign showcase.
- [docs/linux-wayland-chat-cpu-spikes.md](docs/linux-wayland-chat-cpu-spikes.md) — Linux Wayland chat CPU spikes (performance failure mode).
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — canonical concept→path index; §13 BroadcastChannel registry.

## Related Skills & References

- **Key Documents**: [[rosetta-stone]], [[design-tamagotchi-chatbox-ux-improvements]], [[design-chatbox-magic-wand-flow]], [[proposal-chatbox-revamp]], [[proposal-chatbox-slash-commands]], [[05-chatbox-redesign]], [[linux-wayland-chat-cpu-spikes]]
