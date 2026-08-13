# AIRI HMR Resilience Architecture & State Lifecycle Initiative

> **Status**: Active Architecture Initiative
> **Canonical Target**: Eliminating stale closures, dead event hooks, and broken IPC/audio pipelines during Vite Hot Module Replacement (HMR) in development environments.

---

## 1. Executive Summary & Problem Context

During active development in Vite dev mode, editing core stores or service files (e.g. [`session-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts), [`chat.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts), [`speech-runtime.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts)) consistently breaks the running desktop app:
- LLM text streaming continues in the UI, but TTS audio output silently drops.
- Proactivity heartbeats intermittently disconnect or trigger duplicate turns.
- Long-lived floating windows (e.g., [`ControlStripHost.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue)) stop responding to store events.
- Developers are forced to restart the Electron application or refresh the window repeatedly.

### The Core Dilemma
This behavior is **not a Vite bug**—it is a fundamental architectural conflict between standard JavaScript object identity, Pinia setup store re-execution, and long-lived Vue component lifecycles.

When a file is modified, Vite invalidates the ESM module and re-evaluates the script from line 1. Pinia subsequently replaces the store instance in its registry (`pinia._s.set(id, newStore)`). However, long-lived UI renderers mounted when the app launched retain **stale JavaScript object references** to the old module's variables, defunct event buses, and wiped callback arrays.

This initiative documents the **5 Root-Cause Failure Modes** and defines the **5 Core Architectural Remedies** to eliminate dead references permanently.

---

## 2. Root-Cause Technical Audit: The 5 Failure Modes

Below is an empirical analysis of how HMR breaks state wiring across AIRI, complete with exact source locations.

### Failure Mode 1: Imperative Callback Registration & Defunct Event Buses
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) — `const hooks = createChatHooks()`
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:982`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L982) — Host registration during `onMounted`
* **Mechanism**:
  Components register callback functions on event buses during `onMounted` (e.g. `chatStore.onToken((token) => speak(token))`). When `chat.ts` is re-evaluated by Vite, a new event bus instance is created with an empty listener array (`listeners = []`). Because long-lived renderers never unmount or re-mount during HMR, they remain subscribed to the **orphaned, defunct event bus instance**. Subsequent LLM tokens are emitted to the new bus, which has 0 listeners.

### Failure Mode 2: Captured Store References at Setup Scope
* **Source Locations**:
  * [`packages/stage-ui/src/stores/proactivity.ts:44-46`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L44-L46) — `const chatOrchestrator = useChatOrchestratorStore()`
  * [`packages/stage-ui/src/stores/modules/live-session.ts:146-148`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/live-session.ts#L146-L148) — `const chatSession = useChatSessionStore()`
  * [`packages/stage-ui/src/stores/character/index.ts:44`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/character/index.ts#L44) — `const speechRuntimeStore = useSpeechRuntimeStore()`
* **Mechanism**:
  Inside Pinia Setup stores, sibling store hooks (e.g., `const chatStore = useChatOrchestratorStore()`) are invoked in the top-level body of the setup function. The returned JS object reference is captured inside closure variables. When `chat.ts` reloads, Pinia replaces `chatStore` in `pinia._s`, but `proactivityStore` continues calling methods on the **old, orphaned `chatStore` object pointer** captured in its setup closure.

### Failure Mode 3: Module-Scope Singletons vs. Vite ESM Module Reloading
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:90-96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L90-L96) — Hoisted `hooks` singleton
* **Mechanism**:
  Hoisting variables outside `defineStore(...)` prevents Pinia setup re-instantiation from recreating them. However, **editing `chat.ts` causes Vite to re-evaluate `chat.ts` from line 1**. A new module-scope `const hooks` is constructed in memory. Submodules or components that imported `hooks` before the HMR reload remain bound to the previous ESM module evaluation's `hooks` instance.

### Failure Mode 4: Ephemeral In-Memory Registries in Service Stores
* **Source Locations**:
  * [`packages/stage-ui/src/stores/speech-runtime.ts:5-7`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts#L5-L7) — `const runtime = createSpeechPipelineRuntime()`
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:982`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L982) — `void speechRuntimeStore.registerHost(speechPipeline)`
* **Mechanism**:
  `speech-runtime.ts` maintains an in-memory array `hosts = []`. When `speech-runtime.ts` undergoes HMR, `hosts` resets to `[]`. Because `ControlStripHost.vue` is already mounted, its `onMounted` hook will not execute again. When speech intent requests arrive (`speechRuntimeStore.openIntent()`), the new runtime finds 0 registered hosts, silently failing TTS audio playback.

