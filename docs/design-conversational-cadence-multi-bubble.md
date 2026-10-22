# Conversational Cadence & Multi-Bubble Delivery

**Status:** Phase 3 decisions resolved; handoff updated October 22, 2026.

**Approved direction:** Keep normal streaming and TTS preparation. Hold dialogue and answer playback behind typing dots until streaming and Jev classification finish. Associate existing speech segments with virtual bubbles, then deliver them together. Cadence takes precedence over experimental cross-segment batching.

## 1. Executive Summary

In casual human instant messaging (Discord, Telegram, iMessage), people rarely send a single large block of text. Instead, they type in natural bursts—firing off an opener or acknowledgment, sending the main content or structured items, and following up with a sign-off or reaction.

Historically, LLM architectures have enforced a monolithic paradigm: one user prompt produces one single streaming text response. Previous attempts to simulate multi-message replies required training models on custom reply tags (e.g., `<reply_to_...>`, `<break>`), which broke compatibility with general-purpose LLMs, complicated streaming, or introduced severe formatting drift in database chat histories.

This specification establishes **Conversational Cadence**: post-stream newline-boundary classification powered by **TypeSafe Jev System-1**. The primary LLM streams normally via SSE, reasoning remains visible live, and the existing TTS pipeline prepares answer audio as usual. Dialogue text and answer playback are held behind an iPhone-style bouncing typing indicator.

After streaming ends, Jev selects conversational bubble boundaries. Existing speech segments are associated with those bubbles, and delivery starts with the audio already prepared or still being prepared. Voiced delivery follows actual playback completion plus semantic pauses; text-only delivery follows typing cadence. Storage remains one assistant turn.

**No per-bubble synthesis redesign:** Jev groups presentation; it does not define new TTS requests. Do not introduce sequential on-demand synthesis or a rolling one-bubble-ahead preparation policy.

---

## 2. Core Architectural Invariants

### 2.1 Zero Database Fragmentation (The Virtual Bubble Invariant)
The database session history strictly stores standard single-turn records:
```typescript
{
  role: 'assistant',
  content: 'Hey dont forget to bring the grocery list tonight\n\nmake sure to bring\n-bananas\n-pears\n\nlove ya see you soon',
  cadenceBubbles: [
    'Hey dont forget to bring the grocery list tonight',
    'make sure to bring\n-bananas\n-pears',
    'love ya see you soon'
  ]
}
```
- **Context Preservation:** When past turns are fed back to the LLM on subsequent turns, the prompt builder injects the single unmodified `content` (or `rawContent`). The model never sees fragmented virtual turns or invented delimiter tokens.
- **Render Separation:** Saved bubble metadata defines grouping. Only a newly generated turn in active delivery is staggered. History, refresh, and reopened timelines render all saved bubbles immediately; no cadence replay is added.
- **Exact Text:** Preserve source whitespace and Markdown when deriving bubbles. Keep source ranges or equivalent stable mappings; do not reconstruct original lines with different separators. Stored chat slices and speech segments are distinct structures.

### 2.2 Transport Invariance (Full SSE Streaming Preserved)
- HTTP/SSE streaming remains active throughout the entire generation.
- Abort controllers, idle stream timeouts, and connection monitoring operate identically to standard chat turns.
- CoT reasoning tokens (`reasoning-delta`) stream directly into `ChatResponsePart` in real-time so the user can inspect thoughts as they generate.
- During generation and classification, dialogue stays behind bouncing typing dots and answer playback is held. Existing TTS preparation continues. Track delivery progress separately from generation; a global sending flag alone cannot represent this lifecycle.
- Keep Stop available during generation, classification, audio readiness waits, playback, and silent inter-bubble gaps.

### 2.3 Strict System-1 Gate (No Heuristic Fallbacks)
- Multi-bubble cadence requires an active System-1 provider (OpenCode Go, OpenRouter, TypeSafe AI, or local WebGPU/WASM Laya).
- There is no regex or keyword fallback when System-1 is absent. If System-1 is not configured, multi-bubble delivery is locked off, ensuring that brittle rule-based heuristics never accidentally chop lists, code blocks, or markdown tables.

---

## 3. UI Navigation & Card Authoring (Option B Architecture)

