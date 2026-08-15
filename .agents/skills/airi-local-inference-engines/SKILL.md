---
name: airi-local-inference-engines
description: >-
  Use when managing local WebGPU & WASM inference engines in AIRI (Kokoro TTS worker, Whisper STT worker, WebLLM worker, Web-RWKV worker), worker message protocols, load queues, or GpuResourceCoordinator VRAM pressure telemetry.
---

# AIRI Local Inference Engines (WebGPU & WASM)

This skill provides comprehensive guidelines and exact code paths for local browser-side inference workers using WebGPU, WASM, ONNX Runtime Web, and WebLLM.

## 1. Overview & Surface Map

AIRI executes local neural models directly in the browser via dedicated Web Worker threads:
- **Kokoro TTS Worker**: Local neural speech synthesis (`packages/stage-ui/src/workers/kokoro/`).
- **Whisper STT Worker**: Local speech-to-text inference with Eventa server streaming (`packages/stage-ui/src/libs/workers/worker.ts`, adapter at `packages/stage-ui/src/libs/inference/adapters/whisper.ts`, provider `whisper-local`).
- **WebLLM Worker**: Local LLM text generation (`packages/stage-ui/src/workers/web-llm/`).
- **Web-RWKV Worker**: Local RWKV-7 RNN model execution (`packages/stage-ui/src/workers/web-rwkv/`).

VRAM allocation, hardware feature detection, and worker load queues are coordinated by `GpuResourceCoordinator`.

## 2. Key Code Paths

### Protocol & Coordinator
- `packages/stage-ui/src/libs/inference/gpu-resource-coordinator.ts` — `GpuResourceCoordinator`. Manages VRAM allocation telemetry, WebGPU device locks, and worker eviction under VRAM pressure.
- `packages/stage-ui/src/libs/inference/protocol.ts` — Message protocol schemas (`load-model`, `run-inference`, `progress`, `unload`).
- `packages/stage-ui/src/libs/inference/adapters/` — Thin UI adapters bridging Pinia stores to underlying Web Workers (e.g. `whisper.ts`, `blip.ts`).

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
2. Implement standard worker protocol handling (`load-model`, `run-inference`, `progress`, `error`) or Eventa streaming contracts.
3. Add a thin adapter in `packages/stage-ui/src/libs/inference/adapters/` and register with `GpuResourceCoordinator`.

### 2. Handling Model Shard Downloads
- Report download progress events via `progress` messages containing `loadedBytes` and `totalBytes` so UI progress bars update smoothly (e.g. in Onboarding V2 Step 1 & Step 2).

## 4. Known Pitfalls & Failure Modes

- **WebGPU Memory Leaks**: Failing to call `.destroy()` on `GPUBuffer` or ONNX `InferenceSession` objects during worker reload causes VRAM exhaustion and browser tab crashes.
- **Worker Script Bundling**: Worker scripts must be bundled with Vite using `new Worker(new URL('...', import.meta.url), { type: 'module' })` to support cross-origin worker loading.

## 5. Verification Workflows

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
- [docs/moss-tts-nano-research-report.md](docs/moss-tts-nano-research-report.md) — MOSS TTS nano research report.
