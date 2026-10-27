---
name: airi-stage-radial-menu
description: >-
  Build/debug Stage Radial Menu: in-scene right-click pie menu, head/torso spatial tethering across 4 avatar engines, polar slice geometry, SVG annular paths, 3D parallax tilt, nested sub-wheels (size, snap, mode, layers, monitor), auto-scaling, and Web Audio feedback.
---

# AIRI Stage Radial Menu

The **Stage Radial Menu** is an in-scene, bone-tethered circular quick-action wheel floating over the avatar's upper torso/chest. It gives users immediate, ergonomic access to stage viewport controls: window sizing presets, 9-point directional snapping, interaction modes (tactile, orbit, pan, move), layer visibility (model vs wallpaper), stage minimization/hide, and multi-monitor routing—structured as a **pure nested radial pie menu hierarchy**.

```
                       [ ROOT WHEEL (5 or 6 Slices) ]
                                      │
        ┌─────────────┬───────────────┼─────────────┬─────────────┐
        ▼             ▼               ▼             ▼             ▼
  [ Size Wheel ] [ Snap Wheel ]  [ Mode Wheel ] [ Layers ]  [ Monitor Wheel ]
    4 Slices       8 Slices +      4 Slices       2 Halves      N Slices
                   Center Hub
```

---

## 1. Lineage & Surface Map

The Stage Radial Menu synthesizes two proven technical architectures:
1. **Stage-Mate's Pie Menu Engine (`Tasty Pie Menu`)**: Polar slice geometry, angle calculation via `Math.atan2(deltaX, -deltaY)`, magnetic segment snapping, 3D cursor-following parallax tilt (`CircleSelector.cs:170-178`), and drag conflict suppression.
2. **AIRI's Unified Head-Tethering Subsystem**: Standard `getHeadPose()` contract across avatar runtimes (Live2D, VRM, MMD, Spine), 3D NDC-to-pixel projection, and Euler angle perspective deformation.

### 1.1 Source Anchors & Files

- **Overlay Component**: `packages/stage-ui/src/components/scenes/HeadTetheredRadialMenu.vue` (755 lines). Vue 3 screen-space floating overlay; owns the 60 FPS head-tracking `requestAnimationFrame` loop, Web Audio API synthesizer, 3D CSS parallax transform, SVG annular paths, and nested wheel state machine.
- **Stage Host**: `packages/stage-ui/src/components/scenes/RendererStage.vue`. Mounts `<HeadTetheredRadialMenu>` and owns the `@contextmenu="onStageContextMenu"` right-click trigger, movement threshold guard (`dist <= 8`), and `radialMenuOpen` state.
- **Desktop Window Host**: `apps/stage-tamagotchi/src/renderer/pages/actor.vue`. Desktop Electron actor stage window; receives menu emits (`apply-preset`, `apply-alignment`, `hide-stage`, `select-monitor`, `update:show-background`, `update:show-model`), queries active monitors via `useElectronAllDisplays()`, and invokes Electron IPC.
- **Polar Geometry & Math**: `packages/stage-shared/src/utils/radial-geometry.ts` (exported via `packages/stage-shared/src/index.ts`). Functions: `computePolarLayout`, `getHoveredSliceIndex`, `computeParallaxTilt`, `clampRadialMenuPosition`, `describeAnnularSector`.
- **Design Specification**: `docs/design-stage-radial-menu.md`.
- **Action Dispatcher**: `packages/stage-ui/src/composables/use-control-strip-action.ts` (`dispatchAction` for `viewport-*` mode syncing).

---

## 2. Cross-Model Spatial Tethering (The 4 Avatar Engines)

The radial menu floats dynamically above the avatar's upper torso/chest in 60 FPS lockstep with the avatar's head anchor.

### 2.1 Anchor Offset & Torso Clamping

Facial expressions and eye gaze must remain 100% visible:
$$\text{verticalOffset} = \text{clamp}\left(60\text{px} \cdot \text{scale}, 160\text{px} \cdot \text{scale}, (\text{modelHeightPx} \mathbin{\Vert} 450) \cdot 0.22\right)$$
$$\text{anchorY} = \text{headPose.screenY} + \text{verticalOffset}$$

`clampRadialMenuPosition(...)` prevents the circular wheel from clipping past stage viewport boundaries with margin padding.

### 2.2 Avatar Engine Integration Matrix

