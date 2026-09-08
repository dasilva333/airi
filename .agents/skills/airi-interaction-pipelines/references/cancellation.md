# Cancellation

## Current implementation

`packages/stage-ui/src/stores/chat.ts:stopCurrentGeneration(targetSessionId?)` is implemented. Older architecture/audit text describing decorative Stop controls is historical.

Read `activeSendHandles`, `cancelPendingSends`, `shouldAbort`, and the input-bridge stop receiver together. The cancellation contract spans queued work, the current response, provider I/O, and speech.

## Preserve operation order

1. Resolve the target session. A secondary window relays `{ type: 'stop', targetSessionId }` to the owning window.
2. If there is no active handle, cancel queued sends for that session.
3. For an active handle, persist the partial assistant reply before bumping generation. Preserve `rawContent` and mark `aborted: true`.
4. Bump session generation and cancel pending sends. Generation checks reject stale stream callbacks, including callbacks arriving after transport abort.
5. Record the user-stop Event Log entry and abort the active controller.
6. Emit generation-stopped, stream-end, then assistant-response-end hooks. Preserve this order: speech cancellation/fallback suppression precede completion.

The abort catch path recognizes stale, intentionally aborted work. Do not turn user Stop into a provider-error bubble or rethrow it as a failed send. Idle-timeout abort remains a separate failure condition.

## Other cancellation domains

- `ControlStripHost.vue:onGenerationStopped` cancels pacing and current intent, resets captions, and preserves the literal-received flag needed to avoid replaying a partial reply.
- Speech cancellation must discard queued/synthesizing output; normal `end` is not cancellation. See `airi-speech-runtime`.
- Session reset and Discord steering also invalidate generations. Preserve their own history/steering semantics rather than routing every invalidation through user-stop persistence.
- Gemini Live bypasses `performSend`; ordinary generation bump/HTTP abort does not establish Live interruption. Inspect Live turn/interrupt/socket handling with `airi-gemini-live-api`.
- Cancelling a local stream does not prove an external tool's side effect was rolled back. Verify late tool-result handling and cancellation capability at the actual tool boundary.

## Verification

Stop before the first token, midway through text, during tool execution, and with queued sends. Repeat from a secondary window. Assert one persisted partial at most, retained raw text, cleared sending state, no stale error bubble, no new speech/captions, and a successful next send. Switch sessions during pending work and verify the unrelated session remains intact. Test Live interruption separately if changing that route.
