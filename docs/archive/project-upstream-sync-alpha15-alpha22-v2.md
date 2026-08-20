# Revised Upstream Sync Report: alpha.15 → alpha.22 (Take 2)

## 📊 Comparison Basis
- **Last Synced baseline**: `4671ceaaae92f5d780319394512bf63ed01a85f1`
- **Upstream Head (Audit Target)**: `279b4db1`
- **Status**: Categorization Refined & Detailed.

---

## 🔴 `Defer` (Audit Required / High Drift)
These files have diverged significantly. Upstream introduced structural changes that require isolated planning and manual splicing to avoid nuking fork features.

| File | Reason for Deferral |
| :--- | :--- |
| `packages/stage-ui/src/stores/llm.ts` | **Massive Logic Shift**: Replaced manual retry loop with `TOOLS_RELATED_ERROR_PATTERNS` regex. High risk of breaking current tool-calling stability. |
| `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` | **Structural Conflict**: Upstream moved to a `ModelSettingsRuntimeSnapshot` prop system. We just moved to a tabbed semantic layout. Deferring until layout is stable. |
| `packages/stage-ui/src/stores/chat.ts` | **Serialization Drift**: Internal state management for messages and indexing has changed upstream. |
| `packages/stage-pages/src/pages/settings/models/index.vue` | **Initialization Divergence**: Changes to how scenes are mounted and renderer-refs are managed. |

---

## 🟡 `Hand-Merge` (Curated / Additive)
Crucial changes that must be selectively integrated to preserve local modifications.

| File | Integration Strategy |
| :--- | :--- |
| `packages/i18n/src/locales/**/*.yaml` | **Strictly Additive**: Merge new keys only. DO NOT overwrite files, as this would nuke local custom character text and persona-specific i18n logic. |
| `packages/ui/src/components/form/field/field-select.vue` | **Layout Audit**: Upstream changed `horizontal` layout from `grid-cols-3` to `grid-rows-2`. Needs review to see if it fits our current settings width. |
| `packages/stage-pages/src/pages/settings/data/status.ts` | **New Utility**: Safe to import, but needs to be linked into our local `data/index.vue` to enable the new export/import status banners. |

---

## 🟢 `Import` (Safe / Low Risk)
Non-breaking improvements or new standalone components.

| File | Change Detail |
| :--- | :--- |
| `packages/stage-ui-three/src/composables/shader/ibl.ts` | **Environment Lighting**: Safe fix for IBL (Image-Based Lighting) calculation. |
| `packages/ui/src/components/form/checkbox/*.vue` | **Utility Bump**: Simple addition of `disabled` prop support. No breaking changes. |
| `packages/ui/src/components/form/combobox/combobox.vue` | **Styling Polish**: Reduced height from `h-10` to `h-9` for a tighter UI fit. |

---

## 🔵 `Review` (Compare & Adapt)
New systems that we might want to adopt or align with, but require architectural comparison.

| File | Review Objective |
| :--- | :--- |
| `packages/stage-ui/src/stores/modules/vision/**/*` | **Vision Engine**: Upstream landed its "formal" vision system. We should compare this against our current implementation to see if we can converge for better upstream compatibility. |
| `packages/plugin-sdk/**/*` | **Plugin Permissions**: Major rewrite (PR #1423). Introduces a formal permission model and sandboxed runtimes. Necessary for long-term plugin stability. |

---

## ⚪ `Ignore` (Churn / Rejected)
Rejected features or metadata that should NOT be integrated.

| File | Reason |
| :--- | :--- |
| `packages/stage-ui/src/composables/use-analytics.ts` | **Rejected**: All analytics/telemetry systems are deferred/ignored. |
| `packages/stage-ui-three/src/trace/snapshots.ts` | **Churn**: Redundant performance tracing snapshots. |
| `packages/*/package.json` | **Preserve Configs**: Local pnpm/build configs take priority over upstream's dependency bumps. |
| `.github/workflows/*.yml` | **CI Churn**: Irrelevant to local runtime. |
| `nix/**/*`, `packages/stage-pocket/**/*` | **Surface Mismatch**: NixOS and Android/Capacitor-specific churn. |

---

## 🚀 Recommended Next Action
1.  **Port standard `disabled` props** to UI components (Safe).
2.  **Additive YAML sync** to get missing translation keys.
3.  **Perform Vision Side-by-Side** to document differences for future convergence.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
