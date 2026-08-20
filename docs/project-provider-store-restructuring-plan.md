# Project Plan - Safe Phase 1 Restructuring for `providers.ts`

## Plan Positioning

This document defines the recommended first implementation phase for restructuring `packages/stage-ui/src/stores/providers.ts`.

Read this after `docs/arch-provider-store-current-structure.md`.

It is intentionally narrower than `docs/project-codex-provider-restructuring-plan.md`.

Use this document when the priority is:

- reduce risk
- shrink the monolithic file
- improve maintainability
- avoid downstream compatibility churn

Use the Codex plan as the long-term target architecture. Use this plan as the first safe rollout.

## Current Status

At the moment, the groundwork for this phase has started:

- shared provider contracts have been extracted to `packages/stage-ui/src/stores/providers/types.ts`
- shared helper logic has been extracted to `packages/stage-ui/src/stores/providers/helpers.ts`
- unified registry composition has been extracted to `packages/stage-ui/src/stores/providers/registry/index.ts`
- `providers.ts` now consumes those extracted seams while still retaining the existing runtime behavior

The large inline legacy metadata block in `providers.ts` has not yet been fully moved into dedicated registry-family files. That remains the next meaningful Phase 1 step.

## Summary

The current `packages/stage-ui/src/stores/providers.ts` file is too large and is carrying too many provider metadata definitions inline. That creates editing risk and slows down maintenance, even when the desired change is small.

The safest first win is not to fully re-architect provider runtime behavior. The safest first win is to break the metadata and registry assembly apart while keeping the current store API, runtime behavior, watchers, validation flow, and downstream call sites effectively unchanged.

This phase is therefore a structural extraction, not a rewrite.

## Objectives

- Reduce the size and edit risk of `providers.ts`.
- Move hand-written provider metadata into dedicated files.
- Centralize registry assembly behind a single composition function.
- Preserve the current external store surface and runtime behavior.
- Avoid broad downstream changes across apps and packages.

## Non-Goals

- Reworking validation behavior.
- Reworking instance caching or disposal behavior.
- Reworking watcher timing or side effects.
- Refactoring selectors into dedicated modules yet.
- Migrating every legacy provider into `libs/providers`.
- Changing consumer code outside the provider store area unless required by a bug.

## Scope of Phase 1

Phase 1 should only do the following:

1. Extract shared types and helper functions out of `providers.ts`.
2. Move hand-written provider metadata into dedicated registry files.
3. Introduce a registry composition module that returns the final provider metadata map.
4. Keep runtime logic in the store mostly intact.
5. Keep the exported store name, public API, and caller behavior stable.

This means the store should still own:

- reactive persisted state
- validation execution
- model loading
- instance caching
- watcher setup
- UI-facing computed selectors

That is acceptable for Phase 1 because the main goal is safe decomposition, not complete architectural cleanup.

## Why This Is the Safe Rollout

The highest-risk parts of the current store are not the metadata declarations themselves. The highest-risk parts are the behavioral seams:

- configured versus unconfigured validation heuristics
- validation side effects such as Electron IPC and toasts
- provider instance lifecycle
- credential watchers
- model refresh behavior
- selector output consumed by settings UI

If Phase 1 only extracts metadata and registry composition, those behavioral seams remain largely untouched. That sharply reduces the chance of downstream regressions while still delivering a real maintainability improvement.

## Proposed Architecture for Phase 1

### Target State After Phase 1

After Phase 1, `providers.ts` should still be the main runtime store, but it should stop owning the metadata block inline.

Conceptually:

```ts
export const useProvidersStore = defineStore('providers', () => {
  const { t } = useI18n()
  const providerCredentials = useLocalStorage(...)
  const addedProviders = useLocalStorage(...)

  const providerMetadata = createProviderRegistry({ t })

  // Existing runtime logic remains in place for now:
  // - initialize provider state
  // - validate providers
  // - watch credentials
  // - fetch models
  // - cache instances
  // - expose selectors
})
```

