# Provider Store Current Structure

## Purpose

This document is the quick-reference guide for how `packages/stage-ui/src/stores/providers.ts` is structured today.

Read this first if you need to work on the provider store.

Read the planning docs only if you need migration context:

- `docs/project-provider-store-restructuring-plan.md` for the safe first-phase rollout
- `docs/project-codex-provider-restructuring-plan.md` for the long-term target architecture

## What `providers.ts` Does Today

`packages/stage-ui/src/stores/providers.ts` is still the main Pinia store for provider orchestration.

It currently owns:

- persisted provider credentials via `useLocalStorage`
- persisted "added provider" state via `useLocalStorage`
- provider runtime state
- provider validation flow
- provider instance caching and disposal
- model loading and normalization
- UI-facing derived provider lists

It no longer needs to own every shared contract and helper directly.

## Extracted Seams

The following responsibilities have already been split into dedicated files:

### Shared contracts

- `packages/stage-ui/src/stores/providers/types.ts`

This file holds shared provider-store types such as:

- `ProviderMetadata`
- `ProviderRuntimeState`
- `ModelInfo`
- `VoiceInfo`
- `SpeechCapabilitiesInfo`

### Shared helpers

- `packages/stage-ui/src/stores/providers/helpers.ts`

This file currently holds reusable provider-store helper logic such as:

- base URL normalization helpers
- base URL validation helper
- conditional debug logging helper
- browser/local capability helper used for local browser providers

### Unified registry composition

- `packages/stage-ui/src/stores/providers/registry/index.ts`

This file currently owns the composition step that merges:

- existing inline legacy metadata from `providers.ts`
- translated unified definitions from `packages/stage-ui/src/libs/providers`

`providers.ts` now calls the registry composer rather than owning the merge logic inline.

## What Is Still Inline In `providers.ts`

The following major responsibility is still inline:

- the large hand-written legacy provider metadata block, especially for speech and transcription providers

This is intentional for now. It keeps behavior stable while the safer extraction seams are established first.

## Current Runtime Flow

Conceptually, the store behaves like this today:

1. create persisted state for provider credentials and added providers
2. define the legacy provider metadata block inline
3. build the final provider registry through `createProviderRegistry(...)`
4. initialize runtime state for providers
5. validate providers as configs change
6. create and cache provider instances on demand
7. fetch and normalize model lists
8. expose derived metadata and provider lists for UI consumers

## Current File Roles

### Main store

- `packages/stage-ui/src/stores/providers.ts`

This remains the runtime and orchestration center.

### Registry conversion

- `packages/stage-ui/src/stores/providers/converters.ts`

This converts unified provider definitions from `libs/providers` into the metadata shape used by the store.

### OpenAI-compatible metadata builder

- `packages/stage-ui/src/stores/providers/openai-compatible-builder.ts`

This is a reusable builder used by many provider definitions.

It still depends on the shared provider metadata shape, but that shape now lives in `types.ts`.

## Important Guardrails

If you continue refactoring this area, preserve these constraints unless you are intentionally doing a larger architectural pass.

### 1. Preserve persistence contracts

Do not change:

- `settings/credentials/providers`
- `settings/providers/added`

The current refactor is not a storage migration.

### 2. Preserve provider capability behavior

Do not casually change:

- provider IDs
- capability payload shapes
- capability semantics for voices, models, presets, tags, or mannerisms

Some of this behavior is relied on by adjacent systems such as Chatterbox-related UI and model/provider selection flows.

### 3. Preserve speech/runtime integration

Do not treat this as a speech pipeline refactor.

Validation timing, watcher behavior, provider selection timing, and provider-facing runtime behavior should remain stable during the safe extraction phase.

## Recommended Reading Order

If you are new to this area:

1. read this file
2. inspect `packages/stage-ui/src/stores/providers.ts`
3. inspect `packages/stage-ui/src/stores/providers/types.ts`
4. inspect `packages/stage-ui/src/stores/providers/helpers.ts`
5. inspect `packages/stage-ui/src/stores/providers/registry/index.ts`
6. read `docs/project-provider-store-restructuring-plan.md` if you are continuing Phase 1
7. read `docs/project-codex-provider-restructuring-plan.md` only if you are planning the later end-state architecture

## Short Version

The provider store is still mostly monolithic, but three low-risk seams now exist:

- shared types
- shared helpers
- registry composition

That is the current structure to build from.

## Relevant Skills

- [[airi-provider-store-instances]]
- [[airi-provider-ui-pages]]
