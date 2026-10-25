---
name: airi-local-tts-engines
description: >-
  Own local neural TTS engines end-to-end: Kokoro, Pocket TTS, MOSS-TTS-Nano, Ming browser workers, adapters, voice-clone profiles, per-language bundles, cache eviction. Synthesis intents use airi-speech-runtime; generic worker machinery uses airi-local-inference-engines.
---

# AIRI Local TTS Engines (Kokoro · Pocket · MOSS · Ming)

This skill owns AIRI's on-device text-to-speech engines: browser workers, thin adapters, provider wiring, voice-clone/design profiles, per-language model bundles, and on-device cache/eviction. Speech *requests* (intents, queueing, playback ordering) belong to [airi-speech-runtime](../airi-speech-runtime/SKILL.md); text *transformation* before synthesis (UST, VoiceProfiles) belongs to [airi-audio-pipeline](../airi-audio-pipeline/SKILL.md); generic worker machinery (protocol, load queues, `GpuResourceCoordinator`, OOM handling) belongs to [airi-local-inference-engines](../airi-local-inference-engines/SKILL.md). Deep per-model evaluations live in `docs/` analysis files (linked below), not here.

## 1. Engine Map

| Engine (provider id) | Voices / cloning | Worker | Adapter + conditioning |
|---|---|---|---|
| **Kokoro-82M** (`kokoro-local`) | Fixed bank, no cloning. EN + limited JA. ONNX `onnx-community/Kokoro-82M-v1.0-ONNX` via `kokoro-js`, CacheStorage `transformers-cache` | `packages/stage-ui/src/workers/kokoro/` (`constants.ts`: `KOKORO_MODELS`, `getKokoroVoiceList`) | `packages/stage-ui/src/libs/inference/adapters/kokoro.ts` — load queue, GPU coordinator, device-loss promotion to WASM, WAV encoding |
| **Pocket TTS 0.1B** (`pocket-tts-local`) | 6 language bundles (`english_2026-04`, `french_24l`, `spanish_24l`, `german_24l`, `portuguese_24l`, `italian_24l`), 26 predefined voices + transcript-free cloning via cached `promptVoiceEmbedding` | `packages/stage-ui/src/workers/pocket-tts/` (`pocket_model_store.ts`: OPFS `pocket-tts-browser-model-store/{langFolder}/` 8 files each + root `sentencepiece.js` + `{lang}/voices/*.safetensors` from gated `kyutai/pocket-tts`; `pocket_onnx_engine.ts`: SentencePiece → `flow_lm` → chunked `mimi_decoder`, 24 kHz) | `packages/stage-ui/src/libs/inference/adapters/pocket-tts.ts` + `packages/stage-ui/src/stores/providers/pocket-audio-utils.ts` (`getPocketTtsAdapterInstance`, `preprocessPocketReferenceAudio`: 24 kHz resample, silence trim, peak normalize) |
| **MOSS-TTS-Nano 0.1B** (`moss-nano-local`) | Single model, ZH + EN, transcript-free cloning via cached `promptAudioCodes`. OPFS `nano-reader-browser-model-store` | `packages/stage-ui/src/workers/moss/browser_onnx_runtime.js` (WASM-only `onnxruntime-web`: prefill / decode-step / local decoder / codec graphs; `promptAudioCodes` prefix rows) | `packages/stage-ui/src/stores/providers/moss-audio-utils.ts` (`getMossAdapterInstance`, `preprocessMossReferenceAudio`: channel-planar conditioning, `sanitizeMossInputText` strips `[...]` and `<\|...\|>` — MOSS must never receive paralinguistic tags) |
| **Ming-3.0-tts 0.5B** (`ming3-local`, pilot, threads-gated) | 5 EN built-ins + natural-language voice design + 14 case-sensitive paralinguistic tags (`[Laughter]`, not `[laughter]`). No browser voice cloning in v0.1. 44.1 kHz (other engines: 24 kHz) | `packages/stage-ui/src/workers/ming3/` (`worker.ts`: load/generate/stop, one 80 ms frame per macrotask, transferable PCM; `loader.ts`: build picker, OPFS `ming-tts-parts` + BLAKE3, CDN glue via Blob import) | `packages/stage-ui/src/libs/inference/adapters/ming3.ts` (mutex, single-threaded-first, design-voice resolution; `sanitizeMing3InputText` preserves brackets — Ming tags must reach the engine intact) |

> **Ownership boundary:** this skill owns everything from synthesis request to waveform bytes inside the engines above, including voice-profile persistence and model-file caches. It does not own the unified provider registry shape (`airi-provider-core-registry`), multi-instance accounts (`airi-provider-store-instances`), settings pages (`airi-provider-ui-pages`), or onboarding speech steps (`airi-onboarding-v3`) — those consume the contracts defined here.