| Avatar Format | Engine Runtime | Anchor Source | Implementation Location | Head Pose Status |
| :--- | :--- | :--- | :--- | :--- |
| **VRM (3D)** | Three.js / TresJS | `vrm.humanoid.getNormalizedBoneNode('head')` | `packages/stage-ui-three/src/components/ThreeScene.vue:444` | Exposes `getHeadPose()` returning `{ screenX, screenY, yaw, pitch, roll, modelHeightPx }`. |
| **MMD (3D)** | Three.js | Standard PMX bone `頭` / `head` | `packages/stage-ui-mmd/src/components/scenes/MMD.vue:910` | Exposes `getHeadPose()` projecting world head bone to container pixels. |
| **Spine (2D)** | `@esotericsoftware/spine-webgl` | `skeleton.findBone('head')` | `packages/stage-ui-spine/src/components/scenes/spine/Model.vue:1157` | Exposes `getHeadPose()` converting Spine bone origin to screen pixels. |
| **Live2D (2D)** | Pixi.js v6 | `findHeadAnchorPoint(model)` | `packages/stage-ui-live2d/src/components/scenes/Live2D.vue:217` | **Does not expose `getHeadPose()`** on scene instance. Safely falls back to viewport center. |

> [!WARNING]
> **Live2D Fallback Behavior**: In `RendererStage.vue`, `:scene-ref` evaluates to `spineViewerRef` (unmounted) when rendering Live2D. In `HeadTetheredRadialMenu.vue`, `headPose` is `undefined`, so `menuCenter` safely defaults to `{ x: containerBounds.width / 2, y: containerBounds.height / 2 }`.

---

## 3. Pure Nested Radial Architecture

Every sub-menu is a first-class radial pie wheel. There are no rectangular drop-down lists or nested modals.

### 3.1 Level 1: Root Wheel

- **Web / Pocket (`!isStageTamagotchi()`)**: 5 Slices ($72^\circ$ each) — `Size` (window resizing) and `Monitor` are filtered out.
- **Desktop Electron Single-Display (`isStageTamagotchi()`)**: 6 Slices ($60^\circ$ each) — `Size`, `Shot` (Framing), `Snap`, `Mode`, `Layers`, `Hide`.
- **Desktop Electron Multi-Display (`monitorCount > 1`)**: 7 Slices ($51.4^\circ$ each) — `+ Monitor`.

| Slice | Label | Icon | Color | Scope | Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Size** | `i-solar:maximize-square-2-linear` | Sky Blue (`#38BDF8`) | Desktop Only | Opens Level 2 Window Size Presets Wheel |
| **2** | **Shot** | `i-ph:camera` | Cyan (`#06B6D4`) | Universal | Opens Level 2 Framing Presets Wheel (VRM) |
| **3** | **Snap** | `i-ph:corners-out` | Purple (`#A855F7`) | Universal | Opens Level 2 Snap & Alignment Compass |
| **4** | **Mode** | `i-ph:hand-pointing` | Emerald (`#10B981`) | Universal | Opens Level 2 Interaction Mode Wheel |
| **5** | **Layers** | `i-ph:stack` | Pink (`#EC4899`) | Universal | Opens Level 2 Layer Visibility Wheel |
| **6** | **Hide** | `i-ph:eye-slash` | Red (`#EF4444`) | Universal | Minimizes stage window via `hide-stage` emit |
| **7** | **Monitor** | `i-ph:desktop` | Amber (`#F59E0B`) | Multi-Display Desktop | Opens Level 2 Monitor Routing Wheel |

### 3.2 Level 2: Sub-Radial Wheels

#### A. Size Presets Wheel (4 Slices @ $90^\circ$ each, Desktop Only)
- **Top ($0^\circ$)**: `Mini` ($220 \times 315\text{px}$)
- **Right ($90^\circ$)**: `Med` ($450 \times 600\text{px}$)
- **Bottom ($180^\circ$)**: `Large` ($800 \times 1000\text{px}$)
- **Left ($270^\circ$)**: `Full` (Workarea display bounds)
- **Action**: Emits `apply-preset` $\to$ `actor.vue` calls `electronApplySizePreset({ target: 'actor', preset })`.

