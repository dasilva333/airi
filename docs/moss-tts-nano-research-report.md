# MOSS-TTS-Nano (0.1B) ONNX WebGPU Local Voice Cloning Viability

## Research Report

---

## 1. Verified-Accurate Claims

### 1.1 ONNX graph split structure

The proposal describes three ONXX graphs: **Prefill**, **Decode-Step**, and **MOSS-Audio-Tokenizer-Nano-ONNX codec graph**. This is confirmed as accurate and implemented:

| Graph | File(s) | Role |
|---|---|---|
| **Prefill** | `moss_tts_prefill.onnx` | Encodes the full `input_ids` (text + audio codes) through the transformer backbone; outputs `global_hidden` and initial KV caches |
| **Decode-Step** | `moss_tts_decode_step.onnx` | Autoregressive step: takes the previous frame's audio tokens + KV cache, emits next frame logits + updated KV caches |
| **Local Decoder** | `moss_tts_local_decoder.onnx` | Non-cached per-frame logits for the first step |
| **Local Cached Step** | `moss_tts_local_cached_step.onnx` | Per-channel cached steps within a frame |
| **Codec Encode** | `moss_audio_tokenizer_encode.onnx` | Waveform → codec code indices (reference audio encoder) |
| **Codec Decode Full** | `moss_audio_tokenizer_decode_full.onnx` | Non-streaming frame batch → PCM waveform |
| **Codec Decode Step** | `moss_audio_tokenizer_decode_step.onnx` | Streaming per-frame codec decode with KV cache |

**Ground truth citations:**
- `packages/stage-ui/src/workers/moss/browser_onnx_runtime.js:191-193` — `ORT_SESSION_OPTIONS` with `executionProviders: ['wasm']` (WASM-only by default)
- `browser_onnx_runtime.js:1551-1570` — `ensureSynthesisLoaded()` creates sessions for all five graph types
- `browser_onnx_runtime.js:1505-1516` — `ensureCodecEncodeLoaded()` creates only the codec encode session
- `browser_onnx_runtime.js:961-1070` — `CodecStreamingDecodeSession` class holds per-frame KV caches (transformers offsets + attention caches), reset per generation call

### 1.2 Runtime integration via onnxruntime-web

The proposal claims usage of `onnxruntime-web` in a web worker. **Accurate**:

- `packages/stage-ui/src/workers/moss/browser_onnx_runtime.js:2` — `import * as ort from 'onnxruntime-web'`
- `browser_onnx_runtime.js:191-194` — `ORT_SESSION_OPTIONS = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }`
- `browser_onnx_runtime.js:1439` — `ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/'`
- `browser_onnx_runtime.js:1406` — `crossOriginIsolated` guard; falls back to single-threaded WASM when not cross-origin isolated

### 1.3 Voice cloning via `promptAudioCodes`

The proposal describes passing `promptAudioCodes` (pre-encoded by the codec tokenizer) as reference conditioning. **Accurate**:

- `browser_onnx_runtime.js:801-814` — `buildAudioPrefixRows()` inserts `promptAudioCodes` as prefix rows before the text tokens
- `browser_onnx_runtime.js:815-835` — `buildVoiceCloneRequestRows()` constructs the full request: `[prefix_text_tokens] + [audio_prefix_rows] + [suffix_text_tokens]`
- `browser_onnx_runtime.js:2435` — `resolvedPromptAudioCodes = promptAudioCodes || this.findVoicePreset(voiceName, extraVoices)?.prompt_audio_codes` — the fallback chain for finding cloned reference codes
- `browser_onnx_runtime.js:3204` — `promptAudioCodes` are passed as the `requestRows` input to the prefill graph

### 1.4 OPFS-based model cache

- `packages/stage-ui/src/libs/inference/cache-utils.ts:6` — `MOSS_OPFS_DIR_NAME = 'nano-reader-browser-model-store'` matches directory name in `browser_model_store.js`
- `browser_model_store.js:4` — `INTERNAL_ROOT_DIR_NAME = 'nano-reader-browser-model-store'`
- `cache-utils.ts:22-73` — `getMossOpfsCacheSize()`, `getMossOpfsCached()`, and `clearMossOpfsCache()` all use the OPFS File System Access API with recursive directory scanning
- `browser_model_store.js:196-227` — `writeResponseToFile()` streams Hugging Face downloads into OPFS via `createWritable()`

