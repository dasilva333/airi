# Conversational Pacing and Thinking Fillers

**Status:** Production specification, implementation-ready after review
**Scope:** Turn-based text/STT/proactivity responses that use the ordinary chat hook and speech-runtime path
**Out of scope:** Gemini Live native PCM output (`outputMode: 'gemini'`), which owns its own audio clock and must not be mixed with custom TTS

## 1. Executive Summary

Conversational pacing is a coordination problem between four clocks:

1. Inference clock: request dispatch, provider events, first usable answer text, and final settlement.
2. Speech clock: TTS synthesis, decoded audio duration, queued playback, and interruption.
3. Presentation clock: avatar cues, captions, and transient visual rendering.
4. Persistence clock: the final assistant message written to the chat session.

The system MUST have one authoritative turn coordinator and one speech intent per turn. Thinking fillers are optional audio items owned by that intent. They are never emitted as assistant text, never inserted into `rawContent`, and never create a second TTS engine or playback queue.

The design has two pillars:

- **Pillar A, bounded latency masking:** arm at an adaptive threshold, choose a filler only from evidence available before the deadline, and cancel or hand off through the existing speech intent.
- **Pillar B, presentation pacing:** pace display-only text and visual hesitation independently from TTS, while persisting only the canonical assistant response.

The design rejects several assumptions in the previous draft:

- Receiving an SSE header is not evidence that an answer is imminent. Only a usable answer literal suppresses a filler.
- Chain-of-thought is provider-specific and is not a reliable personality or sentiment channel. It may be used only for coarse, explicitly configured categories and only when the provider adapter marks it as non-user-visible reasoning.
- “Zero gap” is a measurable scheduling invariant, not a promise that any arbitrary browser/provider combination can satisfy. It requires decoded audio to be scheduled against the same `AudioContext` clock with a positive lead.
- `speech.ts` is a settings/provider store, not the audio queue owner. Queue ownership belongs to the speech pipeline and intent runtime.
- A cache key is not a data contract. The cache must define ownership, eviction, invalidation, and whether audio is synchronized. The default is local-only and non-syncing.

## 2. Existing Architecture and Invariants

The implementation MUST fit these current paths:

| Concern | Current authority | Required integration |
| --- | --- | --- |
| Turn generation, stream lifecycle, session inscription | `packages/stage-ui/src/stores/chat.ts` and `packages/stage-ui/src/stores/chat/session-store.ts` | `chat.ts` owns `performSend`, stream events, and generation invalidation; `session-store.ts` owns session records and inscription. Create one coordinator per generation. |
| Cross-surface route map | `docs/arch-chat-stt-proactivity-pipelines.md` | Typed chat, STT, and proactivity converge on the ordinary chat path; all share the speech lane. |
| Stream marker interception | `packages/stage-ui/src/composables/llm-marker-parser.ts` | Run before categorization and TTS. ACT/DELAY/ACTOR remain special tokens. |
| Speech settings and active voice | `packages/stage-ui/src/stores/modules/speech.ts` | Read provider/model/voice/rate/pitch; do not add playback ownership here. |
| TTS segmentation and playback scheduling | `packages/pipelines-audio/src/speech-pipeline.ts` | Extend intent metadata/playback ownership rather than creating a parallel queue. |
| Speech host and cancellation | speech runtime/pipeline runtime and `ControlStripHost.vue` | One intent, one owner, explicit cancel on barge-in or generation invalidation. |
| Acting prompts and card persistence | `card.schema.ts`, `airi-card.ts`, `CardCreationTabActing.vue` | Add validated pacing configuration under `extensions.airi.acting`. |
| Chat persistence | chat session repo and `ChatAssistantMessage` | `content` is display text; `rawContent` retains model output and markers. Pacing metadata is not transcript content. |

### 2.1 Non-negotiable invariants