### 3.1 Sub-Tab Hierarchy in `CardCreationTabActing.vue`
To provide dedicated authoring real estate without cluttering the card editor, the Acting tab adopts the Option B hierarchy:
1. **Cues:** Avatar blendshapes, ACT directives, autonomous cues, and Rehearsal Room link.
2. **Idling:** Continuous idle cycles, motions, and Model Customizer link.
3. **Voice:** Speech provider, audio expression tags, vocal mannerisms.
4. **Thinking:** Deliberation fillers, spoken asides, and an embedded `[Settings] [Lab]` toggle that hosts `ActingSubTabPacingPlayground.vue` in-place.
5. **Cadence (New):** Dedicated multi-bubble cadence controls and interactive sandbox.
6. **Stickers:** Chibi reaction stickers and stage slappers.

### 3.2 Card Cadence Schema (`AiriCadenceSchema`)
Persisted under `card.extensions.airi.acting.cadence`:
```typescript
export const AiriCadenceSchema = object({
  multiBubbleEnabled: optional(boolean()),
  splitThreshold: optional(pipe(number(), minValue(0.1), maxValue(1.0))), // Default: 0.45
  dynamicPacingEnabled: optional(boolean()), // Default: true
  typingCadenceMsPerChar: optional(pipe(number(), integer(), minValue(10), maxValue(150))), // Default: 35ms
  rapidBurstMs: optional(pipe(number(), integer(), minValue(150), maxValue(800))), // Default: 350ms
  conversationalBeatMs: optional(pipe(number(), integer(), minValue(400), maxValue(2000))), // Default: 900ms
  thoughtfulPauseMs: optional(pipe(number(), integer(), minValue(800), maxValue(4000))), // Default: 1800ms
  maxDelayCeilingMs: optional(pipe(number(), integer(), minValue(1500), maxValue(8000))), // Default: 3500ms
  maxBubblesPerTurn: optional(pipe(number(), integer(), minValue(1), maxValue(10))), // Default: 4
})
```

### 3.3 Interactive Cadence Audition Sandbox
Located directly in `ActingSubTabCadence.vue`:
- Evaluates sample dialogue text across all newline boundaries using live System-1 queries.
- Displays a decision matrix with exact confidence scores `P(split)` and color-coded badges (`[SPLIT]` in emerald, `[JOINED]` in neutral).
- Features a **"Simulate Delivery Burst"** player that animates typing indicators, computes character-cadence delays, and pops bubbles into view in real time.

---

## 4. Empirical Jev Shootout & Prompt Engineering Research

**Research provenance:** Measurements below are retained from the original development notes and were not rerun for this revision. They describe the reported probe, not production guarantees.

During development, empirical shootout tests were conducted against `https://opencode.ai/zen/v1/systemone` using model `jev-1.13-free`. The following documented findings establish the canonical prompt design and failure modes.

### 4.1 The Test Corpus (The Grocery List Probe)
```text
Hey dont forget to bring the grocery list tonight

make sure to bring
-bananas
-pears
-lettuce
-milk
-eggs

love ya see you soon
```
*Target Delivery:* 3 bubbles (Opener, List Block with Header, Sign-off).

### 4.2 Failure Mode 1: Context Starvation (Isolated Line Pairs)
- **Prompt:**
  - `state`: `"Dialogue boundary segmentation evaluation. Candidate lines: 8."`
  - `instructions`: `"Should the following text be sent as a separate follow-up chat bubble?\nPreceding: \"{before}\"\nFollowing: \"{after}\""`
- **Result:**
  - `"-bananas" -> "-pears"` scored **`0.61`** (almost breaking individual list items!).
  - `"2. Second step" -> "3. Third step"` on a numbered list scored **`0.81`** (false split).
- **Lesson:** Starving Jev of the full text prevents its attention mechanism from recognizing that lines are part of an ordered sequence. The **complete message text must always be present in `state`**.

### 4.3 Failure Mode 2: The "Black Hole" Distractor Attractor (`type: choice`)
- **Prompt:**
  - Used `type: "choice"` with 3 criteria: `new_chat_bubble`, `same_bubble_formatting`, and `incomplete_lead_in`.
- **Result:**
  - `same_bubble_formatting` swallowed **76% to 100%** of all probability mass across all 7 boundaries (`new_chat_bubble` dropped to 0.00–0.06).
- **Lesson:** Because the input text in `state` literally used line breaks to format the list, Jev chose `same_bubble_formatting` as a literally true physical description. The distractor attractor basin was so strong it completely extinguished the positive classification signal.

### 4.4 Failure Mode 3: Negative Parenthetical Bias
- **Prompt:**
  - `type: "noul"` asking: `"Between X and Y, is the first line a finished message where the sender hits send (rather than a line break inside the same bubble)?"`
- **Result:**
  - Every score collapsed into the `0.16` – `0.36` range.
