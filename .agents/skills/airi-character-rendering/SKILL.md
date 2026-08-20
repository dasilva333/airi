---
name: airi-character-rendering
description: >-
  Use when rendering, loading, or debugging 3D & 2D avatar display models in AIRI (VRM, Live2D, Spine, MMD), Three.js rendering pipelines, ModelCustomizer capability exploration, expression mappings, parameter controls, motion triggers, displayModelsStore binary fetching, or display model schema definitions.
---

# AIRI Character Rendering & Avatar Capabilities Engine

This skill provides comprehensive guidelines, architectural mental models, exact code paths, and debugging procedures for rendering, configuring, and interactively or programmatically activating 2D and 3D avatar capabilities (expressions, blend shapes, motions, and skeletal animations) across AIRI's modular packages.

---

## 1. Required Reading & Canonical Architecture Documents

Before modifying expression systems, rendering loops, or model customization UI, read these foundational documents:

- **[`docs/design-model-customizer.md`](docs/design-model-customizer.md)** — **Canonical design for interactive model capability exploration**:
  - Defines the strict boundary between **`ModelCustomizer.vue`** (zero-side-effects capabilities explorer, transient click-to-preview, rename/visibility/favorite/cycle toggles) and parent containers like **`chat_rehearsal.vue`** (sandbox dialogue, LLM generation, backup file download, prompt injection) and settings panels (`vrm.vue`, `live2d.vue`, `mmd.vue`, `spine.vue`).
- **[`docs/design-act-token-expression-system.md`](docs/design-act-token-expression-system.md)** — **3-Layer Expression Architecture**:
  - *Layer 1 (Raw Geometry/Mesh)*: Underlying morph targets / Live2D parameter IDs.
  - *Layer 2 (Preset Transition Engine)*: `useVRMEmote` / `Live2DStageManager` cubic easing, duration blending, and non-destructive additive layering.
  - *Layer 3 (Semantic ACT Mapping)*: User-configurable VRM expression $\to$ ACT emotion slot bindings (`emotionMappings`) and LLM `<|ACT:emotion="..."|>` cue tokens.
- **[`docs/design-vrm-animation-ecosystem.md`](docs/design-vrm-animation-ecosystem.md)** — VRM animation mixer, MToon shader injection, bone retargeting, and runtime hooks.
- **[`docs/rosetta-stone.md`](docs/rosetta-stone.md)** — Canonical concept-to-path index (§13 BroadcastChannel registry, §16 binary-proxy safety).
- **[`docs/research-vrm-cloth-interaction.md`](docs/research-vrm-cloth-interaction.md)** — VRM cloth tugging, spring bones, and tactile interaction expressions.

---

## 2. Overview & Surface Map

AIRI supports 4 primary display model formats across dedicated packages under `packages/`:
- **VRM (3D)**: Three.js rendering pipeline via `@pixiv/three-vrm` in `@proj-airi/stage-ui-three`.
- **Live2D (2D)**: Canvas & WebGL Cubism pipeline via `pixi-live2d-display` and the Live2D Scripting DSL VM adapter in `@proj-airi/stage-ui-live2d`.
- **Spine (2D)**: 2D skeletal animation rendering via Spine WebGL runtime in `@proj-airi/stage-ui-spine`.
- **MMD (3D)**: MikuMikuDance model/motion pipeline via Three.js MMDLoader in `@proj-airi/stage-ui-mmd`.

Model binary assets (GLB/VRM, moc3 ZIP, Spine json/atlas, PMX/VMD) are cached and indexed via `displayModelsStore` in `packages/stage-ui/src/stores/display-models.ts`.

---

## 3. Key Code Paths

### A. Rendering Surfaces (The Stage)
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` — Main 3D VRM rendering surface (Three.js scene, camera, MToon material bindings, bone transforms, expressions, emotion watch sync).
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` — Main Live2D rendering surface (PixiJS canvas, Cubism motion/expression controllers, DSL VM integration).
- `packages/stage-ui-spine/src/components/scenes/spine/Model.vue` — Main 2D Spine rendering surface.
- `packages/stage-ui-mmd/src/components/scenes/MMD.vue` — Main 3D MMD rendering surface.
- `packages/stage-ui/src/components/scenes/RendererStage.vue` — Unified stage component that mounts the appropriate model component based on active card `displayModelId`.

### B. Interactive Activation & Capabilities Customizer
- `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` — Universal model capabilities explorer component used across settings panels and rehearsal sandboxes:
  - Lists raw model blend shapes / expressions and animations / motions directly from indexed metadata (`displayModelsStore`).
  - Triggers transient previews on row clicks (`triggerExpressionEffect`, `triggerMotionEffect`).
  - Emits `@insert-token` when `showInsertActions=true` (for appending `<|ACT:...|>` or motion tokens to textareas).
  - Toggles favorites, visibility, and idle animation cycle inclusion.
- `packages/stage-ui/src/components/scenarios/settings/model-settings/`
  - `index.vue` — Main Model Settings container. Hosts the stage preview viewport and mounts the format settings panel for `stageModelSelected` (the previewed model). Passes `:model-id="stageModelSelected"` down to child panels.
  - `vrm.vue` & `vrm-expressions.vue` — VRM settings panel delegating expressions to `ModelCustomizer.vue`. Accepts `props.modelId` (previewed model) and falls back to `activeCard.displayModelId` only when unassigned.
  - `live2d.vue` & `live2d-customization.vue` — Live2D settings panel delegating to `ModelCustomizer.vue`.
  - `mmd.vue` — MMD settings panel delegating to `ModelCustomizer.vue`.
  - `spine.vue` — Spine settings panel delegating to `ModelCustomizer.vue`.