- Every turn has a unique `turnId`, `sessionId`, and captured `generation`.
- Events from a stale generation MUST be ignored, including late provider events, timer callbacks, TTS completions, and playback callbacks.
- There is at most one filler attempt and at most one filler playback item per turn.
- A filler MUST NOT delay the first answer audio if answer audio is ready and the filler has not started.
- Once filler audio has started, the answer is queued behind it or the filler is interrupted only by an explicit cancellation policy. It is never played concurrently.
- `stream-end` flushes; `assistant-end` settles. This matches remote replay and speech-host lifecycle rules.
- `NO_REPLY` produces no filler, no speech intent, and no persisted assistant message.
- Native Gemini audio mode bypasses this subsystem entirely. Custom Gemini mode follows the normal marker/parser/TTS path but still cannot be mixed with native PCM.

## 3. Formal Model

Let `t0` be monotonic time at dispatch. Let `ta` be the time of the first answer literal after marker parsing and reasoning categorization. Let `tf` be the time filler playback begins, or `∞` if it never begins. Let `te` be answer settlement.

The filler policy is a partial function:

```text
F(turn) ∈ {suppressed, armed, active, canceled, rejected}
```

The safety property is:

```text
if ta < tf, then no filler audio is audible
```

The race policy is:

- If answer text arrives before filler playback begins, cancel the pending filler.
- If answer text arrives after filler playback begins, enqueue answer audio behind the active filler, subject to `maxFillerDurationMs`.
- If answer audio is already decoded and scheduled with a start time earlier than filler start, filler is rejected; the answer owns the next playback slot.

The product objective is not “always fill silence.” It is to minimize perceived dead air subject to:

```text
P(filler audible | answer would have been ready first) ≤ falsePositiveBudget
```

The initial default budget is 1% over a rolling 100-turn window, with a hard safety floor that disables fillers after repeated late starts.

## 4. Provider Protocol Matrix

The provider adapter MUST normalize provider output into a stream-neutral event contract. The coordinator MUST NOT inspect provider-specific object shapes.

```ts
type InferenceEvent
  = | { type: 'connected', at: number }
    | { type: 'reasoning', text: string, visibility: 'hidden' | 'visible', at: number }
    | { type: 'answer', text: string, at: number }
    | { type: 'special', token: string, at: number }
    | { type: 'tool', phase: 'start' | 'end', at: number }
    | { type: 'finish', reason?: string, at: number }
    | { type: 'error', error: unknown, at: number }
```

| Provider behavior | Adapter normalization | Filler consequence |
| --- | --- | --- |
| Separate `reasoning_content` deltas | `reasoning`, `visibility: hidden` | Reasoning may inform a coarse category; it does not suppress filler. |
| In-band `<think>`/`<thought>` | Delimiter adapter removes hidden block before normal categorization | The delimiter parser must be incremental and chunk-safe. |
| Anthropic thinking events | `reasoning`, then `answer` | Same policy; event names never reach coordinator logic. |
| Direct answer stream | `answer` after marker parsing | Suppress pending filler immediately. |
| Slow non-reasoning model | No event until answer or finish | Adaptive deadline may arm generic filler; no fabricated CoT category. |
| Ultra-fast model | `answer` before deadline | No filler synthesis or playback. |
| Tool loop | `tool:start` pauses answer expectation but does not reset `t0` | A filler may play once; tool output cannot create another filler. |

If an adapter cannot distinguish hidden reasoning from user-visible text, it MUST emit the data as `answer`. It MUST NOT guess that arbitrary XML is hidden reasoning.

## 5. State Machine

