# Proposal: Bark 3 Ultra-Lightweight Local ASR Engine for AIRI

> **Status**: Proposed RFC
> **Document**: `docs/proposal-bark3-transcription-engine.md`
> **Target Audience**: Core Runtime Developers, Audio Pipeline Engineers, Speech Modality Contributors
> **Key References**: `packages/stage-ui/src/stores/modules/hearing.ts`, `packages/stage-ui/src/libs/workers/worker.ts`, `packages/audio-pipelines-transcribe/`, `docs/rosetta-stone.md` §8

---

## 1. Executive Summary & Problem Statement

### 1.1 The Bottleneck of Current Local STT (Whisper)
In AIRI's local-first desktop and web runtime, speech transcription (STT) is crucial for fluid, bidirectional voice conversations. Currently, offline transcription relies almost entirely on local Whisper models (`packages/stage-ui/src/libs/workers/worker.ts` and `packages/stage-ui/src/libs/inference/adapters/whisper.ts`).

In practice, Whisper presents severe tradeoffs:
1. **High Latency & Resource Footprint**: Whisper Large v3 (and even medium/small variants in WebAssembly/WebGPU) introduces noticeable multi-second transcription lags that disrupt conversational pacing and filler handoffs.
2. **Memory Footprint**: Running heavy transformer encoder-decoder checkpoints alongside Live2D/VRM 3D rendering and consciousness LLMs places significant strain on unified memory on consumer hardware.
3. **Word Error Rate (WER) vs. Footprint Tradeoff**: Smaller Whisper variants (tiny/base) degrade in noisy desktop environments, misinterpreting character names and conversational nuances.

### 1.2 The Bark 3 Solution
Bark 3 introduces a breakthrough in transcription efficiency:
* **Extreme Compactness**: The base Bark 3 checkpoint is only **163 MB** to download, with an upgraded Plus version and a 1.25 GB Pro version for maximum precision.
* **Sub-Second Turnaround**: In benchmarks, the 163 MB model completes transcription in ~1 second, outperforming much larger models including OpenAI Whisper Large v3 and Nvidia Parakeet on the efficiency frontier (WER vs. parameter size).
* **Permissive Licensing**: Released with an open license supporting commercial use with attribution.
* **Client-Side Viability**: The 163 MB footprint makes it ideal for embedding directly into an in-browser Web Worker (WASM/WebGPU) or an Electron-native ONNX runtime without demanding multi-gigabyte downloads.

---

## 2. Architecture & Pipeline Placement

```
[ Microphone Capture / VAD ]
             │
             ▼
[ AudioBuffer / PCM Stream ]
             │
             ├──► [ Hearing Store: Provider Selection (`bark3-local`) ]
             │
             ▼
[ Bark 3 Inference Worker (`workers/bark3/worker.ts`) ]
   ├─ Weights Cache: OPFS / Cache Storage (`bark3-weights-cache`)
   ├─ Model Variants: Base (163 MB) | Plus (~350 MB) | Pro (1.25 GB)
   └─ Execution Provider: WebGPU / WASM SIMD (ONNX Runtime Web)
             │
             ▼
[ Transcribed Text Tokens ] ──► [ chatOrchestrator.ingest ] ──► [ LLM Consciousness ]
```

### 2.1 Provider Registration (`packages/stage-ui/src/libs/providers/`)
Register `bark3-local` under the modular provider registry (`defineProvider()`):
- **Category**: `'transcription'`
- **Deployment**: `'local'`
- **Tasks**: `['transcription']`
- **Options**:
  - `variant`: `'base-163m'` | `'plus'` | `'pro-1.25g'` (default: `'base-163m'`)
  - `language`: Auto-detect or ISO code
  - `timestampGranularity`: `'word'` | `'segment'`

### 2.2 Ingestion & VAD Integration
Bark 3 connects directly to AIRI's VAD (Voice Activity Detector) buffer:
1. VAD triggers speech end (`vadDetector` in `packages/stage-ui/src/stores/modules/hearing.ts`).
2. Audio chunk (16kHz 16-bit mono PCM) is dispatched to `bark3-adapter.ts`.
3. Worker runs forward pass and yields normalized transcript in <1,200ms.
4. Auto-send dispatches directly to `chatOrchestrator.ingest` without duplicate turn issues.

---

## 3. Implementation Plan & Deliverables

- [ ] **Phase 1: ONNX Export & Weight Quantization**:
  - Verify Hugging Face checkpoints and export to ONNX format.
  - Test FP16 and INT8 quantized checkpoints for WebGPU/WASM compatibility.
- [ ] **Phase 2: In-Browser Worker & Cache Storage**:
  - Author `packages/stage-ui/src/workers/bark3/worker.ts` using `onnxruntime-web`.
  - Implement cache manager in `packages/stage-ui/src/libs/inference/cache-utils.ts` (`bark3-model-cache`).
- [ ] **Phase 3: Adapter & Hearing Store Wiring**:
  - Author `packages/stage-ui/src/libs/inference/adapters/bark3.ts`.
  - Expose `bark3-local` in `packages/stage-pages/src/pages/settings/providers/transcription/bark3-local.vue`.
  - Wire selection into `packages/stage-ui/src/stores/modules/hearing.ts`.
- [ ] **Phase 4: Pre-Transcription Chooser Integration**:
  - Connect Bark 3 as an instant local option for audio file attachment ingestion in the Desktop Chatbox.
