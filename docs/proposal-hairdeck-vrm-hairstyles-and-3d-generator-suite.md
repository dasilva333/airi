# Proposal: HairDeck VRM Hairstyle Synthesis & Unified 3D Generator Backend Suite

> **Status**: Proposed RFC (Architectural Blueprint)
> **Document**: `docs/proposal-hairdeck-vrm-hairstyles-and-3d-generator-suite.md`
> **Target Audience**: 3D Graphics Engineers, Desktop System Architects, Model Customizer Integrators
> **Key References**: `docs/proposal-idol-3d-gaussian-splatting-sidecar.md`, `docs/design-model-customizer.md`, `docs/design-modular-outfits-system.md`, `docs/design-vrm-outfits.md`, `docs/proposal-trellis-dynamic-item-manifestation.md`, `packages/stage-ui/src/components/scenarios/settings/model-settings/ModelCustomizer.vue`, `packages/stage-ui-three/src/components/Model/VRMModel.vue`

---

## 🧭 1. Executive Summary & Vision

### The Problem: Rigid 3D Avatars and Hairstyle Lock-in
In stylized 3D avatar workflows (VTubers, game companions, VRM avatars), character hairstyles are deeply coupled to the base 3D model. Swapping a hairstyle conventionally requires specialized 3D digital content creation (DCC) software such as Blender or VRoid Studio:
1. Manually identifying and severing hair meshes from the skull.
2. Modeling or acquiring replacement hair cards with appropriate anime UV layouts.
3. Building bone armatures, parenting them to the humanoid `head` bone, weight-painting the roots.
4. Setting up spring-bone dynamics (`VRMC_springBone` or Unity DynamicBone/PhysBone) so the hair moves and bounces naturally during head motion.

For companion companions in AIRI, this friction prevents dynamic visual expression (e.g. asking for a new haircut, switching styles for a storyline, or generating a hairstyle to match concept art).

