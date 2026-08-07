# Project Plan: Standalone Live2D Engine & DSL Runtime

**Status:** Phases 1–3 substantially landed; Phase 2 multi-gen `.moc` routing deferred. See §4.2 Progress Log.
**Target Package:** `@proj-airi/live2d-runtime` (headless, framework-agnostic) + `packages/stage-ui-live2d/src/runtime/` host adapter
**References:**
- DSL Interpreter Spec: [live2d-dsl-interpreter-spec.md](./live2d-dsl-interpreter-spec.md)
- Special Sauce Manifests: [live2d-special-sauce-insights.md](./live2d-special-sauce-insights.md)
- DSL Test Cases / Handoff: [live2d-dsl-test-cases-handoff.md](./live2d-dsl-test-cases-handoff.md)
- change_cos dependency challenge: [live2d-change-cos-dependency-challenge.md](./live2d-change-cos-dependency-challenge.md)
- Upstream Rosetta Stone: [rosetta-stone.md](./rosetta-stone.md)
- ~~Upstream PR #2197~~ — superseded; we build on our own vendored `pixi-live2d-display` cubism2 build, not that PR.

---

## 0. Reconciled Architecture (Recon & Design Review — APPROVED & LANDED)

A recon pass against the current codebase produced three binding decisions. These **supersede** the literal "extract render core into the new package" wording this plan originally carried.

1. **Headless runtime.** `@proj-airi/live2d-runtime` is a **pure, framework-agnostic, headless TypeScript package**: **no PIXI, no Vue, no DOM, no WebGL imports**. It implements the Live2D DSL Virtual Machine, the `VarFloats` reactive state heap, and the command/macro parser, and it drives the outside world exclusively through **output ports** (`ports.ts`). This lets the entire DSL + state engine run offline under Vitest with zero browser/canvas. *APPROVED.*
2. **Vendored Cubism 2.0.** The repository's patched `pixi-live2d-display@0.4.0` **already ships a Cubism 2 build** (`dist/cubism2.es.js` / `cubism2.js`); the fork's patch only adjusts its `createSettings`/`_ZipLoader` settings-file detection. So Cubism 2.0 support is **not** a from-scratch render port — it is a *routing/branch to the vendored `cubism2` entry* plus ms↔s timing normalization, done inside `stage-ui-live2d` (the existing render host), not inside the new runtime package. *APPROVED & VERIFIED* — cubism2/cubism4 share the same `InternalModel`/`MotionManager` base (`Cubism2MotionManager extends MotionManager<Live2DMotion, Cubism2Spec.Motion>`), and `pixi-live2d-display/cubism2` is a first-class typed export, so one adapter serves both generations; no bespoke loader needed.
3. **Environment note.** The paths printed in the handoff documents (`/Users/richardpinedo/...`) are from the authoring machine; the local equivalents resolve under `docs/` in this repository (`docs/live2d-*.md`).

### Revised Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│   @proj-airi/live2d-runtime  (HEADLESS / pure TS package)   │
│   NO PIXI · NO Vue · NO DOM · NO WebGL                      │
├─────────────────────────────────────────────────────────────┤
│ 1. Live2D DSL Virtual Machine (State Engine)               │
│    • ReactiveVarStore — VarFloats heap (Type 1 guards /     │
│      Type 2 mutations, full operator superset)              │
│    • Command/macro parser & sequencer (start_mtn,           │
│      change_cos, clear_exp, motions, mouse_tracking,        │
│      eye_blink, stop_sound, replace_tex, PostCommand)       │
│    • Entry selection (guards → intimacy → timelimit →       │
│      weighted pick) + Delta tick engine (timers/heartbeats) │
│                                                             │
│ 2. Output Ports (interfaces only — ports.ts)               │
│    IMotionSink · ISoundSink(channel) · IExpressionSink ·    │
│    ICostumeSwapper · IIntimacyStore · IEventEmitter · IClock│
└──────────────────────────────┬──────────────────────────────┘
                               │ implements ports over the
                               │ EXISTING renderer (adapter; no rip-out)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ packages/stage-ui-live2d  (render host — UNCHANGED owner)   │
│  • Cubism 4 (existing) + Cubism 2.0 branch via vendored     │
│    pixi-live2d-display/dist/cubism2 entry (ms↔s normalized) │
│  • Live2DRuntimeAdapter implements ports.ts over            │
│    motionManager + useLive2d Pinia store                    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Choices / Text / intimacy events
                               ▼
┌─────────────────────────────────────────────────────────────┐
│   AIRI app integration (RendererStage / dating-sim /        │
│   stage-tamagotchi & stage-web)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Executive Summary & Core Objective

Currently, AIRI's Live2D runtime relies on Cubism 4 SDK loaders (`pixi-live2d-display@0.4.0`) and does not route to the bundled Cubism 2 build, leaving older Cubism 2.0 models (`.moc`, e.g. the *BanG Dream!* series) unloaded. Advanced third-party Live2D models also contain rich interactive scripting (`VarFloats`, `Intimacy` bounds, `Choices` menus, `Command` chains) that is currently pruned to prevent WebGL runtime crashes.

