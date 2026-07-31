# 🚀 Engine Sidecar Research Journal & Design Specification (Godot vs. Mate-Engine)

This document tracks research, architecture plans, and formal design specifications regarding offloading VRM rendering from the main Electron/WebGL thread into a compiled, native sidecar process.

---

## 🧭 Upstream Godot Attempts

Upstream `main` has been working on an experimental **Godot 4 Sidecar Window** (tracked via PRs #1697, #1724, #1830).

### Current Upstream Godot Architecture:
* **G0 Bootstrap (#1697)**: Initialized Godot 4 + C# project with a minimal scene (just a box and camera). No avatar loading.
* **Glue (#1724)**: Handles Electron ↔ Godot lifecycle, settings toggle, and a local WebSocket handshake interface.
* **VRM Path (#1830)**: VRM-only loader that writes model bytes to disk and imports them dynamically into Godot using a vendored VRM importer addon.

### The Fork's Critique:
The current upstream path is a "slow grind." The Godot VRM 1.0 runtime integration is incomplete, complex, and requires a full Godot toolchain and packaging wrappers just to duplicate basic VRM rendering capabilities.

---

## ⚡ The Mate-Engine Sidecar Alternative

Instead of building a Godot-based rendering pipeline from scratch, we evaluate the adoption of [Mate-Engine](https://github.com/shinyflvre/Mate-Engine) as a sidecar alternative for VRM rendering.

### Why Mate-Engine?
* **Out-of-the-Box Stability**: Written in C# and ShaderLab (Unity), Mate-Engine is already a stable, mature, and highly performant VRM desktop rendering engine. It handles custom shaders, desktop transparency, physics, and window overlays natively.
* **Overhead Bypass**: Rather than spending months hand-rolling a Godot scene importer, we treat the compiled Mate-Engine binary as a Sidecar runtime that connects via WebSockets to AIRI (`server-runtime`).
* **Cross-OS Support**: Unity natively targets Windows, macOS, and Linux with standard driver support and low latency rendering.

---

## 🏗️ Architecture Design Specifications

### 1. Process Strategy: Standalone Client (Option 1) vs. Managed Process (Option 2)

| Dimension | Option 1: Standalone Client Mode (Recommended Phase 1) | Option 2: Managed Subprocess / `execProcess` (Phase 2) |
|---|---|---|
| **Lifecycle Owner** | User launches MATE Engine separately or as a standing external sidecar. | AIRI main process (`injeca` service) manages lifecycle (`child_process` / `execProcess`). |
| **Communication** | WebSocket connection to `server-runtime` (`ws://localhost:6121/ws`) with token handshake. | WebSocket + local stdio/IPC pipe monitoring & health checks. |
| **Developer Experience** | Fast iteration: developer tests MATE Engine in Unity editor or standalone without restarting AIRI. | Coupled lifecycle: testing requires orchestrating AIRI launch/shutdown sequences. |
| **Scope Boundary** | Engine acts as an authenticated AIRI plugin/module subscriber (`module:announce`). | Requires building process health checks, crash recovery, and path discovery in main process. |

> **Decision**: Implement **Option 1 (Standalone Client Mode)** first. MATE Engine connects over WebSocket using the standard `Client` handshake specified in [`docs/proposal-twitch-plugin.md`](./proposal-twitch-plugin.md). Once stable, Option 2 can be added to auto-spawn the executable.

---

### 2. Channel Catalog & Data Pipeline Mapping

To replace the in-browser WebGL stage ([`apps/stage-tamagotchi/src/renderer/pages/actor.vue`](../apps/stage-tamagotchi/src/renderer/pages/actor.vue)) and specifications in [`docs/design-actor-stage.md`](./design-actor-stage.md), the MATE Engine sidecar must consume AIRI's internal event streams and marker token pipeline.

#### The `<|ACT|>` Marker Token Parsing & Trace Catalog

As specified in [`docs/proposal-acting-sidebar.md`](./proposal-acting-sidebar.md), character emotions and motions originate as LLM text marker tokens (`<|ACT:emotion="happy"|>` or `<|ACT:motion="wave"|>`) streamed during speech synthesis.

Below is the complete end-to-end trace from LLM streaming output to Stage Host execution:

```
[ LLM Stream Output ] ──▶ `<|ACT:emotion="happy"|>`
                               │
                               ▼
[ llm-marker-parser.ts ] (packages/stage-ui/src/composables/llm-marker-parser.ts)
 Slices stream; isolates special tag `<|...|>` from literal speech text.
                               │
                               ▼
[ speechRuntimeStore ] ──(Eventa Bus: speechIntentSpecialEvent)──▶ [ ControlStripHost.vue ]
 Emits `eventa:audio:speech:intent:special` payload over cross-window bus.
                               │
                               ▼
[ queues.ts ] (packages/stage-ui/src/composables/queues.ts: useSpecialTokenQueue)
 Parses token via `parseActEmotion()`, normalizes name & intensity, enqueues to `emotionsQueue`.
                               │
                               ▼
[ ControlStripHost.vue ] (packages/stage-ui/src/components/scenes/ControlStripHost.vue#L233)
 Branching Stage Host renderer dispatch:
   • VRM: customVrmAnimationsStore matching → `vrmStore.triggerMotion()` / `vrmStore.triggerEmotion()`
   • Live2D: `live2dStore.triggerEmotion()` (with fallback to `live2dStore.triggerMotion()`)
   • Spine: `spineStore.selectVariantAndSkin()` / `spineStore.playOneShotAnimation()`
   • MMD: `mmdStore.morphMappings` reverse lookup → `mmdStore.currentMotion`
```

#### Rosetta Stone Channel & Pipeline Catalog:

Below is the canonical catalog of channels (from [`docs/rosetta-stone.md`](./rosetta-stone.md) §13) and their data mappings:

| Pipeline / Channel | Source File | Payload Data | MATE Engine Target Action |
|---|---|---|---|
| **`<|ACT|>` Token Stream** | [`packages/stage-ui/src/composables/llm-marker-parser.ts`](../packages/stage-ui/src/composables/llm-marker-parser.ts) | `<|ACT:emotion="..."|>` or `<|ACT:motion="..."|>` | Trigger facial blendshape emotion preset or play VRMA motion clip |
| **Speech Intent Special Bus** | [`packages/stage-ui/src/services/speech/bus.ts`](../packages/stage-ui/src/services/speech/bus.ts#L36) | `speechIntentSpecialEvent` (`eventa:audio:speech:intent:special`) | Intercept special token stream prior to renderer dispatch |
| **`airi::beat-sync`** | [`packages/stage-shared/src/beat-sync/eventa.ts`](../packages/stage-shared/src/beat-sync/eventa.ts) | Lip-sync RMS amplitude (0.0 to 1.0), beat signals (`AnalyserBeatEvent`), frequency data | Real-time mouth morphing (`blendShape` / `vrmBlendShapeProxy` mouthOpen) |
| **`airi-stores-live2d`** | [`packages/stage-ui-three/src/stores/model-store.ts`](../packages/stage-ui-three/src/stores/model-store.ts#L81) | `trigger-emotion` (`name`, `intensity`), `trigger-motion` (`name`), `should-update-view` | Direct store fallback triggering for expressions & pose animations |
| **`airi:display-models-sync`** | `packages/stage-ui/src/stores/display-models.ts` | Active model metadata, file path, identity | Dynamic VRM model loading & avatar swapping |

---

### 3. Structural Analysis: Converting Implicit Reactivity to Explicit Remote Signals

#### The Problem: Vue Store Reactivity vs. Remote Processes

In AIRI's current WebGL architecture, cross-window stage synchronization relies on **transitive, implicit reactivity**:
1. The main window (`ControlStripHost.vue`) processes incoming text and LLM `<|ACT|>` tokens.
2. `ControlStripHost` updates local Pinia stores (`modelStore`, `vrmStore`, `live2dStore`).
3. Secondary windows (like the floating Actor Stage `actor.vue`) receive these state mutations through a combination of `BroadcastChannel` messages (`airi-stores-live2d`, `airi::beat-sync`) and reactive Vue watchers.

**For a remote native process like MATE Engine, implicit reactivity does not exist.** A compiled Unity/C# binary cannot observe Pinia store mutations or Vue watchers. Therefore, AIRI must introduce an explicit **Proxy Gateway** at a strategic pipeline bottleneck to translate internal reactive mutations into discrete WebSocket payloads.

---

### 4. Proxy Tap-Point Analysis: Where to Bridge the Pipeline

To transmit character commands (`<|ACT|>` expressions, motions, lip-sync, and model swaps) to MATE Engine, we evaluated two potential interception bottlenecks:

```
[ LLM Stream / UI Rehearsal ]
             │
             ▼
[ Special Token Queue ] (queues.ts) ──────────────────▶ [ Option A: Token-Level Tap ]
             │                                                  (Captures raw tags before resolution)
             ▼
[ ControlStripHost.vue ] ──▶ [ Store Dispatcher ] ────▶ [ Option B: Resolved Tap (RECOMMENDED) ]
                                                               (Captures normalized emotions & VRMA paths)
```

| Tap Point | Mechanics | Advantages | Disadvantages | Decision |
|---|---|---|---|---|
| **Option A: `queues.ts` (`useSpecialTokenQueue`)** | Intercepts raw `<|ACT:emotion="..."|>` tags right after stream slicing. | Early capture at the semantic parser layer. | Skips label normalization, alias mapping (e.g. `"happy"` $\rightarrow$ `BlendShapeClip`), and VRMA option matching. MATE Engine would receive unmapped raw strings. | ❌ Rejected |
| **Option B: Renderer Store Dispatcher (`ControlStripHost.vue` / Store Hooks)** | Intercepts inside `emotionsQueue` in [`ControlStripHost.vue:233`](../packages/stage-ui/src/components/scenes/ControlStripHost.vue#L233) or hooks into `vrmStore.triggerEmotion()`. | Captures **resolved** emotions and motions after name normalization and character card mapping. Works universally for LLM tags, Rehearsal Room playback, and manual UI clicks. | Requires emitting explicitly over WebSocket via `StageProxyGateway`. | ✅ **CHOSEN** |

---

### 5. WebSocket Proxy / Relay Gateway Architecture

When MATE Engine sidecar mode is active, the **Stage Proxy Gateway Service** in the main process hooks into the Stage Host dispatcher (Option B) and relays resolved actions to connected WebSocket clients over the data plane.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ AIRI Internal Telemetry & Event Pipeline                                        │
│                                                                                 │
│  • Speech Intent / <|ACT|> Pipeline ────────┐                                   │
│  • BroadcastChannel('airi::beat-sync')  ────┼─▶ [ Stage Proxy Gateway Service ] │
│  • BroadcastChannel('airi-stores-live2d') ──┘   (Main process / injeca)         │
└───────────────────────────────────────────────────────┬─────────────────────────┘
                                                        │
                                                        │ WebSocket (ws://localhost:6121/ws)
                                                        │ Auth Handshake: module:authenticate
                                                        ▼
                                       ┌──────────────────────────────────┐
                                       │ MATE Engine (Native Unity Binary)│
                                       │ • VRM Model Renderer             │
                                       │ • RMS Lip-sync Morph             │
                                       │ • Physics & Window Collisions    │
                                       └──────────────────────────────────┘
```

#### Standardized Relay Payload Schema (`stage:vrm:*`):

```ts
// Standardized VRM telemetry payload sent over WebSocket to MATE Engine
export interface StageVrmProxyEvent {
  type: 'stage:vrm:lip-sync' | 'stage:vrm:expression' | 'stage:vrm:motion' | 'stage:vrm:load'
  timestamp: number
  data: {
    // Lip-sync / Audio RMS
    rms?: number // normalized 0.0 - 1.0

    // Expressions (Resolved BlendShapes)
    expressionName?: string // e.g. 'Joy', 'Sorrow', 'Fun', 'Angry'
    intensity?: number // normalized 0.0 - 1.0

    // Motions / VRMA Animation Paths
    motionName?: string // e.g. 'wave', 'nod', 'custom-vrma:dance'

    // Model Loading
    modelPath?: string // local filesystem path or URL
  }
}
```

---

## 🔬 Multi-Format Expansion: Supporting MMD, Spine & Live2D in Unity

While MATE Engine's initial focus is VRM 3D rendering, the Unity engine foundation can theoretically host MMD, Spine, and Live2D model formats. Below is the technical feasibility, integration path, and licensing analysis for expanding sidecar rendering beyond VRM.

---

### 1. Model Format Integration Breakdown

#### A. MMD (`.pmx` Models & `.vmd` Animations)
* **Technical Readiness**: ⭐️⭐️⭐️⭐️⭐️ (Excellent Fitz, Zero Licensing Barriers)
* **Unity Integration Path**:
  * Parsed via C# open-source libraries (`MMD4Unity` / `MMD4Maker` or custom binary PMX readers).
  * Reads PMX vertex buffers, bone hierarchies, materials, and Japanese Shift-JIS morph target strings (`まばたき`, `にっこり`) directly into standard Unity `SkinnedMeshRenderer` and `Animator` components.
* **Licensing & Distribution**:
  * ✅ **Zero License Friction**: MMD is a community-created open standard with no corporate owner or restrictive EULA. Pre-compiled Unity sidecar binaries can freely bundle PMX/VMD C# parsers.

#### B. Spine (`.skel` / `.json` Skeleton Animations)
* **Technical Readiness**: ⭐️⭐️⭐️⭐️ (High Technical Support)
* **Unity Integration Path**:
  * Built using Esoteric Software's official `spine-unity` runtime.
  * Maps 2D bones, mesh deformations, weighted skins, and animation tracks to Unity `MeshRenderer` and `SkeletonAnimation` objects.
* **Licensing & Legal Comparison (JS Web SDK vs. Unity SDK)**:
  * Both `spine-pixi` (WebGL) and `spine-unity` (C#) operate under the **Spine Runtimes License Agreement**.
  * *Legal Requirement*: Using Spine runtimes in *any* engine (Web or Unity) requires that the avatar assets were created with a valid Spine Editor License.
  * *Distribution Consideration*: Standalone pre-compiled Unity binaries (`.exe` / `.app`) embedding `spine-unity` C# DLLs follow the same licensing terms as the JS Web SDK — free for open-source/indie projects below Esoteric's revenue threshold, provided asset creators hold valid editor licenses.

#### C. Live2D (`.model3.json` / Cubism SDK)
* **Technical Readiness**: ⭐️⭐️⭐️ (Official Unity SDK Available, High Dynamic Loading Complexity)
* **Unity Integration Path**:
  * Uses the official **Live2D Cubism SDK for Unity** (`CubismFramework`).
  * Renders 2D mesh deformers and parameters to Unity orthographic/perspective camera targets.
* **Licensing & Technical Comparison (JS Web SDK vs. Unity SDK)**:
  * *JS Web SDK (`pixi-live2d-display`)*: Dynamically loads `live2dcubismcore.js` WebAssembly in the browser at runtime under Live2D's Free / Small-Scale License.
  * *Unity SDK*: Requires compiling proprietary native Cubism core libraries (`Live2DCubismCore.dll` / `.dylib`) into the Unity project build assembly.
  * *Technical Challenge*: AIRI receives arbitrary user `.zip` archives containing Live2D models. In Unity, MATE Engine would need a custom C# byte-stream memory loader (`CubismModelBuilder.LoadFromMemory()`) to bypass unzipping to disk.

---

### 2. Multi-Format Feasibility Summary Matrix

| Model Format | Primary Unity Engine Driver | Technical Effort | Licensing & Legal Risk |
|---|---|---|---|
| **VRM 3D** | `UniVRM` (Native MATE Engine) | Shipped / Mature | ✅ MIT / Fully Open Source |
| **MMD 3D** | `MMD4Unity` / Native C# PMX Parser | Moderate | ✅ Open Standard / No EULA |
| **Spine 2D** | `spine-unity` | Moderate | ⚠️ Requires Spine Editor License |
| **Live2D** | `Live2D Cubism SDK for Unity` | High (Memory Zip Loading) | ⚠️ Proprietary Live2D EULA |

---

### 3. Architectural Recommendation

If MATE Engine expands beyond VRM:
1. **MMD is the safest first candidate**: MMD has no EULA restrictions, requires no proprietary core binaries, and integrates directly into Unity's standard 3D mesh pipeline.
2. **WebGL (`actor.vue`) remains the primary fallback for Live2D & Spine**: WebGL (`pixi-live2d-display` and `spine-pixi`) already provides zero-install, dynamic zip loading in Chromium without requiring users to bundle native C# SDK binaries in external sidecars.

---

## 🎯 Tactile Interactivity & Mesh Raycasting in Unity

In AIRI's Chromium/WebGL stage (`actor.vue`), user interactions (dragging the model, clicking hit zones, elastic cheek-pulling) rely on browser DOM events, Three.js raycasters, and PixiJS hit testers.

When offloading rendering to Unity / MATE Engine, **none of the browser's DOM event listeners or JS raycasters carry over.** Interactivity must be explicitly re-implemented inside MATE Engine's C# script pipeline, with touch/click feedback relayed back to AIRI over WebSocket.

---

### 1. Format-by-Format Tactile Breakdown

#### A. VRM Interactivity (3D Raycasting & Mesh Dragging)
* **AIRI WebGL Today**: Uses Three.js `Raycaster` to detect clicks on VRM sub-meshes (`VRMModel.vue`), supports camera orbit controls (`OrbitControls`), and enables model dragging across the transparent window canvas.
* **MATE Engine / Unity Implementation**:
  * **Native Support**: MATE Engine already includes built-in Unity C# `Physics.Raycast`, viewport Orbit controls, and window drag handlers (`NativeWindow.Drag()`).
  * **Required WebSocket Extension**: When a user clicks a VRM sub-mesh in Unity, MATE Engine emits a `stage:vrm:interact` event over WebSocket to AIRI:
    ```json
    {
      "type": "stage:vrm:interact",
      "data": {
        "action": "click",
        "meshName": "Head_Mesh",
        "position": { "x": 0.12, "y": 1.45, "z": 0.05 }
      }
    }
    ```
    This allows AIRI's character LLM / voice runtime to react dynamically to tactile user input.

#### B. Spine Interactivity (Hit Zones & Elastic Bone Dragging)
* **AIRI WebGL Today** ([`docs/project-spine-interactions.md`](./project-spine-interactions.md)):
  * *Tap Hit Zones*: Reads `model0.json` for hit areas $\rightarrow$ plays `.wav` SFX and triggers `tap_{bone_name}` animations.
  * *Elastic Spring Dragging*: Tracks pointer coordinates, calculates local bone displacements, applies boundary limits, and runs a mass-spring-damper physics loop ($\text{force} = -K \cdot \Delta x - D \cdot v$) to snap cheeks/ears/hair back upon pointer release.
* **MATE Engine / Unity Implementation**:
  * Must be built using `spine-unity`'s `SkeletonAnimation` and Unity's `IPointerDownHandler` / `IPointerDragHandler`.
  * The physics spring-damper equations ($K$ stiffness, $D$ damping) are mathematically identical, but displacements mutate `Bone.X` / `Bone.Y` directly in Unity C# before calling `skeleton.UpdateWorldTransform()`.

#### C. Live2D Interactivity (Hit Areas & Parameter Physics)
* **AIRI WebGL Today**: Uses `pixi-live2d-display` hit tests (`CubismModel.hitTest()`) to match hit areas (`Head`, `Body`, `Special`) and trigger facial expressions or motion clips.
* **MATE Engine / Unity Implementation**:
  * Built using `Live2D.Cubism.Framework.Raycasting.CubismRaycaster`.
  * Raycasts against Cubism mesh renderers to match hit area IDs and drive `CubismParameter` values (e.g., driving `ParamAngleX` / `ParamEyeBallX` to track the mouse cursor in 3D viewport space).

#### D. MMD Interactivity (Passive vs. Interactive)
* **AIRI WebGL Today**: Zero interactivity. `packages/stage-ui-mmd` renders passive PMX meshes and plays VMD tracks. No mouse picking or bone triggers exist.
* **MATE Engine / Unity Implementation**:
  * **Opportunity**: Unity can enhance MMD beyond current WebGL capabilities. Using Unity `SkinnedMeshRenderer` raycasting and rigid-body physics, MATE Engine can easily attach click targets or head-tracking to PMX bone structures.

---

### 2. Tactile Implementation Summary Matrix

| Feature | AIRI WebGL Implementation | Unity / MATE Engine C# Implementation | Status |
|---|---|---|---|
| **VRM Canvas Drag & Orbit** | Three.js `OrbitControls` & Raycaster | Native Unity `Physics.Raycast` & Window Panning | ✅ Native in MATE Engine |
| **VRM Mesh Touch Events** | `VRMModel.vue` pointer events | C# `OnMouseDown` $\rightarrow$ emits `stage:vrm:interact` WS frame | 🛠 WS Bridge Needed |
| **Spine Hit Zones** | `model0.json` tap reader | `spine-unity` BoundingBox Raycasting | 🛠 Re-implement in C# |
| **Spine Elastic Drag** | Spring-damper loop in `Model.vue` | Unity `IPointerDragHandler` + C# bone spring solver | 🛠 Re-implement in C# |
| **Live2D Hit Areas** | `pixi-live2d-display` hitTest | `CubismRaycaster` in Unity C# | 🛠 Re-implement in C# |
| **MMD Interactions** | None (Passive render) | Unity Raycast on `SkinnedMeshRenderer` | 💡 Enhancement Opportunity |

---

## 👁️ Cursor Tracking, Gaze Aim, Head Follow & Saccades

In character animation, **gaze aim** (eyeball direction), **head follow** (proportional neck/head rotation), and **saccades** (procedural, micro-jitter eye movements during idle focus) are critical for making avatars feel alive.

Below is an audit of how AIRI handles gaze across all 4 avatar formats today, and how that transfers to Unity / MATE Engine.

---

### 1. Audit: Current AIRI WebGL Gaze Systems

#### A. VRM 3D (`packages/stage-ui-three`)
* **Mechanism**: Native `VRMLookAt` quaternion proxy + procedural saccade solver ([`animation.ts:150`](../packages/stage-ui-three/src/composables/vrm/animation.ts#L150)).
* **Cursor Follow**: Mouse coordinates map to `lookAtTarget` (3D Vector). Three-VRM automatically computes head bone and eye bone rotations.
* **Saccade Physics**: When idle, `updateFixationTarget()` injects random micro-jitter offsets (`randFloat(-0.25, 0.25)`) at 400ms–2200ms intervals to simulate natural human eye saccades.

#### B. MMD 3D (`packages/stage-ui-mmd`)
* **Mechanism**: Custom bone-rotation controller ([`gaze.ts:65`](../packages/stage-ui-mmd/src/composables/mmd/gaze.ts#L65)).
* **Cursor Follow**: MMD models lack a native `lookAt` API. AIRI locates Japanese Shift-JIS eye bones (`左目`, `右目`, or fallback `両目`) and head bone (`頭`), calculates Euler pitch/yaw limits (`EYE_YAW_LIMIT = 0.35`, `HEAD_YAW_LIMIT = 0.2`), and applies damped quaternions relative to rest poses after `MMDAnimationHelper.update()`.
* **Saccade Physics**: Includes built-in idle saccade logic (`nextSaccadeIn`, `SACCADE_MIN_MS`, `SACCADE_RANGE = 0.4`), matching VRM's idle gaze behavior.

#### C. Live2D 2D (`packages/stage-ui-live2d`)
* **Mechanism**: `CubismParameterStore` & Cubism Target Point.
* **Cursor Follow**: Screen cursor maps to Cubism parameters: `ParamAngleX` / `ParamAngleY` / `ParamAngleZ` (Head rotation) and `ParamEyeBallX` / `ParamEyeBallY` (Eye gaze).
* **Saccade Physics**: Procedural parameter noise adds subtle eye micro-movements when idle.

#### D. Spine 2D (`packages/stage-ui-spine`)
* **Mechanism**: Bone constraint targets & `model0.json` pointer tracking.
* **Cursor Follow**: `Model.vue` translates canvas pointer coordinates into skeleton space, writing rotation and translation offsets to target head/eye bones (`head`, `eye_l`, `eye_r`).
* **Saccade Physics**: Passive animation track layering (idle tracks simulate subtle eye darts).

---

### 2. Unity / MATE Engine Gaze Architecture

When offloading rendering to Unity, gaze can operate in two distinct modes:

```
┌─────────────────────────┐                            ┌──────────────────────────────────┐
│ AIRI Main Process       │                            │ MATE Engine (Unity C#)           │
│                         │                            │                                  │
│ Mouse Listener / Vision │ ──▶ WS: stage:vrm:gaze ──▶ │ C# Gaze & Saccade Controller     │
│ { x: 0.15, y: -0.05 }   │   { x, y, saccade }        │  • VRM: vrm.lookAt.target        │
└─────────────────────────┘                            │  • MMD: 左目/右目 Bone Yaw/Pitch │
                                                       │  • Live2D: ParamEyeBallX         │
                                                       └──────────────────────────────────┘
```

1. **Native OS System Cursor (Desktop Sidecar Mode)**:
   - Unity reads system cursor position natively via `Input.mousePosition` without WebSocket network latency.
2. **Relayed Target / Vision Tracking Mode (`stage:vrm:gaze`)**:
   - When AIRI operates webcam face tracking (VLM Vision) or when secondary windows drive gaze, AIRI emits a `stage:vrm:gaze` payload over WebSocket:
     ```json
     {
       "type": "stage:vrm:gaze",
       "data": {
         "target": { "x": 0.15, "y": -0.05, "z": 1.0 },
         "enableSaccades": true
       }
     }
     ```

---

### 3. Gaze & Saccade Comparative Matrix

| Avatar Format | AIRI WebGL Implementation | Unity C# Gaze & Head Tracking Target | Saccade Handling |
|---|---|---|---|
| **VRM 3D** | `vrm.lookAt.target` (Vector3 lerp) | Native `UniVRM` `VRMLookAt` | Procedural 3D position jitter |
| **MMD 3D** | `gaze.ts` (Rotates `左目`/`右目`/`頭` bones) | Custom C# quaternion rotation on eye/head bones | C# damped idle saccade timer |
| **Live2D 2D** | Cubism `ParamAngleX/Y` & `ParamEyeBallX/Y` | `CubismLookAtController` | Parameter noise interpolation |
| **Spine 2D** | Skeleton bone offset translation | `spine-unity` bone target constraints | Layered animation tracks |

---

## 🏁 Minimum Viable Product (MVP) Specification

To provide a clear, achievable target for early development without scope creep, the MVP threshold for MATE Engine integration is defined across 5 core requirements:

---

### 1. Connection & Token Handshake
- MATE Engine connects over WebSocket to `ws://localhost:6121/ws`.
- Completes the `module:authenticate` token exchange:
  `Plugin → server: { type: 'module:authenticate', data: { token: '...' } }`
- Sends `module:announce` to register as an active stage renderer module (`possibleEvents: ['stage:vrm:*']`).

---

### 2. Local File Path Model Resolution (Zero-Copy)
- **No re-uploading or binary streaming required**: AIRI and MATE Engine run locally on the user's OS and share the local filesystem.
- When an avatar is loaded or swapped, AIRI's `displayModelsStore` resolves the absolute local file path of the active VRM model and sends a `stage:vrm:load` WebSocket frame:
  ```json
  {
    "type": "stage:vrm:load",
    "data": {
      "modelId": "display-model-0d3mUbNvk0nSPXVwTuS1",
      "modelPath": "/Users/richy/Library/Application Support/airi/models/avatar.vrm"
    }
  }
  ```
- MATE Engine's C# `UniVRM` loader reads that local file path directly off the disk. If a model URL is passed instead, `UniVRM` downloads it into memory via `UnityWebRequest`.

---

### 3. Basic Lip-Sync Telemetry Relay
- Listens to `stage:vrm:lip-sync` WebSocket events emitted by AIRI's Stage Proxy Gateway.
- Applies RMS amplitude (0.0 to 1.0) to the VRM mouth blendshape (`mouthOpen` / `aa`) during TTS audio playback.

---

### 4. Control Customizer & Stage View Integration
- **UI Location**: Located inside the **Control Customizer** under the **`Stage View`** section (alongside *Actor Stage*, *Always-on-Top*, and interaction mode toggles).
- **Independent Stage Toggle**: MATE Engine operates as a dedicated, independent stage provider toggle (`MATE Engine Stage`). Users can run MATE Engine independently or alongside the browser WebGL stage.
- **Visibility Control**: Toggling the `MATE Engine Stage` switch sends a `{ type: "stage:vrm:visibility", data: { visible: boolean } }` WebSocket frame, causing the Unity window to toggle desktop visibility.

---

### 5. Developer Mock Harness Strategy (Isolated Fast Iteration)

Launching the full AIRI application, LLM pipeline, and Electron runtime on every build iteration is slow and heavy. To accelerate developer velocity during MVP development:

- **Mock AIRI Harness Server (`scripts/mock-airi-stage-server.ts`)**:
  - A lightweight Node.js/TypeScript script that mocks AIRI's `server-runtime` WebSocket server on `ws://localhost:6121/ws`.
  - Simulates the `module:authenticate` $\rightarrow$ `module:announced` handshake.
  - Exposes interactive CLI triggers to fire simulated `stage:vrm:load`, `stage:vrm:lip-sync` RMS sine waves, `stage:vrm:expression`, and `stage:vrm:visibility` frames.
- **Benefits**: A developer working on MATE Engine in the Unity Editor can run `pnpm mock:stage-server` to test model loading, lip-sync, and visibility in seconds—completely isolated from the main AIRI Electron process.

---

### Out of Scope for MVP (Phase 2+):
- Tactile spring-damper bone dragging & mesh raycast events (`stage:vrm:interact`).
- Gaze target relay (`stage:vrm:gaze`).
- Non-VRM formats (MMD, Spine, Live2D).
- Automatic sidecar executable spawning (`execProcess`).

---

## 📅 Roadmap & Next Steps

1. **Developer Mock Harness**: Ship `scripts/mock-airi-stage-server.ts` to simulate AIRI WebSocket events for Unity sidecar testing.
2. **Standalone WebSocket Handshake**: Implement `Client` handshake in MATE Engine C# client (`module:authenticate` $\rightarrow$ `module:announce`).
3. **Proxy Gateway Relay**: Add the `StageProxyGateway` service in AIRI main process to subscribe to `airi::beat-sync` and `airi-stores-live2d` and push `stage:vrm:*` WS events.
4. **Control Customizer Toggle**: Add `MATE Engine Stage` switch under the **Stage View** section in the Control Customizer.
5. **Tactile & Gaze Telemetry**: Implement `stage:vrm:interact` and `stage:vrm:gaze` WebSocket events for touch and eye tracking.
6. **Compare Resource Usage**: Benchmark CPU/GPU frame times of the Three.js WebGL canvas vs. the Mate-Engine sidecar to quantify rendering efficiency.

