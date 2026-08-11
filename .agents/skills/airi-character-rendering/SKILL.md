---
name: airi-character-rendering
description: >-
  Use when rendering, loading, or debugging 3D & 2D avatar display models in AIRI (VRM, Live2D, Spine, MMD), Three.js rendering pipelines, expression mappings, parameter controls, motion triggers, displayModelsStore binary fetching, or display model schema definitions.
---

# AIRI Character Rendering Engine

This skill provides comprehensive guidelines and exact code paths for rendering, configuring, and manipulating 2D and 3D avatar display models across AIRI's modular rendering packages.

## 1. Overview & Surface Map

AIRI supports 4 primary display model types across dedicated packages under `packages/`:
- **VRM (3D)**: Three.js rendering pipeline via `@pixiv/three-vrm`.
- **Live2D (2D)**: Canvas & WebGL Cubism pipeline via `pixi-live2d-display` and the Live2D Scripting DSL VM adapter.
- **Spine (2D)**: 2D skeletal animation rendering via Spine WebGL runtime.
- **MMD (3D)**: MikuMikuDance model/motion pipeline via Three.js MMDLoader.

Model binary assets (GLB/VRM, moc3 ZIP, Spine json/atlas, MMD pmx) are fetched, cached, and bound via `displayModelsStore` in `packages/stage-ui/src/stores/display-models.ts`.

## 2. Key Code Paths

### Core Store & Schemas
- `packages/stage-ui/src/stores/display-models.ts` — Display-model types (`DisplayModelFile`, `DisplayModelURL`, `DisplayModelFormat`) and Valibot schemas live here alongside the `displayModelsStore` Pinia store. Handles binary fetching, IndexedDB caching, and model registration.

### Rendering Components
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` — Main 3D VRM rendering surface (Three.js scene, camera, MToon material bindings, bone transforms, expressions).
- `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue` — Main Live2D rendering surface (PixiJS canvas, Cubism motion/expression controllers, DSL VM integration).
- `packages/stage-ui-spine/src/components/scenes/spine/Model.vue` — Main 2D Spine rendering surface.
- `packages/stage-ui-mmd/src/components/scenes/MMD.vue` — Main 3D MMD rendering surface.
- `packages/stage-ui/src/components/scenes/RendererStage.vue` — Unified stage component that mounts the appropriate model component based on active card `displayModelId`.

### Services & Utilities
- `packages/stage-ui-three/src/composables/vrm/expression.ts` — VRM expression execution/mapping (Joy, Angry, Sorrow, Fun, Blink).
- `packages/stage-ui-three/src/stores/model-store.ts` — VRM stage lighting, camera controls, and animation mixer state.

## 3. Core SOPs & Guidelines

### 1. Adding Support for a New Display Model
1. Upload/register model metadata via `displayModelsStore.registerModel(model)`.
2. Save raw binary asset buffer to `displayModelsRepo` IndexedDB (`local:display-models`).
3. Bind the model's `id` to the character card's `displayModelId` in `airi-card.ts` or `AiriExtension`.

### 2. Triggering Expressions & Motions
- **VRM**: Call `VRMModel.vue` expression methods or push expression presets (`happy`, `sad`, `surprised`) via `expression.ts`.
- **Live2D**: Call `dispatchDsl` or `selectDslChoice` exposed by `live2d/Model.vue` or trigger Cubism motions (`start_mtn`).

## 4. Known Pitfalls & Failure Modes

- **Vue 3 Binary Proxy Destruction**: NEVER wrap raw `ArrayBuffer`, `Blob`, or `VRM` instance objects in Vue `ref()` or `reactive()`. Passing Three.js scene graphs through Vue reactivity proxies will break WebGL buffer bindings. Store raw instances in plain JS variables or use `toRaw()`.
- **WebGL Context Loss**: Destroying and re-mounting stage overlay windows can drop WebGL contexts. Always dispose Three.js geometries, textures, and PixiJS apps cleanly in `onUnmounted()`.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Package Builds**:
  - `pnpm -F @proj-airi/stage-ui-three typecheck`
  - `pnpm -F @proj-airi/stage-ui-live2d typecheck`
