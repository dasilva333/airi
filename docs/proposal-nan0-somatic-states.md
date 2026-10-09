# Proposal: Dual-Engine Cognition — Coupling Somatic Needs (Body) with Nan0 Affective Dynamics (Mind)

> **Document ID:** `docs/proposal-nan0-somatic-states.md`
> **Status:** Proposal & Architectural Integration Spec
> **Date:** October 8, 2026
> **Target Subsystems:**
> - `packages/stage-ui/src/stores/nan0.ts` (Nan0 Affective Vector & Cognitive Telemetry)
> - `packages/nan0-runtime/` (Dynamical System Perturbations & Relationship Memory)
> - New `@proj-airi/somatic-runtime` or `packages/stage-ui/src/stores/somatic.ts` (Homeostatic Needs Engine)
> - `packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabCognition.vue` (Cognition Modular Toggles)

---

## 1. Executive Vision: Mind and Body as Orthogonal, Coupled Engines

Historically, AI companion frameworks treat cognitive architecture as a single monolithic block: either a plain text prompt, or a single emotional state vector.

This proposal unifies two distinct, battle-tested indie paradigms developed in the AIRI ecosystem:
1. **The Mind (Nan0 Affective Dynamics by Kyo):** A 12-dimensional psychological state machine driven by social dialogue, conversational speech acts, and interpersonal relationship dynamics.
2. **The Body (Spring-Haven Somatic Engine by AuroraEvelynAria):** An 11-dimensional physiological state machine inspired by *The Sims* and *Blade Runner 2049*, driven by a virtual world clock, metabolic decay, and domestic living needs.

Rather than merging these into an unmaintainable 23-bar soup, this architecture keeps them as **two decoupled, parallel state machines** that interact through a clean **Somatic-to-Affective Coupling Bridge** (the biological "Hangry" effect).

```
┌────────────────────────────────────────────────────────────────────────┐
│             LAYER 1: SOMATIC NEEDS ENGINE (Aurora's "Body")            │
│  Stats: hunger, thirst, stamina, awake, health, comfort, stress...     │
│  • Clock: Virtual World Time (journey clock / idle ticks)              │
│  • Input: Time passage, physical actions, habitat events               │
│  • Output: Qualitative Hysteresis Buckets (critical_low, low, mild...) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Somatic Bias Modifiers (e.g. Hangry penalty)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│            LAYER 2: AFFECTIVE DYNAMICS ENGINE (Kyo's "Mind")           │
│  Stats: Suspicion, Pride, Irritation, Curiosity, Possessiveness,       │
│         Boredom, Attachment, Smugness, Rage, Amusement, Warmth, Fear   │
│  • Clock: Conversational Turn Index & Interaction Events               │
│  • Input: TypeSafe Jev 1.13 Speech-Act Intent Discriminator            │
│  • Output: Emotional Deliberation, Monologue Tone, Expression Triggers │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Dialogic Feedback (e.g. user feeds character)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPANION INTERACTION LOOP                      │
│      LLM Monologue / Speech Handoff / Live2D & Stage Visuals          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Character Archetypes & Modular Independence

A key design requirement is that **both engines must be independently toggleable per character card**:

```
[Card Settings → Cognition Tab]
  [x] Affective Dynamics (Mind)  — Nan0 12-Bar Psychology & Jev Speech Acts
  [ ] Somatic Needs (Body)       — 11-Bar Physiological Life Simulator
