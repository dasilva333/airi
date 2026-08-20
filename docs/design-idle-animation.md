# Idle Animation Design & Reference Manual

> **Status**: Reference / design document. Source of truth for how idle animation is modeled, resolved, and played across AIRI (WebGL) and the Mate-Engine sidecar (Unity). If code and this doc disagree, code wins — fix the doc.

This document exists so the idle-animation knowledge isn't lost in chat. It covers: the two distinct idle mechanisms in AIRI, the data model (`acting.idleAnimations` vs per-visual-asset override), the control surface, the renderer playback semantics, and the planned Mate-Engine sidecar extension.

---

## 1. Terminology

| Term | Meaning |
| :--- | :--- |
| **Base idle** | A single, always-playing ambient animation (`vrmIdleAnimation` on WebGL). The fallback when no cycle is configured. |
| **Idle cycle** | A user-curated list of animations (`idleAnimations: string[]`) that the renderer rotates through automatically, picking randomly on each completion. |
| **Motion key** | A string identifier for an animation. Builtin keys are bare names (`idleLoop`, `armsSwing`); custom VRM animations are prefixed `custom-vrma:`; non-VRM formats are namespaced (`live2d:`, `spine:`, `mmd:`). |
| **Resolver** | The function that turns a motion key into a playable asset (a `.vrma` URL on WebGL, an `AnimationClip` in Unity). |

---

## 2. AIRI's two idle mechanisms (WebGL)

There are **two distinct concepts** that share the word "idle". Do not conflate them.

### 2a. Base idle — `vrmIdleAnimation` (single, per-model, cycler)

- **What**: one ambient animation that loops forever when no idle cycle is active.
- **Where**: `packages/stage-ui-three/src/stores/model-store.ts:161` — `vrmIdleAnimation`, a `useLocalStorage` ref keyed `settings/stage-ui-three/vrmIdleAnimation`, default `'idleLoop'`. Reset to `'idleLoop'` at `model-store.ts:185`.
- **Control surface**: the **"Idle Animations"** feature in the Control Strip (see `docs/catalog-control-strip.md` §2 "Actor & Wardrobe") is a **Cycler** — clicking rotates the selected base idle. Implemented in `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue`:
  - `isMotionActive` (`:771`) — highlights the active motion; for VRM, `motion.key === ''` means "no base idle", else `vrmIdleAnimation.value === motion.key`.
  - `playMotion` (`:821`) — `motion.key === ''` clears `vrmIdleAnimation` (and strips any non-VRM idle-cycle entries); otherwise selects the key.

### 2b. Idle cycle — `acting.idleAnimations` (list, per-card, auto-random)

- **What**: a `string[]` of motion keys the character treats as its idle pool. The renderer plays one at a time and, on completion, randomly advances (may repeat the same clip). This is the behavior being ported to Mate-Engine.
- **Where (data model)**: `packages/stage-ui/src/types/card.schema.ts:145-150`:

  ```ts
  acting: optional(looseObject({
    modelExpressionPrompt: string(),
    speechExpressionPrompt: string(),
    speechMannerismPrompt: string(),
    idleAnimations: optional(array(string())),
  })),
  ```

  Stored on the card at `extensions.airi.acting.idleAnimations`; default `[]` (`packages/stage-ui/src/stores/modules/airi-card.ts:871`).
- **Per-visual-asset override**: `visual_assets[*].manifestation` may carry its own `idleAnimations`, which wins over the card-level list. Resolution order in `packages/stage-ui/src/composables/use-idle-animations.ts:41-55` (`resolveActiveIdleAnimations`):
  1. If `activeModelId` matches a `visual_assets[*].manifestation.modelId` and that asset has `idleAnimations`, return it.
  2. Else return `card.extensions.airi.acting.idleAnimations`.

### Key insight

`vrmIdleAnimation` (base idle) and `acting.idleAnimations` (cycle) are **independent**. The cycle is what auto-rotates; the base idle is the single fallback/ambient. The Mate-Engine sidecar maps the **cycle** semantics (the list + random advance), not the base-idle cycler.

---

## 3. WebGL resolver & playback semantics (the reference behavior)

### Resolver

`packages/stage-ui-three/src/stores/custom-vrm-animations.ts`:
- `resolveAnimationUrl(key)` (`:166`): `null`/empty → `animations.idleLoop`; if key in `customAnimations` → its object URL; else try `custom-vrma:` prefixed lookup; else builtin `animations[key]`; else fallback `idleLoop`.
- Builtin registry: `packages/stage-ui-three/src/assets/vrm/animations/index.ts` — `idleLoop` (`idle_loop.vrma`), `armsSwing` (`arms_swing.vrma`), `armsUpDownDance` (`arms_up_down_dance.vrma`).
- `animationOptions` (`:183`) = builtin keys + custom (sorted newest first); this is what the Model Customizer UI lists as selectable motions.
- Custom animations are user-imported `.vrma` files persisted in IndexedDB (`custom-vrma-animation-{id}`), surfaced as object URLs; synced cross-window via BroadcastChannel `airi:custom-vrma-sync`.

