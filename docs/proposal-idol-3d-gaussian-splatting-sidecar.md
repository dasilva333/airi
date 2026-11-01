# Proposal: IDOL 3D Gaussian Splatting Standalone Companion Service

> **Status**: Proposed RFC
> **Document**: `docs/proposal-idol-3d-gaussian-splatting-sidecar.md`
> **Target Audience**: 3D Graphics Engineers, Desktop System Architects, Capability Pack Integrators
> **Key References**: `docs/design-capability-packs.md`, `docs/proposal-trellis-dynamic-item-manifestation.md`, `docs/proposal-in-memory-sandboxes-and-edge-wasm.md`

---

## 🧭 1. Executive Summary & Pragmatic Boundary

**IDOL (Image-to-3D via Gaussian Splatting)** generates detailed 3D objects from a single image reference in under 20–40 seconds using a 0.66B parameter multi-stage pipeline, running comfortably on 8 GB VRAM GPUs.

### The WebGPU/In-Browser Non-Starter
Attempting to export IDOL’s 7–8 constituent sub-models to ONNX and execute 3D Gaussian splat generation directly inside the browser WebGPU environment is completely impractical:
* Multi-graph ONNX pipeline coordination introduces massive WASM/WebGPU memory overhead and frequent tab crashes.
* Consumer browsers throttle WebGPU allocations beyond 2–4 GB buffers.

### The Architectural Solution: Decoupled Standalone Desktop Service
Instead of shoehorning generation into the browser or Electron renderer, IDOL is architected as an **optional standalone external companion service**:
1. **Host-Level External Process**: Distributed as a standalone desktop utility or managed Python/CUDA sidecar (independent of Electron’s main process).
2. **Lightweight In-Browser Rendering**: The Electron / Web renderer only needs a featherweight Three.js Gaussian Splat viewer (`@mkkellogg/gaussian-splats-3d` or WebGL splat shaders) to display the generated `.splat` / `.ply` files in real-time at 60 FPS with minimal memory overhead.

---

## ⚙️ 2. System Architecture

```
┌─────────────────────────────────┐
│ AIRI Desktop (Electron / Three) │
│ • Character Chat / Photobooth   │
│ • Lightweight Splat Viewer      │
└─────────────────────────────────┘
                 │
                 │ IPC / Local REST (`http://127.0.0.1:8189`)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ IDOL Standalone Desktop Sidecar (Optional Package)     │
│ • Local Python / Torch / CUDA Process                   │
│ • 0.66B Parameter Model (~8 GB VRAM)                    │
│ • Ingests Image ──► Exports compressed `.splat` / `.ply`│
└─────────────────────────────────────────────────────────┘
```

### Protocol Interface:
```typescript
interface IdolGenerateRequest {
  imageBuffer: string // Base64 or local file path
  numGaussians?: 32000 | 100000 | 1000000 // Quality tier
  outputFormat?: 'splat' | 'ply'
}

interface IdolGenerateResponse {
  assetId: string
  splatPath: string
  generationTimeMs: number
}
```

---

## 🎨 3. AIRI Companion Use Cases

1. **3D Holographic Memory Collectibles**:
   * Turn generated selfies, character artwork, and dating-sim scene snapshots from the Image Journal into 3D rotatable Gaussian figurines on the desktop.
2. **Character Card 2D-to-3D Desk Figurines**:
   * In the Character Card Hub, users can click "Manifest 3D Figurine" on any 2D card avatar to produce an interactive 3D desktop companion widget.
3. **Stage Prop Inspection**:
   * Complements the TRELLIS mesh pipeline by providing photorealistic, view-dependent lighting on complex organic items that traditional low-poly polygon meshes struggle to represent.

---

## 📅 4. Roadmap & Implementation Steps

- [ ] **Phase 1: Three.js Splat Viewer Integration**: Add `@mkkellogg/gaussian-splats-3d` component to `packages/stage-ui-three/` to verify WebGL playback of `.splat` files.
- [ ] **Phase 2: Sidecar Service Wrapper**: Create a minimal FastAPI/CLI wrapper for IDOL with health check and generation endpoints.
- [ ] **Phase 3: Desktop Settings & Discovery**: Add "Gaussian Splatting (IDOL)" under External Services / Capability Packs, auto-detecting the local port when running.
- [ ] **Phase 4: Tool Integration**: Provide the companion with an optional `create_3d_splat` tool call.
