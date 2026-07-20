# Actor Stage UI Design & Interaction Specification

This document specifies the interaction lifecycle, visual language, and CSS layout architecture for the **Actor Stage** UI revamp. The objective is to resolve visual clutter over central character artwork caused by prominent floating control overlays, while retaining intuitive, ergonomic input access on desktop.

## Roadmap

- **First pass (current):** The bottom input drawer (`WhisperDock`) — the 4-state hover lifecycle, light-dismiss, and the 220px responsive fit. Covers both the collapsed notch trigger and the expanded input panel.
- **Second pass (deferred):** The View Configuration "Eye-Overlay" — a glassmorphism panel centralizing size/position/hide. Spec retained in §5.

## 1. Design Goals

- **Clean Canvas Priority:** Zero visual noise over artwork when the user is passively viewing. (State 1)
- **Desktop Hover Optimization:** Mouse hover and sub-pixel precision for discovery and proximity feedback. (States 2–3)
- **Ergonomic Anchoring:** Keep the bottom-center drawer mental model for text input pull-out. (State 4)
- **Robust Layout Responsiveness:** Control icons stay aligned and unclipped down to the 220px minimum stage width.

## 2. The 4-State Interaction Lifecycle

Unlike mobile touch interfaces, desktop allows discrete discovery and proximity trigger zones prior to click execution. The input drawer lifecycle:

| State | Trigger | Visibility | Cursor | Active controls |
| --- | --- | --- | --- | --- |
| **1: Passive** | Cursor outside window bounds | 0% opacity — 100% clean canvas | Default OS | None |
| **2: Discovery** | Cursor anywhere in window frame | Collapsed notch (subtle half-circle overflowing bottom edge) + top toolbar fade in | Default arrow | Toolbar buttons, notch hit area |
| **3: Proximity intent** | Cursor within 5–7px directly above notch | Notch raises 8–12px, brightens | Pointer (hand) | Notch activation target |
| **4: Expanded input** | Click on State 3 target | Full input drawer slides up from bottom edge | I-beam / pointer | Text input, magic wand, close 'X' |

### 2.1 Motion & Debouncing

- **Easing / duration:** `cubic-bezier(0.2, 0, 0, 1)` or ease-out at **150–200ms**. Mouse-driven feedback requires immediate visual acknowledgement.
- **Proximity zone precision:** the 5–7px trigger height prevents accidental activations when sweeping the cursor across the lower canvas, while keeping high intent accuracy near the notch.
- **Exit debounce:** on State 2 → 1 (cursor leaves window), apply a **100–150ms delay** before fading overlays to prevent strobing at window edges.

## 3. State 4 Persistence & Dismissal

Once expanded, the drawer remains **locked open** even if the cursor leaves the window or moves back over the canvas — no accidental focus loss while typing.

Dismissal mechanisms (any of):

1. **Canvas light-dismiss:** clicking anywhere on the character background outside the drawer closes it, returning to State 2 (or State 1 if the cursor is off-window).
2. **Escape** key.
3. **Close 'X'** button adjacent to the action items in the input pill.

## 4. Responsive Layout at 220px

Minimum stage width is 220px. At that width the expanded dock's original geometry (`px-6` = 48px horizontal padding, plus `gap-3`) pushed the close 'X' past the viewport edge. The tightened geometry:

- Container padding reduced (`px-6` → `px-3`) and item gap reduced (`gap-3` → `gap-2`).
- Text input: `flex: 1; min-width: 0` with ellipsis truncation — shrinks instead of pushing the action cluster.
- Action cluster (magic wand + close 'X'): `flex-shrink: 0` — never squashes or clips.

```css
/* Container pill */
.input-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding-inline: 12px;
}

/* Dynamic text input field */
.input-field {
  flex: 1;            /* Expands and contracts dynamically */
  min-width: 0;       /* Truncates instead of pushing flex bounds */
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

/* Action cluster (magic wand & close 'X') */
.action-cluster {
  flex-shrink: 0;     /* Icons never squash or clip */
  display: flex;
  align-items: center;
  gap: 8px;
}
```

## 5. Deferred: View Configuration "Eye-Overlay" (Second Pass)

> Deferred until after the first pass ships. The current top-right toolbar (drag handle + hide) stays as-is in the meantime.

Window state management (hide, size, position) shifts from the toolbar/right-click model to a centralized overlay triggered by the Stage Eye icon. Derived from image_15.png.

### 5.1 Visual Architecture

On clicking the Stage Eye icon, the stage background blurs heavily (`backdrop-filter: blur(12px)`) and dims (`rgba(15, 18, 28, 0.75)`). A centered frosted acrylic card appears, optimized for the 220px minimum width. Monochrome white iconography, **zero text labels** in the control grids — icon hierarchy alone defines actions.

Elements are stacked by priority so destructive/critical actions are never buried below presets:

```text
+--------------------------+  <-- 220px (mini mode)
|  [FROSTED ACRYLIC CARD]  |
|  +--------------------+  |
|  | [MODE-TOGGLE][HIDE]|  |  <-- ROW 1: prioritized actions
|  +--------------------+  |
|  | [Preset][Preset]   |  |  <-- ROW 2: 2x2 preset grid
|  | [Preset][Preset]   |  |      (sizes or corners)
|  +--------------------+  |
+--------------------------+
```

### 5.2 State A: SIZE MODE (default)

- **Row 1 — Left:** mode toggle — square outline with internal plus (Phosphor `plus-square` / Solar `add-square`). Swaps to POSITION MODE.
- **Row 1 — Right:** hide stage — `eye-slash` glyph, locked top-right of the card for instant access from the Eye trigger point.
- **Row 2 — 2x2 grid (monochrome white, text-free):**
  - Top-left: nested boxes with inner square — Mini
  - Top-right: clean square outline — Medium
  - Bottom-left: wide horizontal rectangle — Large
  - Bottom-right: maximize box with external corners (`frame-corners` / `expand`) — Full

### 5.3 State B: POSITION MODE

Triggered by the mode toggle. Grid swaps dynamically.

- **Row 1 — Left:** toggle back — `crop` or `arrows-out-simple`. Returns to SIZE MODE.
- **Row 1 — Right:** identical `eye-slash`, consistent position.
- **Row 2 — 2x2 grid:** corner ordinals only (↖ ↗ ↙ ↘). No center point or edges — sacrificed for extreme compactness at 220px. Buttons remain large click targets.

### 5.4 Overlay CSS Sketch

```css
.stage-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 18, 28, 0.75);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;  /* Actions first, grid second */
  padding: 12px;
  color: #fff;
  z-index: 10;
}

.overlay-actions-row {
  display: flex;
  justify-content: space-between; /* Toggle left, hide right */
  align-items: center;
  margin-bottom: 16px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-gap: 8px;
}

.grid-btn {
  aspect-ratio: 1;
  border-radius: 8px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
}
```

### 5.5 Unified Light-Dismiss Hierarchy

If both the expanded input drawer and the view configuration overlay are open:

1. Clicking the stage canvas dismisses the **overlay first**, restoring the blur-less artwork view.
2. The input drawer stays open until dismissed by its own explicit mechanisms (§3).
