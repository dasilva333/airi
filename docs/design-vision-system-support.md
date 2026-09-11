# Local Vision System Support Design (ONNX & WebGPU)

This document specifies the architecture, codebase entry points, and phased rollout plan for integrating local, on-device vision models (BLIP / BLIP-2) running client-side via ONNX Runtime and WebGPU.

> **Related proposal:** [`docs/proposal-wd14tagged-models.md`](./proposal-wd14tagged-models.md) — applies this tagger pipeline to auto-index local model previews (VRM/Live2D/Spine/MMD) into semantic Model Selector search.

---

## 🗺️ Codebase Map & Key Integration Points

To integrate a local WebGPU vision provider without introducing regressions or driver crashes, the implementation must coordinate with AIRI's existing unified WebGPU inference scheduler.

### 1. Unified WebGPU Scheduling & Queuing
WebGPU workloads (such as TTS speech generation and STT transcription) are single-threaded per context and prone to driver loss if executed concurrently. All local models route through a queue.
- **File**: [coordinator.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/coordinator.ts)
  - *Change*: Add VRAM estimates for vision models (`moondream2` ~700MB, `blip-1` ~250MB, `blip-2` ~1.5GB+) to `MODEL_VRAM_ESTIMATES`.
- **File**: [gpu-executor.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/gpu-executor.ts)
  - *Change*: Add task priorities (`MOONDREAM_PROCESS: 20`, `MOONDREAM_LOAD: 10`, `BLIP_PROCESS: 20`, `BLIP_LOAD: 10`) to the `GPU_PRIORITY` registry to ensure vision processing yields to active speech (TTS).
- **File**: [constants.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/constants.ts)
  - *Change*: Add model IDs and worker execution timeouts (`LOCAL_VLM_LOAD: 300_000`, `LOCAL_VLM_PROCESS: 120_000`) to `MODEL_IDS`, `MODEL_NAMES`, and `TIMEOUTS`.

### 2. IPC & Eventa Contract
AIRI uses `@moeru/eventa` to coordinate messages between the main thread and background Web Workers.
- **File**: [contract.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/contract.ts)
  - *Change*: Define the events `moondreamLoadEvent`, `moondreamProcessEvent` (unary image processor + optional prompt), and `moondreamUnloadEvent`.
- **Directory**: `packages/stage-ui/src/workers/`
  - *Change*: `moondream/worker.ts` importing `Moondream1ForConditionalGeneration` from `@huggingface/transformers` to run the model pipelines with `q8` vision encoder and `q4` decoder.

### 3. Provider Settings & Caching
- **Files**: `packages/stage-ui/src/stores/providers/registry/local-engines.ts` and `stores/providers/moondream/index.ts`
  - *Change*: Register `'moondream-local'` with category `'vision'` and task `'chat'` (OpenAI `/chat/completions` interception), and `'blip-local'` (Waifu Diffusion Tagger).
- **File**: [ModelCacheManager.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue)
  - *Change*: Add known vision model Hugging Face repository IDs (`Xenova/moondream2`) to the `knownModels` array.

---

## 🧠 Model Comparison: Moondream2 vs. WD14 (Danbooru Tagger) vs. BLIP-2

When running model inference locally in a web browser, there is a direct trade-off between output quality, format suitability, and hardware resource requirements.

| Feature / Metric | Moondream2 (`moondream-local`) | WD14 Tagger (SwinV2/ViT) (`blip-local`) | BLIP-2 (OPT-2.7B) |
| :--- | :--- | :--- | :--- |
| **Hugging Face Repo** | `Xenova/moondream2` | `SmilingWolf/wd-v1-4-swinv2-tagger-v2` | `onnx-community/blip2-opt-2.7b` |
| **Output Style** | Conversational QA & Prose | Comma-separated Danbooru Tags | Rich Instruction-following Prose |
| **Parameter Size** | ~1.6B | ~100M | ~2.7B+ |
| **Download footprint**| ~700 MB (quantized `q8`/`q4`) | ~300 MB (plus `selected_tags.csv`) | ~2.5 GB to 5.5 GB |
| **Hardware Target** | WebGPU (Modern GPU / Apple Silicon) | Low-end GPUs / WASM | High-end GPUs (6GB+ VRAM) |
| **Best Used For** | On-device VLM Context / Chat Image QA | Character Tagging / Artistry Prompts | High-capacity reasoning |

