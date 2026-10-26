# Proposal: Multi-Task Vision Consolidation via WeVisOne-VL

> **Status**: Proposed RFC
> **Document**: `docs/proposal-wevisone-vl-multitask-vision.md`
> **Target Audience**: Core Runtime Developers, Vision/VLM Engineers, Desktop Interaction Contributors
> **Key References**: `packages/stage-ui/src/stores/modules/screen-watcher.ts`, `packages/stage-ui/src/workers/background-removal/`, `docs/design-attention-ecology-screen-watching.md`, `docs/project-stickers-system-spec.md`

---

## 🧭 1. Executive Summary & Vision

### 1.1 The Fragmented Vision Architecture
AIRI currently deploys multiple independent vision models to fulfill distinct visual capabilities:
1. **Anime Background Removal**: `isnet-anime` (176 MB ONNX session in `packages/stage-ui/src/workers/background-removal/worker.ts`) strictly for card art cutouts and sticker generation.
2. **Ambient Screen Perception**: `Moondream2` in `packages/stage-ui/src/workers/moondream/worker.ts` for natural language scene captioning during screen watching.
3. **Screen Text & HUD Reading**: `PP-OCRv6_tiny_rec_onnx` in gaming copilot and desktop plugins for extracting on-screen text.
4. **Spatial Item & Prop Bounding**: Separate heuristics for locating bounding boxes and focal points.

This fragmentation introduces significant developer friction: separate worker threads, redundant VRAM allocations, duplicated tensor transfers, and fragmented spatial coordinate systems.

### 1.2 The WeVisOne-VL Opportunity
Tencent's **WeVisOne-VL** (built on Qwen-3-VL with a pixel-level localization and matting head, released under the permissive **Apache 2.0** license) natively unifies these capabilities into a single model:
* **Object Detection & Instance Counting**: Locates and counts arbitrary target entities (e.g. "detect all dogs, chairs, bushes", "count all pets").
* **Referring Expression & Spatial Pointing**: Resolves ambiguous conversational references to exact 2D pixel coordinates (e.g. "point to the black and white dog").
* **Fine-Grained Text Recognition (OCR)**: Detects, outlines, and extracts small, rotated, or dense text regions (e.g. "outline all words", "locate the sign saying 'small alley'").
* **Fine Hair-Strand Alpha Matting & Background Removal**: Generates high-resolution alpha transparency masks down to individual strands of hair, matching and exceeding dedicated matting models.
* **Accessible Footprint**: Available in a **2B parameter variant** (~9–10 GB) and a **4B variant** (~19 GB), capable of running locally on consumer workstation GPUs.

---

## ⚙️ 2. Architectural Pipeline & Subsystem Mapping

```
                                  [ Desktop Display / User Upload / Webcam ]
                                                      │
                                                      ▼
                                       [ WeVisOne-VL Core Engine ]
                                        (2B Apache 2.0 Local Worker)
                                                      │
         ┌──────────────────────────┬─────────────────┴────────────────┬──────────────────────────┐
         ▼                          ▼                                  ▼                          ▼
 [ Alpha Matting Engine ]    [ Spatial Locator ]             [ OCR / Text Reader ]      [ VLM Perception ]
         │                          │                                  │                          │
         ▼                          ▼                                  ▼                          ▼
- Sticker Studio Cutouts    - Avatar Gaze Tracking          - Desktop HUD Inspection   - Screen Watcher
- Card Avatar Extraction    - Three.js Prop Anchoring       - Gaming Show Harness      - Attention Ecology
- Dynamic Stage Layers      - UI Hit Target Pointing        - Window Title OCR         - Salience Grading
```

### 2.1 Subsystem Consolidation

| Capability | Current AIRI Engine | WeVisOne-VL Target | Architectural Advantage |
|:---|:---|:---|:---|
| **Sticker / Card Matting** | `jellybox/isnet-anime` (176 MB ONNX) | WeVisOne-VL Matting Head | Sub-pixel alpha boundary with natural hair details; handles non-anime realistic props. |
| **Screen Watching** | `Moondream2` (WebGPU) | WeVisOne-VL 2B Base | Superior semantic reasoning, scene grounding, and conversational awareness. |
| **Gaming & HUD OCR** | `PP-OCRv6` ONNX | WeVisOne-VL Character OCR | Eliminates specialized OCR pipeline; extracts text directly from dense game viewports. |
| **Stage Spatial Awareness** | None (Static coordinates) | WeVisOne-VL Pointing Head | Companion can dynamically look at or gesture toward specific screen objects. |

---

## 🛠️ 3. LLM Tools & Orchestration Integration

When integrated into AIRI's tool registry (`apps/stage-tamagotchi/src/renderer/stores/tools/builtin/`), WeVisOne-VL exposes high-level visual primitives:

```typescript
// Tool: screen_inspect_element
interface ScreenInspectParams {
  query: string // e.g. "Find the minimize button" or "Where is the boss health bar?"
  mode: 'point' | 'bbox' | 'ocr' | 'matte'
}

// Tool: create_sticker_cutout
interface StickerCutoutParams {
  imageSource: string // Base64 or local asset URI
  targetObject?: string // Optional semantic filter: e.g. "the character holding the sword"
  returnAlphaMask: boolean // Returns PNG with alpha channel
}
```

---

## 📅 4. Implementation Roadmap

- [ ] **Phase 1: Local Inference Verification**:
  - Test WeVisOne-VL 2B weights using local Python/Electron N-API harness.
  - Benchmark VRAM consumption, latency, and alpha matting quality against `isnet-anime_1024.onnx`.
- [ ] **Phase 2: Alpha Matting & Sticker Integration**:
  - Connect WeVisOne-VL as an optional high-fidelity background removal engine in `packages/stage-ui/src/stores/stickers.ts`.
- [ ] **Phase 3: Screen Watcher & Gaze Integration**:
  - Expose WeVisOne-VL pointing coordinates to `model-driver-mediapipe` and VRM/Live2D gaze controllers so the character visually tracks target objects on the user's screen.
- [ ] **Phase 4: Provider Registry & Settings UI**:
  - Add `wevisone-local` to `packages/stage-pages/src/pages/settings/providers/` and allow toggling between lightweight Moondream2 (WebGPU) and high-fidelity WeVisOne-VL (Local GPU).
