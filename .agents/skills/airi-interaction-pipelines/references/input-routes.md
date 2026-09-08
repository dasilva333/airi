# Input routes

## Route selection

| Input | Entry / boundary | Inference |
| --- | --- | --- |
| Desktop typed text | `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue:handleSend` | `chat.ts:ingest` |
| Shared web/pocket / Whisper input | `packages/stage-ui/src/composables/use-chat-composer.ts` | `ingest` |
| App microphone STT | app stage page, hearing pipeline transcription callback | `ingest` after transcription |
| Discord classic voice | main Discord PCM capture; `stores/modules/discord.ts:onClassicSpeechCaptured` | STT then `ingest` with Discord source metadata |
| Proactivity | `packages/stage-ui/src/stores/proactivity.ts` | Separate generation; shared response/speech hooks |
| In-app / Discord Gemini voice | `packages/stage-ui/src/stores/modules/live-session.ts` | Gemini Live WebSocket |
| Typed text while Live active | `chat.ts:ingest` short-circuit | `liveSessionStore.sendText` |

Shared composer Imagine mode dispatches `runArtistTask` before ordinary ingestion; voice auto-send debounces transcription before ingestion. Inspect these branches when tracing a send that never reaches `chat.ts`.

Secondary-window input crosses `airi-chat-input-bridge`; trace `postInputBridgePayload` and `clientMessageId` acknowledgement rather than assuming each window owns a provider stream. Preserve target session and source metadata.

Ordinary ingestion captures session generation and enqueues `performSend`. Preserve generation gates while waiting for queue admission and while streaming. Desktop's `INVOKE_CHARACTER_FIRST` sentinel is an intentional first-turn path.

## Voice and autonomous inputs

Desktop microphone handling includes live media-stream and recorded-take transcription; inspect each app page before claiming equivalent support on web. Device/VAD issues belong to `airi-audio-pipeline`.

Discord classic capture starts in `apps/stage-tamagotchi/src/main/services/airi/discord/index.ts`: Opus audio is converted for transcription, then renderer ingestion carries voice-source metadata. Do not lose metadata and accidentally play a remote reply locally.

Discord Gemini listeners belong to the stage window. Preserve cold-start buffering, utterance-end signaling, and disconnect teardown. Gemini native output must suppress ordinary host TTS; custom output passes transcript through marker processing into TTS. See `airi-gemini-live-api` for the native/custom protocol.

Proactivity filters `NO_REPLY` and shares the host speech lane. It is not an independently isolated audio queue; check how a heartbeat and user turn interact. See `airi-proactivity-sensory-telemetry` for heartbeat policy.

## Verification

Reproduce the route actually affected: primary/secondary typed input, app STT, Discord classic, proactivity, or Live native/custom. Check no duplicate user turn, correct target session, retained source metadata, and one audible reply. Active Live typing must reach Live rather than opening a parallel ordinary request.

Design context: `docs/arch-chat-stt-proactivity-pipelines.md`, `docs/design-gemini-live-api-integration.md`, `docs/design-proactivity-heartbeats-engine.md`, `docs/feat-discord-revamp.md`.