- `apps/stage-tamagotchi/src/renderer/components/chat/chat_rehearsal.vue` — Rehearsal Room acting sandbox embedding `ModelCustomizer.vue` with token insertion.

> [!IMPORTANT]
> **Previewed Model vs Active Character Card Model**:
> When a user browses models in Settings (`index.vue`), `stageModelSelected` contains the *previewed* model ID. Settings panels and `ModelCustomizer` MUST receive and use `props.modelId || stageModelSelected` so capability lists reflect the model currently rendered on screen, rather than locking to the unapplied `activeCard.displayModelId`.

### C. Services, Stores & Expression Engines
- `packages/stage-ui-three/src/composables/vrm/expression.ts` — `useVRMEmote`: Easing curves (`easeInOutCubic`), additive transitions, previous emotion fade-out tracking, intensity multipliers, and dynamic `addEmotionState`.
- `packages/stage-ui-three/src/stores/model-store.ts` — VRM state store (`useModelStore`), managing `activeExpressions` (manual weights), `emotionMappings` (VRM $\to$ ACT), and cross-window trigger dispatchers (`triggerEmotion`, `triggerMotion`) over `useBroadcastChannel({ name: 'airi-stores-live2d' })`.
- `packages/stage-ui/src/stores/display-models.ts` — Binary model catalog, IndexedDB persistence, and capability reflection.

---

## 4. Expression Activation Architecture & Data Flow

Expressions can be activated via three distinct pathways:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           1. Interactive UI Preview                         │
│  ModelCustomizer.vue (Row Click)                                            │
│    └─► triggerExpressionEffect(key)                                         │
│          └─► modelStore.triggerEmotion(key, 1.0) [BroadcastChannel]         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                           2. Chat / Acting Engine                           │
│  llm-marker-parser.ts / chat-session-store.ts                               │
│    └─► parsed <|ACT:emotion="happy"|>                                       │
│          └─► VRMModel.vue -> setExpression("happy", intensity)              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           3. VRM Execution Core                             │
│  VRMModel.vue                                                               │
│    ├── useVRMEmote (expression.ts)                                          │
│    │     ├─► Computes easeInOutCubic blend over blendDuration               │
│    │     ├─► Fades out previously managed expressions (additive safety)     │
│    │     └─► Updates vrm.expressionManager.setValue(name, weight)           │
│    └── watch(modelStore.activeExpressions)                                  │
│          └─► Manual persistent slider overrides from Settings UI            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Core SOPs & Guidelines

### 1. Adding Support for a New Display Model
1. Upload/register model metadata via `displayModelsStore.registerModel(model)`.
2. Save raw binary asset buffer to `displayModelsRepo` IndexedDB (`local:display-models`).
3. Bind the model's `id` to the character card's `displayModelId` in `airi-card.ts` or `AiriExtension`.

### 2. Triggering Expressions & Motions
- **Interactive UI Activation (`ModelCustomizer.vue`)**:
  - Expressions: invokes `triggerExpressionEffect(key)`:
    - **VRM**: dispatches `modelStore.triggerEmotion(key, 1.0)`.
    - **Live2D**: dispatches `live2dStore.triggerEmotion(key, 1.0)`.
    - **MMD**: sets `mmdStore.previewExpression`.
    - **Spine**: invokes `spineStore.selectVariantAndSkin`.
  - Motions: invokes `triggerMotionEffect(key)`:
    - **VRM**: dispatches `modelStore.triggerMotion(key)`.
    - **Live2D**: invokes `live2dStore.triggerMotion(key)`.
    - **MMD**: sets `mmdStore.previewMotion`.
    - **Spine**: invokes `spineStore.playAnimation`.
- **Programmatic / ACT Token Triggers**:
  - **VRM**: Call `VRMModel.vue` exposed `setExpression(name, intensity, resetMs)` or push expression presets via `expression.ts`.
  - **Live2D**: Call `dispatchDsl` or `selectDslChoice` exposed by `live2d/Model.vue` or trigger Cubism motions (`start_mtn`).

---

## 6. Known Pitfalls & Failure Modes

- **Vue 3 Binary Proxy Destruction**: NEVER wrap raw `ArrayBuffer`, `Blob`, or `VRM` instance objects in Vue `ref()` or `reactive()`. Passing Three.js scene graphs through Vue reactivity proxies will break WebGL buffer bindings. Store raw instances in plain JS variables or use `toRaw()`.
- **BroadcastChannel Mismatch**: `useModelStore` (VRM) and `useLive2d` communicate stage events over the channel configured in the store (`airi-stores-live2d`). If a window does not listen on the matching channel name, click-to-preview will fail silently across windows.
- **Additive Expression Collisions**: Never zero out all unmanaged expressions when activating a new emotion; doing so kills blink and lip-sync loops. Only fade out expressions in `previouslyManagedExpressions`.
- **WebGL Context Loss**: Destroying and re-mounting stage overlay windows can drop WebGL contexts. Always dispose Three.js geometries, textures, and PixiJS apps cleanly in `onUnmounted()`.

---

## 7. Verification Workflows

- **Typecheck**:
  - `pnpm -F @proj-airi/stage-ui typecheck`
  - `pnpm -F @proj-airi/stage-ui-three typecheck`
  - `pnpm -F @proj-airi/stage-ui-live2d typecheck`
  - `pnpm -F @proj-airi/stage-tamagotchi typecheck`

## Related Skills & References

- **Key Documents**: [[design-model-customizer]], [[design-act-token-expression-system]], [[design-vrm-animation-ecosystem]], [[rosetta-stone]], [[research-vrm-cloth-interaction]]