### Renderer (`packages/stage-ui-three/src/components/Model/VRMModel.vue`)

- Props: `idleAnimation` (base), `idleAnimations` (cycle list) — declared at `:83-84`, passed from `RendererStage.vue` (`:415/:431/:466/:486`) which resolves them via `resolveActiveIdleAnimations`.
- `parseVrmCycleAnimations` (`:289-293`) filters cycle keys, dropping `live2d:`/`spine:` namespaced entries (non-VRM).
- `vrmCycleAnimationUrls` (`:295-298`) maps remaining keys through the resolver.
- **Base playback** `playBaseAnimation` (`:300-351`): loads the base clip, `LoopRepeat` infinity, cross-fade 0.8s, strips blendShape/expression tracks.
- **Cycle playback** `playNextIdleCycleAnimation` (`:353-424`):
  - Empty cycle → `playBaseAnimation()`.
  - **1 entry → loop that clip forever** (`LoopRepeat` infinity).
  - **N > 1 → `LoopOnce`, `clampWhenFinished = true`**; on `finished` event, advance.
- **Random advance** (`:363-372`): filter cycle to *other* clips (exclude current when alternatives exist), else fall back to full list — **so self-repeat is allowed when it's the only choice**. `Math.random()` picks the next.
- **Advance guard** (`onAnimationFinished` `:429-445`): a `cycleAdvancePending` flag + `setTimeout(0)` defers the next `playNextIdleCycleAnimation()` out of the Three.js mixer `update()` stack (calling `clipAction()`/`play()` synchronously from a `finished` event corrupts mixer state).
- Cross-fade duration is **0.8s** throughout.

### Model Customizer UI (`packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue`)

- `isMotionInCycle(key)` (`:546`) / `toggleMotionCycle(key)` (`:553`): toggles a motion key into/out of `acting.idleAnimations`, namespacing non-VRM keys with `{format}:` prefix; VRM keys are bare.
- So "idle pool" membership is edited here; the Control Strip Cycler edits the *base* idle.

---

## 4. Mate-Engine sidecar extension (✅ implemented)

Goal: mirror AIRI's **idle cycle** semantics in the Unity/VRM 0.x sidecar, driven over the WebSocket harness.

### Data & assets (the fork)

- The fork (`apps/stage-mate/mate-engine/`, gitignored) ships **162 `.anim` clips**, of which **35 are idle-relevant** under `Assets/MATE ENGINE - Animations/PET_IDLE/` (`PET_IDLE`, `PET_IDLE 1`, `PET_IDLE_2..22`, `PET_IDLE_NON_1`, `HUS_IDLE01..09`, `HUS_SITTING`, `HUS_DRAG`, `CUSTOM_DANCE`).
- **These are `.anim` (Unity `AnimationClip`) files, NOT `.vrma`.** `.vrma` is the VRM 1.0 animation format used only on the WebGL stack (`@pixiv/three-vrm-animation`); the fork contains zero `.vrma`. The current test model is **VRM 0.x**, which Unity plays via the `Animator` + humanoid avatar, not VRMA.
- Existing runtime clip-swap pattern mirrored: `Assets/MATE ENGINE - Scripts/AvatarHandlers/AvatarDancePlayer.cs` uses `new AnimatorOverrideController(defaultController)` + placeholder-state overrides (`:696`, `:710`).

### Implementation

