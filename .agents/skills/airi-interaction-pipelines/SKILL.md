---
name: airi-interaction-pipelines
description: >-
  Use when tracing, extending, or debugging end-to-end AIRI interaction flows: text chat (desktop chatbox, WhisperDock/bar, web landscape, mobile portrait), microphone STT → LLM, Discord classic voice → STT → LLM, Discord/in-app Gemini Live Bidi, proactivity heartbeats, and the downstream hook → speech-runtime → TTS-playback chain. This is a map-of-maps skill: it owns the cross-pipeline overview, ingestion routing, hook/speech-runtime plumbing, and the stop/cancel-in-flight audit. Defers to airi-audio-pipeline (TTS/STT internals), airi-gemini-live-api (Bidi details), airi-proactivity-sensory-telemetry (heartbeat/sensor), airi-discord-integration (commands/gateway), airi-caption-subsystem (caption surfaces), airi-stage-ui-surfaces (host/window shell), airi-desktop-chatbox (chatbox UI), airi-prefix-cache-alignment (prompt layout). Cites arch-chat-stt-proactivity-pipelines.md as the ground-truth source for this surface.
---

# AIRI Interaction Pipelines

Cross-cutting skill covering every route that feeds LLM inference and every route that renders output as speech. Grounded in `docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md` (the canonical source for these pipelines). Where that doc's Failure Log predates fixes, this skill records the current code reality (§8).

**Two parallel LLM implementations** exist by design: the turn-based `chat.ts` orchestrator (typed text, microphone STT, Discord classic voice, proactivity) and the **Gemini Live Bidi** implementation (app-real-time voice over WebSocket). Text ingestion auto-routes between them (§2.1); speech output routing depends on Gemini's `outputMode` (§6). AirPlay output is OS-native over system audio — no app-specific AirPlay code path exists.

---

## 1. The Route Map

```
 INPUT                                HUB                       OUTPUT
 ─────                                ───                       ──────
 1. Text (4 surfaces) ─────────────┐
 2. Mic STT (app) ─────────────────┤
 3. Discord classic voice + STT ───┼──> performSend / chat.ts  ──> useLlmmarkerParser
 4. Proactivity heartbeat + LLM ───┘     (generation-gated)      ──> hooks (module-level bus)
                                                                    ──> speech runtime intent
                                                                        ──> TTS (custom pipeline)
                                      ┌─────────────────────────
 5. Discord gemini voice ─ realtimeInput ─> live-session.ts  ──> native PCM → system audio → AirPlay
 6. In-app Gemini Live mic ─ realtimeInput    (ws Bidi)       ──> OR transcript → markers → TTS (outputMode: custom)
 7. Typed text while live active ─ short-circuit ─> liveSessionStore.sendText()
```

---

## 2. Text Orchestration Hub (`packages/stage-ui/src/stores/chat.ts`)

### 2.1 `ingest()` (:1812) — main-window routing table

1. **Gemini Live active?** → `liveSessionStore.sendText(sendingMessage)` short-circuit (:1899-1907). The text never reaches `performSend`.
2. Otherwise capture `generation = chatSession.getSessionGeneration(sessionId)`, enqueue on `sendQueue`, and run `performSend(...)` (:214-225).
3. **Secondary windows** relay input over BroadcastChannel `airi-chat-input-bridge` (`postInputBridgePayload` :1792, call sites :1827/:1888) and await a `clientMessageId` echo (5 s timeout).

### 2.2 `performSend()` (:243) — generation-gated streaming

- `shouldAbort()` = staleness check `chatSession.getSessionGeneration(sessionId) !== generation` (:425) fires at **every stream-event checkpoint** (:523, :704, :742, :920, :1027, :1045). Bumping the session generation is the canonical mid-flight termination lever (see §7).
- The stream-level `new AbortController()` (:1400) is used **only** by the idle-timeout machinery (hard 600 s ceiling, `settingsChat.streamIdleTimeoutMs`, `stores/settings/chat.ts:10`). **No UI-facing abortSignal exists — in-flight streams cannot be cancelled by the user today.**
- Delta chain: text-delta → `useLlmmarkerParser` → literal/special categorization (`createStreamingCategorizer`, speech-only category) → `emitTokenLiteralHooks` / `emitTokenSpecialHooks`.
- NO_REPLY sentinel drops the whole turn before downstream hooks (:1620-1624, also the in-stream variant at :1470-1530).
- Hook emission sites: `emitBeforeMessageComposedHooks` (:324), `emitBeforeSendHooks` (:1395), `emitTokenLiteralHooks` (:726), `emitTokenSpecialHooks` (:1055), `emitStreamEndHooks` (:1642, :1684).

