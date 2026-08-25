# Stop / Cancel In-Flight Chat Generation — Design & Working Journal

> **Status:** Implemented (2026-08-24) — awaiting runtime verification. See §9 Implementation Journal.
> **Working journal:** this document tracks the design, decisions, and implementation progress for user-facing cancellation of in-flight LLM generations. Update it as work lands.
> **Scope:** starts in the desktop chatbox, broadens to web/pocket portrait & landscape, and the WhisperDock in the actor stage.

---

## 1. Problem Statement

AIRI has **no user-facing way to cancel an in-flight chat generation** on any classic (turn-based) text surface:

- The desktop chatbox composer (`apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue`) has no stop UI at all — only the images popover and the Producer wand sit in the composer button cluster.
- `packages/stage-ui/src/components/scenarios/chat/WhisperComposerBar.vue:386` renders a red "Stop Generating" icon while `sending`, but `onSubmit` (:233-249) **early-returns** — the stop button is decorative today.
- The only `AbortController` in the send path (`packages/stage-ui/src/stores/chat.ts:1426`) serves the internal 600s idle-timeout safety (`settingsChat.streamIdleTimeoutMs`) — it is not reachable from UI.

If the model rambles, a tool loop spins, or the user changes their mind, the only recourse today is to wait (or reset the session, which nukes history).

---

## 2. Current Architecture Audit (verified against code, 2026-08)

### 2.1 The streaming engine

`performSend()` in `packages/stage-ui/src/stores/chat.ts:258` is the single classic-pipeline streaming engine:

- Single global `sending` flag: `ref(false)` at :223, set `true` at :480, cleared in `finally` at :1811.
- Enqueued sends go through `sendQueue` (:226-248) with per-send `cancelled`/`deferred` handles.
- Every queued or in-flight send is **generation-gated**: `shouldAbort()` (:441) compares `chatSession.getSessionGeneration(sessionId)` against the generation captured at enqueue time (:1931). Checkpoints fire at every stream-event boundary: :442, :538, :738, :767, :945, :1052, :1070, :1439.

### 2.2 The canonical mid-flight lever (already exists, already proven)

`bumpSessionGeneration()` (`packages/stage-ui/src/stores/chat/session-store.ts:951`) invalidates the captured generation, so every `shouldAbort()` checkpoint early-returns and the turn stops.

**Production precedent — Discord steer mode** (`packages/stage-ui/src/stores/modules/discord.ts:734-756`):
on an interrupting Discord message while `sending`:

1. capture `chatOrchestrator.streamingMessage?.content` as partial text,
2. `chatSession.bumpSessionGeneration(chatSession.activeSessionId)`,
3. roll the partial text up into the next prompt (`"You were saying: …"`), re-`ingest` after 100ms.

Other current callers: session reset (`packages/stage-ui/src/stores/chat/data-store.ts:82`).

### 2.3 Known gaps in the lever as-is

| Gap | Detail |
| --- | --- |
| **Partial text is discarded** | The `performSend` catch block only persists `buildingMessage` when `!isStaleGeneration()` (:1788-1791). A generation bump drops whatever was streamed so far. Steer mode works around this by re-injecting the partial text into the *next* prompt instead of history. |
| **Stream is not killed** | Bumping only stops processing at the *next* stream-event checkpoint; the underlying HTTP stream keeps delivering tokens until it ends (fine for fast streams; up to 600s on a stalled one via the idle timeout). |
| **Speech is not stopped** | TTS intents already written to the speech pipeline keep synthesizing/playing. `cancel(reason)` exists (`packages/stage-ui/src/services/speech/pipeline-runtime.ts:217`, emits `speechIntentCancelEvent` from `bus.ts:39`) but is never called from product UI. |
| **Queued sends survive** | A bump does not drain `sendQueue`; `cancelPendingSends()` (:1962) does, but today it is only used by data maintenance (`use-data-maintenance.ts:69`, `chat/maintenance.ts:19`). |
| **Secondary windows can't reach it** | The desktop chat window (`#/chat`) is a secondary window; the orchestrator stream runs in the stage window (`isMainWindow`, chat.ts:118-119). Input is relayed over BroadcastChannel `airi-chat-input-bridge` (:137, main-window watcher :169-183). A stop command needs the same relay. |

### 2.4 Surfaces that need a stop button

