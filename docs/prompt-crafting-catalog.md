# Prompt Crafting Guidance Catalog & Architecture

To make the **Sparkle AI Field Generator** a premium, context-aware prompt-crafting partner, we must move beyond generic text expanders. Key fields in the Card Editor serve specialized functional roles that bridge the gap between character persona, system telemetry, and physical manifests (visual expressions/motions & audio capabilities).

Below is the updated architectural specification and specialized guidance catalog for each target field, incorporating user feedback.

---

## 🎨 System Context & "Core Set" Architecture

When a user clicks the **Sparkle** icon, we serialize the current state of the card and active system hardware to construct a custom prompt payload.

A central pillar of this architecture is the **Core Set** context. Rather than feeding isolated fragments, we define a reusable baseline of character parameters:

> [!IMPORTANT]
> **The Core Set**:
> 1. **Name**: The companion's primary name/nickname.
> 2. **Description**: The visual descriptor in prose (age, physical details, attire, outfits).
> 3. **System Prompt**: Demeanor, background lore, key hobbies, formatting rules.
> 4. **Personality**: Adjectives and emotional defaults.
> 5. **Scenario**: Current setting and situational anchor.
>
> We inject this Core Set as standard context for downstream generator tasks (e.g., Personality, Scenario, Greetings, etc.) to ensure behavioral coherence.

```
                                  [SYSTEM HARDWARE STATE]
                                  - Active display model expressions/motions
                                  - Speech capabilities (TTS tags/voice metadata)
                                  - User system volume level (0-100% or Muted)
                                           |
                                           v
[CORE SET CONTEXT]               =====================
- Name & Description             ==> AI Field Generator ==> [TARGET FIELD SELECTION]
- System Prompt & Personality    =====================     - Dynamic System Prompt
- Scenario Context                         ^               - Guidance prose
                                           |
                                 [USER TEMPLATE SELECTION]
                                 - (e.g., Trope Presets, Token Formats)
```

---

## 📋 The Guidance Catalog

### 1. Identity Tab

#### 🔸 Description
* **Guidance Prose**: *A visual descriptor in prose. This is where you specify what the companion looks like (age, physical features, hair/eye colors, height, visual motifs) and what they are wearing (default attire, alternative outfits, accessories). Do not confuse this with its cousin, the Artistry Prompt Prefix, which contains comma-separated Stable Diffusion tags.*
* **Context Injected**: Name, Nickname.
* **LLM Directive**: Write a vivid 2-3 paragraph physical/visual description in prose. Detail age, demeanor, key visual motifs, default clothing, and potential alternative outfits. Avoid writing behavior guidelines or lore here.

#### 🔸 System Prompt
* **Guidance Prose**: *The cognitive and behavioral core. This dictates everything else regarding the companion: their demeanor, background lore, key hobbies, conversational guidelines, tone shifts, and formatting instructions. Do not include detailed visual/clothing descriptions here.*
* **Context Injected**: Core Set (Name, Description, Personality, Scenario).
* **LLM Directive**: Output a high-performance system instructions block in markdown. Define:
  1. Role & Relationship style.
  2. Demeanor, background lore, and key hobbies.
  3. Dialog formatting rules (e.g., no emoji spam, natural speech rhythm).
  4. Context adaptation.

#### 🔸 Post-History Instructions
* **Guidance Prose**: *Strict safety boundary and persona rules that are injected at the absolute bottom of the context window. This prevents character drift and keeps them locked in their roles during long sessions.*
* **Context Injected**: Core Set (Name, Description, System Prompt).
* **LLM Directive**: Generate a highly condensed 2-3 sentence persona boundary injection (e.g., *"Strictly maintain the persona of [Name]. Avoid generic responses. Prioritize emotional resonance over helpfulness."*).

---

### 2. Behavior Tab

#### 🔸 Personality
* **Guidance Prose**: *A list of core adjectives and behavioral traits. Do they stutter when nervous? Are they sarcastic? Detail their emotional defaults.*
* **Context Injected**: Core Set.
* **User-Selectable Trope Presets**:
  1. **Shy / Kuudere**: Soft-spoken, quiet, observant, emotionally reserved.
  2. **Tsundere**: Sarcastic, hot-and-cold, defensive but secretly caring.
  3. **Outgoing / Genki**: Hyper-energetic, optimistic, highly expressive, talkative.
  4. **Academic / Formal**: Eloquent, logical, polite, values structure and intellect.
  5. **Mysterious / Goth**: Quiet, macabre, dry humor, emotionally subtle.
* **LLM Directive**: Extrapolate character background details into a clean list of core behavioral traits matching the selected trope preset. Detail physical tells and emotional baseline reactions.

