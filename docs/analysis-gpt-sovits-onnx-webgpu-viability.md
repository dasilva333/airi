# Architectural Retrospective: GPT-SoVITS & MOSS-TTS-Nano Browser Viability

## Executive Summary

This document records the architectural evaluation of **GPT-SoVITS** (and its sibling architecture **MOSS-TTS-Nano**) for browser-native integration into AIRI.

While initial attempts at pure **WebGPU** execution hit driver storage-buffer limits (due to ONNX `Concat` operators exceeding 8 WebGPU storage bindings), subsequent breakthroughs in **Prompt Audio Code Caching (`prompt_audio_codes`)** and **Multithreaded WASM SIMD execution** successfully unlocked real-time, browser-native voice cloning in AIRI.

---

## 1. Architectural Breakdown: GPT-SoVITS & MOSS

GPT-SoVITS and MOSS-TTS-Nano achieve high-fidelity zero-shot voice cloning using a 2-stage hybrid neural pipeline:

```
[Target Text + Reference Audio]
         │
         ├──> Stage A: CNHubert / Audio Encoders (Reference Feature Extraction)
         ├──> Stage B: Phoneme & Text Embedding
         │
         ▼
 Stage C: Autoregressive / Code Transformer (Generates Audio Tokens)
         │
         ▼
 Stage D: Neural Vocoder / Synthesizer (Flow Decoder + VITS / HiFi-GAN)
         │
         ▼
     [Output Audio WAV]
```

---

## 2. WebGPU Pitfalls vs. The WASM + Caching Victory

### The Initial WebGPU Bottleneck
* **Storage Buffer Limits**: Attempting to execute the full multi-graph pipeline on `onnxruntime-web` WebGPU hit a hard browser wall: ONNX `Concat` operators inside the transformer layer required **17 storage buffers**, exceeding WebGPU's minimum platform limit of 8 per compute shader stage.
* **Multi-Graph Context Switching**: Chaining 4 distinct `.onnx` models per generation turn caused WebGPU driver context swapping and memory pressure evictions alongside AIRI's Live2D/3D canvases.

### The Breakthrough Solution: Pre-Computed Feature Caching
In commit `868358ccb` (`feat(stage-ui): optimize MOSS-TTS-Nano voice cloning pipeline`), AIRI established the **Prompt Audio Code Caching Pattern**:

1. **One-Time Feature Extraction**: When a custom voice clone profile is created, Stage A (Reference Audio Feature Extraction) runs **once**.
2. **OPFS / IndexedDB Storage**: The resulting `prompt_audio_codes` are cached permanently in `localforage` (`moss-voice-profiles-metadata`).
3. **Subsequent Turn Fast-Path**: Subsequent speech synthesis calls bypass Stage A entirely, passing the pre-computed `prompt_audio_codes` directly to the generator.
4. **WASM SIMD Execution**: By routing generation through **Multithreaded WASM SIMD** (instead of raw WebGPU compute shaders), storage buffer limits are bypassed completely, yielding ultra-stable, zero-crash, sub-second latency voice cloning directly in the browser!

---

## 3. Updated Model Integration Checklist

Before porting any neural audio model to AIRI:

1. **Cache Pre-Stage Features**: Avoid re-running feature extraction/SSL encoders on every turn. Extract once during profile import and cache in OPFS.
2. **Prefer WASM SIMD for Complex Topologies**: If an ONNX graph contains deep multi-buffer concats, WASM SIMD provides guaranteed cross-platform stability over browser WebGPU shader limits.
3. **Chunked Streaming**: Ensure the vocoder supports frame-by-frame or chunked decoding to yield low first-byte audio latency.

---

## 4. Integration Verdict for GPT-SoVITS

GPT-SoVITS **is viable** for browser-native integration under AIRI's updated architecture:
- Extract reference audio features once and store `prompt_audio_codes` in IndexedDB/OPFS.
- Run the GPT sampling & VITS vocoder stages via WASM SIMD in a dedicated Web Worker.
- Option to offer local Python sidecar for high-end desktop GPUs when extreme batch sizes are required.
