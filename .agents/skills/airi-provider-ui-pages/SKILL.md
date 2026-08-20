---
name: airi-provider-ui-pages
description: >-
  Use when building Provider Settings UI Pages, Category Cards, Inline Configuration Panels, and Live connection testing Composables.
---

# AIRI Provider UI Pages & Settings Panels

This skill provides comprehensive technical guidelines and exact code paths for constructing, styling, and debugging Provider Settings UI surfaces in AIRI.

## 1. Overview & Surface Map

AIRI exposes provider configuration panels across two primary UI surfaces:
- **Full Settings Pages**: Categorized provider management pages in `packages/stage-pages/src/pages/settings/providers/` (`chat/`, `speech/`, `transcription/`, `vision/`, `embed/`).
- **Inline Configuration Panels**: Guided credential forms in onboarding (`step-provider-configuration.vue`).

Live API connection testing is powered by `useProviderValidation`.

## 2. Key Code Paths

### Provider Settings Pages
- `packages/stage-pages/src/pages/settings/providers/` — Provider category pages (`chat/[id].vue`, `speech/[id].vue`, `transcription/[id].vue`, `vision/[id].vue`, `embed/[id].vue`).
- `packages/stage-ui/src/components/scenarios/providers/provider-settings-layout.vue` — Reusable layout host for provider credential forms.

### Inline & Onboarding Forms
- `packages/stage-ui/src/components/scenarios/dialogs/onboarding/step-provider-configuration.vue` — Inline provider setup step in onboarding.

### Validation Composables
- `packages/stage-ui/src/composables/use-provider-validation.ts` — `useProviderValidation`. Performs live connection testing, key validation, and model list fetching.

## 3. Core SOPs & Guidelines

### 1. Adding a UI Panel for a New Provider
1. Create the setting page under `packages/stage-pages/src/pages/settings/providers/<category>/<provider-id>.vue`.
2. Wrap the form in `provider-settings-layout.vue`.
3. Wire live connection testing via `useProviderValidation(providerId)`.

## 4. Known Pitfalls & Failure Modes

- **Eager API Validation**: Do NOT trigger live connection validation on every keystroke in API key text fields. Debounce key validation calls by at least 500ms to avoid API rate limits.

## 5. Verification Workflows

- **Typecheck**: `pnpm -F stage-pages typecheck`
- **Component Typecheck**: `pnpm -F @proj-airi/stage-ui typecheck`

### Authoritative Design & Architecture Documents

- [docs/design-multi-instance-provider-studio.md](docs/design-multi-instance-provider-studio.md) — Multi-instance provider studio design (UI implications).
- [docs/provider-catalog.md](docs/provider-catalog.md) — Provider catalog reference.
- [docs/project-cloud-model-browsing.md](docs/project-cloud-model-browsing.md) — Cloud model browsing project.
- [docs/arch-provider-store-current-structure.md](docs/arch-provider-store-current-structure.md) — Provider store current structure architecture.
- [docs/settings-yaml.md](docs/settings-yaml.md) — Canonical key→file map and yaml-manager guide (provider settings i18n).
- [docs/project-settings-revamp.md](docs/project-settings-revamp.md) — Settings navigation revamp & deep-search spec (quick-access bar, CMD+K settings index).

## Related Skills & References

- **Key Documents**: [[design-multi-instance-provider-studio]], [[provider-catalog]], [[project-cloud-model-browsing]], [[arch-provider-store-current-structure]], [[settings-yaml]], [[project-settings-revamp]]
