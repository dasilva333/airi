---
name: airi-memory-ui-pages
description: >-
  Build/review memory settings UI: Short-Term/Long-Term pages, Lifetime Archives, signals, artifact previews, provisioning progress/resume/restart, character scope. Memory generation and persistence use dedicated memory skills.
---

# Memory UI Pages

Own settings presentation and job controls. Delegate generation/storage to `airi-memory-short-term`, `airi-memory-text-journal`, `airi-memory-lifetime`, and `airi-memory-provisioning`.

## Current surfaces

Paths below are relative to `packages/stage-pages/src/pages/settings/modules/`.

| Surface | Source | Store / responsibility |
| --- | --- | --- |
| Short-term | `memory-short-term.vue` | `useShortTermMemoryStore`: loading, rebuilding, progress, history/today rebuild, block deletion |
| Long-term | `memory-long-term.vue` | `useTextJournalStore`: entries, search, seeding, deletion |
| Lifetime | `memory-lifetime.vue` | `useMemoryLifetimeStore`: artifacts and provisioning dialogs |
| Signals | `memory-signals.vue` | Card `extensions.airi.dreamState` settings |
| Provisioning dialog | `components/LifetimeProvisioningModal.vue` | Start/resume/restart, progress/error/active session |
| History dialog | `components/LifetimeHistoryModal.vue` | History inspection and re-synthesis from chunks |

## Scope and state contracts

- Preserve selected-character filters. Long-term's `all` selection is explicit; do not silently replace it with the active character.
- Current lifetime dialogs pass the literal universe scope `'global'` to provisioning/re-synthesis. They are not automatically active-universe aware. Changing scope requires deliberate prop/store wiring and matching job/artifact selection; backend support alone is insufficient.
- Switching characters during a background job must not relabel the old job's progress or result as the newly selected character's.
- Keep initial loading, empty results, rebuild/provision activity, recoverable error, and completed artifacts distinct. Use store progress/error state rather than a spinner controlled only by the click handler.
- Closing a provisioning modal only updates its open state; it does not cancel the job. Do not label Close as Cancel without implementing cancellation.
- Resume uses the existing provisioning session; restart replaces/restarts work. Preserve the distinction and existing confirmations for re-synthesis/deletion.
- Long-term search uses debounced semantic search with keyword fallback. Keep stale-result handling and selected scope aligned; an empty semantic result must not leave results from another character visible.
- Signals edits should patch the relevant `dreamState` slice. Avoid saving a stale whole card and overwriting unrelated settings.

## Verification

For page changes, `pnpm -F @proj-airi/stage-pages typecheck`. Exercise no artifacts, existing artifacts, search failure/fallback, a running job, an interrupted resumable job, and a failed job. Switch characters during work, close/reopen the modal, resume, and restart. Confirm scope in store calls and persisted results. Check deletions and re-synthesis retain the intended confirmation.

## Plans versus implementation

`docs/memory_lab/memory-settings-home-page-plan.md` describes a planned four-lane hub, status strips, and budget controls. Do not treat the plan as proof those components exist. Use `rich-journal-mockups.md` in the same directory for visual intent and `docs/memory_lab/archive-index.md` for historical context.
