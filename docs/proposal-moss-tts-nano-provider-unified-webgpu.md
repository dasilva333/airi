# Proposal: MOSS‑TTS‑Nano (ONNX) as a first‑class local TTS provider

## Goal

Add **MOSS‑TTS‑Nano (0.1B)** as a **first‑class speech provider** alongside **Kokoro** in AIRI, with:

- **Local, sidecar‑free runtime** (no Python service).
- **WebGPU when available**, with robust **WASM/CPU fallback**.
- **Voice cloning** (reference audio conditioning) as a core capability.
- Integration into AIRI’s existing **unified inference protocol** and its cross‑model **load coordination + memory pressure telemetry** (“unified WebGPU” system).

This document is a consolidated dump of links + architectural notes + open questions to validate before implementation.

## Relevant upstream links (MOSS / Nano / ONNX)

- **MOSS‑TTS Family README (context + deployment options)**:
  - `https://raw.githubusercontent.com/OpenMOSS/MOSS-TTS/refs/heads/main/README.md`
  - (Repo) `https://github.com/OpenMOSS/MOSS-TTS#mosstts`

- **MOSS‑TTS‑Nano (PyTorch model card / original release)**:
  - `https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano`

- **MOSS‑TTS‑Nano‑100M‑ONNX (browser‑oriented export; key enabler for “no Python sidecar”)**:
  - `https://huggingface.co/OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX`
  - Highlights (per model card text):
    - Designed for **onnxruntime** and **onnxruntime‑web**
    - Split graphs for **prefill** + **decode-step** + **local decoder** (streaming‑friendly)
    - External weights via shared `.data` files
    - Includes `tts_browser_onnx_meta.json` and `browser_poc_manifest.json`

- **Companion codec: MOSS‑Audio‑Tokenizer‑Nano‑ONNX (required for waveform encode/decode)**:
  - `https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX`

## AIRI implementation references (current “unified WebGPU” stack)

### Unified inference protocol (worker message contract)

- `packages/stage-ui/src/libs/inference/protocol.ts`
  - Standard message types: `load-model`, `run-inference`, `cancel`, `unload-model`
  - Standard responses: `progress`, `model-ready`, `inference-result`, `error`
  - Notes on WebGPU reality: each worker owns its own `GPUDevice` (cannot share across workers).

### Cross‑model coordination (“unified WebGPU thing” in AIRI today)

This is currently **coordination**, not a shared GPU device:

- **Serialized model loads** to avoid bandwidth/VRAM spikes:
  - `packages/stage-ui/src/libs/inference/coordinator.ts`
  - `getLoadQueue()` is used by adapters (Kokoro/Whisper).

- **Cross‑model VRAM bookkeeping + pressure telemetry**:
  - `packages/stage-ui/src/libs/inference/gpu-resource-coordinator.ts`
  - Tracks estimated allocations per model, emits `warning`/`critical`.

- **Device‑loss telemetry + fallback**:
  - `packages/stage-ui/src/libs/inference/protocol.ts` (`classifyError`, `DEVICE_LOSS` patterns)
  - Adapters record device-loss and can **promote subsequent loads to WASM**.

### Kokoro: current reference implementation for local TTS

- Worker:
  - `packages/stage-ui/src/workers/kokoro/worker.ts`
  - Uses `kokoro-js` with dtype/device fallback chains.
  - Implements cancellation as “drop stale results when they arrive”.

- Adapter:
  - `packages/stage-ui/src/libs/inference/adapters/kokoro.ts`
  - Uses:
    - global **LoadQueue**
    - global **GPUResourceCoordinator**
    - **device-loss promotion** to `wasm` after repeated WebGPU loss
  - Encodes PCM → WAV on the main thread (`encodeWav`) after receiving `Float32Array` samples.

### WebGPU detection and VRAM heuristic (used for budgeting)

- `packages/stage-shared/src/webgpu/detect.ts`
  - Uses `gpuu` to detect WebGPU + fp16 support.
  - Estimates VRAM with `adapter.limits.maxBufferSize * 4`, plus an override mechanism.

### Provider registry / speech provider wiring

- `packages/stage-ui/src/stores/providers.ts`
  - Central provider catalog, including speech providers.
  - Kokoro is wired as a local speech option here (via `getKokoroWorker` and Kokoro model metadata).
  - This is where a **new first‑class provider** should be registered (exposed in settings, validated, etc.).

