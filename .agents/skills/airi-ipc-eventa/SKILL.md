---
name: airi-ipc-eventa
description: "Use when working with defining, wiring, or debugging Electron typed IPC/RPC between main and renderer. Covers @moeru/eventa contracts, defineInvokeEventa, defineEventa, renderer invocations, main-process handlers, and cross-window BroadcastChannel relays."
---

# Overview & Surface Map
This skill defines IPC/RPC boundaries using `@moeru/eventa`. It covers the definition of typed contracts in `shared/eventa.ts` and their implementations in both main and renderer processes, including `BroadcastChannel` for multi-window communication.

Eventa provides a fully-typed, end-to-end interface to communicate between Electron's Main process, Renderer processes, and cross-window contexts safely.

# Key Code Paths
- **Contracts:** `apps/stage-tamagotchi/src/shared/eventa.ts`
- **Main process adapters & loops:** `packages/electron-eventa/src/`
- **Main process implementations:** `apps/stage-tamagotchi/src/main/services/**/*.ts` (e.g., `services/electron/window.ts`)
- **Renderer implementations:** Consumed in Vue components and composables in `apps/stage-tamagotchi/src/renderer/`.

# Core SOPs

## 1. Overview & Surface Map

## 2. Key Code Paths

## 3. Core SOPs & Guidelines
### 1. Contract Definition

All event contracts must be defined centrally in `shared/eventa.ts`.

- **RPC (Invoke) Events**: Expect a response or confirmation from the main process.
  ```typescript
  // Return type, Payload type
  export const electronShowToast = defineInvokeEventa<void, { message: string, duration?: number }>('eventa:invoke:electron:show-toast')
  ```
- **Broadcast Events**: Fire-and-forget events, broadcast to renderers or sent from main.
  ```typescript
  export const electronShowToastEvent = defineEventa<{ message: string }>('eventa:event:electron:show-toast')
  ```

### 2. Main Process Handlers

Implement handlers in the main process (typically within services that receive a scoped `context` or `window`).
Use `defineInvokeHandler` from `@moeru/eventa`.

```typescript
import { defineInvokeHandler } from '@moeru/eventa'

import { electronShowToast } from '../../../shared/eventa'

export function createToastService(params: { context: EventaContext, window: BrowserWindow }) {
  defineInvokeHandler(params.context, electronShowToast, (payload, options) => {
    // Validate window identity if needed:
    if (params.window.webContents.id !== options?.raw.ipcMainEvent.sender.id)
      return

    // Execute logic
    console.log(`Showing toast: ${payload.message}`)
  })
}
```

### 3. Renderer Invocations

To invoke RPC methods in the Vue renderer, you import the contract and invoke it (using the generated function or wrapper). Always check if the current environment supports Electron IPC.
- Use the contract directly as a function or via a defined adapter to send data to main.
- Ensure all parameters match the generic signatures defined in `shared/eventa.ts`.

### 4. Broadcast Channels

For high-frequency or renderer-to-renderer communication where routing through the main process would be a bottleneck, use standard `BroadcastChannel` APIs with typed wrappers where appropriate. Keep these synced with related Eventa broadcast definitions.

# Known Pitfalls
- **Eventa Context Serializer Limits:** Serialization uses structured cloning underneath. Complex objects, functions, Maps, Sets, and Vue Proxies will fail to serialize over IPC. Always strip or map complex states to plain objects before sending.
- **Type Mismatches:** If `shared/eventa.ts` isn't compiled or is out of sync with your handler implementations, you will experience runtime errors. Keep contracts strictly updated.
- **Destroyed Window Exceptions:** Always verify `!params.window.isDestroyed()` in your main handlers before acting on a `BrowserWindow` instance.
- **Window Sender Identity Check:** Always verify `params.window.webContents.id === options?.raw.ipcMainEvent.sender.id` in scoped window services to ensure the correct window receives the action.

# Verification Steps
- Run `pnpm -F stage-tamagotchi typecheck` after modifying `shared/eventa.ts` or main handlers.
- Test the IPC interaction in a full development build (`pnpm dev`) to ensure complete payload integrity across the Electron boundary.

## 4. Known Pitfalls & Failure Modes

## 5. Verification Workflows

### Authoritative Design & Architecture Documents

- [docs/rosetta-stone.md](docs/rosetta-stone.md) — Canonical concept-to-path index; §1 eventa IPC contracts, §13 BroadcastChannel registry.
- [docs/design-stage-ui-context-bridge-control-island.md](docs/design-stage-ui-context-bridge-control-island.md) — Control Island / Stage UI context bridge architecture.

## Related Skills & References

- **Key Documents**: [[rosetta-stone]], [[design-stage-ui-context-bridge-control-island]]