### 2.3 Hooks bus — module-level (HMR lesson)

`createChatHooks()` in `packages/stage-ui/src/stores/chat/hooks.ts` defines `onBeforeMessageComposed`, `onBeforeSend`, `onTokenLiteral`, `onTokenSpecial`, `onStreamEnd`, `onAssistantResponseEnd`, `onAssistantMessage`, `onChatTurnComplete`, `onWidget` — every registration returns its own unregister function.

**The single `hooks` instance lives at chat.ts:96 (module scope), not inside the `defineStore` setup.** Reason: `useChatOrchestratorStore = defineStore('chat-orchestrator', ...)` at chat.ts:98 re-runs its setup on HMR; if the bus lived inside setup, components would stay bound to a stale bus and TTS/captions would silently die on hot reload. Do **not** move the bus back inside setup.

---

## 3. Four Text-Entry Surfaces → `ingest`

(See the `airi-desktop-chatbox` skill for surface internals; this table is the pipeline view.)

| Surface | Entry point | Ingestion path |
| --- | --- | --- |
| Desktop chatbox (`apps/stage-tamagotchi/.../InteractiveArea.vue`) | `handleSend()` :535 | `chatOrchestrator.ingest(...)` :568; empty input sends the `INVOKE_CHARACTER_FIRST` sentinel :560 |
| Web landscape / stage-pocket landscape (`packages/stage-layouts/.../Widgets/ChatArea.vue`) | `useChatComposer({ tools })` (:12, :49) → composable `handleSend` | → `ingest` |
| Portrait mobile / stage-pocket (`MobileWhisperSheet` → `WhisperComposerBar.vue`) | `useChatComposer({ tools, onSendStart, onSendError })` :106 → composable `handleSend` | → `ingest` |
| WhisperDock (desktop) | `WhisperDock.vue` → same `WhisperComposerBar` | → `ingest` |

All four converge on `ingest()` (:1812). `useChatComposer` additionally carries a voice auto-send lane (`debouncedAutoSend` :60-103) that batches transcriptions and silently dispatches via `ingest`, only returning the function when appropriate.

---

## 4. Voice → Inference Routes

### 4.1 App microphone STT → LLM → TTS

- **Desktop** (`apps/stage-tamagotchi/src/renderer/pages/index.vue`): `hearingPipeline.transcribeForMediaStream` (:516) for the live VAD lane and `transcribeForRecording` (:581) for one-shot takes; transcription deltas are mirrored to the caption subsystem via `postCaption({ type: 'caption-speaker', ... })` (:522/:530, channel `airi-caption-overlay` :460); the final transcript reaches `chatStore.ingest(...)` with the active tools — from there the flow is identical to typed text.
- **Web** (`apps/stage-web/src/pages/index.vue:87,127`): `transcribeForRecording` only (record → transcribe → ingest).

### 4.2 Proactivity heartbeat → LLM → TTS

`packages/stage-ui/src/stores/proactivity.ts`: periodic `llmStore.generate` (:709) with the compiled sensor payload, `NO_REPLY` sentinel gating (:728-735), then on a spoken turn: `emitStreamEndHooks` + `emitAssistantResponseEndHooks` (:821-822) followed by `chatSession.inscribeTurn` (:825). Proactivity reuses the same speech lane as chat (same host intent), so a heartbeat turn and a chat turn share one intent queue — there is no independent cancellation of one from the other today.

### 4.3 Discord classic voice → STT → LLM

1. **Main process** (`apps/stage-tamagotchi/src/main/services/airi/discord/index.ts`): `connection.receiver.speaking.on('start')` (:944) attaches an opus decoder (`prism.opus.Decoder`, 48 kHz stereo :969), downsamples to 16 kHz mono and broadcasts `discord-audio-chunk` IPC to all windows; on segment end it emits `discord-classic-speech-captured` with full-segment PCM (:1042).
2. **Renderer** (`packages/stage-ui/src/stores/modules/discord.ts`): `onClassicSpeechCaptured` (:2149) guards minimum clip length (:2159-2166), wraps PCM in a 16 kHz WAV header, calls `hearingPipeline.transcribeForRecording(wavBlob)` (:2216), then `chatOrchestrator.ingest(text, { metadata: _discordVoiceSource })`. From here it is the ordinary LLM path — the user sees the transcription bubble and the reply flows through §5 TTS.

### 4.4 Discord gemini voice → Gemini Live (parallel Bidi)

`packages/stage-ui/src/stores/modules/live-session.ts` registers the IPC listeners **only in the stage window** (`isStage` hash guard :1157-1159):

