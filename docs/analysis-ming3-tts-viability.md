# Architectural Viability Report: Ming-3.0-tts-0.5B Browser WASM Integration

## Executive Summary

This document evaluates the practical feasibility, architectural friction, and implementation tax of porting **Ming-3.0-tts-0.5B** (via the turnkey browser build `fusorlabs/ming-wasm`) into AIRI as a client-side speech provider.

* **Initial Spec Impression**: ~0.5B parameter dense multilingual TTS (Qwen2.5-0.5B backbone + DiT flow head + streaming vocoder), 7 languages plus Sichuanese/Cantonese dialects, 44.1 kHz output, MIT license, pre-compiled WebAssembly running fully locally with zero network calls after load.
* **Realistic Ground-Truth Assessment**: **6.5 / 10 (Moderate Viability / Medium Integration Tax, Genuine Upside)**.

Unlike Audio8 (4.8/10, "MOSS-grade trench war" with no web runtime), Ming-3.0-tts-0.5B already ships a **working, benchmarked browser runtime**. There is no ONNX graph surgery to reverse-engineer. The friction is architectural fit, not feasibility: it is a **sealed fusor-ai Rust/WASM runtime**, not an `onnxruntime-web` graph, so none of AIRI's unified inference machinery (Eventa protocol, `GpuResourceCoordinator`, `createGpuWorkerHost`, VRAM telemetry) applies. It is 5–10x heavier than Pocket/Kokoro, requires cross-origin isolation for threads, and v0.1 does **not** support voice cloning from a recording — AIRI's core cloning UX.

Field reports (this machine): early run **RTF 1.7 quality / 0.85 fast** (likely 1–2 threads); later OPFS-cached run on `web-threaded-relaxed` · 3 threads · `quality` → **2.40 s audio in 2.4 s · RTF 1.02 · 31 frames · 0 network requests**, model loaded from device in 2.4 s. The 3-thread middle ground sits between the project's 1-thread (~2.1 RTF) and 8-thread (~0.47 RTF) rows — thread count dominates.

---

## 1. The Integration Spectrum: "Pocket vs. MOSS"

To assess developer effort, every candidate TTS model is benchmarked against AIRI's empirical integration history:

```
[TURNKEY / READY RUNTIME] ◄──────────────────────────────► [RAW RESEARCH / UNCHARTED]
       Pocket TTS (~2 Hours)                                   MOSS-TTS-Nano (~4+ Days)
  • Web ONNX graphs pre-packaged                         • No web runtime existed
  • Pre-built WASM SentencePiece                         • Raw Python repo reference only
  • Working browser reference client                     • Reverse-engineered graph split in JS
  • Single-file INT8 models in OPFS                      • Fought incoherent audio for 48h+
  • Transcript-free voice cloning                        • Disjointed codec token state loop
                                        ▲
                                        │
                          Ming-3.0-tts-0.5B (fusor-ai WASM)
                           (~70% toward Pocket side)
```

### Why Ming Is Near the Pocket End

1. **Pre-Existing Web Artifacts**: `fusorlabs/ming-3.0-tts-0.5b-web` on Hugging Face ships a complete 850 MB bundle: `manifest.json` (88 KB, BLAKE3 per part) + 15 `parts/*.bin` shards + `tokenizer.json` (11 MB). No model surgery required.
2. **Reference Client Code**: The Space (`fusorlabs/ming-wasm`, source `github.com/fusor-rs/ming-wasm`, v0.1.0) is a complete working browser app: `engine/worker.js` (module Worker) + `engine/dist/host/loader.js` (build picker, OPFS cache, BLAKE3 verify) + 4 prebuilt runtimes.
3. **Benchmarked, Not Promised**: `benchmarks.md` (2026-10-20, Apple M4 Pro) reports medians of 3 runs with WER, first-audio, load, and memory against the PyTorch reference and Kokoro.js. No guessing.
4. **Sealed Runtime Proof**: The runtime imports no network/storage/clock/entropy capability (fusor-ai import check on every build); the page counts `performance.getEntriesByType('resource')` during synthesis and reports it — always 0.

### Why It Is Not a 2-Hour Pocket Job

