---
name: airi-app-entry-wiring
description: >-
  Wire/debug application startup: Electron window creation, injeca dependency injection, renderer entry points, Vite routing, web bootstrap. Use for initialization order or missing windows; stage layout uses airi-stage-ui-surfaces.
---

# AIRI App Entry Wiring & Bootstrap

This skill provides comprehensive guidelines for understanding and modifying the application lifecycle, from the Electron main process bootstrap through window management, dependency injection (DI) via `injeca`, and Vite-powered renderer routing.

## 1. Overview & Surface Map

AIRI initializes in three distinct phases:
1. **Process Bootstrap & Hardware Flags** (`main/index.ts`): Early Chromium / Dawn command-line switch configuration before `app.whenReady()` (Vulkan, WebGPU, SharedArrayBuffer, Wayland portal flags).
2. **Composition Root & Dependency Injection** (`injeca` in `main/index.ts`): Typed DI container wiring core services (`serverChannel`, `mcpStdioManager`, window managers, `i18n`, `appConfig`).
3. **Window Lifecycle & Routing**: Main window (Control Strip `#/`) boots first; secondary windows (Chatbox `#/chat`, Actor Stage `#/actor`, Onboarding, Settings) mount dynamically with `@moeru/eventa` IPC and `BroadcastChannel` cross-window synchronization.

## 2. Key Code Paths

- `apps/stage-tamagotchi/src/main/index.ts` — Main process bootstrap, hardware/Chromium command-line switches, composition root (`injeca`), and app lifecycle.
- `apps/stage-tamagotchi/src/main/windows/` — Per-window manager factories (reusable window wrappers, bounds persistence, Eventa RPC handlers).
- `apps/stage-tamagotchi/src/shared/eventa.ts` — Strongly typed Eventa IPC contract schemas.
- `apps/stage-tamagotchi/src/renderer/App.vue` — Desktop renderer entry point (`isMainWindow` resolution, window title synchronization, onboarding gate watcher).
- `apps/stage-web/src/App.vue` — Web platform entry point.

## 3. Core SOPs & Guidelines
### 1. Main Process Bootstrap & Dependency Injection (DI)

AIRI uses `injeca` for its composition root to wire dependencies before application logic starts. This happens primarily in `apps/stage-tamagotchi/src/main/index.ts`.

### Adding a New Service
When adding a new core service:
1. Define the service creation function in `apps/stage-tamagotchi/src/main/services/airi/`.
2. Provide it via `injeca.provide` in `main/index.ts`.
3. If it depends on other services (e.g., `serverChannel`, `mainWindow`), declare them in the `dependsOn` block.
4. Call it inside `injeca.invoke` if it needs to run at startup without being requested by another dependency.

Example:
```typescript
const myNewService = injeca.provide('services:my-new-service', {
  dependsOn: { appConfig, serverChannel },
  build: async ({ dependsOn }) => setupMyNewService(dependsOn),
})
```

### 2. Window Managers

Every UI window is backed by a Main Process Window Manager located in `apps/stage-tamagotchi/src/main/windows/<name>/`.

### Core Windows
- **Main Window (Control Strip):** `main/` -> UI: `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`
- **Actor Stage (Floating Island):** `stage/` -> UI: `packages/stage-ui/src/components/scenes/RendererStage.vue`
- **Chatbox:** `chat/` -> UI: `apps/stage-tamagotchi/src/renderer/pages/chat.vue`
- **Settings:** `settings/`
- **Widgets:** `widgets/`
- **Caption:** `caption/`

### Window Manager Rules
- Always extend existing window manager patterns (e.g., `setupSettingsWindowReusableFunc`).
- Ensure window configuration (bounds, visibility) is fully resolved before calling `.show()`.
- Use the guarded `BrowserWindow.prototype` methods (already present in `index.ts`) to avoid calling methods on destroyed window objects.
- Do not assume a specific window is the "main window". The Control Strip is the true main window (`isMainWindow: true`).

### 3. Eventa IPC Contract

Communication between the Main and Renderer processes uses `@moeru/eventa` for strongly typed RPC.