### The Solution: HairDeck
**[HairDeck](https://github.com/hyz317/HairDeck)** (*"Animation-Ready Stylized Hair Cards from a Single Image"*, Tsinghua / CMU / CUHK) solves this exact bottleneck. Given a single 2D character reference image or hairstyle concept:
* It generates **stylized 3D hair cards** (GLB) with clean anime UVs and vertex colors.
* It predicts **spring-bone hierarchies** (`chains_seedN.json`) designed to align with VRM physics specifications.
* It operates via an unordered set diffusion transformer (DiT) on hair card tokens, completing inference in approximately **~1 second**.

### Architectural Decision: A Dedicated "3D Generator Suite"
Earlier experiments with **IDOL (3D Gaussian Splatting)** verified the need for an external companion backend (e.g. running on Windows 11 with an NVIDIA RTX GPU or Apple Silicon MPS) rather than overloading WebGPU inside the Electron renderer.

However, requiring users to install and manage separate ad-hoc Python scripts for every new 3D model (one for IDOL splats, one for HairDeck hair cards, one for TRELLIS props) introduces excessive setup friction. Similarly, forcing the entire workflow through ComfyUI adds significant setup complexity with custom nodes and pipeline orchestration.

### Architectural Invariant: Client-Side VRM Exporting via Hacker Studio (V-HACK)
HairDeck upstream ships with a Python script that invokes a headless Blender 4.2 LTS instance to repack VRM files. **We explicitly reject introducing a headless Blender dependency into AIRI.**
AIRI already possesses a battle-tested, in-browser GLB/VRM surgical exporter in **Hacker Studio (V-HACK)**:
* Located at [`hacker-studio/adapters/vrm/glb-exporter.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/glb-exporter.ts) and [`use-vrm-hacker-adapter.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/use-vrm-hacker-adapter.ts).
* Pure TypeScript / ArrayBuffer parser that executes in-memory glTF JSON/BIN chunk surgery, handles primitive hiding (`VHACK_HIDDEN`), bufferView alignment, and outputs a validated binary `.vrm` directly in the renderer.
* Rather than reinventing the wheel with external 3D software, the export pipeline extends Hacker Studio's `glb-exporter.ts` to perform surgical mesh injection (appending the hair card bufferViews and parenting the node to the head bone) completely client-side.

**This RFC defines two unified subsystems:**
1. **Frontend**: A dedicated **"Hairstyles" tab in `ModelCustomizer.vue`** (isolated from the Outfits tab) providing a guided 3D mesh-stripping, reference image upload, real-time hair-mounting interface, and a one-click VRM export powered by Hacker Studio's `glb-exporter.ts`.
2. **Backend**: A consolidated **`apps/sidecar-3d-suite`** (or `packages/sidecar-3d-suite`) companion microservice that unifies both the existing **IDOL 3DGS generator** and the **HairDeck hairstyle engine** under a single managed FastAPI host, strictly responsible for GPU inference (outputting `hair_*.glb` and `chains_*.json`) with **zero** Blender overhead.

---

## 🏗️ 2. Architectural Blueprint & Subsystem Placement

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AIRI Client (Electron / Web)                    │
│                                                                        │
│   ModelCustomizer.vue (VRM Mode)                                       │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ [Emotions]  [Motions]  [Outfits]  [★ Hairstyles]  [VFX & Auras] │  │
│   └────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│   1. Hair Mesh Auto-Scanner        │ 2. Reference Image Input          │
│      • modelStore.discoveredMeshes │    • File drop / Artistry bridge  │
│      • Strip native hair meshes    │    • Stage face snapshot          │
│      • Live skull-cap preview      │    • Client-side IS-Net cutout    │
│                                    │                                   │
│                                    ▼                                   │
│                        POST /engines/hairdeck/generate                 │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             apps/sidecar-3d-suite (Unified Local Companion)            │
│                                                                        │
│   FastAPI Gateway (Port 8190)                                          │
│   ├── /health & /system/vram-telemetry                                 │
│   ├── /engines/idol/generate          (3D Gaussian Splats · 65k PLY)   │
│   └── /engines/hairdeck/generate      (Stylized Hair Cards · GLB+Bones)│
│                                                                        │
│   GPU Memory & Lifecycle Coordinator (RTX 4070 / Apple MPS)            │
│   ├── Shared DINOv3 ViT-H/16+ Feature Extractor                        │
│   └── Dynamic VRAM swapping between IDOL and HairDeck models           │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼ Output: hair_seed0.glb + chains.json
┌────────────────────────────────────────────────────────────────────────┐
│                  AIRI Stage Runtime & Model Stores                     │
│                                                                        │
│   Mode A: Dynamic Non-Destructive Mounting (Recommended)               │
│   • Original VRM stays unmodified in IndexedDB                         │
│   • Native hair meshes hidden via modelStore.setMeshVisibility         │
│   • hair_seed0.glb parented to VRM head bone at runtime                │
│   • Spring bone chains registered to Three.js / Stage-Mate Unity       │
│                                                                        │
│   Mode B: Permanent VRM Re-Baking via Hacker Studio (V-HACK)           │
│   • glb-exporter.ts in-memory binary surgery (NO Blender dependency!)  │
│   • Hides old hair primitives & injects new hair card bufferViews      │
│   • Exports validated MyModel_HairDeck.vrm directly in renderer        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 3. Frontend Experience: Dedicated Hairstyles Tab

### A. Why Isolate from the Existing Outfits Builder?
The **Outfits** tab in `ModelCustomizer.vue` already manages complex logic: 8-slot allocation, exclusivity group tags (`outfit`, `accessories`, `shoes`), multi-primitive submesh discovery, Stage-Mate sidecar sync, and slot persistence.

Attempting to wedge AI generation, reference image handling, and spring-bone chain binding into the existing Outfits form would significantly clutter the interface. A dedicated **Hairstyles** tab keeps concerns neatly decoupled:
- **Outfits tab**: Manages existing meshes built into the original 3D avatar file.
- **Hairstyles tab**: Specialized generative workflow for stripping native hair and mounting procedural 3D hair cards.

### B. The 3-Step Guided Hairstyle Studio

#### Step 1: Isolate & Strip Original Hair Meshes
1. **Automated Hair Detection Heuristic**:
   When the user opens the Hairstyles tab, AIRI scans `modelStore.discoveredMeshes` (populated by `VRMModel.vue`). A prominent button **"✨ Auto-Select Native Hair"** runs a fuzzy regex across all leaf mesh names:
   ```typescript
   const HAIR_MESH_REGEX = /(hair|bangs|front|back|ahoge|tail|twintail|braid|ponytail|side_hair)/i
   ```
2. **Interactive 3D Visual Tree**:
   The user sees the discovered leaf meshes rendered via `WardrobeMeshTreeNode.vue`. Toggling a mesh checkbox calls `modelStore.setMeshVisibility(meshName, false)` immediately.
   The 3D stage updates in real-time, giving instant visual confirmation that the avatar's native hair has vanished, exposing the clean base skull.
3. **Ad-Hoc Hidden Outfit Layer**:
   The selected native hair mesh names are captured as an active mask (e.g. `hair_mask: ["Hair_Front", "Hair_Back", "Hair_Bangs_0"]`).

#### Step 2: Reference Image Dropzone & Guidance
Users provide the visual target for what the replacement hair should look like:
1. **Direct Image Upload**: Drag-and-drop or file picker for anime concept art, manga panels, or character sheets.
2. **WebGPU IS-Net Anime Pre-Cleaning**: Reuses AIRI's in-browser `jellybox/isnet-anime` worker (`packages/stage-ui/src/workers/background-removal/worker.ts`) to strip extraneous backgrounds, isolating the hair/character silhouette cleanly for the model.
3. **Artistry Bridge**: A "Generate with Artistry" prompt button that lets users describe a hairstyle (e.g., *"silver twin drills with blue ribbon highlights, anime style"*), generating a reference via ComfyUI or SD before piping it directly into HairDeck.
4. **Stage Face Capture**: A snapshot button that captures the avatar's current face orientation from the 3D canvas to serve as a proportional guide.

#### Step 3: Synthesis, Variation Gallery & Mounting
1. **Fast Denoising (~1s)**: HairDeck generates hair card tokens in roughly 1 second on a desktop GPU. The suite returns 4 seed variations (`seed=0, 1, 2, 3`).
2. **Real-Time Stage Preview**:
   Clicking a seed variation mounts that specific `hair_seedN.glb` directly onto the avatar's head bone in the settings preview stage.
3. **Confirmation Actions**:
   - **"Equip as Hairstyle Profile" (Default / Non-Destructive)**: Stores the GLB asset in IndexedDB (`localforage`), records the mesh mask, and binds it to the character card's visual assets.
   - **"Export Baked VRM" (via Hacker Studio / V-HACK)**: Invokes the renderer's `glb-exporter.ts` to perform in-memory binary chunk surgery — masking old hair primitives with `VHACK_HIDDEN`, injecting the new hair card bufferViews and accessors, childing the node to the `head` bone, and exporting a fresh, valid `.vrm` download with **zero external tools**.

---

## ⚙️ 4. The Unified 3D Generator Backend Suite (`apps/sidecar-3d-suite`)

Instead of building a one-off HairDeck script, AIRI introduces **`apps/sidecar-3d-suite`** — a Python companion microservice residing within the monorepo, structured as follows:

```
apps/sidecar-3d-suite/
├── pyproject.toml / requirements.txt
├── main.py                          # FastAPI server (Uvicorn, port 8190)
├── core/
│   ├── config.py                    # Port, device (cuda/mps/cpu), model cache paths
│   ├── gpu_manager.py               # Shared VRAM telemetry, dynamic model unloader
│   └── backbone.py                  # Shared DINOv3 ViT-H/16+ feature extractor
├── engines/
│   ├── idol_3dgs/                   # Ported from current Windows SDK
│   │   ├── pipeline.py              # IDOL 3D Gaussian Splatting engine
│   │   └── router.py                # POST /engines/idol/generate
│   └── hairdeck/                    # HairDeck integration (Pure GPU inference)
│       ├── pipeline.py              # DiT Set-diffusion inference (~1s per card set)
│       ├── cards_to_glb.py          # Hair card UV & mesh builder -> hair_seedN.glb
│       ├── chains_extractor.py      # Spring-bone hierarchy extractor -> chains_seedN.json
│       └── router.py                # POST /engines/hairdeck/generate
└── scripts/
    ├── setup_windows.ps1            # Automated torch+cu124 & weight download
    └── setup_macos.sh               # Automated torch+mps setup
```

### Shared VRAM & Backbone Optimization
Both IDOL and HairDeck utilize **DINOv3** as their underlying visual feature backbone. By hosting both engines within the unified suite:
1. **Zero Weight Duplication**: DINOv3 weights (~840M parameters) are loaded into a shared singleton in memory rather than duplicated across multiple Python processes.
2. **VRAM Safety Guard**: On 8 GB VRAM GPUs (such as RTX 4070 Laptop), the `gpu_manager.py` dynamically offloads the IDOL Gaussian Decoder when HairDeck DiT inference runs, ensuring peak allocations remain well beneath the 8 GB ceiling.

### REST Contract Specification

#### 1. Suite Health & Telemetry
`GET /health`
```typescript
interface SuiteHealthResponse {
  status: 'ok'
  version: '1.0.0'
  device: 'cuda:0' | 'mps' | 'cpu'
  gpu_name: string
  vram_allocated_mb: number
  vram_total_mb: number
  engines: {
    idol_3dgs: { loaded: boolean, status: 'ready' | 'standby' }
    hairdeck: { loaded: boolean, status: 'ready' | 'standby' }
  }
}
```

#### 2. HairDeck Synthesis Request
`POST /engines/hairdeck/generate`
```typescript
interface HairDeckGenerateRequest {
  image: Blob | File // Clean RGBA reference image
  seeds?: number[] // Array of seeds (default: [0, 1, 2, 3])
  density?: 'sparse' | 'normal' | 'dense'
  target_vrm_head_size?: number // Head bounding scale (default: 1.0)
  export_chains?: boolean // Generate spring bone JSON (default: true)
}

interface HairVariation {
  seed: number
  glb_url: string // URL to temporary /assets/hair_seedN.glb
  chains_json_url: string // URL to /assets/chains_seedN.json
  card_count: number
  vertex_count: number
}

interface HairDeckGenerateResponse {
  success: boolean
  asset_group_id: string
  variations: HairVariation[]
  elapsed_seconds: number
}
```

### Why No Server-Side VRM Export Endpoint?
Notice that `apps/sidecar-3d-suite` has **no `/export-vrm` endpoint** and does **not** install or invoke Blender.
Because AIRI already has Hacker Studio (`use-vrm-hacker-adapter.ts` and `glb-exporter.ts`), all model baking and surgical export executes 100% client-side in the renderer:
- The sidecar stays lightweight, only needing PyTorch and CUDA/MPS for neural inference.
- Eliminates the need to distribute, configure, or sandbox Blender on user machines.
- Users can export valid `.vrm` files instantly in the browser or desktop app with zero server roundtrips.

---

## 🧬 5. Client-Side VRM Export via Hacker Studio (V-HACK)

Rather than reinventing a separate export pipeline, we leverage AIRI's established Hacker Studio architecture ([`packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/)):

```
┌────────────────────────────────────────────────────────────────────────┐
│             Hacker Studio (V-HACK) Surgical Exporter Pipeline          │
│                                                                        │
│   1. Source VRM Binary (ArrayBuffer from IndexedDB / localforage)      │
│      │                                                                 │
│   2. glb-exporter.ts Parses JSON & BIN Chunks                          │
│      │                                                                 │
│   3. Native Hair Suppression                                           │
│      • Injects 'VHACK_HIDDEN' transparent PBR material                 │
│      • Rewires hidden hair primitives to VHACK_HIDDEN material index   │
│      • (Optional) Sets hidden hair node scales to [0, 0, 0]            │
│      │                                                                 │
│   4. Procedural Hair Injection                                         │
│      • Appends hair_seedN.glb BIN buffer to VRM BIN chunk              │
│      • Injects new bufferViews, accessors, and meshes into glTF JSON   │
│      • Parents new hair mesh node to humanoid 'head' bone node index   │
│      • Injects spring-bone descriptors into glTF extensions            │
│        (extensions.VRMC_springBone or extensions.VRM.secondaryAnimation│
│      │                                                                 │
│   5. 4-Byte Boundary Padding & Binary Re-Serialization                 │
│      │                                                                 │
│      ▼ Output: Downloadable standalone .vrm binary (in-memory Blob)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Advantages of Reusing Hacker Studio
1. **Zero External Software**: No Blender, no Python subprocesses, no system path issues.
2. **Deterministic & Fast**: In-memory glTF surgery takes $< 50\text{ ms}$ for typical 50 MB VRM files.
3. **Format Integrity**: Follows the existing `glb-exporter.ts` pattern covered by comprehensive test suites (`packages/stage-ui/src/components/scenarios/settings/model-settings/hacker-studio/adapters/vrm/glb-exporter.test.ts`).

### Mode 1: Non-Destructive Runtime Attachment (The Primary AIRI Invariant)
In standard AIRI operation, character models should remain pure and uncorrupted in IndexedDB. Alterations are layered non-destructively:

1. **Hiding Native Hair**:
   When the character card loads, [`airi-card.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts) reads the active hairstyle profile and calls:
   ```typescript
   modelStore.setMeshesVisibility(hairstyleProfile.hiddenMeshes, false)
   ```
