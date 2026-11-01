# Proposal: IDOL 3D Gaussian Splatting Standalone Companion Service

> **Status**: Active Prototype (Milestones 1 & 2 Verified · Direction Aligned)
> **Document**: `docs/proposal-idol-3d-gaussian-splatting-sidecar.md`
> **Target Audience**: 3D Graphics Engineers, Desktop System Architects, Capability Pack Integrators
> **Key References**: `docs/design-capability-packs.md`, `docs/design-background-removal-isnet.md`, `docs/data-catalog.md`, `docs/proposal-trellis-dynamic-item-manifestation.md`, `docs/proposal-in-memory-sandboxes-and-edge-wasm.md`, `docs/project-testing-parity.md`

---

## 🧭 1. Executive Summary & Pragmatic Boundary

**IDOL (Image-to-3D via Gaussian Splatting)** generates detailed 3D objects from a single image reference in under 20–60 seconds using a 0.66B parameter multi-stage pipeline, running comfortably on 8 GB VRAM GPUs.

### The WebGPU/In-Browser Non-Starter
Attempting to export IDOL’s 7–8 constituent sub-models to ONNX and execute 3D Gaussian splat generation directly inside the browser WebGPU environment is completely impractical:
* Multi-graph ONNX pipeline coordination introduces massive WASM/WebGPU memory overhead and frequent tab crashes.
* Consumer browsers throttle WebGPU allocations beyond 2–4 GB buffers.

### The Architectural Solution: Decoupled Standalone Desktop Service
Instead of shoehorning generation into the browser or Electron renderer, IDOL is architected as an **optional standalone external companion service**:
1. **Host-Level External Process**: Distributed as a standalone desktop utility or managed Python/CUDA companion service (independent of Electron’s main process).
2. **Lightweight In-Browser Rendering**: The Electron / Web renderer only needs a featherweight Three.js Gaussian Splat viewer (`@mkkellogg/gaussian-splats-3d` or WebGL splat shaders) to display the generated `.splat` / `.ply` files in real-time at 60 FPS with minimal memory overhead.

---

## 🧪 2. Empirical Verification & Milestones Achieved

As of November 2026, **Milestones 1 & 2 are empirically verified and operational**:

### A. Windows CUDA Sidecar Deployment
- **Host**: NVIDIA GeForce RTX 4070 Laptop GPU (8 GB GDDR6), Windows 11, drive `E:\idol-sdk`.
- **Environment**: Python 3.12, PyTorch `2.6.0+cu124`, `torchvision 0.21.0+cu124`, `tensordict==0.8.0`.
- **Model Pipeline**: `speridlabs/idol` (Denoiser + Octree Decoder + Gaussian Decoder + FLUX.2 VAE + BiRefNet matting + DINOv3 ViT-H/16+).
- **Public Mirror Bypass**: Integrated `LibreYOLO/LibreDINOv3vith16plus` (840.6M parameters) to cleanly bypass Meta's manual review gating queue without waiting for account approval.
- **Performance Telemetry**:
  - Idle VRAM: ~3.5 GB
  - Peak Sampling VRAM: ~7.9 GB (fits within 8 GB VRAM ceiling)
  - Generation Speed: **63.43 seconds** for 65,536 Gaussians (50 diffusion steps, CFG 3.0)
  - Output Asset: 4.3 MB binary `.ply` file (`chibi_cyber_idol_65k.ply`) with standard 3DGS spherical harmonics.

### B. WebGL Splat Rendering Verification
- **Renderer**: `@mkkellogg/gaussian-splats-3d` (`0.4.7`) integrated into `@proj-airi/stage-ui-three` via `GaussianSplatModel.vue`.
- **External WebGL Verification**: Tested via PlayCanvas SuperSplat editor (`https://playcanvas.com/supersplat/editor`), rendering full 3D orbital rotation, pan, zoom, and splat cloud visualization at solid 60 FPS.
- **Architectural Lesson (Insecure Contexts & Web Workers)**:
  - On non-localhost LAN HTTP (`http://10.0.0.91:8189`), browsers enforce `isSecureContext === false`, forbidding `SharedArrayBuffer` and blocking `coi-serviceworker`.
  - For LAN HTTP viewers, `sharedMemoryForWorkers: false` and `gpuAcceleratedSort: false` are mandatory; sorting 65k splats on CPU takes $< 2\text{ ms}$ and avoids `DataCloneError`.

---

## 🏗️ 3. Integration Blueprint & Architectural Invariants

### A. Subsystem Placement: `Settings > Modules` (NOT `Providers`)
* **Decision**: We explicitly reject placing IDOL under `Settings > Providers`.
* **Rationale**: `settings > providers` is strictly reserved for standardized, interchangeable third-party API contracts (OpenAI, Anthropic, ElevenLabs, Kokoro, etc.). IDOL is a bespoke, homebrew creative pipeline.
* **Canonical Path**: `packages/stage-pages/src/pages/settings/modules/idol-3dgs.vue`, seated alongside AIRI's dedicated creative modules (`artistry.vue`, `text-to-motion.vue`, `gaming-factorio.vue`).

