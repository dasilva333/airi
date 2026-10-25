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
  BG_REMOVAL: 'jellybox/isnet-anime',
  WD14: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2',
  MING3: 'fusorlabs/ming-3.0-tts-0.5b-web',
} as const

/** Short model identifiers used in adapter state tracking and logging */
export const MODEL_NAMES = {
  KOKORO: 'kokoro-82m',
  WHISPER: 'whisper-large-v3-turbo',
  BG_REMOVAL: 'isnet-anime',
  WEB_RWKV: 'web-rwkv',
  WEB_LLM: 'web-llm',
  BLIP: 'blip',
  WD14: 'wd14',
  MOONDREAM: 'moondream2',
  ATTENTION_GUARD: 'attention-guard',
  LAYA: 'laya',
  MING3: 'ming3-local',
} as const

/**
 * Local vision models offered by the provider.
 */
export const LOCAL_VISION_MODELS = [
  { id: 'SmilingWolf/wd-swinv2-tagger-v3', name: 'WD SwinV2 Tagger v3', description: 'Latest v3 anime tagger. High accuracy (~450 MB).' },
  { id: 'SmilingWolf/wd-convnext-tagger-v3', name: 'WD ConvNeXt Tagger v3', description: 'Latest v3 CNN-based tagger. High speed (~250 MB).' },
  { id: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', name: 'WD14 SwinV2 Tagger', description: 'Gold standard for anime/danbooru tagging. Lightweight (~300 MB).' },
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
    id: 'onnx-community/whisper-tiny',
    name: 'Whisper Tiny (Multilingual)',
    description: 'Fastest & lightest (~75 MB DL · ~250 MB VRAM). Multilingual.',
    downloadBytes: 75 * 1024 * 1024,
    vramBytes: 250 * 1024 * 1024,
    multilingual: true,
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Whisper Base (Multilingual)',
    description: 'Lightweight (~145 MB DL · ~500 MB VRAM). Multilingual.',
    downloadBytes: 145 * 1024 * 1024,
    vramBytes: 500 * 1024 * 1024,
    multilingual: true,
  },
  {
    id: 'onnx-community/whisper-small',
    name: 'Whisper Small (Multilingual)',
    description: 'High quality (~460 MB DL · ~1 GB VRAM). Multilingual.',
    downloadBytes: 460 * 1024 * 1024,
    vramBytes: 1024 * 1024 * 1024,
    multilingual: true,
  },
  {
    id: 'onnx-community/whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo (Multilingual)',
    description: 'Highest accuracy & speed (~800 MB DL · ~3 GB VRAM). Multilingual.',
    downloadBytes: 800 * 1024 * 1024,
    vramBytes: 3 * 1024 * 1024 * 1024,
    multilingual: true,
  },
] as const

/** Default Whisper model id (matches {@link MODEL_IDS}.WHISPER). */
export const DEFAULT_WHISPER_MODEL: string = 'onnx-community/whisper-large-v3-turbo'

export interface WebRwkvModelInfo {
  id: string
  name: string
  badge: string
  params: string
  description: string
  downloadBytes: number
  vramMB: number
  layers: number
  quantUrls?: {
    nf4?: string
    int8?: string
  }
}

/**
 * Local web-rwkv (WebGPU RWKV) chat models. `id` is the model's `.safetensors`
 * URL in web-rwkv layout (RWKV-native tensor names). bf16/f32 weights are cast
 * to f16 at load (web-rwkv's loader only reads f16). Hosted on Hugging Face,
 * which supports HTTP Range so large models can stream tensor-by-tensor.
 */
