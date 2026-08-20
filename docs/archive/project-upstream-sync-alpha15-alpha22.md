# Selective Upstream Sync Report (March 25, 2026)

## 📊 Sync Overview
- **Baseline Upstream Head**: `4671ceaaae92f5d780319394512bf63ed01a85f1` (alpha.15)
- **Current Upstream Head**: `279b4db1` (alpha.22)
- **Total Files Changed**: ~235
- **Status**: Audit Completed.

---

## 🟢 `replace` (Safe / Direct Import)
These files contain bug fixes, i18n updates, or declarative changes that are low-risk.

| File | Change Summary |
| :--- | :--- |
| `packages/i18n/src/locales/**/*.yaml` | Massive translation updates for alpha.15-22. |
| `packages/stage-ui-three/src/composables/shader/ibl.ts` | Fixes for environment lighting. |
| `packages/stage-ui-three/src/trace/snapshots.ts` | Tracing telemetry updates. |
| `packages/ui/src/components/form/**/*.vue` | Minor layout and bug fixes for primitives. |
| `packages/stage-pages/src/pages/settings/data/status.ts` | Data health check logic updates. |

---

## 🟡 `hand-merge` (Selective Integration)
These files involve core logic where the fork has diverged or requires careful adaptation.

| File | Change Summary |
| :--- | :--- |
| `packages/stage-ui/src/stores/llm.ts` | **Critical**: Refactored tool discovery to use regex pattern matching (`isToolRelatedError`). |
| `packages/stage-ui/src/components/scenarios/settings/model-settings/vrm.vue` | Upstream added `ModelSettingsRuntimeSnapshot`. Needs adaptation for our tabbed layout. |
| `packages/stage-ui/src/stores/chat.ts` | Messaging and state serialization updates. |
| `packages/stage-pages/src/pages/settings/models/index.vue` | Scene initialization and renderer switching updates. |

---

## 🔵 `review` (Further Inspection Needed)
Major new systems or heavy refactors that require architectual review.

| File | Change Summary |
| :--- | :--- |
| `packages/stage-ui/src/stores/modules/vision/*` | New formal Vision system implementation (f4a93206). |
| `packages/stage-ui/src/composables/use-analytics.ts` | New Telemetry/Analytics system with user consent (f85a809d). |
| `packages/stage-ui/src/stores/analytics/*` | Supporting stores for the new analytics system. |
| `packages/server-sdk/src/plugins/index.ts` | Major Plugin SDK permission model refactor (a2e134d4). |

---

## ⚪ `ignore` (No Action Required)
Churn, metadata, or platform-specific work not targeted by the fork.

| File | Change Summary |
| :--- | : :--- |
| `.github/workflows/*.yml` | CI/CD workflow churn. |
| `packages/stage-pocket/**/*` | Android target scaffolding and mobile-specific fixes. |
| `nix/**/*.nix` | Hash updates for NixOS (redundant if non-Nix). |
| `sponsorkit.config.js` | Upstream sponsorship infra. |

---

## 🟠 `merge` (Full Merge)
Identical files or simple dependency bumps that can be fully accepted.

| File | Change Summary |
| :--- | :--- |
| `packages/*/package.json` | Routine dependency bumps and peerDeps fixes. |
| `vitest.config.ts` | Testing harness updates. |
| `eslint.config.js` | Linter rule updates. |

---

## 🔴 `squat` (PR Squatted)
Changes already implemented in the fork or PRs handled manually.

| File | Change Summary |
| :--- | : :--- |
| `packages/stage-ui/src/stores/providers/openrouter/audio-speech.ts` | Integrated via #1302. Already in fork. |
| `packages/stage-ui/src/libs/providers/providers/openrouter-ai/index.ts` | Integrated via #1302. Already in fork. |

---

## 🚀 Next Steps
1. **Hand-merge `llm.ts`**: Port the new `isToolRelatedError` logic into the fork's version.
2. **Review Vision & Analytics**: Decide if we want to adopt the new formal vision system or stick with our current implementation.
3. **Import i18n**: Pull the latest translations to keep characters accurate across languages.
4. **Update Baseline**: Move the baseline to `279b4db1`.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
