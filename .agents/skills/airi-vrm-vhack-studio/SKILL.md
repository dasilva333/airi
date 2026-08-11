---
name: airi-vrm-vhack-studio
description: "Use when working with working on V-HACK DevTools, Live VRM Binary Modding Studio, Texture Deck hot-swapping, glTF repacking, and in-memory VRM material inspection."
---
# Airi VRM V-HACK Studio

## 1. Overview & Surface Map

- **Components:** `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/HackerPanel.vue`
- **Stores:** `packages/stage-ui/src/stores/vhack.ts`
- **Documentation:** `docs/vhack-design-doc.md`

## 2. Key Code Paths

- `docs/vhack-design-doc.md`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/HackerPanel.vue`
- `packages/stage-ui/src/stores/vhack.ts`

## 3. Core SOPs & Guidelines

- **In-Memory Inspector:** Use `HackerPanel.vue` and `vhack.ts` to manage in-memory Three.js VRM material properties (e.g., `_RimWidth`, `_ShadeShift`).
- **Texture Hot-Swapping:** Implement texture replacement via the Texture Deck safely, ensuring memory is freed for replaced textures.
- **GLB Repacking:** When modifying glTF JSON, handle byte-level GLB repacking with care to avoid corrupting the binary buffer.
- **AI UV Generation:** Ensure Artistry integrations correctly map generated UVs back onto the Three.js mesh.

## 4. Known Pitfalls & Failure Modes
### 4. Known Failure Modes & Pitfalls

- **VRAM Leaks:** Failing to dispose of old Three.js materials or textures during a hot-swap.
- **Binary Corruption:** Incorrectly calculating chunk offsets when repacking a GLB.
- **UI Stalls:** Performing heavy binary serialization synchronously on the main thread instead of a Web Worker.

## 5. Verification Workflows

- `pnpm -F <workspace> typecheck` to ensure valid Three.js and VRM typings.
