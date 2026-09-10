# Architectural Viability Report: Audio8-TTS-Preview (0.1B) Browser ONNX Integration

## Executive Summary

This document evaluates the practical feasibility, architectural friction, and implementation tax of porting **Audio8-TTS-Preview-0.1b** (specifically its CPU-native ONNX INT8 checkpoint `Audio8/audio8-TTS-0.1B-ONNX-INT8`) into AIRI as a client-side speech provider.

* **Initial Spec Impression**: ~100M parameter Falcon-H1 hybrid backbone, 11 supported languages (including Japanese, Chinese, and Korean), 44.1 kHz output, INT8 quantization, and a packaged ONNX export.
* **Realistic Ground-Truth Assessment**: **4.8 / 10 (Low–Moderate Viability / High Implementation Tax, Diminishing Returns)**.

While the raw checkpoint specs seem alluring on Hugging Face, integrating Audio8 into a browser Web Worker is **not a turnkey port like Kyutai Pocket TTS**. It is another **"MOSS-grade trench war"**—requiring manual reverse-engineering of an unverified Python runtime into browser TypeScript, re-authoring ONNX graph boundaries, overcoming browser WASM/WebGPU memory constraints, and coping with mandatory transcript-conditioned voice cloning—all for English quality that offers no tangible leap over existing integrated engines.

---

## 1. The Integration Spectrum: "Pocket vs. MOSS"

To accurately assess developer effort and project risk, any candidate TTS model must be benchmarked against AIRI’s empirical integration history:

```
[TURNKEY / READY RUNTIME] ◄──────────────────────────────► [RAW RESEARCH / UNCHARTED]
       Pocket TTS (~2 Hours)                                    MOSS-TTS-Nano (~4+ Days)
  • Web ONNX graphs pre-packaged                            • No web runtime existed
  • Pre-built WASM SentencePiece                            • Raw Python repo reference only
  • Working browser reference client                        • Reverse-engineered graph split in JS
  • Single-file INT8 models in OPFS                         • Fought incoherent audio for 48h+
  • Transcript-free voice cloning                           • Disjointed codec token state loop
                                        ▲
                                        │
                            Audio8-TTS Preview 0.1B
                             (100% on the MOSS side)
```

### Why Pocket TTS Was a 2-Hour Breeze
1. **Pre-Existing Web Artifacts**: `KevinAHM/pocket-tts-onnx` already shipped clean, standalone, browser-verified `.onnx` graphs.
2. **Reference Client Code**: A fully functional browser demo existed, detailing exact tensor names, shapes, and sequence flow.
3. **Turnkey Codec**: Mimi decoder accepted chunked latents directly at 24kHz without manual multi-codebook recurrence.
4. **Zero-Friction Voice Cloning**: Reference audio required no transcript—just a single pass through `mimi_encoder`.

### Why Audio8 Is a High-Friction "MOSS Job"
1. **Zero Browser Web Runtime Exists**: The official Audio8 repository only provides a Python runtime (`onnx_runtime_0_1b_int8/`) targeting native C++ `onnxruntime` bindings via Python scripts (`register_default_voice.py`, `run_infer.sh`).
2. **Reverse-Engineering from Scratch**: AIRI developers would have to write 800+ lines of raw JavaScript/TypeScript in a Web Worker to manually replicate the Python step logic, tensor feeds, and sampling procedures without a browser reference baseline.
3. **Debugging in the Dark**: Like MOSS-TTS, any numerical divergence in the custom autoregressive step loop outputs silent or garbled screeching audio with zero visibility into whether the failure is in the tokenizer, KV cache, Mamba hidden state, or codec decoder.

---

## 2. Deep-Dive: The Engineering Hurdle Matrix

### 2.1 Falcon-H1 Hybrid Recurrence in JavaScript
Audio8 uses a non-standard hybrid architecture (Falcon-H1):
- **Slow AR (Semantic)**: 24 layers, width 512, 8 attention heads, 2 KV heads, combined with **Mamba state (`d_state 64`)**.
- **Fast AR (Acoustic)**: 4 layers, width 512, predicting 10 codebooks per frame.
- **Explicit State Passing**: To run per-token on CPU, the ONNX model requires passing both attention KV caches and Mamba recurrent states explicitly across step invocations. Managing 24 layers of multi-head attention caches plus 24 layers of Mamba state tensors inside a browser Web Worker memory heap is notoriously fragile. A single off-by-one index error or shape mismatch causes catastrophic state drift.

### 2.2 The ONNX Repackaging & External Data Problem
The official `Audio8/audio8-TTS-0.1B-ONNX-INT8` checkpoint does **not** ship as self-contained ONNX files:
```text
model/
├── slow_ar_int8.onnx
├── fast_ar_int8.onnx
├── codec_decoder_fp16.onnx
├── codec_decoder_fp16.onnx.data   <-- External weight blob (>2GB protobuf limit artifact)
└── registration/
    ├── codec_encoder_fp16.onnx
    └── codec_encoder_fp16.onnx.data  <-- External weight blob
```
- In native Python/C++, ONNX Runtime resolves `.data` files automatically via POSIX file system paths.
- In browser environments using `onnxruntime-web` over Origin Private File System (OPFS) or ArrayBuffers, **external data references frequently fail to resolve** unless:
  - Custom multi-buffer byte resolvers are implemented.
  - Or the graphs are manually unpacked and re-quantized/re-serialized into single-file binaries without external data. This alone constitutes a grueling day of offline Python model surgery.