- **Lesson:** Adding explicit negative contrast clauses (`rather than...`) in binary `noul` queries biases Jev toward rejection.

### 4.5 The Winning Architecture: Macro Splitting Policy in `State` + Punchy `Noul`
- **State:** Contains the complete draft text prefixed with generic splitting policy:
  ```text
  You are splitting one outgoing text into casual chat bubbles.
  Rules: Keep an unfinished lead-in line and any tightly coupled group of lines together in one bubble. Start a new bubble only on a clear shift to a separate conversational beat (like a new paragraph, topic shift, or sign-off).

  Complete text:
  """
  {rawText}
  """
  ```
- **Question Phrasing:** Bidirectional transition anchor:
  ```text
  Would a casual texter hit send after "{preceding_line}" and start a new bubble at "{following_line}"?
  ```
- **Empirical Results (Approach 3):**
  - `b_0` (`"Hey dont forget..." -> "make sure to bring"`): **`0.47`** (Split at threshold `0.45`)
  - `b_1..b_5` (`-bananas` through `-eggs`): **`0.12` – `0.27`** (Solidly Joined with an 18-point safety buffer)
  - `b_6` (`"-eggs" -> "love ya see you soon"`): **`0.78`** (Decisive Split)
- **Outcome on this probe:** Exact target grouping. Achieved the exact 3-bubble target at default threshold `0.45` with zero regexes or hardcoded list syntax. Exposes a user sensitivity slider from `0.35` to `0.75` (default: `0.45`). At `0.45`, it produces 3 bubbles; at `0.50`, it yields 2 bubbles (merging reminder + list, and splitting sign-off).

---

## 5. Inter-Bubble Delay Pacing & Semantic Rhythm Research (The Bonus Sprint)

### 5.1 The Dual-Pacing Challenge: Physical Velocity vs Conversational Rhythm

In natural texting, inter-bubble timing is governed by two independent forces:
1. **Physical Typing Effort:** Longer follow-up messages take more physical time to type than short quips. A 10-character quip (`"Wait lol"`) takes ~300ms, whereas a 120-character list takes ~2.5 seconds. Modeling this requires a linear typing velocity curve:
   $$\text{physicalDelayMs} = \text{charCount} \times \text{msPerChar}$$
2. **Conversational Rhythm (The Semantic Beat):** Physical length alone does not capture human pragmatics. Senders pause before switching topics or delivering affectionate sign-offs, but type in rapid-fire bursts when sending closely related items or punchlines.

Hardcoding static pauses (e.g. fixed 800ms) or uniform random jitter feels robotic. Incorporating Jev System-1 enables evaluating the conversational rhythm between messages alongside the physical typing curve.

---

### 5.2 Shootout: Evaluating Pacing Heads in Jev System-1

We conducted an empirical research shootout against `https://opencode.ai/zen/v1/systemone` using `jev-1.13-free` to determine the optimal question primitive for inter-bubble pacing.

#### Attempt A: `type: "score"` (Scalar Regression Head - Provider Limitation)
- **Hypothesis:** Querying Jev with `"type": "score"`, `min: 0`, `max: 1` would yield a normalized `0.0..1.0` delay scalar directly.
- **Finding:** **Provider Layer Failure.** OpenCode Go's `/zen/v1/systemone` endpoint returned `HTTP 502/503: {"error":{"type":"server_error","message":"Upstream request failed: Endpoint is unavailable."}}`.
- **Lesson:** The OpenCode Go proxy does not currently have an active regression head worker for `type: "score"`. Production systems must rely on the battle-tested `noul` and `choice` primitives.

#### Attempt B: `type: "noul"` (Continuous Pause Probability)
- **Prompt:** `"After sending \"{before}\", would a casual texter take a noticeable pause before typing \"{after}\"?"`
- **Results:**
  - `p_0` (Opener $\rightarrow$ List): **`0.31`** (Moderate pause)
  - `p_1..p_5` (Internal list items): **`0.16` – `0.21`** (Low pause / rapid typing)
  - `p_6` (List $\rightarrow$ Sign-off): **`0.68`** (High pause before sign-off)
- **Verdict:** Functionally sound, but tuning a continuous floating multiplier (`0.31` vs `0.68`) in card settings is unintuitive for creators.

#### Attempt C: `type: "choice"` (Discrete Rhythm Buckets - The Winner)
- **Prompt:** Evaluates the transition against three contrastive communicative tempos:
  ```json
  {
    "type": "choice",
    "instructions": "What is the natural conversational pause after sending \"{before}\" before typing \"{after}\"?",
    "criteria": {
      "rapid_burst": "Immediate follow-up sent in quick succession (quick 300-500ms beat).",
      "conversational_beat": "Standard natural typing pause between distinct thoughts (800-1200ms beat).",
      "thoughtful_pause": "Longer pause to think, check something, or wrap up (1500-2500ms beat)."
    }
  }
  ```