2. **Parenting the Procedural Hair Cards**:
   [`VRMModel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui-three/src/components/Model/VRMModel.vue#L1088) exposes the normalized head bone:
   ```typescript
   const headBone = vrm.value?.humanoid?.getNormalizedBoneNode('head')
   ```
   The Three.js `GLTFLoader` ingests the cached `hair_seedN.glb`. The resulting mesh is added directly as a child of `headBone`:
   ```typescript
   headBone.add(hairMeshObject)
   ```
   Because it is a direct child of the head bone, the hair naturally follows head rotations, tilts, and camera tracking without requiring full skeletal retargeting.

3. **Spring-Bone Chain Simulation**:
   - `chains_seedN.json` contains linear bone chains with root positions at the hair roots and tail positions at strand tips.
   - In WebGL (`@proj-airi/stage-ui-three`), the bones are hooked into a lightweight jiggle/spring solver (or VRM SpringBone instance) linked to character acceleration.
   - In desktop Electron Stage-Mate (`apps/stage-mate`), the mesh and bone descriptors are transmitted across the `StageMateBridge` IPC channel, dynamically instantiating Unity `SpringBone` components on the VRM armature.

---

## 💾 6. Data Storage & Card Schema Boundary

In accordance with [`docs/data-catalog.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/data-catalog.md) and `airi-binary-safety`:

