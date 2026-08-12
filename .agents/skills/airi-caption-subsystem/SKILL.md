---
name: airi-caption-subsystem
description: Use when working with the AIRI Caption and Subtitle Subsystem: floating caption Electron window (apps/stage-tamagotchi/src/main/windows/caption/index.ts), standalone renderer page (apps/stage-tamagotchi/src/renderer/pages/caption.vue), CaptionPanel component (packages/stage-ui/src/components/scenes/CaptionPanel.vue), RendererStage inline subtitle overlay, Head-Tethered Caption Plank (docs/head-tethered-captions-design.md), BroadcastChannel ('airi-caption-overlay') streaming protocol, follow-stage visibility/positioning ownership, or caption settings in settingsStore.
---

# AIRI Caption & Subtitle Subsystem

The Caption subsystem provides real-time streaming speech-to-text (STT) transcriptions and text-to-speech (TTS) / LLM assistant responses as floating transparent captions across desktop and stage surfaces.

---

## 1. Architecture & Dual-Surface Render Targets

```
                          ┌───────────────────────────┐
                          │   Speech STT / LLM TTS    │
                          │   (Streaming Token Flow)  │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                         [ BroadcastChannel: 'airi-caption-overlay' ]
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
  [ Surface A: Windowed Caption ]              [ Surface B: In-Scene Head-Tethered ]
  (Dedicated Electron BrowserWindow)            (WebGL / Canvas in-scene plank)
  • Mode: captionDocking: 'top'|'bottom'|'none' • Mode: captionDocking: 'character-head'
  • Main window: main/windows/caption/          • Live2D/Spine: PIXI Container child
  • Page: renderer/pages/caption.vue            • VRM/MMD: THREE.CSS3D / Canvas Sprite
  • Render: CaptionPanel.vue                    • Render: HeadTetheredCaption.vue
```

---

## 2. Exhaustive File Index

### Main Process & Electron IPC
- **`apps/stage-tamagotchi/src/main/windows/caption/index.ts`**: Creates and manages the floating frameless Electron caption window (`caption/`). Handles `captionFollowStagePosition` (docking position alignment: `top` / `bottom` / `none` relative to stage window bounds) and `captionFollowStageVisibility` (lockstep show/hide).
- **`apps/stage-tamagotchi/src/main/index.ts`**: Main process composition root. Subscribes to Stage window visibility changes and syncs Caption window state via `caption-window-state` IPC event.

### Renderer Pages & UI Components
- **`apps/stage-tamagotchi/src/renderer/pages/caption.vue`**: Standalone renderer page for the Electron window overlay. Reads `'airi-caption-overlay'` BroadcastChannel events, manages font scaling, scroll locks, and single/multi line typography.
- **`packages/stage-ui/src/components/scenes/CaptionPanel.vue`**: Core Vue component rendering caption text segments, speaker badges, and font sizing.
- **`packages/stage-ui/src/components/scenes/HeadTetheredCaption.vue`**: In-scene head-tethered subtitle plank wrapper that projects 3D/2D pose angles to 2D transforms.
- **`packages/stage-ui/src/components/scenes/RendererStage.vue`**: Main stage wrapper containing inline caption overlays.
- **`apps/stage-tamagotchi/src/renderer/pages/index.vue`**: Control strip host. Controls `captionOpen` toggle and mirrors main process `caption-window-state` IPC events.

### Utils, Composables & Stores
- **`packages/stage-ui/src/utils/caption-perspective.ts`**: Pure math helper remapping model pose angles (`ParamAngleX/Y/Z`) to fake 2D perspective scale, skew, and rotation matrix values for head-tethered planks.
- **`packages/stage-ui/src/stores/settings/settings.ts`**: Pinia store holding caption options (`captionFollowStageVisibility`, `captionFollowStagePosition`, `captionDocking`, `captionLayoutMode`, `captionFontSize`).
- **`packages/stage-ui/src/constants/control-customizer.ts`**: Defines the `captions-layout` group inside `CUSTOMIZER_CATALOG`.

