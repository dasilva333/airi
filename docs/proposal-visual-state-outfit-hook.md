# Architectural Record: Director-Led Modular Visual Assets

## Context
Interactive RP characters often change visual states (outfits, styles, lighting) based on narrative beats. Static system prompts fail to capture these transitions. This system introduces a **Production Studio** and **Active Concept Stack** that the Director (Visual Manifestation LLM) and the User can orchestrate in real-time.

## The Realized Concept: "The Production Studio"
Instead of a single hardcoded description, each character has a "Registry" of **Concepts**. A concept is a "Package" containing three pillars of manifestation:

### The Three Pillars of a Concept
1.  **Identity (Prompt Layer)**: Narrative prompt snippets that are appended to the generation prompt. (e.g., `, (burgundy velvet dress:1.4)`)
2.  **Artistry (Pipeline Layer)**: Overrides for the generative engine. This includes **Workflow Swapping** (swapping the entire ComfyUI JSON) and **Provider/Model Swapping** (e.g., switching from Flux to Anima).
3.  **Manifestation (Physical Layer)**: Live stage reconfigurations. This triggers a **Physical Model Swap** (Live2D/VRM) or a **Baseline Mood/Expression** lock.

---

## Mechanics: "The Stacking Engine"

### 1. Concept Types: "Base" vs. "Layer"
Concepts are categorized into two fundamental types to ensure visual consistency:
- **Base (Exclusionary)**: Represents a total state change (e.g., a New Outfit, a Cameo Character). When a Base concept is activated by the Director or User, it **clears the existing stack** to ensure no outfit overlapping occurs.
- **Layer (Additive)**: Represents a modifier or "filter" (e.g., Cinematic Style, Rain Atmosphere, Angry Mood). These concepts are stacked on top of the current Base.

### 2. The Resolution Rule (Stack Folding)
The final scene is resolved by "folding" the active stack from bottom to top:
1.  **Identity (Prompt)**: All prompt snippets in the stack are **concatenated**.
2.  **Artistry (Pipeline)**: Each layer can override the generation settings (Workflow/Provider) of the layer below it. The **last concept in the stack** that defines an override wins.
3.  **Manifestation (Physical)**: The character's physical model (Live2D/VRM) and baseline expression are resolved by the **last concept in the stack** that defines a `modelId` or `mood`.

### 3. Director Sync Logic (Post-Turn Cleanup)
To prevent "Modifier Bloat" (where styles from 20 turns ago stay active forever), the Director follows the **"Keep Base, Refresh Modifiers"** rule:
- If the Director picks a **New Base**: The entire stack is wiped and replaced.
- If the Director picks **Modifiers Only**: The current Base is preserved, but all other active concepts are cleared and replaced by the Director's new selections. This ensures the character stays in their current outfit while allowing styles/atmospheres to be transient.

### 4. Production Monitor (Bridge)
A dedicated watcher in the `AiriCardStore` monitors the stack. When a manifestation override (Model ID) reaches the top of the stack, the stage immediately initiates a `changeModel()` sequence to swap the VRM/Live2D assets.

---

## Validation History

### 1. Baseline Validation: The Moriinatsu Prompt Hook
Before the full "Bridge" architecture was completed, we used **Moriinatsu** to validate the **Identity Pillar** (Prompt Injection).
- **Goal**: Confirm the Director can select a concept and successfully "fight" her base character prompt.
- **Result**: Successfully injected specific narrative hooks into the generative prompt, proving that the Concept Registry was being correctly prioritized by the LLM context.

### 2. Deep Immersion: The Vamp-chan Burgundy Shift [REALIZED]
- **Scenario**: Vamp-chan goes through a makeover and falls in love with her burgundy dress.
- **Concept: "Original"**: Maps to the monochrome `anima_vampchan_og_dress.json` workflow and the `vamp-chan.vrm` base model.
- **Concept: "Burgundy"**: Maps to the wine-red `anima_vampchan_burgundy_dress.json` workflow and the `burgundy-chan.vrm` alt-model.
- **Transition**: When the Master requests a "Diagnostic session in the Model Room," the Director (or User) toggles the `original_dress` concept.
    - **Artistry Bridge**: Swaps the ComfyUI workflow back to the monochrome OG version.
    - **Manifestation Bridge**: Swaps the Live2D/VRM model back to the black-and-white maid uniform.
    - **Result**: Complete, zero-touch narrative immersion.

---

## Future Vision & Design Best Practices

### The "Bases for Places" Design Principle
When orchestrating multi-character casts or complex environments, treating the characters themselves as the "Base Layer" causes scene collision. Instead, treat the **Set / Location** as the Base Layer ("Bases for Places"):
*   **Base Concepts (The Sets)**: Predefine the location as the exclusionary Base (e.g., `place_bedroom`, `place_kitchen`, `place_livingroom`, `place_outdoors`). When the location changes, the Base concept is swapped, automatically resetting the active modifier stack.
*   **Layer Concepts (The Actors & Atmospheres)**: Actors (e.g., `actor_character1`) and thematic modifiers (e.g., `concept_intimate`, `concept_fun`, `concept_calm`, `concept_happy`) are layered additively on top of the place base. This lets the scene reset its slate cleanly when shifting rooms while characters layer in naturally.

### Pre-made Concept Packs
To educate users on configuring Visual Asset stacks, the Production Studio will ship with preloaded, structured concept templates:
*   **Cozy / Slice of Life Set Pack**: Includes prompt-guiding sets (`place_bedroom`, `place_kitchen`, `place_livingroom`, `place_outdoors`) that automatically direct Stable Diffusion / ComfyUI backgrounds.
*   **Atmospheric & Emotional Styles**: Standardized style modifiers (`concept_intimate`, `concept_fun`, `concept_calm`, `concept_happy`) that affect camera lens, color grading, and pipeline overrides.

### Dynamic Creator: "Add Character as Concept"
A new QoL button in the UI will allow users to instantly formalize any character as a reusable concept:
*   **Behavior**: When clicked, it queries the character's active model, voice, and artistry configuration.
*   **Output**: Automatically registers a new concept object:
    *   **ID**: `actor_{name}`
    *   **Model**: `model-id`
    *   **Voice**: `voice-id`
    *   **Prompt**: Appends the character's baseline artistry prefix.
This teaches users how to decouple their characters' visual/audio configurations from their base personalities.

### Director Dynamic Mood & Expression Pipeline
A new output field will be added to the Director to automatically track the scene's emotional tone:
*   **Dynamic Expression Mapping**: The Director will output 1 of 6 possible core emotions.
*   **Zero-Awareness Actor**: The main character actor LLM does not need to know its visual status. The stage reads the Director's emotion payload and dynamically maps it to VRM blendshapes or Live2D parameters (affecting the active display model ID), syncing the avatar's expression to the conversation automatically.

### Quick Add Action Buttons in Image Studio [Completed]
To reduce prompt editing friction:
*   Add action shortcut buttons inside the Image Studio prompt panel.
*   Tapping these injects the corresponding active concept's tags (`actor_gura`, `actor_lain`) directly into the final ComfyUI prompt line.
*   Includes a **`+ Add User`** shortcut that resolves and injects the global user visual concept tags.

## Relevant Skills

- [[airi-modular-outfits-system]]
