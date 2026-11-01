# Proposal: Real-Time Kinematic Inbetweening & Beat-Synced Dancing via NVIDIA MotionBricks

> **Status**: Proposed RFC
> **Document**: `docs/proposal-motionbricks-realtime-kinematics-and-beat-sync.md`
> **Target Audience**: 3D Animation Engineers, Unity Stage-Mate Developers, Sound Studio / DJ Integrators
> **Key References**: `docs/design-text-to-motion.md`, `docs/proposal-trellis-dynamic-item-manifestation.md`, `docs/proposal-comfyui-generative-music-dj-engine.md`, `docs/design-engine-sidecar-journal.md`

---

## 🧭 1. Executive Summary & Problem Space

AIRI currently features two main paradigms for avatar animation:
1. **Discrete Semantic Motion (Text-to-Motion / FlowMDM)**: Procedural LLM keyframes or WebGPU neural diffusion that takes natural-language text prompts (e.g. *"wave enthusiastically"*) and generates a discrete, multi-second `.vrma` animation clip.
2. **Fixed Animation Playback (MMD & Live2D Loops)**: Pre-baked looping animation clips (e.g. `AvatarDancePlayer.cs` in Stage-Mate, idle sway loops, or fixed dance choreography).

### The Missing Piece: Real-Time Kinematic Inbetweening
While Text-to-Motion handles high-level semantic intent, it **cannot** handle real-time responsive physical movement:
* It cannot continuously adapt an avatar's body to arbitrary music beats in real time.
* It cannot smoothly transition between arbitrary, interrupted poses without jarring pops or manual linear quaternion SLERP.
* It cannot guide an avatar's limbs to dynamically reach for and grab dynamically generated 3D items (from the **TRELLIS** pipeline) or sit down on decomposed 3D stage furniture.

**NVIDIA MotionBricks** provides the solution: an ultra-fast (~15,000 FPS, ~2ms latency), lightweight (~800 MB open model weights) autoregressive neural controller trained on over 350,000 motion clips. Rather than doing text-to-motion, MotionBricks takes a character's recent skeletal pose history plus sparse target poses/trajectories and predicts physically natural, organic in-between transitions in real time.

---

## 🎵 2. Core Application: Real-Time Beat-Synchronized Dancing

AIRI's **Sound Studio & AI DJ Engine** (`chat_music.vue`, `proposal-comfyui-generative-music-dj-engine.md`) allows companions to stream music, compose original tracks, and act as autonomous DJs. However, avatar dancing to this music has historically been restricted to static, pre-recorded MMD dance clips that loop regardless of musical tempo and cannot react dynamically.

---

## 🎭 3. The Zero-Asset Generative Dance Loop: FlowMDM (Choreographer) ➔ MotionBricks (Performer)

A central challenge in music-reactive avatar systems is where the choreography comes from.

Traditional approaches (such as clip-array mixers) suffer from **manual authoring debt**: developers must manually download, clean, retarget, and tag dozens of pre-baked `.vrma` clips per musical genre (EDM, rock, waltz, hip-hop), while linear cross-fades between clips introduce foot-sliding and hip popping.

AIRI eliminates pre-baked clip authoring by unifying **FlowMDM** (Text-to-Motion neural diffusion) with **MotionBricks** (real-time kinematic inbetweening):

```
[ Music Stream / Track Metadata / Persona Prompt ]
"hardcore EDM shuffle" | "ballroom waltz" | "headbang rock stomp"
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ FlowMDM Neural Diffusion (WebGPU, ~2s)                 │  ◄── THE CHOREOGRAPHER
│ • Synthesizes 196-frame HumanML3D tensor               │      (Understands stylistic body shape)
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Key-Pose Extractor (<5ms)                              │  ◄── THE DANCE SHEET
│ • Extracts 4–8 salient anchor key-poses from tensor    │      (Sparse target postures)
│ • Caches palette in localforage: `dance-palette:{tag}` │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ Beat Tracker & OpenJev (ModernBERT) Conductor          │  ◄── THE CONDUCTOR
│ • Detects live downbeats, tempo shifts, and breaks     │      (Selects target pose on musical time)
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ MotionBricks Real-Time Engine (2ms, ~15,000 FPS)       │  ◄── THE PERFORMER
│ • Computes smooth continuous inbetweening from live    │      (Physical execution with zero sliding)
│   skeleton pose to selected FlowMDM target key-pose    │
└────────────────────────────────────────────────────────┘
```

