# Actor Stage UI Design & Interaction Specification

This document specifies the interaction lifecycle, visual design, and layout architecture for the **Actor Stage** UI revamp. The objective is to resolve visual clutter over central character artwork while retaining intuitive, ergonomic input access on desktop.

## Key Files

| Path | Role |
|---|---|
| `apps/stage-tamagotchi/src/renderer/pages/actor.vue` | Stage page: proximity tracking, light-dismiss, gear trigger, overlay integration, Escape hierarchy |
| `packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue` | Bottom input drawer: 4-state lifecycle, notch styling, responsive fit |
| `packages/stage-ui/src/components/scenarios/StageConfigOverlay.vue` | View config overlay: size presets, corner snap, hide |
| `packages/stage-ui/src/components/scenarios/index.ts` | Barrel export for `StageConfigOverlay` |
| `apps/stage-tamagotchi/src/main/index.ts:538` | Electron invoke handler — routes `electronApplySizePreset` to resize & position |
| `apps/stage-tamagotchi/src/main/windows/shared/display.ts:167` | `ensureWindowInVisibleBounds` — shared overflow protection (used by all resize paths) |
| `apps/stage-tamagotchi/src/shared/eventa.ts` | `electronApplySizePreset`, `electronStageToggleVisibility` |
| `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue:586` | Canonical `PRESETS` array (mini/medium/large/full) and size values |
| `packages/electron-vueuse/src/composables/use-electron-mouse-in-element.ts` | Mouse tracking used for notch proximity detection |

## Roadmap

- **Phase 1 (shipped):** WhisperDock 4-state hover lifecycle, light-dismiss, 220px responsive fit
- **Phase 2 (shipped):** Stage Config Overlay — gear-triggered frosted panel with size presets and corner snap

## 1. Design Goals

- **Clean Canvas Priority:** Zero visual noise over artwork when the user is passively viewing (State 1)
- **Desktop Hover Optimization:** Mouse hover and sub-pixel precision for discovery and proximity feedback (States 2–3)
- **Ergonomic Anchoring:** Bottom-center drawer mental model for text input pull-out (State 4)
- **Robust Layout Responsiveness:** Control icons stay aligned and unclipped down to the 220px minimum stage width

## 2. Phase 1: WhisperDock 4-State Lifecycle

The bottom input drawer (`WhisperDock`) uses a 4-state hover lifecycle triggered by cursor position:

| State | Trigger | Visibility | Cursor | Active controls |
|---|---|---|---|---|
| **1: Passive** | Cursor outside window | 0% opacity — 100% clean canvas | Default OS | None |
| **2: Discovery** | Cursor anywhere in window | Collapsed notch (subtle half-circle overflowing bottom edge at `-bottom-1.5`) + top toolbar fade in | Default arrow | Toolbar buttons, notch hit area |
| **3: Proximity intent** | Cursor within 10px of bottom edge | Notch raises to `bottom-0`, grows to `h-5`, brightens + shadow | Pointer (hand) | Notch activation target |
| **4: Expanded input** | Click on State 3 target | Full input drawer slides up from bottom edge, locked open | I-beam / pointer | Text input, magic wand, close 'X' |

### 2.1 Motion & Debouncing

- **Easing / duration:** `cubic-bezier(0.2, 0, 0, 1)` at 200ms for notch transitions
- **Proximity zone:** 10px from bottom edge — prevents accidental activations while maintaining high intent accuracy
- **Exit debounce:** 100–150ms delay on cursor-exit-window before fading overlays

### 2.2 State 4 Persistence & Dismissal

The expanded drawer stays **locked open** even if the cursor leaves the window. Dismissal:

1. **Canvas light-dismiss** — clicking anywhere on the character background outside the dock
2. **Escape** key
3. **Close 'X'** button in the input pill

### 2.3 Responsive Fit at 220px

Container padding tightened (`px-6` → `px-3`), item gap reduced (`gap-3` → `gap-2`). Action cluster (`flex-shrink: 0`) never squashes; text input (`flex: 1; min-width: 0`) truncates instead of pushing.

## 3. Phase 2: Top-Right Stage Controls & Stage Config Overlay

The top-right floating toolbar (`apps/stage-tamagotchi/src/renderer/pages/actor.vue:600-626`) provides essential frameless window controls with zero visual distraction. It auto-fades in on cursor discovery and fades out to 0% opacity when idle.

### 3.1 Top-Right Toolbar Structure (`actor.vue`)

The toolbar is a compact, frosted pill anchored at `top-2.5 right-2.5` (`z-50`) containing two `size-6` (24×24px) buttons:

| Button | Icon | Title / Action | Description |
|---|---|---|---|
| **Window Drag Handle** | `i-ph:arrows-out-cardinal` | `"Drag to Reposition Stage"` | Triggers native OS window dragging (`electronStartDraggingWindow`) across displays because the window is borderless/frameless. |
| **Stage Config Button** | `i-ph:gear` | `"Stage Size & Position"` | Toggles the floating `StageConfigOverlay.vue` panel open/closed. |

### 3.2 Stage Config Overlay (`packages/stage-ui/src/components/scenarios/StageConfigOverlay.vue`)

When triggered, a floating frosted-glass panel (`bg-neutral-50/30 dark:bg-neutral-900/30 backdrop-blur-xl border border-neutral-200/20 rounded-2xl p-3 shadow-xl`) opens at `right-3 top-10`:

```
┌──────────────────────────────────────────────┐
│  [ + / ⧉ ] Mode Toggle      [ 👁⃥ ] Hide Stage │ ◄── Row 1
├──────────────────────────────────────────────┤
│  [ Mini ] (220×315)      [ Med. ] (450×600)  │ ◄── Row 2 (Size Mode)
│  [ Large ] (800×1000)    [ Full ] (Workarea) │ ◄── Row 3 OR [ ↖ ↗ ↙ ↘ ] (Position Mode)
├──────────────────────────────────────────────┤
│  [ 🖼 / 🖼⃥ ] Background    [ 👤 / 👤⃥ ] Model   │ ◄── Row 4 (Layer Visibility)
└──────────────────────────────────────────────┘
```

#### 3.3 Overlay Row Layout & Actions

- **Row 1: Mode Switch & Hide**
  - Left: Mode Toggle (`i-ph:plus-square` ↔ `i-ph:copy`) — switches between Size Preset Mode and Corner Snap Position Mode.
  - Right: Hide Stage (`i-ph:eye-slash`) — invokes `electronStageToggleVisibility(false)` to minimize/hide stage.
- **Rows 2 & 3: 2×2 Grid (Size Mode vs. Position Mode)**
  - **Size Mode**: `mini` (220×315), `med.` (450×600), `large` (800×1000), `full` (display work area). Calls `electronApplySizePreset({ target: 'actor', preset })`.
  - **Position Mode**: Corner snap targets (`top-left` ↖, `top-right` ↗, `bottom-left` ↙, `bottom-right` ↘). Calls `electronApplySizePreset({ target: 'actor', alignment })`.
- **Row 4: Layer Visibility Toggles (Scene vs. Transparent Model)**
  - Left: `showBackground` (`i-ph:image` ↔ `i-ph:image-slash`) — toggles between 2D scene background artwork and 100% transparent desktop passthrough.
  - Right: `showModel` (`i-ph:user` ↔ `i-ph:user-slash`) — toggles 3D/2D avatar rendering layer visibility.

### 3.4 Pass-Through Click & Viewport Invariants

1. **Automatic Pass-Through Click**: On transparent background areas, mouse clicks pass directly through to underlying applications without requiring a manual toggle switch on stage.
2. **Clean Canvas**: Viewport debugging/camera modes (`Spin`, `Drag`, `Orbit`) are not rendered on the user-facing stage chrome. The stage surface is strictly dedicated to artwork, dialogue captions, and proximity-based controls.

### 3.2 Size Presets

Values reused from `ControlStrip.vue:586`:

| Label | Dimensions | Electron handler value |
|---|---|---|
| mini | 220 × 315 | `'mini'` |
| med. | 450 × 600 | `'medium'` (mapped in `actor.vue`) |
| large | 800 × 1000 | `'large'` |
| full | work area | `'full'` |

### 3.3 Position Mode

Four corner snap targets (↖ ↗ ↙ ↘) — calls `electronApplySizePreset` with alignment. Window is repositioned to the corresponding corner of the display's work area.

### 3.4 Visual Design

- **No backdrop dim/blur** — the character artwork stays fully visible
- Each button uses translucent glass: `bg-white/15 backdrop-blur-md border border-white/20`
- Mode toggle: `i-ph:plus-square` (Size) ↔ `i-ph:copy` (Position)
- Dismissed via canvas click (Teleported `fixed inset-0` backdrop with `@click.self`) or Escape

### 3.5 Unified Light-Dismiss Hierarchy

If both the expanded input drawer and the config overlay are open:

1. Clicking the stage canvas dismisses the **overlay first** (backdrop intercepts the click)
2. The input drawer stays open until dismissed by its own mechanisms (§2.2)
3. Escape dismisses overlay first (capture-phase listener in `actor.vue`); WhisperDock receives Escape once overlay is closed

## 4. Overflow Protection

`ensureWindowInVisibleBounds` in `display.ts:167` is the shared function used by all resize paths (ControlStrip, StageConfigOverlay, window restore). It now:

- Finds the display with the most overlap with the new window bounds
- If no overlap: centers on the primary display (existing behavior)
- If overlap: **clamps** the position to that display's work area so the window never overflows the viewport edge
