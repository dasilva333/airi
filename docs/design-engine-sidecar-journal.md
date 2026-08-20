# 🚀 Engine Sidecar Research Journal & Design Specification (Godot vs. Mate-Engine)

This document tracks research, architecture plans, and formal design specifications regarding offloading VRM rendering from the main Electron/WebGL thread into a compiled, native sidecar process.

---

## 📚 Required Reading (same stage, different format)

The Mate-Engine sidecar is the **native re-implementation of the Actor Stage**. These documents specify the same surface (model rendering, idle animation, viewport controls, window chrome) in the two runtime formats this project targets. Read them together:

| Doc | Format | What it covers |
| :--- | :--- | :--- |
| [`design-actor-stage.md`](./design-actor-stage.md) | Electron / WebGL | The canonical Actor Stage UX: window chrome, size presets (`mini`/`medium`/`large`/`full`), corner snap, view config overlay, proximity/dismiss behavior. The sidecar's window chrome is being ported from here. |
| [`design-idle-animation.md`](./design-idle-animation.md) | Cross-format reference | Idle animation data model + playback semantics (AIRI WebGL base-idle vs. idle-cycle, and the Mate-Engine/Unity implementation). |
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

### Stage Chrome & UI Parity (Porting from `actor.vue`)

The Mate-Engine sidecar window chrome is designed to mirror the production **Actor Stage** ([`docs/design-actor-stage.md`](./design-actor-stage.md)) 1:1:

```
┌────────────────────────────────────────────────────────┐
│ [⤢ Drag Handle] [⚙ Stage Config]                      │ ◄── Top-Right Floating Toolbar (actor.vue:600)
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [ + / ⧉ ] Mode Switch       [ 👁⃥ ] Hide Window  │  │ ◄── Row 1 (StageConfigOverlay.vue)
│  ├──────────────────────────────────────────────────┤  │
│  │ [ Mini ] (220×315)       [ Med. ] (450×600)      │  │ ◄── Row 2 (Size Mode)
│  │ [ Large ] (800×1000)     [ Full ] (Workarea)     │  │ ◄── Row 3 OR Corner Snap [ ↖ ↗ ↙ ↘ ]
│  ├──────────────────────────────────────────────────┤  │
│  │ [ 🖼 / 🖼⃥ ] Background     [ 👤 / 👤⃥ ] Model       │  │ ◄── Row 4 (Layer Visibility)
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│                     ( 3D Avatar )                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

#### 1. Top-Right Floating Toolbar (`actor.vue:600-626`)
- **Drag Handle Button** (`i-ph:arrows-out-cardinal`): Triggers native window dragging across monitors because the stage window is chromeless/frameless (implemented via `UniWindowController` native window repositioning).
- **Stage Config Button** (`i-ph:gear`): Toggles the floating frosted-glass configuration overlay panel.
- **Auto-Fade on Hover**: The toolbar auto-fades in on cursor discovery and fades out to 0% opacity when the mouse is idle.

#### 2. Stage Config Overlay (`StageConfigOverlay.vue`)
- **Row 1: Mode Switch & Hide Window**
  - Mode Switch: Toggles between **Size Mode** (Presets) and **Position Mode** (Corner Snap).
  - Hide Button: Minimizes/hides the sidecar window.
- **Rows 2 & 3: 2×2 Grid**
  - **Size Mode**: `mini` (220×315), `med.` (450×600), `large` (800×1000), `full` (work area). Applied to `windowController.windowSize`.
  - **Position Mode**: Snaps window to display corners (`top-left` ↖, `top-right` ↗, `bottom-left` ↙, `bottom-right` ↘).
- **Row 4: Layer Visibility Toggles (Scene vs. Transparent Model)**
  - `showBackground`: Toggles between 2D scene background / skybox and **100% transparent desktop overlay**.
  - `showModel`: Toggles avatar rendering visibility.

#### 3. Transparent Canvas & Automatic Pass-Through Click
- **Transparent Desktop Mode**: When `showBackground` is false, camera renders SolidColor `Color(0,0,0,0)`, making the window transparent with only the avatar floating on the desktop.
- **Dynamic Hit-Testing**: `UniWindowController` runs `HitTestCoroutine` with `HitTestType.Opacity` / `HitTestType.Raycast`. Empty transparent pixels pass clicks directly through to underlying applications (`NSWindow.ignoresMouseEvents = YES`), while the avatar's silhouette captures clicks for interaction. No manual click-through toggle is displayed on the stage.
- **Clean Production Surface**: Viewport debug modes (`Spin`, `Drag`, `Orbit`) are kept to developer keyboard shortcuts and excluded from the user-facing chrome.

#### 4. Developer Mock Harness Evolution Roadmap (`apps/stage-mate/harness/`)
- Upgrade the headless mock harness into an **interactive CLI or lightweight GUI** to simulate the complete AIRI lifecycle:
  - Live model swapping & directory scanning (`stage:vrm:load`)
  - Idle animation sequence triggering (`stage:vrm:idle`)
  - Size preset & visibility dispatch (`stage:vrm:visibility`)
  - Simulated lip-sync RMS audio waveforms (`stage:vrm:lip-sync`)
  - `<|ACT|>` expression & motion trigger testing

### Viewport Interaction Modes & Camera Orientation Specification

#### 1. Model Spawn Orientation (The Front-Facing Invariant)
- **Problem**: Standard VRM models loaded at `Quaternion.identity` face along $+Z$, pointing away from a camera situated at $(0, 1.3, -3)$ looking along $+Z$.
- **Rule**: When any VRM model is loaded into the sidecar (at `Start()` or via `stage:vrm:load`), its local rotation must be initialized to `Quaternion.Euler(0f, 180f, 0f)` so the avatar always starts facing the camera directly.

#### 2. Viewport Interaction Modes (Mutually Exclusive)
- **Mode 1: Model Spin (`ViewMode.ModelSpin`)**
  - **Interaction**: Left mouse button (LMB) drag spins the model in place around its world Y axis (`loadedModel.transform.Rotate(0, -Input.GetAxis("Mouse X") * 5f, 0, Space.World)`).
  - **Invariant**: Model position and camera angle/distance do not change.
- **Mode 2: Drag Mode / Screen-Plane Pan (`ViewMode.Drag`)**
  - **Interaction**: LMB drag translates the model across the plane parallel to the camera view plane (`new Plane(-orbitCamera.transform.forward, dragStartModelPos)`).
  - **Invariant**: Scale/zoom is 100% constant. Dragging up/down/left/right moves the avatar to any screen corner without altering distance to the camera or depth perspective. Do not project onto an XZ ground plane (which distorts scale on vertical mouse movements).
- **Mode 3: Camera Orbit (`ViewMode.CameraOrbit`)**
  - **Interaction**: LMB drag orbits camera pitch and yaw around the camera rig (`pitch` clamped `[-80°, 80°]`, full 360° `yaw`).
  - **Invariant**: Model position and rotation do not change.
- **Universal: Scroll Wheel Zoom**
  - **Interaction**: Mouse scroll wheel adjusts camera distance (`distance = Mathf.Clamp(distance - scroll * 2f, 0.5f, 12f)`).
  - **Invariant**: Active across all 3 modes; never overrides or interferes with LMB actions.

#### 3. Control Surface & State Sync
- Single source of truth: `enum ViewMode { ModelSpin, Drag, CameraOrbit }`.
- Mode switching:
  - OnGUI buttons: `[1. Spin]`, `[2. Drag]`, `[3. Orbit]`.
  - Keyboard shortcuts: `V` (cycles modes), `1`/`S` (Spin), `2`/`D` (Drag), `3`/`O` (Orbit).
  - UI status label dynamically displays the active mode and interaction hint.

### Wire Protocol & Signal Mapping (`CUSTOMIZER_CATALOG` Alignment)

Rather than inventing arbitrary string message types, the sidecar wire protocol maps directly to the canonical IDs from [`packages/stage-ui/src/constants/control-customizer.ts`](../packages/stage-ui/src/constants/control-customizer.ts) (`CUSTOMIZER_CATALOG`):

#### 1. Control Customizer Signals (`control:*`)

These signals mirror the AIRI Control Strip and Settings toggles:

| Customizer `id` | Wire Message `type` | Payload `data` | Mate-Engine Sidecar Action |
|---|---|---|---|
| `stage` | `control:stage` | `{ enabled: boolean }` | Toggles rendering/visibility of the sidecar window. |
| `always-on-top` | `control:always-on-top` | `{ enabled: boolean }` | Toggles window floating status (`windowController.isTopmost = enabled`). |
| `viewport-tactile` | `control:viewport-tactile` | `{}` | Sets interaction mode to Tactile (gaze tracking / mesh raycasting). |
| `viewport-drag` | `control:viewport-drag` | `{}` | Sets interaction mode to Drag Mode (view-plane translation). |
| `viewport-positioning` | `control:viewport-positioning` | `{}` | Sets interaction mode to Positioning Mode (coordinate placement). |
| `viewport-orbit` | `control:viewport-orbit` | `{}` | Sets interaction mode to Camera Orbit Mode. |
| `viewport-cycle-modes` | `control:viewport-cycle-modes` | `{}` | Cycles to the next interaction mode sequentially. |
| `viewport-reset-coordinates` | `control:viewport-reset-coordinates` | `{}` | Resets model position to `Vector3.zero` and camera distance to default. |
| `viewport-auto-hide` | `control:viewport-auto-hide` | `{ enabled: boolean }` | Toggles whether stage UI overlays auto-fade on mouse leave. |

#### 2. Stage Management & Telemetry Signals (`stage:*`)

| Wire Message `type` | Payload `data` | Description / Mate-Engine Action |
|---|---|---|
| `stage:size-preset` | `{ preset: 'mini' \| 'med.' \| 'large' \| 'full' }` | Resizes window frame to preset dimensions (`220×315`, `450×600`, `800×1000`, work area). |
| `stage:vrm:load` | `{ modelPath: string }` | Loads VRM model from local filesystem path, sets `localRotation = Quaternion.Euler(0,180,0)`. |
| `stage:vrm:idle` | `{ idleAnimations: string[] }` | Configures active idle animation cycle pool. |
| `stage:vrm:lip-sync` | `{ rms: number }` | Real-time mouth blendshape amplitude (0.0 to 1.0) for speech playback. |
| `stage:vrm:ready` | `{ modelPath: string }` | (Engine → Harness) Notifies that model loading is complete. |
| `ping` | `{ t: number }` | Periodic heartbeat; produces brief status dot activity blink. |

#### 3. Stage vs. Harness Control Boundary (Separation of Concerns)

- **Driven by Harness & Control Strip**: `size-preset`, `always-on-top`, `viewport-*` interaction modes, `stage:vrm:lip-sync` simulated audio, and model loading.
- **Local-Only to Actor Stage**: `showBackground` (Scene artwork vs. transparent desktop) and `showModel` (Model layer toggle) are strictly controlled locally by the stage's own `StageConfigOverlay.vue` (Row 4) and are not driven by external harness signals.

#### 4. Interactive Mock Harness Design (`apps/stage-mate/harness/`)

The mock harness script (`pnpm -F @proj-airi/stage-mate harness`) provides a zero-dependency, minimal-logic testbed:
- **Interactive Keyboard Controls**:
  - `[1]`, `[2]`, `[3]`, `[4]` → Send size presets (`mini`, `med.`, `large`, `full`)
  - `[t]` → Toggle `always-on-top`
  - `[d]`, `[o]`, `[s]`, `[c]` → - MATE Engine connects over WebSocket to `ws://localhost:6171` (or dynamic port via `--port`).
