---
name: airi-memory-ui-pages
description: "Use when working with working on Memory Settings Control Hub UI Surface, Short-Term/Long-Term Memory lanes, Lifetime Archives, and memory artifact preview cards."
---
# Airi Memory UI Pages

## 1. Overview & Surface Map

- **Pages:** `packages/stage-pages/src/pages/settings/modules/memory-short-term.vue`
- **Plans:** `docs/memory_lab/memory-settings-home-page-plan.md`

## 2. Key Code Paths

- `docs/memory_lab/memory-settings-home-page-plan.md`
- `packages/stage-pages/src/pages/settings/modules/memory-short-term.vue`

## 3. Core SOPs & Guidelines

- **Control Hub Structure:** Maintain the 4-lane structure (Short-Term Memory, Long-Term Memory, Lifetime Archive, Chips/LTMM Artifacts).
- **Status Strips:** Ensure top contract status strips accurately reflect real-time active states.
- **Lane Budgets:** Provide clear UI controls for lane budgets (token limits) and ensure constraints are enforced visually and programmatically.
- **Session Rebuilds:** Provide manual session rebuild triggers with appropriate loading overlays and safeguards.
- **Artifact Cards:** Render memory artifact preview cards consistently, reflecting the latest state of the memory chips.

## 4. Known Pitfalls & Failure Modes
### 4. Known Failure Modes & Pitfalls

- **State Stagnation:** The UI failing to react to background changes in memory state (e.g., a background summarization event).
- **Overfetching:** Loading all lifetime archives into the UI at once instead of paginating or virtualizing.
- **Ambiguous Triggers:** Unclear UI feedback during a manual session rebuild.

## 5. Verification Workflows

- Verify types and component bindings with `pnpm -F <workspace> typecheck`.
