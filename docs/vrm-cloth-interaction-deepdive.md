# VRM Surgical Evolution: Landmark Timeline & Deep-Dive

This document memorializes the architectural evolution of the AIRI VRM pipeline, specifically focusing on the 24-hour breakthrough that stabilized "Merged Mesh" surgery and "Megazord" expression discovery.

## 🕒 The Landmark Timeline

| Date | Milestone | Key Commit | Outcome |
| :--- | :--- | :--- | :--- |
| **March 30** | **V-HACK Genesis** | `v0.9.0-pre` | First appearance of the Hacker Panel + Texture Uploading. |
| **April 3-4** | **Surgical Origins** | `046c96ad7` | First attempts at "Permanent Hiding." Used the `delete mesh` strategy. |
| **April 12** | **Megazord Birth** | `e5ba2abd2` | Introduced **Dynamic Expression Discovery**. Unlocked raw morph targets for the UI. |
| **April 15** | **The Gura Breakthrough** | `HEAD + Fix` | Solved the "Dangling Reference" crash with **Primitive-Aware Surgery**. |

---

## 🏗️ Technical Architecture: The Final Solution

### 1. The Fuzzy Matcher (Surgical Precision)
**Problem**: Three.js renames scene nodes (e.g., `Body` becomes `Body_1`) while the GLTF JSON keeps the original name.
**Solution**: We implemented a **Dual-Layer Fuzzy Matcher**. It normalizes names, strips numeric suffixes, and checks both `node.name` AND `mesh.name` to find the exact GLTF index.
**File**: [HackerPanel.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/components/scenarios/settings/model-settings/vrm-vhack/HackerPanel.vue) -> `getGltfNodeIndex()`

### 2. Primitive-Aware Surgery (The "Gura Fix")
**Problem**: In merged models (Gura, Dragon Girls), hiding a "Sleeve" in the UI often hides the whole "Body" in the JSON because they share a node.
**Solution**: **Transparent Material Injection**.
- Instead of scaling the node to `0`, we identify the specific **Primitive Index**.
- We inject a hidden material (`VHACK_HIDDEN`) into the GLTF.
- We re-assign ONLY the target primitive to that invisible material.
- The node remains at `Scale: 1`, keeping bone logic and expressions alive.

### 3. Megazord Discovery (The "Dynamic Unlock")
**Problem**: Many modern models have 50+ expressions that standard VRM loaders ignore.
**Solution**: A discovery loop inside the core loader that scans every mesh for "lost" morph targets and registers them as official `VRMExpression` objects on-the-fly.
**File**: [core.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui-three/src/composables/vrm/core.ts) -> `loadVrm()`

---

## 💣 Key Tripmines (Future-Proofing)

> [!CAUTION]
> **The `every()` Crash**: Never `delete` a mesh reference from a GLTF node if that node is used in a VRM `blendShapeBind`. The pixiv-three-vrm loader will throw a fatal `TypeError` during its `every()` check. **Always use the Transparent Material strategy for merged models.**

> [!WARNING]
> **Three.js Suffixes**: When searching for nodes, always strip `_1`, `_2`, etc. These are not in the file; they are injected by the Three.js GLTFLoader during sub-mesh splitting.

> [!NOTE]
> **Expression Bind Types**: Between `three-vrm` v0.x and v3.x, the `addBind` API changed. If `mesh` property fails, use `new VRMExpressionMorphTargetBind({ primitives: [mesh], ... })`.

---

## 📂 Key File Map
- **UI Logic**: `packages/stage-ui/.../vrm-vhack/HackerPanel.vue` (The Brain)
- **Core Loader**: `packages/stage-ui-three/.../vrm/core.ts` (The Discovery)
- **Expression Management**: `packages/stage-ui-three/.../vrm/expression.ts` (The Sync)
- **Visibility State**: `packages/stage-ui/src/stores/vhack.ts` (The Mirror)

---
**Status**: `Verified Stable on HEAD (3534e29db)`

## Relevant Skills

- [[airi-character-rendering]]