```mermaid
stateDiagram-v2
    [*] --> IDLE
    IDLE --> DISPATCHED: dispatch(turnId, generation)
    DISPATCHED --> STAGING: first coordinator tick
    STAGING --> SETTLED: NO_REPLY / disabled / stale / error
    STAGING --> ANSWER_READY: answer event before deadline
    STAGING --> FILLER_ARMED: adaptive deadline elapsed
    STAGING --> STAGING: reasoning / connected / tool events
    FILLER_ARMED --> ANSWER_READY: answer event before synthesis/playback
    FILLER_ARMED --> FILLER_ACTIVE: cached filler scheduled and starts
    FILLER_ARMED --> SETTLED: stale / cancel / answer audio scheduled first
    FILLER_ACTIVE --> HANDOFF: filler ended and answer audio ready
    FILLER_ACTIVE --> HANDOFF: filler ended, answer still synthesizing
    FILLER_ACTIVE --> SETTLED: user barge-in / explicit cancel
    ANSWER_READY --> HANDOFF: answer intent receives first literal
    HANDOFF --> SETTLED: assistant-end and playback ownership released
    DISPATCHED --> SETTLED: generation invalidated
    STAGING --> SETTLED: generation invalidated
    FILLER_ARMED --> SETTLED: generation invalidated
    FILLER_ACTIVE --> SETTLED: generation invalidated
```

`ANSWER_READY` is an internal state, not a second speech intent. The normal assistant speech intent remains the sole owner of answer TTS.

### 5.1 Transition rules

| From | Event | Guard | Action |
| --- | --- | --- | --- |
| `DISPATCHED` | first tick | turn current | enter `STAGING`; emit optional nonverbal staging cue |
| `STAGING` | answer literal | current | cancel arm timer; enter `ANSWER_READY`; send literal to ordinary intent |
| `STAGING` | deadline | no answer audio scheduled; filler enabled | enter `FILLER_ARMED`; select cached clip only |
| `FILLER_ARMED` | answer literal | filler not started | cancel clip; enter `ANSWER_READY` |
| `FILLER_ARMED` | clip ready | current and no answer scheduled | schedule clip on same playback owner; enter `FILLER_ACTIVE` only on `onStart` |
| `FILLER_ACTIVE` | answer literal | current | ordinary intent continues; playback remains serialized |
| any non-settled | `assistant-end` | current | flush answer; settle after queue ownership is released |
| any | cancel/barge-in | current | abort inference if supported, cancel intent, stop owned playback, settle as interrupted |

The 1200 ms filler / 1400 ms answer race is therefore deterministic: if playback has not started, filler is canceled; if playback has started, answer is queued after the clip and the clip is never restarted.

## 6. Adaptive Timing

Timers remain necessary because absence of an event is itself a signal. They are policy deadlines, not guesses about provider internals.

For each `(providerInstanceId, modelId, modality)` bucket, record successful TTFT samples `x_n` where TTFT is dispatch-to-first-answer-literal. Use a bounded EMA:

```text
μ_n = α x_n + (1 - α) μ_(n-1)
α = 2 / (N + 1), N ∈ [8, 32]
```

Track dispersion with an EMA of absolute deviation:

```text
d_n = β |x_n - μ_n| + (1 - β) d_(n-1)
```

The arm deadline is:

```text
D = clamp(μ - k_fast d, D_min, D_max)
```

Defaults:

```text
D_min = 900 ms
D_max = 3500 ms
k_fast = 0.5
```

The deadline MUST also satisfy a false-positive guard based on the empirical percentile when at least 20 samples exist:

```text
D = max(D, p10(TTFT))
```

For a cold bucket, use `D = 1800 ms`. For an ultra-fast bucket where `p90(TTFT) ≤ 700 ms`, the effective policy is disabled because the minimum arm deadline would provide no useful masking.

The deadline is recalculated only between turns. It MUST NOT move while a turn is in flight. This prevents a settings/provider update from racing a timer callback.

A filler is eligible only if:

```text
now - t0 ≥ D
answerAudioScheduled = false
fillerAttempted = false
audioContext.state === 'running'
cacheHit = true
```

No network TTS request may be made after the deadline to rescue a missed cache hit. A cache miss means “no filler this turn,” not “wait longer.”

## 7. Streaming Interception and Cue Extraction

### 7.1 Ordering

Every answer stream MUST pass through the existing `useLlmmarkerParser` before categorization or speech. The stream adapter first normalizes provider reasoning events; the ordinary answer text then follows:

```text
provider events
  -> protocol adapter
  -> reasoning/delimiter normalizer
  -> useLlmmarkerParser
  -> streaming categorizer
  -> chat hooks / speech intent
```

