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
  - Provides model variants (`english_2026-04`, `french_24l`, `spanish_24l`, `german_24l`, `portuguese_24l`, `italian_24l`) and predefined voices (see §5.1 catalog — English bundle defaults plus language-appropriate subsets via `POCKET_PREDEFINED_VOICES_BY_LANG`).

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

### 5.1 Authoritative Predefined Voice Catalog (26 Voices, Verified 2026-08-09)

All voice files are hosted on the **gated** `kyutai/pocket-tts` Hugging Face repo at:

```
https://huggingface.co/kyutai/pocket-tts/resolve/main/languages/{langFolder}/embeddings/{voice}.safetensors
```

Download path in `pocket_model_store.ts`: `ensurePredefinedVoiceEmbedding(langFolder, voice, hfToken)` → OPFS cache at `{langFolder}/voices/{voice}.safetensors`. **Requires the user's HF token with the kyutai gate accepted** (HTTP 401 `GatedRepo` otherwise).

**Discovery metadata** (source of truth): HF Repo Tree API `GET /api/models/kyutai/pocket-tts/tree/main/languages/{langFolder}/embeddings`.

| Voice ID | Display Name | Style / Gender | File Size | Language Availability | Notes |
|---|---|---|---|---|---|
| `alba` | Alba | casual / reading | 5.91 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `anna` | Anna | conversation | 7.45 MB | all 6 languages | |
| `azelma` | Azelma | reading | 7.59 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `bill_boerst` | Bill Boerst | reading (audiobook narrator) | 6.42 MB | all 6 languages | LibriVox narrator |
| `caro_davy` | Caro Davy | reading | 5.02 MB | all 6 languages | |
| `charles` | Charles | conversation | 5.91 MB | all 6 languages | |
| `cosette` | Cosette | reading | 5.91 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `eponine` | Eponine | reading | 6.61 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `estelle` | Estelle | reading | 7.88 MB | all 6 languages | Cross-listed; featured in FR bundles |
| `eve` | Eve | conversation | 6.24 MB | all 6 languages | |
| `fantine` | Fantine | reading | 6.24 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `george` | George | conversation | 5.95 MB | all 6 languages | |
| `giovanni` | Giovanni | reading | 4.41 MB | all 6 languages | Cross-listed; featured in IT bundles |
| `jane` | Jane | conversation | 7.03 MB | all 6 languages | |
| `javert` | Javert | reading | 5.91 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `jean` | Jean | conversation | 5.91 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `juergen` | Juergen | reading | 5.95 MB | all 6 languages | Cross-listed; featured in DE bundles |
| `lola` | Lola | reading | 5.67 MB | all 6 languages | Cross-listed; featured in ES bundles |
| `marius` | Marius | reading | 5.91 MB | all 6 languages | In english bundle.json `predefined_voices` |
| `mary` | Mary | conversation | 5.91 MB | all 6 languages | |
| `michael` | Michael | conversation | 6.94 MB | all 6 languages | |
| `paul` | Paul | conversation | 5.91 MB | all 6 languages | |
| `peter_yearsley` | Peter Yearsley | reading (audiobook narrator) | 3.56 MB | all 6 languages | LibriVox narrator |
| `rafael` | Rafael | reading | 5.91 MB | all 6 languages | Cross-listed; featured in PT-BR bundles |
| `stuart_bell` | Stuart Bell | reading (audiobook narrator) | 5.02 MB | all 6 languages | LibriVox narrator |
| `vera` | Vera | conversation | 6.42 MB | all 6 languages | |

**Empirical catalog facts:**
- All 26 `.safetensors` exist under **every** language folder (`english_2026-04`, `french_24l`, `spanish_24l`, `german_24l`, `portuguese_24l`, `italian_24l`). The tree API returns identical 26-file listings for each.
- The `bundle.json` `predefined_voices` field for English currently lists 8 voices (`alba, azelma, cosette, eponine, fantine, javert, jean, marius`); the remaining 18 are also downloadable and functional — same gated repo path.
- The name metadata above is derived from the voice IDs themselves + bundle context; Kyutai does not ship a separate human-readable metadata JSON for the voices.
- Voice file sizes range **3.56 MB** (`peter_yearsley`) to **7.88 MB** (`estelle`); they contain serialized Flow-LM KV state dicts (not audio), so size variance reflects differing KV cache priming lengths, not audio duration.

### 5.2 Phase 6: Predefined Built-In Presets (Implementation)
- **State Dict Priming**: Predefined voices are serialized Flow-LM KV state dicts (`.safetensors`), downloaded from the gated `kyutai/pocket-tts` repository at the URL pattern above.
- **Flow-LM Direct KV Initialization**: Predefined voices bypass `mimi_encoder` and custom audio prefill entirely. `synthesizePocketSpeech()` receives `voice` as a **string preset name**, calls `getPocketPredefinedVoiceState()` which triggers `ensurePredefinedVoiceEmbedding()` then `buildPredefinedVoiceFlowState()` to seed Flow-LM KV tensors from the parsed safetensors (`flow_lm_state_manifest` + `predefined_voices`).
- **HuggingFace Access Token Forwarding**: The worker receives `hfToken` from `localStorage.getItem('settings/connection/hf-token')`, stores it in `activeHfToken` at load time, and forwards it as `Authorization: Bearer <hfToken>` on all gated HF fetches (both model weights and voice safetensors). UI features a guidance card linking to **Connection Settings** (`/settings/system/connection`).

### 5.3 Phase 7: Multi-Language Voice Preset Catalog & Dynamic UI Filtering
- **Canonical Catalog Map**: `POCKET_PREDEFINED_VOICES_BY_LANG` in `registry/speech.ts` organizes the built-in voice presets by AIRI language model variant. While *all* 26 voices technically resolve under every language folder on the gated repo, the UI surfaces language-appropriate subsets for a clean UX:
  - **English (`english_2026-04`)**: `alba`, `azelma`, `bill_boerst`, `caro_davy`, `peter_yearsley`, `stuart_bell`, `anna`, `charles`, `cosette`, `eponine`, `estelle`, `eve`, `fantine`, `george`, `jane`, `javert`, `jean`, `marius`, `mary`, `michael`, `paul`, `vera` (22 voices — full English catalog excluding cross-listed FR/ES/DE/IT/PT primaries)
  - **French (`french_24l`)**: `estelle`, `cosette`, `fantine`, `marius`, `jean`, `javert`, `eponine`, `azelma` (FR-featured + the English bundle 8 overlap)
  - **Spanish (`spanish_24l`)**: `lola`, `cosette`, `fantine`, `marius`, `jean`, `javert`
  - **German (`german_24l`)**: `juergen`, `cosette`, `fantine`, `marius`, `jean`, `javert`
  - **Italian (`italian_24l`)**: `giovanni`, `cosette`, `fantine`, `marius`, `jean`, `javert`
  - **Portuguese (`portuguese_24l`)**: `rafael`, `cosette`, `fantine`, `marius`, `jean`, `javert`
- **Dynamic Voice List Filtering**: `listVoices({ language })` returns `[...languagePredefinedVoices, ...customUploadedProfiles]`, ensuring that selecting a language model in `pocket-tts-local.vue` immediately updates the available voice options while keeping user-cloned voice profiles available across all languages.
- **Language-to-Folder Normalization**: The worker-level `normalizePocketLanguage()` (`worker.ts`) maps both bare codes (`english`) and bundle IDs (`english_2026-04`) to canonical OPFS folder names, ensuring `getOrLoadPocketSessions()` and `ensurePredefinedVoiceEmbedding()` always use the correct path regardless of which identifier the provider config surfaces.

