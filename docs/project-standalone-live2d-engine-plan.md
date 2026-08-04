# Project Plan: Standalone Live2D Engine & DSL Runtime

**Status:** Proposed / Design Blueprint
**Authors:** AIRI Team & AI Assistant
**Target Package:** `@proj-airi/live2d-runtime` (Standalone Cleanroom Module)
**References:**
- Upstream PR: [#2197 (Cubism 2.0 Support & Motion Refactor)](https://github.com/moeru-ai/airi/pull/2197)
- DSL Interpreter Spec: [live2d-dsl-interpreter-spec.md](./live2d-dsl-interpreter-spec.md)
- Special Sauce Manifests: [live2d-special-sauce-insights.md](./live2d-special-sauce-insights.md)
- Upstream Rosetta Stone: [rosetta-stone.md](./rosetta-stone.md)

---

## 1. Executive Summary & Core Objective

Currently, AIRI's Live2D runtime relies exclusively on Cubism 4 SDK loaders (`pixi-live2d-display@0.4.0`), leaving older Cubism 2.0 models (`.moc` files, such as the entire *BanG Dream!* series) unsupported. Furthermore, advanced third-party Live2D models contain rich interactive scripting (`VarFloats`, `Intimacy` bounds, `Choices` menus, and `Command` chains) that are currently pruned to prevent WebGL runtime crashes.

This project outlines a **cleanroom, standalone TypeScript package** (`@proj-airi/live2d-runtime`) that decouples Live2D rendering and manifest scripting from the main Electron/Vue application.

```
┌─────────────────────────────────────────────────────────────┐
│             @proj-airi/live2d-runtime (Package)             │
├─────────────────────────────────────────────────────────────┤
│ 1. Unified Multi-Gen Rendering Engine                       │
│    • Cubism 2.0 (.moc) & Cubism 3/4/5 (.moc3) support       │
│    • Ported Timing & Motion Normalization (PR #2197)        │
│                                                             │
│ 2. Live2D DSL Virtual Machine (State Engine)               │
│    • VarFloats reactive state heap (Type 1 Guards / Type 2) │
│    • Command queue processor (start_mtn, change_cos)        │
│    • Intimacy & TimeLimit evaluation rules                  │
│                                                             │
│ 3. UI Bridge & Event Emitters                               │
│    • Glassmorphic Choice Overlay Event Bus                  │
│    • Stage Viewport Expression / Motion Bus                 │
└──────────────────────────────┬──────────────────────────────┘
                               │ Clean Import
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 AIRI Application Runtime                    │
│           (apps/stage-tamagotchi & apps/stage-web)          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Component 1: Multi-Generation Render Core (Ported from PR #2197)

Upstream PR #2197 solved key latent bugs when unifying Cubism 2 and Cubism 3/4 under a single motion manager:

### 2.1 Timing Unit Normalization
* **Problem:** Cubism 2 passes timestamps in **milliseconds** (`now`), whereas Cubism 4 passes timestamps in **seconds** (`dt /= 1e3`). This caused `beatSync` and `eyeBlink` SDK calculations to be off by 1000×.
* **Solution:** All internal timings are normalized to milliseconds once inside `useLive2DMotionManagerUpdate`.

### 2.2 Single-Owner Focus Controller (Idle Eye Gaze)
* **Problem:** Direct writes to `ParamEyeBallX/Y` clashed with `focusController`, double-integrating spring physics and causing eyes to desynchronize from head motion.
* **Solution:** Establish `focusController` as the sole owner of eye gaze parameters.

### 2.3 Expression Rest / Neutral Value System
* **Problem:** Setting default blend values broke additive (`Add`, rest value `0`) vs multiplicative (`Multiply`, rest value `1`) expression toggles.
* **Solution:** Explicitly assign neutral rest values in `expression-controller.ts` based on parameter blend mode.

### 2.4 Eye Smile Standard Parameters
* **Problem:** Non-standard `ParamEyeSmile` parameters failed on standard models.
* **Solution:** Split eye smile updates into dedicated `ParamEyeLSmile` and `ParamEyeRSmile` parameter watchers.

---

## 3. Component 2: Live2D DSL Virtual Machine (`VarFloats` Engine)

Extracted from real-world model manifests logged in [`live2d-special-sauce-insights.md`](./live2d-special-sauce-insights.md):

### 3.1 State Heap Schema
```typescript
export interface VarFloatCondition {
  Name: string
  Type: 1 // Guard Condition (equal, greater, less)
  Code: string
}

export interface VarFloatMutation {
  Name: string
  Type: 2 // State Mutation (assign, add, subtract, rand)
  Code: string
}

export type VarFloat = VarFloatCondition | VarFloatMutation
```

### 3.2 Command Queue & Macro Dispatcher
Parses semicolon-delimited string commands embedded in custom model metadata:
* `start_mtn <group>:<name>`: Enqueues and plays motion audio/animation sequence.
* `change_cos <model_file>`: Swaps active outfit/costume manifest.
* `clear_exp`: Resets active expression blendshape overrides.
* `motions enable/disable <group>`: Dynamic motion pool gating.

### 3.3 Intimacy & Time-Based Logic
* **Intimacy Gating:** Evaluated per interaction (`{"Intimacy": {"Min": 80, "Bonus": 1}}`).
* **Seasonal / Time Gating:** Evaluated against month/time limits (`{"TimeLimit": {"Month": 6, "Sustain": 92160}}`).

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Isolated Cleanroom Engine Setup
1. Scaffold package directory structure `@proj-airi/live2d-runtime`.
2. Extract Cubism 2.0 & Cubism 3/4 loaders and normalized timing hooks from PR #2197.
3. Build isolated Vitest test suite testing model loading, timing normalization, and expression rest states offline.

### Phase 2: Live2D DSL Interpreter Implementation
1. Implement `ReactiveVarStore` with `rand()`, `assign`, `add`, `subtract`, and `equal` evaluation rules.
2. Implement `CommandParser` for chained macro strings (`start_mtn`, `change_cos`).
3. Add unit test suite using pruned manifest test cases from `live2d-special-sauce-insights.md`.

### Phase 3: AIRI Application Integration
1. Replace legacy `@proj-airi/stage-ui-live2d` loaders with the new cleanroom `@proj-airi/live2d-runtime`.
2. Connect DSL `Choices` event emitter to the floating glassmorphic choice UI overlay on `ActorStage`.
3. Verify backward compatibility with existing character cards and Cubism 4 models.

---

## 5. Verification & Testing Strategy

- **Automated Unit Tests:**
  `pnpm -F @proj-airi/live2d-runtime test` (must pass 100% of timing, VarFloats, and command parser tests).
- **Manual Verification:**
  - Load legacy Cubism 2.0 `.moc` model (e.g. *BanG Dream!* models).
  - Load advanced third-party Live2D model with `VarFloats` and `Choices` metadata.
  - Verify eye blink, beat sync, and idle gaze behavior in `stage-tamagotchi`.