```

1. **The Pure Machine / Transcendent Being (Nan0 Default):**
   - *Mind: ON | Body: OFF*
   - Free from human biological needs. She does not sleep, get hungry, or experience physical fatigue. Her personality runs purely on machine pride, gremlin smugness, intellectual curiosity, and attachment.
2. **The Domestic Life Partner (Spring-Haven Default):**
   - *Mind: ON | Body: ON*
   - A fully simulated biological partner. She gets sleepy late at night, gets hangry if meals are delayed, drops her guarded pride when exhausted, and appreciates being cared for.
3. **The Cozy Virtual Pet / Tamagotchi:**
   - *Mind: OFF | Body: ON*
   - A lightweight pet experience focused purely on feeding, resting, and routine domestic care without complex psychological friction.

---

## 3. The Subsystems in Detail

### 3.1 Layer 1: Somatic Needs Engine (The Body)
Adapted from AuroraEvelynAria's Spring-Haven architecture:

- **11 Physiological Indicators:**
  - `health` (0–100): Overall physical condition.
  - `stamina` (0–100): Immediate physical energy pool.
  - `hunger` (0–100): Metabolic food need.
  - `thirst` (0–100): Hydration level.
  - `awake` (0–100): Sleepiness/rest deficit.
  - `urine` / `hygiene` (0–100): Domestic comfort/bathroom urgency.
  - `intimacy` (0–100): Physical closeness and social presence.
  - `mood` (0–100): Baseline physical well-being.
  - `stress` (0–100): Physical and cognitive tension.
  - `comfort` (0–100): Habitat comfort and clothing suitability.
  - `energy_reserve` (0–100): Long-term nutritional battery.

- **Strict Numeric Hygiene & Prefix-Cache Protection (ADR-002):**
  - **Hard Invariant:** Raw floating-point numbers **never** enter the LLM prompt context.
  - Values are mapped to 4–5 discrete qualitative buckets (`critical_low`, `low`, `mild`, `good`) using a hysteresis margin ($\pm 2.0$) to avoid prompt cache thrashing when numbers fluctuate around boundary edges.

### 3.2 Layer 2: Nan0 Affective Dynamics (The Mind)
Kyo's canonical 12-dimensional psychological matrix as surfaced in the active UI:

| Column 1 (Guarded & Exploratory) | Column 2 (Relational & Reactive) |
| :--- | :--- |
| **Suspicion** (0–100%) | **Attachment** (0–100%) |
| **Pride** (0–100%) | **Smugness** (0–100%) |
| **Irritation** (0–100%) | **Rage** (0–100%) |
| **Curiosity** (0–100%) | **Amusement** (0–100%) |
| **Possessiveness** (0–100%) | **Warmth** (0–100%) |
| **Boredom** (0–100%) | **Fear** (0–100%) |

- **Driven by TypeSafe Jev 1.13:**
  - Non-autoregressive System-1 classification in ~50ms across contrastive distractor basins (e.g. `apology_repair`, `affection_care`, `boundary_protection`, `hostility_insult`, `persistence_threat`).

---

## 4. The Somatic-to-Affective Coupling Bridge ("The Hangry Engine")

The biological truth of cognition is that physiological depletion distorts psychological thresholds. The somatic engine feeds a set of **bias modifiers** into Nan0’s transition equations:

### 4.1 Cross-System Dynamics
1. **The "Hangry" Penalty:**
   $$\text{Hunger} \le \text{critical\_low} \implies \Delta\text{Irritation} \times 1.75, \quad \text{Baseline Smugness} - 30\%$$
   - When severely hungry, playful banter that normally triggers `Amusement` crosses over into `Irritation` or `Rage`.
2. **Exhaustion & Vulnerability:**
   $$\text{Awake} \le \text{critical\_low} \implies \text{Pride Clamp} \le 40\%, \quad \Delta\text{Attachment} \times 1.5$$
   - When exhausted, her high defensive pride (normally 80%+) cracks, lowering her emotional guard and making tender moments feel poignant and authentic.
3. **Restless Gremlin Energy:**
   $$\text{Stamina} \ge 85\% \land \text{Boredom} \ge 70\% \implies \Delta\text{Smugness} + 20\%, \quad \Delta\text{Curiosity} + 30\%$$
   - When physically energized but bored, she becomes hyperactive, provocative, and teasing.
4. **Caregiving Reward Loop:**
   - When the user performs a caretaking action (e.g., offering water, sending her to rest), satisfying a somatic deficit triggers positive affective feedback:
     $$\Delta\text{Warmth} + 15\%, \quad \Delta\text{Suspicion} - 20\%$$

---

## 5. Repository Cross-References & Source Code Mapping

For implementation and future porting, all relevant files and specifications are cataloged below:

### 5.1 Aurora's Spring-Haven Codebase (The Somatic Reference)
Located in `personal_airi/`:
* **Core Backend Repository:**
  `file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven-Core`
  - [`companion-core/src/spring_haven_core/memory.py`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven-Core/companion-core/src/spring_haven_core/memory.py) — Heartloom SQLite3 persistence, half-life decay, wake rewards, contradiction detection pairs.
  - [`companion-core/src/spring_haven_core/prompting.py`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven-Core/companion-core/src/spring_haven_core/prompting.py) — `_STATE_BUCKETS`, `_BucketHysteresis` ($\pm 2.0$), `_qualitative_bucket()`, memory token budgets.
  - [`companion-core/src/spring_haven_core/service.py`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven-Core/companion-core/src/spring_haven_core/service.py) — Per-role world-time decay loop, offline life outbox.
  - [`companion-core/tests/test_prompt_qualitative.py`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven-Core/companion-core/tests/test_prompt_qualitative.py) — Hard regression test ensuring no raw physiological numbers ever leak into prompts.

* **Full Godot & Architectural ADRs:**
  `file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven`
  - [`PROJECT.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/PROJECT.md) — Life-simulator philosophy, The Sims & Blade Runner inspirations.
  - [`godot/docs/CompanionCoreArchitecture.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/godot/docs/CompanionCoreArchitecture.md) — Godot stage machine & Python backend service bridge.
  - [`godot/docs/adr/ADR-001-heartloom-retrieval-network.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/godot/docs/adr/ADR-001-heartloom-retrieval-network.md) — 5-channel hybrid retrieval math and 3-state memory lifecycle.
  - [`godot/docs/adr/ADR-002-llm-numeric-hygiene.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/godot/docs/adr/ADR-002-llm-numeric-hygiene.md) — Canonical architectural policy: Physiological numbers only leave as qualitative buckets.
  - [`godot/docs/adr/ADR-003-backend-truth-source.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/godot/docs/adr/ADR-003-backend-truth-source.md) — World-time truth source and decay state.
  - [`godot/docs/adr/ADR-004-gameworld-stage-architecture.md`](file:///Users/richardpinedo/Projects.nosync/airi/personal_airi/Spring-Haven/godot/docs/adr/ADR-004-gameworld-stage-architecture.md) — Stage animation reconciliation.

### 5.2 AIRI & Nan0 Codebase (The Affective Reference)
Located in `airi_dasilva333/`:
* **Nan0 Cognition Runtime & Specs:**
  - [`docs/nan0/peer-review-brief-12-group-rich-jev.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/nan0/peer-review-brief-12-group-rich-jev.md) — Canonical 12-group rich contrastive Jev 1.13 decision schema.
  - [`docs/nan0/design-nan0-cognition-runtime.md`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/nan0/design-nan0-cognition-runtime.md) — Two-hop cognition pipeline, affective HUD, and shadow boundary.
  - [`scripts/tests/locomo-benchmark/jev-triage.mjs`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/scripts/tests/locomo-benchmark/jev-triage.mjs) — Question intent and memory category triage.
* **UI Surfaces & Stores:**
  - [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabCognition.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabCognition.vue) — Cognition settings tab and subcomponents.
  - [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabAffect.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabAffect.vue) — Affect baseline sliders and sensitivity parameters.
  - [`packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabPlayground.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/cognition/CognitionSubTabPlayground.vue) — Interactive testing lab and 12-bar HUD simulation.

---

## 6. Implementation Roadmap

1. **Phase 1: Somatic Store & World-Time Ticker**
   - Create `packages/stage-ui/src/stores/somatic.ts` (`useSomaticStore`).
   - Implement tick decay coupled to the idle timer or system proactivity heartbeat.
2. **Phase 2: Qualitative Hysteresis Bucketer**
   - Implement ADR-002 style bucketing (`critical_low`, `low`, `mild`, `good`) with $\pm 2.0$ hysteresis.
   - Inject the qualitative string into the prompt context prefix without thrashing the KV cache.
3. **Phase 3: Jev Intent Gating for Caretaking Speech Acts**
   - Add somatic intent questions to Jev System-1:
     `player_offering_food_or_drink`, `player_advising_rest`, `player_initiating_physical_comfort`.
   - On positive resolution, automatically replenish the corresponding somatic bar.
4. **Phase 4: The Hangry Coupling Bridge**
   - Wire somatic modifiers into `Nan0EmotionalDynamics.ts` to scale emotional response deltas.
5. **Phase 5: Character Card UI Modular Toggles**
   - Add the **Somatic Needs** toggle to `CardCreationTabCognition.vue`, allowing creators to opt into the biological life simulator or stick to the pure machine mind.
