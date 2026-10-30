/**
 * Global GPU resource coordinator singleton.
 *
 * Lazily initialized with detected VRAM from WebGPU capabilities.
 * All inference adapters should use this coordinator to track
 * their GPU memory allocations.
 */

import type { GpuExecutor } from './gpu-executor'
import type { GPUResourceCoordinator } from './gpu-resource-coordinator'

import { getCachedWebGPUCapabilities } from '@proj-airi/stage-shared/webgpu'

import { MODEL_NAMES } from './constants'
import { createGpuExecutor } from './gpu-executor'
import { createGPUResourceCoordinator } from './gpu-resource-coordinator'

let coordinator: GPUResourceCoordinator | null = null
let gpuExecutor: GpuExecutor | null = null

/**
 * Get the global GPU resource coordinator.
 * Initializes lazily from cached WebGPU capabilities.
 */
export function getGPUCoordinator(): GPUResourceCoordinator {
  if (!coordinator) {
    const capabilities = getCachedWebGPUCapabilities()
    const estimatedVRAM = capabilities?.estimatedVRAM ?? 0
    coordinator = createGPUResourceCoordinator(estimatedVRAM)

    // Log memory pressure events
    coordinator.onMemoryPressure((level) => {
      const usage = coordinator!.getUsage()
      console.warn(
        `[GPU] Memory pressure: ${level} — `
        + `${Math.round(usage.allocated / 1024 / 1024)}MB / ${Math.round(usage.budget / 1024 / 1024)}MB `
        + `(models: ${usage.models.join(', ')})`,
      )
    })
  }

  return coordinator
}

/**
 * Get the global GPU executor.
 * Serializes GPU-bound loads and inference at concurrency 1 so overlapping
 * VRAM-intensive kernels can't exhaust VRAM and crash a GPU context.
 */
export function getGpuExecutor(): GpuExecutor {
  if (!gpuExecutor) {
    gpuExecutor = createGpuExecutor()
  }
  return gpuExecutor
}

// Rough VRAM estimates per model (in bytes) for allocation tracking
export const MODEL_VRAM_ESTIMATES: Record<string, number> = {
  // Kokoro 82M — varies by quantization
  'kokoro-fp32-webgpu': 330 * 1024 * 1024, // ~330 MB
  'kokoro-fp16-webgpu': 165 * 1024 * 1024, // ~165 MB
  'kokoro-fp32': 330 * 1024 * 1024,
  'kokoro-fp16': 165 * 1024 * 1024,
  'kokoro-q8': 82 * 1024 * 1024,
  'kokoro-q4': 41 * 1024 * 1024,
  'kokoro-q4f16': 41 * 1024 * 1024,

  // Whisper large v3 turbo — encoder fp16 + decoder q4
  [MODEL_NAMES.WHISPER]: 800 * 1024 * 1024, // ~800 MB

  // jellybox/isnet-anime — 176 MB fp32 weights + 1024px fp32 activations.
  // Sized from the Metal validation run; re-measure in-app if eviction
  // behavior looks wrong (see docs/design-background-removal-isnet.md).
  [MODEL_NAMES.BG_REMOVAL]: 600 * 1024 * 1024, // ~600 MB peak

  // web-rwkv (WebGPU RWKV) — varies widely by model; conservative estimate
  // covering small chat models (0.1B–0.4B). Larger models under-estimate.
  [MODEL_NAMES.WEB_RWKV]: 512 * 1024 * 1024, // ~512 MB

  // WebLLM (WebGPU transformer) — placeholder only. The adapter passes the
  // model's real `vram_required_MB` from the MLC prebuilt catalog at load time
  // (0.7 GB for gemma3-1b up to ~3.9 GB for Qwen3.5-4B); this is the floor for
  // the smallest tier when no estimate is supplied.
  [MODEL_NAMES.WEB_LLM]: 768 * 1024 * 1024, // ~768 MB

  // Local vision models
  [MODEL_NAMES.BLIP]: 400 * 1024 * 1024, // ~400 MB
  [MODEL_NAMES.WD14]: 300 * 1024 * 1024, // ~300 MB
  [MODEL_NAMES.MOONDREAM]: 700 * 1024 * 1024, // ~700 MB

  // Attention Ecology Guard — CLIP vision + text towers (q8) are always
  // resident; Moondream2 (q4, opt-in Stage-3 captioner) is the heavy partner.
  // Under the proposal §7 1.2GB VRAM cap, the VLM is only loaded when enabled
  // and is released under memory pressure (falling back to OCR summary).
  'attention-guard-clip': 250 * 1024 * 1024, // ~250 MB (vision+text q8)
  'attention-guard-vlm': 700 * 1024 * 1024, // ~700 MB (Moondream2 q4, opt-in)

  // MOSS TTS Nano (fp32 weights + split ONNX graphs + OPFS blobs)
  'moss-tts-nano': 400 * 1024 * 1024, // ~400 MB

  // Pocket TTS (per-language int8 ONNX bundle in OPFS, WASM heap backing —
  // single active language, ~160MB weights + arena)
  'pocket-tts-local': 200 * 1024 * 1024, // ~200 MB

  // Ming 3.0 TTS (850MB mix bundle in OPFS, CPU WASM heap, not WebGPU VRAM —
  // single-threaded-first until cross-origin isolation lands for worker threads)
  'ming3-local': 1500 * 1024 * 1024, // ~1.5 GB (weights + WASM arena)

  // Laya System-1 ModernBERT ONNX — WASM heap backing, freed by worker terminate
  'laya-int8': 750 * 1024 * 1024, // ~750 MB (633MB weights + arena)
  'laya-fp16': 1000 * 1024 * 1024, // ~1 GB (843MB weights + arena)
}

// Phase 0D: this module owns WebGPU device allocators and VRAM priority
// queues — native memory that cannot be hot-swapped. Force a clean window
// reload instead of re-evaluating allocators mid-session. No-op in production.
if (import.meta.hot) {
  import.meta.hot.invalidate('WebGPU coordinator HMR hard reload')
}
