# AIRI HMR Resilience Architecture & State Lifecycle Initiative

> **Status**: Active Architecture Initiative
> **Canonical Target**: Establishing HMR accept boundaries, side-effect teardown ledgers, and `import.meta.hot.data` singleton persistence across Pinia stores and service pipelines in development environments.

---

## 1. Executive Summary & Causal Framing

During active development in Vite dev mode, editing core stores or service files (e.g. [`session-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts), [`chat.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts), [`speech-runtime.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts)) impacts the dev experience:
- In-flight LLM text streams get reset and WebSocket connections experience reconnect churn.
- Multi-window Electron setups can experience cross-window HMR desyncs if one window (e.g. [`ControlStripHost.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue)) misses the Vite WebSocket `full-reload` broadcast while another window reloads cleanly.

### Forward-Looking Causal Framing
Currently, **Pinia store HMR is 0% wired in AIRI** (zero calls to `acceptHMRUpdate`). When a developer saves a `.ts` store file today, Vite finds no accept boundary and triggers a **full-page window reload**.

This initiative is a **forward-looking architectural foundation**:
1. **Phase 0** introduces `import.meta.hot.accept(acceptHMRUpdate(...))` boundaries to hot-path stores, shifting the dev environment from disruptive full-page reloads to smooth **in-place soft HMR patching**.
2. **Phases 1–3** implement the 5 Mitigation Strategies to ensure soft HMR updates operate cleanly without triggering stale closure traps, orphaned event buses, or duplicate background watchers.

---

## 2. Current Codebase Baseline & Pinia HMR Audit

An empirical audit of `packages/stage-ui/src/stores/` and `node_modules/pinia` reveals the exact technical baseline:

| Feature / Pattern | Current Reality | Verification Command / Target |
| :--- | :--- | :--- |
| **`import.meta.hot` Wiring** | ❌ **0% Wired in Stores** — No store currently uses Vite's hot data container (`import.meta.hot.data`) or disposal hooks (`import.meta.hot.dispose`). (Only 3D/Live2D model caches use `hot.data`, e.g. [`vrm-instance-cache.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts)). | `grep -r "import.meta.hot" packages/stage-ui/src/stores` → **0 matches** |
| **Pinia `acceptHMRUpdate`** | ❌ **0% Wired** — Pinia's HMR helper is not called in any store definition file. | `grep -r "acceptHMRUpdate" packages/stage-ui/src/stores` → **0 matches** |
| **Chat Event Bus (`createChatHooks`)** | ⚠️ **Un-persisted Module Singleton** — Hoisted to module scope in `chat.ts:96`, but lost whenever Vite re-evaluates `chat.ts` ESM module. Holds 11 closure arrays ([`hooks.ts:6-16`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts#L6-L16)). | [`packages/stage-ui/src/stores/chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) |
| **Speech Runtime Host Registry** | ⚠️ **Ephemeral In-Memory State** — Stores single nullable `hostPipeline = null` inside setup closure ([`pipeline-runtime.ts:36`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/pipeline-runtime.ts#L36)). Resets to `null` on HMR; falls back to remote intent bus. | [`packages/stage-ui/src/stores/speech-runtime.ts:6`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts#L6) |
| **Setup-Scope Side Effects** | ⚠️ **Un-disposed Effect Scopes** — Stores call composables (`useBroadcastChannel`, `useIntervalFn`, `useElectronEventaInvoke`) directly in setup scope. | [`chat.ts:125`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L125), [`proactivity.ts:79-80`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L79-L80) |

### Empirical Breakdown of Pinia 3.0.4 HMR Engine (`node_modules/pinia/dist/pinia.mjs`)
Inspection of Pinia 3.0.4 source code ([`node_modules/pinia/dist/pinia.mjs:1108`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs#L1108)) reveals how Pinia handles soft store HMR:
1. `acceptHMRUpdate(useStore, import.meta.hot)` captures `pinia._s.get(id)` on existing store instances.
2. When HMR triggers, Pinia creates a temporary setup store (`__hot:${id}`) and invokes `store._hotUpdate(newStore)` ([`pinia.mjs:1557`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs#L1557)).
3. `_hotUpdate` **copies existing reactive state values into the new store** (`newStore.$state[stateKey] = oldStateSource`), preserving existing `ref` instances in place, while replacing actions and getters on the **same store instance object**.
4. **Critical Caveat**: Pinia's `_hotUpdate` **does NOT stop or dispose the old setup function's Vue effect scope**. Setup-scope watchers, intervals, and event listeners remain alive unless explicitly torn down via a side-effect ledger.

---

## 3. Root-Cause Technical Audit: The 5 Failure Modes

Below is an empirical analysis of the failure modes that trigger when store HMR is enabled without proper lifecycle teardown.

### Failure Mode 1: Imperative Callback Registration & Defunct Event Buses
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) — `const hooks = createChatHooks()`
  * [`packages/stage-ui/src/stores/chat/hooks.ts:6-16`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts#L6-L16) — 11 internal callback arrays (`onTokenLiteralHooks`, etc.)
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:1184-1209`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L1184-L1209) — Callback registration at top-level `<script setup>` scope
* **Mechanism**:
  Components register callback functions on event buses during setup execution (e.g. `chatStore.onToken((token) => speak(token))`). When `chat.ts` is re-evaluated by Vite, a new event bus instance is created with an empty listener array (`listeners = []`). Because long-lived renderers never unmount during store HMR, they remain subscribed to the **orphaned event bus instance**. Subsequent LLM tokens are emitted to the new bus, which has 0 listeners.

### Failure Mode 2: Destructured Actions & Getter Snapshots
* **Source Locations**:
  * Any component or store destructuring action functions directly from setup scope (e.g. [`ControlStripHost.vue:80`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L80) destructuring `onTokenLiteral`).
* **Mechanism**:
  Under Pinia 3, capturing store object instances (`const chatStore = useChatOrchestratorStore()`) is safe because identity is preserved. **The genuine hazard is destructuring action or getter functions** (`const { action } = store`). Destructuring extracts a static function snapshot closing over the old setup scope. When actions are updated on the store proxy, the local destructured snapshot remains bound to the old scope.

### Failure Mode 3: Module-Scope Singletons vs. Vite ESM Reloading
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:90-96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L90-L96) — Hoisted `hooks` singleton
* **Mechanism**:
  Hoisting variables outside `defineStore(...)` prevents Pinia setup re-instantiation from recreating them. However, **editing `chat.ts` causes Vite to re-evaluate `chat.ts` from line 1**. A new module-scope `const hooks` is constructed in memory. Submodules or components that imported `hooks` before the HMR reload remain bound to the previous ESM module evaluation's `hooks` instance unless stashed in `import.meta.hot.data`.

### Failure Mode 4: Ephemeral In-Memory Registries & Nondeterministic Remote Fallbacks
* **Source Locations**:
  * [`packages/stage-ui/src/stores/speech-runtime.ts:5-7`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts#L5-L7) — `const runtime = createSpeechPipelineRuntime()`
  * [`packages/stage-ui/src/services/speech/pipeline-runtime.ts:36`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/pipeline-runtime.ts#L36) — `let hostPipeline = null`
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:982`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L982) — `void speechRuntimeStore.registerHost(speechPipeline)`
* **Mechanism**:
  `speech-runtime.ts` maintains an in-memory variable `hostPipeline = null`. When `speech-runtime.ts` undergoes HMR, `hostPipeline` resets to `null`. When speech intent requests arrive (`speechRuntimeStore.openIntent()`), `pipeline-runtime.ts` falls back to emitting over the eventa IPC channel (`createRemoteIntent`). The newly re-evaluated runtime has no host bound, so tokens emit to the bus; zombie listeners on the old runtime may still deliver to the old pipeline, producing **nondeterministic behavior depending on remount timing**.

### Failure Mode 5: Un-Disposed Background Side Effects & BroadcastChannel Multiplication
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:125`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L125) — `useBroadcastChannel('airi-chat-input-bridge')` in setup scope
  * [`packages/stage-ui/src/stores/proactivity.ts:79-80`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L79-L80) — `useIntervalFn` & `useElectronEventaInvoke`
* **Mechanism**:
  Pinia's `_hotUpdate` does **not** stop the old setup's Vue effect scope. Each accepted HMR re-evaluates setup, instantiating **duplicate `BroadcastChannel` instances, intervals, and IPC listeners**. Per W3C spec, duplicate same-name `BroadcastChannel` objects in the same context deliver messages to each other, resulting in **duplicate input submissions and double heartbeat turn executions**.

---

## 4. Architectural Mitigation Strategies

### Strategy A: HMR-Resilient Module Singletons (`import.meta.hot.data`)
> **Status**: `[Status: Proposed]`

#### Current Reality
Singletons like `const hooks = createChatHooks()` in [`chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) are instantiated directly at module evaluation time. When Vite re-evaluates `chat.ts`, a brand new `hooks` object is created.

#### Target Implementation & Prior Art Pattern
Follow the codebase's existing established pattern from [`packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts:22-27`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts#L22-L27):

```typescript
interface ChatHooksHotData {
  version: number
  chatHooks?: ReturnType<typeof createChatHooks>
}

const CHAT_HOOKS_VERSION = 1
const hotData = import.meta.hot?.data as ChatHooksHotData | undefined

const hooks = (hotData?.version === CHAT_HOOKS_VERSION ? hotData.chatHooks : undefined)
  ?? createChatHooks()

if (import.meta.hot) {
  import.meta.hot.data.version = CHAT_HOOKS_VERSION
  import.meta.hot.data.chatHooks = hooks
}
```

> [!TIP]
> **Neutralizing the Vue 3 Component Destructuring Trap**:
> If a component destructured a store function at setup execution (`const { onTokenLiteral } = store`), that local variable retains a static snapshot of the function reference created when the component mounted. By preserving the underlying `hooks` instance via `import.meta.hot.data`, the function reference returned by `createChatHooks()` remains **100% identical in memory across HMR reloads**. Even destructured function variables continue pushing to the exact same array that the newly reloaded store reads from!

#### Strategy Tracking Log
- **2026-08-13**: Strategy defined, audited against `vrm-instance-cache.ts` prior art, and updated with version-guarding. Target files: `chat.ts`, `speech-runtime.ts`.

---

### Strategy B: Action Destructuring Audit & Direct Property Access
> **Status**: `[Status: Proposed]`

#### Current Reality
Under Pinia 3 in-place patching, capturing store instances (`const chatStore = useChatOrchestratorStore()`) at setup scope is safe. However, destructuring store methods (`const { performSend } = chatStore`) creates static function snapshots.

#### Target Implementation
Disallow destructuring actions or getters from stores at setup scope; invoke methods directly via property access:

```typescript
// ❌ AVOID: Destructured function snapshot loses connection to patched store actions
const { performSend } = useChatOrchestratorStore()
function onUserAction() { performSend(...) }

// ✅ RECOMMENDED: Property access dynamically resolves the active patched store action
const chatStore = useChatOrchestratorStore()
function onUserAction() { chatStore.performSend(...) }
```

#### Strategy Tracking Log
- **2026-08-13**: Strategy rescoped to action destructuring audit following Pinia 3 `_hotUpdate` verification. Audit targets: `ControlStripHost.vue`, `proactivity.ts`.

---

### Strategy C: Declarative Reactive Streams over Callbacks & Pinia `acceptHMRUpdate`
> **Status**: `[Status: Proposed]`

#### Current Reality
Renderers register callbacks via imperative methods like `chatStore.onToken(...)`. Furthermore, Pinia's `acceptHMRUpdate` helper is currently 0% wired across AIRI stores.

#### Target Implementation
Prefer Pinia reactive state (`storeToRefs(chatStreamStore).streamingMessage`) over imperative registration arrays. Wire `acceptHMRUpdate` across all hot-path stores:

```typescript
// Wire Pinia HMR helper at the bottom of hot-path store files:
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatOrchestratorStore, import.meta.hot))
}
```
* **Guarantee**: Pinia's `_hotUpdate` copies existing state values into the new store (`newStore.$state[stateKey] = oldStateSource`), preserving existing `ref` instances in place, while replacing actions/getters on the existing store instance pointer. Vue `watch()` and `watchEffect()` blocks in components automatically track and update across HMR state patches without needing re-registration.

#### Strategy Tracking Log
- **2026-08-13**: Strategy defined and verified against `node_modules/pinia/dist/pinia.mjs:1557`. Target allowlist: `chat.ts`, `speech-runtime.ts`, `proactivity.ts`, `live-session.ts`, `hearing.ts`, `character/index.ts`.

---

### Strategy D: Decoupled Primitive Event Transport & BroadcastChannel Deduplication
> **Status**: `[Status: Proposed]`

#### Current Reality
Cross-boundary events (e.g. streaming tokens from orchestrator to TTS host) rely on JS object references and string-keyed `BroadcastChannel` instances.

#### Target Implementation
For cross-window or cross-boundary communication, rely on primitive string channels over `@moeru/eventa` or `BroadcastChannel`. To prevent duplicate delivery when HMR instantiates new channels, payload objects must carry monotonic sequence IDs (`originId`, `sequence`) for consumer-side deduplication, and old channels must be closed in `import.meta.hot.dispose()`.

#### Strategy Tracking Log
- **2026-08-13**: Strategy updated with BroadcastChannel duplication guards. Target files: `ControlStripHost.vue`, `RendererStage.vue`, `bus.ts`.

---

### Strategy E: Side-Effect Teardown Ledger via `import.meta.hot.dispose()`
> **Status**: `[Status: Proposed]`

#### Current Reality
Stores initializing setup-scope composables (`useBroadcastChannel`, `useIntervalFn`, `useElectronEventaInvoke`) have zero `import.meta.hot.dispose()` teardown handlers.

#### Target Implementation & Side-Effect Ledger Pattern
Setup stores that initialize long-lived side effects must register teardown callbacks into a `hot.data`-preserved ledger array:

```typescript
// Pattern for Side-Effect Teardown Ledger in setup stores:
const hotData = import.meta.hot?.data as { disposers?: Array<() => void> } | undefined
const disposers = hotData?.disposers ?? []

if (import.meta.hot) {
  import.meta.hot.data.disposers = disposers
  import.meta.hot.dispose(() => {
    // Drain and execute all setup-scope teardowns before re-evaluation
    while (disposers.length > 0) {
      const dispose = disposers.pop()
      try { dispose?.() }
      catch {}
    }
  })
}
```

> [!CAUTION]
> **Never call `store.$dispose()` inside `import.meta.hot.dispose()`**:
> Calling `store.$dispose()` deletes the store ID from `pinia._s`. This causes `acceptHMRUpdate`'s `pinia._s.has(id)` check to fail, skipping the hot update and leaving components with orphaned store objects. Teardown ledgers must target specific setup side-effects (intervals, channels, IPC listeners) only.

#### Strategy Tracking Log
- **2026-08-13**: Strategy refined with Side-Effect Ledger pattern and `$dispose()` hazard warnings. Target files: `chat.ts`, `proactivity.ts`, `live-session.ts`.

---

## 5. Implementation Roadmap

| Phase | Target Area | Description | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | HMR Accept Boundaries | Wire `acceptHMRUpdate` across hot-path stores (`chat.ts`, `speech-runtime.ts`, `proactivity.ts`, `live-session.ts`, `hearing.ts`, `character/index.ts`) to enable soft HMR patching. | `[Status: Proposed]` |
| **Phase 1** | Core Singletons | Refactor `chat.ts` hooks and `speech-runtime.ts` host registry to use version-guarded `import.meta.hot.data` singletons. | `[Status: Proposed]` |
| **Phase 2** | Side-Effect Teardown Ledger | Implement Side-Effect Teardown Ledgers and `import.meta.hot.dispose()` handlers for stores with `useBroadcastChannel`, `useIntervalFn`, and `useElectronEventaInvoke`. | `[Status: Proposed]` |
| **Phase 3** | Destructuring Audit & In-Flight Guards | Conduct targeted action destructuring audit in renderers (`ControlStripHost.vue`) and add generation-guard checks for in-flight LLM streaming loops. | `[Status: Proposed]` |

---

## 6. Verification Plan

### Automated Verification & Invariants
* Run typecheck on affected workspaces after each phase:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F stage-tamagotchi typecheck
  ```
* Dev-mode invariant assertion:
  ```typescript
  if (import.meta.hot) {
    console.assert(import.meta.hot.data.chatHooks === hooks, '[HMR Invariant] chatHooks singleton preserved')
  }
  ```

### Manual Dev-Mode HMR Verification
1. Launch `stage-tamagotchi` in dev mode (`pnpm dev`).
2. Trigger an LLM chat turn to verify initial TTS speech playback.
3. Edit `session-store.ts` or `chat.ts` and save while the app is running.
4. Trigger a second LLM chat turn without restarting the app or refreshing the window.
5. **Pass Criteria**: Audio streams seamlessly, TTS pipeline receives tokens, and proactivity heartbeats operate normally without duplicate executions or silent audio drops.
