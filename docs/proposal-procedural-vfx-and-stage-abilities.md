# Proposal: Real-Time Procedural VFX, Character Auras, and Elemental Abilities

This document proposes integrating a real-time, zero-texture, GPU-driven procedural VFX and ability subsystem into **AIRI**'s Three.js stage canvas, inspired by the architecture of **`LinearAbilityExtThreeJS`** (*Elemental Sandbox*).

---

## 🧭 1. Vision & Goals

AIRI's current stage rendering emphasizes 3D avatars (VRM/MMD) and 2D models (Live2D/Spine) in static or animated poses against 2D/3D backgrounds. However, the stage lacks dynamic, in-engine environmental magic, combat/action VFX, character mood auras, and physical scene transition portals.

This proposal introduces a **purely procedural, high-performance visual effects engine** with:
1. **Zero External Textures & Sprite Sheets**: All effects are rendered using real-time GLSL vertex/fragment shaders, procedural geometry, and GPU instanced particles.
2. **Bone-Tethered Character Auras**: Shaders and particle emitters physically rooted onto VRM humanoid skeleton bones, responsive to character emotions, ACT tokens, and dialogue states.
3. **Dimensional Portals & Scene Transitions**: Dynamic in-engine gateways for switching universes, changing backgrounds, or loading character cards.
4. **Interactive Stage Abilities & Tool Calling**: AI characters can cast elemental spells during roleplay, while users can aim skillshots using procedural Signed Distance Field (SDF) targeting indicators.
5. **Live Parameter Calibration & Presets**: A centralized reactive VFX configuration store supporting runtime tweaking, freeze/slow-motion inspection, and JSON-based preset authoring.
6. **Isolated Cleanroom Incubator**: Following the proven pattern of the **Live2D DSL Playground** (`/devtools/live2d`), all VFX primitives, bone attachments, and token triggers are developed and validated in a dedicated developer lab (`/devtools/stage-vfx`) before touching the production stage.

---

## 🏗️ 2. Core Subsystems

```mermaid
graph TD
    subgraph AIRI Orchestration Layer
        A[LLM Response / ACT Marker Parser] -->|'<|ACT:emotion=...|>'| B[Character Aura Controller]
        C[Chat Orchestrator / Tool Calls] -->|'cast_stage_ability'| D[Ability Manager]
        E[Universe / Scene Switcher] -->|'spawn_portal'| F[Portal Transition Engine]
    end

    subgraph Procedural Stage VFX Engine
        B --> G[Bone Attachment Module]
        D --> H[Targeting & Spawn Pipeline]
        F --> I[Procedural Gate Geometry & Shaders]

        G --> J[Humanoid Rig Sockets: Wrists, Chest, Head]
        H --> K[SDF Targeting Indicators: Line, Zone, Gate]

        J --> L[GPU Instanced Particle Engine]
        K --> L
        I --> L

        L --> M[Three.js Scene Graph / RendererStage.vue]
    end
```

---

### A. Subsystem 1: Bone-Tethered Character Auras (Self-Buffs)

AIRI characters have dynamic emotional states, mood tiers, and intimacy levels. Rather than relying solely on facial morph targets, characters can project their inner feelings through bone-bound procedural auras:

| Aura Effect | Architectural Origin | Visual Description | Emotional / ACT Trigger |
| :--- | :--- | :--- | :--- |
| **Fire Boost (`FireBodyMaterial`)** | Rig-anchored particle emitters + convective flame distortion | Procedural fire rooted to forearms and chest; embers trail behind arm movements | `<|ACT:emotion="angry"|>`, `<|ACT:emotion="flustered"|>`, Battle / Tension |
| **Electric Boost (`FresnelAura`)** | Instanced ribbon strips + high-frequency electrical arcs | Crawling arcs around limbs, Fresnel rim illumination | `<|ACT:emotion="excited"|>`, `<|ACT:emotion="focused"|>`, Computing / Analysis |
| **Magic Boost (`ArcaneRibbonMaterial`)** | Helical orbiting particles + smooth chromatic dispersion | Soft orbiting starlight ribbons, iridescent body glow | `<|ACT:emotion="blushing"|>`, `<|ACT:emotion="loving"|>`, High Intimacy |
| **Abyss / Shadow Aura** | Raymarched dark pool + inverse Fresnel absorption | Silhouette edges dissolve into smoke-like void filaments | `<|ACT:emotion="sad"|>`, `<|ACT:emotion="gloomy"|>`, Mystery |