ACT, DELAY, ACTOR, and future special tokens remain special events. They must not enter the filler classifier or TTS literal stream.

### 7.2 Incremental reasoning window

The classifier is intentionally not sentiment analysis. It emits one of a small configured set:

```ts
type ThinkingCategory = 'analytical' | 'memory' | 'emotional' | 'uncertain' | 'generic'
```

The classifier consumes normalized hidden reasoning only, up to `maxReasoningChars = 1024` or `maxReasoningMs = 900`, whichever occurs first. It uses token-boundary-safe normalization:

```ts
function consumeReasoningChunk(chunk: string) {
  window += chunk
  window = window.slice(-1024)
  const terms = tokenizeForMatching(window) // Unicode-aware, no regex over raw chunks
  return scoreCategories(terms, configuredCategoryLexicon)
}
```

`tokenizeForMatching` lowercases, folds punctuation, preserves negation tokens, and retains a rolling 3-token context. A category score is valid only when:

```text
positiveEvidence - negatedEvidence ≥ categoryThreshold
```

Negation is local and conservative: `not`, `never`, `don't`, `shouldn't`, and equivalent configured terms suppress a matching term within the next three normalized tokens. The classifier MUST NOT infer “angry” from a sentence such as “I should not sound angry.”

Keyword matches are category evidence, not direct audio commands. Custom card configuration maps category to a filler clip; it cannot cause arbitrary text from reasoning to be spoken.

If reasoning arrives split as `cal` + `cul` + `ate`, the rolling string buffer is classified only after a token boundary or the window deadline. No single chunk is assumed to be a token.

### 7.3 Pseudocode

```ts
async function onInferenceEvent(event: InferenceEvent) {
  if (!isCurrentTurn(event.at))
    return

  if (event.type === 'reasoning' && event.visibility === 'hidden') {
    const category = classifier.consume(event.text)
    if (category && coordinator.state === 'FILLER_ARMED')
      coordinator.replaceCandidate(category)
    return
  }

  if (event.type === 'answer') {
    coordinator.cancelPendingFiller('answer-arrived')
    parser.consume(event.text) // parser emits ordinary literal/special hooks
    return
  }

  if (event.type === 'finish')
    await coordinator.onAssistantEnd()
}
```

The classifier is advisory. It never owns turn settlement, persistence, or playback.

## 8. Speech Runtime and Zero-Gap Handoff

### 8.1 Ownership contract

The filler and answer MUST use the same speech intent owner and playback manager. The speech pipeline already serializes playback while allowing TTS generation concurrency. The implementation should add typed metadata, for example:

```ts
interface PacingPlaybackMeta {
  turnId: string
  role: 'thinking-filler' | 'assistant-answer'
  generation: number
}
```

`PlaybackItem` carries this metadata for observability and cancellation. It does not create a second queue.

### 8.2 Scheduling invariant

Let `C` be the `AudioContext.currentTime`, `s0` the filler start, `e0` its scheduled end, and `s1` the answer start. For zero-gap handoff:

```text
s1 = e0
decodedAnswerBuffer.ready = true before e0 - lead
lead ≥ max(2 render quanta, provider scheduling jitter)
```

In practice the playback manager MUST schedule the answer buffer against the same context clock before `e0`, not wait for an `onEnd` callback to start a new source. If the answer is not ready by `e0 - lead`, the system chooses continuity over the zero-gap claim: it ends the filler at its natural boundary and starts the answer when ready, recording an underrun metric.

The filler clip MUST be short and bounded:

```text
minDurationMs ≤ durationMs ≤ maxFillerDurationMs
default maxFillerDurationMs = 2200
```

The filler cannot be looped.

### 8.3 Cache contract

The prior draft's `local:audio:thinking-cache/{voiceId}` is not an approved catalog key. Structured `local:` writes sync through the outbox. Audio bytes belong in localforage, while a small manifest may use local storage only if it is explicitly marked non-syncing.

Recommended local-only key:

```text
thinking-audio-{sha256(provider, model, voiceId, pitch, rate, language, text, format)}
```

