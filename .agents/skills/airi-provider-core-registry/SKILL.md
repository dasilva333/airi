---
name: airi-provider-core-registry
description: >-
  Define/register provider backends: defineProvider metadata, capabilities, model/voice discovery, config validators, registry wiring, model-cache contracts. Runtime accounts use airi-provider-store-instances; settings forms use airi-provider-ui-pages; inference workers use airi-local-inference-engines.
---

# AIRI Provider Core Registry & Local Model Cache Architecture

This skill provides step-by-step instructions for implementing, extending, and maintaining AIRI's provider architecture and on-device model cache oversight system. A "provider" is a backend service for AI capabilities such as LLMs (chat), TTS (speech), STT (transcription), or generative artistry.

---

## 1. Overview & Surface Map

### Core Concepts & Key Paths

- **Provider Interfaces:** Defining the expected config (using Zod schemas) and initializing the provider backend (e.g. `createOpenAI`, `createWebRwkvChatProvider`).
- **Capabilities & Metadata:** Specifying what the provider can do (`tasks: ['chat', 'vision', 'text-generation']`) and defining localized strings for the UI.
- **Registration:** All providers are defined in dedicated directories and registered in the provider store registry (`local-engines.ts`, `transcription.ts`, `registry.ts`).
- **Local Model Cache Oversight:** Transparent tracking of on-device model downloads across OPFS and Cache Storage with per-model eviction and telemetry.

### Crucial File Paths

- [`packages/stage-ui/src/libs/providers/types.ts`](packages/stage-ui/src/libs/providers/types.ts) — Source of truth for `ProviderDefinition`, `ProviderInstance`, `ModelInfo`, and framework-agnostic `ProviderTranslationFn`.
- [`packages/stage-ui/src/libs/providers/providers/registry.ts`](packages/stage-ui/src/libs/providers/providers/registry.ts) — Central registry mapping IDs to ProviderDefinitions.
- [`packages/stage-ui/src/stores/providers/registry/local-engines.ts`](packages/stage-ui/src/stores/providers/registry/local-engines.ts) — Local in-browser ML engine metadata (Web-RWKV, WebLLM, Local Vision).
- [`packages/stage-ui/src/libs/inference/cache-utils.ts`](packages/stage-ui/src/libs/inference/cache-utils.ts) — Multi-backend storage inspection, formatting, and cache eviction.
- [`packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue`](packages/stage-ui/src/components/scenarios/settings/ModelCacheManager.vue) — Global model cache manager UI.

---

## 2. Local In-Browser Model Cache & Storage Oversight

To ensure transparency and prevent silent multi-gigabyte disk usage, AIRI adheres to a strict **Storage Oversight Protocol** for all on-device inference weights.

### 2.1 The Four On-Device Storage Scopes

In [`cache-utils.ts`](packages/stage-ui/src/libs/inference/cache-utils.ts) and native bridges, local models are routed to their optimal storage engine:

| Storage Backend | Directory / Scope | Used By Engine | Model Types |
| :--- | :--- | :--- | :--- |
| **Native App Sandbox** | CoreML Model Storage | **Apple Core AI / Native ANE** | Gemma 4 E2B IT, Kokoro CoreML iOS, Pocket-TTS CoreML, CoreML Stable Diffusion 1.5 |
| **OPFS** (Origin Private File System) | `web-rwkv/` | **Web-RWKV** | `rwkv7-g1d-*.safetensors`, `.state` cartridges |
| **OPFS** | `nano-reader-browser-model-store` | **MOSS TTS** | `moss-tts-nano-100m` weights |
| **Cache Storage API** | `transformers-cache` | **Transformers.js / ONNX Runtime** | Kokoro TTS, Whisper STT, FlowMDM, BLIP Vision, WD14, Moondream2, MODNet, CLIP |
| **Cache Storage API** | `webllm/model`, `webllm/wasm`, `webllm/config` | **WebLLM** (`@mlc-ai/web-llm`) | Qwen 3.5 (0.8B/4B), Gemma 3 (1B), Ministral 3 Reasoning (3B), Phi 4 Mini (3.8B) |
| **Cache Storage API** | `needle-cache` | **Needle 2 (WASM/CPU)** | 14 MB Cactus SAN 45M aside generator for conversational pacing |