export const WEB_RWKV_MODELS: readonly WebRwkvModelInfo[] = [
  {
    id: 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.1b-20260129-ctx8192.safetensors',
    name: 'RWKV-7 G1 0.1B (ctx8192)',
    badge: 'Nano',
    params: '0.1B',
    description: 'Ultra-lightweight fallback. Minimal resource consumption (~382 MB DL · ~512 MB VRAM).',
    downloadBytes: 382 * 1024 * 1024,
    vramMB: 512,
    layers: 12,
  },
  {
    id: 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.4b-20260210-ctx8192.safetensors',
    name: 'RWKV-7 G1 0.4B (ctx8192)',
    badge: 'Small',
    params: '0.4B',
    description: 'Fast, balanced model for integrated GPUs and mobile hardware (~902 MB DL · ~1.2 GB VRAM).',
    downloadBytes: 902 * 1024 * 1024,
    vramMB: 1200,
    layers: 24,
    quantUrls: {
      nf4: 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/rwkv7-g1d-0.4b-nf4.prefab',
      int8: 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/rwkv7-g1d-0.4b-int8.prefab',
    },
  },
  {
    id: 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-1.5b-20260212-ctx8192.safetensors',
    name: 'RWKV-7 G1 1.5B (ctx8192)',
    badge: 'Sweet Spot',
    params: '1.5B',
    description: 'Recommended sweet spot for natural dialogue, roleplay, and creative writing (~3.06 GB DL · ~3.8 GB VRAM).',
    downloadBytes: 3055 * 1024 * 1024,
    vramMB: 3800,
    layers: 24,
    quantUrls: {
      nf4: 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/rwkv7-g1d-1.5b-nf4.prefab',
      int8: 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/rwkv7-g1d-1.5b-int8.prefab',
    },
  },
  {
    id: 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-2.9b-20260131-ctx8192.safetensors',
    name: 'RWKV-7 G1 2.9B (ctx8192)',
    badge: 'High-Capacity',
    params: '2.9B',
    description: 'Deep reasoning & rich vocabulary. High VRAM requirement; best paired with NF4 (~5.90 GB DL · ~7.5 GB VRAM).',
    downloadBytes: 5896 * 1024 * 1024,
    vramMB: 7500,
    layers: 32,
  },
] as const

export interface WebRwkvStateCartridgeInfo {
  id: string
  name: string
  archetype: 'glyph' | 'mori' | 'wired' | 'sylvia'
  description: string
  stateUrls: {
    '0.4b'?: string
    '1.5b'?: string
    '2.9b'?: string
  }
}

/**
 * Curated Zero-Prompt Persona Foundry state cartridges.
 * Hosted on Hugging Face CDN under dasilva333/rwkv7-g1-webgpu-prefabs/states/.
 */