#### Skeletal Anchoring Logic
Unlike screen-space post-processing overlays, these effects hook directly into the avatar's humanoid rig:
```typescript
// Anchor flame emitters and ribbon roots to VRM normalized bone nodes
const leftWrist = vrm.humanoid.getNormalizedBoneNode('leftWrist')
const rightWrist = vrm.humanoid.getNormalizedBoneNode('rightWrist')
const chest = vrm.humanoid.getNormalizedBoneNode('chest')

if (leftWrist && rightWrist) {
  auraController.attachEmitter('wristFlames', [leftWrist, rightWrist], {
    scaleWithVelocity: true,
    historyBufferDepth: 30, // For time-delayed ember trails
  })
}
```

---

### B. Subsystem 2: Dimensional Portals & Scene Transitions

When switching universes (Memory Pillar 1 & 5), transitioning dating-sim scenery, or swapping character cards, AIRI currently cuts or cross-fades 2D images. The procedural portal system turns transitions into 3D stage events:

1. **Verdant Gate**:
   - Procedural quarried stone blocks break out of the stage floor and swing upward to form an ancient stone archway.
   - The opening floods with swirling light and remains active until the new character or scene manifests.
2. **Tidewrought Ring**:
   - A ring is forged lying flat on the stage floor, then hinges up to stand vertically while glowing runes ignite along its circumference.
3. **Fire Portal (Scribe Cast)**:
   - A burning spark circles an arbitrary point in mid-air, striking a portal disc that throws tangential embers into the room.

These portals provide a natural narrative device: the character can "step through" a gate when switching universe contexts or welcoming another AI agent onto the stage.

---

### C. Subsystem 3: Interactive Stage Abilities & Targeting

For gaming companions, Twitch stream interactive modes, or tabletop/roleplay scenarios, characters can cast active spells on stage:

* **Pyre Crown**: Ground fissures split open; a circular crater of molten rock erupts with outward-leaning burning blades.
* **Kraken Crown**: A dark water rift appears; procedural cephalopod tentacles uncoil and rhythmically hammer the stage floor.
* **Electrical Sphere**: An energy sphere rises, capturing scene reflections with procedural arcs discharging outward.
* **Earthen Spire**: A traveling shockwave rips through the floor, erecting a stone tower surrounded by boulders.

#### Dual Interaction: User-Aimed vs. Character-Autonomous
1. **User Interaction**: Users can click or drag to aim casts using **Signed Distance Field (SDF)** targeting shapes:
   - **Line SDF**: Rounded shaft + triangle head with live chevron patterns.
   - **Far-Cast Zone SDF**: Reticle circle with constant pixel/meter boundary thickness.
   - **3D Ghost Arch SDF**: Displays the upright orientation of a gate before casting.
2. **LLM Tool Calling**: AI characters can spawn abilities autonomously:
   ```json
   {
     "name": "cast_stage_ability",
     "arguments": {
       "ability": "pyre_crown" | "kraken_crown" | "earthen_spire" | "verdant_gate",
       "target": "stage_center" | "self_feet" | "random_arena"
     }
   }
   ```

---

### D. Subsystem 4: Zero-Asset GPU Particle & Shader Architecture

Traditional WebGL games require multiple megabytes of PNG sprite sheets and pre-baked textures for smoke, sparks, and flame rings. The `LinearAbility` architecture eliminates this footprint completely:

* **Noise & Math Library**: Procedural Simplex, Voronoi, and curl noise evaluated directly inside vertex/fragment shaders.
* **Instanced Mesh Ribbons**: Lightning arcs and energy ribbons generated as instanced quad strips whose vertices are deformed in GLSL based on time, noise offsets, and spline interpolation.
* **Particle Buffers**: GPU-driven position/velocity buffers allowing 10,000+ particles at 60 FPS without touching CPU memory every frame.
* **No File Overhead**: 0 MB asset downloads; zero network lag when deploying across desktop Electron, Web, or mobile PWA.

---

### E. Subsystem 5: Live VFX Configuration Store (`useStageVfxStore`) & Presets

Following `LinearAbility`'s single-source-of-truth pattern (`settings.js`):
- All parameters (flame height, particle density, arc jitter, glow color, blast radius, time scale) are held in a reactive Pinia store.
- **Freeze-Frame Inspection**: The simulation can be paused (`timeScale = 0`) while parameters continue to update live, enabling instant visual tuning in AIRI's V-HACK studio or Control Strip Customizer.

#### Declarative Preset Architecture (How Users & LLMs Author Effects)
While authoring raw GLSL from scratch requires graphics engineering expertise, **new effects are created through Declarative JSON Presets**:
- A user or LLM does not write raw shader code; instead, they define or remix an ability or aura by adjusting its numeric and color parameters.
- **Example LLM / User Preset**:
  ```json
  {
    "id": "frost_embrace_aura",
    "name": "Frost Embrace",
    "baseAura": "fire_boost",
    "overrides": {
      "palette": {
        "core": "#E0F7FA",
        "mid": "#00E5FF",
        "edge": "#0091EA"
      },
      "flameHeight": 3.2,
      "noiseSpeed": 0.4,
      "particleCount": 800,
      "emberType": "frost_crystal",
      "sockets": ["leftWrist", "rightWrist", "chest"]
    }
  }
  ```
- This enables AI characters, character cards, and users to spawn unlimited visual variations safely without shader compile errors.

---

## 🧪 3. Isolated Cleanroom Laboratory (`/devtools/stage-vfx`)

To ensure rapid experimentation without risking regression to `RendererStage.vue` or production stage performance, development follows the exact architectural pattern established by the **Live2D DSL Playground** ([`apps/stage-tamagotchi/src/renderer/pages/devtools/live2d.vue`](../apps/stage-tamagotchi/src/renderer/pages/devtools/live2d.vue)).

```
+-------------------------------------------------------------------------+
|  Stage VFX & Aura Playground [Sandboxed]                                |
+---------------------------------------------------+---------------------+
|                                                   |  VFX INSPECTOR      |
|                                                   +---------------------+
|                                                   | Avatar: [Select VRM]|
|                                                   +---------------------+
|              [ 3D Three.js Viewport ]             | Auras (Bone-Bound): |
|                                                   | [x] Fire Boost      |
|                   Active VRM Avatar               | [ ] Electric Boost  |
|               (with live bone-attached            | [ ] Magic Starlight |
|                 procedural flames & arcs)         +---------------------+
|                                                   | Abilities & Portals:|
|                                                   | [ Cast Pyre Crown ] |
|                                                   | [ Open Verdant Gate]|
|                                                   | [ Strike Fire Portal|
|                                                   +---------------------+
|                                                   | ACT Token Simulator:|
|                                                   | Input: <|ACT:       |
|                                                   | emotion="flustered"|>|
|                                                   | [ Dispatch Token ]  |
|                                                   +---------------------+
|                                                   | Live Parameter Sliders:|
|                                                   | Flame Height: [===] |
|                                                   | Glow Color:   [===] |
|                                                   | [ Export Preset JSON] |
+---------------------------------------------------+---------------------+
```

### Lab Specifications:
1. **Catalog Entry**:
   - Register `/devtools/stage-vfx` in [`packages/stage-ui/src/constants/settings-catalog.ts`](../packages/stage-ui/src/constants/settings-catalog.ts) under `sys-developer` (Cluster: `RUNTIME & NEURAL LABS 脳`).
