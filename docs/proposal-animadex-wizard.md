# Proposal: AnimaDex AI-Assisted Multi-Character World Creator

This proposal details the design of an AI-driven, multi-character onboarding and card creation wizard that leverages the **AnimaDex** dataset (36k+ curated characters) as a discovery catalog, using an LLM to synthesize rich, multi-actor roleplay cards dynamically.

---

## 1. The Core Concept: "World Basket Builder"

Instead of mapping a single character from the catalog to a flat, static card, this wizard enables users to assemble a custom "World" containing one or more characters, configuring a personalized scenario that is synthesized by the LLM.

```
[Browse 36k Catalogue] ──> [Cast Selection (Step 1)] ──> [Roster Settings (Step 2)] ──> [Story Prompts (Step 3)] ──> [LLM Synthesis (Step 4)]
```

---

## 2. Step-by-Step Wizard Flow

### Step 1: Character Selection (The Basket)
*   The user is presented with the AnimaDex character grid/list.
*   The user can browse, search, and click "Add to World" on one or more characters.
*   **Activation Condition**: The moment at least one character is added to the basket, the "Next" button lights up.

### Step 2: Roster Settings (Model & Voice Binding)
A visual two-column layout mapped for each character in the selected cast list:
*   **Left Column (The Character)**: Displays the round AnimaDex card avatar with the character's name underneath.
*   **Center Column (Visual Model Selector)**:
    *   An open-ended button that triggers the `ModelSelectorDialog`.
    *   **If Unbound**: Displays `+ Bind Avatar (Optional)`. Tapping opens the model selector.
    *   **If Bound**: Displays the cached `previewImage` of the bound Live2D/VRM model with a format badge (e.g. `VRM`, `Live2D`).
    *   **Manifest Harvesting**: If bound, the system extracts the model's available expressions and motions lists (e.g. `relax`, `happy`, `idle`, `speak`) to build an acting capabilities whitelist.
*   **Right Column (Audio Voice Selector)**:
    *   Allows the user to bind a TTS voice to the character.
    *   **Quick Audio Studio Creator Modal**: A button to configure, tune, or bind a voice profile:
        *   **Voice Provider**: Dropdown selecting the speech engine (defaults to `kokoro-local`, lists configured providers, plus `virtual-audio-studio` to select existing saved voice profiles).
        *   **Speech Model**: Select dropdown of the provider's models (hidden for `virtual-audio-studio`; falls back to a manual text input field if model listing is unsupported).
        *   **Speech Voice ID / Profile**: Select dropdown of the provider's voices (lists saved custom profiles when `virtual-audio-studio` is selected; falls back to a manual text input field if voice listing is unsupported).
        *   **Voice Profile Name**: A text field that is **only visible when `kokoro-local` is selected**. Tuning local Kokoro voices generates a *new* profile entry in Audio Studio (requiring a name). For other providers/profiles, this field is hidden since the user is simply binding an existing voice/profile.
        *   **Dual Sliders**: Adjusts **Pitch Tuning** and **Speech Speed** (visible only for `kokoro-local`).
        *   **Default UST Rules**: Pre-configures `mode: "mute"` (stripping asterisks `*` and brackets `[ ]` actions from speech while rendering them on screen).
        *   **Sandbox Playground**: A text box and **Play** button to instantly synthesize and preview the current settings.
    *   **Auto-Assign Voices**: An AI-assisted batch configurator triggered by a sparkle-icon button next to the Step 2 header:
        *   **LLM Recommendations**: Analyzes the cast characters' details (names, series, genders, tags) and automatically matches them with the best-fitting Kokoro voice presets, suggesting optimal speed rate and pitch offsets.
        *   **Interactive Playback Previews**: Allows the user to play audio previews for each recommendation. Previews are routed dynamically through a temporary, hidden voice profile (`voice_profile_auto_preview`) using the standard virtual audio studio effects pipeline for exact in-game representation.
        *   **Manual Refinement**: Exposes dropdowns and speed/pitch sliders next to each recommendation for manual overrides before committing.
        *   **Batch Action**: Tapping "Apply" registers all configured voice profiles in the store and binds them to the characters in one click.
    *   **Skipping**: Users can skip bindings entirely, in which case characters remain "LLM-only" (no ACT tokens or voice configs are bound).


