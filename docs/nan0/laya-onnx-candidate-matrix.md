# Laya ONNX Candidate Matrix & Web Integration Analysis

## 1. Overview & Context
Laya (`convaiinnovations/laya`) is the open-weights, non-autoregressive System 1 decision model based on ModernBERT-large (421M parameters). It accepts a state (conversational history, observations, context) and typed questions (choice, score, noul), returning calibrated probabilities and answers in a single forward pass without autoregressive text generation.

This document inventories the 18 community Hugging Face quantizations and checkpoints surveyed for local browser / Electron on-device execution in AIRI, recording technical attributes, storage footprint, and compatibility.

---

## 2. Comprehensive Candidate Inventory

| Repository | Format / Library | Precision / Size | File Structure | In-Browser WebGPU/WASM Feasibility | Status / Notes |
|---|---|---|---|---|---|
| **`tozp/laya-onnx`** | ONNX Runtime (Opset 14) | **INT8: 424 MB**<br>FP16: 843 MB<br>FP32: 1.68 GB | **Single standalone `.onnx` files**: `model_int8.onnx`, `model_fp16.onnx`, `model.onnx`, `tokenizer.json`, `tokenizer_config.json`, `rl_agent_config.json` | **Optimal (Selected)**. Self-contained single file avoids broken `.onnx.data` external chunk resolution in browser `CacheStorage`. Highest community downloads (114+). Max relative error vs FP32 ≤14.4% (INT8), ≤1.3% (FP16). | **Active Primary Target** |
| **`receptron/laya-onnx`** | ONNX Runtime (`@receptron/laya`) | FP32: 1.68 GB | `laya.onnx` + external `laya.onnx.data`, `laya_config.json`, `tokenizer/*` | Functional in Node.js cleanroom benchmarks, but 1.68 GB download and external `.data` chunk resolution makes browser CacheStorage fragile. | **Cleanroom Benchmark Baseline** |
| **`sevenreasons/laya-onnx-fp16`** | ONNX Runtime | FP16: 846 MB | Single `model.onnx`, `tokenizer/*`, `rl_agent_config.json` | High feasibility for desktop WebGPU, but double the download size of INT8 (846 MB vs 424 MB). | Secondary Desktop FP16 Alternative |
| **`inferenceprince/laya-onnx-int8`** | ONNX Runtime | INT8: 609 MB | Split `model.onnx` + `model.onnx.data`, `rl_agent_config.json`, `tokenizer/*` | Moderate. Split `.onnx.data` requires multi-file chunk streaming. | Evaluated |
| **`inferenceprince/laya-onnx`** | ONNX Runtime | FP32: ~1.6 GB | Split `model.onnx` + `model.onnx.data` | Heavy footprint for browser distribution. | Evaluated |
| **`nvkudva/laya-web-q8`** | ONNX Runtime Web | Q8: 524 MB | Split into `v1/encoder_q8.onnx` + `v1/head_q8.onnx` + `.data` | Complex pipeline: requires coordinating two separate ONNX sessions (encoder pass then head pass). | Evaluated |
| **`VishalMysore/layaForWeb`** | ONNX Runtime Web | Q4 / Q8: 754 MB | Split into 12–18 chunked parts (`.part000` ... `.part017`) | Requires joining multiple sliced binary files in memory before initializing ONNX session. | Evaluated |
| **`piffie/laya-onnx`** | ONNX Runtime | FP32: 1.68 GB | `laya_fp32.onnx` + `laya_fp32.onnx.data` | Unquantized full float32 weights. | Evaluated |
| **`Mattepiu/laya-onnx`** | ONNX Runtime | INT8 / FP16 | `int8/laya_int8.onnx`, `fp16_onlygpu_unverified/laya_fp16.onnx` | Experimental exports with unverified GPU kernels. | Evaluated |
| **`yehor-oleksiuk/laya-english-onnx`** | ONNX Runtime | FP32: ~1.6 GB | `laya.onnx` + data | Standard FP32 English export. | Evaluated |
| **`m1rhan/laya-typed-decisions-ONNX`** | ONNX Runtime | MaskedLM | Specialized typed-decisions variant. | Fill-mask pipeline tag. | Specialized Domain Checkpoint |
| **`FluidInference/laya-coreml`** | CoreML (ANE) | INT8 / FP16 | `.mlpackage` compiled | Target for native macOS/iOS Apple Neural Engine inference via `NativeAI`. | CoreML Track |
| **`FluidInference/laya-english-coreml`**| CoreML (ANE) | INT8 / FP16 | `.mlpackage` | Native Apple Silicon optimization. | CoreML Track |
| **`aac6fef/laya-coreml`** | CoreML (ANE) | FP16 | `.mlpackage` | Community Apple Silicon export. | CoreML Track |
| **`mys/laya-GGUF`** | GGUF (llama.cpp) | Q4_K_M / Q8: 0.4B | `.gguf` | Useful for llama.cpp / Ollama local server runners, but not native in-browser WASM. | GGUF Track |
| **`fr0stbit3/laya-gguf`** | GGUF (llama.cpp) | Q4_K / Q8 | `.gguf` | GGUF format for llama.cpp backends. | GGUF Track |
| **`danielamitay/laya-en-fp32-swev`** | PyTorch / SafeTensors | FP32 | PyTorch weights | Unquantized source weights. | Reference Only |
| **`p-yan/laya-quanto`** | HuggingFace Quanto | INT4 / INT8 | Quanto linear layers | Python-only Quanto runtime; not ONNX compatible. | Reference Only |