### 2.2 Global Model Cache Manager (`ModelCacheManager.vue`)

Mounted at the bottom of **`Settings > Providers`** (`providers/index.vue`). It manages the 18 known on-device models across four modalities:

```typescript
const knownModels = [
  // 1. LLMs
  { id: 'okayuji/Gemma-4-E2B-it-coreml-speculative', name: 'Gemma 4 E2B IT (Speculative CoreML)', runtime: 'CoreML / ANE' },
  { id: DEFAULT_WEB_RWKV_MODEL, name: 'RWKV-7 "Goose" (Web-RWKV)', runtime: 'Browser OPFS' },
  { id: 'web-llm', name: 'WebLLM (Ministral 3 / Qwen 2.5 / Llama 3.2)', runtime: 'WebGPU (Cache API)' },
  { id: 'needle-2', name: 'Needle 2 (Cactus SAN 45M)', runtime: 'WASM / CPU' },

  // 2. Audio & Speech
  { id: 'aoiandroid/kokoro-82m-coreml-ios', name: 'Kokoro 82M TTS (CoreML iOS)', runtime: 'CoreML / ANE' },
  { id: 'theoracleguy/pocket-tts-coreml', name: 'Pocket-TTS (CoreML)', runtime: 'CoreML / ANE' },
  { id: 'onnx-community/Kokoro-82M-v1.0-ONNX', name: 'Kokoro 82M TTS (ONNX Web)', runtime: 'Transformers.js' },
  { id: 'whisper', name: 'Whisper ASR (Hearing & Transcription)', runtime: 'Transformers.js' },
  { id: 'moss-tts-nano', name: 'MOSS TTS (Nano)', runtime: 'Browser OPFS' },

  // 3. Vision & Artistry
  { id: 'apple/coreml-stable-diffusion-v1-5', name: 'Stable Diffusion 1.5 (CoreML ANE)', runtime: 'CoreML / ANE' },
  { id: 'SmilingWolf/wd-v1-4-swinv2-tagger-v2', name: 'WD14 SwinV2 Anime Tagger', runtime: 'Transformers.js' },
  { id: 'SmilingWolf/wd-v1-4-vit-tagger-v2', name: 'WD14 ViT Anime Tagger', runtime: 'Transformers.js' },
  { id: 'onnx-community/blip-image-captioning-base', name: 'BLIP Vision Scene Captioner', runtime: 'Transformers.js' },
  { id: 'onnx-community/blip2-opt-2.7b', name: 'BLIP-2 Vision', runtime: 'Transformers.js' },
  { id: 'Xenova/moondream2', name: 'Moondream2 Scene VLM', runtime: 'Transformers.js' },
  { id: 'Xenova/modnet', name: 'Background Removal (MODNet)', runtime: 'ONNX Web' },

  // 4. Motion & Kinetics
  { id: 'dasilva333/flowmdm-onnx', name: 'FlowMDM Motion Denoiser', runtime: 'WebGPU' },
  { id: 'Xenova/clip-vit-base-patch32', name: 'CLIP Motion & Text Encoder', runtime: 'Transformers.js' },
]
```

### 2.3 Per-Model Eviction & Telemetry Contract

- `getModelCacheSize(): Promise<number>` — Computes total disk usage across all 3 storage backends.
- `isModelCached(modelId: string): Promise<boolean>` — Checks if a model's weights exist locally.
- `clearSingleModelCache(modelId: string): Promise<void>` — Evicts **only** that specific model without affecting other downloaded weights.
- `clearModelCache(): Promise<void>` — Purges all local model storage scopes.

### 2.4 Inline Provider UI Pattern