## 2. Key Code Paths

### Provider Registration (all engines)
- `packages/stage-ui/src/stores/providers/registry/speech.ts` — `createSpeechMetadata()`: `defaultOptions` (model, voice, engine-specific knobs like `preset`), `createProvider` (OpenAI-compatible `fetch` → adapter), `capabilities` (`listModels`, `loadModel`, `listVoices` = builtins + custom-clone/design iterate, `getSpeechCapabilities` for expression tags), `validators`.
- `packages/stage-ui/src/stores/providers/ming3-catalog.ts` — Ming model id, 5 verified built-ins, 14 canonical tags, `MingDesignVoice` shape, design-store accessors. Pocket's equivalents live inline in `speech.ts` (`POCKET_PREDEFINED_VOICE_CATALOG`, `POCKET_PREDEFINED_VOICES_BY_LANG`, `normalizePocketLangFolder`); Kokoro's in `workers/kokoro/constants.ts`.

### Voice Profiles (clone/design persistence)
- Pocket: localforage `pocket-voice-profiles-metadata` (`{id: pocket-profile-<sha16>, name, createdAt, sourceFilename, sha256, promptVoiceEmbedding?}`) + `pocket-voice-profiles-blobs` (raw uploaded `File`). Harvest-after-first-synthesis caches the encoder output in metadata; subsequent turns skip encoding.
- MOSS: localforage `moss-voice-profiles-metadata` (same shape + `promptAudioCodes`) + `voice-profile-blobs`.
- Ming designs: localforage `ming-design-voices-metadata` (`{id: ming-design-<sha16>, name, createdAt, designPrompt, conditionedEmbedding?, artifactVersion?}`) — no blob store (the "reference" is text). Bracket-to-token UST mapping for control-token TTS is the documented Higgs pattern, not re-implemented per engine.
- Shared UI: `packages/stage-pages/src/pages/settings/providers/speech/<engine>-local.vue` (upload/design CRUD, test playground). Starter voices: `packages/stage-ui/src/constants/voices/starter-voice-catalog.ts`.

### Model Cache & Eviction (ModelCacheManager contract)
- `packages/stage-ui/src/libs/inference/cache-utils.ts` — per-engine trio (`get*CacheSize` / `clear*Cache` / `is*Cached`) plus single-active-slot eviction (`evictOtherWhisperModels` from adapter post-load; blip worker's inline `evictOtherTaggers`; web-rwkv single-slot OPFS; `evictOtherPocketModels` keeps one `{langFolder}/` incl. its voices but never root `sentencepiece.js`; `evictOtherMing3Models` keeps one bundle's BLAKE3 set). All five aggregation points must be wired or the widget lies: `getModelCacheSize`, `clearModelCache`, `clearSingleModelCache`, `isModelCached`, `getDetailedModelCacheMap` (cautionary tale: `pocket-tts-local` shipped with no trio and no widget row — invisible, unpurgable).
- `packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue` — one `knownModels` row per provider id drives status, sizes, and per-row purge.
- `packages/stage-ui/src/libs/inference/coordinator.ts` — advisory memory-budget entry per engine (WASM-heap engines included).
- `packages/stage-ui/src/libs/inference/constants.ts` — `MODEL_IDS` repo ids, `MODEL_NAMES` status keys, `TIMEOUTS` load/generate budgets.

### Cross-Cutting Consumers
- Onboarding `step-speech.vue`: the onboarding-side contract (recognition lists, engine readiness/download branches, static voice fallbacks, hero cards, draft fields) lives in airi-onboarding-v3 §5 — implement against that checklist, keep engine internals here.
- Settings search: speech metadata joins the Hub quick-search live sweep with relevance-ranked results (`rankSearchResults` in `settings-search-index.ts`).

## 3. Core SOPs & Guidelines

### 1. Adding or Modifying a Local TTS Engine
1. Register `'<engine>-local'` in `createSpeechMetadata` (model, voices, `loadModel` with progress, honest `validateProviderConfig`).
2. Add the `cache-utils.ts` trio + `ModelCacheManager.vue` row + coordinator budget entry in the same PR (never as follow-up).
3. Enforce single-active-variant eviction when the engine has multiple bundles (languages, quantizations) — decide full-dir vs model-files-only up front.
4. Voice cloning stores the *conditioned artifact* in metadata (never re-encode per turn); voice design stores the prompt text, no blob store.
5. `sanitize*InputText` is per-engine and semantic: stripper for engines that loop on brackets (MOSS), preserver for tag-native engines (Ming). Never add a global bracket-stripper.