This project delivers a **cleanroom, headless TypeScript DSL + state engine** (`@proj-airi/live2d-runtime`) that interprets that scripting independent of the renderer, then bridges it into the existing `stage-ui-live2d` host and the dating-sim/choice UI surfaces — **without** ripping out the fork's heavily customized Cubism 4 render layer.

---

## 2. Multi-Generation Rendering (relocated to the render host)

Cubism 2 + Cubism 3/4 unification lives in `packages/stage-ui-live2d`, not in the headless runtime. The latent bugs upstream PR #2197 addressed remain the porting checklist:

### 2.1 Timing Unit Normalization
* **Problem:** Cubism 2 passes timestamps in **milliseconds**; Cubism 4 passes **seconds** (`dt /= 1e3`). Off-by-1000× breaks `beatSync` and `eyeBlink`.
* **Solution:** Normalize all internal timings to milliseconds once inside `useLive2DMotionManagerUpdate`.

### 2.2 Single-Owner Focus Controller (Idle Eye Gaze)
* **Problem:** Direct writes to `ParamEyeBallX/Y` clash with `focusController`, double-integrating spring physics.
* **Solution:** `focusController` is the sole owner of eye gaze.

### 2.3 Expression Rest / Neutral Value System
* **Problem:** Default blend values broke additive (`Add`, rest `0`) vs multiplicative (`Multiply`, rest `1`) toggles.
* **Solution:** Assign neutral rest values by parameter blend mode in the expression controller.

### 2.4 Eye Smile Standard Parameters
* **Problem:** Non-standard `ParamEyeSmile` failed on standard models.
* **Solution:** Split eye-smile updates into dedicated `ParamEyeLSmile` / `ParamEyeRSmile` watchers.

---

## 3. Component: Live2D DSL Virtual Machine (`VarFloats` Engine)

Extracted from real manifests in [`live2d-special-sauce-insights.md`](./live2d-special-sauce-insights.md). **Recon found the original schema under-specified**; the runtime implements the full observed superset.

### 3.1 State Heap Schema
```typescript
export interface VarFloatCondition {
  Name: string
  Type: 1 // Guard Condition
  Code: string
}

export interface VarFloatMutation {
  Name: string
  Type: 2 // State Mutation
  Code: string
}

export type VarFloat = VarFloatCondition | VarFloatMutation
```

**Operator superset (observed in the wild, must all be supported):**
- **Type 1 (guards):** `equal`, `not_equal`, `greater`, `greater_equal`, `less`, `lower`, `lower_equal`.
- **Type 2 (mutations):** `assign <n>`, `assign rand(min,max)` (inclusive integer), `add <n>`, `subtract <n>`, `init <n>` (**set only-if-absent** — used pervasively for the flag/date heap).

**Entry semantics:** an interaction entry is `(guard… mutation…)` applied **atomically**: every Type 1 guard must pass before any Type 2 mutation executes (toggle idiom: `{Type:1 not_equal 1},{Type:2 assign 1}`).

### 3.2 Command Queue & Macro Dispatcher
Parses `;`-delimited command chains from `Command`/`PostCommand` fields. **Lane/layer hints** `Group#priority:name` must be parsed (the `#N`/`#98`/`#99` are priority/lane markers, not part of the name; `:` separates group from item).
* `start_mtn <group>:<name>` — enqueue motion + audio on parallel lanes (Body, `Sound#1` voice, `Face#2` expression).
* `change_cos <model_file>` — hot-swap costume/manifest **while preserving the VarFloats heap**.
* `clear_exp` — reset persistent expression overrides.
* `motions enable/disable <group>` — idle/motion pool gating.
* `mouse_tracking enable/disable` · `eye_blink enable/disable` — feature toggles.
* `stop_sound <channel>` — channels observed: `0` voice, `1` BGM, `2` ENV.
* `replace_tex <index> <file>` — runtime texture swap.
* `Command` fires at motion start; `PostCommand` fires after the entry resolves.

### 3.3 Intimacy & Time-Based Logic
* **Intimacy gating:** per interaction (`{"Intimacy":{"Min":80,"Bonus":1}}`). `Min`/`Max` gate; `Bonus` is a reward written back to a **persistent intimacy provider** on success. Among passing entries, selection is **weighted** by `Weight`.
* **Two state scopes:** **model-local heap** (ephemeral `Map<string,number>`) vs **persistent intimacy** (injected `IIntimacyStore`; e.g. dating-sim variables). The runtime defines the interface, not the store.
* **Seasonal / time gating:** `{"TimeLimit":{"Month":6,"Sustain":92160}}`.
* **Template interpolation:** `{$vi_X}`, `{$vf_X}` (heap reads), `{$intimacy}`, `{$timenow}`, `{$br}` (line break).

---

## 4. Phase-by-Phase Implementation Plan

