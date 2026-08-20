# Implementation Plan - Dating Sim Architecture & Role Decoupling

This plan outlines the design, decoupling, and implementation of:
1. The **Producer & Director Role Taxonomy** inside the Dating Sim.
2. The **Gameshow Host (Producer GD-IT)** for initial turn choice generation.
3. The **Global Context Injection** logic (system prompt builder and Artistry image prompt prefixing).

---

## User Review Required

We are structuring the system to support a clear role taxonomy for both suggestion generation (Producers) and visual orchestration (Directors). Please review the following architectural breakdown and the open questions below.

---

## Open Questions

> [!IMPORTANT]
> **1. Influence of "Terms of Encounter"**
> The `termsOfEncounter` (e.g., *"With charm, wit, and just the right amount of confidence, the user must turn a routine fitness lesson into something more..."*) are highly directive. If injected directly into the character's system prompt, they may over-steer their core personality.
> *   **Proposal**: Should we gate `termsOfEncounter` so it is **only** visible to the Producer (to craft relevant choices) and NOT injected into the character's system prompt? Or do we want to include it in the character system prompt under a gentle preface (e.g., *"Context of the encounter: ..."*)?
>
> **2. Score Keys Application**
> When the user selects a choice with `positive_` and `negative_` values:
> *   Do we add them directly to the `positiveScore` and `negativeScore` variables in the store?
> *   What happens when the maximum score (`settings.maxScore`) is reached? Does it trigger the `positiveOutcome` / `negativeOutcome` storyline text as a subtitle and end the game?

---

## Proposed Architecture & Role Taxonomy

### 1. Producer Roles (Choice Generators)
Producers are responsible for generating 4 interactive choice suggestions for the user.

| Role | Input Data | Generated Keys | Purpose |
| :--- | :--- | :--- | :--- |
| **Producer Lite** | Chat history (N turns) | `[].text`, `subtitle` | Simple chatbox-only suggestion engine. Imitates user's styling. |
| **Producer OE** (Open Ended) | Chat history (N turns) | `[].text`, `subtitle`, `positive_`, `negative_` | Open-ended dating sim suggestions with score weights attached to choices. |
| **Producer GD-IT** (Gameshow Host) | Game settings, active storyline, character card | `[].text`, `subtitle`, `positive_`, `negative_` | **Initial Turn** suggestion generator. Zero chat history is used. Focuses on setting up the scene. |
| **Producer GD-NT** (Next Turn) | Storyline context + chat history | `[].text`, `subtitle`, `positive_`, `negative_` | Post-initial turn generator. Combines story rules/rules of encounter with chat history. |

### 2. Director Roles (Visual Orchestrators)
Directors run in the background (Autonomous Artistry) to decide when to generate images, select concepts, and update the scratchpad.

| Role | Generated Keys | Description |
| :--- | :--- | :--- |
| **Director Lite** | `prompt`, `intensity`, `title`, `scratchpad` | Evaluates dialogue interest and outputs visual directives. |
| **Studio Director** | Lite keys + `selected_concepts` | Resolves active overlay visual concepts and outfit layers. |
| **Intimate Director (IC)** | Lite keys (+ optionally Studio keys) + `intimacyChange`, `tensionChange`, `mood` | Directs emotional metrics based on the conversation turn. |

### 3. Valid Interaction Matrix
Depending on settings, the Director and Producer roles run in tandem or individually:
*   **Director Lite** (standalone background imagery)
*   **Studio Director** (standalone background imagery + concept tracking)
*   **Intimate Director + Producer OE** (LLM updates metrics and generates subsequent suggestions in a single call)
*   **Intimate Director + Producer NT** (Same as above, but evaluates against storyline goals)
*   **Intimate+Studio Director + Producer OE** / **Intimate+Studio Director + Producer NT**

---

## Proposed Changes

### Component 1: Gameshow Host (Producer GD-IT)

We will implement the **Gameshow Host** as a dedicated, stateless generation function inside the dating sim store. It will be called when launching a campaign if `gameMode === 'goal_driven'`.

#### [MODIFY] [dating-sim.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/dating-sim.ts)
*   Create a new function `generateInitialGoalDrivenChoices()` (the **Producer GD-IT**).
*   **System Prompt Construct**:
    *   Inject the game rules (max turns, scores).
    *   Inject the character's profile (name, personality description).
    *   Inject the active storyline metadata: `scene` (setting/location), `termsOfEncounter`, `appearances`, and any `customPremise` entered by the user.
    *   Add the game show host glue: *"Hey you have to generate 4 varied ideas for a way to initiate this story line, it might not be perfect or make perfect sense but just do your best."*
    *   Add the output guidelines for generating the initial subtitle (introduction) and the `positive_` and `negative_` score keys for each option.
*   Update `handleStorySelect()` in `DatingSimOverlay.vue` to invoke this function instead of seeding hardcoded dummy choices.

### Component 2: Global Context Injection

We will dynamically append the story parameters to the global prompt system to modify the character's behavior while the Dating Sim is active.

#### [MODIFY] [airi-card.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts)
*   Update `buildSystemPrompt` to check if `datingSimStore.enabled` and `datingSimStore.activeStoryline` exist.
*   If enabled, inject the following context with preface glue:
    *   **Custom Premise**: *"The user wants to customize or tweak the premise of this encounter, please adjust to the text below: {customPremise}"*
    *   **Target Appearance**: *"This is what your appearance is for this story. Try to make it work with your known appearance; you're free to modify or adjust as needed: {appearances}"*
    *   **Setting / Location**: *"The setting and location for this encounter is: {scene}"*
    *   **Terms of Encounter** (Subject to user feedback on question #1).

#### [MODIFY] [artistry-autonomous.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/artistry-autonomous.ts)
*   When dating sim is enabled, dynamically append the `appearances` prompt tags of the active storyline directly to the generated image prompt prefix or final prompt to ensure ComfyUI respects the curated storyboard appearance.

---

## Verification Plan

### Automated/Console Tests
*   Verify JSON schema parsing for `Producer GD-IT` outputs. Ensure `positive_` and `negative_` keys parse correctly as numbers.

### Manual Verification
1. Activate **Goal-Driven Date Session**.
2. Select **The Fitness Coach** storyboard.
3. Verify that the launcher does **not** show the hardcoded generic suggestions, but instead triggers the LLM to generate 4 story-tailored choices.
4. Verify that the initial character subtitle matches the setting.
5. Choose an option, verify that the intimacy changes and that the choices continue generating.

## Relevant Skills

- [[airi-dating-sim-engine]]
- [[airi-proactivity-sensory-telemetry]]
- [[airi-prompt-builder-engine]]