## How Kokoro is exposed as a Speech Provider (concrete wiring)

This is the closest “golden path” reference for adding `moss-nano-local`.

### Provider ID + defaults

In `packages/stage-ui/src/stores/providers.ts`, `kokoro-local` is registered as:

- `id`: `kokoro-local`
- `category`: `speech`
- `tasks`: `['text-to-speech']`
- `defaultOptions()` chooses a default model based on WebGPU availability:
  - `hasWebGPU = !!navigator.gpu`
  - `model = getDefaultKokoroModel(hasWebGPU)`
  - plus `voiceId`

### Provider instance shape: OpenAI-compatible `speech.fetch`

`createProvider()` returns a `SpeechProvider` whose `speech()` returns:

- `baseURL`: `http://kokoro-local/v1/` (sentinel)
- `model`: `kokoro-82m`
- `fetch(input, init)` override which:
  - parses JSON body and expects:
    - `body.input` (text)
    - `body.voice` (voice id/key)
  - ensures a model is loaded based on `config.model` (selected in settings)
  - calls the worker manager:
    - `await workerManager.loadModel(modelDef.quantization, modelDef.platform)`
    - `await workerManager.generate(text, voice)`
  - returns `Response(audioBuffer, { 'Content-Type': 'audio/wav' })`

This means Kokoro is treated as a **local OpenAI-style speech endpoint**, implemented in-process by a custom fetch handler.

### Capabilities exposed for UI + orchestration

`kokoro-local.capabilities` includes:

- `listModels(config)`:
  - returns `kokoroModelsToModelInfo(hasWebGPU, t)`
- `loadModel(config, hooks)`:
  - validates `config.model` is in `KOKORO_MODELS`
  - checks WebGPU requirement if model platform is `webgpu`
  - calls `getKokoroWorker().loadModel(..., { onProgress: hooks?.onProgress })`
- `listVoices(config)`:
  - reloads the model for the chosen `config.model`
  - calls `getKokoroWorker().getVoices()`
  - maps voice metadata into AIRI `VoiceInfo[]`

### Settings UX flow (kokoro-local page)

`packages/stage-pages/src/pages/settings/providers/speech/kokoro-local.vue`:

- Calls `providersStore.fetchModelsForProvider(providerId)` on mount.
- Uses `metadata.capabilities.loadModel(config)` to load the selected model.
- Uses `speechStore.loadVoicesForProvider(providerId)` to populate voice dropdown.
- Watches `model` changes and repeats load + voice refresh.

## Minimum interface for `moss-nano-local` (aligned to Kokoro’s provider contract)

To be “first-class alongside Kokoro” without inventing a parallel provider architecture, implement the same outward shape:

### Provider metadata (in `stores/providers.ts`)

- `id`: `moss-nano-local`
- `category`: `speech`
- `tasks`: `['text-to-speech', 'tts']` (optional to match other providers)
- `deployment`: `local`
- `defaultOptions()` should include at least:
  - `model`: (device-aware default, similar to Kokoro)
  - `voiceId`: optional, but likely replaced by a **voice profile ID**
  - `device`: `'webgpu' | 'wasm' | 'cpu'` (if exposed to UI)

### Provider instance (`SpeechProvider.speech().fetch`)

Implement `fetch()` to support OpenAI-compatible TTS requests:

- Parse request JSON:
  - **required**: `input` (text)
  - **required**: `voice` (we can interpret this as either a built-in “preset voice” or a saved “voice profile” key)
  - **optional**: a “reference audio” field for cloning (this is a design decision; see open questions below)
- Ensure ONNX sessions are loaded for the selected model/device.
- Run generation in a worker and return:
  - `Content-Type: audio/wav` (or `audio/mpeg` if we add an encoder later)

### Capabilities

At minimum, mirror Kokoro’s:

- `listModels(config) => ModelInfo[]`
- `loadModel(config, { onProgress? })`
- `listVoices(config) => VoiceInfo[]`

For voice cloning, `listVoices` probably becomes “list **voice profiles**” (saved references), even if we expose them as `VoiceInfo[]` for compatibility with existing UI.

## Open questions (new, specific to Nano ONNX)

### 1) Where do reference audios live (voice cloning inputs)?

For true zero-shot voice cloning, we need a durable “voice library” of user-provided reference audio.

