---
name: airi-conversational-pacing
description: >-
  Implement/debug thinking fillers and dynamic spoken asides: turn/attempt lifecycle, category selection, audio cache, prewarming, synthesis budgets, cancellation, answer handoff, pacing diagnostics. Ordinary speech intents use airi-speech-runtime.
---

# Conversational Pacing

Own filler eligibility and handoff while inference runs. Ordinary TTS transport belongs to [speech runtime](../airi-speech-runtime/SKILL.md); input routing belongs to [interaction pipelines](../airi-interaction-pipelines/SKILL.md).

## Source map

Paths are repository-relative. Read the relevant implementation before changing policy.

| Responsibility | Source and anchor |
| --- | --- |
| Turn eligibility, counters, retry timers | `packages/stage-ui/src/libs/pacing/turn-pacing-coordinator.ts` — `TurnPacingCoordinator` |
| Cache lookup, synthesis, decode, playback admission | `packages/stage-ui/src/libs/pacing/pacing-playback-bridge.ts` — `PacingPlaybackBridge` |
| Voice fingerprints and stored audio | `packages/stage-ui/src/libs/pacing/pacing-cache.ts` |
| Idle preparation | `packages/stage-ui/src/libs/pacing/pacing-prewarm.ts` |
| Reasoning categories | `packages/stage-ui/src/libs/pacing/category-classifier.ts` |
| Hook integration | `packages/stage-ui/src/composables/use-turn-pacing.ts` — `useTurnPacing` |
| Physical synthesis and audio scheduling | `packages/stage-ui/src/components/scenes/ControlStripHost.vue` — `synthesizePacingAudio`, `playFunction` |
| Settings, states, metrics | `packages/stage-ui/src/types/pacing.ts`, `packages/stage-ui/src/types/card.schema.ts` |

## Contracts to preserve

- Keep turn phase, clip preparation/playback state, and diagnostic display state distinct. A closed pacing window does not imply ordinary answer playback has finished.
- Reject stale generation/cue completions after asynchronous work. New turns cancel prior pacing. Recheck admission after cache lookup, synthesis, and decode, not only before starting a job.
- First answer literal closes further filler opportunities. An armed but unstarted filler yields; an already playing filler finishes before normal answer playback. Explicit cancellation/barge-in can stop playback immediately.
- `onAssistantEnd` is not the first-answer-audio timestamp. Preserve the coordinator long enough to record actual scheduling and `handoffGapMs`.
- Recoverable cache/synthesis/decode failures use `cacheMissReason`/`cacheMissError`. Do not populate terminal `cutoffReason` for a retryable miss: bridge admission checks it.
- Preserve bounded attempts, committed/spoken counters, category/phrase deduplication, and timer re-arming. Inspect current `notifyCacheMiss` rollback and retry conditions before changing accounting.
- Coordinator `onCancelFiller` calls bridge `cancelFiller`, not bridge `cancel`: the latter calls the coordinator and would recurse.
- `maxFillerSynthesisBudgetMs` budgets uncached filler preparation; `maxSynthesisBudgetMs` budgets dynamic asides. Keep defaults/bounds aligned across runtime types, card schema, and editor controls.
- Cache identity must reflect voice/provider/model and output settings. Persist fallback bytes only after successful decode and finite, positive, permitted duration.
- Resolve virtual voice profiles to physical provider/model/voice before synthesis. Preserve card-profile recovery and fail-fast handling for unresolved profiles. Never cache empty or invalid audio as a successful phrase.
- Reuse normalized reasoning events from the categorizer/chat hooks. Category evidence is not answer text and must not leak directly into ordinary TTS.

## Source versus proposal

Read `docs/proposal-conversational-pacing-thinking-fillers.md` for design rationale, identity, clocks, and intended invariants; read `docs/rosetta-stone.md` §8 for recovery lessons. The proposal contains future/experimental behavior and is not proof of implementation. For example, it describes a cached-only initial opportunity, while the current bridge supports bounded synthesis on cache miss. Do not remove that fallback merely to match the proposal. Inspect executable policy and tests for each discrepancy.

## Verification

For pacing logic, run the relevant existing tests under `packages/stage-ui/src/libs/pacing/` with `pnpm exec vitest run <test-path>`; the six suites cover coordinator, bridge, classifier, cache, prewarm, and policy. Typecheck affected stage-ui logic with `pnpm -F @proj-airi/stage-ui typecheck`.

Exercise cache hit, recoverable miss followed by another opportunity, decode failure, answer during preparation, answer during playback, cancellation during decode, and a late old-generation completion. Check diagnostics against audible behavior. Include an unresolved virtual profile and a long reasoning turn. Timing claims require runtime measurements; passing structural checks is not a latency benchmark.