### 1.5 Voice profile UI already exists

- `packages/stage-pages/src/pages/settings/providers/speech/moss-nano-local.vue:26-32` — `MossVoiceProfile` interface with `id`, `name`, `createdAt`, `sourceFilename`, `sha256`
- `moss-nano-local.vue:205-251` — `handleFileUpload()` implements acid-sanitize/unique-name validation, stores blob to `voice-profile-blobs` localforage store and metadata to `moss-voice-profiles-metadata` localforage store
- `moss-nano-local.vue:254-264` — `deleteVoiceProfile()` removes from both stores

---

## 2. Wrong, Incomplete, or Aspirational Claims in the Proposal

### 2.1 — WRONG: "10–15s sweet spot" claim duration is speculative

**Proposal claim (line 230):** "Duration sweet spot: Voice cloning reference audio typically works best within a certain range (some models saturate around 15 s, others benefit up to 60 s)."

**Ground truth: No reference to 10–15s exists anywhere in the codebase.** The only duration-related constants are:
- `browser_onnx_runtime.js:201-202` — `DEFAULT_VOICE_CLONE_INTER_CHUNK_PAUSE_SHORT_SECONDS = 0.4` / `LONG_SECONDS = 0.24` (inter-chunk pause, not reference duration)
- `browser_onnx_runtime.js:1816` — `estimateVoiceCloneInterChunkPauseSeconds()` (again, inter-chunk pauses, not reference duration heuristics)

**Status:** Not implemented anywhere. The `voiceCloneMaxTokens = 75` setting (line 1740 of `browser_onnx_runtime.js`) is a *text token* limit (SentencePiece tokens), not a duration limit. The manifest's `n_vq` value (not a configurable duration) controls the number of audio codebook quantizers.

### 2.2 — WRONG: `local:voice-profiles/*` IndexedDB namespace is not aligned to existing codebase conventions

**Proposal claim (line 245):** Store voice profile metadata under `local:voice-profiles/*`.

**Ground truth:**
- `packages/stage-ui/src/stores/sync-engine.ts:1772-1773` — The actual localforage instances are:
  - `moss-voice-profiles-metadata` (localforage instance name)
  - `voice-profile-blobs` (localforage instance name)
- The key pattern is just the profile `id` (e.g. `voice-profile-1719154800000-abc123`), not `local:voice-profiles/{id}`
- `sync-engine.ts:1756` — The sync engine uses `assets/voice-profiles/{id}.json` (not the proposed `local:voice-profiles/*` keyspace)

**Status:** The metadata store name convention is already established (`moss-voice-profiles-metadata`, `voice-profile-blobs`) and diverges from the proposal's `local:voice-profiles/*` namespace.

### 2.3 — WRONG: Hybrid codec caching strategy not implemented

**Proposal claim (lines 247-249):** "At upload, only the raw audio file and basic metadata are saved immediately. At inference, check if `prompt_audio_codes` is present. If not, encode once and cache."

**Ground truth:**
- `packages/stage-ui/src/libs/inference/adapters/moss.ts` — The `MossAdapter` interface has a `generate()` method that accepts `promptAudioWaveform` (Float32Array), but does NOT accept `promptAudioCodes` directly.
- `packages/stage-ui/src/workers/moss/worker.ts:107-114` — Every generate call with `promptAudioWaveform` runs `encodeReferenceAudioFromWaveform()` → `buildCodecEncodeFeeds()` → ONNX session run. No caching.
- No `prompt_audio_codes` field exists in the `MossVoiceProfile` TypeScript interface (line 26-32 of `moss-nano-local.vue`), despite the proposal specifying it should be cached in metadata.
- No cache hit/miss logic in `worker.ts` or `browser_onnx_runtime.js`.

**Status:** The "hybrid caching" is entirely aspirational. The current implementation always encodes reference audio per request.

### 2.4 — WRONG: Moss adapter has NO device-loss resilience, WASM promotion, or crash recovery

