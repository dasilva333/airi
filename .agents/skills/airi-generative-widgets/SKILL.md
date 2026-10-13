---
name: airi-generative-widgets
description: >-
  Build/debug Generative UI widgets, in-memory sandbox micro-apps, mount_widget
  lifecycle, widgets.repo persistence, srcdoc iframe isolation, sidecar state
  sync, breakout desktop windows, and floating web/pocket overlays. ComfyUI
  generation widgets use airi-artistry-comfyui-widgets.
---

# Generative UI Widgets & Sandbox Micro-Apps

Guidelines and exact code paths for AIRI's Generative UI widget subsystem. This system allows the agent (or user) to write, compile, persist, and mount standalone interactive micro-apps directly from the in-memory POSIX sandbox (`just-bash` + WebAssembly) into responsive UI surfaces across Desktop Electron, Web Browser, and Mobile Capacitor.

---

## 1. Subsystem Overview & Surface Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GENERATIVE WIDGET PIPELINE                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│   Agent Virtual Workstation (/workspace)                                               │
│   • Agent authors widget component: /workspace/news.ts                                 │
│   • Agent executes CLI: mount_widget news.ts [--surface panel|widget] [--title "News"] │
│                                                                                        │
│                                           │                                            │
│                                           ▼                                            │
│   SandboxManager (packages/stage-ui/src/libs/sandbox/manager.ts)                       │
│   • Compiles TypeScript via native tsc-rs (Electron) or Sucrase AST (<1ms, Web/Mobile) │
│   • Emits compiled bundle into /workspace/dist/ or memory buffer                       │
│   • Generates isolated HTML via buildWidgetIframeSrcdoc(...)                           │
│   • Persists metadata & code into widgetsRepo (local:widgets/registry)                 │
│   • Broadcasts 'widget-mount' event over BroadcastChannel('airi-sandbox')              │
│                                                                                        │
│                                           │                                            │
│                     ┌─────────────────────┴─────────────────────┐                      │
│                     ▼                                           ▼                      │
│   SURFACE: 'panel' (Default)                  SURFACE: 'widget' (Standalone)           │
│   • Chat Inspector Sidepanel                  • Desktop: Electron OS BrowserWindow     │
│     ChatWorkspaceWidgetsPanel.vue               apps/stage-tamagotchi/.../widgets.vue  │
│     Inside 'GENERATIVE WIDGETS' accordion     • Web & Pocket: In-Page Floating Div     │
│   • Breakout glyph pops out to standalone       FloatingWidgetsLayer.vue (draggable)   │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Paths & Entry Points

- **Sandbox Manager & CLI Handlers**: `packages/stage-ui/src/libs/sandbox/manager.ts` (`mount_widget`, `unmount_widget`, `list_widgets`, `widgets`).
- **Iframe Isolation & HTML Builder**: `packages/stage-ui/src/libs/sandbox/srcdoc.ts` (`buildWidgetIframeSrcdoc`).
- **Widget Persistence**: `packages/stage-ui/src/database/repos/widgets.repo.ts` (`widgetsRepo`, storage key `local:widgets/registry`).
- **Chat Inspector Panel**: `apps/stage-tamagotchi/src/renderer/components/chat/ChatWorkspaceWidgetsPanel.vue` (embedded in `pages/chat.vue`).
- **Standalone Widget Window (Desktop)**: `apps/stage-tamagotchi/src/renderer/pages/widgets.vue` and main window manager `apps/stage-tamagotchi/src/main/windows/widgets/index.ts`.
- **Generative Iframe Host Component**: `apps/stage-tamagotchi/src/renderer/widgets/generative/components/Generative.vue`.
- **Ambient Type Declarations**: Seeded at `/workspace/types/airi-widget.d.ts` inside the sandbox filesystem.
- **MCP Tool Bridge**: `packages/stage-ui/src/stores/mcp-tool-bridge.ts` (`tryGetMcpToolBridge`).

---

## 2. Widget Authoring Contract

Generative widgets run inside a sandboxed iframe. Every widget module must export a default `mount` function conforming to `AiriWidgetContext`:

```ts
import type { AiriWidgetContext, AiriWidgetSidecar } from './types/airi-widget'

export default function mount({ container, sidecar, state, setState, onStateChange, onUpdate, callMcpTool }: AiriWidgetContext) {
  // 1. Build DOM inside container
  const el = document.createElement('div')
  el.className = 'p-4 rounded-xl bg-neutral-900/80 text-white font-sans'
  el.innerHTML = `
    <h3 class="text-sm font-bold text-sky-400">System Telemetry</h3>
    <div id="status" class="mt-2 text-xs">Emotion: ${sidecar.cognition.emotion}</div>
    <button id="like-btn" class="mt-3 px-3 py-1 bg-pink-600 rounded-lg text-xs font-bold">🍓 Loves: <span id="count">${state.loves || 0}</span></button>
  `
  container.appendChild(el)

  // 2. Interactive state persistence (lazily writes to /workspace/<name>.json)
  el.querySelector('#like-btn')?.addEventListener('click', () => {
    setState((prev: any) => ({ ...prev, loves: (prev.loves || 0) + 1 }))
  })

  // 3. React to state changes (from UI clicks OR terminal edits via cat/jq)
  const unsubState = onStateChange((newState: any) => {
    const count = el.querySelector('#count')
    if (count)
      count.textContent = String(newState.loves || 0)
  })

  // 4. Subscribe to reactive sidecar updates
  const unsubSidecar = onUpdate((newSidecar: AiriWidgetSidecar) => {
    const status = el.querySelector('#status')
    if (status) {
      status.textContent = `Emotion: ${newSidecar.cognition.emotion} | Energy: ${newSidecar.cognition.energy}%`
    }
  })

  // 5. Return unmount cleanup
  return () => {
    unsubState()
    unsubSidecar()
    container.innerHTML = ''
  }
}
```

### Ambient Types (`/workspace/types/airi-widget.d.ts`)

- **`container: HTMLElement`**: The scoped root element provided by the iframe host.
- **`state: T`**: Preloaded persistent widget state (defaults to `{}`).
- **`setState(updater: Partial<T> | ((prev: T) => Partial<T> | T)): void`**: Persists state to database and lazily writes to sidecar file `/workspace/<name>.json`.
- **`onStateChange(callback: (newState: T) => void): () => void`**: Registers a listener that fires whenever state changes via UI or terminal (`jq`, `cat`).
- **`sidecar: AiriWidgetSidecar`**:
  - `session`: `{ id: string, activeCardName: string, messageCount: number }`
  - `cognition`: `{ emotion: string, energy: number }`
  - `telemetry`: `{ activeApp?: string, cpuLoad?: { avg1m?: number } | number[], idleSeconds?: number, isAfk?: boolean }`
- **`onUpdate(callback: (sidecar: AiriWidgetSidecar) => void): () => void`**: Registers a listener that fires whenever live session or telemetry state changes.
- **`callMcpTool(name: string, args?: Record<string, unknown>): Promise<any>`**: Executes external MCP tools directly from within the iframe.

---

## 3. The CLI Commands & Lifecycle

### `mount_widget <file.ts|file.js|file.html> [--surface panel|widget] [--title <title>]`

1. **Path Resolution**: Looks up the file relative to `/workspace` (or absolute path).
2. **Compilation**: If given a `.ts` file:
   - Evaluates host platform capabilities:
     - **Desktop Electron**: Dispatches to native `tsc-rs` (`ts-rust`) compiler binary over Eventa IPC.
     - **Web Browser & Mobile Capacitor**: Uses client-side **`sucrase`** AST transform (`<1ms`, ~200KB) to completely strip TypeScript types, interfaces, generics, type annotations, and non-null assertions (`!`), emitting valid modern JavaScript without requiring heavy WASM blobs or native binaries (upstream `pingdotgg/ts-rust` only publishes native OS binaries; its `crates/ts_wasm` build is experimental and unpublished).
   - Emits the resulting `.js` file directly into `/workspace/<name>.js`.
