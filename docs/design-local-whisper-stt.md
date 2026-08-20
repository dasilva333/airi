# Design Document: Local Whisper Speech-to-Text (STT) Engine

## 1. Executive Summary

AIRI incorporates a privacy-first, fully in-browser **Speech-to-Text (ASR/STT)** engine powered by OpenAI's Whisper models via Hugging Face Transformers.js and ONNX Runtime Web.

The engine operates under the **Unified WebGPU & Eventa Streaming Architecture**, integrating directly into AIRI's centralized GPU inference queue, VRAM budgeting layer, and single-tenant browser cache management.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              AIRI UI                                   │
│  [Onboarding V2 Step 1]  [Settings > Whisper Local]  [Hearing Module] │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ OpenAI-compatible Provider API
┌────────────────────────────────────▼───────────────────────────────────┐
│              Whisper Local Provider (whisper-local)                   │
│   • AudioContext Downsampling & Channel Averaging (16 kHz Mono)        │
│   • Model Dispatch & Hugging Face Repo Resolution                      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Singleton Acquisition
┌────────────────────────────────────▼───────────────────────────────────┐
│                   Whisper Adapter (adapters/whisper.ts)                │
│   • Eventa RPC Client (defineStreamInvoke)                             │
│   • GPU Worker Host (createGpuWorkerHost)                              │
│   • Hardware Promotion & Device Loss Recovery (WebGPU → WASM fallback)│
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│      GPU Executor & Coordinator      │ │    Cache Storage Manager      │
│ • Priority: STT_LOAD / STT_TRANSCRIBE│ │ • 'transformers-cache'        │
│ • VRAM Budget: 800 MB (Large Turbo)  │ │ • Single-Active-Shard Eviction│
└───────────────────┬──────────────────┘ └───────────────────────────────┘
                    │ Eventa IPC (PostMessage Streams)
┌───────────────────▼────────────────────────────────────────────────────┐
│              Whisper Web Worker (libs/workers/worker.ts)               │
│   • Eventa Server-Streaming Handlers (load, transcribe, unload)        │
│   • @huggingface/transformers ONNX Pipeline (WebGPU / WASM Execution)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Matrix & Hardware Profiles

AIRI exposes 4 Whisper model tiers in [`packages/stage-ui/src/libs/inference/constants.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/constants.ts):

| Shard ID | Model Tier | Download Size | VRAM Footprint | Multilingual | Primary Target |
|---|---|---|---|---|---|
| `onnx-community/whisper-tiny` | Tiny (Multilingual) | ~75 MB | ~250 MB | **Yes (99+ languages)** | Low-end mobile / CPU fallback |
| `onnx-community/whisper-base` | Base (Multilingual) | ~145 MB | ~500 MB | **Yes (99+ languages)** | Balanced low-resource devices |
| `onnx-community/whisper-small` | Small (Multilingual) | ~460 MB | ~1 GB | **Yes (99+ languages)** | Mid-range laptops |
| `onnx-community/whisper-large-v3-turbo` | Large V3 Turbo (**Default**) | ~800 MB | ~3 GB | **Yes (99+ languages)** | Desktop WebGPU / High accuracy |

* **Default Model**: `onnx-community/whisper-large-v3-turbo` (`DEFAULT_WHISPER_MODEL`).
* **Mel-Filterbank Configuration**:
  * `large-v3-turbo`: 128 mel bins.
  * `tiny` / `base` / `small`: 80 mel bins.

---

## 3. Core Architecture & Component Map

### 3.1. Web Worker Implementation: [`worker.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/workers/worker.ts)
* **Protocol**: Built on `@moeru/eventa` using webworker adapter contexts (`createContext()`).
* **Server-Streaming Contract**:
  * `whisperLoadEvent`: Streams model weight download progress chunks (`{ percent, loaded, total, file }`), runs a 3000-frame dummy warm-up tensor, and emits the final `ready` state.
  * `whisperTranscribeEvent`: Consumes a 16 kHz `Float32Array` mono audio buffer, runs encoder/decoder inference via `WhisperForConditionalGeneration`, and streams decoded token sequences.
  * `whisperUnloadEvent`: Releases ONNX sessions and destroys GPU pipeline allocations.
* **Resilience**: WebGPU feature detection with automatic fallback to WASM (CPU) when WebGPU device is unavailable.

