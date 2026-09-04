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
5. **Live Parameter Calibration**: A centralized reactive VFX configuration store supporting runtime tweaking and freeze/slow-motion inspection.

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

### E. Subsystem 5: Live VFX Configuration Store (`useStageVfxStore`)

Following `LinearAbility`'s single-source-of-truth pattern (`settings.js`):
- All parameters (flame height, particle density, arc jitter, glow color, blast radius, time scale) are held in a reactive Pinia store.
- **Freeze-Frame Inspection**: The simulation can be paused (`timeScale = 0`) while parameters continue to update live, enabling instant visual tuning in AIRI's V-HACK studio or Control Strip Customizer.

---

## 🛠️ 3. Integration Points in AIRI

| Subsystem in AIRI | Integration Touchpoint | Description |
| :--- | :--- | :--- |
| **Renderer Stage** | `packages/stage-ui/src/components/scenes/RendererStage.vue` | Mounts the procedural VFX scene layer atop Three.js, sharing the camera and lighting pipeline. |
| **VRM Skeleton** | `packages/stage-ui/src/composables/use-vrm.ts` | Exposes humanoid bone transforms (`leftWrist`, `rightWrist`, `chest`, `head`) as anchor sockets for auras. |
| **ACT Token Pipeline** | `packages/stage-ui/src/composables/llm-marker-parser.ts` | Maps emotion tokens (`<|ACT:emotion="..."|>`) and kinetic cues to character aura activations and transitions. |
| **Memory / Universes** | `packages/stage-ui/src/stores/chat/session-store.ts` | Triggers portal sequence animations when switching universes or lifetime memory timelines. |
| **Tool Registry** | `apps/stage-tamagotchi/src/renderer/stores/tools/builtin/` | Registers `cast_stage_ability` and `set_character_aura` into the character's callable toolset. |
| **Control Strip Customizer** | `packages/stage-ui/src/constants/control-customizer.ts` | Exposes aura toggles, particle density, and color sliders in the user customization panel. |

---

## 📅 4. Roadmap & Milestones

- [ ] **Phase 1: Procedural Foundation**
  - Port core GLSL shader libraries (Simplex noise, Voronoi, SDF math) into `packages/stage-ui/src/libs/shaders/`.
  - Implement the GPU instanced particle manager and ribbon renderer in Three.js.
- [ ] **Phase 2: Character Aura Integration**
  - Implement `FresnelAura`, `FireBodyMaterial`, and `ArcaneRibbonMaterial`.
  - Wire bone attachment tracking to Three-VRM humanoid bones (`useVrm`).
  - Connect aura state machine to `<|ACT:emotion="..."|>` parser.
- [ ] **Phase 3: Dimensional Gate Transitions**
  - Implement `VerdantGate`, `TidewroughtRing`, and `FirePortal` meshes and materials.
  - Wire portal open/close sequence into Universe switching and Character Card loading.
- [ ] **Phase 4: Stage Abilities & Tool Calling**
  - Implement Pyre Crown, Kraken Rift, and Earthen Spire abilities.
  - Implement the 5 SDF targeting indicators for user aiming.
  - Expose `cast_stage_ability` tool for the character's LLM consciousness.
- [ ] **Phase 5: V-HACK / Customizer UI**
  - Add "VFX & Auras" tab to V-HACK DevTools and Control Strip Customizer.
