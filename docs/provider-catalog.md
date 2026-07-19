# Provider Catalog

A living index of every provider registered in the AIRI provider system, organized by category. Each entry links to its definition in `packages/stage-ui/src/stores/providers.ts` with an approximate line number.

Provider metadata is currently inline in `providers.ts` — see the restructuring plans below for ongoing work to split these into dedicated files.

> **Related documents:**
> - [`docs/project-provider-store-restructuring-plan.md`](./project-provider-store-restructuring-plan.md) — Phase 1 safe extraction plan (ongoing)
> - [`docs/project-codex-provider-restructuring-plan.md`](./project-codex-provider-restructuring-plan.md) — Long-term target architecture
> - [`docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md`](./content/en/docs/advanced/architecture/arch-provider-store-current-structure.md) — Current structure reference
> - [`docs/rosetta-stone.md`](./rosetta-stone.md) §6 — Provider system overview in the Rosetta Stone

---

## Category: Speech (TTS)

| Provider ID | File | Line | Notes |
| :--- | :--- | :--- | :--- |
| `speech-noop` | `providers.ts` | ~119 | No-op speech provider (disables TTS) |
| `virtual-audio-studio` | `providers.ts` | ~147 | Virtual engine for Audio Studio voice profiles |
| `app-local-audio-speech` | `providers.ts` | ~194 | Desktop local audio output |
| `browser-local-audio-speech` | `providers.ts` | ~228 | Browser local audio output |
| `openai-audio-speech` | `providers.ts` | ~287 | OpenAI TTS (tts-1, tts-1-hd, gpt-4o-mini-tts) |
| `openai-compatible-audio-speech` | `providers.ts` | ~466 | Generic OpenAI-compatible TTS endpoint |
| `aws-polly-tts` | `providers.ts` | ~738 | Amazon Polly (neural + standard voices) |
| `elevenlabs` | `providers.ts` | ~1194 | ElevenLabs cloud TTS |
| `deepgram-tts` | `providers.ts` | ~1295 | Deepgram TTS (aura voices) |
| `microsoft-speech` | `providers.ts` | ~1428 | Microsoft Azure Speech |
| `index-tts-vllm` | `providers.ts` | ~1504 | Index TTS via vLLM |
| `alibaba-cloud-model-studio` | `providers.ts` | ~1597 | Alibaba Cloud Model Studio TTS |
| `volcengine` | `providers.ts` | ~1680 | Volcengine TTS |
| `openrouter-audio-speech` | `providers.ts` | ~1754 | OpenRouter speech models |
| `comet-api-speech` | `providers.ts` | ~1962 | CometAPI speech gateway |
| `xai-audio-speech` | `providers.ts` | ~2082 | xAI speech (grok-2-tts) |
| `player2-speech` | `providers.ts` | ~2520 | Player2 speech |
| `player2-tts` | `providers.ts` | ~2520 | Player2 TTS |
| `kokoro-local` | `providers.ts` | ~2642 | Local ONNX TTS via Kokoro |
| `cosyvoice-v1` | `providers.ts` | ~1597 | CosyVoice V1 (Alibaba) |
| `cosyvoice-v2` | `providers.ts` | ~1597 | CosyVoice V2 (Alibaba) |

---

## Category: Transcription (STT)

| Provider ID | File | Line | Notes |
| :--- | :--- | :--- | :--- |
| `browser-local-audio-transcription` | `providers.ts` | ~258 | Browser native speech recognition |
| `openai-audio-transcription` | `providers.ts` | ~893 | OpenAI Whisper (gpt-4o-transcribe, whisper-1) |
| `openai-compatible-audio-transcription` | `providers.ts` | ~971 | Generic OpenAI-compatible STT |
| `aliyun-nls-transcription` | `providers.ts` | ~1023 | Alibaba Cloud NLS speech recognition |
| `browser-web-speech-api` | `providers.ts` | ~1115 | Web Speech API (browser native) |
| `deepgram-transcription` | `providers.ts` | ~1382 | Deepgram STT (nova models) |
| `comet-api-transcription` | `providers.ts` | ~1980 | CometAPI transcription gateway |
| `xai-audio-transcription` | `providers.ts` | ~2182 | xAI transcription |
| `whisper-local` | `providers.ts` | ~2851 | Local Whisper via ONNX + WebGPU/WASM |

---

## Category: Chat (LLM)

These use `buildOpenAICompatibleProvider()` by default (category `chat` unless overridden).

