# Caption Widget & Overlay System

This document outlines the architecture, data structures, window management patterns, and the **Sentence Sync System** powering the subtitle/caption overlay in AIRI.

---

## 📂 Architecture & File Locations

*   **Caption Window Manager (Electron Main)**: [`apps/stage-tamagotchi/src/main/windows/caption/index.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/main/windows/caption/index.ts)
    *   Handles window creation, transparency settings, screen boundaries, and docking coordination.
*   **Caption Overlay Renderer (Vue UI Page)**: [`apps/stage-tamagotchi/src/renderer/pages/caption.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/caption.vue)
    *   The entry point for the caption Electron window. Integrates mouse click-through behavior and drag-controls.
*   **Modular Caption Panel**: [`packages/stage-ui/src/components/scenes/CaptionPanel.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/CaptionPanel.vue)
    *   The core presentation component. Decides scale, opacity, background coloring (dark vs. light theme), active-word highlights, and transition animations.
*   **Caption Settings Store (Pinia)**: [`packages/stage-ui/src/stores/settings/captions.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/settings/captions.ts)
    *   Persists layout options, font sizing, docking preferences, and follow behavior.
*   **Hardware/Coordination Host**: [`packages/stage-ui/src/components/scenes/ControlStripHost.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenes/ControlStripHost.vue)
    *   Synchronizes speech output/TTS playback events with captions.
*   **IPC Eventa Contracts**: [`apps/stage-tamagotchi/src/shared/eventa.ts`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/shared/eventa.ts)
    *   Declares the typed channels used for cross-process coordinate updates and attachment states.

---

## ⚙️ Settings, Docking & Behavior Overhaul (v4+)

To eliminate ambiguity and give users precise layout controls, the caption positioning and styling properties are structured as follows:

### 1. The Follow Stage Split
The legacy, ambiguous `captionFollowStage` property is replaced by two explicit variables:
*   **`captionFollowStageVisibility`** (boolean): When true, the caption window synchronizes its visibility state with the main Actor Stage window. Hiding the actor stage hides captions; showing it restores them.
*   **`captionFollowStagePosition`** (boolean): When true, the caption window anchors its position to the Actor Stage window's coordinates (using the defined docking offset or relative positioning rules).

### 2. Docking Side States (`CaptionDocking`)
Docking coordinates are managed via the `captionDocking` setting, supporting four states:
*   `none`: The caption window is completely free-floating. Users can drag it to arbitrary coordinates on their monitors, and it will remain in place.
*   `top`: The caption window docks hard against the **top edge** of the Actor Stage window.
*   `bottom`: The caption window docks hard against the **bottom edge** of the Actor Stage window.
*   `character-head` (Experimental): The caption window centers/anchors itself directly above the active character model's head bones.

### 3. Immediate Save on Sizing & Coordinates
Unlike legacy configurations where repositioning coordinates were only selectively saved, **any user-driven resize or drag event** on the caption window immediately invokes bound persistence in the local configuration. If `captionFollowStagePosition` is active, it automatically recalculates and persists the updated relative offset `(dx, dy)`.

### 4. Background Theme & Contrast Modes
*   **`captionThemeMode`** (`'light' | 'dark' | 'system'`):
    *   `dark`: Renders captions inside a semi-translucent dark capsule (`rgba(0, 0, 0, opacity)`).
    *   `light`: Renders captions inside a semi-translucent light capsule (`rgba(255, 255, 255, opacity)`) with high-contrast text styling.
    *   `system`: Dynamically inherits the global color mode.
*   **Overlay Opacity**: Translucency is managed in percentage increments representing the backing alpha (`0%` transparent, `20%` light, `50%` medium, `80%` opaque).

---

## 🔄 The Sentence Sync System

AIRI uses a **Sentence Sync System** to animate subtitles in lock-step with real-time text-to-speech (TTS) speech pipelines.

### Data Channel: `airi-caption-overlay`
All caption rendering data is broadcast cross-window via a VueUse `useBroadcastChannel` named `airi-caption-overlay`.

```typescript
type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string } // Updates active speaker name (e.g. "User")
    | { type: 'caption-assistant', segments: CaptionSegment[] } // Streams the spoken sentences
```

### Caption Segment Schema
The system requires feeding the caption renderer **all segments** of the current speech block, updating only the segment corresponding to the currently playing audio chunk as active:

```typescript
interface CaptionSegment {
  text: string // The text of this specific sentence/chunk
  color: string // Color code for display (e.g., character identity color)
  actorId: string // Identifier of the speaking actor (e.g., "user" or card ID)
  isActive?: boolean// MUST be true only for the segment currently playing
}
```

### The Sentence Sync Protocol
When an audio playback session begins:
1.  **Sentence Splitting**: The full spoken block is split into discrete sentences (typically using a regex punctuation split).
2.  **Audio Buffer Pre-fetch**: Audio is generated for each sentence chunk and preloaded.
3.  **Active Segment Progression**:
    *   When sentence chunk `i` starts playing, a segment payload is pushed:
        *   All prior segments (`0` to `i-1`) are appended with `isActive: false`.
        *   The active segment `i` is appended with `isActive: true`.
        *   The complete `segments` array is broadcasted.
    *   The renderer applies scale transforms, glow filters, and text-brightness highlights to the segment marked `isActive: true`.
    *   When sentence chunk `i` completes playback, its `isActive` flag is updated to `false` and the updated array is broadcasted.
4.  **Turn Boundaries**: On user-message ingestion, or when a new speech turn is started, the host sends a hardware-level turn reset broadcast: `{ type: 'caption-assistant', segments: [] }` to clear the accumulator and prevent stale caption residue.

### ⚠️ Integration Rules for Clients
Any custom speech-playing interface (e.g., Whisper Dock suggestion previews, Producer custom choices, etc.) **must** align with this paradigm:
*   **Do NOT** just post single text chunks individually without context; always accumulate the sentences of the preview block, setting `isActive: true` only on the chunk currently outputting audio.
*   **Always** invoke a full reset on completion (`clearCaption()`) to vacate the rendering overlay.
