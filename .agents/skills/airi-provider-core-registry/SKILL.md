---
name: airi-provider-core-registry
description: >-
  Use when defining new LLM/TTS/STT/vision provider backends, writing defineProvider() metadata contracts, specifying capabilities (listModels, listVoices, loadModel, getSpeechCapabilities), registering Zod config validators, wiring providers into the central registry.ts, or localizing provider UI metadata via packages/i18n.
---

# AIRI Provider Core Registry

This skill provides step-by-step instructions for implementing, extending, and maintaining AIRI's provider architecture. A "provider" is a backend service for AI capabilities such as LLMs (chat), TTS (speech), or STT (transcription).

## 1. Overview & Surface Map
### Core Concepts & Key Paths

- **Provider Interfaces:** Defining the expected config (using Zod schemas) and initializing the provider backend (e.g. `createOpenAI`).
- **Capabilities & Metadata:** Specifying what the provider can do (`tasks: ['chat', 'vision']`) and defining localized strings for the UI.
- **Registration:** All providers must be exported from their own directory and then manually imported and registered in the global registry.

**Crucial File Paths:**
- [`packages/stage-ui/src/libs/providers/types.ts`](packages/stage-ui/src/libs/providers/types.ts) - The canonical source of truth for `ProviderDefinition`, `ProviderInstance`, `ModelInfo`, etc.
- [`packages/stage-ui/src/libs/providers/providers/registry.ts`](packages/stage-ui/src/libs/providers/providers/registry.ts) - The central registry mapping IDs to ProviderDefinitions.
- `packages/stage-ui/src/libs/providers/providers/<provider_id>/index.ts` - Where individual providers are implemented.

## 2. Core SOPs & Guidelines
### Step-by-Step SOPs

### 1. Scaffold a New Provider Directory

1. Create a new directory under `packages/stage-ui/src/libs/providers/providers/` named after the provider (e.g. `anthropic`).
2. Create an `index.ts` file inside it.

### 2. Define the Zod Config Schema

Define the configuration schema that the user will fill out in the UI. Ensure labels, descriptions, and placeholders are localized via the `meta` extension on Zod properties.

```typescript
import { z } from 'zod'

const providerConfigSchema = z.object({
  apiKey: z.string('API Key'),
  baseUrl: z.string('Base URL').optional(),
})

type ProviderConfig = z.input<typeof providerConfigSchema>
```

### 3. Implement the Provider Definition (`defineProvider`)

Use the `defineProvider` function from the `registry.ts` file to export the provider definition.

Key fields to implement:
- `id`, `name`, `order`, `tasks`, and `icon`
- `nameLocalize` and `descriptionLocalize`: Functions returning translation keys.
- `createProviderConfig`: Extends the zod schema with localization contexts.
- `createProvider`: Instantiates the backend using standard constructors (e.g., from `@xsai-ext/providers/create`).
- `validationRequiredWhen` and `validators`: Health checks for API keys/connectivity.

Example:
```typescript
import { defineProvider } from '../registry'
// ... imports

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
    // Return ProviderInstance
    return createMyAi(config.apiKey)
  },
  validationRequiredWhen(config) {
    return !!config.apiKey?.trim()
  },
})
```

### 4. Register the Provider in `registry.ts`

Open `packages/stage-ui/src/libs/providers/providers/registry.ts`.
Note: Many providers are likely auto-registered or manually imported in an aggregator (e.g. `providers/index.ts` or directly inside `registry.ts` depending on the current codebase pattern). **Always check the existing import pattern in `registry.ts` and add your provider.**

### 5. Localization

Ensure all translation keys referenced in `nameLocalize`, `descriptionLocalize`, and Zod `meta` fields are actually defined in `packages/i18n/`. (Use the `scripts/yaml-manager.js` script to add translations as documented in `docs/settings-yaml.md`).

## 3. Known Pitfalls & Failure Modes

- **Schema Drift:** Be mindful of upstream API changes. The Zod validators are strict by design.
- **Zod Localization:** Do not use raw strings for user-facing UI labels in Zod. Always map them using the `.meta()` extension pattern with the `t` function.
- **Lazy Loading:** Limit expensive operations during `defineProvider`. The registry is loaded synchronously; delay heavy initialization to `createProvider`.
- **Validation:** Do not forget to attach appropriate connectivity validators (e.g., `createOpenAICompatibleValidators`) for seamless user experience.

## 4. Verification Workflows

1. **Typechecking:** Run `pnpm -F @proj-airi/stage-ui typecheck` to ensure there are no schema or typing errors.
2. **Schema Verification:** Ensure the Zod validation correctly captures empty API keys and required configuration states.
3. **UI Preview:** If instructed by the user to test visually, spin up the web application (e.g., `pnpm dev`) and navigate to the providers settings page to confirm the provider shows up with the correct icon and form fields.

### Authoritative Design & Architecture Documents

- [docs/settings-yaml.md](docs/settings-yaml.md) — Canonical key→file map and yaml-manager guide (provider i18n keys).
- [docs/provider-catalog.md](docs/provider-catalog.md) — Provider catalog reference.
- [docs/project-provider-metadata-catalog.md](docs/project-provider-metadata-catalog.md) — Provider metadata catalog project.
- [docs/design-multi-instance-provider-studio.md](docs/design-multi-instance-provider-studio.md) — Multi-instance provider studio design.
- [docs/proposal-web-cors-proxy-bypass.md](docs/proposal-web-cors-proxy-bypass.md) — Web CORS proxy bypass proposal.