### Danbooru Tagger (SmilingWolf WD14) Implementation Details
Unlike BLIP models which use standard text decoders, the WD14 taggers output a raw probability tensor for ~9,000 Danbooru tags. To use it:
1. **Model**: Download `model.onnx` from Hugging Face.
2. **Metadata**: Fetch and parse `selected_tags.csv` to map tag indices to tag strings.
3. **Thresholding**: Filter output tags where the sigmoid probability is above a user-selected threshold (e.g., `> 0.35`), separate them into general/character categories, and format as comma-separated tags.

### Proposal: Model Selection Dropdown
To let the user balance performance against descriptive style, the local vision provider will expose a `model` configuration option with preset selections:
1. `onnx-community/blip-image-captioning-base` (Default, Fast, Lightweight Prose)
2. `onnx-community/blip2-opt-2.7b` (High Quality Prose, VRAM-heavy)
3. `SmilingWolf/wd-v1-4-swinv2-tagger-v2` (Danbooru Tags, perfect for Artistry Prompt Prefix)
4. `SmilingWolf/wd-v1-4-vit-tagger-v2` (Alternative ViT-based Danbooru Tagger)
5. Custom model URL option.

---

## 🚀 Rollout Strategy: Phase 1 Playground First

Rather than attempting to build the entire system end-to-end (connecting to character cards and LLMs on the first run), we will implement a sandbox rollout:

```
[Phase 1: Local Provider & Settings] ──> [Phase 2: UI Playground Sandbox] ──> [Phase 3: Card Editor Integration]
```

### Phase 1: Registry & Provider Registration
1. Register `'blip-local'` inside the `providers.ts` store.
2. Add its localization entry to the translation files so it displays correctly under the **Vision** tab.
3. Wire up the cache status checker in `ModelCacheManager.vue`.

### Phase 2: The Vision Settings Playground
1. Create custom configuration and testing playground components:
   - [moondream-local.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/moondream-local.vue) for Moondream2 VLM (image upload, custom question prompt, latency metrics).
   - [blip-local.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/chat/blip-local.vue) for Waifu Diffusion Tagger (Danbooru tag extraction, threshold slider).
2. Inside this page, build a **Vision Playground Widget**:
   - **Model Selector**: Dropdown to toggle between BLIP-1, BLIP-2, or custom ONNX paths.
   - **Upload/Drop Zone**: Drag-and-drop or file upload block to load test images.
   - **Run Button**: Triggers model download, compiles WebGPU shaders, and runs captioning.
   - **Console / Output Panel**: Shows download progress percentage, hardware execution device (WebGPU vs WASM), execution latency (ms), and the raw generated description.
3. Use this sandbox to compare BLIP-1 vs BLIP-2 inference speeds and descriptor quality on the target system.

### Phase 3: Sparkle AI Integration
Once the playground is verified, hook the BLIP adapter instance into:
1. `CardCreationTabArtistry.vue` (direct tag generation).
2. `CardCreationTabIdentity.vue` / `FieldAiGeneratorModal.vue` (VLM context injection to the active LLM).

---

## ⚠️ Inference and Preprocessing Discrepancies (WebGPU vs Python)

During development, we identified key differences in how the browser runtime executes SwinV2/WD models compared to a standard Python/Pillow reference environment:

### 1. Pre-baked Sigmoid Activation
* **ONNX Graph**: SmilingWolf v3 (and v2.1) ONNX models compile the Sigmoid activation directly into the output layer.
* **Redundant Post-processing**: Applying manual Sigmoid post-processing in JS wraps the pre-activated `[0, 1]` probabilities into `[0.5, 0.73]`. This forces almost all output classes above the typical `0.35` threshold, resulting in over 8,000 active tags. The output probabilities must be read directly from the ONNX logits without post-sigmoid calculations.

### 2. Input Color Normalization Range
* **[0, 255] Bounds**: The model requires raw unscaled colors in the standard `[0, 255]` float32 range.
* **Faint Signal**: Normalizing inputs to `[0, 1]` (e.g. dividing by `255.0`) makes the image appear 255 times darker to the model, causing it to fail and output generic low-contrast fallback tags (like `negative space` or `dark`).

### 3. CSV Vocabulary Parsing
* **Quoted Fields**: Several tags in `selected_tags.csv` contain commas (e.g. `"eyes, closed"`). Standard `.split(',')` shifts indices and corrupts tag classification categories. A custom quote-aware CSV parser is required to keep category bounds mapped.
* **Resampling Kernels**: Standard browser canvas resizes differ from Pillow's C-based `BICUBIC` interpolation, introducing minor sub-pixel variance that can cause tags close to the boundary threshold to slide in or out. Using `{ resample: 3 }` (Bicubic) in `RawImage.resize` keeps values closest to reference.

## Relevant Skills

- [[airi-attention-ecology-vision]]