2. **Model Loading & Sandboxing**:
   - Uses `ModelSelectorDialog` to pull avatars from `displayModelsStore` or local file drag-and-drop.
   - Isolates model state under a sandboxed ID (`__playground__/vfx-*`), ensuring test mutations never pollute user settings.
3. **VRM Humanoid Bone Harness**:
   - Exposes normalized bone nodes (`leftWrist`, `rightWrist`, `chest`, `head`) with visual debug gizmos.
   - Allows instant toggling and live parameter tuning of bone-tethered flame emitters and ribbons.
4. **ACT Token & Ability Simulator**:
   - Provides an input field to fire test ACT tokens (`<|ACT:emotion="angry"|>`) or click ability buttons (`Pyre Crown`, `Verdant Gate`).
   - Verifies cue parsing, lifecycle transitions, and cleanup on expiry.

---

## 🛠️ 4. Integration Points in AIRI

| Subsystem in AIRI | Integration Touchpoint | Description |
| :--- | :--- | :--- |
| **Developer Laboratory** | `apps/stage-tamagotchi/src/renderer/pages/devtools/stage-vfx.vue` | Cleanroom playground hosting the interactive 3D viewport and VFX inspector. |
| **Settings Catalog** | `packages/stage-ui/src/constants/settings-catalog.ts` | Registers the tool under `sys-developer` in `RUNTIME & NEURAL LABS 脳`. |
| **Renderer Stage** | `packages/stage-ui/src/components/scenes/RendererStage.vue` | Production stage mount for the validated procedural VFX scene layer. |
| **VRM Skeleton** | `packages/stage-ui/src/composables/use-vrm.ts` | Exposes humanoid bone transforms (`leftWrist`, `rightWrist`, `chest`, `head`) as anchor sockets. |
| **ACT Token Pipeline** | `packages/stage-ui/src/composables/llm-marker-parser.ts` | Maps emotion tokens (`<|ACT:emotion="..."|>`) and kinetic cues to character aura activations. |
| **Memory / Universes** | `packages/stage-ui/src/stores/chat/session-store.ts` | Triggers portal sequence animations when switching universes or lifetime memory timelines. |
| **Tool Registry** | `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/` | Registers `cast_stage_ability` and `set_character_aura` into the character's callable toolset. |
| **Control Strip Customizer** | `packages/stage-ui/src/constants/control-customizer.ts` | Exposes aura toggles, particle density, and color sliders in the user customization panel. |

---

## 📅 5. Roadmap & Phased Implementation

- [ ] **Phase 1: Developer Cleanroom Playground (`/devtools/stage-vfx`)**
  - Register `/devtools/stage-vfx` in `settings-catalog.ts` and author `stage-vfx.vue`.
  - Port core GLSL shader math (Simplex/Voronoi noise, SDFs) into `packages/stage-ui/src/libs/shaders/`.
  - Wire VRM model picker and Three-VRM bone socket inspector.
- [ ] **Phase 2: Bone-Attached Character Auras**
  - Port `FireBodyMaterial`, `FresnelAura`, and `ArcaneRibbonMaterial`.
  - Bind emitters to `leftWrist`, `rightWrist`, and `chest` bones.
  - Implement the ACT token simulator in the playground.
- [ ] **Phase 3: Declarative Presets & Live Inspector**
  - Build the live parameter slider panel and JSON preset exporter.
  - Test custom preset authoring (e.g. converting Fire Boost into Frost Embrace or Shadow Void).
- [ ] **Phase 4: Dimensional Gate Transitions**
  - Port `VerdantGate`, `TidewroughtRing`, and `FirePortal` procedural meshes.
  - Wire portal open/close sequence into Universe and Dating Sim scene switches.
- [ ] **Phase 5: Stage Abilities & Tool Calling**
  - Port Pyre Crown, Kraken Rift, and Earthen Spire abilities.
  - Port the 5 SDF targeting indicators for interactive mouse aiming.
  - Register `cast_stage_ability` into the LLM tool registry.
- [ ] **Phase 6: Production Stage Rollout**
  - Promote validated modules from `/devtools/stage-vfx` into `RendererStage.vue` and the Control Strip Customizer.
