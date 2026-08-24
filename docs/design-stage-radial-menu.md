# Stage Radial Menu — Cross-Model Design & Architecture

This document defines the architecture, spatial anchoring, mathematical specification, and cross-model compatibility strategy for the **Stage Radial Menu** in AIRI.

The Stage Radial Menu is an in-scene, bone-tethered circular quick-action wheel that floats over the avatar's upper torso/chest. It provides instant, ergonomic access to the core stage viewport controls: window sizing presets, 9-point directional snapping, layer visibility (wallpaper vs. transparent passthrough, model toggle), stage minimization/hide, and multi-monitor routing—all structured as a **pure nested radial pie menu hierarchy**.

---

## 1. Lineage & Sourcing

The Stage Radial Menu synthesizes two proven technical architectures:

1. **Stage-Mate's Pie Menu Engine (`Tasty Pie Menu`)**:
   - Sourced from `apps/stage-mate/mate-engine/Assets/MATE ENGINE - Scripts/Tasty Pie Menu/` ([`CircleSelector.cs`](../apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Scripts/Tasty%20Pie%20Menu/Scripts/CircleSelector.cs), [`Button.cs`](../apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Scripts/Tasty%20Pie%20Menu/Scripts/Button.cs)) and [`Settings/MenuActions.cs`](../apps/stage-mate/mate-engine/Assets/MATE%20ENGINE%20-%20Scripts/Settings/MenuActions.cs).
   - Core mechanics extracted: Polar slice geometry, cursor angle tracking with `Mathf.Atan2`, magnetic segment snapping, 3D cursor-following parallax tilt, and dynamic button filtering.
2. **AIRI's Unified Head-Tethering Subsystem & Stage Config Overlay**:
   - Sourced from [`docs/design-head-tethered-captions.md`](./design-head-tethered-captions.md), [`docs/design-actor-stage.md`](./design-actor-stage.md), and [`StageConfigOverlay.vue`](../packages/stage-ui/src/components/scenarios/StageConfigOverlay.vue).
   - Core mechanics extracted: Unified `getHeadPose()` contract across all 4 avatar runtimes (Live2D, VRM, MMD, Spine), 3D NDC-to-pixel projection, and Euler angle perspective deformation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Stage-Mate Heritage                             │
│  • Polar angle slicing (360° / N) & polar-to-cartesian button layout   │
│  • Dynamic cursor wedge tracking mouse angle with magnetic snapping   │
│  • 3D parallax tilt towards cursor (tiltAmount = 12°)                  │
│  • Drag conflict suppression (radialDraggingBlocks)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AIRI Spatial Framework                          │
│  • Unified getHeadPose() across VRM, MMD, Spine, and Live2D            │
│  • Torso/chest anchor offset below head to preserve face visibility    │
│  • Pure nested radial pie menu hierarchy for all sub-actions          │
│  • Viewport-aware auto-scaling for compact viewports (Mini mode)      │
│  • Stage Config & Viewport actions via Electron eventa invoke         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cross-Model Spatial Tethering (The 4 Avatar Engines)

The Stage Radial Menu utilizes a **single Vue 3 Screen-Space Floating Overlay** (`HeadTetheredRadialMenu.vue`) mounted in `RendererStage.vue`. The overlay dynamically positions itself in 60 FPS lockstep with the avatar's head anchor queried through the standard `getHeadPose()` contract.

### 2.1 Anchor Resolution & Torso Offset

To ensure character facial expressions and eye gaze remain 100% visible, the radial menu calculates an anchor offset positioned over the **upper torso / chest** below the head crown:

$$\text{verticalOffset} = \text{clamp}\left(60\text{px} \cdot \text{scale}, 160\text{px} \cdot \text{scale}, (\text{modelHeightPx} \mathbin{\Vert} 450) \cdot 0.22\right)$$
$$\text{anchorY} = \text{headPose.screenY} + \text{verticalOffset}$$

