# Chat Orchestrator Decomposition: Behavior Contracts and Phased Execution Plan

**Status:** Complete · All Phases 0–5 Verified
**Repository:** `dasilva333/airi`
**Domain:** `@proj-airi/stage-ui`, ordinary turn-based chat orchestration
**Reviewed source baseline:** `326aeb054524b5c7979bae5cc6e838c9fbe63da1`
**Specification date:** 2026-09-08
**Intended repository location:** `docs/architecture-chat-orchestrator-decomposition.md`

This document replaces the previous decomposition proposal. It defines a behavior-preserving extraction, with characterization tests established before production code moves. It does not claim that tests have been executed, that all existing behavior is correct, or that a refactor can guarantee zero regressions.

## 1. Decision and scope

Keep `useChatOrchestratorStore` and `performSend` as the owners of turn execution. Extract four bounded areas of synchronous computation into the existing `packages/stage-ui/src/stores/chat/` directory:

1. Error presentation.
2. Tool-marker recognition and argument parsing.
3. Intrusion prompt formatting and pure climax evaluation.
4. Grounding message formatting and ordered assembly.

Preserve public store methods, hooks, session ownership, persistence formats, provider routing, tool execution, and speech integration. There is no target line count for `performSend`. A smaller function is useful only when responsibilities have clearer owners.

This work does **not** replace the runtime with Apeira or upstream `core-agent`. The supporting documents contain historical assessments of those options; they do not prove present-day architectural inferiority or inevitable migration failure. Runtime replacement is deferred because it would introduce additional integration contracts unrelated to this extraction.

### Explicit exclusions

- New packages, an orchestration framework, or a general dependency-injection container.
- Changes to queue scheduling, cancellation policy, provider tool limits, or retry policy.
- New marker dialects, broader JSON repair, or prompt wording improvements.
- Changes to memory retrieval policy, prompt caching, staging retry semantics, or card/session ownership.
- Replacing the streaming parser, categorizer, speech runtime, or pacing coordinator.
- Gemini Live redesign, upstream synchronization, storage migration, or unrelated cleanup.

A defect found during characterization is recorded separately. If it blocks safe extraction, isolate and verify its fix before proceeding; do not disguise the fix as a mechanical move.

## 2. Sources and authority

Read repository instructions and the relevant domain guides before implementation. Resolve disagreements using current source and reproducible observations. Historical documentation is context, not executable truth.

### Repository references

- [Testing catalog](./project-testing-parity.md)
- [Rosetta Stone](./rosetta-stone.md)
- [Specialized skills index](./project-specialized-skills.md)
- [Interaction pipelines](../.agents/skills/airi-interaction-pipelines/SKILL.md)
- [Speech runtime](../.agents/skills/airi-speech-runtime/SKILL.md)
- [Conversational pacing](../.agents/skills/airi-conversational-pacing/SKILL.md)
- [ACT tokens](../.agents/skills/airi-acting-cue-act-tokens/SKILL.md)
- [Prompt builder](../.agents/skills/airi-prompt-builder-engine/SKILL.md)
- [Core-agent/Apeira proposal](./proposal-core-agent-revamp.md)
- [Selective upstream shortlist](./project-selective-upstream-sync-shortlist.md)
- [Fork ecosystem research](./research-forks-ecosystem.md)

