# Handoff Specification: Phase 2 Runtime & Selector Decomposition of `providers.ts`

**Status:** Active Handoff Spec for Kimi K3 (Research / Engineering Subagent)
**Target File:** `packages/stage-ui/src/stores/providers.ts` (currently 837 lines post-Phase 1)
**Target Directory:** `packages/stage-ui/src/stores/providers/`
**Related Docs:**
- [`project-codex-provider-restructuring-plan.md`](./project-codex-provider-restructuring-plan.md) — The canonical target architecture specification.
- [`project-provider-store-phase1-handoff.md`](./project-provider-store-phase1-handoff.md) — Phase 1 completed extraction report.

---

## 1. Executive Summary & Objective

In Phase 1, we successfully extracted over 3,200 lines of hand-written provider metadata out of `providers.ts` into modular registry files (`speech.ts`, `transcription.ts`, `local-engines.ts`).

However, `packages/stage-ui/src/stores/providers.ts` still spans 837 lines and continues to mix three separate architectural concerns:
1. **Store Orchestration**: Pinia store definition and reactive persisted state (`providerCredentials`, `addedProviders`).
2. **Runtime Lifecycle & Side Effects**: Validation execution, instance caching/disposal, model fetching, Electron IPC emissions, and UI toast side effects.
3. **Derived Selectors**: Category predicates, configured/available filtering, and model list aggregation.

### **The Phase 2 Mission**
Decompose the remaining runtime side effects and derived selectors out of `providers.ts` into dedicated modules under `packages/stage-ui/src/stores/providers/`:
- `runtime/` (`validation.ts`, `instances.ts`, `models.ts`, `watchers.ts`)
- `selectors/` (`categories.ts`, `availability.ts`, `persistence.ts`)

This will transform `providers.ts` into a clean, lightweight (~150-line) pure Pinia orchestrator that simply composes `registry`, `runtime`, and `selectors`.

---

## 2. Strict Non-Goals & Compatibility Constraints

- ❌ **DO NOT touch user-facing UI pages** (`packages/stage-pages/src/pages/settings/providers/`).
- ❌ **DO NOT alter public store API method signatures or reactive state keys** on `useProvidersStore`. External consumers in `@proj-airi/stage-ui` and `@proj-airi/stage-pages` must continue to work without a single edit.
- ❌ **DO NOT implement multi-instance provider UI or state changes in Phase 2**. Keep `providerCredentials` and `addedProviders` persistence shapes identical.
- ❌ **DO NOT run broad formatting or `pnpm lint:fix`**. Keep the diff strictly scoped to the extracted modules and imports.

---

## 3. Proposed Directory Layout for Phase 2

Extract modules into the following structure under `packages/stage-ui/src/stores/providers/`:

```
packages/stage-ui/src/stores/providers/
├── runtime/
│   ├── index.ts               ← Aggregates runtime services and exposes orchestrator interface
│   ├── validation.ts          ← Validation execution, de-duplication, IPC, and toast side effects
│   ├── instances.ts           ← Provider instance caching, creation, and disposal
│   └── models.ts              ← Model list fetching and normalization
└── selectors/
    ├── index.ts               ← Exposes pure computed selectors
    ├── categories.ts          ← Speech, transcription, and chat category predicates
    └── availability.ts        ← Configured, added, and available provider filters
```

---

## 4. Detailed Module Responsibilities

### 4.1 `runtime/validation.ts`
- Extract `validateProviderConfig`, `validateProviderConfigSilently`, and `validateAllConfiguredProviders`.
- Keep the Electron IPC emission (`window.electronIPC?.send(...)`) and toast notification side effects inside this module.

### 4.2 `runtime/instances.ts`
- Extract `providerInstanceCache` ref, `getProviderInstance`, `disposeProviderInstance`, and `disposeAllInstances`.
- Retain exact instance creation factories and cleanup rules.

### 4.3 `runtime/models.ts`
- Extract `fetchModelsForProvider`, `loadModelsForConfiguredProviders`, and model list caching refs (`providerModels`, `providerModelsLoading`).

### 4.4 `selectors/categories.ts` & `selectors/availability.ts`
- Extract derived getters: `speechProvidersMetadata`, `transcriptionProvidersMetadata`, `configuredSpeechProvidersMetadata`, `configuredTranscriptionProvidersMetadata`, `isProviderConfigured`, etc.
- Keep derived selector bodies pure so they take `(registry, credentials, addedProviders, runtimeState)` as inputs.

---

## 5. Execution Step-by-Step

1. **Step 1: Extract `selectors/`**: Create pure helper functions for category and availability filtering. Wire `providers.ts` to compute getters via selectors.
2. **Step 2: Extract `runtime/instances.ts`**: Move instance cache ref and instance creation/disposal methods.
3. **Step 3: Extract `runtime/models.ts`**: Move model fetching and normalization logic.
4. **Step 4: Extract `runtime/validation.ts`**: Move validation execution, IPC, and toast side-effect logic.
5. **Step 5: Slim `providers.ts`**: Wire `providers.ts` to compose `createProviderRegistry(t)`, `createProviderRuntime(...)`, and `createProviderSelectors(...)`.
6. **Step 6: Verification**: Run typecheck and Vitest suite:
   ```bash
   pnpm -F @proj-airi/stage-ui typecheck
   pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run
   ```

---

## 6. Success Criteria

- `providers.ts` is reduced from 837 lines down to **~150–200 lines**.
- Store runtime behavior, IPC emissions, toast side effects, and Pinia public API remain **100% identical**.
- `pnpm -F @proj-airi/stage-ui typecheck` passes with **0 errors**.
- All 26 provider Vitest unit tests pass 100% green.
