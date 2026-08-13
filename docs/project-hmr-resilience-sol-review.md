## Verdict

Conditional approval. The definitive architecture incorporates most first-pass corrections and is directionally sound, but I would **not execute Phase 0 exactly as written**. Four issues should be resolved first: multi-store HMR boundaries, accept/teardown sequencing, incomplete dependency coverage, and incompatible singleton-version handling.

Reviewed at commit `85e70c6074e3992de7c44be2b8ed66a8f4559ba7`:

* [Definitive architecture](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/docs/project-hmr-resilience-architecture.md)
* [First-pass review](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/docs/project-hmr-resilience-kimi-review.md)
* [Rosetta Stone](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/docs/rosetta-stone.md)

### Blocking and high-priority findings

| Severity | Finding                                                                                                                                                                         | Required change                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker  | `hearing.ts` exports two stores. Pinia 3.0.4’s helper scans every store export and invalidates when an instantiated store has a different ID.                                   | Split the stores into separate modules, or write a filtered/custom accept callback.                                                       |
| Blocker  | `character/index.ts` is both a store module and a barrel re-exporting other stores. This has the same multi-store problem plus Vite re-export limitations.                      | Move `useCharacterStore` into a dedicated module; leave the barrel passive.                                                               |
| Blocker  | Accept-only Phase 0 activates soft HMR in stores whose old setup scopes retain watchers, timers, listeners, channels, and async work.                                           | Bundle minimum Strategy A/E/async quiescence with each side-effect-heavy accept boundary.                                                 |
| High     | The allowlist omits child stores that may now sit below an accepting `chat.ts` boundary. Their edits can stop propagating without their existing Pinia instances being patched. | Classify and handle `chat/session-store.ts`, `context-store.ts`, `stream-store.ts`, `compaction.ts`, `salience.ts`, and `maintenance.ts`. |
| High     | A singleton version mismatch currently produces a new event bus, stranding old subscribers.                                                                                     | Invalidate/full-reload on incompatible versions, or implement an explicit migration.                                                      |
| High     | The ledger example treats all cleanup as synchronous and silently swallows failures.                                                                                            | Require synchronous quiescence, log cleanup failures, and make teardown idempotent.                                                       |
| High     | Module-level WebGPU coordinators and adapter singletons remain outside the design.                                                                                              | Hard-invalidate these modules for now, or give the entire worker/coordinator graph one versioned owner.                                   |
| High     | `import.meta.hot.data` is renderer-local; it cannot coordinate multiple Electron windows.                                                                                       | Add protocol/build epochs and mismatch handling to IPC/BroadcastChannel messages.                                                         |

## Phase 0 framing and allowlist