That gives the project a smaller, safer store without changing the runtime shape yet.

## Proposed Directory Layout for Phase 1

```text
packages/stage-ui/src/stores/
  providers.ts
  providers/
    types.ts
    helpers.ts
    converters.ts
    registry/
      index.ts
      legacy/
        index.ts
        speech/
          index.ts
          noop.ts
          openai.ts
          openai-compatible.ts
          elevenlabs.ts
          deepgram.ts
          microsoft.ts
          player2.ts
          kokoro.ts
          index-tts-vllm.ts
          openrouter.ts
          alibaba-cloud-model-studio.ts
          volcengine.ts
          chatterbox.ts
        transcription/
          index.ts
          openai.ts
          openai-compatible.ts
          deepgram.ts
          aliyun-nls.ts
          browser-web-speech-api.ts
      unified/
        index.ts
```

This structure deliberately stops before adding `runtime/` and `selectors/` modules. Those can come later if the team decides the initial extraction was safe and worthwhile.

## Detailed Responsibilities

### `providers.ts`

Phase 1 responsibilities:

- create persisted store state
- call `createProviderRegistry({ t })`
- retain current validation and runtime logic
- retain current selectors and public API

### `providers/types.ts`

Move stable contracts here:

- `ProviderMetadata`
- `ProviderRuntimeState`
- `ModelInfo`
- `VoiceInfo`
- `SpeechCapabilitiesInfo`

### `providers/helpers.ts`

Move generic helpers here:

- base URL normalization helpers
- debug logging helpers
- any small store-agnostic provider utility

### `providers/registry/index.ts`

Responsibilities:

- compose the final metadata map
- merge legacy hand-written metadata with unified converted definitions
- hide the current mutable assembly logic behind one function

### `providers/registry/legacy/*`

Responsibilities:

- hold the hand-written speech and transcription metadata entries
- keep provider-family-specific capability and validation helpers near the provider definition

### `providers/registry/unified/index.ts`

Responsibilities:

- read from `libs/providers`
- translate unified provider definitions into store metadata

## Compatibility Constraints

Phase 1 should preserve all of the following:

- `useProvidersStore` remains exported from the same file
- existing store action names remain available
- existing computed properties remain available
- provider IDs remain unchanged
- provider categories and tasks remain unchanged
- validation behavior remains unchanged
- provider runtime state shape remains unchanged
- selector outputs remain unchanged

If an extraction requires changing one of these, it is probably too large for Phase 1 and should be deferred.

## Guardrails From Adjacent Architecture Docs

The following guardrails are intentionally repeated here so the refactor can be resumed safely even after context loss or compaction.

### 1. Preserve persisted storage keys and persistence behavior

Per `docs/arch-indexeddb-storage.md`, renderer settings persistence relies on existing Pinia and `localStorage` conventions under keys like `settings/*`.

Phase 1 must therefore:

- preserve the existing provider persistence keys
- preserve the current `useLocalStorage(...)` usage pattern
- avoid changing how persisted provider config is loaded or merged

This phase is not allowed to rename or reorganize persisted storage contracts.

### 2. Preserve provider capability shapes and semantics

Per `docs/design-acting-tab-and-chatterbox.md` and `docs/design-character-configurable-llm.md`, AIRI should not collapse provider-specific capability behavior into fake universal client-side abstractions.

Phase 1 must therefore:

- preserve provider IDs and capability plumbing
- preserve capability payload semantics for speech tags, mannerisms, presets, voices, and models
- keep provider-specific capability behavior near the provider definitions

This phase is not allowed to redesign capability semantics or normalize them more aggressively than the current store already does.

### 3. Do not touch speech runtime integration in Phase 1

Per `docs/arch-chat-stt-proactivity-pipelines.md`, speech behavior depends on a fragile chain spanning chat hooks, `Stage.vue`, the speech runtime, and provider selection.