**Proposal claim (line 54):** "Adapters record device-loss and can promote subsequent loads to WASM."

**Ground truth:**
- `adapters/kokoro.ts` and `adapters/whisper.ts` use `createGpuWorkerHost()` with `promoteDevice()`, `handleWorkerError()`, and `runOnGpu()` — full crash recovery + WASM promotion
- `adapters/moss.ts:101-161` — Uses raw `new Worker()` with no `createGpuWorkerHost()` wrapper. No `promoteDevice()`, no `runOnGpu()`, no crash recovery, no exponential backoff, no device-loss telemetry.
- `adapters/moss.ts:151` — `state = 'error'` on any error with no retry logic
- The Moss adapter is excluded from `gpu-worker-host.test.ts` — it's the only major adapter not using the host infrastructure.

**Status:** Only WASM execution provider is hardcoded (`executionProviders: ['wasm']`). No WebGPU path is attempted. No device-loss handling is implemented.

### 2.5 — WRONG: Moss adapter encode path has no silence trimming / normalization

**Proposal claim (lines 231-235):** "Gain normalization (peak or RMS)? Silence trimming (leading/trailing)?"

**Ground truth:**
- `providers.ts:120-143` — `decodeAudioToWaveform()` does channel mixing only. No silence trimming, no gain normalization, no peak/RMS-based leveling.
- `browser_onnx_runtime.js:1890-1930` — `encodeReferenceAudioFromWaveform()` accepts a raw `Float32Array` and immediately runs it through the codec encoder — no preprocessing, no normalization, no silence trimming.
- The UI (`moss-nano-local.vue`) has no preprocessing controls.

**Status:** No reference audio quality preprocessing exists anywhere in the codebase.

### 2.6 — ASPIRATIONAL: `VOICE_PROFILE_BLOB_STORE` localforage instance name collision risk

**Proposal claim (line 246):** "Binary audio files must be stored exclusively in IndexedDB (using `localforage` for lifecycle management)."

**Ground truth:**
- `moss-nano-local.vue:38-39` — `mossVoiceProfileBlobsStore = localforage.createInstance({ name: 'voice-profile-blobs' })`
- The sync engine (`sync-engine.ts:1772`) also uses `localforage.createInstance({ name: 'moss-voice-profiles-metadata' })`
- The two localforage instances share the same default IndexedDB database

**Risk:** Both the UI store and sync engine store create instances against the same IndexedDB database. The moss adapter also needs its own reference (currently missing — it accepts only raw `promptAudioWaveform`, not blob lookups from IndexedDB). A collaborative naming collision is possible if the sync-engine and the UI disagree on the store name format.

### 2.7 — ASPIRATIONAL: `streaming: false` in generate requests doesn't prevent codec streaming decode

**Proposal claim (lines 212-215):** "For initial integration... we can return a full WAV per slice without introducing partial sentence streaming complexity. Local validation showed that the browser runtime's Realtime Streaming Decode introduces audio artifacts."

**Ground truth:**
- `browser_onnx_runtime.js:2338-2397` — The `synthesizeVoiceClone()` function accepts `streaming` parameter. When `streaming=true`, it uses `decodeFullAudioIncremental()` (the streaming codec path). When `streaming=false`, it uses `decodeFullAudio()` (the non-streaming path).
- `worker.ts:117` — `streaming: false` is hardcoded in the generate request. The full audio is decoded non-streaming, then streamed back chunk-by-chunk.
- The proposal's "Non-Streaming Mode" decision is already implemented — the runtime hardcodes `streaming: false` in the worker.

**Status:** The streaming path exists in the runtime but is unused; `streaming: false` is the default. Audio chunked reassembly happens via `onAudioChunk` callbacks in `synthesizeVoiceClone()` regardless of the underlying codec decode path.

---

## 3. Concrete Integration Map

### 3.1 — Reference-audio preprocessing (GAIN NORMALIZATION + SILENCE TRIMMING)

**Problem:** The current implementation passes raw `Float32Array` (from `decodeAudioToWaveform()`) directly to `encodeReferenceAudioFromWaveform()` with no preprocessing. Reference audio with background noise, silence padding, or low gain will degrade clone quality.

