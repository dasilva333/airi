# Systems Design Document: AIRI Audio Server Architecture & Chatterbox Lineage

## 1. Executive Summary

This document serves as the canonical architectural hub for **AIRI Audio Server** ([`dasilva333/airi-audio-server`](https://github.com/dasilva333/airi-audio-server)), recording its historical lineage from the original Chatterbox TTS integration, the transition to high-performance C++ inference via `audio.cpp`, the deprecation of legacy server-side presets/profiles in favor of AIRI's unified **Audio Studio** (`virtual-audio-studio`), and the exact code paths across the AIRI application.

---

## 2. History & Technical Lineage

### Phase 1: The Chatterbox Python Sidecar (`chatterbox-tts-airi`)
- **Origin**: AIRI originally integrated with a dedicated local Python server based on `devnen/Chatterbox-TTS-Server` specifically designed for the Chatterbox speech model.
- **The `/capabilities` Protocol**: To allow character cards to understand what emotional cues and expressive tokens the TTS model supported, a custom `/capabilities` (or `/chatterbox/capabilities`) endpoint was engineered. It exposed `expressionTags` (e.g. `[whisper]`, `[sigh]`, `[gasp]`, `<|emotion:happy|>`). AIRI's Card Editor and prompt builders ingested these tags to teach LLM personas to emit inline acting markers during character turns.
- **Server-Side Presets & Profiles**: At the time, the Python server persisted virtual voice combinations (`presets.json`) and text rewriting/emoticon replacement rules (`profiles.json`). AIRI built an extensive 1,130-line management studio in `packages/stage-pages/src/pages/settings/providers/speech/chatterbox.vue` to perform CRUD on these endpoints.

### Phase 2: Model Expansion & Name Misnomer
- **OmniVoice & Higgs**: As zero-shot cloning models emerged, OmniVoice and later Higgs Audio v3 were added to the server sidecar. Because the server core was built for audio synthesis, adding additional models was straightforward.
- **The Misnomer**: As noted in [`docs/proposal-higgs-audio-v3-tts-integration.md`](./proposal-higgs-audio-v3-tts-integration.md#L219), calling a multi-model speech server `chatterbox` had become an obvious misnomer as the upstream Chatterbox project matured and went dormant.

### Phase 3: The C++ Breakthrough & `audio.cpp`
- **Zero-Python C++ Engine**: When `audio.cpp` (by `@0xShug0`) arrived, running quantized GGUF neural audio models natively in C++ with CUDA/Metal acceleration eliminated Python runtime overhead, PyTorch dependency bloat, and CUDA VRAM fragmentation.
- **Birth of `airi-audio-server`**: The author created [`dasilva333/airi-audio-server`](https://github.com/dasilva333/airi-audio-server), a lightweight, zero-Python Node.js microservice serving `audio.cpp` C++ binaries (`audiocpp_server.exe` / `audiocpp_cli.exe`) with:
  1. Standard **OpenAI API compatibility** (`POST /v1/audio/speech`, `GET /v1/models`).
  2. **Real-time Server-Sent Events (SSE) Incremental Audio Streaming** (`stream_format: "sse"`), dropping Time-To-First-Token (TTFT) to ~230ms.
  3. **Native Parakeet TDT ASR** (`POST /v1/audio/transcriptions`) on CUDA GPU for Speech-to-Text reference transcription.
  4. **Dynamic Voice Discovery** (`GET /v1/voices`), indexing zero-shot cloned voice WAVs dropped into `voices/`.
  5. **1-to-1 Capabilities Compatibility** (`GET /v1/capabilities`), providing paralinguistic expression tags directly to AIRI.
  6. **1-Click Verified Model Auto-Downloader** (`setup.js` / `install.bat`) for HuggingFace GGUFs.

### Phase 4: Modernization & Dead-Weight Removal in AIRI
- **Audio Studio Generalization**: AIRI developed [`docs/feat-audio-studio.md`](./feat-audio-studio.md) (`virtual-audio-studio`), centralizing Voice Profiles, Universal Speech Transformers (UST), pitch, speed, EQ, and emoticon/regex replacements into an engine-agnostic virtual provider layer.
- **Deprecating Legacy CRUD**: The legacy `/chatterbox/presets` and `/chatterbox/profiles` server endpoints are no longer implemented in modern C++ engines. The 1,130-line `chatterbox.vue` monolith was gutted and replaced by a streamlined `airi-audio-server.vue` provider with repo installation guidance and rich dynamic voice/model/tag discovery.

---

## 3. Server Architecture & API Contracts

### Network Default
- **Default Base URL**: `http://127.0.0.1:8095/v1/`
- **Health Check Probe**: `GET http://127.0.0.1:8095/health`

### Supported Models
| # | Model Name | VRAM | Key Features |
|---|---|---|---|
| 1 | **OmniVoice Q8_0** *(Default)* | ~1.12 GB | Zero-Shot Voice Cloning, Paralinguistic Expression Tags, 0.28 RTF |
| 2 | **Higgs Audio v3 TTS Q8_0** | ~4.80 GB | 46 Native Paralinguistic Tags (`<emotion:...>`) |
| 3 | **Fish Audio S2 Pro Q8_0** | ~6.31 GB | Dual-AR Fast Streaming Synthesis, Zero-Shot Voice Cloning |
| 4 | **Chatterbox TTS Q8_0** | ~2.10 GB | High-Fidelity Expressive Speech Synthesis |
| 5 | **MOSS TTS Local v1.5 Q8_0** | ~7.50 GB | Large Scale Multilingual Neural Speech Model |

### API Endpoints
1. `GET /health`:
   - Returns 200 OK server health status.
2. `GET /v1/models`:
   - Returns OpenAI-compatible `{ object: "list", data: [{ id: "omnivoice-tts", ... }, ...] }`.
3. `GET /v1/voices`:
   - Returns `{ voices: [{ voice_id: "...", name: "...", type: "native" | "cloned", preview_url: "..." }, ...] }`.
4. `GET /v1/capabilities`:
   - Returns speech capabilities manifest:
     ```json
     {
       "speech": {
         "supportsPresets": false,
         "supportsExpressionTags": true,
         "supportsMannerisms": false,
         "expressionTags": [
           { "tag": "[whisper]", "category": "style", "description": "Soft whisper" },
           { "tag": "[sigh]", "category": "emotion", "description": "Sighing expression" }
         ]
       }
     }
     ```
5. `POST /v1/audio/speech`:
   - Standard OpenAI speech payload `{ model, input, voice, speed }`.
   - Streaming mode: `{ stream_format: "sse" }` emitting base64-encoded, self-contained WAV chunks (`pcmToWav`).
6. `POST /v1/audio/transcriptions`:
   - Multimodal transcription using Parakeet TDT ASR.

---

## 4. Code Map & Key Citations

| Surface | File Path | Purpose |
|---|---|---|
| **Provider Registry** | [`packages/stage-ui/src/stores/providers/registry/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/speech.ts) | Defines `airi-audio-server` provider metadata, `defaultBaseUrl: 'http://127.0.0.1:8095/v1/'`, dynamic `listVoices` (`/v1/voices`), `listModels` (`/v1/models`), and `getSpeechCapabilities` (`/v1/capabilities`). Includes backwards-compatible `chatterbox` alias. |
| **Settings UI** | [`packages/stage-pages/src/pages/settings/providers/speech/airi-audio-server.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/speech/airi-audio-server.vue) | Modern configuration page: repo install guide (`install.bat`, `setup.js`), live server connectivity probe, dynamic model & voice selectors, expression tags inspector, and test playground. |
| **Legacy Route** | [`packages/stage-pages/src/pages/settings/providers/speech/chatterbox.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/speech/chatterbox.vue) | Seamless redirect component forwarding `/settings/providers/speech/chatterbox` to `/settings/providers/speech/airi-audio-server`. |
| **Speech Pipeline** | [`packages/stage-ui/src/stores/modules/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/speech.ts) | `transformTextForSpeech` exempts `airi-audio-server` (and `chatterbox`) from aggressive bracket stripping so control tags pass unhindered to the server. |
| **Streaming Engine** | [`packages/stage-ui/src/components/scenes/ControlStripHost.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue) | `resolveStreamingSpeechEndpoint` identifies `airi-audio-server` for low-latency incremental SSE streaming playback. |
| **Onboarding V2** | [`packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-6-speech.vue) | Displays `airi-audio-server` in the speech provider selection step with direct link to GitHub. |
| **i18n Locales** | [`packages/i18n/src/locales/en/settings.yaml`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/i18n/src/locales/en/settings.yaml) | Translations under `settings.pages.providers.provider.airi-audio-server`. Managed with `scripts/yaml-manager.js`. |

---

## 5. Related Specifications

- [`docs/feat-audio-studio.md`](./feat-audio-studio.md) — Specification for VoiceProfiles and Universal Speech Transformers (UST).
- [`docs/proposal-higgs-audio-v3-tts-integration.md`](./proposal-higgs-audio-v3-tts-integration.md) — Higgs Audio v3 integration and early rebrand proposal.
- [`docs/design-acting-tab-and-chatterbox.md`](./design-acting-tab-and-chatterbox.md) — Original systems design document for acting tab and paralinguistic tag mapping.
- [`docs/design-openai-compatible-tts.md`](./design-openai-compatible-tts.md) — Generic OpenAI-compatible speech endpoint contracts.
