# Canonical Reference: Kyutai Pocket TTS Browser Architecture & Implementation Index

## Executive Summary

This document serves as the canonical concept-to-path reference for **Kyutai Pocket TTS** (~100M parameter CPU-native text-to-speech engine) integrated natively into AIRI.

Following our empirical victory with **MOSS-TTS-Nano** (utilizing **Prompt Audio Code Caching** + **Multithreaded WASM SIMD** via `onnxruntime-web`), Pocket TTS provides low-latency (~200ms) multi-language speech generation (English, French, Spanish, German, Portuguese, Italian) and zero-shot voice cloning directly inside browser workers without GPU storage-buffer limit risks.

---

## 1. Model Architecture & Pipeline Overview

Pocket TTS is a 2-stage neural text-to-speech system optimized for low-latency CPU execution:

```
[Target Text + Reference Audio (.wav)]
          │
          ├──> 1. Text Conditioner (Phoneme & Language Embeddings)
          ├──> 2. Mimi Encoder (Reference Audio Feature Extractor)
          │
          ▼
 3. Flow-LM Transformer (~100M Params) (Predicts acoustic frames)
          │
          ▼
 4. Mimi Decoder (Neural Audio Vocoder)
          │
          ▼
     [Output Audio WAV]
```

### Performance & Asset Benchmarks
* **Weight Payload**: ~100M parameters (~160MB Int8 quantized sub-graphs).
* **Upstream Model Source**: `KevinAHM/pocket-tts-onnx` on Hugging Face.
* **Storage Location**: Origin Private File System (OPFS) (`pocket-tts-browser-model-store`).
* **Latency**: ~200ms to first audio chunk (~6x real-time on 2 CPU cores).

---

## 2. Canonical File-to-Concept Path Index

Every file involved in the Pocket TTS integration is mapped below with its specific responsibility:

### A. Inference Contract & Eventa RPC Layer
- [`packages/stage-ui/src/libs/inference/contract.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/contract.ts)
  - Defines Eventa RPC contracts: `pocketTtsLoadEvent`, `pocketTtsGenerateEvent`, `pocketTtsUnloadEvent`.
  - Defines request/chunk types: `PocketTtsGenerateRequest` & `PocketTtsGenerateChunk`.

### B. Audio Conditioning & Adapter Layer
- [`packages/stage-ui/src/stores/providers/pocket-audio-utils.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/pocket-audio-utils.ts)
  - Exposes `getPocketTtsAdapterInstance()` singleton accessor.
  - Implements `preprocessPocketReferenceAudio()` Web Audio pipeline for 24kHz resampling (the `mimi_encoder` input rate), silence threshold trimming, and peak normalization.
- [`packages/stage-ui/src/libs/inference/adapters/pocket-tts.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/pocket-tts.ts)
  - Implements `createPocketTtsAdapter()` mutex-protected interface.
  - Controls Web Worker initialization, status updates (`downloading`, `ready`, `running`), WAV binary encoding, and `localforage` caching of `promptVoiceEmbedding` (`pocket-voice-profiles-metadata`).

### C. Web Worker & OPFS Engine Layer
- [`packages/stage-ui/src/workers/pocket-tts/pocket_model_store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/pocket-tts/pocket_model_store.ts)
  - OPFS model downloader targeting `KevinAHM/pocket-tts-onnx` Int8 quantized weights (`flow_lm_main_int8.onnx`, `flow_lm_flow_int8.onnx`, `mimi_decoder_int8.onnx`, `mimi_encoder_int8.onnx`, `text_conditioner_int8.onnx`, `tokenizer.model`, `bos_before_voice.npy`, `bundle.json`).
- [`packages/stage-ui/src/workers/pocket-tts/worker.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/pocket-tts/worker.ts)
  - Web Worker entrypoint speaking the Eventa stream contract.
  - Orchestrates ONNX sessions, streams PCM audio chunks, and emits `voice-embedding` on initial voice clone runs.
- [`packages/stage-ui/src/workers/pocket-tts/pocket_onnx_engine.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/workers/pocket-tts/pocket_onnx_engine.ts)
  - Faithful port of KevinAHM's reference runtime: SentencePiece text conditioning (WASM module loaded cross-origin from the HF demo space at runtime) → `flow_lm_main` voice/text prefill (empty `sequence`) → autoregressive frame loop (`sequence` = previous latent, NaN = BOS) → `flow_lm_flow` LSD flow-matching step (conditioning `[1,1024]` → 32-dim latent) → chunked `mimi_decoder` (`latent [1, F, 32]` time-major) at 24kHz.

