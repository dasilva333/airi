# Project Codex Plan - Provider Store Restructuring

## Plan Positioning

This document describes the full intended end-state for restructuring `packages/stage-ui/src/stores/providers.ts`.

Read this after `docs/arch-provider-store-current-structure.md`.

Current Codex handoff reference for remaining provider work:

- `CODEX_THREAD_ID`: `019d2d50-0173-7280-a3f1-8ede3442721a`

It is not intended to imply that the entire architecture should be implemented in one pass. The recommended execution strategy is incremental:

- use this document as the target architecture
- use `docs/project-provider-store-restructuring-plan.md` as the safer first implementation phase

That means this document should be read as the full rollout plan, not the first deliverable.

## Summary

`packages/stage-ui/src/stores/providers.ts` has grown into a monolithic file of roughly 3.2k lines that currently mixes provider registry definition, legacy migration glue, reactive store orchestration, provider runtime lifecycle management, model loading, validation policy, instance caching, and UI-facing selectors in one place.

That shape makes the file expensive to reason about and brittle to change. A small metadata edit can affect lifecycle logic. A runtime change can unintentionally regress provider listing behavior. The file also prevents `useProvidersStore` from acting as a clear orchestrator because the orchestration layer is buried under implementation detail.

This document proposes a progressive restructuring that keeps the existing behavior intact while turning `providers.ts` into a thin orchestration store backed by dedicated provider domain modules.

The first phase should be intentionally narrower than this full target. The safest first step is to extract metadata and registry assembly while preserving the current store API and most runtime logic in place.

## Goals

- Reduce `providers.ts` to a small orchestration layer that composes registry, runtime, and selector modules.
- Preserve current behavior during the refactor, including persisted credentials, validation behavior, model loading, and category filtering.
- Establish a canonical provider registry boundary so the store does not own provider definitions directly.
- Make speech and transcription providers follow the same architectural direction already used by `libs/providers`.
- Improve testability by moving pure logic and side-effectful runtime logic into explicit modules with narrow responsibilities.
- Make provider additions and provider-family maintenance significantly lower risk.

## Non-Goals

- Rewriting provider implementations themselves unless a small compatibility adapter is required.
- Changing user-facing provider behavior as part of the first pass.
- Converting every legacy speech or transcription provider into the `libs/providers` unified definition model in one large change.
- Redesigning the settings UI or provider forms.

## Current State

Today `packages/stage-ui/src/stores/providers.ts` is responsible for all of the following:

1. Shared types and helper utilities.
2. Hand-written provider metadata for speech and transcription providers.
3. Bridging non-speech providers from `packages/stage-ui/src/libs/providers`.
4. Computing default provider configuration values.
5. Persisting provider credentials and persisted "added" state.
6. Running provider validation, including cache and in-flight de-duplication.
7. Sending validation results to Electron IPC and surfacing toast failures.
8. Creating and disposing provider instances.
9. Fetching and normalizing model lists.
10. Providing UI-facing selectors for available, configured, and persisted providers.

The result is that the file currently acts as:

- the registry
- the runtime service layer
- the migration bridge
- the query layer
- the Pinia store

Those are separate concerns and should not live in one implementation unit.

## Primary Problems

### 1. Registry and orchestration are tightly coupled

The store owns the provider definitions directly. That means the main orchestration file must be edited whenever provider metadata changes. The orchestrator cannot stay small because it is also the largest data container in the system.

### 2. Runtime side effects are mixed with pure metadata

Validation scheduling, IPC emission, toasts, model loading, and instance disposal all sit alongside provider declaration objects. That makes it hard to reason about behavior boundaries and nearly impossible to test in isolation.

### 3. Migration architecture is incomplete

The repo already has a unified provider definition system under `packages/stage-ui/src/libs/providers` and a conversion bridge under `packages/stage-ui/src/stores/providers/converters.ts`, but `providers.ts` still acts as the compatibility host for everything that has not migrated yet. That keeps the legacy surface centralized in the worst possible file.

### 4. Selectors are embedded in the runtime store

Most provider grouping and filtering logic is pure derived querying logic. It should be implemented as pure selector helpers and merely wrapped in `computed(...)` at the store layer.

### 5. Incremental migration is harder than necessary

Because all concerns are mixed together, moving one provider family at a time requires touching a high-risk file that also contains unrelated orchestration behavior.

## Architectural Direction

The desired end state is:

- provider definitions live in registry modules
- provider lifecycle logic lives in runtime modules
- grouping and filtering logic lives in selector modules
- the Pinia store wires those modules together and exposes reactive state

