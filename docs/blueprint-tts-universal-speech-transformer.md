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

## Relevant Skills

- [[airi-audio-pipeline]]