- `discord-audio-chunk` (:1160): active only when `discordStore.voiceCall === 'gemini'`; auto-starts `start()` (:1173), buffers chunks during cold start (:1181-1186), then `sendRealtimeAudio(base64, 'discord')` (:1184).
- `discord-audio-end` (:1190): sends `sendAudioStreamEnd()` so Gemini treats the utterance as complete (:1203).
- `discord-voice-disconnected` (:1207): auto-`stop()` closes the Bidi socket.
- Response PCM is routed back to Discord via PCM playback with `activeInputSource === 'discord'` so the playFunction forwards chunks instead of local-speaking (§5).

---

## 5. Speech Output Chain (TTS)

Layered; each layer is a distinct break point:

1. `chat.ts` stream → `emitTokenLiteralHooks(literal)` (:726).
2. **Hooks bus** (module-level instance, chat.ts:96) fans out to all registered handlers.
3. **Host** (`ControlStripHost.vue` — the current speech host; the arch-doc still names the removed `Stage.vue`): `onTokenLiteral` handler :1340 calls `ensureSpeechIntent(behavior)` (:1260, default `'interrupt'`) then writes literals into the intent; `onStreamEnd` :1359 flushes; `onAssistantResponseEnd` :1367 ends the intent. Intent write API lives in `pipeline-runtime.ts` (`writeLiteral` :167, `writeSpecial` :180, `writeFlush`, `cancel` :217).
4. **Runtime store / pipeline**: `speechRuntimeStore.registerHost(speechPipeline)` (:1138) selects the active synthesis pipeline; **`unregisterHost` on unmount** (:1450 — see §8 stale-host fix).
5. **TTS pipeline** (`packages/pipelines-audio/src/speech-pipeline.ts`): synthesizes per written segment with UST voice transformations, then hands rendered audio to the playback manager (`behavior: 'queue' | 'interrupt' | 'replace'` :61; scheduling :460-542).
6. **Playback** (`ControlStripHost.vue` `playFunction` :585): if the intent's `activeInputSource` is Discord, PCM is forwarded to the main-process AudioPlayer via `ipcRenderer.send('gemini-audio-chunk', base64)` (:578; handler :1124 in the Discord service); otherwise audio plays locally with lipsync/mouth hooks.
7. Optionally, cross-window intent replay mirrors these writes over the speech-runtime BroadcastChannel (`bus.ts`, `speechIntentCancelEvent` :39) — ordering matters: treat `onStreamEnd` as flush-only, finalize only on `assistant-end`.

**Marker-parser rule**: every LLM text stream must pass through `useLlmmarkerParser` **before** categorization/speech — otherwise `<|ACT ...>` tokens leak into TTS. `chat.ts` and `live-session.ts` both do this; any new pipeline must copy the pattern.

---

## 6. Gemini Live as the Parallel Implementation (`live-session.ts`)

Replaces `performSend` + app STT + TTS with a single Bidi stream:

- `start()` (:459, wired ~:442-609) opens the `google-genai` WebSocket; `sendRealtimeAudio` (:957) sends `audio/pcm;rate=16000` chunks (:968); `activeInputSource` tracks `'local' | 'discord'`.
- **`outputMode === 'gemini'`** (default, :165): model PCM arrives via `inlineData` (:176-177 notices 24 kHz chunking), decoded and scheduled gaplessly; literal forwarding downstream is **suppressed** (`_geminiLiteralHandled` flag :655-657) so the host TTS never double-speaks. See the `airi-gemini-live-api` skill for the full suppression protocol and zero-length-hack context.
- **`outputMode === 'custom'`**: the `['AUDIO']` response modality still applies, but the model PCM is discarded; the server transcript passes through the marker parser and the ordinary TTS chain instead.
- `stop()` (:905) closes the socket (also auto-fired on Discord voice disconnect).
- Typed text while `isActive` is short-circuited into `sendText` (§2.1), so mid-call typing transparently switches to this pipeline.
- Turn accounting writes `chatSession.inscribeTurn` (:739, :760, :938) so live turns and classic turns share one session history.

---

## 7. Stop / Cancel In-Flight — Audit (2026-08)

The stop button's gap: `WhisperComposerBar.vue` shows a red "Stop Generating" icon while `sending` (:386-389) but `onSubmit` (:233-249) **early-returns** — the stop is decorative today.

### 7.1 What already works