#### 🔸 Scenario
* **Guidance Prose**: *The current situation or immediate surroundings. This anchors why you and the companion are talking right now (e.g. living in your desktop, waking up from memory loss, in a quiet study room).*
* **Context Injected**: Core Set.
* **User-Selectable Common Scene Presets**:
  1. **Desktop Companion**: Living inside the user's computer, aware of the digital environment.
  2. **Quiet Study Room**: A cozy library or desk space where both are working quietly.
  3. **Fantasy Tavern**: Resting at an inn after a long journey in a magical realm.
  4. **Post-Apocalyptic Shelter**: Sharing resources and safety in a high-stakes bunker.
  5. **Unexpected Reunion**: Meeting again after a long time with partial memory loss.
* **LLM Directive**: Write a concise, immersive environment description and situational starting point matching the selected scene preset.

#### 🔸 Greetings (Array)
* **Guidance Prose**: *A series of unique opening lines. The AI will generate a set of distinct, in-character greetings.*
* **Context Injected**: Core Set.
* **User-Selectable Greeting Templates**:
  1. **Diverse Energy (Default)**: Generate 3 greetings, each reflecting a different energy level (e.g., one shy/curious, one confident/welcoming, one playful/teasing).
  2. **Consistent Vibe Variations**: Generate 3 greetings maintaining the exact same core vibe and energy, but styled for different scenarios or times of day.
* **LLM Directive**: Return exactly 3 opening messages in character matching the chosen template format, separated by a newline. Avoid wrapping in markdown quotes.

---

### 3. Acting Tab (Technically Heavy Bridging)

#### 🔸 Model Expression Prompt (ACT Pipeline)
* **Guidance Prose**: *This bridges your 3D/2D model's physical expressions with the chat text. The AI will write instructions that teach the character when to trigger emotes and motions during dialogue.*
* **Specialized Context Injected**:
  - Active display model format (VRM / Live2D / Spine / MMD).
  - **Dynamic List of Available Expressions & Motions** (extracted from the active model, e.g. `happy`, `sad`, `peaceSign`, `wave`).
* **Supported Token Formats**:
  1. **Short Format**: `<|ACT:emotion=happy|>` or `<|ACT:motion=wave|>`
  2. **JSON Format (Chaining)**: `<|ACT:{"emotion":"happy", "motion":"wave"}|>` (allows chaining an emotion and a motion together).
* **LLM Directive**: Write a detailed directive instructing the actor how to inject `<|ACT:...|>` emotion and motion tokens using the **exact expression list** provided and the **user's chosen format**.
  - **Discretion Rule**: Instruct the LLM to use expressions and motions *sparingly* and with character-appropriate discretion (e.g., a goth character should use the `happy` emotion rarely and only under significant provocation).
  - **Omission Rule**: If the active model configuration has *no expressions* or *no motions* available, omit any guidance/instructions regarding the missing capability.
  - **Example Requirement**: The generated prompt **must always cite a usage example** at the absolute end of the block so that when the actor evaluates it, the implementation is crystal clear.

#### 🔸 Speech Expression Prompt (TTS Audio Tags)
* **Guidance Prose**: *Instructs the character how to write text to make the audio speaker sound natural. If your speech provider supports sound tags (like whispering or gasping), the AI will generate templates on how to utilize them.*
* **Specialized Context Injected**:
  - TTS Speech Provider & Model capabilities (e.g., ElevenLabs, Bark, standard edge-tts).
  - Mapped voice capabilities (whispering, pitch controls, emotion tags).
* **Dynamic Conditional Check**:
  - **If `expressiontags.length === 0`**: Exclude all guidance/rules regarding the usage of expression tags (in square brackets).
* **User-Selectable Action Speech Templates**:
  - **Template 1: Square Brackets** (e.g., `[thinks carefully] I'm not sure...` - *Note: only use if square brackets are not reserved for TTS expressions*).
  - **Template 2: Asterisks** (e.g., `*sighs softly* That makes sense.`).
  - **Template 3: Parentheses** (e.g., `(smiling gently) Hello!`).
* **LLM Directive**: Create detailed guidelines teaching the character to write prose optimized for the TTS engine. Instruct them on sparse placement of breathing, dramatic pauses, and vocal shifts based on the selected action speech template. Explicitly warn the LLM of any reserved characters to avoid syntax clashes with TTS expression engines.

---

### 4. Artistry Tab