| Avatar Format | Engine Runtime | Anchor Source | Coordinate Transform | Code Reference |
| :--- | :--- | :--- | :--- | :--- |
| **VRM (3D)** | Three.js / TresJS | `vrm.humanoid.getNormalizedBoneNode('head')` | Reads head bone position + `headUp * 0.20`, projects to NDC via `headTopPos.project(camera)`, converts NDC `[-1, 1]` to container CSS pixels. | [`ThreeScene.vue:379-428`](../packages/stage-ui-three/src/components/ThreeScene.vue) |
| **MMD (3D)** | Three.js | Standard PMX bone `頭` / `head` | Reads head world position + `headUp * 2.0`, projects to NDC via `headTopPos.project(camera)`, converts NDC to container CSS pixels. | [`MMD.vue:885-934`](../packages/stage-ui-mmd/src/components/scenes/MMD.vue) |
| **Spine (2D)** | `@esotericsoftware/spine-webgl` | `skeleton.findBone('head')` | Translates Spine origin `(cssW/2, cssH/2)` to stage coordinates: `rawScreenX = cssW/2 + bone.worldX`, `rawScreenY = cssH/2 - bone.worldY`. | [`Model.vue:1134-1175`](../packages/stage-ui-spine/src/components/scenes/spine/Model.vue) |
| **Live2D (2D)** | Pixi.js v6 | `findHeadAnchorPoint(model)` | Resolves top-center bounding box across drawable art meshes (`head`, `hair`, `face`), reading `coreModel` parameters `ParamAngleX/Y/Z`. | [`head-tethered-caption.ts:189-230`](../packages/stage-ui-live2d/src/composables/live2d/head-tethered-caption.ts) |

---

## 3. Pure Nested Radial Architecture

Every sub-menu in the Stage Radial Menu is a **first-class radial pie menu**, eliminating rectangular lists and flat modals:

```
                       [ ROOT WHEEL (4 or 5 Slices) ]
                                      │
        ┌─────────────────┬───────────┴───────────┬─────────────────┐
        ▼                 ▼                       ▼                 ▼
 [ Size Wheel ]    [ Snap Wheel ]          [ Layers Wheel ]  [ Monitor Wheel ]
   4 Slices          8 Slices + Center       2 Halves          N Slices
   (90° each)        (45° each)              (180° each)       (Multi-Display)
```

### 3.1 Level 1: Root Radial Wheel

- **Single-Display Setup (`monitorCount <= 1`)**: Displays **4 Slices** ($90^\circ$ each) — redundant monitor option is automatically filtered out.
- **Multi-Display Setup (`monitorCount > 1`)**: Displays **5 Slices** ($72^\circ$ each).

| Slice | Label | Icon | Default Angle (4-Slice) | Default Angle (5-Slice) | Action on Click |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Size** | `i-solar:maximize-square-2-linear` | $0^\circ$ (Top) | $0^\circ$ (Top) | Opens Level 2 Size Wheel |
| **2** | **Snap** | `i-ph:corners-out` | $90^\circ$ (Right) | $72^\circ$ (Top-Right) | Opens Level 2 Snap Wheel |
| **3** | **Layers** | `i-ph:stack` | $180^\circ$ (Bottom) | $144^\circ$ (Bottom-Right) | Opens Level 2 Layers Wheel |
| **4** | **Hide** | `i-ph:eye-slash` | $270^\circ$ (Left) | $216^\circ$ (Bottom-Left) | Minimizes stage window |
| **5** | **Monitor** | `i-ph:desktop` | — | $288^\circ$ (Top-Left) | Opens Level 2 Monitor Wheel |

---

### 3.2 Level 2: Nested Sub-Radial Wheels

#### A. Size Presets Wheel (4 Slices, $90^\circ$ each)
- **Top ($0^\circ$)**: `Mini` ($220 \times 315\text{px}$)
- **Right ($90^\circ$)**: `Med` ($450 \times 600\text{px}$)
- **Bottom ($180^\circ$)**: `Large` ($800 \times 1000\text{px}$)
- **Left ($270^\circ$)**: `Full` (Workarea display bounds)
- **Action**: Invokes `electronApplySizePreset({ target: 'actor', preset })`.