### The Division of Labor:
1. **FlowMDM = The Choreographer / Stylist**:
   * FlowMDM's weakness is that it generates fixed 20 FPS motions over 5–9 seconds with zero real-time audio reactivity.
   * However, it has deep semantic comprehension: prompting it with *"ballroom ballad"* vs *"hard rock groove"* vs *"playful idol pop"* yields authentic stylistic postures. It is called once per genre or song in the background (~2s) to seed the pose palette.
2. **Key-Pose Extraction (The Dance Sheet)**:
   * A lightweight script evaluates the 196-frame HumanML3D tensor, selecting 4–8 frames exhibiting local extrema of angular displacement (e.g. peak arm extensions, hip sways, stomps).
   * These sparse frames become the target key-poses for that song.
3. **OpenJev (ModernBERT) & Web Audio = The Conductor**:
   * Measures live audio tempo (BPM), spectral flux, and downbeat transients.
   * OpenJev classifies the macro-section (buildup, drop, breakdown, sudden silence) and schedules the next target key-pose from the active palette onto the incoming beat.
4. **MotionBricks = The Real-Time Performer**:
   * MotionBricks takes the avatar's current physical joint rotations and calculates the continuous in-between trajectory to the selected target key-pose in under 2ms.
   * **Zero Foot-Sliding**: Unlike standard linear interpolation between clips, MotionBricks maintains foot contacts and rotational momentum.
   * **Elastic Tempo Matching**: Whether a track plays at 80 BPM or 160 BPM, MotionBricks naturally scales its trajectory duration without warping audio or animations.

### Personalized Companion Interpretation:
Different character cards interpret the same song differently:
* An energetic idol companion prompts FlowMDM with `energetic idol bounce, expressive gestures`.
* A stoic or gothic companion prompts FlowMDM with `subtle rhythmic sway, reserved stance`.
Both companions dance to the exact same track, but with completely unique, character-faithful choreography.

---

## 🪑 4. Symbiosis with TRELLIS Dynamic Items & Stage Props

In [`docs/proposal-trellis-dynamic-item-manifestation.md`](./proposal-trellis-dynamic-item-manifestation.md), AIRI specifies an architecture for generating 3D items (hats, drinks, instruments) and decomposing background scenes into interactive 3D furniture (chairs, desks).

MotionBricks solves the physical interaction problem:
* **Dynamic Reaching & Equipping**: When `create_stage_item` spawns a coffee mug on a desk, MotionBricks receives a target hand transform corresponding to the mug's handle socket. It computes natural upper-body kinematics for the avatar to reach, grasp, and hold the prop.
* **Seating & Obstacle Interaction**: When `decompose_stage_scene` identifies a chair, the companion can sit down naturally because MotionBricks predicts the hip descent and knee flexion needed to meet the seat's bounding plane.

---

## 🏗️ 5. Architectural Placement & Runtime Options

### Option A: Dedicated Stage-Mate C# Runtime (Primary Recommended)
* **Location**: `apps/stage-mate/unity-src/Assets/Scripts/MotionBricks/`
* **Mechanism**: Runs the ONNX/Sentis runtime directly inside the Unity desktop companion sidecar.
* **Why this works**: Stage-Mate already hosts the high-fidelity VRM model, physics colliders, and MMD dance player. Ingesting MotionBricks as a native C# Unity job utilizes GPU compute with zero Electron bridge serialization overhead.

### Option B: Local Electron / Python Sidecar
* For Three.js stages in `apps/stage-tamagotchi`, MotionBricks can be hosted as an ONNX Runtime service emitting bone rotation arrays over local shared memory or WebSocket (`stage:motion:stream`).

---

## 📅 6. Implementation Roadmap

- [ ] **Phase 1: Model Ingestion & ONNX Benchmark**: Test the 800 MB MotionBricks checkpoint under ONNX Runtime / Unity Sentis for latency benchmarks (<5ms target).
- [ ] **Phase 2: FlowMDM Key-Pose Extractor**: Build a utility in `packages/stage-ui/src/utils/flowmdm/` to sample 4–8 anchor keyframes from synthesized 196-frame tensors.
- [ ] **Phase 3: Beat-to-Keypoint Conductor**: Connect Web Audio beat-detector in `chat_music.vue` and OpenJev (ModernBERT) to schedule key-poses on live musical downbeats.
- [ ] **Phase 4: Stage-Mate Integration**: Implement `MotionBricksDriver.cs` in `apps/stage-mate/unity-src/` executing real-time inbetweening between selected key-poses.
- [ ] **Phase 5: TRELLIS Socket Reaching**: Connect item socket transforms to MotionBricks reaching targets for dynamic prop manipulation.
