# 🚀 Engine Sidecar Research Journal & Design Specification (Godot vs. Mate-Engine)

This document tracks research, architecture plans, and formal design specifications regarding offloading VRM rendering from the main Electron/WebGL thread into a compiled, native sidecar process.

---

## 📚 Required Reading (same stage, different format)

The Mate-Engine sidecar is the **native re-implementation of the Actor Stage**. These documents specify the same surface (model rendering, idle animation, viewport controls, window chrome) in the two runtime formats this project targets. Read them together:

| Doc | Format | What it covers |
| :--- | :--- | :--- |
| [`design-actor-stage.md`](./design-actor-stage.md) | Electron / WebGL | The canonical Actor Stage UX: window chrome, size presets (`mini`/`medium`/`large`/`full`), corner snap, view config overlay, proximity/dismiss behavior. The sidecar's window chrome is being ported from here. |
| [`idle-animation-design.md`](./idle-animation-design.md) | Cross-format reference | Idle animation data model + playback semantics (AIRI WebGL base-idle vs. idle-cycle, and the Mate-Engine/Unity implementation). |
| [`rosetta-stone.md`](./rosetta-stone.md) | Repo index | Concept → file-path index. §2 (Core UI), §13 (BroadcastChannels), §14 (key dirs) are the relevant sections. |

> **Rule of thumb**: if a feature exists on the Actor Stage (WebGL), the sidecar (Unity) is where its native equivalent lands. Always read the Actor Stage spec before touching the sidecar's UI/UX surface — they must stay in lock-step.

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