Manifest fields:

```ts
interface ThinkingAudioEntry {
  key: string
  voiceFingerprint: string
  category: ThinkingCategory
  text: string
  format: string
  durationMs: number
  byteLength: number
  createdAt: number
  lastUsedAt: number
}
```

Cache rules:

- Generate only from explicit pre-cache action, idle-time warming, or the first successful use outside the critical deadline.
- Never synthesize a cache miss on the critical path.
- Invalidate when provider, model, voice, pitch, rate, language, format, or text changes.
- Cap total bytes and entry count; evict least-recently-used entries.
- Do not sync raw audio or cache manifests across devices by default.
- Store bytes with `localforage`; use `toRaw` for reactive data before persistence where applicable.

### 8.4 Cancellation and barge-in

Cancellation is generation-scoped. On user speech, explicit stop, session switch, or newer interrupting turn:

1. Bump the chat session generation using the existing canonical mechanism.
2. Abort the inference request where the provider supports `AbortSignal`.
3. Cancel the speech intent with a reason.
4. Stop playback items owned by the turn, including the filler.
5. Do not persist transient filler text or visual draft state.
6. Settle the interrupted turn exactly once.

Cancellation MUST be idempotent. A late `onEnd` callback from the playback manager MUST be ignored if its generation is stale.

## 9. Pillar B: Text and Visual Pacing

Pillar B is presentation-only. It MUST NOT delay audio, mutate canonical message content, or infer permanent personality facts from hidden reasoning.

### 9.1 Separate clocks

The assistant response has three representations:

```ts
interface AssistantPresentation {
  canonicalText: string
  spokenText: string
  displayText: string
  transientDraft?: string
  captionSegments: CaptionSegment[]
}
```

- `canonicalText` is the clean final content persisted as `content`.
- `spokenText` is the literal stream sent to TTS after marker/category filtering.
- `displayText` is what the UI currently reveals.
- `transientDraft` is renderer memory only and is never written to chat history.

TTS timing is authoritative for captions that represent speech. A typewriter effect may reveal text earlier or later, but caption highlighting MUST use segment IDs and audio playback timestamps, not character index alone.

If visual text lags behind audio, captions reveal the required segment immediately. If visual text leads audio, the UI may show unhighlighted text but MUST NOT claim it has been spoken.

### 9.2 Draft/retype safety

Draft and deletion effects operate on an ephemeral presentation store keyed by `turnId`. At `assistant-end`, only the final parser output is passed to `inscribeTurn`. The persistence layer MUST never receive `transientDraft`.

Markdown is rendered only from `displayText` after a safe debounce or from canonical completed text. The effect engine MUST NOT mutate the persisted message object in place.

Recommended default: ship typewriter pacing and caption alignment first; keep simulated backspace/retype behind an experimental flag until accessibility, markdown, and interruption tests pass.

## 10. Card Schema and Settings Integration

The configuration belongs under the existing `extensions.airi.acting` object. It is card-scoped policy; audio bytes remain device-local.

Proposed Valibot shape:

```ts
const AiriThinkingFillerSchema = object({
  text: pipe(string(), minLength(1), maxLength(160)),
  category: union([
    literal('generic'),
    literal('analytical'),
    literal('memory'),
    literal('emotional'),
    literal('uncertain'),
  ]),
  enabled: boolean(),
})

const AiriPacingSchema = object({
  enabled: boolean(),
  armMinMs: pipe(number(), integer(), minValue(900), maxValue(3500)),
  armMaxMs: pipe(number(), integer(), minValue(900), maxValue(6000)),
  maxFillerDurationMs: pipe(number(), integer(), minValue(400), maxValue(2200)),
  reasoningWindowMs: pipe(number(), integer(), minValue(0), maxValue(1200)),
  categoryThreshold: pipe(number(), minValue(1), maxValue(10)),
  fillers: array(AiriThinkingFillerSchema),
  visualTyping: optional(object({
    enabled: boolean(),
    minIntervalMs: pipe(number(), integer(), minValue(0), maxValue(1000)),
    maxIntervalMs: pipe(number(), integer(), minValue(0), maxValue(2000)),
    experimentalDraftRetype: boolean(),
  })),
})
```

