# Provider & Local Model Catalog

A living, comprehensive index of every inference provider, modality engine, cloud storage adapter, and on-device neural model cached in AIRI.

---

## 1. Architecture Overview

The AIRI provider subsystem is organized across four distinct layers:

1. **Unified Provider Definitions (`packages/stage-ui/src/libs/providers/providers/*`)**
   Standardized definitions utilizing `@xsai-ext/providers` with schema validation, UI metadata, and capability resolvers.
2. **Specialized Modality Registries (`packages/stage-ui/src/stores/providers/registry/*`)**
   Deep domain registries for Speech (TTS), Transcription (STT), Local WebGPU/WASM engines, and Self-Hosted endpoints.
3. **Settings Pages & Additional Modalities (`packages/stage-pages/src/pages/settings/providers/*`)**
   User interface routing and block composition for Chat, Speech, Transcription, Artistry, Vision, Motion, and Cloud Storage.
4. **On-Device Model Cache Oversight (`packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue`)**
   Live cache management widget inspecting weights across Apple CoreML / ANE, Browser OPFS, CacheStorage, and Transformers.js / ONNX.

---

## 2. Chat & LLM Providers

### 2.1 Standard Cloud & Unified Chat Providers
*Defined in `packages/stage-ui/src/libs/providers/providers/`*

| Provider ID | Title | Key File / Directory | Notes & Capabilities |
| :--- | :--- | :--- | :--- |
| `openai` | OpenAI | `libs/providers/providers/openai/` | GPT-4o, GPT-4o-mini, o1, o3-mini |
| `anthropic` | Anthropic | `libs/providers/providers/anthropic/` | Claude 3.5 Sonnet, Claude 3.7 Sonnet |
| `google-generative-ai` | Google Generative AI | `libs/providers/providers/google-generative-ai/` | Gemini 2.5 Flash, Gemini 2.5 Pro, Search Grounding |
| `deepseek` | DeepSeek | `libs/providers/providers/deepseek/` | DeepSeek-V3, DeepSeek-R1 |
| `openrouter-ai` | OpenRouter | `libs/providers/providers/openrouter-ai/` | Multi-provider unified routing |
| `groq` | Groq | `libs/providers/providers/groq/` | Ultra-low latency LPU inference |
| `cerebras-ai` | Cerebras AI | `libs/providers/providers/cerebras-ai/` | Fast inference on CS-3 hardware |
| `together-ai` | Together AI | `libs/providers/providers/together-ai/` | Open-source model cloud hosting |
| `fireworks-ai` | Fireworks AI | `libs/providers/providers/fireworks-ai/` | Optimized open-weights inference |
| `novita-ai` | Novita AI | `libs/providers/providers/novita-ai/` | Cost-effective open-source hosting |
| `featherless-ai` | Featherless AI | `libs/providers/providers/featherless-ai/` | Access to 1,000+ open-source HuggingFace models |
| `mistral-ai` | Mistral AI | `libs/providers/providers/mistral-ai/` | Mistral Large, Codestral, Pixtral |
| `moonshot-ai` | Moonshot AI | `libs/providers/providers/moonshot-ai/` | Kimi long-context LLMs |
| `minimax` | MiniMax | `libs/providers/providers/minimax/` | MiniMax-Text series |
| `alibaba-cloud` | Alibaba Cloud (DashScope) | `libs/providers/providers/alibaba-cloud/` | Qwen-Max, Qwen-Plus, Qwen-Turbo |
| `modelscope` | ModelScope | `libs/providers/providers/modelscope/` | Community model hosting |
| `xai` | xAI (Grok) | `libs/providers/providers/xai/` | Grok-2, Grok-Vision |
| `perplexity-ai` | Perplexity AI | `libs/providers/providers/perplexity-ai/` | Sonar search-grounded reasoning |
| `nvidia` | NVIDIA NIM | `libs/providers/providers/nvidia/` | NVIDIA Cloud Functions |
| `azure-openai` | Azure OpenAI | `libs/providers/providers/azure-openai/` | Enterprise OpenAI deployments |
| `azure-ai-foundry` | Azure AI Foundry | `libs/providers/providers/azure-ai-foundry/` | Azure AI Studio model catalog |
| `amazon-bedrock` | Amazon Bedrock | `libs/providers/providers/amazon-bedrock/` | AWS Bedrock managed models |
| `cloudflare-workers-ai`| Cloudflare Workers AI | `libs/providers/providers/cloudflare-workers-ai/` | Edge serverless AI |
| `302-ai` | 302.AI | `libs/providers/providers/302-ai/` | Pay-as-you-go API aggregator |
| `aihubmix` | AiHubMix | `libs/providers/providers/aihubmix/` | API routing hub |
| `comet-api` | CometAPI | `libs/providers/providers/comet-api/` | Unified API gateway |
| `n1n` | N1N | `libs/providers/providers/n1n/` | High-speed API proxy |
| `opencode-go` | OpenCode Go | `libs/providers/providers/opencode-go/` | Coding-specialized gateway |
| `pollinations` | Pollinations AI (Text) | `libs/providers/providers/pollinations/` | Zero-config free text generation |
| `mimo` | Xiaomi MiMo | `libs/providers/providers/mimo/` | Xiaomi AI models |
| `zai` | Zhipu AI (GLM) | `libs/providers/providers/zai/` | GLM-4 series |