- Completes the `module:authenticate` token exchange:
  `StageMate → server: { type: 'module:authenticate', data: { token: '...' } }`
- Sends `module:announce` to register as an active stage renderer module:
  `StageMate → server: { type: 'module:announce', data: { name: 'proj-airi:stage-mate' } }`

---

### 2. Dynamic Model Cache Gate (Option A — Stateless Query-First)
- **Local Disk Cache**: Main process manages `userData/stage-mate-cache/<modelId>.vrm`.
- **Stateless Query Gate**:
  1. On model switch, AIRI checks `electronStageMateEnsureModel({ modelId })`.
  2. **Cache HIT**: 0 bytes across IPC; Main broadcasts `stage:vrm:load` immediately.
  3. **Cache MISS**: Renderer reads `model.file.arrayBuffer()` $\rightarrow$ `electronStageMateSaveModel({ modelId, data })` $\rightarrow$ Main writes atomically to disk cache $\rightarrow$ broadcasts `stage:vrm:load`.
- **Atomic Concurrency Safety**: In-flight Promise deduplication prevents parallel write corruption across multi-window renderer instances.

---

### 3. The Two-Tier Positioning Architecture

To align with AIRI's established window and model management specs (see [`project-positioning-store-migration.md`](./project-positioning-store-migration.md) and [`control-customizer.ts`](../packages/stage-ui/src/constants/control-customizer.ts)), Stage-Mate decouples desktop window coordinates from internal viewport model coordinates:

| Tier | Scope | Controlled By | Persisted In |
|:---|:---|:---|:---|
| **Tier 1: OS Window Bounds** | Desktop screen placement $(X, Y, W, H)$ | Top-right chrome handle / `MOVE` header | `userData/@proj-airi/config.json`<br/>`windows: [{ tag: 'stage-mate', title: 'AIRI', x, y, width, height }]` |
| **Tier 2: Model Placement & Scale** | In-canvas avatar offset and scale $(x, y, scale)$ | Viewport drag interaction in `dragMode` / `positionMode` | `usePositioningStore`<br/>`settings/positioning/models` keyed by `modelId` |

#### Canonical Viewport Interaction Modes (`stageMode`)
* `'tactileMode'`: Default idle pointer interaction & gaze following.
* `'dragMode'`: Translates model offset $(x, y)$ inside the canvas viewport, syncing to `usePositioningStore`.
* `'positionMode'`: Precise coordinate placement and scaling mode.
* `'orbitMode'`: Rotates the camera viewport around the 3D scene.

---

### 4. Post-Handshake State Synchronization Protocol (`stage:state:sync`)

Post-handshake, AIRI pushes a comprehensive bootstrap state snapshot to Stage-Mate:

```json
{
  "type": "stage:state:sync",
  "data": {
    "window": {
      "x": 1200,
      "y": 450,
      "width": 300,
      "height": 450,
      "alwaysOnTop": true
    },
    "model": {
      "modelId": "display-model-fd9WyKqGwXlA17d82QhNC",
      "modelPath": "/Users/.../stage-mate-cache/display-model-fd9WyKqGwXlA17d82QhNC.vrm"
    },
    "positioning": {
      "x": 0.0,
      "y": 0.0,
      "scale": 1.0
    },
    "viewport": {
      "mode": "tactileMode"
    },
    "stage": {
      "enabled": true
    }
  }
}
```

