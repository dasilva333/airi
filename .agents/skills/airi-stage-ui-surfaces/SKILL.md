---
name: airi-stage-ui-surfaces
description: >-
  Build/debug stage shells and layout: desktop/mobile Control Strip, ControlStripHost, WidgetStage, RendererStage, control islands, action dispatch, tray/window coordination. Customizer window uses airi-controlstrip-customizer; desktop chat UI uses airi-desktop-chatbox.
---

# AIRI Stage UI Surfaces & Control Strip

Guidelines and exact code paths for AIRI's stage overlay surfaces. The **Control Strip** is the centerpiece: it is one shared component (`packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`, **455 lines**) rendered in **three app shells** (desktop Electron, stage-web, stage-pocket) with platform-specific defaults and a `mode` prop that switches desktop vs mobile UX rules. It was decomposed from 3,952 lines into a shell + 13 self-serving popovers + 9 shell composables — read [references/control-strip-decomposition.md](references/control-strip-decomposition.md) before touching it.

## 1. Surface Map

- **Control Strip Shell** — `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` (`mode?: 'desktop' | 'mobile'`, default `'desktop'`). Owns docking, orientation, drag start, geometry, `activePopover`, the button row and the popover bounds container. Exported via `packages/stage-ui/src/components/scenarios/layout/index.ts`.
- **Control Strip Popovers** — `packages/stage-ui/src/components/scenarios/layout/popovers/*.vue` (13 components). Each is self-serving: it reads its own stores and emits `close`. Registered in `popovers/registry.ts`; shared chrome is `StripPopover.vue`; the shared monitor/alignment UI is `popovers/components/WindowGeometryPanel.vue`.
- **Control Strip Composables** — `packages/stage-ui/src/composables/use-control-strip-*.ts`: `action`, `buttons`, `button-presentation`, `geometry`, `drag`, `selfie`, `caption-relay`, `settings-route`, `window-geometry`. Contracts and required call order are tabulated in the decomposition reference.
- **Control Strip Presentation** — `packages/stage-ui/src/constants/control-strip-labels.ts` resolves icon / icon colour / tooltip / short label / status dot per button id, plus the strip's option tables.
- **ControlStripHost / WidgetStage** — `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (~2,166 lines). The comms-hub "host" (audio pipeline, lip-sync, broadcast channels, speech runtime) that wraps `RendererStage` and, **on Electron only**, overlays the strip: the `v-if="isElectron"` wrapper mounts `<ControlStrip ref="controlStripRef" />`. Exported as `WidgetStage` from `packages/stage-ui/src/components/scenes/index.ts` (the historical `Stage.vue` was split per `docs/project-control-strip-rfc.md`).
- **RendererStage** — `packages/stage-ui/src/components/scenes/RendererStage.vue` — pure avatar/background renderer.
- **Desktop stage window** — `apps/stage-tamagotchi/src/renderer/pages/index.vue` renders `WidgetStage` and owns window-level behavior: transparency/click-through, hover-expand debounce, event bus listeners, and strip-state sync to main.
- **Web/pocket shells** — `apps/stage-web/src/pages/index.vue` and `apps/stage-pocket/src/pages/index.vue` (near-identical twins; keep them in lockstep).
- **Floating Electron windows** — managers in `apps/stage-tamagotchi/src/main/windows/` (`main/`, `stage/`, `chat/`, `settings/`, `widgets/`, `caption/`, `customizer/`, `inlay/`, `dashboard/`, …).

### Pinia stores
- `packages/stage-ui/src/stores/settings/control-strip.ts` — `useSettingsControlStrip`. Owns `orientation`, `stageMode`/`interactionMode`, `collapsed`, `dockedEdge` (`'left' | 'right' | 'top' | 'bottom'`), `stageEnabled`, `stageMateEnabled`, `chatOpen`, `captionOpen`, `backgroundTint`, `selfieIncludeBg`, and the **button catalog** `buttons` (see §2.3).
- `packages/stage-ui/src/stores/settings/controls-island.ts` — `useSettingsControlsIsland`: `alwaysOnTop`, `allowVisibleOnAllWorkspaces`, `controlsIslandIconSize`, and `fadeOnHoverEnabled` (shares the localStorage key `controls-island/fade-on-hover-enabled` with `apps/stage-tamagotchi/src/renderer/stores/controls-island.ts` on purpose — cross-package reactivity without importing app code).
- `packages/stage-ui/src/stores/settings/stage-model.ts`, `settings/index.ts` — renderer choice and general settings (incl. `stageViewControlsEnabled`, caption followers).

## 2. Control Strip Architecture (all apps)

### 2.1 Component & mount topology

| App | Where the pill mounts | Mode |
| --- | --- | --- |
| Desktop (stage-tamagotchi) | Inside `WidgetStage` (ControlStripHost) behind the `v-if="isElectron"` wrapper | `desktop` (default) |
| stage-web | At page root: `<ControlStrip mode="mobile" class="z-45" />` (`apps/stage-web/src/pages/index.vue`) | `mobile` |
| stage-pocket | At page root: `<ControlStrip mode="mobile" class="z-45" />` (`apps/stage-pocket/src/pages/index.vue`) | `mobile` |

Web/pocket never mount the strip inside `WidgetStage` (the `isElectron` guard is false there); instead the page-level mount is always present in both portrait and landscape.

### 2.2 Action dispatch chain
`useControlStripAction()` — `packages/stage-ui/src/composables/use-control-strip-action.ts`. `dispatchAction(actionId, options?)`:
1. Executes the local mutation (switch over the action ids: `head-tethered-caption`, `viewport-cycle-modes` + per-mode setters syncing `settingsStore.stageViewControlsEnabled` and `useModelStore().interactionMode`, `gemini-session`/`gemini-tts`/`gemini-grounding`, `theme-mode`, `caption-docking` cycling `none → bottom → top → head`, `stage`, `stage-mate`, `chat`, `caption`, `mic`, `workspace`, `always-on-top`, `viewport-auto-hide`, `layout` …).
2. Broadcasts on `BroadcastChannel('airi-control-strip-actions')` unless `skipBroadcast`.
3. Always fires `window.CustomEvent('control-strip:action', { detail: { action } })` — including when `skipBroadcast` is set.

**Desktop event bus** (listeners in `apps/stage-tamagotchi/src/renderer/pages/index.vue`): `control-strip:action` → `handleControlStripAction` (chat window, settings window, quit, Gemini-onboarding notice); `control-strip:open-customizer` → `electronCustomizerToggleVisibility` (opens `customizer.vue`); `control-strip:open-settings` → `electronOpenSettings` eventa; plus `control-strip:drag-start`, `control-strip:popover-changed` → `applyBoundsUpdate`, and `control-strip:apply-size-preset`. The page also relays BroadcastChannel actions back into the local CustomEvent.

**`control-strip:open-settings` has exactly one emitter**: `useControlStripSettingsRoute` (`composables/use-control-strip-settings-route.ts`). On Electron it hands the route to the host window; on web it pushes the router. It is called from `CharactersPopover` (profile edit / gallery) and `MotionStudioPopover` (manage motions) — not from the shell.

**Web/pocket gap:** the apps do **not** listen to `control-strip:open-customizer`. Right-clicking a strip button therefore fires into the void on mobile; web/pocket customize via the settings page (§2.4).

### 2.3 Button catalog & platform defaults (`stores/settings/control-strip.ts`)

- **Catalog**: `packages/stage-ui/src/constants/control-customizer.ts` — `CUSTOMIZER_CATALOG: CustomizerGroup[]`, **5 groups** (`stage-view`, `system-window`, `captions-layout`, `actor-wardrobe`, `ai-gemini`) totalling **44 items**; **20 of them carry `desktopOnly: true`**. `CustomizerItem` schema: `{ id, label, description, icon, type: 'toggle'|'cycler'|'action'|'menu', defaultOnStrip, binding?, desktopOnly?, disabled? }`.
- **Desktop defaults** (`DEFAULT_BUTTONS`, enabled): `chat`, `actor-characters`, `mic`, `stage`, `stage-atmosphere`, `caption`, `gemini-session`, `settings`, `layout`, `viewport-auto-hide`, `workspace`, `actor-all-emotions`, `actor-vfx`, `actor-motion-playground`. Disabled by default: `gemini-witness`/`frequency`/`tts`/`voice`/`schedule`/`grounding`, `actor-selfies`, `actor-macaron`.
- **Mobile defaults** (`DEFAULT_MOBILE_BUTTONS`): `viewport-cycle-modes`, `head-tethered-caption`, `actor-motion-playground`, `actor-motions`, `actor-all-emotions`, `actor-vfx`, `actor-selfies`.
- **Platform selection**: `getDefaultControlStripButtons()` switches on `isStageTamagotchi()` (`packages/stage-shared/src/environment.ts`).
- **Version gating** — read the NOTICE comments before touching: `BUTTONS_CATALOG_VERSION = 'v5'`. Desktop accepts stored `v4` **or** `v5`; mobile accepts `v4-mobile` **or** `v5-mobile`. **Do not bump the version to add or rename buttons** — it wipes every user's custom arrangement. The keyed merge safely appends new defaults, prunes unknown ids, and resyncs icons/labels while preserving enabled state and order. Validate ids against defaults ∪ full catalog, because users can promote catalog-only items (e.g. `always-on-top`).
- **`buttons` uses plain `useLocalStorage`, not `useLocalStorageManualReset`** — the ManualReset wrapper's shallow watcher drops array-reference replacements in Electron's multi-window context.

### 2.4 The editors
- **Desktop**: dedicated Customizer window — `apps/stage-tamagotchi/src/renderer/pages/customizer.vue` (toggle via `electronCustomizerToggleVisibility`; it re-dispatches `control-strip:action` CustomEvents).
- **Web/pocket (and desktop)**: the in-settings editor `packages/stage-pages/src/pages/settings/stage/index.vue` — route `/settings/stage`. Filters `desktopOnly` items on non-desktop and reorders within `buttons` (no slot cap — users may add as many as they want). `resetButtons()` restores the platform defaults.
- Master intent docs: `docs/catalog-control-strip.md` (5 categories / per-button display-type table) and `docs/project-control-strip-rfc.md`.

### 2.5 Desktop window machinery (Electron only)
- **Transparency & click-through** — `applyTransparencyState()` in `apps/stage-tamagotchi/src/renderer/pages/index.vue`. `isNotchMode = autoHideMode && collapsed && !hoverExpanded && !activePopover`. Collapsed-notch hit-testing is **pure geometry** from `useElectronRelativeMouse` (`rx <= 14` for left dock, `rx >= winW - 14` right, `ry <= 14` top, `ry >= winH - 14` bottom), not DOM rects.
- **Hover expand / 400 ms debounce** — `useElectronMouseInElement(controlStripRoot)` drives `hoverExpanded`; the collapse timer itself lives in `useControlStripGeometry` (`HOVER_COLLAPSE_DELAY_MS = 400`).
- **State sync to main** — `electronControlStripSyncState` (`apps/stage-tamagotchi/src/shared/eventa.ts`; payload `{ activePopover, lastPlacement, orientation, collapsed?, backgroundColor?, stripLength? }`); the handler persists into app window config under `{ title: 'AIRI', tag: 'main' }`.
- **Sizing** — `stripLength = 52 + 44 * activeButtons.length`, from `useControlStripGeometry`. `applySizePreset` and the `get-monitor-count` IPC live in `useControlStripWindowGeometry`, which is the single owner of `control-strip:apply-size-preset`.
- **Multi-Monitor Display Discovery & Placement** — Desktop stage (`actor.vue`) discovers active displays via `useElectronAllDisplays()` from `@proj-airi/electron-vueuse` and forwards them to `RendererStage.vue` and `HeadTetheredRadialMenu.vue`. The radial menu's `monitor` wedge activates when `monitorCount > 1` or `displays.length > 1`, generating dynamic wedge subtitles with display resolution, orientation, and Primary tags.
- **Stage Pausing & Render Throttling** — `<WidgetStage :paused="stagePaused">` receives `stagePaused` from `useStageWindowLifecycleStore()`. Forwarded through `ControlStripHost.vue` to `RendererStage.vue`, this freezes animation and render loops across Three.js VRM, Live2D, Spine, and MMD when the window is hidden, minimized, or the screen is locked/suspended. See `airi-desktop-lifecycle-power-throttling`.

### 2.6 Decomposed architecture (as built)

See [references/control-strip-decomposition.md](references/control-strip-decomposition.md) for the authoritative table of composable contracts, popover contracts and traps. Summary:

- **Shell** — 455 lines. Owns `activePopover`, the `control-strip:popover-changed` watcher, the popover bounds container (`w-64 max-h-[440px]`, plus the `w-[360px]` override for `actor-motion-playground`), `onClickOutside`, the menu-button allowlist (`openPresetPopover`/`handleAction`/`handleRightClick`), and the wiring for the selfie channels and caption relay.
- **13 popovers** — `stage-preset`, `chat-preset`, `gemini-voice`, `actor-characters`, `actor-avatars`, `actor-wardrobe`, `actor-motions`, `actor-motion-playground` (Motion Studio), `actor-all-emotions`, `actor-vfx`, `actor-selfies`, `actor-macaron` (Stage-Mate floatie/treat materials), `stage-atmosphere`. Twelve live in `STRIP_POPOVER_COMPONENTS`; `actor-selfies` is rendered explicitly with props because its capture channel must stay single-owner in the shell.
- **Presentation** — the button row renders `{ icon, iconColor, title, shortLabel, dot }` descriptors. There are no per-button `v-if` branches left, and the 21 inline status-dot spans are gone.

#### Contract Test Invariants (`ControlStrip.contract.test.ts`)
`pnpm -F @proj-airi/stage-ui test run src/components/scenarios/layout/ControlStrip.contract.test.ts` enforces:
1. **Single-owner channels**: no `.vue` popover may open a `BroadcastChannel`. `airi-caption-overlay`, `airi-control-strip-actions`, `airi:stage-capture` and `airi:stage-selfie-viewfinder` are owned by the shell or by `useControlStripCaptionRelay` / `useControlStripSelfie` / `useControlStripAction`.
2. **Popover registry integrity**: every rendered popover has a routable trigger, every routed id renders exactly once, and no id is rendered by *both* the registry and an inline branch.
3. **Affordance coverage**: badge/icon/title/label ids stay inside `CUSTOMIZER_CATALOG`; every default-enabled button reaches the router or the dispatcher.
4. **Eager bootstrap ratchet**: the shell may only shrink its set of eager *state* bootstraps (helpers like `useControlStrip*` are not counted).
5. **Cross-window surface**: the exact `control-strip:*` event set and the channel set are pinned.

Two guards **self-retire** via `skipIf`: the label-parity test (the shell no longer defines the original functions; parity was proven over 792k comparisons before the cutover) and the template dot-id guard (no inline badges remain). They are intentionally inert, not stale.

## 3. Web / Pocket Integration (`mode="mobile"`)

The mobile experience lives in the same `ControlStrip.vue`; every behavioral fork is a `mode`/`props.mode === 'mobile'` check. Anchor by symbol, not line number:

| Concern | Mobile rule | Anchor |
| --- | --- | --- |
| Buttons | `activeButtons` filters out `desktopOnly` catalog items | `use-control-strip-buttons.ts` |
| Orientation | Strictly vertical — `toggleOrientation()` no-ops | shell `toggleOrientation` |
| Edge docking | `dockedEdge` only `'left' | 'right'` in practice; container pinned `top: 50%` centered on the docked edge | `useControlStripGeometry` → `containerStyle` |
| Drag handle | `onDragStart` toggles `collapsed` (no window dragging on mobile) | `use-control-strip-drag.ts` |
| Popovers | Placement is dock-relative: `dockedEdge === 'left' ? 'right' : 'left'` | `useControlStripGeometry` → `popoverPlacement` |
| Panels | Emoji/expression/wardrobe grids keep `variant="mobile"` touch sizing | `docs/project-mobile-revamp.md` §3 |
| Customizer | No right-click path (no listener, §2.2); use `/settings/stage`, no slot cap | `StageControlEditor.vue` |

**Opposite-edge chatbox rule** (both layout modes): the side chatbox docks to the *opposite* edge of the strip to avoid collision — `dockedEdge === 'left' ? 'right-6' : 'left-6'` applied to `InteractiveArea`, gated on `!isPortraitMobile`. Orientation detection: `isLandscape = useMediaQuery('(orientation: landscape)')` + `isPortraitMobile = breakpoints.smaller('md') && !isLandscape` (a width-only breakpoint misclassified landscape phones — keep the orientation check).

**Interaction planes** (`docs/project-mobile-revamp.md` §4): portrait = companion centered above `MobileWhisperSheet` with the 14px notch tab flush on the chosen edge; landscape/tablet = side-by-side theatre (avatar between strip and opposite-edge chatbox). Pocket adds a `MobileHeader`; web renders landscape-only chat through `InteractiveArea`.

> **Doc drift warning:** `docs/project-mobile-revamp.md` references `packages/stage-layouts/src/components/Layouts/MobileControlStrip.vue` and `MobileControlCustomizerDialog.vue` — **neither file exists**. The as-shipped integration is the shared `ControlStrip.vue` with `mode="mobile"` plus the `stage-pages` `/settings/stage` editor. Do not create the doc's named files; update the shared component.

## 4. Core SOPs

### 4.1 Add a new Control Strip button (end-to-end)
1. **Catalog**: add a `CustomizerItem` to the right group in `constants/control-customizer.ts`; set `desktopOnly: true` if it depends on Electron window managers.
2. **Defaults**: append to `DEFAULT_BUTTONS` and/or `DEFAULT_MOBILE_BUTTONS` in `stores/settings/control-strip.ts` (the keyed merge picks it up for existing users — **no version bump**).
3. **Behavior**: add a `case` to `useControlStripAction().dispatchAction`, **or** add the id to the shell's menu allowlist and register a popover in `popovers/registry.ts` (a popover is a self-serving component that emits `close`).
4. **Visual state**: this is data now, not template. Add the id to `resolveControlStripIcon` / `IconColor` / `Title` / `ShortLabel` in `constants/control-strip-labels.ts` if it needs anything other than the stored label/icon, and add it to `CONTROL_STRIP_DOT_IDS` plus `resolveControlStripDot` if it needs a status dot. Do **not** add a `v-if="btn.id === …"` branch — the row renders descriptors only.
5. **Tests on all shells**: desktop pill (customizer window), web/pocket landscape, and pocket portrait — plus `/settings/stage` editor rendering.

### 4.2 Change mobile UX rules
Edit the `mode === 'mobile'` branches in §3's table — not a new component. Touch `DEFAULT_MOBILE_BUTTONS` for default changes (no slot cap). Then re-check the opposite-edge rule in both web and pocket `index.vue`.

### 4.3 Create or modify a floating window overlay (Desktop)
1. Register the manager under `apps/stage-tamagotchi/src/main/windows/<name>/` (`transparent: true`, `frame: false`, `alwaysOnTop: true` as needed).
2. Cross process boundaries use `@moeru/eventa` invoke contracts (`apps/stage-tamagotchi/src/shared/eventa.ts`) or BroadcastChannel — never raw `ipcRenderer` string events in new code.
3. Guard every main-process window handle with `!win.isDestroyed()`.

### 4.4 Styling
- UnoCSS arrays (`:class="['px-2 py-1', 'flex items-center']"`), `@proj-airi/ui` primitives + Iconify icons over bespoke SVGs.
- Glassmorphic pill styling and `backgroundTint` live in `ControlStrip.vue`; dark tokens via `dark:*`. Popover chrome lives in `StripPopover.vue` (gap / header padding props rather than interpolated classes, so UnoCSS can see the tokens).
- **Strip + catalog icons stay linear (`*-linear`).** Do not introduce `*-bold-duotone` variants for new strip/catalog buttons — the strip was converted to linear (Oct 2026) and the keyed merge resyncs icons from defaults/catalog, so a duotone icon ships to every existing user.

## 5. Known Pitfalls & Failure Modes

- **`BUTTONS_CATALOG_VERSION` bump = user wipe.** Only bump for genuine schema-breakage (see the NOTICE in `control-strip.ts`). Desktop whitelist is `v4|v5`, mobile is `v4-mobile|v5-mobile` — keep these in sync when shipping button changes.
- **Strip `buttons` must stay on plain `useLocalStorage`**; the ManualReset wrapper silently drops array replacements in multi-window Electron.
- **`controls-island/fade-on-hover-enabled` is an intentional shared localStorage key** between `packages/stage-ui` and `apps/stage-tamagotchi` stores — don't "fix" the duplication.
- **`control-strip:popover-changed` must stay synchronous and shell-owned.** `applyBoundsUpdate` in the desktop stage page resizes the window to 324×500 / 500×500 off it. Never fire it from a lazily-mounted child, never make it async, never move `activePopover` to Pinia.
- **Global click-through override trap:** persistent flags (`stageViewControlsEnabled`, open popovers/dialogs) evaluate early in `applyTransparencyState()`; uncapped they force `setIgnoreMouseEvents([false, { forward: true }])` across all modes. In notch mode `isNotchMode` MUST scope these so desktop clicks still pass through the transparent 34px window region.
- **DOM-rect staleness across CSS transforms:** `getBoundingClientRect()` only refreshes on mouse move / class change; a stationary cursor during the 300 ms collapse transition keeps `isOutside` stale. Notch hit-testing therefore uses geometric bounds from `useElectronRelativeMouse`. Do not reintroduce rect-based checks for animated notches.
- **Pointer-mode side effects:** `viewport-cycle-modes` also *mutates* `settingsStore.stageViewControlsEnabled` and `useModelStore().interactionMode` (`use-control-strip-action.ts`) — those flags feed `applyTransparencyState`, so a new mode or reorder can silently change click-through behavior.
- **Popover-local state resets on close by design** (macaron tab, motions filter, character search/page, `cardSyncFilter`). `avatarApplyMode` is the exception, persisted under `settings/control-strip/avatar-apply-mode`.
- **Missing mobile listeners:** web/pocket ignore `control-strip:open-customizer`. If you add a strip-driven settings route, wire a listener in *both* web and pocket `index.vue` (or route through the settings page) — and update the twins together.
- **`docs/project-mobile-revamp.md` names components that were never built** (`MobileControlStrip.vue`, `MobileControlCustomizerDialog.vue`) — trust code over that doc.
- **Window lifetime:** calling BrowserWindow methods on destroyed instances crashes Electron — check `isDestroyed()`.
- **Desktop window always visible, renderer optionally hidden:** the main window shows even with stage hidden so the pill stays reachable; `stageEnabled` controls only avatar/WhisperDock rendering (RFC "Dual Visibility Architecture"). Don't gate window creation on it.

## 6. Verification

- Shared strip/store changes: `pnpm -F @proj-airi/stage-ui typecheck`
- Strip behaviour: `pnpm -F @proj-airi/stage-ui test run src/components/scenarios/layout src/composables/use-control-strip` — 88 tests across nine suites (18 contract, 19 dispatcher, 18 composable, 34 presentation), with 2 deliberate self-retired skips. There is still no browser-level test for placement/docking.
- Desktop window/page changes: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (`typecheck:node` then `typecheck:web`)
- stage-pages editor changes: `pnpm -F @proj-airi/stage-pages typecheck`
- Web/pocket mount or layout changes: build/run the app (`pnpm -F @proj-airi/stage-web dev`, `pnpm -F @proj-airi/stage-pocket dev`).
- Manual: desktop — drag, dock to each edge, collapse/notch hover, verify OS clicks pass through the notch, open a popover and confirm the window grows/shrinks cleanly; mobile — portrait vs landscape, left vs right edge, opposite-edge chatbox placement, `/settings/stage` add/remove.

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

- [references/control-strip-decomposition.md](references/control-strip-decomposition.md) — as-built shell/popover/composable contracts, guards, lazy-loading decision, traps.
- **Key Documents**: [[project-control-strip-rfc]], [[catalog-control-strip]], [[project-mobile-revamp]], [[design-stage-ui-context-bridge-control-island]], [[project-navigation-routing-overhaul]], [[proposal-studio-sidetab]], [[proposal-novel-stage-concepts]], [[rosetta-stone]]