### 3.2. GPU Worker Host & Adapter: [`adapters/whisper.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/adapters/whisper.ts)
* **Lifecycle Management**: Wrapped in `createGpuWorkerHost`, guaranteeing single-tenant worker lifecycle and serialized load/transcribe mutexes.
* **Unified GPU Queuing**:
  * Registers with `getGpuExecutor()`.
  * Scheduled under `GPU_PRIORITY.STT_LOAD` (Priority 2) and `GPU_PRIORITY.STT_TRANSCRIBE` (Priority 4).
  * Allocates estimated VRAM against `getGPUCoordinator()` (`MODEL_VRAM_ESTIMATES[MODEL_NAMES.WHISPER] = 800 MB`).
* **Device Loss Promotion**: Tracks WebGPU crashes via `deviceLossCount`; proactively demotes to WASM if WebGPU contexts fail repeatedly.

### 3.3. Cache Storage & Single-Tenant Eviction: [`cache-utils.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/cache-utils.ts)
* **Scope**: Browser `CacheStorage` API under `'transformers-cache'`.
* **Single-Active-Shard Invariant**: When a model load completes in `whisper.ts`, `evictOtherWhisperModels(loadedModel)` is triggered. It scans all entries in `'transformers-cache'` and purges any Whisper files belonging to other model shards.
* **Benefit**: Prevents multiple model shards (e.g. Tiny + Large) from accumulating gigabytes of dead storage in user browsers.

### 3.4. Provider Bridge: [`stores/providers/whisper-local/index.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/whisper-local/index.ts)
* Implements the OpenAI-compatible `TranscriptionProvider` interface from `@xsai-ext/providers/utils`.
* **Audio Resampling**: Intercepts multipart `FormData` uploads, instantiates an in-memory `AudioContext({ sampleRate: 16000 })` to downsample, averages stereo channels to mono `Float32Array`, and routes directly into the singleton Whisper adapter.
* **Aborts**: Forwards `RequestInit.signal` to abort both ongoing shard downloads and active worker inference.

---

## 4. UI Surfaces & Integration Points

| UI Surface | Path | Role & Behavior |
|---|---|---|
| **Onboarding V2 Step 1** | `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/steps/step-1-hearing.vue` | Primary setup step. Features live shard download progress, dynamic byte metadata, adapter cache probe on mount (retains ready state across Back/Forward navigation), and live speaking microphone test. |
| **Onboarding Helper** | `packages/stage-ui/src/components/scenarios/dialogs/onboarding/v2/whisper-loader.ts` | Decoupled model loader for Step 1 / Step 7 verification. |
| **Provider Settings** | `packages/stage-pages/src/pages/settings/providers/transcription/whisper-local.vue` | Dedicated settings page. Shard dropdown, language hint selection, memory residency / cache detection, activation toggle, and `TranscriptionPlayground`. |
| **Model Cache Hub** | `packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue` | Unified `Whisper ASR` row. Displays real-time cache status across all sizes and provides one-click cache eviction. |
| **Hearing Module Store** | `packages/stage-ui/src/stores/modules/hearing.ts` | Default configuration map (`'whisper-local': { deviceId: 'default', sampleRate: 16000 }`), model binding, and transcription runner. |
| **Provider Registry** | `packages/stage-ui/src/stores/providers/registry/transcription.ts` | Formal registry entry under canonical ID `whisper-local`. |
| **Command Palette Search** | `packages/stage-pages/src/pages/settings/components/SettingsSearchBar.vue` | Settings command palette entry routing to `/settings/providers/transcription/whisper-local`. |

---

## 5. Testing & Verification

1. **Typecheck Suites**:
   * `pnpm -F @proj-airi/stage-ui typecheck`
   * `pnpm -F @proj-airi/stage-pages typecheck`
   * `pnpm -F @proj-airi/stage-tamagotchi typecheck`
2. **Runtime Verification**:
   * Inspect browser console for Eventa streaming updates: `[V2 Hearing]` and `[Whisper Adapter]`.
   * Check WebGPU status in DevTools via `navigator.gpu`.
   * Inspect Cache Storage in DevTools: `Application > Storage > Cache storage > transformers-cache`.

## Relevant Skills

- [[airi-local-inference-engines]]