3. **Packaging**: Bundles the code with `buildWidgetIframeSrcdoc(...)`:
   - Injects UnoCSS runtime and Tailwind styling.
   - Wraps the code in an isolated IIFE that calls `export.default({ container, sidecar, onUpdate })`.
   - Injects the bidirectional MCP tool bridge listener (`window.addEventListener('message')`).
4. **Surface Routing**:
   - `--surface panel` (default): Mounts the widget inside the chat inspector accordion (`ChatWorkspaceWidgetsPanel.vue`).
   - `--surface widget` (or `--target window`): Launches a standalone frameless window on Electron, or an in-page floating draggable card on Web/Pocket.
5. **Agent Output Reminder**:
   - Always outputs an informative reminder to `stdout` indicating the exact mounted location:
     `Widget "<title>" successfully mounted in right side panel of the chatbox.` or
     `Widget "<title>" successfully mounted in new standalone widget window.`
6. **Persistence**: Calls `widgetsRepo.saveWidget(...)` under `local:widgets/registry`.

### `unmount_widget <file|id>`
Unmounts the active widget by file path or ID, persists `isMounted: false`, and closes the standalone window if open.

### `list_widgets` / `widgets`
Prints an ASCII status table of all persisted widgets in the registry:
```
ID          TITLE         SURFACE   STATUS     PATH
widget-1    Weather HUD   panel     [ACTIVE]   /workspace/weather.ts
widget-2    Anime News    widget    [ACTIVE]   /workspace/anime_news.ts
widget-3    Crypto Ticker panel     [OFFLINE]  /workspace/ticker.ts
```

---

## 4. Multi-Surface Presentation

### 4.1 Chat Inspector Sidepanel (`ChatWorkspaceWidgetsPanel.vue`)
- Positioned inside the right-hand Inspector Stack on desktop chat (`apps/stage-tamagotchi/src/renderer/pages/chat.vue`).
- Supports multi-widget tabs with auto-focus upon `mount_widget`.
- Displays dynamic `ResizeObserver` auto-height adaptation (160px–520px).
- **Breakout Button**: Includes an icon button (`i-solar:square-top-down-broken`) next to the library button that pops out the active panel widget into its own standalone desktop window.

### 4.2 Standalone Desktop Windows (`pages/widgets.vue`)
- Frameless, transparent Electron `BrowserWindow` managed by `WidgetsWindowManager` (`apps/stage-tamagotchi/src/main/windows/widgets/index.ts`).
- Coordinates persisted across window closes.
- Mounts `<Generative :id="widget.id" />` which streams live sidecar updates and handles MCP tool execution.

### 4.3 Web & Pocket Floating Overlays (`FloatingWidgetsLayer.vue`)
- On browser environments where Electron OS child windows do not exist:
  - Listens to `useSandbox().onMount` and `widgetsRepo.getMountedWidgets()`.
  - Spawns glassmorphic in-page floating `div`s with drag handles, collapse buttons, and close buttons.
  - In landscape: defaults to free-floating card (e.g. 380×340px) positioned opposite the chatbox.
  - In portrait: floating glass card with touch-safe dragging.

---

## 5. Persistence & Boot Rehydration

- **Storage Key**: `local:widgets/registry` in `storage` (`unstorage` IndexedDB layer).
- **Persisted Schema (`PersistedWidget`)**:
  ```ts
  interface PersistedWidget {
    id: string
    title: string
    path: string
    sourcePath?: string
    sourceCode?: string
    code: string
    surface?: 'panel' | 'widget'
    target?: 'sidepanel' | 'inline' | 'window'
    position?: { x: number, y: number }
    state?: any
    isMounted: boolean
    mountedAt: number
    updatedAt: number
  }
  ```
- **Auto-Rehydration Flow**:
  1. On application startup or page reload, `SandboxManager.init()` reads `widgetsRepo.getMountedWidgets()`.
  2. For every mounted widget, it re-writes `sourceCode` (or compiled `code`) and re-seeds persisted `state` into `/workspace/<name>.json` in the virtual RAM disk.
  3. Populates `mountedWidgetsList` with persisted `title`, `surface`, `state`, and drag `position: { x, y }`, broadcasting `widget-mount` to active UI surfaces.
  4. In `stage-web` and `stage-pocket`, `<FloatingWidgetsLayer />` mounts floating widgets at their exact saved coordinates. In chat, `selectedWidgetId` stays on the active panel tab across browser reloads.