| Provider ID | File | Line | Notes |
| :--- | :--- | :--- | :--- |
| `azure-ai-foundry` | `providers.ts` | ~2021 | Azure AI Foundry |
| `xai` | `providers.ts` | ~2071 | xAI (Grok) |
| `vllm` | `providers.ts` | ~2232 | vLLM inference server |
| `cloudflare-workers-ai` | `providers.ts` | ~2362 | Cloudflare Workers AI |
| `player2` | `providers.ts` | ~2452 | Player2 |
| `web-rwkv` | `providers.ts` | ~2894 | RWKV local inference |

### OpenAI-Compatible Chat Providers

These all use `buildOpenAICompatibleProvider()` without overriding the category. They appear under a `chat` category.

| Provider ID | File | Line |
| :--- | :--- | :--- |
| `cerebras-ai` | `providers.ts` | ~1997 |
| `together-ai` | `providers.ts` | ~2009 |
| `novita-ai` | `providers.ts` | ~2233 |
| `fireworks-ai` | `providers.ts` | ~2233 |
| `featherless-ai` | `providers.ts` | ~2233 |
| `comet-api` | `providers.ts` | ~2233 |
| `perplexity-ai` | `providers.ts` | ~2362 |
| `mistral-ai` | `providers.ts` | ~2362 |
| `moonshot-ai` | `providers.ts` | ~2362 |
| `modelscope` | `providers.ts` | ~2362 |
| `opencode-go` | `providers.ts` | ~2875 |
| `alibaba-cloud` | `providers.ts` | ~2886 |

---

## Category: Embed

| Provider ID | File | Line | Notes |
| :--- | :--- | :--- | :--- |
| *(none currently registered)* | — | — | Embed category exists in the type system but no providers registered |

---

## Category: Vision (VLM)

| Provider ID | File | Line | Notes |
| :--- | :--- | :--- | :--- |
| *(none currently registered with `category: 'vision'`)* | — | — | Vision providers are expected to be registered in the provider system with `category: 'vision'` or tasks including `'vision'`/`'image-to-text'`. Currently no providers declare this — vision/VLM support is handled through the standalone vision module (`stores/modules/vision.ts`) or through chat providers that support multimodal inputs. |

---

## Local / On-Device Providers

These run locally with ONNX/WebGPU/WASM:

| Provider ID | Category | Line | Runtime |
| :--- | :--- | :--- | :--- |
| `kokoro-local` | speech | ~2642 | `kokoro-js` (transformers.js) |
| `whisper-local` | transcription | ~2851 | `whisper.cpp` / ONNX |
| `web-rwkv` | chat | ~2894 | RWKV WebGPU |
| `Xenova/modnet` | background-removal | — | ONNX (transformers.js) |
| `onnx-community/blip-image-captioning-base` | vision | — | ONNX (transformers.js) |
| `onnx-community/blip2-opt-2.7b` | vision | — | ONNX (transformers.js) |
| `SmilingWolf/wd-v1-4-swinv2-tagger-v2` | image-tagging | — | ONNX (transformers.js) |
| `SmilingWolf/wd-v1-4-vit-tagger-v2` | image-tagging | — | ONNX (transformers.js) |

---

## Provider Builder Reference

| Builder | File | Default Category | Used By |
| :--- | :--- | :--- | :--- |
| `buildOpenAICompatibleProvider()` | `packages/stage-ui/src/stores/providers/openai-compatible-builder.ts` | `chat` | Most cloud chat + speech providers |
| `createProvider()` (generic) | `packages/stage-ui/src/stores/providers.ts` | — | Defines full metadata manually |

---

## Provider Architecture Files

| File | Role |
| :--- | :--- |
| `packages/stage-ui/src/stores/providers.ts` | Main store — provider registry, validation, instance lifecycle, credentials |
| `packages/stage-ui/src/stores/providers/types.ts` | Shared type definitions (`ProviderMetadata`, `ModelInfo`, `VoiceInfo`, etc.) |
| `packages/stage-ui/src/stores/providers/helpers.ts` | Generic helper functions (URL normalization, debug logging) |
| `packages/stage-ui/src/stores/providers/converters.ts` | Converts unified provider definitions to store metadata shape |
| `packages/stage-ui/src/stores/providers/openai-compatible-builder.ts` | Reusable builder for OpenAI-compatible providers |
| `packages/stage-ui/src/stores/providers/registry/index.ts` | Registry composition — merges legacy + unified definitions |

---

> **Maintainer note:** This catalog should be updated whenever a new provider is added or an existing one is moved during the restructuring. The line numbers are approximate — use them as a starting point for navigation, not as fixed API.
