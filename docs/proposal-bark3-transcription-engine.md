# Proposal: Bark 3 (Underdog Parakeet-TDT) Ultra-Lightweight Local ASR Engine for AIRI

> **Status**: Proposed RFC
> **Document**: `docs/proposal-bark3-transcription-engine.md`
> **Target Audience**: Core Runtime Developers, Audio Pipeline Engineers, Speech Modality Contributors
> **Authoritative References**:
> - Hugging Face ONNX Export: [`ai-ecoverse/Underdog-Bark-3.0-ONNX`](https://huggingface.co/ai-ecoverse/Underdog-Bark-3.0-ONNX)
> - Base Model: [`ConwayResearch/Underdog-Bark-3.0`](https://huggingface.co/ConwayResearch/Underdog-Bark-3.0) (fine-tuned from NVIDIA `parakeet-tdt-0.6b-v3`)
> - AIRI Retrospective: [`docs/analysis-gpt-sovits-onnx-webgpu-viability.md`](docs/analysis-gpt-sovits-onnx-webgpu-viability.md)
> - AIRI Local TTS Engines: [`docs/analysis-pocket-tts-viability.md`](docs/analysis-pocket-tts-viability.md), [`docs/research-moss-tts-nano-report.md`](docs/research-moss-tts-nano-report.md)
> - Pipeline Interfaces: `packages/stage-ui/src/stores/modules/hearing.ts`, `packages/stage-ui/src/libs/workers/worker.ts`

---

## 1. Executive Summary & Problem Statement

### 1.1 The Bottleneck of Current Local STT (Whisper)
In AIRI's local-first desktop and web runtime, offline speech transcription (STT) currently relies almost entirely on local Whisper models (`packages/stage-ui/src/libs/workers/worker.ts` and `packages/stage-ui/src/libs/inference/adapters/whisper.ts`).

In real-world companion interactions, Whisper exhibits three critical bottlenecks:
1. **High Latency & Autoregressive Decoder Overhead**: Whisper's transformer encoder-decoder performs sequence-level cross-attention token-by-token. In browser WebAssembly or WebGPU, transcription of a 3-second utterance often takes 2,000ms–5,000ms, stalling conversational pacing and filler handoffs.
2. **Unified Memory Pressure**: Running a large Whisper decoder alongside unified 3D/Live2D graphics contexts, WebLLM/RWKV consciousness workers, and TTS synthesizers triggers memory pressure evictions on 8 GB–16 GB consumer machines.
3. **Audio Preprocessing Disconnect**: Whisper's feature extractor requires complex padding and positional embeddings that do not stream efficiently.

### 1.2 The Bark 3 (Underdog Parakeet-TDT) Breakthrough
**Underdog Bark 3.0** (released by Conway Research and exported to ONNX by `ai-ecoverse`) is an English speech recognition model fine-tuned from NVIDIA's **Parakeet-TDT-0.6b-v3**.

Unlike autoregressive decoders or classic CTC models, Bark 3 uses a **Token-and-Duration Transducer (TDT)** architecture:
* **Token & Duration Prediction**: In a single joint forward pass, the model predicts both the token and how many audio frames to advance ($0, 1, 2, 3, \text{or } 4$). It skips multiple silent or steady frames in a single bound, dramatically reducing decoder forward passes.
* **Compact Quantized ONNX Weights**:
  * `q4f16` (INT4 encoder + FP16 decoder): **524 MB** total.
  * `q8` (INT8 quantized): **911 MB** total.
  * `fp16`: **1,291 MB** total.
* **Sub-Second Turnaround**: The FastConformer 8× subsampling encoder runs in a single shot, followed by a fast TDT joint loop that transcribes audio in ~1 second with lower Word Error Rates (WER) than Whisper Large v3.
* **Permissive Licensing**: CC-BY-4.0 license supporting commercial use with attribution.

---

## 2. Architectural Analysis: Python Codebase Crawl (`export/tdt.py`)

A full crawl of the ONNX reference export repository ([`ai-ecoverse/Underdog-Bark-3.0-ONNX`](https://huggingface.co/ai-ecoverse/Underdog-Bark-3.0-ONNX)) reveals that the model consists of **two decoupled ONNX graphs** plus an exact Python/NumPy reference client (`export/tdt.py`) specifically created as a blueprint for JavaScript engines.

```
[ Microphone Audio: 16 kHz Mono PCM ]
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│ STAGE 1: Log-Mel Spectrogram Frontend (TypeScript/WASM)   │
│ - 0.25s Leading Silence + Pre-emphasis (0.97)            │
│ - Centred STFT (n_fft: 512, hop: 160, win: 400 Hann)     │
│ - 128 Slaney Mel Filterbank + Log Compression            │
│ - Unbiased Per-Feature Valid Frame Normalization         │
└──────────────────────────────────────────────────────────┘
                  │  input_features: [1, T, 128] f32
                  │  attention_mask: [1, T] i64
                  ▼
┌──────────────────────────────────────────────────────────┐
│ STAGE 2: FastConformer Encoder (`encoder_model.onnx`)    │
│ - Fast 8x Subsampling Convolution + Conformer Blocks     │
│ - Single one-shot forward pass                          │
└──────────────────────────────────────────────────────────┘
                  │  encoder_outputs: [1, T', 640] f32
                  │  encoder_lengths: [1] i64
                  ▼
┌──────────────────────────────────────────────────────────┐
│ STAGE 3: Greedy TDT Decoder (`decoder_joint_model.onnx`) │
│ - Frame index t = 0, last_token = 8192 (blank)          │
│ - Recurrent states: state_h [2, 1, 640], state_c         │
│ - Joint step emits (token_id, duration in 0..4)          │
│ - If blank: advance t += max(dur, 1)                     │
│ - If token: emit token, advance t += dur, update state   │
└──────────────────────────────────────────────────────────┘
                  │  token_ids: number[]
                  ▼
┌──────────────────────────────────────────────────────────┐
│ STAGE 4: SentencePiece Detokenization (`tokenizer.json`) │
│ - Map ids to pieces, replace ' ' with ' '                │
│ - Direct join (no CTC deduplication needed)              │
└──────────────────────────────────────────────────────────┘
```

### 2.1 The Two ONNX Graphs

1. **`encoder_model.onnx`** (FastConformer Backbone):
   * **Inputs**:
     * `input_features`: `float32 [B, T, 128]`
     * `attention_mask`: `int64 [B, T]`
   * **Outputs**:
     * `encoder_outputs`: `float32 [B, T', 640]` ($T' \approx \lfloor T / 8 \rfloor$)
     * `encoder_lengths`: `int64 [B]`
   * **Execution**: Run once per utterance. Extremely fast on WebGPU or WASM SIMD.

2. **`decoder_joint_model.onnx`** (~70 MB Prediction + Joint Network):
   * **Inputs**:
     * `encoder_outputs`: `float32 [B, 1, 640]` (slice at active frame $t$)
     * `input_ids`: `int64 [B, 1]` (last emitted non-blank token; initialized to blank `8192`)
     * `state_h`: `float32 [2, B, 640]` (LSTM/recurrent hidden state)
     * `state_c`: `float32 [2, B, 640]` (cell state)
   * **Outputs**:
     * `token_logits`: `float32 [B, 8193]`
     * `duration_logits`: `float32 [B, 5]` over durations $[0, 1, 2, 3, 4]$
     * `state_h_out`: `float32 [2, B, 640]`
     * `state_c_out`: `float32 [2, B, 640]`

### 2.2 The Reference Greedy TDT Algorithm (`export/tdt.py`)
The greedy loop implemented in `export/tdt.py` is compact and translates directly into TypeScript:

```python
# Reference from export/tdt.py:
def greedy_tdt(dj, enc, enc_len, gen):
    V, blank, durs = gen["vocab_size"], gen["blank_token_id"], gen["durations"]
    H, Ld = gen["decoder_hidden_size"], gen["num_decoder_layers"]
    max_steps = gen["max_symbols_per_step"] * enc.shape[1] - 1
    h = np.zeros((Ld, 1, H), np.float32)
    c = np.zeros_like(h)
    last, t, toks, ds = blank, 0, [], []
    while t < enc_len and len(toks) < max_steps:
        tl, dl, h2, c2 = dj.run(None, {
            "encoder_outputs": enc[:, t:t + 1],
            "input_ids": np.array([[last]], np.int64),
            "state_h": h,
            "state_c": c
        })
        tok, d = int(tl[0].argmax()), durs[int(dl[0].argmax())]
        if tok == blank:
            d = max(d, 1)               # Blank always advances at least 1 frame
        else:
            last, h, c = tok, h2, c2    # State updates ONLY on non-blank token
        toks.append(tok)
        ds.append(d)
        t += d
        if tok == gen["eos_token_id"]:
            break
    return toks, ds
```

---

## 3. Cross-Synthesis: Lessons from GPT-SoVITS & Local Audio Retrospectives

AIRI's experience porting neural audio pipelines ([`docs/analysis-gpt-sovits-onnx-webgpu-viability.md`](docs/analysis-gpt-sovits-onnx-webgpu-viability.md), [`docs/analysis-pocket-tts-viability.md`](docs/analysis-pocket-tts-viability.md), and [`docs/research-moss-tts-nano-report.md`](docs/research-moss-tts-nano-report.md)) provides essential guidelines for Bark 3:

### 3.1 WASM SIMD vs. WebGPU Tradeoffs
* In the GPT-SoVITS retrospective (§2), pure WebGPU compute shaders failed on multi-graph pipelines because ONNX `Concat` operators exceeded WebGPU's minimum platform limit of **8 storage buffer bindings per shader stage** (requiring 17 bindings).
* Furthermore, chaining multiple distinct ONNX graphs in WebGPU caused driver context-switching conflicts with AIRI's Three.js / Live2D renderers.
* **Prescription for Bark 3**:
  * **Encoder**: Can run on WebGPU or WASM SIMD.
  * **Decoder Joint Loop**: **Must run on Multithreaded WASM SIMD**. Because the decoder executes in a tight loop per frame step, WASM SIMD avoids GPU-to-CPU readback latency (`mapAsync`) on every single step.

### 3.2 Single-Slot Model Cache Pattern
Following [`airi-local-tts-engines`](.agents/skills/airi-local-tts-engines/SKILL.md) §2:
* Bark 3 offers multiple quantizations (`q4f16` @ 524 MB, `q8` @ 911 MB).
* AIRI must enforce the single-active-variant eviction pattern (`evictOtherBark3Models`), caching the chosen variant in OPFS / CacheStorage (`bark3-model-cache`) and wiring it into [`ModelCacheManager.vue`](packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue).

---

## 4. Integration Difficulty & Feasibility Assessment

**Overall Difficulty Rating: MEDIUM (3–4 days of focused engineering)**

### Why It Is Tractable (Low Risk)
1. **Pre-Exported Clean ONNX Graphs**: No PyTorch export or custom operator debugging is required; `ai-ecoverse` has verified parity against PyTorch on macOS clips (0.0% WER delta on fp16/fp32).
2. **Deterministic Golden Fixtures**: The HF repository ships with `fixture/audio.flac`, `fixture/input_features.npy`, `fixture/mel_filters.npy`, `fixture/encoder_outputs.npy`, and `fixture/expected.json`. A Vitest test can verify our JS frontend against golden NumPy tensors step-by-step.
3. **Simple Decoder Logic**: The greedy TDT loop is under 30 lines of JavaScript, free from complex beam search or KV-cache management.

### Engineering Steps Required
1. **Mel Spectrogram Frontend in TypeScript / WebAssembly** (~1.5 days):
   * Implement 512-point FFT (using pure JS typed array FFT or a lightweight WebAssembly FFT module).
   * Bundle the pre-computed 128×257 Slaney mel filterbank matrix (`mel_filters.bin`, ~131 KB).
   * Implement pre-emphasis (0.97) and per-feature valid-frame normalization ($Z$-score).
2. **Worker & TDT Decoding Loop** (~1 day):
   * Create `packages/stage-ui/src/workers/bark3/worker.ts`.
   * Initialize `encoder_model.onnx` and `decoder_joint_model.onnx` with `onnxruntime-web`.
   * Implement the `greedy_tdt` loop with `BigInt64Array` / `Float32Array` buffers.
3. **SentencePiece Detokenizer** (~0.5 days):
   * Ingest `tokenizer.json` (8,193 tokens) and implement `detokenize()` string assembly.
4. **Adapter & Hearing Store Integration** (~0.5 days):
   * Author `packages/stage-ui/src/libs/inference/adapters/bark3.ts`.
   * Register `bark3-local` in `packages/stage-ui/src/stores/modules/hearing.ts` and `packages/stage-pages/src/pages/settings/providers/transcription/`.
   * Add cache management functions in `packages/stage-ui/src/libs/inference/cache-utils.ts`.

---

## 5. Verification Checklist

- [ ] **Frontend Parity Test**: Run Vitest against `fixture/audio.flac` and verify that the TypeScript Mel frontend produces features within $5 \times 10^{-4}$ max absolute error of `fixture/input_features.npy`.
- [ ] **Encoder Parity Test**: Verify `encoder_model_q4f16.onnx` output on `fixture/input_features.npy` matches `fixture/encoder_outputs.npy`.
- [ ] **Decoder Parity Test**: Verify greedy TDT produces exact tokens in `fixture/expected.json`.
- [ ] **Microphone Pipeline Test**: Record live microphone stream via VAD, verify sub-1.2s transcription and error-free ingestion into `chatOrchestrator.ingest`.
- [ ] **Cache Eviction Test**: Verify single-slot cache eviction in `cache-utils.test.ts` and ensure correct display in `ModelCacheManager.vue`.