In other words:

- `providers.ts` should orchestrate
- `registry/*` should define
- `runtime/*` should execute
- `selectors/*` should derive

## Design Principles

### 1. One canonical normalized provider shape

Regardless of whether a provider comes from hand-written legacy metadata or from `libs/providers`, the orchestration layer should only consume one normalized internal shape.

### 2. Progressive refactor, not rewrite

Each extraction step should preserve existing behavior and public store APIs as much as possible. The project does not need a large rewrite to get most of the benefit.

### 3. Pure logic should be isolated first

Type definitions, helper functions, registry assembly, and selectors should move first because those provide high clarity at low risk.

### 4. Side effects should be explicit

Validation, IPC emission, toasts, and provider instance caching should live in runtime modules so side effects are visible and easier to test.

### 5. Provider families should be maintainable in isolation

Speech, transcription, and other provider families should be editable in their own files without requiring broad awareness of unrelated providers.

## Proposed Target Architecture

### High-Level Shape

The target state is a small store that looks conceptually like this:

```ts
export const useProvidersStore = defineStore('providers', () => {
  const { t } = useI18n()

  const providerCredentials = useLocalStorage(...)
  const addedProviders = useLocalStorage(...)

  const registry = createProviderRegistry({ t })
  const runtime = createProviderRuntime({
    registry,
    providerCredentials,
    addedProviders,
    t,
  })
  const selectors = createProviderSelectors({
    registry,
    runtimeState: runtime.providerRuntimeState,
    providerCredentials,
    addedProviders,
    t,
  })

  runtime.initializeAll()
  runtime.installWatchers()

  return {
    providers: providerCredentials,
    addedProviders,
    ...runtime.publicApi,
    ...selectors.publicApi,
  }
})
```

This keeps orchestration in the store while moving implementation detail to dedicated modules.

## Proposed Directory Layout

```text
packages/stage-ui/src/stores/
  providers.ts
  providers/
    types.ts
    helpers.ts
    constants.ts
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
    runtime/
      index.ts
      defaults.ts
      validation.ts
      validation-policy.ts
      instances.ts
      models.ts
      initialization.ts
      watchers.ts
    selectors/
      index.ts
      categories.ts
      persistence.ts
      availability.ts
      models.ts
```

The exact filenames can change, but the responsibility boundaries should stay close to this structure.

## Module Responsibilities

### `providers.ts`

Responsibilities:

- own the Pinia store
- create reactive persisted state
- compose registry, runtime, and selectors
- expose the public store API

Should not own:

- provider definition objects
- provider-family-specific capability logic
- low-level validation implementation
- instance cache implementation
- selector logic bodies

### `providers/types.ts`

Move these here:

- `ProviderMetadata`
- `ProviderRuntimeState`
- `ModelInfo`
- `VoiceInfo`
- `SpeechCapabilitiesInfo`
- validation result types
- normalized provider registry types

This file should become the stable contract between registry, runtime, and selectors.

### `providers/helpers.ts`

Move generic helper functions here:

- `logWarn`
- `normalizeProviderBaseUrl`
- `toV1SpeechBaseUrl`
- `toProviderRootBaseUrl`
- generic category or task matching helpers if needed

These are not store responsibilities and do not need to live in the Pinia file.

### `providers/registry/index.ts`

Responsibilities:

- assemble the final provider registry map
- merge legacy and unified definitions
- apply migration policy
- expose one function such as `createProviderRegistry({ t })`

This module becomes the only place that knows how the final registry is composed.

### `providers/registry/legacy/*`

Responsibilities:

- define hand-written legacy provider metadata by family
- keep provider-specific capability and validation adapters near the provider definition

This is the main structural fix for the large metadata block currently in `providers.ts`.

### `providers/registry/unified/index.ts`

Responsibilities:

- load provider definitions from `libs/providers`
- convert them through `converters.ts`
- return normalized metadata entries

This keeps the existing unified provider work intact and turns it into one registry source instead of a store concern.

### `providers/runtime/defaults.ts`

Responsibilities:

- compute default provider config
- merge defaults with persisted config when needed

This logic is currently small but central and should be reused by selectors and initialization consistently.

### `providers/runtime/validation.ts`

Responsibilities:

- validate a provider given registry metadata and config
- maintain in-flight validation de-duplication
- update runtime state on success or failure
- optionally expose a force-validation path

This module should handle the actual validation flow.