### D. Provider Registry & Factory Layer
- [`packages/stage-ui/src/stores/providers/registry/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/speech.ts)
  - Registers the `'pocket-tts-local'` speech provider.
  - Implements `speech()` provider factory routing `/v1/audio/speech` requests to the Pocket TTS worker.
  - Provides model variants (`english_2026-04`, `french_24l`, `spanish_24l`, `german_24l`, `portuguese_24l`, `italian_24l`) and voice presets (`alba`, `estelle`, `lola`, `juergen`, `rafael`, `giovanni`).

### E. Settings UI & User Experience Layer
- [`packages/stage-pages/src/pages/settings/providers/speech/pocket-tts-local.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/speech/pocket-tts-local.vue)
  - Dedicated provider settings view with zero-shot voice clone WAV uploader, voice profile manager, and language model selector.
- [`packages/stage-pages/src/pages/settings/components/SettingsSearchBar.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/components/SettingsSearchBar.vue)
  - Quick-navigation search bar entry under `Providers (Speech)`.
- [`packages/i18n/src/locales/en/settings.yaml`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/i18n/src/locales/en/settings.yaml)
  - Localization keys for `pocket-tts-local` provider title & description.

---

## 3. Fast-Path Optimization: Pre-Computed Voice Embedding Caching

To guarantee sub-second latency across all voice clone generations:

1. **First Run**: When a new custom `.wav` voice profile is imported, `mimi_encoder_int8` runs **once**, producing a speaker-projected voice embedding `[1, V, 1024]`.
2. **IndexedDB Persist**: The extracted `promptVoiceEmbedding` (Float32Array + dims) is cached permanently in `localforage` (`pocket-voice-profiles-metadata`).
3. **Subsequent Turns**: All future speech generations for that voice profile bypass `mimi_encoder` entirely, passing the pre-computed `promptVoiceEmbedding` straight into the `flow_lm_main` voice prefill (with `bos_before_voice` prepended when the bundle requires it).

*Note: Pocket TTS has no discrete "prompt audio codes" (that is MOSS-TTS-Nano's codec artifact) — the cacheable conditioning artifact here is the continuous voice embedding.*

---

## 4. Key Lessons & Known Constraints

* **CPU Core Allocation**: Pocket TTS requires only 2 CPU cores running multithreaded WASM SIMD, preventing VRAM evictions alongside AIRI's Live2D/3D canvases.
* **Audio Context Scope**: Audio decoding & peak normalization are performed on the main thread via Web Audio (`OfflineAudioContext`) because `AudioContext` is not available in Web Worker scopes.

---

## 5. Phase 6 & Phase 7: Predefined Voice Presets & Multi-Language Catalog Gating

### Phase 6: Predefined Built-In Presets (Gated `kyutai/pocket-tts`)
- **State Dict Priming**: Predefined voices (`alba`, `cosette`, `eponine`, `fantine`, `javert`, `jean`, `marius`) are serialized Flow-LM KV state dicts (`.safetensors`), downloaded from the gated `kyutai/pocket-tts` repository on Hugging Face at `languages/{langFolder}/embeddings/{voice}.safetensors`.
- **Flow-LM Direct KV Initialization**: Predefined voices bypass `mimi_encoder` and custom audio prefill entirely, feeding parsed `.safetensors` KV state directly into `synthesizePocketSpeech()`.
- **HuggingFace Access Token Forwarding**: The worker receives `hfToken` from `localStorage.getItem('settings/connection/hf-token')` and sends `Authorization: Bearer <hfToken>` to HuggingFace. UI features a guidance card linking to **Connection Settings** (`/settings/system/connection`).

### Phase 7: Multi-Language Voice Preset Catalog & Dynamic UI Filtering
- **Per-Language Voice Dictionaries**: `registry/speech.ts` organizes built-in voice presets by language model variant:
  - **English (`english_2026-04`)**: `alba`, `azelma`, `bill_boerst`, `caro_davy`, `peter_yearsley`, `stuart_bell`, `anna`, `charles`, `eponine`, `eve`, `fantine`, `george`, `mary`, `michael`, `paul`, `vera`, `jean`
  - **French (`french_24l`)**: `estelle`, `cosette`, `fantine`, `marius`, `jean`, `javert`
  - **Spanish (`spanish_24l`)**: `lola`
  - **German (`german_24l`)**: `juergen`
  - **Italian (`italian_24l`)**: `giovanni`
  - **Portuguese (`portuguese_24l`)**: `rafael`
- **Dynamic Voice List Filtering**: `listVoices({ language })` returns `[...languagePredefinedVoices, ...customUploadedProfiles]`, ensuring that selecting a language model in `pocket-tts-local.vue` immediately updates the available voice options while keeping user-cloned voice profiles available across all languages.

