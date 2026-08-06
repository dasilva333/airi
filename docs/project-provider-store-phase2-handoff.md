# Handoff Specification & Final Completion Report: Phase 2 Runtime, Lifecycle & Selector Decomposition of `providers.ts`

**Status:** ✅ PHASE 2 COMPLETED & VERIFIED (Committed)
**Target File:** `packages/stage-ui/src/stores/providers.ts` (shrank from 837 lines down to 337 lines, −60%)
**Target Directory:** `packages/stage-ui/src/stores/providers/`
**Authors:** AIRI Team & Kimi K3 Subagent
**Related Docs:**
- [`project-codex-provider-restructuring-plan.md`](./project-codex-provider-restructuring-plan.md) — The canonical target architecture specification.
- [`project-provider-store-phase1-handoff.md`](./project-provider-store-phase1-handoff.md) — Phase 1 completed extraction report.

---

## 1. Executive Summary & Final Metrics

Phase 2 runtime, lifecycle, and selector decomposition of `providers.ts` is **100% complete**:

- `providers.ts` shrank from **837 lines down to 337 lines** ($\mathbf{-60\%}$ reduction).
- All **38 public store API keys** and **`export type {...}` interface re-exports** were preserved with 0 breaking changes.
- **Typecheck:** `pnpm -F @proj-airi/stage-ui typecheck` $\rightarrow$ **0 errors**.
- **Unit Tests:** `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` $\rightarrow$ **26 tests passing 100% green**.

### File Decomposition Summary

| Component | File Path | Line Count | Responsibility |
|---|---|---|---|
| **Orchestrator** | `providers.ts` | **337** | Pinia store definition & top-level setup composition |
| **Chat Local Registry** | `registry/chat-local.ts` | **187** | Extracted `vllm` and `player2` chat provider definitions |
| **Metadata Barrel** | `registry/metadata.ts` | **4** | Barrel re-export composing all 4 registries |
| **Instances Runtime** | `runtime/instances.ts` | **88** | Instance caching (`providerInstanceCache`) & disposal |
| **Models Runtime** | `runtime/models.ts` | **84** | Model list fetching & model load error handling |
| **Validation Runtime** | `runtime/validation.ts` | **150** | `validateProvider`, in-flight Map de-dup, IPC emissions & toasts |
| **Lifecycle Runtime** | `runtime/lifecycle.ts` | **148** | `initializeProvider`, `updateConfigurationStatus`, credential-hash watcher |
| **Config Selectors** | `selectors/config.ts` | **83** | `getProviderConfig`, `isProviderConfigured`, `shouldListProvider` |
| **Availability Selectors**| `selectors/availability.ts` | **87** | `configuredProviders`, `availableProvidersMetadata`, category getters |

---

## 2. Key Architectural Decisions & Solutions During Execution

1. **Restored Credential-Hash Watcher (`registerCredentialWatch`)**:
   - `runtime/lifecycle.ts` tracks `previousCredentialHashes` to detect API key changes in real time.
   - When credentials change, the watcher automatically disposes of stale cached provider instances (`disposeProviderInstance`) and fetches fresh model lists (`fetchModelsForProvider`).
2. **`vllm` + `player2` Extraction (`registry/chat-local.ts`)**:
   - Moved inline chat provider definitions into `registry/chat-local.ts`, achieving pure separation between metadata declarations and store setup logic.
3. **Acyclic Dependency Protection**:
   - `isProviderConfigured` stayed in `selectors/config.ts` so `runtime/validation.ts` can import it in a single direction, preventing circular imports with `selectors/availability.ts`.
4. **Strict Ref-Injection Discipline**:
   - State singletons (`providerCredentials`, `addedProviders`, `providerInstanceCache`, `providerRuntimeState`, `providerValidationInFlight`) are instantiated once in `providers.ts` setup and injected down into runtime/selector factories to preserve Pinia reactivity.

---

## 3. Verification Results

```bash
# Typecheck
pnpm -F @proj-airi/stage-ui typecheck
# Result: PASS (0 errors)

# Vitest Suite
pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run
# Result: PASS (6 files, 26 tests passed)
```
