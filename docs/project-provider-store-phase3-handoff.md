# Handoff Specification: Phase 3 Multi-Instance Engine & Full Observability Eradication

**Status:** Active Handoff Spec for Kimi K3 (Approved & Finalized)
**Target Directory:** `packages/stage-ui/src/stores/providers/`
**Authors:** AIRI Team
**Related Docs:**
- [`design-multi-instance-provider-studio.md`](./design-multi-instance-provider-studio.md) — Multi-instance architecture and UX design blueprint.
- [`project-provider-store-phase2-handoff.md`](./project-provider-store-phase2-handoff.md) — Phase 2 completed store decomposition report.

---

## 1. Executive Summary & Architectural Directives

With Phase 1 (Metadata Extraction) and Phase 2 (Runtime & Selector Decomposition) fully committed, we now execute **Phase 3: Multi-Instance Engine & Full Observability Eradication**.

We are making a clean, uncompromised break from legacy anti-patterns. We are **NOT** preserving background polling, lazy auto-marking hacks, or arbitrary validation-based visibility gates.

### **Strict Directives**:
1. **Multi-Instance Store Engine (`ProviderInstanceConfig[]`)**:
   - Upgrade persisted credentials from single-slot dictionaries (`Record<string, ProviderCredentials>`) to support array-backed instance collections (`Record<string, ProviderInstanceConfig[]>`).
   - Single-slot callers (`getProviderConfig('openai')`) automatically route to the primary instance facade with **0 breaking changes**.
2. **Eradicate Observability & Background Validation (No Half-Measures)**:
   - **Delete `updateConfigurationStatus()` cold turkey**. Do NOT replace it with background loops, lazy auto-marking wrappers, or silent state mutation hacks.
   - Validation must **NEVER** dictate whether a provider is listed or visible in UI settings. Provider visibility is static, category-scoped, and driven exclusively by `registry/` metadata definitions.
   - Network requests are strictly forbidden during store initialization. Validation ONLY runs when the user explicitly clicks `[Test Connection]` or initiates an active inference turn.
3. **Eliminate String-Based Heuristics**:
   - Replace arbitrary `apiKey`/`accessKeyId`/`baseUrl` string-matching checks in `selectors/config.ts` with structured instance configuration predicates.

---

## 2. Codebase File & Path Index

| Concern | File Path | Directives |
|---|---|---|
| **Persisted State** | `packages/stage-ui/src/stores/providers.ts` | Upgrade `providerCredentials` to `ProviderInstanceConfig[]` array storage. |
| **Config Selectors** | `packages/stage-ui/src/stores/providers/selectors/config.ts` | Remove arbitrary string checks in `isProviderConfigured`. |
| **Availability Selectors** | `packages/stage-ui/src/stores/providers/selectors/availability.ts` | Drive category getters (`allChatProvidersMetadata`, `allSpeechProvidersMetadata`, `allVisionProvidersMetadata`) purely from `registry/` definitions. |
| **Lifecycle & Watchers** | `packages/stage-ui/src/stores/providers/runtime/lifecycle.ts` | **DELETE `updateConfigurationStatus()`**. Keep watcher strictly for instance cache invalidation (`disposeProviderInstance`), with ZERO automatic network refetching. |
| **Validation Runtime** | `packages/stage-ui/src/stores/providers/runtime/validation.ts` | Remove auto-marking of local providers (`markProviderAdded`) inside `validateProvider`. |
| **Instance Cache** | `packages/stage-ui/src/stores/providers/runtime/instances.ts` | Support per-instance keying (`instanceId`) while keeping primary facade for single-slot callers. |

---

## 3. Data Model & Migration Strategy

### 3.1 Multi-Instance State Shape (`ProviderInstanceConfig`)

```typescript
export interface ProviderInstanceConfig {
  instanceId: string // e.g. "ollama:local-mac" or "openai:vast-ai"
  providerId: string // Parent template ID (e.g. "ollama", "openai")
  label: string // Display label (e.g. "Workstation GPU Rig")
  options: Record<string, unknown> // Persisted API key, base URL, default options
  isPrimary?: boolean // Primary active instance flag
}
```

### 3.2 Storage Versioning Migration
- Wrap existing single-slot credentials into versioned local storage payload `{ version: 2, instancesByProvider: ... }` using the standard migration pattern established in `stores/character/`.

---

## 4. Additive API Methods for Multi-Instance

Preserve all existing 38 public API keys (routing to the primary instance facade) and expose clean additive methods for multi-instance management:

- `getProviderInstanceConfig(providerId: string, instanceId?: string)`
- `setPrimaryInstance(providerId: string, instanceId: string)`
- `validateInstance(instanceId: string)`
- `listInstances(providerId: string)`

---

## 5. Execution Plan & Sequence

- **Step 3A (Engine & Migration)**: Upgrade data structures to `ProviderInstanceConfig[]`, implement version 2 storage migration, wire primary instance facades in `selectors/` and `runtime/`, ensure typecheck and unit tests pass.
- **Step 3B (Observability Eradication)**: Delete `updateConfigurationStatus()`, remove auto-marking hacks in `validation.ts`, verify zero background network requests on store startup.
