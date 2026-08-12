---
name: airi-live2d-dsl-interpreter
description: >-
  Use when evaluating, extending, or debugging the Live2D Scripting DSL Virtual Machine, pixi-live2d-display instruction parser (start_mtn, clear_exp), VarFloats heap, zero-latency WebGL costume hot-swapping (change_cos), or Live2DStageManager delta ticking loop.
---

# AIRI Live2D DSL Interpreter & Kinetic VM

This skill provides comprehensive technical guidelines and exact code paths for evaluating, extending, and debugging AIRI's Live2D Scripting DSL Virtual Machine and Cubism motion/expression parser.

## 1. Overview & Surface Map

AIRI extends standard Cubism Live2D rendering with an event-driven Virtual Machine (DSL Interpreter) built into `packages/stage-ui-live2d/`.
The DSL VM executes scripting instructions attached to Live2D character models:
- **Instruction Execution**: Parses commands like `start_mtn`, `clear_exp`, `set_param`, `change_cos`.
- **VarFloats Reactive Heap**: Maintains numeric state variables (`VarFloats`) for character logic, conditional guards, and state modifiers.
- **Zero-Latency Costume Swapping (`change_cos`)**: Hot-swaps `.moc3` costume variants in WebGL memory without resetting character variables.

## 2. Key Code Paths

### Core Live2D Model Component & DSL VM Hooks
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` — Primary Live2D component. Exposes `getDslState`, `dispatchDsl`, `selectDslChoice`, `changeCostume`, and the ticker loop.
- `packages/stage-ui-live2d/src/components/scenes/live2d/` — Live2D stage manager and canvas renderer.

### Related Specs
- `docs/live2d-dsl-interpreter-spec.md` — Formal specification document for the Live2D Scripting DSL instruction set, grammar, and VM heap architecture.
- `docs/handoff-live2d-dsl-phase2.md` — Phase 2 implementation handoff document detailing instruction dispatch and test cases.
- `docs/project-live2d-multimoc-changecos-design.md` — Architectural specification for multi-moc3 costume switching (`change_cos`).

## 3. Core SOPs & Guidelines

### 1. Adding a New DSL Instruction
1. Define the instruction syntax and opcode in `docs/live2d-dsl-interpreter-spec.md`.
2. Add the instruction parser handler inside `live2d/Model.vue` (`dispatchDsl`).
3. Update the `VarFloats` state heap evaluator if the instruction mutates variables.

### 2. Executing Costume Hot-Swaps (`change_cos`)
- Call `changeCostume(costumeId)` on the model instance. The VM swaps the `.moc3` byte stream while preserving active `VarFloats` and motion queue state.

## 4. Known Pitfalls & Failure Modes

- **VarFloats Heap Pollution**: Failing to reset `VarFloats` when switching to a completely different Live2D model character causes variable name collisions.
- **Motion File Path Normalization**: Cubism `model3.json` manifests often reference motion/expression files without directory prefixes. Use normalized path resolution when fetching asset blobs from `displayModelsStore`.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui-live2d typecheck`
- **Specification Check**: Verify instruction opcodes match `docs/live2d-dsl-interpreter-spec.md`.

### Authoritative Design & Architecture Documents

- [docs/live2d-dsl-interpreter-spec.md](docs/live2d-dsl-interpreter-spec.md) — Formal specification for the Live2D Scripting DSL instruction set.
- [docs/handoff-live2d-dsl-phase2.md](docs/handoff-live2d-dsl-phase2.md) — Phase 2 implementation handoff (instruction dispatch, test cases).
- [docs/project-live2d-multimoc-changecos-design.md](docs/project-live2d-multimoc-changecos-design.md) — Multi-moc3 costume switching (change_cos) design.
- [docs/live2d-dsl-test-cases-handoff.md](docs/live2d-dsl-test-cases-handoff.md) — DSL test cases handoff.
- [docs/live2d-change-cos-dependency-challenge.md](docs/live2d-change-cos-dependency-challenge.md) — change_cos dependency challenge.
- [docs/live2d-special-sauce-insights.md](docs/live2d-special-sauce-insights.md) — Live2D special sauce insights.
- [docs/project-standalone-live2d-engine-plan.md](docs/project-standalone-live2d-engine-plan.md) — Standalone Live2D engine plan.
