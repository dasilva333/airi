# Design & Architecture: ModelCustomizer Separation of Concerns

This document defines the interface boundaries, delegation of responsibilities, and reuse principles of the `ModelCustomizer` component and its relationship to the Rehearsal Room Sandbox.

---

## 1. Component Audit & Adoption Matrix

An audit of the settings panel components (`packages/stage-ui/src/components/scenarios/settings/model-settings/`) reveals the following adoption state of `ModelCustomizer.vue`:

| Model Format | Settings Panel Component | Adopts ModelCustomizer? | Detail |
| :--- | :--- | :--- | :--- |
| **Live2D** | `live2d.vue` | **Yes** | Delegates both Expressions and Motions rendering to `<ModelCustomizer />`. |
| **MMD** | `mmd.vue` | **Yes** | Delegates both Expressions and Motions rendering to `<ModelCustomizer />`. |
| **Spine** | `spine.vue` | **Yes** | Delegates both Expressions and Motions rendering to `<ModelCustomizer />`. |
| **VRM** | `vrm.vue` | **Partial** | VRM Expressions delegates to `<ModelCustomizer />` (via `vrm-expressions.vue`), but VRM Motions / Animations are **still custom-implemented inline** inside `vrm.vue`. |

### Key Insight
For VRM models, the settings panel (`vrm.vue`) still uses a custom inline list for motions which directly updates the model's base idle settings. To align with Live2D, MMD, and Spine, `vrm.vue` should be refactored to delegate both expressions and motions completely to `ModelCustomizer.vue`.

---

## 2. Delegation of Responsibility (The Boundary)

To prevent component pollution and ensure high reusability across both settings pages and acting panels, responsibilities are strictly separated as follows:

```
┌─────────────────────────────────────────────────────────────┐
│                   chat_rehearsal.vue                        │
│  (Rehearsal Room Sandbox / Acting Manager)                  │
├─────────────────────────────────────────────────────────────┤
│  - Textarea sandbox input (playgroundText)                  │
│  - Sandbox Actions: Play/Act, Create Motion (LLM generation)│
│  - Failsafe backup file download & Checkbox configuration   │
│  - LLM Suggestions & Instructions Generator modals          │
└──────────────┬──────────────────────────────────────────────┘
               │
               │ Renders & listens to
               ▼
┌─────────────────────────────────────────────────────────────┐
│                   ModelCustomizer.vue                       │
│  (Universal Model Capabilities Explorer)                    │
├─────────────────────────────────────────────────────────────┤
│  - Sourced list: Expressions & Motions (via displayModels)  │
│  - Row Actions: Row Click (trigger transient preview)       │
│  - Loop Toggle (infinity icon): cycle toggle                │
│  - Rename (pencil) & Visibility (eye)                       │
│  - Optional "@insert-token" event when showInsertActions=true│
└─────────────────────────────────────────────────────────────┘
```

### A. chat_rehearsal.vue responsibilities:
1. **Dialogue Sandbox**: Handles `playgroundText` inputs.
2. **LLM Generation Pipeline**: Resolves active provider/model parameters and invokes `llmStore.generateObject` with the Valibot schema to write `.vrma` binary files.
3. **Download Orchestration**: Manages triggering client-side browser file downloads (the backup failsafe download).
4. **Suggestions Engine**: Suggests dialogue strings and drafts acting instruction prompts.
5. **Stage Streaming**: Broadcasts playback streams to the Stage renderer.

### B. ModelCustomizer.vue responsibilities:
1. **Zero-Side-Effects Registry Explorer**: Acts purely as a visual list viewer and editor of model capabilities (renaming, visibility flags, favorites, and card cycle selections).
2. **Transient Previewing**: Clicking a row fires a local one-shot transient event (`triggerEmotion` / `triggerMotion`) to play the asset on screen without persistent side effects.
3. **Clean Interactivity**: If the boolean prop `showInsertActions` is passed, a simple `+` button is rendered next to list items. Clicking it emits `@insert-token(tokenString)` back to the parent, allowing the parent (such as `chat_rehearsal.vue`) to append it to its textarea.

---

## 3. Reference and Goals

* **Goal**: Enable complete deprecation of custom animation table code inside `vrm.vue` in favor of `<ModelCustomizer>`.
* **Consistency**: Ensure checking "Loop / Cycle Toggle" (infinity icon) maps identically across Settings panels and the Rehearsal Room, updating the card's acting config `idleAnimations` prefix-free for VRM animations.