---

## 6. MCP Tool Bridge Inside Widgets

Widgets can call external Model Context Protocol (MCP) tools from within their sandboxed iframe without needing host credentials:

1. **Inside Widget JavaScript**:
   ```ts
   window.parent.postMessage({
     type: 'mcp-call',
     id: 'call-1',
     name: 'open-websearch::search',
     args: { query: 'latest space discoveries', limit: 3 }
   }, '*')
   ```
2. **Iframe Host Handling (`Generative.vue`)**:
   - Intercepts `mcp-call` via `window.addEventListener('message')`.
   - Delegates to `tryGetMcpToolBridge().callTool({ name, arguments: args })`.
   - Posts `mcp-call-result` back to the widget iframe source window with structured JSON.

---

## 7. Known Pitfalls & Failure Modes

1. **Never use raw `innerHTML` into the main DOM**: Always use `buildWidgetIframeSrcdoc` with an `iframe`. Dynamic agent code must execute inside an iframe sandbox with restricted privileges (`allow-scripts allow-forms allow-same-origin allow-popups`).
2. **Chromium Dark Iframe Transparency**: Always ensure `allowtransparency="true"` and `class="bg-transparent"` on the iframe element; otherwise, Chromium paints a stark white background behind transparent glassmorphic widgets.
3. **Vue Reactive Proxy Corruption on IndexedDB Writes**: Always serialize widget objects using `JSON.parse(JSON.stringify(clean))` before calling `storage.setItemRaw`. Vue reactive proxies cause cloning errors when persisted.
4. **TypeScript Compiler Missing Files**: If `mount_widget` fails with a compilation error, verify `/workspace/tsconfig.json` exists; `SandboxManager` auto-seeds standard `tsconfig.json` and ambient definitions on initialization.
5. **Multi-Window Broadcast Synchronization**: The Control Strip window acts as the sandbox channel leader, while secondary windows (Chatbox, Widgets) act as followers. Always use `BroadcastChannel('airi-sandbox')` messages (`widget-mount`, `widget-unmount`) to keep window states in lockstep.

---

## 8. Verification & Testing

- **Run Sandbox Test Suite**:
  ```bash
  pnpm -F @proj-airi/stage-ui test packages/stage-ui/src/libs/sandbox/sandbox.test.ts
  ```
- **Manual Verification (Desktop)**:
  1. Open Chatbox (`npm run dev:desktop` or open Chat window).
  2. In Workstation Terminal, execute:
     ```bash
     echo "export default function mount({ container }) { container.innerHTML = '<h1>Hello Widget</h1>' }" > /workspace/hello.js
     mount_widget /workspace/hello.js --surface panel
     ```
  3. Verify widget appears in the `GENERATIVE WIDGETS` sidepanel accordion.
  4. Click the breakout icon to pop it out into a standalone window.
  5. Close and reopen the app; verify the widget rehydrates from `local:widgets/registry`.

---

## Related Skills & Authoritative References

- [docs/proposal-in-memory-sandboxes-and-edge-wasm.md](docs/proposal-in-memory-sandboxes-and-edge-wasm.md) — Master proposal and architectural specification.
- [docs/design-generative-widgets-export-and-scoping.md](docs/design-generative-widgets-export-and-scoping.md) — Export interface, global vs card scoping, and bundled starter presets.
- [docs/data-catalog.md](docs/data-catalog.md) — `local:widgets/registry` persistence schema.
- [[airi-artistry-comfyui-widgets]] — Contrast peer: image-generation stage widgets and ComfyUI bridge.
- [[airi-mcp-integration]] — External Model Context Protocol server configuration and tool execution.
- [[airi-stage-ui-surfaces]] — Desktop and mobile stage layouts, control strip, and window managers.
- [[airi-desktop-chatbox]] — Desktop chat workspace, inspector tabs, and transcript layout.
