# Handoff Document: Live2D DSL Engine Phase 2 & Attention Ecology Dashboard

**Commit Hash:** `77226abd8` (`feat(live2d-runtime): implement MotionEnable/MotionDisable toggle gating & intimacy store harness test (52/52 passed)`)
**Date:** August 9, 2026
**Status:** Clean, Typecheck Green, 52/52 DSL Harness Passed

---

## 1. Summary of Completed Work

### A. Live2D DSL Engine Phase 2 (Landed in `77226abd8`)
- **Task 1 — Intimacy Store Integration (`Bonus` Event)**:
  - Verified `Model.vue:1309-1312` wires `dslVM` intimacy accessors → `Live2DRuntimeAdapter.addIntimacy` → persistent `useDslIntimacyStore` (`stores/dsl-intimacy.ts`), broadcasting `dsl-intimacy-changed` to `dating-sim.ts`.
  - Added headless proof in **Scenario 6** of `scripts/tests/live2d-dsl-harness/test-dsl-interpreter.ts` asserting both `+50` and `-50` `Bonus` persist to the raw store, clamp at 0–100k, and do **not** leak into the ephemeral `VarFloats` heap.
- **Task 2 — Motion Toggle Gating (`MotionEnable`/`MotionDisable`)**:
  - `packages/stage-ui-live2d/src/runtime/live2d-runtime-adapter.ts`: Added `motionGroupEnabled` map, `setMotionGroupEnabled(ref, enabled)`, `isMotionGroupEnabled(group)`, and `setOnMotionGroupEnabledChange(handler)`.
  - `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`: Added `dslMotionGroupBlocked(group, index)` gate checking group + idle-alias fallthrough, initial auto-play check, `motionFinish` restart loop filtering, active motion stopping on disable, and cleanup in `dispose()`.
  - Added **Scenario 5** in `scripts/tests/live2d-dsl-harness/test-dsl-interpreter.ts` verifying `Next:Leaveon`/`Next:Leaveoff` motion pool gating.
  - Updated `docs/project-standalone-live2d-engine-plan.md` to mark Phase 2 as **✅ COMPLETE**.

### B. Attention Ecology Harness & Real-Time Observer Dashboard
- **Fixed Gate Threshold Property Bug**: Updated `ocrHits` → `ocrErrorPatternsMin: 2` in `live-desktop-dashboard.ts` and `live-desktop-observer.ts` so `evaluateSalience()` evaluates to `salience.decision === 'PROMOTE'` when $\ge 2$ keywords match.
- **Added Agentic Coding Keywords**: Added `antigravity`, `open ide`, `airi`, `projects` to Stage 2 OCR patterns.
- **Added Zero-Shot CLIP Tag Decoding**: Computes instant zero-shot CLIP label classification (`classifyZeroShot`) in $<1\text{ms}$ during Stage 1.
- **Compact Event Stream Timeline**: Redesigned dashboard ingestion box into a compact 5-event timeline stream (`eventStream`) displaying 12-hour AM/PM timestamps, padded active window names, and 2-line wrapped return-arrow VLM captions (`└─►`).
- **Persisted JSONL Logs**: Appends every promoted event payload to `scripts/tests/attention-ecology-harness/promoted-events.jsonl`.
- **Documented Spec**: Added Section 14 to `docs/proposal-attention-ecology-local-webgpu-guard.md`.

---

## 2. Verification Suite Results

| Test / Check | Command | Status |
| :--- | :--- | :--- |
| **DSL Engine Harness** | `pnpm test:dsl` | **52/52 PASSED** (6 scenarios) |
| **Stage-UI Live2D Typecheck** | `pnpm -F @proj-airi/stage-ui-live2d typecheck` | **0 ERRORS (GREEN)** |
| **Live2D Runtime Typecheck** | `pnpm -F @proj-airi/live2d-runtime typecheck` | **0 ERRORS (GREEN)** |
| **Attention Ecology Harness** | `pnpm test:attention` | **8/8 PASSED** |

---

## 3. Next Phase Roadmap & Instructions to Proceed

### Next Phase A: Multi-Costume MOC Buffer Hot-Swapping (`ChangeCos`)
- **Objective**: Implement WebGL buffer hot-swapping for multi-costume Live2D packages as specified in `docs/design-live2d-multimoc-changecos.md`.
- **Key Design Constraint**: Swapping `.moc3` WebGL VRAM buffers on `ChangeCos` must **NOT** re-fetch from disk or wipe the active DSL VM heap (`VarFloats`, intimacy score, active expressions).
- **Files to Modify**: `packages/stage-ui-live2d/src/utils/live2d-zip-loader.ts`, `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`.

### Next Phase B: RWKV Salience Gate UI Integration (Phase 6)
- **Objective**: Wire RWKV 0.1B $\Delta h$ salience gate into AIRI's UI per `docs/proposal-salience-gate-ui-integration.md`.
- **Tasks**:
  1. Add amber `Salience Vibe Active` pill in `InteractiveArea.vue`'s `PRE-FLIGHT GROUNDING ACTIVE` header bar.
  2. Add `Salience Gating (RWKV 0.1B)` toggle row in `ChatGroundingPopover.vue` & `chat.vue`.
  3. Connect store state in `packages/stage-ui/src/stores/chat.ts`.

### Next Phase C: In-App Attention Ecology Worker Wiring
- **Objective**: Connect `packages/stage-ui/src/workers/attention-guard/worker.ts` to Electron renderer's `useVisionOrchestratorStore`.

## Relevant Skills

- [[airi-live2d-dsl-interpreter]]