#### B. Snap & Alignment Compass Wheel (8 Slices, $45^\circ$ each + Center Hub)
- **8 Slices**: `Top` ($0^\circ$), `Top-Right` ($45^\circ$), `Right` ($90^\circ$), `Bottom-Right` ($135^\circ$), `Bottom` ($180^\circ$), `Bottom-Left` ($225^\circ$), `Left` ($270^\circ$), `Top-Left` ($315^\circ$).
- **Center Hub**: `Center` snap target (`i-ph:circle`) — clicking the center snaps to stage center.
- **Action**: Invokes `electronApplySizePreset({ target: 'actor', alignment })`.

#### C. Layer Visibility Wheel (2 Slices, $180^\circ$ Halves)
- **Right Half ($90^\circ$)**: `Model Layer` toggle (`showModel` ? On : Off).
- **Left Half ($270^\circ$)**: `Wallpaper` toggle (`showBackground` ? On : Off).
- **Behavior**: Clicking toggles live state without closing the wheel, allowing instant visual tuning.

#### D. Monitor Selector Wheel ($N$ Slices, $360^\circ / N$)
- Available on multi-display environments.
- Slices dynamically generated for each monitor index (`Monitor 1`, `Monitor 2`, etc.).

---

## 4. Geometry, Optical Centering & Auto-Scaling

### 4.1 Optical Midpoint Centering
With inner cutout radius $R_{\text{inner}} = 44\text{px}$ and outer disk radius $R_{\text{outer}} = 138\text{px}$:
$$R_{\text{mid}} = \frac{R_{\text{inner}} + R_{\text{outer}}}{2} = \frac{44 + 138}{2} = 91\text{px}$$
All icons and labels are placed at $R_{\text{mid}} = 91\text{px}$, positioning them directly in the optical center of the annular slice band.

### 4.2 Full-Slice Hit Testing
The entire geometric SVG annular wedge `<path>` captures pointer events and clicks. When hovering any point within a slice, the entire wedge illuminates with a neon highlight arc, and the corresponding floating icon/label smoothly scales to $1.15\times$ with a soft glow.

### 4.3 Viewport-Aware Auto-Scaling (Mini Mode Support)
In compact viewports such as Mini mode ($220\text{px} \times 315\text{px}$), a fixed $296\text{px}$ diameter wheel would overflow the window. The menu dynamically scales based on viewport dimensions:

$$\text{menuScale} = \min\left(1, \max\left(0.62, \frac{\min(\text{containerW}, \text{containerH}) - 16}{296}\right)\right)$$

Pointer coordinates divide by $\text{menuScale}$:
$$\Delta x_{\text{norm}} = \frac{\text{clientX} - \text{centerX}}{\text{menuScale}}, \quad \Delta y_{\text{norm}} = \frac{\text{clientY} - \text{centerY}}{\text{menuScale}}$$

This ensures hit testing, magnetic cursor snapping, and edge clamping remain pixel-perfect regardless of window size.

---

## 5. Audio & Interaction Feedback

The menu includes lightweight, Web Audio API synthesized sound cues (no external assets required):
- **Menu Open**: Dual-tone chime ($420\text{Hz} \to 640\text{Hz}$).
- **Slice Hover**: Crisp blip ($520\text{Hz}$).
- **Action / Wedge Trigger**: Snappy mechanical click ($780\text{Hz}$).

---

## Related Documents & Skills

- [`docs/design-actor-stage.md`](./design-actor-stage.md) — Actor Stage Viewport Specification.
- [`docs/design-head-tethered-captions.md`](./design-head-tethered-captions.md) — 4-Model Head-Tethering & Spatial Anchors.
- [[airi-stage-ui-surfaces]] — Cross-app stage and control surfaces.
- [[airi-character-rendering]] — 3D & 2D avatar rendering runtimes.
