---
name: airi-speech-runtime
description: >-
  Trace/debug speech intents, host registration, queue/interrupt/replace behavior, playback ordering, actor timing, cross-window replay, cancellation and cleanup. Voice synthesis uses airi-audio-pipeline; fillers use airi-conversational-pacing.
---

# Speech Runtime

Own the lifecycle between chat hooks and audible playback. Use [audio pipeline](../airi-audio-pipeline/SKILL.md) for synthesis/voice/device configuration, [pacing](../airi-conversational-pacing/SKILL.md) for fillers, and [interaction pipelines](../airi-interaction-pipelines/SKILL.md) for stopping inference.

## Source map

Repository-relative paths:

| Layer | Source / anchor |
| --- | --- |
| Public store | `packages/stage-ui/src/stores/speech-runtime.ts` — `useSpeechRuntimeStore` |
| Local host / remote intents | `packages/stage-ui/src/services/speech/pipeline-runtime.ts` — `createSpeechPipelineRuntime` |
| Cross-window contracts | `packages/stage-ui/src/services/speech/bus.ts` |
| Intent segmentation and scheduling | `packages/pipelines-audio/src/speech-pipeline.ts` — `createSpeechPipeline` |
| Host integration and physical output | `packages/stage-ui/src/components/scenes/ControlStripHost.vue` — `ensureSpeechIntent`, `playFunction` |
| Hook definitions | `packages/stage-ui/src/stores/chat/hooks.ts` — `createChatHooks` |

Read `docs/arch-chat-stt-proactivity-pipelines.md` for orientation and `docs/design-fix-actor-stage-desync.md` for actor timing. Verify historical assertions against source.

## Lifecycle contracts

1. `openIntent` uses the local host when registered; otherwise it creates a remote handle and emits bus messages.
2. Literal and special tokens enter the same intent stream. Preserve ordering across speech and ACT/ACTOR/DELAY effects.
3. `writeFlush` flushes a segment; it does not close the intent. The host's `onStreamEnd` flushes, and `onAssistantResponseEnd` ends.
4. `end` lets normal processing complete; cancellation must drop pending work rather than drain it. Do not substitute one for the other.
5. Before a new composed message, the host stops the old pipeline, cancels pacing/old intent, resets captions/actor state, and opens the new intent. Chat and proactivity share this lane.
6. `onGenerationStopped` cancels pacing and the current intent. Preserve its fallback-suppression state across the following assistant-end hook, so a stopped partial response is not spoken again.
7. Pair `registerHost(pipeline)` with `unregisterHost(pipeline)`. The identity argument prevents an old component's unmount from unregistering a replacement host. Release hook subscriptions and playback resources on unmount.

## Cross-window limits

The bus carries `originId`, `intentId`, `streamId`, and token sequence. The receiver ignores its own origin and maps remote IDs to host handles. It can create a fallback handle if a token arrives without a known start.

Sequence fields do not prove replay validation: the current receiver does not implement a general sequence-reordering or durable replay queue. A send before host readiness is not guaranteed buffered. Diagnose host presence, duplicate start handling, and unknown-intent behavior before promising cross-window delivery guarantees.

## Playback and actors

Keep `parserActorId` separate from `playbackActorId`. Parsed actor identity can guide upcoming synthesis, but model activation belongs to the queued ACTOR special item in `playFunction`. Otherwise a fast model changes the visible actor while the previous actor is still speaking.

Preserve queue/interrupt/replace semantics, owner/priority metadata, and the playback manager's single-voice policy. Source completion, scheduled start, inference finish, and intent end are different events. For Discord output and silent/bubble-only turns, inspect host suppression and forwarding conditions instead of assuming every intent plays locally.

## Verification

Run `pnpm exec vitest run packages/pipelines-audio/src/speech-pipeline.test.ts` for scheduler changes; typecheck affected workspaces with `pnpm -F @proj-airi/pipelines-audio typecheck` and/or `pnpm -F @proj-airi/stage-ui typecheck`.

Exercise multi-segment speech, consecutive chat/proactivity turns, Stop followed by a new turn, two actors, secondary-window input, host remount/HMR, and silent/Discord output. Assert audible order and no stale speech/captions after cancellation. Runtime bus behavior requires multi-window verification; pipeline unit tests alone do not establish it.