#### Bi-Directional Runtime Event Contracts
1. **Window Bounds Update (`stage:window:bounds`)**:
   - `StageMate → AIRI`: Emitted on drag-stop of the window chrome handle.
   - AIRI validates coordinates with `ensureWindowInVisibleBounds` and updates `config.json` under `tag: 'stage-mate'`.
2. **Model Offset Update (`stage:model:position`)**:
   - `StageMate → AIRI`: Emitted when model is panned/scaled in `dragMode`/`positionMode`.
   - AIRI commits position/scale to `usePositioningStore.setPosition(modelId, { x, y, scale })`.
   - When switching models in AIRI, AIRI emits `stage:model:position` to Stage-Mate to restore that character's specific saved coordinates.
3. **Viewport Mode Dispatch (`control:viewport:mode`)**:
   - `AIRI → StageMate`: Emitted when the user cycles or selects modes on the Control Strip (`'tactileMode' | 'dragMode' | 'positionMode' | 'orbitMode'`).

---

### 5. Control Customizer & Stage View Integration
- **UI Location**: Located inside the **Control Customizer** under the **`Stage View`** section (`stage-mate`).
- **Independent Stage Toggle**: MATE Engine operates as a dedicated, independent stage provider toggle (`Stage Mate`). Users can run Stage Mate independently or side-by-side with the WebGL stage.
- **Visibility Control**: Toggling the `Stage Mate` switch dispatches `{ type: "control:stage", data: { enabled: boolean } }` to show/hide the companion stage.

---

### 6. The LookAt Decoupling & Inverted Head Post-Mortem

#### The Bug
During initial stage testing, when dragging the avatar across the screen or translating local model position in canvas space, the avatar's head, face mesh, eyes, and neck would suddenly vanish or invert backwards into the hollow cavity of the hair geometry.

#### Root Cause
Even when custom procedural head tracking was toggled off, UniVRM's internal components (`VRMLookAtHead` in VRM 0.x and `Vrm10Instance.LookAtTarget` in VRM 1.0) remained active in UniVRM's own internal `LateUpdate()` loop.
These components were locked to a static world coordinate target at `(0, 1.3, -3)` (the camera location). When the avatar was translated away from the origin (e.g. panned to the left, right, or top), the target coordinate ended up behind the model's new local coordinate space. UniVRM's solver calculated a 180° reverse yaw/pitch angle and violently twisted the neck and head bones backwards into the hair.

```
[ Model at Origin (0,0,0) ] ──────(Normal 0° LookAt)─────▶ [ Camera Target (0,1.3,-3) ]
                                                                      ▲
[ Model Dragged to (2,1,0) ] ─────(180° Inverted LookAt)──────────────┘
(Head snaps backwards into hair cavity!)
```

#### The Invariant & Fix
1. **Explicit Component Neutralization**: When gaze/head-tracking is disabled or when the viewport is in translation/drag mode, UniVRM LookAt targets must be explicitly detached and disabled:
   - VRM 1.0: `vrm10.LookAtTarget = null;`
   - VRM 0.x: `vrm0LookAt.Target = null; vrm0LookAt.enabled = false;`
2. **Elimination of Inline Tracking Cruft**: All temporary bone drivers (`HeadDriver`, `SpineDriver`, `lookAtTargetTransform`) must not be lazily left ticking in `LateUpdate()`.
3. **Canonical Gaze Architecture**: Gaze tracking must be driven centrally by AIRI's global OS/sensor coordinates via `stage:vrm:gaze` and consumed cleanly by a dedicated model driver, rather than hardcoding viewport-local mouse positions.

---

### 7. Clean Source Overlay (`unity-src/`) & Monorepo Bloat Isolation

#### Problem Statement
The upstream Mate-Engine repository is over 500MB of heavy 3D assets, textures, third-party vendor shaders (LilToon, etc.), and sample scenes. Committing this directly to the AIRI monorepo would cause massive git bloat and slow down clone/fetch operations.

#### Architecture Solution
We isolate our custom work in [`apps/stage-mate/unity-src/`](../apps/stage-mate/unity-src/) while keeping `apps/stage-mate/mate-engine/` strictly in `.gitignore`.

```
apps/stage-mate/
├── unity-src/                               # TRACKED in Git (Clean C#, Scenes, Build scripts)
│   ├── Assets/StageMate/
│   │   ├── MateSidecar.cs                   # Sidecar socket & runtime logic
│   │   ├── MateSidecarBuild.cs              # Multi-target batchmode compiler
│   │   ├── MateSidecarScene.unity           # Lightweight empty companion stage scene
│   │   └── StageMateIdleController.*        # Procedural idle animation controllers
│   ├── Assets/StreamingAssets/              # Mock config stubs (LLMManager.json)
│   ├── Patches/                             # Cross-platform P/Invoke patches
│   │   └── AvatarHandlers/                  # AvatarHideHandler.cs, AvatarWindowHandler.cs
│   ├── ProjectSettings/                     # Standalone EditorBuildSettings.asset
│   ├── README.md                            # Directory architecture documentation
│   └── build.sh                             # Fast local macOS build script
├── mate-engine/                             # GITIGNORED (Local 500MB+ Unity workspace)
└── scripts/
    ├── setup.ts                             # Clones base Mate-Engine & overlays unity-src/
    └── build.ts                             # Cross-platform TypeScript build runner
```