**Integration points:**

| Integration | File | Function | Line |
|---|---|---|---|
| **Gain normalization** | `packages/stage-ui/src/stores/providers.ts` | `decodeAudioToWaveform()` (new inner function) | ~120-143 |
| **Silence trimming** | `packages/stage-ui/src/stores/providers.ts` | Add after channel mixing, before returning `waveform` | After line 137 |
| **Preprocessing in reference encode** | `packages/stage-ui/src/workers/moss/browser_onnx_runtime.js` | `encodeReferenceAudioFromWaveform()` — add preprocessing before `buildCodecEncodeFeeds()` | Before line 1912 |
| **Reuse: resampling pattern** | `packages/stage-ui/src/workers/whisper/worker.ts` | Whisper adapter's `transcribe()` accepts raw `audioFloat32` + `audio` (base64) — no resample step exists in whisper adapter (it relies on`AudioContext.decodeAudioData()` in the caller) | `providers.ts:120-143` |
| **Settings plumbing** | `packages/stage-ui/src/stores/providers.ts` | Extend `MossGenerateRequest` options to include `preprocessReferenceAudio: boolean` and `silenceThresholdDb: number` | `contract.ts:318-326` |

**What to add to `providers.ts`:**

```typescript
// New function after line 143:
function normalizeAndTrimWaveform(
  waveform: Float32Array,
  targetChannels: number,
  options: {
    silenceThresholdDb: number // e.g. -45 dB
    minDurationMs: number // e.g. 200
    maxDurationMs: number // e.g. 15000
    targetPeakDb: number // e.g. -3 dB
  }
): Float32Array {
  // 1. Peak/RMS normalize per channel (scalar multiply to hit targetPeakDb)
  // 2. Compute energy per 25ms frame
  // 3. Find first/last frame above silenceThresholdDb
  // 4. Apply sub-sample linear ramp at edges (50ms fade in/out)
  // 5. Return trimmed + normalized waveform
}
```

The function should be pure (no AudioContext needed — operates directly on `Float32Array` samples).

### 3.2 — Pre-computed code cache (`prompt_audio_codes`)

**Problem:** Every generate call with a custom voice runs `encodeReferenceAudioFromWaveform()` — a full ONNX codec encode session (~50-500ms) before synthesis even begins. For repeated use of the same reference audio, this is wasteful.

**Integration points for cache hit/miss:**

| Integration | File | Function | Line |
|---|---|---|---|
| **Cache key computation** | `packages/stage-ui/src/stores/providers.ts` | Compute SHA-256 of the waveform buffer + preprocessing params before calling `adapter.generate()` | New function, before line 284 |
| **Cache lookup in moss adapter** | `packages/stage-ui/src/libs/inference/adapters/moss.ts` | Extend `generate()` to accept optional `cachedPromptAudioCodes` — if present, skip `encodeReferenceAudioFromWaveform` in worker | `generate()` signature at line 162-221 |
| **Cache write-back in worker** | `packages/stage-ui/src/workers/moss/worker.ts` | After `encodeReferenceAudioFromWaveform()`, return the codes in the response so the adapter can cache them | After line 114 |
| **Store in localforage metadata** | `packages/stage-ui/src/stores/sync-engine.ts` | Extend `MossVoiceProfile` metadata to include `promptAudioCodes: number[][]` | `sync-engine.ts:1772` (store name is `moss-voice-profiles-metadata`) |

**Cache key design:**
```
cacheKey = SHA256(
  waveformSamples.length
  + waveformSamples.slice(0,26)  // header sample
  + waveformSamples.slice(-26)   // tail sample
  + preprocessingParamsHash
  + modelVersion  // regenerate when model changes
)
```

**Where to put the cache logic:**

```typescript
// In adapters/moss.ts generate():
const cacheKey = await computeReferenceAudioCacheKey(promptAudioWaveform, options)
let promptAudioCodes = await getCachedPromptAudioCodes(cacheKey)
if (!promptAudioCodes) {
  // Fall through to worker encode
  const stream = rpc.generate(...)  // worker returns codes in response metadata
  // After stream completes:
  await cachePromptAudioCodes(cacheKey, returnedCodes)
} else {
  // Pass cached codes directly to worker instead of waveform
  const stream = rpc.generate({ ...options, cachedPromptAudioCodes: promptAudioCodes })
}
```

