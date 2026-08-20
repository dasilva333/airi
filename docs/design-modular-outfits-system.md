# Design: Modular Outfits & Accessories System

## Overview
The Modular Outfits system replaces the legacy "Single Favorite Expression" toggle with a flexible, grid-based management interface. It allows users to group character expressions and parameters into named bundles that can be toggled through the [Control Island](./design-stage-ui-context-bridge-control-island.md).

## Technical Implementation Index

### 1. Data Layer (The Schema)
**File**: [packages/stage-ui/src/types/card.schema.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/types/card.schema.ts)
- **Requirement**: Extend `AiriExtensionSchema` to include an `outfits` array.
- **Structure**:
```typescript
export interface AiriOutfit {
  id: string
  name: string
  icon: string // Iconify identifier
  type: 'base' | 'overlay' // Base = Exclusive, Overlay = Additive
  expressions: Record<string, number> // Weights for specific blendshapes
}
```

### 2. State Logic (The Store)
**File**: [packages/stage-ui/src/stores/modules/airi-card.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/modules/airi-card.ts)
- **Logic**: Implement `applyOutfit(id: string)`.
- **Base Switch**: If `type === 'base'`, the store must iterate through the current `activeExpressions` and set any expression found in *other* base outfits back to 0 before applying the new values. This ensures that switching from "Dress" to "Suit" doesn't leave lingering blendshapes active.
- **Overlay Switch**: If `type === 'overlay'`, it simply toggles the expressions on top of the current state.

### 3. Management UI (The Settings Editor)
**Primary Coordinator**: [packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue)
**The Expression List**: [packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-expressions.vue)
- **Addition**: Add a "Wardrobe Management" section at the top of the expressions tab.
- **Interaction**: Allow expressions from the lists to be "Long Pressed" or "Dragged" into one of 9 destination slots to create a bundle.

### 4. Interactive UI (The Island)
**File**: [apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-tamagotchi/src/renderer/components/stage-islands/controls-island/index.vue)
- **State**: The `view` state is expanded to include `'wardrobe'`.
- **Layout**: A 3x3 `overflow-y-auto` container followed by a fixed utility row for filtering.
- **Visual Feedback**:
  - `Base`: Solid amber background.
  - `Overlay`: Blue ring/outline highlight.

## Core Logic: Exclusive vs. Additive

> [!IMPORTANT]
> When a user selects a **Base** outfit, the system works as a "Net Zero" transition. It looks up the model's currently active expressions and aggressively zeroes out any that are part of the "Outfit" category before applying the new selected pattern. This prevents "overlapping clothes" artifacts on VRM models.

> [!TIP]
> **Overlay** accessories (like Glasses or Blushing) ignore other active states. They are additive layers designed for modularity.

## Status
- **Phase 1: Mock UI**: Functional mock injected into `ControlsIsland` using random categorization of existing expressions. (Completed 2026-03-29).
- **Phase 2: Schema Migration**: Updating `card.schema.ts` and initializing `outfits` for existing cards. (Planned).
- **Phase 3: Logic Engine**: Implementing the exclusive-zeroing logic in `airi-card.ts`. (Planned).

## Relevant Skills

- [[airi-modular-outfits-system]]