### Step 3: Context & Story Prompts
After selecting the cast and setting up roster alignments, the user outlines the scenario:
1.  **Setting & Location**: *"Where do you want this story to take place?"* (e.g., 'A rainy cafe in Tokyo').
2.  **User Nickname / Identity**: *"What do you want the characters to call you?"* (e.g., 'Manager').
3.  **Lore & Behavior Rules**: *"Do you want the characters to follow canon lore/personality?"* (e.g. 'Make them tsundere', 'Set in a fantasy medieval AU').

---

## 3. The LLM Synthesis Pipeline

When the user clicks "Generate", AIRI compiles the inputs and makes a structured call to the active LLM (using JSON schema output mapping).

### The Ingestion Payload
The system sends the following to the LLM:
*   Names, **copyright/series**, trigger words, and core tags of all selected characters.
*   The user's answers to the setting, user nickname, and lore configuration questions.
*   **Bound Acting Capabilities**: For each character with a bound visual model, the whitelists of available facial expressions and motions (e.g., `["relaxed", "happy", "hehe"]`, `["idle", "speak", "think"]`). This instructs the LLM to write valid, pre-sanitized `<|ACT:emotion:...|>` and `<|ACT:motion:...|>` tokens into dialogue lines.

### The Naming Rule
*   **Single Character**: If `selectedCharacters.length === 1`, the card's name is automatically assigned to that character's name (e.g., `name = selectedCharacters[0].name`).
*   **Multi-Character**: If `selectedCharacters.length > 1`, the card is named after the synthesized world/setting or group theme (e.g., `"Vocaloid Music Studio"` or `"Genshin Tavern Lounge"`).

### The Generated Output Schema
The LLM returns a structured JSON containing modular card metadata. Visual assets keys and prompts are generated deterministically by the frontend to prevent hallucinations, while the LLM populates descriptions and personalities:

1.  **id**: Sluggified, URL-safe formal name for the card identity (e.g., `multiverse-talent-agency`).
2.  **name**: The readable nickname / display name of the world (e.g., `Multiverse Talent Agency`).
3.  **scenario**: The active circumstance, starting conflict, and narrative premise of the roleplay (excluding static physical location details).
4.  **places**: A dictionary of 2 or 3 distinct sets representing the main story settings (e.g. `place_main`, `place_alt_1`):
    *   `name`: Readable name of the location (used for description headings).
    *   `description`: High-fidelity visual description of the setting (concatenated into the card's root `description` field).
    *   `prompt`: Generative prompt tags for Stable Diffusion / ComfyUI background generation (copied into `visual_assets[place_key].prompt`).
5.  **actors**: A dictionary mapped to the deterministic keys provided in the ingestion instructions (e.g. `actor_{name}` or `actress_{name}`):
    *   `short_description`: A super brief, low-resolution visual prose description of the character's baseline appearance and current attire (used directly in `visual_assets[actor_key].description`).
    *   `long_prose`: A high-fidelity visual description of the character's detailed physical appearance and default outfit (concatenated into the card's root `description` field).
    *   `personality_prompt`: The character's specific personality traits, behavior blueprints, speech style, and rules (concatenated into the card's root `system_prompt`).
    *   `greeting`: A single-actor in-character starting greeting prefixing dialogue with their respective `<|ACTOR:key|>` token. Uses Whitelisted ACT tokens if acting capabilities were provided. (During card assembly, the first character's greeting becomes the card's default `first_mes`, while other characters' greetings populate `alternate_greetings`).
    *   `acting_instructions`: Custom guidelines outlining how and when to trigger specific whitelist emotions and motions for this character (concatenated into the system prompt).

### The Card Assembly Mapping Rules

When parsing the generated LLM response, the wizard translates the fields into standard Card and `AiriExtension` schemas:

| Target Card Field | Source LLM Output / Wizard Config | Mapping Type | Description |
| :--- | :--- | :--- | :--- |
| **`name`** | `parsedCard.name` (sluggified) | **Transform** | Sluggified string identifier (e.g. `culinary-clash`). |
| **`nickname`** | `parsedCard.name` (direct) | **Direct** | Friendly display name (e.g. "Culinary Clash"). |
| **`scenario`** | `parsedCard.scenario` | **Direct** | Overall narrative premise/conflict. |
| **`first_mes`** | `greetings[0]` | **Transform** | First item in greetings array becomes the initial greeting. |
| **`greetings`** | `[first_mes, ...alternate_greetings]` | **Transform** | Complete array of greetings (V3 format). |
| **`systemPrompt`** | `[Header] + \n\n + [actor_key: acting_instructions] (joined)` | **Concat** | Combined system instructions (acting prompts per actor). |
| **`description`** | `[actor_key: long_prose] (joined) + \n\n + [place_key: description] (joined)` | **Concat** | Combined visual/appearance data for settings and actors. |
| **`personality`** | `[actor_key: personality_prompt] (joined)` | **Concat** | Core personality profiles joined together. |
| **`extensions.airi.modules.consciousness`** | Active LLM settings | **Wizard State** | Configures active consciousness provider and model. |
| **`extensions.airi.modules.speech`** | First character's voice settings | **Wizard State** | Default active speech config (provider, model, voice). |
| **`extensions.airi.modules.displayModelId`** | First character's bound model ID | **Wizard State** | Default active 3D/2D model. |
| **`extensions.airi.acting.modelExpressionPrompt`** | Combined acting instructions | **Concat** | Directives for triggering model emotes/motions. |
| **`extensions.airi.acting.speechExpressionPrompt`** | Synthesized UST rules from bound voices | **Transform** | Bridges vocal conversion rules for TTS formatting. |
| **`extensions.airi.acting.speechMannerismPrompt`** | `""` | **Default** | Left blank. |
| **`extensions.airi.artistry.promptPrefix`** | `""` | **Default** | Left blank by default. |

### Visual Assets & Actor Modules Mapping

For multi-character cards, the actor configuration maps to two key namespaces within the card:

#### 1. Per-Actor Modules (`extensions.airi.modules.{actor_key}`)

Each actor receives a dedicated configuration block under the modules namespace to map their manifestation (model ID) and speech settings:

```typescript
"extensions.airi.modules.[actor_key]": {
  "description": string,             // Text description (e.g. "Gura's default shark outfit")
  "prompt": string,                  // Visual generation prompt combining trigger and tags: trigger, (tags)
  "isBase": boolean,                 // Set to true
  "manifestation": {
    "modelId": string                // The bound displayModelId (e.g. "display-model-...")
  },
  "speech": {
    "provider": string,              // Bound voice provider
    "model": string,                 // Bound speech model
    "voice_id": string               // Bound voice profile ID
  }
}
```

#### 2. Root Visual Assets (`extensions.airi.visual_assets.{actor_key}`)

The asset parameters are mirrored under the root `visual_assets` configuration to manage wardrobe assets:

```typescript
"extensions.airi.visual_assets.[actor_key]": {
  "description": string,             // Short visual summary of character clothing
  "prompt": string,                  // Visual generation prompt combining trigger and tags: trigger, (tags)
  "isBase": boolean,                 // Set to true
  "manifestation": {
    "modelId": string                // Bound displayModelId
  }
}
```

---

## 5. Step 4: Preview Dashboard & Refinement UI

Once the synthesis payload is sent and resolved by the LLM, the wizard presents a high-fidelity preview page instead of directly adding the card or rendering raw JSON:

### 1. Proposal Dashboard Layout
*   **AiriCard Overview**: Displays the card title (`parsedCard.name`), a placeholder avatar, and the narrative premise (`scenario`) styled in a prominent blockquote container.
*   **The Cast Row**: Lists each character with their bound visual/audio controls, displaying their generated `short_description` and custom in-character `greeting` for direct inspection.
*   **Locations List**: Shows the generated places alongside their Stable Diffusion description prompts.

### 2. Refinement & Correction Loop
*   **Guidance Textarea**: A localized text input at the bottom of the screen allows the user to supply refinement instructions (e.g. *"Actually, make Gold Ship louder at the start and set it in winter"*).
*   **`Regenerate` Button**: Sends the update instruction back to the synthesis pipeline to compile a new proposal.
*   **`Confirm & Create Card` Button**: Assembles the completed card structure, writes it natively into IndexedDB (`local:airi-cards`), and transitions the user to the chat workspace.

### 3. Developer Ingestion Toggle
*   A toggle button labeled **"Show Developer Ingestion Payload"** allows the developer/user to expand the raw payload textarea to copy and review the JSON payload sent to the LLM during runtime testing.

---

## 6. Stable Character Binding Store

> **Status**: Implemented.

### 6.1 The Problem
Every time a user opens the AnimaDex Wizard to compose a new World, they need to manually re-bind every character to their 3D model and voice profile from scratch. Characters like Hikari, Hina, or Arona each need to be individually re-linked to the files already on disk — even if the user has done this before.

### 6.2 The Idea: Stable Character Binding Store
Introduce a persistent mapping layer (likely in `localStorage` or IndexedDB) keyed by a **stable character identity** (e.g. the character's AnimaDex `trigger` string) that maps:

```typescript
interface CharacterBinding {
  trigger: string // stable AnimaDex key: e.g. "hikari, blue archive"
  displayModelId?: string // bound displayModel id from display-models store
  voiceProfileId?: string // bound VoiceProfile id from speech store
}
```

This would be stored as a lightweight `Record<string, CharacterBinding>` and persisted across sessions.

### 6.3 Behavior in the Wizard (Step 2)
- When a character is added to the Cast in Step 1 and the user proceeds to Step 2 (Roster Settings), the system **automatically pre-fills** the model and voice binding slots if a prior association exists for that character's trigger.
- The user can still override these bindings per-session, but the pre-fill eliminates repetitive re-linking.
- When the user saves a binding in Step 2 (either by picking a model or saving a voice profile), the association is written back to the persistent store automatically.

### 6.4 "On File" Filter in Step 1 (Cast Selection Grid)
Add a **toggle chip filter** to the AnimaDex character grid (Step 1) labeled something short like:

> `🎭 Has Model`

When toggled, the grid filters to only show characters whose `trigger` exists in the binding store with a `displayModelId` set. This allows the user to quickly see at a glance:
- Which characters they have 3D models for on disk.
- Which combinations they can mix and match into new worlds without needing to source new assets.

This creates a natural "collection" meta-layer — the more you use the wizard, the richer your personal binding catalog grows, and the faster future world creation becomes.

### 6.5 Implementation Notes
- The binding store should be read in `animadex-wizard.ts` and applied when characters are selected.
- The binding write-back should happen in the same Step 2 binding handlers (`bindModelToCharacter`, `bindVoiceToCharacter`).
- The "Has Model" filter chip should be added alongside the existing `selectedChips`, `selectedGender`, and series filters in the Step 1 search/filter bar.
- Consider surfacing the binding associations in the AnimaDex catalog grid as a small overlay badge (e.g. a green dot or model icon corner badge) to make it immediately visible which characters are "ready".

---

## 7. Future: Per-Character Idle Animation Control

> **Status**: Planned — blocked on foundational card schema changes (see §7.2). Must resolve at the card level before the wizard can surface it.

### 7.1 The Problem

The card-level Acting tab currently exposes a global **Idle Loop / Cycle Animations** picker (e.g. `agentOO7`, `cool`, `armsSwing`, `crabDance`, etc.). This works fine for single-character cards where only one model is ever active.

With multi-character wizard cards each actor has its own **bound model file**, and each model file has its own available set of motions. The global idle picker becomes ambiguous — *which character's model does it apply to?* — and the schema has no place to store per-character idle preferences. This is a foundational gap that affects all multi-character cards, not just wizard-generated ones.

### 7.2 Root Cause: Schema Gap

`idleAnimations` is currently a flat array at the card root level. The wizard already populates `visual_assets.[actor_key].manifestation.modelId`, but there is no sibling field for the character's chosen idle animation keys. The fix requires adding a new optional field to the per-actor visual asset block:

```typescript
// Proposed schema addition inside extensions.airi.visual_assets.[actor_key]
"idleAnimations": string[]   // ordered list of motion keys to cycle when this actor is active
```

This field would be read by the runtime to override the card-level idle loop whenever a specific actor's model is the active display model.

### 7.3 Motion Availability by Format

The `motions` array fed to the LLM during synthesis already unifies all motion sources across formats. For reference, the sources per format are:

| Format | Motion Source | Universal / Bundled |
|--------|--------------|---------------------|
| **VRM** | Built-in `.vrma` files + any user-imported custom `.vrma` files | Universal built-in set (e.g. `armsSwing`, `cool`, `agentOO7`, `crabDance`) plus user-added customs |
| **Live2D** | Motions bundled directly inside the model package | Bundled only — no universal set |
| **MMD** | Built-in `.vmd`/`.mmda` files + user-imported custom animation files | Universal built-in set + user-added customs |
| **Spine** | Motions bundled directly inside the model package | Bundled only — no universal set |

All four formats' motion keys are already coalescenced into the single `motions[]` array before ingestion. The LLM already uses this unified array to build `modelPromptAct` (expression + motion acting instructions). The only missing step is also using this array to populate `idleAnimations[]` per actor.

### 7.4 LLM Synthesis Responsibility

During Step 4 synthesis, the LLM should use the `motions[]` array for two distinct purposes per actor:

1. **`modelPromptAct`** ← uses both `expressions[]` + `motions[]` — describes *reactive* acting directions (e.g. "use `excited` expression when delivering good news, trigger `crabDance` motion for comedic effect").
2. **`idleAnimations[]`** ← uses `motions[]` only — selects 1–3 motion keys that best match the character's resting personality for passive looping (e.g. Hikari → `["innocent", "shy"]`; Hina → `["cool", "energetic"]`; Arona → `["kawaiiKaiwai", "innocent"]`).

The synthesis system prompt should be updated to explicitly instruct the LLM on this distinction.

### 7.5 Wizard Step 2 UI Change (Roster Settings / Manifestation Tab)

Once the schema supports `idleAnimations` per actor, the Step 2 Manifestation panel for each character should expose an idle picker (similar to the existing card-level Acting tab picker) that:

- Only displays motion keys available for that character's currently bound model.
- Defaults to empty (inheriting the card-level global idle loop) if no model is bound.
- Pre-fills from the LLM's proposal `idleAnimations[]` on the Step 4 dashboard for review before card creation.

### 7.6 Implementation Order

1. **Schema**: Add `idleAnimations?: string[]` to the per-actor `visual_assets` block definition.
2. **Runtime**: Update the model switcher to read `visual_assets.[active_actor_key].idleAnimations` when switching actors and apply it to the idle loop controller.
3. **Synthesis prompt**: Update the LLM system prompt in `handleGenerate` to populate `idleAnimations[]` per actor from the coalescenced `motions[]` array.
4. **Wizard Step 2 UI**: Add the per-actor idle picker to the Manifestation panel in `guided.vue`.
5. **Card Edit UI**: Consider adding per-actor idle pickers to the existing Acting tab when the card has multiple visual asset actors defined.

---

## 8. Future: UST Rules → `speechExpressionPrompt` Bridge

> **Status**: **NOT IMPLEMENTED** — documented in the output mapping table (§4) as a planned transform but the actual synthesis pipeline does not include UST data in the payload or translate it into `speechExpressionPrompt`.

### 8.1 The Problem

When a user configures a voice profile in the wizard's Step 2 voice creator modal, they set **UST (Universal Speech Transform) rules** — things like:
- Strip `*` and `_` (action markers)
- Strip `[` and `]` (bracket content — e.g. stage directions the user doesn't want spoken)
- Strip `()` and `<>` (inline tags)
- `convertBracketsToTokenFormat: true`
- Custom character replacements

These settings live in the saved `VoiceProfile.ust` block. However, the synthesis payload passed to the LLM (`handleGenerate` → `payload` object, lines 531–543 of `guided.vue`) contains **no UST data at all**. The LLM schema output also has no `modelPromptSpeech` field. As a result, `extensions.airi.acting.speechExpressionPrompt` is always assembled as an empty string `""` in `confirmCreateCard()`.

### 8.2 What Should Happen

The LLM should receive the bound voice profile's UST configuration per actor and **translate it into natural language speech instructions** for the character. These instructions are stored in `speechExpressionPrompt` and injected into the runtime prompt so the LLM knows how to format its own output for clean TTS synthesis.

**Example UST config → expected `speechExpressionPrompt` output:**

Given a UST config of:
```json
{
  "mode": "mute",
  "customStripChars": "*_[]()<>\"'",
  "stripEmojis": true,
  "convertBracketsToTokenFormat": true
}
```

The LLM should generate something like:
> "Do not include asterisk action markers (`*text*`), square bracket stage directions (`[text]`), or emoji in speech output. Parenthetical asides `(text)` should also be omitted. Angle bracket tags `<text>` should be stripped. Speak only the dialogue content — no narration or formatting symbols."

### 8.3 What Needs to Change

**1. Synthesis payload** — Add a `voiceConfig` block per cast member to `handleGenerate`'s payload:

```typescript
// Inside the cast[] array builder, alongside actingCapabilities:
let voiceConfig = null
const boundVoiceId = wizardStore.boundVoices[c.id]
if (boundVoiceId) {
  const voiceProfile = speechStore.savedVoiceProfiles.find(p => p.id === boundVoiceId)
  if (voiceProfile?.ust) {
    voiceConfig = {
      provider: voiceProfile.baseProvider,
      ust: voiceProfile.ust,
    }
  }
}
// Then include voiceConfig in the cast[] item alongside actingCapabilities
```

**2. LLM schema** — Add `modelPromptSpeech` to the per-actor output schema in `systemMsg`:

```json
"actor_key": {
  ...
  "modelPromptSpeech": "natural language TTS formatting instructions derived from UST config"
}
```

**3. Critical rules** — Add a UST translation rule to the `CRITICAL RULES` block in `systemMsg`:

> "4. `modelPromptSpeech`: If a character has a `voiceConfig.ust` block, translate its settings into clear natural-language speech formatting instructions. For example: if `customStripChars` includes `*`, instruct the character not to use asterisk action markers. If `mode` is `mute` and `convertBracketsToTokenFormat` is true, instruct it to strip bracket content and not narrate stage directions aloud."

**4. `confirmCreateCard()`** — Read `synthesisProposal.actors[actorKey].modelPromptSpeech` and write it to `extensions.airi.acting.speechExpressionPrompt` in the card output instead of leaving it as `""`.

### 8.4 Fallback Behavior

If no voice profile is bound to a character (and therefore no UST config exists), `modelPromptSpeech` should default to a sensible universal instruction:
> "Speak naturally. Do not include asterisks, action markers, or formatting symbols in spoken output."

This ensures the field is never blank and always improves TTS output quality even without a custom voice profile.

### 8.5 Implementation Notes
- `speechStore.savedVoiceProfiles` is already imported in `guided.vue` via `useSpeechStore()`.
- `wizardStore.boundVoices` is a `Record<string, string>` mapping character ID → voice profile ID, already reactive.
- The `ust` field shape is defined in the speech store type definitions — import or inline the type when building the payload snippet.
- The `speechExpressionPrompt` write path in `confirmCreateCard()` should be updated alongside the `modelExpressionPrompt` concat.

## Relevant Skills

- [[airi-animadex-wizard]]
- [[airi-card-editor-wizard]]