Phase 1 must therefore:

- avoid changing speech runtime ownership or pipeline behavior
- avoid changing watcher semantics that can affect provider selection timing
- avoid changing provider-facing runtime behavior unless strictly required to preserve current behavior after extraction

This phase is a metadata and registry extraction, not a speech pipeline refactor.

## Migration Steps

### Step 1. Extract types

Move the shared interfaces and type aliases into `providers/types.ts`.

Expected risk:

- very low

Expected gain:

- clearer contracts for the rest of the extraction

### Step 2. Extract helpers

Move small store-independent helper functions into `providers/helpers.ts`.

Expected risk:

- very low

Expected gain:

- removes non-store noise from the main file

### Step 3. Introduce the registry composer

Add `providers/registry/index.ts` and move the current registry assembly into it.

Expected risk:

- low

Expected gain:

- the store consumes one prebuilt registry rather than building and mutating it inline

### Step 4. Move hand-written metadata into registry files

Move the large metadata block into provider-family files under `registry/legacy/`.

Expected risk:

- low to moderate

Expected gain:

- largest immediate reduction in file size
- much lower edit risk for future provider changes

### Step 5. Keep runtime logic untouched except for imports

Do not refactor validation, watchers, selectors, or instance logic in this phase beyond what is required to consume the extracted registry and shared types.

Expected risk:

- lowest possible for a meaningful refactor

Expected gain:

- preserves behavior while gaining maintainability

## Explicitly Deferred to Later Phases

The following should not be included in Phase 1 unless a bug forces it:

- runtime module extraction
- selector module extraction
- validation policy cleanup
- instance cache redesign
- watcher redesign
- public store API cleanup
- large-scale provider migration into `libs/providers`

Those are valid future steps, but they are not required to get the first safe win.

## Risks

### 1. Metadata extraction may accidentally change provider definitions

Mitigation:

- move code with minimal edits
- preserve provider object shapes exactly
- avoid "cleanup" changes while moving files

### 2. Registry assembly may change merge order or override behavior

Mitigation:

- keep the existing merge semantics intact
- add a focused test or manual comparison for resulting provider IDs and categories

### 3. Import path churn may create type or circular dependency issues

Mitigation:

- keep contracts in `providers/types.ts`
- keep helpers store-agnostic
- keep registry composition one-directional

## Verification Plan

### Code Review Checks

Review for:

- unchanged public store API
- unchanged provider ID inventory
- unchanged category assignment
- unchanged provider validation hooks
- no new downstream call-site edits unless necessary

### Manual Verification

Verify:

- Settings > Providers still lists the expected providers
- speech and transcription categories still populate correctly
- persisted providers still appear as before
- provider forms still read and write the same config values

### Optional Targeted Validation

If you want additional confidence without broad repo churn, prefer targeted checks over root-wide commands:

- `pnpm -F @proj-airi/stage-ui typecheck`

Only run broader validation if the change expands beyond the provider store area.

## Success Criteria

Phase 1 is successful when:

- `providers.ts` is materially smaller
- provider metadata no longer lives inline in the main store
- registry assembly is centralized behind a dedicated module
- the store API is unchanged for consumers
- the change remains mostly local to `packages/stage-ui/src/stores/providers*`

## Relationship to the Full Codex Plan

This document is the safe first rollout.

The full Codex plan remains the long-term target because it also separates:

- runtime services
- selector logic
- validation policy
- provider lifecycle concerns

That larger architecture should only be pursued after the project is comfortable with the Phase 1 extraction and wants to continue.

## Final Recommendation

Land this smaller phase first.

It provides a real win:

- less monolithic code
- lower edit risk
- better provider-family organization

And it does so without committing the project to a broad rewrite or a compatibility campaign across many files.

## Relevant Skills

- [[airi-provider-store-instances]]