| Surface | Composer | Stop UI today | Ingestion path |
| --- | --- | --- | --- |
| Desktop chatbox (Electron `#/chat`) | `InteractiveArea.vue` own `handleSend()` (:547) | **none** | `chatOrchestrator.ingest(...)` |
| Web/Pocket portrait | `MobileWhisperSheet` → `WhisperComposerBar` → `useChatComposer` | decorative icon (:386), `onSubmit` early-returns (:233) | `ingest` |
| Web/Pocket landscape | `packages/stage-layouts/src/components/Widgets/ChatArea.vue` → `useChatComposer` | none | `ingest` |
| WhisperDock (desktop actor stage, `#/actor`) | `WhisperDock` → same `WhisperComposerBar` | same decorative icon | `ingest` |

All four converge on `ingest()` (chat.ts:1812); `WhisperComposerBar` covers three of them through one component, and `useChatComposer` (`packages/stage-ui/src/composables/use-chat-composer.ts`) covers two.

### 2.5 Out of scope initially

- **Gemini Live Bidi turns** — generation bumps do nothing to a live WebSocket turn; cancellation must use the Live API's own interrupt/turn-end semantics (`packages/stage-ui/src/stores/modules/live-session.ts`). Tracked separately.
- **Proactivity heartbeat turns** — these run through `llmStore.generate` directly (`packages/stage-ui/src/stores/proactivity.ts:709`), not `performSend`; they share the speech intent queue but not the chat generation lever. Decide later whether "stop" also silences an active heartbeat.

---

## 3. Design

### 3.1 Core: `stopCurrentGeneration(sessionId?)` on the orchestrator

Add to `useChatOrchestratorStore` in `packages/stage-ui/src/stores/chat.ts`, next to `cancelPendingSends` (:1962), and export it (:1976+):

```
stopCurrentGeneration(sessionId?)
  1. Capture partial text from streamingMessage (only if non-empty).
  2. Finalize it as a partial assistant turn via chatSession.inscribeTurn()
     (session-store.ts:469) — optionally tagged metadata: { aborted: true } so
     UI can style it differently.  [Decision D1: KEEP partial text — see §5]
  3. cancelPendingSends(sessionId)          — drain anything queued behind it.
  4. bumpSessionGeneration(sessionId)       — invalidate the in-flight performSend.
  5. Abort the live HTTP stream: activeStreamControllers.get(sessionId)?.abort()
     (see 3.2). Order matters: bump BEFORE abort so the catch block's
     isStaleGeneration() check (:1788) sees stale state and skips persisting
     the abort error as a fake assistant message.
  6. Emit finalization: end/cancel the active speech intent
     (pipeline-runtime cancel(reason)) and fire the stream-end /
     assistant-response-end finalization so captions, Discord relay, and
     per-window stream mirrors close cleanly.
  7. Reset streamingMessage for the foreground session (mirrors :1724-1726).
```

The in-flight `performSend` then unwinds naturally: the next `shouldAbort()` checkpoint (or the AbortError thrown by the controller) exits the loop, and `finally` (:1808-1812) clears `sending`. No new teardown path duplicates the existing one.

### 3.2 Stream kill switch: controller registry

`performSend` already creates an `AbortController` per stream (:1426) and passes its signal to `llmStore.stream` (:1459), but it is function-local. Add a module-scope `Map<sessionId, AbortController>`:

- Register when the controller is created; delete in `finally`.
- `stopCurrentGeneration` looks up and aborts it.
- Module scope (not inside `defineStore` setup) for the same HMR reason as the hooks bus (chat.ts:96) — see §6 pitfalls.

### 3.3 Cross-window stop relay (desktop Electron)

The stage window owns the stream; the chat window is a secondary window whose `ingest` relays via `airi-chat-input-bridge` and awaits a `clientMessageId` echo (:1847+, chat.ts). Stop needs an equivalent path:

- **Option A (recommended):** extend the `airi-chat-input-bridge` payload with a discriminated `{ type: 'stop', targetSessionId }` variant handled by the existing main-window watcher (:169).
- **Option B:** a dedicated tiny `airi-chat-stop` BroadcastChannel. Cleaner separation, one more channel to register in the Rosetta Stone §13 registry.

Additionally, the chat window's own `sending` ref and `streamingMessage` are per-window Pinia state. The stop button must render against the *mirrored* streaming state (the chat window already renders live streaming text via `ChatHistory :streaming-message`, synced over `airi-chat-stream` / constants `CHAT_STREAM_CHANNEL_NAME`). Verify during implementation that `sending` is reliably true in the chat window while the stage window streams; if not, include `sending` in the existing stream mirror payload rather than adding a third channel.

### 3.4 UI wiring per surface

