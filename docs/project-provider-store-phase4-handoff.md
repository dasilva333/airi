# Handoff Specification: Phase 4 Provider Studio UI Overhaul & Multi-Instance UI Activation

**Status:** Active Execution Handoff Spec (Phase 4 Steps 1 & 2 Complete, Step 3 Ready)
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

### **Completed & Verified (Steps 1 & 2)**:
1. **Engine Switch Activated ("Flipped the Switch")**:
   - `packages/stage-ui/src/stores/providers.ts:38` replaced `useLocalStorage()` with `createProviderInstanceStore()`.
   - Exposed all instance APIs (`listInstances`, `setPrimaryInstance`, `addInstance`, `removeInstance`, `setInstanceLabel`) as top-level store members.
2. **Multi-Instance UI Components**:
   - Created `provider-instances-section.vue`: renders multi-instance controls (`[+ Add Instance]`, label editing, primary selector, and deletion).
   - Created `provider-danger-zone.vue`: bottom-anchored `[Delete Credentials]` double-click confirmation dialog.
   - Added **SSML Warning Banner**: amber alert banner injected in `speech-playground.vue`.
   - Mounted instance controls and danger zone into `speech-provider-settings.vue` and `transcription-provider-settings.vue`.
3. **i18n Keys Added**:
   - Updated `packages/i18n/src/locales/en/settings.yaml` via `scripts/yaml-manager.js` for `pages.providers.common.section.dangerZone` keys.

---

## 2. Technical Decisions & Recon Alignment

1. **Step 1 ("Flip the Switch")**:
   - **Implemented**. Line 38 in `providers.ts` is now live on `createProviderInstanceStore()`.
2. **Storage Shape**:
   - **Implemented**. Internal state is maintained as a Keyed Map (`Record<providerId, Record<instanceId, Row>>`), exposing array helpers like `listInstances(providerId)`.
3. **Delete Credentials / Reset Scope**:
   - **Implemented**. `removeInstance` deletes **only the target `instanceId`**, while `deleteProvider` performs complete family teardown via `removeAllInstances`.
4. **Model Browser Placement**:
   - **Step 3 Target**. Place the searchable model browser inside the left-side configuration panel as a dedicated section **below Advanced Settings**.

---

## 3. Step 3 Execution Objectives (Remaining Phase 4 Tasks)

1. **Smart Field Prioritization**:
   - Render `Base URL` input top for local providers (Ollama, LM Studio, ComfyUI, etc.).
   - Render `API Key` input top for cloud providers (OpenAI, Deepgram, ElevenLabs, etc.) with a `[Get API Key ↗]` console header link derived from `metadata.consoleUrl`.
2. **In-Page Model Browser**:
   - Build a searchable model selection component inserted inside the left-side configuration panel **below Advanced Settings**.
3. **Instance-Aware Model Fetching**:
   - Update `fetchModelsForProvider(providerId, { instanceId })` so model fetching targets the selected instance rather than falling back only to primary.
4. **Cache Invalidation Hygienics**:
   - Cascade-clear `providerInstanceCache` when `removeInstance` is called.

---

## 4. Comprehensive Codebase File & Path Index

- [`packages/stage-ui/src/stores/providers.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers.ts) — Main store entry point (`createProviderInstanceStore` live).
- [`packages/stage-ui/src/stores/providers/runtime/instance-store.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/providers/runtime/instance-store.ts) — Multi-instance engine implementation.
- [`packages/stage-ui/src/components/scenarios/providers/provider-instances-section.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-instances-section.vue) — Multi-instance controls component.
- [`packages/stage-ui/src/components/scenarios/providers/provider-danger-zone.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-danger-zone.vue) — Danger zone confirmation dialog component.
- [`packages/stage-ui/src/components/scenarios/providers/provider-basic-settings.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/provider-basic-settings.vue) — Basic settings component for Smart Field Prioritization.
- [`packages/stage-ui/src/components/scenarios/providers/speech-playground.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/providers/speech-playground.vue) — Speech playground with SSML warning banner.
- [`packages/i18n/src/locales/en/settings.yaml`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/i18n/src/locales/en/settings.yaml) — Translation keys managed via `scripts/yaml-manager.js`.

---

## 5. Verification Requirements
- `pnpm -F @proj-airi/stage-ui typecheck` -> **PASS**
- `pnpm -F @proj-airi/stage-ui test src/stores/providers/ --run` -> **PASS**
- `pnpm -F @proj-airi/stage-pages typecheck` -> **PASS**
