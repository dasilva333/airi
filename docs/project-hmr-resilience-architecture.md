# AIRI HMR Resilience Architecture & State Lifecycle Initiative

> **Status**: Active Architecture Initiative
> **Canonical Target**: Establishing HMR accept boundaries, combined side-effect teardown ledgers, version-guarded `import.meta.hot.data` singletons, and HMR async epoch guards across Pinia stores and service pipelines in development environments.

---

## 1. Executive Summary & Causal Framing

During active development in Vite dev mode, editing core stores or service files (e.g. [`session-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts), [`chat.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts), [`speech-runtime.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts)) impacts the dev experience:
- In-flight LLM text streams get reset, pending promise queues hang, and WebSocket connections experience reconnect churn.
- Multi-window Electron setups can experience cross-window HMR desyncs if one window (e.g. [`ControlStripHost.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue)) misses the Vite WebSocket `full-reload` broadcast while another window reloads cleanly.

### Forward-Looking Causal Framing
Currently, **Pinia store HMR is 0% wired in AIRI** (zero calls to `acceptHMRUpdate`). When a developer saves a `.ts` store file today, Vite finds no accept boundary and triggers a **full-page window reload**.

This initiative is a **forward-looking architectural foundation**:
1. **Phase 0 (Prerequisite & Boundaries)**: Splits multi-store export modules (`hearing.ts`, `character/index.ts`) into single-store files, then introduces `import.meta.hot.accept(acceptHMRUpdate(...))` boundaries to hot-path stores, shifting the dev environment from disruptive full-page reloads to smooth **in-place soft HMR proxy patching**.
2. **Phases 1–3**: Implement the 5 Mitigation Strategies to ensure soft HMR updates operate cleanly without triggering stale closure traps, orphaned event buses, duplicate watchers/timers, or WebGPU/Worker concurrency conflicts.

---

## 2. Current Codebase Baseline & Pinia HMR Audit

An empirical audit of `packages/stage-ui/src/stores/` and `node_modules/pinia` reveals the exact technical baseline:

| Feature / Pattern | Current Reality | Verification Command / Target |
| :--- | :--- | :--- |
| **`import.meta.hot` Wiring** | ❌ **0% Wired in Stores** — No store currently uses Vite's hot data container (`import.meta.hot.data`) or disposal hooks (`import.meta.hot.dispose`). (Only 3D/Live2D model caches use `hot.data`, e.g. [`vrm-instance-cache.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts)). | `grep -r "import.meta.hot" packages/stage-ui/src/stores` → **0 matches** |
| **Pinia `acceptHMRUpdate`** | ❌ **0% Wired** — Pinia's HMR helper is not called in any store definition file. | `grep -r "acceptHMRUpdate" packages/stage-ui/src/stores` → **0 matches** |
| **Chat Event Bus (`createChatHooks`)** | ⚠️ **Un-persisted Module Singleton** — Hoisted to module scope in `chat.ts:96`, but lost whenever Vite re-evaluates `chat.ts` ESM module. Holds 11 closure arrays ([`hooks.ts:6-16`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts#L6-L16)). | [`packages/stage-ui/src/stores/chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) |
| **Speech Runtime Host Registry** | ⚠️ **Ephemeral In-Memory State** — Stores single nullable `hostPipeline = null` inside setup closure ([`pipeline-runtime.ts:36`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/services/speech/pipeline-runtime.ts#L36)). Resets to `null` on HMR; falls back to remote intent bus. | [`packages/stage-ui/src/stores/speech-runtime.ts:6`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/speech-runtime.ts#L6) |
| **Setup-Scope Side Effects** | ⚠️ **Un-disposed Effect Scopes** — Stores call composables (`useBroadcastChannel`, `useIntervalFn`, `setInterval`) directly in setup scope. | [`chat.ts:125`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L125), [`proactivity.ts:247,835`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L247) |
| **Multi-Store Export Hazard** | ⚠️ **Pinia HMR ID-Mismatch Prerequisite** — [`hearing.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/hearing.ts#L60-L316) exports two stores (`useHearingStore` & `useHearingSpeechInputPipeline`). [`character/index.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/character/index.ts#L11-L36) defines a store while re-exporting child stores. Must be split into single-store modules before Phase 0B. | [`hearing.ts:60`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/hearing.ts#L60), [`character/index.ts:11`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/character/index.ts#L11) |

### Empirical Breakdown of Pinia 3.0.4 HMR Engine (`node_modules/pinia/dist/pinia.mjs`)
Inspection of Pinia 3.0.4 source code ([`node_modules/pinia/dist/pinia.mjs:1108`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs#L1108)) reveals how Pinia handles soft store HMR:
1. `acceptHMRUpdate(useStore, import.meta.hot)` captures `pinia._s.get(id)` on existing store instances.
2. When HMR triggers, Pinia creates a temporary setup store (`__hot:${id}`) and invokes `store._hotUpdate(newStore)` ([`pinia.mjs:1557`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs#L1557)).
3. `_hotUpdate` **copies existing reactive state values into the new store** (`newStore.$state[stateKey] = oldStateSource`), preserving existing `ref` instances in place, while replacing actions and getters on the **same store instance object**.
4. **Multi-Store Export Warning**: Pinia's default `acceptHMRUpdate` helper iterates every store export in the module ([`pinia.mjs:1122`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/pinia/dist/pinia.mjs#L1122)). If a module exports multiple stores, `acceptHMRUpdate` requires that the passed store ID matches the exported store ID, or else it triggers `hot.invalidate()`. Multi-store modules must be split into single-store files prior to acceptance.
5. **Effect Scope Caveat**: Pinia's `_hotUpdate` **does NOT stop or dispose the old setup function's Vue effect scope**. Setup-scope watchers, intervals, and event listeners remain alive unless explicitly torn down via a side-effect ledger.

---

## 3. Root-Cause Technical Audit: The 5 Failure Modes

Below is an empirical analysis of the failure modes that trigger when store HMR is enabled without proper lifecycle teardown.

### Failure Mode 1: Imperative Callback Registration & Defunct Event Buses
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) — `const hooks = createChatHooks()`
  * [`packages/stage-ui/src/stores/chat/hooks.ts:6-16`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/hooks.ts#L6-L16) — 11 internal callback arrays (`onTokenLiteralHooks`, etc.)
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:1184-1209`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L1184-L1209) — Registration at top-level `<script setup>` scope
* **Mechanism**:
  Components register callback functions on event buses during setup execution (e.g. `chatStore.onToken((token) => speak(token))`). When `chat.ts` is re-evaluated by Vite, a new event bus instance is created with an empty listener array (`listeners = []`). Because long-lived renderers never unmount during store HMR, they remain subscribed to the **orphaned event bus instance**. Subsequent LLM tokens are emitted to the new bus, which has 0 listeners.

### Failure Mode 2: Destructured Actions & Getter Snapshots
* **Source Locations**:
  * [`ControlStripHost.vue:76-80`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L76-L80) — Destructuring chat hook methods at setup scope
  * [`InteractiveArea.vue:62-64`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue#L62-L64) — Destructuring orchestrator actions at setup scope
* **Mechanism**:
  Under Pinia 3, capturing store object instances (`const chatStore = useChatOrchestratorStore()`) is safe because identity is preserved. **The genuine hazard is destructuring action or getter functions** (`const { action } = store`). Destructuring extracts a static function snapshot closing over the old setup scope. When actions are updated on the store proxy, the local destructured snapshot remains bound to the old scope.

### Failure Mode 3: Module-Scope Singletons vs. Vite ESM Module Reloading
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
  * [`packages/stage-ui/src/stores/chat/session-store.ts:41`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts#L41) — `useBroadcastChannel(CHAT_STREAM_CHANNEL_NAME)` in setup scope
  * [`packages/stage-ui/src/stores/proactivity.ts:247,835`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L247) — `useIntervalFn` sensor poll & raw `setInterval` heartbeat
  * [`packages/stage-ui/src/stores/modules/live-session.ts:159-165`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/live-session.ts#L159-L165) — `useLocalStorage` watchers
* **Mechanism**:
  Pinia's `_hotUpdate` does **not** stop the old setup's Vue effect scope. Each accepted HMR re-evaluates setup, instantiating **duplicate `BroadcastChannel` instances, intervals, and IPC listeners**. Per W3C spec, duplicate same-name `BroadcastChannel` objects in the same context deliver messages to each other, resulting in **duplicate input submissions and double heartbeat turn executions**.

---

## 4. Architectural Mitigation Strategies

### Strategy A: HMR-Resilient Module Singletons (`import.meta.hot.data`) & ABI Invalidation
> **Status**: `[Status: Proposed]`

#### Current Reality
Singletons like `const hooks = createChatHooks()` in [`chat.ts:96`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts#L96) are instantiated directly at module evaluation time. When Vite re-evaluates `chat.ts`, a brand new `hooks` object is created.

#### Target Implementation & Prior Art Pattern
Follow the codebase's existing established pattern from [`packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts:22-27`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts#L22-L27) with namespaced slots and **ABI Mismatch Invalidation**:

```typescript
interface ChatHooksHotSlot {
  version: number
  value: ReturnType<typeof createChatHooks>
}

const CHAT_HOOKS_VERSION = 1
const hotSlot = import.meta.hot?.data?.chatHooks as ChatHooksHotSlot | undefined

let hooks: ReturnType<typeof createChatHooks>

if (hotSlot) {
  if (hotSlot.version !== CHAT_HOOKS_VERSION) {
    // ABI changed: invalidating triggers a clean full-reload rather than creating orphaned buses
    import.meta.hot?.invalidate('Chat hooks ABI version mismatch')
    hooks = createChatHooks()
  }
  else {
    hooks = hotSlot.value
  }
}
else {
  hooks = createChatHooks()
}

if (import.meta.hot) {
  import.meta.hot.data.chatHooks = { version: CHAT_HOOKS_VERSION, value: hooks }
}
```

> [!TIP]
> **Behavioral Continuity for Destructured Wrappers**:
> If a component destructured a store function wrapper at setup execution (`const { onTokenLiteral } = store`), that local variable retains a static snapshot of the wrapper. By preserving the underlying `hooks` instance via `import.meta.hot.data`, the preserved arrays remain active. The destructured wrapper stays **behaviorally valid** because it delegates to the exact same preserved hooks array in memory!

#### Strategy Tracking Log
- **2026-08-13**: Strategy refined with namespaced hot data slot and `import.meta.hot.invalidate()` ABI mismatch handling. Target files: `chat.ts`, `speech-runtime.ts`.

---

### Strategy B: Action Destructuring Audit & Direct Property Access
> **Status**: `[Status: Proposed]`

#### Current Reality
Under Pinia 3 in-place patching, capturing store instances (`const chatStore = useChatOrchestratorStore()`) at setup scope is safe. However, destructuring store methods (`const { performSend } = chatStore`) creates static function snapshots.

#### Target Implementation
Disallow destructuring actions or getters from stores at setup scope; invoke methods directly via property access or `storeToRefs()` for reactive state:

```typescript
// ❌ AVOID: Destructured function snapshot loses connection to patched store actions
const { performSend } = useChatOrchestratorStore()
function onUserAction() { performSend(...) }

// ✅ RECOMMENDED: Property access dynamically resolves the active patched store action
const chatStore = useChatOrchestratorStore()
function onUserAction() { chatStore.performSend(...) }
```

#### Strategy Tracking Log
- **2026-08-13**: Strategy rescoped to action destructuring audit following Pinia 3 `_hotUpdate` verification. Audit targets: `ControlStripHost.vue`, `InteractiveArea.vue`, `proactivity.ts`.

---

### Strategy C: Declarative Reactive Streams over Callbacks & Pinia `acceptHMRUpdate`
> **Status**: `[Status: Proposed]`

#### Current Reality
Renderers register callbacks via imperative methods like `chatStore.onToken(...)`. Furthermore, Pinia's `acceptHMRUpdate` helper is currently 0% wired across AIRI stores.

#### Target Implementation & HMR Async Epoch Guard
Prefer Pinia reactive state (`storeToRefs(chatStreamStore).streamingMessage`) over imperative registration arrays. Wire `acceptHMRUpdate` across all hot-path stores, combined with a **module-scope HMR Async Epoch Guard**:

```typescript
// Module-Scope In-Flight Async Loop Guard (must remain a module-level 'let'):
let hmrEpoch = 0

// Inside performSend async streaming loop:
async function performSend(...) {
  const currentEpoch = hmrEpoch
  for await (const chunk of stream) {
    if (hmrEpoch !== currentEpoch) {
      chatLog('[ChatDebug] Aborting in-flight streaming loop due to HMR reload')
      return
    }
    // process chunk...
  }
}
```
* **Guarantee**: Pinia's `_hotUpdate` copies existing state values into the new store (`newStore.$state[stateKey] = oldStateSource`), preserving existing `ref` instances in place, while replacing actions/getters on the existing store instance pointer. Vue `watch()` and `watchEffect()` blocks in components automatically track and update across HMR state patches without needing re-registration.

#### Strategy Tracking Log
- **2026-08-13**: Strategy updated with module-scope HMR Async Epoch Guard for in-flight loops. Target allowlist: `chat.ts`, `session-store.ts`, `context-store.ts`, `stream-store.ts`, `speech-runtime.ts`, `proactivity.ts`, `live-session.ts`, `hearing.ts`, `character/orchestrator/store.ts`.

---

### Strategy D: Decoupled Primitive Event Transport & Protocol Epochs
> **Status**: `[Status: Proposed]`

#### Current Reality
Cross-boundary events (e.g. streaming tokens from orchestrator to TTS host) rely on JS object references and string-keyed `BroadcastChannel` instances.

#### Target Implementation
For cross-window or cross-boundary communication, rely on primitive string channels over `@moeru/eventa` or `BroadcastChannel`. To prevent duplicate delivery when HMR instantiates new channels:
1. Payloads must carry monotonic sequence IDs (`originId`, `sequence`) and build epoch headers for consumer-side deduplication.
2. Cross-window receivers running mismatched protocol versions reject incompatible traffic or trigger a coordinated reload.
3. Old channel instances must be explicitly closed in the single `import.meta.hot.dispose()` callback.

#### Strategy Tracking Log
- **2026-08-13**: Strategy updated with protocol epoch headers and BroadcastChannel deduplication. Target files: `ControlStripHost.vue`, `RendererStage.vue`, `bus.ts`.

---

### Strategy E: Single Combined Teardown Ledger via `import.meta.hot.dispose()`
> **Status**: `[Status: Proposed]`

> [!IMPORTANT]
> **Strict Architectural Rule: Exactly ONE `import.meta.hot.dispose()` Callback Per Module**:
> Vite's HMR client stores disposal handlers in a map keyed by module path ([`client.mjs:48-49`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/node_modules/vite/dist/client/client.mjs#L48-L49)). Registering `import.meta.hot.dispose()` multiple times in the same file will **silently overwrite previous handlers**. Every accepting store module must use a **single combined `dispose` callback**.

#### Target Implementation & Combined Teardown Pattern
Setup stores that initialize long-lived side effects must register teardown callbacks into a `hot.data`-preserved ledger array, executed within a single combined disposal handler:

```typescript
// Single Combined Teardown & Epoch Teardown Pattern per Module:
const hotData = import.meta.hot?.data as { disposers?: Array<() => void> } | undefined
const disposers = hotData?.disposers ?? []

if (import.meta.hot) {
  import.meta.hot.data.disposers = disposers

  // EXACTLY ONE dispose callback per module:
  import.meta.hot.dispose(() => {
    // 1. Mark generation disposed synchronously FIRST so in-flight loops abort immediately:
    hmrEpoch++

    // 2. Drain LIFO and execute all setup-scope teardowns synchronously:
    while (disposers.length > 0) {
      const dispose = disposers.pop()
      try {
        dispose?.()
      } catch (err) {
        console.error('[HMR Teardown Error]:', err)
      }
    }
  })

  // Register Pinia accept boundary after teardown handler:
  import.meta.hot.accept(acceptHMRUpdate(useChatOrchestratorStore, import.meta.hot))
}

// Registering handles inside setup scope:
const bc = useBroadcastChannel('airi-chat-input-bridge')
disposers.push(() => bc.close())

// Exact function reference removal for IPC / Eventa .on() listeners:
function onIpcEvent(evt, data) { ... }
ipcRenderer.on('custom-evt', onIpcEvent)
disposers.push(() => ipcRenderer.removeListener('custom-evt', onIpcEvent))
```

> [!CAUTION]
> **Never call `store.$dispose()` inside `import.meta.hot.dispose()`**:
> Calling `store.$dispose()` deletes the store ID from `pinia._s`. This causes `acceptHMRUpdate`'s `pinia._s.has(id)` check to fail, skipping the hot update and leaving components with orphaned store objects. Teardown ledgers must target specific setup side-effects (intervals, channels, IPC listeners) only.

#### Strategy Tracking Log
- **2026-08-13**: Enforced single combined `import.meta.hot.dispose()` architectural rule. Refined teardown execution sequence (epoch bump first -> LIFO ledger drain).

---

## 5. WebGPU & Background Worker Concurrency Protections

### Module-Global WebGPU Coordinator & Worker Graph
Local model drivers (Kokoro TTS, Whisper STT, WebLLM, Web-RWKV) rely on WebGPU resource allocators in [`packages/stage-ui/src/libs/inference/coordinator.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/coordinator.ts#L18-L19) and dedicated Web Workers.

* **The Hazard**: Re-evaluating worker/adapter modules creates parallel global GPU allocators and duplicate worker threads, exhausting WebGPU device contexts and VRAM.
* **Architecture Requirement**:
  1. Worker and GPU adapter modules are classified under **Phase 0C (Hard Invalidation)**. Saving worker/coordinator modules triggers an explicit `import.meta.hot.invalidate('WebGPU coordinator graph update')` to force a clean full-reload.
  2. Future worker lifecycle managers must enforce a single versioned owner with worker-reply generation IDs to prevent late worker messages from mutating superseded state.

---

## 6. Implementation Roadmap

| Phase | Sub-Phase | Target Area | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **0A — Prerequisites** | `hearing.ts`, `character/index.ts` | **Prerequisite**: Split multi-store export files into single-store modules before adding accept boundaries. | `[Status: Proposed]` |
| | **0B — Pure Stores** | Simple Settings & Config Stores | Wire `acceptHMRUpdate` across pure state stores without setup side-effects. | `[Status: Proposed]` |
| | **0C — Lifecycle Stores** | Core Orchestrators & Child Stores (`chat`, `session-store`, `context-store`, `stream-store`, `speech-runtime`, `proactivity`, `live-session`, `hearing`, `character/orchestrator`) | Wire `acceptHMRUpdate` bundled together with Strategy A/E side-effect ledgers, single `dispose` handlers, and `hmrEpoch` guards in the same change. | `[Status: Proposed]` |
| | **0D — Hard Invalidation** | AudioContext, WebGPU Coordinators, Workers | Add explicit `import.meta.hot.invalidate()` to heavy resource modules until dedicated worker lifecycle managers exist. | `[Status: Proposed]` |
| **Phase 1** | **Core Singletons** | `chat.ts` hooks, `speech-runtime.ts` host registry, `bus.ts` | Refactor module singletons to use version-guarded `import.meta.hot.data` slots with `invalidate()` on ABI mismatch. | `[Status: Proposed]` |
| **Phase 2** | **Teardown Ledgers** | Setup-scope composables (`useBroadcastChannel`, `useIntervalFn`, `useLocalStorage`) | Implement Side-Effect Teardown Ledgers and single `import.meta.hot.dispose()` handlers with LIFO synchronous execution. | `[Status: Proposed]` |
| **Phase 3** | **Destructuring Audit & Epochs** | Renderers (`ControlStripHost.vue`, `InteractiveArea.vue`) & Async Loops | Conduct targeted action destructuring audit and add `hmrEpoch` checks to in-flight LLM streaming loops. | `[Status: Proposed]` |

---

## 7. Verification Plan

### Automated Verification & Invariants
* Run typecheck on affected workspaces after each phase:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F stage-tamagotchi typecheck
  ```
* Dev-mode invariant assertion:
  ```typescript
  if (import.meta.hot) {
    console.assert(import.meta.hot.data.chatHooks?.value === hooks, '[HMR Invariant] chatHooks singleton preserved')
  }
  ```

### Manual Dev-Mode HMR Verification
1. Launch `stage-tamagotchi` in dev mode (`pnpm dev`).
2. Trigger an LLM chat turn to verify initial TTS speech playback.
3. Edit `session-store.ts` or `chat.ts` (both 0C-accepted stores) and save while the app is running.
4. Trigger a second LLM chat turn without restarting the app or refreshing the window.
5. **Pass Criteria**: Audio streams seamlessly, TTS pipeline receives tokens, and proactivity heartbeats operate normally without duplicate executions or silent audio drops.