#### Automation Workflow
1. `pnpm -F @proj-airi/stage-mate setup` (`scripts/setup.ts`):
   - Clones upstream `shinyflvre/Mate-Engine` if not present.
   - Copies `unity-src/` overlay into `mate-engine/Assets/StageMate/`.
   - Applies cross-platform macOS P/Invoke patches.
2. `pnpm -F @proj-airi/stage-mate build [mac|win|linux|all]` (`scripts/build.ts`):
   - Auto-discovers the local Unity executable path.
   - Runs `MateSidecarBuild.Build[Target]` in non-interactive batchmode.

---

### 8. Cross-Platform Build Pipeline & Multi-OS Discovery

#### 1. Multi-Target Build Methods (`MateSidecarBuild.cs`)
`MateSidecarBuild.cs` defines dedicated entry points for each operating system:
* `BuildMac()`: Produces `Build/StageMate.app` (`StandaloneOSX`).
* `BuildWindows()`: Produces `Build/Windows/StageMate.exe` (`StandaloneWindows64`).
* `BuildLinux()`: Produces `Build/Linux/StageMate.x86_64` (`StandaloneLinux64`).
* `BuildAll()`: Batch compiles all configured targets.

#### 2. Cross-Platform Executable Resolution (`StageMateService.resolveBinaryPath`)
Electron Main automatically resolves the correct executable depending on the host OS and environment (dev vs. packaged extraResources):
* **Windows (`win32`)**: Checks `Build/Windows/StageMate.exe`, `Build/StageMate.exe`, and `resourcesPath/StageMate.exe`.
* **macOS (`darwin`)**: Checks `Build/StageMate.app`, `Build/macOS/StageMate.app`, and `resourcesPath/StageMate.app`.
* **Linux (`linux`)**: Checks `Build/Linux/StageMate.x86_64`, `Build/StageMate.x86_64`, and `resourcesPath/StageMate.x86_64`.

#### 3. macOS P/Invoke Compilation Patch
Upstream Mate-Engine wrapped Win32 struct declarations (`RECT`, `POINT`, `WindowEntry`, `WINDOWPLACEMENT`, `MONITORINFO`) in `#if UNITY_STANDALONE_WIN` while leaving referencing method signatures unguarded. On macOS, removing the `#if` wrapper allows the structs to compile cleanly across all platforms without runtime penalty.

---

### 9. Monolith Decomposition Blueprint (Scaling to Modular Companion Services)

As `MateSidecar.cs` approaches ~1,700 lines, maintaining transport, windowing, UI chrome, model loading, blendshape morphing, and companion physics in a single script creates unnecessary coupling.

We decompose the sidecar into clean, focused C# modules organized by domain:

```
apps/stage-mate/unity-src/Assets/StageMate/
├── Core/
│   ├── StageMateSocket.cs            # WebSocket client, auth handshake, message routing (:6171)
│   ├── StageMateProtocol.cs          # Wire message JSON data structures & serialization
│   └── StageMateStateSync.cs         # stage:state:sync parsing & bootstrap dispatch
├── Window/
│   ├── StageMateWindowManager.cs     # Native window drag (waist grab / DWM transparent window)
│   ├── StageMateShadowRig.cs         # Real-time transparent desktop drop-shadow projector quad
│   └── StageMateRadialMenu.cs        # Circular pie menu overlay & quick action ring
├── Viewport/
│   ├── StageMateViewportController.cs# Drag translation, camera orbit, zoom, mode state machine
│   └── StageMateCameraRig.cs         # Camera rig framing, Face Zoom toggle, FOV, solid/alpha clear
├── Companion/
│   ├── StageMateTactileHandler.cs    # Hand-holding IK, head petting, heart/blush FX, Ki-lift aura
│   ├── StageMateLocomotion.cs        # Window top sitting (2 poses), taskbar walk, edge peeking, gravity
│   └── StageMatePlushBed.cs          # Floating macaron bed, props & companion resting furniture
└── Models/
    ├── IStageModelDriver.cs          # Universal interface (Load, SetPosition, SetExpression, SetLipSync)
    ├── VrmModelDriver.cs             # UniVRM driver (isolated, clean, UniversalBlendshapes, ChibiToggle)
    ├── VrmSwayDriver.cs              # Inertial posture swaying & natural breathing physics
    ├── MmdModelDriver.cs             # (Future) PMX/VMD driver
    ├── SpineModelDriver.cs           # (Future) Spine-Unity runtime driver
    └── Live2DModelDriver.cs          # (Future) CubismFramework driver
```

---

### 10. The Unified Mode Architecture & Cherry-Picked Feature Catalog

