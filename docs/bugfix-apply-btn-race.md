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
