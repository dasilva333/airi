# Proposal: Novel Stage-Chat Unification Concepts

This proposal outlines and evaluates three novel concepts designed to bridge the detached nature of the **Stage** (avatar window) and the **Chatbox** (text interaction window).

---

## The Core Problem

Currently, the **Stage** (running Live2D/VRM) and the **Chatbox** exist as detached Electron processes. While this provides great flexibility (allowing separate positioning, sizing, and multi-monitor setups), it introduces window-management fatigue. The user must manually position, resize, focus, and close both windows separately, separating the visual companion from the text history.

---

## Concept Scorecard & Overview

| Concept | Description | Viability | Hype / Addictive | Final Recommendation |
| :--- | :--- | :---: | :---: | :--- |
| **Idea 1** | **Inline Stage:** Top/bottom wide letterbox avatar embedded in chat history. | **7.0 / 10** | **8.0 / 10** | Cozy setup, but high WebGL/Canvas IPC routing overhead. |
| **Idea 2** | **Sidebar Stage:** Tall vertical avatar embedded directly in chat's right sidebar. | **8.0 / 10** | **8.5 / 10** | Consolidated Discord-like dashboard layout. |
| **Idea 3** | **Magic Wand Suggestions in Stage Whisper Dock:** Pill overlays on Stage that auto-play & apply text. | **9.5 / 10** | **10.0 / 10** | **[HIGHEST PRIORITY]** Fast feedback loop, highly game-like, low friction. |

---

## Deep Technical Analysis

### Concept 1: Inline Stage (Wide/Short Layout)
* **Mechanics:** Integrates a wide, short letterbox layout of the character face directly at the top or bottom of the chat history in `chat_messages.vue`.
* **Technical Considerations:**
  * **Process Bridging:** The avatar is rendered in `apps/stage-tamagotchi/src/renderer/pages/index.vue` (the main Stage page) using WebGL/Canvas loops. To render it inside `apps/stage-tamagotchi/src/renderer/pages/chat.vue` (the Chat page), we must either mount a duplicate Three.js/Live2D context inside the chat process (which increases GPU/memory usage) or pipe the frames via an offscreen canvas stream.
  * **Camera Coordinates:** Tight camera cropping to focus on the face in a wide landscape profile.
* **Component Path:** [chat.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/chat.vue) (view parent) / `chat_messages.vue` (history renderer).

---

### Concept 2: Sidebar Stage (Consolidated Dashboard)
* **Mechanics:** Toggles a vertical WebGL layout of the companion avatar directly inside the right sidebar of the Chat window (similar to a Discord voice call view or Twitch stream overlay).
* **Technical Considerations:**
  * **Camera Ratio:** Much easier than Concept 1, as standard portrait ratios (tall card) fit standard model ratios perfectly without extreme cropping.
  * **Process Restructuring:** Still requires bringing the rendering context (Three.js/Live2D loader and stores) inside the Chat window process or using a unified single-window layout.
* **Component Path:** [chat.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/chat.vue) (implementing the panel adjacent to `interactiveAreaRef`).

---

### Concept 3: Magic Wand Suggestions in Stage Whisper Dock
* **Mechanics:** Adding a Magic Wand button directly inside the Stage's Whisper Dock (inline text input). Clicking it displays suggestion titles as floating buttons (pills) on the Stage. The suggestions auto-play in sequence, highlighting each pill and feeding into the Caption Window, and clicking a pill applies it to the input.
* **Technical Considerations:**
  * **UI Overlay:** WhisperDock is implemented in [WhisperDock.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue). We can add the pill buttons and wand toggle directly as Vue overlays in this component.
  * **Direct Store Hookup:** We can import and watch `datingSimStore` (`packages/stage-ui/src/stores/dating-sim.ts` -> `choices`) to fetch the active choices without needing any cross-window IPC bridging for the data itself.
  * **Caption Pipeline:** Triggering the suggestions will leverage the same `'airi-caption-overlay'` broadcast system we just implemented, updating [caption.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/caption.vue) in real-time.
  * **TTS Autoplay:** Sequential playback uses the same `speechStore.speech` engine built for `ProducerChoiceBubble.vue`.
* **Component Paths:**
  * UI Input: [WhisperDock.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue)
  * Data/Choices Store: [dating-sim.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/dating-sim.ts)
  * Captions Overlay: [caption.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/caption.vue)

---

# Proposal: Stage Window Collapse Behaviors

This proposal evaluates how the Stage floating window can be temporarily collapsed or hidden to reduce desktop clutter without fully closing the companion. The top-right corner of the Stage currently hosts a drag handle and an eye-hide button — prime real estate for a third, collapse-style action.

---

## The Core Problem

