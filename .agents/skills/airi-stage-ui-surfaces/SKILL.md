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

## 3. Core SOPs & Guidelines

### 1. Creating or Modifying a Window Overlay
1. Register window bounds and flags in `apps/stage-tamagotchi/src/main/windows/<window-name>/`.
2. Set transparent/frameless flags (`transparent: true`, `frame: false`, `alwaysOnTop: true`).
3. Pass position updates across process boundaries via `@moeru/eventa` or `BroadcastChannel`.

### 2. Styling Stage UI Components
- Use UnoCSS classes with readable array syntax (`:class="['px-2 py-1', 'flex items-center']"`).
- Prefer primitives from `@proj-airi/ui` and Iconify icons over custom SVGs.

## 4. Known Pitfalls & Failure Modes

- **Click-Through Translucency Traps**: On Windows and macOS, transparent areas must set `setIgnoreMouseEvents(true, { forward: true })` so clicks pass through to background desktop windows, while interactive buttons explicitly disable click-through.
- **Window Lifetime Destruction**: Calling BrowserWindow methods on destroyed instances crashes Electron. Check `!win.isDestroyed()` before invoking window methods.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F stage-tamagotchi typecheck`
- **Manual Verification**: Run `pnpm run dev`, open the floating stage, drag the window, and verify click-through and always-on-top behavior.
