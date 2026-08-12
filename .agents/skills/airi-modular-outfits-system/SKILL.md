---
name: airi-modular-outfits-system
description: >-
  Use when working with Character outfits in AiriExtension schema, Live2D/VRM costume variants, visual-asset manifestations, and outfit switching in card and renderer.
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

### Related Specs & RFCs
- `docs/proposal-visual-state-outfit-hook.md` — Specification for visual state outfit hooks.
- `docs/proposal-visual-state-outfit-hook-evolution.md` — Evolution design doc for multi-costume triggers.
- `docs/project-live2d-multimoc-changecos-design.md` — Architectural spec for Live2D `.moc3` costume hot-swapping.

## 3. Core SOPs & Guidelines

### 1. Defining Outfits on a Character Card
1. Add an entry to `card.extensions.airi.outfits` array containing `id`, `name`, and `displayModelId`.
2. Specify optional costume parameter overrides or texture manifests.

### 2. Switching Active Outfit
- Call `airiCardStore.setActiveOutfit(outfitId)`. The store propagates the change to `displayModelsStore` and the active renderer stage.

## 4. Known Pitfalls & Failure Modes

- **Not a Standalone Store**: Outfits do NOT have a separate Pinia store. They ride on the character card schema (`card.schema.ts`) and rendering engines (`stage-ui-three`, `stage-ui-live2d`). Always modify outfit state via `airi-card.ts`.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`

### Authoritative Design & Architecture Documents

- [docs/proposal-visual-state-outfit-hook.md](docs/proposal-visual-state-outfit-hook.md) — Visual state outfit hook proposal.
- [docs/proposal-visual-state-outfit-hook-evolution.md](docs/proposal-visual-state-outfit-hook-evolution.md) — Visual state outfit hook evolution design.
- [docs/project-live2d-multimoc-changecos-design.md](docs/project-live2d-multimoc-changecos-design.md) — Live2D multi-moc3 change_cos design.
- [docs/content/en/docs/advanced/architecture/design-modular-outfits-system.md](docs/content/en/docs/advanced/architecture/design-modular-outfits-system.md) — Modular outfits system design.
- [docs/airi-card-design.md](docs/airi-card-design.md) — AIRI card design (packages, manifestations, visual assets).