1. **Desktop chatbox `InteractiveArea.vue`** — add a stop button to the composer button cluster (:1251) that replaces/appears beside the wand while `sending`; call `orchestrator.stopCurrentGeneration(activeSessionId)` (or post the bridge stop if the chat window turns out not to be `isMainWindow`). Iconify stop icon (`i-solar:stop-bold` family) matching existing button styling (`h-8 w-8 rounded-xl` buttons).
2. **`WhisperComposerBar.vue`** — `onSubmit` (:233): when `sending`, call `stopCurrentGeneration(activeSessionId)` instead of early-returning. The red stop icon at :386 becomes real. This single change covers **portrait, landscape (via `useChatComposer` consumers), and the WhisperDock** in the actor stage.
3. **`useChatComposer`** — no change strictly needed if the bar handles it, but keep its `handleSend` early-return during `sending` (it guards against double-ingest; stop is the bar's job).

### 3.5 Behavioral contract

- **Stopped ≠ failed.** No error bubble. The catch-block error path (:1766-1783) must not render for aborts — guaranteed by bump-before-abort ordering (stale check skips persistence; verify the UI slices are also not pushed visually for the stopped window).
- **Partial text stays in history** as a normal (optionally `{ aborted: true }`-tagged) assistant message, so context continuity for the next user message is preserved.
- **Speech stops immediately**: active intent cancelled; already-queued synthesized segments drop.
- **`sending` always clears**, even if stop lands during tool-call bridges or the pre-pass monologue hop — `finally` at :1811 is the single exit.
- **Idempotent**: stop while not sending is a no-op.

---

## 4. Implementation Tracker

| # | Task | Surface | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | `stopCurrentGeneration()` + active-send registry in `chat.ts` | stage-ui store | ✅ done | §3.1, §3.2 — `activeSendHandles` module-scope Map; controller published per bridge step |
| 2 | Partial-text persistence on stop (`aborted: true` metadata) | stage-ui store | ✅ done | Decision D1; persists `rawContent` too for token retention |
| 3 | Speech intent cancellation + end-hook finalization on stop | stage-ui store | ✅ done | new `onGenerationStopped` hook; ControlStripHost cancels intent (not end) + clears captions; then stream-end/assistant-end emitted for cross-window settle |
| 4 | Cross-window stop relay (bridge payload) | stage-ui store | ✅ done | extended `airi-chat-input-bridge` payload with `type: 'stop'` (Option A); main-window watcher dispatches |
| 5 | Desktop chatbox stop button | stage-tamagotchi | ✅ done | send↔stop **morph** button in `InteractiveArea.vue` composer cluster (`handleSendOrStop`) — see D9 |
| 6 | `WhisperComposerBar.onSubmit` real stop | stage-ui | ✅ done | covers portrait + WhisperDock; `useChatComposer` now exposes `sending` + `stopGeneration`; landscape `ChatArea.vue` send button morphs into stop |
| 7 | Event-ledger record of the stop | stage-ui store | ✅ done | `user-stopped-generation` chat event with partial preview |
| 8 | Runtime verification matrix | all | ☐ pending | §7 — needs a live run (type→reply→stop, tool-loop stop, speech cut, chat-window relay, steer regression) |
| 9 | Gemini Live interrupt path (separate design) | live-session | ☐ deferred | §2.5 |
| 10 | Proactivity heartbeat stop scope | proactivity | ☐ deferred | §2.5 |

**Phase order:** core (1-4) landed first, then UI hooks (5-7) in the same checkpoint — the cross-window relay was required by the desktop chatbox anyway, and the surface hooks are ~5 lines each. Runtime verification (8) is the remaining gate.

---

## 5. Decision Log

| ID | Decision | Rationale | Status |
| --- | --- | --- | --- |
| D1 | **Keep partial text** in history on stop (vs discard) | Matches steer-mode precedent of preserving context; discarding would silently lie about what the model said and break continuity of the next turn. Persisted with `aborted: true` metadata for future UI styling. | ✅ implemented |
| D2 | Generation bump + controller abort (vs AbortSignal-only cancel) | The bump is the existing, proven lever with checkpoints everywhere; the controller abort only adds immediacy. An AbortSignal-only design would need a new checkpoint path and would trip the error-bubble path. | ✅ implemented |
| D3 | Desktop chatbox first, then shared `WhisperComposerBar` | Chatbox is the requested starting point; the bar change then cheaply covers portrait, landscape, and WhisperDock. | ✅ implemented (same checkpoint — relay was forced by the chatbox anyway) |
| D4 | Extend `airi-chat-input-bridge` (Option A) vs new channel | Chosen: extend. Fewer registered channels; the watcher already exists. Payload is now `type?: 'stop'` + optional `sendingMessage`. | ✅ implemented |
| D5 | Gemini Live & heartbeat stop deferred | Different mechanisms (Bidi interrupt semantics / direct `llmStore.generate`), not gated on the classic path. | Proposed |
| D6 | **Bump-before-abort ordering + clean-stop catch guard** | `performSend`'s catch distinguishes a user stop (`isStaleGeneration() && activeAbortController.signal.aborted`) from real errors/idle timeouts and returns without an error bubble or rethrow — a rethrow would reject the queued send's promise and restore the already-sent draft in the composer. | ✅ implemented |
| D7 | **Speech: new `onGenerationStopped` hook, not reuse of assistant-end** | `intent.end()` drains queued audio; stop needs `intent.cancel()` for immediate silence. The host also does NOT reset `currentChatIntentReceivedLiteral` in the stop handler so the assistant-end fallback path can't speak the partial. | ✅ implemented |
| D8 | **No `chat-turn-complete`/`assistant-message` hooks on stop** | Those drive Discord outbound relay + journal/moment capture; emitting them would relay a partial reply the user explicitly cancelled. The persist alone keeps session history intact. | ✅ implemented |
| D9 | **Morph the existing Send button in place** (not an extra stop button) | After live test the user rejected both the separate red stop chip and a second send-morph button — there is exactly one send button (`plain-2-bold-duotone`, primary, right-click send-mode menu) and it must become THE stop button mid-flight: `v-if="sending"` swaps it to the solid-red `stop-bold-duotone` variant in the same slot. WhisperComposerBar and landscape `ChatArea` already morph the same way. | ✅ implemented (v2: consolidated onto the existing Send/Greet button) |

---

## 6. Pitfalls (do not regress)

- **Bump-before-abort ordering** — abort first would let the catch block see a fresh generation and persist an error bubble as the assistant reply.
- **Tool-call bridge loops** — a stop mid tool-call (checkpoints :945, :1052, :1070) must not orphan tool results or hang `sending`. Verify empirically, not just by reading.
- **Controller map is module-scope** — same HMR lesson as the hooks bus (chat.ts:96); a setup-scoped map would go stale across hot reloads and strand stop dispatch.
- **`INVOKE_CHARACTER_FIRST` sentinel** — stop must not interfere with the empty-input trigger path (`chat.ts` performs it as `triggerOnly`).
- **No eager deep watchers** — if mirroring `sending` into the stream payload, keep the watcher narrow (existing watchers in `InteractiveArea.vue` are deliberately non-deep).
- **BroadcastChannel names are literal contracts** — match `airi-chat-input-bridge` / `airi-chat-stream` exactly; register any new channel in `docs/rosetta-stone.md` §13.

---

## 7. Verification Plan

**Static:**
- Store/composable/bar changes: `pnpm -F @proj-airi/stage-ui typecheck`
- Desktop host: `pnpm -F @proj-airi/stage-tamagotchi typecheck`
- Layout surfaces (landscape `ChatArea.vue`): `pnpm -F @proj-airi/stage-layouts typecheck`

**Runtime matrix (per §9 of the interaction-pipelines skill):**
1. Type → reply streams → **stop mid-text-stream** → partial text persists, `sending` clears, next message works.
2. Stop **mid-tool-call loop** (e.g. image generation tool) → no orphaned tool result, no hung `sending`.
3. Stop with **speech mid-sentence** → audio stops promptly.
4. Stop from the **chat window** while stream runs in the stage window (relayed path).
5. **Discord steer-mode interrupt** after a stop (regression — steer still works).
6. **Enqueued send behind a stopped one** → drained, not executed.
7. Gemini Live call while text is mid-flight (regression — untouched path).

---

## 8. References

- Skills: `.agents/skills/airi-interaction-pipelines/SKILL.md` §2.2, §7 (stop/cancel audit, superseded here where line numbers drift); `.agents/skills/airi-desktop-chatbox/SKILL.md` §3, §6.3 (composer surfaces).
- Ground-truth pipeline doc: `docs/arch-chat-stt-proactivity-pipelines.md`.
- Key code:
  - `packages/stage-ui/src/stores/chat.ts` — `performSend` (:258), `shouldAbort` (:441), AbortController (:1426), catch/persist gate (:1788), `finally` (:1808), `ingest` (:1812), `cancelPendingSends` (:1962), input-bridge watcher (:169).
  - `packages/stage-ui/src/stores/chat/session-store.ts` — `getSessionGeneration` (:946), `bumpSessionGeneration` (:951), `inscribeTurn` (:469).
  - `packages/stage-ui/src/stores/chat/stream-store.ts` — `streamingMessage`, `finalizeStream` (:39).
  - `packages/stage-ui/src/services/speech/pipeline-runtime.ts` — intent `cancel` (:217).
  - `packages/stage-ui/src/stores/modules/discord.ts` — steer-mode precedent (:734-756).
  - `apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue` — desktop composer (:547 `handleSend`, :1251 button cluster).
  - `packages/stage-ui/src/components/scenarios/chat/WhisperComposerBar.vue` — decorative stop (:386), `onSubmit` (:233).
  - `packages/stage-ui/src/composables/use-chat-composer.ts` — shared ingestion (:23).

---

## 9. Implementation Journal

### 2026-08-24 — Core + all classic surfaces (one checkpoint)

**Decision:** implemented everything in a single coherent pass rather than micro-phasing. Rationale: the
cross-window relay was already *forced* by the desktop chatbox (the chat window is a secondary window and
generation counters are window-local), so there was no meaningfully smaller "desktop-only" slice. The
remaining surface work was ~5 lines each, and splitting the core would have produced half-broken
intermediates (stop that discards partial text, or stops text but lets speech keep playing).

**Key cross-window findings (audit during implementation):**
- Generations are **window-local** ephemeral refs (`session-store.ts:49`, never broadcast). So a chat-window
  stop can only reach the stream via the bridge relay; conversely, the main window's bump does NOT desync
  secondary windows' `context-bridge` replay guards.
- `context-bridge.ts` is bidirectional: it broadcasts the orchestrator's outgoing hooks (:288-299) and
  replays incoming events into local state — it sets `chatOrchestrator.sending = true` on `before-send`/
  `token-literal` (:83) and clears it on `assistant-end` (:424), appending literals into the local
  `streamingMessage` (:380). **Conclusion:** stop only needs to re-emit the normal end-of-turn hooks and
  every secondary window settles exactly like a completed turn — no new channel or cleanup event needed.
- `App.vue:210` initializes the context bridge in **every** Electron window (chat, stage, actor), so the
  `sending` mirror is live in the desktop chat window.

**Changes landed:**
- `stores/chat.ts`: module-scope `activeSendHandles: Map<sessionId, ActiveSendHandle>` (controller +
  streaming context + building message + `getRawText()`); new `stopCurrentGeneration(targetSessionId?)`;
  extended `airi-chat-input-bridge` payload with `type?: 'stop'`; main-window watcher dispatches stop;
  catch-block clean-stop guard; turn-end recovery scan guarded by `!shouldAbort()`; `finally` deletes the handle.
- `stores/chat/hooks.ts`: `onGenerationStopped` / `emitGenerationStoppedHooks` (+ `clearHooks`).
- `components/scenes/ControlStripHost.vue`: `onGenerationStopped` handler — `intent.cancel()` (immediate
  silence, not drain), nulls the intent, clears `assistantCaptionSegments` + posts empty caption.
- `composables/use-chat-composer.ts`: exposes `sending` + `stopGeneration()`.
- `InteractiveArea.vue`: red stop button in the composer cluster while `sending` → `handleStopGeneration()`.
- `WhisperComposerBar.vue`: `onSubmit` stops instead of early-returning (portrait + WhisperDock).
- `Widgets/ChatArea.vue` (landscape): send button morphs into a red stop button while `sending`.
- Event ledger: `user-stopped-generation` chat event with a partial-text preview.

**Validation:** `pnpm -F @proj-airi/stage-ui typecheck`, `pnpm -F @proj-airi/stage-layouts typecheck`,
`pnpm -F @proj-airi/stage-tamagotchi typecheck` — all clean. Runtime matrix (§7) still pending.

**Known accepted limitations:**
- Stop clicked within the microsecond window between natural loop-exit and the normal-path finalize hooks
  could double-finalize (same pre-existing race as session resets mid-tail). Not worth a lock for v1.
- Multi-tab stage-web: stop only works in the tab owning the stream (existing leader-election TODO in
  context-bridge :192-214).
- `onGenerationStopped` is emitted locally only — not added to the `ChatStreamEvent` broadcast union.
  Speech hosts only mount in the stage window, so no cross-window gap today; revisit if a secondary window
  ever hosts TTS.