**Target UX (authoritative):**

- user uploads an audio file
- user gives it a name
- audio is saved locally (IndexedDB) as a Blob + metadata
- user selects provider `moss-nano-local`, selects the ONNX engine/device, and selects a “voice” entry that resolves to the stored audio blob

**Implication:** Nano “voices” should be treated as **user-managed reference assets**, not as base64 payloads passed around at request time, and not as “OpenAI-style” remote request extensions.

### 2) Where does “voice profile” live?

Do **not** mix this effort with Audio Studio.

We need a **separate** data model for Nano cloning voices that is explicitly “reference audio blob + metadata”, likely something like:

- `id`
- `name`
- `createdAt/updatedAt`
- `blob` (or a pointer/key to the blob)
- optional: `langHint`, `notes`, `durationMs`, `sampleRate`, `channels`, `sourceFilename`, `sha256`

Storage should be **IndexedDB** so the worker/provider can resolve by ID without any base64 handoffs.

### 3) Do we need streaming output?

Not for the initial integration.

Even if Nano supports decode-step, AIRI already chunks speech at a higher level (partial sentences / slices), so we can return a full WAV per slice without introducing “partial sentence streaming” complexity.

---

### 4) Audio preprocessing & format pipeline (voice cloning reference audio)

This is the least-defined piece of the integration and needs careful scoping.

**Known unknowns:**

- **Target format**: What sample rate, bit depth, and channel count does the MOSS-Audio-Tokenizer-Nano-ONNX expect? Needs validation against the tokenizer graph.
- **Upload format diversity**: Users will upload mp3, m4a, ogg, webm, wav, etc. Browsers can decode these via `AudioContext.decodeAudioData()`, but:
  - Does this run on the main thread or in a worker?
  - Do we need a resampling step if the decoded rate doesn't match the tokenizer's expected rate?
  - What's the bundle cost of pulling in a resampler (e.g. `libresample`-like WASM) vs. using Web Audio API's built-in resampling?
- **Duration sweet spot**: Voice cloning reference audio typically works best within a certain range (some models saturate around 15 s, others benefit up to 60 s). Unknown until tested with the actual ONNX model. Follow up with Shinobu for his implementation experience.
- **Preprocessing**:
  - Gain normalization (peak or RMS)?
  - Silence trimming (leading/trailing)?
  - Duration clamping or padding?
- **Where conversion lives**: Main thread (Web Audio API → worker postMessage), worker (ORT pre-processing graph), or some hybrid? The tokenizer may accept raw PCM at a fixed rate — if so, decode + resample must happen before the tokenizer receives the buffer.

**Recommendation:** Get Shinobu's notes on what works in practice, then codify the expected input shape and preprocessing steps here before implementation.

### 5) Voice profile store — BYOS compatibility

Voice cloning reference audio blobs are **heavy, user-managed assets** — conceptually similar to how Display Models and Background Images are handled in the existing BYOS (Bring Your Own Storage) system (see [`project-byos-cloud-sync.md`](./project-byos-cloud-sync.md)).

**Design constraints adapted from BYOS asset patterns:**

- **Metadata Store:** A new IndexedDB key namespace (`local:voice-profiles/*`) holding per-profile JSON metadata containing the `id`, user-associated `name`, `createdAt`, `durationMs`, `sampleRate`, `sourceFilename`, `sha256` checksum, and optionally cached **`prompt_audio_codes`** (the 2D array of tokens encoded by the tokenizer).
- **Binary Blob Store (Strictly IndexedDB):** Binary audio files must be stored exclusively in **IndexedDB** (using `localforage` for lifecycle management). Storing binary audio blobs in `localStorage` is prohibited due to storage size limits.
- **Hybrid Codec Caching Strategy:** To prevent the user from waiting for ONNX models to load at upload time and to avoid re-encoding raw WAV files on every request, a hybrid caching approach is utilized:
  * **At Upload:** Only the raw audio file and basic metadata are saved immediately (making the upload instant and keeping cloud sync light/standardized).
  * **At Inference:** The provider checks if `prompt_audio_codes` is present in the profile metadata. If not found, it runs the codec encoder session once, caches the result array back to the IndexedDB metadata record, and continues. Subsequent runs fetch the cached codes directly, skipping the audio encoding step completely.
