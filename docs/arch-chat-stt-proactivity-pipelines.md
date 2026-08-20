---
title: AIRI Interaction Pipelines
description: Documentation of the primary surfaces for LLM ingestion and interaction.
---
# AIRI Interaction Pipelines

Documentation of the three primary surfaces for LLM ingestion and interaction, plus the downstream speech/runtime pieces that make assistant output audible on stage.

## Relevant Files

These are the main files worth checking before debugging this pipeline family again:

- `packages/stage-ui/src/stores/chat.ts`
  - chat orchestration, streaming assembly, session writes, hook emission
- `packages/stage-ui/src/stores/chat/hooks.ts`
  - hook registration surface used by Stage, context bridge, and other consumers
- `packages/stage-ui/src/components/scenes/Stage.vue`
  - the active speech host for desktop/web stage playback, caption broadcast, special-token handling, and chat-to-TTS forwarding
- `packages/stage-ui/src/stores/modules/speech.ts`
  - speech provider/model/voice state and TTS request shaping
- `packages/stage-ui/src/stores/speech-runtime.ts`
  - Pinia wrapper over the speech pipeline runtime
- `packages/stage-ui/src/services/speech/pipeline-runtime.ts`
  - host registration, remote intent creation, and lifecycle-sensitive routing for speech intents
- `packages/stage-ui/src/services/speech/bus.ts`
  - BroadcastChannel bus for speech intent events
- `apps/stage-tamagotchi/src/renderer/pages/index.vue`
  - desktop STT ingestion path and chat trigger path
- `packages/stage-ui/src/stores/proactivity.ts`
  - heartbeat / proactive LLM execution path

## Common Failure Hoops

When "chat text appears but no speech is heard," the problem is often not inside the TTS provider itself. The output has to survive all of these hops:

1. chat response is streamed and categorized in `chat.ts`
2. chat hooks emit literal/special/end events
3. `Stage.vue` receives those hooks and opens a speech intent
4. the speech runtime routes that intent to the currently registered host pipeline
5. the speech pipeline converts text into audio buffers
6. the playback manager pushes audio through the shared `AudioContext`

If any one of those layers is stale, detached, or writing to the wrong owner, you can still see assistant text in chat while hearing nothing.

## 1. Chat UI Pipeline
- **Surface**: `packages/stage-layouts/src/components/Widgets/ChatArea.vue`
- **Trigger**: Direct text input by the user through the chat box.
- **Tools**:
  - `ChatArea.vue` itself is tool-agnostic and only forwards whatever `tools` prop it receives.
  - In Tamagotchi, the active chat entry surfaces now pass `builtinTools`, which currently includes both `stage_widgets` and `text_journal`.
- **Execution**: Calls `chatStore.ingest(text, options)`.
- **Inscription**: Handled by `performSend` in `chatStore.ts` which adds the message to the current session history and triggers the assistant response (unless `skipAssistant: true`).
- **Speech Handoff**: Assistant output is not spoken directly from the chat widget. `performSend` emits hook events which `Stage.vue` consumes and forwards into the speech runtime.

## 2. Microphone Pipeline (STT -> LLM)
- **Surface**: `apps/stage-tamagotchi/src/renderer/pages/index.vue` and `apps/stage-web/src/pages/index.vue`.
- **Trigger**: Voice activity detection (VAD) or manual microphone trigger.
- **Flow**:
  1. `hearingPipeline.transcribeForMediaStream` processes audio.
  2. `onSentenceEnd(delta)` callback receives the transcription.
  3. Transcription is posted to the caption overlay broadcast channel.
  4. Calls `chatStore.ingest(text, { tools: builtinTools, ... })` in Tamagotchi.
- **Tools**:
  - In Tamagotchi, the STT pipeline now forwards `builtinTools`, so it inherits the same registered builtin toolchain as typed chat.
  - That means STT-triggered assistant turns can use `stage_widgets`, `text_journal`, and future builtin tools without extra per-tool wiring.
  - `ChatArea.vue` remains generic; if another surface wants tool access, it must still pass a tools resolver explicitly.