### 2.2 Local, Self-Hosted & On-Device Chat Engines
*Defined in `packages/stage-ui/src/stores/providers/registry/local-engines.ts` & `chat-local.ts`*

| Provider ID | Title | Key File | Runtime / Deployment |
| :--- | :--- | :--- | :--- |
| `web-rwkv` | RWKV (Local, WebGPU) | `registry/local-engines.ts` | RWKV-7 "Goose" running locally in browser via WebGPU & OPFS |
| `web-llm` | WebLLM (Local, WebGPU) | `registry/local-engines.ts` | In-browser WebGPU transformers (`@mlc-ai/web-llm`) |
| `apple-core-ai` | Apple Core AI (On-Device) | `registry/local-engines.ts` | Speculative instruction dialogue via Apple Neural Engine (ANE) & Metal |
| `ollama` | Ollama (Local Server) | `libs/providers/providers/ollama/` | Local Ollama daemon (`http://localhost:11434`) |
| `lm-studio` | LM Studio (Local Server) | `libs/providers/providers/lm-studio/` | Local LM Studio server (`http://localhost:1234/v1`) |
| `vllm` | vLLM (Self-Hosted) | `registry/chat-local.ts` | High-throughput local vLLM cluster (`http://localhost:8000/v1`) |
| `player2` | Player2 | `registry/chat-local.ts` | Local gaming AI sidecar (`http://localhost:4315/v1`) |
| `openai-compatible` | OpenAI Compatible | `libs/providers/providers/openai-compatible/` | Generic custom endpoint URL & headers |

---

## 3. Speech (TTS) Providers
*Defined in `packages/stage-ui/src/stores/providers/registry/speech.ts`*