### `providers/runtime/validation-policy.ts`

Responsibilities:

- decide whether a provider should be treated as "configured"
- determine whether failed validation should emit toasts
- determine whether Electron IPC should be notified

This separates policy from execution and makes the current behavior easier to audit.

### `providers/runtime/instances.ts`

Responsibilities:

- create provider instances
- cache provider instances
- dispose provider instances on config changes

The store should call this, not implement it inline.

### `providers/runtime/models.ts`

Responsibilities:

- fetch models for providers
- normalize returned model metadata
- set loading and error state
- expose helper methods like `loadModelsForConfiguredProviders`

This logic is already cohesive and should be isolated.

### `providers/runtime/initialization.ts`

Responsibilities:

- initialize missing provider runtime state
- initialize default persisted configs where needed

### `providers/runtime/watchers.ts`

Responsibilities:

- install the watchers that react to credential changes
- schedule validation
- trigger model refresh
- dispose instances when provider config changes

This keeps watcher orchestration explicit without bloating the store file.

### `providers/selectors/*`

Responsibilities:

- category grouping
- availability filtering
- configured filtering
- persisted filtering
- model aggregation
- dirty-config detection

These modules should be pure where possible and only receive state and helper functions as inputs.

## Recommended Registry Strategy

The provider registry should be treated as the canonical inventory of providers. The store should never manually manipulate provider definitions after the registry is created.

The flow should be:

1. Build legacy speech and transcription metadata entries.
2. Build unified entries from `libs/providers`.
3. Normalize both sources into one shared shape.
4. Merge them according to migration rules.
5. Expose a final immutable registry map to the store.

That removes the current pattern where `providers.ts` creates a large `providerMetadata` object and then mutates it later to delete some entries and repopulate others.

Instead of:

```ts
const providerMetadata = { ...large inline object... }
// mutate it later
delete providerMetadata[id]
providerMetadata[id] = translated
```

prefer:

```ts
const providerMetadata = createProviderRegistry({ t })
```

That is simpler, clearer, and safer.

## Provider Family Decomposition

The current legacy provider block should be split primarily by provider family and secondarily by shared protocol.

Recommended grouping:

- OpenAI-family speech providers
- OpenAI-family transcription providers
- browser or local runtime providers
- third-party speech providers
- third-party transcription providers

This grouping aligns better with shared logic and future migration than splitting everything into one giant `speech.ts` and one giant `transcription.ts`.

### Suggested First Family Extractions

The first extraction wave should target the largest or most bespoke providers:

- OpenAI-compatible speech and transcription
- Chatterbox
- ElevenLabs
- Player2 speech
- Kokoro local
- Aliyun NLS

Those providers contain enough custom logic that keeping them in the store is disproportionately costly.

## Runtime Data Flow

### Initialization

1. Create registry.
2. Create persisted state refs.
3. Initialize runtime state for every provider in the registry.
4. Install watchers.
5. Run initial validation pass.

### Validation Flow

1. Resolve provider metadata from registry.
2. Resolve current config from persisted credentials or defaults.
3. Check validation cache and in-flight requests.
4. Run config validation.
5. Run provider-level or connectivity validation if policy requires it.
6. Update runtime state.
7. Emit IPC or toast side effects according to policy.

### Provider Instance Flow

1. Resolve provider metadata.
2. Resolve effective config.
3. Return cached instance when valid.
4. Otherwise create a new instance via the metadata factory.
5. Cache the instance.
6. Dispose when config changes or store resets.

### Model Loading Flow

1. Resolve provider metadata and config.
2. Check if the provider supports `listModels`.
3. Set provider loading state.
4. Fetch models.
5. Normalize and de-duplicate model entries.
6. Update runtime state and clear loading state.

### Selector Flow

1. Read registry entries.
2. Read runtime state and persisted state.
3. Apply category predicates.
4. Apply availability predicates.
5. Apply configured or persisted visibility rules.
6. Return derived arrays for UI consumption.

## Recommended Public API Shape

The external store API can remain mostly compatible, but internally it should be backed by the extracted modules.

Suggested categories of public API:

- persisted state
- runtime state
- orchestration actions
- query helpers
- derived metadata collections

Examples:

- `providers`
- `addedProviders`
- `providerRuntimeState`
- `validateProvider`
- `getProviderInstance`
- `disposeProviderInstance`
- `fetchModelsForProvider`
- `loadModelsForConfiguredProviders`
- `getProviderMetadata`
- `getProviderConfig`
- `allProvidersMetadata`
- `configuredSpeechProvidersMetadata`