- **Harness** (`apps/stage-mate/harness/index.ts`): env `MATE_IDLE_ANIMATIONS="PET_IDLE 1,PET_IDLE_2"`; on connect (and reconnect) emit `{ type: 'stage:vrm:idle', data: { idleAnimations: string[] } }`.
- **Unity** (`Assets/StageMate/MateSidecar.cs` + `MateSidecarBuild.cs`):
  - Build script bakes all 35 PET_IDLE clips into a serialized `IdleClipEntry[]` (name + `AnimationClip` + `loopTime`) on `MateSidecar`, and creates `StageMateIdleController.controller` with **two Idle states** (`IdleA`/`IdleB`) + placeholder clips. Two states are required for cross-fade (Unity's `Animator.CrossFade` blends *between states*); the sidecar ping-pongs the active state to cross-fade clips.
  - At runtime, `MateSidecar` wraps the base controller in an `AnimatorOverrideController` to swap the active clip (fork pattern).
  - `stage:vrm:idle` sets the idle pool (a `List<IdleClipEntry>`, arbitrary length) and (re)starts the cycle. Playback mirrors §3:
    - 1 entry → loop forever (relying on the clip's own `loopTime`).
    - N > 1 → play one, on completion pick next randomly (exclude current when alternatives exist, else fall back to full pool = self-repeat allowed), cross-fade **0.8s** (parity with AIRI).
  - **The two `IdleA`/`IdleB` states are a cross-fade mechanism, not a hard-coded 2-animation limit** — the pool is a list of arbitrary length, driven by the harness array.
  - Unknown keys → `Debug.LogWarning` + skipped (safe no-op fallback; never crashes).

### Test plan (harness-config-driven) — all passed

| Test | Harness config | Expected | Result |
| :--- | :--- | :--- | :--- |
| T1 | `MATE_IDLE_ANIMATIONS="PET_IDLE 1"` | App plays exactly that idle, looping. | ✅ |
| T2 | switch to a different single key | App meaningfully switches idle clip. | ✅ |
| T3 | `"PET_IDLE 1,PET_IDLE_2"` | After one finishes, next is picked randomly (self-repeat allowed). | ✅ (observed `PET_IDLE 1 → PET_IDLE_2 → …`) |

---

## 5. File path index

### AIRI (WebGL) — idle cycle & base idle

| Concern | Path |
| :--- | :--- |
| Card schema (`acting.idleAnimations`, `visual_assets`) | `packages/stage-ui/src/types/card.schema.ts` |
| Card store (default `idleAnimations: []`) | `packages/stage-ui/src/stores/modules/airi-card.ts:871` |
| Idle composable (resolver, per-asset override) | `packages/stage-ui/src/composables/use-idle-animations.ts` |
| Custom VRM animation store (`resolveAnimationUrl`, `animationOptions`) | `packages/stage-ui-three/src/stores/custom-vrm-animations.ts` |
| Builtin animation registry (`idleLoop`, etc.) | `packages/stage-ui-three/src/assets/vrm/animations/index.ts` |
| Model store (`vrmIdleAnimation` base idle) | `packages/stage-ui-three/src/stores/model-store.ts:161` |
| Renderer (base + cycle playback, random advance) | `packages/stage-ui-three/src/components/Model/VRMModel.vue` |
| Renderer prop passthrough | `packages/stage-ui-three/src/components/ThreeScene.vue` |
| Scene → renderer wiring (`resolvedIdleAnimations`) | `packages/stage-ui/src/components/scenes/RendererStage.vue` |
| Control Strip cycler (base idle select) | `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` |
| Model Customizer (cycle membership toggles) | `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` |
| Control Strip catalog (Idle Animations = Cycler) | `docs/catalog-control-strip.md` |

### Mate-Engine (Unity) sidecar

| Concern | Path |
| :--- | :--- |
| Idle clips (35) | `Assets/MATE ENGINE - Animations/PET_IDLE/*.anim` |
| Fork runtime clip-swap reference pattern | `Assets/MATE ENGINE - Scripts/AvatarHandlers/AvatarDancePlayer.cs` |
| Sidecar WS client + VRM loader + status dot + orbit | `Assets/StageMate/MateSidecar.cs` |
| Build script (scene + catalog + controller) | `Assets/StageMate/MateSidecarBuild.cs` |
| Mock harness | `apps/stage-mate/harness/index.ts` |

---

## 6. Known failure modes / gotchas

- **`.vrma` vs `.anim` confusion**: VRM 1.0 animations are `.vrma`; VRM 0.x plays Unity `.anim` clips through the `Animator`. The fork has only `.anim`. Do not attempt VRMA loading for VRM 0.x models.
- **Renderer loop completion on WebGL**: Three.js `finished` events must not synchronously trigger `clipAction()`/`play()` — use the `setTimeout(0)` deferral (see `VRMModel.vue:438-443`).
- **Two idles, two controls**: base idle (`vrmIdleAnimation`, Control Strip Cycler) ≠ idle cycle (`acting.idleAnimations`, Model Customizer toggles). The sidecar ports the cycle only.
- **Key namespacing**: non-VRM idle keys are `{format}:` prefixed (`live2d:`, `spine:`, `mmd:`); VRM keys are bare; custom VRM animations are `custom-vrma:`. The resolver handles the prefix fallback.
- **Clip asset name ≠ filename intuition**: the fork's idle clips use a *space* in the name (`PET_IDLE 1`), not `PET_IDLE_1`. Keys resolve against `AnimationClip.name` (asset name), case-insensitively; a mismatched key logs `idle clip not found in catalog` and is skipped.
