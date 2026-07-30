# Bug Investigation: Model Disappearing on Apply/Assign

This document contains the verbatim bug report for the model assignment disappearance issue, followed by an independent analysis and proposed solutions.

---

## Verbatim Bug Report

### Suggested fix

- Make the assignment flow await card persistence and the stage sync result.
- Trigger `updateStageModel()` exactly once per model assignment.
- Avoid relying on both the `stageModelSelected` watcher and an explicit `updateStageModel()` call for the same state change.
- Validate that the selected display model and its `File`/`Blob` are valid before clearing the current stage model.
- Preserve the current model if loading the new assigned model fails.
- Display an error toast if the assigned model cannot be loaded.

### Reproduction steps

1. Import a Live2D ZIP.
2. Confirm the imported model appears and renders normally.
3. Open any character card, including a simple single-character card.
4. Select the imported Live2D model.
5. Click **Apply / Assign Model to Character**.
6. Observe that the stage model disappears immediately.

### Cause details

3. Inside `syncCardState()`, assigning `stageModelSelected` triggers a watcher that calls `updateStageModel('manual selection')`.

   `packages/stage-ui/src/stores/settings/stage-model.ts` around lines 248–250.

4. `syncCardState()` then calls `await stageModelStore.updateStageModel()` directly as well.

   `packages/stage-ui/src/stores/modules/airi-card.ts` around lines 729–735.

This produces two concurrent model-loading operations during Apply. The stage model store uses sequence cancellation and Blob URL replacement/revocation, so a concurrent reload can leave the renderer with no valid model URL or a disabled renderer.

---

## Independent Analysis & Verification

### 1. Execution Flow Verification
Based on a review of the codebase, the conflict occurs exactly as described when a new model is assigned to a character card:

