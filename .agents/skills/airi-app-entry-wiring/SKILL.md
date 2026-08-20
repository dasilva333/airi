---
name: airi-app-entry-wiring
description: "Use when working with initializing, configuring, or debugging application bootstrap, Electron window managers (Control Strip, Stage, Chat, Caption, Widgets, Settings), DI composition root (injeca), renderer routing via Vite, or web app entry."
---

# AIRI App Entry Wiring & Bootstrap

This skill provides comprehensive guidelines for understanding and modifying the application lifecycle, from the Electron main process bootstrap through window management, dependency injection (DI) via `injeca`, and Vite-powered renderer routing.

## 1. Overview & Surface Map

## 2. Key Code Paths

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

## 4. Known Pitfalls & Failure Modes

## 5. Verification Workflows
### 6. Verification & Validation

When touching bootstrap, DI, or IPC logic, you must ensure you haven't broken the types or the startup sequence.

- **Validation Command:** Run `pnpm -F stage-tamagotchi typecheck` (or `build`) to verify `injeca` and `eventa` types align.
- **Local Dev:** Always start the local dev server (`pnpm run dev`) and manually verify the affected window opens correctly without throwing `Object has been destroyed` or IPC timeout errors.

### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa/DI composition, §13 BroadcastChannel registry.
- [docs/design-stage-ui-context-bridge-control-island.md](docs/design-stage-ui-context-bridge-control-island.md) — Control Island / Stage UI context bridge architecture.
- [docs/project-navigation-routing-overhaul.md](docs/project-navigation-routing-overhaul.md) — Navigation & routing overhaul project plan.

## Related Skills & References

- **Key Documents**: [[rosetta-stone]], [[design-stage-ui-context-bridge-control-island]], [[project-navigation-routing-overhaul]]
