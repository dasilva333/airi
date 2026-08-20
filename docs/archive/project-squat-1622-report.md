# Upstream PR #1622 Squatting Report

> [!NOTE]
> This document tracks the surgical integration of PR #1622 (`feat: webgpu-inference-infra`) from `moeru-ai/airi` into `dasilva333/airi`.

## Problem Statement

The goal is to integrate the **WebGPU Inference Infrastructure** and the **Kokoro TTS refactor** from upstream PR #1622 without absorbing over 300 files of unrelated "upstream noise" (component restructurings, UI churn, and CI changes).

Blindly merging PR #1622 would jeopardize local customizations in the Artistry system and the Chatbox/Settings layouts.

## Identified "Spirit" of the Changes

Through initial research, the core logic that defines this PR was isolated:

1. **Inference Pipeline**: `packages/stage-ui/src/libs/inference/`
   - Orchestrates WASM/WebGPU models.
   - Handles GPU resource coordination (VRAM management).
   - Manages inference workers and lifecycle.
2. **WebGPU Utilities**: `packages/stage-shared/src/webgpu/`
   - Capability detection (fp16 support, GPU availability).
3. **Kokoro TTS Adapter**: `packages/stage-ui/src/workers/kokoro/`
   - Transition from a standalone worker to the unified inference adapter pattern.
4. **Provider Integration**: `packages/stage-ui/src/stores/providers.ts`
   - Swapping `getKokoroWorker()` for `getKokoroAdapter()`.
   - Adding WebGPU sensing to the provider's default options and model listing.

## Current Workspace Status

- **Clean-room Sandbox**: `airi-clean-pr`
- **Current Branch**: `feat/squat-1622-inference` (newly created from `fork/main`)
- **Action Plan**: Surgically porting the logic files to the clean-room first for validation before finalizing the squat into the live `airi-rebase-scratch` repo.

## Known Landmines & Bot Feedback (Internal Audit)

Automated reviews from Gemini, Codex, and Copilot identified several "landmines" in the upstream PR. As we squat this surgically, we will apply these fixes immediately rather than just porting the bugs:

### 🛠️ High Priority Fixes

- **Worker Manager Latency**: `waitForWorkerMessage` in `worker-manager.ts` does not reject on `type: 'error'`. We must update this to reject immediately on matching `requestId` to avoid unnecessary timeouts and worker restarts.
- **Stale Voice Logic**: `listVoices` in `providers.ts` skips loading if the adapter is "ready", but it doesn't verify *which* model is loaded. We will add a `loadedModelId` check.
- **State Recovery**: Background removal and other adapters can get stuck in `processing` if an error occurs. We will implement `try...finally` blocks to reset state to `ready`.
- **Export Resolution**: The `package.json` export map in `stage-ui` needs to explicitly expose the `libs/inference/` subpaths to prevent build-time resolution failures in the apps.

### 🧪 Capability & UX Improvements

- **fp16 Capability Filtering**: `kokoroModelsToModelInfo` should filter by `fp16Supported` capability (retrieved from `@proj-airi/stage-shared/webgpu`) so users don't hit "Avoidable Runtime Failures" on non-fp16 hardware.
- **Device Transparency**: Adapters currently assume `webgpu` and report it to the UI immediately. We will update the logic to wait for the worker's `model-ready` response to report the *actual* backend (WebGPU vs WASM fallback).
- **Idle Preloading**: `use-model-preload.ts` claims to use `requestIdleCallback` but uses `setTimeout`. We will align the implementation with the documentation (using `requestIdleCallback` with proper fallbacks).
- **Whisper Hook Restoration**: We will restore `onStart` and `onError` hook calls in the `useWhisper` composable.
- **Provider Fallback Logic**: `handleArtistryTrigger` in `artistry-bridge.ts` hard-defaults to `comfyui`. This must be updated to fall back to the user's globally configured artistry provider to support Replicate/Nano Banana users.
- **Widget Payload Overrides**: `provider.generate` currently discards top-level widget payload fields (e.g. `template`, per-node overrides). These must be included in the `request.extra` payload to support the new ComfyUI instruction flow.

## Findings on Upstream Noise

The full PR branch contains 320+ changes, including:
- Moving components from `packages/ui` and `packages/stage-ui` into subdirectories.
- Global restructuring of the chatbox components.
- Storybook updates and CI workflow churn.

These will be **skipped** to preserve the fork's structural integrity.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