- **Deterministic Sync Naming:** To remain fully compatible with the existing sync engine, binary voice profiles must be uploaded to S3 with a deterministic suffix:
  `assets/voice-profiles/{id}.bin`
- **Selective Sync Scope:** Voice Profiles are registered as a heavy-asset category in the sync engine. In the UI onboarding/settings tree, a toggle row `[ ] Voice Profiles` is presented to allow users to exclude voice cloning assets from high-speed database sync to conserve bandwidth.
- **UI & Uniqueness Validation:**
  - The voice profile configuration UI allows the user to associate a custom **Display Name** for the upload (falling back to the source filename if left blank).
  - To prevent downstream resolution issues, the user-defined name is strictly sanitized. Only alphanumeric characters, spaces, hyphens, and underscores are allowed (regex: `^[A-Za-z0-9 _-]+$`). Any special symbols are automatically stripped.
  - The sanitized name must be unique. If a collision is detected, the UI prompts for a renaming or automatically appends a number suffix (e.g., `(2)`).
  - The character card's `voice_id` configuration maps directly to this unique display name to resolve the asset at generation time.

## Why MOSS‑TTS‑Nano (ONNX) is interesting in AIRI

Compared to Kokoro:

- **Voice cloning**: Nano is explicitly positioned for multilingual voice cloning with reference audio.
- **Streaming-friendly internals**: ONNX export is split into prefill/decode-step graphs, but we do not need to expose streaming at the AIRI UX level initially.
- **Browser compatibility**: model card claims it is designed for **onnxruntime-web** (WebGPU/WASM).

Compared to server/HTTP TTS providers:

- Local privacy + offline capability (subject to weight download/caching).
- Avoids API keys, costs, and latency; integrates into AIRI’s local inference UX.

## Proposed integration shape (high-level)

### 1) New local worker speaking AIRI’s unified protocol

Create `packages/stage-ui/src/workers/moss-nano/worker.ts` that:

- Accepts `load-model` with `{ device: 'webgpu' | 'wasm' | 'cpu' }`.
- Loads ONNX Runtime Web sessions for:
  - global prefill
  - global decode-step (KV cache)
  - local decoder + any local step graphs
  - audio tokenizer encoder/decoder (from `MOSS-Audio-Tokenizer-Nano-ONNX`)
- Emits `progress` during fetch/compile/warmup.
- Implements `cancel` by marking request IDs as cancelled and discarding late results (same pattern as Kokoro).

### 2) New adapter mirroring Kokoro’s resilience/coordination

Create `packages/stage-ui/src/libs/inference/adapters/moss-nano.ts` that:

- Uses `getLoadQueue()` to serialize model loads.
- Uses `getGPUCoordinator()` to track estimated VRAM and touch LRU on inference.
- Records device-loss events and implements **WASM promotion** after repeated failures (like Kokoro/Whisper).
- Returns output audio as PCM → WAV (or directly as WAV if the worker returns encoded audio).

### 3) Register as a first‑class Speech Provider

In `packages/stage-ui/src/stores/providers.ts`:

- Add a new provider definition:
  - category: `speech`
  - tasks: `text-to-speech`
  - deployment: `local`
  - capabilities:
    - `listModels` (Nano variants, device/dtype options)
    - `listVoices` (maps to “voice profiles” retrieved from IndexedDB + builtin presets)
    - explicit **voice cloning capability** surfaced in metadata/UI
- Add settings UI surface under `packages/stage-pages/src/pages/settings/providers/speech/moss-nano-local.vue` using `<SpeechProviderSettings>` with the following streamlined controls:
  - **Performance & Fallback Option:**
    - **CPU Threads (Default: 4):** Dictates thread count for ORT WebAssembly runner during WASM EP fallback execution. (No effect when running under WebGPU).
    - **Attention Backend:** Choice of `sdpa` (Scale Dot Product Attention) or `eager`.
  - **Generation Tuning Options:**
    - **Sampling Mode:** Dropdown offering `Fixed` (graph-compiled sampling using fixed hyperparameters, high performance) vs `Dynamic` (runs sampling loop in JS, allowing customization and higher quality).
    - **Voice Clone Max Text Tokens (Default: 75):** Controls the maximum text token prompt length for reference audio conditioning.
  - **Other options hidden:** Text normalization is omitted as it is handled by the upstream Audio Studio. Batch sizes (Mac TTS / Mac Codex batch sizes) are hardcoded and hidden from user control to keep the interface simple.
  - **Voice Cloning Library:** Inline asset manager to upload new custom reference WAV files, sanitize user-defined names to `^[A-Za-z0-9 _-]+$`, and display saved profiles.

