# Proposal: Generative 3D Stage Environments & Room Synthesis via SceneBloom

> **Status**: Proposed RFC
> **Document**: `docs/proposal-scenebloom-generative-3d-environments.md`
> **Target Audience**: 3D Environment Artists, Stage UI Engineers, Autonomous Artistry Integrators
> **Key References**: `docs/proposal-trellis-dynamic-item-manifestation.md`, `docs/design-desktop-ambient-lighting.md`, `docs/proposal-state-driven-autonomous-director.md`

---

## 🧭 1. Executive Summary & Vision

AIRI’s stage environments are currently limited to flat 2D wallpapers or generated 2D background art (`airi-scenes-backgrounds`). When 3D avatars (VRM, MMD, or Stage-Mate Unity sidecars) stand in front of flat 2D images, several visual limitations emerge:
1. **Perspective Disconnection**: Moving the camera or tilting the stage breaks the perspective between the 3D character and the 2D background.
2. **Lack of Physical Depth & Occlusion**: Characters cannot walk behind a desk, sit on a couch, or cast accurate 3D shadows onto nearby walls and furniture.
3. **Static Lighting**: 3D mascot shaders cannot receive realistic spatial lighting bounce from their surroundings.

**SceneBloom** bridges this gap by enabling **Text-to-3D Room Synthesis**:
* Ingests natural-language environment prompts (e.g., *"a cozy cyberpunk hacker bedroom with dual monitors, plush sofa, and bookshelf"*).
* Splits the room into functional zones (work, sleep, lounge) and uses Flux for spatial arrangement generation.
* Assembles a physically consistent 3D scene using modular 3D asset libraries, ensuring furniture faces the right direction with zero collision overlap.
* Exports a clean, interactive 3D scene compatible with Three.js and Unity.

---

## 🛋️ 2. Architectural Pipeline in AIRI

```
┌─────────────────────────────────┐
│ Prompt: Character Lore or User  │
│ "Victorian study with fireplace"│
└─────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ SceneBloom Generation Bridge                           │
│ 1. Functional Zone Segmentation (AI Planner)           │
│ 2. Furniture Layout Generation (Flux Spatial Prior)     │
│ 3. 3D Mesh Assembly & Collider Optimization            │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ Stage Asset Ingestion & Storage                        │
│ • Bundle: Scene `.glb` + Collision Volumes             │
│ • IndexedDB `local:stage:environments`                 │
└────────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ AIRI 3D Stage Viewport (Three.js / Stage-Mate)         │
│ • Dynamic Ambient Lighting Bounce                      │
│ • Character Pathing & Seating Colliders                │
│ • Camera Parallax & Depth Occlusion                   │
└────────────────────────────────────────────────────────┘
```

---

## 🌟 3. Killer Companion Features

1. **Persona-Scoped Living Quarters**:
   * Character cards can ship with or generate their own 3D home environments reflecting their personality, backstory, and aesthetic.
2. **Autonomous Redecorating (Director Integration)**:
   * During long-term companionship, the Autonomous Director can prompt the companion to rearrange furniture, buy new posters, or add seasonal decorations (e.g. holiday themes).
3. **True Spatial Collision & Navigation**:
   * Combined with **MotionBricks** (`proposal-motionbricks-realtime-kinematics-and-beat-sync.md`), the companion can navigate around the desk, sit on the bed, or lean against the wall.

---

## 📅 4. Implementation Roadmap

- [ ] **Phase 1: Three.js Environment Loader**: Implement modular GLB scene loader with shadow planes and camera limits in `packages/stage-ui-three/`.
- [ ] **Phase 2: SceneBloom ComfyUI / Local Worker Bridge**: Package SceneBloom's layout generation and asset binding into a cleanroom local script or ComfyUI custom node.
- [ ] **Phase 3: Stage Background Selector Extension**: Update `packages/stage-ui/src/stores/background.ts` to support `3d-scene` type alongside existing `image` and `color` backgrounds.
- [ ] **Phase 4: Dynamic Lighting Sync**: Connect SceneBloom environment lights to AIRI's screen bounce and ambient lighting subsystem.
