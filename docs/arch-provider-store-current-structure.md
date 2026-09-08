# Provider Store Current Structure

## Purpose

This document is the quick-reference guide for how `packages/stage-ui/src/stores/providers.ts` and its supporting modules are structured today following the Phase 1–5 restructuring.

Read this first if you need to work on the provider store.

For historical migration and handoff context, see:
- `docs/archive/project-provider-store-phase1-handoff.md` through `phase5-handoff.md`
- `docs/project-provider-store-restructuring-plan.md`
- `docs/project-codex-provider-restructuring-plan.md`

---

## What `providers.ts` Does Today

`packages/stage-ui/src/stores/providers.ts` is the runtime orchestration store (~392 lines). The old 3,000-line monolith has been decomposed into dedicated modules.

`providers.ts` coordinates:

- Multi-instance state and persistence projections (`runtime/instance-store.ts`)
- Provider runtime state and reactive validation (`runtime/validation.ts`)
- Provider instance caching and disposal (`runtime/instances.ts`)
- Registry composition (`registry/index.ts`)
- Computed selectors and model queries (`selectors/`)
- UI-facing derived provider lists for the stage application

---

## Architecture & Module Seams

### 1. Pure Definition Layer (`packages/stage-ui/src/libs/providers/`)
Completely decoupled from Pinia, UI, and `vue-i18n`:
- `types.ts` — Framework-agnostic contracts (`ProviderDefinition`, `ProviderInstance`, `ProviderTranslationFn`).
- `providers/registry.ts` — Central registry mapping IDs to `ProviderDefinition`s.
- `providers/<id>/index.ts` — Modular cloud provider schemas (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, etc.).
- `validators/run.ts` — Generic config and connectivity validation plan execution.

### 2. Specialized Modality Registries (`packages/stage-ui/src/stores/providers/registry/`)
- `speech.ts` — Speech (TTS) provider metadata and voice catalogs (Kokoro, Pocket TTS, MOSS TTS, ElevenLabs, Azure, Polly, etc.).
- `transcription.ts` — Speech-to-text (STT) metadata and Whisper model catalog.
- `local-engines.ts` — In-browser local WebGPU/WASM engines (Web-RWKV, WebLLM, BLIP Local, Apple Core AI).
- `chat-local.ts` — Self-hosted chat servers (vLLM, Player2).
- `index.ts` — Registry composer merging modular definitions with modality registries.

### 3. Runtime Orchestration (`packages/stage-ui/src/stores/providers/runtime/`)
- `instance-store.ts` — Multi-instance storage engine, IndexedDB persistence, legacy key alias migration (`api_key` → `apiKey`), and strict credential fallback handling.
- `instances.ts` — SDK client instantiation, caching, and fail-fast unconfigured provider guards.
- `validation.ts` — Validation runner, IPC reporting, toast notification, and debounced credential checking.

### 4. Selectors & Derived State (`packages/stage-ui/src/stores/providers/selectors/`)
- `config.ts` — `isProviderConfigured(providerId)` with strict credential presence checking.
- `models.ts` — Normalized model resolution and capabilities querying.
- `voices.ts` — Dynamic voice catalog filtering and formatting.

### 5. Local Hardware & Inference Coordination (`packages/stage-ui/src/libs/inference/`)
- `gpu-resource-coordinator.ts` — Estimated VRAM budget accounting, memory pressure telemetry, WebGPU device locks, and LRU worker eviction.
- `cache-utils.ts` — Storage inspection and model cache eviction across OPFS, CacheStorage, and Native App Sandbox.
- `constants.ts` — Model IDs, repo paths, timeout budgets, and catalog specifications.

---

## Runtime Flow

1. Initialize `useInstanceStore()`: loads multi-instance configurations from storage and runs legacy migration.
2. Build the unified provider registry via `createProviderRegistry(t, ...)`.
3. Set up reactive runtime state for added and configured providers.
4. Auto-validate configured providers on change via `createProviderValidation()`.
5. Create, cache, and dispose SDK instances on demand via `createProviderInstances()`.
6. Expose derived metadata, categories, and model selectors to UI surfaces.

---

## Relevant Skills

- [[airi-provider-core-registry]]
- [[airi-provider-store-instances]]
- [[airi-provider-ui-pages]]
- [[airi-local-inference-engines]]