## Key technical unknowns / due diligence checklist

These are the main items to analyze before committing to the integration.

### ONNX Runtime Web integration details

- **Does AIRI already ship `onnxruntime-web` explicitly, or only transitively?**
  - Kokoro uses `kokoro-js` which internally uses transformers.js/ORT; Nano would likely need direct `onnxruntime-web` usage for multi-graph orchestration.

- **Execution providers**:
  - Validate WebGPU EP availability across AIRI targets:
    - Stage Web (browser)
    - Stage Tamagotchi (Electron)
  - Confirm WASM fallback works consistently.

### Model asset fetching + caching

- External `.data` weights:
  - Confirm they can be fetched by ORT-web in AIRI’s environment (CORS, range requests, cache headers).
  - Decide caching layer (Cache Storage / IndexedDB / filesystem in Electron).
  - Confirm update strategy + integrity (hashing or ETag).

- Manifest usage:
  - Evaluate Nano’s `browser_poc_manifest.json` and `tts_browser_onnx_meta.json` for guidance.
  - Decide how to represent these in AIRI (hardcoded model IDs vs configurable mirrors).

### Streaming generation UX + API shape

- **Decision: Run in Non-Streaming Mode only.**
- **Reasoning:**
  - AIRI already splits input text into smaller sentence slices and coordinates sequential generation (pseudo-streaming). This is sufficient for low-latency feedback.
  - Local validation of the ONNX browser POC showed that the browser runtime's `Realtime Streaming Decode` introduces audio artifacts (stuttering/crackling) and degraded audio quality compared to `Non-Streaming` execution.
  - Internal multi-graph decode-step KV caching will remain an implementation detail inside the worker, but the outward-facing API will output a complete `audio/wav` buffer per slice.

### Voice cloning capability definition

- Decide how to represent “voice”:
  - Kokoro uses a static `VoiceKey`.
  - Nano voice cloning uses a **reference audio blob** selected from a local voice library (IndexedDB).
  - Treat “voice list” as “user uploaded reference audios”, not “built-in speaker IDs”.

- Reference audio preprocessing:
  - Confirm required sample rate/channels and any normalization.
  - Decide where resampling happens (main thread vs worker vs audio tokenizer graph).

- **Hard requirement — unique labels**: Voice clone labels (the user-facing name for a cloned voice) **must be unique** within the MOSS provider's voice registry. The `VoiceProfile.baseVoice` field stores the label as a plain string, and `AiriCard.extensions.airi.modules.speech.voice_id` → `VoiceProfile.baseVoice` is the chain used by selective sync to resolve a character → its cloned audio blob. If labels are not unique, this lookup becomes ambiguous. Enforce uniqueness at upload time — reject or deduplicate (e.g. append `(2)`) when a user provides a label that already exists.

### Performance + memory budgeting

- Add VRAM estimates to `MODEL_VRAM_ESTIMATES` (like Kokoro/Whisper).
- Validate whether Nano is realistically “small enough” for typical WebGPU budgets when combined with other models (Whisper, etc.).
- Confirm device-loss behavior under load and whether promotion threshold needs tuning.

### Licensing / distribution

- Confirm license compatibility and whether AIRI can ship default model IDs or must require user opt-in download.
- Check whether any of the linked Hugging Face repos have additional usage restrictions beyond Apache‑2.0 (MOSS family is Apache‑2.0 per README).

### Model Cache & OPFS storage integration

To integrate MOSS-TTS-Nano into the unified client cache dashboard, we must update three distinct layers of the codebase to track the Origin Private File System (OPFS) structure created by the browser model store.

