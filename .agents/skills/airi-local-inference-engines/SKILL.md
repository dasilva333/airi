---
name: airi-local-inference-engines
description: >-
  Load/debug local WebGPU/WASM inference workers: Kokoro, Whisper, WebLLM, Web-RWKV, worker protocols, model load queues, GpuResourceCoordinator, VRAM pressure. Provider definitions use airi-provider-core-registry.
---

# AIRI Local Inference Engines (WebGPU & WASM)

This skill provides comprehensive guidelines and exact code paths for local browser-side inference workers using WebGPU, WASM, ONNX Runtime Web, and WebLLM.

## 1. Overview & Surface Map

AIRI executes local neural models directly in the browser via dedicated Web Worker threads:
- **Kokoro TTS Worker**: Local neural speech synthesis (`packages/stage-ui/src/workers/kokoro/`).
- **Whisper STT Worker**: Local speech-to-text inference with Eventa server streaming (`packages/stage-ui/src/libs/workers/worker.ts`, adapter at `packages/stage-ui/src/libs/inference/adapters/whisper.ts`, provider `whisper-local`).
- **WebLLM Worker**: Local LLM text generation (`packages/stage-ui/src/workers/web-llm/`).
- **Web-RWKV Worker**: Local RWKV-7 RNN model execution (`packages/stage-ui/src/workers/web-rwkv/`).
- **Apple Core AI Bridge**: Hardware-accelerated speculative dialogue and on-device vision via Apple Neural Engine (ANE) and Metal (`NativeAI` bridge).

VRAM budget accounting, WebGPU hardware feature detection, memory pressure telemetry, and worker load queues are coordinated by `GpuResourceCoordinator`.

## 2. Key Code Paths

### Protocol & Coordinator
- `packages/stage-ui/src/libs/inference/gpu-resource-coordinator.ts` — `GpuResourceCoordinator`. Manages estimated VRAM budget accounting, WebGPU device locks, memory pressure telemetry, and LRU worker eviction.
- `packages/stage-ui/src/libs/inference/gpu-worker-host.ts` — `createGpuWorkerHost`. Resilient single-tenant worker lifecycle wrapper: manages lazy worker creation, exclusive execution locks (`runExclusive`), shared GPU priority execution slots (`runOnGpu`), device-loss telemetry, exponential restart backoff, and **GPU OOM circuit breaker**.
- `packages/stage-ui/src/libs/inference/protocol.ts` — Message protocol schemas, error classification (`classifyError`), and worker error sanitization (`serializeWorkerError`).
- `packages/stage-ui/src/libs/inference/adapters/web-llm-channel.ts` — Single-owner WebLLM coordinator using `airi:inference:web-llm` BroadcastChannel. Elects `mainWindow` as Inference Leader to prevent duplicate VRAM allocation across multiple Electron renderers.
- `packages/stage-ui/src/libs/inference/adapters/` — Thin UI adapters bridging Pinia stores to underlying Web Workers (e.g. `whisper.ts`, `blip.ts`, `web-llm.ts`).

### Local Worker Locations
- `packages/stage-ui/src/workers/kokoro/` — Kokoro WASM/WebGPU TTS worker implementation.
- `packages/stage-ui/src/libs/workers/worker.ts` — Eventa WebGPU/WASM Whisper STT worker.
- `packages/stage-ui/src/workers/web-llm/` — WebLLM (TVM WebGPU) worker implementation.
- `packages/stage-ui/src/workers/web-rwkv/` — Web-RWKV WebGPU worker implementation.

### Related Specs
- `docs/design-local-whisper-stt.md` — Comprehensive design doc for Local Whisper STT engine, Eventa worker, GPU queuing, and single-tenant cache.
- `docs/proposal-built-in-llm-webgpu.md` — Technical proposal and harness specification for WebGPU local inference.

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

## 4. Known Pitfalls & Failure Modes

- **Web Worker `DataCloneError`**: WebGPU error objects (`GPUPipelineError`, `GPUOutOfMemoryError`, `DOMException`) cannot be serialized by browser `structuredClone`. Always pass them through `serializeWorkerError(err)` before posting or throwing across thread boundaries.
- **Multi-Renderer VRAM Duplication**: Spawning local LLM engines in multiple Electron renderer windows duplicates model weights in VRAM (~4 GB each), causing GPU OOM on 8 GB cards. Always route requests through the single-owner leader (`web-llm-channel.ts`).
- **OOM Reload Storms**: Never blindly restart a worker after `GPUOutOfMemoryError`. `GpuWorkerHost` halts restarts on OOM; downstream callers must handle the rejection and offer smaller models or manual retries.
- **WebGPU Memory Leaks**: Failing to call `.destroy()` on `GPUBuffer` or ONNX `InferenceSession` objects during worker reload causes VRAM exhaustion and browser tab crashes.
- **Worker Script Bundling**: Worker scripts must be bundled with Vite using `new Worker(new URL('...', import.meta.url), { type: 'module' })` to support cross-origin worker loading.

## 5. Verification Workflows

- **Inference Suite Tests**: `pnpm -F @proj-airi/stage-ui test run src/libs/inference/`
- **Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`
- **Hardware Check**: Test WebGPU availability in DevTools console via `navigator.gpu.requestAdapter()`.

### Authoritative Design & Architecture Documents

- [docs/design-local-whisper-stt.md](docs/design-local-whisper-stt.md) — Local Whisper Speech-to-Text (STT) architecture and unified WebGPU design.
- [docs/proposal-built-in-llm-webgpu.md](docs/proposal-built-in-llm-webgpu.md) — WebGPU local inference harness specification.
- [docs/proposal-attention-ecology-local-webgpu-guard.md](docs/proposal-attention-ecology-local-webgpu-guard.md) — Attention ecology local WebGPU salience guard.
- [docs/proposal-toggle4-rework-and-rwkv-harness.md](docs/proposal-toggle4-rework-and-rwkv-harness.md) — Toggle4 rework and RWKV harness proposal.
- [docs/project-rwkv-kimi.md](docs/project-rwkv-kimi.md) — RWKV Kimi project.
- [docs/project-rwkv-cleanroom-harness-plan.md](docs/project-rwkv-cleanroom-harness-plan.md) — RWKV cleanroom harness plan.
- [docs/proposal-moss-tts-nano-provider-unified-webgpu.md](docs/proposal-moss-tts-nano-provider-unified-webgpu.md) — MOSS TTS nano provider unified WebGPU proposal.
- [docs/research-moss-tts-nano-report.md](docs/research-moss-tts-nano-report.md) — MOSS TTS nano research report.

## Related Skills & References

- **Key Documents**: [[design-local-whisper-stt]], [[proposal-built-in-llm-webgpu]], [[proposal-attention-ecology-local-webgpu-guard]], [[proposal-toggle4-rework-and-rwkv-harness]], [[project-rwkv-kimi]], [[project-rwkv-cleanroom-harness-plan]], [[proposal-moss-tts-nano-provider-unified-webgpu]], [[research-moss-tts-nano-report]]
