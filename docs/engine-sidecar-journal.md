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

## 📅 Roadmap & Next Steps

1. **Standalone WebSocket Handshake**: Implement `Client` handshake in MATE Engine C# client (`module:authenticate` $\rightarrow$ `module:announce`).
2. **Proxy Gateway Relay**: Add the `StageProxyGateway` service in AIRI main process to subscribe to `airi::beat-sync` and `airi-stores-live2d` and push `stage:vrm:*` WS events.
3. **Compare Resource Usage**: Benchmark CPU/GPU frame times of the Three.js WebGL canvas vs. the Mate-Engine sidecar to quantify rendering efficiency.

