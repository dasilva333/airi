# Journal: The reasoning_content / Fallback Speech Bug

## Issue Description

When a reasoning-only LLM (like DeepSeek-R1, or Gemini when thinking is enabled) streams its response entirely within `reasoning-delta` (and sends no `text-delta` tokens), the chat orchestrator correctly falls back to using the reasoning text as the main message content.

However, the underlying data structure gets into a half-fallback state:
* `content` is set to the fallback reasoning text.
* `categorization.speech` remains `""` (empty string).
* `rawContent` remains `""` (empty string).
* Downstream hooks and TTS receive empty strings instead of the fallback text, causing silent companions or failed visual triggers.

## History of Attempts

1. **Commit `1f58faafa` / `1afb915a4`**: Early attempts to handle reasoning models.
2. **Commit `c702c1f8e`**: Prevented nested reasoning from leaking into speech.
3. **Commit `9eb3ed5be`**: Attempted to set `fullText = fallbackText` and updated the UI components (`assistant-item.vue` and `response-part.vue`) to prevent duplicate rendering of the reasoning block when fallback is active.
4. **Commit `74670f690`**: Reverted `9eb3ed5be` entirely, re-introducing the data pipeline bug.

---

## Permanent Fix Plan

1. **Store Update (`chat.ts`)**:
   In the fallback check at the end of the inference loop, if fallback is active:
   * Set `buildingMessage.content = fallbackText`
   * Set `buildingMessage.categorization.speech = fallbackText`
   * Set `fullText = fallbackText`
   * Set `rawFullText = fallbackText` (to ensure `rawContent` is populated for history context)

2. **UI Updates (`response-part.vue` & `assistant-item.vue`)**:
   Avoid displaying duplicate reasoning blocks when speech and reasoning contain the exact same content:
   * In `response-part.vue`, hide the reasoning block if `reasoning === content` (since it's already shown as the main speech bubble).
   * In `assistant-item.vue`, hide the "reasoning only" placeholder if the message content actually has text.

---

## Resolution Details & Verification (June 3, 2026)

### Git History / Complete Record of Attempts:
* **First Attempt (Initial support)**: Commit `1f58faafa2150282f032c9c179a4f68cf1ec8f2c` / `1afb915a45cdb2e50f421c57891cb85ec84f8f2e`
* **Second Attempt (Deduplication / Nesting fix)**: Commit `c702c1f8e5e9b2ee258f9ea1faa9d8b89df62a46`
* **Third Attempt (Pipeline fix & UI update)**: Commit `9eb3ed5be7217811ab242bb2d5ffdf9390fb837b` (reverted by `74670f69009308cf228ab6dff155f60205236a02`)
* **Fourth Attempt (Final Working Fix)**: Commit `e78e0d09de4fb79885cb9c74727a768e0b6870e5`

### Summary of the Final Fix (Commit `e78e0d09d`):

1. **Store Update (`packages/stage-ui/src/stores/chat.ts`)**:
   Correctly populated `fullText`, `rawFullText`, and `buildingMessage.categorization.speech` inside the `chat-orchestrator` fallback handler if `speechText` is empty and reasoning is available. This guarantees that TTS hooks and downstream reactive visual/event subscribers receive the proper text payload instead of an empty string.

2. **UI Deduplication (`packages/stage-ui/src/components/scenarios/chat/response-part.vue`)**:
   Adjusted the computed `hasReasoning` boolean. If the message's reasoning is identical to its final text content (fallback scenario), the collapsible thought block is hidden entirely since it's already rendered as the main message text.

3. **Placeholder Handling (`packages/stage-ui/src/components/scenarios/chat/assistant-item.vue`)**:
   Added a `hasContentText` computed checker checking if there's any non-empty text content in the message. The `"Reasoning only..."` status indicator block is now wrapped in `v-if="message.categorization?.reasoning && !hasContentText"`, preventing it from showing once the fallback content is correctly populated and visible.

## Relevant Skills

- [[airi-prefix-cache-alignment]]
- [[airi-prompt-builder-engine]]
