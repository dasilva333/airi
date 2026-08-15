/**
 * Centralized constants for the inference pipeline.
 *
 * Model IDs, timeout values, and retry parameters shared across
 * all adapters and workers.
 */

// ---------------------------------------------------------------------------
// Model IDs
// ---------------------------------------------------------------------------

/** HuggingFace model repository identifiers */
export const MODEL_IDS = {
  KOKORO: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  WHISPER: 'onnx-community/whisper-large-v3-turbo',
  BG_REMOVAL: 'Xenova/modnet',
  BLIP: 'onnx-community/blip-image-captioning-base',
  WD14: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2',
} as const

/** Short model identifiers used in adapter state tracking and logging */
export const MODEL_NAMES = {
  KOKORO: 'kokoro-82m',
  WHISPER: 'whisper-large-v3-turbo',
  BG_REMOVAL: 'modnet',
  WEB_RWKV: 'web-rwkv',
  WEB_LLM: 'web-llm',
  BLIP: 'blip',
  WD14: 'wd14',
  ATTENTION_GUARD: 'attention-guard',
} as const

/**
 * Local vision models offered by the provider.
 */
export const LOCAL_VISION_MODELS = [
  { id: 'SmilingWolf/wd-swinv2-tagger-v3', name: 'WD SwinV2 Tagger v3', description: 'Latest v3 anime tagger. High accuracy (~450 MB).' },
  { id: 'SmilingWolf/wd-convnext-tagger-v3', name: 'WD ConvNeXt Tagger v3', description: 'Latest v3 CNN-based tagger. High speed (~250 MB).' },
  { id: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', name: 'WD14 SwinV2 Tagger', description: 'Gold standard for anime/danbooru tagging. Lightweight (~300 MB).' },
  { id: 'onnx-community/blip-image-captioning-base', name: 'BLIP Base', description: 'Prose description model (~250 MB).' },
  { id: 'onnx-community/blip2-opt-2.7b', name: 'BLIP-2 OPT-2.7B', description: 'High-quality prose description model (~2.7B parameters, heavy download).' },
] as const

export const DEFAULT_LOCAL_VISION_MODEL: typeof LOCAL_VISION_MODELS[number]['id'] = 'SmilingWolf/wd-swinv2-tagger-v3'

/**
 * Whisper models the local transcription provider offers. The `id` is the
 * Hugging Face repo passed straight to the worker's load request, so no id↔repo
 * mapping is needed. Larger = more accurate but slower / bigger download.
 */
export interface WhisperModelInfo {
  id: string
  name: string
  description: string
  downloadBytes: number
  vramBytes: number
  multilingual?: boolean
}

export const WHISPER_MODELS: readonly WhisperModelInfo[] = [
  {
    id: 'onnx-community/whisper-tiny.en',
    name: 'Whisper Tiny (English)',
    description: 'Fastest & lightest (~40 MB DL · ~250 MB VRAM). English only.',
    downloadBytes: 40 * 1024 * 1024,
    vramBytes: 250 * 1024 * 1024,
    multilingual: false,
  },
  {
    id: 'onnx-community/whisper-base.en',
    name: 'Whisper Base (English)',
    description: 'Lightweight (~80 MB DL · ~500 MB VRAM). English only.',
    downloadBytes: 80 * 1024 * 1024,
    vramBytes: 500 * 1024 * 1024,
    multilingual: false,
  },
  {
    id: 'onnx-community/whisper-small.en',
    name: 'Whisper Small (English)',
    description: 'Balanced speed & quality (~250 MB DL · ~1 GB VRAM). English only.',
    downloadBytes: 250 * 1024 * 1024,
    vramBytes: 1024 * 1024 * 1024,
    multilingual: false,
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo',
    description: 'Highest accuracy & multilingual (~800 MB DL · ~3 GB VRAM).',
    downloadBytes: 800 * 1024 * 1024,
    vramBytes: 3 * 1024 * 1024 * 1024,
    multilingual: true,
  },
] as const

/** Default Whisper model id (matches {@link MODEL_IDS}.WHISPER). */
export const DEFAULT_WHISPER_MODEL: string = 'onnx-community/whisper-large-v3-turbo'

/**
 * Local web-rwkv (WebGPU RWKV) chat models. `id` is the model's `.safetensors`
 * URL in web-rwkv layout (RWKV-native tensor names). bf16/f32 weights are cast
 * to f16 at load (web-rwkv's loader only reads f16). Hosted on Hugging Face,
 * which supports HTTP Range so large models can stream tensor-by-tensor.
 */
export const WEB_RWKV_MODELS = [
  {
    id: 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.1b-20260129-ctx8192.safetensors',
    name: 'RWKV-7 G1 0.1B (ctx8192)',
    description: 'Tiny RWKV-7 "World" chat model (~190 MB). Downloads on first use; bf16→f16 at load.',
  },
] as const

/** Default web-rwkv model URL. */
export const DEFAULT_WEB_RWKV_MODEL: string = WEB_RWKV_MODELS[0].id

/**
 * Curated WebLLM (`@mlc-ai/web-llm` ^0.2.84) WebGPU transformer chat models.
 * `id` is the MLC `model_id` resolved against `prebuiltAppConfig.model_list`
 * (the npm-pinned source of truth for compatible `model_lib` WASM binaries);
 * `vramMB` is the catalog's `vram_required_MB` used for the pre-allocation
 * bookkeeping check. Each ships a verified `*_cs1k-webgpu.wasm` on MLC's CDN.
 *
 * Tier order matches the proposal's top-5 curation (reasoning → main chat →
 * distill → modern generalist → ultra-low fallback).
 */
export interface WebLlmModelInfo {
  id: string
  name: string
  description: string
  vramMB: number
}

export const WEB_LLM_MODELS: readonly WebLlmModelInfo[] = [
  {
    id: 'Qwen3.5-0.8B-q4f16_1-MLC',
    name: 'Qwen 3.5 0.8B (Fast Distill)',
    description: 'Ultra-fast pre-filtering and event-log distillation; complements the web-rwkv salience gate.',
    vramMB: 1629,
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    name: 'Gemma 3 1B (Ultra-Low Fallback)',
    description: 'Lightweight runner for integrated GPUs, mobile devices, and VRAM-constrained setups.',
    vramMB: 711,
  },
  {
    id: 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
    name: 'Ministral 3 3B Reasoning',
    description: 'First native small chain-of-thought model. Ideal for complex multi-step reasoning.',
    vramMB: 2864,
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    name: 'Phi 4 Mini Instruct',
    description: 'Top-tier 3.8B instruction model; modern generalist outperforming Phi-3.5-mini.',
    vramMB: 3438,
  },
  {
    id: 'Qwen3.5-4B-q4f16_1-MLC',
    name: 'Qwen 3.5 4B (Main Chat)',
    description: 'Next-gen Qwen architecture; sweet-spot balance for rich character roleplay.',
    vramMB: 3868,
  },
]

/** Default WebLLM model id — the fast-distill tier, light enough to coexist with the salience gate. */
export const DEFAULT_WEB_LLM_MODEL: string = WEB_LLM_MODELS[0].id

// ---------------------------------------------------------------------------
// Timeouts (ms)
// ---------------------------------------------------------------------------

export const TIMEOUTS = {
  /** Kokoro model load timeout (absolute; download/compile may be slow) */
  KOKORO_LOAD: 120_000,
  /**
   * Time-to-first-segment budget for Kokoro generation, armed at stream start.
   * Covers warmup + synthesizing the first sentence (slow on the fp32/CPU path),
   * so a working-but-slow first segment is not mistaken for a wedged worker.
   * See {@link createIdleTimeout}.
   */
  KOKORO_GENERATE_FIRST_CHUNK: 30_000,
  /**
   * Inter-segment inactivity budget for Kokoro generation, used after the first
   * segment proves the worker alive. A mid-stream wedge is caught within this
   * gap and the worker is restarted.
   *
   * Tighter than the first-chunk budget: once the model is warm, per-sentence
   * segments arrive in well under a second on WebGPU (and a few seconds on the
   * slow WASM/CPU path), so a 5s silence reliably means a wedged worker rather
   * than slow-but-progressing synthesis. Raise it if very long sentences on slow
   * CPU/WASM hardware trip false-positive restarts.
   */
  KOKORO_GENERATE_IDLE: 5_000,

  /** Whisper model load timeout (absolute; larger model, allow more time) */
  WHISPER_LOAD: 180_000,
  /**
   * Time-to-first-output budget for Whisper transcription, armed at stream
   * start. Covers encoding the audio + the first decoded token, so a slow
   * initial encode is not mistaken for a wedged worker.
   */
  WHISPER_TRANSCRIBE_FIRST_CHUNK: 30_000,
  /**
   * Inter-token inactivity budget for Whisper transcription, used after the
   * first progress item. Whisper streams tokens frequently, so a mid-stream
   * wedge is caught quickly.
   */
  WHISPER_TRANSCRIBE_IDLE: 10_000,

  /** Background removal model load timeout (absolute) */
  BG_REMOVAL_LOAD: 120_000,
  /** Background removal per-image processing timeout (absolute; unary op) */
  BG_REMOVAL_PROCESS: 60_000,

  /** web-rwkv model load timeout (absolute; download + bf16→f16 + shader compile) */
  WEB_RWKV_LOAD: 300_000,
  /**
   * Time-to-first-token budget for web-rwkv generation, armed at stream start.
   * Covers prompt ingestion (a long chat history processed token-by-token) before
   * the first output token, so a working-but-slow prefill is not mistaken for a wedge.
   */
  WEB_RWKV_GENERATE_FIRST_CHUNK: 60_000,
  /**
   * Inter-token inactivity budget for web-rwkv generation, used after the first
   * token proves the worker alive. RWKV streams tokens steadily, so a mid-stream
   * wedge is caught within this gap.
   */
  WEB_RWKV_GENERATE_IDLE: 15_000,

  /** WebLLM model load timeout (absolute; multi-GB weight download + shader compile) */
  WEB_LLM_LOAD: 600_000,
  /**
   * Time-to-first-token budget for WebLLM generation, armed at stream start.
   * Covers prefill of the full chat history before the first decoded token.
   */
  WEB_LLM_GENERATE_FIRST_CHUNK: 60_000,
  /**
   * Inter-token inactivity budget for WebLLM generation, used after the first
   * token proves the worker alive. Decoding streams steadily (~39 tok/s), so a
   * mid-stream wedge is caught within this gap.
   */
  WEB_LLM_GENERATE_IDLE: 15_000,

  /** Local vision model load timeout (absolute) */
  LOCAL_VISION_LOAD: 300_000,
  /** Local vision model process timeout (absolute) */
  LOCAL_VISION_PROCESS: 90_000,

  /** Attention Ecology Guard model load timeout (CLIP + optional Moondream2) */
  ATTENTION_GUARD_LOAD: 300_000,
  /** Attention Ecology Guard per-tick process timeout (unary cascade) */
  ATTENTION_GUARD_PROCESS: 120_000,
} as const

// ---------------------------------------------------------------------------
// Restart / Retry
// ---------------------------------------------------------------------------

/** Maximum number of automatic worker restarts before giving up */
export const MAX_RESTARTS = 3

/** Base delay in ms between restart attempts (multiplied by attempt number) */
export const RESTART_DELAY_MS = 1_000

// ---------------------------------------------------------------------------
// Device loss resilience
// ---------------------------------------------------------------------------

/**
 * Number of WebGPU device-loss events an adapter tolerates before proactively
 * promoting subsequent loads to WASM. A single device loss may be transient
 * (driver reset, GPU process crash), but repeated losses indicate the WebGPU
 * path is unreliable on this device and WASM is safer.
 */
export const DEVICE_LOSS_WASM_THRESHOLD = 2