### Authoritative Design & Architecture Documents
- **`docs/live2d-caption-design.md`**: Live2D motion captioning pipeline (`model3.json` `FileReferences.Motions` inline `Text` and `Language` fields → `Model.vue` `motionManager.definitions` → `'airi-caption-overlay'` BroadcastChannel).
- **`docs/head-tethered-captions-design.md`**: Canonical design document for in-scene head-tethered captions vs dedicated windowed captions.
- **`docs/catalog-control-strip.md`**: Documentation for control strip caption toggles, docking cyclers, and follow-stage switches.
- [docs/captions-widget-system.md](docs/captions-widget-system.md) — Captions widget system.

---
## 3. BroadcastChannel Protocol (`'airi-caption-overlay'`)

The caption subsystem is intentionally decoupled from chat state through a BroadcastChannel (`'airi-caption-overlay'`). Any window or worker emitting speech tokens posts to this channel.

### Event Payload Schema:
```typescript
export type CaptionChannelEvent
  = | { type: 'caption-speaker', text: string } // User speech-to-text (STT) transcript delta
    | { type: 'caption-assistant', text: string } // Assistant LLM / TTS text delta
```

### Publisher Invocation (e.g. in `session-store.ts` or `index.vue`):
```typescript
import { useBroadcastChannel } from '@vueuse/core'

const { post: postCaption } = useBroadcastChannel<CaptionChannelEvent, CaptionChannelEvent>({
  name: 'airi-caption-overlay',
})

// Stream user spoken audio transcript delta:
postCaption({ type: 'caption-speaker', text: delta })

// Stream assistant response token delta:
postCaption({ type: 'caption-assistant', text: delta })
```

### Subscriber Processing (Dumb Renderer Pattern):
`caption.vue` and `CaptionPanel.vue` consume events passively without querying chat history or storage:
- Maintains a rolling queue of active text segments.
- Automatically clears completed segments after configured timeout or user interaction.

---

## 4. Main Process Follow-Stage & Positioning Ownership

> **CRITICAL RULE**: The Electron main process (`apps/stage-tamagotchi/src/main/windows/caption/index.ts`) is the **SINGLE OWNER** of windowed stage-to-caption follow logic.

1. **`captionFollowStageVisibility`**:
   - Main process watches `stageWindow` visibility. When `stageWindow` hides, main process automatically hides `captionWindow` and emits `caption-window-state` (`isOpen: boolean`) to renderer.
   - Renderer (`index.vue`) updates `controlStripStore.captionOpen` to match without dispatching duplicate IPC calls.
2. **`captionFollowStagePosition` & `captionDocking`**:
   - Computes relative screen coordinates (`'top'` or `'bottom'`) using Electron screen display bounds when `stageWindow` is dragged.

---

## 5. Head-Tethered Captions (`captionDocking: 'character-head'`)

When `captionDocking === 'character-head'`, AIRI switches from moving the Electron native window to rendering an **in-scene canvas/WebGL plank**:

- **Live2D / Spine**: Added as a `PIXI.Container` child inside the active Live2D/Spine stage.
- **VRM / MMD**: Rendered as a `THREE.CSS3DSprite` or canvas texture sprite anchored to the `head` bone.
- **2D Perspective Fake Math**: `packages/stage-ui/src/utils/caption-perspective.ts` converts head yaw/pitch/roll into 2D skew (`skewX = x * 0.12 * strength`), squash (`scaleX = 1 - flatten`), and tilt.

---

## 6. Development & Verification Rules

1. **Do NOT double-toggle caption in renderer**:
   When `captionFollowStageVisibility` is `true`, renderer must **never** invoke explicit toggle IPC calls on stage visibility changes — main process owns the lockstep toggle.
2. **WebPreferences Alignment**:
   `caption/` window is frameless, transparent (`transparent: true`, `backgroundColor: '#00000000'`), and non-resizable by default. Ensure CSS maintains `bg-black/40 backdrop-blur-md` for contrast legibility.
3. **Verification**:
   Run `pnpm -F @proj-airi/stage-ui typecheck` after modifying caption components or store definitions.