### B. Pre-Processing Gate: Client-Side IS-Net Anime Pre-Cleaning
Instead of blindly relying on IDOL's generic server-side BiRefNet:
1. **Interactive Visual Cutout**: When a user drops an image into the playground, AIRI's in-browser `jellybox/isnet-anime` (WebGPU) executes immediate background removal via `packages/stage-ui/src/workers/background-removal/worker.ts`.
2. **Visual Quality Gate**: The user inspects the transparent cutout preview and tunes the sensitivity curve (`applyAlphaMask`: Clean 0% / Default 65% / Preserve 100%) to ensure delicate anime hair strands, ribbons, and accessories are preserved before committing a 60-second GPU generation pass.
3. **Artifact-Free Synthesis**: Sending a pre-cleaned transparent PNG directly to IDOL in `mode="synthetic"` treats transparency as an empty void, dramatically eliminating background halos, floaters, and noisy Gaussian debris.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AIRI Client (Electron / Web)                    │
│                                                                        │
│  Raw Image ──► IS-Net Anime (WebGPU) ──► Interactive Mask Preview      │
│                                                   │                    │
│                                            (User Approves)             │
│                                                   ▼                    │
│                                         POST Clean Cutout PNG          │
└───────────────────────────────────────────────────┬────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   IDOL Standalone Sidecar (RTX 4070)                   │
│                                                                        │
│   Ingest Clean RGBA ──► DINOv3 + FLUX VAE ──► 65k Splats (.ply / .splat│
└───────────────────────────────────────────────────┬────────────────────┘
                                                    │
                                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        AIRI Three.js Viewport                          │
│                                                                        │
│   IndexedDB Persistence (localforage) ──► DropInViewer 60 FPS Orbit    │
└────────────────────────────────────────────────────────────────────────┘
```

### C. Durable Persistence Boundary
* **Binary Assets (`localforage`)**:
  - The generated `.ply` (4.3 MB) or compressed `.splat` (2.1 MB) binaries are stored directly in IndexedDB via `localforage` under key `splat-asset-${assetId}`.
  - Strictly adheres to `airi-binary-safety`: unwrap reactive state with `toRaw()`, store pure `ArrayBuffer`s, never mutate buffers on reactive proxies.
* **Structured Records (`local:splat-assets`)**:
  - Metadata records (name, source image thumbnail blob ID, splat count, creation timestamp, tags) are persisted in IndexedDB `unstorage` under `local:splat-assets`.

### D. Multi-Model Scene Coexistence (VRM + 3DGS in One Canvas)
* **Unified Three.js Scene Graph**:
  - Both VRM (`@pixiv/three-vrm`) and `@mkkellogg/gaussian-splats-3d` (`DropInViewer`) are standard Three.js `Object3D` instances.
  - They mount inside the **exact same Three.js `Scene`**:
    ```typescript
    scene.add(vrm.scene)
    scene.add(splatDropInViewer)
    ```
  - Both share the identical camera projection, orbit controls, coordinate grid, and lighting environment. A VRM avatar can stand on the stage with the 3D Gaussian Splat figurine resting on a desk directly beside her.
* **2D Engine Boundary (Live2D / Spine)**:
  - PixiJS Live2D and Spine WebGL operate in 2D viewports. They coexist via layered DOM compositing (picture-in-picture desk card or side-by-side viewport split) rather than a shared 3D depth buffer.

---

## ⚙️ 4. Protocol & REST Contract

```typescript
interface IdolHealthResponse {
  status: 'ok'
  service: 'idol-3d-gaussian-splatting'
  cuda_available: boolean
  device: string
  vram_allocated_mb: number
  model_loaded: boolean
}

interface IdolGenerateRequest {
  image: Blob | File // Pre-cleaned transparent PNG
  mode?: 'synthetic' | 'real' // Default: synthetic
  num_gaussians?: 32768 | 65536 | 262144 // Quality tier
  steps?: number // Default: 50
  cfg_strength?: number // Default: 3.0
  rescale_t?: number // Default: 3.0
  seed?: number
}

interface IdolGenerateResponse {
  success: boolean
  asset_id: string
  ply_url: string
  preprocessed_url: string
  elapsed_seconds: number
  num_gaussians: number
  seed: number
}
```

---

## 📅 5. Revised Implementation Roadmap

- [x] **Phase 1: Three.js Splat Viewer Core**: Add `@mkkellogg/gaussian-splats-3d` component to `packages/stage-ui-three/` to verify WebGL playback of `.splat` / `.ply` files. *(Completed: `GaussianSplatModel.vue`)*
- [x] **Phase 2: Windows Sidecar Wrapper**: Create a FastAPI wrapper for IDOL with `/health` and `/generate` endpoints, deploy to RTX 4070 host, verify public DINOv3 mirror. *(Completed: `idol_service.py` on Windows)*
- [ ] **Phase 3: Settings Module Playground (`settings/modules/idol-3dgs.vue`)**:
  - Service health status monitor (`http://10.0.0.91:8189/health`).
  - Image dropzone with WebGPU IS-Net Anime segmentation and sensitivity slider preview.
  - One-click "Generate 3D Splat" triggering remote CUDA generation.
  - Interactive 3D WebGL orbit viewer for the generated asset.
- [ ] **Phase 4: Persistence & Asset Library Shelf**:
  - Save generated splats to `localforage` and index in `local:splat-assets`.
  - Display a visual shelf of saved 3D figurines for instant reloading.
- [ ] **Phase 5: VRM + 3DGS Canvas Coexistence**:
  - Toggle in the playground to load the active VRM avatar alongside the 3D figurine in the same Three.js scene.
- [ ] **Phase 6: Stage Figurine & Card Manifestation**:
  - "Synthesize 3D Figurine" action on Character Card Hub and Image Journal memories.