### 2. Settings Search & Onboarding Checklist
- After registering, verify the provider matches a Hub search by id, name, and route (`rankSearchResults` tiering keeps exact matches above substring noise — do not "fix" ranking by curating entries).
- Onboarding recognition lists (`isLocalProvider`, internal-provider lists, engine readiness/download branches, static voice fallbacks) are separate from the settings page — update both or the provider is reachable but not onboardable.

## 4. Known Pitfalls & Failure Modes

- **Gated upstream repos**: `kyutai/pocket-tts` voice presets need the user's HF token with the gate accepted; 401/403 must fall back to voiceless generation, never hard-fail the load.
- **Single-threaded default**: without COOP/COEP headers `crossOriginIsolated` is false and threaded builds cannot run — ship single-threaded-first with honest slow-mode copy; threaded compute-pool spawn is separate follow-up work.
- **Sample-rate mismatch**: Ming emits 44.1 kHz; the rest of the local pipeline is 24 kHz. Resample at the adapter boundary or run a native-rate path — do not silently feed 44.1 kHz PCM into a 24 kHz player.
- **Case-sensitive tags**: Ming's `[Laughter]` works; `[laughter]` does not (upstream cookbook: tags are case-sensitive, brackets required). Test tags at exact casing.
- **CDN glue is not `import()`-able when served as `text/plain`**: HF resolve-cache serves JS with a non-module MIME type. Fetch the source and re-host via Blob URL (`new Blob([text], { type: 'text/javascript' })` + dynamic import), then revoke. Applies to any future CDN-hosted wasm-bindgen glue.
- **Worker `new URL()` depth**: adapters live two levels below `src/` — the worker constructor needs `../../../workers/<name>/worker.ts`, not `../../`. A wrong depth serves the SPA fallback HTML and fails with a MIME error at runtime (typecheck cannot catch it).

## 5. Verification Workflows

- **Inference Suite Tests**: `pnpm -F @proj-airi/stage-ui test run src/libs/inference/`
- **Cache & registry tests**: `src/libs/inference/cache-utils.test.ts` (trio + eviction + detail-map per engine; fake OPFS handles in-file)
- **Worker/adapter unit tests**: `src/libs/inference/adapters/kokoro.test.ts`, `src/workers/kokoro/constants.test.ts`, `src/stores/providers/moss-audio-utils.test.ts`
- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Playback claims**: listening on the affected app/output route; never claim audio quality from tests alone.

### Authoritative Design & Architecture Documents

- [docs/analysis-pocket-tts-viability.md](docs/analysis-pocket-tts-viability.md) — Pocket TTS browser architecture & implementation index.
- [docs/research-moss-tts-nano-report.md](docs/research-moss-tts-nano-report.md) — MOSS-TTS-Nano ONNX graph structure & browser integration ground truth.
- [docs/proposal-moss-tts-nano-provider-unified-webgpu.md](docs/proposal-moss-tts-nano-provider-unified-webgpu.md) — MOSS first-class provider proposal (superseded by implementation where they disagree).
- [docs/analysis-gpt-sovits-onnx-webgpu-viability.md](docs/analysis-gpt-sovits-onnx-webgpu-viability.md) — GPT-SoVITS & MOSS browser viability retrospective (WASM+cache breakthrough, integration checklist).
- [docs/analysis-ming3-tts-viability.md](docs/analysis-ming3-tts-viability.md) — Ming browser WASM integration (comparison matrix, preset paradigm, voice-design persistence, phased rollout).
- [docs/analysis-audio8-tts-viability.md](docs/analysis-audio8-tts-viability.md) — Evaluated-but-rejected candidate (documents the bar a new engine must clear).
- [docs/feat-audio-studio.md](docs/feat-audio-studio.md) — VoiceProfiles & Universal Speech Transformer (engine-agnostic wrapper layer).
- [docs/blueprint-tts-universal-speech-transformer.md](docs/blueprint-tts-universal-speech-transformer.md) — UST rule definitions (per-engine sanitizers live with their adapters instead).

## Related Skills & References

- **Key Documents**: [[analysis-pocket-tts-viability]], [[research-moss-tts-nano-report]], [[proposal-moss-tts-nano-provider-unified-webgpu]], [[analysis-gpt-sovits-onnx-webgpu-viability]], [[analysis-ming3-tts-viability]], [[analysis-audio8-tts-viability]], [[feat-audio-studio]], [[blueprint-tts-universal-speech-transformer]]

Base directory for this skill: file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/.agents/skills/airi-local-tts-engines
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.

<skill_files>

</skill_files>