The actual implementation should use the repository's current Valibot imports and preserve the existing required acting prompt fields. UI work belongs in `CardCreationTabActing.vue`, not a new settings store. The tab MUST explain that category matching is coarse, hidden reasoning may be unavailable, and cache generation is local to the selected voice.

Validation MUST enforce `armMinMs ≤ armMaxMs` at the update boundary. Imported cards with invalid or absent pacing config use the disabled/default policy; they must not prevent card loading.

## 11. Implementation Boundaries

The implementation should introduce small focused modules rather than embed policy in the session store:

```text
packages/stage-ui/src/services/conversation-pacing/
  types.ts                 normalized events, state, metrics
  timing.ts                EMA and deadline policy
  reasoning-classifier.ts  bounded streaming category classifier
  filler-cache.ts          localforage bytes and eviction
  coordinator.ts           generation-scoped state machine
```

Integration points:

- `chat.ts` creates and settles the coordinator around the existing turn generation; `session-store.ts` remains the session-record/persistence authority.
- The LLM dispatch/provider adapter emits normalized reasoning and answer events.
- `useLlmmarkerParser` remains the first parser for answer text before hooks/TTS.
- The speech host accepts a pacing playback item through the existing intent/runtime contract.
- `speech.ts` exposes active voice/provider identity; it does not schedule playback.
- The card store assembles acting prompts and pacing policy into the system prompt only where explicitly enabled. It must never inject raw cache metadata into prompts.

## 12. Observability and Failure Policy

Each turn records metrics in memory and debug logs, not chat history:

```ts
interface PacingMetrics {
  turnId: string
  providerKey: string
  ttftMs?: number
  deadlineMs: number
  fillerCandidate?: ThinkingCategory
  fillerOutcome: 'none' | 'cache-miss' | 'canceled' | 'played' | 'rejected'
  fillerStartMs?: number
  answerFirstAudioMs?: number
  handoffGapMs?: number
  interrupted: boolean
}
```

Safe degradation is mandatory:

- Missing cache: no filler, ordinary TTS continues.
- Missing reasoning events: generic category only, never an error.
- TTS/provider failure: cancel owned filler/answer as appropriate; do not retry filler on the hot path.
- AudioContext unavailable: suppress filler and preserve normal chat.
- Parser error: follow existing parser end behavior and prevent marker leakage; do not let pacing bypass parser safeguards.
- Coordinator exception: disable pacing for the turn and leave the ordinary chat path usable.

## 13. Verification Plan

### 13.1 Unit tests

- EMA convergence, cold start, clamping, and percentile guard.
- State transition table for every event in every state.
- Stale generation events cannot transition or schedule playback.
- Answer at 899 ms, exactly at deadline, and after filler start.
- One filler attempt invariant, including tool loops and repeated reasoning events.
- Delimiter parsing across arbitrary chunk boundaries.
- `cal` + `cul` + `ate` rolling classification.
- Negation examples do not select contradictory categories.
- ACT/DELAY/ACTOR never enter literal filler classification or TTS.
- `NO_REPLY` never arms or plays a filler.
- Cancellation is idempotent and settles once.
- Cache fingerprint invalidates on every voice-affecting field.
- Cache eviction is bounded and local-only.
- `content`/`rawContent` and persisted session messages never contain filler or draft text.

### 13.2 Deterministic latency bench

Build a fake provider and fake playback clock. Run at least:

| Scenario | Expected result |
| --- | --- |
| 200 ms direct answer | No filler; answer starts normally. |
| 800 ms direct answer | No filler under default policy. |
| 1800 ms silent non-reasoning | Generic cached filler may start once. |
| 5000 ms hidden reasoning | One filler; category may refine before arm deadline only. |
| Answer at 1400 ms, filler arm at 1200 ms but not started | Filler canceled; no audio. |
| Answer at 1400 ms, filler started at 1200 ms | Answer queued; no overlap. |
| Cache miss at arm deadline | No filler; no extra wait. |
| User barge-in during filler | Generation bump, intent cancel, owned audio stops, no persistence leak. |
| Proactivity followed by chat | Shared speech lane remains serialized and both turns settle. |
| Gemini native PCM | Pacing coordinator is not instantiated. |