Based on empirical testing of the compiled base player (`MateEngineX.exe`), we unify the stage modes so that **`tactileMode` is the full native desktop companion experience**:

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              AIRI STAGE VIEWPORT MODES                                │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  🌟 'tactileMode' (Default - Full Desktop Companion Mode):                            │
│     • Gaze & Head Follow (AIRI-driven stage:vrm:gaze coordinate stream)               │
│     • Hand Holding IK (hand tracks cursor within interaction radius)                  │
│     • Head Petting & Heart Particles (rubbing head triggers blush + voice + hearts)   │
│     • Real-time Cast Desktop Drop Shadow (projects onto apps & wallpaper)             │
│     • Window & Taskbar Sitting (Pose 1: Dangle legs; Pose 2: Lie down kicking heels)  │
│     • Monitor Edge Peeking & Gravity Drop when windows close                          │
│     • Waist-Grab Window Move (replaces clumsy corner handles with natural dragging)   │
│     • Floating Macaron Plush Bed Mode & Props (relaxing companion furniture)          │
│     • Chibi Bobblehead Mode (universal Humanoid bone scaling)                         │
│     • Posture Swaying & Breathing Inertia (spring-damper physics)                     │
│     • Radial Pie Context Menu & Face Zoom toggle                                      │
│                                                                                       │
│  🔧 'dragMode':                                                                       │
│     • Temporarily pauses companion tactile triggers so LMB pans model coordinates     │
│                                                                                       │
│  🎥 'orbitMode':                                                                      │
│     • Temporarily pauses companion tactile triggers so LMB orbits camera 360°         │
│                                                                                       │
│  📐 'positionMode':                                                                   │
│     • Precise coordinate placement & numerical scale adjustment                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

#### Final Cherry-Picked Component Matrix

| Feature Area | Source Script | Architectural Decision |
|---|---|---|
| **Cast Desktop Drop Shadow** | `TransparentShadow.shader` / `ShadowOnly.shader` | ✅ **Core Rig (`StageMateShadowRig.cs`)**: Real-time directional shadow cast onto transparent desktop. |
| **Hand Holding IK** | `HandHolder.cs` | ✅ **Tactile Layer**: Arm IK reaches out to hold cursor when hovered near hands. |
| **Head Petting & Hearts** | `PetVoiceReactionHandler.cs` / `AvatarParticleHandler.cs` | ✅ **Tactile Layer**: Petting head triggers happy facial expressions, audio, and floating heart particles. |
| **Waist Drag & Ki Aura** | `AvatarDragSoundHandler.cs` / `TransformFX` | ✅ **Tactile Layer**: Dragging avatar by waist moves window directly, replacing external corner handles. |
| **Window Sitting & Dangles** | `AvatarWindowHandler.cs` | ✅ **Locomotion Layer**: Latch onto title bars with 2 sit poses (dangling legs / lying kicking heels). |
| **Edge Peeking & Gravity** | `AvatarHideHandler.cs` / `AvatarGravityController.cs` | ✅ **Locomotion Layer**: Snaps behind monitor bezels and drops with gravity when windows close. |
| **Macaron Plush Bed** | `AvatarSleepController.cs` / Mod items | ✅ **Companion Layer**: Floating macaron resting bed for idle / sleep states. |
| **Radial Pie Menu** | `CircleSelector.cs` | ✅ **Overlay Layer**: Context radial selector for quick stage actions. |
| **Face Zoom In/Out** | Camera Rig preset | ✅ **Camera Layer**: Instant facial close-up toggle. |
| **Chibi Mode** | `ChibiToggle.cs` | ✅ **Model Layer**: Universal Humanoid bone scaling (works on 100% of VRM models). |
| **Posture Swaying & Inertia** | `AvatarSwayController.cs` | ✅ **Model Layer**: Spring-damper physics on hips/limbs during movement. |
| **Universal Blendshapes** | `UniversalBlendshapes.cs` | ✅ **Model Layer**: VRM 0.x / 1.0 normalization and smooth dampening. |
| **Modular Outfit Toggles** | `AccessoiresHandler.cs` | 🚀 **Phase 2**: Map to AIRI's `extensions.airi.outfits` schema. |
| **MMD Dance Player** | `AvatarDancePlayer.cs` | 🚀 **Phase 2**: Wire into `airi::beat-sync` and `<|ACT:motion="dance"|>`. |

---

### 11. Architecture Pivot: Subtractive Adaptation of Production Scene over Cleanroom Synthesis

#### Empirical Finding (2026-08-17)
During the Phase 1 decomposition execution, we attempted a **cleanroom scene synthesis** approach (`MateSidecarScene.unity`), constructing empty scenes programmatically in Unity batchmode with custom components (`VrmModelDriver`, `StageMateCameraRig`, `StageMateWindowManager`, `VrmSwayDriver`).

While the modular C# contracts and WebSocket state-sync protocol succeeded, cleanroom synthesis on Windows 11 / Direct3D 11 exposed severe engine-level friction:
1. **Hidden Engine State & Shader Compositing**: Unity scenes carry implicit settings (Lighting ambient modes, skybox passes, PostProcessLayer alpha retention with `keepAlpha: 1`, DWM swapchain flags, LayerMasks). In an empty scene, Direct3D 11 compositing with `DwmExtendFrameIntoClientArea` renders transparent backgrounds as solid white if any lighting, MSAA, HDR, or shadow pass writes opaque alpha.
2. **Re-inventing Calibrated Systems**: Mate-Engine's original scene (`Mate Engine Main.unity`) represents years of tuning: physics spring-damper curves, smooth crossfade curves, shadow projector shaders, pie menus (`CircleSelector.cs`), multi-layer animations, and lighting rigs. Cleanroom synthesis requires reverse-engineering each delicate visual detail by hand.

