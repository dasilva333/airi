# Streaming and hooks

## Sources

- `packages/stage-ui/src/stores/chat.ts`: `performSend`, stream-event handling, hook emissions.
- `packages/stage-ui/src/stores/chat/hooks.ts`: `createChatHooks`.
- `packages/stage-ui/src/composables/llm-marker-parser.ts`: `useLlmmarkerParser`.
- `packages/stage-ui/src/composables/response-categoriser.ts`: `createStreamingCategorizer`.
- `packages/stage-ui/src/components/scenes/ControlStripHost.vue`: speech/pacing hook consumers.

## Normalize once

Ordinary text deltas pass through marker parsing before categorization and speech. Special ACT/ACTOR/DELAY tokens must not leak into spoken text.

Two reasoning paths converge into normalized reasoning:

- Out-of-band `reasoning-delta` updates reasoning categorization and reasoning hooks without becoming an ordinary speech literal.
- In-band `<think>`, `<thought>`, and `<reasoning>` tags pass through the existing incremental categorizer. Its incomplete-tag handling and speech filter protect chunk boundaries.

Do not add another XML parser for pacing or UI. Feed pacing clean reasoning events from these existing paths. Preserve Unicode healing and stream positions when modifying deltas.

The configured reasoning-only fallback is a separate completion policy: when no speech remains and `reasoningFallback` permits it, reasoning may become main response content. Do not confuse this explicit fallback with accidentally leaking reasoning during streaming. Preserve UI deduplication when fallback content equals reasoning.

Retain `NO_REPLY` suppression before downstream delivery and ordered text/tool slices. Manually constructed tool calls need `index: 0` for strict OpenAI-compatible gateways; use `airi-tool-registry-builtin-tools` for tool execution contracts.

## Hook lifetime and output

The single `hooks = createChatHooks()` instance lives at module scope in `chat.ts`. Moving it inside Pinia setup can strand consumers on a stale bus during HMR. Each hook registration returns cleanup; release it with the owning component.

In `ControlStripHost.vue`:

1. Before message composition, cancel prior speech/pacing and reset per-turn state.
2. Before send, start pacing.
3. Literal arrival notifies pacing of answer onset before writing speech; special tokens enter the same intent.
4. Stream end flushes a segment; it does not end the intent.
5. Assistant response end finalizes pacing, uses fallback speech only when appropriate, then ends the intent.
6. Generation stopped cancels pacing/speech and suppresses replay of the stopped partial during subsequent completion hooks.

Intent ordering, host registration, and actor activation timing belong to [speech runtime](../../airi-speech-runtime/SKILL.md). ACT grammar belongs to [ACT tokens](../../airi-acting-cue-act-tokens/SKILL.md).

## Verification

Use existing `llm-marker-parser.test.ts` and `response-categoriser.test.ts` beside their implementations when changing parser boundaries. Test split opening/closing tags, separate reasoning deltas, reasoning-only fallback enabled/disabled, text/tool/text, ACT specials, and HMR. Verify ordinary reasoning never becomes speech except through the explicit fallback policy.
