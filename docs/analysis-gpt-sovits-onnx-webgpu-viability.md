# Analysis: GPT-SoVITS ONNX Browser & WebGPU Viability

## Executive Summary

This document records the architectural evaluation of **GPT-SoVITS** (specifically `RVC-Boss/GPT-SoVITS/GPT_SoVITS/onnx_export.py`) for potential browser-native WebGPU / WASM integration into AIRI.

Based on our empirical lessons from the **MOSS-TTS-Nano** WebGPU attempt (documented in [`proposal-moss-tts-nano-provider-unified-webgpu.md`](./proposal-moss-tts-nano-provider-unified-webgpu.md)), this analysis outlines why **GPT-SoVITS should NOT be ported directly to `onnxruntime-web`** in the browser, and establishes the canonical **ONNX Model Vetting Rigor Checklist** for future candidate models.

---

## 1. Architectural Breakdown of GPT-SoVITS

GPT-SoVITS achieves high-fidelity zero-shot voice cloning using a 2-stage hybrid neural pipeline:

```
[Target Text + 3s Ref Audio]
         │
         ├──> 1. CNHubert SSL (Reference Audio Feature Extractor)
         ├──> 2. BERT (Text Phoneme & Semantic Embedding)
         │
         ▼
 3. GPT-T2S Autoregressive Transformer (Predicts semantic tokens 1-by-1)
         │
         ▼
 4. SoVITS / VITS Synthesizer (Flow Decoder + HiFi-GAN / BigVGAN Vocoder)
         │
         ▼
     [Output Audio WAV]
```

### Script Reference
* **Upstream Export Script**: `RVC-Boss/GPT-SoVITS` $\rightarrow$ `GPT_SoVITS/onnx_export.py`

---

## 2. Browser & WebGPU Audit (Why NOT to Port Native to Browser)

| Audit Benchmark | GPT-SoVITS Reality | Browser / WebGPU Impact | Status |
| :--- | :--- | :--- | :--- |
| **Graph Topology** | **Chained 4-Graph Pipeline** (`CNHubert` $\rightarrow$ `BERT` $\rightarrow$ `GPT-T2S` $\rightarrow$ `SoVITS`) | Requires 4 separate ONNX Runtime Web sessions executing sequentially per turn. Hits browser shader binding/context-switching limits (~16-24 active slots). | ❌ FAIL |
| **Autoregressive Loop** | **Token-by-Token Sampling** (GPT stage generates codes 1-by-1) | JS-to-WASM IPC overhead on every token iteration creates heavy latency. ORT WebGPU loop operators suffer from driver compilation panics. | ❌ FAIL |
| **Memory Footprint** | **~750MB – 1GB total weights** (`.onnx` + `.data`) | Exceeds safe browser WASM memory allocations and triggers WebGPU VRAM pressure evictions alongside 3D VRM/Live2D stage canvases. | ❌ FAIL |

### Conclusion
Attempting a browser-native `onnxruntime-web` port of GPT-SoVITS will hit the **exact same shader binding, multi-graph context switching, and VRAM eviction wall** as MOSS-TTS-Nano.

---

## 3. The Canonical ONNX Model Vetting Checklist

Before spending engineering time porting any new ONNX model to AIRI's in-browser inference runtime, apply this 3-step audit:

### Rule 1: Fused Single-Graph Topology
* **Requirement**: The ONNX model must export as a **single fused end-to-end graph** (Text In $\rightarrow$ Audio/Text Out), like **Kokoro 82M**.
* **Red Flag**: Any model requiring 3+ separate `.onnx` sub-graph files (e.g. separate encoder, autoregressive prefill, decode-step, and neural vocoder).

### Rule 2: Memory & WASM Budget
* **Requirement**: Total weight payload should be **under 300MB**.
* **Reasoning**: Browser WASM instances cap around 4GB total, and WebGPU shares VRAM with the desktop window compositor and Live2D/VRM/Spine rendering canvases.

### Rule 3: Autoregressive Loop Handling
* **Requirement**: Non-autoregressive or hardware-fused sampling.
* **Red Flag**: Pure JS-driven token-by-token loops calling `session.run()` repeatedly in WebAssembly.

---

## 4. Recommended AIRI Integration Strategy

* **For Browser Native (In-Process)**: Use lightweight, single-fused ONNX models (e.g. Kokoro 82M).
* **For Complex Voice Cloning (GPT-SoVITS / MOSS / Fish-Speech)**: Route through a **Local Python Sidecar** or **Remote Provider Endpoints** (e.g. Replicate, Chatterbox, Audio Studio virtual bundles) rather than forcing multi-graph ONNX execution inside browser workers.
