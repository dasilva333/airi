# Proposal: Chatbox Slash Commands

## Background & Rationale

Currently, advanced features such as image generation ("Imagine"), response suggestion generation, external website link scrapers, and Model Context Protocol (MCP) tools are accessed via various "secrets" or disparate UI buttons.

While searching for shortcuts or typing implicit commands works for some, international users (e.g., Japanese keyboard users where spelling triggers IME conversion like `gu` → `ぐ`) find typing exact secret hotwords difficult.

To address this, we propose adding **Slash Commands** directly within the main Chatbox composer interface. Typing a leading slash (`/`) as the first character in the input box will trigger a premium, upward-bound autocomplete popup menu of available commands, allowing keyboard-centric access to high-utility actions.

---

## Scope & Constraints

- **Primary Interface**: This mechanic will reside strictly within the main Chatbox's composer in [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue) (serving `#/chat`).
- **Exclusion**: The [WhisperDock.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue) input overlay will **not** receive this mechanic. It is designed to remain a lean, light, distraction-free voice/text stage interface free of heavy widgets and developer-oriented commands.

---

## Proposed Command Suite

We propose starting with the following baseline commands:

| Command | Syntax | Action |
| :--- | :--- | :--- |
| `/imagine` | `/imagine {prompt}` | Bypasses standard chat and triggers the Artistry Image Generation pipeline directly with `{prompt}`. |
| `/suggest` | `/suggest [guidance]` | Skips the popup menu and instantly requests LLM response suggestions (optionally guided by `[guidance]`). |
| `/website` | `/website {url}` | Scrapes the specified URL's metadata/content and appends it to the chat context. |
| `/mcp` | `/mcp {server} {tool} [args]` | Invokes a Model Context Protocol tool directly from the chat box interface. |

---

## UI/UX Design Specification

1. **Trigger Condition**:
   - The dropdown list triggers if and only if the composer text input begins with a `/` character (e.g. `inputText.value.startsWith('/')`).

2. **Autocomplete List Placement**:
   - Renders as a floating card aligned above the composer input box (`upward-bound`), with absolute positioning or a Reka-ui Popover wrapper.
   - Designed with glassmorphism styling (`backdrop-blur-md bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/50 dark:border-neutral-800/50 shadow-2xl rounded-2xl`).

3. **Keyboard Navigation**:
   - `ArrowUp` / `ArrowDown`: Moves active selection focus up and down the list.
   - `Enter` / `Tab`: Auto-completes the selected command keyword (e.g., inserts `/imagine ` into the input field and focuses the cursor).
   - `Escape`: Closes the autocomplete list.

---

## Reference Implementation Paths

- **UI Host Component**: [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue)
- **Chat Orchestration**: [session-store.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts) or [chat.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat.ts) to route slash-prefixed commands correctly if the user hits Send directly.

## Relevant Skills

- [[airi-desktop-chatbox]]
