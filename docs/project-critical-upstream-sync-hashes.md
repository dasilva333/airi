# Selective Upstream Sync Report: alpha.15 → alpha.22

## 📊 Comparison Basis
- **Baseline Upstream Head**: `4671ceaaae92f5d780319394512bf63ed01a85f1` (alpha.15)
- **Current Synced Head**: `279b4db1` (alpha.22)
- **Sync Method**: Selective "Baby Steps" (Manual Ports)

---

## 🟢 Integrated (Phase 1: Baby Steps)
The following safe, non-breaking improvements have been successfully ported and verified via `pnpm typecheck`.

| File | Status | Change Summary |
| :--- | :--- | :--- |
| `packages/stage-ui-three/src/composables/shader/ibl.ts` | **Synced** | Ported upstream IBL shading math fixes. |
| `packages/ui/src/components/form/checkbox/checkbox.vue` | **Synced** | Added `disabled` prop support. |
| `packages/ui/src/components/form/field/field-checkbox.vue` | **Synced** | Forwarded `disabled` prop to internal checkbox. |
| `packages/ui/src/components/form/combobox/combobox.vue` | **Synced** | Refined height (`h-9`) and z-index handling. |
| `packages/stage-pages/src/pages/settings/data/status.ts` | **New** | Added status reporting utility for settings. |

---

## 🟡 Deferred / Pending
These files remain at the alpha.15 baseline due to significant logic drift or rejected features.

| File | Reason for Deferral |
| :--- | :--- |
| `packages/stage-ui/src/stores/llm.ts` | **Refactor Drift**: Massive shift in tool discovery logic. Needs manual splice. |
| `packages/stage-ui/src/stores/chat.ts` | **Serialization**: Internal message state changes. |
| `packages/stage-ui/src/composables/use-analytics.ts` | **Rejected**: Telemetry/Analytics are explicitly ignored. |
| `packages/plugin-sdk/**/*` | **Arch Review**: Major permission model rewrite. |

---

## 🚀 Next Sync Objectives
1. Perform additive YAML sync (merge new keys only).
2. Side-by-side review of the new Vision Engine.
3. Hand-merge structural updates to Model Settings layout if needed.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