- **Results:**
  - `c_0` (Opener $\rightarrow$ List): `rapid_burst` (61%), `conversational_beat` (38%), `thoughtful_pause` (1%)
  - `c_1..c_5` (Internal list items): **91% – 96% pure `rapid_burst`** (virtually 0% pause)
  - `c_6` (List $\rightarrow$ Sign-off): Decisively flipped to **`conversational_beat` (79%) + `thoughtful_pause` (20%)**, dropping `rapid_burst` to 1%.
- **Verdict on this probe:** Clear categorical separation. Softmax probability mass shifts cleanly across boundaries, aligning with human conversational intuition.

---

### 5.3 Combined Batched Verification (Contract 8: Zero Cross-Talk)

Per Jev Contract 8 (Batching Efficiency), related heads evaluate concurrently across internal classification heads in a single forward pass (~120ms). We verified a combined 14-question payload bundling `b_0..b_6` (`type: "noul"`) and `c_0..c_6` (`type: "choice"`) over 1,606 input tokens:

| Boundary | Transition | Standalone `noul` Split | Combined Bundled Split | Pacing Choice | Rhythm Distribution |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`b_0` / `c_0`** | `"Hey dont forget..."` $\rightarrow$ `"make sure..."` | **`0.47`** *(Split)* | **`0.47`** *(Split)* | `rapid_burst` | 61% rapid / 38% beat / 1% pause |
| **`b_1` / `c_1`** | `"make sure..."` $\rightarrow$ `"-bananas"` | `0.27` | `0.25` | `rapid_burst` | 79% rapid / 20% beat / 1% pause |
| **`b_2` / `c_2`** | `"-bananas"` $\rightarrow$ `"-pears"` | `0.12` | `0.12` | `rapid_burst` | 96% rapid / 4% beat / 0% pause |
| **`b_3` / `c_3`** | `"-pears"` $\rightarrow$ `"-lettuce"` | `0.14` | `0.14` | `rapid_burst` | 96% rapid / 4% beat / 0% pause |
| **`b_4` / `c_4`** | `"-lettuce"` $\rightarrow$ `"-milk"` | `0.18` | `0.19` | `rapid_burst` | 93% rapid / 6% beat / 1% pause |
| **`b_5` / `c_5`** | `"-milk"` $\rightarrow$ `"-eggs"` | `0.14` | `0.16` | `rapid_burst` | 92% rapid / 7% beat / 1% pause |
| **`b_6` / `c_6`** | `"-eggs"` $\rightarrow$ `"love ya see you soon"` | **`0.78`** *(Split)* | **`0.79`** *(Split)* | `conversational_beat` | 1% rapid / 79% beat / 20% pause |

- **Observed stability:** The first accepted boundary stayed at 0.47; the final boundary moved from 0.78 to 0.79. Both decisions stayed the same at threshold 0.45. This probe does not establish universally zero cross-talk.
- **Reported latency:** Total WAN HTTP roundtrip clocked at **372ms** (~120ms execution on Jev), requiring only a single network hop.

---

### 5.4 The Hybrid Velocity Actuation Formula

To calculate the natural delay between virtual bubbles without subjecting the user to arbitrary waits, the actuator applies a weighted blend of physical typing velocity and Jev semantic rhythm.

#### Step 1: Compute Semantic Beat Duration via Softmax Expectation
Using Jev's output probability distribution, compute the expected beat duration:
$$\text{beatPauseMs}_i = w_{\text{rapid}} \cdot P(\text{rapid}) + w_{\text{beat}} \cdot P(\text{beat}) + w_{\text{pause}} \cdot P(\text{pause})$$

Using default constants ($w_{\text{rapid}} = 350\text{ms}$, $w_{\text{beat}} = 900\text{ms}$, $w_{\text{pause}} = 1800\text{ms}$):
- **Bubble 1 $\rightarrow$ Bubble 2 (`b_0` / `c_0`):**
  $$350(0.61) + 900(0.38) + 1800(0.01) = \mathbf{574\text{ms}}$$
  *(A brisk follow-up burst right after the initial reminder)*
- **Bubble 2 $\rightarrow$ Bubble 3 (`b_6` / `c_6`):**
  $$350(0.01) + 900(0.79) + 1800(0.20) = \mathbf{1075\text{ms}}$$
  *(A warm, distinct pause before signing off)*