- **Note**: The main page (`index.vue`) handles ingestion directly for voice. It no longer delegates to the hearing drawer to ensure consistency.

## 3. Proactivity Pipeline (Heartbeat -> LLM)
- **Surface**: `packages/stage-ui/src/stores/proactivity.ts`
- **Trigger**: Periodic heartbeat check (based on idle time or sensor changes).
- **Tools**:
  - Dynamic registration via `proactivityStore.registerTools(tools)`.
  - In Tamagotchi, `App.vue` now registers `builtinTools`, not just `widgetsTools`.
  - That means heartbeat/proactivity turns currently receive the same builtin toolchain as normal chat and STT-triggered chat.
- **Execution**: Direct call to `llmStore.generate(...)`. Supports UI presence via `chatStore.streamingMessage` updates during generation.
- **Inscription**: Handled by `chatSession.inscribeTurn(message)` to ensure reactivity and persistence.
- **Context**: Injected sensor data (location, time, computer metrics) into the prompt to evaluate if the agent should proactively interact.
- **Multi-step**: Supported via `maxSteps: 10` in `llmStore.generate` to allow complex tool-use logic during heartbeats.

## Current Toolchain Reality

For the Tamagotchi renderer today:

- typed chat uses `builtinTools`
- STT-triggered chat uses `builtinTools`
- proactivity registers `builtinTools`

So those three pipelines are aligned and do not currently require per-tool micro-management when a new builtin tool is added.

The important nuance is:

- this guarantee applies to surfaces that explicitly use `builtinTools`
- generic chat surfaces like `ChatArea.vue` are still caller-driven and do not auto-discover tools on their own

## 4. Gemini Live Native Audio Pipeline
- **Surface**: `packages/stage-ui/src/stores/modules/live-session.ts`
- **Output Mode**: The `outputMode` setting dictates how assistant audio is handled.
  - **`gemini` mode**: The setup message requests `responseModalities: ['AUDIO']`. Gemini streams down PCM16 audio via `inlineData`. `live-session` decodes the chunks and schedules them gapless via the shared `AudioContext`.
    - **CRITICAL HACK (TTS Fallback Suppression)**: When in `gemini` mode, `live-session` deliberately stops emitting streaming text literals to `ChatOrchestrator` because the audio is already playing natively. However, `Stage.vue` has a built-in safety net: if a turn completes with zero literals received, it assumes the stream failed and triggers a full-text TTS fallback recovery. To prevent this "double playback" bug, `live-session` must emit a single zero-length string (`''`) literal at the start of the turn. This trips the `currentChatIntentReceivedLiteral` flag in `Stage.vue`, effectively muting the Custom TTS without triggering the fallback.
  - **`custom` mode**: **CRITICAL**: The setup message MUST STILL request `responseModalities: ['AUDIO']`. Although we are using a Custom TTS pipeline, the Gemini Bidi endpoint requires the audio modality to be active for its reasoning and tool-calling engine to stay connected. In this mode, we simply ignore the incoming `inlineData` PCM chunks and pipe the raw transcript text through the standard Marker Parser → TTS hook chain.
- **Marker Parser requirement**: Regardless of `outputMode`, *all* Gemini Live output runs through `useLlmmarkerParser`. This guarantees that expression markers (e.g., `<|ACT...|>`) are correctly intercepted and emitted as special tokens, preventing them from bleeding into the audible text or the raw UI transcript. In `gemini` mode, literal text tokens are simply not forwarded to the Stage's Custom TTS hooks because the audio is already playing natively.

## Speech Runtime Notes

- `Stage.vue` is the current speech host. It registers a speech pipeline with `speechRuntimeStore.registerHost(...)`.
- Chat hook handlers in `Stage.vue` write streamed literals and special tokens into a speech intent.
- The speech runtime can operate as either the local host or a remote-intent forwarder over BroadcastChannel.

### Root Cause Log: "Chat visible, no audible TTS"

One recurring root cause in this workspace was stale speech-host ownership across Stage remounts.

