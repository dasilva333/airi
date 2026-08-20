# Chat Experience UX Improvement Ideas (Finalized)

## Phase 1: Immediate UX Wins
These tasks have high visible impact with minimal architectural plumbing.
- **[ACT]-based Bubble Styling**: Tinting/glow based on character performance tokens.
- [x] Create Unified Journal Chips (balanced 3+2) in `InteractiveArea.vue` ws for Text & Image journal entries.
- **Essential Deep Links**: Shortcuts to Character Settings and the Image Journal.

---

## 2. Chat Settings & Compaction
- **Location**: Integrate into the existing Chat Settings menu.
- **Transparency**:
    - **Warning**: Provide a visual warning as the compaction threshold (context limit) is approached.
    - **Notification**: Inject a system message into the chat history once a compaction/summarization event occurs.

## 2. Advanced Session Management (Rebuilds)
- **Feature**: Provide a "Rebuild last 3 days + today" option.
- **Unified Interleaved Journal Preview**:
    - Show 4-5 "square blocks" (balanced split: e.g., 3 Images + 2 Text entries) to prevent one type from burying the other.
    - **Visuals**: Truncated text previews or image thumbnails.
    - **Hover Interaction**: High-fidelity overlay showing full text or enlarged image.

## 3. Deep Linking & Integration
- **Character Settings**: Quick-access shortcut from the chat toolbar.
- **Image Journal**: Deep link directly to the Image Journal.
- [x] **Coalesced Journal Preview Stream**: Unified manual (long-term) and auto-generated (short-term) entries sorted by latest.
- **Text chips**: Show **date** (`YYYY-MM-DD`) and **persona-driven title** (e.g., `"My thoughts after {X} messages together~"`) for the latest 2 entries.
- **Image chips**: Show thumbnail + title overlay for the latest 3 image journal entries.
- **Display Icon**: Distinguish auto-journals with a `magic-stick` icon vs the `notebook` icon for manual entries.

## 4. Future Journal QoL & Customization
- **Toggle Control**: Add a setting/button to show or hide the entire Journal Preview row in the chat.
- **Custom Ratios**: Allow users to configure the display ratio (e.g., 2 Text + 3 Images, or 5 Text only).
- **Title Templates**:
    - Select from premade persona-driven "title presets" for auto-journals.
    - **Randomization**: Optionally randomize the template used per entry to make the character feel more "alive."
- **Layout Flexibility**: Potentially a small grid or drag-and-drop system for arranging components in the "Interactive Area" above the input.
- **Location**: **Generation** tab (per character).
- **Behavior**: A configurable token limit (Context Width). Blank default passes `undefined`/`null` to the API.

## 5. Pinned Important Context
- **Concept**: User can "Pin" specific messages or facts from the history.
- **Behavior**: Pinned items are always displayed at the top of the chat area and are **always** injected into the LLM context, bypassing standard pruning.

## 6. Context Meter (Visual Feedback)
- **Concept**: A stylized loading bar (occupying ~3 icons worth of width) positioned in the chat toolbar or header.
- **Behavior**:
    - **Initial State**: Filled to the length of the base System Prompt.
    - **Active State**: Fills up in real-time as the chat progresses (User Messages + AI Responses).
    - **Threshold Notification**: Color changes (e.g., Green -> Yellow -> Red) as it hits 80% and 90% of the defined Context Width.
- **The "Best Estimate" Strategy**:
    - **Tokenization Approximation**: Since tokenizers vary per model, the UI uses a character-to-token ratio (e.g., ~4 chars per token) as a "Good Enough" fallback for the meter's progress.
    - **Usage Sync**: If the provider API returns real `usage` data (common in OpenAI/Tavern/LM Studio), the meter snaps to the reported values post-response.
- **Provider-Aware Defaults**:
    - **Local (Ollama/LM Studio)**: Default to 4096/8192 tokens. These providers often **silently truncate** history from the top when the limit is hit, causing character "drift." The meter acts as a warning for this invisible pruning.
    - **Remote (Gemini/GPT)**: Default to their known max (128k+) or hide/dim the meter if it's effectively infinite for the current session. These providers usually **throw hard errors** (400) when exceeded.
- **Global Stance Proposal**: Define a "System Default" context width (e.g., 8192) to ensure the meter is functional by default.
- **Goal**: Give users a clear visual cue for when to perform a "Save & Reset" or "Rebuild" before silent pruning or API crashes occur.

## 7. ACT-based Bubble Styling
- **Concept**: Use existing `[ACT]` tokens to subtly style the chat bubble.
- **Logic**: Extract the first (or dominant) `[ACT]` token from the assistant's message.
- **Visuals**: Apply a faint background glow or border tint matching the act/mood (e.g., Warm amber for `[happy]`, Soft blue for `[sad]`).
- **Goal**: Bring the character's performance into the visual layout without extra inference or latency.

## 7. Summary of implementation Goals
- **Immersive Performance**: Styling the UI based on character acts.
- **User Agency**: Better control over pruning (compaction) and pinning important info.
- **Streamlined Workflow**: Deep links to relevant settings for quick adjustments.

## Relevant Skills

- [[airi-desktop-chatbox]]