#### B. Framing Presets Wheel (3 Slices @ $120^\circ$ each, VRM Calibrated)
- **Top ($0^\circ$)**: `Full` (`scale: 2.5`, `y: 20`) — Full body shot pulling the camera back and lifting model to frame head-to-shoes.
- **Bottom-Right ($120^\circ$)**: `Bust` (`scale: 1.0`, `y: -15`) — Upper body / waist up (verified optical framing).
- **Bottom-Left ($240^\circ$)**: `Face` (`scale: 0.7`, `y: -18`) — Tight close-up face shot; shoulders anchor lower viewport and lower body overflows below stage (matching Stage-Mate's `Face Mode`).
- **Action**: Updates `usePositioningStore` for the active VRM model ID. On non-VRM models, notifies user with toast feedback without mutating positioning.

#### C. Snap & Alignment Compass Wheel (8 Slices @ $45^\circ$ + Center Hub)
- **8 Directions**: `Top` ($0^\circ$), `Top-Right` ($45^\circ$), `Right` ($90^\circ$), `Bottom-Right` ($135^\circ$), `Bottom` ($180^\circ$), `Bottom-Left` ($225^\circ$), `Left` ($270^\circ$), `Top-Left` ($315^\circ$).
- **Center Hub**: Snaps companion directly to screen center.
- **Action**: Emits `apply-alignment` $\to$ `actor.vue` calls `electronApplySizePreset({ target: 'actor', alignment })`.

#### D. Interaction Mode Wheel (4 Slices @ $90^\circ$ each)
- **Top ($0^\circ$)**: `Tactile` (`viewport-tactile`) — Direct hit-area touch interaction / expressions.
- **Right ($90^\circ$)**: `Orbit` (`viewport-orbit`) — 3D camera rotation.
- **Bottom ($180^\circ$)**: `Pan` (`viewport-drag`) — 2D model translation / position offset.
- **Left ($270^\circ$)**: `Move` (`viewport-positioning`) — Desktop window dragging mode.
- **Action**: Calls `useControlStripAction().dispatchAction(slice.action)` to keep Control Strip and stage stores synchronized.

#### E. Layer Visibility Wheel (2 Slices, $180^\circ$ Halves)
- **Right Half ($90^\circ$)**: `Model` toggle (`showModel` ? On : Off).
- **Left Half ($270^\circ$)**: `Wallpaper` toggle (`showBackground` ? On : Off).
- **Behavior**: Clicking toggles live state immediately without dismissing the wheel.

#### F. Monitor Selector Wheel ($N$ Slices, $360^\circ / N$)
- Dynamically generated from `props.displays` (`useElectronAllDisplays()`).
- Shows display index, resolution (`${w}×${h}`), orientation (`Portrait` vs `Landscape`), and `Primary` tag.
- **Action**: Emits `select-monitor` $\to$ `actor.vue` calls `electronApplySizePreset({ target: 'actor', monitorIndex })`.

### 3.3 Center Hub Button
- **Root Level (`subMenuMode === 'none'`)**: Displays `i-solar:close-circle-bold`. Clicking closes the menu.
- **Sub-Menu Level**:
  - In `align` mode: Displays `i-ph:circle` (Purple). Clicking triggers stage center alignment.
  - In other modes: Displays `i-solar:arrow-left-linear` (Sky Blue). Clicking returns to Level 1 Root Wheel.

---

## 4. Geometry, Parallax Physics & Auto-Scaling

### 4.1 Radii & Optical Centering
- **Inner Cutout Radius**: $R_{\text{inner}} = 44\text{px}$
- **Outer Disk Radius**: $R_{\text{outer}} = 138\text{px}$
- **Midpoint Band Radius**:
  $$R_{\text{mid}} = \frac{R_{\text{inner}} + R_{\text{outer}}}{2} = \frac{44 + 138}{2} = 91\text{px}$$
All slice icons and labels are positioned at $R_{\text{mid}} = 91\text{px}$, placing them in the optical center of the annular band.

### 4.2 3D Parallax Tilt
Mouse position relative to menu center drives a 3D perspective tilt (`perspective(600px)`):
$$\text{normX} = \text{clamp}\left(-1, 1, \frac{\Delta x}{R_{\text{outer}}}\right), \quad \text{normY} = \text{clamp}\left(-1, 1, \frac{\Delta y}{R_{\text{outer}}}\right)$$
$$\text{rotateX} = -\text{normY} \cdot 12^\circ, \quad \text{rotateY} = \text{normX} \cdot 12^\circ$$

### 4.3 Viewport Auto-Scaling (Mini Mode Support)
In compact window sizes ($220 \times 315\text{px}$), the $296\text{px}$ wheel would overflow. The menu dynamically scales down:
$$\text{menuScale} = \min\left(1, \max\left(0.62, \frac{\min(\text{containerW}, \text{containerH}) - 16}{296}\right)\right)$$

> [!IMPORTANT]
> **Pointer Normalization**: Pointer move coordinates must divide by `menuScale`:
> ```ts
> const relX = (e.clientX - menuCenter.value.x) / scale
> const relY = (e.clientY - menuCenter.value.y) / scale
> ```
> Failing to normalize by `scale` causes cursor angle detection and slice hit-testing to desync from the visually rendered SVG.

---

## 5. Web Audio Feedback Synthesizer

The menu synthesizes responsive audio cues via standard Web Audio API oscillators (no external `.wav`/`.mp3` assets required):

| Event | Waveform | Frequency | Duration | Gain |
| :--- | :--- | :--- | :--- | :--- |
| **Menu Open** | Triangle + Sine | $420\text{Hz} \to 640\text{Hz}$ | $0.12\text{s} + 0.15\text{s}$ | $0.09 \to 0.07$ |
| **Slice Hover** | Sine | $520\text{Hz}$ | $0.05\text{s}$ | $0.035$ |
| **Action Trigger** | Triangle | $780\text{Hz}$ | $0.10\text{s}$ | $0.10$ |

The audio context automatically checks `if (audioCtx.state === 'suspended') audioCtx.resume()`.

---

## 6. Core SOPs

### 6.1 Adding a New Root Radial Wedge
1. **Catalog Definition**: Add an entry to `MAIN_WEDGES` in `HeadTetheredRadialMenu.vue`:
   ```ts
   { id: 'custom', icon: 'i-ph:gear', label: 'Custom', color: '#8B5CF6' }
   ```
2. **Conditional Filtering**: If conditionally shown, update `activeMainWedges`.
3. **Action Handling**: In `onSliceClick(idx)` under `subMenuMode.value === 'none'`, handle `wedge.id === 'custom'` (either set `subMenuMode.value = 'custom'` or emit an action).
4. **Center Hub / Keydown Handling**: If introducing a sub-menu, update `handleCenterHubClick()` and `onKeyDown()` to support back-navigation.

### 6.2 Adding a New Sub-Radial Wheel
1. **Definition Array**: Define slice items with `{ id, label, sub, icon }`.
2. **Polar Layout**: Ensure `currentSliceCount` includes the new mode and `currentPolarLayouts` computes coordinates.
3. **Template Block**: Add a `<template v-else-if="subMenuMode === 'custom'">` block in `HeadTetheredRadialMenu.vue` rendering icons at `currentPolarLayouts[idx]`.
4. **Dispatch**: In `onSliceClick(idx)`, execute the sub-action and close or maintain state.

### 6.3 Implementing `getHeadPose` on Live2D
To upgrade Live2D from viewport-centering fallback to bone-anchoring:
1. In `packages/stage-ui-live2d/src/components/scenes/Live2D.vue`, import `findHeadAnchorPoint` from `composables/live2d/head-tethered-caption.ts`.
2. Add `getHeadPose` to `defineExpose`:
   ```ts
   getHeadPose: () => {
     const app = live2dCanvasRef.value?.pixiApp
     const model = app?.stage?.children?.[0]
     if (!model)
       return null
     const anchor = findHeadAnchorPoint(model)
     if (!anchor)
       return null
     return {
       screenX: anchor.x,
       screenY: anchor.y,
       yaw: 0,
       pitch: 0,
       roll: 0,
       modelHeightPx: model.height || 450,
     }
   }
   ```
3. In `RendererStage.vue`, pass `:scene-ref="stageModelRenderer === 'live2d' ? live2dSceneRef : ..."` into `<HeadTetheredRadialMenu>`.

---

## 7. Known Pitfalls & Traps

- **Right-Click Drag Threshold**: Right-clicking during a pan or orbit drag must not trigger the menu. `RendererStage.vue` enforces `Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) <= 8`.
- **SVG Annular Sector Gaps**: SVG sector paths must use a subtle angular padding (`startAngleDeg + 0.8` to `endAngleDeg - 0.8`) in `getSectorPath` to create crisp separation lines between slices.
- **AudioContext Suspended State**: Browsers require user interaction before playing audio. Audio calls wrap `audioCtx.resume()` in `playTone()`.
- **`currentPolarLayouts` Index Desync**: Never compute polar coordinates with a static slice count; always bind to `currentSliceCount.value` because sub-menus have varying slice counts ($4, 8, 2, N$).
- **Multi-Monitor Display Discovery**: When running on multi-monitor setups, `activeMainWedges` dynamically adds the `monitor` slice. If `displays.length <= 1`, it stays strictly filtered out to prevent redundant UI clutter.

---

## 8. Verification

- **Geometry & Math Check**:
  ```bash
  pnpm -F @proj-airi/stage-shared typecheck
  ```
- **Radial Menu Component & Stage UI Check**:
  ```bash
  pnpm -F @proj-airi/stage-ui typecheck
  ```
- **Desktop Electron Actor Stage Check**:
  ```bash
  pnpm -F @proj-airi/stage-tamagotchi typecheck:web
  ```
- **Manual Verification**:
  1. Right-click on VRM/Spine/MMD avatar: radial wheel appears over chest.
  2. Right-click on Live2D: radial wheel appears centered in viewport.
  3. Drag mouse around wheel: 3D parallax tilt follows cursor; slice arcs highlight magnetically with crisp blip audio.
  4. Test Size sub-wheel: clicking `Mini` resizes window and shrinks wheel scale smoothly.
  5. Test Snap sub-wheel: 8 compass directions and center hub reposition window accurately.
  6. Test Layers sub-wheel: toggling Model or Wallpaper updates state live without closing menu.
