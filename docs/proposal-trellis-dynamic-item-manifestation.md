# Proposal: Dynamic Item & Scene Manifestation via TRELLIS, Hi3D 1.0, PhysAg3D, Fire3D & PURE Pipelines

> **Status**: Proposed RFC
> **Document**: `docs/proposal-trellis-dynamic-item-manifestation.md`
> **Target Audience**: Core Developers, 3D Graphics Engineers, ComfyUI Integrators
> **Key References**: `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts`, `packages/stage-ui/`

This document outlines the architectural design for allowing AI characters to dynamically generate, query, and equip physical 3D items on their bodies (via ComfyUI **TRELLIS**, **Hi3D 1.0**, and **PhysAg3D**), as well as decompose entire real-world or generated images and videos into interactive, simulation-ready 3D scenes with separate editable meshes (via **Fire3D** and **PURE**).

---

## 🧭 1. Vision & Goals

Currently, characters can change their baseline model settings, workflows, and textures. This proposal extends their physical agency across two complementary tiers:

*   **Tier 1: Item-Level Manifestation (TRELLIS, Hi3D 1.0 & PhysAg3D)**:
    *   **TRELLIS**: Fast real-time single-item generation from natural language prompts (e.g., a "pink wizard hat", a "glowing gold bracelet", or a "steampunk raygun") mounted dynamically to avatar skeletal bone sockets.
    *   **Hi3D 1.0**: High-detail open-source 3D generator (7.74 GB weights, consumer GPU compatible) creating complex 3D meshes with superior surface detail from single image references or detailed prompts, serving as an advanced asset generation engine alongside TRELLIS.
    *   **PhysAg3D (Articulated & Deformable Kinetic Props)**: Open-source single-image 3D pipeline (Supra-3D, MIT License) generating interactive 3D assets complete with **articulated movable parts** (rotating camera lenses, folding laptop hinges, opening music box lids) and realistic soft-material pressure deformation. Elevates static rigid props into functional, physically reactive gadgets that companions can manipulate and interact with.
*   **Tier 2: Environment-Level Scene Decomposition & Reconstruction (Fire3D & PURE)**:
    *   **Fire3D**: Given photos, room snapshots, or ComfyUI generated art of a room, Fire3D reconstructs a **complete simulation-ready 3D scene with up to 16 separate, editable objects in under 1 minute** on a single GPU. Every object receives its own independent mesh and material information, allowing avatars to physically collide with, pick up, or sit on stage props.
    *   **PURE (Video-to-3D Reconstruction)**: Open-source 3D reconstruction model (13.2 GB) converting ordinary video clips or sequential photos into coherent 3D environments by extracting depth and motion dynamics without requiring specialized 3D LIDAR or ground-truth training datasets.
*   **Decoupled State Persistence**: Both items and decomposed scene objects are saved in IndexedDB/localforage and can be listed, equipped, positioned, or unequipped dynamically by both the user and the character.

---

## 🛠️ 2. The LLM Interface (Tool Calling)

The character's consciousness orchestrator is equipped with tools to interact with both personal accessories and stage environments:

### A. `create_stage_item` (Item Level — TRELLIS / Hi3D 1.0 / PhysAg3D)
Instructs the backend to generate a new item and attach it to a specific avatar socket or stage surface.
*   **Arguments**:
    ```json
    {
      "attachTo": "wrist" | "head" | "waist" | "ankle" | "stage_surface",
      "prompt": "description of the 3D item to generate",
      "fidelity": "fast" | "high_detail" | "articulated_kinetic"
    }
    ```
    *   `fast`: ComfyUI TRELLIS rapid mesh generation.
    *   `high_detail`: Hi3D 1.0 high-fidelity surface geometry.
    *   `articulated_kinetic`: PhysAg3D interactive articulated model with movable hinges/joints and physical deformation.

### B. `decompose_stage_scene` (Environment Level — Fire3D / PURE)
Takes a source image or video clip and reconstructs interactive 3D stage props or backgrounds.
*   **Arguments**:
    ```json
    {
      "sourceType": "image" | "video_clip",
      "imageSource": "active_background" | "webcam_snapshot" | "custom_url",
      "targetObjects": ["chair", "desk", "coffee_cup", "lamp"],
      "enablePhysicsColliders": true
    }
    ```

### C. `list_stage_items`
Queries all historically generated items and decomposed scene meshes in the inventory.
*   **Returns**:
    ```json
    {
      "equippedItems": [
        { "name": "pink_hat", "socket": "head", "engine": "hi3d_1.0" }
      ],
      "sceneObjects": [
        { "id": "obj_table_01", "name": "wooden_table", "interactive": true },
        { "id": "obj_chair_02", "name": "office_chair", "interactive": true }
      ]
    }
    ```