1. **Not ONNX, Not `onnxruntime-web`**: The model is compiled to WebAssembly via fusor-ai (Rust). There are no `.onnx` graphs to feed through AIRI's `InferenceSession` stack. A new worker/adapter pair must be authored around the fusor `Runtime` API (`start()` / `step()` / `take_audio()` / `cancel()`), not the standard `load-model` / `run-inference` protocol.
2. **No Unified Inference Fit**: `GpuResourceCoordinator` VRAM budgets, `getLoadQueue()` serialization, device-loss promotion to WASM — none of this applies. Ming uses **CPU WASM memory (~1.2–1.4 GB RSS)**, not GPU VRAM. It needs its own budgeting and its own OOM story.
3. **Thread Gating Is Load-Bearing**: Without worker threads + relaxed SIMD the page is 2–4x slower than real time (see §4). Threads require a cross-origin-isolated page (`COOP: same-origin` + `COEP: require-corp` — the Space sets these as custom headers). AIRI's web/Electron surfaces must be audited for isolation before promising threaded performance.

---

## 2. Deep-Dive: What Ming-3.0-tts-0.5B Actually Is

### 2.1 Upstream Model (Checkpoint Distribution)

Source: `inclusionAI/Ming-3.0-tts-0.5B` (MIT, 3.1k downloads/mo at time of writing). Inference code lives in `github.com/inclusionAI/Ming-3.0-tts`, not in the checkpoint repo.

| Item | Value |
|---|---|
| Architecture | Dense, Qwen2.5-0.5B backbone + DiT flow head + audio tokenizer + speaker encoder + text tokenizer |
| Parameters | 0.5B (5–6x Pocket-TTS-0.1B / Kokoro-82M) |
| Languages | Chinese, English, German, Spanish, French, Korean, Japanese |
| Dialects | Sichuanese, Cantonese |
| Sample rate | 44.1 kHz (AIRI local engines are 24 kHz — resample or dual-rate playback needed) |
| Lineage | Qwen2.5 backbone, CAM++ speaker embeddings, Ming-omni-tts audio tokenizer |
| Python API | `ming_tts.MingTTS` (`TTS`, `FREEFORM`, `VOICE_DESIGN`, `MULTILINGUAL`, `BASIC`, `EMOTION`, `DIALECT`, `IP` tasks) |
| Quality signal | SeedTTS zh WER 0.80% / en 1.58%; NVBench single-event PCER best-in-class on zh; dialect ACC 80–98%; emotion avg 72% (see model card) |

### 2.2 Capabilities Relevant to AIRI

- **Zero-shot voice cloning** (upstream): short reference clip + **verbatim transcript** (`prompt_wav_path` + `prompt_text` + `use_spk_emb`). Transcript-conditioned, like Audio8 — unlike Pocket/MOSS transcript-free cloning.
- **Voice Design from natural language**: `"A calm, deep male narrator with a slow, clear delivery"` → voice. This **is** implemented in ming-wasm v0.1 (`voice: { design: description }`) and is Ming's most AIRI-shaped feature (cf. AnimaDex voice matching).
- **100+ built-in Chinese voices + 5 built-in English voices**; the demo exposes 7 built-in voices (EN + ZH), English + Chinese.
- **14 inline paralinguistic tags** (ZH+EN, any position, bypass text normalization) + explicit emotion / speed / pitch / volume control. **Case-sensitive — brackets required, exact capitalisation** (`cookbooks/instructions.md`): `[Breathing]`, `[Cough]`, `[Sigh]`, `[Laughter]`, `[Uhm]`, `[Surprise-ah]`, `[Surprise-oh]`, `[Dissatisfaction-hnn]`, `[Confirmation-en]`, `[Question-ei]`, `[Question-ah]`, `[Question-en]`, `[Question-oh]`, `[Question-huh]`. Lowercase `[laughter]` is **not** a tag and will not laugh — this is the observed failure mode in the demo. The demo passes `text` raw (trim only, no JS-side stripping), so correctly-cased tags reach the model; tag firing in the WASM build itself is not e2e-verified in this report and should be re-tested as `[Laughter]` before relying on it.
- **Not in v0.1**: voice cloning from a recording ("needs the model's audio encoder and speaker model in the browser"), reference text normalizer for dates/times/abbreviations (read as written; only EN numbers/money/percent/units handled).

### 2.3 The Browser Bundle (What We Would Ship Against)

