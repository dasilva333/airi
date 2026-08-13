---
name: airi-stage-ui-surfaces
description: >-
  Use when building, styling, or debugging floating Electron overlay windows, ControlStripHost, RendererStage, WhisperDock, control islands, tray menu integration, or interactive stage layout containers.
---

# AIRI Stage UI Surfaces & Window Overlays

This skill provides comprehensive guidelines and exact code paths for constructing, styling, and positioning AIRI's floating Electron windows, translucent stage overlays, and interactive UI control islands.

## 1. Overview & Surface Map

AIRI Desktop features multiple floating overlay windows backed by Main Process Window Managers in `apps/stage-tamagotchi/src/main/windows/`:
- **Control Strip Host**: Main desktop toolbar window (`ControlStripHost.vue`).
- **Actor Stage**: Translucent floating stage window displaying the active 2D/3D avatar model (`RendererStage.vue`).
- **Chatbox & Interactive Area**: Floating/docked chat panel (`ChatArea.vue`, `InteractiveArea.vue`, `WhisperDock.vue`).
- **Control Islands**: Floating widget strips for resource monitoring, audio controls, and stage settings (`controls-island/`).

## 2. Key Code Paths

### Main Process Window Managers
- `apps/stage-tamagotchi/src/main/windows/` — Window managers (`main/`, `stage/`, `chat/`, `settings/`, `widgets/`, `caption/`).
- `apps/stage-tamagotchi/src/main/services/electron/window.ts` — Main process window creation and bounds management.

### Renderer Stage Components
- `packages/stage-ui/src/components/scenes/RendererStage.vue` — Primary stage component. Hosts stage models, background layers, and overlay widgets.
- `packages/stage-ui/src/components/scenes/ControlStripHost.vue` — Main control strip host toolbar.
- `packages/stage-layouts/src/components/Widgets/ChatArea.vue` — Floating chat panel host.
- `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` — Interactive chatbox surface.
- `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` — Docked micro-chat input widget.

### Pinia Stores
- `packages/stage-ui/src/stores/settings/controls-island.ts` — `useSettingsControlsIsland`. Manages control island visibility, dock positions, and pinned states.
- `packages/stage-ui/src/stores/settings/control-strip.ts` — `useSettingsControlStrip`. Manages strip buttons, orientation, stageMode, collapsed state, and `dockedEdge` (`left` | `right` | `top` | `bottom` | `null`).

## 3. Core SOPs & Guidelines

### 1. Control Strip Edge Docking & Notch Auto-Hide Behavior
- **Edge Docking (`dockedEdge`):** When snapped/docked to an edge (`left`, `right`, `top`, `bottom`) and collapsed (`collapsed: true`), `ControlStrip.vue` applies `autoHideTabClasses`.
- **CSS Notch Transformation:** Translates the container off-screen (`calc(100% - 14px)`), leaving a 14px rounded tab protruding from the display edge with a directional expansion icon (`i-solar:double-alt-arrow-*`).
- **Proximity Hover & Debounce:** Hovering over the tab (`onContainerMouseEnter`) expands the full strip with a `duration-300 ease-out` transition (`hoverExpanded = true`). Mouse exit (`onContainerMouseLeave`) triggers a 400ms debounce timer before re-collapsing into the notch tab.

- **Deterministic Geometric Hit-Testing:** During collapsed Notch Mode, DOM `getBoundingClientRect()` measurements become stale across 300ms CSS transforms if the cursor remains stationary. To prevent swallowing OS clicks on desktop elements beneath the empty 34px window area, hit-testing MUST compute coordinates geometrically from `useElectronRelativeMouse` (`x <= 14` for left dock, `x >= width - 14` for right dock, `y <= 14` for top, `y >= height - 14` for bottom) rather than relying on DOM element rect measuring.

### 2. Creating or Modifying a Window Overlay
1. Register window bounds and flags in `apps/stage-tamagotchi/src/main/windows/<window-name>/`.
2. Set transparent/frameless flags (`transparent: true`, `frame: false`, `alwaysOnTop: true`).
3. Pass position updates across process boundaries via `@moeru/eventa` or `BroadcastChannel`.

### 3. Styling Stage UI Components
- Use UnoCSS classes with readable array syntax (`:class="['px-2 py-1', 'flex items-center']"`).
- Prefer primitives from `@proj-airi/ui` and Iconify icons over custom SVGs.

## 4. Known Pitfalls & Failure Modes

- **Global Click-Through Override Trap**: Persistent stage settings like `stageViewControlsEnabled` (`settings/stage/view-controls-enabled` for model repositioning/drag mode), active popovers, or open dialogs evaluate early in `applyTransparencyState()`. If uncapped, these guard clauses return early and set `setIgnoreMouseEvents([false, { forward: true }])`, forcing full-window click capture globally across all modes. In collapsed Notch Mode, `isNotchMode` MUST scope these guard clauses (`if (!isNotchMode && ...)`) so persistent stage flags do not silently intercept desktop OS clicks over the 34px transparent window region.
- **DOM Rect Staleness across CSS Transforms**: `useElectronMouseInElement` reads `getBoundingClientRect()`, which only updates on mouse movement or class/style mutations at transition start. If the mouse is stationary during a 300ms collapse transform, `isOutside` remains stale (`false`), keeping `setIgnoreMouseEvents(false)` active over transparent window space. Always use mathematical spatial boundaries (`useElectronRelativeMouse`) for animated edge-docked notches.
- **Click-Through Translucency Traps**: On Windows and macOS, transparent areas must set `setIgnoreMouseEvents(true, { forward: true })` so clicks pass through to background desktop windows, while interactive buttons explicitly disable click-through.
- **Window Lifetime Destruction**: Calling BrowserWindow methods on destroyed instances crashes Electron. Check `!win.isDestroyed()` before invoking window methods.


## 5. Verification Workflows

- **Typecheck**: `pnpm -F stage-tamagotchi typecheck`
- **Manual Verification**: Run `pnpm run dev`, open the floating stage, drag the window, and verify click-through and always-on-top behavior.

### Authoritative Design & Architecture Documents

- [docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md](docs/content/en/docs/advanced/architecture/design-stage-ui-context-bridge-control-island.md) — Stage UI context bridge / control island architecture.
- [docs/catalog-control-strip.md](docs/catalog-control-strip.md) — Master catalog of control strip items.
- [docs/project-control-strip-rfc.md](docs/project-control-strip-rfc.md) — Control strip RFC.
- [docs/project-navigation-routing-overhaul.md](docs/project-navigation-routing-overhaul.md) — Navigation & routing overhaul project plan.
- [docs/proposal-studio-sidetab.md](docs/proposal-studio-sidetab.md) — Studio sidetab proposal.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa, §13 BroadcastChannel registry.