The key change is not necessarily what the store exposes. The key change is where that logic lives.

## Incremental Migration Plan

This refactor should be staged. The project does not benefit from a single huge restructuring diff.

### Phase 1. Extract contracts and helpers

Scope:

- move shared interfaces into `providers/types.ts`
- move helper utilities into `providers/helpers.ts`
- keep current behavior intact

Expected benefit:

- immediate reduction of file noise
- clearer module contracts
- lowest-risk first step

Execution note:

- this phase is safe to combine with the metadata extraction phase if the team wants a slightly larger but still low-risk first PR

### Phase 2. Introduce registry composer

Scope:

- add `providers/registry/index.ts`
- move the current legacy and unified registry assembly into that module
- stop mutating registry contents inside the store

Expected benefit:

- store now consumes one prebuilt registry
- migration bridge becomes explicit and testable

Execution note:

- together, Phase 1 and Phase 2 represent the recommended "safe rollout" foundation

### Phase 3. Split legacy provider metadata by family

Scope:

- move hand-written metadata entries out of `providers.ts`
- keep each provider's factory, defaults, capability adapters, and validators near one another

Expected benefit:

- largest file-size reduction
- provider edits no longer require touching the store

Execution note:

- this is still considered part of the low-risk rollout as long as provider behavior and store API remain unchanged

### Phase 4. Extract runtime services

Scope:

- move validation, model loading, instance caching, and initialization into `runtime/*`

Expected benefit:

- orchestration concerns become explicit
- runtime behavior becomes unit-testable

### Phase 5. Extract selectors

Scope:

- move availability, category, persistence, and configured-provider filtering into pure selector helpers

Expected benefit:

- less reactive clutter in the store
- cleaner testing for provider listing behavior

### Phase 6. Normalize policy seams

Scope:

- split validation execution from validation policy
- document what counts as configured versus merely present
- isolate UI side effects from validation result production

Expected benefit:

- fewer hidden coupling points
- easier future behavior changes

### Phase 7. Continue migrating legacy providers into `libs/providers`

Scope:

- one provider family at a time
- keep the registry composer as the compatibility seam during migration

Expected benefit:

- long-term convergence on one provider definition system
- store remains stable throughout migration

## Migration Mapping From Current Store Responsibilities

The following current responsibilities should move to these modules:

| Current responsibility | Proposed destination |
| :--- | :--- |
| Provider metadata block | `providers/registry/legacy/*` |
| Unified provider bridge | `providers/registry/unified/index.ts` |
| Default config resolution | `providers/runtime/defaults.ts` |
| Provider initialization | `providers/runtime/initialization.ts` |
| Validation logic | `providers/runtime/validation.ts` |
| Validation decision rules | `providers/runtime/validation-policy.ts` |
| Provider instance cache | `providers/runtime/instances.ts` |
| Model fetching and normalization | `providers/runtime/models.ts` |
| Credential watchers | `providers/runtime/watchers.ts` |
| Category grouping filters | `providers/selectors/categories.ts` |
| Persisted visibility rules | `providers/selectors/persistence.ts` |
| Availability filtering | `providers/selectors/availability.ts` |
| Shared contracts | `providers/types.ts` |
| URL and logging helpers | `providers/helpers.ts` |

## Specific Refactor Notes

### 1. Avoid mutating the registry after creation

The store should not create a mutable registry object and then delete or replace entries. Build the final registry once and treat it as the source of truth.

### 2. Keep provider-specific oddities near provider definitions

Hardcoded voice lists, custom fetch behavior, specialized connectivity checks, or bespoke capability probing should remain in provider-family files. The orchestrator should not know those details.

### 3. Keep watcher orchestration centralized

The store should still be the place where the application lifecycle wires together watchers and initialization order. Extracting watcher implementation is good. Distributing watcher ownership across multiple modules would make the system harder to follow.

### 4. Do not over-normalize too early

Some providers are genuinely different. Normalize the shape consumed by the orchestrator, but do not force provider implementations into artificial sameness if it obscures behavior.

### 5. Keep the public API stable until a follow-up cleanup

The first pass should aim to preserve the existing store surface for callers. After the internal refactor is stable, a second pass can simplify the public API if desired.

## Risks

### 1. Validation behavior regressions

Current validation logic mixes config validation, connectivity checks, configured-state heuristics, toast policy, and IPC reporting. Moving it without a clear policy split risks subtle regressions.

Mitigation:

- extract policy rules explicitly
- add focused tests around configured-state and forced-validation behavior

### 2. Provider instance lifecycle regressions

The current store disposes instances when credentials change. A refactor could accidentally retain stale instances or dispose too aggressively.

Mitigation:

- add tests around config-hash changes and instance reuse
- keep instance ownership in one dedicated runtime module

### 3. Selector behavior drift

Configured, available, and persisted provider lists drive settings UI behavior. A seemingly harmless refactor can change what appears in the UI.

Mitigation:

- extract selectors as pure functions
- snapshot or unit test the category and visibility rules

### 4. Incremental migration complexity

The project currently has both legacy provider metadata and unified provider definitions. That duality will exist for a while.

Mitigation:

- make registry composition explicit
- keep one canonical normalization step

## Testing Strategy

### Unit Tests

Add or extend tests for:

- registry composition
- default config resolution
- validation policy
- model normalization
- provider selector filtering
- instance cache behavior

These can be implemented without full Pinia setup for most modules if the logic is moved into pure helpers or narrowly scoped runtime services.

### Store-Level Tests

Add integration-style tests for:

- initializing the store with registry entries
- validating providers on credential changes
- disposing instances on config change
- refreshing model lists when configured providers change

### Manual Verification

Verify:

- Settings > Providers still lists the same providers
- configured providers still appear in the expected sections
- adding, removing, and resetting provider settings behaves the same
- speech and transcription providers with custom validation continue to behave correctly

## Verification Commands

After each migration phase:

- `pnpm -F @proj-airi/stage-ui typecheck`
- `pnpm lint:fix`

For focused test work:

- `pnpm exec vitest run packages/stage-ui/src/stores`

If new tests are added for provider modules, they should be kept targeted to the extracted module boundaries rather than requiring broad app boot.

## Success Criteria

The restructuring should be considered successful when all of the following are true:

- `providers.ts` is primarily orchestration code rather than a metadata container
- provider definitions no longer live inline in the store
- registry composition is explicit and testable
- runtime lifecycle responsibilities are isolated into dedicated modules
- selector logic is largely pure and independently testable
- the settings UI behaves the same before and after the refactor
- adding or editing a provider no longer requires editing a high-risk monolithic file

## Recommended First Implementation Slice

The best first concrete change is:

1. create `providers/types.ts`
2. create `providers/helpers.ts`
3. create `providers/registry/index.ts`
4. move the current registry assembly into the registry composer
5. keep the store otherwise behaviorally identical

That slice is small enough to land safely, immediately reduces conceptual load, and creates the architectural seam needed for the rest of the migration.

## Minimal Delivery Variant

The shorter restructuring proposal in this repo points to a valid narrower first milestone: split metadata first and defer runtime extraction until after the registry is stable.

That variant would look like this:

1. move hand-written provider metadata out of `providers.ts`
2. keep the current store runtime logic mostly intact
3. centralize metadata assembly in `providers/registry/index.ts`
4. preserve the existing conversion bridge for unified providers
5. defer runtime and selector extraction to a second pass

This is a reasonable first delivery if the team wants the fastest path to shrinking the file with minimal behavioral risk.

The tradeoff is that it solves the file-size problem faster than it solves the architectural coupling problem. The store becomes smaller, but it still owns validation flow, instance lifecycle, model loading, and selector logic.

Because of that, the recommended interpretation is:

- use the minimal delivery variant as the first landed milestone if needed
- keep the broader runtime and selector extraction plan as the intended end state

That gives the project both a low-risk immediate win and a coherent long-term architecture.

## Compatibility Guidance

This full rollout should preserve behavior, but it should not be attempted as a big-bang rewrite.

To minimize downstream risk:

- keep `useProvidersStore` in the same file and with the same exported name
- preserve the existing public store surface during the refactor
- preserve provider IDs, category behavior, and selector outputs
- preserve validation semantics before attempting policy cleanup
- keep downstream call sites unchanged during the early phases

If those constraints are followed, the first several phases can remain internal refactors local to the provider store area rather than repo-wide compatibility work.

## Final Recommendation

Treat this refactor as an architectural extraction, not a formatting cleanup. The main goal is not just to make `providers.ts` shorter. The goal is to make `useProvidersStore` the clear orchestrator of a provider system whose definitions, runtime behavior, and selectors are each maintained in the right place.

If the work is phased in the order described above, the project can get most of the maintainability benefit early without taking on the risk of a large rewrite.

## Relevant Skills

- [[airi-provider-store-instances]]