### 13.3 Repository validation

For implementation changes:

```bash
pnpm -F @proj-airi/stage-ui typecheck
pnpm -F @proj-airi/stage-pages typecheck
```

Run the affected audio package typecheck if `packages/pipelines-audio` changes. A build is required if Electron entry points or packaging are changed. This proposal rewrite itself is documentation-only and does not require a typecheck.

## 14. Phased Roadmap

### Phase 0: Contracts and instrumentation

- Define normalized inference events, turn IDs, metrics, and generation guards.
- Add fake-clock tests without changing user behavior.
- Confirm the actual LLM provider adapters that can expose hidden reasoning.

### Phase 1: Safe filler coordinator

- Implement EMA/deadline policy, local cache manifest/bytes, and one cached generic filler.
- Integrate one speech intent owner and cancellation.
- Ship disabled by default behind a feature flag.

### Phase 2: Provider adapters and category selection

- Add separate-field and delimiter adapters.
- Add bounded category classifier with negation handling.
- Add Acting tab configuration and schema validation.

### Phase 3: Audio scheduling hardening

- Add same-clock pre-scheduling and lead/underrun metrics.
- Verify provider-specific TTS streaming behavior and browser AudioContext constraints.
- Add barge-in wiring only after the existing generation/intent cancellation path is proven.

### Phase 4: Visual pacing

- Add typewriter and caption/audio reconciliation.
- Add storage-invariant transient presentation state.
- Keep draft/retype experimental until accessibility and markdown tests pass.

### Phase 5: Controlled rollout

- Enable for local cached voices first.
- Compare false-positive filler rate, handoff gap, interruption correctness, and user disablement rate.
- Expand provider coverage only when adapter telemetry proves event semantics.

## 15. Acceptance Criteria

The feature is production-ready only when all of the following hold:

- Fast direct-answer turns never wait for or play a filler.
- A filler cannot start after the first answer audio is scheduled.
- At most one filler plays per turn, and it cannot overlap answer audio.
- A stale or interrupted turn cannot produce late audio, avatar cues, or persistence writes.
- Hidden reasoning is never shown, spoken, or persisted as assistant-visible content.
- ACT markers remain governed by the existing parser and are never spoken.
- Cache misses degrade to ordinary behavior without added latency.
- The answer can be pre-buffered behind a filler using the shared playback clock; measured underruns are visible.
- `content`, `rawContent`, captions, and transient visual state have clearly separated contracts.
- Typed chat, STT, and proactivity use the same tested coordinator; Gemini native audio does not.

## References

- [`docs/arch-chat-stt-proactivity-pipelines.md`](./arch-chat-stt-proactivity-pipelines.md)
- [`docs/rosetta-stone.md`](./rosetta-stone.md)
- [`docs/data-catalog.md`](./data-catalog.md)
- [`packages/stage-ui/src/stores/chat.ts`](../packages/stage-ui/src/stores/chat.ts)
- [`packages/stage-ui/src/stores/chat/session-store.ts`](../packages/stage-ui/src/stores/chat/session-store.ts)
- [`packages/stage-ui/src/stores/modules/speech.ts`](../packages/stage-ui/src/stores/modules/speech.ts)
- [`packages/pipelines-audio/src/speech-pipeline.ts`](../packages/pipelines-audio/src/speech-pipeline.ts)
- [`packages/stage-ui/src/composables/llm-marker-parser.ts`](../packages/stage-ui/src/composables/llm-marker-parser.ts)
- [`packages/stage-ui/src/types/card.schema.ts`](../packages/stage-ui/src/types/card.schema.ts)
- [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue`](../packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue)
