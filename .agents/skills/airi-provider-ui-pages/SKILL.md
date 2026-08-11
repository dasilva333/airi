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