### 3.3 — Sample-rate/channel matching via `AudioContext.decodeAudioData()`

**Ground truth today:**
- `providers.ts:120-143` — `decodeAudioToWaveform()` uses `AudioContext.decodeAudioData()` → `decoded.getChannelData()` → channel mixing. No resampling is applied.
- The output `Float32Array` uses the `targetSampleRate` passed to `AudioContext` constructor (via `{ sampleRate: targetSampleRate }` context option) — but the browser's `AudioContext` constructor does NOT resample. It ignores the option.

**Fix needed:**
1. Use `OfflineAudioContext` with `createBufferSource()` + `AudioBufferSourceNode` resampling (browsers do NOT resample via constructor option alone)
2. OR use `wasm` resampler if rate mismatches

**Location:** `providers.ts:120-143` — add proper resampling after decode, before channel mixing.

### 3.4 — Wire into `MODEL_VRAM_ESTIMATES` and GPU coordinator

The moss adapter currently doesn't register in the coordinator. Integration point:

| Integration | File | Function |
|---|---|---|
| Add VRAM estimate | `packages/stage-ui/src/libs/inference/coordinator.ts` | Add entry: `'moss-tts-nano': 400 * 1024 * 1024` (~400 MB for the graphs + weights) |
| Register in `TIMEOUTS` | `packages/stage-ui/src/libs/inference/constants.ts` | Add `MOSS_LOAD`, `MOSS_GENERATE_FIRST_CHUNK`, `MOSS_GENERATE_IDLE` |
| Register in `GPU_PRIORITY` | `packages/stage-ui/src/libs/inference/gpu-executor.ts` | Add `MOSS_TTS_GENERATE: 20` (same tier as TTS) |

---

## 4. Ranked Quality-Improvement Recommendations

### RANK 1: Implement reference-audio gain normalization + silence trimming (Impact: High, Effort: Low)

**Why:** Background noise, silence padding, and volume variance directly degrade clone quality. The `encodeReferenceAudioFromWaveform()` path has zero preprocessing.

**Where:** `packages/stage-ui/src/stores/providers.ts`, after existing `decodeAudioToWaveform()` at line 143. New pure function that:
1. Computes RMS energy in 25ms frames, finds leading/trailing silence below threshold (-40dB to -50dB)
2. Peak-normalizes to -3dB (leaving headroom for codec encoder)
3. Adds 50ms linear fade at boundaries to prevent clicks
4. Returns cleaned `Float32Array`

**Effort:** ~80 lines. No new dependencies.

### RANK 2: Pre-computed code cache with SHA-256 keying (Impact: High, Effort: Medium)

**Why:** Current implementation re-encodes reference audio on every generate call (~100-500ms + ONNX session warm-up). For a character with a fixed cloned voice, this is pure waste.

**Where:** Extend `MossGenerateRequest` in `contract.ts:318-326` to accept `cachedPromptAudioCodes?: number[][]`, extend `moss.ts:162-221` `generate()` to accept it, extend `worker.ts:81-140` to skip encoding when codes are provided.

**Cache location:** The existing `sync-engine.ts:1772` pattern (`moss-voice-profiles-metadata` localforage instance). Add `promptAudioCodes: number[][]` to the `MossVoiceProfile` interface.

**Effort:** ~120 lines across adapter + worker + cache helpers.

### RANK 3: Add proper sample-rate resampling (Impact: Medium, Effort: Low)

**Why:** `AudioContext` constructor `sampleRate` option is advisory at best. If a user uploads a 44.1kHz WAV but the codec expects 16kHz, the current implementation returns mismatched rate audio silently.

**Where:** `providers.ts:120-143`, change to use `OfflineAudioContext` with explicit resampling.

**Effort:** ~20 lines change.

### RANK 4: Wire moss adapter into `createGpuWorkerHost()` for resilience (Impact: Medium, Effort: Medium)