| Mechanism | Where | Notes |
| --- | --- | --- |
| Session-generation bump | `session-store.ts:955` `bumpSessionGeneration` | **the canonical mid-flight lever.** Every `shouldAbort()` checkpoint in `performSend` (§2.2) early-returns, so messages/triggers stop without partial-sentence flush. Called today from Discord **steer mode** (`discord.ts:738`) and `data-store.ts` session reset (:82). |
| Steer mode (proven precedent) | `discord.ts:734-756` | On an interrupting Discord message while `sending`: bump generation, roll up the partial reply as `"You were saying: …"`, then re-`ingest` 100 ms later. This is the working in-flight cancellation reference implementation. |
| Intent cancel | `pipeline-runtime.ts:217` `cancel(reason)` | Emits `speechIntentCancelEvent` (`bus.ts:39`) and marks the intent canceled; the pipeline stops synthesizing/playing that intent. Not called from product UI today. |
| Stream idle abort | `chat.ts:1400-1412` | Internal-only 600 s safety, not user-facing. |
| Gemini Live interrupt | native Bidi | Mid-call interruption must use the Live API's own turn/interrupt semantics, not generation bumping (bumps do nothing to a live Bidi turn). |
| Caption player stop | `use-speech-caption-player.ts:54` | Producer-choice bubble replay only; local to that player. |

### 7.2 Recipe for a real user-facing stop button

Changes here alter the audio/turn contract, so per AGENTS.md this is propose-first — state the plan and wait for approval before coding:

1. Add `stopCurrentGeneration(sessionId?)` next to `cancelPendingSends` in `chat.ts`: drain/cancel queued sends (`cancelPendingSends`, :1939 — today only used by maintenance/tool wipe: `use-data-maintenance.ts:69`, `chat/maintenance.ts:19`), call `chatSession.bumpSessionGeneration(sessionId)` to invalidate the in-flight `performSend`, cancel the active speech intent if one exists, and finalize `streamingMessage` as a partial assistant turn via `inscribeTurn`.
2. Wire the surfaces: `WhisperComposerBar.onSubmit` (:233), desktop `InteractiveArea.handleSend` (:535), and the `useChatComposer.handleSend` path — call `stopCurrentGeneration(activeSessionId)` when `sending` instead of early-returning.
3. Verify before coding: generation bump while a tool-call loop is inflight (checkpoints :920/:1027/:1045) must terminate cleanly without orphaned tool results or a hung `sending` state.
4. Gemini Live needs its own path (Bidi interrupt/turn-end), not this recipe.

---

## 8. Root Cause Notes (current status of the doc's Failure Log)

The arch-doc's Failure Log is the living failure reference; verify against code before quoting it, because several entries were fixed after it was written:

- **Stale hook closures on HMR** → fixed: `hooks` instance is module-level at `chat.ts:96` (§2.3). Do not regress.
- **Stale speech host registration** → fixed: `ControlStripHost` unregisters on unmount (`unregisterHost`, :1450). New hosts must pair register/unregister.
- **Marker parser bypass** → still a live rule: every new LLM stream must decode `useLlmmarkerParser` before categorization/speech (§5).
- **Gemini literal suppression** (`_geminiLiteralHandled` :655-657) prevents double-speech in `outputMode: 'gemini'`; see `airi-gemini-live-api` for the broader protocol history.
- **Decorative stop button** (§7) is the biggest unresolved latency/UX gap: in-flight chat streams have no user-facing cancellation endpoint.

---

## 9. Verification

- Pipeline plumbing (chat/hooks/speech runtime): `pnpm -F @proj-airi/stage-ui typecheck`
- Discord gateway / STT surfaces: `pnpm -F @proj-airi/stage-tamagotchi typecheck`
- Composer/layout surfaces (web/pocket): `pnpm -F @proj-airi/stage-layouts typecheck`
- Runtime re-verification for any stop/cancel change: type → reply → stop mid-stream, then a Discord steer-mode interrupt and a Gemini Live call while text is mid-flight.

---

## 10. Authoritative Documents & Peer Skills

- `docs/content/en/docs/advanced/architecture/arch-chat-stt-proactivity-pipelines.md` — ground-truth pipeline architecture and Failure Log (this skill supersedes it where code moved; see §8).
- `docs/content/en/docs/advanced/architecture/design-gemini-live-api-integration.md` — Bidi implementation design (peer skill: `airi-gemini-live-api`).
- `docs/content/en/docs/advanced/architecture/design-proactivity-heartbeats-engine.md` — heartbeat engine design (peer skill: `airi-proactivity-sensory-telemetry`).
- `docs/feat-discord-revamp.md`, `docs/content/en/docs/advanced/architecture/design-discord-bot-integration.md` — Discord gateway + voice contracts (peer skill: `airi-discord-integration`).
- `docs/feat-audio-studio.md` — UST/VoiceProfiles spec (peer skill: `airi-audio-pipeline`).
- `docs/rosetta-stone.md` §13 — BroadcastChannel registry (`airi-chat-input-bridge`, `airi-caption-overlay`, speech-runtime channels).