1. **Binary Asset Persistence (`localforage`)**:
   - The generated hair GLB binary (`hair_seedN.glb`) is saved in `localforage` under key:
     `hairdeck-asset-${assetId}`.
   - Raw `ArrayBuffer`s are unwrapped with `toRaw()` to prevent Vue reactive proxy serialization corruption.

2. **Metadata Record (`card.schema.ts`)**:
   The active character card stores hairstyle definitions inside `card.extensions.airi`:
   ```typescript
   interface AiriHairstyleProfile {
     id: string
     name: string
     referenceImageBlobId?: string
     assetId: string // References localforage hairdeck-asset-${assetId}
     hiddenMeshes: string[] // Original meshes suppressed on the base VRM
     seed: number
     physicsEnabled: boolean
     colorTint?: string
   }
   ```
   This ensures that exporting an AIRI Character Card (`.card.json` / PNG tEXt) bundles the hairstyle metadata without breaking backwards compatibility.

---

## 📅 7. Phased Implementation Roadmap

- [ ] **Phase 1: Backend Suite Scaffolding (`apps/sidecar-3d-suite`)**:
  - Set up FastAPI project structure with `/health` and GPU memory coordinator.
  - Migrate and port existing Windows IDOL 3DGS endpoints into `engines/idol_3dgs/`.
  - Verify unified server startup on RTX 4070 (Windows) and Apple MPS (macOS).

