---
name: airi-stage-ui-surfaces
description: >-
  Use when building, styling, or debugging the cross-app Control Strip (desktop `mode="desktop"` pill inside Electron, and the `mode="mobile"` integration in stage-web/stage-pocket with its own default buttons and mobile UX rules), ControlStripHost/WidgetStage, RendererStage, floating Electron overlay windows, control islands, the action dispatcher (useControlStripAction, BUTTONS_CATALOG_VERSION, CUSTOMIZER_CATALOG, broadcast/custom-event bus), tray/window orchestration, or interactive stage layout containers.
---

# AIRI Stage UI Surfaces & Control Strip

Guidelines and exact code paths for AIRI's stage overlay surfaces. The **Control Strip** is the centerpiece: it is one shared component (`packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`, ~2941 lines) rendered in **three app shells** (desktop Electron, stage-web, stage-pocket) with platform-specific defaults and a `mode` prop that switches desktop vs mobile UX rules. Anything that "touches every surface" usually lands here.

## 1. Surface Map

- **Control Strip pill** — `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` (`mode?: 'desktop' | 'mobile'`, default `'desktop'`, lines 30-33). Exported via `packages/stage-ui/src/components/scenarios/layout/index.ts`.
- **ControlStripHost / WidgetStage** — `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (~1491 lines). The comms-hub "host" (audio pipeline, lip-sync, broadcast channels, speech runtime) that wraps `RendererStage` and, **on Electron only**, overlays the strip: `v-if="isElectron"` at `ControlStripHost.vue:1487-1489`. Exported as `WidgetStage` from `packages/stage-ui/src/components/scenes/index.ts:1` (the historical `Stage.vue` was split per `docs/project-control-strip-rfc.md`).
- **RendererStage** — `packages/stage-ui/src/components/scenes/RendererStage.vue` — pure avatar/background renderer.
- **Desktop stage window** — `apps/stage-tamagotchi/src/renderer/pages/index.vue` (~1000+ lines) renders `WidgetStage` (:937) and owns window-level behavior: transparency/click-through, hover-expand debounce, event bus listeners, and strip-state sync to main.
- **Web/pocket shells** — `apps/stage-web/src/pages/index.vue` and `apps/stage-pocket/src/pages/index.vue` (near-identical twins; keep them in lockstep).
- **Floating Electron windows** — managers in `apps/stage-tamagotchi/src/main/windows/` (`main/`, `stage/`, `chat/`, `settings/`, `widgets/`, `caption/`, `customizer/`, `inlay/`, `dashboard/`, …).

### Pinia stores
- `packages/stage-ui/src/stores/settings/control-strip.ts` — `useSettingsControlStrip` (212 lines). Owns `orientation`, `stageMode`/`interactionMode`, `collapsed`, `dockedEdge` (`'left' | 'right' | 'top' | 'bottom'`, default `'right'`), `stageEnabled`, `stageMateEnabled`, `chatOpen`, `captionOpen`, `backgroundTint`, `selfieIncludeBg`, and the **button catalog** `buttons` (see §2.3).
- `packages/stage-ui/src/stores/settings/controls-island.ts` — `useSettingsControlsIsland`: `alwaysOnTop`, `allowVisibleOnAllWorkspaces`, `controlsIslandIconSize`, and `fadeOnHoverEnabled` (shares the localStorage key `controls-island/fade-on-hover-enabled` with `apps/stage-tamagotchi/src/renderer/stores/controls-island.ts` on purpose — cross-package reactivity without importing app code).
- `packages/stage-ui/src/stores/settings/stage-model.ts`, `settings/index.ts` — renderer choice and general settings (incl. `stageViewControlsEnabled`, caption followers).

## 2. Control Strip Architecture (all apps)

### 2.1 Component & mount topology

| App | Where the pill mounts | Mode |
| --- | --- | --- |
| Desktop (stage-tamagotchi) | Inside `WidgetStage` (ControlStripHost) — `v-if="isElectron"`, `ControlStripHost.vue:1487-1489` | `desktop` (default) |
| stage-web / stage-pocket | At page root: `<ControlStrip mode="mobile" class="z-40" />` (`apps/stage-web/src/pages/index.vue:266`, `apps/stage-pocket/src/pages/index.vue:250`) | `mobile` |

Web/pocket never mount the strip inside `WidgetStage` (the `isElectron` guard is false there); instead the page-level mount is always present in both portrait and landscape.

### 2.2 Action dispatch chain
`useControlStripAction()` — `packages/stage-ui/src/composables/use-control-strip-action.ts` (175 lines). `dispatchAction(actionId)`:
1. Executes the local mutation (switch over ~20 action ids: `head-tethered-caption`, `viewport-cycle-modes` + per-mode setters syncing `settingsStore.stageViewControlsEnabled` and `useModelStore().interactionMode`, `gemini-session/tts/grounding`, `theme-mode`, `caption-docking` cycling `none → bottom → top → head`, `stage`, `stage-mate`, `chat`, `caption`, `mic`, `always-on-top`, `viewport-auto-hide`, `layout` …).
2. Broadcasts on `BroadcastChannel('airi-control-strip-actions')` unless `skipBroadcast`.
3. Fires `window.CustomEvent('control-strip:action', { detail: { action } })`.

**Desktop event bus** (listeners in `apps/stage-tamagotchi/src/renderer/pages/index.vue:889-900`): `control-strip:action` → `handleControlStripAction` (:714) opens/closes the chat window, settings window, quits, handles Gemini-onboarding notice, etc. Other events: `control-strip:open-customizer` → `electronCustomizerToggleVisibility` (:655-658, opens `customizer.vue` window), `control-strip:open-settings` → `electronOpenSettings` eventa, `control-strip:drag-start`, `control-strip:popover-changed`, `control-strip:apply-size-preset`. The page also relays BroadcastChannel actions back into the local CustomEvent (`:179-184`).

**Web/pocket gap:** the apps do **not** listen to `control-strip:open-customizer` or `control-strip:open-settings`. Strip buttons instead navigate by dispatching `control-strip:open-settings` with route detail (`ControlStrip.vue:453-454, 1013-1022` — `/settings/airi-card?...`), which only Electron handles; web/pocket customize via the settings page (§2.4). Right-click customize fires into the void on mobile.

### 2.3 Button catalog & platform defaults (`stores/settings/control-strip.ts`)

- **Catalog**: `packages/stage-ui/src/constants/control-customizer.ts` — `CUSTOMIZER_CATALOG: CustomizerGroup[]`, 5 groups (`stage-view` Stage View, `system-window` System & Window, `captions` Captions, `actor-wardrobe` Actor & Wardrobe, `AI & Gemini`) totaling ~48 items. `CustomizerItem` schema: `{ id, label, description, icon, type: 'toggle'|'cycler'|'action'|'menu', defaultOnStrip, binding?, desktopOnly? }`. **18 items are `desktopOnly: true`** (window managers: always-on-top, audio input device, stage-mate, exit, selfies, presets, etc.).
- **Desktop defaults** `DEFAULT_BUTTONS` (:22-40): chat, actor-characters, mic, stage, caption, gemini-session, settings, layout, viewport-auto-hide **on**; gemini-witness/frequency/tts/voice/schedule/grounding, actor-selfies, actor-macaron off.
- **Mobile defaults** `DEFAULT_MOBILE_BUTTONS` (:42-51), all on: `viewport-cycle-modes`, `head-tethered-caption`, `theme-mode`, `actor-characters`, `actor-avatars`, `actor-expressions`, `gemini-session`, `actor-wardrobe`.
- **Platform selection**: `getDefaultControlStripButtons()` (:53-55) switches on `isStageTamagotchi()` (`packages/stage-shared/src/environment.ts:15`).
- **Version gating** — read the NOTICE comments before touching (:16-19): `BUTTONS_CATALOG_VERSION = 'v4'` (:20). Desktop accepts stored `v4` **or** `v5` as valid; mobile expects `v4-mobile` (:102-109). **Do not bump the version to add/rename buttons** — it wipes every user's custom arrangement. The keyed merge (:110-150) safely appends new defaults, prunes unknown ids, and resyncs icons/labels while preserving enabled state and order. Validate ids against defaults ∪ full catalog, because users can promote catalog-only items (e.g. always-on-top).
- **`buttons` uses plain `useLocalStorage`, not `useLocalStorageManualReset`** (:94-98) — the ManualReset wrapper's shallow watcher drops array-reference replacements in Electron's multi-window context.

### 2.4 The editors
- **Desktop**: dedicated Customizer window — `apps/stage-tamagotchi/src/renderer/pages/customizer.vue` (toggle via `electronCustomizerToggleVisibility`; it re-dispatches `control-strip:action` CustomEvents at :268, :342).
- **Web/pocket (and desktop)**: the in-settings editor `packages/stage-pages/src/pages/settings/stage/index.vue` — route `/settings/stage` (sidebar entry `packages/stage-pages/src/pages/settings/index.vue:88`). Filters `desktopOnly` items on non-desktop, reorders within `buttons`, and enforces `MAX_MOBILE_SLOTS = 7` (:14). `resetButtons()` there (:135) restores the platform defaults.
- Master intent docs: `docs/catalog-control-strip.md` (5 categories / per-button display-type table) and `docs/project-control-strip-rfc.md`.

### 2.5 Desktop window machinery (Electron only)
- **Transparency & click-through** — `applyTransparencyState()` in `apps/stage-tamagotchi/src/renderer/pages/index.vue:376-416`. `isNotchMode = autoHideMode && collapsed && !hoverExpanded && !activePopover` (:377). Collapsed-notch hit-testing is **pure geometry** from `useElectronRelativeMouse` (:392-401: `rx <= 14` for left dock, `rx >= winW - 14` right, `ry <= 14` top, `ry >= winH - 14` bottom), not DOM rects.
- **Hover expand / 400ms debounce** — `useElectronMouseInElement(controlStripRoot)` (:83-84) drives `hoverExpanded` with a 400ms collapse timer (:244-258).
- **State sync to main** — `electronControlStripSyncState` (shared/eventa.ts:290-298; payload `{ activePopover, lastPlacement, orientation, collapsed?, backgroundColor?, stripLength? }`) invoked at `index.vue:357`; handler persists into app window config under `{ title: 'AIRI', tag: 'main' }` (`apps/stage-tamagotchi/src/main/windows/main/rpc/index.electron.ts:92`).
- **Sizing** — `stripLength = 52 + 44 * activeButtons.length` (ControlStrip.vue, `stripLength` computed); `applySizePreset` dispatches `control-strip:apply-size-preset` with monitor/alignment detail (ControlStrip.vue:~623-636).

## 3. Web / Pocket Integration (`mode="mobile"`)

The mobile experience lives in the same `ControlStrip.vue`; every behavioral fork is a `props.mode === 'mobile'` branch. Current map of those branches (verify line numbers if the file moves):

| Concern | Mobile rule | Anchor |
| --- | --- | --- |
| Buttons | `activeButtons` filters out `desktopOnly` catalog items | `ControlStrip.vue:204-214` |
| Orientation | Strictly vertical — `toggleOrientation()` no-ops | `:1217-1220` |
| Edge docking | `dockedEdge` only `'left' | 'right'` in practice; container pinned `top: 50%` centered on the docked edge (`left: 0` / `right: 0`) | `containerStyle` computed `:1057+` |
| Drag handle | `onDragStart` toggles `collapsed` (no window dragging on mobile) | `:1057+` |
| Popovers | Placement is dock-relative: `dockedEdge === 'left' ? 'right' : 'left'` | `popoverPlacement` `:683-684` |
| Panels | Emoji/expression/wardrobe grids keep `variant="mobile"` touch sizing | `docs/project-mobile-revamp.md` §3 |
| Customizer | No right-click path (no listener, §2.2 gap); use `/settings/stage`, 7-slot cap | `settings/stage/index.vue:14` |

**Opposite-edge chatbox rule** (both layout modes): the side chatbox docks to the *opposite* edge of the strip to avoid collision — `dockedEdge === 'left' ? 'right-6' : 'left-6'` applied to `InteractiveArea` (`apps/stage-web/src/pages/index.vue:262`, `apps/stage-pocket/src/pages/index.vue:256`), gated on `!isPortraitMobile`. Orientation detection: `isLandscape = useMediaQuery('(orientation: landscape)')` + `isPortraitMobile = breakpoints.smaller('md') && !isLandscape` (web `:72-73`, pocket `:66-67`; a width-only breakpoint misclassified landscape phones — keep the orientation check).

**Interaction planes** (`docs/project-mobile-revamp.md` §4): portrait = companion centered above `MobileWhisperSheet` with the 14px notch tab flush on the chosen edge; landscape/tablet = side-by-side theatre (avatar between strip and opposite-edge chatbox). Pocket adds a `MobileHeader`; web renders landscape-only chat through `InteractiveArea`.

> **Doc drift warning:** `docs/project-mobile-revamp.md` references `packages/stage-layouts/src/components/Layouts/MobileControlStrip.vue` and `MobileControlCustomizerDialog.vue` — **neither file exists**. The as-shipped integration is the shared `ControlStrip.vue` with `mode="mobile"` plus the `stage-pages` `/settings/stage` editor. Do not create the doc's named files; update the shared component.

## 4. Core SOPs

### 4.1 Add a new Control Strip button (end-to-end)
1. **Catalog**: add a `CustomizerItem` to the right group in `constants/control-customizer.ts`; set `desktopOnly: true` if it depends on Electron window managers.
2. **Defaults**: append to `DEFAULT_BUTTONS` and/or `DEFAULT_MOBILE_BUTTONS` in `stores/settings/control-strip.ts` (the keyed merge picks it up for existing users — **no version bump**).
3. **Behavior**: add a `case` to `useControlStripAction().dispatchAction`, or in-strip state if it opens a popover (see `activePopover` handling around `ControlStrip.vue:~1180-1208`).
4. **Visual state**: if the icon/status-dot varies with state, add the `v-if="btn.id === '<id>'"` badge branch (`ControlStrip.vue:~1483-1651`) and the `getButtonIcon` fast-path (`:~1223+`).
5. **Tests on all shells**: desktop pill (customizer window), web/pocket landscape, and pocket portrait — plus `/settings/stage` editor rendering.

### 4.2 Change mobile UX rules
Edit the `mode === 'mobile'` branches in §3's table — not a new component. Touch `DEFAULT_MOBILE_BUTTONS` / `MAX_MOBILE_SLOTS` for default or slot-count changes. Then re-check the opposite-edge rule in both web and pocket `index.vue`.

### 4.3 Create or modify a floating window overlay (Desktop)
1. Register the manager under `apps/stage-tamagotchi/src/main/windows/<name>/` (`transparent: true`, `frame: false`, `alwaysOnTop: true` as needed).
2. Cross process boundaries use `@moeru/eventa` invoke contracts (`apps/stage-tamagotchi/src/shared/eventa.ts`) or BroadcastChannel — never raw `ipcRenderer` string events in new code.
3. Guard every main-process window handle with `!win.isDestroyed()`.

### 4.4 Styling
- UnoCSS arrays (`:class="['px-2 py-1', 'flex items-center']"`), `@proj-airi/ui` primitives + Iconify icons over bespoke SVGs.
- Glassmorphic pill styling and `backgroundTint` live in `ControlStrip.vue`; dark tokens via `dark:*`.

## 5. Known Pitfalls & Failure Modes

- **`BUTTONS_CATALOG_VERSION` bump = user wipe.** Only bump for genuine schema-breakage (see NOTICE at `control-strip.ts:16-19`). Desktop whitelist is `v4|v5`, mobile is `v4-mobile` — keep these in sync when shipping button changes.
- **Strip `buttons` must stay on plain `useLocalStorage`** (`:94-98`); the ManualReset wrapper silently drops array replacements in multi-window Electron.
- **`controls-island/fade-on-hover-enabled` is an intentional shared localStorage key** between `packages/stage-ui` and `apps/stage-tamagotchi` stores — don't "fix" the duplication.
- **Global click-through override trap:** persistent flags (`stageViewControlsEnabled`, open popovers/dialogs) evaluate early in `applyTransparencyState()`; uncapped they force `setIgnoreMouseEvents([false, { forward: true }])` across all modes. In notch mode `isNotchMode` MUST scope these (`if (!isNotchMode && ...)`, index.vue:379) so desktop clicks still pass through the transparent 34px window region.
- **DOM-rect staleness across CSS transforms:** `getBoundingClientRect()` only refreshes on mouse move / class change; a stationary cursor during the 300ms collapse transition keeps `isOutside` stale. Notch hit-testing therefore uses geometric bounds from `useElectronRelativeMouse` (index.vue:392-401). Do not reintroduce rect-based checks for animated notches.
- **Pointer-mode side effects:** `viewport-cycle-modes` also *mutates* `settingsStore.stageViewControlsEnabled` and `useModelStore().interactionMode` (`use-control-strip-action.ts:26-43`) — those flags feed `applyTransparencyState`, so a new mode or reorder can silently change click-through behavior.
- **Missing mobile listeners:** web/pocket ignore `control-strip:open-customizer`/`open-settings` (§2.2). If you add a strip-driven settings route, wire a listener in *both* web and pocket `index.vue` (or route through the settings page) — and update the twins together.
- **`docs/project-mobile-revamp.md` names components that were never built** (`MobileControlStrip.vue`, `MobileControlCustomizerDialog.vue`) — trust code over that doc.
- **Window lifetime:** calling BrowserWindow methods on destroyed instances crashes Electron — check `isDestroyed()`.
- **Desktop window always visible, renderer optionally hidden:** the main window shows even with stage hidden so the pill stays reachable; `stageEnabled` controls only avatar/WhisperDock rendering (RFC "Dual Visibility Architecture"). Don't gate window creation on it.

## 6. Verification

- Shared strip/store changes: `pnpm -F @proj-airi/stage-ui typecheck`
- Desktop window/page changes: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (`typecheck:node` then `typecheck:web`)
- stage-pages editor changes: `pnpm -F @proj-airi/stage-pages typecheck`
- Web/pocket mount or layout changes: build/run the app (`pnpm -F @proj-airi/stage-web dev`, `pnpm -F @proj-airi/stage-pocket dev`); there is no behavior test suite for the strip.
- Manual: desktop — drag, dock to each edge, collapse/notch hover, verify OS clicks pass through the notch; mobile — portrait vs landscape, left vs right edge, opposite-edge chatbox placement, `/settings/stage` slot cap.

## 7. Authoritative Design & Architecture Documents

- [docs/project-control-strip-rfc.md](docs/project-control-strip-rfc.md) — Control Strip revamp RFC (pill schema, endcaps, mode toggle, notch docking, startup visibility orchestration).
- [docs/catalog-control-strip.md](docs/catalog-control-strip.md) — master catalog of strip items by category with icons/display-type/default-state.
- [docs/project-mobile-revamp.md](docs/project-mobile-revamp.md) — mobile UX design (interaction planes, dockedEdge coordination, touch-first customizer). **Partially stale**: its named `MobileControlStrip.vue`/`MobileControlCustomizerDialog.vue` files were never built; the shipped version is `ControlStrip mode="mobile"` (§3).
- [docs/design-stage-ui-context-bridge-control-island.md](docs/design-stage-ui-context-bridge-control-island.md) — Stage UI context bridge / control island architecture.
- [docs/project-navigation-routing-overhaul.md](docs/project-navigation-routing-overhaul.md) — Navigation & routing overhaul project plan.
- [docs/proposal-studio-sidetab.md](docs/proposal-studio-sidetab.md) — Studio sidetab proposal.
- [docs/proposal-novel-stage-concepts.md](docs/proposal-novel-stage-concepts.md) — Stage↔Chat unification concepts (inline/sidebar stage, Magic Wand WhisperDock).
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — canonical concept→path index; §1 eventa, §13 BroadcastChannel registry (`airi-control-strip-actions` lives there).

## Related Skills & References

- **Key Documents**: [[project-control-strip-rfc]], [[catalog-control-strip]], [[project-mobile-revamp]], [[design-stage-ui-context-bridge-control-island]], [[project-navigation-routing-overhaul]], [[proposal-studio-sidetab]], [[proposal-novel-stage-concepts]], [[rosetta-stone]]
