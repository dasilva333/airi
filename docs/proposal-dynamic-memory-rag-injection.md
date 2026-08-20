# Proposal: Dynamic Memory RAG Injection via Grounding Options Popover

## Background & Problem

The model only knows what's explicitly in its context window. Cross-session memories — past conversations, emotional beats, recurring topics — are effectively invisible unless manually surfaced. Even modern long-context models (500K+ tokens) suffer significant needle-in-haystack recall degradation as history grows. The character may repeat mistakes, forget established facts about the user, or respond as if each session is their first meeting.

Today, the grounding chip button (`i-solar:cpu-bold-duotone` in [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue#L902-L915)) already solves one slice of this: it injects real-time environmental telemetry (idle time, active window, system load, local time) ephemerally into each inference call via the system prompt composition layer in `chat.ts` (specifically inside `performSend` at lines 833 and 867-896). That plumbing — inject at send time, never pollute session history, rebuild fresh each turn — is exactly the right pattern. This proposal extends that same mechanism into a full **context assembly control panel** covering sensor data, in-session semantic recall, and cross-session memory retrieval.

---

## UX Pivot: Chip Button → "Grounding Options" Popover

Rather than a simple toggle, the `i-solar:cpu-bold-duotone` button becomes a **popover trigger**, following the established `ChatBrainPopover` / `ChatMemoryPopover` / `ChatImagesPopover` pattern in `InteractiveArea.vue` using `reka-ui`'s `PopoverRoot` / `PopoverContent`.

### New Component: `ChatGroundingPopover.vue`

Panel header: **Grounding Options**
Subheader: *Control what contextual data is bundled into each message.*

The panel exposes five independent toggle rows, each persisted in the active card's `extensions.airi` config (handled in the card store [airi-card.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts)):

---

### Toggle 1 — Include System Context (Sensors)
> *Attach environmental data to the conversation*

The existing grounding feature, now surfaced as a named, independently toggle-able option. When enabled, the current environmental telemetry payload (`[ENVIRONMENTAL AWARENESS]` block) built by [proactivity.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts) is injected into inference — exactly as it works today.

On hover, a live preview panel expands showing the actual current sensor payload — mirroring the pattern already used in the Proactivity tab's sensor preview popover in the card editor [CardCreationTabProactivity.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/tabs/CardCreationTabProactivity.vue).

---

### Toggle 2 — Timeline Memory (RAG) [Planned]
> *Attach relevant snippets from this session*

Runs a semantic search against the **current session's** messages and history (including raw chat turns, short-term memory summary blocks, and journal entries) using the user's outgoing message as the query vector. It filters results strictly to the **active session ID**. This reinforces facts, decisions, or dialogue that occurred earlier in the same conversation thread but fell out of the model's sliding context window.

---

### Toggle 3 — Universe-Scoped Memory Recall (RAG) [Implemented]
> *Attach relevant snippets from past sessions within this universe*

Runs the same semantic search but across **all other sessions** and memory entries belonging to the active **Universe** (`universeId`), excluding the current active session ID to prevent redundant timeline lookups.

> [!IMPORTANT]
> **Universe-Based Scoping & Flat Design**
> As defined in [design-timeline-flat.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/design-timeline-flat.md), multiple chat sessions can coexist inside a **Universe** (`universeId`). To prevent memory/relationship leaks or timeline contradictions, any cross-session semantic search **MUST** be strictly filtered. It queries only sessions or memory entries belonging to the **active universe** (`activeUniverseId`) associated with the current session.

---

### Deduplication Rules (When both are active)
When both **Timeline Memory** and **Universe Memory** are enabled, the ingest pipeline:
1. Performs both semantic queries.
2. Merges the results.
3. **Deduplicates by document ID**: Strips duplicate records to ensure the model never receives identical memories twice.

---

### Toggle 4 — Recent Topics [Placeholder]
> *Attach a weighted list of recently discussed topics*

A lightweight, **embedding-free** context signal. The system maintains a per-card topic frequency map across sessions with a configurable decay strategy to determine which topics are "top-of-mind."

#### Topic Decay Strategies
To support different character use cases (e.g. roleplay vs. real-time assistants), the system supports three decay strategies:
1. **Turn-Based Decay (Default MVP)**: Topic weights decay based on the number of dialogue turns (messages) that have elapsed since they were last discussed. This ensures that in roleplay scenarios, pausing the chat for days does not cause the character to forget active narrative topics, while spamming messages naturally pushes old topics down.
2. **Session-Segment / Timeline-Block Decay**: Topic weights decay when crossing narrative boundaries, such as starting a new timeline branch or forking from the timeline modal.
3. **Temporal Wall-Clock Decay**: Traditional exponential decay based on real-world time elapsed (e.g., hours or days). Ideal for real-time assistants (like Rick Sanchez) that need to be aware of actual time passing in the user's physical world.

Users can choose their preferred decay strategy in the **Proactivity** tab configuration for each character card.

#### Topic Sourcing & Prioritization
To compile a highly representative and computationally lightweight topic map, the extraction pipeline sources and prioritizes data from within the active timeline/universe scopes:
1. **Echo Chips (Highest Priority — Triple Weight)**: Emotional and flavor anchor chips generated dynamically by the LLM during conversation turns. Because these are already synthesized by the model as 2-5 word keyphrase bursts (e.g. *"beach picnic"*, *"salmon theft"*), they represent high-fidelity topics and bypass raw text parsing.
2. **Raw Chat Turns (Primary Conversational Focus)**: The last $N$ dialogue turns (messages) in the current active session are parsed to extract immediate, top-of-mind themes.
3. **STMM Summary Blocks (Secondary Narrative Context)**: Daily summaries of the current timeline are parsed to ensure topics from preceding sessions that have fallen out of the sliding turn window remain active.

*Note: Permanent long-term memories (LTMM) and environmental sensor telemetry are excluded to keep the list focused on fluid, conversational topics.*

The injected block is compact and human-readable:

```
[RECENT TOPICS]
Topics this user has been talking about lately (by recency & frequency):
- work stress (high — last 20 turns)
- the park picnic (medium — last session)
- Charlie the dog (medium — ongoing)
- productivity & deadlines (fading — 100 turns ago)
```

This is different from Toggles 2 and 3 in a critical way: **it doesn't retrieve specific memory snippets**, it surfaces *what the user has been thinking about* as a lightweight orientation signal. The character doesn't need the full journal entry about the park — just knowing the park has been on the user's mind recently is enough context to make her response feel tuned in.

**Key advantage: ships without a semantic search index.** The quality gate that blocks Toggles 2 and 3 does not apply here. Topic tracking is derivable from conversation history that already exists. No embedding pipeline, no vector store, no recall precision problem.

On hover, shows the actual current topic weight table for this card.

---

### Toggle 5 — Visual Scene State (Director's Scratchpad) [Implemented]
> *Attach the Director's latest visual/spatial state board*

Maintains verbal-visual coherence between the Actor (character voice) and the Director (autonomous image generation).

When enabled, the system retrieves the latest persistent scratchpad from the most recent `directorNotes` repository entry (maximum 1000 characters). This scratchpad tracks active scene information such as current location, active outfits/accessories, held items, and active lighting. The text is formatted and injected as a system context prompt:

```
[VISUAL STATE BOARD]
Active scene & character visual state (maintained by Director):
- Location: cozy tea room, torii gate in background
- Outfit: maid uniform, cat ears accessory
- Held Item: holding a chocolate chip cookie
```

This prevents the Actor from experiencing "blindness" regarding their visual model's active state, allowing them to make conversational references to the physical space or their current appearance.

---

### Shortcuts & Configuration Link
A link row at the bottom of the popover — styled like the "Visit Image Studio" shortcut in the same component family — that navigates directly to:

**Settings → AIRI Cards → (pencil icon) → Proactivity Tab**

This is where the user controls which sensor dimensions are active (e.g. disable active window tracking but keep local time). The link surfaces it exactly where the user's attention already is when they're thinking about context.

---

## Introspecting Injections: Pre-Flight Previews & Editorial Control

Rather than treating grounding injections (RAG, sensors, topics) as a silent black box composed only at send time, they are treated as **pre-flight drafts with active user control**.

### The Real-Time Flow
1. **Dynamic Composition**: As the user types into the composer, the system monitors for a 3-5s typing pause/throttle.
2. **Context Compilation**: When triggered, the system fetches the current sensors (Toggle 1), triggers the scoped semantic query using the composer's draft text (Toggle 2 & 3), processes decay topics (Toggle 4), and retrieves the latest Director scratchpad visual state (Toggle 5).
3. **The Grounding Preview Artifact**: An interactive context preview card renders in the chat layout ([history.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/history.vue)), similar to the Director's Note (`DirectorNoteBubble.vue` in [DirectorNoteBubble.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/DirectorNoteBubble.vue)).
4. **Editorial Veto**: The user can expand this card to see exactly what telemetry and memory snippets are slated for injection. They have active control to **prune or edit individual snippets** (e.g., removing a tonally wrong memory snippet before it reaches the model).
5. **Turn Lock**: Upon clicking Send, the finalized preview locks, is bundled into the system prompt compilation layer in `chat.ts`, and morphs into a static, historical record bubble (`[ ⚡️ Grounded with N sensors & memories ]`) in the chat timeline for future session inspection.

---

## The Semantic Search Quality Gate

Toggles 2 and 3 are **visually disabled with an explanatory label** when no semantic search index is available for the active character. The label reads:

> *Requires semantic search index — not yet available for this character*

The feature is designed to gracefully degrade — Toggle 1 (sensor data), Toggle 4 (Recent Topics), and Toggle 5 (Visual Scene State) work independently and are unaffected. Toggles 2 and 3 light up when the search backend is ready.

---

## Token Budget & Score Threshold

* **Token Budget**: A configurable token limit (default: 800 tokens) split across active pillars.
* **Score Threshold**: A slider to control the minimum relevance score required to qualify a memory snippet for injection, preventing irrelevant retrieval.

---

## Gemini & Single-System-Prompt Providers

Gemini enforces a single system prompt at position 0. When the active provider is Gemini (or any other single-system-prompt provider), all enabled context blocks are **silently folded** into the base system prompt in `chat.ts` (lines 888-896) behind an internal delimiter rather than injected as a secondary system message.

## Relevant Skills

- [[airi-prompt-builder-engine]]