| Provider ID | Title | Deployment | Notes |
| :--- | :--- | :--- | :--- |
| `kokoro-local` | Kokoro 82M TTS (Local) | Local (WebGPU / WASM) | ONNX-based speech synthesis via Transformers.js (`onnx-community/Kokoro-82M-v1.0-ONNX`) |
| `pocket-tts-local` | Pocket TTS (Local) | Local (WASM / CPU) | Kyutai Pocket TTS 0.1B with 26 built-in character voice profiles |
| `moss-nano-local` | MOSS TTS Nano (Local) | Local (WebGPU / OPFS) | Lightweight on-device neural voice reader |
| `virtual-audio-studio` | Virtual Audio Studio | Local | Virtual engine for composite Audio Studio voice profiles & pitch shifters |
| `speech-noop` | Disabled / No-op Speech | Local | Disables TTS output gracefully |
| `airi-audio-server` | AIRI Audio Server | Local / Remote Daemon | High-performance C++ backend (`audio.cpp`) supporting OmniVoice & Chatterbox |
| `openai-audio-speech` | OpenAI TTS | Cloud | `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts` |
| `openai-compatible-audio-speech`| OpenAI-Compatible TTS | Cloud / Self-Hosted | Custom OpenAI-compatible `/v1/audio/speech` endpoints |
| `elevenlabs` | ElevenLabs | Cloud | Ultra-expressive voice cloning & streaming speech |
| `aws-polly-tts` | Amazon Polly | Cloud | AWS Neural & Standard voices via `aws4fetch` |
| `deepgram-tts` | Deepgram TTS | Cloud | Low-latency Aura conversational voices |
| `microsoft-speech` | Microsoft Azure Speech | Cloud | Azure Cognitive Services neural speech synthesis |
| `alibaba-cloud-model-studio` | Alibaba Model Studio / CosyVoice | Cloud | CosyVoice V1 / V2 neural voice synthesis |
| `volcengine` | Volcengine TTS | Cloud | ByteDance Volcengine speech synthesis |
| `openrouter-audio-speech` | OpenRouter Speech | Cloud | Speech synthesis models routed through OpenRouter |
| `index-tts-vllm` | Index TTS via vLLM | Self-Hosted | vLLM speech synthesis endpoints |
| `player2-speech` | Player2 Speech | Local | Player2 companion speech integration |

---

## 4. Transcription (STT) Providers
*Defined in `packages/stage-ui/src/stores/providers/registry/transcription.ts`*

| Provider ID | Title | Deployment | Notes |
| :--- | :--- | :--- | :--- |
| `whisper-local` | Whisper (Local) | Local (WebGPU / WASM) | In-browser automatic speech recognition via `@huggingface/transformers` (Tiny, Base, Small, Large-v3-Turbo) |
| `browser-web-speech-api` | Web Speech API | Local (Browser Native) | Zero-overhead native browser SpeechRecognition API |
| `openai-audio-transcription` | OpenAI Whisper | Cloud | `whisper-1`, `gpt-4o-transcribe` |
| `openai-compatible-audio-transcription` | OpenAI-Compatible STT | Cloud / Self-Hosted | Generic `/v1/audio/transcriptions` endpoints |
| `deepgram-transcription` | Deepgram Nova | Cloud | High-accuracy streaming transcription (Nova-2 / Nova-3) |
| `aliyun-nls-transcription` | Alibaba Cloud NLS | Cloud | Real-time WebSocket streaming speech recognition |
| `xai-audio-transcription` | xAI Transcription | Cloud | xAI speech-to-text endpoints |
| `comet-api-transcription` | CometAPI Transcription | Cloud | CometAPI transcription gateway |

---

## 5. Artistry (Image Generation) Providers
*Configured in `packages/stage-pages/src/pages/settings/providers/index.vue` and `stores/modules/artistry.ts`*

| Provider ID | Title | Deployment | Notes |
| :--- | :--- | :--- | :--- |
| `pollinations` | Pollinations AI | Cloud (Free) | Zero-config cloud image generator with optional Pollen API key |
| `comfyui` | ComfyUI | Local / LAN | Local node runner executing custom `workflow_api.json` workflows |
| `replicate` | Replicate | Cloud (Paid) | Cloud hosting for Flux, SDXL, and custom community checkpoints |
| `nanobanana` | Nano Banana | Cloud (Free) | Google AI Studio Image Preview integration |

---

## 6. Vision & VLM Providers
*Defined in `packages/stage-ui/src/stores/providers/registry/local-engines.ts` and standard cloud chat providers*

| Provider ID | Title | Deployment | Notes |
| :--- | :--- | :--- | :--- |
| `blip-local` | BLIP & WD14 Tagger (Local) | Local (WebGPU) | On-device anime character tagging & natural scene captioning via WebGPU |
| *(Cloud VLMs)* | GPT-4o, Claude 3.5, Gemini 2.5 | Cloud | Multi-modal vision capabilities routed through respective chat providers |

