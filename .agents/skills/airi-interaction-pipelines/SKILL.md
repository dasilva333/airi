---
name: airi-interaction-pipelines
description: >-
  Trace/debug end-to-end interaction routing: chat/voice ingestion, LLM streaming, reasoning normalization, response hooks, speech handoff, stop/cancel propagation. Use for failures spanning subsystems; chat UI uses airi-desktop-chatbox.
---

# Interaction Pipelines

Own connections between ingestion, inference, response processing, and output. Start with the failing boundary and load the matching reference.

| Task | Reference |
| --- | --- |
| Typed text, STT, Discord, proactivity, Gemini Live routing | [Input routes](references/input-routes.md) |
| Reasoning normalization, markers, response hooks, speech handoff | [Streaming and hooks](references/streaming-hooks.md) |
| Stop, partial replies, generation invalidation, abort, cleanup | [Cancellation](references/cancellation.md) |

## Boundaries

`packages/stage-ui/src/stores/chat.ts` owns turn-based orchestration. `stores/modules/live-session.ts` is a parallel Gemini Live implementation; active Live text bypasses `performSend`.

Use [speech runtime](../airi-speech-runtime/SKILL.md) for intent scheduling/host lifecycle, [pacing](../airi-conversational-pacing/SKILL.md) for fillers, [audio pipeline](../airi-audio-pipeline/SKILL.md) for synthesis/devices, and [LLM dispatch](../airi-llm-dispatch-gateway/SKILL.md) for provider requests. Do not duplicate these subsystems inside an ingestion fix.

Read `docs/arch-chat-stt-proactivity-pipelines.md` for architecture, then verify source. Its historical cancellation audit predates `stopCurrentGeneration`: Stop is implemented. All source paths in references are repository-relative; symbol anchors replace stale line numbers.

## Verification

Trace one input through its actual route and inspect history, hooks, speech, and captions. Test a second window for bridge changes. Use `pnpm -F @proj-airi/stage-ui typecheck` for orchestration changes; add the affected desktop/layout workspace only when its code changes. Follow the selected reference's failure cases.
