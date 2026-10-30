---
name: airi-local-inference-engines
description: >-
  Load/debug local WebGPU/WASM inference workers: Whisper STT, WebLLM, Web-RWKV,
  Moondream VLM, embeddings search worker, Laya & OpenJev System-1 decisions,
  worker protocols, model load queues, GpuResourceCoordinator, VRAM pressure.
  Local TTS engines use airi-local-tts-engines; provider definitions use
  airi-provider-core-registry; retrieval semantics use airi-memory-retrieval-engine.
---

# AIRI Local Inference Engines (WebGPU & WASM)

This skill provides comprehensive guidelines and exact code paths for local browser-side inference workers using WebGPU, WASM, ONNX Runtime Web, and WebLLM.

## 1. Overview & Surface Map

AIRI executes local neural models directly in the browser via dedicated Web Worker threads:
- **Local TTS engines (Kokoro, Pocket TTS, MOSS-TTS-Nano, Ming)**: owned end-to-end by [airi-local-tts-engines](../airi-local-tts-engines/SKILL.md) — workers, adapters, voice-clone profiles, per-language bundles, cache eviction. This skill is not their owner; it provides only the shared machinery below.
- **Whisper STT Worker**: Local speech-to-text inference with Eventa server streaming (`packages/stage-ui/src/libs/workers/worker.ts`, adapter at `packages/stage-ui/src/libs/inference/adapters/whisper.ts`, provider `whisper-local`).
- **WebLLM Worker**: Local LLM text generation (`packages/stage-ui/src/workers/web-llm/`).
- **Web-RWKV Worker**: Local RWKV-7 RNN model execution (`packages/stage-ui/src/workers/web-rwkv/`).
- **Moondream VLM Worker**: Local 1.6B vision-language model inference (`packages/stage-ui/src/workers/moondream/`, adapter at `packages/stage-ui/src/libs/inference/adapters/moondream.ts`, provider `moondream-local`).
- **Search Embedding Worker**: Local text-embedding engine behind memory retrieval (`packages/stage-ui/src/libs/workers/search/search.worker.ts`, loader at `packages/stage-ui/src/libs/workers/search/index.ts`). Currently `Xenova/bge-small-en-v1.5` via `pipeline('feature-extraction')`; migrating to the EmbeddingGemma 2 text backbone — see `docs/design-embedding-provider-support.md`.
- **Laya & OpenJev System-1 Workers**: Local non-autoregressive decision engines behind the `laya-local` and `openjev-local` System-1 providers (`packages/stage-ui/src/workers/laya/worker.ts`: ModernBERT ONNX via `onnxruntime-web`, WASM/WebGPU EPs). Weights pinned in `libs/inference/laya-models.ts`: Laya 421M (`LAYA_MODEL_SPECS`: int8 `bgoldfarb93/laya-int8` 633MB, fp16 `onnx-community/laya-ONNX` 847MB) and OpenJev 151M (`OPENJEV_MODEL_SPECS`: int8 `heman10x/rlcd-modernbert-151m` ~155MB, fp16 `heman10x/rlcd-modernbert-151m-fp16` ~300MB). Dynamic feed handling in `worker.ts` detects required inputs (`input_ids` and `attention_mask` for OpenJev vs 5-feed `marker_pos/marker_mask/qtype` for Laya). Cache Storage namespaces: `laya-cache` and `openjev-cache` with isolated eviction in `libs/inference/cache-utils.ts` and `ModelCacheManager.vue`. The standard-pattern citizen: `createGpuWorkerHost` + `runOnGpu` + VRAM estimates (see adapter below).
- **Apple Core AI Bridge**: Hardware-accelerated speculative dialogue and on-device vision via Apple Neural Engine (ANE) and Metal (`NativeAI` bridge).

> **Ownership boundary:** this skill owns worker model loading, VRAM allocation, device fallback, and load serialization — including the embedding worker and the Laya worker. Local TTS engines are expressly excluded; see airi-local-tts-engines. Ranking, memory layers, candidate fusion, and query analysis belong to `airi-memory-retrieval-engine`; triage/rerank policy and the OpenRouter Decisions path belong to `airi-jev-decision-engine`; prefix formatting and embedding cache invalidation live at the worker boundary per `docs/design-embedding-provider-support.md` §7–§8.

VRAM budget accounting, WebGPU hardware feature detection, memory pressure telemetry, and worker load queues are coordinated by `GpuResourceCoordinator`.

## 2. Key Code Paths