---

## 7. Motion Generation Providers
*Configured in `packages/stage-pages/src/pages/settings/providers/motion/flowmdm.vue`*

| Provider ID | Title | Deployment | Notes |
| :--- | :--- | :--- | :--- |
| `flowmdm` | FlowMDM (Local WebGPU) | Local (WebGPU) | 100-step generative diffusion Text-to-VRMA gesture synthesizer using CLIP text conditioning |

---

## 8. Cloud & Storage Sync Adapters
*Configured in `packages/stage-pages/src/pages/settings/providers/index.vue` and `stores/sync-engine.ts`*

| Provider ID | Title | Target Storage | Notes |
| :--- | :--- | :--- | :--- |
| `local-fs` | Local File System | Local Path / Samba | Synchronizes database backups and asset blobs to a local directory or NAS mount |
| `s3` | S3-Compatible Storage | Cloudflare R2 / AWS S3 / MinIO | End-to-end encrypted backup and synchronization across multi-device stages |

---

## 9. On-Device Model Cache Oversight (Local Models Registry)

Managed by [`ModelCacheManager.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue) at the bottom of **Settings > Inference Providers**.

### 9.1 LLMs & Language Models
| Model Identifier | Display Name | Runtime / Target | Storage Backend | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `okayuji/Gemma-4-E2B-it-coreml-speculative` | Gemma 4 E2B IT | CoreML / ANE | Native App Sandbox | Speculative draft dialogue on Apple Neural Engine (45+ tok/s) |
| `https://huggingface.co/.../rwkv7-g1d-0.1b-...` (`DEFAULT_WEB_RWKV_MODEL`) | RWKV-7 "Goose" (Web-RWKV) | WebGPU | Browser OPFS (`web-rwkv/`) | Zero-KV-cache linear attention neural network |
| `web-llm` (`WEB_LLM_MODELS`) | WebLLM Suite | WebGPU | CacheStorage (`webllm/*`) | Curated models: Qwen 3.5 (0.8B/4B), Gemma 3 (1B), Ministral 3 Reasoning (3B), Phi 4 Mini (3.8B) |
| `needle-2` | Needle 2 (Cactus SAN 45M) | WASM / CPU | CacheStorage (`needle-cache`) | 14 MB semantic extractor for conversational pacing & dynamic asides |

### 9.2 Audio & Speech Models
| Model Identifier | Display Name | Runtime / Target | Storage Backend | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `aoiandroid/kokoro-82m-coreml-ios` | Kokoro 82M TTS | CoreML / ANE | Native App Sandbox | Sub-100ms neural text-to-speech on Apple Neural Engine |
| `theoracleguy/pocket-tts-coreml` | Pocket-TTS | CoreML / ANE | Native App Sandbox | Native Apple Silicon neural speech synthesis |
| `onnx-community/Kokoro-82M-v1.0-ONNX` | Kokoro 82M TTS | Transformers.js | CacheStorage (`transformers-cache`) | High-speed conversational English & Japanese voice synthesis |
| `whisper` (`WHISPER_MODELS`) | Whisper ASR Suite | Transformers.js | CacheStorage (`transformers-cache`) | Whisper Tiny, Base, Small, and Large-V3-Turbo transcription |
| `moss-tts-nano` (`moss-tts-nano-100m`) | MOSS TTS (Nano) | Browser OPFS | Browser OPFS (`nano-reader-...`) | Lightweight on-device text-to-speech reader |

### 9.3 Vision & Artistry Models
| Model Identifier | Display Name | Runtime / Target | Storage Backend | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `apple/coreml-stable-diffusion-v1-5` | Stable Diffusion 1.5 | CoreML / ANE | Native App Sandbox | On-device autonomous journal background & image generation |
| `SmilingWolf/wd-v1-4-swinv2-tagger-v2` | WD14 SwinV2 Anime Tagger | Transformers.js | CacheStorage (`transformers-cache`) | Anime character and visual trait auto-tagging |
| `SmilingWolf/wd-v1-4-vit-tagger-v2` | WD14 ViT Anime Tagger | Transformers.js | CacheStorage (`transformers-cache`) | Vision Transformer character auto-tagging |
| `onnx-community/blip-image-captioning-base`| BLIP Vision Scene Captioner | Transformers.js | CacheStorage (`transformers-cache`) | Multi-modal natural scene understanding |
| `onnx-community/blip2-opt-2.7b` | BLIP-2 Vision | Transformers.js | CacheStorage (`transformers-cache`) | High-capacity visual reasoning (2.7B parameters) |
| `Xenova/moondream2` | Moondream2 Scene VLM | Transformers.js | CacheStorage (`transformers-cache`) | Compact 1.6B visual language model |
| `Xenova/modnet` | MODNet Portrait Matting | ONNX Web | CacheStorage (`transformers-cache`) | Real-time background removal & portrait matting |

### 9.4 Motion & Kinetics Models
| Model Identifier | Display Name | Runtime / Target | Storage Backend | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `dasilva333/flowmdm-onnx` | FlowMDM Motion Denoiser | WebGPU | CacheStorage (`transformers-cache`) | 100-step generative diffusion Text-to-VRMA gesture synthesizer |
| `Xenova/clip-vit-base-patch32` | CLIP Motion & Text Encoder | Transformers.js | CacheStorage (`transformers-cache`) | Semantic motion matching & Attention Ecology text embedder |

---

## 10. Key Implementation Paths

| Component / Layer | Source Path | Description |
| :--- | :--- | :--- |
| **Settings UI Root** | [`packages/stage-pages/src/pages/settings/providers/index.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/providers/index.vue) | Main provider grid, filters, tab recommendations, and Model Cache Oversight mounting |
| **Model Cache Widget** | [`packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue) | UI component for inspecting and clearing on-device neural weight storage |
| **Inference Constants** | [`packages/stage-ui/src/libs/inference/constants.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/constants.ts) | Model IDs, HuggingFace repos, timeouts, VRAM budgets, and catalog specs |
| **Cache Utilities** | [`packages/stage-ui/src/libs/inference/cache-utils.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/inference/cache-utils.ts) | Size calculation and cache-clearing logic for OPFS, CacheStorage, and Native CoreML |
| **Provider Store** | [`packages/stage-ui/src/stores/providers.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers.ts) | Pinia store managing active instances, persistence, validation, and credentials |
| **Unified Providers** | [`packages/stage-ui/src/libs/providers/providers/`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/libs/providers/providers/) | Modular provider definitions (Anthropic, OpenAI, DeepSeek, Google, etc.) |
| **Speech Registry** | [`packages/stage-ui/src/stores/providers/registry/speech.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/speech.ts) | Speech provider metadata, voice catalogs (Pocket TTS, Kokoro, ElevenLabs, Azure, Polly) |
| **Transcription Registry** | [`packages/stage-ui/src/stores/providers/registry/transcription.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/transcription.ts) | STT metadata, Whisper model definitions, Web Speech API, and Aliyun NLS |
| **Local Engines Registry** | [`packages/stage-ui/src/stores/providers/registry/local-engines.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/local-engines.ts) | Web-RWKV, WebLLM, BLIP Local, and Apple Core AI adapters |
| **Self-Hosted Registry** | [`packages/stage-ui/src/stores/providers/registry/chat-local.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/registry/chat-local.ts) | vLLM and Player2 chat endpoints |

---

## 11. Relevant Skills

- [[airi-provider-core-registry]] — Defining and registering provider backends and capabilities
- [[airi-provider-store-instances]] — Managing runtime accounts, multi-instance lifecycle, and persistence
- [[airi-provider-ui-pages]] — Building and maintaining provider settings UI and forms
- [[airi-local-inference-engines]] — WebGPU/WASM inference workers, VRAM allocation, and cache coordinator