Failure mode:
- `Stage.vue` registered a speech host pipeline
- the component later unmounted/remounted
- the old host registration could remain alive inside `pipeline-runtime.ts`
- new chat output still rendered normally through the chat pipeline
- but TTS intents could continue targeting the stale host pipeline owned by the dead Stage instance

Observed symptom:
- assistant reply appears in chat
- no speech is heard
- a renderer refresh may not fix it
- full app restart can temporarily fix it because the stale runtime state is blown away

Fix direction:
- allow the speech runtime host to be replaced
- unregister the host when `Stage.vue` unmounts
- keep the pipeline doc updated with the runtime/file map so future debugging starts from the right layer

Another observed failure mode is the remote stream replay path reaching `assistant-end` without ever delivering `token-literal` events to the receiving Stage.

Failure mode:
- remote stream lifecycle events like `before-send`, `stream-end`, and `assistant-end` arrive
- no `token-literal` events are replayed for that turn
- the Stage opens and closes a speech intent with nothing to synthesize
- the chat UI can also end up showing raw `<|ACT|>` markers because the final replayed message is not reconstructed from clean speech literals

Observed symptom:
- assistant reply is visible
- no audible TTS
- ACT tokens and other special markers can bleed into the visible chat transcript

Fix direction:
- recover final speech text from `assistant-end` when literals are missing
- feed that recovered speech back through the normal token-literal path
- avoid finalizing remote replay from raw unsanitized assistant text alone

Another recurring failure mode is malformed ACT markers emitted inside normal assistant `content` chunks.

Failure mode:
- the provider streams ACT tags inline with normal assistant content, which is expected
- some cards/prompts taught the model a legacy malformed close of `>` instead of `|>`
- `llm-marker-parser.ts` would stay stuck in tag mode waiting for `|>`
- no literal chunks were emitted to the chat/TTS hooks for the rest of the reply
- `parser.onEnd` then fell back to the full raw text blob, causing ACT tokens to leak into visible chat

Observed symptom:
- `text-delta` events keep arriving normally
- `parser.onEnd` logs a large full-text length while `buildingMessage.content` is still empty
- ACT tokens appear in the chat transcript
- TTS remains silent because no literal speech was ever forwarded

Fix direction:
- keep ACT markers in normal `content` chunks
- make the parser/runtime tolerant of both `<|ACT...|>` and legacy `<|ACT...>` closes
- normalize legacy markers to the canonical `|>` form before downstream handling

Another failure pattern to watch is shared speech-lane contamination between chat and proactivity.

Failure mode:
- chat and proactivity both route through the same Stage speech hooks and host pipeline
- a previous turn can leave an active or queued speech intent behind even after audible playback stops
- the next chat turn resets only playback, not the underlying speech pipeline state
- later TTS can appear to "randomly" die until the whole app is restarted

Observed symptom:
- fresh restart: chat TTS works
- proactivity speaks a few times
- later chat text still appears but no speech is heard
- full process restart restores speech temporarily

Fix direction:
- reset the full speech pipeline, not just playback, at the start of each new assistant turn
- treat proactivity and chat as sharing one speech lane unless/until they get separate pipeline ownership

Another replay-specific failure mode is missing remote start events with later literal events still arriving.

Failure mode:
- one renderer/window broadcasts a remote chat stream
- the receiver misses or drops `before-send`
- later `token-literal` events still arrive
- the receiver currently expects an existing replay guard and can discard the rest of the speech turn

Observed symptom:
- sender logs show `Broadcasting token-literal`
- visible chat in the sending surface still works
- the Stage/TTS host in the other surface stays silent because it never opened replay state

Fix direction:
- allow the receiver to lazily create remote replay state from the first `token-literal` or `assistant-end`
- do not make remote TTS depend on perfect delivery of the initial start event

Another remote replay failure mode is tearing down the receiver state on `stream-end` before `assistant-end`.

Failure mode:
- the receiver successfully gets remote `token-literal` events and starts speaking
- `stream-end` arrives and clears replay guard state immediately
- `assistant-end` arrives afterward and reopens replay state as if no literals were ever received
- fallback speech recovery injects the entire assistant response again as one big literal