### Protocol & Coordinator
- `packages/stage-ui/src/libs/inference/gpu-resource-coordinator.ts` — `GpuResourceCoordinator`. Manages estimated VRAM budget accounting, WebGPU device locks, memory pressure telemetry, and LRU worker eviction.
- `packages/stage-ui/src/libs/inference/gpu-worker-host.ts` — `createGpuWorkerHost`. Resilient single-tenant worker lifecycle wrapper: manages lazy worker creation, exclusive execution locks (`runExclusive`), shared GPU priority execution slots (`runOnGpu`), device-loss telemetry, exponential restart backoff, and **GPU OOM circuit breaker**.
- `packages/stage-ui/src/libs/inference/protocol.ts` — Message protocol schemas, error classification (`classifyError`), and worker error sanitization (`serializeWorkerError`).
- `packages/stage-ui/src/libs/inference/adapters/web-llm-channel.ts` — Single-owner WebLLM coordinator using `airi:inference:web-llm` BroadcastChannel. Elects `mainWindow` as Inference Leader to prevent duplicate VRAM allocation across multiple Electron renderers.
- `packages/stage-ui/src/libs/inference/adapters/` — Thin UI adapters bridging Pinia stores to underlying Web Workers (e.g. `whisper.ts`, `blip.ts`, `web-llm.ts`).

### Local Worker Locations
- `packages/stage-ui/src/libs/workers/worker.ts` — Eventa WebGPU/WASM Whisper STT worker.
- `packages/stage-ui/src/workers/web-llm/` — WebLLM (TVM WebGPU) worker implementation.
- `packages/stage-ui/src/workers/web-rwkv/` — Web-RWKV WebGPU worker implementation.
- `packages/stage-ui/src/workers/moondream/` — Moondream2 (`Xenova/moondream2`) WebGPU/WASM VLM worker (`Moondream1ForConditionalGeneration`). Adapter at `packages/stage-ui/src/libs/inference/adapters/moondream.ts`, chat provider with `/chat/completions` interception at `packages/stage-ui/src/stores/providers/moondream/index.ts`.
- `packages/stage-ui/src/libs/workers/search/` — Search embedding worker (`search.worker.ts`: ONNX embedder, in-memory embedding + BM25 caches, `MAX_WORKER_DOCUMENTS = 600` FIFO cap) and loader (`index.ts`: serialized load via `getGpuExecutor().run()` at `GPU_PRIORITY.BG_REMOVAL_LOAD + 1`, VRAM allocation via `getGPUCoordinator().requestAllocation()` — ~100MB BGE-small, ~185MB post-migration — `updateInferenceStatus` keys). **Exception path**: predates `createGpuWorkerHost` — raw `Worker` + `callWorker` RPC with AbortSignal, so no OOM circuit breaker or TTL unload; memory is bounded by the FIFO doc cap plus coordinator-level LRU eviction.
- `packages/stage-ui/src/workers/laya/worker.ts` — Laya & OpenJev System-1 ONNX worker (direct `onnxruntime-web` session, int8/fp16 precision switch, threaded-WASM config with SAB-gated `numThreads`, Eventa `inference:laya:*` contract in `libs/inference/contract.ts`, dynamic session feed resolution). Adapter at `packages/stage-ui/src/libs/inference/adapters/laya.ts` (the reference `createGpuWorkerHost` integration: `runOnGpu` with `GPU_PRIORITY.LAYA_LOAD` / `LAYA_DECIDE`, `TIMEOUTS.LAYA_LOAD/DECIDE`, `MODEL_VRAM_ESTIMATES`, `updateInferenceStatus`); facade at `packages/stage-ui/src/libs/inference/laya-engine.ts`; selected via `laya-local` and `openjev-local` providers in `stores/modules/system-one.ts`. Decision policy itself belongs to `airi-jev-decision-engine`.

### Related Specs
- `docs/design-local-whisper-stt.md` — Comprehensive design doc for Local Whisper STT engine, Eventa worker, GPU queuing, and single-tenant cache.
- `docs/design-openjev-system1-local-integration.md` — Technical specification, live in-app benchmarks, and cache architecture for OpenJev (151M) on-device decision engine.
- `docs/proposal-built-in-llm-webgpu.md` — Technical proposal and harness specification for WebGPU local inference.
- `docs/design-embedding-provider-support.md` — Embedding backend migration (BGE-small → EmbeddingGemma 2): §7 prefix catalog, §8 exhaustive BGE-mark checklist.

## 3. Core SOPs & Guidelines