### D. `equip_stage_item`
Equips a previously generated item from the inventory.
*   **Arguments**:
    ```json
    {
      "name": "pink_hat"
    }
    ```

---

## ⚙️ 3. Backend Pipeline & Multi-Model 3D Integration

```
[ LLM Tool Invocation ]
        │
        ├──► create_stage_item (TRELLIS / Hi3D 1.0 / PhysAg3D) ──► Single / Articulated .glb ──► Bone Socket / Surface Mounting
        │       ├─ Fast Interactive: TRELLIS ComfyUI workflow (rapid static mesh)
        │       ├─ High Fidelity: Hi3D 1.0 (7.74 GB local weights, detailed surface mesh)
        │       └─ Articulated Kinetic: PhysAg3D (MIT, multi-part interactive hinges, deformation physics)
        │
        └──► decompose_stage_scene (Fire3D / PURE) ──► Multi-Mesh .glb Bundle / 3D Scene
                ├─ Image Decomposition: Fire3D (up to 16 segmented objects in <1 min)
                └─ Video Reconstruction: PURE (13.2 GB, video-to-3D depth & motion priors)
                                                       │
                                                       ▼
                                            [ IndexedDB Asset Store ]
                                                       │
                                                       ▼
                                            [ Stage Three.js Scene ]
                                            (Physics Colliders & Scene Props)
```

1. **Item Manifestation Engines (TRELLIS, Hi3D 1.0 & PhysAg3D)**:
   * **TRELLIS Single-Object Capture**: Uses ComfyUI TRELLIS nodes for fast Image-to-3D / Text-to-3D GLB export. Runs normalization to center geometry bounding box at `(0, 0, 0)` and scales to unit size (e.g. `0.2m`).
   * **Hi3D 1.0 High-Fidelity Asset Pipeline**: Utilizes open-source Hi3D 1.0 weights (7.74 GB, Apache-friendly execution on consumer GPUs) for complex clothing items, props, and personal companion artifacts requiring fine surface geometry beyond standard rapid generative meshes.
   * **PhysAg3D Articulated & Kinetic Engine**: Evaluates input image references via parts-decomposition and degrees-of-freedom analysis to synthesize articulated 3D models with movable joint hierarchies (revolute/prismatic joints for lenses, folding screens, container lids) and material compliance parameters for real-time physics deformation.
2. **Environment & Scene Engines (Fire3D & PURE)**:
   * **Fire3D Scene Decomposition**: Takes input snapshot or ComfyUI art, segmenting up to 16 objects in parallel on one GPU with individual mesh components and material definitions.
   * **PURE Video-to-3D Reconstruction**: Processes casual user video captures into complete 3D environment meshes without requiring labeled 3D training sets, mapping depth and motion dynamics into interactive stage backgrounds.
   * Ingested into Three.js stage with automatic collision planes, enabling characters to sit on chairs or place cups on tables.

---

## 🎨 4. Stage Mounting & Skeletal Binding

Once a GLB file is compiled, the renderer (Three.js/Three-VRM) dynamically injects the mesh into the scene:

| Socket ID | VRM (3D) | MMD (PMX) | Spine (2D) |
|---|---|---|---|
| **head** | `vrm.humanoid.getNormalizedBoneNode('head')` | Head Bone | Head Slot / Attachment |
| **wrist** | `vrm.humanoid.getNormalizedBoneNode('leftWrist')` | Wrist/Hand Bone | Hand Slot |
| **waist** | `vrm.humanoid.getNormalizedBoneNode('hips')` | Hips/Waist Bone | Hip Slot |
| **ankle** | `vrm.humanoid.getNormalizedBoneNode('leftAnkle')` | Ankle Bone | Foot Slot |

---

## 📅 5. Roadmap & Implementation Checklist

- [ ] **TRELLIS ComfyUI Workflow**: Author reference template for single-item GLB generation.
- [ ] **Hi3D 1.0 Asset Pipeline**: Integrate Hi3D 1.0 (7.74 GB) local inference script/ComfyUI node for high-detail 3D prop generation.
- [ ] **PhysAg3D Articulated Props Bridge**: Author local pipeline/wrapper for PhysAg3D (MIT) exporting articulated GLB files with movable revolute joints and collision bounds.
- [ ] **Fire3D Scene Decomposition Bridge**: Connect Fire3D multi-mesh export pipeline to ComfyUI / local worker.
- [ ] **PURE Video-to-3D Ingestion**: Establish local pipeline converting sequential video footage to textured Three.js stage background meshes.
- [ ] **Socket & Mesh Ingestion**: Implement Three.js skeletal bone mounting and scale normalizer.
- [ ] **Stage Physics & Object Collision**: Add Three.js bounding-box colliders for decomposed furniture and props.
- [ ] **Scene Object Inventory UI**: Add interactive stage props panel in Stage Customizer.
