# Proposal: Kokoro TTS Evolution — Paradee 1.2 CPU Fallback & Inno-Kokoro Voice Clone-Tuning

> **Status**: Proposed RFC
> **Document**: `docs/proposal-kokoro-evolution-paradee-cpu-and-clone-tuner.md`
> **Target Audience**: Audio Pipeline Engineers, Speech Runtime Developers, Low-Spec Hardware Support
> **Key References**: `docs/analysis-audio8-tts-viability.md`, `packages/stage-ui/src/workers/kokoro/`, `packages/stage-ui/src/libs/inference/adapters/kokoro.ts`, `.agents/skills/airi-local-tts-engines/SKILL.md`

---

## 🧭 1. Executive Summary & Dual Objectives

**Kokoro-82M** is AIRI's default, most reliable local text-to-speech engine. Built on StyleTTS2 and an ISTFTNet vocoder, it delivers exceptional 24kHz natural speech in English with sub-200ms latency.

However, two persistent user-experience pain points remain in production:
1. **The WebGPU/WASM Hardware Ceiling**: Some users on low-spec laptops, budget integrated GPUs, or older operating systems experience WebGPU adapter failures, shader compilation timeouts, or WASM heap allocation errors when loading the standard 82M ONNX model.
2. **Fixed-Voice Limitation (No Voice Cloning)**: Unlike Kyutai Pocket TTS, Kokoro in AIRI is currently hard-coded to a static bank of preset voices (`af_heart`, `af_bella`, `am_adam`, etc.). Users cannot clone a voice or supply their own character audio.

This **2-for-1 proposal** resolves both bottlenecks simultaneously:
* **Pillar 1: Paradee 1.2 (Ultra-Lightweight CPU Fallback)**: Distilled directly from Kokoro down to **8.5 MB compressed (35 MB uncompressed)**, running on a **single CPU thread with zero GPU/WebGPU requirement** under Apache 2.0.
* **Pillar 2: Inno-Kokoro Style Vector Clone-Tuner**: Implements zero-shot voice-pack extraction from short 5–30s reference audio, producing stock-compatible Kokoro style vectors (`[510, 1, 256]`) in under 1 second.

---

## 🏎️ 2. Pillar 1: Paradee 1.2 (Lowering the Entry Floor to Pure CPU)

### Architectural Profile
* **Origin**: Distilled from Kokoro by Sahil Mahendrakar.
* **Footprint**: 8.5 MB quantized / 35 MB full binary (Apache 2.0).
* **Execution**: Single-threaded CPU inference. Requires zero WebGPU shaders, zero complex multi-codebook recurrence, and minimal RAM (~60 MB working set).
* **Presets**: 4 built-in verified voices.

```
┌────────────────────────────────────────────────────────┐
│ AIRI Speech Engine Dispatcher                          │
└────────────────────────────────────────────────────────┘
                 │
                 ├──► [Hardware Check: WebGPU / 4GB+ RAM]
                 │       ├── Yes ──► Standard Kokoro-82M (Full Fidelity)
                 │       │
                 │       └── No (or Device Loss) ──► Paradee 1.2 (8.5 MB CPU Fallback)
                 │                                   • 100% Reliable Boot
                 │                                   • Single CPU Thread
                 │                                   • Zero Shader Compilation
```

### Integration in AIRI:
1. **Fallback Promotion**: If `isWebGPUSupported()` returns false or `onnxruntime-web` hits a context loss during Kokoro initialization, AIRI automatically falls back to `paradee-cpu` instead of going completely mute.
2. **Onboarding & Pocket Parity**: Ideal default starter voice for `apps/stage-pocket` (iOS/Android mobile builds) where mobile OS thermal throttling frequently penalizes 80M+ parameter models.

---

## 🎙️ 3. Pillar 2: Inno-Kokoro Voice Clone-Tuner (Zero-Shot Custom Voices)

### How Kokoro Voice Conditioning Works
Kokoro’s architecture uses **style vectors** of shape `[510, 1, 256]`—representing a 256-dimensional style embedding mapped across phoneme sequence lengths up to 510 tokens. During inference, the model reads the matching style vector and passes it in a single feed-forward step to the vocoder.

Until recently, extracting custom style vectors from reference audio was impossible in vanilla Kokoro because the official checkpoint did not ship with an exposed style encoder.

### The Breakthrough: `remsky/inno-kokoro`
The open-source community created `inno-kokoro` (Kokoro Inno Clone-Tuner):
1. **Input**: A 5-to-30 second audio clip of any character or user voice (`.wav` or `.mp3`).
2. **Automatic Pitch Ceiling Detection**: Analyzes the harmonic spacing of the reference audio to calculate `fmax`, ensuring vintage or band-limited audio does not octave-jump.
3. **Sub-Second Mapping**: Projects the audio embedding through a tuned projection into the exact `[510, 1, 256]` tensor format in **less than 1 second**.
4. **Output**: A standard `.pt` / Float32Array voice pack that drops directly into Kokoro's inference pipeline.

```
[ User Uploads 10s Voice Clip ] ──► [ inno-kokoro Tuner ] ──► [ [510, 1, 256] Style Tensor ]
                                                                             │
                                                                             ▼
                                                              [ localforage Voice Profile ]
                                                                             │
                                                                             ▼
                                                              [ Kokoro-82M Feed-Forward Pass ]
                                                                             │
                                                                             ▼
                                                              [ Cloned Speech Output (24kHz) ]
```

### Persistence & Profile Wiring:
Following the established pattern in `.agents/skills/airi-local-tts-engines/SKILL.md`:
* **Metadata Store**: `kokoro-voice-profiles-metadata` in `localforage` storing `{ id: kokoro-profile-<sha16>, name, createdAt, styleVector: Float32Array }`.
* **Zero Per-Turn Overhead**: The style vector is extracted once upon upload and cached. During live chat, Kokoro passes the cached tensor directly, adding 0ms overhead to TTS turns.

---

## ⚖️ 4. Comparison Matrix: Kokoro Evolution

| Feature | Vanilla Kokoro-82M | Paradee 1.2 (Pillar 1) | Kokoro + Inno-Tuner (Pillar 2) |
| :--- | :--- | :--- | :--- |
| **Model Size** | ~82 MB | **8.5 MB** | ~82 MB (engine) + ~500 KB (per voice vector) |
| **Compute Target** | WebGPU / Multi-Thread WASM | **Single CPU Thread** | WebGPU / WASM |
| **Voice Palette** | Fixed bank (~10 voices) | 4 built-in presets | **Unlimited custom voice clones** |
| **Cloning Latency** | N/A (Unsupported) | N/A | **< 1.0 second (one-time)** |
| **Hardware Barrier** | Medium | **Ultra-Low (Universal Fallback)** | Medium |

---

## 📅 5. Implementation Roadmap

- [ ] **Phase 1: Paradee 1.2 Adapter**:
  - Export Paradee 1.2 ONNX graph into `packages/stage-ui/src/workers/kokoro/paradee/`.
  - Add CPU fallback route in `packages/stage-ui/src/libs/inference/adapters/kokoro.ts`.
- [ ] **Phase 2: Inno-Kokoro Style Vector Extractor**:
  - Implement browser-compatible ONNX style extraction script from `inno-kokoro`.
  - Add `kokoro-voice-profiles-metadata` repository in `packages/stage-ui/src/stores/providers/kokoro-audio-utils.ts`.
- [ ] **Phase 3: Settings UI Extension**:
  - Add "Custom Voice Cloning" tab to `packages/stage-pages/src/pages/settings/providers/speech/kokoro-local.vue` matching the Pocket TTS profile manager.
