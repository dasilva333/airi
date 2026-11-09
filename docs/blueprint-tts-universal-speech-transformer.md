# Systems Design: AIRI Universal Speech Transformer

## 1. Overview

The **Universal Speech Transformer** is a lightweight middleware layer in AIRI designed to clean and normalize text before it is sent to a Text-to-Speech (TTS) provider. Its primary goal is to ensure that "roleplay" elements and visual-only symbols (like asterisks, emojis, and kaomojis) do not interfere with the vocal performance, especially when using standard cloud TTS providers (OpenAI, AWS, Azure) that lack native character-aware processing.

## 2. Core Constraints

- **Universality**: Only implements transformations that are widely applicable across all TTS engines.
- **No System-Specific Syntax**: Avoids mapping text to specific vendor-locked tags (e.g., no dramatic ellipsis mapping to `<break/>` as it's not supported by all providers).
- **Separation of Concerns**:
    - **ACT Tokens**: Handled downstream; strictly excluded from this transformer.
    - **Thought/Think Tags**: Handled downstream; strictly excluded from this transformer.
    - **Display vs. Spoken**: This transformer *only* modifies the string sent to the TTS engine; the text displayed in the chat box remains original.

## 3. UI Placement

To ensure discoverability and ease of use, the transformer configuration will NOT be a standalone page. Instead, it will be implemented as a **checkbox-list panel** in the **left column of the existing Speech Module**.

## 4. Rule Definitions (Checkbox Items)

The following rules can be independently toggled by the user:

### A. Narrative Handling
- **Mute Asterisk Content**: Completely removes text wrapped in single or double asterisks (e.g., `*smiles*` -> ` `). Best for users who want a "voice-only" experience.
- **Flatten Asterisks**: Removes only the `*` and `**` symbols but vocalizes the interior text. Best for users who want narratives to be spoken as plain text.
- **Handle Groups/Brackets**: Applies the same logic (Mute or Flatten) to `(parentheses)` and `[brackets]`.

### B. Visual Symbols
- **Strip Emojis**: Removes standard Unicode pictographs (😀, 🐱, etc.) while preserving alphanumeric characters.
- **Strip Kaomojis**: Automatically detects and removes Japanese-style emoticons (e.g., `(≧▽≦)`, `(¬_¬)`). Uses the established "Healer" logic to identify patterns.
- **Tilde Replacement**:
    - **Toggle**: Enable/Disable.
    - **Input Field**: Allows users to specify a string to replace `~` with (e.g., `~` -> ` nyan`). If empty, `~` is simply removed.

### C. Sanitization & Optimization
- **Alphanumeric Guard**: Prevents sending a request to the TTS provider if the final string contains no letters or numbers (e.g., strings like `...` or `!!!`). This prevents auditory artifacts and reduces unnecessary API costs.
- **URL Purge**: Automatically removes or replaces web links (`https://...`) so the TTS doesn't attempt to spell out the URL.
- **Markdown Cleaner**: Basic stripping of markdown-specific structures (like table separators or code block markers) that might be vocalized by mistake.

## 5. Technical Implementation Details

### A. State Management
- **File**: [packages/stage-ui/src/stores/modules/speech.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/modules/speech.ts)
- **Settings**: New reactive state variables prefixed with `transformer*` will be added using `useLocalStorageManualReset`.

### B. Transformation Logic
- **File**: `packages/stage-shared/src/text.ts` (or a specific helper in `stage-ui`).
- **Function**: `transformTextForSpeech(input: string, options: TransformerOptions): string`
- **Logic**:
    1. **URL Purge**: Regex-based removal/replacement.
    2. **Markdown Cleanup**: Strip code blocks, bold, italics, table markers.
    3. **Narrative (Asterisks/Brackets)**:
        - If `Mute`: `input.replace(/\*.*?\*/g, '')`
        - If `Flatten`: `input.replace(/\*/g, '')`
    4. **Emoticon/Emoji Cleanup**:
        - **Kaomojis**: Strip sequences using "Healer" pattern matchers.
        - **Emojis**: Strip standard pictographs.
    5. **Tilde Replacement**: `input.replace(/~/g, replacement)`.
    6. **Alphanumeric Guard**: Check `/[a-z0-9]/i.test(finalText)`.

### C. Execution Hook (The "Mythical Hook")
- **File**: [packages/stage-ui/src/stores/modules/speech.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/modules/speech.ts)
- **Method**: `async function speech(...)`
- **Integration**: The very first line of the `speech` action will now be:
  ```typescript
  const transformedInput = transformTextForSpeech(input, transformerSettings)
  if (transformerSettings.alphanumericGuard && !hasAlphaChars(transformedInput))
    return
  // ... proceed to generateSpeech with transformedInput
  ```

### D. UI Implementation
- **File**: [packages/stage-pages/src/pages/settings/modules/speech.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-pages/src/pages/settings/modules/speech.vue)
- **Location**: Append a new section to the **Left Column** (`md:w-[40%]`) titled "Universal Transformers".
- **Interaction**: Uses `FieldCheckbox` for toggles and `FieldInput` for the Tilde replacement string.

## 6. Planned Extension: Mathematical, Chemical & Currency Spoken Normalization (PR #3054, #3058)

> **Originating Upstream PRs**:
> - [PR #3054](https://github.com/moeru-ai/airi/pull/3054): `feat(core-agent,stage-ui): now speech formula, math, chem correctly` (Author: `@nekomeowww`)
> - [PR #3058](https://github.com/moeru-ai/airi/pull/3058): `chore(evals,core-agent): clean up the formula speech eval` (Author: `@nekomeowww`)

### A. Architectural Overview & Modular Packages
Standard TTS engines frequently stumble, spell out raw LaTeX markup character-by-character (e.g. `\frac{a}{b}` -> *"backslash frac open-brace a close-brace..."*), or pronounce chemical formulas like random acronyms. Upstream solved this by introducing three self-contained packages that convert TeX and chemical notation into natural spoken words across English, Japanese, Korean, and Chinese prior to synthesis.

In `dasilva333/airi`, these capabilities will be imported as modular UST transformers rather than baked into core agent runtimes:
- `@proj-airi/mathjson`: MathJSON AST definition and speech heads.
- `@proj-airi/speech-transformer-math`: TeX formula parser, lowerer, and spoken language renderer (`en`, `ja`, `ko`, `zh`).
- `@proj-airi/speech-transformer-chem`: `mhchem` chemical formula verbalizer.

### B. Optional Features & Default Policy
These transformations must **never be forced globally or unconditionally**. They will be exposed in the Speech Settings panel alongside existing UST checkboxes with explicit default policies:

| Feature / Transformer | Description | Proposed Default | Rationale |
| :--- | :--- | :--- | :--- |
| **Currency & Price Normalization** | Verbalizes currency symbols and decimal amounts (e.g. `$25.50` -> *"twenty-five dollars and fifty cents"*, `¥1200` -> *"one thousand two hundred yen"*). | **ON (Opt-Out)** | Universal expectation for natural conversational speech; minimal false positive risk. |
| **Mathematical Equation Speech** | Parses inline and block TeX math (`$...$`, `$$...$$`, `\begin{equation}`) into spoken language via MathJSON. | **OFF (Opt-In)** | Complex math substantially expands spoken utterance length; users in technical or programming contexts may prefer reading raw notation or skipping math speech. |
| **Chemical Notation Speech** | Verbalizes chemical formulas and reactions (e.g. `\ce{H2O}` -> *"water"* or *"H two O"*). | **OFF (Opt-In)** | Specialized scientific domain; should only activate when intentionally desired by the user. |

### C. Implementation & Pipeline Integration Strategy
1. **Packages Import**: Bring `@proj-airi/mathjson`, `@proj-airi/speech-transformer-math`, and `@proj-airi/speech-transformer-chem` into `packages/`. Omit the 17,000+ line `evals/tts-speech-formula` evaluation dataset to keep repository footprint lean.
2. **UST State**: Add `transformerMathEnabled`, `transformerChemEnabled`, and `transformerCurrencyEnabled` to `packages/stage-ui/src/stores/modules/speech.ts` using `useLocalStorageManualReset`.
3. **Execution Hook**: Integrate into `transformTextForSpeech(input, options)` in `packages/stage-ui/src/stores/modules/speech.ts` after bracket/ACT stripping and before final TTS audio chunking.
4. **Boundary Guard**: Ensure `packages/pipelines-audio/src/processors/tts-chunker.ts` respects formula span boundaries to prevent splitting mathematical or chemical expressions mid-token across audio synthesis requests.

## 7. Next-Generation Audio Studio: 2-Column Split-Screen & Sticky Voice Playground

### A. Layout Paradigm: 2-Column Studio vs. Legacy 1-Column
The legacy 1-column layout placed the transformation preview and audio test button at the bottom of the page. This forced users to repeatedly scroll down to preview transformations and scroll back up to tweak settings, introducing heavy interaction friction.

The next-generation design establishes a **2-Column Split-Screen Studio**:
- **Left Column (`w-full lg:w-[58%]`)**: The structured configuration stream organized into three distinct cards.
- **Right Column (`w-full lg:w-[42%]`)**: The **Sticky Voice Playground** (`Follows scroll`), remaining pinned in view as the user scrolls, providing instantaneous visual transformation feedback and audio playback.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ <  Providers > Speech > [ Audio Studio ]                                                               │
│ Audio Studio                                    [ juewa · Deepgram / aura-2-amalthea-en v ] [+ New] [···]│
│ Shape how your companion sounds — and what gets spoken.                                                │
│                                                                                                        │
│ [ Profile ]   [ Audio Effects ]   [ Speech Cleanup (active) ]                                          │
├──────────────────────────────────────────────────────┬─────────────────────────────────────────────────┤
│ CONFIGURATION STREAM (Left Column)                   │ STICKY VOICE PLAYGROUND (Right Column)          │
│                                                      │                                                 │
│ ┌─ Card 1: Universal Speech Transformer ──────────┐  │ ┌─ Voice Playground ────────── [📌 Follows scroll]┐│
│ │ Clean and transform text before voice provider. (o)│  │ │ Test this profile as you tune.               ││
│ │                                                 │  │ │ [ juewa · Deepgram · amalthea · English ]     ││
│ │ Brackets & stage directions:                    │  │ │                                               ││
│ │  Asterisks *...*      [Mute] [Flatten] [Pass thru]│  │ │ Test text:                                   ││
│ │  Square brackets [...] [Mute] [Flatten] [Pass thru]│  │ │  ┌───────────────────────────────────────┐   ││
│ │                                    [To token]   │  │ │  │ *smiles* Your total is $19.99 😊        │   ││
│ │  Parentheses (...)    [Mute] [Flatten] [Pass thru]│  │ │  │ Let's try a softer voice.              │   ││
│ │  Angle brackets <...> [Mute] [Flatten] [Pass thru]│  │ │  └───────────────────────────────────────┘   ││
│ │  + Custom bracket     Mute: skip · Flatten: keep │  │ │  [ Everyday dialogue v ]  [✨ Transform text]││
│ └─────────────────────────────────────────────────┘  │ │                                               ││
│                                                      │ │ Text sent to TTS:                             ││
│ ┌─ Card 2: Notation & technical speech ───────────┐  │ │  ┌───────────────────────────────────────┐   ││
│ │ Choose how technical content is spoken.         │  │ │  │ smiles Your total is nineteen dollars  │   ││
│ │  Math formulas        [Verbalize] [Mute] [Pass th]│  │ │  │ and ninety-nine cents. Let's try a     │   ││
│ │  Chemical notation    [Verbalize] [Mute] [Pass th]│  │ │  │ softer voice.                          │   ││
│ │  Code blocks                      [Mute] [Pass th]│  │ │  └───────────────────────────────────────┘   ││
│ │  [x] Read currency naturally ($19.99 → words)   │  │ │  Text preview · no speech request             ││
│ │  Formula language: [ Auto · Voice profile     v ]│  │ │                                               ││
│ └─────────────────────────────────────────────────┘  │ │ Listen with current settings:                 ││
│                                                      │ │  🔊 |||||||||||||||||||||||||||||||| 0:00/0:06││
│ ┌─ Card 3: Symbols & replacements ────────────────┐  │ │  [ ▶ Generate & play ]                 [⏹]   ││
│ │  [x] Strip emojis    [x] Strip symbols & kaomoji│  │ │  Uses your TTS provider. Includes audio FX.││
│ │  Tilde replacement: [ nyan ] Leave empty to purge│  │ │  ✓ Up to date    Test text stays on tab switch││
│ │  > Custom replacement rules (2)       [+ Add rule]│  │ └───────────────────────────────────────────────┘│
│ └─────────────────────────────────────────────────┘  │                                                 │
│ ✓ Changes saved                                      │                                                 │
└──────────────────────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### B. Form Refinements & Terminology Synthesis
Synthesizing both designs delivers critical ergonomic and cognitive upgrades:
1. **"Pass through" Terminology**: Replaces ambiguous "Ignore" with "Pass through". "Ignore" left users wondering whether text is muted or spoken; "Pass through" explicitly denotes that markers and text are passed unaltered to the voice provider.
2. **"To token" Terminology**: Streamlines "Convert To Token" to "To token", cleanly accommodating square brackets (`[...]`) for ACT emotion token routing.
3. **Inline Syntax Legend**: Embeds `Mute: skip contents · Flatten: keep text, remove markers · Pass through: unchanged` below the bracket table, removing guesswork without requiring modal help dialogs.
4. **Three-Tier Card Hierarchy**:
   - **Card 1: Brackets & stage directions**: Roleplay formatting, actions, emotion cues, whispered aside markers, and extensible custom brackets.
   - **Card 2: Notation & technical speech**: MathJSON TeX equation verbalization, `mhchem` chemical formulas, code block suppression, currency expansion, and formula locale selection.
   - **Card 3: Symbols & replacements**: Pictograph stripping, kaomoji cleaning, tilde reading, and user-defined regex/plain text substitution rules.
5. **Autosave State Feedback**: Displays `✓ Changes saved` in the lower-left corner upon reactive update, eliminating manual save buttons while confirming persistence.

### C. Sticky Voice Playground Architecture
The Voice Playground serves as an all-in-one testing harness:
- **Sticky Viewport Pinning**: Uses UnoCSS `sticky top-6` so the testing harness remains visible regardless of vertical scroll depth on the left.
- **Preset Test Dialogues**: Includes quick-pick sample prompts (`Everyday dialogue`, `Technical / Math`, `Roleplay emotes`, `Code & markdown`) allowing instant verification of active transformation rules.
- **Dual Verification Modes**:
  1. **Instant Offline Preview (`✨ Transform text`)**: Runs `transformTextForSpeech` client-side in sub-millisecond time, immediately populating the `Text sent to TTS` preview box without spending provider API credits or audio compute.
  2. **End-to-End Audio Synthesis (`▶ Generate & play`)**: Renders full audio using the active voice profile and passes the stream through Web Audio DSP effects (pitch, rate, ASMR filter, radio filter, cathedral reverb).
- **Tab State Persistence**: Test inputs remain cached in memory when switching between `Profile`, `Audio Effects`, and `Speech Cleanup` tabs.

### D. Header & Voice Profile Navigation
- **Searchable Profile Popover**: The header voice profile selector opens a search-filtered dropdown (`Filter profiles...`) showing configured voices (`juewa`, `sofi`, `asuka`) with active checks, `+ New profile` creation, and secondary options (`···` duplicate/delete).
- **Semantic Tab Labeling**: Organizes Audio Studio into `Profile` (provider/model/voice binding), `Audio Effects` (DSP Web Audio filters), and `Speech Cleanup` (Universal Speech Transformer).

## Relevant Skills

- [[airi-speech-pipeline]]