#### Step 2: Text-Only Delivery — Combine with Physical Typing Velocity and Enforce Ceiling
$$\text{delayMs}_i = \text{clamp}\Big(\text{beatPauseMs}_i + (\text{charCount}_{i+1} \times \text{msPerChar}), \text{minDelayMs}, \text{maxCeilingMs}\Big)$$

- **`minDelayMs` (Default: 350ms):** Prevents instant, jarring pop-ins.
- **`maxCeilingMs` (Default: 3500ms):** Safety ceiling ensuring the user is never left waiting indefinitely for text that is already generated.

---

**Timing clarification:** Count the entire assembled next bubble, not just its first line. For voiced turns, do not add this typing estimate: wait for the current bubble's final audio piece, then apply only the semantic beat. Keep semantic beats and text-only delays as separate typed values; the current generic pausesMs must not be assumed to mean both.

### 5.5 Near-Term Goals & Implementation Initiatives

1. **Classifier and Delivery Metadata:**
   The classifier already bundles split and rhythm questions. Expose semantic beats separately from text-only delays and preserve original text ranges. Compute text-only delays after assembling complete bubbles.
2. **Card Schema:**
   Use Section 3.2 as the single schema definition. Retain persisted settings compatibility; the earlier fixed-pause draft is superseded by dynamic rhythm settings.
3. **Sandbox Telemetry UI (`ActingSubTabCadence.vue`):**
   Display the detected rhythm badge (`[RAPID BURST]`, `[CONVERSATIONAL BEAT]`, `[THOUGHTFUL PAUSE]`) and computed millisecond breakdown in the decision matrix.
4. **Future Affective Modulation (Outside Phase 3):**
   Scale $w_{\text{rapid}}$ and `msPerChar` dynamically based on character mood (e.g. energized avatars type at 20ms/char with shorter beats; reflective avatars type at 55ms/char with longer pauses).

---

## 6. End-to-End Runtime Pipeline

1. Snapshot turn identity, cadence settings, System-1 availability, and speech mode.
2. Stream the LLM normally. Show reasoning live. Feed answer text into existing speech segmentation and synthesis.
3. Hold dialogue display and answer playback behind bouncing typing dots. The playback hold must allow upstream synthesis to continue.
4. At stream completion, flush trailing speech input and call Jev on the complete dialogue text.
5. Recheck cancellation/generation identity after classification. Associate bubbles with speech segments using preserved `[start, end)` text ranges.
6. Persist one assistant message with original content/raw content plus typed cadence metadata (`cadenceBubbles`, `cadenceBubbleRanges`, `cadenceBeatsMs`, `cadenceTextDelaysMs`, legacy `cadencePausesMs`) before starting delivery.
7. Release the first bubble and its assigned audio when ready. For each following bubble:
   - **Voiced:** wait for the current bubble's final audio piece, then its semantic beat.
   - **Text-only:** use the complete next bubble's typing estimate plus semantic beat, subject to the configured ceiling.
8. Finish live delivery. Subsequent historical rendering displays every bubble immediately.

Generation, classification, and delivery are distinct phases. Persisted history does not itself trigger audio or timers. If classification fails, retain the original single message and release held normal speech without a second synthesis pass or heuristic splitting.

---

## 7. Implementation Map