1. **Card Update**: The user selects a model and clicks **Assign Model** in [model-assignment-modal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/model-assignment/model-assignment-modal.vue). This invokes `updateCard()`.
2. **Reactivity Watcher**: The change to the active card triggers the `activeCard` watch in [airi-card.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts#L1347-L1350), calling `syncCardState(newCard)`.
3. **Double Invocations**:
   - In `syncCardState()`, setting `stageModelStore.stageModelSelected = newModelId` runs the setter in [stage-model.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/settings/stage-model.ts#L20-L22), modifying `stageModelSelectedState`. This schedules the Vue watcher `watch(stageModelSelectedState, ...)` to fire asynchronously on the next tick (**Call A**).
   - Immediately after setting the property, `syncCardState()` calls `await stageModelStore.updateStageModel()` (**Call B**).
4. **Sequence Cancellation Failure**:
   - **Call B** starts execution immediately, incrementing the sequence counter to `1`. It then yields at `await displayModelsStore.getDisplayModel(selectedModelId)`.
   - **Call A** (scheduled by Vue's microtask queue) starts execution shortly after, incrementing the sequence counter to `2`. It yields at `await displayModelsStore.getDisplayModel(...)`.
   - When **Call B** finishes the fetch, it notices `requestId !== stageModelUpdateSequence` (`1 !== 2`) and cancels/aborts early.
   - Consequently, the `await stageModelStore.updateStageModel()` in `syncCardState()` resolves *prematurely* before the new model is actually ready or loaded.
   - When **Call A** completes, it revokes the old URL and updates `stageModelSelectedUrl`. However, because the timing is unsynchronized with `syncCardState`'s downstream view-update flow, the renderer is either left with a revoked/invalid URL or is told to render before the URL exists, causing the model to disappear.

---

## Evaluation of Suggested Fixes

### Do we double down on the suggested fix?
**Yes, we should double down on the core goals of the suggested fix**, specifically:
1. Ensuring `updateStageModel` is triggered exactly once.
2. Averting concurrent overlapping load operations.
3. Preserving the existing model state if loading the new one fails.

However, the implementation details require careful handling. Here is a critique of how to approach the fix:

### Recommended Implementation Strategy

#### A. Decouple Watcher and Explicit Calls
Relying on Vue watchers for critical async lifecycle side-effects (like loading raw files/blobs from IndexedDB) is prone to timing issues.
* **Refinement**: Keep the watcher on `stageModelSelectedState` inside `stage-model.ts` solely for **manual selection** from the UI settings.
* **Solution**: In `syncCardState()`, when updating the model programmatically, bypass the side-effect watcher. We can do this by setting a lock or temporary flag `isModelSyncPrevented` or `isInternalSync`, or simply having the watcher check if the assignment is already being handled. Alternatively, we can remove the watcher altogether and make all state changes to `stageModelSelected` explicitly call `updateStageModel()`.
* **Preferring**: Making all transitions explicit, or using a concurrency guard (e.g., a mutex or sequential queue task runner) inside `updateStageModel()` so that concurrent calls are queued/coalesced rather than abruptly canceled.

#### B. Implement Transactional Rollbacks for Model Loading
Currently, `updateStageModel` calls `replaceStageModelUrl(undefined)` or clears/disables renderers as soon as it determines a model is invalid or fails to load.
* **Refinement**: To preserve the current model if a new one fails:
  ```typescript
  async function updateStageModel(reason?: string) {
    ...
    try {
      const model = await displayModelsStore.getDisplayModel(selectedModelId)
      if (!model || (model.type === 'file' && !model.file)) {
        throw new Error('Invalid model data')
      }
      // Prepare resources first (e.g. object URLs, textures)
      const nextUrl = URL.createObjectURL(model.file)
      ...
      // Only swap state / revoke the old URL after successfully loading the new one
      replaceStageModelUrl(nextUrl)
    } catch (e) {
      // Toast / log error here
      // Keep old URL and renderer state intact
    }
  }
  ```

---

## Senior Engineer's Analysis & Vetting

I've now traced every link in the chain end-to-end: the modal, `updateCard`/`persistCards`, both `airi-card.ts` watchers, `syncCardState`, `updateStageModel`, the Live2D `Model.vue` loader, the cross-window rails, and the prior `fix-actor-stage-desync.md` architecture doc. Here's my vetting.

### Verdict

**I would double down on the fix's core direction, but not on the two concrete options its "Strategy A" floats** (a sync flag, or removing the watcher). Both of those are flawed in identifiable ways; the doc's own third preference — a concurrency guard inside `updateStageModel()` — is the right layer. The analysis is ~80% correct, with one significant gap in the last-mile mechanism and one missing reachability condition.

### What the analysis gets right (verified against source)

- **Double invocation**: `syncCardState` sets `stageModelStore.stageModelSelected = newModelId` (`airi-card.ts:738`), which schedules `watch(stageModelSelectedState, …)` → `updateStageModel('manual selection')` (`stage-model.ts:248-250`), then immediately calls `await stageModelStore.updateStageModel()` (`airi-card.ts:740`). Exactly as described.
- **Sequence-abort mechanics**: Call B runs first (requestId 1), yields at `getDisplayModel` (`stage-model.ts:82`); Call A starts on the next scheduler flush (requestId 2); Call B resumes, hits `requestId !== stageModelUpdateSequence` (`stage-model.ts:84-85`) and returns early — so the `await` in `syncCardState` **does resolve prematurely**. Verified.
- **Watcher trigger path**: `updateCard` → `persistCards` replaces `cards.value` (`airi-card.ts:427`) → `activeCard` watcher fires (`airi-card.ts:1347-1350`). Verified.
- Cross-references are accurate (line cites off by ~2-3 lines in one spot, trivially).

### Where the analysis is imprecise or incomplete

**1. It never names the actual destroy trigger.** The doc says the renderer is "left with a revoked/invalid URL or told to render before the URL exists" — directionally right, but the concrete mechanism is sharper than that, and it matters for the fix:

- After Call B aborts, `syncCardState` continues and reaches `live2dStore.shouldUpdateView()` (`airi-card.ts:789-791`, gated on `force || modelChanged`) **while `stageModelSelectedUrl` still points at the old model**.
- `shouldUpdateView` invokes `loadModel()` (`Model.vue:408-410`), and `loadModel()` **destroys the on-stage model first** (`Model.vue:643-652`), then starts loading the *stale* URL.
- Separately, the `props.modelId` change alone fires the `watch([modelSrcRef, modelId, modelFile], loadModel)` at `Model.vue:1401` — another destroy+reload against the stale URL.
- Then Call A completes and `replaceStageModelUrl` revokes that stale blob mid-fetch (`stage-model.ts:59-65, 204`).

So one logical assignment produces up to **three** serialized `loadModel()` executions, two of them against a doomed URL. Whether the final reload (with the correct new blob) lands cleanly is micro-timing dependent — which is why this presents as a heisenbug rather than a deterministic blank.

**2. Corroborating evidence the doc doesn't use: the double-call alone is not sufficient.** `handleModelPick` (`model-settings/index.vue:111-114`) uses the *identical* set-then-await pattern — set `stageModelSelected`, then `await settingsStore.updateStageModel()` — and works fine, because nothing downstream of its await calls `shouldUpdateView`. This refines the root cause: it's not "two concurrent loads" per se, it's that **the explicit await resolves before the effective load completes, so downstream view updates run against pre-swap state**. Any fix must make the await mean something, not just dedupe calls.

**3. A missing reachability condition.** `syncCardState` guards the raced block with `modelChanged = newModelId && newModelId !== stageModelStore.stageModelSelected` (`airi-card.ts:735`). In the doc's literal repro — import the ZIP, confirm it renders on stage (which sets `stageModelSelected` to it), then assign it to the card — `modelChanged` is **false** and the raced block is *skipped entirely*. The race only fires when the assigned model **differs** from the current stage selection (e.g., clicking "Assign" on a model in the selector list without first selecting it as the stage model) or under `force=true` from the concept-stack watcher. The doc's causal chain doesn't notice this guard; the repro steps need that condition stated, and any verification of the fix needs to cover both cases.

**4. A latent amplifier the doc misses entirely: mutex leaks in `loadModel`.** The mutex is acquired at `Model.vue:619`, but two early-return paths bail without releasing it: the pixiApp-teardown timeout (`Model.vue:635-639`) and the empty-`modelSrc` path (`Model.vue:653-658`). The `release()` at `Model.vue:1276` only covers the later `try` block. If the race ever drives a load into either path — entirely plausible given the `NOTICE` comment at line 631 says `shouldUpdateView` *can* fire during canvas teardown — the loader wedges **permanently**: every subsequent `loadModel` awaits the mutex forever. This is the best candidate mechanism for a *sticky* disappearance (vs. a recoverable flicker), and it should be fixed regardless of which primary approach is taken.

### Evaluating the proposed fix items

| Bug report item | Assessment |
|---|---|
| Await card persistence | **Unnecessary.** `cards.value` is replaced synchronously inside `persistCards` before any `await` (`airi-card.ts:427`); the race is not persistence-timing. Harmless, but don't spend effort here. |
| Trigger `updateStageModel()` exactly once | Right goal, wrong layer if done by call-site policing. |
| Avoid relying on both watcher and explicit call | Agreed in spirit — but see below on *how*. |
| Validate model/File/Blob before clearing current model | **Strongly endorse** (transactional). |
| Preserve current model on load failure | Endorse, **with a scope caveat**: `updateStageModel` only mints the blob URL; actual parsing happens in `Model.vue`, which destroys-first. Store-level transactionality preserves against store-level failures (missing model, invalid blob); renderer parse failures still blank the stage. Full preservation needs a load-into-standby/double-buffer in `Model.vue` — I'd scope that as a follow-up, not this fix. |
| Error toast on failure | Endorse; trivial at store level. Renderer errors currently only `console.error` + emit (`RendererStage.vue:441` swallows them). |

**On Strategy A's two concrete options:**
- **`isInternalSync` flag**: brittle. It wraps an async boundary (set flag → set state → watcher fires next tick → clear flag), leaks under re-entrancy, and only fixes this one call site while the identical pattern stays live in `handleModelPick`, `ControlStrip`, and the force-path concept watcher.
- **Remove the watcher altogether**: **not viable.** `ControlStrip.vue`'s `selectAvatar` (line 167-168) sets `stageModelSelected` with *no* explicit call — it relies solely on the watcher. So does the cross-window rail (Rail 4 in `fix-actor-stage-desync.md`): the stage window picks up localStorage changes via storage events, and the watcher is what applies them. Removing it silently breaks both.

### The fix I'd implement instead

Same goals, different center of gravity — put the correctness **inside the store**, where every present and future call site inherits it:

1. **Serialize `updateStageModel` with trailing coalescing** (latest-wins queue): each call chains behind the in-flight one; queued intermediates coalesce so only the newest requested model actually loads, and **every caller's promise resolves only when the pass covering its request has committed**. This makes the watcher+explicit duplication harmless, fixes the premature `await` for *all* call sites at once, and keeps the `isSameFile` no-op optimization (which is what makes redundant calls cheap and avoids revoking the live URL).
2. **Transactional commit within a pass**: resolve the model, validate `file`/`arrayBuffer`, create the object URL (and MMD textures) *first*; only then revoke the old URL and swap state. On any failure: keep the existing URL/renderer/file untouched, log, and toast. (Preserve the current stale-pass behavior of revoking a just-created-but-unused URL to avoid leaks — `stage-model.ts:199-202`.)
3. **In `syncCardState`**: with (1), the `await` becomes meaningful, so `shouldUpdateView` fires post-swap and is safe. Optionally skip it when the model actually changed, since the `modelSrc` watch at `Model.vue:1401` already reloads — avoids one redundant destroy+reload cycle. Keep it for the force/expression-only path where the URL doesn't change.
4. **Fix the `loadModel` mutex leaks** (`Model.vue:635-639, 653-658`): move the acquire inside the `try` or release in a `finally` on every path. This removes the permanent-wedge failure mode independent of the race.
5. Toast on store-level failure; optionally bridge the renderer `error` emit to a toast in `RendererStage.vue` instead of bare `console.error`.

One incidental finding while tracing call sites, pre-existing and out of scope but worth flagging: `ControlStrip.vue:172-177` (`selectAvatar`) writes `displayModelId` at `extensions.airi.displayModelId` (top level), but `syncCardState` reads `modules.displayModelId` — that write lands nowhere read. Separate issue.

---

## Startup Path & Root Cause Analysis

I've now traced the full startup path. Before giving you the verdict, let me lay out what's *provable* from the code, because the engineer's analysis gets the geography right but the mechanism wrong — and the mechanism determines the fix.

### What the stack trace actually proves

The warn at `stage-model.ts:119` is the **`!model`** branch — `getDisplayModel(id)` returned `undefined`. Looking at `getDisplayModel` (`display-models.ts:272-313`), that happens in exactly two ways:

1. `localforage.getItem(id)` returned **null** → the key is genuinely absent from IndexedDB, or
2. `localforage.getItem(id)` **threw** → the `.catch` at line 286-289 swallows it to `null` (it logs `'[PipelineTTS:Models] localforage.getItem FAILED:'` first — that line would be in your console immediately before the warn).

Note what the trace does **not** show: the invalid-file branch (`stage-model.ts:125-128`). That matters a lot for vetting the engineer's theory (below).

Also established: the write path is sound. `addDisplayModel` (`display-models.ts:895-918`) uses `id: display-model-${nanoid()}` as *both* the object id and the localforage key, and `await`s `setItem`. And since the model rendered on stage pre-refresh, `getDisplayModel` successfully read it back in that session — so **the key demonstrably existed at upload time and was gone at refresh time**. Something removed it, or the read threw.

### Vetting the engineer's analysis

**Where they're right:**
- `useDisplayModelsStore` does **not** eagerly load on store creation (`display-models.ts:116` starts `false`; only the remote catalog cache loads eagerly). So the `until(displayModelsFromIndexedDBLoading).toBe(false)` gate in `getDisplayModel` is decorative at startup — it resolves instantly. ✔ Verified.
- `loadDisplayModelsFromIndexedDB` has defensive Blob/File re-wrapping (`display-models.ts:164-174`) that `getDisplayModel` lacks. ✔ Verified.
- Their fix *direction* (initialize-before-read + heal parity in `getDisplayModel`) is half of the correct fix.

**Where the mechanism is wrong:**
- **"localforage.getItem returns null before IndexedDB has warmed up" — not a real behavior.** localforage queues operations until the IDB open completes; a committed key never reads back null due to timing. The instantly-resolving gate is a real observation, but fixing it alone is a *placebo* for this symptom: if the key is absent, awaiting initialization still returns null.
- **Prototype loss cannot produce the `!model` branch directly.** A structured-clone-degraded `val.file` (Blob without `arrayBuffer`) still *returns* from `getItem` — `getDisplayModel` would hand it back and you'd hit the **invalid-file** toast at `stage-model.ts:127`, not the **not-found** warn at `:119`. Your trace shows `:119`. So the engineer's primary theory does not explain your log.

### The mechanism the engineer missed: what can make the key absent

Only three code paths delete `display-model-*` keys:

1. **Self-heal deletion — `display-models.ts:219-224`** (the prime suspect). On every `loadDisplayModelsFromIndexedDB`, if a model's `val.file` fails the `arrayBuffer` check (this *is* where the engineer's prototype theory can bite), the store tries to restore the file from your BYOS backup drive. If the backup read returns **ENOENT** — e.g., the model was uploaded this session and never backed up, or the network share was asleep — it executes:
   ```ts
   debug(`[DisplayModels] Removing unrecoverable orphaned model entry from IndexedDB: ${key}`)
   await localforage.removeItem(key) // ← deletes the LOCAL original
   ```
   That's a repair path performing data loss: "backup unreachable/absent" is treated as "local original is worthless," and your only copy is deleted. This matches your report *literally* — "it deletes the model." Given this fork has self-heal code tuned for sleeping network shares (`:200-202`), you almost certainly have a BYOS path configured, which is the precondition.
2. **`reconcileModels()` — `sync-engine.ts:872-875, 934-938`**: deletes locally when the id appears in a deleted-models list. Requires remote sync enabled and the id marked deleted — implausible for a brand-new id.
3. Explicit user deletion — ruled out.

One more chain worth naming: if `getItem` *threw* (deserialization/IDB error), you'd see `'localforage.getItem FAILED'` logged first. Worth checking your console for that line, and for `'Removing unrecoverable orphaned model entry'` / `'Found N user models in IndexedDB'` — that plus "is BYOS/S3 sync configured?" settles which of the two paths fired. But the fix below covers both.

### Also: this is not a regression from the queue/preserve fix

On a miss, the *old* code silently cleared the stage (URL revoked, renderer `'disabled'`) — same data loss, no toast. The new preserve+toast code changed only the *consequence on stage*, not the underlying disappearance. The toast is the messenger that finally surfaced a pre-existing persistence bug; don't shoot it.

### The proper fix (4 items)

1. **Stop the data loss:** remove the `localforage.removeItem` calls in the self-heal ENOENT branch (`display-models.ts:221-224`). An unreachable or not-yet-synced backup must never delete the local original. Skip the model with a warning; leave the entry intact for a later session to heal.
2. **Make initialization real:** have the display-models store eagerly kick off `void loadDisplayModelsFromIndexedDB()` (**non-silent**) at creation, next to the existing remote-catalog eager load (`display-models.ts:121-136`). Since it's non-silent, `displayModelsFromIndexedDBLoading` actually goes `true` at boot — which turns the *existing* gate in `getDisplayModel` into a real initialization barrier. Stage reads then happen only after the first scan+heal completes. (This is the engineer's one correct proposal, properly wired — no new machinery needed.)
3. **Heal parity in `getDisplayModel`:** extract the Blob/File re-wrap into a small helper and use it in both `loadDisplayModelsFromIndexedDB` and `getDisplayModel`, so direct reads return valid `File`s even between heal cycles.
4. **Read-error honesty:** keep the `getItem` catch but make its log explicitly distinguish "read failed" from "key absent" (it already logs the error; I'll make the not-found warn in `stage-model.ts` conditional on a clean null vs. a thrown read so the two failure modes are unambiguous in future reports).

Tradeoff to note: item 2 means a genuinely orphaned entry (backup positively gone) is no longer auto-cleaned — it'll linger in IDB and be skipped with a warning each boot. That's the correct bias for user assets; explicit deletion already exists in the model manager UI.

