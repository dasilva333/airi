---
name: airi-memory-provisioning
description: >-
  Use when working with AIRI memory pillar 8 — Provisioning Sessions: provisioning-session.repo (local:memory/provisioning-session/{characterId}), the resumable lifetime-artifact build state machine (phases idle → aggregating → chunking → synthesizing → distill_pass_1 → distill_pass_2 → success), chunk-summary checkpoint persistence, resume semantics, and its pairing with the memory-lifetime pipeline. Trigger on provisioning sessions, resumable builds, lifetime artifact generation state, or provision() debugging. Hub: airi-memory-systems; the synthesis itself lives in airi-memory-lifetime.
---

# Memory Pillar 8 — Provisioning Sessions

The resumable build-state record for lifetime-artifact generation. Pillar 5 does the synthesis; this pillar tracks *how far along* it got so a long, rate-limited build can survive reloads and provider cooldowns.

## Repo & State

| Attribute | Value |
| :--- | :--- |
| Repo | `packages/stage-ui/src/database/repos/provisioning-session.repo.ts` |
| Key | `local:memory/provisioning-session/{characterId}` |
| Record | `ProvisioningSession` — `phase` state machine + persisted chunk summaries + `distillPass1Pack` |
| Phases | `'idle' | 'aggregating' | 'chunking' | 'synthesizing' | 'distill_pass_1' | 'distill_pass_2' | 'success'` (:5) |
| Data catalog | `docs/data-catalog.md` §1.9 |

## Key Mechanisms

- The lifetime store (`provision()` at memory-lifetime.ts:586) drives phase transitions; this repo persists the checkpoint after each phase.
- **Resume**: `provision(characterId, universeId, resume=true)` re-hydrates from the saved session — completed chunks are not re-summarized.
- `reprovisionFromChunks()` (:922) skips aggregation/chunking entirely, re-running distillation from saved chunks; `restart()` (:976) clears state for a clean build.
- Interval cooldown (`intervalSeconds`) between LLM steps is designed around provider rate limits — the state record is what makes interrupted builds survivable.

## Pitfalls

- Never clear provisioning state without writing an updated record — an orphaned phase makes `resume` loop or skip work silently.
- Chunk summaries are large enough that schema drift in `ProvisioningSession` breaks resume; extend the type additively.
- This repo is per-character, not per-universe — concurrent provisions across universes of one character collide. Run sequentially.
- Distill packs (`distillPass1Pack`) are persisted — `normalizeDistilledPack` (memory-lifetime.ts:134) is the repair point for legacy shapes.

## Verification

`pnpm -F @proj-airi/stage-ui typecheck`; runtime: start a provisioning run, reload the app mid-build, and confirm it resumes from the persisted phase rather than restarting.

## Sources

`docs/memory_lab/memory-engine-integration-plan.md` (3-phase provisioning milestones); `docs/memory_lab/lifetime-artifact-generation-plan.md`; `docs/data-catalog.md` §1.9; peer: `airi-memory-lifetime` (synthesis owner), `airi-memory-systems` (hub), `airi-memory-ui-pages` (provisioning triggers in UI).