| Item | Value |
|---|---|
| Bundle repo | `fusorlabs/ming-3.0-tts-0.5b-web` (`https://huggingface.co/fusorlabs/ming-3.0-tts-0.5b-web/resolve/main/`) |
| Total download | **850 MB** (`mix` profile: 4-bit LM+VAE, 7-bit flow head; cf. Pocket ~160 MB, Kokoro ~80 MB) |
| Layout | `manifest.json` + `parts/000.bin`–`014.bin` (~47–153 MB each) + `tokenizer.json` |
| Integrity | BLAKE3 per part, size-checked on every load; bad cache evicted, only `integrity` failures evict |
| Alt profiles | `q7` 1.2 GB all-7-bit; `f32` 4.25 GB parity-only |
| Cache | OPFS dir `ming-tts-parts`, one file per BLAKE3; revisit load ~1.0 s (vs 1.6–1.8 s cold from localhost, real-network first visit dominated by 850 MB) |
| Tensors | 571 entries, `q7b32` weights + `f32` biases/norms (e.g. `agg.blocks.*.ff1.weight` `[4096,1024]`) |

### 2.4 The Runtime (What We Would Integrate With)

- **4 builds** (`engine/dist/`): `web-threaded-relaxed` (best) → `web-threaded` → `web-single-relaxed` → `web-single`. Runtime modules are tiny (~3 MB JS + stub WASM; the model streams in at load). Loader (`loader.js`) probes `crossOriginIsolated && threads > 1` and `WebAssembly.validate(RELAXED_PROBE)` (`i32x4.relaxed_dot_i8x16_i7x16_add_s`), picks best usable, falls back to single-thread with a warning.
- **Worker contract** (`engine/worker.js`): `load({ modelUrl, threads, build })` → streams manifest + parts (`PARALLEL_PARTS = 4`, `PUSH_BYTES = 4 MB`) → `ready({ ms, voices, threads })`; `generate({ text, voice: { builtin } | { design }, preset })` → `plan({ fragments })` → per-macrotask `step()` = **one 80 ms frame** → transferable `Float32Array` PCM → `frame({ fragment, frame, ms })` → `done({ ms, networkRequests })`; `stop()` → `cancel()` between frames.
- **Playback**: page-side `AudioContext({ sampleRate: 44100 })`, streams while generating, starts after ~1.1 s buffered; `Download WAV` exports 16-bit PCM. AIRI's 24 kHz pipeline (Pocket/Kokoro/MOSS) would need a resample stage or dual-rate host.
- **Scale knobs**: `threads` from `?threads=` (default `min(8, cpu-2)`), `?model=` override, `?build=` pin. Presets `quality` (10 CFG Euler steps, matches reference) / `balanced` / `fast` (fewer flow steps; ~30% faster per frame, occasional dropped words — see §4).

### 2.5 The Preset Paradigm (New Stateful Surface)

No current AIRI speech provider has an equivalent: Kokoro / Pocket / MOSS expose model + voice (+ clone audio), never a speed-quality tradeoff dial. Ming's `quality` / `balanced` / `fast` preset changes flow-head sampling steps per frame and therefore RTF, first-audio latency, and (for `fast`) output reliability — it is a **stateful inference parameter**, not a voice choice.

Integration should model it as a first-class stateful field, not a demo-only radio:

- Provider `defaultOptions` gains `preset: 'quality' | 'balanced' | 'fast'` (default `quality`), persisted per provider instance like `model`/`voiceId` and passed through to `generate({ preset })`.
- Because the preset governs global inference cost (CPU time per frame across every synthesis), expose it once globally (provider settings + onboarding `step-speech`) rather than per voice profile — voice profiles keep pointing at the provider, the provider owns the preset.
- Upstream numbers for calibration (M4 Pro, Chrome `web-threaded-relaxed` 8t): `quality` 0.47 → `balanced` 0.45 → `fast` 0.41 RTF; native CLI 8t: 0.28 → 0.24 → 0.20. The browser gains less than native (per-frame host overhead doesn't shrink with the preset). Field data (3 threads, OPFS-cached): `quality` RTF 1.02.

---

## 3. Product & User Experience Tradeoffs

### 3.1 The Genuine Assets: Multilingual + Voice Design + 44.1 kHz

- Ming's only durable differentiator over the local trio is **7-language + dialect synthesis with SOTA-adjacent ZH quality** at 0.5B scale, plus **free-form voice design** ("describe a voice in words") with no reference audio at all. Neither Kokoro (fixed bank), Pocket (EN/FR/ES/DE/IT/PT, no JA/ZH/KO), nor MOSS (ZH/EN) covers this.
- 44.1 kHz output is audibly cleaner than 24 kHz local engines for headphones-forward users — at the cost of ~1.8x PCM bytes per second through the playback path.

### 3.2 Voice Cloning Friction: The AIRI-Shaped Hole

ming-wasm v0.1 explicitly does **not** support cloning from a recording. Upstream needs `prompt_wav + prompt_text + use_spk_emb`, i.e. the Audio8 pattern of **mandatory exact transcripts**. AIRI's Audio Studio / AnimaDex flows assume drop-a-WAV cloning (Pocket/MOSS). Until the audio encoder + speaker model lands in the browser build, Ming cannot serve AIRI's custom-voice path — only built-ins + voice design.

### 3.3 Download, Memory, and CPU Contention Reality

- **850 MB first download** dwarfs Pocket (~160 MB) and Kokoro (~80 MB). OPFS revisit is ~1 s, but first-run onboarding on metered/slow links is a real cost. `ModelCacheManager` + `cache-utils.ts` would need a new OPFS bucket entry alongside `pocket-tts-browser-model-store` / `nano-reader-browser-model-store`.
- **1.21–1.37 GB Chrome RSS** during synthesis (model lives in WASM linear memory). Alongside Live2D/VRM Three.js canvases + Whisper + chat LLM, this is the heaviest local engine AIRI would host — heavier than the ~600–700 MB Audio8 working set and ~10x Kokoro VRAM. WASM (not WebGPU) means no shader-cache thrashing, but very real OOM-eviction risk on 8 GB machines and phones (upstream: "phones not measured; threaded builds reserve 2 GB").
- **Thread count is the whole performance story**: 2.1–4.0 RTF single-threaded on M4 Pro; field data points at 3 threads `web-threaded-relaxed` → RTF 1.02 (`quality`, 2.40 s audio in 2.4 s, 31 frames, 0 network requests, 2.4 s OPFS-cached load); 8-thread threaded-relaxed → 0.41–0.47. Shipping Ming without guaranteed cross-origin isolation means shipping a ~2x-slower-than-real-time engine to a large share of users — the threads-gate in §5 is non-negotiable.

---

## 4. Comprehensive Comparison Matrix

| Evaluation Dimension | **Kokoro** (82M) | **Pocket TTS** (Kyutai 0.1B) | **MOSS-TTS-Nano** (0.1B) | **Audio8-TTS Preview** (0.1B) | **Ming-3.0-tts-0.5B** (fusor WASM) |
|---|---|---|---|---|---|
| **AIRI Integration Status** | **Production Core** | **Production Core** | **Production Core (WASM)** | **Evaluated Candidate** | **Evaluated Candidate (this report)** |
| **Implementation Effort** | Minimal (`kokoro-js`) | ~2 h (turnkey ONNX) | ~4 d (grueling port) | Est. 4–5 d (high risk) | **Est. 3–5 d (new adapter, no graph port)** |
| **Web Runtime Baseline** | Proven NPM package | Proven Web ONNX + demo | None (custom authored) | None (Python scripts) | **Proven fusor Rust/WASM app + benchmarks** |
| **Model Footprint** | ~82M (~80 MB) | ~100M (~160 MB) | ~100M (~400 MB) | ~290M (~600 MB–1 GB) | **~500M (~850 MB mix / 1.2 GB q7)** |
| **Memory at Synthesis** | ~330 MB VRAM | ~200–300 MB WASM | ~400–500 MB WASM | ~600–700 MB (est.) | **~1.2–1.4 GB WASM RSS** |
| **Latency / Throughput (M4 Pro, Chrome)** | ~150 ms TTFB | ~200 ms TTFB (~6x RT) | ~400 ms TTFB (~1.8x RT) | n/a | **~300 ms first audio / 0.47 RTF quality-8t; 2.15 RTF 1t; field 3t quality RTF 1.02 (OPFS-cached, 0 net reqs)** |
| **Cloning Requirement** | N/A (fixed bank) | Reference WAV only | Reference WAV only | Reference WAV + exact transcript | **Not in browser v0.1 (upstream: WAV + exact transcript)** |
| **Voice Design (NL description)** | No | No | No | No | **Yes (built-in + design)** |
| **Languages** | EN, JA (limited) | EN, FR, ES, DE, IT, PT | ZH, EN | ZH, EN, JA, KO, DE, ES, FR, IT, NL, PL | **ZH, EN, DE, ES, FR, KO, JA + SC/Cantonese** |
| **Output Rate** | 24 kHz | 24 kHz | 24 kHz (codec) | 44.1 kHz | **44.1 kHz (resample needed for AIRI path)** |
| **License** | Apache-2.0 | CC-BY-NC / research-gated | Apache-ish / research | Research preview | **MIT (model + ming-wasm)** |
| **Viability Score** | **9.5 / 10** | **9.0 / 10** | **6.5 / 10 (post-hoc 7.8)** | **4.8 / 10** | **6.5 / 10** |

Benchmark sources: `benchmarks.md` medians (M4 Pro, S1, mix bundle) — native CLI 8t quality RTF 0.28 / fast 0.20; Chrome `web-threaded-relaxed` 8t quality **0.47** (38 ms/frame), `balanced` 0.45, `fast` 0.41; `web-threaded` 0.76; `web-single-relaxed` 2.15; `web-single` 3.97; Kokoro.js fp32 0.39 / q8 0.71 for scale. WER 0 everywhere except `fast` dropping trailing words on one seed. Field reports from this machine: early run 1.7 quality / 0.85 fast (likely 1–2 threads); later OPFS-cached run (`web-threaded-relaxed` · 3 threads · `quality`): `2.40 s of audio in 2.4 s · RTF 1.02 · 31 frames · 0 network requests`, model from device in 2.4 s — the 3-thread middle ground between the project's 1t and 8t rows. Preset paradigm (§2.5) has no equivalent in Kokoro/Pocket/MOSS: `preset` must be a persisted stateful provider field (default `quality`), controlled globally rather than per voice.

---

## 5. Architectural Verdict & Actionable Guidance

### Verdict: **PILOT AS OPT-IN `ming3-local` PROVIDER (threads-gated), NOT A DEFAULT ENGINE**

Ming-3.0-tts-0.5B is the strongest evaluated-but-unintegrated candidate since MOSS — a real MIT-licensed browser runtime with reproducible benchmarks, voice design, and best-in-class ZH/dialect coverage. It earns a pilot. It does not earn default status: 850 MB, 1.3 GB RSS, no browser voice cloning, 44.1 kHz path work, and a hard cross-origin-isolation dependency make it an enthusiast engine, not a Kokoro replacement.

### Sensible Integration Shape (No ONNX Tax)

Do **not** route this through `onnxruntime-web`. Integrate the fusor runtime as-is behind a thin AIRI adapter:

1. **New provider `ming3-local`** in `packages/stage-ui/src/stores/providers/registry/speech.ts` (alongside `kokoro-local` / `pocket-tts-local` / `moss-nano-local`), reusing the `speech()` provider shape: `listModels` → `ming-3.0-tts-0.5b-mix` (+ `q7` opt-in); `listVoices` → built-ins + `★` starter + `design` pseudo-voice opening the description box; `loadModel` → `loader.startRuntime()` + `loadParts()` with progress.
2. **New worker `packages/stage-ui/src/workers/ming3/worker.ts`** speaking a minimal `load / generate / stop` contract to `engine/worker.js` semantics (one `step()` per macrotask keeps `stop`/cancel responsive); adapter `packages/stage-ui/src/libs/inference/adapters/ming3.ts` with mutex + `createGpuWorkerHost`-style TTL unload (but accounting **WASM bytes, not VRAM**).
3. **Gate on isolation**: only offer the provider when `crossOriginIsolated === true` and `WebAssembly.validate(RELAXED_PROBE)` passes (or explicitly accept single-thread with a "2x slower than real time" label). Electron must send COOP/COEP; web must document the header requirement.
4. **Provider registry + local model registry (do both or the model becomes unpurgable — see cautionary tale below)**. The preset is a **global provider-level field** (`defaultOptions.preset`, see §2.5) — one control for all synthesis through the provider, not per voice profile.
   - **Speech registry** (covered in step 1): `ming3-local` in `createSpeechMetadata` (`stores/providers/registry/speech.ts`), settings page `packages/stage-pages/src/pages/settings/providers/speech/ming3-local.vue` with preset radio, thread count, voice-design textarea, download-size warning; i18n keys under `settings.pages.providers.provider.ming3-local`; onboarding `step-speech.vue` entry; `provider-catalog.md` §3 + §9.2 and `project-provider-metadata-catalog.md` speech-table rows.
   - **`libs/inference/cache-utils.ts`** — mirror the MOSS trio verbatim (`MOSS_OPFS_DIR_NAME`, `getMossOpfsCacheSize`, `clearMossOpfsCache`, `isMossModelCached`, cache-utils.ts:7–81):
     - `MING3_OPFS_DIR_NAME = 'ming-tts-parts'` (the loader's `CACHE_DIR`; one OPFS file per BLAKE3 part).
     - `getMing3OpfsCacheSize()` / `clearMing3OpfsCache()` / `isMing3ModelCached()`, then wire into all five aggregation points: `getModelCacheSize()` (:213), `clearModelCache()` (:262), `clearSingleModelCache()` — new `modelId === 'ming3-local'` branch next to the `'moss-tts-nano'` branch (:286), `isModelCached()` — same next to :761, `getDetailedModelCacheMap()` — `result['ming3-local']` block next to the MOSS block (:849–857). Miss any one and the widget lies (size total wrong, per-row purge dead, or row stuck on "Not Cached").
   - **`ModelCacheManager.vue` `knownModels`** — audio-section row next to `moss-tts-nano` (:91–98): `{ id: 'ming3-local', name: 'Ming 3.0 TTS 0.5B', category: 'audio', runtime: 'WASM / OPFS', description: '…7-language + dialect neural TTS with voice design, ~850 MB' }`. The widget keys rows, status, and the per-row trash button off this id via `clearSingleModelCache(modelId)` → `refresh()`.
   - **`libs/inference/coordinator.ts`** — memory-budget entry next to `'moss-tts-nano': 400MB` (:98–99), sized for the WASM heap (~850 MB weights, ~1.2–1.4 GB RSS), so pressure telemetry and LRU eviction account for Ming even though it is CPU/WASM rather than WebGPU VRAM.
   - **`libs/inference/constants.ts`** — `MODEL_IDS.MING3` (`fusorlabs/ming-3.0-tts-0.5b-web`), `MODEL_NAMES` entry, and `TIMEOUTS` load/generate budgets next to the `KOKORO_*` entries (:335–362); the 850 MB first download needs a longer load timeout than Kokoro's 120 s.
   - **Cautionary tale (why this is in the plan, not post-implementation)**: `pocket-tts-local` shipped with *no* cache-utils trio and *no* `knownModels` row — grep finds zero `pocket` mentions in both files. Result: its ~160 MB OPFS store (`pocket-tts-browser-model-store`) is invisible to Model Cache Oversight, reports no size, and can only be removed via Clear All. Ming at 850 MB must not repeat this; registry + cache wiring lands in the same PR as the provider.
5. **Audio path**: resample 44.1 → 24 kHz at the adapter boundary if reusing the sentence-sync player, or run the 44.1 kHz host path natively. Keep `transformTextForSpeech` UST behavior unchanged; Ming has no `<|...|>` control-token conflict (unlike Higgs).
6. **Cloning later**: when upstream ships the browser audio encoder, add `promptAudioWaveform`-style conditioning mirroring `moss-audio-utils.ts` / `pocket-audio-utils.ts` (`prompt_audio_codes` pattern). Until then, label cloning "upstream pending".

### The Zero-Port Alternative

If browser-cache/COOP work stalls, ship Ming as a **native sidecar first**: `ming serve`/`ming say` behind the existing generic **OpenAI-Compatible Speech Provider** (`/v1/audio/speech`, cf. `design-openai-compatible-tts.md`) or `airi-audio-server`-style registration. This captures 100% of Ming's voices/quality with zero browser port cost — at the price of a local binary instead of a tab.

### Open Questions

- Thread availability across AIRI's actual surfaces (desktop Electron with COOP/COEP? web? pocket?) — measure `chooseBuild()` outcomes per surface before promising 0.5 RTF.
- 44.1 kHz vs 24 kHz sentence-sync path — resample in adapter vs native-rate player?
- 850 MB OPFS quota + BYOS backup exclusion (model shards must never enter the sync outbox).
- `fast`-preset word drops (upstream WER note) — default to `quality`, offer `fast` with a reliability label.

---

## Relevant Skills & References

- [[airi-audio-pipeline]]
- [[airi-local-inference-engines]]
- [[analysis-pocket-tts-viability]]
- [[analysis-gpt-sovits-onnx-webgpu-viability]]
- Upstream model: `https://huggingface.co/inclusionAI/Ming-3.0-tts-0.5B`
- Browser bundle: `https://huggingface.co/fusorlabs/ming-3.0-tts-0.5b-web`
- Space source (cloned for this report): `https://github.com/fusor-rs/ming-wasm` / `https://huggingface.co/spaces/fusorlabs/ming-wasm`
- Benchmarks: `benchmarks.md` in ming-wasm (`native 8t quality RTF 0.28`, `Chrome threaded-relaxed 8t quality RTF 0.47`, `single-relaxed 2.15`)