### 1. Registering a New Local Inference Worker
1. Place the worker entry script under `packages/stage-ui/src/workers/<name>/` or `packages/stage-ui/src/libs/workers/`.
2. Wrap the worker using `createGpuWorkerHost` in the adapter to inherit single-tenant lifecycle management, GPU slot locking (`runOnGpu`), device-loss telemetry, and OOM circuit breaking.
3. Catch all worker errors and serialize them with `serializeWorkerError(error)` before re-throwing or posting to avoid `DataCloneError`.
4. Add a thin adapter in `packages/stage-ui/src/libs/inference/adapters/` and register with `GpuResourceCoordinator`.

### 2. Multi-Window Inference & Single-Owner Leader Architecture
In Electron or multi-tab web, each BrowserWindow or tab possesses an isolated V8 heap.
- **Do not** instantiate independent heavy WebGPU models in secondary renderers (Chat, Dating Sim, Onboarding, Memory).
- Use the single-owner BroadcastChannel pattern (`web-llm-channel.ts`): the primary stage window (`mainWindow`) acts as the Inference Leader and hosts the physical Web Worker / GPUDevice. Secondary windows connect as clients, forwarding `loadModel` and `generate` calls over `BroadcastChannel`.

### 3. GPU Out-of-Memory (OOM) Circuit Breaker
- When an OOM occurs, `classifyError()` marks it as `OOM`.
- `GpuWorkerHost` transitions `phase = 'error'`, sets `isOom = true`, tears down the dead worker, and **halts** `scheduleRestart()`.
- Automatic restart loops after an OOM create an expensive reload storm that repeatedly crashes WebGPU device contexts.
- Subsequent calls while in `isOom` immediately reject with `GPUOutOfMemoryError`.
- To recover, call `host.reset()`, which frees tokens, re-arms the error guard, and resets `isOom = false`.

### 4. Linux WebGPU & Driver Configuration
- In Chromium/Electron, `app.commandLine.appendSwitch('enable-features', ...)` calls must be joined as a single comma-separated string (e.g. `'SharedArrayBuffer,Vulkan'`). Calling `appendSwitch` repeatedly clobbers prior features.
- On Linux with NVIDIA GPUs, Dawn gates `shader-f16` behind `vulkan_enable_f16_on_nvidia`. Without `app.commandLine.appendSwitch('enable-dawn-features', 'vulkan_enable_f16_on_nvidia')`, WGSL shaders with `enable f16;` fail with fatal compile error `extension 'f16' is not allowed in the current environment`.

### 5. Handling Model Shard Downloads
- Report download progress events via `progress` messages containing `loadedBytes` and `totalBytes` so UI progress bars update smoothly (e.g. in Onboarding).

### 6. Automated VRAM Eviction & Standby Hibernation
- **Active LRU Eviction Under Pressure**: `GpuResourceCoordinator` maintains an advisory budget (`estimatedVRAM * 0.70`). When total allocation reaches `CRITICAL_THRESHOLD = 0.95`, the coordinator invokes `getLRUModel()` to evict the oldest inactive model before an unrecoverable `GPUOutOfMemoryError` occurs.
- **Inactivity TTL Countdown**: `createGpuWorkerHost` manages an inactivity timer (default: 15 minutes). If no new inference requests arrive within the TTL window, the worker triggers `.unload()` and releases its `AllocationToken`.
- **Desktop Deep Standby Coordination**: When Electron `powerMonitor` signals extended lock (>10m) or OS `suspend`, background neural workers unmount.
- **Manifest Retention & Fast Re-hydration**: Unloaded workers retain their `lastLoadManifest` (`quantization`, `device`, `modelId`). When the user resumes interaction, the adapter executes `ensureLoaded()` from local OPFS/browser cache, re-mounting the pipeline in < 2s without network overhead. Full spec in `docs/design-vram-eviction-and-standby-hibernation.md`.

## 4. Known Pitfalls & Failure Modes