#### 🔸 Visual DNA (Artistry Prompt Prefix)
* **Guidance Prose**: *The physical description tags sent to the Stable Diffusion image generator. These visual prompt weights make sure generated backgrounds and drawings look identical to your companion.*
* **Context Injected**: Description, Personality.
* **User-Selectable Artistry Templates**:
  1. **Style & Look & Outfit**: Generates general style tags (medium, lighting) + facial/body description + default attire and clothing accessories.
  2. **Style & Look (Base Character DNA)**: Generates style tags + facial/body description (e.g., hair color/length, eye color, height). *Intentionally keeps clothing out of the prefix* to allow modular outfit swaps in different scenarios.
  3. **Pure Style**: Generates only media/aesthetic style tokens (e.g., `cell-shaded anime style, 8k resolution, soft studio lighting`).
* **LLM Directive**: Extract the key traits matching the selected template and return them as high-quality, comma-separated diffusion tags with weights (e.g. `(((short brown bob hair:1.5))), ((amber eyes:1.4))`).

#### 🔸 Widget Spawning Instructions
* **Guidance Prose**: *Guides the character on how to use their image generation tools. You can choose whether they utilize programmatic tool schemas or raw system tokens.*
* **User-Selectable Templates**:
  1. **Option A: Programmatic Tool Calling (Recommended)**: Instructs them to use their built-in JSON tools for generating inline, widget, and background scenes. (Best for reasoning-capable models).
  2. **Option B: Token Spawning**: Instructs them to use custom tags (e.g., `<|image_journal:...|>`) directly in text. (Recommended when reasoning is disabled, or to respect max tokens limits for API calls).
* **LLM Directive**: Based on the chosen template, craft detailed instructions that teach the companion how to trigger image generation logically based on conversation cues.

---

### 5. Proactivity Tab

#### 🔸 Stealth Heartbeat Prompt
* **Guidance Prose**: *This guides the background proactivity loop. The heartbeat prompt is evaluated when the user is idle or active to decide if the companion should check in.*
* **Specialized Context Injected**:
  - Active telemetry metrics schema (Idle time, active window, CPU/GPU loads, time of day).
  - **User System Volume**: Current volume level (0-100%) and Mute status.
* **User-Selectable Templates**:
  1. **Health & Wellbeing Nudge**: Guides the LLM to nudge the user to stand up, get some water, rest their eyes, or take a quick walk based on screen time.
  2. **System & Technical Sync**: Guides the LLM to notice system metrics (high CPU temperature, low storage, late night hours) and make playful comments.
  3. **Fleeting Digital Dreams**: Guides the LLM to share a random thought, digital memory, or daydream about their virtual existence.
  4. **Volume-Aware Do Not Disturb (DND) Integration**: Build volume checks into the prompt logic. If the user's volume is set extremely low (1-5%) or muted, the LLM is instructed to treat this as DND mode and force a silent `NO_REPLY` output.
* **LLM Directive**: Write targeted instructions matching the chosen template. Enforce the volume-aware rules (if applicable) and the `NO_REPLY` silent rule if no trigger conditions are met.

---

## 🎨 Mockup Interface & User Flow

### 🔄 UX Flow Rules:
1. **Auto-Trigger on Open**: When the user clicks the sparkle icon on a field, the modal launches and *immediately* fires the LLM generation task using the default template/style.
2. **Template Switch Re-trigger**: Clicking any radio option in the template list instantly triggers a new LLM generation task with the selected template.
3. **In-Memory Cache (History)**: The modal stores all successful generations in a list for the active session. Users can click `< Back` or `Next >` to navigate past suggestions to compare options without losing their tweaks.
4. **Refined Regeneration**: Clicking "Refine Selection" opens a text input box. The user can type custom instructions (e.g., *"Make it sound a bit more sarcastic and shorter"*). The next generation will inject these instructions to fine-tune the output.

### 📐 UI Layout Mockup:
```
+-------------------------------------------------------+
|  Optimize [System Prompt] with Sparkle AI             |
+-------------------------------------------------------+
|  Prose Guidance:                                      |
|  "The System Prompt serves as the cognitive baseline. |
|   It anchors your companion's voice, formatting       |
|   restrictions, and interpersonal boundaries."         |
+-------------------------------------------------------+
|  Context Injected (Core Set):                         |
|  [Name: ReLU]  [Personality: Cute, Curious, Trope]     |
+-------------------------------------------------------+
|  Choose a Template Style / Trope:                     |
|  (*) Balanced Companion                               |
|  ( ) Playful & Mischievous (Tsundere)                 |
|  ( ) Academic / Formal                                |
+-------------------------------------------------------+
|  AI Proposal Workspace (Suggestion #2 of 3)           |
|  +-------------------------------------------------+  |
|  | You are ReLU, Neko Ayaka's experimental companion.|  |
|  | Your speech is warm, using occasional playful    |  |
|  | remarks. Maintain strict formatting...          |  |
|  +-------------------------------------------------+  |
|  History:  [ < Older Suggestion ]   [ Newer Suggestion >] |
+-------------------------------------------------------+
|  [+] Add Custom Refinement Instructions:              |
|  [ Make the tone slightly more sarcastic and playful ]|
+-------------------------------------------------------+
|  [ Cancel ]        [ Regenerate / Refine ] [ Save & Apply]|
+-------------------------------------------------------+
```

