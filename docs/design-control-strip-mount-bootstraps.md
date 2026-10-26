# Control Strip Mount Bootstraps: What Loads at First Paint and Why

**Status:** Audited against `ControlStrip.vue` at 455 lines (post-P2-adoption). Companion to the
`FROZEN_STATE_BOOTSTRAPS` ratchet in `ControlStrip.contract.test.ts`, which enforces the bar below.

## The bar

> *A bootstrap may enter this list only if a value it exposes is read during the strip's first
> render, or it owns a channel whose contract requires exactly one owner per app.*

Adding a store to the shell that fails this bar must be a deliberate, reviewed decision. The rejected
cases at the bottom show what "fails the bar" looks like.

## The whole argument in one sentence

The strip's first paint is a function of these stores: 24 of the 25 button-presentation fields are
store reads (the 25th is `isStageTamagotchi()`), and the pill's box, placement, and dots are too.

## Qualifying bootstraps (15)

| # | Bootstrap | Read at first paint |
|---|---|---|
| 1 | `useSettingsControlStrip` | `orientation`, `collapsed`, `dockedEdge`, `buttons` → container class, geometry, the row itself; `stageMode`, `stageDisabled`, `workspaceOpen` → presentation fields |
| 2 | `useControlStripButtons` | enabled / desktop-only / workspace filter — input to the row |
| 3 | `useControlStripButtonPresentation` | the 25-field descriptor set — renders the row |
| 4 | `useSettings` | `controlStripInteractionMode`, `captionDocking`, `captionLayoutMode`, `captionFollow*`, `headTetheredCaptionEnabled` — 7 presentation fields |
| 5 | `useTheme` | `themeMode`, `isDark` → theme button icon + dot |
| 6 | `useSettingsStageModel` | `gunslingerStance` → icon, colour, dot, tooltip |
| 7 | `useSettingsAudioDevice` | `enabled` → mic dot + tooltip |
| 8 | `useSettingsControlsIsland` | `fadeOnHoverEnabled`, `alwaysOnTop` → two dots |
| 9 | `useLiveSessionStore` | `powerState` → Gemini dot + tooltip |
| 10 | `useBackgroundStore` | atmosphere/background ids → dot, icon colour, tooltip; selfie journal entries |
| 11 | `useAiriCardStore` | `activeCard`/`activeCardId` → sandbox gate, workspace visibility |
| 12 | `useControlStripGeometry` | auto-hide, hover, placement, `containerStyle` — positions the pill |
| 13 | `useControlStripDrag` | `isDragging` → scale/shadow on the container (only this is read at paint) |
| 14 | `useControlStripCaptionRelay` | the single `airi-caption-overlay` watcher — exactly-one-owner channel |
| 15 | `useControlStripAction` | `dispatchAction` — click-time, but the row is dead without it |

`useControlStripSelfie` qualifies under the channel half of the bar: its viewfinder `{active:false}`
post fires immediately so a stale viewfinder can't linger after a reload. In principle deferrable
by moving the reset to the stage window — rejected: it would split a two-sided contract across two
windows, and the stage would have to know the strip's popover ids. Not worth it for one post.

## Mount-time work that isn't a store

- Gunslinger watcher (`{ immediate: true }`) — sends the stance to Stage-Mate on mount. Lazily
  imported, Electron-gated. **Correction:** `useElectronEventaInvoke` appears at
  `ControlStrip.vue:183` inside this watcher via dynamic `await import()` — it is *not* a static
  shell bootstrap and must not appear in the frozen list.
- Caption relay watcher + devtools hook (single owner, see #14).

## What already defers structurally (what async popovers were for)

Speech, providers, sync-engine, display-models, dating-sim, text-to-motion, and the
Live2D/MMD/Spine/VRM model stores instantiate only when their popover opens, because the popover
owns them. That is the store deferral `defineAsyncComponent` would have bought, achieved by
ownership instead of by an async boundary — which is why C is deferred indefinitely.

## Presentation field → store map (all 25)

| Field | Source |
|---|---|
| `themeMode`, `isDark` | `useTheme` |
| `stageTamagotchi` | `isStageTamagotchi()` (not a store) |
| `workspaceOpen`, `stageDisabled`, `stageEnabled`, `stageMateEnabled`, `chatOpen`, `captionOpen`, `stageMode` | `useSettingsControlStrip` (+ `stageEnabled`/`chatOpen`/`captionOpen` via its refs) |
| `interactionMode`, `captionDocking`, `captionLayoutMode`, `captionFollowStagePosition`, `captionFollowStageVisibility`, `headTetheredCaptionEnabled` | `useSettings` |
| `micEnabled` | `useSettingsAudioDevice` |
| `powerState` | `useLiveSessionStore` |
| `fadeOnHoverEnabled`, `alwaysOnTop` | `useSettingsControlsIsland` |
| `gunslingerStance` | `useSettingsStageModel` |
| `activeAtmosphereId`, `activeBackgroundId`, `chatboxActiveAtmosphereId`, `chatboxActiveBackgroundId` | `useBackgroundStore` |