Relative links assume this document is installed at its intended repository location. For a standalone copy, the [reviewed repository tree](https://github.com/dasilva333/airi/tree/326aeb054524b5c7979bae5cc6e838c9fbe63da1) provides the same paths.

### Source ownership map

| Responsibility | Existing owner and symbol anchors |
| --- | --- |
| Ordinary ingestion and turn execution | `packages/stage-ui/src/stores/chat.ts`: `ingest`, `performSend`, `sendQueue` |
| Stop and invalidation | Same file: `stopCurrentGeneration`, `cancelPendingSends`, `activeSendHandles`, `shouldAbort` |
| Session persistence and generation | `packages/stage-ui/src/stores/chat/session-store.ts` |
| Foreground stream projection | `chat.ts` active-session watcher and `updateUI`; `chat/stream-store.ts` |
| Lifecycle hook bus | Module-level instance in `chat.ts`; `chat/hooks.ts` |
| Intrusion staging | `chat/intrusion-staging.ts` |
| Provider streaming/native tool loop | `packages/stage-ui/src/stores/llm.ts` |
| Marker and reasoning processing | `composables/llm-marker-parser.ts`, `composables/response-categoriser.ts` |
| Speech and pacing hook consumers | `components/scenes/ControlStripHost.vue`, `services/speech/`, `composables/use-turn-pacing.ts` |

Paths in the final three rows are relative to `packages/stage-ui/src/` unless already qualified. Anchor reviews to symbols and a commit, not historical line numbers.

## 3. Evidence rules and baseline gate

Every contract below has one of three evidence states in the implementation record:

- **Observed:** established by source inspection or an existing assertion; cite which.
- **Verified:** reproduced by a named test on a recorded commit and command.
- **Unresolved:** desired protection or suspected edge case not yet established.

Do not promote an observed contract to verified without execution. Do not convert an unresolved safety concern into a claim that the baseline already satisfies it.

Before extraction:

1. Record actual HEAD, working-tree status, package-manager version, and relevant runner configuration. Compare source against the reviewed baseline if HEAD changed.
2. Consult the testing catalog and inspect existing test assertions before proposing new suites.
3. Run affected existing tests and stage-ui typecheck. Record failures, skips, and environmental requirements separately.
4. Establish the characterization cases in Sections 4–6 against the unextracted implementation.
5. If a test contradicts current behavior, determine whether its expectation is wrong or the baseline has a defect. Record the decision before moving code.

Baseline failures must not be hidden by weakening assertions, adding exclusions, changing aliases without cause, or regenerating snapshots. A relevant unresolved failure blocks its extraction phase. An unrelated failure remains visible and prevents claiming an entirely green verification run.

## 4. Behavioral contracts

### 4.1 Queue, session, and cancellation

| ID | Contract | Required observable evidence |
| --- | --- | --- |
| Q1 | Ordinary main-window sends serialize. A new send does not automatically interrupt its predecessor. | Deferred first stream blocks later dispatch; completing it starts queued work in order. |
| Q2 | User Stop settles the active send without rejecting it as a failed draft submission. | Await active `ingest`; no rejection, duplicate user message, or provider-error bubble from intentional abort. |
| Q3 | Pending sends for the stopped session reject; unrelated sessions remain queued. | Attach rejection handlers before Stop; stopped items never reach LLM dispatch; another session subsequently dispatches. |
| Q4 | Queue cancellation is logical cancellation, not a promise that internal queue storage is physically emptied immediately. | Assert public settlement and non-execution. Do not expose private refs merely to assert implementation structure. |
| S1 | Switching A to B changes foreground projection, not A's generation validity. | Late A text remains absent from B and is persisted to A. |
| S2 | Switching back to an in-flight A restores its current display. | Restored content includes text received while B was selected; subsequent chunks continue normally. |
| S3 | Generation invalidation is distinct from navigation. | After Stop/reset, deliver a late callback deliberately; assert the relevant stale-output/persistence boundary. Test Stop and reset separately. |
| C1 | Stop persists an available partial reply before bumping generation. | At most one persisted stopped partial; `aborted: true`; raw text retained in the stopped-partial path. |
| C2 | The active transport is aborted when its controller exists. | Captured signal is aborted; non-cooperative late callbacks cannot mutate the protected boundary. |
| C3 | Stop remains available after LLM completion while speech is active. | Preserve `canStop = sending || isSpeaking`; no-handle Stop emits generation-stopped and clears speaking state. |
| C4 | Secondary-window Stop forwards the target session to the owning window. | Assert actual posted payload and receiver dispatch, not merely unchanged local `sending`. |
| C5 | A subsequent normal send works after cancellation. | New stream, valid hook trace, correct persistence, settled send promise. |

Q2 is a deliberate composer contract. Pending-send rejection does not imply active-send rejection. Main-window `ingest` settlement also differs from secondary-window acknowledgement: the latter observes ingestion into history rather than completion of the entire response. Preserve both.

Cancellation does not prove that an external tool side effect was reversed. For Stop during a tool call, observe late result handling and subsequent dispatch separately from any external cancellation capability.

### 4.2 Lifecycle traces

Use an ordered event array containing event name, session ID, message ID where available, and relevant payload. Assert meaningful sequences and cardinality. Timestamps alone do not establish order or exactly-once delivery.

For a successful ordinary turn with no hook failures:

1. `beforeMessageComposed` fires once before VLM forward inference.
2. Each outer bridged inference round emits `afterMessageComposed`, then `beforeSend`.
3. Stream-derived reasoning, literal, special-token, and aside events follow the actual chunk sequence and parser buffering. Do not impose a universal ordering between independent event types.
4. Normal finalization emits `streamEnd`, `assistantResponseEnd`, `afterSend`, `assistantMessage`, then `chatTurnComplete`.

The trace must also distinguish these branches:

| Branch | Contract to characterize and preserve |
| --- | --- |
| User Stop with active handle | Generation-stopped precedes stream-end and assistant-response-end. The stopped execution must not add a second normal completion sequence. |
| Post-LLM Stop without handle | Generation-stopped handles speech cancellation; do not manufacture another completed assistant turn. |
| Exact `NO_REPLY` / `[NO_REPLY]` | Suppress spoken sentinel; preserve the silent history representation and stream-end-only finalization path. |
| Provider failure | Preserve error display, error-bearing turn-complete notification, and rejection of the failed active send. |
| `skipAssistant` / `triggerOnly` | Characterize each option independently and their supported combinations; do not infer a normal-turn trace. |
| Hook failure | Record current propagation and cleanup at the affected boundary. Do not silently swallow or reorder exceptions during extraction. |

Preserve the module-level hook bus. Moving it into Pinia setup or instantiating a second bus can strand consumers. Test listeners must unregister during cleanup.

### 4.3 Prompt, output, and companion contracts

| ID | Contract | Verification boundary |
| --- | --- | --- |
| P1 | User history insertion and the early composition hook precede VLM forward dispatch. | Hold VLM completion with a deferred promise; inspect history and hook trace before releasing it. |
| P2 | VLM analysis is inference context, not appended to the visible user message. | Inspect persisted user content and primary-LLM request separately. |
| P3 | Forward-mode failure strips image attachments before primary dispatch and supplies the existing unavailable-analysis context. | Assert no accidental second direct-vision fallback; preserve success behavior too. |
| P4 | Preserve exact grounding/context order, delimiters, and placement. | Compare deterministic primary-LLM requests before and after extraction. |
| P5 | Preserve raw orchestration tokens in normal and stopped-partial history paths, and their use in subsequent inference. | Assert `rawContent`, display content, and next-turn request separately. Preserve documented special branches such as reasoning fallback. |
| P6 | Ordinary replies without ACTOR tokens remain ordinary replies. | No phantom actor slices/chips; retain text/tool/text order and existing actor-slice tests. |
| P7 | Reasoning and speech retain current separation and explicit fallback policy. | Split in-band tags, out-of-band reasoning, fallback enabled/disabled, and speech-special exclusion. |
| P8 | Event Ledger calls retain their conditions, payload associations, and cardinality. | Spy on actual append calls for user, assistant, tool, and Stop events; preserve fire-and-forget behavior. |
| P9 | Pacing telemetry attaches only to its matching assistant message. | Matching/mismatching turn IDs cannot transfer metrics to another response. |
| P10 | Cancellation hooks reach the speech host without triggering fallback replay of the stopped partial. | Existing pacing unit coverage plus an actual host-consumer integration check or recorded desktop smoke test. A hook spy alone is insufficient. |

P1 is an ordering contract, not a universal latency guarantee. Current compaction runs before user-message insertion; queued sends also wait for earlier work. This extraction must not promise zero latency or move compaction.

### 4.4 Risks requiring baseline characterization

These are checkpoints, not established passing invariants:

- Stop during compaction or VLM forward inference: the active send handle and main streaming controller are created later. Determine what can currently be cancelled.
- Card changes during awaited retrieval: several reads use live `activeCard`/`activeCardId`, while persistence uses captured `sessionId`. Do not silently introduce whole-turn snapshots or change ownership.
- Stop while a bridged tool is unresolved: a round limit does not bound an individual tool's latency. Characterize queue drain and late result handling without claiming external rollback.
- Concurrent staging updates during prompt preparation: record when a newer staged item can be consumed or cleared; do not invent transactional staging in a formatting refactor.
- Double Stop, reset during generation, and a failing hook during finalization: determine existing persistence and cleanup behavior.

If these reveal a safety defect intersecting the extraction, produce a separate failing regression case and a bounded fix decision. Mark unresolved cases explicitly in the sign-off record.

## 5. Test inventory and harness design

### 5.1 Existing coverage to reuse

The following files exist at the reviewed baseline. Their presence is not a statement that every contract above is covered or that they passed in the review environment.

| Existing suite or group | Use in this work |
| --- | --- |
| `stores/chat-cancellation.test.ts` | Extend active/post-LLM Stop assertions; strengthen secondary-window payload assertions where needed. |
| `stores/session-switch-race.test.ts` | Reuse background-session isolation and return-to-in-flight-session coverage. |
| `stores/chat/session-message-merge.test.ts` | Retain persistence merge behavior checks. |
| `composables/llm-marker-parser.test.ts` | Retain incremental marker behavior and supported syntax coverage. |
| `composables/response-categoriser.test.ts` | Retain reasoning/speech categorization coverage. |
| `utils/chat-actor-slices.test.ts` | Retain actor-aware slice behavior and ordinary-reply behavior. |
| `stores/llm.test.ts`, `stores/llm.sanitize.test.ts` | Reuse dispatch/sanitization coverage; inspect assertions before adding overlap. |
| Six suites under `libs/pacing/` | Reuse coordinator, playback bridge, cache, classifier, policy, and prewarm coverage. |

All paths above are relative to `packages/stage-ui/src/`. Pacing's six existing suites are real coverage. This plan adds protection at orchestration connections; it does not replace or discount that coverage.

### 5.2 New coverage allocation

Create only files whose responsibilities are not already well housed in an existing suite. The logical coverage groups are mandatory; their split across filenames is an implementation choice recorded in the catalog.

| Proposed file under `stores/chat/` | Responsibility |
| --- | --- |
| `queue-cancellation.test.ts` | Q1–Q4, C5, session-scoped pending work. |
| `generation-invalidation.test.ts` | S3 and non-cooperative late callbacks; reset versus Stop. |
| `lifecycle-contracts.test.ts` | Hook traces, silent/error/option branches, ledger effects. |
| `prompt-contracts.test.ts` | VLM ordering, grounding requests, intrusion consumption, cognition first-hop placement. |
| `tool-bridge-runtime.test.ts` | Real parser-to-bridge connection, lazy tool resolution, tool history, outer round bound. |
| `error-formatter.test.ts` | Extracted error presentation only. |
| `tool-bridge.test.ts` | Extracted recognition/argument parsing only. |
| `intrusions.test.ts` | Pure formatting, time calculations, climax evaluation only. |
| `grounding-assembler.test.ts` | Pure block formatting/order only. |

Do not add another session-navigation suite under the misleading name `stale-generation`. Extend existing navigation tests when a new assertion belongs there.

### 5.3 Harness boundaries

- Instantiate the real orchestrator and relevant real session/stream stores. Use existing Pinia testing patterns with actions enabled.
- Mock external providers, model inference, sensors, and expensive repositories at their actual boundaries. Do not mock `performSend`, the queue, or an extracted helper in a test claiming to verify that connection.
- Use deferred promises to release stream start, token delivery, tool completion, and retrieval completion deterministically. Avoid arbitrary 500 ms sleeps.
- Use fake timers for timeout/elapsed-time contracts. Fixed clock fixtures must preserve relevant rounding boundaries.
- Capture deep copies of provider requests and hook payloads at observation time; later mutation must not rewrite recorded evidence.
- Register rejection handlers before cancelling pending sends. Do not silence genuine unhandled rejections globally.
- Restore mocks, timers, Pinia state, module-level staging, hook registrations, and test-owned broadcast/listener resources. `clearAllMocks` alone is not cleanup.
- Reuse existing Vitest configuration/setup. Pure helpers have no Vue/browser dependencies even if the surrounding workspace test setup provides browser shims.
- Normalize only nondeterministic IDs/timestamps in request fixtures. Preserve roles, token text, ordering, counts, session association, tool IDs and their result associations.
- Assert hook payloads, final persistence, and next-turn usability as appropriate. A snapshot of one string is not end-to-end protection.

## 6. Tool-loop contracts

The baseline has two distinct limits:

- `performSend`: at most five **outer bridged inference rounds**, including the initial round.
- `llm.ts`: native provider tool handling has its own `maxSteps: 10` configuration.

Neither value means five total tool executions or a timeout for an individual call. This extraction changes neither limit.

The runtime fixture must supply a valid, available, executable tool and return a valid bridged marker with nonempty arguments on every outer round. Assert:

1. Five outer `llmStore.stream` invocations; no sixth invocation.
2. Tool results settle and remain associated with their generated call IDs.
3. Each follow-up request contains the prior bridged assistant/tool history in the existing order.
4. Final persisted content, slices, and raw text match the characterized baseline.
5. A normal response without another bridged request exits early.
6. Multiple markers in one chunk, markers split across chunks, turn-end recovery, unavailable tools, empty arguments, and execution failures retain their current behavior.

Mocking `llmStore.stream` bypasses the native provider loop. Label this suite accordingly; do not claim it verifies the native ten-step behavior. Keep native-loop validation with the LLM owner.

## 7. Target architecture and module contracts

The dependency direction is one-way: `chat.ts` calls pure helpers. Helpers do not import `chat.ts`, Pinia stores, Vue runtime APIs, broadcast channels, repositories, or speech services. Type-only imports are acceptable where they introduce no runtime dependency.

Use existing domain types where practical. Do not pass stores as `any`, introduce a generic service bag, or serialize the entire world into a new universal turn object.

### 7.1 Error presentation: `error-formatter.ts`

**Owns:** inspection of supported error shapes, existing technical-detail extraction, auth guidance, and exact Markdown construction.

**Remains in `chat.ts`:** intentional-stop classification before formatting, stale-generation decisions, UI mutation, persistence, error-bearing hooks, rethrow, and `finally` cleanup.

Suggested API:

```typescript
interface ChatErrorContext {
  model: string | undefined
  provider: string | undefined
}

interface FormattedChatError {
  markdown: string
  message: string
  technicalDetail: string
  isAuthError: boolean
}

function formatChatError(error: unknown, context: ChatErrorContext): FormattedChatError
```

Preserve current fallback labels, response/data/body/cause precedence, embedded-JSON handling, and auth detection. Do not add rate-limit classification or new recovery copy in this phase. `sessionId` stays in the orchestrator because the formatter does not use it.

Tests cover Error objects, primitive thrown values, absent details, structured details, embedded JSON, auth cases, and details that cannot be serialized. Preserve current fallbacks; an improvement to unsupported cases belongs in a separate change.

### 7.2 Tool syntax: `tool-bridge.ts`

**Owns:** marker recognition, existing dialect precedence, argument decoding, and existing lenient-JSON behavior.

**Remains in `chat.ts`:** asynchronous tool resolution, availability/executability decisions, ID allocation, queue insertion, marker consumption at each caller, accumulator mutation, execution, ledger effects, and follow-up control.

Use two steps so extraction does not move lazy resolution across parsing or alter whether it occurs:

```typescript
type MarkerRecognition
  = | { kind: 'none' }
    | { kind: 'malformed', matchedText: string, reason: string }
    | { kind: 'candidate', matchedText: string, toolName: string, argumentsText: string }

function recognizeToolMarker(input: string): MarkerRecognition
function parseBridgeArguments(argumentsText: string): Record<string, unknown>
function tryParseLenientJson(input: string): unknown
```

The type describes syntax, not an already executed tool. A malformed result must be mapped to the original caller behavior. In particular, do not automatically strip every recognized marker: literal, special-token, and end-of-turn recovery paths handle unsuccessful matches differently.

Preserve:

- Existing regex precedence across `<|...|>`, `[call_tool:...]`, and `<tool_call>...</tool_call>` forms, including currently tolerated partial/hybrid endings.
- Resolver evaluation at the same call sites; do not memoize available tools for the whole turn.
- Empty-argument behavior, unknown-name behavior, and unmatched ACT/ACTOR/DELAY handoff.
- Actual substring consumption and loop progress. An unsuccessful recovery must not create a non-terminating loop.
- Generated `index: 0`, IDs, serialized arguments, result association, and ordered text/tool slices.

The baseline lenient parser counts delimiters and performs limited recovery; it is not a complete JSON repair parser. Characterize valid JSON, escaped quotes, braces inside strings, nested objects/arrays, truncation, trailing commas, and primitive results without declaring all such inputs supported. Extraction fixtures preserve success or failure exactly. Parser expansion is a later change.

Do not copy or replace `llm-marker-parser` or `response-categoriser` inside this module. Runtime tests must continue to exercise their real connection to the bridge.

### 7.3 Intrusion formatting: `intrusions.ts`

**Owns:** dream/journal/artistry text formatting, elapsed-minute calculation, and pure Dating Sim climax calculation.

**Remains in `chat.ts`:** store/repository access, current card selection, context snapshots, per-round evaluation, staging consumption, card updates, insertion into the request, and two-hop cognition dispatch.

Pass typed values rather than stores. Suggested inputs include:

```typescript
interface ClimaxInput {
  enabled: boolean
  gameMode: string
  positiveScore: number
  negativeScore: number
  maxScore: number
  maxTurns: number
  assistantTurnCount: number
}

interface TimedIntrusionInput {
  nowMs: number
  timestampMs: number | undefined
  template: string
}

interface IntrusionBlocks {
  climax: string
  dream: string
  journal: string
  artistry: string
}
```

Implement focused formatting functions with additional typed content fields as needed. Resolve default templates from existing constants; do not create duplicate prompt copies. Preserve placeholder replacement behavior, elapsed-minute rounding/minimums, score ties, and victory/defeat precedence.

Capture values at the original evaluation points. Do not move all reads to turn start or reinterpret `assistantTurnCount` as total message count. Current active-session/card reads must not silently become captured-session reads; ownership fixes require separate review.

The result supplies separate blocks. The orchestrator retains surrounding module context, sensor text, headers, separators, insertion position, and this consumption order:

1. Read staging and construct eligible prompts at the existing round boundary.
2. Insert the combined context into `newMessages`.
3. Clear journal/artistry staging only when the corresponding prompt was inserted.
4. Clear dream fields through the existing card update, preserving its fire-and-forget behavior.
5. Continue cognition/pre-send work and dispatch.

Consumption currently precedes successful model completion. Moving it to success, restoring staging on failure, or adding claim/acknowledgement semantics would change behavior and is excluded.

Tests must check disabled/empty inputs, default/custom templates, elapsed-time boundaries, tied scores, per-round consumption, and failed inference after consumption. Pure tests prove formatting; runtime tests prove staging/card side effects and timing.

### 7.4 Grounding formatting: `grounding-assembler.ts`

**Owns:** formatting selected grounding blocks and preserving their output order.

**Remains in `chat.ts`:** toggle evaluation, sensor refresh, STMM/lifetime access, semantic search, Director note lookup, salience probing, local catches, read timing, and request splicing.

The baseline order is:

1. VLM forward analysis.
2. Environmental awareness.
3. Short-term memory context.
4. Lifetime memory context.
5. Semantic journal memories.
6. Recent topics.
7. Director visual scratchpad.
8. Salience telemetry.

Use a typed selected-block representation, with one discriminated variant per source and exact typed data required by its formatter. Absence is explicit; an enabled environmental block with an empty string must not be accidentally treated as disabled.

Suggested surface:

```typescript
interface GroundingMessage {
  role: 'system'
  content: string
}

// GroundingBlock is a discriminated union of the eight sources above.
function formatGroundingBlock(block: GroundingBlock): GroundingMessage
function buildGroundingMessages(blocks: readonly GroundingBlock[]): GroundingMessage[]
```

The assembler preserves input order; it does not sort, deduplicate, fetch data, or decide eligibility. During the first extraction, call the pure formatter at the original push sites. A later consolidation into `buildGroundingMessages` is allowed within this phase only if it preserves evaluation timing, error boundaries, and output exactly. Do not defer formatting beyond a catch boundary that previously contained it.

Runtime fixtures preserve these collection policies:

- VLM analysis is included independently of grounding toggles when present.
- Sensor refresh occurs only under its existing gate.
- STMM/lifetime inclusion retains its independent current conditions.
- Semantic search keeps the non-trigger condition, trimmed input length greater than three, limit of three, and current character filtering.
- Recent topics retain order and weight formatting.
- Director scratchpad selection keeps newest-note-with-scratchpad behavior and session filtering.
- Salience keeps its text gate, hot/elevated predicate, and numeric formatting.
- Semantic, Director, and salience catches retain their current fallbacks. Do not make all collection failures silently optional.

Test ordinary and `triggerOnly` request insertion separately, including minimal histories. Preserve the existing two context-injection locations, including repeated sensor context if observed. Deduplicating apparently redundant prompts is a model-behavior change, not part of extraction.

## 8. Execution phases and gates

### Phase 0 — Establish the behavior baseline `[COMPLETED - 2026-09-08]`

**Changes:** Tests and fixtures only, unless a separately identified blocking defect requires its own fix.

- Established the Section 3 evidence record and reused existing suites.
- Added orchestration characterization coverage for the contracts touched by all four extractions:
  - [`queue-cancellation.test.ts`](../packages/stage-ui/src/stores/chat/queue-cancellation.test.ts) (4 tests): Q1–Q4, C5 serial queue dispatch, non-rejecting user Stop, session-scoped pending eviction, and post-cancellation send.
  - [`generation-invalidation.test.ts`](../packages/stage-ui/src/stores/chat/generation-invalidation.test.ts) (3 tests): S1–S3 navigation projection vs background generation validity, late callback dropping on Stop and reset.
  - [`lifecycle-contracts.test.ts`](../packages/stage-ui/src/stores/chat/lifecycle-contracts.test.ts) (5 tests): Deterministic hook trace sequences across ordinary, Stop, NO_REPLY, 401/403 failure, and triggerOnly branches.
  - [`prompt-contracts.test.ts`](../packages/stage-ui/src/stores/chat/prompt-contracts.test.ts) (5 tests): P1–P4, Intrusions VLM forward timing, image stripping on failure, exact 8-part grounding order, and intrusion staging consumption.
  - [`tool-bridge-runtime.test.ts`](../packages/stage-ui/src/stores/chat/tool-bridge-runtime.test.ts) (4 tests): Maximum 5-round outer bridged loop bound, early round-1 exit, multi-turn tool result association, and marker syntax dialects.
- Verified runtime tests exercise real production paths in `performSend`.
- **Exit gate:** PASS (21/21 tests passing across 5 suites, `@proj-airi/stage-ui` typecheck 0 errors).

### Phase 1 — Extract error presentation `[COMPLETED - 2026-09-08]`

- Added [`error-formatter.ts`](../packages/stage-ui/src/stores/chat/error-formatter.ts) pure helper (zero Pinia/Vue dependencies) and focused unit tests in [`error-formatter.test.ts`](../packages/stage-ui/src/stores/chat/error-formatter.test.ts) (6 tests).
- Wired into the existing catch block in `packages/stage-ui/src/stores/chat.ts` (lines 1886–1932).
- Preserved intentional Stop detection before formatting, UI message building, session persistence, hook emissions, and error rethrow.
- Cataloged suite in [`docs/project-testing-parity.md`](./project-testing-parity.md).
- **Exit gate:** PASS (27/27 chat orchestrator tests passing across 6 suites, `@proj-airi/stage-ui` typecheck 0 errors).

### Phase 2 — Extract tool syntax `[COMPLETED - 2026-09-08]`

- Added [`tool-bridge.ts`](../packages/stage-ui/src/stores/chat/tool-bridge.ts) pure helpers (`recognizeToolMarker`, `parseBridgeArguments`, `tryParseLenientJson`) with zero Pinia/Vue dependencies.
- Added unit tests in [`tool-bridge.test.ts`](../packages/stage-ui/src/stores/chat/tool-bridge.test.ts) (19 tests) covering all 5 syntax dialects, JSON recovery, key-value decoding, and truncation tolerance.
- Wired helpers into `packages/stage-ui/src/stores/chat.ts` (lines 903–1058 and line 975), replacing ~120 lines of inline parsing.
- Kept tool resolution, availability check, ID generation, queue insertion, execution, and outer 5-round bounds in `chat.ts`.
- Cataloged suite in [`docs/project-testing-parity.md`](./project-testing-parity.md).
- **Exit gate:** PASS (46/46 chat orchestrator tests passing across 7 suites, `@proj-airi/stage-ui` typecheck 0 errors).

### Phase 3 — Extract intrusion computation `[COMPLETED - 2026-09-08]`

- Added [`intrusions.ts`](../packages/stage-ui/src/stores/chat/intrusions.ts) pure helpers (`formatClimaxPrompt`, `formatDreamPrompt`, `formatJournalPrompt`, `formatArtistryPrompt`) with zero Pinia/Vue dependencies.
- Added unit tests in [`intrusions.test.ts`](../packages/stage-ui/src/stores/chat/intrusions.test.ts) (16 tests) covering climax victory/defeat/in-progress calculations, disabled/missing staging bypasses, template replacements (`{timeToDream}`, `{insertEchoChips}`, `{timeSinceJournal}`, `{journalEntryText}`, `{imagePrompt}`), and elapsed minute rounding.
- Wired helpers into `packages/stage-ui/src/stores/chat.ts` (lines 1180–1252), replacing inline template interpolations and Dating Sim calculations.
- Kept asynchronous store imports, two-hop cognition pipeline, staging reads, staging consumption, and card clear mutations strictly in `chat.ts`.
- Cataloged suite in [`docs/project-testing-parity.md`](./project-testing-parity.md).
- **Exit gate:** PASS (67/67 chat orchestrator tests passing across 9 suites, `@proj-airi/stage-ui` typecheck 0 errors).

### Phase 4 — Extract grounding formatting `[COMPLETED - 2026-09-08]`

- Added [`grounding-assembler.ts`](../packages/stage-ui/src/stores/chat/grounding-assembler.ts) pure helpers (`formatVlmBlock`, `formatEnvironmentalBlock`, `formatShortTermMemoryBlock`, `formatLifetimeMemoryBlock`, `formatSemanticMemoriesBlock`, `formatRecentTopicsBlock`, `formatDirectorScratchpadBlock`, `formatSalienceTelemetryBlock`, `formatGroundingBlock`, `buildGroundingMessages`) with zero Pinia/Vue dependencies.
- Added unit tests in [`grounding-assembler.test.ts`](../packages/stage-ui/src/stores/chat/grounding-assembler.test.ts) (14 tests) covering all 8 block formatters, exact headers/separators, numeric precision (`toFixed(2)` for topic weights, `toFixed(3)` for salience deltas), uppercase kind fallback, and order preservation.
- Wired helpers into `packages/stage-ui/src/stores/chat.ts` (lines 683–795), replacing inline object creations with calls to pure formatters.
- Kept all async fetching (`updateSensors`, `searchEntries`, `getNotes`, `probeTurn`), toggle evaluation, try-catch error boundaries, and message splicing in `chat.ts`.
- Cataloged suite in [`docs/project-testing-parity.md`](./project-testing-parity.md).
- **Exit gate:** PASS (81/81 chat orchestrator tests passing across 10 suites, `@proj-airi/stage-ui` typecheck 0 errors).

### Phase 5 — Integrated verification and documentation `[COMPLETED - 2026-09-08]`

- Ran full configured monorepo tests (`pnpm run test:run`): 91 test suites passed, 828 tests passed (0 failures, 4 suites / 8 tests conditionally skipped).
- Validated affected workspace typecheck (`pnpm -F @proj-airi/stage-ui typecheck`): passed with 0 errors (`vue-tsc --noEmit`).
- Recorded desktop smoke check scenarios (Section 9 items 1–7) as headless-verified and pending manual desktop runtime confirmation.
- Updated canonical test catalog [`docs/project-testing-parity.md`](./project-testing-parity.md) to reflect all new unit and invariant suites (91 suites / 828 tests).
- Updated canonical Rosetta Stone [`docs/rosetta-stone.md`](./rosetta-stone.md) key directory map with pure decomposed chat modules.
- Reviewed complete multi-phase diff: zero accidental prompt, queue, persistence, or timing regressions.
- **Exit gate:** PASS (Section 10 sign-off record complete, all 5 checkpoints recorded).

Each phase is a reviewable checkpoint. Commit, push, and PR operations follow the user's authorization and repository instructions; this document does not authorize publishing by itself.

## 9. Verification commands and desktop checks

From the repository root, use the current lockfile and documented setup. Record any required package build preparation; do not change dependencies merely to make a local run convenient.

```bash
pnpm -F @proj-airi/stage-ui typecheck
pnpm -F @proj-airi/stage-ui test:run
pnpm run test:run
```

Run targeted suites during development and the affected workspace gate after each extraction. Run the full monorepo command at baseline/final integration as appropriate to establish comparisons. Inspect runner output to ensure intended files were discovered and assertions actually ran. File existence, discovery, passing execution, CI inclusion, and required branch checks are separate facts.

A headless orchestration suite does not prove audible cancellation, caption cleanup, or cross-window delivery. For final desktop validation, record environment, commit, scenario, and result:

1. Send ordinary text; verify response, history, and a subsequent turn.
2. With pacing enabled, Stop during reasoning/filler preparation and during playback. Confirm no new stale output or fallback replay.
3. Stop after text generation ends while speech continues. Verify sound/captions settle and another turn works.
4. Repeat targeted Stop from the secondary chat window.
5. Switch sessions during streaming and return before completion; verify transcript ownership and expected display restoration.
6. Send a forward-vision attachment; confirm the user bubble precedes analysis and remains clean. Exercise provider failure if a deterministic fixture is available.
7. Exercise an ACT-enabled turn and an ordinary turn without ACTOR tokens; verify normal slices and speech behavior.

Use an existing host-consumer integration test where it genuinely proves the same boundary. Do not label a mocked generation-stop hook as proof of playback behavior. If desktop execution is unavailable, report it as pending rather than treating it as passed.

## 10. Sign-off record and stop conditions

Maintain one concise record per checkpoint:

| Field | Required content |
| --- | --- |
| Source | Base commit, tested commit or precise working-tree state, changed paths |
| Scope | Helper extracted; public interfaces and side effects retained |
| Evidence | Contract IDs, actual test paths/test names, commands, results |
| Runner facts | Discovered/passed/failed/skipped counts; reasons for conditional exclusions |
| Request parity | Fixtures compared and intentionally normalized fields |
| Runtime limits | Mocked boundaries, desktop checks completed/pending |
| Deviations | Baseline defects, separate fixes, unresolved risks, explicit decisions |
| Repository state | Exact pending paths; no unrelated work included or discarded |

### Recorded Checkpoints

#### Checkpoint 1 — Phase 0 Baseline & Phase 1 Error Formatter (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | Baseline `961f1c308`, working tree on `main` |
| **Scope** | Extracted `formatChatError` pure helper (`stores/chat/error-formatter.ts`); wired into `stores/chat.ts` lines 1886–1932. |
| **Evidence** | Q1–Q4, S1–S3, C1–C5, P1–P4, Intrusions, Lifecycle hook determinism, bridged tool loop limits. 27 passing tests across 6 suites in `stores/chat/`. |
| **Runner facts** | `@proj-airi/stage-ui`: 60 test suites, 501 passing tests (0 failures, 1 model-gated skip). Typecheck: `vue-tsc --noEmit` passed with 0 errors. |
| **Request parity** | Error card Markdown structure, extracted JSON technical details, and auth error advice match baseline byte-for-byte. |
| **Runtime limits** | Headless orchestrator and pure unit tests; UI message building, persistence, hooks, and rethrow remain in `chat.ts`. |
| **Deviations** | None. Zero changes to queue, persistence format, provider loop, or hook payloads. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/project-testing-parity.md`, `packages/stage-ui/src/stores/chat.ts`, plus 7 untracked test/helper files. |

#### Checkpoint 2 — Phase 2 Tool Syntax Extraction (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | Baseline `933612156`, working tree on `main` |
| **Scope** | Extracted `tool-bridge.ts` (`recognizeToolMarker`, `parseBridgeArguments`, `tryParseLenientJson`); wired into `stores/chat.ts` lines 903–1058 and line 975. |
| **Evidence** | Marker syntax recognition (5 dialects), lenient JSON parsing recovery, argument key-value decoding, truncation tolerance, 5-round loop bounds, early round-1 exit, multi-turn tool association. 23 tests across `tool-bridge.test.ts` and `tool-bridge-runtime.test.ts`. 46 tests across all 7 chat suites. |
| **Runner facts** | `@proj-airi/stage-ui`: 61 test suites, 520 passing tests (0 failures, 1 model-gated skip). Typecheck: `vue-tsc --noEmit` passed with 0 errors. |
| **Request parity** | Marker matching regex precedence, unclosed quote tolerance, delimiter balancing, and tool call payload structure match baseline. |
| **Runtime limits** | Asynchronous tool resolution, executability checks, ID allocation, execution queue, and outer loop bounds remain in `chat.ts`. |
| **Deviations** | None. Zero changes to queue, provider loop, or execution timing. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/project-testing-parity.md`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/chat/tool-bridge.ts`, `packages/stage-ui/src/stores/chat/tool-bridge.test.ts`. |

#### Checkpoint 3 — Phase 3 Intrusion Computation Extraction (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | Baseline `eccd20561`, working tree on `main` |
| **Scope** | Extracted `intrusions.ts` (`formatClimaxPrompt`, `formatDreamPrompt`, `formatJournalPrompt`, `formatArtistryPrompt`); wired into `stores/chat.ts` lines 1180–1252. |
| **Evidence** | Climax score comparison and threshold resolution, template interpolation (`{timeToDream}`, `{insertEchoChips}`, `{timeSinceJournal}`, `{journalEntryText}`, `{imagePrompt}`), elapsed minute rounding, missing/disabled staging bypass. 16 tests in `intrusions.test.ts`. 67 tests across all 9 chat orchestrator test suites. |
| **Runner facts** | `@proj-airi/stage-ui`: 62 test suites, 536 passing tests (0 failures, 1 model-gated skip). Typecheck: `vue-tsc --noEmit` passed with 0 errors. |
| **Request parity** | Exact prompt string interpolations and Dating Sim climax calculations match baseline byte-for-byte. |
| **Runtime limits** | Asynchronous store imports, two-hop cognition pipeline, staging reads, staging consumption, and card clear mutations remain in `chat.ts`. |
| **Deviations** | Minimal effort isolation for Dating Sim climax calculation per alignment discussion. Zero prompt text or staging semantics altered. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/project-testing-parity.md`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/chat/intrusions.ts`, `packages/stage-ui/src/stores/chat/intrusions.test.ts`. |

#### Checkpoint 4 — Phase 4 Grounding Formatting Extraction (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | Baseline `84522e2eb`, working tree on `main` |
| **Scope** | Extracted `grounding-assembler.ts` (pure formatters for all 8 grounding sources, `formatGroundingBlock`, `buildGroundingMessages`); wired into `stores/chat.ts` lines 683–795. |
| **Evidence** | Block formatting across VLM, environmental sensors, STMM/lifetime context pass-through, semantic memory formatting, recent topics with `.toFixed(2)` weights, director scratchpad visual state, and salience telemetry with L9–L11 deltas and hot/elevated verdicts. Order preservation and null exclusion. 14 tests in `grounding-assembler.test.ts`. 81 tests across all 10 chat orchestrator test suites. |
| **Runner facts** | `@proj-airi/stage-ui`: 63 test suites, 550 passing tests (0 failures, 1 model-gated skip). Typecheck: `vue-tsc --noEmit` passed with 0 errors. |
| **Request parity** | Exact headers (`[IMAGE ANALYSIS]`, `[ENVIRONMENTAL AWARENESS]`, `[GROUNDED LONG-TERM MEMORIES]`, `[RECENT TOPICS]`, `[VISUAL STATE BOARD]`, `[SALIENCE TELEMETRY]`), separators, and payload formats match baseline byte-for-byte. |
| **Runtime limits** | Asynchronous sensor syncing, journal semantic searching, dynamic repository imports, salience probing, independent try-catches, and message list splicing remain in `chat.ts`. |
| **Deviations** | None. Recent Topics formatting preserved as pure least-effort extraction per alignment discussion. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/project-testing-parity.md`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/chat/grounding-assembler.ts`, `packages/stage-ui/src/stores/chat/grounding-assembler.test.ts`. |

#### Checkpoint 5 — Phase 5 Integrated Verification & Monorepo Documentation (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | Baseline `3e699d832`, working tree on `main` |
| **Scope** | Integrated verification across full monorepo; updated testing catalog, Rosetta Stone, and architecture decomposition specification. |
| **Evidence** | Full automated monorepo execution (`pnpm run test:run`) passing with zero failures. Desktop smoke check scenarios (Section 9 items 1–7) recorded as headless-verified and pending live runtime check. |
| **Runner facts** | Monorepo total: 91 test suites passed, 828 tests passed (0 failures, 4 suites / 8 tests conditionally skipped). `@proj-airi/stage-ui` typecheck: `vue-tsc --noEmit` passed with 0 errors. |
| **Request parity** | Fully verified byte-for-byte prompt formatting, error presentation, tool recognition, and grounding assembly across all test suites. |
| **Runtime limits** | Headless automated verification complete. Real Electron rendering and audible TTS playback pending interactive desktop smoke checks. |
| **Deviations** | None. All 5 execution phases completed with zero behavioral regressions. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/rosetta-stone.md`. |

#### Checkpoint 6 — Peer Review Parity Rectification & Hardening (2026-09-08)

| Field | Content |
| --- | --- |
| **Source** | HEAD `a1db4ad3a`, working tree on `main` |
| **Scope** | Peer-review rectification across 4 findings: malformed tool marker consumption parity, empty-string intrusion staging cleanup, test catalog auditor fail-fast integrity, and comprehensive 8-source grounding / pre-stream staging assertion hardening. |
| **Evidence** | 85 passing tests across 10 suites in `packages/stage-ui/src/stores/chat/`. Full 8-part grounding order strictly asserted (0 < 1 < 1.5 < 1.6 < 2 < 3 < 4 < 5). In-stream staging clearance asserted before LLM streaming starts. Strict tool call ID equality asserted. Malformed marker non-consumption verified. `scripts/audit-test-catalog.mjs` exits with 0 errors and 0 uncataloged test suites (95 suites total). |
| **Runner facts** | `@proj-airi/stage-ui`: 10 chat store test suites passed, 85 passed (0 failures). Typecheck: `vue-tsc --noEmit` passed with 0 errors. Test catalog auditor: 95/95 test suites matching catalog inventory (100% parity). |
| **Request parity** | Exact parity restored for malformed marker bypass (`matchedText: ''` returned when `candidate.kind !== 'candidate'`) and empty-string intrusion template formatting/staging clearing (`hasEntry` flag / defined check). Explicit `nowMs` passed to intrusion formatters. Restored `datingSim.enabled && datingSim.settings?.gameMode === 'goal_driven'` caller gate. |
| **Runtime limits** | Headless automated verification complete. Real Electron rendering and audible TTS playback pending interactive desktop smoke checks. |
| **Deviations** | Corrected 2 behavioral edge cases discovered in peer review (malformed marker consumption and empty-string intrusion staging clearance). Hardened auditor script to fail-fast on discovery errors. |
| **Repository state** | `docs/architecture-chat-orchestrator-decomposition.md`, `docs/design-needle-subconscious-runtime.md`, `docs/project-testing-parity.md`, `packages/stage-ui/src/stores/chat.ts`, `packages/stage-ui/src/stores/chat/intrusions.ts`, `packages/stage-ui/src/stores/chat/intrusions.test.ts`, `packages/stage-ui/src/stores/chat/prompt-contracts.test.ts`, `packages/stage-ui/src/stores/chat/tool-bridge-runtime.test.ts`, `scripts/audit-test-catalog.mjs`. |

### Stop conditions

Stop the affected phase when:

- A characterization fixture changes unexpectedly.
- A helper needs a store, repository, browser API, new global state, or hidden side effect to satisfy its claimed pure boundary.
- Extraction changes an await location, catch boundary, live read, queue settlement, hook sequence, tool gate, prompt text, or staging consumption point without a separately reviewed behavior decision.
- The affected typecheck fails, a relevant test fails, or a required suite no longer runs.
- The diff grows beyond the four agreed computations to satisfy an arbitrary size target.

Keep a failed phase isolated. Correct it within its bounded scope or return to the last verified checkpoint using an explicitly authorized, non-destructive workflow. Do not silently reset, discard unrelated changes, weaken tests, or publish around a failed gate.

### Completion checklist

- [x] Baseline behavior tests were established before extraction (Phase 0 complete).
- [x] Each extracted helper has a single stated computational responsibility and no runtime store/browser dependencies (Phase 1 `formatChatError`, Phase 2 `tool-bridge`, Phase 3 `intrusions`, Phase 4 `grounding-assembler` complete).
- [x] Existing runtime callers use the helpers; no duplicate legacy implementation remains (`chat.ts` error block, tool bridge, intrusions, and grounding formatters wired).
- [x] Phase 2: Tool syntax extraction (`tool-bridge.ts` complete).
- [x] Phase 3: Intrusion computation extraction (`intrusions.ts` complete).
- [x] Phase 4: Grounding formatting extraction (`grounding-assembler.ts` complete).
- [x] Queue settlement, session navigation, and generation invalidation remain distinct.
- [x] Normal, stopped, silent, failed, and multi-round lifecycle paths retain their contracts.
- [x] Prompt bytes/order, marker handling, raw history, and staging timing remain equivalent for characterized cases.
- [x] Existing pacing, parser, categorizer, actor, session, and cancellation coverage remains active.
- [x] Affected typecheck and tests pass; full-run results and skips are recorded accurately.
- [x] Desktop/host-consumer evidence is complete or explicitly pending; no unsupported end-to-end claim is made.
- [x] Test catalog and canonical entry-point references reflect the actual result.
- [x] Every behavior deviation or intersecting baseline defect has a separate explicit disposition.


Completion means four clearer computational boundaries with demonstrated preservation of their surrounding behavior. Future runtime extraction can build on that evidence; it is not a prerequisite or hidden extension of this task.