#### 1. OPFS Directory & File Structure
MOSS downloads files to the root OPFS directory under `nano-reader-browser-model-store/`.
We must check for the presence and file sizes of the following structure:
```
nano-reader-browser-model-store/
├── MOSS-TTS-Nano-100M-ONNX/
│   ├── browser_poc_manifest.json
│   ├── tts_browser_onnx_meta.json
│   ├── tokenizer.model
│   ├── moss_tts_prefill.onnx
│   ├── moss_tts_decode_step.onnx
│   ├── moss_tts_local_decoder.onnx
│   ├── moss_tts_local_cached_step.onnx
│   ├── moss_tts_local_fixed_sampled_frame.onnx
│   ├── moss_tts_global_shared.data
│   └── moss_tts_local_shared.data
└── MOSS-Audio-Tokenizer-Nano-ONNX/
    ├── codec_browser_onnx_meta.json
    ├── moss_audio_tokenizer_encode.onnx
    ├── moss_audio_tokenizer_encode.data
    ├── moss_audio_tokenizer_decode_full.onnx
    ├── moss_audio_tokenizer_decode_step.onnx
    └── moss_audio_tokenizer_decode_shared.data
```

#### 2. Cache Utilities (`packages/stage-ui/src/libs/inference/cache-utils.ts`)
We will add utility functions to target this specific OPFS directory:
* **Directory Name Constant:**
  `const MOSS_OPFS_DIR_NAME = 'nano-reader-browser-model-store'`
* **Calculating Cache Size (`getMossOpfsCacheSize`):**
  Implement a recursive scanner that walks the `MOSS_OPFS_DIR_NAME` directory handles using `dir.values()`. For any file sub-entry, it retrieves the `File` handles to count and sum their `file.size` bytes. Add this size to the return value of `getModelCacheSize()`.
* **Checking Cache Presence (`isMossModelCached`):**
  Expose a checker that returns `true` if `MOSS_OPFS_DIR_NAME` directory handle can be opened successfully, and at least one core model file exists (e.g. `MOSS-TTS-Nano-100M-ONNX/moss_tts_prefill.onnx` has a file handle).
* **Clearing Cache (`clearModelCache`):**
  Update the main cache clearing task to call:
  `await root.removeEntry(MOSS_OPFS_DIR_NAME, { recursive: true })`
  This will delete the 763MB folder from the browser's OPFS instantly.

#### 3. Cache UI Widget (`packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue`)
Register the model in the cache dashboard:
* Add `moss-tts-nano` to the `knownModels` list:
  ```typescript
  const knownModels = [
    { id: DEFAULT_WEB_RWKV_MODEL, name: 'RWKV LLM' },
    { id: 'onnx-community/Kokoro-82M-v1.0-ONNX', name: 'Kokoro TTS' },
    { id: 'onnx-community/whisper-large-v3-turbo', name: 'Whisper ASR' },
    { id: 'moss-tts-nano', name: 'MOSS TTS (Nano)' }, // Registered MOSS
    // ...
  ]
  ```

#### 4. Provider Registry (`packages/stage-ui/src/stores/providers.ts`)
Register `moss-nano-local` with tags to let the providers UI detect its capabilities:
* **Metadata Structure:**
  ```typescript
  'moss-nano-local': {
    id: 'moss-nano-local',
    category: 'speech',
    tasks: ['text-to-speech'],
    name: 'Moss TTS (Nano)',
    description: 'Native AI - Local text-to-speech with voice cloning (0.1B Nano)',
    icon: 'i-lobe-icons:speaker',
    defaultOptions: () => ({
      model: 'moss-tts-nano-100m',
      voiceId: '',
    }),
    createProvider: async (_config) => {
      // Create OpenAI-compatible fetch handler
      // Routes text input & voice files to the background worker
    },
    capabilities: {
      listModels: async () => [
        { id: 'moss-tts-nano-100m', name: 'MOSS TTS Nano (0.1B)' }
      ],
      loadModel: async (config, hooks) => {
        // Triggers worker model downloading / caching sequence
      },
      listVoices: async () => {
        // Merges default builtin voices (Trump, etc.) with custom IndexedDB voice clones
      }
    }
  }
  ```

## Decision summary (current)

- **Idea is viable** given `MOSS‑TTS‑Nano‑100M‑ONNX` + `onnxruntime-web` target.
- Biggest risks are **practical integration details** (multi-graph orchestration, asset caching, streaming output, and voice cloning UX), not AIRI’s provider architecture.
- A minimal first milestone should be:
  - “load Nano ONNX in a worker”
  - “generate short non-cloned speech to WAV”
  - “only then add voice cloning + streaming”.

## Relevant Skills

- [[airi-audio-pipeline]]
- [[airi-local-inference-engines]]