**Why:** Currently a single WASM worker with no recovery. Any error → 'error' state → permanent failure. The Kokoro/Whisper pattern handles device loss, crash recovery, and automatic WASM promotion.

**Where:** `adapters/moss.ts` — wrap worker creation in `createGpuWorkerHost()`, add `promoteDevice()`, `runOnGpu()`, `allocate()` calls, and `handleWorkerError()`. Follow `adapters/kokoro.ts:168-181` and `adapters/whisper.ts:135-145` pattern.

**Effort:** ~80 lines refactor.

### RANK 5: Add moss to `MODEL_VRAM_ESTIMATES` and GPU coordinator (Impact: Low, Effort: Low)

**Why:** The 0.1B model with fp32 graphs + OPFS blobs will consume ~400-500 MB VRAM (fp32 weights + ONNX graph allocations). Currently untracked — OOM possible when combined with Whisper (800 MB) + Web-RWKV (512 MB).

**Where:** `coordinator.ts:58-80`, add `'moss-tts-nano': 400 * 1024 * 1024`.

**Effort:** ~5 lines.

---

## 5. Open Questions Requiring a Decision

### Q1: What is the MOSS tokenizer's expected input sample rate and channel count?
- The current code hardcodes `targetSampleRate = 16000` in `decodeAudioToWaveform()`, but the actual tokenizer graph's `codec_config.sample_rate` is unknown without examining the ONNX model metadata.
- The `codecMeta.codec_config.sample_rate` field (read from `codec_browser_onnx_meta.json`) is the ground truth — it's read by `browser_onnx_runtime.js:1821`, but the value is model-dependent.

### Q2: Should reference audio be stored in the existing sync-engine `voice-profile-blobs` store, or in a new dedicated store?
- Current UI uses `voice-profile-blobs` (localforage instance name)
- Sync engine also uses `moss-voice-profiles-metadata` (separate localforage instance)
- The adapter currently reads raw `Float32Array` — no blob lookup. The proposal's `local:voice-profiles/*` namespace doesn't match either.

### Q3: Is the Moss adapter intentionally WASM-only, or is WebGPU execution planned?
- `ORT_SESSION_OPTIONS` has `executionProviders: ['wasm']` hardcoded at `browser_onnx_runtime.js:191`
- `worker.ts` sends `device: 'wasm'` in `load()` request
- `loadModel()` in `adapters/moss.ts` hardcodes `{ device: 'wasm', dtype: 'fp32', hfToken }`
- No WebGPU EP is attempted anywhere in the moss path.

### Q4: What is the maximum reference audio duration accepted by the codec encoder?
- The `encodeLength = Math.max(codecMeta.codec_config.downsample_rate, 4096)` at `browser_onnx_runtime.js:1648` is a lower bound, not an upper bound.
- The `waveformLength` passed to `buildCodecEncodeFeeds()` is unbounded — a 5-minute reference would run through the codec encoder (possibly slow / OOM).
- No duration clamping exists anywhere.

### Q5: The `VOICE_PROFILE_BLOB_STORE` + `MOSS_VOICE_PROFILES_METADATA` localforage instances live in the default IndexedDB database — is this safe from eviction?
- `browser_model_store.js:100` calls `storage.persist()` for model blobs, but the voice profile stores don't call persist.
- Sync-engine compatibility adds another layer of complexity for key naming.

### Q6: The current `encodeReferenceAudioFromWaveform()` accepts interleaved channels as a flat Float32Array. Is this the correct input format for the codec encoder?
- `browser_onnx_runtime.js:1899-1909` — The code checks `waveform.length % targetChannels === 0` to decide interleaved vs packed format. The interleaved → channel-major pack logic at line 1904-1908 assumes interleaved input. The codec encoder's `buildCodecEncodeFeeds()` expects `[1, channels, waveformLength]` — but the caller's `finalWaveform` may have an incorrect layout if the channels are not interleaved.

---

*Report generated after reading 15+ source files across `packages/stage-ui/src/workers/moss/`, `packages/stage-ui/src/libs/inference/`, `packages/stage-ui/src/stores/`, and `packages/stage-pages/src/pages/settings/providers/speech/`.*

## Relevant Skills

- [[airi-local-inference-engines]]