| Responsibility | Authoritative Source File |
| :--- | :--- |
| **Cadence Classifier Core** | [`packages/stage-ui/src/libs/cadence/classifier.ts`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-ui/src/libs/cadence/classifier.ts) |
| **Classifier Unit Test Suite** | [`packages/stage-ui/src/libs/cadence/classifier.test.ts`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-ui/src/libs/cadence/classifier.test.ts) |
| **Chat Orchestration Hook** | [`packages/stage-ui/src/stores/chat.ts`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-ui/src/stores/chat.ts#L2108-L2130) |
| **Masked Bubble Renderer** | [`packages/stage-ui/src/components/scenarios/chat/assistant-item.vue`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-ui/src/components/scenarios/chat/assistant-item.vue#L740-L770) |
| **Cadence Settings & Sandbox UI** | [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabCadence.vue`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabCadence.vue) |
| **Thinking Tab In-Place Lab** | [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabThinking.vue`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-pages/src/pages/settings/airi-card/components/tabs/acting/ActingSubTabThinking.vue#L390-L425) |
| **Acting Sub-Tab Controller** | [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabActing.vue) |
| **Card Schema Definition** | [`packages/stage-ui/src/types/card.schema.ts`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-ui/src/types/card.schema.ts#L263-L271) |
| **Card Editor Persistence** | [`packages/stage-pages/src/pages/settings/airi-card/components/CardEditorForm.vue`](https://github.com/dasilva333/airi/blob/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9/packages/stage-pages/src/pages/settings/airi-card/components/CardEditorForm.vue) |

---

## 8. Phase 3 Runtime Integration — Resolved Decisions

### 8.1 Decision 1: Preserve Normal Voice Preparation; Gate Playback

**Original question:** Prepare voice ahead of delivery, or synthesize each bubble only when needed?

**Resolved:** Continue normal streaming TTS preparation before Jev has selected bubbles. Cadence delays answer playback and dialogue display, not synthesis. By the end of classification, some or all audio may be ready; readiness is not guaranteed.

- Keep existing provider configuration, concurrency controls, segmentation, and cancellation.
- Do not synthesize one request per Jev bubble or add a rolling one-bubble-ahead preparation policy.
- Start delivery when the first bubble's audio is ready; do not require the entire turn's audio to finish generating.
- Hold placement (waiter, not kitchen): keep `onTokenLiteral` → `intent.writeLiteral`, `onTokenSpecial` → `intent.writeSpecial`, `onStreamEnd` → `intent.writeFlush`, and `onAssistantResponseEnd` → `intent.end()` flowing normally so segmentation and TTS synthesis continue upstream. Apply the cadence hold downstream at playback scheduling/consumption (`ControlStripHost playFunction` / `playbackManager.schedule` gate, plus caption and ACT/ACTOR/effect release). Do not block the producer loop in `speech-pipeline.ts` awaiting playback completion.
- Bounded readiness timeout: if the first bubble's audio never becomes ready (synthesis failure, provider hang), stop waiting and continue with text. Delivery constant `firstBubbleReadyTimeoutMs: 8000` (not part of `AiriCadenceSchema §3.2`); on expiry release text delivery and release held normal speech once without a second synthesis pass. The same fallback applies when classification fails. Stop remains available during the wait, and expiry must not start duplicate audio or restart synthesis.
- Release prepared segments in their existing order, associated with the bubbles.
- On classifier failure or a one-bubble result, release the held answer through normal speech without generating it again.
- Normal answer-end and fallback recovery must recognize cadence ownership so they do not produce duplicate full-response speech.

### 8.2 Speech Segments Fit Under Virtual Bubbles

**Confirmed source behavior:** The default TTS chunker treats newline, carriage return, and tab as hard split characters alongside sentence punctuation. CRLF is normalized to LF. Jev considers newline boundaries only.

For matching dialogue text on the unbatched speech path, a bubble can contain several speech segments; those segments do not need to cross a selected newline boundary.

| Virtual bubble | Existing speech segments assigned to it |
| --- | --- |
| Hey! Remember groceries tonight. | Hey! / Remember groceries tonight. |
| Bring: followed by banana and pear list lines | Lead-in / banana line / pear line |
| Love ya! | Love ya! |

**Terminology:** Stored chat slices can span lines and carry actor, tool, and sticker metadata. They are not TTS segments. Preserve display metadata when rendering bubble ranges; use speech segment identity for playback tracking.

**Required mapping:** Retain stable source positions or equivalent line/segment associations through transformations. Trimming, narrative stripping, punctuation-only chunks, repeated lines, actor tokens, and silent content must not attach segments to the wrong bubble. One speech segment can produce multiple audio pieces; a bubble finishes only after all its pieces finish. Synthesis completion, scheduling, intent end, and the first audio piece's end are not equivalent to bubble playback completion.

**Source-range rule (page numbers, not rediscovery):** the classifier must record each bubble as a `[start, end)` range in the original dialogue text and preserve source whitespace/CRLF in bubble text (slice, do not rebuild with `'\n\n'`). Speech segments are attached by the range they were segmented from, never by re-matching edited bubble text. Identical repeated lines therefore map by occurrence position; punctuation-only, stripped-narrative, actor-token, and silent chunks carry their source position even when they produce no audio. A bubble containing several prepared segments plays all of them; segments never cross a selected newline boundary on the unbatched path.

### 8.3 Cadence Takes Precedence Over Experimental Batching

The optional lead coordinator can merge multiple speech segments before synthesis. It is experimental and is not enabled in the reviewed ControlStripHost configuration.

**Approved precedence:** When cadence is effectively active for a turn, bypass experimental cross-segment synthesis batching that could erase newline boundaries, even if its setting is enabled. Cadence and that batching mode are mutually exclusive for the turn.

- Apply the override before any answer segment is synthesized.
- Preserve the saved experimental preference; bypass it for the cadence turn rather than rewriting settings.
- Outside cadence, retain configured behavior.
- Several prepared segments may belong to one bubble. Audio pieces belonging to the same segment may also be joined. Neither permits merging speech across a bubble boundary.

This is a narrow compatibility rule, not a replacement speech engine.

### 8.4 Decision 2: Extend Existing Coordination

**Original question:** Should the chat store emit an event, or should ControlStripHost run the sequence?

**Resolved direction:** Reuse and extend existing reasoning/conversation pacing coordination and the speech host where practical. Do not create competing UI and audio clocks.

The precise internal placement remains an implementation choice after tracing the current pacing coordinator. The user has not mandated a new coordinator class or a specific event API.

- Chat orchestration owns completed text, Jev evaluation, single-turn persistence, and cancellation identity.
- Existing pacing/speech infrastructure owns playback readiness, bubble progress, and inter-bubble waits.
- The UI observes shared delivery progress instead of running an independent timer sequence.
- Preserve normal literal-token input to synthesis. Hold answer playback and sequence ACT/ACTOR/effects with their associated speech.
- Reasoning remains live. Preserve existing thinking/filler behavior and its handoff; prevent answer audio from escaping through fallback recovery.
- Extend existing cross-window contracts: one owner drives delivery and secondary surfaces mirror it.
- Capture session/message/generation identity and settings per turn instead of rereading a changing active card.
- Cancel live presentation on session departure; reopening history shows all saved bubbles without restarting delivery.

### 8.5 The Two Delivery Clocks

**Voiced turns:** Reveal Bubble i and play its prepared segments. After its final audio piece ends, wait only `beatMs` before revealing/playing Bubble i+1. If upcoming audio is still preparing, keep a typing/readiness indicator until ready (subject to the §8.1 readiness timeout). Do not add simulated typing time to spoken duration.

**Text-only or muted turns:** Reveal the first bubble after classification. Use `textDelayMs = clamp(beatMs + fullNextBubbleChars * msPerChar)` to time each reveal, where `fullNextBubbleChars` is the complete next bubble length (not just its first line). Do not wait for audio events in text-only mode.

**Timing contract:** `beatMs` (conversational pause from Jev rhythm softmax) and `textDelayMs` (beat + full-bubble typing estimate) are separate typed values. `pausesMs` is retained only as the legacy text-only `textDelayMs` alias; voiced delivery must never consume the combined value. Classifier evaluations expose both `expectedBeatMs`/`beatMs` and `calculatedDelayMs`/`textDelayMs`, and split results expose parallel `beatsMs` and `textDelaysMs` arrays. When `dynamicPacing` is disabled, every boundary uses `conversationalBeatMs` as a fixed beat so `beatsMs`/`textDelaysMs` still carry one value per split transition.

### 8.6 Decision 3: Stop Preserves What Exists

**Original question:** If interrupted during Bubble 1, freeze the visual stack or reveal the rest?

| Stop timing | Resolved behavior |
| --- | --- |
| During LLM generation | Abort streaming, persist the received partial reply, and display it. Preserve current behavior. |
| During classification | Cancel/invalidate the pending result and retain/display the received reply. A late result must not append another message or restart speech. |
| After generation, during delivery | Stop audio and reveal remaining generated bubbles immediately. The complete response is saved and would appear after refresh. |
| New user submission | Cancel old delivery immediately, reveal its generated remainder, and proceed with the new turn. |

Cancellation drops pending audio, synthesis work where abort is supported, timers, captions, and queued effects instead of draining them. Ignore late callbacks for cancelled turns. Keep Stop available during silent gaps as well as audible playback.

Extend the existing generation-stopped cancellation contract. Following completion hooks must not recreate an intent or trigger full-response fallback speech. Recheck generation/cancellation after asynchronous classification and before persistence or delivery.

### 8.7 Decision 4: Ordinary Static History; No Replay Feature

**Original question:** Should a historical speaker action replay cadence or read continuously?

**Resolved:** This question assumed an audio replay feature that does not exist. Phase 3 adds no audio replay or cadence reenactment.

Every saved bubble is visible immediately on refresh, reopening a timeline, or loading history. Do not hide historical text, replay typing dots, rerun Jev, or start audio automatically. Bubble grouping persists; live delivery timing is transient.

### 8.8 Current Code Baseline and Implementation Checks

Reviewed GitHub main at [97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9](https://github.com/dasilva333/airi/commit/97972c6abf1d5a4e288290efdda8fcbc0c4aa7d9), October 22, 2026. Implementation status: the full delivery loop is implemented — chunker source offsets (`TextSegment.sourceStart/End`, 17 chunker tests), segment→bubble mapping by containment cursor (7 mapping tests), `cadence-delivery` store driving voiced/text clocks, readiness-timeout and mapping-failure fail-safes (5 store tests), ControlStripHost playback gate with post-classification cancellation recheck in chat.ts, and staged reveals in `assistant-item.vue` mirrored cross-window via progress broadcast.

- classifier.ts bundles split and rhythm queries, slices bubbles from original offsets (bubbleRanges), and computes text-only delays from complete bubbles while exposing separate beatsMs/textDelaysMs (pausesMs retained as legacy text-delay alias).
- chat.ts persists typed cadence metadata, rechecks generation after classification (abort on stale), resolves the delivery plan before persistence (or releases the gate), and bypasses staggering for tool-call turns (grouping persists, audio stays continuous).
- assistant-item.vue renders staged reveals from delivery progress during active delivery and the full static stack otherwise (history, refresh, done/aborted turns).
- ControlStripHost.vue gates every playback item (audio and specials) behind bubble reveals in `playFunction`, preserving synthesis forwarding; fallback literals flow through the same gate so no second synthesis pass or parallel speech occurs.
- tts-chunker.ts records literal-stream source offsets per segment (CRLF counts 2, sentinels excluded); lead-coordinator.ts remains disabled in the reviewed configuration, so the batching override is satisfied by default.
- Bubble completion derives from strict sequential playback: an arriving next-bubble item proves prior bubbles ended; the final bubble completes on intent end (which fires after the last playback piece).

Additional source map (repository-relative):

| Responsibility | Source |
| --- | --- |
| Speech segmentation | packages/pipelines-audio/src/processors/tts-chunker.ts |
| Experimental batching | packages/pipelines-audio/src/processors/lead-coordinator.ts |
| Synthesis and scheduling | packages/pipelines-audio/src/speech-pipeline.ts |
| Speech host and hooks | packages/stage-ui/src/components/scenes/ControlStripHost.vue |
| Speech runtime | packages/stage-ui/src/services/speech/pipeline-runtime.ts |
| Event definitions | packages/stage-ui/src/types/chat.ts and packages/stage-ui/src/stores/chat/hooks.ts |
| Secondary-window mirroring | packages/stage-ui/src/stores/mods/api/context-bridge.ts |
| Actor-aware display slices | packages/stage-ui/src/utils/chat-actor-slices.ts |

### 8.9 Acceptance Criteria

1. With cadence off, ordinary streaming text and speech retain existing behavior.
2. With cadence on, reasoning remains visible and normal TTS preparation continues while dialogue and answer playback stay held through classification.
3. Delivery starts without a second per-bubble synthesis pass; no overlapping bubble audio or premature avatar effects occur.
4. A multiline list stays grouped when Jev joins it. Several speech segments play under that bubble. LF and CRLF map correctly.
5. Enabling experimental cross-segment batching alongside cadence still produces an unbatched, newline-preserving speech path. Its preference remains saved for non-cadence turns.
6. Text-only delays count entire bubbles; voiced delivery follows final-piece playback plus semantic beat.
7. Stop during generation retains partial text. Stop during classification cannot cause stale persistence. Stop during playback or a silent gap reveals the saved remainder and cancels pending delivery.
8. New submissions, session changes, and teardown leave no stale timers, speech, captions, or effects.
9. Refresh and history mounting show every saved bubble immediately with no replay.
10. Classifier failure, first-bubble audio-readiness timeout, or a one-bubble result releases held normal output once as text, without heuristic splitting, second synthesis pass, or duplicate fallback speech.
11. Verify actor changes, stripped narrative/silent chunks, repeated lines, multi-piece audio, and secondary-window input for correct mapping and single-owner delivery.
12. Tool-call turns keep bubble grouping but release to continuous audio (no stagger); bubbles with no audio advance on text-only timing while voiced bubbles follow playback plus beat.

---

## 9. Future Horizons

1. **Cross-Surface Discord Relay Parity:**
   In Discord bot channels, when `multiBubbleEnabled` is active, dispatch separate message deliveries over the Discord webhook rather than a single 2000-character wall of text.
2. **Dynamic Affective Tempo Curves:**
   Modulate typing velocity and pause durations based on live emotion tags (e.g. panic/excitement triggers snappier typing at 20ms/char; melancholy/fatigue triggers longer 60ms/char pauses).
