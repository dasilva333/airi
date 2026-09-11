---
name: airi-modular-outfits-system
description: >-
  Implement/debug card-level outfits, AiriExtension costume variants, visual-asset manifestations, Live2D/VRM outfit switching. Mesh wardrobe authoring uses airi-model-customizer; Live2D change_cos VM internals use airi-live2d-dsl-interpreter.
---

# AIRI Modular Outfits & Costumes System

This skill provides comprehensive technical guidelines and exact code paths for managing character costume variants, outfit switching, and visual asset manifestations in AIRI.

## 1. Overview & Surface Map

Character outfits represent distinct visual costume variants (e.g. casual wear, school uniform, formal attire) tied to a character card:
- **Card Schema**: Stored in the `outfits` array within `AiriExtension` (`card.schema.ts`).
- **Manifestation Mapping**: Maps an outfit ID to specific model variants (`displayModelId`) or costume textures (`change_cos`).
- **Runtime Propagation**: Switching active outfit in `airi-card.ts` triggers model parameter updates across Three.js and Live2D renderers.

## 2. Key Code Paths

### Card Schema & Store
- `packages/stage-ui/src/types/card.schema.ts` — `AiriOutfit` Valibot schema definition (`id`, `name`, `description`, `displayModelId`, `visual_assets`).
- `packages/stage-ui/src/stores/modules/airi-card.ts` — `useAiriCardStore`. Manages active character card and outfit switching actions.

### 3D Mesh Wardrobe & Stage-Mate Parity
- `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue` — Outfits tab (Wardrobe Builder) and `WardrobeMeshTreeNode.vue`.
- `packages/stage-ui-three/src/components/Model/VRMModel.vue` — `buildMeshHierarchy` (multi-primitive submesh discovery and `userData.cleanName` tagging).
- `packages/stage-ui-three/src/stores/model-store.ts` — `applyMeshVisibility` (strict primitive submesh matching without ancestor false-positives).
- `apps/stage-mate/unity-src/Patches/VRMLoader/VRMLoader.cs` — `SplitMultiSubmeshRenderers` (splits multi-primitive meshes into indexed child GameObjects with `BlendShapeSync`) and strict 1:1 `IsMeshMatch`.

### Related Specs & RFCs
- `docs/proposal-visual-state-outfit-hook.md` — Specification for visual state outfit hooks.
- `docs/proposal-visual-state-outfit-hook-evolution.md` — Evolution design doc for multi-costume triggers.
- `docs/design-live2d-multimoc-changecos.md` — Architectural spec for Live2D `.moc3` costume hot-swapping.
- `docs/design-vrm-outfits.md` — VRM modular outfits & mesh wardrobe architecture (mesh probing, `.me` vs `.vrm` reverse engineering, WebGL/Unity parity).

## 3. Core SOPs & Guidelines

### 1. Defining Outfits on a Character Card
1. Add an entry to `card.extensions.airi.outfits` array containing `id`, `name`, and `displayModelId`.
2. Specify optional costume parameter overrides or texture manifests.

### 2. Switching Active Outfit
- Call `airiCardStore.setActiveOutfit(outfitId)`. The store propagates the change to `displayModelsStore` and the active renderer stage.

### 3. 3D Mesh Wardrobe & Multi-Primitive Submesh Rules
1. **glTF Primitives vs Nodes**: In VRM models, nodes may reference meshes with multiple primitives (e.g. `body_top.baked` with 3 primitives). Three.js unpacks these as child meshes under a Group. `VRMModel.vue` names them `${parentCleanName}_${primIndex}` (e.g. `body_top_0`, `body_top_1`, `body_top_2`).
2. **Strict Targeting Invariant**: When targeting an indexed mesh (`body_top_1`), `applyMeshVisibility` must NEVER climb to parent containers to prevent sibling collapsing.
3. **Unity Parity (`VRMLoader.cs`)**: On model load, `SplitMultiSubmeshRenderers` dynamically separates multi-submesh `SkinnedMeshRenderer`s into child GameObjects so `MEClothes.SetActive(false)` can toggle exact sub-parts without loose `StartsWith` heuristics.

## 4. Known Pitfalls & Failure Modes

- **Not a Standalone Store**: Outfits do NOT have a separate Pinia store. They ride on the character card schema (`card.schema.ts`) and rendering engines (`stage-ui-three`, `stage-ui-live2d`). Always modify outfit state via `airi-card.ts`.
- **Greedy Prefix Matching**: Never use `StartsWith` matching for mesh names in Unity or Three.js (`"cloth"` must not match `"cloth1"`, `"cloth2"`, or `"cloth_ribbon"`).
- **Suffix Collapsing**: Do not strip `_\d+` suffixes when normalizing mesh names; stripping them collapses distinct submesh primitives into their parent group.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Stage-Mate C# Build**: `pnpm -F @proj-airi/stage-mate run engine:setup && pnpm -F @proj-airi/stage-mate run build:mac`

### Authoritative Design & Architecture Documents

- [docs/proposal-visual-state-outfit-hook.md](docs/proposal-visual-state-outfit-hook.md) — Visual state outfit hook proposal.
- [docs/proposal-visual-state-outfit-hook-evolution.md](docs/proposal-visual-state-outfit-hook-evolution.md) — Visual state outfit hook evolution design.
- [docs/design-live2d-multimoc-changecos.md](docs/design-live2d-multimoc-changecos.md) — Live2D multi-moc3 change_cos design.
- [docs/design-modular-outfits-system.md](docs/design-modular-outfits-system.md) — Modular outfits system design.
- [docs/design-vrm-outfits.md](docs/design-vrm-outfits.md) — VRM modular outfits & mesh wardrobe architecture.
- [docs/design-airi-card.md](docs/design-airi-card.md) — AIRI card design (packages, manifestations, visual assets).

## Related Skills & References

- **Key Documents**: [[proposal-visual-state-outfit-hook]], [[proposal-visual-state-outfit-hook-evolution]], [[design-live2d-multimoc-changecos]], [[design-vrm-outfits]], [[design-modular-outfits-system]], [[design-airi-card]]