- **Contract Location:** `apps/stage-tamagotchi/src/shared/eventa.ts`
- **Renderer Side:** Uses `invokeEventa` to call main process handlers.
- **Main Side:** Uses `defineInvokeHandler(context, eventName, handler)` in `index.ts` or window managers.

### Pitfalls with Eventa
- **Vue 3 Proxy Destruction:** When sending objects across IPC, DO NOT send Vue reactivity proxies. They will break binary serialization. Always use `toRaw()` to sanitize objects before crossing IPC boundaries.
- **Context Dispatch:** If you are dispatching an event from Main to Renderer, use the explicit context instead of bypassing the serializer:
  ```typescript
  // CORRECT
  const { context, dispose } = createContext(ipcMain, targetWin)
  context.emit(myEvent, payload)
  dispose()

  // INCORRECT (bypasses serializer)
  targetWin.webContents.send('eventa:event:myEvent', payload)
  ```

### 4. Renderer Routing via Vite

Renderer logic is located in `apps/stage-tamagotchi/src/renderer/`.
- **Vite Config:** `apps/stage-tamagotchi/electron.vite.config.ts`
- **App Entry:** `App.vue`
- **Routing:** Handled via standard Vue router with file-based definitions or manual routes in `router.ts`.

### 5. Web App Entry

The standalone web version (non-Electron) lives in `apps/stage-web/`.
- **Entry point:** `apps/stage-web/src/App.vue`
- **Vite Config:** `vite.config.ts`
It shares most UI components from `packages/stage-ui/` but lacks Main Process features (no IPC).

### 6. Chromium Command-Line Switches & Hardware Feature Enablement

Hardware switches are configured in `apps/stage-tamagotchi/src/main/index.ts` before `app.whenReady()`.

- **Single `enable-features` rule**: Always join multiple Chromium features into a single comma-delimited string (e.g. `app.commandLine.appendSwitch('enable-features', ['SharedArrayBuffer', 'Vulkan', ...].join(','))`). Calling `appendSwitch('enable-features', ...)` multiple times silently overwrites earlier features in Chromium.
- **Dawn NVIDIA Vulkan `shader-f16`**: On Linux, Dawn gates `shader-f16` for WGSL compute shaders behind `vulkan_enable_f16_on_nvidia`. Must append `app.commandLine.appendSwitch('enable-dawn-features', 'vulkan_enable_f16_on_nvidia')` so WebLLM `q4f16` models (e.g. Qwen 3.5) compile shaders without fatal syntax errors.

## 4. Known Pitfalls & Failure Modes

- **Chromium Switch Clobbering**: Calling `app.commandLine.appendSwitch('enable-features', ...)` sequentially with different arguments overwrites prior features instead of combining them. Always merge feature flags into a single comma-separated list.
- **Missing Dawn NVIDIA f16 on Linux**: Without `enable-dawn-features: vulkan_enable_f16_on_nvidia`, WebLLM crashes on Linux/NVIDIA during pipeline creation with `extension 'f16' is not allowed in the current environment`.
- **Vue 3 Proxy Destruction**: When sending objects across Eventa IPC, never send reactive proxies. Always pass through `toRaw()` to preserve binary/plain-object serialization.
- **IPC Handler Leaks / Re-registration**: `ipcMain.setMaxListeners(0)` is set temporarily, but event handlers should be cleaned up with window disposal to avoid memory leaks.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (verifies both Node and Web targets).
- **Build / Packaging**: `pnpm -F @proj-airi/stage-tamagotchi build` (runs full Vite and Electron build).
- **Local Dev**: Run `pnpm run dev` and confirm that all primary windows mount without IPC timeout or `Object has been destroyed` errors.

### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa/DI composition, §13 BroadcastChannel registry.
- [docs/design-stage-ui-context-bridge-control-island.md](docs/design-stage-ui-context-bridge-control-island.md) — Control Island / Stage UI context bridge architecture.
- [docs/project-navigation-routing-overhaul.md](docs/project-navigation-routing-overhaul.md) — Navigation & routing overhaul project plan.

## Related Skills & References

- **Key Documents**: [[rosetta-stone]], [[design-stage-ui-context-bridge-control-island]], [[project-navigation-routing-overhaul]]