> **Correction (2026-08-16, from the actual [`shinyflvre/Mate-Engine`](https://github.com/shinyflvre/Mate-Engine) README).** The prior "Cross-OS" claim was wrong.

- **What it is**: a free, open-source **Desktop Mate alternative** — a Unity (C# + ShaderLab) desktop-pet application that renders custom VRM avatars on the desktop with transparency, window/taskbar sitting, and physics.
- **Already has the hard parts**: head/eye/spine tracking, touch regions, blendshape editing, idle/drag/dance animation, custom shaders, a built-in modding SDK, and an MMD music-dance player. Much of what this journal earlier listed as "re-implement in C#" (tactile/gaze) is **already shipped** — we extend, not rebuild.
- **Overhead Bypass**: rather than months hand-rolling a Godot scene importer, we treat the compiled Mate-Engine binary as a sidecar that connects to AIRI over WebSocket (`server-runtime`).
- **VRM is the entry format, not the ceiling**: Mate-Engine loads VRM natively; MMD/Spine/Live2D remain Phase 1+ (§Multi-Format).
- **Licensing**: GNU AGPLv3 + MateProv2. The default avatar is **All Rights Reserved** (Yorshka Shop) and must **not** be redistributed in our builds. Qwen 2.5 1.5b LLM is Apache-2.0.
- **Platform reality**: upstream ships a Windows exe (`MateEngineX.exe`) plus a community **Linux port**. There is **no upstream macOS build** — on macOS dev machines (this repo) we must build the Unity project ourselves via Unity Hub. That is a Phase 0 risk, not a given.

> **Mate-Engine vs UniVRM**: they are not interchangeable. [UniVRM](https://github.com/vrm-c/UniVRM) is the VRM Consortium's official *Unity library* for loading/driving VRM models at runtime — the kind of package Mate-Engine uses *internally* (VRM-in-Unity is almost always UniVRM). Mate-Engine is the *application* we fork. We are **not** building a fresh UniVRM project; that would re-implement the desktop-pet shell Mate-Engine already provides.

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

## 🧪 Phase 0 — Prototype Spike (Pre-MVP)

> **Status: ✅ COMPLETE (2026-08-16).** Two native processes — a Node/TS mock harness and a real Mate-Engine Unity build — talk over WebSocket. The Unity side renders a local `.vrm` in T-pose, centered with floor + sky, with working drag-to-orbit + scroll-to-zoom controls, and a red→green connection dot.

> **This is the entry point.** It precedes and is far smaller than MVP. Do not begin MVP until Phase 0 passes its definition of done.

### Goal

Prove, with the least code, the two things the entire sidecar bet rests on:

1. A headless **mock harness** (Node/TS) can hold a WebSocket connection to a **separate native process**.
2. That native process — a real **Mate-Engine / Unity** build — opens a window, renders a VRM loaded from a **local file path**, and reflects connection state in the UI.

### Definition of Done

- `pnpm -F @proj-airi/stage-mate harness` starts the headless mock harness on `ws://localhost:6171`.
- Launching the Mate-Engine build opens a window.
- A status dot is **red** while disconnected and turns **green** once the WebSocket connects.
- The harness sends `stage:vrm:load { modelPath }`; the window loads and renders the model (a fixed T-pose is acceptable).

### Hard Constraints (non-negotiable)

- **Option A only.** The "other process" MUST be the real Unity / Mate-Engine build. A WebGL or Electron stub reusing the existing three.js stack is explicitly rejected — it re-uses the stack AIRI already ships and therefore validates nothing about native offload.
- **No shortcuts that defer the hard problem.** The point of Phase 0 is to do the difficult Mate-Engine work first, not to paper over it.

### Repo Layout

```
apps/stage-mate/                      # package @proj-airi/stage-mate (pnpm workspace)
  package.json                        # `harness` script: pnpm -F @proj-airi/stage-mate harness
  harness/index.ts                    # headless mock WS server (tsx + raw `ws`) on :6171
  .gitignore                          # ignores *.vrm and mate-engine/
  test-model.vrm                      # gitignored local test asset (generic name)
  mate-engine/                        # vendored/forked Mate-Engine Unity project (gitignored)
    Assets/StageMate/MateSidecar.cs           # C#: WS client + VRM loader + status dot + orbit cam
    Assets/StageMate/MateSidecarBuild.cs      # editor script: builds scene + StandaloneOSX .app
    Assets/StageMate/MateSidecarScene.unity   # generated scene (camera rig, light, sidecar)
    Build/StageMate.app                       # built macOS app (clickable, no .dmg needed)
```

Package name: `@proj-airi/stage-mate`.

### Launch & Run

```sh
# terminal 1 — mock harness (ws://localhost:6171)
pnpm -F @proj-airi/stage-mate harness

# terminal 2 — launch the app (either opens Finder-handshaked or runs directly)
open apps/stage-mate/mate-engine/Build/StageMate.app
apps/stage-mate/mate-engine/Build/StageMate.app/Contents/MacOS/MateEngineX
```

The built binary is named `MateEngineX` (the fork's PlayerSettings Product Name); the folder it lives in is `StageMate.app`. A `.dmg` is *not* required — a clickable `.app` bundle is the usable artifact. The model loads on `Start()` regardless of the harness (WebSocket is connection-status only for the dot); the harness's `stage:vrm:load` can also drive a reload over the wire.

### macOS Porting Notes (what we changed to make it build)

The vendored fork is Windows-first. It **compiles and imports cleanly on macOS after two small, convention-matching fixes** — no deep porting was needed:

- **Script compilation on Mac originally failed with 62 `CS0246` errors in exactly two files**: `Assets/MATE ENGINE - Scripts/AvatarHandlers/AvatarWindowHandler.cs` and `AvatarHideHandler.cs` (the "window sitting / window hiding" features). Root cause: the author wrapped the P/Invoke + struct *declarations* (`RECT`, `POINT`, `WindowEntry`, `WINDOWPLACEMENT`, `MONITORINFO`) in `#if UNITY_STANDALONE_WIN`, but the *fields/methods that reference them* were left unguarded.
- **Fix**: removed the two `#if UNITY_STANDALONE_WIN` / `#endif` wrappers so the DllImports + structs are always declared — matching how the *sibling* Windows handlers (`AvatarGravityController`, `AvatarTaskbarController`, `AvatarLocomotionController`, `AvatarSwayController`) already ship their DllImports unguarded. On Mac those declarations compile fine; they'd only throw at runtime if actually invoked (they aren't in the reduced scene).
- **Toolchain**: Unity `6000.2.6f2` + `MacStandaloneSupport` module via Unity Hub. Required a valid Unity Personal license (the auto-generated `AUTHENTICATION_TOKEN` hub is separate from Unity's own licensing).
- **Non-fatal import warnings** (do not block): 3 bundled DLC `.vrm` (`Zome`, `Lazuli_VRM`, `aldina`) fail import with `ArgumentNullException`; `kage-master`'s nested `XRSettings.asset` fails to load; `MToon10` URP fallback shader missing. None affect our empty scene.
- **pnpm workspace**: `apps/**` glob was reaching the Unity `Library/PackageCache/*/package.json` files inside `mate-engine/`. Fixed by excluding it in `pnpm-workspace.yaml` (`'!apps/stage-mate/mate-engine/**'`).

### Prototype Gotchas (learned the hard way)

- **Enable renderers after VRM load.** UniVRM imports can leave `SkinnedMeshRenderer` disabled, so the model loads into the scene graph (`stage:vrm:ready` fires) but renders nothing. The upstream `VRMLoader.FinalizeLoadedModel` calls `EnableSkinnedMeshRenderers`; our `MateSidecar` must too (`EnableAllRenderers`).
- **Camera orientation is manual.** The first build pointed the camera *away* from the model (you only saw the default skybox). Fixed with an explicit camera rig + `LookAt`-style framing; orbit controls were added since the scene has no editor/tooling to pan with.
- **Load the model on `Start()`, not on WS-connect.** First iteration gated the fallback load behind the WebSocket connect, so the model only appeared with the harness running. It now loads unconditionally at startup.

### Window Chrome (eye icon + size presets + persistence)

- **Spike finding**: Unity *can* resize its own macOS window at runtime — the fork bundles Kirurobo's `UniWindowController` with a native macOS `LibUniWinC.bundle` (not just the Windows `.dll`), exposing a settable `windowSize` (`UniWinCore.SetSize`). No new native plugin needed.
- `MateSidecarBuild.cs` adds a `UniWindowController` component to the scene; `MateSidecar.cs` holds a reference to it.
- `MateSidecar.cs` draws an eye icon (top-right, Immediate Mode GUI) that toggles a popover of size presets — `mini` 220×315, `med.` 450×600, `large` 800×1000 — copied from [`design-actor-stage.md`](./design-actor-stage.md) §3.2. (`full`/work-area is deferred; needs monitor-workarea query.)
- **Persistence**: last size stored in `PlayerPrefs` (`stage-mate-window-size`); on `Start()` the sidecar reads it (default `med.` 450×600) and applies it once `UniWindowController` has attached its native window (lazy attach on first `Update`; polled until `windowSize` is non-zero).
- **Known gap**: presets use *window frame* size, while the Actor Stage presets are *client area* dimensions — identical for a borderless window, but should switch to client-size math when we port the actor-stage chrome 1:1.

### Wire Protocol (v0)

- Server: `ws://localhost:6171` (env-overridable via `MATE_HARNESS_PORT`).
- Plain JSON frames, no auth, no superjson, no heartbeat protocol (all deferred).

Harness → engine:

```json
{ "type": "stage:vrm:load", "data": { "modelPath": "<abs path to test-model.vrm>" } }
{ "type": "ping", "data": { "t": 1234567890 } }
```

Engine → harness:

```json
{ "type": "stage:vrm:ready", "data": { "modelPath": "..." } }
```

The periodic `ping` is how the window proves *live data flow* (brief blink per received frame), distinct from the socket-open green dot.

### Model Asset Handling

- The test VRM is copied into `apps/stage-mate/test-model.vrm` and **gitignored** so personal paths and the ~20 MB binary never leak into the repo or the harness config.
- Mate-Engine reads it **directly from the local filesystem path** — the "just read the file locally" prototype answer. No IndexedDB mounting, no binary streaming.

### Explicitly Deferred (out of Phase 0)

- Lip-sync / RMS telemetry, beat-sync bridging
- Control Customizer toggle (`stage:vrm:visibility`)
- Token provisioning / `module:authenticate` handshake / superjson / heartbeat
- `route.destinations` multi-peer routing
- Model materialization from IndexedDB blobs
- All non-VRM formats (MMD/Spine/Live2D), gaze, and tactile interaction

### Open Questions (resolve before/while building)

- **How to vendor Mate-Engine:** git-submodule vs. vendored copy of `shinyflvre/Mate-Engine` under `apps/stage-mate/mate-engine/`. (We fork the *app*; we do **not** build a fresh UniVRM scene — UniVRM is just the library Mate-Engine already uses internally.)
- **macOS build path:** upstream has no macOS build. Confirm we can open the Unity project in Unity Hub and build a macOS target, or whether Phase 0 must run under the Linux port / Windows. This is the biggest Phase 0 unknown.

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

### Phase 0 — Prototype Spike (✅ complete)

1. ✅ **Headless mock harness**: `apps/stage-mate/harness` — raw `ws` server on `:6171` that pushes `stage:vrm:load` + periodic `ping`.
2. ✅ **Mate-Engine sidecar**: fork/vendor `apps/stage-mate/mate-engine`, C# WS client (`MateSidecar.cs`) connects to the harness and loads the local `test-model.vrm`, red→green status dot.
3. ✅ **Definition of Done**: harness + Unity window side-by-side, dot green, model visible (T-pose, centered, orbit/zoom working).

### Phase 1 — MVP (deferred; Phase 0 passed)

1. **Developer Mock Harness (full)**: extend the Phase 0 harness to simulate the real `module:authenticate` $\rightarrow$ `module:announce` handshake and all `stage:vrm:*` events for Unity sidecar testing.
2. **Standalone WebSocket Handshake**: implement the `Client` handshake in the MATE Engine C# client (`module:authenticate` $\rightarrow$ `module:announce`).
3. **Proxy Gateway Relay**: add the `StageProxyGateway` service in the AIRI main process to subscribe to `airi::beat-sync` and `airi-stores-live2d` and push `stage:vrm:*` WS events.
4. **Control Customizer Toggle**: add `MATE Engine Stage` switch under the **Stage View** section in the Control Customizer.
5. **Tactile & Gaze Telemetry**: implement `stage:vrm:interact` and `stage:vrm:gaze` WebSocket events for touch and eye tracking.
6. **Compare Resource Usage**: benchmark CPU/GPU frame times of the Three.js WebGL canvas vs. the Mate-Engine sidecar to quantify rendering efficiency.