#### The Pivot Decision
**Pivot from Cleanroom Synthesis to Subtractive Adaptation**:
- **Strategy**: Use the tested, production-grade `Mate Engine Main.unity` scene as the base canvas.
- **Implementation**:
  1. Attach a lightweight **`StageMateBridge`** component to `Mate Engine Main.unity`.
  2. The bridge connects to AIRI WebSocket IPC (`ws://localhost:6171`), receives viewport/mode/model sync events, and routes them to Mate Engine's existing native controllers (`AvatarAnimatorController`, `UniWindowController`, `VrmLoader`).
  3. Strip/bypass standalone standalone UI menus that AIRI doesn't need (or let AIRI drive them via IPC).
- **Benefits**:
  - Out-of-the-box native transparency and real-time desktop drop shadows.
  - Battle-tested, fluid idle transitions, breathing, and physics springs without drift.
  - Zero-effort inheritance of the radial pie context menu (`CircleSelector.cs`), perspective zoom, and physics interactions.
  - Minimal maintenance surface: a single clean bridge script rather than rebuilding the entire Unity engine runtime.

---

### 12. AIRI Sensor-Driven Window Sitting & Anti-Cheat Safe Relay (Deferred / Future Roadmap)

#### Background & Mechanics
In base Mate-Engine, the **"Window and Taskbar Sitting"** feature enables the avatar to sit on foreground application windows and the taskbar, swaying when windows move and dropping with gravity when closed.
However, in base Unity on Windows, this is achieved by polling Win32 OS APIs (`GetForegroundWindow`, `EnumWindows`, `GetWindowRect`, and `SHAppBarMessage(ABM_GETTASKBARPOS)`).
- **Anti-Cheat Warning**: Kernel-level game anti-cheats (Vanguard, Easy Anti-Cheat) frequently flag background software running `EnumWindows` loops as unauthorized screen hooks or overlay cheats.
- **macOS Incompatibility**: These Win32 DLLs do not exist on macOS, causing `DllNotFoundException` crashes when invoked directly.

#### Architectural Proposal (AIRI Sensor Pipeline)
Rather than maintaining platform-specific C#/P-Invoke window scanners in Unity, AIRI already has a native OS sensor engine in Electron Main (`active-window-and-idle-time` / AppleScript / Cocoa `CGWindowListCopyWindowInfo`):
1. **AIRI Proactivity Sensor**: Electron Main tracks the active foreground window coordinates $(X, Y, W, H)$ across macOS, Windows, and Linux safely.
2. **WebSocket Event Relay**: When window sitting is enabled, AIRI emits:
   ```json
   {
     "type": "stage:active-window:bounds",
     "data": {
       "x": 350,
       "y": 120,
       "width": 900,
       "height": 600,
       "title": "Visual Studio Code"
     }
   }
   ```
3. **Engine Snapping**: `AvatarWindowHandler` consumes the relayed coordinates to snap the avatar to the title bar and trigger the sitting animation.
4. **Status**: **DEFERRED (Phase 2+)**. We will circle back to this once the core companion stage and blendshape/lip-sync flows are finalized.

---

## 📅 Roadmap & Next Steps

### Phase 0 — Prototype Spike (✅ Complete)
1. ✅ **Headless mock harness**: `apps/stage-mate/harness` — raw `ws` server on `:6171` with handshake & token verification.
2. ✅ **Mate-Engine sidecar**: C# WS client (`MateSidecar.cs`) with multi-source auth discovery, zero-trust token handshake, and solid status indicator dot.
3. ✅ **Dynamic Model Cache Gate (Option A)**: Stateless query-first cache gate in Electron Main (`userData/stage-mate-cache/`) with atomic write safety and in-flight deduplication.
4. ✅ **Control Strip Customizer Integration**: Added `stage-mate` toggle to `CUSTOMIZER_CATALOG`, with live status dot and action handlers.

