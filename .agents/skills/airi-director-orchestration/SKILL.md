---
name: airi-director-orchestration
description: >-
  Implement/debug Autonomous Director decisions, Studio concept stacks, Base/Layer resolution, actor manifestations, speech overrides, scratchpad and director-note lifecycle. Image jobs use airi-artistry-comfyui-widgets; token parsing uses airi-acting-cue-act-tokens.
---

# Director and Studio Orchestration

Own scene decisions and concept resolution. Image transport stays in [artistry widgets](../airi-artistry-comfyui-widgets/SKILL.md), durable images in [image journal](../airi-memory-image-journal/SKILL.md), and token grammar in [ACT tokens](../airi-acting-cue-act-tokens/SKILL.md). Desktop Studio and Director Monitor navigation use [desktop chatbox](../airi-desktop-chatbox/SKILL.md).

## Read for the task

Repository-relative sources:

- `packages/stage-ui/src/stores/modules/artistry-autonomous.ts`: `runArtistTask`, `resolveConceptStack`, `foldConceptStack`, `activateConcept`, `resolveSpeechConfigForActor`, `applyCurrentStackManifestations`.
- `packages/stage-ui/src/types/director.ts`: `DirectorNote`.
- `packages/stage-ui/src/database/repos/director-notes.repo.ts`: note persistence.
- `packages/stage-ui/src/components/scenes/ControlStripHost.vue`: parsed actor versus playback actor and playback-time activation.
- `docs/content/en/docs/manual/config/studio.md`: author-facing Setups A/B/C and persistent expression setters.
- `docs/design-fix-actor-stage-desync.md`: model ownership and sync-gate rationale.
- `docs/design-director-producer-roles.md`: role separation. Producer suggests user replies; Director evaluates scene state. Neither is the talking assistant's tool loop.

## Scene ownership

| Setup | Physical model owner | Background owner |
| --- | --- | --- |
| A: coexisting Layer actors, place Base | ACTOR tokens at playback | Autonomous Director |
| B: no ACTOR tokens, Base outfit changes | Director's Base-sourced model | Autonomous Director |
| C: mutually exclusive Base personalities, Director off | ACTOR tokens | Concept's pinned background |

These are authoring patterns, not a universal requirement to emit ACTOR tokens. Ordinary single-character cards and Setup B must work with no tokens.

The current fold concatenates prompt snippets, resolves supplied overrides in stack order, merges active-expression maps, and tracks whether the winning model came from a Base. Preserve `modelIdFromBase`: `runArtistTask` applies a model only when that flag is true, protecting Layer actors from Director model theft.

Do not implement the manual's simplified “Base clears everything” phrase literally. Current `resolveConceptStack` preserves nonvisual identity layers, filters invalid picks, and preserves the current stack when no valid picks remain. Verify these semantics before changing wardrobe behavior.

## Execution and persistence

- `runArtistTask` performs a separate Director analysis with history, scratchpad, trigger settings, and grading threshold. Concept/module updates happen before the image-generation threshold branch; “no image generated” does not mean “no scene state updated.”
- `resolveSpeechConfigForActor` computes overrides without mutating global stores. Synthesis may run ahead of playback; it must not activate the next actor on stage early.
- `activateConcept` updates model/speech and applies a pinned background only when Autonomous Artistry is off. Preserve the model-sync guard and its explicit `nextTick` / `syncCardState(..., true)` path; do not pulse the guard false during streaming.
- `applyCurrentStackManifestations` is a manual sync path with different ownership from automated Director decisions. Do not treat it as an interchangeable helper for `runArtistTask`.
- Note mutations use repository-write-then-broadcast. `recordDirectorDecision`, `updateDirectorDecision`, and `archiveSessionNotes` carry session identity; receivers filter against the active session.
- Preserve target card/session identity across analysis and image completion. Inspect each await boundary when addressing stale results; do not assume a global `isProcessing` guard supplies cancellation or identity isolation.
- Follow existing spawn-mode handling and Dating Sim scenery overrides through the image dispatcher, rather than duplicating that routing here.

## Verification

For store/host changes: `pnpm -F @proj-airi/stage-ui typecheck`. Reproduce A, B, and C from Studio: two Layer actors speaking while Director generates; no-token outfit change; Director-off pinned-background swap. Check actor voice/model at actual playback, not just at token arrival. Confirm expression setter persistence, Base/Layer transitions, and note updates in a second window. Also switch sessions during a pending Director job and inspect where its result lands.
