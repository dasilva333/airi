---
name: airi-provider-store-instances
description: "Use when working with managing providersStore, multi-instance provider accounts, providersRepo IndexedDB persistence, data boundaries, or connection validation state (useProviderValidation)."
---

# Multi-Instance Provider Store

This skill manages the state for AIRI's Multi-Instance Provider architecture, providing rules and SOPs for handling user configurations (instances), Pinia stores (`provider-catalog`, `providers`), and local-first persistence via IndexedDB.

## 1. Overview & Surface Map
### Architecture

The multi-instance architecture resolves the "Single-Slot Constraint", allowing users to register multiple endpoints of the same provider type (e.g., `Ollama: Local Mac`, `Ollama: Workstation GPU`).
- Instances are defined by `ProviderCatalogProvider` which holds an `id`, `definitionId`, `name`, `config`, and validation states.
- The `providersRepo` caches instances in IndexedDB (`local:providers`) for zero-latency startup.
- The `useProviderCatalogStore` wraps data access in `useLocalFirstRequest`, eagerly returning IndexedDB data while synchronizing with the remote cloud/backend.

## 2. Key Code Paths

- [`packages/stage-ui/src/stores/provider-catalog.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/provider-catalog.ts) - The Pinia store managing multi-instance configurations.
- [`packages/stage-ui/src/database/repos/providers.repo.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/database/repos/providers.repo.ts) - IndexedDB persistence layer.
- [`packages/stage-ui/src/composables/use-provider-validation.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/use-provider-validation.ts) - Validation logic and debouncing.
- [`docs/design-multi-instance-provider-studio.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/design-multi-instance-provider-studio.md) - Architecture design document.

## 3. Core SOPs & Guidelines

### 1. Store Management & Fetching
- When adding or removing instances, always use the Pinia actions `addProvider`, `removeProvider`, and `commitProviderConfig` in `useProviderCatalogStore`.
- Do not mutate `configs.value` directly outside of the store actions.
- Use `useLocalFirstRequest` when interacting with API endpoints to ensure the local repository (`providersRepo`) and the memory store update optimisticially.

### 2. Persistence Layer Updates
- The `providersRepo` exposes `getAll`, `saveAll`, `upsert`, and `remove`.
- Ensure changes made to local instances are subsequently flushed using `providersRepo.upsert(provider)` or `remove(id)`.
- Never bypass the repository when saving credentials; doing so breaks the `local-first` offline access.

### 3. Connection Validation & UX Guardrails
- Rely on `useProviderValidation` to manage API key verifications. It automatically handles input debouncing, manual testing modes (`runManualValidation`), and UI validation states.
- When configuring fields, be mindful of prioritizations: Local providers (e.g., LM Studio, Ollama) should surface `Base URL` primarily, while Cloud providers (e.g., OpenAI, Deepgram) prioritize `API Key`.

## 4. Known Pitfalls & Failure Modes

1. **Local-First Sync Desync:** When modifying providers, make sure both `local:` and `remote:` closures in `useLocalFirstRequest` perform identical updates to the application state to prevent jarring UI rewrites when the remote request resolves.
2. **Credential Leaks:** Be extremely cautious to avoid logging or exposing `API Keys` within unhandled promise rejections or validation error bounds.
3. **Reactivity Breakage:** Assigning a completely new object reference to an existing configuration dictionary can break reactivity if child components are bound to it. Always spread or Object.assign when mutating inner config properties.

## 5. Verification Workflows

- Validate `configs` reactivity updates dynamically when creating, editing, or deleting provider instances in the UI.
- Verify `isValidating`, `isValid`, and `validationMessage` accurately reflect the state in `useProviderValidation`.
- Run `pnpm -F stage-ui typecheck` after modifying any provider stores to guarantee interface integrity.

### Authoritative Design & Architecture Documents

- [docs/design-multi-instance-provider-studio.md](docs/design-multi-instance-provider-studio.md) — Multi-instance provider studio architecture design.
- [docs/provider-catalog.md](docs/provider-catalog.md) — Provider catalog reference.
- [docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md](docs/content/en/docs/advanced/architecture/arch-provider-store-current-structure.md) — Provider store current structure architecture.
- [docs/project-provider-store-restructuring-plan.md](docs/project-provider-store-restructuring-plan.md) — Provider store restructuring plan.
- [docs/project-codex-provider-restructuring-plan.md](docs/project-codex-provider-restructuring-plan.md) — Codex provider restructuring plan.
- [docs/project-provider-store-phase1-handoff.md](docs/project-provider-store-phase1-handoff.md) — Provider store phase 1 handoff.
- [docs/project-provider-store-phase2-handoff.md](docs/project-provider-store-phase2-handoff.md) — Provider store phase 2 handoff.
- [docs/project-provider-store-phase3-handoff.md](docs/project-provider-store-phase3-handoff.md) — Provider store phase 3 handoff.
- [docs/project-provider-store-phase4-handoff.md](docs/project-provider-store-phase4-handoff.md) — Provider store phase 4 handoff.
- [docs/project-provider-store-phase5-handoff.md](docs/project-provider-store-phase5-handoff.md) — Provider store phase 5 handoff.
- [docs/settings-yaml.md](docs/settings-yaml.md) — Canonical key→file map and yaml-manager guide.
