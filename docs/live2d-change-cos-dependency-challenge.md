# Architectural Design Challenge: The `change_cos` Dependency Bottleneck

## 📌 Context & Scope
This document addresses a critical architectural conflict discovered during the design phase of the **Live2D DSL Interpreter Engine** for AIRI. It acts as an open design question and must be resolved before proceeding with the implementation of the interpreter.

For background details on the interactive DSL triggers and original creator structures, refer to:
*   [Live2D DSL Interpreter Specification](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/live2d-dsl-interpreter-spec.md)
*   [Live2D Custom Animation & Expression Insights (Special Sauce)](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/live2d-special-sauce-insights.md)

---

## ⚠️ The Core Conflict
The interactive Live2D models downloaded from Steam Workshop (such as the *SoulTide Collection* and *Alice*) achieve costume swapping and stance transitions dynamically via the custom `change_cos <manifest>.json` command.

Under standard Live2DViewerEX rendering, this command swaps the underlying skeleton file (`.moc` or `.moc3`) on the fly within a single viewport wrapper. However, AIRI introduces two major limitations:
1.  **No Cubism 1/2 Support**: AIRI does not support legacy `.moc` formats.
2.  **Split-on-Import Design**: When importing a ZIP package containing multiple `.moc3` skeletons (e.g. 5 costumes and their variations), AIRI's importer automatically splits each `.moc3` configuration into a **separate, standalone model** in the library.

---

## 🔍 Why `change_cos` is a Core Dependency
At first glance, it might seem like `change_cos` is an optional feature that can be bypassed while still implementing "standalone" menus, chat interactions, and gifts. In practice, however, it represents a core dependency bottleneck:

### 1. Mesh & Collider Coupling (Hit Areas)
Tapping interactions and menus are bound to specific `hit_areas` (colliders) mapped directly to vertices in the `.moc3` file:
```json
"hit_areas": [
  {"name": "head", "id": "D_FACE.00"},
  {"name": "menu", "id": "D_HAIR_BACK.04"}
]
```
If a costume swap command fails to change the model, the user remains on the old model, but the interpreter may try to read hit areas or trigger motions that do not exist or have different mesh IDs on the active skeleton.

### 2. Motion File Incompatibility
Motions (`.motion3.json`) are compiled for a specific skeleton's parameter IDs. Running a motion designated for Costume B on Costume A's skeleton results in static/broken animations or visual glitches.

### 3. Menu Gating & State Divergence
Because menus (such as gift preferences, date dialogs, and pose lists) are loaded from the active `.json` manifest, staying on a single model configuration while the underlying state changes creates a divergence where the menu text and commands mismatches the active character costume.

---

## 🛠️ Proposed Architectural Paths

To address this dependency issue, two primary options are proposed:

### Option A: The Lookup Mapping & Actor Token Bridge
*   **Concept**: Keep the split-on-import behavior where each costume is a standalone model.
*   **Mechanism**:
    1.  During import, build an internal mapping table connecting the file IDs (e.g., `model0.json` to `model6.json`) to AIRI's newly generated standalone display IDs.
    2.  Rewrite the `change_cos` interpreter commands at runtime to act as a **higher-level Actor Swap trigger** (switching the active `<|ACTOR|>` model).
    3.  Persist variables (`VarFloats`) and intimacy levels globally so they carry over when the actor model is hot-swapped.
*   **Pros**: Doesn't require changing the core importer architecture.
*   **Cons**: Actor swapping incurs viewport loading overhead (re-allocating PIXI canvases), which may lack the sub-second transition speed expected by the original designs.

### Option B: Unified Multi-Skeleton Model Imports
*   **Concept**: Modify the importer to recognize multi-skeleton ZIP packages as a single unified asset.
*   **Mechanism**:
    1.  At import time, detect if multiple `.moc3` files share a parent directory or are cross-referenced via `change_cos` within the same archive.
    2.  Import them as a single model pack containing a library of sub-models.
    3.  Provide the canvas rendering viewport with the ability to dynamically hot-swap `.moc3` files and texture atlases in WebGL memory on the fly.
*   **Pros**: Highly accurate to the original creator specs, visually seamless costume transitions.
*   **Cons**: Significant development overhead in the importer and WebGL staging container.

## Relevant Skills

- [[airi-live2d-dsl-interpreter]]
