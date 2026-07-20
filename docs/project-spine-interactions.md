# Project Spine Interactions Design Specification

This document details the research findings, requirements, and implementation plans for adding tactile pointer-drag interactions (such as cheek-stretching, petting, and physics-based bone deformations) to Spine models within the AIRI application.

---

## 1. Context & Research Summary

### A. Core Behavior in Trickcal Apostle Viewer
Our reverse-engineering of the Apostle Viewer client bundle ([index-Og6eHUgx.js](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/butter_bee_outfit/project_trickal_dump/Trickcal Apostle Viewer_files/index-Og6eHUgx.js)) revealed that interactive bone stretching is implemented using a custom event loop overlay:
1. **Event Capture:** Registers pointer down, move, and up events directly on the WebGL canvas.
2. **Axis Projection:** Converts pointer positions into relative local-axis coordinates of target bones.
3. **Elliptical Constraints:** Restricts the maximum drag displacement based on a custom ellipse equation (e.g. forward/backward stretching limits and perpendicular ratio).
4. **Spring-Damper Snapping:** Simulates muscle/skin elasticity on pointer release using a simple mass-spring-damper physics equation:
   $$\text{force} = -K_{\text{stiffness}} \cdot \text{offset} - D_{\text{damping}} \cdot \text{velocity}$$

### B. Existing Spine Architecture in AIRI
AIRI modularizes model rendering into formats under separate packages. The relevant Spine rendering components are:
* **Orchestrator:** [Spine.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-spine/src/components/scenes/Spine.vue) (receives `interactionMode`)
* **Renderer Canvas & Model:** [Model.vue (Spine)](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-spine/src/components/scenes/spine/Model.vue)

Currently, the Spine package only supports basic **tap interactions** parsed from `model0.json` (running animation `tap_{bone_name}` and playing `.wav` files when a hit zone is clicked). It has **no support** for coordinate tracking, coordinate deforming, or physics springs.

---

## 2. Goals & Gaps

### What We Support Today:
* Tap-to-play animation/sound mapped via `model0.json`.
* Hover highlighter overlays around hit bones.

### What We Want to Support:
* **Spring-elastic bone dragging:** Real-time bone dragging (e.g., pulling cheeks, ears, tails, hair) with configurable limits and physics constants.
* **Secondary follow bones:** Allowing secondary bones to stretch/mirror the main drag displacement to simulate skin stretching.
* **Global/Local tactile sound triggers:** Playing dedicated audio files during drag initiation (`onPull`) and release spring-back (`onRelease`).

---

## 3. Generic Metadata Specification (`model0.json`)

To keep AIRI's Spine engine completely generic (decoupled from the Trickcal roster), we define a standardized schema extension inside the local model manifest `model0.json`:

```json
{
  "hit_areas": [
    {
      "name": "Character_Ball_Move",
      "id": "Character_Ball_Move",
      "type": "pull",
      "spring": {
        "stiffness": 1680,
        "damping": 20
      },
      "limits": {
        "maxStretch": 60,
        "maxBackward": 1,
        "perpRatio": 0.7
      },
      "follower": {
        "bone": "Character_Ball_Move_Re",
        "mode": "same"
      },
      "audio": {
        "pull": "SFX_Common_PullCheek.wav",
        "release": "SFX_Common_PullCheekEnd.wav"
      }
    }
  ]
}
```

### Schema Parameters
* `type`: Currently supports `"tap"` (default) or `"pull"` (initiates pointer-dragging physics).
* `spring`: Object mapping the $K$ stiffness and $D$ damping factors of the snapping physics.
* `limits`: Distance boundary constraints in Spine coordinates.
* `follower`: Mapped follower bone settings (`mode` can be `"same"`, `"mirror"`, or `"none"`).
* `audio`: Keys pointing to `.wav` files bundled inside the model's ZIP archive.

---

## 4. Implementation Design Plan

### Step 1: Extend [Model.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-spine/src/components/scenes/spine/Model.vue) State
Create a reactive list of drag trackers derived from the loaded `model0.json` config:
```typescript
interface PhysicsDragTracker {
  boneName: string
  isDragging: boolean
  offsetX: number
  offsetY: number
  velocityX: number
  velocityY: number
  // Configured parameters...
}
```

### Step 2: Handle Pointer Drag Coordinates
Expand the canvas listeners in [Model.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-spine/src/components/scenes/spine/Model.vue) to capture `pointerdown`, `pointermove`, and `pointerup` events when `interactionMode === 'tactile'`. Translate screen coordinates to local bone spaces.

### Step 3: Apply Bone Offsets in the Render Loop
Modify the `update` callback of `SpineCanvas` in `Model.vue`:
1. Call `animationState.update()` and `animationState.apply()`.
2. For each active pull-type tracker, calculate the displacement and write directly to `bone.x` and `bone.y`.
3. If not dragging, apply the spring-damping math on the offset coordinates until they settle.
4. Call `skeleton.updateWorldTransform()` after mutating bone positions to apply changes before rendering.

---

## 5. Completed Fixes & ZIP Packaging Specs

### A. Capabilities Loader Regression Fix
Previously, the model customizer panel showed *"No expressions match filters"* due to two issues in `display-models.ts`'s `getOrLoadModelCapabilities()` method:
1. **Manifest Collision:** The zip scanner parsed `model0.json` as the main skeleton `.json` file by mistake since it matched the ends-with-`.json` pattern first. Since `model0.json` has no `animations` array, it returned 0 capabilities.
   * **Fix:** The parser was updated to specifically ignore `model0.json` when searching for the skeleton file (`filename.toLowerCase().endsWith('.json') && !filename.toLowerCase().endsWith('model0.json')`).
2. **Binary Skeleton Fallback:** For binary Spine skeletons (`.skel`), there is no skeleton JSON file to scan.
   * **Fix:** Added a fallback mechanism that parses the `motions` object keys inside `model0.json` if present, ensuring binary `.skel` models populate the Expressions/Motions list in the UI correctly.

### B. Mapped ZIP Archive Structure
To enable full tactile click/hover responses and SFX triggers inside AIRI, character skin ZIP archives must be structured flatly at the root:
```
/Character_Skin.zip
├── Character.skel               # Binary skeleton
├── Character.atlas              # Spine texture atlas
├── texture_sheet_hash.png       # Extracted texture sheet
├── model0.json                  # Custom interaction manifest
├── SFX_Common_PullCheek.wav     # Sound: Pull cheek start
├── SFX_Common_PullCheekEnd.wav  # Sound: Pull cheek release/snap
├── SFX_Common_Rubbing.wav       # Sound: Pet start
├── SFX_Common_RubbingEnd.wav    # Sound: Pet release
├── SFX_Tickle.wav               # Sound: Tickling
├── SFX_DutchRub_Default.wav     # Sound: Regular smash/hit
└── SFX_DutchRub_Max.wav         # Sound: Maximum smash/hit
```
These assets are successfully compiled and packaged by our ad-hoc toolings in `personal_airi/butter_bee_outfit/`.