### Phase 1 — State Sync, Viewport Controls & Subtractive Bridge (🔄 Active Pivot)
1. ✅ **`stage:state:sync` Post-Handshake Bootstrap**: Unified state snapshot emission from Electron Main / `StageMateService` (window bounds, model path, positioning, mode, visibility).
2. ✅ **Tier 1 & Tier 2 Positioning**: Desktop window bounds saved to `config.json`, and in-canvas model offsets committed to `usePositioningStore`.
3. ✅ **LookAt Decoupling & Fix**: Explicitly neutralized UniVRM LookAt components when gaze is inactive to eliminate head inversion.
4. ✅ **Clean Source Overlay (`unity-src/`)**: Isolated all custom code into `apps/stage-mate/unity-src/` and verified multi-platform build scripts.
5. ✅ **Base Mate-Engine Feature Tour**: Evaluated upstream capabilities and finalized the cherry-picking architecture.
6. ✅ **Modular IPC & StateSync Proof-of-Concept**: Validated WebSocket state sync, protocol envelopes, and dynamic model resolver (`feat(stage-mate)` snapshot).
7. ✅ **Cross-Platform NAudio / Win32 Guards**: Guarded Windows-only APIs in `AvatarAnimatorController`, `AvatarGravityController`, `AvatarWindowHandler`, `IgnoredAppsManager`, and `SettingsMenuPosition` for 100% clean macOS / Windows parity.
8. ⏳ **Subtractive Adaptation of `Mate Engine Main`**: Hook `StageMateBridge.cs` into `Mate Engine Main.unity` native controllers, disable redundant standalone UI, and verify native transparency + pie menu.
9. ⏳ **Live Lip-Sync Relay**: Connect `stage:vrm:lip-sync` RMS stream to Mate Engine mouth blendshapes.

---

### Phase 2 — Extended Companion Actions:
- Deferred: AIRI Sensor-Driven Window Sitting & Anti-Cheat Safe Relay (`stage:active-window:bounds`).
- Modular outfit swapping via `extensions.airi.outfits` (`<|ACT:costume="..."|>`).
- MMD Dance Player integration via `airi::beat-sync` (`<|ACT:motion="dance"|>`).
- Centralized vision/gaze tracking (`stage:vrm:gaze`).
- Automatic sidecar executable lifecycle management (`execProcess`).

---

## 13. The Golden Breakthrough: Workspace Purity & The Two Independent Stages

### 13.1. Golden Rule of Workspace Purity (`apps/stage-mate/unity-src/`)
In earlier development passes, direct edits to `apps/stage-mate/mate-engine/` (a gitignored clone of upstream) caused persistent serialized state corruption, phantom coordinate offsets, and interaction lockouts.

**The Immutable Standard**:
- `mate-engine/` is a pristine upstream clone (`origin/main`) and is **never edited directly**.
- All persistent custom code, bridges, telemetry probes, and patches live strictly in `apps/stage-mate/unity-src/` (`Assets/`, `Patches/`, `ProjectSettings/`).
- Every build command automatically runs `pnpm -F @proj-airi/stage-mate run engine:setup` (`scripts/setup.ts`), which overlays `unity-src/` onto `mate-engine/`.

### 13.2. Resolution of the 5 Interaction Lockout Gates
Through diagnostic telemetry probing (`MateTelemetryProbe.cs`), we identified and unlocked all 5 gates required for 100% smooth companion physics and Ki dragging:
1. **`TutDone`**: Auto-marked `tutorialDone = true` in `SaveLoadHandler.Instance.data`.
2. **`TutActive`**: Auto-dismissed `TutorialMenu` on startup.
3. **`MoveBlocked`**: Deactivated lingering modal canvases (`SettingsMenuCanvas`, etc.) on boot.
4. **`Radial Scale-Check`**: Replaced upstream `localScale.x > 0.01f` with semantic boolean `radialMenu.opened` in `MenuActions.IsRadialOpen()`.
5. **`EventSysActive`**: Auto-instantiated/activated Unity `EventSystem` + `StandaloneInputModule` for 2D UI pointer raycasts.

### 13.3. Two Independent Stages Architecture
AIRI maintains two completely independent stage toggle lanes:
1. **`stageEnabled`** (`settings/stage-enabled`): Primary Electron 2D/3D WebGL Actor Stage window (`electronStageToggleVisibility`).
2. **`stageMateEnabled`** (`settings/stage-mate-enabled`): Unity Desktop Companion Runtime (`electronStageMateToggleVisibility` $\rightarrow$ `control:stage`).
3. **Global Always-on-Top (`alwaysOnTop`)**: Dispatches `electronStageSetAlwaysOnTop`, which sets `deps.stageWindow.setAlwaysOnTop` AND broadcasts `{ type: 'control:always-on-top', data: { enabled } }` to Stage-Mate (`LibUniWinC.SetTopmost`).

### 13.4. Canonical Upstream Pin & The Hard Purity Lesson
- **Canonical Remote**: `https://github.com/shinyflvre/Mate-Engine.git`
- **Canonical Commit Pin**: `2c5ea6b8f4cf5e1773a0816b46d9267cda5174d4` (`2c5ea6b8` — *"Prepare 3.4 Features"*)
- **Clean Slate Script**: `pnpm -F @proj-airi/stage-mate run engine:clean` (executes `git -C apps/stage-mate/mate-engine reset --hard 2c5ea6b8 && git -C apps/stage-mate/mate-engine clean -fd`).
- **Durable Post-Mortem Lesson**: Never allow agents or developers to touch `mate-engine/` directly. During cross-platform development on macOS, direct mutations to `mate-engine/` caused 6–8 hours of painful regressions that vanished the instant the folder was purged back to `2c5ea6b8`. Workspace purity via `unity-src/` overlay is mandatory.






