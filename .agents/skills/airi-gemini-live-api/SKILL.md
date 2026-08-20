---
name: airi-gemini-live-api
description: >-
  Use when working with the Gemini Live API bidirectional WebSocket streaming integration,
  LiveSessionStore, google-genai sessions, real-time PCM audio in/out, sub-second multimodal
  streaming, mandatory ['AUDIO'] responseModalities rule, zero-length TTS suppression hack,
  live marker parsing, native tool calling mid-turn, and Google Search Grounding gated on
  isGroundingEnabled. Key tech: google-genai SDK, raw Bidi WebSocket, Pinia, Vue 3,
  useLlmmarkerParser, streaming categorizer. Paths:
  docs/design-gemini-live-api-integration.md,
  packages/stage-ui/src/stores/modules/live-session.ts,
  apps/stage-tamagotchi/src/renderer/pages/notice/gemini.vue.
---

# AIRI Gemini Live API Integration

Real-time, sub-second bidirectional multimodal streaming over a Bidi WebSocket using the
`google-genai` client. Replaces/augments the turn-based STT → LLM → TTS pipeline.

## Key Files/Locations

- `docs/design-gemini-live-api-integration.md` —
  canonical design doc: Mandatory AUDIO rule, verified wire formats, `google_search` tool
  key, OAuth-vs-API-key auth caveats, tool schema bridge, 5-call rate cap.
- `packages/stage-ui/src/stores/modules/live-session.ts` — `LiveSessionStore` Pinia store.
  Owns the WebSocket/`google-genai` session, `isActive`, `connect`/`sendMediaChunk`/
  `handleResponse`, the live `useLlmmarkerParser` wiring, `tryBridgeMarker` (line 355),
  tool bridging, and `isGroundingEnabled` (line 164).
- `apps/stage-tamagotchi/src/renderer/pages/notice/gemini.vue` — the notice/settings surface
  for the Gemini Live integration.
- Ground-truth verification POCs live in `scripts/gemini-live-pocs/`
  (`01-inference-rick.ts`, `02-grounding-search.ts`, `03-function-calling.ts`).

## When to Use

- Working on the live WebSocket connection lifecycle, audio I/O, or transcription handling.
- Debugging Error 1007 / 1011 disconnects — almost always a `responseModalities` violation.
- Touching Google Search Grounding, grounding metadata, or the `google_search` tool key.
- Wiring native `functionCall` / `toolResponse` mid-turn over the Bidi stream.
- Bridging pseudo-token tool markers (`<|tool|>`, `[call_tool:...]`, `<tool_call>...`) in live mode.
- Fixing "double playback" or markers bleeding into speech.

## Common Pitfalls

- **NEVER remove `'AUDIO'` from `responseModalities`** (design doc §"Mandatory AUDIO";
  enforced at live-session.ts line 506). Setting `['TEXT']` kills reasoning/tooling with
  Error 1011 or disconnects with 1007. Even in "Custom TTS" mode you MUST keep requesting
  `['AUDIO']` and ignore the incoming PCM bytes.
- **Zero-length TTS suppress hack.** In `gemini` output mode, the store MUST emit at least
  one zero-length literal to the orchestrator (`_geminiLiteralHandled`, lines 650-658) so
  `Stage.vue` sets `currentChatIntentReceivedLiteral = true`. Omitting it makes Stage.vue
  assume a non-streaming failure and run a full-text TTS fallback (the "double playback" bug).
- **Marker parsing MUST run before the categorizer/TTS.** The pipeline is raw text →
  `useLlmmarkerParser` → categorizer → TTS hooks (NOTICE lines 621-624); `onLiteral` feeds
  speech, `onSpecial` fires expressions/tools. Skipping it bleeds `<|ACT:...|>` into audio.
- **Tool key is `google_search: {}`, not `google_search_retrieval`** — the wrong key gives
  1011 or silent grounding failure (design doc Phase 2 §3).
- **Grounding is opt-in per cost.** `google_search` is only pushed when
  `isGroundingEnabled.value` is true (lines 496-498).
- **Tool calls arrive inside `serverContent.modelTurn.parts[]`** and may use camelCase
  `functionCall` OR snake_case `function_call` — scan both (NOTICE lines 711-719).
- **Auth:** the OpenAI-compatible HTTP endpoint needs an OAuth2 token (`AQ...`), but the Bidi
  WebSocket endpoint accepts a standard `AIza...` API key (design doc Phase 2 §4).


### Authoritative Design & Architecture Documents

- [docs/design-gemini-live-api-integration.md](docs/design-gemini-live-api-integration.md) — Canonical Gemini Live API integration design.
- [docs/project-multimodal-audio-transport.md](docs/project-multimodal-audio-transport.md) — Multimodal audio transport project.
- [docs/arch-chat-stt-proactivity-pipelines.md](docs/arch-chat-stt-proactivity-pipelines.md) — Chat/STT/proactivity pipelines architecture.

## Verification

- `pnpm -F @proj-airi/stage-ui typecheck` for any live-session change.
- Confirm `responseModalities: ['AUDIO']` survives a real Bidi connect without 1007/1011.
- Use the `scripts/gemini-live-pocs/` scripts as ground truth for any wire-format change.
- Toggle `isGroundingEnabled` and confirm `google_search: {}` appears only when enabled and
  that `groundingMetadata` citations are captured (line 805).
- In gemini output mode, verify exactly one zero-length literal fires per turn and no
  secondary full-text TTS pass runs.

## Related Skills & References

- **Key Documents**: [[design-gemini-live-api-integration]], [[project-multimodal-audio-transport]], [[arch-chat-stt-proactivity-pipelines]]