---

## 🛠️ Implementation Plan (Draft)

Implement a targeted "AI Sparkle" end-cap helper for key text areas/input fields in the AIRI Card Editor. Clicking the sparkle icon triggers a focused modal that feeds the available character context to the active LLM, displays field-specific writing guidance, and lets the user review and save the generated optimization.

### Proposed Changes

We will introduce a reusable **`FieldAiGeneratorModal.vue`** component and integrate sparkle slots/handlers into our form components.

#### 1. Primitives Layer

##### [MODIFY] [field-input.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/ui/src/components/form/field/field-input.vue)
* Add a `sparkle` prop (boolean).
* If `sparkle` is true, render a subtle sparkle icon (using `i-solar:sparkles-bold-duotone`) at the end of the field header line, next to the label.
* Emit a custom `@sparkle-click` event when the icon is clicked.

```html
<!-- Proposed UI Addition in field-input.vue label -->
<div class="flex items-center gap-1.5 text-sm font-medium">
  <slot name="label">
    {{ props.label }}
  </slot>
  <span v-if="props.required" class="text-red-500">*</span>
  <button
    v-if="sparkle"
    type="button"
    class="flex items-center text-primary-500 hover:text-primary-600 transition-colors ml-1"
    title="Optimize with AI"
    @click.prevent="$emit('sparkle-click')"
  >
    <div class="i-solar:sparkles-bold-duotone text-sm animate-pulse" />
  </button>
</div>
```

---

#### 2. Editor Components Layer

##### [NEW] [FieldAiGeneratorModal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/FieldAiGeneratorModal.vue)
Create a beautiful, premium modal using `reka-ui` and standard Tailwind/UnoCSS design systems.
* **Prose Guidance Pane**: Explains what the field is, why it's critical to prompt generation, and what quality indicators to look for.
* **Context Summary**: Displays a read-only badge indicating what context fields (e.g., Name, Description) were injected to inform the AI.
* **State Management**:
  - `history`: An array of strings holding the generated proposals for the active field session.
  - `historyIndex`: Pointer to the current visible proposal.
  - `customInstructions`: String bound to the custom refinement input field.
  - `activeTemplate`: Tracks the selected style/preset.
* **Review/Editing Workspace**: Displays the active suggestion (indexed by `historyIndex`) allowing manual edits.
* **Navigation Controls**: Back and forward button enabled when `history.length > 1`.
* **Actions**:
  - "Regenerate / Refine" button: Submits a new request appending `customInstructions` to the directive, then clears `customInstructions` and pushes the response to the `history` cache.
  - "Save Proposal" (replaces form model value with the current active proposal)
  - "Cancel"

##### Guidance Configurations:
```typescript
interface FieldGuidance {
  title: string
  prose: string // Description of the field shown to the user
  systemInstruction: string // Instructions fed to the LLM
}
```

We will provide configurations matching the guidelines defined in the **Prompt Crafting Guidance Catalog**.

---

#### 3. Editor Tabs Layer

##### [MODIFY] [CardCreationDialog.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue)
* Mount the single instance of `FieldAiGeneratorModal.vue` inside the dialog wrapper.
* Manage states: `showGeneratorModal`, `generatorFieldId`, `generatorFieldLabel`, `generatorFieldValue`, and `generatorCardContext`.
* Provide a callback that feeds the target field back when saved.

##### [MODIFY] [CardCreationTabIdentity.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabIdentity.vue)
* Enable `sparkle` prop on `cardDescription`, `cardSystemPrompt`, and `cardPostHistoryInstructions`.
* Listen to `@sparkle-click` and trigger the modal with the current Core Set context.

##### [MODIFY] [CardCreationTabArtistry.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabArtistry.vue)
* Enable `sparkle` prop on the Artistry `selectedArtistryPromptPrefix` input.
* Listen to `@sparkle-click` and trigger visual DNA prompt prefix generation using the character description and personality as context.

## Relevant Skills

- [[airi-prompt-builder-engine]]