The framing is correct: adding Pinia accept boundaries transitions store edits from state-destroying reloads to in-place proxy patching. Pinia documents that HMR preserves state while updating actions/getters, and its standard pattern is the one used in the architecture. [Pinia HMR documentation](https://pinia.vuejs.org/cookbook/hot-module-replacement.html)

The proposed allowlist is not complete, however.

Most importantly:

* [`hearing.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/modules/hearing.ts#L60-L316) exports both `useHearingStore` and `useHearingSpeechInputPipeline`.
* [`character/index.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/character/index.ts#L11-L36) re-exports orchestrator/notebook stores while defining `useCharacterStore`.
* [`chat/session-store.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/chat/session-store.ts#L32-L61) owns a BroadcastChannel, persistence/synchronization queues, registries, and numerous setup watchers, yet it is omitted even though the verification plan proposes editing it.
* [`chat/context-store.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/chat/context-store.ts#L9-L55) has a non-reactive closure-local `Map`. New actions can close over a fresh map while the preserved reactive state reflects the previous instance.
* [`character/orchestrator/store.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/character/orchestrator/store.ts#L182-L214) owns a raw interval and event subscriptions.
* [`audio.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/stores/audio.ts#L71-L181) contains two stores and an AudioContext lifecycle. It should be explicitly classified even if the decision is “hard reload for now.”

Recommended Phase 0 split:

1. **0A — state/pure stores:** introduce ordinary Pinia acceptance for stores without setup-scope resources.
2. **0B — lifecycle stores:** accept `chat`, session/context, speech runtime, proactivity, live session, hearing, and character orchestration only when their teardown and async-epoch protections land in the same change.
3. **0C — hard invalidation:** audio, provider, WebGPU adapter/coordinator, worker, and RPC-ABI changes until a coherent runtime-owner design exists.

## Strategy A: version-guarded singletons

Sound for same-version preservation, with two changes.

Use a namespaced slot such as:

```ts
hot.data.chatHooks = { version: CHAT_HOOKS_VERSION, value: hooks }
```

This prevents collisions with other preserved resources in the same module.

More importantly, an incompatible version must not silently create a new bus. Existing component subscriptions remain attached to the old bus. The safe fallback is:

```ts
import.meta.hot.invalidate('chat hooks ABI changed')
```

Vite explicitly supports invalidating an update that a boundary cannot safely handle. Its `hot.data` object is preserved per module path, not only for self-accepted modules. [Vite HMR API](https://vite.dev/guide/api-hmr)

Also avoid saying a destructured action remains “100% identical.” Pinia replaces the action property on the live store; an already-destructured variable still points to the old wrapper. It only remains behaviorally valid here because that wrapper delegates to the preserved hook bus.

## Strategy B: destructured-action audit

The rescoping is correct under Pinia 3.0.4:

* Capturing the store proxy is safe.
* Accessing `store.action()` later obtains the patched action.
* Destructuring an action retains the old wrapper.
* Destructuring state/getters is separately non-reactive; `storeToRefs()` remains the correct solution.

The audit should cover consumers of every newly accepted store, not only the two named examples. Existing cases include:

* [`ControlStripHost.vue`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/components/scenes/ControlStripHost.vue#L76-L80): six destructured chat-hook registration methods.
* [`InteractiveArea.vue`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue#L62-L64): destructured maintenance/orchestrator actions.
* `configurator.ts`: destructured channel `send`.

A lint or AST check would prevent regression.

## Strategy E: teardown ledgers

The ledger pattern is appropriate, and the warning against calling the live store’s `$dispose()` is correct. `$dispose()` stops the scope and removes the store from Pinia’s registry, defeating the identity-preservation goal.

Required refinements:

* Drain in LIFO order, but do not assume ordering between different modules.
* First synchronously mark the old generation disposed; then abort work, stop producers/watchers/timers, remove listeners, close channels/sockets, and terminate resources.
* Capture exact cleanup handles: Vue watch stops, `useBroadcastChannel().close`, `useIntervalFn().pause`, Eventa unsubscribers, and the original Electron listener functions.
* Reject queued promises before clearing queues. `chat.ts` can otherwise leave callers permanently pending.
* Log or count teardown failures in development; `catch {}` hides precisely the leaks this initiative is intended to catch.
* Register idempotent cleanup for module pruning as well as replacement.
* Do not treat `useElectronEventaInvoke` itself as a subscription. Its implementation reuses a shared context and returns an invoke function; the persistent subscription cases are Eventa `.on(...)` handlers and raw `ipcRenderer.on(...)`.
* Do not rely on async disposal completing before the replacement module executes. Vite’s disposal callback is synchronous in contract.

For `live-session`, remove each IPC callback using its exact function reference; Electron’s `off/removeListener` API is appropriate, while `removeAllListeners` could remove unrelated consumers. [Electron `ipcRenderer` API](https://www.electronjs.org/docs/latest/api/ipc-renderer)

## Remaining runtime gaps

WebGPU is the largest unaddressed lifecycle risk. [`coordinator.ts`](https://github.com/dasilva333/airi/blob/85e70c6074e3992de7c44be2b8ed66a8f4559ba7/packages/stage-ui/src/libs/inference/coordinator.ts#L18-L19) keeps its coordinator and executor as ordinary module globals, while WebLLM, WebRWKV, Whisper, and Kokoro each have separate module-global adapter singletons. Re-evaluation can therefore create parallel “global” GPU owners and defeat the concurrency/VRAM invariant.

For this initiative, I recommend invalidating updates through the GPU adapter/coordinator/worker graph. Later, a versioned owner can choose exactly one of:

* Preserve a compatible worker/runtime.
* Synchronously terminate and recreate it on version/ABI change.

It cannot safely do both. Late worker replies also need a generation ID so terminated or superseded workers cannot mutate current state.

For Electron multi-window operation, each renderer has its own module graph and `hot.data`. Add a protocol/build epoch to IPC and BroadcastChannel messages. If windows disagree, either reject incompatible traffic or trigger a coordinated reload. Speech messages already contain useful identity/sequence fields, but receivers should enforce bounded deduplication rather than merely transporting those fields.

Finally, add a dedicated HMR epoch for long-running actions. Bump it synchronously during disposal and check it after every `await` and stream callback. Existing session-reset generations should not implicitly double as HMR generations.

## Corrections to the first-pass review

The first-pass review was valuable, but four assertions should not be carried forward unchanged:

* A self-accepting importer can become the boundary for dependency updates; the concern is that Vite does not automatically replace barrel re-exports or notify importers above that boundary. [Vite boundary behavior](https://vite.dev/guide/api-hmr)
* `useElectronEventaInvoke` is not itself a persistent listener.
* Proactivity’s `useIntervalFn(updateSensors, 10000)` is sensor polling; the heartbeat is a separate raw `setInterval`.
* “Preserve workers in `hot.data`” and “terminate workers in dispose” require an explicit compatibility branch; they are not simultaneously valid defaults.

Repository status remained clean after the review. No files were changed and no test suite was run because this was a read-only architecture audit.