- **Web Worker `DataCloneError`**: WebGPU error objects (`GPUPipelineError`, `GPUOutOfMemoryError`, `DOMException`) cannot be serialized by browser `structuredClone`. Always pass them through `serializeWorkerError(err)` before posting or throwing across thread boundaries.
- **Multi-Renderer VRAM Duplication**: Spawning local LLM engines in multiple Electron renderer windows duplicates model weights in VRAM (~4 GB each), causing GPU OOM on 8 GB cards. Always route requests through the single-owner leader (`web-llm-channel.ts`).
- **OOM Reload Storms**: Never blindly restart a worker after `GPUOutOfMemoryError`. `GpuWorkerHost` halts restarts on OOM; downstream callers must handle the rejection and offer smaller models or manual retries.
- **WebGPU Memory Leaks**: Failing to call `.destroy()` on `GPUBuffer` or ONNX `InferenceSession` objects during worker reload causes VRAM exhaustion and browser tab crashes.
- **Worker Script Bundling**: Worker scripts must be bundled with Vite using `new Worker(new URL('...', import.meta.url), { type: 'module' })` to support cross-origin worker loading.
- **Transformers.js AutoModel Class Gap**: `AutoModelForVision2Seq` in `@huggingface/transformers` does not support `moondream1` architecture directly (`Unsupported model type: moondream1`). It must be instantiated via direct class load: `Moondream1ForConditionalGeneration.from_pretrained(modelId, { dtype: { embed_tokens: 'fp32', vision_encoder: 'q8', decoder_model_merged: 'q4' } })`.
- **Web-RWKV In-Browser Quantization (`from_reader` vs `from_prefab`)**: In-browser on-the-fly quantization (`quantize_mat_int8.wgsl`, `quantize_mat_nf4.wgsl` via `Session.from_reader()`) corrupts weights due to WebGPU buffer synchronization race conditions. The WGSL matrix multiplication kernels are healthy; deliver quantized models via pre-quantized CBOR `.prefab` files (`Session.from_prefab()`), saving 38%–58% download size and VRAM with 5s load times. See `docs/design-web-rwkv-quantization-architecture.md`.
- **Embedding Model Swaps Invalidate Cached Vectors**: 384d BGE vectors vs 256d Gemma vectors silently score 0 on dimension mismatch — both `cosineSimilarity` copies (`search.worker.ts`, `hybrid-scorer.ts`) `return 0`, never throw. Gate reuse on the snapshot header + prefix version and never trust stored `entry.embedding` across a model change. Full mark list in `docs/design-embedding-provider-support.md` §8.

## 5. Verification Workflows

- **Inference Suite Tests**: `pnpm -F @proj-airi/stage-ui test run src/libs/inference/`
- **Search Worker Tests** (mocked worker, dim-agnostic): `pnpm -F @proj-airi/stage-ui test run src/libs/search/`
- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Hardware Check**: Test WebGPU availability in DevTools console via `navigator.gpu.requestAdapter()`.

### Authoritative Design & Architecture Documents

- [docs/design-local-whisper-stt.md](docs/design-local-whisper-stt.md) — Local Whisper Speech-to-Text (STT) architecture and unified WebGPU design.
- [docs/proposal-built-in-llm-webgpu.md](docs/proposal-built-in-llm-webgpu.md) — WebGPU local inference harness specification.
- [docs/design-web-rwkv-quantization-architecture.md](docs/design-web-rwkv-quantization-architecture.md) — Web-RWKV local quantization architecture, empirical cleanroom matrix, and prefab distribution pipeline.
- [docs/design-attention-ecology-screen-watching.md](docs/design-attention-ecology-screen-watching.md) — Attention ecology & screen watching local WebGPU / System-1 salience guard.
- [docs/proposal-toggle4-rework-and-rwkv-harness.md](docs/proposal-toggle4-rework-and-rwkv-harness.md) — Toggle4 rework and RWKV harness proposal.
- [docs/project-rwkv-kimi.md](docs/project-rwkv-kimi.md) — RWKV Kimi project.
- [docs/project-rwkv-cleanroom-harness-plan.md](docs/project-rwkv-cleanroom-harness-plan.md) — RWKV cleanroom harness plan.
- [docs/design-vram-eviction-and-standby-hibernation.md](docs/design-vram-eviction-and-standby-hibernation.md) — VRAM eviction, LRU pressure reclamation, and multi-tier standby hibernation specification.
- [docs/design-embedding-provider-support.md](docs/design-embedding-provider-support.md) — Embedding backend migration: provider taxonomy, EmbeddingGemma 2 q4 baseline, prefix catalog, BGE-mark checklist.

## Related Skills & References

- **Key Documents**: [[design-local-whisper-stt]], [[proposal-built-in-llm-webgpu]], [[design-web-rwkv-quantization-architecture]], [[design-attention-ecology-screen-watching]], [[proposal-toggle4-rework-and-rwkv-harness]], [[project-rwkv-kimi]], [[project-rwkv-cleanroom-harness-plan]], [[design-vram-eviction-and-standby-hibernation]], [[design-embedding-provider-support]]
- **TTS engines live next door**: [[airi-local-tts-engines]] owns Kokoro, Pocket TTS, MOSS-TTS-Nano, and Ming workers, adapters, voice profiles, and cache eviction — including the MOSS proposal/research docs.