### Failure Mode 5: Un-disposed Background Side Effects & Listener Leaks
* **Source Locations**:
  * Store setup functions containing `watch()`, `useIntervalFn()`, or `@moeru/eventa` listeners without HMR teardown.
* **Mechanism**:
  When Pinia setup re-runs on HMR, old watchers, intervals, and IPC listeners remain alive in background event loops while a second set is instantiated. This results in duplicate heartbeat triggers, memory leaks, and race conditions between old and new closures.

---

## 3. Architectural Mitigation Strategies & Remediation Guidelines

To make AIRI completely resilient to HMR state corruption without introducing runtime overhead in production, all store and service development must adhere to the following 5 architectural strategies:

### Strategy A: HMR-Resilient Module Singletons (`import.meta.hot.data`)
When a module-level singleton (like an event bus, hook registry, or host list) must survive ESM re-evaluation in dev mode, store it inside Vite's `import.meta.hot.data` container.

```typescript
// Pattern for HMR-resilient singletons in chat.ts or dedicated event hubs:
const hooks = (import.meta.hot?.data.hooks as ReturnType<typeof createChatHooks>)
  ??= createChatHooks()

if (import.meta.hot) {
  import.meta.hot.data.hooks = hooks
}
```
* **Guarantee**: Even if `chat.ts` is re-evaluated 500 times in Vite dev mode, `import.meta.hot.data` preserves the exact same `hooks` object reference in memory. Long-lived renderers bound to `hooks` never drop connection.

### Strategy B: Dynamic Store Accessors / Late Resolution
Stores **must never** capture static references to sibling stores at setup initialization time.

```typescript
// ❌ INCORRECT: Static reference captured at setup scope (becomes stale after HMR)
export const useProactivityStore = defineStore('proactivity', () => {
  const chatStore = useChatOrchestratorStore()

  function triggerHeartbeat() {
    chatStore.performSend(...)
  }
})

// ✅ CORRECT: Late resolution ensures the active Pinia store is always retrieved
export const useProactivityStore = defineStore('proactivity', () => {
  function triggerHeartbeat() {
    const chatStore = useChatOrchestratorStore()
    chatStore.performSend(...)
  }
})
```

### Strategy C: Declarative Reactive Streams over Imperative Callback Arrays
Prefer Pinia reactive state (`storeToRefs(chatStreamStore).streamingMessage`) over imperative registration arrays (`chatStore.onToken(...)`).
* **Guarantee**: Pinia's `acceptHMRUpdate(useStore, import.meta.hot)` patches state in-place on existing reactive proxies. Vue `watch()` and `watchEffect()` blocks in components automatically track and update across HMR state patches without needing re-registration.

### Strategy D: Decoupled Primitive Event Transport
For cross-window or cross-boundary communication (e.g. streaming tokens from orchestrator to TTS host), rely on primitive string channels over `@moeru/eventa` or `BroadcastChannel`. Event topic strings (e.g. `'airi-chat-stream'`) survive module re-evaluations unconditionally.

### Strategy E: Store Teardown via `import.meta.hot.dispose()`
Setup stores that initialize long-lived side effects (timers, IPC listeners, background workers) must implement an explicit `import.meta.hot.dispose` handler to clean up old instances before re-instantiation.

```typescript
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Teardown active timers, eventa listeners, or speech runtime hosts
    speechRuntimeStore.dispose()
  })
}
```

---

## 4. Implementation Roadmap

| Phase | Target Area | Description |
| :--- | :--- | :--- |
| **Phase 1** | Core Singletons | Refactor `chat.ts` hooks and `speech-runtime.ts` host registry to use `import.meta.hot.data` container pattern. |
| **Phase 2** | Sibling Store Audit | Audit setup stores (`proactivity.ts`, `live-session.ts`, `hearing.ts`, `character/index.ts`) and convert static store variables captured at setup time to dynamic store accessors. |
| **Phase 3** | Lifecycle Teardown | Implement `import.meta.hot.dispose()` teardown handlers for setup stores managing background timers, watchers, or IPC listeners. |

---

## 5. Verification Plan

### Automated Verification
* Run typecheck on affected workspaces after each phase:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F stage-tamagotchi typecheck
  ```

### Manual Dev-Mode HMR Verification
1. Launch `stage-tamagotchi` in dev mode (`pnpm dev`).
2. Trigger an LLM chat turn to verify initial TTS speech playback.
3. Edit `session-store.ts` or `chat.ts` and save while the app is running.
4. Trigger a second LLM chat turn without restarting the app or refreshing the window.
5. **Pass Criteria**: Audio streams seamlessly, TTS pipeline receives tokens, and proactivity heartbeats operate normally without duplicate executions or silent audio drops.