- [ ] **Phase 2: HairDeck Engine Integration**:
  - Implement `engines/hairdeck/pipeline.py` leveraging shared DINOv3 weights.
  - Generate standalone `hair_*.glb` and spring-bone `chains_*.json` outputs from sample reference images.
  - Benchmark inference speed and VRAM overhead during simultaneous IDOL/HairDeck loads.

- [ ] **Phase 3: ModelCustomizer "Hairstyles" Tab UI**:
  - Add the `Hairstyles` segment button in `ModelCustomizer.vue` for `modelType === 'vrm'`.
  - Implement the **"Auto-Detect Native Hair"** scanner using `modelStore.discoveredMeshes`.
  - Build the reference image dropzone with client-side IS-Net segmentation preview.

- [ ] **Phase 4: Runtime Head Mounting & Live Preview**:
  - Implement runtime Three.js head-bone attachment in `packages/stage-ui-three/`.
  - Wire interactive variation picker (seeds 0–3) to hot-swap hair cards live on the preview stage.
  - Persist configured hairstyles into `localforage` and character card extensions.

- [ ] **Phase 5: Spring-Bone Dynamics & Stage-Mate Parity**:
  - Connect `chains_*.json` to Three.js spring bone physics.
  - Transmit hair attachments across `electronStageMateSyncOutfits` / `StageMateBridge` to instantiate Unity dynamic bones in Stage-Mate.

- [ ] **Phase 6: Hacker Studio (V-HACK) Surgical VRM Export**:
  - Extend `glb-exporter.ts` to support procedural hair card bufferView injection and node parenting to `head`.
  - Add `VRMC_springBone` extension serialization directly in glTF JSON.
  - Provide a one-click "Export Standalone VRM" action that runs 100% in-browser with zero external dependencies.