### Phase 1: Headless DSL VM + Vitest Suite (DONE — see §4.2)
1. Scaffold `packages/live2d-runtime` (`@proj-airi/live2d-runtime`) as pure TS; add to `pnpm-workspace`/Vitest `projects`. Wire `typecheck`.
2. Implement `dsl/` (types, var-store, command-parser, selector, template, interpreter) and `ports.ts` interfaces.
3. Isolated Vitest suite built directly from [`live2d-dsl-test-cases-handoff.md`](./live2d-dsl-test-cases-handoff.md) and `live2d-special-sauce-insights.md` fixtures: operator superset, atomic guard→mutate toggles, `assign rand(20,25)`, OpenChat toggle, Flandre `Tapbody` intimacy ladder, weighted `Update7#98` Intimacy→IntimacyVI mapping, `change_cos` heap-preservation.

### Phase 2: Multi-Gen Cubism Adapter (render host) — PARTIAL
1. ⏳ Route Cubism 2 `.moc` manifests to the vendored `cubism2` entry; union-type `Cubism2InternalModel | Cubism4InternalModel`. **DEFERRED** — not yet wired into `Model.vue`'s loader; `change_cos` is upstream-blocked (ingestion split), so `.moc` routing is a follow-up.
2. ⏳ Normalize timing to ms at the motion-manager hook; port §2.2–§2.4 (focus ownership / expression rest values / eye-smile split). **NOT STARTED** — present behavior inherits the host's existing cubism4 paths.
3. ✅ Implement `Live2DRuntimeAdapter` (ports over `motionManager` + `useLive2d` store) + `dsl-capture` (raw `FileReferences.Motions` → `DslMotionGroup[]` pre-sanitize, hooked into `ZipLoader.createSettings`). **DONE.**

### Phase 3: AIRI Application Integration (DONE — see §4.2)
1. Subscribe `RendererStage` / dating-sim to Choices, Text, and intimacy-change events; render choices in the existing stage overlay.
2. Verify backward compatibility with existing character cards and Cubism 4 models.

### Phase 4: Standalone Web Playground Page & Monorepo Alias Resolution
1. **Integration Preservation Note**: The full AIRI stage integration work (wired in commits [`7727a13a6`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue) and [`c11bb292d`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-live2d/src/stores/dsl-intimacy.ts)) remains safely recorded in Git history.
2. **Standalone Web Playground App**: Create an isolated web preview page (`apps/stage-live2d-playground` or `/playground/live2d` route) dedicated exclusively to:
   - Drag-and-dropping Live2D `.zip` / `.lpk` packages into a clean, lightweight WebGL canvas runner.
   - Inspecting the `VarFloats` state heap in real-time.
   - Exercising interactive choice menus and intimacy triggers in isolation without loading full AIRI app overhead or clobbering live user settings.
3. **Vite Monorepo Import Resolution**: Add `@proj-airi/live2d-runtime` workspace path aliases to Vite configuration files (`apps/stage-tamagotchi/electron.vite.config.ts`, `apps/stage-web/vite.config.ts`) so Vite resolves `@proj-airi/live2d-runtime` directly to TypeScript source (`packages/live2d-runtime/src/index.ts`) in dev mode.

---

## 4.2 Progress Log

| Phase | Status | Key artifacts |
| :--- | :--- | :--- |
| **1** Headless DSL VM + Vitest | ✅ Landed (`cec8a0f71`) | `packages/live2d-runtime/` — `ReactiveVarStore`, `command-parser`, `selector`, `template`, `DSLVirtualMachine`; 78/78 tests; typecheck clean |
| **2** Multi-gen adapter | 🟡 Partial (`7e3d790b0`) | `Live2DRuntimeAdapter` + `dsl-capture` + VM wiring in `Model.vue`. `.moc` routing + timing normalization deferred |
| **3** App integration (choices+intimacy) | ✅ Landed (`7727a13a6`, `c11bb292d`) | `live2d-dsl-bridge` choice round-trip + `dsl-intimacy` raw store (0–100k→0–100 display projection). Integration preserved via git commits |
| **3.x** change_cos hot-swap | ⏸️ Deferred | Awaits unified multi-`.moc3` ingestion (see challenge doc) |
| **4** Standalone Web Playground | 📋 Planned | Dedicated WebGL playground runner for Live2D zips + `VarFloats` inspector + Vite workspace alias configuration |

_Notable implementation fixes during build: lane-hint dispatch shadowing (caught by test); useBroadcastChannel has no `onMessage` (use `watch` on `data`); `resolveMotionGroupAndIndex` isn't exported on `useLive2d` — adapter resolves on `motionManager` directly to avoid double-broadcast._

---

## 5. Verification & Testing Strategy

- **Automated Unit Tests:** `pnpm -F @proj-airi/live2d-runtime test` must pass 100% of VarFloats, command-parser, selection, and tick tests (headless, no browser).
- **Typecheck:** `pnpm -F @proj-airi/live2d-runtime typecheck`.
- **Manual Verification (Phase 2–3):**
  - Load legacy Cubism 2.0 `.moc` model (e.g. *BanG Dream!*).
  - Load an advanced third-party model with `VarFloats`/`Choices` metadata.
  - Verify eye blink, beat sync, idle gaze in `stage-tamagotchi`.
