---
name: airi-card-editor-wizard
description: >-
  Use when working with AIRI Card Editor, Character Creation Wizard guided flow, Card Import modal, guided tab navigation, schema-driven card editing, or the extensions.airi data slice in the settings/airi-card area. Key technologies: Vue 3, Pinia, Wizard tabs. File paths: packages/stage-pages/src/pages/settings/airi-card/, packages/stage-pages/src/pages/settings/airi-card/components/tabs/, packages/stage-ui/src/stores/modules/airi-card.ts, packages/stage-ui/src/types/card.schema.ts, packages/ccc/src/define/card.ts.
---

# AIRI Card Editor & Creation Wizard

Covers three surfaces: the main card editor (`index.vue`), the guided wizard (`guided.vue`), and the import dialog (`CardImportWizard.vue`).

## Surface Map

- **Main editor**: `packages/stage-pages/src/pages/settings/airi-card/index.vue`
- **Guided wizard**: `packages/stage-pages/src/pages/settings/airi-card/guided.vue` (route: `/settings/airi-card/guided`; multi-step driven by `currentStep` numeric states, not schema-enumerated tabs)
- **Import wizard**: `packages/stage-pages/src/pages/settings/airi-card/components/CardImportWizard.vue` (webview import + SillyTavern V2 metadata mapping; pulls from `chub.ai` / `characterhub.org`)

### Wizard tab components

All in `packages/stage-pages/src/pages/settings/airi-card/components/tabs/`. This is NOT a static 7-tab list:

- `CardCreationTabActing.vue`
- `CardCreationTabArtistry.vue`
- `CardCreationTabCognition.vue`
- `CardCreationTabGeneration.vue`
- `CardCreationTabIdentity.vue`
- `CardCreationTabModules.vue`
- `CardCreationTabProactivity.vue`
- `CardCreationTabTools.vue`
- `ProductionStudioTab.vue` (multi-cast / scene composer)

Stacked per step in `guided.vue` via conditional `<div v-if="currentStep === N">` wrappers, not a tab router. Wizard hard-codes four steps: Cast Selection → Roster Settings → Story Prompts → LLM Synthesis.

## Store Map

- **`useAiriCardStore`** — `packages/stage-ui/src/stores/modules/airi-card.ts`
  - Holds `activeCard`, `activeCardId`, and persistence (localforage-backed via `unstorage`)
  - All guided-wizard edits end up in `extensions.airi` on the active card
- **`useAnimaDexWizardStore`** — `packages/stage-ui/src/stores/animadex-wizard.ts`
  - Holds guided-wizard state (`currentStep`, `selectedCharacters`, `isGenerating`)

## Key Code Paths

| Path | Notes |
| :--- | :--- |
| `packages/stage-pages/src/pages/settings/airi-card/guided.vue:L77` | `currentStep` ref from `useAnimaDexWizardStore` |
| `packages/stage-pages/src/pages/settings/airi-card/guided.vue:L933-939` | Hard-coded step titles in the stepper header |
| `packages/stage-pages/src/pages/settings/airi-card/index.vue:L1215` | `CardCreationDialog` receives `:initial-tab="initialTab"`, which may come from query param `?tab=...` |
| `packages/stage-ui/src/stores/modules/airi-card.ts:L261` | `extensions` top-level field on the internal card type |
| `packages/stage-ui/src/stores/modules/airi-card.ts:L1417` | Dating-sim override of `card.scenario` (not covered here, but adjacent) |
| `packages/stage-ui/src/stores/modules/airi-card.ts:L488-495` | Canonical spread pattern for writing the `extensions.airi` slice |
| `packages/stage-ui/src/types/card.schema.ts:235` | `extensions.airi` schema |

## Core SOPs

### 1. Adding a new tab (guided wizard)

1. Create `CardCreationTab<Name>.vue` in `packages/stage-pages/src/pages/settings/airi-card/components/tabs/`.
2. The tab must expose Props / Emits or bind via `v-model` — most tabs use `v-model` on plain refs that the parent passes down.
3. In `guided.vue`, add another conditional block `v-else-if="currentStep === N"` wrapping your component, OR assign it to an existing step (some steps render multiple stacked tabs).
4. Increment `maxSteps` / adjust navigation guards in `guided.vue` if you add to the end, since it currently uses a 4-step `currentStep` guard (`1`–`4`).

### 2. Adding a new field (edit-or-preview flow)

The pattern is identical in edit and preview: the same `FieldInput` or `FieldValues` components from `@proj-airi/ui` bind to the same card object.

1. Add the field to the card schema in `packages/stage-ui/src/types/card.schema.ts` under the appropriate subsection (`data.` or `extensions.airi.`).
2. Add the UI control in the correct tab (`CardCreationTabIdentity.vue`, etc.), importing `FieldInput` / `FieldValues` from `@proj-airi/ui`.
3. Bind `v-model` to the card ref — **do not** save the whole card on each keystroke; let the store handle persistence.
4. If the field lives under `extensions.airi`, write only that slice; see `airi-card.ts:L488-495` for the spread pattern.

### 3. Writing the mutated `extensions.airi` slice (avoid stale full-card saves)

Never overwrite the entire card. Use the immutable spread update:

```ts
updateCard(id, {
  extensions: {
    ...card.extensions,
    airi: {
      ...card.extensions?.airi,
      myNewField: value,
    },
  },
} as any)
```

If you skip this, concurrent edits (e.g., another tab writing a separate `airi` key) will be clobbered by stale state.

## Known Pitfalls

- **Wizard tabs are not schema-driven.** The guided wizard is NOT driven by `card.schema.ts`; `currentStep` is a manual counter in `useAnimaDexWizardStore`. Adding a tab to the schema will NOT surface it in the wizard — you must register it in `guided.vue`.
- **Preview/model reload**: Switching between `index.vue` (editor) and `guided.vue` (wizard) requires model re-activation. `index.vue` queries `?tab=` via route; `guided.vue` restores `currentStep` from Pinia.
- **Import overwrite**: `CardImportWizard.vue` performs a wholesale card replacement when importing SillyTavern cards. This wipes `extensions.airi.*` on import unless the import-to-AIRI merge logic explicitly preserves it. Read the import mapping before assuming preserved settings.

## Verification

run after any change in this skill:

```bash
pnpm -F @proj-airi/stage-pages typecheck
pnpm -F @proj-airi/stage-ui typecheck
```