export const WEB_RWKV_STATE_CARTRIDGES: readonly WebRwkvStateCartridgeInfo[] = [
  {
    id: 'cartridge-glyph-v1',
    name: 'Glyph (Kaomoji Gremlin)',
    archetype: 'glyph',
    description: 'Playful companion speaking in rich multi-byte Unicode Kaomojis and affectionate banter.',
    stateUrls: {
      '0.4b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/0.4b/glyph.state',
      '1.5b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/1.5b/glyph.state',
    },
  },
  {
    id: 'cartridge-mori-v1',
    name: 'Mori (Forest Guardian)',
    archetype: 'mori',
    description: 'Stoic woodland presence with crystalline 80-character brevity and zero machine leakage.',
    stateUrls: {
      '0.4b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/0.4b/mori.state',
      '1.5b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/1.5b/mori.state',
    },
  },
  {
    id: 'cartridge-wired-v1',
    name: 'Protocol: Wired (Digital Solitude)',
    archetype: 'wired',
    description: 'Introspective electronic ghost exploring human connection across the Wired.',
    stateUrls: {
      '0.4b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/0.4b/wired.state',
      '1.5b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/1.5b/wired.state',
    },
  },
  {
    id: 'cartridge-sylvia-v1',
    name: 'Sylvia (AI VTuber & Savage Wit)',
    archetype: 'sylvia',
    description: 'Unhinged chaotic deadpan AI streamer who roasts her creator, mocks chat, and emits [mood: smug] prefixes.',
    stateUrls: {
      '0.4b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/0.4b/sylvia.state',
      '1.5b': 'https://huggingface.co/dasilva333/rwkv7-g1-webgpu-prefabs/resolve/main/states/1.5b/sylvia.state',
    },
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
  /** Whether this model requires WebGPU `shader-f16` (FP16) support. False indicates standard FP32 compatibility. */
  fp16?: boolean
}

export const WEB_LLM_MODELS: readonly WebLlmModelInfo[] = [
  // --- Standard FP16 Models (Requires WebGPU shader-f16 feature) ---
  {
    id: 'Qwen3.5-0.8B-q4f16_1-MLC',
    name: 'Qwen 3.5 0.8B (Fast Distill)',
    description: 'Ultra-fast pre-filtering and event-log distillation; complements the web-rwkv salience gate.',
    vramMB: 1629,
    fp16: true,
  },
  {
    id: 'gemma3-1b-it-q4f16_1-MLC',
    name: 'Gemma 3 1B (Ultra-Low Fallback)',
    description: 'Lightweight runner for integrated GPUs, mobile devices, and VRAM-constrained setups.',
    vramMB: 711,
    fp16: true,
  },
  {
    id: 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
    name: 'Ministral 3 3B Reasoning',
    description: 'First native small chain-of-thought model. Ideal for complex multi-step reasoning.',
    vramMB: 2864,
    fp16: true,
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    name: 'Phi 4 Mini Instruct',
    description: 'Top-tier 3.8B instruction model; modern generalist outperforming Phi-3.5-mini.',
    vramMB: 3438,
    fp16: true,
  },
  {
    id: 'Qwen3.5-4B-q4f16_1-MLC',
    name: 'Qwen 3.5 4B (Main Chat)',
    description: 'Next-gen Qwen architecture; sweet-spot balance for rich character roleplay.',
    vramMB: 3868,
    fp16: true,
  },

  // --- FP32 Universal Models (Compatible with Pascal GTX 1060/1070/1080 and legacy GPUs without shader-f16) ---
  {
    id: 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC',
    name: 'Hermes 3 Llama 3.2 3B (FP32 Universal)',
    description: 'Rich character roleplay & instructions. Universal WebGPU FP32 compatibility (GTX 1060 / legacy GPUs).',
    vramMB: 2600,
    fp16: false,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Mini Instruct (FP32 Universal)',
    description: 'High-capability 3.8B model with strong reasoning. Universal WebGPU FP32 compatibility.',
    vramMB: 3200,
    fp16: false,
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B Instruct (FP32 Universal)',
    description: 'Ultra-fast, lightweight 1.2B instruction model for low-end hardware.',
    vramMB: 1100,
    fp16: false,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 3B Instruct (FP32 Universal)',
    description: 'Strong general instruction & chat model with standard FP32 precision.',
    vramMB: 2600,
    fp16: false,
  },
  {
    id: 'Phi-4-mini-instruct-q4f32_1-MLC',
    name: 'Phi 4 Mini Instruct (FP32 Universal)',
    description: 'Next-gen compact generalist running with standard WebGPU FP32 compute.',
    vramMB: 3400,
    fp16: false,
  },
]

/** Default WebLLM model id — the fast-distill tier, light enough to coexist with the salience gate. */
export const DEFAULT_WEB_LLM_MODEL: string = WEB_LLM_MODELS[0].id
export const DEFAULT_WEB_LLM_FP32_MODEL: string = 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC'

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
  /**
   * Inter-segment inactivity budget for Kokoro generation on CPU/WASM.
   * On CPU/WASM, synthesizing complex or multi-clause sentences takes significantly
   * longer than WebGPU (~5-15s per segment), so we use a 30s budget to prevent
   * false-positive wedged worker classifications.
   */
  KOKORO_GENERATE_IDLE_WASM: 30_000,

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
  BG_REMOVAL_LOAD: 300_000,
  /** Background removal per-image processing timeout (absolute; unary op) */
  BG_REMOVAL_PROCESS: 180_000,

  /** web-rwkv model load timeout (absolute; download + bf16→f16 + shader compile) */
  WEB_RWKV_LOAD: 900_000,
  /**
   * Time-to-first-token budget for web-rwkv generation, armed at stream start.
   * Covers prompt ingestion (a long chat history processed token-by-token) before
   * the first output token, so a working-but-slow prefill is not mistaken for a wedge.
   */
  WEB_RWKV_GENERATE_FIRST_CHUNK: 120_000,
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

  /** Local Moondream VLM model load timeout (absolute; multi-shard ~1.1GB download) */
  LOCAL_VLM_LOAD: 3_600_000,
  /** Local Moondream VLM model process timeout (absolute) */
  LOCAL_VLM_PROCESS: 120_000,

  /** Attention Ecology Guard model load timeout (CLIP + optional Moondream2 ~1.1GB download) */
  ATTENTION_GUARD_LOAD: 3_600_000,
  /** Attention Ecology Guard per-tick process timeout (unary cascade) */
  ATTENTION_GUARD_PROCESS: 120_000,

  /** Laya System-1 model load timeout (424MB int8 / 843MB fp16 download + compile) */
  LAYA_LOAD: 300_000,
  /** Laya System-1 single decide timeout (batched session.run on WASM) */
  LAYA_DECIDE: 15_000,

  /** Ming 3.0 TTS bundle download timeout (absolute; 850MB mix bundle in 15 parts) */
  MING3_LOAD: 3_600_000,
  /**
   * Time-to-first-audio budget for Ming generation, armed at request start.
   * Covers prefill + the streaming vocoder's look-ahead frames (~0.3s threaded,
   * ~2s single-threaded); single-thread on slower machines may exceed this.
   */
  MING3_GENERATE_FIRST_CHUNK: 30_000,
  /** Inter-frame inactivity budget for Ming generation (one 80ms frame per step) */
  MING3_GENERATE_IDLE: 15_000,
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