Observed symptom:
- chat TTS appears to work after restart, but later turns can speak twice
- the Stage logs show normal `token-literal` forwarding and then one huge `onTokenLiteral` during `assistant-end`
- the duplicated final literal often contains the whole response, including legacy ACT text if present in raw output

Fix direction:
- treat `stream-end` as a flush hook only for remote replay
- keep replay guard and `remoteStreamReceivedLiteral` alive until `assistant-end`
- only finalize the remote stream and clear replay state in `assistant-end`

Another failure pattern is stale hook closures during HMR (Hot Module Replacement).

Failure mode:
- the `hooks` event bus in `chat.ts` is initialized inside the `defineStore` setup function
- when `chat.ts` is edited, Vite/Pinia replaces the store by re-running the setup function, creating a NEW `hooks` instance
- `Stage.vue` (the TTS host) is long-lived and remains bound to the listener registration functions of the OLD store instance
- the New Store emits tokens to its New Hooks, but `Stage.vue` is still "listening" to the defunct Old Hooks

Observed symptom:
- user-typed chat messages appear in the UI but trigger no audio
- proactivity (heartbeats) can intermittently remain audible if the proactivity store is still holding a reference to the old `chatStore` instance
- full app restart or renderer refresh restores the connection

Fix direction:
- hoist the `hooks` object to module-level scope in `chat.ts`
- this ensures the singleton event bus instance persists even when the Pinia store is re-instantiated during HMR
- components remain bound to the same stable event bus regardless of store replacement
Another failure pattern is bypassing the mandatory marker-parser layer in new pipelines.

Failure mode:
- A new ingestion surface (like `live-session.ts`) pipes raw LLM/transcription text directly to the `createStreamingCategorizer` to handle thought filtering.
- The `createStreamingCategorizer` is strictly an XML/HTML tag parser and intentionally ignores/ignores markers like `<|ACT:...|>`.
- It expects that the `useLlmmarkerParser` has already processed the stream and emitted those as special tokens.
- Without the marker-parser layer, ACT markers bleed directly into the literal speech output and are spoken aloud by the TTS.

Observed symptom:
- The agent says "Yeah hey ACT emotion dot intensity dot 1 Richard" out loud.
- Expressions/animations in the markers do not trigger because they were never intercepted as special tokens.

Fix direction:
- Always chain `useLlmmarkerParser` as the very first layer for any LLM text stream.
- Route `onLiteral` → `categorizer.consume()` and `onSpecial` → `emitTokenSpecialHooks`.
- This ensures markers are stripped safely before speech evaluation and categorized tags are handled correctly.

Another failure pattern is the **Initialization Deadlock** in the renderer startup.

Failure mode:
- High-level services (like `useModsServerChannelStore`) are initialized in `App.vue` before the critical infrastructure (`contextBridgeStore`).
- The `serverChannelStore.initialize()` promise waits indefinitely for a WebSocket authentication packet (`module:authenticated`).
- If the server is slow, down, or authentication is blocked, the entire `onMounted` hook in `App.vue` hangs.
- The `ContextBridge` is never initialized, making the window "deaf" to all cross-process token broadcasts from the Chat window.

Observed symptom:
- The Chat window logs show `Broadcasting token-literal`.
- The Stage window shows startup logs up to `Initializing server channel store`, then goes silent.
- No `[PipelineTTS:Bridge]` or `[PipelineTTS:Stage]` logs appear in the receiver devtools.
- Chat text appears in the Chat UI, but no TTS is heard.

Fix direction:
- **Prioritize Infrastructure**: Move `contextBridgeStore.initialize()` to the very top of the `onMounted` sequence in `App.vue`.
- **Implement Safety Timeouts**: Add a default timeout (e.g., 5000ms) to every initialization promise in higher-level stores (`channel-server.ts`) to ensure the app continues to boot even if a service is unreachable.

## Relevant Skills

- [[airi-gemini-live-api]]
- [[airi-interaction-pipelines]]
- [[airi-llm-dispatch-gateway]]
- [[airi-proactivity-sensory-telemetry]]
- [[airi-tool-registry-builtin-tools]]
