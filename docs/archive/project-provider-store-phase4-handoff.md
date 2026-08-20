# Handoff Specification: Phase 4 Provider Studio UI Overhaul & Multi-Instance UI Activation

**Status:** Active Execution Handoff Spec (Steps 1, 2, & 3 Complete — Step 4 Final UI Polish Ready)
**Target Directories:**
- `packages/stage-ui/src/stores/providers/`
- `packages/stage-ui/src/components/scenarios/providers/`
- `packages/stage-pages/src/pages/settings/providers/`
**Authors:** AIRI Team
**Related Design Specs & References:**
- [`design-multi-instance-provider-studio.md`](./design-multi-instance-provider-studio.md) — Multi-instance architecture and UX design blueprint.
- [`project-provider-store-phase3-handoff.md`](./project-provider-store-phase3-handoff.md) — Phase 3 completed engine report.
- [`project-provider-store-phase5-handoff.md`](./project-provider-store-phase5-handoff.md) — Phase 5 defensive validation & migration spec.
- [`project-provider-metadata-catalog.md`](./project-provider-metadata-catalog.md) — Canonical catalog of provider descriptions, pricing, and URLs.
- [`settings-yaml.md`](./settings-yaml.md) — Canonical guide for `scripts/yaml-manager.js` translation management.

---

## 1. Executive Summary & Accomplishments

Phase 4 focuses on activating the multi-instance engine at runtime (`createProviderInstanceStore`) and delivering the **Provider Studio UI Overhaul**.

### **Completed & Verified (Steps 1, 2, & 3)**:
1. **Engine Switch Activated ("Flipped the Switch")**:
   - `packages/stage-ui/src/stores/providers.ts:38` replaced `useLocalStorage()` with `createProviderInstanceStore()`.
   - Keyed Map internal structure (`Record<providerId, Record<instanceId, Row>>`) running behind backwards-compatible facade.
   - Exposed all instance APIs (`listInstances`, `setPrimaryInstance`, `addInstance`, `removeInstance`, `setInstanceLabel`) as top-level store members.
2. **Multi-Instance UI Components**:
   - Created `provider-instances-section.vue`: renders multi-instance controls (`[+ Add Instance]`, label editing, primary selector, and deletion).
   - Created `provider-danger-zone.vue`: bottom-anchored `[Delete Credentials]` double-click confirmation dialog using `DoubleCheckButton` component.
   - Added **SSML Warning Banner**: amber alert banner injected in `speech-playground.vue`.
   - Mounted instance controls and danger zone into `speech-provider-settings.vue` and `transcription-provider-settings.vue`.
3. **Instance-Aware Model Fetching & Selector Refinements (Step 3)**:
   - Updated `fetchModelsForProvider(providerId, instanceId?)` in `runtime/models.ts` to support per-instance model targeting.
   - Restored robust credential gating in `selectors/config.ts` (`apiKey?.trim()`, AWS key pairs, custom `baseUrl`).
   - Added `isLegacy` migration guards to `instance-store.ts` to prevent empty state clobbering during Vue rehydration.
   - Tied instance deletion directly to per-instance dirty cache tracking (`${providerId}:${instanceId ?? '*'}`).
4. **Localization & i18n Protocol**:
   - All newly added translation keys (e.g. Danger Zone title, description, and button labels) are added directly via `scripts/yaml-manager.js` per `docs/settings-yaml.md` and project rules.

---

## 2. Verification Status (Step 3)

- `pnpm -F @proj-airi/stage-ui typecheck` $\rightarrow$ **PASS (0 errors)**
- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` $\rightarrow$ **PASS (26/26 tests green)**
- `pnpm -F @proj-airi/stage-pages typecheck` $\rightarrow$ **PASS (0 errors)**

---

## 3. Final Polish Tasks (Step 4 UI Polish)

1. **External Console Links**:
   - Render `[Get API Key ↗]` console header links derived from `metadata.consoleUrl`.
2. **In-Page Model Search Combobox**:
   - Build a searchable model selection combobox component inserted inside the left-side configuration panel **below Advanced Settings**.
3. **i18n Key Management**:
   - Use `scripts/yaml-manager.js` for any new translation strings per `docs/settings-yaml.md`.

---

## 4. Comprehensive Codebase File & Path Index

- [`packages/stage-ui/src/stores/providers.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers.ts) — Main store entry point (`createProviderInstanceStore` live).
- [`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts) — Multi-instance engine implementation (`instanceId` keying + facade).
- [`packages/stage-ui/src/stores/providers/runtime/models.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/models.ts) — Instance-aware model fetching (`instanceId` optional parameter).
- [`packages/stage-ui/src/stores/providers/selectors/config.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/selectors/config.ts) — Config gating & credential presence checks.
- [`packages/stage-ui/src/components/scenarios/providers/provider-instances-section.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-instances-section.vue) — Multi-instance controls component.
- [`packages/stage-ui/src/components/scenarios/providers/provider-danger-zone.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-danger-zone.vue) — Danger zone confirmation dialog component.
- [`packages/stage-ui/src/components/scenarios/providers/speech-playground.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/speech-playground.vue) — Speech playground with SSML warning banner.
- [`packages/i18n/src/locales/en/settings.yaml`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/i18n/src/locales/en/settings.yaml) — Translation keys managed via `scripts/yaml-manager.js`.

---

## 5. Verification Requirements
- `pnpm -F @proj-airi/stage-ui typecheck` -> **PASS**
- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` -> **PASS**
- `pnpm -F @proj-airi/stage-pages typecheck` -> **PASS**

## Relevant Skills

- [[airi-provider-store-instances]]