Every local provider page (e.g. `web-llm.vue`, `flowmdm.vue`, `whisper-local.vue`) must embed the standard **Weight Cache Management** panel:
1. **Live Storage Badge**: `formatBytes(cacheSize)` (e.g., `2.8 GB` or `Not Cached`).
2. **Download Progress**: Real-time progress bar binding `downloadProgress` during fetch.
3. **Explicit Trigger**: "Download & Cache" button (never trigger silent multi-gigabyte downloads on page load).
4. **Instant Reclaim**: "Clear Cache" button calling `clearSingleModelCache(modelId)`.

---

## 3. Core SOPs for Adding Providers

### 1. Scaffold a New Provider Directory

1. Create a new directory under `packages/stage-ui/src/libs/providers/providers/` named after the provider (e.g. `anthropic`).
2. Create an `index.ts` file inside it.

### 2. Define the Zod Config Schema

Define the configuration schema with localized labels via `.meta()`:

```typescript
import { z } from 'zod'

const providerConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional(),
})

type ProviderConfig = z.input<typeof providerConfigSchema>
```

### 3. Implement `defineProvider`

```typescript
import { defineProvider } from '../registry'

export const providerMyAi = defineProvider<ProviderConfig>({
  id: 'my-ai',
  order: 10,
  name: 'My AI Provider',
  nameLocalize: ({ t }) => t('settings.pages.providers.provider.my-ai.title'),
  description: 'A description',
  descriptionLocalize: ({ t }) => t('settings.pages.providers.provider.my-ai.description'),
  tasks: ['chat'],
  icon: 'i-lobe-icons:my-ai',

  createProviderConfig: ({ t }) => providerConfigSchema.extend({
    apiKey: providerConfigSchema.shape.apiKey.meta({
      labelLocalized: t('...label'),
      descriptionLocalized: t('...description'),
      placeholderLocalized: t('...placeholder'),
      type: 'password',
    }),
  }),
  createProvider(config) {
    return createMyAi(config.apiKey)
  },
  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
})
```

### 4. Register in `registry.ts` & `local-engines.ts`

- For cloud/API providers: Add to `packages/stage-ui/src/libs/providers/providers/registry.ts`.
- For local browser ML models: Add to `packages/stage-ui/src/stores/providers/registry/local-engines.ts` and register in `ModelCacheManager.vue`.

---

## 4. Known Pitfalls & Failure Modes

- **Silent Downloads**: Never start downloading multi-hundred-megabyte weights without user confirmation or explicit UI state indication.
- **OPFS vs CacheStorage Routing**: Web-RWKV safetensors must go to OPFS (for memory-efficient chunked streaming); ONNX models must go to CacheStorage (for Transformers.js compatibility).
- **Zod Localization**: Do not use raw strings for user-facing UI labels in Zod. Always map them using `.meta()` with `t()`.
- **Single Model Deletion**: When implementing cache eviction, always test that `clearSingleModelCache` does not inadvertently purge sibling models in the same cache namespace.

---

## 5. Verification Workflows

1. **Typechecking**: Run `pnpm -F @proj-airi/stage-ui typecheck`.
2. **Cache Verification**: In the browser/Electron DevTools, inspect `Storage > Origin Private File System` and `Storage > Cache Storage` to confirm files are stored in the correct directory.
3. **UI Preview**: Open `Settings > Providers` and verify the model appears in `ModelCacheManager` with accurate size telemetry.

---

## Related Skills & References

- **Key Documents**: [[settings-yaml]], [[provider-catalog]], [[project-provider-metadata-catalog]], [[design-multi-instance-provider-studio]], [[proposal-generative-code-painting-rwkv-webllm]]

### Authoritative Design & Architecture Documents

- [docs/settings-yaml.md](docs/settings-yaml.md) — Canonical key→file map and yaml-manager guide (provider i18n keys).
- [docs/provider-catalog.md](docs/provider-catalog.md) — Provider catalog reference.
- [docs/project-provider-metadata-catalog.md](docs/project-provider-metadata-catalog.md) — Provider metadata catalog project.
- [docs/design-multi-instance-provider-studio.md](docs/design-multi-instance-provider-studio.md) — Multi-instance provider studio design.
- [docs/proposal-web-cors-proxy-bypass.md](docs/proposal-web-cors-proxy-bypass.md) — Web CORS proxy bypass proposal.
