# AIRI HMR Resilience Architecture & State Lifecycle Initiative

> **Status**: Active Architecture Initiative
> **Canonical Target**: Establishing HMR accept boundaries, single combined side-effect teardown ledgers, version-guarded `import.meta.hot.data` singletons, `effectScope()` disposers, and HMR async epoch guards across Pinia stores and service pipelines in development environments.

---

## 1. Executive Summary & Causal Framing

During active development in Vite dev mode, editing core stores or service files (e.g. [`packages/stage-ui/src/stores/chat/session-store.ts`](./packages/stage-ui/src/stores/chat/session-store.ts), [`packages/stage-ui/src/stores/chat.ts`](./packages/stage-ui/src/stores/chat.ts), [`packages/stage-ui/src/stores/speech-runtime.ts`](./packages/stage-ui/src/stores/speech-runtime.ts)) impacts the dev experience:
- In-flight LLM text streams get reset, pending promise queues hang, and WebSocket connections experience reconnect churn.
- Multi-window Electron setups can experience cross-window HMR desyncs if one window (e.g. [`packages/stage-ui/src/components/scenes/ControlStripHost.vue`](./packages/stage-ui/src/components/scenes/ControlStripHost.vue)) misses the Vite WebSocket `full-reload` broadcast while another window reloads cleanly.

### Forward-Looking Causal Framing
Currently, **Pinia store HMR is 0% wired in AIRI** (zero calls to `acceptHMRUpdate`). When a developer saves a `.ts` store file today, Vite finds no accept boundary and triggers a **full-page window reload**.

This initiative is a **forward-looking architectural foundation**:
1. **Phase 0A (Prerequisites)**: Splits multi-store export modules (`hearing.ts`, `character/index.ts`) into single-store files before wiring accept boundaries.
2. **Phase 0B (Pure Stores)**: Introduces `acceptHMRUpdate` to pure state stores verified to own no setup side-effects.
3. **Phase 0C (Lifecycle Stores)**: Vertical completion gate where each lifecycle store receives single combined disposal ledgers, `effectScope()` teardowns, async epoch guards, and `acceptHMRUpdate` **atomically in a single change**.
4. **Phase 0D (Hard Invalidation)**: Explicitly marks WebGPU allocators, workers, AudioContext, and RPC-ABI modules as `import.meta.hot.invalidate()` boundaries until dedicated worker lifecycle owners exist.

---

## 2. Current Codebase Baseline & Pinia HMR Audit

An empirical audit of `packages/stage-ui/src/stores/` and `node_modules/pinia` reveals the exact technical baseline:

| Feature / Pattern | Current Reality | Verification Target |
| :--- | :--- | :--- |
| **`import.meta.hot` Wiring** | ❌ **0% Wired in Stores** — No store currently uses Vite's hot data container (`import.meta.hot.data`) or disposal hooks (`import.meta.hot.dispose`). (Only 3D/Live2D model caches use `hot.data`, e.g. [`vrm-instance-cache.ts`](./packages/stage-ui-three/src/components/Model/vrm-instance-cache.ts)). | `grep -r "import.meta.hot" packages/stage-ui/src/stores` → **0 matches** |
| **Pinia `acceptHMRUpdate`** | ❌ **0% Wired** — Pinia's HMR helper is not called in any store definition file. | `grep -r "acceptHMRUpdate" packages/stage-ui/src/stores` → **0 matches** |
| **Chat Event Bus (`createChatHooks`)** | ⚠️ **Un-persisted Module Singleton** — Hoisted to module scope in `chat.ts:96`, but lost whenever Vite re-evaluates `chat.ts` ESM module. Holds 11 closure arrays ([`hooks.ts:6-16`](./packages/stage-ui/src/stores/chat/hooks.ts#L6-L16)). | [`packages/stage-ui/src/stores/chat.ts:96`](./packages/stage-ui/src/stores/chat.ts#L96) |
| **Speech Runtime Host Registry** | ⚠️ **Ephemeral In-Memory State** — Stores single nullable `hostPipeline = null` inside setup closure ([`pipeline-runtime.ts:36`](./packages/stage-ui/src/services/speech/pipeline-runtime.ts#L36)). Resets to `null` on HMR; falls back to remote intent bus. | [`packages/stage-ui/src/stores/speech-runtime.ts:6`](./packages/stage-ui/src/stores/speech-runtime.ts#L6) |
| **Setup-Scope Side Effects** | ⚠️ **Un-disposed Effect Scopes** — Stores call composables (`useBroadcastChannel`, `useIntervalFn`, `setInterval`) directly in setup scope. `settings/chat.ts` calls `useLocalStorageManualReset`, which creates un-exposed internal watchers. | [`chat.ts:125`](./packages/stage-ui/src/stores/chat.ts#L125), [`proactivity.ts:247,835`](./packages/stage-ui/src/stores/proactivity.ts#L247) |
| **Multi-Store Export Hazard** | ⚠️ **Pinia HMR ID-Mismatch Prerequisite** — [`hearing.ts`](./packages/stage-ui/src/stores/modules/hearing.ts#L60-L316) exports two stores (`useHearingStore` & `useHearingSpeechInputPipeline`). [`character/index.ts`](./packages/stage-ui/src/stores/character/index.ts#L11-L36) defines a store while re-exporting child stores. Must be split into single-store modules in Phase 0A. | [`hearing.ts:60`](./packages/stage-ui/src/stores/modules/hearing.ts#L60), [`character/index.ts:11`](./packages/stage-ui/src/stores/character/index.ts#L11) |

---

## 3. Root-Cause Technical Audit: The 5 Failure Modes

### Failure Mode 1: Imperative Callback Registration & Defunct Event Buses
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:96`](./packages/stage-ui/src/stores/chat.ts#L96) — `const hooks = createChatHooks()`
  * [`packages/stage-ui/src/stores/chat/hooks.ts:6-16`](./packages/stage-ui/src/stores/chat/hooks.ts#L6-L16) — 11 internal callback arrays (`onTokenLiteralHooks`, etc.)
  * [`packages/stage-ui/src/components/scenes/ControlStripHost.vue:1184-1209`](./packages/stage-ui/src/components/scenes/ControlStripHost.vue#L1184-L1209) — Registration at setup scope
* **Mechanism**:
  Components register callbacks on event buses during setup execution (`chatStore.onToken(...)`). When `chat.ts` re-evaluates, a new event bus instance is created. Long-lived renderers remain subscribed to the **orphaned event bus instance**, dropping subsequent LLM tokens.

### Failure Mode 2: Destructured Actions & Getter Snapshots
* **Source Locations**:
  * [`ControlStripHost.vue:76-80`](./packages/stage-ui/src/components/scenes/ControlStripHost.vue#L76-L80) — Destructuring chat hook methods at setup scope
  * [`InteractiveArea.vue:62-64`](./apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue#L62-L64) — Destructuring orchestrator / maintenance actions at setup scope
* **Mechanism**:
  Capturing store instances (`const chatStore = useChatOrchestratorStore()`) is safe under Pinia 3. Destructuring action or getter functions (`const { performSend } = store`) extracts a static function snapshot bound to the old setup scope.

### Failure Mode 3: Module-Scope Singletons vs. Vite ESM Reloading
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:90-96`](./packages/stage-ui/src/stores/chat.ts#L90-L96) — Hoisted `hooks` singleton
* **Mechanism**:
  Editing `chat.ts` causes Vite to re-evaluate `chat.ts` from line 1. Submodules or components that imported `hooks` before the HMR reload remain bound to the previous evaluation's instance unless stashed in `import.meta.hot.data`.

### Failure Mode 4: Ephemeral Registries & Nondeterministic Fallbacks
* **Source Locations**:
  * [`packages/stage-ui/src/stores/speech-runtime.ts:5-7`](./packages/stage-ui/src/stores/speech-runtime.ts#L5-L7) — `const runtime = createSpeechPipelineRuntime()`
  * [`packages/stage-ui/src/services/speech/pipeline-runtime.ts:36`](./packages/stage-ui/src/services/speech/pipeline-runtime.ts#L36) — `let hostPipeline = null`
* **Mechanism**:
  `speech-runtime.ts` maintains `hostPipeline = null`. On HMR, `hostPipeline` resets to `null`, causing runtime intent dispatching to fall back to remote eventa channels.

### Failure Mode 5: Un-Disposed Side Effects & BroadcastChannel Multiplication
* **Source Locations**:
  * [`packages/stage-ui/src/stores/chat.ts:125`](./packages/stage-ui/src/stores/chat.ts#L125) — `useBroadcastChannel` in setup scope
  * [`packages/stage-ui/src/stores/chat/session-store.ts:41`](./packages/stage-ui/src/stores/chat/session-store.ts#L41) — `useBroadcastChannel(CHAT_STREAM_CHANNEL_NAME)`
  * [`packages/stage-ui/src/stores/proactivity.ts:247,835`](./packages/stage-ui/src/stores/proactivity.ts#L247) — `useIntervalFn` sensor poll & raw `setInterval` heartbeat
* **Mechanism**:
  Pinia's `_hotUpdate` does **not** stop the old setup's Vue effect scope. Each HMR update instantiates duplicate `BroadcastChannel` objects, intervals, and IPC listeners, causing duplicate input handling and double heartbeat turn executions.

---

## 4. Architectural Mitigation Strategies

### Strategy A: Controlled Accept Boundary & Version-Guarded Singletons
> **Status**: `[Status: Proposed]`

#### Controlling Accept Callback & ABI Invalidation
To prevent race conditions where Pinia's stock accept callback patches the store to an incompatible bus before invalidation propagates:

```typescript
const acceptStore = acceptHMRUpdate(useChatOrchestratorStore, import.meta.hot)

if (import.meta.hot) {
  import.meta.hot.accept((nextModule) => {
    if (!nextModule)
      return

    // Controlled ABI Mismatch Check BEFORE store patching:
    if (nextModule.CHAT_HOOKS_VERSION !== CHAT_HOOKS_VERSION) {
      console.warn('[HMR] ABI version mismatch — forcing full page reload')
      window.location.reload()
      return
    }

    acceptStore(nextModule)
  })
}
```

> [!TIP]
> **Behavioral Wrapper Continuity**:
> Destructured function wrappers stay **behaviorally valid** because they delegate to the preserved `hooks` bus array stored in `import.meta.hot.data.chatHooks`.

---

### Strategy B: Action Destructuring Audit & Direct Property Access
Disallow destructuring actions or getters from stores at setup scope; invoke methods directly via property access or `storeToRefs()` for reactive state.

---

### Strategy C: Declarative Reactive Streams & HMR Async Epoch Guard
Wire `acceptHMRUpdate` across all hot-path stores, combined with a module-scope **HMR Async Epoch Guard**, active `AbortController` cancellation, and queued promise rejection:

```typescript
// Module-Scope In-Flight Async Loop Guard (must remain a module-level 'let'):
let hmrEpoch = 0
let activeAbortController: AbortController | null = null

async function performSend(...) {
  const currentEpoch = hmrEpoch
  activeAbortController = new AbortController()

  for await (const chunk of stream) {
    // Check epoch after every await and stream callback:
    if (hmrEpoch !== currentEpoch) {
      chatLog('[ChatDebug] Aborting in-flight streaming loop due to HMR reload')
      activeAbortController.abort()
      return
    }
    // process chunk...
  }
}
```

---

### Strategy D: Decoupled Primitive Event Transport & Correct VueUse Signatures
For cross-window or cross-boundary communication, use primitive string channels with sequence IDs and correct VueUse signatures:

```typescript
// VueUse signature requirement:
const bc = useBroadcastChannel({ name: 'airi-chat-input-bridge' })
disposers.push(() => bc.close())
```

---

### Strategy E: Single Combined Teardown Ledger & `effectScope()` Disposers
> **Status**: `[Status: Proposed]`

> [!IMPORTANT]
> **Strict Architectural Rule: Exactly ONE `import.meta.hot.dispose()` Callback Per Module**:
> Vite keys disposal handlers by module path. Registering `import.meta.hot.dispose()` multiple times silently overwrites previous handlers. Every accepting store module must use a **single combined `dispose` callback**.

```typescript
// Single Combined Teardown Pattern per Module:
const hotData = import.meta.hot?.data as { disposers?: Array<() => void> } | undefined
const disposers = hotData?.disposers ?? []

// Wrap composables that lack stop handles (e.g. useLocalStorageManualReset):
const setupScope = effectScope()
setupScope.run(() => {
  // setup composables...
})
disposers.push(() => setupScope.stop())

if (import.meta.hot) {
  import.meta.hot.data.disposers = disposers

  import.meta.hot.dispose(() => {
    // 1. Mark generation disposed & abort active streams FIRST:
    hmrEpoch++
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }

    // 2. Reject queued pending promises so callers do not hang:
    while (pendingQueue.length > 0) {
      const pending = pendingQueue.pop()
      pending?.reject(new Error('[HMR] Store re-evaluated, pending action cancelled'))
    }

    // 3. Drain LIFO and execute all setup-scope teardowns:
    while (disposers.length > 0) {
      const dispose = disposers.pop()
      try {
        dispose?.()
      }
      catch (err) {
        console.error('[HMR Teardown Error]:', err)
      }
    }
  })
}
```

---

## 5. Store Classification Matrix

| Store File Path | Store ID | Category | Owned Effects / Async Work | HMR Migration Strategy |
| :--- | :--- | :--- | :--- | :--- |
| `packages/stage-ui/src/stores/settings/base.ts` | `settings-base` | **Phase 0B (Pure)** | Reactive state, `useLocalStorage` | `acceptHMRUpdate` pure state patching. |
| `packages/stage-ui/src/stores/settings/chat.ts` | `settings-chat` | **Phase 0C (Lifecycle)** | `useLocalStorageManualReset` | Wrap setup in `effectScope()`, ledger `scope.stop()`, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/chat.ts` | `chat` | **Phase 0C (Lifecycle)** | `createChatHooks`, `useBroadcastChannel`, `performSend` async stream | Controlling accept callback, `hot.data` hooks, single dispose ledger, `hmrEpoch` guard. |
| `packages/stage-ui/src/stores/chat/session-store.ts` | `chat-session` | **Phase 0C (Lifecycle)** | `useBroadcastChannel(CHAT_STREAM_CHANNEL_NAME)`, IndexedDB queue | Single dispose ledger, close channel, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/chat/context-store.ts` | `chat-context` | **Phase 0C (Lifecycle)** | Closure-local `currentActiveContexts` `Map` | Preserve/version `Map` in `hot.data.activeContextsMap`, single dispose ledger. |
| `packages/stage-ui/src/stores/chat/stream-store.ts` | `chat-stream` | **Phase 0C (Lifecycle)** | Streaming text buffer refs | Clear buffer on dispose, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/chat/compaction.ts` | `chat-compaction` | **Phase 0C (Lifecycle)** | Async context summarization loops | `hmrEpoch` check post-await, reject pending promises on dispose. |
| `packages/stage-ui/src/stores/chat/salience.ts` | `chat-salience` | **Phase 0C (Lifecycle)** | RWKV/salience gate worker calls | `hmrEpoch` check, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/chat/maintenance.ts` | `chat-maintenance` | **Phase 0C (Lifecycle)** | Periodic IndexedDB prune timers | Single dispose ledger for prune interval, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/speech-runtime.ts` | `speech-runtime` | **Phase 0C (Lifecycle)** | In-memory `hostPipeline` registry, eventa intent dispatch | `hot.data` host pipeline preservation, single dispose ledger. |
| `packages/stage-ui/src/stores/proactivity.ts` | `proactivity` | **Phase 0C (Lifecycle)** | Sensor poll `useIntervalFn` (L247), raw `setInterval` heartbeat (L835) | Single dispose ledger clearing interval & heartbeat, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/character/orchestrator/store.ts` | `character-orchestrator` | **Phase 0C (Lifecycle)** | Raw interval timers, event subscriptions | Single dispose ledger clearing timers, `acceptHMRUpdate`. |
| `packages/stage-ui/src/stores/audio.ts` | `audio` | **Phase 0D (Hard Invalidate)** | AudioContext lifecycle, PCM WebAudio nodes | `import.meta.hot.invalidate('AudioContext HMR hard reload')`. |
| `packages/stage-ui/src/libs/inference/coordinator.ts` | N/A | **Phase 0D (Hard Invalidate)** | WebGPU device allocators, VRAM priority queues | `import.meta.hot.invalidate('WebGPU coordinator HMR hard reload')`. |

---

## 6. WebGPU & Background Worker Concurrency Protections

Local model drivers (Kokoro TTS, Whisper STT, WebLLM, Web-RWKV) rely on WebGPU allocators in [`packages/stage-ui/src/libs/inference/coordinator.ts`](./packages/stage-ui/src/libs/inference/coordinator.ts#L18-L19) and dedicated Web Workers.

* **Phase 0D Requirement**: Worker and GPU adapter modules call `import.meta.hot.invalidate('WebGPU coordinator update')` to force a clean window reload.
* **Future Worker Owner Design**: Any future worker-preservation design must enforce worker-reply generation IDs so late messages from superseded workers cannot mutate current state.

---

## 7. Implementation Roadmap

| Phase | Target Area | Description | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0A** | Prerequisites | Split `hearing.ts` and `character/index.ts` into single-store files before wiring accept boundaries. | `[Status: Proposed]` |
| **Phase 0B** | Pure Stores | Wire `acceptHMRUpdate` across pure state stores (`settings/base.ts`, etc.). | `[Status: Proposed]` |
| **Phase 0C** | Lifecycle Stores | **Vertical Completion Gate**: For each store (`chat.ts`, `session-store.ts`, `context-store.ts`, `stream-store.ts`, `compaction.ts`, `salience.ts`, `maintenance.ts`, `speech-runtime.ts`, `proactivity.ts`, `character/orchestrator`), land accept boundary + single `dispose` handler + `effectScope()` + `hmrEpoch` guard **atomically in one change**. | `[Status: Proposed]` |
| **Phase 0D** | Hard Invalidation | Add explicit `import.meta.hot.invalidate()` to AudioContext, WebGPU Coordinators, Workers, and RPC-ABI modules. | `[Status: Proposed]` |

---

## 8. Verification Plan

### Automated Verification & Invariants
* Run typecheck on affected workspaces:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  pnpm -F stage-tamagotchi typecheck
  ```

### Manual Dev-Mode HMR Verification
1. Launch `stage-tamagotchi` in dev mode:
   ```bash
   pnpm -F @proj-airi/stage-tamagotchi dev
   ```
2. Trigger an LLM chat turn to verify initial speech playback.
3. Edit `session-store.ts` or `chat.ts` (both Phase 0C accepted stores) and save while the app is running.
4. Trigger a second LLM chat turn without restarting the app or refreshing the window.
5. **Pass Criteria**: Audio streams seamlessly, TTS pipeline receives tokens, and proactivity heartbeats operate normally without duplicate executions or silent audio drops.