---

## 3. Technical Selection Rationale for `tozp/laya-onnx`

1. **Self-Contained Single File Architecture**:
   Standard ONNX models exceeding 2 GB or exported with external data store split files (`model.onnx` and `model.onnx.data`). In browsers, `onnxruntime-web` attempts to fetch external data files relative to the base URL or requires passing memory buffers with pre-resolved paths. `tozp/laya-onnx/model_int8.onnx` bundles all tensor data into a single 424 MB binary, allowing direct `CacheStorage` caching and zero-dependency loading via `ort.InferenceSession.create(arrayBuffer)`.

2. **Quantization Accuracy**:
   - Evaluated by exporter against FP32 across representative decision sequences:
     - FP16: Maximum output relative error ≤ 1.3%.
     - INT8: Maximum output relative error ≤ 14.4%.
   - In classification and decision-boundary tasks with proper scoring rules (RLCD), rank-ordering and calibrated choices are robust under INT8 quantization.

3. **Inference Input/Output Alignment**:
   - Inputs: `input_ids`, `attention_mask`, `marker_pos`, `marker_mask`, `qtype`.
   - Outputs: `logits`, `act`.
   - Sequence format directly matches the ModernBERT sequence builder:
     `[CLS] <type> question: instructions [SEP] [MASK] opt0 [MASK] opt1 ... [SEP] state [SEP]`

---

## 4. Re-evaluation (2026-10-11): `tozp/laya-onnx` superseded

Section 3 rested on the exporter's reported error bounds and a successful `session.run`; neither checks that the answers are right. Running the same tensors the worker builds against a known-answer state (a duplicate-charge email: department `billing`, churn threat yes, weather question no) showed:

| Source | Answers | Sequence length | ORT CPU, 4 questions, 1 thread |
|---|---|---|---|
| `tozp/laya-onnx` `model_int8.onnx` | **Uniform** (25/25/25/25, 50/50); option logits nearly identical even for random inputs | Fixed 512 | 10.5 s |
| `tozp/laya-onnx` `model_fp16.onnx` | Correct (billing 0.999, churn 0.956, weather 0.000) | **Fixed 512** (head attention reshape baked to `{512, 16·batch, 64}`) | 18.0 s |
| `onnx-community/laya-ONNX` `onnx/model_fp16.onnx` (+ `_data`) | Correct, identical to tozp fp16 | Dynamic | 3.3 s at L=96 |
| `bgoldfarb93/laya-int8` `laya.onnx` (single file, `MatMulNBits` 8-bit) | Correct (within 0.01 of fp16) | Dynamic | 4.7 s at L=96 |
| `inferenceprince/laya-onnx-int8` (+ `.data`) | Correct (within 0.01 of fp16) | Dynamic | 5.0 s at L=96 |

Through the worker's own JS path (`onnxruntime-web` 1.24.2 WASM in Node, 4 questions): tozp fp16 padded to 512 took 66.7 s; `bgoldfarb93/laya-int8` and onnx-community fp16 at the real length took ~11.5 s on one thread and ~3.1 s on four.

All of these graphs also run an unconditional `topk(2)` over the option axis, so a batch whose widest question has a single option fails with `k argument [2] should not be greater than specified axis dim value [1]`; the worker pads the option axis to at least two masked slots.

**Current sources** (`packages/stage-ui/src/libs/inference/laya-models.ts`, pinned by commit): int8 → `bgoldfarb93/laya-int8` (single self-contained file, keeping the property section 3 valued); fp16 → `onnx-community/laya-ONNX` (validated on WebGPU by its exporter; external `.onnx_data` is passed to ORT through `externalData`). The persisted model keys `tozp/laya-onnx` / `tozp/laya-onnx-fp16` remain as precision selectors only.

**Latency caveat:** single-threaded WASM (Windows Electron renderers are not cross-origin isolated, so `numThreads = 1`) needs ~3 s per question, far above the layered-memory budgets (triage 2.5 s for 5 questions, rerank 4 s for 6). On that path triage falls back to heuristics and rerank keeps the RRF order; WebGPU or a multi-threaded WASM runtime is required for Laya to actually serve those calls.