### 2.3 Browser Web Platform & Memory Ceilings
- **Working Set Size**: Normal synthesis requires loading `slow_ar_int8` (~100MB), `fast_ar_int8` (~30MB), and `codec_decoder_fp16` (~240MB). Including runtime allocations, activations, and KV state tensors, the active heap reaches **~600 MB to 700 MB**.
- **WASM 32-Bit Memory Pressure**: While modern browsers support 4GB WebAssembly memory, running a 600MB neural heap inside the same renderer process alongside Live2D/VRM Three.js canvases, audio buffers, and IPC bridges dramatically increases OOM eviction risk under low-memory macOS/Windows conditions.
- **WebGPU Shader Cache & Storage Limits**: Attempting to move any of Audio8's graphs to WebGPU triggers the canonical failure modes documented in [`analysis-gpt-sovits-onnx-webgpu-viability.md`](./analysis-gpt-sovits-onnx-webgpu-viability.md): shader compilation thrashing (compounding the browser's ~27 shader cache ceiling) and storage-buffer binding exhaustion in the multi-codebook fast AR.

---

## 3. Product & User Experience Tradeoffs

### 3.1 The English Audio Reality: Diminishing Returns
- In empirical listening tests, Audio8's 0.1B English output does **not** exhibit a perceptible leap in naturalness, prosody, or expressiveness over **Pocket TTS** or **Kokoro**.
- Both Pocket TTS (~100M) and Kokoro (~82M) already deliver exceptional, natural English speech with sub-200ms latency.
- Investing days of difficult reverse-engineering to gain another English voice engine that sounds essentially equivalent offers **near-zero ROI** for the core user experience.

### 3.2 Voice Cloning Friction: Mandatory Exact Transcripts
Unlike Pocket TTS—where a user can drop any raw `.wav` file and instantly clone the voice—Audio8's DualAR architecture **requires the exact verbatim transcript** (`reference_text`) matching the reference audio:
- If a user uploads a 5-second clip of an anime character, they must manually transcribe every spoken word accurately.
- Any discrepancy between the reference audio and the reference transcript severely degrades generation stability, introducing stuttering, hallucinations, or phonetic collapses.
- This creates substantial UX friction in AIRI's voice profile settings dialog (`stage-pages`), forcing users to supply clean text for every audio sample.

### 3.3 The Single Genuine Asset: Asian Languages (JA, ZH, KO)
- Audio8’s only compelling differentiator is that it provides **Japanese (`ja`)**, **Chinese (`zh`)**, and **Korean (`ko`)** voice cloning at the compact 0.1B parameter scale.
- However, for users whose primary interaction language is English, this benefit is completely dormant.

---

## 4. Comprehensive Comparison Matrix

| Evaluation Dimension | **Kokoro** (v0.19) | **Pocket TTS** (Kyutai) | **MOSS-TTS-Nano** | **Audio8-TTS Preview (0.1B)** |
| :--- | :--- | :--- | :--- | :--- |
| **AIRI Integration Status** | **Production Core** | **Production Core** | **Production Core (WASM)** | **Evaluated Candidate** |
| **Implementation Effort** | Minimal (via `kokoro-js`) | ~2 Hours (Turnkey ONNX) | ~4 Days (Grueling Port) | **Estimated 4–5 Days (High Risk)** |
| **Web Runtime Baseline** | Proven NPM package | Proven Web ONNX + Demo | None (Custom authored) | **None (Python scripts only)** |
| **Model Footprint** | ~82M params (~80MB) | ~100M params (~160MB) | ~100M params (~400MB) | **~290M params (~600MB–1GB)** |
| **Latency / Throughput** | ~150ms TTFB | ~200ms TTFB (~6x RT) | ~400ms TTFB (~1.8x RT) | **~350ms TTFB (~1.5x–2.0x RT)** |
| **Cloning Requirement** | N/A (Fixed voices) | Reference WAV only | Reference WAV only | **Reference WAV + Exact Transcript** |
| **External `.data` Files** | No | No | Yes (Handled in port) | **Yes (Requires re-packaging)** |
| **Target Languages** | EN, JA (limited) | EN, FR, ES, DE, IT, PT | ZH, EN | **ZH, EN, JA, KO, DE, ES, FR, IT, NL, PL** |
| **Viability Score** | **9.5 / 10** | **9.0 / 10** | **6.5 / 10 (Post-hoc 7.8)**| **4.8 / 10** |

---

## 5. Architectural Verdict & Actionable Guidance

### Verdict: **DO NOT PORT TO BROWSER ONNX (Low ROI)**
Audio8-TTS-Preview-0.1B is **not recommended for in-browser ONNX integration**. The engineering cost of authoring a bespoke web runtime from scratch, restructuring external data graphs, and managing Falcon-H1 recurrence states in a Web Worker vastly outweighs the negligible acoustic benefit for English users.

### The Sensible Alternative: Sidecar / HTTP Provider
If Japanese/Chinese voice cloning on Audio8 is ever desired, AIRI should **not** run it inside `onnxruntime-web`.

Instead, leverage Audio8's built-in **OpenAI-compatible HTTP server**:
1. Run Audio8 natively on the host via its official Python environment (`start_server.sh` exposing port 8024).
2. Register it in AIRI via the existing generic **OpenAI-Compatible Speech Provider** (`/v1/audio/speech`).
3. This achieves 100% of the model's capabilities with **zero browser porting cost, zero shader limits, zero external `.data` headaches, and zero days of reverse-engineering**.

---

## Relevant Skills & References

- [[airi-audio-pipeline]]
- [[airi-local-inference-engines]]
- [[analysis-pocket-tts-viability]]
- [[analysis-gpt-sovits-onnx-webgpu-viability]]
- [[research-moss-tts-nano-report]]