The Stage window (rendering Live2D/VRM) occupies significant screen space. The existing eye-hide button completely hides the window, requiring a trip to the Control Island toolbar or system tray to restore it — a "one-way street" that breaks interaction flow. There is no middle ground between fully visible and fully hidden. The user wants to quickly "get it out of the way for a minute without committing to closing it."

---

## Component Path

- **Button group (drag handle + eye hide):** [actor.vue:630-656](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/actor.vue#L630-L656)
- **Stage visibility store:** `useSettingsControlStrip` (`packages/stage-ui/src/stores/settings/control-strip.ts`)
- **Window positioning store:** `usePositioningStore` (`packages/stage-ui/src/stores/settings/positioning.ts`)
- **Electron IPC (window resize/bounds):** `electronStartDraggingWindow` (shared eventa contract)

---

## Options Scorecard

| Option | Description | User Experience | Implementation Complexity | Recommendation |
| :--- | :--- | :---: | :---: | :--- |
| **Option 1** | **One-way Hide (Implemented):** Eye icon hides window entirely. Restore via Control Strip or tray. | Clean but breaks flow | Already done | Baseline |
| **Option 2** | **Collapse to Corner Pill:** Window shrinks to a tiny `~80×28px` pill containing the drag handle + toggle icon. Character renderer is hidden (`v-if`), window bounds snap to pill size. Restore instantly with a click. | Highly tactile, keeps widget accessible | Medium — requires IPC bounds save/restore + Electron window resize | **Recommended** |
| **Option 3** | **Toggle Mini-Mode:** Stage toggles between current size and a preset "mini" avatar size (e.g. `200×200`). | Reuses sizing presets, keeps character visible | Low — leverages existing store presets | Not ideal for focus |

---

## Detailed Evaluation

### Option 1: One-way Hide (Current Behavior)
- **Mechanics:** The eye icon button fires `handleHideStage()` → `toggleStageVisibility(false)` which hides the Electron window entirely. The user must open the Control Island or system tray menu to bring the character back.
- **Pros:** Cleanest state — the widget completely vanishes. No extra IPC or state management needed.
- **Cons:** Feels like a "commitment." The friction of having to navigate away to restore the window discourages temporary hiding. Users end up leaving the Stage open when they'd rather just tuck it away.

### Option 2: Collapse to Corner Pill (Recommended)
- **Mechanics:** A new collapse button in the top-right button group triggers a collapse toggle:
  1. **Collapse:** Save current window bounds to `usePositioningStore`. Resize the Electron window via IPC to a tiny pill size (`~80×28px`). Hide the Live2D/VRM renderer and all stage content (`v-if` off). Show only the drag handle + collapse-toggle button in the pill. Reposition to the nearest screen corner if desired.
  2. **Expand:** Click the toggle again. Restore the saved window bounds via IPC resize + reposition. Show the renderer content again (`v-if` on).
- **Pros:**
  - Highly interactive and tactile — feels like a premium desktop widget.
  - Keeps the widget accessible as a tiny, unobtrusive "handle" that can be dragged around.
  - Lets the user toggle the character back instantly without leaving the Stage window.
  - Uses a `v-if` on the renderer, so no GPU resources are wasted while collapsed.
- **Cons:**
  - Requires managing Electron window bounds state (save/restore cycle).
  - Needs a new IPC invoke or eventa contract for resizing the renderer window from the renderer process.
  - Must handle edge cases: collapsed state persisting across window move, multi-monitor setups, DPI changes.
- **Technical Approach:**
  1. Add a `collapsedBounds` ref in the positioning store (or the actor page) to snapshot pre-collapse bounds.
  2. Create an `electronStageResize` eventa contract (or reuse existing window-sizing IPC) to resize the Electron `BrowserWindow`.
  3. Wrap the stage renderer and all overlays in a Vue `v-if` gated on `!isCollapsed`.
  4. In the collapsed pill, render only the drag handle and the collapse-toggle button (changing from a collapse icon to an expand icon).
  5. On expand, restore the saved bounds and show content.

### Option 3: Toggle Mini-Mode
- **Mechanics:** Toggles between the current stage size and a preset mini avatar size (e.g. `200×200`). The character renderer stays active in both states.
- **Pros:** Low implementation complexity — reuses existing store sizing presets. Character stays visible.
- **Cons:** Doesn't actually "hide" the character when the user needs to focus. The renderer loop continues burning GPU/CPU even in mini mode. Less satisfying as a "get it out of my way" action.

---

## Recommendation

**Option 2 (Collapse to Corner Pill)** is the recommended path forward. It turns the Stage from a bulky overlord into a collapsible, premium-feeling desktop companion. The implementation surface is manageable — a new button in the existing drag-handle group, an IPC call for resizing, and bounds save/restore logic in the positioning store. This pairs well with Option 1 (the one-way hide) as a complementary mid-level visibility action: the user can either fully hide (Option 1) or collapse to a pill (Option 2).

## Relevant Skills

- [[airi-stage-ui-surfaces]]
